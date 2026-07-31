import { FactoryError, type ClockPort, type IdGenPort } from "@repo/kernel";
import type { WorkCalendar } from "./calendar";
import { compareToBaseline, freezeBaseline, type BaselineComparison } from "./baseline";
import { applySchedule, computeSchedule, type Schedule } from "./cpm";
import type {
  Dependency,
  DependencyType,
  Plan,
  SchedulingConfig,
  StatusSummary,
  Task,
  TaskStatus,
} from "./model";

export interface SchedulingDeps {
  clock: ClockPort;
  idGen: IdGenPort;
  config: SchedulingConfig;
}

const STATUSES: TaskStatus[] = ["planned", "in_progress", "done", "blocked"];

/**
 * Planning engine. Add tasks/milestones, move status, track progress and
 * surface overdue work and by-assignee/status views. Pure over a Plan value.
 */
export class SchedulingService {
  constructor(private readonly deps: SchedulingDeps) {}

  empty(): Plan {
    return { tasks: [] };
  }

  addTask(
    plan: Plan,
    input: {
      title: string;
      plannedStart: string;
      plannedEnd: string;
      projectRef?: string;
      assignee?: string;
      milestone?: boolean;
      durationDays?: number;
      earliestStart?: string;
      sourceRef?: string;
    },
  ): Plan {
    if (input.plannedEnd < input.plannedStart) {
      throw new FactoryError("INVALID_STATE", "plannedEnd is before plannedStart.");
    }
    const task: Task = {
      id: this.deps.idGen.next("task"),
      projectRef: input.projectRef,
      title: input.title,
      assignee: input.assignee,
      plannedStart: input.plannedStart,
      plannedEnd: input.plannedEnd,
      status: "planned",
      progressPct: 0,
      milestone: input.milestone ?? false,
      durationDays: input.durationDays,
      earliestStart: input.earliestStart,
      sourceRef: input.sourceRef,
    };
    return { ...plan, tasks: [...plan.tasks, task] };
  }

  setStatus(plan: Plan, taskId: string, status: TaskStatus): Plan {
    return this.mutate(plan, taskId, (t) => ({
      ...t,
      status,
      progressPct: status === "done" ? 100 : t.progressPct,
    }));
  }

  setProgress(plan: Plan, taskId: string, pct: number): Plan {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    return this.mutate(plan, taskId, (t) => ({
      ...t,
      progressPct: clamped,
      status: clamped === 100 ? "done" : t.status === "planned" ? "in_progress" : t.status,
    }));
  }

  reschedule(plan: Plan, taskId: string, plannedStart: string, plannedEnd: string): Plan {
    if (plannedEnd < plannedStart)
      throw new FactoryError("INVALID_STATE", "plannedEnd is before plannedStart.");
    return this.mutate(plan, taskId, (t) => ({ ...t, plannedStart, plannedEnd }));
  }

  /* ---------------------------------------------------------------------
     Network: calendar, dependencies, and the recalculation they drive.
     Every one of these returns a new Plan — the capability stays pure and
     the host owns persistence.
     --------------------------------------------------------------------- */

  /** Replace the working calendar. Durations are re-read against it on the next pass. */
  setCalendar(plan: Plan, calendar: WorkCalendar): Plan {
    if (!calendar.workingWeekdays.length) {
      throw new FactoryError("INVALID_STATE", "A calendar needs at least one working weekday.");
    }
    return { ...plan, calendar };
  }

  /**
   * Tie two tasks together. The link is rejected if it would close a cycle —
   * checked by scheduling the result, so the answer comes from the same code
   * that would have to live with it.
   */
  link(
    plan: Plan,
    input: {
      predecessorId: string;
      successorId: string;
      type?: DependencyType;
      lagDays?: number;
    },
  ): Plan {
    const { predecessorId, successorId } = input;
    if (predecessorId === successorId) {
      throw new FactoryError("INVALID_STATE", "A task cannot depend on itself.");
    }
    for (const id of [predecessorId, successorId]) {
      if (!plan.tasks.some((t) => t.id === id)) {
        throw new FactoryError("NOT_FOUND", `Task ${id} not found.`);
      }
    }
    const deps = plan.dependencies ?? [];
    const type = input.type ?? "FS";
    if (
      deps.some(
        (d) =>
          d.predecessorId === predecessorId && d.successorId === successorId && d.type === type,
      )
    ) {
      throw new FactoryError(
        "INVALID_STATE",
        `Those two tasks are already linked ${type}; edit the existing dependency instead.`,
      );
    }
    const dep: Dependency = {
      id: this.deps.idGen.next("dep"),
      predecessorId,
      successorId,
      type,
      lagDays: Math.round(input.lagDays ?? 0),
    };
    const next: Plan = { ...plan, dependencies: [...deps, dep] };
    computeSchedule(next); // throws INVALID_STATE on a cycle
    return next;
  }

  unlink(plan: Plan, dependencyId: string): Plan {
    const deps = plan.dependencies ?? [];
    if (!deps.some((d) => d.id === dependencyId)) {
      throw new FactoryError("NOT_FOUND", `Dependency ${dependencyId} not found.`);
    }
    return { ...plan, dependencies: deps.filter((d) => d.id !== dependencyId) };
  }

  /** Change how long a task takes, in working days. Milestones stay at zero. */
  setDuration(plan: Plan, taskId: string, durationDays: number): Plan {
    if (durationDays < 0) {
      throw new FactoryError("INVALID_STATE", "Duration cannot be negative.");
    }
    return this.mutate(plan, taskId, (t) => ({
      ...t,
      durationDays: t.milestone ? 0 : Math.round(durationDays),
    }));
  }

  /**
   * Pin a task to a date — what dragging a bar means. It becomes a
   * start-no-earlier-than constraint rather than a fixed date, so the task
   * still moves if a predecessor pushes it later; it simply stops drifting
   * earlier than the date a human chose.
   */
  moveTask(plan: Plan, taskId: string, start: string): Plan {
    return this.mutate(plan, taskId, (t) => ({ ...t, earliestStart: start }));
  }

  /** Drop the pin and let the task float back to its earliest possible date. */
  unpin(plan: Plan, taskId: string): Plan {
    return this.mutate(plan, taskId, (t) => ({ ...t, earliestStart: undefined }));
  }

  /** Both CPM passes: dates, floats and the critical path. Does not mutate. */
  schedule(plan: Plan, from?: string): Schedule {
    return computeSchedule(plan, { from });
  }

  /**
   * Rewrite every task's planned dates from the schedule. This is what makes
   * the plan's finish move on its own when a task is dragged, a duration
   * changes or a link is added.
   */
  recalculate(plan: Plan, from?: string): Plan {
    return applySchedule(plan, computeSchedule(plan, { from }));
  }

  /** The plan's finish — the date the last task ends. */
  finishDate(plan: Plan, from?: string): string {
    return computeSchedule(plan, { from }).finish;
  }

  /** Tasks with no float, in dependency order. */
  criticalPath(plan: Plan, from?: string): Task[] {
    const ids = computeSchedule(plan, { from }).criticalPath;
    const byId = new Map(plan.tasks.map((t) => [t.id, t]));
    return ids.map((id) => byId.get(id)!).filter(Boolean);
  }

  /* ---------------------------------------------------------------------
     Baselines
     --------------------------------------------------------------------- */

  /** Freeze the plan under a label — approval, contract signature, revision. */
  freezeBaseline(plan: Plan, label: string, asOf?: string): Plan {
    return freezeBaseline(plan, {
      id: this.deps.idGen.next("bl"),
      label,
      frozenAt: asOf ?? this.deps.clock.todayIso(),
    });
  }

  /** Current dates against a frozen baseline, in working days. */
  compareToBaseline(plan: Plan, baselineId?: string): BaselineComparison {
    return compareToBaseline(plan, baselineId);
  }

  /** Tasks past their planned end and not done, soonest end first. */
  overdue(plan: Plan, asOf?: string): Task[] {
    const today = asOf ?? this.deps.clock.todayIso();
    return plan.tasks
      .filter((t) => t.status !== "done" && t.plannedEnd < today)
      .sort((a, b) => (a.plannedEnd < b.plannedEnd ? -1 : 1));
  }

  byAssignee(plan: Plan, assignee: string): Task[] {
    return plan.tasks.filter((t) => t.assignee === assignee);
  }

  summary(plan: Plan): StatusSummary[] {
    return STATUSES.map((status) => ({
      status,
      count: plan.tasks.filter((t) => t.status === status).length,
    }));
  }

  private mutate(plan: Plan, taskId: string, fn: (t: Task) => Task): Plan {
    const idx = plan.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new FactoryError("NOT_FOUND", `Task ${taskId} not found.`);
    return { ...plan, tasks: plan.tasks.map((t, i) => (i === idx ? fn(t) : t)) };
  }
}

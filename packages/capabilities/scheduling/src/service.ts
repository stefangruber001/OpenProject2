import { FactoryError, type ClockPort, type IdGenPort } from "@repo/kernel";
import type { Plan, SchedulingConfig, StatusSummary, Task, TaskStatus } from "./model";

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

import { FactoryError } from "@repo/kernel";
import {
  addWorkingDays,
  everyDayCalendar,
  finishOf,
  snapForward,
  startFor,
  workingDayOffset,
  workingDaysInclusive,
  type WorkCalendar,
} from "./calendar";
import type { Dependency, Plan, Task } from "./model";

/** One task's place in the network, after both passes. */
export interface ScheduledTask {
  taskId: string;
  start: string;
  finish: string;
  durationDays: number;
  lateStart: string;
  lateFinish: string;
  /** Working days this task can slip before the plan's finish moves. */
  totalFloatDays: number;
  critical: boolean;
}

export interface Schedule {
  start: string;
  finish: string;
  tasks: ScheduledTask[];
  /** Zero-float tasks in dependency order — the chain that owns the finish. */
  criticalPath: string[];
}

export function calendarOf(plan: Plan): WorkCalendar {
  return plan.calendar ?? everyDayCalendar();
}

/**
 * Duration in working days. A milestone is zero by definition; otherwise an
 * explicit `durationDays` wins, and a task that carries neither is measured
 * off the dates it already has — which is what lets a plan written before
 * durations existed schedule without being migrated first.
 */
export function durationOf(cal: WorkCalendar, task: Task): number {
  if (task.milestone) return 0;
  if (typeof task.durationDays === "number") return Math.max(0, Math.round(task.durationDays));
  return Math.max(1, workingDaysInclusive(cal, task.plannedStart, task.plannedEnd));
}

/**
 * Dependency-order the tasks, and refuse a cycle loudly.
 *
 * A cycle is not an exotic input: it is two clicks in a chart that links A to
 * B and B back to A. Scheduling one would either loop forever or silently
 * drop a constraint, so it fails with the tasks involved named.
 */
export function topologicalOrder(tasks: Task[], deps: Dependency[]): string[] {
  const indegree = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const t of tasks) {
    indegree.set(t.id, 0);
    successors.set(t.id, []);
  }
  for (const d of deps) {
    if (!indegree.has(d.predecessorId) || !indegree.has(d.successorId)) {
      throw new FactoryError(
        "NOT_FOUND",
        `Dependency ${d.id} points at a task that is not in the plan.`,
        { predecessorId: d.predecessorId, successorId: d.successorId },
      );
    }
    successors.get(d.predecessorId)!.push(d.successorId);
    indegree.set(d.successorId, (indegree.get(d.successorId) ?? 0) + 1);
  }

  // Ready set in declaration order, so an unconstrained plan schedules in the
  // order a human entered it rather than in map-iteration order.
  const ready = tasks.filter((t) => (indegree.get(t.id) ?? 0) === 0).map((t) => t.id);
  const order: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const s of successors.get(id) ?? []) {
      const left = (indegree.get(s) ?? 0) - 1;
      indegree.set(s, left);
      if (left === 0) ready.push(s);
    }
  }
  if (order.length !== tasks.length) {
    const stuck = tasks.filter((t) => !order.includes(t.id)).map((t) => t.id);
    throw new FactoryError(
      "INVALID_STATE",
      `The dependencies form a cycle: ${stuck.join(" → ")}.`,
      {
        taskIds: stuck,
      },
    );
  }
  return order;
}

/**
 * Forward and backward pass over the network.
 *
 * Forward gives every task the earliest date its predecessors and its own
 * start-no-earlier-than constraint allow; backward gives it the latest date
 * that leaves the plan's finish where the forward pass put it. The difference
 * is total float, and zero float is the critical path — the tasks where a
 * day lost is a day lost on the whole plan.
 */
export function computeSchedule(plan: Plan, opts: { from?: string } = {}): Schedule {
  const cal = calendarOf(plan);
  const tasks = plan.tasks;
  const deps = plan.dependencies ?? [];

  if (!tasks.length) {
    const anchor = snapForward(cal, opts.from ?? "1970-01-01");
    return { start: anchor, finish: anchor, tasks: [], criticalPath: [] };
  }

  const order = topologicalOrder(tasks, deps);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const predsOf = new Map<string, Dependency[]>();
  const succsOf = new Map<string, Dependency[]>();
  for (const t of tasks) {
    predsOf.set(t.id, []);
    succsOf.set(t.id, []);
  }
  for (const d of deps) {
    predsOf.get(d.successorId)!.push(d);
    succsOf.get(d.predecessorId)!.push(d);
  }

  // Where the plan may start at the earliest. Given explicitly (the host's
  // "replan from today"), or the earliest anchor the tasks already carry.
  const anchors = tasks.map((t) => t.earliestStart ?? t.plannedStart);
  const planStart = snapForward(cal, opts.from ?? anchors.reduce((a, b) => (a < b ? a : b)));

  const start = new Map<string, string>();
  const finish = new Map<string, string>();
  for (const id of order) {
    const task = byId.get(id)!;
    const duration = durationOf(cal, task);
    let earliest = snapForward(cal, task.earliestStart ?? planStart);
    for (const d of predsOf.get(id) ?? []) {
      const ps = start.get(d.predecessorId)!;
      const pf = finish.get(d.predecessorId)!;
      let candidate: string;
      if (d.type === "FS") candidate = addWorkingDays(cal, pf, 1 + d.lagDays);
      else if (d.type === "SS") candidate = addWorkingDays(cal, ps, d.lagDays);
      else candidate = startFor(cal, addWorkingDays(cal, pf, d.lagDays), duration);
      if (candidate > earliest) earliest = candidate;
    }
    start.set(id, earliest);
    finish.set(id, finishOf(cal, earliest, duration));
  }

  const planFinish = order.map((id) => finish.get(id)!).reduce((a, b) => (a > b ? a : b));

  const lateStart = new Map<string, string>();
  const lateFinish = new Map<string, string>();
  for (const id of [...order].reverse()) {
    const task = byId.get(id)!;
    const duration = durationOf(cal, task);
    let latestFinish = planFinish;
    for (const d of succsOf.get(id) ?? []) {
      const ss = lateStart.get(d.successorId)!;
      const sf = lateFinish.get(d.successorId)!;
      let candidate: string;
      if (d.type === "FS") candidate = addWorkingDays(cal, ss, -(1 + d.lagDays));
      else if (d.type === "SS")
        candidate = finishOf(cal, addWorkingDays(cal, ss, -d.lagDays), duration);
      else candidate = addWorkingDays(cal, sf, -d.lagDays);
      if (candidate < latestFinish) latestFinish = candidate;
    }
    lateFinish.set(id, latestFinish);
    lateStart.set(id, startFor(cal, latestFinish, duration));
  }

  const scheduled: ScheduledTask[] = order.map((id) => {
    const task = byId.get(id)!;
    const float = workingDayOffset(cal, start.get(id)!, lateStart.get(id)!);
    return {
      taskId: id,
      start: start.get(id)!,
      finish: finish.get(id)!,
      durationDays: durationOf(cal, task),
      lateStart: lateStart.get(id)!,
      lateFinish: lateFinish.get(id)!,
      totalFloatDays: float,
      critical: float <= 0,
    };
  });

  return {
    start: scheduled.map((s) => s.start).reduce((a, b) => (a < b ? a : b), planStart),
    finish: planFinish,
    tasks: scheduled,
    criticalPath: scheduled.filter((s) => s.critical).map((s) => s.taskId),
  };
}

/** The plan's own dates rewritten from the schedule — the "close date moves". */
export function applySchedule(plan: Plan, schedule: Schedule): Plan {
  const byId = new Map(schedule.tasks.map((s) => [s.taskId, s]));
  return {
    ...plan,
    tasks: plan.tasks.map((t) => {
      const s = byId.get(t.id);
      return s ? { ...t, plannedStart: s.start, plannedEnd: s.finish } : t;
    }),
  };
}

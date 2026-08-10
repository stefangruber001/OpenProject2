import { FactoryError } from "@repo/kernel";
import { workingDayOffset } from "./calendar";
import { calendarOf, durationOf } from "./cpm";
import type { Baseline, BaselineTask, Plan } from "./model";

export type DriftStatus = "on_plan" | "ahead" | "late" | "added" | "removed";

export interface TaskDrift {
  taskId: string;
  title: string;
  status: DriftStatus;
  /** Working days later than the baseline; negative is earlier. */
  startDriftDays: number;
  finishDriftDays: number;
  durationDriftDays: number;
}

export interface BaselineComparison {
  baselineId: string;
  label: string;
  baselineFinish: string;
  currentFinish: string;
  finishDriftDays: number;
  tasks: TaskDrift[];
}

/**
 * Freeze the plan as it stands.
 *
 * A baseline is a promise with a date on it: what the plan said when it was
 * approved. Everything after that is measured against it, which only works if
 * the snapshot itself can never be edited — so baselines are append-only and
 * a label can only be used once.
 */
export function freezeBaseline(
  plan: Plan,
  input: { id: string; label: string; frozenAt: string },
): Plan {
  const existing = plan.baselines ?? [];
  if (existing.some((b) => b.label === input.label)) {
    throw new FactoryError(
      "IMMUTABLE",
      `A baseline labelled "${input.label}" already exists and cannot be replaced.`,
    );
  }
  const cal = calendarOf(plan);
  const tasks: BaselineTask[] = plan.tasks.map((t) => ({
    taskId: t.id,
    title: t.title,
    start: t.plannedStart,
    finish: t.plannedEnd,
    durationDays: durationOf(cal, t),
    milestone: t.milestone,
  }));
  const finish = tasks.length
    ? tasks.map((t) => t.finish).reduce((a, b) => (a > b ? a : b))
    : input.frozenAt;
  const baseline: Baseline = {
    id: input.id,
    label: input.label,
    frozenAt: input.frozenAt,
    finish,
    tasks,
  };
  return { ...plan, baselines: [...existing, baseline] };
}

/**
 * Planned versus current, in working days.
 *
 * Drift is deliberately measured in working days, not calendar days: a plan
 * that crosses a two-week closure has not slipped by two weeks, and reporting
 * that it has would send someone to a site meeting with the wrong number.
 * Compares the plan's own dates, so recalculate first if the network changed.
 */
export function compareToBaseline(plan: Plan, baselineId?: string): BaselineComparison {
  const baselines = plan.baselines ?? [];
  if (!baselines.length) {
    throw new FactoryError("NOT_FOUND", "The plan has no baseline to compare against.");
  }
  const baseline = baselineId
    ? baselines.find((b) => b.id === baselineId)
    : baselines[baselines.length - 1];
  if (!baseline) {
    throw new FactoryError("NOT_FOUND", `Baseline ${baselineId} not found.`);
  }

  const cal = calendarOf(plan);
  const current = new Map(plan.tasks.map((t) => [t.id, t]));
  const drifts: TaskDrift[] = [];

  for (const b of baseline.tasks) {
    const now = current.get(b.taskId);
    if (!now) {
      drifts.push({
        taskId: b.taskId,
        title: b.title,
        status: "removed",
        startDriftDays: 0,
        finishDriftDays: 0,
        durationDriftDays: -b.durationDays,
      });
      continue;
    }
    const startDrift = workingDayOffset(cal, b.start, now.plannedStart);
    const finishDrift = workingDayOffset(cal, b.finish, now.plannedEnd);
    drifts.push({
      taskId: b.taskId,
      title: now.title,
      status: finishDrift > 0 ? "late" : finishDrift < 0 ? "ahead" : "on_plan",
      startDriftDays: startDrift,
      finishDriftDays: finishDrift,
      durationDriftDays: durationOf(cal, now) - b.durationDays,
    });
  }

  const known = new Set(baseline.tasks.map((t) => t.taskId));
  for (const t of plan.tasks) {
    if (known.has(t.id)) continue;
    drifts.push({
      taskId: t.id,
      title: t.title,
      status: "added",
      startDriftDays: 0,
      finishDriftDays: 0,
      durationDriftDays: durationOf(cal, t),
    });
  }

  const currentFinish = plan.tasks.length
    ? plan.tasks.map((t) => t.plannedEnd).reduce((a, b) => (a > b ? a : b))
    : baseline.finish;

  return {
    baselineId: baseline.id,
    label: baseline.label,
    baselineFinish: baseline.finish,
    currentFinish,
    finishDriftDays: workingDayOffset(cal, baseline.finish, currentFinish),
    tasks: drifts,
  };
}

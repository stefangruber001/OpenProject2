import {
  addWorkingDays,
  snapForward,
  workingDayOffset,
  workingDaysInclusive,
  type WorkCalendar,
} from "./calendar";
import { calendarOf, type Schedule, type ScheduledTask } from "./cpm";
import type { Plan, ProgressEntry, Task } from "./model";

/**
 * Planned vs actual vs projected — the three lines everyone actually asks
 * about, and the deviations that follow from them.
 *
 * Two honesty constraints shape this module.
 *
 * The first: the ACTUAL line is drawn from the progress log, never from
 * today's percentages. A task that is 60 % done today was not 60 % done last
 * month, and a curve that pretends otherwise makes every past week look like
 * it went to plan. Before the first observation the line sits at ZERO from
 * the plan's start: on day one nothing had been recorded because nothing had
 * been done, and a chart with no actual line at all read as broken to the
 * person it was drawn for — zero recorded is itself the record.
 *
 * The second: the PROJECTED line is an extrapolation and is labelled as one.
 * It stretches the remaining planned work by the pace observed so far — if
 * half the time has produced two thirds of the planned progress, the rest is
 * assumed to continue at that pace. That is a defensible guess, not a fact,
 * and `performanceIndex` is returned so a caller can show what it rests on.
 * One observation is not a pace: until the log carries two distinct dates
 * the projection is withheld entirely (null, finish = the plan's own),
 * because a line extrapolated from a single day swings wildly with that
 * day and reads as a forecast nobody made.
 */

export interface CurvePoint {
  date: string;
  /** Cumulative planned progress, 0-100. */
  plannedPct: number;
  /** Cumulative recorded progress: zero before the first observation
   *  (nothing recorded IS the record), null only after `asOf`. */
  actualPct: number | null;
  /** Extrapolated progress after `asOf`, or null on or before it. */
  projectedPct: number | null;
}

export interface ProgressCurve {
  asOf: string;
  points: CurvePoint[];
  /** Where the plan says the work should be by `asOf`. */
  plannedPct: number;
  /** Where it actually is. */
  actualPct: number;
  /** actual − planned. Negative is behind. */
  driftPct: number;
  /**
   * actual ÷ planned at `asOf`. Above 1 is ahead of the curve. Null when the
   * plan says no work should have started yet, in which case being at zero is
   * not a judgement about anything.
   */
  performanceIndex: number | null;
  /** The plan's own finish, and where the observed pace points instead. */
  plannedFinish: string;
  projectedFinish: string;
}

export type RiskKind = "not_started" | "overdue" | "behind";

export interface RiskItem {
  taskId: string;
  title: string;
  kind: RiskKind;
  critical: boolean;
  /** Working days late: since it should have started, finished, or nothing. */
  days: number;
  plannedPct: number;
  actualPct: number;
}

export interface RiskReport {
  asOf: string;
  finish: string;
  baselineFinish: string | null;
  /** Working days the finish has moved past the baseline. Negative is early. */
  delayDays: number;
  /** True once `delayDays` reaches the caller's threshold. */
  overThreshold: boolean;
  items: RiskItem[];
  criticalAtRisk: number;
}

export interface CurveOptions {
  asOf: string;
  /**
   * Relative importance per task id. Defaults to duration, which gives a
   * time-weighted curve; a caller that knows what each task is worth should
   * pass value instead, because a week of demolition and a week of joinery
   * are not the same amount of project.
   */
  weights?: Record<string, number>;
  /** Roughly how many points to draw. The sampling step follows from it. */
  samples?: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const pct = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

function weightOf(weights: Record<string, number> | undefined, st: ScheduledTask): number {
  const w = weights?.[st.taskId];
  if (typeof w === "number" && Number.isFinite(w) && w > 0) return w;
  // A milestone has no duration and would otherwise weigh nothing at all; it
  // still represents a thing that either happened or did not.
  return Math.max(st.durationDays, 1);
}

/**
 * How much of one task the plan says is done by `date`: none before it starts,
 * all after it finishes, and pro rata across its working days in between.
 */
function plannedFractionAt(cal: WorkCalendar, st: ScheduledTask, date: string): number {
  if (date < st.start) return 0;
  if (date >= st.finish) return 1;
  const done = workingDaysInclusive(cal, st.start, date);
  const total = Math.max(1, st.durationDays);
  return clamp(done / total, 0, 1);
}

/** The last percentage recorded for a task on or before `date`. */
function recordedPctAt(log: ProgressEntry[], taskId: string, date: string): number | null {
  let best: ProgressEntry | null = null;
  for (const e of log) {
    if (e.taskId !== taskId || e.date > date) continue;
    if (!best || e.date > best.date) best = e;
  }
  return best ? best.pct : null;
}

export function progressCurve(
  plan: Plan,
  schedule: Schedule,
  options: CurveOptions,
): ProgressCurve {
  const cal = calendarOf(plan);
  const log = plan.progressLog ?? [];
  const asOf = options.asOf;
  const scheduled = schedule.tasks;

  const totalWeight = scheduled.reduce((s, st) => s + weightOf(options.weights, st), 0);
  const plannedAt = (date: string): number =>
    pct(
      scheduled.reduce(
        (s, st) => s + weightOf(options.weights, st) * plannedFractionAt(cal, st, date),
        0,
      ),
      totalWeight,
    );

  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  const actualAt = (date: string): number => {
    let sum = 0;
    for (const st of scheduled) {
      const recorded = recordedPctAt(log, st.taskId, date);
      sum += weightOf(options.weights, st) * (clamp(recorded ?? 0, 0, 100) / 100);
    }
    // Zero when nothing was recorded by `date` — the line exists from day
    // one, at the only value the record supports.
    return pct(sum, totalWeight);
  };

  // A pace needs two points. Count distinct observation DATES, not entries:
  // ten task rows logged on one afternoon are still one day of evidence.
  const observationDates = new Set(log.map((e) => e.date)).size;
  const canProject = observationDates >= 2;

  /** Today's figure comes from the tasks themselves, not the log: the log may
      lag behind an edit, and "where is it now" must match what the grid says. */
  const actualNow = pct(
    scheduled.reduce((s, st) => {
      const t: Task | undefined = byId.get(st.taskId);
      return s + weightOf(options.weights, st) * (clamp(t?.progressPct ?? 0, 0, 100) / 100);
    }, 0),
    totalWeight,
  );

  const plannedNow = plannedAt(asOf);
  const performanceIndex = plannedNow > 0 ? Math.round((actualNow / plannedNow) * 100) / 100 : null;

  // Projected finish: the work still to do, at the pace observed so far. A
  // plan already past its finish has nothing left to stretch.
  const remainingDays =
    asOf >= schedule.finish ? 0 : Math.max(0, workingDaysInclusive(cal, asOf, schedule.finish) - 1);
  const stretch = performanceIndex && performanceIndex > 0 ? 1 / performanceIndex : 1;
  const projectedFinish =
    !canProject || remainingDays === 0
      ? schedule.finish
      : addWorkingDays(cal, snapForward(cal, asOf), Math.round(remainingDays * stretch));

  const horizon = projectedFinish > schedule.finish ? projectedFinish : schedule.finish;
  const span = Math.max(1, workingDaysInclusive(cal, schedule.start, horizon));
  const samples = Math.max(2, Math.min(options.samples ?? 24, span));
  const step = Math.max(1, Math.ceil(span / samples));

  const points: CurvePoint[] = [];
  for (let d = 0; d < span; d += step) {
    const date = addWorkingDays(cal, schedule.start, d);
    points.push({
      date,
      plannedPct: plannedAt(date),
      actualPct: date <= asOf ? actualAt(date) : null,
      // Anchored on the actual line so the two meet rather than jumping at
      // `asOf`, then continuing at the observed pace: the work the plan
      // expects between now and `date`, achieved at `performanceIndex` of it.
      projectedPct:
        canProject && date > asOf
          ? clamp(actualNow + (plannedAt(date) - plannedNow) * (performanceIndex ?? 1), 0, 100)
          : null,
    });
  }
  const last = points[points.length - 1];
  if (!last || last.date !== horizon) {
    points.push({
      date: horizon,
      plannedPct: plannedAt(horizon),
      actualPct: horizon <= asOf ? actualAt(horizon) : null,
      projectedPct: canProject && horizon > asOf ? 100 : null,
    });
  }
  // A sample exactly at `asOf`, always: the step lands where it lands, and a
  // curve whose actual line stops short of today — or whose projection takes
  // off from a date nobody is standing on — reads as a gap in the story.
  if (asOf >= schedule.start && asOf <= horizon && !points.some((pt) => pt.date === asOf)) {
    points.push({
      date: asOf,
      plannedPct: plannedNow,
      actualPct: actualAt(asOf),
      projectedPct: null,
    });
    points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  return {
    asOf,
    points,
    plannedPct: plannedNow,
    actualPct: actualNow,
    driftPct: Math.round((actualNow - plannedNow) * 10) / 10,
    performanceIndex,
    plannedFinish: schedule.finish,
    projectedFinish,
  };
}

export interface RiskOptions {
  asOf: string;
  /** Working days of slip that turn a deviation into an alert. */
  thresholdDays?: number;
  /** Percentage points a task may lag its plan before it counts as behind. */
  tolerancePct?: number;
  /** Compare the finish against this baseline label; defaults to the newest. */
  baselineLabel?: string;
}

/**
 * Which tasks are in trouble, and by how much.
 *
 * Deliberately three named kinds rather than one score: "should have started
 * and has not", "should have finished and has not" and "is being done more
 * slowly than planned" call for different conversations, and collapsing them
 * into a single risk number hides which one it is.
 */
export function riskReport(plan: Plan, schedule: Schedule, options: RiskOptions): RiskReport {
  const cal = calendarOf(plan);
  const asOf = options.asOf;
  const tolerance = options.tolerancePct ?? 10;
  const threshold = options.thresholdDays ?? 5;
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));

  const baselines = plan.baselines ?? [];
  const baseline = options.baselineLabel
    ? baselines.find((b) => b.label === options.baselineLabel)
    : baselines[baselines.length - 1];
  const baselineFinish = baseline ? baseline.finish : null;
  const delayDays = baselineFinish ? workingDayOffset(cal, baselineFinish, schedule.finish) : 0;

  const items: RiskItem[] = [];
  for (const st of schedule.tasks) {
    const task = byId.get(st.taskId);
    if (!task) continue;
    const actual = clamp(task.progressPct ?? 0, 0, 100);
    const planned = Math.round(plannedFractionAt(cal, st, asOf) * 100);

    if (actual >= 100) continue;
    if (st.finish < asOf) {
      items.push({
        taskId: st.taskId,
        title: task.title,
        kind: "overdue",
        critical: st.critical,
        days: workingDayOffset(cal, st.finish, asOf),
        plannedPct: planned,
        actualPct: actual,
      });
    } else if (actual === 0 && st.start < asOf) {
      items.push({
        taskId: st.taskId,
        title: task.title,
        kind: "not_started",
        critical: st.critical,
        days: workingDayOffset(cal, st.start, asOf),
        plannedPct: planned,
        actualPct: actual,
      });
    } else if (planned - actual > tolerance) {
      items.push({
        taskId: st.taskId,
        title: task.title,
        kind: "behind",
        critical: st.critical,
        days: 0,
        plannedPct: planned,
        actualPct: actual,
      });
    }
  }

  // Worst first, and a critical task always outranks a non-critical one with
  // the same slip: on the critical path a lost day is a lost day of delivery.
  items.sort((a, b) => Number(b.critical) - Number(a.critical) || b.days - a.days);

  return {
    asOf,
    finish: schedule.finish,
    baselineFinish,
    delayDays,
    overThreshold: delayDays >= threshold,
    items,
    criticalAtRisk: items.filter((i) => i.critical).length,
  };
}

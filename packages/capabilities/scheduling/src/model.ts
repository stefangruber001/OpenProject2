import { z } from "zod";
import type { WorkCalendar } from "./calendar";

/**
 * Planning is generic: tasks and milestones with planned dates, an assignee
 * (opaque owner key) and a status. No sector or jurisdiction knowledge.
 */
export type TaskStatus = "planned" | "in_progress" | "done" | "blocked";

export interface Task {
  id: string;
  projectRef?: string;
  title: string;
  assignee?: string;
  plannedStart: string;
  plannedEnd: string;
  status: TaskStatus;
  progressPct: number;
  milestone: boolean;
  /**
   * Duration in WORKING days. Optional so that a plan built before durations
   * existed still schedules: when it is absent the duration is read back off
   * plannedStart..plannedEnd against the plan's calendar.
   */
  durationDays?: number;
  /**
   * Start-no-earlier-than constraint. This is what dragging a bar in a chart
   * sets: the task stops floating to its earliest possible date and holds the
   * position a human chose, while its successors still move behind it.
   */
  earliestStart?: string;
  /**
   * Opaque link back to whatever produced this task — a budget chapter, a
   * contract payment milestone. The capability never interprets it; it exists
   * so the host can trace a bar back to its origin.
   */
  sourceRef?: string;
}

/**
 * How a successor is tied to its predecessor.
 * - `FS` finish-to-start: the successor starts after the predecessor finishes.
 * - `SS` start-to-start: they start together.
 * - `FF` finish-to-finish: they finish together.
 *
 * Every dependency carries a lag in working days, which may be negative — a
 * lead, i.e. the successor may overlap its predecessor by that much.
 */
export type DependencyType = "FS" | "SS" | "FF";

export interface Dependency {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

/**
 * A frozen snapshot of the plan, kept for comparison and never edited again.
 * Baselines are how "planned vs actual" stays answerable after the plan has
 * moved: the plan may change, the record of what was promised may not.
 */
export interface BaselineTask {
  taskId: string;
  title: string;
  start: string;
  finish: string;
  durationDays: number;
  milestone: boolean;
}

export interface Baseline {
  id: string;
  label: string;
  frozenAt: string;
  finish: string;
  tasks: BaselineTask[];
}

export interface Plan {
  tasks: Task[];
  /** Absent on plans built before dependencies existed — treated as none. */
  dependencies?: Dependency[];
  /** Absent means every day is a working day (see `everyDayCalendar`). */
  calendar?: WorkCalendar;
  /** Append-only: a baseline is never modified once frozen. */
  baselines?: Baseline[];
}

export const schedulingConfigSchema = z.object({}).default({});
export type SchedulingConfig = z.infer<typeof schedulingConfigSchema>;

export interface StatusSummary {
  status: TaskStatus;
  count: number;
}

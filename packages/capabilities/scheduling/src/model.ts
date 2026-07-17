import { z } from "zod";

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
}

export interface Plan {
  tasks: Task[];
}

export const schedulingConfigSchema = z.object({}).default({});
export type SchedulingConfig = z.infer<typeof schedulingConfigSchema>;

export interface StatusSummary {
  status: TaskStatus;
  count: number;
}

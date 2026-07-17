import { z } from "zod";
import type { Cents } from "@repo/kernel";

/**
 * Time tracking is generic: labour entries against a project (and optional
 * chapter) by a person, in whole minutes, with an optional hourly rate for
 * costing. "Chapter" is an opaque grouping key.
 */
export interface TimeEntry {
  id: string;
  projectRef: string;
  chapter?: string;
  personRef: string;
  date: string;
  minutes: number;
  ratePerHourCents?: Cents;
}

export interface Book {
  entries: TimeEntry[];
}

export const timeConfigSchema = z
  .object({
    /** Fallback hourly rate (cents) when an entry has none. */
    defaultRatePerHourCents: z.number().int().min(0).default(0),
  })
  .default({});
export type TimeConfig = z.infer<typeof timeConfigSchema>;

export interface ChapterLabour {
  chapter: string;
  minutes: number;
  costCents: Cents;
}

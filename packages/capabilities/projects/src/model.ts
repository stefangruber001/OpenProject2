import { z } from "zod";
import type { Cents } from "@repo/kernel";

/**
 * Project control is generic: a project has an immutable baseline (from an
 * accepted quote), costs booked against it, change orders that adjust the
 * *current* budget without touching the baseline, and revenue. "Chapter" is an
 * opaque grouping key — the vertical pack decides what chapters mean.
 */

/** A per-chapter budget figure copied from the accepted quote (frozen). */
export interface ChapterBudget {
  chapter: string;
  budgetCents: Cents;
}

export type CostKind = "committed" | "actual";

/** A committed (PO raised) or actual (bill booked) cost against a chapter. */
export interface CostEntry {
  id: string;
  kind: CostKind;
  chapter: string;
  description: string;
  amountCents: Cents;
  date: string;
  ref?: string;
}

export type ChangeStatus = "proposed" | "approved" | "rejected";

/** A change order. Approved ones adjust the current budget; baseline is kept. */
export interface ChangeOrder {
  id: string;
  chapter: string;
  description: string;
  deltaCents: Cents;
  status: ChangeStatus;
  date: string;
}

export interface Project {
  id: string;
  name: string;
  /** Opaque reference to the customer (crm capability owns customers). */
  customerRef?: string;
  /** The accepted quote this project was created from (no re-entry). */
  sourceQuoteId?: string;
  /** Immutable total baseline (sum of chapter budgets at acceptance). */
  baselineCents: Cents;
  baselineByChapter: ChapterBudget[];
  /** Invoiced revenue to date (the billing capability issues the invoices). */
  revenueCents: Cents;
  costs: CostEntry[];
  changeOrders: ChangeOrder[];
  status: "active" | "closed";
  createdAt: string;
}

export const projectsConfigSchema = z
  .object({
    /** Margin below this (basis points of revenue) raises a watch flag. */
    marginFloorBp: z.number().int().min(0).max(10_000).default(1200),
  })
  .default({});
export type ProjectsConfig = z.infer<typeof projectsConfigSchema>;

/** Per-chapter quoted-vs-actual view — tenant #1's core pain point. */
export interface ChapterVariance {
  chapter: string;
  budgetCents: Cents;
  committedCents: Cents;
  actualCents: Cents;
  /** actual − budget (positive = over budget). */
  varianceCents: Cents;
  varianceBp: number;
}

export interface ProjectFinancials {
  baselineCents: Cents;
  approvedChangesCents: Cents;
  /** baseline + approved change orders. */
  currentBudgetCents: Cents;
  committedCents: Cents;
  actualCents: Cents;
  revenueCents: Cents;
  /** revenue − actual cost. */
  marginCents: Cents;
  marginBp: number;
  /** currentBudget − max(actual, committed): where profit is heading. */
  forecastProfitCents: Cents;
  marginBelowFloor: boolean;
  byChapter: ChapterVariance[];
}

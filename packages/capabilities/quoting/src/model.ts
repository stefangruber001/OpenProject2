import type { Cents, Millis } from "@repo/kernel";

/**
 * Generic quoting vocabulary. Sector terminology (what a vertical calls a
 * line, how quantities are measured) is supplied by vertical packs as config
 * and helpers — never encoded here.
 */
export interface QuoteLineInput {
  description: string;
  /** Unit label is opaque tenant/vertical data (e.g. from config). */
  unit?: string;
  qtyMillis: Millis;
  unitCents: Cents;
  /**
   * Opaque hint interpreted by the bound tax adapter (e.g. a vertical's
   * namespaced work category). The capability never looks inside.
   */
  taxCategoryHint?: string;
  /** Optional works are shown/totalled separately from the base scope. */
  optional?: boolean;
  /** Structured extension data owned by vertical packs (e.g. measurements). */
  meta?: Record<string, unknown>;
}

export interface QuoteLine extends QuoteLineInput {
  id: string;
  totalCents: Cents;
}

export type QuoteStatus = "draft" | "accepted";

export interface Quote {
  id: string;
  tenantId: string;
  title: string;
  currency: string;
  status: QuoteStatus;
  createdAt: string;
  acceptedAt?: string;
  lines: QuoteLine[];
  /** Total of non-optional lines. */
  baseCents: Cents;
  /** Total of optional lines (kept apart from the base — never mixed in). */
  optionalCents: Cents;
  /** 1-based; revisions increment and link back via revisionOf. */
  version: number;
  revisionOf?: string;
  /** Option line ids the customer accepted (set at acceptance). */
  acceptedOptionIds?: string[];
}

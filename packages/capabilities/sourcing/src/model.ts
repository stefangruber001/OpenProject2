import type { Cents, Millis } from "@repo/kernel";

/**
 * Multi-bidder price comparison over quantified lines. The vocabulary is
 * generic ("lines", "groups", "bidders"); trade wording (what a vertical
 * calls its groups and items) is tenant/vertical data.
 *
 * Design constraints carried from real-world evidence (a 245-row supplier
 * comparison workbook): a missing price is NEVER a zero; optional lines stay
 * out of base totals; the chosen cost source is explicit, not positional.
 */
export interface ComparisonLine {
  id: string;
  code?: string;
  /** Grouping key (e.g. a construction chapter) — opaque here. */
  group?: string;
  description: string;
  unit?: string;
  qtyMillis: Millis;
  optional?: boolean;
}

export interface Bidder {
  id: string;
  name: string;
  note?: string;
}

/** Every stored price knows where it came from and since when (dated data). */
export interface PriceEntry {
  unitCents: Cents;
  /** e.g. "portal", "invoice 2026-123", "price list Q3", "phone quote" */
  source?: string;
  effectiveDate?: string;
}

export type ComparisonStatus = "open" | "selected";

export interface Comparison {
  id: string;
  tenantId: string;
  title: string;
  status: ComparisonStatus;
  createdAt: string;
  /** Variance is computed against this bidder (e.g. the initial study). */
  baselineBidderId?: string;
  lines: ComparisonLine[];
  bidders: Bidder[];
  /** prices[lineId][bidderId] — absence means "no price", never zero. */
  prices: Record<string, Record<string, PriceEntry>>;
  /** Explicit chosen source per line (SUP-10: never inferred). */
  selection: Record<string, string>;
}

// ---- report shapes ---------------------------------------------------------

export interface CellReport {
  bidderId: string;
  missing: boolean;
  unitCents?: Cents;
  totalCents?: Cents;
  /** vs baseline bidder on the same line; absent when either side missing. */
  varianceCents?: Cents;
  variancePctBp?: number;
}

export interface LineReport {
  line: ComparisonLine;
  cells: CellReport[];
  selectedBidderId?: string;
}

export interface BidderTotal {
  bidderId: string;
  /** Non-optional lines only. */
  baseTotalCents: Cents;
  optionalTotalCents: Cents;
  missingCount: number;
  varianceCents?: Cents;
  variancePctBp?: number;
}

export interface GroupReport {
  group: string;
  totals: BidderTotal[];
}

export interface ComparisonReport {
  comparisonId: string;
  baselineBidderId?: string;
  lines: LineReport[];
  groups: GroupReport[];
  totals: BidderTotal[];
  /** Total of the explicitly selected prices (base lines with a selection). */
  selectedBaseTotalCents: Cents;
  selectedMissingCount: number;
}

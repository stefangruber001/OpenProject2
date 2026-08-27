import type { Cents } from "@repo/kernel";

/**
 * Reconciliation is generic: a line off a bank statement, a pile of documents
 * that might explain it, and an opinion about which explains which.
 *
 * The capability knows nothing about invoices, bills, receipts, projects,
 * countries or trades. It sees an amount, a date and some text, on both sides.
 * That is deliberately all it needs, and it is why the same matcher works for
 * a customer invoice, a supplier bill and a hand-written receipt without ever
 * being told which is which — the caller labels them, and gets its own labels
 * back.
 */

/** One line off a statement. `sign` is carried in the amount, as the bank writes it. */
export interface BankMovement {
  id: string;
  /** Negative for money out, positive for money in — the bank's own convention. */
  amountCents: Cents;
  /** The date the bank booked it. */
  date: string;
  /** Everything the statement says, concatenated: concept, counterparty, reference. */
  text: string;
  /** Opaque account key, used only to tell one side of a transfer from the other. */
  accountRef?: string;
}

/** A document that might explain a movement. `kind` is the caller's own label. */
export interface CandidateDoc {
  id: string;
  kind: string;
  /** Always POSITIVE: how much the document is for. Direction lives in `direction`. */
  amountCents: Cents;
  /** Money the document expects to come IN, or to go OUT. */
  direction: "in" | "out";
  /** Its own date — issue, due, whichever the caller considers canonical. */
  date: string;
  /** Number, code, or any string a statement might quote back. */
  reference?: string;
  /** Who it is with. Matched loosely against the movement's text. */
  counterparty?: string;
  /** How much of it is still open. Defaults to the full amount. */
  outstandingCents?: Cents;
}

export type MatchReason =
  | "exactAmount"
  | "amountWithinTolerance"
  | "sameDate"
  | "dateWithinTolerance"
  | "referenceQuoted"
  | "counterpartyNamed"
  | "directionAgrees";

export interface MatchSuggestion {
  movementId: string;
  docIds: string[];
  /** 0-1. Above `autoAcceptScore` the caller may offer one-click acceptance. */
  confidence: number;
  /** Every reason that contributed, so a person can see WHY it was proposed. */
  reasons: MatchReason[];
  /** Movement amount − documents' total, in cents. Zero on an exact match. */
  differenceCents: Cents;
  /** True when more than one document is needed to explain the movement. */
  combination: boolean;
  /**
   * May a caller offer this as one click?
   *
   * NOT simply `confidence >= autoAcceptScore`. A proposal whose counterparty
   * the bank line never names is never auto-acceptable, however exact the
   * amount — see the note on `counterpartyNamed` in match.ts. The score alone
   * cannot carry that rule, because the whole point is that a very high score
   * can be reached without it.
   */
  autoAcceptable: boolean;
}

/** Two movements that are the same money moving between the caller's own accounts. */
export interface InternalTransfer {
  outMovementId: string;
  inMovementId: string;
  amountCents: Cents;
  daysApart: number;
  /** Every reason that put this pair together, so a person can see WHY. */
  reasons: TransferReason[];
  /**
   * How many other incoming movements fitted the outgoing one equally well.
   *
   * Zero is the ordinary case and the only one safe to accept in bulk. Above
   * zero the pair is a GUESS between look-alikes: a quarter of real card
   * traffic repeats the same amounts, and "nearest by date" is not evidence
   * when three candidates sit within the same tolerance window.
   */
  alternatives: number;
  /** `alternatives > 0`. Named, because a caller reading a boolean is clearer. */
  ambiguous: boolean;
}

/** Why two movements were paired. Same vocabulary shape as MatchReason. */
export type TransferReason =
  | "oppositeAmount"
  | "amountWithinTolerance"
  | "differentAccounts"
  | "sameDate"
  | "dateWithinTolerance";

/**
 * The tunables, as plain data.
 *
 * Deliberately NOT a zod schema in this module. The zod version lives in
 * config.ts, which the factory imports to validate a tenant file; this one is
 * what the matcher and the browser bundle use. Sessions 9 and 10a both learned
 * the same lesson the same way — importing a config schema into the browser
 * surface dragged a whole validation library into a bundle that ships to a
 * phone (52 KB to 190 KB, that time) to check five numbers.
 */
export interface ReconciliationConfig {
  /**
   * Days either side of the movement a document may sit and still match.
   * Generous by default: a transfer ordered on Friday lands on Tuesday, and
   * a matcher that insists on the same day proposes nothing all week.
   */
  dateToleranceDays: number;
  /**
   * Cents of difference still treated as the same amount — bank charges,
   * rounding on a card payment in another currency.
   */
  amountToleranceCents: number;
  /**
   * At or above this confidence the caller may offer one-click acceptance.
   * Below it the suggestion is still shown, but as something to read first.
   */
  autoAcceptScore: number;
  /** How many documents a single movement may be explained by. */
  maxCombinationSize: number;
  /** How many suggestions to return per movement. */
  maxSuggestions: number;
}

export const RECONCILIATION_DEFAULTS: ReconciliationConfig = {
  dateToleranceDays: 7,
  amountToleranceCents: 50,
  autoAcceptScore: 0.8,
  maxCombinationSize: 3,
  maxSuggestions: 5,
};

/** Fills in whatever the caller left out. Repairs rather than rejects. */
export function resolveReconciliationConfig(
  partial?: Partial<ReconciliationConfig> | null,
): ReconciliationConfig {
  const num = (v: unknown, fallback: number, lo: number, hi: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  };
  const d = RECONCILIATION_DEFAULTS;
  return {
    dateToleranceDays: num(partial?.dateToleranceDays, d.dateToleranceDays, 0, 180),
    amountToleranceCents: num(partial?.amountToleranceCents, d.amountToleranceCents, 0, 100_000),
    autoAcceptScore: num(partial?.autoAcceptScore, d.autoAcceptScore, 0, 1),
    maxCombinationSize: num(partial?.maxCombinationSize, d.maxCombinationSize, 1, 6),
    maxSuggestions: num(partial?.maxSuggestions, d.maxSuggestions, 1, 50),
  };
}

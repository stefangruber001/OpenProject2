import { z } from "zod";
import type { Cents } from "@repo/kernel";

/**
 * The fields a received document is scanned for.
 *
 * Generic on purpose: an issuer, its tax id, a document number, dates, the
 * amounts, a payment reference. Which words announce them, how the numbers and
 * dates are written and what a valid tax id looks like are all locale
 * knowledge, and arrive through the profile port — never from here.
 */
export type FieldKey =
  | "issuerName"
  | "issuerTaxId"
  | "docNumber"
  | "issueDate"
  | "dueDate"
  | "netAmount"
  | "taxAmount"
  | "withholdingAmount"
  | "totalAmount"
  | "iban"
  | "orderRef";

export const FIELD_KEYS: FieldKey[] = [
  "issuerName",
  "issuerTaxId",
  "docNumber",
  "issueDate",
  "dueDate",
  "netAmount",
  "taxAmount",
  "withholdingAmount",
  "totalAmount",
  "iban",
  "orderRef",
];

/** Fields whose value is money, in cents. The rest are strings. */
export const AMOUNT_FIELDS: FieldKey[] = [
  "netAmount",
  "taxAmount",
  "withholdingAmount",
  "totalAmount",
];

/**
 * Where a value came from. This is what lets a validation screen highlight
 * the part of the page a number was read off — the spec's "al pulsar un campo
 * se destaca la zona de la imagen de la que se obtuvo" — and what makes a
 * wrong extraction explainable rather than mysterious.
 */
export interface SourceSpan {
  /** Index into `ExtractionResult.lines`. */
  line: number;
  /** The line's text, as the extractor saw it after normalisation. */
  text: string;
  /** Character offsets of the matched value within that line. */
  start: number;
  end: number;
  /** Page the line came from, when the caller supplied page boundaries. */
  page?: number;
}

export interface Candidate {
  /** Parsed value: cents for amount fields, ISO date for dates, else text. */
  value: string | number | null;
  /** Exactly what stood on the page. */
  raw: string;
  confidence: number;
  source: SourceSpan;
  /** Why it scored what it scored — kept for the user, not for debugging. */
  reasons: string[];
  /** Whether a word on the page announced this value as this field. */
  labelled: boolean;
  /**
   * Whether something CHECKED this value, as opposed to something liking the
   * look of it. A check digit that computes, an account number whose mod-97
   * comes out, a date that is a real day in a real month. Confidence is a
   * heuristic and can be high about a wrong answer; this cannot.
   */
  validated: boolean;
}

/**
 * Green or amber, per the specification's dots.
 *
 * The rule is the whole point and it is deliberately strict: **a field goes
 * green only when a validator vouched for its value.** Never on confidence,
 * however high. The OCR spike (`docs/CANEI-V4-OCR-SPIKE.md` §3) is why — a
 * scanned NIF came back as `A08912907` for `A08932907`, which is not a blank a
 * person would notice but a plausible lie that flows into duplicate detection,
 * the archive and a filing. The check digit catches it; a confidence score
 * never would, because the reader was perfectly confident.
 *
 * A consequence worth stating: fields with no validator available — an issuer
 * name, a document number, an order reference — are **always amber**. That
 * matches the spike's finding that the document number was never once read
 * correctly off a raster. Amber is not a failure here; it is where the cursor
 * goes.
 */
export type FieldVerdict = "green" | "amber";

export interface ExtractedField {
  key: FieldKey;
  value: string | number | null;
  raw: string | null;
  confidence: number;
  source: SourceSpan | null;
  /** Runners-up, best first. A validation screen offers these as one tap. */
  alternatives: Candidate[];
  reasons: string[];
  /** A validator vouched for this value. See `Candidate.validated`. */
  validated: boolean;
  /** What colour the dot is. See `FieldVerdict`. */
  verdict: FieldVerdict;
}

/** One rate's worth of a document that mixes several (spec §5.2). */
export interface TaxBreakdownRow {
  rateBp: number;
  baseCents: Cents | null;
  taxCents: Cents | null;
  source: SourceSpan;
}

export type ConsistencyStatus = "ok" | "mismatch" | "unknown";

export interface ConsistencyCheck {
  id: "totals" | "taxRate" | "breakdown";
  status: ConsistencyStatus;
  detail: string;
  /** Fields the check implicates, so review can point at them. */
  fields: FieldKey[];
}

export interface ExtractionResult {
  /** The normalised text the extractor actually worked on. */
  lines: string[];
  fields: ExtractedField[];
  taxBreakdown: TaxBreakdownRow[];
  checks: ConsistencyCheck[];
  /** Fields a human must look at: missing, low-confidence, or contradicted. */
  needsReview: FieldKey[];
  profile: { id: string; version: string };
  /**
   * Always false. Extraction proposes; only a person disposes (CAP-04). The
   * field exists so that a caller persisting this object cannot accidentally
   * store something that looks confirmed.
   */
  confirmed: false;
}

export const extractionConfigSchema = z
  .object({
    /** Below this, a field is sent for review. */
    reviewThreshold: z.number().min(0).max(1).default(0.75),
    /** Cents of slack allowed when checking net + tax − withholding = total. */
    totalsToleranceCents: z.number().int().min(0).default(2),
    /** Alternatives kept per field. */
    maxAlternatives: z.number().int().min(0).max(10).default(3),
  })
  .default({});

export type ExtractionConfig = z.infer<typeof extractionConfigSchema>;

import { z } from "zod";
import type { BasisPoints, Cents, Millis } from "@repo/kernel";
import type { InvoiceSeal, TaxLineDecision } from "./ports";

export const partySchema = z.object({
  name: z.string().min(1),
  taxId: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  countryCode: z.string().length(2).optional(),
});
export type Party = z.infer<typeof partySchema>;

export const seriesDefSchema = z.object({
  id: z.string().regex(/^[A-Z][A-Z0-9]*$/),
  kind: z.enum(["standard", "rectificative"]),
  pad: z.number().int().min(1).max(10).default(4),
  yearly: z.boolean().default(true),
});
export type SeriesDef = z.infer<typeof seriesDefSchema>;

/** Billing capability config fragment — mounted at `config.billing`. */
export const billingConfigSchema = z.object({
  seller: partySchema,
  series: z.array(seriesDefSchema).nonempty(),
});
export type BillingConfig = z.infer<typeof billingConfigSchema>;

export interface InvoiceLine {
  id: string;
  description: string;
  unit?: string;
  qtyMillis: Millis;
  unitCents: Cents;
  totalCents: Cents;
  taxCategoryHint?: string;
}

export interface TaxSummaryRow {
  taxCode: string;
  rateBp: BasisPoints;
  baseCents: Cents;
  taxCents: Cents;
}

export type InvoiceKind = "standard" | "rectificative";

export interface Invoice {
  id: string;
  tenantId: string;
  kind: InvoiceKind;
  /** Present on rectificative invoices: the invoice being corrected. */
  rectifies?: string;
  rectificationReason?: string;
  series: string;
  number: number;
  displayNumber: string;
  issueDate: string;
  currency: string;
  seller: Party;
  buyer: Party;
  lines: InvoiceLine[];
  /** Per-line decisions incl. persisted justifications (mandate §6.3). */
  taxDecisions: TaxLineDecision[];
  taxSummary: TaxSummaryRow[];
  baseCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  seal?: InvoiceSeal;
}

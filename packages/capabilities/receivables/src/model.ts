import { z } from "zod";
import type { Cents } from "@repo/kernel";

/**
 * Accounts receivable is generic: a lightweight projection of a customer
 * invoice (the billing capability owns the immutable original) plus receipts
 * allocated against those invoices. Money is integer cents.
 */

/** A customer invoice tracked for collection. `ref` links to the billing doc. */
export interface ArInvoice {
  id: string;
  ref: string;
  customerRef: string;
  totalCents: Cents;
  issueDate: string;
  dueDate: string;
}

/** How much of a receipt was applied to one invoice. */
export interface Allocation {
  invoiceId: string;
  amountCents: Cents;
}

/** A customer payment, allocated (fully or partially) across invoices. */
export interface Receipt {
  id: string;
  date: string;
  amountCents: Cents;
  method?: string;
  allocations: Allocation[];
}

export interface Ledger {
  invoices: ArInvoice[];
  receipts: Receipt[];
}

export const receivablesConfigSchema = z
  .object({
    /** Ordered aging buckets in days; the last bucket catches everything older. */
    agingDays: z.array(z.number().int().positive()).default([30, 60, 90]),
  })
  .default({});
export type ReceivablesConfig = z.infer<typeof receivablesConfigSchema>;

export interface InvoiceStatus {
  invoice: ArInvoice;
  paidCents: Cents;
  outstandingCents: Cents;
  overdueDays: number;
  status: "open" | "partial" | "paid";
}

export interface AgingBucket {
  label: string;
  outstandingCents: Cents;
  count: number;
}

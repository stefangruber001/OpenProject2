import { z } from "zod";
import type { Cents } from "@repo/kernel";

/**
 * Accounts payable is generic: supplier bills (with the supplier's own
 * document number, used for duplicate detection) and payments against them.
 * Money is integer cents.
 */
export interface SupplierBill {
  id: string;
  supplierRef: string;
  /** The supplier's invoice number — (supplierRef, number) must be unique. */
  number: string;
  totalCents: Cents;
  issueDate: string;
  dueDate: string;
  projectRef?: string;
}

export interface Payment {
  id: string;
  date: string;
  billId: string;
  amountCents: Cents;
  method?: string;
}

export interface Ledger {
  bills: SupplierBill[];
  payments: Payment[];
}

export const payablesConfigSchema = z.object({}).default({});
export type PayablesConfig = z.infer<typeof payablesConfigSchema>;

export interface BillStatus {
  bill: SupplierBill;
  paidCents: Cents;
  outstandingCents: Cents;
  overdueDays: number;
  status: "open" | "partial" | "paid";
}

import { z } from "zod";
import type { Cents } from "@repo/kernel";

/**
 * Procurement is generic: purchase orders raised to suppliers, each carrying
 * lines tagged by an opaque chapter key and (optionally) a project. A PO that
 * has been sent or received commits cost against the project's budget.
 */
export type PoStatus = "draft" | "sent" | "received" | "cancelled";

export interface PoLine {
  chapter: string;
  description: string;
  amountCents: Cents;
}

export interface PurchaseOrder {
  id: string;
  supplierRef: string;
  projectRef?: string;
  status: PoStatus;
  lines: PoLine[];
  totalCents: Cents;
  createdAt: string;
}

export interface Book {
  orders: PurchaseOrder[];
}

export const procurementConfigSchema = z.object({}).default({});
export type ProcurementConfig = z.infer<typeof procurementConfigSchema>;

/** Committed cost for one chapter (from sent/received POs) vs its budget. */
export interface ChapterCommitment {
  chapter: string;
  committedCents: Cents;
  budgetCents: Cents;
  overBudget: boolean;
}

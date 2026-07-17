import { z } from "zod";
import type { BasisPoints, Cents } from "@repo/kernel";

/**
 * A supplier register is generic: suppliers plus effective-dated purchase
 * prices per item (with a source and an optional discount). Prices are
 * integer cents; a price is resolved for a date (latest effective ≤ date).
 */
export interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
}

export interface PriceEntry {
  id: string;
  supplierId: string;
  itemCode: string;
  unitPriceCents: Cents;
  /** ISO date this price takes effect. */
  effectiveDate: string;
  /** Where the price came from (quote, catalogue import, phone…). */
  source: string;
  discountBp?: BasisPoints;
}

export interface Register {
  suppliers: Supplier[];
  prices: PriceEntry[];
}

export const suppliersConfigSchema = z.object({}).default({});
export type SuppliersConfig = z.infer<typeof suppliersConfigSchema>;

/** A resolved price at a date: gross, discount, and net (what you'd pay). */
export interface ResolvedPrice {
  supplierId: string;
  itemCode: string;
  effectiveDate: string;
  source: string;
  grossCents: Cents;
  discountBp: BasisPoints;
  netCents: Cents;
}

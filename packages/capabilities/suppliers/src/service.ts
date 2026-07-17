import { FactoryError, roundDivHalfUp, type ClockPort, type IdGenPort } from "@repo/kernel";
import type { PriceEntry, Register, ResolvedPrice, Supplier, SuppliersConfig } from "./model";

export interface SuppliersDeps {
  clock: ClockPort;
  idGen: IdGenPort;
  config: SuppliersConfig;
}

/**
 * Supplier register. Add suppliers, record dated prices (with source +
 * discount), and resolve the effective net price for an item at a date —
 * the persistent price history the comparison engine reads. Pure over a
 * Register value.
 */
export class SuppliersService {
  constructor(private readonly deps: SuppliersDeps) {}

  empty(): Register {
    return { suppliers: [], prices: [] };
  }

  addSupplier(
    register: Register,
    input: { name: string; taxId?: string; email?: string; phone?: string },
  ): Register {
    const supplier: Supplier = { id: this.deps.idGen.next("sup"), ...input };
    return { ...register, suppliers: [...register.suppliers, supplier] };
  }

  recordPrice(
    register: Register,
    input: {
      supplierId: string;
      itemCode: string;
      unitPriceCents: number;
      source: string;
      effectiveDate?: string;
      discountBp?: number;
    },
  ): Register {
    if (!register.suppliers.some((s) => s.id === input.supplierId)) {
      throw new FactoryError("NOT_FOUND", `Supplier ${input.supplierId} not found.`);
    }
    if (input.unitPriceCents < 0)
      throw new FactoryError("INVALID_STATE", "Price cannot be negative.");
    const entry: PriceEntry = {
      id: this.deps.idGen.next("price"),
      supplierId: input.supplierId,
      itemCode: input.itemCode,
      unitPriceCents: input.unitPriceCents,
      effectiveDate: input.effectiveDate ?? this.deps.clock.todayIso(),
      source: input.source,
      discountBp: input.discountBp,
    };
    return { ...register, prices: [...register.prices, entry] };
  }

  private net(entry: PriceEntry): number {
    const discount = roundDivHalfUp(entry.unitPriceCents * (entry.discountBp ?? 0), 10_000);
    return entry.unitPriceCents - discount;
  }

  /** Resolve a supplier's price for an item at a date: latest effective ≤ date. */
  priceAt(
    register: Register,
    supplierId: string,
    itemCode: string,
    asOf?: string,
  ): ResolvedPrice | undefined {
    const date = asOf ?? this.deps.clock.todayIso();
    const candidates = register.prices
      .filter(
        (p) => p.supplierId === supplierId && p.itemCode === itemCode && p.effectiveDate <= date,
      )
      .sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1));
    const entry = candidates[0];
    if (!entry) return undefined;
    return {
      supplierId,
      itemCode,
      effectiveDate: entry.effectiveDate,
      source: entry.source,
      grossCents: entry.unitPriceCents,
      discountBp: entry.discountBp ?? 0,
      netCents: this.net(entry),
    };
  }

  /** Every supplier's resolved net price for an item at a date, cheapest first. */
  pricesForItem(register: Register, itemCode: string, asOf?: string): ResolvedPrice[] {
    return register.suppliers
      .map((s) => this.priceAt(register, s.id, itemCode, asOf))
      .filter((p): p is ResolvedPrice => p !== undefined)
      .sort((a, b) => a.netCents - b.netCents);
  }

  /** Cheapest supplier for an item at a date (missing price ≠ zero → undefined). */
  bestPrice(register: Register, itemCode: string, asOf?: string): ResolvedPrice | undefined {
    return this.pricesForItem(register, itemCode, asOf)[0];
  }
}

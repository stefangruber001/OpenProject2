import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import { suppliersConfigSchema } from "./model";
import { SuppliersService } from "./service";

function svc(date = "2026-07-17") {
  return new SuppliersService({
    clock: new FixedClock(date),
    idGen: new SeqIdGen(),
    config: suppliersConfigSchema.parse({}),
  });
}

describe("SuppliersService", () => {
  it("resolves the effective price at a date (latest ≤ date) with discount", () => {
    const s = svc();
    let r = s.empty();
    r = s.addSupplier(r, { name: "Tiles SL" });
    const sup = r.suppliers[0]!.id;
    r = s.recordPrice(r, {
      supplierId: sup,
      itemCode: "TILE",
      unitPriceCents: 3500,
      source: "catalogue",
      effectiveDate: "2026-01-01",
    });
    r = s.recordPrice(r, {
      supplierId: sup,
      itemCode: "TILE",
      unitPriceCents: 3200,
      source: "quote",
      effectiveDate: "2026-06-01",
      discountBp: 1000,
    });

    const now = s.priceAt(r, sup, "TILE", "2026-07-01")!;
    expect(now.grossCents).toBe(3200);
    expect(now.netCents).toBe(2880); // 3200 − 10%

    const earlier = s.priceAt(r, sup, "TILE", "2026-03-01")!;
    expect(earlier.grossCents).toBe(3500); // older price still effective then
  });

  it("returns undefined when no price is effective yet (missing ≠ zero)", () => {
    const s = svc();
    let r = s.addSupplier(s.empty(), { name: "X" });
    const sup = r.suppliers[0]!.id;
    r = s.recordPrice(r, {
      supplierId: sup,
      itemCode: "A",
      unitPriceCents: 100,
      source: "q",
      effectiveDate: "2026-08-01",
    });
    expect(s.priceAt(r, sup, "A", "2026-07-01")).toBeUndefined();
  });

  it("ranks suppliers cheapest-first for an item", () => {
    const s = svc();
    let r = s.empty();
    r = s.addSupplier(r, { name: "A" });
    r = s.addSupplier(r, { name: "B" });
    const [a, b] = r.suppliers;
    r = s.recordPrice(r, { supplierId: a!.id, itemCode: "K", unitPriceCents: 1000, source: "q" });
    r = s.recordPrice(r, { supplierId: b!.id, itemCode: "K", unitPriceCents: 900, source: "q" });
    expect(s.bestPrice(r, "K")!.supplierId).toBe(b!.id);
    expect(s.pricesForItem(r, "K")).toHaveLength(2);
  });

  it("rejects a price for an unknown supplier", () => {
    const s = svc();
    try {
      s.recordPrice(s.empty(), {
        supplierId: "ghost",
        itemCode: "A",
        unitPriceCents: 1,
        source: "q",
      });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "NOT_FOUND")).toBe(true);
    }
  });
});

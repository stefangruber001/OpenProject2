import { describe, expect, it } from "vitest";
import { isFactoryError } from "@repo/kernel";
import { catalogueConfigSchema } from "./model";
import { CatalogueService } from "./service";

function svc(cfg: unknown = {}) {
  return new CatalogueService(catalogueConfigSchema.parse(cfg));
}

const seedCfg = {
  items: [
    {
      code: "TILE-2060",
      name: "Ceramic tiling 20×60",
      chapter: "Coverings & finishes",
      unit: "m²",
      kind: "material",
      unitPriceCents: 3200,
      unitCostCents: 2000,
    },
    {
      code: "PLUMB-BATH",
      name: "Bathroom plumbing",
      chapter: "Plumbing",
      unit: "ud",
      unitPriceCents: 185000,
      unitCostCents: 140000,
    },
  ],
  templates: [
    {
      name: "Standard bathroom",
      lines: [
        { itemCode: "TILE-2060", qtyMillis: 12_500 },
        { itemCode: "PLUMB-BATH", qtyMillis: 1000 },
      ],
    },
  ],
};

describe("CatalogueService", () => {
  it("seeds items from config and looks them up", () => {
    const s = svc(seedCfg);
    const cat = s.seed();
    expect(cat.items).toHaveLength(2);
    expect(s.byCode(cat, "TILE-2060")!.unitPriceCents).toBe(3200);
    expect(s.byChapter(cat, "Plumbing")).toHaveLength(1);
  });

  it("computes unit margin in basis points", () => {
    const s = svc(seedCfg);
    const item = s.byCode(s.seed(), "TILE-2060")!;
    expect(s.marginBp(item)).toBe(3750); // (3200−2000)/3200 = 37.5%
  });

  it("rejects a duplicate item code", () => {
    const s = svc(seedCfg);
    try {
      s.addItem(s.seed(), {
        code: "TILE-2060",
        name: "dup",
        chapter: "x",
        unit: "m²",
        kind: "material",
        unitPriceCents: 1,
      });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });

  it("expands a room template into costed lines", () => {
    const s = svc(seedCfg);
    const lines = s.expandTemplate(s.seed(), "Standard bathroom");
    expect(lines).toHaveLength(2);
    expect(lines[0]!.lineCents).toBe(40_000); // 12.5 × 3200
    expect(lines[1]!.lineCents).toBe(185_000);
  });
});

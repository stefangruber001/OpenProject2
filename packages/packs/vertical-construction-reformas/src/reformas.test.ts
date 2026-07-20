import { describe, expect, it } from "vitest";
import { dwellingWorksAttributes } from "./attributes";
import { medicionQtyMillis, totalQtyMillis } from "./mediciones";
import { reformasConfigSchema } from "./manifest";

describe("mediciones", () => {
  it("multiplies dimensional factors into millis", () => {
    expect(medicionQtyMillis({ unidades: 5, largo: 2.5, ancho: 1.98 })).toBe(24_750);
    expect(medicionQtyMillis({ unidades: 12.5 })).toBe(12_500);
    expect(
      totalQtyMillis([
        { unidades: 1, largo: 2, ancho: 2 },
        { unidades: 1, largo: 3 },
      ]),
    ).toBe(7000);
  });
});

describe("dwelling works attributes (contract with jurisdiction adapters)", () => {
  it("emits the namespaced keys the es-ES adapter interprets", () => {
    const attrs = dwellingWorksAttributes({
      recipient: "individual-private",
      dwellingPrivateUse: true,
      dwellingCompletedYearsAgo: 15,
      materialsShareBp: 3500,
    });
    expect(attrs).toEqual({
      "construction.recipient": "individual-private",
      "construction.dwellingPrivateUse": true,
      "construction.dwellingCompletedYearsAgo": 15,
      "construction.materialsShareBp": 3500,
    });
  });
});

describe("config fragment", () => {
  it("applies Spanish-agnostic defaults (terminology is data)", () => {
    const cfg = reformasConfigSchema.parse({});
    expect(cfg.terminology.quote).toBe("Presupuesto");
    expect(cfg.terminology.line).toBe("Partida");
    expect(cfg.materialsShareDefaultBp).toBe(3500);
  });

  it("ships the standard chapter catalogue seeded from real intake evidence", () => {
    const cfg = reformasConfigSchema.parse({});
    expect(cfg.chapters).toHaveLength(17);
    expect(cfg.chapters).toContain("Demoliciones y trabajos previos");
    // tenants can override with their own chapter set — it's data
    const custom = reformasConfigSchema.parse({ chapters: ["Solo un capítulo"] });
    expect(custom.chapters).toEqual(["Solo un capítulo"]);
  });
});

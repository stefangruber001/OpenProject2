import { describe, expect, it } from "vitest";
import { DAILY_OUTPUT_BY_CHAPTER, DAILY_OUTPUT_BY_UNIT, dailyOutputFor } from "./rates";
import { reformasPack, reformasConfigSchema } from "./manifest";

describe("daily output", () => {
  it("falls back to the unit when the chapter says nothing", () => {
    expect(dailyOutputFor({ unit: "m2" })).toBe(DAILY_OUTPUT_BY_UNIT.m2);
    expect(dailyOutputFor({ unit: "m2", chapter: "Varios y generales" })).toBe(
      DAILY_OUTPUT_BY_UNIT.m2,
    );
  });

  it("lets the chapter win, because the unit alone does not decide the pace", () => {
    // A square metre of painting and a square metre of structure are both m².
    expect(dailyOutputFor({ unit: "m2", chapter: "Pintura" })).toBe(60);
    expect(dailyOutputFor({ unit: "m2", chapter: "Estructura" })).toBe(8);
  });

  it("lets a tenant override beat the pack, per unit and per chapter", () => {
    expect(dailyOutputFor({ unit: "m2", overridesByUnit: { m2: 99 } })).toBe(99);
    expect(
      dailyOutputFor({
        unit: "m2",
        chapter: "Pintura",
        overridesByChapter: { Pintura: { m2: 12 } },
      }),
    ).toBe(12);
    // A tenant's chapter figure outranks a tenant's unit figure, same as the
    // pack's own two tables.
    expect(
      dailyOutputFor({
        unit: "m2",
        chapter: "Pintura",
        overridesByUnit: { m2: 99 },
        overridesByChapter: { Pintura: { m2: 12 } },
      }),
    ).toBe(12);
  });

  it("returns null rather than a plausible-looking guess", () => {
    expect(dailyOutputFor({ unit: "furlong" })).toBeNull();
    expect(dailyOutputFor({})).toBeNull();
    expect(dailyOutputFor({ unit: "  " })).toBeNull();
  });

  it("accepts the unit written either way, since quotes do both", () => {
    expect(dailyOutputFor({ unit: "m²" })).toBe(dailyOutputFor({ unit: "m2" }));
    expect(dailyOutputFor({ unit: "m³" })).toBe(dailyOutputFor({ unit: "m3" }));
  });

  it("keys its chapter table on chapters the pack actually publishes", () => {
    // Two tables that name chapters differently drift apart silently, and the
    // symptom is a rate that stops applying for no visible reason.
    const published = new Set(reformasConfigSchema.parse({}).chapters);
    for (const chapter of Object.keys(DAILY_OUTPUT_BY_CHAPTER)) {
      expect(published.has(chapter), `${chapter} is not a published chapter`).toBe(true);
    }
    expect(reformasPack.shortId).toBe("construction/reformas");
  });

  it("states every rate as a positive number", () => {
    const all = [
      ...Object.values(DAILY_OUTPUT_BY_UNIT),
      ...Object.values(DAILY_OUTPUT_BY_CHAPTER).flatMap((t) => Object.values(t)),
    ];
    expect(all.every((r) => Number.isFinite(r) && r > 0)).toBe(true);
  });
});

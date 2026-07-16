import { describe, expect, it } from "vitest";
import { inWindow, resolveAt, type EffectivePeriod } from "./effective";
import { isFactoryError } from "./errors";

const periods: EffectivePeriod<number>[] = [
  { validFrom: "2010-07-01", validTo: "2012-08-31", value: 1 },
  { validFrom: "2012-09-01", value: 2 },
];

describe("effective dating", () => {
  it("resolves the period in force at a date", () => {
    expect(resolveAt(periods, "2012-08-31", "rate").value).toBe(1);
    expect(resolveAt(periods, "2012-09-01", "rate").value).toBe(2);
    expect(resolveAt(periods, "2026-07-16", "rate").value).toBe(2);
  });

  it("refuses to guess outside known windows", () => {
    try {
      resolveAt(periods, "2009-01-01", "rate");
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "NO_EFFECTIVE_RULE")).toBe(true);
    }
  });

  it("validates window membership", () => {
    expect(inWindow("2026-07-16", "2026-01-01")).toBe(true);
    expect(inWindow("2025-12-31", "2026-01-01")).toBe(false);
    expect(inWindow("2026-07-16", undefined, "2026-06-30")).toBe(false);
  });
});

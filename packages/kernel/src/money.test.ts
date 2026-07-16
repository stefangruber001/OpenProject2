import { describe, expect, it } from "vitest";
import {
  applyRateBp,
  formatMoney,
  lineTotalCents,
  roundDivHalfUp,
  sumCents,
  toMillis,
} from "./money";

describe("money", () => {
  it("computes line totals from millis × cents", () => {
    expect(lineTotalCents(12_500, 1840)).toBe(23_000); // 12.5 × 18.40
    expect(lineTotalCents(24_750, 3200)).toBe(79_200); // 24.75 × 32.00
    expect(lineTotalCents(1000, 185_000)).toBe(185_000); // 1 × 1850.00
  });

  it("rounds half-up, away from zero for negatives", () => {
    expect(roundDivHalfUp(5, 10)).toBe(1);
    expect(roundDivHalfUp(4, 10)).toBe(0);
    expect(roundDivHalfUp(-5, 10)).toBe(-1);
    expect(roundDivHalfUp(-4, 10)).toBe(0);
  });

  it("applies basis-point rates", () => {
    expect(applyRateBp(287_200, 1000)).toBe(28_720);
    expect(applyRateBp(500_000, 2100)).toBe(105_000);
    expect(applyRateBp(-500_000, 2100)).toBe(-105_000);
    expect(applyRateBp(333, 2100)).toBe(70); // 69.93 → 70
  });

  it("rejects non-integers", () => {
    expect(() => lineTotalCents(1.5, 100)).toThrowError(/MONEY_NOT_INTEGER/);
    expect(() => sumCents([1, 0.5])).toThrowError(/MONEY_NOT_INTEGER/);
  });

  it("formats using the tenant's locale and currency", () => {
    const formatted = formatMoney(12_345_678, "EUR", "es-ES");
    expect(formatted).toContain("123.456,78");
    expect(formatted).toContain("€");
    // es-ES does not group 4-digit integers (CLDR minimumGroupingDigits=2)
    expect(formatMoney(315_920, "EUR", "es-ES")).toContain("3159,20");
  });

  it("converts human decimals to millis", () => {
    expect(toMillis(24.75)).toBe(24_750);
    expect(toMillis(5 * 2.5 * 1.98)).toBe(24_750);
  });
});

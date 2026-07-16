import { FactoryError } from "./errors";

/**
 * Money never touches floating point:
 * - amounts are integer minor units ("cents"),
 * - quantities are integer thousandths ("millis"),
 * - rates are integer basis points (1 bp = 0.01 %).
 * Rounding is half-up, away from zero for negatives (single policy, one place).
 */
export type Cents = number;
export type Millis = number;
export type BasisPoints = number;

export function assertInt(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new FactoryError("MONEY_NOT_INTEGER", `${what} must be a safe integer, got ${value}`);
  }
}

/** Divide n/d rounding half away from zero. Both integers, d > 0. */
export function roundDivHalfUp(n: number, d: number): number {
  assertInt(n, "numerator");
  assertInt(d, "denominator");
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const q = Math.floor(abs / d);
  const r = abs - q * d;
  const result = sign * (r * 2 >= d ? q + 1 : q);
  return result === 0 ? 0 : result; // never -0
}

/** Line total: quantity (millis) × unit price (cents) → cents. */
export function lineTotalCents(qtyMillis: Millis, unitCents: Cents): Cents {
  assertInt(qtyMillis, "qtyMillis");
  assertInt(unitCents, "unitCents");
  return roundDivHalfUp(qtyMillis * unitCents, 1000);
}

/** Apply a basis-point rate to a base amount: cents × bp → cents. */
export function applyRateBp(baseCents: Cents, rateBp: BasisPoints): Cents {
  assertInt(baseCents, "baseCents");
  assertInt(rateBp, "rateBp");
  return roundDivHalfUp(baseCents * rateBp, 10_000);
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) {
    assertInt(v, "cents value");
    total += v;
  }
  assertInt(total, "sum");
  return total;
}

/** Locale/currency come from tenant config — never hardcoded. */
export function formatMoney(cents: Cents, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** Human decimal (e.g. "24.75") → millis. For config/import edges, not hot paths. */
export function toMillis(value: number): Millis {
  const m = Math.round(value * 1000);
  assertInt(m, "millis");
  return m;
}

import { FactoryError } from "./errors";

/**
 * Effective dating — time is a dimension of correctness (mandate §6.3).
 * Jurisdiction rules resolve as `resolveAt(periods, date)`, never a constant.
 * Dates are ISO `YYYY-MM-DD` strings; lexicographic order == chronological.
 */
export interface EffectivePeriod<T> {
  /** inclusive */
  validFrom: string;
  /** inclusive; open-ended when absent */
  validTo?: string;
  value: T;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(date: string, what = "date"): void {
  if (!ISO_DATE.test(date)) {
    throw new FactoryError("NO_EFFECTIVE_RULE", `${what} must be YYYY-MM-DD, got "${date}"`);
  }
}

/**
 * Resolve the value in force at `date`. Throws NO_EFFECTIVE_RULE if no period
 * covers it — guessing tax law is not a fallback.
 */
export function resolveAt<T>(
  periods: readonly EffectivePeriod<T>[],
  date: string,
  what: string,
): { value: T; period: EffectivePeriod<T> } {
  assertIsoDate(date, `${what} effective date`);
  for (const period of periods) {
    if (date >= period.validFrom && (period.validTo === undefined || date <= period.validTo)) {
      return { value: period.value, period };
    }
  }
  throw new FactoryError(
    "NO_EFFECTIVE_RULE",
    `No effective rule for "${what}" at ${date}. Known windows start ${
      periods[0]?.validFrom ?? "(none)"
    }. Refusing to guess.`,
    { what, date },
  );
}

/** True when `date` falls inside the optional window [from, to]. */
export function inWindow(date: string, from?: string, to?: string): boolean {
  assertIsoDate(date);
  if (from !== undefined && date < from) return false;
  if (to !== undefined && date > to) return false;
  return true;
}

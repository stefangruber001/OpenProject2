import type { EffectivePeriod } from "@repo/kernel";

/**
 * Spanish VAT (IVA) rate tables — effective-dated DATA, resolved per invoice
 * issue date. History encoded from the 2012-09-01 era onward (RD-ley 20/2012);
 * earlier eras can be appended as data if ever needed (ASSUMPTIONS.md #8).
 */
export const IVA_GENERAL_BP: EffectivePeriod<number>[] = [{ validFrom: "2012-09-01", value: 2100 }];

export const IVA_REDUCIDO_BP: EffectivePeriod<number>[] = [
  { validFrom: "2012-09-01", value: 1000 },
];

export const IVA_SUPERREDUCIDO_BP: EffectivePeriod<number>[] = [
  { validFrom: "2012-09-01", value: 400 },
];

/**
 * Materials threshold for the dwelling-renovation reduced rate
 * (art. 91.Uno.2.10º LIVA): contractor-supplied materials must not exceed
 * this share of the taxable base. 40 % since 2012-09-01 (33 % before).
 */
export const RENOVATION_MATERIALS_MAX_SHARE_BP: EffectivePeriod<number>[] = [
  { validFrom: "2012-09-01", value: 4000 },
];

/** Minimum age (years since construction/last rehab) for the reduced rate. */
export const RENOVATION_MIN_DWELLING_AGE_YEARS = 2;

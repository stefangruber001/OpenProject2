/**
 * Daily output: how much of a unit of work gets done in one working day.
 *
 * This is the table that turns a quantity into a duration, and it is sector
 * knowledge through and through — the scheduling capability knows how to
 * divide a quantity by a rate and nothing whatever about how fast anyone
 * tiles a wall. Put these numbers in the capability and the planner works for
 * exactly one trade in exactly one country; put them here and another vertical
 * pack supplies its own.
 *
 * The numbers are a STARTING POINT, not a measurement. They are the crew-day
 * figures a small renovation firm would recognise, deliberately conservative,
 * and every one of them is expected to be overridden per tenant once real
 * site data exists — which is why they are plain data with no logic attached.
 * A wrong rate produces a wrong duration and a visibly wrong bar, which is the
 * failure mode you want: obvious, and fixable without a deployment.
 *
 * Kept free of zod on purpose. The browser host bundles this module to derive
 * a plan from a quote, and a validation library has no business travelling
 * into a phone to look up a number in a table.
 */

/** Quantity of a unit completed by one crew in one working day. */
export type DailyOutputTable = Readonly<Record<string, number>>;

/**
 * By unit. Units are written the way the quote writes them — the same strings
 * the line items carry — so a lookup is a lookup and not a translation.
 */
export const DAILY_OUTPUT_BY_UNIT: DailyOutputTable = {
  m2: 20,
  "m²": 20,
  m3: 6,
  "m³": 6,
  m: 40,
  ml: 40,
  ud: 4,
  u: 4,
  pa: 1, // a lump sum has no quantity to speak of; it takes a day unless told otherwise
  PA: 1,
  h: 8,
  kg: 200,
  l: 200,
};

/**
 * Per-chapter overrides, because the unit alone does not decide the pace: a
 * square metre of demolition and a square metre of joinery are both m² and
 * are not remotely the same day's work. Keyed by the canonical chapter names
 * the pack already publishes, so the two tables cannot drift apart.
 */
export const DAILY_OUTPUT_BY_CHAPTER: Readonly<Record<string, DailyOutputTable>> = {
  "Demoliciones y trabajos previos": { m2: 30, "m²": 30, m3: 8, "m³": 8 },
  Estructura: { m2: 8, "m²": 8, m3: 3, "m³": 3 },
  "Albañilería y tabiquería": { m2: 12, "m²": 12 },
  "Revestimientos y acabados": { m2: 14, "m²": 14 },
  "Aparatos sanitarios": { ud: 3, u: 3 },
  "Carpintería interior": { ud: 3, u: 3 },
  "Carpintería exterior": { ud: 2, u: 2 },
  Cocina: { ud: 1, u: 1, ml: 3, m: 3 },
  Pintura: { m2: 60, "m²": 60 },
  "Instalación eléctrica": { ud: 8, u: 8, m2: 25, "m²": 25 },
  Climatización: { ud: 1, u: 1 },
  Ventilación: { ud: 2, u: 2, ml: 20, m: 20 },
  Fontanería: { ud: 3, u: 3, ml: 15, m: 15 },
  Saneamiento: { ud: 3, u: 3, ml: 15, m: 15 },
  Telecomunicaciones: { ud: 8, u: 8 },
  "Protección contra incendios": { ud: 6, u: 6 },
};

export interface RateLookup {
  /** The unit as the quote writes it. */
  unit?: string;
  /** The chapter the line sits in, if known. */
  chapter?: string;
  /** Tenant overrides, most specific of all. Same shape as the tables above. */
  overridesByUnit?: DailyOutputTable;
  overridesByChapter?: Readonly<Record<string, DailyOutputTable>>;
}

/**
 * The daily output for a line, most specific source first: a tenant override
 * for this chapter and unit, then the pack's own chapter table, then a tenant
 * override by unit, then the pack's unit table. Null when nothing applies —
 * the caller then has no rate rather than a plausible-looking wrong one, and
 * the derivation falls back to its stated default duration instead of
 * inventing a number.
 */
export function dailyOutputFor(lookup: RateLookup): number | null {
  const unit = (lookup.unit ?? "").trim();
  if (!unit) return null;
  const sources: (DailyOutputTable | undefined)[] = [
    lookup.chapter ? lookup.overridesByChapter?.[lookup.chapter] : undefined,
    lookup.chapter ? DAILY_OUTPUT_BY_CHAPTER[lookup.chapter] : undefined,
    lookup.overridesByUnit,
    DAILY_OUTPUT_BY_UNIT,
  ];
  for (const table of sources) {
    const rate = table?.[unit];
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) return rate;
  }
  return null;
}

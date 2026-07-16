import { FactoryError } from "@repo/kernel";
import type { SeriesDef } from "./model";

/**
 * Gapless, correlative numbering per series (and per year when the series
 * resets yearly). Gapless is guaranteed by construction: numbers are only
 * handed out here, sequentially, and issuance is append-only.
 */
export class SeriesCounters {
  private counters = new Map<string, number>();

  constructor(private readonly series: readonly SeriesDef[]) {}

  def(seriesId: string): SeriesDef {
    const def = this.series.find((s) => s.id === seriesId);
    if (!def) {
      throw new FactoryError(
        "NOT_FOUND",
        `Series "${seriesId}" is not configured. Known: [${this.series.map((s) => s.id).join(", ")}].`,
      );
    }
    return def;
  }

  next(seriesId: string, issueDate: string): { number: number; displayNumber: string } {
    const def = this.def(seriesId);
    const year = issueDate.slice(0, 4);
    const key = def.yearly ? `${def.id}:${year}` : def.id;
    const number = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, number);
    const padded = String(number).padStart(def.pad, "0");
    const displayNumber = def.yearly ? `${def.id}-${year}-${padded}` : `${def.id}-${padded}`;
    return { number, displayNumber };
  }
}

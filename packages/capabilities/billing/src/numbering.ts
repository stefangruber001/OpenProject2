import { FactoryError, type CounterStore } from "@repo/kernel";
import type { SeriesDef } from "./model";

/**
 * Gapless, correlative numbering per series (and per year when the series
 * resets yearly). Gapless is guaranteed by the CounterStore contract: numbers
 * are only handed out atomically, sequentially, and issuance is append-only.
 */
export class SeriesNumbering {
  constructor(
    private readonly series: readonly SeriesDef[],
    private readonly counters: CounterStore,
  ) {}

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

  async next(
    seriesId: string,
    issueDate: string,
  ): Promise<{ number: number; displayNumber: string }> {
    const def = this.def(seriesId);
    const year = issueDate.slice(0, 4);
    const key = def.yearly ? `${def.id}:${year}` : def.id;
    const number = await this.counters.next(key);
    const padded = String(number).padStart(def.pad, "0");
    const displayNumber = def.yearly ? `${def.id}-${year}-${padded}` : `${def.id}-${padded}`;
    return { number, displayNumber };
  }
}

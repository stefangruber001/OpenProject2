import {
  FactoryError,
  lineTotalCents,
  roundDivHalfUp,
  type ClockPort,
  type EventLogPort,
  type IdGenPort,
  type Repository,
} from "@repo/kernel";
import type {
  Bidder,
  BidderTotal,
  CellReport,
  Comparison,
  ComparisonLine,
  ComparisonReport,
  GroupReport,
  LineReport,
  PriceEntry,
} from "./model";

export interface SourcingDeps {
  tenantId: string;
  store: Repository<Comparison>;
  clock: ClockPort;
  idGen: IdGenPort;
  events: EventLogPort;
}

/**
 * Comparison lifecycle: build lines and bidders, record dated/sourced prices,
 * select the explicit cost source per line, and report totals + variances.
 * A missing price is reported as missing — never treated as zero.
 */
export class SourcingService {
  constructor(private readonly deps: SourcingDeps) {}

  async create(title: string, opts?: { baselineBidder?: Bidder }): Promise<Comparison> {
    const comparison: Comparison = {
      id: this.deps.idGen.next("cmp"),
      tenantId: this.deps.tenantId,
      title,
      status: "open",
      createdAt: this.deps.clock.nowIso(),
      baselineBidderId: undefined,
      lines: [],
      bidders: [],
      prices: {},
      selection: {},
    };
    if (opts?.baselineBidder) {
      comparison.bidders.push(opts.baselineBidder);
      comparison.baselineBidderId = opts.baselineBidder.id;
    }
    await this.deps.store.save(comparison);
    await this.deps.events.append({
      type: "sourcing.comparison.created",
      at: comparison.createdAt,
      tenantId: comparison.tenantId,
      payload: { comparisonId: comparison.id },
    });
    return comparison;
  }

  async addBidder(
    comparisonId: string,
    bidder: Omit<Bidder, "id"> & { id?: string },
  ): Promise<Bidder> {
    const comparison = await this.mustGet(comparisonId);
    const full: Bidder = { id: bidder.id ?? this.deps.idGen.next("bid"), ...bidder };
    if (comparison.bidders.some((b) => b.id === full.id)) {
      throw new FactoryError("INVALID_STATE", `Bidder ${full.id} already exists.`);
    }
    comparison.bidders.push(full);
    comparison.baselineBidderId ??= full.id;
    await this.deps.store.save(comparison);
    return full;
  }

  async addLine(
    comparisonId: string,
    line: Omit<ComparisonLine, "id"> & { id?: string },
  ): Promise<ComparisonLine> {
    const comparison = await this.mustGet(comparisonId);
    const full: ComparisonLine = { id: line.id ?? this.deps.idGen.next("cline"), ...line };
    comparison.lines.push(full);
    await this.deps.store.save(comparison);
    return full;
  }

  async setPrice(
    comparisonId: string,
    lineId: string,
    bidderId: string,
    price: PriceEntry,
  ): Promise<void> {
    const comparison = await this.mustGet(comparisonId);
    this.mustHave(comparison, lineId, bidderId);
    (comparison.prices[lineId] ??= {})[bidderId] = price;
    await this.deps.store.save(comparison);
  }

  /** SUP-10: the chosen cost source is explicit, never inferred. */
  async select(comparisonId: string, lineId: string, bidderId: string): Promise<void> {
    const comparison = await this.mustGet(comparisonId);
    this.mustHave(comparison, lineId, bidderId);
    if (comparison.prices[lineId]?.[bidderId] === undefined) {
      throw new FactoryError(
        "INVALID_STATE",
        `Cannot select bidder ${bidderId} for line ${lineId}: no price recorded.`,
      );
    }
    comparison.selection[lineId] = bidderId;
    comparison.status = "selected";
    await this.deps.store.save(comparison);
    await this.deps.events.append({
      type: "sourcing.price.selected",
      at: this.deps.clock.nowIso(),
      tenantId: comparison.tenantId,
      payload: { comparisonId, lineId, bidderId },
    });
  }

  async get(comparisonId: string): Promise<Readonly<Comparison>> {
    return this.mustGet(comparisonId);
  }

  async report(comparisonId: string): Promise<ComparisonReport> {
    const c = await this.mustGet(comparisonId);
    const baseline = c.baselineBidderId;

    const lineReports: LineReport[] = c.lines.map((line) => {
      const baseCell = baseline === undefined ? undefined : cellFor(c, line, baseline);
      const cells: CellReport[] = c.bidders.map((b) => {
        const cell = cellFor(c, line, b.id);
        if (
          baseline !== undefined &&
          b.id !== baseline &&
          !cell.missing &&
          baseCell !== undefined &&
          !baseCell.missing
        ) {
          cell.varianceCents = cell.totalCents! - baseCell.totalCents!;
          cell.variancePctBp =
            baseCell.totalCents === 0
              ? undefined
              : roundDivHalfUp(cell.varianceCents * 10_000, Math.abs(baseCell.totalCents!));
        }
        return cell;
      });
      return { line, cells, selectedBidderId: c.selection[line.id] };
    });

    const totals = bidderTotals(c, lineReports, baseline);
    const groups = groupReports(c, lineReports, baseline);

    let selectedBaseTotalCents = 0;
    let selectedMissingCount = 0;
    for (const lr of lineReports) {
      if (lr.line.optional) continue;
      const chosen = lr.selectedBidderId;
      if (!chosen) {
        selectedMissingCount += 1;
        continue;
      }
      const cell = lr.cells.find((x) => x.bidderId === chosen);
      if (!cell || cell.missing) selectedMissingCount += 1;
      else selectedBaseTotalCents += cell.totalCents!;
    }

    return {
      comparisonId: c.id,
      baselineBidderId: baseline,
      lines: lineReports,
      groups,
      totals,
      selectedBaseTotalCents,
      selectedMissingCount,
    };
  }

  private async mustGet(id: string): Promise<Comparison> {
    const c = await this.deps.store.get(id);
    if (!c) throw new FactoryError("NOT_FOUND", `Comparison ${id} not found.`);
    return c;
  }

  private mustHave(c: Comparison, lineId: string, bidderId: string): void {
    if (!c.lines.some((l) => l.id === lineId)) {
      throw new FactoryError("NOT_FOUND", `Line ${lineId} not in comparison ${c.id}.`);
    }
    if (!c.bidders.some((b) => b.id === bidderId)) {
      throw new FactoryError("NOT_FOUND", `Bidder ${bidderId} not in comparison ${c.id}.`);
    }
  }
}

function cellFor(c: Comparison, line: ComparisonLine, bidderId: string): CellReport {
  const price = c.prices[line.id]?.[bidderId];
  if (price === undefined) return { bidderId, missing: true };
  return {
    bidderId,
    missing: false,
    unitCents: price.unitCents,
    totalCents: lineTotalCents(line.qtyMillis, price.unitCents),
  };
}

function accumulate(
  rows: LineReport[],
  bidderId: string,
): { base: number; optional: number; missing: number } {
  let base = 0;
  let optional = 0;
  let missing = 0;
  for (const row of rows) {
    const cell = row.cells.find((x) => x.bidderId === bidderId);
    if (!cell || cell.missing) {
      missing += 1;
      continue;
    }
    if (row.line.optional) optional += cell.totalCents!;
    else base += cell.totalCents!;
  }
  return { base, optional, missing };
}

function withVariance(totals: BidderTotal[], baseline?: string): BidderTotal[] {
  const baseRow = baseline ? totals.find((t) => t.bidderId === baseline) : undefined;
  if (baseRow) {
    for (const t of totals) {
      if (t.bidderId === baseline) continue;
      t.varianceCents = t.baseTotalCents - baseRow.baseTotalCents;
      t.variancePctBp =
        baseRow.baseTotalCents === 0
          ? undefined
          : roundDivHalfUp(t.varianceCents * 10_000, Math.abs(baseRow.baseTotalCents));
    }
  }
  return totals;
}

function bidderTotals(c: Comparison, rows: LineReport[], baseline?: string): BidderTotal[] {
  return withVariance(
    c.bidders.map((b) => {
      const acc = accumulate(rows, b.id);
      return {
        bidderId: b.id,
        baseTotalCents: acc.base,
        optionalTotalCents: acc.optional,
        missingCount: acc.missing,
      };
    }),
    baseline,
  );
}

function groupReports(c: Comparison, rows: LineReport[], baseline?: string): GroupReport[] {
  const names = [...new Set(c.lines.map((l) => l.group ?? ""))];
  return names.map((group) => {
    const groupRows = rows.filter((r) => (r.line.group ?? "") === group);
    return { group, totals: bidderTotals(c, groupRows, baseline) };
  });
}

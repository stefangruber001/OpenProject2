import {
  FactoryError,
  applyRateBp,
  deepFreeze,
  sumCents,
  type AppendOnlyStore,
  type ClockPort,
  type CounterStore,
  type EventLogPort,
  type IdGenPort,
  type PortRegistry,
} from "@repo/kernel";
import type { BillingConfig, Invoice, InvoiceLine, TaxSummaryRow } from "./model";
import { SeriesNumbering } from "./numbering";
import {
  INVOICE_CHAIN_PORT,
  TAX_PORT,
  type InvoiceChainPort,
  type TaxLineDecision,
  type TaxPort,
} from "./ports";

export interface BillingDeps {
  tenantId: string;
  currency: string;
  config: BillingConfig;
  ports: PortRegistry;
  store: AppendOnlyStore<Invoice>;
  counters: CounterStore;
  clock: ClockPort;
  idGen: IdGenPort;
  events: EventLogPort;
}

export interface IssueOptions {
  buyer: Invoice["buyer"];
  seriesId: string;
  issueDate?: string;
  /** Opaque eligibility attributes passed through to the tax adapter. */
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Structural contract for anything billable (an accepted quote satisfies it).
 * Deliberately NOT an import from another capability — capabilities depend
 * only on the kernel; composition happens in the host layer.
 */
export interface BillableSource {
  id: string;
  status: string;
  currency: string;
  lines: readonly {
    id: string;
    description: string;
    unit?: string;
    qtyMillis: number;
    unitCents: number;
    totalCents: number;
    taxCategoryHint?: string;
  }[];
}

/**
 * Invoices are immutable once issued (append-only store enforces it);
 * corrections are rectificative invoices in their own series referencing the
 * original. Tax is decided by the bound TaxPort at the invoice's issue date,
 * and the decision + justification are persisted on the invoice (mandate
 * §6.3) — never recomputed on read.
 */
export class BillingService {
  private numbering: SeriesNumbering;

  constructor(private readonly deps: BillingDeps) {
    this.numbering = new SeriesNumbering(deps.config.series, deps.counters);
    // Fail at composition time, not on first invoice: tax is required.
    deps.ports.get<TaxPort>(TAX_PORT);
  }

  async issueFromQuote(quote: BillableSource, opts: IssueOptions): Promise<Readonly<Invoice>> {
    if (quote.status !== "accepted") {
      throw new FactoryError(
        "INVALID_STATE",
        `Quote ${quote.id} is "${quote.status}"; only accepted quotes can be invoiced.`,
      );
    }
    if (quote.currency !== this.deps.currency) {
      throw new FactoryError(
        "INVALID_STATE",
        `Quote currency ${quote.currency} does not match tenant currency ${this.deps.currency}.`,
      );
    }
    const lines: InvoiceLine[] = quote.lines.map((l) => ({
      id: l.id,
      description: l.description,
      unit: l.unit,
      qtyMillis: l.qtyMillis,
      unitCents: l.unitCents,
      totalCents: l.totalCents,
      taxCategoryHint: l.taxCategoryHint,
    }));
    return this.issue(lines, "standard", opts, { quoteId: quote.id });
  }

  /** Rectificative invoice: negates the original, own series, references it. */
  async rectify(
    invoiceId: string,
    opts: IssueOptions & { reason: string },
  ): Promise<Readonly<Invoice>> {
    const original = await this.get(invoiceId);
    const def = this.numbering.def(opts.seriesId);
    if (def.kind !== "rectificative") {
      throw new FactoryError(
        "INVALID_STATE",
        `Series "${opts.seriesId}" is kind "${def.kind}"; rectificative invoices require a rectificative series.`,
      );
    }
    const negated: InvoiceLine[] = original.lines.map((l) => ({
      ...l,
      qtyMillis: -l.qtyMillis,
      totalCents: -l.totalCents,
    }));
    return this.issue(negated, "rectificative", opts, {
      rectifies: original.id,
      rectificationReason: opts.reason,
    });
  }

  async get(invoiceId: string): Promise<Readonly<Invoice>> {
    const invoice = await this.deps.store.get(invoiceId);
    if (!invoice) throw new FactoryError("NOT_FOUND", `Invoice ${invoiceId} not found.`);
    return invoice;
  }

  async list(): Promise<readonly Invoice[]> {
    return this.deps.store.list();
  }

  private async issue(
    lines: InvoiceLine[],
    kind: Invoice["kind"],
    opts: IssueOptions,
    extra: Partial<Pick<Invoice, "rectifies" | "rectificationReason">> & { quoteId?: string },
  ): Promise<Readonly<Invoice>> {
    const def = this.numbering.def(opts.seriesId);
    if (kind === "standard" && def.kind !== "standard") {
      throw new FactoryError(
        "INVALID_STATE",
        `Series "${opts.seriesId}" is reserved for ${def.kind} invoices.`,
      );
    }
    const issueDate = opts.issueDate ?? this.deps.clock.todayIso();
    const tax = this.deps.ports.get<TaxPort>(TAX_PORT);
    const { perLine } = tax.determine({
      issueDate,
      attributes: opts.attributes ?? {},
      lines: lines.map((l) => ({
        lineId: l.id,
        baseCents: l.totalCents,
        categoryHint: l.taxCategoryHint,
      })),
    });
    const summary = summarize(lines, perLine);
    const baseCents = sumCents(lines.map((l) => l.totalCents));
    const taxCents = sumCents(summary.map((s) => s.taxCents));
    const { number, displayNumber } = await this.numbering.next(opts.seriesId, issueDate);

    const invoice: Invoice = {
      id: this.deps.idGen.next("inv"),
      tenantId: this.deps.tenantId,
      kind,
      rectifies: extra.rectifies,
      rectificationReason: extra.rectificationReason,
      series: opts.seriesId,
      number,
      displayNumber,
      issueDate,
      currency: this.deps.currency,
      seller: this.deps.config.seller,
      buyer: opts.buyer,
      lines,
      taxDecisions: perLine,
      taxSummary: summary,
      baseCents,
      taxCents,
      totalCents: baseCents + taxCents,
    };

    const chain = this.deps.ports.tryGet<InvoiceChainPort>(INVOICE_CHAIN_PORT);
    if (chain) {
      invoice.seal = await chain.seal({
        tenantId: invoice.tenantId,
        series: invoice.series,
        displayNumber: invoice.displayNumber,
        issueDate: invoice.issueDate,
        totalCents: invoice.totalCents,
        buyerTaxId: invoice.buyer.taxId,
      });
    }

    deepFreeze(invoice);
    await this.deps.store.append(invoice);
    await this.deps.events.append({
      type: "invoice.issued",
      at: this.deps.clock.nowIso(),
      tenantId: invoice.tenantId,
      payload: {
        invoiceId: invoice.id,
        displayNumber: invoice.displayNumber,
        kind,
        totalCents: invoice.totalCents,
        quoteId: extra.quoteId,
        rectifies: extra.rectifies,
      },
    });
    return invoice;
  }
}

/** Group per-line decisions by (taxCode, rate); tax is rounded per group. */
function summarize(lines: InvoiceLine[], decisions: TaxLineDecision[]): TaxSummaryRow[] {
  const byLine = new Map(decisions.map((d) => [d.lineId, d]));
  const groups = new Map<string, TaxSummaryRow>();
  for (const line of lines) {
    const decision = byLine.get(line.id);
    if (!decision) {
      throw new FactoryError(
        "INVALID_STATE",
        `Tax adapter returned no decision for line ${line.id}.`,
      );
    }
    const key = `${decision.taxCode}:${decision.rateBp}`;
    const row = groups.get(key) ?? {
      taxCode: decision.taxCode,
      rateBp: decision.rateBp,
      baseCents: 0,
      taxCents: 0,
    };
    row.baseCents += line.totalCents;
    groups.set(key, row);
  }
  for (const row of groups.values()) {
    row.taxCents = applyRateBp(row.baseCents, row.rateBp);
  }
  return [...groups.values()].sort((a, b) => b.rateBp - a.rateBp);
}

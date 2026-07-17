import {
  FactoryError,
  deepFreeze,
  lineTotalCents,
  sumCents,
  type ClockPort,
  type EventLogPort,
  type IdGenPort,
  type Repository,
} from "@repo/kernel";
import type { Quote, QuoteLineInput } from "./model";

export interface QuotingDeps {
  tenantId: string;
  currency: string;
  store: Repository<Quote>;
  clock: ClockPort;
  idGen: IdGenPort;
  events: EventLogPort;
}

/**
 * Quote lifecycle: draft → accepted, with optional lines kept apart from the
 * base total, selective option acceptance, and immutable versioned revisions.
 * Accepted quotes are deep-frozen — the accepted snapshot is what billing
 * consumes, so it must never drift. Persistence is an injected Repository.
 */
export class QuotingService {
  constructor(private readonly deps: QuotingDeps) {}

  async create(title: string): Promise<Quote> {
    const quote: Quote = {
      id: this.deps.idGen.next("quote"),
      tenantId: this.deps.tenantId,
      title,
      currency: this.deps.currency,
      status: "draft",
      createdAt: this.deps.clock.nowIso(),
      lines: [],
      baseCents: 0,
      optionalCents: 0,
      version: 1,
    };
    await this.deps.store.save(quote);
    await this.deps.events.append({
      type: "quote.created",
      at: quote.createdAt,
      tenantId: quote.tenantId,
      payload: { quoteId: quote.id, version: quote.version },
    });
    return quote;
  }

  async addLine(quoteId: string, input: QuoteLineInput): Promise<Quote> {
    const quote = await this.mustGetDraft(quoteId);
    const totalCents = lineTotalCents(input.qtyMillis, input.unitCents);
    quote.lines.push({ ...input, id: this.deps.idGen.next("line"), totalCents });
    recomputeTotals(quote);
    await this.deps.store.save(quote);
    return quote;
  }

  /**
   * Accept the quote. Optional lines are included ONLY when listed in
   * `includeOptionIds` — unchosen options drop out of the accepted scope
   * (they remain visible on the prior version via `revisionOf` history).
   */
  async accept(quoteId: string, opts?: { includeOptionIds?: string[] }): Promise<Readonly<Quote>> {
    const quote = await this.mustGetDraft(quoteId);
    const include = new Set(opts?.includeOptionIds ?? []);
    for (const id of include) {
      const line = quote.lines.find((l) => l.id === id);
      if (!line) throw new FactoryError("NOT_FOUND", `Option line ${id} not on quote ${quoteId}.`);
      if (!line.optional) {
        throw new FactoryError(
          "INVALID_STATE",
          `Line ${id} is part of the base scope, not an option.`,
        );
      }
    }
    quote.lines = quote.lines.filter((l) => !l.optional || include.has(l.id));
    recomputeTotals(quote);
    if (quote.lines.length === 0) {
      throw new FactoryError("INVALID_STATE", `Quote ${quoteId} has no lines to accept.`);
    }
    quote.status = "accepted";
    quote.acceptedAt = this.deps.clock.nowIso();
    quote.acceptedOptionIds = [...include];
    deepFreeze(quote);
    await this.deps.store.save(quote);
    await this.deps.events.append({
      type: "quote.accepted",
      at: quote.acceptedAt,
      tenantId: quote.tenantId,
      payload: {
        quoteId: quote.id,
        version: quote.version,
        baseCents: quote.baseCents,
        optionsIncluded: include.size,
      },
    });
    return quote;
  }

  /**
   * Create the next version as a fresh draft copy (QUO-12/13: issued versions
   * stay frozen and retrievable; changes happen on a new linked version).
   */
  async revise(quoteId: string): Promise<Quote> {
    const source = await this.mustGet(quoteId);
    const revision: Quote = {
      id: this.deps.idGen.next("quote"),
      tenantId: source.tenantId,
      title: source.title,
      currency: source.currency,
      status: "draft",
      createdAt: this.deps.clock.nowIso(),
      lines: source.lines.map((l) => ({ ...l, meta: l.meta ? { ...l.meta } : undefined })),
      baseCents: source.baseCents,
      optionalCents: source.optionalCents,
      version: source.version + 1,
      revisionOf: source.id,
    };
    await this.deps.store.save(revision);
    await this.deps.events.append({
      type: "quote.revised",
      at: revision.createdAt,
      tenantId: revision.tenantId,
      payload: { quoteId: revision.id, version: revision.version, revisionOf: source.id },
    });
    return revision;
  }

  async get(quoteId: string): Promise<Readonly<Quote>> {
    return this.mustGet(quoteId);
  }

  async list(): Promise<readonly Quote[]> {
    return this.deps.store.list();
  }

  private async mustGet(quoteId: string): Promise<Quote> {
    const quote = await this.deps.store.get(quoteId);
    if (!quote) throw new FactoryError("NOT_FOUND", `Quote ${quoteId} not found.`);
    return quote;
  }

  private async mustGetDraft(quoteId: string): Promise<Quote> {
    const quote = await this.mustGet(quoteId);
    if (quote.status !== "draft") {
      throw new FactoryError(
        "IMMUTABLE",
        `Quote ${quoteId} is ${quote.status}; accepted versions never change — use revise().`,
      );
    }
    return quote;
  }
}

function recomputeTotals(quote: Quote): void {
  quote.baseCents = sumCents(quote.lines.filter((l) => !l.optional).map((l) => l.totalCents));
  quote.optionalCents = sumCents(quote.lines.filter((l) => l.optional).map((l) => l.totalCents));
}

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
 * Quote lifecycle: draft → accepted. Accepted quotes are deep-frozen — the
 * accepted snapshot is what billing consumes, so it must never drift.
 * Persistence is an injected Repository (in-memory or durable, same contract).
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
    };
    await this.deps.store.save(quote);
    await this.deps.events.append({
      type: "quote.created",
      at: quote.createdAt,
      tenantId: quote.tenantId,
      payload: { quoteId: quote.id },
    });
    return quote;
  }

  async addLine(quoteId: string, input: QuoteLineInput): Promise<Quote> {
    const quote = await this.mustGetDraft(quoteId);
    const totalCents = lineTotalCents(input.qtyMillis, input.unitCents);
    quote.lines.push({ ...input, id: this.deps.idGen.next("line"), totalCents });
    quote.baseCents = sumCents(quote.lines.map((l) => l.totalCents));
    await this.deps.store.save(quote);
    return quote;
  }

  async accept(quoteId: string): Promise<Readonly<Quote>> {
    const quote = await this.mustGetDraft(quoteId);
    if (quote.lines.length === 0) {
      throw new FactoryError("INVALID_STATE", `Quote ${quoteId} has no lines to accept.`);
    }
    quote.status = "accepted";
    quote.acceptedAt = this.deps.clock.nowIso();
    deepFreeze(quote);
    await this.deps.store.save(quote);
    await this.deps.events.append({
      type: "quote.accepted",
      at: quote.acceptedAt,
      tenantId: quote.tenantId,
      payload: { quoteId: quote.id, baseCents: quote.baseCents },
    });
    return quote;
  }

  async get(quoteId: string): Promise<Readonly<Quote>> {
    const quote = await this.deps.store.get(quoteId);
    if (!quote) throw new FactoryError("NOT_FOUND", `Quote ${quoteId} not found.`);
    return quote;
  }

  async list(): Promise<readonly Quote[]> {
    return this.deps.store.list();
  }

  private async mustGetDraft(quoteId: string): Promise<Quote> {
    const quote = await this.deps.store.get(quoteId);
    if (!quote) throw new FactoryError("NOT_FOUND", `Quote ${quoteId} not found.`);
    if (quote.status !== "draft") {
      throw new FactoryError(
        "IMMUTABLE",
        `Quote ${quoteId} is ${quote.status}; accepted quotes cannot change.`,
      );
    }
    return quote;
  }
}

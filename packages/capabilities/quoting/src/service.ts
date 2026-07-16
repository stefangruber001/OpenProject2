import {
  FactoryError,
  deepFreeze,
  lineTotalCents,
  sumCents,
  type ClockPort,
  type EventLogPort,
  type IdGenPort,
} from "@repo/kernel";
import type { Quote, QuoteLineInput } from "./model";

export interface QuotingDeps {
  tenantId: string;
  currency: string;
  clock: ClockPort;
  idGen: IdGenPort;
  events: EventLogPort;
}

/**
 * Quote lifecycle: draft → accepted. Accepted quotes are deep-frozen — the
 * accepted snapshot is what billing consumes, so it must never drift.
 */
export class QuotingService {
  private quotes = new Map<string, Quote>();

  constructor(private readonly deps: QuotingDeps) {}

  create(title: string): Quote {
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
    this.quotes.set(quote.id, quote);
    this.deps.events.append({
      type: "quote.created",
      at: quote.createdAt,
      tenantId: quote.tenantId,
      payload: { quoteId: quote.id },
    });
    return quote;
  }

  addLine(quoteId: string, input: QuoteLineInput): Quote {
    const quote = this.mustGetDraft(quoteId);
    const totalCents = lineTotalCents(input.qtyMillis, input.unitCents);
    quote.lines.push({ ...input, id: this.deps.idGen.next("line"), totalCents });
    quote.baseCents = sumCents(quote.lines.map((l) => l.totalCents));
    return quote;
  }

  accept(quoteId: string): Readonly<Quote> {
    const quote = this.mustGetDraft(quoteId);
    if (quote.lines.length === 0) {
      throw new FactoryError("INVALID_STATE", `Quote ${quoteId} has no lines to accept.`);
    }
    quote.status = "accepted";
    quote.acceptedAt = this.deps.clock.nowIso();
    deepFreeze(quote);
    this.deps.events.append({
      type: "quote.accepted",
      at: quote.acceptedAt,
      tenantId: quote.tenantId,
      payload: { quoteId: quote.id, baseCents: quote.baseCents },
    });
    return quote;
  }

  get(quoteId: string): Readonly<Quote> {
    const quote = this.quotes.get(quoteId);
    if (!quote) throw new FactoryError("NOT_FOUND", `Quote ${quoteId} not found.`);
    return quote;
  }

  private mustGetDraft(quoteId: string): Quote {
    const quote = this.quotes.get(quoteId);
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

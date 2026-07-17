import { FactoryError, sumCents, type Cents, type ClockPort, type IdGenPort } from "@repo/kernel";
import type { Book, CrmConfig, Customer, Lead, StageSummary } from "./model";

export interface CrmDeps {
  clock: ClockPort;
  idGen: IdGenPort;
  config: CrmConfig;
}

/**
 * CRM engine. Register customers, open leads on a configurable pipeline, move
 * them stage by stage, track a next action, and surface overdue follow-ups and
 * a pipeline summary. Pure over a Book value.
 */
export class CrmService {
  constructor(private readonly deps: CrmDeps) {}

  empty(): Book {
    return { customers: [], leads: [] };
  }

  addCustomer(
    book: Book,
    input: { name: string; email?: string; phone?: string; ref?: string },
  ): Book {
    const customer: Customer = {
      id: this.deps.idGen.next("cust"),
      ...input,
      createdAt: this.deps.clock.todayIso(),
    };
    return { ...book, customers: [...book.customers, customer] };
  }

  addLead(
    book: Book,
    input: {
      title: string;
      customerRef?: string;
      valueCents?: Cents;
      owner?: string;
      nextAction?: string;
      nextActionDate?: string;
    },
  ): Book {
    const lead: Lead = {
      id: this.deps.idGen.next("lead"),
      title: input.title,
      customerRef: input.customerRef,
      stage: this.deps.config.pipeline[0],
      valueCents: input.valueCents,
      status: "open",
      owner: input.owner,
      nextAction: input.nextAction,
      nextActionDate: input.nextActionDate,
      createdAt: this.deps.clock.todayIso(),
    };
    return { ...book, leads: [...book.leads, lead] };
  }

  moveLead(book: Book, leadId: string, stage: string): Book {
    if (!this.deps.config.pipeline.includes(stage)) {
      throw new FactoryError("INVALID_STATE", `Stage "${stage}" is not in the pipeline.`);
    }
    return this.mutateLead(book, leadId, (l) => ({ ...l, stage }));
  }

  setNextAction(book: Book, leadId: string, action: string, dueDate?: string): Book {
    return this.mutateLead(book, leadId, (l) => ({
      ...l,
      nextAction: action,
      nextActionDate: dueDate,
    }));
  }

  closeLead(book: Book, leadId: string, won: boolean): Book {
    return this.mutateLead(book, leadId, (l) => ({
      ...l,
      status: won ? "won" : "lost",
      nextAction: undefined,
      nextActionDate: undefined,
    }));
  }

  /** Open leads whose next-action date is on or before `asOf`, soonest first. */
  overdueActions(book: Book, asOf?: string): Lead[] {
    const today = asOf ?? this.deps.clock.todayIso();
    return book.leads
      .filter((l) => l.status === "open" && l.nextActionDate != null && l.nextActionDate <= today)
      .sort((a, b) => (a.nextActionDate! < b.nextActionDate! ? -1 : 1));
  }

  /** Count + value of open leads by pipeline stage (drives the funnel). */
  pipeline(book: Book): StageSummary[] {
    return this.deps.config.pipeline.map((stage) => {
      const leads = book.leads.filter((l) => l.status === "open" && l.stage === stage);
      return {
        stage,
        count: leads.length,
        valueCents: sumCents(leads.map((l) => l.valueCents ?? 0)),
      };
    });
  }

  private mutateLead(book: Book, leadId: string, fn: (l: Lead) => Lead): Book {
    const idx = book.leads.findIndex((l) => l.id === leadId);
    if (idx === -1) throw new FactoryError("NOT_FOUND", `Lead ${leadId} not found.`);
    const leads = book.leads.map((l, i) => (i === idx ? fn(l) : l));
    return { ...book, leads };
  }
}

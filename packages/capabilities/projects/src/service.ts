import {
  FactoryError,
  roundDivHalfUp,
  sumCents,
  type Cents,
  type ClockPort,
  type IdGenPort,
} from "@repo/kernel";
import { forecastToCompletion, type ForecastInput, type ProjectForecast } from "./forecast";
import type {
  ChangeOrder,
  ChapterBudget,
  ChapterVariance,
  CostEntry,
  CostKind,
  Project,
  ProjectFinancials,
  ProjectsConfig,
} from "./model";

export interface ProjectsDeps {
  clock: ClockPort;
  idGen: IdGenPort;
  config: ProjectsConfig;
}

const bp = (part: Cents, whole: Cents): number =>
  whole === 0 ? 0 : roundDivHalfUp(part * 10_000, Math.abs(whole));

/**
 * Project control. Pure domain engine: create a project from an accepted quote
 * (immutable baseline), book committed/actual costs, raise change orders that
 * preserve the baseline, and report margin + quoted-vs-actual by chapter.
 * Persistence (durable stores) is the same seam other capabilities use.
 */
export class ProjectsService {
  constructor(private readonly deps: ProjectsDeps) {}

  /**
   * Create a project from an accepted quote WITHOUT re-entering figures. The
   * chapter budgets and total are copied once and then frozen (PRJ baseline).
   */
  fromAcceptedQuote(input: {
    name: string;
    sourceQuoteId?: string;
    customerRef?: string;
    baselineByChapter: ChapterBudget[];
  }): Project {
    if (input.baselineByChapter.length === 0) {
      throw new FactoryError(
        "INVALID_STATE",
        "A project needs at least one chapter budget from the quote.",
      );
    }
    const baselineCents = sumCents(input.baselineByChapter.map((c) => c.budgetCents));
    return {
      id: this.deps.idGen.next("prj"),
      name: input.name,
      customerRef: input.customerRef,
      sourceQuoteId: input.sourceQuoteId,
      baselineCents,
      baselineByChapter: input.baselineByChapter.map((c) => ({ ...c })),
      revenueCents: 0,
      costs: [],
      changeOrders: [],
      status: "active",
      createdAt: this.deps.clock.nowIso(),
    };
  }

  bookCost(
    project: Project,
    input: {
      kind: CostKind;
      chapter: string;
      description: string;
      amountCents: Cents;
      ref?: string;
    },
  ): Project {
    this.assertActive(project);
    const entry: CostEntry = {
      id: this.deps.idGen.next("cost"),
      kind: input.kind,
      chapter: input.chapter,
      description: input.description,
      amountCents: input.amountCents,
      date: this.deps.clock.todayIso(),
      ref: input.ref,
    };
    return { ...project, costs: [...project.costs, entry] };
  }

  recordRevenue(project: Project, amountCents: Cents): Project {
    this.assertActive(project);
    return { ...project, revenueCents: project.revenueCents + amountCents };
  }

  /** Raise a change order (proposed). The baseline is never touched. */
  proposeChange(
    project: Project,
    input: { chapter: string; description: string; deltaCents: Cents },
  ): Project {
    this.assertActive(project);
    const co: ChangeOrder = {
      id: this.deps.idGen.next("chg"),
      chapter: input.chapter,
      description: input.description,
      deltaCents: input.deltaCents,
      status: "proposed",
      date: this.deps.clock.todayIso(),
    };
    return { ...project, changeOrders: [...project.changeOrders, co] };
  }

  decideChange(project: Project, changeId: string, approve: boolean): Project {
    const idx = project.changeOrders.findIndex((c) => c.id === changeId);
    if (idx === -1) throw new FactoryError("NOT_FOUND", `Change order ${changeId} not found.`);
    if (project.changeOrders[idx]!.status !== "proposed") {
      throw new FactoryError("INVALID_STATE", `Change order ${changeId} is already decided.`);
    }
    const changeOrders = project.changeOrders.map((c, i) =>
      i === idx ? { ...c, status: approve ? ("approved" as const) : ("rejected" as const) } : c,
    );
    return { ...project, changeOrders };
  }

  close(project: Project): Project {
    return { ...project, status: "closed" };
  }

  /** The financial truth: budget vs committed vs actual vs revenue, margin,
   *  forecast, and quoted-vs-actual per chapter. */
  financials(project: Project): ProjectFinancials {
    const approvedChangesCents = sumCents(
      project.changeOrders.filter((c) => c.status === "approved").map((c) => c.deltaCents),
    );
    const currentBudgetCents = project.baselineCents + approvedChangesCents;
    const committedCents = sumCents(
      project.costs.filter((c) => c.kind === "committed").map((c) => c.amountCents),
    );
    const actualCents = sumCents(
      project.costs.filter((c) => c.kind === "actual").map((c) => c.amountCents),
    );
    const marginCents = project.revenueCents - actualCents;
    const forecastProfitCents = currentBudgetCents - Math.max(actualCents, committedCents);
    const marginBp = bp(marginCents, project.revenueCents || currentBudgetCents);
    const marginBelowFloor = project.revenueCents > 0 && marginBp < this.deps.config.marginFloorBp;

    return {
      baselineCents: project.baselineCents,
      approvedChangesCents,
      currentBudgetCents,
      committedCents,
      actualCents,
      revenueCents: project.revenueCents,
      marginCents,
      marginBp,
      forecastProfitCents,
      marginBelowFloor,
      byChapter: this.marginByChapter(project),
    };
  }

  /**
   * Where the cost is heading, not where it has got to. `financials()` reports
   * what has happened; this reports what it implies — see forecast.ts for why
   * the two are different questions and why both are worth showing.
   */
  forecast(project: Project, input: ForecastInput): ProjectForecast {
    return forecastToCompletion(project, input);
  }

  /** Per-chapter budget vs committed vs actual + variance (the core pain). */
  marginByChapter(project: Project): ChapterVariance[] {
    const chapters = new Set<string>([
      ...project.baselineByChapter.map((c) => c.chapter),
      ...project.costs.map((c) => c.chapter),
      ...project.changeOrders.filter((c) => c.status === "approved").map((c) => c.chapter),
    ]);
    return [...chapters].map((chapter) => {
      const baseline =
        project.baselineByChapter.find((c) => c.chapter === chapter)?.budgetCents ?? 0;
      const approved = sumCents(
        project.changeOrders
          .filter((c) => c.status === "approved" && c.chapter === chapter)
          .map((c) => c.deltaCents),
      );
      const budgetCents = baseline + approved;
      const committedCents = sumCents(
        project.costs
          .filter((c) => c.kind === "committed" && c.chapter === chapter)
          .map((c) => c.amountCents),
      );
      const actualCents = sumCents(
        project.costs
          .filter((c) => c.kind === "actual" && c.chapter === chapter)
          .map((c) => c.amountCents),
      );
      const varianceCents = actualCents - budgetCents;
      return {
        chapter,
        budgetCents,
        committedCents,
        actualCents,
        varianceCents,
        varianceBp: bp(varianceCents, budgetCents),
      };
    });
  }

  private assertActive(project: Project): void {
    if (project.status !== "active") {
      throw new FactoryError("INVALID_STATE", `Project ${project.id} is closed.`);
    }
  }
}

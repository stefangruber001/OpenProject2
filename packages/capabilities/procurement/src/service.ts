import { FactoryError, sumCents, type Cents, type ClockPort, type IdGenPort } from "@repo/kernel";
import type { Book, ChapterCommitment, PoLine, ProcurementConfig, PurchaseOrder } from "./model";

export interface ProcurementDeps {
  clock: ClockPort;
  idGen: IdGenPort;
  config: ProcurementConfig;
}

const COMMITTING: ReadonlySet<string> = new Set(["sent", "received"]);
const lineTotal = (lines: PoLine[]): Cents => sumCents(lines.map((l) => l.amountCents));

/**
 * Procurement engine. Raise purchase orders, move them draft→sent→received,
 * and roll up committed cost by chapter — the link between a supplier decision
 * and a project's committed budget. Pure over a Book value.
 */
export class ProcurementService {
  constructor(private readonly deps: ProcurementDeps) {}

  empty(): Book {
    return { orders: [] };
  }

  raise(book: Book, input: { supplierRef: string; projectRef?: string; lines: PoLine[] }): Book {
    if (input.lines.length === 0) {
      throw new FactoryError("INVALID_STATE", "A purchase order needs at least one line.");
    }
    const po: PurchaseOrder = {
      id: this.deps.idGen.next("po"),
      supplierRef: input.supplierRef,
      projectRef: input.projectRef,
      status: "draft",
      lines: input.lines,
      totalCents: lineTotal(input.lines),
      createdAt: this.deps.clock.todayIso(),
    };
    return { ...book, orders: [...book.orders, po] };
  }

  transition(book: Book, poId: string, to: PurchaseOrder["status"]): Book {
    const po = book.orders.find((o) => o.id === poId);
    if (!po) throw new FactoryError("NOT_FOUND", `Purchase order ${poId} not found.`);
    const allowed: Record<PurchaseOrder["status"], PurchaseOrder["status"][]> = {
      draft: ["sent", "cancelled"],
      sent: ["received", "cancelled"],
      received: [],
      cancelled: [],
    };
    if (!allowed[po.status].includes(to)) {
      throw new FactoryError("INVALID_STATE", `Cannot move PO ${poId} from ${po.status} to ${to}.`);
    }
    return { ...book, orders: book.orders.map((o) => (o.id === poId ? { ...o, status: to } : o)) };
  }

  /** Total committed (sent + received) cost, optionally scoped to a project. */
  committed(book: Book, projectRef?: string): Cents {
    return sumCents(
      book.orders
        .filter(
          (o) => COMMITTING.has(o.status) && (projectRef == null || o.projectRef === projectRef),
        )
        .map((o) => o.totalCents),
    );
  }

  /** Committed-vs-budget per chapter for a project (over-budget flagged). */
  commitmentByChapter(
    book: Book,
    budgets: { chapter: string; budgetCents: Cents }[],
    projectRef?: string,
  ): ChapterCommitment[] {
    const committing = book.orders.filter(
      (o) => COMMITTING.has(o.status) && (projectRef == null || o.projectRef === projectRef),
    );
    const chapters = new Set<string>([
      ...budgets.map((b) => b.chapter),
      ...committing.flatMap((o) => o.lines.map((l) => l.chapter)),
    ]);
    return [...chapters].map((chapter) => {
      const committedCents = sumCents(
        committing.flatMap((o) =>
          o.lines.filter((l) => l.chapter === chapter).map((l) => l.amountCents),
        ),
      );
      const budgetCents = budgets.find((b) => b.chapter === chapter)?.budgetCents ?? 0;
      return { chapter, committedCents, budgetCents, overBudget: committedCents > budgetCents };
    });
  }
}

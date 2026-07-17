import { FactoryError, sumCents, type Cents, type ClockPort, type IdGenPort } from "@repo/kernel";
import type {
  AgingBucket,
  Allocation,
  ArInvoice,
  InvoiceStatus,
  Ledger,
  ReceivablesConfig,
  Receipt,
} from "./model";

export interface ReceivablesDeps {
  clock: ClockPort;
  idGen: IdGenPort;
  config: ReceivablesConfig;
}

const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);

/**
 * AR engine. Register customer invoices, record receipts with partial
 * allocation across invoices (never over-allocating), and report outstanding
 * balances, overdue and aging. Pure over a Ledger value.
 */
export class ReceivablesService {
  constructor(private readonly deps: ReceivablesDeps) {}

  empty(): Ledger {
    return { invoices: [], receipts: [] };
  }

  registerInvoice(
    ledger: Ledger,
    input: {
      ref: string;
      customerRef: string;
      totalCents: Cents;
      issueDate: string;
      dueDate: string;
    },
  ): Ledger {
    const invoice: ArInvoice = { id: this.deps.idGen.next("ar"), ...input };
    return { ...ledger, invoices: [...ledger.invoices, invoice] };
  }

  /** Record a receipt allocated across invoices; each allocation is capped at
   *  the invoice's current outstanding, so partial payments are first-class. */
  recordReceipt(
    ledger: Ledger,
    input: { amountCents: Cents; method?: string; allocations: Allocation[] },
  ): Ledger {
    const allocTotal = sumCents(input.allocations.map((a) => a.amountCents));
    if (allocTotal > input.amountCents) {
      throw new FactoryError("INVALID_STATE", "Allocations exceed the receipt amount.");
    }
    for (const a of input.allocations) {
      const inv = ledger.invoices.find((i) => i.id === a.invoiceId);
      if (!inv) throw new FactoryError("NOT_FOUND", `Invoice ${a.invoiceId} not found.`);
      const outstanding = this.status(ledger, inv.id).outstandingCents;
      if (a.amountCents <= 0)
        throw new FactoryError("INVALID_STATE", "Allocation must be positive.");
      if (a.amountCents > outstanding) {
        throw new FactoryError(
          "INVALID_STATE",
          `Allocation ${a.amountCents} exceeds outstanding ${outstanding} on ${inv.id}.`,
        );
      }
    }
    const receipt: Receipt = {
      id: this.deps.idGen.next("rcpt"),
      date: this.deps.clock.todayIso(),
      amountCents: input.amountCents,
      method: input.method,
      allocations: input.allocations,
    };
    return { ...ledger, receipts: [...ledger.receipts, receipt] };
  }

  status(ledger: Ledger, invoiceId: string, asOf?: string): InvoiceStatus {
    const invoice = ledger.invoices.find((i) => i.id === invoiceId);
    if (!invoice) throw new FactoryError("NOT_FOUND", `Invoice ${invoiceId} not found.`);
    const paidCents = sumCents(
      ledger.receipts.flatMap((r) =>
        r.allocations.filter((a) => a.invoiceId === invoiceId).map((a) => a.amountCents),
      ),
    );
    const outstandingCents = invoice.totalCents - paidCents;
    const today = asOf ?? this.deps.clock.todayIso();
    const overdueDays = outstandingCents > 0 ? Math.max(0, daysBetween(invoice.dueDate, today)) : 0;
    const status = outstandingCents <= 0 ? "paid" : paidCents > 0 ? "partial" : "open";
    return { invoice, paidCents, outstandingCents, overdueDays, status };
  }

  /** All invoices with an outstanding balance, most overdue first. */
  dueList(ledger: Ledger, asOf?: string): InvoiceStatus[] {
    return ledger.invoices
      .map((i) => this.status(ledger, i.id, asOf))
      .filter((s) => s.outstandingCents > 0)
      .sort((a, b) => b.overdueDays - a.overdueDays);
  }

  totalOutstanding(ledger: Ledger, asOf?: string): Cents {
    return sumCents(this.dueList(ledger, asOf).map((s) => s.outstandingCents));
  }

  /** Aging buckets by days overdue, per the configured thresholds. */
  aging(ledger: Ledger, asOf?: string): AgingBucket[] {
    const days = this.deps.config.agingDays;
    const buckets: AgingBucket[] = [
      { label: "not due", outstandingCents: 0, count: 0 },
      ...days.map((d) => ({ label: `≤ ${d}d`, outstandingCents: 0, count: 0 })),
      { label: `> ${days[days.length - 1]}d`, outstandingCents: 0, count: 0 },
    ];
    for (const s of this.dueList(ledger, asOf)) {
      let idx = 0;
      if (s.overdueDays > 0) {
        idx = days.findIndex((d) => s.overdueDays <= d);
        idx = idx === -1 ? buckets.length - 1 : idx + 1;
      }
      buckets[idx]!.outstandingCents += s.outstandingCents;
      buckets[idx]!.count += 1;
    }
    return buckets;
  }
}

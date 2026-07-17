import { FactoryError, sumCents, type Cents, type ClockPort, type IdGenPort } from "@repo/kernel";
import type { BillStatus, Ledger, PayablesConfig, Payment, SupplierBill } from "./model";

export interface PayablesDeps {
  clock: ClockPort;
  idGen: IdGenPort;
  config: PayablesConfig;
}

const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);

/**
 * AP engine. Register supplier bills (rejecting duplicate supplier+number),
 * record partial payments (never over-paying), and report outstanding + due.
 */
export class PayablesService {
  constructor(private readonly deps: PayablesDeps) {}

  empty(): Ledger {
    return { bills: [], payments: [] };
  }

  /** Detect a duplicate before booking: same supplier + same document number. */
  isDuplicate(ledger: Ledger, supplierRef: string, number: string): boolean {
    return ledger.bills.some((b) => b.supplierRef === supplierRef && b.number === number);
  }

  registerBill(
    ledger: Ledger,
    input: {
      supplierRef: string;
      number: string;
      totalCents: Cents;
      issueDate: string;
      dueDate: string;
      projectRef?: string;
    },
  ): Ledger {
    if (this.isDuplicate(ledger, input.supplierRef, input.number)) {
      throw new FactoryError(
        "INVALID_STATE",
        `Duplicate bill: supplier ${input.supplierRef} number ${input.number} is already booked.`,
        { supplierRef: input.supplierRef, number: input.number },
      );
    }
    const bill: SupplierBill = { id: this.deps.idGen.next("ap"), ...input };
    return { ...ledger, bills: [...ledger.bills, bill] };
  }

  recordPayment(
    ledger: Ledger,
    input: { billId: string; amountCents: Cents; method?: string },
  ): Ledger {
    const bill = ledger.bills.find((b) => b.id === input.billId);
    if (!bill) throw new FactoryError("NOT_FOUND", `Bill ${input.billId} not found.`);
    if (input.amountCents <= 0)
      throw new FactoryError("INVALID_STATE", "Payment must be positive.");
    const outstanding = this.status(ledger, bill.id).outstandingCents;
    if (input.amountCents > outstanding) {
      throw new FactoryError(
        "INVALID_STATE",
        `Payment ${input.amountCents} exceeds outstanding ${outstanding}.`,
      );
    }
    const payment: Payment = {
      id: this.deps.idGen.next("pmt"),
      date: this.deps.clock.todayIso(),
      billId: input.billId,
      amountCents: input.amountCents,
      method: input.method,
    };
    return { ...ledger, payments: [...ledger.payments, payment] };
  }

  status(ledger: Ledger, billId: string, asOf?: string): BillStatus {
    const bill = ledger.bills.find((b) => b.id === billId);
    if (!bill) throw new FactoryError("NOT_FOUND", `Bill ${billId} not found.`);
    const paidCents = sumCents(
      ledger.payments.filter((p) => p.billId === billId).map((p) => p.amountCents),
    );
    const outstandingCents = bill.totalCents - paidCents;
    const today = asOf ?? this.deps.clock.todayIso();
    const overdueDays = outstandingCents > 0 ? Math.max(0, daysBetween(bill.dueDate, today)) : 0;
    const status = outstandingCents <= 0 ? "paid" : paidCents > 0 ? "partial" : "open";
    return { bill, paidCents, outstandingCents, overdueDays, status };
  }

  dueList(ledger: Ledger, asOf?: string): BillStatus[] {
    return ledger.bills
      .map((b) => this.status(ledger, b.id, asOf))
      .filter((s) => s.outstandingCents > 0)
      .sort((a, b) => Date.parse(a.bill.dueDate) - Date.parse(b.bill.dueDate));
  }

  totalOutstanding(ledger: Ledger, asOf?: string): Cents {
    return sumCents(this.dueList(ledger, asOf).map((s) => s.outstandingCents));
  }
}

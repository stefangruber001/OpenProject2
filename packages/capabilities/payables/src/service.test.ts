import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import { payablesConfigSchema } from "./model";
import { PayablesService } from "./service";

function svc(date = "2026-07-17") {
  return new PayablesService({
    clock: new FixedClock(date),
    idGen: new SeqIdGen(),
    config: payablesConfigSchema.parse({}),
  });
}

describe("PayablesService", () => {
  it("books a bill and detects a duplicate supplier+number", () => {
    const s = svc();
    let l = s.empty();
    l = s.registerBill(l, {
      supplierRef: "S1",
      number: "F-100",
      totalCents: 80_000,
      issueDate: "2026-07-01",
      dueDate: "2026-07-31",
    });
    expect(s.isDuplicate(l, "S1", "F-100")).toBe(true);
    expect(s.isDuplicate(l, "S1", "F-101")).toBe(false);
    try {
      s.registerBill(l, {
        supplierRef: "S1",
        number: "F-100",
        totalCents: 80_000,
        issueDate: "2026-07-02",
        dueDate: "2026-08-01",
      });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });

  it("records partial payments and tracks outstanding", () => {
    const s = svc();
    let l = s.empty();
    l = s.registerBill(l, {
      supplierRef: "S1",
      number: "F-100",
      totalCents: 80_000,
      issueDate: "2026-07-01",
      dueDate: "2026-07-31",
    });
    const bill = l.bills[0]!;
    l = s.recordPayment(l, { billId: bill.id, amountCents: 30_000 });
    expect(s.status(l, bill.id).outstandingCents).toBe(50_000);
    expect(s.status(l, bill.id).status).toBe("partial");
    l = s.recordPayment(l, { billId: bill.id, amountCents: 50_000 });
    expect(s.status(l, bill.id).status).toBe("paid");
    expect(s.totalOutstanding(l)).toBe(0);
  });

  it("refuses to overpay a bill", () => {
    const s = svc();
    let l = s.empty();
    l = s.registerBill(l, {
      supplierRef: "S2",
      number: "X1",
      totalCents: 10_000,
      issueDate: "2026-07-01",
      dueDate: "2026-07-10",
    });
    const bill = l.bills[0]!;
    try {
      s.recordPayment(l, { billId: bill.id, amountCents: 20_000 });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });

  it("orders the due list by due date", () => {
    const s = svc();
    let l = s.empty();
    l = s.registerBill(l, {
      supplierRef: "S1",
      number: "A",
      totalCents: 100,
      issueDate: "2026-07-01",
      dueDate: "2026-08-10",
    });
    l = s.registerBill(l, {
      supplierRef: "S1",
      number: "B",
      totalCents: 200,
      issueDate: "2026-07-01",
      dueDate: "2026-07-20",
    });
    const due = s.dueList(l);
    expect(due[0]!.bill.number).toBe("B"); // earlier due date first
    expect(s.totalOutstanding(l)).toBe(300);
  });
});

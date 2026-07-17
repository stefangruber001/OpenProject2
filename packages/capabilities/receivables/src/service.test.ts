import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import { receivablesConfigSchema } from "./model";
import { ReceivablesService } from "./service";

function svc(date = "2026-07-17") {
  return new ReceivablesService({
    clock: new FixedClock(date),
    idGen: new SeqIdGen(),
    config: receivablesConfigSchema.parse({}),
  });
}

function seed(s: ReceivablesService) {
  let l = s.empty();
  l = s.registerInvoice(l, {
    ref: "INV-1",
    customerRef: "C1",
    totalCents: 100_000,
    issueDate: "2026-06-01",
    dueDate: "2026-06-16",
  });
  l = s.registerInvoice(l, {
    ref: "INV-2",
    customerRef: "C1",
    totalCents: 50_000,
    issueDate: "2026-07-10",
    dueDate: "2026-07-25",
  });
  return l;
}

describe("ReceivablesService", () => {
  it("applies a partial receipt allocated across invoices", () => {
    const s = svc();
    let l = seed(s);
    const [inv1, inv2] = l.invoices;
    l = s.recordReceipt(l, {
      amountCents: 70_000,
      allocations: [
        { invoiceId: inv1!.id, amountCents: 60_000 },
        { invoiceId: inv2!.id, amountCents: 10_000 },
      ],
    });
    expect(s.status(l, inv1!.id).outstandingCents).toBe(40_000);
    expect(s.status(l, inv1!.id).status).toBe("partial");
    expect(s.status(l, inv2!.id).outstandingCents).toBe(40_000);
    expect(s.totalOutstanding(l)).toBe(80_000);
  });

  it("refuses to allocate more than an invoice's outstanding", () => {
    const s = svc();
    const l = seed(s);
    const inv1 = l.invoices[0]!;
    try {
      s.recordReceipt(l, {
        amountCents: 200_000,
        allocations: [{ invoiceId: inv1.id, amountCents: 200_000 }],
      });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });

  it("marks fully-paid invoices and drops them from the due list", () => {
    const s = svc();
    let l = seed(s);
    const inv2 = l.invoices[1]!;
    l = s.recordReceipt(l, {
      amountCents: 50_000,
      allocations: [{ invoiceId: inv2.id, amountCents: 50_000 }],
    });
    expect(s.status(l, inv2.id).status).toBe("paid");
    expect(s.dueList(l).some((d) => d.invoice.id === inv2.id)).toBe(false);
  });

  it("computes overdue days and aging buckets", () => {
    const s = svc("2026-07-17");
    const l = seed(s);
    const inv1 = s.status(l, l.invoices[0]!.id);
    expect(inv1.overdueDays).toBe(31); // due 2026-06-16 → 2026-07-17
    const aging = s.aging(l);
    const overdue = aging.find((b) => b.label === "≤ 60d")!;
    expect(overdue.outstandingCents).toBe(100_000);
    expect(aging.find((b) => b.label === "not due")!.outstandingCents).toBe(50_000);
  });
});

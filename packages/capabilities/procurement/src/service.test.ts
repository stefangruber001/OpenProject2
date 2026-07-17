import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import { procurementConfigSchema } from "./model";
import { ProcurementService } from "./service";

function svc() {
  return new ProcurementService({
    clock: new FixedClock("2026-07-17"),
    idGen: new SeqIdGen(),
    config: procurementConfigSchema.parse({}),
  });
}

describe("ProcurementService", () => {
  it("raises a PO and totals its lines", () => {
    const s = svc();
    const b = s.raise(s.empty(), {
      supplierRef: "S1",
      projectRef: "prj_1",
      lines: [
        { chapter: "A", description: "tiles", amountCents: 60_000 },
        { chapter: "B", description: "kit", amountCents: 40_000 },
      ],
    });
    expect(b.orders[0]!.totalCents).toBe(100_000);
    expect(b.orders[0]!.status).toBe("draft");
  });

  it("commits cost only once a PO is sent or received", () => {
    const s = svc();
    let b = s.raise(s.empty(), {
      supplierRef: "S1",
      projectRef: "prj_1",
      lines: [{ chapter: "A", description: "x", amountCents: 50_000 }],
    });
    const id = b.orders[0]!.id;
    expect(s.committed(b, "prj_1")).toBe(0); // still draft
    b = s.transition(b, id, "sent");
    expect(s.committed(b, "prj_1")).toBe(50_000);
    b = s.transition(b, id, "received");
    expect(s.committed(b, "prj_1")).toBe(50_000);
  });

  it("enforces the status lifecycle", () => {
    const s = svc();
    const b = s.raise(s.empty(), {
      supplierRef: "S1",
      lines: [{ chapter: "A", description: "x", amountCents: 1 }],
    });
    const id = b.orders[0]!.id;
    try {
      s.transition(b, id, "received"); // can't skip sent
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });

  it("rolls up committed vs budget by chapter and flags over-budget", () => {
    const s = svc();
    let b = s.raise(s.empty(), {
      supplierRef: "S1",
      projectRef: "prj_1",
      lines: [{ chapter: "A", description: "x", amountCents: 120_000 }],
    });
    b = s.transition(b, b.orders[0]!.id, "sent");
    const rollup = s.commitmentByChapter(b, [{ chapter: "A", budgetCents: 100_000 }], "prj_1");
    const a = rollup.find((c) => c.chapter === "A")!;
    expect(a.committedCents).toBe(120_000);
    expect(a.overBudget).toBe(true);
  });
});

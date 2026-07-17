import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import { projectsConfigSchema } from "./model";
import { ProjectsService } from "./service";

function svc() {
  return new ProjectsService({
    clock: new FixedClock("2026-07-17"),
    idGen: new SeqIdGen(),
    config: projectsConfigSchema.parse({}),
  });
}

const baseline = [
  { chapter: "A", budgetCents: 100_000 },
  { chapter: "B", budgetCents: 50_000 },
];

describe("ProjectsService baseline", () => {
  it("creates a project from an accepted quote with a frozen baseline", () => {
    const p = svc().fromAcceptedQuote({
      name: "Reno 1",
      sourceQuoteId: "q1",
      baselineByChapter: baseline,
    });
    expect(p.baselineCents).toBe(150_000);
    expect(p.status).toBe("active");
    expect(p.sourceQuoteId).toBe("q1");
  });

  it("refuses an empty baseline", () => {
    try {
      svc().fromAcceptedQuote({ name: "x", baselineByChapter: [] });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });
});

describe("cost + change orders + financials", () => {
  it("tracks committed/actual and computes margin, keeping the baseline", () => {
    const s = svc();
    let p = s.fromAcceptedQuote({ name: "Reno", baselineByChapter: baseline });
    p = s.bookCost(p, {
      kind: "committed",
      chapter: "A",
      description: "PO tiles",
      amountCents: 60_000,
    });
    p = s.bookCost(p, {
      kind: "actual",
      chapter: "A",
      description: "bill tiles",
      amountCents: 58_000,
    });
    p = s.bookCost(p, { kind: "actual", chapter: "B", description: "labour", amountCents: 40_000 });
    p = s.recordRevenue(p, 150_000);

    const f = s.financials(p);
    expect(f.baselineCents).toBe(150_000); // untouched
    expect(f.committedCents).toBe(60_000);
    expect(f.actualCents).toBe(98_000);
    expect(f.marginCents).toBe(52_000); // 150k revenue − 98k actual
    expect(f.currentBudgetCents).toBe(150_000); // no approved changes yet
  });

  it("approved change orders adjust current budget but never the baseline", () => {
    const s = svc();
    let p = s.fromAcceptedQuote({ name: "Reno", baselineByChapter: baseline });
    p = s.proposeChange(p, { chapter: "A", description: "extra wall", deltaCents: 20_000 });
    const changeId = p.changeOrders[0]!.id;
    p = s.decideChange(p, changeId, true);

    const f = s.financials(p);
    expect(f.baselineCents).toBe(150_000); // baseline preserved (CHG requirement)
    expect(f.approvedChangesCents).toBe(20_000);
    expect(f.currentBudgetCents).toBe(170_000);
  });

  it("reports quoted-vs-actual variance per chapter", () => {
    const s = svc();
    let p = s.fromAcceptedQuote({ name: "Reno", baselineByChapter: baseline });
    p = s.bookCost(p, { kind: "actual", chapter: "A", description: "over", amountCents: 120_000 });
    const v = s.marginByChapter(p).find((c) => c.chapter === "A")!;
    expect(v.budgetCents).toBe(100_000);
    expect(v.actualCents).toBe(120_000);
    expect(v.varianceCents).toBe(20_000); // 20k over budget
    expect(v.varianceBp).toBe(2000); // +20%
  });

  it("flags margin below the configured floor", () => {
    const s = new ProjectsService({
      clock: new FixedClock("2026-07-17"),
      idGen: new SeqIdGen(),
      config: projectsConfigSchema.parse({ marginFloorBp: 1500 }),
    });
    let p = s.fromAcceptedQuote({ name: "Thin", baselineByChapter: baseline });
    p = s.bookCost(p, { kind: "actual", chapter: "A", description: "cost", amountCents: 140_000 });
    p = s.recordRevenue(p, 150_000);
    const f = s.financials(p);
    expect(f.marginBp).toBeLessThan(1500);
    expect(f.marginBelowFloor).toBe(true);
  });
});

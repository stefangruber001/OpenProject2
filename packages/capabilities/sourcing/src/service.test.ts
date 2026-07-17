import { FixedClock, InMemoryEventLog, InMemoryRepository, SeqIdGen } from "@repo/kernel";
import { describe, expect, it } from "vitest";
import type { Comparison } from "./model";
import { SourcingService } from "./service";

function service() {
  return new SourcingService({
    tenantId: "t1",
    store: new InMemoryRepository<Comparison>(),
    clock: new FixedClock("2026-07-17"),
    idGen: new SeqIdGen(),
    events: new InMemoryEventLog(),
  });
}

/**
 * Mirrors the real evidence workbook shape: an initial study as baseline,
 * two competing bidders, grouped lines, one optional line, one missing price.
 */
async function seeded() {
  const svc = service();
  const c = await svc.create("Comparativa obra 57", {
    baselineBidder: { id: "study", name: "Estudio inicial" },
  });
  await svc.addBidder(c.id, { id: "b1", name: "Contratista A" });
  await svc.addBidder(c.id, { id: "b2", name: "Contratista B" });

  const l1 = await svc.addLine(c.id, {
    group: "G1",
    description: "demolition works",
    unit: "m²",
    qtyMillis: 10_000, // 10
  });
  const l2 = await svc.addLine(c.id, {
    group: "G1",
    description: "wall finish",
    unit: "m²",
    qtyMillis: 20_000, // 20
  });
  const l3 = await svc.addLine(c.id, {
    group: "G2",
    description: "premium fixture",
    unit: "ud",
    qtyMillis: 1000, // 1
    optional: true,
  });

  // baseline prices: 10×10.00 + 20×20.00 = 500.00 base; optional 300.00
  await svc.setPrice(c.id, l1.id, "study", { unitCents: 1000, source: "estudio" });
  await svc.setPrice(c.id, l2.id, "study", { unitCents: 2000, source: "estudio" });
  await svc.setPrice(c.id, l3.id, "study", { unitCents: 30_000, source: "estudio" });
  // bidder 1: 10×9.00 + 20×22.00 = 530.00 (+6%); optional missing
  await svc.setPrice(c.id, l1.id, "b1", {
    unitCents: 900,
    source: "portal",
    effectiveDate: "2026-07-01",
  });
  await svc.setPrice(c.id, l2.id, "b1", { unitCents: 2200, source: "portal" });
  // bidder 2: l1 missing; l2 20×15.00 = 300.00; optional 250.00
  await svc.setPrice(c.id, l2.id, "b2", { unitCents: 1500, source: "invoice 2026-044" });
  await svc.setPrice(c.id, l3.id, "b2", { unitCents: 25_000, source: "quote" });

  return { svc, c, l1, l2, l3 };
}

describe("sourcing comparison", () => {
  it("totals per bidder exclude optional lines and count missing prices", async () => {
    const { svc, c } = await seeded();
    const report = await svc.report(c.id);
    const [study, b1, b2] = report.totals;
    expect(study).toMatchObject({
      bidderId: "study",
      baseTotalCents: 50_000,
      optionalTotalCents: 30_000,
      missingCount: 0,
    });
    expect(b1).toMatchObject({ baseTotalCents: 53_000, optionalTotalCents: 0, missingCount: 1 });
    expect(b2).toMatchObject({
      baseTotalCents: 30_000,
      optionalTotalCents: 25_000,
      missingCount: 1,
    });
  });

  it("computes absolute and percentage variance vs the baseline bidder", async () => {
    const { svc, c } = await seeded();
    const report = await svc.report(c.id);
    const b1 = report.totals.find((t) => t.bidderId === "b1")!;
    expect(b1.varianceCents).toBe(3000); // +30.00
    expect(b1.variancePctBp).toBe(600); // +6.00 %
    const study = report.totals.find((t) => t.bidderId === "study")!;
    expect(study.varianceCents).toBeUndefined();
  });

  it("missing prices are missing — never zero — at line level", async () => {
    const { svc, c, l1 } = await seeded();
    const report = await svc.report(c.id);
    const row = report.lines.find((r) => r.line.id === l1.id)!;
    const b2cell = row.cells.find((x) => x.bidderId === "b2")!;
    expect(b2cell.missing).toBe(true);
    expect(b2cell.totalCents).toBeUndefined();
    expect(b2cell.varianceCents).toBeUndefined();
  });

  it("groups aggregate per group with their own variance", async () => {
    const { svc, c } = await seeded();
    const report = await svc.report(c.id);
    const g1 = report.groups.find((g) => g.group === "G1")!;
    const g1b1 = g1.totals.find((t) => t.bidderId === "b1")!;
    expect(g1b1.baseTotalCents).toBe(53_000);
    expect(g1b1.variancePctBp).toBe(600);
    const g2 = report.groups.find((g) => g.group === "G2")!;
    expect(g2.totals.find((t) => t.bidderId === "study")!.optionalTotalCents).toBe(30_000);
  });

  it("selection is explicit, requires a recorded price, and totals selected cost", async () => {
    const { svc, c, l1, l2 } = await seeded();
    await expect(svc.select(c.id, l1.id, "b2")).rejects.toThrowError(/no price recorded/);
    await svc.select(c.id, l1.id, "b1"); // 90.00
    await svc.select(c.id, l2.id, "b2"); // 300.00
    const report = await svc.report(c.id);
    expect(report.selectedBaseTotalCents).toBe(39_000);
    expect(report.selectedMissingCount).toBe(0);
    expect(report.lines.find((r) => r.line.id === l1.id)!.selectedBidderId).toBe("b1");
    expect((await svc.get(c.id)).status).toBe("selected");
  });

  it("prices retain source and effective date (dated evidence)", async () => {
    const { svc, c, l1 } = await seeded();
    const stored = await svc.get(c.id);
    expect(stored.prices[l1.id]!["b1"]).toMatchObject({
      unitCents: 900,
      source: "portal",
      effectiveDate: "2026-07-01",
    });
  });
});

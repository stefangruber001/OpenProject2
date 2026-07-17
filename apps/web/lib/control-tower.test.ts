import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, resolveTenant } from "@repo/kernel";
import { buildServices, registries } from "@repo/factory";
import { controlTower } from "./control-tower";

/** Integration: the control tower computed by the real capability services
 *  over the in-memory aggregate KV — the same wiring the live app uses. */
function runtime() {
  const spec = {
    tenant: "test-ct",
    kernel: "^1",
    capabilities: [
      "crm",
      "projects",
      "receivables",
      "payables",
      "procurement",
      "scheduling",
      "time",
      "docs",
      "visits",
      "access",
    ],
    config: {
      locale: "es-ES",
      currency: "EUR",
      branding: { legalName: "Test Co" },
      access: {
        roles: { owner: ["*"], administration: ["invoice.issue"], operations: ["visit.record"] },
      },
    },
  };
  const resolved = resolveTenant(spec, registries);
  return buildServices(resolved, { clock: new FixedClock("2026-07-17"), idGen: new SeqIdGen() });
}

describe("controlTower", () => {
  it("seeds and computes the overview from the real services", async () => {
    const rt = runtime();
    const ov = await controlTower(rt);

    // projects financials (revenue 2872.00 − actual 2060.00 = 812.00 margin)
    expect(ov.projects[0]!.revenueCents).toBe(287_200);
    expect(ov.projects[0]!.actualCents).toBe(206_000);
    expect(ov.projects[0]!.marginCents).toBe(81_200);

    // AR / AP outstanding
    expect(ov.receivablesOutstandingCents).toBe(168_720); // 368720 − 200000
    expect(ov.payablesOutstandingCents).toBe(148_000); // plumb unpaid; tiles paid

    // procurement committed for the project (PO sent)
    expect(ov.committedCents).toBe(150_000);

    // scheduling: tiling + inspection are past 2026-07-17 and not done
    expect(ov.overdueTasks).toHaveLength(2);

    // access roles from tenant data
    expect(ov.access.wifeCanIssueInvoice).toBe(true);
    expect(ov.access.husbandCanIssueInvoice).toBe(false);
    expect(ov.access.husbandCanRecordVisit).toBe(true);

    // pipeline has the quoted lead
    expect(ov.pipeline.find((p) => p.stage === "quoted")!.count).toBe(1);
  });

  it("persists aggregates: a second call reads the same seeded data back", async () => {
    const rt = runtime();
    const first = await controlTower(rt);
    const second = await controlTower(rt);
    expect(second.projects[0]!.id).toBe(first.projects[0]!.id); // same ids → not reseeded
    expect(second.receivablesOutstandingCents).toBe(first.receivablesOutstandingCents);
  });
});

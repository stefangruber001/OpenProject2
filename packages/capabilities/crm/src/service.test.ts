import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import { crmConfigSchema } from "./model";
import { CrmService } from "./service";

function svc(date = "2026-07-17") {
  return new CrmService({
    clock: new FixedClock(date),
    idGen: new SeqIdGen(),
    config: crmConfigSchema.parse({}),
  });
}

describe("CrmService", () => {
  it("registers a customer and opens a lead at the first pipeline stage", () => {
    const s = svc();
    let b = s.empty();
    b = s.addCustomer(b, { name: "Ana", email: "ana@example.com" });
    b = s.addLead(b, {
      title: "Bathroom reno",
      customerRef: b.customers[0]!.id,
      valueCents: 500_000,
    });
    expect(b.leads[0]!.stage).toBe("new");
    expect(b.leads[0]!.status).toBe("open");
  });

  it("moves a lead only to a valid stage", () => {
    const s = svc();
    let b = s.addLead(s.empty(), { title: "X" });
    const id = b.leads[0]!.id;
    b = s.moveLead(b, id, "quoted");
    expect(b.leads[0]!.stage).toBe("quoted");
    try {
      s.moveLead(b, id, "nonsense");
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });

  it("surfaces overdue next actions", () => {
    const s = svc("2026-07-17");
    let b = s.empty();
    b = s.addLead(b, { title: "Call back", nextAction: "Call", nextActionDate: "2026-07-10" });
    b = s.addLead(b, { title: "Future", nextAction: "Email", nextActionDate: "2026-08-01" });
    const overdue = s.overdueActions(b);
    expect(overdue).toHaveLength(1);
    expect(overdue[0]!.title).toBe("Call back");
  });

  it("summarises the pipeline by stage, excluding closed leads", () => {
    const s = svc();
    let b = s.empty();
    b = s.addLead(b, { title: "A", valueCents: 100 });
    b = s.addLead(b, { title: "B", valueCents: 200 });
    b = s.moveLead(b, b.leads[1]!.id, "qualified");
    b = s.closeLead(b, b.leads[0]!.id, true); // won → excluded from open pipeline
    const pipe = s.pipeline(b);
    expect(pipe.find((p) => p.stage === "new")!.count).toBe(0);
    expect(pipe.find((p) => p.stage === "qualified")!.count).toBe(1);
    expect(pipe.find((p) => p.stage === "qualified")!.valueCents).toBe(200);
  });
});

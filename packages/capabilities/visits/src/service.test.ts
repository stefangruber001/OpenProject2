import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import { visitsConfigSchema } from "./model";
import { VisitsService } from "./service";

function svc() {
  return new VisitsService({
    clock: new FixedClock("2026-07-17"),
    idGen: new SeqIdGen(),
    config: visitsConfigSchema.parse({}),
  });
}

describe("VisitsService", () => {
  it("records a visit linked to a lead with measurements and photos", () => {
    const s = svc();
    const l = s.record(s.empty(), {
      leadRef: "lead1",
      notes: "Old tiling to strip",
      measurements: [{ room: "Bathroom", lengthMm: 5000, widthMm: 2500 }],
      photoRefs: ["ph1", "ph2"],
    });
    expect(l.visits[0]!.photoRefs).toHaveLength(2);
    expect(s.forLead(l, "lead1")).toHaveLength(1);
  });

  it("requires a customer or lead link", () => {
    const s = svc();
    try {
      s.record(s.empty(), { notes: "orphan" });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });

  it("derives floor area from room measurements", () => {
    const s = svc();
    const l = s.record(s.empty(), {
      customerRef: "c1",
      measurements: [
        { room: "Bathroom", lengthMm: 5000, widthMm: 2500 }, // 12.5 m²
        { room: "Hall", lengthMm: 2000, widthMm: 1500 }, // 3 m²
      ],
    });
    expect(s.areaM2(l.visits[0]!)).toBe(16); // 15.5 → 16 (rounded m²)
  });
});

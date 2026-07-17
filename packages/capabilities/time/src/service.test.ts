import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import { timeConfigSchema } from "./model";
import { TimeService } from "./service";

function svc() {
  return new TimeService({
    clock: new FixedClock("2026-07-17"),
    idGen: new SeqIdGen(),
    config: timeConfigSchema.parse({}),
  });
}

describe("TimeService", () => {
  it("logs minutes and costs them at the entry rate", () => {
    const s = svc();
    let b = s.empty();
    b = s.log(b, {
      projectRef: "p1",
      personRef: "u1",
      chapter: "A",
      minutes: 90,
      ratePerHourCents: 2000,
    });
    expect(s.minutesForProject(b, "p1")).toBe(90);
    expect(s.labourCostForProject(b, "p1")).toBe(3000); // 1.5h × 20.00 = 30.00
  });

  it("rejects non-positive minutes", () => {
    const s = svc();
    try {
      s.log(s.empty(), { projectRef: "p1", personRef: "u1", minutes: 0 });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
    }
  });

  it("rolls up hours and cost by chapter", () => {
    const s = svc();
    let b = s.empty();
    b = s.log(b, {
      projectRef: "p1",
      personRef: "u1",
      chapter: "A",
      minutes: 60,
      ratePerHourCents: 3000,
    });
    b = s.log(b, {
      projectRef: "p1",
      personRef: "u2",
      chapter: "A",
      minutes: 30,
      ratePerHourCents: 3000,
    });
    b = s.log(b, {
      projectRef: "p1",
      personRef: "u1",
      chapter: "B",
      minutes: 120,
      ratePerHourCents: 2000,
    });
    const a = s.byChapter(b, "p1").find((c) => c.chapter === "A")!;
    expect(a.minutes).toBe(90);
    expect(a.costCents).toBe(4500); // 1.5h × 30.00
    const bch = s.byChapter(b, "p1").find((c) => c.chapter === "B")!;
    expect(bch.costCents).toBe(4000); // 2h × 20.00
  });
});

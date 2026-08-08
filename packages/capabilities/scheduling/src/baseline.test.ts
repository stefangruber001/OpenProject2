import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import type { WorkCalendar } from "./calendar";
import { schedulingConfigSchema } from "./model";
import { SchedulingService } from "./service";

const fiveDay: WorkCalendar = {
  workingWeekdays: [1, 2, 3, 4, 5],
  // A closure long enough to prove drift is counted in working days.
  nonWorkingDates: ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"],
};

function svc() {
  return new SchedulingService({
    clock: new FixedClock("2026-08-03"),
    idGen: new SeqIdGen(),
    config: schedulingConfigSchema.parse({}),
  });
}

function approvedPlan(s: SchedulingService) {
  let p = s.setCalendar(s.empty(), fiveDay);
  p = s.addTask(p, {
    title: "Strip out",
    plannedStart: "2026-08-03",
    plannedEnd: "2026-08-04",
    durationDays: 2,
  });
  p = s.addTask(p, {
    title: "First fix",
    plannedStart: "2026-08-03",
    plannedEnd: "2026-08-04",
    durationDays: 3,
  });
  p = s.link(p, { predecessorId: p.tasks[0]!.id, successorId: p.tasks[1]!.id });
  p = s.recalculate(p, "2026-08-03");
  return s.freezeBaseline(p, "approved");
}

describe("baselines", () => {
  it("freezes the plan as approved and reports no drift against itself", () => {
    const s = svc();
    const p = approvedPlan(s);
    const bl = p.baselines![0]!;
    expect(bl.label).toBe("approved");
    expect(bl.frozenAt).toBe("2026-08-03");
    expect(bl.tasks).toHaveLength(2);

    const cmp = s.compareToBaseline(p);
    expect(cmp.finishDriftDays).toBe(0);
    expect(cmp.tasks.every((t) => t.status === "on_plan")).toBe(true);
  });

  it("measures slippage in working days, not calendar days", () => {
    const s = svc();
    let p = approvedPlan(s);
    const first = p.tasks[0]!.id;
    // Push the first task one working day later; a full week of closure sits
    // in the middle of the plan, so calendar days would exaggerate the slip.
    p = s.recalculate(s.moveTask(p, first, "2026-08-04"), "2026-08-03");
    const cmp = s.compareToBaseline(p);
    expect(cmp.finishDriftDays).toBe(1);
    expect(cmp.tasks.find((t) => t.taskId === first)!.status).toBe("late");
    expect(cmp.tasks.find((t) => t.taskId === first)!.startDriftDays).toBe(1);
    // The calendar-day gap between baseline finish and current finish is far
    // larger than the working-day drift the comparison reports.
    expect(cmp.currentFinish > cmp.baselineFinish).toBe(true);
  });

  it("reports a shortened task as ahead, and a longer one as late", () => {
    const s = svc();
    let p = approvedPlan(s);
    const second = p.tasks[1]!.id;
    p = s.recalculate(s.setDuration(p, second, 1), "2026-08-03");
    const ahead = s.compareToBaseline(p);
    expect(ahead.tasks.find((t) => t.taskId === second)!.status).toBe("ahead");
    expect(ahead.tasks.find((t) => t.taskId === second)!.durationDriftDays).toBe(-2);

    p = s.recalculate(s.setDuration(p, second, 6), "2026-08-03");
    const late = s.compareToBaseline(p);
    expect(late.tasks.find((t) => t.taskId === second)!.status).toBe("late");
    expect(late.finishDriftDays).toBe(3);
  });

  it("flags tasks added after approval and tasks removed from the plan", () => {
    const s = svc();
    let p = approvedPlan(s);
    p = s.addTask(p, {
      title: "Extra: rewire",
      plannedStart: "2026-08-17",
      plannedEnd: "2026-08-18",
      durationDays: 2,
    });
    const removedId = p.tasks[0]!.id;
    p = { ...p, tasks: p.tasks.filter((t) => t.id !== removedId), dependencies: [] };
    const cmp = s.compareToBaseline(p);
    expect(cmp.tasks.find((t) => t.taskId === removedId)!.status).toBe("removed");
    expect(cmp.tasks.find((t) => t.title === "Extra: rewire")!.status).toBe("added");
  });

  it("keeps baselines append-only and refuses to reuse a label", () => {
    const s = svc();
    const p = approvedPlan(s);
    try {
      s.freezeBaseline(p, "approved");
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "IMMUTABLE")).toBe(true);
    }
    // A second, differently-labelled baseline is fine and becomes the default
    // comparison target, while the first stays reachable by id.
    const twice = s.freezeBaseline(p, "signed contract", "2026-08-17");
    expect(twice.baselines).toHaveLength(2);
    expect(s.compareToBaseline(twice).label).toBe("signed contract");
    expect(s.compareToBaseline(twice, twice.baselines![0]!.id).label).toBe("approved");
  });

  it("refuses to compare a plan that was never frozen", () => {
    const s = svc();
    try {
      s.compareToBaseline(s.empty());
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "NOT_FOUND")).toBe(true);
    }
  });

  it("never lets a later edit change what was frozen", () => {
    const s = svc();
    let p = approvedPlan(s);
    const snapshot = JSON.stringify(p.baselines![0]);
    p = s.recalculate(s.setDuration(p, p.tasks[0]!.id, 9), "2026-08-03");
    p = s.setStatus(p, p.tasks[0]!.id, "done");
    expect(JSON.stringify(p.baselines![0])).toBe(snapshot);
  });
});

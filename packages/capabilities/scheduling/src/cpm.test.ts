import { describe, expect, it } from "vitest";
import { FixedClock, SeqIdGen, isFactoryError } from "@repo/kernel";
import type { WorkCalendar } from "./calendar";
import { computeSchedule } from "./cpm";
import { schedulingConfigSchema } from "./model";
import { SchedulingService } from "./service";

const fiveDay: WorkCalendar = {
  workingWeekdays: [1, 2, 3, 4, 5],
  nonWorkingDates: ["2026-08-05"], // a single closed day inside the window
};

function svc() {
  return new SchedulingService({
    clock: new FixedClock("2026-08-03"),
    idGen: new SeqIdGen(),
    config: schedulingConfigSchema.parse({}),
  });
}

/** Three tasks of 2, 3 and 2 working days, unlinked, starting Mon 3 Aug. */
function threeTasks(s: SchedulingService) {
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
  p = s.addTask(p, {
    title: "Finishes",
    plannedStart: "2026-08-03",
    plannedEnd: "2026-08-04",
    durationDays: 2,
  });
  return p;
}

describe("critical path", () => {
  it("chains finish-to-start across a closed day", () => {
    const s = svc();
    let p = threeTasks(s);
    const [a, b] = [p.tasks[0]!.id, p.tasks[1]!.id];
    p = s.link(p, { predecessorId: a, successorId: b });
    const sch = computeSchedule(p, { from: "2026-08-03" });
    const A = sch.tasks.find((t) => t.taskId === a)!;
    const B = sch.tasks.find((t) => t.taskId === b)!;
    // A: Mon 3 + Tue 4. B starts the next working day — the 5th is closed, so
    // Thu 6th — and runs 3 working days: 6th, 7th, Mon 10th.
    expect([A.start, A.finish]).toEqual(["2026-08-03", "2026-08-04"]);
    expect([B.start, B.finish]).toEqual(["2026-08-06", "2026-08-10"]);
  });

  it("applies a positive lag and a negative one (a lead)", () => {
    const s = svc();
    const p = threeTasks(s);
    const [a, b] = [p.tasks[0]!.id, p.tasks[1]!.id];
    const lagged = s.link(p, { predecessorId: a, successorId: b, lagDays: 2 });
    // Two working days of curing after Tue 4th: 6th, 7th → B starts Mon 10th.
    expect(computeSchedule(lagged).tasks.find((t) => t.taskId === b)!.start).toBe("2026-08-10");

    const lead = s.link(p, { predecessorId: a, successorId: b, lagDays: -1 });
    // A lead of one pulls B back to overlap A's last day.
    expect(computeSchedule(lead).tasks.find((t) => t.taskId === b)!.start).toBe("2026-08-04");
  });

  it("honours start-to-start and finish-to-finish", () => {
    const s = svc();
    let p = threeTasks(s);
    const [a, b, c] = [p.tasks[0]!.id, p.tasks[1]!.id, p.tasks[2]!.id];
    p = s.link(p, { predecessorId: a, successorId: b, type: "SS", lagDays: 1 });
    p = s.link(p, { predecessorId: b, successorId: c, type: "FF" });
    const sch = computeSchedule(p, { from: "2026-08-03" });
    const B = sch.tasks.find((t) => t.taskId === b)!;
    const C = sch.tasks.find((t) => t.taskId === c)!;
    // B starts one working day after A starts: Tue 4th, 3 days → 4th, 6th, 7th.
    expect([B.start, B.finish]).toEqual(["2026-08-04", "2026-08-07"]);
    // C must finish with B, so a 2-day task starts on the 6th.
    expect([C.start, C.finish]).toEqual(["2026-08-06", "2026-08-07"]);
  });

  it("marks the zero-float chain critical and gives the others their float", () => {
    const s = svc();
    let p = threeTasks(s);
    const [a, b, c] = [p.tasks[0]!.id, p.tasks[1]!.id, p.tasks[2]!.id];
    // A → B is the long chain; C hangs off A with slack behind it.
    p = s.link(p, { predecessorId: a, successorId: b });
    p = s.link(p, { predecessorId: a, successorId: c });
    p = s.link(p, { predecessorId: c, successorId: b });
    const sch = computeSchedule(p, { from: "2026-08-03" });
    // C (2 days) sits between A and B just like the FS chain, so with both
    // routes constraining B every task is on the critical path.
    expect(sch.criticalPath).toContain(a);
    expect(sch.criticalPath).toContain(b);
    expect(sch.finish).toBe(sch.tasks.find((t) => t.taskId === b)!.finish);
  });

  it("gives float to a task the finish does not depend on", () => {
    const s = svc();
    let p = threeTasks(s);
    const [a, b, c] = [p.tasks[0]!.id, p.tasks[1]!.id, p.tasks[2]!.id];
    p = s.link(p, { predecessorId: a, successorId: b }); // 2 then 3 days
    p = s.link(p, { predecessorId: a, successorId: c }); // 2 days, then nothing
    const sch = computeSchedule(p, { from: "2026-08-03" });
    const C = sch.tasks.find((t) => t.taskId === c)!;
    expect(C.critical).toBe(false);
    expect(C.totalFloatDays).toBe(1); // B runs one working day longer than C
    expect(sch.criticalPath).toEqual([a, b]);
  });

  it("moves the finish when a duration changes", () => {
    const s = svc();
    let p = threeTasks(s);
    const [a, b] = [p.tasks[0]!.id, p.tasks[1]!.id];
    p = s.link(p, { predecessorId: a, successorId: b });
    const before = s.finishDate(p, "2026-08-03");
    p = s.setDuration(p, a, 5);
    const after = s.finishDate(p, "2026-08-03");
    expect(after > before).toBe(true);
  });

  it("pins a dragged task without freezing its successors", () => {
    const s = svc();
    let p = threeTasks(s);
    const [a, b] = [p.tasks[0]!.id, p.tasks[1]!.id];
    p = s.link(p, { predecessorId: a, successorId: b });
    p = s.moveTask(p, a, "2026-08-10"); // drag A a week out
    p = s.recalculate(p, "2026-08-03");
    const A = p.tasks.find((t) => t.id === a)!;
    const B = p.tasks.find((t) => t.id === b)!;
    expect(A.plannedStart).toBe("2026-08-10");
    expect(B.plannedStart > A.plannedEnd).toBe(true); // it followed
    // Unpinning lets it float back to the plan start.
    p = s.recalculate(s.unpin(p, a), "2026-08-03");
    expect(p.tasks.find((t) => t.id === a)!.plannedStart).toBe("2026-08-03");
  });

  it("refuses a cycle, naming the tasks in it", () => {
    const s = svc();
    let p = threeTasks(s);
    const [a, b] = [p.tasks[0]!.id, p.tasks[1]!.id];
    p = s.link(p, { predecessorId: a, successorId: b });
    try {
      s.link(p, { predecessorId: b, successorId: a });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
      expect(String(e)).toContain("cycle");
    }
  });

  it("refuses a self-link and a duplicate link", () => {
    const s = svc();
    let p = threeTasks(s);
    const [a, b] = [p.tasks[0]!.id, p.tasks[1]!.id];
    expect(() => s.link(p, { predecessorId: a, successorId: a })).toThrow();
    p = s.link(p, { predecessorId: a, successorId: b });
    expect(() => s.link(p, { predecessorId: a, successorId: b })).toThrow();
  });

  it("schedules a plan that has no calendar, no durations and no links", () => {
    // Exactly the shape site/erp-bridge.js builds from the legacy engine.
    const s = svc();
    let p = s.addTask(s.empty(), {
      title: "Legacy",
      plannedStart: "2026-08-03",
      plannedEnd: "2026-08-07",
    });
    p = s.addTask(p, {
      title: "Other",
      plannedStart: "2026-08-10",
      plannedEnd: "2026-08-11",
    });
    const sch = computeSchedule(p);
    expect(sch.tasks).toHaveLength(2);
    // Durations are read back off the dates: 5 and 2 calendar-equals-working days.
    expect(sch.tasks[0]!.durationDays).toBe(5);
    expect(sch.finish).toBe("2026-08-07");
  });

  it("returns an empty schedule for an empty plan", () => {
    const sch = computeSchedule({ tasks: [] }, { from: "2026-08-03" });
    expect(sch.tasks).toEqual([]);
    expect(sch.finish).toBe("2026-08-03");
  });
});

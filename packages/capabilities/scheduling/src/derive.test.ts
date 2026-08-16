import { describe, expect, it } from "vitest";
import { mergeDerivedPlan, planFromWorkBreakdown, type WorkItem } from "./derive";
import { computeSchedule } from "./cpm";
import type { WorkCalendar } from "./calendar";

const fiveDay: WorkCalendar = { workingWeekdays: [1, 2, 3, 4, 5], nonWorkingDates: [] };

const item = (over: Partial<WorkItem> & { ref: string; groupNum: string }): WorkItem => ({
  groupName: `Group ${over.groupNum}`,
  title: `Item ${over.ref}`,
  ...over,
});

describe("plan from a work breakdown", () => {
  it("derives a duration from quantity and rate, rounding up", () => {
    const d = planFromWorkBreakdown(
      [item({ ref: "a", groupNum: "1", quantity: 45, unit: "m2", ratePerDay: 20 })],
      { from: "2026-09-07", calendar: fiveDay, granularity: "item" },
    );
    // 45 ÷ 20 = 2.25 → 3. Half a day of work still occupies a day on site.
    expect(d.notes[0]).toMatchObject({ durationDays: 3, basis: "quantity" });
  });

  it("prefers an explicit duration over anything it could derive", () => {
    const d = planFromWorkBreakdown(
      [item({ ref: "a", groupNum: "1", quantity: 100, ratePerDay: 1, durationDays: 2 })],
      { from: "2026-09-07", calendar: fiveDay, granularity: "item" },
    );
    expect(d.notes[0]).toMatchObject({ durationDays: 2, basis: "explicit" });
  });

  it("falls back to the default and says so", () => {
    const d = planFromWorkBreakdown([item({ ref: "a", groupNum: "1" })], {
      from: "2026-09-07",
      calendar: fiveDay,
      granularity: "item",
      defaultDurationDays: 4,
    });
    expect(d.notes[0]).toMatchObject({ durationDays: 4, basis: "default" });
  });

  it("chains items finish-to-start in document order", () => {
    const d = planFromWorkBreakdown(
      [
        item({ ref: "c", groupNum: "2", itemNum: "2.1", durationDays: 1 }),
        item({ ref: "b", groupNum: "1", itemNum: "1.10", durationDays: 1 }),
        item({ ref: "a", groupNum: "1", itemNum: "1.9", durationDays: 1 }),
      ],
      { from: "2026-09-07", calendar: fiveDay, granularity: "item" },
    );
    // 1.10 after 1.9 — numeric, not lexical, or the chart contradicts the quote.
    expect(d.plan.tasks.map((t) => t.sourceRef)).toEqual(["a", "b", "c"]);
    expect(d.plan.dependencies).toHaveLength(2);
    const sch = computeSchedule(d.plan, { from: "2026-09-07" });
    const starts = sch.tasks.map((t) => t.start);
    expect(starts).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
  });

  it("groups by default, adding up the items inside each group", () => {
    const d = planFromWorkBreakdown(
      [
        item({ ref: "a", groupNum: "1", itemNum: "1.1", durationDays: 2 }),
        item({ ref: "b", groupNum: "1", itemNum: "1.2", durationDays: 3 }),
        item({ ref: "c", groupNum: "2", itemNum: "2.1", durationDays: 4 }),
      ],
      { from: "2026-09-07", calendar: fiveDay },
    );
    expect(d.plan.tasks).toHaveLength(2);
    expect(d.plan.tasks[0]).toMatchObject({ durationDays: 5, sourceRef: "group:1" });
    expect(d.plan.tasks[1]).toMatchObject({ durationDays: 4, sourceRef: "group:2" });
  });

  it("overlaps groups when asked, and not otherwise", () => {
    const items = [
      item({ ref: "a", groupNum: "1", durationDays: 5 }),
      item({ ref: "b", groupNum: "2", durationDays: 5 }),
    ];
    const flush = planFromWorkBreakdown(items, { from: "2026-09-07", calendar: fiveDay });
    expect(flush.plan.dependencies![0]!.lagDays).toBe(0);
    const lapped = planFromWorkBreakdown(items, {
      from: "2026-09-07",
      calendar: fiveDay,
      groupLagDays: -2,
    });
    expect(lapped.plan.dependencies![0]!.lagDays).toBe(-2);
    const a = computeSchedule(flush.plan, { from: "2026-09-07" }).finish;
    const b = computeSchedule(lapped.plan, { from: "2026-09-07" }).finish;
    expect(b < a).toBe(true);
  });

  it("gives the same ids for the same breakdown, twice", () => {
    const items = [item({ ref: "a", groupNum: "1", durationDays: 1 })];
    const one = planFromWorkBreakdown(items, { from: "2026-09-07", calendar: fiveDay });
    const two = planFromWorkBreakdown(items, { from: "2026-09-07", calendar: fiveDay });
    // Repeatability is the whole reason ids come from refs: without it a
    // re-derivation could not be merged with what the site had recorded.
    expect(one.plan.tasks.map((t) => t.id)).toEqual(two.plan.tasks.map((t) => t.id));
  });

  it("leaves out what it was told to leave out, and says which", () => {
    const d = planFromWorkBreakdown(
      [
        item({ ref: "a", groupNum: "1", durationDays: 1 }),
        item({ ref: "skipme", groupNum: "1", durationDays: 1, skip: true }),
        { ref: "untitled", groupNum: "1", groupName: "G", title: "" },
      ],
      { from: "2026-09-07", calendar: fiveDay, granularity: "item" },
    );
    expect(d.plan.tasks).toHaveLength(1);
    expect(d.skipped.sort()).toEqual(["skipme", "untitled"]);
  });

  it("starts on a working day even when told to start on a closed one", () => {
    // 2026-09-06 is a Sunday.
    const d = planFromWorkBreakdown([item({ ref: "a", groupNum: "1", durationDays: 1 })], {
      from: "2026-09-06",
      calendar: fiveDay,
    });
    expect(d.plan.tasks[0]!.plannedStart).toBe("2026-09-07");
  });
});

describe("re-deriving over an existing plan", () => {
  const items = [
    item({ ref: "a", groupNum: "1", durationDays: 2 }),
    item({ ref: "b", groupNum: "2", durationDays: 2 }),
  ];

  it("keeps progress, pins and baselines for tasks that survived", () => {
    const first = planFromWorkBreakdown(items, { from: "2026-09-07", calendar: fiveDay }).plan;
    const lived: typeof first = {
      ...first,
      tasks: first.tasks.map((t, i) =>
        i === 0 ? { ...t, progressPct: 60, status: "in_progress", earliestStart: "2026-09-08" } : t,
      ),
      baselines: [
        {
          id: "bl_1",
          label: "Contract",
          frozenAt: "2026-09-07",
          finish: "2026-09-10",
          tasks: [],
        },
      ],
      progressLog: [{ taskId: first.tasks[0]!.id, date: "2026-09-08", pct: 60 }],
    };

    // The quote changed: group 2 grew, group 3 appeared.
    const redone = planFromWorkBreakdown(
      [...items, item({ ref: "c", groupNum: "3", durationDays: 1 })],
      { from: "2026-09-07", calendar: fiveDay },
    ).plan;
    const merged = mergeDerivedPlan(lived, redone);

    expect(merged.tasks).toHaveLength(3);
    expect(merged.tasks[0]).toMatchObject({
      progressPct: 60,
      status: "in_progress",
      earliestStart: "2026-09-08",
    });
    expect(merged.tasks[2]!.progressPct).toBe(0);
    // A promise already made is not re-derivable.
    expect(merged.baselines).toHaveLength(1);
    expect(merged.progressLog).toHaveLength(1);
  });

  it("drops what the new breakdown no longer contains", () => {
    const first = planFromWorkBreakdown(items, { from: "2026-09-07", calendar: fiveDay }).plan;
    const redone = planFromWorkBreakdown([items[0]!], {
      from: "2026-09-07",
      calendar: fiveDay,
    }).plan;
    expect(mergeDerivedPlan(first, redone).tasks).toHaveLength(1);
  });
});

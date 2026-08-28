import { describe, expect, it } from "vitest";
import { computeSchedule } from "./cpm";
import { planFromWorkBreakdown } from "./derive";
import { progressCurve, riskReport } from "./tracking";
import type { WorkCalendar } from "./calendar";
import type { Plan, ProgressEntry } from "./model";

const fiveDay: WorkCalendar = { workingWeekdays: [1, 2, 3, 4, 5], nonWorkingDates: [] };

/** Four groups of five working days each, chained: Mon 2026-09-07 → 2026-10-02. */
function fourWeeks(): Plan {
  return planFromWorkBreakdown(
    ["1", "2", "3", "4"].map((n) => ({
      ref: n,
      groupNum: n,
      groupName: `G${n}`,
      title: `G${n}`,
      durationDays: 5,
    })),
    { from: "2026-09-07", calendar: fiveDay },
  ).plan;
}

const withProgress = (plan: Plan, pcts: number[], log: ProgressEntry[] = []): Plan => ({
  ...plan,
  tasks: plan.tasks.map((t, i) => ({ ...t, progressPct: pcts[i] ?? 0 })),
  progressLog: log,
});

const sched = (plan: Plan) => computeSchedule(plan, { from: "2026-09-07" });

describe("progress curve", () => {
  it("puts the plan at a quarter after the first of four equal weeks", () => {
    const plan = fourWeeks();
    const c = progressCurve(plan, sched(plan), { asOf: "2026-09-11" });
    expect(c.plannedPct).toBe(25);
    expect(c.actualPct).toBe(0);
    expect(c.driftPct).toBe(-25);
  });

  it("reports being exactly on the curve as an index of one", () => {
    const plan = withProgress(fourWeeks(), [100, 0, 0, 0]);
    const c = progressCurve(plan, sched(plan), { asOf: "2026-09-11" });
    expect(c.actualPct).toBe(25);
    expect(c.performanceIndex).toBe(1);
    expect(c.projectedFinish).toBe(c.plannedFinish);
  });

  /* A10 · a pace needs two points: the fixtures now carry two observation
     dates, because a projection from fewer is withheld by design. */
  it("pushes the finish out when the pace is behind, and pulls it in when ahead", () => {
    const plan = fourWeeks();
    const twoDays = (pct1: number, pct2: number): ProgressEntry[] => [
      { taskId: plan.tasks[0]!.id, date: "2026-09-09", pct: pct1 },
      { taskId: plan.tasks[0]!.id, date: "2026-09-11", pct: pct2 },
    ];
    const behind = progressCurve(withProgress(plan, [50, 0, 0, 0], twoDays(20, 50)), sched(plan), {
      asOf: "2026-09-11",
    });
    expect(behind.performanceIndex).toBeLessThan(1);
    expect(behind.projectedFinish > behind.plannedFinish).toBe(true);

    const ahead = progressCurve(
      withProgress(
        fourWeeks(),
        [100, 100, 0, 0],
        [
          { taskId: plan.tasks[0]!.id, date: "2026-09-09", pct: 100 },
          { taskId: plan.tasks[1]!.id, date: "2026-09-11", pct: 100 },
        ],
      ),
      sched(plan),
      { asOf: "2026-09-11" },
    );
    expect(ahead.performanceIndex).toBeGreaterThan(1);
    expect(ahead.projectedFinish < ahead.plannedFinish).toBe(true);
  });

  it("withholds the projection while the log carries a single day of evidence", () => {
    const plan = withProgress(
      fourWeeks(),
      [50, 0, 0, 0],
      [{ taskId: fourWeeks().tasks[0]!.id, date: "2026-09-11", pct: 50 }],
    );
    const c = progressCurve(plan, sched(plan), { asOf: "2026-09-11", samples: 60 });
    // One observation is not a pace: no projected line, and the finish is
    // the plan's own rather than a forecast nobody made.
    expect(c.points.every((p) => p.projectedPct === null)).toBe(true);
    expect(c.projectedFinish).toBe(c.plannedFinish);
  });

  it("always samples the curve exactly at asOf", () => {
    const plan = withProgress(fourWeeks(), [50, 0, 0, 0]);
    // A sparse sampling step would otherwise skip over today.
    const c = progressCurve(plan, sched(plan), { asOf: "2026-09-16", samples: 3 });
    expect(c.points.some((p) => p.date === "2026-09-16")).toBe(true);
  });

  it("declines to judge a pace before any work was due", () => {
    const plan = fourWeeks();
    const c = progressCurve(plan, sched(plan), { asOf: "2026-09-07" });
    // Nothing was supposed to be finished on day one; being at zero says
    // nothing about anyone, so there is no index to report.
    expect(c.plannedPct).toBeLessThan(10);
    expect(c.performanceIndex === null || c.performanceIndex >= 0).toBe(true);
  });

  it("draws the actual line from the log, not from today's percentage", () => {
    const plan = withProgress(
      fourWeeks(),
      [100, 100, 0, 0],
      [
        { taskId: "task_group_1", date: "2026-09-11", pct: 100 },
        { taskId: "task_group_2", date: "2026-09-18", pct: 100 },
      ],
    );
    const c = progressCurve(plan, sched(plan), { asOf: "2026-09-25", samples: 60 });
    const at = (d: string) => c.points.find((p) => p.date === d);
    // Half the job is done TODAY. On the 11th only a quarter of it was, and a
    // curve that drew today's figure backwards would claim otherwise.
    expect(at("2026-09-11")!.actualPct).toBe(25);
    expect(at("2026-09-18")!.actualPct).toBe(50);
    expect(c.actualPct).toBe(50);
  });

  it("draws the actual line at zero before the first observation", () => {
    const plan = fourWeeks();
    const c = progressCurve(plan, sched(plan), { asOf: "2026-09-25", samples: 60 });
    // A10 · zero, from the plan's start: nothing recorded IS the record, and
    // a chart with no actual line at all read as broken to the person it was
    // drawn for. Beyond asOf the line still ends — the future has no record.
    expect(
      c.points.every((p) => (p.date <= c.asOf ? p.actualPct === 0 : p.actualPct === null)),
    ).toBe(true);
  });

  it("weights by value when the caller knows what each task is worth", () => {
    const plan = withProgress(fourWeeks(), [100, 0, 0, 0]);
    const ids = plan.tasks.map((t) => t.id);
    const c = progressCurve(plan, sched(plan), {
      asOf: "2026-09-11",
      // The first week is worth eight times each of the others.
      weights: { [ids[0]!]: 800, [ids[1]!]: 100, [ids[2]!]: 100, [ids[3]!]: 100 },
    });
    expect(c.actualPct).toBeCloseTo(72.7, 0);
  });

  it("projects forward from where the work actually is, without a jump", () => {
    const base = fourWeeks();
    const plan = withProgress(
      base,
      [50, 0, 0, 0],
      [
        { taskId: base.tasks[0]!.id, date: "2026-09-09", pct: 20 },
        { taskId: base.tasks[0]!.id, date: "2026-09-11", pct: 50 },
      ],
    );
    const c = progressCurve(plan, sched(plan), { asOf: "2026-09-11", samples: 60 });
    const future = c.points.filter((p) => p.projectedPct !== null);
    expect(future.length).toBeGreaterThan(0);
    // The projection starts at today's actual figure, never below it.
    expect(future[0]!.projectedPct!).toBeGreaterThanOrEqual(c.actualPct - 0.1);
    // …and never overtakes the plan while the pace is behind it.
    expect(future.every((p) => p.projectedPct! <= p.plannedPct + 0.1)).toBe(true);
  });

  it("ends the curve on the later of the planned and projected finishes", () => {
    const base = fourWeeks();
    const plan = withProgress(
      base,
      [40, 0, 0, 0],
      [
        { taskId: base.tasks[0]!.id, date: "2026-09-09", pct: 15 },
        { taskId: base.tasks[0]!.id, date: "2026-09-11", pct: 40 },
      ],
    );
    const c = progressCurve(plan, sched(plan), { asOf: "2026-09-11" });
    expect(c.points[c.points.length - 1]!.date).toBe(c.projectedFinish);
  });
});

describe("risk report", () => {
  it("names a task that should have started and has not", () => {
    const plan = fourWeeks();
    const r = riskReport(plan, sched(plan), { asOf: "2026-09-09" });
    const first = r.items.find((i) => i.taskId === "task_group_1");
    expect(first).toMatchObject({ kind: "not_started", critical: true });
    expect(first!.days).toBe(2);
  });

  it("names a task that should have finished and has not", () => {
    const plan = withProgress(fourWeeks(), [40, 0, 0, 0]);
    const r = riskReport(plan, sched(plan), { asOf: "2026-09-16" });
    expect(r.items.find((i) => i.taskId === "task_group_1")!.kind).toBe("overdue");
  });

  it("distinguishes merely behind from not started", () => {
    // Started, some progress, still inside its window but lagging the plan.
    const plan = withProgress(fourWeeks(), [10, 0, 0, 0]);
    const r = riskReport(plan, sched(plan), { asOf: "2026-09-10", tolerancePct: 5 });
    const first = r.items.find((i) => i.taskId === "task_group_1")!;
    expect(first.kind).toBe("behind");
    expect(first.plannedPct).toBeGreaterThan(first.actualPct);
  });

  it("says nothing about work that is finished", () => {
    const plan = withProgress(fourWeeks(), [100, 100, 100, 100]);
    const r = riskReport(plan, sched(plan), { asOf: "2026-10-05" });
    expect(r.items).toEqual([]);
  });

  it("measures the slip against the frozen baseline and its threshold", () => {
    const plan = fourWeeks();
    const withBaseline: Plan = {
      ...plan,
      baselines: [
        {
          id: "bl_1",
          label: "Contract",
          frozenAt: "2026-09-07",
          // The promise was a week earlier than the plan now says.
          finish: "2026-09-25",
          tasks: [],
        },
      ],
    };
    const r = riskReport(withBaseline, sched(withBaseline), {
      asOf: "2026-09-09",
      thresholdDays: 5,
    });
    expect(r.baselineFinish).toBe("2026-09-25");
    expect(r.delayDays).toBe(5);
    expect(r.overThreshold).toBe(true);
  });

  it("reports no slip and no alert when there is no baseline to slip against", () => {
    const plan = fourWeeks();
    const r = riskReport(plan, sched(plan), { asOf: "2026-09-09", thresholdDays: 5 });
    expect(r.baselineFinish).toBeNull();
    expect(r.delayDays).toBe(0);
    expect(r.overThreshold).toBe(false);
  });

  it("puts critical work first, worst slip first within it", () => {
    const plan = withProgress(fourWeeks(), [0, 0, 0, 0]);
    const r = riskReport(plan, sched(plan), { asOf: "2026-09-30" });
    expect(r.items.length).toBeGreaterThan(1);
    expect(r.items[0]!.critical).toBe(true);
    expect(r.items[0]!.days).toBeGreaterThanOrEqual(r.items[1]!.days);
    expect(r.criticalAtRisk).toBe(r.items.filter((i) => i.critical).length);
  });
});

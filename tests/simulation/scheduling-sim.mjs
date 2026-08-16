// =============================================================================
// Drives the CALENDAR / CPM / BASELINE engine through the COMMITTED browser
// artifact (site/erp-factory.cjs), not through the TypeScript sources.
//
// The capability's own vitest suite proves the maths. This proves the thing
// the phones actually load carries that maths: the bundle is generated,
// committed and served from a bare checkout with no Node, so "the source is
// right" and "the artifact is right" are two different claims. Session 2
// learned that the hard way with tree-shaking; this is the same guard one
// layer up.
//
// Run: node tests/simulation/scheduling-sim.mjs
// =============================================================================
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const F = require("../../site/erp-factory.cjs");

const checks = [];
const assert = (cond, name, detail) =>
  checks.push({ name, pass: !!cond, detail: cond ? "" : String(detail || "") });
const eq = (actual, expected, name) =>
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    name,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
const throws = (fn, name) => {
  try {
    fn();
    checks.push({ name, pass: false, detail: "did not throw" });
  } catch {
    checks.push({ name, pass: true, detail: "" });
  }
};

assert(typeof F.createScheduling === "function", "the bundle exposes createScheduling");
assert(F.SURFACE_VERSION >= 2, "surface version is at least 2 (the engine landed)");

const svc = F.createScheduling().service;

// A five-day week with one closed day in the middle of the window. Both come
// from data — the capability itself knows no country's calendar.
const calendar = {
  workingWeekdays: [1, 2, 3, 4, 5],
  nonWorkingDates: ["2026-08-05"],
};

let plan = svc.setCalendar(svc.empty(), calendar);
plan = svc.addTask(plan, {
  title: "Strip out",
  plannedStart: "2026-08-03",
  plannedEnd: "2026-08-04",
  durationDays: 2,
});
plan = svc.addTask(plan, {
  title: "First fix",
  plannedStart: "2026-08-03",
  plannedEnd: "2026-08-04",
  durationDays: 3,
});
plan = svc.addTask(plan, {
  title: "Handover",
  plannedStart: "2026-08-03",
  plannedEnd: "2026-08-03",
  milestone: true,
});
const [stripOut, firstFix, handover] = plan.tasks.map((t) => t.id);

plan = svc.link(plan, { predecessorId: stripOut, successorId: firstFix });
plan = svc.link(plan, { predecessorId: firstFix, successorId: handover });
plan = svc.recalculate(plan, "2026-08-03");

const byId = (id) => plan.tasks.find((t) => t.id === id);

// ---- the calendar is respected, not approximated ----------------------------
eq(
  [byId(stripOut).plannedStart, byId(stripOut).plannedEnd],
  ["2026-08-03", "2026-08-04"],
  "a 2-day task starting Monday finishes Tuesday",
);
eq(
  [byId(firstFix).plannedStart, byId(firstFix).plannedEnd],
  ["2026-08-06", "2026-08-10"],
  "its successor steps over the closed day and the weekend",
);
eq(
  [byId(handover).plannedStart, byId(handover).plannedEnd],
  ["2026-08-11", "2026-08-11"],
  "a milestone is a zero-duration point the day after the work ends",
);

// ---- the finish moves on its own -------------------------------------------
const finishBefore = svc.finishDate(plan, "2026-08-03");
const longer = svc.recalculate(svc.setDuration(plan, firstFix, 6), "2026-08-03");
const finishAfter = svc.finishDate(longer, "2026-08-03");
assert(
  finishAfter > finishBefore,
  "stretching a task on the critical path pushes the plan's finish out",
  `${finishBefore} -> ${finishAfter}`,
);

// ---- critical path ----------------------------------------------------------
const critical = svc.criticalPath(plan, "2026-08-03").map((t) => t.title);
eq(critical, ["Strip out", "First fix", "Handover"], "the whole chain is critical");

// ---- dragging a bar pins it, successors follow ------------------------------
const dragged = svc.recalculate(svc.moveTask(plan, stripOut, "2026-08-17"), "2026-08-03");
const draggedFirstFix = dragged.tasks.find((t) => t.id === firstFix);
assert(
  dragged.tasks.find((t) => t.id === stripOut).plannedStart === "2026-08-17" &&
    draggedFirstFix.plannedStart > "2026-08-17",
  "a dragged task holds its date and its successor follows it",
  `${JSON.stringify([dragged.tasks.find((t) => t.id === stripOut).plannedStart, draggedFirstFix.plannedStart])}`,
);

// ---- baselines --------------------------------------------------------------
const approved = svc.freezeBaseline(plan, "approved", "2026-08-03");
const slipped = svc.recalculate(svc.moveTask(approved, stripOut, "2026-08-04"), "2026-08-03");
const drift = svc.compareToBaseline(slipped);
assert(
  drift.finishDriftDays === 1,
  "a one-working-day slip reports as one day",
  drift.finishDriftDays,
);
assert(
  drift.tasks.find((t) => t.taskId === stripOut).status === "late",
  "the slipped task is flagged late",
);
eq(
  JSON.stringify(slipped.baselines[0]),
  JSON.stringify(approved.baselines[0]),
  "the frozen baseline is untouched by everything that happened after it",
);

// ---- the refusals -----------------------------------------------------------
throws(
  () => svc.link(plan, { predecessorId: handover, successorId: stripOut }),
  "a dependency that would close a cycle is refused",
);
throws(
  () => svc.link(plan, { predecessorId: stripOut, successorId: stripOut }),
  "a task cannot depend on itself",
);
throws(
  () => svc.setCalendar(plan, { workingWeekdays: [], nonWorkingDates: [] }),
  "a calendar with no working weekday is refused",
);
throws(
  () => svc.compareToBaseline(svc.empty()),
  "comparing a plan that was never frozen is refused",
);

// ---- the legacy shape still schedules --------------------------------------
// site/erp-bridge.js builds plans with no calendar, no durations and no links.
const legacy = {
  tasks: [
    {
      id: "t1",
      title: "Legacy task",
      plannedStart: "2026-08-03",
      plannedEnd: "2026-08-07",
      status: "planned",
      progressPct: 0,
      milestone: false,
    },
  ],
};
assert(
  svc.finishDate(legacy) === "2026-08-07",
  "a plan in the pre-CPM shape still schedules, unmigrated",
);

// ---- the session-10a additions are in the artifact, not just the sources ----
// Same guard, one layer up: the derivation, the tracking and the cost forecast
// are what the phones will run, and a tree-shaken export is indistinguishable
// from a missing one until something calls it.
{
  const fiveDay = { workingWeekdays: [1, 2, 3, 4, 5], nonWorkingDates: [] };
  const items = [
    {
      ref: "a",
      groupNum: "1",
      groupName: "Strip out",
      title: "Strip out",
      quantity: 45,
      unit: "m2",
      ratePerDay: 20,
    },
    {
      ref: "b",
      groupNum: "2",
      groupName: "Finishes",
      title: "Finishes",
      quantity: 60,
      unit: "m2",
      ratePerDay: 15,
    },
  ];
  const derived = svc.fromWorkBreakdown(items, {
    from: "2026-09-07",
    calendar: fiveDay,
    granularity: "item",
  });
  eq(
    derived.plan.tasks.map((t) => t.durationDays),
    [3, 4],
    "the bundle derives durations from quantity ÷ daily output",
  );
  eq(
    derived.notes.map((n) => n.basis),
    ["quantity", "quantity"],
    "and reports how it got them",
  );
  assert(
    derived.plan.tasks[0].plannedEnd < derived.plan.tasks[1].plannedStart,
    "and chains the derived tasks finish-to-start",
  );

  const half = svc.setProgress(derived.plan, derived.plan.tasks[0].id, 100, "2026-09-09");
  assert(
    (half.progressLog || []).length === 1 && half.progressLog[0].date === "2026-09-09",
    "the bundle records progress WITH its date, which nothing can reconstruct later",
  );

  const curve = svc.progressCurve(half, { asOf: "2026-09-09" });
  assert(curve.points.length > 1 && curve.actualPct > 0, "the bundle draws the S curve");
  assert(
    curve.projectedFinish >= curve.plannedFinish || curve.performanceIndex > 1,
    "and projects a finish from the observed pace",
    `${curve.performanceIndex} → ${curve.projectedFinish} vs ${curve.plannedFinish}`,
  );

  const risk = svc.riskReport(derived.plan, { asOf: "2026-09-30" });
  assert(
    risk.items.length === 2,
    "the bundle reports work that is late",
    String(risk.items.length),
  );
  assert(
    risk.items.every((i) => i.critical),
    "and knows which of it is critical",
  );
}

// ---- cost at completion, through the same artifact --------------------------
{
  const projects = F.createProjects();
  const forecast = projects.forecast(
    {
      id: "p1",
      name: "Job",
      baselineCents: 20000,
      baselineByChapter: [
        { chapter: "1", budgetCents: 10000 },
        { chapter: "2", budgetCents: 10000 },
      ],
      revenueCents: 30000,
      costs: [
        {
          id: "c1",
          kind: "actual",
          chapter: "1",
          description: "",
          amountCents: 4000,
          date: "2026-09-10",
        },
      ],
      changeOrders: [],
      status: "active",
      createdAt: "2026-09-01",
    },
    { progress: [{ chapter: "1", progressPct: 25 }] },
  );
  // 40 spent to get a quarter of the way is heading for 160, not "comfortably
  // under 100" — the whole reason the column exists.
  eq(forecast.byChapter[0].calculatedCents, 16000, "the bundle carries cost at completion");
  eq(forecast.forecastCents, 26000, "and totals it across the chapters");
  eq(forecast.marginForecastCents, 4000, "and reports the margin the job is heading for");
}

// ---- the vertical pack's rates travelled with it ----------------------------
{
  const rates = F.createRates();
  assert(rates.dailyOutputFor({ unit: "m2" }) > 0, "the bundle carries the pack's daily output");
  assert(
    rates.dailyOutputFor({ unit: "m2", chapter: "Pintura" }) !==
      rates.dailyOutputFor({ unit: "m2", chapter: "Estructura" }),
    "and the chapter, not just the unit, decides the pace",
  );
  assert(rates.dailyOutputFor({ unit: "furlong" }) === null, "and it declines to guess");
}

/* ---------------- report ---------------- */
const failed = checks.filter((c) => !c.pass);
console.log(`\n──── scheduling engine simulation (committed bundle) ────`);
console.log(
  `surface v${F.SURFACE_VERSION} · ${plan.tasks.length} tasks · ${(plan.dependencies || []).length} dependencies · finish ${finishBefore}`,
);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} scheduling checks passed`);
process.exit(failed.length ? 1 : 0);

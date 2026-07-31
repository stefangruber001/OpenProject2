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

/* ---------------- report ---------------- */
const failed = checks.filter((c) => !c.pass);
console.log(`\n──── scheduling engine simulation (committed bundle) ────`);
console.log(
  `surface v${F.SURFACE_VERSION} · ${plan.tasks.length} tasks · ${(plan.dependencies || []).length} dependencies · finish ${finishBefore}`,
);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} scheduling checks passed`);
process.exit(failed.length ? 1 : 0);

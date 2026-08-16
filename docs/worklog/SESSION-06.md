# Session 6 — The Gantt: SVG chart with drag, resize and link

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/candi-programme-session-4-07amo8
Spec: intake/diorka/canei-spec-extracted.txt — §3.3 "Carta Gantt del
  presupuesto" (dependencies, lead/lag, working calendar, automatic finish,
  critical path, contract payment milestones on the same timeline, baseline
  frozen at approval) and §4.3 (the site tracking that consumes it).
Plan + session index: docs/worklog/WORKLOG.md  (12 sessions; this was #6)
Read SESSION-05 for the engine this chart is a window onto.

THE CHART EXISTS: erp.html → Proyectos → Seguimiento técnico (#seguimiento).

  WHERE THINGS LIVE
    site/erp.html      ganttChart() builds the SVG; ganttWire() owns the
                       pointer gestures; ganttTaskDrawer/ganttNewTask/
                       ganttFreeze are the forms. View state is four module
                       globals: gProject, gSel, gZoom, gBaseline.
    site/erp-bridge.js ErpBridge.scheduling.plans.* — get/save/schedule/
                       recalculate/addTask/removeTask/rename/link/unlink/
                       move/unpin/setDuration/setProgress/setCalendar/
                       freezeBaseline/compareToBaseline/seedFromChapters,
                       plus .calendar (isWorkingDay, addWorkingDays,
                       workingDaysInclusive, workingDayOffset) and
                       .paymentMilestones(erp, projectId).
    state.plans        one Plan per project id, added by schema migration v3.
                       Engine-serialised, capability-owned: erp-engine.js
                       neither writes nor knows it.

  THE RULE THIS SESSION IS ABOUT: the view computes NO dates. Bars, floats,
  the critical path, the finish, baseline drift — all asked of the capability
  through the bridge. The only arithmetic in erp.html's Gantt block is
  pixels ↔ CALENDAR days (isoAdd/isoDiff) for the axis and to turn a drag into
  a date; working-day questions go to ErpBridge…plans.calendar. Keep it that
  way: the moment a working-day rule is reimplemented in the view, the chart
  and the engine start disagreeing about the same plan.

  GESTURES (pointer events — mouse, pen and touch share one path, because
  this runs in two WebViews): drag bar = move (sets a start-no-earlier-than
  pin), drag right edge = resize (converted to WORKING days by the calendar),
  drag the knob onto another bar = finish-to-start link, click = open the task
  drawer. A refused link (cycle) surfaces as the engine's own message in a
  toast — mutate() already does that.

  A TRAP WORTH REMEMBERING: SVG geometry attributes are overridable by CSS in
  Chromium. The chart's first version used class="bar", which collided with
  the table progress-bar rule `.bar{height:7px}` and silently flattened every
  bar to 7px. All chart classes are now g-prefixed (gbar, gms, ggrip, gknob,
  gdep, gnonwork, gtoday, growline, gfloat, gghost, gpay, grubber) and the
  e2e asserts bar height > 15px so it cannot come back.

Ownership now: 19 engine · 2 factory · 4 unbuilt. scheduling-gantt moved to
"factory" — it is the first area the capability layer owns end to end.

Next: session 7 (extraction capability + Spanish profile) — a fresh capability
plus a jurisdiction-pack profile, no UI. Session 8 puts OCR behind it.
Sessions 10a/10b/11/12 still owe the placeholder subsections from session 4.

ENVIRONMENT: Node 22 + pnpm 10. `pnpm install && pnpm lint && pnpm boundaries
&& pnpm check-types && pnpm test && pnpm build`, `node tests/site-e2e/run.mjs`
(64 checks), and the five sims under tests/simulation/.

Start next by: opening erp.html#seguimiento in a browser, then reading
ganttChart()/ganttWire() and site/erp-bridge.js's plans block.
```

## Goal

Per the plan and spec §3.3: the chart. Bars from the capability's schedule,
drag to move, edge-drag to resize, drag between bars to link, the working
calendar editable, the critical path visible, contract payment milestones on
the same timeline, and a baseline that can be frozen and compared.

## What changed

**`site/erp.html` — Proyectos → Seguimiento técnico.** Was a placeholder card
in session 4; now the chart. A left column of task names aligned row-for-row
with an SVG whose axis shades closed days, marks today, and draws: bars
(critical ones in red), progress fills, float tails, milestones as diamonds,
dependency arrows, frozen-baseline ghosts underneath, and the contract's
payment milestones on their own row. Toolbar: project selector, add task, add
milestone, seed-from-chapters, zoom, freeze baseline, and the finish/critical
path/drift chips. Below it, the working-calendar editor — closed days as
removable chips.

**Gestures** are Pointer Events, so mouse, pen and touch take one code path.
That is not neatness: the ERP runs inside iOS and Android WebViews, and a
mouse-only chart would be useless on the site visit it exists for.

**`site/erp-bridge.js`** gained the `scheduling.plans` surface and two
projections: `seedFromChapters` (one task per accepted-budget chapter, chained
finish-to-start — explicitly a _seed_, not session 10a's real derivation) and
`paymentMilestones` (contract instalments as points on the timeline; drawn,
never scheduled — they belong to the contract, not the planner). The host's
default calendar (a five-day week) lives here too, with a comment on why the
capability cannot hold it.

**`site/erp-migrations.js`** — schema v3 adds `state.plans`, one Plan per
project. It rides in the engine's blob but is not engine state: `erp-engine.js`
neither writes it nor knows it exists. That is the strangler seam doing its
job — a new area persists beside the old code without the old code learning
anything.

**`@repo/capability-scheduling`** gained `removeTask` (which drops the
dependencies that touched the task — leaving one behind would make the next
schedule throw) and `renameTask`. Both are domain operations, so they went in
the capability rather than the bridge.

**`packages/erp-browser`** exposes a `calendar` namespace (`isWorkingDay`,
`addWorkingDays`, `workingDaysInclusive`, `workingDayOffset`) — the chart
genuinely needs it to shade the axis and to convert a drag into working days,
and the alternative was reimplementing that arithmetic beside the engine that
owns it. `SURFACE_VERSION` 2 → 3.

## Verification

| Check                                                                             | Result                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `node tests/site-e2e/run.mjs`                                                     | **64/64** (10 new, all driving the real chart)         |
| `pnpm lint` · `boundaries` · `check-types` · `test` · `build`                     | all pass                                               |
| `year-sim` · `manageability` · `migrations` (now v1→v3) · `import` · `scheduling` | 145/145 · 34/34 · 23/23 · 25/25 · 16/16                |
| `ownership-guard.mjs`                                                             | 25 areas valid — 19 engine · **2 factory** · 4 unbuilt |
| Mobile 390px, no horizontal overflow, `#seguimiento` included                     | pass                                                   |

The new e2e assertions are deliberately about _engine_ numbers seen through
the UI: seeding produces a chained plan; bars render at full height; the
critical path is marked; dragging a bar moves the plan's finish (28/04 →
01/05); an edge-drag reports the new duration in working days; a knob-drag
creates a dependency; freezing draws the reference bars; **closing the finish
day pushes the finish out** (2026-05-04 → 2026-05-05, the proof that the
calendar reaches the engine); and the plan survives a reload.

Confirmed on GitHub for `a83c49c`: `CI` run 176 (all five jobs) and `Site E2E`
run 22 green.

**The first push was not green, and the reason is worth keeping.** Site E2E run
21 (`d9e43a2`) died 0.7 s in, before a single test executed:
`AssertionError: assert(!this.paused)` from inside undici's HTTP parser. The
harness's `waitForServer()` had been polling with `fetch()` since session 1 and
never consuming the response body; undici keeps a parser alive per
un-consumed response, and probing a socket that is still coming up can end it
mid-parse and assert out of the whole process. It passed on Node 22.22.2
locally and failed on the runner's 22.23.1 — exactly how this class of bug
hides. The probe is now a raw `net.connect` with a timeout (`a83c49c`): a
readiness check has no business owning an HTTP client.

## Two bugs this caught

1. **CSS geometry applies to SVG.** `class="bar"` on the chart's rects
   inherited `.bar{height:7px}` from the table progress-bar style, and every
   bar rendered 7px tall instead of 20. Found by measuring the rendered box in
   a real browser rather than by reading the code — no assertion in the suite
   would have noticed, so one exists now.
2. **An empty plan showed "Fin de obra 01/01/1970".** `computeSchedule` on a
   plan with no tasks returns the epoch anchor, which is correct for the
   engine and nonsense on screen; the chips are now suppressed until there is
   something to schedule.

## Decisions (ASSUMPTIONS.md #50)

1. **Plans persist in `state.plans` via schema v3**, not in a separate store.
   The engine serialises the whole blob, so a capability-owned value can ride
   along without `erp-engine.js` learning anything — cheaper and more
   reversible than a second IndexedDB store.
2. **Dragging pins, it does not set a fixed date** (the engine's
   `moveTask`), so successors still follow and the plan stays possible.
3. **Seed-from-chapters is a seed.** Session 10a owns the real budget→plan
   derivation; this exists so a chart opened on a real project is not empty,
   and it only ever runs when the user asks.
4. **Payment milestones are drawn, never scheduled.** They come from the
   contract; letting the planner move them would let a chart edit a contract.
5. **The default calendar (five-day week) lives in the bridge**, a host file.
   The capability keeps its seven-day neutrality; tenant config will replace
   this one constant.
6. **`scheduling-gantt` → `factory`.** First area the capability layer owns
   end to end: no `erp-engine.js` implementation exists or is planned.

## Open issues for the next session

- `tests/i18n-coverage.mjs` is **still** owed (fifth session). This session
  added ~55 dictionary pairs by hand for the chart; the mechanical check is
  now genuinely overdue.
- The chart shows one project at a time and re-renders the whole SVG on every
  change. Fine at this size (a few dozen bars); if a real plan reaches
  hundreds, the redraw is the first thing to make incremental.
- Undo. Every gesture is a committed mutation; there is no way back except
  editing the task again. The engine is pure and the state is a JSON blob, so
  a small undo stack in the host is cheap — worth doing before the chart is
  used in anger.
- Session 10a should replace `seedFromChapters` with the real derivation and
  freeze the contract-signature baseline automatically.

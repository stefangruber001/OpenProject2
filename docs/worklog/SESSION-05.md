# Session 5 — Scheduling capability: calendar, CPM, baselines

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/candi-programme-session-4-07amo8
  (the branch name is session 4's; sessions 4 and 5 ran under the same
  mandate. CLAUDE.md still names claude/orin-project-status-1q50dt as the
  programme default. Use whichever branch your own mandate designates.)
Spec: "20260731_REQUERMIENTOS BÁSICO CANEI.docx" · plain text at
  intake/diorka/canei-spec-extracted.txt (read that one). The Gantt
  requirements are in §3.3 "Carta Gantt del presupuesto"; §4.3 is the site
  tracking that consumes them.
Plan + session index: docs/worklog/WORKLOG.md  (12 sessions; this was #5)
Read SESSION-01..04 context packs for the programme-wide decisions.

THE PLANNING ENGINE NOW EXISTS — packages/capabilities/scheduling:

  src/calendar.ts   WorkCalendar {workingWeekdays[], nonWorkingDates[]} and
                    the arithmetic everything else is expressed in:
                    isWorkingDay · snapForward/snapBack · addWorkingDays
                    (negative = a lead) · workingDaysInclusive ·
                    workingDayOffset (signed) · finishOf/startFor.
                    THE CALENDAR IS DATA. No weekend, no closure and no
                    country is hardcoded; `everyDayCalendar()` is the neutral
                    fallback precisely because a five-day week is a local
                    convention, not a fact. Walkers are bounded (3660 days)
                    so a pathological calendar fails loudly instead of hanging.
  src/cpm.ts        computeSchedule(plan, {from}) -> Schedule
                    {start, finish, tasks[], criticalPath[]}. Forward pass
                    honours FS/SS/FF + lag (negative = lead) and each task's
                    earliestStart pin; backward pass gives lateStart/
                    lateFinish/totalFloatDays; float 0 = critical.
                    topologicalOrder() refuses a cycle by name.
                    applySchedule() writes the dates back onto the Plan.
  src/baseline.ts   freezeBaseline / compareToBaseline. Append-only, a label
                    can be used once, drift is in WORKING days.
  src/service.ts    the callable surface: setCalendar · link · unlink ·
                    setDuration · moveTask (pins) · unpin · schedule ·
                    recalculate · finishDate · criticalPath · freezeBaseline ·
                    compareToBaseline, plus the pre-existing task methods.

  BACKWARD COMPATIBILITY IS LOAD-BEARING: every new Plan/Task field is
  OPTIONAL. site/erp-bridge.js still builds {tasks:[{plannedStart, plannedEnd,
  status, progressPct, milestone}]} by hand and must keep working — a plan
  with no calendar, no durations and no dependencies still schedules, with
  durations read back off the dates. There is a test for exactly that shape.

  IN THE BROWSER: the engine ships inside the committed bundle
  site/erp-factory.{js,cjs} (now 21.7 KB, still zod-free) and is reached as
  F.createScheduling().service. SURFACE_VERSION is 2 — bumped because a
  caller reaching for service.schedule against a v1 artifact finds nothing.
  Rebuild with `pnpm --filter @repo/erp-browser build` after touching a
  bundled capability, and COMMIT the artifact; CI diffs it.

  tests/simulation/scheduling-sim.mjs drives all of the above through the
  COMMITTED .cjs artifact (16 checks) and runs in CI's simulations job. The
  vitest suite (30 tests) proves the maths; the sim proves the artifact.

Ownership unchanged on purpose: 19 engine · 1 factory · 5 unbuilt.
scheduling-gantt stays "unbuilt" because no screen reaches it yet — an area
becomes "factory" when erp.html genuinely goes through the bridge for it.

Next: session 6 (Gantt UI — SVG bars, drag to move, edge-drag to resize,
link by dragging between bars). It consumes exactly this engine through
site/erp-bridge.js, and flips scheduling-gantt to "factory" when it does.
Everything it needs is already in the bundle; session 6 is UI work.

ENVIRONMENT: Node 22 + pnpm 10 present. `pnpm install && pnpm lint &&
pnpm boundaries && pnpm check-types && pnpm test && pnpm build`,
`node tests/site-e2e/run.mjs`, and the five sims under tests/simulation/.

Start next by: reading packages/capabilities/scheduling/src/cpm.ts (the two
passes) and tests/simulation/scheduling-sim.mjs (what the bundle guarantees).
```

## Goal

Per the plan and spec §3.3: the domain half of the Gantt — a working
calendar, dependencies with lead/lag, automatic recalculation of the finish
date, the critical path, and baselines that survive the plan changing. No UI:
that is session 6.

## What changed

**`packages/capabilities/scheduling`** grew from a task list into a planning
engine, in four files rather than one so each concern stays testable on its
own.

- **`calendar.ts`** — the unit everything else is measured in. The calendar is
  data supplied by the host: `workingWeekdays` and `nonWorkingDates`, nothing
  else. Two consequences worth stating, because both were deliberate:
  - `everyDayCalendar()` (every day worked) is the fallback for a plan that
    carries no calendar. A five-day default would have been a jurisdiction
    assumption inside a capability, which the architecture forbids and the
    linter cannot catch.
  - the walkers are bounded. A calendar with no working weekdays — trivially
    reachable through a config typo — would otherwise spin forever inside
    `addWorkingDays`; it now throws a `FactoryError` naming the two fields.
- **`cpm.ts`** — forward pass (earliest dates from predecessors, lag and the
  task's own pin), backward pass (latest dates that leave the finish where it
  is), total float, critical path. Cycles are refused with the tasks named:
  two clicks in a chart can link A→B and B→A, so this is an ordinary input,
  not an exotic one.
- **`baseline.ts`** — freeze under a label, compare later. Append-only, and a
  label cannot be reused; drift is reported in working days.
- **`service.ts`** — the callable surface, every method returning a new `Plan`.

**Every new field is optional.** `Task.durationDays`, `Task.earliestStart`,
`Task.sourceRef`, `Plan.dependencies`, `Plan.calendar`, `Plan.baselines`. A
plan in the shape `site/erp-bridge.js` builds by hand — no calendar, no
durations, no links — still schedules, with durations read back off the dates
it already has. That is the difference between growing a capability and
breaking its callers.

**`packages/erp-browser`** — `SURFACE_VERSION` 1 → 2 and the new types
re-exported. The engine is reachable as `service`, deliberately not wrapped in
named passthroughs: the chart that will consume it does not exist yet, and
wrapping an API before its caller exists is how a surface collects methods
nobody calls. The committed bundle was rebuilt (5.6 KB → 21.7 KB, still no
zod) and is committed with the source that generated it.

**`tests/simulation/scheduling-sim.mjs`** (new, in CI) — the same scenarios
driven through the **committed `.cjs` artifact**. The vitest suite proves the
maths; this proves the artifact the phones actually load carries it. Session 2
learned that distinction the hard way with tree-shaking.

## Verification

All executed here, on Node 22.22.2:

| Check                                                          | Result                                             |
| -------------------------------------------------------------- | -------------------------------------------------- |
| `pnpm test` (vitest, whole workspace)                          | 24 tasks pass; scheduling **30 tests** (was 4)     |
| `node tests/simulation/scheduling-sim.mjs`                     | **16/16** through the committed bundle             |
| `pnpm lint` · `pnpm check-types` · `pnpm build`                | 24 / 26 / 3 tasks, all pass                        |
| `pnpm boundaries`                                              | OK — no forbidden literal, no layer violation      |
| `year-sim.mjs 1` · `manageability` · `migrations` · `import`   | 145/145 · 34/34 · 23/23 · 25/25                    |
| `ownership-guard.mjs`                                          | 25 areas valid — 19 engine · 1 factory · 5 unbuilt |
| `node tests/site-e2e/run.mjs` (against the new 21.7 KB bundle) | **53/53**                                          |
| Bundle browser-safety                                          | `ErpFactory` present, `ZodError` absent            |

Confirmed on GitHub's own infrastructure for commit `6e18112`: `CI` run 173
(all five jobs, including the new scheduling simulation) and `Site E2E`
run 20 both green.

The scheduling assertions worth knowing, because they pin the spec's wording:
a two-day task starting Monday finishes Tuesday; its finish-to-start successor
steps over both a closed day and the weekend; a milestone is a zero-duration
point; positive lag delays and negative lag (a lead) overlaps; SS and FF place
their successors correctly; stretching a critical task moves the plan's
finish; a dragged task holds its date while its successors follow; a
one-working-day slip against a baseline that spans a week-long closure reports
as **one** day, not eight.

## Decisions (ASSUMPTIONS.md #49)

1. **The calendar is data, and the neutral default is a seven-day week.** The
   five-day week is a local convention; defaulting to it would put
   jurisdiction knowledge in a capability.
2. **Drift and float are counted in working days.** A plan crossing a two-week
   closure has not slipped two weeks, and reporting that it has sends someone
   to a site meeting with the wrong number.
3. **Dragging sets a start-no-earlier-than pin, not a fixed date.** The task
   holds the position a human chose but still moves if a predecessor pushes it
   later — otherwise the chart would quietly produce impossible plans.
4. **FS, SS and FF only.** The spec names those three; SF exists in other
   tools and is not implemented rather than half-implemented.
5. **New fields are optional, no data migration.** The persisted plans that
   exist today are built by the bridge at read time, so nothing to migrate —
   and the optionality is what keeps that true.
6. **`scheduling-gantt` stays `unbuilt`.** The domain exists, but no screen
   reaches it; marking it `factory` would make the ownership file describe an
   intention rather than the code.
7. **The engine is exposed as `service`, unwrapped**, with `SURFACE_VERSION`
   bumped so a stale artifact is detectable.

## Open issues for the next session

- Session 6 (the chart) is pure UI over this engine: bars from
  `computeSchedule`, drag → `moveTask`, edge-drag → `setDuration`, link-drag →
  `link`, then `recalculate` and re-render. The one thing it must not do is
  reimplement any of the arithmetic in the view.
- **Generating a plan from a budget** — chapters and lines to tasks — is
  deliberately not here. It is session 10a's, and it belongs in the host or a
  vertical pack: "a chapter becomes a task" is sector knowledge, not planning.
- Contract payment milestones on the same timeline (§3.3) need only
  `sourceRef` and a milestone task; the host supplies them, the engine already
  schedules them.
- `tests/i18n-coverage.mjs` is **still** owed (fourth session). This session
  added no UI strings, so the debt did not grow — but session 6 will add many.

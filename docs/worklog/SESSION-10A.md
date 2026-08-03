# Session 10a — Projects: Gantt-from-budget, baselines, economics

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/candi-programme-session-4-07amo8
Spec: intake/diorka/canei-spec-extracted.txt — §4 (project selector, fixed
  header, frozen baselines), §4.3 "Seguimiento Técnico de Obra" and §4.4
  "Seguimiento Económico de Obra". Read all three; this session implements them.
Plan + session index: docs/worklog/WORKLOG.md  (12 sessions; this was #10a)

ONE PROJECT IS THE CONTEXT OF THE WHOLE SECTION (§4)
  site/erp.html · PROJECT_SUBS + renderProjectBar(), rendered into #projbar
  which lives OUTSIDE #view so it survives every subsection change. gProject
  was the chart's local dropdown in session 6 and is now the section's context.
  Selector: search, status filter, favourites and recents (in the store's
  `meta`, never the state blob). Header: erp.projectHeader() — one call, so six
  views cannot each assemble it slightly differently.

THE PLAN IS DERIVED FROM THE BUDGET, NOT SEEDED (§3.3 · §4.3)
  packages/capabilities/scheduling/src/derive.ts
    planFromWorkBreakdown(items, options) — one task per group or per item,
    chained FS in document order (numeric: 2.10 after 2.9), duration =
    explicit → quantity ÷ ratePerDay (CEILING) → the stated default. Returns
    notes saying WHICH of the three each duration came from.
    mergeDerivedPlan(previous, derived) — re-deriving keeps progress, pinned
    dates and frozen baselines for every task that survived.
    TASK IDS COME FROM THE CALLER'S REFS, not a generator. That is the whole
    reason a re-derivation is a merge and not a reset, and it is why this
    module is pure and needs no IdGenPort.

  packages/packs/vertical-construction-reformas/src/rates.ts
    DAILY_OUTPUT_BY_UNIT + DAILY_OUTPUT_BY_CHAPTER + dailyOutputFor(). How fast
    a trade works is SECTOR knowledge; the capability divides, the pack
    supplies the divisor. Zod-free on purpose — see the bundle note below.

THREE LINES AND A RISK LIST (§4.3)
  packages/capabilities/scheduling/src/tracking.ts
    progressCurve(plan, schedule, {asOf, weights}) — planned / actual /
    projected. THE ACTUAL LINE COMES FROM plan.progressLog, never from today's
    percentages: a task 60 % done today was not 60 % done last month, and a
    curve that pretends otherwise makes every past week look fine. No log
    entries → actualPct is null, not zero.
    riskReport(...) — three NAMED kinds (not_started · overdue · behind),
    because they are three different conversations, plus the slip against the
    frozen baseline and whether it crosses the threshold.
    Weights default to duration; the host passes chapter VALUE, because a week
    of demolition and a week of joinery are not the same amount of job.

COST AT COMPLETION (§4.4)
  packages/capabilities/projects/src/forecast.ts
    forecastToCompletion(project, {progress, overrides, …}). Rules that matter:
      · never below what is already spent or committed;
      · NOTHING BOOKED → the budget stands, at any progress. "Finished, no
        bill" means the bill has not arrived, not that it was free;
      · an override needs a reason and is reported ALONGSIDE the calculation,
        never instead of it;
      · provisional=true while the extrapolation rests on <10 % progress.

WHERE THEY MEET
  site/erp-bridge.js
    scheduling.plans.fromBudget / curve / risk / recordProgress / syncProgress
    projects.forecast
    _projections.workBreakdownOf, projectValue
    recordProgress writes the plan AND the budget chapter in one action —
    otherwise a job ends up 80 % done on one screen and 40 % on another.

  packages/erp-browser now composes a PACK as well as capabilities (it is a
  host, it may). The import is the pack's zod-free `rates` SUBPATH: importing
  the package index would drag zod into a bundle that ships to a phone.
  SURFACE_VERSION 5. Bundle 26.2 KB → 52.4 KB.

Schema v5: project.forecastOverrides and plan.progressLog, both additive.
Ownership: 18 engine · 4 factory · 3 unbuilt. scheduling-gantt and
project-economics are factory; `projects` stays engine ON PURPOSE.

ENVIRONMENT: Node 22 + pnpm 10. `pnpm install && pnpm lint && pnpm boundaries
&& pnpm check-types && pnpm test && pnpm build`, `make gates`, `make demo`,
`node tests/site-e2e/run.mjs` (91), the five sims under tests/simulation/.
Rebuild the committed bundle after touching a bundled capability OR the pack:
`pnpm --filter @repo/erp-browser build`.

Next: session 10b (Compras, subcontratos, modificaciones, horas — §4.1, §4.2,
§4.5, §4.6). Committed cost per chapter already exists
(erp.committedByChapter) and the economics screen already has the column, so
purchase orders have somewhere to land the moment they are raised. Session 8
(OCR bridge + invoice capture) is still open and independent.

Start next by: reading site/erp-bridge.js's workBreakdownOf and projectValue —
between them they are every projection this session added.
```

## Goal

Per spec §4, §4.3 and §4.4: make the project the context of its whole section,
build the plan from what was actually sold rather than from a placeholder, and
answer the question the economics screen exists for — not what this job has
cost, but what it is going to cost.

## What changed

**One context for the section** (§4). A persistent selector with search, a
status filter, favourites and recents, and a fixed header carrying customer,
address, status, progress, contracted revenue, actual cost, current margin and
the next two critical dates. It lives outside `#view`, so it survives every
subsection change — two screens showing different jobs at once is the bug this
removes, and it is the kind that gets discovered when a cost lands on the wrong
project.

**The plan is derived** (§3.3, §4.3). Session 6 seeded one five-day task per
chapter as an honest placeholder. The real derivation reads the accepted
version's lines and gets each duration from quantity ÷ the daily output of that
unit in that chapter. The division belongs to the capability; the rates belong
to the **vertical pack** — put them in the capability and the planner works for
exactly one trade in one country.

Derived task ids come from the budget's own line ids rather than a generator,
which is what makes re-deriving after a quote change a **merge**: progress,
pinned dates and frozen baselines survive for every line that survived, and
lines that vanished from the quote vanish from the plan.

**Three lines and a risk list** (§4.3). Planned, actual and projected, plus a
panel naming what is overdue, what has not started and what is merely behind —
three different conversations, so three named kinds rather than one score. The
actual line is drawn from an **append-only progress log**, never from today's
percentages: dates and the critical path recompute from the network whenever
you like, but how much was done by the end of March is only knowable if
somebody wrote it down in March. Where nothing was recorded the line is `null`
rather than zero, because "nobody wrote anything down" and "nothing happened"
are different claims.

Progress is recorded per chapter or **per executed quantity** — the number a
site actually knows, since nobody can say what 40 % of a wall is and everybody
can say how many square metres went up. One action writes both the budget and
the plan, so the two records of the same fact cannot drift apart.

**Cost at completion** (§4.4). The economics screen was a placeholder pointing
at the project drawer; it is now budgeted · committed · actual · **projected** ·
deviation · margin per chapter. The projected column is the point: "spent 40 of
a 100 budget" reads as comfortable and says nothing, while "spent 40 to get a
quarter of the way, so heading for 160" is a sentence somebody can act on. It
never comes in below what is already spent or committed, it keeps the budget
while nothing has been booked, and a manual adjustment requires a reason and is
shown **alongside** the calculation rather than replacing it.

**A pack in the browser bundle.** `@repo/erp-browser` is a host and may compose
packs as well as capabilities; this is the first time one reaches the phone. The
import is the pack's zod-free `rates` subpath.

## Verification

| Check                                                         | Result                                      |
| ------------------------------------------------------------- | ------------------------------------------- |
| `@repo/capability-scheduling` tests                           | **57/57** (was 30) — derive 11, tracking 16 |
| `@repo/capability-projects` tests                             | **18/18** (was 6)                           |
| `@repo/pack-vertical-construction-reformas` tests             | **11/11** (was 4)                           |
| `node tests/site-e2e/run.mjs`                                 | **91/91** (was 77) — 14 new                 |
| Scheduling simulation (committed bundle)                      | **30/30** (was 16)                          |
| Migration simulation                                          | **33/33** (was 30) — v5                     |
| Other sims + ownership guard                                  | 145/145 · 34/34 · 25/25 · 25 areas          |
| `pnpm lint` · `boundaries` · `check-types` · `test` · `build` | all pass                                    |
| `make gates` · `make demo`                                    | both green, artifacts unchanged             |
| Committed bundle                                              | 26.2 KB → 52.4 KB                           |

`pnpm --filter web test:e2e` was not required: no tenant spec and no capability
registry entry changed, so the composed-capability count stays 17.

The fourteen new E2E checks are made in a real browser because that is where
this kind of feature breaks: the header must actually carry nine fields, the
selection must actually survive a hash change, the derived bars must have
**different widths** (all-equal widths mean the derivation silently fell back to
its default for everything), a quantity typed into the progress table must come
back as a percentage, and an adjustment with no reason must leave the store
untouched.

## Three things the tooling caught

1. **Two chapters forecasting €0.** Found by running the derivation over the
   seeded project rather than by reading the code: a chapter marked complete
   with no cost booked against it forecast nothing, and a chapter 60 % done with
   nothing booked did the same. Both are the same over-confidence, now stated
   once — with no actual cost the extrapolation carries no information at all,
   so the budget stands. The first fix only handled the 100 % case and the
   second chapter proved it was the wrong generalisation.
2. **A test that asserted the translation, not the rule.** The "an adjustment
   needs a reason" check matched Spanish text against an engine message that is
   English by convention. It now asserts the outcome — nothing stored — which
   is what the rule actually promises.
3. **zod, again.** The pack's package index imports it for the config schema, so
   the rates went out through a dedicated zod-free subpath export. Session 9
   learned this on the annex options; the bundle is the place the lesson keeps
   being worth re-learning.

## Decisions (ASSUMPTIONS.md #53)

1. **The plan is derived, not seeded**; the capability divides, the pack
   supplies the rate.
2. **Derived ids come from the caller's refs**, so re-derivation is a merge.
3. **The actual curve comes from a progress log**, and is `null` where nothing
   was recorded.
4. **The projected line is an extrapolation** and says what it rests on.
5. **A forecast never falls below what is spent or committed**, and nothing
   booked means the budget stands.
6. **An adjustment needs a reason and never replaces the calculation.**
7. **Progress is written to both records in one action** — a projection concern,
   which is why it lives in the bridge.
8. **The project context belongs to the section**, not to a screen.
9. **The browser bundle may compose a pack**, through a zod-free subpath.
10. `project-economics` and `scheduling-gantt` are **`factory`**; `projects`
    stays **`engine`** — only the two derivations that did not exist anywhere
    moved.

## Open issues for the next session

- **Committed cost is per chapter but purchases are barely modelled.** The
  economics screen already has the column and `erp.committedByChapter` already
  fills it; session 10b's purchase orders are what will make it meaningful.
- **The S curve has no cost axis.** §4.4 asks for a cost-and-cash S curve beside
  the progress one. The data exists (the progress log plus the cost ledger);
  the second curve does not.
- **Freezing a baseline is still a button.** §4.3 says a new baseline may only
  be frozen through an approved change order — that belongs with change orders
  in 10b.
- **No cost composition drill-down.** §4.4 wants each chapter to expand into
  materials / subcontract / own labour / plant, each navigable to its source
  document. The engine holds all four; the screen shows the total.
- Still owed: `tests/i18n-coverage.mjs`, and undo for both the Gantt and the
  budget grid.

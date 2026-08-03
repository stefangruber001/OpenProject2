# Session 12 — Torre de Control, Mi Día, Recorrido (Improvement #3), alerts

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/candi-programme-session-4-07amo8
Spec: intake/diorka/canei-spec-extracted.txt — §2.1 Torre de Control, §2.2 Mi
  Día, §2.3 Recorrido completo (Improvement #3). Read all three.
Plan + session index: docs/worklog/WORKLOG.md  (12 sessions; this was #12 —
  the LAST planned session, though session 8 (OCR bridge) is still open.)

ALERTS ENGINE (DAS) — site/erp-engine.js
  ALERT_META (module const, top of file near LISTS): one entry per alert
  CONDITION, keyed by a stable code — {type, label, thresholdKind?,
  defaultThreshold?}. alerts() calls push(code, sev, msg, ref); type and
  label come from ALERT_META, never repeated at the call site.
  ensureAlertRules()/alertRule(code)/alertRuleEnabled(code)/
  alertRuleThreshold(code,fallback)/updateAlertRule(code,patch,user) —
  state.alertRules is lazily filled in per code, so a FUTURE session adding a
  new ALERT_META entry needs no migration to get a rule row.
  managedAlerts(opts) layers state.alertOverrides (keyed by
  alertKey(a)=code+"|"+JSON(ref)) over the pure alerts() projection:
  assignAlert/setAlertDue/snoozeAlert/resolveAlert(note required)/
  reopenAlert/convertAlertToTask. alertProjectCode(ref) resolves a project
  code from whichever ref shape an alert carries, for "agrupar por proyecto".
  PROJ-MARGIN-LOW deliberately has NO thresholdKind — it still reads
  state.config.marginThresholdBp (existing, session-1-era config) rather than
  gaining a second, competing threshold. GES-PACKAGE-DUE is an ADVISORY
  reminder, not a legal deadline (see LEGAL_REVIEW.md §5 note).

TORRE DE CONTROL DERIVATIONS — site/erp-engine.js
  operatingResult(from,to) — issued revenue (net of credit notes) minus
    received-bill cost, both on document date, PLUS overhead/salary/
    financial movements that were classified directly (not matched to a
    bill — matched ones are the bill's payment, already counted).
  cashPositionAsOf(dateIso) — historical balance reconstruction.
  cashForecastWindow(days) — single rolling N-day window (cashForecast() is
    still the N weekly-bucket version other screens use; untouched).
  controlTowerCards() — the eight cards' real numbers.
  controlTowerSeries() — 12 trailing points per card, EACH ON ITS OWN
    CADENCE (monthly/quarterly/weekly, not one global period).
  controlTower() gained cards/series/lastCalculatedAt fields, ADDITIVELY —
    every field year-sim/migrations-sim already read (alerts, invoicedCents,
    outstandingCents, cash.totalCents) is untouched. controlTower().alerts
    now returns managedAlerts() instead of alerts() — still has .ref/.sev.
  setProjectPriority(id,flag,user); project.priority defaults false.
  o.decidedAt set in loseOpportunity/acceptVersion ("contratadas/perdidas
    últimos 12 meses" needs a decision date, not the creation date).

MI DÍA — site/erp-engine.js
  upcomingMilestones(from,to) — reads every date off the record that owns
    it: project.dates.start/targetEnd, contract installments (cobro),
    contract.duration.plannedFinish, contract.guarantees[].expiryDate, bill
    dueDate (pago), purchase.expectedArrival (material), subcontract/worker
    docs[].expiresOn, open tasks, one GES-PACKAGE-DUE-style reminder per
    quarter touching the window. Visits deliberately NOT included — logged
    after they happen (VIS-01), no future date exists for one.

UI — site/erp.html
  torre(v)/hoy(v) are standalone functions above VIEWS, referenced there by
  shorthand (search "Torre de Control (spec §2.1)"). TORRE_CARDS (8 card
  defs), sparklinePath/seriesDelta, torreCardList/torreOrder/torreHidden
  (ErpStore meta "ui.torre"), alertsPanel/alertRowHtml/wireAlertsPanel,
  alertRulesDrawer, torreCustomizeDrawer, exportTorreCsv.
  IMPORTANT: a drawer's own onchange/blur handler must NOT call a function
  that rebuilds that SAME drawer's innerHTML synchronously — hit this once
  in alertRulesDrawer ("node to be removed is no longer a child of this
  node"), fixed by dropping the redundant render2() (the field already shows
  what the user just typed; nothing else needs a redraw).
  MILESTONE_META, hoy(v) calendar (calgrid/calcell/ev), miCalMonth/
  miHiddenKinds state, addDaysLocal/shiftMonth/MONTH_NAMES.
  boot() now reads ?project=CODE from the query string once, to preselect
  gProject for cross-page links FROM journey.html — then strips the query
  string via history.replaceState.

RECORRIDO — site/journey.html
  journey.html's ORIGINAL "Crear nuevo proyecto" walkthrough (STAGES,
  PROJECT, S, idb* against its OWN "caneiJourney" IndexedDB) is 100%
  UNTOUCHED — do not refactor it "while you're in there".
  NEW: erp-engine.js/erp-migrations.js/erp-store.js are loaded (classic
  scripts, before the module script) so journey.html can read the SAME
  "caneiERP" database erp.html writes. loadRealErp() is best-effort — if it
  fails, "Proyecto existente" just shows an empty-state message; the demo
  above is never blocked.
  #modebar (Crear nuevo / Proyecto existente toggle) + #projPicker
  (search/filter list) sit ABOVE <main>; #loadedBar shows the loaded
  project. setJourneyMode/renderProjPicker/selectRealProject/
  renderRealAll/renderRealRail/renderRealStage/renderRealLedger/
  realStageInfo (the 13-stage → real-data mapping, one function) /
  duplicateRealProject/downloadRealFolder.
  Real mode is READ-ONLY — no per-stage editing UI was rebuilt; each stage
  shows a real status + summary + a link to erp.html?project=CODE#screen.

SCHEMA v8 (site/erp-migrations.js): alertRules[], alertOverrides{},
  opportunity.decidedAt (backfilled to .date for existing won/lost),
  project.priority (defaults false). All additive.

SEED — site/erp-seed.js: prjB marked priority; two worker docs (one already
  expired, one upcoming); one of each alert-management action (assign/
  snooze/resolve+evidence/convert-to-task) exercised on real seeded alerts.

Ownership: alerts-tasks-control-tower plannedSession cleared (stays engine);
  journey-project-selector unbuilt→engine (19 engine · 7 factory · 1
  unbuilt — only extraction-ocr/session 8 remains unbuilt).

ENVIRONMENT: Node 22 + pnpm 10. `pnpm install && pnpm lint && pnpm boundaries
&& pnpm check-types && pnpm test && pnpm build`, `make gates`, `make demo`,
`node tests/site-e2e/run.mjs` (147), the five sims under tests/simulation/.
No packages/ or capability source changed — committed bundle untouched.
`pnpm --filter web test:e2e` not required (registry/tenant spec unchanged)
but run anyway as a sanity check; 5/5.

Next: session 8 (OCR bridge + invoice capture) is the one item left from the
original 12-session plan. Otherwise the plan is complete — see mandate §12
for the overall Definition of Done (make demo green, tenant #2 in <15 min,
the negative test, P0-P5, governance files honest).

Start next by: reading erp.html's "Torre de Control (spec §2.1)" block and
site/erp-engine.js's alerts()/ALERT_META/controlTowerCards() — between them
and journey.html's "Real-project mode" block, that is this whole session.
```

## Goal

Per spec §2.1, §2.2 and §2.3: a control-tower dashboard with the exact eight
cards the spec names, an alerts panel that manages instead of just listing,
a calendar of the dates that actually matter day to day, and — the
programme's last planned improvement — a way to open the guided recorrido
against a real, already-existing project instead of only a sample one.

## What changed

**Torre de Control.** The old ad-hoc eight tiles are replaced by the exact
eight the spec names — proyectos activos, resultado operativo del mes/
trimestre, saldo bancos, proyección de caja, pagos a proveedores,
oportunidades abiertas, visitas — each with its big/small figures, a
twelve-period sparkline on its own natural cadence, a delta against the
prior period, and a colour dot. The dot deliberately reuses the same number
the card already shows (a negative result, an overdrawn balance, a payment
week bigger than the cash on hand) rather than a second per-tile threshold
store: "el umbral de cada indicador" already has a home in the alert rules,
and a parallel configuration surface for the same idea is exactly the kind
of thing that drifts out of sync with what it duplicates.

**Alerts became a manager, not a feed.** Every one of `alerts()`'s ~28
conditions now carries a stable code and a type (económica/técnica/
documental/fiscal), looked up once from a single `ALERT_META` table instead
of repeated at each call site. `managedAlerts()` layers assignment, a due
date, snoozing, resolution with a required note and evidence, and
conversion to a real task over the pure, recomputed `alerts()` list — the
same architecture session 11 used for gestoría's justified exceptions and
the comunicaciones queue: a computed projection plus a keyed overrides map,
never a mutated copy. Only the conditions the spec explicitly calls
"configurable" gained a tunable numeric threshold in the rule editor;
margin stays on its existing config field rather than getting a competitor.

**Mi Día gained the hitos calendar** the spec asks for, built entirely from
dates records already own — project start/end, contract installments and
guarantee expiry, bill due dates, purchase arrivals, subcontract and worker
document expiry, open tasks, and one advisory (explicitly non-legal)
gestoría reminder per quarter — rather than a second, calendar-specific copy
of any of them. Visits are deliberately absent: they are logged after they
happen, so there is no future date to put on a calendar for one.

**Recorrido's "Proyecto existente"** is the session's one genuinely new
integration: journey.html's original walkthrough — its own sample data, its
own separate IndexedDB — is completely untouched and stays the default. The
addition reads the same tenant database erp.html writes and shows, for each
of the thirteen stages, a real status and a real summary derived from the
record that owns it, with a link into the actual erp.html screen that owns
that data — the spec's own framing for why the link exists ("de modo que el
recorrido sirva también como lista de puesta en marcha del proyecto") taken
as the design, not read as "clone every screen a second time."

## Verification

| Check                                                         | Result                                             |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `node tests/site-e2e/run.mjs`                                 | **147/147** (was 121) — 26 new                     |
| Five simulations + ownership guard                            | 149/149 · 34/34 · 43/43 · 25/25 · 30/30 · 27 areas |
| `pnpm lint` · `boundaries` · `check-types` · `test` · `build` | all pass                                           |
| `make gates` · `make demo`                                    | both green, artifacts unchanged                    |
| `pnpm --filter web test:e2e`                                  | 5/5 (not required — ran as a sanity check anyway)  |
| Committed bundle                                              | untouched — no capability/pack source changed      |

Confirmed on GitHub for `d2de900`: `CI` run 189 green (all jobs, including
the committed-bundle drift check and the Playwright end-to-end job) and
`Site E2E` run 28 green. First push, no fixes needed.

The new checks drive the actual management verbs (assign, snooze, resolve,
convert-to-task, edit a rule's threshold, hide a card), the calendar's month
navigation and legend filter, and the full real-project loop in
journey.html: pick a project, see its real status and ledger, duplicate it,
download its folder as a real zip, switch back to the untouched demo.

## The bug the tooling caught

**A drawer rebuilding its own `innerHTML` from inside a field's own
`onchange`/blur handler.** The alert rule editor's threshold input called
`render2()` (which replaces the whole drawer body) after saving the new
value — and the browser was still in the middle of removing that same input
on blur when the replacement ran, throwing "node to be removed is no longer
a child of this node." The field already showed the value the user just
typed; nothing needed the redraw. Dropping the four redundant `render2()`
calls in `alertRulesDrawer` fixed it. A real browser session caught this
immediately; a unit test over the engine methods alone would not have.

## Decisions (ASSUMPTIONS.md #56)

1. **Every alert has a stable code and a type**, from one lookup table.
2. **A card's colour dot reuses its own number** — no second threshold store.
3. **`managedAlerts()` layers overrides over a pure projection**, keyed.
4. **Only the spec's named "configurable" alerts got a numeric threshold.**
5. **The gestoría reminder is advisory**, not an asserted legal deadline.
6. **The calendar reads dates from their owning records** — no duplicate.
7. **Card order/visibility and the legend filter are browser preferences.**
8. **"Exportar a PDF/Excel" is a real CSV + the browser's own print dialog.**
9. **Recorrido's real mode is read-only and links out**, rather than
   rebuilding thirteen stages of editing UI in a second data shape.
10. **The unsaved-changes confirm only guards an in-progress demo.**
11. **Duplicating a real project is one real `createQuickProject` call.**
12. **The real folder download reuses the demo's own zip plumbing.**

## Open issues for the next session

- Session 8 (OCR bridge + invoice capture) is the only item left from the
  original 12-session plan.
- Alert rules currently only expose enabled/threshold/recipient/channel —
  there is no way to add an entirely new condition from the UI (by design;
  see ASSUMPTIONS #56d), so a genuinely new alert still needs a code change.
- The Torre's "exportar a Excel" is CSV, not a real `.xlsx` — opens fine in
  Excel but isn't a native workbook; upgrading it would mean a real XLSX
  writer dependency, judged not worth the weight yet.
- Recorrido's real mode has no write path back into any stage — it is
  intentionally a dashboard-plus-links, not a second editor. If that
  changes, the natural next step is per-stage inline actions that call the
  same engine methods erp.html already calls, not new ones.
- The mandate's overall Definition of Done (§12) — `make demo` green,
  tenant #2 in under 15 minutes config-only, the negative test, P0-P5
  complete, governance files honest — should be revisited as a whole now
  that all twelve planned sessions except #8 are done.

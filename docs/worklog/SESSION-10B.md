# Session 10b — Compras, subcontratos, modificaciones, horas

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/candi-programme-session-4-07amo8
Spec: intake/diorka/canei-spec-extracted.txt — §4.1 Compras, §4.2 Subcontratos,
  §4.5 Modificaciones Contractuales, §4.6 Personal y Horas. Read all four.
Plan + session index: docs/worklog/WORKLOG.md  (12 sessions; this was #10b)

FOUR SUBSECTIONS, ALL PROJECT-SCOPED THROUGH gProject (session 10a's context)
  site/erp.html: compras(v), subcontratos(v), modificaciones(v), horas(v) —
  standalone functions referenced by shorthand in the VIEWS object (the OLD
  inline VIEWS.horas was DELETED; do not resurrect it). All four sit in
  PROJECT_SUBS, so renderProjectBar() runs before them automatically.

COMPRAS (§4.1) — site/erp-engine.js "PUR — purchases"
  purchaseStatus(pu) is DERIVED, not stored: draft/sent/accepted/
  partialReceived/received/invoiced/paid/cancelled, read off sentAt/
  acceptedAt/receipts/status.delivered/status.invoicedBillId/status.paid/
  cancelledAt. sendPurchase/acceptPurchase/receivePurchase(partial, repeatable)
  /cancelPurchase/duplicatePurchase/recordReturn.
  purchaseNeeds(projectId) — budgeted vs committedByChapter() vs pending, PER
  CHAPTER — same call the economics screen uses, so the two can never disagree.
  purchaseReconciliation(id) — the order ↔ receipts ↔ invoice three-way check.

SUBCONTRATOS (§4.2) — NEW area, "SUB — subcontracts", state.subcontracts
  One record per awarded trade: awarded/certified/invoiced/pending, docs[]
  (insurance/prl/socialSecurity) with subcontractDocStatus() traffic light,
  retentionPct + release, dates{planned*/actual*}, scheduleTaskRef.
  addSubcontract → sendSubcontract → acceptSubcontract → markSubcontractStarted
  → certifySubcontract*/markSubcontractCompleted; also modifySubcontract,
  extendSubcontract, terminateSubcontract, recordRejectedWork,
  approveSubcontractorInvoice (wraps registerBill), releaseSubcontractRetention,
  renewSubcontractDoc.
  markSubcontractStarted BLOCKS (throws) on subcontractDocStatus().worst==="r".
  Not an alert — a refusal. This is the one rule in the session that took the
  harder form on purpose; §4.2 says "bloqueo ... si está vencida" in as many
  words.
  committedByChapter/committedCostCents (session 10a) now ALSO sum awarded
  subcontracts (terminated ones count only what was certified). This was a
  real gap: the economics screen was undercounting every project with a
  subcontract on it, silently, since session 10a shipped.

MODIFICACIONES (§4.5) — extends existing "CHG — change orders & extras"
  addChange gained chapterNum (attributes the cost/margin effect to a chapter
  in session 10a's forecast — previously always defaulted to "1").
  New status "sent": priced →(sendChange)→ sent →(approveChange, which still
  also accepts a straight priced→approved jump)→ approved.
  cancelChange (un-invoiced only). renderChangeDoc(id) — the adenda, no cost
  or margin field, same QUO-10/PRE-08 rule the budget document follows.
  priceChange(id, priceCents, costCents, scheduleImpactDays, user) — the new
  4th param sits BEFORE user because every existing caller passes exactly 3
  args and has never passed user; inserting after would have been a silent
  break, inserting before is not.
  Applying the schedule effect to the Gantt is a SEPARATE, EXPLICIT bridge
  call: ErpBridge.scheduling.plans.applyChapterDelay(plan, chapterNum, days) —
  finds the task with sourceRef "group:<chapterNum>", bumps its duration,
  leaves everything else (including any frozen baseline) alone. Never
  automatic inside approveChange — one action, one system of record.

HORAS (§4.6) — extends existing "LAB — labour hours"
  labourWeek(projectId, weekStart) — worker × day grid, rows = assigned ∪
  already-logged workers, so an assigned worker with nothing logged shows as
  an empty row (that IS the "jornada sin registrar" signal).
  approveLabourWeek/unapproveLabourWeek (locks/unlocks correctHours+deleteHours
  on that worker's week). repeatDay(projectId, from, to, user) — skips a
  worker already logged on `to`, so the button is idempotent.
  recordHours/correctHours now REFUSE a closed project outright — this makes
  §4.6's own "horas imputadas a un proyecto cerrado" alert structurally
  unreachable going forward, which is why no such alert exists: the guard
  already is the stronger guarantee.
  correctHours(id, {projectId, chapterNum}, user) IS "reimputar horas de un
  proyecto a otro" — no separate method, just a patch.
  worker.docs[] + addWorkerDoc — free-text kind (not the fixed subcontract
  list), alert-only (never a hard block — only a subcontracted TRADE is
  blocked from the site, per §4.2).

SCHEMA v6 (site/erp-migrations.js): state.subcontracts + series.subcontract;
  purchase.{receipts,sentAt,acceptedAt,expectedArrival,cancelledAt,
  cancelReason}; change.{chapterNum,sentAt}; labour.{locked,approvedAt,
  approvedBy}; worker.docs. ALL ADDITIVE — read tests/simulation/
  migrations-sim.mjs's v6 block for what's asserted, including the "behaviour
  is preserved" trap: alerts()/controlTower() must run on the RAW un-migrated
  v1 blob directly (that is literally what one part of the sim does), so every
  new `this.state.subcontracts` read in alerts()/committedByChapter()/
  committedCostCents() is guarded with `|| []`. Forgetting one crashed the
  first version of this session's alerts().

Ownership: subcontracts added (engine); purchases/change-orders/labour-hours
plannedSession → null (19 engine · 4 factory · 3 unbuilt).

ENVIRONMENT: Node 22 + pnpm 10. `pnpm install && pnpm lint && pnpm boundaries
&& pnpm check-types && pnpm test && pnpm build`, `make gates`, `make demo`,
`node tests/site-e2e/run.mjs` (103), the five sims under tests/simulation/.
No packages/ or capability source changed this session — the committed bundle
(site/erp-factory.{js,cjs}) is untouched; do not rebuild it needlessly.

Next: session 11 (Administración: conciliación, gestoría, comunicaciones) or
session 8 (OCR bridge + invoice capture), still open and independent of
everything sessions 9/10a/10b built.

Start next by: reading erp.html's compras/subcontratos/modificaciones/horas
block (search "Compras · Subcontratos · Modificaciones · Horas") and
site/erp-engine.js's SUB section — between them they are this whole session.
```

## Goal

Per spec §4.1, §4.2, §4.5 and §4.6: purchase orders with a real lifecycle and
a three-way reconciliation; subcontracted trades with mandatory documentation
that can actually block entry to the site; change orders that go through a
send step and generate a real customer-facing document; and a weekly hours
grid with locking and the one-step mobile flow the spec asks for.

## What changed

**Compras.** A purchase order's status was four independent booleans with no
name for the whole. `purchaseStatus(pu)` gives it one, derived rather than
stored, so it can never fall out of sync with what the booleans actually say.
Receiving is now real — partial receipts accumulate with a delivery note and
a photo reference, and the order becomes "recibida" on its own once the
received quantity catches up. `purchaseNeeds()` and `purchaseReconciliation()`
are the two derivations the spec's three-block layout needs, both reading
figures the economics screen already computes so the numbers can never
contradict each other.

**Subcontratos**, a genuinely new area. One record per awarded trade, with
the traffic light over three mandatory documents (insurance, PRL, Social
Security) that §4.2 asks for. The one rule in this session that took the
harder of its two available forms on purpose: starting work on site is
**blocked**, not merely alerted, while that documentation is missing or
expired. A dashboard tile is not enough defence against an uninsured trade
starting on a real job, and the spec says so explicitly ("bloqueo ... si está
vencida").

Fixing this also surfaced a real gap from session 10a: `committedByChapter`
and `committedCostCents` only ever summed purchase orders. Spec §4.1 and
§4.4 both define "comprometido" as orders **and** awarded subcontracts, so
every project carrying a subcontract has had its committed cost silently
understated since the moment subcontracts didn't exist yet — not a bug
session 10a made, but one this session's addition made visible and fixed.

**Modificaciones.** Change orders gained the "enviada" step between valued
and accepted, a `chapterNum` so their cost and margin effect attributes to
the right chapter in the forecast, and `renderChangeDoc` — the adenda, a
customer-facing document with no cost or margin field, the same rule the
budget document has followed since session 3. Applying an approved change's
schedule effect to the Gantt is a separate, explicit action rather than
something approval triggers on its own: the engine's approval only ever
touches the budget's numbers, and one action should not silently become
responsible for two systems of record.

**Horas.** The flat list became the weekly grid §4.6 describes — worker rows,
day columns, an assigned worker with nothing logged showing as a visibly
empty row rather than not appearing at all. Approving a week locks it;
"repetir el parte del día anterior" copies yesterday without duplicating a
worker already logged today. Recording hours against a closed project is now
refused outright, which is stronger than the alert the spec asks for: the
alert can never fire because the thing it would warn about can no longer
happen.

## Verification

| Check                                                         | Result                                             |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `node tests/site-e2e/run.mjs`                                 | **103/103** (was 91) — 11 new                      |
| Five simulations + ownership guard                            | 145/145 · 34/34 · 43/43 · 25/25 · 30/30 · 26 areas |
| `pnpm lint` · `boundaries` · `check-types` · `test` · `build` | all pass                                           |
| `make gates` · `make demo`                                    | both green, artifacts unchanged                    |
| Committed bundle                                              | untouched — no capability/pack source changed      |

`pnpm --filter web test:e2e` was not required: no tenant spec and no
capability registry entry changed.

The eleven new E2E checks drive full lifecycles in a real browser — draft
through received for a purchase order, blocked through certified for a
subcontract, detected through an approved adenda for a change, assigned
through a locked week for hours — because that is where this session's own
bug actually turned up.

## The bug the tooling caught

**Sending a purchase order did not refresh its own open drawer.** Every other
drawer action (accept, receive, return) called `purchaseDrawer(id)` again
after mutating, so the drawer's buttons and status pill updated in place; the
`send` handler was written first, before that pattern settled, and just
showed a toast. The main list behind the drawer updated correctly (`mutate()`
re-renders `#view`), so the bug was invisible anywhere except inside the
drawer itself — exactly the kind of thing reading the code does not catch and
driving it in a browser does. The E2E check that found it (`compras: sending
an order refreshes the open drawer`) asserts the status pill's text actually
changes and the next action button actually appears, not just that no
exception was thrown.

A second, quieter one from the same family: `alerts()`'s new subcontract loop
crashed on the raw, un-migrated v1 fixture the migration sim deliberately
constructs — `this.state.subcontracts.filter(...)` with no fallback. Every
new read of that collection needed `|| []`, the same defence the codebase
already uses for `state.assignments` and `state.plans`.

## Decisions (ASSUMPTIONS.md #54)

1. A purchase order's status is **derived**, never stored.
2. **"Comprometido" includes awarded subcontracts**, not just orders.
3. **Entering the site is blocked**, not alerted, on bad documentation.
4. **Recording hours on a closed project is refused**, making the spec's own
   alert for it unreachable.
5. `priceChange`'s new parameter sits **before** `user`, because every
   existing caller has never passed one.
6. **A change's schedule effect is a separate, explicit action**, not
   something approval triggers automatically.
7. **The adenda has no cost or margin field.**
8. **A zero-hour grid cell deletes its entry** rather than leaving a stray row.

## Open issues for the next session

- Purchase orders have no link to a specific catalogue item, so the "aviso si
  difieren del precio presupuestado" (price-vs-budget warning) §4.1 asks for
  has nowhere to attach — it would need a real item reference on the order
  line first.
- The mobile "parte diario" variant of the hours grid (pre-loaded present/
  absent list, one confirm tap) is not built; the desktop weekly grid covers
  the same data.
- Template library and per-type automation rules for the adenda (§4.5) are
  still unbuilt — `renderChangeDoc` generates the content, not a chosen format.
- Still owed: `tests/i18n-coverage.mjs`, undo for the Gantt and the budget
  grid, and the §4.4 cost/cash S-curve and cost-composition drill-down noted
  in session 10a's own open issues.

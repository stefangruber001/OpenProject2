# Session 11 — Administración: conciliación, gestoría, comunicaciones

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/candi-programme-session-4-07amo8
Spec: intake/diorka/canei-spec-extracted.txt — §5.3 Conciliación bancaria,
  §5.4 Banco y caja, §5.6 Gestoría, §5.7 Comunicaciones. Read all four.
Plan + session index: docs/worklog/WORKLOG.md  (12 sessions; this was #11)

NEW CAPABILITY — packages/capabilities/reconciliation
  src/model.ts   BankMovement / CandidateDoc / MatchSuggestion / InternalTransfer
                 + RECONCILIATION_DEFAULTS and resolveReconciliationConfig()
                 — PLAIN, ZERO ZOD. The browser bundle imports THIS.
  src/config.ts  the zod schema, built FROM the defaults so they cannot drift.
                 Imported by manifest.ts only (tenant-file validation).
  src/match.ts   suggestMatches / suggestForAll / findInternalTransfers,
                 plus daysBetween and normalise. 24 tests.
  Weights: exact amount .45 · near amount .30 · same date .20 · near date .12
  · reference quoted .30 · counterparty named .15. DIRECTION IS A GATE, NOT A
  WEIGHT (a credit can never be explained by a bill). An amount outside
  tolerance returns null rather than a weak suggestion. A single document
  outranks a combination of equal confidence. Combinations stop at 3.
  References under 4 chars and counterparty words under 4 chars are ignored.

MESSAGING — packages/capabilities/messaging/src/rules.ts (NEW, also zod-free)
  CommsRule / COMMS_RULE_DEFAULTS (mode:"draft") / resolveRule / CommsEvent /
  PlannedMessage / planMessages(rules, events, {asOf}) / newMessages / messageKey.
  commsRuleSchema lives in src/model.ts and is NOT imported by the bundle.
  THE DEFAULT IS "draft". Everything in §5.7 hangs off that.

THE ZOD TRAP, HIT FOR THE THIRD TIME (sessions 9, 10a, 11)
  Importing a zod config schema into packages/erp-browser drags all of zod
  into the committed artifact (52 KB -> 190 KB this time). The fix is always
  the same: plain typed defaults + a zod-free resolve*() in the module the
  browser imports, zod schema in a separate module for tenant validation.
  After the fix: site/erp-factory.js is 62 KB with ZERO zod references.
  Check with: grep -c zod site/erp-factory.js

BRIDGE — site/erp-bridge.js, SURFACE_VERSION 6
  ErpBridge.reconciliation{available, suggest(erp,movId), suggestAll(erp,from,to),
    internalTransfers(erp,from,to), autoAcceptScore}
  ErpBridge.comms{available, render(text,vars), pending(erp), simulate(erp,rules)}

ENGINE — site/erp-engine.js
  §5.3 BNK: previewImport, unmatchMovement (also voids the payment/collection
    matchMovement created), unreconciledMovements(from,to),
    reconciliationCandidates(movId) (debits->open bills, credits->open invoices),
    flagMovementNoDoc (raises a task), closeBankPeriod (REFUSES while anything
    in range is unreconciled), reopenBankPeriod (reason REQUIRED),
    bankPeriodClosed(dateIso), voidCollection (mirror of voidPayment).
  §5.6 GES: packageBlocks(quarter) — 7 blocks, sev g/y/r, INDEPENDENT (an
    aggregate hides which one failed); fixedAssetRegister; lateDocuments (amber,
    never red, with alreadySent dedup against earlier packages);
    exceptionsWithStatus(quarter) — flattened, key "quarter|kind|ref";
    acceptException(quarter,key,reason,user) — reason REQUIRED;
    addGestoriaQuery/resolveGestoriaQuery; reopenQuarter(quarter,reason,user).
    quarterlyPackage(quarter, opts, user) is BLOCKING — throws naming up to 4
    outstanding exceptions. Still callable as (quarter, user). NO force flag:
    one was written and deliberately removed — §5.6 allows exactly two routes.
  §5.7 COM: addCommsTemplate; updateCommsTemplate (mints a NEW version, retires
    the old with supersededBy); commsTemplate(key,lang); addCommsRule/
    updateCommsRule; commsEvents() — a PROJECTION recomputed from current state,
    not a log, so a rule added today sees last week's overdue invoice;
    queueCommunication/approveCommunication/cancelCommunication/
    recordCommunicationSent. NOTHING SENDS.

UI — site/erp.html
  conciliacion(v) and comunicaciones(v) are standalone functions above the
  VIEWS map, referenced there by shorthand (same pattern as session 10b's four).
  Module state: recSel · comSel/comTab · REC_REASON · COM_FAMILY · COM_EVENT ·
  reconApi() · commsApi().
  gestoria(v) was REBUILT around packageBlocks + exceptionsWithStatus.
  banco(v) LOST its inline allocation input (§5.4 "retirando la parte de
  asignación") and gained #bToRec, a link into Conciliación. Do not put it back.
  New CSS: .rec .movrow .sugg .queuebar .comm .tpllist .tplbody .varchip
  .preview .blocks .blk .exrow.
  PLACEHOLDERS is now down to `reportes` alone.

SEED — site/erp-seed.js
  §5.3 statement lines: +98888 quoting FAC-2026-0002 (confidence .81), -179080
  quoting EB-3301 (.99), and a -60000/+60000 internal transfer pair across
  bank and till. §5.7: five templates across five families and three rules,
  all mode "draft".

SCHEMA v7 (site/erp-migrations.js): bankPeriods, commsTemplates, commsRules,
  commsQueue, gestoriaQueries, exceptionsAccepted. All additive and idempotent.

Ownership: banking-reconciliation engine->factory, comunicaciones-templates
unbuilt->factory, gestoria-package plannedSession cleared, reconciliation-
matching added (18 engine · 7 factory · 2 unbuilt, 27 areas).

ENVIRONMENT: Node 22 + pnpm 10. `pnpm install && pnpm lint && pnpm boundaries
&& pnpm check-types && pnpm test && pnpm build`, `make gates`, `make demo`,
`node tests/site-e2e/run.mjs` (121), the five sims under tests/simulation/.
The committed bundle CHANGED this session — rebuild with
`pnpm --filter @repo/erp-browser build` after touching a bundled capability.
`pnpm --filter web test:e2e` IS required here (the registry and the tenant
spec both changed); apps/web/playwright.config.ts now honours CHROME_PATH for
sandboxes whose pre-installed Chromium does not match Playwright's expected
build.

Next: session 12 (Torre, Mi Día, Recorrido, alerts) or session 8 (OCR bridge +
invoice capture), still open and independent of everything 9/10a/10b/11 built.

Start next by: reading erp.html's conciliacion/comunicaciones block (search
"Conciliación bancaria (spec §5.3)") and site/erp-engine.js's GES and COM
sections — between them they are this whole session.
```

## Goal

Per spec §5.3, §5.4, §5.6 and §5.7: assisted bank reconciliation that argues
its case; a quarterly accounting package that can refuse to go out; and a
communications module that prepares messages and never sends one.

## What changed

**Conciliación bancaria**, the session's centre of gravity and a new
capability. `@repo/capability-reconciliation` scores a statement line against
the documents that could explain it and returns suggestions that carry their
own reasons — exact amount, reference quoted, same counterparty — rather than
a bare number. That shape is the whole design. A person is being asked to
accept or reject a proposal, and "0,99" gives them nothing to judge on; a
confidence with no argument behind it trains people to click accept without
reading, which is precisely the failure the screen exists to prevent. The
screen renders the reasons next to every proposal for the same reason.

Direction is a gate rather than a weight: a credit can never be explained by a
supplier bill, so a wrong-direction candidate is excluded outright instead of
scoring low and slipping under a thin threshold. An amount outside tolerance
returns nothing at all — a suggestion nobody should accept is worse than no
suggestion. Combinations cover the one-transfer-pays-two-invoices case and
stop at three documents, past which the search finds coincidences rather than
explanations, and a single document always outranks a combination of equal
confidence. Mirrored pairs across accounts are detected as internal transfers
so they stop counting as both income and expense.

Closing a period refuses while anything in range is unreconciled, and
reopening one requires a written reason. A closed period whose entire value is
that it contains no open question cannot be allowed to contain one.

**Banco lost its allocation input.** §5.4 asks for it ("retirando la parte de
asignación, que pasa a realizarse íntegramente en Conciliación Bancaria") and
the reason holds up: matching a movement to its document and splitting it
across jobs are the same gesture, and doing them on two screens produced
movements assigned to a job with no invoice behind them. Banco keeps position,
movements and forecast, and hands over explicitly.

**Gestoría can now say no.** Before this session "Generar y registrar envío"
always succeeded, with the exception list sitting beside it as decoration —
which is exactly how a quarter goes out with four suppliers missing a tax id.
`quarterlyPackage` now throws, naming the outstanding items rather than
counting them, and the only way past is to justify each one by name with a
written reason. §5.6 allows exactly two routes ("la lista está a cero **o**
cuando el usuario justifica y acepta expresamente cada excepción") and this
session deliberately removed a third: an `opts.force` escape hatch was written
early, worked, and was taken back out, because an override nobody ever removes
is how a check stops meaning anything. The `year-sim` was updated to justify
each exception instead — which is what a real quarter-end does.

The screen around it gained the completeness blocks the spec asks for, one
traffic light per block rather than a single readiness flag: the blocks fail
independently, and an empty cash register in a quarter with no petty cash
reads identically to an empty issued-invoice register in a quarter that
billed, unless they are separated. Late documents are amber and never red —
an extemporaneous document is a fact to declare in its own block, not an error
to fix, and §5.6 wants that block to shrink over time, which needs it visible
rather than alarming.

**Comunicaciones prepares, and a person releases.** The rule default is
`mode: "draft"`, and that default is the most consequential decision in the
session: an ERP that mails customers by itself is one bad rule away from an
apology. "Aprobar" and "Registrar envío" are labelled honestly as the two
different things they do, and nothing on the screen puts a message on a wire —
the only thing that could is the messaging capability's email-out port, whose
sole bound adapter records and delivers nothing.

`commsEvents()` is a projection recomputed from current state, not an
append-only log. Somebody who adds "chase overdue invoices at 3 days" expects
it to catch the invoice that went overdue last week; an event log would only
ever apply to the future. Editing a template mints a new version and retires
the old one with `supersededBy`, so "which wording did the customer actually
receive" stays answerable after somebody improves it.

## Verification

| Check                                                         | Result                                             |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `node tests/site-e2e/run.mjs`                                 | **121/121** (was 103) — 18 new                     |
| Five simulations + ownership guard                            | 149/149 · 34/34 · 43/43 · 25/25 · 30/30 · 27 areas |
| `packages/capabilities/reconciliation`                        | 24 unit tests · `messaging/rules` 14               |
| `pnpm lint` · `boundaries` · `check-types` · `test` · `build` | all pass                                           |
| `make gates` · `make demo`                                    | both green, artifacts unchanged                    |
| `pnpm --filter web test:e2e`                                  | 5/5 — registry and tenant spec both changed        |
| Committed bundle                                              | 62 KB, **0 zod references**                        |

Confirmed on GitHub for `1883738`: `CI` run 187 green (all jobs, including the
committed-bundle drift check and the Playwright end-to-end job) and `Site E2E`
run 27 green. First push, no fixes needed.

The eighteen new E2E checks drive the refusals, not the happy paths: a
proposal that has to show its reasons, a period that refuses to close, a send
button that is disabled until every exception carries a justification, an
approve action whose own toast says it is not a send.

Two older checks were repointed rather than deleted. `shell: unbuilt
subsection` probed `conciliacion` as its example of a placeholder and now
probes `reportes`, the last one left. `erp: BNK-02 allocation` typed a project
number into the Banco screen; it now does the same thing on Conciliación,
where the gesture moved. Both are the same requirement asserted where it
currently lives.

## The trap that caught this session

**zod in the browser bundle, for the third time.** Importing
`reconciliationConfigSchema` so `createReconciliation` could `.parse()` its
argument took the committed artifact from 52 KB to 190 KB. Sessions 9 and 10a
hit the identical trap through `annexOptionsSchema` and a pack's package
index. The fix is always the same and is now documented in each capability's
own comments: plain typed defaults plus a zod-free `resolve*()` in the module
the browser imports, with the zod schema in a separate module used only for
tenant-file validation. `messaging/rules.ts` was written zod-free from the
start for the same reason, with `commsRuleSchema` moved out to `model.ts`.

The check that catches it in one line: `grep -c zod site/erp-factory.js`.

## Decisions (ASSUMPTIONS.md #55)

1. **Every suggestion carries its reasons**, and the screen renders them.
2. **Direction is a gate, not a weight**; out-of-tolerance returns nothing.
3. **A single document outranks a combination** of equal confidence.
4. **Allocation left the Banco screen** — casar y repartir is one gesture.
5. **`quarterlyPackage` refuses**, naming what is outstanding; no `force`.
6. **The completeness light is per block**, because blocks fail independently.
7. **Late documents are amber, never red.**
8. **The communications rule default is `draft`.**
9. **`commsEvents()` is a projection, not a log.**
10. **Template edits mint a version**, they do not overwrite.
11. **Closing a bank period refuses** while anything is unreconciled.

## Open issues for the next session

- Reconciliation learns nothing from an accepted match. A supplier whose
  statement text never contains the invoice number will be scored from scratch
  every time; remembering "this free text belonged to this counterparty" is
  the obvious next increment and needs a place to store it.
- Bank statement import is still the seeded `importMovements` path —
  `previewImport` exists and reports duplicates and period overlap, but no
  screen calls it, so a real file (Norma 43, CSV) has nowhere to land.
- The gestoría package is generated as an in-memory object; §5.6's actual
  deliverable is a file the accountant receives, and no export format has been
  chosen.
- Communications have one channel that does anything (none of them do). The
  WhatsApp and SMS options in the rule drawer are stored and never read, which
  is honest but should become a visible "not connected" state.
- Still owed from earlier sessions: `tests/i18n-coverage.mjs`, undo for the
  Gantt and the budget grid, the §4.4 cost/cash S-curve drill-down, the mobile
  parte diario, and the price-vs-budget warning on purchase orders.

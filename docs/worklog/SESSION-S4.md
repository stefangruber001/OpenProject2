# S4 · A lead learns to become a visit

> Context pack. What the visit lifecycle actually is, what the two new
> screens do and do not own, what the i18n guard's own limit turned out to
> be, and what S5 inherits.

## What was wrong

1. **`addVisit` was a single unconditional write.** There was no way to
   schedule a visit for a future date and capture it later — every visit in
   the system was created already "done", with measurements, photos and
   notes attached at creation time. That is not how a real visit works: it
   gets booked, then someone goes, then it gets written up.
2. **COM-01 Leads had no screen at all.** Opportunities lived inside
   `#oportunidades` behavior scattered across older screens; there was no
   register with next-action tracking or a place to record why a lead was
   lost.
3. **COM-02 Visita was the e2e suite's own "unbuilt screen" probe** — the
   canonical example of a route that resolves but explains itself as not
   built yet, inherited from S3.

## What exists now

|                     | Before                       | After                                                        |
| ------------------- | ---------------------------- | ------------------------------------------------------------ |
| Visit creation      | `addVisit` — one write, done | `scheduleVisit` → `completeVisit`, a real two-step lifecycle |
| Leads (COM-01)      | no screen                    | `#leads` — register, next action, loss tracking              |
| Visits (COM-02)     | placeholder                  | `#visits` — Programadas / Realizadas, fixed 6-row blocks     |
| Visit → presupuesto | no path                      | bare budget header created + linked, hands off to `#quotes`  |
| Schema              | v11                          | v12                                                          |

**The lifecycle is two engine methods, not a status field bolted onto the
old one.** `scheduleVisit(v, user)` creates a record with
`status:"scheduled"` and nothing captured. `completeVisit(id, patch, user)`
writes the capture fields (`measurements`, `photos`, `notes`, `assumptions`,
`exclusions`, `handwrittenEstimateRef`, `lines`) exactly once — it throws on
a visit that is already `"done"`, because the correction path for a
completed visit is the pre-existing `validateVisit`, not a second call to
`completeVisit`. Completing a visit moves its opportunity from
`awaitingVisit` to `awaitingBudget` automatically. `addVisit` keeps its old
one-argument-object signature exactly as it was; the 6 existing seed/history
call sites that only ever wrote finished visits do not owe a migration to a
lifecycle they never needed.

**`renderMasterList` (S2) grew three optional flags instead of a second
pagination implementation.** COM-02 is two fixed-height blocks — Programadas
and Realizadas — both reading the same `state.visits` collection filtered by
`status`, not two different kinds of record. `fixedSize` pins the page size
and hides the size selector (used by both blocks, six rows each);
`noExport` drops the export button (neither block exports); `noNew` drops
the "+ Nuevo" button (Realizadas has no direct-create path — a visit gets
created by scheduling one, not by adding a completed one from this screen).
All three default to off, so every S2/S3 screen already on the primitive is
unaffected.

**The presupuesto handoff stops deliberately short of COM-03.** S5 owns the
real three-pane builder. `visitDetailDrawer`'s "crear presupuesto" button
creates a bare budget header through the existing `createBudget`, links it
back to the visit via `validateVisit(visitId, {budgetId})` — the same
generic patch/correction path VIS-08 already provided — and navigates to
`#quotes`. Verified in e2e by asserting the hash actually becomes
`#quotes...`, not by asserting a function was called.

## The i18n guard's own limit, found the hard way

`tests/i18n/coverage.mjs` was green after the first translation pass — 29
new ES/EN/CA triples covering every new sentence, label and button — and it
was still wrong, because **the guard proves a dictionary entry exists, not
that a specific screen renders it.** Two real gaps only surfaced once a
real-browser check was added that actually visits `#leads` and `#visits`
under CA and EN and reads the DOM:

1. **The row-count tag never translates.** `renderMasterList` builds
   `"${n} ${n===1?sing:plur}"` as one dynamic text node — the same pattern
   `clientes`/`proveedores`/`registros` already use elsewhere, and those
   already have EN regex coverage (`^(\d+) clientes$` → `$1 customers`) but
   **no CA regex coverage at all**, for any of them. COM-01/02's new nouns
   (`oportunidad(es)`, `visita programada(s)`, `visita realizada(s)`) got the
   same EN regex pairs added, matching the established convention exactly.
   The CA side stays backlog, deliberately and consistently with every
   other screen using this pattern — decision 20 makes Catalan a ratchet,
   not an instant 100%, and singling out three new nouns for CA regex
   coverage while `clientes`/`proveedores` have none would be inconsistent,
   not more correct.
2. **"Programadas"/"Realizadas"/"Sin crear" are not the same string as
   "Programada"/"Realizada".** The singular status-pill words were in the
   dictionary from the first pass; the plural block-header words and the
   "not created yet" pill text were not, and the coverage guard's exact-match
   check had nothing to flag — the strings it knew about were fine, it just
   didn't know about these ones. Three more dictionary entries closed it.

**The lesson for S5 onward:** add a real-browser i18n check for every new
screen, in the same session that builds it, that reads the actual rendered
text under CA and EN — not only that `coverage.mjs` is green. The dictionary
check and the render check catch different bugs; S4 needed both.

## Decisions worth knowing

- **The server command whitelist was not touched.** `site/erp.html`
  persists everything through `ErpStore.saveState()` →
  `/api/<tenant>/erp/state`, a whole-document sync that already covers every
  mutation in the file, new ones included. The narrower
  `apps/web/lib/erp-commands.ts` whitelist backs a separate surface
  (`apps/web`'s server-rendered tenant pages) that neither S2 nor S3 extended
  for their own new engine methods either — extending it here for
  `scheduleVisit`/`completeVisit` would be scope invented mid-session, not a
  gap this session introduced.
- **Migration v12**, not more keys folded into v11. Backfills
  `status`/`scheduledAt`/`completedAt`/`owner`/`propertyId`/`budgetId` on
  every visit written before this session, all as `"done"` with the write
  date, which is exactly what they were.
- **`OPP_STATUS` pill colors and `loseOpportunity`'s reason list** both read
  from the S3-built `state.lists` (`lossReasons`) — the lost-reason prompt
  reads the active codes live, so retiring or renaming a reason in DMC-04
  changes what the lose dialog offers without a code change.

## What S5 inherits

`scheduleVisit`/`completeVisit` and the `visitDetailDrawer`/
`completeVisitDrawer`/`scheduleVisitDrawer` screens are done; COM-03 does not
need to build any part of the visit lifecycle, only read from it. The bare
budget header `visitDetailDrawer` creates (`createBudget` with no lines) is
what COM-03's three-pane builder opens into — S5 is filling in a screen that
already receives a linked, visit-sourced budget, not inventing the linkage.

`renderMasterList`'s `fixedSize`/`noExport`/`noNew` flags are available to
any screen that needs a compact, non-paginated block.

**Every string S5 adds must ship with Catalan, and must be checked with a
real-browser render assertion, not only `coverage.mjs`.** That second half
is new as of this session — S3's version of this sentence only asked for
the dictionary.

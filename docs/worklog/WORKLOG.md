# Worklog — CANEI functional-spec implementation

Rolling index, one line per coding session. Full detail (and the copy-pasteable
context pack for starting a fresh chat) is in each `SESSION-NN.md`.

The governing plan (12 sessions, model/effort per session, architecture) lives
in the operator's local plan file; the same content is restated at the top of
`SESSION-01.md` §Plan summary so it survives outside that file too.

**Relationship to other docs.** This is the first doc built specifically for
resuming a fresh chat mid-programme — there was no prior equivalent.
`docs/delivery/DIORKA-DELIVERY-PLAN.md` (R0-R4) is the closest predecessor: a
one-time plan-of-record for the earlier BRD, never updated after its first
commit, now marked superseded-by-this at its top. `PROGRESS.md` and
`ASSUMPTIONS.md` are the repo's own continuous logs (per `CLAUDE.md`) and
still get a short entry every session — this worklog is the _detailed_
companion to those, not a replacement.

**Where the spec is.** `intake/diorka/20260731_REQUERMIENTOS BÁSICO CANEI.docx`
is the source of truth; `intake/diorka/canei-spec-extracted.txt` is the same
content as greppable plain text — read that one. The older
`Proyecto_Diorka_Business_Requirements.docx` in the same folder is superseded,
but is still where the `XXX-00` requirement ids cited throughout the code
(MDM-03, CAP-04, GES-07 …) are defined.

**Continuing from anywhere.** Everything needed is in this repository: open it
on `main` — the trunk and the only long-lived branch — and read `CLAUDE.md` →
this file → the newest `SESSION-NN.md` context pack. Nothing lives on any one
machine. (Sessions 1-3 used `claude/orin-project-status-1q50dt` and sessions
4-12 used `claude/candi-programme-session-4-07amo8`; **both were retired on
2026-08-16** and neither is a place to start work. See ASSUMPTIONS #170.)
Check `node --version` first: sessions 1-3 ran on a host with no Node
toolchain and their worklogs describe workarounds (a JavaScriptCore shim, a
hand-edited lockfile) that are irrelevant wherever Node exists.

**Verification is automatic — the operator does not run anything between
sessions.** At the end of every session: commit, push to
the session's branch, then wait for the real `CI` and `Site E2E` workflow runs
and confirm they pass on GitHub's actual infrastructure — not a local
approximation. Use whatever this environment gives you to watch them: `gh run
watch` where the `gh` CLI is authenticated, the GitHub API/MCP tools where it
is not (session 4 had no `gh`). Only report a session done once that real run is green;
if it fails, fix and re-push before reporting. This applies in every future
session too, including ones started from a fresh chat off this file.

| #   | Session                                                | Status      | Commit(s)                          |
| --- | ------------------------------------------------------ | ----------- | ---------------------------------- |
| 1   | Close the CI gap, freeze the baseline                  | done        | 7195335                            |
| 2   | Capability bundle pipeline + bridge facade             | done        | defb928, 3134b29, 4854542, 5b14d52 |
| 3   | Data foundation: schema versions, blobs, store merge   | done        | 5bb2a43                            |
| 4   | Three-panel shell, global bar, retire pages            | done        | 0ed8513                            |
| 5   | Scheduling capability: calendar + CPM + baselines      | done        | 6e18112                            |
| 6   | Gantt UI (SVG drag/resize/link)                        | done        | d9e43a2, a83c49c                   |
| 7   | Extraction capability + Spanish profile                | done        | 4361085, 3e063c9                   |
| 8   | OCR bridge + invoice capture (Improvement #2)          | not started | —                                  |
| 9   | Budget builder + graphic annex (Improvement #1)        | done        | f2524b3                            |
| 10a | Projects: Gantt-from-budget, baselines, economics      | done        | ae543af                            |
| 10b | Compras, subcontratos, modificaciones, horas           | done        | 5e372ed                            |
| 11  | Administración: conciliación, gestoría, comunicaciones | done        | 1883738                            |
| 12  | Torre, Mi Día, Recorrido (Improvement #3), alerts      | done        | d2de900                            |

## The v4 programme (from 2026-08-08)

`General_Scheme_Canei_CRM_v4_EN.docx` redefines the product as six secciones.
The plan that converges the shipped app onto it runs S0 → S15; the table below
tracks it. The 22 decisions behind it (the doc wins except on Financials and
physical progress · keep the factory · hash routing survives · English code,
trilingual UI · server-first, always) are recorded with the plan.

| #   | Session                                              | Status | Commit(s)                          |
| --- | ---------------------------------------------------- | ------ | ---------------------------------- |
| S0  | Mapping & the doc's six open questions               | done   | a5f44a0, 35d1aa5, f6bf40f, 1ea2e90 |
| S0b | OCR spike — measure before committing to an approach | done   | 5874964                            |
| S1a | Integrate `main`; one history again                  | done   | 6aec167, 0180732, 34c0267, 952e2a7 |
| S1b | Navigation restructure + English rename + removals   | done   | f3fdb9c, d924da9                   |
| S1c | DMC-08 Usuarios and the role model                   | done   | c5e50da, 963ef1c, 00917e7          |
| S2  | DMT-01…04 Datos Maestros                             | done   | 03fc246, fa580b1, 0572cf8          |
| S3  | DMC-01…07 Configuración + Catalan                    | done   | 8e190d2, 27a1c0f, 3e34598, 23df2ce |
| S4  | COM-01 Leads + COM-02 Visita                         | done   | 03dcd5d, b758f6e                   |
| S5  | COM-03 Presupuestador                                | done   | b0250f7, 5eb0d21                   |
| S6  | OCR pipeline                                         | done   | 5890c58, 63dee70, 80dbe2a          |
| S7  | ADM-03 Facturas de proveedores + ADM-02 Compras      | done   | (this session)                     |
| S8  | PRY-01 integration + PRY-02 Avance Económico         | done   | (this session)                     |
| S9  | COM-04 Contrato + PRY-03 Adicionales                 | done   | (this session)                     |
| S10 | ADM-01 Facturación                                   | done   | (this session)                     |
| S11 | ADM-05 Banco + ADM-06 Caja + `accountCode`           | done   | (this session)                     |
| S12 | ADM-04 Horas + ADM-07 Gestoría + ADM-08 Flujo        | done   | (this session)                     |
| S13 | ADM-09 Datos Financieros integration                 | done   | (this session)                     |
| S14 | Mobile — cards, bottom bar, three-tap site actions   | done   | (this session)                     |
| S15 | Seed rebuild + workbook coverage test + hardening    | done   | (this session)                     |

## Package 1 — operator feedback on the shipped app (2026-08-11)

Thirteen changes across ten slides, all raised against the live preview. All
five work items are done; they carry the operator's own answers to the four
questions the deck left open.

| #   | What                                                                                     | State    |
| --- | ---------------------------------------------------------------------------------------- | -------- |
| P1  | The browser's prompt/confirm/alert replaced across the whole site                        | **done** |
| P2  | Visita: date/time defaults, real camera, the notes-wiped bug, photo viewer               | **done** |
| P3  | Lead → visita flow: pick the lead, second visit, complete a client inline                | **done** |
| P4  | Configurable lists: próximas acciones, condiciones de pago (lossReasons already existed) | **done** |
| P5  | Presupuestador: catalogue picker, chapter dropdown, columns, Siguiente paso              | **done** |

**Answers carried forward** (operator, in the thread): the line grid reads
DESCRIPCIÓN · UD · COSTE UNIT. · MARGEN % · CANTIDAD · P. VENTA UNIT. ·
PRECIO TOTAL, with the units checked explicitly; margin is margin **over the
sale price, everywhere**, not only in the builder; a second visit is allowed
and labelled _seguimiento_ rather than blocked; and creating a partida that the
search cannot find **opens the existing «＋ Nueva partida» form** rather than a
second one written for the popup.

**Closed (2026-08-11):** the strings the new questions and the photo viewer
introduced were Spanish only. `tests/i18n/coverage.mjs` checks that the
dictionary is consistent across the three languages, not that every literal
is in it — deliberately, see the note at the top of that file — so P1–P5
passed the gate while still falling back to Spanish in CA and EN. Backfilled:
108 ES→EN pairs, 112 ES→CA pairs, 9 regex rules per side for the strings that
carry a variable. See ASSUMPTIONS.md #153 for what was and was not in scope.

**One part of slide 9 is deliberately not done, and it is not a small
omission.** The note asks for the catalogue search on _"ambos, Partidas o
Subpartidas"_, and for a partida created on the fly to record _"relación con
la Partida en caso de ser una Subpartida"_. Partidas have both. **Subpartidas
have neither, because subpartidas have no editor at all** — `subLines` exists
on the line model and is read in exactly one place, to aggregate the quantity
when a line is measured in parts, and there is no screen anywhere that creates
or edits one. Adding the search to a screen that does not exist is not
possible; building the subline editor is its own unit of work that the rest of
the deck does not describe. It needs a decision from the operator about what a
subpartida is for in this product before it is worth building — measurement
detail (which is what the data model currently implies) or a catalogue
hierarchy (which is what the note implies).

## Package 2 — the operator's second pass (2026-08-11)

Eight slides, thirteen notes, all on the presupuesto→contrato half of the
system. They do not divide into one session: four of them need a way to
attach and reopen a real FILE, which does not exist yet, so that comes first
and the rest build on it.

| #     | Session                                                                      | Model    | Effort | State    |
| ----- | ---------------------------------------------------------------------------- | -------- | ------ | -------- |
| PK2-A | Shared evidence upload + viewer primitive · slide 3 as its first consumer    | Opus 5   | high   | **done** |
| PK2-B | Send drawer: WhatsApp, real email, manual date/time, PDF download · versions | Sonnet 5 | medium | **done** |
| PK2-C | Contract detail layout + the untranslated `garantías` keys · anexo viewer    | Sonnet 5 | medium | **done** |
| PK2-D | Contracts list: create/upload a contract by hand                             | Opus 5   | medium | **done** |

All eight slides are answered. Two of the four sessions turned out to be
covering for a bug rather than a missing feature — slide 6's raw
`executionAndFinishes` on the customer's contract, and slide 4's "no option
to create a contract", which was true of the whole application and not just
of that screen.

### PK2-A — **done**

Slide 3 asked for the acceptance justificante to be a document you can upload
and reopen, with the date it was accepted and who accepted it. The narrow
answer would have been a file input on one drawer. The wider one is what
landed, because slides 4 and 8 ask for the same thing on contracts and anexos:

- **`evidenceField(host, opts)`** — drop **or** browse, PDF or image, stored to
  the existing blob store the moment it is chosen (a file left in an `<input>`
  does not survive the next repaint — the lesson the visit drawer already
  learned). Produces `{ storageKey, name, type, size, uploadedAt }`.
- **The photo viewer became the evidence viewer.** It reads a PDF as well as a
  photograph, page by page, and every attachment chip carries `data-evidence`
  so it is delegated from the document like `img[data-blob]` already was. One
  viewer rather than two, so the arrows and Escape cannot work in one and not
  the other.
- **`acceptVersion` takes the file, a date and a person.** The date may be
  earlier than today — the answer arrives before anyone records it — and the
  opportunity's `decidedAt` follows the answer's day rather than today's, or a
  backdated acceptance lands in the wrong quarter on DAS-01.
- **The acceptance is readable afterwards**, in the builder's totals pane:
  date, person, and the document itself behind one click. Writing it and then
  hiding it would have been the same "a filename proves nothing" failure in a
  new place.

**Two real bugs fixed on the way, both pre-existing.** `GlobalWorkerOptions
.workerSrc` is set in exactly one place — `erp-ocr.js`'s private `loadPdfjs`
— and two screens bypassed it with a bare `import()`, so the purchase
comparison pane and the captured-document pane could only render a PDF if the
capture screen happened to have run first; otherwise the first render threw.
`loadPdfjs` is published now and all three callers use it.

**Owed, and named so it is not forgotten:** the bundled pdf.js (6.2.108) needs
a browser new enough for `Map.prototype.getOrInsertComputed`; Chromium 141
does not have it, so rendering fails there. The evidence viewer handles that
honestly — it offers the real file to the browser's own reader instead of a
dead "no se ha podido mostrar" — but **the two older panes do not**, and still
show that dead end on such a browser. They should get the same escape hatch,
or the vendored pdf.js should be pinned to a version that matches the browsers
the operator actually runs.

### PK2-B — **done**

Slide 2: the builder header named the version it was showing but gave no way
to reach any other one. Slide 1: the send drawer's three channels didn't do
anything channel-specific, and there was no way to get a PDF at all.

- **A version picker in the builder header** (`#bVerPick`), next to the
  existing `v1.1` label — every version, not only the current one. Picking
  one opens the read-only document Vista previa already knew how to render,
  rather than making the edit grid itself try to show two versions' data:
  only the current version is ever editable, so that stays exactly as it
  was. The picker snaps back to the version actually being edited once the
  document closes, so it never claims the builder is showing something it
  is not.
- **The "Versiones" list inside Vista previa is itself clickable now** —
  every other version is one click away from there too, and the one being
  viewed is marked (`viendo`) rather than left indistinguishable from the
  rest.
- **A real bug, only reachable once there was a way to view an older
  version**: the drawer title appended "(aceptada)" whenever the BUDGET had
  an accepted version anywhere, not only when the version on screen WAS that
  one. Invisible before this session, because nothing could open a
  non-accepted version's document; wrong on the very screen this session
  built. Fixed to check the version being shown, not the budget overall.
- **The send drawer's three channels now do three different things:**
  WhatsApp opens a real `wa.me` deep-link with the covering message
  pre-filled from the operator's own template, addressed to the party's
  mobile in E.164 form; email is recorded through the exact same log-only
  comms queue every other message in this system goes through — queued,
  approved and marked sent in one motion, because a person pressing this
  button IS the approval, not an automated rule bypassing one; "en mano"
  reveals a date and time field instead of the browser's `confirm()`-era
  approach of assuming "now", and the date may be backdated but never
  postdated — the same rule PK2-A's acceptance date already established.
- **A new comms template, `quote-send`**, seeded alongside the existing
  `quote-followup` — "Envío de presupuesto" is what actually goes out when a
  presupuesto is sent, and it belongs in Configuración → Comunicaciones like
  every other wording in this system, not hardcoded in the send drawer.
- **"⤓ Descargar" prints exactly the customer document.** No PDF library was
  added: the browser's own print dialog is the established pattern here
  (`#tPrint` already used it), and what was missing was isolating the
  document on its own sheet rather than printing the drawer and the rail
  around it. `budgetDrawer`'s `.doc` markup was pulled into
  `renderBudgetDocHtml()` so the download prints the identical HTML Vista
  previa shows on screen — never a second copy that could drift.

**Consciously not attempted:** a literal one-tap "attach the PDF and send" on
WhatsApp. A browser cannot push a file into WhatsApp on the user's behalf —
`wa.me` accepts pre-filled TEXT only, and doing better needs the WhatsApp
Business API, a real credential outside this session's scope (a candidate for
`INTEGRATIONS_PENDING.md` if the operator wants it built). Likewise "real"
email delivery: the mandate is explicit — no real emails, fakes behind ports
only — so the email channel goes through the same log-only queue as every
other communication in this system, honestly, rather than pretending to send.

### PK2-C — **done**

Slides 5 and 7: the contract detail screen's right-hand panel was pinned at
exactly 392px regardless of screen width, leaving a wide strip of nothing on
any real monitor and starving the Hitos de pago table into a horizontal
scrollbar it never needed. Slide 6: "Garantías" printed raw engine
vocabulary (`executionAndFinishes`, `installations`, `structural`) straight
onto the customer's own contract. Slide 8: the Anexos tab named an
amendment's number, date and amount but gave no way to see what it actually
was or reopen its backup.

- **`.con2`'s grid now lets the panel absorb whatever the document doesn't
  need**: `minmax(0, 760px) minmax(392px, 1fr)` in place of a fixed
  `392px`. The document stays capped near 760 — it is a fixed-width piece of
  paper and gains nothing from stretching further — and the panel takes the
  rest, which is what turned Hitos de pago's forced scrollbar into a table
  that simply fits. The existing E2E check that had `/392px$/` baked into it
  was itself testing for the bug; it now asserts the panel ends up WIDER
  than its old fixed value.
- **A `CON_GUARANTEE` label map**, matching the `CON_TRIGGER` pattern
  already used for installment triggers, wired into both the customer
  document (`contractDocPane`) and nowhere else — guarantees are only ever
  printed there today.
- **Anexos now show what the amendment was and let its backup be reopened.**
  Each row is looked up against the change record behind it (`desc`,
  `reason`) rather than showing only the annex's own thin
  `{number, date, valueCents}`. A real bug was fixed on the way to make the
  "reopen the backup" half possible at all: **"Aprobar" used to write a
  hardcoded fake filename** (`"aceptacion-cliente.png"`) the instant it was
  clicked — the exact "a filename proves nothing" bug PK2-A already fixed on
  the presupuesto's own acceptance, just one step upstream, at the
  approval that PRODUCES an anexo. `approveChange` now takes PK2-A's
  `evidence` shape, and a one-click button became a small drawer
  (`approveChangeDrawer`) with `evidenceField()`, matching the shape
  `budgetResponseDrawer` already established. Six pre-existing call sites
  (two simulations, two seed files, the history generator, and the one real
  UI call) were updated to the new `{ evidenceRef, evidence }` options
  object — no back-compat shim, since every caller was in this repository
  and could just be changed.

### PK2-D — **done**

Slide 4: _"No hay opción de crear/subir nuevo contrato"_. It was more literal
than it read. **No contract could be created from this application at all** —
not by hand, and not even from an accepted presupuesto. Every contract in the
system existed because the seed built it, so both halves of CON-01 were
missing at once. The session therefore delivers the normal path as well as
the one the slide asks for.

- **`＋ Nuevo contrato` on the Contratos list**, opening one drawer with two
  sources: **from an accepted presupuesto** (CON-02's own path — amount, IVA
  and customer come from the budget, never typed twice) and **signed outside
  this system** (on paper, by a lawyer, or before this ERP existed). One
  drawer rather than two buttons, because the choice is the first question
  the operator has to answer, not a decision they can make before they see
  what it means.
- **`registerExternalContract`**, deliberately not `createContract` with a
  null budget. CON-02 is a real rule and stays enforced for contracts this
  system draws up; recording one that already exists is a different fact.
  `origin: "generated" | "external"` carries the distinction.
- **The distinction is load-bearing, not cosmetic.** An externally-signed
  contract shows **the file the customer signed**; printing this system's own
  «CONTRATO DE OBRA» over the top of somebody else's contract would be
  inventing a document nobody agreed to. The structured data is still there
  in the panel beside it — that is what makes importe vigente, the anexos and
  ADM-08's cash forecast work — but it is an index of the contract, not the
  contract.
- **Payment milestones as rows**, not a parsed sentence: trigger + % + date,
  footing to 100% with an amber tag when they do not. "40% a la firma, 60% a
  la entrega" reads well and cannot be turned into dates and amounts without
  guessing, and these feed the cash forecast — a guess there is worse than a
  blank.
- **Dates may be backdated, never postdated** — contract date, signature date
  — the rule PK2-A and PK2-B already established. `signContract` takes a date
  now instead of always stamping today.
- **The completeness block offers a way through.** A contract is one of the
  two documents that block on an incomplete tercero (decision 21 / RD
  1619/2012), so rather than refusing and stopping, the drawer opens the
  client editor and comes back with everything already typed — the file
  included, since the blob is already in the store and only the record has to
  travel.

**A real bug fixed on the way, pre-existing and invisible until now.**
`nextNumber` is a side effect: it appends to `series.contract.issued` and
advances the counter whether or not the record survives. `createContract`
validated the mandatory execution term AFTER minting the number, so a
rejected contract left a permanent hole in a series ORG-04 requires to be
gap-free. Nothing exercised it before, because nothing could create a
contract. Both paths now validate before the number is minted, and the E2E
asserts the series and the contract count stay equal across a refusal.

### A verification gap, found by CI and worth naming

PK2-C went out with real CI red. The local sweep for these sessions ran
`boundaries`, `lint`, `check-types`, the two simulations, the i18n gate and
site E2E — but **not `pnpm test`**, which is where the vitest suites live.
`apps/web/lib/erp-commands.test.ts` pins each whitelisted engine method's
`Function.length` against the arity the server API declares, because the
server reads positional arguments off a request body: the count is part of
the wire contract.

PK2-C changed `approveChange(changeId, evidenceRef, user)` to take an options
object **with a default** — and a parameter with a default stops counting
towards `Function.length`, so the declared arity silently fell from 3 to 1.
Nothing in the browser noticed; the whitelist test did.

Fixed by not defaulting the parameter (`approveChange(changeId, opts, user)`,
destructured inside), which keeps the arity the API advertises. The lesson is
the checklist: **`pnpm test` belongs in every session's sweep**, alongside
the gates already run. `CLAUDE.md` lists it; these sessions skipped it.

## Package 3 — the operator's third pass (2026-08-12)

Six slides. Slide 3's premise was checked against the running app before
being accepted at face value: it names the Avance/Ficha tabs as the fix, but
the Gantt screen already has its own working progress-entry grid
(`progressTable`/`wireProgressTable`) that the tabs' own `panelAvance`
control does not — it writes only through `markProgress`, never back to the
Gantt's plan. The plan below reuses that grid as the single controller
rather than porting `panelAvance`'s logic sideways, per the operator's
explicit confirmation once the discrepancy was raised.

| #     | Session                                                                   | Model    | Effort      | State    |
| ----- | ------------------------------------------------------------------------- | -------- | ----------- | -------- |
| PK3-A | Presupuesto validity date · contract document sizing + scroll clearance   | Sonnet 5 | low         | **done** |
| PK3-B | Presupuestos toolbar + "＋ Presupuesto" creation from a visita or a lead  | Sonnet 5 | medium      | **done** |
| PK3-C | Merge Avance/Ficha into the Gantt's progress grid, %-only, desktop+mobile | Opus 5   | medium-high | **done** |

### PK3-A — **done**

Slide 5: a presupuesto's Validez date could be typed into the past — an
offer that has already expired before anyone reads it. Slide 6: the
contract document card showed unexplained blank white space around short
documents ("poco profesional"), and scrolling a long contract to its end
left FIRMA hidden.

- **`updateBudget` rejects a past `validityDate`.** This is the _inverse_ of
  the backdatable-but-never-postdatable rule established for
  `acceptVersion`/`issueVersion`/`signContract` — a validity date describes
  how long an offer stands going forward, not a past event, so the past is
  what has to be refused. The `min` attribute on `#bcValid` is the picker
  affordance; the engine check is what actually holds, since a picker's
  `min` never stops a typed or programmatic value. Confirmed the only
  editable `validityDate` input in the file (three other occurrences are
  read-only display spans).
- **`.condoc` gained `align-items: flex-start`.** No explicit `align-items`
  on a flex container defaults to `stretch`, which forced `.cdoc` to the
  full column height even for a document with far less content than that —
  the blank space the operator flagged. `flex-start` lets a short document
  size to its own content without touching how a long one renders, since a
  long document already grows past its container on flexbox's own
  content-based minimum regardless of `align-items`. Verified by reverting
  the fix (`git stash`) and re-measuring at an oversized viewport: without
  the fix the card stretched to the full container; with it, to its own
  content.
- **`.condoc`'s bottom padding grew to clear the fixed language pill.** The
  pill (`#canei-lang-pill`, `site/i18n.js`) sits fixed at the bottom-left of
  every page; the document's own scroll container is the right place to
  reserve room for it, since the pill is outside this screen's control.
  Verified against the seed's longest contract: without the extra padding
  the card's bottom edge (2984px) sat 27px below the pill's top (2957px) at
  maximum scroll; with it, the card clears the pill.

### PK3-B — **done**

Slide 4: `budgetList` (COM-03 Presupuestos) predated `renderMasterList` and
was a raw `<table>` with no search, no export, no pagination — grouped into
five stage sections instead. The only way to start a presupuesto was
"＋ Crear presupuesto" on an already-completed visit's own drawer, so a lead
with no visit yet had no path to one at all.

- **The register now runs on `renderMasterList`**, like every other list in
  the app. The five-stage grouping becomes an Estado pill column instead of
  a section heading — consistent with how Contratos and Facturas already
  show status — with `baseRows` still sorted by stage so drafts sort first
  and closed presupuestos last, the same reading the old grouping gave.
- **"＋ Presupuesto" opens a two-source drawer**: a completed visit (which
  links back exactly as the visit's own shortcut already does —
  `createBudget` then `validateVisit(v.id, {budgetId}, user)`) or an open
  lead — `opportunities` in `awaitingVisit` or `awaitingBudget` status, i.e.
  no presupuesto issued for that party yet — with **no visit required**, so
  a job the operator already knows enough about does not have to wait on a
  site visit being scheduled first.
- **No completeness gate here.** Decision 21 already covers a presupuesto —
  lead, visita and presupuesto proceed with whatever data exists; only
  contrato and factura block — so unlike `newContractDrawer` this drawer
  needs no client-editor detour.
- **Three pre-existing site-e2e checks read the old `tr.grouphd` markup**
  and had to be retargeted at the Estado pill rather than just gaining
  company — the same move PK2-C made on the `/392px$/` assertion that used
  to test for the bug it fixed. A new `testBudgetCreation` covers both
  creation paths, following `testContractCreation`'s shape. 416/416 site-e2e
  checks pass (411 + 5 new).

### PK3-C — **done**

Slides 1–3, and the largest of the three: PRY-01 had **two controls recording
the same fact**. The Gantt screen carried a grid of chapters and their
partidas that wrote through to the plan's own bars; PRY-01's «Avance» tab
carried a three-state control that wrote through `markProgress` alone. A
percentage typed in the tab never reached the chart or the S curve, so one
job could read 40 % on one screen and 0 % on the other. The slide asks for
one control, on the Gantt, and the operator added two constraints: it has to
work on a desk **and** on a phone, and it takes **percentages, not
quantities**.

- **One control, built from both.** From the grid: the chapter+partida
  structure and — the part that decides which one survives — the write path.
  A chapter with a bar goes through `recordProgress`, which writes the
  capability's task **and** calls `markProgress`; a partida goes through
  `markLineProgress` and then `syncProgress`, which carries the engine's
  rolled-up chapter figure back onto the bar. Either way both records move in
  one action. From the tab: the three contiguous state buttons and the
  percentage box that is live only in the middle state, including the mobile
  rule that collapses the strip to the single button saying where the row is
  now — so one tap cycles on a phone and three are visible on a desk. The
  same markup serves both; there is no second mobile control to keep correct.
- **The `<table>` became `.provrow` flex rows**, which is what makes the
  phone half work at all: a seven-column table forces sideways scrolling at
  390 px and a flex row does not. Verified at 390 px — no horizontal scroll,
  one visible state button.
- **The quantity column is gone.** It cost the record nothing:
  `markLineProgress` already converted a quantity into a percentage and
  stored only the percentage, so there was never a second figure to lose. The
  engine still accepts `qtyMilliDone`; nothing in the UI sends it.
- **A real if small bug fixed on the way.** The tab passed `null` as the
  percentage when «En ejecución» was pressed, and `markProgress` reads that
  as "write 50 over every line" — so tapping «En ejecución» on a chapter
  already at 40 % reset it to 50. The merged control keeps the figure the row
  already carries and falls back to 50 only when there is nothing to keep.
  That number came from somebody on site; it is not the view's to round off.
- **The chapter figure is asked of `chapterProgress`**, the engine's own
  value-weighted number, rather than averaged in the view. It is the same
  function `syncProgress` puts on the bars and the S curve reads, so the box,
  the bar above it and the curve cannot drift apart.
- **«Recalcular los cobros previstos» moved onto the Gantt** — moving a
  milestone is a thing done _to_ the plan, and the plan is there. The panel
  keeps one button, the door to the chart.
- **«Derivar del presupuesto» now asks before overwriting.** It is not
  additive: `mergeDerivedPlan` maps over the _derived_ tasks, so progress,
  baselines, status and pinned dates survive for the tasks that survive — but
  anything added by hand with ＋ Tarea or ◆ Hito is not regenerated from the
  budget and goes, along with dependencies drawn on the chart. The tooltip's
  "conservando el avance registrado" was true and was being read as
  "conserving everything". The confirmation counts the hand-made tasks it is
  about to discard.
- **The Avance and Ficha tabs are gone, and the tab strip with them** — a tab
  bar with one tab is a control that answers no question. Ficha's figures all
  had an owner elsewhere: venta/facturado/cobrado/por facturar are ADM-01's,
  extras aprobados is PRY-03's, and estado, cliente and the three dates are
  in the panel header directly above where the tab used to be.
- **The summary strip goes on `#progress` only** (slide 1), because the
  panel header repeats every field on it; the other four project screens keep
  it, since none of them has that header. **«Recientes» goes everywhere**
  (slide 1) — the recency it was built on stays, sorting the project
  selector, which is where somebody looking for a recent job already goes.
- **The list steps aside when a job is open** (slide 2). §3.2 says the list
  never disappears and everywhere else it does not; PRY-01 is the one screen
  where the panel is a working surface rather than a record to read, so it
  gets the width. Switching job is still one click in the bar above, and ✕
  brings the list straight back — verified.

Five site-e2e checks that read the old shapes (`[data-ptab]`, the `.phead` on
`#progress`, `[data-chap]` as an input, `#pnlResched`, and the
quantity→percentage conversion) were **retargeted rather than deleted**,
following PK2-C's precedent, and the merged control gained its own checks for
the two things a screenshot cannot show: that a state button moves the engine
and the bar together, and that a partida percentage is stored with its state
derived from it.

## Package 4 — PRY-01 becomes two screens (2026-08-12)

Same-day follow-on to Package 3, and the operator's own word for it was
"radical": delete the project bar, delete the panel between the list and the
chart, and let the chart itself be the job's screen. Two screens for physical
progress — the list of jobs, and one job — and nothing in between.

| #     | Session                                                      | Model    | Effort | State    |
| ----- | ------------------------------------------------------------ | -------- | ------ | -------- |
| PK4-A | Delete the PROYECTO bar and the panel; a row opens the chart | Sonnet 5 | medium | **done** |
| PK4-B | Replicate PK4-A onto PRY-02 Avance económico                 | Sonnet 5 | medium | **done** |

### PK4-A — **done**

The middle screen existed to state three figures — tareas, fin de obra
previsto, ruta crítica — and offer a button to the chart. All three are on the
chart already: the first two as toolbar chips, the rest in Desviaciones. A
screen whose whole job is a button to the next screen is a screen to delete.

- **A row opens the chart.** `progress` is now two plain states: the list
  (`renderMasterList` directly — no `renderCentre`, no panel) or `ganttScreen`.
  The row handler sets `ganttFull` **before** `setProject`, because
  `setProject` renders on its own and the other order paints the list first and
  the chart second.
- **The PROYECTO bar is gone from PRY-01 only.** Picking the job IS the list;
  a dropdown above it offered the same choice twice. The other four project
  screens keep the bar, because each is a single screen that has to be told
  which job it is about. Switching job is now back-then-click rather than a
  dropdown — one more click, which is what "exactly two screens" costs and
  what the operator asked for.
- **`← Obras`, labelled.** It is the only way back now, and its destination
  changed, so the bare `←` arrow got a word.
- **A real dead end fixed, found by asking what the first row of the list
  does.** Landing on the chart directly means an _unplanned_ job lands there
  too — and P-R014, the first row, has no accepted presupuesto at all. It
  therefore has no chapters to derive a plan from and no partidas to record
  progress against, so the old empty state's «Derivar del presupuesto» was a
  button that could only fail with "no tiene presupuesto aceptado". It is now
  disabled on such a job, and the screen says what is actually missing and
  offers the presupuesto instead. Verified in a browser before the change was
  written, and again after.
- **Deep links follow the same rule.** The five `go("progress", …)` call sites
  — alerts, universal search, the change register — now land on the chart,
  which is where the work is. The search result path was still seeding
  `centreState.progress`, a panel that no longer exists; it sets `ganttFull`
  now.
- **PK3-C's `hideListWhenOpen` is deleted, not left behind.** It was shipped
  an hour earlier to hide the list beside the open panel; with the panel gone
  it had nothing to do, and its `.ctr.on.solo` rule with it. `projectPanel`,
  `panelPlan` and `#pnlGantt` went the same way. `renderCentre` survives with
  one caller, PRY-02, which still wants a list beside a panel.

**A real bug fell out of the test rewrite, and it was not this session's.**
The check "project context survives a subsection change" used to read the bar's
own dropdown on PRY-01 and compare it to the same dropdown on PRY-02 — the bar
against itself. With no bar on PRY-01 the honest version compares `gProject`,
the actual context, to what the next screen's bar displays, and that failed:
`projectOptions()` is filtered (Abiertos by default), so whenever the active
job fell outside the filter the `<select>` had no matching `<option>` — and a
`<select>` with no match shows its FIRST one. The bar named one job while the
screen below rendered another. Fixed by adding the active job to its own option
list when the filter excludes it, so «Abiertos» still means what it says.
Reachable before this session too; the old assertion could not see it because
both halves of the comparison were the same lying control.

Six site-e2e sites moved with the screen — the `openGantt` helper lost its
click-through step, PK3-C's panel-shape checks became "a row lands on the
chart", and two i18n suites stopped opening a button that no longer exists.
Net: the screen lost a panel, a bar and ~90 lines, and gained an honest empty
state.

### PK4-B — **done**

Contrast run against PK4-A before writing any code: of the seven Físico
changes, only three had a real counterpart on Económico — deleting the
project bar, promoting the panel to full screen, and (on inspection) _not_
needing an empty state, because a project's `baseline.chapters` is populated
at creation time for both project-creation paths (`createProjectFromAcceptance`
and `createQuickProject`) and the seed confirms it: zero projects with an
empty baseline, so the panel's existing defensive fallback was already
sufficient. The remaining four PK3-C/PK4-A items (tabs, merged control,
moved button, derive-guard) have no PRY-02 equivalent to replicate.

- **The duplication was real and measured before touching code.** With a job
  open, the old project bar read `VENTA CONTRATADA 2.566 € · COSTE REAL
2.518 € · MARGEN ACTUAL 48 €` while the KPI cards two lines below read
  `Venta / Coste / Margen` — the same three figures twice, plus an `AVANCE
100%` the panel had no other use for. Deleting the bar on `#economics`
  removes it (same guard as PK4-A: `renderProjectBar` now excludes both
  `progress` and `economics`).
- **The chapter table had zero slack, also measured first.** At the old
  780px panel it fit 748px of content into 748px of space — the very next
  column, or one longer chapter name, would have started scrolling. Full
  screen measured 1410px, verified in a browser before committing to the
  change.
- **`renderCentre`/`centreState`/`centreOpen`/`centreClose`/`projectPanelHead`
  are deleted, not deprecated** — economics was their last caller once PRY-01
  retired them in PK4-A. `.ctr`/`.ctr.on`/`.ctrlist`/`.ctrpanel`/`.ctrhd` (and
  the mobile media-query overrides) go with them; `.ctrbody` survives as the
  padding rule on the new full-screen surface's scroll body, its one
  remaining caller.
- **`economicsScreen` mirrors `ganttScreen` exactly** — same `.pb`/`.pbbar`
  wrapper, same `← Obras` label, same flag-before-`setProject` ordering PK4-A
  established (`setProject` renders on its own, so setting `ecoFull` after it
  would paint the list once and the panel a moment later).
- **One test assertion lost its target entirely and was retired rather than
  patched**: PRY-02's own progress-bar display (`.ctrhd .bar`) was the thing
  the "one progress figure drives both PRY screens" check compared against —
  and it was itself part of the duplication being removed. There is nothing
  left in PRY-02's UI that shows physical progress; PRY-01 already owns that
  display. The check now verifies the panel opens cleanly on the same job
  after progress was recorded elsewhere, without asserting a number that no
  longer has anywhere to render.
- **Two more assertions had silently gone stale** while reading the _other_
  side of a comparison that assumed a bar existed on both progress and
  economics: "project context survives a subsection change" and the header
  fields/Recientes check both used to land on `#economics` to read `#psel`.
  With no bar on either PRY screen, both retarget to `#variations` (PRY-03),
  which still carries the bar.

Ten site-e2e checks were rewritten onto the full-screen shape (`.ctrpanel`
absent rather than `.ctrpanel .kpi` present, `#ecoBody` in place of
`.ctrpanel`, `#ecoBack` in place of `[data-ctrclose]`); the assign/split and
adjust-with-reason flows were left untouched, since their selectors
(`#as_go`, `#fc_save`, `[data-adj]`) were never scoped to the panel that
went. 422/422 passing.

## Package 5 — two things the operator hit on a real phone (2026-08-12)

Both raised from an iPhone against the live preview, and both global rather
than per-screen.

| #     | Session                                                           | Model  | Effort | State    |
| ----- | ----------------------------------------------------------------- | ------ | ------ | -------- |
| PK5-A | Cards that fit the phone · language switch moves to Configuración | Opus 5 | medium | **done** |
| PK5-B | The project bar becomes a chooser and nothing else                | Opus 5 | low    | **done** |

### PK5-A — **done**

**The cards were never readable on a phone, and the mobile sweep could not
see it.** The screenshots showed a two-column card whose labels and values
could not be on screen at the same time — scroll right for the values, left
for the labels. The cause is one global rule: `table { min-width: 520px }`,
there so a desktop table never collapses into unreadable columns. `width:100%`
cannot beat a `min-width`, so every carded table was laid out at 520px inside
a ~360px `.scroll` box and scrolled sideways under the thumb.

The reason this survived S14's 390px sweep is worth naming: `.scroll` carries
`overflow-x:auto`, so it absorbed the overflow internally and
`document.documentElement.scrollWidth` stayed exactly 390. **The check watched
the document, and the document was innocent.** The fix is
`table.cards { min-width: 0 }` — a card has no columns to preserve, so it has
no use for the floor — plus `flex-wrap` on the cell so a value too long to sit
beside its label drops to its own line, which is the "two-line card" the
specification asks for, arrived at only when the line actually needs two.

Verified on **28 routes** at 390px: no carded table overflows its container.
The new E2E guard was then confirmed to bite by re-breaking the rule on
purpose — it flagged visits, items, price-list, units, lead-sources and
payment-methods while `doc=390` stayed clean throughout, which is precisely
the blind spot being closed.

**The language pill moved into Configuración as DMC-09 «Idioma».** It was a
fixed pill bottom-left of every page: always reachable, always in the way —
to the point that PK3-A had to reserve blank space under the contract viewer
purely to stop it covering the end of the document (that clearance is now a
typographic choice rather than a workaround, and says so). A preference set
once or twice a year does not earn permanent screen space on a phone.

The screen is careful about a distinction the app already depends on: **this
is the language of the interface, for whoever is at the screen** — stored in
`localStorage`, so it follows the browser and not the account, and one
colleague reading in Catalan changes nothing for anybody else. **A document's
language is a field on that document**, chosen per customer, and nothing here
touches it; the screen says so in its own second card. The satellite pages
(journey, guides, master-data, financial-data) lost their switch and gained
nothing else — they read the same stored key, so the ERP owns the setting and
they honour it.

`injectToggle()` is deleted; `window.CANEI_I18N` gains `langs` and `set()`.
Two E2E checks that drove the pill now drive the real screen, and one asserts
the pill is _absent_. The section menu is asserted to list it, because a
screen only a URL can reach is not in Configuración in any useful sense.

**Two things the failing tests were right about.** The screen first shipped
with plain radios, and the E2E could not click them: `elementFromPoint` at the
radio's centre returned a sibling `<span>`, because `.opt` is only styled
inside `.bside` and had no layout here. A human would have got away with it —
the label still toggles — but a 13px control that is not its own hit target is
exactly the mobile problem this screen exists to answer, so the choices became
full-height buttons and the check now pins a minimum 30px target. Separately,
the test drove the flyout open with `toggleSection` and then navigated by URL,
which left the rail's absolutely-positioned subsection panel covering the
content; it now clicks the «Idioma» entry the way a person does, which is both
a truer path and what proves the menu lists it. A third failure was the
assertion doing its job on the product rather than on itself: the subsección
count is pinned, so adding Idioma turned `6×29` red until it was re-pinned at
30 — see ASSUMPTIONS #163(f), which records that this crosses a line S1B drew
deliberately, and why.

### PK5-B — **done**

**The project bar goes back to being a chooser.** Above Adicionales, Compras
and Horas sat a bar in two rows: the four controls that answer _which job_,
and under them a strip of summary figures — obra, cliente, dirección, estado,
avance with a progress bar, venta contratada, coste real, margen actual,
próximas fechas. Twelve figures above a screen that then shows its own. The
operator's verdict was that this is simply too much to read before reaching
the work, and that the economic ones have a home already: _"si requerimos ver
el progreso económico, vamos a avance económico"_ — which since PK4-B is a
screen built to explain exactly those numbers rather than to flash them.

So the strip is deleted. What remains is `.psel`: the search box, the job
dropdown, the favourite star and the status filter. The bar is one row on
desktop (51px) and wraps to three on a 390px phone, where it previously cost
most of the first screenful before any content appeared.

Two things went with the strip and are worth naming, because neither is a
loss the operator asked for and both had to be checked rather than assumed:

- the **client link** (`[data-party]` → DMT-01 drawer) was the strip's only
  interactive element. It is not re-homed. Every screen under the bar names
  its client already, and the customer record is one click from Maestros;
  a shortcut is not worth eleven figures of chrome.
- `erp.projectHeader(gProject)` is still called. Not for the strip — for the
  `<option>` fallback when `projectOptions()` returns nothing, and because
  its throw is how the bar detects a project id that no longer resolves.

The CSS for `.phead`, `.f`, `.sep` and `.pbar` under `.projbar` is deleted
rather than left orphaned, along with the 860px media query that only tuned
their spacing. `.psel` also loses its `border-bottom`, which was the divider
between the two rows and would otherwise have drawn a hairline one pixel
above the bar's own border.

The site-e2e check that pinned the strip (`.projbar .phead .f` ≥ 8, with
Cliente, Avance and Margen actual present) is replaced rather than deleted —
a check that only asserted the strip's absence would pass just as well on a
bar that had lost its dropdown. The new one asserts the bar exists, has
exactly **one** child row, carries all four controls, has no `.phead`, and
contains **no `€` anywhere** — the last being the part that keeps a figure
from creeping back later. 424/424 passing.

## Package 6 — the two things that were never built (2026-08-13)

Raised together with the project-bar rule. Both are _absences_ rather than
defects: a screen the operator went looking for and could not find, and a tool
that turned out to be far thinner than the job needs.

| #     | Session                                                     | Model  | Effort | State       |
| ----- | ----------------------------------------------------------- | ------ | ------ | ----------- |
| PK6-A | The invoice generator                                       | Opus 5 | high   | **done**    |
| PK6-B | Orden de compra as a multi-line builder, with annexes + OCR | Opus 5 | max    | not started |

PK6-B is explicitly **deferred by the operator** («For the moment, we will not
develope the purchase order generator»), not dropped. Its findings stand: the
engine's `addPurchase` is single-line by design with no `lines[]`, so it needs
a record change plus a v16 migration, and `committedByChapter` reads
`pu.chapterNum` — one chapter per order — so a multi-chapter order would make
chapter-level committed cost wrong unless it is computed from the lines.

### PK6-A — **done**

**«Other thing that I don't see is the invoice generator. Where is it?»** It
was nowhere. `issueInvoice` has been complete in the engine since S10 —
numbering, IVA, IRPF, MDM-10 completeness, CON-11's unsigned contract, CHG-04's
unapproved extra, AR-10's abono reference, the VFU-01 hash chain — and had
**zero callers**. The register was built `noNew: true`, and the Torre's
«＋ Factura» ran `go("invoicing")`: a button that looked like it created an
invoice and only navigated to a list that could not. You could win a job, quote
it, sign it, build it, and then not bill it.

**Four origins, because the business has four.** A milestone from the contract,
a certification against physical progress, an approved adicional, or free
lines — plus an abono against any issued invoice. Each is already a record
elsewhere, so `invoiceBases(projectId)` offers them with their own amounts and
wording rather than asking anybody to add them up again. The screen opens on
whichever origin actually has something in it.

The certification is the one worth reading. It emits the shape a certificación
has on paper: what has been executed, by chapter, **less what was already
certified**, equals this one. The deduction is a visible line rather than a
quietly reduced total, because a customer comparing two invoices needs to see
where the difference went — and because the alternative, splitting an aggregate
deduction back across chapters, would be inventing a distribution the system
does not know. On the seeded job the E2E now asserts the actual arithmetic:
executed 20.995 € less certified 14.313 € = 6.682 €.

**Three engine additions, and one deletion of duplication.** `invoiceBases` (the
four origins), `previewInvoice` (totals + document + refusals, persisting
nothing) and `renderInvoiceDoc` (the document projection the presupuesto and
the contrato already had and the factura did not). The rules live in exactly
one place, `_invoiceBlocks`: `issueInvoice` throws on its first entry and the
screen lists all of them. A second implementation for the screen would have
been a second implementation of the law — agreeing on the day it was written
and drifting silently from then on.

**A real numbering bug, found by moving the checks.** `nextNumber` mutates the
series: it increments the counter and pushes onto `issued`. The AR-10 and
CHG-04 checks sat **below the record literal**, so a refused credit note or an
unapproved extra had already consumed a number — one that then existed in a
series required by law to have no spare numbers, and on no document. Every
refusal now happens before minting, and the E2E asserts the series is byte-for-
byte unchanged across both refusals.

**A second, smaller one on the way past.** `issueInvoice` wrote the milestone's
invoice link as `installment.invoiceId`; the shape declares — and
`renderContractDoc` reads — `invoicedInvoiceId`. A billed milestone therefore
showed as invoiced with no invoice behind it. Now written under the declared
name, and the reader accepts the old spelling too, so milestones billed before
this fix resolve without a migration.

**And a third, in the CSS, which is PK5-A's bug in a place PK5-A could not
see.** The document sheet came out 560 px wide inside a 390 px phone. Two
causes, both instructive: `#invDoc` was a plain wrapper _around_ the sheet, and
a flex item with `width:auto` sizes to max-content — the contract's own
document, where `.cdoc` **is** the flex child and carries `width:100%`,
measures 388 in the same place. Underneath that sat the global
`table { min-width: 520px }`, the same floor PK5-A found behind the unreadable
cards: `table.cards { min-width: 0 }` fixed the lists, but a document's tables
are not cards — `autoCards` correctly skips a headerless two-column table — so
they kept the floor. A 356 px sheet was holding a 520 px table. Both fixed;
the sheet now measures 356 inside 390 with nothing scrolling sideways, and the
contract's document gets the same improvement for free.

The Torre's «＋ Factura» opens the generator. The register has «＋ Nueva
factura». An issued invoice offers «⤓ Descargar PDF» through the same
`.printsheet` + `window.print()` route the presupuesto uses.

**Not done, deliberately: `issueInvoice` is not added to the server command
whitelist.** See ASSUMPTIONS #166 — `site/erp.html` dispatches no named
commands at all, so the generator already persists in remote mode.

Ten new site-e2e checks; 434/434 passing, 118/118 vitest, 149/149 year sim,
226/226 manageability sim, boundaries · lint · check-types · i18n coverage all
green.

## Package 7 — what the acceptance test found (2026-08-27)

The V2 acceptance protocol (`CaneiUATE2EENV2.pdf`, 17 phases / 142 checks) was
run end to end: a colleague covered steps 1–106, the operator reviewed 107–132
and returned `20260827_Comments.docx`. Phase 15 passed in full. Phase 13 — bank
import · reconcile · seal — did not, and investigating the comments against
`main` turned up **five defects, four of which nobody had reported**.

The operator also settled the model that had been implicit until now, and it is
the spine of the package: **Gastos decides, Conciliación identifies, Avance
económico reports.** Cost is classified once, in Gastos — project · Partida ·
Subpartida · cuenta contable, split by percentage where it spans several. Bank
reconciliation exists to say _which document a bank line is_, for cash flow, and
never to assign cost. `cuenta contable` is the gestoría's own axis and is
unrelated to Partida/Subpartida. The whole agreement is written down in
`docs/worklog/PK7-SPEC.md`, committed in PK7-A so the screens in PK7-B onwards
are built to a rule that already exists on paper.

Two facts reshaped the plan. **A real quarter is ~535 movements** — the supplied
BBVA PDF has 535 rows and most are small card purchases — so requiring every one
to carry a document makes step 116's period seal, correct in principle,
unusable in practice; `gasto general` is therefore not document-only, and bulk
actions come before per-merchant rules. And **the operator's real bank data
never enters this repository**: it carries a live IBAN, full card numbers and
real names. Every check runs against synthesised BBVA-shaped fixtures.

### PK7-A · The numbers that aren't true (2026-08-27)

Four defects, one class: a number that is not true, held silently.

**111.** The importer had parsed the SALDO column into `balanceCents` since it
was written and never once used it, while `openingCents` defaulted to zero.
Measured against the operator's own file: 479 rows, 0 skipped, opening
24.000,00 + Σ −10.235,63 = **13.764,37**, matching the bank exactly — where the
product showed −10.235,63, short by precisely the opening balance and saying
nothing. `statementBalance(rows)` now derives the opening from the oldest row
(`saldo − importe`), reports opening · closing · sum · whether it closes, and is
computed over all parsed rows rather than the fresh ones, because a balance is a
chain and a chain with the duplicates removed is not the file's chain. It is
direction-agnostic; BBVA exports newest-first and other exports do not.

The check is **endpoints plus sum, deliberately, not a per-row running chain**.
A per-row chain is stricter and wrong more often: banks list same-date rows in
an order other than the one they applied them in, and refusing a valid statement
is the worse error. An import that does not close is refused **before anything
is written** — no half-import, no wrong balance sitting among the right ones.
A file with no SALDO column at all (the card export) returns `null`, says so in
amber, and imports: absent is honest, wrong is not.

A second check compares the resulting account balance against the statement's
closing figure and rolls the import back if they disagree — but **only when this
import established the opening balance**. The first version ran on every import
and took the browser suite to 546/550, failing correctly on correct imports into
accounts that already had movements from another period. The file's arithmetic
gates every import; the account comparison gates only the one that set the
opening. Narrowing it was the fix, and the narrowness is the point.

**A3.** `matchMovement` takes one target, so the interface looped over the
chosen documents — and the `if (!pays)` guard meant the first document absorbed
the whole movement, every later one was paid nothing, and `m.matched` named only
the last. `matchMovementSplit` replaces the loop with one payment carrying every
allocation, refusing an empty split, an over-allocation, and any mixing of
supplier and customer documents in one movement.

**A4.** `payBills` and `recordCollection` had no over-allocation guard, so
outstanding went negative in silence. Both refuse now, and name the honest
alternatives — several documents, an advance on account, a duplicate to be
refunded — instead of only saying no.

**117a.** `unreconciledMovements` took a period and no account, so the queue
showed every account whatever Cuentas y saldos had selected. That is the 533 the
operator saw under both the current account and the credit card — investigated
and cleared as demonstration data (the seed has 14) and as the preview panel
before the real cause was found. The parameter is optional; its absence still
means all accounts, because the period seal needs that.

Three new fixture-backed blocks in `tests/bank-import/run.mjs` (71/71): the
statement arithmetic, direction-independence, the opening balance proved
load-bearing as a property rather than a constant copied from real data,
end-to-end balance equality, a dropped row refused with nothing written, the
card export returning `null`, the two-invoice split, the over-payment refusal
and the account narrowing. Full gates green: **557/557** browser, 330/330
manageability, 149/149 year sim, 126 unit, lint · types · boundaries · i18n.

### PK7-B · Gastos decides, Conciliación identifies (2026-08-27)

The rule from `PK7-SPEC.md`, made structural rather than written down.

**Cuentas y saldos stops deciding.** It carried the whole movement register with
a Clase select and a Destino select on every row, and Destino could put a cost
on a project — a second door into a decision that already had one. It now
answers what it is for: one row per account with its balance, Total disponible,
import, undo import, and the **last five movements read-only**. The evidence
stays; the decision leaves. A balance with no sight of what moved it cannot be
sanity-checked, which is why removing the register is not the same as removing
the last five lines.

**Classification moved rather than vanished.** Saying WHAT a line is belongs in
Conciliación. Two identifications came across: which general expense a line is —
the **category**, not just the class, which a bare `rcClass` would have lost —
and whether an outgoing settles a card. Neither touches a project.
**«Asignar a proyecto» is gone**, and the E2E asserts its absence, because this
control has now moved three times and a removal nothing asserts comes back.

**What still writes a project onto a movement:** petty cash, by the operator's
own rule — cash spent on site belongs to a job and usually has no document. The
Caja drawer already carried the full cascade (project → its partidas → that
partida's subpartidas), so BNK-02's acceptance check moved there, where the
requirement now lives.

#### The gap that "keep reading" was hiding

Verifying that costs allocated from the bank screens still appear found that
they already did not, in exactly PK7-A's class: **the per-partida table did not
add up to the project it describes.**

Four views enumerated the same costs separately. `actualCostCents` counted bills,
labour, direct movement allocations and confirmed tickets. `chapterCosts` counted
all four. `chapterEconomics` counted **two**. `unassignedChapterCosts` — whose
entire job is to itemise the difference between the project total and the
partida rows — counted three and omitted movements. A petty-cash cost on a job
therefore contributed to the project's actual cost and appeared in **no row of
either table**: not in its partida, and not in the block that exists to say what
is missing. Measured on a fixture: project 15.000, partida rows 10.000,
pending 0.

Four enumerations of one thing disagree eventually; the only question is when.
They are now one. `projectCostRows(projectId)` yields every cost with the
partida it landed on or `null`, and the other four are views of it. The
invariant is asserted directly — **partida table + pending = project cost** —
after every kind of cost the simulation produces, and the negative control
confirms it goes red on precisely the old behaviour (`10000 + 0 ≠ 13000`).

`assignChapterSplit` now accepts a movement, so petty cash can be given its
partida from the block that lists it; before, that threw «Unknown cost source».
And `splitMovement` stopped stamping `class = "projectCost"` on splits that name
no project — a general expense labelled «coste de obra» while the allocation
underneath said otherwise.

**D1 was verified, not fixed.** Re-splitting a paid invoice across partidas
moves the cost, leaves `actualCostCents` unchanged and leaves the payment and
the match untouched. It already worked; it lacked a test saying so, and the
independence of the two axes is the whole claim of this package.

Fourteen new engine checks (344/344 manageability), the E2E rewritten where the
controls moved, and PK7-A's three untranslated statement-preview strings
translated — CI had gone red on the source-literal gate alone, at 231 against a
ceiling of 228, with every other gate green.

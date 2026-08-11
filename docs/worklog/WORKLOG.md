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
on the branch the session mandate designates (sessions 1-3 used
`claude/orin-project-status-1q50dt`, the default named in `CLAUDE.md`;
sessions 4-11 used `claude/candi-programme-session-4-07amo8`) and read `CLAUDE.md` → this
file → the newest `SESSION-NN.md` context pack. Nothing lives on any one
machine.
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

| #     | Session                                                                      | Model    | Effort |
| ----- | ---------------------------------------------------------------------------- | -------- | ------ |
| PK2-A | Shared evidence upload + viewer primitive · slide 3 as its first consumer    | Opus 5   | high   |
| PK2-B | Send drawer: WhatsApp, real email, manual date/time, PDF download · versions | Sonnet 5 | medium |
| PK2-C | Contract detail layout + the untranslated `garantías` keys · anexo viewer    | Sonnet 5 | medium |
| PK2-D | Contracts list: create/upload a contract by hand                             | Opus 5   | medium |

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

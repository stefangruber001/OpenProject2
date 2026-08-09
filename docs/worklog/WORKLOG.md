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

| #   | Session                                              | Status      | Commit(s)                          |
| --- | ---------------------------------------------------- | ----------- | ---------------------------------- |
| S0  | Mapping & the doc's six open questions               | done        | a5f44a0, 35d1aa5, f6bf40f, 1ea2e90 |
| S0b | OCR spike — measure before committing to an approach | done        | 5874964                            |
| S1a | Integrate `main`; one history again                  | done        | 6aec167, 0180732, 34c0267, 952e2a7 |
| S1b | Navigation restructure + English rename + removals   | done        | f3fdb9c, d924da9                   |
| S1c | DMC-08 Usuarios and the role model                   | done        | c5e50da, 963ef1c, 00917e7          |
| S2  | DMT-01…04 Datos Maestros                             | done        | 03fc246, fa580b1, 0572cf8          |
| S3  | DMC-01…07 Configuración + Catalan                    | done        | 8e190d2, 27a1c0f, 3e34598, 23df2ce |
| S4  | COM-01 Leads + COM-02 Visita                         | done        | 03dcd5d, b758f6e                   |
| S5  | COM-03 Presupuestador                                | done        | b0250f7, 5eb0d21                   |
| S6  | OCR pipeline                                         | done        | 5890c58, 63dee70, 80dbe2a          |
| S7  | ADM-03 Facturas de proveedores + ADM-02 Compras      | done        | (this session)                     |
| S8  | PRY-01 integration + PRY-02 Avance Económico         | done        | (this session)                     |
| S9  | COM-04 Contrato + PRY-03 Adicionales                 | done        | (this session)                     |
| S10 | ADM-01 Facturación                                   | done        | (this session)                     |
| S11 | ADM-05 Banco + ADM-06 Caja + `accountCode`           | done        | (this session)                     |
| S12 | ADM-04 Horas + ADM-07 Gestoría + ADM-08 Flujo        | done        | (this session)                     |
| S13 | ADM-09 Datos Financieros integration                 | not started | —                                  |
| S14 | Mobile — cards, bottom bar, three-tap site actions   | not started | —                                  |
| S15 | Seed rebuild + workbook coverage test + hardening    | not started | —                                  |

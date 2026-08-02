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
`claude/orin-project-status-1q50dt`, the default named in `CLAUDE.md`; session
4 used `claude/candi-programme-session-4-07amo8`) and read `CLAUDE.md` → this
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
| 9   | Budget builder + graphic annex (Improvement #1)        | not started | —                                  |
| 10a | Projects: Gantt-from-budget, baselines, economics      | not started | —                                  |
| 10b | Compras, subcontratos, modificaciones, horas           | not started | —                                  |
| 11  | Administración: conciliación, gestoría, comunicaciones | not started | —                                  |
| 12  | Torre, Mi Día, Recorrido (Improvement #3), alerts      | not started | —                                  |

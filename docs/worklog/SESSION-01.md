# Session 1 — Close the CI gap, freeze the baseline

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/orin-project-status-1q50dt
HEAD = tip of that branch after this session's commits (see "Commits" below
for the messages to find them by).

Spec: Requirements/20260731_REQUERMIENTOS BÁSICO CANEI.docx — a Spanish
functional spec (8 sections + 3 improvements + Anexo A code-contrast) for the
Canei Subirats ERP. Read docs/worklog/WORKLOG.md for the full 12-session plan
and where this session sits in it (#1 of 12, no dependencies).

Programme architecture (do not re-derive, do not revisit):
  1. HYBRID: new domain logic goes into packages/ as typed, boundary-linted
     capabilities; bundled by esbuild into site/erp-factory.js (+ .cjs for
     Node) — a browser-consumable module. site/erp-bridge.js is the seam:
     erp.html calls ErpBridge, never ErpFactory directly. erp-engine.js
     (today's 3,430-line hand-written engine) is retired area by area.
     Delegation flows ONE way: new code -> old, never old -> new, which is
     what keeps tests/simulation/*.mjs (they require() erp-engine.js
     directly) green through the whole programme.
  2. OCR (Improvement #2): Apple Vision / Android ML Kit via the existing iOS
     JS bridge (ios/CaneiSubirats/Web/WebViewStore.swift), Tesseract.js WASM
     fallback in plain browsers.
  3. Retire+redirect dashboard.html / clientes.html / frontend.html (all
     superseded by erp.html); repoint iOS Config.swift + Android
     MainActivity.kt tabs; unify 4 IndexedDB stores onto one dataset.
  4. Foundation first (sessions 1-4), then sections; improvements land inside
     their sections (#1 in session 9, #2 in session 8, #3 in session 12).
  5. Improvement #1 is ANNEX-ONLY (not inline-in-row): images attach to a
     partida but print only in a graphic annex at the end of the customer
     document, captioned with the partida's chapter+line+description. Spec
     §3.3 already reflects this ("Anexo gráfico del presupuesto").

Ownership now (site/erp-ownership.json): 18 areas "engine", 0 "factory",
6 "unbuilt" (scheduling-gantt, extraction-ocr, journey-project-selector,
comunicaciones-templates, three-panel-shell, budget-graphic-annex).
site/erp-bridge.js does NOT exist yet — nothing may be marked "factory"
until it does (enforced by tests/parity/ownership-guard.mjs).

Done in this session: CI now runs the business simulations + an ownership
guard on every push/PR (previously they only ran inside site-e2e.yml, which
itself only triggered on `main` — so a direct push to the dev branch could
reach the iOS/Android beta apps via /preview with ZERO test coverage). Real
state-v1 fixture captured from the actual seed (not fabricated) for the
future migration ladder (session 3). Parity-harness and ownership scaffolding
in place.

Deliberately not done: no product code touched, no packages/ changes, no
erp.html changes. Session 2 (bundle pipeline) is the next dependency-free
step; sessions 3/4 also depend only on session 1.

Gotchas hit: this working environment has no Node.js/pnpm runtime available
at all (confirmed: no node, npx, pnpm, deno, bun, or any JS engine except
macOS's built-in JavaScriptCore via `osascript -l JavaScript`). All Node
scripts in this session were nonetheless VERIFIED REAL by hand-building a
throwaway CommonJS/Node shim on top of JavaScriptCore (not committed to the
repo — it lives outside the working tree) and actually executing
site/erp-engine.js, site/erp-seed.js, tests/simulation/year-sim.mjs,
tests/simulation/manageability-sim.mjs, tests/fixtures/capture-state-
fixture.mjs and tests/parity/ownership-guard.mjs through it. Every number
reported below (145/145, 206/206, 34/34, fixture contents, guard pass/fail)
is a real execution result, not an estimate. A future session in an
environment WITH Node should re-run everything once via real `pnpm`/`node`
before trusting this further — the shim is a faithful-enough CommonJS loader
for these specific files but has not been fuzzed.

Start next by: run `pnpm install && pnpm lint && pnpm boundaries &&
pnpm check-types && pnpm test && pnpm build` for real once, to catch anything
the shim couldn't (turbo orchestration, TypeScript checking, actual esbuild/
next builds) before starting session 2's bundle pipeline.
```

## Goal

Per the plan: add `claude/**` to the site-e2e triggers, move the two business
simulations into `ci.yml`, capture current-shape state fixtures, and scaffold
`tests/parity/` + `site/erp-ownership.json`. No product change — everything
after this session is testable.

## The gap, confirmed

- `.github/workflows/site-e2e.yml` triggered on `push: branches: [main]` only
  (plus PRs and manual dispatch).
- `.github/workflows/preview-refresh.yml` triggers on `push` to the literal
  branch `claude/orin-project-status-1q50dt` and dispatches `pages.yml`, which
  republishes `/preview` from that branch on every such push.
- `ios/CaneiSubirats/Support/Config.swift` points `baseURL` at
  `.../preview/` — i.e. the TestFlight (and, via the Android twin, Play beta)
  build loads exactly what a dev-branch push just republished.
- Conclusion: a direct push to the dev branch could reach beta users having
  run through **zero** browser-level assertions and **zero** business-invariant
  checks. `ci.yml` (which does run on `claude/**`) checked lint/types/build
  but never executed `tests/simulation/*.mjs` or `tests/site-e2e/run.mjs`.

## What changed

**`.github/workflows/site-e2e.yml`**
- Push trigger branches: `[main]` → `[main, "claude/**"]`, with a comment
  explaining why.
- Removed the now-duplicated "Business simulations" step (they run
  unconditionally in `ci.yml` now, not gated on `site/**` paths, so a change
  in `packages/` that later reaches the engine through the bridge is checked
  too).

**`.github/workflows/ci.yml`**
- New job `simulations` (fast — no Postgres, no Playwright): installs deps,
  runs `node tests/simulation/year-sim.mjs 1`, the 2-year/2-per-month variant,
  `node tests/simulation/manageability-sim.mjs`, then
  `node tests/parity/ownership-guard.mjs`. Runs on every push to `main`/
  `claude/**` and every PR — same triggers as the existing `quality`,
  `persistence`, `e2e` jobs, no new path filter.

**`tests/fixtures/`** (new)
- `capture-state-fixture.mjs` — regenerates the fixture from the live seed.
- `state-v1-seed.json` — the actual captured output: 32 top-level keys, no
  `schemaVersion` field (today's implicit "v1" shape), 9 parties / 4 projects /
  4 budgets / 6 invoices. This is the "before" picture session 3's migration
  ladder will replay forward and re-verify against.
- `README.md` — what it's for and the one rule (don't regenerate casually).

**`tests/parity/`** (new)
- `ownership-guard.mjs` — validates `site/erp-ownership.json`: every area has
  a valid owner (`engine`/`factory`/`unbuilt`) and a `specSection`; hard-fails
  if anything is marked `factory` while `site/erp-bridge.js` doesn't exist.
- `README.md` — explains the guard (live now) and the `PARITY=1` dual-run mode
  the year-sim gains once the bridge exists (session 2+), and the two-commit
  migration discipline it's meant to enforce.

**`site/erp-ownership.json`** (new)
- 24 domain areas mapped from `erp-engine.js`'s own section dividers (ORG,
  MDM, CRM, CAT, SUP, PRE/QUO, CON, PRJ, CHG, PUR, CAP, AR, AP, BNK, LAB, FIN,
  GES, DAS) to spec sections, plus 6 genuinely greenfield areas
  (`scheduling-gantt`, `extraction-ocr`, `journey-project-selector`,
  `comunicaciones-templates`, `three-panel-shell`, `budget-graphic-annex`).
  All 18 engine-backed areas start `"owner": "engine"`; the 6 greenfield areas
  start `"owner": "unbuilt"`. Zero `"factory"` — correct, since the bridge
  doesn't exist yet.

**`docs/worklog/`** (new) — `WORKLOG.md` (rolling index) and this file.

## Verification actually performed

No Node.js runtime exists in this working environment (checked: `node`,
`npx`, `pnpm`, `deno`, `bun`, `volta`, `fnm` — all absent; only macOS's
built-in JavaScriptCore via `osascript -l JavaScript` is available). Rather
than skip verification, a throwaway CommonJS/Node-ESM shim was built on top
of JavaScriptCore (kept outside the repo, not committed) and used to actually
execute the real files:

| Check | Result |
|---|---|
| `node tests/simulation/year-sim.mjs 1` (baseline, before any edit) | **145/145 invariants passed** |
| `SIM_MONTHS=24 SIM_PPM=2 node tests/simulation/year-sim.mjs 1` (baseline) | **206/206 invariants passed** |
| `node tests/simulation/manageability-sim.mjs` (baseline) | **34/34 checks passed** |
| `node tests/fixtures/capture-state-fixture.mjs` (the committed script) | byte-identical to the committed `state-v1-seed.json` |
| `node tests/parity/ownership-guard.mjs` (current ownership file) | exit 0, "24 areas declared, all valid (18 engine · 0 factory · 6 unbuilt)" |
| ownership-guard on a deliberately corrupted copy (one area flipped to `"factory"`) | exit 1, correctly names the violated area and the reason — then reverted |
| Both edited workflow YAML files | parsed successfully with PyYAML, jobs and trigger branches/paths confirmed by structural inspection, not just visual review |

This is real execution evidence, not estimation — but it ran through a
hand-built shim, not real Node/pnpm/turbo.

**Update after pushing:** the real gate ran in GitHub Actions on commit
`646cbe5` (push to `claude/orin-project-status-1q50dt`) and came back green —
`CI` (jobs: Lint·Types·Test·Build, End-to-end, **Business simulations +
ownership guard** [new, 23s], Durable adapters/Postgres) all `success`, and
`Site E2E` (its first-ever run on this branch — proof the new trigger works)
also `success`. So the shim-based local verification above and the real CI
run agree; the open-issue caveat about unverified `pnpm` tooling is closed.

## Decisions (mirrored to ASSUMPTIONS.md #45)

1. Simulations run in `ci.yml` unconditionally (no `site/**` path filter),
   not duplicated in `site-e2e.yml`, because packages/-side changes in later
   sessions will reach `erp-engine.js`'s invariants through the bridge without
   necessarily touching `site/**` in the same commit.
2. The ownership file enumerates areas by `erp-engine.js`'s own section
   comments rather than inventing a new taxonomy, so it stays legible against
   the code it describes.
3. The state-v1 fixture is captured now, frozen, and explicitly NOT meant to
   be casually regenerated — its value is being a snapshot of the shape
   *before* `erp-seed.js` itself starts changing in later sessions.

## Files touched

```
.github/workflows/ci.yml            (new "simulations" job)
.github/workflows/site-e2e.yml      (push branches + dedup)
site/erp-ownership.json             (new)
tests/fixtures/README.md            (new)
tests/fixtures/capture-state-fixture.mjs   (new)
tests/fixtures/state-v1-seed.json   (new)
tests/parity/README.md              (new)
tests/parity/ownership-guard.mjs    (new)
docs/worklog/WORKLOG.md             (new)
docs/worklog/SESSION-01.md          (new, this file)
PROGRESS.md                         (short "Done" entry appended)
ASSUMPTIONS.md                      (#45 appended)
```

## Open issues for the next session

- `site/erp-bridge.js` doesn't exist yet — session 2's first job.
- (Resolved) The real `pnpm` gate has now run in real CI (commit `646cbe5`)
  and passed in full, including the new `simulations` job and the first-ever
  `Site E2E` run on this branch.

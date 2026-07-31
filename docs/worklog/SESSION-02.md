# Session 2 — Capability bundle pipeline + bridge facade

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/orin-project-status-1q50dt
Spec: "20260731_REQUERMIENTOS BÁSICO CANEI.docx" (see NOTE below)
Plan + session index: docs/worklog/WORKLOG.md  (12 sessions; this was #2)

THE SPEC IS IN THE REPO:
  intake/diorka/20260731_REQUERMIENTOS BÁSICO CANEI.docx   (source of truth)
  intake/diorka/canei-spec-extracted.txt                   (plain text — read
      this one; it is greppable and needs no Word). Section numbering matches
      the docx: 1 navigation · 2 Principal · 3 Comercial · 4 Proyectos ·
      5 Administración · 6 Contabilidad · 7 Datos Maestros · 8 Reportes ·
      Anexo A = the code-vs-spec gap table.
  intake/diorka/Proyecto_Diorka_Business_Requirements.docx is the OLDER,
      superseded BRD — useful for the XXX-00 requirement ids the code cites
      (MDM-03, CAP-04, GES-07 …), not for current scope.

THE SEAM NOW EXISTS. Architecture, concretely:

  packages/erp-browser/        HOST package (outside the boundary linter's
                               layer matrix, like packages/factory). Composes
                               capabilities; owns browser-safe port impls.
    src/index.ts               the surface: createScheduling(), BrowserIdGen,
                               defaultPorts(), SURFACE_VERSION
    build.mjs                  esbuild -> two committed artifacts
  site/erp-factory.js          GENERATED IIFE, window.ErpFactory (~5.7 KB)
  site/erp-factory.cjs         GENERATED CommonJS twin, for Node
  site/erp-bridge.js           the strangler seam (hand-written)
  site/erp-ownership.json      per-area migration state

  THE RULE: delegation flows NEW -> OLD, never back. erp-bridge.js may read
  erp-engine.js state and call ErpFactory; erp-engine.js must never know the
  bridge exists. That is what keeps tests/simulation/*.mjs (they require()
  erp-engine.js directly) green through the whole migration.

  erp.html loads: erp-engine.js, erp-seed.js, erp-factory.js, erp-bridge.js.
  Views call ErpBridge.*, never ErpFactory or engine internals directly.

Ownership now: 18 engine · 1 factory · 6 unbuilt (25 areas).
The one "factory" area is task-status-summary — task counts by status in the
Mi día Tareas card, computed by @repo/capability-scheduling. Deliberately a
read-side derivation of data the engine still owns; it proves the whole path
without moving ownership of anything.

To regenerate the bundle after changing a bundled capability:
  pnpm --filter @repo/erp-browser build
No Node locally? CI's `bundle` job builds it and uploads it as an artifact:
  gh run download <run-id> -n capability-bundle -D /tmp/bundle
CI enforces the committed copies match their source AND are tracked.

Next session is #3 (data foundation: schemaVersion + migration ladder +
blobs/meta object stores + one-way caneiMasterData import). It depends only
on session 1 and is unblocked. Session 5 (scheduling CPM) is also unblocked
and is pure TypeScript — it can run in parallel with 3/4.

Environment gotcha that will bite you: there is NO Node/pnpm/esbuild on this
machine (verified: node, npx, pnpm, yarn, deno, bun, esbuild all absent). Two
consequences: (a) you cannot build the bundle locally — use CI's artifact;
(b) `pnpm install` cannot regenerate pnpm-lock.yaml, so a new workspace
package needs its lockfile importer entry HAND-EDITED (this session did that
successfully — see "Lockfile" below for the exact shape). JS can still be
executed for real via macOS JavaScriptCore (`osascript -l JavaScript`) with a
small CommonJS shim; that is how erp-bridge.js was verified against real seed
data before pushing.

Start next by: reading docs/worklog/SESSION-01.md's context pack for the
programme-wide decisions, then session 3's brief in WORKLOG.md.
```

## Goal

Per the plan: `packages/erp-browser` + esbuild pipeline emitting a committed
browser bundle, `sideEffects: false` across the capabilities so zod
tree-shakes, `.prettierignore` in the same commit, a CI drift check, a
browser-safe `IdGenPort`, one real call through `site/erp-bridge.js`, and the
neutral glossary in `CLAUDE.md`.

## What changed

**`packages/erp-browser`** (new, host layer)
- `src/index.ts` — `createScheduling()`, `defaultPorts()`, `SURFACE_VERSION`,
  and `BrowserIdGen`. The kernel's `RandomIdGen` calls
  `globalThis.crypto.randomUUID()`, which is undefined in a non-secure context
  and in older WKWebView builds; there it would throw on first id and take the
  whole page down. The browser host injects a generator that degrades instead.
- `build.mjs` — esbuild → `site/erp-factory.js` (IIFE, `ErpFactory`) and
  `site/erp-factory.cjs` (CJS). Not minified on purpose: the artifact is
  reviewed in diffs, the site E2E asserts zero console errors and wants
  readable stack traces, and size is not the binding constraint. Banner
  carries no sha/timestamp — either would churn the artifact every build and
  make the drift check meaningless.
- `turbo.json` — `cache: false`, because the outputs land outside the package
  directory where turbo cannot track them correctly.

**Bundling correctness**
- `"sideEffects": false` added to all 16 capabilities + kernel. This is what
  lets esbuild drop `model.ts` (and with it zod) when only `SchedulingService`
  is used. Confirmed: the 5.7 KB bundle contains no zod, and CI now fails if
  `ZodError` ever appears.
- Browser target is `es2020`, not `es2019`/`safari14`. The conservative target
  made esbuild try to downlevel a dependency's destructuring and fail the
  build outright, and it had no audience anyway — every runtime that loads
  this bundle is a modern WebView.

**`site/erp-bridge.js`** (new) — projections + call surface, no business
rules. `tasksToPlan()` maps engine tasks `{owner, due, status:"open"|"done"}`
onto the capability's `{assignee, plannedStart/End, status, progressPct}`.
Degrades to empty results if the bundle is unavailable.

**`site/erp.html`** — loads the two new scripts and renders task counts by
status in the Mi día "Tareas" card via `ErpBridge.scheduling.taskSummary()`.
Renders nothing at all when the bridge is unavailable, so the page is never
worse off than before.

**Guardrails**
- `.prettierignore` gained both artifacts *in the same commit that created
  them* — `lint-staged` runs prettier over `*.js`/`*.cjs` and would otherwise
  reformat them on every commit, breaking the drift check permanently.
- `ci.yml` gained a `bundle` job: build → browser-safety assertions
  (`ErpFactory` present, no `ZodError`) → **tracked + unchanged** → upload
  artifact. The tracked check matters because `git diff` ignores untracked
  files, so a deleted-from-index artifact would otherwise pass silently.
- `CLAUDE.md` gained the neutral glossary (line item / measurement / tax /
  withholding …) because the literal linter scans comments too and this
  domain's natural vocabulary is exactly what it forbids, plus a host-layer
  section explaining why `packages/erp-browser` may compose freely.

## Lockfile

`pnpm install` is impossible here, so the importer entry for the new package
was hand-written. It worked (`--frozen-lockfile` passed in CI on the first
try). Shape, for the next time this is needed — insert alphabetically into
`importers:`, and note every version referenced must already exist in the
lockfile's `packages:`/`snapshots:` sections (esbuild@0.28.1 and typescript
already did):

```yaml
  packages/erp-browser:
    dependencies:
      '@repo/capability-scheduling':
        specifier: workspace:*
        version: link:../capabilities/scheduling
    devDependencies:
      esbuild:
        specifier: ^0.28.1
        version: 0.28.1
```

`@types/node` was initially forgotten, which broke `check-types` —
`@repo/typescript-config/node-library.json` sets `types: ["node"]`, so every
package extending it needs that devDependency.

## Verification

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` with the hand-edited lockfile | passed in CI |
| Bundle build + browser-safety (`ErpFactory` present, no `ZodError`) | passed; 5.7 KB |
| Bridge against the real seed dataset (via the JavaScriptCore shim) | 2 engine tasks → 2 scheduling tasks; summary `2 planned`; overdue correctly returns both, relative to the dataset's `today` (2026-05-05) |
| Ownership guard with the first `factory` area declared | exit 0 — 18 engine · 1 factory · 6 unbuilt |
| Degraded path — bridge loaded with the bundle absent | `available:false`, `taskSummary`/`overdueTasks` return `[]`, nothing thrown, so `erp.html` renders exactly as before |
| Bundle drift check with enforcement live | passed — the committed artifact matches CI's rebuild byte-for-byte |
| Site E2E (drives erp.html in a real browser, asserts zero console errors) | success on commit 5b14d52 |

## Decisions (ASSUMPTIONS.md #46)

1. `workflow_dispatch` cannot be reached on a non-default branch, and this
   work never pushes to `main`, so the bundle build lives in `ci.yml` (which
   already runs on `claude/**`) and uploads its output as an artifact. That
   also gives a Node-less machine a way to obtain a built bundle.
2. Browser target raised to `es2020` (see above).
3. The first bridge call is a *derived read*, not an ownership move. Moving a
   write path in the same session that introduces the seam would have
   confounded "is the pipeline correct?" with "is the migration correct?".

## Open issues for the next session

- The parity harness (`PARITY=1` in `year-sim.mjs`) is still scaffolding; it
  becomes necessary the first time an area is genuinely dual-implemented,
  which is session 5/6 at the earliest.
- `tests/i18n-coverage.mjs` (ratchet for untranslated new Spanish UI) is not
  built yet. The three labels added this session were hand-checked into
  `i18n-dict.js`; a mechanical check is still owed before the UI grows much.

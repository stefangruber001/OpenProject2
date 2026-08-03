# PROGRESS — ERP Factory build state

> **Resume protocol:** a cold restart with no memory reads THIS file, `CLAUDE.md`,
> and the task list below, then continues the next task. Never re-plan from
> scratch. Never ask the operator anything — decide, log in `ASSUMPTIONS.md`,
> proceed (see the autonomy contract summarised in `CLAUDE.md`).

## Mission (one line)

Build a **factory** that turns a tenant spec into a running, tested, compliant
ERP — kernel + capability modules + jurisdiction packs + vertical packs,
composed at resolve time. Tenant #1: Spanish reformas SME. The ERP is the
output; the factory is the product.

## Phase board

| Phase                | Scope                                                                                                                                                                      | Status                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| P0 Foundation        | layers as real packages, boundary linter in CI, spec composition, ADRs, CLAUDE.md                                                                                          | **DONE** ✅                                     |
| P1 Walking skeleton  | factory CLI, tenant #1, presupuesto→factura w/ effective-dated IVA + justification, negative test, make bootstrap/demo                                                     | **DONE** ✅ (PDF pending — HTML artifact today) |
| P2 Packs build-out   | durable persistence (Prisma+RLS), es-ES filings/jornada/N43, reformas certificaciones/bc3, real scheduling/time/procurement/docs capabilities, web UI on composed services | **next**                                        |
| P3 Pipeline          | provision → deploy → verify → rollback, idempotent; packaging (build outputs, PWA/Tauri shells)                                                                            | pending                                         |
| P4 Fleet             | control plane, inventory (seeded: `tenants/INDEX.md`), wave rollout, health gates, backup/restore drill                                                                    | pending                                         |
| P5 Proof & hardening | formal timed tenant #2/#3 onboarding, offboarding export drill, docs, honest final RISKS                                                                                   | pending                                         |

## Done (chronological)

1. Pre-mandate foundation: Turborepo, Next.js 16 web app, Prisma+Postgres data
   layer, Vitest+Playwright, CI, Husky. Green.
2. Governance: PROGRESS/ASSUMPTIONS/LEGAL_REVIEW/OBJECTIONS/RISKS/
   INTEGRATIONS_PENDING/OPEN_QUESTIONS + CLAUDE.md.
3. Compliance research (2026-07-16, cited in LEGAL_REVIEW.md): **Verifactu
   postponed to 2027-01-01 (IS) / 2027-07-01 (rest) by RD-ley 15/2025**;
   IVA 10% renovation = 3 cumulative conditions (art. 91.Uno.2.10º).
4. `@repo/kernel` 1.0.0 — ports/registry, resolve-time pack composition with
   strict composed config schema, effective dating (refuses to guess), integer
   money (cents/millis/bp), append-only events, injected clock/ids. 16 tests.
5. `@repo/capability-quoting` + `@repo/capability-billing` — zero jurisdiction
   knowledge; immutable invoices, gapless numbering, rectificativa path,
   required `tax@1` port, optional chain/labels ports, deterministic HTML
   renderer. 9 tests + fake-adapter proof.
6. `@repo/pack-jurisdiction-es-es` — effective-dated IVA tables, renovation
   reduced-rate decision engine w/ persisted justification, SHA-256 invoice
   chain, Spanish labels, IRPF retention profiles, **hard resolve-time gate on
   verifactu.enabled**. `@repo/pack-vertical-construction-reformas` —
   mediciones, construction.* attribute contract, terminology config. 21 tests.
7. `@repo/boundary-lint` — layer matrix + forbidden-literal scan in CI
   (`pnpm boundaries`), committed violation fixtures proven caught; already
   caught+fixed a real locale leak in kernel docs.
8. `@repo/factory` — resolve|validate|new-tenant|demo CLI; tenant #1
   `reformas-demo` (§11 composition); demo: 3-partida presupuesto → FAC-2026-0001
   at 10% (art. 91.Uno.2.10º justification persisted) + FAC-2026-0002 at 21%
   (reasoned refusal) + chained seals + 8 deterministic artifacts.
   **Negative test (§12.3) passing.** Tenant #2 `azulejos-lopez` created
   config-only in 0.02s. `make bootstrap|demo|gates`.
9. ADRs 0005–0012 (composition, enforcement, topology/RLS, effective dating,
   spec-driven composition, core-vs-config, N×M bridges, stack). README carries
   the marginal-cost metric table.

**All root gates green:** lint · check-types · test (63 tests across 8 suites)
· build · boundaries. Every commit green and pushed to
`claude/orin-project-status-1q50dt`.

10. **Canei Subirats identity + English working language** — DONE this cycle
    (commits 91d5958, 3af7c0b, 1017827). Real client identity confirmed:
    **Canei Subirats, S.L.** (Sant Just Desvern; their public WordPress site,
    NOT a gestor tool — earlier note corrected). Corporate identity captured
    durably in `docs/clients/canei-subirats/BRAND.md` (palette #48733C/#65BC7B
    - yellow spark, Roboto Serif/Inter, logo refs, name story, voice, 5
      services, 3 trust pillars, contact); wired as **data** into
      `tenants/diorka` branding (kernel branding schema extended with generic,
      jurisdiction-neutral tokens: slogan/contact/palette/typography/logo) +
      real billing seller (CIF still pending → §11.1 workshop). UI switched to
      **English working language** via a DATA label layer (`apps/web/lib/i18n.ts`
      en/es/ca, `UI_LANG` env, default en) + reformas `terminologyByLang` /
      `chapterLabels` (canonical chapter keys unchanged); fiscal locale stays
      es-ES. Handover = flip `UI_LANG`. Published demo/backend/landing re-skinned
      to Canei brand + English (fiscal invoice stays es-ES); Chromium-verified.
      Gates green each commit.

11. **Control Tower dashboard + email drafting** — DONE this cycle (commits
    46b0bc2, 018d9be). "Execute the plan fully" (logged ASSUMPTIONS #27–28):
    shipped the demonstrable whole-journey slice. `site/dashboard.html` — a
    visual Customer Journey Control Tower: 12-stage lifecycle (lead→profit)
    with drill-down, per-project financial control
    (budget/committed/actual/revenue/margin/cash/forecast) with money
    waterfall, and the full dashboard suite (pipeline, quote margin, AR aging,
    AP due, purchasing-vs-budget, 6-week cash forecast in/out, company
    performance, supplier comparison). Colours follow the dataviz skill
    (single-hue brand green for magnitude, reserved good/warn/crit with
    icons+labels; palette validated). Emails auto-draft per lifecycle event
    with one-click Send routed through a **log-only** adapter (never
    delivered). Backed by real code: NEW `@repo/capability-messaging`
    (draft-from-data templates, `email-out@1` optional port, `LogOnlyOutbox`,
    5 tests), registered + composed into `diorka` (8 capabilities, templates
    as tenant data). Chromium-verified; all gates green.

12. **Remaining BRD core capabilities** — DONE this cycle (commit 71477ea).
    Four generic, tested, kernel-only capabilities filling the biggest gaps,
    registered + composed into `diorka` (now 12 capabilities):
    `projects` (PRJ/CHG/FIN — immutable baseline from accepted quote,
    committed/actual cost booking, change orders preserving baseline, margin +
    quoted-vs-actual by chapter, forecast, margin-floor flag; 6 tests);
    `receivables` (AR — receipts with partial allocation across invoices,
    outstanding/overdue, aging buckets, due list; 4 tests); `payables`
    (AP — supplier bills with duplicate supplier+number detection, partial
    payments, due list; 4 tests); `crm` (customers, leads on a configurable
    pipeline, next-action + overdue, pipeline summary; 4 tests). All gates
    green; REQUIREMENTS-MAP updated (CRM/PRJ/CHG/AR/AP/FIN → built). These are
    the domain engines behind the Control Tower; durable persistence + web UI
    surfaces are the remaining follow-ups.

## Capability layer — COMPLETE (16 capabilities, zero stubs)

13. **Rest of the capability layer** — DONE (commits f23e959, c55d605):
    `procurement` (PUR), `scheduling` (PLN), `time` (labour→cost), `docs`
    (DOC + blob-store port), `visits` (VIS), `access` (ORG-05..07
    roles/permissions). With the earlier projects/receivables/payables/crm/
    messaging, `diorka` composes **16 real, tested capabilities** — every BRD
    functional area now has a domain engine (185+ tests across the repo).

14. **Live app on durable storage** — DONE (commit 9f9238d): `buildServices`
    constructs all 14 capability engines when selected and exposes an
    `aggregates` KeyValueStore (Prisma+RLS when DATABASE_URL — the same
    adapter the CI persistence job contract-tests — in-memory otherwise).
    `GET /api/[tenant]/control-tower` computes the live overview (crm
    pipeline, per-project financials, AR/AP outstanding, committed, overdue
    tasks, access checks) from the REAL services over persisted aggregates;
    seeds on first call, reads back after. Integration test in
    `apps/web/lib/control-tower.test.ts`. The app is the running system now,
    not a mirror.

15. **E2E flow test + premium redesign + review-request + Outlook drafts** —
    DONE this cycle. Headless-tested the whole lead→invoice journey (all 13
    stages, ledger balances, zero JS errors) and built the one missing step: a
    **review request** — added as the 13th lifecycle stage (`lead → profit →
review`) in `site/journey.html` and `site/dashboard.html`, closing the
    reputation loop. Applied a lighter-white, winning-website design language
    (larger display type, generous whitespace, layered soft shadows, gradient
    accents, brand-mark SVG everywhere) to the journey, Control Tower and
    landing pages. Customer emails now render **full corporate identity** and
    export as an **Outlook draft (`.eml`, `X-Unsent:1` → editable compose
    window)** carrying a **dependency-free generated PDF** attachment. Real
    Graph save-to-Drafts logged in `INTEGRATIONS_PENDING.md`
    (`outlook-drafts@1`, pending tenant M365 creds). All static; nothing sent.

## Remaining (UI surfaces + packaging)

- **Web pages** over the live services (the API + engines exist): branded
  quote PDF (QUO-15/16 — Chromium renderer already in-repo), supplier/item
  registers (CAT/SUP), owner dashboards (DAS), consolidated view (ORG-04).
- **Web surfaces**: branded quote PDF (QUO-15/16); supplier/item registers
  (CAT/SUP UI); owner dashboards (DAS); consolidated owner view (ORG-04).
- **PWA shell** for mobile site-visit capture (NFR-03/04) over `visits`.
- **NFR-10** Catalan handover: flip `UI_LANG`, add a `ca` doc-label set (data).
- **P3/P4**: provision→deploy→verify→rollback pipeline; backup/restore drill;
  timed tenant #2 onboarding.

## Next 3 tasks (P2 — in order)

0. ~~**P2.1a Async persistence seam** — DONE: kernel store ports
   (Repository/AppendOnly/Counter/KeyValue) + in-memory adapters + exported
   contract-test kits (`@repo/kernel` `src/testing/contracts.ts`); quoting,
   billing, numbering, es chain and factory composition now run on injected
   async stores. Demo output byte-identical pre/post. 58+ tests green.~~
1. ~~**P2.1b Durable adapters** — LANDED (verification runs in CI):
   generic Prisma schema (tenants, JSONB aggregates/artifacts, counters,
   kv_state, events — layer-neutral, all `tenant_id`-keyed), migration
   `0001_init` incl. **RLS ENABLE+FORCE + tenant_isolation policies** on every
   table; Prisma adapters for all kernel store ports + PrismaEventLog, each
   setting `app.tenant_id` per transaction; they run the SAME contract kits
   (`@repo/kernel/testing`) — skipped without DATABASE_URL, executed in the
   new CI `persistence` job (postgres:17 service, migrate deploy + seed +
   tests); CI now also triggers on pushes to `claude/**`; chain-head durable
   KV reachable via `resolveTenant(..., {packInfra})` hook.~~
   **Verified 2026-07-17:** CI run 29557702359 — `conclusion: success`, all
   jobs green incl. "Durable adapters (Postgres + RLS contract tests)"
   (postgres:17 service, migrate deploy + seed + contract kits + cross-tenant
   invisibility). The store adapters are live-database-proven.
2. ~~**P2.2a Web ERP shell, first slice** — DONE: `/[tenant]` workspace
   resolves the spec server-side, builds composed services (Prisma+RLS stores
   when DATABASE_URL set, in-memory otherwise), lists presupuestos/facturas,
   issues presupuesto→factura via server action, serves the rendered factura
   at `/[tenant]/facturas/[id]`. e2e covers the full flow (3 Playwright tests
   green). Tenant links on the home page.~~
   2b. ~~**Diorka onboarding (REAL intake)** — DONE this cycle: baseline "ERP
   START INPUT" pinned (`docs/ERP-START-INPUT.md`, tag erp-start-input, SHA
   539c530); intake archived (`intake/diorka/` BRD + extraction) with full
   `REQUIREMENTS-MAP.md`; tenant `diorka` + owner-group registry
   (`tenants/_groups/diorka.yaml`) resolve+demo green in 0.79s config-only;
   NEW `sourcing` capability (multi-bidder comparison: dated/sourced prices,
   group totals, abs/% variance vs baseline, missing≠zero, explicit
   selection — digitizes their Comparatiu workbook); quoting gained optional
   items + selective acceptance + versioned revisions (QUO-07/12/13);
   reformas pack ships the 18-chapter catalogue (BRD Appendix A.2).
   **CI-verified: run #6 (faa77c5) success — gates + Postgres/RLS + e2e.**
   Current tool identified: cane.gestortectic.com = TecTic "Gestor"
   (login-gated) → migration lead in INTEGRATIONS_PENDING.~~
3. **P2.2b Diorka-first web forms** (R1 of docs/delivery/DIORKA-DELIVERY-PLAN.md): presupuesto creation UI (chapter picker
   from pack config, partidas with mediciones, options), comparison screen
   (sourcing report), accept-with-options; PDF via `doc-render@1`
   (Chromium renderer exists). Design rule: minimal typing, catalogue-first
   (BRD NFR-01/02, "very non-digital user").
4. **P2.3 AR/AP slice (Diorka Critical)**: customer receipts + partial
   allocation, supplier bills w/ duplicate detection + due lists (AR-04/05,
   AP-01..04); then es-ES filings tagging (Modelo 303/390/347/111/115/190),
   N43 fixture import, registro de jornada.
5. **P2.4 CRM light + owner dashboards + certificaciones**: customers/leads/
   next-action (CRM-01..06), per-owner-profile views + alerts (DAS-01..03),
   quoted-vs-actual per partida preserving baseline (CHG/PRJ; also tenant
   #1's stated biggest pain). Consolidated group view over
   `tenants/_groups/*` (ORG-04).

## Blockers & chosen workarounds

- **GitHub Pages publish (site/)**: workflow + site committed and will
  auto-deploy to https://stefangruber001.github.io/OpenProject2/ the moment
  Pages is possible — run 29585500450 failed instantly because Pages is not
  available for PRIVATE repos on the Free plan. Operator options: (a) GitHub
  Pro upgrade (repo stays private; only site/ becomes public), (b) a separate
  public preview repo (needs operator to authorize repo creation — outside
  this session's repo scope), (c) keep using the claude.ai artifact links.
  Never: making THIS repo public (intake/ contains business documents).
- **Unattended multi-day loop**: creating a scheduled fresh-session Routine
  (2-hourly, PROGRESS.md-driven) was attempted but the scheduler MCP requires
  interactive approval this autonomous session cannot grant. Workaround: the
  resume protocol operates via (a) any operator nudge, or (b) any new session
  in this environment — CLAUDE.md routes it to this file. Operator can enable
  the true unattended loop by approving a create_trigger call (fresh session
  per fire, cron `0 */2 * * *`, prompt = "read CLAUDE.md + PROGRESS.md, do
  the next unit green, push, verify CI").

- **No Docker daemon in this sandbox** → P1 proven on in-memory adapters;
  P2 Prisma work runs `prisma migrate diff`-style checks + CI Postgres service
  (CI has services; local uses docker-compose when available).
- **No real AEAT/FACe/bank credentials** → fakes behind ports
  (INTEGRATIONS_PENDING.md). Verifactu certified mode hard-gated off.
- **Prettier vs template placeholders** → `tenants/_template` is
  prettier-ignored (placeholders aren't YAML flow maps). Fixed + smoke-tested.
- Session context finite → this file is the checkpoint; resume from "Next 3
  tasks". No force-push, no history rewrite (mandate §3).

## Mobile app (iOS shell) — P3 packaging seed

- **Premium native SwiftUI iOS app** shipped in `ios/` — a shell over the live
  GitHub-Pages web app, so web changes flow to the app with no App Store update
  (only native-shell changes need a rebuild). Animated splash, custom floating
  tab bar (haptics + gold pill), translucent top bar with progress line,
  pull-to-refresh, offline auto-recovery (NWPathMonitor), native share, file
  exports via WKDownloadDelegate, JS⇄native bridge, injected `native-app` CSS to
  collapse the web header in-shell. Ready-to-open Xcode 16 project + XcodeGen
  fallback; fastlane `beta` lane; manual-dispatch-only TestFlight CI (no failure
  emails). Non-technical **iOS Beta Onboarding PDF** at
  `site/Canei-Subirats-iOS-Beta-Onboarding.pdf` (linked from the landing page).
  See ASSUMPTIONS.md #36. Not compiled here (no Xcode on Linux) — static +
  independent review + Chromium embed check; XcodeGen guarantees a valid project.

## Marginal cost of tenant #N+1 (minutes of human/agent time)

| Tenant                 | Minutes                                                                                              | Evidence                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------- |
| #1 reformas-demo       | n/a (built with the factory itself)                                                                  | this repo                             |
| #2 azulejos-lopez      | ~0.0003 (0.02s, `new-tenant`, config-only, zero code) — formal timed onboarding w/ real intake in P5 | `tenants/azulejos-lopez/`, CLI timing |
| #2 target (P5, formal) | **< 15**                                                                                             | to be timed                           |

## Definition-of-done tracker (mandate §12)

1. `make bootstrap && make demo` on clean machine → **working today** (in-memory
   runtime; “deployed with durable DB” arrives with P2/P3). Factura is
   legally-_defensible-by-design_ (justification persisted) but
   `legally_verified:false` until asesor review.
2. Tenant #2 config-only <15 min → **mechanism proven (0.02s)**; formal timed
   run with real intake pending (P5).
3. Negative test (no jurisdiction ⇒ loud failure) → **passing in CI**
   (`packages/factory/src/negative.test.ts`).
4. P0–P5 complete → P0 ✅ P1 ✅ (PDF pending) · P2–P5 open.
5. Governance files current → ✅ (this update).

## CANEI functional-spec programme (site/ + packages/ bridge)

A 12-session plan turns `Requirements/20260731_REQUERMIENTOS BÁSICO CANEI.docx`
into code: new domain logic lands in `packages/` as typed capabilities,
bundled by esbuild into `site/erp-factory.js`, reached through a new
`site/erp-bridge.js` seam; `site/erp-engine.js` (today's hand-written engine)
is retired area by area, never the other way round. Full plan, session
sequence, model/effort per session and architecture in `docs/worklog/
WORKLOG.md`; each session's detail (and a copy-pasteable context pack for a
fresh chat) is in `docs/worklog/SESSION-NN.md`.

- **Session 1 — done (ASSUMPTIONS.md #45).** Closed a real gap: a push to the
  dev branch could reach the iOS/Android beta apps via `/preview` with zero
  test coverage (`site-e2e.yml` only ran on `main`). Now runs on `claude/**`
  too; the two business simulations moved into a new `ci.yml` job
  (`simulations`) alongside a new `tests/parity/ownership-guard.mjs` guarding
  `site/erp-ownership.json` — the per-area migration-state record the rest of
  the programme depends on. Captured a frozen real state-v1 fixture
  (`tests/fixtures/state-v1-seed.json`) for the future migration ladder. No
  product code changed.
- **Session 2 — done (ASSUMPTIONS.md #46).** The seam exists.
  `packages/erp-browser` (host layer) bundles typed capabilities with esbuild
  into committed artifacts `site/erp-factory.{js,cjs}`, which
  `site/erp-bridge.js` calls on behalf of `erp.html` — enforcing the rule the
  whole migration rests on: delegation flows new→old, never back, so the Node
  simulations against `erp-engine.js` keep passing untouched. First real call
  across the seam: task counts by status in Mi día, computed by
  `@repo/capability-scheduling`. zod tree-shakes out (5.7 KB bundle); CI
  builds, asserts browser-safety, and fails on drift or an untracked artifact.
  `CLAUDE.md` gained the neutral glossary the literal linter demands.
- **Session 3 — done (ASSUMPTIONS.md #47).** The persisted state now has a
  version and a single owner. `site/erp-migrations.js` is a pure, idempotent
  ladder (v1→v2 additive; a newer-than-build blob throws rather than being
  downgraded); `site/erp-store.js` is the only module touching IndexedDB
  (`caneiERP` v2 adds `blobs` + `meta`, `kv`/"state" unchanged, pre-migration
  backup written). Fixed a live bug: `index.html` opened the database at a
  hardcoded version and would have blanked the launchpad with `VersionError`
  once the schema upgraded. Legacy `caneiMasterData` customers now fold in
  one-way and non-destructively, with anything ambiguous surfaced for review
  instead of auto-merged. Two new simulations in CI (23/23, 25/25).
- **Session 4 — done (ASSUMPTIONS.md #48).** The ERP is now one workspace with
  the spec's three-panel shell: sections (always visible) → subsections (open
  on demand, collapse on choice or outside click) → content, with a bottom bar
  and sheet on phones. A global bar landed with it: universal search across
  clients, suppliers, projects, budgets, invoices and documents (grouped by
  type, a hit opens the record); a "+ Crear" menu contextual to the active
  section, calling the engine's own entry points so every validation still
  applies; an alert bell with a live count and drill-down; and a period
  selector (year/quarter/month/range) that filters the invoice, movement and
  hours lists and always says how many rows it is hiding. `index.html`,
  `dashboard.html`, `clientes.html` and `frontend.html` are retired to
  redirect stubs, and both native shells' tabs now deep-link into the
  workspace's sections. Spec'd-but-unbuilt subsections say what will live
  there instead of opening blank. Site E2E: 53/53.
- **Session 5 — done (ASSUMPTIONS.md #49).** `@repo/capability-scheduling`
  grew from a task list into a planning engine: a working calendar supplied as
  data (no weekend, closure or country hardcoded — a five-day week is a local
  convention, so the neutral fallback works every day), finish-to-start,
  start-to-start and finish-to-finish dependencies with positive and negative
  lag, a forward/backward CPM pass yielding total float and the critical path,
  cycles refused by name, and append-only baselines whose drift is reported in
  working days. Dragging a task sets a start-no-earlier-than pin, so it holds
  a human's date while its successors still follow. Every new field is
  optional, so the plans `site/erp-bridge.js` builds by hand keep scheduling
  unmigrated. 30 vitest tests, plus a new simulation that drives the whole
  engine through the **committed browser bundle** (16 checks, in CI) — the
  artifact the phones load is a separate claim from the source being right.
  No UI: the chart is session 6, and `scheduling-gantt` stays `unbuilt` until
  a screen actually reaches it.
- **Session 6 — done (ASSUMPTIONS.md #50).** The Gantt. Proyectos →
  Seguimiento técnico is now an SVG chart over the session-5 engine: bars with
  the critical path in red, float tails, milestones, dependency arrows,
  frozen-baseline ghosts and the contract's payment milestones on the same
  timeline, with the working calendar editable as chips. Pointer-event
  gestures — drag to move (which sets a start-no-earlier-than pin, so
  successors still follow), edge-drag to resize, drag between bars to link —
  share one path for mouse, pen and touch, because the ERP runs inside two
  WebViews. **The view computes no dates:** every bar position, float,
  critical flag, finish date and baseline drift is asked of
  `@repo/capability-scheduling` through `ErpBridge.scheduling.plans`. Plans
  persist per project in `state.plans` (schema v3), riding in the engine's
  blob without `erp-engine.js` knowing they exist. `scheduling-gantt` becomes
  the first `factory`-owned area. Site E2E 64/64, including a check that
  closing the finish day pushes the plan's finish out.
- **Session 7 — done (ASSUMPTIONS.md #51).** The reading half of photo
  capture (spec §5.2), in two halves that know nothing of each other. New
  `@repo/capability-extraction` turns recognised text into candidate fields
  with a confidence, a provenance (line, offsets, page — what lets a
  validation screen highlight where a number was read from) and arithmetic
  that reconciles; its `confirmed` field is the literal type `false`, so no
  caller can persist something that looks confirmed — CAP-04 enforced by the
  type system rather than by discipline. All locale knowledge sits behind the
  new required port `extraction-profile@1`: `@repo/pack-jurisdiction-es-es`
  supplies NIF/NIE/CIF and IBAN check characters, `1.234,56`, `14/03/2026` and
  "2 de abril de 2026" (Spanish and Catalan), the keyword sets, and the rates
  in force on a date read from its effective-dated tables. The capability's own
  tests run against a profile for an invented country — if they pass, it cannot
  be carrying Spanish knowledge. Registered and composed into tenant #1
  (17 capabilities, 4 bound ports); `make demo` and the negative test unchanged.
  No camera, no OCR engine, no UI: that is session 8.
- **Session 9 — done (ASSUMPTIONS.md #52).** The budget constructor of §3.3 and
  the graphic annex (Improvement #1). Presupuestos now opens a three-zone
  constructor: the chapter/line tree with per-chapter totals on the left, an
  editable spreadsheet grid in the centre (code, description, unit, quantity,
  cost price, sale price, amount, margin, line status), and a totals panel on
  the right that recalculates on every keystroke — base, tax, withholding,
  total, cost, margin in euros and per cent, and the value of the lines still
  pending a price. **The view computes no money:** every one of those figures
  comes from `erp.budgetTotals()`, the same function the emitted document uses,
  so the live panel cannot drift from the document. Editing goes through
  `erp.editLine()`, which refuses on a frozen, issued or accepted version.
  The graphic annex is owned by `@repo/capability-docs` (`annex.ts`) and
  reached through `ErpBridge.docs.annex`: pictures attach to a line and print
  **at the end of the document**, after the totals and before the conditions,
  grouped and ordered by chapter and line number, each captioned with both plus
  a short description, numbered correlatively when a line has several, N per
  page, with the line's own row carrying only a discreet mark. Switchable per
  budget; issuing a version freezes its annex with it. Images come from the
  catalogue, the site visit, a file or the phone camera, are compressed before
  storage, and live in the blob store as `storageKey` strings — binary never
  enters the state blob (schema v4 adds the settings and widens image
  references into records). Internal-only images never reach the customer
  document. `budget-graphic-annex` becomes the third `factory`-owned area.
  Site E2E 77/77, all thirteen new checks made in a real browser.
- **Session 10a — done (ASSUMPTIONS.md #53).** Projects: the plan derived from
  the budget, the three tracking curves, and cost at completion. Every
  subsection of Proyectos now sits under **one project context** — a persistent
  selector with search, favourites and recents, and a fixed header carrying
  customer, address, status, progress, contracted revenue, actual cost, current
  margin and the next two critical dates (§4). Seguimiento técnico (§4.3)
  replaces session 6's placeholder seed with the **real derivation**: chapters
  and lines in, each duration from quantity ÷ the daily output of that unit in
  that chapter, dependencies chained, and re-derivable after a quote change
  without losing what the site recorded — derived task ids come from the
  budget's own line ids, so re-deriving is a merge and not a reset. Progress is
  recorded per chapter or **per executed quantity** (the number a site actually
  knows), and one action writes both the budget and the plan so the two can
  never disagree. An **S curve** draws planned, actual and projected, with the
  actual line taken from an append-only progress log rather than from today's
  percentages — the one thing about a plan that cannot be reconstructed
  afterwards. A deviations panel names what is overdue, not started or merely
  behind, and measures the slip against the frozen baseline. Seguimiento
  económico (§4.4) is now a real screen: budgeted · committed · actual ·
  **projected** · deviation · margin per chapter, where the projection carries
  the observed cost per point of progress to the end, never falls below what is
  spent or committed, keeps the budget while nothing has been booked, and can be
  adjusted by hand only with a reason — with both figures shown. New:
  `@repo/capability-scheduling` gained `derive.ts` and `tracking.ts`,
  `@repo/capability-projects` gained `forecast.ts`, and the vertical pack gained
  its daily-output tables — which the **browser bundle now composes**, the first
  time a pack reaches the phone. `scheduling-gantt` and `project-economics` are
  `factory`-owned (18 engine · 4 factory · 3 unbuilt). Site E2E 91/91.
- **Session 10b — done (ASSUMPTIONS.md #54).** Compras (§4.1): a purchase
  order's lifecycle (borrador → enviada → aceptada → recibida parcial →
  recibida → facturada → pagada) is DERIVED from its dates and receipts, never
  stored as its own field; `purchaseNeeds()` shows what a project's chapters
  still need to commit, reading the same `committedByChapter()` the economics
  screen uses; `purchaseReconciliation()` is the order ↔ delivery note ↔
  invoice three-way check. Subcontratos (§4.2) is a **new area** — one record
  per awarded trade with awarded/certified/invoiced/pending, a traffic light
  over three mandatory documents (insurance, PRL, Social Security), retention,
  and a link to the Gantt task executing that trade. Starting work on site is
  **blocked**, not merely alerted, while documentation is expired or missing —
  the one rule this session gives the harder of its two available forms on
  purpose. `committedByChapter`/`committedCostCents` now include awarded
  subcontracts, which the economics screen was quietly undercounting since
  session 10a. Modificaciones (§4.5): change orders gained a `sent` step, a
  `chapterNum` (so their cost/margin effect attributes correctly in the
  forecast), `cancelChange`, and `renderChangeDoc` — a customer-facing adenda
  with no cost or margin field. An approved change's schedule effect applies
  to the Gantt through an explicit action
  (`ErpBridge.scheduling.plans.applyChapterDelay`), never automatically.
  Horas (§4.6): a weekly worker × day grid, scoped to the section's project
  like every other §4 subsection, with locking (`approveLabourWeek`), "repetir
  el parte del día anterior," and reassignment through the existing
  `correctHours`. Recording hours against a closed project is now refused
  outright, which makes the spec's own alert for it structurally unreachable.
  Schema v6 adds `state.subcontracts` and the lifecycle fields on purchases,
  changes, labour and workers — every one of them additive. Ownership:
  `subcontracts` added; `purchases`/`change-orders`/`labour-hours` stay
  `engine` (19 engine · 4 factory · 3 unbuilt). Site E2E 103/103, 11 new
  checks — including one that pins the exact bug this session shipped once:
  sending a purchase order updated the record but left the open drawer
  showing the stale status and the wrong next action.
- **Session 11 — done** (`docs/worklog/SESSION-11.md`). Administración: §5.3
  conciliación bancaria, §5.4 banco, §5.6 gestoría, §5.7 comunicaciones. New
  capability `@repo/capability-reconciliation` scores a statement line against
  the documents that could explain it and returns suggestions **carrying their
  own reasons** — exact amount, reference quoted, same counterparty — because a
  bare confidence next to an Accept button teaches people to click without
  reading. Direction is a gate rather than a weight, an amount outside
  tolerance returns nothing rather than a weak guess, combinations stop at
  three documents, and a single document outranks a combination of equal
  confidence. Mirrored pairs across accounts are detected as internal
  transfers. Closing a bank period **refuses** while anything in range is
  unreconciled; reopening requires a written reason. Allocation was **removed
  from the Banco screen** per §5.4 — casar un movimiento y repartirlo son el
  mismo gesto, and splitting them across two screens produced movements
  assigned to a job with no invoice behind them. Gestoría (§5.6) can now say
  no: `quarterlyPackage` **throws**, naming the outstanding exceptions, and the
  only way past is `acceptException` with a written reason per item — the two
  routes the spec allows and no third (a `force` flag was written this session
  and deliberately removed). The screen gained the completeness blocks, one
  traffic light per block because they fail independently, plus the late-
  document register (amber, never red), the fixed-asset/vehicle/renting
  register, accountant queries, recipient on every send and a reason-bearing
  reopen. Comunicaciones (§5.7) is templates, rules and a queue — and the rule
  default is **`draft`**, the most consequential decision in the session:
  nothing on the screen sends, "Aprobar" and "Registrar envío" are labelled
  honestly, and the only thing that could put a message on a wire is a port
  whose sole adapter delivers nothing. `commsEvents()` is a projection
  recomputed from current state, not a log, so a rule added today still sees
  last week's overdue invoice; editing a template mints a new version and
  retires the old with `supersededBy`. Schema v7 adds `bankPeriods`,
  `commsTemplates`, `commsRules`, `commsQueue`, `gestoriaQueries` and
  `exceptionsAccepted` — all additive. Ownership: `banking-reconciliation` and
  `comunicaciones-templates` → `factory`, `reconciliation-matching` added
  (18 engine · 7 factory · 2 unbuilt). Site E2E 121/121, 18 new checks, all
  aimed at the refusals rather than the happy paths. The zod-in-the-bundle trap
  was hit for the third time (52 → 190 KB) and fixed the same way as sessions 9
  and 10a; the committed bundle is 62 KB with zero zod references.
- **Session 12 — done** (`docs/worklog/SESSION-12.md`). Torre de Control,
  Mi Día, Recorrido (Improvement #3), alerts. Torre de Control (§2.1) now
  shows the exact eight cards the spec names — proyectos activos, resultado
  operativo del mes/trimestre, saldo bancos, proyección de caja, pagos a
  proveedores, oportunidades abiertas, visitas — each with a twelve-period
  sparkline on its own cadence, a delta against the prior period, and a
  colour dot that reuses the card's own number rather than a second per-tile
  threshold store. Every `alerts()` condition (~28 of them) now carries a
  stable **code** and a **type** (económica/técnica/documental/fiscal) from
  one lookup table. `managedAlerts()` layers assignment, a due date,
  snoozing, resolution with a required note and evidence, and conversion to
  a real task over the pure, recomputed `alerts()` projection — the same
  computed-list-plus-keyed-overrides shape session 11 used for gestoría
  exceptions and the comunicaciones queue. Only the alerts the spec
  explicitly calls "configurable" (opportunity-stale days, quote-expiry,
  subcontract-unbilled, warranty-expiry, start-at-risk) gained a tunable
  threshold in a new rule editor; margin keeps its existing config field.
  The gestoría quarterly reminder is **explicitly advisory, not an asserted
  legal filing deadline** (see `LEGAL_REVIEW.md` §5). Mi Día (§2.2) gained
  the hitos calendar, built entirely from dates records already own —
  project/contract/bill/purchase/subcontract/worker dates, open tasks — with
  no second copy of any of them; visits are deliberately excluded (logged
  after they happen, so there's no future date for one). Recorrido (§2.3,
  Improvement #3): `journey.html`'s original "Crear nuevo proyecto"
  walkthrough is **completely untouched** and stays the default; a new
  "Proyecto existente" mode reads the same tenant database erp.html writes
  and shows each of the thirteen stages' real status (completa/en curso/
  pendiente) and a real summary, linking out to the actual erp.html screen
  that owns that data rather than re-implementing thirteen stages of editing
  UI a second time. Schema v8 adds `alertRules`, `alertOverrides`,
  `opportunity.decidedAt` (backfilled) and `project.priority` — all
  additive; `controlTower()` only gained new fields. Ownership:
  `alerts-tasks-control-tower` stays `engine`, `journey-project-selector`
  `unbuilt` → `engine` (19 engine · 7 factory · 1 unbuilt — only
  `extraction-ocr`/session 8 remains unbuilt). Site E2E 147/147, 26 new
  checks driving the actual management verbs, calendar navigation, and the
  full real-project loop end to end. No packages/capability changed, so the
  committed bundle is untouched.
- **Session 8 — not started** (skipped for now; the only item left from the
  original 12-session plan). See `docs/worklog/WORKLOG.md`.

## Branch & discipline

Work lands on the branch designated for the session — `claude/orin-project-
status-1q50dt` for sessions 1-3, `claude/candi-programme-session-4-07amo8` for
sessions 4-12. Small conventional commits, every commit green, no force-push, no
history rewrite.

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
- **Full-scope audit (2026-08-05, operator-requested)**: adversarial audit of
  the whole repo against the construction-CRM master prompt →
  **`AUDIT_REPORT.md`** (stack baseline, 23 findings F-001…F-023 with
  file:line evidence, 18-row feature gap matrix, 7 remediation batches).
  Headlines: no auth/no durable storage on the shipped product (Critical),
  19 high dependency advisories, `/preview` release channel pinned to a dev
  branch, suppliers lost their registry screen, OCR still the one unbuilt
  area. Report only — nothing was fixed; remediation batches await the
  operator's pick.

## End-to-end journey audit + repair (2026-08-07)

`docs/JOURNEY-AUDIT.md` — all 13 stages walked as an employee would, per-stage
9-point review plus scored summary (34/100 overall, 28/100 usability; engine 72,
workspace UI 22), ranked issues, missing features, automation estimates,
scalability limits and a tiered roadmap. Every finding anchored to `file:line`.

Fixed this pass:

- **Seven engine correction paths that could never succeed** — each read a field
  or collection under a name nothing ever wrote (`resolveRequirement` →
  `p.requirements`, `adminPatch` → `state.captures`, `correctBill` →
  `b.irpfRateBp`, `updateBudget` → `validityDays`, `updateRecurring` →
  `concept`/`dayOfMonth`, `markChangeExecuted` never setting the status,
  `receivables()` with a `|| true` disabling its own filter). All were listed in
  `MANAGEABILITY.md` as working. 11 regression checks added (45 total), verified
  red against the previous engine. **These were lost again on 2026-08-08 and
  restored on 2026-08-09** — see the S1a entry below; the suite now stands at 48.
- **The journey stops inventing its numbers.** Committed and actual cost were
  `chapter budget × a percentage typed at intake`, which made every chapter show
  an identical variance and left the supplier / PO / bill-number fields
  decorative. Both now come from purchase-order and bill rows the operator
  enters. `depositPct` and `progressPct` drive the invoice; collections take an
  amount so part payments are representable; supplier payments are ticked per
  bill.
- **Every stage has a gate.** Advance refuses and lists what is missing; the rail
  can no longer walk past the intake checks (it could previously start a project
  with no customer name, tax ID or email).
- Withholding clamped (>100% produced a negative invoice total), baseline frozen
  once, ledger derivations moved out of the render functions, step/reached/ledger
  persisted so a reload resumes, storage failures surfaced, CIF control digit
  verified, "Send" relabelled to "Mark as sent" (no transport is wired), 36 lines
  of dead code removed.

Site E2E 46/46 — the journey test now asserts the gates hold, that per-chapter
variance has more than one distinct value, and that a reload resumes.

**Next (Tier-1 item 1 of the audit roadmap):** wire the journey through
`erp-engine.js`. It still writes to its own `caneiJourney` database while the ERP
uses `caneiERP`, so every customer, quote and invoice is entered twice and the
journey's invoice is not the accountant's. Needs idempotent stage→record mapping
and a decision on abandoned journeys polluting the live dataset — see
`ASSUMPTIONS.md` #48.

## Off the laptop (2026-08-07)

The operator asked to stop using their Mac entirely. Two things depended on it —
reaching the ERP at all, and running the ops scripts — and deploying code already
did not. Both halves of the gap are now addressed in code; one switch remains,
and it needs credentials only the operator holds.

- **Release gate fixed.** `deploy.yml` published the rolling `main` tag in the
  build job, so the server pulled an image roughly three minutes before the smoke
  test finished deciding whether it worked. The build now publishes only the
  immutable sha tag and a `promote` job, gated on `smoke`, retags it in the
  registry. Verified live: images → smoke (23:06:45) → promote (23:06:46).
- **Identity.** `requireUser` returns the signed-in email when an identity
  provider is configured, verified from the signed assertion rather than read
  from a header — algorithm pinned, audience and issuer and expiry checked, keys
  cached with refetch-on-rotation and stale-serve on outage. Half-configuration
  is refused rather than downgraded to the shared operator name. 21 tests, each
  a real forgery attempt. Unset variables leave today's behaviour identical.
- **Ops from a browser.** `ops.yml` runs status, backup-now and list-ssh-allowed
  from an Actions button that works from a phone. `ops/ssh-allow.sh` changes ONE
  firewall entry instead of replacing the set — `narrow-ssh.sh` would have had
  the second of two people silently lock out the first. Seven fixtures.
- **Written down:** `docs/OPS-WITHOUT-A-LAPTOP.md`, including what storing the
  SSH key in repository secrets actually costs.

**Next:** publish the ERP. `ops/provision.sh` already builds the tunnel, DNS
record and login policy behind `SKIP_CLOUDFLARE=1`; switching it on is what turns
"the server is healthy" into "the company runs on it". Needs the domain in
Cloudflare and the two `CF_ACCESS_*` variables reaching the app. Until then the
workspace is still tunnel-only, and the nine-command whitelist still cannot run a
job from lead to close.

## S1a — one history again (2026-08-09)

`main` and the programme branch had diverged into two different products, and
`main`'s CI had been red on five consecutive commits. The cause was not a bad
test: commit `19ae2fb` content-copied the programme branch's `site/` files onto
`main` rather than merging, which brought the twenty-five screens across without
their history and overwrote a body of work whose tests stayed behind to report
the loss. Six of the seven `factory`-owned areas had a user interface on `main`
with no implementation behind it.

Landed as a real merge — both parents kept, nothing rewritten:

- **The implementation half of sessions 4-12** ported onto `main`'s tree: the
  extraction and reconciliation capabilities, the Spanish extraction profile,
  scheduling (calendar, CPM, baselines, tracking, derivation), document annexes,
  project forecasting, messaging rules, `erp-browser`, `factory`, and the two
  pack export maps `main` was missing. The committed `site/erp-factory` bundle
  goes from 162 to 1,701 lines and rebuilds byte-identical.
- **The eight engine corrections restored** — the seven from the journey audit
  above plus MDM-03 as a hard rule (no two active parties on one tax identifier,
  which `findDuplicateParty` could not express because it returns the first match
  on tax id _or_ name _or_ phone). Five collections are now declared in the
  initial state instead of created on first write, so a new engine and a migrated
  blob finally agree on shape.
- **`journey.html` reunited**: the per-stage gate, the money derived from entered
  data and the purchase-order / bill / supplier-payment panels come back from the
  version `19ae2fb` overwrote, merged with real-project mode, which only the
  programme branch had. Both feature sets, one file.
- **The two test suites merged the same way** rather than one replacing the
  other, and the scheduling simulation is now wired into CI so the committed
  bundle is driven by a job and not by a person looking at a Gantt chart.

Verified: lint · boundaries · check-types · test · build · `make gates` ·
`make demo`; year 149/149 and 214/214 at 24 months, manageability 48/48,
migrations 43/43, import 25/25, scheduling 30/30, ownership guard 27 areas;
site E2E 154/154, cross-device refresh 17/17.

**Next:** S1b — the navigation restructure to the doc's six secciones, the
English rename and the agreed removals.

## S1b — six secciones, in English (2026-08-09)

The menu was seven secciones and twenty-five subsecciones, named in Spanish and
shaped by what had been built. It is now **six and twenty-nine**, addressed in
English — twenty-nine because Comunicaciones, Alertas and Usuarios moved into
Configuración rather than being deleted.

- **Old links keep working.** `ROUTE_ALIASES` maps every retired hash;
  `go()`, boot and `hashchange` resolve through it and normalise the address bar
  with `replaceState`. Two cases the first attempt got wrong now have checks: an
  alias resolving to the screen you are already on, and an alias whose target is
  a page this shell does not own.
- **Six built screens become three**, as the doc asks (PRY-01, ADM-03, ADM-05),
  each as a tab strip over the existing bodies — the real rewrites are S7, S8
  and S11.
- **Torre: eight indicators to four**, and it computes none of them. Read-only,
  five alert rows; everything one _does_ to an alert is now DMC-07.
- **Removed:** Mi Día, Reportes, the Torre's sparklines/customiser/CSV, and the
  subcontract lifecycle screens. The subcontract _rules_ moved down into
  `manageability-sim` (48 → 57 checks) rather than going untested with the UI.
- **Mobile:** a five-icon bottom bar that no longer scrolls sideways, with
  Configuración in the profile menu; both native shells address sections by
  route key instead of the redirect stubs they were pointed at.
- **No schema migration.** There were no state-level removals or renames to
  carry, and an empty v10 would claim a change nobody made.

Verified: site E2E 153/153 · cross-device refresh 17/17 · year 149/149 and
214/214 · manageability 57/57 · migrations 43/43 · import 25/25 · scheduling
30/30 · ownership guard 27 areas · lint, boundaries, types, tests, build,
`make gates`, `make demo`.

**Next:** S1c — DMC-08 Usuarios and the role model, before the screens inherit a
permission check rather than being retrofitted with one.

## S1c — add a colleague without handing over the keys (2026-08-09)

Accounts lived in `ERP_USERS` in the server's `.env`, alongside the database
password. **DMC-08 Usuarios** takes them out of there: create, set what somebody
may do, disable, reset a password — from a screen.

- **The admin never learns the password.** Creating a user mints a single-use,
  time-limited token, stores only its SHA-256, and the invited person chooses
  their own on `/activate`.
- **Disabling really ends their sessions.** Tokens are signed and stateless, so
  each now carries its issue time and each user a `sessionsValidFrom` stamp. The
  only lever before was rotating `SESSION_SECRET` — sign out the company to
  remove one person.
- **Four roles as permissions**: admin · back-office · site · gestoría. Gestoría
  reads and exports and never sees a margin, which is asserted rather than
  documented.
- **The last admin cannot lock the system**, and the login form is rate-limited
  — the open risk the pilot write-up named.

Verified against a live server and a real Postgres, not reasoned about: invite →
refuse to sign in → reject a short password → activate → the link fails the
second time → sign in → refuse `user.manage` → disable → the existing session
dies → re-enable → the old token stays dead.

Three bugs that verification caught and that would otherwise have shipped: login
never read the users table, so an activated person could not sign in; the
account-state check sat in `requireUser`, which half the API never calls, so a
disabled colleague kept reading the register; and the users screen mentioned the
literal `name="erp-api"`, which made sync-workspace skip erp.html and would have
served the whole workspace without its server marker.

**SMTP is deferred by decision** and `INTEGRATIONS_PENDING.md` says exactly what
it changes: not whether an account can be created, only whether the invitation
arrives on its own. The screen never claims a message was sent when none was.

**Next:** S2 — DMT-01…04 Datos Maestros, the first screens to inherit the
permission primitive rather than have it retrofitted.

## S2 — the terceros file grows a screen per role, and Personal gets one at all (2026-08-09)

Clientes was the only master-data screen with a real registry. Proveedores and
Subcontratas were placeholders; Personal interno had no screen of its own at
all — a timesheet needed only a worker's name.

- **A shared list primitive** (`renderMasterList`) replaces the Clientes-only
  toolbar/table/pagination/export code, so DMT-02/03/04 inherit it instead of
  each retyping it. Page sizes correct to **10/25/50, 25 default** — Clientes
  shipped with 10/20/50.
- **DMT-02 Proveedores and DMT-03 Subcontratas** filter the same party file by
  role rather than being new collections, reusing the existing party drawers.
  `editPartyDrawer` gains `businessLine`/`category`/`aliases` (gaps 1/2/4 of
  the v4 plan's thirteen).
- **DMT-04 Personal interno** is `state.workers`' first real registry: list,
  create, edit, append-only tarifa history, documentación, deactivate-never-
  delete. The engine gained `updateWorker`/`deactivateWorker` — there was no
  way to edit or retire a worker before this session.
- **The CIF check digit is now verified**, not just the shape — closing a real
  validation hole (a corrupted scanned character could pass before). Nine
  pre-existing fixture/seed tax ids across five files had never actually
  carried a valid check digit and were corrected.
- **Two real bugs fixed along the way**: `searchAll()`'s "Proveedores" group
  routed every supplier AND subcontractor hit to the Clientes screen (adjacent
  to audit F-020); and `findDuplicateParty`'s result was computed on every
  `addParty` but never read — `newPartyDrawer` now surfaces it as a warning
  instead of a plain "created" toast.
- **`GET /api/~/session`** is new — the only way the static workspace can know
  its own permissions — and gates the IBAN field behind `party.bank.read`.
  Verified live against a real Postgres and the standalone Next build, not
  just reasoned about. This is client-side masking, not enforcement:
  server-side per-command RBAC on `/erp/command` does not exist yet and is
  logged as a follow-up in `ASSUMPTIONS.md #103`, not attempted piecemeal here.
- **Not built this session, by explicit scope decision**: the doc's
  480px-with-tabs drawer layout (Identification/Contact/History plus
  role-specific Precios/Compras/Documentos/Tarifas tabs). The existing
  single-scroll drawers are reused and extended instead — rebuilding them as
  tabs is real UI work with real regression risk across 29 screens, deferred
  rather than rushed.

Verified: site E2E 163/163 · server-e2e 27/27 (live Postgres + standalone
build) · manageability 84/84 · year 149/149 and 214/214 · import 25/25 ·
ownership guard 27 areas · lint, boundaries, types, tests, build, `make demo`.

**Next:** S3 — DMC-01…07 Configuración + Catalan (gaps 6–9, 12).

## S3 — the company's vocabulary leaves the code (2026-08-09)

Four reference lists were compiled into the engine, so adding a payment term
or a lead source the owner actually uses was a code edit and a deploy. DMC-01
and DMC-02 had no way to create anything at all. And the language toggle was
ES⇄EN in a product built for a Catalan-speaking region.

- **`state.lists`** holds units, lead sources, loss reasons, payment methods
  and the catalogue's chapter tree, each entry `{code, es, ca, active}`. The
  rest of `LISTS` stays compiled in, because invoice kinds and movement
  classes are keys the engine branches on — an owner renaming one would be a
  bug, not configuration.
- **A code is permanent, a label is editable.** Records store the code
  forever, so only the labels can be changed. That also fixed a real display
  bug: a customer's origin used to render as its raw English key
  (`referrer`), because the list had codes and no field to hold a label.
- **DMC-03/04/05** are three screens on one renderer — centred table, help
  column, inline add, commit on Enter or blur, no drawer. Retiring an entry
  removes it from the pickers and keeps it resolving on records that already
  carry it, so the usage count informs rather than blocks.
- **DMC-01 Partidas** finally has a screen inside the shell: chapter tree with
  per-branch counts and its own search, draggable to reorder, partidas table
  with brand/model/quality. It used to link out to master-data.html, which
  holds a mock dataset never wired to the engine — so the real catalogue had
  no interface at all.
- **DMC-02** gained the doc's comparison strip and, more importantly, a way to
  record a price. A supplier who never quoted reads «sin precio», never
  0,00 € — rendering a blank as zero makes them look like the cheapest, which
  is how a purchase order goes to the wrong company. An unstated IVA stays
  null rather than becoming 0%.
- **Gaps 6–9 and 12 closed**: IVA, supplier's own article code, waste and
  minimum order, project and notes on prices; source file, sheet and original
  chapter on budget lines.
- **Catalan is real**, and the i18n dictionary is now enforced. English is at
  100% and hard-enforced. Catalan covers 466 of 1792 entries — the whole
  navigation, shell and main screen headings — and the remaining **1326 are
  counted in the open** as a ratchet that may only shrink, so every new string
  from here ships with Catalan while the historical backlog stays visible
  rather than excused.
- The new guard immediately found a real bug: **11 duplicate Spanish keys**, 4
  with different English, where only the first was ever reachable. Removed.

Verified: site E2E 183/183 · manageability 84/84 · year 149/149 · import
25/25 · scheduling 30/30 · migrations 43/43 (ladder now v11) · i18n coverage ·
site-sync 17/17 · ownership guard · lint, boundaries, types, tests, build,
`make demo`.

**Next:** S4 — COM-01 Leads + COM-02 Visita.

## S4 — a lead learns to become a visit (2026-08-09)

`addVisit` had always been one unconditional write — there was no way to
schedule a visit and capture it later, and no screen for leads at all outside
a placeholder route.

- **Two engine methods replace the one-shot write.** `scheduleVisit` creates
  a `status:"scheduled"` record with nothing captured; `completeVisit` writes
  the capture fields once, refuses a second call on a `"done"` visit
  (`validateVisit` remains the correction path), and moves the opportunity
  from `awaitingVisit` to `awaitingBudget`. `addVisit` keeps its old signature
  for the 6 existing seed/history call sites.
- **COM-01 Leads** (`#leads`): register with next-action editing and loss
  tracking (`loseOpportunity` with a reason from the owner-maintained list).
- **COM-02 Visita** (`#visits`): two fixed-height blocks — Programadas and
  Realizadas — sharing one `state.visits` collection filtered by status, both
  built on `renderMasterList` extended with `fixedSize`/`noExport`/`noNew`
  flags rather than a second pagination implementation.
- **The handoff to a presupuesto stops at a bare budget header** — COM-03
  (S5) owns the real builder. `visitDetailDrawer` creates the header via the
  existing `createBudget` and links it with `validateVisit(visitId,
{budgetId})`, verified in e2e by asserting the hash actually changes to
  `#quotes`.
- **The i18n coverage guard proved its own limit.** Dictionary coverage
  (29 new ES/EN/CA triples) was green on the first pass and still missed two
  real gaps: the dynamic "N oportunidades"/"N visitas programadas/realizadas"
  count tag never goes through the translator at all (the same pattern
  `clientes`/`proveedores` already have — fixed for EN via the same regex
  convention, left as pre-existing CA backlog since CA has no such regex
  coverage anywhere yet), and "Programadas"/"Realizadas"/"Sin crear" are
  distinct strings from the already-dictionaried "Programada"/"Realizada"
  that the exact-match guard could not see were still raw Spanish on screen.
  Both fixed once a real-browser check visited the new screens under CA and
  EN, rather than only asking the dictionary whether an entry exists.

Verified: site E2E 195/195 · manageability 100/100 · year 149/149 · import
25/25 · scheduling 30/30 · migrations 43/43 (ladder now v12) · i18n coverage
(EN 100%, CA backlog held at 1326) · ownership guard · lint, boundaries,
types, tests, build, `make demo`.

**Next:** S5 — COM-03 Presupuestador.

## S5 — the heart of the system leaves the shell (2026-08-09)

COM-03 is the screen the business runs on. It was a three-pane card layout
inside the normal page, with nothing draggable, no way to number a row by
hand, and — the surprise of the session — **no way to send a presupuesto or
record the customer's answer at all**: `issueVersion` and `acceptVersion` had
zero callers outside the seed and the history generator.

- **The register groups by the five stages** the specification names —
  Borradores · Enviados · Aceptados · Rechazados · Caducados — and all five
  are **derived**, not stored. Expiry is why: it is not something done to a
  record on a date, it just becomes true. The shipped data proved the point,
  with four seeded budgets long past their validity still stored as `issued`.
- **The builder is full screen**, per §3.2: the rail, breadcrumb and page
  heading go, and the three panes get 260 / flexible / 300 with the 56 px bar
  above and the conditions bar below. `render()` clears the class on every
  navigation, so no exit path can strand the next screen without its menu.
- **Dragging means something to the document.** A 16 px handle per line (only
  the handle, so the row still selects text), chapters draggable in the tree,
  and lines draggable into another chapter — which moves their money between
  the base and optional subtotals, and moves them in the customer's document
  with it.
- **Free numbering**: a number a person typed survives every later insert,
  delete and drag; a number the system assigned belongs to the position and
  moves with it. Duplicates are refused — the number is the reader's only
  index into the document and into the graphic annex.
- **Sending and answering now exist.** The send screen states plainly that
  pending-price lines are NOT in the total the customer is about to read, and
  a blocking issue disables the button rather than hiding the reason.
  `rejectVersion` is new; testing it exposed a real defect in code that was
  already there — `acceptVersion` never checked for an existing customer
  response, so a refused version could be accepted afterwards, overwriting the
  refusal and flipping the opportunity from lost back to won.
- **The customer's document speaks the customer's language.** `budget.language`
  drives it, and the document is marked `translate="no"`, which `i18n.js` now
  honours. That fixed a bug rather than only adding Catalan: "Base imponible",
  "Validez" and "Total por m²" are all in the dictionary, so a Spanish
  presupuesto previewed by an operator working in English came out partly
  English.
- **The visit sits beside the presupuesto priced from it** — the payoff of S4's
  link — as a second panel tab, strictly read-only.

Verified: site E2E 221/221 · manageability 131/131 · year 149/149 · import
25/25 · scheduling 30/30 · migrations 43/43 (ladder now v13) · i18n coverage
(EN 100%, CA backlog held at 1326 across 83 new triples) · site-sync 17/17 ·
ownership guard · lint, boundaries, types, tests, build, `make demo`.

**Next:** S6 — OCR pipeline (approach fixed by the S0b memo).

## S6 — the machine reads, and says what it could not check (2026-08-09)

`extraction-ocr` was the last `unbuilt` area. Session 7 had built the half
that turns text into candidate fields; nothing could reach it, because there
was no way to turn a PDF or a photograph into text in the first place.

- **Recognition is in `site/erp-ocr.js`** and knows nothing about invoices.
  It tries the PDF's own text layer first — a digital invoice reads in about
  170 ms that way, and the OCR half never loads at all — and reaches for
  tesseract only where there is nothing to read.
- **The runtime is vendored** (7.23 MB under `site/vendor`, via
  `tools/vendor-ocr.mjs`): `pages.yml` publishes `site/**` from a bare
  checkout with no Node, and a bare static host and a site with no signal both
  forbid the CDN these libraries reach for. Nothing loads until a file is
  handed over, and «preparar para trabajar sin cobertura» is an explicit
  button rather than a silent 7 MB download on somebody's mobile data.
- **A dot has to be earned.** A field goes green only where a validator
  vouched for its value — a check digit that computes, a real calendar date,
  arithmetic that balances — and never on confidence. That is the S0b memo's
  whole point: its scanned NIF came back `A08912907` for `A08932907`, read
  with perfect confidence. Fields nothing can check are therefore always
  amber, which is where the cursor goes.
- **ADM-03's validation screen** puts the document at 620 on the left and the
  form at 480 on the right, shows the lines the reader actually saw, and
  highlights the one a value came off when you choose the field. A typed
  correction goes back through the same checks, so a hand-typed NIF with a
  transposed digit stays amber and says why.
- **Nothing reaches the company's data until a person presses Confirmar.**
  The machine's reading is kept beside the confirmed values, never instead of
  them.
- Three defects in this session's own new code were found by driving a real
  browser rather than by reading it: a `blob:` worker that left the wasm
  loader with nothing to resolve against, an object URL revoked before
  tesseract read it, and an unchecked `logger` callback.

**`extraction-ocr` flips `unbuilt` → `factory`. There are now no unbuilt areas
left.**

Verified: site E2E 234/234 · manageability 131/131 · year 149/149 · import
25/25 · scheduling 30/30 · migrations 43/43 · extraction capability 22/22 ·
i18n coverage (EN 100%, CA backlog held at 1326 across 31 new triples) ·
site-sync 17/17 · ownership guard (0 unbuilt) · lint, boundaries, types,
tests, build, `make demo`.

**Next:** S7 — ADM-03 Facturas de proveedores + ADM-02 Compras (+ gaps 10-11).

## S7 — the document finds out who pays for it (2026-08-09)

S6 built the reading and left the filing. `erp.allocateCapture` had **zero
callers**: a document could be photographed, read, checked and confirmed, and
then nothing in the application could say which obra paid for it.

- **ADM-03 is two zones now** — a 372 column of 96 px cards (thumbnail,
  detected supplier, detected amount) beside the register. What puts a
  document on the left is that it is **unallocated**, not that it is
  unvalidated: S6 confirms at capture time, so a split on status would leave
  the inbox permanently empty. Newest first, because the document somebody has
  just photographed is the one they are about to file.
- **Allocation exists.** One obra, a split across several, or an overhead
  category — offered as a single destination select, because the engine
  refuses a line naming both and a screen that lets you tick two boxes and
  then says no asked the question badly. The split must total a **confirmed**
  document; an unconfirmed one has no total to check against and says so
  rather than inventing one from the split itself.
- **Gaps 10 and 11 are closed.** `sourcePath`, `reference` and `notes` are
  stored, searchable and editable, and `updateCapture` is deliberately
  separate from `confirmCapture` — a filed invoice that renames itself because
  somebody typed a note is a lost document.
- **ADM-02 has the doc's three counters** — Oferta · Pedido · Facturado, count
  and amount, each filtering the list. Derived from the same facts as the
  seven statuses rather than stored beside them. A cancelled order is counted
  in none of the three.
- **"No goods receipt" was read as "receipt is not a stage."** The engine keeps
  `receivePurchase` and its reconciliation; a received order reads _Pedido ·
  Recibida_, stage and status, both true. Retiring a stage is not the same as
  un-testing an engine — the same distinction S1b drew over the subcontract
  screens, and the e2e now asserts both readings together.
- **An order opens full screen beside the supplier's quote**, 620 with zoom on
  the left and the 480 record on the right, footing base, IVA and total. The
  quote is a **captured** document linked to the order, not a second upload,
  so the reading and the file's origin are the same object on both screens.
- **The Catalan ratchet came down for the first time**: eight entries that had
  sat on the ES/EN spine with no Catalan are on S7's panels and are now
  translated. `CA_BACKLOG` 1326 → 1318.

- **The shared list primitive's chrome had never been translated.** Driving
  the two new screens under CA and EN found `⬇ Exportar`, `Filas por
pantalla`, `‹ Anterior`, `Siguiente ›` and `＋ Nuevo` sitting in Spanish on
  every list screen shipped since S2, and ADM-02's own `Necesidades` and
  `Calendario de llegadas` in Spanish since session 10b. Fixed here because
  they are on this session's screens. The dictionary guard could not have
  found any of it; the render check did.

Verified: site E2E 249/249 (23 new checks) · manageability 155/155 (24 new
engine checks) · migrations 48/48 (ladder now v14) · year 149/149 · import
25/25 · scheduling 30/30 · i18n coverage (EN 100%, CA ceiling 1326 → 1316
across 97 new triples) · site-sync 17/17 · ownership guard · lint, boundaries,
types, unit tests 118/118, build, `make gates`, `make demo`.

**Next:** S8 — PRY-01 integration + PRY-02 Avance Económico (the 780 centre
panel with a 372 compressed list, and the money chain's item 14).

## S8 — the list stops disappearing, and the plan starts moving the money (2026-08-09)

- **The centre panel exists** — §3.1's third shared surface, after the 480 side
  panel and full screen. Opening a job compresses the list to 372 and puts a
  780 panel beside it, and the list never disappears. Closing it restores the
  width, the page and the **scroll position**: the first two come free from the
  list primitive, the third does not and is captured on open.
- **PRY-01 left its tab strip.** One screen, three tabs inside the panel —
  Avance, Programación, Ficha — over a fixed 88 header. The chapter's state is
  the doc's three contiguous 90 px buttons, and the 60 px percentage box is
  live **only** on «en ejecución»: a percentage on a chapter nobody has started
  is a number with nothing behind it, and one on a finished chapter is always 100.
- **The Gantt went full screen rather than into the panel.** §3.2 puts
  Programación in a tab; §3.1 names the Gantt as one of exactly four
  out-of-shell surfaces. The tab states the plan in figures and opens the chart
  outside the shell — the reading that honours both sentences and does not
  spend the session shrinking a drag-and-drop timeline into half a panel.
- **PRY-02 shows the money that reached a job and stopped.**
  `chapterEconomics` was silently skipping every cost with a `projectId` and no
  `chapterNum`, so the per-capítulo table added up to less than the project and
  nothing said why. That difference is now its own block, and the 480 panel
  beside it is the only place in the product that writes a capítulo onto a cost.
  A split writes sibling allocations, so the amount that reached the job is
  conserved by construction.
- **Money-chain item 14 was a GAP, not a claim to confirm.** `cashForecast` has
  always read `installment.expectedDate`; nothing ever wrote it after the
  contract was drawn up, so a job whose plan slipped three weeks kept
  forecasting the same money in the same week — wrong in the optimistic
  direction. Built: the plan proposes, a person applies, and neither an
  invoiced milestone nor a `fixedDate` one moves. It is a button rather than an
  automatic write, because a forecast that changes while somebody is reading it
  is a forecast they stop trusting.
- **`projectDrawer` retired**, with both rules it uniquely carried checked
  first: approving an extra has always also lived on Modificaciones, and the
  manual forecast override kept its «Ajustar» button in the new table.

Verified: site E2E 264/264 (30 new checks) · manageability 174/174 (19 new
engine checks) · migrations 48/48 · year 149/149 · import 25/25 · scheduling
30/30 · i18n coverage (EN 100%, CA ceiling 1316 → 1308) · site-sync 17/17 ·
ownership guard · bundle safety · lint, boundaries, types, unit tests, build,
`make gates`, `make demo`. The committed bundle is unchanged.

**Next:** S9 — COM-04 Contrato + PRY-03 Adicionales (the last unbuilt
full-screen surface, and the five 216 counters).

## S9 — the last full screen, and a photograph that is actually a photograph (2026-08-09)

- **COM-04 has its two tabs and the column that earns the screen.** «Importe
  vigente» goes amber the moment it differs from the original, because that
  difference means annexes exist — the one fact about a contract nobody should
  have to open it to discover. Both figures are the taxable base: an annex
  records a net price, so adding it to a VAT-inclusive figure would produce a
  number that is neither.
- **The contract opens full screen** — document 760 on the left, a fixed 392
  panel on the right with Datos, Hitos de pago and Anexos. That is the fourth
  and last of the specification's out-of-shell surfaces; all four are now built.
- **The document is rendered from data, not uploaded.** There is no contract
  PDF in this system and there need not be one: CON-03 made the terms
  structured on purpose, so asking somebody to attach a scan of what the
  database already knows is asking for the same contract twice and trusting the
  copy. It carries `translate="no"` — the contract's language is a field chosen
  for the customer, not a preference of whoever is reading it — while the panel
  beside it follows the toggle, and the e2e checks both in one breath.
- **Hitos de pago foot against the contracted amount**, and a date the works
  calendar moved says so. That is S8's honesty carried one screen along: a
  milestone marked «de la planificación» was not moved by a person.
- **PRY-03 has its five counters** (identificado · valorado · aprobado ·
  ejecutado · facturado), each with a count and an amount and each filtering.
  `sent` folds into valorado — priced and already-with-the-customer are the
  same thing from a site's point of view — and a rejected extra is counted in
  none of the five.
- **An unapproved extra is marked twice**: the pill, and a 3 px amber rule down
  the left of its row. CHG-04 is why — unapproved work is never billable, and
  the person who needs to know is walking past a screen in a site office.
- **The photograph became a real file.** `photoRef` had been a typed file name
  since session 10b, which renders as a blank square; it is now a blob written
  through the same path every picture has taken since S6, stored before the
  record so a failed upload cannot leave an extra pointing at nothing.

Verified: site E2E 280/280 (16 new checks) · manageability 188/188 (14 new
engine checks) · migrations 48/48 · year 149/149 · import 25/25 · scheduling
30/30 · i18n coverage (EN 100%, CA ceiling held at 1308 across 39 new triples) ·
site-sync 17/17 · ownership guard · bundle safety · lint, boundaries, types,
unit tests, build, `make gates`, `make demo`. The committed bundle is unchanged.

**Next:** S10 — ADM-01 Facturación (four 270 counters, days overdue red from
day one; every primitive it needs already exists).

## S10 — red from day one (2026-08-09)

- **ADM-01 has its four counters** — emitido · cobrado · pendiente · vencido —
  all derived by `invoicingSummary` from the same register the rows are drawn
  from, so a strip of totals over a table cannot tell a different story from
  the table. «Vencido» is a **subset** of «pendiente», not a fifth bucket:
  money that is late is still money that is owed, and a red counter that
  double-counts is the worst possible thing to paint red. Two invariants are
  asserted so they cannot drift — `collected + outstanding = issued` and
  `overdue ≤ outstanding`.
- **Days overdue are red from day one**, in their own column. Not from a week,
  not after a grace period: the check pins both sides of the boundary, so the
  due date itself is 0 and the day after is 1. A screen that waits before
  saying an invoice is late has taught somebody that waiting is normal.
- **A settled invoice shows «—», not 0,00 €.** A zero in a money column reads
  as a figure somebody calculated.
- **S9's handover question already had an answer.** `projectBilling` reads
  `currentRevenueCents` — the frozen baseline plus approved changes — so
  ADM-01 has always billed against the contract's current value, and CHG-04 has
  always refused the unapproved extras. Nothing was changed; a check was added,
  because an invariant nobody tests is one that survives by luck.
- **Two intermittent test reds turned out to be one harness bug.**
  ~~Fixed here~~ — **correction, made in S11: the `bootedShell()` helper this
  entry claimed was never actually written.** The script that was to add it
  failed silently and S10's green run was green by timing rather than by the
  fix. It exists as of S11, with both call sites wired.

Verified: site E2E 289/289 (9 new checks) · manageability 196/196 (8 new engine
checks) · migrations 48/48 · year 149/149 · import 25/25 · scheduling 30/30 ·
i18n coverage (EN 100%, CA ceiling 1308 → 1304) · site-sync 17/17 · ownership
guard · bundle safety · lint, boundaries, types, unit tests, build,
`make gates`, `make demo`.

**Next:** S11 — ADM-05 Banco + ADM-06 Caja + gap 13 (`accountCode`), the last
structural break in the money chain.

## S11 — the last break in the money chain (2026-08-09)

- **Gap 13 is closed.** §6's chain has carried one ✗ since S0: rule 07 says
  every cost lands on a project **or an account**, and the account half had no
  field. The chart of accounts is now `state.lists.accounts` — a list, so the
  resolver has something to validate against, the chart is owner-maintainable
  through the same screen as units and payment terms, and the codes stay out
  of code. Each account names which overhead category defaults to it, so the
  mapping is a property of the account rather than a second table to keep in
  step.
- **`resolveAccountCode` answers in one place**, and the precedence is the
  rule: an explicit code wins, then the overhead category, then the project's
  cost kind, then `null` — reported by `accountLedger` under «sin asignar»
  rather than dropped, because a roll-up that quietly loses money is worse
  than one that admits it. Migration **v15** resolves rather than defaults.
- **ADM-05 left the last tab strip.** Class and destination are edited in the
  row, because classifying a movement is a two-second decision made forty
  times in a row and a drawer per movement turns that into forty
  interruptions. Conciliación keeps its own tab; the row's selects write
  through the same `splitMovement` it does.
- **ADM-06 exists** — entrada, salida, the balance strip and the arqueo. The
  closing figure is **computed**, and asserted against the account balance: a
  stored closing balance is a number nobody counted.
- **The engine silently swallowed a duplicate method.** This session wrote a
  second `recordCashMovement`; the class already had one 280 lines further
  down, a later definition wins, and the new one was dead the moment it was
  written. S1a recorded this hazard once already — it is now also a comment at
  the site of the mistake.
- **A correction to S10's entry above**: the `bootedShell()` helper it claimed
  was never actually added. It is added here.

Verified: site E2E 299/299 (10 new checks) · manageability 211/211 (15 new
engine checks) · migrations 48/48 (ladder now v15) · year 149/149 · import
25/25 · scheduling 30/30 · i18n coverage (EN 100%, CA ceiling 1304 → 1303) ·
site-sync 17/17 · ownership guard · bundle safety · lint, boundaries, types,
unit tests, build, `make gates`, `make demo`.

**Next:** S12 — ADM-04 Horas + ADM-07 Gestoría + ADM-08 Flujo de caja.

## Branch & discipline

Work lands on the branch designated for the session — `claude/orin-project-
status-1q50dt` for sessions 1-3, `claude/candi-programme-session-4-07amo8` for
sessions 4-12. Small conventional commits, every commit green, no force-push, no
history rewrite.

- **S0 — CANEI v4 mapping (2026-08-08)**: `docs/CANEI-V4-MAPPING.md`. Answers the doc's six
  open questions (Q1 stack fixed by the code · Q2 no data loaded, variables covered · Q3 nine
  types stand · Q4 the money chain validated structurally · Q5 gestoría rules once imported,
  recommend a logged reopen rather than a hard lock · Q6 the Plan de Cuentas already exists in
  `financial-data.html`, only the wiring is missing). Maps all 26 screens doc-vs-built and all
  100 green-sheet columns to model fields: **~85 covered, 13 new fields, the rest derived or
  discarded**. Q4 verdict: the chain closes for every job-costed euro; the one break is the
  non-job branch (rule 07's "or to an account"), scheduled S11. No code changed.

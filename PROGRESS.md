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

## Capability layer — COMPLETE (14 capabilities, zero stubs)

13. **Rest of the capability layer** — DONE (commits f23e959, c55d605):
    `procurement` (PUR), `scheduling` (PLN), `time` (labour→cost), `docs`
    (DOC + blob-store port), `visits` (VIS), `access` (ORG-05..07
    roles/permissions). With the earlier projects/receivables/payables/crm/
    messaging, `diorka` composes **14 real, tested capabilities** — every BRD
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

## Branch & discipline

Work lands on `claude/orin-project-status-1q50dt` (designated). Small
conventional commits, every commit green, no force-push, no history rewrite.

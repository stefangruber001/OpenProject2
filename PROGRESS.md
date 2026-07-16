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

| Phase                | Scope                                                                                                                            | Status                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| P0 Foundation        | layers as real packages, boundary linter in CI, spec composition, ADRs, CLAUDE.md                                                | **in progress**                       |
| P1 Walking skeleton  | factory CLI, tenant #1 spec, presupuesto→factura slice with effective-dated IVA + justification, negative test                   | **in progress (interleaved with P0)** |
| P2 Packs build-out   | es-ES full surface (IRPF, filings data, jornada), reformas (bc3, certificaciones), scheduling/time/procurement/docs capabilities | pending                               |
| P3 Pipeline          | provision → deploy → verify → rollback, idempotent                                                                               | pending                               |
| P4 Fleet             | control plane, inventory, wave rollout, health gates, backup/restore drill                                                       | pending                               |
| P5 Proof & hardening | tenants #2/#3 (<15 min, timed), offboarding export, honest RISKS                                                                 | pending                               |

## Done

- Repo foundation (pre-mandate): Turborepo monorepo, Next.js 16 web app,
  Prisma+Postgres data layer, Vitest+Playwright, CI (lint/types/test/build/e2e),
  Husky, docs/ADR structure. All green.
- Compliance research (2026-07-16, see `LEGAL_REVIEW.md` for citations):
  - **Verifactu postponed by RD-ley 15/2025**: IS taxpayers → **2027-01-01**,
    rest (IRPF autónomos etc.) → **2027-07-01**. Chaining/immutability designed
    in now; AEAT submission gated `legally_verified: false`.
  - **IVA 10% renovation** (art. 91.Uno.2.10º LIVA): 3 cumulative conditions
    (natural person/comunidad + private-use dwelling; ≥2 years since
    construction/last rehab; contractor materials ≤40% of base). Encoded as an
    effective-dated decision rule with persisted justification.

## In flight (this session)

1. Governance files + CLAUDE.md (this commit).
2. Kernel package: money, effective-dating, ports, spec+resolver, event log.
3. Capabilities: quoting, billing (ports only, zero jurisdiction knowledge).
4. Packs: jurisdiction/es-ES, vertical/construction-reformas (+ contract tests).
5. Boundary linter + forbidden-literal linter, wired into CI, fixture-tested.
6. Factory CLI (`resolve|validate|new-tenant|demo`) + tenant #1 spec +
   negative test (no jurisdiction ⇒ loud failure) + `make bootstrap && make demo`.
7. ADRs 0005–0012.

## Next 3 tasks (after in-flight lands)

1. P2: es-ES filings data mapping (303/390/347/111/115/190 tagging model) +
   registro de jornada in a `time` capability; N43 import port + fake adapter.
2. P2: reformas certificaciones (quoted-vs-actual per partida drift) + bc3
   import stub behind port; quote→certificación→factura parcial flow.
3. P1 polish: PDF rendering via headless chromium behind DocumentRenderPort
   (HTML adapter exists); wire web app screens for presupuesto/factura on the
   composed services.

## Blockers & chosen workarounds

- **No Docker daemon in this sandbox** → kernel persistence is a port;
  P1 runs on in-memory adapters, fully tested; Prisma/Postgres adapter is a P2
  task using the existing `packages/db`. Logged in `ASSUMPTIONS.md`.
- **No real AEAT/FACe/bank access** → fake adapters behind ports,
  `INTEGRATIONS_PENDING.md` tracks each.
- Session context is finite → every unit lands green + committed; this file is
  the resume point. Force-push and history rewrites are prohibited from the
  mandate onward.

## Marginal cost of tenant #N+1 (minutes of human/agent time)

| Tenant           | Minutes                             | Evidence          |
| ---------------- | ----------------------------------- | ----------------- |
| #1 reformas-demo | n/a (built with the factory itself) | this repo         |
| #2 target        | **< 15** (config-only, zero code)   | to be timed in P5 |

## Branch & discipline

Work lands on `claude/orin-project-status-1q50dt` (designated). Small
conventional commits, every commit green, no force-push, no history rewrite.

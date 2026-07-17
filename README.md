# OpenProject2

An **ERP factory** for European SMEs: a tenant spec goes in; a running,
tested, compliance-gated ERP comes out. Kernel + capability modules +
jurisdiction packs + vertical packs, composed at resolve time — customisation
is data, never a fork. Tenant #1 is a Spanish _reformas_ (renovation) company.

[![CI](https://github.com/stefangruber001/OpenProject2/actions/workflows/ci.yml/badge.svg)](https://github.com/stefangruber001/OpenProject2/actions/workflows/ci.yml)

> **Status:** P0 foundation + P1 walking skeleton green — presupuesto →
> factura with effective-dated IVA and persisted legal justification, chained
> invoices, boundary-enforced architecture. See [`PROGRESS.md`](./PROGRESS.md)
> for live state and [`docs/architecture.md`](./docs/architecture.md) +
> [ADRs 0005–0012](./docs/adr/) for the factory design.
>
> ```bash
> make bootstrap && make demo   # tenant #1 artifacts in out/reformas-demo/
> ```

## Marginal cost of tenant #N+1 (the metric that decides if this worked)

| Tenant                                                             | Human/agent minutes                                                                                   | Evidence                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| #1 reformas-demo                                                   | n/a (built the factory)                                                                               | this repo                                     |
| #2 azulejos-lopez                                                  | **~0.02 s create+resolve, config-only, zero code** (formal timed onboarding incl. real intake: P5)    | `tenants/azulejos-lopez/`, `tenants/INDEX.md` |
| #3 diorka (REAL intake — Proyecto Diorka, family renovation group) | **0.79 s validate+resolve, config-only, zero code** (BRD mapped: `intake/diorka/REQUIREMENTS-MAP.md`) | `tenants/diorka/`, `intake/diorka/`           |

A flat or rising line here is a P1 defect (mandate §7).

## Tech stack

TypeScript everywhere · Next.js (App Router) + React · Tailwind CSS ·
PostgreSQL + Prisma · Turborepo + pnpm monorepo · Vitest + Playwright ·
GitHub Actions CI. The reasoning behind each choice lives in
[`docs/adr/`](./docs/adr/).

## Quickstart

```bash
pnpm install
cp .env.example .env
docker compose up -d      # local PostgreSQL
pnpm db:migrate && pnpm db:seed
pnpm dev                  # http://localhost:3000
```

Full walkthrough: [`docs/onboarding.md`](./docs/onboarding.md).

## Project structure

```
apps/web/          The Next.js application (UI + API routes)
packages/db/       Prisma schema, client, migrations, seed  (@repo/db)
packages/ui/       Shared React components                  (@repo/ui)
packages/*-config/ Shared ESLint / TypeScript presets
docs/              Architecture, ADRs, product docs, runbook
```

Details in [`docs/architecture.md`](./docs/architecture.md).

## Common commands

| Command            | Does                           |
| ------------------ | ------------------------------ |
| `pnpm dev`         | Run the app with hot reload.   |
| `pnpm test`        | Unit tests (Vitest).           |
| `pnpm test:e2e`    | End-to-end tests (Playwright). |
| `pnpm lint`        | Lint everything.               |
| `pnpm check-types` | Type-check everything.         |
| `pnpm build`       | Production build.              |
| `pnpm db:studio`   | Visual database browser.       |

## Documentation

- [Architecture](./docs/architecture.md) — the system map.
- [Architecture Decision Records](./docs/adr/) — why things are the way they are.
- [Product definition](./docs/product/prd.md) & [roadmap](./docs/product/roadmap.md).
- [Onboarding](./docs/onboarding.md) & [runbook](./docs/runbook.md).

## Collaboration

Developed by two people. Before pushing, read [CONTRIBUTING.md](./CONTRIBUTING.md).

- `main` is protected — no direct pushes; changes land through reviewed PRs.
- Branches are namespaced by initials: `sg/…` (Stefan), `in/…` (Ignacio).
- Every PR gets a review from the other person and must pass CI before merging.

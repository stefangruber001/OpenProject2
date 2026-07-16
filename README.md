# OpenProject2

A new product, starting from a professional TypeScript foundation. **The product
isn't defined yet** — the engineering foundation below is ready for whatever it
becomes.

[![CI](https://github.com/stefangruber001/OpenProject2/actions/workflows/ci.yml/badge.svg)](https://github.com/stefangruber001/OpenProject2/actions/workflows/ci.yml)

> **Status:** Foundation ready. See [`docs/architecture.md`](./docs/architecture.md)
> for how it's put together.

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

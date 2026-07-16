# Architecture

This is the map of the system. Read it first to get oriented. It is intentionally
short — deeper "why" lives in the [Architecture Decision Records](./adr/).

## What this is

The product is still being defined. This document describes the **foundation** it
will be built on — the structure, stack, and conventions. Once the product is
defined, capture it in [`docs/product/prd.md`](./product/prd.md) and the phases in
[`docs/product/roadmap.md`](./product/roadmap.md).

## The stack

| Layer         | Choice                           | Why (short)                                        |
| ------------- | -------------------------------- | -------------------------------------------------- |
| Language      | TypeScript                       | One language across the whole stack; type-safety.  |
| Web framework | Next.js (App Router) + React     | 2026 default for B2B SaaS; huge ecosystem.         |
| Styling       | Tailwind CSS                     | Fast, consistent UI without bespoke CSS.           |
| Database      | PostgreSQL                       | Reliable, relational, ubiquitous.                  |
| ORM           | Prisma                           | Type-safe queries; readable schema; great tooling. |
| Monorepo      | Turborepo + pnpm                 | One repo, cached tasks, shared packages.           |
| Tests         | Vitest (unit) + Playwright (e2e) | Fast unit tests; real-browser end-to-end.          |
| CI            | GitHub Actions                   | Runs every quality gate on every PR.               |

Full rationale for each: see the ADRs.

## Repository layout

```
OpenProject2/
├─ apps/
│  └─ web/                 # The Next.js application (UI + API routes)
│     ├─ app/              # Routes (pages + /api/* handlers)
│     ├─ lib/              # App utilities (typed env, formatting, ...)
│     └─ e2e/              # Playwright end-to-end tests
├─ packages/
│  ├─ db/                  # Prisma schema, client, migrations, seed  (@repo/db)
│  ├─ ui/                  # Shared React component seed              (@repo/ui)
│  ├─ eslint-config/       # Shared lint rules                        (@repo/eslint-config)
│  └─ typescript-config/   # Shared tsconfig presets                  (@repo/typescript-config)
├─ docs/                   # This documentation
│  ├─ adr/                 # Architecture Decision Records
│  └─ product/             # PRD + roadmap
├─ .github/                # CI workflows, templates, CODEOWNERS, Dependabot
└─ (root configs)          # turbo, pnpm, prettier, tsconfig, env example
```

The rule of thumb: **application** code lives in `apps/`, **reusable** code lives
in `packages/`. Anything shared by more than one app becomes a package.

## Request lifecycle (today)

1. A browser requests a page. Next.js renders React on the server.
2. Interactive/data routes call **API route handlers** under `apps/web/app/api/*`.
3. Handlers talk to the database through `@repo/db` (the Prisma client).
4. Prisma runs type-safe SQL against PostgreSQL.

`GET /api/health` is a working example: it reports app liveness and, if a
database is configured, whether it is reachable.

## Environments

| Environment | Purpose                       | Data                     |
| ----------- | ----------------------------- | ------------------------ |
| Development | Your laptop                   | Local/throwaway Postgres |
| Staging     | Shared pre-production (later) | Non-production data      |
| Production  | Real customers (later)        | Real data, backed up     |

Configuration is supplied entirely through environment variables (see
[`.env.example`](../.env.example)). Secrets never live in the repo. All env
access goes through the typed, validated `env` object in `apps/web/lib/env.ts`.

## Quality gates

Every pull request must pass, in CI, before it can merge:

- **Lint** (ESLint) — catches bugs and enforces style.
- **Type-check** (`tsc`) — no type errors anywhere.
- **Unit tests** (Vitest).
- **Build** (`next build`) — it actually compiles.
- **End-to-end** (Playwright) — the app boots and serves.

Locally, a Git pre-commit hook formats staged files (Prettier via lint-staged)
so formatting never shows up in review.

## The foundation, mapped

The engineering pillars and where each one lives:

| Pillar                           | Where                                        |
| -------------------------------- | -------------------------------------------- |
| Version control & PR review      | `main` protected; `CONTRIBUTING.md`          |
| Documented decisions             | `docs/adr/`                                  |
| Consistent structure             | this file; Turborepo layout                  |
| Automated quality gates          | `.github/workflows/ci.yml`; Husky pre-commit |
| Testing                          | `apps/web/lib/*.test.ts`; `apps/web/e2e/`    |
| Type-safe data layer             | `packages/db`                                |
| Config & secrets                 | `.env.example`; `apps/web/lib/env.ts`        |
| Dependency & security automation | `.github/dependabot.yml`; `SECURITY.md`      |
| Docs & product foundation        | `docs/`                                      |

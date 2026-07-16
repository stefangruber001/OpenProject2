# 0004. Prisma as the ORM

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

We need a way to talk to PostgreSQL that is type-safe, approachable for an
AI-assisted team, and has a clear migration story so the schema evolves safely.

## Decision

Use **Prisma**. The schema in `packages/db/prisma/schema.prisma` is the single
source of truth. Prisma generates a fully typed client, and `prisma migrate`
manages schema changes as reviewable, version-controlled migration files.

## Consequences

- Queries are type-checked; the editor autocompletes model fields.
- **Prisma Studio** (`pnpm db:studio`) gives a visual browser for the data — handy
  for non-technical review.
- Migrations are files in the repo, so schema history is auditable and PR-reviewed.
- We store money as integer cents (not floats) to avoid rounding errors.
- Note: Prisma 7 will move some config out of `package.json`; we'll migrate when
  we upgrade.

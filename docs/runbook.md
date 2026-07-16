# Runbook — operating the project

Practical how-tos for common tasks. Grows as we add real infrastructure.

## Local database

A `docker-compose.yml` at the repo root runs PostgreSQL matching `.env.example`.

```bash
docker compose up -d      # start
docker compose down       # stop (keeps data)
docker compose down -v    # stop and DELETE all local data
```

No Docker? Run your own PostgreSQL and set `DATABASE_URL` in `.env` to point at it.

## Database schema changes

The schema lives in `packages/db/prisma/schema.prisma` and is the source of truth.

```bash
# After editing the schema, create + apply a migration in development:
pnpm db:migrate            # prompts for a migration name

# Regenerate the typed client (usually automatic, but if needed):
pnpm db:generate

# Inspect data visually:
pnpm db:studio

# Re-seed demo data:
pnpm db:seed
```

Migrations are files under `packages/db/prisma/migrations/`. They are committed
and code-reviewed like any other change. **Never** hand-edit the database in a
way that isn't captured by a migration.

In production, apply migrations with `pnpm db:deploy` (reads config from the host
environment, not a `.env` file).

## Running quality checks like CI does

```bash
pnpm lint && pnpm check-types && pnpm test && pnpm build
```

If these pass locally, CI should pass too.

## Environment variables

All config comes from environment variables; see `.env.example` for the list.
Access them in code only through `apps/web/lib/env.ts`, which validates them at
startup so a missing/invalid value fails loudly and early.

## Deployment (to be defined)

Not wired up yet. When we choose a host, document here: how to deploy, how to run
migrations on deploy, how to roll back, and where logs/metrics live. Capture the
hosting choice in an ADR.

## Common issues

- **`Environment variable not found: DATABASE_URL`** — you haven't created `.env`
  (`cp .env.example .env`) or the database isn't running (`docker compose up -d`).
- **Prisma client type errors after changing the schema** — run `pnpm db:generate`.
- **Playwright can't find a browser** — run
  `pnpm --filter web exec playwright install chromium` once.

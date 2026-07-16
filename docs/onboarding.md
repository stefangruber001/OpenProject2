# Onboarding — from zero to a running app

Welcome! This gets you from a fresh clone to the app running locally in a few
minutes. If anything here is wrong or unclear, fix it in a PR — onboarding docs
rot fastest.

## Prerequisites

- **Node.js 22** (the repo pins it in `.nvmrc` — `nvm use` picks it up).
- **pnpm** (`corepack enable` makes the right version available automatically).
- **Docker** (the easy way to run PostgreSQL locally), or your own Postgres.

## Steps

```bash
# 1. Install dependencies (also generates the Prisma client)
pnpm install

# 2. Set up your environment file
cp .env.example .env

# 3. Start a local database
docker compose up -d           # starts PostgreSQL on localhost:5432

# 4. Create the schema and seed demo data
pnpm db:migrate                # creates tables from the Prisma schema
pnpm db:seed                   # inserts placeholder demo data

# 5. Run the app
pnpm dev                       # http://localhost:3000
```

Open <http://localhost:3000>. Check <http://localhost:3000/api/health> — it
should report `"status":"ok"` and `"database":"connected"`.

## Everyday commands

| Command            | What it does                                                |
| ------------------ | ----------------------------------------------------------- |
| `pnpm dev`         | Run the app with hot reload.                                |
| `pnpm test`        | Run unit tests.                                             |
| `pnpm test:e2e`    | Run end-to-end tests (installs a browser once — see below). |
| `pnpm lint`        | Lint everything.                                            |
| `pnpm check-types` | Type-check everything.                                      |
| `pnpm db:studio`   | Open a visual browser for your data.                        |
| `pnpm format`      | Format the codebase.                                        |

First time running e2e locally, install the browser once:
`pnpm --filter web exec playwright install chromium`.

## Where things live

See [`docs/architecture.md`](./architecture.md) for the repository map. Short
version: app code in `apps/web`, shared code in `packages/*`, decisions in
`docs/adr`.

## How we work together

Read [`CONTRIBUTING.md`](../CONTRIBUTING.md): never commit to `main`, branch with
your initials (`sg/…`, `in/…`), open a PR, get the other person's review.

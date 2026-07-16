# @repo/db

The database layer: Prisma schema, generated client, and seed data. This is the
single source of truth for the data model. Everything database-related is
imported from `@repo/db`.

## Common commands (run from the repo root)

| Command            | What it does                                               |
| ------------------ | ---------------------------------------------------------- |
| `pnpm db:generate` | Regenerate the Prisma client after changing the schema.    |
| `pnpm db:migrate`  | Create & apply a migration in development.                 |
| `pnpm db:push`     | Push the schema to the DB without a migration (throwaway). |
| `pnpm db:studio`   | Open Prisma Studio — a visual browser for your data.       |
| `pnpm db:seed`     | Insert demo data.                                          |

## Usage

```ts
import { prisma } from "@repo/db";

const examples = await prisma.example.findMany();
```

See `docs/runbook.md` for how to run PostgreSQL locally.

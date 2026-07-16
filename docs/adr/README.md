# Architecture Decision Records (ADRs)

An ADR captures **one significant decision**: the context, the choice we made,
and the consequences. They're short and never edited after acceptance — if a
decision changes, we add a new ADR that supersedes the old one.

Why bother? So that six months from now (or when a third person joins) nobody
has to guess _why_ something is the way it is. The reasoning is written down.

## Index

| #    | Title                                   | Status   |
| ---- | --------------------------------------- | -------- |
| 0001 | Record architecture decisions           | Accepted |
| 0002 | Monorepo with Turborepo and pnpm        | Accepted |
| 0003 | TypeScript · Next.js · PostgreSQL stack | Accepted |
| 0004 | Prisma as the ORM                       | Accepted |

## Writing a new one

Copy [`_template.md`](./_template.md) to `NNNN-short-title.md` (next number),
fill it in, and link it in a PR. Add it to the index above.

# ERP START INPUT — the canonical starting point for every new company

> Operator convention (set 2026-07-17): **"ERP START INPUT" is the generic
> factory baseline. Every new company starts from here.**

## What the baseline is

- **Git tag:** `erp-start-input` (local; the git proxy does not list tags, so
  the durable pin is the SHA below)
- **Commit:** `539c530b25caa683a6012c9170c6978bf3048de4`
- **Contents:** kernel 1.0.0 · quoting + billing capabilities ·
  `jurisdiction/es-ES` + `vertical/construction-reformas` packs · boundary
  enforcement · factory CLI · web shell · Postgres+RLS persistence — all
  CI-verified, zero company-specific data.

## Why you rarely need to "go back" to it

The factory's core rule is that **customisation is data, never a code fork**
(ADR-0005/0010). Company-specific material lives only in:

- `tenants/<id>/tenant.yaml` — the company's spec/config
- `intake/<id>/` — their intake documents and requirements map

So the _current_ head of the repo is always a superset of the baseline:
starting company #N never requires reverting anything — the baseline is
conceptually present in every commit. The tag/SHA exists as an audit anchor
and an emergency restore point, not a working branch.

## Procedure for a new company ("start from ERP START INPUT again")

1. `pnpm factory new-tenant --name <company-id> --legal-name "<Legal Name>"`
   (seconds, config-only).
2. Drop their intake documents in `intake/<company-id>/` and write a
   `REQUIREMENTS-MAP.md` (coverage: built ✓ / config / backlog / excluded).
3. Apply intake facts to `tenants/<company-id>/tenant.yaml` only.
4. `pnpm factory validate tenants/<company-id>/tenant.yaml` → demo → done.
   Anything the intake needs that the factory lacks becomes a **pack or
   capability improvement** (benefits every tenant), never a fork.

## Companies started from this baseline

| Company                                                          | Started    | Intake           |
| ---------------------------------------------------------------- | ---------- | ---------------- |
| diorka (Proyecto Diorka — family renovation group, multi-entity) | 2026-07-17 | `intake/diorka/` |

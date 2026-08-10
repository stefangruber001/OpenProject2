# CLAUDE.md — how to work in this repo

Mission: an **ERP factory** — spec in, running tested compliant ERP out,
repeatable for 1000+ EU SME tenants. The ERP is the output, the factory is the
product. Tenant #1 is a Spanish _reformas_ SME.

## Start here, every session

1. Read `PROGRESS.md` → pick the next task. Do not re-plan from scratch.
2. Autonomy contract: **never ask the operator; decide the most reversible
   option and log it in `ASSUMPTIONS.md`**. Legal uncertainty →
   `LEGAL_REVIEW.md` + `legally_verified: false` gate. Missing credential →
   fake adapter + `INTEGRATIONS_PENDING.md`. Disagreement → `OBJECTIONS.md`,
   then implement the mandate anyway.
3. End every unit: tests green → commit (conventional message) → update
   `PROGRESS.md` → continue. Never leave the repo red or half-migrated.

## Architecture (enforced, not aspirational)

Layers, strictly downward:
`plugins → tenant config (data only) → vertical packs → jurisdiction packs → capabilities → kernel`

- **Kernel & capabilities contain ZERO jurisdiction/sector knowledge.** No tax
  rates, no `IVA`, no `partida`, no `Modelo`, no country anything. The
  forbidden-literal linter fails CI on it.
- Capabilities define **ports**; packs supply **adapters**; the resolver binds
  them per tenant from the spec (`tenants/<id>/tenant.yaml`).
- Packs never import packs (no vertical→vertical, no jurisdiction→jurisdiction,
  no vertical↔jurisdiction). Cross-cutting law (e.g. Spain×construction) =
  bridge adapter against a published contract, see ADR-0011.
- Jurisdiction rules are **effective-dated**: `resolve(rule, effective_date)`,
  and the decision **plus justification** is persisted on the artifact.
- New capability = new pack/module, never an edit that pushes knowledge into
  the kernel. Customisation is config (data), never a code fork.

### Neutral glossary (kernel + capabilities)

The forbidden-literal linter scans **comments and doc-strings too**, not just
code — and the natural vocabulary of this domain is exactly what it forbids.
Use these words in kernel/capability code and comments; keep the domain words
for packs, `site/`, and tenant config, where they belong:

| Say this (generic) | Not this (jurisdiction/sector) |
| ------------------ | ------------------------------ |
| line item          | partida                        |
| measurement        | medición                       |
| progress valuation | certificación                  |
| tax                | IVA                            |
| withholding        | IRPF                           |
| issued documents   | facturas emitidas              |
| archive / package  | paquete gestoría               |
| tax authority      | AEAT                           |
| tax filing         | Modelo NNN                     |

Also: never call `Intl.*` with a hardcoded locale in a capability (`es-ES` is
a forbidden literal) — formatting belongs to the host. Run `pnpm boundaries`
before every commit; a violation in a comment fails CI exactly like one in
code.

## Host layer (outside the matrix)

`packages/factory`, `packages/erp-browser`, `packages/db`, `packages/ui` and
`apps/web` are **hosts**: the linter does not classify them, so they may
compose capabilities _and_ packs and may hold infrastructure concerns. That is
deliberate — composition has to happen somewhere. It is not a licence for
business rules: a rule in a host is a rule in neither a capability nor a pack,
which is the worst of both. Push it down.

`packages/erp-browser` bundles selected capabilities into
`site/erp-factory.js` (+ `.cjs`), which `site/erp-bridge.js` calls on behalf of
`site/erp.html`. Both artifacts are **generated and committed** (pages.yml
publishes `site/**` from a bare checkout with no Node) and are prettier-ignored;
CI rebuilds and diffs them, so never edit them by hand. See
`docs/worklog/WORKLOG.md` for the migration plan they serve.

## Commands

- `pnpm install` · `pnpm lint` · `pnpm check-types` · `pnpm test` · `pnpm build`
- `pnpm boundaries` — layer + literal enforcement (CI runs it too)
- `pnpm --filter @repo/erp-browser build` — regenerate the committed
  `site/erp-factory.{js,cjs}` bundle after changing a bundled capability
  (no Node locally? CI's `bundle` job uploads it as an artifact)
- `pnpm factory <resolve|validate|new-tenant|demo> …` — the factory CLI
- `make bootstrap && make demo` — clean-machine path to tenant #1 artifacts
- DB (when used): `pnpm db:migrate`, `pnpm db:studio` (root `.env`, see runbook)

## Git rules

- Branch: whichever the session mandate designates. Sessions 1-3 used
  `claude/orin-project-status-1q50dt`; the v4 programme uses
  `claude/candi-programme-session-4-07amo8`. Never push elsewhere.
- **Never content-copy `site/` between branches.** Merge, or port file by file
  against a diff you have read. Copying is silent: the screens arrive, the
  branch you copied _from_ stays green, and the work you overwrote on the branch
  you copied _to_ only surfaces as its own tests failing. That is exactly how
  `main` spent five commits red — see `docs/worklog/SESSION-S1A.md`.
- Small green commits; push with `git push -u origin <branch>` (retry w/
  backoff on network failure). **No force-push, no history rewrite, no branch
  deletion** (mandate §3).
- Never commit secrets; `.env` stays local. No real emails/filings/payments —
  fakes behind ports only.

## Definition of Done (stop condition)

See mandate §12 — `make demo` green on clean machine; tenant #2 in <15 min
config-only; the **negative test** (kernel+billing with no jurisdiction pack
fails loudly) passing; P0–P5 complete; governance files honest and current.

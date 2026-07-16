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

## Commands

- `pnpm install` · `pnpm lint` · `pnpm check-types` · `pnpm test` · `pnpm build`
- `pnpm boundaries` — layer + literal enforcement (CI runs it too)
- `pnpm factory <resolve|validate|new-tenant|demo> …` — the factory CLI
- `make bootstrap && make demo` — clean-machine path to tenant #1 artifacts
- DB (when used): `pnpm db:migrate`, `pnpm db:studio` (root `.env`, see runbook)

## Git rules

- Branch: `claude/orin-project-status-1q50dt`. Never push elsewhere.
- Small green commits; push with `git push -u origin <branch>` (retry w/
  backoff on network failure). **No force-push, no history rewrite, no branch
  deletion** (mandate §3).
- Never commit secrets; `.env` stays local. No real emails/filings/payments —
  fakes behind ports only.

## Definition of Done (stop condition)

See mandate §12 — `make demo` green on clean machine; tenant #2 in <15 min
config-only; the **negative test** (kernel+billing with no jurisdiction pack
fails loudly) passing; P0–P5 complete; governance files honest and current.

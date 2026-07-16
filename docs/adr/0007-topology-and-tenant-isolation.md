# 0007. Topology & tenant isolation: shared app tier, Postgres RLS, per-tenant export

- **Status:** Accepted (implementation lands P2/P3)
- **Date:** 2026-07-16

## Context

1000 SME tenants generate trivial load each (mandate §7: the constraint is
engineer-minutes, not CPU). Options: per-tenant stacks (max isolation, max
toil), shared-everything (min toil, blast-radius risk), or hybrid.

## Decision

**Shared multi-tenant application tier + one PostgreSQL cluster with
row-level security (RLS) keyed by `tenant_id`**, EU region only.

Costed sketch (infra + human hours):

| Tenants | Per-tenant stacks                     | Shared + RLS (chosen)              |
| ------- | ------------------------------------- | ---------------------------------- |
| 10      | ~10 small VMs + 10 DBs; upgrades ×10  | 1 small cluster; upgrades ×1       |
| 100     | fleet tooling mandatory just to patch | same cluster, bigger; still ×1     |
| 1000    | ~a platform team                      | wave deploys ×1; DB maintenance ×1 |

- Blast radius is managed by **wave rollouts + auto-rollback** (P4), not by
  physical separation.
- **Per-tenant export/restore is a routine, tested feature** (principle 13):
  logical dump filtered by tenant_id → the offboarding artifact. A noisy or
  regulated tenant can be _promoted_ to a dedicated database later — the RLS
  schema makes that a data move, not a rewrite.

## Consequences

- One migration, one backup policy, one pager. Marginal infra cost of tenant
  #N+1 ≈ 0.
- RLS discipline is mandatory: every query path goes through the kernel's
  tenant-scoped persistence port; CI tests assert cross-tenant reads fail.
- **Revisit trigger:** a tenant >1% of cluster load, a residency demand
  outside the shared region, or RLS bug class appearing in audits.

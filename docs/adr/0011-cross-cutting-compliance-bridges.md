# 0011. Cross-cutting compliance (jurisdiction × vertical) = bridge adapters over a data contract

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

Some law is genuinely the product of a jurisdiction AND a sector: Spain's REA,
Libro de Subcontratación, CAE/PRL docs exist only for Spanish construction.
This is exactly the N×M trap (mandate §11.2): a `es-construction` pack is how
you wake up with 40 packs.

## Decision

Two mechanisms, both already in use:

1. **Data-contract vocabulary (light):** verticals emit namespaced, opaque
   attributes and hints (`construction.recipient`,
   `construction.works-on-dwelling`); jurisdiction adapters _interpret_ them.
   Neither package imports the other — the contract is the documented key set,
   covered by the factory's composed e2e tests. This powers the reduced-IVA
   decision today.
2. **Bridge adapters (heavy, when real ports are needed):** the vertical pack
   declares the port (e.g. `construction.subcontracting-ledger@1` with a
   published contract type); a jurisdiction pack ships an _optional
   sub-module_ implementing it, which the resolver activates **only when both
   packs are selected**. The bridge is an isolated adapter with its own tests
   — never a fork of either pack, never a third pack.

Cost model: a genuine jurisdiction×vertical law costs one bridge module. That
cost is irreducible — the law exists — but it stays additive and isolated.

## Consequences

- Kernel/capabilities stay clean; the literal linter keeps enforcing it.
- The vocabulary is a versioned, documented contract; renaming a key is a
  breaking change handled like any port version bump.
- **Revisit trigger:** a second jurisdiction implementing the same
  construction port — extract the contract into a tiny shared
  `contracts/construction` package at that moment, not before (YAGNI).

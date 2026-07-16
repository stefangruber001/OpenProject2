# 0005. Layered composition: kernel · capabilities · packs · config

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

We are building an ERP **factory** for many EU SME tenants across
jurisdictions and verticals. The killer cost at scale is N×M: one codebase per
country×sector combination. The mandate requires N+M composition with
boundaries enforced by the build.

## Decision

Five layers, strictly downward-dependent:
`plugins → tenant config (data only) → vertical packs → jurisdiction packs → capabilities → kernel`.

- Kernel and capabilities contain **zero** jurisdiction/sector knowledge.
- Capabilities declare **ports** (`tax@1`, `invoice-chain@1`, `doc-labels@1`);
  packs bind **adapters** at resolve time from the tenant spec.
- Packs never import packs — in any direction.
- Every tenant is a _selection_ (spec), never a fork.

## Consequences

- Jurisdiction #2 (say de-DE) is a new pack binding the same ports — kernel,
  capabilities and existing packs untouched. That claim is falsifiable via the
  negative test (ADR-0006, mandate §12.3) and the port architecture.
- Slightly more indirection than a monolith; paid once, in the kernel.
- **Revisit trigger:** any feature that "needs" a capability to know a country
  or sector concept — that's a new port, not an exception.

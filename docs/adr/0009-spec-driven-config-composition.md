# 0009. Spec-driven composition of config schema and tests

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

The tenant spec must be the single source of truth (principle 6), and a new
pack must arrive self-validating and self-testing (mandate §6.2) so
jurisdiction #2 changes no validator and no harness.

## Decision

- Kernel owns the spec schema (tenant, kernel range, capabilities,
  jurisdiction, vertical, plugins, config).
- Capabilities and packs export **Zod config-schema fragments**; the resolver
  composes kernel base + selected fragments into one **strict** schema —
  unclaimed config keys are errors (config drift dies at resolve time).
- Packs ship their own **contract tests** in-package; the factory's e2e suite
  exercises the composed system per tenant fixture. Adding a pack adds tests
  by existing, not by editing a harness.
- Conflicts (two packs binding one port, unknown packs, missing required
  ports, kernel range mismatch, validity windows) fail **at resolve time**
  with named errors.

## Consequences

- `factory validate` is the one gate a spec must pass; deploys/tests/docs all
  derive from the same resolution report.
- Strictness means intentional config additions require a fragment change —
  that's the point (config that is secretly code is banned, §8).
- **Revisit trigger:** fragments needing cross-fragment invariants (e.g.
  jurisdiction constraining billing series) — add a resolver-level rule hook,
  keep fragments independent.

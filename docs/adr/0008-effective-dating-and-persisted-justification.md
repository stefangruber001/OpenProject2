# 0008. Effective-dated rules with persisted justification

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

Tax law is versioned by _date_, not semver (mandate §6.3). Amending a March
invoice in November must apply March's law. Retrofitting time-awareness into a
live fleet is impossible.

## Decision

- Every jurisdiction rule is an `EffectivePeriod<T>[]` resolved via
  `resolveAt(periods, date)`; **no period covering the date ⇒ error**, never a
  guess.
- The resolved decision **and its justification** (rule id, legal basis,
  effective date, inputs, provider id+version, `legallyVerified` flag,
  human-readable explanation) are **persisted on the artifact** at issue time
  and never recomputed on read.
- Documents are immutable; corrections are new artifacts (rectificativas)
  whose law resolves at _their_ issue date, referencing the original.

## Consequences

- Auditability: every invoice explains itself years later, even after rule
  tables change.
- Rule updates are data appends (new period rows), reviewable in PRs.
- **Revisit trigger:** a rule whose validity isn't purely date-based (e.g.
  turnover-dependent regimes) — extend the resolver context, keep the
  persisted-justification invariant.

# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

We are starting a new product that we intend to use professionally for years.
Decisions made now (stack, structure, conventions) will be lived with for a long
time. Without a written record, the reasoning behind them gets lost, and future
contributors — including our future selves — repeat debates or undo choices
without knowing why they were made.

## Decision

We will keep **Architecture Decision Records** in `docs/adr/`. Each significant
decision gets a short, numbered, immutable record using the template. When a
decision changes, we write a new ADR that supersedes the old one rather than
editing history.

## Consequences

- A newcomer can read the ADRs and understand how we got here.
- Decisions are deliberate and documented, not accidental.
- Small ongoing cost: a few minutes to write an ADR per major decision. Worth it.

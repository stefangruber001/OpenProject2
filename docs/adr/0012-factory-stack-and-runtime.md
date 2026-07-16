# 0012. Factory stack: TypeScript end-to-end on the existing foundation

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

The repo already had a verified TS/Next.js/Prisma/Turborepo foundation
(ADR-0002/0003/0004) when the factory mandate arrived. Principle 9 demands
boring, 8-year-maintainable tech; the mandate demands determinism and
composition.

## Decision

- **One language (TypeScript) for kernel, capabilities, packs, factory and
  UI.** Zod for schema fragments (already in the stack), integer money in the
  kernel, no floating point in amounts.
- Factory packages run via `tsx`/Vitest with bundler-style resolution
  (`typescript-config/node-library.json`); packaging/build output is a P3
  task (tsup) — behind the same package boundaries.
- Persistence stays behind kernel ports; P1 is in-memory (test-proven), the
  Prisma/Postgres adapter (RLS, ADR-0007) is the next infrastructure step,
  reusing `packages/db`.
- Web/mobile/desktop delivery: the existing Next.js app becomes the ERP
  shell; PWA and Tauri wrappers are packaging, not architecture (see
  OBJECTIONS.md #3).

## Consequences

- No rewrite, no second ecosystem, largest hiring pool, AI-assisted
  development stays first-class.
- Deterministic artifacts already proven byte-identical in tests
  (principle 7).
- **Revisit trigger:** a workload TS genuinely can't serve (heavy OCR,
  planning solvers) — that becomes a sidecar service behind a port, not a
  stack change.

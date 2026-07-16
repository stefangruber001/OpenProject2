# 0002. Monorepo with Turborepo and pnpm

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

The product will grow beyond a single web app: a shared data layer, a shared
design system, and possibly a mobile app later. We need a structure
that lets these share code without version-syncing separate repositories, while
keeping builds and tests fast.

## Decision

Use a **monorepo** managed by **pnpm workspaces** and **Turborepo**. Application
code lives in `apps/*`; reusable code lives in `packages/*`. Turborepo caches
task results and only rebuilds/tests what changed.

## Consequences

- One clone, one install, one place for everything. Shared code is imported
  directly (`@repo/db`, `@repo/ui`) with no publishing step.
- Adding a mobile app later is `apps/mobile` reusing existing packages — no
  rewrite.
- Slightly more configuration than a single app up front, absorbed by starting
  from a maintained Turborepo baseline.

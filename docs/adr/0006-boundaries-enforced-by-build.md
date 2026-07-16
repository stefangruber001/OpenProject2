# 0006. Boundaries enforced by the build (custom linter, not convention)

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

"If CI can't fail on it, it isn't a rule" (mandate principle 3). Generic
dependency-cruiser setups exist, but our rules are few, specific, and include
_content_ rules (forbidden literals), not just import direction.

## Decision

A small in-repo tool (`@repo/boundary-lint`, zero runtime deps) that fails CI on:

1. **Layer matrix violations** — declared deps AND source imports:
   capabilities may import only kernel; packs may import kernel+capabilities;
   nothing imports a pack except the host (factory/apps).
2. **Forbidden literals in kernel/capabilities** — tax names, filing ids,
   anti-fraud regime names, construction vocabulary, rate-like constants
   (0.21…), hardcoded locales.

Deliberate violations are **committed as fixtures** under
`__fixtures__/bad-workspace`; the linter's own tests assert they're caught
(green build proving red detection — satisfies both mandate P0 and
"never leave the repo red").

## Consequences

- The §8 anti-patterns are now build failures, not review comments. The tool
  already caught a real hardcoded-locale leak in kernel doc examples on its
  first run.
- New forbidden knowledge = one regex row. New layer = one classifier row.
- **Revisit trigger:** first false positive that tempts an `// allow` escape
  hatch — prefer renaming/redesign over exemption lists.

# 0010. What is deliberately NOT configurable

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

Every "flexible" knob is a support ticket, a test matrix row, and a fork with
extra steps. The list of things tenants may NOT change matters more than the
list they may (mandate §10).

## Decision

**Configurable (data):** branding, locale/currency, numbering series
definitions, price lists, users/roles, terminology labels, workflow toggles
packs expose, adapter selection via pack choice.

**NOT configurable — ever, for any customer:**

1. Money math and rounding policy (kernel, one function).
2. Invoice immutability and the rectificativa correction path.
3. Tax **decisions** — inputs are data; the rule logic is pack code with
   persisted justification. No "override rate" dropdown.
4. Numbering gaplessness (series are configurable; skipping numbers is not).
5. The audit/event trail (append-only, non-optional).
6. Schema shape per tenant — **no custom fields in v1**. The escape hatch is
   the versioned plugin API (sandboxed, contract-tested, expiring), or a pack
   extension that benefits every tenant of that vertical.
7. Effective-dating semantics.

"Just this once" custom fields are the documented death of these systems
(mandate §8). The answer is no; the mechanism for real needs is a pack
extension or a plugin.

## Consequences

- Support conversations get a written boundary to point at.
- Some prospects will walk. Accepted: they were buying a fork.
- **Revisit trigger:** the third _independent_ tenant needing the same
  "custom" field — that's not custom, that's the vertical pack missing a
  feature. Build it there, for everyone.

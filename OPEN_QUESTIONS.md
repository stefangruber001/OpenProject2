# OPEN_QUESTIONS — for the operator, non-blocking

Logged instead of asked (mandate §0). Work continues on the recorded
assumption; answers here overwrite config/data, not code.

1. **Real intake for tenant #1** — everything in `tenants/reformas-demo/` is
   synthetic (ASSUMPTIONS.md). Provide the real §1 YAML when available.
2. **Gestor's preferred export format** (A3? Holded? plain CSV?). Drives
   `accounting-export@1` adapter choice.
3. **Does tenant #1's mix include structural _rehabilitación_ projects?** If
   yes, the art. 20.Uno.22º.B decision path moves up the backlog (currently
   conservative fallback to general rate).
4. **Hosting/EU region + provider** for P3 (data residency, RGPD). Proposal
   will be an ADR; provisioning is never done autonomously (mandate §3: no
   paid resources).
5. **Company identity for real invoicing** (name, CIF, series naming habits)
   — synthetic placeholders until then.
6. Anything irreversible discovered later lands here instead of being done.

## Diorka (from BRD §11 — for the owner validation workshop)

7. Legal names, CIFs, fiscal addresses, banking and numbering habits of ALL
   group entities (§11.1) → each becomes a tenant, config-only.
8. Are quotes needed in Spanish, Catalan or both (§11.3)? Catalan doc-label
   set is a config addition once confirmed.
9. Gestor/accountant export format (§11.6) and whether data can be exported
   from cane.gestortectic.com (TecTic) for migration (§7.3).
10. Supplier list + which portals/price lists are electronically accessible
    (§11.4); portal credentials are never stored in this repo.
11. Billing patterns (deposits/milestones/final) and typical payment terms
    (§11.6) → drives AR/AP slice defaults.
12. Devices used daily by both owners; site connectivity (§11.7) → shapes
    the mobile capture slice.

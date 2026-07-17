# Diorka — delivery plan to shipped, tested solution

Plan-of-record (2026-07-17), presented to the operator in chat. Follows the
BRD's incremental-adoption principle and uses BRD §12 sign-off + §4.1
measures as the acceptance contract. Requirement IDs refer to
`intake/diorka/REQUIREMENTS-MAP.md` / the BRD.

## Releases

- **R0 Foundation — DONE, CI-verified**: multi-entity (ORG-01..03), es-ES VAT
  engine w/ persisted justification (NFR-11), immutable invoicing +
  rectificativas, quote options/versions (QUO-07/12/13), sourcing comparison
  engine (SUP-03..10), chapter catalogue (CAT-01), Postgres RLS, web shell,
  ~80 tests + live-DB + e2e in CI.
- **R1 "Quotation without paper"**: catalogue-first presupuesto builder
  (NFR-01/02, VIS-05, QUO-01..04), cost/price/margin split hidden from the
  customer doc (QUO-05/06/10), options/exclusions/versions UI
  (QUO-07/08/11..14), branded PDF (QUO-15/16), comparison screen over
  sourcing (SUP-07..10), supplier+item registers w/ dated prices
  (SUP-01..06, CAT-02..06), two-owner auth (ORG-05/06).
  Tested: unit+e2e+PDF snapshots; UAT = rebuild 3 real past quotes (§12.3).
- **R2 "Project control & money"**: accepted version → immutable project
  baseline (PRJ-01..05), change orders (CHG-01..06), purchases & supplier
  bills w/ duplicate detection + allocation + due lists + partials
  (PUR-03..09, AP-01..08), customer invoicing incl. deposits/stage/partial +
  receipt allocation (AR-01..08), margin by chapter + weekly cash view
  (FIN-01..08), persona dashboards + §8.1 alerts (DAS-01..06).
  Tested: flow e2e + parallel run on one live project until reconciled.
- **R3 "Field & documents"**: mobile site-visit capture (VIS-01..07),
  documents everywhere (DOC-01..05), tasks, connectivity hardening
  (NFR-03/04), Catalan labels if confirmed (NFR-10, config).
- **R4 "Migration, hardening, go-live"**: §7.3 migration (dedupe, dated
  prices, summary-level history; assess TecTic export), EU hosting + backup
  with restore drill (NFR-06/09), permissions hardening, gestor exports
  (AR-10/AP-09/NFR-12), training on real projects (§9.1), parallel run,
  per-company cutover. Post-live: Verifactu certified mode before the 2027
  deadline (gated until certified).

## Gates & required inputs (outside the code)

1. Owner validation workshop (BRD §11) — before R1 UAT. Questions compiled
   in OPEN_QUESTIONS.md (legal names/CIFs → tenants; Catalan; billing
   patterns; suppliers; gestor format; devices).
2. Asesor/gestor sign-off on tax & invoice content → legally_verified:true —
   before the first real invoice.
3. Hosting/EU region decision (never provisioned autonomously) — before R4.

## Quality bar (every release)

All gates green (lint/types/tests/build/boundaries) + CI live-Postgres RLS +
browser e2e + release UAT on real Diorka data. Acceptance for "shipped" =
BRD §12 sign-off list + §4.1 measures (quote turnaround ↓, price freshness
100% dated+sourced, live margin per active project, overdue visibility,
owner adoption).

## Sequencing

Build proceeds continuously in verified cycles (R1 = current PROGRESS.md
queue). Calendar-critical path = workshop + asesor sign-off, not code.
Strict order R1→R2→R3→R4; each release usable before the next starts.

## Explicitly out of scope (BRD §10.2)

Accounting ledger/filings automation, payroll/HR, warehouse/stock, automatic
supplier-portal access, customer self-service portal, e-signature — unless
later confirmed. Tracked, not forgotten, in INTEGRATIONS_PENDING.md.

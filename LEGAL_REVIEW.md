# LEGAL_REVIEW — compliance findings, citations, and gates

Nothing here is legal advice; everything ships behind `legally_verified: false`
until a human (gestor/asesor) clears it. Each entry: finding → source (with
date) → how it's implemented → gate.

## 1. Verifactu (RD 1007/2023 + Orden HAC/1177/2024) — **deadlines moved again**

- **Finding (verified 2026-07-16):** RD-ley 15/2025 (disp. final 1ª) postponed
  mandatory adoption: **IS taxpayers → 2027-01-01; IRPF/others → 2027-07-01.**
  Previous dates (2026-01-01 / 2026-07-01, set by RD 254/2025) are superseded.
- Sources: [Noticias Jurídicas — nueva prórroga a 2027](https://noticias.juridicas.com/actualidad/noticias/20735-nueva-prorroga:-verifactu-no-sera-obligatorio-hasta-2027-para-sociedades-y-otros-contribuyentes/) ·
  [inza.blog 2025-12-04 — modificación de plazos](https://inza.blog/2025/12/04/modificacion-de-plazos-de-obligatoriedad-de-adopcion-de-verifactu/) ·
  [ICAM — se retrasa a 2027](https://web.icam.es/se-retrasa-al-2027-la-entrada-en-vigor-de-verifactu-la-nueva-normativa-de-facturacion-electronica/)
- **Implementation:** billing capability enforces immutability + rectificativa
  path; es-ES pack chains invoices (SHA-256, per-tenant sequence). The official
  _registro de facturación_ record layout, QR content and AEAT submission are
  **not** implemented yet.
- **Gate:** `config.jurisdiction.verifactu.enabled` exists; production use
  before certification is blocked. `INTEGRATIONS_PENDING.md` tracks the AEAT
  submission adapter. **legally_verified: false.**

## 2. Reduced IVA on dwelling renovation — art. 91.Uno.2.10º LIVA

- **Finding (verified 2026-07-16):** reduced rate applies only if ALL hold:
  (a) recipient is a natural person (not acting as business) using the dwelling
  privately, or a comunidad de propietarios; (b) construction or last
  rehabilitation completed **≥ 2 years** before works start; (c) materials
  supplied by the contractor **≤ 40 %** of the taxable base. One failure ⇒ the
  whole invoice at the general rate. Proof of age: any valid means (catastro,
  escritura, nota simple; STS 82/2025 relaxed cédula-only readings).
- Sources: [AEAT — ¿Qué tipo se aplica a las obras en viviendas?](https://sede.agenciatributaria.gob.es/Sede/iva/iva-operaciones-inmobiliarias/que-tipo-se-aplica-obras-viviendas.html) ·
  [Agremia — cuándo aplicar el 10 %](https://agremia.com/cuando-aplicar-el-tipo-de-iva-reducido-del-10/) ·
  [Trustin — guía 2026](https://trustin.es/blog/iva-reforma-vivienda)
- **Implementation:** effective-dated decision rule in `pack-jurisdiction-es-es`
  (`renovation_repair` category). Inputs (recipient type, private use, age
  years, materials share in bp) + rule id + legal basis + pack version are
  **persisted as the justification** on the invoice (mandate §6.3).
- **Open sub-questions for the asesor:** exact treatment of mixed
  works/materials invoices; _rehabilitación_ structural path (art.
  20.Uno.22º.B — currently falls back to general rate, conservative).
  **legally_verified: false.**

## 3. IRPF retention on subcontractor invoices

- **Finding:** retention applies to **professional** activities (15 % general,
  7 % first 3 years — art. 101.5 LIRPF); most construction subcontractor
  autónomos are **empresarial** (IAE business headings) ⇒ **no retention**;
  módulos cases can carry 1 %. The mandate's premise ("retention on autónomo
  subcontractors") is therefore _sometimes_ true — profile-dependent.
- **Implementation:** retention engine keyed by supplier profile
  (`professional | professional_new | modulos_1 | business`), default
  `business` ⇒ none. Needs asesor confirmation per real supplier.
  **legally_verified: false.**

## 4. Invoice content — RD 1619/2012 (Reglamento de facturación)

- Required fields modelled: series+number (correlative), issue date, parties
  with NIF and address, description, base, rate, cuota, total; rectificativas
  reference the original and use their own series. Simplified-invoice rules not
  yet modelled. **legally_verified: false.**

## 5. Split billing — one job, an end customer AND a general contractor

- **The situation:** a general contractor hired by the end customer sub-hires
  Canei. Part of the work is invoiced to the contractor, part directly to the
  end customer — one project, one budget, one margin, two recipients.
- **Why this needs an asesor and not a rule in code:** the two recipients are
  usually taxed differently, and one of the two treatments is a determination
  rather than a rate. Work invoiced to a private individual on their own
  dwelling may qualify for the reduced rate (§2 above). The same work invoiced
  to a contractor within a construction execution chain points at **inversión
  del sujeto pasivo** — the recipient self-assesses, the issuer charges no VAT,
  and the invoice must carry the legal mention. Whether a given engagement is
  inside that chain depends on the contractual relationship, not on the shape of
  either party's record.
- **What the system does, deliberately:** nothing automatic. Each payer on a
  project carries `taxTreatment` (`standard` | `reverseCharge` | `exempt`) and a
  free-text `taxJustification`, both set by the operator. `issueInvoice`
  persists **both** on the invoice, so the document records the decision and its
  stated reason rather than leaving it to be re-derived years later from a rule
  that may since have changed (mandate §6.3, same treatment as §2).
- **What is NOT modelled:** no inference of reverse charge from party type,
  role or activity code; no check that the chain condition actually holds; no
  automatic legal-mention wording beyond what the operator writes. A wrong
  determination here is a wrong filing, and guessing it silently is the failure
  this entry exists to prevent.
- **Open questions for the asesor:** whether an engagement of this shape is
  inside the execution chain; the exact mention required on the invoice; how a
  mixed invoice (some lines chain, some not) must be split — the system
  currently requires one treatment per payer, which forces the split to be made
  as scope rather than hidden inside one document.
  **legally_verified: false.**

## 6. Still to research before production (tracked, not blocking P0/P1)

Facturae 3.2.x + FACe for public-sector clients; B2B e-invoice under Ley Crea y
Crece (development pending its reglamento); Modelo 303/390/347/111/115/190 data
feeds; Registro de jornada (RD-ley 8/2019) retention rules; SEPA N19/N34/N43;
REA + Libro de Subcontratación + CAE/PRL docs (bridge-adapter pattern,
ADR-0011); RGPD/LOPDGDD data residency + retention + subject rights as
features. Each lands with its own entry here when implemented.

**Note (session 12):** the Torre de Control alert `GES-PACKAGE-DUE` and the
Mi Día calendar's matching "Envío a gestoría" milestone are an **internal,
tenant-configurable reminder** ("send the package within N days of
quarter-end," default 15) — not an asserted AEAT filing deadline. No specific
Modelo 303/390/etc. due date is modelled anywhere in `site/erp-engine.js`;
that remains tracked above, unstarted.

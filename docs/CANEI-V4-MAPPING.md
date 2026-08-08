# CANEI CRM v4 — Mapping, field dictionary and open questions

> **Session S0 · no code.** Produced against `General_Scheme_Canei_CRM_v4_EN.docx` (v4.0,
> 8 Aug 2026) and `Diorca_Base_de_Precios.xlsx` (workbook v2, 06/08/2026, six green sheets).
> The workbook is read **for its columns, not its contents** — no data is imported in this
> programme. This document is the reference every later session checks itself against.

Branch state at the time of writing: this branch carries the 25-screen product (sessions 4–12);
`origin/main` carries the infrastructure (auth, backend, PostgreSQL, Docker, deploy, backups,
design system) and **none of sessions 4–12**. They are integrated at the start of S1 (plan
decision 11).

---

## 1. Q1–Q6 — the doc's open questions, answered

### Q1 · Technology — "have Claude Code clarify which stack is already fixed"

**Fixed by the existing code, not negotiable without a rewrite:**

| Layer              | What is fixed                                                                                                | Where                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Shipped UI         | Static multi-page **vanilla JS**, no framework, UMD modules                                                  | `site/*.html`, `site/erp-*.js`                |
| Domain engine      | One ~6,000-line JS class over a plain-JSON state document                                                    | `site/erp-engine.js`                          |
| Local persistence  | **IndexedDB** `caneiERP` v2 (`kv` / `blobs` / `meta`) + a 9-step migration ladder                            | `site/erp-store.js`, `site/erp-migrations.js` |
| Remote persistence | **PostgreSQL** via Prisma, JSONB aggregate store, RLS forced per tenant                                      | `packages/db/`, `origin/main`                 |
| Backend            | Command-based: UI posts named commands with the version they were composed against; a stale write is refused | `site/erp-backend.js` (`origin/main`)         |
| Composition        | Kernel + 18 capability packages + jurisdiction/vertical packs, resolved per tenant, boundary-linted in CI    | `packages/`                                   |
| Delivery           | GitHub Pages (`main` → root, dev branch → `/preview`); iOS + Android WebView shells load `/preview`          | `.github/workflows/pages.yml`                 |
| Hosting (new)      | Docker Compose + Caddy (HTTPS) + Hetzner provisioning + encrypted backups + restore drill                    | `ops/`, `docker-compose.prod.yml`             |

**Consequences for the v4 build:** the UI must keep working from a bare static host with no
network (rule 09, site capture on poor signal), which is why OCR runs **in the browser**; and any
new screen is plain JS against the same engine — no framework may be introduced.

**Still open (operator's call, not the code's):** who operates the server and pays for it, and
whether the mobile betas move from `/preview` to the production host.

### Q2 · Scope of the migration

**Answered by this programme's design, not deferred:** no data is loaded now. The model is being
given a home for every workbook variable so a _filtered_ upload is possible later. Historical
presupuesto versions stay unloaded, per the doc — but the line-context columns are retained in the
model (plan decision 10) so the decision is reversible.

### Q3 · Supplier document types

The nine types stand. The workbook's `Documentos.Tipo` and `Precios.Tipo de fuente` between them
name every one plus a few of our own outbound kinds; the model's `captured.docType` already
carries the discriminator. **No type is removed.** Recommendation: keep all nine — the two the doc
calls structural (supplier offer feeds price + purchase; abono subtracts cost) are load-bearing,
and the rest cost nothing but an enum entry.

### Q4 · The proyecto ↔ compra ↔ factura ↔ cobro ↔ pago interrelation

Validated structurally in **§5** below. **Verdict: the chain closes, with one gap** — a cost can
reach an account instead of a project, and that path does not exist in the engine today (gap 13,
`accountCode`). Everything else in the chain has a field to carry it.

### Q5 · Platform ledgers vs gestoría ledgers

**Confirm the proposed rule.** While a period is open the platform's figures rule; once the
gestoría ledger is imported it becomes final and the difference is shown alongside. The built
module already has the ledger panels to hold both (§2, ADM-09). **Recommendation: do not lock a
gestoría-closed period for editing** — show it read-only with an explicit "reopen" action that is
logged, because a locked period with a discovered error has no legal escape hatch and the audit
log already records who changed what.

### Q6 · The Plan de Cuentas as the destination of allocations

**Answered: the account list already exists and is the right one.** `site/financial-data.html`
carries a chart of accounts (700 Revenue, 600 Materials, 601 Subcontractors, 602 Site labour, 640
Salaries, 621 Rent…) with statement and line mapping, and its fourteen panels match Appendix E
one-for-one. What is missing is the _wiring_: no `accountCode` on bills, movements or cash. That
is gap 13, scheduled in S11.

---

## 2. The 26 screens — doc vs. built

Verdict key: **KEEP** (built ≥ doc, integrate only) · **ADAPT** (exists, reshape to the doc) ·
**SPLIT/MERGE** · **BUILD** (does not exist) · **STRIP** (built exceeds the doc; reduce).

| Doc    | Screen                  | Built today                                                          | Verdict                                                                         |
| ------ | ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| TC-01  | Torre de Control        | `#torre` — 8 cards, sparklines, customisation, CSV, alert management | **STRIP** to 4 indicators + project status + max 5 alerts                       |
| COM-01 | Leads                   | inside `#oportunidades`                                              | **SPLIT**                                                                       |
| COM-02 | Visita                  | inside `#oportunidades`                                              | **SPLIT** — own two-block screen                                                |
| COM-03 | Presupuesto             | `#presupuestos` + builder                                            | **ADAPT** — sections/mediciones/versions exist                                  |
| COM-04 | Contrato                | `#contratos` — installments exist                                    | **ADAPT** — add PDF viewer + anexos                                             |
| PRY-01 | Avance Físico           | `#proyectos` + `#seguimiento` + Gantt                                | **KEEP** (decision 1) + merge, add 2 recalc chains                              |
| PRY-02 | Avance Económico        | `#economia`                                                          | **ADAPT** — add cost-to-partida panel                                           |
| PRY-03 | Adicionales             | `#modificaciones`                                                    | **ADAPT** — add photo capture + approval evidence                               |
| ADM-01 | Facturación             | `#facturacion`                                                       | **ADAPT**                                                                       |
| ADM-02 | Compras y Pedidos       | `#compras`                                                           | **ADAPT** — 3 states only, no goods receipt                                     |
| ADM-03 | Facturas de proveedores | `#pagos` + `#captura`                                                | **MERGE** + OCR (S6)                                                            |
| ADM-04 | Horas                   | `#horas`                                                             | **ADAPT** — add monthly reconciliation                                          |
| ADM-05 | Consolidación Bancaria  | `#banco` + `#conciliacion`                                           | **MERGE**                                                                       |
| ADM-06 | Caja Chica              | — (`till` exists in the model)                                       | **BUILD**                                                                       |
| ADM-07 | Reporte a Gestoría      | `#gestoria`                                                          | **ADAPT** — 3-step wizard                                                       |
| ADM-08 | Flujo de Caja           | — (`cashForecast()` exists)                                          | **BUILD**                                                                       |
| ADM-09 | Datos Financieros       | `financial-data.html`, 14 panels                                     | **KEEP** (decision 1) — feed + ledger import                                    |
| DMT-01 | Clientes                | `#clientes` (customers-only)                                         | **ADAPT**                                                                       |
| DMT-02 | Proveedores             | —                                                                    | **BUILD**                                                                       |
| DMT-03 | Subcontratos            | `#subcontratos` (lifecycle)                                          | **BUILD** as master data; lifecycle data retained, screens dropped (decision 5) |
| DMT-04 | Personal Interno        | inside `#horas`                                                      | **BUILD**                                                                       |
| DMC-01 | Partidas / Subpartidas  | `master-data.html`                                                   | **ADAPT** into the shell                                                        |
| DMC-02 | Lista de Precios        | `#precios`                                                           | **ADAPT** — add comparison strip                                                |
| DMC-03 | Unidades de Medida      | hardcoded `LISTS.units`                                              | **BUILD** — make maintainable                                                   |
| DMC-04 | Fuentes de Leads        | hardcoded `LISTS.leadSources`                                        | **BUILD** — make maintainable                                                   |
| DMC-05 | Formas de Pago          | hardcoded `LISTS.paymentMethods`                                     | **BUILD** — make maintainable                                                   |

**Not in the doc's 26, therefore removed** (plan decision 1): Mi Día · Comunicaciones · Reportes ·
Torre extras · alert management · subcontract screens. **`journey.html` (Recorrido) is retained**
pending review — it was substantially rewritten and tested on `main` after the plan was written.

---

## 3. Field dictionary — 100 workbook columns

Status: **✓** covered by an existing model field · **NEW** field to add (numbered per the plan) ·
**⊘ derived** (the system computes it; no storage) · **✗ discarded** (plan decision 9).

### Clientes → `parties` (role `customer`)

| Column                                         | Model                                                         | Status                                           |
| ---------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Cliente                                        | `name`                                                        | ✓                                                |
| Código MASTER                                  | `legacy`                                                      | ✓                                                |
| DNI / NIF                                      | `taxId`                                                       | ✓                                                |
| Teléfono(s)                                    | `landline` + `mobile`                                         | ✓ (source is `;`-separated — split on load)      |
| Email                                          | `email`                                                       | ✓                                                |
| Calle · C.P. · Ciudad · Provincia              | `billStreet` · `billPostalCode` · `billCity` · `billProvince` | ✓                                                |
| Línea de negocio                               | `businessLine`                                                | **NEW 1** — not the `activityLine` removed in v9 |
| Origen del lead                                | `leadSource`                                                  | ✓                                                |
| Fuente                                         | `sourceSystem`                                                | **NEW 3**                                        |
| Aviso duplicado                                | `state.importConflicts`                                       | ✓ (exists)                                       |
| Proyecto vinculado · Nº facturas · Facturado € | —                                                             | ⊘ derived                                        |
| Trabajos en TDF                                | —                                                             | ✗ discarded                                      |

### Proveedores → `parties` (roles `supplier` / `subcontractor`)

| Column                                                       | Model                                        | Status                       |
| ------------------------------------------------------------ | -------------------------------------------- | ---------------------------- |
| Proveedor                                                    | `name`                                       | ✓                            |
| Categoría                                                    | `category`                                   | **NEW 2**                    |
| CIF/NIF                                                      | `taxId`                                      | ✓                            |
| Persona de contacto                                          | `contactPerson`                              | ✓                            |
| Teléfono(s) · Email · Dirección                              | `landline`/`mobile` · `email` · `billStreet` | ✓                            |
| IBAN / cuenta                                                | `bank`                                       | ✓ (permission-gated per DMT) |
| Código MASTER                                                | `legacy`                                     | ✓                            |
| Nombres originales                                           | `aliases[]`                                  | **NEW 4**                    |
| Fuente                                                       | `sourceSystem`                               | **NEW 3**                    |
| Aviso duplicado                                              | `state.importConflicts`                      | ✓                            |
| Nº docs · Proyectos · Primer/Último doc · Tipos de documento | —                                            | ⊘ derived                    |

### Proyectos → `projects`

| Column                                                                                                    | Model                            | Status    |
| --------------------------------------------------------------------------------------------------------- | -------------------------------- | --------- |
| Proyecto / Obra                                                                                           | `code`                           | ✓         |
| Cliente(s)                                                                                                | `partyId`                        | ✓         |
| Dirección de la obra                                                                                      | `propertyId` → `property.street` | ✓         |
| Nº presupuesto(s)                                                                                         | `budgetNumber`                   | ✓         |
| Notas                                                                                                     | `notes`                          | **NEW 5** |
| Presupuestos distintos · Nº líneas · Importe última versión · Primera/Última fecha · Documentos asociados | —                                | ⊘ derived |

### Partidas → `catalogue` + budget `versions[].chapters[].lines[]`

| Column                       | Model                                                      | Status     |
| ---------------------------- | ---------------------------------------------------------- | ---------- |
| Proyecto · Cliente           | via `budget.partyId` / project                             | ✓          |
| Archivo · Hoja               | line `sourceFile` · `sourceSheet`                          | **NEW 12** |
| Versión · ¿Última versión?   | `version.vNumber` · `currentVersionId`/`acceptedVersionId` | ✓          |
| Nº presupuesto · Fecha       | `budget.number` · `budget.date`                            | ✓          |
| Cap. nº · Subcapítulo        | `chapter.num` (nested chapters)                            | ✓          |
| Capítulo (normalizado)       | `chapter.name` / `catalogue.chapter`                       | ✓          |
| Capítulo (original)          | line `chapterOriginal`                                     | **NEW 12** |
| Código · Descripción         | `line.code` / `catalogue.code` · `line.desc`               | ✓          |
| Detalle medición             | `line.subLines`                                            | ✓          |
| Cant. · Ud · Precio unit.    | `line.qtyMilli` · `line.unit` · `line.priceCents`          | ✓          |
| Nota                         | `line.notes`                                               | ✓          |
| Importe · Precio unit. calc. | —                                                          | ⊘ derived  |

### Precios → `prices`

| Column                                    | Model                                    | Status                          |
| ----------------------------------------- | ---------------------------------------- | ------------------------------- |
| Fecha                                     | `date`                                   | ✓                               |
| Tipo de fuente                            | `source`                                 | ✓ (ELNIR/TDF kinds ✗ discarded) |
| Proveedor / Origen · CIF                  | `supplierId` → party                     | ✓                               |
| Nº doc · Archivo origen                   | `sourceDocRef`                           | ✓                               |
| Descripción · Ud                          | via `itemId` → catalogue                 | ✓                               |
| Precio unit. · % Dto · Precio unit. calc. | `listCents` · `discountPct` · `netCents` | ✓                               |
| Código art.                               | `supplierRef`                            | **NEW 7**                       |
| IVA %                                     | `taxRateBp`                              | **NEW 6**                       |
| Proyecto · Notas                          | `projectRef` · `notes`                   | **NEW 9**                       |
| ID · Cant. · Cliente/Obra · Importe línea | —                                        | ⊘ derived / context             |
| _(doc-required, not in the sheet)_        | `wasteCents` · `minOrder`                | **NEW 8**                       |

### Documentos → `captured`

| Column                                             | Model                     | Status     |
| -------------------------------------------------- | ------------------------- | ---------- |
| Archivo                                            | `imageRef`                | ✓          |
| Proyecto                                           | `allocations`             | ✓          |
| Tipo                                               | `docType`                 | ✓          |
| Emisor / Origen · Cliente                          | `confirmed.issuerName`    | ✓          |
| Nº doc · Fecha · Base imp. · IVA % · IVA € · Total | `keyFields` / `confirmed` | ✓          |
| Referencia · Notas                                 | `reference` · `notes`     | **NEW 11** |
| Ruta completa                                      | `sourcePath`              | **NEW 10** |
| Nº líneas                                          | —                         | ⊘ derived  |

**Totals: 100 columns — ~85 covered, 13 new fields, the remainder derived or discarded.**
Gap 13 (`accountCode` on bills/movements/cash) is required by the doc's rule 07 rather than by a
workbook column, and is listed with the others in the plan.

---

## 4. Entity relationship model

```
party ──< property                      a tercero has many inmuebles
  │         │
  │         └──< opportunity(lead) ──< visit
  │                     │
  │                     └── budget ──< version ──< chapter ──< line ──< subLine (medición)
  │                                       │                     │
  │                                       │                     └── itemId → catalogue ──< price → supplier(party)
  │                                       │                                                    └── sourceDocRef → captured
  │                                       └── acceptedVersionId
  │                                                │
  │                                                ▼
  └──────────────────────────────────────────── project ──< change (adicional)
                                                   │  │
                        contract ──< installment ──┘  ├──< purchase ──< bill ──< payment
                        (hito de pago)                ├──< labour → worker
                                                      ├──< invoice ──< collection
                                                      └──< movement (bank / till)
                                                             │
                                                             └── accountCode → chart of accounts   ← NEW 13
```

**Rules the structure must enforce**

1. **Identity is a minted `code`, never a display name.** The workbook relates records by the name
   as typed; the model must not inherit that.
2. **A price without `sourceDocRef` is unevidenced** — flagged, never silently trusted.
3. **`prices.source` is load-bearing**: supplier cost, own sale price and internal tariff share one
   structure in the sheet and must stay separable in the model.
4. **Every cost lands on a project _or_ an account** — the second branch is NEW 13.
5. **Frozen baselines**: `acceptedVersionId` is the measurement baseline; catalogue or price
   changes after acceptance never alter it.

---

## 5. Q4 validation — the money chain, end to end

Traced structurally against a real project shape (BAC DE RODA: two presupuesto versions, supplier
offers, supplier invoices, payments). No row data is used or loaded.

| #   | Step                                             | Carrying field                                                 | Status                                            |
| --- | ------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Lead → visita                                    | `opportunity.partyId`, `propertyId`                            | ✓                                                 |
| 2   | Visita → presupuesto                             | deliberate non-inheritance; visit stays as reference           | ✓ by design                                       |
| 3   | Presupuesto accepted → proyecto                  | `project.acceptedVersionId` (frozen baseline)                  | ✓                                                 |
| 4   | Contrato → hitos                                 | `contract.installments[]` with `trigger`, `expectedDate`       | ✓                                                 |
| 5   | Compra → proyecto                                | `purchase.projectId`                                           | ✓                                                 |
| 6   | Supplier factura → compra → proyecto             | `bill` → `purchase` → project                                  | ✓                                                 |
| 7   | Supplier factura → proyecto directly             | `bill.projectId`                                               | ✓                                                 |
| 8   | **Supplier factura → account (not a job cost)**  | —                                                              | **✗ GAP 13**                                      |
| 9   | Cost → capítulo/partida split                    | done only in PRY-02                                            | ✓ (screen to build)                               |
| 10  | Progress → invoiceable                           | physical progress against the frozen baseline                  | ✓                                                 |
| 11  | Factura → cobro, partial and on-account          | `collection` allocations across invoices                       | ✓                                                 |
| 12  | Bank movement → document / project / account     | movement → invoice/bill ✓; → project ✓; → **account ✗ GAP 13** |
| 13  | Movement split across several facturas/proyectos | allocation list                                                | ✓                                                 |
| 14  | Hito date moves → expected cash moves            | scheduling → installment `expectedDate` → forecast             | **verify in S8** (doc's own Note for Claude Code) |

**Conclusion:** the chain closes for every job-costed euro. The one structural break is the
non-job branch — insurance, utilities, marketing, professional fees, vehicles, rent — which the
doc's rule 07 requires and which has no field today. It must land **before** ADM-03, ADM-05 and
ADM-06 are considered complete, and is scheduled in S11.

Item 14 is not a gap but an unverified claim: the doc explicitly asks whether the recalculation
already exists. S8 confirms or builds it.

---

## 6. Open items carried forward

| Item                                                                        | Owner           | Where                                         |
| --------------------------------------------------------------------------- | --------------- | --------------------------------------------- |
| Who operates and pays for the server; whether the betas move off `/preview` | operator        | Q1                                            |
| IRPF profile per real supplier (`legally_verified: false`)                  | gestoría        | `LEGAL_REVIEW.md` §3, `OPEN_QUESTIONS.md` #13 |
| Real IBAN/BIC and brand assets                                              | client handover | `INTEGRATIONS_PENDING.md`                     |
| Whether a gestoría-closed period is editable                                | operator        | Q5 — recommendation above                     |
| `journey.html` retention                                                    | operator        | reviewed after the S1 integration             |

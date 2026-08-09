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

Validated structurally in **§6** below. **Verdict: the chain closes, with one gap** — a cost can
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

## 2. The screens — doc vs. built

Verdict key: **KEEP** (built ≥ doc, integrate only) · **ADAPT** (exists, reshape to the doc) ·
**SPLIT/MERGE** · **BUILD** (does not exist) · **STRIP** (built exceeds the doc; reduce).

| Doc    | Screen                   | Built today                                                          | Verdict                                                                                  |
| ------ | ------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| TC-01  | Torre de Control         | `#torre` — 8 cards, sparklines, customisation, CSV, alert management | **STRIP** to 4 indicators + project status + max 5 alerts                                |
| COM-01 | Leads                    | `#leads`                                                             | **BUILT (S4)** — register + next action + loss tracking                                  |
| COM-02 | Visita                   | `#visits`                                                            | **BUILT (S4)** — own two-block screen, scheduleVisit/completeVisit lifecycle             |
| COM-03 | Presupuesto              | `#quotes` + builder                                                  | **BUILT (S5)** — full-screen three-pane builder, five stages, ES/CA output               |
| COM-04 | Contrato                 | `#contratos` — installments exist                                    | **ADAPT** — add PDF viewer + anexos                                                      |
| PRY-01 | Avance Físico            | `#proyectos` + `#seguimiento` + Gantt                                | **KEEP** (decision 1) + merge, add 2 recalc chains                                       |
| PRY-02 | Avance Económico         | `#economia`                                                          | **ADAPT** — add cost-to-partida panel                                                    |
| PRY-03 | Adicionales              | `#modificaciones`                                                    | **ADAPT** — add photo capture + approval evidence                                        |
| ADM-01 | Facturación              | `#facturacion`                                                       | **ADAPT**                                                                                |
| ADM-02 | Compras y Pedidos        | `#compras`                                                           | **BUILT (S7)** — three counters, full-screen order beside the supplier's quote           |
| ADM-03 | Facturas de proveedores  | `#supplier-invoices`                                                 | **BUILT (S6+S7)** — OCR and validation, then the two zones and allocation                |
| ADM-04 | Horas                    | `#horas`                                                             | **ADAPT** — add monthly reconciliation                                                   |
| ADM-05 | Consolidación Bancaria   | `#banco` + `#conciliacion`                                           | **MERGE**                                                                                |
| ADM-06 | Caja Chica               | — (`till` exists in the model)                                       | **BUILD**                                                                                |
| ADM-07 | Reporte a Gestoría       | `#gestoria`                                                          | **ADAPT** — 3-step wizard                                                                |
| ADM-08 | Flujo de Caja            | — (`cashForecast()` exists)                                          | **BUILD**                                                                                |
| ADM-09 | Datos Financieros        | `financial-data.html`, 14 panels                                     | **KEEP** (decision 1) — feed + ledger import                                             |
| DMT-01 | Clientes                 | `#customers`                                                         | **ADAPTED (S2)** — refactored onto the shared list primitive                             |
| DMT-02 | Proveedores              | `#suppliers`                                                         | **BUILT (S2)**                                                                           |
| DMT-03 | Subcontratos             | `#subcontractors`                                                    | **BUILT (S2)** as master data; lifecycle data retained, screens dropped (decision 5)     |
| DMT-04 | Personal Interno         | `#staff`                                                             | **BUILT (S2)**                                                                           |
| DMC-01 | Partidas / Subpartidas   | `#items`                                                             | **BUILT (S3)** in the shell; master-data.html keeps its other registers                  |
| DMC-02 | Lista de Precios         | `#price-list`                                                        | **ADAPTED (S3)** — comparison strip + price capture                                      |
| DMC-03 | Unidades de Medida       | `#units`                                                             | **BUILT (S3)** — `state.lists.units`, ES+CA names                                        |
| DMC-04 | Fuentes de Leads         | `#lead-sources`                                                      | **BUILT (S3)** — sources + loss reasons, owner-maintained                                |
| DMC-05 | Formas de Pago           | `#payment-methods`                                                   | **BUILT (S3)** — `state.lists.paymentMethods`                                            |
| DMC-06 | Comunicaciones _(added)_ | `#comunicaciones` — templates, rules, queue                          | **RE-HOME** to Configuración (plan decision 18) — three tabs: Plantillas · Reglas · Cola |

**Removed — done in S1b** (plan decision 1, operator-reviewed): **Reportes** (a placeholder — no
screen existed behind it) · **subcontract screens** (UI only; all 69 engine references stay,
decision 5, and their rules are now asserted in `manageability-sim` instead of through the retired
screen) · **Torre extras** (8 cards → 4, sparklines, reorder/hide, CSV) · **Mi Día** (the only
person-level view; Torre is company-level).

**Reprieved:** `journey.html` (Recorrido) — reviewed and **kept, out of the menu**: it is reached
from the profile menu, alongside the guides, since the doc has no subsección for it and inventing a
thirtieth would be drift. **Comunicaciones** → DMC-06 · **Alert management** → DMC-07.
`clientes.html`, `dashboard.html`, `frontend.html` are already 32–35-line redirects and stay
unchanged.

### Route keys as shipped (S1b)

Six secciones, twenty-nine subsecciones, addressed in English. Every retired hash is mapped in
`ROUTE_ALIASES`, so old links, bookmarks and both native tab bars still land where they did.

| Sección                      | Subsecciones (route key)                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `tower` Torre de control     | `tower`                                                                                                                            |
| `sales` Comercial            | `leads` · `visits` · `quotes` · `contracts`                                                                                        |
| `projects` Proyectos         | `progress` · `economics` · `variations`                                                                                            |
| `admin` Administración       | `invoicing` · `purchasing` · `supplier-invoices` · `labour` · `banking` · `petty-cash` · `accountant` · `cash-flow` · `financials` |
| `master-data` Datos maestros | `customers` · `suppliers` · `subcontractors` · `staff`                                                                             |
| `settings` Configuración     | `items` · `price-list` · `units` · `lead-sources` · `payment-methods` · `messaging` · `alerts` · `users`                           |

Two routes are still **tab strips over screens that already existed**, because the doc merges six
built screens into three and rewriting them to its layouts is S8/S11's work:
`progress` = Avance + Programación · `banking` = Cuentas y saldos + Conciliación.

`supplier-invoices` was the third. Since S7 its **first tab IS the doc's screen** — bandeja and
registro side by side — and the strip survives only to hold _Facturas registradas_, the payables
ledger the v4 document has no screen for (plan decision 110).

Ten subsecciones are **placeholders** that say what will live there and where the data sits today:
`visits` (S4) · `suppliers`, `subcontractors`, `staff` (S2) · `units`, `lead-sources`,
`payment-methods` (S3) · `users` (S1c) · `petty-cash` (S11) · `cash-flow` (S12).

---

## 3. Screen specifications

The doc describes every subsección in three blocks — **Screen · Flow · Rules** — and states the
binding principle for this section: _"what cannot change is the structure — what zones exist and
what each button does — not the exact number."_ **Structure is binding; the pixel values are a
starting proposal against a 1,440 × 900 reference window** and are recalculated proportionally.

### 3.1 Global conventions (chapter 5 — hold for all 26 screens)

| Element          | Specification                                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference window | 1,440 × 900 desktop · **390 wide on mobile**                                                                                                                                                                            |
| Top bar          | fixed **56**; logo left, section + subsection centre, global search + avatar right                                                                                                                                      |
| Left side menu   | fixed **240**, collapsible to **64**; six sections, chosen one unfolds its subsections; active subsection carries a **3 px rule in its section colour**                                                                 |
| Work area        | remaining **1,200** with 24 inner margin each side = **1,152 usable**; usable height below top bar + screen header = **772**                                                                                            |
| Screen header    | **72**; title left, primary actions right                                                                                                                                                                               |
| Toolbar          | **48**, immediately above every table; **320 search box** left, filters beside it, buttons right (primary in section colour, rest grey border). Modify/Delete active only with a row selected                           |
| Table            | full width; **40 header, 44 rows**, very light alternating background; status column always a **coloured pill**; last column a **42 three-dot menu**                                                                    |
| Pagination       | **40 bar at the foot** — left «1–25 of 137», right prev · page numbers · next. **25 default, configurable to 10 or 50. No infinite scrolling. Identical on all 26** — this is what makes them feel like one application |
| Side panel       | **480**, slides in from the right over the dimmed list; where records are created and edited; **the list never disappears**                                                                                             |
| Centre panel     | **780**, for proyecto detail; the list compresses to **372** on its left; on close the list returns to its width, page and scroll position                                                                              |
| Modal            | **560**, centred; only confirmations and short actions — never a long form                                                                                                                                              |
| Full screen      | reserved for exactly four: **presupuestador · Gantt · contrato viewer · supplier-document validation**. The side menu is hidden in all four                                                                             |
| Buttons          | primary filled in the section colour; secondary grey border; destructive red and always confirmed                                                                                                                       |
| Notices          | short message bottom right, 3 s. Validation errors sit next to the field, in red, and **do not disappear on their own**                                                                                                 |
| Mobile           | side menu → **bottom bar of five icons**; tables → **two-line cards** with the same pagination; side panel → **full-screen bottom sheet**; floating button for frequent site actions                                    |

**Interaction rules.** Every table paginates — the **only exception is the presupuestador line
table**, which scrolls continuously because a presupuesto is worked through whole. Listing and
editing never change screen. A modal appears only for something short or destructive. Everything
saves on the spot and says so — **there is no end-of-form Save that can be forgotten**. Every
aggregate figure links to its detail. **Colour only carries state, and a pill always carries text
too.** Site actions never take more than three taps.

**Status colours** (identical on every screen): **grey** not started/draft · **blue** in
progress/sent/waiting on the other party · **green** done/accepted/collected/reconciled · **amber**
needs attention (unallocated, awaiting price, no supporting document, not broken down, due soon) ·
**red** overdue/rejected/outside the presupuesto/negative margin/projected date beyond committed.

**Profiles**: Site (minimum typing, predefined lists, big buttons) · Back-office · Gestoría (later:
read-and-export only, **no access to margins or commercial prices**).

### 3.2 Per-screen layout

Only what is particular to each screen; everything else inherits from 3.1.

| Screen                    | Layout that must be built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-01** Torre           | Three blocks, fits whole on one screen and on mobile without scrolling. ① four **276 × 120** cards, 24 apart, 32 px figure — margin, receivables (overdue below in red), payables, cash. ② proyecto status, the main indicator, **48 per active proyecto**: code, client, 120 progress bar, margin pill, committed + projected dates (projected red if beyond). ③ **max five 40 rows**, ordered by importance not age; a «ver todos» link if more                                                                                                                                              |
| **COM-01** Leads          | Standard list. Columns: checkbox 40 · Date 90 · Client 200 · Inmueble 220 · Description 280 · Source 120 · Visita status 110 (pill) · Status 90 (pill) · Days 60 · ⋯ 42. **25 per page**                                                                                                                                                                                                                                                                                                                                                                                                       |
| **COM-02** Visita         | **Split in two**: two equal fixed blocks **1,152 × 366**, 24 apart, each with its own toolbar and pagination, **six rows per page**. Top = programadas (Date/time 130 · Client 200 · Address 280 · Owner 140 · Status 110). Bottom = realizadas (Completion 130 · Client 200 · Address 280 · Photos 70 · Report 90 · Presupuesto 110). An overdue programada shows red. On mobile the blocks stack with a tab                                                                                                                                                                                  |
| **COM-03** Presupuesto    | List: rows **grouped by status** with a 32 group header (Borradores, Enviados, Aceptados, Rechazados, Caducados). **Presupuestador full screen**, own 56 bar (number + version left, total large centre, Guardar/Vista previa/Enviar right). Three areas: **260 collapsible tree** left · line table centre (Number 70 · Description flexible · Unit 70 · Qty 90 · Sale 100 · Total 110 · **Cost 100 · Margin 80 on grey**, visibly not in the PDF) · **300 totals panel** right with a second **Visita tab** (report + photos, reference only). Conditions bar below. 16 drag handle per line |
| **COM-04** Contrato       | Active/inactive as two **32 tabs** above the toolbar. Columns incl. Original amount + **Current amount amber when they differ** (means annexes exist). Opening → **full-screen viewer**: PDF **760 wide, full height** left; fixed **392 panel** right with three tabs — Datos, Hitos de pago (trigger, %/amount, expected date, factura; sum vs contracted at the foot), Anexos                                                                                                                                                                                                               |
| **PRY-01** Físico         | List → **centre panel 780**, list compressed to **372** showing code + client only. Panel: fixed **88 header** (code, client, address, total progress, three dates) then three tabs — **Avance** (tree, 44 rows, three-state control as **three contiguous 90 buttons** + a **60 percentage field active only on «en ejecución»**), **Programación** (Gantt), **Ficha**. Mobile: one tap cycles the three states                                                                                                                                                                               |
| **PRY-02** Económico      | Same list/centre mechanics. Panel opens with two **372 × 130** cards (Revenue, Cost) + a third margin card. Then the per-capítulo table (Budgeted · Accrued · Variance € · Variance % · Margin; negative margin red). At the end the **pending-assignment block**, each row with origin, document, date, amount and an amber «sin repartir» pill. **480 assignment panel** — the only place cost is split by capítulo                                                                                                                                                                          |
| **PRY-03** Adicionales    | **Five 216 counters** (identificado, valorado, aprobado, ejecutado, facturado) with count + amount; pressing one filters. Table rows **56 — taller than normal** to carry a **40 × 40 photo thumbnail**. Unapproved: amber pill **and a 3 px amber rule down the left of the row**, visible from a distance                                                                                                                                                                                                                                                                                    |
| **ADM-01** Facturación    | **Four 270 counters** (Issued, Collected, Outstanding, Overdue — red when non-zero). Table incl. Balance and Days; **days overdue painted red from day one**                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **ADM-02** Compras        | **Three 360 counters** (Oferta, Pedido, Facturado). Detail = two zones: quote PDF **620 with zoom** left, **480** record right (header + line table; base/IVA/total at the foot)                                                                                                                                                                                                                                                                                                                                                                                                               |
| **ADM-03** Facturas prov. | Two zones: **inbox 372** left with **96 cards** (thumbnail, detected supplier, detected amount); **756** validated list right. Validation screen: image **620 with zoom** left, **480 form** right — **green dot on every captured field, amber on every empty or doubtful one, focus on the first amber**                                                                                                                                                                                                                                                                                     |
| **ADM-04** Horas          | Two **32 tabs**: Daily sheet — **372 weekly calendar** left (seven days + daily totals), **756 grid** right (44 per worker: Worker 180 · Type 110 · Project 200 · Hours 80). Summary — per proyecto/capítulo, with the **monthly reconciliation block** below                                                                                                                                                                                                                                                                                                                                  |
| **ADM-05** Banco          | Header + account selector; **56 strip** (selected balance, total balance, unmatched count); table with **classification and assignment edited inline in the row**; unmatched carries an amber left bar and shows age on hover                                                                                                                                                                                                                                                                                                                                                                  |
| **ADM-06** Caja           | The simplest screen. 72 header with **Entrada / Salida**; **56 strip** with the balance in large type + count awaiting a receipt; table; **cash count at the foot** (opening, in, out, closing)                                                                                                                                                                                                                                                                                                                                                                                                |
| **ADM-07** Gestoría       | **Three-step wizard**, 48 step indicator. ① quarter selector + **five 216 cards**. ② exceptions grouped by type, 44 rows, each linking to the record; **Export disabled while blocking exceptions remain**. ③ IVA and IRPF summaries + export. Submission history below                                                                                                                                                                                                                                                                                                                        |
| **ADM-08** Flujo          | No list. Week/month switch + horizon. **96 strip** with three figures. Forecast grid: **one 96 column per period**, grouped rows (money in / money out), **fixed 240 row-label column** on the left, cumulative balance at the foot **red when negative**. Selector for whole company or one proyecto                                                                                                                                                                                                                                                                                          |
| **ADM-09** Datos Fin.     | **The only screen with internal navigation, and it is justified.** **240 left column inside the work area**, four groups (Resumen · Estados financieros · Capital circulante · Libros), active panel right with breadcrumb. Already built — integrate, do not rebuild                                                                                                                                                                                                                                                                                                                          |
| **DMT-01…04**             | One screen, four filters. Common columns: checkbox · Code 90 · Name 220 · NIF 110 · Contact 150 · Phone 120 · Town 130 · **Completeness 90 (20 px progress ring, amber when incomplete)** · Status 80, then each subsection's own. Panel **480, four tabs**: Identification · Contact and terms · **Inmuebles (Clientes only, 432 inline table)** · History. Proveedores adds Precios/Compras/Documentos tabs; Personal adds Tarifas                                                                                                                                                           |
| **DMC-01** Partidas       | Two zones: **300 tree** left (partida count per branch, own search) · **828 table** right. Tree reordered by dragging, same as the presupuestador                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **DMC-02** Precios        | Partida filter always visible at the top. When filtered to one partida, a **comparison strip** appears: one **216 card per supplier** with its net price, **cheapest highlighted green**, and a supplier without a price shown **grey with «sin precio» — never a zero**                                                                                                                                                                                                                                                                                                                       |
| **DMC-03/04/05**          | One shared screen, no side panel: **720 centred table**, and a **396 help column** to its right explaining where the list is used. **«Añadir» inserts an editable row inline; Enter or click-away saves.** Fuentes de Leads shows **two 564 tables side by side** (sources · loss reasons)                                                                                                                                                                                                                                                                                                     |

### 3.3 Consequences for the build

- **Pagination is already correct** — 25 default with 10/20/50 was shipped on Clientes; the doc says
  10/25/50. **Align the selector to the doc (10 · 25 · 50) and apply it to all 26 screens** as a
  shared helper, not per screen.
- **The 480 side panel is the universal create/edit surface.** The current drawer already behaves
  this way; it needs standardising to the width and the "list never disappears" rule.
- **The 780 centre panel with a 372 compressed list is not built** — PRY-01 and PRY-02 both need it.
- **Four full-screen surfaces** must hide the side menu: presupuestador, Gantt, contrato viewer,
  document validation. Three of the four are built — the Gantt, the presupuestador (S5) and both
  document surfaces (S6's validation screen and S7's ADM-02 order); the contrato viewer is S9's.
- **Two-zone document screens** (ADM-02, ADM-03, DMC-01) are a new layout primitive; built once as
  `.cap2` in S6 and reused unchanged by ADM-02 in S7.
- **Counter strips** (TC/PRY-03/ADM-01/ADM-02/ADM-07) are a second shared primitive — built in S7
  as `.counters`, with the per-screen width passed in through `--cw` because the doc gives a
  different one to each of the five.
- **The status colour code is global** and must be a single token set, not per-screen colours.
- Mobile: **tables become two-line cards and the menu becomes a five-icon bottom bar** — the
  current app scrolls tables horizontally instead, which the doc replaces.

---

## 4. Field dictionary — 100 workbook columns

Status: **✓** covered by an existing model field · **NEW** field to add (numbered per the plan) ·
**⊘ derived** (the system computes it; no storage) · **✗ discarded** (plan decision 9).

### Clientes → `parties` (role `customer`)

| Column                                         | Model                                                         | Status                                                  |
| ---------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| Cliente                                        | `name`                                                        | ✓                                                       |
| Código MASTER                                  | `legacy`                                                      | ✓                                                       |
| DNI / NIF                                      | `taxId`                                                       | ✓                                                       |
| Teléfono(s)                                    | `landline` + `mobile`                                         | ✓ (source is `;`-separated — split on load)             |
| Email                                          | `email`                                                       | ✓                                                       |
| Calle · C.P. · Ciudad · Provincia              | `billStreet` · `billPostalCode` · `billCity` · `billProvince` | ✓                                                       |
| Línea de negocio                               | `businessLine`                                                | **NEW 1 — closed S2** — not `activityLine` (removed v9) |
| Origen del lead                                | `leadSource`                                                  | ✓                                                       |
| Fuente                                         | `sourceSystem`                                                | **NEW 3 — closed S2**                                   |
| Aviso duplicado                                | `state.importConflicts`                                       | ✓ (exists)                                              |
| Proyecto vinculado · Nº facturas · Facturado € | —                                                             | ⊘ derived                                               |
| Trabajos en TDF                                | —                                                             | ✗ discarded                                             |

### Proveedores → `parties` (roles `supplier` / `subcontractor`)

| Column                                                       | Model                                        | Status                       |
| ------------------------------------------------------------ | -------------------------------------------- | ---------------------------- |
| Proveedor                                                    | `name`                                       | ✓                            |
| Categoría                                                    | `category`                                   | **NEW 2 — closed S2**        |
| CIF/NIF                                                      | `taxId`                                      | ✓                            |
| Persona de contacto                                          | `contactPerson`                              | ✓                            |
| Teléfono(s) · Email · Dirección                              | `landline`/`mobile` · `email` · `billStreet` | ✓                            |
| IBAN / cuenta                                                | `bank`                                       | ✓ (permission-gated per DMT) |
| Código MASTER                                                | `legacy`                                     | ✓                            |
| Nombres originales                                           | `aliases[]`                                  | **NEW 4 — closed S2**        |
| Fuente                                                       | `sourceSystem`                               | **NEW 3 — closed S2**        |
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

| Column                       | Model                                                      | Status                 |
| ---------------------------- | ---------------------------------------------------------- | ---------------------- |
| Proyecto · Cliente           | via `budget.partyId` / project                             | ✓                      |
| Archivo · Hoja               | line `sourceFile` · `sourceSheet`                          | **NEW 12 — closed S3** |
| Versión · ¿Última versión?   | `version.vNumber` · `currentVersionId`/`acceptedVersionId` | ✓                      |
| Nº presupuesto · Fecha       | `budget.number` · `budget.date`                            | ✓                      |
| Cap. nº · Subcapítulo        | `chapter.num` (nested chapters)                            | ✓                      |
| Capítulo (normalizado)       | `chapter.name` / `catalogue.chapter`                       | ✓                      |
| Capítulo (original)          | line `chapterOriginal`                                     | **NEW 12 — closed S3** |
| Código · Descripción         | `line.code` / `catalogue.code` · `line.desc`               | ✓                      |
| Detalle medición             | `line.subLines`                                            | ✓                      |
| Cant. · Ud · Precio unit.    | `line.qtyMilli` · `line.unit` · `line.priceCents`          | ✓                      |
| Nota                         | `line.notes`                                               | ✓                      |
| Importe · Precio unit. calc. | —                                                          | ⊘ derived              |

### Precios → `prices`

| Column                                    | Model                                    | Status                          |
| ----------------------------------------- | ---------------------------------------- | ------------------------------- |
| Fecha                                     | `date`                                   | ✓                               |
| Tipo de fuente                            | `source`                                 | ✓ (ELNIR/TDF kinds ✗ discarded) |
| Proveedor / Origen · CIF                  | `supplierId` → party                     | ✓                               |
| Nº doc · Archivo origen                   | `sourceDocRef`                           | ✓                               |
| Descripción · Ud                          | via `itemId` → catalogue                 | ✓                               |
| Precio unit. · % Dto · Precio unit. calc. | `listCents` · `discountPct` · `netCents` | ✓                               |
| Código art.                               | `supplierRef`                            | **NEW 7 — closed S3**           |
| IVA %                                     | `taxRateBp`                              | **NEW 6 — closed S3**           |
| Proyecto · Notas                          | `projectRef` · `notes`                   | **NEW 9 — closed S3**           |
| ID · Cant. · Cliente/Obra · Importe línea | —                                        | ⊘ derived / context             |
| _(doc-required, not in the sheet)_        | `wasteCents` · `minOrder`                | **NEW 8 — closed S3**           |

### Documentos → `captured`

| Column                                             | Model                     | Status                 |
| -------------------------------------------------- | ------------------------- | ---------------------- |
| Archivo                                            | `imageRef`                | ✓                      |
| Proyecto                                           | `allocations`             | ✓                      |
| Tipo                                               | `docType`                 | ✓                      |
| Emisor / Origen · Cliente                          | `confirmed.issuerName`    | ✓                      |
| Nº doc · Fecha · Base imp. · IVA % · IVA € · Total | `keyFields` / `confirmed` | ✓                      |
| Referencia · Notas                                 | `reference` · `notes`     | **NEW 11 — closed S7** |
| Ruta completa                                      | `sourcePath`              | **NEW 10 — closed S7** |
| Nº líneas                                          | —                         | ⊘ derived              |

**Totals: 100 columns — ~85 covered, 13 new fields, the remainder derived or discarded.**
Gap 13 (`accountCode` on bills/movements/cash) is required by the doc's rule 07 rather than by a
workbook column, and is listed with the others in the plan.

---

## 5. Entity relationship model

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

## 6. Q4 validation — the money chain, end to end

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

## 7. Open items carried forward

| Item                                                                        | Owner           | Where                                         |
| --------------------------------------------------------------------------- | --------------- | --------------------------------------------- |
| Who operates and pays for the server; whether the betas move off `/preview` | operator        | Q1                                            |
| IRPF profile per real supplier (`legally_verified: false`)                  | gestoría        | `LEGAL_REVIEW.md` §3, `OPEN_QUESTIONS.md` #13 |
| Real IBAN/BIC and brand assets                                              | client handover | `INTEGRATIONS_PENDING.md`                     |
| Whether a gestoría-closed period is editable                                | operator        | Q5 — recommendation above                     |
| `journey.html` retention                                                    | operator        | reviewed after the S1 integration             |

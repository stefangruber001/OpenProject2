# Canei Subirats ERP — Handover

_Production-hardening cycle: strip developer surface, mistake-proof data entry,
make customer documents trustworthy, fix correctness, and stress-test the whole
system with four real-world personas plus five end-to-end simulations._

**Status:** site E2E **26/26**, five consecutive runs stable. All changes are on
`main` and the dev branch (`/preview`). The iOS app tracks the dev preview.

---

## 1. What this cycle delivered

### A. Production hardening (developer surface removed)

The environment now reads as a product, not a demo. Removed across every
customer/operator page (`index`, `journey`, `dashboard`, `frontend`,
`master-data`, `financial-data`, `setup-guide`):

- "review & testing / interactive demo / working demo", "Release 1 (R1)".
- "synthetic data", "log-only / not delivered / fake adapter", "make demo /
  pnpm dev", the "Backend API" developer card, and the "clock: demo" tag.
- Internal engineering strings on customer-facing surfaces: `legally_verified:
false`, Verifactu note, "SHA-256 chain seal".
- A wrong-company path (`tenants/diorka/tenant.yaml`) and a developer URL
  (`stefangruber001.github.io/...`) in the setup guide.
- Homepage now presents the real product: **Journey · Control Tower · Master
  Data · Financial Data · Quote builder · Operations guide**.

### B. Mistake-proofing (lean, no wrong entries) — the operator's #1 ask

- **Spanish decimals no longer break totals.** A locale-safe `num()` parser now
  backs **every** quantity / price / amount / VAT / budget field in the journey
  (38 call-sites). Typing `12,5` or `1.250,50` parses correctly; a comma can no
  longer silently turn a line into 0 or drop it from the quote.
- **VAT is a fixed picker** (21 % / 10 % / 4 % / exento), not a free text box —
  no more `210` typos or comma-blanked 0 % on an invoice.
- **A project can't start without a valid NIF/CIF (checksum-validated) and a
  valid email.** A Spanish factura needs both; the guard blocks the flow with a
  clear message before any document is produced.
- **Master Data guards:** duplicate `code`/`SKU` is flagged on save; **Import**
  now asks for confirmation (with a "export a backup first" nudge) on both data
  tabs — one wrong import can no longer wipe records unprompted.

### C. Customer-document trust (Spanish market)

- **All customer emails are now in Spanish (es-ES)** — acceptance, invoice,
  reminder, review — with a localized sign-off ("Un cordial saludo, El equipo de
  Canei Subirats"). The operator UI stays English.
- **PDFs render Spanish correctly.** Switched the PDF fonts to
  `WinAnsiEncoding` and stopped stripping accents — `á é í ó ú ñ ¿ ¡ €` now
  print. "Garantía de 2 años" no longer prints as "Garantia de 2 anos".
- **Removed internal QA text from customer invoices** (`legally_verified:false`,
  Verifactu, hash-seal wording) and the alarming "(pending)" on CIF/IBAN.
- Payment terms in the invoice email are driven by the project's term, not a
  hardcoded "15 days"; the company phone number is unified everywhere.

### D. Control Tower correctness (owner's trust)

- Fixed a **10× budget typo** on project P-024 (`€35,200` → `€3,520`) that was
  poisoning the budget column, committed-% and forecast.
- **Fixed the AR aging buckets** — they now split 1–30 / 31–60 / 61–90 / 90+
  correctly (previously everything overdue landed in "60d+").
- **Cash-forecast KPI is now honest** — it includes payroll + overheads and no
  longer counts already-overdue receivables as certain inflow.
- **Average margin is revenue-weighted** (a €20k job counts more than a €3k one).

---

## 2. The four persona reviews (real-world stress test)

Four agents trained on real Spanish-reformas scenarios each walked the process
several times and reported. Highlights (full detail informed the fixes above and
the roadmap below):

| Persona                                                 | Verdict                                                                           | Top issues raised                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Operator (Núria, office admin)**                      | "Prettiest quoting-to-cash tool I've seen — but the guards I need weren't there." | Spanish comma → 0 ✅fixed · retype customer every quote (no picker) · free-text invoice numbers · one project only · single-device storage · no WhatsApp · no partial billing                                                                        |
| **Customer (Marta B2C / Jordi B2B)**                    | "The document architecture is right; a few high-impact leaks lose trust."         | Placeholder CIF/IBAN + internal QA text on invoice ✅fixed · English emails ✅fixed · accent-stripped PDF ✅fixed · no IVA-inclusive quote total · no 30/60 terms · no written change-order                                                          |
| **Supplier (Josep Maria autónomo / Materiales Vallès)** | "Great master-data file, invisible in practice."                                  | PO has no site address / scope / qty / price · IRPF retention profile stored but never applied · supplier identity not linked across stores · due date hand-typed not derived                                                                        |
| **Owner (Ignacio)**                                     | "I trust the Financial page; I don't yet trust the cockpit that runs my day."     | Two disconnected datasets (margin reads 3 different values) · change orders add revenue but no cost · per-partida actual is a flat 78 % (leak detector can't fire) · no 13-week cash forecast / runway · no project- or customer-level profitability |

The **Financial Data** page was independently verified as internally consistent
(Assets = Liabilities + Equity, cash-flow reconciles to cash, retained earnings
move by net profit) and the **Master Data** schema was judged well-structured to
scale to a second company.

---

## 3. Prioritized roadmap (what remains — by impact)

These are **structural** items surfaced by the personas that go beyond a
self-contained page fix. Ordered by business impact.

### P0 — protects money / trust

1. **One company dataset across all pages.** Today the Control Tower + Journey
   use one demo dataset and Financial + Master Data use another, so the same
   question ("what's my margin / who owes me") reads differently per tab. Drive
   every page from the Master-Data + Financial universe.
2. **Real per-partida cost + change-order cost capture.** Book actual cost from
   supplier bills per chapter (not a flat 78 %), and make each change order carry
   a **cost** as well as a price, so the margin-leak early-warning can actually
   fire. This is the owner's single biggest margin protector.
3. **Cross-store linking / "no double entry".** A customer/supplier **picker**
   in the journey that fills name/NIF/email/address from Master Data by `code`,
   and **auto invoice/quote numbers** from the Master-Data numbering sequence
   (gap-free, no duplicates). One numbering series everywhere (FAC vs FRA vs OC).
4. **Real, itemised Purchase/Work Order.** Ship-to site address, lines with
   concept·qty·unit·agreed price, required-on-site date, terms — and **apply the
   supplier's IRPF-retention profile** (0 % for construction autónomos) and VAT
   on the booked bill and remittance.

### P1 — insight / correctness

5. **13-week rolling cash forecast + runway** (AR due, AP due, payroll, VAT/IRPF
   calendar, loan schedule) — replaces the single 30-day figure.
6. **Profitability by project and by customer** — roll up the ledger into a
   Projects P&L and a Customer P&L ("which job/customer is losing money").
7. **Partial billing & partial payment** — deposit/anticipo (40 % up front) and
   certification invoices that bill a % or amount; record part-payments and show
   true outstanding. Support **30/60** split terms on invoices and emails.
8. **Compliance alerts** — surface the Master-Data expiries (PRL, RC insurance,
   ITV) and VAT/IRPF filing dates into the Control Tower with −30-day warnings.
9. **IVA-inclusive quote total** on the presupuesto (base + estimated IVA +
   total con IVA), and a **written change-order** PDF/email the customer approves.

### P2 — polish / scale

10. Multi-device: the real logged-in backend so a quote started on the office PC
    is on the phone on site (today storage is per-browser).
11. WhatsApp send option alongside email drafts (how the operator and half the
    customers actually communicate).
12. Referential integrity in Master Data (pick-lists validated against the
    referenced entity), and a seasonal budget-phasing curve.

---

## 4. Go-live checklist (operator actions — no coding)

1. **Master Data → Company / Legal entity:** replace the placeholder **CIF
   (B-00000000)** and **IBAN (ES00…)** with the real values from your gestor
   **before issuing any invoice** (the invoice guard and setup guide both point
   here).
2. **Master Data:** confirm customers, suppliers (IRPF profile!), catalogue &
   unit prices, chapters, VAT codes, numbering sequences. Use **Export JSON** to
   keep a backup.
3. **Financial Data:** replace the starter ledgers with your opening balances and
   this year's figures (the model stays balanced as you edit).
4. **Email provider:** connect it to turn the "drafted for review" emails into
   one-click send (until then, every email is drafted and sent on your say-so).
5. **iOS app:** currently points at the dev preview for testing. For the public
   release, flip `Config.baseURL` back to the production root and ship one build.

---

## 5. Test status

- **Web E2E:** `node tests/site-e2e/run.mjs` → **26/26**, five consecutive runs
  stable. Covers the full journey (lead→review), no console errors, no 390 px
  overflow on any page, Master-Data add/persist/export, and Financial statements
  computing & reconciling (A = L + E, cash-flow ties to cash).
- **Native UI (Maestro) & TestFlight CI** unchanged and green from the prior
  cycle.

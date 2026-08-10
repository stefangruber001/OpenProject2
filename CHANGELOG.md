# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Banco (ADM-05) classifies and assigns a movement **in the row** — the class and
  the destination are selects on the line, because deciding where forty card
  payments belong is forty two-second decisions and a drawer per movement turns
  that into forty interruptions. Reconciliation keeps its own tab and both write
  through the same allocation.
- Caja chica (ADM-06) exists: entries, payments out, the balance strip and the
  arqueo at the foot. The closing figure is computed and reconciled against the
  account balance, because a stored closing balance is a number nobody counted.
- Every cost now resolves to an **account code**. The chart of accounts is an
  owner-maintained list like units and payment terms; an explicit code wins, then
  the overhead category, then the job's cost kind, and anything left over is
  reported under «sin asignar» rather than dropped — a roll-up that quietly loses
  money is worse than one that admits it.
- Flujo de caja (ADM-08) opens the forecast by period and by job. It starts from
  the money actually in the accounts rather than from zero, every figure comes
  from a document with a committed date behind it, anything already overdue lands
  in the first period rather than disappearing, and the cumulative balance turns
  red the period it goes negative.
- Horas (ADM-04) becomes a day sheet with the week's totals beside it, spanning
  every job rather than one, plus a summary per job and chapter and a **monthly
  reconciliation** of hours booked against wages actually paid. The two are not
  supposed to match; the screen reports the difference instead of demanding a
  zero, and the reading worth acting on is a negative one.
- Reporte a gestoría (ADM-07) becomes a three-step wizard. The engine's refusal
  to send a package with unjustified exceptions is unchanged — what changed is
  that you find out on arrival rather than at the end, and exceptions group by
  type with each group linking to the screen where that kind is fixed.
- Datos financieros (ADM-09) reads the ERP instead of its own copy. Receivables,
  payables, bank balances, VAT, the chart of accounts and the monthly ledger are
  derived and read-only, each naming the screen that owns them; budgets, loans,
  opening balances and drivers stay editable, because the engine does not hold
  them.
- On a phone every table becomes two-line cards, driven by one pass over the
  rendered page rather than per-screen markup, with the forecast, the Gantt and
  the week calendar keeping their columns because a grid is not a list. A
  floating button carries the four things somebody on site actually reaches for,
  three taps from done.
- The iOS shell (1.1) and the web app now have a contract: the shell marks its
  user agent, and inside it the web's own section bar stands down for the native
  tab bar while the breadcrumb opens the subsection list. Plain Mobile Safari is
  deliberately unaffected.
- A guard that checks the field dictionary rather than asserting it: every model
  field the mapping claims for the customer's workbook columns must be present on
  a real record of the shipped dataset. Runs in `make gates` and CI.

- Facturación (ADM-01) is organised around four counters — issued, collected,
  outstanding and overdue, the last one red only when there is something to be
  red about — and the register now carries a balance and a days column, with
  days late painted red from the first day rather than after a grace period a
  screen invented. Settling an invoice opens a panel that takes the amount and
  the method, so a partial collection leaves the rest outstanding and the
  overdue counter keeps counting it.

- Contratos (COM-04) splits into contracts in force and historical ones, and the
  current amount is marked amber as soon as it stops matching the original —
  which means annexes exist. Opening one shows the contract full screen: the
  document itself on the left, built from the terms the system already holds
  rather than from an uploaded scan, and a panel on the right with the details,
  the payment milestones footed against the contracted amount, and the annexes.
  A milestone whose date the works calendar moved says so.
- Adicionales (PRY-03) is organised around five counters — identified, priced,
  approved, executed, invoiced — each carrying a count and an amount and each
  filtering the list. Rows are taller so they can carry a photograph, taken with
  the camera and stored like every other picture, and an unapproved extra is
  marked with an amber bar down the left of its row as well as a label: work
  that has not been approved is never billable, and that has to be readable from
  across a site office.

- Avance físico (PRY-01) and Avance económico (PRY-02) are built on a new
  centre panel: choosing a site compresses the list to a 372 column and opens
  a 780 panel beside it, and the list never disappears — closing the panel
  gives back its width, its page and its scroll position. PRY-01 carries
  Avance, Programación and Ficha as tabs over a fixed header, and a chapter's
  state is three contiguous buttons with a percentage box that is only live
  while the chapter is in progress. The Gantt chart opens full screen from the
  Programación tab.
- Avance económico shows revenue, cost and margin as three cards, the
  per-chapter table with variance and margin, and — new — the cost that reached
  a site and was never given a chapter. Splitting it there is the only place in
  the product that assigns a chapter to a cost; a split is written as sibling
  allocations, so the amount that reached the site is conserved.
- Moving a plan now moves the expected cash. A payment milestone whose trigger
  follows the works (start, a stage, completion) takes its date from the
  schedule when somebody applies it; an already-invoiced milestone and one
  agreed as a fixed date never move, and the panel states every change before
  it happens.

- Facturas de proveedores (ADM-03) is one screen with two zones: the capture
  inbox on the left, one card per document still waiting for a person, and the
  register of everything already filed on the right. A document is allocated
  from a side panel to one obra, a split across several, or an overhead
  category — a split has to total the confirmed document, and a line goes to a
  project or to an account, never both. Documents also keep where the file came
  from, the reference the supplier's paperwork carries and a free note, all
  searchable (schema v14).
- Compras y pedidos (ADM-02) is organised around three counters — Oferta,
  Pedido, Facturado — each carrying a count and an amount, and each filtering
  the list when pressed. An order opens full screen with the supplier's own
  quote at 620 with zoom on the left and the record on the right, footing base,
  IVA and total. The quote is a document already captured elsewhere, linked to
  the order rather than uploaded a second time.

- Document-reading capability (`@repo/capability-extraction`): turns recognised
  text into candidate invoice fields with a confidence, the place on the page
  each value came from, runners-up for one-tap correction, and arithmetic and
  rate checks that reconcile. Nothing it produces is ever marked confirmed —
  a person confirms, elsewhere. All locale knowledge (number and date notation,
  tax-id and account-number check characters, field keywords, the rates in
  force on a date) arrives through the new `extraction-profile@1` port, which
  `@repo/pack-jurisdiction-es-es` now implements for Spain.
- Gantt chart in the ERP workspace (Proyectos → Seguimiento técnico): bars
  with the critical path, float, milestones, dependency arrows, frozen-baseline
  ghosts and the contract's payment milestones on one timeline, with an
  editable working calendar. Drag to move, pull the right edge to lengthen,
  drag between bars to link — mouse, pen and touch alike. Plans are stored per
  project (schema v3) and every date on screen is computed by the scheduling
  capability, never by the view.
- Planning engine in `@repo/capability-scheduling`: a working calendar
  supplied as data (working weekdays + closed dates), finish-to-start,
  start-to-start and finish-to-finish dependencies with positive and negative
  lag, a critical-path pass giving each task its total float, automatic
  movement of the plan's finish date, and append-only baselines whose drift is
  reported in working days. It ships in the committed browser bundle
  (`site/erp-factory.{js,cjs}`, surface version 3) and is what the Gantt above
  draws.

### Changed

- The ERP workspace (`site/erp.html`) is the whole web app: three-panel
  navigation (sections → subsections → content, bottom bar + sheet on phones)
  and a global bar with universal search, a section-contextual "+ Crear" menu,
  an alert bell and a period selector shared by every list that filters by
  date. The iOS and Android shells' tabs now deep-link into its sections.

### Removed

- Retired the standalone screens the workspace supersedes: the home launchpad
  (`site/index.html`), the classic control tower (`site/dashboard.html`), the
  customer zone (`site/clientes.html`) and the quote builder
  (`site/frontend.html`). Each file remains as a redirect into the
  corresponding section, so existing links and bookmarks keep working.

### Added

- Customer management zone (`site/clientes.html`): a back-office CRUD app to
  add, edit, delete and classify clients (status + engagement), with per-client
  detail showing linked projects, a payment/terms summary and a communications
  log. Shares the `caneiMasterData` IndexedDB store with Master Data (one source
  of truth), reachable from the Home (`site/index.html`) and as a new "Clients"
  tab in the iOS shell (`ios/CaneiSubirats/Support/Config.swift`).
- Project foundation (Phase 0): Turborepo monorepo with a Next.js + TypeScript
  web app, Prisma + PostgreSQL data layer, Tailwind CSS, typed environment
  validation, Vitest unit tests, Playwright end-to-end tests, GitHub Actions CI,
  Dependabot, issue/PR templates, and the `docs/` set (architecture, ADRs, PRD,
  roadmap, onboarding, runbook).
- Two-person collaboration setup: branching convention, PR template, `CONTRIBUTING.md`.

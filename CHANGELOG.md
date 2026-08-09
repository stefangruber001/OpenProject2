# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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

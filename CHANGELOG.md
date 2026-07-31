# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

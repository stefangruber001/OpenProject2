# 0003. TypeScript · Next.js · PostgreSQL stack

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

We need a stack for a data-driven web application built by a very small team, with heavy
AI assistance, that we can hire for later and that won't need a rewrite as we
grow. We compared TypeScript/Next.js, Ruby on Rails, and Python/Django.

## Decision

Build on **TypeScript** end-to-end with **Next.js (App Router) + React** for the
web app and **PostgreSQL** for the database.

Reasons:

- **One language** across front-end, back-end, and later mobile — less context
  switching for a two-person team.
- **Largest ecosystem and hiring pool**, which matters when we add people.
- **Best AI-assisted developer experience**, which is how we're building.
- **End-to-end type-safety** turns whole classes of bugs into compile errors —
  directly serving our goal of a structured, not-messy codebase.
- **PostgreSQL** is the reliable, boring, relational default; typical application
  data is inherently relational.

## Consequences

- We accept that Next.js is less prescriptive than a convention-over-configuration
  framework (Rails/Django); we compensate with strict TypeScript, ESLint, a
  documented structure, and this ADR trail.
- A clear path to a React Native / Expo mobile app that shares types and logic.

# CLAUDE.md — how to work in this repo

Mission: an **ERP factory** — spec in, running tested compliant ERP out,
repeatable for 1000+ EU SME tenants. The ERP is the output, the factory is the
product. Tenant #1 is a Spanish _reformas_ SME.

## Start here, every session

1. Read `PROGRESS.md` → pick the next task. Do not re-plan from scratch.
2. Autonomy contract: **never ask the operator; decide the most reversible
   option and log it in `ASSUMPTIONS.md`**. Legal uncertainty →
   `LEGAL_REVIEW.md` + `legally_verified: false` gate. Missing credential →
   fake adapter + `INTEGRATIONS_PENDING.md`. Disagreement → `OBJECTIONS.md`,
   then implement the mandate anyway.
3. End every unit: tests green → commit (conventional message) → update
   `PROGRESS.md` → continue. Never leave the repo red or half-migrated.
4. **Reports and summaries for the client are written in ENGLISH**, always,
   unless the operator asks for another language. The product speaks Spanish,
   Catalan and English; the reporting does not. (Operator, 19 Aug.)

## Architecture (enforced, not aspirational)

Layers, strictly downward:
`plugins → tenant config (data only) → vertical packs → jurisdiction packs → capabilities → kernel`

- **Kernel & capabilities contain ZERO jurisdiction/sector knowledge.** No tax
  rates, no `IVA`, no `partida`, no `Modelo`, no country anything. The
  forbidden-literal linter fails CI on it.
- Capabilities define **ports**; packs supply **adapters**; the resolver binds
  them per tenant from the spec (`tenants/<id>/tenant.yaml`).
- Packs never import packs (no vertical→vertical, no jurisdiction→jurisdiction,
  no vertical↔jurisdiction). Cross-cutting law (e.g. Spain×construction) =
  bridge adapter against a published contract, see ADR-0011.
- Jurisdiction rules are **effective-dated**: `resolve(rule, effective_date)`,
  and the decision **plus justification** is persisted on the artifact.
- New capability = new pack/module, never an edit that pushes knowledge into
  the kernel. Customisation is config (data), never a code fork.

### Neutral glossary (kernel + capabilities)

The forbidden-literal linter scans **comments and doc-strings too**, not just
code — and the natural vocabulary of this domain is exactly what it forbids.
Use these words in kernel/capability code and comments; keep the domain words
for packs, `site/`, and tenant config, where they belong:

| Say this (generic) | Not this (jurisdiction/sector) |
| ------------------ | ------------------------------ |
| section            | título                         |
| line item          | partida                        |
| sub-line item      | subpartida                     |
| measurement        | medición                       |
| progress valuation | certificación                  |
| tax                | IVA                            |
| withholding        | IRPF                           |
| issued documents   | facturas emitidas              |
| archive / package  | paquete gestoría               |
| tax authority      | AEAT                           |
| tax filing         | Modelo NNN                     |

Also: never call `Intl.*` with a hardcoded locale in a capability (`es-ES` is
a forbidden literal) — formatting belongs to the host. Run `pnpm boundaries`
before every commit; a violation in a comment fails CI exactly like one in
code.

## Host layer (outside the matrix)

`packages/factory`, `packages/erp-browser`, `packages/db`, `packages/ui` and
`apps/web` are **hosts**: the linter does not classify them, so they may
compose capabilities _and_ packs and may hold infrastructure concerns. That is
deliberate — composition has to happen somewhere. It is not a licence for
business rules: a rule in a host is a rule in neither a capability nor a pack,
which is the worst of both. Push it down.

`packages/erp-browser` bundles selected capabilities into
`site/erp-factory.js` (+ `.cjs`), which `site/erp-bridge.js` calls on behalf of
`site/erp.html`. Both artifacts are **generated and committed** (pages.yml
publishes `site/**` from a bare checkout with no Node) and are prettier-ignored;
CI rebuilds and diffs them, so never edit them by hand. See
`docs/worklog/WORKLOG.md` for the migration plan they serve.

## Commands

- `pnpm install` · `pnpm lint` · `pnpm check-types` · `pnpm test` · `pnpm build`
- `pnpm boundaries` — layer + literal enforcement (CI runs it too)
- `pnpm --filter @repo/erp-browser build` — regenerate the committed
  `site/erp-factory.{js,cjs}` bundle after changing a bundled capability
  (no Node locally? CI's `bundle` job uploads it as an artifact)
- `pnpm factory <resolve|validate|new-tenant|demo> …` — the factory CLI
- `make bootstrap && make demo` — clean-machine path to tenant #1 artifacts
- DB (when used): `pnpm db:migrate`, `pnpm db:studio` (root `.env`, see runbook)
- `node tests/site-e2e/run.mjs [--only <suite>]` — the browser suite. The full
  run is ~12 minutes; `--only presupuestador` runs one of the forty-one and
  takes about four. Use it to DIAGNOSE, never to certify: only the unfiltered
  run may be called green, and CI passes no argument. Failures are printed
  again at the end of the report, because the report is ~450 lines and reading
  it through `| tail` keeps the count while discarding the lines that say what
  broke.

### While a browser run is in flight, do not touch the tree

The suite serves `site/` over HTTP from disk and the harness is already parsed,
so editing either mid-run measures a tree that no longer exists. Committing is
worse than editing: the pre-commit hook stashes and restores the working copy,
which rewrites the very files the browser is loading. Two runs were thrown away
this way before it was written down. Wait, then commit.

## Git rules

- **`main` is the trunk and the only long-lived branch.** Work on a short-lived
  `claude/**` branch if you want one — CI runs on those too — and merge it into
  `main` the same day. Push to `main` directly when the gates are green; that is
  the instruction, not a shortcut.
  - **Merging is not releasing.** A push to `main` builds, publishes `:sha` and
    `:dev`, and runs `smoke` — so the development system has it within minutes
    and the artifact is tested. `:main` moves only on **Actions → Deploy → Run
    workflow, from `main`, with `release` ticked**. Until somebody ticks it the
    client's server keeps serving what it was serving, which is the point: the
    same digest is already on dev, eight minutes and one gate earlier, and
    there was never a reason the release could not wait for a person to look.
  - **Never tick `release` yourself. Work stops at dev and waits.** The operator
    approves what they have seen on dev and then says, in words, that it may go
    to production. (Operator, 17 Sep: "Keep the changes just in DEV. Once
    approved, I will tell you to push it to PROD.") Nothing in a green gate,
    an urgent-looking bug or a one-line fix is an exception — it is their
    client's books, and the whole point of the gate is that a person looks
    first. Push to `main` as usual: that IS how work reaches dev.
  - Say which environment a change is on when you report it, and never call a
    merge a release. `main` is a branch name AND an image tag, and the two mean
    opposite things — pushing to the branch `main` sends work to DEV; moving the
    tag `:main` sends it to PRODUCTION. That collision has already misled the
    operator once; spell out "on dev, not released" rather than saying "main".
  - There is no dev branch and no `/preview` any more. There were two named dev
    branches and only one was wired to the preview, so work landed where the
    tooling was not looking, and the preview once served nine-session-old
    content while nothing failed and nothing went red. A branch name written
    into a workflow is a second source of truth that drifts from this file
    independently. Do not reintroduce one; if a look-before-live step is wanted,
    use a pull request with the built pages attached.
  - Never leave finished work sitting on a branch. `main` is what deploys, and
    a change that is verified but unmerged protects nobody.
- **Never content-copy `site/` between branches.** Merge, or port file by file
  against a diff you have read. Copying is silent: the screens arrive, the
  branch you copied _from_ stays green, and the work you overwrote on the branch
  you copied _to_ only surfaces as its own tests failing. That is exactly how
  `main` spent five commits red — see `docs/worklog/SESSION-S1A.md`.
- **Before anything else in a session, and again before every push: fetch and
  look at what other people have landed.** `git fetch origin main` and read
  `git log --oneline main..origin/main`. More than one session works on this
  repository at a time, and the cost of not looking is paid twice — once when a
  push is rejected mid-task, and once when a gate that was red before you
  started gets blamed on your change. (Operator, 17 Sep.) If `main` arrives red
  from somebody else's push, fix it rather than pushing on top of it: the trunk
  is what deploys.
- Small green commits; push with `git push -u origin <branch>` (retry w/
  backoff on network failure). **No force-push, no history rewrite, no branch
  deletion** (mandate §3).
- Never commit secrets; `.env` stays local. No real emails/filings/payments —
  fakes behind ports only.

## Definition of Done (stop condition)

See mandate §12 — `make demo` green on clean machine; tenant #2 in <15 min
config-only; the **negative test** (kernel+billing with no jurisdiction pack
fails loudly) passing; P0–P5 complete; governance files honest and current.

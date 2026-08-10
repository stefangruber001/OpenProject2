# S1a · One history again

> Context pack for whoever picks this up next. What was actually wrong, what was
> done about it, and the three things to be careful of afterwards.

## The problem, stated precisely

`main` and `claude/candi-programme-session-4-07amo8` had become two different
products, and `main`'s CI had been red on five consecutive commits — jobs
**"Business simulations"** and **"End-to-end"**, while lint, types, unit tests,
build, the capability bundle and the durable adapters all passed.

The red was not caused by the port. Running the simulations against a pristine
`origin/main` checkout reproduced every failure exactly, which is what made the
real cause findable:

**Commit `19ae2fb` content-copied the programme branch's `site/` files onto
`main` instead of merging them.** It brought twenty-five screens across without
their history, and it overwrote work that lived only on `main` — while leaving
in place the tests and the documentation written for that work. Those tests have
been reporting the loss ever since, and nobody had read them as a bug report.

Two consequences worth stating separately:

- On `main`, **six of the seven `factory`-owned areas had a user interface and no
  implementation behind it**. The screens were there; the capabilities they call
  were not. `site/erp-factory.js`, the committed bundle those screens actually
  load, was 162 lines.
- `MANAGEABILITY.md` documented seven correction paths as fixed, and
  `manageability-sim.mjs` had regression checks for them. Neither was true of the
  code any more.

## What was done

Four commits on `s1a-port` (cut from `origin/main`), then a real merge into the
programme branch. **Both parents kept — no force-push, no rewrite.**

### 1 · `6aec167` — port the implementation half of sessions 4-12

`packages/capabilities/extraction/**` · `reconciliation/**` ·
`packs/jurisdiction-es-es/src/extraction/**` · scheduling
`{baseline,calendar,cpm,derive,tracking,service,model}` · `docs/annex` ·
`projects/forecast` · `messaging/rules` · `erp-browser` · `factory` ·
`tests/simulation/scheduling-sim.mjs` · `tests/ocr-spike/` · the audit report,
the two CANEI-V4 documents and worklogs 04-12.

Two things that cost time and are worth knowing:

- **Both packs' `package.json` export maps were missing on `main`**, so the
  bundle failed to resolve `@repo/pack-vertical-construction-reformas/rates`.
  `git diff HEAD <src>` was misleading here because files were already staged;
  comparing `git show <branch>:<path>` directly is what found it.
- Several files looked like deletions and were not — `scheduling/src/service.ts`
  went 98 → 349 lines with three _modified signatures_, not three removals. Check
  before concluding something was dropped.

The bundle rebuilds 162 → **1,701 lines**, byte-identical to the programme
branch's committed artifact.

### 2 · `0180732` — restore the eight engine corrections

Each is a method that existed but could never succeed, because it read a field
or a collection under a name nothing ever wrote:

| Method                | Read                     | Should read                                     |
| --------------------- | ------------------------ | ----------------------------------------------- |
| `resolveRequirement`  | `p.requirements`         | `p.permits` / `p.dependencies`                  |
| `adminPatch`          | `state.captures`         | `state.captured`                                |
| `markChangeExecuted`  | (never set status)       | `status = "executed"`                           |
| `correctBill`         | `b.irpfRateBp`           | `b.irpfBp`                                      |
| `updateBudget`        | `validityDays`           | `validityDate`                                  |
| `updateRecurring`     | `concept` / `dayOfMonth` | `desc` / `cadenceMonths` / `nextDate`           |
| `receivables()`       | `… > 0.005 \|\| true`    | split: `invoiceRegister()` + `receivables()`    |
| `ERP.from()` backfill | a fresh engine's shape   | a shape that declares the five lazy collections |

Plus **MDM-03 as a hard rule**: no two _active_ parties may share a tax
identifier. This could not be expressed through `findDuplicateParty`, which
matches on tax id **or** name **or** phone and returns the first hit — so a real
duplicate slipped through whenever an unrelated party matched first on a shared
phone number. Now checked directly, on create and on edit, scoped to active
parties so a deactivated holder does not block re-registration.

`year-sim` and `migrations-sim` came across from the programme branch, where
they had been kept current: year-sim works the quarter-end exception list down
instead of calling a blocking `quarterlyPackage` and crashing, and migrations-sim
covers the ladder to v9 (43 checks, not 23), with the deliberate v9 removal of
`parties[].activityLine` recorded as an argued exception rather than a loosened
rule.

### 3 · `34c0267` — reunite `journey.html`

The same clobber took most of this file. `19ae2fb` replaced it with a copy that
predated three commits of work on it, and **twenty-two functions** went with
that: the per-stage gate, money derived from what the operator typed
(`recalcCommitted`, `recalcActual`, `recomputeRevenue/Collected/SupplierPaid`,
`rebuildLedger`), the purchase-order / supplier-bill / supplier-payment panels,
`validCifControl`, `freezeBaseline`, `duplicateBillNumbers`, and the boot that
resumes where the operator left off.

Restoring that version alone would have discarded the other half — **real-project
mode**, the Recorrido of spec §2.3, which exists only on the programme branch.
Both are wanted, so they were merged: the gated version is the base (its changes
run through the fields, the stage renderer and the ledger), real mode is grafted
on (it is a bounded block — CSS, a mode bar, a picker and ~270 lines of
read-only renderers).

The E2E suite was merged the same way rather than replaced. The programme
branch's suite is the one that matches the shipped screens, so it is the base,
and the five journey checks only `main` had were carried across.

**Deliberately dropped, with reasons:** the three home-launchpad checks, because
`index.html` is now a 34-line redirect into the shell and the screen they test no
longer exists; and `main`'s BNK-02 check, which looks for allocation on the banco
screen after it moved to Conciliación. Both behaviours are covered by checks that
describe where they actually live.

### 4 · `952e2a7` — CI drives the committed bundle

`scheduling-sim.mjs` runs in the simulations job. The scheduling capability
reaches the browser only through `site/erp-factory.{js,cjs}`, and nothing in CI
had been driving that artifact.

### Governance files

The merge took the ported tree wholesale, which silently reverted five documents
to `main`'s older copies. Restored and reconciled by hand: `CHANGELOG.md`,
`LEGAL_REVIEW.md`, `OPEN_QUESTIONS.md`, `REQUIREMENTS-TRACE.md`,
`docs/worklog/WORKLOG.md`, and `PROGRESS.md` (which needed a genuine merge —
`main` had two entries the programme branch lacked, the programme branch had the
sessions 4-12 record `main` had flattened to "not started").

## Verification

`pnpm lint · boundaries · check-types · test · build` · `make gates` ·
`make demo` — all pass. `pnpm --filter @repo/erp-browser build` leaves the
committed bundle unchanged.

| Suite                | Result                                       |
| -------------------- | -------------------------------------------- |
| year-sim             | 149/149 · 214/214 at 24 months               |
| manageability-sim    | 48/48                                        |
| migrations-sim       | 43/43                                        |
| import-sim           | 25/25                                        |
| scheduling-sim       | 30/30                                        |
| ownership guard      | 27 areas (19 engine · 7 factory · 1 unbuilt) |
| site E2E             | 154/154                                      |
| cross-device refresh | 17/17                                        |

## Three things to be careful of next

1. **Never content-copy `site/` between branches again.** That single habit
   produced every problem this session fixed, and it is silent: the screens
   arrive, the tests keep passing on the branch you copied _from_, and the loss
   only surfaces on the branch you copied _to_. Merge, or port file by file with
   a diff you have read.
2. **The plan's decision 11 is partly overtaken.** S1a was specified as "merge
   `main`, then convert the 99 `mutate()` call sites to named commands". `main`
   resolved that differently — `19ae2fb` moved saving to a whole-document `PUT`
   quoting `expectedVersion`, explicitly trusting the client's arithmetic rather
   than routing several hundred call sites through a closed whitelist. That
   decision stands; the command conversion is not pending work.
3. **A red `main` is a bug report, not noise.** Five commits went past it. The
   two failing jobs named the exact regressions, and reading them was what made
   this session tractable.

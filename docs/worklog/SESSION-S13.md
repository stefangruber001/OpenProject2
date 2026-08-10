# S13 · The page that held its own truth

> Context pack. The last screen in the specification, why "integrate, do not
> rebuild" turned out to mean "delete its dataset", and a fourth flake fixed
> at all thirteen call sites rather than at the one that failed.

## What was wrong

`financial-data.html` is a good screen. It has fourteen panels, a KPI cockpit
that reconciles, a balance sheet that balances, and aging bars that work. It
also had **its own copy of the receivables**.

That is the whole problem, and it is not cosmetic. The page stored open
invoices in its own IndexedDB database (`caneiFinance`) with its own due dates
and amounts, while ADM-01 read the engine's. Two screens, one question, two
answers, and **nothing in the product could say which one was right**. The
same was true of payables, bank balances, the VAT ledger and the chart of
accounts.

S0's Q6 answer already noted the Plan de Cuentas existed here and was not
wired. S11 closed gap 13 specifically so there would be something real to wire
it to.

## What exists now

| Panel                                        | Before       | After                                                |
| -------------------------------------------- | ------------ | ---------------------------------------------------- |
| Receivables                                  | typed here   | `invoiceRegister()` — read-only, owned by ADM-01     |
| Payables                                     | typed here   | `payables()` — owned by ADM-03                       |
| Bank & cash                                  | typed here   | `accountBalanceCents` per account — ADM-05/ADM-06    |
| VAT & tax                                    | typed here   | `vatSummary` / `irpfSummary` per quarter — ADM-07    |
| Chart of accounts                            | its own list | `state.lists.accounts` (S11's chart)                 |
| P&L ledger (monthly)                         | typed here   | `accountLedger` per month + issued invoices          |
| Budgets · loans · drivers · opening balances | typed here   | **still typed here** — the engine does not hold them |

## Derived, or an input. Never both

Every panel now answers one question about itself: is this something the ERP
knows? If yes it is **read-only**, has no Add button, and carries a line saying
which screen owns it — «se corrigen en ADM-01 Facturación, no aquí». If no, it
stays exactly as editable as it was.

The middle case is the one worth being careful about, and there is only one:
an account's **code and name** are operational and live in the engine, while
the **P&L line it rolls into** and **what it was budgeted at** are reporting
decisions and live here. That split is stored as `DATA.accountMeta`, keyed by
code, so re-reading the chart from the ERP never loses a budget somebody typed.

A derived row deliberately has no editor at all. A field that accepts a value
and then silently discards it on the next read is worse than a field that is
not there.

## Two things it deliberately does not do

**It does not rebuild the page.** The doc says «already built — integrate, do
not rebuild», the mapping's decision 1 keeps it as its own page with its own
internal navigation, and §3.2 calls that the one justified exception. The four
group names now match the document — Resumen · Estados financieros · Capital
circulante · Libros — and the fourth stopped being called "Ledgers (inputs)",
because half of it is no longer an input.

**It does not require an ERP.** `erp` is null when there is no state to read,
and the page then falls back to its own seed with a banner saying so. A screen
that refuses to render because the ERP is empty is worse than one that shows
its demo and admits it.

One smaller correctness fix rides along: aging is valued on **the ERP's
`today`**, not the browser's clock. Two screens disagreeing about what day it
is would have been a new version of the bug this session exists to remove.

## The fourth flake, fixed everywhere rather than where it showed

The e2e run that added ADM-09's checks turned COM-04's tab check red —
`0/11` contracts — and the very next assertion over the same page passed. That
is the same signature as `sections=0` (S10), `0 budgets` (S9) and the one S11
corrected: **a check that measures the page a fixed number of milliseconds
after `goto`**.

`bootedShell()` existed and was used at seven call sites. It is now used at all
twenty, applied mechanically to every navigation to `erp.html`, because fixing
only the check that happened to fail leaves the next flake somewhere else and
teaches nothing. The suite then ran clean repeatedly.

## Verification

Site E2E **322/322** (8 new browser checks) · manageability 225/225 ·
migrations 48/48 (no schema change) · year 149/149 · import 25/25 ·
scheduling 30/30 · i18n coverage (EN 100%, CA ceiling 1301, held) ·
site-sync 17/17 · ownership guard · bundle safety · lint · boundaries ·
check-types · unit tests · build · `make gates` · `make demo`.

## What S14 inherits

S14 owns **mobile** — §3 of the v4 document: cards instead of tables below the
breakpoint, a five-icon bottom bar, and three-tap site actions.

- **Every screen in the specification now exists.** S14 is the first session
  since S1 whose job is not to build a surface but to make the existing ones
  work on a phone, which means the risk profile inverts: the danger is
  regressing a desktop layout, not failing to draw a new one.
- **The primitives are the leverage.** `renderMasterList`, the counter strip,
  `renderCentre`, `.cap2`, `.con2` and now `.fcast` are shared, so a card
  fallback written once in each covers most of the twenty-nine screens. A
  per-screen media query would be twenty-nine chances to miss one.
- **`testNoOverflow` already exists** and is the natural place to grow: the
  rule that no page may scroll sideways is exactly the mobile rule, and it is
  already asserted at desktop width.
- **The site is used on site.** Three-tap actions are for someone in gloves in
  the rain — the constraint is tap target and step count, not screen width.

**Every string S14 adds must ship with Catalan AND a real-browser render
assertion.** That rule has now caught a gap in ten consecutive sessions.

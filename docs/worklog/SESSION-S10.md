# S10 · Red from day one

> Context pack. What a counter strip owes the table beneath it, the question S9
> handed over that turned out to already have an answer, and the flaky-test
> class this session finally fixed.

## What was wrong

1. **ADM-01 had no counters and no days column.** A flat table of invoices with
   a "pendiente total" tag in a header — nothing said how much was late, which
   is the only number on this screen anybody is anxious about.
2. **Lateness was buried in a pill.** `Vencida 12d` inside a status cell, which
   is where you find it if you already know to look.
3. **Two intermittent reds had been shrugged at twice.** A shell check reporting
   `sections=0` and a builder check reporting `0 budgets`, each followed
   immediately by a passing assertion over the same page.

## What exists now

|                 | Before                        | After                                                   |
| --------------- | ----------------------------- | ------------------------------------------------------- |
| ADM-01 header   | a "pendiente total" tag       | four **270 px counters**, the last red when non-zero    |
| Lateness        | inside a status pill          | its own **Días** column, red **from day one**           |
| The register    | a hand-built table            | the shared list primitive, paginated like the other 28  |
| Settling a bill | a button that guessed the sum | a 480 panel with the amount, the method, partial cobros |
| Test boot waits | `waitForTimeout(600)`         | `bootedShell()` — waits for the shell, not the clock    |

## A strip of totals owes the table beneath it

All four counters come from `invoicingSummary`, which derives every figure from
the same `invoiceRegister` the rows are drawn from. Nothing is accumulated
separately and nothing is stored, so the strip cannot tell a different story
from the table under it — which is the entire failure mode a strip of totals
over a table exists to avoid.

**«Vencido» is a subset of «pendiente», not a fifth bucket beside it.** Money
that is late is still money that is owed. Two invariants are asserted in the
engine sim so they cannot drift:

    collected + outstanding === issued
    overdue ≤ outstanding

A red counter that double-counts would be the worst possible thing to paint
red.

## Red from day one

§3.2 says "days overdue painted red from day one", and the precision is the
point. Not from a week, not after a grace period: the day an invoice passes its
due date it is late, and a screen that waits before saying so has taught
somebody that waiting is normal. The engine already computed `daysOverdue` that
way; the check now pins both sides of the boundary — the due date itself is
`0`, the day after is `1`.

A settled invoice shows **«—»** in the balance column rather than 0,00 €. A
zero in a money column reads as a figure somebody calculated.

## The question S9 handed over already had an answer

S9's pack flagged a three-way consistency risk: does ADM-01 bill against the
contract's ORIGINAL amount or its CURRENT one, given CON-12's annex chain and
CHG-04's billability rule?

**Traced rather than changed.** `projectBilling` reads
`projectEconomics().currentRevenueCents` — the frozen baseline **plus approved
changes** — so it has always billed against the current value, and CHG-04 has
always refused the unapproved ones. Nothing was changed; **a check was added**,
because an invariant nobody tests is an invariant that survives by luck.

That is worth saying plainly: the honest outcome of investigating a risk is
sometimes "it is already right", and the work is then to nail it down rather
than to find something to rewrite.

## The flaky class, fixed rather than shrugged at

Two intermittent reds in this programme — `sections=0` here and `0 budgets` in
the builder during S9 — were the same bug in the harness, not the product: a
check that measured the page **600 ms after `goto`** and sometimes measured it
before `boot()` had rendered, on a machine busy doing something else. The tell
was always the same: the very next assertion, over the same page, passed.

`bootedShell()` waits for the shell to exist instead of guessing at somebody
else's CPU. A fixed sleep is a guess; a selector is a fact.

## Verification

Site E2E · manageability **196/196** (8 new engine checks) · migrations 48/48 ·
year 149/149 · import 25/25 · scheduling 30/30 · i18n coverage (EN 100%, CA
ceiling **1308 → 1304**) · site-sync 17/17 · ownership guard · bundle safety ·
lint · boundaries · check-types · unit tests · build · `make gates` ·
`make demo`. No schema change; the committed bundle is unchanged.

## What S11 inherits

S11 owns **ADM-05 Banco**, **ADM-06 Caja chica** and **gap 13 —
`accountCode`**.

- **Gap 13 is the last structural break in the money chain.** §6's table has
  had one ✗ since S0: a cost can reach an _account_ rather than a project, and
  no field carries it. ADM-03 allocates to overhead **categories**; the chart of
  accounts in `financial-data.html` is the destination the doc's rule 07 wants,
  and nothing wires the two together.
- **ADM-05 is a MERGE**, the last of S1b's three tab strips: `banking` is still
  Cuentas y saldos + Conciliación behind a strip, and the doc wants one screen
  with inline classification and assignment in the row.
- **ADM-06 is a BUILD** — the simplest screen in the document, and `till`
  already exists in the model.
- **The counter strip is on its third of five users**; ADM-05's is a 56 px
  strip rather than cards, which is a different shape and probably its own
  small primitive.

**Every string S11 adds must ship with Catalan AND a real-browser render
assertion.** That rule has now caught a gap in seven consecutive sessions.

# S11 · The last break in the money chain

> Context pack. What gap 13 actually was, the duplicate method this class
> swallowed without a word, a correction to S10's record, and what S12
> inherits.

## What was wrong

1. **§6's money chain had carried one ✗ since S0.** Rule 07 says every cost
   lands on a project **or an account**. The account half had no field
   anywhere in the model, and the chart of accounts lived in a separate page's
   own dataset the engine had never heard of.
2. **`banking` was the last of S1b's three tab strips.** Cuentas y saldos and
   Conciliación behind a strip, with classification done nowhere in the row.
3. **ADM-06 was a placeholder** pointing at Consolidación bancaria.

## What exists now

|                   | Before                        | After                                                    |
| ----------------- | ----------------------------- | -------------------------------------------------------- |
| Chart of accounts | a separate page's own dataset | `state.lists.accounts`, maintained like every other list |
| A cost's account  | no field                      | resolved and stored on every allocation (schema **v15**) |
| Cost by account   | impossible                    | `accountLedger`, with what it could not place named      |
| ADM-05            | a table under a tab strip     | one screen, class and destination edited **in the row**  |
| ADM-06            | a placeholder                 | entrada/salida, the strip, and the arqueo at the foot    |

## Gap 13 was a wiring problem, not a missing idea

The overhead **category** has existed since the beginning; what was missing
was the account it rolls into. So the chart of accounts came in as
`state.lists.accounts` — a list, for three reasons at once: the resolver has
something to validate against, the chart becomes owner-maintainable through
the same screen as units and payment terms, and the codes stay out of code.

Each account names **which overhead category defaults to it**, so the mapping
is a property of the account rather than a second table that has to be kept in
step with the first.

`resolveAccountCode` answers in one place, and the precedence matters:

1. an **explicit** code wins — somebody who typed one has looked at the invoice;
2. an **overhead category** resolves through the chart;
3. a **project** resolves by its cost kind (material → 600, subcontract → 601…);
4. anything else resolves to **null**, and `accountLedger` reports it under
   `unassigned` rather than dropping it. A roll-up that quietly loses money is
   worse than one that admits it.

Migration v15 **resolves** rather than defaults: every existing allocation
already knew which account it belonged to; what it could not do was say so.

## The duplicate this class swallowed without a word

ADM-06 needed a way to record cash, so this session wrote
`recordCashMovement` — and the engine already had one, 280 lines further down.
**A later definition of the same name in a class body silently wins.** The new
method was dead the moment it was written, the tests failed against behaviour
nobody could find, and nothing anywhere said "you have two of these".

S1a wrote this hazard down after hitting it once. Writing it down once was
demonstrably not enough, so it is now a comment at the site of the mistake as
well: **before adding a method to this class, grep for its name.**

The real `recordCashMovement` (BNK-07) flags a movement with no
`supportingDocRef`, which is a better rule than the one the duplicate invented
— "money going out defaults to needing a receipt" — because it asks about the
evidence rather than about the sign.

A second bug fell out of the same work: `cashCount`'s opening window was
written `!from || m.accountingDate < from`, so an **unbounded** count treated
every movement as "before" and folded the whole history into the opening
figure. It still balanced. That is what made it worth a check — the arqueo is
now asserted against `accountBalanceCents`, because a count that does not
agree with the balance is decoration.

## A correction to S10's record

**S10's commit message, `PROGRESS.md` entry and session pack all claim a
`bootedShell()` helper was added to the e2e suite. It was not.** The script
that was supposed to add it failed silently, and S10's green run was green by
timing rather than by the fix. The helper exists as of this session, with both
call sites wired, and the S10 entries have been corrected rather than left to
read as done.

Three intermittent reds in this programme have now come from the same cause:
a check that measures the page a fixed number of milliseconds after `goto`.
A fixed sleep is a guess about somebody else's CPU; a selector is a fact.

## ADM-05: inline is the whole point

Classifying a movement is a two-second decision made forty times in a row. A
drawer per movement turns forty seconds of work into forty interruptions, so
§3.2 puts the class and the destination **in the row** and this screen does
too. An unmatched movement carries the amber left bar and its age in days.

Conciliación keeps its own tab: assisted matching is a different job from
classifying a card payment, and it is the only screen driving the
reconciliation capability. The old free-text allocation input does **not**
come back — the row's selects write through the same `splitMovement`
Conciliación does, so a movement assigned here is assigned the same way.

## Verification

Site E2E **299/299** (10 new browser checks) · manageability **211/211** (15
new engine checks) · migrations 48/48 (ladder now **v15**) · year 149/149 ·
import 25/25 · scheduling 30/30 · i18n coverage (EN 100%, CA ceiling
**1304 → 1303**) · site-sync 17/17 · ownership guard · bundle safety · lint ·
boundaries · check-types · unit tests · build · `make gates` · `make demo`.

## What S12 inherits

S12 owns **ADM-04 Horas**, **ADM-07 Gestoría** and **ADM-08 Flujo de caja**.

- **`cash-flow` is the last placeholder in the menu**, and it is now the e2e's
  "unbuilt subsección" probe. When S12 builds it, that probe has nowhere left
  to go — move the check rather than delete it.
- **`cashForecast(weeks)` already exists** and the Torre already draws it;
  ADM-08 opens it by period and by project, with the cumulative balance red
  when negative.
- **ADM-07 is a three-step wizard** whose Export must stay disabled while
  blocking exceptions remain — the engine's `quarterlyPackage` already knows
  what those are.
- **`accountLedger` is what the gestoría package wants**, and ADM-09 after it:
  gap 13 closed this session specifically so those two have something to read.
- **ADM-04's monthly reconciliation block** is the one genuinely new piece.

**Every string S12 adds must ship with Catalan AND a real-browser render
assertion.** That rule has now caught a gap in eight consecutive sessions.

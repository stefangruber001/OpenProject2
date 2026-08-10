# S9 · The last full screen, and a photograph that is actually a photograph

> Context pack. Why the contract's document is rendered rather than uploaded,
> what «vigente» decides, the two words the doc's five counters had to fold
> together, and what S10 inherits.

## What was wrong

1. **COM-04 was a nine-column table and nothing else.** No tabs, no way to see
   a contract, and — the one that matters — **no sign that annexes existed**.
   The screen showed one amount, so a contract worth €31k after two approved
   extras still read €26k and nothing said otherwise.
2. **PRY-03 had no counters and no photograph.** `change.photoRef` has been a
   typed file name since session 10b («extra-01.jpg»), which renders as
   nothing, and §3.2 puts a 40 × 40 thumbnail in every row.
3. **CHG-04's rule was a pill and a hope.** Unapproved work is never billable;
   the screen said so in a word, in a column, in the middle of a table.

## What exists now

|                       | Before              | After                                                     |
| --------------------- | ------------------- | --------------------------------------------------------- |
| COM-04 register       | one flat table      | Vigentes / Históricos, and an amber **Importe vigente**   |
| The contract itself   | could not be opened | full screen: document 760 left, fixed 392 panel right     |
| Hitos de pago         | pills in a cell     | their own tab, footed against the contracted amount       |
| Anexos                | invisible           | their own tab, and the reason the list goes amber         |
| PRY-03                | three KPIs, a table | five 216 counters that filter, 56 px rows                 |
| An unapproved extra   | an amber pill       | a pill **and** a 3 px amber rule down the row's left edge |
| An extra's photograph | a typed file name   | a real captured file, thumbnailed at 40 × 40              |

## Why the document is rendered, not uploaded

§3.2 says "PDF 760 wide". There is no contract PDF anywhere in this system —
and there does not need to be one, because **CON-03 made the terms structured
on purpose**. Requiring somebody to attach a scan of what the database already
knows is asking for the same contract twice and then trusting the copy.

`renderContractDoc` builds it the way `renderBudgetDoc` has built the
presupuesto since session 9: issuer, customer, economic terms, milestones,
guarantees, penalties, signature. A signed scan, when there is one, is a
**captured document** and belongs beside this rather than instead of it —
S7's `attachPurchaseDocument` is the pattern if that is ever wanted.

The document carries `translate="no"`, and its fixed labels come from a small
per-language table inside the view rather than from the i18n dictionary. Same
rule S5 established for the presupuesto and the same reason: `contract.language`
is a field an estimator sets **per customer**, the toggle is a preference of
**whoever is at the screen**, and they must not share a switch. The panel
beside it is interface and does follow the toggle — which the e2e checks in the
same breath, so the two cannot quietly become one.

## The column that earns the screen

**«Importe vigente» goes amber the moment it differs from the original.** That
difference means annexes exist, and it is the one fact about a contract nobody
should have to open it to discover. Both figures are the taxable base, not the
gross: an annex records a net price (`change.priceCents`), so adding it to a
VAT-inclusive figure would produce a number that is neither one thing nor the
other.

The e2e asserts the pill against the **engine**, not against a colour: a pill
appears in exactly the rows where `contractsView().differs` is true.

## Two words the counters had to fold together

The doc counts by five — identificado · valorado · aprobado · ejecutado ·
facturado — and the record has eight statuses. The mapping is one-to-one except
for `sent`, which folds into **valorado**: from the site's point of view an
extra that has been priced and one already with the customer are the same
thing — priced, not yet agreed — and the difference is visible in the row's own
status pill.

A **rejected or cancelled** extra is counted in **none** of the five. Same call
S7 made for a cancelled purchase order: a counter that includes work nobody
will do has to be explained every time somebody reads it.

## The 3 px rule is not decoration

§3.2 asks for an amber pill **and** a 3 px amber rule down the left of every
unapproved row, "visible from a distance". CHG-04 is why: unapproved work is
never billable, and the person who needs to know that is walking past a screen
in a site office, not reading a column. The rule is `box-shadow: inset` on the
row's first cell — a `border-left` on a `<tr>` does not render in a table.

The photograph became a real file on the same argument. A 40 × 40 thumbnail of
a typed string is a blank square; it is now a blob key written through
`ErpStore.putBlob`, the path every picture has taken since S6, and it is stored
**before** the record is written so a failed upload cannot leave an extra
pointing at a picture that is not there.

## Decisions worth knowing

- **«Vigente» is about whether the contract governs work**, not whether it is
  signed. A draft is active because somebody is still working on it; a
  cancelled one is not, whatever its signature says. The signature is its own
  column.
- **`contractControlView` stays** beside the new `contractsView`, because
  `year-sim` drives it as CON-13's own trace evidence and widening a method a
  simulation asserts against would change what that evidence means. Two views
  of one collection is a smell, logged in ASSUMPTIONS #122 so the next person
  can retire the first once CON-13's evidence has somewhere else to live.
- **Every full-screen surface now clears itself on navigation.** `go()` drops
  `conWork`, `puWork` and `ganttFull` when the route changes — S8 learned that
  a surface which survives a trip to another section ambushes whoever comes
  back, and S9 made it a rule rather than a special case.

## Verification

Site E2E **280/280** (16 new browser checks) · manageability **188/188** (14
new engine checks) · migrations 48/48 ·
year 149/149 · import 25/25 · scheduling 30/30 · i18n coverage (EN 100%, CA
ceiling held at 1308 across 39 new triples) · site-sync 17/17 · ownership guard ·
bundle safety · lint · boundaries · check-types · unit tests · build ·
`make gates` · `make demo`. The committed bundle is unchanged.

### The trap this session fell into, twice removed

The row-shape check first measured "the first unapproved row" — and the
sample's extras are all approved, so it measured **nothing** and reported a
shape that happened to satisfy it. That is S8's lesson wearing a different
coat: **a check that depends on the sample containing something tests the
sample, not the screen.** The unapproved row is now seeded by the check
itself, and the assertion counts it before measuring it.

A second failure in the same run — a draft budget the builder test could not
find — did **not** reproduce and is not S9's: nothing in this session touches
budgets, and the check passed on either side of it. It is recorded here rather
than explained away, because an intermittent failure nobody wrote down is one
that gets rediscovered from scratch.

## What S10 inherits

S10 owns **ADM-01 Facturación**.

- **Four 270 counters** — Issued, Collected, Outstanding, Overdue (red when
  non-zero) — on the strip S7 built; ADM-01 is the third of its five users.
- **Days overdue painted red from day one**, which is a row treatment like
  PRY-03's amber rule rather than a new primitive.
- **No new layout is required.** Every surface ADM-01 needs exists: the counter
  strip, the shared list, the 480 side panel.
- **`installment.status === "invoiced"`** is what COM-04's Hitos tab reads to
  say a milestone has been billed. ADM-01 is where that transition happens, so
  whatever it writes has to keep that tab honest.
- The **contract's current amount** (`contractValue`) is the figure ADM-01
  should invoice against, not the original — the difference is exactly the
  approved extras.

**Every string S10 adds must ship with Catalan AND a real-browser render
assertion.** That rule has now caught a gap in six consecutive sessions.

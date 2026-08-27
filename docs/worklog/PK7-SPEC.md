# PK7 — specification: Gastos decides, Conciliación identifies

Agreed with the operator across the acceptance review of 2026-08-27
(`20260827_Comments.docx` against `CaneiUATE2EENV2.pdf` steps 107–132).
This file is the contract the six PK7 sessions implement. Where a screen and
this file disagree, this file is right and the screen is a defect.

## The rule, in one line

> **Gastos decides. Conciliación identifies. Avance económico reports.**

Three sentences, three responsibilities, and no overlap:

| Screen                    | Answers                                                                                                                     | Never answers               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Gastos**                | _What did this cost belong to?_ — project · Partida · Subpartida · cuenta contable, split by percentage if it spans several | whether it has been paid    |
| **Conciliación bancaria** | _Which document is this bank line?_ — for cash flow                                                                         | what the money was spent on |
| **Avance económico**      | _Where does the project stand?_ — reads what Gastos decided                                                                 | nothing; it only reports    |

A cost is classified **once**, in Gastos. The bank screens never assign cost.
This is not a preference about layout; it is the reason the same euro cannot be
counted twice, and it is why `actualCostCents` can be trusted at all.

### The two axes are unrelated

`cuenta contable` is the **gestoría's** axis — the chart of accounts they file
with. `Partida` / `Subpartida` is the **site's** axis — how the job was
estimated and how it is being tracked. A single allocation line carries both,
and neither derives from the other. Do not build a mapping between them; do not
default one from the other.

### The cascade

Selecting a project narrows everything below it:

1. Pick a **project** → offered Partidas are that project's accepted budget,
   not the inventory.
2. Pick a **Partida** → offered Subpartidas are the Subpartidas _of that
   Partida of that project_.
3. A Subpartida from another project, or from another Partida of the same
   project, is refused by the engine — not merely absent from the list. The
   Partida is filled in from the Subpartida so the two can never disagree.

One supplier invoice may split across several projects, or across several
Partidas of one project. Percentage splits land as exact cents and the
allocations must total the taxable base.

## Vocabulary

Engine `chapter` = UI **Partida**. Engine `line` = UI **Subpartida**. The
identifiers were deliberately left alone in `e9b487a`; only the labels moved.
`subLines` are sub-mediciones.

## What Conciliación is for

For **cash flow**, and for nothing else. A bank line is matched to a document —
a supplier invoice, a customer invoice, a card settlement — or it is explained
some other way, or it stays in the queue. Matching moves no cost.

Consequences the screens must respect:

- **`gasto general` is not document-only.** A real quarter is ~535 movements
  and most are small card purchases. Hundreds of 2,60 € coffees will never each
  have an invoice. A document where one exists; otherwise a class and a reason.
- **Petty cash can belong to a project and usually has no backing document.**
  Acknowledged as a rule; the screen for it is a later package.
- **Internal transfers are pairs.** An outgoing leg on one account and an
  incoming leg on another are one event. Marking, unmarking and undoing all act
  on both legs, and the counterpart is shown, not counted.
- **Undoing a match must leave project cost untouched.** `actualCostCents` is
  identical before the match, during it and after Deshacer. This is the safety
  property the whole package rests on.

## Balances must be true or absent

The importer had always read the SALDO column and never used it, while
`openingCents` defaulted to zero. Against the operator's own file that made the
product show −10.235,63 € where the bank said 13.764,37 € — wrong by exactly the
opening balance, and silent about it.

The rule now:

- The statement's own arithmetic is checked first: `opening + Σ movimientos =
closing`, where `opening` is derived from the oldest row as `saldo − importe`.
- A statement that does not close is **refused**, with nothing written. A
  dropped or duplicated row breaks the chain, and importing it anyway would
  bake a wrong balance into the account.
- Where the file carries no SALDO column at all — the card export does not —
  the import proceeds and says so. Absent is honest; wrong is not.
- When an import establishes an account's opening balance, the resulting
  account balance is compared against the statement's closing figure and the
  import is rolled back if they disagree.

The check is endpoints-plus-sum, deliberately, not a per-row running chain: a
bank may list same-date rows in an order other than the one it applied them in,
and refusing a valid statement is the worse error.

## Amounts must not exceed what is owed

Allocating more to a document than it still owes is refused, in both
directions — supplier payments and customer collections. The honest
alternatives are offered instead: the movement covers several documents, it is
an advance on account, or it is a duplicate to be refunded.

One movement may settle several documents. That is one payment with several
allocations, each capped by that document's outstanding amount, not several
payments — and the movement records every document it settled, not the last one
processed.

## The queue belongs to the account

Conciliación shows the movements of the account selected in Cuentas y saldos.
Showing every account's movements under whichever account was selected is what
made the credit card and the current account both report 533.

## Where the screens end up

- **Cuentas y saldos** — one row per account with its balance, Total
  disponible, import, undo import, and the last five movements read-only. No
  classification controls.
- **Conciliación** — match, explain, or leave queued. No «Asignar a proyecto».
- **Conciliados** — a third tab showing everything already explained _and how_,
  every row undoable.
- **Gastos** — where cost is assigned, and the only place.

Direct project allocations written onto movements during testing are still
**read** by `actualCostCents` and `chapterCosts`. Nothing new writes them.
Removing the read would make costs that were legitimately recorded disappear.

# S5 · The heart of the system leaves the shell

> Context pack. What the presupuestador now is, the two things that turned out
> not to exist at all, why the customer's document is deliberately outside the
> language toggle, and what S6 inherits.

## What was wrong

1. **The builder was a card layout inside the normal page.** The specification
   puts it outside the shell for a reason that is not decoration: a presupuesto
   is worked through _whole_, so every pixel spent on a breadcrumb, a page
   heading or the section rail is taken from the tree, the grid and the totals.
2. **Nothing could be reordered, and nothing could be numbered by hand.** The
   estimator got the numbering the engine chose, in the order rows were typed.
3. **A presupuesto could not be sent, and the customer's answer could not be
   recorded.** `issueVersion` and `acceptVersion` existed and were correct, and
   had **zero callers** outside `erp-seed.js` and `erp-history.js`. The
   interface could build a quote and never do anything with it.
4. **The customer's document followed the operator's language toggle**, so a
   Spanish presupuesto previewed by somebody working in English came out
   partly English.

## What exists now

|                   | Before                      | After                                                            |
| ----------------- | --------------------------- | ---------------------------------------------------------------- |
| Register          | flat table, status pill/row | grouped by five **derived** stages                               |
| Builder           | cards inside the shell      | full screen, 260 / flexible / 300, own 56 px bar, conditions bar |
| Order             | fixed                       | chapters and lines dragged; lines move between chapters          |
| Numbering         | engine's, always            | free — a typed number outranks the positional scheme             |
| Send / answer     | did not exist in the UI     | send with a pre-send warning; accept or refuse                   |
| Document language | followed the operator       | follows `budget.language`; ES and CA                             |
| Schema            | v12                         | v13                                                              |

**The five stages are derived** (`budgetStage`): draft · issued · accepted ·
rejected · expired. Expiry is the reason it cannot be a stored field — it is
not something done to a record on a date, it just becomes true, and the
shipped data proved it with four seeded budgets long past their validity still
stored as `issued`.

**Free numbering is a flag on the row, not a mode on the screen.** `_renumber`
assigns positional numbers to everything EXCEPT rows carrying `manualNum`, and
every path that changes the shape of a version goes through it. So a number a
person typed survives inserts, deletes and drags; a number the system assigned
belongs to the position and travels with it. Clearing a manual number hands the
row back. Duplicates are refused, because the number is the reader's only index
into the document and into the graphic annex.

**Dragging means something to the document.** The 16 px handle is the only
grip — a draggable row would steal the text selection an estimator needs to
copy a description. Moving a line into another chapter is the case that earns
the feature: the destination chapter's `section` decides which subtotal the
money lands in and which part of the customer's document the line prints in,
and both follow the drag.

## The two things that did not exist

**Sending.** `sendBudgetDrawer` states what the customer is about to receive,
and states the pending-price lines as plainly as they deserve: they are **not**
in the total on that screen, and if nobody says so there the difference is
discovered by the customer. A blocking issue disables the button rather than
hiding the reason.

**The answer.** `rejectVersion` is new — without it a refused presupuesto is
indistinguishable from one nobody has answered, which is exactly the
difference the v4 register groups by. It takes a loss-reason **code** from
DMC-04, so refusals stay countable alongside `loseOpportunity`; free text goes
in `notes`.

Writing it exposed a real defect in code that was already shipped:
**`acceptVersion` never checked for an existing customer response.** A refused
version could be accepted afterwards, overwriting the refusal and flipping the
opportunity from lost back to won with no trace of which answer the customer
actually gave. Both methods now refuse a version that already has an answer; a
customer who changes their mind gets a new version, which is what `newVersion`
is for.

## Why the document is outside the language toggle

`budget.language` is a field an estimator sets **per customer**. The toggle is
a preference of **whoever is at the screen**. They are different choices made
by different people and they must not share a switch.

So the document block carries `translate="no"` — the standard HTML opt-out,
which `i18n.js` now honours for a whole subtree — and its fixed labels come
from `DOCL`, a small per-language table that is deliberately **not** in the
i18n dictionary.

This fixed a bug rather than only enabling Catalan. `Base imponible`,
`Validez`, `Opcionales (aparte)` and `Total por m²` are all dictionary
entries, so before this change they were being translated **inside the
customer's own document**.

## The i18n lesson, again — and its general answer

S4 recorded that the dictionary guard proves entries exist, not that a screen
renders them, and that every new screen needs a real-browser render check. That
check earned its place immediately here: it caught `"Borradores · 1"`, a single
text node no dictionary entry can reach, in two places.

The fix is worth knowing because it generalises: **split the label from the
number into separate elements** rather than adding a regex rule. A regex would
have fixed English only — Catalan has no regex coverage for any such count,
`clientes` and `proveedores` included — while splitting the nodes fixes all
three languages with no rules at all. Prefer this whenever a count and a word
share a text node.

83 new ES/EN/CA triples; the Catalan backlog held at 1326, unchanged.

## Decisions worth knowing

- **Full screen is opt-in per render and cleared by `render()`**, not turned
  off on the way out, so no exit path can strand the next screen without its
  navigation.
- **"Guardar" is in the bar because §3.2 puts it there**, and does the only
  honest thing left: §3.1 says nothing waits for a save and this screen already
  writes every keystroke through, so the button flushes the 140 ms debounce and
  reports the real outcome (`persistNow`) — including failure, which the
  fire-and-forget path deliberately swallows.
- **The visit panel falls back to the customer's last capture** when no visit
  is linked, labelled as the guess it is. Only S4-era budgets carry
  `visit.budgetId`, so a strict reading would show an empty tab on every
  historical presupuesto. Nothing on that tab writes and nothing is copied into
  a line — the mapping's own row 2 says the visit does not inherit into the
  presupuesto.
- **`_requireFreeNumber` throws an error with a `code`**, unlike most in the
  engine, because a mistyped duplicate is the one failure here a USER causes in
  normal work and the interface should answer it in the language it is
  speaking. Everything unexpected still surfaces as its raw message, which is
  what makes an unexpected failure visible at all.

## What S6 inherits

Nothing in the presupuestador blocks the OCR work; the two do not touch. What
S6 should take from this session is the pattern, not the code:

- The **full-screen surface** (`body.fs` + `.pb*`) is built and proven. Document
  validation is one of the four surfaces the specification puts outside the
  shell, so S6 should reuse this rather than invent a second mechanism.
- The **two-zone document layout** S6 needs (image left, form right) is the same
  primitive as `.pbpanes` with two columns.
- `translate="no"` is available for anything that is a document rather than
  interface.

**Every string S6 adds must ship with Catalan AND a real-browser render
assertion.** The dictionary guard alone has now missed a gap in two consecutive
sessions.

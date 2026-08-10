# S14 · The phone

> Context pack. The first session since S1 whose job was not to build a
> surface, why the card fallback is a runtime pass rather than thirty template
> edits, and the four things somebody on a roof actually reaches for.

## What was wrong

1. **The card fallback existed for exactly one table.** S2 built it for the
   master-list primitive and left a comment saying full verification was S14's
   job. Every other table — the purchase register, the bank movements, the
   exceptions, the contracts, the receipts — still scrolled sideways on a
   phone, which is the behaviour §3 replaces.
2. **There was no floating button.** §3 asks for one for frequent site
   actions, and nothing carried it.
3. **The bottom bar was already right.** Five icons, no scroll, Configuración
   moved into the profile menu. S1b built it and `testNoOverflow` has guarded
   it since; this session did not touch it.

## What exists now

| Surface        | Before           | After                                             |
| -------------- | ---------------- | ------------------------------------------------- |
| Tables ≤700 px | `.mlist` only    | every table, via `autoCards()` at render time     |
| Grids ≤700 px  | same as tables   | opt out by name (`data-nocards`) and keep columns |
| Site actions   | nothing          | 56 px button, four actions, 48 px rows            |
| Bottom bar     | five icons (S1b) | unchanged — it was already right                  |

## One pass, not thirty edits

There are more than thirty tables across twenty-nine screens. Labelling each
one by hand would be thirty chances to miss one and thirty places to drift out
of sync later.

`autoCards()` runs once after every render, reads each table's own `<thead>`,
copies the labels onto `td[data-th]`, and adds the class the phone stylesheet
keys off. **A screen written next month gets cards without knowing the function
exists**, and no screen can forget a label, because no screen writes one.

Two rules fell out of doing it generically rather than per screen:

- **A grid is not a list.** The forecast, the Gantt and the week calendar carry
  `data-nocards`. Turning a period column into a labelled line destroys the
  shape across time that is the only reason those layouts exist. They keep
  their columns and scroll inside their own container — which they already did.
- **A headerless table becomes cards only from three columns up.** With no
  header there is no label to put on a line. That is fine for a five-column
  receipts table (five short lines beat a squeezed five-column grid) and wrong
  for a two-column key/value row, which already reads as one line and would
  become two.

## Four actions, and the test for what belongs

The question is not "is it useful". Everything on twenty-nine screens is
useful. The question is **«would somebody standing on a roof in the rain reach
for it»**, which is a much shorter list:

1. 📸 Foto y avance de obra
2. ⏱️ Parte de horas de hoy
3. 🧾 Capturar un gasto
4. 🗒️ Nueva tarea

56 px target, 48 px rows, three taps to done — the button, the action, and the
one control the action puts in front of you. Each action **navigates to the
screen where the result will be visible** before opening anything, because a
shortcut whose outcome you cannot see is a trapdoor.

It exists on phones only. On a desktop the same four are one click away in the
create menu, and a floating button over a full-width screen is a button in the
way.

## What the tests now assert

The mobile suite walks **eighteen routes at 390 × 844** and fails if any table
is neither cards nor a declared grid, if any screen scrolls sideways, or if the
card shape breaks (header hidden, rows stacked, every cell labelled). That is
stronger than checking a handful of screens, and it is the assertion that keeps
`autoCards()` honest as screens change.

## Verification

Site E2E **331/331** (9 new browser checks) · manageability 225/225 ·
migrations 48/48 (no schema change) · year 149/149 · import 25/25 ·
scheduling 30/30 · i18n coverage (EN 100%, CA ceiling 1301 held — the four new
strings shipped with Catalan) · site-sync 17/17 · ownership guard · bundle
safety · lint · boundaries · check-types · unit tests · build · `make gates` ·
`make demo`.

## What S15 inherits

S15 is the last session: **seed rebuild, workbook coverage test, hardening**.

- **The seed is the demo, and the demo is the pitch.** `erp-seed.js` predates
  most of the twenty-nine screens, so several of them open onto sample data
  that does not exercise what they were built for — the forecast has thin
  months, the day sheet has few workers, the account ledger has five rows in
  seven months.
- **The workbook coverage test is the one governance claim still unproven.**
  `docs/CANEI-V4-MAPPING.md` §4 maps 100 workbook columns to model fields;
  nothing checks that the mapping is still true. A test that reads the mapping
  and asserts each ✓ column resolves is what turns that table from a document
  into a guarantee.
- **The Definition of Done is in CLAUDE.md §12**, and the negative test —
  kernel + billing with no jurisdiction pack must fail loudly — is the one that
  proves the factory rather than the ERP.
- **Nothing is half-migrated.** Every session since S7 ended green with its
  governance current, so S15 starts from a clean base rather than a backlog.

**Every string S15 adds must ship with Catalan AND a real-browser render
assertion.** That rule has now caught a gap in eleven consecutive sessions.

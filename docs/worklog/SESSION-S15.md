# S15 · Making the claims checkable

> Context pack. The last session of the programme: a guard that turns the
> strongest governance claim into a test, a demo that can finally exercise the
> screens built for it, and the reconciliation month that was asking an
> unanswerable question.

## What was wrong

1. **The field dictionary was a promise nobody checked.**
   `docs/CANEI-V4-MAPPING.md` §4 maps the customer's 100 workbook columns onto
   model fields and marks each ✓ covered, NEW-and-closed, ⊘ derived or ✗
   discarded. It is the strongest thing the governance set says — «the data you
   have today fits the system you are buying» — and it is a markdown table. A
   field renamed in the engine would have left it quietly lying.
2. **The demo could not exercise the screens built for it.** Five screens
   arrived between S10 and S13 that read things this dataset barely had. No
   wage had ever left the bank, so ADM-04's reconciliation opened at **−100%**.
   `accountLedger` — the roll-up gap 13 was closed for — returned **two rows
   for seven months**, so ADM-09's P&L and the gestoría summary were blank. The
   day sheet is a grid of workers and there were **two**.
3. **The reconciliation asked an unanswerable question.** It defaulted to the
   current month, and on the 5th no payroll has run: every hour booked so far
   showed as unpaid.

## What exists now

| Claim                            | Before              | After                                               |
| -------------------------------- | ------------------- | --------------------------------------------------- |
| 100 workbook columns are covered | a markdown table    | `tests/workbook/coverage.mjs`, in `make gates` + CI |
| ADM-04 monthly reconciliation    | −100%, no wages     | −1.6% against a real payroll                        |
| `accountLedger` over the year    | 2 rows              | 7 accounts, real overheads                          |
| Workers on the day sheet         | 2                   | 5, with four months of weekdays                     |
| Gestoría exceptions in the demo  | would have been 20+ | 1 in Q1 — the invoices are filed                    |

## A guard, not a grep

The obvious way to check a field dictionary is to search the engine for each
identifier. That passes on a field that appears only in a comment, which is
exactly the failure mode the table has.

So the guard **builds the shipped demo through the engine** and requires each
claimed field to be present on at least one record of the collection its
section names. It asserts existence and nothing else — not a value, not a type,
not a count — because «Notas» is a real column that is usually blank, and what
the table promises is a _place to put the customer's data_.

Rows marked ⊘ derived or ✗ discarded are counted and reported but not resolved:
the table's own claim about them is that they have no field.

It was verified the only way a guard can be: **by breaking a claim on purpose**
and watching it fail with the right name.

> 60 columns · 74 field claims resolved · 6 derived · 2 discarded

## The seed grew where the screens were thin, and nowhere else

Three workers, four months of weekdays, twenty overhead invoices across five
recurring suppliers, and monthly payroll. Nothing decorative: each addition is
traceable to a screen that was showing an honest zero.

Two details are the interesting ones:

- **The overhead invoices carry a `docRef`.** Twenty bills with no document
  would hand the gestoría screen twenty blocking exceptions. That would not be
  the screen being strict — it would be the demo being careless, and the
  distinction matters because the whole point of ADM-07 is that the refusal
  means something.
- **April does not pay its crew twice.** The seed already had a NOMINAS line
  that §5.3 uses to demonstrate classification, so the monthly loop skips
  April and that line's amount was raised to match the larger crew.

`SEED_VERSION` is bumped to 3, so an existing install is _offered_ a reload
rather than reseeded over. Reseeding real records to make a demo look better is
data loss.

## The month a reconciliation can actually answer

`labourReconciliation()` with no argument now reconciles **the last month whose
payroll ran**, not the current one. On the 5th, the current month reports every
hour booked so far as unpaid — a calendar fact dressed up as an alarm, and it
was the demo's own headline figure. The last closed payroll is the last month
there is an answer for, and it is the month somebody asking the question means.
Passing an explicit month still works unchanged.

## Definition of Done — where the programme stands

- `make demo` green from a clean checkout ✓
- `make gates` green, now including the workbook guard ✓
- The **negative test** — kernel + billing with no jurisdiction pack must fail
  loudly — exists in `packages/factory/src/negative.test.ts` and runs in
  `pnpm test` ✓
- All twenty-nine subsecciones render a real screen; the e2e walks every one of
  them and fails on a dead link ✓
- Governance files current: `PROGRESS.md`, `ASSUMPTIONS.md` (#108–#145),
  `docs/CANEI-V4-MAPPING.md`, `WORKLOG.md`, and a session pack per session ✓

## Verification

Site E2E **331/331** · manageability **226/226** · **workbook 4/4** (new) ·
migrations 48/48 · year 149/149 · import 25/25 · scheduling 30/30 · i18n
coverage (EN 100%, CA ceiling 1301 held) · site-sync 17/17 · ownership guard ·
bundle safety · lint · boundaries · check-types · unit tests · build ·
`make gates` · `make demo`.

## What comes after

The fifteen coding sessions are complete. The remaining item on the programme
is the **iOS app rebuild** against this build — the app loads the same `site/`
pages, so what changed for it is everything S7–S15 added: five new admin
screens, the mobile card fallback, the site-action button and a demo dataset
that actually fills them.

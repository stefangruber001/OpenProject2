# End-to-end test — 13 stages driven as an employee

**Method.** This is a _test_, not a code read. Every finding below came from driving
`site/journey.html` in a real Chromium instance as an operator would: loading the intake,
walking each stage, typing into the fields, and deliberately doing the things people do
wrong on a Tuesday afternoon. Where the screen and the stored data disagreed, both are
quoted. Harnesses are in `tests/site-e2e/run.mjs` (the permanent suite, 47 checks) plus
throwaway probes for the adversarial cases.

**Baseline.** A previous pass audited the code and repaired the fabricated figures, the
missing gates and seven dead engine methods. This run tests what that produced.

---

## Executive summary

**Overall ERP quality score: 41 / 100** (was 34 before the repairs).

| Layer                                                  | Score | Movement                                                  |
| ------------------------------------------------------ | ----- | --------------------------------------------------------- |
| Transaction engine                                     | 74    | +2 — seven dead correction paths now work                 |
| The 13-stage journey                                   | 52    | +27 — figures derive from entered data, every stage gates |
| Workspace UI (`erp.html`)                              | 22    | unchanged — still ~94% read-only                          |
| Cross-cutting (notifications, approvals, roles, scale) | 15    | unchanged                                                 |

The journey is now internally honest: the numbers on screen are consequences of what the
operator typed, and I could not walk it to the end without entering the data a real job
requires. That is a real change — the same walk previously produced a full set of documents
from an empty form.

**It is still not a system you can run the company on**, for one structural reason that no
amount of polishing the 13 stages fixes: the journey writes to its own browser database
(`caneiJourney`) while the ERP writes to another (`caneiERP`). Nothing crosses. Every
customer, quote and invoice is entered twice, and the invoice the journey produces is not
the one the accountant sees.

**Four defects found by driving it that reading it did not reveal** — all four fixed and
regression-tested in this pass. They are described below because they say something about
the class of bug that only shows up under a real hand.

---

## What the test actually did

**Full walk.** All 13 stages, capturing at each: fields rendered, which are required,
widgets present, gate state, ledger values, documents filed. Result: 13/13 stages walk,
zero console or page errors, ledger reconciles (revenue €9,149.00 → cash €3,113.90), 30
documents across 13 folders, ZIP export valid.

**Ten adversarial probes.** Six passed first time; four found real defects.

| Probe                                               | Result                                           |
| --------------------------------------------------- | ------------------------------------------------ |
| Invalid tax ID at intake                            | ✅ refused                                       |
| Withholding entered as 500%                         | ✅ blocked — "must be at most 100"               |
| Collection larger than the invoice                  | ✅ blocked                                       |
| Baseline after navigating back to the project stage | ✅ unchanged at €9,149.00                        |
| Editing a purchase order                            | ✅ committed cost moved €6,770 → €10,790         |
| Variation added after invoicing                     | ✅ revenue €9,149 → €9,649                       |
| **Valid CIF `B66666666`**                           | ❌ **rejected** — see M1                         |
| **Deposit invoice type**                            | ❌ **screen showed the full amount** — C1        |
| **Duplicate supplier bill number**                  | ❌ **Advance looked enabled** — C1               |
| **Part payment of €5,000**                          | ❌ **screen said "Outstanding: €0 · paid"** — C1 |

---

## Critical issues

### C1 — The screen contradicted the stored data _(FOUND AND FIXED THIS PASS)_

The stage's narrative body — the invoice table, the collection status, the chapter variance
— never redrew when a field changed. Field edits updated the ledger and regenerated the
filed PDF, and left the screen as first drawn. Three separate symptoms, one cause:

- Entering a €5,000 part payment left **"Received: €10,063.90 · Outstanding: €0.00 ·
  paid"** on screen while the ledger correctly showed €5,000. Two numbers on one screen,
  contradicting each other.
- Choosing "Deposit" left **"Base imponible €9,149.00"** on screen while the regenerated
  PDF billed the 40% deposit. The operator would send a customer a document whose figures
  they had never seen.
- Editing a purchase order or bill row never re-evaluated the gate, so Advance looked
  enabled and bounced on click. A duplicate bill number _was_ caught — but only after the
  click, which reads as a broken button rather than a rule.

This is the most instructive finding of the run. A code read says "the field drives the
calculation" and is correct. Only a hand on the keyboard shows that the operator is looking
at last minute's answer. **Fixed:** `refreshBody()` redraws the stage from the same pure
`body()` function; field commits and all four widget commit paths call it, and the widgets
refresh the gate. Verified: a deposit invoice now shows "Anticipo 40% s/ €9,149.00 =
€3,659.60", total €4,025.56; a part payment shows "Outstanding: €5,063.90 · part paid"; a
duplicate bill disables Advance before the click; a purchase order over its chapter budget
flags "⚠ over" live. Regression check added.

### C2 — The journey and the ERP remain two applications _(OPEN — the dominant issue)_

`journey.html` opens `caneiJourney`; the ERP opens `caneiERP`. No shared engine, no shared
records. Consequences an employee lives with daily: the customer typed at intake does not
exist in the customer register; the quote does not appear in Presupuestos; the invoice is
numbered by the page, not by the engine's gap-free per-year series, and carries none of the
engine's hash-chained audit events. For a Spanish company that is not merely inconvenient —
the invoice register the tax authority would ask for is in the other database.

This is Tier-1 item 1 and is unchanged from the previous audit. It needs idempotent
stage→record mapping and a decision about abandoned journeys polluting the live dataset.

### C3 — Procurement is three fields where the business has ten steps _(OPEN)_

Testing the Purchasing stage as a buyer: I can record that a purchase order exists, against
a chapter, for an amount, with a "received" tick. I cannot request quotes from three
suppliers, compare them, record who approved the spend, record _what quantity_ arrived, or
raise a return. The engine has `comparePrices` and `compareBudgetCosts`; neither is
reachable. Delivery is a boolean — there is no partial receipt and no three-way match, so a
supplier can invoice for more than they delivered and nothing in the system disagrees.
Materials are 40–55% of cost in this trade.

### C4 — Nothing is ever pushed _(OPEN)_

Across the whole walk, the system never once told me to do something. No reminder that a
quote is ageing, no alert that a bill is due, no dunning on the unpaid €5,063.90 I
deliberately left outstanding. `alerts()` computes a good list — 15 rule families — but only
when a page asks it. `addTask()` exists and the engine never calls it. Every follow-up in
this business depends on a human remembering.

### C5 — No quality or completion control _(OPEN)_

I closed a project with an outstanding customer balance and no defect list, and the system
had no opinion. There is no snag list, no final inspection, no customer sign-off, no
handover or warranty certificate. `closeProject()` has no preconditions of any kind. For a
renovation company the snag list _is_ the end of the job; closing without one is how
retentions are lost and warranty disputes start.

---

## Medium issues

**M1 — The two surfaces disagree about what a valid tax ID is.** The journey now verifies
the CIF control digit; the engine accepts CIF on structure alone
(`erp-engine.js:47`). Concretely: `B66666666` is accepted by the ERP and refused by the
journey — and it is refused correctly, since the control digit should be `0`. The repo's own
seed and test fixtures use that invalid value. Left as a finding rather than tightened,
because fixing the engine means correcting seed data and re-baselining the simulations —
real work with real blast radius, not a one-line change.

**M2 — The last stage's details reached no document** _(FIXED)_. `advance()` files the
details of the stage being _left_, and stage 13 is never left, so the review platform and
send date were simply lost unless the operator happened to edit a field. Now filed on
render.

**M3 — Forecast profit shows before there is any revenue.** At step 1 the ledger already
reads "Forecast profit €1,907.18", derived from the cost percentage typed at intake. It is
defensible as an expectation, but it is presented identically to the measured figures below
it, and an operator reading the panel top-to-bottom has no way to tell which numbers are
facts and which are guesses.

**M4 — Site measurements are typed twice.** The visit captures notes and an area; the
estimator then requires the quantities to be re-entered. The engine has
`visitToBudgetLines()` for exactly this and neither surface calls it.

**M5 — No search, filter or sort anywhere in the workspace**, and all lists render unbounded.
Unchanged from the previous audit; it is the reason the workspace stops being usable
somewhere around 100 projects.

**M6 — "Mark as sent" is honest but inert.** It records that a human sent the email
elsewhere. Correct, but there is no record of _when_ or _to whom_ beyond a log line, so
"did we chase this customer?" is unanswerable a week later.

---

## Minor improvements

The per-step heading now reads "required fields are marked" instead of "fill what applies"
(fixed — it contradicted the required markers). Remaining: the PDF is still single-page, so
a long quote silently loses its tail; ZIP entries are all dated 1980-01-01; province is
hardcoded to "Barcelona" on new customers in the workspace; `profitability()` documents four
groupings and implements two.

---

## Missing features

Confirmed absent by trying to use them, ranked by what this business actually needs:

1. Goods receipt with quantity, and three-way match before payment
2. Purchase approval — any spend, any amount, no approver
3. Snag list and defect management
4. Completion sign-off and warranty certificate
5. Progress valuation with retention (`retentionHeldCents` is read, never written)
6. Notifications and scheduled actions
7. Dunning ladder (detection exists; interest is stored and never calculated)
8. Supplier RFQ (comparison exists, the request does not)
9. Capacity planning, milestone planning, equipment register
10. Satisfaction survey / NPS, referral tracking, lessons learned, archiving
11. Roles and permissions — `user` is a free string used only for the audit log

---

## Automation opportunities

At 24 projects/year, the rate the two-year simulation models:

| Opportunity                       | Saving            | Notes                                                 |
| --------------------------------- | ----------------- | ----------------------------------------------------- |
| Journey writes to the engine      | **10 h/yr**       | Removes the double entry; unblocks everything below   |
| Invoice photo → extraction        | **17 h/yr**       | `captureDocument` pipeline exists with no UI          |
| Bank-feed matching                | **24 h/yr**       | `matchMovement`, `learnMerchantRule` both unreachable |
| Dunning ladder                    | **18 h/yr** + DSO | Scheduled reminders off `receivables()`               |
| Site measurement → budget lines   | **12 h/yr**       | `visitToBudgetLines()` exists, uncalled               |
| Auto-PO from accepted quote lines | **8 h/yr**        | Material lines already in the budget                  |

**~90 hours/year** of clerical time. The honest framing: five of those six are blocked by
C2, so the sequencing is not a menu — the integration comes first or the rest cannot land.

Where AI genuinely helps: invoice/receipt extraction (highest value, pipeline already
shaped for it), photo→measurement at the site visit, anomaly detection on quoted-vs-actual
by chapter. Not: anything needing a signature or a payment authorisation.

---

## User experience review

**Usability score: 44 / 100** (was 28).

| Dimension                | Score | Note                                                                                                                                            |
| ------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Ease of use              | 55    | The gates changed this most — the system now tells you what it needs                                                                            |
| Learnability             | 60    | The 13-stage rail teaches the process well; still its best property                                                                             |
| Clicks to complete       | 40    | A full project walk is ~13 advances plus data entry — reasonable. Creating a quote or issuing an invoice in the _workspace_ is still impossible |
| Navigation               | 30    | Rail navigation is good; the workspace's records remain disconnected lists                                                                      |
| Information architecture | 40    | Widgets now sit where the work happens. The forecast/actual distinction is unmarked (M3)                                                        |
| Overall efficiency       | 40    | Held back by the double entry, not by the interface                                                                                             |

What improved: I could not produce a document without the data behind it, and when I was
blocked the system said why in plain language. What has not: the moment I finish the
journey I have to type it all again into the ERP.

---

## Scalability review

Unchanged and architectural. The dataset is one JSON blob in browser IndexedDB,
re-serialised on a 140 ms debounce, no server, no auth, no concurrency.

| Scenario                  | Verdict                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- |
| 10 projects               | Fine                                                                                    |
| 100 projects              | Degraded — unbounded unsorted lists, no search, whole state re-serialised per keystroke |
| 1,000 projects            | Not viable — multi-megabyte blob on a debounce; `resourceConflicts()` is O(n²)          |
| Multiple offices          | **Impossible** — data lives in one browser profile                                      |
| Multiple project managers | **Impossible** — no shared store, no auth, no concurrency                               |
| Multiple warehouses       | **Impossible** — no stock model                                                         |
| International             | **Not supported** — single currency and single tax jurisdiction throughout              |

The 13 stages could be perfect and none of this would change. It is a backend question.

---

## Overall recommendations

### Must implement immediately

| #   | Recommendation                                                     | Impact | Effort | ROI                                         | Priority |
| --- | ------------------------------------------------------------------ | ------ | ------ | ------------------------------------------- | -------- |
| 1   | Journey writes through `erp-engine.js`; retire the second database | High   | High   | Very high — unblocks 5 of the 6 automations | 1        |
| 2   | Goods receipt with quantity + three-way match before payment       | High   | High   | High                                        | 2        |
| 3   | Preconditions on `closeProject` (balance, extras, snags)           | High   | Low    | Very high                                   | 3        |
| 4   | Purchase approval threshold                                        | High   | Medium | High                                        | 4        |
| 5   | Reconcile tax-ID validation across both surfaces (M1)              | Medium | Low    | High                                        | 5        |
| 6   | Multi-page PDF, or hard-fail on overflow                           | High   | Medium | High                                        | 6        |

### High-value improvements

Snag list with sign-off · dunning ladder · scheduled notifications · invoice photo capture
UI · bank-feed matching UI · search/filter/sort on every list · cross-record navigation ·
progress valuation with retention · mark forecast figures as forecasts (M3) ·
`visitToBudgetLines` wired (M4).

### Nice to have

RFQ workflow · capacity and milestone planning · NPS survey · referral tracking · lessons
learned feeding catalogue prices · risk register · equipment register · project archiving.

---

## Verification

- `node tests/site-e2e/run.mjs` — **47/47**, including: blank intake refused, rail cannot
  bypass the intake gate, a missing required field blocks Advance, per-chapter variance has
  more than one distinct value, a part payment redraws the body, reload resumes mid-journey.
- `node tests/simulation/manageability-sim.mjs` — **45/45**
- `node tests/simulation/year-sim.mjs` — **145/145**, and **206/206** at 24 months × 2/month
- `pnpm boundaries` — clean

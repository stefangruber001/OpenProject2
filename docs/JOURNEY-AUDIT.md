# End-to-end journey audit — 13 stages, walked as an employee

**Method.** Every finding below is anchored to `file:line` in the code as it stood at the
start of this audit. Where a claim in the UI copy contradicts the code, both are quoted.
Nothing here is inferred from documentation — `REQUIREMENTS-TRACE.md` and
`MANAGEABILITY.md` both turned out to advertise behaviour that did not work.

**Scope.** `site/journey.html` (the 13 stages), `site/erp.html` (the workspace an employee
would use daily), `site/erp-engine.js` (the transactional core).

**Status markers.** `[FIXED]` — corrected in this pass, with a test. `[OPEN]` — real, not
yet built. `[FEATURE]` — genuinely missing capability, costed in the roadmap.

---

## Executive summary

**Overall ERP quality score: 34 / 100.**

That number needs its parts, because they diverge sharply:

| Layer                                                  | Score | Why                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transaction engine (`erp-engine.js`)                   | 72    | Genuinely strong. 154 methods, immutable issued documents, hash-chained invoice events, gap-free per-year numbering, effective-dated worker rates, VAT/withholding, quarterly accounting hand-off, a 15-family alert rules engine. This is real ERP depth, not a mock. |
| Workspace UI (`erp.html`)                              | 22    | 94% read-only. An employee cannot create a quote, issue an invoice, sign a contract, open a project, enter a supplier bill, log hours or capture a document. All of it exists in the engine; none of it has a screen.                                                  |
| The 13-stage journey (`journey.html`)                  | 25    | A narrated demo. The numbers are multipliers of the budget, not consequences of the data entered. Seven captured fields feed nothing. There is no gate on any stage.                                                                                                   |
| Cross-cutting (notifications, approvals, roles, scale) | 15    | No notifications of any kind, no approval workflow beyond change orders, no role or permission model, single-user browser storage.                                                                                                                                     |

**The single most consequential finding:** the journey and the ERP are two different
applications. `journey.html` loads only `i18n-dict.js` and `i18n.js` (`:211-212`) — never
`erp-engine.js` — and opens its own database `caneiJourney` (`:444`) while the ERP uses
`caneiERP` (`erp-store.js:28`). Nothing entered across the 13 stages ever reaches the ERP.
Every customer, address, tax ID, quote line and invoice is typed twice, and the invoice the
journey produces is not the invoice the accountant sees.

**Second:** the brief's own process model has 47 discrete steps across Procurement,
Planning, Execution and Closing. The journey has four stages for them. Procurement's ten
steps (material list → RFQ → compare → select → approve → PO → track → receipt → shortfalls
→ returns) are a single screen with three text boxes.

**Would I run a €60k renovation through this today?** No. I would lose the audit trail
between quote and invoice, I could not raise a purchase order anyone had approved, and I
would have no record of what was actually delivered to site.

---

## Per-stage review

Format per the brief: objective, required inputs, validation, business logic, employee
mistakes, missing automation, UX, risk, improvements.

### Stage 1 — Lead (`FLOW[0]`, `journey.html:869-871`)

**Objective.** Capture an enquiry so it is not lost on a scrap of paper, and open a
pipeline entry with a next action.

**Required inputs.** Collected: `source`, `enquiry`, `targetBudget` (`FIELDS[0]:947-949`).
Intake collects name, tax ID, email, phone, address (`:1243-1247`).
**Missing:** who took the call and when (there is no timestamp on the lead, so
"how fast do we respond to enquiries?" is unanswerable); property type and access; whether
the caller is the decision-maker; consent to be contacted — a GDPR requirement for a
private individual's phone and email, with no basis recorded anywhere.

**Validation.** Four rules, all at `startJourney()` (`:1291-1303`): non-empty customer
name, ≥1 chapter with a budget, valid NIF/CIF, valid email. Real mod-23 checksum for
DNI/NIE (`:363-370`). **`[OPEN]` The CIF control digit is not verified** — `:368` returns
`true` on structure alone, and the comment admits it. Nothing validates phone or address.

**`[FIXED]` The gate is bypassable.** At boot `reached = 0` while `step = -1` (`:454-455`),
so the "STEP 1 · Lead" rail pill is already clickable (`:833`). `goToStage(0)` runs
`while(step<0) advance()` (`:840-844`), entering the journey with **no name, no tax ID and
no email**. Every downstream document then carries blanks.

**Business logic.** A lead should be deduplicated against existing customers, assigned an
owner, and given a dated next action. The engine has `findDuplicateParty` (`erp-engine.js:357`)
matching on tax ID, accent-normalised name and mobile — **the journey does not call it, and
neither does the ERP's own new-customer form** (`erp.html:702`).

**Employee mistakes.** Creating a second record for a repeat customer (no duplicate check).
Typing a tax ID that passes the structural CIF test but is not real. Recording an enquiry
against the wrong address when a customer has two properties.

**Missing automation.** `[FEATURE]` Auto-acknowledge the enquiry by email within the hour —
the single highest-conversion action in this trade and it is entirely manual. `[FEATURE]`
Auto-create the "book a site visit" task; the engine has `addTask` (`:2368`) and
**nothing in the engine ever calls it**.

**UX.** One screen, three fields, acceptable. The lead source list (`:947`) has no
"Referral from" free-text, so referral attribution — the main marketing signal for a
reformas business — is lost at the point of capture.

**Risk.** Low financial, medium commercial: unattributed leads mean marketing spend cannot
be judged. GDPR exposure is real and unaddressed.

**Improvements.** (1) Call `findDuplicateParty` on blur of the name/tax-ID field and show a
"possible match" chip. (2) Timestamp the lead and record the taker. (3) Add referral
source. (4) Record consent basis.

---

### Stage 2 — Site visit (`FLOW[1]`, `:872-875`)

**Objective.** Capture measurements, notes and photos on the phone so the estimate is built
from evidence rather than memory.

**Required inputs.** `visitDate`, `areaM2`, `access` (`FIELDS[1]:950-952`), plus free-text
visit notes from the intake and photos.
**Missing:** room-by-room measurements (a single `areaM2` cannot price a four-room
renovation); existing condition and what is being demolished; services present (where is
the stopcock, is the wiring aluminium); who was present; parking and lift constraints as
structured data rather than one text box — these drive labour cost and are the most common
source of underpricing.

**Validation.** None. `areaM2` accepts negative numbers, zero, and text (`num()` at
`:353-361` silently returns `0`). A visit dated before the enquiry is accepted.

**Business logic.** This is the only stage with real camera capture
(`accept="image/*" capture="environment"`, `:1361`), images downscaled to 1400 px at JPEG
0.82 (`:486-498`). That part is well built. But the visit produces a `.txt` file
(`:875`) — it does not produce measurements the estimator can consume. The engine has
`addVisit` (`:490`) storing measurements and draft lines, and `visitToBudgetLines`
(`:2634`) converting them into budget lines "without retyping". `[OPEN]` The journey uses
neither, so the measurement is re-typed into the estimator at stage 3.

**Employee mistakes.** Photographing the wrong flat. Recording area in ft². Forgetting to
note the access constraint that later adds two days of hand-carrying.

**Missing automation.** `[FEATURE]` Photo→measurement extraction. `[FEATURE]` Auto-file
photos against the room they belong to. `[FEATURE]` A visit checklist that cannot be
completed until services, access and condition are recorded.

**UX.** Good on a phone. The photo control is the best-executed piece of the journey.
`[OPEN]` Persistence errors are swallowed (`:460` `.catch(()=>{})`), so an IndexedDB quota
failure from a dozen site photos looks exactly like success — the employee drives home
believing the evidence is saved.

**Risk.** High. Mis-measurement is the primary cause of margin loss in renovation. A single
un-noted access constraint routinely costs 5–10% of a small project's margin.

**Improvements.** (1) Structured per-room measurement rows. (2) Feed them to the estimator
via `addVisit` + `visitToBudgetLines` instead of a text file. (3) Surface storage failures.
(4) Mandatory services/access checklist.

---

### Stage 3 — Estimate (`FLOW[2]`, `:876-879`)

**Objective.** An order-of-magnitude figure to align with the customer before investing in
a detailed quote.

**Required inputs.** **`[OPEN]` `FIELDS` has no key `2`** — this is the only stage of 13
that collects no step data at all (`:947-977`), so `renderFields` returns early (`:1002`)
and no `details.txt` is written. There is a real estimator widget (`:1022-1072`) with a
34-item catalogue across 10 chapters (`:374-409`), quantity/rate rows and a contingency
percentage defaulting to 10%.

**Validation.** One check: at least one line with a description and a rate > 0
(`:1063-1064`). Invalid rows are **silently dropped** by the filter — the employee is not
told which line was discarded.

**Business logic.** The estimate is `est` to `est × 1.15` (`:878`), a flat 15% band
regardless of contingency entered or job type. `[OPEN]` The estimator's own contingency
field (`:1035`) does not drive that band. Pressing "→ Use as the quote" (`:1062-1070`)
writes a detailed `estimate.txt`; pressing Advance afterwards **overwrites it with the
three-line summary version** (`:879`), because `art()` replaces by filename (`:470-475`).
The employee loses the itemised estimate by continuing.

**Employee mistakes.** Quoting the bottom of the range verbally, then discovering the
detailed quote lands at the top. Losing the detailed estimate by pressing Advance.

**Missing automation.** `[FEATURE]` Derive the estimate band from historical
quoted-vs-actual variance by chapter — the data exists (`chapterEconomics:2103`,
`hoursComparison:2906`) and nothing feeds it back. `[FEATURE]` Auto-expire the estimate.

**UX.** The estimator is the second-best-built widget in the page. It is undermined by the
overwrite and by the missing per-stage fields.

**Risk.** Medium-high. A verbal estimate is commercially binding in practice even when not
legally so; a 15% band on a €60k job is a €9k conversation.

**Improvements.** (1) Stop Advance overwriting the detailed file. (2) Drive the band from
the entered contingency. (3) Add `FIELDS[2]` (estimator, valid-until, basis).

---

### Stage 4 — Quotation (`FLOW[3]`, `:880-887`)

**Objective.** The detailed, catalogue-first quote and its PDF.

**Required inputs.** `validityDays` (default 30), `clientNote` (`FIELDS[3]:953-954`), plus
the quote builder's line rows (`:1075-1126`).
**Missing:** payment terms and deposit on the quote itself; exclusions (what is _not_
included is the single most disputed part of a renovation quote); assumptions; lead time;
who prepared and who approved it.

**Validation.** One check: ≥1 line with concept, qty and price (`:1117-1118`), again
dropping invalid rows silently. No margin check. The engine's `validateBudget`
(`erp-engine.js:854`) — which blocks on zero quantity, zero price and **negative chapter
margin**, and warns on cost > price — is not used.

**`[FIXED]` `clientNote` is dead.** Its label says "shown on the quote" (`:954`). It is
written to `details.txt` and nothing else; `quoteDoc`'s notes are hardcoded (`:789-792`).

**Business logic.** Optional works are listed separately so they do not inflate the
headline (`:883`) — correct and well judged. **`[OPEN]` There is no internal approval
step.** Anyone can issue any quote at any margin. The brief asks for internal approval; the
engine has no approver concept and no discount authority.

**Employee mistakes.** Quoting below cost — nothing warns. Omitting exclusions. Sending a
quote whose validity has already lapsed.

**Missing automation.** `[FEATURE]` Margin guard-rail before send. `[FEATURE]` Auto-chase
an unanswered quote at day 3/7/14 — currently the employee must remember. `[FEATURE]`
Expiry warning; the engine has the alert (`:2444`) but the journey never sees it.

**UX.** `[OPEN]` The PDF writer is single-page only (`:733`); a quote that runs past the
bottom of A4 is written at negative Y and **silently lost**. A 20-line bathroom quote is
fine; a full-flat renovation is not.

**Risk.** High. Silent PDF truncation sends a customer a quote missing its last chapters.
No margin check risks selling work at a loss.

**Improvements.** (1) Multi-page PDF, or a hard error when content overflows. (2) Wire
`validateBudget` in before issue. (3) Exclusions and assumptions blocks. (4) Internal
approval above a threshold.

---

### Stage 5 — Acceptance (`FLOW[4]`, `:888-894`)

**Objective.** Freeze the accepted version and produce the acceptance email with the signed
quote attached.

**Required inputs.** `acceptanceDate`, `acceptanceMethod` (Signed/Email/Verbal),
`depositPct` (`FIELDS[4]:955-957`).
**Missing:** the acceptance evidence itself. The engine's `acceptVersion` takes an
`evidenceRef` (`:1008`); the journey records only a method dropdown. "Verbal" with no
evidence is a dispute waiting to happen.

**Validation.** None. `depositPct` accepts 900.

**`[FIXED]` `depositPct` is dead data.** Nothing reads it. At stage 9 the "Deposit" invoice
type changes only the PDF title (`:759`) and still bills 100% of revenue.

**Business logic.** `[OPEN]` The page claims "the accepted version is frozen" (`:891`) and
the version genuinely is — but the _baseline_ it feeds is not (see stage 6).

**Employee mistakes.** Marking "Signed" when only an email exists. Agreeing a deposit
verbally that never appears on an invoice.

**Missing automation.** `[FEATURE]` Generate the deposit invoice automatically on
acceptance — this is the company's cash-flow moment and it is entirely manual.
`[FEATURE]` Create the contract from the accepted version; the engine has
`createContract` (`:1032`) and neither surface calls it.

**UX.** The email preview with an Outlook draft export (`.eml`, `X-Unsent:1`, `:795-807`)
is well made. `[OPEN]` "Send" is a label change and a log line (`:1349`) — nothing leaves
the browser, and the button does not say so. An employee will believe the customer was
emailed.

**Risk.** High. A "sent" email that was never sent is the worst kind of silent failure.

**Improvements.** (1) Relabel Send until a real transport exists. (2) Capture acceptance
evidence. (3) Auto-raise the deposit invoice from `depositPct`.

---

### Stage 6 — Project (`FLOW[5]`, `:895-898`)

**Objective.** Turn the accepted quote into a project with an immutable baseline.

**Required inputs.** `startDate`, `plannedEnd`, `projectManager` (`FIELDS[5]:958-960`),
plus an auto-seeded Gantt (`:1129-1171`).
**Missing:** the entire Planning phase the brief describes. No resource planning, no team
allocation, no equipment, no risk review, no milestone planning. `projectManager` is a free
text box, not a person record.

**Validation.** None. `plannedEnd` before `startDate` is accepted; the Gantt silently drops
such rows from the chart (`:1159`) without telling anyone.

**`[FIXED]` The "immutable baseline" is not immutable.** `S.baseline` is assigned inside
the render function (`:895`), so every backward navigation to stage 6 **recomputes it from
the current chapters**. The one number the whole margin calculation is measured against
moves. (The engine does this correctly — `createProjectFromAcceptance` uses `Object.freeze`
at `:1153`.)

**`[FIXED]` The Gantt is never saved to the project folder** — `renderScheduler` contains no
`art()` call, so the schedule exists only in `stageData` and appears in no export.

**Business logic.** `[FEATURE]` Milestone planning is structurally absent from the engine
too: `milestones: []` is initialised (`erp-engine.js:1187`) and **never written by any
method**. There is no `addMilestone`.

**Employee mistakes.** Assigning a PM who is already committed elsewhere — `resourceConflicts`
(`:2852`) exists and nothing calls it. Promising a start date with no capacity check.

**Missing automation.** `[FEATURE]` Capacity-aware scheduling. `[FEATURE]` Auto-generate
the requirements checklist (permits, safety docs, access) — `addProjectRequirement`
(`:2821`) exists with no UI.

**UX.** Auto-seeding tasks from chapters in 5-day blocks (`:1131-1135`) is a nice touch.

**Risk.** High. A moving baseline makes every margin figure downstream untrustworthy.

**Improvements.** (1) Freeze the baseline once. (2) Persist the schedule. (3) Validate date
order. (4) Surface `resourceConflicts`.

---

### Stage 7 — Purchasing (`FLOW[6]`, `:899-903`)

**Objective.** Raise purchase orders and commit cost against chapter budgets.

**Required inputs.** `supplier`, `poNumber`, `deliveryDate` (`FIELDS[6]:961-963`).
**Missing:** everything else in procurement. No material list, no quantities, no unit
prices, no RFQ, no supplier comparison, no approval, no delivery tracking, no goods
receipt, no shortfall handling, no returns. The brief lists ten steps; this is three text
boxes.

**Validation.** None.

**`[FIXED]` Committed cost is fiction.** `c.committed = Math.round(c.budget * S.committedPct)`
(`:899`), where `committedPct` is derived from the cost-percentage typed at intake
(`:434`). The supplier and PO number the employee just entered **are not referenced by that
line**. Every chapter shows committed cost at an identical percentage of budget, which is
exactly what never happens on a real job.

**Business logic.** The engine is much stronger here — `addPurchase` (`:1359`),
`committedCostCents` net of returns (`:1399`), `comparePrices` across suppliers (`:611`),
`compareBudgetCosts` (`:2752`), `supplierRanking` weighted 60/30/10 (`:2705`). None of it
is reachable from either UI.

**`[FEATURE]` Three-way match does not exist.** Delivery is a single boolean
(`erp-engine.js:1377`); there is no quantity received, no line-level receipt, no receiving
inspection. PO↔bill linkage is a loose `orderRef` string match (`:1709`). `recordReturn`
(`:1393`) is amount-only — no quantity, no reason, no supplier credit note.
**`[FEATURE]` Purchase approval does not exist**: `addPurchase` sets `status.ordered = true`
immediately (`:1376`), with no requester, approver, threshold or budget check. The `urgent`
flag (`:1384`) is decorative.

**Employee mistakes.** Ordering against the wrong chapter. Ordering twice because there is
no visibility of what is on order. Paying for goods that never arrived — nothing records
receipt.

**Missing automation.** `[FEATURE]` RFQ to three suppliers from the material list.
`[FEATURE]` Auto-PO from the accepted quote's material lines. `[FEATURE]` Delivery-date
chasing.

**UX.** A three-field screen standing in for the company's entire buying process.

**Risk.** **Highest of any stage.** Materials are typically 40–55% of cost in this trade.
No approval, no receipt, no matching means invoice fraud and over-delivery are undetectable,
and committed cost — the number that warns you a job is going over — is invented.

**Improvements.** (1) Real PO lines with quantity and price. (2) Goods receipt with
quantity. (3) Three-way match before a bill can be paid. (4) Purchase approval threshold.
(5) RFQ and comparison, reusing `comparePrices`.

---

### Stage 8 — Execution (`FLOW[7]`, `:904-909`)

**Objective.** Book supplier bills as actual cost and watch quoted-vs-actual per chapter.

**Required inputs.** `billNumber`, `billDate`, `progressPct` (`FIELDS[7]:964-966`), plus
change orders (`:1175-1203`).
**Missing:** the whole Execution phase. No daily work log, no time tracking, no material
consumption, no customer approvals on site, no site documentation beyond stage 2's photos,
no quality inspection, no defect management.

**Validation.** None. `progressPct` accepts −50 and 500.

**`[FIXED]` Actual cost is fiction, and the bills are invented.**
`c.actual = Math.round(c.budget * S.actualPct)` (`:904`), and the supplier bills are
synthesised as `{s: "Supplier " + (i+1), n: "B-" + (1040+i)}` (`:905`). The `billNumber` the
employee typed is written to `details.txt` and **never appears in the bill list**
(`:909`). The variance table — the page's headline "margin-leak early-warning" — compares a
budget against a fixed percentage of itself, so **every chapter always shows the same
variance percentage**.

**`[FIXED]` The page claims "duplicates are rejected" (`:907`). There is no duplicate check
in the journey at all.** The engine does have one (`registerBill:1665`).

**`[FIXED]` Change orders entered here never reach the invoice.** `total()` (`:1184-1187`)
updates `S.variations` and the ledger, but `S.revenue` is set only inside `FLOW[8].body()`
(`:910`) — so a variation added after stage 9 has been rendered is invisible to the invoice
and its PDF.

**Business logic.** `[FEATURE]` No quality inspection, snagging or defect list exists
anywhere in the engine — searched and absent. The nearest thing is an `incident` boolean on
a diary entry (`:2875`). For a renovation company, the snag list _is_ the end of the job.

**Employee mistakes.** Booking a bill to the wrong project. Missing a variation and never
billing it — the most common source of lost revenue in this trade. Marking 80% progress
when the tiling has not started.

**Missing automation.** `[FEATURE]` Photo→invoice capture (the pipeline exists in the
engine at `captureDocument:1408` with **no UI on either surface**). `[FEATURE]` Alert when
actual exceeds committed on a chapter. `[FEATURE]` Prompt for a variation when a bill
exceeds its chapter budget.

**UX.** The change-order widget rewrites its artifact **on every keystroke** (`:1184-1187`)
— wasteful, and it means a half-typed amount is briefly the persisted truth.

**Risk.** **Highest financial risk alongside stage 7.** Unbilled variations and untracked
actual cost are how a profitable job becomes a loss without anyone noticing until close.

**Improvements.** (1) Bills from entered data. (2) Actual cost as the sum of real bills.
(3) Daily log and time tracking. (4) Snag list. (5) Wire `captureDocument` to a camera.

---

### Stage 9 — Invoicing (`FLOW[8]`, `:910-922`)

**Objective.** Issue the invoice from the accepted quote, with correct VAT and a legally
compliant document.

**Required inputs.** `invoiceDate`, `invoiceType` (Full/Deposit/Certification), `irpfPct`
(`FIELDS[8]:967-969`). This is the **only stage where editing a field regenerates the
document** (`:1011` → `regenInvoice:1015-1019`) — the right behaviour, present once.

**Validation.** `[FIXED]` `irpfPct` is floored at 0 but **not capped** (`:756`). Entering
500 produces a **negative "Total a pagar"** (`:765`) — an invoice that pays the customer.

**Business logic.** Reduced VAT with the legal basis recorded on the document
(art. 91.Uno.2.10º, `:911`, `:771-774`) is correctly handled and genuinely well done.
`[FIXED]` "Deposit" and "Certification" change only the PDF title (`:759`); both still bill
100% of revenue. The `depositPct` agreed at stage 5 is never applied.

**`[FEATURE]` Progress billing is not real.** `issueInvoice` takes `baseCents` as an input
(`erp-engine.js:1478`); nothing derives it from `projectProgressPct` (`:1263`), which exists
and is documented as feeding progress invoicing. There is no interim valuation, no
re-measure, no cumulative-vs-previously-certified arithmetic, and **no retention** —
`retentionHeldCents` is read at `:2980` and never written by any method.

**Employee mistakes.** Over-billing past the contract value — nothing prevents it. Applying
the reduced VAT rate where conditions are not met. Invoicing before the contract is signed
(the engine blocks this at `:1489`; the journey does not).

**Missing automation.** `[FEATURE]` Derive the invoice from certified progress. `[FEATURE]`
Auto-invoice on contract milestones — installments exist (`:1099`) with triggers, and
nothing fires them.

**UX.** Good. Live regeneration is the one place the page behaves like software rather than
a slideshow.

**Risk.** **Legal and financial.** A negative-total invoice, a silently truncated PDF, and
an invoice numbered outside the engine's gap-free series are each independently a problem
in a tax inspection.

**Improvements.** (1) Cap withholding. (2) Make Deposit bill the deposit. (3) Issue through
`issueInvoice` so numbering and the hash chain apply. (4) Over-billing guard.

---

### Stage 10 — Collections (`FLOW[9]`, `:923-927`)

**Objective.** Record the receipt and allocate it to the invoice.

**Required inputs.** `paymentDate`, `paymentMethod` (`FIELDS[9]:970-971`).
**Missing: the amount.** There is no amount field.

**`[FIXED]` The page claims "partial payments are first-class" (`:924`) and then hardcodes
`S.collected = S.revenue + vat` (`:923`) — always exactly 100%, with "Outstanding: €0" and
a "paid" chip printed as literals.** Partial payment, the normal case in renovation, cannot
be represented. The engine supports it properly (`recordCollection:1576` with per-invoice
allocations and an on-account remainder).

**Validation.** None possible — there is nothing to validate.

**Business logic.** `[FEATURE]` No dunning ladder. Overdue _detection_ is good
(`receivables:1613`, `alerts:2389`), but there are no reminder stages, no escalation, no
promise-to-pay, no dunning history, and **late-payment interest is stored and never
calculated** (`penalties.latePaymentInterestPctYear:1068` is written at contract creation
and read nowhere).

**Employee mistakes.** Recording a payment that did not clear. Allocating to the wrong
invoice. Believing the reminder email was sent.

**Missing automation.** `[FEATURE]` Bank-feed matching (`matchMovement:1865` exists,
unreachable). `[FEATURE]` Automatic reminder at +3/+15/+30 days.

**UX.** A reminder email is drafted at the same moment the invoice is marked fully paid
(`:927`) — the two contradict each other on one screen.

**Risk.** High. Cash collection is the difference between a profitable company and an
insolvent one; this stage cannot record reality.

**Improvements.** (1) Amount + partial allocation. (2) Dunning stages. (3) Bank matching.

---

### Stage 11 — Supplier payments (`FLOW[10]`, `:928-931`)

**Objective.** Pay booked bills and show cash out against cash in.

**Required inputs.** `supPaymentDate`, `supPaymentMethod` (`FIELDS[10]:972-973`). No amount
— `S.supplierPaid = actual()` (`:928`), always everything.

**Validation.** None.

**Business logic.** `[FEATURE]` No approval before payment, no payment run, no remittance
advice, no early-settlement discount handling. The engine's `payBills` (`:1731`) correctly
supports one payment across several bills with partial amounts; the journey pays
everything at once.

**Employee mistakes.** Paying a disputed bill — the engine has a `disputed` status
(`:1691`) with **no setter method**, so nothing can ever mark a bill disputed.

**Missing automation.** `[FEATURE]` Payment proposal by due date within a cash limit.

**UX.** Two fields, no amount, no selection of which bills to pay.

**Risk.** Medium-high. Paying before verifying receipt (stage 7 has no receipt) is how
companies pay for goods twice.

**Improvements.** (1) Bill selection and partial amounts. (2) A `disputeBill` method.
(3) Payment approval.

---

### Stage 12 — Close · profit (`FLOW[11]`, `:932-939`)

**Objective.** Close with the truth: not turnover, profitability.

**Required inputs.** `actualEnd`, `closeNotes` (`FIELDS[11]:974-975`).
**Missing:** the entire Closing phase — final inspection, customer sign-off, warranty
documents, lessons learned, archiving. `closeNotes` is a single text box standing in for
lessons learned, and it is written only to `details.txt`.

**Validation.** None.

**Business logic.** The chapter variance table is the right report. It is computed from
fabricated actuals (stage 8), so it is precise about nothing.

**`[FEATURE]` `closeProject` (`erp-engine.js:2183`) has no preconditions of any kind** — no
progress check, no snag clearance, no unapproved-extras check, no outstanding-balance
check, no customer acceptance. A project can be closed with €20k unbilled and a full snag
list. Customer acceptance exists only at _quote_ stage (`acceptVersion:1008`); there is no
completion acceptance protocol, no handover certificate, and no warranty document
generation — guarantees are tracked (`:1074`, clocks started at `:2193`) but nothing
produces the certificate the customer is entitled to.

**Employee mistakes.** Closing before the final invoice. Closing with extras unbilled —
`extrasRegister` exposes `unapprovedValueCents` (`:1351`) and nothing checks it at close.

**Missing automation.** `[FEATURE]` Block close on unbilled extras, open snags or
outstanding balance. `[FEATURE]` Generate the warranty pack. `[FEATURE]` Feed
quoted-vs-actual back into catalogue pricing — the data exists and the loop is not closed.

**Risk.** High. Closing is where money is left on the table permanently.

**Improvements.** (1) Preconditions on close. (2) Sign-off protocol with signature.
(3) Warranty certificate. (4) Structured lessons learned feeding the catalogue.

---

### Stage 13 — Review request (`FLOW[12]`, `:940-942`)

**Objective.** Ask for a review while goodwill is fresh.

**Required inputs.** `reviewPlatform` (Google/Trustpilot/Houzz/Facebook), `sendDate`
(`FIELDS[12]:976-977`).

**`[FIXED]` `reviewPlatform` is dead data.** The CTA is hardcoded to
`"★ Dejar una reseña en Google"` (`:592`) and the link is `href="#"` (`:599`). Choosing
Trustpilot changes nothing, and the button goes nowhere on any platform.

**Business logic.** `[FEATURE]` No satisfaction survey and no NPS. `addFeedback`
(`erp-engine.js:2603`) accepts a manual `satisfaction` rating — there is no questionnaire,
no dispatch, no response tracking, no aggregate customer score. Suppliers are scored
(`supplierRanking:2705`); customers are not. `[FEATURE]` No referral request or
attribution: `referrer` exists only as an inbound lead source (`:79`).

**Employee mistakes.** Sending the review request before the snags are closed — nothing
checks, because there are no snags to check.

**Missing automation.** `[FEATURE]` Trigger on close + N days, conditional on no open
complaint. `[FEATURE]` Route unhappy responses to a recovery workflow instead of a public
review page.

**Risk.** Low financially, high commercially — reviews are the primary acquisition channel
for this trade, and asking an unhappy customer for a public review is actively harmful.

**Improvements.** (1) Generate the real platform URL. (2) Gate on satisfaction. (3) Add the
referral ask.

---

## Critical issues, ranked

| #   | Issue                                                                                                                                      | Evidence                                                                    | Impact                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| C1  | Journey and ERP are separate apps with separate databases; all data typed twice, and the journey's invoice is not the accountant's invoice | `journey.html:211-212`, `:444` vs `erp-store.js:28`                         | Duplicate work on every job; no audit trail from quote to invoice                               |
| C2  | An employee cannot issue an invoice, create a quote, sign a contract, open a project or enter a supplier bill through the workspace UI     | 114 of 154 engine methods have no UI; `erp.html` mutates via 9 methods only | The business cannot be operated through the product                                             |
| C3  | Committed and actual cost are multipliers of budget, not real transactions                                                                 | `journey.html:899`, `:904-905`                                              | The margin-leak warning warns of nothing; variance is mathematically identical on every chapter |
| C4  | No gate on any stage; the one validation gate is bypassable                                                                                | `:1380-1386`, `:840-844`, `:455`                                            | Complete documents produced from empty data                                                     |
| C5  | Procurement has no approval, no goods receipt and no three-way match                                                                       | `erp-engine.js:1376`, `:1377`, `:1709`                                      | Materials are 40–55% of cost with no control; invoice fraud undetectable                        |
| C6  | Withholding uncapped → negative invoice totals                                                                                             | `journey.html:756`, `:765`                                                  | Legally defective document                                                                      |
| C7  | PDF is single-page; overflow is silently discarded                                                                                         | `:733`                                                                      | Customers receive quotes and invoices missing content                                           |
| C8  | "Send" sends nothing but says it did                                                                                                       | `:1349`                                                                     | Employee believes a customer was contacted                                                      |
| C9  | The "immutable baseline" is recomputed on back-navigation                                                                                  | `:895`                                                                      | Every margin figure is measured against a moving target                                         |
| C10 | Partial payment cannot be recorded; collection is hardcoded to 100%                                                                        | `:923-924`                                                                  | The AR position is fiction                                                                      |
| C11 | `closeProject` has no preconditions                                                                                                        | `erp-engine.js:2183`                                                        | Projects close with unbilled extras and open balances                                           |
| C12 | No notifications, reminders or scheduled actions of any kind; `addTask` is never called by the engine                                      | pull-only `alerts()`, `:2368`                                               | Nothing chases anything; the system is entirely reactive                                        |
| C13 | Seven engine correction paths could never succeed while being documented as working                                                        | `MANAGEABILITY.md` vs engine                                                | **Fixed this pass**                                                                             |

## Medium issues

- No search, filter, sort or pagination on any of the 14 workspace views; every list renders
  unbounded (`erp.html:389`, `:500`, `:545`).
- Records are disconnected: from a project you cannot reach its budget, contract or invoices,
  though `projectDrawer` holds `budgetId` (`erp.html:754`).
- Money buttons are all-or-nothing and fire with no confirmation (`erp.html:506`, `:528`).
- Duplicate customer detection exists and is called by neither surface (`erp-engine.js:357`).
- `num()` coerces bad input to `0` silently (`journey.html:353-361`); HTML5 `min`/`max` never
  fire because the intake form has no submit path (`:1266-1268`).
- Nothing survives a reload except files; restarting wipes the operator's stage data
  (`:1401`, `:1299`).
- Stage 2 (Estimate) collects no step data at all.
- Site-visit measurements are re-typed into the estimator; `visitToBudgetLines` (`:2634`) exists.
- `disputed` bill status has no setter (`erp-engine.js:1691`).
- `state.clauseBlocks` is read and never written — contract clause versioning is inert.
- `resourceConflicts()` is O(n²) with no date pre-filter (`:2852`).
- Persistence errors are swallowed in both surfaces.

## Minor improvements

Province hardcoded to "Barcelona" on new customers (`erp.html:716`); change-order evidence
filename hardcoded (`erp.html:777`); change-order artifact rewritten on every keystroke
(`journey.html:1184`); ~40 lines of dead code (`buildPdf:625-653`, `quoteLines:555-561`);
CIF control digit unverified (`:368`); Gantt silently drops invalid date rows (`:1159`);
ZIP entries all dated 1980-01-01 (`:510`); `profitability()` documents four groupings and
implements two (`erp-engine.js:2145`).

## Missing features

Ranked by what a renovation business actually needs:

1. **Goods receipt + three-way match** — no quantity received, no line-level receipt.
2. **Purchase approval** — no requester, approver, threshold or budget check.
3. **Quality inspection / snag list** — absent entirely; this is how renovation jobs end.
4. **Completion sign-off + warranty certificate** — guarantees are tracked, no document.
5. **Progress valuation with retention** — `retentionHeldCents` read, never written.
6. **Notifications and scheduled actions** — nothing is ever pushed.
7. **Dunning ladder** — detection without action; interest stored, never calculated.
8. **RFQ** — comparison exists (`comparePrices`, `compareBudgetCosts`); the request does not.
9. **Capacity planning** — allocation exists; hours available, utilisation and levelling do not.
10. **Milestone planning** — `milestones: []` never written; no `addMilestone`.
11. **Satisfaction survey / NPS**, **referral tracking**, **lessons learned**, **archiving**.
12. **Risk register**, **equipment master**, **stock/inventory**.
13. **Roles and permissions** — `user` is a free string used only for audit logging.

## Automation opportunities

Estimated on 24 projects/year, the operating rate the 2-year simulation models.

| Opportunity                        | Mechanism                                                         | Saving                                         |
| ---------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| Journey writes to the engine       | Remove double entry of customer, quote, invoice                   | ~25 min/project → **10 h/yr**                  |
| Invoice photo → extraction         | `captureDocument` + vision; pipeline exists, no UI                | ~6 min/bill × ~7 bills → **17 h/yr**           |
| Auto-PO from accepted quote lines  | Material lines already exist in the budget                        | ~20 min/project → **8 h/yr**                   |
| Bank-feed matching                 | `matchMovement:1865`, `learnMerchantRule:1900` — both unreachable | ~2 h/month → **24 h/yr**                       |
| Dunning ladder                     | Scheduled reminders off `receivables()`                           | ~1.5 h/month → **18 h/yr**, plus DSO reduction |
| Quote chase at day 3/7/14          | Scheduled action on `awaitingResponse`                            | conversion gain, not hours                     |
| Auto deposit invoice on acceptance | `depositPct` → `issueInvoice`                                     | cash-flow timing                               |
| Review request on close + N days   | Gated on no open complaint                                        | acquisition                                    |
| Site measurement → budget lines    | `visitToBudgetLines:2634`, unreachable                            | ~30 min/project → **12 h/yr**                  |

**~90 hours/year** of clerical time, before counting error avoidance. The largest single
prize is not any one of these — it is C1, because every automation above is blocked by the
two-database split.

**Where AI genuinely helps:** invoice/receipt extraction (highest value, pipeline already
shaped for it), photo→measurement at the site visit, and anomaly detection on
quoted-vs-actual by chapter. Not: anything requiring a legal signature or a payment
authorisation.

## User experience review

**Usability score: 28 / 100.**

| Dimension                | Score | Note                                                                                               |
| ------------------------ | ----- | -------------------------------------------------------------------------------------------------- |
| Ease of use              | 35    | What exists is clean and legible; the brand and layout are genuinely good                          |
| Learnability             | 45    | The 13-stage rail teaches the process well — its best property                                     |
| Clicks to complete       | 20    | Creating a customer: 3 clicks, works. Creating a quote: impossible. Issuing an invoice: impossible |
| Navigation               | 25    | Drill-down works from the Torre only, and only downward; below it, lists are disconnected          |
| Information architecture | 30    | Three nav items describe workflows the page does not implement                                     |
| Overall efficiency       | 15    | The primary daily tasks have no interface                                                          |

The interface is not confusing — it is _absent_. An employee who learns it in ten minutes
then discovers that the thing they need to do every day cannot be done here. Copy that
promises capabilities the code lacks ("Fotografía o sube una factura" with no upload
control, `erp.html:471`) actively erodes trust.

## Scalability review

The dataset is one JSON blob in browser IndexedDB, re-serialised on a 140 ms debounce
(`erp-store.js:16-19`). There is no server, no authentication, no concurrency control.

| Scenario                  | Verdict                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 10 projects               | Fine.                                                                                                                                 |
| 100 projects              | Degraded. Unbounded unsorted lists with no search (`erp.html:389`, `:500`, `:545`); the whole state re-serialises on every keystroke. |
| 1,000 projects            | Not viable. Serialising a multi-megabyte blob on a debounce will stall the UI; `resourceConflicts()` is O(n²) (`:2852`).              |
| Multiple offices          | **Impossible.** No server — data lives in one browser profile.                                                                        |
| Multiple project managers | **Impossible.** No shared store, no auth, no roles, no concurrency; two people cannot see the same data.                              |
| Multiple warehouses       | **Impossible.** No stock model at all.                                                                                                |
| International             | **Not supported.** Single currency assumed throughout; tax logic is single-jurisdiction; the ES/EN toggle is presentation only.       |

The ceiling is architectural, not a matter of tuning: **the product is single-user by
construction.** Everything above 100 projects or 1 concurrent user requires a backend with
authentication, a real database and an API — which is precisely what the wider repo's
`packages/` layer is designed to become.

## Overall recommendations

### Tier 1 — must implement immediately

| #   | Recommendation                                                     | Impact | Effort  | ROI                                   | Priority |
| --- | ------------------------------------------------------------------ | ------ | ------- | ------------------------------------- | -------- |
| 1   | Journey writes through `erp-engine.js`; retire the second database | High   | High    | Very high — unblocks every other item | 1        |
| 2   | Gate every stage; close the rail-pill bypass                       | High   | Low     | Very high                             | 2        |
| 3   | Derive committed/actual cost from entered POs and bills            | High   | Medium  | Very high                             | 3        |
| 4   | Cap withholding; fix the negative-total invoice                    | High   | Trivial | Very high                             | 4        |
| 5   | Multi-page PDF, or hard-fail on overflow                           | High   | Medium  | High                                  | 5        |
| 6   | Relabel "Send" until a transport exists                            | Medium | Trivial | High (trust)                          | 6        |
| 7   | Freeze the baseline once                                           | High   | Low     | High                                  | 7        |
| 8   | Goods receipt + three-way match before payment                     | High   | High    | High                                  | 8        |
| 9   | Preconditions on `closeProject`                                    | High   | Low     | High                                  | 9        |

### Tier 2 — high value

Purchase approval threshold · partial payments and collections · snag list with sign-off ·
dunning ladder · search/filter/sort on every list · cross-record navigation · duplicate
check on customer creation · invoice photo capture UI · bank-feed matching UI ·
progress valuation with retention · scheduled notifications.

### Tier 3 — nice to have

RFQ workflow · capacity planning · milestone planning · NPS survey · referral tracking ·
structured lessons learned feeding catalogue prices · risk register · equipment master ·
project archiving.

**Sequencing note.** Tier 1 items 1–3 are one piece of work, not three: once the journey
writes through the engine, gates and real cost derivation come mostly for free, because the
engine already enforces them (`startWorks` blocks on an unsigned contract at `:1240`,
`issueInvoice` blocks the first invoice at `:1489`, `validateBudget` blocks on negative
chapter margin at `:876`). The fastest route to a trustworthy system is not to reimplement
those rules in the journey — it is to stop bypassing the engine that already has them.

# S12 · The last placeholder in the menu

> Context pack. Three admin screens in one session, the reconciliation block
> that is honest about not balancing, and a test probe that ran out of
> subjects and inverted instead of retiring.

## What was wrong

1. **`cash-flow` was the last unbuilt subsección.** `cashForecast()` has
   existed in the engine since the beginning and the Torre has drawn it as a
   sparkline for as long — but a sparkline answers "up or down", and the
   question people ask is «¿cuándo nos quedamos sin dinero, y por culpa de
   qué?»
2. **ADM-04 was a weekly matrix scoped to one project.** §3.2 asks for a day
   sheet with the week beside it, a **Proyecto** column, and a summary tab with
   the monthly reconciliation. None of those existed.
3. **ADM-07 rendered everything at once.** The engine's refusal to send a
   package with unjustified exceptions was already right; what was missing was
   the shape — three steps, with the last one unreachable until the middle one
   is clean.

## What exists now

|                    | Before                          | After                                                       |
| ------------------ | ------------------------------- | ----------------------------------------------------------- |
| ADM-08 Flujo       | a placeholder card              | 240 + 96×n forecast grid, week or month, company or one job |
| ADM-04 Horas       | week matrix, one project        | day sheet + 372 calendar, and a Resumen tab                 |
| Monthly labour     | nothing                         | `labourReconciliation` — booked vs paid, and the difference |
| ADM-07 Gestoría    | one long screen                 | three steps behind a 48 indicator, step 3 gated             |
| Unbuilt subsección | one placeholder, probed by name | none; the e2e walks all 29 and fails on any dead link       |

## ADM-08: a forecast is only useful if you can say what it does not claim

Three choices, each of which changes what the numbers mean:

1. **It opens from the money that is really there** —
   `cashPositionAsOf(yesterday)`, not zero. A cumulative line starting at zero
   answers "what is the net of the next 13 weeks", which is never the question.
2. **Every row is an expectation with a date somebody committed to** — an
   outstanding invoice on its due date, a planned instalment on its expected
   date, an outstanding bill on its due date. Nothing is extrapolated from an
   average, because an average has no due date and cannot be chased.
3. **Anything already overdue lands in the first bucket** rather than being
   dropped for being in the past. A forecast that discards late money gets
   rosier the later you are, and that is the one direction a forecast must
   never drift.

Scoping to one job pro-rates a shared bill by the part of its allocations that
names the job — a bill belongs to several jobs and to none of them entirely.

## ADM-04: the reconciliation that is honest about not balancing

Hours cost is an accrual booked to jobs the day the work happened. Wages are
cash leaving on payday, and they also pay for holidays, sick days, office staff
and the time nobody logged. **These two numbers are not supposed to be equal**,
so the block reports the difference and its share of the wage bill instead of
painting every month red.

The interesting reading is a **negative** difference — more hours booked to
jobs than wages paid. That means a payroll run nobody imported, or hours
fechadas in the wrong month, and both reach a job's margin before anyone
notices.

The day sheet spans every project because §3.2 gives it a **Proyecto** column,
and a column with one possible value is a caption. Approval stays per worker
per week, which is what payroll and the law care about, so the lock button sits
on the worker's row and locks the week containing the selected day.

## ADM-07: the gate moved one screen earlier

Nothing about the rule changed — the engine still refuses a package with
unjustified exceptions, and a justified one still stops blocking. What changed
is when you find out: step three is disabled from the moment you arrive, rather
than discovered at the end when the Export button will not press.

Exceptions are grouped by type rather than listed flat. The same missing NIF on
nine supplier invoices is one job; nine identical rows scattered through a list
is how it gets done nine times or not at all. Each group links to the screen
where that kind is actually fixed — an exception you cannot act on is a
complaint.

## The probe that ran out of subjects

One e2e check has always opened the single not-yet-built subsección and
asserted it explained itself. It moved four times as its subject got built —
Reportes, `units` (S3), `visits` (S4), `petty-cash` (S11) — and S12 built the
last one.

Rather than delete it, it **inverts**: walk every entry in the menu and fail if
any of them lands on the fallback. That is what the old probe was really
protecting, and unlike the old one it scales — it will catch the next screen
that breaks, not just the next one that is missing.

`PLACEHOLDERS` is gone with it. A route that resolves to nothing now says
«Ruta desconocida», because promising a screen nobody planned is a worse lie
than admitting a stale bookmark.

## Verification

Site E2E **314/314** (15 new browser checks) · manageability **225/225** (14
new engine checks) · migrations 48/48 (no schema change — every S12 method
derives) · year 149/149 · import 25/25 · scheduling 30/30 · i18n coverage
(EN 100%, CA ceiling **1303 → 1301**) · site-sync 17/17 · ownership guard ·
bundle safety · lint · boundaries · check-types · unit tests · build ·
`make gates` · `make demo`.

## What S13 inherits

S13 owns **ADM-09 Datos Financieros** — the last screen in the specification.

- **It is the only subsección with an `href`**, not a view: it still opens
  `financial-data.html`, a separate page holding a separate dataset the engine
  has never heard of. That is the same shape the catalogue had before S3, and
  the same fix applies.
- **`accountLedger` was built in S11 for exactly this**, and still has no
  caller. S12 did not need it — ADM-07 reads `packageBlocks`, `vatSummary` and
  `irpfSummary`, none of which go through the chart. ADM-09 is the screen gap
  13 was closed for, and wiring it is the first thing to do.
- **The Plan de Cuentas already exists in that page** (S0's answer to Q6), so
  the work is wiring rather than invention — and the chart of accounts is now
  `state.lists.accounts`, which is where the wiring lands.
- **No schema change is expected.** If one turns out to be needed, the ladder
  is at v15 and every previous session added at most one step.

**Every string S13 adds must ship with Catalan AND a real-browser render
assertion.** That rule has now caught a gap in nine consecutive sessions.

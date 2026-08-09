# S8 · The list stops disappearing, and the plan starts moving the money

> Context pack. What the centre panel had to remember, why the Gantt went
> full screen instead of into a 780 panel, the answer to the money chain's
> item 14 (it was a gap), and what S9 inherits.

## What was wrong

1. **`progress` was still a tab strip.** S1b wrapped Avance and Programación
   in one as a holding measure and said the rewrite was S8's. Two tabs over
   two screens that each kept their own idea of which job you were looking at.
2. **Neither PRY screen had the layout the doc describes.** §3.2 gives both a
   **780 centre panel** with the list compressed to **372** beside it. Nothing
   in the product had that shape; a job opened in a drawer over the list.
3. **A cost could reach a job and stop there.** `chapterEconomics` silently
   skips a bill line with a `projectId` and no `chapterNum`, so the per-capítulo
   table added up to less than the project did and **nothing on screen said
   why**. There was no interface anywhere that wrote `chapterNum` onto a cost.
4. **Money-chain item 14 was a gap, not a claim to confirm.** `cashForecast`
   has always read `installment.expectedDate`. Nothing has ever written it
   after the contract was drawn up.

## What exists now

|                       | Before                        | After                                                          |
| --------------------- | ----------------------------- | -------------------------------------------------------------- |
| `progress`            | two tabs, two screens         | one screen, 372 list + 780 panel, three tabs in the panel      |
| Chapter state         | two buttons in a drawer       | three contiguous 90 px states + a 60 px box, live in one       |
| The Gantt             | a sibling route               | full screen, from the panel's Programación tab                 |
| `economics`           | a flat table under a selector | the same list/panel, three cards, per-capítulo table           |
| Cost with no capítulo | invisible                     | its own block, and a 480 panel that splits it                  |
| Item 14               | unanswered                    | built: the plan proposes, a person applies, the forecast moves |

## The centre panel, and the three things it remembers

Opening a record compresses the list and puts the panel beside it. **The list
never disappears** — that is the rule the whole layout exists for, which is why
this is a grid class rather than a change of screen.

- **Width.** The compressed list does not hide columns with CSS, it does not
  build them. A 372 column containing seven columns is a horizontal scrollbar
  over six nobody can reach.
- **Page.** Free, and worth saying why: the list keeps rendering through
  `renderMasterList`, which has held page state per id since S2. Closing the
  panel is a grid change, not a navigation.
- **Scroll.** Not free. Captured on open, restored on close — opening a record
  on row 40 and closing it back at row 1 is the small constant annoyance the
  doc's sentence is actually about.

`openId` is deliberately not persisted, the same call S1b made for the tab
strips: which record somebody last looked at is not company data.

## Why the Gantt went outside the shell

§3.2 puts Programación in a tab of the panel. §3.1 names the Gantt as one of
**exactly four** surfaces that hide the side menu. Taking the first sentence
literally would have cost the second one — and the feature: an SVG timeline
with drag, resize and linking does not survive being squeezed into 780 px.

So the **tab** states the plan in figures (tasks, projected finish, critical
path, baseline drift, tasks past their date) and opens the **chart** full
screen. `_projectSchedule` became `_ganttBody` and is otherwise untouched, so
nothing about the chart's own behaviour changed in this session — which was
the single largest regression risk on the board when it started.

## Item 14: the answer was no

The document asks whether moving a payment milestone's date moves the expected
cash. Tracing it end to end: `cashForecast` reads
`installment.expectedDate` → written once, when the contract was drawn up →
never again. A job whose plan slipped three weeks kept forecasting the same
money in the same week, **wrong in the optimistic direction**, with nothing on
screen admitting it.

The chain now exists and is split along the layer it belongs to:

| Half                                  | Where                      | Knows about          |
| ------------------------------------- | -------------------------- | -------------------- |
| What the plan says each date would be | `installmentDatesFromPlan` | schedules, not rules |
| Which of them may actually be applied | `setInstallmentDates`      | contracts, not plans |

Two milestones never move, and the reasons are different: an **invoiced** one
is history, and history does not move because a plan did; a **`fixedDate`** one
is what the customer signed, and that is what the trigger's name means.

It is a **button**, not an automatic write. A cash forecast that changes on its
own while somebody is reading it is a forecast they stop trusting. The panel
states every move — from, to, and why not, per milestone — before applying any
of them, and stores `expectedDateSource` beside the date it writes.

## The only place a cost gets a capítulo

`unassignedChapterCosts` is the difference `chapterEconomics` was quietly
dropping, itemised: bills, hours and captured documents that reached the job
and named no chapter. The 480 panel splits one across several — because one
supplier invoice routinely covers three capítulos, and refusing to split it is
how a chapter ends up carrying a bathroom's tiles and a kitchen's.

A **labour** row is the exception: the engine refuses to split it, because it
is one person's hours on one day and dividing it here would be inventing a
second timesheet nobody signed. The panel says so instead of offering a button
that then fails.

The split writes **sibling allocations** rather than editing one in place, so
the amount that reached the project is conserved by construction: the row is
replaced by rows that add up to it.

## What was retired, and what kept its rules

`projectDrawer` is gone. Before deleting it, both things it uniquely carried
were checked — S1b's rule that retiring a screen is not the same as un-testing
an engine:

- **Approving an extra** has always also lived on Modificaciones, which is
  where the e2e drives it.
- **The manual forecast override** had its only interface in the old economics
  table, so «Ajustar» moved into the new per-capítulo table rather than going
  with the screen.

Universal search now opens a job **on PRY-01, in the panel**, rather than in a
drawer over whatever screen the search was used from.

## Decisions worth knowing

- **Both PRY screens share one panel header.** A job that reads differently
  depending on which of two adjacent screens you opened it from is a job
  somebody mis-reads once.
- **A chapter stores no percentage of its own** — `markProgress` writes the
  figure onto its lines — so the box reads back the average of the lines rather
  than a field that does not exist. Rounding once keeps the box and the header's
  progress bar telling the same story.
- **Mobile collapses the strip to the state the row is in**, and a tap on it
  means "next", per §3.2's one-tap cycle. One handler serves both, because the
  only question is which button was pressed and whether the others are on
  screen.

## What S9 inherits

S9 owns COM-04 Contrato and PRY-03 Adicionales.

- **The contrato viewer is the last unbuilt full-screen surface.** PDF 760 wide
  on the left, a fixed 392 panel on the right with three tabs. S7's ADM-02
  screen is the closest shape and the same `.cap2` primitive underneath it.
- **The counter strip (`.counters` + `--cw`) is built** and PRY-03 wants five
  216 px of them.
- **The centre panel is built** and available to any screen that needs it.
- **`installment.expectedDate` now moves**, which COM-04's Hitos de pago tab
  reads: that tab has to show the date, its source and whether it was the plan
  or a person that last set it, or S8's honesty is lost one screen along.

**Every string S9 adds must ship with Catalan AND a real-browser render
assertion.** That rule has now caught a gap in five consecutive sessions.

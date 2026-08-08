# Session 9 — Budget builder + graphic annex (Improvement #1)

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/candi-programme-session-4-07amo8
Spec: intake/diorka/canei-spec-extracted.txt — §3.3, two paragraphs:
  "Disposición del constructor" (the three zones) and the whole
  "Anexo gráfico del presupuesto" block (Improvement #1). Read both; this
  session implements them.
Plan + session index: docs/worklog/WORKLOG.md  (12 sessions; this was #9)

THE CONSTRUCTOR (site/erp.html, VIEWS.presupuestos)
  Presupuestos has two states: the register, and — when a budget is chosen —
  the three-zone constructor. go() rewrites _arg on every navigation, so the
  menu, an alert and a search hit always land on the register while mutate()'s
  re-render keeps the constructor open on what was being edited.

    zone 1  #bTree    chapter/line tree with per-chapter totals; click a
                      chapter to filter the grid, click a line to scroll to it
    zone 2  #bRows    editable grid: code, description, unit, quantity, cost
                      price, sale price, amount, margin, line status, and an
                      INTERNAL picture count
    zone 3  #bTotals  base, tax, withholding, total, cost, margin (€ and %),
                      optional lines, lines pending a price, per m²

  THE VIEW COMPUTES NO MONEY. Every figure comes from erp.budgetTotals() —
  the same function renderBudgetDoc() uses. That is what makes "recalculates
  on every keystroke" true rather than an optimistic copy that drifts from the
  document by a cent and is discovered by a customer.

  Editing: one delegated listener on #bRows. `input` (every keystroke) writes
  through with erp.editLine(..., {audit:false}); `change` (field committed)
  writes the same patch with audit:true. An audit entry per character is a
  trail nobody reads. editLine goes through _editableVersion, so a frozen,
  issued or accepted version refuses the edit — the grid also disables its
  inputs, but the refusal is the engine's.

THE GRAPHIC ANNEX — pictures that never enter the table
  @repo/capability-docs/src/annex.ts   composeAnnex(images, options)
    Ordering (group, then item, NUMERICALLY — 1.10 after 1.9), correlative
    numbering when an item has several pictures, pagination at N per page,
    and markedItems: which rows carry the discreet mark. Pure: it never
    touches bytes and never decides eligibility — it lays out what it is
    handed. Its tests speak of groups and items, never of chapters and lines.
    Options are plain values, NOT a zod schema: see decision 3 below.

  site/erp-bridge.js  ErpBridge.docs.annex(doc) · .annexOptions() ·
    .compressImage(file). The projection reads the RENDERED DOCUMENT, which
    has already dropped the lines that do not print and the images marked
    internal — so the annex can never illustrate a line the customer never
    saw, and nothing is filtered twice.

  site/erp-engine.js  owns what is genuinely its own: image records on a line
    (attach/update/remove/move, all through _editableVersion), the per-budget
    switch (setAnnexOptions), budgetImages(), and issueVersion() snapshotting
    v.annex so a sent document reproduces exactly. renderBudgetDoc drops
    internal-only images beside cost and margin.

  Bytes: ErpStore.putBlob/getBlob under storageKey. Session 3's rule holds —
  binary NEVER enters the state blob, which is re-serialised on a 140 ms
  debounce.

Schema v4 (site/erp-migrations.js): budget.annex defaults, and line.imageRefs
  widened from bare strings to records. Additive and idempotent.

Ownership: 19 engine · 3 factory · 3 unbuilt. budget-graphic-annex -> factory.
  budgets-versions stays engine ON PURPOSE — the constructor is a view.

ENVIRONMENT: Node 22 + pnpm 10. `pnpm install && pnpm lint && pnpm boundaries
&& pnpm check-types && pnpm test && pnpm build`, `make gates`, `make demo`,
`node tests/site-e2e/run.mjs` (77), the five sims under tests/simulation/.
Rebuild the committed bundle after touching a bundled capability:
`pnpm --filter @repo/erp-browser build`.

Next: session 8 is still open (OCR bridge + invoice capture) — it does not
depend on this. Session 10a (Gantt-from-budget, baselines, project economics)
now has both halves it needs: the constructor's line data and the scheduling
capability from sessions 5-6.

Start next by: reading site/erp.html's budgetBuilder/builderRows/builderRecalc
block, then packages/capabilities/docs/src/annex.ts. Between them they are the
whole of this session.
```

## Goal

Per spec §3.3: a constructor with three zones visible at once, and the graphic
annex of Improvement #1 — reference pictures that accompany a quotation
_without altering the reading of the table of lines_.

## What changed

**The constructor** (`site/erp.html`). Tree, grid and totals panel side by
side; the panel recalculates as keys are pressed, chapter subtotals move with
it, and the caret stays where the person left it. The one structural property
that matters: **it computes no money.** Every amount on screen is
`erp.budgetTotals()`, the same call the emitted document makes. A "live" panel
with its own arithmetic is a panel that disagrees with the document eventually,
and the person who finds the disagreement is the customer.

**The graphic annex** (`@repo/capability-docs/src/annex.ts`, new). Pictures
attach to a line and print at the end of the document — after the totals,
before the conditions — grouped and ordered by chapter and line number, each
captioned with its chapter, its line number and a short description, numbered
correlatively when a line has several, N to a page. The line's own row gets a
discreet mark and nothing else, so a row's height never changes because
somebody attached a photograph to it.

The layout is a **capability** because grouping, ordering, numbering and
pagination are generic document composition — its tests speak of groups and
items, never of chapters and lines. What stayed in the engine is what is
genuinely the budget's: the image records, the per-budget switch, and the fact
that issuing a version snapshots its annex settings so a sent document can be
reproduced exactly.

**Sources and storage.** Catalogue picture, site-visit photo, a file, or the
phone camera (the same input with `capture` set, which is what a mobile browser
needs to open the camera). Everything is downscaled and re-encoded before it is
stored, keeping whichever of the two is smaller — re-encoding a small PNG
screenshot as a JPEG can easily make it bigger. Bytes go to the blob store
under a `storageKey`; the state blob, re-serialised on a 140 ms debounce, holds
only the reference.

**Freezing.** The images were already frozen with a version (a version
deep-copies its chapters). The settings were not — they live on the budget —
so `issueVersion` now snapshots them onto the version. A reissued document is
laid out exactly as the one the customer received.

**Schema v4.** `budget.annex` defaults, and `line.imageRefs` widened from bare
strings into records with a caption, a source and an internal-only flag.
Additive and idempotent, and the migration sim now proves the widening keeps
the reference.

**A fifth budget in the seed, left in draft.** Every other seeded budget is
issued or accepted, hence frozen, which made the constructor impossible to see
or to test. Its four demo pictures are drawn on a canvas at first run: no
binary in the repository, nothing fetched over the network.

## Verification

| Check                                                         | Result                                             |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `@repo/capability-docs` tests (annex, generic vocabulary)     | **14/14** (was 4)                                  |
| `node tests/site-e2e/run.mjs`                                 | **77/77** (was 64) — 13 new                        |
| Five simulations + ownership guard                            | 145/145 · 34/34 · 30/30 · 25/25 · 16/16 · 25 areas |
| `pnpm lint` · `boundaries` · `check-types` · `test` · `build` | all pass                                           |
| `make gates` · `make demo`                                    | both green, artifacts unchanged                    |
| Committed bundle                                              | 23.7 KB → 26.2 KB                                  |

`pnpm --filter web test:e2e` was not required: no tenant spec and no capability
registry entry changed (`docs` was already composed into tenant #1), so the
composed-capability count the Playwright suite asserts is still 17.

Confirmed on GitHub for `f2524b3`: `CI` run 181 green (all five jobs, including
the committed-bundle drift check and the Playwright End-to-end job) and
`Site E2E` run 24 green. First push, no fixes needed.

The thirteen new E2E checks are all made in a real browser, because that is
where this kind of feature actually breaks: the three zones must be on screen
_at once_, the panel must actually change _between keystrokes_ with the caret
still in the field, the gallery's thumbnails must actually decode from the blob
store (`naturalWidth > 0`), the annex must actually sit between the totals and
the conditions in the DOM, and the row must carry a mark and **zero** `<img>`
elements.

## Three things the tooling caught

1. **A duplicate method that silently won.** The first draft added
   `updateLine`, `updateChapter` and `removeLine` to the engine — all three
   already existed further down the same class body, keyed by chapter _and_
   line reference. A later definition replaces an earlier one in silence, so
   every existing caller would have broken. Nothing in lint, types or the unit
   tests noticed; the site E2E did, as "the total does not move when I type",
   and the toast said `Chapter not found`. The new methods are now
   `editLine`/`deleteLine`, and the block carries a comment saying why.
2. **zod in the browser bundle.** Importing the annex options as a zod schema
   took the committed `site/erp-factory.js` from 23 KB to 152 KB — a validation
   library shipped to a mobile WebView to check two numbers. Annex options are
   a per-call argument, not tenant config, so they are plain values with plain
   defaults; the capability's zod _config_ schema stays where config belongs.
3. **A migration check that was right for the wrong reason.** The sim asserted
   "purely additive" by comparing each top-level value as a JSON string, which
   held only while every migration added top-level collections. v4 adds a key
   _inside_ each budget and the check called it a violation. It is now stated
   the way it was always meant — the old blob must be a subset of the new one,
   at every depth — and reports the offending path.

Also fixed in passing: `updateLine` recomputed a line's quantity from its
sub-measurements with a plain sum, while `addLine`, `budgetTotals` and the new
`editLine` all apply the waste percentage. An edited line quietly disagreed
with the total it fed.

## Decisions (ASSUMPTIONS.md #52)

1. The constructor **computes no money**; `budgets-versions` stays `engine`
   because the constructor is a view.
2. The **annex layout is a capability**; the image records and the switch are
   the engine's.
3. Annex options are **plain values, not a zod schema** — see caught-thing 2.
4. They are **repaired, not rejected**: a stored `imagesPerPage: 40` clamps to
   12 rather than making a customer's quotation unprintable.
5. **Default: annex on, two per page.** On costs nothing when no line has a
   picture.
6. **Issuing a version snapshots its annex settings.**
7. **Internal-only images are dropped by `renderBudgetDoc`**, beside cost and
   margin.
8. **Deleting an image does not delete its blob** — an earlier frozen version
   may still reference it.
9. **Keystrokes do not reach the audit trail**; the committed field does.

## Open issues for the next session

- No undo. The grid writes through on every keystroke, so a mistyped price is
  corrected by retyping it — acceptable, but a version is the only real undo
  today. Same debt the Gantt has carried since session 6.
- The annex has no page-break control beyond images-per-page, and no
  landscape/portrait choice. Worth doing when a real PDF renderer exists;
  the preview is HTML.
- Sub-measurements by room (`subLines`, PRE-03) are modelled and totalled but
  not editable in the grid — the quantity cell disables itself when a line has
  them. That editor belongs with the room-by-room measurement UI, not here.
- `tests/i18n-coverage.mjs` remains owed, and this session added UI strings.

# S3 · The company's vocabulary leaves the code

> Context pack. What moved into data, what the new i18n guard enforces (and
> what it deliberately does not), the two bugs it found, and what S4 inherits.

## What was wrong

Three separate things, all of which look like configuration and were not:

1. **Four reference lists were compiled into the engine.** Units, lead
   sources, loss reasons, payment methods — adding a payment term the owner
   actually uses meant editing `LISTS` in `erp-engine.js` and shipping a
   release. DMC-03/04/05 were placeholders that said as much.
2. **DMC-01 and DMC-02 could not create anything.** DMC-01 linked out to
   `master-data.html`, which holds a **mock** dataset never wired to the
   engine — so the partidas the presupuestador actually reads had no
   interface at all. DMC-02 was a read-only grid with no way to record a
   price.
3. **The language toggle was ES ⇄ EN**, in a product for a business in Sant
   Just Desvern, and nothing enforced the dictionary in any language.

## What exists now

|                         | Before                | After                                       |
| ----------------------- | --------------------- | ------------------------------------------- |
| Units / sources / terms | compiled into `LISTS` | `state.lists`, maintained from DMC-03/04/05 |
| A customer's origin     | rendered `referrer`   | renders «Prescriptor»                       |
| Partidas (DMC-01)       | a link to a mock page | `#items` — tree, table, brand/model/quality |
| Prices (DMC-02)         | read-only grid        | comparison strip + capture, gaps 6-9        |
| Languages               | ES ⇄ EN               | ES · CA · EN                                |
| i18n enforcement        | none                  | CI guard: EN absolute, CA ratcheted         |
| Schema                  | v9                    | v11                                         |

**Only vocabulary moved.** The rest of `LISTS` stays compiled in on purpose:
invoice kinds, document statuses and movement classes are keys the engine
_branches on_, and an owner renaming one would not be configuration, it would
be a bug. The test for "does this belong in `state.lists`" is whether the
engine ever compares against the value.

**A code is permanent; a label is editable.** Records store the code forever,
so `updateListEntry` patches `es`/`ca` and refuses nothing else — offering to
rename a code is offering to break every record carrying it. Retiring is never
blocked by usage (a list is retired precisely because it is no longer how the
company works) and `listLabel` keeps resolving retired codes, so the "en uso"
count informs rather than blocks.

**`itemChapters` is a list, not a derived set.** DMC-01's tree could have been
built from the distinct `chapter` values on catalogue items, but then a
chapter with nothing in it yet would be invisible and could never be filled,
and there would be nowhere to keep the drag order. As a list, the array order
IS the display order — no second sort field can disagree with what is on
screen.

## The i18n guard, and what it honestly covers

`tests/i18n/coverage.mjs`, wired into CI.

- **English: absolute.** 1792 of 1792. A new string with no English fails.
- **Structure: absolute.** Empty Catalan values, duplicate Spanish keys and
  orphaned Catalan keys all fail.
- **Catalan: a ratchet.** 466 entries are translated — the whole navigation,
  shell chrome, launchpad and the main screen headings and table labels, i.e.
  what a Catalan user reads first. **1326 are not.** That number lives in
  `CA_BACKLOG` and may only shrink, so adding a string without Catalan fails
  the build immediately while the historical backlog stays counted in the open.

That last point is the honest one. The alternative — scoping the check small
enough to pass at 100% — would have produced a green tick that meant nothing.
The backlog is twelve sessions of accumulated strings, and translating it is
content work a native speaker should review, not a side effect of a feature
session. What this session guarantees is that it can only get better.

The guard does **not** scrape HTML for user-visible literals. `erp.html`
builds its screens from template literals, so a scraper cannot separate a
label from a CSS class or a data attribute, and the allowlist would end up
larger than the dictionary. Reachability is covered instead by site-e2e,
which drives the real interface in all three languages.

## The two bugs it found

1. **11 duplicate Spanish keys, 4 with different English.** Only the first is
   ever reachable, so `Pendiente de cobro` rendered "Pending collection"
   everywhere the second entry intended "Receivable". Removed the shadowed
   copies — keeping the first preserves today's rendering exactly.
2. **`Maestros` had no Catalan.** The rail shows the SHORT section labels, so
   an assertion on the long ones would have passed while a Spanish word sat in
   the navigation of a Catalan interface. The e2e check asserts on what is
   actually visible.

## Decisions worth knowing

- **Migration v11, not more keys in v10.** v10 shipped earlier in this same
  session; a blob stamped 10 never re-runs 10, so keys appended to it would
  have missed exactly the documents that needed them.
- **DMC-02 has no edit path.** Prices are append-only (SUP-05) because a
  budget written last month has to keep explaining itself with the price that
  applied then. The detail drawer says so and offers "record a new one".
- **Null is not zero.** An unrecorded IVA stays `null`, a supplier with no
  price reads «sin precio», a partida with no reference price reads the same.
  Rendering a blank as 0,00 € makes the supplier who never quoted look like
  the cheapest — that is how a purchase order goes to the wrong company.
- **`master-data.html` stays.** DMC-01 supersedes its partidas half only; it
  still owns company, branches and other registers the engine has no home for,
  and `importLegacyMasterData` reads its localStorage.

## What S4 inherits

`listOptions(kind, selected)` and `listConfigScreen` for any screen needing a
maintainable list; `renderMasterList` from S2 for any list screen. COM-01
Leads already exists and COM-02 Visita is the current `visits` placeholder —
now the probe the e2e suite uses for "unbuilt subsección explains itself".

Lead sources and loss reasons are now data, which is what COM-01/02 need: a
lost opportunity can be given a reason the owner defined, not one a previous
session guessed at.

**Every string S4 adds must ship with Catalan.** The guard will fail otherwise
— that is the point of it.

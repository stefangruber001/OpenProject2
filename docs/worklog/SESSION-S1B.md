# S1b · Six secciones, in English

> Context pack. What the shell looks like now, the four things that were
> removed and where their guarantees went, and the two traps in this file.

## What changed

The menu was **7 secciones / 25 subsecciones**, named in Spanish and shaped by
what had been built. It is **6 / 29**, addressed in English.

Twenty-nine and not the specification's twenty-six because Comunicaciones,
Alertas and Usuarios moved _into_ Configuración rather than being deleted —
operator decision, recorded so it is never mistaken for drift. The count is
asserted in the e2e suite, so a thirtieth cannot appear quietly.

| Sección                      | Subsecciones                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `tower` Torre de control     | `tower`                                                                                                                            |
| `sales` Comercial            | `leads` · `visits` · `quotes` · `contracts`                                                                                        |
| `projects` Proyectos         | `progress` · `economics` · `variations`                                                                                            |
| `admin` Administración       | `invoicing` · `purchasing` · `supplier-invoices` · `labour` · `banking` · `petty-cash` · `accountant` · `cash-flow` · `financials` |
| `master-data` Datos maestros | `customers` · `suppliers` · `subcontractors` · `staff`                                                                             |
| `settings` Configuración     | `items` · `price-list` · `units` · `lead-sources` · `payment-methods` · `messaging` · `alerts` · `users`                           |

## Old links still work — and that took three fixes, not one

`ROUTE_ALIASES` maps all 24 retired hashes; `go()`, boot and `hashchange`
resolve through it. The first attempt looked right and was wrong twice:

1. **An alias resolving to the screen you are already on** left the dead hash in
   the address bar, because the handler guarded on `k !== cur`. That is the
   version somebody copies out of the bar and pastes into an email.
2. **An alias whose target is a page this shell does not own** (`#finanzas` →
   `financial-data.html`) did nothing at all: boot skipped it and the Torre
   rendered under the wrong hash.
3. Normalising with an assignment pushed a history entry, so **Back bounced**
   between the old name and the new. It uses `replaceState`.

All three are covered: the suite walks every alias and asserts where it lands.

## The four removals, and where their guarantees went

| Removed                        | What happened to what it guaranteed                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Torre extras** (8 cards → 4) | The four are the doc's four. The Torre now **computes none of them** — each is asked of the owning module                 |
| **Mi Día**                     | Gone, with the six-week calendar, month navigation and legend filters. The only person-level view; Torre is company-level |
| **Reportes**                   | Nothing — a menu entry with no screen behind it                                                                           |
| **Subcontract screens**        | **The rules moved down a layer.** See below                                                                               |

The subcontract one is the interesting case. Decision 5 keeps the data and the
rules and drops only the UI — but those screens were the **only** thing
exercising them, so deleting the browser checks with the screen would have
quietly un-covered 69 engine references. The checks moved into
`manageability-sim` instead (48 → 57): send, accept, the documentation block on
starting work (_blocked_, not flagged), a document that lapses re-blocking a
subcontract that already started, and certification.

That distinction is worth keeping: **retiring a screen is not the same as
un-testing an engine**, and the difference is invisible in a diff.

## Two traps in `erp.html`

1. **`hoy()` closed with ` }` — one leading space.** A "delete to the first `}`
   at column 0" cut ran straight past it and swallowed sixty lines of unrelated
   code: the project-context block, the Clientes column list, the paging state.
   It surfaced as one `ReferenceError` in the browser, which is luckier than it
   deserved. Read what you are deleting.
2. **The breadcrumb was one text node**, `"ERP › Torre de control"` — a string
   no dictionary can hold, so it was the one part of the shell the language
   toggle could never reach. The section name has its own element now.

## Decisions worth knowing

- **The three merges are tab strips, not rewrites.** The doc merges six built
  screens into three (PRY-01, ADM-03, ADM-05). Each merged route wraps the
  existing bodies in a tab strip; rewriting them to the layouts the doc
  specifies is S7, S8 and S11's job. The chosen tab is remembered per route and
  **not persisted** — which tab you last looked at is not company data.
- **The Torre writes nothing.** Five alert rows, ordered by severity, each
  opening the record that caused it. Everything one _does_ to an alert is
  DMC-07, which reads `managedAlerts()` — the raw `alerts()` has no key and no
  override, so a snoozed alert would still be sitting there with buttons on it.
- **No schema migration.** The plan expected v10 to carry removals and key
  renames. There are none: what changed are route keys and view code, and the
  two preferences involved live in the store's `meta`, not the state blob. An
  empty migration is a version bump claiming a change nobody made.
- **The bottom bar is five icons** because the doc says five, so Configuración
  leaves it for the profile menu. An e2e check enforces the count _and_ the
  absence of horizontal scroll — the bar used to carry all seven and scroll.
- **`journey.html` reviewed and kept, out of the menu.** It is reached from the
  profile menu alongside the guides. The doc has no subsección for it and
  inventing a thirtieth would be exactly the drift the 6×29 count exists to
  prevent.

## Verification

Site E2E **153/153** · cross-device refresh 17/17 · year 149/149 and 214/214 at
24 months · manageability **57/57** · migrations 43/43 · import 25/25 ·
scheduling 30/30 · ownership guard 27 areas · lint · boundaries · check-types ·
test · build · `make gates` · `make demo`.

Every one of the 27 in-shell screens was walked in a real browser at 1440×900
and rendered without a console error, and all 24 retired hashes were followed to
where they land.

## What S1c inherits

The screens are in place but ten are placeholders, and **none of them has a
permission check**. That is deliberate: S1c builds DMC-08 Usuarios and the role
model _before_ the screens are filled in, so the check is a primitive every
screen inherits from S2 onward rather than a retrofit across twenty-nine.

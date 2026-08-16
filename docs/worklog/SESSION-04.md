# Session 4 — Three-panel shell, global bar, retired screens

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/candi-programme-session-4-07amo8
  (sessions 1-3 ran on claude/orin-project-status-1q50dt, which CLAUDE.md still
  names as the programme default; each session uses the branch its own mandate
  designates. Nothing else about the plan changes with the branch.)
Spec: "20260731_REQUERMIENTOS BÁSICO CANEI.docx" (see NOTE below)
Plan + session index: docs/worklog/WORKLOG.md  (12 sessions; this was #4)

THE SPEC IS IN THE REPO:
  intake/diorka/20260731_REQUERMIENTOS BÁSICO CANEI.docx   (source of truth)
  intake/diorka/canei-spec-extracted.txt                   (plain text — read
      this one; greppable, no Word needed). Section numbering matches the docx:
      1 navigation · 2 Principal · 3 Comercial · 4 Proyectos · 5 Administración
      · 6 Contabilidad · 7 Datos Maestros · 8 Reportes · Anexo A = the
      code-vs-spec gap table.
Read SESSION-01..03 context packs for the programme-wide decisions (seam,
bundle pipeline, migration ladder + ErpStore). They are all still current.

THE SHELL NOW EXISTS — site/erp.html is THE app. Concretely:

  SECTIONS[]      7 sections, each with subsections. Panel 1 (76 px, always
                  visible) → panel 2 (240 px, overlays panel 3, opens on a
                  section press, collapses on choice / outside click / Esc) →
                  panel 3 (the only panel whose content changes).
                  Phones: panel 1 is a bottom bar, panel 2 a sheet above it.
  SUBMAP[k]       every subsection by key, carrying its section back-reference.
  ROUTING         the hash is the SUBSECTION key and did not change (#torre,
                  #clientes, #facturacion …). Sections are derived, never
                  routed to. Do not "improve" this: the iOS/Android tabs, the
                  e2e suite, printed links and old bookmarks all depend on it.
  A subsection has EITHER a VIEWS[k] entry, OR an href (a page the shell does
  not own: financial-data.html §6, master-data.html §7, journey.html §2.3), OR
  a PLACEHOLDERS[k] entry that says what will live there and links to where
  that data is managed today. Never a blank panel.

  GLOBAL BAR (all in erp.html, all real):
    searchAll(q)   parties (split clientes/proveedores), projects, budgets,
                   invoices, captured documents → grouped results; a hit opens
                   the record's drawer.
    CREATE[sec]    "+ Crear" menu per section → newOpportunityDrawer /
                   newQuickProjectDrawer / newTaskDrawer / newPartyDrawer(role).
                   These call erp.addOpportunity / createQuickProject / addTask
                   / addParty — engine validation and audit log unchanged.
    renderBell()   erp.alerts() count + drill-down via gotoAlert(ref).
    PERIOD         {mode:"year"|"quarter"|"month"|"range", from, to}.
                   periodRange() → {from,to,label}; inPeriod(iso) filters;
                   periodNote(shown,total) is the visible chip every filtered
                   table must print. Reference date is erp.today, NOT the wall
                   clock (this dataset lives in its own exercise year).
                   Consumers today: facturacion, banco, horas, and gestoría's
                   default quarter. WIRE NEW LIST VIEWS INTO IT as they land.
    PREFERENCES    ErpStore.getMeta/setMeta("ui.prefs") — NEVER the state blob.
                   A preference in the blob would need a schema migration and
                   could collide with an engine key.

  RETIRED (redirect stubs, location.replace, kept on purpose):
    index.html → erp.html#torre       dashboard.html → erp.html#torre
    clientes.html → erp.html#clientes frontend.html → erp.html#presupuestos
  Do not delete these files: the site root, GitHub Pages and both shells'
  cached tabs resolve to them. Do not add content to them either.

  NATIVE SHELLS repointed: ios/CaneiSubirats/Support/Config.swift and
  android/.../MainActivity.kt now deep-link into sections (erp.html#torre,
  #clientes, #proyectos, #facturacion) plus journey / financial-data /
  setup-guide. Keep the two files in sync — they are the same 7 destinations.

Ownership now: 19 engine · 1 factory · 5 unbuilt (three-panel-shell moved to
"engine", view-layer only, engineSection null).

Next: session 5 (scheduling capability: calendar + CPM + baselines, pure
TypeScript in packages/) — unblocked, and independent of this session.
Session 6 (Gantt UI) depends on 5. Sessions 10a/10b/11/12 will fill the
placeholder subsections this session created.

ENVIRONMENT: Node 22 + pnpm 10 are present here; everything runs the ordinary
way (`pnpm install && pnpm lint && pnpm boundaries && pnpm check-types &&
pnpm test && pnpm build`, `node tests/site-e2e/run.mjs`, the four sims, and
`pnpm --filter @repo/erp-browser build`). The macOS JavaScriptCore shim and
hand-edited lockfile described in sessions 1-3 were workarounds for a machine
with no Node at all — ignore them.

Start next by: reading site/erp.html's navigation block (SECTIONS → render)
and PLACEHOLDERS, then docs/worklog/WORKLOG.md for session 5's brief.
```

## Goal

Per the plan and spec §1: replace the flat side menu with the three-panel
model, add the global bar, retire the screens `erp.html` supersedes, and
repoint the iOS and Android tab bars.

## What changed

**`site/erp.html`** — the shell.

- **Three panels.** Panel 2 is absolutely positioned inside a sticky `.rail`,
  which is what keeps the overlay glued to panel 1 without hard-coding the
  centred layout's left margin (the shell is `max-width:1400px; margin:auto`,
  so a `position:fixed` panel would have needed to recompute that margin on
  every resize). The sticky offset is a `--top` CSS variable measured from the
  real topbar, because the bar wraps on narrow viewports and a hard-coded
  `59px` would have left a gap or hidden a row.
- **Routing unchanged.** The hash is still the subsection key. This is the
  reason the iOS/Android tabs could be repointed to `erp.html#torre` etc. in
  the same session without a redirect table.
- **Placeholders.** Eight spec'd subsections have no view yet; each renders
  what will live there plus a button to where that data is managed today
  (compras/seguimiento/economía/modificaciones → Proyectos, subcontratos →
  Precios, conciliación → Banco). Comunicaciones and Reportes say plainly that
  they are not built.
- **Global bar.** Search, contextual create, bell, period, profile/help. The
  old `← Inicio`, `⤓ Exportar` and `↻` toolbar buttons moved into the profile
  menu (export and reset are the same functions, now named `exportData()` /
  `resetData()`).
- **Period.** Default `year` with `erp.today` as the reference date. Wired into
  facturación (by invoice issue date), banco (accounting date) and horas
  (labour date), and gestoría's default quarter follows it when the mode is
  quarters, so the two selectors never contradict each other. Every filtered
  table prints `periodNote(shown,total)`.

**Retired screens** — `index.html`, `dashboard.html`, `clientes.html`,
`frontend.html` are redirect stubs. `journey.html`, `financial-data.html` and
`master-data.html` had their "Home" links repointed at `erp.html#torre` (they
pointed at `index.html`, which would now bounce).

**Native shells** — seven tabs each, four of them deep links into the
workspace's sections. `index.html` / `clientes.html` / `dashboard.html` are no
longer tab targets: pointing a tab at a redirect costs every launch an extra
navigation.

**`tests/site-e2e/run.mjs`** — two new suites (`testRetired`, `testShell`),
and the smoke/overflow/i18n suites moved off the retired pages onto the
workspace and its sections.

## Verification

Everything below was executed for real on this machine (Node 22.22.2):

| Check                                                             | Result                                             |
| ----------------------------------------------------------------- | -------------------------------------------------- |
| `pnpm lint` · `pnpm check-types` · `pnpm test` · `pnpm build`     | 24 / 26 / 24 / 3 tasks, all pass                   |
| `pnpm boundaries`                                                 | OK — layer matrix respected, no forbidden literals |
| `node tests/site-e2e/run.mjs`                                     | **53/53**, including 16 new assertions             |
| `year-sim.mjs 1` · 2-year variant                                 | 145/145 · 145/145                                  |
| `manageability-sim.mjs` · `migrations-sim.mjs` · `import-sim.mjs` | 34/34 · 23/23 · 25/25                              |
| `ownership-guard.mjs`                                             | 25 areas valid — 19 engine · 1 factory · 5 unbuilt |
| `pnpm --filter @repo/erp-browser build`                           | no drift (committed bundle byte-identical)         |

Confirmed on GitHub's own infrastructure for commit `0ed8513`, not only
locally: `CI` run 171 — all five jobs green (Lint · Types · Test · Build;
End-to-end; Business simulations + ownership guard; Capability bundle drift;
Durable adapters on Postgres) — and `Site E2E (autonomous journey)` run 19
green.

New e2e assertions worth knowing about, because they pin the spec's wording:
seven sections with panel 2 collapsed at rest; a section press opens exactly
its subsections; choosing one routes _and_ collapses; an outside click
collapses; an unbuilt subsection explains itself; search groups by type and a
hit opens the record; the bell shows a real count; "+ Crear" is contextual and
opens a working form; switching the period actually removes rows; and the
period survives a reload (which is what proves it is in `meta`, not the blob).

## Decisions (ASSUMPTIONS.md #48)

1. Hash routing stays on the subsection key — sections are derived. Anything
   else would have broken every existing deep link on the same day the shells
   were repointed.
2. Retirement is a redirect stub, not a deletion: the site root and both
   shells' cached tabs resolve to files that must keep existing.
   `location.replace`, so a retired screen never sits in history.
3. `index.html` is retired too, although the session brief listed only the
   other three — spec §1 says the system opens straight on the control tower
   and the launchpad "ceases to exist as an intermediate screen". Everything it
   linked to is reachable from the shell (sections) or the profile menu
   (guides, journey).
4. Period default is `year` against `erp.today`. A wall-clock month would have
   emptied every table on a dataset that lives in its own exercise year — a
   silent, unexplainable "the ERP lost my data" for the user.
5. Preferences go in `ErpStore` `meta`, never in the state blob.
6. "+ Crear" calls engine entry points, so validation and the audit log apply
   unchanged. `createQuickProject` still refuses a party with incomplete tax
   data (MDM-02) — the drawer surfaces that as a toast rather than working
   around it.
7. The spec says "eight sections" but enumerates seven (chapters 2-8). Seven
   are implemented; no eighth was invented.

## Open issues for the next session

- `tests/i18n-coverage.mjs` (a ratchet for untranslated Spanish UI) is **still**
  owed — third session running. This session added ~70 dictionary pairs by
  hand for the new chrome; the shell is now the largest single source of UI
  strings in the app and a mechanical check is overdue.
- The eight placeholder subsections are a promise with a date attached:
  compras/subcontratos/seguimiento/economía/modificaciones belong to sessions
  10a/10b, conciliación and comunicaciones to session 11, reportes is
  deliberately deferred by the spec itself.
- The period selector reaches three list views. As sessions 10a-12 rebuild the
  Torre, Mi Día and the project screens, each new list must consume
  `inPeriod()` / `periodNote()` or the spec's "affects all indicators" will
  quietly stay half-true.
- The iOS shell keeps one web view per tab, so four of them now hold the same
  page at different sections. They share the IndexedDB dataset but not their
  in-memory copy of it, so a write in one tab is not reflected in another until
  that tab reloads. This is not new — the tabs were always separate pages over
  the same store — but it is more visible now that they are the same app. A
  cheap fix when it starts to bite: re-read on `pageshow`/visibility change.
- `master-data.html` still owns registers the engine has no home for
  (warehouses, stock, equipment, documents/compliance, automation rules); it is
  reachable as the Datos Maestros section and is deliberately unchanged (§7).

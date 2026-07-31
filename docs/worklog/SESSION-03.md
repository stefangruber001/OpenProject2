# Session 3 — Data foundation: schema versioning, blobs, store unification

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/orin-project-status-1q50dt
Spec: "20260731_REQUERMIENTOS BÁSICO CANEI.docx" (see NOTE below)
Plan + session index: docs/worklog/WORKLOG.md  (12 sessions; this was #3)

THE SPEC IS IN THE REPO:
  intake/diorka/20260731_REQUERMIENTOS BÁSICO CANEI.docx   (source of truth)
  intake/diorka/canei-spec-extracted.txt                   (plain text — read
      this one; it is greppable and needs no Word). Section numbering matches
      the docx: 1 navigation · 2 Principal · 3 Comercial · 4 Proyectos ·
      5 Administración · 6 Contabilidad · 7 Datos Maestros · 8 Reportes ·
      Anexo A = the code-vs-spec gap table.
  intake/diorka/Proyecto_Diorka_Business_Requirements.docx is the OLDER,
      superseded BRD — useful for the XXX-00 requirement ids the code cites
      (MDM-03, CAP-04, GES-07 …), not for current scope.
Read SESSION-01 and SESSION-02 context packs for the programme-wide decisions.

PERSISTENCE NOW (all of site/ must go through this):

  site/erp-migrations.js   versioned schema ladder. PURE + IDEMPOTENT.
                           CURRENT_VERSION = 2. migrate(state) -> {state,
                           from, to, applied[]}. THROWS if the blob is newer
                           than the build.
  site/erp-store.js        THE only module that touches IndexedDB.
                           caneiERP v2:
                             kv     "state" (UNCHANGED coordinates) +
                                    "state.backup.v<n>" one-shot backups
                             blobs  binary attachments by storageKey   [new]
                             meta   small bookkeeping values           [new]
                           loadState() migrates + backs up + persists.
                           applyLegacyCustomers(erp, data) = the synchronous
                           core of the one-way caneiMasterData import.

  HARD RULE (IndexedDB versions are per-database): no page may call
  indexedDB.open("caneiERP", n) directly. erp.html AND index.html both go
  through ErpStore. A second page opening at a stale version throws
  VersionError and renders nothing — that bug was live before this session.

  SCHEMA POLICY: never rename or retype an existing state key. Add a new one
  and migrate the readers. Every migration should then reduce to `s.x ??=
  default`, which is safe to re-run against a half-migrated blob.

  BLOB RULE: binary NEVER goes in the state blob — it is re-serialised on a
  140 ms debounce, so an image there serialises megabytes per keystroke and
  reads to the user as "the ERP is slow". State holds storageKey strings;
  bytes live in the `blobs` store. This matters for sessions 8 and 9
  (OCR captures and budget annex images).

Ownership unchanged: 18 engine · 1 factory · 6 unbuilt.

Remaining legacy stores NOT yet merged (deliberate): caneiFinance
(financial-data.html) and caneiJourney (journey.html). The spec keeps
financial-data as-is (§6), and journey is session 12's concern.
caneiMasterData is now imported one-way but NOT deleted — deletion is a
separate, later, explicitly-flagged step.

Next: session 4 (three-panel shell, global bar, retire dashboard/clientes/
frontend, repoint iOS+Android tabs). It depends on 1 and 3, both done, so it
is unblocked. Session 5 (scheduling CPM, pure TypeScript) is also unblocked
and can run in parallel.

ENVIRONMENT — check this before assuming anything:
  Run `node --version`. If Node EXISTS (Claude Code on web/mobile, CI, or any
  normal machine) just use it — everything runs the ordinary way:
      pnpm install && pnpm lint && pnpm boundaries && pnpm check-types \
        && pnpm test && pnpm build
      node tests/simulation/year-sim.mjs 1
      node tests/simulation/migrations-sim.mjs
      node tests/simulation/import-sim.mjs
      node tests/parity/ownership-guard.mjs
      pnpm --filter @repo/erp-browser build     # regenerate the bundle
  Sessions 1-3 ran on a machine with NO Node/pnpm/esbuild at all, which is why
  those worklogs describe a macOS JavaScriptCore shim and a hand-edited
  pnpm-lock.yaml. Those are workarounds for that one machine, NOT properties of
  the project — ignore them wherever Node is available. (One design decision
  they did leave behind: the import test drives a synchronous core because the
  shim could not drain promise microtasks. The synchronous core is worth
  keeping regardless, but the constraint that forced it is gone.)

Start next by: reading site/erp-store.js (it is the contract session 4's page
retirement and sessions 8/9's blob work both build on).
```

## Goal

Per the plan: `state.schemaVersion` + a pure, idempotent migration ladder with
a pre-migration backup and a newer-blob guard; `blobs` and `meta` object
stores while keeping `kv`/`"state"` at exactly the same coordinates; a shared
store module; and a one-way, non-destructive import of `caneiMasterData` whose
conflicts surface for review rather than being auto-merged.

## What changed

**`site/erp-migrations.js`** (new) — the ladder. `v1 → v2` is deliberately
*purely additive*: it declares the four collections `erp-engine.js` creates
lazily (`feedback`, `supplierPerf`, `assignments`, `recurring`) plus the two
the data foundation itself needs (`importConflicts`, `imports`). That fixes a
real latent hazard — a blob saved before one of those features was ever used
comes back missing the key, and the readers doing `(state.assignments || [])`
are defending against exactly that.

The newer-blob guard throws rather than downgrading. That case is not
theoretical here: the web ships continuously to `/preview` while the iOS and
Android shells ship through store review, so a user can trivially open last
week's app against this week's data.

**`site/erp-store.js`** (new) — the only module that touches IndexedDB.
`caneiERP` goes to version 2, adding `blobs` and `meta`. `kv`/`"state"` is
untouched so every existing user's data keeps working. `loadState()` migrates,
writes a one-shot `state.backup.v<from>` before changing anything, and
persists the result.

**`site/index.html`** — now reads through `ErpStore`. This was mandatory, not
tidiness: IndexedDB versions are per-database, so the launchpad's hardcoded
`indexedDB.open("caneiERP", 1)` would have thrown `VersionError` the moment
`erp.html` upgraded the schema, and the home page would have gone blank.

**Legacy import** — `caneiMasterData` customers fold into the party register,
non-destructive by construction: the source is never written or deleted, it
runs at most once (recorded in `state.imports`), and anything ambiguous
becomes a conflict rather than an overwrite. Conflicts surface in a Torre
banner, because an import that silently drops records is indistinguishable, to
the operator, from one that never ran.

**`erp.html`** — boots through the store; renders a dedicated screen (rather
than reseeding over the data) if the stored blob is newer than the build.

## Verification

Six simulations, all executed for real via the JavaScriptCore shim:

| Simulation | Result |
|---|---|
| `year-sim.mjs 1` | 145/145 invariants |
| `year-sim.mjs` 2 years × 2/mo | 206/206 invariants |
| `manageability-sim.mjs` | 34/34 |
| `migrations-sim.mjs` (new) | 23/23 |
| `import-sim.mjs` (new) | 25/25 |
| `ownership-guard.mjs` | 25 areas valid |

`migrations-sim` replays the **frozen real v1 fixture** captured in session 1
and asserts: purity (input untouched), idempotency (twice == once), that no
pre-existing key was dropped, retyped or altered, that `controlTower()` and
`alerts()` are identical before and after migrating, and that a newer blob
throws.

`import-sim` tests what the import must **refuse** as hard as what it does:
never merge over an existing party, never invent data for an unmappable row,
never let one engine validation failure abort the whole import, run at most
once, never mutate the source.

## Two real bugs this caught in my own test data

1. `46000000X` — lifted from `master-data.html`'s mock seed — is **not** a
   valid NIF. The engine validates the checksum (MDM-03); the correct letter
   for `46000000` is `T`. The mock page never validates, so bad ids sit there
   happily. Worth knowing before session 4 retires that page.
2. `"NOT-A-VALID-ID"` is **accepted** by `validTaxId` — after stripping
   punctuation it satisfies the structural EU-VAT branch
   (`^[A-Z]{2}[0-9A-Z]{2,13}$`). To test rejection you need a well-formed NIF
   with a wrong check letter (`46000000A`). A useful caveat for the OCR work
   in session 8: structural validity is not identity validity.

## Decisions (ASSUMPTIONS.md #47)

1. Migration runs in the **host** (`erp-store.js`), not inside
   `ERP.from(json)`. Putting it in the engine would have made `erp-engine.js`
   depend on the new persistence layer — old → new, the exact direction the
   strangler rule forbids — and would have put the two Node simulations that
   `require()` the engine at risk for no benefit.
2. Conflicts surface as a **view-level Torre banner**, not through the
   engine's `alerts()`. `year-sim.mjs` asserts on `alerts()` output; widening
   it would have coupled a data-migration concern to business invariants the
   simulations pin down.
3. `caneiMasterData` is imported but **not deleted** — the most reversible
   option. Deleting a user's other dataset is a separate, later, explicitly
   flagged step.
4. `caneiFinance` and `caneiJourney` are deliberately left alone: the spec
   keeps Financial Data as-is (§6), and the journey is session 12's scope.

## Open issues for the next session

- Session 4 retires `clientes.html` and `master-data.html`'s customer role.
  Note that `master-data.html` still owns registers the engine has no home for
  (warehouses, stock, equipment, documents/compliance, automation rules) — it
  cannot simply be deleted.
- `tests/i18n-coverage.mjs` (ratchet for untranslated Spanish UI) is still
  owed; this session again added dictionary pairs by hand.

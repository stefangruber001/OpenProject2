# S2 · One terceros file grows three screens, and Personal gets one at all

> Context pack. What exists now, the two bugs this session found, what was
> deliberately left out, and what S3 inherits.

## What was wrong

Clientes was the only master-data screen with a real registry. Proveedores and
Subcontratas were placeholders that pointed elsewhere ("Ir a Facturas de
proveedores", "Ir a Horas") even though the parties themselves already existed
in the same `state.parties` file, filtered by role. Personal interno had no
screen at all — `state.workers` existed because Horas needed a name to put on
a timesheet row, but there was no way to create, edit, or retire a worker
without going through the engine directly.

Every list screen that existed (one: Clientes) had also been built once, by
hand, with its own toolbar/pagination/export code and the wrong page sizes
(10/20/50 instead of the doc's 10/25/50). Building three more screens the same
way would have meant four copies of the same 90 lines, diverging a little more
each time.

## What exists now

|                  | Before                                       | After                                                      |
| ---------------- | -------------------------------------------- | ---------------------------------------------------------- |
| List screens     | one, built by hand (Clientes)                | one shared primitive, four screens on it                   |
| Page size        | 10/20/50, default 10                         | 10/25/50, default 25 (per the doc)                         |
| Proveedores      | placeholder → "Ir a Facturas de proveedores" | `#suppliers` — real list, create, edit                     |
| Subcontratas     | placeholder → nothing (`goto: null`)         | `#subcontractors` — real list, create, edit                |
| Personal interno | no screen; a name typed into Horas           | `#staff` — list, create, edit, tarifas, documentación      |
| CIF validation   | structure only (`return true`)               | check digit verified, same algorithm as DNI/NIE            |
| Gap fields 1–4   | not modelled                                 | `businessLine`/`category`/`sourceSystem`/`aliases[]` exist |
| Bank details     | visible to everyone with the drawer open     | masked client-side for a role without `party.bank.read`    |

**One primitive, not four screens.** `renderMasterList(v, cfg)` owns the
toolbar, the table, pagination and export; a screen supplies its rows, columns
and a search predicate. Clientes was refactored onto it first — same element
ids, same behaviour, only the page-size default changed — to prove it before
Proveedores/Subcontratas/Personal were stamped out on top of it.

**Proveedores and Subcontratas are a filter, not a fork.** Both screens read
`erp.state.parties` filtered by role and reuse `newPartyDrawer` /
`partyDrawer` / `editPartyDrawer` exactly as Clientes does. The alternative —
separate collections — would have meant a party could be a customer in one
table and a supplier in another, which is the bug DMT-01's own history
(session 16b) already removed once.

**The CIF check digit is real now.** `validTaxId`'s CIF branch used to accept
anything of the right shape; it now runs the same
odd-positions-doubled-then-summed algorithm the DNI/NIE branches already used.
Nine fixture/seed tax ids across five files had only ever satisfied the old
regex and were corrected to the nearest valid check character.

## The two bugs this session found

Neither would have shown up in a diff; both were found by building the
screens that finally exercised the code path.

1. **`searchAll()`'s "Proveedores" group routed every hit to Clientes.**
   `k:"customers"` was hardcoded on a group that matched suppliers AND
   subcontractors both — searching for an industrial and clicking the result
   opened the customer screen. There was no DMT-02/03 to route to until this
   session, so the bug was invisible. Split into two groups.
2. **`findDuplicateParty`'s result was computed and discarded.** `addParty`
   has set `rec.duplicateSuspect` since session 16b; nothing ever read it.
   `newPartyDrawer` now shows a warning naming the earlier record instead of a
   plain "created" toast when one is found.

## What was deliberately not built

The doc specifies a 480px panel with four tabs (Identification · Contact and
terms · Inmuebles/History · role-specific Precios/Compras/Documentos/Tarifas).
This session reused and extended the existing single-scroll drawers instead —
`editPartyDrawer` grew three new fields, `workerDrawer` is one drawer with
three sections, neither is tabbed. Rebuilding 29 screens' worth of drawer
plumbing as tabs is real work with real regression risk, and doing it as a
rider on this session risked both jobs. It is logged in `ASSUMPTIONS.md #103`
and in `docs/CANEI-V4-MAPPING.md`'s DMT-01…04 row as "ADAPTED/BUILT (S2)" —
built, not tabbed — so it is never mistaken for finished-to-spec.

The bank-details permission gate is **client-side masking only**. There is no
server-side per-command RBAC on `/erp/command` yet — every signed-in identity
can issue every command the engine accepts today, `party.bank.read` only
decides whether the field is shown. That gap is real, named in `ASSUMPTIONS.md
#103`, and is a distinct piece of work for a future session, not something to
bolt on inside this one.

## Verified against a live server, not just simulations

`GET /api/~/session` is new server code, so it got the same treatment S1c's
user flow did: a real Postgres, the standalone Next build, a single-seat
operator identity.

1. `GET /api/~/session` with no row for the identity → `{role:"admin",
bankRead:true}` — the single-seat operator's existing access, named rather
   than changed
2. the full `server-e2e` suite (27 checks, including the two new ones) green
   against that server
3. site-e2e's IBAN-field check confirms local IndexedDB mode — which never
   calls the endpoint — stays fully visible, since there is no server-side
   identity to mask against in the first place

## What S3 inherits

Four of DMT-01…04's placeholders are gone; DMC-01…07 (S3's own scope) are the
next ten. The shared list primitive (`renderMasterList`, `LIST_PAGE_SIZES`)
and the `SESSION`/`GET /api/~/session` pattern are both available to any
screen that needs a list or a permission check from here on — built once in
S2, not retrofitted later.

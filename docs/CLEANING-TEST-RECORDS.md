# Cleaning test records out of a live tenant

_Written 2026-08-28, after the 28/08 demo review._

## What happened, in one paragraph

The automated server suite (`tests/server-e2e/run.mjs`) creates customers to
prove the server works: it names them `E2E <timestamp>` and gives them a
generated tax identifier. It is meant to run against a throwaway database. At
some point it ran against a live tenant, and the customers it made stayed
behind. Three things the operator reported on 28/08 are that residue and
nothing else:

- a client whose name looks like a random code — `E2E 2026-08-07T22:09:32.550Z`;
- the same name printed on a downloaded quote, where it reads as a bug in the
  document;
- «Duplicate active party for tax id 07300000F» refusing a real registration —
  the tax identifier the suite generated collided with a real one.

They are not defects in the product. They are test fixtures in a company file.

## Stopping it happening again

`tests/server-e2e/run.mjs` now refuses to run at all unless the tenant is a
known test tenant (`reformas-demo`, `e2e`, `test`) or the person running it
sets `ERP_ALLOW_WRITES_HERE=yes` on purpose. Its own tidy-up also moved into a
`finally`, so a run that fails halfway still removes what it made — cleanup
that only happens on success is missing exactly when it is needed.

## Removing what is already there

There is no automatic purge, by choice: this is live company data and it
should be deleted by a person who can see what they are deleting. The order
below matters — the engine refuses to delete a party that still carries
economic documents, which is the correct behaviour and also the reason a
straight "delete the client" does not work.

### 1 · Find them

Every record the suite made begins with `E2E `. Look in three places, because
the party file is shared and a register only shows one role at a time:

- **Maestros → Clientes** — set _Filas por pantalla_ to 50, then use the
  browser's own find (Ctrl+F) for `E2E `. The register also searches the
  tax identifier now, so a NIF pasted from a refusal message is a working
  search term.
- **Maestros → Proveedores** and **Maestros → Industriales** — same again.
- **Comercial → Leads** and **Comercial → Contratos** — the phantom client may
  carry opportunities and a contract created on top of it later.

### 2 · Delete in dependency order

For each `E2E …` client:

1. **Contratos** — open the contract (e.g. `CTR-2026-0001`) and delete it.
   A contract that has been invoiced cannot be deleted; if so, leave it and
   note it — an unpaid phantom contract does no harm once its client is gone
   from the registers.
2. **Presupuestos** — delete any quote belonging to that client.
3. **Leads / oportunidades** — delete the opportunities.
4. **The client itself** — Maestros → Clientes → open the row → **🗑 Eliminar**.
   If the system refuses because history hangs off it, it will offer
   **Desactivar** instead. Accept that: a deactivated party keeps its history,
   disappears from the registers, and — importantly — **stops blocking the
   tax identifier**, because the uniqueness rule only considers active
   records.

### 3 · Check the one that blocked you

If a registration was refused with a duplicate tax identifier, retry it after
the cleanup. The refusal now names the record that holds the identifier, so
if it is refused again the message itself tells you which record to look at.

## What not to do

Do not delete records that merely look unfamiliar. Only `E2E `-prefixed names
and the documents that hang off them are test residue. The demo tenant's own
seed data (Comunidad Prop. Sant Gervasi 44, Marta Roca Puig, and the rest) is
deliberate and is what the screens are demonstrated with.

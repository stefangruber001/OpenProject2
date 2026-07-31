# tests/parity/

Scaffolding for the strangler-fig migration from `site/erp-engine.js` to typed
`packages/` capabilities (the CANEI feature programme — see
`docs/worklog/WORKLOG.md` for the full plan and session index).

## `ownership-guard.mjs` — live today

Validates `site/erp-ownership.json`, the machine-readable record of which
domain area is owned by `engine` (legacy `erp-engine.js`), `factory` (a
`packages/` capability reached through `site/erp-bridge.js`), or `unbuilt`
(net-new, nothing exists yet).

Its one hard rule: **no area may be marked `factory` before `site/erp-bridge.js`
exists.** That file is the seam a migrated area is reached through; claiming
"factory" ownership without it would mean `erp.html` has nothing to call, which
is exactly the half-migrated state `CLAUDE.md` forbids ("never leave the repo
red or half-migrated").

```bash
node tests/parity/ownership-guard.mjs
```

Run in CI on every push and PR (see `.github/workflows/ci.yml`, job
`simulations`).

## The parity harness — added once `site/erp-bridge.js` exists (session 2+)

Once an area has a dual implementation (a legacy method in `erp-engine.js` and
a capability reached through the bridge), `tests/simulation/year-sim.mjs` gains
a `PARITY=1` mode: at each of its 145+ assertion points, if the area under test
is dual-owned, the same figure is computed through both paths and asserted
cents-exact equal before the legacy method is allowed to be deleted.

This reuses the year simulation's existing realistic scenario (36+ projects
across a business year) rather than hand-writing new parity fixtures — the
scenario already exists and is trusted.

**Migration discipline this enables:** every strangler step is two commits,
both green — first the new capability lands, tested, with nothing calling it;
then a second commit routes the view through the bridge, runs `PARITY=1`, and
only then deletes the legacy method. Never grow a capability and shrink the
engine in the same commit.

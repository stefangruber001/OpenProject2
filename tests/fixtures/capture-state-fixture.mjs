// =============================================================================
// Regenerates tests/fixtures/state-v1-seed.json — a frozen, real ERP state
// blob in the CURRENT (pre-schemaVersion) shape, produced by the same
// deterministic seed the app itself uses (site/erp-seed.js).
//
// This is the "v1" ground truth the migration ladder (schemaVersion foundation,
// planned session 3) replays through each migration step and re-verifies with
// the business simulations. It is captured now, before any schema changes
// begin, precisely because site/erp-seed.js will keep evolving — a later call
// to the live seed would no longer represent what a real pre-migration user's
// data actually looked like.
//
// Regenerate only if you intend to REPLACE the frozen baseline (e.g. once the
// v1→v2 migration ships and a fresh "last shape before v2→v3" snapshot is
// needed). Run: node tests/fixtures/capture-state-fixture.mjs
// =============================================================================
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const ErpSeed = require("../../site/erp-seed.js");

const erp = ErpSeed.build();
const state = erp.toJSON();

const out = resolve(__dirname, "state-v1-seed.json");
writeFileSync(out, JSON.stringify(state, null, 2) + "\n");

console.log(`Wrote ${out}`);
console.log(
  `top-level keys: ${Object.keys(state).length} · parties: ${state.parties.length} · ` +
    `projects: ${state.projects.length} · budgets: ${state.budgets.length} · ` +
    `invoices: ${state.invoices.length} · schemaVersion present: ${"schemaVersion" in state}`,
);

// =============================================================================
// Replays the frozen, real v1 state blob (tests/fixtures/state-v1-seed.json,
// captured from the live seed before versioning existed) through the migration
// ladder and asserts the properties the whole data foundation rests on:
//
//   * a pre-versioning blob is treated as v1 and lands on CURRENT_VERSION
//   * migrations are IDEMPOTENT — running twice equals running once
//   * migrations are PURE — the input object is never mutated
//   * no existing key is renamed, retyped or dropped (the standing policy)
//   * the migrated blob still drives the engine identically
//   * a blob NEWER than this build throws instead of being silently downgraded
//
// Run: node tests/simulation/migrations-sim.mjs
// =============================================================================
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const M = require("../../site/erp-migrations.js");
const { ERP } = require("../../site/erp-engine.js");

const checks = [];
const assert = (cond, name, detail) =>
  checks.push({ name, pass: !!cond, detail: cond ? "" : String(detail || "") });
const throws = (fn, name) => {
  try {
    fn();
    checks.push({ name, pass: false, detail: "did not throw" });
  } catch {
    checks.push({ name, pass: true, detail: "" });
  }
};

const fixturePath = resolve(__dirname, "../fixtures/state-v1-seed.json");
const v1 = JSON.parse(readFileSync(fixturePath, "utf8"));

// ---- the fixture really is the pre-versioning shape -------------------------
assert(v1.schemaVersion === undefined, "fixture has no schemaVersion (true v1)");
assert(M.versionOf(v1) === 1, "a blob without schemaVersion reads as v1");
assert(M.CURRENT_VERSION >= 2, "ladder defines at least one migration");

// ---- migrate ---------------------------------------------------------------
const before = JSON.stringify(v1);
const r1 = M.migrate(v1);

assert(JSON.stringify(v1) === before, "migrate() does not mutate its input (pure)");
assert(r1.from === 1, "reports migrating from v1");
assert(r1.to === M.CURRENT_VERSION, `lands on CURRENT_VERSION (${M.CURRENT_VERSION})`);
assert(r1.state.schemaVersion === M.CURRENT_VERSION, "stamps schemaVersion on the result");
assert(r1.applied.length >= 1, "applied at least one migration step");

// ---- no existing key was renamed, retyped or dropped -----------------------
const missing = Object.keys(v1).filter((k) => !(k in r1.state));
assert(missing.length === 0, "no pre-existing top-level key was dropped", missing.join(","));

const retyped = Object.keys(v1).filter(
  (k) => Array.isArray(v1[k]) !== Array.isArray(r1.state[k]) || typeof v1[k] !== typeof r1.state[k],
);
assert(retyped.length === 0, "no pre-existing top-level key changed type", retyped.join(","));

const changed = Object.keys(v1).filter(
  (k) => JSON.stringify(v1[k]) !== JSON.stringify(r1.state[k]),
);
assert(changed.length === 0, "v1->v2 is purely additive (no existing value altered)", changed.join(","));

// ---- the keys v2 promises to declare ---------------------------------------
for (const k of [
  "feedback",
  "supplierPerf",
  "assignments",
  "recurring",
  "importConflicts",
]) {
  assert(Array.isArray(r1.state[k]), `v2 declares ${k} as an array`);
}
assert(r1.state.imports && typeof r1.state.imports === "object", "v2 declares imports as an object");

// ---- idempotency -----------------------------------------------------------
const r2 = M.migrate(r1.state);
assert(
  JSON.stringify(r2.state) === JSON.stringify(r1.state),
  "running the ladder twice equals running it once (idempotent)",
);
assert(r2.applied.length === 0, "a current blob applies no further migrations");

// ---- behaviour is preserved -------------------------------------------------
{
  const a = ERP.from(JSON.parse(JSON.stringify(v1)));
  const b = ERP.from(JSON.parse(JSON.stringify(r1.state)));
  const ca = a.controlTower();
  const cb = b.controlTower();
  assert(
    ca.invoicedCents === cb.invoicedCents && ca.outstandingCents === cb.outstandingCents,
    "control tower figures identical before and after migration",
    `${ca.invoicedCents}/${ca.outstandingCents} vs ${cb.invoicedCents}/${cb.outstandingCents}`,
  );
  assert(
    JSON.stringify(a.alerts()) === JSON.stringify(b.alerts()),
    "alerts identical before and after migration",
  );
}

// ---- the dangerous direction is refused ------------------------------------
throws(
  () => M.migrate({ ...v1, schemaVersion: M.CURRENT_VERSION + 1 }),
  "a blob newer than this build throws instead of downgrading",
);

// a far-future blob must also throw, not wrap around
throws(() => M.migrate({ ...v1, schemaVersion: 999 }), "a far-future blob throws");

/* ---------------- report ---------------- */
const failed = checks.filter((c) => !c.pass);
console.log(`\n──── schema migration simulation ────`);
console.log(
  `fixture v${M.versionOf(v1)} -> v${r1.to} · steps applied: ${r1.applied.join(",") || "none"} · top-level keys: ${Object.keys(v1).length} -> ${Object.keys(r1.state).length}`,
);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} migration checks passed`);
process.exit(failed.length ? 1 : 0);

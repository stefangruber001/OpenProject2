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

/**
 * Additive at EVERY depth, not just the top level.
 *
 * The first version of this check compared each top-level value as a JSON
 * string, which was right while every migration only added top-level
 * collections. v4 adds a key inside each budget, and that check calls it a
 * violation — wrongly: nothing was renamed, retyped or dropped. So the property
 * is now stated the way it was always meant: the old blob must still be a
 * SUBSET of the new one. Added keys are fine anywhere; a changed or vanished
 * value is not, however deep it sits.
 *
 * Returns the paths that broke the rule, so a failure names the field.
 */
/*
 * Keys the product removed ON PURPOSE, written as the path with array indices
 * collapsed to "[]". The guard below still fails on every other dropped key —
 * this list is the change record, not an escape hatch. Adding to it should
 * take an argument; the one entry here has one:
 *
 *   parties[].activityLine — v9. A línea de actividad describes the work, not
 *   the person paying for it, so it lives on budgets and projects (where
 *   profitability("activityLine") still reads it) and was a weaker duplicate
 *   on the customer that could disagree with the job's own line.
 */
const INTENTIONAL_REMOVALS = new Set(["parties[].activityLine"]);
const generalise = (p) => p.replace(/\[\d+\]/g, "[]");

function additiveViolations(before, after, path = "") {
  const at = path || "(root)";
  if (Array.isArray(before)) {
    if (!Array.isArray(after)) return [`${at}: array -> ${typeof after}`];
    /*
     * AN ARRAY MAY GROW, AND MAY NOT DO ANYTHING ELSE.
     *
     * This used to demand identical lengths, which was stricter than the name
     * "additive" and stricter than the purpose: what must never happen is that
     * a company loses or has altered something it typed. Appending does
     * neither. Migration 16 is the first step that seeds DATA rather than
     * reshaping structure — a 200-partida starter price book, without which
     * nobody can build a quote — and equal-length would have made that
     * impossible to express.
     *
     * Every original element is still compared position by position, so a
     * truncation, a reorder, an insertion at the front or an edit to an
     * existing row all still fail. Only appending passes.
     */
    if (after.length < before.length)
      return [`${at}: length ${before.length} -> ${after.length} (shrank)`];
    return before.flatMap((x, i) => additiveViolations(x, after[i], `${path}[${i}]`));
  }
  if (before && typeof before === "object") {
    if (!after || typeof after !== "object" || Array.isArray(after))
      return [`${at}: object -> ${Array.isArray(after) ? "array" : typeof after}`];
    return Object.keys(before).flatMap((k) => {
      const here = path ? `${path}.${k}` : k;
      if (k in after) return additiveViolations(before[k], after[k], here);
      return INTENTIONAL_REMOVALS.has(generalise(here)) ? [] : [`${at}.${k}: dropped`];
    });
  }
  return before === after ? [] : [`${at}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`];
}

const violations = additiveViolations(v1, r1.state);
assert(
  violations.length === 0,
  "the whole ladder is additive at every depth (nothing renamed, retyped or dropped)",
  violations.slice(0, 5).join(" · "),
);

// ---- the keys v2 promises to declare ---------------------------------------
for (const k of ["feedback", "supplierPerf", "assignments", "recurring", "importConflicts"]) {
  assert(Array.isArray(r1.state[k]), `v2 declares ${k} as an array`);
}
assert(
  r1.state.imports && typeof r1.state.imports === "object",
  "v2 declares imports as an object",
);

// ---- what v3 and v4 promise -------------------------------------------------
assert(
  r1.state.plans && typeof r1.state.plans === "object" && !Array.isArray(r1.state.plans),
  "v3 declares plans as an object",
);
{
  const budgets = r1.state.budgets || [];
  assert(budgets.length > 0, "the fixture actually carries budgets to migrate");
  assert(
    budgets.every(
      (b) => b.annex && typeof b.annex.enabled === "boolean" && b.annex.imagesPerPage >= 1,
    ),
    "v4 gives every budget its annex settings",
  );
  const lines = budgets.flatMap((b) =>
    (b.versions || []).flatMap((v) => (v.chapters || []).flatMap((c) => c.lines || [])),
  );
  assert(lines.length > 0, "the fixture actually carries budget lines to migrate");
  assert(
    lines.every(
      (l) => Array.isArray(l.imageRefs) && l.imageRefs.every((i) => typeof i === "object"),
    ),
    "v4 leaves every image reference as a record, never a bare string",
  );
}
{
  const projects = r1.state.projects || [];
  assert(projects.length > 0, "the fixture actually carries projects to migrate");
  assert(
    projects.every(
      (p) =>
        p.forecastOverrides &&
        typeof p.forecastOverrides === "object" &&
        !Array.isArray(p.forecastOverrides),
    ),
    "v5 declares forecastOverrides on every project",
  );
  // A plan that predates the progress log must come back with an empty one,
  // so a reader can tell "nothing recorded" from "key never existed".
  const withPlans = M.migrate({ ...v1, plans: { prj_1: { tasks: [] } } });
  assert(
    Array.isArray(withPlans.state.plans.prj_1.progressLog),
    "v5 declares progressLog on an existing plan",
  );
}
{
  // A blob that DID write bare strings: the widening must keep the reference
  // and survive a second pass unchanged.
  const legacy = JSON.parse(JSON.stringify(v1));
  const line = legacy.budgets[0].versions[0].chapters[0].lines[0];
  line.imageRefs = ["blob_abc"];
  const w = M.migrate(legacy);
  const got = w.state.budgets[0].versions[0].chapters[0].lines[0].imageRefs;
  assert(
    got.length === 1 && got[0].storageKey === "blob_abc" && got[0].internal === false,
    "v4 widens a bare image reference into a record without losing it",
    JSON.stringify(got),
  );
  assert(
    JSON.stringify(M.migrate(w.state).state) === JSON.stringify(w.state),
    "widening an image reference is idempotent",
  );
}
{
  // v6 (session 10b): subcontracts collection, purchase lifecycle fields,
  // change chapterNum/sentAt, locked labour weeks, worker docs.
  assert(Array.isArray(r1.state.subcontracts), "v6 declares subcontracts as an array");
  assert(
    r1.state.series && r1.state.series.subcontract && r1.state.series.subcontract.prefix === "SUB-",
    "v6 registers the subcontract numbering series",
  );
  const purchases = r1.state.purchases || [];
  assert(purchases.length > 0, "the fixture actually carries purchases to migrate");
  assert(
    purchases.every(
      (p) =>
        Array.isArray(p.receipts) &&
        "sentAt" in p &&
        "acceptedAt" in p &&
        "expectedArrival" in p &&
        "cancelledAt" in p,
    ),
    "v6 gives every purchase its lifecycle fields",
  );
  const changes = r1.state.changes || [];
  assert(
    changes.every((c) => "chapterNum" in c && "sentAt" in c),
    "v6 gives every change order a chapterNum and a sentAt",
  );
  const labour = r1.state.labour || [];
  assert(labour.length > 0, "the fixture actually carries labour entries to migrate");
  assert(
    labour.every((l) => l.locked === false && l.approvedAt === null && l.approvedBy === null),
    "v6 leaves every existing hours entry unlocked",
  );
  const workers = r1.state.workers || [];
  assert(workers.length > 0, "the fixture actually carries workers to migrate");
  assert(
    workers.every((w) => Array.isArray(w.docs)),
    "v6 gives every worker a docs array",
  );
  // The un-migrated v1 blob has none of this — alerts()/controlTower() must
  // still run on it directly, which is exactly what the "behaviour is
  // preserved" block below does. This is the regression that block exists to
  // catch: a bare `this.state.subcontracts.filter(...)` crashed on it the
  // first time this migration was written.
  assert(
    v1.subcontracts === undefined,
    "sanity: the raw v1 fixture really has no subcontracts key",
  );
}

// ---- v14: the archive fields, and the array ADM-02 reads every render ------
{
  const captured = r1.state.captured || [];
  assert(captured.length > 0, "the fixture actually carries captured documents to migrate");
  assert(
    captured.every(
      (c) =>
        typeof c.sourcePath === "string" &&
        typeof c.reference === "string" &&
        typeof c.notes === "string",
    ),
    "v14 gives every captured document sourcePath, reference and notes",
  );
  // The distinction v13's note argued for, asserted rather than assumed: the
  // backfill is an empty string somebody can read, not an absent key that
  // reads as "which build wrote this?".
  assert(
    captured.every((c) => "sourcePath" in c && "reference" in c && "notes" in c),
    "v14 backfills the keys rather than leaving them absent",
  );
  assert(
    (r1.state.purchases || []).every((p) => Array.isArray(p.docRefs)),
    "v14 normalises docRefs to an array on every purchase order",
  );
  assert(
    (v1.captured || []).every((c) => c.reference === undefined),
    "sanity: the raw v1 fixture really has no reference on its captures",
  );
}

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

/* ---- the starter price book (migration 16) --------------------------------
 *
 * A company cannot build a quote without a catalogue, so migration 16 installs
 * one. It is purely additive, and these checks are about that word: a company
 * that has priced its own work must keep every figure it typed, and re-running
 * must change nothing.
 */
{
  const pack = (await import("../../site/erp-catalogue-pack.js")).default;
  assert(
    pack.CHAPTERS.length === 20,
    "the pack declares 20 chapters",
    String(pack.CHAPTERS.length),
  );
  const rows = pack.rows();
  assert(rows.length === 200, "the pack declares 200 partidas", String(rows.length));

  const perChapter = {};
  for (const r of rows) perChapter[r.chapter] = (perChapter[r.chapter] || 0) + 1;
  assert(
    Object.values(perChapter).every((n) => n === 10) && Object.keys(perChapter).length === 20,
    "every chapter holds exactly ten partidas",
    JSON.stringify(perChapter),
  );

  const codes = rows.map((r) => r.code);
  assert(new Set(codes).size === codes.length, "no duplicate codes in the pack");

  const UNITS = new Set(["m2", "ml", "m3", "ud", "pa", "h", "kg"]);
  const TYPES = new Set([
    "material",
    "ownLabour",
    "subcontract",
    "machinery",
    "professional",
    "waste",
    "other",
  ]);
  assert(
    rows.every((r) => UNITS.has(r.unit)),
    "every unit is one the units list knows",
  );
  assert(
    rows.every((r) => TYPES.has(r.type)),
    "every type is one the catalogue knows",
  );
  // Quote-ready means priced. A zero price is allowed only where it is the
  // point — a partida alzada the operator fills in per job.
  const unpriced = rows.filter((r) => r.defaultPriceCents === 0);
  assert(
    unpriced.length <= 1,
    "at most one deliberately unpriced partida",
    JSON.stringify(unpriced.map((r) => r.code)),
  );
  assert(
    rows.every((r) => r.defaultPriceCents === 0 || r.defaultPriceCents > r.defaultCostCents),
    "every priced partida sells above its cost",
  );

  // Additive against a state that already has the operator's own work.
  const own = M.migrate({ ...v1, schemaVersion: 15 }).state;
  own.lists = own.lists || {};
  own.lists.itemChapters = [{ code: "DEM", es: "Mis demoliciones", ca: "—", active: true }];
  own.catalogue = [
    {
      id: "cat_9",
      code: "DEM-101",
      desc: "Mi precio",
      unit: "m2",
      chapter: "DEM",
      defaultPriceCents: 12345,
    },
  ];
  const after = M.MIGRATIONS.find((m) => m.to === 16).up(JSON.parse(JSON.stringify(own)));
  const kept = after.catalogue.find((i) => i.code === "DEM-101");
  assert(
    kept.desc === "Mi precio" && kept.defaultPriceCents === 12345,
    "an existing code is never overwritten",
  );
  const chap = after.lists.itemChapters.find((c) => c.code === "DEM");
  assert(chap.es === "Mis demoliciones", "an existing chapter keeps the operator's name");
  assert(
    after.lists.itemChapters.length === 20,
    "the other nineteen chapters are added",
    String(after.lists.itemChapters.length),
  );
  assert(
    after.catalogue.length === 200,
    "199 partidas added beside the operator's one",
    String(after.catalogue.length),
  );
  const ids = after.catalogue.map((i) => i.id);
  assert(new Set(ids).size === ids.length, "no id collides with one the company already had");

  const twice = M.MIGRATIONS.find((m) => m.to === 16).up(JSON.parse(JSON.stringify(after)));
  assert(
    twice.catalogue.length === after.catalogue.length,
    "re-running the migration adds nothing",
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

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
  /* What the work IS, not only what it costs. These three reach the budget line
     now, so a blank here is a blank on the quote — and the rule for filling
     them is stated in the pack's own header: a specification on every row, a
     manufacturer only where one exists. */
  const noQuality = rows.filter((r) => !String(r.quality || "").trim());
  assert(
    noQuality.length === 0,
    "every partida states a calidad",
    JSON.stringify(noQuality.map((r) => r.code)).slice(0, 160),
  );
  const halfNamed = rows.filter(
    (r) => !!String(r.brand || "").trim() !== !!String(r.model || "").trim(),
  );
  assert(
    halfNamed.length === 0,
    "no partida names a marca without a modelo, or the reverse",
    JSON.stringify(halfNamed.map((r) => r.code)).slice(0, 160),
  );
  // A price book where nothing is branded would satisfy the two rules above and
  // be useless, so the floor is stated rather than left to the reader's trust.
  const named = rows.filter((r) => String(r.brand || "").trim());
  assert(
    named.length >= 90,
    "the partidas that ARE a product name one",
    `${named.length} of ${rows.length}`,
  );

  /* The price book reaches a workspace that never runs a migration.
     Migrations replay over a STORED blob. A brand-new workspace is built by
     `ErpSeed.build()` and used directly, so it never touches the ladder — and
     every existing tenant had the 200 partidas through migration 16 while a
     first tenant would have had the eight demo ones and no way to notice.
     `applyCataloguePack` is migration 16's own body, exported so boot can call
     it on a fresh seed; this asserts it is exported, works from nothing, and is
     safe to run twice. */
  assert(
    typeof M.applyCataloguePack === "function",
    "the price-book installer is exported for a fresh workspace to call",
  );
  // Guarded, so a missing export reports one failed check instead of throwing
  // and taking every check after it down with it.
  if (typeof M.applyCataloguePack === "function") {
    const blank = {};
    M.applyCataloguePack(blank);
    const once = { cat: blank.catalogue.length, chap: blank.lists.itemChapters.length };
    M.applyCataloguePack(blank);
    const twice = { cat: blank.catalogue.length, chap: blank.lists.itemChapters.length };
    assert(
      once.cat === rows.length && once.chap === pack.CHAPTERS.length,
      "a state with nothing in it gets the whole price book",
      JSON.stringify(once),
    );
    assert(
      twice.cat === once.cat && twice.chap === once.chap,
      "running it a second time changes nothing",
      JSON.stringify({ once, twice }),
    );
  }

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

/* ---- what the work IS, on the line as well as in the catalogue (mig 17) ----
 *
 * The catalogue recorded `type`, `brand`, `model` and `quality`; the budget line
 * recorded none of them, so a quote made from the price book could not say which
 * of two mixers had been sold. This backfills the shape on every existing line.
 */
{
  const SPEC = ["type", "brand", "model", "quality"];
  const old = JSON.parse(JSON.stringify(v1));
  old.budgets = [
    {
      id: "bud_x",
      versions: [
        {
          id: "ver_x",
          chapters: [
            {
              id: "chp_x",
              lines: [
                { id: "lin_1", desc: "Punto de agua", priceCents: 9000 },
                { id: "lin_2", desc: "Alicatado", priceCents: 3900, brand: "Porcelanosa" },
              ],
            },
            { id: "chp_empty" },
          ],
        },
        { id: "ver_noch" },
      ],
    },
    { id: "bud_bare" },
  ];
  const out = M.migrate(old).state;
  const lines = out.budgets[0].versions[0].chapters[0].lines;
  assert(
    SPEC.every((f) => typeof lines[0][f] === "string"),
    "every existing budget line gains type/brand/model/quality",
    JSON.stringify(lines[0]),
  );
  assert(
    lines[1].brand === "Porcelanosa",
    "a value already on a line is left alone",
    lines[1].brand,
  );
  assert(
    lines[0].desc === "Punto de agua" && lines[0].priceCents === 9000,
    "nothing else on the line is touched",
  );
  // A chapter with no `lines`, a version with no `chapters`, a budget with no
  // `versions`: all three exist in real blobs and all three used to be a
  // TypeError waiting for the one company that had them.
  assert(
    Array.isArray(out.budgets[0].versions[0].chapters) &&
      out.budgets[0].versions[0].chapters.length === 2 &&
      out.budgets.length === 2,
    "a half-shaped budget survives the walk instead of throwing",
  );
  const again = M.MIGRATIONS.find((m) => m.to === 17).up(JSON.parse(JSON.stringify(out)));
  assert(
    again.budgets[0].versions[0].chapters[0].lines[1].brand === "Porcelanosa",
    "re-running it changes nothing",
  );
}

/* ---- v18: a project records who owes for it --------------------------------
 *
 * A general contractor hired by the end customer sub-hires Canei, so part of
 * one job is owed by the contractor and part by the end customer. The shape
 * that makes this expressible has to arrive without changing a single existing
 * project's behaviour: exactly ONE payer each, the customer they already had.
 *
 * The array is the risk. Every other migration sets a scalar or an object key,
 * where "already done" is obvious; appending to a list is the one shape where a
 * re-run can silently double something — and a duplicated payer would mean a
 * job billed twice. Both directions are asserted below.
 */
{
  const migrated = r1.state.projects || [];
  assert(migrated.length > 0, "the fixture actually carries projects to migrate");
  assert(
    migrated.every((p) => Array.isArray(p.billing) && p.billing.length === 1),
    "every existing project gets exactly one payer",
    JSON.stringify(migrated.filter((p) => (p.billing || []).length !== 1).map((p) => p.code)),
  );
  assert(
    migrated.every((p) => p.billing[0].partyId === p.partyId),
    "that payer is the customer the project already had",
  );
  assert(
    migrated.every((p) => p.billing[0].vatBp === p.vatBp),
    "on the tax rate it already had — the migration changes no money",
  );
  assert(
    migrated.every((p) => p.billing[0].taxTreatment === "standard"),
    "and no tax treatment is inferred for it",
  );
  assert(
    migrated.every((p) =>
      ((p.baseline && p.baseline.chapters) || []).every((c) => c.billToPartyId === p.partyId),
    ),
    "every baseline chapter names that same payer as owing for it",
  );

  const m18 = M.MIGRATIONS.find((m) => m.to === 18);

  // Re-running must not append a second payer to a one-payer project.
  const twice = m18.up(JSON.parse(JSON.stringify(r1.state)));
  assert(
    (twice.projects || []).every((p) => p.billing.length === 1),
    "re-running does not give a project a second payer",
  );

  /* And the one that actually matters once this feature is in use: a project
     an operator has SPLIT between two payers must survive the ladder
     untouched. A migration that "helpfully" reset it to one payer would
     silently re-point invoices at the wrong company. */
  const split = {
    projects: [
      {
        id: "prj_x",
        code: "P-X",
        partyId: "pty_end",
        vatBp: 1000,
        billing: [
          { partyId: "pty_end", role: "customer", vatBp: 1000, taxTreatment: "standard" },
          { partyId: "pty_gc", role: "mainContractor", vatBp: 0, taxTreatment: "reverseCharge" },
        ],
        baseline: {
          chapters: [
            { num: "1", billToPartyId: "pty_end" },
            { num: "2", billToPartyId: "pty_gc" },
          ],
        },
      },
    ],
  };
  const kept = m18.up(JSON.parse(JSON.stringify(split)));
  assert(
    kept.projects[0].billing.length === 2 &&
      kept.projects[0].billing[1].partyId === "pty_gc" &&
      kept.projects[0].billing[1].taxTreatment === "reverseCharge",
    "a project already split between two payers keeps both",
  );
  assert(
    kept.projects[0].baseline.chapters[1].billToPartyId === "pty_gc",
    "and a chapter already assigned is never reassigned",
  );

  // A project with no baseline at all must not throw the ladder.
  const bare = m18.up({ projects: [{ id: "prj_y", partyId: "pty_z" }] });
  assert(
    bare.projects[0].billing.length === 1 && bare.projects[0].billing[0].partyId === "pty_z",
    "a project with no baseline survives the walk instead of throwing",
  );
}

/* ---- step 19 in isolation: the job↔contract backfill ------------------------
   The fixture cannot exercise this step — its seeder happens to create every
   contract before its project, so every fixture project already carries the
   link and the step is a no-op there. These blobs are the cases the live
   workspace actually holds. */
{
  const m19 = M.MIGRATIONS.find((m) => m.to === 19);

  // The reported case: job created at acceptance, contract drawn up after.
  const unlinked = m19.up({
    projects: [{ id: "prj_a", budgetId: "bud_1", contractId: null }],
    contracts: [{ id: "con_a", budgetId: "bud_1", status: "draft" }],
  });
  assert(
    unlinked.projects[0].contractId === "con_a",
    "m19: an unlinked job is linked to its budget's contract",
  );

  // A link an operator (or the engine) already made is never reassigned.
  const linked = m19.up({
    projects: [{ id: "prj_b", budgetId: "bud_2", contractId: "con_other" }],
    contracts: [{ id: "con_b", budgetId: "bud_2", status: "draft" }],
  });
  assert(
    linked.projects[0].contractId === "con_other",
    "m19: an already-linked job keeps its link",
  );

  // A cancelled contract must not start gating a job it no longer governs.
  const cancelled = m19.up({
    projects: [{ id: "prj_c", budgetId: "bud_3", contractId: null }],
    contracts: [
      { id: "con_dead", budgetId: "bud_3", status: "cancelled" },
      { id: "con_live", budgetId: "bud_3", status: "draft" },
    ],
  });
  assert(
    cancelled.projects[0].contractId === "con_live",
    "m19: a cancelled contract is skipped in favour of the live one",
  );

  // A quick project has no budget and therefore nothing to match on.
  const quick = m19.up({
    projects: [{ id: "prj_d", budgetId: null, contractId: null }],
    contracts: [{ id: "con_d", budgetId: null, status: "draft" }],
  });
  assert(
    quick.projects[0].contractId === null,
    "m19: a quick project (no budget) is untouched — null does not match null",
  );

  // Idempotent, and tolerant of the arrays being absent entirely.
  const again = m19.up(JSON.parse(JSON.stringify(unlinked)));
  assert(JSON.stringify(again) === JSON.stringify(unlinked), "m19: re-running changes nothing");
  m19.up({});
}

/* ---- step 20 in isolation: the job points at the contract that was SIGNED --
   Step 19 linked the jobs that had no contract; this repairs the ones holding
   the wrong one. Both writers used `find()` — the first record filed for that
   budget — and signing never moved the link, so an operator with three
   contracts on one quote had their job pointing at the first while the third
   carried the signature. */
{
  const m20 = M.MIGRATIONS.find((m) => m.to === 20);
  const sig = { customerSignedAt: "2026-08-20" };

  // The reported case: the job holds a draft, a later contract is signed.
  const moved = m20.up({
    projects: [{ id: "prj_a", budgetId: "bud_1", contractId: "con_1" }],
    contracts: [
      {
        id: "con_1",
        budgetId: "bud_1",
        status: "draft",
        number: "CTR-2026-0003",
        date: "2026-08-01",
      },
      {
        id: "con_3",
        budgetId: "bud_1",
        status: "signed",
        number: "CTR-2026-0005",
        date: "2026-08-20",
        signature: sig,
      },
    ],
  });
  assert(
    moved.projects[0].contractId === "con_3",
    "m20: a job holding a draft moves to the contract that was signed",
  );

  // A signed holder is the answer, whoever wrote it. Never reassigned.
  const keptSigned = m20.up({
    projects: [{ id: "prj_b", budgetId: "bud_2", contractId: "con_first" }],
    contracts: [
      {
        id: "con_first",
        budgetId: "bud_2",
        status: "signed",
        number: "CTR-1",
        date: "2026-08-01",
        signature: sig,
      },
      {
        id: "con_later",
        budgetId: "bud_2",
        status: "signed",
        number: "CTR-2",
        date: "2026-08-09",
        signature: sig,
      },
    ],
  });
  assert(
    keptSigned.projects[0].contractId === "con_first",
    "m20: a job already held by a SIGNED contract is never moved",
  );

  // Money already points at the holder's installments: leave it alone.
  const keptInvoiced = m20.up({
    projects: [{ id: "prj_c", budgetId: "bud_3", contractId: "con_billed" }],
    contracts: [
      {
        id: "con_billed",
        budgetId: "bud_3",
        status: "draft",
        number: "CTR-3",
        date: "2026-08-01",
        installments: [{ idx: 0, invoicedInvoiceId: "inv_9" }],
      },
      {
        id: "con_signed",
        budgetId: "bud_3",
        status: "signed",
        number: "CTR-4",
        date: "2026-08-10",
        signature: sig,
      },
    ],
  });
  assert(
    keptInvoiced.projects[0].contractId === "con_billed",
    "m20: a job whose contract has an invoiced milestone is never moved",
  );

  // Two signatures on one budget: the newest wins, deterministically.
  const newest = m20.up({
    projects: [{ id: "prj_d", budgetId: "bud_4", contractId: "con_draft" }],
    contracts: [
      { id: "con_draft", budgetId: "bud_4", status: "draft", number: "CTR-5", date: "2026-08-01" },
      {
        id: "con_old",
        budgetId: "bud_4",
        status: "signed",
        number: "CTR-6",
        date: "2026-08-05",
        signature: sig,
      },
      {
        id: "con_new",
        budgetId: "bud_4",
        status: "signed",
        number: "CTR-7",
        date: "2026-08-15",
        signature: sig,
      },
    ],
  });
  assert(newest.projects[0].contractId === "con_new", "m20: the newest signature wins");

  // A cancelled holder with nothing to replace it is released, not kept.
  const released = m20.up({
    projects: [{ id: "prj_e", budgetId: "bud_5", contractId: "con_dead" }],
    contracts: [
      {
        id: "con_dead",
        budgetId: "bud_5",
        status: "cancelled",
        number: "CTR-8",
        date: "2026-08-01",
      },
    ],
  });
  assert(
    released.projects[0].contractId === null,
    "m20: a cancelled contract stops gating the job it no longer governs",
  );

  // Nothing signed anywhere: the draft that was there stays there.
  const untouched = m20.up({
    projects: [{ id: "prj_f", budgetId: "bud_6", contractId: "con_only" }],
    contracts: [
      { id: "con_only", budgetId: "bud_6", status: "draft", number: "CTR-9", date: "2026-08-01" },
    ],
  });
  assert(
    untouched.projects[0].contractId === "con_only",
    "m20: with nothing signed, the link is left where it was",
  );

  // A quick job has no budget to match on.
  const quick = m20.up({
    projects: [{ id: "prj_g", budgetId: null, contractId: null }],
    contracts: [
      {
        id: "con_g",
        budgetId: null,
        status: "signed",
        number: "CTR-10",
        date: "2026-08-01",
        signature: sig,
      },
    ],
  });
  assert(quick.projects[0].contractId === null, "m20: a quick job (no budget) is untouched");

  // Idempotent, and tolerant of the arrays being absent entirely.
  const again = m20.up(JSON.parse(JSON.stringify(moved)));
  assert(JSON.stringify(again) === JSON.stringify(moved), "m20: re-running changes nothing");
  m20.up({});
}

/* ---- step 21 in isolation: a split restated against the taxable base -------
   `allocateCapture` used to demand the VAT-inclusive total while every other
   door demanded the base, and `projectCostRows` adds both into one figure — so
   a ticket allocated through the capture screen charged its job the tax as
   well as the cost. The operator's own invoice is the fixture. */
{
  const m21 = M.MIGRATIONS.find((m) => m.to === 21);
  const cf = { baseCents: 248380, vatCents: 52160, totalCents: 300540 };

  // The operator's three rows, entered under the old rule against 3.005,40.
  const restated = m21.up({
    today: "2026-08-31",
    audit: [],
    captured: [
      {
        id: "cap_1",
        stdName: "CERDA_F-2026-4471",
        confirmed: cf,
        /* The operator's own distribution as the old rule forced them to
           enter it: their proportions, scaled up to the VAT-inclusive total.
           Scaling back must return their figures to the cent — 1.976,14 /
           329,66 / 178,00 — which is the whole promise of this step. */
        allocations: [
          { projectId: "p1", chapterNum: "3", amountCents: 239113 },
          { projectId: "p1", chapterNum: "4", amountCents: 39889 },
          { projectId: "p1", chapterNum: null, amountCents: 21538 },
        ],
      },
    ],
  });
  const rows = restated.captured[0].allocations;
  const sum = rows.reduce((t, a) => t + a.amountCents, 0);
  assert(sum === 248380, "m21: the split now foots to the taxable base", String(sum));
  assert(
    rows[0].amountCents === 197614 &&
      rows[1].amountCents === 32966 &&
      rows[2].amountCents === 17800 &&
      rows[2].chapterNum === null,
    "m21: the operator's own figures come back to the cent, and a row with no partida stays one",
    JSON.stringify(rows.map((r) => r.amountCents)),
  );
  assert(
    restated.audit.length === 1 && /splitRestated/.test(restated.audit[0].action),
    "m21: every restatement is written to the audit log",
  );

  // Already at the base — a re-run, or a split made after the fix.
  const already = m21.up({
    captured: [
      { id: "cap_2", confirmed: cf, allocations: [{ projectId: "p1", amountCents: 248380 }] },
    ],
  });
  assert(
    already.captured[0].allocations[0].amountCents === 248380,
    "m21: a split that already foots to the base is left alone",
  );

  // Matches neither: somebody edited it. Never guessed at.
  const handEdited = m21.up({
    captured: [
      { id: "cap_3", confirmed: cf, allocations: [{ projectId: "p1", amountCents: 100000 }] },
    ],
  });
  assert(
    handEdited.captured[0].allocations[0].amountCents === 100000,
    "m21: a split matching neither figure is left exactly as it was",
  );

  // A document with no tax has a base equal to its total: nothing to restate.
  const noVat = m21.up({
    captured: [
      {
        id: "cap_4",
        confirmed: { baseCents: 5000, vatCents: 0, totalCents: 5000 },
        allocations: [{ overheadCategory: "office", amountCents: 5000 }],
      },
    ],
  });
  assert(
    noVat.captured[0].allocations[0].amountCents === 5000,
    "m21: a document with no tax is untouched",
  );

  // Unconfirmed, or unallocated: nothing to work with.
  const bare = m21.up({
    captured: [
      { id: "cap_5", confirmed: null, allocations: [{ projectId: "p1", amountCents: 999 }] },
      { id: "cap_6", confirmed: cf, allocations: [] },
    ],
  });
  assert(
    bare.captured[0].allocations[0].amountCents === 999,
    "m21: an unconfirmed document is untouched — there is no base to restate against",
  );

  // Idempotent, and tolerant of the arrays being absent entirely.
  const again = m21.up(JSON.parse(JSON.stringify(restated)));
  assert(
    again.captured[0].allocations.reduce((t, a) => t + a.amountCents, 0) === 248380,
    "m21: re-running changes no amount",
  );
  m21.up({});
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

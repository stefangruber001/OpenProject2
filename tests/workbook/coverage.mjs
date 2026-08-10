/**
 * The workbook coverage guard (S15).
 *
 *   node tests/workbook/coverage.mjs
 *
 * WHAT WAS WRONG. `docs/CANEI-V4-MAPPING.md` §4 maps the customer's 100
 * workbook columns onto model fields and marks each one ✓ covered, NEW (and
 * which session closed it), ⊘ derived or ✗ discarded. It is the single
 * strongest claim in the whole governance set — "the data you have today fits
 * the system you are buying" — and until now **nothing checked it was still
 * true**. A field renamed in the engine, or a NEW field a session forgot to
 * add, would leave the table quietly lying.
 *
 * WHAT IT CHECKS. Every field the table claims exists is resolved against a
 * REAL dataset — the shipped demo, built through the engine — rather than
 * against the engine's source text. Grepping for an identifier would pass on a
 * field that appears only in a comment; a field that no record in a realistic
 * company ever carries is, at best, an unproven claim.
 *
 * Each `### Heading → \`collection\`` in §4 names where its rows live. For each
 * row marked ✓ or "closed Sn", every backticked identifier in the Model column
 * must be present on at least one record of that collection (or, for the
 * nested ones, on at least one record reachable from it).
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK. It does not assert a value, a type or a
 * count. A field can be empty and still be covered — «Notas» is a real column
 * that is usually blank. What is being guarded is the existence of a place to
 * put the customer's data, which is exactly what the table promises and no
 * more.
 *
 * Rows marked ⊘ derived or ✗ discarded are counted and reported but not
 * resolved: the table's own claim about them is that they have no field.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ErpSeed = require(resolve(ROOT, "site/erp-seed.js"));

const checks = [];
const assert = (cond, name, detail) =>
  checks.push({ name, pass: !!cond, detail: cond ? "" : String(detail || "") });

/* ------------------------------------------------------------------ dataset */
const erp = ErpSeed.build("2026-05-05");
const S = erp.state;

/** Every record a heading's fields could live on, flattened once. */
const COLLECTIONS = {
  parties: () => S.parties,
  projects: () => S.projects,
  prices: () => S.prices,
  captured: () => S.captured,
  // The budget dictionary spans four nested levels; the guard resolves a field
  // against any of them, because the table names them together in one section.
  catalogue: () => [
    ...S.catalogue,
    ...S.budgets,
    ...S.budgets.flatMap((b) => b.versions || []),
    ...S.budgets.flatMap((b) => (b.versions || []).flatMap((v) => v.chapters || [])),
    ...S.budgets.flatMap((b) =>
      (b.versions || []).flatMap((v) => (v.chapters || []).flatMap((c) => c.lines || [])),
    ),
    ...S.projects.map((p) => p.baseline || {}),
    ...S.properties,
  ],
};
// Fields the table names on a related record rather than the collection's own
// (`propertyId → property.street`, `supplierId → party`). Resolving those
// against the collection would fail for the right reason and the wrong claim,
// so the section's record pool is widened to include what it points at.
COLLECTIONS.projects = () => [...S.projects, ...S.properties, ...S.budgets];
COLLECTIONS.prices = () => [...S.prices, ...S.parties, ...S.catalogue];
COLLECTIONS.captured = () => [
  ...S.captured,
  ...S.captured.map((c) => c.confirmed || {}),
  ...S.captured.map((c) => c.keyFields || {}),
];

/* -------------------------------------------------------------- the mapping */
const doc = readFileSync(resolve(ROOT, "docs/CANEI-V4-MAPPING.md"), "utf8");
const section4 = doc.slice(
  doc.indexOf("## 4. Field dictionary"),
  doc.indexOf("## 5. Entity relationship model"),
);
assert(section4.length > 500, "§4 of the mapping is present and non-trivial", section4.length);

/** `### Clientes → \`parties\` (role \`customer\`)` → "parties". */
const headingCollection = (line) => {
  const m = line.match(/→\s*`([a-zA-Z.\[\]]+)`/);
  if (!m) return null;
  return m[1].replace(/^state\./, "").split(/[.[]/)[0];
};

let current = null,
  rows = 0,
  derived = 0,
  discarded = 0,
  resolved = 0;
const missing = [];

for (const line of section4.split("\n")) {
  if (line.startsWith("### ")) {
    current = headingCollection(line);
    continue;
  }
  if (!current || !line.startsWith("|") || /^\|\s*-+/.test(line)) continue;
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  if (cells.length < 3) continue;
  const [, model, status] = cells;
  if (/^Column$/i.test(cells[0])) continue; // header row
  rows++;
  if (/⊘/.test(status)) {
    derived++;
    continue;
  }
  if (/✗/.test(status)) {
    discarded++;
    continue;
  }
  // ✓, or a NEW field the table says a session closed. Both are claims that a
  // field exists today; "NEW n" with no "closed" is an open promise and is not
  // asserted, because the table does not claim it yet.
  const claimed = /✓/.test(status) || /closed/i.test(status);
  if (!claimed) continue;

  const pool = (COLLECTIONS[current] || (() => []))();
  for (const ident of model.matchAll(/`([^`]+)`/g)) {
    const raw = ident[1];
    // `propertyId → property.street` yields both sides; each is checked as a
    // leaf name, because the table is naming a field, not a path to evaluate.
    // `aliases[]` is the same field as `aliases` — the brackets say it holds a
    // list, which is a fact about the value, not about whether it is there.
    const leaf = raw
      .split(/[.\s→]/)
      .filter(Boolean)
      .pop()
      .replace(/\[\]$/, "");
    if (!leaf || /^[A-Z]/.test(leaf)) continue; // a type name, not a field
    resolved++;
    // A few columns name something on the state document rather than on a
    // record — `state.importConflicts` is the import's own log, not a party's.
    const where = raw.startsWith("state.") ? [S] : pool;
    const found = where.some((r) => r && typeof r === "object" && leaf in r);
    if (!found) missing.push(`${current}.${leaf}`);
  }
}

assert(rows >= 40, `§4 lists the workbook columns (${rows} rows parsed)`, rows);
assert(resolved >= 40, `every covered column names a field (${resolved} resolved)`, resolved);
assert(
  missing.length === 0,
  "every field the mapping claims exists is present on a real record",
  missing.join(", "),
);

console.log("──── workbook coverage ────");
console.log(
  `${rows} columns · ${resolved} field claims resolved · ${derived} derived · ${discarded} discarded`,
);
if (missing.length) console.log("missing:", missing.join(", "));

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} workbook checks passed`);
process.exit(failed.length ? 1 : 0);

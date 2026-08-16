/**
 * The i18n completeness guard (audit F-016, plan decision 20).
 *
 *   node tests/i18n/coverage.mjs
 *
 * WHAT WAS WRONG. The translation layer is a hand-maintained dictionary, and
 * nothing enforced it. A new Spanish string shipped with no English and no
 * Catalan simply fell back to Spanish — correct-looking in Spanish, silently
 * monolingual everywhere else, and invisible to the person who introduced it
 * because their own interface was the one language that worked. The audit
 * found the process was holding by discipline alone; decision 20 asks for it
 * to FAIL a build rather than warn.
 *
 * WHAT IT CHECKS, and how hard.
 *
 *   1. HARD — every entry carries English. Zero missing today, so this is
 *      absolute: a new string with no English form fails the build.
 *   2. HARD — nothing is malformed or orphaned. An empty Catalan value, a
 *      duplicate Spanish key (which makes one of the two unreachable), or a
 *      Catalan key with no matching Spanish entry (left behind by a rename,
 *      pointing at a phrase nobody shows any more) all fail.
 *   3. RATCHET — Catalan may not get worse. `CA_BACKLOG` below records the
 *      number of entries still awaiting Catalan; the check fails if the real
 *      number EXCEEDS it, and tells you to lower it when the real number is
 *      smaller. Adding a Spanish string without Catalan therefore fails
 *      immediately, which is exactly what the audit asks for — its wording is
 *      that nothing fails "when a NEW Spanish UI string lacks an entry". The
 *      historical backlog is counted in the open rather than hidden behind a
 *      passing check that quietly excuses it.
 *
 *      A Catalan form identical to the Spanish one is allowed and counted
 *      separately: many short labels genuinely are identical in both, and
 *      writing them out means the file reads as a decision taken rather than
 *      a line forgotten.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK, and why. It does not scrape the HTML
 * for user-visible literals and demand each one be in the dictionary. That
 * check sounds stronger and is mostly noise: `site/erp.html` builds its
 * screens from template literals, so a scraper cannot tell a user-visible
 * label from a CSS class, a data attribute or a code fragment, and the
 * resulting allowlist would be larger than the dictionary. What is enforced
 * here is the property that actually broke — an entry that exists in one
 * language and not the others — plus the reachability check in site-e2e,
 * which drives the real interface in all three languages and asserts the
 * visible strings actually change.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = resolve(ROOT, "site");

/* The dictionary files are browser scripts assigning onto `window`, so they
   are evaluated with a stand-in global rather than imported as modules. */
const sandbox = { window: {} };
const load = (f) => {
  const src = readFileSync(resolve(SITE, f), "utf8");
  new Function("window", src)(sandbox.window);
};
load("i18n-dict.js");
load("i18n-dict-ca.js");

const D = sandbox.window.CANEI_DICT || {};
const pairs = D.pairs || [];
const ca = D.ca || {};

/**
 * Entries still awaiting a Catalan form.
 *
 * THIS NUMBER MAY ONLY GO DOWN. It is not a target and not an allowance for
 * new work: every string added from S3 onward must ship with Catalan, and the
 * check enforces that automatically, because one more untranslated entry
 * makes the real count exceed this ceiling and fails the build.
 *
 * It exists because Catalan arrived in S3 against a dictionary that twelve
 * earlier sessions had already filled in Spanish and English. Translating the
 * historical backlog is content work a native speaker should review, not a
 * side effect of a feature session — so it is counted in the open here rather
 * than excused by a check scoped small enough to pass.
 *
 * Lower it whenever you translate a batch; the check tells you the new value.
 */
/* 1048 after the merge of the v4 programme branch into main — LOWER than
   either side's ceiling on its own (1294 on the programme branch, 1052 on
   main), because each branch had translated strings the other had not and the
   union keeps both. Recomputed rather than chosen: taking either side's number
   would have been wrong in one direction or the other. */
const CA_BACKLOG = 1036;

const problems = [];
const note = (kind, detail) => problems.push({ kind, detail });

/* ---- 1. every entry carries all three languages -------------------------- */
const spanish = new Set();
const missingCa = [];
let identicalCa = 0;
for (const [es, en] of pairs) {
  if (!es || !String(es).trim()) {
    note("empty Spanish key", JSON.stringify([es, en]));
    continue;
  }
  spanish.add(es);
  if (!en || !String(en).trim()) note("no English", es);
  const c = ca[es];
  // Absent Catalan goes to the ratchet, not to the hard failures. An EMPTY
  // one does not: a key present with a blank value is a mistake, not a
  // backlog item, and it would translate a visible label into nothing.
  if (c === undefined) missingCa.push(es);
  else if (!String(c).trim()) note("empty Catalan", es);
  else if (c === es) identicalCa++;
}

/* ---- 1b. the two RULE lists must cover the same patterns ------------------
 *
 * An interpolated line — "16 rows", "Nueva factura", "Deuda neta 80.000 €" —
 * is matched by a regex, not by an entry, so the completeness check above is
 * blind to it. The two lists drifted to 351 rules for English and 120 for
 * Catalan, which meant every counted, dated or priced line that English
 * rendered correctly, Catalan rendered in Spanish. Nothing ever failed.
 *
 * A pattern with no Catalan form is the same defect as an entry with no
 * Catalan form, and it fails the build for the same reason.
 */
const rxEn = new Set((D.rxEs2En || []).map((r) => r[0].source));
const rxCa = new Set((D.rxEs2Ca || []).map((r) => r[0].source));
for (const src of rxEn) {
  if (!rxCa.has(src)) note("interpolation rule with no Catalan form", src);
}

/* ---- 1c. every SHIPPED LIST VALUE must translate --------------------------
 *
 * The configurable lists — units, chapter tree, lead sources, loss reasons,
 * payment methods and terms, next actions, expense accounts — are seeded with
 * the product and read on screen like any other label. They carry `es` and `ca`
 * columns of their own but NO `en`, so English comes from this dictionary or
 * not at all.
 *
 * Nothing could see the gap. The runtime audits excuse anything stored in
 * `erp.state.lists` as company data, on the reasoning that a company may rename
 * these — which is true, and which also hid the fifty-one SHIPPED values that
 * had never been translated. The operator found it by opening the chapter list
 * on an English phone and reading "Climatización", "Sanitarios y grifería" and
 * "Varios" among nine English names.
 *
 * A value the product ships is the vendor's to translate, whether or not the
 * company may later edit it. This checks exactly those.
 */
{
  const req = createRequire(import.meta.url);
  const { ERP } = req(resolve(SITE, "erp-engine.js"));
  const pack = req(resolve(SITE, "erp-catalogue-pack.js"));
  const shipped = new Map();
  for (const list of Object.values(new ERP("2026-01-01").state.lists || {})) {
    if (Array.isArray(list)) for (const row of list) if (row && row.es) shipped.set(row.es, row.ca);
  }
  for (const c of pack.CHAPTERS) shipped.set(c.es, c.ca);

  const enOf = new Map(pairs);
  if (shipped.size < 40) {
    note("shipped-list check read too few values", `${shipped.size} — the lists moved`);
  }
  for (const [es] of shipped) {
    if (!enOf.get(es)) note("shipped list value with no English", es);
    if (ca[es] === undefined) note("shipped list value with no Catalan", es);
  }
}

/* ---- 2. duplicate Spanish keys would make one of them unreachable -------- */
const seen = new Map();
for (const [es] of pairs) {
  const n = (seen.get(es) || 0) + 1;
  seen.set(es, n);
  if (n === 2) note("duplicate Spanish key", es);
}

/* ---- 3. no orphaned Catalan --------------------------------------------- */
for (const key of Object.keys(ca)) if (!spanish.has(key)) note("orphaned Catalan key", key);

/* ---- report -------------------------------------------------------------- */
const byKind = problems.reduce((acc, p) => {
  (acc[p.kind] = acc[p.kind] || []).push(p.detail);
  return acc;
}, {});

const translatedCa = pairs.length - missingCa.length;
console.log("\n──── i18n coverage ────");
console.log(
  `${pairs.length} entries · ES ✓ · EN ${pairs.length - (byKind["no English"] || []).length} ` +
    `· CA ${translatedCa} (${identicalCa} identical to Spanish by design)`,
);
console.log(`Catalan backlog: ${missingCa.length} awaiting translation, ceiling ${CA_BACKLOG}.`);

for (const [kind, list] of Object.entries(byKind)) {
  console.log(`\n✗ ${kind} — ${list.length}`);
  for (const d of list.slice(0, 15)) console.log(`    ${JSON.stringify(d).slice(0, 120)}`);
  if (list.length > 15) console.log(`    …and ${list.length - 15} more`);
}

/* The ratchet. Over the ceiling is a failure; under it is a reminder to
   lower the ceiling, so the number can never drift back up unnoticed. */
let failed = problems.length > 0;
if (missingCa.length > CA_BACKLOG) {
  failed = true;
  const added = missingCa.length - CA_BACKLOG;
  console.log(
    `\n✗ Catalan backlog grew by ${added}. Every string added from S3 onward ships with ` +
      `Catalan — add it to site/i18n-dict-ca.js. Newest without Catalan:`,
  );
  for (const s of missingCa.slice(-Math.min(added, 15))) console.log(`    ${JSON.stringify(s)}`);
} else if (missingCa.length < CA_BACKLOG) {
  console.log(
    `\n↓ Backlog is down to ${missingCa.length}. Lower CA_BACKLOG in this file to ` +
      `${missingCa.length} so it cannot drift back up.`,
  );
}

if (!failed) {
  console.log(
    missingCa.length === 0
      ? "\nevery entry is complete in Spanish, Catalan and English."
      : "\nno regressions: English complete, Catalan backlog within its declining ceiling.",
  );
  process.exit(0);
}
console.log(
  `\nFailed. A string with no translation falls back silently, which is exactly what this ` +
    `check exists to stop — add the missing form to site/i18n-dict-ca.js (Catalan) or ` +
    `site/i18n-dict.js (English).`,
);
process.exit(1);

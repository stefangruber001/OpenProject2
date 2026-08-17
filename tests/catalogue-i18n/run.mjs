/**
 * The starter price book, in three languages.
 *
 * WHAT THIS PROTECTS. Two hundred priced partidas ship with this system, and an
 * operator reading the interface in English used to meet every one of them in
 * Spanish — in the catalogue, in the picker, and on every line of the quote.
 * They now carry an authored English and Catalan.
 *
 * The ways that go wrong are quiet:
 *
 *   · a code in the translation table that the pack does not have, or the
 *     reverse — the count still looks right and one partida silently falls
 *     back to Spanish;
 *   · a translation that is just the Spanish copied across, which reads as
 *     "translated" to every check that only asks whether an entry exists;
 *   · a description that lost its numbers — "60×60", "15+46+15", "16 A", "80 l"
 *     are the specification, and a quote that drops them is quoting different
 *     work.
 *
 * WHAT IT DOES NOT CHECK: whether the English is good English. That is a
 * judgement for a reader, and the file says plainly that it is authored rather
 * than machine-produced so a reader knows what they are reviewing.
 *
 * Run:  node tests/catalogue-i18n/run.mjs
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PACK = require(resolve(ROOT, "site/erp-catalogue-pack.js"));
const T = require(resolve(ROOT, "site/erp-catalogue-i18n.js"));

const checks = [];
const assert = (cond, name, detail) =>
  checks.push({ name, pass: !!cond, detail: cond ? "" : String(detail ?? "") });

const rows = PACK.rows();
assert(rows.length >= 200, `the price book is loaded (${rows.length} partidas)`, rows.length);

/* ------------------------------------------------- every partida, both ways */
const packCodes = new Set(rows.map((r) => r.code));
const tCodes = new Set(Object.keys(T.DESC));
const missing = [...packCodes].filter((c) => !tCodes.has(c));
const orphan = [...tCodes].filter((c) => !packCodes.has(c));
assert(
  !missing.length,
  `every partida has an English and a Catalan (${packCodes.size})`,
  missing.join(", "),
);
assert(
  !orphan.length,
  "…and nothing is translated that the price book does not have",
  orphan.join(", "),
);

/* ------------------------------------------------------- both are present */
const blank = [];
for (const [code, pair] of Object.entries(T.DESC)) {
  if (!Array.isArray(pair) || pair.length !== 2) blank.push(`${code}: not a pair`);
  else if (!String(pair[0]).trim() || !String(pair[1]).trim()) blank.push(`${code}: empty side`);
}
assert(!blank.length, "both languages are filled in on every row", blank.slice(0, 6).join(" · "));

/* --------------------------------------- and they are not the Spanish again */
/* An entry equal to the Spanish is the worst kind of untranslated: it satisfies
   every check that asks whether a translation EXISTS. Catalan legitimately
   shares some short technical strings with Spanish, so a small number is
   expected — but a large number would mean somebody filled the column with a
   copy, and the English column shares nothing at all. */
const esOf = new Map(rows.map((r) => [r.code, r.desc]));
const enSame = [];
const caSame = [];
for (const [code, [en, ca]] of Object.entries(T.DESC)) {
  const es = esOf.get(code);
  if (en === es) enSame.push(code);
  if (ca === es) caSame.push(code);
}
assert(
  !enSame.length,
  "no English row is the Spanish copied across",
  enSame.slice(0, 8).join(", "),
);
assert(
  caSame.length <= 4,
  `Catalan differs from Spanish on all but ${caSame.length} rows`,
  caSame.join(", "),
);

/* ------------------------------------------ the specification survives */
/* The numbers ARE the partida: "60×60", "15+46+15", "16 A", "3.500 W", "80 l".
   A translation that loses one is quoting different work at the same price. */
const NUM = /\d[\d.,×x+]*/g;
const lost = [];
for (const r of rows) {
  const [en, ca] = T.DESC[r.code] || [];
  const want = (r.desc.match(NUM) || []).map((n) => n.replace(/[.,]/g, ""));
  if (!want.length) continue;
  for (const [lang, text] of [
    ["en", en],
    ["ca", ca],
  ]) {
    const got = (String(text).match(NUM) || []).map((n) => n.replace(/[.,]/g, ""));
    const miss = want.filter((n) => !got.includes(n));
    if (miss.length) lost.push(`${r.code}/${lang} lost ${miss.join(",")}`);
  }
}
assert(
  !lost.length,
  "every figure in a description survives translation",
  lost.slice(0, 6).join(" · "),
);

/* ----------------------------------------------------------- the chapters */
const chapCodes = PACK.CHAPTERS.map((c) => c.code);
const chapMissing = chapCodes.filter((c) => !T.CHAPTERS_EN[c]);
assert(
  !chapMissing.length,
  `every chapter has an English name (${chapCodes.length})`,
  chapMissing.join(", "),
);
const chapSame = PACK.CHAPTERS.filter((c) => T.CHAPTERS_EN[c.code] === c.es).map((c) => c.code);
assert(!chapSame.length, "…and none of them is the Spanish again", chapSame.join(", "));
const chapDistinct = new Set(Object.values(T.CHAPTERS_EN)).size;
assert(
  chapDistinct === chapCodes.length,
  `…and no two chapters share an English name (${chapDistinct} of ${chapCodes.length})`,
  String(chapDistinct),
);

/* Catalan chapter names already ship in the pack; assert they are really there,
   because the English column above would look complete either way.

   "Pintura" is the same word in Catalan and in Spanish, so it is NAMED rather
   than pattern-matched away. An identity that is legitimate and an identity
   that is a gap look exactly alike, and the only difference is whether somebody
   checked — the Catalan dictionary learned that when `falta` was found mapping
   to itself among thirty-two identities that were real. A second chapter going
   identical fails here until somebody says why. */
const CA_SAME_BY_DESIGN = new Set(["PIN"]);
const caChapMissing = PACK.CHAPTERS.filter((c) => !c.ca).map((c) => c.code);
assert(!caChapMissing.length, "every chapter has a Catalan name", caChapMissing.join(", "));
const caChapSame = PACK.CHAPTERS.filter((c) => c.ca === c.es && !CA_SAME_BY_DESIGN.has(c.code)).map(
  (c) => c.code,
);
assert(
  !caChapSame.length,
  `…and only the ${CA_SAME_BY_DESIGN.size} named chapter is the same word in both`,
  caChapSame.join(", "),
);

const failed = checks.filter((c) => !c.pass);
console.log("──── price book, three languages ────");
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(
  `${checks.length - failed.length}/${checks.length} catalogue translation checks passed`,
);
process.exit(failed.length ? 1 : 0);

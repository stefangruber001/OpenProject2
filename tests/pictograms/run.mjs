/**
 * The price book's drawings.
 *
 * WHAT THIS PROTECTS. Two hundred and eight partidas each show a line drawing
 * of the job, in the catalogue, in the quote builder and on the printed quote —
 * from ONE definition, so the three can never disagree. The ways that breaks
 * are all quiet:
 *
 *   · a shape with a typo'd op renders as nothing, and an empty box beside a
 *     line of a quote reads as a broken row rather than an absent picture;
 *   · a coordinate outside 0..1 draws over the text next to it, which on paper
 *     is discovered by a customer;
 *   · a keyword rule pointing at a shape that does not exist falls silently
 *     back to `generic`, so the mapping LOOKS complete and every drawing is
 *     the same box;
 *   · the PDF fragment leaving the graphics state dirty changes the stroke of
 *     everything drawn after it, three sections down the page.
 *
 * WHAT IT DOES NOT CHECK: whether a drawing is a good likeness of the job. That
 * is a judgement, and it belongs to the operator who can say "that is not what
 * a canalón looks like" — which is why every shape carries its name in words.
 *
 * Run:  node tests/pictograms/run.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const P = require(resolve(ROOT, "site/erp-pictograms.js"));
const PACK = require(resolve(ROOT, "site/erp-catalogue-pack.js"));

const checks = [];
const assert = (cond, name, detail) =>
  checks.push({ name, pass: !!cond, detail: cond ? "" : String(detail ?? "") });

/* ------------------------------------------------------- the shapes exist */
const keys = P.keys();
assert(keys.length >= 30, `the set is worth having (${keys.length} drawings)`, keys.length);

const OPS = { M: 3, L: 3, R: 5, C: 4 };
const malformed = [];
const outOfBox = [];
const unnamed = [];
const empty = [];
for (const k of keys) {
  const [name, ops] = P.shape(k);
  if (!name || typeof name !== "string") unnamed.push(k);
  if (!Array.isArray(ops) || !ops.length) {
    empty.push(k);
    continue;
  }
  // A drawing that is one move and nothing else strokes nothing at all.
  if (!ops.some((o) => o[0] === "L" || o[0] === "R" || o[0] === "C")) empty.push(k);
  for (const o of ops) {
    if (!OPS[o[0]] || o.length !== OPS[o[0]]) {
      malformed.push(`${k}:${JSON.stringify(o)}`);
      continue;
    }
    const nums = o.slice(1);
    if (nums.some((n) => typeof n !== "number" || Number.isNaN(n))) {
      malformed.push(`${k}:${JSON.stringify(o)}`);
      continue;
    }
    // Every op's INK, not just its origin: a rect at .9 that is .3 wide leaves
    // the box, and so does a circle whose radius takes it past the edge.
    let ext = [];
    if (o[0] === "M" || o[0] === "L") ext = [nums[0], nums[1]];
    else if (o[0] === "R") ext = [nums[0], nums[1], nums[0] + nums[2], nums[1] + nums[3]];
    else if (o[0] === "C")
      ext = [nums[0] - nums[2], nums[1] - nums[2], nums[0] + nums[2], nums[1] + nums[2]];
    if (ext.some((v) => v < -0.001 || v > 1.001)) outOfBox.push(`${k}:${JSON.stringify(o)}`);
  }
}
assert(
  !malformed.length,
  "every op is a known op with the right number of numbers",
  malformed.join(" "),
);
assert(!outOfBox.length, "every drawing stays inside its own box", outOfBox.join(" "));
assert(!unnamed.length, "every drawing says in words what it depicts", unnamed.join(" "));
assert(!empty.length, "no drawing strokes nothing", empty.join(" "));

/* --------------------------------------------- the mapping points at them */
const badTargets = [];
for (const [code, key] of Object.entries(P.BY_CHAPTER))
  if (!keys.includes(key)) badTargets.push(`chapter ${code}→${key}`);
assert(
  !badTargets.length,
  `every chapter maps to a drawing that exists (${Object.keys(P.BY_CHAPTER).length} chapters)`,
  badTargets.join(", "),
);

/* THE PHRASES A REFORMAS PRICE BOOK ACTUALLY USES.
   Asked through the module's own resolver with NO chapter, so nothing can be
   rescued by the per-trade fallback: each phrase has to find its own drawing on
   the strength of the words alone. A rule pointing at a shape that does not
   exist fails here as `generic`, which is the silent failure — the mapping
   looks complete and every picture is the same box. */
const KEYWORD_WORDS = [
  "andamio",
  "plataforma elevadora",
  "protección de suelos",
  "contenedor de escombro",
  "retirada a vertedero",
  "demolición de tabique",
  "fábrica de ladrillo",
  "placa de yeso laminado",
  "falso techo continuo",
  "enfoscado de mortero",
  "solera de hormigón",
  "aislamiento de lana mineral",
  "impermeabilización con lámina",
  "teja cerámica",
  "canalón de zinc",
  "fachada ventilada",
  "alicatado de azulejo",
  "pavimento porcelánico",
  "tarima flotante",
  "punto de agua",
  "desagüe de PVC",
  "caldera mural",
  "inodoro con cisterna",
  "lavabo de porcelana",
  "plato de ducha",
  "cuadro eléctrico",
  "mecanismo de enchufe",
  "luminaria led",
  "radiador de aluminio",
  "split de aire acondicionado",
  "conducto de ventilación",
  "puerta de paso",
  "ventana de aluminio",
  "vidrio laminado",
  "armario empotrado",
  "encimera de granito",
  "mueble de cocina",
  "pintura plástica",
  "limpieza final de obra",
];
const resolved = KEYWORD_WORDS.map((w) => [w, P.pick({ desc: w, chapter: "" })]);
const genericWords = resolved.filter(([, k]) => k === "generic").map(([w]) => w);
assert(
  !genericWords.length,
  `every phrase a reformas price book uses finds its own drawing (${KEYWORD_WORDS.length} phrases)`,
  genericWords.join(", "),
);
const strayKeyword = resolved.filter(([, k]) => !keys.includes(k)).map(([w, k]) => `${w}→${k}`);
assert(
  !strayKeyword.length,
  "every keyword rule reaches a drawing that exists",
  strayKeyword.join(", "),
);
/* AND THEY DO NOT ALL FIND THE SAME ONE. Every phrase resolving to `door`
   would pass the two checks above and be useless. */
const distinctWords = new Set(resolved.map(([, k]) => k)).size;
assert(
  distinctWords >= 25,
  `…and they land on ${distinctWords} different drawings, not one`,
  String(distinctWords),
);

/* ------------------------------------------------------ the cascade works */
/* A REAL QUOTE LINE OFTEN SAYS NOTHING ON ITS OWN. "Partida 3 del capítulo",
   "Ayudas", "Mano de obra" — the meaning is in the heading above it. Without
   the chapter-name step every such line drew the same box, which is what the
   first rendered page actually showed while the gate happily reported one mark
   per row. Counting marks is not the same as looking at them. */
assert(
  P.pick({ desc: "Partida 3 del capítulo", chapterName: "Impermeabilización" }) === "waterproof",
  "a nameless partida takes the drawing of the chapter it sits under",
  P.pick({ desc: "Partida 3 del capítulo", chapterName: "Impermeabilización" }),
);
assert(
  P.pick({ desc: "Alicatado de azulejo", chapterName: "Impermeabilización" }) === "walltile",
  "…but its own words win when it has any",
  P.pick({ desc: "Alicatado de azulejo", chapterName: "Impermeabilización" }),
);
assert(
  P.pick({ pictogram: "roof", desc: "Alicatado", chapterName: "Pintura" }) === "roof",
  "…and an explicit choice beats both",
  P.pick({ pictogram: "roof", desc: "Alicatado", chapterName: "Pintura" }),
);
assert(
  P.pick({ pictogram: "no-such", desc: "Alicatado" }) === "walltile",
  "…while an explicit choice that names nothing is ignored, not obeyed",
  P.pick({ pictogram: "no-such", desc: "Alicatado" }),
);
/* The chapter names a real quote actually uses, not the price book's codes.
   These are the headings from the document fixtures. */
const DOC_CHAPTERS = [
  ["Demolicion y trabajos previos", "demolition"],
  ["Impermeabilizacion", "waterproof"],
  ["Fontaneria", "pipe"],
  ["Electricidad", "socket"],
  ["Alicatado y solado", "walltile"],
  ["Carpinteria y vidrio", "door"],
  ["Pintura y acabados", "roller"],
  ["Limpieza y retirada", "broom"],
];
const wrongChapter = DOC_CHAPTERS.filter(
  ([name, want]) => P.pick({ desc: "Partida 1", chapterName: name }) !== want,
).map(
  ([name, want]) => `${name}→${P.pick({ desc: "Partida 1", chapterName: name })} (want ${want})`,
);
assert(
  !wrongChapter.length,
  `the headings a quote actually prints each choose their own drawing (${DOC_CHAPTERS.length})`,
  wrongChapter.join(", "),
);

/* ------------------------------------- every partida in the pack resolves */
/* Through the pack's own `rows()` and not its raw table: that is the function
   the migration feeds the catalogue from, so this checks the objects the
   application will actually hold rather than a shape of my own reading. */
const rows = typeof PACK.rows === "function" ? PACK.rows() : null;
assert(Array.isArray(rows) && rows.length > 100, "the price book is loaded", rows && rows.length);
if (Array.isArray(rows)) {
  const byShape = new Map();
  let generic = 0;
  for (const item of rows) {
    const key = P.pick(item);
    if (!keys.includes(key)) throw new Error(`unknown shape ${key} for ${item.code}`);
    if (key === "generic") generic++;
    byShape.set(key, (byShape.get(key) || 0) + 1);
  }
  assert(
    generic === 0,
    `every partida in the price book gets a drawing of its own job (${rows.length} rows, ${byShape.size} distinct drawings)`,
    `${generic} fell through to the generic box`,
  );
  /* NOT ALL THE SAME DRAWING. Twenty chapters resolving to one shape would
     satisfy every check above and be worthless on the page — the picture would
     carry no information while still taking the space and the eye. */
  const biggest = Math.max(...byShape.values());
  assert(
    byShape.size >= 15 && biggest < rows.length * 0.35,
    `the drawings discriminate (${byShape.size} used, biggest group ${biggest}/${rows.length})`,
    JSON.stringify([...byShape.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)),
  );
}

/* ------------------------------------------------------------- rendering */
const s = P.svg("brickwall", 18);
assert(
  /^<svg /.test(s) && /viewBox="0 0 1 1"/.test(s),
  "the SVG writer emits an svg",
  s.slice(0, 60),
);
assert(
  /aria-label="fábrica de ladrillo"/.test(s),
  "…labelled for a screen reader",
  s.slice(0, 200),
);
assert(
  !/\bhttp|<image|url\(/.test(s),
  "…and fetches nothing: no request, no data URI",
  s.slice(0, 200),
);
// Flipped exactly once. Authored y=.16 is the BOTTOM of the brick wall, so it
// must come out near the bottom of the SVG box, which is a LARGE y.
const rectY = /<rect[^>]*y="([\d.]+)"/.exec(P.svg("brickwall", 18));
assert(rectY && Number(rectY[1]) === 0.16, "the y flip happens once, not twice", rectY && rectY[1]);

const pdf = P.pdfOps("brickwall", 40, 700, 10, "0.1 0.2 0.3 RG");
assert(
  /^q\n/.test(pdf) && /Q\n$/.test(pdf),
  "the PDF fragment saves and restores state",
  pdf.slice(0, 40),
);
assert(
  (pdf.match(/\bre S\b/g) || []).length >= 1 && /\bm\b/.test(pdf) && /\bl\b/.test(pdf),
  "…and actually strokes something",
  pdf.slice(0, 120),
);
assert(!/\bf\b|\bB\b/.test(pdf), "…stroked, never filled", pdf.slice(0, 200));
// Placed where it was asked to be: nothing may land left of x or below y.
const coords = [...pdf.matchAll(/(-?[\d.]+) (-?[\d.]+) (?:m|l)\b/g)].map((m) => [+m[1], +m[2]]);
assert(
  coords.length && coords.every(([x, y]) => x >= 39.99 && x <= 50.01 && y >= 699.99 && y <= 710.01),
  "…inside the box it was given, so it cannot draw over the text beside it",
  JSON.stringify(coords.slice(0, 4)),
);

const circle = P.pdfOps("socket", 0, 0, 10, "0 0 0 RG");
assert(
  (circle.match(/ c\n/g) || []).length >= 8,
  "a circle becomes beziers, two per shape × four",
  circle.slice(0, 80),
);

/* Unknown keys must draw SOMETHING. A quote line with a blank where every
   other line has a mark reads as a fault in the row, not in the key. */
const unknown = P.svg("no-such-shape", 18);
assert(
  /<rect/.test(unknown),
  "an unknown key falls back to a drawing, never to nothing",
  unknown.slice(0, 80),
);

/* ------------------------------------------------- the names are readable */
/* EVERY DRAWING'S NAME IS USER-VISIBLE. It is the `<title>` a hovering mouse
   shows and the accessible name a screen reader reads, and `site/i18n.js`
   translates both `title` and `aria-label`. A drawing added later without
   dictionary entries ships a Spanish tooltip to an English reader and nothing
   fails — the translation gates check that the dictionary is COMPLETE, not
   that the application asked it about everything. This closes that gap for the
   one vocabulary that is generated rather than written into a page.

   The labels are chrome and not company data: the partida's own description
   stays Spanish because Canei wrote it; "brickwork" is this system's word for
   a picture. */
const dictSandbox = { window: {} };
for (const f of ["site/i18n-dict.js", "site/i18n-dict-ca.js"])
  new Function("window", readFileSync(resolve(ROOT, f), "utf8"))(dictSandbox.window);
const PAIRS = dictSandbox.window.CANEI_DICT || {};
// Catalan hangs off the same global as a `.ca` map, not a global of its own —
// the two files are one dictionary in two halves.
const CA = PAIRS.ca || {};
const enOf = new Set((PAIRS.pairs || []).filter((p) => typeof p[0] === "string").map((p) => p[0]));
const noEn = [];
const noCa = [];
for (const k of keys) {
  const name = P.label(k);
  if (!enOf.has(name)) noEn.push(name);
  if (!Object.prototype.hasOwnProperty.call(CA, name)) noCa.push(name);
}
assert(enOf.size > 100, "the dictionaries loaded", `${enOf.size} English entries seen`);
assert(!noEn.length, `every drawing's name has an English entry (${keys.length})`, noEn.join(", "));
assert(!noCa.length, `every drawing's name has a Catalan entry (${keys.length})`, noCa.join(", "));

const failed = checks.filter((c) => !c.pass);
console.log("──── price-book pictograms ────");
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} pictogram checks passed`);
process.exit(failed.length ? 1 : 0);

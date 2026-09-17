/* =============================================================================
   The code a name proposes.

   Package 13 · item 1. The operator's complaint was that creating a título or a
   partida asked them to invent a short unique key before they were allowed to
   type the name — the machine's job, handed to a person, with unwritten rules
   and a permanent wrong answer if they guessed badly.

   WHY THIS IS A GATE AND NOT A UNIT TEST OF A SLUG FUNCTION. Any generator can
   be made to pass a test written against itself. The property worth pinning is
   that the generator agrees with the data this system has ALREADY shipped: run
   over the ten partida names in LIST_DEFAULTS, it has to produce their ten
   codes — DEM, ALB, FON … VAR — exactly. That is what makes the proposal look
   like the convention the company already has rather than like a generator's
   output, and it is a claim about the world that can actually fail: shorten the
   length to two and it goes red, as it did when that was tried deliberately.

   Where a rule does NOT move the shipped ten — folding a Ç, dropping a leading
   article — the case that does move is written out beside them (block 2b),
   because a rule no assertion can break is a rule nobody will keep.

   It also pins the two rules that exist to protect records rather than looks:
   a proposal is never a code already taken, and a code typed by hand comes out
   in the same shape the generator emits.
   ========================================================================== */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ErpEngine = require(resolve(ROOT, "site/erp-engine.js"));

let pass = 0;
const fails = [];
const ok = (label, got, want) => {
  if (got === want) {
    pass++;
    return;
  }
  fails.push(`${label}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};

/* A fresh engine with the list emptied: uniqueness suffixes would otherwise
   mask a wrong stem, since the shipped codes are already in there. */
const blank = (kind) => {
  const e = new ErpEngine.ERP();
  e.state.lists[kind] = [];
  return e;
};

console.log("\n\x1b[1mThe code a name proposes\x1b[0m\n");

/* 1 ── the ten trade codes, reproduced from their names alone.
   These SHIPPED in LIST_DEFAULTS until v23, when partidas stopped coming with
   the product and became the company's own data. They are written out here
   now, rather than read from the engine, and that is the point: the list they
   came from is gone, but the convention they encode is what the operator reads
   on screen and the reason first-word beat initials. A fixture keeps the
   ratchet after the source of truth has moved on — read from LIST_DEFAULTS
   this block would now be a loop over nothing, passing by being empty. */
const TRADE_CODES = [
  ["Demoliciones", "DEM"],
  ["Albañilería", "ALB"],
  ["Fontanería", "FON"],
  ["Electricidad", "ELE"],
  ["Climatización", "CLI"],
  ["Revestimientos", "REV"],
  ["Carpintería", "CAR"],
  ["Pintura", "PIN"],
  ["Sanitarios y grifería", "SAN"],
  ["Varios", "VAR"],
];
for (const [es, code] of TRADE_CODES) {
  ok(`trade ${es}`, blank("itemChapters").suggestListCode("itemChapters", es), code);
}
console.log(`  ${TRADE_CODES.length} line-item codes reproduced from their names`);

/* 2 ── the heading list uses four, and folds the same way. */
for (const [name, want] of [
  ["Baño", "BANO"],
  ["Cocina", "COCI"],
  ["Reforma de baño", "REFO"],
  ["Fachada y cubierta", "FACH"],
  ["Luz", "LUZ"],
  ["3 capas", "CAPA"],
]) {
  ok(`heading ${name}`, blank("itemTitles").suggestListCode("itemTitles", name), want);
}

/* 2b ── the two folding rules, on the names that actually exercise them.
   A leading article is dropped (the only place the stop-word list changes an
   answer — mid-name it is invisible, because the choice is the first word and
   not the initials), and a letter that is not ASCII is folded rather than
   dropped: without the decomposition step "Çapa" would lose its Ç entirely and
   propose APA. Both were verified by removing the rule and watching these go
   red; the shipped ten do not move either way, which is why they are here. */
for (const [name, want] of [
  ["El baño", "BANO"],
  ["De obra", "OBRA"],
  ["Y", "Y"], // everything is a stop word — still has to get a code
  ["Çapa", "CAPA"],
  ["Über", "UBER"],
]) {
  ok(`folding ${name}`, blank("itemTitles").suggestListCode("itemTitles", name), want);
}

/* 3 ── a name with no letters or digits proposes nothing, rather than
   something. The screen keeps the field editable, so "" is an honest answer;
   a placeholder code invented here would be stored on records for ever. */
for (const empty of ["", "   ", "—  —", "···"]) {
  ok(
    `barren ${JSON.stringify(empty)}`,
    blank("itemTitles").suggestListCode("itemTitles", empty),
    "",
  );
}

/* 4 ── a proposal is never a code already taken. Three títulos all called
   Baño must not collide, because addListEntry refuses a duplicate and the
   operator would just see an error they did not cause. */
const busy = blank("itemTitles");
const run = [];
for (let i = 0; i < 3; i++) {
  const code = busy.suggestListCode("itemTitles", "Baño");
  run.push(code);
  busy.addListEntry("itemTitles", { code, es: `Baño ${i}` }, "test");
}
ok("collision run", run.join(","), "BANO,BANO2,BANO3");

/* And across lists, on a real engine rather than an emptied one: a partida
   typed after one that already took the stem steps aside. Built by hand since
   v23, because nothing is seeded any more — which is itself worth asserting. */
const real = new ErpEngine.ERP();
ok("nothing is seeded", real.listAll("itemChapters").length, 0);
real.addListEntry("itemChapters", { code: "DEM", es: "Demoliciones" }, "test");
ok(
  "collides with an existing partida",
  real.suggestListCode("itemChapters", "Demoliciones"),
  "DEM2",
);

/* 5 ── hand-typed codes land in the same shape the generator emits. This is
   the half that has no UI of its own and so is the half that rots. */
for (const [raw, want] of [
  ["ba ño", "BANO"],
  ["  fon-101  ", "FON-101"],
  ["Nº 4", "N4"],
  ["ÁÉÍÓÚ", "AEIOU"],
  ["a-b_c", "A-BC"],
  ["", ""],
]) {
  ok(`normalise ${JSON.stringify(raw)}`, ErpEngine.normaliseCode(raw), want);
}

/* 6 ── whatever is proposed must actually be storable. A code the engine then
   refuses would turn a helpful default into an error the operator cannot read. */
const sink = blank("itemChapters");
for (const name of ["Aislamiento", "Cerrajería", "Vidrio y espejos", "Baño"]) {
  const code = sink.suggestListCode("itemChapters", name);
  try {
    sink.addListEntry("itemChapters", { code, es: name }, "test");
    pass++;
  } catch (e) {
    fails.push(`storing the proposal for ${name} (${code}): ${e.message}`);
  }
}

console.log(`\n  \x1b[1;32m✓\x1b[0m ${pass} assertion(s) passed`);
if (fails.length) {
  console.log(`  \x1b[1;31m✗\x1b[0m ${fails.length} failed:\n`);
  for (const f of fails) console.log(`      ${f}`);
  console.log("");
  process.exit(1);
}
console.log("");

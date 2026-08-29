/**
 * Every document, as a Word file that Word will actually open.
 *
 *   node tests/doc-docx/run.mjs
 *
 * WHY THIS GATE IS SHAPED LIKE THIS. A .docx is not checked by looking at it:
 * Word either opens it or refuses with «problems with the contents» and names
 * nothing. The rules it enforces are unglamorous and absolute — the schema
 * fixes the ORDER of the children of pPr, rPr and tcPr; a table must carry a
 * tblGrid; a cell may not be empty; a nested table must be followed by a
 * paragraph — and every one of them is invisible in a viewer that happens to
 * be tolerant. So they are asserted here, mechanically, on all sixteen
 * documents.
 *
 * AND THE MIRROR. The point of the Word file is that it says the same thing as
 * the PDF, so the last check walks the descriptor both writers read and
 * asserts every label, figure and row of it reaches the Word text. A field
 * that stops being rendered stops passing, which is the only way two formats
 * built from one source stay honest about being the same document.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DT = require(resolve(ROOT, "site/erp-doctypes.js"));
const Docx = require(resolve(ROOT, "site/erp-docx.js"));

const results = [];
const ok = (n, d = "") => results.push({ n, pass: true, d });
const bad = (n, d = "") => results.push({ n, pass: false, d });
const check = (n, cond, d = "") => (cond ? ok(n, d) : bad(n, d));

const BRAND = {
  wordmark: "Canei Subirats",
  legal: "Canei Subirats, S.L.",
  slogan: "Reformas integrales",
  cif: "B00000000",
  address: "C/ Major 1, Sant Sadurní",
  phone: "930000000",
  from: "if@2iberia.com",
  iban: "ES00 0000 0000 0000",
};

/* ---------------------------------------------------------------- a ZIP reader
   Store-only, which is what CaneiZip writes: the local headers are enough and
   this stays a test with no dependencies, like every other gate here. */
function unzip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  const out = new Map();
  let i = 0;
  while (i + 30 <= bytes.length && dv.getUint32(i, true) === 0x04034b50) {
    const method = dv.getUint16(i + 8, true);
    const size = dv.getUint32(i + 18, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const name = dec.decode(bytes.subarray(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    if (method !== 0) throw new Error("not stored: " + name);
    out.set(name, bytes.subarray(start, start + size));
    i = start + size;
  }
  return out;
}

/** Well-formedness, the part a reader refuses on: every tag closed, in order. */
function xmlBalanced(xml) {
  const stack = [];
  const re = /<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[2].startsWith("?") || m[2].startsWith("!")) continue;
    if (m[1]) {
      if (stack.pop() !== m[2]) return `close </${m[2]}> does not match`;
    } else if (!m[4]) stack.push(m[2]);
  }
  return stack.length ? "unclosed <" + stack[stack.length - 1] + ">" : null;
}

/* The schema's own sequences. A child appearing out of this order is a file
   Word declines to open, so the order is asserted rather than trusted. */
const ORDER = {
  "w:pPr": ["w:pBdr", "w:shd", "w:spacing", "w:ind", "w:jc", "w:rPr"],
  "w:rPr": ["w:rFonts", "w:b", "w:caps", "w:color", "w:spacing", "w:sz"],
  "w:tcPr": ["w:tcW", "w:gridSpan", "w:tcBorders", "w:shd", "w:tcMar", "w:vAlign"],
  "w:tblPr": ["w:tblW", "w:tblBorders", "w:tblLayout", "w:tblCellMar"],
};

function orderViolations(xml) {
  const bad = [];
  for (const [parent, seq] of Object.entries(ORDER)) {
    const re = new RegExp("<" + parent + ">([\\s\\S]*?)</" + parent + ">", "g");
    let m;
    while ((m = re.exec(xml))) {
      // Direct children only: the nested rPr inside pPr is itself checked by
      // its own pass, and counting it here would compare two sequences at once.
      const kids = [...m[1].matchAll(/<(w:[\w]+)[ />]/g)]
        .map((k) => k[1])
        .filter((k) => seq.includes(k));
      let at = -1;
      const seen = new Set();
      for (const k of kids) {
        if (seen.has(k)) continue;
        seen.add(k);
        const idx = seq.indexOf(k);
        if (idx < at) {
          bad.push(`${parent}: ${k} after ${seq[at]}`);
          break;
        }
        at = idx;
      }
    }
  }
  return [...new Set(bad)];
}

const NOT_TEXT = new Set([
  "jpeg",
  "bytes",
  "pictogram",
  "type",
  "audience",
  "role",
  "state",
  "tone",
  "kind",
  "id",
  "ref",
  "align",
  "key",
  "flag",
  "variant",
]);

/** Whitespace is layout, not content: the document collapses runs of spaces
 *  the descriptor happens to carry, and comparing them raw reports a
 *  difference in typesetting as a missing fact. */
const norm = (s) => String(s).replace(/\s+/g, " ").trim();

/** Every text the descriptor carries, flattened — the mirror's yardstick. */
function descriptorTexts(doc) {
  const out = [];
  const push = (v) => {
    if (typeof v === "string" && v.trim() && !/^https?:/.test(v)) out.push(v.trim());
  };
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        // Keys whose values are machine vocabulary, never printed text: the
        // audience a document is written for, a row's state, a band's tone.
        // Counting them as missing text would make the mirror check fail on
        // words no reader was ever meant to see.
        if (NOT_TEXT.has(k)) continue;
        walk(val);
      }
    } else push(v);
  };
  walk(doc);
  return out;
}

const facts = DT.sampleFacts();
console.log("──── every document as a Word file ────");

let mirrored = 0;
for (const kind of DT.KINDS) {
  let bytes, parts, docXml;
  try {
    const descriptor = DT.build(kind, facts);
    bytes = Docx.build(descriptor, BRAND, String);
    parts = unzip(bytes);
    docXml = new TextDecoder().decode(parts.get("word/document.xml"));

    const missing = [
      "[Content_Types].xml",
      "_rels/.rels",
      "word/document.xml",
      "word/styles.xml",
      "word/_rels/document.xml.rels",
    ].filter((p) => !parts.has(p));
    check(
      `${kind}: the package carries every part Word requires`,
      !missing.length,
      missing.join(", "),
    );

    const broken = xmlBalanced(docXml);
    check(`${kind}: document.xml is well formed`, !broken, broken || "");

    const viol = orderViolations(docXml);
    check(
      `${kind}: schema order respected in pPr/rPr/tcPr/tblPr`,
      !viol.length,
      viol.slice(0, 3).join(" · "),
    );

    const tbls = (docXml.match(/<w:tbl>/g) || []).length;
    const grids = (docXml.match(/<w:tbl><w:tblPr>[\s\S]*?<\/w:tblPr><w:tblGrid>/g) || []).length;
    check(
      `${kind}: every table declares its grid`,
      tbls === grids,
      `${tbls} tables, ${grids} grids`,
    );

    check(`${kind}: no empty cell`, !/<w:tc>(?:(?!<w:p>)[\s\S])*?<\/w:tc>/.test(docXml));

    // A nested table must be followed by a paragraph inside the same cell.
    check(`${kind}: no cell ends on a nested table`, !/<\/w:tbl><\/w:tc>/.test(docXml));

    // The mirror: every text the descriptor carries reaches the Word file.
    const texts = descriptorTexts(descriptor);
    const flat = norm(docXml.replace(/<[^>]+>/g, " "));
    const absent = texts.filter((t) => t.length > 2 && !flat.includes(norm(t).slice(0, 60)));
    if (!absent.length) mirrored += 1;
    check(
      `${kind}: every fact in the descriptor reaches the Word file`,
      !absent.length,
      absent.slice(0, 3).join(" | "),
    );
  } catch (e) {
    bad(`${kind}: builds at all`, String((e && e.message) || e).slice(0, 160));
  }
}

/* The annex is the one part with binary in it: a plate must become a real
   image part, related from the document, or the customer's copy of the
   photographs is a page of empty frames. */
try {
  const withAnnex = DT.build("presupuesto", facts);
  withAnnex.annex = {
    pages: [
      {
        number: 1,
        plates: [{ jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), caption: "Cocina" }],
      },
    ],
    perPage: 2,
    label: "Anexo gráfico",
    pageWord: "página",
    ofWord: "de",
  };
  const parts = unzip(Docx.build(withAnnex, BRAND, String));
  const rels = new TextDecoder().decode(parts.get("word/_rels/document.xml.rels"));
  const doc = new TextDecoder().decode(parts.get("word/document.xml"));
  check("annex: the plate is stored as a real image part", parts.has("word/media/image1.jpeg"));
  check("annex: the image is related from the document", /relationships\/image/.test(rels));
  check("annex: the document draws it", /<w:drawing>/.test(doc) && /r:embed="rId101"/.test(doc));
  check(
    "annex: jpeg is declared in the content types",
    /Extension="jpeg"/.test(new TextDecoder().decode(parts.get("[Content_Types].xml"))),
  );
} catch (e) {
  bad("annex: builds", String((e && e.message) || e).slice(0, 160));
}

/* A section type nobody renders must be loud, exactly as it is in the PDF
   writer: silence there means a customer's copy quietly missing a block. */
try {
  Docx.build(
    { title: "x", number: "1", docType: "x", sections: [{ type: "notARealType" }] },
    BRAND,
    String,
  );
  bad("an unknown section type is refused", "it built anyway");
} catch (e) {
  check("an unknown section type is refused, not skipped", /unknown section type/.test(e.message));
}

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? "✓" : "✗"} ${r.n}${r.d ? "  → " + r.d : ""}`);
console.log(`\n${DT.KINDS.length} documents · ${mirrored} mirror the descriptor completely`);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("\n──── failed ────");
  for (const r of failed) console.log(`✗ ${r.n}${r.d ? "  → " + r.d : ""}`);
  process.exit(1);
}

/**
 * The documents must be searchable.
 *
 * Wide CSS letter-spacing makes Chromium place each glyph far enough apart that
 * a PDF text extractor reads a space between them: "INFORME DE VISITA" comes
 * out as "I N F O R M E D E V I S I TA". Ctrl+F finds nothing, and a screen
 * reader working from the extracted text reads it letter by letter. On a
 * customer's invoice that is a real defect, not a cosmetic one.
 *
 * Measured on the real templates, .1em breaks and everything up to .08em is
 * clean, so the set is capped at .07em — still visibly tracked, comfortably
 * inside the threshold.
 *
 * This gate reads each rendered PDF and fails if a word has been shattered into
 * single letters. It looks for the pattern rather than for specific headings,
 * so a new document is covered the day it is added.
 *
 * Run:  node tests/doc-print/searchable.mjs <pdf-dir>
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
// Two ways a heading can come out wrong, and the second is easy to miss.
//
//   shattered — "I N F O R M E": four or more single letters in a row. No
//     sentence in Spanish, Catalan or English does this.
//   split — "FAC TURA": the tracking was small enough to keep most of the word
//     together and still broke it once. Ctrl+F for "FACTURA" fails exactly the
//     same way, so passing this would be reporting success on a defect. Caught
//     by checking the document's own title words survive intact.
const SHATTERED = /(?:(?:^|\s)\p{L}(?=\s)){4,}/u;

/** The uppercase document-type words each template prints in its header. */
const TITLE_WORDS = [
  "PRESUPUESTO",
  "CONTRATO",
  "FACTURA",
  "RECTIFICATIVA",
  "RECIBO",
  "CERTIFICACION",
  "CERTIFICACIÓN",
  "ENTREGA",
  "COMPRA",
  "SUBCONTRATACION",
  "SUBCONTRATACIÓN",
  "ALBARAN",
  "ALBARÁN",
  "INFORME",
  "TRABAJO",
  "PROYECTO",
  "TRIMESTRAL",
  "CAMBIO",
];

let bad = 0,
  checked = 0;
for (const f of fs
  .readdirSync(dir)
  .filter((x) => x.endsWith(".pdf"))
  .sort()) {
  const txt = spawnSync("pdftotext", [path.join(dir, f), "-"], { encoding: "utf8" }).stdout || "";
  checked++;
  const lines = txt.split("\n").map((l) => l.trim());
  const hits = lines.filter((l) => l.length > 6 && SHATTERED.test(l));

  // A word split once leaves the letters in order with a stray space, so
  // removing spaces from a line reveals it — while the line as printed does not
  // contain the word at all.
  for (const l of lines) {
    const squeezed = l.replace(/\s+/g, "");
    for (const w of TITLE_WORDS) {
      if (squeezed.includes(w) && !l.includes(w)) hits.push(`split heading: "${l.slice(0, 50)}"`);
    }
  }
  if (hits.length) {
    bad++;
    console.log(`  ✗ ${f}`);
    for (const h of hits.slice(0, 3)) console.log(`      "${h.slice(0, 60)}"`);
  }
}
console.log(
  bad
    ? `\n${bad} of ${checked} documents contain unsearchable headings`
    : `\nall ${checked} documents are searchable — no shattered words`,
);
process.exit(bad ? 1 : 0);

/**
 * The documents must be searchable — and this file is a RATCHET, not a pass.
 *
 * WHAT A HEADING LOOKS LIKE WHEN IT BREAKS. "FACTURA" extracts as "FACT URA",
 * so Ctrl+F finds nothing and a screen reader working from the extracted text
 * reads nonsense. On a customer's invoice that is a real defect.
 *
 * WHY THIS IS A CEILING AND NOT ZERO — the honest version, after two wrong
 * explanations. It was blamed first on CSS letter-spacing (capped at .04em,
 * then zeroed) and then on kerning (disabled). Neither was the cause: zeroing
 * the tracking took CI from 16 broken documents to 8, disabling kerning changed
 * the count by two words, and the same eight headings broke both times.
 *
 * The actual mechanism, read out of the PDF: **Chromium writes ONE `Tj` per
 * glyph**, each preceded by its own absolute `Td` offset. There are no text
 * runs at all. Whether an extractor rejoins those glyphs into a word is its own
 * judgement about the gaps, and the gaps differ between Chromium builds — this
 * machine's build produces a set that every extractor joins, the CI runner's
 * build does not, and the proxy here refuses the browser download, so the two
 * cannot be compared locally. No CSS can change it: the templates are printed
 * BY the browser, and the browser is what places the glyphs.
 *
 * SO WHERE DOES SEARCHABILITY ACTUALLY GET GUARANTEED. In the writer. Every
 * document a customer or supplier receives is produced by `site/erp-pdf.js`,
 * which emits real text runs, and `tests/doc-pdf/run.mjs` asserts searchability
 * on all sixteen of them with no ceiling and no excuse. `site/documentos/**` is
 * the approved design reference and the printable preview; it is held to the
 * margin and pagination rules absolutely, and to searchability by a ceiling
 * that may only come down.
 *
 * Run:  node tests/doc-print/searchable.mjs <pdf-dir> [--max N]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { requirePoppler } from "./poppler.mjs";

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

requirePoppler();

let bad = 0,
  checked = 0,
  wordsSeen = 0;
for (const f of fs
  .readdirSync(dir)
  .filter((x) => x.endsWith(".pdf"))
  .sort()) {
  const txt = spawnSync("pdftotext", [path.join(dir, f), "-"], { encoding: "utf8" }).stdout || "";
  checked++;
  wordsSeen += (txt.match(/\S+/g) || []).length;
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
if (!wordsSeen) {
  console.error(
    `FAIL: zero words extracted from ${checked} PDF(s) — nothing was checked for ` +
      "searchability, so this gate cannot report success.",
  );
  process.exit(1);
}

const maxIdx = process.argv.indexOf("--max");
const MAX = maxIdx > 0 ? Number(process.argv[maxIdx + 1]) : 0;

console.log(
  bad
    ? `\n${bad} of ${checked} documents contain unsearchable headings (ceiling ${MAX})`
    : `\nall ${checked} documents are searchable — no shattered words`,
);
if (bad > MAX) {
  console.error(
    `\nFAIL: ${bad} broken, ceiling ${MAX}. Headings are broken by the BROWSER's ` +
      `per-glyph placement, not by anything in the CSS — see the note at the top of ` +
      `this file before reaching for letter-spacing again.`,
  );
  process.exit(1);
}
// Under the ceiling is not a pass to bank: say so, so the number gets lowered
// rather than quietly becoming the new normal.
if (bad < MAX) {
  console.log(`↓ Down to ${bad}. Lower the --max in .github/workflows/ci.yml to ${bad}.`);
}
process.exit(0);

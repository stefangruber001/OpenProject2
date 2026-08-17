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
 * WHY IT IS A NAMED LIST AND NO LONGER A COUNT. The ceiling was taken down
 * from 8 to 0 on 2026-08-16 because THIS machine reported zero — which is
 * precisely what the paragraph above says not to do, written in this file, and
 * read past anyway. CI went red on the next push and stayed red, while the
 * Deploy workflow went on succeeding, so nothing looked broken from the outside.
 *
 * A count could be satisfied by the wrong eight documents. The eight below are
 * NAMED, measured on the CI runner (run 31999566404). Any other document that
 * breaks fails this gate no matter what the total is, and a name may only be
 * removed. That is a stricter gate than the number ever was, and it cannot be
 * re-derived from a local run.
 *
 * Run:  node tests/doc-print/searchable.mjs <pdf-dir>
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

/**
 * The documents whose headings the CI runner's Chromium shatters.
 *
 * Not a wish-list and not a budget: these are the ones measured broken there,
 * by name. Every other document must extract cleanly on every machine. A file
 * may leave this list; adding one means a document regressed and needs the
 * writer path, not a longer list.
 */
const KNOWN_BROKEN = new Set([
  "01-cliente__01-presupuesto.pdf",
  "01-cliente__03-contrato-obra.pdf",
  "01-cliente__04-orden-de-cambio.pdf",
  "01-cliente__05-certificacion-obra.pdf",
  "01-cliente__06-factura.pdf",
  "01-cliente__07-factura-rectificativa.pdf",
  "01-cliente__13-acta-entrega.pdf",
  "02-proveedor__11-contrato-subcontratacion.pdf",
]);

requirePoppler();

let bad = 0,
  checked = 0,
  wordsSeen = 0;
const unexpected = [];
const healed = [];
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
    if (!KNOWN_BROKEN.has(f)) unexpected.push(f);
    console.log(`  ${KNOWN_BROKEN.has(f) ? "·" : "✗"} ${f}`);
    for (const h of hits.slice(0, 3)) console.log(`      "${h.slice(0, 60)}"`);
  } else if (KNOWN_BROKEN.has(f)) {
    healed.push(f);
  }
}
if (!wordsSeen) {
  console.error(
    `FAIL: zero words extracted from ${checked} PDF(s) — nothing was checked for ` +
      "searchability, so this gate cannot report success.",
  );
  process.exit(1);
}

console.log(
  bad
    ? `\n${bad} of ${checked} documents contain unsearchable headings ` +
        `(${KNOWN_BROKEN.size} named as broken on the CI runner)`
    : `\nall ${checked} documents are searchable on this machine — no shattered words`,
);

if (unexpected.length) {
  console.error(
    `\nFAIL: ${unexpected.length} document(s) break that are not on the named list:\n` +
      unexpected.map((f) => `  ${f}`).join("\n") +
      `\n\nHeadings are broken by the BROWSER's per-glyph placement, not by anything in ` +
      `the CSS — see the note at the top of this file before reaching for letter-spacing ` +
      `again. Searchability is guaranteed in site/erp-pdf.js, which emits real text runs; ` +
      `a document a customer receives belongs on that path, not on a longer list here.`,
  );
  process.exit(1);
}

/* A NAME MAY LEAVE THE LIST, BUT NOT FROM THIS MACHINE'S SAY-SO.
   The local Chromium joins glyphs the runner's does not, so a clean local run
   is the normal case here and means nothing. It is reported without an
   instruction to act on it — the last time this gate told the reader to lower a
   number, the number came from the wrong machine and main went red. Only a
   green CI run may retire a name. */
if (healed.length && healed.length < KNOWN_BROKEN.size) {
  console.log(
    `\n${healed.length} of the ${KNOWN_BROKEN.size} named documents extracted cleanly here. ` +
      `That is expected on a non-CI Chromium and is not grounds to retire them.`,
  );
} else if (healed.length === KNOWN_BROKEN.size) {
  console.log(
    `\nAll ${KNOWN_BROKEN.size} named documents extracted cleanly HERE. If a CI run agrees, ` +
      `empty KNOWN_BROKEN in this file — that is the only evidence that counts.`,
  );
}
process.exit(0);

/**
 * How close does any text get to the paper edge, on every page?
 *
 * This is the operator's complaint expressed as a number. Anything inside the
 * unprintable border of a normal inkjet or laser printer (~5mm, and 10mm is the
 * safe convention) will be clipped on paper regardless of how it looks on
 * screen — so the test is geometric, not visual.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { requirePoppler } from "./poppler.mjs";

const PDF_DIR = process.argv[2];
const LIMIT_MM = Number(process.argv[3] || 10);
const A4 = { w: 595.28, h: 841.89 }; // points
const mm = (pt) => (pt / 72) * 25.4;

// Fail with a sentence, not a stack trace: a missing directory is one more way
// of measuring nothing, and it should read like the others.
if (!fs.existsSync(PDF_DIR)) {
  console.error(`FAIL: ${PDF_DIR} does not exist — nothing was rendered to measure.`);
  process.exit(1);
}
requirePoppler();

const files = fs
  .readdirSync(PDF_DIR)
  .filter((f) => f.endsWith(".pdf"))
  .sort();
let worst = { mm: Infinity },
  failures = 0,
  pagesChecked = 0,
  wordsSeen = 0;

for (const f of files) {
  const p = path.join(PDF_DIR, f);
  const out = spawnSync("pdftotext", ["-bbox", p, "-"], { encoding: "utf8" }).stdout || "";
  // <page width= height=> ... <word xMin= yMin= xMax= yMax=>
  const pages = out.split(/<page\b/).slice(1);
  pages.forEach((page, i) => {
    pagesChecked++;
    const wm = /width="([\d.]+)"\s+height="([\d.]+)"/.exec(page);
    const W = wm ? Number(wm[1]) : A4.w,
      H = wm ? Number(wm[2]) : A4.h;
    let minEdge = Infinity;
    for (const m of page.matchAll(
      /xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g,
    )) {
      wordsSeen++;
      const [x0, y0, x1, y1] = [+m[1], +m[2], +m[3], +m[4]];
      const edge = Math.min(mm(x0), mm(y0), mm(W - x1), mm(H - y1));
      if (edge < minEdge) minEdge = edge;
    }
    if (minEdge === Infinity) return; // page carrying no text at all
    if (minEdge < worst.mm) worst = { mm: minEdge, file: f, page: i + 1 };
    if (minEdge < LIMIT_MM) {
      failures++;
      console.log(`  ✗ ${f} p${i + 1}: text ${minEdge.toFixed(1)}mm from the edge`);
    }
  });
}
// A GATE THAT CANNOT MEASURE MUST NOT PASS.
//
// This is not hypothetical. On a runner without `pdftotext` every extraction
// came back empty, `worst` kept its sentinel, and this printed
// "all pages clear of the printable border — 999.0mm" and exited 0. It reported
// a perfect score for a file it had never read. Absence of evidence is not
// evidence of absence, and a green tick on an unread document is worse than no
// tick at all, because it stops anyone looking again.
if (!files.length) {
  console.error(`FAIL: no PDFs in ${PDF_DIR} — nothing was measured.`);
  process.exit(1);
}
if (!wordsSeen) {
  console.error(
    `FAIL: zero words extracted from ${files.length} PDF(s), ${pagesChecked} page(s). ` +
      "Either the documents are blank or `pdftotext` (poppler-utils) is not installed. " +
      "Either way this gate measured nothing and must not report success.",
  );
  process.exit(1);
}

console.log(
  `\n${pagesChecked} pages checked · ${wordsSeen} words · closest ink to edge: ` +
    `${worst.mm.toFixed(1)}mm (${worst.file} p${worst.page}) · limit ${LIMIT_MM}mm`,
);
console.log(failures ? `${failures} pages FAIL` : "all pages clear of the printable border");
process.exit(failures ? 1 : 0);

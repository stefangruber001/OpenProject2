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

const PDF_DIR = process.argv[2];
const LIMIT_MM = Number(process.argv[3] || 10);
const A4 = { w: 595.28, h: 841.89 }; // points
const mm = (pt) => (pt / 72) * 25.4;

const files = fs
  .readdirSync(PDF_DIR)
  .filter((f) => f.endsWith(".pdf"))
  .sort();
let worst = { mm: 999 },
  failures = 0,
  pagesChecked = 0;

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
    let minEdge = 999;
    for (const m of page.matchAll(
      /xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g,
    )) {
      const [x0, y0, x1, y1] = [+m[1], +m[2], +m[3], +m[4]];
      const edge = Math.min(mm(x0), mm(y0), mm(W - x1), mm(H - y1));
      if (edge < minEdge) minEdge = edge;
    }
    if (minEdge === 999) return; // page with no text
    if (minEdge < worst.mm) worst = { mm: minEdge, file: f, page: i + 1 };
    if (minEdge < LIMIT_MM) {
      failures++;
      console.log(`  ✗ ${f} p${i + 1}: text ${minEdge.toFixed(1)}mm from the edge`);
    }
  });
}
console.log(
  `\n${pagesChecked} pages checked · closest ink to edge: ${worst.mm.toFixed(1)}mm ` +
    `(${worst.file} p${worst.page}) · limit ${LIMIT_MM}mm`,
);
console.log(failures ? `${failures} pages FAIL` : "all pages clear of the printable border");
process.exit(failures ? 1 : 0);

/**
 * Give every printed page a margin, not just the first one.
 *
 * The redesign put the page margins on `.sheet`'s padding and set
 * `@page { margin: 0 }`. Padding applies once to the whole element, so page 1
 * looked right and pages 2, 3… began hard against the paper edge — which is
 * both ugly and unprintable, since no consumer printer can put ink there.
 *
 * The fix is to move the margins onto `@page`, which the printer applies to
 * EVERY page, and drop the padding while printing. Everything else here is
 * break control: keeping a chapter heading with its first row, never splitting
 * a signature block or a totals box, and repeating table headers.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2];

const PRINT_CSS = `
/* ---- print: margins on @page so EVERY page gets them ---- */
@page{size:A4;margin:11mm 13mm 10mm}
@media print{
  html,body{background:#fff!important}
  .sheet{margin:0!important;padding:0!important;width:auto!important;min-height:0!important;
    box-shadow:none!important;border:0!important;overflow:visible!important}
  /* The watermark is decorative and bleeds off the corner. Inside a margin box
     it would sit in the middle of nowhere, so it is dropped when printing. */
  .wm{display:none!important}
  /* Never strand a heading at the foot of a page, never split a row, a box or
     a signature line across two. */
  thead{display:table-header-group}
  tfoot{display:table-footer-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  .box,.note,.sig,.facts,.meta,.docfoot,.totals,.parties,.party,.bandnote,.kv{
    break-inside:avoid;page-break-inside:avoid}
  h1,h2,h3,.band,tr.chapter,.doctype{break-after:avoid;page-break-after:avoid}
  tr.chapter+tr{break-before:avoid;page-break-before:avoid}
  p,li,td{orphans:3;widows:3}
  table{break-inside:auto}
  /* A hair of print scale. The documents sit at 82-89%% of the page height and
     their legal footer needs another 8-10%% — just over, so eleven of the
     twenty sent nothing but a company-registry line to a sheet of its own.
     Five percent recovers it: 10.5pt body becomes 10pt, which nobody notices,
     while a page carrying one line is visible to everybody. Also saves five
     sheets across the set. */
  .sheet{zoom:0.95}

}
`;

let n = 0;
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) {
      let s = fs.readFileSync(p, "utf8");
      if (s.includes("CANEI-PRINT-FIX")) continue;
      // Appended last so it wins on specificity ties without editing the
      // designer's stylesheet — their file stays readable and diffable.
      s = s.replace("</head>", `<style>/* CANEI-PRINT-FIX */${PRINT_CSS}</style>\n</head>`);
      fs.writeFileSync(p, s);
      n++;
    }
  }
};
walk(ROOT);
console.log(`patched ${n} files`);

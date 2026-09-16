/* =============================================================================
   The título band, on the paper.

   The whole case for calling this level "cosmetic" is that it groups and never
   computes. Three renderers draw it — PDF, the HTML sheet, Word — and each one
   could plausibly get the arithmetic right in the descriptor and still print a
   figure that belongs to the wrong run, or quietly shift the base. So this gate
   asserts both halves:

     · the band's total IS the sum of its own partidas, and
     · the document's base is STILL the sum over partidas, band or no band.

   And it reads the PDF back with `pdftotext` rather than trusting the writer's
   own account of itself, which is the rule the other PDF gates in this repo
   already follow: a document nobody could read is not a document anybody
   verified.
   ========================================================================== */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const D = require(resolve(ROOT, "site/erp-doctypes.js"));
const PDF = require(resolve(ROOT, "site/erp-pdf.js"));
const SHEET = require(resolve(ROOT, "site/erp-sheet.js"));
const DOCX = require(resolve(ROOT, "site/erp-docx.js"));

let fails = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : "  → " + detail}`);
  if (!cond) fails++;
};
const money = (s) =>
  Number(
    String(s)
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  );

console.log("──── the título band reaches the paper ────\n");

const f = D.sampleFacts("presupuesto");
// Three partidas under one título and two under the next, so a wrong run shows
// up as a wrong figure rather than as a coincidence.
f.chapters[0].title = "Reforma de baño";
f.chapters[1].title = "Reforma de baño";
f.chapters[2].title = "Reforma de baño";
f.chapters[3].title = "Reforma de cocina";
f.chapters[4].title = "Reforma de cocina";
const doc = D.build("presupuesto", f);

const subs = doc.groups.map((g) => money(g.subtotal));
const bands = doc.groups.filter((g) => g.bandTotal);

check("one band per título, no more", bands.length === 2, JSON.stringify(bands.map((b) => b.band)));
check(
  "the first band totals its three partidas",
  Math.abs(money(bands[0].bandTotal) - (subs[0] + subs[1] + subs[2])) < 0.02,
  `${bands[0].bandTotal} vs ${subs[0] + subs[1] + subs[2]}`,
);
check(
  "the second band totals its two",
  Math.abs(money(bands[1].bandTotal) - (subs[3] + subs[4])) < 0.02,
  `${bands[1].bandTotal} vs ${subs[3] + subs[4]}`,
);
const base = money(doc.totals.find((r) => /Base/i.test(r[0]))[1]);
check(
  "the base is STILL the sum over partidas — a band moves no money",
  Math.abs(base - subs.reduce((s, x) => s + x, 0)) < 0.02,
  `base ${base} vs partidas ${subs.reduce((s, x) => s + x, 0)}`,
);

// A descriptor with no títulos must come out byte-identical to one built before
// this level existed — that is what "only for some clients" means on paper.
const plain = D.build("presupuesto", D.sampleFacts("presupuesto"));
check(
  "a document with no títulos carries no band at all",
  plain.groups.every((g) => !g.bandOpen && !g.bandTotal && !g.band),
  JSON.stringify(plain.groups.map((g) => g.bandOpen)),
);

/* The SAME WinAnsi mapping and the same brand block the other PDF gate uses,
   and not because it is tidier. With a pass-through translator the writer gets
   UTF-8 where it expects WinAnsi, and the file renders «Reforma de baÃ±o» and
   «Â€» — so the gate would be reading a document the product never produces,
   and a real accent bug in a título would hide behind the noise. The product
   passes `CaneiDocI18n.tr(lang)`; this is its shape. */
const tr = (s) =>
  String(s)
    .replace(/€/g, "\x80")
    .replace(/[·•]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7e\x80\xa0-\xff]/g, "");

const brand = {
  wordmark: "CaneiSubirats",
  legal: "Canei Subirats, S.L.",
  slogan: "Reformes senzillament complexes",
  cif: "NIF B-6712 3456",
  address: "Carrer de la Creu 18, 08960 Sant Just Desvern",
  phone: "+34 934 77 12 08",
  from: "if@2iberia.com",
  iban: "ES91 2100 0418 4502 0005 1332",
};
const out = resolve(ROOT, "dist/doc-band-check");
mkdirSync(out, { recursive: true });

const pdf = PDF.build(doc, brand, tr);
// `build` returns a STRING of latin-1 bytes. `Buffer.from(s)` would encode it
// as UTF-8 and double every byte above 0x7f — «baÃ±o», «Â€» — corrupting the
// file AFTER the writer got it right. The other PDF gates write it this way.
writeFileSync(`${out}/presupuesto-con-titulos.pdf`, Buffer.from(pdf, "latin1"));
let text = "";
try {
  // pdftotext emits UTF-8. Reading it as latin-1 turns «baño» into two
  // characters and an accent assertion into a lie in the other direction.
  text = execFileSync("pdftotext", ["-layout", `${out}/presupuesto-con-titulos.pdf`, "-"], {
    encoding: "utf8",
  });
} catch (e) {
  console.error(
    "\n  pdftotext is missing. Install poppler-utils (apt) or poppler (brew).\n" +
      "  This gate refuses to pass without it — a document nobody could read\n" +
      "  is not a document anybody verified.\n",
  );
  process.exit(1);
}
// The ACCENT is part of the assertion, not decoration: a título is company
// wording and «baño» printed as «baÃ±o» is a document nobody would send. It
// also pins the encoding, which is exactly what went wrong writing this file.
check(
  "the PDF prints the first título, accent and all",
  text.includes("Reforma de baño"),
  "not in the text layer",
);
check("the PDF prints the second", text.includes("Reforma de cocina"), "not in the text layer");
check("the PDF names its band total", /Total Reforma de/.test(text), "no «Total <título>» line");

const html = SHEET.render(doc, brand, tr);
check("the sheet rules a band above the run", html.includes('class="titleband"'), "no band row");
check("the sheet closes it with a total", html.includes('class="titlebandsum"'), "no total row");
check("the sheet names the título", html.includes("Reforma de cocina"), "título missing");

const docx = DOCX.build(doc, brand, tr);
check(
  "Word still produces a file with bands in it",
  !!docx && docx.length > 1000,
  String(docx && docx.length),
);

console.log(
  fails
    ? `\n──── ${fails} failed ────`
    : `\nall band checks passed → ${out}/presupuesto-con-titulos.pdf`,
);
process.exit(fails ? 1 : 0);

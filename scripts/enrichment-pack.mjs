/**
 * THE ENRICHMENT SETUP GUIDE AS A PDF.
 *
 * docs/market/barcelona/ENRICHMENT-OPTIONS.md says which doors exist and, since
 * the operator asked for "what where how to set it up", exactly where each
 * switch is. That is an instruction sheet somebody follows with a browser open
 * in the other window, so it goes out as its own document rather than as a
 * sixteenth appendix inside a 183-page binder nobody opens at the console.
 *
 * The cover states the coverage the document is about — computed from the data
 * files, not typed — so a guide that claims to close a gap cannot quietly
 * disagree with the workbook about how big the gap is.
 *
 * Run:  node scripts/enrichment-pack.mjs
 * Out:  dist/market-pack/ENRICHMENT-SETUP-GUIDE.pdf
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  esc,
  mdToHtml,
  page,
  launchChromium,
  renderPdf,
  pagesOf,
  assertInText,
} from "./lib/md-pdf.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "docs/market/barcelona");
const OUT = path.join(ROOT, "dist/market-pack");
const DOC = path.join(SRC, "ENRICHMENT-OPTIONS.md");
const PDF = path.join(OUT, "ENRICHMENT-SETUP-GUIDE.pdf");
const FOOTER = "Canei Subirats · ERP factory · Enrichment setup guide";
fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(DOC)) throw new Error("no ENRICHMENT-OPTIONS.md to bind");

/* ------------------------------------------------- coverage, from the files */
const jsonl = (f) =>
  fs.existsSync(path.join(SRC, f))
    ? fs
        .readFileSync(path.join(SRC, f), "utf8")
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
    : [];
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(s\.?l\.?u?\.?|s\.?a\.?|sl|slu|sa|scp)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/* The same precedence the workbook resolves with: the audited extraction first,
   then each enrichment pass behind it. A cover that counted differently from
   the spreadsheet would be the third version of the same number. */
const keyed = (rows) => {
  const m = {};
  for (const r of rows) m[norm(r.legal_name)] = Object.assign(m[norm(r.legal_name)] || {}, r);
  return m;
};
const prospects = jsonl("04-PROSPECTS.jsonl");
const chain = ["04d-ENRICHED.jsonl", "04c-ENRICHED.jsonl", "04b-CONTACTS.jsonl"].map((f) =>
  keyed(jsonl(f)),
);
const FIELDS = [
  ["phone", "Telephone"],
  ["email", "Email"],
  ["website", "Website"],
  ["address", "Address"],
  ["owner_name", "Administrator"],
];
const coverage = FIELDS.map(([f, label]) => {
  const n = prospects.filter((p) => {
    const k = norm(p.legal_name);
    for (const v of [p[f], ...chain.map((c) => (c[k] || {})[f])])
      if (v !== undefined && v !== null && v !== "") return true;
    return false;
  }).length;
  return { label, n, of: prospects.length };
});

/* ------------------------------------------------------------------ render */
/* The cover already carries the title, so the document's own H1 would print it
   twice, three centimetres apart. */
const md = fs.readFileSync(DOC, "utf8").replace(/^#\s+.*\n/, "");
const headings = md
  .split("\n")
  .filter((l) => /^##\s+/.test(l))
  .map((l) =>
    l
      .replace(/^##\s+/, "")
      .replace(/\*\*/g, "")
      .trim(),
  );

const browser = await launchChromium();
const pg = await browser.newPage();
await renderPdf(
  pg,
  PDF,
  page(`
  <p class="kicker">Canei Subirats · ERP factory</p>
  <h1>Filling the rest of the prospect data</h1>
  <p class="lede">Three ways to open the door this session is standing behind, what each
   one costs, and — for every one of them — where the switch is and what to click.
   Two of the three are free and between them they close both of the gaps that
   matter: the telephone numbers and the email addresses.</p>
  <div class="env"><dl>
    <dt>Applies to</dt><dd>${prospects.length} Barcelona-region firms · <code>BARCELONA-PIPELINE.xlsx</code></dd>
    <dt>Generated</dt><dd>${new Date().toISOString().slice(0, 10)}</dd>
    <dt>Coverage today</dt><dd>${coverage.map((c) => `${esc(c.label)} ${c.n}/${c.of}`).join(" · ")}</dd>
    <dt>Doors open now</dt><dd>web search only — <code>direct</code> and <code>places</code> are both shut</dd>
  </dl></div>
  <div class="warn"><b>The short version.</b> Set the environment's Network access to
   <b>Full</b> (free, about two minutes) and add a Google Places API key (free at this
   volume, about fifteen). Then run one command. Section 8 is the order of attack;
   everything before it is why, and everything in between is where to click.</div>
  <hr>
  ${mdToHtml(md)}
`),
  FOOTER,
);
await browser.close();

assertInText(PDF, headings);

console.log(PDF);
console.log(
  `${pagesOf(PDF)} pages · ${(fs.statSync(PDF).size / 1024).toFixed(0)} KB · ${headings.length} sections`,
);
for (const c of coverage) console.log(`  ${String(c.n).padStart(3)}/${c.of}  ${c.label}`);

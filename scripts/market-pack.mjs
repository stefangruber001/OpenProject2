/**
 * THE MARKET ROADMAP AS ONE PDF — the decision document first, then every
 * phase artefact as an appendix, then the roadmap prompt itself.
 *
 * Section by section and bound with `pdfunite`, as scripts/sample-emails-pack.mjs
 * does, so the page count per section can be reported and a missing artefact
 * is a missing section rather than a silently shorter document.
 *
 * The markdown converter, the print stylesheet and the Chromium resolution live
 * in scripts/lib/md-pdf.mjs, shared with scripts/enrichment-pack.mjs.
 *
 * Run:  node scripts/market-pack.mjs
 * Out:  dist/market-pack/BARCELONA-TENANT-ROADMAP.pdf
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
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
const SECTIONS = path.join(OUT, "sections");
const FOOTER = "Canei Subirats · ERP factory · Barcelona tenant roadmap";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(SECTIONS, { recursive: true });

/* ------------------------------------------------------------- the sections */
const ORDER = [
  ["12-SYNTHESIS.md", "Decision document"],
  ["00-REFERENCE-CASE.md", "Appendix A · Reference case"],
  ["01-MARKET-MAP.md", "Appendix B · Market map"],
  ["02-ICP-AND-RUBRIC.md", "Appendix C · ICP and scoring rubric"],
  ["03-TRIGGER-MAP.md", "Appendix D · Trigger and regulatory map"],
  ["04a-SOURCE-PLAN.md", "Appendix E · Sourcing plan"],
  ["04-EXTRACTION-QA.md", "Appendix F · Extraction QA"],
  ["05-TARGET-LIST.md", "Appendix G · Target list"],
  ["06-VALUE-CASE.md", "Appendix H · Value case"],
  ["07-TAILORING-ECONOMICS.md", "Appendix I · Tailoring economics"],
  ["08-GTM-PLAN.md", "Appendix J · Go-to-market plan"],
  ["09-OUTREACH-KIT.md", "Appendix K · Outreach kit"],
  ["10-PILOT-SPEC.md", "Appendix L · Pilot specification"],
  ["11-RED-TEAM.md", "Appendix M · Red team"],
  ["ROADMAP.md", "Appendix N · The roadmap prompt"],
];
const present = ORDER.filter(([f]) => fs.existsSync(path.join(SRC, f)));
const missing = ORDER.filter(([f]) => !fs.existsSync(path.join(SRC, f))).map(([f]) => f);
const prospects = path.join(SRC, "04-PROSPECTS.jsonl");
const prospectRows = fs.existsSync(prospects)
  ? fs
      .readFileSync(prospects, "utf8")
      .split("\n")
      .filter((l) => l.trim()).length
  : 0;

const browser = await launchChromium();
const pg = await browser.newPage();
const bound = [];
async function renderTo(file, html) {
  await renderPdf(pg, file, html, FOOTER);
  bound.push(file);
}

// Sections first, so the cover can state their page counts.
const sectionFiles = [];
for (const [idx, [f, title]] of present.entries()) {
  const md = fs.readFileSync(path.join(SRC, f), "utf8");
  const file = path.join(
    SECTIONS,
    `${String(idx + 1).padStart(2, "0")}-${f.replace(/\.md$/, "")}.pdf`,
  );
  await renderTo(file, page(`<p class="kicker">${esc(title)}</p>${mdToHtml(md)}`));
  sectionFiles.push({
    f,
    title,
    file,
    pages: pagesOf(file),
    words: md.split(/\s+/).filter(Boolean).length,
  });
}

const cover = path.join(SECTIONS, "00-cover.pdf");
await renderPdf(
  pg,
  cover,
  page(`
  <p class="kicker">Canei Subirats · ERP factory</p>
  <h1>Barcelona tenant roadmap</h1>
  <p class="lede">Where the next customers of this ERP are in the Barcelona region, which of
   them to approach first, what it will cost to tailor the product to each, and the
   evidence behind every one of those claims. Twelve phases, each run by its own
   model and each feeding the next, executed unattended on the operator's instruction.</p>
  <div class="env"><dl>
    <dt>Reference tenant</dt><dd>Canei Subirats, S.L. — construction and renovation, Sant Just Desvern</dd>
    <dt>Generated</dt><dd>${new Date().toISOString().slice(0, 10)}</dd>
    <dt>Prospects extracted</dt><dd>${prospectRows} firms (04-PROSPECTS.jsonl, company-level public data only)</dd>
    <dt>Sections</dt><dd>${sectionFiles.length} of ${ORDER.length}</dd>
  </dl></div>
  <h2>Contents</h2>
  <table><thead><tr><th>Section</th><th>File</th><th>Words</th><th>Pages</th></tr></thead><tbody>
  ${sectionFiles.map((s) => `<tr><td>${esc(s.title)}</td><td><code>${esc(s.f)}</code></td><td>${s.words.toLocaleString("en-GB")}</td><td>${s.pages}</td></tr>`).join("")}
  </tbody></table>
  ${missing.length ? `<div class="warn"><b>Not present in this binding:</b> ${missing.map(esc).join(", ")}. Each is recorded as a gap in the synthesis rather than omitted silently.</div>` : ""}
  <div class="warn"><b>Read the decision document first.</b> It is the one section written to be
   read end to end; the appendices are the evidence and are meant to be consulted.
   Where the evidence is thin, the synthesis says so in its body.</div>
`),
);
await browser.close();

const PACK = path.join(OUT, "BARCELONA-TENANT-ROADMAP.pdf");
const unite = spawnSync("pdfunite", [cover, ...bound, PACK], { encoding: "utf8" });
if (unite.status !== 0) throw new Error("pdfunite failed: " + unite.stderr);

/* The pack has to contain what it claims to. */
assertInText(
  PACK,
  sectionFiles.map((s) => s.title),
);

console.log(PACK);
console.log(
  `${pagesOf(PACK)} pages · ${(fs.statSync(PACK).size / 1024).toFixed(0)} KB · ${sectionFiles.length} sections${missing.length ? ` · MISSING: ${missing.join(", ")}` : ""}`,
);
for (const s of sectionFiles) console.log(`  ${s.pages.padStart(3)} pp  ${s.f}`);

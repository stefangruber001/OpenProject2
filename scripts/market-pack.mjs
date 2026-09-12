/**
 * THE MARKET ROADMAP AS ONE PDF — the decision document first, then every
 * phase artefact as an appendix, then the roadmap prompt itself.
 *
 * Section by section and bound with `pdfunite`, as scripts/sample-emails-pack.mjs
 * does, so the page count per section can be reported and a missing artefact
 * is a missing section rather than a silently shorter document.
 *
 * Markdown is rendered by a small converter in this file. The workspace has no
 * markdown library and adding one for a report binder would put a dependency
 * on the lockfile for the sake of one script; the artefacts are model-written
 * markdown — headings, paragraphs, lists, GFM tables, bold, code — which this
 * handles, and anything it does not is left as text rather than dropped.
 *
 * Run:  node scripts/market-pack.mjs
 * Out:  dist/market-pack/BARCELONA-TENANT-ROADMAP.pdf
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "docs/market/barcelona");
const OUT = path.join(ROOT, "dist/market-pack");
const SECTIONS = path.join(OUT, "sections");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(SECTIONS, { recursive: true });

const PW = path.resolve(
  ROOT,
  "node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js",
);
const CHROME =
  process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find((p) =>
    fs.existsSync(p),
  );
const chromium = await (async () => {
  for (const spec of [PW, "playwright-core", "playwright"]) {
    try {
      const m = await import(spec);
      if ((m.default || m).chromium) return (m.default || m).chromium;
    } catch {}
  }
  throw new Error("playwright-core not found");
})();

/* ------------------------------------------------------------ markdown → html */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<i>$2</i>");
  t = t.replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<i>$2</i>");
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, a, u) => `<a href="${u}">${a}</a>`);
  return t;
}
function mdToHtml(md) {
  const lines = md.replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l)) {
      i += 1;
      continue;
    }
    if (/^```/.test(l)) {
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i += 1;
      out.push(`<pre>${esc(buf.join("\n"))}</pre>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2].replace(/\s#+$/, ""))}</h${h[1].length}>`);
      i += 1;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) {
      out.push("<hr>");
      i += 1;
      continue;
    }
    if (/^\s*\|/.test(l) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const cells = (r) =>
        r
          .replace(/^\s*\|/, "")
          .replace(/\|\s*$/, "")
          .split("|")
          .map((c) => inline(c.trim()));
      const head = cells(l);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>` +
          rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") +
          `</tbody></table>`,
      );
      continue;
    }
    if (/^\s*>/.test(l)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i]))
        buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push(`<blockquote>${mdToHtml(buf.join("\n"))}</blockquote>`);
      continue;
    }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(l);
    if (li) {
      // One list, with one level of nesting by indentation.
      const ordered = /\d/.test(li[2]);
      const base = li[1].length;
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (m && m[1].length <= base) {
          items.push({ text: m[3], sub: [] });
          i += 1;
          continue;
        }
        if (m && m[1].length > base && items.length) {
          items[items.length - 1].sub.push(m[3]);
          i += 1;
          continue;
        }
        // A continuation line indented under the item.
        if (/^\s{2,}\S/.test(lines[i]) && !/^\s*$/.test(lines[i]) && items.length) {
          items[items.length - 1].text += " " + lines[i].trim();
          i += 1;
          continue;
        }
        break;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(
        `<${tag}>` +
          items
            .map(
              (it) =>
                `<li>${inline(it.text)}${it.sub.length ? `<ul>${it.sub.map((s) => `<li>${inline(s)}</li>`).join("")}</ul>` : ""}</li>`,
            )
            .join("") +
          `</${tag}>`,
      );
      continue;
    }
    // Paragraph: until a blank line or a block opener.
    const buf = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6}\s|```|\s*\||\s*>|\s*([-*+]|\d+[.)])\s)/.test(lines[i])
    )
      buf.push(lines[i++]);
    if (buf.length) out.push(`<p>${inline(buf.join(" "))}</p>`);
    else i += 1;
  }
  return out.join("\n");
}

/* ------------------------------------------------------------------- chrome */
const CSS = `
  @page { size: A4; margin: 17mm 15mm 18mm; }
  body { font:400 10pt/1.5 Georgia,'Times New Roman',serif; color:#2B2B2B; margin:0; }
  h1 { font:400 22pt/1.15 Georgia,serif; color:#000; margin:0 0 5mm; }
  h2 { font:400 15pt/1.2 Georgia,serif; color:#000; margin:7mm 0 3mm; border-bottom:1.5px solid #48733C; padding-bottom:1.5mm; }
  h3 { font:700 11pt/1.3 Inter,Arial,sans-serif; color:#2E4A27; margin:5mm 0 2mm; }
  h4,h5,h6 { font:700 10pt/1.3 Inter,Arial,sans-serif; margin:4mm 0 1.5mm; }
  p { margin:0 0 2.6mm; }
  ul,ol { margin:0 0 3mm; padding-left:6mm; } li { margin:0 0 1mm; } li ul { margin:1mm 0 0; }
  table { width:100%; border-collapse:collapse; font:400 8.3pt/1.35 Inter,Arial,sans-serif; margin:2mm 0 4mm; page-break-inside:auto; }
  th { text-align:left; border-bottom:1.5px solid #48733C; padding:1.6mm 1.8mm; font-weight:700; color:#000; font-size:7.6pt; letter-spacing:.04em; text-transform:uppercase; vertical-align:bottom; }
  td { border-bottom:.5px solid #D8D8D4; padding:1.5mm 1.8mm; vertical-align:top; }
  tr { page-break-inside:avoid; } tr:nth-child(even) td { background:#F6F6F4; }
  code { font:400 8.6pt 'SF Mono',Menlo,Consolas,monospace; background:#F3F3F0; padding:0 .8mm; }
  pre { font:400 8pt/1.4 'SF Mono',Menlo,Consolas,monospace; background:#F6F6F4; border:1px solid #D8D8D4; padding:3mm; white-space:pre-wrap; word-break:break-word; }
  blockquote { margin:0 0 3mm; padding:2mm 4mm; border-left:3px solid #48733C; background:#F6F6F4; }
  hr { border:0; border-top:1px solid #D8D8D4; margin:5mm 0; }
  a { color:#2E4A27; text-decoration:none; }
  .kicker { font:700 7.5pt/1 Inter,Arial,sans-serif; letter-spacing:.22em; text-transform:uppercase; color:#48733C; margin:0 0 3mm; }
  .lede { font-size:11pt; max-width:155mm; margin:0 0 5mm; }
  .env { border:1px solid #D8D8D4; border-left:3px solid #48733C; background:#F6F6F4; padding:4mm 5mm; margin:0 0 5mm; font:400 9.5pt/1.6 Inter,Arial,sans-serif; }
  .env dl { margin:0; display:grid; grid-template-columns:30mm 1fr; gap:1mm 3mm; }
  .env dt { font-weight:700; color:#48733C; font-size:7.8pt; letter-spacing:.05em; text-transform:uppercase; padding-top:.6mm; } .env dd { margin:0; }
  .warn { border:1px solid #C8A33C; background:#FBF6E7; padding:3mm 4mm; margin:0 0 5mm; font:400 9.5pt/1.5 Inter,Arial,sans-serif; color:#5B4A12; }
`;
const page = (inner) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${inner}</body></html>`;

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

const browser = await chromium.launch({ executablePath: CHROME });
const pg = await browser.newPage();
const bound = [];
async function renderTo(file, html) {
  await pg.setContent(html, { waitUntil: "load" });
  await pg.emulateMedia({ media: "print" });
  await pg.pdf({
    path: file,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font:7.5pt Georgia,serif;color:#6B6B6B;padding:0 15mm;display:flex;justify-content:space-between"><span>Canei Subirats · ERP factory · Barcelona tenant roadmap</span><span class="pageNumber"></span></div>`,
    margin: { top: "17mm", bottom: "18mm", left: "15mm", right: "15mm" },
  });
  bound.push(file);
}
const pagesOf = (f) =>
  (/^Pages:\s*(\d+)/m.exec(spawnSync("pdfinfo", [f], { encoding: "utf8" }).stdout || "") || [
    ,
    "?",
  ])[1];

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
await pg.setContent(
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
  { waitUntil: "load" },
);
await pg.emulateMedia({ media: "print" });
await pg.pdf({
  path: cover,
  format: "A4",
  printBackground: true,
  margin: { top: "17mm", bottom: "18mm", left: "15mm", right: "15mm" },
});
await browser.close();

const PACK = path.join(OUT, "BARCELONA-TENANT-ROADMAP.pdf");
const unite = spawnSync("pdfunite", [cover, ...bound, PACK], { encoding: "utf8" });
if (unite.status !== 0) throw new Error("pdfunite failed: " + unite.stderr);

/* The pack has to contain what it claims to. */
const text = spawnSync("pdftotext", [PACK, "-"], { encoding: "utf8" }).stdout || "";
const lost = sectionFiles
  .filter((s) => !text.includes(s.title.replace(/·/g, "·")))
  .map((s) => s.title);
if (lost.length) throw new Error("sections missing from the text layer: " + lost.join(", "));

console.log(PACK);
console.log(
  `${pagesOf(PACK)} pages · ${(fs.statSync(PACK).size / 1024).toFixed(0)} KB · ${sectionFiles.length} sections${missing.length ? ` · MISSING: ${missing.join(", ")}` : ""}`,
);
for (const s of sectionFiles) console.log(`  ${s.pages.padStart(3)} pp  ${s.f}`);

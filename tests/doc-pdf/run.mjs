/**
 * The PDF writer must produce a real document, not a plausible one.
 *
 * The writer it replaces emitted `Count 1` — a single page, always — so a quote
 * with more chapters than fit was silently truncated. That is the first thing
 * asserted here, with deliberately more content than one page can hold.
 *
 * Run:  node tests/doc-pdf/run.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import fs from "node:fs";
import { requirePoppler } from "../doc-print/poppler.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
requirePoppler();

const OUT = resolve(ROOT, "dist/doc-pdf-check");
fs.mkdirSync(OUT, { recursive: true });

// Loaded the way the browser loads it — as a script that publishes a global.
// Importing it as an ES module takes the UMD's global branch, so the named
// export is undefined and the failure looks like a missing function.
const { createContext, runInContext } = await import("node:vm");
const sandbox = { globalThis: null, module: undefined, console };
sandbox.globalThis = sandbox;
createContext(sandbox);
runInContext(fs.readFileSync(resolve(ROOT, "site/erp-pdf.js"), "utf8"), sandbox);
const { build } = sandbox.CaneiPdf;

// The same WinAnsi mapping journey.html uses.
const tr = (s) =>
  String(s)
    .replace(/€/g, "\x80")
    .replace(/[·•]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7e\x80\xa0-\xff]/g, "");

const BRAND = {
  wordmark: "CaneiSubirats",
  legal: "Canei Subirats, S.L.",
  slogan: "Reformes senzillament complexes",
  cif: "NIF B-6712 3456",
  address: "Carrer de la Creu 18, 08960 Sant Just Desvern",
  phone: "+34 934 77 12 08",
  from: "if@2iberia.com",
  iban: "ES91 2100 0418 4502 0005 1332",
};

const eur = (c) =>
  (c / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

// Deliberately long: 9 chapters x 5 rows cannot fit on one page, so a writer
// that silently truncates fails loudly here.
const CH = [
  "01 · Demolición y trabajos previos",
  "02 · Impermeabilización",
  "03 · Fontanería",
  "04 · Calefacción y climatización",
  "05 · Electricidad",
  "06 · Revestimientos y acabados",
  "07 · Carpintería",
  "08 · Vidrio y mamparas",
  "09 · Limpieza y entrega",
];
const groups = CH.map((chapter, i) => ({
  chapter,
  rows: Array.from({ length: 5 }, (_, j) => ({
    item: `Partida ${j + 1} del capítulo — descripción larga que debe ajustarse a la columna sin desbordar el ancho disponible`,
    note: j === 0 ? "Incluye protección de accesos y retirada de escombros" : "",
    qtyLabel: (12.5 + j).toFixed(2).replace(".", ","),
    unit: "m²",
    priceLabel: eur(1840 + j * 310),
    amount: eur((1840 + j * 310) * 3),
  })),
  subtotal: eur(90000 + i * 1000),
}));

const doc = {
  docType: "Presupuesto",
  number: "PRE-2026-0014",
  title: "Reforma integral de baño comunitario",
  subtitle: "Carrer de Balmes 120, esc. A · 08008 Barcelona",
  audience: "cliente",
  meta: [
    ["Fecha", "12/05/2026"],
    ["Válido hasta", "11/06/2026"],
    ["Versión", "1.0"],
    ["Contacto", "+34 934 77 12 08"],
  ],
  facts: [
    ["Total (IVA incl.)", eur(1121560)],
    ["Base imponible", eur(1019600)],
    ["IVA", "10 %"],
    ["Plazo", "18 días lab."],
  ],
  parties: [
    {
      label: "Emisor",
      name: "Canei Subirats, S.L.",
      lines: [
        "NIF B-6712 3456",
        "Carrer de la Creu 18, baixos",
        "08960 Sant Just Desvern",
        "if@2iberia.com",
      ],
    },
    {
      label: "Cliente",
      name: "Comunidad de Propietarios Balmes 120",
      lines: [
        "NIF H-0857 1730",
        "Jordi Vives (administrador de fincas)",
        "Carrer de Balmes 120, esc. A",
        "08008 Barcelona",
      ],
    },
  ],
  intro:
    "Obra: baño planta baja · 5,0 × 2,5 m (12,5 m² de suelo, 37 m² de paredes). Ascensor disponible, aparcamiento en calle. Plazo estimado: 18 días laborables desde la firma.",
  tableLabel: "Detalle por capítulos",
  tableNote: "precios unitarios sin IVA",
  groups,
  totals: [
    ["Base imponible", eur(1019600)],
    ["IVA 10 % — reforma de vivienda", eur(101960)],
    ["Total", eur(1121560)],
  ],
  payment: [
    "40 % a la firma, 40 % a mitad de obra certificada, 20 % a la entrega.",
    "Transferencia a ES91 2100 0418 4502 0005 1332.",
    "Plazo de pago: 30 días desde la fecha de factura.",
  ],
  notes: [
    "No incluye licencias municipales ni tasas de la comunidad.",
    "Garantía: 3 años en instalaciones y 1 año en acabados.",
  ],
  signatures: ["Por Canei Subirats, S.L.", "Conforme — el cliente (firma y fecha)"],
};

const pdf = build(doc, BRAND, tr);
const file = resolve(OUT, "presupuesto.pdf");
fs.writeFileSync(file, Buffer.from(pdf, "latin1"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
};

const bytes = fs.readFileSync(file);
const pageCount = (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
check("it is a PDF", bytes.subarray(0, 5).toString() === "%PDF-");
check("it paginates instead of truncating", pageCount >= 2, `${pageCount} pages`);

const txt = spawnSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }).stdout || "";
check(
  "every chapter survived to the page",
  CH.every((c) => txt.includes(c.split("· ")[1])),
  CH.filter((c) => !txt.includes(c.split("· ")[1])).join(", ") || "all 9 present",
);
check("the grand total is present", txt.includes("11.215,60"));
check("Spanish accents survive", /Fontanería|Impermeabilización/.test(txt));
check("the euro sign survives", txt.includes("€"));
check("headings are searchable", txt.includes("PRESUPUESTO") && !/P\s R\s E\s S/.test(txt));
// Tolerant of spacing: pdftotext -layout collapses "1 / 5" to "1/5", and
// asserting on the literal spacing tests the extractor, not the document.
check(
  "every page is numbered",
  Array.from({ length: pageCount }, (_, i) =>
    new RegExp(`\\b${i + 1}\\s*/\\s*${pageCount}\\b`).test(txt),
  ).every(Boolean),
  `1..${pageCount} of ${pageCount}`,
);
check("the legal footer is on the page", txt.includes("Canei Subirats, S.L."));

// The margin rule the HTML templates are held to, applied to the writer too.
const bbox = spawnSync("pdftotext", ["-bbox", file, "-"], { encoding: "utf8" }).stdout || "";
let closest = Infinity;
let wordsSeen = 0;
for (const page of bbox.split(/<page\b/).slice(1)) {
  const m = /width="([\d.]+)"\s+height="([\d.]+)"/.exec(page);
  const W = m ? +m[1] : 595.28,
    H = m ? +m[2] : 841.89;
  for (const w of page.matchAll(
    /xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g,
  )) {
    wordsSeen++;
    const e = Math.min(+w[1], +w[2], W - +w[3], H - +w[4]);
    closest = Math.min(closest, (e / 72) * 25.4);
  }
}
// Measured, or failed — never "999mm and therefore fine". In CI this exact
// assertion passed on a PDF that nothing had read, because the sentinel stood in
// for a measurement that never happened.
check("the document could be read back at all", wordsSeen > 50, `${wordsSeen} words extracted`);
check(
  "no ink inside the printable border",
  wordsSeen > 0 && closest >= 9.5,
  wordsSeen ? `${closest.toFixed(1)}mm from the edge` : "nothing measured",
);

/* ==========================================================================
   Every document type, not just the quote.

   The writer used to be exercised by one document, which is how `Count 1`
   survived: the sample fitted on a page, so nothing complained. Each of the
   sixteen PDF documents is built TWICE — once with ordinary data and once with
   every list inflated until it cannot fit — and the inflated build has to still
   contain the LAST item of every list it was given. That is the assertion that
   catches truncation; page count alone does not, because a writer that drops
   the overflow silently still reports the pages it did emit.
   ========================================================================== */

const docSandbox = { globalThis: null, module: undefined, console };
docSandbox.globalThis = docSandbox;
createContext(docSandbox);
runInContext(fs.readFileSync(resolve(ROOT, "site/erp-doctypes.js"), "utf8"), docSandbox);
const DT = docSandbox.CaneiDocTypes;

/** Repeat every row array so the document cannot fit on one page. */
function inflate(value, n, depth = 0) {
  if (Array.isArray(value)) {
    const grown = [];
    for (let i = 0; i < n; i++) for (const v of value) grown.push(inflate(v, 1, depth + 1));
    return grown;
  }
  if (value && typeof value === "object" && depth < 3) {
    const out = {};
    for (const k of Object.keys(value)) out[k] = inflate(value[k], n, depth + 1);
    return out;
  }
  return value;
}

/** Every string the descriptor asked to be printed, as a flat list. */
function printedStrings(node, out = [], depth = 0) {
  if (depth > 6) return out;
  if (typeof node === "string") {
    if (node.trim().length > 12) out.push(node.trim());
    return out;
  }
  if (Array.isArray(node)) {
    for (const v of node) printedStrings(v, out, depth + 1);
    return out;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) printedStrings(node[k], out, depth + 1);
  }
  return out;
}

const BASE14 = new Set([
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Times-Roman",
  "Times-Bold",
  "Times-Italic",
  "Times-BoldItalic",
  "Courier",
  "Courier-Bold",
  "Courier-Oblique",
  "Courier-BoldOblique",
  "Symbol",
  "ZapfDingbats",
]);

/**
 * The font decision, made a rule.
 *
 * Helvetica and Times were chosen over the design's own faces because every
 * reader ever written already has them. The risk that creates is not those two
 * faces — it is somebody later adding a custom one and NOT embedding it, which
 * is exactly the "opens wrong on the customer's machine" failure the operator
 * asked to avoid, and which would look perfect on the machine that added it.
 */
function fontProblems(raw) {
  const bad = [];
  const embedded = /\/FontFile[23]?\b/.test(raw);
  for (const m of raw.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+\-,.]+)/g)) {
    const name = m[1].replace(/^[A-Z]{6}\+/, "");
    if (!BASE14.has(name) && !embedded) bad.push(name);
  }
  return [...new Set(bad)];
}

const bulkOut = resolve(OUT, "all");
fs.mkdirSync(bulkOut, { recursive: true });
const facts = DT.sampleFacts();
const big = inflate(facts, 3);
// The chapter list drives the tables and is the one array whose growth changes
// page count for most documents; inflate() already multiplied it, but the codes
// have to stay distinct or "the last chapter is present" would pass on a copy
// of the first.
big.chapters = big.chapters.map((c, i) => ({
  ...c,
  code: String(i + 1).padStart(2, "0"),
  name: c.name + " (bloque " + (i + 1) + ")",
}));

console.log("\n──── every document type, inflated until it overflows ────");
let manyPage = 0;
for (const kind of DT.KINDS) {
  let descriptor, raw;
  try {
    descriptor = DT.build(kind, big);
    raw = build(descriptor, BRAND, tr);
  } catch (e) {
    check(`${kind}: builds`, false, String(e.message).slice(0, 90));
    continue;
  }
  const f = resolve(bulkOut, kind + ".pdf");
  fs.writeFileSync(f, Buffer.from(raw, "latin1"));
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
  if (pages > 1) manyPage++;

  const out = spawnSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8" }).stdout || "";
  // Case-folded and whitespace-free, for two reasons that are properties of the
  // DESIGN and not of the check: several blocks print their labels in capitals
  // (kvGrid, the band, the table head), and any string long enough to be worth
  // asserting on is wrapped across lines by the writer. Comparing raw text
  // would fail on documents that are perfectly correct — and a gate that cries
  // wolf is one somebody switches off.
  const squeezed = out.replace(/\s+/g, "").toLowerCase();

  // Truncation guard. Each descriptor is asked what it wanted printed, and the
  // LAST of those strings — the one a one-page writer loses — must be there.
  const wanted = printedStrings(descriptor);
  const tail = wanted.slice(-6);
  const missing = tail.filter((s) => {
    const t = tr(s).replace(/\s+/g, "").toLowerCase();
    return !squeezed.includes(t.slice(0, Math.min(24, t.length)));
  });

  const numbered = Array.from({ length: pages }, (_, i) =>
    new RegExp(`\\b${i + 1}\\s*/\\s*${pages}\\b`).test(out),
  ).every(Boolean);

  const bbox = spawnSync("pdftotext", ["-bbox", f, "-"], { encoding: "utf8" }).stdout || "";
  let near = Infinity,
    words = 0;
  for (const page of bbox.split(/<page\b/).slice(1)) {
    const m = /width="([\d.]+)"\s+height="([\d.]+)"/.exec(page);
    const W = m ? +m[1] : 595.28,
      H = m ? +m[2] : 841.89;
    for (const w of page.matchAll(
      /xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g,
    )) {
      words++;
      near = Math.min(near, (Math.min(+w[1], +w[2], W - +w[3], H - +w[4]) / 72) * 25.4);
    }
  }

  const badFonts = fontProblems(raw);
  const shattered = /\b(?:[A-Za-zÁÉÍÓÚÑ]\s){3,}[A-Za-zÁÉÍÓÚÑ]\b/.test(out);

  const problems = [];
  if (words < 40) problems.push(`only ${words} words extracted`);
  if (missing.length) problems.push(`missing tail: ${missing[0].slice(0, 44)}`);
  if (!numbered) problems.push("page numbering incomplete");
  if (!(near >= 9.5)) problems.push(`ink ${near.toFixed(1)}mm from the edge`);
  if (badFonts.length) problems.push(`non-base-14, not embedded: ${badFonts.join(", ")}`);
  if (shattered) problems.push("shattered heading");
  if (!/€|\x80/.test(out) && /€/.test(JSON.stringify(descriptor))) problems.push("euro sign lost");

  check(
    `${kind.padEnd(20)} ${String(pages).padStart(2)}p`,
    problems.length === 0,
    problems.join(" · ") || `${words} words, ${near.toFixed(1)}mm clear`,
  );
}

check(
  "the block primitives paginate",
  manyPage >= 12,
  `${manyPage} of ${DT.KINDS.length} documents ran past one page`,
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed → ${file}`);
process.exit(failed.length ? 1 : 0);

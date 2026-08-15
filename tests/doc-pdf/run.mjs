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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
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
let closest = 999;
for (const page of bbox.split(/<page\b/).slice(1)) {
  const m = /width="([\d.]+)"\s+height="([\d.]+)"/.exec(page);
  const W = m ? +m[1] : 595.28,
    H = m ? +m[2] : 841.89;
  for (const w of page.matchAll(
    /xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g,
  )) {
    const e = Math.min(+w[1], +w[2], W - +w[3], H - +w[4]);
    closest = Math.min(closest, (e / 72) * 25.4);
  }
}
check(
  "no ink inside the printable border",
  closest >= 9.5,
  `${closest.toFixed(1)}mm from the edge`,
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed → ${file}`);
process.exit(failed.length ? 1 : 0);

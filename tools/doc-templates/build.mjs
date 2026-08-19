/**
 * Every document the ERP produces in operation, as a standalone HTML file.
 *
 * WHY THIS EXISTS. The ERP builds its documents inline — the quote and invoice
 * PDFs in site/journey.html, the emails in the same file, the rest implied by
 * the numbering series in site/erp-engine.js. That is fine for producing them
 * and useless for redesigning them: there is no one place a designer can open,
 * change and hand back. This emits one file per document, self-contained, with
 * realistic data in every field, so the set can go out to a designer and come
 * back as templates.
 *
 * THE INVENTORY IS TAKEN FROM THE CODE, NOT FROM MEMORY. Every numbered
 * document type in the engine has an entry here:
 *
 *     budget PRE-  ·  contract CTR-  ·  invoice FAC-  ·  receipt REC-
 *     creditNote ABO-  ·  purchaseOrder OC-  ·  subcontract SUB-
 *
 * plus the artifacts the journey files per step (accepted quote, the four
 * emails), the progress valuations the engine tracks (`certifications`), the
 * site visits it schedules (`visits`), and the quarterly package it assembles
 * for the accountant (`quarterlyPackage`).
 *
 * A4 at 210×297mm with print CSS, so each one prints or exports to PDF exactly
 * as it appears. Fonts are system stacks — a designer will substitute their
 * own, and a webfont that fails to load is worse than a stack that never tries.
 *
 * Run:  node tools/doc-templates/build.mjs [outDir]
 */
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || path.resolve("dist/doc-templates");

/* The corporate palette — the same values site/*.html uses. */
const C = {
  green: "#48733c",
  deep: "#31532a",
  spark: "#f2c230",
  ink: "#14160f",
  body: "#4f5347",
  muted: "#8b8f80",
  line: "#dde5d6",
  wash: "#f4f7f1",
};

const SELLER = {
  name: "Canei Subirats, S.L.",
  nif: "B-6712 3456",
  address: "Carrer de la Creu 18, baixos",
  city: "08960 Sant Just Desvern",
  region: "Barcelona",
  phone: "+34 934 77 12 08",
  email: "if@2iberia.com",
  web: "www.caneisubirats.com",
  iban: "ES91 2100 0418 4502 0005 1332",
  registry:
    "Inscrita en el Registro Mercantil de Barcelona, Tomo 46.812, Folio 118, Hoja B-529.441",
};

const BUYER = {
  name: "Comunidad de Propietarios Balmes 120",
  nif: "H-0857 1730",
  contact: "Jordi Vives (administrador de fincas)",
  address: "Carrer de Balmes 120, esc. A",
  city: "08008 Barcelona",
  email: "vives@fincasvives.example",
  phone: "+34 934 00 00 00",
};

const SUPPLIER = {
  name: "Materials Ferrer i Fills, S.L.",
  nif: "B-6193 4477",
  contact: "Anna Ferrer",
  address: "Polígon Industrial Can Calopa, nau 7",
  city: "08960 Sant Just Desvern",
  email: "comandes@ferrerifills.example",
};

const eur = (cents) =>
  (cents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  " €";

/* ── the shared shell ──────────────────────────────────────────────────── */

const css = `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  font:400 10.5pt/1.5 Inter,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;
  color:${C.body}; background:#e9ede6; -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.sheet{
  width:210mm; min-height:297mm; margin:12mm auto; padding:18mm 16mm 22mm;
  background:#fff; position:relative; display:flex; flex-direction:column;
  box-shadow:0 1px 2px rgba(24,32,16,.05),0 30px 60px -32px rgba(24,32,16,.35);
}
@media print{
  body{background:#fff}
  .sheet{margin:0; box-shadow:none; width:auto; min-height:auto; padding:14mm 13mm 18mm}
  @page{size:A4; margin:0}
}
h1,h2,h3,.serif{font-family:"Roboto Serif",Georgia,"Times New Roman",serif; color:${C.ink}}
h1{font-size:20pt; font-weight:600; letter-spacing:-.01em; margin:0}
h2{font-size:12pt; font-weight:600; margin:0 0 6px}
.rule{height:3px;width:46px;border-radius:999px;background:linear-gradient(90deg,${C.green},${C.spark});margin:10px 0 0}
.eyebrow{font:600 8pt Inter,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${C.green}}
.muted{color:${C.muted}}
.small{font-size:8.5pt;line-height:1.45}
header.doc{display:flex;justify-content:space-between;align-items:flex-start;gap:16mm;padding-bottom:8mm;border-bottom:1px solid ${C.line}}
.mark{display:flex;align-items:center;gap:9px}
.mark .glyph{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,${C.deep},${C.green} 72%);
  display:grid;place-items:center;color:#fff;font:700 15px Inter,sans-serif}
.who{font:600 12pt/1.15 "Roboto Serif",Georgia,serif;color:${C.ink}}
.docref{text-align:right}
.docref .num{font:700 13pt Inter,sans-serif;color:${C.ink};letter-spacing:.02em}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin:8mm 0 7mm}
.party{background:${C.wash};border:1px solid ${C.line};border-radius:8px;padding:9px 11px}
.party .lbl{font:600 7.5pt Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${C.muted};margin-bottom:4px}
.party .nm{font-weight:600;color:${C.ink}}
table{width:100%;border-collapse:collapse;font-size:9.5pt}
thead th{font:600 7.5pt Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:${C.muted};
  text-align:left;padding:0 6px 6px;border-bottom:1.5px solid ${C.line}}
tbody td{padding:6px;border-bottom:1px solid #eef2ea;vertical-align:top}
.num,.r{text-align:right;font-variant-numeric:tabular-nums}
tr.chapter td{background:${C.wash};font-weight:600;color:${C.ink};font-size:9pt}
tfoot td{padding:5px 6px}
.totals{margin-left:auto;width:78mm;margin-top:6mm}
.totals tr td{border:0;padding:4px 6px}
.totals tr.grand td{border-top:2px solid ${C.deep};font:700 12pt Inter,sans-serif;color:${C.ink};padding-top:8px}
.terms{margin-top:auto;padding-top:8mm}
.box{border:1px solid ${C.line};border-radius:8px;padding:10px 12px;background:#fcfdfb}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:10mm}
.sig .line{border-top:1px solid ${C.ink};margin-top:16mm;padding-top:5px}
footer.doc{margin-top:8mm;padding-top:5mm;border-top:1px solid ${C.line};font-size:7.5pt;color:${C.muted};line-height:1.5}
.badge{display:inline-block;padding:3px 9px;border-radius:999px;font:600 7.5pt Inter,sans-serif;
  letter-spacing:.1em;text-transform:uppercase}
.badge.ok{background:#e7f0e1;color:${C.deep};border:1px solid #bcd4b1}
.badge.warn{background:#fdf3d8;color:#7a5a06;border:1px solid #ecd28a}
.badge.info{background:#eef3ea;color:${C.body};border:1px solid ${C.line}}
.kv{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:9pt}
.kv dt{color:${C.muted}}
.kv dd{margin:0;color:${C.ink}}
.note{background:${C.wash};border-left:3px solid ${C.green};padding:8px 11px;border-radius:0 6px 6px 0;font-size:9pt}
ul.clean{margin:6px 0 0;padding-left:16px}
ul.clean li{margin-bottom:4px}
`;

function head(el, docNo, docTitle, meta = []) {
  return `<header class="doc">
  <div class="mark">
    <div class="glyph">C</div>
    <div>
      <div class="who">${SELLER.name}</div>
      <div class="small muted">${SELLER.address} · ${SELLER.city}<br>NIF ${SELLER.nif} · ${SELLER.phone}</div>
    </div>
  </div>
  <div class="docref">
    <div class="eyebrow">${el}</div>
    <div class="num">${docNo}</div>
    <div class="rule" style="margin-left:auto"></div>
    ${meta.map((m) => `<div class="small muted" style="margin-top:6px">${m}</div>`).join("")}
  </div>
</header>
<h1 style="margin:7mm 0 0">${docTitle}</h1>`;
}

const partyBlock = (label, p, extra = "") =>
  `<div class="party"><div class="lbl">${label}</div>
   <div class="nm">${p.name}</div>
   <div class="small">${p.nif ? "NIF " + p.nif + "<br>" : ""}${p.contact ? p.contact + "<br>" : ""}${p.address}<br>${p.city}${p.email ? "<br>" + p.email : ""}${extra}</div></div>`;

const foot = (legal = "") =>
  `<footer class="doc">${SELLER.name} · NIF ${SELLER.nif} · ${SELLER.address}, ${SELLER.city} (${SELLER.region}) · ${SELLER.phone} · ${SELLER.email} · ${SELLER.web}<br>
${SELLER.registry}${legal ? "<br>" + legal : ""}</footer>`;

function page(title, inner) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<div class="sheet">
${inner}
</div>
</body>
</html>`;
}

/* ── the works: one realistic quote, reused across the document chain ──── */

const CHAPTERS = [
  {
    name: "01 · Demolición y trabajos previos",
    lines: [
      [
        "Retirada de alicatado y solado existente",
        "37,50",
        "m²",
        1840,
        "Incluye protección de accesos",
      ],
      ["Demolición de tabique de separación", "6,20", "m²", 2650, ""],
      ["Carga y transporte a gestor autorizado", "3,00", "ud", 8500, "Con certificado de residuos"],
    ],
  },
  {
    name: "02 · Impermeabilización",
    lines: [
      ["Lámina impermeabilizante bicomponente en zona húmeda", "12,50", "m²", 2380, ""],
      ["Banda de refuerzo en encuentros y sumidero", "18,00", "ml", 940, ""],
    ],
  },
  {
    name: "03 · Fontanería",
    lines: [
      [
        "Desplazamiento de bajante y montante",
        "1,00",
        "ud",
        48500,
        "Requiere permiso de comunidad",
      ],
      ["Instalación empotrada multicapa agua fría y ACS", "1,00", "ud", 96000, ""],
      ["Sumidero sifónico de acero inoxidable", "1,00", "ud", 14200, ""],
    ],
  },
  {
    name: "04 · Calefacción y climatización",
    lines: [
      [
        "Equipo de aerotermia 6 kW en cubierta, con soportes antivibración",
        "1,00",
        "ud",
        289000,
        "Marca y modelo según anexo técnico",
      ],
      ["Circuito de suelo radiante en baño", "12,50", "m²", 5600, ""],
    ],
  },
  {
    name: "05 · Electricidad",
    lines: [
      ["Circuito independiente C5 con diferencial 30 mA", "1,00", "ud", 32000, ""],
      ["Puntos de luz LED empotrados IP44", "6,00", "ud", 6800, ""],
      [
        "Boletín eléctrico y legalización",
        "1,00",
        "ud",
        18000,
        "Emitido por instalador autorizado",
      ],
    ],
  },
  {
    name: "06 · Revestimientos y acabados",
    lines: [
      [
        "Alicatado porcelánico gran formato 120×60",
        "37,00",
        "m²",
        4450,
        "Material del cliente a definir",
      ],
      ["Pavimento porcelánico antideslizante C3", "12,50", "m²", 4900, ""],
      ["Pintura plástica lavable, dos manos", "24,00", "m²", 1150, ""],
    ],
  },
];

const lineTotal = (l) => Math.round(parseFloat(l[1].replace(",", ".")) * l[3]);
const chapterTotal = (ch) => ch.lines.reduce((s, l) => s + lineTotal(l), 0);
const BASE = CHAPTERS.reduce((s, ch) => s + chapterTotal(ch), 0);
const OPTIONAL = 48000; // mampara de ducha, shown separately
const VAT_BP = 1000; // 10% — reforma de vivienda
const VAT = Math.round((BASE * VAT_BP) / 10000);
const TOTAL = BASE + VAT;

function itemTable({ withPrices = true } = {}) {
  const rows = CHAPTERS.map(
    (ch) =>
      `<tr class="chapter"><td colspan="${withPrices ? 5 : 3}">${ch.name}</td>
      ${withPrices ? "" : ""}</tr>` +
      ch.lines
        .map(
          (l) => `<tr>
        <td>${l[0]}${l[4] ? `<br><span class="small muted">${l[4]}</span>` : ""}</td>
        <td class="num">${l[1]}</td>
        <td>${l[2]}</td>
        ${withPrices ? `<td class="num">${eur(l[3])}</td><td class="num">${eur(lineTotal(l))}</td>` : ""}
      </tr>`,
        )
        .join("") +
      (withPrices
        ? `<tr><td colspan="4" class="r small muted">Subtotal ${ch.name.split("·")[1].trim()}</td>
           <td class="num" style="font-weight:600">${eur(chapterTotal(ch))}</td></tr>`
        : ""),
  ).join("");

  return `<table>
  <thead><tr>
    <th style="width:48%">Descripción</th><th class="num" style="width:11%">Medición</th><th style="width:8%">Ud.</th>
    ${withPrices ? '<th class="num" style="width:15%">Precio</th><th class="num" style="width:18%">Importe</th>' : ""}
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

const totalsTable = (extra = "") => `<table class="totals">
  <tr><td class="muted">Base imponible</td><td class="num">${eur(BASE)}</td></tr>
  <tr><td class="muted">IVA 10 % — reforma de vivienda</td><td class="num">${eur(VAT)}</td></tr>
  ${extra}
  <tr class="grand"><td>Total</td><td class="num">${eur(TOTAL)}</td></tr>
</table>`;

/* ── the documents ────────────────────────────────────────────────────── */

const DOCS = [];
const doc = (file, group, title, html) => DOCS.push({ file, group, title, html });

/* 1. Quote (PRE-) ------------------------------------------------------- */
doc(
  "01-presupuesto.html",
  "cliente",
  "Presupuesto / Quote",
  page(
    "Presupuesto PRE-2026-0014 · Canei Subirats",
    head("Presupuesto", "PRE-2026-0014", "Reforma integral de baño comunitario", [
      "Fecha 12/05/2026",
      "Válido hasta 11/06/2026",
      "Versión 1.0",
    ]) +
      `<div class="parties">${partyBlock("Emisor", SELLER)}${partyBlock("Cliente", BUYER)}</div>
   <div class="note" style="margin-bottom:6mm"><b>Obra:</b> Carrer de Balmes 120, esc. A · baño planta baja ·
   5,0 × 2,5 m (12,5 m² de suelo, 37 m² de paredes). Ascensor disponible, aparcamiento en calle.
   Plazo estimado de ejecución: 18 días laborables desde la firma.</div>
   ${itemTable()}
   <div style="margin-top:6mm" class="box">
     <b>Trabajo opcional — se factura solo si se acepta expresamente</b>
     <table style="margin-top:5px"><tbody><tr>
       <td>Mampara de ducha de vidrio templado 8 mm, perfilería negra mate</td>
       <td class="num" style="width:22%">${eur(OPTIONAL)}</td>
     </tr></tbody></table>
   </div>
   ${totalsTable()}
   <div class="terms">
     <h2>Condiciones</h2>
     <div class="box small">
       <ul class="clean">
         <li><b>Forma de pago:</b> 40 % a la firma, 40 % a mitad de obra certificada, 20 % a la entrega. Transferencia a ${SELLER.iban}.</li>
         <li><b>Plazo de pago:</b> 30 días desde la fecha de factura.</li>
         <li><b>Validez de la oferta:</b> 30 días naturales. Transcurrido el plazo, los precios se revisarán según el coste de materiales.</li>
         <li><b>No incluye:</b> licencias municipales, tasas de la comunidad, mobiliario, ni imprevistos derivados de patologías ocultas no visibles en la visita.</li>
         <li><b>Garantía:</b> 3 años en instalaciones y 1 año en acabados, conforme a la Ley de Ordenación de la Edificación.</li>
         <li><b>Residuos:</b> gestionados por transportista autorizado, con certificado entregado al cierre.</li>
       </ul>
     </div>
     <div class="sig">
       <div><div class="line"></div><div class="small muted">Por ${SELLER.name}</div></div>
       <div><div class="line"></div><div class="small muted">Conforme — el cliente (firma y fecha)</div></div>
     </div>
   </div>
   ${foot("Presupuesto sin valor de factura. La aceptación de este documento congela la versión y genera el contrato de obra.")}`,
  ),
);

/* 2. Accepted quote ----------------------------------------------------- */
doc(
  "02-presupuesto-aceptado.html",
  "cliente",
  "Presupuesto aceptado / Accepted quote",
  page(
    "Presupuesto aceptado PRE-2026-0014 · Canei Subirats",
    head("Presupuesto aceptado", "PRE-2026-0014", "Versión congelada — aceptada por el cliente", [
      "Aceptado 19/05/2026",
      "Versión 1.0 · congelada",
    ]) +
      `<div style="margin:6mm 0"><span class="badge ok">Aceptado</span>
       <span class="badge info" style="margin-left:6px">Versión congelada</span></div>
   <div class="parties">${partyBlock("Emisor", SELLER)}${partyBlock("Cliente", BUYER)}</div>
   <div class="note" style="margin-bottom:6mm">Aceptado por <b>${BUYER.contact}</b> el 19/05/2026 a las 11:24
   por correo electrónico desde ${BUYER.email}. A partir de este momento la versión 1.0 queda congelada:
   cualquier cambio requiere una <b>orden de cambio</b> firmada y no altera esta línea base.</div>
   ${itemTable()}
   ${totalsTable(`<tr><td class="muted">Trabajo opcional aceptado — mampara</td><td class="num">no incluido</td></tr>`)}
   <div class="terms">
     <div class="box small"><b>Línea base del proyecto:</b> ${eur(BASE)} (sin IVA).
     Todo coste por encima de esta cifra se registra como desviación y debe estar respaldado por una orden de cambio.</div>
   </div>
   ${foot()}`,
  ),
);

/* 3. Contract (CTR-) ---------------------------------------------------- */
doc(
  "03-contrato-obra.html",
  "cliente",
  "Contrato de obra / Works contract",
  page(
    "Contrato CTR-2026-0009 · Canei Subirats",
    head("Contrato de obra", "CTR-2026-0009", "Contrato de ejecución de obra", [
      "Fecha 20/05/2026",
      "Presupuesto PRE-2026-0014 v1.0",
    ]) +
      `<div class="parties">${partyBlock("Contratista", SELLER)}${partyBlock("Promotor / Cliente", BUYER)}</div>
   <h2 style="margin-top:6mm">Objeto</h2>
   <p class="small">Ejecución de la reforma integral del baño de planta baja del inmueble sito en
   ${BUYER.address}, ${BUYER.city}, conforme al presupuesto <b>PRE-2026-0014 versión 1.0</b>, que se adjunta
   como Anexo I y forma parte inseparable de este contrato.</p>

   <h2 style="margin-top:5mm">Precio y forma de pago</h2>
   <dl class="kv">
     <dt>Base imponible</dt><dd>${eur(BASE)}</dd>
     <dt>IVA 10 %</dt><dd>${eur(VAT)}</dd>
     <dt>Total contratado</dt><dd><b>${eur(TOTAL)}</b></dd>
     <dt>Hito 1 — firma</dt><dd>40 % · ${eur(Math.round(TOTAL * 0.4))} · vencimiento 20/05/2026</dd>
     <dt>Hito 2 — 50 % certificado</dt><dd>40 % · ${eur(Math.round(TOTAL * 0.4))} · vencimiento a certificación</dd>
     <dt>Hito 3 — entrega</dt><dd>20 % · ${eur(TOTAL - 2 * Math.round(TOTAL * 0.4))} · vencimiento a acta de entrega</dd>
     <dt>Cuenta</dt><dd>${SELLER.iban}</dd>
   </dl>

   <h2 style="margin-top:5mm">Plazo</h2>
   <p class="small">Inicio: 01/06/2026. Plazo de ejecución: 18 días laborables. Fecha prevista de entrega: 25/06/2026.
   Los retrasos imputables al promotor (falta de permisos, elección de materiales, acceso) amplían el plazo día por día.</p>

   <h2 style="margin-top:5mm">Modificaciones</h2>
   <p class="small">Toda variación sobre el Anexo I requiere <b>orden de cambio escrita y firmada por ambas partes</b>
   antes de su ejecución, con indicación de precio y efecto sobre el plazo. Ninguna variación verbal genera obligación de pago.</p>

   <h2 style="margin-top:5mm">Garantías y obligaciones</h2>
   <ul class="clean small">
     <li>Garantía de 3 años en instalaciones y 1 año en acabados (Ley 38/1999 de Ordenación de la Edificación).</li>
     <li>El contratista dispone de seguro de responsabilidad civil por 600.000 € y mantiene al día las obligaciones de Seguridad Social de su personal.</li>
     <li>Coordinación de seguridad y salud conforme al RD 1627/1997.</li>
     <li>Gestión de residuos por transportista autorizado, con certificado al cierre.</li>
     <li>Protección de datos: los datos de las partes se tratan conforme al RGPD (UE) 2016/679 para la ejecución de este contrato.</li>
   </ul>

   <div class="sig">
     <div><div class="line"></div><div class="small muted">Por ${SELLER.name} — el contratista</div></div>
     <div><div class="line"></div><div class="small muted">Por ${BUYER.name} — el promotor</div></div>
   </div>
   ${foot("Anexo I — Presupuesto PRE-2026-0014 v1.0 · Anexo II — Planificación de obra")}`,
  ),
);

/* 4. Change order ------------------------------------------------------- */
doc(
  "04-orden-de-cambio.html",
  "cliente",
  "Orden de cambio / Change order",
  page(
    "Orden de cambio OC-C-2026-003 · Canei Subirats",
    head("Orden de cambio", "OC-C-2026-003", "Modificación del alcance contratado", [
      "Fecha 09/06/2026",
      "Contrato CTR-2026-0009",
    ]) +
      `<div class="parties">${partyBlock("Contratista", SELLER)}${partyBlock("Cliente", BUYER)}</div>
   <div class="note" style="margin:6mm 0"><b>Motivo:</b> al retirar el alicatado se detecta humedad activa en el
   muro medianero, no visible en la visita de obra. Se requiere tratamiento antes de continuar con el revestimiento.
   Fotografías adjuntas en la carpeta del proyecto, paso 08 · Ejecución.</div>

   <table>
     <thead><tr><th style="width:52%">Concepto</th><th class="num">Medición</th><th>Ud.</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead>
     <tbody>
       <tr><td>Picado y saneado de muro afectado</td><td class="num">6,40</td><td>m²</td><td class="num">${eur(2100)}</td><td class="num">${eur(13440)}</td></tr>
       <tr><td>Mortero de reparación hidrófugo</td><td class="num">6,40</td><td>m²</td><td class="num">${eur(3150)}</td><td class="num">${eur(20160)}</td></tr>
       <tr><td>Refuerzo de impermeabilización perimetral</td><td class="num">8,00</td><td>ml</td><td class="num">${eur(1180)}</td><td class="num">${eur(9440)}</td></tr>
     </tbody>
   </table>

   <table class="totals">
     <tr><td class="muted">Base de la orden de cambio</td><td class="num">${eur(43040)}</td></tr>
     <tr><td class="muted">IVA 10 %</td><td class="num">${eur(4304)}</td></tr>
     <tr class="grand"><td>Total</td><td class="num">${eur(47344)}</td></tr>
   </table>

   <div class="box" style="margin-top:6mm">
     <dl class="kv">
       <dt>Efecto sobre el plazo</dt><dd>+2 días laborables — nueva entrega prevista 27/06/2026</dd>
       <dt>Línea base original</dt><dd>${eur(BASE)}</dd>
       <dt>Órdenes de cambio acumuladas</dt><dd>${eur(43040)} (incluida esta)</dd>
       <dt>Nuevo importe de obra</dt><dd><b>${eur(BASE + 43040)}</b> (sin IVA)</dd>
     </dl>
   </div>

   <div class="terms">
     <p class="small"><b>Los trabajos descritos no se iniciarán hasta que esta orden esté firmada por ambas partes.</b>
     Una vez firmada se incorpora al contrato CTR-2026-0009 y se factura junto con el hito siguiente.</p>
     <div class="sig">
       <div><div class="line"></div><div class="small muted">Por ${SELLER.name}</div></div>
       <div><div class="line"></div><div class="small muted">Aprobado — el cliente (firma y fecha)</div></div>
     </div>
   </div>
   ${foot()}`,
  ),
);

/* 5. Progress valuation ------------------------------------------------- */
doc(
  "05-certificacion-obra.html",
  "cliente",
  "Certificación de obra / Progress valuation",
  page(
    "Certificación nº 2 · P-2026-0002 · Canei Subirats",
    head(
      "Certificación de obra",
      "CERT-2026-0002-02",
      "Certificación nº 2 — periodo 01/06 a 15/06/2026",
      ["Proyecto P-2026-0002", "Contrato CTR-2026-0009"],
    ) +
      `<div class="parties">${partyBlock("Contratista", SELLER)}${partyBlock("Cliente", BUYER)}</div>
   <table style="margin-top:6mm">
     <thead><tr><th style="width:40%">Partida</th><th class="num">Contratado</th><th class="num">% anterior</th><th class="num">% actual</th><th class="num">A origen</th><th class="num">En este periodo</th></tr></thead>
     <tbody>
       ${CHAPTERS.map((ch, i) => {
         const t = chapterTotal(ch);
         const prev = [100, 100, 60, 0, 20, 0][i];
         const now = [100, 100, 95, 40, 65, 10][i];
         return `<tr><td>${ch.name}</td><td class="num">${eur(t)}</td>
           <td class="num">${prev} %</td><td class="num">${now} %</td>
           <td class="num">${eur(Math.round((t * now) / 100))}</td>
           <td class="num">${eur(Math.round((t * (now - prev)) / 100))}</td></tr>`;
       }).join("")}
     </tbody>
   </table>
   ${(() => {
     const origin = CHAPTERS.reduce(
       (s, ch, i) => s + Math.round((chapterTotal(ch) * [100, 100, 95, 40, 65, 10][i]) / 100),
       0,
     );
     const prevOrigin = CHAPTERS.reduce(
       (s, ch, i) => s + Math.round((chapterTotal(ch) * [100, 100, 60, 0, 20, 0][i]) / 100),
       0,
     );
     const period = origin - prevOrigin;
     return `<table class="totals">
       <tr><td class="muted">Ejecutado a origen</td><td class="num">${eur(origin)}</td></tr>
       <tr><td class="muted">Certificado anteriormente</td><td class="num">−${eur(prevOrigin)}</td></tr>
       <tr><td class="muted">Base de esta certificación</td><td class="num">${eur(period)}</td></tr>
       <tr><td class="muted">IVA 10 %</td><td class="num">${eur(Math.round(period * 0.1))}</td></tr>
       <tr class="grand"><td>A facturar</td><td class="num">${eur(period + Math.round(period * 0.1))}</td></tr>
     </table>
     <div class="box small" style="margin-top:6mm">Avance global de la obra: <b>${Math.round((origin / BASE) * 100)} %</b>.
     Esta certificación da lugar a la factura del hito 2 del contrato.</div>`;
   })()}
   <div class="sig">
     <div><div class="line"></div><div class="small muted">Jefe de obra — ${SELLER.name}</div></div>
     <div><div class="line"></div><div class="small muted">Conforme — la dirección facultativa / el cliente</div></div>
   </div>
   ${foot()}`,
  ),
);

/* 6. Invoice (FAC-) ----------------------------------------------------- */
doc(
  "06-factura.html",
  "cliente",
  "Factura / Invoice",
  page(
    "Factura FAC-2026-0021 · Canei Subirats",
    head("Factura", "FAC-2026-0021", "Factura de obra — hito 2", [
      "Fecha de expedición 16/06/2026",
      "Fecha de operación 15/06/2026",
      "Vencimiento 16/07/2026",
    ]) +
      `<div class="parties">${partyBlock("Expedidor", SELLER)}${partyBlock("Destinatario", BUYER)}</div>
   <div class="box small" style="margin-bottom:5mm">
     <dl class="kv">
       <dt>Proyecto</dt><dd>P-2026-0002 — Reforma baño Balmes 120</dd>
       <dt>Contrato</dt><dd>CTR-2026-0009</dd>
       <dt>Presupuesto</dt><dd>PRE-2026-0014 v1.0</dd>
       <dt>Certificación</dt><dd>CERT-2026-0002-02</dd>
     </dl>
   </div>
   <table>
     <thead><tr><th style="width:58%">Concepto</th><th class="num">Base</th><th class="num">% IVA</th><th class="num">Cuota IVA</th></tr></thead>
     <tbody>
       <tr><td>Ejecución de obra según certificación nº 2, contrato CTR-2026-0009<br>
         <span class="small muted">Periodo 01/06/2026 – 15/06/2026</span></td>
         <td class="num">${eur(151230)}</td><td class="num">10 %</td><td class="num">${eur(15123)}</td></tr>
       <tr><td>Orden de cambio OC-C-2026-003 — tratamiento de humedad en medianera</td>
         <td class="num">${eur(43040)}</td><td class="num">10 %</td><td class="num">${eur(4304)}</td></tr>
     </tbody>
   </table>
   <table class="totals">
     <tr><td class="muted">Base imponible</td><td class="num">${eur(194270)}</td></tr>
     <tr><td class="muted">IVA 10 % — ejecución de obra en vivienda</td><td class="num">${eur(19427)}</td></tr>
     <tr class="grand"><td>Total a pagar</td><td class="num">${eur(213697)}</td></tr>
   </table>
   <div class="terms">
     <div class="box small">
       <b>Forma de pago:</b> transferencia bancaria a ${SELLER.iban} · titular ${SELLER.name}<br>
       <b>Referencia:</b> FAC-2026-0021 · <b>Vencimiento:</b> 16/07/2026 (30 días)<br>
       <b>Régimen de IVA:</b> tipo reducido del 10 % por ejecución de obra de renovación en vivienda,
       art. 91.Uno.2.10.º de la Ley 37/1992 del IVA. El destinatario declara que el inmueble se destina a vivienda
       y que la obra no supera el 40 % del coste de una construcción nueva.
     </div>
     <p class="small muted" style="margin-top:4mm">Factura expedida conforme al Real Decreto 1619/2012, por el que se aprueba
     el Reglamento de obligaciones de facturación. Conserve este documento a efectos fiscales.</p>
   </div>
   ${foot()}`,
  ),
);

/* 7. Credit note (ABO-) ------------------------------------------------- */
doc(
  "07-factura-rectificativa.html",
  "cliente",
  "Factura rectificativa (abono) / Credit note",
  page(
    "Rectificativa ABO-2026-0003 · Canei Subirats",
    head("Factura rectificativa", "ABO-2026-0003", "Rectifica la factura FAC-2026-0021", [
      "Fecha 24/06/2026",
      "Rectifica FAC-2026-0021 de 16/06/2026",
    ]) +
      `<div style="margin:6mm 0"><span class="badge warn">Rectificativa</span></div>
   <div class="parties">${partyBlock("Expedidor", SELLER)}${partyBlock("Destinatario", BUYER)}</div>
   <div class="note" style="margin-bottom:5mm"><b>Causa de la rectificación:</b> la medición de la partida 06 se certificó
   al 65 % cuando el avance real a 15/06/2026 era del 58 %. Se rectifica a la baja la diferencia.
   Art. 15 del RD 1619/2012.</div>
   <table>
     <thead><tr><th style="width:58%">Concepto</th><th class="num">Base</th><th class="num">% IVA</th><th class="num">Cuota IVA</th></tr></thead>
     <tbody>
       <tr><td>Rectificación de medición — partida 06 Revestimientos y acabados<br>
         <span class="small muted">Diferencia 65 % → 58 % sobre ${eur(chapterTotal(CHAPTERS[5]))}</span></td>
         <td class="num">−${eur(21860)}</td><td class="num">10 %</td><td class="num">−${eur(2186)}</td></tr>
     </tbody>
   </table>
   <table class="totals">
     <tr><td class="muted">Base rectificada</td><td class="num">−${eur(21860)}</td></tr>
     <tr><td class="muted">IVA 10 %</td><td class="num">−${eur(2186)}</td></tr>
     <tr class="grand"><td>Total a su favor</td><td class="num">−${eur(24046)}</td></tr>
   </table>
   <div class="terms"><div class="box small">
     El importe se compensará en la factura del hito 3. Si el cliente hubiera abonado ya la factura rectificada,
     el saldo se devolverá por transferencia en un plazo de 7 días.
   </div></div>
   ${foot()}`,
  ),
);

/* 8. Receipt (REC-) ----------------------------------------------------- */
doc(
  "08-recibo.html",
  "cliente",
  "Recibo de cobro / Payment receipt",
  page(
    "Recibo REC-2026-0044 · Canei Subirats",
    head("Recibo de cobro", "REC-2026-0044", "Justificante de cobro", ["Fecha 18/07/2026"]) +
      `<div class="parties">${partyBlock("Receptor", SELLER)}${partyBlock("Pagador", BUYER)}</div>
   <div class="box" style="margin:6mm 0">
     <dl class="kv">
       <dt>Importe recibido</dt><dd style="font:700 15pt Inter,sans-serif;color:${C.ink}">${eur(213697)}</dd>
       <dt>Medio de pago</dt><dd>Transferencia bancaria</dd>
       <dt>Fecha valor</dt><dd>18/07/2026</dd>
       <dt>Cuenta de abono</dt><dd>${SELLER.iban}</dd>
       <dt>Referencia del pagador</dt><dd>TRF 2026071800931</dd>
     </dl>
   </div>
   <h2>Aplicación del cobro</h2>
   <table>
     <thead><tr><th>Documento</th><th>Fecha</th><th class="num">Importe doc.</th><th class="num">Aplicado</th><th class="num">Pendiente</th></tr></thead>
     <tbody>
       <tr><td>FAC-2026-0021</td><td>16/06/2026</td><td class="num">${eur(213697)}</td><td class="num">${eur(213697)}</td><td class="num">${eur(0)}</td></tr>
     </tbody>
   </table>
   <div class="terms"><div class="box small">
     Este recibo acredita el cobro y su aplicación a la factura indicada. El saldo pendiente del contrato
     CTR-2026-0009 a la fecha es el hito 3, cuyo vencimiento es la firma del acta de entrega.
   </div></div>
   ${foot()}`,
  ),
);

/* 9. Site visit report -------------------------------------------------- */
doc(
  "09-informe-visita.html",
  "interno",
  "Informe de visita de obra / Site visit report",
  page(
    "Informe de visita V-2026-0031 · Canei Subirats",
    head("Informe de visita", "V-2026-0031", "Visita técnica previa a presupuesto", [
      "Fecha 08/05/2026 · 10:30",
      "Técnico: Marc Subirats",
    ]) +
      `<div class="parties">${partyBlock("Empresa", SELLER)}${partyBlock("Cliente / emplazamiento", BUYER)}</div>
   <h2 style="margin-top:6mm">Datos de la visita</h2>
   <dl class="kv">
     <dt>Origen del contacto</dt><dd>Recomendación del administrador de fincas</dd>
     <dt>Presentes</dt><dd>${BUYER.contact}; Marc Subirats (Canei); Álvaro Ruiz (oficial 1ª)</dd>
     <dt>Duración</dt><dd>55 minutos</dd>
     <dt>Accesos</dt><dd>Ascensor disponible. Aparcamiento en calle, carga y descarga hasta las 11:00.</dd>
     <dt>Suministros</dt><dd>Agua y luz de obra disponibles en el local comunitario.</dd>
   </dl>
   <h2 style="margin-top:5mm">Mediciones tomadas</h2>
   <table>
     <thead><tr><th>Elemento</th><th class="num">Medición</th><th>Ud.</th><th>Observación</th></tr></thead>
     <tbody>
       <tr><td>Superficie de suelo</td><td class="num">12,50</td><td>m²</td><td>5,00 × 2,50 m</td></tr>
       <tr><td>Superficie de paredes</td><td class="num">37,00</td><td>m²</td><td>Altura libre 2,55 m</td></tr>
       <tr><td>Tabique a demoler</td><td class="num">6,20</td><td>m²</td><td>No estructural — verificado</td></tr>
       <tr><td>Recorrido de bajante a desplazar</td><td class="num">3,40</td><td>ml</td><td>Requiere permiso de la comunidad</td></tr>
     </tbody>
   </table>
   <h2 style="margin-top:5mm">Estado observado y riesgos</h2>
   <ul class="clean small">
     <li>Alicatado original de los años 70, adherido a mortero — se prevé picado completo.</li>
     <li><b>Riesgo:</b> posible humedad en muro medianero; no verificable hasta el picado. Se advierte al cliente y se excluye del presupuesto.</li>
     <li>Instalación eléctrica sin circuito independiente para el baño — requiere C5 con diferencial de 30 mA.</li>
     <li>Cubierta accesible para el equipo de aerotermia; se comprueba espacio y punto de anclaje.</li>
   </ul>
   <h2 style="margin-top:5mm">Fotografías</h2>
   <div class="box small">6 fotografías archivadas en la carpeta del proyecto, paso <b>02 · Visita de obra</b>,
   guardadas en el servidor de la empresa. Referencias: V-2026-0031-01 a V-2026-0031-06.</div>
   <div class="terms"><div class="note">
     <b>Próxima acción:</b> emitir presupuesto antes del 12/05/2026. Responsable: Marc Subirats.
   </div></div>
   ${foot()}`,
  ),
);

/* 10. Purchase order (OC-) --------------------------------------------- */
doc(
  "10-orden-compra.html",
  "proveedor",
  "Orden de compra / Purchase order",
  page(
    "Orden de compra OC-2026-0087 · Canei Subirats",
    head("Orden de compra", "OC-2026-0087", "Pedido a proveedor", [
      "Fecha 26/05/2026",
      "Entrega requerida 01/06/2026",
    ]) +
      `<div class="parties">${partyBlock("Comprador", SELLER)}${partyBlock("Proveedor", SUPPLIER)}</div>
   <div class="box small" style="margin-bottom:5mm">
     <dl class="kv">
       <dt>Proyecto</dt><dd>P-2026-0002 — Reforma baño Balmes 120</dd>
       <dt>Dirección de entrega</dt><dd>${BUYER.address}, ${BUYER.city} — a pie de obra</dd>
       <dt>Horario de descarga</dt><dd>Lunes a viernes, 08:00–11:00</dd>
       <dt>Persona de contacto en obra</dt><dd>Álvaro Ruiz · +34 655 00 11 22</dd>
     </dl>
   </div>
   <table>
     <thead><tr><th style="width:46%">Referencia y descripción</th><th class="num">Cantidad</th><th>Ud.</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead>
     <tbody>
       <tr><td>PORC-12060-GR · Porcelánico gran formato 120×60, gris cemento</td><td class="num">40,00</td><td>m²</td><td class="num">${eur(2180)}</td><td class="num">${eur(87200)}</td></tr>
       <tr><td>PAV-C3-ANT · Pavimento antideslizante C3, 60×60</td><td class="num">14,00</td><td>m²</td><td class="num">${eur(2450)}</td><td class="num">${eur(34300)}</td></tr>
       <tr><td>IMP-BICOMP-20 · Impermeabilizante bicomponente, cubo 20 kg</td><td class="num">2,00</td><td>ud</td><td class="num">${eur(6800)}</td><td class="num">${eur(13600)}</td></tr>
       <tr><td>SUM-INOX-15 · Sumidero sifónico inox 15×15</td><td class="num">1,00</td><td>ud</td><td class="num">${eur(8900)}</td><td class="num">${eur(8900)}</td></tr>
     </tbody>
   </table>
   <table class="totals">
     <tr><td class="muted">Base imponible</td><td class="num">${eur(144000)}</td></tr>
     <tr><td class="muted">IVA 21 %</td><td class="num">${eur(30240)}</td></tr>
     <tr class="grand"><td>Total pedido</td><td class="num">${eur(174240)}</td></tr>
   </table>
   <div class="terms">
     <div class="box small">
       <ul class="clean">
         <li><b>Condiciones de pago:</b> 30 días fecha factura, transferencia.</li>
         <li><b>Referencia obligatoria:</b> indique <b>OC-2026-0087</b> en el albarán y en la factura. Las facturas sin referencia se devuelven.</li>
         <li><b>Albarán:</b> debe firmarse en obra por el contacto indicado. El albarán firmado es condición para el pago.</li>
         <li><b>Precio cerrado</b> hasta la fecha de entrega requerida. Cualquier variación debe comunicarse por escrito antes de servir.</li>
         <li>Envíe la factura a <b>${SELLER.email}</b> en PDF.</li>
       </ul>
     </div>
   </div>
   ${foot()}`,
  ),
);

/* 11. Subcontract (SUB-) ------------------------------------------------ */
doc(
  "11-contrato-subcontratacion.html",
  "proveedor",
  "Contrato de subcontratación / Subcontract",
  page(
    "Subcontrato SUB-2026-0012 · Canei Subirats",
    head("Contrato de subcontratación", "SUB-2026-0012", "Instalación de climatización", [
      "Fecha 28/05/2026",
      "Proyecto P-2026-0002",
    ]) +
      `<div class="parties">${partyBlock("Contratista principal", SELLER)}${partyBlock(
        "Subcontratista",
        {
          name: "Clima Vallès Instal·lacions, S.L.",
          nif: "B-6644 2019",
          contact: "Pere Casals",
          address: "Carrer del Progrés 44",
          city: "08191 Rubí (Barcelona)",
          email: "pere@climavalles.example",
        },
      )}</div>
   <h2 style="margin-top:6mm">Objeto y alcance</h2>
   <p class="small">Suministro e instalación del equipo de aerotermia de 6 kW en cubierta, incluidos soportes
   antivibración, conexionado hidráulico y puesta en marcha, y ejecución del circuito de suelo radiante
   (12,50 m²) en el baño de planta baja del proyecto P-2026-0002.</p>
   <dl class="kv" style="margin-top:4mm">
     <dt>Importe cerrado</dt><dd><b>${eur(238000)}</b> + IVA 21 % (${eur(49980)}) = ${eur(287980)}</dd>
     <dt>Plazo</dt><dd>Del 15/06/2026 al 22/06/2026</dd>
     <dt>Pago</dt><dd>A 30 días desde factura, previa conformidad de la instalación y entrega del certificado</dd>
     <dt>Retención de garantía</dt><dd>5 % durante 12 meses desde la puesta en marcha</dd>
   </dl>
   <h2 style="margin-top:5mm">Obligaciones del subcontratista</h2>
   <ul class="clean small">
     <li>Acreditar estar al corriente de pago con la Seguridad Social y la Agencia Tributaria antes del inicio (certificados adjuntos, vigencia 6 meses).</li>
     <li>Personal dado de alta, con formación en PRL acreditada conforme al convenio del sector de la construcción.</li>
     <li>Inscripción en el <b>REA</b> (Registro de Empresas Acreditadas) y aportación del número de inscripción.</li>
     <li>Seguro de responsabilidad civil vigente por importe no inferior a 300.000 €.</li>
     <li>Entrega del <b>certificado de la instalación</b> y de la documentación de puesta en marcha del fabricante.</li>
     <li>Cumplimiento del plan de seguridad y salud de la obra y de las instrucciones del coordinador.</li>
   </ul>
   <div class="note" style="margin-top:5mm"><b>Cadena de subcontratación:</b> el subcontratista no podrá subcontratar
   a su vez ninguna parte de estos trabajos sin autorización escrita previa, conforme a la Ley 32/2006 reguladora
   de la subcontratación en el sector de la construcción.</div>
   <div class="sig">
     <div><div class="line"></div><div class="small muted">Por ${SELLER.name}</div></div>
     <div><div class="line"></div><div class="small muted">Por el subcontratista</div></div>
   </div>
   ${foot()}`,
  ),
);

/* 12. Delivery note ----------------------------------------------------- */
doc(
  "12-albaran-entrega.html",
  "proveedor",
  "Albarán de entrega / Delivery note",
  page(
    "Albarán ALB-2026-0155 · Canei Subirats",
    head("Albarán de entrega", "ALB-2026-0155", "Recepción de material en obra", [
      "Fecha 01/06/2026 · 09:15",
      "Contra OC-2026-0087",
    ]) +
      `<div class="parties">${partyBlock("Recibido por", SELLER)}${partyBlock("Servido por", SUPPLIER)}</div>
   <table style="margin-top:6mm">
     <thead><tr><th style="width:44%">Referencia</th><th class="num">Pedido</th><th class="num">Servido</th><th class="num">Pendiente</th><th>Estado</th></tr></thead>
     <tbody>
       <tr><td>PORC-12060-GR · Porcelánico 120×60</td><td class="num">40,00 m²</td><td class="num">40,00 m²</td><td class="num">—</td><td><span class="badge ok">Conforme</span></td></tr>
       <tr><td>PAV-C3-ANT · Pavimento antideslizante</td><td class="num">14,00 m²</td><td class="num">14,00 m²</td><td class="num">—</td><td><span class="badge ok">Conforme</span></td></tr>
       <tr><td>IMP-BICOMP-20 · Impermeabilizante</td><td class="num">2,00 ud</td><td class="num">1,00 ud</td><td class="num">1,00 ud</td><td><span class="badge warn">Parcial</span></td></tr>
       <tr><td>SUM-INOX-15 · Sumidero sifónico</td><td class="num">1,00 ud</td><td class="num">1,00 ud</td><td class="num">—</td><td><span class="badge ok">Conforme</span></td></tr>
     </tbody>
   </table>
   <div class="note" style="margin-top:5mm"><b>Incidencia:</b> falta 1 cubo de impermeabilizante. El proveedor
   confirma entrega el 03/06/2026. Registrado como pendiente contra la orden OC-2026-0087; la factura del proveedor
   se conciliará contra lo efectivamente servido, no contra lo pedido.</div>
   <div class="box small" style="margin-top:5mm">
     <b>2 bultos con daño externo en el embalaje</b> — abiertos y revisados en presencia del transportista:
     contenido en buen estado. Fotografías archivadas en la carpeta del proyecto, paso 07 · Compras.
   </div>
   <div class="sig">
     <div><div class="line"></div><div class="small muted">Recibido — Álvaro Ruiz, oficial 1ª (${SELLER.name})</div></div>
     <div><div class="line"></div><div class="small muted">Entregado — transportista / proveedor</div></div>
   </div>
   ${foot()}`,
  ),
);

/* 13. Handover certificate ---------------------------------------------- */
doc(
  "13-acta-entrega.html",
  "cliente",
  "Acta de entrega / Handover certificate",
  page(
    "Acta de entrega ACT-2026-0009 · Canei Subirats",
    head("Acta de entrega", "ACT-2026-0009", "Recepción de la obra", [
      "Fecha 27/06/2026",
      "Contrato CTR-2026-0009",
    ]) +
      `<div class="parties">${partyBlock("Contratista", SELLER)}${partyBlock("Promotor", BUYER)}</div>
   <p class="small" style="margin-top:6mm">Reunidas las partes en el emplazamiento de la obra, se procede a la
   recepción de los trabajos objeto del contrato <b>CTR-2026-0009</b>, dando por finalizada la ejecución con
   fecha <b>27/06/2026</b>.</p>
   <h2 style="margin-top:5mm">Repaso de pendientes (punch list)</h2>
   <table>
     <thead><tr><th style="width:52%">Punto</th><th>Responsable</th><th>Compromiso</th><th>Estado</th></tr></thead>
     <tbody>
       <tr><td>Sellado perimetral de mampara — retoque</td><td>Canei</td><td>30/06/2026</td><td><span class="badge warn">Pendiente</span></td></tr>
       <tr><td>Ajuste de caudal en circuito de suelo radiante</td><td>Clima Vallès</td><td>02/07/2026</td><td><span class="badge warn">Pendiente</span></td></tr>
       <tr><td>Limpieza final de obra</td><td>Canei</td><td>27/06/2026</td><td><span class="badge ok">Resuelto</span></td></tr>
     </tbody>
   </table>
   <h2 style="margin-top:5mm">Documentación entregada</h2>
   <ul class="clean small">
     <li>Boletín eléctrico y certificado de instalación (instalador autorizado).</li>
     <li>Certificado de gestión de residuos del transportista autorizado.</li>
     <li>Manuales y garantías del fabricante del equipo de aerotermia.</li>
     <li>Fichas técnicas de los materiales instalados.</li>
     <li>Certificado de puesta en marcha de la instalación de climatización.</li>
   </ul>
   <div class="box" style="margin-top:5mm">
     <dl class="kv">
       <dt>Inicio de garantía</dt><dd>27/06/2026 — 3 años instalaciones, 1 año acabados</dd>
       <dt>Importe final de obra</dt><dd>${eur(BASE + 43040 - 21860)} (sin IVA), incluidas órdenes de cambio y rectificación</dd>
       <dt>Saldo pendiente</dt><dd>Hito 3 — se factura a la firma de esta acta</dd>
     </dl>
   </div>
   <div class="sig">
     <div><div class="line"></div><div class="small muted">Por ${SELLER.name}</div></div>
     <div><div class="line"></div><div class="small muted">Recibida conforme — el promotor</div></div>
   </div>
   ${foot()}`,
  ),
);

/* 14. Timesheet --------------------------------------------------------- */
doc(
  "14-parte-de-trabajo.html",
  "interno",
  "Parte de trabajo / Timesheet",
  page(
    "Parte de trabajo PT-2026-W24 · Canei Subirats",
    head("Parte de trabajo", "PT-2026-W24", "Semana 24 · 08/06 – 14/06/2026", [
      "Proyecto P-2026-0002",
      "Encargado: Álvaro Ruiz",
    ]) +
      `<table style="margin-top:6mm">
     <thead><tr><th style="width:26%">Persona</th><th>Categoría</th><th class="num">L</th><th class="num">M</th><th class="num">X</th><th class="num">J</th><th class="num">V</th><th class="num">Total</th><th class="num">Coste</th></tr></thead>
     <tbody>
       <tr><td>Álvaro Ruiz</td><td>Oficial 1ª</td><td class="num">8</td><td class="num">8</td><td class="num">8</td><td class="num">8</td><td class="num">6</td><td class="num">38</td><td class="num">${eur(76000)}</td></tr>
       <tr><td>Miquel Sanz</td><td>Oficial 2ª</td><td class="num">8</td><td class="num">8</td><td class="num">8</td><td class="num">4</td><td class="num">6</td><td class="num">34</td><td class="num">${eur(59500)}</td></tr>
       <tr><td>Youssef El Amrani</td><td>Peón especialista</td><td class="num">8</td><td class="num">8</td><td class="num">8</td><td class="num">8</td><td class="num">6</td><td class="num">38</td><td class="num">${eur(53200)}</td></tr>
     </tbody>
     <tfoot><tr><td colspan="7" class="r"><b>Total semana</b></td><td class="num"><b>110 h</b></td><td class="num"><b>${eur(188700)}</b></td></tr></tfoot>
   </table>
   <h2 style="margin-top:6mm">Imputación por partida</h2>
   <table>
     <thead><tr><th style="width:52%">Partida</th><th class="num">Horas</th><th class="num">Coste imputado</th></tr></thead>
     <tbody>
       <tr><td>03 · Fontanería</td><td class="num">46</td><td class="num">${eur(78900)}</td></tr>
       <tr><td>04 · Calefacción y climatización</td><td class="num">28</td><td class="num">${eur(48100)}</td></tr>
       <tr><td>05 · Electricidad</td><td class="num">22</td><td class="num">${eur(37700)}</td></tr>
       <tr><td>06 · Revestimientos y acabados</td><td class="num">14</td><td class="num">${eur(24000)}</td></tr>
     </tbody>
   </table>
   <div class="note" style="margin-top:5mm"><b>Incidencias de la semana:</b> jueves, 4 h perdidas por espera de
   suministro (1 cubo de impermeabilizante pendiente del albarán ALB-2026-0155). Viernes, jornada reducida por
   corte de agua programado por la comunidad.</div>
   <div class="box small" style="margin-top:5mm">Las horas registradas alimentan el coste real del proyecto y la
   desviación por partida en la torre de control. Un parte sin firmar del encargado genera una alerta técnica.</div>
   <div class="sig">
     <div><div class="line"></div><div class="small muted">Encargado de obra</div></div>
     <div><div class="line"></div><div class="small muted">Administración — conformidad</div></div>
   </div>
   ${foot()}`,
  ),
);

/* 15. Project sheet ----------------------------------------------------- */
doc(
  "15-ficha-proyecto.html",
  "interno",
  "Ficha de proyecto / Project margin sheet",
  page(
    "Ficha de proyecto P-2026-0002 · Canei Subirats",
    head("Ficha de proyecto", "P-2026-0002", "Reforma baño — Balmes 120", [
      "A fecha 30/06/2026",
      "Jefe de obra: Marc Subirats",
    ]) +
      `<div class="box" style="margin:6mm 0">
     <dl class="kv">
       <dt>Cliente</dt><dd>${BUYER.name}</dd>
       <dt>Contrato</dt><dd>CTR-2026-0009 · Presupuesto PRE-2026-0014 v1.0</dd>
       <dt>Estado</dt><dd><span class="badge ok">Entregado — pendiente de repasos</span></dd>
       <dt>Inicio / entrega</dt><dd>01/06/2026 → 27/06/2026 (2 días de desviación)</dd>
     </dl>
   </div>
   <h2>Margen por partida</h2>
   <table>
     <thead><tr><th style="width:34%">Partida</th><th class="num">Venta</th><th class="num">Coste previsto</th><th class="num">Coste real</th><th class="num">Margen</th><th class="num">Desviación</th></tr></thead>
     <tbody>
       ${CHAPTERS.map((ch, i) => {
         const sale = chapterTotal(ch);
         const planned = Math.round(sale * 0.62);
         const actual = Math.round(planned * [1.0, 0.94, 1.18, 1.02, 1.09, 0.97][i]);
         const margin = sale - actual;
         const dev = actual - planned;
         const over = dev > 0;
         return `<tr><td>${ch.name}</td><td class="num">${eur(sale)}</td><td class="num">${eur(planned)}</td>
           <td class="num">${eur(actual)}</td>
           <td class="num">${eur(margin)} · ${Math.round((margin / sale) * 100)} %</td>
           <td class="num" style="color:${over ? "#8f2d1b" : C.deep}">${over ? "+" : ""}${eur(dev)}</td></tr>`;
       }).join("")}
     </tbody>
   </table>
   <h2 style="margin-top:6mm">Resumen económico</h2>
   <table class="totals" style="width:92mm">
     <tr><td class="muted">Línea base contratada</td><td class="num">${eur(BASE)}</td></tr>
     <tr><td class="muted">Órdenes de cambio aprobadas</td><td class="num">+${eur(43040)}</td></tr>
     <tr><td class="muted">Rectificación de medición</td><td class="num">−${eur(21860)}</td></tr>
     <tr><td class="muted">Ingresos (sin IVA)</td><td class="num">${eur(BASE + 43040 - 21860)}</td></tr>
     <tr><td class="muted">Coste real acumulado</td><td class="num">${eur(Math.round((BASE + 43040 - 21860) * 0.655))}</td></tr>
     <tr><td class="muted">Comprometido en pedidos abiertos</td><td class="num">${eur(31200)}</td></tr>
     <tr class="grand"><td>Margen del proyecto</td><td class="num">${eur(Math.round((BASE + 43040 - 21860) * 0.345))}</td></tr>
   </table>
   <div class="note" style="margin-top:6mm"><b>Lecciones para el próximo presupuesto:</b> la partida 03 · Fontanería
   se desvió un 18 % por el desplazamiento de la bajante. Revisar el precio unitario del catálogo y añadir una
   partida específica de "verificación de patologías ocultas" en obras de comunidad anteriores a 1980.</div>
   ${foot()}`,
  ),
);

/* 16. Quarterly package for the accountant ------------------------------ */
doc(
  "16-paquete-trimestral-gestoria.html",
  "gestoria",
  "Paquete trimestral para la gestoría / Quarterly accounting package",
  page(
    "Paquete trimestral 2026-T2 · Canei Subirats",
    head(
      "Paquete trimestral",
      "GES-2026-T2",
      "Documentación para la gestoría — segundo trimestre 2026",
      ["Periodo 01/04/2026 – 30/06/2026", "Generado 05/07/2026"],
    ) +
      `<div class="parties">${partyBlock("Empresa", SELLER)}${partyBlock("Destinatario", {
        name: "Gestoria Puig i Associats, S.L.",
        nif: "B-6011 2233",
        contact: "Montse Puig",
        address: "Rambla de Catalunya 88, 2n 1a",
        city: "08008 Barcelona",
        email: "montse@gestoriapuig.example",
      })}</div>
   <div style="margin:5mm 0"><span class="badge ok">Sin excepciones pendientes</span></div>
   <h2>Resumen del periodo</h2>
   <table>
     <thead><tr><th style="width:40%">Concepto</th><th class="num">Documentos</th><th class="num">Base</th><th class="num">Cuota IVA</th><th class="num">Total</th></tr></thead>
     <tbody>
       <tr><td>Facturas emitidas (ventas)</td><td class="num">14</td><td class="num">${eur(4218400)}</td><td class="num">${eur(421840)}</td><td class="num">${eur(4640240)}</td></tr>
       <tr><td>Facturas rectificativas emitidas</td><td class="num">1</td><td class="num">−${eur(21860)}</td><td class="num">−${eur(2186)}</td><td class="num">−${eur(24046)}</td></tr>
       <tr><td>Facturas recibidas (compras y subcontratas)</td><td class="num">31</td><td class="num">${eur(2764500)}</td><td class="num">${eur(580545)}</td><td class="num">${eur(3345045)}</td></tr>
       <tr><td>Retenciones de IRPF practicadas a profesionales</td><td class="num">3</td><td class="num">${eur(420000)}</td><td class="num">${eur(63000)}</td><td class="num">—</td></tr>
     </tbody>
   </table>
   <h2 style="margin-top:6mm">Contenido del paquete</h2>
   <table>
     <thead><tr><th style="width:56%">Carpeta</th><th class="num">Archivos</th><th>Formato</th></tr></thead>
     <tbody>
       <tr><td>01 · Facturas emitidas (PDF + índice CSV)</td><td class="num">15</td><td>PDF / CSV</td></tr>
       <tr><td>02 · Facturas recibidas (PDF + índice CSV)</td><td class="num">31</td><td>PDF / CSV</td></tr>
       <tr><td>03 · Extractos bancarios conciliados</td><td class="num">3</td><td>PDF / Norma 43</td></tr>
       <tr><td>04 · Justificantes de caja</td><td class="num">18</td><td>PDF</td></tr>
       <tr><td>05 · Diccionario de transacciones (todas las operaciones tipificadas)</td><td class="num">1</td><td>CSV</td></tr>
       <tr><td>06 · Nóminas y seguros sociales del periodo</td><td class="num">9</td><td>PDF</td></tr>
     </tbody>
   </table>
   <div class="note" style="margin-top:6mm"><b>Control de excepciones:</b> el paquete no se genera si queda alguna
   operación sin justificar. En este trimestre se resolvieron 6 excepciones antes del cierre: 1 movimiento de caja
   sin justificante, 4 facturas de proveedor sin asignar a proyecto y 1 cobro sin aplicar. Todas quedan trazadas
   con autor y fecha en el registro de auditoría.</div>
   <div class="box small" style="margin-top:5mm">
     <b>Declaraciones que se derivan de este paquete:</b> liquidación trimestral de IVA, retenciones de IRPF de
     profesionales y arrendamientos, y la declaración anual de operaciones con terceros cuando proceda.
     La preparación y presentación corresponden a la gestoría; el ERP entrega los datos y la trazabilidad.
   </div>
   ${foot()}`,
  ),
);

/* 17–20. The four emails ------------------------------------------------ */
const emailShell = (subject, to, body) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title><style>${css}
.sheet{min-height:auto;padding:0;width:210mm}
.mailhead{padding:10mm 12mm;border-bottom:1px solid ${C.line};background:${C.wash}}
.mailbody{padding:10mm 12mm}
.btn{display:inline-block;padding:11px 22px;border-radius:10px;background:linear-gradient(120deg,${C.deep},${C.green} 72%);
  color:#fff;text-decoration:none;font:600 10pt Inter,sans-serif}
.mailfoot{padding:8mm 12mm;border-top:1px solid ${C.line};font-size:8pt;color:${C.muted};background:${C.wash};line-height:1.6}
</style></head>
<body><div class="sheet">
  <div class="mailhead">
    <div class="small muted"><b>De:</b> ${SELLER.name} &lt;${SELLER.email}&gt;<br>
    <b>Para:</b> ${to}<br><b>Asunto:</b> ${subject}</div>
  </div>
  <div class="mailbody">
    <div class="mark" style="margin-bottom:8mm">
      <div class="glyph">C</div>
      <div><div class="who">${SELLER.name}</div><div class="small muted">Reformes, senzillament complexes.</div></div>
    </div>
    ${body}
  </div>
  <div class="mailfoot">
    ${SELLER.name} · NIF ${SELLER.nif} · ${SELLER.address}, ${SELLER.city}<br>
    ${SELLER.phone} · ${SELLER.email} · ${SELLER.web}<br>
    Este mensaje y sus adjuntos son confidenciales. Si lo ha recibido por error, comuníquenoslo y elimínelo.
    Sus datos se tratan conforme al RGPD (UE) 2016/679; puede ejercer sus derechos escribiendo a ${SELLER.email}.
  </div>
</div></body></html>`;

doc(
  "17-email-aceptacion.html",
  "cliente",
  "Correo de aceptación del presupuesto / Quote acceptance email",
  emailShell(
    "Presupuesto PRE-2026-0014 aceptado — gracias por su confianza",
    `${BUYER.contact} &lt;${BUYER.email}&gt;`,
    `<p>Estimado ${BUYER.contact.split(" (")[0]},</p>
   <p>Le confirmamos que hemos recibido su aceptación del presupuesto <b>PRE-2026-0014</b> por importe de
   <b>${eur(TOTAL)}</b> (IVA incluido). Adjuntamos la versión aceptada y congelada del presupuesto en PDF.</p>
   <div class="note"><b>Qué ocurre ahora</b>
     <ul class="clean">
       <li>Le enviamos el contrato de obra <b>CTR-2026-0009</b> para su firma.</li>
       <li>Inicio previsto de los trabajos: <b>1 de junio de 2026</b>.</li>
       <li>Plazo de ejecución: 18 días laborables.</li>
       <li>Su persona de contacto en obra será Álvaro Ruiz (+34 655 00 11 22).</li>
     </ul>
   </div>
   <p style="margin-top:7mm"><a class="btn" href="#">Ver el presupuesto aceptado</a></p>
   <p style="margin-top:7mm">Quedamos a su disposición para cualquier aclaración.</p>
   <p>Un cordial saludo,<br><b>Marc Subirats</b><br><span class="small muted">${SELLER.name}</span></p>`,
  ),
);

doc(
  "18-email-factura.html",
  "cliente",
  "Correo de envío de factura / Invoice email",
  emailShell(
    "Factura FAC-2026-0021 — obra Balmes 120",
    `${BUYER.contact} &lt;${BUYER.email}&gt;`,
    `<p>Estimado ${BUYER.contact.split(" (")[0]},</p>
   <p>Adjuntamos la factura <b>FAC-2026-0021</b> correspondiente a la certificación nº 2 de la obra de
   Balmes 120, junto con la orden de cambio OC-C-2026-003 aprobada el 9 de junio.</p>
   <table style="margin:6mm 0">
     <tbody>
       <tr><td class="muted">Base imponible</td><td class="num">${eur(194270)}</td></tr>
       <tr><td class="muted">IVA 10 %</td><td class="num">${eur(19427)}</td></tr>
       <tr><td><b>Total</b></td><td class="num"><b>${eur(213697)}</b></td></tr>
       <tr><td class="muted">Vencimiento</td><td class="num">16/07/2026</td></tr>
     </tbody>
   </table>
   <div class="box small"><b>Datos para el pago</b><br>
     Titular: ${SELLER.name}<br>IBAN: ${SELLER.iban}<br>Concepto: <b>FAC-2026-0021</b></div>
   <p style="margin-top:7mm"><a class="btn" href="#">Descargar la factura (PDF)</a></p>
   <p style="margin-top:7mm">Si detecta cualquier discrepancia, respóndanos a este correo y lo revisamos el mismo día.</p>
   <p>Un cordial saludo,<br><b>Administración</b><br><span class="small muted">${SELLER.name}</span></p>`,
  ),
);

doc(
  "19-email-recordatorio-pago.html",
  "cliente",
  "Correo de recordatorio de pago / Payment reminder email",
  emailShell(
    "Recordatorio — factura FAC-2026-0021 vencida el 16/07/2026",
    `${BUYER.contact} &lt;${BUYER.email}&gt;`,
    `<p>Estimado ${BUYER.contact.split(" (")[0]},</p>
   <p>Le recordamos amablemente que la factura <b>FAC-2026-0021</b> por importe de <b>${eur(213697)}</b>
   venció el <b>16 de julio de 2026</b> y consta como pendiente de pago en nuestros registros.</p>
   <div class="note">Si ya ha realizado la transferencia en los últimos días, le rogamos que ignore este mensaje
   — es posible que se hayan cruzado. Si nos indica la fecha y la referencia, lo conciliamos de inmediato.</div>
   <table style="margin:6mm 0">
     <thead><tr><th>Documento</th><th>Fecha</th><th>Vencimiento</th><th class="num">Importe</th><th class="num">Días</th></tr></thead>
     <tbody><tr><td>FAC-2026-0021</td><td>16/06/2026</td><td>16/07/2026</td><td class="num">${eur(213697)}</td><td class="num">9</td></tr></tbody>
   </table>
   <div class="box small"><b>Forma de pago:</b> transferencia a ${SELLER.iban}<br>
   <b>Concepto:</b> FAC-2026-0021</div>
   <p style="margin-top:7mm">Gracias por su colaboración.</p>
   <p>Un cordial saludo,<br><b>Administración</b><br><span class="small muted">${SELLER.name}</span></p>`,
  ),
);

doc(
  "20-email-solicitud-resena.html",
  "cliente",
  "Correo de solicitud de reseña / Review request email",
  emailShell(
    "¿Cómo ha ido la reforma? Nos ayudaría mucho su opinión",
    `${BUYER.contact} &lt;${BUYER.email}&gt;`,
    `<p>Estimado ${BUYER.contact.split(" (")[0]},</p>
   <p>Con la obra de Balmes 120 ya entregada y los repasos cerrados, queríamos darle las gracias por
   habernos confiado el proyecto.</p>
   <p>Si ha quedado satisfecho con el resultado, una reseña nos ayuda muchísimo: la mayoría de nuestros
   clientes nos encuentran gracias a lo que otros han escrito. Le llevará menos de un minuto.</p>
   <p style="margin:8mm 0"><a class="btn" href="#">Dejar una reseña</a></p>
   <div class="note">Y si algo no ha ido como esperaba, preferimos saberlo a nosotros primero:
   respóndanos a este correo y lo resolvemos.</div>
   <p style="margin-top:7mm">Recuerde que la obra tiene <b>3 años de garantía</b> en instalaciones y
   <b>1 año</b> en acabados. Guarde este correo: contiene los datos de contacto para cualquier incidencia.</p>
   <p>Un cordial saludo,<br><b>Marc Subirats</b><br><span class="small muted">${SELLER.name}</span></p>`,
  ),
);

/* ── write ──────────────────────────────────────────────────────────────── */

fs.rmSync(OUT, { recursive: true, force: true });
const GROUPS = {
  cliente: "01-cliente (customer-facing)",
  proveedor: "02-proveedor (supplier-facing)",
  // No slash in a folder name: mkdirSync reads it as a path separator and
  // silently creates two nested directories instead of one folder.
  gestoria: "03-gestoria (agency, accountant)",
  interno: "04-interno (internal staff)",
};
for (const d of DOCS) {
  const dir = path.join(OUT, GROUPS[d.group]);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, d.file), d.html);
}

/* An index, so whoever opens the zip sees the whole set at once. */
const byGroup = Object.entries(GROUPS).map(([key, label]) => ({
  label,
  items: DOCS.filter((d) => d.group === key),
}));
fs.writeFileSync(
  path.join(OUT, "000-INDEX.html"),
  page(
    "Canei Subirats — todos los documentos del ERP",
    head("Índice", `${DOCS.length} documentos`, "Documentos que genera el ERP en operación", [
      "Canei Subirats, S.L.",
      "Para rediseño",
    ]) +
      `<p class="small" style="margin-top:6mm">Cada archivo es una página A4 autónoma con datos de ejemplo realistas
   en todos los campos. Abra cualquiera en el navegador para verlo tal y como se imprime.</p>` +
      byGroup
        .map(
          (g) => `<h2 style="margin-top:7mm">${g.label}</h2>
      <table><tbody>${g.items
        .map(
          (d) =>
            `<tr><td style="width:34%"><a href="${encodeURIComponent(GROUPS[d.group])}/${d.file}" style="color:${C.green};font-weight:600">${d.file}</a></td><td>${d.title}</td></tr>`,
        )
        .join("")}</tbody></table>`,
        )
        .join("") +
      foot(),
  ),
);

console.log(`${DOCS.length} documents → ${OUT}`);
for (const [key, label] of Object.entries(GROUPS)) {
  console.log(`  ${label}: ${DOCS.filter((d) => d.group === key).length}`);
}

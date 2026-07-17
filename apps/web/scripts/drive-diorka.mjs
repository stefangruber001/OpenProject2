// Drive the Diorka R1 flow end-to-end in a real browser; save screenshots
// and API snapshots. Usage: node scripts/drive-diorka.mjs <baseURL> <outDir>
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , base = "http://localhost:3200", outDir = "/tmp/diorka-drive"] = process.argv;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});

// 1. workspace → create presupuesto
await page.goto(`${base}/diorka`);
await page.fill('input[name="title"]', "Reforma integral baño — C/ Balmes 24, 2º1ª");
await page.click('button:has-text("Crear presupuesto")');
await page.waitForURL(/presupuestos\//);

// 2. add partidas (catalogue-first)
async function addPartida({ chapter, desc, unit, unidades, largo, ancho, precio, optional }) {
  await page.waitForSelector('input[name="description"]');
  await page.selectOption('select[name="chapter"]', chapter);
  await page.fill('input[name="description"]', desc);
  await page.selectOption('select[name="unit"]', unit);
  await page.fill('input[name="unidades"]', String(unidades));
  if (largo) await page.fill('input[name="largo"]', String(largo));
  if (ancho) await page.fill('input[name="ancho"]', String(ancho));
  await page.fill('input[name="precio"]', String(precio));
  if (optional) await page.check('input[name="optional"]');
  await page.click('button:has-text("Añadir")');
  // deterministic: the new row must be visible before the next add
  await page.waitForSelector(`tr:has-text("${desc.slice(0, 24)}")`, { timeout: 15000 });
}
await addPartida({
  chapter: "Demoliciones y trabajos previos",
  desc: "Demolición alicatado y retirada de escombros",
  unit: "m²",
  unidades: 1,
  largo: 5,
  ancho: 2.5,
  precio: "18.40",
});
await addPartida({
  chapter: "Revestimientos y acabados",
  desc: "Alicatado azulejo cerámico 20×60",
  unit: "m²",
  unidades: 5,
  largo: 2.5,
  ancho: 1.98,
  precio: "32.00",
});
await addPartida({
  chapter: "Fontanería",
  desc: "Instalación fontanería completa de baño",
  unit: "ud",
  unidades: 1,
  precio: "1850.00",
});
await addPartida({
  chapter: "Trabajos opcionales",
  desc: "Mampara de vidrio templado premium",
  unit: "ud",
  unidades: 1,
  precio: "480.00",
  optional: true,
});
await page.screenshot({ path: resolve(outDir, "1-builder.png"), fullPage: true });

// 3. accept including the optional
await page.check('input[name="options"]');
await page.click('button:has-text("Marcar como aceptado")');
await page.waitForLoadState("networkidle");

// 4. issue the invoice (private dwelling, 15y, 35% materials)
await page.fill('input[name="buyerName"]', "María García López");
await page.fill('input[name="buyerTaxId"]', "00000000T");
await page.fill('input[name="buyerAddress"]', "C/ Balmes 24, Barcelona");
await page.fill('input[name="ageYears"]', "15");
await page.screenshot({ path: resolve(outDir, "2-accepted-issue-form.png"), fullPage: true });
await page.click('button:has-text("Emitir factura")');
await page.waitForURL(/facturas\//);
await page.screenshot({ path: resolve(outDir, "3-factura.png"), fullPage: true });
const facturaUrl = page.url();

// 5. workspace overview
await page.goto(`${base}/diorka`);
await page.screenshot({ path: resolve(outDir, "4-workspace.png"), fullPage: true });

// 6. API snapshots (the backend surface)
const endpoints = ["resolution", "quotes", "invoices"];
const api = {};
for (const ep of endpoints) {
  api[ep] = await (await fetch(`${base}/api/diorka/${ep}`)).json();
}
const invId = api.invoices.invoices[0].id;
api.invoiceDetail = await (await fetch(`${base}/api/diorka/invoices/${invId}`)).json();
api.health = await (await fetch(`${base}/api/health`)).json();
writeFileSync(resolve(outDir, "api-snapshots.json"), JSON.stringify(api, null, 2));

console.log("factura:", facturaUrl);
console.log(
  "total:",
  api.invoices.invoices[0].totalCents,
  "tax:",
  JSON.stringify(api.invoices.invoices[0].taxSummary),
);
await browser.close();

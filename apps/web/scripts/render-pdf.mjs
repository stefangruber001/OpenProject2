// Render an HTML file to a print PDF via headless Chromium.
// Usage: node scripts/render-pdf.mjs <input.html> <output.pdf>
// Set PW_CHROMIUM to a browser binary when the managed download is unavailable.
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node scripts/render-pdf.mjs <input.html> <output.pdf>");
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
});
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(inPath)).href, { waitUntil: "networkidle" });
await page.pdf({
  path: resolve(outPath),
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log(`rendered ${outPath}`);

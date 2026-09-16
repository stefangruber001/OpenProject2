/**
 * Print the two guides to PDF, from the HTML that is actually published.
 *
 * WHY THIS EXISTS. `site/Canei-Subirats-ERP-Operations-Guide.pdf` was made by
 * hand, once, and the page offers it behind the largest button on the screen.
 * By the time the guide had been rewritten the download was three weeks older
 * than the page above it — and a reader who clicks Download gets the OLD
 * document while believing they have the one they were just reading. A stale
 * artifact that nothing regenerates is worse than no artifact: it is confidently
 * wrong.
 *
 * So the PDFs are printed from the pages, by the same browser the e2e suite
 * uses, and this script is how. Run it after editing either guide:
 *
 *     node scripts/guides-pdf.mjs
 *
 * It prints with backgrounds on, which the covers need, and honours the pages'
 * own `@page { size: A4; margin: 0 }` — the section padding IS the margin, so
 * asking Chromium for one as well would inset every page twice.
 *
 * NOT A GATE. Nothing fails if the PDFs are out of date, because a browser
 * binary is not available everywhere this repo is checked out. It is a command
 * to run, written down, next to the thing it maintains.
 */
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");

/* The same resolution the browser suite uses, and for the same reason: the
   workspace hoists playwright-core under .pnpm, where a bare import cannot
   reach it, and CI may have the full package instead. */
const PW = resolve(
  ROOT,
  "node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js",
);
const CHROME =
  process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => existsSync(p)) ||
  undefined;

async function loadChromium() {
  for (const spec of [PW, "playwright-core", "playwright"]) {
    try {
      const m = await import(spec);
      const c = (m.default || m).chromium;
      if (c) return c;
    } catch {}
  }
  throw new Error("playwright-core not found (run `pnpm install`)");
}

/** The pages, and the file each one is offered as. */
const GUIDES = [
  ["setup-guide.html", "Canei-Subirats-ERP-Operations-Guide.pdf"],
  ["company-setup-guide.html", "Canei-Subirats-ERP-Company-Setup-Guide.pdf"],
];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".json": "application/json",
};

/* Served over HTTP rather than opened as file:// — the pages pull the i18n
   dictionaries with <script src>, and a page printed with those missing is a
   page printed in a state no reader will ever see. */
const server = createServer(async (req, res) => {
  const path = join(SITE, decodeURIComponent((req.url || "/").split("?")[0]));
  try {
    if (!path.startsWith(SITE)) throw new Error("outside site/");
    if ((await stat(path)).isDirectory()) throw new Error("directory");
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

const chromium = await loadChromium();
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
for (const [html, pdf] of GUIDES) {
  const resp = await page.goto(`${base}/${html}`, { waitUntil: "networkidle" });
  if (!resp?.ok()) throw new Error(`${html} did not load (${resp?.status()})`);
  // The i18n layer rewrites text after boot; printing before it settles would
  // capture a half-translated page on any browser whose stored language is not
  // the page's own.
  await page.waitForTimeout(600);
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: join(SITE, pdf), format: "A4", printBackground: true });
  console.log(`wrote site/${pdf}`);
}
await browser.close();
server.close();

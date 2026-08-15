/**
 * Print every string the ERP surface actually renders, in the page's own
 * language, one per line.
 *
 * This is the work list for a translator — human or otherwise. It exists
 * because "which strings need translating" was previously answered by reading
 * the dictionary, which is backwards: the dictionary is what we wrote, the
 * rendered page is what the operator reads, and the gap between them is the
 * whole problem.
 *
 * Run:  node tests/i18n/harvest.mjs [page.html …]
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import net from "node:net";
import fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const SITE = resolve(ROOT, "site");
const PW = resolve(
  ROOT,
  "node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js",
);
const CHROME =
  process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p)) ||
  undefined;

const PAGES = process.argv.slice(2).filter((a) => a.endsWith(".html"));
const TARGETS = PAGES.length
  ? PAGES
  : ["erp.html", "clientes.html", "master-data.html", "financial-data.html", "journey.html"];

const HARVEST = `() => {
  const out = [];
  const seen = new Set();
  const push = (text) => {
    const t = (text || "").replace(/\\s+/g, " ").trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  const skip = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const p = n.parentElement;
    if (!p || skip[p.nodeName]) continue;
    if (p.closest('#canei-lang-pill')) continue;
    push(n.nodeValue);
  }
  for (const el of document.querySelectorAll('[placeholder],[title],[aria-label],input[type=button],input[type=submit],option')) {
    // The switcher names each language in its own language, so "Català" is
    // identical in all three renders by design. Counting it would be counting
    // the ruler as part of what it measures.
    if (el.closest('#canei-lang-pill')) continue;
    push(el.getAttribute('placeholder'));
    push(el.getAttribute('title'));
    push(el.getAttribute('aria-label'));
    if (el.nodeName === 'INPUT') push(el.value);
    if (el.nodeName === 'OPTION') push(el.textContent);
  }
  push(document.title);
  return out;
}`;

async function freePort() {
  return new Promise((res) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const p = srv.address().port;
      srv.close(() => res(p));
    });
  });
}

const chromium = (await import(PW)).default.chromium;
const port = await freePort();
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
  cwd: SITE,
  stdio: "ignore",
});
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`${base}/erp.html`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}

const browser = await chromium.launch({ executablePath: CHROME });
const all = new Set();
try {
  for (const page of TARGETS) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await ctx.addInitScript(`try { localStorage.setItem("caneiLang", "es"); } catch (e) {}`);
    const p = await ctx.newPage();
    await p.goto(`${base}/${page}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    for (const s of await p.evaluate(`(${HARVEST})()`)) all.add(s);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill("SIGKILL");
}

for (const s of all) console.log(s);
console.error(`\n${all.size} distinct strings across ${TARGETS.length} pages`);

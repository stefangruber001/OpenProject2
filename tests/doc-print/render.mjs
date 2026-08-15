import pw from "/home/user/OpenProject2/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js";
const { chromium } = pw;
import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2],
  OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });

// Order matters for the reviewer: index first, then by audience, then by the
// number the filename carries — which is the order the ERP produces them in.
const files = [];
const walk = (d) => {
  for (const e of fs
    .readdirSync(d, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) files.push(p);
  }
};
walk(SRC);
files.sort((a, b) => {
  const ai = a.includes("000-INDEX") ? "" : path.relative(SRC, a);
  const bi = b.includes("000-INDEX") ? "" : path.relative(SRC, b);
  return ai.localeCompare(bi);
});

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const made = [];
for (const f of files) {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto("file://" + f, { waitUntil: "networkidle" });
  // Wait for the webfonts specifically. `networkidle` can settle before the
  // font files finish, and a PDF rendered in the fallback face would show the
  // reviewer a design nobody made.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  // MEASURE, don't ask. `document.fonts` reports faces as "unloaded" until the
  // browser decides it needs them, so a status check answers a different
  // question. Rendering the same string in the real face and in the fallback
  // and comparing widths answers this one: if they are identical, the PDF the
  // reviewer opens is not the design anybody made.
  const usedRoboto = await page.evaluate(() => {
    const probe = (family) => {
      const s = document.createElement("span");
      s.textContent = "Presupuesto 1.109,30 € Certificación";
      s.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:400 32px ${family}`;
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return w;
    };
    return Math.abs(probe("'Roboto Serif', Georgia, serif") - probe("Georgia, serif")) > 0.5;
  });
  const rel = path
    .relative(SRC, f)
    .replace(/\//g, "__")
    .replace(/\.html$/, ".pdf");
  const out = path.join(OUT, rel);
  await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
  const pages = (
    fs
      .readFileSync(out)
      .toString("latin1")
      .match(/\/Type\s*\/Page[^s]/g) || []
  ).length;
  made.push({ f: path.relative(SRC, f), out, pages, usedRoboto, errs });
  console.log(
    `${errs.length ? "✗" : "✓"} ${path.relative(SRC, f).padEnd(40)} ${String(pages).padStart(2)}p  font:${usedRoboto ? "ok" : "FALLBACK"}${errs.length ? "  " + errs[0].slice(0, 40) : ""}`,
  );
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, "_manifest.json"), JSON.stringify(made, null, 1));
console.log(`\n${made.length} PDFs, ${made.reduce((s, m) => s + m.pages, 0)} pages total`);
if (made.some((m) => !m.usedRoboto))
  console.log("WARNING: some documents fell back to a substitute font");

/**
 * What is still Spanish inside the BOOTED workspace.
 *
 * WHY A SECOND AUDIT. `audit.mjs` opens each page on a static file server and
 * reads it. For nine of the ten pages that is the whole page. For `erp.html` it
 * is not: the workspace builds its screens from JavaScript after boot, and on a
 * static server the shell never finishes booting — so the audit reads the login
 * chrome and reports 43 strings when the operator is looking at hundreds.
 *
 * That gap is not theoretical. It shipped: an operator on English saw the
 * control tower's description, its "Calculado a las" timestamp, its Recalcular
 * and Imprimir buttons and "0 proyectos activos" in Spanish, on the screen the
 * app opens on. The static audit could not see any of them.
 *
 * So this one waits for the shell, walks the sections the operator walks, and
 * reports every visible string that came out identical in Spanish and in the
 * target language. Same filters, same rules, different vantage point.
 *
 * Run:  node tests/i18n/workspace-audit.mjs [--lang en] [--max N] [--json out]
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

const argv = process.argv.slice(2);
const argOf = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const TARGET = argOf("--lang", "en");
const MAX = argv.includes("--max") ? Number(argOf("--max", "0")) : null;
const JSON_OUT = argOf("--json", "");

const MAXLIST = Number(process.env.AUDIT_LIST || 10);
/** The screens the operator walks, by their hash route. */
const ROUTES = [
  ["tower", "#tower"],
  ["leads", "#leads"],
  ["visits", "#visits"],
  ["projects", "#projects"],
  ["economics", "#economics"],
  ["changes", "#changes"],
  ["invoices", "#invoices"],
  ["purchases", "#purchases"],
  ["capture", "#capture"],
  ["cash", "#cash"],
  ["quotes", "#quotes"],
  ["contracts", "#contracts"],
  /* The hours screen was missing from this list, so every Spanish string on it
     was invisible to a gate whose ceiling is zero. Three tabs now, and the audit
     walks all three: a route that renders behind a tab is still a screen. */
  ["labour", "#labour"],
  /* Two of the hours tabs render only after a click, and a string behind a tab
     is as visible to the operator as one in front of it. The third element is
     JavaScript run after the screen has drawn. */
  ["labour·resumen", "#labour", "document.querySelector('[data-htab=\"summary\"]').click()"],
  ["labour·correcciones", "#labour", "document.querySelector('[data-htab=\"register\"]').click()"],
  ["labour·mias", "#labour", "document.querySelector('[data-hgrp=\"mine\"]').click()"],
  [
    "labour·mias·horas",
    "#labour",
    "document.querySelector('[data-hgrp=\"mine\"]').click(); document.querySelector('[data-hmtab=\"mine\"]').click()",
  ],
  // PRY-04. It used to be a page of its own and was measured by audit.mjs; it is
  // a screen now, so it is measured here, where the screens are — and at the
  // same zero.
  ["journey", "#journey"],
];

/* Same rules as audit.mjs: a shape wherever possible, never a word, because
   every entry here is a place this stops looking. */
const NEUTRAL = [
  /^[\s\p{P}\p{S}\d]*$/u,
  /^[\d.,\s]+(€|%|h|kg|m²|m³|m|ud|u)?$/iu,
  /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/,
  /^[A-Z]{1,5}-?\d{2,}[-/]?[\d-]*$/,
  /^[\w.+-]+@[\w.-]+$/,
  /^https?:\/\//,
  /^[A-Z0-9]{6,}$/,
  /^B2[BC]$/,
  /* Numbers with units, joined by a middot — "80 h · 1.330,00 €". Each half
     already passed as neutral on its own; the separator was the only reason the
     pair did not. No prose can match: every group is digits and a unit. */
  /^[\d.,\s]+\s?(h|€|%|ud|u)?(\s*·\s*[\d.,\s]+\s?(h|€|%|ud|u)?)+$/iu,
  /* A list of project codes, which is what «which sites did this person work
     on» renders as. One code was already neutral; several are not more
     translatable than one. */
  /^[A-Z]{1,5}-?[A-Z]?\d{2,}[-/]?[\d-]*(\s*·\s*[A-Z]{1,5}-?[A-Z]?\d{2,}[-/]?[\d-]*)+$/,
];
const SHARED = new Set(
  (
    "canei subirats erp iva irpf nif cif iban total no ok id url email pdf " +
    "web app control tower dashboard sms whatsapp google outlook gmail excel " +
    "euro euros s.l. sl sa cliente client material materials normal individual " +
    "general legal digital original base extra plan area zona factor sector " +
    "director region version gas internet backup"
  ).split(/\s+/),
);
const PROPER = new Set([
  "Canei Subirats",
  "Marta Roca Puig",
  "Elena Duran Mas",
  "Familia Roca Puig",
  "Comunidad Prop. Balmes 120",
  "Nou Local Gràcia S.L.",
]);

function isNeutral(t) {
  const s = t.trim();
  if (s.length < 2) return true;
  if (PROPER.has(s)) return true;
  if (NEUTRAL.some((re) => re.test(s))) return true;
  const words = s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (!words.length) return true;
  return words.every((w) => SHARED.has(w) || /^\d+$/.test(w));
}

/**
 * A rendered string that is mostly a data value, with no prose around it.
 *
 * The workspace composes labels like "P-2026-0001 — Marta Roca Puig" and
 * "Av. Barcelona 10, 3º 2ª, 08960 Sant Just Desvern" out of fields it holds.
 * Those are data renderings and translating them would be the bug.
 *
 * "Contains a data value" ALONE would be too loose — it would also excuse
 * "Factura FAC-2026-0006 vencida 17 días (Marta Roca Puig)", which is a real
 * interface string that needs a rule, and hiding it is exactly the failure this
 * audit exists to prevent. So two conditions, both required: the data value is
 * at least half the string, AND what remains around it contains no prose —
 * no lowercase word of four or more letters. A code, a dash and a postcode
 * pass; a Spanish sentence does not.
 */
function builtAroundData(text, data) {
  for (const v of data) {
    if (v.length < 8 || v.length * 2 < text.length) continue;
    const at = text.indexOf(v);
    if (at < 0) continue;
    const rest = (text.slice(0, at) + " " + text.slice(at + v.length)).trim();
    if (!/\p{Ll}{4,}/u.test(rest)) return true;
  }
  return false;
}

/** Strings the dictionary translates to themselves — a decision, not a gap. */
function deliberate(target) {
  const w = {};
  for (const f of ["i18n-dict.js", "i18n-dict-ca.js"]) {
    const p = resolve(SITE, f);
    if (fs.existsSync(p)) new Function("window", fs.readFileSync(p, "utf8"))(w);
  }
  const D = w.CANEI_DICT || {};
  const entries =
    target === "ca"
      ? Object.entries(D.ca || {})
      : Object.entries(Object.fromEntries(D.pairs || []));
  if (!entries.length) {
    console.error(`FAIL: the ${target} column of the dictionary read as empty.`);
    process.exit(1);
  }
  const set = new Set();
  for (const [a, b] of entries) if (a === b) set.add(a);
  return set;
}

const HARVEST = `() => {
  const out = [];
  const seen = new Set();
  const push = (t) => {
    const s = (t || "").replace(/\\s+/g, " ").trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  const skip = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const p = n.parentElement;
    if (!p || skip[p.nodeName]) continue;
    if (p.closest('#canei-lang-pill')) continue;
    push(n.nodeValue);
  }
  for (const el of document.querySelectorAll('[placeholder],[title],[aria-label],option,input[type=button],input[type=submit]')) {
    if (el.closest('#canei-lang-pill')) continue;
    push(el.getAttribute('placeholder'));
    push(el.getAttribute('title'));
    push(el.getAttribute('aria-label'));
    if (el.nodeName === 'OPTION') push(el.textContent);
    if (el.nodeName === 'INPUT') push(el.value);
  }
  return out;
}`;

async function freePort() {
  return new Promise((r) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => r(p));
    });
  });
}

/**
 * Every string that is DATA rather than interface, taken from the ERP itself.
 *
 * A customer's name, a site address and a lead's description are identical in
 * all three languages, and translating them would be the bug. The tempting fix
 * is a rule like "skip anything that looks like a proper noun", which would
 * also swallow real labels and quietly shrink what this audit can see — the
 * exact way a coverage check stops being worth running.
 *
 * So nothing is guessed: the page is asked for its own state, and a harvested
 * string is excused only when it is LITERALLY a value in that state. If the
 * seed data changes, this changes with it, and no interface string can hide
 * behind it unless the ERP is genuinely storing it as data.
 */
const DATA_VALUES = `() => {
  const out = [];
  const seen = new Set();
  const visit = (v, depth) => {
    if (depth > 6 || v == null) return;
    if (typeof v === "string") { const s = v.trim(); if (s && !seen.has(s)) { seen.add(s); out.push(s); } return; }
    if (Array.isArray(v)) { for (const x of v) visit(x, depth + 1); return; }
    if (typeof v === "object") { for (const k of Object.keys(v)) visit(v[k], depth + 1); }
  };
  // Reached by bare name, not through window: erp.html declares it with const
  // at the top level of a classic script, which does NOT create a window
  // property. Asking for window.erp returns undefined and the exclusion below
  // would then excuse nothing — which is why this file refuses to run on an
  // empty set rather than reporting a number.
  try { visit(typeof erp !== "undefined" && erp ? erp.state : null, 0); } catch (e) {}
  return out;
}`;

async function walk(browser, base, lang) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(`try {
    localStorage.setItem("caneiLang", ${JSON.stringify(lang)});
    document.cookie = "canei_lang=${lang};path=/;max-age=31536000";
  } catch (e) {}`);
  const p = await ctx.newPage();
  const found = new Map();
  const data = new Set();
  for (const [name, hash, after] of ROUTES) {
    try {
      await p.goto(`${base}/erp.html${hash}`, { waitUntil: "networkidle" });
      // Waited for, not slept for: the shell renders its first screen from data
      // after paint, and a fixed delay measures how fast this machine is.
      await p.waitForSelector("#p1 .secitem", { timeout: 15000 });
      await p.waitForTimeout(700);
      if (after) {
        await p.evaluate(after);
        await p.waitForTimeout(500);
      }
      for (const s of await p.evaluate(`(${HARVEST})()`)) if (!found.has(s)) found.set(s, name);
      for (const s of await p.evaluate(`(${DATA_VALUES})()`)) data.add(s);
    } catch {
      /* a route that does not render is a different bug; the E2E owns it */
    }
  }
  await ctx.close();
  return { found, data };
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
let es, other;
try {
  es = await walk(browser, base, "es");
  other = await walk(browser, base, TARGET);
} finally {
  await browser.close();
  server.kill("SIGKILL");
}

if (es.found.size < 100) {
  console.error(`FAIL: only ${es.found.size} strings harvested — the shell did not boot.`);
  process.exit(1);
}
if (es.data.size < 20) {
  console.error(
    `FAIL: only ${es.data.size} data values read from erp.state. The exclusion below ` +
      `would then excuse nothing OR everything depending on why, and neither is a ` +
      `measurement. Check that window.erp.state is populated.`,
  );
  process.exit(1);
}

const keep = deliberate(TARGET);
const stuck = [];
let asData = 0;
for (const [s, where] of es.found) {
  if (!other.found.has(s)) continue;
  if (isNeutral(s) || keep.has(s)) continue;
  // A string the ERP is storing as data is not an interface string.
  if (es.data.has(s) || builtAroundData(s, es.data)) {
    asData++;
    continue;
  }
  stuck.push({ text: s, screen: where });
}

const byScreen = {};
for (const s of stuck) (byScreen[s.screen] = byScreen[s.screen] || []).push(s.text);

console.log(`\n──── workspace audit: es → ${TARGET} ────`);
console.log(
  `${es.found.size} strings harvested across ${ROUTES.length} screens · ` +
    `${asData} excused as ERP data (${es.data.size} values in erp.state)\n`,
);
for (const [screen, list] of Object.entries(byScreen)) {
  console.log(`✗ ${screen.padEnd(12)} ${String(list.length).padStart(3)} untranslated`);
  for (const t of list.slice(0, MAXLIST)) console.log(`      · ${t.slice(0, 96)}`);
  if (list.length > MAXLIST) console.log(`      … and ${list.length - MAXLIST} more`);
}
console.log(`\n${stuck.length} untranslated strings in the booted workspace`);

if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(stuck, null, 1));
if (MAX !== null && stuck.length > MAX) {
  console.error(`FAIL: ${stuck.length} untranslated, limit ${MAX}`);
  process.exit(1);
}

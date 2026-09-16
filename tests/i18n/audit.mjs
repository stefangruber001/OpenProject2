/**
 * What is still untranslated, measured by looking at the rendered page.
 *
 * WHY NOT COUNT DICTIONARY ENTRIES. This project has been told three times that
 * its translation coverage was fine by a script that counted the wrong thing —
 * once a hand-written word list that missed every singular, once a probe reading
 * `CANEI_DICT.phrases` when the key is `pairs` (so it compared every page
 * against the literal string "pairs" and reported all nine clean), and once a
 * substring match that over-counted. The dictionary is not the artifact anybody
 * uses. The rendered page is.
 *
 * So: open each page in a real browser once per language, read the text the
 * operator would actually see, and report every string that came out identical
 * in two different languages. Identical text in two languages is either
 * untranslated or language-neutral, and the filters below remove the
 * language-neutral cases — numbers, money, dates, codes, brand names, and the
 * words Spanish and English genuinely share.
 *
 * It reports; it does not assert. `--max N` turns it into a gate, and CI runs
 * it that way — as a RATCHET at the numbers measured today, so the count can go
 * down but never back up.
 *
 * WHAT THE NUMBER IS AND IS NOT. It is an upper bound on untranslated text, not
 * a translation debt. Two things inflate it, and both are known:
 *
 *   · `erp.html`, `index.html` and `dashboard.html` are measured on a static
 *     file server where the workspace shell never boots, so what is read is the
 *     pre-boot chrome, not the screens the operator uses. The BOOTED workspace
 *     is covered far better by tests/site-e2e/run.mjs, which drives every
 *     screen in all three languages and asserts on the visible strings.
 *   · A string is counted when it appears anywhere in both renders. A label
 *     that is correctly translated in the page body but survives untranslated
 *     in one `<select>` is counted once, and reads as a whole missing entry.
 *
 * Measured 2026-08-17, after the Catalan backlog was cleared to zero:
 * master-data.html and financial-data.html are at 0, and the DICTIONARY is
 * complete in all three languages — `coverage.mjs` now enforces that
 * absolutely rather than against a declining ceiling.
 *
 * WHAT THE RESIDUE IS, honestly, because the number is not zero and saying
 * "translated" without this sentence would be a lie:
 *
 *   · Company DATA. "Marta Roca Puig", "C/ Balmes 120", "P-R014",
 *     "Forn Sant Jordi S.L." — names, addresses and document codes rendered by
 *     the demo seed. They must NEVER be translated, and every one of them is a
 *     false positive of this check rather than a gap in the product. They are
 *     left counted rather than pattern-matched away: a rule broad enough to
 *     catch a person's name is broad enough to hide a real label, which is the
 *     exact failure this file exists to prevent. Better a known, explained
 *     residue than a clean report bought with a rule nobody can bound.
 *   · English-source documents — see ENGLISH_BY_DESIGN below.
 *
 * So the honest claim is: the ERP's INTERFACE is fully translated; what is
 * still reported is the company's own data and two English documents.
 *
 * Run:  node tests/i18n/audit.mjs [--lang ca] [--max 0] [--json out.json]
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
const argOf = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const TARGET = argOf("--lang", "en");
const MAX = argv.includes("--max") ? Number(argOf("--max", "0")) : null;
const JSON_OUT = argOf("--json", "");

const PAGES = [
  "index.html",
  "erp.html",
  // journey.html is a forwarding stub since the recorrido became erp.html#journey
  // (PRY-04). What it used to hold is measured by workspace-audit.mjs, which walks
  // the booted screens and runs at zero.
  "dashboard.html",
  "clientes.html",
  "master-data.html",
  "financial-data.html",
  "frontend.html",
];

/**
 * Documents written IN ENGLISH, on purpose, and therefore not measured here.
 *
 * These are not screens with missing translations — they are English-source
 * technical documents, and the distinction matters because counting them makes
 * a completed job read as 80% done for ever:
 *
 *   · setup-guide.html — the go-live runbook. The operator's decision, taken
 *     2026-08-17: "setup guide we keep English only." Translating it is not
 *     457 missing Catalan entries but ~914 translations, because the page is
 *     `lang="en"` and every string would need a Spanish key INVENTED as well
 *     as a Catalan form written. It is read once, by whoever installs the
 *     system, and English is the language that audience already works in.
 *   · company-setup-guide.html — the first-run guide, written beside the one
 *     above and for the same audience, on the same decision. Both stopped
 *     loading the i18n layer when it turned out to be doing the worst possible
 *     thing to them: with the stored language Spanish and the pages declared
 *     `lang="en"`, it translated back through the reverse map and caught only
 *     the phrases that happen to have a Spanish form, leaving an English
 *     document patched with Spanish.
 *   · backend.html — captured HTTP traffic and API paths. `GET`,
 *     `…/invoices/{id}` and "captured from the running server" are not phrases
 *     with a Catalan form.
 *
 * The rule this follows is the one the miss-crawler already applies to company
 * records: split by ORIGIN, not by storage. A page authored in English is a
 * different thing from a Spanish screen that lost its translation, and a check
 * that cannot tell them apart reports a number nobody can act on.
 */
const ENGLISH_BY_DESIGN = ["setup-guide.html", "company-setup-guide.html", "backend.html"];

/**
 * Strings that being identical in two languages says nothing about.
 *
 * Deliberately conservative — every entry here is a place the audit stops
 * looking, so a rule that is too broad turns a real gap into a clean report.
 * That is exactly the failure this file exists to avoid, so each is a shape
 * (a number, a code) rather than a word wherever possible.
 */
const NEUTRAL = [
  /^[\s\p{P}\p{S}\d]*$/u, // punctuation, digits, symbols, arrows, currency
  /^[\d.,\s]+(€|%|h|kg|m²|m³|m|ud|u)?$/iu, // quantities
  /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/, // dates
  /^[A-Z]{1,4}-?\d{2,}[-/]?\d*$/, // document numbers: P-2026-0001, F2026/12
  /^[\w.+-]+@[\w.-]+$/, // email addresses
  /^https?:\/\//,
  /^[A-Z0-9]{6,}$/, // NIF/CIF-ish, IBAN fragments
  /^B2[BC]$/, // customer segment codes
  /^[\d.,\s]+\/[\d.,\s]*d?$/, // paired metrics: "38 / 38d"
];

/**
 * The demonstration customers.
 *
 * A person's or a building's name is the same in all three languages, so it is
 * flagged by a test whose question is "did this come out the same" — and it is
 * the one class of string where translating it would be the bug. Listed by name
 * rather than by a "looks like a proper noun" rule, because such a rule would
 * also swallow real labels and quietly shrink what this audit can see.
 */
const PROPER_NOUNS = new Set([
  "Familia Roca Puig",
  "Comunidad Prop. Balmes 120",
  "Nou Local Gràcia S.L.",
  "Marta Roca Puig",
  "Elena Duran Mas",
]);

/** Words that ARE the same in Spanish, Catalan and English. */
const SHARED = new Set(
  (
    "canei subirats erp iva irpf nif cif iban total no ok id url email pdf cif/nif " +
    "web app ios android github docker postgres sql api json html css js " +
    "control tower dashboard software hardware marketing sms whatsapp google " +
    "outlook gmail excel euro euros s.l. sl sa cliente client " +
    "material materials normal individual general legal digital total original " +
    "base extra plan area zona factor sector director region version " +
    "gas internet router server proxy backup"
  ).split(/\s+/),
);

/**
 * Strings the dictionary has an explicit opinion about.
 *
 * WHY THIS MATTERS MORE THAN IT SOUNDS. "Principal", "Subtotal", "Comercial",
 * "Documental" and "Variables" are spelled identically in Spanish and Catalan.
 * Comparing rendered pages flags every one of them, because the test for
 * "untranslated" is "came out the same" — and for these the correct translation
 * IS the same. Left alone, the audit would demand changes that would make the
 * Catalan wrong, and its number would never reach zero however much work was
 * done, which is the fastest way to make a gate get ignored.
 *
 * So: an entry that translates to itself is a DECISION and does not count. A
 * string with no entry at all is a GAP. The dictionary is not being used to
 * measure coverage here — the rendered page still does that — it is only being
 * asked whether somebody looked at this string and said "it stays".
 */
function loadDeliberate(target) {
  const sandbox = { window: {} };
  for (const file of ["i18n-dict.js", "i18n-dict-ca.js"]) {
    const path = resolve(SITE, file);
    if (!fs.existsSync(path)) continue;
    // Evaluated rather than imported: these are browser scripts that assign to
    // `window`, and a `window` object is the whole environment they need.
    const fn = new Function("window", fs.readFileSync(path, "utf8"));
    fn(sandbox.window);
  }
  const D = sandbox.window.CANEI_DICT || {};
  const exact = new Set();
  // The two columns are shaped differently and always have been: `pairs` is a
  // list of [es, en] and `ca` is an OBJECT keyed on the Spanish string. Reading
  // the object as a list yields nothing, which would empty this set silently —
  // and an empty set does not make the audit fail, it makes it over-report,
  // demanding "fixes" for strings somebody already decided stay as they are.
  // So the shape is asserted rather than assumed.
  const entries =
    target === "ca"
      ? Object.entries(D.ca || {})
      : Object.entries(Object.fromEntries(D.pairs || []));
  if (!entries.length) {
    console.error(
      `FAIL: the ${target} column of the dictionary read as empty. ` +
        `Expected ${target === "ca" ? "an object keyed on Spanish (window.CANEI_DICT.ca)" : "a list of [es, en] pairs (window.CANEI_DICT.pairs)"}.`,
    );
    process.exit(1);
  }
  for (const [from, to] of entries) if (from === to) exact.add(from);
  return exact;
}

function isNeutral(text) {
  const t = text.trim();
  if (t.length < 2) return true;
  if (PROPER_NOUNS.has(t)) return true;
  if (NEUTRAL.some((re) => re.test(t))) return true;
  // A phrase made entirely of shared words / numbers is not evidence of a gap.
  const words = t
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (!words.length) return true;
  return words.every((w) => SHARED.has(w) || /^\d+$/.test(w));
}

async function freePort() {
  return new Promise((res) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const p = srv.address().port;
      srv.close(() => res(p));
    });
  });
}

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

/** Everything the operator can read, as a flat list, with a hint of where. */
const HARVEST = `() => {
  const out = [];
  const seen = new Set();
  const push = (text, where) => {
    const t = (text || "").replace(/\\s+/g, " ").trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push({ t, where });
  };
  const skip = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  // A LANGUAGE SWITCHER IS THE RULER, NOT WHAT IS BEING MEASURED.
  // It names each language in its own language, so Català is Català in every
  // render by design, and its buttons are the codes ES/CA/EN. Counting them
  // reports a translation gap that does not exist.
  //
  // Read from the translate="no" attribute, which site/i18n.js already honours
  // and the pill already sets on itself. It used to be pinned to the pill's id,
  // which had two failure modes: a switcher drawn anywhere else was counted,
  // and the pill is INJECTED, so whether these six strings landed in the report
  // depended on winning a race with a 700ms wait — a silent thirty-string swing
  // in a budget of ninety-one.
  //
  // No backticks below: this function is carried to the browser inside a
  // template literal, and one would end the string early.
  const optedOut = (el) => !!(el && el.closest && el.closest('[translate="no"]'));
  while ((n = walker.nextNode())) {
    const p = n.parentElement;
    if (!p || skip[p.nodeName]) continue;
    // Only what is actually on screen. Hidden tabs are still real UI, so
    // display:none is allowed through — but a language switcher is not.
    if (optedOut(p)) continue;
    push(n.nodeValue, p.nodeName.toLowerCase() + (p.id ? '#' + p.id : ''));
  }
  for (const el of document.querySelectorAll('[placeholder],[title],[aria-label],input[type=button],input[type=submit],option')) {
    if (optedOut(el)) continue;
    push(el.getAttribute('placeholder'), 'placeholder');
    push(el.getAttribute('title'), 'title');
    push(el.getAttribute('aria-label'), 'aria-label');
    if (el.nodeName === 'INPUT') push(el.value, 'button');
    if (el.nodeName === 'OPTION') push(el.textContent, 'option');
  }
  push(document.title, 'title');
  return out;
}`;

async function harvest(browser, base, page, lang) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  // Set the choice before any script runs, so the page boots in that language
  // rather than being switched afterwards — the second is a different code path
  // and would hide anything only the boot pass translates.
  await ctx.addInitScript(
    `try { localStorage.setItem("caneiLang", ${JSON.stringify(lang)}); } catch (e) {}`,
  );
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${base}/${page}`, { waitUntil: "networkidle" });
  // The workspace renders its first screen from JS; give the observer a frame.
  await p.waitForTimeout(700);
  // Called, not merely evaluated. A string argument is an EXPRESSION: passing
  // the arrow function on its own evaluates to a function object, which is not
  // serialisable, so it arrives as undefined — and an audit that harvests
  // nothing reports every page clean.
  const items = await p.evaluate(`(${HARVEST})()`);
  const htmlLang = await p.evaluate("document.documentElement.getAttribute('lang')");
  await ctx.close();
  return { items, htmlLang, errors };
}

async function main() {
  const chromium = await loadChromium();
  const port = await freePort();
  const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: SITE,
    stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/index.html`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }

  const browser = await chromium.launch({ executablePath: CHROME });
  const deliberate = loadDeliberate(TARGET);
  const report = [];
  try {
    for (const page of PAGES) {
      const es = await harvest(browser, base, page, "es");
      const other = await harvest(browser, base, page, TARGET);
      const otherText = new Set(other.items.map((i) => i.t));

      // Untranslated = present, character for character, in both renders.
      const stuck = es.items.filter(
        (i) => otherText.has(i.t) && !isNeutral(i.t) && !deliberate.has(i.t),
      );
      report.push({
        page,
        htmlLang: other.htmlLang,
        strings: es.items.length,
        stuck: stuck.map((s) => s.t),
        errors: [...es.errors, ...other.errors],
      });
    }
  } finally {
    await browser.close();
    server.kill("SIGKILL");
  }

  let total = 0;
  console.log(`\n──────── i18n audit: es → ${TARGET} ────────`);
  for (const r of report) {
    total += r.stuck.length;
    const flag = r.stuck.length === 0 ? "✓" : "✗";
    console.log(
      `${flag} ${r.page.padEnd(22)} ${String(r.strings).padStart(4)} strings, ` +
        `${String(r.stuck.length).padStart(4)} untranslated` +
        (r.htmlLang === TARGET ? "" : `   [lang=${r.htmlLang}]`),
    );
    for (const s of r.stuck.slice(0, 12)) console.log(`      · ${s.slice(0, 96)}`);
    if (r.stuck.length > 12) console.log(`      … and ${r.stuck.length - 12} more`);
  }
  console.log(`\n${total} untranslated strings across ${report.length} pages`);

  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
  if (MAX !== null && total > MAX) {
    console.error(`FAIL: ${total} untranslated, limit ${MAX}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

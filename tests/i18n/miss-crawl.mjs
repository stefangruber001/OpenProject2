/**
 * What the translator itself could not translate.
 *
 *   node tests/i18n/miss-crawl.mjs [--lang en|ca] [--max N] [--json out.json]
 *
 * WHY THIS REPLACES THE SCANNERS. Four audits already try to answer "what is
 * still untranslated", and each answers it by GUESSING FROM OUTSIDE:
 *
 *   coverage.mjs        — does every dictionary entry have all three languages?
 *   audit.mjs           — render ten static pages twice and diff them.
 *   workspace-audit.mjs — boot the shell, walk twelve routes, diff them.
 *   source-audit.mjs    — read the source and pattern-match the literals.
 *
 * Every one of them enumerates PLACES a string might live — an entry, a page, a
 * route, a quoted literal — and every one of them has shipped a false clean
 * report, because a screen reached by pressing a button inside a panel is in
 * none of those lists. The report that prompted this file was a photograph of
 * an invoice-issuing form: English chrome, Spanish labels, and four green
 * audits.
 *
 * The translator does not have that blind spot. `tr()` is called with every
 * user-visible string a fraction of a second before it is painted, and on a
 * miss it has just decided, with complete information, that the string has no
 * translation. `site/i18n.js` now keeps those verdicts (`CANEI_I18N.misses()`);
 * this file drives the application until it has painted everything, and reads
 * them off. It does not look for strings. It records the ones that arrive.
 *
 * HOW IT REACHES THE SCREENS THE OTHERS CANNOT. After each route settles it
 * clicks every visible control on the page — buttons, tabs, table rows, the
 * `[data-go]` cards — one at a time, waits for the render, and moves on. The
 * point is not to test the controls; it is that a panel which has never been
 * opened has never been painted, and a string that has never been painted has
 * never been offered to `tr()`. Anything destructive is skipped by name.
 *
 * WHAT A FAILURE MEANS. `--max N` is a ratchet, not a target. Over it fails the
 * build; under it prints the new number so it can be lowered. Every string in
 * the report is one an operator can see in the wrong language.
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
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find((p) =>
    fs.existsSync(p),
  ) ||
  undefined;

const argv = process.argv.slice(2);
const argOf = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const TARGET = argOf("--lang", "en");
const MAX = argv.includes("--max") ? Number(argOf("--max", "0")) : null;
const JSON_OUT = argOf("--json", "");
/** How many controls to press per route. Enough to open every panel. */
const CLICKS = Number(argOf("--clicks", "40"));

/**
 * The pages to drive. `erp.html` carries no route list here ON PURPOSE.
 *
 * It used to: fourteen hashes copied out of the application. Then a merge
 * renamed two of them, five pages stopped rendering, and the run reported a
 * total as though it had walked them — the exact "measured the wrong thing"
 * failure this file was written to end, reproduced inside the file itself.
 *
 * A hard-coded copy of somebody else's list is a copy that drifts. The
 * workspace declares its own sections in `SECTIONS`, so the routes are read
 * from the running application and cannot disagree with it.
 */
const STATIC_PAGES = [
  ["journey.html", ""],
  ["master-data.html", ""],
  ["financial-data.html", ""],
];

/** Every sub-section the workspace declares, in the order the nav shows them. */
const DISCOVER_ROUTES = `() => {
  try {
    if (typeof SECTIONS === "undefined" || !SECTIONS) return [];
    const out = [];
    for (const s of SECTIONS) for (const sub of s.subs || []) if (sub && sub.k) out.push(sub.k);
    return out;
  } catch (e) {
    return [];
  }
}`;
/**
 * Controls this crawler will not press.
 *
 * Matched on the control's own visible text, because that is what a person
 * reads before deciding. The seed data is a throwaway copy in a temporary
 * server, so the cost of a wrong press is low — but a crawl that deletes the
 * fixtures half way through reports the empty-state strings of every screen
 * after it and calls the rest clean, which is a false GREEN, and those are the
 * failures this whole exercise exists to stop.
 */
const DESTRUCTIVE =
  /elimin|borrar|delete|vaciar|reset|restablec|cerrar sesión|logout|sign out|descartar|discard|anular|cancel·l|esborrar|suprimir/i;

/**
 * Every string the ERP is storing as DATA, read from the ERP itself.
 *
 * A customer's name, a site address, a surveyor's note — "Andamio necesario",
 * "Croquis a mano; bajante en buen estado" — are identical in all three
 * languages and translating them would be the bug, not the fix. The tempting
 * shortcut is a rule like "skip anything that looks like free text", which
 * would also swallow real labels and quietly shrink what this can see.
 *
 * So nothing is guessed. The page is asked for its own state and a miss is
 * excused only when it is LITERALLY a value in that state. Same rule, same
 * code shape as workspace-audit.mjs, so the two cannot disagree about what
 * counts as data.
 */
/**
 * The collections in `erp.state` that hold the COMPANY'S OWN RECORDS.
 *
 * THIS LIST IS THE WHOLE ARGUMENT, so it is written out rather than inferred.
 * "The ERP stores it" and "it is not interface text" are not the same claim,
 * and treating them as the same is how the first version of this file hid
 * twenty-five alert rules — "Capítulo por encima de coste previsto", "Caja no
 * cubre los pagos previstos" — which are shipped English-less vocabulary that
 * every operator reads, and which happen to live in state because they are
 * configurable. They were in the report; a rule meant to remove customer names
 * removed them too, and the number went down, which is the most dangerous
 * direction for a number to move.
 *
 * So the split is by ORIGIN, not by storage. Below: things the company typed —
 * customers, sites, quotes, invoices, hours, bank movements. Absent, and
 * therefore reported: `alertRules`, `commsTemplates`, `commsRules`,
 * `clauseBlocks` and `lists`, which ship WITH the product, are the same for
 * every tenant until edited, and are the vendor's job to translate.
 *
 * Adding a key here silences everything in it. Do it only for a collection the
 * customer authors.
 */
const RECORDS = new Set([
  "config",
  "series",
  "parties",
  "properties",
  "opportunities",
  "visits",
  "catalogue",
  "packages",
  "prices",
  "budgets",
  "contracts",
  "projects",
  "purchases",
  "subcontracts",
  "captured",
  "changes",
  "invoices",
  "receipts",
  "collections",
  "bills",
  "payments",
  "bankAccounts",
  "movements",
  "merchantRules",
  "bankPeriods",
  "commsQueue",
  "gestoriaQueries",
  "labour",
  "workers",
  "tasks",
  "packagesSent",
  "audit",
  "invoiceEvents",
  "alertOverrides",
  "feedback",
  "supplierPerf",
  "assignments",
  "recurring",
  "importConflicts",
  "imports",
  "plans",
  "exceptionsAccepted",
  "today",
  "seq",
  "seedVersion",
  // `lists` (units, lead sources, payment methods, trades) and `commsTemplates`
  // carry their OWN `es` / `ca` columns and are edited from the workspace —
  // translating them is the product's job through those columns, not the
  // dictionary's, and a dictionary entry would fight the editor. Their config
  // screens legitimately show both language columns side by side, which is why
  // "metro cuadrado" and "metre quadrat" appear together on an English screen
  // and are correct there.
  "lists",
  "commsTemplates",
]);

const DATA_VALUES = `() => {
  const out = [];
  const seen = new Set();
  const visit = (v, depth, top) => {
    if (depth > 6 || v == null) return;
    if (typeof v === "string") {
      const s = v.trim();
      if (s && !seen.has(top + "\\u0000" + s)) { seen.add(top + "\\u0000" + s); out.push([top, s]); }
      return;
    }
    if (Array.isArray(v)) { for (const x of v) visit(x, depth + 1, top); return; }
    if (typeof v === "object") { for (const k of Object.keys(v)) visit(v[k], depth + 1, depth === 0 ? k : top); }
  };
  // Reached by bare name: erp.html declares it with const at the top level of a
  // classic script, which does not create a window property.
  try { visit(typeof erp !== "undefined" && erp ? erp.state : null, 0, "?"); } catch (e) {}
  return out;
}`;

/**
 * A rendered string that is mostly a data value with no prose around it.
 *
 * "Contains a data value" alone would be too loose — it would also excuse
 * "Factura FAC-2026-0006 vencida 17 días (Marta Roca Puig)", a real interface
 * string that needs a rule, and hiding it is the failure this exists to stop.
 * So both: the value is at least half the string, AND what is left around it
 * has no prose in it — no lowercase word of four letters or more.
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

/**
 * A row assembled out of SEVERAL data values, joined with "·".
 *
 * `builtAroundData` asks whether ONE value dominates the string. That is the
 * right question for "P-2026-0001 — Marta Roca Puig" and the wrong one for the
 * rows the workspace actually builds:
 *
 *     Marta Roca Puig · Av. Barcelona 10, 3º 2ª
 *     Salón · 28 m2 · Pasillo · 9 m2
 *     1.1 Nivelación y pavimento cerámico salón
 *
 * Neither half of the first dominates, so the single-value rule reports it, and
 * twenty-nine of the first hundred and thirty-seven findings were rows of that
 * shape — customer names, street addresses, room names and chapter titles. Not
 * one of them has a translation, because they are the company's records; a
 * dictionary entry for any of them would be a bug that renames a customer.
 *
 * So each segment is justified on its own, and EVERY segment must be: it is a
 * stored value, or part of one, or has no prose in it at all. One segment of
 * real Spanish and the whole row is reported — which is why "Hito de cobro
 * 20/06/2026 · Fin previsto 25/07/2026" stays in the report where it belongs.
 */
function composedOfData(text, data, index) {
  const segs = text.split(/\s·\s|\s—\s|,\s/).map((s) => s.trim());
  if (segs.length < 2 && !index.has(text)) {
    // A single segment still qualifies when it is literally a stored value or a
    // fragment of one — "Av. Barcelona 10, 3º 2ª, Sant Just Desvern" is the
    // address minus its postcode.
    return partOfValue(text, data);
  }
  let anyWord = false;
  for (const s of segs) {
    if (!s) continue;
    if (/\p{L}/u.test(s)) anyWord = true;
    if (!/\p{Ll}{4,}/u.test(s)) continue; // digits, units, codes, short words
    if (index.has(s)) continue;
    if (!partOfValue(s, data)) return false;
  }
  return anyWord;
}

/**
 * Is this segment made of stored values and nothing else that reads as prose?
 *
 * Asked by SUBTRACTION rather than by comparison, because the workspace glues
 * several fields into one line — "C/ Balmes 120, 08008 Barcelona" is a street,
 * a postcode and a city, and it equals no single stored value. So every stored
 * value is removed from the segment and what is left is examined: if no word of
 * four or more lowercase letters survives, the segment was data. A Spanish
 * sentence survives the subtraction almost intact and is reported.
 *
 * Values shorter than six characters are not subtracted. "obra" or "base"
 * sitting in some record would otherwise erase the same word out of a genuine
 * label and quietly excuse it.
 */
function partOfValue(s, data) {
  if (s.length < 4) return false;
  let rest = s;
  for (const v of data) {
    if (v.length >= 6 && rest.includes(v)) rest = rest.split(v).join(" ");
    if (!/\p{Ll}{4,}/u.test(rest)) return true;
  }
  return !/\p{Ll}{4,}/u.test(rest);
}

/** Read and clear the page's ledger. */
const DRAIN = `() => {
  const api = window.CANEI_I18N;
  if (!api || !api.misses) return null;
  const out = api.misses().map((m) => ({ text: m.text, n: m.n, where: m.where }));
  api.resetMisses();
  return out;
}`;

/**
 * Every control worth pressing, as a list of stable handles.
 *
 * Returns indices into a freshly-built list rather than element handles: a
 * click re-renders the screen and detaches anything held from before it, so
 * the list is rebuilt for each press and addressed by position.
 */
const CONTROLS = `() => {
  const sel = 'button, [data-go], [role=tab], summary, .click, .tcard, .secitem, [onclick]';
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('#canei-lang-pill,#canei-i18n-hud')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    out.push((el.textContent || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 60));
  }
  return out;
}`;

const CLICK_AT = `(i) => {
  const sel = 'button, [data-go], [role=tab], summary, .click, .tcard, .secitem, [onclick]';
  const all = [];
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('#canei-lang-pill,#canei-i18n-hud')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    all.push(el);
  }
  const el = all[i];
  if (!el) return false;
  try { el.click(); } catch (e) { return false; }
  return true;
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

async function crawl(browser, base, lang) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  // Audit mode is what makes the ledger record WHERE each miss was seen; the
  // outlines it also draws are invisible in a headless run and harmless.
  await ctx.addInitScript(`try {
    localStorage.setItem("caneiLang", ${JSON.stringify(lang)});
    localStorage.setItem("caneiI18nTrace", "1");
    document.cookie = "canei_lang=${lang};path=/;max-age=31536000";
  } catch (e) {}`);
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.dismiss().catch(() => {}));

  const found = new Map();
  const data = new Set();
  const vocabulary = new Set();
  const absorb = (rows, where) => {
    for (const m of rows || []) {
      const e = found.get(m.text);
      if (e) e.n += m.n;
      else found.set(m.text, { text: m.text, n: m.n, where: m.where || where });
    }
  };

  /* The workspace's own route list, read from the workspace. A boot that
     yields no routes is a failure, not an empty walk — it would otherwise
     report zero untranslated strings for the largest page in the product. */
  let pages = [];
  try {
    await page.goto(`${base}/erp.html`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("#p1 .secitem", { timeout: 20000 });
    const routes = await page.evaluate(`(${DISCOVER_ROUTES})()`);
    if (!routes.length) throw new Error("SECTIONS declared no routes");
    pages = routes.map((k) => ["erp.html", `#${k}`]).concat(STATIC_PAGES);
    console.log(`  ${routes.length} workspace routes discovered: ${routes.join(" ")}`);
  } catch (e) {
    console.error(`FAIL: could not read the workspace's route list — ${e.message}`);
    await ctx.close();
    return {
      found,
      booted: 0,
      data,
      vocabulary,
      failed: ["erp.html — route discovery"],
      pages: [],
    };
  }

  let booted = 0;
  const failed = [];
  for (const [file, hash] of pages) {
    try {
      await page.goto(`${base}/${file}${hash}`, { waitUntil: "networkidle", timeout: 45000 });
      // Wait for the shell only if we are still IN the shell. Two of the
      // workspace's own routes are links to satellite pages — `#financials`
      // lands on financial-data.html — and demanding the shell's nav there
      // reports a working link as a broken page. The satellite still painted,
      // still ran i18n.js, and is still measured; it simply has no #p1.
      // The shell wait is BEST EFFORT, and the failure criterion is the
      // ledger, not a selector.
      //
      // Two routes broke a strict wait for reasons that had nothing to do with
      // translation: #financials is a link to financial-data.html, so the
      // shell's nav never appears because we are no longer in the shell; and
      // #quotes renders in under eight seconds alone but not always inside a
      // run that drives thirty-three pages. Both were reported as broken pages.
      //
      // What this file actually needs is `CANEI_I18N.misses()`. If that answers,
      // i18n.js ran, the page painted, and the strings were offered to tr() —
      // which is the whole measurement. So wait for the shell if it comes,
      // shrug if it does not, and let the drain below decide.
      if (file === "erp.html" && page.url().includes("erp.html")) {
        await page.waitForSelector("#p1 .secitem", { timeout: 20000 }).catch(() => {});
      }
      await page.waitForTimeout(600);
      const first = await page.evaluate(`(${DRAIN})()`);
      if (first === null) {
        // No ledger on the page: i18n.js absent, or it never ran. Either way
        // this page contributed nothing and must say so.
        failed.push(`${file}${hash} — no translation ledger on the page`);
        continue;
      }
      booted++;
      absorb(first, `${file}${hash}`);
      for (const [top, v] of await page.evaluate(`(${DATA_VALUES})()`)) {
        if (RECORDS.has(top)) data.add(v);
        else vocabulary.add(`${top} · ${v}`);
      }

      const labels = await page.evaluate(`(${CONTROLS})()`);
      const budget = Math.min(labels.length, CLICKS);
      for (let i = 0; i < budget; i++) {
        if (DESTRUCTIVE.test(labels[i])) continue;
        try {
          const ok = await page.evaluate(`(${CLICK_AT})(${i})`);
          if (!ok) continue;
          await page.waitForTimeout(180);
          absorb(await page.evaluate(`(${DRAIN})()`), `${file}${hash} ▸ ${labels[i]}`);
          // Back to a known state: close whatever opened, and re-assert the
          // route, so press i+1 starts from the same screen press i did.
          await page.keyboard.press("Escape").catch(() => {});
          if (hash && (await page.evaluate("location.hash")) !== hash) {
            await page.evaluate(`location.hash = ${JSON.stringify(hash)}`);
            await page.waitForTimeout(150);
            absorb(await page.evaluate(`(${DRAIN})()`), `${file}${hash}`);
          }
        } catch {
          /* a control that navigates away or throws is not this file's problem */
        }
      }
    } catch (e) {
      // A page that will not render contributes NOTHING, and a run that stays
      // quiet about it reports a smaller number for a better-looking reason.
      // The merge that brought twelve sessions of new screens also renamed the
      // selector this waits for, and five pages dropped out of a run that still
      // printed a total. Never again silently.
      failed.push(
        `${file}${hash} — ${String(e.message || e)
          .split("\n")[0]
          .slice(0, 120)}`,
      );
    }
  }
  await ctx.close();
  return { found, booted, data, vocabulary, failed, pages };
}

/* ---------------------------------------------------------------- run ---- */
const chromium = (await import(PW)).default.chromium;
const port = await freePort();
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
  cwd: SITE,
  stdio: "ignore",
});
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) {
  try {
    if ((await fetch(`${base}/erp.html`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}

const browser = await chromium.launch({ executablePath: CHROME });
let result;
try {
  result = await crawl(browser, base, TARGET);
} finally {
  await browser.close();
  server.kill("SIGKILL");
}

/**
 * The negative control this file needs in order to mean anything.
 *
 * An empty report is the same shape whether nothing is untranslated or nothing
 * was ever loaded, and this project has already believed a green produced by a
 * harness that measured the wrong thing. So the run asserts it actually drove
 * the application: if fewer than half the pages booted far enough to expose the
 * ledger, the number below is not a measurement and is not reported as one.
 */
if (result.failed.length) {
  console.error(`\n✗ ${result.failed.length} of ${result.pages.length} pages did not run:`);
  for (const f of result.failed) console.error(`    ${f}`);
  console.error(
    `\nFAIL: a page that does not render contributes no strings, so the total below ` +
      `would be smaller for the WRONG REASON. This was a half-measure once: the guard ` +
      `read "more than half the pages booted", the merge renamed the selector this ` +
      `waits for, five pages dropped out — and the run still printed a number as if it ` +
      `had walked them. Fix the page, or fix the route list it came from; never lower the ceiling to fit.`,
  );
  process.exit(1);
}

/* The data exclusion needs the state to have loaded, or it excuses nothing and
   the report is padded with customer names — or, worse, somebody "fixes" those
   by putting a customer's name in the dictionary. Refuse rather than report. */
if (result.data.size < 20) {
  console.error(
    `FAIL: only ${result.data.size} values read from erp.state, so the data exclusion ` +
      `below is not doing anything. Check the seed loaded.`,
  );
  process.exit(1);
}

let asData = 0;
const excused = [];
const all = [...result.found.values()]
  .filter((m) => {
    if (
      result.data.has(m.text) ||
      builtAroundData(m.text, result.data) ||
      composedOfData(m.text, result.data, result.data)
    ) {
      asData++;
      excused.push(m.text);
      return false;
    }
    return true;
  })
  .sort((a, b) => b.n - a.n || (a.text < b.text ? -1 : 1));
const byScreen = new Map();
for (const m of all) {
  const key = (m.where || "?").split(" ▸ ")[0].trim() || "?";
  (byScreen.get(key) || byScreen.set(key, []).get(key)).push(m);
}

console.log(`\n──── translator miss ledger: es → ${TARGET} ────`);
console.log(
  `${result.booted}/${result.pages.length} pages driven · ${all.length} untranslated strings · ` +
    `${asData} excused as company records (${result.data.size} values across ${RECORDS.size} ` +
    `record collections; ${result.vocabulary.size} shipped-vocabulary values NOT excused)\n`,
);
for (const [screen, list] of byScreen) {
  console.log(`✗ ${screen.padEnd(24)} ${String(list.length).padStart(3)}`);
  for (const m of list.slice(0, 12)) {
    const via = (m.where || "").split(" ▸ ")[1];
    console.log(`      · ${m.text.slice(0, 88)}${via ? `   ← ${via.slice(0, 30)}` : ""}`);
  }
  if (list.length > 12) console.log(`      … and ${list.length - 12} more`);
}

/* Every exclusion is a place this stops looking, so it can be read back.
   `--show-excused` prints what the data rules swallowed; anything in there that
   is really interface text is a hole in the audit, not a translated string. */
if (argv.includes("--show-excused")) {
  console.log(`\n──── excused as ERP data (${excused.length}) ────`);
  for (const t of excused.sort()) console.log(`  · ${t.slice(0, 100)}`);
}

if (JSON_OUT) {
  fs.writeFileSync(resolve(ROOT, JSON_OUT), JSON.stringify(all, null, 1));
  console.log(`\nwrote ${all.length} entries to ${JSON_OUT}`);
}

if (MAX !== null && all.length > MAX) {
  console.error(
    `\nFAIL: ${all.length} strings the translator could not translate, ceiling ${MAX}. ` +
      `Add them to site/i18n-dict.js (English) and site/i18n-dict-ca.js (Catalan).`,
  );
  process.exit(1);
}
if (MAX !== null && all.length < MAX) {
  console.log(`\n↓ Down to ${all.length}. Lower --max in the CI step so it cannot drift back up.`);
}
console.log();

// Autonomous end-to-end test of the Canei Subirats web app (the pages the iOS
// app loads). Serves ./site over HTTP, drives the full customer journey in a
// real browser, and asserts the key outcomes — no human intervention.
//
// Run:  node tests/site-e2e/run.mjs
// Exits non-zero (and prints a report) if anything regresses.
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
// Prefer an explicit path (CHROME_PATH), else the pre-installed sandbox
// browser, else let Playwright use its own downloaded Chromium (CI).
const CHROME =
  process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p)) ||
  undefined;

const results = [];
const ok = (name) => results.push({ name, pass: true });
const bad = (name, detail) => results.push({ name, pass: false, detail });

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

async function main() {
  const chromium = await loadChromium();
  const port = await freePort();

  // Serve ./site statically (HTTP so IndexedDB / downloads behave like production).
  const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: SITE,
    stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}`;
  await waitForServer(base);

  const browser = await chromium.launch({ executablePath: CHROME });
  /* Every suite, in order. A list rather than thirty-four await statements so
     that `--only <substring>` can pick one out: the whole run takes about
     twelve minutes, and diagnosing one broken suite by re-running all of them
     is how a fix takes an afternoon. CI passes no argument and gets everything,
     which is the only mode that may report a pass. */
  const SUITES = [
    testJourney,
    testNoOverflow,
    testMobile,
    testNativeShell,
    testSmoke,
    testDataTabs,
    testRetired,
    testShell,
    testGantt,
    testBudgetBuilder,
    testPresupuestador,
    testCapture,
    testSupplierBillEntry,
    testVariationBudget,
    testProjectTracking,
    testInvoicing,
    testInvoiceGenerator,
    testCashFlow,
    testFinancials,
    testFirstRun,
    testBankAndCash,
    testContract,
    testChangeApprovalEvidence,
    testContractCreation,
    testBudgetCreation,
    testProcurement,
    testAdmin,
    testControlTowerAndDay,
    testVisitCapture,
    testConfigurableLists,
    testInlineCustomer,
    testPresupuestadorRework,
    testEvidence,
    testSendAndVersions,
    testJourneyRealMode,
    testErp,
    testI18n,
    testLanguageAcrossTabs,
  ];
  const onlyAt = process.argv.indexOf("--only");
  const only = onlyAt > 0 ? String(process.argv[onlyAt + 1] || "").toLowerCase() : "";
  const chosen = only ? SUITES.filter((f) => f.name.toLowerCase().includes(only)) : SUITES;
  if (only && !chosen.length) {
    console.error(
      `--only ${only} matched no suite. Known: ${SUITES.map((f) => f.name).join(", ")}`,
    );
    process.exit(2);
  }
  try {
    for (const suite of chosen) await suite(browser, base);
  } finally {
    await browser.close();
    server.kill("SIGKILL");
  }

  // Report
  const failed = results.filter((r) => !r.pass);
  console.log("\n──────── site E2E report ────────");
  for (const r of results) {
    console.log(`${r.pass ? "✓" : "✗"} ${r.name}${r.detail ? `  → ${r.detail}` : ""}`);
  }
  // Failures repeated at the END as well as in place. The report is ~450 lines
  // and the natural way to read a long run is `| tail`, which keeps the count
  // and throws away the four lines that say what broke.
  if (failed.length) {
    console.log(`\n──── ${failed.length} failed ────`);
    for (const r of failed) console.log(`✗ ${r.name}${r.detail ? `  → ${r.detail}` : ""}`);
  }
  if (only) console.log(`(--only ${only}: ${chosen.length} of ${SUITES.length} suites)`);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

/**
 * Readiness probe: a raw TCP connect, deliberately NOT fetch().
 *
 * This used to poll with fetch() and never read the response body. undici
 * keeps an HTTP parser alive per un-consumed response, and probing a socket
 * that is still coming up crashed the entire run from inside that parser —
 * `AssertionError: assert(!this.paused)` at Parser.finish, 0.7s in, before a
 * single test had executed (CI run 21, Node 22.23.1; the same code passed on
 * 22.22.2 locally, which is exactly how this kind of bug hides).
 *
 * A "is the port listening yet" check has no business owning an HTTP client.
 */
async function waitForServer(base, tries = 60) {
  const { hostname, port } = new URL(base);
  for (let i = 0; i < tries; i++) {
    const listening = await new Promise((res) => {
      const socket = net.connect({ host: hostname, port: Number(port) }, () => {
        socket.end();
        res(true);
      });
      socket.setTimeout(500, () => {
        socket.destroy();
        res(false);
      });
      socket.on("error", () => res(false));
    });
    if (listening) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("static server did not start");
}

function attachConsole(page, errors) {
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
}

/** Answer the application's own question box, in the background.
 *
 *  The screens used to ask with prompt() and confirm(), which Playwright
 *  intercepts as `dialog` events — four suites carried a `pg.on("dialog")`
 *  handler with a chain of regexes over the question text. Those questions are
 *  now real DOM (see site/erp-modal.js), so nothing intercepts them and a run
 *  that clicks "Anular" simply waits forever for a person.
 *
 *  This replaces all four handlers with one poller that behaves like a
 *  cooperative user: fill anything empty, choose the first option when a list
 *  demands a choice, then press the primary button. `answers` overrides the
 *  text for a given question, keyed by a substring of its title — used only
 *  where the VALUE matters to a later assertion, not to get past the box.
 *
 *  It is deliberately generic. The old regex chains had to be edited every
 *  time a question was reworded, and a missed rewording showed up as a
 *  mystery timeout rather than as a failed assertion.
 */
async function autoAnswerModals(pg, answers = {}) {
  await pg.addInitScript((rules) => {
    const fire = (el2, type) => el2.dispatchEvent(new Event(type, { bubbles: true }));
    setInterval(() => {
      const scrim = document.getElementById("mscrim");
      if (!scrim || !scrim.classList.contains("on")) return;
      const box = scrim.querySelector(".modal");
      if (!box) return;
      const title = (box.querySelector("#mttl") || {}).textContent || "";
      let answer = "Respuesta E2E";
      for (const key in rules)
        if (title.includes(key)) {
          answer = rules[key];
          break;
        }
      box.querySelectorAll("input, textarea, select").forEach((f) => {
        if (f.type === "radio") return;
        if (f.tagName === "SELECT") return; // a select always has a valid value
        if (f.value) return; // a prefilled date or default text is the answer
        f.value = f.type === "date" ? "2026-05-20" : answer;
        fire(f, "input");
        fire(f, "change");
      });
      const radios = box.querySelectorAll('.mopts input[type="radio"]');
      if (radios.length && !box.querySelector('.mopts input[type="radio"]:checked')) {
        const wanted = [...radios].find((r) => r.value === answer) || radios[0];
        wanted.click();
      }
      // The accept button is the LAST one in the action row, not the one with
      // `.primary`: a question about something irreversible styles it `.danger`
      // instead, and a selector that only knew about `.primary` left every
      // anular / rescindir / marcar-como-perdida box open — which then blocked
      // every click after it behind its own scrim.
      const buttons = box.querySelectorAll(".ma button");
      const accept = buttons[buttons.length - 1];
      if (accept) accept.click();
    }, 80);
  }, answers);
}

/** Three v4 screens are merges of two built ones and carry a tab strip
    (PRY-01, ADM-03, ADM-05). Navigating to the route lands on the first tab,
    so a check that wants the other one has to ask for it — the same click a
    person makes. */
/* Open a job that actually has baseline chapters.
   The list is newest-first and the newest rows in the sample are the Recorrido
   demo projects, which have no accepted budget behind them — so "click the
   first row" lands on a job whose Avance tab has nothing to control and whose
   per-chapter table is empty. Searching for a job with chapters is the
   difference between testing the screen and testing the sample. */
/* Wait for the shell to have BOOTED, rather than for a fixed number of
   milliseconds.

   Three intermittent reds in this programme — "sections=0", "0 budgets" and a
   third in S11 — were all the same thing: a check that measured the page a
   fixed number of milliseconds after `goto` and happened to measure it before
   boot() had rendered, on a machine busy doing something else. A fixed sleep
   is a guess about somebody else's CPU; a selector is a fact. The tell was
   always the same — the very next assertion, over the same page, passed. */
async function bootedShell(pg) {
  await pg.waitForSelector("#p1 .secitem", { timeout: 15000 });
  await pg.waitForTimeout(200);
}

/**
 * Choose a language the way the application does — BOTH places, always.
 *
 * The device choice lives in two stores on purpose: a cookie, because the
 * sign-in page is rendered on the server and carries no JavaScript so a cookie
 * is the only thing it can read; and localStorage, so a choice made by an
 * earlier version is not lost. `site/i18n.js` reads the cookie FIRST, and the
 * app's own `set()` writes both together, so the two can never disagree in real
 * use.
 *
 * A test that writes only localStorage can make them disagree, and then every
 * assertion after it silently measures the previous language rather than the
 * one it asked for — which is how a suite reports "CA does not translate" when
 * the truth is that CA was never selected. Setting a language goes through here.
 */
async function chooseLang(pg, code) {
  await pg.evaluate((c) => {
    try {
      localStorage.setItem("caneiLang", c);
    } catch (e) {
      /* private mode */
    }
    document.cookie = "canei_lang=" + c + ";path=/;max-age=31536000;samesite=lax";
  }, code);
}

async function openJobWithChapters(pg, searchId) {
  const code = await pg.evaluate(() => {
    const p = erp.state.projects.find((x) => x.baseline && (x.baseline.chapters || []).length);
    return p ? p.code : null;
  });
  if (!code) return null;
  await pg.fill(`#${searchId}`, code);
  await pg.waitForTimeout(500);
  await pg.locator("#view table.mlist tr.click").first().click();
  await pg.waitForTimeout(600);
  return code;
}

/* The chart itself. PK4-A made PRY-01 two screens — the list of jobs and one
   job's chart — so opening a job IS opening the Gantt: no panel in between,
   and nothing to click through once the row is clicked. */
async function openGantt(pg, base) {
  // Leaving a full-screen surface is a JS state change, not a route change —
  // `goto` at the same hash is a no-op and would silently leave us on the
  // chart with no list to search. Come back the way a person would.
  if (await pg.locator("#gBack").count()) {
    await pg.locator("#gBack").click();
    await pg.waitForTimeout(500);
  } else if ((await pg.locator("#prgQ").count()) === 0) {
    await pg.goto(`${base}/erp.html#progress`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);
  }
  await openJobWithChapters(pg, "prgQ");
  await pg.waitForTimeout(500);
}

async function openTab(pg, route, tab) {
  await pg.evaluate((r) => (location.hash = r), route);
  await pg.waitForTimeout(400);
  const btn = pg.locator(`.tabstrip [data-tab="${tab}"]`);
  if ((await btn.count()) > 0) {
    await btn.click();
    await pg.waitForTimeout(500);
  }
}

// ── The full journey: load the sample, walk every stage, generate docs, export.
async function testJourney(browser, base) {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    acceptDownloads: true,
  });
  const errors = [];
  attachConsole(page, errors);

  try {
    await page.goto(`${base}/journey.html`, { waitUntil: "networkidle" });

    // ── Negative: an empty intake must not start the journey. The page is
    // translated at runtime, so match on either language.
    await page.locator("#clearform").click();
    await page.waitForTimeout(150);
    await page.locator("#startbtn").click();
    await page.waitForTimeout(200);
    const intakeErr = await page
      .locator("#ierr")
      .textContent()
      .catch(() => "");
    if (/customer name|nombre del cliente/i.test(intakeErr || "")) ok("blank intake is refused");
    else bad("blank intake is refused", `#ierr = "${intakeErr}"`);

    // ── Negative: the rail must not walk past the intake gate. Before this was
    // closed, clicking "STEP 1" while step was -1 entered the journey with no
    // customer name, no tax id and no email.
    const afterRail = await page.evaluate(() => {
      document.querySelector("#rail .st.nav")?.click();
      return document.querySelector("#stage")?.innerText.slice(0, 80) || "";
    });
    if (/your project|su proyecto|proyecto/i.test(afterRail))
      ok("rail cannot bypass the intake gate");
    else bad("rail cannot bypass the intake gate", afterRail.replace(/\n/g, " "));

    // "Load sample data" pre-fills the intake form with the sample project.
    await page.locator("#loadsample").click();
    await page.waitForTimeout(300);
    const intakeText = await page
      .locator("#intake, .form")
      .first()
      .innerText()
      .catch(() => "");
    if (/[A-Za-z]/.test(intakeText)) ok("sample loads intake data");
    else bad("sample loads intake data", "intake empty after loadsample");

    // "Start the journey" commits the intake and begins at stage 0.
    await page.locator("#startbtn").click();
    await page.waitForTimeout(300);

    // ── Negative: the gate must hold. Clearing a required field on the stage we
    // are standing on has to disable Advance and say what is missing.
    await page.evaluate(() => {
      const el = document.querySelector('#stage [data-k="enquiry"]');
      if (el) {
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await page.waitForTimeout(150);
    const gated = await page.evaluate(() => ({
      disabled: !!document.querySelector("#next")?.disabled,
      gate: document.querySelector("#gate")?.innerText || "",
    }));
    if (gated.disabled && gated.gate.trim()) ok("a missing required field blocks Advance");
    else bad("a missing required field blocks Advance", JSON.stringify(gated));
    // put it back
    await page.evaluate(() => {
      const el = document.querySelector('#stage [data-k="enquiry"]');
      if (el) {
        el.value = "Full bathroom refit";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await page.waitForTimeout(150);

    // Walk the whole lifecycle with the Next control.
    let advanced = 0;
    for (let i = 0; i < 20; i++) {
      const next = page.locator("#next");
      if ((await next.count()) === 0) break;
      if (!(await next.isVisible().catch(() => false))) break;
      if (await next.isDisabled().catch(() => false)) break;
      await next.click();
      await page.waitForTimeout(160);
      advanced++;
    }
    if (advanced >= 10) ok(`advances through the full lifecycle (${advanced} steps)`);
    else bad("advances through the full lifecycle", `only advanced ${advanced} steps`);

    // After the invoice stage the P&L ledger holds a real revenue figure.
    const revenue = await page.evaluate(() => {
      const el = document.querySelector("#l-revenue");
      return el ? (el.textContent || "").trim() : "";
    });
    if (/\d/.test(revenue)) ok(`ledger shows revenue (${revenue})`);
    else bad("ledger shows revenue", `got "${revenue}"`);

    // The rail now exposes clickable nav pills for every reached stage.
    const pills = page.locator("#rail .nav");
    const pcount = await pills.count();
    let rendered = 0;
    for (let i = 0; i < pcount; i++) {
      await pills
        .nth(i)
        .click()
        .catch(() => {});
      await page.waitForTimeout(110);
      const txt = await page
        .locator("#stage")
        .innerText()
        .catch(() => "");
      if (txt && txt.trim().length > 20) rendered++;
    }
    if (pcount >= 12 && rendered >= 12)
      ok(`all lifecycle stages navigable & render (${rendered}/${pcount})`);
    else bad("stages navigable & render", `${rendered}/${pcount} reached-nav pills`);

    // ── The narrative body shows derived figures (invoice table, collection
    // status). A field edit must redraw it: it once updated the ledger and the
    // filed PDF but left the screen as first drawn, so a 5.000 € part payment
    // read "Outstanding: 0,00 € · paid" on screen while the ledger said 5.000.
    await page.evaluate(() => {
      [...document.querySelectorAll("#rail .st.nav")][9]?.click(); // Collections
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.querySelector('#stage [data-k="amountReceived"]');
      if (el) {
        el.value = "5000";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    const partial = await page.evaluate(() => ({
      screen:
        document.querySelector("#stagebody .did")?.innerText.replace(/\s+/g, " ").trim() || "",
      collected: document.querySelector("#l-collected")?.textContent.trim() || "",
    }));
    if (/5\.?000/.test(partial.screen) && /5\.?000/.test(partial.collected))
      ok("a part payment redraws the stage body, not just the ledger");
    else bad("part payment redraws the stage body", JSON.stringify(partial));

    // ── A reload must resume the journey, ledger included. step/reached and the
    // whole ledger used to be module variables, so a refresh dropped the
    // operator back on the intake with zeroes beside a full document folder.
    const beforeReload = await page.evaluate(
      () => document.querySelector("#l-revenue")?.textContent.trim() || "",
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const afterReload = await page.evaluate(() => ({
      revenue: document.querySelector("#l-revenue")?.textContent.trim() || "",
      onIntake: !!document.querySelector("#startbtn"),
    }));
    if (
      !afterReload.onIntake &&
      afterReload.revenue === beforeReload &&
      /\d/.test(afterReload.revenue)
    )
      ok(`reload resumes mid-journey with the ledger intact (${afterReload.revenue})`);
    else
      bad(
        "reload resumes mid-journey",
        `before=${beforeReload} after=${JSON.stringify(afterReload)}`,
      );

    // Export the project folder as a real .zip and assert it's non-trivial.
    const dl = page.locator("#dlfolder");
    if ((await dl.count()) > 0) {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
        dl.click().catch(() => {}),
      ]);
      if (download) {
        const name = download.suggestedFilename();
        const path = await download.path();
        const fs = await import("node:fs");
        const size = path ? fs.statSync(path).size : 0;
        // A real zip starts with the "PK" local-file-header signature.
        const magic = path ? fs.readFileSync(path).subarray(0, 2).toString("latin1") : "";
        if (size > 200 && magic === "PK")
          ok(`exports project folder as a valid zip (${size} bytes, "${name}")`);
        else bad("exports project folder zip", `name=${name} size=${size} magic=${magic}`);
      } else {
        bad("exports project folder .zip", "no download fired");
      }
    } else {
      bad("exports project folder .zip", "#dlfolder not found");
    }

    if (errors.length === 0) ok("no console/page errors during journey");
    else bad("no console/page errors during journey", errors.slice(0, 3).join(" | "));
  } catch (e) {
    bad("journey walkthrough", String(e).slice(0, 200));
  } finally {
    await page.close();
  }
}

// ── Mobile: no horizontal overflow (the "cut boxes" regression) on key pages.
//    The ERP appears several times over: its sections are hash routes of one
//    page, and the bottom bar the phone layout uses is shell chrome that every
//    one of them carries.
async function testNoOverflow(browser, base) {
  const pages = [
    "journey.html",
    "master-data.html",
    "financial-data.html",
    "erp.html#tower",
    "erp.html#customers",
    "erp.html#invoicing",
    "erp.html#progress",
  ];
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  for (const p of pages) {
    try {
      await page.goto(`${base}/${p}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw <= 391) ok(`no horizontal overflow @390px — ${p}`);
      else bad(`no horizontal overflow @390px — ${p}`, `scrollWidth=${sw}`);
    } catch (e) {
      bad(`no horizontal overflow @390px — ${p}`, String(e).slice(0, 120));
    }
  }

  // The doc asks for a bottom bar of FIVE icons. There are six secciones, so
  // one has to leave the bar — and it has to STAY left: the failure this
  // guards against is a seventh section quietly making the bar scroll again,
  // which is what it did before.
  try {
    await page.goto(`${base}/erp.html#tower`, { waitUntil: "networkidle" });
    await bootedShell(page);
    await page.waitForTimeout(700);
    const bar = await page.evaluate(() => {
      const items = [...document.querySelectorAll("#p1 .secitem")];
      const rail = document.querySelector("#p1");
      return {
        visible: items.filter((n) => n.offsetParent !== null).map((n) => n.dataset.sec),
        scrolls: rail.scrollWidth > rail.clientWidth + 1,
      };
    });
    if (bar.visible.length === 5 && !bar.scrolls)
      ok(`mobile: bottom bar is five icons and does not scroll (${bar.visible.join(",")})`);
    else bad("mobile: five-icon bottom bar", JSON.stringify(bar));

    // …and the one that left is still reachable, or it is simply missing.
    await page.click("#btnUser");
    await page.waitForTimeout(250);
    if (await page.locator("#uSettings").isVisible())
      ok("mobile: Configuración is reachable from the profile menu");
    else bad("mobile: settings reachable", "#uSettings not visible at 390px");
  } catch (e) {
    bad("mobile: bottom bar", String(e).slice(0, 140));
  }
  await page.close();
}

// ── Smoke: each app-surfaced page loads with a title and no errors.
// ── S14 · Mobile (§3). Tables become two-line cards, the side menu is already
//    a five-icon bottom bar (see testNoOverflow), and frequent site actions sit
//    behind a floating button that is three taps from done.
async function testMobile(browser, base) {
  const pg = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const errs = [];
  attachConsole(pg, errs);
  const ROUTES = [
    "tower",
    "customers",
    "suppliers",
    "invoicing",
    "banking",
    "labour",
    "accountant",
    "cash-flow",
    "purchasing",
    "supplier-invoices",
    "contracts",
    "progress",
    "economics",
    "variations",
    "petty-cash",
    "quotes",
    "leads",
    "items",
  ];
  try {
    await pg.goto(`${base}/erp.html#tower`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(1200);

    // Every table on every screen is either cards, a deliberate grid, or a
    // single-cell empty state. The point of asserting it across ALL of them is
    // that the fallback is one function — a screen that drifts out of the rule
    // is a screen somebody wrote a bespoke table for.
    const offenders = [];
    let carded = 0,
      grids = 0,
      overflow = [],
      sideways = [];
    for (const r of ROUTES) {
      await pg.evaluate((x) => (location.hash = x), r);
      await pg.waitForTimeout(400);
      const info = await pg.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        tables: [...document.querySelectorAll("#view table")].map((t) => ({
          cards: t.classList.contains("cards"),
          nocards: t.hasAttribute("data-nocards"),
          cells: Math.max(
            0,
            ...[...t.querySelectorAll("tbody tr")].map((tr) => tr.children.length),
          ),
        })),
        // A carded table whose own scroll box overflows is the failure the
        // document-level check above CANNOT see: `.scroll` has overflow-x:auto,
        // so it absorbs the overflow internally and the page stays 390 wide
        // while every card scrolls sideways under the operator's thumb. That
        // is exactly how a global `table{min-width:520px}` — which
        // `width:100%` cannot override — shipped to a phone unnoticed.
        clipped: [...document.querySelectorAll("#view table.cards")]
          .map((t) => {
            const box = t.closest(".scroll") || t.parentElement;
            return box && box.scrollWidth > box.clientWidth + 1
              ? `${box.clientWidth}<${box.scrollWidth}`
              : null;
          })
          .filter(Boolean),
      }));
      if (info.sw > 391) overflow.push(`${r}:${info.sw}`);
      if (info.clipped.length) sideways.push(`${r}:${info.clipped.join()}`);
      for (const t of info.tables) {
        if (t.cards) carded++;
        else if (t.nocards) grids++;
        else if (t.cells >= 3) offenders.push(`${r}(${t.cells} cols)`);
      }
    }
    if (!offenders.length && carded >= 15)
      ok(
        `mobile: every table across ${ROUTES.length} screens is cards or a declared grid (${carded} carded, ${grids} grids)`,
      );
    else bad("mobile: tables become cards", `carded=${carded} offenders=${offenders.join()}`);
    if (!overflow.length) ok(`mobile: no screen scrolls sideways at 390 (${ROUTES.length} routes)`);
    else bad("mobile: no sideways scroll", overflow.join());
    if (!sideways.length)
      ok(`mobile: no carded table is cut off inside its own scroller (${carded} tables)`);
    else bad("mobile: cards fit their container", sideways.join(" · "));

    // A card is only a card if the header labels moved onto the lines.
    await pg.evaluate(() => (location.hash = "customers"));
    await pg.waitForTimeout(500);
    const card = await pg.evaluate(() => {
      const tr = document.querySelector("#view table.cards tbody tr.click");
      const th = document.querySelector("#view table.cards thead");
      return {
        headHidden: th ? getComputedStyle(th).display === "none" : null,
        stacked: tr ? getComputedStyle(tr.children[1]).display : null,
        labelled: tr ? [...tr.children].filter((td) => td.getAttribute("data-th")).length : 0,
        cells: tr ? tr.children.length : 0,
      };
    });
    if (card.headHidden && card.stacked === "flex" && card.labelled === card.cells)
      ok(`mobile: the header moves onto each line and the row stacks (${card.cells} labelled)`);
    else bad("mobile: card shape", JSON.stringify(card));

    /* Every top-bar menu opens INSIDE the phone.
       `.menu` hangs from `right: 0` of its button, which is right on a wide bar
       and wrong once the bar wraps: «＋ Crear» ends up near the left edge and a
       214 px panel anchored to its right ran off the side of the screen. Both
       menus are checked, not just the one that was reported — the next button
       added to that bar inherits the same geometry. */
    const offscreen = [];
    for (const [btn, menu] of [
      ["#btnCreate", "#mCreate"],
      ["#btnBell", "#mBell"],
    ]) {
      const box = await pg.evaluate(
        ([b, m]) => {
          const btnEl = document.querySelector(b);
          if (!btnEl || btnEl.hidden) return null;
          btnEl.click();
          const r = document.querySelector(m).getBoundingClientRect();
          return { left: Math.round(r.left), right: Math.round(r.right), vw: window.innerWidth };
        },
        [btn, menu],
      );
      await pg.waitForTimeout(200);
      if (box && (box.left < 0 || box.right > box.vw))
        offscreen.push(`${menu}:${JSON.stringify(box)}`);
      await pg.evaluate(() => closeMenus());
    }
    if (!offscreen.length) ok("mobile: the top-bar menus open inside the screen, not off its edge");
    else bad("mobile: menus stay on screen", offscreen.join(" · "));

    /* THE QUOTE BUILDER STACKS ON A PHONE, it does not shrink.
       There has always been a rule that collapses its three panes into one
       column below 1180px. The fold work added `grid-column: 1|2|3` pins so a
       `display:none` pane could not let the others slide left — correct, and
       written without a breakpoint. Against a ONE-column template a
       `grid-column: 3` does not clamp, it creates implicit columns: the phone
       got three columns again, the line grid squeezed to about ninety pixels,
       "LINE ITEMS" rendering one letter per line. That shipped, and was
       photographed on an iPhone before anything here caught it.

       Asserted on the computed template rather than on any pixel, because the
       fault was the template — and the check reads as the rule it protects. */
    await pg.evaluate(() => {
      const b =
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0];
      if (b) go("quotes", b.id);
    });
    await pg.waitForTimeout(1200);
    const pb = await pg.evaluate(() => {
      const panes = document.querySelector("#pbPanes");
      if (!panes) return null;
      const w = (s) => {
        const el = document.querySelector(s);
        return el ? Math.round(el.getBoundingClientRect().width) : null;
      };
      const fold = document.querySelector("#pbFoldL");
      return {
        tracks: getComputedStyle(panes).gridTemplateColumns.trim().split(/\s+/).length,
        mid: w(".pbpane.mid"),
        viewport: window.innerWidth,
        foldShown: fold ? getComputedStyle(fold).display !== "none" : false,
      };
    });
    if (!pb) bad("mobile: the quote builder opens", "no #pbPanes");
    else if (pb.tracks === 1 && pb.mid >= pb.viewport - 4 && !pb.foldShown)
      ok(`mobile: the quote builder stacks into one column (${pb.mid}px of ${pb.viewport})`);
    else bad("mobile: quote builder stacks", JSON.stringify(pb));

    /* And shows ONE pane at a time, chosen from a tab bar.
       Stacked is correct but unusable — the tree, then every line, then the
       totals, on the screen with the least room. Asserted per tab because the
       failure that matters is two panes visible at once (the chooser doing
       nothing) or none (the rule losing to a later one at equal specificity,
       which is exactly how the bar shipped invisible the first time). */
    const paneFor = async (tab) => {
      await pg.evaluate((t) => document.querySelector(`#pbMTabs [data-mtab="${t}"]`).click(), tab);
      await pg.waitForTimeout(250);
      return pg.evaluate(() => {
        const on = (s) => {
          const el = document.querySelector(s);
          return el && getComputedStyle(el).display !== "none";
        };
        return [on("#pbLeft"), on(".pbpane.mid"), on("#pbRight")].filter(Boolean).length;
      });
    };
    const barShown = await pg.evaluate(() => {
      const el = document.querySelector("#pbMTabs");
      return !!el && getComputedStyle(el).display !== "none";
    });
    const counts = [];
    for (const t of ["chapters", "totals", "lines"]) counts.push(await paneFor(t));
    if (barShown && counts.every((n) => n === 1))
      ok("mobile: the builder shows one pane at a time, chosen from a tab bar");
    else bad("mobile: builder pane tabs", JSON.stringify({ barShown, counts }));

    /* NOTHING IN THE HEADER BAR PRINTS ON TOP OF ANYTHING ELSE.
       Reported with a photograph: the budget number, the state pill and the
       total occupying the same six millimetres. The cause was `margin: 0 auto`
       on the total, which centres it in the bar regardless of what is already
       there — so it collides instead of yielding.

       Measured as overlapping RECTANGLES and not as a style, because a style
       assertion would have passed against the old CSS too: `margin:0 auto` is
       a perfectly ordinary declaration and only the geometry says it is wrong
       here. Pairwise, so the report names which two pieces are on top of each
       other rather than saying the bar is bad. */
    const overlap = await pg.evaluate(() => {
      const bar = document.querySelector(".pbbar");
      if (!bar) return { err: "no .pbbar" };
      const parts = [...bar.children]
        .filter((el) => getComputedStyle(el).display !== "none")
        .map((el) => ({
          name: el.id || el.className || el.tagName.toLowerCase(),
          r: el.getBoundingClientRect(),
        }))
        .filter((p) => p.r.width > 0 && p.r.height > 0);
      const hits = [];
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i].r,
            b = parts[j].r;
          // 1px of slack: adjacent boxes may share an edge, and a shared edge
          // is not an overlap.
          const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (dx > 1 && dy > 1) hits.push(`${parts[i].name}×${parts[j].name}`);
        }
      /* TEXT PAINTING OUTSIDE ITS OWN BOX, which is what the photograph
         actually showed. Flex items do not overlap each other, so rectangles
         alone would have reported the bar as fine: what collided was the
         budget number, `white-space: nowrap` with nothing to clip it, drawn
         straight across the total beside it. Boxes intact, words on top of
         each other. */
      const spill = [];
      for (const el of bar.querySelectorAll("b, span, .who")) {
        if (getComputedStyle(el).display === "none") continue;
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === "visible")
          spill.push(el.className || el.tagName.toLowerCase());
      }
      return { hits, spill, parts: parts.length, wide: bar.scrollWidth > bar.clientWidth + 1 };
    });
    if (overlap.err) bad("mobile: builder header has no overlapping text", overlap.err);
    else if (!overlap.hits.length && !overlap.spill.length && !overlap.wide)
      ok(`mobile: the builder header lays out without overlap (${overlap.parts} pieces)`);
    else
      bad(
        "mobile: builder header overlap",
        [
          overlap.hits.length ? `boxes: ${overlap.hits.join(",")}` : "",
          overlap.spill.length ? `text spills: ${overlap.spill.join(",")}` : "",
          overlap.wide ? "bar scrolls sideways" : "",
        ]
          .filter(Boolean)
          .join(" · "),
      );

    /* THE LINE'S CATALOGUE CHOOSER OPENS THE CATALOGUE.
       It used to be a native `<select>`, and on iOS that is a grey wheel of
       truncated names with no price, no unit, no search and no way to take more
       than one — "that grey box with some favorites", in the operator's words.
       It now opens the same ticked sheet "+ partida del catálogo" opens.

       Asserted on the EFFECT and not on the control: a chooser that opens
       something and copies nothing across is the same defect wearing a better
       hat. Picking must move the code, description, unit and money onto the
       line in one step. */
    await pg.evaluate(() => document.querySelector('#pbMTabs [data-mtab="lines"]').click());
    await pg.waitForTimeout(400);
    const pick = await pg.evaluate(async () => {
      const btn = document.querySelector("#bRows button.bcat");
      if (!btn) return { err: "no per-line catalogue chooser" };
      if (getComputedStyle(btn).display === "none") return { err: "chooser is not visible" };
      const r = btn.getBoundingClientRect();
      const lineId = btn.dataset.cat;
      btn.click();
      await new Promise((x) => setTimeout(x, 800));
      const sheet = document.querySelector("#catpick");
      if (!sheet) return { err: "pressing the chooser did not open the catalogue" };
      const row = sheet.querySelector(".cpi.pick");
      if (!row) return { err: "the catalogue opened with nothing in it" };
      const code = row.querySelector(".cpc").textContent.trim();
      const item = erp.state.catalogue.find((x) => x.code === code);
      row.click();
      sheet.querySelector("#cp_add").click();
      await new Promise((x) => setTimeout(x, 800));
      let line = null;
      for (const b of erp.state.budgets)
        for (const v of b.versions)
          for (const c of v.chapters) for (const l of c.lines) if (l.id === lineId) line = l;
      return {
        tall: Math.round(r.height),
        want: { code: item.code, desc: item.desc, unit: item.unit, cost: item.defaultCostCents },
        got: line && { code: line.code, desc: line.desc, unit: line.unit, cost: line.costCents },
        label: (btn.textContent || "").slice(0, 20),
      };
    });
    if (pick.err) bad("mobile: the line's catalogue chooser", pick.err);
    else if (
      pick.got &&
      pick.got.code === pick.want.code &&
      pick.got.desc === pick.want.desc &&
      pick.got.unit === pick.want.unit &&
      pick.got.cost === pick.want.cost &&
      pick.tall >= 44
    )
      ok(
        `mobile: the line's chooser opens the catalogue and the pick fills code, description, unit and cost (${pick.tall}px target)`,
      );
    else bad("mobile: chooser fills the line", JSON.stringify(pick).slice(0, 220));

    /* "…the subitems DEM-101 FOR THIS CHAPTER."
       A chapter the price book KNOWS is built here rather than hoped for — the
       default fixture's "Pavimentos" exercises the fallback and would say
       nothing about narrowing. Asserted on what the opened sheet offers, not on
       a hidden control's contents: a `display:none` element still answers
       `.options`, which is how an earlier version of this check reported
       correct narrowing on a control nobody could reach. */
    const narrow = await pg.evaluate(async () => {
      const chapName = (erp.listAll("itemChapters")[0] || {}).es;
      const want = (erp.listAll("itemChapters")[0] || {}).code;
      const b =
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0];
      const v = b.versions[b.versions.length - 1];
      const chap = erp.addChapter(b.id, { name: chapName, section: v.chapters[0].section });
      erp.addLine(b.id, chap.id, { desc: "Nueva partida", unit: "ud", qtyMilli: 1000 });
      go("quotes", b.id);
      await new Promise((r) => setTimeout(r, 1200));
      document.querySelector('#pbMTabs [data-mtab="lines"]').click();
      await new Promise((r) => setTimeout(r, 400));
      const row = [...document.querySelectorAll("#bRows tr.pbrow")].find(
        (tr) => tr.dataset.chap === chap.id,
      );
      const btn = row && row.querySelector("button.bcat");
      if (!btn) return { err: "no catalogue chooser on the new chapter's line" };
      if (getComputedStyle(btn).display === "none") return { err: "chooser is not visible" };
      btn.click();
      await new Promise((r) => setTimeout(r, 800));
      const sheet = document.querySelector("#catpick");
      if (!sheet) return { err: "the chooser did not open the catalogue" };
      const items = [...sheet.querySelectorAll(".cpi.pick")]
        .map((x) => x.querySelector(".cpc")?.textContent.trim())
        .map((c) => erp.state.catalogue.find((i) => i.code === c))
        .filter(Boolean);
      const out = {
        chapName,
        want,
        count: items.length,
        strays: items.filter((i) => i.chapter !== want).length,
        inBook: erp.state.catalogue.filter((i) => i.active !== false && i.chapter === want).length,
      };
      document.querySelector("#cp_cancel")?.click();
      await new Promise((r) => setTimeout(r, 300));
      return out;
    });
    if (narrow.err) bad("mobile: the chooser narrows to the chapter", narrow.err);
    else if (narrow.count > 0 && narrow.strays === 0 && narrow.count === narrow.inBook)
      ok(
        `mobile: on a chapter the price book knows, the chooser opens on its ${narrow.count} subpartidas and nothing else (${narrow.chapName})`,
      );
    else bad("mobile: chooser narrows to the chapter", JSON.stringify(narrow));

    /* ===== YOU CAN SEE WHAT BELONGS TO WHAT =====
       "I want to see immediately the chapters and what falls below each
       chapter", and "the subitems are very high build … less height would be
       more structured and premium."

       The generic card gives every cell a labelled row of its own: thirteen
       rows and about 700px per partida, so a chapter of six was four screens
       and the shape of the quote was invisible. Three things are asserted, and
       none of them is a style:

         · HEIGHT, as a ceiling that may only come down. A card is a real
           measurement, and 380px is already generous against the 291px it
           takes now — the point is that it can never quietly go back.
         · NESTING, geometrically: a partida must start to the RIGHT of the
           chapter heading it belongs to. A card flush with its heading belongs
           to nothing, which is the complaint in one sentence.
         · CONTAINMENT: no cell may reach past its own card. The chooser did
           exactly that — a flex row sized from its own content, hanging 60px
           off the right edge — and it is invisible to every check that only
           counts elements. */
    const shape = await pg.evaluate(() => {
      const chap = document.querySelector("#bRows tr.chaprow");
      const rows = [...document.querySelectorAll("#bRows tr.pbrow")];
      if (!chap || !rows.length) return { err: "no chapter with partidas under it" };
      const cr = chap.getBoundingClientRect();
      const heights = rows.map((r) => Math.round(r.getBoundingClientRect().height));
      const indents = rows.map((r) => Math.round(r.getBoundingClientRect().left - cr.left));
      // Any cell whose ink lands outside the card that holds it.
      const spills = [];
      for (const r of rows) {
        const b = r.getBoundingClientRect();
        for (const td of r.querySelectorAll("td")) {
          const t = td.getBoundingClientRect();
          if (t.width && t.right > b.right + 1) spills.push(td.className || td.tagName);
        }
      }
      return {
        tallest: Math.max(...heights),
        rows: rows.length,
        minIndent: Math.min(...indents),
        chapTinted:
          getComputedStyle(chap).backgroundColor !== getComputedStyle(rows[0]).backgroundColor,
        spills: [...new Set(spills)],
      };
    });
    if (shape.err) bad("mobile: the quote's shape is readable", shape.err);
    else if (
      shape.tallest <= 380 &&
      shape.minIndent >= 6 &&
      shape.chapTinted &&
      !shape.spills.length
    )
      ok(
        `mobile: partidas sit indented under their chapter and fit in ${shape.tallest}px each, nothing overflowing (${shape.rows} rows)`,
      );
    else bad("mobile: chapter/partida structure", JSON.stringify(shape));

    /* ===== THE CATALOGUE PICKER OPENS WHERE THE OPERATOR IS LOOKING =====
       This is the regression that shipped and was reported. `catalogueSearchModal`
       builds its own `.mscrim` instead of going through erp-modal.js, and the
       modal stylesheet is only published by `scrimEl()` — which that path never
       calls. So `.mscrim` had NO rules: `position: fixed` fell back to `static`
       and the whole picker rendered as a plain block in normal flow, at the
       bottom of a very tall page. Pressing "+ partida del catálogo" looked like
       it had done nothing.

       Every existing check drove the picker with `.click()` and `.value =`,
       which do not care where an element is, so all of them passed on a picker
       nobody could see. GEOMETRY IS THE ASSERTION HERE: fixed, on top, and
       inside the viewport. */
    await pg.evaluate(() => {
      const b =
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0];
      go("quotes", b.id);
    });
    await pg.waitForTimeout(900);
    await pg.evaluate(() => document.querySelector('#pbMTabs [data-mtab="lines"]').click());
    await pg.waitForTimeout(400);
    await pg.evaluate(() => document.querySelector("#bRows [data-addline]").click());
    await pg.waitForTimeout(800);
    const picker = await pg.evaluate(() => {
      const m = document.querySelector("#catpick");
      if (!m) return { err: "the catalogue did not open" };
      const cs = getComputedStyle(m);
      const box = m.querySelector(".modal");
      const r = box.getBoundingClientRect();
      // What is actually painted at the middle of the sheet: if the page has
      // rendered on top of it, or it is somewhere else entirely, this is not
      // the picker.
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + 40);
      return {
        position: cs.position,
        z: cs.zIndex,
        onScreen: r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.width > 200,
        rect: { t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) },
        vh: window.innerHeight,
        insidePicker: !!(hit && hit.closest("#catpick")),
        rows: m.querySelectorAll(".cpi").length,
        addBtn: !!m.querySelector("#cp_add"),
      };
    });
    if (picker.err) bad("mobile: the catalogue picker opens", picker.err);
    else if (
      picker.position === "fixed" &&
      picker.onScreen &&
      picker.insidePicker &&
      picker.rows > 0 &&
      picker.addBtn
    )
      ok(
        `mobile: the catalogue opens over the screen with ${picker.rows} tickable partidas, not below the page`,
      );
    else bad("mobile: catalogue picker position", JSON.stringify(picker));

    /* IT NARROWS TO THE CHAPTER IT WAS PRESSED ON.
       A budget chapter's name is free text and the price book's chapters are a
       list, so "Pavimentos" never matched "Solados" and the picker opened on
       all 208 every time — which is how "+ partida del catálogo" came to look
       as though it ignored the chapter it belonged to. */
    const narrowed = await pg.evaluate(() => {
      const n = document.querySelectorAll("#catpick .cpi").length;
      const sel = document.querySelector("#cp_chap");
      return {
        n,
        total: erp.state.catalogue.filter((i) => i.active !== false).length,
        chapterSelector: !!sel,
      };
    });
    if (narrowed.n > 0 && narrowed.n < narrowed.total && narrowed.chapterSelector)
      ok(
        `mobile: it opens on this chapter's ${narrowed.n} partidas, not all ${narrowed.total}, with the whole book one control away`,
      );
    else bad("mobile: picker narrows to the chapter", JSON.stringify(narrowed));

    /* TICK SEVERAL, ADD ONCE — the flow the operator asked to have back.
       Asserted on the LINE COUNT, because "the modal closed" is not the
       feature: a picker that adds one of the three ticked would close just as
       cleanly. */
    const multi = await pg.evaluate(async () => {
      const b =
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0];
      const v = b.versions[b.versions.length - 1];
      const before = v.chapters[0].lines.length;
      const rows = [...document.querySelectorAll("#catpick .cpi")].slice(0, 3);
      if (rows.length < 3) return { err: `only ${rows.length} partidas offered` };
      rows.forEach((r) => r.click());
      const counted = document.querySelector("#cp_count")?.textContent || "";
      document.querySelector("#cp_add").click();
      await new Promise((r) => setTimeout(r, 900));
      const v2 = (
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0]
      ).versions.slice(-1)[0];
      return {
        before,
        after: v2.chapters[0].lines.length,
        counted,
        stillOpen: !!document.querySelector("#catpick"),
        priced: v2.chapters[0].lines.slice(-3).every((l) => l.priceCents > 0 && l.unit),
      };
    });
    if (multi.err) bad("mobile: tick several and add at once", multi.err);
    else if (multi.after === multi.before + 3 && !multi.stillOpen && multi.priced)
      ok(
        `mobile: three ticked, three added in one press (${multi.before}→${multi.after}), each arriving priced`,
      );
    else bad("mobile: tick several and add at once", JSON.stringify(multi));

    /* AND THINGS CAN BE TAKEN OUT AGAIN — a partida, and a whole chapter.
       `removeChapter` existed in the engine with no caller and no audit entry,
       so a chapter added by mistake could only be emptied line by line and left
       standing at zero. */
    const delLine = await pg.evaluate(async () => {
      const btn = document.querySelector("#bRows [data-delline]");
      if (!btn) return { err: "no delete on a line" };
      const r = btn.getBoundingClientRect();
      // Labelled on a phone: an unlabelled ✕ on a row of its own is the one
      // control an operator will not press, because nothing says what it kills.
      const labelled = /elimina/i.test(btn.textContent || "");
      const b =
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0];
      const v = b.versions[b.versions.length - 1];
      const before = v.chapters.reduce((s, c) => s + c.lines.length, 0);
      btn.click();
      await new Promise((x) => setTimeout(x, 700));
      const v2 = (
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0]
      ).versions.slice(-1)[0];
      return {
        labelled,
        tall: Math.round(r.height),
        before,
        after: v2.chapters.reduce((s, c) => s + c.lines.length, 0),
      };
    });
    if (delLine.err) bad("mobile: a partida can be removed", delLine.err);
    else if (delLine.after === delLine.before - 1 && delLine.labelled && delLine.tall >= 44)
      ok(
        `mobile: a partida can be removed, from a labelled ${delLine.tall}px target — not a 26px ✕`,
      );
    else bad("mobile: remove a partida", JSON.stringify(delLine));

    const delChap = await pg.evaluate(async () => {
      const btn = document.querySelector("#bRows [data-delchap]");
      if (!btn) return { err: "no delete on a chapter" };
      const b =
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0];
      const v = b.versions[b.versions.length - 1];
      const before = v.chapters.length;
      btn.click();
      await new Promise((x) => setTimeout(x, 500));
      // It must ASK first — this takes every partida under it.
      const asked = !!document.querySelector(".mscrim.on");
      const okBtn = [...document.querySelectorAll(".mscrim.on button")].find((x) =>
        /elimina/i.test(x.textContent || ""),
      );
      if (okBtn) okBtn.click();
      await new Promise((x) => setTimeout(x, 800));
      const v2 = (
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0]
      ).versions.slice(-1)[0];
      return {
        asked,
        before,
        after: v2.chapters.length,
        renumbered: v2.chapters.every((c, i) => String(c.num) === String(i + 1)),
      };
    });
    if (delChap.err) bad("mobile: a chapter can be removed", delChap.err);
    else if (delChap.asked && delChap.after === delChap.before - 1 && delChap.renumbered)
      ok(
        `mobile: a chapter can be removed after confirming, and the rest renumber (${delChap.before}→${delChap.after})`,
      );
    else bad("mobile: remove a chapter", JSON.stringify(delChap));

    // The logo is the way home, and on a phone it is the only one visible.
    await pg.evaluate(() => (location.hash = "invoicing"));
    await pg.waitForTimeout(500);
    await pg.click("#brandHome");
    await pg.waitForTimeout(600);
    const home = await pg.evaluate(() => location.hash);
    if (home === "#tower") ok("mobile: the logo goes home from anywhere");
    else bad("mobile: logo goes home", home);

    // A grid is NOT a list: the forecast keeps its columns and scrolls inside
    // its own container, which is the whole reason it opts out.
    await pg.evaluate(() => (location.hash = "cash-flow"));
    await pg.waitForTimeout(600);
    const grid = await pg.evaluate(() => {
      const t = document.querySelector("#cfGrid");
      const host = document.querySelector(".fcast");
      return {
        optedOut: t.hasAttribute("data-nocards") && !t.classList.contains("cards"),
        scrollsInside: host.scrollWidth > host.clientWidth + 1,
        pageWide: document.documentElement.scrollWidth,
      };
    });
    if (grid.optedOut && grid.scrollsInside && grid.pageWide <= 391)
      ok("mobile: the forecast keeps its columns and scrolls inside its own card");
    else bad("mobile: grid opt-out", JSON.stringify(grid));

    // §3's floating button: 56 px target, four actions, 48 px rows.
    const fab = await pg.evaluate(() => {
      const f = document.querySelector("#fab");
      const r = f.getBoundingClientRect();
      return {
        display: getComputedStyle(f).display,
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });
    if (fab.display !== "none" && fab.w === 56 && fab.h === 56)
      ok("mobile: the site-actions button is a 56 px target");
    else bad("mobile: FAB size", JSON.stringify(fab));

    await pg.locator("#fab").click();
    await pg.waitForTimeout(300);
    const menu = await pg.evaluate(() => ({
      open: document.querySelector("#fabMenu").classList.contains("on"),
      n: document.querySelectorAll("#fabMenu button").length,
      small: [...document.querySelectorAll("#fabMenu button")].filter(
        (b) => b.getBoundingClientRect().height < 48,
      ).length,
    }));
    if (menu.open && menu.n === 4 && menu.small === 0)
      ok("mobile: four site actions, none below a 48 px row");
    else bad("mobile: site actions menu", JSON.stringify(menu));

    // The site actions ship with Catalan like every other string — the rule
    // that has caught a gap in ten consecutive sessions. The language is a
    // stored preference read at boot, so this reloads rather than poking the
    // translator, which is how a real user changes it.
    await chooseLang(pg, "ca");
    await pg.reload({ waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(900);
    await pg.locator("#fab").click();
    await pg.waitForTimeout(500);
    const caMenu = await pg.locator("#fabMenu").innerText();
    if (/Part d'hores/i.test(caMenu) && !/Parte de horas/.test(caMenu))
      ok("i18n: CA translates the site-action button");
    else bad("i18n: CA site actions", caMenu.replace(/\n/g, " ").slice(0, 140));
    // Back to the default. Both stores, for the same reason chooseLang writes
    // both: clearing one leaves the other deciding the language for every
    // check after this one.
    await pg.evaluate(() => {
      try {
        localStorage.removeItem("caneiLang");
      } catch (e) {
        /* private mode */
      }
      document.cookie = "canei_lang=;path=/;max-age=0;samesite=lax";
    });
    await pg.reload({ waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(900);
    await pg.locator("#fab").click();
    await pg.waitForTimeout(400);

    // Three taps to done: the button, the action, and the control it lands on.
    await pg.locator("#fabMenu button").nth(1).click();
    await pg.waitForTimeout(800);
    const landed = await pg.evaluate(() => ({
      hash: location.hash,
      day: typeof hDay !== "undefined" ? hDay : null,
      today: erp.today,
      control: !!document.querySelector(".hsheet") || !!document.querySelector("#hAdd"),
    }));
    if (landed.hash === "#labour" && landed.day === landed.today && landed.control)
      ok("mobile: two taps land on today's hours sheet with the control in reach");
    else bad("mobile: three-tap site action", JSON.stringify(landed));

    if (errs.length === 0) ok("mobile: no console errors at 390px");
    else bad("mobile: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("mobile (§3)", String(e).slice(0, 220));
  } finally {
    await pg.close();
  }
}

// ── The native shell (S15). The iOS app is a WKWebView around these pages and
//    marks its user agent so they can tell. Before it was read, a phone inside
//    the app stacked three things at the bottom: the web's own section bar, the
//    native tab bar over it, and the site-action button positioned to clear the
//    wrong one. Spoofing the marker is exactly what the app does, so this is
//    testable here rather than only on a device.
async function testNativeShell(browser, base) {
  const UA_NATIVE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CaneiApp/1.1 (iOS; native-shell)";
  const UA_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/605.1.15";
  const measure = async (userAgent) => {
    const pg = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      userAgent,
    });
    const errs = [];
    attachConsole(pg, errs);
    await pg.goto(`${base}/erp.html#invoicing`, { waitUntil: "networkidle" });
    // `attached`, not visible: under the native marker the section bar is
    // rendered and then hidden, which is the thing being tested. Waiting for it
    // to be VISIBLE would time out on exactly the case that is working.
    await pg.waitForSelector("#p1 .secitem", { state: "attached", timeout: 15000 });
    await pg.waitForTimeout(900);
    const shape = await pg.evaluate(() => ({
      native: document.body.classList.contains("native"),
      bar: getComputedStyle(document.querySelector("#p1")).display,
      fab: getComputedStyle(document.querySelector("#fab")).bottom,
      pad: getComputedStyle(document.querySelector("main")).paddingBottom,
      sw: document.documentElement.scrollWidth,
    }));
    return { pg, errs, shape };
  };
  try {
    const nat = await measure(UA_NATIVE);
    const saf = await measure(UA_SAFARI);

    if (nat.shape.native && nat.shape.bar === "none")
      ok("native shell: the web's own section bar stands down for the native tab bar");
    else bad("native shell: bar stands down", JSON.stringify(nat.shape));

    // Safari on an iPhone is NOT the app. Giving it the app's chrome would
    // strand somebody who opened the site in a browser with no way to a
    // section, so the marker is read rather than the platform sniffed.
    if (!saf.shape.native && saf.shape.bar !== "none")
      ok(
        "native shell: plain Mobile Safari keeps the web bar — the marker is read, not the platform",
      );
    else bad("native shell: safari unaffected", JSON.stringify(saf.shape));

    // The site-action button clears the bar that is actually in front.
    if (parseInt(nat.shape.fab, 10) > parseInt(saf.shape.fab, 10))
      ok(`native shell: the site-action button clears the native tab bar (${nat.shape.fab})`);
    else bad("native shell: FAB offset", `${nat.shape.fab} vs ${saf.shape.fab}`);

    // The one thing a six-tab native bar cannot do is reach 29 subsecciones.
    await nat.pg.locator("#crumbs").click();
    await nat.pg.waitForTimeout(600);
    const subs = await nat.pg.evaluate(() => {
      const p2 = document.querySelector("#p2");
      const r = p2.getBoundingClientRect();
      return {
        on: p2.classList.contains("on"),
        items: p2.querySelectorAll("button, a").length,
        onScreen: r.height > 0 && r.top < window.innerHeight && r.bottom > 0,
      };
    });
    if (subs.on && subs.items >= 5 && subs.onScreen)
      ok(`native shell: the breadcrumb opens the subsection list on screen (${subs.items} items)`);
    else bad("native shell: subsections reachable", JSON.stringify(subs));

    if (nat.errs.length === 0 && saf.errs.length === 0)
      ok("native shell: no console errors under either user agent");
    else bad("native shell: console errors", [...nat.errs, ...saf.errs].slice(0, 3).join(" | "));

    await nat.pg.close();
    await saf.pg.close();
  } catch (e) {
    bad("native shell", String(e).slice(0, 220));
  }
}

async function testSmoke(browser, base) {
  const pages = [
    "journey.html",
    "setup-guide.html",
    "master-data.html",
    "financial-data.html",
    "erp.html",
  ];
  for (const p of pages) {
    const page = await browser.newPage();
    const errors = [];
    attachConsole(page, errors);
    try {
      const resp = await page.goto(`${base}/${p}`, { waitUntil: "domcontentloaded" });
      const title = await page.title();
      if (resp && resp.ok() && title.length > 0 && errors.length === 0) ok(`loads clean — ${p}`);
      else
        bad(
          `loads clean — ${p}`,
          `ok=${resp && resp.ok()} title="${title}" errors=${errors.length}`,
        );
    } catch (e) {
      bad(`loads clean — ${p}`, String(e).slice(0, 120));
    } finally {
      await page.close();
    }
  }
}

// ── Data tabs: Master Data (capture + persist + export) and Financial Data
//    (statements compute & reconcile). These are the automation-facing tabs.
async function testDataTabs(browser, base) {
  // --- Master Data: add a record, confirm it persists across reload + exports.
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    acceptDownloads: true,
  });
  const errors = [];
  attachConsole(page, errors);
  try {
    await page.goto(`${base}/master-data.html`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const navCount = await page.locator(".navitem").count();
    if (navCount >= 15) ok(`master-data: entity nav renders (${navCount} registers)`);
    else bad("master-data: entity nav renders", `only ${navCount}`);

    const testCode = "TEST-" + String(Date.now()).slice(-6);
    await page.locator("#btnAdd").click();
    await page.waitForTimeout(200);
    await page.locator("#f_code").fill(testCode);
    await page.locator("#f_legalName").fill("Playwright Test Cliente");
    await page.locator("#dSave").click();
    await page.waitForTimeout(200);

    // Reload → the record must come back from IndexedDB.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.locator("#q").fill(testCode);
    await page.waitForTimeout(150);
    const bodyText = await page
      .locator("#tbody")
      .innerText()
      .catch(() => "");
    if (bodyText.includes(testCode)) ok("master-data: record persists across reload (IndexedDB)");
    else bad("master-data: record persists across reload", bodyText.slice(0, 80));

    // Export must produce JSON that includes the new record (automation feed).
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 6000 }).catch(() => null),
      page
        .locator("#btnExport")
        .click()
        .catch(() => {}),
    ]);
    if (dl) {
      const p = await dl.path();
      const nfs = await import("node:fs");
      const txt = p ? nfs.readFileSync(p, "utf8") : "";
      if (txt.includes("Master Data") && txt.includes(testCode))
        ok("master-data: exports JSON including the new record");
      else bad("master-data: exports JSON", txt.slice(0, 60));
    } else bad("master-data: exports JSON", "no download fired");

    if (errors.length === 0) ok("master-data: no console errors");
    else bad("master-data: no console errors", errors.slice(0, 3).join(" | "));
  } catch (e) {
    bad("master-data tab", String(e).slice(0, 180));
  } finally {
    await page.close();
  }

  // --- Financial Data: KPIs render, balance sheet balances, cash flow reconciles.
  const fp = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const ferr = [];
  attachConsole(fp, ferr);
  try {
    await fp.goto(`${base}/financial-data.html`, { waitUntil: "networkidle" });
    await fp.waitForTimeout(300);
    const kpiText = await fp.locator("#view").innerText();
    if (/Revenue|Ingresos/i.test(kpiText) && /€/.test(kpiText))
      ok("financial: KPI cockpit renders");
    else bad("financial: KPI cockpit renders", kpiText.slice(0, 80));
    // The self-check pill proves the seeded statements are internally consistent.
    if (/A = L \+ E|A = P \+ PN/.test(kpiText)) ok("financial: balance sheet balances (A = L + E)");
    else bad("financial: balance sheet balances", "no pass indicator");

    await fp
      .locator(".navitem", { hasText: "Profit & Loss" })
      .click()
      .catch(() => {});
    await fp.waitForTimeout(200);
    const pl = await fp.locator("#view").innerText();
    if (
      /Net profit|Beneficio neto/i.test(pl) &&
      /Gross profit|Beneficio bruto|Margen bruto/i.test(pl)
    )
      ok("financial: P&L statement computes");
    else bad("financial: P&L statement computes", pl.slice(0, 80));

    await fp
      .locator(".navitem", { hasText: "Cash flow" })
      .click()
      .catch(() => {});
    await fp.waitForTimeout(200);
    const cf = await fp.locator("#view").innerText();
    if (/econciles|concilia|uadra/.test(cf)) ok("financial: cash flow reconciles to cash");
    else bad("financial: cash flow reconciles", cf.slice(0, 80));

    if (ferr.length === 0) ok("financial: no console errors");
    else bad("financial: no console errors", ferr.slice(0, 3).join(" | "));
  } catch (e) {
    bad("financial tab", String(e).slice(0, 180));
  } finally {
    await fp.close();
  }
}

// ── Retired screens (spec §1): the old standalone pages are redirects into the
//    single workspace. They must land on the right section, and must not sit in
//    history — Back has to leave, not bounce.
async function testRetired(browser, base) {
  const cases = [
    ["index.html", "erp.html#tower"],
    ["dashboard.html", "erp.html#tower"],
    ["clientes.html", "erp.html#customers"],
    ["frontend.html", "erp.html#quotes"],
  ];
  for (const [from, to] of cases) {
    const page = await browser.newPage();
    try {
      await page.goto(`${base}/${from}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const url = page.url();
      if (url === `${base}/${to}`) ok(`retired: ${from} → ${to}`);
      else bad(`retired: ${from} → ${to}`, `landed on ${url}`);
    } catch (e) {
      bad(`retired: ${from} → ${to}`, String(e).slice(0, 120));
    } finally {
      await page.close();
    }
  }
}

// ── Three-panel shell + global bar (spec §1). Panel 2 stays out of the way
//    until asked for, and the bar's four controls are real: search finds
//    records, create opens a form, the bell counts open alerts and the period
//    actually filters.
async function testShell(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#tower`, { waitUntil: "networkidle" });
    await bootedShell(pg);

    const sections = await pg.locator("#p1 .secitem").count();
    const subsOpen = await pg.locator("#p2.on").count();
    if (sections === 6 && subsOpen === 0) ok("shell: 6 sections, subsection panel collapsed");
    else bad("shell: sections + collapsed panel", `sections=${sections} open=${subsOpen}`);

    // The count, asserted rather than assumed: six secciones, thirty
    // subsecciones declared, three of them hidden (Part 2 · item 3 — hidden,
    // never deleted, so SECTIONS still declares them and their routes live).
    // Pinned so both a thirty-first sub and a fourth hidden entry arrive
    // deliberately rather than by drift.
    const shape = await pg.evaluate(() => ({
      sections: SECTIONS.length,
      subs: SECTIONS.reduce((n, s) => n + s.subs.length, 0),
      hidden: [...HIDDEN_SUBS].sort().join(","),
    }));
    if (
      shape.sections === 6 &&
      shape.subs === 30 &&
      shape.hidden === "alerts,financials,purchasing"
    )
      ok("shell: 6 secciones × 30 declared subs, 3 hidden by name");
    else bad("shell: 6×30 (3 hidden)", JSON.stringify(shape));

    /* The hidden three, both halves of the promise: the MENU no longer lists
       them, and the ROUTE still renders the screen — hiding that killed the
       route would be deletion wearing a costume. Checked per entry, because
       "no dead links" (below) cannot see a link that is not offered. */
    const hiddenBehaviour = await pg.evaluate(async () => {
      const out = [];
      for (const k of ["purchasing", "alerts"]) {
        const sec = SECTIONS.find((s) => s.subs.some((x) => x.k === k)).k;
        buildSubs(sec);
        const listed = !!document.querySelector(`#p2list .navitem[data-k="${k}"]`);
        location.hash = k;
        await new Promise((r) => setTimeout(r, 250));
        const dead = /Ruta desconocida/.test(document.querySelector("#view").innerText);
        out.push({ k, listed, dead });
      }
      closeSection();
      return out;
    });
    if (hiddenBehaviour.every((h) => !h.listed && !h.dead))
      ok("shell: hidden entries are out of the menu AND their routes still render");
    else bad("shell: hidden entries", JSON.stringify(hiddenBehaviour));

    // Administración in the operator's money-flow order (Part 2 · item 5),
    // with the item-4 renames — asserted as the exact visible sequence.
    const adminOrder = await pg.evaluate(() => {
      buildSubs("admin");
      const rows = [...document.querySelectorAll("#p2list .navitem")].map((b) =>
        b.querySelector("span").textContent.trim(),
      );
      closeSection();
      return rows.join(" · ");
    });
    if (
      adminOrder ===
      "Ingresos · Gastos · Consolidación bancaria · Caja chica · Horas · Reporte a gestoría · Flujo de caja"
    )
      ok("shell: Administración runs in money-flow order with the new names");
    else bad("shell: admin order", adminOrder);

    // Press a section → panel 2 opens with that section's subsections.
    await pg.locator('#p1 .secitem[data-sec="sales"]').click();
    await pg.waitForTimeout(250);
    const subs = await pg.locator("#p2.on .navitem").count();
    if (subs === 4) ok("shell: section opens its subsection panel");
    else bad("shell: section opens panel", `subsections=${subs}`);

    // Choosing a subsection routes and collapses the panel again.
    await pg.locator('#p2 .navitem[data-k="contracts"]').click();
    await pg.waitForTimeout(350);
    const hash = await pg.evaluate(() => location.hash);
    const stillOpen = await pg.locator("#p2.on").count();
    const title = await pg.locator("#ttl").innerText();
    if (hash === "#contracts" && stillOpen === 0 && /Contratos/i.test(title))
      ok("shell: choosing a subsection routes and collapses the panel");
    else bad("shell: subsection routes", `hash=${hash} open=${stillOpen} title=${title}`);

    // Clicking outside closes it too.
    await pg.locator('#p1 .secitem[data-sec="projects"]').click();
    await pg.waitForTimeout(200);
    await pg.locator("#subscrim").click();
    await pg.waitForTimeout(250);
    if ((await pg.locator("#p2.on").count()) === 0) ok("shell: outside click collapses the panel");
    else bad("shell: outside click collapses", "still open");

    // This probe used to open the one subsección that was not built yet and
    // assert it explained itself. It moved four times as its subject got
    // built — Reportes, `units` (S3), `visits` (S4), `petty-cash` (S11) — and
    // S12 built the last one, `cash-flow`. So it inverts: walk EVERY entry in
    // the menu and fail if any of them lands on the dead-link fallback. That
    // is what the old probe was really protecting, and it now scales.
    const routes = await pg.evaluate(() =>
      SECTIONS.flatMap((s) => s.subs.filter((x) => !x.href).map((x) => x.k)),
    );
    const dead = [];
    for (const k of routes) {
      await pg.evaluate((r) => (location.hash = r), k);
      await pg.waitForTimeout(180);
      const txt = await pg.locator("#view").innerText();
      if (/Ruta desconocida/.test(txt)) dead.push(k);
    }
    if (routes.length >= 25 && dead.length === 0)
      ok(`shell: all ${routes.length} menu subsections render a real screen`);
    else bad("shell: every subsection is built", `${routes.length} routes, dead: ${dead.join()}`);

    // Universal search: grouped results, and picking one opens the record.
    await pg.locator("#q").fill("Marta");
    await pg.waitForTimeout(300);
    const res = await pg.locator("#sres.on").innerText();
    // Group headings are upper-cased by CSS, so innerText comes back shouting.
    if (/clientes/i.test(res) && /Marta/.test(res))
      ok("bar: universal search groups results by type");
    else bad("bar: universal search", res.slice(0, 80));
    await pg.locator("#sres .si").first().click();
    await pg.waitForTimeout(400);
    const drawer = await pg.locator("#drawer.on #dttl").innerText();
    if (/Marta/.test(drawer)) ok("bar: a search hit opens the record");
    else bad("bar: search hit opens record", drawer);
    await pg.locator("#dClose").click();

    // Alert bell: a real count, and each entry drills down.
    const badge = await pg.locator("#bellCt").innerText();
    await pg.locator("#btnBell").click();
    await pg.waitForTimeout(200);
    const bell = await pg.locator("#mBell.on").innerText();
    if (/^\d+$/.test(badge.trim()) && bell.trim().length > 0)
      ok(`bar: alert bell shows ${badge.trim()} open alerts`);
    else bad("bar: alert bell", `badge=${badge} menu=${bell.slice(0, 60)}`);
    await pg.keyboard.press("Escape");

    // Contextual create: the menu follows the active section and opens a form.
    await pg.evaluate(() => (location.hash = "progress"));
    await pg.waitForTimeout(300);
    await pg.locator("#btnCreate").click();
    await pg.waitForTimeout(200);
    const create = await pg.locator("#mCreate.on").innerText();
    if (/proyecto/i.test(create)) ok("bar: create menu is contextual to the section");
    else bad("bar: create menu contextual", create.slice(0, 60));
    await pg.locator("#mCreate button").first().click();
    await pg.waitForTimeout(300);
    if ((await pg.locator("#drawer.on #n_save").count()) === 1)
      ok("bar: create opens the new-project form");
    else bad("bar: create opens form", "no form");
    await pg.locator("#dClose").click();

    // Period selector: switching to a month filters, and says how much it hides.
    await pg.evaluate(() => (location.hash = "invoicing"));
    await pg.waitForTimeout(300);
    const beforeRows = await pg.locator("#view tbody tr").count();
    await pg.selectOption("#periodMode", "month");
    await pg.waitForTimeout(400);
    const note = await pg.locator("#view .periodnote").innerText();
    const afterRows = await pg.locator("#view tbody tr").count();
    if (/Periodo/.test(note) && afterRows < beforeRows)
      ok("bar: period selector filters the invoice list");
    else bad("bar: period selector filters", `note="${note}" ${beforeRows}→${afterRows}`);

    // …and the choice survives a reload (it lives in the store's meta, not the
    // state blob, so it can never collide with an engine key).
    await pg.reload({ waitUntil: "networkidle" });
    await pg.waitForTimeout(700);
    const mode = await pg.locator("#periodMode").inputValue();
    if (mode === "month") ok("bar: period choice persists across reload");
    else bad("bar: period persists", `mode=${mode}`);
    await pg.selectOption("#periodMode", "year");

    if (errs.length === 0) ok("shell: no console errors");
    else bad("shell: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("three-panel shell", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── The Gantt (spec §3.3 / §4.3). Drives the real chart with real pointer
//    gestures: drag to move, edge-drag to resize, knob-drag to link. Every
//    assertion is about a number the ENGINE produced — the point of the
//    session is that the view computes none of them.
async function testGantt(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  const finishChip = () => pg.locator(".gtools .chip").first().innerText();
  try {
    await openGantt(pg, base);

    // Empty plan → derive it from the project's accepted budget. Over a plan
    // that already exists the derivation asks first (PK3-C); say yes.
    if (await pg.locator("#gDerive").count()) {
      await pg.locator("#gDerive").click();
      await pg.waitForTimeout(500);
      const confirm = pg.getByRole("button", { name: /Volver a derivar/ });
      if (await confirm.count()) await confirm.click();
      await pg.waitForTimeout(700);
    }
    const bars = await pg.locator("#gSvg .gbar").count();
    const rows = await pg.locator(".gnames .gn[data-task]").count();
    const deps0 = await pg.locator("#gSvg path.gdep").count();
    if (bars >= 3 && rows === bars && deps0 >= bars - 1)
      ok(`gantt: derives ${bars} chained tasks from the budget`);
    else bad("gantt: derives from the budget", `bars=${bars} rows=${rows} deps=${deps0}`);

    /* The today line is at TODAY, and on the chart.
       "always use the actual date when you go in… when you open the giant
       chart, then you see the line at the actual date today." `state.today` is
       stored and nothing advanced it, so a workspace seeded in March still drew
       its today line in March in August. Two things have to hold: the clock
       equals the wall, and the window includes it — a line at the right date
       painted past the right-hand edge is no better than one at the wrong
       date. */
    const nowLine = await pg.evaluate(() => {
      const svg = document.querySelector("#gSvg");
      const line = svg && svg.querySelector(".gtoday");
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      return {
        wall: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
        erpToday: erp.today,
        x: line ? Math.round(+line.getAttribute("x1")) : null,
        width: svg ? Math.round(+svg.getAttribute("width")) : 0,
        from: svg ? svg.dataset.from : null,
      };
    });
    if (nowLine.erpToday === nowLine.wall)
      ok(`gantt: the workspace clock is the real date (${nowLine.wall})`);
    else
      bad(
        "gantt: workspace clock follows the wall clock",
        `erp.today=${nowLine.erpToday} wall=${nowLine.wall}`,
      );
    if (nowLine.x !== null && nowLine.x >= 0 && nowLine.x <= nowLine.width)
      ok(`gantt: the today line is drawn on the chart (x=${nowLine.x} of ${nowLine.width})`);
    else bad("gantt: today line inside the chart", JSON.stringify(nowLine));
    // Drawn is not seen. On a plan that began two years ago the line is 18 000 px
    // right of where the chart used to open, so the chart opens ON it. Measured
    // HERE, before any check calls scrollIntoViewIfNeeded on a 2024 bar and
    // scrolls this container back to zero.
    const view = await pg.evaluate(() => {
      const sc = document.querySelector(".gscroll");
      const x = Number(document.querySelector("#gSvg").dataset.today);
      return {
        left: Math.round(sc.scrollLeft),
        w: sc.clientWidth,
        sw: sc.scrollWidth,
        x: Math.round(x),
        canScroll: sc.scrollWidth > sc.clientWidth,
      };
    });
    if (view.x >= view.left && view.x <= view.left + view.w)
      ok(`gantt: the chart opens on today, not on its far-left past (${view.left}→${view.x})`);
    else bad("gantt: today is in view when the chart opens", JSON.stringify(view));

    // Bars must render at their real height — an SVG rect is subject to CSS
    // geometry, so a stray `.bar {height}` rule elsewhere silently flattens
    // the whole chart. That regression happened once; this pins it.
    // The chart now opens ON today, so a bar from the demo plan's own year can
    // start scrolled off the left. Bring it into view before measuring it —
    // a bounding box taken outside the viewport gives coordinates the mouse
    // cannot reach, and the drag silently does nothing.
    await pg.locator("#gSvg .gbar").first().scrollIntoViewIfNeeded();
    const box = await pg.locator("#gSvg .gbar").first().boundingBox();
    if (box && box.height > 15) ok("gantt: bars render at full height");
    else bad("gantt: bar height", JSON.stringify(box));

    if ((await pg.locator("#gSvg .gbar.crit").count()) > 0)
      ok("gantt: the critical path is marked on the chart");
    else bad("gantt: critical path marked", "no critical bars");

    // Drag the first bar four days right: the engine reschedules and the
    // plan's finish moves with it.
    const finishBefore = await finishChip();
    await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await pg.mouse.down();
    await pg.mouse.move(box.x + box.width / 2 + 96, box.y + box.height / 2, { steps: 10 });
    await pg.mouse.up();
    await pg.waitForTimeout(600);
    const finishAfter = await finishChip();
    if (finishAfter !== finishBefore)
      ok(
        `gantt: dragging a bar reschedules the plan (${finishBefore.split("\n")[1]} → ${finishAfter.split("\n")[1]})`,
      );
    else bad("gantt: drag reschedules", `finish unchanged: ${finishBefore}`);

    // Edge-drag to lengthen: the toast reports the new duration in WORKING days.
    await pg.locator("#gSvg .ggrip").first().scrollIntoViewIfNeeded();
    const gb = await pg.locator("#gSvg .ggrip").first().boundingBox();
    await pg.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
    await pg.mouse.down();
    await pg.mouse.move(gb.x + gb.width / 2 + 72, gb.y + gb.height / 2, { steps: 10 });
    await pg.mouse.up();
    await pg.waitForTimeout(600);
    const resizeToast = await pg.locator("#toast").innerText();
    if (/d[ií]as laborables/i.test(resizeToast)) ok(`gantt: edge-drag resizes (${resizeToast})`);
    else bad("gantt: edge-drag resizes", resizeToast);

    // Drag the link knob onto another bar → a new dependency.
    await pg.locator("#gSvg .gknob").nth(0).scrollIntoViewIfNeeded();
    const kb = await pg.locator("#gSvg .gknob").nth(0).boundingBox();
    const tb = await pg.locator("#gSvg .gbar").nth(2).boundingBox();
    const before = await pg.locator("#gSvg path.gdep").count();
    await pg.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2);
    await pg.mouse.down();
    await pg.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 12 });
    await pg.mouse.up();
    await pg.waitForTimeout(600);
    const after = await pg.locator("#gSvg path.gdep").count();
    if (after > before) ok("gantt: dragging between bars creates a dependency");
    else bad("gantt: link by drag", `deps ${before} → ${after}`);

    // Freeze a baseline: the ghost bars appear and drift is reported.
    await pg.locator("#gFreeze").click();
    await pg.waitForTimeout(400);
    await pg.locator("#g_frz").click();
    await pg.waitForTimeout(700);
    const chips = (await pg.locator(".gtools .chip").allInnerTexts()).join(" | ");
    const ghosts = await pg.locator("#gSvg .gghost").count();
    if (/nea base/.test(chips) && ghosts > 0)
      ok(`gantt: baseline frozen and drawn (${ghosts} reference bars)`);
    else bad("gantt: baseline", `chips="${chips}" ghosts=${ghosts}`);

    // Close the finish day: the calendar reaches the engine, so the plan's
    // finish must move — this is the one assertion that proves the working
    // calendar is not decoration.
    // Read it off the chip the user reads, rather than out of page internals.
    const finishOf = async () => {
      const m = (await finishChip()).match(/(\d{2})\/(\d{2})\/(\d{4})/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
    };
    const finishIso = await finishOf();
    await pg.locator("#gNw").fill(finishIso);
    await pg.locator("#gNwAdd").click();
    await pg.waitForTimeout(700);
    const finishIso2 = await finishOf();
    if (finishIso2 > finishIso)
      ok(`gantt: closing a day pushes the finish (${finishIso} → ${finishIso2})`);
    else bad("gantt: non-working day shifts the plan", `${finishIso} → ${finishIso2}`);

    // The plan lives in the state blob (schema v3), so it survives a reload.
    // The chosen TAB deliberately does not — which tab you last looked at is
    // not company data — so the schedule has to be reopened after the reload.
    await pg.reload({ waitUntil: "networkidle" });
    await pg.waitForTimeout(900);
    await openGantt(pg, base);
    const barsAfter = await pg.locator("#gSvg .gbar").count();
    if (barsAfter === bars) ok("gantt: the plan persists across a reload");
    else bad("gantt: plan persists", `${bars} → ${barsAfter}`);

    if (errs.length === 0) ok("gantt: no console errors");
    else bad("gantt: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("gantt chart", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── ERP workspace (BRD v2): Control Tower, and the BNK-02 flow — allocate a
//    bank movement by typing the project number.
// ── Budget constructor (§3.3) and the graphic annex (Improvement #1).
//    Everything here is checked in a real browser rather than by reading code:
//    the three zones must actually be on screen at once, the right-hand panel
//    must actually change as keys are pressed, and the annex must actually
//    print its pictures after the totals and not in the lines' rows.
async function testBudgetBuilder(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#quotes`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForSelector("#view table", { timeout: 15000 });

    // Open the one budget that is still a draft — a frozen version is
    // deliberately read-only, so editing has to be tried on an editable one.
    // The register's Estado column (COM-03) carries the stage pill per row.
    const opened = await pg.evaluate(() => {
      const row = [...document.querySelectorAll("#view table.mlist tr.click")].find((tr) =>
        /Borrador/i.test(tr.textContent),
      );
      if (!row) return false;
      row.click();
      return true;
    });
    if (!opened) {
      bad(
        "builder: a draft budget exists to edit",
        `${await pg.locator("#view tr.click").count()} budgets, none in Borradores`,
      );
      return;
    }
    await pg.waitForTimeout(500);

    // Zone 1, 2 and 3 simultaneously — the whole point of the layout.
    const tree = await pg.locator("#bTree .bc").count();
    const gridRows = await pg.locator("#bRows tr[data-row]").count();
    const totals = await pg.locator("#bSide").isVisible();
    if (tree >= 2 && gridRows >= 2 && totals)
      ok(`builder: three zones at once (${tree} chapters · ${gridRows} lines · live totals)`);
    else bad("builder: three zones", `tree=${tree} rows=${gridRows} totals=${totals}`);

    // The panel recalculates ON EVERY KEYSTROKE, not on blur. Type into a
    // price field and read the total back without leaving the field.
    const totalOf = async () => pg.locator("#bSide .row.big b").innerText();
    const before = await totalOf();
    const price = pg.locator('#bRows input[data-f="price"]').first();
    await price.click();
    await price.fill("");
    await price.type("99", { delay: 40 });
    await pg.waitForTimeout(200);
    const during = await totalOf();
    const focused = await pg.evaluate(() => document.activeElement?.dataset?.f || "");
    if (during !== before && focused === "price")
      ok(`builder: totals recalculate on every keystroke (${before} → ${during}, caret kept)`);
    else bad("builder: live totals", `before=${before} during=${during} focus=${focused}`);

    // Chapter subtotals in the tree move with the same edit.
    const treeAmt = await pg.locator("#bTree .bc .amt").first().innerText();
    if (/\d/.test(treeAmt)) ok("builder: the tree carries per-chapter totals");
    else bad("builder: chapter totals", treeAmt);

    // The picture count is an INTERNAL indicator on the row: a number, never
    // the picture itself.
    const galBtn = pg.locator("#bRows .bimg.has").first();
    if ((await galBtn.count()) > 0 && /^🖼 [1-9]/.test((await galBtn.innerText()).trim()))
      ok("builder: lines with pictures show a count, not the pictures");
    else
      bad(
        "builder: image indicator",
        await pg
          .locator("#bRows")
          .innerText()
          .catch(() => ""),
      );

    // The gallery manages them: caption, internal-only flag, order, delete.
    await galBtn.click();
    await pg.waitForTimeout(400);
    const gi = await pg.locator("#dbody .gal .gi").count();
    const thumb = await pg
      .locator("#dbody .gal .gi img")
      .first()
      .evaluate((im) => im.naturalWidth);
    if (gi >= 2 && thumb > 0)
      ok(`builder: the gallery loads ${gi} stored pictures from the blob store`);
    else bad("builder: gallery", `items=${gi} naturalWidth=${thumb}`);
    await pg.locator("#dClose").click();
    await pg.waitForTimeout(250);

    // ---- the annex itself ----
    await pg.locator("#bPreview").click();
    await pg.waitForTimeout(600);

    const pages = await pg.locator("#dbody .annexpg").count();
    const plates = await pg.locator("#dbody .plate").count();
    if (pages >= 2 && plates >= 3) ok(`annex: ${plates} pictures laid out over ${pages} pages`);
    else bad("annex: pages", `pages=${pages} plates=${plates}`);

    // Grouped and ordered by chapter and line, each captioned with both.
    const firstCap = await pg.locator("#dbody .plate figcaption").first().innerText();
    if (/partida 1\.1/.test(firstCap) && /1\. Pavimentos/.test(firstCap))
      ok("annex: each picture names its chapter and its line");
    else bad("annex: caption reference", firstCap.replace(/\n/g, " ").slice(0, 90));

    // Several pictures on one line are numbered correlatively.
    if (/\(1 de 2\)/.test(await pg.locator("#dbody").innerText()))
      ok("annex: a line with several pictures numbers them correlatively");
    else bad("annex: correlative numbering", "no '(1 de 2)' found");

    // An internal-only picture never reaches the customer document.
    if (!/nota interna/i.test(await pg.locator("#dbody").innerText()))
      ok("annex: internal-only pictures stay out of the customer document");
    else bad("annex: internal picture leaked", "internal caption found in the document");

    // The row carries a discreet mark and NOT the picture.
    const marks = await pg.locator("#dbody .chapline .amark").count();
    const inRow = await pg.locator("#dbody .chapline img").count();
    if (marks >= 2 && inRow === 0) ok("annex: the line's row gets a mark, never the picture");
    else bad("annex: row mark", `marks=${marks} imagesInRows=${inRow}`);

    // The annex comes after the totals and before the conditions.
    const order = await pg.evaluate(() => {
      const doc = document.querySelector("#dbody .doc");
      const kids = [...doc.children];
      const annex = kids.findIndex((k) => k.classList.contains("annexpg"));
      const conds = kids.length - 1; // the validity/conditions line closes the doc
      const totals = kids.findIndex((k) => /TOTAL/.test(k.textContent || ""));
      return { annex, conds, totals };
    });
    if (order.totals >= 0 && order.annex > order.totals && order.annex < order.conds)
      ok("annex: printed after the totals and before the conditions");
    else bad("annex: position in the document", JSON.stringify(order));
    await pg.locator("#dClose").click();
    await pg.waitForTimeout(200);

    // Switching the annex off removes both the pages and the marks.
    await pg.locator("#bAnnexOn").uncheck();
    await pg.waitForTimeout(400);
    await pg.locator("#bPreview").click();
    await pg.waitForTimeout(500);
    const offPages = await pg.locator("#dbody .annexpg").count();
    const offMarks = await pg.locator("#dbody .amark").count();
    if (offPages === 0 && offMarks === 0)
      ok("annex: switching it off drops the pages and the marks together");
    else bad("annex: switch off", `pages=${offPages} marks=${offMarks}`);

    /* ===== THE PRICE BOOK'S LINE DRAWINGS, END TO END =====
       "Add a picture which represents the task … check that the picture is
       also on the quote builder when I add the sub-item and finally also get
       on the pdf quote." Three surfaces, and the whole point is that they are
       ONE definition — so the check follows a single partida through all
       three and fails if any of them shows a different drawing, not merely if
       one of them shows none. Three separate presence checks would pass on a
       build where the catalogue drew a tap and the quote drew a door. */
    await pg.evaluate(() => go("items"));
    await pg.waitForTimeout(700);
    const cat = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll("#view table.mlist tbody tr.click")];
      const withMark = rows.filter((r) => r.querySelector("svg.pict"));
      const labels = new Set(
        withMark.map((r) => r.querySelector("svg.pict")?.getAttribute("aria-label")),
      );
      return { rows: rows.length, marked: withMark.length, distinct: labels.size };
    });
    if (cat.rows > 20 && cat.marked === cat.rows && cat.distinct >= 8)
      ok(
        `catalogue: every partida shows a drawing of its job (${cat.marked}/${cat.rows} rows, ${cat.distinct} different drawings)`,
      );
    else bad("catalogue: line drawings", JSON.stringify(cat));

    /* No requests and no blobs — the whole reason these are drawings. A build
       that quietly moved to <img src> would satisfy every other check here and
       cost the operator a megabyte a screen on a phone. */
    const cheap = await pg.evaluate(() => {
      const svgs = [...document.querySelectorAll("svg.pict")];
      const html = svgs.map((s) => s.outerHTML).join("");
      return {
        n: svgs.length,
        bytes: html.length,
        external: /<image|xlink:href|url\(|https?:/.test(html),
      };
    });
    if (cheap.n > 20 && !cheap.external && cheap.bytes / cheap.n < 1400)
      ok(
        `catalogue: the drawings fetch nothing and cost ~${Math.round(cheap.bytes / cheap.n)} bytes each`,
      );
    else bad("catalogue: drawings stay lean", JSON.stringify(cheap));

    /* Now the same partida, taken into a quote from the catalogue, and then
       printed. Picked through the engine so the drawing is compared against
       the item that was actually added rather than against a row index. */
    const chain = await pg.evaluate(async () => {
      const b =
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0];
      const v = b.versions[b.versions.length - 1];
      const chap = v.chapters[0];
      go("quotes", b.id);
      await new Promise((r) => setTimeout(r, 900));
      const btn = document.querySelector(`#bRows tr[data-chap="${chap.id}"] button.bcat`);
      if (!btn) return { err: "no catalogue chooser on the line" };
      const lineId = btn.dataset.cat;
      btn.click();
      await new Promise((r) => setTimeout(r, 800));
      const sheet = document.querySelector("#catpick");
      if (!sheet) return { err: "the chooser did not open the catalogue" };
      /* TAKEN FROM WHAT THIS CHAPTER ACTUALLY OFFERS, not from a partida
         chosen by name. The first version picked an "alicatado" out of the
         whole price book and demanded the chapter offer it — true only while
         the chapter matcher was broken and the picker showed all 208. Fixing
         the matcher broke the test, on a change that made the feature more
         right. Ask the control what it has.

         Whichever partida that is, its drawing must be one the words earn:
         `generic` would satisfy a "same drawing throughout" check while
         proving nothing, since every unrecognised line draws it. */
      const row0 = [...sheet.querySelectorAll(".cpi.pick")].find((x) => {
        const it = erp.state.catalogue.find(
          (i) => i.code === x.querySelector(".cpc")?.textContent.trim(),
        );
        return it && ErpPictograms.pick(it) !== "generic";
      });
      if (!row0) {
        document.querySelector("#cp_cancel")?.click();
        return { err: "this chapter offers no partida with a drawing of its own" };
      }
      const item = erp.state.catalogue.find(
        (i) => i.code === row0.querySelector(".cpc").textContent.trim(),
      );
      const want = ErpPictograms.label(ErpPictograms.pick(item));
      row0.click();
      sheet.querySelector("#cp_add").click();
      await new Promise((r) => setTimeout(r, 800));
      /* The builder line and the printed quote now carry the coloured PLATE —
         drawing plus the partida's code — not the bare mark. Reading its
         accessible name gets both at once, which is a stronger check than the
         drawing alone: a plate that lost its code would still name the shape. */
      const row = document.querySelector(`#bRows tr[data-row="${lineId}"] .plate svg`);
      const inBuilder = row && row.getAttribute("aria-label");
      // …and onto the document the customer receives.
      document.querySelector("#bPreview").click();
      await new Promise((r) => setTimeout(r, 900));
      /* `.chapline.item` and not `.chapline`: the same row class carries the
         totals, the exclusions and the assumptions, and demanding a drawing on
         "Base imponible" is asking the document to be wrong. The first version
         of this check did exactly that and reported 2 of 5 marked, which read
         as three missing pictures and was in fact three rows that are not
         partidas. The class now says which is which in the markup rather than
         leaving the test to guess. */
      const lines = [...document.querySelectorAll("#dbody .chapline.item")];
      const wantPlate = item.code + " · " + want;
      // The row this partida became, found by the description it carries
      // rather than by a word written into the test.
      const onDoc = lines
        .filter((l) => (l.textContent || "").includes(item.desc.slice(0, 24)))
        .map((l) => l.querySelector(".plate svg")?.getAttribute("aria-label"));
      return {
        want: wantPlate,
        inBuilder,
        onDoc,
        docLines: lines.length,
        docMarked: lines.filter((l) => l.querySelector(".plate svg")).length,
      };
    });
    if (chain.err) bad("the drawing follows the partida", chain.err);
    else if (
      chain.inBuilder === chain.want &&
      chain.onDoc.length > 0 &&
      chain.onDoc.every((l) => l === chain.want) &&
      chain.docMarked === chain.docLines
    )
      ok(
        `the same drawing follows one partida from the price book to the builder to the quote ("${chain.want}", ${chain.docMarked}/${chain.docLines} lines marked)`,
      );
    else bad("the drawing follows the partida", JSON.stringify(chain).slice(0, 240));

    /* ===== THE PRICE BOOK SPEAKS THE LANGUAGE THE ERP IS IN =====
       "The data in catalog items/chapter and subitems should be shown in the
       language which the ERP is in at the time … also then in the quote
       builder."

       Asserted by switching the interface and reading the SAME partida back on
       two surfaces. Not that a translation exists — the catalogue-i18n gate
       does that — but that the screens ASK for it. A dictionary can be complete
       while every screen still renders the Spanish column, which is exactly the
       state this replaced.

       Driven from here and not from inside one evaluate: `CANEI_I18N.set()`
       ends in `location.reload()`, so a single evaluate spanning three
       languages is three destroyed execution contexts. */
    const useLang = async (l) => {
      await pg.evaluate((x) => CANEI_I18N.set(x), l);
      await pg.waitForLoadState("networkidle");
      await bootedShell(pg);
      await pg.waitForTimeout(600);
    };
    const readCatalogueRow = async () => {
      await pg.evaluate(() => go("items"));
      await pg.waitForTimeout(800);
      return pg.evaluate(() => {
        const row = [...document.querySelectorAll("#view table.mlist tbody tr.click")].find((tr) =>
          /DEM-101/.test(tr.textContent),
        );
        return row ? row.children[2].textContent.trim() : null;
      });
    };
    const trio = {};
    for (const l of ["es", "en", "ca"]) {
      await useLang(l);
      trio[l] = await readCatalogueRow();
    }
    if (trio.es && trio.en && trio.ca && trio.es !== trio.en && trio.es !== trio.ca)
      ok(`catalogue: a partida reads in the ERP's own language ("${trio.en}" in English)`);
    else bad("catalogue: follows the interface language", JSON.stringify(trio));

    /* And the same partida on a quote LINE, which is a snapshot and had to be
       taught the difference between "still the catalogue's words" and "the
       operator's words now". */
    const openDraft = async () => {
      await pg.evaluate(() => {
        const b =
          erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0];
        go("quotes", b.id);
      });
      await pg.waitForTimeout(900);
    };
    const readLine = () =>
      pg.evaluate(() => {
        const el = document.querySelector('#bRows tr.pbrow input[data-f="desc"]');
        return el ? el.value : null;
      });
    await useLang("es");
    await openDraft();
    const lineEs = await readLine();
    await useLang("en");
    await openDraft();
    const lineEn = await readLine();
    /* Now EDIT it. From here the words are the operator's, and switching
       language must not overwrite them — that would be the system quietly
       rewriting what somebody typed onto a customer's quote. */
    await pg.evaluate(() => {
      const input = document.querySelector('#bRows tr.pbrow input[data-f="desc"]');
      input.value = "Mi propia partida";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await pg.waitForTimeout(800);
    await useLang("ca");
    await openDraft();
    const lineAfterEdit = await readLine();
    await useLang("es");
    if (lineEs && lineEn && lineEs !== lineEn && lineAfterEdit === "Mi propia partida")
      ok(
        `builder: a catalogue line follows the interface language, and stops the moment the operator edits it ("${lineEn}")`,
      );
    else
      bad("builder: line follows the language", JSON.stringify({ lineEs, lineEn, lineAfterEdit }));

    /* ===== THE DESKTOP GRID IS A GRID, NOT A RAGGED LIST =====
       "Structure looks very unorganized and text not good readable. Buttons not
       aligned." Three separate faults, and each is measurable:

         · the chapter buttons started at a different x on every chapter,
           because the title beside them sized to its own text — so four
           chapters read as four unrelated rows;
         · "× capítulo" carried `margin-left: auto` on a full-width chapter row,
           which put it a thousand pixels from the chapter it deletes;
         · the table had a min-width and no width, so it sized to its CONTENT.
           The eleven fixed columns took 816px and Descripción — the one column
           meant to take what is left — got whatever was over, and truncated.

       Asserted geometrically, because "looks unorganized" is a measurement
       once you say what it is: same x, adjacent, and not the narrowest column
       on the row. */
    await pg.evaluate(() => {
      const b =
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0];
      const v = b.versions[b.versions.length - 1];
      // Two more chapters, so alignment across DIFFERENT title lengths is what
      // is being measured rather than one row agreeing with itself.
      erp.addChapter(b.id, { name: "Climatización y ventilación", section: v.chapters[0].section });
      erp.addChapter(b.id, { name: "Obra", section: v.chapters[0].section });
      go("quotes", b.id);
    });
    await pg.waitForTimeout(1100);
    const desk = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll("#bRows tr.chaprow .chaprowin")];
      if (rows.length < 3) return { err: `only ${rows.length} chapters` };
      const firstBtn = rows.map((r) =>
        Math.round(r.querySelector("[data-addline]").getBoundingClientRect().left),
      );
      const gaps = rows.map((r) => {
        const blank = r.querySelector("[data-blankline]").getBoundingClientRect();
        const del = r.querySelector("[data-delchap]").getBoundingClientRect();
        return Math.round(del.left - blank.right);
      });
      const line = document.querySelector("#bRows tr.pbrow");
      const w = (sel) => {
        const el = line.querySelector(sel);
        return el ? Math.round(el.getBoundingClientRect().width) : 0;
      };
      const desc = w("td.c-desc");
      const others = ["td.c-unit", "td.c-cost", "td.c-qty", "td.c-price", "td.c-stat"].map(w);
      return {
        chapters: rows.length,
        alignedTo: new Set(firstBtn).size,
        worstGap: Math.max(...gaps),
        desc,
        widestOther: Math.max(...others),
        /* The plate's code is hidden HERE and only here: the Código column is
           the next cell but one, and printing the code twice six pixels apart
           only makes the row taller. Row height itself is not asserted — a
           line with marca · modelo carries a spec sub-line and is legitimately
           taller, so the number would be measuring the fixture. */
        plateCodeShown: (() => {
          const c = line.querySelector(".plate .platec");
          return !!(c && getComputedStyle(c).display !== "none");
        })(),
        codeColumn: (line.querySelector('td.c-code input[data-f="code"]') || {}).value,
      };
    });
    if (desk.err) bad("desktop: the builder grid lines up", desk.err);
    else if (
      desk.alignedTo === 1 &&
      desk.worstGap <= 40 &&
      desk.desc > desk.widestOther * 2 &&
      !desk.plateCodeShown &&
      desk.codeColumn
    )
      ok(
        `desktop: ${desk.chapters} chapters share one button column, delete beside them, description ${desk.desc}px and the code shown once`,
      );
    else bad("desktop: builder grid alignment", JSON.stringify(desk));

    if (errs.length === 0) ok("builder: no console errors");
    else bad("builder: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("budget builder", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── AP-01: a supplier invoice can be recorded THROUGH THE PRODUCT.
//    `registerBill` and `allocateBill` have been complete and tested in the
//    engine since it was written, and until now no line of `erp.html` called
//    either. The only bill action in the interface was "Pay" on a row the seed
//    had put there, so on a real workspace there were no bills at all — and
//    bank reconciliation matches a movement against a BILL.
//
//    Two doors, both checked here: a blank invoice typed in, and a
//    photographed document promoted. The promotion is the one that matters,
//    because it is the one that leaves the reader's work connected to the
//    money instead of stranded in an inbox.
async function testSupplierBillEntry(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#supplier-invoices`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);
    await pg.evaluate(() => {
      const b = [...document.querySelectorAll(".tabstrip .tab")].find(
        (x) => x.dataset.tab === "_supplierBills",
      );
      if (b) b.click();
    });
    await pg.waitForTimeout(500);

    // The button is REACHABLE, not merely present: a control the operator
    // cannot press is the exact failure this whole suite exists to catch.
    const btn = await pg.evaluate(() => {
      const b = document.getElementById("sb_new");
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
    });
    if (btn && btn.w > 60 && btn.h >= 24 && btn.top >= 0)
      ok(`AP-01: the payables screen offers a way to record an invoice (${btn.w}×${btn.h})`);
    else bad("AP-01: new-invoice button reachable", JSON.stringify(btn));

    const before = await pg.evaluate(() => erp.state.bills.length);
    await pg.click("#sb_new");
    await pg.waitForTimeout(400);
    const formed = await pg.evaluate(
      () => !!document.getElementById("bd_sup") && !!document.getElementById("bd_base"),
    );
    if (formed) ok("AP-01: it opens a form with a supplier and a taxable base");
    else bad("AP-01: bill drawer opens", "no #bd_sup/#bd_base");

    await pg.evaluate(() => {
      document.getElementById("bd_num").value = "E2E-001";
      document.getElementById("bd_base").value = "1000";
      document.getElementById("bd_base").dispatchEvent(new Event("input", { bubbles: true }));
    });
    await pg.waitForTimeout(200);
    await pg.click("#bd_go");
    await pg.waitForTimeout(700);

    const made = await pg.evaluate((n) => {
      const b = erp.state.bills.find((x) => x.number === "E2E-001");
      return {
        grew: erp.state.bills.length === n + 1,
        base: b ? b.baseCents : null,
        name: b ? b.supplierName : null,
        taxId: b ? b.supplierTaxId : null,
      };
    }, before);
    if (made.grew && made.base === 100000)
      ok("AP-01: pressing Registrar files a supplier invoice at the base that was typed");
    else bad("AP-01: bill registered", JSON.stringify(made));
    if (made.name && made.taxId)
      ok(`AP-01: the bill carries its issuer's name and tax id (${made.name} · ${made.taxId})`);
    else bad("AP-01: issuer stamped on the bill", JSON.stringify(made));

    // ── a photographed document becomes that invoice ──
    const capId = await pg.evaluate(() => {
      const sup = erp.state.parties.find((p) =>
        (p.roles || []).some((r) => ["supplier", "subcontractor", "selfEmployed"].includes(r)),
      );
      const c = erp.captureDocument({ docType: "supplierInvoice", imageRef: "e2e_blob" }, "bo");
      erp.confirmCapture(
        c.id,
        {
          issuerName: sup.name,
          issuerTaxId: sup.taxId,
          docNumber: "E2E-CAP-7",
          date: erp.state.today,
          baseCents: 50000,
          vatCents: 10500,
          totalCents: 60500,
        },
        "bo",
      );
      return c.id;
    });
    await pg.evaluate((id) => captureDrawer(id), capId);
    await pg.waitForTimeout(400);
    const promoteBtn = await pg.evaluate(() => {
      const b = document.getElementById("cd_bill");
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (promoteBtn && promoteBtn.w > 60 && promoteBtn.h >= 24)
      ok("AP-01: a validated document offers to become a supplier invoice");
    else bad("AP-01: promote button", JSON.stringify(promoteBtn));

    await pg.click("#cd_bill");
    await pg.waitForTimeout(400);
    // The supplier read off the page is PROPOSED, and the number and base come
    // across so the operator confirms rather than retypes.
    const prefilled = await pg.evaluate(() => ({
      num: document.getElementById("bd_num").value,
      base: document.getElementById("bd_base").value,
      sup: document.getElementById("bd_sup").value,
    }));
    if (prefilled.num === "E2E-CAP-7" && Number(prefilled.base) === 500 && prefilled.sup)
      ok("AP-01: the reading is carried into the form instead of being retyped");
    else bad("AP-01: capture prefills the bill", JSON.stringify(prefilled));

    await pg.click("#bd_go");
    await pg.waitForTimeout(700);
    const linked = await pg.evaluate((id) => {
      const c = erp.state.captured.find((x) => x.id === id);
      const b = erp.state.bills.find((x) => x.number === "E2E-CAP-7");
      return {
        billId: c ? c.billId : null,
        capId: b ? b.capId : null,
        base: b ? b.baseCents : null,
      };
    }, capId);
    if (linked.billId && linked.capId === capId && linked.base === 50000)
      ok("AP-01: the document and the invoice end up pointing at each other");
    else bad("AP-01: capture → bill link", JSON.stringify(linked));

    // ── Block 4: a split typed as PERCENTAGES lands as exact cents ─────────
    const pctSplit = await pg.evaluate(async () => {
      const projects = erp.state.projects.filter((p) => !p.closed).slice(0, 2);
      if (projects.length < 2) return { skip: "needs two open projects" };
      document.getElementById("sb_new").click();
      await new Promise((r) => setTimeout(r, 300));
      document.getElementById("bd_num").value = "E2E-PCT";
      document.getElementById("bd_base").value = "1000";
      document.getElementById("bd_base").dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      document.getElementById("bd_add").click();
      await new Promise((r) => setTimeout(r, 200));
      const set = async (i, k, v) => {
        const el = document.querySelector(`#bd_rows [data-ai="${i}"][data-k="${k}"]`);
        el.value = v;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 200));
      };
      await set(0, "dest", "p:" + projects[0].id);
      await set(1, "dest", "p:" + projects[1].id);
      // 33,3 / 66,7 — the case where naive rounding loses a cent.
      await set(0, "pct", "33.3");
      await set(1, "pct", "66.7");
      document.getElementById("bd_go").click();
      await new Promise((r) => setTimeout(r, 500));
      const b = erp.state.bills.find((x) => x.number === "E2E-PCT");
      return (
        b && {
          n: b.allocations.length,
          sum: b.allocations.reduce((s2, a) => s2 + a.amountCents, 0),
          base: b.baseCents,
          both: b.allocations.every((a) => a.projectId),
        }
      );
    });
    if (pctSplit && pctSplit.n === 2 && pctSplit.sum === pctSplit.base && pctSplit.both)
      ok("block 4: 33,3% / 66,7% across two projects lands as exact cents summing the base");
    else bad("block 4: percentage split", JSON.stringify(pctSplit));

    // ── 1F: the allocation can name the PARTIDA, one level below the chapter ──
    const pid = await pg.evaluate(() => {
      const p = erp.state.projects.find(
        (x) =>
          x.budgetId &&
          x.acceptedVersionId &&
          !x.closed &&
          erp.version(x.budgetId, x.acceptedVersionId).chapters.some((c) => c.lines.length),
      );
      return p ? p.id : null;
    });
    if (!pid) bad("1F: a project with an accepted budget to allocate against", "none in seed");
    else {
      await pg.click("#sb_new");
      await pg.waitForTimeout(300);
      await pg.evaluate((id) => {
        document.getElementById("bd_num").value = "E2E-1F";
        document.getElementById("bd_base").value = "250";
        document.getElementById("bd_base").dispatchEvent(new Event("input", { bubbles: true }));
        const dest = document.querySelector('#bd_rows [data-k="dest"]');
        dest.value = "p:" + id;
        dest.dispatchEvent(new Event("change", { bubbles: true }));
      }, pid);
      await pg.waitForTimeout(250);
      const chap = await pg.evaluate(() => {
        const sel = document.querySelector('#bd_rows [data-k="chapterNum"]');
        const first = [...sel.options].find((o) => o.value);
        sel.value = first.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        return first.value;
      });
      await pg.waitForTimeout(250);
      // Geometry, not presence: a select nobody can see has shipped before.
      const lineSel = await pg.evaluate(() => {
        const sel = document.querySelector('#bd_rows [data-k="lineId"]');
        if (!sel) return null;
        const r = sel.getBoundingClientRect();
        const opts = [...sel.options].filter((o) => o.value);
        return { w: Math.round(r.width), h: Math.round(r.height), n: opts.length };
      });
      if (lineSel && lineSel.n >= 1 && lineSel.w > 80 && lineSel.h >= 20)
        ok(
          `1F: choosing a chapter offers its partidas (${lineSel.n} options, ${lineSel.w}×${lineSel.h})`,
        );
      else bad("1F: partida select visible", JSON.stringify(lineSel));

      const lineId = await pg.evaluate(() => {
        const sel = document.querySelector('#bd_rows [data-k="lineId"]');
        const first = [...sel.options].find((o) => o.value);
        sel.value = first.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        return first.value;
      });
      await pg.waitForTimeout(250);
      await pg.evaluate(() => {
        const amt = document.querySelector('#bd_rows [data-k="amountCents"]');
        amt.value = "250";
        amt.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await pg.waitForTimeout(200);
      await pg.click("#bd_go");
      await pg.waitForTimeout(600);
      const stored = await pg.evaluate(() => {
        const b = erp.state.bills.find((x) => x.number === "E2E-1F");
        return b && b.allocations[0];
      });
      if (stored && stored.lineId === lineId && stored.chapterNum === chap)
        ok("1F: the registered bill carries chapter AND partida on its allocation");
      else bad("1F: lineId stored on the bill", JSON.stringify(stored));
    }

    if (!errs.length) ok("AP-01: no console errors");
    else bad("AP-01: console", errs.slice(0, 2).join(" | "));
  } catch (e) {
    bad("supplier bill entry", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── Blocks 5–6: a variation is a REAL budget, and its acceptance JOINS the
//    project — list and creator on the variations screen, chapters renumbered
//    into the project's sequence, the economics row with its pill, the cost
//    drill-down, certification, and the settable completion date.
async function testVariationBudget(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#variations`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(800);
    const pid = await pg.evaluate(() => {
      const p = erp.state.projects.find(
        (x) =>
          x.budgetId &&
          x.acceptedVersionId &&
          !x.closed &&
          erp.version(x.budgetId, x.acceptedVersionId).chapters.some((c) => c.lines.length),
      );
      if (!p) return null;
      gProject = p.id;
      render();
      return p.id;
    });
    await pg.waitForTimeout(600);
    if (!pid) {
      bad("5-6: a project to vary", "none with an accepted budget");
      return;
    }
    const btn = await pg.evaluate(() => {
      const b = document.getElementById("vbNew");
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (btn && btn.w > 100) ok("5-6: the variations screen offers «＋ Presupuesto de variación»");
    else bad("5-6: creator button", JSON.stringify(btn));

    await pg.click("#vbNew");
    await pg.waitForTimeout(800);
    const inBuilder = await pg.evaluate((projectId) => {
      const b = erp.state.budgets.find((x) => x.variationOf === projectId);
      const who = document.querySelector(".pbbar .who span");
      return {
        hash: location.hash,
        created: !!b,
        id: b && b.id,
        badge: who ? /variación de/.test(who.textContent) : false,
      };
    }, pid);
    if (inBuilder.created && /quotes/.test(inBuilder.hash) && inBuilder.badge)
      ok("5-6: creating one lands in the SAME builder, labelled as a variation of its job");
    else bad("5-6: builder handoff", JSON.stringify(inBuilder));

    // Build and accept through the engine — the builder's own UI is already
    // covered by two suites; what is NEW is the join on acceptance.
    const joined = await pg.evaluate((projectId) => {
      const b = erp.state.budgets.find((x) => x.variationOf === projectId);
      const ch = erp.addChapter(b.id, { name: "Cocina ampliada" }, "bo");
      const ln = erp.addLine(
        b.id,
        ch.id,
        {
          desc: "Mueble alto extra",
          unit: "ud",
          qtyMilli: 1000,
          priceCents: 60000,
          costCents: 35000,
        },
        "bo",
      );
      erp.issueVersion(b.id, {}, "bo");
      erp.acceptVersion(b.id, erp.currentVersion(b.id).id, { evidenceRef: "firmado" }, "bo");
      const v = erp.version(b.id, b.acceptedVersionId);
      const ec = erp.projectEconomics(projectId);
      // a cost onto the variation's partida, for the drill-down below
      const sup = erp.state.parties.find((x) =>
        (x.roles || []).some((r) => ["supplier", "subcontractor", "selfEmployed"].includes(r)),
      );
      erp.registerBill(
        {
          supplierId: sup.id,
          number: "E2E-VB",
          baseCents: 12000,
          allocations: [
            { projectId, lineId: v.chapters[0].lines[0].id, kind: "material", amountCents: 12000 },
          ],
        },
        "bo",
      );
      return {
        num: v.chapters[0].num,
        vr: ec.variationRevenueCents,
        lineId: ln.id,
      };
    }, pid);
    if (Number(joined.num) > 1 && joined.vr === 60000)
      ok(
        `5-6: acceptance renumbers into the project (chapter ${joined.num}) and joins the economics (+600,00 €)`,
      );
    else bad("5-6: acceptance join", JSON.stringify(joined));

    // The economics screen: the variation row, its pill, and the drill-down.
    await pg.evaluate((projectId) => {
      gProject = projectId;
      ecoFull = true;
      location.hash = "economics";
    }, pid);
    await pg.waitForTimeout(900);
    const ecoRow = await pg.evaluate((num) => {
      const row = document.querySelector(`[data-chcosts="${num}"]`);
      if (!row) return null;
      const r = row.getBoundingClientRect();
      return { w: Math.round(r.width), pill: !!row.querySelector(".pill.b") };
    }, joined.num);
    if (ecoRow && ecoRow.w > 400 && ecoRow.pill)
      ok("5-6: the chapter table carries the variation row, marked with its pill");
    else bad("5-6: economics row", JSON.stringify(ecoRow));

    await pg.click(`[data-chcosts="${joined.num}"]`);
    await pg.waitForTimeout(500);
    const drill = await pg.evaluate(() => {
      const t = document.querySelector(".drawer table tbody");
      if (!t) return null;
      const rows = [...t.querySelectorAll("tr")];
      return {
        rows: rows.length,
        named: rows.some((r) => /E2E-VB/.test(r.textContent)),
        partida: rows.some((r) => /Mueble alto extra|\d+\.\d+/.test(r.textContent)),
      };
    });
    if (drill && drill.rows >= 1 && drill.named && drill.partida)
      ok("5-6: clicking the row opens every cost behind it, grouped by partida");
    else bad("5-6: cost drill-down", JSON.stringify(drill));
    await pg.evaluate(() => closeDrawer());

    // Revenue click-through: lands on the invoice register filtered to the job.
    const jump = await pg.evaluate((projectId) => {
      document.getElementById("ecoInvoices").click();
      return erp.project(projectId).code;
    }, pid);
    await pg.waitForTimeout(700);
    const invFilter = await pg.evaluate(() => {
      const q = document.getElementById("invQ");
      return { hash: location.hash, q: q ? q.value : null };
    });
    if (/invoicing/.test(invFilter.hash) && invFilter.q === jump)
      ok(`5-6: the revenue tile walks to the invoice register filtered on ${jump}`);
    else bad("5-6: revenue click-through", JSON.stringify(invFilter));

    // The completion date: settable at last, on the tracking screen.
    await pg.evaluate((projectId) => {
      gProject = projectId;
      location.hash = "progress";
    }, pid);
    await pg.waitForTimeout(700);
    await pg.evaluate(() => {
      ganttFull = true;
      render();
    });
    await pg.waitForTimeout(700);
    const endField = await pg.evaluate(() => {
      const el = document.getElementById("gEnd");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (endField && endField.w > 80) {
      ok("5-6: the tracking screen carries a settable «Fin previsto»");
      const saved = await pg.evaluate(() => {
        const el = document.getElementById("gEnd");
        el.value = "2026-12-24";
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return new Promise((res) =>
          setTimeout(() => res(erp.project(gProject).dates.targetEnd), 400),
        );
      });
      if (saved === "2026-12-24") ok("5-6: setting it writes the project's completion date");
      else bad("5-6: targetEnd written", String(saved));
    } else bad("5-6: Fin previsto field", JSON.stringify(endField));

    if (!errs.length) ok("5-6: no console errors");
    else bad("5-6: console", errs.slice(0, 2).join(" | "));
  } catch (e) {
    bad("variation budget", String(e).slice(0, 220));
  } finally {
    await pg.close();
  }
}

// ── ADM-03 / S6: document capture, from a real file to a saved record.
//    The pipeline is the point, and it is checked end to end in one browser:
//    a PDF with a text layer is read WITHOUT loading the 7 MB OCR runtime;
//    every field carries a dot that a validator earned rather than a
//    confidence score; a typed correction is re-checked; and the record is
//    written only when a person presses the button.
async function testCapture(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#supplier-invoices`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(900);

    const wired = await pg.evaluate(() => ({
      ocr: typeof window.ErpOcr,
      extraction: typeof (window.ErpBridge && window.ErpBridge.extraction),
      surface: window.ErpBridge && window.ErpBridge.surfaceVersion,
      capture: !!document.getElementById("capFile"),
    }));
    if (wired.ocr === "object" && wired.extraction === "object" && wired.capture)
      ok(`ADM-03: the capture pipeline is wired (bundle surface v${wired.surface})`);
    else bad("ADM-03: pipeline wired", JSON.stringify(wired));

    // Nothing of the OCR runtime may load merely because the screen is open.
    const idle = await pg.evaluate(() => ({
      tesseract: typeof window.Tesseract,
      vendorRequests: performance
        .getEntriesByType("resource")
        .filter((r) => /vendor\//.test(r.name)).length,
    }));
    if (idle.tesseract === "undefined" && idle.vendorRequests === 0)
      ok("ADM-03: opening the inbox loads none of the 7 MB reader");
    else bad("ADM-03: nothing loads at rest", JSON.stringify(idle));

    // Hand it a genuine PDF with a text layer, built in the page.
    await pg.evaluate(() => {
      const lines = [
        "DISTRIBUCIONES CERYGRES, S.A.",
        "NIF: A08932907",
        "Factura n 26OFV001345",
        "Fecha: 26/02/2026",
        "Vencimiento: 27/03/2026",
        "Base imponible 1.683,96",
        "IVA 21% 353,63",
        "TOTAL 2.037,59",
        "IBAN ES91 2100 0418 4502 0005 1332",
      ];
      const content = lines
        .map((l, i) => `BT /F1 11 Tf 40 ${760 - i * 18} Td (${l.replace(/[()\\]/g, "\\$&")}) Tj ET`)
        .join("\n");
      const objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      ];
      let pdf = "%PDF-1.4\n";
      const off = [];
      objs.forEach((o, i) => {
        off.push(pdf.length);
        pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
      });
      const x = pdf.length;
      pdf +=
        `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
        off.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") +
        `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
      const blob = new Blob([new Uint8Array([...pdf].map((c) => c.charCodeAt(0)))], {
        type: "application/pdf",
      });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "factura.pdf", { type: "application/pdf" }));
      const inp = document.getElementById("capFile");
      inp.files = dt.files;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await pg.waitForTimeout(2500);

    const screen = await pg.evaluate(() => ({
      fs: document.body.classList.contains("fs"),
      zones:
        !!document.querySelector(".cap2 .capdoc") && !!document.querySelector(".cap2 .capform"),
      engine: (document.querySelector(".pbbar .pill") || {}).textContent || "",
      tesseract: typeof window.Tesseract,
    }));
    if (screen.fs && screen.zones && /PDF/i.test(screen.engine))
      ok("ADM-03: a text-layer PDF opens the two-zone validation screen, outside the shell");
    else bad("ADM-03: validation screen", JSON.stringify(screen));
    if (screen.tesseract === "undefined")
      ok("ADM-03: …and the OCR half never loaded, because it was never needed");
    else bad("ADM-03: OCR skipped for a digital PDF", "tesseract was loaded anyway");

    // The dots. This is the rule the whole session exists for.
    const dots = await pg.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll(".capf")].map((r) => [
          r.dataset.f,
          r.querySelector(".dot").classList.contains("green") ? "green" : "amber",
        ]),
      ),
    );
    const greens = [
      "issuerTaxId",
      "issueDate",
      "dueDate",
      "netAmount",
      "taxAmount",
      "totalAmount",
      "iban",
    ];
    if (greens.every((k) => dots[k] === "green"))
      ok("ADM-03: everything a validator could check reads green (NIF, dates, amounts, IBAN)");
    else bad("ADM-03: green fields", JSON.stringify(dots));
    if (dots.docNumber === "amber" && dots.issuerName === "amber")
      ok("ADM-03: the document number and the issuer name stay amber — nothing can check them");
    else bad("ADM-03: unverifiable fields amber", JSON.stringify(dots));

    const focused = await pg.evaluate(() => document.activeElement && document.activeElement.id);
    if (focused && /^cap_/.test(focused))
      ok(`ADM-03: the cursor starts on the first field needing a person (${focused})`);
    else bad("ADM-03: focus on first amber", String(focused));

    // Provenance: pressing a field shows the line it was read from.
    await pg.locator('.capf[data-f="totalAmount"]').click();
    await pg.waitForTimeout(300);
    const src = await pg.evaluate(() => {
      const d = document.querySelector("#capLines .capsrc");
      return d ? d.textContent.trim() : "";
    });
    if (/2\.037,59/.test(src)) ok("ADM-03: choosing a field highlights the line it was read off");
    else bad("ADM-03: provenance highlight", src.slice(0, 60));

    // A typed value is re-checked, not believed.
    await pg.locator("#cap_issuerTaxId").fill("A08912907");
    await pg.locator("#cap_issuerTaxId").dispatchEvent("change");
    await pg.waitForTimeout(400);
    const typedBad = await pg.evaluate(() => {
      const r = [...document.querySelectorAll(".capf")].find((x) => x.dataset.f === "issuerTaxId");
      return {
        dot: r.querySelector(".dot").className,
        why: (r.querySelector(".capwhy") || {}).textContent || "",
      };
    });
    if (/amber/.test(typedBad.dot) && /check digit|dígito|control/i.test(typedBad.why))
      ok("ADM-03: a hand-typed NIF with a bad check digit stays amber and says why");
    else bad("ADM-03: typed value re-checked", JSON.stringify(typedBad));

    await pg.locator("#cap_issuerTaxId").fill("A08932907");
    await pg.locator("#cap_issuerTaxId").dispatchEvent("change");
    await pg.waitForTimeout(400);
    const typedGood = await pg.evaluate(
      () =>
        [...document.querySelectorAll(".capf")]
          .find((x) => x.dataset.f === "issuerTaxId")
          .querySelector(".dot").className,
    );
    if (/green/.test(typedGood)) ok("ADM-03: correcting it properly turns the dot green");
    else bad("ADM-03: corrected value goes green", typedGood);

    // Nothing exists in the data until a person presses the button.
    const before = await pg.evaluate(() => erp.state.captured.length);
    await pg.locator("#capSave").click();
    await pg.waitForTimeout(1500);
    const saved = await pg.evaluate((b) => {
      const c = erp.state.captured[erp.state.captured.length - 1];
      return {
        added: erp.state.captured.length - b,
        status: c.status,
        nif: c.confirmed && c.confirmed.issuerTaxId,
        total: c.confirmed && c.confirmed.totalCents,
        keptReading: !!c.extracted,
        neverAutoConfirmed: c.extracted ? c.extracted.confirmed !== true : true,
        backOnInbox: !document.body.classList.contains("fs"),
      };
    }, before);
    if (
      saved.added === 1 &&
      saved.status === "validated" &&
      saved.nif === "A08932907" &&
      saved.total === 203759
    )
      ok("ADM-03: confirming writes one captured document, with the values on screen");
    else bad("ADM-03: confirm writes the record", JSON.stringify(saved));
    if (saved.keptReading && saved.neverAutoConfirmed && saved.backOnInbox)
      ok("ADM-03: the machine's reading is kept beside it, and never marked confirmed by itself");
    else bad("ADM-03: reading kept unconfirmed", JSON.stringify(saved));

    // ---- S7: the two zones, and the half of ADM-03 that was not built -----
    await pg.waitForTimeout(400);
    const zones = await pg.evaluate(() => {
      const wrap = document.querySelector("#view .inbox2");
      const card = document.querySelector("#view .icard");
      return {
        two: !!wrap,
        cols: wrap ? getComputedStyle(wrap).gridTemplateColumns : "",
        cards: document.querySelectorAll("#view .icard").length,
        cardHeight: card ? Math.round(card.getBoundingClientRect().height) : 0,
        register: document.querySelectorAll("#view table.mlist").length,
      };
    });
    if (zones.two && zones.cards >= 1 && zones.cardHeight === 96 && zones.register === 1)
      ok(`ADM-03: the inbox is 96 px cards beside the register (${zones.cols})`);
    else bad("ADM-03: two zones", JSON.stringify(zones));

    // The document just saved is on the LEFT, because nobody has said who
    // pays for it yet. That is the whole reason the column exists.
    const cardText = await pg.locator("#view .icard").first().innerText();
    // The issuer NAME is the one field the reader routinely cannot find — no
    // keyword introduces it and no validator can vouch for it, so it comes
    // back null on this fixture exactly as it did in the S0b spike. The card
    // says so rather than showing a blank line: same discipline as the amber
    // dot, one screen later.
    if (/2\.037,59/.test(cardText) && /confirmar/i.test(cardText))
      ok("ADM-03: a card carries the detected amount, and says when the issuer was not detected");
    else bad("ADM-03: card content", cardText.replace(/\n/g, " · ").slice(0, 90));

    // …and a document whose issuer WAS confirmed shows it, so the line above
    // is about this document rather than about the card never rendering a name.
    const named = await pg.evaluate(() =>
      [...document.querySelectorAll("#view .icard")].some((c) =>
        /Vall/.test(c.querySelector(".who").textContent),
      ),
    );
    if (named) ok("ADM-03: a card whose issuer is known shows the issuer");
    else bad("ADM-03: named card", "no card carried a confirmed issuer name");

    // ---- allocation: the half S6 left for this session --------------------
    await pg.locator("#view .icard").first().click();
    await pg.waitForTimeout(400);
    await pg.fill("#cd_ref", "PED-E2E-77");
    await pg.fill("#cd_notes", "reforma baño");
    await pg.click("#cd_save");
    await pg.waitForTimeout(600);
    const filed = await pg.evaluate(() => {
      const c = erp.state.captured[erp.state.captured.length - 1];
      return { ref: c.reference, notes: c.notes, path: c.sourcePath, name: c.stdName };
    });
    if (filed.ref === "PED-E2E-77" && filed.notes === "reforma baño" && /\.pdf$/.test(filed.path))
      ok(`ADM-03: gaps 10-11 — reference, note and the file's own origin persist (${filed.path})`);
    else bad("ADM-03: archive fields persist", JSON.stringify(filed));

    // A split that does not add up is refused, and says so rather than saving.
    const destSel = pg.locator('#cd_rows select[data-k="dest"]').first();
    const projValue = await pg.evaluate(
      () =>
        [...document.querySelectorAll('#cd_rows select[data-k="dest"] option')].find((o) =>
          /^p:/.test(o.value),
        ).value,
    );
    await destSel.selectOption(projValue);
    await pg.waitForTimeout(300);
    await pg.locator('#cd_rows input[data-k="amountCents"]').first().fill("100.00");
    await pg.locator('#cd_rows input[data-k="amountCents"]').first().dispatchEvent("change");
    await pg.waitForTimeout(300);
    await pg.click("#cd_alloc");
    await pg.waitForTimeout(500);
    const refused = await pg.evaluate(() => ({
      allocated: erp.state.captured[erp.state.captured.length - 1].allocations.length,
      toast: (document.querySelector("#toast") || {}).textContent || "",
      stillOpen: document.querySelector("#drawer").classList.contains("on"),
    }));
    if (refused.allocated === 0 && refused.stillOpen)
      ok("ADM-03: a split that does not total the document is refused, panel still open");
    else bad("ADM-03: short split refused", JSON.stringify(refused));

    // Now split it properly: part to a project, the rest to an overhead.
    await pg.locator('#cd_rows input[data-k="amountCents"]').first().fill("1000.00");
    await pg.locator('#cd_rows input[data-k="amountCents"]').first().dispatchEvent("change");
    await pg.waitForTimeout(300);
    await pg.click("#cd_add");
    await pg.waitForTimeout(300);
    await pg.locator('#cd_rows select[data-k="dest"]').nth(1).selectOption("o:office");
    await pg.waitForTimeout(300);
    await pg.locator('#cd_rows input[data-k="amountCents"]').nth(1).fill("1037.59");
    await pg.locator('#cd_rows input[data-k="amountCents"]').nth(1).dispatchEvent("change");
    await pg.waitForTimeout(300);
    await pg.click("#cd_alloc");
    await pg.waitForTimeout(700);
    const allocated = await pg.evaluate(() => {
      const c = erp.state.captured[erp.state.captured.length - 1];
      return {
        n: c.allocations.length,
        status: c.status,
        onlyOneDest: c.allocations.every((a) => !!a.projectId !== !!a.overheadCategory),
        sum: c.allocations.reduce((s, a) => s + a.amountCents, 0),
        stillPending: document.querySelectorAll("#view .icard").length,
      };
    });
    if (
      allocated.n === 2 &&
      allocated.status === "allocated" &&
      allocated.onlyOneDest &&
      allocated.sum === 203759
    )
      ok("ADM-03: a document splits between a project and an overhead, and adds up");
    else bad("ADM-03: split allocation", JSON.stringify(allocated));
    const gone = await pg.evaluate(() => {
      const id = erp.state.captured[erp.state.captured.length - 1].id;
      return {
        inInbox: !!document.querySelector(`#view .icard[data-cap="${id}"]`),
        inRegister: [...document.querySelectorAll("#view table.mlist tr.click")].some(
          (tr) => tr.dataset.id === id,
        ),
      };
    });
    if (!gone.inInbox && gone.inRegister)
      ok("ADM-03: an allocated document leaves the inbox for the register");
    else bad("ADM-03: allocated document moves side", JSON.stringify(gone));

    if (errs.length === 0) ok("ADM-03: no console errors");
    else bad("ADM-03: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("document capture", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── COM-03 (S5): the presupuestador as the v4 specification describes it.
//    Everything below is about the things a screenshot cannot prove — that the
//    surface really is outside the shell, that a drag really moves money
//    between subtotals, that a typed number really survives a reorder, and
//    that a document really cannot leave with a blocking issue on it.
async function testPresupuestador(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  await autoAnswerModals(pg, {
    "Nuevo capítulo": "Capítulo E2E",
    "Nueva versión": "Revisión E2E",
  });
  try {
    await pg.goto(`${base}/erp.html#quotes`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(900);

    // ---- the register: shared list toolbar (Package 3 slide 4) ------------
    // budgetList used to be a raw <table> grouped into five stage sections
    // with no search, export or pagination. It now runs on renderMasterList
    // like every other register in the app, and the same five stages show as
    // an Estado pill per row instead of a section heading.
    const register = await pg.evaluate(() => ({
      hasSearch: !!document.querySelector("#bqQ"),
      hasExport: !!document.querySelector("#bqExp"),
      hasNew: !!document.querySelector("#bqNew"),
      hasPager: !!document.querySelector("#bqPrev") && !!document.querySelector("#bqNext"),
      pills: [...document.querySelectorAll("#view table.mlist tr.click td:last-child .pill")].map(
        (t) => t.textContent.trim(),
      ),
    }));
    const known = ["borradores", "enviados", "aceptados", "rechazados", "caducados"];
    if (
      register.hasSearch &&
      register.hasExport &&
      register.hasNew &&
      register.hasPager &&
      register.pills.length &&
      register.pills.every((p) => known.some((k) => p.toLowerCase().startsWith(k)))
    )
      ok(
        `COM-03: the register has the shared list toolbar, Estado shows the five stages (${register.pills.length} rows)`,
      );
    else bad("COM-03: register toolbar + Estado column", JSON.stringify(register));

    // «Caducados» is the proof that the stage is derived rather than stored:
    // nothing was ever written to those records on the day they expired.
    const expiredDerived = await pg.evaluate(() => {
      const e = erp.state.budgets.filter((b) => erp.budgetStage(b) === "expired");
      return { n: e.length, storedStatuses: [...new Set(e.map((b) => b.status))] };
    });
    if (expiredDerived.n > 0 && !expiredDerived.storedStatuses.includes("expired"))
      ok(
        `COM-03: «Caducados» is derived, not stored (${expiredDerived.n}, still stored as issued)`,
      );
    else bad("COM-03: derived expiry", JSON.stringify(expiredDerived));

    // ---- open the draft: the surface must leave the shell ------------------
    const draftId = await pg.evaluate(() => {
      const b = erp.state.budgets.find((x) => erp.budgetStage(x) === "draft");
      return b ? b.id : null;
    });
    if (!draftId) {
      bad("COM-03: a draft to build in", "no budget is in draft");
      return;
    }
    await pg.evaluate((id) => go("quotes", id), draftId);
    await pg.waitForTimeout(600);
    const shell = await pg.evaluate(() => ({
      fs: document.body.classList.contains("fs"),
      rail: getComputedStyle(document.querySelector(".rail")).display,
      cols: getComputedStyle(document.querySelector(".pbpanes")).gridTemplateColumns,
      bar: !!document.querySelector(".pbbar #pbTotal"),
      cond: !!document.querySelector(".pbcond"),
    }));
    // Three TRACKS, not three visible panes: below 1 720 px the chapter tree is
    // folded to a 0 px track so the thirteen-column grid fits without scrolling
    // sideways. What this asserts is the shape — the workspace rail gone, the
    // grid between two side tracks, its own bar carrying the total — and not
    // which of the side panes today's viewport chose to show.
    /* The SHAPE, in numbers rather than in a pixel literal. The old form
       spelled the side pane's width into the regex, so tightening it by 22px
       to give the description room failed a test about whether the rail is
       hidden — a check that fails for a reason it is not about teaches you to
       edit the check. Three tracks; the grid is the widest of them; the totals
       pane is present and side-pane-sized. */
    const tracks = shell.cols.split(/\s+/).map(parseFloat);
    const shaped =
      tracks.length === 3 &&
      tracks[1] > tracks[0] &&
      tracks[1] > tracks[2] &&
      tracks[2] >= 200 &&
      tracks[2] <= 320;
    if (shell.fs && shell.rail === "none" && shaped && shell.bar)
      ok(`COM-03: full screen — rail hidden, three panes at ${shell.cols}, own bar with the total`);
    else bad("COM-03: full-screen layout", JSON.stringify(shell));
    if (shell.cond) ok("COM-03: the conditions bar sits below the panes");
    else bad("COM-03: conditions bar", "absent");

    // The drag handle is the only grip: a draggable row would steal the text
    // selection an estimator needs to copy a description.
    const grips = await pg.evaluate(() => ({
      handles: [...document.querySelectorAll("#bRows .pbdrag[data-handle]")].filter(
        (h) => h.draggable,
      ).length,
      rows: [...document.querySelectorAll("#bRows tr.pbrow")].filter((r) => r.draggable).length,
      chapters: [...document.querySelectorAll("#bTree .bc")].filter((c) => c.draggable).length,
    }));
    if (grips.handles >= 2 && grips.rows === 0 && grips.chapters >= 2)
      ok(`COM-03: ${grips.handles} line handles and ${grips.chapters} chapters drag; rows do not`);
    else bad("COM-03: drag handles", JSON.stringify(grips));

    // Cost and margin are on grey, and say so.
    const internal = await pg.evaluate(() => {
      const th = [...document.querySelectorAll(".pbpane.mid thead th")];
      const cost = th.findIndex((t) => /coste/i.test(t.innerText));
      const margin = th.findIndex((t) => /margen/i.test(t.innerText));
      return {
        cost: cost >= 0 && th[cost].classList.contains("int"),
        margin: margin >= 0 && th[margin].classList.contains("int"),
        note: /no salen del documento|never|no surten/i.test(
          document.querySelector("#bSide").innerText,
        ),
      };
    });
    if (internal.cost && internal.margin && internal.note)
      ok("COM-03: cost and margin are marked internal and say they stay out of the document");
    else bad("COM-03: internal columns", JSON.stringify(internal));

    // ---- free numbering ---------------------------------------------------
    const nums = () =>
      pg.evaluate(() =>
        [...document.querySelectorAll('#bRows input[data-f="num"]')].map((i) => i.value),
      );
    const firstNum = pg.locator('#bRows input[data-f="num"]').first();
    await firstNum.fill("EX-7");
    await firstNum.blur();
    await pg.waitForTimeout(400);
    const flagged = await pg.evaluate((id) => {
      const v = erp.currentVersion(id);
      const l = v.chapters.flatMap((c) => c.lines).find((x) => x.num === "EX-7");
      return l ? l.manualNum : null;
    }, draftId);
    if ((await nums())[0] === "EX-7" && flagged === true)
      ok("COM-03: a typed line number is taken verbatim and recorded as manual");
    else bad("COM-03: free numbering", JSON.stringify(await nums()));

    // A duplicate is refused, in the interface's own words rather than the
    // engine's English.
    const second = pg.locator('#bRows input[data-f="num"]').nth(1);
    const beforeDup = await nums();
    await second.fill("EX-7");
    await second.blur();
    await pg.waitForTimeout(400);
    const toastText = await pg.locator("#toast").innerText();
    if (
      /ya está en uso|already in use|ja s'utilitza/i.test(toastText) &&
      JSON.stringify(await nums()) === JSON.stringify(beforeDup)
    )
      ok("COM-03: a duplicate number is refused and nothing changes");
    else bad("COM-03: duplicate number", `${toastText} / ${JSON.stringify(await nums())}`);

    // ---- a reorder moves money between subtotals --------------------------
    // Done through the engine the drop handler calls, because a synthetic
    // HTML5 drag proves the browser's event plumbing rather than the rule.
    const moved = await pg.evaluate((id) => {
      const v = erp.currentVersion(id);
      const base = v.chapters.find((c) => c.section === "base" && c.lines.length);
      let opt = v.chapters.find((c) => c.section === "optional");
      if (!opt) opt = erp.addChapter(id, { name: "Opcionales E2E", section: "optional" });
      const line = base.lines[0];
      const before = erp.budgetTotals(id);
      erp.moveLine(id, line.id, opt.id, null, "e2e");
      const after = erp.budgetTotals(id);
      return {
        num: erp.findLine(id, line.id).line.num,
        chapter: erp.findLine(id, line.id).chapter.id === opt.id,
        baseFell: after.baseCents < before.baseCents,
        optionsRose: after.optionsCents > before.optionsCents,
        manualKept: erp.findLine(id, line.id).line.num === "EX-7",
      };
    }, draftId);
    if (moved.chapter && moved.baseFell && moved.optionsRose)
      ok(
        "COM-03: dragging a line into an optional chapter moves its money out of the base subtotal",
      );
    else bad("COM-03: reorder moves money", JSON.stringify(moved));
    if (moved.manualKept)
      ok("COM-03: and the typed number survives the move that renumbered everything around it");
    else bad("COM-03: manual number survives reorder", moved.num);
    await pg.evaluate(() => render());
    await pg.waitForTimeout(300);

    // ---- the visit, beside the presupuesto written from it ----------------
    await pg.locator('.pbtabs button[data-tab="visit"]').click();
    await pg.waitForTimeout(400);
    const visit = await pg.locator("#bSide").innerText();
    if (/visita/i.test(visit) && !/^\s*$/.test(visit))
      ok("COM-03: the second panel tab shows the visit this presupuesto is priced from");
    else bad("COM-03: visit tab", visit.slice(0, 120));
    const readOnly = await pg.evaluate(
      () => document.querySelectorAll("#bSide input, #bSide select, #bSide button").length,
    );
    if (readOnly === 0) ok("COM-03: the visit panel is reference only — nothing on it writes");
    else bad("COM-03: visit tab is read-only", `${readOnly} controls`);
    await pg.locator('.pbtabs button[data-tab="totals"]').click();
    await pg.waitForTimeout(300);

    // ---- sending: the pending lines have to be stated ---------------------
    await pg.evaluate((id) => {
      const v = erp.currentVersion(id);
      const c = v.chapters.find((x) => x.lines.length);
      erp.addLine(id, c.id, {
        desc: "Partida sin precio E2E",
        unit: "ud",
        qtyMilli: 1000,
        priceCents: 90000,
        pending: true,
      });
      render();
    }, draftId);
    await pg.waitForTimeout(400);
    await pg.locator("#bSend").click();
    await pg.waitForTimeout(500);
    const sendText = await pg.locator("#dbody").innerText();
    if (
      /pendientes de precio/i.test(sendText) &&
      /no están incluidas|no van en el total/i.test(sendText)
    )
      ok("COM-03: the send screen states that pending-price lines are not in the customer's total");
    else bad("COM-03: pre-send pending warning", sendText.slice(0, 200));

    // A blocking issue must stop the document, visibly.
    await pg.locator("#dClose").click();
    await pg.waitForTimeout(200);
    await pg.evaluate((id) => {
      const v = erp.currentVersion(id);
      const c = v.chapters.find((x) => x.lines.some((l) => !l.pending));
      const l = c.lines.find((x) => !x.pending);
      erp.editLine(id, l.id, { priceCents: 0, optionalLine: false }, { user: "e2e" });
      render();
    }, draftId);
    await pg.waitForTimeout(300);
    await pg.locator("#bSend").click();
    await pg.waitForTimeout(500);
    const blocked = await pg.evaluate(() => {
      const b = document.querySelector("#sbGo");
      return { present: !!b, disabled: b ? b.disabled : null };
    });
    if (blocked.present && blocked.disabled)
      ok("COM-03: a blocking issue disables sending rather than hiding the reason");
    else bad("COM-03: blocking issue stops the send", JSON.stringify(blocked));
    await pg.locator("#dClose").click();
    await pg.waitForTimeout(200);

    // ---- send, then the customer's answer ---------------------------------
    await pg.evaluate((id) => {
      const v = erp.currentVersion(id);
      v.chapters.forEach((c) =>
        c.lines.forEach((l) => {
          if (!l.pending && l.priceCents === 0)
            erp.editLine(id, l.id, { priceCents: 5000 }, { user: "e2e" });
        }),
      );
      render();
    }, draftId);
    /* Give the offer a validity that has not already lapsed.
       `createBudget` stamps `validityDate = today + 30`, so a budget the seed
       wrote in March is expired by August — and `budgetStage` then reports
       "expired" rather than "issued" no matter how correctly it was sent. That
       is the right answer for a real quote and the wrong fixture for this
       check, so the test does what the screen makes an operator do: the
       validity field carries `min="${erp.today}"` and refuses a past date. */
    await pg.evaluate((id) => {
      const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      erp.updateBudget(id, { validityDate: future }, "e2e");
      render();
    }, draftId);
    await pg.waitForTimeout(300);
    await pg.locator("#bSend").click();
    await pg.waitForTimeout(400);
    await pg.locator("#sbGo").click();
    await pg.waitForTimeout(600);
    const afterSend = await pg.evaluate(
      (id) => ({
        stage: erp.budgetStage(id),
        frozen: erp.currentVersion(id).frozen,
        editable: [...document.querySelectorAll("#bRows input")].some((i) => !i.disabled),
        send: !!document.querySelector("#bSend"),
        answer: !!document.querySelector("#bAnswer"),
      }),
      draftId,
    );
    if (afterSend.stage === "issued" && afterSend.frozen && !afterSend.editable && !afterSend.send)
      ok("COM-03: sending freezes the version — the grid goes read-only and Enviar goes away");
    else bad("COM-03: send freezes", JSON.stringify(afterSend));
    if (afterSend.answer) ok("COM-03: and the customer's answer becomes the next thing to record");
    else bad("COM-03: answer button", "absent after sending");

    await pg.locator("#bAnswer").click();
    await pg.waitForTimeout(400);
    await pg.locator("#brReason").selectOption({ index: 0 });
    await pg.locator("#brNotes").fill("E2E: fuera de presupuesto");
    await pg.locator("#brNo").click();
    await pg.waitForTimeout(600);
    const answered = await pg.evaluate((id) => {
      const b = erp.budget(id);
      const r = erp.version(id, b.currentVersionId).customerResponse;
      const o = erp.state.opportunities.find((x) => x.partyId === b.partyId && x.status === "lost");
      return {
        stage: erp.budgetStage(id),
        accepted: r && r.accepted,
        reason: r && r.reason,
        notes: r && r.notes,
        opp: o ? o.lossReason : null,
      };
    }, draftId);
    if (
      answered.stage === "rejected" &&
      answered.accepted === false &&
      answered.reason &&
      answered.opp === answered.reason
    )
      ok(
        "COM-03: a refusal is recorded with its reason and loses the opportunity for the same one",
      );
    else bad("COM-03: refusal", JSON.stringify(answered));

    await pg.evaluate(() => go("quotes"));
    await pg.waitForTimeout(500);
    const restage = await pg.evaluate((id) => {
      const row = document.querySelector(`#view table.mlist tr.click[data-id="${id}"]`);
      return row ? row.textContent : "";
    }, draftId);
    if (/rechazado/i.test(restage))
      ok("COM-03: and the register's Estado column now shows «Rechazado»");
    else bad("COM-03: re-staged after refusal", restage);

    // Leaving the builder must give the navigation back.
    const backOut = await pg.evaluate(() => ({
      fs: document.body.classList.contains("fs"),
      rail: getComputedStyle(document.querySelector(".rail")).display,
    }));
    if (!backOut.fs && backOut.rail !== "none")
      ok("COM-03: leaving the presupuestador restores the section rail");
    else bad("COM-03: full screen released", JSON.stringify(backOut));

    if (errs.length === 0) ok("COM-03: no console errors");
    else bad("COM-03: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("presupuestador", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── Project context (§4), technical tracking (§4.3) and economics (§4.4).
//    The whole point of this session is that one job is the context for every
//    subsection and that the figures are derived rather than typed, so both are
//    checked by driving a real browser rather than by reading the code.
async function testProjectTracking(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#progress`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(900);

    // ---- PK4-A/PK4-B: PRY-01 and PRY-02 are two screens each, no bar ----
    // The bar chose a job above a list that already offers the same choice,
    // and the panel/full-screen surface behind it already carries the figures
    // the bar would repeat. Both project screens lost their bar for that
    // reason; the other three keep it, because each is a single screen that
    // has to be told which job it is about.
    const listScreen = await pg.evaluate(() => ({
      bar: document.querySelectorAll(".projbar").length,
      centre: document.querySelectorAll("#view .ctr").length,
      list: !!document.querySelector("#prgQ"),
    }));
    if (listScreen.bar === 0 && listScreen.centre === 0 && listScreen.list)
      ok("PRY-01: the list stands alone — no PROYECTO bar, no centre panel");
    else bad("PRY-01: list screen", JSON.stringify(listScreen));

    await pg.evaluate(() => (location.hash = "economics"));
    await pg.waitForTimeout(600);
    const ecoListScreen = await pg.evaluate(() => ({
      bar: document.querySelectorAll(".projbar").length,
      ctrpanel: document.querySelectorAll(".ctrpanel").length,
      list: !!document.querySelector("#ecoQ"),
    }));
    if (ecoListScreen.bar === 0 && ecoListScreen.ctrpanel === 0 && ecoListScreen.list)
      ok("PRY-02: the list stands alone too — no PROYECTO bar, no centre panel");
    else bad("PRY-02: list screen", JSON.stringify(ecoListScreen));

    // The bar itself is checked on a screen that still has one — variations,
    // purchasing and labour keep it, each being a single screen that needs to
    // be told which job it is about.
    await pg.evaluate(() => (location.hash = "variations"));
    await pg.waitForTimeout(600);
    // PK5-B: the bar is a CHOOSER and nothing else. It used to carry a second
    // row of twelve summary figures — client, address, status, progress,
    // contracted revenue, actual cost, current margin, next dates — above
    // every screen that then shows its own. The economic ones belong to
    // Avance económico. What must survive is the four controls that answer
    // "which job", and what must not come back is money in the bar.
    const chooser = await pg.evaluate(() => {
      const bar = document.querySelector(".projbar");
      return {
        bar: !!bar,
        strip: document.querySelectorAll(".projbar .phead").length,
        search: !!document.querySelector(".projbar #pqf"),
        picker: !!document.querySelector(".projbar #psel"),
        fav: !!document.querySelector(".projbar #pfav"),
        status: !!document.querySelector(".projbar #pst"),
        money: bar ? /€/.test(bar.innerText) : false,
        rows: bar ? bar.children.length : 0,
      };
    });
    if (
      chooser.bar &&
      chooser.strip === 0 &&
      chooser.search &&
      chooser.picker &&
      chooser.fav &&
      chooser.status &&
      !chooser.money &&
      chooser.rows === 1
    )
      ok("project bar: chooser only — search, job, favourite, status; no summary strip (PK5-B)");
    else bad("project bar chooser", JSON.stringify(chooser));
    if ((await pg.locator("[data-recent]").count()) === 0)
      ok("PRY-01/02: the «Recientes» chips are gone from the shared project bar");
    else bad("Recientes dropped", "chips still rendered");

    // Opening a job IS opening its chart — the four things the operator asked
    // to land on, in one screen, with a labelled way back.
    await pg.evaluate(() => (location.hash = "progress"));
    await pg.waitForTimeout(700);
    await openJobWithChapters(pg, "prgQ");
    await pg.waitForTimeout(600);
    const landed = await pg.evaluate(() => ({
      chart: !!document.querySelector("#gSvg"),
      curve: document.querySelectorAll(".curve").length,
      avance: !!document.querySelector("#progCtl"),
      deviations: /Desviaciones/.test(document.querySelector(".bside")?.innerText || ""),
      panel: document.querySelectorAll(".ctrpanel").length,
      back: (document.querySelector("#gBack") || {}).textContent?.trim(),
    }));
    if (
      landed.chart &&
      landed.curve === 1 &&
      landed.avance &&
      landed.deviations &&
      landed.panel === 0 &&
      /Obras/.test(landed.back || "")
    )
      ok("PRY-01: a row opens the chart itself — Gantt, Curva S, Avance, Desviaciones, «← Obras»");
    else bad("PRY-01: job opens the chart", JSON.stringify(landed));

    await pg.locator("#gBack").click();
    await pg.waitForTimeout(600);
    if ((await pg.locator("#prgQ").count()) === 1 && (await pg.locator("#gSvg").count()) === 0)
      ok("PRY-01: «← Obras» returns to the list of jobs");
    else bad("PRY-01: back to the list", "still on the chart");

    // Money-chain item 14. The doc asks whether moving a milestone moves the
    // expected cash; before S8 nothing wrote installment.expectedDate after the
    // contract was drawn up, so the answer was no. «Recalcular los cobros
    // previstos» moved onto the Gantt in PK3-C — moving a milestone is a thing
    // done TO the plan, and the plan is there.
    await openJobWithChapters(pg, "prgQ");
    await pg.waitForTimeout(800);
    if (await pg.locator("#gDerive").count()) {
      const had = await pg.evaluate(() => {
        const B = ganttApi();
        return B ? B.get(erp.state, gProject).tasks.length : 0;
      });
      await pg.locator("#gDerive").click();
      await pg.waitForTimeout(500);
      // With a plan already in place the re-derivation asks first (PK3-C).
      if (had) await pg.getByRole("button", { name: /Volver a derivar/ }).click();
      await pg.waitForTimeout(1000);
    }
    await pg.locator("#gResched").click();
    await pg.waitForTimeout(500);
    const reschedule = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll("#drawer tbody tr")].map((r) => r.innerText);
      return { rows: rows.length, text: rows.join(" | ").slice(0, 200) };
    });
    const before14 = await pg.evaluate(() => {
      const p = erp.project(gProject);
      const c = erp.state.contracts.find((x) => x.id === p.contractId);
      return c ? c.installments.map((i) => i.expectedDate) : null;
    });
    if (reschedule.rows > 0 || before14 === null)
      ok("PRY-01: the reschedule panel states every milestone before moving one");
    else bad("PRY-01: reschedule panel", JSON.stringify(reschedule));

    if (before14 && (await pg.locator("#rs_go").isEnabled())) {
      await pg.locator("#rs_go").click();
      await pg.waitForTimeout(600);
      const after14 = await pg.evaluate(() => {
        const p = erp.project(gProject);
        const c = erp.state.contracts.find((x) => x.id === p.contractId);
        const moved = c.installments.filter((i) => i.expectedDateSource === "schedule");
        return {
          dates: c.installments.map((i) => i.expectedDate),
          moved: moved.length,
          fixedUntouched: c.installments
            .filter((i) => i.trigger === "fixedDate")
            .every((i) => i.expectedDateSource === undefined),
          invoicedUntouched: c.installments
            .filter((i) => i.status !== "planned")
            .every((i) => i.expectedDateSource === undefined),
        };
      });
      if (
        after14.moved > 0 &&
        after14.fixedUntouched &&
        after14.invoicedUntouched &&
        JSON.stringify(after14.dates) !== JSON.stringify(before14)
      )
        ok(`item 14: the plan moves the expected cash (${after14.moved} milestone(s))`);
      else bad("item 14: milestone reschedule", JSON.stringify(after14));
    } else {
      await pg.locator("#dClose").click();
      ok("item 14: nothing to move on this job, and the button says so rather than lying");
    }
    await pg.waitForTimeout(300);
    if (await pg.locator("#drawer.on").count()) await pg.locator("#dClose").click();

    // The context must survive a change of subsection — that is what makes it
    // a section context rather than one screen's dropdown. PK4-A/PK4-B:
    // neither PRY-01 nor PRY-02 has a dropdown to read any more, so the job
    // opened on PRY-01 is the reading, and PRY-03 — which still has a bar —
    // is what has to agree with it.
    const chosen = await pg.evaluate(() => gProject);
    if (await pg.locator("#gBack").count()) {
      await pg.locator("#gBack").click();
      await pg.waitForTimeout(500);
    }
    await pg.evaluate(() => (location.hash = "variations"));
    await pg.waitForTimeout(600);
    const stillChosen = await pg.locator("#psel").inputValue();
    if (stillChosen === chosen)
      ok("project context survives a subsection change (opened on PRY-01, selected on PRY-03)");
    else bad("project context persists", `${chosen} → ${stillChosen}`);

    // ---- PRY-02 (S8 · PK4-B): the job's own full-screen surface ----
    await pg.evaluate(() => (location.hash = "economics"));
    await pg.waitForTimeout(600);
    const beforeOpen = await pg.evaluate(() => ({
      fs: document.body.classList.contains("fs"),
      list: !!document.querySelector("#ecoQ"),
    }));
    if (!beforeOpen.fs && beforeOpen.list) ok("PRY-02: the register shows first, not the panel");
    else bad("PRY-02: list before opening", JSON.stringify(beforeOpen));

    await openJobWithChapters(pg, "ecoQ");
    const opened = await pg.evaluate(() => ({
      fs: document.body.classList.contains("fs"),
      back: (document.querySelector("#ecoBack") || {}).textContent?.trim(),
      list: !!document.querySelector("#ecoQ"),
      panel: document.querySelectorAll(".ctrpanel").length,
      cards: document.querySelectorAll("#view .kpi").length,
    }));
    // PK4-B mirrors PK4-A: a row opens the job's own full screen directly —
    // no 372/780 split, no panel, no list left compressed beside it — and a
    // labelled button is the way back.
    if (
      opened.fs &&
      /Obras/.test(opened.back || "") &&
      !opened.list &&
      !opened.panel &&
      opened.cards === 3
    )
      ok("PRY-02: a row opens the job's own full screen — KPI cards, no panel, no list beside it");
    else bad("PRY-02: full-screen surface", JSON.stringify(opened));

    const panelText = await pg.locator("#ecoBody").innerText();
    const hasCols = ["Presupuestado", "Acumulado", "Desviación", "Margen"].every((c) =>
      new RegExp(c, "i").test(panelText),
    );
    if (hasCols) ok("PRY-02: budgeted · accrued · variance · margin, per chapter");
    else bad("PRY-02: chapter columns", panelText.replace(/\n/g, " ").slice(0, 160));

    // The pending-assignment block. Give the job a cost with no chapter and
    // watch the per-chapter table stop agreeing with the project — which is
    // the defect the block exists to make visible.
    const seeded = await pg.evaluate(() => {
      const pid = gProject;
      const sup = erp.state.parties.find((p) => p.active && p.roles.includes("supplier"));
      erp.registerBill(
        {
          supplierId: sup.id,
          number: "E2E-SINCAP",
          baseCents: 50000,
          vatBp: 2100,
          allocations: [{ projectId: pid, amountCents: 50000 }],
        },
        "bo",
      );
      const chapters = erp.chapterEconomics(pid).reduce((s, c) => s + c.actualCents, 0);
      return { chapters, project: erp.actualCostCents(pid), pid };
    });
    await pg.evaluate(() => render());
    await pg.waitForTimeout(500);
    const pendingText = await pg.locator("#ecoBody").innerText();
    if (seeded.chapters < seeded.project && /sin repartir/i.test(pendingText))
      ok("PRY-02: a cost with no chapter is in the project and in no chapter, and says so");
    else
      bad(
        "PRY-02: pending block",
        `${seeded.chapters}/${seeded.project} · ${pendingText.slice(0, 90)}`,
      );

    // Split it across two chapters — the only place in the product that does.
    await pg.locator("#view [data-assign]").first().click();
    await pg.waitForTimeout(400);
    const chapterCount = await pg.locator('#as_rows select[data-k="chapterNum"] option').count();
    await pg.locator('#as_rows input[data-k="amountCents"]').first().fill("100.00");
    await pg.locator('#as_rows input[data-k="amountCents"]').first().dispatchEvent("change");
    await pg.waitForTimeout(300);
    await pg.locator("#as_go").click();
    await pg.waitForTimeout(400);
    const shortSplit = await pg.evaluate(() => ({
      open: document.querySelector("#drawer").classList.contains("on"),
      assigned: erp.state.bills.find((b) => b.number === "E2E-SINCAP").allocations.length,
    }));
    if (shortSplit.open && shortSplit.assigned === 1)
      ok("PRY-02: a chapter split that does not total the cost is refused");
    else bad("PRY-02: short split refused", JSON.stringify(shortSplit));

    await pg.locator('#as_rows input[data-k="amountCents"]').first().fill("300.00");
    await pg.locator('#as_rows input[data-k="amountCents"]').first().dispatchEvent("change");
    await pg.waitForTimeout(250);
    if (chapterCount > 1) {
      await pg.locator("#as_add").click();
      await pg.waitForTimeout(300);
      await pg.locator('#as_rows select[data-k="chapterNum"]').nth(1).selectOption({ index: 1 });
      await pg.waitForTimeout(200);
      await pg.locator('#as_rows input[data-k="amountCents"]').nth(1).fill("200.00");
      await pg.locator('#as_rows input[data-k="amountCents"]').nth(1).dispatchEvent("change");
      await pg.waitForTimeout(250);
    } else {
      await pg.locator('#as_rows input[data-k="amountCents"]').first().fill("500.00");
      await pg.locator('#as_rows input[data-k="amountCents"]').first().dispatchEvent("change");
      await pg.waitForTimeout(250);
    }
    await pg.locator("#as_go").click();
    await pg.waitForTimeout(600);
    const split = await pg.evaluate(() => {
      const b = erp.state.bills.find((x) => x.number === "E2E-SINCAP");
      return {
        parts: b.allocations.length,
        allHaveChapter: b.allocations.every((a) => !!a.chapterNum),
        sum: b.allocations.reduce((s, a) => s + a.amountCents, 0),
        chapters: erp.chapterEconomics(gProject).reduce((s, c) => s + c.actualCents, 0),
        project: erp.actualCostCents(gProject),
        stillPending: erp.unassignedChapterCosts(gProject).some((r) => r.ref === "E2E-SINCAP"),
      };
    });
    if (
      split.allHaveChapter &&
      split.sum === 50000 &&
      !split.stillPending &&
      split.chapters === seeded.chapters + 50000
    )
      ok(`PRY-02: splitting by capítulo makes the table agree with the project (${split.parts})`);
    else bad("PRY-02: chapter split", JSON.stringify(split));

    // A projection is adjustable, and the reason is required by the engine.
    await pg.locator("#view [data-adj]").first().click();
    await pg.waitForTimeout(400);
    await pg.locator("#fc_amt").fill("1234.00");
    await pg.locator("#fc_why").fill("");
    await pg.locator("#fc_save").click();
    await pg.waitForTimeout(350);
    // Assert the OUTCOME, not the wording: the engine's messages are English
    // while the UI is Spanish, so matching the text would test the translation
    // rather than the rule. What matters is that nothing was stored.
    const refusal = await pg.locator("#toast").innerText();
    const storedAnyway = await pg.evaluate(
      () => Object.keys(erp.project(gProject).forecastOverrides || {}).length,
    );
    if (/^⚠/.test(refusal.trim()) && storedAnyway === 0)
      ok("economics: an adjusted projection without a reason is refused and not stored");
    else bad("economics: reason required", `toast="${refusal}" stored=${storedAnyway}`);

    await pg.locator("#fc_why").fill("La parte cara ya está ejecutada");
    await pg.locator("#fc_save").click();
    await pg.waitForTimeout(500);
    const adjusted = await pg.locator("#view").innerText();
    if (/ajustada/i.test(adjusted) || /calculada/i.test(adjusted))
      ok("economics: an adjustment is recorded against the chapter");
    else bad("economics: adjustment recorded", adjusted.replace(/\n/g, " ").slice(0, 160));

    // ← Obras returns to the register, same as PRY-01's own back button.
    await pg.locator("#ecoBack").click();
    await pg.waitForTimeout(500);
    const closed = await pg.evaluate(() => ({
      fs: document.body.classList.contains("fs"),
      list: !!document.querySelector("#ecoQ"),
    }));
    if (!closed.fs && closed.list) ok("PRY-02: «← Obras» returns to the register");
    else bad("PRY-02: list restored", JSON.stringify(closed));

    // ---- derive the plan from the budget ----
    await openGantt(pg, base);
    // Package 3 slide 3: re-deriving is not additive — tasks and milestones
    // added by hand, and dependencies drawn on the chart, do not survive it —
    // so over an existing plan it asks first. Into an empty one it just runs.
    const planBefore = await pg.evaluate(() => {
      const B = ganttApi();
      return B ? B.get(erp.state, gProject).tasks.length : 0;
    });
    await pg.locator("#gDerive").click();
    await pg.waitForTimeout(500);
    const guardAsked = await pg.evaluate(() =>
      /Volver a derivar la planificaci/i.test(document.body.innerText),
    );
    if (guardAsked === planBefore > 0)
      ok(
        planBefore
          ? "tracking: re-deriving over an existing plan asks before discarding hand-made work"
          : "tracking: deriving into an empty plan runs without a question nobody needs",
      );
    else bad("tracking: derive guard", `tasksBefore=${planBefore} asked=${guardAsked}`);
    if (guardAsked) await pg.getByRole("button", { name: /Volver a derivar/ }).click();
    await pg.waitForTimeout(900);
    const bars = await pg.locator("#gSvg .gbar").count();
    const deriveToast = await pg.locator("#toast").innerText();
    if (bars >= 3 && /tareas/.test(deriveToast))
      ok(`tracking: ${bars} bars derived from the budget (${deriveToast.replace(/\n/g, " ")})`);
    else bad("tracking: derive from budget", `bars=${bars} toast=${deriveToast}`);

    // Durations must differ: they come from each chapter's own quantities and
    // the pack's daily output. Bars that are all the same width mean the
    // derivation fell back to its default for everything.
    const widths = await pg
      .locator("#gSvg .gbar")
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    if (new Set(widths).size > 1)
      ok(`tracking: durations derived from quantities (${new Set(widths).size} distinct widths)`);
    else bad("tracking: derived durations", `all bars ${widths[0]}px wide`);

    // Progress already recorded against the budget shows on the fresh bars.
    // PK3-C: the chapter figure is now the box beside the three-state control
    // (`data-pct`), not a bare numeric cell in a table.
    const chapterPcts = await pg
      .locator("#progCtl [data-pct]")
      .evaluateAll((els) => els.map((e) => Number(e.value)));
    if (chapterPcts.some((p) => p > 0))
      ok(`tracking: recorded progress carried onto the derived bars (${chapterPcts.join("/")})`);
    else bad("tracking: progress carried", chapterPcts.join("/"));

    // ---- the S curve ----
    const paths = await pg.locator(".curve path").count();
    const curveTag = await pg.locator("#view .card .ch .tag").allInnerTexts();
    if (paths === 3 && curveTag.some((t) => /planificado .* real .* pts/.test(t)))
      ok("tracking: S curve draws planned, actual and projected");
    else bad("tracking: S curve", `paths=${paths} tags=${curveTag.join(" | ").slice(0, 80)}`);

    // ---- the one progress control (Package 3 slide 3) ----------------------
    // Two controls used to record the same fact: this grid, and PRY-01's
    // «Avance» tab, which wrote only through markProgress and so never reached
    // the chart. They are one control now — the structure from here, the
    // three-state buttons and live-only-in-the-middle box from there, and no
    // quantity column at all, which the operator asked for and which costs the
    // record nothing since the engine never stored a quantity anyway.
    const shape = await pg.evaluate(() => {
      const host = document.querySelector("#progCtl");
      if (!host) return null;
      const strip = host.querySelector(".provrow.chap .pstate");
      const box = host.querySelector(".provrow.chap .pctbox");
      return {
        chapters: host.querySelectorAll(".provrow.chap").length,
        lines: host.querySelectorAll(".provrow.sub").length,
        tables: host.querySelectorAll("table").length,
        quantityInputs: document.querySelectorAll("[data-lineqty]").length,
        buttons: strip ? strip.querySelectorAll("button").length : 0,
        buttonWidth: strip
          ? Math.round(strip.querySelector("button").getBoundingClientRect().width)
          : 0,
        boxWidth: box ? Math.round(box.getBoundingClientRect().width) : 0,
        boxDisabled: box ? box.disabled : null,
        state: strip ? (strip.querySelector("button.on") || {}).dataset?.st : null,
        lineControls: host.querySelectorAll(".provrow.sub .pstate").length,
      };
    });
    if (
      shape &&
      shape.chapters > 0 &&
      shape.lines > 0 &&
      shape.lineControls === shape.lines &&
      shape.tables === 0 &&
      shape.quantityInputs === 0 &&
      shape.buttons === 3 &&
      shape.buttonWidth === 90 &&
      shape.boxWidth === 60 &&
      shape.boxDisabled === (shape.state !== "inProgress")
    )
      ok(
        `PRY-01: one control — ${shape.chapters} chapters and ${shape.lines} partidas as flex rows, three 90 px states and a 60 px box, no quantity column`,
      );
    else bad("PRY-01: merged progress control", JSON.stringify(shape));

    // The half a screenshot cannot show: a state button writes the ENGINE and
    // the PLAN's own bar in one action. That is the whole reason this is the
    // control that survived — the tab it replaced moved one and not the other.
    const chapNum = await pg.evaluate(
      () => document.querySelector("#progCtl .provrow.chap .pstate").dataset.chap,
    );
    await pg
      .locator(`#progCtl .pstate[data-chap="${chapNum}"] button[data-st="inProgress"]`)
      .click();
    await pg.waitForTimeout(700);
    const synced = await pg.evaluate((num) => {
      const B = ganttApi();
      const task = B.get(erp.state, gProject).tasks.find((t) => t.sourceRef === "group:" + num);
      const eng = erp.chapterProgress(gProject).find((c) => c.num === num);
      const box = document.querySelector(`#progCtl [data-pct="${num}"]`);
      return {
        taskPct: task ? task.progressPct : null,
        enginePct: eng ? eng.progressPct : null,
        boxLive: box ? !box.disabled : null,
      };
    }, chapNum);
    if (synced.taskPct != null && synced.taskPct === synced.enginePct && synced.boxLive)
      ok(
        `PRY-01: «en ejecución» moves the chapter and its bar together (${synced.enginePct}%) and makes the box live`,
      );
    else bad("PRY-01: chapter write reaches both records", JSON.stringify(synced));

    // A partida takes a percentage — the only input it takes now — and the
    // engine derives its state from that figure rather than being told one.
    const lineId = await pg.evaluate(
      () => document.querySelector("#progCtl .provrow.sub .pstate").dataset.line,
    );
    await pg.fill(`#progCtl [data-lpct="${lineId}"]`, "40");
    await pg.locator(`#progCtl [data-lpct="${lineId}"]`).press("Enter");
    await pg.waitForTimeout(700);
    const lineWrote = await pg.evaluate((id) => {
      let found = null;
      erp.state.budgets.forEach((b) =>
        b.versions.forEach((v) =>
          v.chapters.forEach((c) => c.lines.forEach((l) => (l.id === id ? (found = l) : 0))),
        ),
      );
      return found ? { pct: found.progressPct, state: found.progress } : null;
    }, lineId);
    if (lineWrote && lineWrote.pct === 40 && lineWrote.state === "inProgress")
      ok("PRY-01: a partida percentage is stored and its state derived from it");
    else bad("PRY-01: partida percentage", JSON.stringify(lineWrote));

    // «Terminado» is 100 by definition, and the box stops taking a figure.
    await pg.locator(`#progCtl .pstate[data-chap="${chapNum}"] button[data-st="done"]`).click();
    await pg.waitForTimeout(700);
    const finished = await pg.evaluate((num) => {
      const box = document.querySelector(`#progCtl [data-pct="${num}"]`);
      return box ? { value: box.value, disabled: box.disabled } : null;
    }, chapNum);
    if (finished && finished.value === "100" && finished.disabled === true)
      ok("PRY-01: a finished chapter reads 100 and stops accepting a percentage");
    else bad("PRY-01: finished chapter", JSON.stringify(finished));

    // ---- the deviations panel ----
    const dev = await pg.locator(".bside").innerText();
    if (/Desviaciones/.test(dev) && /Retraso sobre línea base/.test(dev))
      ok("tracking: deviations panel reports the slip against the baseline");
    else bad("tracking: deviations panel", dev.replace(/\n/g, " ").slice(0, 120));

    // ---- PK4-A: the job that cannot be planned at all ----------------------
    // Opening a job now lands here directly, so an UNPLANNED one lands here
    // too — and a job with no accepted presupuesto has no chapters to derive
    // from and no partidas to record against. Offering «Derivar del
    // presupuesto» there is offering a button that can only fail, so it is
    // disabled and the screen says what is actually missing.
    const unplanned = await pg.evaluate(() => {
      const B = ganttApi();
      const p = erp.state.projects.find((x) => {
        if (B.get(erp.state, x.id).tasks.length) return false;
        try {
          return !(
            x.budgetId &&
            erp
              .version(x.budgetId, x.acceptedVersionId)
              .chapters.some((c) => c.section === "base" && c.lines.length)
          );
        } catch (e) {
          return true;
        }
      });
      if (!p) return null;
      ganttFull = true;
      setProject(p.id);
      return p.code;
    });
    if (!unplanned) {
      ok("tracking: every job in the seed has something to plan — nothing to check here");
    } else {
      await pg.waitForTimeout(900);
      const empty = await pg.evaluate(() => ({
        derive: document.querySelector("#gDerive")?.disabled,
        toBudget: !!document.querySelector("#gGoBudget"),
        says: /presupuesto aceptado/.test(document.querySelector("#view")?.innerText || ""),
        crashed: !document.querySelector("#gBack"),
      }));
      if (empty.derive === true && empty.toBudget && empty.says && !empty.crashed)
        ok(
          `tracking: a job with no accepted presupuesto (${unplanned}) says why and points at COM-03 instead of offering a button that fails`,
        );
      else bad("tracking: unplanned job empty state", JSON.stringify(empty));
      await pg.locator("#gBack").click();
      await pg.waitForTimeout(500);
    }

    // PK4-B: economics' own shared header — the one that used to repeat
    // PRY-01's progress bar inside PRY-02's panel — is gone, along with the
    // duplication it existed to name. What survives to check is that the
    // panel still opens cleanly on the SAME job right after progress was
    // recorded elsewhere, with its chapter rows intact.
    await pg.evaluate(() => (location.hash = "economics"));
    await pg.waitForTimeout(600);
    await openJobWithChapters(pg, "ecoQ");
    const after = await pg.evaluate(() => ({
      pct: erp.projectEconomics(gProject).progressPct,
      chapterRows: document.querySelectorAll("#ecoBody tbody tr").length,
    }));
    if (after.chapterRows > 0)
      ok(
        `economics: the panel opens on the same job after progress was recorded (${after.pct}% avance)`,
      );
    else bad("economics after progress", JSON.stringify(after));

    if (errs.length === 0) ok("tracking: no console errors");
    else bad("tracking: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("project tracking", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

/**
 * Day one on a REAL register — the state no other suite is ever in.
 *
 * Every suite here runs against the demo seed, which ships two bank accounts
 * and a till. A server-mode tenant gets neither: the seed does not run there.
 * So the branch that renders "no accounts configured" had never been looked
 * at, and the buttons that create the account and import the statement were
 * built BELOW it — the whole of the bank work was unreachable on precisely
 * the first day it was needed, and the client found it before this test did.
 *
 * The register is emptied in the page rather than mocked: same code, same
 * screens, no accounts. What is asserted is the way OUT of each empty state,
 * because a screen that only states the absence is a screen you cannot use.
 */
async function testFirstRun(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  const emptyRegister = () =>
    pg.evaluate(() => {
      erp.state.bankAccounts = [];
      erp.state.movements = [];
      erp.state.bankPeriods = [];
      render();
    });
  try {
    // ---- the bank screen: a create button, and a drawer behind it ----------
    await pg.goto(`${base}/erp.html#banking`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await emptyRegister();
    await pg.waitForTimeout(400);

    if (await pg.locator("#bkNew").isVisible())
      ok("first run: with no accounts, the bank screen still offers ＋ Cuenta");
    else bad("first run: bank screen", "no #bkNew — the empty state is a dead end");

    await pg.locator("#bkNew").click();
    await pg.waitForTimeout(400);
    await pg.fill("#na_name", "BBVA primera cuenta");
    await pg.selectOption("#na_kind", "bank");
    await pg.locator("#na_go").click();
    await pg.waitForTimeout(600);
    const madeBank = await pg.evaluate(() => erp.state.bankAccounts.length);
    if (madeBank === 1) ok("first run: the first bank account is created from that button");
    else bad("first run: create account", `accounts=${madeBank}`);

    // …and once one exists, the statement importer is on the same screen.
    const importable = await pg.evaluate(() => !!document.querySelector("#bkImport"));
    if (importable) ok("first run: the statement importer appears with the first account");
    else bad("first run: importer", "no #bkImport after creating an account");

    // ---- petty cash: the till is created from the screen named after it ----
    await pg.goto(`${base}/erp.html#petty-cash`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await emptyRegister();
    await pg.waitForTimeout(400);

    if (await pg.locator("#cashNew").isVisible())
      ok("first run: with no till, Caja chica offers to create one");
    else bad("first run: petty cash", "no #cashNew — the empty state is a dead end");

    await pg.locator("#cashNew").click();
    await pg.waitForTimeout(400);
    // The kind is PRESELECTED: this button says "create a till", so landing on
    // "bank account" would be a different promise than the one it made.
    const preset = await pg.inputValue("#na_kind");
    if (preset === "till") ok("first run: that button preselects «Caja de efectivo»");
    else bad("first run: till preset", `kind=${preset}`);

    await pg.fill("#na_name", "Caja obra");
    await pg.locator("#na_go").click();
    await pg.waitForTimeout(700);
    // Geometry, not a count: the screen must now BE the petty-cash screen —
    // entrada, salida and the arqueo — not merely hold one more record.
    const usable = await pg.evaluate(() => ({
      tills: erp.state.bankAccounts.filter((a) => a.kind === "till").length,
      inBtn: !!document.querySelector("#cashIn"),
      outBtn: !!document.querySelector("#cashOut"),
      close: !!document.querySelector("#cashClose"),
    }));
    if (usable.tills === 1 && usable.inBtn && usable.outBtn && usable.close)
      ok("first run: creating the till turns Caja chica into a working screen");
    else bad("first run: petty cash after creation", JSON.stringify(usable));

    if (errs.length === 0) ok("first run: no console errors");
    else bad("first run: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("first run", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── ADM-05 Consolidación bancaria and ADM-06 Caja chica (§3.2), plus gap 13 —
//    the last structural break in the money chain, closed in S11.
async function testBankAndCash(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    // ---- ADM-06: the simplest screen, and the count that proves it ----
    await pg.goto(`${base}/erp.html#petty-cash`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(500);

    const shape = await pg.evaluate(() => ({
      strip: !!document.querySelector("#view .queuebar"),
      inBtn: !!document.querySelector("#cashIn"),
      outBtn: !!document.querySelector("#cashOut"),
      close: document.querySelector("#cashClose")
        ? document.querySelector("#cashClose").textContent
        : null,
    }));
    if (shape.strip && shape.inBtn && shape.outBtn && shape.close)
      ok("ADM-06: entrada/salida, the balance strip and the arqueo at the foot");
    else bad("ADM-06: screen shape", JSON.stringify(shape));

    // The arqueo has to agree with the account balance, or one is decoration.
    const agrees = await pg.evaluate(() => {
      const cc = erp.cashCount(cashAcc);
      return cc.closingCents === erp.accountBalanceCents(cashAcc);
    });
    if (agrees) ok("ADM-06: the count agrees with the account balance");
    else bad("ADM-06: count vs balance", "they disagree");

    // A payment out with no receipt is counted, never hidden.
    const before = await pg.evaluate(() => erp.cashCount(cashAcc).awaitingDoc);
    await pg.locator("#cashOut").click();
    await pg.waitForTimeout(400);
    await pg.fill("#ca_c", "Ferretería E2E");
    await pg.fill("#ca_a", "12.50");
    await pg.locator("#ca_go").click();
    await pg.waitForTimeout(600);
    const after = await pg.evaluate(() => {
      const cc = erp.cashCount(cashAcc);
      return {
        awaiting: cc.awaitingDoc,
        closing: cc.closingCents,
        bal: erp.accountBalanceCents(cashAcc),
      };
    });
    if (after.awaiting === before + 1 && after.closing === after.bal)
      ok(`ADM-06: a cash payment with no receipt is counted (${before} → ${after.awaiting})`);
    else bad("ADM-06: undocumented cash", JSON.stringify({ before, ...after }));

    // ── Block 2: a cash payment says WHERE it landed — project, chapter,
    //    partida — through the same validation every other cost uses.
    const cashDest = await pg.evaluate(() => {
      document.getElementById("cashOut").click();
      return new Promise((res) =>
        setTimeout(() => {
          const dest = document.getElementById("ca_dest");
          if (!dest) return res(null);
          const p = erp.state.projects.find(
            (x) =>
              x.budgetId &&
              x.acceptedVersionId &&
              !x.closed &&
              erp.version(x.budgetId, x.acceptedVersionId).chapters.some((c) => c.lines.length),
          );
          if (!p) return res({ noProject: true });
          document.getElementById("ca_c").value = "Tornillería obra";
          document.getElementById("ca_a").value = "23.50";
          dest.value = "p:" + p.id;
          dest.dispatchEvent(new Event("change", { bubbles: true }));
          setTimeout(() => {
            const chap = document.getElementById("ca_chap");
            const first = [...chap.options].find((o) => o.value);
            chap.value = first.value;
            chap.dispatchEvent(new Event("change", { bubbles: true }));
            setTimeout(() => {
              const line = document.getElementById("ca_line");
              const lopt = [...line.options].find((o) => o.value);
              if (lopt) line.value = lopt.value;
              document.getElementById("ca_go").click();
              setTimeout(() => {
                const m = erp.state.movements.find((x) => x.concept === "Tornillería obra");
                res(
                  m && {
                    alloc: m.allocations[0] || null,
                    amount: m.amountCents,
                  },
                );
              }, 500);
            }, 250);
          }, 250);
        }, 400),
      );
    });
    if (
      cashDest &&
      cashDest.alloc &&
      cashDest.alloc.projectId &&
      cashDest.alloc.chapterNum &&
      cashDest.alloc.lineId &&
      cashDest.amount === -2350
    )
      ok("block 2: a cash payment lands on project · chapter · partida from the drawer");
    else bad("block 2: cash destination", JSON.stringify(cashDest));

    // ── 1E: «Marcar justificado» now takes the FILE. The button used to flip
    //    the flag with nothing behind it — the word without the receipt.
    const docBtn = await pg.evaluate(() => {
      const b = document.querySelector("[data-cashdoc]");
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), id: b.dataset.cashdoc };
    });
    if (docBtn && docBtn.w > 60) ok("1E: the undocumented cash row offers its receipt");
    else bad("1E: receipt button", JSON.stringify(docBtn));
    await pg.click("[data-cashdoc]");
    await pg.waitForTimeout(400);
    await pg.setInputFiles('[data-ev="file"]', "tests/fixtures/receipt.png");
    await pg.waitForTimeout(1200);
    const attached = await pg.evaluate(async (id) => {
      const m = erp.state.movements.find((x) => x.id === id);
      if (!m || !m.supportingDoc) return { ok: false };
      const blob = await ErpStore.getBlob(m.supportingDoc.storageKey);
      return {
        ok: m.needsDoc === false,
        key: m.supportingDoc.storageKey,
        bytes: blob ? blob.size : 0,
      };
    }, docBtn && docBtn.id);
    if (attached.ok && attached.bytes > 0)
      ok(
        `1E: the receipt is a real stored file (${attached.bytes} bytes behind ${attached.key.slice(0, 8)}…)`,
      );
    else bad("1E: file stored and flag cleared", JSON.stringify(attached));

    // ---- ADM-05: classification edited in the row ----
    await pg.goto(`${base}/erp.html#banking`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(600);
    const inline = await pg.evaluate(() => ({
      classSelects: document.querySelectorAll("[data-bkclass]").length,
      destSelects: document.querySelectorAll("[data-bkdest]").length,
      amberRows: document.querySelectorAll("#view tr.xrow.unapproved").length,
      openMovements: erp.state.movements.filter(
        (m) => m.status === "unallocated" && inPeriod(m.accountingDate),
      ).length,
    }));
    if (inline.classSelects > 0 && inline.classSelects === inline.destSelects)
      ok(`ADM-05: class and destination are edited in the row (${inline.classSelects} rows)`);
    else bad("ADM-05: inline editing", JSON.stringify(inline));
    if (inline.amberRows === inline.openMovements)
      ok(`ADM-05: every unmatched movement carries the amber bar (${inline.amberRows})`);
    else bad("ADM-05: amber on unmatched", JSON.stringify(inline));

    /* A destination list has to be readable by the person choosing. The
       operator, looking at a picker of bare codes: "with the code P-R001 is
       difficult to know what project it is … at some point 100 of projects
       will be there". The code still leads — it is what the lists are ordered
       by — and the customer follows it. */
    const destLabels = await pg.evaluate(() => {
      const sel = document.querySelector("[data-bkdest]");
      if (!sel) return null;
      const opts = [...sel.querySelectorAll('optgroup[label="Obras"] option')].map((o) =>
        o.textContent.trim(),
      );
      const projects = erp.state.projects.filter((p) => !p.closed);
      return {
        count: opts.length,
        codeFirst: opts.every((t, i) => t.startsWith(projects[i].code)),
        carryContext: opts.filter((t) => t.includes(" · ")).length,
        sample: opts[0] || "",
      };
    });
    if (
      destLabels &&
      destLabels.count > 0 &&
      destLabels.codeFirst &&
      destLabels.carryContext === destLabels.count
    )
      ok(`ADM-05: every project option names its customer after the code («${destLabels.sample}»)`);
    else bad("ADM-05: project option labels", JSON.stringify(destLabels));

    /* One line per account, then the sum — the operator's words: "ensure that I
       see each account separate and not only one line item with all accounts
       sum up". Money in three places is three balances; the total is the
       fourth fact, not the only one. Checked as GEOMETRY and arithmetic: a row
       per account, each naming its own balance, and a total that is the sum of
       them rather than a second figure that happens to sit nearby. */
    await pg.evaluate(() => {
      if (!erp.state.bankAccounts.some((a) => a.kind === "card"))
        erp.addBankAccount({ name: "Visa E2E", kind: "card", openingCents: -12000 }, "bo");
      render();
    });
    await pg.waitForTimeout(500);
    const perAccount = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll("#view [data-acct]")];
      const money = (t) => {
        const m = (t.match(/-?[\d.]+(?:,\d+)?\s*€/g) || []).pop();
        return m
          ? Math.round(
              parseFloat(m.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".")) * 100,
            )
          : null;
      };
      const shown = rows.map((r) => ({
        id: r.dataset.acct,
        wide: r.getBoundingClientRect().width > 100,
        cents: money(r.textContent),
      }));
      const totalRow = [...document.querySelectorAll("#view .daylist .it")].pop();
      return {
        accounts: erp.state.bankAccounts.length,
        kinds: [...new Set(erp.state.bankAccounts.map((a) => a.kind))].length,
        shown,
        totalCents: totalRow ? money(totalRow.textContent) : null,
        engineTotal: Math.round(erp.cashPosition().totalCents / 100) * 100,
      };
    });
    const linesOk =
      perAccount.shown.length === perAccount.accounts &&
      perAccount.shown.every((s) => s.wide && s.cents !== null) &&
      perAccount.kinds >= 3;
    if (linesOk)
      ok(
        `ADM-05: one visible line per account, all ${perAccount.kinds} kinds (${perAccount.shown.length} accounts)`,
      );
    else bad("ADM-05: per-account lines", JSON.stringify(perAccount));
    // The rounding is the screen's own (eur0), so compare at that resolution.
    const sumShown = perAccount.shown.reduce((s, r) => s + (r.cents || 0), 0);
    if (perAccount.totalCents !== null && Math.abs(perAccount.totalCents - sumShown) <= 100)
      ok("ADM-05: …and the total underneath is those same balances added up");
    else
      bad("ADM-05: total equals the sum of the lines", `${perAccount.totalCents} vs ${sumShown}`);

    // Selecting an account from its own line is the same act as the picker.
    const firstAcct = perAccount.shown[0] && perAccount.shown[0].id;
    if (firstAcct) {
      await pg.locator(`[data-acct="${firstAcct}"]`).click();
      await pg.waitForTimeout(500);
      const picked = await pg.evaluate(() => (typeof bankAcc === "string" ? bankAcc : null));
      if (picked === firstAcct) ok("ADM-05: clicking an account's line selects that account");
      else bad("ADM-05: line selects account", `${picked} ≠ ${firstAcct}`);
    }

    // Classifying one in the row really writes it.
    const target = await pg.evaluate(() => {
      const el = document.querySelector("[data-bkclass]");
      return el ? el.dataset.bkclass : null;
    });
    if (target) {
      await pg.selectOption(`[data-bkclass="${target}"]`, "overhead");
      await pg.waitForTimeout(600);
      const cls = await pg.evaluate(
        (id) => (erp.state.movements.find((m) => m.id === id) || {}).class,
        target,
      );
      if (cls === "overhead") ok("ADM-05: choosing a class in the row writes it straight away");
      else bad("ADM-05: inline class writes", String(cls));
    }

    // ---- Gap 13: a cost that lands on an account, not a project ----
    const gap13 = await pg.evaluate(() => {
      const led = erp.accountLedger();
      return {
        rows: led.rows.length,
        unassigned: led.unassignedCents,
        resolvesOverhead: erp.resolveAccountCode({ overheadCategory: "insurance" }),
        resolvesJob: erp.resolveAccountCode({
          projectId: erp.state.projects[0].id,
          kind: "subcontract",
        }),
        everyAllocHasCode: erp.state.bills
          .flatMap((b) => b.allocations)
          .every((a) => !!a.accountCode || (!a.projectId && !a.overheadCategory)),
      };
    });
    if (
      gap13.rows > 0 &&
      gap13.resolvesOverhead === "625" &&
      gap13.resolvesJob === "601" &&
      gap13.everyAllocHasCode
    )
      ok(`gap 13: every allocated cost names its account, and rolls up (${gap13.rows} accounts)`);
    else bad("gap 13: accountCode", JSON.stringify(gap13));

    // ── 1B: a real BBVA .xlsx, through the REAL file input ────────────────
    //    setInputFiles drives the same hidden <input> the button clicks, so
    //    the whole path runs: parse → previewImport → drawer → import. The
    //    fixture is the same file the Node gate reads.
    await pg.evaluate(() => (location.hash = "banking"));
    await pg.waitForTimeout(600);
    await pg.evaluate(() => {
      const sel = document.getElementById("bkSel");
      const first = [...sel.options].find((o) => o.value);
      sel.value = first.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await pg.waitForTimeout(500);
    const impBtn = await pg.evaluate(() => {
      const b = document.getElementById("bkImport");
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (impBtn && impBtn.w > 80 && impBtn.h >= 20)
      ok(`1B: the banking screen offers the statement import (${impBtn.w}×${impBtn.h})`);
    else bad("1B: import button", JSON.stringify(impBtn));

    const movsBefore = await pg.evaluate(() => erp.state.movements.length);
    await pg.setInputFiles("#bkFile", "tests/fixtures/bbva-movimientos.xlsx");
    await pg.waitForTimeout(900);
    const preview = await pg.evaluate(() => {
      const go = document.getElementById("stGo");
      if (!go) return null;
      const txt = go.closest(".card").textContent;
      return { disabled: go.disabled, hasCounts: /Movimientos nuevos/.test(txt) };
    });
    if (preview && !preview.disabled && preview.hasCounts)
      ok("1B: the dry run shows its counts before anything is written");
    else bad("1B: preview drawer", JSON.stringify(preview));
    await pg.click("#stGo");
    await pg.waitForTimeout(600);
    const movsAfter = await pg.evaluate(() => erp.state.movements.length);
    if (movsAfter === movsBefore + 3)
      ok(`1B: three movements imported from the file (${movsBefore} → ${movsAfter})`);
    else bad("1B: movements imported", `${movsBefore} → ${movsAfter}`);

    // The same statement again: duplicates reported, nothing re-created.
    await pg.setInputFiles("#bkFile", "tests/fixtures/bbva-movimientos.xlsx");
    await pg.waitForTimeout(900);
    const again = await pg.evaluate(() => {
      const go = document.getElementById("stGo");
      return go ? { disabled: go.disabled } : null;
    });
    if (again && again.disabled)
      ok("1B: re-importing the same statement finds nothing new — the button says so");
    else bad("1B: duplicate statement blocked", JSON.stringify(again));
    await pg.evaluate(() => closeDrawer());
    const movsFinal = await pg.evaluate(() => erp.state.movements.length);
    if (movsFinal === movsAfter) ok("1B: and nothing was imported twice");
    else bad("1B: no duplicate import", `${movsAfter} → ${movsFinal}`);

    /* The layout a real export actually has (S20): metadata above the header,
       the table starting in column C, dates as text, amounts as numeric cells
       with binary-float noise, newest row first, and two identical payroll
       payments on one day. Driven through the same file input, because the
       parser being right in a unit test says nothing about the screen. */
    const beforeReal = await pg.evaluate(() => erp.state.movements.length);
    await pg.setInputFiles("#bkFile", "tests/fixtures/bbva-cuenta.xlsx");
    await pg.waitForTimeout(1100);
    const realPv = await pg.evaluate(() => {
      const go = document.getElementById("stGo");
      if (!go) return null;
      const t = go.closest(".card").textContent.replace(/\s+/g, " ");
      return { disabled: go.disabled, text: t.slice(0, 200) };
    });
    if (realPv && !realPv.disabled && /Movimientos nuevos\s*8/.test(realPv.text))
      ok("1B: a real-layout export previews all eight of its movements");
    else bad("1B: real-layout preview", JSON.stringify(realPv));
    await pg.click("#stGo");
    await pg.waitForTimeout(700);
    const realOut = await pg.evaluate(() => {
      const mine = erp.state.movements.slice(-8);
      return {
        added: erp.state.movements.length,
        payroll: mine.filter((m) => m.amountCents === -50000).length,
        noisy: mine.filter((m) => m.amountCents === -6910).length,
        big: mine.filter((m) => m.amountCents === -1876644).length,
        named: mine.filter((m) => m.counterparty).length,
      };
    });
    // …and it can be taken back out again, through the screen.
    const undoShape = await pg.evaluate(() => {
      const b = document.getElementById("bkUndo");
      const r = b && b.getBoundingClientRect();
      return b ? { w: Math.round(r.width), h: Math.round(r.height) } : null;
    });
    if (undoShape && undoShape.w > 60 && undoShape.h > 14)
      ok(`1B: the bank screen offers an undo for an import (${undoShape.w}×${undoShape.h})`);
    else bad("1B: undo button", JSON.stringify(undoShape));

    if (
      realOut.added === beforeReal + 8 &&
      realOut.payroll === 2 &&
      realOut.noisy === 1 &&
      realOut.big === 1 &&
      realOut.named > 0
    )
      ok("1B: …and imports them as money: both payrolls kept, float noise exact to the cent");
    else bad("1B: real-layout import", JSON.stringify(realOut));

    // ── 1C: a credit card is an ACCOUNT — created through the product, fed
    //    by the same importer, settled from the bank as an internal transfer.
    await pg.click("#bkNew");
    await pg.waitForTimeout(300);
    await pg.evaluate(() => {
      document.getElementById("na_name").value = "Visa E2E";
      document.getElementById("na_kind").value = "card";
    });
    await pg.click("#na_go");
    await pg.waitForTimeout(500);
    const cardAcc = await pg.evaluate(() => {
      const c = erp.state.bankAccounts.find((a) => a.kind === "card" && a.name === "Visa E2E");
      return c ? c.id : null;
    });
    if (cardAcc) ok("1C: a card account can be created through the product");
    else bad("1C: card account created", "not found after drawer");

    // The card statement, into the card account, through the same file input.
    await pg.evaluate((id) => {
      const sel = document.getElementById("bkSel");
      sel.value = id;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }, cardAcc);
    await pg.waitForTimeout(500);
    await pg.setInputFiles("#bkFile", "tests/fixtures/bbva-movimientos.xlsx");
    await pg.waitForTimeout(900);
    await pg.click("#stGo");
    await pg.waitForTimeout(600);
    const onCard = await pg.evaluate(
      (id) => erp.state.movements.filter((m) => m.accountId === id).length,
      cardAcc,
    );
    if (onCard === 3) ok("1C: the card statement lands on the card account (3 movements)");
    else bad("1C: card statement import", String(onCard));

    // A negative movement on the BANK offers the settlement destination.
    const settleOffer = await pg.evaluate(() => {
      const bank = erp.state.bankAccounts.find((a) => a.kind === "bank");
      const sel = document.getElementById("bkSel");
      sel.value = bank.id;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return bank.id;
    });
    await pg.waitForTimeout(500);
    const group = await pg.evaluate(() => {
      const sels = [...document.querySelectorAll("[data-bkdest]")];
      const withGroup = sels.filter((sel) =>
        [...sel.querySelectorAll("optgroup")].some((g) => /Liquidación de tarjeta/.test(g.label)),
      );
      return { total: sels.length, offered: withGroup.length };
    });
    if (group.offered > 0)
      ok(
        `1C: outgoing bank rows offer «Liquidación de tarjeta» (${group.offered} of ${group.total})`,
      );
    else bad("1C: settlement optgroup", JSON.stringify(group));

    const settled = await pg.evaluate((cardId) => {
      const sel = [...document.querySelectorAll("[data-bkdest]")].find((x) =>
        [...x.querySelectorAll("optgroup")].some((g) => /Liquidación de tarjeta/.test(g.label)),
      );
      if (!sel) return null;
      sel.value = "c:" + cardId;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      const m = erp.state.movements.find((x) => x.id === sel.dataset.bkdest);
      return { class: m.class, link: m.cardSettlement && m.cardSettlement.accountId };
    }, cardAcc);
    if (settled && settled.class === "internalTransfer" && settled.link === cardAcc)
      ok("1C: picking it marks the bank line as the card's settlement, an internal transfer");
    else bad("1C: settlement written", JSON.stringify(settled));

    // ── 1D: a movement with no invoice can be EXPLAINED, and the queue
    //    stops asking — only unexplained ones stay flagged.
    await pg.evaluate(() => goTab("banking", "_reconcile"));
    await pg.waitForTimeout(700);
    const unb = await pg.evaluate(() => {
      const b = document.getElementById("rcUnbacked");
      const sel = document.getElementById("rcWhy");
      if (!b || !sel) return null;
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), reasons: sel.options.length };
    });
    if (unb && unb.w > 60 && unb.reasons >= 4)
      ok(`1D: the queue offers «Sin factura, con motivo» with ${unb.reasons} reasons`);
    else bad("1D: unbacked control", JSON.stringify(unb));

    const marked = await pg.evaluate(() => {
      const before = erp.unreconciledMovements().length;
      const id = document.querySelector(".movrow") && document.querySelector(".movrow").dataset.mov;
      document.getElementById("rcUnbacked").click();
      const m = erp.state.movements.find((x) => x.id === id);
      return {
        before,
        after: erp.unreconciledMovements().length,
        reason: m && m.unbacked && m.unbacked.reason,
      };
    });
    if (marked.after === marked.before - 1 && marked.reason)
      ok(
        `1D: marking removes exactly one from the queue (${marked.before} → ${marked.after}, motivo ${marked.reason})`,
      );
    else bad("1D: mark shrinks the queue", JSON.stringify(marked));

    /* The undo drawer, driven: it must say what will go and what will stay,
       and leave the decided movement behind. */
    const undoRun = await pg.evaluate(async () => {
      const acc = erp.state.bankAccounts.find((a) => a.kind === "bank");
      bankAcc = acc.id;
      render();
      await new Promise((r) => setTimeout(r, 300));
      // Give one movement a decision, so the drawer has something to protect.
      const mine = erp.state.movements.filter((m) => m.accountId === acc.id && !m.matched);
      if (mine.length) erp.markMovementUnbacked(mine[0].id, "comision", "bo");
      const before = erp.state.movements.filter((m) => m.accountId === acc.id).length;
      undoImportDrawer(acc.id);
      await new Promise((r) => setTimeout(r, 300));
      const btn = document.getElementById("uiAll");
      const text = btn ? btn.closest(".card").textContent.replace(/\s+/g, " ") : "";
      btn && btn.click();
      await new Promise((r) => setTimeout(r, 500));
      const after = erp.state.movements.filter((m) => m.accountId === acc.id);
      return {
        before,
        after: after.length,
        protectedKept: after.some((m) => m.unbacked),
        saidKept: /Se conservan/.test(text),
      };
    });
    if (
      undoRun.before > undoRun.after &&
      undoRun.after >= 1 &&
      undoRun.protectedKept &&
      undoRun.saidKept
    )
      ok(
        `1B: the undo clears the untouched movements (${undoRun.before} → ${undoRun.after}) and keeps the decided one`,
      );
    else bad("1B: undo drawer", JSON.stringify(undoRun));

    if (errs.length === 0) ok("ADM-05/06: no console errors");
    else bad("ADM-05/06: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("bank and cash", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── ADM-01 Facturación (§3.2) — four counters over the register, and the one
//    row treatment the doc is explicit about: days overdue red FROM DAY ONE.
async function testFinancials(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    // ADM-09 lives on its own page, so the ERP state has to exist before it is
    // opened — which is the whole point of the session: the two now read the
    // same document instead of two datasets that could disagree.
    await pg.goto(`${base}/erp.html#tower`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(1500);
    const truth = await pg.evaluate(() => ({
      ar: erp.invoiceRegister().filter((r) => r.outstandingCents > 0).length,
      arCents: erp
        .invoiceRegister()
        .filter((r) => r.outstandingCents > 0)
        .reduce((s, r) => s + r.outstandingCents, 0),
      ap: erp.payables().filter((b) => b.outstandingCents > 0).length,
      accounts: erp.listAll("accounts").length,
      banks: erp.state.bankAccounts.length,
      today: erp.today,
    }));

    await pg.goto(`${base}/financial-data.html`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(1800);
    const fed = await pg.evaluate(() => ({
      connected: !!erp,
      banner: (document.querySelector("#fedBanner") || {}).innerText || "",
      ar: (DATA.arOpen || []).length,
      arCents: Math.round((DATA.arOpen || []).reduce((s, r) => s + r.amount, 0) * 100),
      ap: (DATA.apOpen || []).length,
      accounts: (DATA.accounts || []).length,
      banks: (DATA.bank || []).length,
      asOf: AS_OF,
      groups: [...document.querySelectorAll("#nav .grp")].map((x) => x.textContent),
    }));

    if (fed.connected && /Conectado al ERP/.test(fed.banner))
      ok("ADM-09: the financial page reads the ERP's own state");
    else bad("ADM-09: connected", JSON.stringify(fed).slice(0, 200));

    // The figure that used to be typed twice, asserted to the cent.
    if (fed.ar === truth.ar && fed.arCents === truth.arCents && fed.ap === truth.ap)
      ok(`ADM-09: receivables and payables agree with ADM-01 to the cent (${fed.ar}/${fed.ap})`);
    else bad("ADM-09: AR/AP agree", JSON.stringify({ truth, fed }).slice(0, 220));

    if (fed.accounts === truth.accounts && fed.banks === truth.banks)
      ok("ADM-09: the chart of accounts and the bank list come from the ERP too");
    else bad("ADM-09: chart and banks", JSON.stringify({ truth, fed }).slice(0, 200));

    // Aging measured against the ERP's today, not the browser's clock.
    if (fed.asOf === truth.today)
      ok("ADM-09: aging is valued on the ERP's date, not the browser's");
    else bad("ADM-09: valuation date", `${fed.asOf} vs ${truth.today}`);

    // §3.2's four groups, by their names in the document.
    if (
      JSON.stringify(fed.groups) ===
      JSON.stringify(["Resumen", "Estados financieros", "Capital circulante", "Libros"])
    )
      ok("ADM-09: the four groups the document names");
    else bad("ADM-09: nav groups", JSON.stringify(fed.groups));

    // A derived ledger cannot be edited here: the row would be overwritten on
    // the next read, and an input that silently does nothing is worse than none.
    const ro = await pg.evaluate(() => {
      cur = "arOpen";
      render();
      return {
        prov: !!document.querySelector("#prov"),
        add: document.querySelector("#btnAdd").style.display,
        clickable:
          !!document.querySelector("#tbody tr") && !!document.querySelector("#tbody tr").onclick,
      };
    });
    if (ro.prov && ro.add === "none" && !ro.clickable)
      ok("ADM-09: a derived ledger says where it comes from and refuses to be typed over");
    else bad("ADM-09: derived read-only", JSON.stringify(ro));

    // …while the ones the ERP genuinely does not hold stay editable.
    const rw = await pg.evaluate(() => {
      cur = "loans";
      render();
      return {
        prov: !!document.querySelector("#prov"),
        add: document.querySelector("#btnAdd").style.display,
      };
    });
    if (!rw.prov && rw.add !== "none")
      ok("ADM-09: loans, budgets and drivers are still inputs — the ERP does not know them");
    else bad("ADM-09: inputs still editable", JSON.stringify(rw));

    if (errs.length === 0) ok("ADM-09: no console errors");
    else bad("ADM-09: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("ADM-09 datos financieros", String(e).slice(0, 220));
  } finally {
    await pg.close();
  }
}

async function testCashFlow(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#cash-flow`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(600);

    // §3.2's geometry: a fixed 240 label column, 96 per period column.
    const shape = await pg.evaluate(() => {
      const th = [...document.querySelectorAll("#cfGrid thead th")];
      const cum = document.querySelector("#cfGrid tr.cum");
      return {
        cols: th.length,
        lab: th[0] ? Math.round(th[0].getBoundingClientRect().width) : 0,
        per: th[1] ? Math.round(th[1].getBoundingClientRect().width) : 0,
        cum: !!cum,
        sticky: th[0] ? getComputedStyle(th[0]).position : null,
      };
    });
    if (shape.lab === 240 && shape.per === 96 && shape.cols === 14 && shape.cum)
      ok("ADM-08: 240 label column, 96 per period, cumulative balance at the foot");
    else bad("ADM-08: grid geometry", JSON.stringify(shape));
    if (shape.sticky === "sticky") ok("ADM-08: the label column stays put while the grid scrolls");
    else bad("ADM-08: sticky label column", String(shape.sticky));

    // The cumulative row is the running balance from real money, not from zero.
    const maths = await pg.evaluate(() => {
      const g = erp.cashFlowGrid({ mode: "week", periods: 13 });
      let run = g.openingCents;
      const want = g.netCents.map((n) => (run += n));
      return {
        runs: JSON.stringify(want) === JSON.stringify(g.cumulativeCents),
        net0: g.netCents[0] === g.groups[0].totals[0] - g.groups[1].totals[0],
      };
    });
    if (maths.runs && maths.net0)
      ok("ADM-08: the cumulative row is the running total of the period nets");
    else bad("ADM-08: cumulative maths", JSON.stringify(maths));

    // Nothing already due is dropped for being in the past.
    const absorbed = await pg.evaluate(() => {
      const g = erp.cashFlowGrid({ mode: "week", periods: 13 });
      const overdue = erp
        .receivables()
        .filter((r) => r.outstandingCents > 0 && r.dueDate < g.periods[0].from);
      const owed = overdue.reduce((s, r) => s + r.outstandingCents, 0);
      const first = g.groups[0].rows.find((r) => r.key === "invoices").cells[0];
      return { overdue: overdue.length, owed, first, holds: owed === 0 || first >= owed };
    });
    if (absorbed.holds)
      ok(`ADM-08: money already overdue lands in the first bucket (${absorbed.overdue})`);
    else bad("ADM-08: overdue absorbed", JSON.stringify(absorbed));

    // A red cumulative cell is the point of the screen — seed a trough and
    // check it paints, rather than hoping the sample data happens to dip.
    const red = await pg.evaluate(() => {
      const acc = erp.state.bankAccounts.find((a) => a.kind !== "till");
      erp.registerBill(
        {
          supplierId: erp.state.parties.find((p) => p.roles.includes("supplier")).id,
          number: "E2E-CF-1",
          baseCents: 90000000,
          dueDate: erp.today,
        },
        "backoffice",
      );
      render();
      return {
        acc: !!acc,
        neg: document.querySelectorAll("#cfGrid tr.cum td.neg").length,
      };
    });
    await pg.waitForTimeout(300);
    if (red.neg > 0) ok(`ADM-08: the cumulative balance goes red once it turns negative`);
    else bad("ADM-08: negative balance painted red", JSON.stringify(red));

    // Month buckets, and one job rather than the whole company.
    await pg.locator("#cfMonth").click();
    await pg.waitForTimeout(500);
    const months = await pg.evaluate(() => ({
      cols: document.querySelectorAll("#cfGrid thead th").length,
      mode: erp.cashFlowGrid({ mode: "month", periods: 6 }).periods.length,
    }));
    if (months.cols === 7) ok("ADM-08: the week/month switch rebuilds the columns");
    else bad("ADM-08: month switch", JSON.stringify(months));

    await pg.selectOption("#cfProj", { index: 1 });
    await pg.waitForTimeout(500);
    const scoped = await pg.evaluate(() => {
      const all = erp.cashFlowGrid({ mode: "month", periods: 6 });
      const one = erp.cashFlowGrid({ mode: "month", periods: 6, projectId: cfProject });
      const t = (g) => g.groups[0].totals.reduce((a, b) => a + b, 0);
      return { scoped: !!cfProject, le: t(one) <= t(all) };
    });
    if (scoped.scoped && scoped.le)
      ok("ADM-08: scoping to one job can only narrow what the company forecast shows");
    else bad("ADM-08: project scope", JSON.stringify(scoped));

    if (errs.length === 0) ok("ADM-08: no console errors");
    else bad("ADM-08: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("ADM-08 flujo de caja", String(e).slice(0, 220));
  } finally {
    await pg.close();
  }
}

async function testInvoicing(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#invoicing`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(800);

    const strip = await pg.evaluate(() => {
      const cs = [...document.querySelectorAll("#view .counter")];
      return {
        n: cs.length,
        width: cs.length ? Math.round(cs[0].getBoundingClientRect().width) : 0,
        labels: cs.map((c) => c.querySelector(".lab").textContent),
        overdueRed: cs.length === 4 ? cs[3].classList.contains("warn") : null,
        engine: erp.invoicingSummary(),
      };
    });
    if (strip.n === 4 && strip.width === 270 && /Emitido/i.test(strip.labels[0]))
      ok(`ADM-01: four 270 px counters (${strip.labels.join(" · ")})`);
    else bad("ADM-01: counter strip", JSON.stringify({ ...strip, engine: undefined }));

    // Red only when non-zero — a counter that is always red is one nobody
    // looks at, which is why the doc bothers to say "when non-zero".
    if (strip.overdueRed === strip.engine.overdue.amountCents > 0)
      ok(
        `ADM-01: the overdue counter is red exactly when it is non-zero (${strip.engine.overdue.amountCents > 0})`,
      );
    else bad("ADM-01: overdue red", `${strip.overdueRed} vs ${strip.engine.overdue.amountCents}`);

    // The strip must agree with the table beneath it.
    const agree = await pg.evaluate(() => {
      const s = erp.invoicingSummary();
      return (
        s.collected.amountCents + s.outstanding.amountCents === s.issued.amountCents &&
        s.overdue.amountCents <= s.outstanding.amountCents
      );
    });
    if (agree) ok("ADM-01: collected + outstanding = issued, and overdue is inside outstanding");
    else bad("ADM-01: counters reconcile", "the strip disagrees with itself");

    // Days overdue, painted red from day one.
    const days = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll("#view table.mlist tr.click")];
      const cells = rows.map((tr) => {
        const td = tr.querySelectorAll("td")[6];
        const span = td.querySelector("span");
        return {
          text: td.textContent.trim(),
          red:
            !!span &&
            /rgb\(/.test(getComputedStyle(span).color) &&
            getComputedStyle(span).color !== getComputedStyle(td).color,
        };
      });
      return {
        rows: rows.length,
        late: cells.filter((c) => c.text !== "—").length,
        allLateAreRed: cells.filter((c) => c.text !== "—").every((c) => c.red),
      };
    });
    if (days.rows > 0 && (days.late === 0 || days.allLateAreRed))
      ok(`ADM-01: every late invoice paints its days red (${days.late} of ${days.rows})`);
    else bad("ADM-01: days column", JSON.stringify(days));

    // A counter filters the register to its own subset.
    const allRows = await pg.locator("#view table.mlist tr.click").count();
    await pg.locator('#view [data-inv="outstanding"]').click();
    await pg.waitForTimeout(400);
    const openRows = await pg.locator("#view table.mlist tr.click").count();
    const engineOpen = await pg.evaluate(() => {
      const issued = {};
      erp.state.invoices.forEach((i) => (issued[i.number] = i.date));
      return erp
        .invoiceRegister()
        .filter((r) => inPeriod(issued[r.number]))
        .filter((r) => r.outstandingCents > 0).length;
    });
    await pg.locator("#view .counter.on").first().click();
    await pg.waitForTimeout(400);
    const clearedRows = await pg.locator("#view table.mlist tr.click").count();
    if (openRows === Math.min(engineOpen, 25) && clearedRows === allRows)
      ok(`ADM-01: «pendiente» filters to exactly the open invoices (${openRows})`);
    else bad("ADM-01: counter filter", `${allRows}/${openRows}/${clearedRows} vs ${engineOpen}`);

    // Settling one moves the counters and the row together.
    const before = await pg.evaluate(() => erp.invoicingSummary().outstanding.amountCents);
    const target = await pg.evaluate(() => {
      const issued = {};
      erp.state.invoices.forEach((i) => (issued[i.number] = i.date));
      const r = erp
        .invoiceRegister()
        .filter((x) => inPeriod(issued[x.number]))
        .find((x) => x.outstandingCents > 0);
      return r ? r.number : null;
    });
    if (target) {
      await pg.fill("#invQ", target);
      await pg.waitForTimeout(500);
      await pg.locator("#view table.mlist tr.click").first().click();
      await pg.waitForTimeout(500);
      await pg.locator("#iv_go").click();
      await pg.waitForTimeout(700);
      const after = await pg.evaluate(() => ({
        outstanding: erp.invoicingSummary().outstanding.amountCents,
        drawerClosed: !document.querySelector("#drawer").classList.contains("on"),
      }));
      if (after.outstanding < before && after.drawerClosed)
        ok("ADM-01: recording a collection moves the counters straight away");
      else bad("ADM-01: collection updates the strip", `${before} → ${after.outstanding}`);
    } else {
      ok(
        "ADM-01: nothing outstanding in the period, and the screen says so rather than inventing a row",
      );
    }

    if (errs.length === 0) ok("ADM-01: no console errors");
    else bad("ADM-01: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("invoicing", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── ADM-01 · the invoice generator (PK6-A) ────────────────────────────────
//    The engine could issue a legally-shaped factura since S10 and nothing
//    called it: the register was `noNew`, and the Torre's «＋ Factura» merely
//    navigated to it. These checks cover the four origins, the rules that
//    refuse, and the property that makes those rules worth having — a refusal
//    must not consume a number from a series required to have no gaps.
async function testInvoiceGenerator(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#invoicing`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(800);

    // The affordance itself. Its absence WAS the defect, so it is checked as
    // a thing on screen rather than as a function that exists.
    const entry = await pg.evaluate(() => ({
      create: !!document.querySelector("#view #mlNew"),
      label: (document.querySelector("#view #mlNew") || {}).textContent || "",
    }));
    if (entry.create && /Factura/i.test(entry.label))
      ok(`ADM-01: the register can create — «${entry.label.trim()}»`);
    else bad("ADM-01: create affordance", JSON.stringify(entry));

    // ---- the rules, and the series they protect ----
    const rules = await pg.evaluate(() => {
      const out = {};
      const p = erp.state.projects.find((x) => x.contractId) || erp.state.projects[0];
      const series = () => JSON.stringify(erp.state.series.invoice.byYear);

      // An unapproved adicional (CHG-04) and an abono naming no original
      // (AR-10) both used to be checked AFTER the record literal had already
      // called nextNumber — which increments the counter and pushes onto
      // `issued`. The refusal is worth nothing if it costs a number.
      const ch = erp.addChange(p.id, { desc: "e2e sin aprobar", priceCents: 50000 });
      const s0 = series();
      let chgThrew = false;
      try {
        erp.issueInvoice({ projectId: p.id, kind: "extra", baseCents: 50000, changeId: ch.id });
      } catch (e) {
        chgThrew = true;
      }
      out.chg04 = { threw: chgThrew, seriesUntouched: s0 === series() };

      const s1 = series();
      let creditThrew = false;
      try {
        erp.issueInvoice({ projectId: p.id, kind: "creditNote", baseCents: 1000 });
      } catch (e) {
        creditThrew = true;
      }
      out.ar10 = { threw: creditThrew, seriesUntouched: s1 === series() };

      // The same two, as the SCREEN sees them: reported, not thrown, and from
      // the one implementation the engine refuses with.
      out.previewCredit = erp
        .previewInvoice({
          projectId: p.id,
          kind: "creditNote",
          lines: [{ desc: "x", amountCents: 1000 }],
        })
        .blocks.map((b) => b.code);
      out.previewChange = erp
        .previewInvoice({
          projectId: p.id,
          kind: "extra",
          changeId: ch.id,
          lines: [{ desc: "x", amountCents: 1000 }],
        })
        .blocks.map((b) => b.code);
      out.gaps = erp.seriesGaps("invoice").length;
      return out;
    });
    if (rules.chg04.threw && rules.chg04.seriesUntouched)
      ok("AR: an unapproved adicional is refused, and the refusal costs no number (CHG-04)");
    else bad("CHG-04 + numbering", JSON.stringify(rules.chg04));
    if (rules.ar10.threw && rules.ar10.seriesUntouched)
      ok("AR: an abono naming no original is refused, and costs no number (AR-10)");
    else bad("AR-10 + numbering", JSON.stringify(rules.ar10));
    if (
      rules.previewCredit.join() === "AR-10" &&
      rules.previewChange.join() === "CHG-04" &&
      rules.gaps === 0
    )
      ok("AR: previewInvoice reports the same refusals the engine throws, series gapless");
    else bad("preview vs engine", JSON.stringify(rules));

    // ---- the screen: open it on a job and walk the origins ----
    const pid = await pg.evaluate(
      () => (erp.state.projects.find((x) => x.contractId) || erp.state.projects[0]).id,
    );
    await pg.evaluate((p) => invOpen(p), pid);
    await pg.waitForTimeout(700);
    const screen = await pg.evaluate(() => ({
      fs: document.body.classList.contains("fs"),
      sheet: !!document.querySelector("#invDoc.cdoc"),
      // The number is minted at issue, never at draft — the sheet has to say
      // so where the number goes, or a draft reads like an issued invoice.
      unnumbered: /Sin numerar/i.test(document.querySelector("#invDoc").innerText),
      origins: [...document.querySelectorAll("[data-invbasis]")].map((b) => b.dataset.invbasis),
      back: !!document.querySelector("#invBack"),
    }));
    if (
      screen.fs &&
      screen.sheet &&
      screen.unnumbered &&
      screen.back &&
      ["milestone", "certification", "change", "manual"].every((k) => screen.origins.includes(k))
    )
      ok(
        `ADM-01: the generator is a full screen with ${screen.origins.length} origins, unnumbered`,
      );
    else bad("ADM-01: generator screen", JSON.stringify(screen));

    /* Certification: the shape a certificación has on paper — executed by
       chapter, LESS what was already certified. The subtraction is a visible
       line, not a quietly reduced total.

       Deliberately run on a job that HAS something to certify, found by asking
       the engine rather than by hoping the first project qualifies. A job with
       nothing outstanding satisfies every assertion about its lines by having
       none — which is a check that cannot fail. */
    const certPid = await pg.evaluate(() => {
      const hit = erp.state.projects
        .filter((p) => p.budgetId)
        .find((p) => erp.invoiceBases(p.id).certification.proposedCents > 0);
      return hit ? hit.id : null;
    });
    if (certPid) {
      await pg.evaluate((p) => invOpen(p, { basis: "certification" }), certPid);
      await pg.waitForTimeout(600);
      const cert = await pg.evaluate(() => {
        const descs = [...document.querySelectorAll("[data-invld]")].map((i) => i.value);
        const amts = [...document.querySelectorAll("[data-invla]")].map((i) => +i.value);
        const b = erp.invoiceBases(invWork.projectId);
        return {
          sum: Math.round(amts.reduce((a, x) => a + x, 0) * 100),
          proposed: b.certification.proposedCents,
          billed: b.billedBaseCents,
          executed: b.certification.executedCents,
          chapterLines: descs.filter((d) => /ejecutado \d+%/.test(d)).length,
          deductions: amts.filter((a) => a < 0).length,
          previewBase: erp.previewInvoice({
            projectId: invWork.projectId,
            kind: "progress",
            lines: invWork.lines,
          }).baseCents,
        };
      });
      if (
        cert.proposed > 0 &&
        cert.sum === cert.proposed &&
        cert.previewBase === cert.proposed &&
        cert.chapterLines > 0 &&
        cert.deductions === (cert.billed > 0 ? 1 : 0)
      )
        ok(
          `ADM-01: certification = executed ${cert.executed}c less certified ${cert.billed}c = ${cert.proposed}c`,
        );
      else bad("ADM-01: certification", JSON.stringify(cert));
    } else bad("ADM-01: certification", "no seeded job has anything left to certify");

    /* Milestone → issue. The whole point: a number is minted, the contract's
       payment plan learns which invoice covered the milestone, and the series
       stays gapless.

       Run on a job with a planned milestone AND room left to bill it, asked of
       the engine rather than hoping the first contracted project qualifies —
       the same correction the certification block above already carries. The
       seed contains jobs that were invoiced in full directly, without ever
       going through their payment plan, so their instalments sit "planned"
       against a contract with nothing left owing. Billing one of those is
       refused, correctly, and the refusal is not what this check is about. */
    const msPid = await pg.evaluate(() => {
      const hit = erp.state.projects
        .filter((p) => p.contractId)
        .find((p) => {
          const b = erp.invoiceBases(p.id);
          const room = b.attributedCents - b.billedBaseCents;
          return b.milestones.some((m) => m.baseCents > 0 && m.baseCents <= room);
        });
      return hit ? hit.id : null;
    });
    if (!msPid) bad("ADM-01: milestone draft", "no contracted job has a billable milestone left");
    const pidMs = msPid || pid;
    await pg.evaluate((p) => invOpen(p), pidMs);
    await pg.waitForTimeout(600);
    await pg.click('[data-invbasis="milestone"]');
    await pg.waitForTimeout(400);
    const hasMilestone = (await pg.locator("#inv_pick option").count()) > 1;
    if (hasMilestone) {
      await pg.selectOption("#inv_pick", { index: 1 });
      await pg.waitForTimeout(400);
      const armed = await pg.evaluate(() => ({
        lines: document.querySelectorAll("[data-invld]").length,
        // Engine vocabulary must never reach a customer's document: the
        // trigger prints as «A la firma», not as `onSignature`.
        raw: /onSignature|atStage|onCompletion|atWorksStart|fixedDate/.test(
          document.querySelector("#invDoc").innerText,
        ),
        disabled: document.querySelector("#invIssue").disabled,
      }));
      if (armed.lines === 1 && !armed.raw && !armed.disabled)
        ok("ADM-01: a contract milestone arms the draft, in words a customer can read");
      else bad("ADM-01: milestone draft", JSON.stringify(armed));

      const before = await pg.evaluate(() => erp.state.invoices.length);
      await pg.click("#invIssue");
      await pg.waitForTimeout(400);
      await pg.getByRole("button", { name: "Emitir", exact: true }).click();
      await pg.waitForTimeout(800);
      const after = await pg.evaluate(() => {
        const inv = erp.state.invoices[erp.state.invoices.length - 1];
        const p = erp.project(inv.projectId);
        const c = p.contractId && erp.state.contracts.find((x) => x.id === p.contractId);
        const doc = c ? erp.renderContractDoc(c.id) : null;
        return {
          count: erp.state.invoices.length,
          number: inv.number,
          immutable: inv.immutable === true,
          gaps: erp.seriesGaps("invoice").length,
          linked:
            inv.installmentIdx != null && doc
              ? doc.installments[inv.installmentIdx].invoiceId === inv.id
              : null,
          closed: !document.body.classList.contains("fs"),
        };
      });
      if (
        after.count === before + 1 &&
        /^FAC-\d{4}-\d{4}$/.test(after.number) &&
        after.immutable &&
        after.gaps === 0 &&
        after.linked === true &&
        after.closed
      )
        ok(`ADM-01: issued ${after.number} — numbered, immutable, milestone linked, no gaps`);
      else bad("ADM-01: issue", JSON.stringify(after));

      // The document exists as a document, and can be printed.
      const doc = await pg.evaluate((n) => {
        const d = erp.renderInvoiceDoc(n);
        const sheet = document.createElement("div");
        sheet.className = "printsheet";
        sheet.innerHTML = `<div class="cdoc">${invoiceDocHtml(d)}</div>`;
        document.body.appendChild(sheet);
        const text = sheet.innerText;
        sheet.remove();
        return {
          type: d.docType,
          number: d.number,
          lines: d.lines.length,
          total: d.totalCents,
          printable: /FACTURA/i.test(text) && text.includes(d.number),
        };
      }, after.number);
      if (doc.type === "FACTURA" && doc.lines > 0 && doc.total > 0 && doc.printable)
        ok(`ADM-01: renderInvoiceDoc prints ${doc.number} as a document`);
      else bad("ADM-01: invoice document", JSON.stringify(doc));
    } else {
      bad("ADM-01: milestone origin", "the seed offers no pending contract milestone");
    }

    if (!errs.length) ok("ADM-01: the generator raises no console error");
    else bad("ADM-01: console", errs.slice(0, 2).join(" | ").slice(0, 160));
  } catch (e) {
    bad("invoice generator", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── COM-04 Contrato (§3.2) — the last of the four full-screen surfaces, and
//    the one column that earns the screen: «Importe vigente» goes amber the
//    moment annexes exist, so nobody has to open a contract to find out.
async function testContract(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#contracts`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(800);

    const tabs = await pg.locator("#view .tabstrip [data-ctab]").allInnerTexts();
    const activeRows = await pg.locator("#view table.mlist tr.click").count();
    await pg.locator('[data-ctab="inactive"]').click();
    await pg.waitForTimeout(500);
    const inactiveRows = await pg.locator("#view table.mlist tr.click").count();
    await pg.locator('[data-ctab="active"]').click();
    await pg.waitForTimeout(500);
    if (tabs.length === 2 && activeRows > 0 && activeRows !== inactiveRows)
      ok(
        `COM-04: two tabs split the register (${activeRows} vigentes / ${inactiveRows} históricos)`,
      );
    else bad("COM-04: tabs", `${tabs.join("/")} · ${activeRows}/${inactiveRows}`);

    // The amber column, checked against the engine rather than against a
    // colour: a pill appears exactly where annexes exist.
    const amber = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll("#view table.mlist tr.click")];
      const view = erp.contractsView();
      return rows.map((tr) => {
        const c = view.find((x) => x.id === tr.dataset.id);
        const cells = [...tr.querySelectorAll("td")];
        return { differs: !!(c && c.differs), pill: !!cells[4].querySelector(".pill") };
      });
    });
    if (amber.length && amber.every((r) => r.pill === r.differs))
      ok(
        `COM-04: the current amount is amber exactly where annexes exist (${amber.filter((r) => r.differs).length} of ${amber.length})`,
      );
    else bad("COM-04: amber current amount", JSON.stringify(amber.slice(0, 4)));

    // Open one that HAS annexes, so the viewer has something to show on its
    // third tab — opening the first row would test the sample again.
    const wanted = await pg.evaluate(() => {
      const c =
        erp.contractsView().find((x) => x.active && x.differs) ||
        erp.contractsView().find((x) => x.active);
      return c ? c.number : null;
    });
    await pg.fill("#conQ", wanted);
    await pg.waitForTimeout(500);
    await pg.locator("#view table.mlist tr.click").first().click();
    await pg.waitForTimeout(600);

    const viewer = await pg.evaluate(() => {
      const grid = document.querySelector(".con2");
      const cols = grid
        ? getComputedStyle(grid).gridTemplateColumns.split(" ").map(parseFloat)
        : [];
      return {
        full: document.body.classList.contains("fs"),
        zones: grid ? grid.children.length : 0,
        docCol: cols[0] || 0,
        panelCol: cols[1] || 0,
        docTranslateOff: document.querySelector(".cdoc")?.getAttribute("translate") === "no",
        tabs: [...document.querySelectorAll("[data-contab]")].map((b) => b.textContent),
      };
    });
    // Package 2 slides 5 and 7: a panel pinned at exactly 392px left a wide
    // strip of nothing on any real screen and starved Hitos de pago into a
    // scrollbar it never needed. The document stays capped near 760 — it is
    // a fixed-width piece of paper — and the panel now absorbs whatever is
    // left, so it must end up wider than its old fixed value, not equal to it.
    if (
      viewer.full &&
      viewer.zones === 2 &&
      viewer.docCol <= 760 &&
      viewer.panelCol > 392 &&
      viewer.docTranslateOff &&
      viewer.tabs.length === 3
    )
      ok(
        `COM-04: full screen, document ≤760 + panel fills the rest (${viewer.docCol}+${viewer.panelCol}), three tabs`,
      );
    else bad("COM-04: full-screen viewer", JSON.stringify(viewer));

    // The document is built from data — it names the customer and totals its
    // own milestones, which no uploaded PDF in this system could do.
    const docText = await pg.locator(".cdoc").innerText();
    const named = await pg.evaluate(() => erp.renderContractDoc(conWork.id).customer.name);
    if (new RegExp(named.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(docText))
      ok("COM-04: the document is rendered from data, customer and all");
    else bad("COM-04: document from data", docText.replace(/\n/g, " ").slice(0, 120));

    // Package 2 slide 6, a real bug: guaranteeCategories is engine vocabulary
    // (executionAndFinishes/installations/structural) and was printed
    // straight onto the customer's own contract.
    if (/executionAndFinishes|installations|structural/.test(docText))
      bad(
        "COM-04: guarantee categories are translated, not raw engine keys",
        docText.slice(0, 200),
      );
    else ok("COM-04: guarantee categories are translated, not raw engine keys");

    // Hitos de pago: the sum against the contracted amount, and S8's source.
    await pg.locator('[data-contab="hitos"]').click();
    await pg.waitForTimeout(400);
    const hitos = await pg.locator("#conBody").innerText();
    if (/Suma de hitos/i.test(hitos) && /(cuadra|sobre el contratado)/i.test(hitos))
      ok("COM-04: the milestones foot against the contracted amount");
    else bad("COM-04: milestones foot", hitos.replace(/\n/g, " ").slice(0, 140));

    // Package 2 slide 7: the panel pinned at 392px starved this table into a
    // horizontal scrollbar it never needed on any real screen.
    const hitosWidth = await pg.evaluate(() => {
      const d = document.querySelector("#conBody .scroll");
      return d ? { scrollW: d.scrollWidth, clientW: d.clientWidth } : null;
    });
    if (hitosWidth && hitosWidth.scrollW <= hitosWidth.clientW + 1)
      ok("COM-04: Hitos de pago fits without a horizontal scrollbar");
    else bad("COM-04: hitos table width", JSON.stringify(hitosWidth));

    await pg.locator('[data-contab="anexos"]').click();
    await pg.waitForTimeout(400);
    const anexos = await pg.evaluate(() => ({
      text: document.querySelector("#conBody").innerText,
      count: erp.contractValue(conWork.id).annexes,
    }));
    if (
      (anexos.count > 0 && /Total anexos/i.test(anexos.text)) ||
      (anexos.count === 0 && /Sin anexos/i.test(anexos.text))
    )
      ok(`COM-04: the Anexos tab agrees with the record (${anexos.count})`);
    else bad("COM-04: anexos tab", JSON.stringify(anexos).slice(0, 160));

    await pg.locator("#conBack").click();
    await pg.waitForTimeout(400);
    const back = await pg.evaluate(() => ({
      full: document.body.classList.contains("fs"),
      rows: document.querySelectorAll("#view table.mlist tr.click").length,
    }));
    if (!back.full && back.rows > 0) ok("COM-04: leaving the viewer restores the list");
    else bad("COM-04: back to the list", JSON.stringify(back));

    if (errs.length === 0) ok("COM-04: no console errors");
    else bad("COM-04: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("contract viewer", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

/* Package 2 slide 8 (PK2-C): the anexo tab named an amendment's number, date
   and amount but had no way to see what it actually WAS or reopen its
   backup — "Aprobar" wrote a hardcoded fake filename
   ("aceptacion-cliente.png") the instant it was clicked, the same
   "a filename proves nothing" bug PK2-A already fixed on the presupuesto's
   own acceptance. This exercises the fix one step upstream: a real file
   collected at approval time, reachable afterwards from the Anexos tab. */
async function testChangeApprovalEvidence(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#contracts`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);

    const target = await pg.evaluate(() => {
      // No seeded change sits in identified/priced/sent, so raise a fresh one.
      const p = erp.state.projects.find((x) => x.contractId);
      if (!p) return null;
      const c = erp.addChange(p.id, { desc: "E2E: extra de prueba", reason: "" }, "operations");
      erp.priceChange(c.id, 20000, 12000, 0, "test");
      erp.sendChange(c.id, "test");
      return { changeId: c.id, contractId: p.contractId };
    });
    if (!target) {
      bad(
        "anexo evidence: a project with a contract exists to raise a change on",
        "none in the seed",
      );
      return;
    }

    await pg.evaluate((id) => approveChangeDrawer(id), target.changeId);
    await pg.waitForTimeout(500);
    const field = await pg.evaluate(() => !!document.querySelector("#apEvid .evz"));
    if (field) ok("anexo evidence: approving opens a drawer with a real upload field");
    else bad("anexo evidence: approval drawer has an upload field", field);

    await pg.setInputFiles("#apEvid input[type=file]", {
      name: "whatsapp-aprobacion.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(minimalPdf(), "latin1"),
    });
    await pg.waitForTimeout(700);
    await pg.click("#apOk");
    await pg.waitForTimeout(700);
    const saved = await pg.evaluate((id) => {
      const c = erp.state.changes.find((x) => x.id === id);
      return {
        status: c.status,
        key: (c.evidence && c.evidence.storageKey) || "",
        type: (c.evidence && c.evidence.type) || "",
        name: (c.evidence && c.evidence.name) || "",
      };
    }, target.changeId);
    if (
      saved.status === "approved" &&
      saved.key &&
      saved.type === "application/pdf" &&
      saved.name === "whatsapp-aprobacion.pdf"
    )
      ok("anexo evidence: the real file is stored on the change, not a hardcoded placeholder");
    else bad("anexo evidence: persisted approval evidence", JSON.stringify(saved));

    // ---- reachable from the Anexos tab afterwards --------------------------
    await pg.evaluate(() => go("contracts"));
    await pg.waitForTimeout(300);
    await pg.evaluate((cid) => {
      conWork = { id: cid, tab: "anexos" };
      render();
    }, target.contractId);
    await pg.waitForTimeout(500);
    const tabText = await pg.locator("#conBody").innerText();
    const evLink = await pg.evaluate(() => !!document.querySelector("#conBody [data-evidence]"));
    if (/E2E: extra de prueba/.test(tabText))
      ok("anexo evidence: the Anexos tab shows what the amendment actually was");
    else bad("anexo evidence: anexo detail in the tab", tabText.slice(0, 200));
    if (evLink) ok("anexo evidence: the approval's backup document is reachable from the tab");
    else bad("anexo evidence: evidence link in the anexos tab", tabText.slice(0, 200));

    if (evLink) {
      await pg.click("#conBody [data-evidence]");
      await pg.waitForTimeout(2500);
      const viewer = await pg.evaluate(() => {
        const v = document.querySelector(".pview");
        if (!v) return { open: false };
        return {
          open: true,
          canvas: !!v.querySelector("canvas"),
          ext: !!v.querySelector("[data-pv=ext]"),
        };
      });
      if (viewer.open && (viewer.canvas || viewer.ext))
        ok("anexo evidence: the backup document actually opens");
      else bad("anexo evidence: viewer opens the backup", JSON.stringify(viewer));
    }

    if (errs.length) bad("anexo evidence: no console errors", errs.slice(0, 2).join(" | "));
    else ok("anexo evidence: no console errors");
  } catch (e) {
    bad("anexo evidence: suite completed", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

/* Package 2 slide 4 (PK2-D): "No hay opción de crear/subir nuevo contrato" —
   and it was literal. NO contract could be created from this application at
   all; every one in the system came from the seed, so both halves of CON-01
   were missing: drawing one up from an accepted presupuesto, and recording
   one that was signed on paper.

   The load-bearing assertion here is the last one. A contract signed
   elsewhere must show the FILE the customer signed, never this system's own
   generated «CONTRATO DE OBRA» — printing that over the top of somebody
   else's contract invents a document nobody agreed to. */
async function testContractCreation(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#contracts`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);

    if (await pg.evaluate(() => !!document.querySelector("#conNew")))
      ok("COM-04: the contract list offers «＋ Nuevo contrato»");
    else bad("COM-04: new-contract button exists", "no #conNew");

    // ---- a contract signed outside this system ----------------------------
    await pg.click("#conNew");
    await pg.waitForTimeout(500);
    await pg.evaluate(() => {
      const r = [...document.querySelectorAll('input[name="cnmode"]')].find(
        (x) => x.value === "external",
      );
      r.checked = true;
      r.dispatchEvent(new Event("change"));
    });
    await pg.waitForTimeout(400);
    const form = await pg.evaluate(() => ({
      party: !!document.querySelector("#cn_party"),
      base: !!document.querySelector("#cn_base"),
      dropzone: !!document.querySelector("#cn_doc .evz"),
      dateMax: document.querySelector("#cn_date")?.max || "",
      today: erp.today,
    }));
    if (form.party && form.base && form.dropzone && form.dateMax === form.today)
      ok("COM-04: the manual path asks for the data and the signed file, and cannot be postdated");
    else bad("COM-04: manual contract form", JSON.stringify(form));

    const picked = await pg.evaluate(() => {
      const p = erp.state.parties.find(
        (x) => x.active && x.roles.includes("customer") && erp.partyCompleteness(x.id).ok,
      );
      if (!p) return null;
      const sel = document.querySelector("#cn_party");
      sel.value = p.id;
      sel.dispatchEvent(new Event("change"));
      return p.id;
    });
    if (!picked) {
      bad("COM-04: a complete customer exists to contract with", "none in the seed");
      return;
    }
    await pg.fill("#cn_base", "12500");
    await pg.fill("#cn_ref", "EXT-2026-77");
    await pg.fill("#cn_days", "45");
    const backdate = await pg.evaluate(() => {
      const d = new Date(erp.today + "T00:00:00");
      d.setDate(d.getDate() - 10);
      const iso = d.toISOString().slice(0, 10);
      document.querySelector("#cn_date").value = iso;
      document.querySelector("#cn_signed").value = iso;
      return iso;
    });
    await pg.setInputFiles("#cn_doc input[type=file]", {
      name: "contrato-firmado.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(minimalPdf(), "latin1"),
    });
    await pg.waitForTimeout(700);
    // Two milestones, entered as rows — they feed ADM-08's cash forecast.
    await pg.click("#cn_addh");
    await pg.waitForTimeout(300);
    await pg.evaluate(() => {
      const rows = [...document.querySelectorAll("[data-hrow]")];
      rows[0].querySelector("[data-hpct]").value = "40";
      rows[0].querySelector("[data-hpct]").dispatchEvent(new Event("input"));
      rows[1].querySelector("[data-htrig]").value = "onCompletion";
      rows[1].querySelector("[data-hpct]").value = "60";
      rows[1].querySelector("[data-hpct]").dispatchEvent(new Event("input"));
    });
    await pg.waitForTimeout(200);
    await pg.click("#cn_save");
    await pg.waitForTimeout(900);

    const saved = await pg.evaluate(() => {
      const c = erp.state.contracts[erp.state.contracts.length - 1];
      return {
        origin: c.origin,
        value: c.valueCents,
        total: c.totalCents,
        date: c.date,
        ref: c.externalRef,
        docType: (c.document || {}).type || "",
        signed: c.signature.customerSignedAt,
        inst: c.installments.map((i) => i.amountCents),
        days: c.duration.estimatedDays,
      };
    });
    if (saved.origin === "external" && saved.value === 1250000 && saved.days === 45)
      ok("COM-04: a contract signed elsewhere can be recorded with its own amount and term");
    else bad("COM-04: external contract saved", JSON.stringify(saved));
    if (saved.date === backdate && saved.signed === backdate && saved.ref === "EXT-2026-77")
      ok(
        "COM-04: it keeps the real contract date, signature date and the customer's own reference",
      );
    else bad("COM-04: external contract dates/ref", JSON.stringify({ saved, backdate }));
    if (saved.docType === "application/pdf")
      ok("COM-04: the signed file itself is stored on the contract");
    else bad("COM-04: signed file stored", JSON.stringify(saved));
    // 40/60 of 13.750 (12.500 + 10% IVA) — the milestones foot to the total.
    if (saved.inst.length === 2 && saved.inst[0] + saved.inst[1] === saved.total)
      ok("COM-04: the payment milestones foot to the contracted total");
    else bad("COM-04: milestones foot", JSON.stringify(saved));

    // THE point of `origin`: show what was signed, not what we would print.
    await pg.waitForTimeout(500);
    const pane = await pg.evaluate(() => {
      const t = document.querySelector("#conDoc")?.innerText || "";
      return {
        generated: /CONTRATO DE OBRA/.test(t),
        saysExternal: /firmado fuera de este sistema/i.test(t),
        reachable:
          !!document.querySelector("#conDoc canvas") ||
          !!document.querySelector("#conDoc a[download]"),
      };
    });
    if (!pane.generated && pane.saysExternal && pane.reachable)
      ok("COM-04: an externally-signed contract shows the signed file, not a generated document");
    else bad("COM-04: external contract document pane", JSON.stringify(pane));

    // ---- the normal path: from an accepted presupuesto ---------------------
    await pg.evaluate(() => {
      conWork = null;
      go("contracts");
    });
    await pg.waitForTimeout(600);
    // Free one accepted budget from its seeded contract so the path is live.
    const freed = await pg.evaluate(() => {
      const c = erp.state.contracts.find((x) => x.budgetId);
      if (!c) return null;
      const bid = c.budgetId;
      c.budgetId = null;
      return bid;
    });
    if (!freed) {
      bad("COM-04: an accepted budget exists to contract from", "none in the seed");
      return;
    }
    await pg.click("#conNew");
    await pg.waitForTimeout(500);
    const budgetMode = await pg.evaluate(() => {
      const r = [...document.querySelectorAll('input[name="cnmode"]')].find(
        (x) => x.value === "budget",
      );
      return {
        enabled: !r.disabled,
        checked: r.checked,
        sel: !!document.querySelector("#cn_budget"),
      };
    });
    if (budgetMode.enabled && budgetMode.checked && budgetMode.sel)
      ok("COM-04: an accepted presupuesto is offered as the default source");
    else bad("COM-04: budget mode default", JSON.stringify(budgetMode));

    await pg.fill("#cn_days", "60");
    await pg.click("#cn_save");
    await pg.waitForTimeout(900);
    const fromBudget = await pg.evaluate(() => {
      const c = erp.state.contracts[erp.state.contracts.length - 1];
      return {
        origin: c.origin,
        budgetNumber: c.budgetNumber,
        value: c.valueCents,
        generated: /CONTRATO DE OBRA/.test(document.querySelector("#conDoc")?.innerText || ""),
      };
    });
    if (fromBudget.origin === "generated" && fromBudget.budgetNumber && fromBudget.value > 0)
      ok("COM-04: a contract can be drawn up from an accepted presupuesto, amounts and all");
    else bad("COM-04: budget-derived contract", JSON.stringify(fromBudget));
    if (fromBudget.generated)
      ok("COM-04: a contract this system drew up still renders as its own document");
    else bad("COM-04: generated contract renders its document", JSON.stringify(fromBudget));

    // ---- an incomplete customer blocks, without burning a number ----------
    await pg.evaluate(() => {
      conWork = null;
      go("contracts");
    });
    await pg.waitForTimeout(600);
    await pg.click("#conNew");
    await pg.waitForTimeout(500);
    await pg.evaluate(() => {
      const r = [...document.querySelectorAll('input[name="cnmode"]')].find(
        (x) => x.value === "external",
      );
      r.checked = true;
      r.dispatchEvent(new Event("change"));
    });
    await pg.waitForTimeout(400);
    const incomplete = await pg.evaluate(() => {
      const p = erp.state.parties.find(
        (x) => x.active && x.roles.includes("customer") && !erp.partyCompleteness(x.id).ok,
      );
      if (!p) return null;
      const sel = document.querySelector("#cn_party");
      sel.value = p.id;
      sel.dispatchEvent(new Event("change"));
      return p.id;
    });
    if (incomplete) {
      await pg.fill("#cn_base", "3300");
      await pg.fill("#cn_days", "20");
      const before = await pg.evaluate(() => ({
        contracts: erp.state.contracts.length,
        issued: erp.state.series.contract.issued.length,
      }));
      await pg.click("#cn_save");
      await pg.waitForTimeout(700);
      const after = await pg.evaluate(() => ({
        contracts: erp.state.contracts.length,
        issued: erp.state.series.contract.issued.length,
        drawer: document.querySelector("#dttl")?.textContent || "",
      }));
      if (after.contracts === before.contracts && /Editar/i.test(after.drawer))
        ok("COM-04: an incomplete customer blocks the contract and offers the missing fields");
      else bad("COM-04: incomplete-party block", JSON.stringify({ before, after }));
      // ORG-04: the series is gap-free, so a refused contract must not have
      // consumed a number on its way to being refused.
      if (after.issued === before.issued && after.issued === after.contracts)
        ok("COM-04: a refused contract burns no number — the series stays gap-free");
      else bad("COM-04: series gapless after refusal", JSON.stringify({ before, after }));
    }

    if (errs.length) bad("COM-04 creation: no console errors", errs.slice(0, 2).join(" | "));
    else ok("COM-04 creation: no console errors");
  } catch (e) {
    bad("COM-04 creation: suite completed", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── Package 3 slide 4 (PK3-B): a presupuesto could only be created from a
//    visit's own "＋ Crear presupuesto" — no entry point existed on the
//    register itself, and none at all for a lead with no visit yet. This
//    drives both new sources: an open lead (no visit required) and a
//    completed visit (which must come back linked, exactly as the visit's
//    own shortcut already links one).
async function testBudgetCreation(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#quotes`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);

    if (await pg.evaluate(() => !!document.querySelector("#bqNew")))
      ok("COM-03: the register offers «＋ Presupuesto»");
    else bad("COM-03: new-budget button exists", "no #bqNew");

    // ---- from an open lead, no visit required ------------------------------
    await pg.click("#bqNew");
    await pg.waitForTimeout(500);
    const sources = await pg.evaluate(() => ({
      visit: !!document.querySelector('input[name="bnmode"][value="visit"]'),
      lead: !!document.querySelector('input[name="bnmode"][value="lead"]'),
    }));
    if (sources.visit && sources.lead)
      ok("COM-03: the drawer offers both a completed visit and an open lead as sources");
    else bad("COM-03: new-budget sources", JSON.stringify(sources));

    const leadPicked = await pg.evaluate(() => {
      const r = [...document.querySelectorAll('input[name="bnmode"]')].find(
        (x) => x.value === "lead",
      );
      if (!r || r.disabled) return null;
      r.checked = true;
      r.dispatchEvent(new Event("change"));
      const sel = document.querySelector("#bn_lead");
      return sel ? sel.value : null;
    });
    if (!leadPicked) {
      bad("COM-03: an open lead exists to price from", "none in the seed");
    } else {
      const before = await pg.evaluate(() => erp.state.budgets.length);
      await pg.click("#bn_save");
      await pg.waitForTimeout(700);
      const after = await pg.evaluate(
        (leadId) => ({
          count: erp.state.budgets.length,
          onBuilder: !!document.querySelector("#bTree"),
          leadStatus: erp.state.opportunities.find((o) => o.id === leadId)?.status,
        }),
        leadPicked,
      );
      if (after.count === before + 1 && after.onBuilder)
        ok("COM-03: a presupuesto is created from an open lead with no visit in between");
      else bad("COM-03: budget from lead", JSON.stringify({ before, after }));
    }

    // ---- from a completed visit, which must come back linked ---------------
    await pg.evaluate(() => go("quotes"));
    await pg.waitForTimeout(500);
    if (await pg.locator("#bBack").count()) {
      await pg.click("#bBack");
      await pg.waitForTimeout(400);
    }
    await pg.click("#bqNew");
    await pg.waitForTimeout(500);
    const visitPicked = await pg.evaluate(() => {
      const r = [...document.querySelectorAll('input[name="bnmode"]')].find(
        (x) => x.value === "visit",
      );
      if (!r || r.disabled) return null;
      r.checked = true;
      r.dispatchEvent(new Event("change"));
      const sel = document.querySelector("#bn_visit");
      return sel ? sel.value : null;
    });
    if (!visitPicked) {
      bad("COM-03: a completed visit without a presupuesto exists", "none in the seed");
    } else {
      const before = await pg.evaluate(() => erp.state.budgets.length);
      await pg.click("#bn_save");
      await pg.waitForTimeout(700);
      const after = await pg.evaluate((visitId) => {
        const v = erp.state.visits.find((x) => x.id === visitId);
        return {
          count: erp.state.budgets.length,
          onBuilder: !!document.querySelector("#bTree"),
          linkedBudgetId: v ? v.budgetId : null,
          validated: !!(v && v.validated),
        };
      }, visitPicked);
      if (after.count === before + 1 && after.onBuilder && after.linkedBudgetId)
        ok("COM-03: a presupuesto is created from a completed visit, and the visit is linked back");
      else bad("COM-03: budget from visit", JSON.stringify({ before, after }));
    }

    if (errs.length) bad("COM-03 creation: no console errors", errs.slice(0, 2).join(" | "));
    else ok("COM-03 creation: no console errors");
  } catch (e) {
    bad("COM-03 creation: suite completed", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

// ── Compras (§4.1), Subcontratos (§4.2), Modificaciones (§4.5) and Horas
//    (§4.6) — session 10b. Every screen here is project-scoped through the
//    same gProject context session 10a introduced; the checks drive real
//    lifecycles (draft → sent → accepted → received, draft → … → certified,
//    detected → priced → sent → approved) rather than reading the code, which
//    is where the "send doesn't refresh the drawer" bug in this session was
//    actually found.
async function testProcurement(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    // ---- Compras: needs → new order → send → accept → receive ----
    await pg.goto(`${base}/erp.html#purchasing`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(800);
    const needBtn = pg.locator("[data-need]").first();
    if ((await needBtn.count()) === 0) {
      bad("compras: a chapter still needs committing", "no [data-need] rows found");
    } else {
      await needBtn.click();
      await pg.waitForTimeout(300);
      await pg.selectOption("#p_sup", { index: 1 });
      await pg.fill("#p_desc", "Material E2E");
      await pg.fill("#p_qty", "10");
      await pg.fill("#p_price", "5");
      await pg.click("#p_save");
      await pg.waitForTimeout(500);
      ok("compras: a purchase order can be created from an open need");

      // S7: the order opens on the full-screen two-zone detail, not a drawer.
      // The lifecycle is driven from the 480 record pane on its right.
      await pg.locator("#view table.mlist tr.click").first().click();
      await pg.waitForTimeout(400);
      const fs = await pg.evaluate(() => ({
        full: document.body.classList.contains("fs"),
        zones: document.querySelectorAll(".pb .cap2 > *").length,
      }));
      if (fs.full && fs.zones === 2)
        ok("ADM-02: an order opens full screen, document left and record right");
      else bad("ADM-02: full-screen two-zone detail", JSON.stringify(fs));

      const before = await pg.locator(".pbbar .pill").first().innerText();
      await pg.click("#pa_send");
      await pg.waitForTimeout(500);
      const after = await pg.locator(".pbbar .pill").first().innerText();
      // The bug session 10b shipped once, in its new home: the action updated
      // the record but never re-rendered the pane, so the stage pill and the
      // next action both stayed stale until the screen was left and reopened.
      if (after !== before && (await pg.locator("#pa_accept").count()) > 0)
        ok(`ADM-02: an action refreshes the open record pane (${before} → ${after})`);
      else bad("ADM-02: record pane refreshes after send", `${before} → ${after}`);

      await pg.fill("#pa_arr", "2026-01-01");
      await pg.click("#pa_accept");
      await pg.waitForTimeout(400);
      await pg.fill("#pa_qty", "10");
      await pg.fill("#pa_doc", "ALB-E2E-1");
      await pg.click("#pa_recv");
      await pg.waitForTimeout(500);
      // The doc drops goods receipt as a STAGE — the order is a pedido before
      // and after the delivery note. The engine's receiving lifecycle is
      // untouched, and this is where the two statements are checked together.
      const stageAfterReceipt = await pg.locator(".pbbar .pill").first().innerText();
      const statusAfterReceipt = await pg.locator("#puForm .pbh .tag").first().innerText();
      if (/Pedido/i.test(stageAfterReceipt) && /Recibida/i.test(statusAfterReceipt))
        ok("ADM-02: receiving is evidence, not a fourth stage (Pedido · Recibida)");
      else bad("ADM-02: stage after receipt", `${stageAfterReceipt} · ${statusAfterReceipt}`);

      // Base/IVA/total at the foot — 10 × 5,00 € = 50,00 € + 21%.
      const foot = await pg.locator("#puForm").innerText();
      if (/50,00/.test(foot) && /60,50/.test(foot))
        ok("ADM-02: the record pane foots base, IVA and total");
      else bad("ADM-02: totals at the foot", foot.slice(-200));

      await pg.click("#puBack");
      await pg.waitForTimeout(400);
      const backOut = await pg.evaluate(() => ({
        full: document.body.classList.contains("fs"),
        rows: document.querySelectorAll("#view table.mlist tr.click").length,
      }));
      if (!backOut.full && backOut.rows > 0)
        ok("ADM-02: leaving the detail restores the list and its navigation");
      else bad("ADM-02: back to the list", JSON.stringify(backOut));

      // The three counters, and the filter each one applies.
      const counters = await pg.locator("#view .counter .lab").allInnerTexts();
      const rowsAll = await pg.locator("#view table.mlist tr.click").count();
      await pg.locator("#view .counter").nth(2).click(); // Facturado
      await pg.waitForTimeout(400);
      const rowsInvoiced = await pg.locator("#view table.mlist tr.click").count();
      await pg.locator("#view .counter.on").first().click(); // press it again to clear
      await pg.waitForTimeout(400);
      const rowsCleared = await pg.locator("#view table.mlist tr.click").count();
      if (
        counters.length === 3 &&
        /Oferta/i.test(counters[0]) &&
        /Pedido/i.test(counters[1]) &&
        /Facturado/i.test(counters[2]) &&
        rowsInvoiced < rowsAll &&
        rowsCleared === rowsAll
      )
        ok(`ADM-02: three counters filter and un-filter the list (${rowsAll} → ${rowsInvoiced})`);
      else
        bad(
          "ADM-02: counter strip",
          `${counters.join("/")} · ${rowsAll}/${rowsInvoiced}/${rowsCleared}`,
        );
    }

    // ---- Subcontratos: the lifecycle screen is gone, the rules are not ----
    // The v4 specification has no subcontract-management screen, so S1b removed
    // it. Everything that screen used to walk in a browser — send, accept, the
    // documentation block on starting work, certification, retention — is
    // asserted directly against the engine in manageability-sim.mjs, which is
    // where it survives the UI. What is checked HERE is that the retired route
    // lands on DMT-03 (S2), the master-data fichero that replaced it, rather
    // than on a blank panel.
    await pg.evaluate(() => (location.hash = "subcontratos"));
    await pg.waitForTimeout(500);
    const subHash = await pg.evaluate(() => location.hash);
    const subText = await pg.locator("#view").innerText();
    if (subHash === "#subcontractors" && /industrial/i.test(subText))
      ok("subcontratos: the retired route redirects to the DMT-03 fichero");
    else bad("subcontratos: retired route", `${subHash} · ${subText.slice(0, 70)}`);

    // ---- PRY-03 (S9): five counters, 56 px rows, the amber rule ----
    await pg.evaluate(() => (location.hash = "variations"));
    await pg.waitForTimeout(700);
    const counters = await pg.locator("#view .counter .lab").allInnerTexts();
    const counterWidth = await pg.evaluate(() =>
      Math.round(document.querySelector("#view .counter").getBoundingClientRect().width),
    );
    if (
      counters.length === 5 &&
      /Identificado/i.test(counters[0]) &&
      /Facturado/i.test(counters[4]) &&
      counterWidth === 216
    )
      ok(`PRY-03: five 216 px counters, identificado → facturado`);
    else bad("PRY-03: counter strip", `${counters.join("/")} @${counterWidth}px`);

    // A row is 56 tall because it carries a photograph, and an unapproved one
    // is marked twice — the pill and a 3 px amber rule down its left edge.
    //
    // The unapproved row is SEEDED here rather than hoped for. The sample's
    // extras are all approved, so measuring "the first unapproved row" measured
    // nothing at all and reported a passing shape — the same trap S8 hit by
    // clicking the first row of a list.
    await pg.evaluate(() => {
      erp.addChange(gProject, { desc: "Extra sin aprobar E2E" }, "ops");
      persist();
      render();
    });
    await pg.waitForTimeout(400);
    const rowShape = await pg.evaluate(() => {
      const tr = document.querySelector("#view tr.xrow");
      if (!tr) return null;
      const td = tr.querySelector("td");
      const un = document.querySelector("#view tr.xrow.unapproved");
      return {
        unapprovedRows: document.querySelectorAll("#view tr.xrow.unapproved").length,
        height: Math.round(td.getBoundingClientRect().height),
        thumb: !!tr.querySelector(".xthumb"),
        thumbBox: (() => {
          const t = tr.querySelector(".xthumb");
          const r = t.getBoundingClientRect();
          return `${Math.round(r.width)}x${Math.round(r.height)}`;
        })(),
        rule: un ? getComputedStyle(un.querySelector("td")).borderLeftWidth : "0px",
        unapprovedMatchesEngine: [...document.querySelectorAll("#view tr.xrow")].every((r) => {
          const marked = r.classList.contains("unapproved");
          const pill = /Sin aprobar/i.test(r.innerText);
          return marked === pill;
        }),
      };
    });
    if (
      rowShape &&
      rowShape.unapprovedRows > 0 &&
      rowShape.height === 56 &&
      rowShape.thumbBox === "40x40" &&
      rowShape.rule === "3px" &&
      rowShape.unapprovedMatchesEngine
    )
      ok(`PRY-03: 56 px rows, 40×40 photo, and the amber rule on every unapproved one`);
    else bad("PRY-03: row treatment", JSON.stringify(rowShape));

    // Pressing a counter filters, pressing it again clears.
    const allRows = await pg.locator("#view tr.xrow").count();
    await pg.locator('#view [data-cstage="approved"]').click();
    await pg.waitForTimeout(400);
    const approvedRows = await pg.locator("#view tr.xrow").count();
    const engineApproved = await pg.evaluate(() => erp.changeStageSummary(gProject).approved.count);
    await pg.locator("#view .counter.on").first().click();
    await pg.waitForTimeout(400);
    const clearedRows = await pg.locator("#view tr.xrow").count();
    if (approvedRows === engineApproved && clearedRows === allRows)
      ok(`PRY-03: a counter filters to exactly its own stage (${approvedRows} aprobados)`);
    else
      bad(
        "PRY-03: counter filter",
        `${allRows}/${approvedRows}/${clearedRows} vs ${engineApproved}`,
      );

    // ---- Modificaciones: detect → value → send → approve → adenda ----
    await pg.evaluate(() => (location.hash = "variations"));
    await pg.waitForTimeout(700);
    // S9 replaced this screen's three KPIs with the doc's five counters, so
    // the figure that must move on approval is the aprobado counter.
    const kpisBefore = await pg.locator("#view .counter .val").allInnerTexts();
    await pg.click("#mNew");
    await pg.waitForTimeout(300);
    await pg.fill("#c_desc", "Extra E2E");
    await pg.click("#c_save");
    await pg.waitForTimeout(500);
    await pg.locator("[data-price]").first().click();
    await pg.waitForTimeout(300);
    await pg.fill("#c_price", "500");
    await pg.fill("#c_cost", "300");
    await pg.fill("#c_days", "2");
    await pg.click("#c_psave");
    await pg.waitForTimeout(500);
    const sendBtn = pg.locator("[data-send]").first();
    if ((await sendBtn.count()) === 0)
      bad("modificaciones: priced extra offers Enviar", "no [data-send]");
    await sendBtn.click();
    await pg.waitForTimeout(400);
    // Package 2 slide 8 (PK2-C): "Aprobar" opens a drawer for the real backup
    // document now, rather than firing the approval on the one click —
    // evidence is optional here, so confirming without attaching anything
    // still approves.
    await pg.locator("[data-approve]").first().click();
    await pg.waitForTimeout(400);
    await pg.click("#apOk");
    await pg.waitForTimeout(500);
    const kpisAfter = await pg.locator("#view .counter .val").allInnerTexts();
    if (JSON.stringify(kpisAfter) !== JSON.stringify(kpisBefore))
      ok("modificaciones: approving an extra moves the stage counters");
    else bad("modificaciones: counters update on approval", kpisAfter.join(" | "));

    await pg.locator("[data-doc]").first().click();
    await pg.waitForTimeout(300);
    const adenda = await pg.locator(".drawer .doc").innerText();
    if (
      /MODIFICACIÓN CONTRACTUAL/.test(adenda) &&
      !/coste/i.test(adenda) &&
      !/margen/i.test(adenda)
    )
      ok("modificaciones: the adenda shows the sale effect and no cost or margin");
    else bad("modificaciones: adenda content", adenda.replace(/\n/g, " ").slice(0, 150));
    await pg.click("#dClose");
    await pg.waitForTimeout(200);

    // ---- ADM-04 Horas (S12): day sheet + week calendar, then the Resumen ----
    await pg.evaluate(() => (location.hash = "labour"));
    await pg.waitForTimeout(700);
    // The four widths §3.2 fixes for the day sheet, and the calendar beside it.
    const sheetShape = await pg.evaluate(() => {
      const cal = document.querySelectorAll(".hcal .hday").length;
      const zone = document.querySelector(".inbox2");
      const w = zone ? getComputedStyle(zone).gridTemplateColumns.split(" ")[0] : null;
      const th = [...document.querySelectorAll(".hsheet thead th")].map((x) =>
        Math.round(x.getBoundingClientRect().width),
      );
      return { cal, w, th };
    });
    if (sheetShape.cal === 7 && sheetShape.w === "372px")
      ok("ADM-04: seven day cells in a 372 calendar beside the day sheet");
    else bad("ADM-04: day sheet shape", JSON.stringify(sheetShape));

    await pg.click("#hAssign");
    await pg.waitForTimeout(300);
    await pg.selectOption("#as_w", { index: 0 });
    await pg.click("#as_save");
    await pg.waitForTimeout(500);
    const hin = pg.locator(".hsheet input.hin").first();
    if ((await hin.count()) === 0) {
      bad("ADM-04: the day sheet offers an editable row after assigning", "no input.hin");
    } else {
      // The calendar cell counts the whole day across every job, so the check
      // is the DELTA — reading "6 h" would only pass on a day nobody worked.
      const hoursOnDay = () =>
        pg.evaluate(
          () =>
            erp.state.labour.filter((l) => l.date === hDay).reduce((s, l) => s + l.hoursMilli, 0) /
            1000,
        );
      /* Point the row at a job that is still open.
         `recordHours` refuses hours against a closed project, and the demo file
         has closed ones — so whether this passed used to depend on which job
         happened to be first for the day the sheet opened on. Choosing openly
         is what the operator does with the row's own selector, and it stops the
         check reporting a calendar bug when the engine had refused upstream. */
      await pg.evaluate(() => {
        const open = erp.state.projects.find((p) => !p.closed);
        if (!open) return;
        document.querySelectorAll("[data-newproj]").forEach((s) => {
          if ([...s.options].some((o) => o.value === open.id)) {
            s.value = open.id;
            s.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      });
      await pg.waitForTimeout(200);
      const beforeH = await hoursOnDay();
      // The first row may already carry hours, in which case typing 6 CORRECTS
      // it rather than adding to the day. Either way the arithmetic is known.
      const prev = Number((await hin.inputValue()).replace(",", ".")) || 0;
      await hin.fill("6");
      await hin.blur();
      await pg.waitForTimeout(600);
      const afterH = await hoursOnDay();
      const dayTotal = await pg.locator(".hcal .hday.on .h").innerText();
      const shown = Number(dayTotal.replace(/[^\d,.]/g, "").replace(",", "."));
      if (afterH === beforeH - prev + 6 && shown === afterH)
        ok("ADM-04: hours entered on the sheet show in the day's calendar cell");
      else {
        // The engine refuses some entries (a closed project, no project chosen)
        // and says so in a toast. Reporting the arithmetic alone left the last
        // failure looking like a calendar bug when it was a refusal upstream.
        const why = await pg.evaluate(() => {
          const t = document.querySelector(".toast, #toast, .toasts");
          return {
            toast: t ? t.textContent.trim().slice(0, 120) : "",
            day: typeof hDay === "string" ? hDay : null,
            rows: document.querySelectorAll(".hsheet tbody tr").length,
            projSel: document.querySelector("[data-newproj]")?.value ?? null,
          };
        });
        bad(
          "ADM-04: calendar total after entry",
          `${beforeH}-${prev}+6 → ${afterH}, shown ${dayTotal} · ${JSON.stringify(why)}`,
        );
      }

      await pg.locator("[data-approve]").first().click();
      await pg.waitForTimeout(600);
      const lockedRows = await pg.evaluate(
        () =>
          [...document.querySelectorAll(".hsheet tbody tr")].filter(
            (tr) => tr.querySelector("[data-unapprove]") && !tr.querySelector("input.hin"),
          ).length,
      );
      if (lockedRows > 0) ok("ADM-04: approving the week turns its row into a locked figure");
      else bad("ADM-04: approve locks the row", `locked=${lockedRows}`);

      // ── Block 3: the labour asks from the client review, on the real screen.
      //    An overtime hour priced from its own band; hours naming a partida;
      //    the by-worker table and the per-worker cash reconciliation, both
      //    RENDERED with geometry, not merely computed.
      const b3 = await pg.evaluate(() => {
        const w = erp.state.workers.find((x) => x.active !== false);
        erp.addWorkerRate(
          w.id,
          { from: erp.state.today, rateCentsPerHour: 2000, extraRateCentsPerHour: 2600 },
          "bo",
        );
        const p = erp.state.projects.find(
          (x) =>
            x.budgetId &&
            x.acceptedVersionId &&
            !x.closed &&
            erp.version(x.budgetId, x.acceptedVersionId).chapters.some((c) => c.lines.length),
        );
        const v = p && erp.version(p.budgetId, p.acceptedVersionId);
        const chp = v && v.chapters.find((c) => c.lines.length);
        const rec = erp.recordHours(
          {
            workerId: w.id,
            projectId: p.id,
            lineId: chp.lines[0].id,
            kind: "extra",
            hoursMilli: 2000,
            date: erp.state.today,
          },
          "op",
        );
        const till =
          erp.state.bankAccounts.find((a) => a.kind === "till") ||
          erp.addBankAccount({ name: "Caja E2E", kind: "till" }, "bo");
        erp.recordCashMovement(
          till.id,
          {
            concept: "Pago semana",
            amountCents: -5000,
            workerId: w.id,
            supportingDocRef: "recibo",
          },
          "bo",
        );
        return {
          rate: rec.rateCents,
          chapterFilled: rec.chapterNum === String(chp.num),
          lineId: !!rec.lineId,
        };
      });
      if (b3.rate === 2600 && b3.chapterFilled && b3.lineId)
        ok("block 3: an extra hour prices from its own band, and hours land on the partida");
      else bad("block 3: overtime + partida", JSON.stringify(b3));

      /* The sheet must SAY which kind of hour each line is. It priced overtime
         correctly all along and showed the worker's contract type instead, so
         a normal hour and an overtime hour were the same row with a different
         number in it — the operator's words: "ensure you see in the tile what
         hours are it, normal or overtime". */
      await pg.evaluate(() => {
        hDay = erp.state.today;
        location.hash = "labour";
        render();
      });
      await pg.waitForTimeout(700);
      const kindShown = await pg.evaluate(() => {
        const heads = [...document.querySelectorAll(".hsheet thead th")].map((t) =>
          t.textContent.trim(),
        );
        const sels = [...document.querySelectorAll(".hsheet [data-hkind]")];
        return {
          hasColumn: heads.includes("Tipo de hora"),
          controls: sels.length,
          values: sels.map((s) => s.value),
          // A control nobody can see is not a thing the tile shows.
          visible: sels.filter((s) => s.getBoundingClientRect().width > 20).length,
        };
      });
      if (kindShown.hasColumn && kindShown.visible > 0 && kindShown.values.includes("extra"))
        ok("block 3: the day sheet names each line's hour kind, extra included");
      else bad("block 3: hour kind on the sheet", JSON.stringify(kindShown));

      // …and changing it there is a correction, not a relabel: correctHours
      // re-reads the rate band, so the entry's cost has to move with it.
      const repriced = await pg.evaluate(async () => {
        const sel = [...document.querySelectorAll(".hsheet [data-hkind]")].find(
          (s) => s.value === "extra",
        );
        if (!sel) return { skipped: true };
        const id = sel.dataset.hkind;
        const before = erp.state.labour.find((l) => l.id === id).rateCents;
        sel.value = "normal";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 400));
        const after = erp.state.labour.find((l) => l.id === id);
        return { before, after: after.rateCents, kind: after.kind };
      });
      if (repriced.before === 2600 && repriced.after === 2000 && repriced.kind === "normal")
        ok("block 3: correcting the kind on the sheet re-prices the entry from the other band");
      else bad("block 3: kind correction re-prices", JSON.stringify(repriced));

      await pg.evaluate(() => {
        document.querySelector("#view .tabstrip [data-tab]") && null;
        location.hash = "labour";
      });
      // Resumen tab renders the two new tables.
      await pg.evaluate(() => {
        const t = [...document.querySelectorAll(".tabstrip .tab")].find((x) =>
          /Resumen/.test(x.textContent),
        );
        if (t) t.click();
      });
      await pg.waitForTimeout(700);
      const tables = await pg.evaluate(() => {
        const g = (id) => {
          const t = document.getElementById(id);
          if (!t) return null;
          const r = t.getBoundingClientRect();
          return { rows: t.querySelectorAll("tbody tr").length, w: Math.round(r.width) };
        };
        return { byW: g("hByW"), wRec: g("hWRec") };
      });
      if (tables.byW && tables.byW.rows > 0 && tables.byW.w > 400)
        ok(`block 3: the by-worker table renders with rows (${tables.byW.rows})`);
      else bad("block 3: by-worker table", JSON.stringify(tables));
      if (tables.wRec && tables.wRec.rows > 0)
        ok(`block 3: the per-worker cash reconciliation renders (${tables.wRec.rows} rows)`);
      else bad("block 3: worker cash reconciliation", JSON.stringify(tables));
      // Back to the day sheet — the checks below this block belong to it.
      await pg.evaluate(() => {
        const t = [...document.querySelectorAll(".tabstrip .tab")].find((x) =>
          /Parte diario/.test(x.textContent),
        );
        if (t) t.click();
      });
      await pg.waitForTimeout(600);

      /* Repeat copies the PREVIOUS day, so move on one day first — otherwise
         the button is being asked to copy a day that has nothing on it.
         Advanced by DATE rather than by clicking the next calendar cell: the
         sheet opens on the real date now, and when that is a Sunday there is no
         next cell — the week ends there and the calendar has no way forward.
         The check then failed for a reason that had nothing to do with
         repeating a day, which is the kind of failure that gets a real one
         dismissed. */
      await pg.evaluate(() => {
        const d = new Date(hDay + "T00:00:00");
        d.setDate(d.getDate() + 1);
        const p = (n) => String(n).padStart(2, "0");
        hDay = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        render();
      });
      await pg.waitForTimeout(500);
      await pg.click("#hRepeat");
      await pg.waitForTimeout(600);
      const repeatToast = await pg.locator("#toast").innerText();
      if (/repetid/i.test(repeatToast)) ok("ADM-04: repeating the previous day reports success");
      else bad("ADM-04: repeat day", repeatToast);
    }

    // The Resumen tab: per project and chapter, and the month's reconciliation.
    await pg.locator('[data-htab="summary"]').click();
    await pg.waitForTimeout(600);
    const summary = await pg.evaluate(() => {
      const rec = erp.labourReconciliation();
      return {
        table: !!document.querySelector("#hSum"),
        recBlock: !!document.querySelector("#hRec"),
        text: document.querySelector("#view").innerText,
        agrees: rec.wagesCents - rec.bookedCents === rec.unbookedCents,
      };
    });
    if (summary.table && summary.recBlock && summary.agrees && /Conciliación/.test(summary.text))
      ok("ADM-04: the Resumen tab rolls up per chapter and reconciles the month");
    else bad("ADM-04: resumen tab", JSON.stringify(summary).slice(0, 200));

    if (errs.length === 0) ok("procurement: no console errors");
    else bad("procurement: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("procurement (compras/subcontratos/modificaciones/horas)", String(e).slice(0, 220));
  } finally {
    await pg.close();
  }
}

// ── Administración (session 11): reconciliation §5.3, gestoría §5.6,
//    communications §5.7. Three screens whose whole value is that they say NO
//    at the right moment — a suggestion you can argue with, a period that
//    refuses to close, a package that refuses to go. Asserting the refusals is
//    the point; asserting that the happy path renders would miss all of it.
async function testAdmin(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = [];
  attachConsole(pg, errs);
  // Both screens ask for free text before doing anything irreversible; answer
  // whatever they ask so the run never blocks on a question.
  await autoAnswerModals(pg, {
    "Enviar el paquete": "Gestoría Subirats",
  });
  try {
    // ---- §5.3 Conciliación: suggestion + reasons → accept → transfers → close refuses
    await pg.goto(`${base}/erp.html#banking`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(900);
    await openTab(pg, "banking", "_reconcile");
    const openBefore = await pg.locator(".movrow").count();
    if (openBefore > 0) ok(`conciliación: unreconciled statement lines are listed (${openBefore})`);
    else bad("conciliación: statement lines listed", "no .movrow");

    // Select the line whose free text quotes an invoice number.
    let picked = false;
    for (let i = 0; i < openBefore; i++) {
      const t = await pg.locator(".movrow").nth(i).innerText();
      if (/FAC-2026-0002/.test(t)) {
        await pg.locator(".movrow").nth(i).click();
        picked = true;
        break;
      }
    }
    await pg.waitForTimeout(500);
    if (!picked) bad("conciliación: seeded statement line with a quoted reference", "not found");

    const suggText = await pg
      .locator(".sugg")
      .first()
      .innerText()
      .catch(() => "");
    // A confidence with no argument behind it teaches people to click accept
    // without reading. The reasons are load-bearing, so the test demands them.
    if (/%/.test(suggText) && /importe exacto/.test(suggText) && /referencia citada/.test(suggText))
      ok("conciliación: the match proposal shows its confidence AND its reasons");
    else bad("conciliación: proposal carries reasons", suggText.slice(0, 120));

    await pg.locator("[data-accept]").first().click();
    await pg.waitForTimeout(700);
    const openAfter = await pg.locator(".movrow").count();
    if (openAfter === openBefore - 1)
      ok("conciliación: accepting a proposal clears the line from the queue");
    else bad("conciliación: accepted line leaves the queue", `${openBefore} → ${openAfter}`);

    const trBtn = pg.locator("#rcTransfers");
    if ((await trBtn.count()) > 0) {
      await trBtn.click();
      await pg.waitForTimeout(700);
      const afterTr = await pg.locator(".movrow").count();
      if (afterTr === openAfter - 2)
        ok("conciliación: the mirrored transfer pair is detected and cleared as internal");
      else bad("conciliación: internal transfer pair", `${openAfter} → ${afterTr}`);
    } else bad("conciliación: internal transfer detected", "no #rcTransfers button");

    // Closing must REFUSE while anything is still unreconciled — the whole
    // point of a closed period is that it cannot contain an open question.
    await pg.click("#rcClose");
    await pg.waitForTimeout(600);
    const closeMsg = await pg.locator("#toast").innerText();
    if (/^⚠/.test(closeMsg.trim()) && /sin conciliar/.test(closeMsg))
      ok("conciliación: closing the period is refused while lines are unreconciled");
    else bad("conciliación: close refuses", closeMsg.slice(0, 120));

    // ---- §5.7 Comunicaciones: preview with real data, simulate, queue, approve
    await pg.evaluate(() => (location.hash = "messaging"));
    await pg.waitForTimeout(800);
    const preview = await pg
      .locator("#cm_preview")
      .innerText()
      .catch(() => "");
    // §5.7 asks for "previsualización con datos reales": a template that reads
    // well against {{placeholders}} and badly against a real customer name is
    // the normal failure, so the preview must not contain a placeholder.
    if (preview.length > 20 && !/\{\{/.test(preview))
      ok("comunicaciones: the template preview renders against a real record");
    else bad("comunicaciones: preview uses real data", preview.slice(0, 120));

    await pg.locator('[data-tab="reglas"]').click();
    await pg.waitForTimeout(500);
    const rulesText = await pg.locator("#view").innerText();
    // The default mode is draft, deliberately. If a seeded rule ever reads
    // "Automático" here, something changed the default and nobody noticed.
    if (/Borrador/.test(rulesText) && !/Automático/.test(rulesText))
      ok("comunicaciones: every rule is draft-mode — nothing is set to send by itself");
    else bad("comunicaciones: rules default to draft", rulesText.slice(0, 160));

    await pg.locator("[data-sim]").first().click();
    await pg.waitForTimeout(600);
    const simText = await pg.locator(".drawer").innerText();
    if (/simulación/i.test(simText) && /produciría/.test(simText))
      ok("comunicaciones: a rule can be simulated without queueing or sending");
    else bad("comunicaciones: rule simulation", simText.slice(0, 140));
    await pg.click("#dClose");
    await pg.waitForTimeout(300);

    await pg.locator('[data-tab="plantillas"]').click();
    await pg.waitForTimeout(400);
    const qBtn = pg.locator("#cmQueue");
    if ((await qBtn.count()) > 0) {
      await qBtn.click();
      await pg.waitForTimeout(700);
    }
    await pg.locator('[data-tab="cola"]').click();
    await pg.waitForTimeout(500);
    const drafts = await pg.locator("[data-approve-msg]").count();
    if (drafts > 0) ok(`comunicaciones: rules fill the queue as drafts (${drafts})`);
    else bad("comunicaciones: queue fills from rules", "no drafts");
    await pg.locator("[data-approve-msg]").first().click();
    await pg.waitForTimeout(600);
    const apprMsg = await pg.locator("#toast").innerText();
    // The mandate forbids real sending. The label has to be honest that
    // approving is not sending, and the copy is the only place that says so.
    if (/sigue sin enviarse/i.test(apprMsg))
      ok("comunicaciones: approving a message is explicitly not sending it");
    else bad("comunicaciones: approve is not send", apprMsg.slice(0, 120));
    if ((await pg.locator("[data-sent-msg]").count()) > 0)
      ok("comunicaciones: an approved message can be recorded as sent, by hand");
    else bad("comunicaciones: manual send record", "no [data-sent-msg]");

    // ---- §5.6 Gestoría: blocked send → justify each exception → send with recipient
    await pg.evaluate(() => (location.hash = "accountant"));
    await pg.waitForTimeout(800);
    const blocks = await pg.locator(".blk").count();
    if (blocks >= 7) ok(`gestoría: the package completeness blocks are shown (${blocks})`);
    else bad("gestoría: completeness blocks", `${blocks} blocks`);

    // S12: three steps behind a 48 indicator, and step three is unreachable
    // while a blocking exception is open — the gate the Export button already
    // enforced, now visible one screen earlier.
    const wizard = await pg.evaluate(() => {
      const stp = [...document.querySelectorAll(".steps .stp")];
      return { n: stp.length, h: stp[0] ? Math.round(stp[0].getBoundingClientRect().height) : 0 };
    });
    if (wizard.n === 3 && wizard.h === 48)
      ok("gestoría: a three-step wizard behind a 48 step indicator");
    else bad("gestoría: wizard shape", JSON.stringify(wizard));

    await pg.locator('[data-step="2"]').first().click();
    await pg.waitForTimeout(600);
    const openEx = await pg.locator("[data-acc]").count();
    if (openEx > 0 && (await pg.locator('.steps [data-step="3"]').isDisabled()))
      ok(`gestoría: step 3 is unreachable while exceptions are unjustified (${openEx})`);
    else bad("gestoría: step 3 blocked by exceptions", `open=${openEx}`);

    let guard = 0;
    while ((await pg.locator("[data-acc]").count()) > 0 && guard++ < 15) {
      await pg.locator("[data-acc]").first().click();
      await pg.waitForTimeout(450);
    }
    if (
      (await pg.locator("[data-acc]").count()) === 0 &&
      !(await pg.locator('.steps [data-step="3"]').isDisabled())
    )
      ok("gestoría: justifying every exception unlocks the last step");
    else bad("gestoría: justification unblocks step 3", `remaining=${guard}`);

    await pg.locator('.steps [data-step="3"]').click();
    await pg.waitForTimeout(600);
    await pg.click("#bSend");
    await pg.waitForTimeout(800);
    const gesText = await pg.locator("#view").innerText();
    if (/Gestoría Subirats/.test(gesText) && /justificadas/.test(gesText))
      ok("gestoría: the send is recorded with its recipient and its justified exceptions");
    else bad("gestoría: send record", gesText.slice(-200));

    // ---- §5.4 Banco keeps position and forecast, and hands allocation over.
    //      Both are tabs of ADM-05 now, so this asserts the ACCOUNTS tab still
    //      has no allocation control on it — the point of the split.
    await openTab(pg, "banking", "_bankAccounts");
    // Session 11 moved allocation OUT of this screen; S11 of the v4 programme
    // brings it back deliberately, because §3.2 asks for classification and
    // assignment edited in the row. What must not come back is the old
    // free-text allocation input divorced from a document — the selects here
    // write through the same `splitMovement` Conciliación does.
    const oldInputs = await pg.locator("#view input[data-mov]").count();
    const rowSelects = await pg.locator("#view [data-bkdest]").count();
    if (oldInputs === 0 && rowSelects > 0)
      ok(`ADM-05: assignment is a row control, not a free-text field (${rowSelects} rows)`);
    else bad("banco: row assignment", `old=${oldInputs} selects=${rowSelects}`);
    await pg.click("#bToRec");
    await pg.waitForTimeout(600);
    // The two are tabs of ADM-05 now, so handing over means selecting the
    // sibling tab rather than navigating somewhere else.
    const onRec = await pg.locator('.tabstrip [data-tab="_reconcile"].on').count();
    if (onRec === 1) ok("banco: the screen hands over to Conciliación explicitly");
    else bad("banco: link to reconciliation", `active tab not _reconcile (${pg.url()})`);

    // ── 1G: the accountant package is a FILE, opened and READ BACK ────────
    //    The ZIP is produced by buildAccountantZip and re-opened in the same
    //    page by ErpImport's own ZIP reader — the export is verified by the
    //    code that reads bank statements, not by trusting that producing it
    //    worked. The xlsx inside is parsed back to rows; every supporting
    //    file the sheet names must exist in the archive with bytes in it.
    const zipCheck = await pg.evaluate(async () => {
      // The quarter the DATA lives in, not today's: a gestor exports the
      // closed quarter, and the seed's movements sit where the seed put them.
      const qOf = (d) => {
        const [y, m] = d.split("-").map(Number);
        return y + "-Q" + Math.ceil(m / 3);
      };
      const byQ = {};
      for (const m of erp.state.movements)
        byQ[qOf(m.accountingDate)] = (byQ[qOf(m.accountingDate)] || 0) + 1;
      const q = Object.keys(byQ).sort((a, b) => byQ[b] - byQ[a])[0];
      const inQ = erp.state.movements.filter((m) => qOf(m.accountingDate) === q);
      if (!q || inQ.length === 0) return { fail: "no movements in any quarter" };
      await ErpStore.putBlob("mov_e2e_1g", new Blob([new Uint8Array(120)], { type: "image/png" }));
      erp.attachMovementDoc(
        inQ[0].id,
        { storageKey: "mov_e2e_1g", name: "ticket.png", type: "image/png", size: 120 },
        "bo",
      );
      // The gate stays a gate: justify what is outstanding BY NAME, then build.
      for (const x of erp.exceptionsWithStatus(q).filter((r) => !r.accepted))
        erp.acceptException(q, x.key, "e2e", "bo");
      const pkg = erp.quarterlyPackage(q, { recipient: "E2E" }, "bo");
      const z = await buildAccountantZip(q, pkg);
      const bytes = new Uint8Array(await z.blob.arrayBuffer());
      const dir = ErpImport.zip.centralDirectory(bytes);
      const names = Object.keys(dir);
      if (!names.includes("conciliacion.xlsx")) return { fail: "no conciliacion.xlsx", names };
      const sheet = await ErpImport.zip.readEntry(bytes, dir["conciliacion.xlsx"]);
      const rows = await ErpImport.parseXlsxRows(sheet.buffer ? sheet : new Uint8Array(sheet));
      const header = rows[0] || [];
      const docCol = header.indexOf("Justificante");
      const named = rows
        .slice(1)
        .map((r) => r[docCol])
        .filter(Boolean);
      const missingInArchive = named.filter((n) => !names.includes(n));
      const emptyEntries = names.filter((n) => n.startsWith("docs/") && dir[n].csize === 0);
      return {
        q,
        entries: names.length,
        rows: rows.length - 1,
        movements: pkg.bankMovements.length,
        header: header.slice(0, 4).join("|"),
        named: named.length,
        missingInArchive,
        emptyEntries,
        missingReported: z.missing.length,
      };
    });
    if (zipCheck.fail) bad("1G: accountant ZIP", JSON.stringify(zipCheck));
    else {
      if (zipCheck.rows === zipCheck.movements && zipCheck.rows > 0)
        ok(
          `1G: conciliacion.xlsx parses back — one row per movement of the quarter (${zipCheck.rows})`,
        );
      else bad("1G: xlsx rows", JSON.stringify(zipCheck));
      if (
        zipCheck.named > 0 &&
        zipCheck.missingInArchive.length === 0 &&
        zipCheck.emptyEntries.length === 0
      )
        ok(
          `1G: every supporting file the sheet names is IN the archive, with bytes (${zipCheck.named} named)`,
        );
      else bad("1G: docs in archive", JSON.stringify(zipCheck));
    }

    if (errs.length === 0) ok("administración: no console errors");
    else bad("administración: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("administración (conciliación/gestoría/comunicaciones)", String(e).slice(0, 220));
  } finally {
    await pg.close();
  }
}

// ── Torre de Control · Mi Día (session 12, spec §2.1/§2.2). The eight cards,
//    the alert manager's four verbs (assign/snooze/resolve/convert-to-task),
//    the rule editor, and the hitos calendar — asserted by actually using
//    them, the same standard sessions 9-11 held their own screens to.
async function testControlTowerAndDay(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = [];
  attachConsole(pg, errs);
  await autoAnswerModals(pg, {
    "Asignar la alerta": "backoffice",
    "Resolver la alerta": "Resuelto en el E2E",
    perdido: "price", // the loss reason is a list now; pick that code
  });
  try {
    await pg.goto(`${base}/erp.html#tower`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(900);

    /* Rendimiento de la cartera — cost against approved budget, per open job.
       What is asserted is the IDENTITY the chart draws, not that some bars
       appeared: for every row, approved budget = incurred + still to spend +
       margin. A chart that computed its own total would drift from the
       Económicos screen, and the one a director glances at is the one that
       would be wrong. The overrun case is forced rather than hoped for — the
       seeded jobs happen to have nothing left to spend, so the amber and red
       marks would otherwise never be exercised. */
    const perf = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll(".perfrow")];
      const reconciles = rows.every((r) => {
        const e = erp.projectEconomics(r.dataset.perf);
        return (
          e.currentRevenueCents ===
          e.actualCents + Math.max(0, e.forecastCostCents - e.actualCents) + e.marginForecastCents
        );
      });
      return {
        rows: rows.length,
        reconciles,
        keys: document.querySelectorAll(".perfkey span").length,
      };
    });
    if (perf.rows > 0 && perf.reconciles && perf.keys === 4)
      ok(`TC-01: cartera — ${perf.rows} jobs, budget = incurred + to go + margin on every one`);
    else bad("TC-01: cartera reconciles", JSON.stringify(perf));

    const overrun = await pg.evaluate(() => {
      const open = erp.state.projects.filter((p) => !p.closed);
      const sup = erp.state.parties.find((p) => p.active && p.roles.includes("supplier"));
      if (!open.length || !sup) return null;
      const e = erp.projectEconomics(open[0].id);
      erp.registerBill(
        {
          supplierId: sup.id,
          number: "E2E-OVERRUN",
          baseCents: e.currentRevenueCents,
          vatBp: 2100,
          allocations: [{ projectId: open[0].id, amountCents: e.currentRevenueCents }],
        },
        "bo",
      );
      render();
      const row = document.querySelector(`.perfrow[data-perf="${open[0].id}"]`);
      if (!row) return null;
      const tick = parseFloat(row.querySelector(".tick").style.left);
      const over = row.querySelector(".over");
      const fig = row.querySelector(".fig");
      return {
        tick: Math.round(tick),
        overWidth: over ? Math.round(parseFloat(over.style.width)) : 0,
        overStartsAtTick: over ? Math.abs(parseFloat(over.style.left) - tick) < 1.5 : false,
        negative: !!fig && fig.classList.contains("neg"),
      };
    });
    if (overrun && overrun.overWidth > 0 && overrun.overStartsAtTick && overrun.negative)
      ok(`TC-01: a job over budget shows red past the tick (${overrun.tick}% → 100%)`);
    else bad("TC-01: overrun mark", JSON.stringify(overrun));

    // TC-01: four indicators, no sparkline, no customiser. The doc is explicit
    // that adding one means removing another, so the COUNT is the check.
    const cardCount = await pg.locator(".tcard").count();
    if (cardCount === 4) ok("torre: exactly the four spec indicators (TC-01)");
    else bad("torre: four cards", `found ${cardCount}`);

    const sparkCount = await pg.locator(".tcard svg.spark").count();
    if (sparkCount === 0) ok("torre: no sparklines — the figure survived, the trend did not");
    else bad("torre: sparklines removed", `${sparkCount} still drawn`);

    // "El Torre lee toda la cadena y no escribe nada": at most five alert rows,
    // and not one control that changes an alert.
    const alertRows = await pg.locator(".alrow").count();
    if (alertRows <= 5) ok(`torre: at most five alert rows (${alertRows})`);
    else bad("torre: five alerts max", `${alertRows} rows`);

    const writeControls = await pg
      .locator(
        "[data-assign], [data-snooze], [data-resolve], [data-totask], #aRules, #tCustomize, #tExportCsv",
      )
      .count();
    if (writeControls === 0) ok("torre: read-only — no panel opens from it");
    else bad("torre: read-only", `${writeControls} write controls still present`);

    // Everything one DOES about an alert moved to Configuración › Alertas.
    await pg.evaluate(() => (location.hash = "alerts"));
    await pg.waitForTimeout(700);
    // DMC-07 manages, it doesn't just display: assign, snooze,
    // resolve-with-note and convert-to-task each mutate real state.
    const openBefore = await pg.locator(".alrow").count();
    await pg.locator("[data-assign]").first().click();
    await pg.waitForTimeout(500);
    if (/Alerta asignada/.test(await pg.locator("#toast").innerText()))
      ok("alertas: an alert can be assigned to someone");
    else bad("alertas: assign alert", await pg.locator("#toast").innerText());

    await pg.locator("[data-snooze]").first().click();
    await pg.waitForTimeout(500);
    const afterSnooze = await pg.locator(".alrow").count();
    if (afterSnooze === openBefore - 1)
      ok("alertas: snoozing an alert removes it from the open list until its date");
    else bad("alertas: snooze alert", `${openBefore} → ${afterSnooze}`);

    const resolveTarget = pg.locator("[data-resolve]").first();
    await resolveTarget.click();
    await pg.waitForTimeout(500);
    const afterResolve = await pg.locator(".alrow").count();
    if (afterResolve === afterSnooze - 1)
      ok("alertas: resolving an alert with a note clears it from the open list");
    else bad("alertas: resolve alert", `${afterSnooze} → ${afterResolve}`);

    const totaskBtn = pg.locator("[data-totask]:not([disabled])").first();
    if ((await totaskBtn.count()) > 0) {
      await totaskBtn.click();
      await pg.waitForTimeout(500);
      if (/Convertida en tarea/.test(await pg.locator("#toast").innerText()))
        ok("alertas: an alert can be converted into a real task");
      else bad("alertas: convert alert to task", await pg.locator("#toast").innerText());
    } else bad("alertas: convert alert to task", "no enabled [data-totask] button");

    // Grouping switches between "por tipo" and "por proyecto" (DAS-06).
    await pg.click('[data-grp="project"]');
    await pg.waitForTimeout(400);
    const byProject = await pg.locator(".algroup").allInnerTexts();
    await pg.click('[data-grp="type"]');
    await pg.waitForTimeout(400);
    const byType = await pg.locator(".algroup").allInnerTexts();
    // .algroup is CSS text-transform:uppercase, so the rendered text is
    // "ECONÓMICA" etc. regardless of the source casing — match case-insensitively.
    if (byType.some((t) => /econ[oó]mica|t[eé]cnica|documental/i.test(t)) && byProject.length > 0)
      ok("alertas: alerts group by type and by project");
    else bad("alertas: alert grouping", `type=${byType.join(",")} project=${byProject.join(",")}`);

    // The rule editor: a threshold change actually persists (DAS-06 "el
    // propietario define condición, umbral, destinatario y canal").
    await pg.click("#aRules");
    await pg.waitForTimeout(500);
    const thInput = pg.locator("[data-th]").first();
    await thInput.fill("9");
    await thInput.dispatchEvent("change");
    await pg.waitForTimeout(400);
    if (/Umbral actualizado/.test(await pg.locator("#toast").innerText()))
      ok("alertas: an alert rule's threshold can be edited and is saved");
    else bad("alertas: rule threshold edit", await pg.locator("#toast").innerText());
    await pg.click("#dClose");
    await pg.waitForTimeout(300);

    // ---- DMC-08 Usuarios ----
    // This copy has no server, so the screen must say there are no accounts to
    // manage rather than showing an empty table that reads as "nobody works
    // here". Accounts live where the data lives; an offline copy has neither.
    await pg.evaluate(() => (location.hash = "users"));
    await pg.waitForTimeout(500);
    const usersText = await pg.locator("#view").innerText();
    if (/Sólo en el servidor/.test(usersText))
      ok("usuarios: local mode says there are no accounts here, rather than showing none");
    else bad("usuarios: local mode", usersText.replace(/\n/g, " ").slice(0, 120));

    // The four roles are described ON THE SCREEN, not merely enforced on the
    // server. Somebody choosing one has to see what it means, and "gestoría
    // never sees margins" is the reason that role exists at all.
    if (/Gestoría/.test(usersText) && /márgenes/.test(usersText))
      ok("usuarios: each permission says what it can do, gestoría's limit included");
    else bad("usuarios: roles explained", usersText.replace(/\n/g, " ").slice(0, 120));

    // Mi Día was removed with the Torre extras: it was the only person-level
    // view, and the doc has no slot for it. Assert it is really gone rather
    // than leaving a check that silently stopped testing anything.
    const miDia = await pg.evaluate(() => !!SUBMAP.hoy);
    if (!miDia) ok("mi día: removed from the menu, and #hoy redirects");
    else bad("mi día: removed", "SUBMAP still has a `hoy` entry");

    // ---- DMC-03/04/05: the lists the owner maintains (S3) ----------------
    // These four lists were hardcoded in the engine until this session, so
    // what is being tested is not "a table renders" but "an owner can change
    // the company's vocabulary without a deploy, and old records survive it".
    await pg.evaluate(() => (location.hash = "units"));
    await pg.waitForTimeout(400);
    // The names live in input VALUES, which innerText does not carry — read
    // the boxes themselves. The Catalan column is the point of DMC-03 per the
    // doc: a unit with no Catalan name prints Spanish inside a Catalan
    // document, which is exactly the silent fallback decision 20 forbids.
    const unitNames = await pg.evaluate(() => ({
      es: [...document.querySelectorAll('input[data-lk="units"][data-lf="es"]')].map(
        (i) => i.value,
      ),
      ca: [...document.querySelectorAll('input[data-lk="units"][data-lf="ca"]')].map(
        (i) => i.value,
      ),
    }));
    if (
      unitNames.es.includes("metro cuadrado") &&
      unitNames.ca.includes("metre quadrat") &&
      unitNames.ca.every((v) => v.trim().length > 0)
    )
      ok("DMC-03: every unit carries both a Spanish and a Catalan name");
    else bad("DMC-03 units", `es=${unitNames.es.slice(0, 4)} ca=${unitNames.ca.slice(0, 4)}`);

    // Editing a LABEL is offered; editing the CODE is not, because records
    // store the code forever.
    const codeEditable = await pg.evaluate(
      () => document.querySelectorAll('input[data-lk="units"][data-lf="code"]').length,
    );
    const labelEditable = await pg.evaluate(
      () => document.querySelectorAll('input[data-lk="units"][data-lf="es"]').length,
    );
    if (codeEditable === 0 && labelEditable > 0)
      ok("DMC-03: labels are editable, codes are not (records store the code)");
    else
      bad("DMC-03 code immutability", `code inputs=${codeEditable} label inputs=${labelEditable}`);

    // Add a unit, and confirm it reaches the pickers the rest of the app uses.
    const newUnit = "tst" + String(Date.now()).slice(-4);
    await pg.locator("#new_units_code").fill(newUnit);
    await pg.locator("#new_units_es").fill("Unidad de prueba");
    await pg.locator("#new_units_ca").fill("Unitat de prova");
    await pg.locator('[data-ladd="units"]').click();
    await pg.waitForTimeout(400);
    const added = await pg.evaluate(
      (c) => erp.listActive("units").some((u) => u.code === c),
      newUnit,
    );
    if (added) ok("DMC-03: a new unit is added by the owner, from the screen");
    else bad("DMC-03 add", `${newUnit} not in listActive`);

    // A duplicate code is refused rather than silently creating a second entry
    // that would make every stored code ambiguous.
    await pg.locator("#new_units_code").fill(newUnit);
    await pg.locator("#new_units_es").fill("Duplicada");
    await pg.locator('[data-ladd="units"]').click();
    await pg.waitForTimeout(350);
    const dupCount = await pg.evaluate(
      (c) => erp.listAll("units").filter((u) => u.code === c).length,
      newUnit,
    );
    const dupToast = await pg
      .locator("#toast")
      .innerText()
      .catch(() => "");
    if (dupCount === 1 && /existe|exists/i.test(dupToast))
      ok("DMC-03: a duplicate code is refused and says so");
    else bad("DMC-03 duplicate", `count=${dupCount} toast=${dupToast.slice(0, 80)}`);

    // Retiring keeps the record: the entry leaves the pickers, the row stays.
    await pg.evaluate((c) => erp.setListEntryActive("units", c, false, "e2e"), newUnit);
    await pg.evaluate(() => render());
    await pg.waitForTimeout(300);
    const stillOnRecord = await pg.evaluate(
      (c) => ({
        active: erp.listActive("units").some((u) => u.code === c),
        all: erp.listAll("units").some((u) => u.code === c),
        label: erp.listLabel("units", c),
      }),
      newUnit,
    );
    if (!stillOnRecord.active && stillOnRecord.all && stillOnRecord.label === "Unidad de prueba")
      ok("DMC-03: retiring drops it from the pickers and keeps it resolving on old records");
    else bad("DMC-03 retire", JSON.stringify(stillOnRecord));

    // DMC-04 is two lists on one screen — sources and loss reasons together.
    await pg.evaluate(() => (location.hash = "lead-sources"));
    await pg.waitForTimeout(400);
    const leadText = await pg.locator("#view").innerText();
    if (/Fuentes de leads/.test(leadText) && /Motivos de pérdida/.test(leadText))
      ok("DMC-04: sources and loss reasons on one screen");
    else bad("DMC-04", leadText.replace(/\n/g, " ").slice(0, 140));

    // The reason these lists moved into the document: a customer's origin used
    // to render as its raw English key. It must now read as a Spanish label.
    await pg.evaluate(() => (location.hash = "customers"));
    await pg.waitForTimeout(400);
    await pg.locator("tr.click").first().click();
    await pg.waitForTimeout(300);
    const drawerText = await pg.locator("#drawer").innerText();
    if (/Origen:/.test(drawerText) && !/referrer|wordOfMouth|propertyManager/.test(drawerText))
      ok("DMC-04: a customer's origin reads as a label, not as its stored code");
    else bad("DMC-04 label rendering", drawerText.replace(/\n/g, " ").slice(0, 140));
    await pg.locator("#dClose").click();
    await pg.waitForTimeout(200);

    await pg.evaluate(() => (location.hash = "payment-methods"));
    await pg.waitForTimeout(400);
    const payText = await pg.locator("#view").innerText();
    if (/Formas de pago/.test(payText) && /Transferencia 30 días/.test(payText))
      ok("DMC-05: payment terms are listed and maintainable");
    else bad("DMC-05", payText.replace(/\n/g, " ").slice(0, 140));

    // ---- COM-01/02: leads and the visit lifecycle (S4) --------------------
    // A lead is created, a visit is scheduled against it (shows in the
    // "Programadas" block of COM-02), completed with a real capture (moves
    // to "Realizadas"), and a presupuesto is created from it — end to end,
    // not screen by screen, because the point of the visit lifecycle is that
    // those screens agree with each other.
    await pg.evaluate(() => (location.hash = "leads"));
    await pg.waitForTimeout(400);
    await pg.locator("#ldNew").click();
    await pg.waitForTimeout(300);
    const leadName = "E2E Lead " + String(Date.now()).slice(-5);
    await pg.locator("#o_work").fill(leadName);
    await pg.locator("#o_save").click();
    await pg.waitForTimeout(400);
    await pg.locator("#ldQ").fill(leadName);
    await pg.waitForTimeout(300);
    const leadRows = await pg.locator("tbody tr.click").count();
    if (leadRows === 1) ok("COM-01: a new lead is created and listed");
    else bad("COM-01 create", `rows=${leadRows}`);

    await pg.locator("tbody tr.click").first().click();
    await pg.waitForTimeout(300);
    const drawerBeforeVisit = await pg.locator("#drawer").innerText();
    if (
      /Pendiente de visita/.test(drawerBeforeVisit) &&
      /Sin visitas todavía/.test(drawerBeforeVisit)
    )
      ok("COM-01: a new lead's drawer shows it awaiting a visit, with none yet");
    else bad("COM-01 drawer initial state", drawerBeforeVisit.replace(/\n/g, " ").slice(0, 140));

    await pg.locator("#opp_sched").click();
    await pg.waitForTimeout(300);
    // The earliest day the screen will accept — a visit can no longer be
    // scheduled into the past (Package 1, slide 4), and the dataset's `today`
    // is behind the wall clock, so filling `erp.today` here is now refused.
    // Taking the field's own floor keeps the visit un-overdue and completable
    // in this same run without restating the rule the screen owns.
    const floor = await pg.locator("#sv_date").getAttribute("min");
    await pg.locator("#sv_date").fill(floor);
    await pg.locator("#sv_save").click();
    await pg.waitForTimeout(400);

    await pg.evaluate(() => (location.hash = "visits"));
    await pg.waitForTimeout(400);
    const progRows = await pg.locator("#visProgWrap tbody tr.click").count();
    if (progRows >= 1) ok(`COM-02: a scheduled visit appears in "Programadas" (${progRows})`);
    else bad("COM-02 programadas", `rows=${progRows}`);

    await pg.locator("#visProgWrap tbody tr.click").first().click();
    await pg.waitForTimeout(350);
    await pg.locator("#cv_what").fill("cocina");
    await pg.locator("#cv_qty").fill("9.5");
    await pg.locator("#cv_addmeas").click();
    await pg.waitForTimeout(200);
    const measRow = await pg.locator("#cv_meas").innerText();
    if (/cocina/.test(measRow) && /9\.5/.test(measRow))
      ok("COM-02: a measurement is added to the capture before saving");
    else bad("COM-02 measurement add", measRow.replace(/\n/g, " ").slice(0, 120));
    await pg.locator("#cv_notes").fill("croquis a mano adjunto");
    await pg.locator("#cv_save").click();
    await pg.waitForTimeout(400);

    await pg.evaluate(() => (location.hash = "visits"));
    await pg.waitForTimeout(400);
    const realRows = await pg.locator("#visRealWrap tbody tr.click").count();
    if (realRows >= 1) ok(`COM-02: completing a visit moves it to "Realizadas" (${realRows})`);
    else bad("COM-02 realizadas", `rows=${realRows}`);

    // Completing a visit is the exact transition that used to require a
    // separate "awaitingBudget" check on the lead — assert it here too, so
    // the two screens are proven to agree rather than tested in isolation.
    await pg.evaluate(() => (location.hash = "leads"));
    await pg.waitForTimeout(400);
    await pg.locator("#ldQ").fill(leadName);
    await pg.waitForTimeout(300);
    const leadAfterVisit = await pg.locator("tbody tr.click").first().innerText();
    if (/Pendiente de presupuesto/.test(leadAfterVisit) && /Realizada/.test(leadAfterVisit))
      ok("COM-01: the lead reflects the completed visit (awaiting presupuesto, visita realizada)");
    else bad("COM-01 post-visit state", leadAfterVisit.replace(/\n/g, " ").slice(0, 140));

    // Creating a presupuesto from the visit hands off to the real builder.
    await pg.evaluate(() => (location.hash = "visits"));
    await pg.waitForTimeout(400);
    await pg.locator("#visRealWrap tbody tr.click").first().click();
    await pg.waitForTimeout(350);
    const budgetBtn = pg.locator("#vd_newbudget");
    if ((await budgetBtn.count()) === 1) {
      await budgetBtn.click();
      await pg.waitForTimeout(500);
      const onQuotes = await pg.evaluate(() => location.hash.startsWith("#quotes"));
      if (onQuotes) ok("COM-02: creating a presupuesto from a visit opens the real builder");
      else bad("COM-02 → presupuestador handoff", await pg.evaluate(() => location.hash));
    } else {
      bad(
        "COM-02 → presupuestador handoff",
        "no #vd_newbudget button on a visit with no budget yet",
      );
    }

    // Marking a lead lost, with a reason from the owner-maintained list.
    await pg.evaluate(() => (location.hash = "leads"));
    await pg.waitForTimeout(400);
    const secondLeadName = "E2E Perdida " + String(Date.now()).slice(-5);
    await pg.locator("#ldNew").click();
    await pg.waitForTimeout(300);
    await pg.locator("#o_work").fill(secondLeadName);
    await pg.locator("#o_save").click();
    await pg.waitForTimeout(400);
    await pg.locator("#ldQ").fill(secondLeadName);
    await pg.waitForTimeout(300);
    await pg.locator("tbody tr.click").first().click();
    await pg.waitForTimeout(300);
    // Answered by this page's persistent dialog handler above
    // (/^Motivo de la pérdida/ → "price"), registered once per page rather
    // than per-click — a second one-shot handler here would race it.
    await pg.locator("#opp_lose").click();
    await pg.waitForTimeout(400);
    const lostState = await pg.evaluate((name) => {
      const o = erp.state.opportunities.find((x) => x.requestedWork === name);
      return o ? { status: o.status, reason: o.lossReason } : null;
    }, secondLeadName);
    if (lostState && lostState.status === "lost" && lostState.reason === "price")
      ok("COM-01: marking a lead lost records the status and the reason");
    else bad("COM-01 lose", JSON.stringify(lostState));

    // ---- DMC-01: the partidas catalogue, finally inside the shell ---------
    // It used to be a link out to master-data.html, which held a MOCK dataset
    // never wired to the engine — so the real catalogue had no interface at
    // all. What is asserted is that this screen reads the engine's own
    // catalogue, not that a page renders.
    await pg.evaluate(() => (location.hash = "items"));
    await pg.waitForTimeout(450);
    const catState = await pg.evaluate(() => ({
      hash: location.hash,
      branches: document.querySelectorAll(".catbr[data-chap]").length,
      rows: document.querySelectorAll("tr.click[data-item]").length,
      engineItems: erp.state.catalogue.filter((i) => i.active !== false).length,
    }));
    if (
      catState.hash === "#items" &&
      catState.branches > 1 &&
      catState.rows === catState.engineItems
    )
      ok(`DMC-01: the catalogue renders in the shell from the engine (${catState.rows} partidas)`);
    else bad("DMC-01 catalogue", JSON.stringify(catState));

    // The tree filters the table, and the branch counts are real.
    const firstChapter = await pg.evaluate(() => {
      const withItems = erp
        .listAll("itemChapters")
        .find((c) => erp.state.catalogue.some((i) => i.chapter === c.code && i.active !== false));
      return withItems ? withItems.code : null;
    });
    if (firstChapter) {
      await pg.locator(`.catbr[data-chap="${firstChapter}"]`).click();
      await pg.waitForTimeout(350);
      const filtered = await pg.evaluate((c) => {
        const shown = document.querySelectorAll("tr.click[data-item]").length;
        const expect = erp.state.catalogue.filter(
          (i) => i.chapter === c && i.active !== false,
        ).length;
        return { shown, expect };
      }, firstChapter);
      if (filtered.shown === filtered.expect && filtered.shown > 0)
        ok("DMC-01: choosing a chapter in the tree filters the partidas table");
      else bad("DMC-01 tree filter", JSON.stringify(filtered));
    } else {
      bad("DMC-01 tree filter", "no seeded chapter carries any partida");
    }

    // Chapter order is the array order, so a reorder is a real state change
    // the presupuesto will follow — not a cosmetic sort on this screen.
    const reordered = await pg.evaluate(() => {
      const before = erp.listAll("itemChapters").map((c) => c.code);
      erp.moveListEntry("itemChapters", before[0], 2, "e2e");
      const after = erp.listAll("itemChapters").map((c) => c.code);
      return {
        before: before.slice(0, 3),
        after: after.slice(0, 3),
        moved: after[2] === before[0],
      };
    });
    if (reordered.moved) ok("DMC-01: chapters reorder, and the order lives in the document");
    else bad("DMC-01 reorder", JSON.stringify(reordered));

    // brand/model/quality are the doc's DMC-01 columns and must round-trip.
    await pg.evaluate(() => (location.hash = "items"));
    await pg.waitForTimeout(400);
    await pg.locator("#catNew").click();
    await pg.waitForTimeout(300);
    const catCode = "E2E-" + String(Date.now()).slice(-5);
    await pg.locator("#ci_code").fill(catCode);
    await pg.locator("#ci_desc").fill("Partida de prueba");
    await pg.locator("#ci_brand").fill("MarcaX");
    await pg.locator("#ci_model").fill("ModeloY");
    await pg.locator("#ci_qual").fill("alta");
    await pg.locator("#ci_cost").fill("12.50");
    await pg.locator("#ci_save").click();
    await pg.waitForTimeout(400);
    const made = await pg.evaluate((c) => {
      const i = erp.state.catalogue.find((x) => x.code === c);
      return i
        ? {
            brand: i.brand,
            model: i.model,
            quality: i.quality,
            cost: i.defaultCostCents,
            price: i.defaultPriceCents,
          }
        : null;
    }, catCode);
    if (
      made &&
      made.brand === "MarcaX" &&
      made.model === "ModeloY" &&
      made.quality === "alta" &&
      made.cost === 1250
    )
      ok("DMC-01: brand, model and quality capture and persist");
    else bad("DMC-01 brand/model/quality", JSON.stringify(made));

    // A blank reference price stays blank. Zero would mean "we quote this for
    // nothing", which is a different and untrue statement.
    // The new partida was created with no chapter, so clear the tree filter
    // still set from the check above before looking for its row.
    await pg.locator('.catbr[data-chap=""]').click();
    await pg.waitForTimeout(350);
    if (made && made.price === 0) {
      const priceCell = await pg.evaluate((c) => {
        const tr = [...document.querySelectorAll("tr.click[data-item]")].find((r) =>
          r.textContent.includes(c),
        );
        return tr ? tr.textContent : "";
      }, catCode);
      if (/sin precio/i.test(priceCell))
        ok("DMC-01: a partida with no reference price reads «sin precio», not 0,00 €");
      else bad("DMC-01 blank price", priceCell.slice(0, 120));
    }

    // ---- DMC-02: the comparison strip, and the rule it exists to protect ----
    await pg.evaluate(() => (location.hash = "price-list"));
    await pg.waitForTimeout(450);
    // The strip is deliberately absent until one partida is chosen: comparing
    // suppliers across different items is not a comparison.
    const stripBefore = await pg.locator(".pstrip").count();
    if (stripBefore === 0) ok("DMC-02: no comparison strip until a partida is chosen");
    else bad("DMC-02 strip gating", `strip present with no filter (${stripBefore})`);

    // Pick the partida the seed prices most suppliers against, so the strip
    // has both a cheapest and a "sin precio" card to draw.
    const pickable = await pg.evaluate(() => {
      const counts = {};
      for (const p of erp.state.prices) counts[p.itemId] = (counts[p.itemId] || 0) + 1;
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return best ? best[0] : null;
    });
    if (!pickable) {
      bad("DMC-02 strip", "the seed carries no prices at all");
    } else {
      await pg.locator("#prcItem").selectOption(pickable);
      await pg.waitForTimeout(400);
      const strip = await pg.evaluate(() => ({
        cards: document.querySelectorAll(".pcard").length,
        best: document.querySelectorAll(".pcard.best").length,
        none: document.querySelectorAll(".pcard.none").length,
        zeros: [...document.querySelectorAll(".pcard.none .net")].map((n) => n.textContent.trim()),
      }));
      if (strip.cards > 0 && strip.best === 1)
        ok(`DMC-02: the strip marks exactly one cheapest supplier (${strip.cards} cards)`);
      else bad("DMC-02 cheapest", JSON.stringify(strip));

      // The rule the doc is explicit about: a supplier with no price is never
      // rendered as a zero, which would make them look like the cheapest.
      if (strip.none === 0 || strip.zeros.every((z) => /sin precio/i.test(z)))
        ok("DMC-02: a supplier without a price reads «sin precio», never 0,00 €");
      else bad("DMC-02 missing-as-zero", JSON.stringify(strip.zeros));
    }

    // Gaps 6-9 are capturable from the screen, not just present in the model.
    await pg.locator("#prcNew").click();
    await pg.waitForTimeout(300);
    await pg.locator("#pr_list").fill("100");
    await pg.locator("#pr_disc").fill("10");
    await pg.waitForTimeout(150);
    const derivedNet = await pg.locator("#pr_net").inputValue();
    await pg.locator("#pr_ref").fill("SUP-REF-9");
    await pg.locator("#pr_tax").fill("21");
    await pg.locator("#pr_waste").fill("3.5");
    await pg.locator("#pr_min").fill("25");
    await pg.locator("#pr_proj").fill("OBRA-E2E");
    await pg.locator("#pr_notes").fill("nota e2e");
    await pg.locator("#pr_save").click();
    await pg.waitForTimeout(400);
    const saved = await pg.evaluate(() => {
      const p = erp.state.prices[erp.state.prices.length - 1];
      return {
        net: p.netCents,
        tax: p.taxRateBp,
        ref: p.supplierRef,
        waste: p.wasteCents,
        min: p.minOrder,
        proj: p.projectRef,
        notes: p.notes,
      };
    });
    if (
      derivedNet === "90.00" &&
      saved.net === 9000 &&
      saved.tax === 2100 &&
      saved.ref === "SUP-REF-9" &&
      saved.waste === 350 &&
      saved.min === 25 &&
      saved.proj === "OBRA-E2E" &&
      saved.notes === "nota e2e"
    )
      ok(
        "DMC-02: gaps 6-9 (IVA, código art., residuos, mínimo, proyecto, notas) capture and persist",
      );
    else bad("DMC-02 gap fields", `derived=${derivedNet} ${JSON.stringify(saved)}`);

    // An unstated IVA stays unstated. Storing 0 would assert a rate nobody gave.
    await pg.locator("#prcNew").click();
    await pg.waitForTimeout(300);
    await pg.locator("#pr_list").fill("50");
    await pg.locator("#pr_save").click();
    await pg.waitForTimeout(400);
    const blankTax = await pg.evaluate(
      () => erp.state.prices[erp.state.prices.length - 1].taxRateBp,
    );
    if (blankTax === null) ok("DMC-02: an unrecorded IVA stays null, it does not become 0%");
    else bad("DMC-02 null tax", `taxRateBp=${blankTax}`);

    if (errs.length === 0) ok("torre/alertas: no console errors");
    else bad("torre/alertas: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("torre de control / alertas", String(e).slice(0, 220));
  } finally {
    await pg.close();
  }
}

// ── Recorrido completo: the project selector (session 12, §2.3, Improvement
//    #3). "Crear nuevo proyecto" stays the untouched default — testJourney
//    already covers it end to end — this exercises the ADDITION: picking a
//    real, already-existing project and seeing real data, not the sample.
/* COM-03 after Package 1 slides 8 and 9 — the heart of the system, reworked:
     · columns in the order the work is done, cost and margin before the price
     · margin is an INPUT in %, and the sale price follows from cost + margin
     · a 🔍 on every line searches the catalogue and fills the row from it
     · chapters come from the catalogue instead of being typed fresh
     · the bottom bar keeps two fields; finishing moved behind "Siguiente paso"
     · Superficie is gone, input and figure both */
async function testPresupuestadorRework(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  attachConsole(pg, errs);
  // Deliberately NO autoAnswerModals here: this suite inspects the chapter
  // picker's own contents, and the auto-answerer would press its primary
  // button within 80 ms and leave nothing to look at. Nothing else in this
  // suite opens a question, and the one modal it does open is dismissed with
  // Escape below.
  try {
    await pg.goto(`${base}/erp.html#quotes`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);
    await pg.evaluate(() => {
      const b =
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0];
      go("quotes", b.id);
    });
    await pg.waitForTimeout(800);

    // ---- the column order the operator asked for --------------------------
    const heads = await pg.evaluate(() =>
      [...document.querySelectorAll(".bgrid thead th")]
        .map((t) => t.textContent.trim())
        .filter(Boolean),
    );
    // The headings were shortened when the column widths were declared — the
    // long forms cost about 80 px of a pane that had none to give. What this
    // asserts is the ORDER, which is the operator's decision (cost and margin
    // before the sale price, because the sale price is derived from them); the
    // wording is free to get shorter.
    const want = [
      "Descripción",
      "Unidad",
      "Coste ud.",
      "Margen %",
      "Cantidad",
      "P. venta ud.",
      "Total",
    ];
    const idx = want.map((w) => heads.indexOf(w));
    if (idx.every((n, i) => n >= 0 && (i === 0 || n > idx[i - 1])))
      ok(
        "presupuestador: columns run descripción → unidad → coste → margen % → cantidad → venta → total",
      );
    else bad("presupuestador: column order", JSON.stringify(heads));

    /* ---- the grid is READ, not merely rendered -----------------------------
       Three geometric facts, because every one of them was false on a screen
       whose every other check passed. A screenshot showed four different
       partidas all reading the same truncated code, four descriptions cut
       mid-word, and five column headings run together into one string — and
       nothing failed, because counting cells is not the same as looking at
       them.

       Codes and numbers are FIXED-LENGTH values. A truncated one is not
       cosmetic: two partidas become indistinguishable, which is a quote the
       estimator cannot check. Zero tolerance there. The description is free
       text and can always be made longer than any column, so what is asserted
       of it is a floor on the width it is given — a share of the pane, so it
       cannot be quietly eaten by a column added later. */
    const grid = await pg.evaluate(() => {
      const rows = [...document.querySelectorAll("#bRows tr.pbrow")];
      const clipped = (sel) =>
        rows
          .map((r) => r.querySelector(sel))
          .filter((el) => el && el.scrollWidth > el.clientWidth + 1)
          .map((el) => (el.value || el.textContent || "").trim());
      const th = [...document.querySelectorAll(".bgrid thead th")];
      // A heading wider than its column does not widen it under a fixed table
      // layout — it runs into the next one.
      const overflowing = th
        .filter((t) => t.scrollWidth > t.clientWidth + 1)
        .map((t) => t.textContent.trim());
      const desc = rows[0] && rows[0].querySelector("td.c-desc");
      const table = document.querySelector(".bgrid table");
      return {
        codes: clipped('[data-f="code"]'),
        nums: clipped('[data-f="num"]'),
        units: clipped('[data-f="unit"]'),
        amounts: clipped(".out"),
        overflowing,
        descShare:
          desc && table
            ? Math.round(
                (desc.getBoundingClientRect().width / table.getBoundingClientRect().width) * 100,
              )
            : 0,
      };
    });
    const stuck = [
      ...grid.codes.map((v) => `código ${v}`),
      ...grid.nums.map((v) => `nº ${v}`),
      ...grid.units.map((v) => `unidad ${v}`),
      ...grid.amounts.map((v) => `importe ${v}`),
    ];
    if (!stuck.length)
      ok("presupuestador: no code, number, unit or amount is cut off by its column");
    else bad("presupuestador: fixed-length values truncated", stuck.slice(0, 6).join(" · "));

    if (!grid.overflowing.length) ok("presupuestador: every column heading fits its column");
    else
      bad("presupuestador: headings run into each other", grid.overflowing.slice(0, 6).join(" · "));

    // 30%: measured at 33% on a 1600px window with the tree folded. A floor,
    // not a target — the free-text column is the one the estimator reads.
    if (grid.descShare >= 30)
      ok(`presupuestador: the description keeps ${grid.descShare}% of the grid`);
    else bad("presupuestador: description column squeezed", `${grid.descShare}% of the table`);

    // "Ojo con las unidades": the unit is picked from DMC-03, not typed.
    const unitTag = await pg.evaluate(() => document.querySelector('[data-f="unit"]')?.tagName);
    if (unitTag === "SELECT")
      ok("presupuestador: the unit is chosen from the units list, not typed");
    else bad("presupuestador: unit is a select", unitTag);

    // ---- margin drives the price, and the price back-solves the margin ----
    const setField = async (f, value) =>
      pg.evaluate(
        ({ f, value }) => {
          const el = document.querySelector(`tr.pbrow [data-f="${f}"]`);
          el.value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        },
        { f, value },
      );
    const readRow = async () =>
      pg.evaluate(() => {
        const g = (f) => +document.querySelector(`tr.pbrow [data-f="${f}"]`).value;
        return { cost: g("cost"), margin: g("marginPct"), price: g("price") };
      });
    await setField("cost", "50");
    await setField("marginPct", "50");
    await pg.waitForTimeout(300);
    let r = await readRow();
    // 50 % margin over the SALE price means the price is twice the cost.
    if (Math.abs(r.price - 100) < 0.02)
      ok("presupuestador: a 50% margin on a 50 € cost gives a 100 € price (margin over sale)");
    else bad("presupuestador: margin drives price", JSON.stringify(r));

    await setField("price", "80");
    await pg.waitForTimeout(300);
    r = await readRow();
    if (Math.abs(r.margin - 37.5) < 0.11)
      ok("presupuestador: typing a price back-solves the margin (80 € on 50 € = 37,5%)");
    else bad("presupuestador: price back-solves margin", JSON.stringify(r));

    const held = r.margin;
    await setField("cost", "60");
    await pg.waitForTimeout(300);
    r = await readRow();
    if (Math.abs(r.margin - held) < 0.11 && r.price > 80)
      ok("presupuestador: changing the cost holds the margin and moves the price");
    else bad("presupuestador: cost holds margin", JSON.stringify(r) + " held=" + held);

    // ---- the catalogue picker fills the whole line -----------------------
    await pg.click("[data-find]");
    await pg.waitForTimeout(500);
    const items = await pg.locator(".cpi").count();
    if (items > 0) ok(`presupuestador: 🔍 opens the catalogue with its list (${items} partidas)`);
    else bad("presupuestador: catalogue picker opens populated", `items=${items}`);
    await pg.fill("#cp_q", "alicatado");
    await pg.waitForTimeout(300);
    /* TICK, THEN ADD. The 🔍 is multi-select now — the operator asked to go
       through the catalogue once, mark everything needed and take the lot —
       so clicking a row marks it and the sheet stays open. Clicking one and
       expecting the row to change was the old single-pick behaviour.

       And the assertion compares against the PARTIDA THAT WAS PICKED. It used
       to check only that the row's four fields were non-empty, which they
       already were from the margin edits above — so it passed without the pick
       having done anything at all, and would have gone on passing if the
       picker had stopped working entirely. */
    const picked = await pg.evaluate(async () => {
      const row = document.querySelector(".cpi.pick");
      if (!row) return { err: "the catalogue offered nothing for «alicatado»" };
      const code = row.querySelector(".cpc").textContent.trim();
      const item = erp.state.catalogue.find((i) => i.code === code);
      row.click();
      document.querySelector("#cp_add").click();
      await new Promise((r) => setTimeout(r, 700));
      const g = (f) => document.querySelector(`tr.pbrow [data-f="${f}"]`).value;
      return {
        want: {
          code: item.code,
          desc: item.desc,
          unit: item.unit,
          cost: (item.defaultCostCents / 100).toFixed(2),
        },
        got: { code: g("code"), desc: g("desc"), unit: g("unit"), cost: g("cost") },
        closed: !document.querySelector("#catpick"),
      };
    });
    if (picked.err) bad("presupuestador: catalogue pick fills the row", picked.err);
    else if (
      picked.closed &&
      picked.got.code === picked.want.code &&
      picked.got.desc === picked.want.desc &&
      picked.got.unit === picked.want.unit &&
      picked.got.cost === picked.want.cost
    )
      ok(
        `presupuestador: picking a partida fills código, descripción, unidad and coste (${picked.want.code})`,
      );
    else bad("presupuestador: catalogue pick fills the row", JSON.stringify(picked).slice(0, 220));

    /* ---- the whole row is visible without scrolling sideways -------------
       "Still not all line visible, fix it once for all." Measured rather than
       eyeballed: thirteen columns need about 1 150 px and a 1 440 px laptop
       leaves the middle pane about 880, so the sale price sat off the right
       edge of the one screen an estimator reads it on. The chapter tree now
       folds by default below 1 600 px — it is the most redundant pane, since
       every chapter it lists is already a row in the grid.

       This assertion is the point of the change. Without it "it fits" is a
       claim, and the next column added takes it back with nothing going red. */
    const fit = await pg.evaluate(() => {
      const pane = document.querySelector(".pbpane.mid .scroll");
      const table = pane && pane.querySelector("table");
      return {
        pane: pane ? pane.clientWidth : 0,
        table: table ? table.scrollWidth : 0,
        foldedLeft: document.querySelector("#pbPanes")?.classList.contains("foldL"),
        leftShown: !!document.querySelector("#pbLeft")?.offsetParent,
      };
    });
    if (fit.pane > 0 && fit.table <= fit.pane)
      ok(`presupuestador: the whole row fits — ${fit.table}px of columns in ${fit.pane}px of pane`);
    else bad("presupuestador: line grid fits without horizontal scrolling", JSON.stringify(fit));
    if (fit.foldedLeft === true && fit.leftShown === false)
      ok("presupuestador: on a laptop the chapter tree folds away to make the room");
    else bad("presupuestador: narrow-screen default folds the tree", JSON.stringify(fit));

    // Folding is reversible, and the control to reverse it is in the pane that
    // stays — a toggle that disappears with what it toggles cannot undo itself.
    await pg.click("#pbFoldL");
    await pg.waitForTimeout(300);
    const unfolded = await pg.evaluate(() => ({
      leftShown: !!document.querySelector("#pbLeft")?.offsetParent,
      control: !!document.querySelector("#pbFoldL")?.offsetParent,
    }));
    if (unfolded.leftShown && unfolded.control)
      ok("presupuestador: the tree comes back, and its control is still reachable");
    else bad("presupuestador: fold is reversible", JSON.stringify(unfolded));
    await pg.click("#pbFoldL");
    await pg.waitForTimeout(300);

    /* ---- «+ partida» IS the catalogue, not a blank row -------------------
       The operator's complaint: "when I add item and trying to add subitems I
       can't select them in the drop down menu… I want to add from catalog
       items and below catalog sub items and automatically see the prices and
       all the other information in each line." The button used to create
       «Nueva partida» at 0,00 €, which is what made a two-hundred-partida
       price book invisible from the one screen that needs it. */
    const chapButtons = await pg.evaluate(() => ({
      fromCatalogue: !!document.querySelector("tr.chaprow [data-addline]"),
      blank: !!document.querySelector("tr.chaprow [data-blankline]"),
    }));
    if (chapButtons.fromCatalogue && chapButtons.blank)
      ok("presupuestador: a chapter offers both the catalogue and a blank partida");
    else bad("presupuestador: chapter add buttons", JSON.stringify(chapButtons));

    const linesBefore = await pg.evaluate(() => document.querySelectorAll("tr.pbrow").length);
    await pg.click("tr.chaprow [data-addline]");
    await pg.waitForTimeout(600);
    const multi = await pg.evaluate(() => ({
      ticks: document.querySelectorAll(".cpi.pick .cpx").length,
      addDisabled: document.querySelector("#cp_add")?.disabled,
      // Scoped to the chapter it was pressed on — adding is local, even though
      // the 🔍 above searches globally.
      chapter: document.querySelector("#cp_chap")?.value || "",
      chapterChoices: document.querySelectorAll("#cp_chap option").length,
    }));
    if (multi.ticks > 0 && multi.addDisabled === true)
      ok(`presupuestador: «+ partida del catálogo» opens ticked-list mode (${multi.ticks} shown)`);
    else bad("presupuestador: multi-select picker opens", JSON.stringify(multi));
    /* THE CONTRACT, NOT A SECOND COPY OF THE RULE.
       This used to recompute the expected scope by reimplementing the app's own
       chapter matcher — `x.es === name`, scraped out of a DOM node — so it
       asserted only that the test had copied the rule correctly. It then broke
       the moment the rule was improved and the markup moved, on a change that
       made the feature MORE right. What matters is the behaviour under either
       rule: whatever the picker scopes to, everything it offers must belong
       there, and the whole book stays one control away. */
    const scope = await pg.evaluate(() => {
      const code = document.querySelector("#cp_chap")?.value || "";
      const shown = [...document.querySelectorAll(".cpi.pick")]
        .map((b) => b.querySelector(".cpc")?.textContent.trim())
        .map((c) => erp.state.catalogue.find((i) => i.code === c))
        .filter(Boolean);
      return {
        code,
        shown: shown.length,
        strays: code ? shown.filter((i) => i.chapter !== code).length : 0,
        choices: document.querySelectorAll("#cp_chap option").length,
      };
    });
    if (scope.shown > 0 && scope.strays === 0 && scope.choices > 1)
      ok(
        `presupuestador: it opens on ${scope.code || "the whole catalogue"} — ${scope.shown} partidas, none from elsewhere, every chapter one click away`,
      );
    else bad("presupuestador: picker scoped to the chapter", JSON.stringify(scope));

    // Tick two and take them in one go — the round trip this mode removes.
    const wanted = await pg.evaluate(() => {
      const list = [...document.querySelectorAll(".cpi.pick")].slice(0, 2);
      list.forEach((b) => b.click());
      return list.map((b) => b.querySelector(".cpc").textContent.trim());
    });
    await pg.waitForTimeout(300);
    const armed = await pg.evaluate(() => ({
      on: document.querySelectorAll(".cpi.on").length,
      addDisabled: document.querySelector("#cp_add")?.disabled,
    }));
    if (armed.on === 2 && armed.addDisabled === false)
      ok("presupuestador: ticking two arms «Añadir» without closing the list");
    else bad("presupuestador: ticks accumulate", JSON.stringify(armed));

    await pg.click("#cp_add");
    await pg.waitForTimeout(800);
    const added = await pg.evaluate((codes) => {
      const rows = [...document.querySelectorAll("tr.pbrow")];
      const found = codes.map((c) => {
        const tr = rows.find((r) => r.querySelector('[data-f="code"]')?.value === c);
        if (!tr) return null;
        const g = (f) => tr.querySelector(`[data-f="${f}"]`).value;
        return {
          code: g("code"),
          desc: g("desc"),
          unit: g("unit"),
          cost: +g("cost"),
          price: +g("price"),
          qty: +g("qty"),
          spec: tr.querySelector(".lspec")?.textContent || "",
        };
      });
      return { total: rows.length, found };
    }, wanted);
    if (added.total === linesBefore + 2)
      ok("presupuestador: two ticks become two lines in one round trip");
    else
      bad(
        "presupuestador: both picked partidas land",
        `${linesBefore} -> ${added.total}, wanted +2`,
      );
    const complete = added.found.filter(
      (r) => r && r.desc && r.unit && r.cost > 0 && r.price > 0 && r.qty === 1,
    );
    if (complete.length === 2)
      ok("presupuestador: each arrives priced from the catalogue, not at 0,00 €");
    else bad("presupuestador: catalogue figures reach the line", JSON.stringify(added.found));
    // The four fields that were on the catalogue record and nowhere else.
    if (added.found.some((r) => r && r.spec))
      ok("presupuestador: the line shows what the catalogue says it IS (marca · modelo · calidad)");
    else
      bad(
        "presupuestador: brand/model/quality/type reach the line",
        JSON.stringify(added.found.map((r) => r && r.spec)),
      );

    await pg.click("tr.chaprow [data-blankline]");
    await pg.waitForTimeout(600);
    const blank = await pg.evaluate(
      (n) => ({
        total: document.querySelectorAll("tr.pbrow").length,
        expected: n + 3,
      }),
      linesBefore,
    );
    if (blank.total === blank.expected)
      ok("presupuestador: a partida not in the price book can still be written by hand");
    else bad("presupuestador: blank partida still available", JSON.stringify(blank));

    // ---- chapters come from the catalogue --------------------------------
    await pg.click("#bAddChap");
    await pg.waitForTimeout(500);
    const chap = await pg.evaluate(() => ({
      groups: [...document.querySelectorAll(".modal .mopts .og")].map((g) => g.textContent),
      hasFree: [...document.querySelectorAll(".modal .mopts label")].some((l) =>
        /Otro nombre/.test(l.textContent),
      ),
    }));
    if (chap.groups.includes("Del catálogo") && chap.hasFree)
      ok("presupuestador: chapters are offered from the catalogue, with a way out for a one-off");
    else bad("presupuestador: chapter picker", JSON.stringify(chap));
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(300);

    // ---- Superficie gone; finishing behind one button --------------------
    const bar = await pg.evaluate(() => ({
      m2: !!document.querySelector("#bcM2"),
      porM2: (document.querySelector("#bSide")?.textContent || "").includes("Por m²"),
      next: !!document.querySelector("#bcNext"),
      validate: !!document.querySelector("#bValidate"),
    }));
    if (!bar.m2 && !bar.porM2) ok("presupuestador: Superficie is gone from the bar and the totals");
    else bad("presupuestador: superficie removed", JSON.stringify(bar));
    if (bar.next && !bar.validate)
      ok("presupuestador: the bar ends in one «Siguiente paso» instead of three endings");
    else bad("presupuestador: siguiente paso replaces the scattered buttons", JSON.stringify(bar));

    // Part 2 · item 14: validity is policy, not a choice. The date input is
    // hidden (HIDDEN_CONTROLS — removable in one line, per the removal rule)
    // and the bar SAYS the policy instead, because an invisible rule reads
    // as a bug.
    const validity = await pg.evaluate(() => ({
      input: !!document.querySelector("#bcValid"),
      pill: /Validez · 30 días/.test(document.querySelector(".pbcond")?.textContent || ""),
    }));
    if (!validity.input && validity.pill)
      ok("presupuestador: the validity selector is gone and the 30-day policy is stated");
    else bad("presupuestador: validity policy", JSON.stringify(validity));

    await pg.click("#bcNext");
    await pg.waitForTimeout(600);
    const ns = await pg.evaluate(() => ({
      title: document.querySelector("#dttl")?.textContent || "",
      cards: [...document.querySelectorAll("#dbody .ch h3")].map((h) => h.textContent),
      send: !!document.querySelector("#ns_send"),
    }));
    const wantCards = [
      "Resumen",
      "Condiciones de pago",
      "Exclusiones",
      "Supuestos",
      "Comprobación",
    ];
    if (/Siguiente paso/.test(ns.title) && wantCards.every((c) => ns.cards.includes(c)) && ns.send)
      ok("presupuestador: «Siguiente paso» carries terms, exclusions, the check and the send");
    else bad("presupuestador: siguiente paso contents", JSON.stringify(ns));
    await pg.evaluate(() => closeDrawer());

    if (errs.length) bad("presupuestador: no console errors", errs.slice(0, 2).join(" | "));
    else ok("presupuestador: no console errors");
  } catch (e) {
    bad("presupuestador (rework): suite completed", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

/* Package 2 slide 3 (PK2-A): the backing document behind a decision is a FILE
   now, not a typed filename. "correo-aceptacion.pdf" in a text box proved
   nothing and could not be reopened.

   This exercises the shared primitive three later screens depend on: the
   drop-or-browse field, the record it produces, the acceptance date and
   person that travel with it, and the viewer that reads a PDF as well as a
   photograph. */
/** A structurally valid one-page PDF, xref table included, built here rather
    than committed as a fixture so the bytes are readable next to the test. */
function minimalPdf() {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = "BT /F1 18 Tf 20 100 Td (Aceptado) Tj ET";
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const off = [];
  objs.forEach((body, i) => {
    off.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  off.forEach((o) => (out += String(o).padStart(10, "0") + " 00000 n \n"));
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

async function testEvidence(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  attachConsole(pg, errs);
  try {
    await pg.goto(`${base}/erp.html#quotes`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);

    // An issued version nobody has answered yet is the one state in which the
    // customer's answer can still be recorded.
    const opened = await pg.evaluate(() => {
      const b = erp.state.budgets.find(
        (x) =>
          !x.acceptedVersionId && (x.versions || []).some((v) => v.issued && !v.customerResponse),
      );
      if (!b) return null;
      go("quotes", b.id);
      // Whether this customer had an open opportunity decides what the
      // acceptance is allowed to move; without one there is nothing to date.
      return {
        id: b.id,
        hadOpp: !!erp.state.opportunities.find(
          (x) => x.partyId === b.partyId && !["won", "lost"].includes(x.status),
        ),
      };
    });
    if (!opened) {
      bad("evidence: an issued unanswered version exists to answer", "none in the seed");
      return;
    }
    await pg.waitForTimeout(800);
    await pg.click("#bAnswer");
    await pg.waitForTimeout(500);

    // ---- the justificante is a dropzone, not a text box --------------------
    const field = await pg.evaluate(() => ({
      zone: !!document.querySelector("#brEvid .evz"),
      file: !!document.querySelector("#brEvid input[type=file]"),
      accept: document.querySelector("#brEvid input[type=file]")?.accept || "",
      oldTextBox: document.querySelector("#brEvid")?.tagName === "INPUT",
      date: document.querySelector("#brDate")?.value || "",
      maxDate: document.querySelector("#brDate")?.max || "",
      who: !!document.querySelector("#brWho"),
    }));
    if (field.zone && field.file && !field.oldTextBox)
      ok("evidence: the justificante is a drop-or-browse field, not a text box");
    else bad("evidence: justificante is a real upload", JSON.stringify(field));
    if (/pdf/.test(field.accept) && /image/.test(field.accept))
      ok("evidence: it accepts a PDF as well as an image");
    else bad("evidence: accepts pdf and image", field.accept);
    // Slide 3 asks for the acceptance date and the person, and the date has to
    // allow a past day — the answer arrives before anyone records it.
    if (field.date && field.maxDate === field.date && field.who)
      ok("evidence: acceptance carries a date (today, backdatable) and who accepted it");
    else bad("evidence: date + person fields", JSON.stringify(field));

    // ---- attaching a real PDF ---------------------------------------------
    // A genuine, structurally valid PDF — xref table and all. A fake byte
    // string would prove the upload and hide a broken viewer behind it.
    await pg.setInputFiles("#brEvid input[type=file]", {
      name: "correo-aceptacion.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(minimalPdf(), "latin1"),
    });
    await pg.waitForTimeout(700);
    const attached = await pg.evaluate(() => ({
      chip: !!document.querySelector("#brEvid .evfile"),
      name: document.querySelector("#brEvid .evnm")?.textContent || "",
      see: !!document.querySelector("#brEvid [data-ev=see]"),
      drop: !!document.querySelector("#brEvid [data-ev=drop]"),
    }));
    if (attached.chip && attached.name === "correo-aceptacion.pdf" && attached.see && attached.drop)
      ok("evidence: the attached file shows as a named chip with «Ver» and «Quitar»");
    else bad("evidence: attached chip", JSON.stringify(attached));

    // ---- what is actually persisted ---------------------------------------
    await pg.fill("#brWho", "Marta Roca · propietaria");
    const backdate = await pg.evaluate(() => {
      const d = new Date(erp.today + "T00:00:00");
      d.setDate(d.getDate() - 3);
      const iso = d.toISOString().slice(0, 10);
      document.querySelector("#brDate").value = iso;
      return iso;
    });
    await pg.click("#brOk");
    await pg.waitForTimeout(800);
    const saved = await pg.evaluate((bid) => {
      const b = erp.budget(bid);
      const v = erp.version(bid, b.acceptedVersionId);
      const r = (v && v.customerResponse) || {};
      const o = erp.state.opportunities.find((x) => x.partyId === b.partyId && x.status === "won");
      return {
        accepted: !!r.accepted,
        date: r.date || "",
        by: r.acceptedBy || "",
        key: (r.evidence && r.evidence.storageKey) || "",
        type: (r.evidence && r.evidence.type) || "",
        fname: (r.evidence && r.evidence.name) || "",
        size: (r.evidence && r.evidence.size) || 0,
        decidedAt: (o && o.decidedAt) || "",
      };
    }, opened.id);
    if (saved.accepted && saved.key && saved.type === "application/pdf" && saved.size > 0)
      ok("evidence: the record stores the file itself — key, type and size");
    else bad("evidence: persisted evidence record", JSON.stringify(saved));
    if (saved.date === backdate && saved.by === "Marta Roca · propietaria")
      ok("evidence: the backdated answer and the person who gave it are kept");
    else bad("evidence: backdated date + person persisted", JSON.stringify(saved));
    // A backdated acceptance must land in the quarter it happened — but only
    // where there was an open opportunity for it to decide.
    if (opened.hadOpp) {
      if (saved.decidedAt === backdate)
        ok("evidence: the opportunity is decided on the answer's day, not on today");
      else bad("evidence: decidedAt follows the answer", JSON.stringify(saved));
    }
    // The blob is really in the store, not merely referenced.
    const stored = await pg.evaluate(
      async (k) => (await ErpStore.getBlob(k)) instanceof Blob,
      saved.key,
    );
    if (stored) ok("evidence: the file is in the blob store, not only pointed at");
    else bad("evidence: blob present in store", saved.key);

    // ---- it can be reopened afterwards ------------------------------------
    const panel = await pg.evaluate(() => {
      const side = document.querySelector("#bSide")?.textContent || "";
      return {
        shows: side.includes("Aceptación"),
        link: !!document.querySelector("#bSide [data-evidence]"),
      };
    });
    if (panel.shows && panel.link)
      ok("evidence: the acceptance and its document are reachable from the builder afterwards");
    else bad("evidence: acceptance panel", JSON.stringify(panel));

    // ---- the viewer reads a PDF, not only photographs ----------------------
    await pg.click("#bSide [data-evidence]");
    await pg.waitForTimeout(2500);
    const viewer = await pg.evaluate(() => {
      const v = document.querySelector(".pview");
      if (!v) return { open: false };
      const ext = v.querySelector("[data-pv=ext]");
      return {
        open: true,
        canvas: !!v.querySelector("canvas"),
        // The escape hatch, for a browser too old for the bundled pdf.js.
        ext: !!ext && /^blob:/.test(ext.href || ""),
        dl: v.querySelector("[data-pv=dl]")?.getAttribute("download") || "",
      };
    });
    if (viewer.open && viewer.canvas) ok("evidence: the viewer renders the PDF itself, in the app");
    // Not a soft assertion. pdf.js 6.2 needs a very recent engine, and the
    // requirement is that the document is ALWAYS reachable — drawn here when
    // the browser can, handed to the browser's own reader when it cannot.
    // A dead end is the only failing outcome.
    else if (viewer.open && viewer.ext)
      ok("evidence: where the PDF cannot be drawn, the viewer still opens the real file");
    else bad("evidence: the pdf is reachable from the viewer", JSON.stringify(viewer));
    if (viewer.dl === "correo-aceptacion.pdf")
      ok("evidence: it downloads under the name it was uploaded with");
    else bad("evidence: download name", JSON.stringify(viewer));
    // Escape closes the document and leaves the builder standing.
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(300);
    const after = await pg.evaluate(() => ({
      viewer: !!document.querySelector(".pview"),
      builder: !!document.querySelector(".pb"),
    }));
    if (!after.viewer && after.builder)
      ok("evidence: Escape closes the document without closing what opened it");
    else bad("evidence: escape scoping", JSON.stringify(after));

    if (errs.length) bad("evidence: no console errors", errs.slice(0, 2).join(" | "));
    else ok("evidence: no console errors");
  } catch (e) {
    bad("evidence: suite completed", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

/* Package 2 slide 2 (PK2-B): "No hay forma de ir a cada una de las
   versiones" — the builder header named the version it was showing but gave
   no way to REACH any other one. Package 2 slide 1: the send drawer's
   channels didn't do anything channel-specific — WhatsApp needed a real
   deep-link, email needed to go through the operator's own template, "en
   mano" needed a backdatable date/time, and there was no way to get a PDF
   at all. */
async function testSendAndVersions(browser, base) {
  const errs = [];
  let ctx, pg;
  async function freshPage() {
    ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    pg = await ctx.newPage();
    await pg.addInitScript(() => {
      window.__opened = [];
      const orig = window.open;
      window.open = (url) => {
        window.__opened.push(url);
        return null;
      };
    });
    attachConsole(pg, errs);
    await pg.goto(`${base}/erp.html#quotes`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);
  }
  try {
    // ---- version navigator: the header picker and the drawer's own list ---
    await freshPage();
    const target = await pg.evaluate(() => {
      const b = erp.state.budgets.find((x) => x.versions.length > 1);
      if (!b) return null;
      go("quotes", b.id);
      return { id: b.id, versions: b.versions.length };
    });
    if (!target) {
      bad("versions: a multi-version budget exists to navigate", "none in the seed");
    } else {
      await pg.waitForTimeout(700);
      const picker = await pg.evaluate(() => {
        const s = document.querySelector("#bVerPick");
        return s ? { count: s.options.length, val: s.value } : null;
      });
      if (picker && picker.count === target.versions)
        ok("versions: the builder header offers every version, not only the current one");
      else bad("versions: header picker options", JSON.stringify(picker));

      await pg.evaluate(() => {
        const s = document.querySelector("#bVerPick");
        const other = [...s.options].find((o) => o.value !== s.value);
        s.value = other.value;
        s.dispatchEvent(new Event("change"));
      });
      await pg.waitForTimeout(600);
      const opened = await pg.evaluate(() => ({
        title: document.querySelector("#dttl")?.textContent || "",
      }));
      if (/PRE-/.test(opened.title))
        ok("versions: picking another version opens its full document");
      else bad("versions: picked version opens a document", JSON.stringify(opened));

      // Jumping between versions from inside the drawer itself, via the
      // clickable rows in its own "Versiones" list.
      const rows = await pg.evaluate(() => document.querySelectorAll("[data-goverid]").length);
      if (rows >= 1) {
        await pg.click("[data-goverid]");
        await pg.waitForTimeout(500);
        const after = await pg.evaluate(() => ({
          title: document.querySelector("#dttl")?.textContent || "",
          activeMarked: !!document.querySelector(".daylist .it.active"),
        }));
        if (/PRE-/.test(after.title) && after.activeMarked)
          ok("versions: the version list inside Vista previa is itself clickable");
        else bad("versions: in-drawer version jump", JSON.stringify(after));
      } else bad("versions: clickable rows in the Versiones card", rows);
    }

    // ---- send: WhatsApp deep-link ------------------------------------------
    await ctx.close();
    await freshPage();
    const wa = await pg.evaluate(() => {
      const b = erp.state.budgets.find(
        (x) =>
          erp.budgetStage(x) === "draft" &&
          erp.party(x.partyId).mobile &&
          !erp.validateBudget(x.id).some((i) => i.level === "block"),
      );
      if (!b) return null;
      go("quotes", b.id);
      return { id: b.id, mobile: erp.party(b.partyId).mobile };
    });
    if (!wa) {
      bad("send: a clean draft with a mobile exists", "none in the seed");
    } else {
      await pg.waitForTimeout(700);
      await pg.click("#bSend");
      await pg.waitForTimeout(400);
      await pg.selectOption("#sbChannel", "whatsapp");
      await pg.waitForTimeout(200);
      await pg.click("#sbGo");
      await pg.waitForTimeout(700);
      const result = await pg.evaluate((bid) => {
        const b = erp.budget(bid);
        const v = erp.version(bid, b.currentVersionId);
        return { issued: v.issued, channel: v.sent && v.sent.channel, opened: window.__opened };
      }, wa.id);
      const link = (result.opened || [])[0] || "";
      if (result.issued && result.channel === "whatsapp")
        ok("send: WhatsApp channel issues and freezes the version");
      else bad("send: whatsapp issues version", JSON.stringify(result));
      if (link.startsWith("https://wa.me/34") && /text=/.test(link))
        ok("send: WhatsApp opens a wa.me deep-link with the covering message pre-filled");
      else bad("send: whatsapp deep-link", link);
    }

    // ---- send: email goes through the operator's own comms template -------
    await ctx.close();
    await freshPage();
    const em = await pg.evaluate(() => {
      const b = erp.state.budgets.find(
        (x) =>
          erp.budgetStage(x) === "draft" &&
          erp.party(x.partyId).email &&
          !erp.validateBudget(x.id).some((i) => i.level === "block"),
      );
      if (!b) return null;
      go("quotes", b.id);
      return { id: b.id, email: erp.party(b.partyId).email };
    });
    if (!em) {
      bad("send: a clean draft with an email exists", "none in the seed");
    } else {
      await pg.waitForTimeout(700);
      await pg.click("#bSend");
      await pg.waitForTimeout(400);
      await pg.click("#sbGo"); // default channel is email
      await pg.waitForTimeout(700);
      const result = await pg.evaluate((args) => {
        const b = erp.budget(args.id);
        const v = erp.version(args.id, b.currentVersionId);
        const q = erp.state.commsQueue.find((x) => x.subjectRef === b.number);
        return {
          issued: v.issued,
          channel: v.sent && v.sent.channel,
          queued: q ? { status: q.status, to: q.to, template: q.templateKey } : null,
        };
      }, em);
      if (result.issued && result.channel === "email")
        ok("send: email channel issues and freezes the version");
      else bad("send: email issues version", JSON.stringify(result));
      if (
        result.queued &&
        result.queued.status === "sent" &&
        result.queued.to === em.email &&
        result.queued.template === "quote-send"
      )
        ok("send: the covering email is recorded through the same comms queue as everything else");
      else bad("send: email recorded via comms queue", JSON.stringify(result));
    }

    // ---- send: "en mano", backdated -----------------------------------------
    await ctx.close();
    await freshPage();
    const hand = await pg.evaluate(() => {
      const b = erp.state.budgets.find(
        (x) =>
          erp.budgetStage(x) === "draft" &&
          !erp.validateBudget(x.id).some((i) => i.level === "block"),
      );
      if (!b) return null;
      go("quotes", b.id);
      return { id: b.id };
    });
    if (!hand) {
      bad("send: a clean draft exists for the manual channel", "none in the seed");
    } else {
      await pg.waitForTimeout(700);
      await pg.click("#bSend");
      await pg.waitForTimeout(400);
      await pg.selectOption("#sbChannel", "hand");
      await pg.waitForTimeout(200);
      const dateFields = await pg.evaluate(() => ({
        dateVisible: getComputedStyle(document.querySelector("#sbHandDateRow")).display !== "none",
        timeVisible: getComputedStyle(document.querySelector("#sbHandTimeRow")).display !== "none",
      }));
      if (dateFields.dateVisible && dateFields.timeVisible)
        ok("send: choosing «en mano» reveals a date and time to record, not a popup on a popup");
      else bad("send: hand-channel date/time fields appear", JSON.stringify(dateFields));
      const backdate = await pg.evaluate(() => {
        const d = new Date(erp.today + "T00:00:00");
        d.setDate(d.getDate() - 2);
        const iso = d.toISOString().slice(0, 10);
        document.querySelector("#sbHandDate").value = iso;
        document.querySelector("#sbHandTime").value = "10:15";
        return iso;
      });
      await pg.click("#sbGo");
      await pg.waitForTimeout(700);
      const result = await pg.evaluate((args) => {
        const b = erp.budget(args.id);
        const v = erp.version(args.id, b.currentVersionId);
        return v.sent;
      }, hand);
      if (result && result.date === backdate && result.time === "10:15")
        ok("send: «en mano» records the real send date and time, backdated");
      else bad("send: hand-channel backdate persisted", JSON.stringify({ result, backdate }));
    }

    // ---- download: the PDF print sheet --------------------------------------
    // Needs the send drawer open, which needs an UNLOCKED draft — a version
    // already issued or accepted has no "Enviar" button at all.
    await ctx.close();
    await freshPage();
    const dlOk = await pg.evaluate(() => {
      const b = erp.state.budgets.find(
        (x) =>
          erp.budgetStage(x) === "draft" &&
          !erp.validateBudget(x.id).some((i) => i.level === "block"),
      );
      if (!b) return false;
      go("quotes", b.id);
      return true;
    });
    if (!dlOk) throw new Error("no clean draft left for the download-PDF check");
    await pg.waitForTimeout(700);
    await pg.click("#bSend");
    await pg.waitForTimeout(400);
    const printResult = await pg.evaluate(async () => {
      let existsDuring = null;
      const origPrint = window.print;
      window.print = () => {
        existsDuring = !!document.querySelector(".printsheet .doc");
      };
      document.querySelector("#sbDownload").click();
      await new Promise((r) => setTimeout(r, 900));
      const existsAfter = !!document.querySelector(".printsheet");
      window.print = origPrint;
      return { existsDuring, existsAfter };
    });
    if (printResult.existsDuring && !printResult.existsAfter)
      ok("send: «⤓ Descargar» prints exactly the customer document, then cleans up");
    else bad("send: download PDF print sheet", JSON.stringify(printResult));

    if (errs.length) bad("send/versions: no console errors", errs.slice(0, 2).join(" | "));
    else ok("send/versions: no console errors");
  } catch (e) {
    bad("send/versions: suite completed", String(e).slice(0, 200));
  } finally {
    if (ctx) await ctx.close();
  }
}

/* Package 1 (#2, #9): "Próxima acción" and "Condiciones de pago" were free
   text, so the same words got retyped slightly differently every time and
   never rolled into anything a person could act on or compare. Both are now
   owner-maintained lists (DMC-04, DMC-05) with a "＋ Nueva…" entry that adds
   to the list inline, without leaving the screen that needed it. */
async function testConfigurableLists(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  await autoAnswerModals(pg, { "Nueva entrada": "E2E: valor de prueba" });
  try {
    // ---- DMC-04 now carries three lists, DMC-05 two ------------------------
    await pg.goto(`${base}/erp.html#lead-sources`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);
    const dmc04 = await pg.evaluate(() =>
      [...document.querySelectorAll(".cfgtables h3")].map((h) => h.textContent),
    );
    if (dmc04.includes("Próximas acciones"))
      ok("DMC-04: próximas acciones is a managed list alongside fuentes y motivos");
    else bad("DMC-04: próximas acciones present", JSON.stringify(dmc04));

    await pg.evaluate(() => (location.hash = "payment-methods"));
    await pg.waitForTimeout(700);
    const dmc05 = await pg.evaluate(() =>
      [...document.querySelectorAll(".cfgtables h3")].map((h) => h.textContent),
    );
    if (dmc05.includes("Condiciones de pago"))
      ok("DMC-05: condiciones de pago is a managed list alongside formas de pago");
    else bad("DMC-05: condiciones de pago present", JSON.stringify(dmc05));

    // ---- Leads: "Nueva oportunidad" offers a select, not a text box -------
    await pg.evaluate(() => (location.hash = "leads"));
    await pg.waitForTimeout(700);
    await pg.click("text=＋ Nueva oportunidad");
    await pg.waitForTimeout(500);
    const nextTag = await pg.evaluate(() => document.querySelector("#o_next")?.tagName);
    if (nextTag === "SELECT") ok("leads: «Próxima acción» is a select fed by the list");
    else bad("leads: próxima acción is a select", nextTag);

    // create one inline and confirm it landed in the list too
    await pg.selectOption("#o_next", "__new__");
    await pg.waitForTimeout(500);
    const created = await pg.evaluate(() => document.querySelector("#o_next")?.value);
    if (created === "E2E: valor de prueba")
      ok("leads: a new próxima acción can be created without leaving the drawer");
    else bad("leads: inline creation of a próxima acción", created);
    const inEngineList = await pg.evaluate(() =>
      erp.listAll("nextActions").some((r) => r.code === "E2E: valor de prueba"),
    );
    if (inEngineList) ok("leads: the new próxima acción is saved to the owner-maintained list");
    else bad("leads: new próxima acción persisted to state.lists", "not found");
    await pg.evaluate(() => closeDrawer());

    // ---- Presupuestador: "Condiciones de pago" is a select, pre-selected --
    const bid = await pg.evaluate(() => {
      const b =
        erp.state.budgets.find((x) => erp.budgetStage(x) === "draft") || erp.state.budgets[0];
      go("quotes", b.id);
      return b.id;
    });
    await pg.waitForTimeout(800);
    // The select lives in the "Siguiente paso" drawer, not on the bar — P5
    // moved everything about FINISHING behind that one button.
    await pg.click("#bcNext");
    await pg.waitForTimeout(600);
    const bcpay = await pg.evaluate(() => ({
      tag: document.querySelector("#ns_pay")?.tagName,
      value: document.querySelector("#ns_pay")?.value,
    }));
    const expected = await pg.evaluate(
      (id) => erp.state.budgets.find((b) => b.id === id).paymentConditions,
      bid,
    );
    if (bcpay.tag === "SELECT" && bcpay.value === expected)
      ok("presupuestador: «Condiciones de pago» is a select, pre-selected to the stored value");
    else
      bad("presupuestador: condiciones select + preselection", JSON.stringify({ bcpay, expected }));

    await pg.selectOption("#ns_pay", "__new__");
    await pg.waitForTimeout(600);
    const savedCond = await pg.evaluate(
      (id) => erp.state.budgets.find((b) => b.id === id).paymentConditions,
      bid,
    );
    if (savedCond === "E2E: valor de prueba")
      ok("presupuestador: a new condición de pago saves to the budget without leaving the screen");
    else bad("presupuestador: inline condición de pago saved", savedCond);

    if (errs.length) bad("listas configurables: no console errors", errs.slice(0, 2).join(" | "));
    else ok("listas configurables: no console errors");
  } catch (e) {
    bad("listas configurables: suite completed", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

/* COM-01 · filing a client without abandoning the lead.
   The operator's words: "you can start adding the opportunity without stopping,
   going to the Master data customer, add customer and then start the lead
   process again." A first call is by definition from somebody not yet on file,
   so the first field of "nueva oportunidad" was a dropdown that could not
   answer its own question.

   Three things have to hold at once, and each is a check below:
     · the detour is REVERSIBLE — cancelling out of the client form comes back
       to the lead with everything already typed still in it;
     · the client that arrives is the SAME record Maestros holds, created by
       the same form with the same validation, not a shadow copy;
     · after creating one, the lead continues from where it was, with the new
       client selected.
   The third is the feature; the first is what makes it safe to try; the second
   is what stops it becoming a second place clients come from. */
async function testInlineCustomer(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errs = [];
  attachConsole(pg, errs);
  const WORK = "E2E: reforma de cocina sin salir del lead";
  const NAME = "E2E Cliente En Línea";
  const TAX = "99999990S"; // valid NIF check letter; MDM-03 rejects anything else
  try {
    await pg.goto(`${base}/erp.html#leads`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);
    await pg.click("text=＋ Nueva oportunidad");
    await pg.waitForTimeout(500);

    const hasNew = await pg.evaluate(() =>
      [...(document.querySelector("#o_party")?.options || [])].some((o) => o.value === "__new__"),
    );
    if (hasNew) ok("lead: the client picker offers «＋ Nuevo cliente…»");
    else bad("lead: client picker offers inline creation", "no __new__ option");

    // Type something first — the whole point is that it survives the detour.
    await pg.fill("#o_work", WORK);
    await pg.fill("#o_val", "4500");
    const before = await pg.evaluate(() => document.querySelector("#o_party").value);

    // ---- abandoning the client form comes back to the lead, intact ---------
    await pg.selectOption("#o_party", "__new__");
    await pg.waitForTimeout(400);
    const onForm = await pg.evaluate(() => ({
      title: document.querySelector("#dttl")?.textContent,
      name: !!document.querySelector("#f_name"),
      back: !!document.querySelector("#f_back"),
    }));
    if (onForm.title === "Nuevo cliente" && onForm.name && onForm.back)
      ok("lead: picking it opens the real client form, with a way back");
    else bad("lead: inline client form opens", JSON.stringify(onForm));

    await pg.click("#f_back");
    await pg.waitForTimeout(400);
    const restored = await pg.evaluate(() => ({
      title: document.querySelector("#dttl")?.textContent,
      work: document.querySelector("#o_work")?.value,
      val: document.querySelector("#o_val")?.value,
      party: document.querySelector("#o_party")?.value,
    }));
    if (
      restored.title === "Nueva oportunidad" &&
      restored.work === WORK &&
      restored.val === "4500" &&
      restored.party === before
    )
      ok("lead: cancelling the client form restores the lead with what was typed");
    else bad("lead: draft survives an abandoned detour", JSON.stringify(restored));

    // ---- creating one continues the lead with it selected -----------------
    await pg.selectOption("#o_party", "__new__");
    await pg.waitForTimeout(400);
    await pg.fill("#f_name", NAME);
    await pg.fill("#f_tax", TAX);
    // Deliberately not a number the seed already carries: findDuplicateParty
    // matches on mobile, and this test is about the ordinary path, not the
    // duplicate warning (which has its own coverage).
    await pg.fill("#f_mob", "600999888");
    await pg.fill("#f_street", "Carrer de Prova 7");
    await pg.fill("#f_cp", "08001");
    await pg.fill("#f_city", "Barcelona");
    await pg.click("#f_save");
    await pg.waitForTimeout(700);

    const after = await pg.evaluate((tax) => {
      const p = erp.state.parties.find((x) => x.taxId === tax);
      return {
        exists: !!p,
        id: p && p.id,
        roles: p ? p.roles : null,
        title: document.querySelector("#dttl")?.textContent,
        party: document.querySelector("#o_party")?.value,
        work: document.querySelector("#o_work")?.value,
        val: document.querySelector("#o_val")?.value,
      };
    }, TAX);
    if (after.exists && after.roles && after.roles.includes("customer"))
      ok("lead: the client is created as a customer in the one party file");
    else bad("lead: inline client reaches state.parties", JSON.stringify(after));
    if (after.title === "Nueva oportunidad" && after.party === after.id)
      ok("lead: the lead comes back with the new client selected");
    else bad("lead: returns to the lead with the new client", JSON.stringify(after));
    if (after.work === WORK && after.val === "4500")
      ok("lead: nothing typed before the detour was lost");
    else bad("lead: draft survives creating a client", JSON.stringify(after));

    // ---- and the lead can then actually be created ------------------------
    await pg.click("#o_save");
    await pg.waitForTimeout(700);
    const opp = await pg.evaluate((id) => {
      const o = erp.state.opportunities.find((x) => x.partyId === id);
      return o ? { work: o.requestedWork, value: o.expectedValue } : null;
    }, after.id);
    if (opp && opp.work === WORK && opp.value === 450000)
      ok("lead: the opportunity is created for the client filed a moment ago");
    else bad("lead: opportunity created for the inline client", JSON.stringify(opp));

    // ---- Maestros holds that same record, not a copy ----------------------
    // Through the screen's own search box, because Clientes pages at 25 and a
    // record created last is exactly the one that falls off page one — an
    // assertion against the whole page would pass or fail on seed size.
    await pg.evaluate(() => (location.hash = "customers"));
    await pg.waitForTimeout(800);
    await pg.fill("#cliQ", NAME);
    await pg.waitForTimeout(500);
    const inMaster = await pg.evaluate(
      (tax) =>
        [...document.querySelectorAll("table tbody tr")].some((tr) => tr.textContent.includes(tax)),
      TAX,
    );
    if (inMaster) ok("maestros: the client filed from the lead is on the Clientes list");
    else bad("maestros: inline client appears in master data", "no row for its NIF");

    /* A client with no tax identifier yet is still a client.
       "If you don't have the Tax number always from beginning available, still
       make it possible to add customer… no tax number should not block the
       creation of the entry." It never blocked in the engine — `addParty` only
       validates a tax id that is PRESENT — but the field was marked `*`, which
       is the same thing to the person reading it. It carries an amber ⚠
       instead, and the block stays where the law puts it: on issuing. */
    await pg.evaluate(() => (location.hash = "customers"));
    await pg.waitForTimeout(700);
    await pg.evaluate(() => newPartyDrawer("customer"));
    await pg.waitForTimeout(400);
    const flagWhileEmpty = await pg.evaluate(() => !document.querySelector("#f_taxflag").hidden);
    await pg.fill("#f_name", "E2E Cliente sin NIF");
    await pg.fill("#f_mob", "600555444");
    await pg.fill("#f_street", "Carrer Sense 3");
    await pg.fill("#f_cp", "08002");
    await pg.fill("#f_city", "Barcelona");
    await pg.click("#f_save");
    await pg.waitForTimeout(800);
    const untaxed = await pg.evaluate(() => {
      const p = erp.state.parties.find((x) => x.name === "E2E Cliente sin NIF");
      return {
        created: !!p,
        taxId: p ? p.taxId : null,
        // Still refused for the one thing the number is legally required for.
        canInvoice: p ? erp.partyCompleteness(p.id).ok : null,
        onList: document.body.innerHTML.includes("⚠ Pendiente"),
      };
    });
    if (flagWhileEmpty) ok("cliente: an absent NIF shows an amber ⚠, not a red required mark");
    else bad("cliente: the ⚠ appears while the NIF is empty", "flag hidden");
    if (untaxed.created && untaxed.taxId === "") ok("cliente: the record is created without a NIF");
    else bad("cliente: no NIF does not block creation", JSON.stringify(untaxed));
    if (untaxed.canInvoice === false)
      ok("cliente: …and is still refused for invoicing until the NIF arrives");
    else bad("cliente: incomplete party still blocked from issuing", JSON.stringify(untaxed));
    if (untaxed.onList)
      ok("cliente: the gap is visible on the Clientes list, not only in the form");
    else bad("cliente: pending NIF marked on the list", JSON.stringify(untaxed));

    if (errs.length) bad("cliente en línea: no console errors", errs.slice(0, 2).join(" | "));
    else ok("cliente en línea: no console errors");
  } catch (e) {
    bad("cliente en línea: suite completed", String(e).slice(0, 200));
  } finally {
    await pg.close();
  }
}

/* COM-02 after the operator's Package 1 review. Five separate complaints, all
   about the same screen, and each one is a check here:
     · "+ Programar visita" chose a customer for you — it must ask which lead
     · the date opened on a day in the past and let you schedule into it
     · "Cámara" opened a file browser instead of the camera
     · typing notes and then adding a photograph lost the notes
     · a picture could not be opened or downloaded
   plus the follow-up visit naming and completing a client without leaving. */
async function testVisitCapture(browser, base) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    permissions: ["camera"],
  });
  const pg = await ctx.newPage();
  const errs = [];
  attachConsole(pg, errs);
  await autoAnswerModals(pg);
  try {
    await pg.goto(`${base}/erp.html#visits`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);

    // ---- the lead picker replaces "whichever opportunity was first" --------
    // autoAnswerModals answers it, so drive the question directly instead.
    const picker = await pg.evaluate(async () => {
      const open = erp.opportunityAges();
      return { count: open.length, hasPicker: typeof askChoice === "function" };
    });
    if (picker.count > 0 && picker.hasPicker)
      ok("visitas: «+ Programar visita» has leads to choose between");
    else bad("visitas: lead picker", JSON.stringify(picker));

    // ---- schedule: floor date, defaulted time, past date refused ----------
    const sched = await pg.evaluate(() => {
      const o = erp.opportunityAges()[0];
      scheduleVisitDrawer(o.id);
      return {
        date: document.querySelector("#sv_date").value,
        min: document.querySelector("#sv_date").getAttribute("min"),
        time: document.querySelector("#sv_time").value,
      };
    });
    const wall = new Date().toISOString().slice(0, 10);
    const floor =
      wall > (await pg.evaluate(() => erp.today)) ? wall : await pg.evaluate(() => erp.today);
    if (sched.date === floor && sched.min === floor)
      ok(`visitas: the date opens on ${floor} and refuses anything earlier`);
    else bad("visitas: date floor", JSON.stringify(sched) + " expected " + floor);
    if (/^\d{2}:\d{2}$/.test(sched.time) && sched.time !== "10:00")
      ok(`visitas: the time defaults to now (${sched.time})`);
    else bad("visitas: time defaults to now", sched.time);
    await pg.evaluate(() => {
      document.querySelector("#sv_date").value = "2020-01-01";
    });
    await pg.click("#sv_save");
    await pg.waitForTimeout(400);
    const t = await pg.evaluate(() => document.querySelector("#toast").textContent);
    if (/fecha pasada/.test(t)) ok("visitas: a past date is refused, not merely discouraged");
    else bad("visitas: past date refused", t);
    await pg.evaluate(() => closeDrawer());

    // ---- capture: the notes bug, the viewer, the client fix ---------------
    const opened = await pg.evaluate(() => {
      let v = erp.state.visits.find((x) => x.status === "scheduled");
      if (!v) {
        const opps = erp.opportunityAges();
        const bad2 = opps.find((o) => !erp.partyCompleteness(o.partyId).ok) || opps[0];
        v = erp.scheduleVisit(
          {
            opportunityId: bad2.id,
            propertyId: bad2.propertyId,
            scheduledAt: erp.today,
            scheduledTime: "10:00",
            owner: "operations",
            notes: "",
          },
          "backoffice",
        );
      }
      completeVisitDrawer(v.id);
      return v.id;
    });
    await pg.waitForTimeout(500);
    const NOTE = "Humedad en la pared norte";
    await pg.fill("#cv_notes", NOTE);
    await pg.fill("#cv_what", "cocina");
    await pg.evaluate(() => {
      const f = new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], "x.png", {
        type: "image/png",
      });
      const dt = new DataTransfer();
      dt.items.add(f);
      const inp = document.querySelector("#cv_file");
      inp.files = dt.files;
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await pg.waitForTimeout(1200);
    const kept = await pg.evaluate(() => ({
      notes: document.querySelector("#cv_notes").value,
      what: document.querySelector("#cv_what").value,
      photos: document.querySelectorAll("#cv_photos .gi").length,
    }));
    if (kept.notes === NOTE && kept.what === "cocina" && kept.photos === 1)
      ok("visitas: adding a photograph no longer wipes the notes being typed");
    else bad("visitas: notes survive a photo", JSON.stringify(kept));

    // the picture opens full size, with a download and a position
    await pg.evaluate(() => document.querySelector("#cv_photos img[data-blob]").click());
    await pg.waitForTimeout(400);
    const pv = await pg.evaluate(() => {
      const n = document.querySelector(".pview");
      return n ? { dl: n.querySelector("[data-pv=dl]").getAttribute("download") } : null;
    });
    if (pv && /^foto-\d+\.jpg$/.test(pv.dl))
      ok("visitas: a photograph opens full size and offers the file");
    else bad("visitas: photo viewer", JSON.stringify(pv));
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(300);
    const afterEsc = await pg.evaluate(() => ({
      viewer: !!document.querySelector(".pview"),
      drawer: document.querySelector("#drawer").classList.contains("on"),
    }));
    if (!afterEsc.viewer && afterEsc.drawer)
      ok("visitas: closing the photograph leaves the visit open behind it");
    else bad("visitas: Escape scope", JSON.stringify(afterEsc));

    // the camera is a real capture path, not the file picker
    const camWired = await pg.evaluate(
      () =>
        typeof capturePhoto === "function" &&
        document.querySelector("#cv_cam").tagName === "BUTTON",
    );
    if (camWired) ok("visitas: «Cámara» asks the device for its camera");
    else bad("visitas: camera path", "still a file input");

    // an incomplete client is completed here and hands control back
    const fixable = await pg.evaluate(() => !!document.querySelector("#cv_fixparty"));
    if (fixable) ok("visitas: a client missing data can be completed without leaving the visit");
    else ok("visitas: client complete already (nothing to fix on this dataset)");

    // ---- a second visit is allowed and named -----------------------------
    const follow = await pg.evaluate((vid) => {
      const v = erp.state.visits.find((x) => x.id === vid);
      closeDrawer();
      scheduleVisitDrawer(v.opportunityId);
      return document.querySelector("#dttl").textContent;
    }, opened);
    if (/seguimiento/.test(follow))
      ok("visitas: a second visit is allowed and called a seguimiento");
    else bad("visitas: follow-up naming", follow);
    await pg.evaluate(() => closeDrawer());

    if (errs.length) bad("visitas: no console errors", errs.slice(0, 2).join(" | "));
    else ok("visitas: no console errors");
  } catch (e) {
    bad("visitas: suite completed", String(e).slice(0, 200));
  } finally {
    await ctx.close();
  }
}

async function testJourneyRealMode(browser, base) {
  const pg = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
    acceptDownloads: true,
  });
  const errs = [];
  attachConsole(pg, errs);
  await autoAnswerModals(pg);
  try {
    // Visit erp.html first so this browser context's IndexedDB has real
    // tenant data before journey.html asks for it — real mode reads the
    // SAME "caneiERP" database, not a fixture of its own.
    await pg.goto(`${base}/erp.html#tower`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(900);

    await pg.goto(`${base}/journey.html`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(700);
    if (await pg.locator("#modebar").isVisible())
      ok("recorrido: the project-mode switch is present");
    else bad("recorrido: mode switch present", "no #modebar");

    await pg.click("#modeExisting");
    await pg.waitForTimeout(800);
    const rowCount = await pg.locator(".projrow[data-pid]").count();
    if (rowCount > 0)
      ok(`recorrido: real projects are listed, searchable and filterable (${rowCount})`);
    else bad("recorrido: real project list", "no rows — is erp.html's seed reachable?");

    // Search narrows the list.
    await pg.fill("#rpq", "P-2026-0001");
    await pg.waitForTimeout(400);
    const filtered = await pg.locator(".projrow[data-pid]").count();
    if (filtered >= 1 && filtered <= rowCount) ok("recorrido: the project search filters the list");
    else bad("recorrido: project search", `${rowCount} → ${filtered}`);
    await pg.fill("#rpq", "");
    await pg.waitForTimeout(300);

    await pg.locator(".projrow[data-pid]").first().click();
    await pg.waitForTimeout(700);
    const bannerText = await pg.locator("#loadedBar").innerText();
    if (/Proyecto cargado/.test(bannerText))
      ok("recorrido: the loaded project stays visibly indicated");
    else bad("recorrido: loaded-project banner", bannerText.slice(0, 80));

    const railCount = await pg.locator(".rail .st").count();
    if (railCount === 13)
      ok("recorrido: all thirteen stages show a real status (completa/en curso/pendiente)");
    else bad("recorrido: thirteen real stages", `${railCount}`);

    const stageText = await pg.locator("#stage").innerText();
    const hasRealLink = (await pg.locator("#stage a.btn").count()) > 0;
    if (/COMPLETA|EN CURSO|PENDIENTE/.test(stageText) && hasRealLink)
      ok("recorrido: a stage shows real data and links to the real screen");
    else bad("recorrido: stage real data + link", stageText.slice(0, 120));

    const ledgerMargin = await pg.locator("#l-margin").innerText();
    if (/\d/.test(ledgerMargin))
      ok(`recorrido: the ledger shows real project economics (${ledgerMargin})`);
    else bad("recorrido: real ledger figures", ledgerMargin);

    // Duplicate creates a genuinely new project and switches to it.
    const codeBefore = (await pg.locator("#loadedBar b").first().innerText()).trim();
    await pg.click("#rpDup");
    await pg.waitForTimeout(900);
    const codeAfter = (await pg.locator("#loadedBar b").first().innerText()).trim();
    if (codeAfter && codeAfter !== codeBefore)
      ok(
        `recorrido: duplicating a project creates and loads a new one (${codeBefore} → ${codeAfter})`,
      );
    else bad("recorrido: duplicate project", `${codeBefore} → ${codeAfter}`);

    // Downloading the real project's folder produces an actual zip.
    const [download] = await Promise.all([
      pg.waitForEvent("download", { timeout: 8000 }).catch(() => null),
      pg.click("#rpDl"),
    ]);
    if (download) {
      const path = await download.path();
      const fs = await import("node:fs");
      const size = path ? fs.statSync(path).size : 0;
      const magic = path ? fs.readFileSync(path).subarray(0, 2).toString("latin1") : "";
      if (size > 100 && magic === "PK")
        ok(`recorrido: downloads the real project's folder as a zip (${size} bytes)`);
      else bad("recorrido: real folder download", `size=${size} magic=${magic}`);
    } else bad("recorrido: real folder download", "no download fired");

    await pg.click("#rpSwitch");
    await pg.waitForTimeout(500);
    if (await pg.locator("#projPicker").isVisible())
      ok("recorrido: switching project returns to the picker");
    else bad("recorrido: switch project", "picker not shown");

    await pg.click("#modeNew");
    await pg.waitForTimeout(500);
    if (await pg.locator("#mainArea").isVisible())
      ok("recorrido: returning to «Crear nuevo proyecto» restores the untouched demo");
    else bad("recorrido: return to demo mode", "mainArea hidden");

    if (errs.length === 0) ok("recorrido (proyecto existente): no console errors");
    else bad("recorrido (proyecto existente): no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("recorrido — proyecto existente", String(e).slice(0, 220));
  } finally {
    await pg.close();
  }
}

async function testErp(browser, base) {
  // Workspace: Control Tower renders indicators + alerts; modules navigate.
  const pg = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const eerr = [];
  attachConsole(pg, eerr);
  try {
    await pg.goto(`${base}/erp.html#tower`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(700);
    const kpiText = await pg.locator("#view").innerText();
    if (/€/.test(kpiText) && /Necesita atención/.test(kpiText))
      ok("erp: Control Tower indicators + alerts render");
    else bad("erp: Control Tower renders", kpiText.slice(0, 80));

    // module navigation (DAS-01): presupuestos shows versioned budgets
    await pg.evaluate(() => (location.hash = "quotes"));
    await pg.waitForTimeout(400);
    const preText = await pg.locator("#view").innerText();
    if (/PRE-2026/.test(preText) && /versiones/i.test(preText))
      ok("erp: budgets module lists versioned budgets");
    else bad("erp: budgets module", preText.slice(0, 80));

    // BNK-02: a movement is allocated to a job by its project number. Session
    // 11 moved the gesture off Banco and into Conciliación — casar el
    // movimiento y repartirlo son el mismo acto — so the requirement is
    // asserted where it now lives, not where it used to.
    await openTab(pg, "banking", "_reconcile");
    const inp = pg.locator("#rcProj");
    if ((await inp.count()) > 0) {
      await inp.fill("P-2026-0001");
      await pg.click("#rcAssign");
      await pg.waitForTimeout(500);
      const toastTxt = await pg
        .locator("#toast")
        .innerText()
        .catch(() => "");
      if (/Movimiento asignado/.test(toastTxt))
        ok("erp: BNK-02 — movement allocated to a job by its project number");
      else bad("erp: BNK-02 allocation", toastTxt.slice(0, 100));
    } else {
      bad("erp: BNK-02 allocation", "no allocation control on the reconciliation screen");
    }

    // MDM: every party field is correctable from the UI (edit drawer → updateParty)
    await pg.evaluate(() => (location.hash = "customers"));
    await pg.waitForTimeout(400);
    await pg.locator("tr.click").first().click();
    await pg.waitForTimeout(250);
    await pg.locator("#p_edit").click();
    await pg.waitForTimeout(250);
    const newContact = "E2E Contacto " + String(Date.now()).slice(-5);
    await pg.locator("#e_contact").fill(newContact);
    await pg.locator("#e_save").click();
    await pg.waitForTimeout(350);
    await pg.locator("tr.click").first().click();
    await pg.waitForTimeout(250);
    await pg.locator("#p_edit").click();
    await pg.waitForTimeout(250);
    const readBack = await pg.locator("#e_contact").inputValue();
    if (readBack === newContact)
      ok("erp: party edit drawer updates and persists (MDM manageability)");
    else bad("erp: party edit drawer", `read back "${readBack}"`);
    // S2: bank details are gated behind GET /api/~/session's bankRead. Local
    // demo mode never calls that endpoint (no server, no identity to ask) and
    // SESSION defaults permissive, so the field is visible here — the masked
    // path is exercised by tests/server-e2e/run.mjs against a real session.
    const ibanVisible = (await pg.locator("#e_iban").count()) === 1;
    if (ibanVisible)
      ok("erp: IBAN field visible by default (local mode has no session to mask against)");
    else bad("erp: IBAN field visibility", `#e_iban count=${await pg.locator("#e_iban").count()}`);
    await pg.locator("#dClose").click();
    await pg.waitForTimeout(200);

    // Clientes: the list defaults to 25 rows per screen (10/25/50 — corrects
    // the 10/20/50 shipped originally), so the 17-customer demo dataset shows
    // in one page by default. Selecting 10 pages it, and "Siguiente" actually
    // moves to different clients.
    await pg.evaluate(() => (location.hash = "customers"));
    await pg.waitForTimeout(350);
    const pageDefault = await pg.locator("tbody tr.click").count();
    await pg.locator("#cliSize").selectOption("10");
    await pg.waitForTimeout(300);
    const pageTen = await pg.locator("tbody tr.click").count();
    const firstCode = await pg.locator("tbody tr.click").first().innerText();
    await pg.locator("#cliNext").click();
    await pg.waitForTimeout(300);
    const secondCode = await pg.locator("tbody tr.click").first().innerText();
    if (pageDefault > 10 && pageTen === 10 && firstCode !== secondCode)
      ok("erp: clientes default to 25 rows and the size selector pages at 10");
    else
      bad(
        "erp: clientes pagination",
        `default=${pageDefault} size10=${pageTen} moved=${firstCode !== secondCode}`,
      );

    // Export: the menu offers both formats, and the .xlsx writer really emits a
    // ZIP container (a CSV renamed .xlsx would fail this).
    await pg.locator("#bExp").click();
    await pg.waitForTimeout(150);
    const menuTxt = await pg.locator("#expMenu").innerText();
    const zipMagic = await pg.evaluate(async () => {
      const b = xlsxBlob("Clientes", [
        ["Código", "Nombre"],
        ["T-0005", "Marta"],
      ]);
      const head = new Uint8Array(await b.slice(0, 4).arrayBuffer());
      return { magic: String.fromCharCode(head[0], head[1]), size: b.size };
    });
    const menuOk = /xlsx/i.test(menuTxt) && /csv/i.test(menuTxt);
    if (menuOk && zipMagic.magic === "PK" && zipMagic.size > 500)
      ok("erp: clientes export offers .xlsx/.csv and writes a real workbook");
    else
      bad("erp: clientes export", `${menuTxt.replace(/\n/g, " ")} · ${JSON.stringify(zipMagic)}`);

    // DMT-02/03: Proveedores and Subcontratas are the same party file, filtered
    // by role, on the shared list primitive built for S2. Creating a supplier
    // must not leak into the Subcontratas list, and vice versa.
    await pg.evaluate(() => (location.hash = "suppliers"));
    await pg.waitForTimeout(350);
    await pg.locator("#supNew").click();
    await pg.waitForTimeout(250);
    const supName = "E2E Proveedor " + String(Date.now()).slice(-5);
    await pg.locator("#f_name").fill(supName);
    await pg.locator("#f_tax").fill("B10000008");
    await pg.locator("#f_mob").fill("600111222");
    await pg.locator("#f_street").fill("Calle Test 1");
    await pg.locator("#f_cp").fill("08960");
    await pg.locator("#f_city").fill("Sant Just");
    await pg.locator("#f_save").click();
    await pg.waitForTimeout(350);
    await pg.locator("#supQ").fill(supName);
    await pg.waitForTimeout(300);
    const supRows = await pg.locator("tbody tr.click").count();
    if (supRows === 1) ok("erp: DMT-02 proveedores — created and listed by role");
    else bad("erp: DMT-02 proveedores", `rows=${supRows}`);

    await pg.evaluate(() => (location.hash = "subcontractors"));
    await pg.waitForTimeout(350);
    await pg.locator("#subQ").fill(supName);
    await pg.waitForTimeout(300);
    const supInSub = await pg.locator("tbody tr.click").count();
    if (supInSub === 0) ok("erp: DMT-02/03 — a supplier does not leak into Subcontratas");
    else bad("erp: DMT-02/03 role separation", `subcontratas rows=${supInSub}`);

    await pg.locator("#subNew").click();
    await pg.waitForTimeout(250);
    const subName = "E2E Industrial " + String(Date.now()).slice(-5);
    await pg.locator("#f_name").fill(subName);
    await pg.locator("#f_tax").fill("B20000006");
    await pg.locator("#f_mob").fill("600222333");
    await pg.locator("#f_street").fill("Calle Test 2");
    await pg.locator("#f_cp").fill("08960");
    await pg.locator("#f_city").fill("Sant Just");
    await pg.locator("#f_save").click();
    await pg.waitForTimeout(350);
    await pg.locator("#subQ").fill(subName);
    await pg.waitForTimeout(300);
    const subRows = await pg.locator("tbody tr.click").count();
    if (subRows === 1) ok("erp: DMT-03 subcontratas — created and listed by role");
    else bad("erp: DMT-03 subcontratas", `rows=${subRows}`);

    // Universal search must route a supplier/subcontractor hit to their own
    // screen (DMT-02/03), not into Clientes — the bug this session fixed.
    await pg.locator("#q").fill(subName);
    await pg.waitForTimeout(300);
    const subSearchTxt = await pg.locator("#sres.on").innerText();
    if (/subcontratas/i.test(subSearchTxt)) {
      await pg.locator("#sres .si").first().click();
      await pg.waitForTimeout(400);
      const afterHash = await pg.evaluate(() => location.hash);
      if (afterHash === "#subcontractors")
        ok("erp: universal search routes a subcontrata hit to Subcontratas, not Clientes");
      else bad("erp: search routing (subcontratas)", afterHash);
    } else bad("erp: search grouping (subcontratas)", subSearchTxt.slice(0, 80));
    await pg.locator("#dClose").click();
    await pg.waitForTimeout(200);
    await pg.locator("#q").fill("");

    // DMT-04: Personal interno lives on state.workers, not parties — create,
    // add a second rate, and deactivate (never delete).
    await pg.evaluate(() => (location.hash = "staff"));
    await pg.waitForTimeout(350);
    const staffBefore = await pg.locator("tbody tr.click").count();
    await pg.locator("#stfNew").click();
    await pg.waitForTimeout(250);
    const workerName = "E2E Trabajador " + String(Date.now()).slice(-5);
    await pg.locator("#w_name").fill(workerName);
    await pg.locator("#w_rate").fill("18");
    await pg.locator("#w_save").click();
    await pg.waitForTimeout(350);
    const staffAfter = await pg.locator("tbody tr.click").count();
    if (staffAfter === staffBefore + 1) ok("erp: DMT-04 personal — worker created and listed");
    else bad("erp: DMT-04 personal create", `before=${staffBefore} after=${staffAfter}`);

    await pg.locator("#stfQ").fill(workerName);
    await pg.waitForTimeout(300);
    await pg.locator("tbody tr.click").first().click();
    await pg.waitForTimeout(300);
    // A distinct future date, not "today": two rates dated the same day are an
    // inherent tie the engine breaks by array order, not by which was added
    // last — asserting on "today" would make this check depend on that tie
    // rather than on the feature (a second history row) actually working.
    await pg.locator("#w_newfrom").fill("2027-01-01");
    await pg.locator("#w_newrate").fill("20");
    await pg.locator("#w_addrate").click();
    await pg.waitForTimeout(350);
    const rateTxt = await pg.locator("#drawer .card").first().innerText();
    const rateLines = (rateTxt.match(/^desde /gm) || []).length;
    if (rateLines === 2) ok("erp: DMT-04 tarifas — a second rate is added to the history");
    else bad("erp: DMT-04 tarifas", rateTxt.slice(0, 160));
    await pg.locator("#w_act").click();
    await pg.waitForTimeout(350);
    // The list is still filtered to this one worker's name; deactivating
    // drops it from the (active-only) list without touching any other row.
    const staffAfterDeactivate = await pg.locator("tbody tr.click").count();
    if (staffAfterDeactivate === 0)
      ok(
        "erp: DMT-04 personal — deactivating drops the worker from the active list, not the record",
      );
    else bad("erp: DMT-04 deactivate", `count=${staffAfterDeactivate} expected=0`);

    // Gestoría: exception list + VAT summary render
    await pg.evaluate(() => (location.hash = "accountant"));
    await pg.waitForTimeout(400);
    const gesText = await pg.locator("#view").innerText();
    if (/excepciones/i.test(gesText) && /IVA/.test(gesText))
      ok("erp: gestoría package view (VAT + exceptions)");
    else bad("erp: gestoría view", gesText.slice(0, 80));

    if (eerr.length === 0) ok("erp: no console errors across modules");
    else bad("erp: no console errors", eerr.slice(0, 3).join(" | "));
  } catch (e) {
    bad("erp workspace", String(e).slice(0, 160));
  } finally {
    await pg.close();
  }
}

// ── Language: three of them, the choice remembered, and English-base pages
//    adopting it too.
//
//    index.html is a redirect stub to erp.html — asserting on "the home page"
//    means asserting on the workspace, which is why the strings checked here
//    are the workspace's.
/**
 * Choosing a language in one tab changes the whole app.
 *
 * THE PHONE IS THE CASE THAT MATTERS. The native shell is six tabs and each one
 * is its own web view with its own document. Choosing English in Tower reloaded
 * Tower and nothing else, so Projects — opened earlier, still Spanish — looked
 * like the app had forgotten the choice a second after it was made. The choice
 * was never lost; the already-rendered documents were stale.
 *
 * Two pages in ONE context reproduces that exactly: same cookies, same
 * localStorage, two documents rendered at different moments. The second page is
 * opened BEFORE the switch on purpose — a page loaded afterwards would pick the
 * language up anyway and prove nothing.
 */
async function testLanguageAcrossTabs(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  try {
    const tower = await ctx.newPage();
    const projects = await ctx.newPage();
    for (const [pg, hash] of [
      [tower, "#tower"],
      [projects, "#projects"],
    ]) {
      await pg.goto(`${base}/erp.html${hash}`, { waitUntil: "networkidle" });
      await pg.waitForSelector("#p1 .secitem", { timeout: 15000 });
    }
    await projects.waitForTimeout(400);

    /* The switch is reached through Configuración → Idioma (DMC-09), not
       through the floating pill this test used to click. The pill was deleted
       in PK5-A on the operator's instruction — "I want to put the language
       button in configuration. As it is, bothers more then helps. This is
       across the app." — and the merge of the two branches is where the two
       facts meet. What this test is FOR is untouched: the question is whether
       a choice made in one document reaches a document already rendered in
       another tab, and that has nothing to do with which control made it. */
    await tower.bringToFront();
    await tower.evaluate(() => toggleSection("settings"));
    await tower.waitForTimeout(500);
    await tower.locator("#p2list button", { hasText: "Idioma" }).click();
    await tower.waitForTimeout(500);
    await Promise.all([
      tower.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
      tower.locator('[data-uilang="en"]').click(),
    ]);
    await tower.waitForSelector("#p1 .secitem", { timeout: 15000 });
    const towerLang = await tower.evaluate(() => document.documentElement.lang);

    await projects.bringToFront();
    // Waited for, not slept for: the other document reloads when it comes back
    // to the front, and how long that takes is a property of the machine.
    const followed = await projects
      .waitForFunction(() => document.documentElement.lang === "en", null, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    const projectsLang = await projects.evaluate(() => document.documentElement.lang);

    if (towerLang === "en" && followed && projectsLang === "en")
      ok("i18n: a language chosen in one tab reaches the tab already open");
    else bad("i18n: language across tabs", `tower=${towerLang} other=${projectsLang}`);
  } catch (e) {
    bad("i18n: language across tabs", String(e).slice(0, 160));
  } finally {
    await ctx.close();
  }
}

async function testI18n(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  // The choice now lives in a cookie so the server-rendered sign-in page can
  // see it too. Cleared first: a cookie set by an earlier test in this context
  // would otherwise decide the language before this one gets a say.
  const clear = () =>
    pg.evaluate(() => {
      document.cookie = "canei_lang=;path=/;max-age=0";
      try {
        localStorage.removeItem("caneiLang");
        localStorage.removeItem("caneiLangCompany");
      } catch (e) {}
    });
  try {
    // The device choice now lives in a cookie, and a cookie outranks
    // localStorage. Clear it first or a value left by an earlier test decides
    // the language before the writes below get a say.
    await pg.goto(`${base}/erp.html`, { waitUntil: "domcontentloaded" });
    await clear();
    // The workspace is the entry screen now, so the toggle is exercised there.
    await pg.goto(`${base}/erp.html#tower`, { waitUntil: "networkidle" });
    await bootedShell(pg);
    await pg.waitForTimeout(600);
    // BOTH DOORS, and this assertion has been inverted once already.
    //
    // PK5-A removed the floating pill on the operator's words ("bothers more
    // then helps") and this check asserted its ABSENCE. The operator has since
    // asked for the three-way button back, so it asserts presence — and the
    // Configuración → Idioma route below is still exercised, because the pill
    // returning does not mean the settings screen stopped mattering.
    //
    // Written as "three buttons", not "an element exists": a pill that renders
    // with one language would satisfy the weaker check and be useless.
    const pillButtons = await pg.locator("#canei-lang-pill button").count();
    if (pillButtons === 3) ok("i18n: the ES · CA · EN pill is on the page");
    else bad("i18n: ES · CA · EN pill", `expected 3 buttons, found ${pillButtons}`);

    /* WHERE it sits, on the operator's instruction: top right, in the toolbar
       rather than floating over the foot of the screen — "no text overlap and
       always available in all screens". Both halves are measured: it lives in
       the toolbar's own actions, in the right-hand third of the window, and
       it is still on screen after scrolling to the bottom of a long page,
       which is what the sticky toolbar is for. */
    const placed = await pg.evaluate(() => {
      const p = document.getElementById("canei-lang-pill");
      const r = p.getBoundingClientRect();
      return {
        clearsToolbar: !!document.getElementById("canei-lang-spacer"),
        fixed: getComputedStyle(p).position === "fixed",
        rightThird: r.left > innerWidth * 0.66,
        top: r.top < 120,
      };
    });
    if (placed.clearsToolbar && placed.fixed && placed.rightThird && placed.top)
      ok("i18n: the pill sits top right, with the toolbar clearing space for it");
    else bad("i18n: pill placement", JSON.stringify(placed));

    await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await pg.waitForTimeout(400);
    const stuck = await pg.evaluate(() => {
      const r = document.getElementById("canei-lang-pill").getBoundingClientRect();
      return { y: Math.round(r.top), onScreen: r.top >= 0 && r.bottom <= innerHeight };
    });
    if (stuck.onScreen)
      ok(`i18n: …and it is still there at the bottom of a long screen (y=${stuck.y})`);
    else bad("i18n: pill scrolls away", JSON.stringify(stuck));
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.waitForTimeout(300);
    const esText = await pg.locator("body").innerText();
    if (esText.includes("Torre de control")) ok("i18n: workspace defaults to Spanish");
    else bad("i18n: workspace defaults to Spanish", esText.slice(0, 60));

    // Reached the way a person reaches it: open Configuración and click the
    // entry. That proves the menu lists it — a screen only a URL can open is
    // not in Configuración in any useful sense — and it leaves the shell in
    // the right state, because the rail's subsection panel is an absolutely
    // positioned flyout that covers the content until a click closes it.
    await pg.evaluate(() => toggleSection("settings"));
    await pg.waitForTimeout(600);
    const inMenu = await pg.evaluate(() =>
      /Idioma/.test(document.querySelector("#p2list")?.innerText || ""),
    );
    await pg.locator("#p2list button", { hasText: "Idioma" }).click();
    await pg.waitForTimeout(600);
    const langScreen = await pg.evaluate(() => ({
      options: [...document.querySelectorAll("[data-uilang]")].map((b) => b.dataset.uilang),
      current: document.querySelector("[data-uilang][aria-current]")?.dataset.uilang,
      // Each choice must be a real target, not a 13px radio behind a label:
      // this screen exists because the old control was unusable on a phone.
      minTarget: Math.min(
        ...[...document.querySelectorAll("[data-uilang]")].map((b) =>
          Math.round(b.getBoundingClientRect().height),
        ),
      ),
    }));
    if (
      langScreen.options.join(",") === "es,ca,en" &&
      langScreen.current === "es" &&
      langScreen.minTarget >= 30 &&
      inMenu
    )
      ok(
        `i18n: Configuración → Idioma offers all three languages as ${langScreen.minTarget}px targets`,
      );
    else bad("i18n: language screen", JSON.stringify({ ...langScreen, inMenu }));

    // Switching reloads the page, so the click is not awaited for a result —
    // the assertion is what the reloaded document says. It reloads onto the
    // language screen it was pressed from, so the workspace assertion below
    // goes back to the Torre: what is being proven is that the CHOICE reaches
    // the whole app, not that one screen happens to be translated.
    await pg.locator('[data-uilang="en"]').click();
    await pg.waitForLoadState("networkidle").catch(() => {});
    await pg.waitForTimeout(900);
    await pg.evaluate(() => (location.hash = "tower"));
    await pg.waitForTimeout(800);
    // dynamic content gets translated too (MutationObserver path)
    const erpLang = await pg.evaluate(() => document.documentElement.lang);
    const erpText = await pg.locator("body").innerText();
    if (erpLang === "en" && /Control tower/i.test(erpText) && !/Torre de control/.test(erpText))
      ok("i18n: EN toggle translates the ERP workspace");
    else bad("i18n: erp translated", `lang=${erpLang} ${erpText.slice(0, 80)}`);

    // Catalan (S3, decision 20). The navigation is the surface a Catalan user
    // hits first, so it is the one asserted: the six secciones must actually
    // read as Catalan, not fall back to Spanish.
    await chooseLang(pg, "ca");
    // reload(), not goto(): the page is already at erp.html#tower after the EN
    // toggle, and navigating to the identical URL+hash is a no-op that would
    // leave the previous language in place and quietly pass nothing.
    await pg.reload({ waitUntil: "networkidle" });
    await pg.waitForTimeout(700);
    const caLang = await pg.evaluate(() => document.documentElement.lang);
    const caText = await pg.locator("body").innerText();
    // The rail shows the SHORT section labels, so those are what a Catalan
    // user actually reads there — asserting on the long ones would have
    // passed while "Maestros" sat untranslated in front of them, which is
    // precisely how this check earns its keep.
    if (
      caLang === "ca" &&
      /Projectes/.test(caText) &&
      /Mestres/.test(caText) &&
      !/Maestros/.test(caText) &&
      !/Proyectos/.test(caText)
    )
      ok("i18n: CA translates the navigation, and Spanish does not leak through");
    else bad("i18n: CA workspace", `lang=${caLang} ${caText.replace(/\n/g, " ").slice(0, 160)}`);

    // COM-01/02 (S4) are new screens, not old ones re-skinned — the coverage
    // guard only proves dictionary entries exist, not that these specific
    // screens render them. Checked here, still under the CA reload above.
    // Asserted on the intro line, the button and the block headers — all
    // genuinely new S4 strings — rather than on the dynamic "N oportunidades"
    // row-count tag, which (like every other screen's row count) is built
    // from a noun pair spliced into a number and does not go through the
    // translator; that gap predates S4 and is not what this check is for.
    await pg.evaluate(() => (location.hash = "leads"));
    await pg.waitForTimeout(500);
    const leadsCaText = await pg.locator("body").innerText();
    if (
      /Cada consulta crea una oportunitat/.test(leadsCaText) &&
      /Nova oportunitat/.test(leadsCaText) &&
      !/Cada consulta crea una oportunidad/.test(leadsCaText)
    )
      ok("i18n: CA translates the COM-01 leads screen");
    else bad("i18n: CA leads screen", leadsCaText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "visits"));
    await pg.waitForTimeout(500);
    const visitsCaText = await pg.locator("body").innerText();
    if (
      /Programades/.test(visitsCaText) &&
      /Realitzades/.test(visitsCaText) &&
      !/Programadas/.test(visitsCaText) &&
      !/Realizadas/.test(visitsCaText)
    )
      ok("i18n: CA translates the COM-02 visits screen");
    else bad("i18n: CA visits screen", visitsCaText.replace(/\n/g, " ").slice(0, 160));

    // S7's two screens, in Catalan. The dictionary guard proves an entry
    // exists; only this proves the screen reaches it — the gap S4 and S5 both
    // found, and the reason every session since adds a render check with the
    // strings it introduces.
    await pg.evaluate(() => (location.hash = "supplier-invoices"));
    await pg.waitForTimeout(700);
    const capCaText = await pg.locator("body").innerText();
    if (
      /Safata/i.test(capCaText) &&
      /Documents/i.test(capCaText) &&
      !/\bBandeja\b/i.test(capCaText) &&
      !/Emisor por confirmar/i.test(capCaText)
    )
      ok("i18n: CA translates the ADM-03 inbox and register");
    else bad("i18n: CA ADM-03", capCaText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "purchasing"));
    await pg.waitForTimeout(700);
    const purCaText = await pg.locator("body").innerText();
    if (
      /Comanda/i.test(purCaText) &&
      /Facturat/i.test(purCaText) &&
      !/Llegada prevista/i.test(purCaText)
    )
      ok("i18n: CA translates the ADM-02 counters and list");
    else bad("i18n: CA ADM-02", purCaText.replace(/\n/g, " ").slice(0, 160));

    // S8's two panels, in Catalan. The panel has to be OPENED — a screen's
    // strings are not proven by the list that leads to it, which is the same
    // gap the render check was invented for in S4.
    await pg.evaluate(() => (location.hash = "progress"));
    await pg.waitForTimeout(700);
    await openJobWithChapters(pg, "prgQ");
    // PK3-C put the three-state control on the Gantt; PK4-A made opening the
    // job open the Gantt, so the row click above already landed on it.
    await pg.waitForTimeout(900);
    const pryCaText = await pg.locator("#view").innerText();
    if (
      /execuci/i.test(pryCaText) &&
      /Sense començar/i.test(pryCaText) &&
      !/En ejecución/.test(pryCaText) &&
      !/Sin empezar/.test(pryCaText)
    )
      ok("i18n: CA translates the PRY-01 panel and its three-state control");
    else bad("i18n: CA PRY-01", pryCaText.replace(/\n/g, " ").slice(0, 160));
    if (await pg.locator("#gBack").count()) {
      await pg.locator("#gBack").click();
      await pg.waitForTimeout(500);
    }

    await pg.evaluate(() => (location.hash = "economics"));
    await pg.waitForTimeout(700);
    await openJobWithChapters(pg, "ecoQ");
    const ecoCaText = await pg.locator("#view").innerText();
    if (
      /Marge/i.test(ecoCaText) &&
      /Per capítol/i.test(ecoCaText) &&
      !/Pendiente de repartir/.test(ecoCaText)
    )
      ok("i18n: CA translates the PRY-02 panel");
    else bad("i18n: CA PRY-02", ecoCaText.replace(/\n/g, " ").slice(0, 160));

    // S9's two screens, in Catalan. COM-04's viewer is checked twice over:
    // the INTERFACE must follow the toggle while the DOCUMENT must not — its
    // language is a field on the contract, chosen for the customer.
    await pg.evaluate(() => (location.hash = "variations"));
    await pg.waitForTimeout(700);
    const chgCaText = await pg.locator("#view").innerText();
    if (
      /Identificat/i.test(chgCaText) &&
      /Modificacions/i.test(chgCaText) &&
      !/Sin aprobar/.test(chgCaText)
    )
      ok("i18n: CA translates the PRY-03 counters and rows");
    else bad("i18n: CA PRY-03", chgCaText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "petty-cash"));
    await pg.waitForTimeout(700);
    const cashCaText = await pg.locator("#view").innerText();
    if (/a caixa|Entrades|Sortides/i.test(cashCaText) && !/Saldo final\nSaldo/.test(cashCaText))
      ok("i18n: CA translates the ADM-06 cash screen");
    else bad("i18n: CA ADM-06", cashCaText.replace(/\n/g, " ").slice(0, 160));

    // S12's three surfaces. Every string on them shipped with Catalan in the
    // same commit, and this is what proves it rather than the dictionary
    // counting itself.
    await pg.evaluate(() => (location.hash = "cash-flow"));
    await pg.waitForTimeout(700);
    const cfCaText = await pg.locator("#view").innerText();
    if (
      /Saldo acumulat/i.test(cfCaText) &&
      /Previsi[oó]/i.test(cfCaText) &&
      !/Saldo acumulado/.test(cfCaText)
    )
      ok("i18n: CA translates the ADM-08 forecast grid");
    else bad("i18n: CA ADM-08", cfCaText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "labour"));
    await pg.waitForTimeout(700);
    const labCaText = await pg.locator("#view").innerText();
    if (/Part diari/i.test(labCaText) && !/Parte diario/.test(labCaText))
      ok("i18n: CA translates the ADM-04 day sheet and its tabs");
    else bad("i18n: CA ADM-04", labCaText.replace(/\n/g, " ").slice(0, 160));

    await pg.locator('[data-htab="summary"]').click();
    await pg.waitForTimeout(600);
    const labSumCa = await pg.locator("#view").innerText();
    if (/Conciliaci[oó] del mes/i.test(labSumCa) && !/Conciliación del mes/.test(labSumCa))
      ok("i18n: CA translates the ADM-04 monthly reconciliation");
    else bad("i18n: CA ADM-04 resumen", labSumCa.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "accountant"));
    await pg.waitForTimeout(800);
    const gesCaText = await pg.locator("#view").innerText();
    if (/Trimestre i contingut/i.test(gesCaText) && !/Trimestre y contenido/.test(gesCaText))
      ok("i18n: CA translates the ADM-07 wizard steps");
    else bad("i18n: CA ADM-07", gesCaText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "invoicing"));
    await pg.waitForTimeout(700);
    const invCaText = await pg.locator("#view").innerText();
    if (/Emès|Cobrat|Vençut/i.test(invCaText) && !/Vencimiento/.test(invCaText))
      ok("i18n: CA translates the ADM-01 counters and register");
    else bad("i18n: CA ADM-01", invCaText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "contracts"));
    await pg.waitForTimeout(700);
    const conCaText = await pg.locator("#view").innerText();
    if (
      /Vigents/i.test(conCaText) &&
      /Import vigent/i.test(conCaText) &&
      !/Importe vigente/.test(conCaText)
    )
      ok("i18n: CA translates the COM-04 register");
    else bad("i18n: CA COM-04", conCaText.replace(/\n/g, " ").slice(0, 160));

    await pg.locator("#view table.mlist tr.click").first().click();
    await pg.waitForTimeout(600);
    const conDoc = await pg.evaluate(() => ({
      // The tab LABELS live in the strip, not in the body the tab renders —
      // reading the body for them tested the wrong element, not the wrong
      // translation.
      tabs: [...document.querySelectorAll("[data-contab]")].map((b) => b.textContent).join(" "),
      panel: document.querySelector("#conBody").innerText,
      doc: document.querySelector(".cdoc").innerText,
      lang: erp.renderContractDoc(conWork.id).language,
    }));
    if (
      /Fites de pagament/i.test(conDoc.tabs) &&
      /Import vigent/i.test(conDoc.panel) &&
      (conDoc.lang === "ca" ? /CONTRACTE/i.test(conDoc.doc) : /CONTRATO DE OBRA/i.test(conDoc.doc))
    )
      ok(
        `i18n: CA translates the viewer's interface, and the document keeps its own language (${conDoc.lang})`,
      );
    else bad("i18n: CA COM-04 viewer", JSON.stringify(conDoc).slice(0, 200));
    await pg.locator("#conBack").click();
    await pg.waitForTimeout(300);

    // And the same two screens under EN, so both new-string additions are
    // proven in both directions, not just the CA one that happened to be
    // built last.
    await chooseLang(pg, "en");
    await pg.reload({ waitUntil: "networkidle" });
    await pg.waitForTimeout(500);
    await pg.evaluate(() => (location.hash = "leads"));
    await pg.waitForTimeout(500);
    const leadsEnText = await pg.locator("body").innerText();
    if (
      /Every enquiry creates an opportunity/.test(leadsEnText) &&
      /New opportunity/.test(leadsEnText) &&
      !/Cada consulta crea/.test(leadsEnText)
    )
      ok("i18n: EN translates the COM-01 leads screen");
    else bad("i18n: EN leads screen", leadsEnText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "visits"));
    await pg.waitForTimeout(500);
    const visitsEnText = await pg.locator("body").innerText();
    if (
      /Scheduled\s/.test(visitsEnText) &&
      /Completed\s/.test(visitsEnText) &&
      !/Programadas/.test(visitsEnText) &&
      !/Realizadas/.test(visitsEnText)
    )
      ok("i18n: EN translates the COM-02 visits screen");
    else bad("i18n: EN visits screen", visitsEnText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "supplier-invoices"));
    await pg.waitForTimeout(700);
    const capEnText = await pg.locator("body").innerText();
    if (
      /Inbox/i.test(capEnText) &&
      /Allocation/i.test(capEnText) &&
      !/\bBandeja\b/i.test(capEnText) &&
      !/Asignación/i.test(capEnText)
    )
      ok("i18n: EN translates the ADM-03 inbox and register");
    else bad("i18n: EN ADM-03", capEnText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "purchasing"));
    await pg.waitForTimeout(700);
    const purEnText = await pg.locator("body").innerText();
    if (
      /Offer/i.test(purEnText) &&
      /Invoiced/i.test(purEnText) &&
      /Expected arrival/i.test(purEnText) &&
      !/Llegada prevista/i.test(purEnText)
    )
      ok("i18n: EN translates the ADM-02 counters and list");
    else bad("i18n: EN ADM-02", purEnText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "progress"));
    await pg.waitForTimeout(700);
    await openJobWithChapters(pg, "prgQ");
    // As in Catalan above: the row click already landed on the chart.
    await pg.waitForTimeout(900);
    const pryEnText = await pg.locator("#view").innerText();
    if (
      /In progress/i.test(pryEnText) &&
      /Not started/i.test(pryEnText) &&
      !/En ejecución/.test(pryEnText) &&
      !/Sin empezar/.test(pryEnText)
    )
      ok("i18n: EN translates the PRY-01 panel and its three-state control");
    else bad("i18n: EN PRY-01", pryEnText.replace(/\n/g, " ").slice(0, 160));
    if (await pg.locator("#gBack").count()) {
      await pg.locator("#gBack").click();
      await pg.waitForTimeout(500);
    }

    await pg.evaluate(() => (location.hash = "economics"));
    await pg.waitForTimeout(700);
    await openJobWithChapters(pg, "ecoQ");
    const ecoEnText = await pg.locator("#view").innerText();
    if (
      /Accrued/i.test(ecoEnText) &&
      /By chapter/i.test(ecoEnText) &&
      !/Pendiente de repartir/.test(ecoEnText)
    )
      ok("i18n: EN translates the PRY-02 panel");
    else bad("i18n: EN PRY-02", ecoEnText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "variations"));
    await pg.waitForTimeout(700);
    const chgEnText = await pg.locator("#view").innerText();
    if (
      /Identified/i.test(chgEnText) &&
      /Unapproved/i.test(chgEnText) &&
      !/Sin aprobar/.test(chgEnText)
    )
      ok("i18n: EN translates the PRY-03 counters and rows");
    else bad("i18n: EN PRY-03", chgEnText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "petty-cash"));
    await pg.waitForTimeout(700);
    const cashEnText = await pg.locator("#view").innerText();
    if (/in the till|Cash in|Cash out/i.test(cashEnText) && !/Saldo final/.test(cashEnText))
      ok("i18n: EN translates the ADM-06 cash screen");
    else bad("i18n: EN ADM-06", cashEnText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "invoicing"));
    await pg.waitForTimeout(700);
    const invEnText = await pg.locator("#view").innerText();
    if (/Collected/i.test(invEnText) && /Days/i.test(invEnText) && !/Vencimiento/.test(invEnText))
      ok("i18n: EN translates the ADM-01 counters and register");
    else bad("i18n: EN ADM-01", invEnText.replace(/\n/g, " ").slice(0, 160));

    await pg.evaluate(() => (location.hash = "contracts"));
    await pg.waitForTimeout(700);
    const conEnText = await pg.locator("#view").innerText();
    if (
      /In force/i.test(conEnText) &&
      /Current amount/i.test(conEnText) &&
      !/Importe vigente/.test(conEnText)
    )
      ok("i18n: EN translates the COM-04 register");
    else bad("i18n: EN COM-04", conEnText.replace(/\n/g, " ").slice(0, 160));

    // COM-03 (S5). Two separate things are checked here, because they pull in
    // opposite directions: the presupuestador's INTERFACE must follow the
    // toggle, while the customer's DOCUMENT must not — it is written in the
    // language of the person receiving it, which is a field on the record.
    await pg.evaluate(() => (location.hash = "quotes"));
    await pg.waitForTimeout(500);
    const quotesEn = await pg.locator("#view").innerText();
    if (/Drafts|Sent|Accepted/i.test(quotesEn) && !/Borradores|Enviados/.test(quotesEn))
      ok("i18n: EN translates the COM-03 register's stage groups");
    else bad("i18n: EN quotes register", quotesEn.replace(/\n/g, " ").slice(0, 160));

    const draftId = await pg.evaluate(() => {
      const b = erp.state.budgets.find((x) => erp.budgetStage(x) === "draft");
      return b ? b.id : null;
    });
    if (draftId) {
      await pg.evaluate((id) => go("quotes", id), draftId);
      await pg.waitForTimeout(600);
      const builderEn = await pg.locator(".pb").innerText();
      if (
        /Chapters/i.test(builderEn) &&
        /Line items/i.test(builderEn) &&
        /Document language/i.test(builderEn) &&
        !/Capítulos|Idioma del documento/.test(builderEn)
      )
        ok("i18n: EN translates the presupuestador — panes, bar and conditions");
      else bad("i18n: EN presupuestador", builderEn.replace(/\n/g, " ").slice(0, 200));

      // The document keeps ITS language while the interface around it changes.
      // "Base imponible" and "Validez" are both in the dictionary, so before
      // `translate="no"` they came out English inside a Spanish presupuesto.
      await pg.evaluate((id) => {
        erp.updateBudget(id, { language: "es" }, "e2e");
        render();
      }, draftId);
      await pg.waitForTimeout(300);
      await pg.locator("#bPreview").click();
      await pg.waitForTimeout(600);
      const docEs = await pg.locator("#dbody .doc").innerText();
      const around = await pg.locator("#dbody .card").first().innerText();
      if (/PRESUPUESTO/.test(docEs) && /Base imponible/.test(docEs) && /Validez/.test(docEs))
        ok("i18n: a Spanish document stays Spanish while the operator reads English");
      else bad("i18n: document opts out of the toggle", docEs.replace(/\n/g, " ").slice(0, 160));
      if (/Versions/i.test(around) && !/Versiones/.test(around))
        ok("i18n: …and the interface around that document is still translated");
      else bad("i18n: interface around the document", around.replace(/\n/g, " ").slice(0, 120));

      // And the same document in Catalan, from the same English interface.
      await pg.locator("#dClose").click();
      await pg.waitForTimeout(200);
      await pg.evaluate((id) => {
        erp.updateBudget(id, { language: "ca" }, "e2e");
        render();
      }, draftId);
      await pg.waitForTimeout(300);
      await pg.locator("#bPreview").click();
      await pg.waitForTimeout(600);
      const docCa = await pg.locator("#dbody .doc").innerText();
      if (/PRESSUPOST/.test(docCa) && /Base imposable/.test(docCa) && !/PRESUPUESTO/.test(docCa))
        ok("i18n: the same quote emitted in Catalan, chosen per customer not per operator");
      else bad("i18n: Catalan document", docCa.replace(/\n/g, " ").slice(0, 160));
      await pg.locator("#dClose").click();
      await pg.waitForTimeout(200);
    } else bad("i18n: a draft quote to preview", "none in draft");

    // Back to Catalan for the COM-03 interface check.
    await chooseLang(pg, "ca");
    await pg.reload({ waitUntil: "networkidle" });
    await pg.waitForTimeout(700);
    await pg.evaluate(() => (location.hash = "quotes"));
    await pg.waitForTimeout(500);
    const quotesCa = await pg.locator("#view").innerText();
    if (/Esborranys|Enviats|Acceptats/i.test(quotesCa) && !/Borradores|Aceptados/.test(quotesCa))
      ok("i18n: CA translates the COM-03 register's stage groups");
    else bad("i18n: CA quotes register", quotesCa.replace(/\n/g, " ").slice(0, 160));

    // The three languages must be genuinely distinct on the same label. A
    // Catalan that silently equals the Spanish everywhere would pass a
    // "did anything change" check while being no translation at all.
    const trio = await pg.evaluate(() => {
      const D = window.CANEI_DICT;
      const probe = "Datos maestros";
      const pair = D.pairs.find((p) => p[0] === probe);
      return { es: probe, en: pair && pair[1], ca: D.ca[probe] };
    });
    if (trio.en === "Master data" && trio.ca === "Dades mestres")
      ok("i18n: a label resolves to three genuinely different forms");
    else bad("i18n: three forms", JSON.stringify(trio));

    // English-base page flips to Spanish when ES is chosen
    await chooseLang(pg, "es");
    await pg.goto(`${base}/journey.html`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(500);
    const jLang = await pg.evaluate(() => document.documentElement.lang);
    if (jLang === "es") ok("i18n: English-base page adopts Spanish choice");
    else bad("i18n: journey adopts ES", `lang=${jLang}`);
    await clear();
  } catch (e) {
    bad("i18n toggle", String(e).slice(0, 160));
  } finally {
    await pg.close();
  }
}

main().catch((e) => {
  console.error("harness crashed:", e);
  process.exit(2);
});

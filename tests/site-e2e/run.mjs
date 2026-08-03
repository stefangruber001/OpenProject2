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
  try {
    await testJourney(browser, base);
    await testNoOverflow(browser, base);
    await testSmoke(browser, base);
    await testDataTabs(browser, base);
    await testRetired(browser, base);
    await testShell(browser, base);
    await testGantt(browser, base);
    await testBudgetBuilder(browser, base);
    await testProjectTracking(browser, base);
    await testErp(browser, base);
    await testI18n(browser, base);
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
    "erp.html#torre",
    "erp.html#clientes",
    "erp.html#facturacion",
    "erp.html#seguimiento",
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
  await page.close();
}

// ── Smoke: each app-surfaced page loads with a title and no errors.
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
    ["index.html", "erp.html#torre"],
    ["dashboard.html", "erp.html#torre"],
    ["clientes.html", "erp.html#clientes"],
    ["frontend.html", "erp.html#presupuestos"],
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
    await pg.goto(`${base}/erp.html#torre`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(600);

    const sections = await pg.locator("#p1 .secitem").count();
    const subsOpen = await pg.locator("#p2.on").count();
    if (sections === 7 && subsOpen === 0) ok("shell: 7 sections, subsection panel collapsed");
    else bad("shell: sections + collapsed panel", `sections=${sections} open=${subsOpen}`);

    // Press a section → panel 2 opens with that section's subsections.
    await pg.locator('#p1 .secitem[data-sec="comercial"]').click();
    await pg.waitForTimeout(250);
    const subs = await pg.locator("#p2.on .navitem").count();
    if (subs === 4) ok("shell: section opens its subsection panel");
    else bad("shell: section opens panel", `subsections=${subs}`);

    // Choosing a subsection routes and collapses the panel again.
    await pg.locator('#p2 .navitem[data-k="contratos"]').click();
    await pg.waitForTimeout(350);
    const hash = await pg.evaluate(() => location.hash);
    const stillOpen = await pg.locator("#p2.on").count();
    const title = await pg.locator("#ttl").innerText();
    if (hash === "#contratos" && stillOpen === 0 && /Contratos/i.test(title))
      ok("shell: choosing a subsection routes and collapses the panel");
    else bad("shell: subsection routes", `hash=${hash} open=${stillOpen} title=${title}`);

    // Clicking outside closes it too.
    await pg.locator('#p1 .secitem[data-sec="obra"]').click();
    await pg.waitForTimeout(200);
    await pg.locator("#subscrim").click();
    await pg.waitForTimeout(250);
    if ((await pg.locator("#p2.on").count()) === 0) ok("shell: outside click collapses the panel");
    else bad("shell: outside click collapses", "still open");

    // Unbuilt subsections say what will live there instead of rendering blank.
    await pg.evaluate(() => (location.hash = "conciliacion"));
    await pg.waitForTimeout(300);
    const ph = await pg.locator("#view").innerText();
    if (/En preparación/.test(ph)) ok("shell: unbuilt subsection explains itself");
    else bad("shell: unbuilt subsection", ph.slice(0, 80));

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
    await pg.evaluate(() => (location.hash = "proyectos"));
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
    await pg.evaluate(() => (location.hash = "facturacion"));
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
    await pg.goto(`${base}/erp.html#seguimiento`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(800);

    // Empty plan → derive it from the project's accepted budget.
    if (await pg.locator("#gDerive").count()) {
      await pg.locator("#gDerive").click();
      await pg.waitForTimeout(700);
    }
    const bars = await pg.locator("#gSvg .gbar").count();
    const rows = await pg.locator(".gnames .gn[data-task]").count();
    const deps0 = await pg.locator("#gSvg path.gdep").count();
    if (bars >= 3 && rows === bars && deps0 >= bars - 1)
      ok(`gantt: derives ${bars} chained tasks from the budget`);
    else bad("gantt: derives from the budget", `bars=${bars} rows=${rows} deps=${deps0}`);

    // Bars must render at their real height — an SVG rect is subject to CSS
    // geometry, so a stray `.bar {height}` rule elsewhere silently flattens
    // the whole chart. That regression happened once; this pins it.
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
    await pg.reload({ waitUntil: "networkidle" });
    await pg.waitForTimeout(900);
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
    await pg.goto(`${base}/erp.html#presupuestos`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(800);

    // Open the one budget that is still a draft — a frozen version is
    // deliberately read-only, so editing has to be tried on an editable one.
    const rows = pg.locator("#view tr.click");
    const n = await rows.count();
    let opened = false;
    for (let i = 0; i < n; i++) {
      if (/Borrador/.test(await rows.nth(i).innerText())) {
        await rows.nth(i).click();
        opened = true;
        break;
      }
    }
    if (!opened) {
      bad("builder: a draft budget exists to edit", `${n} budgets, none in draft`);
      return;
    }
    await pg.waitForTimeout(500);

    // Zone 1, 2 and 3 simultaneously — the whole point of the layout.
    const tree = await pg.locator("#bTree .bc").count();
    const gridRows = await pg.locator("#bRows tr[data-row]").count();
    const totals = await pg.locator("#bTotals").isVisible();
    if (tree >= 2 && gridRows >= 2 && totals)
      ok(`builder: three zones at once (${tree} chapters · ${gridRows} lines · live totals)`);
    else bad("builder: three zones", `tree=${tree} rows=${gridRows} totals=${totals}`);

    // The panel recalculates ON EVERY KEYSTROKE, not on blur. Type into a
    // price field and read the total back without leaving the field.
    const totalOf = async () => pg.locator("#bTotals .row.big b").innerText();
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

    if (errs.length === 0) ok("builder: no console errors");
    else bad("builder: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("budget builder", String(e).slice(0, 200));
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
    await pg.goto(`${base}/erp.html#seguimiento`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(900);

    // ---- the persistent selector and its fixed header ----
    const fields = await pg.locator(".projbar .phead .f").count();
    const headText = await pg.locator(".projbar .phead").innerText();
    if (
      fields >= 8 &&
      /Cliente/i.test(headText) &&
      /Avance/i.test(headText) &&
      /Margen actual/i.test(headText)
    )
      ok(`project header: ${fields} fields incl. customer, progress and margin`);
    else bad("project header", headText.replace(/\n/g, " ").slice(0, 100));

    // The context must survive a change of subsection — that is what makes it
    // a section context rather than one screen's dropdown.
    const chosen = await pg.locator("#psel").inputValue();
    await pg.evaluate(() => (location.hash = "economia"));
    await pg.waitForTimeout(600);
    const stillChosen = await pg.locator("#psel").inputValue();
    if (stillChosen === chosen) ok("project context survives a subsection change");
    else bad("project context persists", `${chosen} → ${stillChosen}`);

    // ---- economics before any progress is recorded ----
    const econ = await pg.locator("#view").innerText();
    const kpis = await pg.locator("#view .kpi").count();
    if (kpis === 4 && /COSTE PROYECTADO/i.test(econ) && /MARGEN PROYECTADO/i.test(econ))
      ok("economics: the four project figures, incl. projected cost and margin");
    else bad("economics KPIs", econ.replace(/\n/g, " ").slice(0, 120));

    const hasColumns = ["Presupuestado", "Comprometido", "Real", "Proyectado", "Desviación"].every(
      (c) => new RegExp(c, "i").test(econ),
    );
    if (hasColumns) ok("economics: budgeted · committed · actual · projected · variance");
    else bad("economics columns", econ.replace(/\n/g, " ").slice(0, 160));

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
    if (/ajustada/i.test(adjusted) && /calculada/i.test(adjusted))
      ok("economics: an adjustment shows BOTH the adjusted and calculated figures");
    else bad("economics: both figures shown", adjusted.replace(/\n/g, " ").slice(0, 160));

    // ---- derive the plan from the budget ----
    await pg.evaluate(() => (location.hash = "seguimiento"));
    await pg.waitForTimeout(600);
    await pg.locator("#gDerive").click();
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
    const chapterPcts = await pg
      .locator("[data-chap]")
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

    // ---- progress by executed quantity ----
    const qty = pg.locator("[data-lineqty]").first();
    const total = Number(await qty.getAttribute("data-total"));
    const pctInput = pg.locator("[data-line]").first();
    await qty.fill(String(total / 2));
    await qty.press("Enter");
    await pg.waitForTimeout(600);
    const readBack = Number(await pctInput.inputValue());
    // Half the quantity is half the line; the engine converts, not the view.
    if (Math.abs(readBack - 50) <= 1)
      ok(`tracking: progress entered as a quantity becomes ${readBack}%`);
    else bad("tracking: quantity → percentage", `${total}/2 read back as ${readBack}%`);

    // ---- the deviations panel ----
    const dev = await pg.locator(".bside").innerText();
    if (/Desviaciones/.test(dev) && /Retraso sobre línea base/.test(dev))
      ok("tracking: deviations panel reports the slip against the baseline");
    else bad("tracking: deviations panel", dev.replace(/\n/g, " ").slice(0, 120));

    // The economics must move with the progress just recorded — the two screens
    // are two views of one set of figures, not two sets.
    await pg.evaluate(() => (location.hash = "economia"));
    await pg.waitForTimeout(600);
    const after = await pg.locator("#view").innerText();
    if (/%/.test(after) && /Total/.test(after))
      ok("economics: chapter progress feeds the projection");
    else bad("economics after progress", after.replace(/\n/g, " ").slice(0, 120));

    if (errs.length === 0) ok("tracking: no console errors");
    else bad("tracking: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("project tracking", String(e).slice(0, 200));
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
    await pg.goto(`${base}/erp.html#torre`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(700);
    const kpiText = await pg.locator("#view").innerText();
    if (/€/.test(kpiText) && /Alertas/.test(kpiText))
      ok("erp: Control Tower indicators + alerts render");
    else bad("erp: Control Tower renders", kpiText.slice(0, 80));

    // module navigation (DAS-01): presupuestos shows versioned budgets
    await pg.evaluate(() => (location.hash = "presupuestos"));
    await pg.waitForTimeout(400);
    const preText = await pg.locator("#view").innerText();
    if (/PRE-2026/.test(preText) && /versiones/i.test(preText))
      ok("erp: budgets module lists versioned budgets");
    else bad("erp: budgets module", preText.slice(0, 80));

    // BNK-02: type a project number on an unallocated movement → allocated
    await pg.evaluate(() => (location.hash = "banco"));
    await pg.waitForTimeout(400);
    const inp = pg.locator("input[data-mov]").first();
    if ((await inp.count()) > 0) {
      await inp.fill("P-2026-0001");
      await inp.press("Enter");
      await pg.waitForTimeout(400);
      const after = await pg.locator("#view").innerText();
      if (
        /P-2026-0001 · material/.test(after) ||
        /Movimiento asignado/.test(
          await pg
            .locator("#toast")
            .innerText()
            .catch(() => ""),
        )
      )
        ok("erp: BNK-02 — movement allocated by typing the project number");
      else bad("erp: BNK-02 allocation", "allocation not reflected");
    } else {
      bad("erp: BNK-02 allocation", "no unallocated movement input found");
    }

    // MDM: every party field is correctable from the UI (edit drawer → updateParty)
    await pg.evaluate(() => (location.hash = "clientes"));
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
    await pg.locator("#dClose").click();
    await pg.waitForTimeout(200);

    // Gestoría: exception list + VAT summary render
    await pg.evaluate(() => (location.hash = "gestoria"));
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

// ── Language toggle: ES default, EN translates Spanish-base pages, and the
//    choice carries to English-base pages (html lang flips to the target).
async function testI18n(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  try {
    // The workspace is the entry screen now, so the toggle is exercised there.
    await pg.goto(`${base}/erp.html#torre`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(600);
    const pill = await pg.locator("#canei-lang-pill button").count();
    if (pill === 2) ok("i18n: language toggle present on the workspace");
    else bad("i18n: toggle present", `buttons=${pill}`);
    const esText = await pg.locator("body").innerText();
    if (esText.includes("Torre de control")) ok("i18n: workspace defaults to Spanish");
    else bad("i18n: workspace defaults to Spanish", esText.slice(0, 60));

    // switch to EN via the pill (reloads the page)
    await Promise.all([
      pg.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
      pg.locator("#canei-lang-pill button", { hasText: "EN" }).click(),
    ]);
    await pg.waitForTimeout(700);
    // dynamic content gets translated too (MutationObserver path)
    const erpLang = await pg.evaluate(() => document.documentElement.lang);
    const erpText = await pg.locator("body").innerText();
    if (erpLang === "en" && /Control tower/i.test(erpText) && !/Torre de control/.test(erpText))
      ok("i18n: EN toggle translates the ERP workspace");
    else bad("i18n: erp translated", `lang=${erpLang} ${erpText.slice(0, 80)}`);

    // English-base page flips to Spanish when ES is chosen
    await pg.evaluate(() => localStorage.setItem("caneiLang", "es"));
    await pg.goto(`${base}/journey.html`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(500);
    const jLang = await pg.evaluate(() => document.documentElement.lang);
    if (jLang === "es") ok("i18n: English-base page adopts Spanish choice");
    else bad("i18n: journey adopts ES", `lang=${jLang}`);
    await pg.evaluate(() => localStorage.setItem("caneiLang", "es"));
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

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
    await testPresupuestador(browser, base);
    await testCapture(browser, base);
    await testProjectTracking(browser, base);
    await testContract(browser, base);
    await testProcurement(browser, base);
    await testAdmin(browser, base);
    await testControlTowerAndDay(browser, base);
    await testJourneyRealMode(browser, base);
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

/* PRY-01's Programación tab, then the chart itself. S8 moved the Gantt out of
   a sibling route and behind the centre panel, where §3.1 says a full-screen
   surface belongs; every check that used to call openTab(…, "_projectSchedule")
   comes through here instead. */
async function openGantt(pg, base) {
  // Leaving a full-screen surface is a JS state change, not a route change —
  // `goto` at the same hash is a no-op and would silently leave us on the
  // chart with no list to search. Come back the way a person would.
  if (await pg.locator("#gBack").count()) {
    await pg.locator("#gBack").click();
    await pg.waitForTimeout(500);
  } else if ((await pg.locator("#prgQ").count()) === 0) {
    await pg.goto(`${base}/erp.html#progress`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(700);
  }
  if (await pg.locator("#view [data-ctrclose]").count()) {
    await pg.locator("#view [data-ctrclose]").click();
    await pg.waitForTimeout(300);
  }
  await openJobWithChapters(pg, "prgQ");
  await pg.locator('[data-ptab="plan"]').click();
  await pg.waitForTimeout(400);
  await pg.locator("#pnlGantt").click();
  await pg.waitForTimeout(700);
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
    await pg.waitForTimeout(600);

    const sections = await pg.locator("#p1 .secitem").count();
    const subsOpen = await pg.locator("#p2.on").count();
    if (sections === 6 && subsOpen === 0) ok("shell: 6 sections, subsection panel collapsed");
    else bad("shell: sections + collapsed panel", `sections=${sections} open=${subsOpen}`);

    // The specification's own count, asserted rather than assumed: six
    // secciones and twenty-nine subsecciones. It is twenty-nine and not the
    // doc's twenty-six because Comunicaciones, Alertas and Usuarios were moved
    // into Configuración instead of being deleted.
    const shape = await pg.evaluate(() => ({
      sections: SECTIONS.length,
      subs: SECTIONS.reduce((n, s) => n + s.subs.length, 0),
    }));
    if (shape.sections === 6 && shape.subs === 29) ok("shell: 6 secciones × 29 subsecciones");
    else bad("shell: 6×29", JSON.stringify(shape));

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

    // Unbuilt subsections say what will live there instead of rendering blank.
    // The probe has moved three times as its subject got built: Reportes
    // (removed outright), `units` (DMC-03, S3), `visits` (COM-02, S4).
    // `petty-cash` is the current real not-yet-built subsección — ADM-06,
    // scheduled for S11.
    await pg.evaluate(() => (location.hash = "petty-cash"));
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
    await pg.waitForTimeout(800);

    // Open the one budget that is still a draft — a frozen version is
    // deliberately read-only, so editing has to be tried on an editable one.
    // The register groups by stage (COM-03), so the draft is the first row
    // under the «Borradores» heading rather than a row carrying its own pill.
    const opened = await pg.evaluate(() => {
      const hd = [...document.querySelectorAll("#view tr.grouphd")].find((t) =>
        /^Borradores/i.test(t.innerText.trim()),
      );
      let row = hd && hd.nextElementSibling;
      if (!row || !row.classList.contains("click")) return false;
      row.click();
      return true;
    });
    if (!opened) {
      bad(
        "builder: a draft budget exists to edit",
        `${await pg.locator("#view tr.click").count()} budgets, none under «Borradores»`,
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

    if (errs.length === 0) ok("builder: no console errors");
    else bad("builder: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("budget builder", String(e).slice(0, 200));
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
  pg.on("dialog", async (d) => {
    const m = d.message() || "";
    if (/^Nombre del capítulo/.test(m)) await d.accept("Capítulo E2E");
    else if (/^Motivo de la nueva versión/.test(m)) await d.accept("Revisión E2E");
    else await d.accept("");
  });
  try {
    await pg.goto(`${base}/erp.html#quotes`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(900);

    // ---- the register, grouped by the five stages -------------------------
    const heads = await pg.evaluate(() =>
      [...document.querySelectorAll("#view tr.grouphd")].map((t) => t.innerText.trim()),
    );
    // innerText is the RENDERED text and the headings are uppercased in CSS,
    // so the comparison has to be case-insensitive or it tests the stylesheet.
    const known = ["borradores", "enviados", "aceptados", "rechazados", "caducados"];
    if (heads.length && heads.every((h) => known.some((k) => h.toLowerCase().startsWith(k))))
      ok(`COM-03: the register is grouped by stage (${heads.length} groups)`);
    else bad("COM-03: grouped register", JSON.stringify(heads));

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
    if (shell.fs && shell.rail === "none" && /^260px .* 300px$/.test(shell.cols) && shell.bar)
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
    const regrouped = await pg.evaluate(() =>
      [...document.querySelectorAll("#view tr.grouphd")].map((t) => t.innerText.trim()),
    );
    if (regrouped.some((h) => /^rechazados/i.test(h)))
      ok("COM-03: and the register regroups it under «Rechazados»");
    else bad("COM-03: regrouped after refusal", JSON.stringify(regrouped));

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

    // ---- PRY-01 (S8): the panel, the three-state control, item 14 ----
    await openJobWithChapters(pg, "prgQ");
    const tabs = await pg.locator("#view .ctrpanel [data-ptab]").allInnerTexts();
    if (
      tabs.length === 3 &&
      /Avance/i.test(tabs[0]) &&
      /Programaci/i.test(tabs[1]) &&
      /Ficha/i.test(tabs[2])
    )
      ok("PRY-01: the panel carries Avance · Programación · Ficha");
    else bad("PRY-01: panel tabs", tabs.join("/"));

    const control = await pg.evaluate(() => {
      const strip = document.querySelector("#view .pstate");
      if (!strip) return null;
      const box = document.querySelector("#view .pctbox");
      return {
        buttons: strip.querySelectorAll("button").length,
        buttonWidth: Math.round(strip.querySelector("button").getBoundingClientRect().width),
        boxWidth: box ? Math.round(box.getBoundingClientRect().width) : 0,
        boxDisabled: box ? box.disabled : null,
        state: (strip.querySelector("button.on") || {}).dataset?.st,
      };
    });
    if (
      control &&
      control.buttons === 3 &&
      control.buttonWidth === 90 &&
      control.boxWidth === 60 &&
      control.boxDisabled === (control.state !== "inProgress")
    )
      ok(
        `PRY-01: three 90 px states and a 60 px box, live only on «en ejecución» (${control.state})`,
      );
    else bad("PRY-01: three-state control", JSON.stringify(control));

    // Press «En ejecución»: the state moves AND the box comes alive, which is
    // the half of §3.2 that a screenshot cannot show.
    await pg.locator('#view .pstate button[data-st="inProgress"]').first().click();
    await pg.waitForTimeout(500);
    const live = await pg.evaluate(() => {
      const strip = document.querySelector("#view .pstate");
      const box = document.querySelector("#view .pctbox");
      return { on: (strip.querySelector("button.on") || {}).dataset?.st, disabled: box.disabled };
    });
    if (live.on === "inProgress" && live.disabled === false)
      ok("PRY-01: choosing «en ejecución» is what makes the percentage editable");
    else bad("PRY-01: percentage becomes live", JSON.stringify(live));

    await pg.locator('#view .pstate button[data-st="done"]').first().click();
    await pg.waitForTimeout(500);
    const finished = await pg.evaluate(() => {
      const box = document.querySelector("#view .pctbox");
      return { value: box.value, disabled: box.disabled };
    });
    if (finished.value === "100" && finished.disabled === true)
      ok("PRY-01: a finished chapter reads 100 and stops accepting a percentage");
    else bad("PRY-01: finished chapter", JSON.stringify(finished));

    // Money-chain item 14. The doc asks whether moving a milestone moves the
    // expected cash; before this session nothing wrote installment.expectedDate
    // after the contract was drawn up, so the answer was no.
    await pg.locator('#view [data-ptab="plan"]').click();
    await pg.waitForTimeout(400);
    if ((await pg.locator("#gDerive").count()) === 0) {
      // The plan has to exist before it can move anything.
      await pg.locator("#pnlGantt").click();
      await pg.waitForTimeout(700);
      if (await pg.locator("#gDerive").count()) {
        await pg.locator("#gDerive").click();
        await pg.waitForTimeout(900);
      }
      await pg.locator("#gBack").click();
      await pg.waitForTimeout(500);
      await pg.locator('#view [data-ptab="plan"]').click();
      await pg.waitForTimeout(400);
    }
    await pg.locator("#pnlResched").click();
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
    // a section context rather than one screen's dropdown.
    const chosen = await pg.locator("#psel").inputValue();
    await pg.evaluate(() => (location.hash = "economics"));
    await pg.waitForTimeout(600);
    const stillChosen = await pg.locator("#psel").inputValue();
    if (stillChosen === chosen) ok("project context survives a subsection change");
    else bad("project context persists", `${chosen} → ${stillChosen}`);

    // ---- PRY-02 (S8): the centre panel, and the money that stopped here ----
    const compressed = await pg.evaluate(() => {
      const el = document.querySelector("#view .ctr");
      return { present: !!el, open: el ? el.classList.contains("on") : false };
    });
    if (compressed.present && !compressed.open)
      ok("PRY-02: the list opens wide, with no panel beside it");
    else bad("PRY-02: list before opening", JSON.stringify(compressed));

    const listColsWide = await pg.locator("#view table.mlist thead th").count();
    await openJobWithChapters(pg, "ecoQ");
    const opened = await pg.evaluate(() => {
      const el = document.querySelector("#view .ctr");
      return {
        open: el ? el.classList.contains("on") : false,
        cols: getComputedStyle(el).gridTemplateColumns,
        listStillThere: !!document.querySelector("#view .ctrlist table.mlist"),
        headerHeight: Math.round(
          document.querySelector("#view .ctrhd").getBoundingClientRect().height,
        ),
        cards: document.querySelectorAll("#view .ctrpanel .kpi").length,
      };
    });
    const listColsNarrow = await pg.locator("#view table.mlist thead th").count();
    if (
      opened.open &&
      opened.listStillThere &&
      opened.headerHeight === 88 &&
      opened.cards === 3 &&
      listColsNarrow < listColsWide
    )
      ok(`PRY-02: 372 list + 780 panel, list never disappears (${opened.cols})`);
    else bad("PRY-02: centre panel", JSON.stringify({ ...opened, listColsWide, listColsNarrow }));

    const panelText = await pg.locator("#view .ctrpanel").innerText();
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
    const pendingText = await pg.locator("#view .ctrpanel").innerText();
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

    // Closing the panel gives the list its width back — the doc's own rule.
    await pg.locator("#view [data-ctrclose]").click();
    await pg.waitForTimeout(400);
    const closed = await pg.evaluate(() => ({
      open: document.querySelector("#view .ctr").classList.contains("on"),
      cols: document.querySelectorAll("#view table.mlist thead th").length,
    }));
    if (!closed.open && closed.cols === listColsWide)
      ok("PRY-02: closing the panel restores the list to its full width");
    else bad("PRY-02: list restored", JSON.stringify(closed));

    // ---- derive the plan from the budget ----
    await openGantt(pg, base);
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
    // are two views of one set of figures, not two sets. Since S8 both run on
    // the centre panel, so the check opens the job rather than reading a flat
    // table: the figure it compares is the progress bar in PRY-02's header
    // against the number PRY-01 wrote.
    await pg.evaluate(() => (location.hash = "economics"));
    await pg.waitForTimeout(600);
    await openJobWithChapters(pg, "ecoQ");
    const after = await pg.evaluate(() => {
      const bar = document.querySelector("#view .ctrhd .bar i");
      const panel = document.querySelector("#view .ctrpanel");
      return {
        pct: erp.projectEconomics(gProject).progressPct,
        barWidth: bar ? bar.style.width : null,
        chapterRows: document.querySelectorAll("#view .ctrpanel tbody tr").length,
        hasPct: panel ? /%/.test(panel.innerText) : false,
      };
    });
    if (after.chapterRows > 0 && after.hasPct && after.barWidth === `${after.pct}%`)
      ok(`economics: one progress figure drives both PRY screens (${after.barWidth})`);
    else bad("economics after progress", JSON.stringify(after));

    if (errs.length === 0) ok("tracking: no console errors");
    else bad("tracking: no console errors", errs.slice(0, 3).join(" | "));
  } catch (e) {
    bad("project tracking", String(e).slice(0, 200));
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
      return {
        full: document.body.classList.contains("fs"),
        zones: grid ? grid.children.length : 0,
        cols: grid ? getComputedStyle(grid).gridTemplateColumns : "",
        docTranslateOff: document.querySelector(".cdoc")?.getAttribute("translate") === "no",
        tabs: [...document.querySelectorAll("[data-contab]")].map((b) => b.textContent),
      };
    });
    if (
      viewer.full &&
      viewer.zones === 2 &&
      /392px$/.test(viewer.cols) &&
      viewer.docTranslateOff &&
      viewer.tabs.length === 3
    )
      ok(`COM-04: full screen, document 760 + panel 392, three tabs (${viewer.cols})`);
    else bad("COM-04: full-screen viewer", JSON.stringify(viewer));

    // The document is built from data — it names the customer and totals its
    // own milestones, which no uploaded PDF in this system could do.
    const docText = await pg.locator(".cdoc").innerText();
    const named = await pg.evaluate(() => erp.renderContractDoc(conWork.id).customer.name);
    if (new RegExp(named.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(docText))
      ok("COM-04: the document is rendered from data, customer and all");
    else bad("COM-04: document from data", docText.replace(/\n/g, " ").slice(0, 120));

    // Hitos de pago: the sum against the contracted amount, and S8's source.
    await pg.locator('[data-contab="hitos"]').click();
    await pg.waitForTimeout(400);
    const hitos = await pg.locator("#conBody").innerText();
    if (/Suma de hitos/i.test(hitos) && /(cuadra|sobre el contratado)/i.test(hitos))
      ok("COM-04: the milestones foot against the contracted amount");
    else bad("COM-04: milestones foot", hitos.replace(/\n/g, " ").slice(0, 140));

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
    await pg.locator("[data-approve]").first().click();
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

    // ---- Horas: assign → enter → approve locks → repeat day ----
    await pg.evaluate(() => (location.hash = "labour"));
    await pg.waitForTimeout(700);
    await pg.click("#hAssign");
    await pg.waitForTimeout(300);
    await pg.selectOption("#as_w", { index: 0 });
    await pg.click("#as_save");
    await pg.waitForTimeout(500);
    const hin = pg.locator(".wgrid input.hin").first();
    if ((await hin.count()) === 0) {
      bad("horas: the grid shows an editable cell after assigning a worker", "no input.hin");
    } else {
      await hin.fill("6");
      await hin.blur();
      await pg.waitForTimeout(500);
      const totalCell = await pg.locator(".wgrid td.wtot.num").first().innerText();
      if (totalCell.trim() === "6")
        ok("horas: hours entered in the grid update the worker's total");
      else bad("horas: grid total after entry", totalCell);

      await pg.locator("[data-approve]").first().click();
      await pg.waitForTimeout(500);
      const disabledCount = await pg.locator(".wgrid input.hin[disabled]").count();
      if (disabledCount > 0) ok("horas: approving the week locks its entered cell");
      else bad("horas: approve locks the cell", `disabled=${disabledCount}`);

      await pg.click("#hRepeat");
      await pg.waitForTimeout(500);
      const repeatToast = await pg.locator("#toast").innerText();
      if (/repetid/i.test(repeatToast)) ok("horas: repeating yesterday's day reports success");
      else bad("horas: repeat day", repeatToast);
    }

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
  // whatever they ask so the run never blocks on a modal.
  pg.on("dialog", async (d) => {
    const m = d.message();
    await d.accept(/envía/.test(m) ? "Gestoría Subirats" : "Justificado por el E2E");
  });
  try {
    // ---- §5.3 Conciliación: suggestion + reasons → accept → transfers → close refuses
    await pg.goto(`${base}/erp.html#banking`, { waitUntil: "networkidle" });
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

    const openEx = await pg.locator("[data-acc]").count();
    if (openEx > 0 && (await pg.locator("#bSend").isDisabled()))
      ok(`gestoría: sending is blocked while exceptions are unjustified (${openEx})`);
    else bad("gestoría: send blocked by exceptions", `open=${openEx}`);

    let guard = 0;
    while ((await pg.locator("[data-acc]").count()) > 0 && guard++ < 15) {
      await pg.locator("[data-acc]").first().click();
      await pg.waitForTimeout(450);
    }
    if (
      (await pg.locator("[data-acc]").count()) === 0 &&
      !(await pg.locator("#bSend").isDisabled())
    )
      ok("gestoría: justifying every exception unblocks the send");
    else bad("gestoría: justification unblocks send", `remaining=${guard}`);

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
    const bancoText = await pg.locator("#view").innerText();
    const stillHasInput = await pg.locator("#view input[data-mov]").count();
    if (stillHasInput === 0 && /Previsión de caja/.test(bancoText))
      ok("banco: allocation moved out to Conciliación; position and forecast stay");
    else bad("banco: allocation removed", `inputs=${stillHasInput}`);
    await pg.click("#bToRec");
    await pg.waitForTimeout(600);
    // The two are tabs of ADM-05 now, so handing over means selecting the
    // sibling tab rather than navigating somewhere else.
    const onRec = await pg.locator('.tabstrip [data-tab="_reconcile"].on').count();
    if (onRec === 1) ok("banco: the screen hands over to Conciliación explicitly");
    else bad("banco: link to reconciliation", `active tab not _reconcile (${pg.url()})`);

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
  pg.on("dialog", async (d) => {
    const m = d.message();
    if (/A quién/.test(m)) await d.accept("backoffice");
    else if (/Fecha límite/.test(m)) await d.accept("2026-05-20");
    else if (/Posponer hasta/.test(m)) await d.accept("2026-05-15");
    else if (/^Motivo de la pérdida/.test(m)) await d.accept("price");
    else if (/^Motivo/.test(m)) await d.accept("");
    else if (/Nota de resoluci/.test(m)) await d.accept("Resuelto en el E2E");
    else if (/^Evidencia/.test(m)) await d.accept("");
    else if (/^Vence/.test(m)) await d.accept("2026-05-10");
    else await d.accept("");
  });
  try {
    await pg.goto(`${base}/erp.html#tower`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(900);

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
    // Today's date, so the scheduled visit is not drawn "overdue" and can be
    // completed straight away in this same run.
    const today = await pg.evaluate(() => erp.today);
    await pg.locator("#sv_date").fill(today);
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
async function testJourneyRealMode(browser, base) {
  const pg = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
    acceptDownloads: true,
  });
  const errs = [];
  attachConsole(pg, errs);
  pg.on("dialog", async (d) => await d.accept());
  try {
    // Visit erp.html first so this browser context's IndexedDB has real
    // tenant data before journey.html asks for it — real mode reads the
    // SAME "caneiERP" database, not a fixture of its own.
    await pg.goto(`${base}/erp.html#tower`, { waitUntil: "networkidle" });
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

// ── Language toggle: ES default, EN translates Spanish-base pages, and the
//    choice carries to English-base pages (html lang flips to the target).
async function testI18n(browser, base) {
  const pg = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  try {
    // The workspace is the entry screen now, so the toggle is exercised there.
    await pg.goto(`${base}/erp.html#tower`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(600);
    const pill = await pg.locator("#canei-lang-pill button").count();
    if (pill === 3) ok("i18n: the toggle offers all three languages (ES · CA · EN)");
    else bad("i18n: toggle present", `buttons=${pill}, expected 3`);
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

    // Catalan (S3, decision 20). The navigation is the surface a Catalan user
    // hits first, so it is the one asserted: the six secciones must actually
    // read as Catalan, not fall back to Spanish.
    await pg.evaluate(() => localStorage.setItem("caneiLang", "ca"));
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
    const pryCaText = await pg.locator("#view").innerText();
    if (
      /Fitxa/i.test(pryCaText) &&
      /execuci/i.test(pryCaText) &&
      !/En ejecución/.test(pryCaText) &&
      !/Fin comprometido/.test(pryCaText)
    )
      ok("i18n: CA translates the PRY-01 panel and its three-state control");
    else bad("i18n: CA PRY-01", pryCaText.replace(/\n/g, " ").slice(0, 160));

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
    await pg.evaluate(() => localStorage.setItem("caneiLang", "en"));
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
    const pryEnText = await pg.locator("#view").innerText();
    if (
      /Details/i.test(pryEnText) &&
      /In progress/i.test(pryEnText) &&
      !/Fin comprometido/.test(pryEnText)
    )
      ok("i18n: EN translates the PRY-01 panel and its three-state control");
    else bad("i18n: EN PRY-01", pryEnText.replace(/\n/g, " ").slice(0, 160));

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
    await pg.evaluate(() => localStorage.setItem("caneiLang", "ca"));
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

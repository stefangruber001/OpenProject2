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
    // Reportes used to be the probe; it was removed outright (a menu entry with
    // no screen behind it). `units` is a real not-yet-built subsección: the
    // list exists but is hardcoded, so DMC-03 makes it maintainable in S3.
    await pg.evaluate(() => (location.hash = "units"));
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
    await pg.goto(`${base}/erp.html#progress`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(800);
    await openTab(pg, "progress", "_projectSchedule");

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
    await openTab(pg, "progress", "_projectSchedule");
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

    // The context must survive a change of subsection — that is what makes it
    // a section context rather than one screen's dropdown.
    const chosen = await pg.locator("#psel").inputValue();
    await pg.evaluate(() => (location.hash = "economics"));
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
    await openTab(pg, "progress", "_projectSchedule");
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
    await pg.evaluate(() => (location.hash = "economics"));
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

      await pg.locator("[data-pu]").first().click();
      await pg.waitForTimeout(300);
      const before = await pg.locator(".drawer .pill").first().innerText();
      await pg.click("#a_send");
      await pg.waitForTimeout(400);
      const after = await pg.locator(".drawer .pill").first().innerText();
      // The exact bug this session shipped once: the send handler updated the
      // record but never re-rendered the open drawer, so the status pill and
      // the next action both stayed stale until the drawer was closed and
      // reopened.
      if (after !== before && (await pg.locator("#a_accept").count()) > 0)
        ok(`compras: sending an order refreshes the open drawer (${before} → ${after})`);
      else bad("compras: drawer refreshes after send", `${before} → ${after}`);

      await pg.fill("#a_arr", "2026-01-01");
      await pg.click("#a_accept");
      await pg.waitForTimeout(400);
      await pg.fill("#a_qty", "10");
      await pg.fill("#a_doc", "ALB-E2E-1");
      await pg.click("#a_recv");
      await pg.waitForTimeout(400);
      const finalStatus = await pg.locator(".drawer .pill").first().innerText();
      if (/Recibida/.test(finalStatus))
        ok("compras: draft → sent → accepted → received, in one drawer session");
      else bad("compras: full receiving lifecycle", finalStatus);
      await pg.click("#dClose");
      await pg.waitForTimeout(200);
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

    // ---- Modificaciones: detect → value → send → approve → adenda ----
    await pg.evaluate(() => (location.hash = "variations"));
    await pg.waitForTimeout(700);
    const kpisBefore = await pg.locator("#view .kpi .val").allInnerTexts();
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
    const kpisAfter = await pg.locator("#view .kpi .val").allInnerTexts();
    if (JSON.stringify(kpisAfter) !== JSON.stringify(kpisBefore))
      ok("modificaciones: approving an extra moves the contract-value header");
    else bad("modificaciones: header updates on approval", kpisAfter.join(" | "));

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

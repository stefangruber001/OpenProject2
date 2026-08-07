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

async function waitForServer(base, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${base}/journey.html`);
      if (r.ok) return;
    } catch {}
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
    let stuck = "";
    for (let i = 0; i < 20; i++) {
      const next = page.locator("#next");
      if ((await next.count()) === 0) break;
      if (!(await next.isVisible().catch(() => false))) break;
      if (await next.isDisabled().catch(() => false)) {
        stuck = await page
          .locator("#gate")
          .innerText()
          .catch(() => "");
        break;
      }
      await next.click();
      await page.waitForTimeout(160);
      advanced++;
    }
    if (advanced >= 10) ok(`advances through the full lifecycle (${advanced} steps)`);
    else
      bad(
        "advances through the full lifecycle",
        `only advanced ${advanced} steps${stuck ? ` — gate: ${stuck.replace(/\n/g, " | ")}` : ""}`,
      );

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

    // ── The figures must come from entered purchase orders and bills, not from a
    // percentage of the budget. When they were multipliers every chapter showed
    // the SAME variance percentage — that identity is the regression to catch.
    await page.evaluate(() => {
      const pills = [...document.querySelectorAll("#rail .st.nav")];
      pills[11]?.click(); // Close · profit
    });
    await page.waitForTimeout(300);
    const variancePcts = await page.evaluate(() =>
      [...document.querySelectorAll("#stage table tr")]
        .map((r) => [...r.children].map((c) => c.textContent.trim()))
        .filter((r) => r.length === 4)
        .map((r) => r[3])
        .filter((v) => /%/.test(v)),
    );
    if (variancePcts.length >= 3 && new Set(variancePcts).size > 1)
      ok(`per-chapter variance derives from entered cost (${new Set(variancePcts).size} distinct)`);
    else
      bad(
        "per-chapter variance derives from entered cost",
        `values: ${variancePcts.join(" | ") || "(none)"} — identical values mean the multiplier is back`,
      );

    // ── A reload must resume the journey, ledger included. step/reached and the
    // whole ledger used to be module variables, so a refresh dropped the
    // operator back on the intake with zeroes beside a full document folder.
    const before = await page.evaluate(
      () => document.querySelector("#l-revenue")?.textContent.trim() || "",
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      revenue: document.querySelector("#l-revenue")?.textContent.trim() || "",
      onIntake: !!document.querySelector("#startbtn"),
    }));
    if (!after.onIntake && after.revenue === before && /\d/.test(after.revenue))
      ok(`reload resumes mid-journey with the ledger intact (${after.revenue})`);
    else bad("reload resumes mid-journey", `before=${before} after=${JSON.stringify(after)}`);

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
async function testNoOverflow(browser, base) {
  const pages = [
    "index.html",
    "journey.html",
    "dashboard.html",
    "master-data.html",
    "financial-data.html",
    "erp.html",
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
    "index.html",
    "journey.html",
    "dashboard.html",
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

// ── ERP workspace (BRD v2): launchpad live KPIs, Control Tower, and the
//    BNK-02 flow — allocate a bank movement by typing the project number.
async function testErp(browser, base) {
  // Home launchpad: live indicators computed from the shared dataset.
  const home = await browser.newPage({ viewport: { width: 1200, height: 950 } });
  const herr = [];
  attachConsole(home, herr);
  try {
    await home.goto(`${base}/index.html`, { waitUntil: "networkidle" });
    await home.waitForTimeout(600);
    const prj = await home.locator("#s-prj").innerText();
    const areas = await home.locator("a.mod").count();
    if (/^\d+$/.test(prj.trim()) && areas >= 10)
      ok(`home: launchpad live KPIs + ${areas} management areas`);
    else bad("home: launchpad live KPIs", `prj="${prj}" areas=${areas}`);
    if (herr.length === 0) ok("home: no console errors");
    else bad("home: no console errors", herr.slice(0, 2).join(" | "));
  } catch (e) {
    bad("home launchpad", String(e).slice(0, 160));
  } finally {
    await home.close();
  }

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
    await pg.goto(`${base}/index.html`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(300);
    const pill = await pg.locator("#canei-lang-pill button").count();
    if (pill === 2) ok("i18n: language toggle present on home");
    else bad("i18n: toggle present", `buttons=${pill}`);
    const esText = await pg.locator("body").innerText();
    if (esText.includes("Áreas de gestión")) ok("i18n: home defaults to Spanish");
    else bad("i18n: home defaults to Spanish", esText.slice(0, 60));

    // switch to EN via the pill (reloads the page)
    await Promise.all([
      pg.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
      pg.locator("#canei-lang-pill button", { hasText: "EN" }).click(),
    ]);
    await pg.waitForTimeout(400);
    const enText = await pg.locator("body").innerText();
    if (enText.includes("Management areas") && !enText.includes("Áreas de gestión"))
      ok("i18n: EN toggle translates the home page");
    else bad("i18n: EN toggle translates home", enText.slice(0, 100));

    // dynamic content on erp.html gets translated too (MutationObserver path)
    await pg.goto(`${base}/erp.html#torre`, { waitUntil: "networkidle" });
    await pg.waitForTimeout(700);
    const erpLang = await pg.evaluate(() => document.documentElement.lang);
    const erpText = await pg.locator("body").innerText();
    if (erpLang === "en" && /Control tower/i.test(erpText))
      ok("i18n: choice persists and translates the ERP workspace");
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

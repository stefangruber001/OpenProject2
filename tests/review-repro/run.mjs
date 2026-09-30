/**
 * WHAT THE REVIEWER SAW, REPRODUCED.
 *
 * App Review rejected 1.1 (15) under 2.1(a): "The app did not load content on
 * any tab", on an iPad Air 11-inch with a working connection. The operator
 * opened the same address in a browser and it worked. Nothing in this
 * repository could tell those two apart, because nothing had ever loaded the
 * app's OWN url the way the app loads it.
 *
 * The app is a WKWebView shell, and it does three things a browser does not:
 *
 *   1. it loads `/workspace/erp.html#<section>`, not `/`;
 *   2. it appends `CaneiApp/` to the user agent, WHICH THE WEB APP READS — the
 *      page stands its own navigation down inside the shell, because the native
 *      tab bar is supposed to be doing that job;
 *   3. it sets `window.__caneiTabs` and an `html.native-app` class, and injects
 *      CSS that hides the page's header.
 *
 * Any of those can turn a page that is perfect in a browser into a blank one in
 * the app, and all three are invisible to every other test here. So this drives
 * a real browser with the shell's exact user agent, at the reviewer's iPad size,
 * signs in with the demo account, opens every tab the manifest declares, and
 * reports what is actually painted — plus every console error and failed
 * request, which is where a blank screen explains itself.
 *
 * Run:  node tests/review-repro/run.mjs
 * Env:  ERP_BASE_URL (default: production), ERP_USER, ERP_PASSWORD
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "tests", "review-repro", "shots");

const BASE = (process.env.ERP_BASE_URL || "https://178-105-10-156.sslip.io").replace(/\/$/, "");
const USER = process.env.ERP_USER || "";
const PASS = process.env.ERP_PASSWORD || "";

/** The shell's user agent marker, copied from ios/CaneiSubirats/Support/Config.swift. */
const UA_MARKER = "CaneiApp/1.1 (iOS; native-shell)";
/** A real iPadOS Safari UA, since that is what WKWebView sends underneath. */
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/** The tabs, read from the same manifest the app ships. */
function tabs() {
  const p = join(ROOT, "apps", "web", "public", "workspace", "nav.json");
  if (!existsSync(p)) return [{ id: "tower", path: "erp.html#tower" }];
  const j = JSON.parse(readFileSync(p, "utf8"));
  return (j.tabs || []).map((t) => ({ id: t.id, path: t.path }));
}

/* Playwright is declared in apps/web, not at the root, and pnpm puts it under a
   version-stamped directory — so neither a bare import from here nor a pinned
   path is reliable. Look for whatever is actually installed. Leaving the
   browser path undefined is deliberate: Playwright then finds the browser it
   installed itself, which is what CI has. */
const CHROME =
  process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => existsSync(p)) ||
  undefined;

async function loadChromium() {
  const pnpmDir = join(ROOT, "node_modules", ".pnpm");
  const stamped = existsSync(pnpmDir)
    ? (await import("node:fs"))
        .readdirSync(pnpmDir)
        .filter((d) => d.startsWith("playwright-core@"))
        .map((d) => join(pnpmDir, d, "node_modules", "playwright-core", "index.js"))
    : [];
  const candidates = [
    ...stamped,
    join(ROOT, "apps", "web", "node_modules", "playwright-core", "index.js"),
    join(ROOT, "node_modules", "playwright-core", "index.js"),
    "playwright-core",
    "playwright",
  ];
  for (const spec of candidates) {
    try {
      const m = await import(spec.startsWith("/") ? `file://${spec}` : spec);
      const c = (m.default || m).chromium;
      if (c) return c;
    } catch {}
  }
  throw new Error("playwright-core not found (run `pnpm install`)");
}

/* How much of the page is actually THERE. A shell that loads its HTML and then
   paints nothing still returns 200 and still has a <body>; what it does not
   have is text on the screen and a node tree of any size. Both are measured,
   because a page can have one without the other — an empty scaffold has nodes
   and no words, a page of error text has words and almost no nodes. */
const measure = (pg) =>
  pg.evaluate(() => {
    const body = document.body;
    const text = (body?.innerText || "").trim();
    return {
      nodes: body ? body.querySelectorAll("*").length : 0,
      chars: text.length,
      sample: text.slice(0, 120).replace(/\s+/g, " "),
      nativeClass: document.documentElement.classList.contains("native-app"),
      url: location.href,
    };
  });

const main = async () => {
  mkdirSync(OUT, { recursive: true });
  const chromium = await loadChromium();
  const browser = await chromium.launch({ executablePath: CHROME });

  const failures = [];
  let worst = 0;

  // The reviewer's device, and the shell's user agent. iPad Air 11-inch is
  // 820 × 1180 points.
  const ctx = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    userAgent: `${IPAD_UA} ${UA_MARKER}`,
    ignoreHTTPSErrors: false,
  });
  // The shell injects these before first paint; without them this would be
  // testing a browser, which is the thing that already works.
  await ctx.addInitScript(`
    document.documentElement.classList.add('native-app');
    window.__caneiTabs = 6;
  `);

  const console_ = [];
  const netFails = [];
  ctx.on("console", (m) => {
    if (m.type() === "error") console_.push(m.text().slice(0, 200));
  });
  ctx.on("requestfailed", (r) =>
    netFails.push(`${r.failure()?.errorText || "failed"} ${r.url().slice(0, 120)}`),
  );
  ctx.on("response", (r) => {
    if (r.status() >= 400) netFails.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`);
  });

  // ---- sign in, the way a reviewer would
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/workspace/erp.html`, { waitUntil: "networkidle", timeout: 60000 });
  await pg.waitForTimeout(1500);
  const landed = await measure(pg);
  console.log(`\nfirst load → ${landed.url}`);
  console.log(`  nodes=${landed.nodes} chars=${landed.chars} native-app=${landed.nativeClass}`);
  console.log(`  "${landed.sample}"`);
  await pg.screenshot({ path: join(OUT, "01-first-load.png"), fullPage: false });

  if (/\/login/.test(landed.url)) {
    if (!USER || !PASS) {
      console.log("\n  ! ERP_USER / ERP_PASSWORD not set — cannot go past the login page.");
    } else {
      // Field names are not guessed: whatever the form declares is what is used.
      const filled = await pg.evaluate(
        ([u, p]) => {
          const f = document.querySelector("form");
          if (!f) return false;
          const email = f.querySelector(
            'input[type="email"], input[name*="mail" i], input[name="user"]',
          );
          const pass = f.querySelector('input[type="password"]');
          if (!email || !pass) return false;
          const set = (el, v) => {
            const proto = Object.getPrototypeOf(el);
            Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
            el.dispatchEvent(new Event("input", { bubbles: true }));
          };
          set(email, u);
          set(pass, p);
          return true;
        },
        [USER, PASS],
      );
      if (!filled) {
        console.log("  ! could not find the sign-in fields on the login page");
      } else {
        await Promise.all([
          pg.waitForNavigation({ waitUntil: "networkidle", timeout: 60000 }).catch(() => {}),
          pg.evaluate(() => document.querySelector("form")?.requestSubmit()),
        ]);
        await pg.waitForTimeout(2000);
        const after = await measure(pg);
        console.log(`  signed in → ${after.url} (nodes=${after.nodes} chars=${after.chars})`);
        await pg.screenshot({ path: join(OUT, "02-after-login.png") });
        if (/\/login/.test(after.url)) failures.push("sign-in did not leave the login page");
      }
    }
  }

  // ---- every tab, exactly as the shell opens them
  for (const t of tabs()) {
    const url = `${BASE}/workspace/${t.path}`;
    await pg.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
    // The shell is client-rendered and then re-labelled by the i18n layer.
    await pg.waitForTimeout(2600);
    const m = await measure(pg);
    worst = Math.max(worst, m.chars);
    const ok = m.chars > 120 && m.nodes > 60;
    console.log(
      `${ok ? "  ok " : "  ✗  "}${t.id.padEnd(14)} nodes=${String(m.nodes).padEnd(5)} chars=${String(m.chars).padEnd(6)} "${m.sample}"`,
    );
    await pg.screenshot({ path: join(OUT, `tab-${t.id}.png`) });
    if (!ok) failures.push(`${t.id}: painted ${m.chars} characters over ${m.nodes} nodes — blank`);
  }

  await browser.close();

  if (console_.length) {
    console.log(`\nconsole errors (${console_.length}):`);
    [...new Set(console_)].slice(0, 15).forEach((e) => console.log(`  ${e}`));
  }
  if (netFails.length) {
    console.log(`\nfailed requests (${netFails.length}):`);
    [...new Set(netFails)].slice(0, 20).forEach((e) => console.log(`  ${e}`));
  }

  console.log(
    `\n──── ${failures.length ? `${failures.length} PROBLEM(S)` : "every tab painted"} ────`,
  );
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(failures.length ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

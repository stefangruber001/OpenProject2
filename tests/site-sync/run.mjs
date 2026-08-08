/**
 * Drives the REAL site/erp-sync.js in a real browser against a stub server.
 *
 * The decision this module makes is the whole point of it, and it is a decision
 * about somebody's half-typed work: refresh the page, or offer to. So the tests
 * are about that fork, not about whether fetch works.
 */
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = join(ROOT, "site");
const { chromium } = await import(
  join(ROOT, "node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs")
);
// Same rule as tests/site-e2e/run.mjs: an explicit path, else the sandbox
// browser, else let Playwright find the one CI installed.
const EXEC =
  process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => existsSync(p)) ||
  undefined;

let serverVersion = 5;
let probes = 0;

const HARNESS = `<!doctype html><html><head><meta name="erp-api" content="" />
<title>sync harness</title></head><body>
<input id="field" />
<div class="drawer" id="drawer"></div>
<script src="/erp-sync.js"></script>
<script>
  window.__changes = [];
  window.__mine = 5;
  ErpSync.watch("state", function(){ return window.__mine; }, function(v, info){
    window.__changes.push({v: v, returning: info.returning});
    ErpSync.react(info);            // the real default reaction
  });
</script></body></html>`;

/** Same page, but with no marker — the published read-only copy. */
const LOCAL_HARNESS = HARNESS.replace('<meta name="erp-api" content="" />', "");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (code, body, type = "application/json") => {
    res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };
  if (url.pathname === "/api/~/erp/version") {
    probes += 1;
    return send(200, { tenant: "t", versions: { state: serverVersion } });
  }
  if (url.pathname === "/harness.html") return send(200, HARNESS, "text/html");
  if (url.pathname === "/local.html") return send(200, LOCAL_HARNESS, "text/html");
  try {
    const body = await readFile(join(SITE, url.pathname.replace(/^\//, "")), "utf8");
    return send(200, body, url.pathname.endsWith(".js") ? "text/javascript" : "text/html");
  } catch {
    return send(404, { error: "not found" });
  }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });

/** Open the harness and count how many times it navigates (a reload is one). */
async function openHarness(path = "/harness.html") {
  const page = await browser.newPage();
  page.navigations = 0;
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) page.navigations += 1;
  });
  page.on("pageerror", (e) => console.log("   [pageerror] " + e.message));
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  page.navigations = 0; // the initial load is not a reload
  // PRECONDITION. Every "nothing happened" assertion below is also what a
  // script that failed to load looks like. Prove it loaded first.
  const loaded = await page.evaluate(() => typeof ErpSync === "object" && !!ErpSync.watch);
  if (!loaded) throw new Error(`ErpSync did not load on ${path} — every test below would lie`);
  return page;
}

/** Simulate leaving the page and coming back after more than the 1.5s window. */
async function leaveAndReturn(page, awayMs = 1800) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(awayMs);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

// ---------------------------------------------------------------------------
// 1. Unchanged server → nothing happens at all.
// ---------------------------------------------------------------------------
{
  serverVersion = 5;
  const page = await openHarness();
  await leaveAndReturn(page);
  await page.waitForTimeout(600);
  const changes = await page.evaluate(() => window.__changes.length);
  check(
    "server at the same version: no refresh, no notice",
    changes === 0 && page.navigations === 0,
  );
  await page.close();
}

// ---------------------------------------------------------------------------
// 2. THE REPORTED BUG. Changed while away, page idle → refreshes itself.
// ---------------------------------------------------------------------------
{
  serverVersion = 5;
  const page = await openHarness();
  serverVersion = 6; // somebody saved on the phone
  await leaveAndReturn(page);
  await page.waitForTimeout(900);
  check(
    "changed while away, nothing in progress: the page refreshes itself",
    page.navigations === 1,
    `${page.navigations} navigation(s)`,
  );
  await page.close();
}

// ---------------------------------------------------------------------------
// 3. Same, but the operator is typing → must NOT reload. Offer instead.
// ---------------------------------------------------------------------------
{
  serverVersion = 5;
  const page = await openHarness();
  await page.focus("#field");
  await page.type("#field", "Calle Mayor 14");
  serverVersion = 6;
  await leaveAndReturn(page);
  await page.waitForTimeout(900);
  const kept = await page.inputValue("#field");
  const pill = await page.evaluate(() => !!document.getElementById("canei-stale"));
  check(
    "changed while away, cursor in a field: offers, never reloads",
    page.navigations === 0 && pill && kept === "Calle Mayor 14",
    `navs=${page.navigations} pill=${pill} kept="${kept}"`,
  );
  await page.close();
}

// ---------------------------------------------------------------------------
// 4. An open drawer counts as work in progress even with nothing focused.
// ---------------------------------------------------------------------------
{
  serverVersion = 5;
  const page = await openHarness();
  await page.evaluate(() => document.getElementById("drawer").classList.add("on"));
  serverVersion = 6;
  await leaveAndReturn(page);
  await page.waitForTimeout(900);
  const pill = await page.evaluate(() => !!document.getElementById("canei-stale"));
  check("open drawer: offers, never reloads", page.navigations === 0 && pill);
  await page.close();
}

// ---------------------------------------------------------------------------
// 5. A change arriving while you are LOOKING at the page never reloads it,
//    idle or not — you did not ask to go anywhere.
// ---------------------------------------------------------------------------
{
  serverVersion = 5;
  const page = await openHarness();
  serverVersion = 7;
  await page.evaluate(() => ErpSync.check()); // a poll tick, page visible
  await page.waitForTimeout(500);
  const pill = await page.evaluate(() => !!document.getElementById("canei-stale"));
  check("change while the page is in front: offers, never reloads", page.navigations === 0 && pill);
  await page.close();
}

// ---------------------------------------------------------------------------
// 5b. Dismissing the bar must silence THAT news, not all future news. A page
//     that stops warning you it is stale is worse than one that never did.
// ---------------------------------------------------------------------------
{
  serverVersion = 5;
  const page = await openHarness();

  serverVersion = 6;
  await page.evaluate(() => ErpSync.check());
  await page.waitForTimeout(400);
  const first = await page.evaluate(() => !!document.getElementById("canei-stale"));

  await page.click("#canei-stale button[aria-label='Descartar']");
  await page.waitForTimeout(150);
  const gone = await page.evaluate(() => !!document.getElementById("canei-stale"));

  // The SAME version again — already said, stays quiet.
  await page.evaluate(() => ErpSync.check());
  await page.waitForTimeout(400);
  const quiet = await page.evaluate(() => !!document.getElementById("canei-stale"));

  // A NEWER version — new news, said again.
  serverVersion = 7;
  await page.evaluate(() => ErpSync.check());
  await page.waitForTimeout(400);
  const again = await page.evaluate(() => !!document.getElementById("canei-stale"));

  check(
    "dismissed: quiet about the same version, speaks up about the next one",
    first && !gone && !quiet && again,
    `first=${first} gone=${!gone} quiet=${!quiet} again=${again}`,
  );
  await page.close();
}

// ---------------------------------------------------------------------------
// 6. A server version BEHIND ours is our own unread save, not news.
// ---------------------------------------------------------------------------
{
  serverVersion = 5;
  const page = await openHarness();
  await page.evaluate(() => {
    window.__mine = 9;
  });
  await leaveAndReturn(page);
  await page.waitForTimeout(600);
  const changes = await page.evaluate(() => window.__changes.length);
  check("server behind us: not reported as a change", changes === 0 && page.navigations === 0);
  await page.close();
}

// ---------------------------------------------------------------------------
// 7. No marker = no server = never talks to one. The published copies must
//    keep working exactly as before.
// ---------------------------------------------------------------------------
{
  const before = probes;
  const page = await openHarness("/local.html");
  await leaveAndReturn(page);
  await page.waitForTimeout(600);
  const remote = await page.evaluate(() => ErpSync.isRemote());
  check("no marker: local mode, and not one request made", remote === false && probes === before);
  await page.close();
}

// ---------------------------------------------------------------------------
// 8. The real pages register a watcher. This is the wiring that makes any of
//    the above reach the operator.
// ---------------------------------------------------------------------------
for (const [page_, expect] of [
  ["master-data.html", "caneiMasterData"],
  ["financial-data.html", "caneiFinance"],
]) {
  const html = await readFile(join(SITE, page_), "utf8");
  const ordered =
    html.indexOf("erp-sync.js") > 0 && html.indexOf("erp-sync.js") < html.indexOf("erp-docs.js");
  check(`${page_}: loads erp-sync.js before erp-docs.js`, ordered);
  void expect;
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);

/**
 * App Store screenshots, from the workspace the app actually shows.
 *
 * WHAT THESE ARE. The iOS app is a shell around this web workspace, so the
 * pixels below are the app's own interface — captured in the same browser
 * engine (WebKit's cousin here, Chromium; the layout is the design system's,
 * not the engine's) at the exact size Apple asks for. What they do NOT show is
 * the native tab bar the shell draws at the bottom, because that belongs to the
 * shell and not to the page.
 *
 * That is a fair representation and Apple accepts screenshots of the app's real
 * UI. If you would rather have true in-app captures, take them on a device from
 * TestFlight and overwrite these files — the names sort in display order, which
 * is the only thing `deliver` cares about.
 *
 * SIZES. Two, because the app ships for two device families.
 *
 *   1320 × 2868 — 6.9-inch iPhone. A 440 × 956 viewport at scale 3.
 *   2048 × 2732 — 13-inch iPad.    A 1024 × 1366 viewport at scale 2.
 *
 * THE IPAD ONES ARE NOT OPTIONAL, and their absence is invisible until Apple
 * says so. `TARGETED_DEVICE_FAMILY = "1,2"` in the Xcode project offers the app
 * on iPad, and App Store Connect then refuses the submission until the iPad
 * slot has pictures in it. Nothing in the repository failed, nothing went red:
 * the listing simply could not be submitted, which is a review slot spent on
 * finding out. tests/app-store/run.mjs now reads the device family out of the
 * project and fails if the pictures do not match it, so the two can no longer
 * drift apart.
 *
 * Of the two sizes Apple accepts for the 13-inch slot — 2064 × 2752 and
 * 2048 × 2732 — this uses the second. Both are accepted; the second has been
 * accepted for years and is the one `deliver` has mapped to the iPad slot for
 * just as long, and a listing is the wrong place to find out which of two
 * equally valid numbers a given fastlane release happens to know about.
 *
 * `deliver` sorts uploads by filename WITHIN a device, and works out the device
 * from the pixel size, so both sizes live in the same locale folder and the
 * numbered prefixes keep their order in each.
 *
 * Run:  node scripts/app-store-shots.mjs
 * Out:  ios/fastlane/screenshots/{en-US,en-GB,es-ES}/*.png
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import net from "node:net";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");
const OUT = join(ROOT, "ios", "fastlane", "screenshots");

const PW = resolve(
  ROOT,
  "node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js",
);
const CHROME =
  process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => existsSync(p)) ||
  undefined;

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

/* The five screens that say what the product is, in the order somebody meets
   them: what the owner sees, where a job stands, the work itself, the hours,
   and the money. Numbered because `deliver` uploads them in filename order. */
/* THE FURTHEST-ALONG JOB, NOT THE FIRST ONE.
   The register is sorted by code, and the first row happened to be an enquiry
   with nothing in it yet — so the screenshot said "Not a job yet", "No visit on
   file", "1 entries". True, and the worst possible advertisement: a listing
   picture should show the product doing its job, and this one showed the empty
   state. Picking the row whose phase number is highest lands on a job that has
   been quoted, contracted, built and invoiced, which is what the thirteen
   stages are for. */
const openBestJourney = async (pg) => {
  const best = await pg.evaluate(() => {
    const rows = [...document.querySelectorAll("tr.click[data-id]")];
    let at = -1;
    let id = null;
    for (const tr of rows) {
      const n = Number((tr.querySelector(".jminil span") || {}).textContent || 0);
      if (n > at) {
        at = n;
        id = tr.dataset.id;
      }
    }
    return id;
  });
  if (best) await pg.locator(`tr.click[data-id="${best}"]`).click();
};

const SHOTS = [
  ["01-tower", "tower", null],
  ["02-journey", "journey", openBestJourney],
  ["03-progress", "progress", null],
  ["04-hours", "labour", null],
  ["05-invoicing", "invoicing", null],
];

/* en-GB is here because the listing has an en-GB locale. It used to be a hand
   copy of en-US, which is fine on the day it is made and wrong on the first day
   somebody regenerates the other two and not this one. A locale the listing
   carries is a locale this script writes. */
const LANGS = [
  ["en-US", "en"],
  ["en-GB", "en"],
  ["es-ES", "es"],
];

/* Prefix, viewport, scale. The prefix keeps the two families apart in the
   folder AND keeps each family's own numbering contiguous, which is what
   `deliver` orders by. */
const DEVICES = [
  ["iphone", { width: 440, height: 956 }, 3],
  ["ipad", { width: 1024, height: 1366 }, 2],
];

const port = await new Promise((r) => {
  const s = net.createServer();
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => r(p));
  });
});
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

const chromium = await loadChromium();
const browser = await chromium.launch({ executablePath: CHROME });

for (const [locale, lang] of LANGS) {
  const dir = join(OUT, locale);
  mkdirSync(dir, { recursive: true });
  for (const [prefix, viewport, deviceScaleFactor] of DEVICES) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor });
    await ctx.addInitScript(
      `try { localStorage.setItem("caneiLang", ${JSON.stringify(lang)}); } catch (e) {}`,
    );
    for (const [name, route, prep] of SHOTS) {
      const pg = await ctx.newPage();
      await pg.goto(`${base}/erp.html#${route}`, { waitUntil: "networkidle" });
      // The workspace renders its first screen from JS and then the i18n layer
      // rewrites it; a capture taken before both have settled shows a half-built
      // screen, which is exactly the sort of thing that gets a listing rejected.
      await pg.waitForTimeout(2600);
      if (prep) {
        try {
          await prep(pg);
          await pg.waitForTimeout(1600);
        } catch {
          /* A screen whose sample data does not offer the row this wanted still
           makes a perfectly good screenshot of that screen. */
        }
        /* Back to the top. Opening a row keeps the scroll position of the list it
         was clicked in, which put the capture halfway down the page — a picture
         that starts mid-row reads as a broken screen, whatever is in it. */
        await pg.evaluate(() => window.scrollTo(0, 0));
        await pg.waitForTimeout(500);
      }
      const file = `${prefix}-${name}.png`;
      await pg.screenshot({ path: join(dir, file) });
      console.log(`${locale}/${file}`);
      await pg.close();
    }
    await ctx.close();
  }
}

await browser.close();
server.kill();

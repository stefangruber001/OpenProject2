/**
 * The iOS tab-route guard.
 *
 *   node tests/ios-routes/coverage.mjs
 *
 * WHAT WAS WRONG. The app is a native shell around the web app: six tabs, each
 * one a URL. In 1.1 those tabs moved from standalone pages to the ERP shell's
 * own sections, addressed by fragment — `erp.html#tower`. `WebTab.url` built
 * that URL with `appendingPathComponent`, which treats its argument as ONE path
 * segment and therefore percent-encodes the `#`:
 *
 *     what shipped   /workspace/erp.html%23tower   → 404
 *     what was meant /workspace/erp.html           → 200, shell opens #tower
 *
 * Five of six tabs answered 404 against a completely healthy server. Guide was
 * the survivor for the only reason that mattered: it is the one path with no
 * `#` in it, so there was nothing to encode. That is the shape of this bug —
 * it hides until a `#` appears, and then it hides again behind a server that
 * looks broken.
 *
 * WHY THIS GUARD IS IN NODE. The Xcode project builds on a macOS runner, and a
 * test that only runs there is a test that runs after the decision to ship. All
 * three things that can break a tab are readable as text — the paths, the file
 * they name, the fragment the shell must know — so they are checked here, on
 * every push, next to the site they point at.
 *
 * WHAT IT CHECKS.
 *   1. Every `Config.tabs` path names a file that exists in `site/`.
 *   2. Every fragment is a route key the ERP shell actually declares, so a tab
 *      cannot point at a section that was renamed out from under it.
 *   3. `WebTab.swift` resolves its URL as a URL and NOT with
 *      `appendingPathComponent` — the specific call that caused this.
 *
 * WHAT IT DOES NOT CHECK. Whether the page renders. That is what the site e2e
 * suite is for; this is about whether the app asks for the right address.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

const checks = [];
const assert = (cond, name, detail) =>
  checks.push({ name, pass: !!cond, detail: cond ? "" : String(detail ?? "") });

/* ------------------------------------------------------------ the tab list */
/* READ FROM `nav.json`, WHICH IS WHERE THE TABS NOW LIVE.
   This used to grep `path: "…"` out of Config.swift. Then the tab bar was
   moved onto the generated manifest so the app, Android and the web could stop
   carrying three different sets of labels — and the regex kept matching
   nothing. Zero paths meant zero tabs to check, so checks 1 and 2 iterated an
   empty list and passed, and only the count assertion noticed. A gate pointed
   at a file the feature has left is worse than no gate: it reports on
   something that is not there. Both ends are pinned below. */
const config = read("ios/CaneiSubirats/Support/Config.swift");
assert(
  /static let tabs:\s*\[WebTab\]\s*=\s*NavManifest\.load\((role: erpRole)?\)/.test(config),
  "Config.tabs is still loaded from the generated manifest",
  "if the tabs move back into Swift, this gate is reading the wrong file again",
);

const manifest = JSON.parse(read("ios/CaneiSubirats/Resources/nav.json"));
/* Role bars count as tabs. A site worker's bar is one entry pointing at the
   hours screen, and a route renamed out from under it is the same blank screen
   the six-tab bar would give — so it is checked in the same list. */
const roleTabPaths = Object.values(manifest.roleTabs || {})
  .flat()
  .map((t) => t.path)
  .filter(Boolean);
const paths = [...(manifest.tabs || []).map((t) => t.path).filter(Boolean), ...roleTabPaths];

assert(paths.length >= 5, `nav.json declares its tab paths (${paths.length} found)`, paths.length);

/* ------------------------------------------- the shell's own section keys */
// The ERP shell declares its sections and subsections as `k: "<key>"`. A
// fragment is one of those keys; anything else opens the shell on a route it
// does not recognise, which is a blank screen rather than a 404 — quieter and
// therefore worse.
const erp = read("site/erp.html");
const routeKeys = new Set([...erp.matchAll(/\bk:\s*"([a-zA-Z0-9_-]+)"/g)].map((m) => m[1]));
assert(routeKeys.size > 20, `the shell declares its route keys (${routeKeys.size} found)`, [
  ...routeKeys,
]);

/* -------------------------------------------------- 1 + 2: every tab resolves */
const missingFiles = [];
const unknownFragments = [];
for (const p of paths) {
  const [file, fragment] = p.split("#");
  if (!existsSync(resolve(ROOT, "site", file))) missingFiles.push(p);
  if (fragment && !routeKeys.has(fragment)) unknownFragments.push(p);
}

assert(
  missingFiles.length === 0,
  "every tab path names a page that exists in site/",
  missingFiles.join(", "),
);
assert(
  unknownFragments.length === 0,
  "every tab fragment is a route the shell declares",
  unknownFragments.join(", "),
);

/* ------------------------------------------ 3: the URL is built as a URL */
const webTab = read("ios/CaneiSubirats/Web/WebTab.swift");
// Comments in that file necessarily NAME the broken call in order to explain
// it, so the check is on code: the call as it would actually be written.
const code = webTab
  .split("\n")
  .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("///"))
  .join("\n");

assert(
  !/appendingPathComponent\s*\(\s*path\s*\)/.test(code),
  "WebTab does not build its URL with appendingPathComponent(path)",
  "appendingPathComponent percent-encodes '#' into %23 — every tab with a fragment 404s",
);
assert(
  /URL\s*\(\s*string:\s*path\s*,\s*relativeTo:/.test(code),
  "WebTab resolves its path against the base as a URL",
  "expected URL(string: path, relativeTo: Config.baseURL)",
);

/* ----------------------------------------------------------------- report */
console.log("──── iOS tab routes ────");
for (const p of paths) {
  const [file, fragment] = p.split("#");
  console.log(`  ${p.padEnd(24)} → site/${file}${fragment ? `  (opens #${fragment})` : ""}`);
}

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} iOS route checks passed`);
process.exit(failed.length ? 1 : 0);

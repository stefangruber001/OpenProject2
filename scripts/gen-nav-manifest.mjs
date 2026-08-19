/**
 * Generate `site/nav.json` — the one place the app shells get their tab labels.
 *
 *   node scripts/gen-nav-manifest.mjs [--check]
 *
 * WHY THIS EXISTS. There were THREE navigation label sets and only one of them
 * could translate:
 *
 *   web (erp.html SECTIONS)  Torre de control · Comercial · Proyectos …
 *   iOS  (Config.swift)      Tower · Sales · Projects …        hardcoded English
 *   Android (MainActivity)   Torre · Comercial · Proyectos …   hardcoded Spanish
 *
 * `i18n.js` runs inside the web view and cannot reach a native tab bar, and the
 * iOS project has no localisation files at all — so the phone showed "Sales"
 * over a page whose own breadcrumb said "Commercial", and would have shown
 * "Sales" on a Spanish device too. Three lists, two of them untranslatable,
 * nothing forcing any of them to agree.
 *
 * So the shells stop carrying labels. `SECTIONS` in erp.html stays the single
 * source of what the sections are called; this script reads it, resolves each
 * label through the same dictionary the web uses, and writes all three
 * languages into a manifest the shells load at runtime. Rename a section once
 * and every surface follows.
 *
 * WHY GENERATED AND COMMITTED rather than built on the fly: the shells fetch it
 * from the server, and a file that is generated at request time is a file no
 * test has ever read. Committed means CI can diff it — `--check` regenerates
 * and fails if the working copy differs, which is the same guard the capability
 * bundle uses.
 *
 * WHY NOT PARAMETRIZE THE OLD ARRANGEMENT: a repo variable or a second list
 * with a lint rule is still two sources with something in between promising
 * they match. That promise is exactly what failed here, and what failed with
 * the /preview branch name.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = resolve(ROOT, "site");
/**
 * Every place the manifest has to exist, written from the SAME generation.
 *
 * The web serves it; the two shells bundle it, because a tab bar is drawn
 * before any request completes. These are copies of one artifact, not three
 * sources: nothing hand-edits them, one script writes all three, and `--check`
 * fails if any differs. A copy somebody could edit is exactly what this whole
 * change exists to remove.
 */
const OUTPUTS = [
  resolve(SITE, "nav.json"),
  resolve(ROOT, "ios/CaneiSubirats/Resources/nav.json"),
  resolve(ROOT, "android/app/src/main/assets/nav.json"),
  // The workspace mirror was byte-identical but written by nobody — the one
  // copy that could drift because it was outside this list. Now it cannot.
  resolve(ROOT, "apps/web/public/workspace/nav.json"),
];

/**
 * The tabs the app shells show, in order, by ROUTE KEY.
 *
 * This is the one thing the manifest adds rather than reads: which of the
 * twenty-nine screens deserve a tab is a decision about the phone, not about
 * the ERP. Every key is checked against SECTIONS below, so renaming a route
 * without updating this fails the build instead of shipping a dead tab.
 *
 * `icon` is an SF Symbol on iOS; Android maps it to its own drawable. Names,
 * not images, so one list serves both.
 */
const TABS = [
  { section: "tower", icon: "chart.bar.xaxis.ascending" },
  { section: "sales", icon: "person.2.fill" },
  { section: "projects", icon: "square.stack.3d.up.fill" },
  { section: "admin", icon: "eurosign.circle.fill" },
  { section: "master-data", icon: "square.grid.2x2.fill" },
  { section: "settings", icon: "gearshape.fill" },
];

/* ---- read SECTIONS out of the workspace ---------------------------------- */
const html = readFileSync(resolve(SITE, "erp.html"), "utf8");
const start = html.indexOf("const SECTIONS = [");
if (start < 0) throw new Error("SECTIONS not found in site/erp.html");
const block = html.slice(start, html.indexOf("\n      ];", start));

/**
 * Sections, each with its short label and its FIRST sub-route.
 *
 * The tab carries the SECTION's name, not the sub-screen's. That is the whole
 * point of the complaint that started this: the app said "Sales" while the page
 * it opened said "Commercial", because the tab was named after the business
 * function and the route it opened was the section's first screen. A tab bar
 * names places, and the place is the section.
 *
 * `short` is used because a tab bar has room for one word — it is the same
 * abbreviation the workspace's own collapsed nav shows, so the two agree.
 */
const sections = new Map();
for (const m of block.matchAll(
  /k: "([^"]+),?"?[\s\S]{0,40}?ic: "([^"]*)",\s*\n\s*lab: "([^"]+)",\s*\n\s*short: "([^"]+)",\s*\n\s*subs: \[\s*\n?\s*\{ k: "([^"]+)", lab: "([^"]+)", code: "([^"]+)"/g,
)) {
  sections.set(m[1], { lab: m[3], short: m[4], firstRoute: m[5], code: m[7] });
}
if (sections.size < 5) {
  throw new Error(`only ${sections.size} sections parsed from SECTIONS — the shape changed`);
}

/* ---- resolve each label through the same dictionary the web uses --------- */
const sandbox = { window: {} };
for (const f of ["i18n-dict.js", "i18n-dict-ca.js"]) {
  new Function("window", readFileSync(resolve(SITE, f), "utf8"))(sandbox.window);
}
const D = sandbox.window.CANEI_DICT || {};
const EN = new Map(D.pairs || []);
const CA = D.ca || {};

const missing = [];
const tabs = TABS.map((t) => {
  const found = sections.get(t.section);
  if (!found) {
    throw new Error(
      `tab points at section "${t.section}", which SECTIONS does not declare. ` +
        `Either the section was renamed or the tab is dead — fix TABS in this file. ` +
        `Known: ${[...sections.keys()].join(", ")}`,
    );
  }
  const es = found.short;
  const en = EN.get(es);
  const ca = CA[es];
  // A tab label with no translation would put the shell back where it started:
  // one language for everybody. Refuse rather than emit a Spanish fallback that
  // looks deliberate.
  if (!en) missing.push(`${t.section}: no English for "${es}"`);
  if (!ca) missing.push(`${t.section}: no Catalan for "${es}"`);
  return {
    id: t.section,
    code: found.code,
    path: `erp.html#${found.firstRoute}`,
    icon: t.icon,
    label: { es, en: en || es, ca: ca || es },
  };
});

if (missing.length) {
  console.error("FAIL: tab labels without a translation —");
  for (const m of missing) console.error("  " + m);
  console.error(
    "\nAdd them to site/i18n-dict.js and site/i18n-dict-ca.js. A shell cannot run\n" +
      "the dictionary, so a label missing here is a tab bar stuck in one language.",
  );
  process.exit(1);
}

const manifest = {
  $comment:
    "GENERATED by scripts/gen-nav-manifest.mjs from SECTIONS in site/erp.html. " +
    "Do not edit — run the script. The app shells read this so their tab bars " +
    "carry the same names as the web, in the same three languages.",
  version: 1,
  tabs,
};
const json = JSON.stringify(manifest, null, 2) + "\n";

if (process.argv.includes("--check")) {
  const stale = OUTPUTS.filter((f) => {
    try {
      return readFileSync(f, "utf8") !== json;
    } catch {
      return true; // absent counts as drift
    }
  });
  if (stale.length) {
    console.error("FAIL: the navigation manifest is out of date with SECTIONS in site/erp.html:");
    for (const f of stale) console.error("  " + f.replace(ROOT + "/", ""));
    console.error("\nRun `node scripts/gen-nav-manifest.mjs` and commit the result.");
    process.exit(1);
  }
  console.log(
    `navigation manifest matches SECTIONS — ${tabs.length} tabs, 3 languages, ` +
      `${OUTPUTS.length} copies identical.`,
  );
} else {
  for (const f of OUTPUTS) {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, json);
  }
  console.log(`wrote ${OUTPUTS.length} copies of the navigation manifest — ${tabs.length} tabs:`);
  for (const t of tabs)
    console.log(`  ${t.code.padEnd(8)} ${t.label.es} / ${t.label.ca} / ${t.label.en}`);
}

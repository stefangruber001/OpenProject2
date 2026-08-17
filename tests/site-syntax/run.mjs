/**
 * Every script in `site/` must parse.
 *
 * WHY THIS IS WORTH ITS OWN GATE. A stray backtick inside a template literal in
 * `erp-modal.js` — in a COMMENT, quoting a CSS property the way one does —
 * terminated the CSS string early and made the whole file a syntax error. That
 * file publishes `ask`, `askText`, `askChoice`, `askConfirm` and `say`: every
 * dialog on every page, gone, on four pages at once.
 *
 * Nothing pointed at it. The browser reports a parse failure to the console and
 * carries on with the module simply absent, so the symptoms were a catalogue
 * that rendered unstyled and a delete button that did nothing — two plausible
 * CSS and wiring bugs, in two different files, neither of them the cause. It
 * was caught four minutes into a browser run by a console-error check, which is
 * the right net but the wrong end of the day.
 *
 * `node --check` answers the same question in milliseconds. It parses as a
 * script (not a module), which is exactly how a <script src> tag loads these.
 *
 * WHAT IT DOES NOT DO: run anything. A file that parses can still be wrong;
 * that is what every other gate is for. This one only insists that the browser
 * will get as far as executing it.
 *
 * Run:  node tests/site-syntax/run.mjs
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = resolve(ROOT, "site");

function scripts(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) out.push(...scripts(p));
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

const files = scripts(SITE).sort();
const broken = [];
for (const f of files) {
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  if (r.status !== 0) {
    // The first line of node's report names the file; the useful part is the
    // message and the caret line under it.
    const detail = (r.stderr || "")
      .split("\n")
      .filter((l) => /Error|\^/.test(l))
      .slice(0, 2)
      .join(" ")
      .trim();
    broken.push(`${relative(ROOT, f)} — ${detail}`);
  }
}

console.log("──── site scripts parse ────");
if (broken.length) {
  for (const b of broken) console.log(`✗ ${b}`);
  console.log(`\n${broken.length} of ${files.length} scripts do not parse.`);
  process.exit(1);
}
// A run that found nothing to check would report success on an empty set.
if (files.length < 10) {
  console.error(`FAIL: only ${files.length} scripts found in site/ — this gate checked nothing.`);
  process.exit(1);
}
console.log(`all ${files.length} scripts in site/ parse`);

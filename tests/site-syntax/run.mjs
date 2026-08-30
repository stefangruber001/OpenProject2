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
 * AND THE INLINE ONES TOO. For a long time this gate read only `site/*.js`,
 * which left out the biggest script in the project: the ~23 000 lines inside
 * `<script>` in `erp.html`. A duplicate `let` in one scope there — two blocks
 * declaring the same name, which is how a rewritten screen ends up when the
 * old declaration survives — is a hard SyntaxError that voids the entire tag,
 * and this gate answered "all 28 scripts in site/ parse". It was true and
 * useless. Inline blocks are now extracted and checked as well, so the file
 * the operator actually looks at is inside the net the gate was written for.
 *
 * WHAT IT DOES NOT DO: run anything. A file that parses can still be wrong;
 * that is what every other gate is for. This one only insists that the browser
 * will get as far as executing it.
 *
 * Run:  node tests/site-syntax/run.mjs
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative, join } from "node:path";

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

/** Every HTML page in `site/`, for the scripts written inside them. */
function pages(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) out.push(...pages(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

/**
 * The inline `<script>` blocks of one page, written out for `node --check`.
 *
 * Only blocks that a browser would PARSE AS SCRIPT: one carrying a `src` is a
 * reference, not a body, and `type="module"`, JSON-LD or a template type is a
 * different grammar that would fail this check for no reason. Line numbers are
 * preserved by padding, so a failure points at the line of the page rather
 * than of the extract.
 */
const TAG = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
function inlineBlocks(file) {
  const html = readFileSync(file, "utf8");
  const out = [];
  for (const m of html.matchAll(TAG)) {
    const attrs = m[1] || "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs);
    if (type && !/^(text\/javascript|application\/javascript)$/i.test(type[1])) continue;
    const body = m[2];
    if (!body.trim()) continue;
    const before = html.slice(0, m.index + m[0].indexOf(body));
    out.push({ line: before.split("\n").length, body });
  }
  return out;
}

const files = scripts(SITE).sort();
const broken = [];
let inlineCount = 0;
const tmp = mkdtempSync(join(tmpdir(), "site-syntax-"));

for (const page of pages(SITE).sort()) {
  for (const block of inlineBlocks(page)) {
    inlineCount++;
    const f = join(tmp, relative(SITE, page).replace(/[\\/]/g, "_") + "." + block.line + ".js");
    // Padded so node's reported line number is the page's own.
    writeFileSync(f, "\n".repeat(block.line - 1) + block.body);
    const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
    if (r.status !== 0) {
      /* The MESSAGE first, then the line. Filtering for anything Error-ish and
         taking the first two lines picks up node's location header and the
         caret and drops the sentence saying what is actually wrong — which is
         the only part a person reading a red gate needs. */
      const err = (r.stderr || "").split("\n");
      const msg = (err.find((l) => /^\w*Error: /.test(l.trim())) || "").trim();
      const at = (
        err.find((l) => new RegExp(`${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\d+`).test(l)) ||
        ""
      )
        .trim()
        .replace(f, relative(ROOT, page));
      broken.push(
        `${relative(ROOT, page)} (inline block from line ${block.line}) — ${msg || "does not parse"}${at ? "  [" + at + "]" : ""}`,
      );
    }
  }
}

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
  console.log(`\n${broken.length} of ${files.length + inlineCount} scripts do not parse.`);
  process.exit(1);
}
// A run that found nothing to check would report success on an empty set.
if (files.length < 10) {
  console.error(`FAIL: only ${files.length} scripts found in site/ — this gate checked nothing.`);
  process.exit(1);
}
// The same guard for the inline half: erp.html alone carries one, so a zero
// here means the extraction stopped matching and the gate silently narrowed
// back to what it used to cover.
if (inlineCount < 1) {
  console.error("FAIL: no inline <script> blocks found in site/*.html — extraction is broken.");
  process.exit(1);
}
console.log(`all ${files.length} scripts and ${inlineCount} inline blocks in site/ parse`);

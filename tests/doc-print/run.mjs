/**
 * The documents must be printable.
 *
 * The complaint this exists for, in the operator's words: "the page break looks
 * very bad, not enough space between text and page edge, which will not be able
 * to print." Measured, that was ink 0.8mm from the paper edge on every
 * continuation page — inside the unprintable border of any consumer printer, so
 * it would have been clipped on paper no matter how it looked on screen.
 *
 * The cause was structural and worth naming: the page margins lived in
 * `.sheet { padding }` while `@page` had `margin: 0`. Padding applies ONCE to
 * an element, so page one looked correct and every page after it began hard
 * against the edge. Margins belong on `@page`, which the printer applies to
 * each sheet.
 *
 * This gate renders every template and fails if any ink lands within 9.5mm of
 * the paper edge, on any page.
 *
 * Run:  node tests/doc-print/run.mjs
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const DOCS = resolve(ROOT, "site/documentos");
const OUT = resolve(ROOT, "dist/doc-print-check");

if (!fs.existsSync(DOCS)) {
  console.error("site/documentos is missing — nothing to check");
  process.exit(1);
}

const node = (args) => spawnSync(process.execPath, args, { stdio: "inherit", cwd: ROOT });
fs.rmSync(OUT, { recursive: true, force: true });

const rendered = node([resolve(__dirname, "render.mjs"), DOCS, OUT]);
if (rendered.status !== 0) process.exit(rendered.status ?? 1);

const margins = node([resolve(__dirname, "margins.mjs"), OUT, "9.5"]);
if (margins.status !== 0) process.exit(margins.status ?? 1);

// The ceiling is the CI runner's count, not this machine's — its Chromium
// places glyphs differently and is the stricter of the two. Overridable so the
// number lives in one place when CI calls it directly.
// Was 8 while Chromium was splitting headings a glyph at a time. All 21
// documents are searchable as of 2026-08-16, so the ceiling comes down to
// where it belongs; a regression now fails instead of fitting in a budget.
const MAX = process.env.SEARCHABLE_MAX || "0";
const searchable = node([resolve(__dirname, "searchable.mjs"), OUT, "--max", MAX]);
process.exit(searchable.status ?? 1);

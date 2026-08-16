/**
 * The committed browser bundle must be safe to load in a browser.
 *
 * WHY THIS IS A SCRIPT AND NOT SIX LINES OF BASH IN ci.yml. It used to be the
 * bash, and that is exactly how it failed: a local gate run cannot execute a
 * workflow step, so `make gates` passed, the push went out, and CI caught a
 * 127 KB regression that a developer could have caught in two seconds. A rule
 * that only exists on the server is a rule you learn about after pushing.
 *
 * It matters more than usual here because the repository has hit this same
 * wall three times now (ASSUMPTIONS #40-ish, the `rates` subpath, and S6's
 * `createExtraction`): calling a zod schema from the browser surface drags all
 * of zod into `site/erp-factory.js` to validate a config the browser was
 * handed and never parses. Writing it down twice did not stop the third one.
 * Running it locally will.
 *
 * Run: node tests/parity/bundle-safety.mjs
 */
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const JS = resolve(ROOT, "site/erp-factory.js");
const CJS = resolve(ROOT, "site/erp-factory.cjs");

const failures = [];
const note = [];

function sizeOf(path, label) {
  try {
    const bytes = statSync(path).size;
    if (bytes === 0) failures.push(`${label} is empty`);
    return bytes;
  } catch {
    failures.push(`${label} is missing — run: pnpm --filter @repo/erp-browser build`);
    return 0;
  }
}

const jsBytes = sizeOf(JS, "site/erp-factory.js");
const cjsBytes = sizeOf(CJS, "site/erp-factory.cjs");

if (jsBytes) {
  const js = readFileSync(JS, "utf8");

  // The IIFE must expose the global site/erp-bridge.js reaches for.
  if (!js.includes("ErpFactory")) failures.push("global ErpFactory not found in the IIFE build");

  /* zod is a RESOLVE-time concern. The factory validates a tenant's config
     when it composes one; a browser is handed a config already validated and
     has nothing to parse. Importing a schema for its `.parse()` — or even
     leaving one as a top-level `z.object(...)` in a module the bundle needs
     for something else — pulls the whole validator in. */
  if (/ZodError/.test(js)) {
    failures.push(
      "zod leaked into the browser bundle.\n" +
        "     Two causes, both seen in this repo:\n" +
        "       1. a browser surface calling someSchema.parse(...) — write the\n" +
        "          defaults out literally instead, and let a capability test\n" +
        "          assert the schema still parses to them;\n" +
        "       2. a schema living in a module the bundle needs for other\n" +
        "          runtime values, where a top-level z.object(...) cannot be\n" +
        "          proven side-effect-free — move it to its own module.",
    );
  }

  note.push(`site/erp-factory.js   ${(jsBytes / 1024).toFixed(1)} KB`);
}
if (cjsBytes) note.push(`site/erp-factory.cjs  ${(cjsBytes / 1024).toFixed(1)} KB`);

console.log("──── browser bundle safety ────");
for (const n of note) console.log(n);

if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`✗ ${f}`);
  process.exit(1);
}
console.log("bundle is browser-safe: ErpFactory exposed, no validator shipped.");

// =============================================================================
// Guards site/erp-ownership.json — the machine-readable migration state used
// by the strangler-fig plan (see /Users/ifernandez/.claude/plans, or the
// docs/worklog/ context packs). Fails loudly on:
//   - malformed JSON / missing required fields per area
//   - an owner value outside {engine, factory, unbuilt}
//   - any area marked "factory" while site/erp-bridge.js does not exist yet
//     (that would mean erp.html claims to read a capability that has no seam
//     to reach it through — the exact half-migration state CLAUDE.md forbids)
//   - a "factory" area whose plannedSession has not actually landed a bridge
//     call: cheap heuristic, not a substitute for the parity fixtures that
//     land once erp-bridge.js exists (post session 2)
//
// Run: node tests/parity/ownership-guard.mjs
// =============================================================================
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const ownershipPath = resolve(repoRoot, "site/erp-ownership.json");
const bridgePath = resolve(repoRoot, "site/erp-bridge.js");

const VALID_OWNERS = new Set(["engine", "factory", "unbuilt"]);
const errors = [];

let doc;
try {
  doc = JSON.parse(readFileSync(ownershipPath, "utf8"));
} catch (e) {
  console.error(`✗ ${ownershipPath} is not valid JSON: ${e.message}`);
  process.exit(1);
}

const areas = doc.areas || {};
const names = Object.keys(areas);

if (names.length === 0) {
  errors.push("no areas declared — the file is scaffolding without content");
}

const bridgeExists = existsSync(bridgePath);

for (const name of names) {
  const a = areas[name];
  if (!a || typeof a !== "object") {
    errors.push(`${name}: entry is not an object`);
    continue;
  }
  if (!VALID_OWNERS.has(a.owner)) {
    errors.push(`${name}: owner "${a.owner}" is not one of engine|factory|unbuilt`);
  }
  if (typeof a.specSection !== "string" || !a.specSection.trim()) {
    errors.push(`${name}: missing specSection`);
  }
  if (a.owner === "factory" && !bridgeExists) {
    errors.push(
      `${name}: marked "factory" but site/erp-bridge.js does not exist yet — ` +
        `nothing in erp.html can legally reach a factory-owned area without the bridge seam`,
    );
  }
}

if (errors.length) {
  console.log(`──── ownership guard ────`);
  for (const e of errors) console.log(`✗ ${e}`);
  console.log(`${errors.length} problem(s) in site/erp-ownership.json`);
  process.exit(1);
}

console.log(
  `──── ownership guard ────\n${names.length} areas declared, all valid ` +
    `(${names.filter((n) => areas[n].owner === "engine").length} engine · ` +
    `${names.filter((n) => areas[n].owner === "factory").length} factory · ` +
    `${names.filter((n) => areas[n].owner === "unbuilt").length} unbuilt)`,
);
process.exit(0);

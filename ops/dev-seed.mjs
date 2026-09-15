// =============================================================================
// The invented company the development stack runs on.
//
//   node ops/dev-seed.mjs            > dev-seed.json      (today's clock)
//   node ops/dev-seed.mjs 2026-12-31 > dev-seed.json      (a chosen clock)
//
// WHY THIS IS NOT A COPY OF THE REAL DATA. The AEPD names two acceptable ways to
// fill a test system: synthetic data with the same structure and distribution,
// or a copy anonymised BEFORE it leaves production. Using real records because
// they are convenient is, in its own words, one of the infractions it most often
// finds. The first option costs nothing here because the invented company
// already exists — site/erp-seed.js builds it, the browser demo runs on it, and
// the test suites are written against it. So dev gets that, and the question of
// personal data on a second system never arises.
//
// WHAT COMES OUT. Roughly: 26 counterparties, 19 quotes, 13 contracts, 14
// projects, 26 invoices, 23 collections, 34 supplier bills, 464 labour records
// and about 1150 audit entries, spanning 2024 to 2028 — around half a megabyte
// of JSON. Enough to rehearse a migration, a year-end, a bank import or an
// onboarding against something with real shape rather than three rows.
//
// THE CLOCK MOVES, THE RECORDS DO NOT. `build(date)` sets what the engine
// believes today is; the records stay anchored where the seed put them. So a
// later date makes more invoices overdue and more warranties lapse — which is
// exactly what you want for rehearsing — but the dataset does not slide forward
// with it. It stops being useful somewhere past 2028, and the fix then is to
// enrich the seed, which the demo and the test suites would both benefit from.
//
// Writes to stdout so the caller decides where it lands; progress goes to
// stderr so a redirect cannot capture it into the document.
// =============================================================================
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Seed = require("../site/erp-seed.js");

const arg = process.argv[2];
if (arg && !/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
  console.error(`✗ "${arg}" is not a date. Use YYYY-MM-DD, or pass nothing for today.`);
  process.exit(1);
}
const today = arg || new Date().toISOString().slice(0, 10);

const state = Seed.build(today).toJSON();

// The same shape check ops/import-erp-state.sh performs on the receiving end,
// done here too so a broken seed fails at the machine that made it rather than
// halfway through an upload.
if (!Array.isArray(state.parties) || typeof state.seq !== "object") {
  console.error("✗ The seed did not produce an ERP document (no parties[]/seq{}).");
  process.exit(1);
}

process.stdout.write(JSON.stringify(state));

const counts = Object.entries(state)
  .filter(([, v]) => Array.isArray(v) && v.length)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 8)
  .map(([k, v]) => `${v.length} ${k}`)
  .join(" · ");
console.error(`✓ invented company at ${today} — ${counts}`);

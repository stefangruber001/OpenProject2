// =============================================================================
// Bank statement import: a REAL file, through the same module the browser
// loads, into the same engine methods the screen calls.
//
// The fixture is a genuine .xlsx (a ZIP of XML, deflated) with the quirks a
// BBVA export actually carries: a preamble before the header, dates as text
// AND as an Excel serial, amounts as Spanish text with thousands separators
// AND as raw numeric cells, an inline string, and a footer line that must be
// skipped rather than imported. A parser tested on a hand-built array has not
// been tested.
// Run: node tests/bank-import/run.mjs
// =============================================================================
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parseBbva, toCents, toIsoDate } = require("../../site/erp-import.js");
const { ERP } = require("../../site/erp-engine.js");

const checks = [];
const assert = (cond, name, detail) =>
  checks.push({ name, pass: !!cond, detail: cond ? "" : String(detail || "") });

const buf = readFileSync(new URL("../fixtures/bbva-movimientos.xlsx", import.meta.url));
const parsed = await parseBbva(buf);

assert(
  parsed.headerRowIndex === 4,
  "the header is found by NAME below the preamble",
  parsed.headerRowIndex,
);
assert(
  parsed.rows.length === 3,
  "three movements, no more — the footer line is not one",
  parsed.rows.length,
);
assert(
  parsed.skipped === 1,
  "…and the footer is COUNTED as skipped, not silently dropped",
  parsed.skipped,
);

const [r1, r2, r3] = parsed.rows;
assert(r1.accountingDate === "2026-03-02", "DD/MM/YYYY text becomes ISO", r1.accountingDate);
assert(
  r1.amountCents === 123456,
  "«1.234,56» becomes 123456 integer cents — the thousands dot is not a decimal",
  r1.amountCents,
);
assert(r1.balanceCents === 523456, "the running balance parses the same way", r1.balanceCents);
assert(
  r1.amountCents > 0 && r2.amountCents < 0,
  "signs survive: a receipt is positive, a charge negative",
);
assert(r2.amountCents === -8730, "a numeric cell (-87.3) becomes exact cents", r2.amountCents);
assert(r2.observations === "Luz obra", "observations travel with the row", r2.observations);
assert(r3.accountingDate === "2026-03-05", "an Excel serial date becomes ISO", r3.accountingDate);
assert(
  r3.merchantText === "FERRETERIA VALLES",
  "an inline string lands in merchantText",
  r3.merchantText,
);
assert(r3.amountCents === -4510, "«-45,10» becomes -4510", r3.amountCents);

// ---- into the engine, exactly as the screen will do it ----------------------
const e = new ERP("2026-03-10");
const acc = e.addBankAccount({ name: "BBVA", kind: "bank" }, "bo");
const pv1 = e.previewImport(acc.id, parsed.rows);
assert(
  pv1.fresh.length === 3 && pv1.duplicates.length === 0,
  "first preview: all three are fresh",
  JSON.stringify({ f: pv1.fresh.length, d: pv1.duplicates.length }),
);
e.importMovements(acc.id, pv1.fresh, "bo");
assert(e.state.movements.length === 3, "imported once", e.state.movements.length);
assert(
  e.state.movements.every((m) => m.status === "unallocated" && m.currency === "EUR"),
  "each lands unallocated, in euros, ready for the reconciliation queue",
);

// THE NEGATIVE CONTROL THE PLAN NAMES: the same statement again must be
// reported as duplicates, not created as movements.
const pv2 = e.previewImport(acc.id, parsed.rows);
assert(
  pv2.fresh.length === 0 && pv2.duplicates.length === 3,
  "re-importing the SAME statement: 3 duplicates, 0 fresh",
  JSON.stringify({ f: pv2.fresh.length, d: pv2.duplicates.length }),
);
assert(
  pv2.overlapsExistingPeriod === true,
  "…and the overlap with the already-imported period is flagged",
);
e.importMovements(acc.id, pv2.fresh, "bo");
assert(e.state.movements.length === 3, "so nothing is imported twice", e.state.movements.length);

// ---- the value parsers, at their edges --------------------------------------
assert(toCents("0,05") === 5, "five cents");
assert(
  toCents("-1.000") === -100000,
  "«-1.000» is minus a thousand euros, not minus one",
  toCents("-1.000"),
);
assert(toCents("(12,00)") === -1200, "accounting parentheses read as negative");
assert(toCents("") === null && toCents("Saldo") === null, "not-a-number is null, never zero");
assert(toIsoDate("7/3/2026") === "2026-03-07", "single-digit day and month pad");
assert(toIsoDate("garbage") === null, "not-a-date is null");

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} bank-import checks passed`);
process.exit(failed.length ? 1 : 0);

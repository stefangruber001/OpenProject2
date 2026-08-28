// =============================================================================
// Bank statement import: the PDF shape. A real page of text, through the same
// module the browser loads (site/erp-import-pdf.js), into the same
// previewImport/importMovements the .xlsx path uses — so a statement that
// does not add up is refused whichever file format it arrived in, and a
// statement that does is read the same either way.
//
// Fixture: tests/fixtures/bbva-extracto.pdf, built by
// tests/fixtures/make-bbva-pdf-fixture.py from the SHAPE of a real BBVA
// "Extracto integral" — never the tenant's actual export (see that script's
// header for why). Same account as bbva-cuenta.xlsx, an overlapping period,
// the OTHER shape the bank produces: printed text with wrapped concepts and
// an " EUR" suffix on every amount, instead of a spreadsheet's typed cells.
//
// pdfjs-dist ships a Node build (tests/ocr-spike/measure.mjs already uses
// it) — the browser gets the vendored copy via ErpOcr.loadPdfjs(), this test
// gets the npm one, and erp-import-pdf.js's parseBbvaPdf is written to not
// care which.
// Run: node tests/bank-import-pdf/run.mjs
// =============================================================================
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  parseBbvaPdf,
  pdfLines,
  groupLines,
  parseRowGroup,
} = require("../../site/erp-import-pdf.js");
const { toCents, toIsoDate } = require("../../site/erp-import.js");
const { ERP } = require("../../site/erp-engine.js");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const checks = [];
const assert = (cond, name, detail) =>
  checks.push({ name, pass: !!cond, detail: cond ? "" : String(detail || "") });

const buf = readFileSync(new URL("../fixtures/bbva-extracto.pdf", import.meta.url));
const parsed = await parseBbvaPdf(new Uint8Array(buf), pdfjs);

assert(
  parsed.rows.length === 16 && parsed.skipped === 0,
  "sixteen movements, nothing skipped — the repeated column headers on pages 2 and 3 are not rows",
  `${parsed.rows.length}/${parsed.skipped}`,
);
assert(
  parsed.rows[0].accountingDate === "2026-02-11" &&
    parsed.rows[parsed.rows.length - 1].accountingDate === "2026-06-26",
  "the newest-first PDF is turned round into a ledger, same as the .xlsx path",
  `${parsed.rows[0].accountingDate} → ${parsed.rows[parsed.rows.length - 1].accountingDate}`,
);

// The header comment's whole point: pdf.js hands back one item per
// text-showing operator — several per printed row — and pdfLines has to
// group them back onto their shared baseline before a row means anything.
const doc1 = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
const rawItems1 = (await (await doc1.getPage(1)).getTextContent()).items.length;
const pages = await pdfLines(new Uint8Array(buf), pdfjs);
assert(
  rawItems1 > pages[0].length,
  "several raw text-showing items per page collapse into far fewer reconstructed lines",
  `${rawItems1} items → ${pages[0].length} lines`,
);
assert(
  pages.length === 3,
  "the fixture's three pages are read as three, not concatenated into one",
  pages.length,
);

// A wrapped concept, reassembled across its own continuation lines with no
// date and no amount of its own to identify it by.
const transfer = parsed.rows.find((r) => r.concept.includes("INMOBILIARIA DE PRUEBA"));
assert(
  transfer &&
    transfer.concept ===
      "TRANSFERENCIA A FAVOR DE INMOBILIARIA DE PRUEBA SL FACTURA 20/26 CLIENTE DE PRUEBA",
  "a three-line wrapped concept reassembles as one string, in order",
  transfer && transfer.concept,
);
assert(
  transfer && transfer.amountCents === 55327,
  "…and its amount is unaffected by the wrap",
  transfer && transfer.amountCents,
);

// THE BUG THIS FIXTURE WAS BUILT TO CATCH: a multi-page export reprints its
// column headers at the top of every page. Naive "everything after the
// first date belongs to that row" grouping swallowed page 2's own header
// into the concept of whichever movement fell last on page 1.
const nominas = parsed.rows.filter((r) => r.concept.includes("NOMINA ABRIL"));
assert(
  nominas.length === 2 && nominas.every((r) => !/F\. OPERACION|CONCEPTO|SALDO/.test(r.concept)),
  "a page-boundary row's concept never swallows the next page's repeated header",
  JSON.stringify(nominas.map((r) => r.concept)),
);
assert(
  nominas.every((r) => r.amountCents === -50000),
  "…and two identical payroll lines on one day are still two movements, not a duplicate merged early",
  JSON.stringify(nominas.map((r) => r.amountCents)),
);

// A short, unwrapped, single-line row — the parser is not tuned to expect a wrap.
const fuel = parsed.rows.find((r) => r.concept.includes("COMBUSTIBLES"));
assert(
  fuel && fuel.amountCents === -8215 && fuel.concept.includes("GASOLINERA DE PRUEBA"),
  "a two-line row and a one-line row parse by the same rule",
  fuel && JSON.stringify(fuel),
);

// The running balance chain — PK7-A's own arithmetic, read off a PDF this time.
let chainBreaks = 0;
for (let i = 1; i < parsed.rows.length; i++)
  if (parsed.rows[i - 1].balanceCents + parsed.rows[i].amountCents !== parsed.rows[i].balanceCents)
    chainBreaks++;
assert(chainBreaks === 0, "the running balance chain closes on every row", chainBreaks);

// ---- into the engine, exactly as the screen will do it, exactly as the .xlsx path does --------
const e = new ERP("2026-07-01");
const acc = e.addBankAccount({ name: "BBVA", kind: "bank" }, "bo");
const pv = e.previewImport(acc.id, parsed.rows);
assert(
  pv.statement && pv.statement.closes,
  "111: the PDF's own saldos join up — opening + Σ = closing, same assertion as the .xlsx path",
  JSON.stringify(pv.statement),
);
assert(
  pv.fresh.length === 16 && pv.duplicates.length === 0,
  "first preview: all sixteen are fresh",
  JSON.stringify({ f: pv.fresh.length, d: pv.duplicates.length }),
);
e.importMovements(acc.id, pv.fresh, "bo", { statement: pv.statement });
assert(e.state.movements.length === 16, "imported once", e.state.movements.length);
assert(
  e.accountBalanceCents(acc.id) === pv.statement.closingCents,
  "111: after the import the account equals the PDF's own closing balance, to the cent",
  `${e.accountBalanceCents(acc.id)} vs ${pv.statement.closingCents}`,
);
assert(
  e.state.bankAccounts.find((a) => a.id === acc.id).openingCents === pv.statement.openingCents,
  "111: …because the opening balance came off the PDF, same as it comes off the .xlsx",
);

// THE NEGATIVE CONTROL THE PLAN NAMES: re-importing the same PDF is
// sixteen duplicates, not sixteen new movements.
const pv2 = e.previewImport(acc.id, parsed.rows);
assert(
  pv2.fresh.length === 0 && pv2.duplicates.length === 16,
  "re-importing the SAME PDF: sixteen duplicates, zero fresh",
  JSON.stringify({ f: pv2.fresh.length, d: pv2.duplicates.length }),
);

// A statement that does not add up is refused — proved on PDF-sourced rows,
// not just on the .xlsx fixture PK7-A already covers, so the PDF path gets
// no exemption from defect 111's protection.
const holedRows = parsed.rows.filter((_, i) => i !== 4);
const e2 = new ERP("2026-07-01");
const acc2 = e2.addBankAccount({ name: "BBVA", kind: "bank" }, "bo");
const pv3 = e2.previewImport(acc2.id, holedRows);
assert(
  !pv3.statement.closes,
  "111: dropping one PDF row breaks the chain",
  JSON.stringify(pv3.statement),
);
let refused = null;
try {
  e2.importMovements(acc2.id, holedRows, "bo", { statement: pv3.statement });
} catch (err) {
  refused = err.message;
}
assert(refused, "111: a PDF import that does not add up is refused", refused);
assert(e2.state.movements.length === 0, "…and nothing is written, not even the opening balance");

// A date-led line with no readable money on it is counted, not dropped —
// same contract as the .xlsx parser's `skipped`. Exercised directly against
// parseRowGroup/groupLines, the same units parseBbvaPdf itself calls.
assert(
  parseRowGroup(["31/12/2026", "MOVIMIENTO SIN IMPORTE LEGIBLE"]) === null,
  "a date-led row with no readable amount parses to null, not a row with amountCents: NaN",
);
const groups = groupLines([
  ["FECHA", "CONCEPTO", "31/12/2026", "SIN IMPORTE", "01/01/2027", "COMPRA -1,00 EUR"],
]);
assert(
  groups.length === 2 && groups[0][0] === "31/12/2026" && groups[1][0] === "01/01/2027",
  "groupLines: preamble before the first date is dropped, and each date starts its own group",
  JSON.stringify(groups),
);

// ---- the value parsers this module reuses, at their edges (shared with the .xlsx path) ------
assert(toIsoDate("11/2/2026") === "2026-02-11", "single-digit month pads, same as the .xlsx path");
assert(
  toCents("1.234,56") === 123456,
  "«1.234,56» is still 1234,56 euros when it arrives as PDF text",
);

// =============================================================================
const failed = checks.filter((c) => !c.pass);
for (const c of checks)
  console.log((c.pass ? "✓" : "✗") + " " + c.name + (c.pass ? "" : " — " + c.detail));
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) {
  console.log("\nFAILED:");
  for (const c of failed) console.log("  " + c.name + " — " + c.detail);
  process.exit(1);
}

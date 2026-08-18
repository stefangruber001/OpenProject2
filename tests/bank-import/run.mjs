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

// =============================================================================
// THE REAL LAYOUTS (S20)
//
// Everything above was written against a fixture invented before anyone had
// seen a BBVA export. When the tenant finally sent two real files, the parser
// met them for the first time in this test and failed three ways — each one
// silent, each one money. The fixtures below carry the real SHAPE (the files
// themselves cannot live here: live IBAN, full card numbers, real names) and
// the three failures are asserted directly.
// =============================================================================
const cuenta = await parseBbva(
  readFileSync(new URL("../fixtures/bbva-cuenta.xlsx", import.meta.url)),
);

assert(
  cuenta.rows.length === 8 && cuenta.skipped === 0,
  "account: eight movements below eight rows of account metadata",
  `${cuenta.rows.length}/${cuenta.skipped}`,
);
assert(
  cuenta.rows[0].accountingDate === "2026-03-31" &&
    cuenta.rows[cuenta.rows.length - 1].accountingDate === "2026-06-26",
  "account: the newest-first export is turned round into a ledger",
  `${cuenta.rows[0].accountingDate} → ${cuenta.rows[cuenta.rows.length - 1].accountingDate}`,
);

// FAILURE 1 — a numeric cell carrying binary-float noise. The bank prints
// -69,10; the sheet stores -69.099999999999994; the first parser read the
// tail as euros and produced -6,909,999,999,999,999,000 cents.
const noisy = cuenta.rows.find((r) => /DECORACION DE PRUEBA/.test(r.observations));
assert(
  noisy && noisy.amountCents === -6910,
  "account: -69.099999999999994 is sixty-nine euros ten, exactly",
  noisy && noisy.amountCents,
);
const bigNoisy = cuenta.rows.find((r) => /FURGONETA/.test(r.observations));
assert(
  bigNoisy && bigNoisy.amountCents === -1876644,
  "account: …and the same at five figures (-18766.439999999999)",
  bigNoisy && bigNoisy.amountCents,
);

// The bank's own arithmetic is the proof that EVERY amount parsed exactly:
// each balance is the one before it plus that row's amount.
let chainBreaks = 0;
for (let i = 1; i < cuenta.rows.length; i++)
  if (cuenta.rows[i - 1].balanceCents + cuenta.rows[i].amountCents !== cuenta.rows[i].balanceCents)
    chainBreaks++;
assert(chainBreaks === 0, "account: the running balance chain closes on every row", chainBreaks);

// FAILURE 2 — the counterparty, which decides WHICH invoice a transaction
// pays, was read from a column the parser did not know existed.
const inmo = cuenta.rows.find((r) => r.counterparty === "INMOBILIARIA DE PRUEBA SL");
assert(inmo && inmo.amountCents === 55327, "account: BENEFICIARIO/ORDENANTE reaches the movement");
assert(
  cuenta.rows.every((r) => r.opCode) && cuenta.rows.every((r) => r.merchantText),
  "account: the operation code and a merchant text travel with every row",
);
// A card payment names its category as the concept and the SHOP in
// observations; merchant rules key on merchantText, so that is where it goes.
assert(
  noisy.merchantText === noisy.observations && /DECORACION DE PRUEBA/.test(noisy.merchantText),
  "account: a card payment's merchant text is the shop, not the scheme category",
);

// FAILURE 3 — two people, 500 € each, one day. Value-identical and NOT
// duplicates. The first version dropped the second and called it tidiness.
const e2 = new ERP("2026-08-18");
const acc2 = e2.addBankAccount({ name: "BBVA", kind: "bank" }, "bo");
const accPv = e2.previewImport(acc2.id, cuenta.rows);
assert(
  accPv.fresh.length === 8 && accPv.duplicates.length === 0,
  "account: two identical payroll payments on one day are two movements",
  JSON.stringify({ f: accPv.fresh.length, d: accPv.duplicates.length }),
);
e2.importMovements(acc2.id, accPv.fresh, "bo");
const nominas = e2.state.movements.filter((m) => m.amountCents === -50000);
assert(nominas.length === 2, "account: …and both are in the register", nominas.length);
// …while the same file twice is still every row a duplicate.
const rePv = e2.previewImport(acc2.id, cuenta.rows);
assert(
  rePv.fresh.length === 0 && rePv.duplicates.length === 8,
  "account: re-importing the same statement is still 8 duplicates, 0 new",
  JSON.stringify({ f: rePv.fresh.length, d: rePv.duplicates.length }),
);
e2.importMovements(acc2.id, rePv.fresh, "bo");
assert(
  e2.state.movements.length === 8,
  "account: nothing imported twice",
  e2.state.movements.length,
);
// The register's own total must land on the statement's closing balance.
const closing = cuenta.rows[cuenta.rows.length - 1].balanceCents;
const opening = cuenta.rows[0].balanceCents - cuenta.rows[0].amountCents;
const summed = cuenta.rows.reduce((s, r) => s + r.amountCents, 0);
assert(
  opening + summed === closing,
  "account: opening plus every movement equals the statement's closing balance",
  `${opening} + ${summed} ≠ ${closing}`,
);

// ---- the card export: same bank, a different file again ---------------------
const tarjeta = await parseBbva(
  readFileSync(new URL("../fixtures/bbva-tarjeta.xlsx", import.meta.url)),
);
assert(tarjeta.rows.length === 5, "card: five movements", tarjeta.rows.length);
assert(
  tarjeta.rows.every((r) => r.balanceCents === null),
  "card: a card statement has no running balance, and that is not an error",
);
assert(
  tarjeta.rows[tarjeta.rows.length - 1].accountingDate === "2026-08-12",
  "card: ISO dates parse as themselves",
  tarjeta.rows[tarjeta.rows.length - 1].accountingDate,
);
const compra = tarjeta.rows.find((r) => r.concept === "ELECTRODOMESTICOS DE PRUEBA");
assert(
  compra && compra.amountCents === -5433,
  "card: «-54,33» text becomes -5433",
  compra && compra.amountCents,
);
const recibo = tarjeta.rows.find((r) => /RECIBO MES ANTERIOR/.test(r.concept));
assert(
  recibo && recibo.amountCents === 26227,
  "card: the monthly settlement row is positive on the card",
  recibo && recibo.amountCents,
);
// It lands on a card account through the same door as any other statement.
const card2 = e2.addBankAccount({ name: "Visa", kind: "card" }, "bo");
const cpv = e2.previewImport(card2.id, tarjeta.rows);
e2.importMovements(card2.id, cpv.fresh, "bo");
assert(
  e2.state.movements.filter((m) => m.accountId === card2.id).length === 5,
  "card: the card statement imports onto the card account",
);

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} bank-import checks passed`);
process.exit(failed.length ? 1 : 0);

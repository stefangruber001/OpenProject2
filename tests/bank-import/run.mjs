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

// ---- the way back out (S20) -------------------------------------------------
// An import writes hundreds of records from a file nobody read line by line.
// When one of them is wrong — a mis-parsed column, the wrong account — there
// has to be a way back, and it must never take back a decision somebody made.
const e3 = new ERP("2026-08-18");
const acc3 = e3.addBankAccount({ name: "BBVA", kind: "bank" }, "bo");
const batchRows = (
  await parseBbva(readFileSync(new URL("../fixtures/bbva-cuenta.xlsx", import.meta.url)))
).rows;
e3.importMovements(acc3.id, e3.previewImport(acc3.id, batchRows).fresh, "bo");
assert(
  e3.state.importBatches.length === 1 && e3.state.importBatches[0].count === 8,
  "undo: the import is remembered as a batch of eight",
  JSON.stringify(e3.state.importBatches),
);
// A till entry is not a statement import and must not appear as one.
const till3 = e3.addBankAccount({ name: "Caja", kind: "till" }, "bo");
e3.recordCashMovement(
  till3.id,
  { concept: "Café", amountCents: -500, accountingDate: "2026-05-02" },
  "bo",
);
assert(e3.state.importBatches.length === 1, "undo: a cash entry does not create a batch of one");

// One movement is given a decision: it must survive the undo.
const keeper = e3.state.movements.find((m) => m.accountId === acc3.id);
e3.markMovementUnbacked(keeper.id, "comision", "bo");
const undone = e3.undoImport(e3.state.importBatches[0].id, "bo");
assert(
  undone.deleted === 7 && undone.kept === 1,
  "undo: seven untouched movements go, the decided one stays",
  JSON.stringify(undone),
);
assert(
  e3.state.movements.filter((m) => m.accountId === acc3.id).length === 1,
  "undo: …and the register agrees",
  e3.state.movements.filter((m) => m.accountId === acc3.id).length,
);
assert(
  e3.state.importBatches.length === 1,
  "undo: the batch is kept while any of it survives, so the rest can still be found",
);
// The older mess predates batches: clearing by account must work regardless.
const e4 = new ERP("2026-08-18");
const acc4 = e4.addBankAccount({ name: "BBVA", kind: "bank" }, "bo");
e4.importMovements(acc4.id, batchRows, "bo");
const paid = e4.state.movements[0];
paid.status = "matched"; // as matchMovement leaves it
const cleared = e4.discardMovements(acc4.id, {}, "bo");
assert(
  cleared.deleted === 7 && cleared.kept === 1 && e4.state.movements.length === 1,
  "undo: clearing an account removes only what nobody has touched",
  JSON.stringify(cleared),
);

// ---- the seal, in both directions (S20c) ------------------------------------
// The operator closed 2026 while the account was empty — the screen offered
// it, "0 unreconciled movements in the period" — and then imported into it.
// The importer wrote 477 movements into a sealed period without a word, and
// the same seal then refused to let them out again: the undo said "kept 477"
// and gave no reason. A seal that only holds in one direction is a trap.
const e5 = new ERP("2026-08-18");
const acc5 = e5.addBankAccount({ name: "BBVA", kind: "bank" }, "bo");
e5.closeBankPeriod("2026-01-01", "2026-12-31", "bo");
const sealedPv = e5.previewImport(acc5.id, batchRows);
assert(
  sealedPv.closedRows === batchRows.length,
  "seal: the preview counts every row that falls inside a closed period",
  sealedPv.closedRows,
);
let refused = "";
try {
  e5.importMovements(acc5.id, batchRows, "bo");
} catch (err) {
  refused = err.message;
}
assert(/periodo cerrado/.test(refused), "seal: …and the import is refused, not written", refused);
assert(
  e5.state.movements.length === 0,
  "seal: nothing reached the register",
  e5.state.movements.length,
);

// Reopened, it all works — and the undo can now undo it.
e5.reopenBankPeriod("2026-01-01", "corrigiendo una importación", "bo");
e5.importMovements(acc5.id, batchRows, "bo");
assert(e5.state.movements.length === 8, "seal: reopened, the same file imports");
const pv5 = e5.discardPreview(acc5.id);
assert(
  pv5.deletable === 8 && pv5.kept === 0,
  "seal: …and every row can be taken back out",
  JSON.stringify(pv5),
);

// The breakdown names the blocker rather than leaving a bare count.
const e6 = new ERP("2026-08-18");
const acc6 = e6.addBankAccount({ name: "BBVA", kind: "bank" }, "bo");
e6.importMovements(acc6.id, batchRows, "bo");
e6.markMovementUnbacked(e6.state.movements[0].id, "comision", "bo");
const why6 = e6.discardPreview(acc6.id);
assert(
  why6.deletable === 7 && why6.byReason.unbacked === 1,
  "seal: the preview says WHICH state is holding a movement back",
  JSON.stringify(why6),
);

// =============================================================================
// PK7-A · The statement's own arithmetic (acceptance test, defect 111)
//
// The running balance beside each amount — BBVA calls it SALDO — has always
// been parsed, stored on every movement, and never read back. So an account's
// balance was `openingCents + Σ`, with `openingCents` left at zero, and a
// statement beginning mid-history produced a figure short by exactly the money
// the account already held. On the tenant's own file the bank said 13.764,37
// and the product said −10.235,63: the 24.000,00 nobody had told it about.
// =============================================================================

// `cuenta` and `tarjeta` are already parsed above — the same two fixtures, read once.
const st = new ERP("2026-08-18").statementBalance(cuenta.rows);

assert(
  st && st.closes,
  "111: the account fixture's saldos join up — opening + Σ = closing",
  JSON.stringify(st),
);
// The defect itself, stated as a property rather than as a constant: with the
// opening balance left at zero the account would read `sumCents`, and that is
// not the closing balance the bank printed. Which is exactly what the operator
// saw — the sum of the movements where the balance should have been.
assert(
  st && st.openingCents !== 0 && st.sumCents !== st.closingCents,
  "111: the opening balance is load-bearing — the movements alone do not reach the closing balance",
  st && `Σ ${st.sumCents} vs closing ${st.closingCents}`,
);

// Direction is read from the rows. A real BBVA export is newest-first; the same
// file ascending must yield the same three numbers, or the check would depend
// on how the bank happened to sort it.
const asc = new ERP("2026-08-18").statementBalance(cuenta.rows.slice().reverse());
assert(
  asc && asc.openingCents === st.openingCents && asc.closingCents === st.closingCents,
  "111: newest-first and oldest-first read identically",
  JSON.stringify(asc),
);

// The end-to-end promise: after importing, the account reads what the bank printed.
const e7 = new ERP("2026-08-18");
const acc7 = e7.addBankAccount({ name: "BBVA cuenta corriente", kind: "bank" }, "bo");
const pv7 = e7.previewImport(acc7.id, cuenta.rows);
e7.importMovements(acc7.id, pv7.fresh, "bo", { statement: pv7.statement });
assert(
  e7.accountBalanceCents(acc7.id) === st.closingCents,
  "111: after the import the account equals the statement's closing balance, to the cent",
  `${e7.accountBalanceCents(acc7.id)} vs ${st.closingCents}`,
);
assert(
  e7.state.bankAccounts.find((a) => a.id === acc7.id).openingCents === st.openingCents,
  "111: …because the opening balance came off the file",
  e7.state.bankAccounts.find((a) => a.id === acc7.id).openingCents,
);

// A dropped row is the failure this refuses. Nothing is written — not the
// movements, not the opening balance — because a register that looks right is
// worse than an import that stopped.
const holedRows = cuenta.rows.filter((_, i) => i !== 2);
const holedStatement = new ERP("2026-08-18").statementBalance(holedRows);
assert(
  !holedStatement.closes,
  "111: losing one row breaks the chain",
  JSON.stringify(holedStatement),
);
const e8 = new ERP("2026-08-18");
const acc8 = e8.addBankAccount({ name: "BBVA", kind: "bank" }, "bo");
let refusedImport = null;
try {
  e8.importMovements(acc8.id, holedRows, "bo", { statement: holedStatement });
} catch (err) {
  refusedImport = err.message;
}
assert(refusedImport, "111: an import that does not add up is refusedImport", refusedImport);
assert(
  e8.state.movements.length === 0 &&
    e8.state.bankAccounts.find((a) => a.id === acc8.id).openingCents === 0,
  "111: …and nothing at all was written",
  `${e8.state.movements.length} movs`,
);

// A card export carries no balance column. Unverifiable is not the same answer
// as wrong, and only one of them should stop anybody importing.
assert(
  new ERP("2026-08-18").statementBalance(tarjeta.rows) === null,
  "111: a statement with no saldo column reports null rather than guessing",
);

// =============================================================================
// PK7-A · One movement, several documents (A3) and overPaid-payment (A4)
// =============================================================================

const e9 = new ERP("2026-08-18");
const sup9 =
  e9.state.parties.find((p) => p.roles.includes("supplier")) ||
  e9.addParty(
    {
      roles: ["supplier"],
      name: "Proveedor",
      taxId: "A58818501",
      billStreet: "C/ A 1",
      billPostalCode: "08001",
      billCity: "Barcelona",
      billProvince: "Barcelona",
      billCountry: "España",
      mobile: "600111222",
    },
    "bo",
  );
const bA = e9.registerBill({ supplierId: sup9.id, number: "A-1", baseCents: 200000 }, "bo");
const bB = e9.registerBill({ supplierId: sup9.id, number: "A-2", baseCents: 130578 }, "bo");
const acc9 = e9.addBankAccount({ name: "BBVA", kind: "bank" }, "bo");
const both = bA.totalCents + bB.totalCents;
const [mov9] = e9.importMovements(
  acc9.id,
  [{ accountingDate: "2026-08-10", concept: "TRANSF", amountCents: -both }],
  "bo",
);
e9.matchMovementSplit(
  mov9.id,
  [
    { billId: bA.id, amountCents: bA.totalCents },
    { billId: bB.id, amountCents: bB.totalCents },
  ],
  "bo",
);
assert(
  e9.billOutstandingCents(bA.id) === 0 && e9.billOutstandingCents(bB.id) === 0,
  "A3: one transfer covering two invoices settles BOTH",
  `${e9.billOutstandingCents(bA.id)} / ${e9.billOutstandingCents(bB.id)}`,
);
assert(
  mov9.matched.documents.length === 2,
  "A3: …and the movement records both, not whichever was processed last",
  JSON.stringify(mov9.matched),
);
assert(
  e9.state.payments.filter((p) => p.movementId === mov9.id).length === 1,
  "A3: one movement makes one payment, however many documents it covers",
);

// A4: a document can never be paid more than it owes. Before this the balance
// simply went negative, which reads as a figure rather than as an error.
const bC = e9.registerBill({ supplierId: sup9.id, number: "A-3", baseCents: 100000 }, "bo");
const [mov10] = e9.importMovements(
  acc9.id,
  [{ accountingDate: "2026-08-11", concept: "TRANSF GRANDE", amountCents: -300000 }],
  "bo",
);
let overPaid = null;
try {
  e9.matchMovementSplit(mov10.id, [{ billId: bC.id, amountCents: 300000 }], "bo");
} catch (err) {
  overPaid = err.message;
}
assert(overPaid, "A4: overPaid-paying a document is refusedImport", overPaid);
assert(
  e9.billOutstandingCents(bC.id) > 0,
  "A4: …and its outstanding never goes negative",
  e9.billOutstandingCents(bC.id),
);

// =============================================================================
// PK7-A · The queue is worked one account at a time (117)
// =============================================================================

const e11 = new ERP("2026-08-18");
const bank11 = e11.addBankAccount({ name: "Cuenta", kind: "bank" }, "bo");
const card11 = e11.addBankAccount({ name: "Tarjeta", kind: "card" }, "bo");
e11.importMovements(
  bank11.id,
  [{ accountingDate: "2026-08-01", concept: "UNO", amountCents: -1000 }],
  "bo",
);
e11.importMovements(
  card11.id,
  [
    { accountingDate: "2026-08-02", concept: "DOS", amountCents: -200 },
    { accountingDate: "2026-08-03", concept: "TRES", amountCents: -300 },
  ],
  "bo",
);
assert(
  e11.unreconciledMovements().length === 3,
  "117: with no account named, the queue spans them all — what closing a period needs",
);
assert(
  e11.unreconciledMovements(null, null, bank11.id).length === 1 &&
    e11.unreconciledMovements(null, null, card11.id).length === 2,
  "117: naming the account narrows it — the card no longer shows the bank's queue",
  `${e11.unreconciledMovements(null, null, bank11.id).length} / ${e11.unreconciledMovements(null, null, card11.id).length}`,
);

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} bank-import checks passed`);
process.exit(failed.length ? 1 : 0);

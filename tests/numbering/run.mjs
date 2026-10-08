/* =============================================================================
   DOCUMENT NUMBERING, as a company that already has a history needs it.

   Asked for on 2 Oct, through the operator, in the client's own words: «el tema
   de la numeración de la factura, para que sea consecutivo … la próxima sería
   la número 57/2026 … si no es correlativo la gestora me pegará la cabeza».

   Three things had to become true, and none of them was:

     · the SHAPE is the company's, not ours — `57/2026`, no prefix, no padding,
       where the engine had `FAC-2026-0057` hardcoded;
     · the STARTING POINT is theirs — a company arriving on invoice 56 cannot
       have a book that restarts at 1;
     · the YEAR RULE is theirs — this client runs ONE unbroken count that never
       restarts and simply carries the year it was issued in, so 57/2026 on
       21 December is followed by 58/2027 on 2 January. That is not the common
       Spanish practice (restarting each year is), which is exactly why it has
       to be a setting rather than an assumption.

   And the half that is not about them at all: every store written before this
   keeps the numbering it already had, because a change to how documents are
   numbered must never reach a book retroactively.
   ========================================================================== */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { ERP } = require("../../site/erp-engine.js");

const checks = [];
const ok = (n, d) => checks.push({ n, pass: true, d: d || "" });
const bad = (n, d) => checks.push({ n, pass: false, d: String(d == null ? "" : d) });
const is = (cond, n, d) => (cond ? ok(n, typeof d === "string" ? d : "") : bad(n, d));

function erpAt(day) {
  const erp = new ERP();
  erp.setToday(day || "2026-10-02");
  return erp;
}

/* ---------- 1 · nothing configured behaves exactly as it always did ---------- */
{
  const erp = erpAt("2026-10-02");
  const a = erp.nextNumber("invoice");
  const b = erp.nextNumber("invoice");
  is(
    a === "FAC-2026-0001" && b === "FAC-2026-0002",
    "untouched, the old shape is still the shape",
    `${a}, ${b}`,
  );
  erp.setToday("2027-01-02");
  is(
    erp.nextNumber("invoice") === "FAC-2027-0001",
    "…and it still restarts each January",
    erp.state.series.invoice.issued.join(" "),
  );
}

/* ---------- 2 · the client's invoices: 57/2026, one unbroken run ---------- */
{
  const erp = erpAt("2026-10-02");
  erp.configureSeries(
    "invoice",
    { pattern: "{n}/{year}", pad: 0, resetYearly: false, next: 57 },
    "t",
  );
  const first = erp.nextNumber("invoice");
  is(first === "57/2026", "the first invoice out of the system is 57/2026", first);
  is(erp.nextNumber("invoice") === "58/2026", "…and the next is 58/2026", "");

  // The rule that is theirs and not the usual one.
  erp.setToday("2026-12-21");
  const dec = erp.nextNumber("invoice");
  erp.setToday("2027-01-02");
  const jan = erp.nextNumber("invoice");
  is(
    dec === "59/2026" && jan === "60/2027",
    "the count does NOT restart in January; only the year moves",
    `${dec} → ${jan}`,
  );
}

/* ---------- 3 · rectificativas run on their own correlative ---------- */
{
  const erp = erpAt("2026-10-02");
  erp.configureSeries(
    "invoice",
    { pattern: "{n}/{year}", pad: 0, resetYearly: false, next: 57 },
    "t",
  );
  erp.configureSeries(
    "creditNote",
    { pattern: "R-{n}/{year}", pad: 0, resetYearly: false, next: 1 },
    "t",
  );
  const inv = erp.nextNumber("invoice");
  const r1 = erp.nextNumber("creditNote");
  const r2 = erp.nextNumber("creditNote");
  is(
    inv === "57/2026" && r1 === "R-1/2026" && r2 === "R-2/2026",
    "rectificativas count separately, from 1",
    `${inv} ${r1} ${r2}`,
  );
  is(
    erp.nextNumber("invoice") === "58/2026",
    "…and issuing one does not disturb the invoice run",
    "",
  );
}

/* ---------- 4 · presupuestos continue from 102 ---------- */
{
  const erp = erpAt("2026-10-02");
  erp.configureSeries(
    "budget",
    { pattern: "{n}/{year}", pad: 0, resetYearly: false, next: 102 },
    "t",
  );
  is(erp.nextNumber("budget") === "102/2026", "the next presupuesto is 102/2026", "");
}

/* ---------- 5 · what the setting refuses ---------- */
{
  /* THE RULE IS ABOUT A NUMBER USED TWICE, not about having been used at all.
     It first refused outright the moment a series had issued anything, which
     locked out the one company that needed it: their workspace held seven test
     invoices, so «FAC-2026-0007» was in the register and the numbering card was
     disabled. Reported from dev on 2 Oct as «did not work». */
  const erp = erpAt("2026-10-02");
  for (let i = 0; i < 7; i++) erp.nextNumber("invoice"); // FAC-2026-0001 … 0007
  erp.configureSeries(
    "invoice",
    { pattern: "{n}/{year}", pad: 0, resetYearly: false, next: 57 },
    "t",
  );
  is(
    erp.nextNumber("invoice") === "57/2026",
    "a workspace with test documents in it can still adopt its real numbering",
    JSON.stringify(erp.state.series.invoice.issued),
  );

  // …and the narrow thing that must still be refused.
  const clash = erpAt("2026-10-02");
  clash.configureSeries(
    "invoice",
    { pattern: "{n}/{year}", pad: 0, resetYearly: false, next: 57 },
    "t",
  );
  clash.nextNumber("invoice"); // 57/2026 is now printed
  clash.nextNumber("invoice"); // 58/2026
  let reissued = false;
  try {
    clash.configureSeries("invoice", { next: 58 }, "t");
  } catch (e) {
    reissued = true;
  }
  is(reissued, "…but a setting that would reissue 58/2026 is refused", "");
  let above = true;
  try {
    clash.configureSeries("invoice", { next: 59 }, "t");
  } catch (e) {
    above = false;
  }
  is(above, "…while continuing above the highest already printed is allowed", "");

  /* A number in the OLD shape cannot collide with what the new shape produces,
     so it must not constrain the new one. This is what lets a company leave
     «FAC-2026-0007» behind and start at 1/2026 if that is their sequence. */
  const shapes = erpAt("2026-10-02");
  for (let i = 0; i < 7; i++) shapes.nextNumber("invoice");
  shapes.configureSeries(
    "invoice",
    { pattern: "{n}/{year}", pad: 0, resetYearly: false, next: 1 },
    "t",
  );
  is(
    shapes.nextNumber("invoice") === "1/2026",
    "a number in the old shape does not block the new shape",
    JSON.stringify(shapes.state.series.invoice.issued),
  );

  const fresh = erpAt("2026-10-02");
  let noN = false;
  try {
    fresh.configureSeries("invoice", { pattern: "FAC-{year}" }, "t");
  } catch (e) {
    noN = true;
  }
  is(noN, "a pattern with no {n} is refused — that is not a numbering", "");

  let zero = false;
  try {
    fresh.configureSeries("invoice", { next: 0 }, "t");
  } catch (e) {
    zero = true;
  }
  is(zero, "…and so is a starting number below 1", "");
}

/* ---------- 6 · the gap audit reads the new shape too ---------- */
{
  const erp = erpAt("2026-10-02");
  erp.configureSeries(
    "invoice",
    { pattern: "{n}/{year}", pad: 0, resetYearly: false, next: 57 },
    "t",
  );
  erp.nextNumber("invoice");
  erp.nextNumber("invoice");
  is(
    erp.seriesGaps("invoice").length === 0,
    "a clean run reports no gaps",
    JSON.stringify(erp.seriesGaps("invoice")),
  );
  // A number removed by hand is the thing this audit exists to catch.
  erp.state.series.invoice.issued = ["57/2026", "59/2026"];
  is(
    erp.seriesGaps("invoice").length === 1,
    "…and a missing 58 is reported",
    JSON.stringify(erp.seriesGaps("invoice")),
  );
}

/* ---------- 9 · taking back a number that never left the building ----------

   The client's first invoice came out FAC-2026-0001 because the numbering had
   not been set up yet. It was never sent. Rectifying it would put two
   documents in the book to cancel a sale that never happened, so the number
   has to be returnable — and returnable ONLY while nothing has happened to it.

   The guards are the test. A withdrawal that works is worth little next to a
   withdrawal that refuses when it should, because the failure mode here is
   silently removing a document somebody else already has. */
{
  const erp = erpAt("2026-10-07");
  erp.configureSeries(
    "invoice",
    { pattern: "{n}/{year}", pad: 0, resetYearly: false, next: 57 },
    "t",
  );
  // Two invoices, minted the way issueInvoice mints them, with the chained
  // event each one writes.
  const mint = (id) => {
    const number = erp.nextNumber("invoice");
    erp.state.invoices.push({ id, number, date: "2026-10-07", kind: "progress", totalCents: 100 });
    erp.state.invoiceEvents.push({ number, date: "2026-10-07", totalCents: 100 });
    return number;
  };
  const first = mint("inv_a");
  const second = mint("inv_b");
  is(first === "57/2026" && second === "58/2026", "two issued", first + " " + second);

  is(erp.invoiceUndoBlock("inv_a") === "not-last", "the earlier one cannot be withdrawn");

  const returned = erp.undoLastInvoice("inv_b", "t", "numeración mal configurada");
  is(returned === "58/2026", "the last one is withdrawn", returned);
  is(
    erp.state.series.invoice.issued.join(",") === "57/2026",
    "…and its number leaves the series",
    erp.state.series.invoice.issued.join(","),
  );
  is(
    erp.state.invoices.length === 1 && erp.state.invoiceEvents.length === 1,
    "…with its chained event, so the chain still verifies",
  );
  // The point of the whole exercise: the number is genuinely free again.
  is(erp.nextNumber("invoice") === "58/2026", "…and the next invoice takes 58 again");
}

/* Each guard, one at a time, against an invoice that IS the last one — so the
   only thing refusing is the guard under test. */
{
  const setup = () => {
    const erp = erpAt("2026-10-07");
    erp.configureSeries(
      "invoice",
      { pattern: "{n}/{year}", pad: 0, resetYearly: false, next: 57 },
      "t",
    );
    const number = erp.nextNumber("invoice");
    erp.state.invoices.push({ id: "inv_x", number, date: "2026-10-07", kind: "progress" });
    erp.state.invoiceEvents.push({ number, date: "2026-10-07", totalCents: 100 });
    return { erp, number };
  };
  const clean = setup();
  is(clean.erp.invoiceUndoBlock("inv_x") === null, "nothing has happened to it: no block");

  const paid = setup();
  paid.erp.state.collections.push({ allocations: [{ invoiceId: "inv_x", amountCents: 100 }] });
  is(paid.erp.invoiceUndoBlock("inv_x") === "collected", "money against it blocks the withdrawal");

  const sent = setup();
  sent.erp.state.commsQueue.push({ subjectRef: sent.number, status: "sent" });
  is(sent.erp.invoiceUndoBlock("inv_x") === "sent", "a message that went out blocks it");

  // …but a draft that never went out does not.
  const draft = setup();
  draft.erp.state.commsQueue.push({ subjectRef: draft.number, status: "draft" });
  is(draft.erp.invoiceUndoBlock("inv_x") === null, "a prepared-but-unsent message does not");

  const fixed = setup();
  fixed.erp.state.invoices.push({ id: "inv_r", number: "R-1/2026", rectifies: "inv_x" });
  is(fixed.erp.invoiceUndoBlock("inv_x") === "rectified", "an existing rectificativa blocks it");

  const filed = setup();
  filed.erp.state.packagesSent.push({ quarter: "2026-Q4" });
  is(
    filed.erp.invoiceUndoBlock("inv_x") === "quarter-sent",
    "a quarter already filed with the gestoría blocks it",
  );

  // And a blocked withdrawal REFUSES rather than half-doing it.
  let threw = false;
  try {
    paid.erp.undoLastInvoice("inv_x", "t");
  } catch (e) {
    threw = true;
  }
  is(
    threw && paid.erp.state.invoices.length === 1,
    "a blocked withdrawal throws and changes nothing",
  );
}

/* ---------- 10 · el plazo de pago, de la empresa y de cada cliente ----------

   «Normalmente dejamos un plazo de 3 días no más — a 30 días no trabajamos»
   (8 Oct). Thirty was this file's own invention: `addParty` stamped it on
   every customer and no screen ever showed it, so the per-customer figure the
   engine has always resolved was a setting nobody could reach.

   Checked at the level that matters — what an invoice FALLS DUE ON — because a
   stored number nobody reads would satisfy any check that only looked at the
   record. */
{
  const erp = erpAt("2026-10-08");
  is(erp.companyProfile().paymentTermsDays === 3, "the company default is three days");
  const a = erp.addParty({ name: "Cliente por defecto SL", roles: ["customer"] }, "t");
  is(a.paymentTermsDays === 3, "a new customer starts on the company's three", a.paymentTermsDays);
  const b = erp.addParty(
    { name: "Cliente a quince SL", roles: ["customer"], paymentTermsDays: 15 },
    "t",
  );
  is(b.paymentTermsDays === 15, "…and a customer may carry their own", b.paymentTermsDays);

  /* The resolution `issueInvoice` performs, in the same order it performs it:
     the billing entry first, then the customer, then the company. */
  const due = (payerDays, partyDays) =>
    payerDays || partyDays || erp.companyProfile().paymentTermsDays;
  is(due(null, b.paymentTermsDays) === 15, "the customer's figure wins over the company's");
  is(due(60, b.paymentTermsDays) === 60, "…and a billing entry of its own wins over the customer");
  is(due(null, a.paymentTermsDays) === 3, "…with the company's three as the floor");
}

/* ---------- report ---------- */
const failed = checks.filter((c) => !c.pass);
console.log("\n──── document numbering ────\n");
for (const c of checks) console.log(`${c.pass ? "✓" : "✗"} ${c.n}${c.d ? `  → ${c.d}` : ""}`);
console.log(`\n${checks.length - failed.length}/${checks.length} numbering checks passed`);
process.exit(failed.length ? 1 : 0);

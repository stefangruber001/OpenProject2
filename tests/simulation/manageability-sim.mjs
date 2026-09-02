// =============================================================================
// Manageability test: every field a company must be able to change has a
// working update path, and everything immutable-by-design stays locked.
// Run: node tests/simulation/manageability-sim.mjs
// =============================================================================
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { ERP } = require("../../site/erp-engine.js");
/* The bridge, for the one thing only it can answer: what date a payment
   milestone falls on once the plan is known. That derivation — money-chain
   item 14 — had no test of any kind, in any suite, until PK9-S3. */
const Bridge = require("../../site/erp-bridge.js");

const checks = [];
const assert = (cond, name, detail) =>
  checks.push({ name, pass: !!cond, detail: cond ? "" : String(detail || "") });
/** Add days to an ISO date without importing the engine's private helper. */
const addDaysISO = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const throws = (fn, name) => {
  try {
    fn();
    checks.push({ name, pass: false, detail: "did not throw" });
  } catch {
    checks.push({ name, pass: true, detail: "" });
  }
};

/**
 * A STATE THAT NEVER WENT THROUGH configureEntity CAN STILL ISSUE DOCUMENTS.
 *
 * Reported from production: pressing "+ Create quote" on a completed visit did
 * nothing and raised "⚠ Unknown series: budget". Nothing was wrong with the
 * visit, the customer or the quote — the document series lived only inside
 * configureEntity, a fresh state has `series: {}`, and every issuing path threw
 * at the operator instead. Quotes, contracts, invoices, receipts, credit notes,
 * purchase orders and subcontracts were all equally unreachable.
 *
 * Checked before the configured engine below, on a deliberately unconfigured
 * one, because that is the state the report came from.
 */
{
  const bare = new ERP("2026-03-02");
  assert(
    Object.keys(bare.state.series).length === 0,
    "a fresh state genuinely starts with no series (or this test proves nothing)",
  );
  for (const type of [
    "budget",
    "contract",
    "invoice",
    "receipt",
    "creditNote",
    "purchaseOrder",
    "subcontract",
  ]) {
    let number = "";
    try {
      number = bare.nextNumber(type);
    } catch (e) {
      number = "THREW: " + e.message;
    }
    assert(/^[A-Z]+-\d{4}-0001$/.test(number), `unconfigured state can issue ${type} (${number})`);
  }
  // A type that is not a document series at all is still a programming error.
  throws(() => bare.nextNumber("nonsense"), "an unknown series type still throws");
}

const erp = new ERP("2026-03-02");
erp.configureEntity({
  legalName: "Canei Subirats, S.L.",
  taxId: "B66666660",
  street: "Creu 74",
  postalCode: "08960",
  city: "SJD",
  phone: "659",
  email: "hola@canei.example",
  iban: "ES9121000418450200051332",
});
erp.state.clauseBlocks.push({
  id: "cb1",
  name: "Condiciones",
  effectiveFrom: "2026-01-01",
  version: 1,
});

// partial reconfigure preserves existing values
erp.configureEntity({ phone: "930000000" });
assert(
  erp.state.config.legalName === "Canei Subirats, S.L.",
  "configureEntity partial keeps legalName",
);

// party
const cust = erp.addParty({
  roles: ["customer"],
  name: "Test Client",
  taxId: "12345678Z",
  billStreet: "C/ A 1",
  billPostalCode: "08001",
  billCity: "BCN",
  billProvince: "Barcelona",
  mobile: "600111222",
  email: "a@b.example",
  leadSource: "referral",
  activityLine: "renovation",
});
erp.updateParty(cust.id, { name: "Test Client Renamed", contactPerson: "Núria" }, "bo");
assert(erp.party(cust.id).name === "Test Client Renamed", "updateParty name");
throws(
  () => erp.updateParty(cust.id, { taxId: "12345678A" }, "bo"),
  "updateParty rejects invalid taxId",
);

// catalogue + package + price
const item = erp.addCatalogueItem(
  {
    code: "IT1",
    desc: "Tabique",
    unit: "m2",
    chapter: "ALB",
    defaultCostCents: 1000,
    defaultPriceCents: 2000,
  },
  "bo",
);
assert(item.type === "", "a new catalogue item has no fabricated Tipo", item.type);
erp.updateCatalogueItem(item.id, { desc: "Tabique cartón-yeso", defaultPriceCents: 2100 }, "bo");
assert(erp.state.catalogue[0].defaultPriceCents === 2100, "updateCatalogueItem price");
throws(
  () => erp.addCatalogueItem({ code: "IT9", desc: "Sin partida", unit: "ud" }, "bo"),
  "addCatalogueItem refuses an empty chapter",
);
const wp = erp.addWorkPackage(
  { name: "Pack", unit: "u", components: [{ itemId: item.id, qtyPerUnitMilli: 1000 }] },
  "bo",
);
erp.updateWorkPackage(wp.id, { components: [{ itemId: item.id, qtyPerUnitMilli: 2000 }] }, "bo");
assert(
  erp.state.packages[0].components[0].qtyPerUnitMilli === 2000,
  "updateWorkPackage components",
);
throws(
  () =>
    erp.updateWorkPackage(wp.id, { components: [{ itemId: "nope", qtyPerUnitMilli: 1 }] }, "bo"),
  "updateWorkPackage validates itemId",
);
const sup = erp.addParty({
  roles: ["supplier"],
  name: "Sup SA",
  taxId: "A58818501",
  billStreet: "P 1",
  billPostalCode: "08191",
  billCity: "Rubí",
  billProvince: "Barcelona",
  mobile: "600000001",
  email: "s@s.example",
  leadSource: "other",
  activityLine: "other",
});
const pr1 = erp.addPrice(
  { itemId: item.id, supplierId: sup.id, listCents: 900, source: "manualConfirmation" },
  "bo",
);
erp.setToday("2026-03-03");
const pr2 = erp.addPrice(
  { itemId: item.id, supplierId: sup.id, listCents: 5000, source: "manualConfirmation" },
  "bo",
);
erp.voidPrice(pr2.id, "typo", "bo");
assert(
  erp.currentPriceCents(item.id, sup.id) === 900,
  "voidPrice: annulled price skipped",
  erp.currentPriceCents(item.id, sup.id),
);

// budget line editing while draft; frozen once issued
const b = erp.createBudget({ partyId: cust.id }, "bo");
const ch1 = erp.addChapter(b.id, { name: "Demolición" }, "bo");
erp.addLine(
  b.id,
  ch1.id,
  { desc: "Quitar tabique", unit: "m2", qtyMilli: 10000, priceCents: 2100, costCents: 1000 },
  "bo",
);
erp.updateLine(b.id, 1, "1.1", { qtyMilli: 12000, priceCents: 2200 }, "bo");
assert(erp.currentVersion(b.id).chapters[0].lines[0].qtyMilli === 12000, "updateLine qty");
erp.updateChapter(b.id, 1, { name: "Demoliciones" }, "bo");
assert(erp.currentVersion(b.id).chapters[0].name === "Demoliciones", "updateChapter name");
erp.addLine(b.id, ch1.id, { desc: "Pendiente", unit: "u", qtyMilli: 1000, pending: true }, "bo");
erp.resolvePendingLine(b.id, 1, "1.2", { priceCents: 500, costCents: 200 }, "bo");
assert(!erp.currentVersion(b.id).chapters[0].lines[1].pending, "resolvePendingLine clears pending");
erp.removeLine(b.id, 1, "1.2", "bo");
assert(erp.currentVersion(b.id).chapters[0].lines.length === 1, "removeLine renumbers");
erp.updateBudget(b.id, { vatBp: 1000 }, "bo");
assert(erp.budget(b.id).vatBp === 1000, "updateBudget vat");
erp.issueVersion(b.id, {}, "bo");
// Part 2 · item 14: validity is policy — thirty days FROM ISSUE. The
// create-time default counted from the day drafting began, so a slow draft
// went out with a bite already taken from its window.
{
  const d = new Date(erp.state.today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 30);
  const expect = d.toISOString().slice(0, 10);
  assert(
    erp.budget(b.id).validityDate === expect,
    "issuing stamps validity at issue + 30 days",
    `${erp.budget(b.id).validityDate} ≠ ${expect}`,
  );
}
throws(
  () => erp.updateLine(b.id, 1, "1.1", { priceCents: 1 }, "bo"),
  "issued version line is frozen",
);
throws(() => erp.updateBudget(b.id, { vatBp: 2100 }, "bo"), "issued budget header is frozen");

// contract lifecycle
erp.acceptVersion(b.id, erp.currentVersion(b.id).id, { evidenceRef: "email-ok" }, "bo");
const con = erp.createContract(
  b.id,
  {
    installments: [{ pct: 100, trigger: "onSignature", expectedDate: erp.today }],
    duration: { estimatedDays: 30 },
  },
  "bo",
);
/* THE MILESTONES FOOT TO THE CONTRACTED TOTAL.
   `_finishContract` turns each percentage into cents; what the customer is
   asked to pay across the milestones must be what they contracted for. This
   property lived only in a browser check that drove the external-contract
   form, and S6 removed that form — the arithmetic is the ENGINE's, so it
   belongs here.

   Asserted as the engine's OWN contract, which is "within a cent per
   milestone", not "exactly equal": each percentage is rounded
   independently, so three of them can leave the sum a cent or two short, and
   the code says so where it sets `adjustCents`. Measured before writing this
   — a 40/30/30 split of the fixture total divides evenly, and 100001 cents
   drifts by exactly 1 — so an equality assertion would have been green by
   luck on this data and wrong about the rule. */
const conSplit = (() => {
  const b2 = erp.createBudget({ partyId: cust.id, activityLine: "renovation" }, "bo");
  const ch = erp.addChapter(b2.id, { name: "Obra" }, "bo");
  erp.addLine(b2.id, ch.id, { desc: "Trabajo", unit: "ud", qtyMilli: 1000, priceCents: 333333 });
  erp.issueVersion(b2.id, { channel: "hand" }, "bo");
  erp.acceptVersion(b2.id, erp.currentVersion(b2.id).id, { evidenceRef: "ok" }, "bo");
  return erp.createContract(
    b2.id,
    {
      installments: [
        { pct: 40, trigger: "onSignature" },
        { pct: 30, trigger: "atStage" },
        { pct: 30, trigger: "onCompletion" },
      ],
      duration: { estimatedDays: 30 },
    },
    "bo",
  );
})();
const splitSum = conSplit.installments.reduce((s, i) => s + i.amountCents, 0);
assert(
  Math.abs(splitSum - conSplit.totalCents) <= conSplit.installments.length,
  "payment milestones foot to the contracted total",
  `${conSplit.installments.map((i) => i.amountCents).join("+")} = ${splitSum} vs ${conSplit.totalCents}`,
);
assert(
  conSplit.installments.length === 3 && conSplit.installments.every((i) => i.amountCents > 0),
  "…as three separate milestones, each carrying real money",
  JSON.stringify(conSplit.installments.map((i) => i.amountCents)),
);
/* …and `externalRef` reaches the record through `terms`. The drawer sends the
   notaria's own numbering this way (S6); there is no whitelist to add it to,
   which is what made the planned engine change unnecessary. */
assert(
  erp.createContract(
    (() => {
      const b3 = erp.createBudget({ partyId: cust.id, activityLine: "renovation" }, "bo");
      const c3 = erp.addChapter(b3.id, { name: "Obra" }, "bo");
      erp.addLine(b3.id, c3.id, { desc: "T", unit: "ud", qtyMilli: 1000, priceCents: 10000 });
      erp.issueVersion(b3.id, { channel: "hand" }, "bo");
      erp.acceptVersion(b3.id, erp.currentVersion(b3.id).id, { evidenceRef: "ok" }, "bo");
      return b3.id;
    })(),
    { duration: { estimatedDays: 10 }, externalRef: "PROT-2026-99" },
    "bo",
  ).externalRef === "PROT-2026-99",
  "createContract carries the other party's reference onto the record",
);

/* ── PK9-S3 · a payment milestone at a percentage of PROGRESS ──────────────
   «Al llegar a una fase» said nothing a customer could check: which fase, and
   how far into it? The operator asked for thresholds instead — 10 % … 90 % of
   the work done, plus «a la finalización». The trigger and the AMOUNT stay
   independent, which is the whole point: a milestone reached at 50 % progress
   may release a 20 % payment, and the screen has to be able to say so. */
{
  const mk = (installments) => {
    const b = erp.createBudget({ partyId: cust.id, activityLine: "renovation" }, "bo");
    const c = erp.addChapter(b.id, { name: "Obra" }, "bo");
    erp.addLine(b.id, c.id, { desc: "T", unit: "ud", qtyMilli: 1000, priceCents: 100000 });
    erp.issueVersion(b.id, { channel: "hand" }, "bo");
    erp.acceptVersion(b.id, erp.currentVersion(b.id).id, { evidenceRef: "ok" }, "bo");
    return erp.createContract(b.id, { installments, duration: { estimatedDays: 10 } }, "bo");
  };

  const atHalf = mk([
    { pct: 20, trigger: "atProgressPct", progressPct: 50 },
    { pct: 80, trigger: "onCompletion" },
  ]);
  assert(
    atHalf.installments[0].trigger === "atProgressPct" &&
      atHalf.installments[0].progressPct === 50 &&
      atHalf.installments[0].pct === 20,
    "a milestone can fire at 50 % of progress and release 20 % of the money",
    JSON.stringify(atHalf.installments[0]),
  );

  /* The trigger list stopped being decoration. It was declared in `config` and
     read by nothing, so any string at all was accepted as a trigger and the
     document printed it raw at the customer. */
  throws(
    () => mk([{ pct: 100, trigger: "cuandoSalgaElSol" }]),
    "a trigger outside the configured list is refused",
  );
  throws(
    () => mk([{ pct: 100, trigger: "atProgressPct", progressPct: 55 }]),
    "…and a progress threshold off the ten-point scale is refused",
  );
  throws(
    () => mk([{ pct: 100, trigger: "atProgressPct" }]),
    "…and one with no threshold at all is refused",
  );
  assert(
    mk([{ pct: 100, trigger: "atStage", stageRef: "task_1" }]).installments[0].trigger ===
      "atStage",
    "…while atStage still works, because contracts already signed carry it",
  );
}

/* ── PK9-S3 · a second contract on one budget can still find its obra ──────
   `createContract` writes the reverse link only when the project has none
   («never overwrites»), so a second contract on the same budget was unlinked
   for good, and its screen showed «Obra —» with no way to repair it. */
{
  const b = erp.createBudget({ partyId: cust.id, activityLine: "renovation" }, "bo");
  const c = erp.addChapter(b.id, { name: "Obra" }, "bo");
  erp.addLine(b.id, c.id, { desc: "T", unit: "ud", qtyMilli: 1000, priceCents: 50000 });
  erp.issueVersion(b.id, { channel: "hand" }, "bo");
  erp.acceptVersion(b.id, erp.currentVersion(b.id).id, { evidenceRef: "ok" }, "bo");
  const first = erp.createContract(b.id, { duration: { estimatedDays: 5 } }, "bo");
  const prj = erp.createProjectFromAcceptance(b.id, "bo");
  assert(prj.contractId === first.id, "the first contract owns the obra", String(prj.contractId));

  const second = erp.createContract(b.id, { duration: { estimatedDays: 5 } }, "bo");
  assert(
    erp.contractsView().find((x) => x.id === second.id).projectCode === null,
    "a second contract on the same budget starts with no obra — that is the bug",
  );
  erp.linkContractToProject(second.id, prj.id, "bo");
  assert(
    erp.contractsView().find((x) => x.id === second.id).projectCode === prj.code,
    "…and «Vincular obra» repairs it",
  );
  assert(
    erp.contractsView().find((x) => x.id === first.id).projectCode === null,
    "…moving the link rather than duplicating it: one obra has one contract",
  );
  throws(
    () => erp.linkContractToProject(second.id, "prj-does-not-exist", "bo"),
    "linking to an obra that is not there is refused",
  );
}

/* ── PK10-S2 · the obra follows the SIGNATURE, not the filing order ────────
   `createProjectFromAcceptance` took `contracts.find(c => c.budgetId === …)`
   — whatever was pushed first, draft or cancelled or superseded — and
   `signContract` never touched the link at all. So the operator drew up three
   contracts on one accepted quote, signed the third, and the job had been
   pointing at the first since the day it was created: CON-11 refused the first
   invoice on the strength of a draft nobody had signed. */
{
  const signed = { storageKey: "sig-e2e", name: "firmado.pdf" };
  const budget = () => {
    const b = erp.createBudget({ partyId: cust.id, activityLine: "renovation" }, "bo");
    const c = erp.addChapter(b.id, { name: "Obra" }, "bo");
    erp.addLine(b.id, c.id, { desc: "T", unit: "ud", qtyMilli: 1000, priceCents: 50000 });
    erp.issueVersion(b.id, { channel: "hand" }, "bo");
    erp.acceptVersion(b.id, erp.currentVersion(b.id).id, { evidenceRef: "ok" }, "bo");
    return b;
  };
  const terms = { duration: { estimatedDays: 5 } };

  // A · the job is created AFTER the contracts, and takes the signed one.
  {
    const b = budget();
    const one = erp.createContract(b.id, terms, "bo");
    erp.createContract(b.id, terms, "bo");
    const three = erp.createContract(b.id, terms, "bo");
    erp.signContract(three.id, { evidence: signed }, "bo");
    const prj = erp.createProjectFromAcceptance(b.id, "bo");
    assert(
      prj.contractId === three.id,
      "a new obra takes the SIGNED contract, not the first one filed",
      `${prj.contractId} (signed ${three.id}, first ${one.id})`,
    );
  }

  // B · the job exists first, a draft holds it, and signing moves the link.
  {
    const b = budget();
    const draft = erp.createContract(b.id, terms, "bo");
    const prj = erp.createProjectFromAcceptance(b.id, "bo");
    assert(prj.contractId === draft.id, "…the draft holds it while nothing is signed");
    const real = erp.createContract(b.id, terms, "bo");
    erp.signContract(real.id, { evidence: signed }, "bo");
    assert(
      erp.project(prj.id).contractId === real.id,
      "signing a contract claims the obra a draft was holding",
      String(erp.project(prj.id).contractId),
    );
    assert(
      erp.contractsView().find((x) => x.id === draft.id).projectCode === null,
      "…and the draft lets go: one obra, one contract",
    );
  }

  // C · a job already held by a SIGNED contract is left alone.
  {
    const b = budget();
    const first = erp.createContract(b.id, terms, "bo");
    erp.signContract(first.id, { evidence: signed }, "bo");
    const prj = erp.createProjectFromAcceptance(b.id, "bo");
    assert(prj.contractId === first.id, "…the signed contract owns the obra");
    const second = erp.createContract(b.id, terms, "bo");
    erp.signContract(second.id, { evidence: signed }, "bo");
    assert(
      erp.project(prj.id).contractId === first.id,
      "a second signature does NOT steal an obra from a signed contract — that is a question for a person",
      String(erp.project(prj.id).contractId),
    );
  }

  // D · a cancelled contract is never the answer.
  {
    const b = budget();
    const dead = erp.createContract(b.id, terms, "bo");
    erp.cancelContract(dead.id, "rehecho", "bo");
    const live = erp.createContract(b.id, terms, "bo");
    const prj = erp.createProjectFromAcceptance(b.id, "bo");
    assert(
      prj.contractId === live.id,
      "a cancelled contract is never chosen for a new obra",
      String(prj.contractId),
    );
  }

  // E · CON-11 names the record it read, and says where the signature is.
  {
    const b = budget();
    const draft = erp.createContract(b.id, terms, "bo");
    const prj = erp.createProjectFromAcceptance(b.id, "bo");
    const alone = erp
      .previewInvoice({ projectId: prj.id, kind: "progress", baseCents: 1000, lines: [] })
      .blocks.find((x) => x.code === "CON-11");
    assert(
      alone && alone.ref === draft.number,
      "CON-11 names the contract the obra is actually pointing at",
      JSON.stringify(alone && alone.ref),
    );
    const other = erp.createContract(b.id, terms, "bo");
    // Signing would normally claim the obra; hold the link back to reproduce
    // the operator's own state — a signed contract beside an unsigned holder.
    erp.signContract(other.id, { evidence: signed }, "bo");
    erp.linkContractToProject(draft.id, prj.id, "bo");
    const both = erp
      .previewInvoice({ projectId: prj.id, kind: "progress", baseCents: 1000, lines: [] })
      .blocks.find((x) => x.code === "CON-11");
    assert(
      both && both.ref === draft.number + " → " + other.number,
      "…and points at the signed one when there is one",
      JSON.stringify(both && both.ref),
    );
  }
}

/* ── PK9-S3 · terms are the CALLER's, but not all of them ──────────────────
   `createContract` merges the caller's terms object wholesale, which is what
   lets a drawer pass `externalRef` with no whitelist to maintain. The cost is
   that the same door reaches fields the engine owns: `number` comes from a
   gap-free series ORG-04 requires, and `origin` decides whether the screen
   renders our document or the customer's signed file. Neither is a term. */
{
  const mk = (terms) => {
    const b = erp.createBudget({ partyId: cust.id, activityLine: "renovation" }, "bo");
    const c = erp.addChapter(b.id, { name: "Obra" }, "bo");
    erp.addLine(b.id, c.id, { desc: "T", unit: "ud", qtyMilli: 1000, priceCents: 1000 });
    erp.issueVersion(b.id, { channel: "hand" }, "bo");
    erp.acceptVersion(b.id, erp.currentVersion(b.id).id, { evidenceRef: "ok" }, "bo");
    return erp.createContract(b.id, Object.assign({ duration: { estimatedDays: 1 } }, terms), "bo");
  };
  throws(() => mk({ number: "CTR-1999-0001" }), "a contract cannot be handed its own number");
  throws(() => mk({ origin: "external" }), "…nor its origin, which decides what document is shown");
  assert(
    mk({ externalRef: "PROT-1" }).externalRef === "PROT-1",
    "…while the terms a caller IS meant to set still pass straight through",
  );
}

/* ── PK9-S3 · what date a progress milestone actually falls on ─────────────
   `installmentDatesFromPlan` is money-chain item 14 and had no test in any
   suite. The property that matters is not one date — it is that a LATER
   threshold lands on a LATER day, because that is what makes the derivation a
   reading of the plan rather than a plausible constant. */
{
  const b = erp.createBudget({ partyId: cust.id, activityLine: "renovation" }, "bo");
  ["Demolición", "Albañilería", "Pintura", "Limpieza"].forEach((name) => {
    const c = erp.addChapter(b.id, { name }, "bo");
    erp.addLine(b.id, c.id, { desc: name, unit: "m2", qtyMilli: 20000, priceCents: 5000 });
  });
  erp.issueVersion(b.id, { channel: "hand" }, "bo");
  erp.acceptVersion(b.id, erp.currentVersion(b.id).id, { evidenceRef: "ok" }, "bo");
  const con = erp.createContract(
    b.id,
    {
      installments: [
        { pct: 25, trigger: "atProgressPct", progressPct: 20 },
        { pct: 25, trigger: "atProgressPct", progressPct: 80 },
        { pct: 50, trigger: "onCompletion" },
      ],
      duration: { estimatedDays: 30 },
    },
    "bo",
  );
  const prj = erp.createProjectFromAcceptance(b.id, "bo");
  erp.linkContractToProject(con.id, prj.id, "bo");

  const derived = Bridge.scheduling.plans.fromBudget(erp, prj.id, {});
  Bridge.scheduling.plans.save(
    erp.state,
    prj.id,
    Bridge.scheduling.plans.recalculate(derived.plan),
  );

  const dates = Bridge.scheduling.installmentDatesFromPlan(erp, prj.id);
  assert(
    !!dates[0] && !!dates[1] && !!dates[2],
    "every milestone with a plan behind it gets an expected date",
    JSON.stringify(dates),
  );
  assert(
    dates[0] < dates[1],
    "…the 20 % milestone lands before the 80 % one",
    `${dates[0]} vs ${dates[1]}`,
  );
  assert(
    dates[1] <= dates[2],
    "…and both land on or before the finish the plan promises",
    `${dates[1]} vs ${dates[2]}`,
  );
  /* PLANNED, never actual. Recording real progress must not move a date the
     customer agreed to: an expected date is a forecast off the plan, and
     deriving it from the site's week would reprice the calendar every time
     somebody typed a percentage. */
  const before = JSON.stringify(Bridge.scheduling.installmentDatesFromPlan(erp, prj.id));
  const plan = Bridge.scheduling.plans.get(erp.state, prj.id);
  Bridge.scheduling.plans.save(
    erp.state,
    prj.id,
    Bridge.scheduling.plans.setProgress(plan, plan.tasks[0].id, 100, erp.today),
  );
  assert(
    JSON.stringify(Bridge.scheduling.installmentDatesFromPlan(erp, prj.id)) === before,
    "…and recording progress does not move them: the derivation reads the plan, not the site",
  );
}
erp.markContractSent(con.id, "bo");
assert(erp.state.contracts[0].status === "sent", "markContractSent");
const con2status = erp.state.contracts[0];
erp.signContract(con.id, { method: "paper", evidence: { ref: "firmado.pdf" } }, "bo");
throws(() => erp.cancelContract(con.id, "x", "bo"), "signed contract cannot be cancelled");

// project planning fields + reopen
const prj = erp.createProjectFromAcceptance(b.id, "bo");
erp.updateProject(prj.id, { targetEnd: "2026-06-30" }, "bo");
assert(erp.project(prj.id).dates.targetEnd === "2026-06-30", "updateProject targetEnd");
throws(() => erp.reopenProject(prj.id, "bo"), "reopenProject only on closed projects");

// purchases
const pu = erp.addPurchase(
  { supplierId: sup.id, projectId: prj.id, desc: "Placas", qtyMilli: 10000, unitCents: 500 },
  "bo",
);
erp.updatePurchase(pu.id, { qtyMilli: 8000 }, "bo");
assert(
  erp.state.purchases[0].totalCents === 4000,
  "updatePurchase recomputes total",
  erp.state.purchases[0].totalCents,
);
erp.markPurchaseDelivered(pu.id, null, "bo");
assert(erp.state.purchases[0].status.delivered, "markPurchaseDelivered");

// bills: correct while unlocked, locked once paid
const bill = erp.registerBill(
  {
    supplierId: sup.id,
    number: "F-1",
    baseCents: 10000,
    vatBp: 2100,
    allocations: [{ projectId: prj.id, kind: "material", amountCents: 10000 }],
  },
  "bo",
);
erp.correctBill(bill.id, { baseCents: 9000 }, "bo");
assert(
  erp.state.bills[0].totalCents === 9000 + 1890,
  "correctBill recomputes VAT/total",
  erp.state.bills[0].totalCents,
);
erp.allocateBill(bill.id, [{ projectId: prj.id, kind: "material", amountCents: 9000 }], "bo");
const pay = erp.payBills(
  {
    amountCents: erp.state.bills[0].totalCents,
    method: "transfer",
    billAllocations: [{ billId: bill.id, amountCents: erp.state.bills[0].totalCents }],
  },
  "bo",
);
throws(() => erp.correctBill(bill.id, { baseCents: 1 }, "bo"), "paid bill locked");
erp.voidPayment(pay.id, "bo");
assert(
  erp.state.bills[0].status === "registered",
  "voidPayment restores bill status",
  erp.state.bills[0].status,
);

// collections re-allocation
erp.startWorks(prj.id, "bo");
const inv = erp.issueInvoice({ projectId: prj.id, kind: "progress", baseCents: 5000 }, "bo");
const col = erp.recordCollection({ partyId: cust.id, amountCents: 3000, allocations: [] }, "bo");
erp.allocateCollection(col.id, [{ invoiceId: inv.id, amountCents: 3000 }], "bo");
assert(
  erp.invoiceOutstandingCents(inv.id) === inv.totalCents - 3000,
  "allocateCollection applies on-account",
);

// movements
const acc = erp.addBankAccount({ name: "Cuenta", kind: "bank", openingCents: 100000 });
const [mv, mv2] = erp.importMovements(acc.id, [
  { accountingDate: "2026-03-04", concept: "DUP", amountCents: -1000 },
  { accountingDate: "2026-03-04", concept: "COMPRA", amountCents: -2000 },
]);
erp.voidMovement(mv.id, "duplicate import", "bo");
assert(
  erp.accountBalanceCents(acc.id) === 100000 - 2000,
  "voidMovement excluded from balance",
  erp.accountBalanceCents(acc.id),
);
erp.attachMovementDoc(mv2.id, "doc-123", "bo");
assert(
  !erp.state.movements.find((m) => m.id === mv2.id).needsDoc,
  "attachMovementDoc clears needsDoc",
);

// workers + hours
const w = erp.addWorker(
  {
    name: "Oficial",
    kind: "employee",
    rateHistory: [{ from: "2026-01-01", rateCentsPerHour: 1900 }],
  },
  "bo",
);
erp.addWorkerRate(w.id, { from: "2026-04-01", rateCentsPerHour: 2000 }, "bo");
assert(
  erp.workerRateCents(w.id, "2026-05-01") === 2000 &&
    erp.workerRateCents(w.id, "2026-02-01") === 1900,
  "addWorkerRate effective-dated",
);
const h = erp.recordHours({ workerId: w.id, projectId: prj.id, hoursMilli: 8000 }, "bo");
erp.correctHours(h.id, { hoursMilli: 7000 }, "bo");
assert(
  erp.state.labour[0].costCents === Math.round((7000 * 1900) / 1000),
  "correctHours recomputes cost",
  erp.state.labour[0].costCents,
);

// tasks
const t = erp.addTask({ title: "Llamar cliente", due: "2026-03-10" }, "bo");
erp.completeTask(t.id, "bo");
assert(erp.state.tasks[0].status === "done", "completeTask");

// opportunity + recurring + admin patch
const opp = erp.addOpportunity({ partyId: cust.id, desc: "Baño" }, "bo");
erp.updateOpportunity(opp.id, { nextAction: "Llamar lunes" }, "bo");
assert(erp.state.opportunities[0].nextAction === "Llamar lunes", "updateOpportunity nextAction");
const recu = erp.addRecurringInvoice(
  { partyId: cust.id, concept: "Mantenimiento", baseCents: 10000, vatBp: 2100, dayOfMonth: 1 },
  "bo",
);
erp.updateRecurring(recu.id, { baseCents: 12000, active: false }, "bo");
assert(
  erp.state.recurring[0].baseCents === 12000 && erp.state.recurring[0].active === false,
  "updateRecurring",
);
erp.adminPatch("worker", w.id, { name: "Oficial 1ª" }, "bo");
assert(erp.state.workers[0].name === "Oficial 1ª", "adminPatch worker rename");
throws(
  () => erp.adminPatch("invoice", inv.id, { baseCents: 1 }, "bo"),
  "adminPatch refuses invoices",
);

// audit log records corrections
assert(
  erp.state.audit.some((a) => a.action === "correctBill"),
  "corrections audit-logged",
);

// ---------------------------------------------------------------------------
// Regressions: methods that existed but could never succeed, because they read
// a field or collection under a name nothing ever wrote. Each of these threw or
// silently did nothing before; a passing check here is the whole point.
// ---------------------------------------------------------------------------

// resolveRequirement searched p.requirements; addProjectRequirement files into
// p.permits / p.dependencies by type. Both branches must be reachable.
const permit = erp.addProjectRequirement(prj.id, { type: "permit", desc: "Licencia" }, "bo");
const dep = erp.addProjectRequirement(prj.id, { type: "access", desc: "Llaves" }, "bo");
erp.resolveRequirement(prj.id, permit.id, "resolved", "bo");
erp.resolveRequirement(prj.id, dep.id, "resolved", "bo");
assert(
  erp.state.projects.find((p) => p.id === prj.id).permits[0].status === "resolved",
  "resolveRequirement resolves a permit",
);
assert(
  erp.state.projects.find((p) => p.id === prj.id).dependencies[0].status === "resolved",
  "resolveRequirement resolves a dependency",
);

// adminPatch mapped capture -> "captures"; the collection is state.captured.
const cap = erp.captureDocument(
  { docType: "supplierInvoice", imageRef: "f.jpg", keyFields: { note: "x" } },
  "bo",
);
erp.adminPatch("capture", cap.id, { device: "desktop" }, "bo");
assert(
  erp.state.captured.find((c) => c.id === cap.id).device === "desktop",
  "adminPatch reaches captures",
);

// markChangeExecuted stamped a date but left status "approved", so the
// "executed" status in LISTS.changeStatuses was unreachable.
const chg = erp.addChange(prj.id, { desc: "Extra tomas", priceCents: 20000 }, "bo");
erp.priceChange(chg.id, 20000, 12000, "bo");
erp.approveChange(chg.id, { evidenceRef: "firma.png" }, "bo");
erp.markChangeExecuted(chg.id, "bo");
assert(
  erp.state.changes.find((c) => c.id === chg.id).status === "executed",
  "markChangeExecuted sets the status",
);

// correctBill recalculated withholding from b.irpfRateBp; bills store irpfBp,
// so the recalculation was skipped and the total stayed stale.
const supIrpf = erp.addParty(
  {
    name: "Autónomo Pérez",
    taxId: "87654321X",
    partyType: "individual",
    roles: ["supplier"],
    irpfApplies: true,
    irpfRateBp: 1500,
    email: "p@example.com",
    mobile: "600",
    billStreet: "C/ A",
    billPostalCode: "08001",
    billCity: "BCN",
  },
  "bo",
);
const billIrpf = erp.registerBill(
  { supplierId: supIrpf.id, number: "A-1", baseCents: 100000, vatBp: 2100, date: "2026-03-02" },
  "bo",
);
assert(billIrpf.irpfCents === 15000, "bill withholding from supplier profile");
erp.correctBill(billIrpf.id, { baseCents: 200000 }, "bo");
assert(
  billIrpf.irpfCents === 30000 && billIrpf.totalCents === 200000 + 42000 - 30000,
  "correctBill recalculates withholding",
  `irpf ${billIrpf.irpfCents} total ${billIrpf.totalCents}`,
);

// updateBudget whitelisted "validityDays"; the field is validityDate.
const b2 = erp.createBudget({ partyId: cust.id }, "bo");
erp.updateBudget(b2.id, { validityDate: "2026-12-31" }, "bo");
assert(erp.budget(b2.id).validityDate === "2026-12-31", "updateBudget sets validityDate");

// updateRecurring whitelisted "concept"/"dayOfMonth"; the record has
// desc/cadenceMonths/nextDate.
erp.updateRecurring(recu.id, { desc: "Mantenimiento anual", cadenceMonths: 12 }, "bo");
assert(
  erp.state.recurring[0].desc === "Mantenimiento anual" &&
    erp.state.recurring[0].cadenceMonths === 12,
  "updateRecurring sets desc and cadence",
);

// receivables() is what is still owed; a settled invoice belongs in the
// register, not the follow-up list.
const settled = erp.issueInvoice({ projectId: prj.id, kind: "progress", baseCents: 1000 }, "bo");
erp.recordCollection(
  {
    partyId: cust.id,
    amountCents: settled.totalCents,
    allocations: [{ invoiceId: settled.id, amountCents: settled.totalCents }],
  },
  "bo",
);
assert(
  !erp.receivables().some((r) => r.number === settled.number),
  "receivables excludes settled invoices",
);
assert(
  erp.invoiceRegister().some((r) => r.number === settled.number),
  "invoiceRegister keeps settled invoices",
);

// A restored blob written before a collection existed must still have its shape.
const legacyBlob = JSON.parse(JSON.stringify(erp.toJSON()));
delete legacyBlob.assignments;
delete legacyBlob.feedback;
const restored = ERP.from(legacyBlob);
assert(
  Array.isArray(restored.state.assignments) && Array.isArray(restored.state.feedback),
  "ERP.from backfills collections missing from an older blob",
);

// -----------------------------------------------------------------------------
// MDM-03: no two ACTIVE parties may share a tax identifier.
//
// This used to be enforced through findDuplicateParty, which matches on tax id
// OR name OR phone and returns the FIRST hit — so a real duplicate slipped
// through whenever an unrelated party matched first on a shared phone number.
// On a system holding tax records that splits one customer's invoices across
// two records and makes the filing built from them wrong.
// -----------------------------------------------------------------------------
{
  const base = {
    roles: ["customer"],
    billStreet: "x",
    billPostalCode: "08240",
    billCity: "Manresa",
    leadSource: "Web",
  };
  const mdm = new ERP("2026-03-02");
  // Shares a phone with the party added last, so the soft duplicate check
  // matches IT first and its tax id differs.
  mdm.addParty({ ...base, name: "Unrelated", taxId: "35336088S", mobile: "600000000" }, "t");
  mdm.addParty({ ...base, name: "Real Co", taxId: "35336089Q", mobile: "600111111" }, "t");
  throws(
    () => mdm.addParty({ ...base, name: "Sneaky", taxId: "35336089Q", mobile: "600000000" }, "t"),
    "addParty refuses a duplicate tax id even when another party matches first on phone",
  );

  const edit = new ERP("2026-03-02");
  edit.addParty({ ...base, name: "A", taxId: "35336088S", mobile: "600000001" }, "t");
  const b = edit.addParty({ ...base, name: "B", taxId: "35336089Q", mobile: "600000002" }, "t");
  throws(
    () => edit.updateParty(b.id, { taxId: "35336088S" }, "t"),
    "updateParty refuses editing a tax id into a collision",
  );

  // The rule is about ACTIVE parties: a deactivated holder must not block a
  // legitimate re-registration under the same identifier.
  const reuse = new ERP("2026-03-02");
  const old = reuse.addParty(
    { ...base, name: "Old", taxId: "35336088S", mobile: "600000003" },
    "t",
  );
  reuse.deactivateParty(old.id, "t");
  let reused = true;
  try {
    reuse.addParty({ ...base, name: "New", taxId: "35336088S", mobile: "600000004" }, "t");
  } catch {
    reused = false;
  }
  assert(reused, "an INACTIVE tax-id holder does not block re-registration");

  /* The refusal has to NAME the record it is protecting.
     Reported from the operator's own instance: registering a client was
     refused with «Duplicate active party for tax id 07300000F» and nothing
     in the product would say which record held it — this rule reads the
     whole party file, Clientes lists only the customer role, and no
     register's search looked at a tax id at all. A refusal that names an
     identifier the operator cannot search for is a dead end. */
  const named = new ERP("2026-03-02");
  named.addParty(
    { ...base, roles: ["supplier"], name: "Suministros Ocultos SL", taxId: "35336088S" },
    "t",
  );
  let refusal = "";
  try {
    named.addParty({ ...base, name: "Cliente Nuevo", taxId: "35336088S" }, "t");
  } catch (e) {
    refusal = e.message;
  }
  assert(
    refusal.includes("Suministros Ocultos SL"),
    "the tax-id refusal names the record that holds it",
    refusal,
  );
  assert(
    /T-\d{4}/.test(refusal),
    "…and its code, so it can be found in whichever register it lives in",
    refusal,
  );

  /* Case and punctuation are presentation, not identity. The uniqueness rule
     compared stored strings raw while validation normalised, so the same
     taxpayer typed with a dash walked straight past a HARD rule. */
  const punct = new ERP("2026-03-02");
  punct.addParty({ ...base, name: "Canónico", taxId: "35336088S" }, "t");
  throws(
    () => punct.addParty({ ...base, name: "Con guion", taxId: "35336088-s" }, "t"),
    "the same tax id written with a dash and in lower case is still the same tax id",
  );

  /* The refusal has to say WHAT is wrong, not just that something is.
     Reported on 28/08: «Invalid Tax ID» and nothing else — no format, no
     character, no fix. A wrong DNI check letter and nine characters that
     match no Spanish document at all are two different mistakes, and the
     message now says which one this is, and for the DNI/NIE case names the
     letter that WOULD be correct. */
  const badLetter = new ERP("2026-03-02");
  let reason = "";
  try {
    badLetter.addParty({ ...base, name: "Letra mala", taxId: "07000000F" }, "t");
  } catch (e) {
    reason = e.message;
  }
  assert(
    reason.includes("DNI/NIF") && reason.includes("debería ser L"),
    "a DNI with the wrong check letter names the format AND the correct letter",
    reason,
  );
  const badCif = new ERP("2026-03-02");
  reason = "";
  try {
    badCif.addParty({ ...base, name: "CIF malo", taxId: "B12345678" }, "t");
  } catch (e) {
    reason = e.message;
  }
  assert(reason.includes("CIF"), "a bad CIF names itself as a CIF, not a generic refusal", reason);
  const noShape = new ERP("2026-03-02");
  reason = "";
  try {
    noShape.addParty({ ...base, name: "Sin forma", taxId: "1234" }, "t");
  } catch (e) {
    reason = e.message;
  }
  assert(
    /longitud/.test(reason),
    "a value too short to be any Spanish document says so, not «invalid»",
    reason,
  );
  // And a genuinely valid identifier is unaffected by any of the above.
  const ok = new ERP("2026-03-02");
  const okRec = ok.addParty({ ...base, name: "Bien", taxId: "07000000L" }, "t");
  assert(okRec.taxId === "07000000L", "a correct DNI is still accepted outright");
}

// -----------------------------------------------------------------------------
// MDM-05: inmuebles can be READ BACK and CORRECTED, not only created.
//
// addProperty existed with no way back to a record once made — every
// property() call, no getter, no update — so every inmueble in the system
// came from the seed. Reported on 28/08 as two symptoms of the same gap: a
// new client has nowhere to be given a property, and Maestros → Clientes
// could show one but never fix a typo in it.
// -----------------------------------------------------------------------------
{
  const e = new ERP("2026-03-02");
  const cust = e.addParty(
    { roles: ["customer"], name: "Con Inmueble", billStreet: "x", billPostalCode: "08960" },
    "t",
  );
  const pr = e.addProperty(
    { partyId: cust.id, street: "C/ Prova 1", postalCode: "08960", city: "Sant Just" },
    "t",
  );
  assert(e.property(pr.id).id === pr.id, "property(id) reads back what addProperty created");
  throws(() => e.property("nope"), "property(id) refuses an id that does not exist");

  const updated = e.updateProperty(pr.id, { street: "C/ Corregida 2", surfaceM2: 88 }, "t");
  assert(
    updated.street === "C/ Corregida 2" && updated.surfaceM2 === 88,
    "updateProperty corrects the fields it is given",
  );
  assert(
    e.property(pr.id).partyId === cust.id,
    "…without touching fields the patch did not mention",
  );

  // Reassignment is a different, deliberate act — not a side effect of fixing a street name.
  const other = e.addParty(
    { roles: ["customer"], name: "Otro Cliente", billStreet: "y", billPostalCode: "08008" },
    "t",
  );
  e.updateProperty(pr.id, { partyId: other.id, street: "Intento de robo" }, "t");
  assert(
    e.property(pr.id).partyId === cust.id,
    "updateProperty refuses to move a property to a different client",
  );
  assert(
    e.property(pr.id).street === "Intento de robo",
    "…while the field actually offered still saves",
  );
}

// -----------------------------------------------------------------------------
// Subcontracts: the lifecycle, kept alive after its screens were retired.
//
// The v4 specification has no subcontract-management screen, so S1b removed the
// UI — but the DATA and the rules stay (operator decision), and the browser
// checks that used to walk that screen were the only thing exercising them.
// Deleting those checks with the screen would have quietly un-covered 69 engine
// references, so the coverage moves down a layer instead of disappearing: same
// guarantees, asserted where they actually live.
// -----------------------------------------------------------------------------
{
  const sub = erp.addSubcontract(
    prj.id,
    { supplierId: supIrpf.id, trade: "Fontanería", awardedCents: 300000, retentionPct: 5 },
    "bo",
  );
  assert(
    sub.status === "draft" && sub.number.startsWith("SUB-"),
    "a subcontract is numbered and starts as a draft",
  );

  throws(
    () => erp.certifySubcontract(sub.id, { amountCents: 1000 }, "bo"),
    "certifying before acceptance is refused",
  );

  erp.sendSubcontract(sub.id, "bo");
  erp.acceptSubcontract(sub.id, { plannedStart: "2026-03-10" }, "bo");
  assert(
    erp.state.subcontracts.find((s) => s.id === sub.id).status === "accepted",
    "send then accept moves it to accepted",
  );

  // The rule worth keeping most: work cannot START while mandatory
  // documentation is missing or expired. Blocked, not merely flagged.
  assert(
    erp.subcontractDocStatus(sub).worst === "r",
    "a new subcontract has no documentation, so its worst status is red",
  );
  throws(
    () => erp.markSubcontractStarted(sub.id, "bo"),
    "starting on site is BLOCKED while mandatory documentation is missing",
  );

  for (const { kind } of erp.subcontractDocStatus(sub).items)
    erp.renewSubcontractDoc(sub.id, { kind, expiresOn: "2027-01-01", docRef: "doc.pdf" }, "bo");
  assert(
    erp.subcontractDocStatus(erp.state.subcontracts.find((s) => s.id === sub.id)).worst === "g",
    "filing every document in date turns the status green",
  );

  erp.markSubcontractStarted(sub.id, "bo");
  assert(
    erp.state.subcontracts.find((s) => s.id === sub.id).status === "inExecution",
    "with the documentation in order, work can start",
  );

  // An expired document must re-block a subcontract that already started —
  // otherwise the check is a one-off at the gate rather than a standing rule.
  const first = erp.subcontractDocStatus(sub).items[0].kind;
  erp.renewSubcontractDoc(
    sub.id,
    { kind: first, expiresOn: "2026-01-01", docRef: "old.pdf" },
    "bo",
  );
  assert(
    erp.subcontractDocStatus(erp.state.subcontracts.find((s) => s.id === sub.id)).worst === "r",
    "a document that lapses turns the subcontract red again",
  );
  erp.renewSubcontractDoc(
    sub.id,
    { kind: first, expiresOn: "2027-01-01", docRef: "new.pdf" },
    "bo",
  );

  erp.certifySubcontract(sub.id, { amountCents: 100000, note: "primera certificación" }, "bo");
  const certified = erp.state.subcontracts.find((s) => s.id === sub.id);
  assert(
    certified.certifications.length === 1 && certified.certifications[0].amountCents === 100000,
    "executed work is valued as a certification against the award",
  );
}

// -----------------------------------------------------------------------------
// S2: the CIF check digit, the four gap fields, the completeness/issuance
// rules the v4 doc's DMT screens depend on, and the workers registry (DMT-04).
// -----------------------------------------------------------------------------
{
  // The DNI/NIE branches of validTaxId compute their check letter; the CIF
  // branch used to accept anything of the right SHAPE. This is what let a
  // scanned NIF come back wrong-but-plausible during the S0b OCR spike.
  const { validTaxId } = require("../../site/erp-engine.js");
  assert(validTaxId("A58881509"), "CIF: correct digit control passes (org type requiring a digit)");
  assert(!validTaxId("A58881508"), "CIF: wrong digit control fails");
  assert(
    validTaxId("N0012345E"),
    "CIF: correct letter control passes (org type requiring a letter)",
  );
  assert(!validTaxId("N00123455"), "CIF: a digit where a letter-only org needs a letter fails");
  assert(
    validTaxId("C12345674") && validTaxId("C1234567D"),
    "CIF: either form passes for an org type that accepts both",
  );
  assert(!validTaxId("C1234567X"), "CIF: neither form still fails");
}
{
  // Gap fields 1-4 (plan): businessLine, category, sourceSystem, aliases[].
  // Present on a fresh party, round-trip through an edit, and — the actual
  // point — the workbook's «Nombres originales» column has somewhere real to
  // land, which is the only way a later filtered upload can re-match a
  // supplier against what is already on file.
  const sup = erp.addParty(
    {
      roles: ["supplier"],
      name: "Suministros de Prueba",
      taxId: "B65410011",
      billStreet: "C/ B 2",
      billPostalCode: "08002",
      billCity: "BCN",
      billProvince: "Barcelona",
      mobile: "600222333",
      businessLine: "Canei",
      category: "Fontanería",
      sourceSystem: "Factura Canei",
      aliases: ["Suministros Prueba SL", "SUM. PRUEBA"],
    },
    "bo",
  );
  assert(
    sup.businessLine === "Canei" &&
      sup.category === "Fontanería" &&
      sup.sourceSystem === "Factura Canei",
    "gap fields 1-3 round-trip through addParty",
  );
  assert(
    Array.isArray(sup.aliases) && sup.aliases.length === 2,
    "gap field 4 (aliases[]) round-trips through addParty",
  );
  erp.updateParty(sup.id, { aliases: [...sup.aliases, "Suministros P."] }, "bo");
  assert(
    erp.party(sup.id).aliases.length === 3,
    "aliases[] is editable, not just settable at creation",
  );

  // The stale "activityLine" reference in partyCompleteness's extras — a field
  // that left the party model in v9 — used to make EVERY party read as
  // permanently missing it. businessLine is the field that actually exists;
  // this party already set it, so it should not appear as recommended-missing.
  const c = erp.partyCompleteness(sup.id);
  assert(
    !c.recommendedMissing.includes("activityLine"),
    "partyCompleteness no longer references the removed party.activityLine field",
  );
  assert(
    !c.recommendedMissing.includes("businessLine"),
    "a party that set businessLine is not flagged as missing it",
  );
}
{
  // Decision 21: capture proceeds regardless of completeness; only the two
  // FISCAL documents — contrato and factura — are blocked. This is the rule
  // the DMT completeness ring exists to make visible before it becomes a
  // block, so both halves are asserted: presupuesto issues, contrato/factura
  // do not.
  const bare = erp.addParty({ roles: ["customer"], name: "Cliente Incompleto" }, "bo");
  assert(!erp.partyCompleteness(bare.id).ok, "sanity: this party really is incomplete");

  const bb = erp.createBudget({ partyId: bare.id }, "bo");
  const bc1 = erp.addChapter(bb.id, { name: "Obra" }, "bo");
  erp.addLine(
    bb.id,
    bc1.id,
    { desc: "Trabajo", unit: "u", qtyMilli: 1000, priceCents: 1000, costCents: 500 },
    "bo",
  );
  // channel:"inPerson" sidesteps the SEPARATE, unrelated "email required to
  // send electronically" check (MDM-04) — this assertion is about
  // completeness, not about whether the party happens to have an email.
  let issued = false;
  try {
    erp.issueVersion(bb.id, { channel: "inPerson" }, "bo");
    issued = true;
  } catch {
    issued = false;
  }
  assert(
    issued,
    "issueVersion succeeds for an incomplete party (presupuesto is not a fiscal document)",
  );

  throws(
    () => erp.createContract(bb.id, { installments: [], duration: { estimatedDays: 1 } }, "bo"),
    "createContract still refuses an incomplete party",
  );
  throws(
    () => erp.issueInvoice({ partyId: bare.id, kind: "progress", baseCents: 1000 }, "bo"),
    "issueInvoice still refuses an incomplete party",
  );
}
{
  // DMT-04 Personal Interno: the workers registry had no code, no contact
  // fields and no active flag — a timesheet needed only a name. A master-data
  // screen needs all four.
  const w = erp.addWorker({ name: "Trabajador de Prueba" }, "bo");
  assert(/^P-\d{4}$/.test(w.code), "addWorker assigns a human-readable code");
  assert(w.active === true, "a new worker defaults to active");
  erp.adminPatch(
    "worker",
    w.id,
    { taxId: "12345678Z", phone: "600333444", email: "t@example.com" },
    "bo",
  );
  const w2 = erp.state.workers.find((x) => x.id === w.id);
  assert(
    w2.taxId === "12345678Z" && w2.phone === "600333444",
    "worker contact fields are editable via adminPatch",
  );

  // Deactivate, never delete — same rule as everywhere else in this system.
  erp.adminPatch("worker", w.id, { active: false }, "bo");
  assert(
    erp.state.workers.find((x) => x.id === w.id).active === false &&
      erp.state.workers.some((x) => x.id === w.id),
    "a deactivated worker stays on record",
  );
}
{
  // updateWorker/deactivateWorker: the dedicated DMT-04 screen entry points
  // (adminPatch above is the generic escape hatch every screen used before
  // this session; the screen itself calls these).
  const w = erp.addWorker({ name: "Ana Ferrer", kind: "employee" }, "bo");
  erp.updateWorker(w.id, { phone: "600555666" }, "bo");
  assert(
    erp.state.workers.find((x) => x.id === w.id).phone === "600555666",
    "updateWorker patches a worker's fields",
  );
  throws(
    () => erp.addWorker({ name: "NIF Roto", taxId: "46000000A" }, "bo"),
    "addWorker rejects a tax id with the wrong check digit",
  );
  throws(
    () => erp.updateWorker(w.id, { taxId: "46000000A" }, "bo"),
    "updateWorker rejects a tax id with the wrong check digit",
  );
  erp.deactivateWorker(w.id, "bo");
  assert(
    erp.state.workers.find((x) => x.id === w.id).active === false,
    "deactivateWorker sets active false and keeps the record",
  );
  throws(() => erp.updateWorker("wkr-missing", {}, "bo"), "updateWorker refuses an unknown id");
  throws(() => erp.deactivateWorker("wkr-missing", "bo"), "deactivateWorker refuses an unknown id");
}
{
  // MDM: findDuplicateParty is a soft warning surfaced on the record itself
  // (duplicateSuspect), not a refusal — the UI reads this to warn at the
  // point of creation (DMT-01/02/03) rather than leaving it to be
  // discovered only when a factura chain gets confused between two records.
  const first = erp.addParty(
    { roles: ["customer"], name: "Duplicado Uno", mobile: "600777888" },
    "bo",
  );
  assert(first.duplicateSuspect == null, "the first party of its kind has no duplicate suspect");
  const second = erp.addParty(
    { roles: ["customer"], name: "Otro Nombre", mobile: "600777888" },
    "bo",
  );
  assert(
    second.duplicateSuspect === first.id,
    "a matching phone number surfaces the earlier party as a duplicate suspect",
  );
}

// -----------------------------------------------------------------------------
// S4: COM-01/02 — the visit lifecycle (scheduled → done) and lead management.
// -----------------------------------------------------------------------------
{
  const cust = erp.addParty(
    { roles: ["customer"], name: "Cliente Visita", mobile: "699888777" },
    "bo",
  );
  const opp = erp.addOpportunity(
    { partyId: cust.id, requestedWork: "Reforma cocina", source: "referrer" },
    "bo",
  );
  assert(opp.status === "awaitingVisit", "sanity: a new opportunity awaits a visit");

  throws(() => erp.scheduleVisit({}, "bo"), "scheduleVisit refuses without an opportunity");
  throws(
    () => erp.scheduleVisit({ opportunityId: opp.id }, "bo"),
    "scheduleVisit refuses without a date",
  );

  const v = erp.scheduleVisit(
    {
      opportunityId: opp.id,
      scheduledAt: "2026-06-01",
      scheduledTime: "10:00",
      owner: "operations",
    },
    "bo",
  );
  assert(v.status === "scheduled", "scheduleVisit creates a scheduled, not-yet-done visit");
  assert(v.date === null, "a scheduled visit has no completion date yet");
  assert(
    erp.state.opportunities.find((o) => o.id === opp.id).status === "awaitingVisit",
    "scheduling a visit does not by itself advance the opportunity",
  );

  const completed = erp.completeVisit(
    v.id,
    { measurements: [{ what: "cocina", qty: 8, unit: "m2" }], notes: "medido" },
    "bo",
  );
  assert(completed.status === "done", "completeVisit marks the visit done");
  assert(completed.measurements.length === 1, "completeVisit records the capture");
  assert(
    erp.state.opportunities.find((o) => o.id === opp.id).status === "awaitingBudget",
    "completing a visit advances the opportunity to awaitingBudget",
  );
  throws(
    () => erp.completeVisit(v.id, {}, "bo"),
    "completeVisit refuses on an already-completed visit",
  );

  erp.validateVisit(v.id, { budgetId: "bud_test", notes: "corregida" }, "bo");
  assert(
    erp.state.visits.find((x) => x.id === v.id).budgetId === "bud_test",
    "validateVisit links a budget to the visit after the fact",
  );

  // addVisit (the one-step, backward-compatible path used by seed/history)
  // still produces a visit that reads as done under the new lifecycle.
  const direct = erp.addVisit({ opportunityId: opp.id, notes: "captura directa" }, "bo");
  assert(
    direct.status === "done",
    "addVisit still produces an already-done visit (backward compat)",
  );
  assert(
    direct.scheduledAt === direct.date,
    "addVisit's scheduledAt matches its date when not overridden",
  );

  // loseOpportunity — the other way an opportunity leaves the open list.
  const opp2 = erp.addOpportunity(
    { partyId: cust.id, requestedWork: "Baño", source: "website" },
    "bo",
  );
  erp.loseOpportunity(opp2.id, "price", "bo");
  const lost = erp.state.opportunities.find((o) => o.id === opp2.id);
  assert(
    lost.status === "lost" && lost.lossReason === "price",
    "loseOpportunity records status and reason",
  );
  assert(
    !erp.opportunityAges().some((o) => o.id === opp2.id),
    "a lost opportunity drops out of opportunityAges (the open list)",
  );

  // updateOpportunity's one hard rule: a won deal cannot be silently reopened.
  const opp3 = erp.addOpportunity(
    { partyId: cust.id, requestedWork: "Terraza", source: "website" },
    "bo",
  );
  erp.updateOpportunity(opp3.id, { status: "won" }, "bo");
  throws(
    () => erp.updateOpportunity(opp3.id, { status: "open" }, "bo"),
    "updateOpportunity refuses to reopen a won opportunity",
  );
}

// ---------------------------------------------------------------------------
// S5: COM-03 — reordering, free numbering, and the five stages of a budget.
//
// The presupuestador is the one screen where the ORDER of things is part of
// the document, so the checks below are mostly about what a reorder means to
// the numbers a customer reads, and about which of them a person is allowed
// to overrule.
// ---------------------------------------------------------------------------
{
  const bud = erp.createBudget({ partyId: cust.id }, "bo");
  const cA = erp.addChapter(bud.id, { name: "Demoliciones" });
  const cB = erp.addChapter(bud.id, { name: "Albañilería" });
  const cC = erp.addChapter(bud.id, { name: "Pintura", section: "optional" });
  const lA1 = erp.addLine(bud.id, cA.id, {
    desc: "Retirada",
    unit: "m2",
    qtyMilli: 10000,
    priceCents: 1000,
    costCents: 600,
  });
  const lA2 = erp.addLine(bud.id, cA.id, {
    desc: "Carga",
    unit: "m3",
    qtyMilli: 2000,
    priceCents: 5000,
    costCents: 3000,
  });
  const lB1 = erp.addLine(bud.id, cB.id, {
    desc: "Tabique",
    unit: "m2",
    qtyMilli: 8000,
    priceCents: 4000,
    costCents: 2500,
  });
  const ver = () => erp.currentVersion(bud.id);
  const numOf = (id) => erp.findLine(bud.id, id).line.num;

  assert(
    lA1.manualNum === false && cA.manualNum === false,
    "a new chapter and line record explicitly that their number was not typed",
  );

  // Reordering chapters. The lines have to follow, or the document's index
  // stops matching the document.
  erp.moveChapter(bud.id, cC.id, 0, "bo");
  assert(
    ver()
      .chapters.map((c) => c.name)
      .join(",") === "Pintura,Demoliciones,Albañilería",
    "moveChapter reorders the chapters",
  );
  assert(
    ver()
      .chapters.map((c) => c.num)
      .join(",") === "1,2,3",
    "moveChapter renumbers the chapters it moved past",
  );
  assert(numOf(lA1.id) === "2.1", "a moved chapter's lines renumber with it");
  erp.moveChapter(bud.id, cC.id, 2, "bo");

  // Reordering lines, including across chapters — the case that matters,
  // because the destination chapter's `section` decides which subtotal (and
  // which part of the customer's document) the line lands in.
  erp.moveLine(bud.id, lA2.id, cA.id, 0, "bo");
  assert(
    numOf(lA2.id) === "1.1" && numOf(lA1.id) === "1.2",
    "moveLine reorders within a chapter and renumbers both rows",
  );
  const beforeMove = erp.budgetTotals(bud.id);
  erp.moveLine(bud.id, lA2.id, cC.id, 0, "bo");
  assert(
    erp.findLine(bud.id, lA2.id).chapter.id === cC.id && numOf(lA2.id) === "3.1",
    "moveLine moves a line into another chapter and it takes that chapter's numbering",
  );
  assert(numOf(lA1.id) === "1.1", "the chapter it left closes its gap");
  const afterMove = erp.budgetTotals(bud.id);
  assert(
    afterMove.baseCents === beforeMove.baseCents - 10000 &&
      afterMove.optionsCents === beforeMove.optionsCents + 10000,
    "and the money moves with it — out of the base subtotal, into the optional one",
  );
  erp.moveLine(bud.id, lA2.id, cA.id, 1, "bo");

  // Free numbering: a number a person typed outranks the positional scheme.
  erp.setLineNumber(bud.id, lA1.id, "EX-7", "bo");
  assert(numOf(lA1.id) === "EX-7", "setLineNumber takes a typed number verbatim");
  erp.addLine(bud.id, cA.id, { desc: "Otra", unit: "ud", qtyMilli: 1000, priceCents: 100 });
  assert(numOf(lA1.id) === "EX-7", "a typed number survives an insert that would renumber it");
  erp.moveChapter(bud.id, cA.id, 2, "bo");
  assert(numOf(lA1.id) === "EX-7", "and survives its own chapter being dragged elsewhere");
  throws(
    () => erp.setLineNumber(bud.id, lB1.id, "EX-7", "bo"),
    "two rows may not share one number — it is the reader's only index",
  );
  erp.setLineNumber(bud.id, lA1.id, "", "bo");
  assert(
    erp.findLine(bud.id, lA1.id).line.manualNum === false && /^\d+\.\d+$/.test(numOf(lA1.id)),
    "clearing a typed number hands the row back to automatic numbering",
  );
  erp.setChapterNumber(bud.id, cB.id, "CAP-A", "bo");
  assert(
    ver().chapters.find((c) => c.id === cB.id).num === "CAP-A",
    "a chapter number can be typed too",
  );
  assert(numOf(lB1.id).startsWith("CAP-A."), "and its automatic lines follow it");
  erp.setChapterNumber(bud.id, cB.id, "", "bo");

  // The document is still the same arithmetic as the panel beside it.
  const tot = erp.budgetTotals(bud.id);
  const doc = erp.renderBudgetDoc(bud.id, bud.currentVersionId);
  assert(
    doc.totals.grandCents === tot.grandCents,
    "after all that reordering the document total still equals budgetTotals",
  );
  assert(
    !/costCents|margin/.test(JSON.stringify(doc)),
    "and no cost or margin field reaches the customer document",
  );

  // The five stages, derived rather than stored.
  assert(erp.budgetStage(bud.id) === "draft", "budgetStage: nothing issued yet is a draft");
  erp.issueVersion(bud.id, { channel: "email" }, "bo");
  assert(erp.budgetStage(bud.id) === "issued", "budgetStage: issued and unanswered is issued");

  const frozen = [
    ["moveChapter", () => erp.moveChapter(bud.id, cA.id, 0, "bo")],
    ["moveLine", () => erp.moveLine(bud.id, lB1.id, cA.id, 0, "bo")],
    ["setLineNumber", () => erp.setLineNumber(bud.id, lB1.id, "Z1", "bo")],
    ["setChapterNumber", () => erp.setChapterNumber(bud.id, cA.id, "Z", "bo")],
  ];
  for (const [name, fn] of frozen)
    throws(fn, `${name} refuses to re-sequence a version already sent`);

  erp.rejectVersion(bud.id, bud.currentVersionId, { reason: "price", notes: "Muy caro" }, "bo");
  assert(erp.budgetStage(bud.id) === "rejected", "budgetStage: a refused budget is rejected");
  const resp = erp.version(bud.id, bud.currentVersionId).customerResponse;
  assert(
    resp.accepted === false && resp.reason === "price" && resp.notes === "Muy caro",
    "rejectVersion records the refusal, its reason code and what the customer said",
  );
  throws(
    () => erp.rejectVersion(bud.id, bud.currentVersionId, { reason: "price" }, "bo"),
    "a version cannot be answered twice",
  );
  throws(
    () => erp.acceptVersion(bud.id, bud.currentVersionId, {}, "bo"),
    "and a refused version cannot then be accepted, overwriting the refusal",
  );

  // Expiry is the one stage nothing writes: it becomes true on a date.
  const bud2 = erp.createBudget({ partyId: cust.id }, "bo");
  const c2 = erp.addChapter(bud2.id, { name: "Cap" });
  erp.addLine(bud2.id, c2.id, {
    desc: "L",
    unit: "ud",
    qtyMilli: 1000,
    priceCents: 10000,
    costCents: 6000,
  });
  erp.issueVersion(bud2.id, { channel: "email" }, "bo");
  assert(erp.budgetStage(bud2.id) === "issued", "budgetStage: inside its validity, issued");
  const realToday = erp.state.today;
  erp.state.today = "2099-01-01";
  assert(
    erp.budgetStage(bud2.id) === "expired",
    "budgetStage: past its validity date the same record reads expired",
  );
  assert(
    erp.budget(bud2.id).status === "issued",
    "…with no stored status having changed — nothing was written on that date",
  );
  const bud3 = erp.createBudget({ partyId: cust.id }, "bo");
  assert(
    erp.budgetStage(bud3.id) === "draft",
    "budgetStage: a draft past its validity is not expired",
  );
  erp.state.today = realToday;
}

/* ---- S7 · ADM-03 allocation and ADM-02 stages ---------------------------
   Every rule here is enforced in the engine rather than by the screen that
   calls it, so it stays true of the next screen too — the distinction S1b
   drew when the subcontract UI was retired and its guarantees moved down a
   layer rather than out of the product. */
{
  const cap = erp.captureDocument(
    {
      docType: "supplierInvoice",
      imageRef: "blob-s7",
      sourcePath: "2026/proveedores/cerygres.pdf",
      reference: "PED-4471",
      notes: "material del baño",
    },
    "bo",
  );
  assert(
    cap.sourcePath === "2026/proveedores/cerygres.pdf" &&
      cap.reference === "PED-4471" &&
      cap.notes === "material del baño",
    "gaps 10-11: a capture keeps its origin, its reference and its note",
  );
  const bare = erp.captureDocument({ docType: "ticket" }, "bo");
  assert(
    bare.sourcePath === "" && bare.reference === "" && bare.notes === "",
    "…and a capture given none of the three carries empty strings, not absent keys",
  );

  erp.updateCapture(cap.id, { notes: "corregido" }, "bo");
  assert(erp.state.captured.find((c) => c.id === cap.id).notes === "corregido", "updateCapture");
  const before = erp.state.captured.find((c) => c.id === cap.id).stdName;
  erp.updateCapture(cap.id, { reference: "PED-9999" }, "bo");
  assert(
    erp.state.captured.find((c) => c.id === cap.id).stdName === before,
    "updateCapture does not rename the filed document — the archive name is not a note",
  );
  throws(() => erp.updateCapture("nope", { notes: "x" }, "bo"), "updateCapture on a missing id");

  erp.confirmCapture(
    cap.id,
    {
      issuerName: "Sup SA",
      issuerTaxId: "A58818501",
      docNumber: "F-1",
      date: erp.today,
      baseCents: 10000,
      vatCents: 2100,
      totalCents: 12100,
    },
    "bo",
  );
  /* PK10-S3 · these amounts changed from 12100 to 10000 DELIBERATELY. The
     document is 10.000 base + 2.100 IVA = 12.100 total, and a split now foots
     against the base, because an allocation distributes the cost and the tax
     is not one. Each refusal below is meant to fire for the reason it names,
     so its amount is the one that would otherwise have been accepted. */
  throws(() => erp.allocateCapture(cap.id, [], "bo"), "a document must be allocated to something");
  throws(
    () =>
      erp.allocateCapture(
        cap.id,
        [{ projectId: prj.id, overheadCategory: "office", amountCents: 10000 }],
        "bo",
      ),
    "a line naming both a project and an overhead category is refused",
  );
  throws(
    () => erp.allocateCapture(cap.id, [{ amountCents: 10000 }], "bo"),
    "a line naming neither is refused too",
  );
  throws(
    () => erp.allocateCapture(cap.id, [{ overheadCategory: "biscuits", amountCents: 10000 }], "bo"),
    "an overhead category the engine does not know is refused",
  );
  throws(
    () =>
      erp.allocateCapture(cap.id, [{ projectId: prj.id, kind: "vibes", amountCents: 10000 }], "bo"),
    "a cost kind the engine does not know is refused",
  );
  throws(
    () => erp.allocateCapture(cap.id, [{ projectId: "prj-gone", amountCents: 10000 }], "bo"),
    "a project that is not there is refused, by the accessor that names it",
  );
  throws(
    () => erp.allocateCapture(cap.id, [{ projectId: prj.id, amountCents: 9000 }], "bo"),
    "a split that does not total the taxable base is refused",
  );
  throws(
    () => erp.allocateCapture(cap.id, [{ projectId: prj.id, amountCents: 12100 }], "bo"),
    "…and neither does one that totals the VAT-inclusive amount",
  );
  const split = erp.allocateCapture(
    cap.id,
    [
      { projectId: prj.id, chapterNum: "1", kind: "material", amountCents: 8000 },
      { overheadCategory: "office", amountCents: 2000 },
    ],
    "bo",
  );
  assert(
    split.status === "allocated" && split.allocations.length === 2,
    "a document splits across a project and an overhead category",
  );
  assert(
    split.allocations[1].projectId === null && split.allocations[0].overheadCategory === null,
    "…and each line carries exactly one destination",
  );

  // ADM-02's three stages, derived from the same facts as the seven statuses.
  const pu = erp.addPurchase(
    { supplierId: sup.id, projectId: prj.id, desc: "Azulejo", qtyMilli: 1000, unitCents: 5000 },
    "bo",
  );
  assert(erp.purchaseStage(pu) === "offer", "purchaseStage: a draft order is an oferta");
  erp.sendPurchase(pu.id, "bo");
  assert(erp.purchaseStage(pu) === "order", "purchaseStage: a sent order is a pedido");
  const t = erp.purchaseTotals(pu);
  assert(
    t.baseCents === 5000 && t.vatCents === 1050 && t.totalCents === 6050,
    "purchaseTotals derives the tax rather than storing it",
    JSON.stringify(t),
  );
  const summary = erp.purchaseStageSummary(prj.id);
  assert(
    summary.order.count >= 1 && summary.order.amountCents >= 5000,
    "purchaseStageSummary counts and totals by stage",
  );
  erp.cancelPurchase(pu.id, "supplier out of stock", "bo");
  assert(
    erp.purchaseStage(pu) === "cancelled",
    "purchaseStage: a cancelled order is its own thing",
  );
  const after = erp.purchaseStageSummary(prj.id);
  assert(
    after.offer.count + after.order.count + after.invoiced.count ===
      summary.offer.count + summary.order.count + summary.invoiced.count - 1,
    "…and it is counted in none of the three, rather than quietly in one",
  );

  const pu2 = erp.addPurchase({ supplierId: sup.id, projectId: prj.id, unitCents: 100 }, "bo");
  erp.attachPurchaseDocument(pu2.id, cap.id, "bo");
  assert(
    erp.state.purchases.find((x) => x.id === pu2.id).docRefs.includes(cap.id),
    "attachPurchaseDocument links the supplier's own paperwork to the order",
  );
  erp.attachPurchaseDocument(pu2.id, cap.id, "bo");
  assert(
    erp.state.purchases.find((x) => x.id === pu2.id).docRefs.length === 1,
    "…attaching the same document twice does not list it twice",
  );
  throws(
    () => erp.attachPurchaseDocument(pu2.id, "cap-gone", "bo"),
    "attaching a document that is not there is refused",
  );
  erp.detachPurchaseDocument(pu2.id, cap.id, "bo");
  assert(
    erp.state.purchases.find((x) => x.id === pu2.id).docRefs.length === 0,
    "detachPurchaseDocument removes it again",
  );
}

/* ---- S8 · PRY-02's chapter split and money-chain item 14 -----------------
   Both are engine rules with exactly one interface each, so they are asserted
   here rather than only through the screen that calls them. */
{
  const chapters = erp.project(prj.id).baseline.chapters;
  assert(chapters.length > 0, "the fixture project has baseline chapters to split against");
  const chNum = String(chapters[0].num);

  const bill = erp.registerBill(
    {
      supplierId: sup.id,
      number: "S8-1",
      baseCents: 30000,
      vatBp: 2100,
      // Reaches the project and stops there: no chapterNum, which is exactly
      // the row PRY-02's pending-assignment block exists to show.
      allocations: [{ projectId: prj.id, amountCents: 30000 }],
    },
    "bo",
  );
  const pending = erp.unassignedChapterCosts(prj.id);
  const row = pending.find((r) => r.ref === "S8-1");
  assert(!!row, "unassignedChapterCosts finds a cost that reached the project with no chapter");
  assert(
    row.source === "bill" && row.amountCents === 30000,
    "…and reports its origin and its amount",
    JSON.stringify(row),
  );
  // The defect this screen exists for, stated as a check: the per-chapter
  // table adds up to LESS than the project until somebody splits the row.
  const chapTotalBefore = erp.chapterEconomics(prj.id).reduce((s, c) => s + c.actualCents, 0);
  assert(
    chapTotalBefore < erp.actualCostCents(prj.id),
    "an unassigned cost is in the project's actual cost and in no chapter's",
    `${chapTotalBefore} vs ${erp.actualCostCents(prj.id)}`,
  );

  throws(
    () => erp.assignChapterSplit(prj.id, row.id, [], "bo"),
    "a split into no chapters is refused",
  );
  throws(
    () => erp.assignChapterSplit(prj.id, row.id, [{ chapterNum: "999", amountCents: 30000 }], "bo"),
    "a chapter the project's baseline does not know is refused",
  );
  throws(
    () => erp.assignChapterSplit(prj.id, row.id, [{ chapterNum: chNum, amountCents: 10000 }], "bo"),
    "a split that does not total the cost is refused",
  );
  throws(
    () =>
      erp.assignChapterSplit(prj.id, row.id, [{ chapterNum: chNum, amountCents: -30000 }], "bo"),
    "a negative chapter line is refused",
  );

  const second = chapters[1] ? String(chapters[1].num) : chNum;
  erp.assignChapterSplit(
    prj.id,
    row.id,
    [
      { chapterNum: chNum, amountCents: 20000 },
      { chapterNum: second, amountCents: 10000 },
    ],
    "bo",
  );
  const after = erp.state.bills.find((b) => b.id === bill.id);
  assert(
    after.allocations.length === 2 && after.allocations.every((a) => a.chapterNum),
    "assignChapterSplit replaces the row with siblings that each carry a chapter",
  );
  assert(
    after.allocations.reduce((s, a) => s + a.amountCents, 0) === 30000,
    "…and the amount that reached the project is conserved",
  );
  assert(
    erp.chapterEconomics(prj.id).reduce((s, c) => s + c.actualCents, 0) === chapTotalBefore + 30000,
    "…so the per-chapter table now accounts for it",
  );
  assert(
    !erp.unassignedChapterCosts(prj.id).some((r) => r.ref === "S8-1"),
    "…and the row leaves the pending-assignment block",
  );
  throws(
    () => erp.assignChapterSplit(prj.id, row.id, [{ chapterNum: chNum, amountCents: 30000 }], "bo"),
    "a row that already has a chapter cannot be split again through the same id",
  );

  // Item 14. `cashForecast` has always read installment.expectedDate; nothing
  // ever wrote it after the contract was drawn up.
  const con = erp.state.contracts.find((x) => x.id === con2status.id) || erp.state.contracts[0];
  const inst = con.installments[0];
  assert(!!inst, "the fixture contract has a payment milestone");
  const originally = inst.expectedDate;
  const moved = erp.setInstallmentDates(con.id, { 0: "2027-01-15" }, "bo", "schedule");
  assert(
    inst.trigger === "fixedDate"
      ? inst.expectedDate === originally
      : inst.expectedDate === "2027-01-15",
    "setInstallmentDates moves a planned milestone and leaves a fixed date alone",
    `${inst.trigger} ${originally} -> ${inst.expectedDate}`,
  );
  if (inst.trigger !== "fixedDate") {
    assert(
      inst.expectedDateSource === "schedule" && !!inst.expectedDateSetAt,
      "…and records what moved it, beside the date it wrote",
    );
    assert(moved.moved.length === 1, "…and reports the move rather than doing it silently");
    // The whole point: the forecast notices.
    const inWeek = erp.cashForecast(60).find((w) => w.from <= "2027-01-15" && w.to >= "2027-01-15");
    assert(
      !inWeek || inWeek.inflowCents >= inst.amountCents,
      "…and cashForecast expects the money in the week the date moved to",
    );
  }
  // History does not move because a plan did.
  const invoiced = con.installments.find((i) => i.status !== "planned");
  if (invoiced) {
    const was = invoiced.expectedDate;
    erp.setInstallmentDates(con.id, { [con.installments.indexOf(invoiced)]: "2099-01-01" }, "bo");
    assert(invoiced.expectedDate === was, "an invoiced milestone is never moved by the planner");
  }
  const none = erp.setInstallmentDates(con.id, {}, "bo");
  assert(none.moved.length === 0, "an empty proposal moves nothing and says so");
}

/* ---- S9 · COM-04's two money columns and PRY-03's five stages ----------- */
{
  const con = erp.state.contracts[0];
  const v0 = erp.contractValue(con.id);
  // This fixture already carries an annex from the change checks above, so the
  // assertions here are about the DELTA rather than about a pristine contract:
  // a test that needs the world to be empty is a test that breaks whenever
  // somebody adds a step before it.
  assert(
    v0.originalCents === con.valueCents && v0.currentCents === v0.originalCents + v0.annexCents,
    "contractValue: current is the original plus its annexes, and nothing else",
    JSON.stringify(v0),
  );
  assert(
    v0.differs === (v0.annexCents !== 0),
    "…and «differs» is exactly the question «are there annexes»",
  );

  // An approved extra writes an annex, and that is what makes the two differ —
  // the single fact COM-04's amber column exists to state.
  const extra = erp.addChange(
    prj.id,
    { desc: "Extra S9", chapterNum: String(erp.project(prj.id).baseline.chapters[0].num) },
    "ops",
  );
  erp.priceChange(extra.id, 50000, 30000, 2, "bo");
  assert(
    erp.changeStage(erp.state.changes.find((c) => c.id === extra.id)) === "priced",
    "changeStage: a priced extra is valorado",
  );
  erp.sendChange(extra.id, "bo");
  assert(
    erp.changeStage(erp.state.changes.find((c) => c.id === extra.id)) === "priced",
    "changeStage: one already with the customer is still valorado — the pill says the rest",
  );
  erp.approveChange(extra.id, { evidenceRef: "firma.png" }, "bo");

  const v1 = erp.contractValue(con.id);
  assert(
    v1.differs && v1.currentCents === v0.currentCents + 50000 && v1.annexes === v0.annexes + 1,
    "contractValue: an approved extra moves the current amount and names its annex",
    `${JSON.stringify(v0)} -> ${JSON.stringify(v1)}`,
  );
  const row = erp.contractsView().find((c) => c.id === con.id);
  assert(
    row.differs && row.originalCents !== row.currentCents,
    "contractsView carries both amounts, so the list can go amber without opening anything",
  );
  assert(
    erp.contractsView().every((c) => c.active === !["completed", "cancelled"].includes(c.status)),
    "contractsView: active is about whether the contract still governs work, not about signature",
  );

  const doc = erp.renderContractDoc(con.id);
  assert(
    doc.docType === "CONTRATO" && doc.number === con.number && doc.customer.name,
    "renderContractDoc builds the customer's document from data — there is no PDF to upload",
  );
  assert(
    doc.installments.length === con.installments.length &&
      doc.installments.every((i) => "expectedDateSource" in i),
    "…and every milestone carries where its date came from (S8's chain, one screen along)",
  );
  assert(
    doc.annexes.length === v1.annexes && doc.annexes.some((a) => a.changeId === extra.id),
    "…and the annex the approval created",
  );
  throws(() => erp.renderContractDoc("con-gone"), "a contract that is not there is refused");

  const st = erp.changeStageSummary(prj.id);
  assert(
    st.approved.count >= 1 && st.approved.amountCents >= 50000,
    "changeStageSummary counts and totals by stage",
    JSON.stringify(st),
  );
  const totalStaged = ["identified", "priced", "approved", "executed", "invoiced"].reduce(
    (s, k) => s + st[k].count,
    0,
  );
  const rejected = erp.addChange(prj.id, { desc: "Rechazado S9" }, "ops");
  erp.priceChange(rejected.id, 10000, 5000, 0, "bo");
  erp.sendChange(rejected.id, "bo");
  erp.rejectChange(rejected.id, "el cliente dijo que no", "bo");
  const st2 = erp.changeStageSummary(prj.id);
  assert(
    ["identified", "priced", "approved", "executed", "invoiced"].reduce(
      (s, k) => s + st2[k].count,
      0,
    ) === totalStaged,
    "a rejected extra is counted in none of the five, rather than quietly in one",
  );
  assert(
    erp.changeStage(erp.state.changes.find((c) => c.id === rejected.id)) === "",
    "…and changeStage says so rather than inventing a stage for it",
  );

  /* The register lists every obra's extras at once, so the «sin aprobar» total
     it shows is a figure about the whole workspace — and it belongs here, not
     summed in the view. A total added up in the host would be a business rule
     living in neither a capability nor a pack, and the second implementation
     of a sum is the one that goes wrong. Called with no project, the same
     method answers for all of them. */
  // An extra nobody has approved, with a price on it — otherwise both sides of
  // the «sin aprobar» comparison below are zero and it passes by agreeing
  // about nothing.
  const pending = erp.addChange(prj.id, { desc: "Sin aprobar S2" }, "ops");
  erp.priceChange(pending.id, 77700, 40000, 0, "bo");

  const all = erp.extrasRegister();
  const perProject = erp.state.projects.map((p) => erp.extrasRegister(p.id));
  assert(
    all.unapprovedValueCents >= 77700,
    "…the fixture really does carry unapproved value to compare",
    String(all.unapprovedValueCents),
  );
  assert(
    all.items.length === erp.state.changes.length,
    "extrasRegister() with no project answers for every obra",
    `${all.items.length} vs ${erp.state.changes.length}`,
  );
  assert(
    all.unapprovedValueCents === perProject.reduce((s, r) => s + r.unapprovedValueCents, 0),
    "…and its «sin aprobar» total is exactly the sum of the per-obra ones",
    String(all.unapprovedValueCents),
  );
  assert(
    all.approvedValueCents === perProject.reduce((s, r) => s + r.approvedValueCents, 0),
    "…and so is its approved total",
  );
}

/* ---- S10 · ADM-01's four counters, and what an invoice is billed against -- */
{
  const sum = erp.invoicingSummary();
  const reg = erp.invoiceRegister();
  assert(
    sum.issued.count === reg.length &&
      sum.issued.amountCents === reg.reduce((s, r) => s + r.totalCents, 0),
    "invoicingSummary: «emitido» IS the register, not a separate accumulation",
    JSON.stringify(sum.issued),
  );
  assert(
    sum.collected.amountCents + sum.outstanding.amountCents === sum.issued.amountCents,
    "…collected plus outstanding equals issued, so the strip cannot disagree with the table",
    `${sum.collected.amountCents}+${sum.outstanding.amountCents} vs ${sum.issued.amountCents}`,
  );
  assert(
    sum.overdue.amountCents <= sum.outstanding.amountCents,
    "…overdue is a SUBSET of outstanding, not a fifth bucket beside it",
    `${sum.overdue.amountCents} vs ${sum.outstanding.amountCents}`,
  );
  assert(
    sum.overdue.count === reg.filter((r) => r.daysOverdue > 0).length,
    "…and it counts exactly the rows the register calls late",
  );
  // Red from day one: an invoice one day past its due date is already late.
  const anyOpen = erp.state.invoices.find((i) => erp.invoiceOutstandingCents(i.id) > 0);
  if (anyOpen) {
    const realToday = erp.state.today;
    erp.state.today = addDaysISO(anyOpen.dueDate, 1);
    const late = erp.invoiceRegister().find((r) => r.number === anyOpen.number);
    assert(
      late.daysOverdue === 1,
      "one day past due is one day overdue — no grace period",
      String(late.daysOverdue),
    );
    erp.state.today = anyOpen.dueDate;
    const onDay = erp.invoiceRegister().find((r) => r.number === anyOpen.number);
    assert(onDay.daysOverdue === 0, "…and the due date itself is not yet late");
    erp.state.today = realToday;
  }

  // S9's handover asked whether ADM-01 bills against the original contract or
  // the current one. It has always been the current one — projectBilling reads
  // projectEconomics().currentRevenueCents, which is baseline PLUS approved
  // changes — so this asserts the answer rather than changing it.
  const billed = erp.projectBilling(prj.id);
  const ec = erp.projectEconomics(prj.id);
  const withVat =
    ec.currentRevenueCents +
    Math.round((ec.currentRevenueCents * erp.project(prj.id).vatBp) / 10000);
  assert(
    billed.remainingToInvoiceCents === Math.max(0, withVat - billed.invoicedCents),
    "projectBilling bills against the CURRENT contract value, extras included",
    `${billed.remainingToInvoiceCents} vs ${Math.max(0, withVat - billed.invoicedCents)}`,
  );
  assert(
    ec.currentRevenueCents >= ec.baselineRevenueCents,
    "…and the current value is the baseline plus approved extras, never less",
  );
}

/* ---- S11 · gap 13, and the cash box ------------------------------------
   §6's money chain has carried one ✗ since S0: a cost can reach an ACCOUNT
   rather than a project, and no field carried it. These are the checks that
   say it does now. */
{
  const accounts = erp.listAll("accounts");
  assert(accounts.length > 0, "the chart of accounts is a maintainable list, not a constant");
  assert(
    accounts.every((a) => a.code && a.es && a.ca),
    "every account has a code and a name in both languages",
  );
  // Every overhead category the engine accepts must resolve to an account, or
  // rule 07 has a hole exactly where the doc says it must not.
  const cats = erp
    .listAll("accounts")
    .filter((a) => a.overhead)
    .map((a) => a.overhead);
  assert(
    [
      "rent",
      "vehicles",
      "fuel",
      "insurance",
      "office",
      "accountingFirm",
      "marketing",
      "financial",
      "taxes",
      "fixedAsset",
      "renting",
      "otherOverhead",
    ].every((c) => cats.includes(c)),
    "every overhead category resolves to an account — rule 07 has no hole",
    cats.join(","),
  );

  assert(
    erp.resolveAccountCode({ overheadCategory: "insurance" }) === "625",
    "an overhead allocation resolves to its account",
    erp.resolveAccountCode({ overheadCategory: "insurance" }),
  );
  assert(
    erp.resolveAccountCode({ projectId: prj.id, kind: "subcontract" }) === "601",
    "a job cost resolves by its cost kind",
  );
  assert(
    erp.resolveAccountCode({ projectId: prj.id, kind: "material", accountCode: "999" }) === "999",
    "an explicit code always wins — somebody who typed one has looked at the invoice",
  );
  assert(
    erp.resolveAccountCode({ amountCents: 1 }) === null,
    "an allocation that names nothing resolves to nothing, rather than to a guess",
  );

  const billG13 = erp.registerBill(
    {
      supplierId: sup.id,
      number: "G13-1",
      baseCents: 12000,
      vatBp: 2100,
      allocations: [{ overheadCategory: "insurance", amountCents: 12000 }],
    },
    "bo",
  );
  assert(
    erp.state.bills.find((b) => b.id === billG13.id).allocations[0].accountCode === "625",
    "registerBill files the account at the moment the cost arrives",
  );
  const led = erp.accountLedger();
  assert(
    led.rows.some((r) => r.code === "625"),
    "accountLedger rolls costs up by account — the report gap 13 existed to make possible",
  );
  assert(
    led.totalCents + led.unassignedCents > 0 && led.unassignedCents >= 0,
    "…and reports what it could not place rather than dropping it",
    JSON.stringify({ t: led.totalCents, u: led.unassignedCents }),
  );

  // ADM-06. Cash goes through the EXISTING recordCashMovement (BNK-07) —
  // this session briefly added a second one and the class silently kept the
  // old, which is why `cashCount` is the only new method here.
  const till = erp.addBankAccount({ name: "Caja S11", kind: "till", openingCents: 20000 });
  erp.recordCashMovement(
    till.id,
    { accountingDate: erp.today, concept: "Ferretería", amountCents: -4500 },
    "ops",
  );
  erp.recordCashMovement(
    till.id,
    {
      accountingDate: erp.today,
      concept: "Reposición",
      amountCents: 10000,
      supportingDocRef: "r-1",
    },
    "ops",
  );
  const cc = erp.cashCount(till.id);
  assert(
    cc.openingCents === 20000 && cc.inCents === 10000 && cc.outCents === 4500,
    "cashCount separates what came in from what went out",
    JSON.stringify(cc),
  );
  assert(
    cc.closingCents === cc.openingCents + cc.inCents - cc.outCents,
    "…and the closing figure is COMPUTED, because a stored one is a number nobody counted",
  );
  // The arqueo has to agree with the balance, or one of them is decoration.
  assert(
    cc.closingCents === erp.accountBalanceCents(till.id),
    "…and it agrees with the account balance, which is the point of counting",
    `${cc.closingCents} vs ${erp.accountBalanceCents(till.id)}`,
  );
  assert(
    cc.awaitingDoc === 1,
    "…and a cash payment with no receipt is counted, never hidden (BNK-07)",
    String(cc.awaitingDoc),
  );
  // An unbounded count starts at the opening balance. Writing the window as
  // `!from || …` folded the whole history into the opening figure and still
  // balanced, which is exactly what made it worth a check.
  const bounded = erp.cashCount(till.id, erp.today, erp.today);
  assert(
    bounded.openingCents === 20000 && bounded.count === 2,
    "a bounded count opens where the unbounded one does when nothing precedes it",
    JSON.stringify(bounded),
  );
}

/* ---------------------------------------------------------------------------
   S12 · ADM-08 forecast grid, ADM-04 summary and the monthly reconciliation.
--------------------------------------------------------------------------- */
{
  const g = erp.cashFlowGrid({ mode: "week", periods: 13 });
  assert(g.periods.length === 13, "cashFlowGrid returns one bucket per requested week");
  assert(
    g.periods[0].from === erp.today && g.periods[12].to === addDaysISO(erp.today, 13 * 7 - 1),
    "…starting today and running to the end of the last week",
    JSON.stringify([g.periods[0], g.periods[12]]),
  );

  // The cumulative row is the running total, opened from real money.
  let run = g.openingCents;
  const want = g.netCents.map((n) => (run += n));
  assert(
    JSON.stringify(want) === JSON.stringify(g.cumulativeCents),
    "the cumulative balance is the running total of the period nets",
  );
  assert(
    g.openingCents === erp.cashPositionAsOf(addDaysISO(erp.today, -1)),
    "…and it opens from the money that is actually in the accounts, not from zero",
    `${g.openingCents} vs ${erp.cashPositionAsOf(addDaysISO(erp.today, -1))}`,
  );
  assert(
    g.netCents.every((n, i) => n === g.groups[0].totals[i] - g.groups[1].totals[i]),
    "each period's net is its money in minus its money out, with no third source",
  );

  // Nothing already due is dropped for being in the past. A bill that fell due
  // last week is still owed; a forecast that discards it gets rosier the later
  // you are, which is the one direction a forecast must never drift.
  const supplierId = erp.state.parties.find((p) => p.roles.includes("supplier")).id;
  const beforeFirst = erp.cashFlowGrid({ mode: "week", periods: 4 }).groups[1].totals[0];
  erp.registerBill(
    {
      supplierId,
      number: "SIM-OVERDUE-1",
      baseCents: 500000,
      date: addDaysISO(erp.today, -40),
      dueDate: addDaysISO(erp.today, -20),
    },
    "backoffice",
  );
  const afterFirst = erp.cashFlowGrid({ mode: "week", periods: 4 }).groups[1].totals[0];
  assert(
    afterFirst > beforeFirst,
    "a bill that fell due three weeks ago lands in the FIRST bucket, not nowhere",
    `${beforeFirst} → ${afterFirst}`,
  );

  // Month buckets: the first is a stub from today, the rest are whole months.
  const m = erp.cashFlowGrid({ mode: "month", periods: 3 });
  assert(
    m.periods[0].from === erp.today && m.periods[1].from.endsWith("-01"),
    "month mode opens at today and then runs on calendar months",
    JSON.stringify(m.periods),
  );

  // Scoping to one job can only ever narrow the company figure.
  const pid = erp.state.projects[0].id;
  const one = erp.cashFlowGrid({ mode: "week", periods: 13, projectId: pid });
  const tot = (x) => x.groups[0].totals.reduce((a, b) => a + b, 0);
  assert(
    tot(one) <= tot(erp.cashFlowGrid({ mode: "week", periods: 13 })),
    "a per-project forecast is a subset of the company one",
    `${tot(one)} vs ${tot(g)}`,
  );
}

{
  // ADM-04's Resumen: every hour lands under a chapter, including the ones
  // nobody assigned — those are the whole reason the roll-up exists.
  const s = erp.hoursSummary(null, null, null);
  assert(
    s.totalHoursMilli ===
      s.projects.reduce((a, p) => a + p.chapters.reduce((x, c) => x + c.hoursMilli, 0), 0),
    "hoursSummary's total is the sum of its chapters, with nothing lost between the two",
  );
  assert(
    s.totalCostCents === erp.state.labour.reduce((a, l) => a + l.costCents, 0),
    "…and its cost is every labour entry's cost, unfiltered",
  );
  const scoped = erp.hoursSummary(null, null, erp.state.projects[0].id);
  assert(
    scoped.projects.length <= 1 && scoped.totalHoursMilli <= s.totalHoursMilli,
    "scoping the summary to one project can only narrow it",
  );

  // The reconciliation states a difference rather than demanding a zero.
  const rec = erp.labourReconciliation(erp.today);
  assert(
    rec.unbookedCents === rec.wagesCents - rec.bookedCents,
    "the month's unbooked labour is wages paid minus hours booked, and nothing else",
    JSON.stringify(rec),
  );
  assert(
    rec.approvedHoursMilli + rec.openHoursMilli === rec.bookedHoursMilli,
    "…and every hour in the month is either approved or still open, never both or neither",
    JSON.stringify(rec),
  );
  assert(
    rec.from.endsWith("-01") && rec.to >= rec.from && rec.month === rec.from.slice(0, 7),
    "…over the whole calendar month it names",
    JSON.stringify([rec.month, rec.from, rec.to]),
  );
  // With no month named it reconciles the last month whose payroll actually
  // ran. Reconciling a month still in progress reports every hour booked so
  // far as unpaid — a calendar fact dressed up as an alarm.
  erp
    .importMovements(erp.state.bankAccounts[0].id, [
      { accountingDate: "2026-02-26", concept: "NOMINAS SIM", amountCents: -100000 },
    ])
    .forEach((m) => erp.classifyMovement(m.id, "salary", "sim"));
  assert(
    erp.labourReconciliation().month === "2026-02",
    "with no month named, the reconciliation is of the last payroll that ran",
    erp.labourReconciliation().month,
  );
}

/* =============================================================================
   ONE JOB, TWO PAYERS.

   A general contractor hired by the end customer sub-hires Canei. Part of the
   work is owed by the contractor and part directly by the end customer — one
   project, one budget, one set of costs and one margin, two people to invoice.

   The feature is not "let the operator pick who to bill". That much is one
   line. The feature is that picking wrongly is REFUSED: with a free choice of
   payer per invoice, nothing stops the same chapter being billed to both, and
   the error surfaces months later as a dispute over two sealed, immutable
   documents in a gapless series.

   So every check below is about the guard, not the convenience.
   ========================================================================== */
{
  const e = new ERP("2026-03-02");
  e.configureEntity(
    {
      legalName: "Canei Subirats, S.L.",
      taxId: "B12345674",
      street: "C/ X 1",
      postalCode: "08960",
      city: "Sant Just",
      iban: "ES9121000418450200051332",
    },
    "bo",
  );
  const mkParty = (name, taxId, roles) =>
    e.addParty(
      {
        roles,
        name,
        taxId,
        billStreet: "C/ Y 2",
        billPostalCode: "08001",
        billCity: "BCN",
        billProvince: "Barcelona",
        mobile: "600000001",
        email: "x@y.example",
        leadSource: "referral",
      },
      "bo",
    );
  const endCust = mkParty("Propietaria Final", "12345678Z", ["customer"]);
  const gc = mkParty("Constructora General SA", "A58818501", ["customer"]);

  // One budget, two chapters: one each.
  const bud = e.createBudget({ partyId: endCust.id }, "bo");
  const cA = e.addChapter(bud.id, { name: "Baño" }, "bo");
  const cB = e.addChapter(bud.id, { name: "Estructura" }, "bo");
  e.addLine(
    bud.id,
    cA.id,
    { desc: "Alicatado", unit: "m2", qtyMilli: 1000, priceCents: 100000, costCents: 50000 },
    "bo",
  );
  e.addLine(
    bud.id,
    cB.id,
    { desc: "Refuerzo", unit: "m2", qtyMilli: 1000, priceCents: 300000, costCents: 150000 },
    "bo",
  );
  e.issueVersion(bud.id, {}, "bo");
  e.acceptVersion(bud.id, e.currentVersion(bud.id).id, { evidenceRef: "ok" }, "bo");
  const prj = e.createProjectFromAcceptance(bud.id, "bo");

  // Default: one payer, everything theirs — the ordinary job, unchanged.
  assert(
    prj.billing.length === 1 && prj.billing[0].partyId === endCust.id,
    "a new project starts with one payer",
  );
  assert(
    prj.baseline.chapters.every((c) => c.billToPartyId === endCust.id),
    "and every chapter is owed by that payer",
  );

  // Split it: chapter 2 is owed by the general contractor.
  e.addProjectPayer(
    prj.id,
    {
      partyId: gc.id,
      role: "mainContractor",
      vatBp: 0,
      taxTreatment: "reverseCharge",
      taxJustification: "Ejecución de obra — art. 84.Uno.2.f LIVA",
    },
    "bo",
  );
  e.assignChapterPayer(prj.id, "2", gc.id, "bo");
  assert(e.project(prj.id).billing.length === 2, "a second payer can be added");

  const basesEnd = e.invoiceBases(prj.id, endCust.id);
  const basesGc = e.invoiceBases(prj.id, gc.id);
  assert(
    basesEnd.attributedCents === 100000,
    "the end customer is attributed only their chapter",
    String(basesEnd.attributedCents),
  );
  assert(
    basesGc.attributedCents === 300000,
    "the contractor only theirs",
    String(basesGc.attributedCents),
  );
  assert(
    basesEnd.attributedCents + basesGc.attributedCents === prj.baseline.revenueCents,
    "and together they are the whole job, exactly once",
  );

  // THE GUARD. Billing the contractor for the end customer's scope is refused.
  throws(
    () =>
      e.issueInvoice(
        { projectId: prj.id, billToPartyId: gc.id, baseCents: 400000, desc: "todo" },
        "bo",
      ),
    "billing one payer for more than their own scope is refused",
  );
  const seriesBefore = e.state.series.invoice.next;
  try {
    e.issueInvoice({ projectId: prj.id, billToPartyId: gc.id, baseCents: 400000 }, "bo");
  } catch (err) {
    /* expected */
  }
  assert(
    e.state.series.invoice.next === seriesBefore,
    "and the refusal mints no invoice number",
    `${seriesBefore} -> ${e.state.series.invoice.next}`,
  );

  // Each payer billed their own scope: two invoices, two parties, two treatments.
  const iEnd = e.issueInvoice(
    { projectId: prj.id, billToPartyId: endCust.id, baseCents: 100000, desc: "Baño" },
    "bo",
  );
  const iGc = e.issueInvoice(
    { projectId: prj.id, billToPartyId: gc.id, baseCents: 300000, desc: "Estructura" },
    "bo",
  );
  assert(
    iEnd.partyId === endCust.id && iGc.partyId === gc.id,
    "each invoice carries its own payer",
  );
  assert(iEnd.vatBp === prj.vatBp, "the end customer keeps the project's tax rate");
  assert(
    iGc.vatBp === 0 && iGc.taxTreatment === "reverseCharge",
    "the contractor's invoice is on its own treatment",
  );
  assert(
    /84\.Uno\.2\.f/.test(iGc.taxJustification || ""),
    "and records WHY, on the document, not as a rule to re-derive later",
    iGc.taxJustification,
  );

  /* Neither payer can now be billed again for the same work.
     A MATERIAL amount, deliberately: the cap carries a few cents of slack for
     VAT round-tripping (see AR-11), so asserting that one extra cent is
     refused would be asserting the tolerance away. What must be refused is a
     second helping of somebody else's scope, and that is made of euros. */
  throws(
    () =>
      e.issueInvoice(
        { projectId: prj.id, billToPartyId: gc.id, baseCents: 10000, desc: "otra vez" },
        "bo",
      ),
    "a payer already billed in full cannot be billed again",
  );
  assert(
    e.invoiceBases(prj.id).billedBaseCents === 400000,
    "the project-wide total is still the whole job, billed once",
    String(e.invoiceBases(prj.id).billedBaseCents),
  );

  /* A CONTRACT MILESTONE IS BILLED ONCE, NOT WITH VAT ON VAT.
     A contract states its schedule the way the customer reads it — a
     percentage of `totalCents`, which is value PLUS VAT. An invoice line is a
     base and the document adds VAT itself, so handing the stated figure
     straight to the generator charged the tax twice: on a 1.000 € + 10%
     contract the 100% milestone came out at 1.210 € against a 1.100 €
     contract. That was live and shipped; the over-billing guard found it.
     Asserted on the arithmetic rather than on the screen, so it holds however
     the generator is rewritten. */
  {
    const v = new ERP("2026-03-02");
    v.configureEntity(
      {
        legalName: "C",
        taxId: "B12345674",
        street: "s",
        postalCode: "08960",
        city: "c",
        iban: "ES9121000418450200051332",
      },
      "bo",
    );
    const cli = v.addParty(
      {
        roles: ["customer"],
        name: "Cli",
        taxId: "12345678Z",
        billStreet: "s",
        billPostalCode: "08001",
        billCity: "BCN",
        billProvince: "B",
        mobile: "600111222",
        email: "a@b.c",
        leadSource: "referral",
      },
      "bo",
    );
    const bg = v.createBudget({ partyId: cli.id }, "bo");
    v.updateBudget(bg.id, { vatBp: 1000 }, "bo");
    const cp = v.addChapter(bg.id, { name: "Obra" }, "bo");
    v.addLine(
      bg.id,
      cp.id,
      { desc: "L", unit: "ud", qtyMilli: 1000, priceCents: 100000, costCents: 50000 },
      "bo",
    );
    v.issueVersion(bg.id, {}, "bo");
    v.acceptVersion(bg.id, v.currentVersion(bg.id).id, { evidenceRef: "ok" }, "bo");
    const ct = v.createContract(
      bg.id,
      {
        installments: [{ pct: 100, trigger: "onSignature", expectedDate: v.today }],
        duration: { estimatedDays: 10 },
      },
      "bo",
    );
    v.signContract(ct.id, { method: "paper", evidence: { ref: "firmado.pdf" } }, "bo");
    const pj = v.createProjectFromAcceptance(bg.id, "bo");
    const ms = v.invoiceBases(pj.id).milestones[0];
    assert(
      ms.amountCents === 110000,
      "the contract states its milestone with VAT, as the customer reads it",
      String(ms.amountCents),
    );
    assert(
      ms.baseCents === 100000,
      "and the engine hands the screen the base, not that figure",
      String(ms.baseCents),
    );
    const issued = v.issueInvoice(
      { projectId: pj.id, installmentIdx: 0, lines: [{ desc: "Hito", amountCents: ms.baseCents }] },
      "bo",
    );
    assert(
      issued.totalCents === 110000,
      "so the invoice totals the contract, not the contract plus VAT twice",
      `${issued.totalCents} (base ${issued.baseCents} + IVA ${issued.vatCents})`,
    );
  }

  // A party who is not a payer on this project is refused outright.
  const stranger = mkParty("Ajena SL", "B10000008", ["customer"]);
  throws(
    () =>
      e.issueInvoice(
        { projectId: prj.id, billToPartyId: stranger.id, baseCents: 100, desc: "x" },
        "bo",
      ),
    "a party who is not a payer on the project cannot be invoiced for it",
  );

  // A credit note is not capped — it REDUCES what a payer has been billed.
  const abono = e.issueInvoice(
    {
      projectId: prj.id,
      billToPartyId: gc.id,
      kind: "creditNote",
      rectifies: iGc.id,
      rectifyReason: "error",
      baseCents: 50000,
    },
    "bo",
  );
  assert(abono.partyId === gc.id, "a credit note follows its payer");
  assert(
    e.invoiceBases(prj.id, gc.id).billedBaseCents === 250000,
    "and reduces that payer's billed total",
    String(e.invoiceBases(prj.id, gc.id).billedBaseCents),
  );
}

/* A WORKSPACE NOBODY HAS CONFIGURED YET STILL OPENS.
   `state.config` is null until somebody runs `configureEntity`, and `alerts()`
   read `config.marginThresholdBp` straight through. The Torre is the FIRST
   screen a workspace shows, so a company that had not yet typed its own legal
   details met `Cannot read properties of null` on the landing page and lost the
   whole screen — four indicators, the project list and every alert — to the
   error card. Reported from production.

   The rule this pins: NOT knowing the company's tax details is a reason to
   refuse to ISSUE a document; it is never a reason to refuse to SHOW one.
   Reads degrade to the default `configureEntity` would have written; writes
   still refuse, and now they refuse by naming the thing to go and do rather
   than by naming a property that was null. */
{
  const bare = new ERP("2026-03-02");
  assert(bare.state.config === null, "a new workspace genuinely starts unconfigured");
  /* AN OPEN JOB IS REQUIRED, or this check cannot fail.
     The crashing line sits inside `for (const p of projects.filter(open))`, so
     on an empty workspace it never runs and the whole block passes while the
     bug is present — which is exactly what the first version of this check did
     when the fault was reintroduced to test it. A gate that cannot reach the
     line it guards is decoration. */
  const cli = bare.addParty(
    {
      roles: ["customer"],
      name: "Cliente sin configurar",
      taxId: "12345678Z",
      billStreet: "c",
      billPostalCode: "08001",
      billCity: "BCN",
      billProvince: "B",
      mobile: "600111333",
      email: "a@b.c",
      leadSource: "referral",
    },
    "bo",
  );
  bare.createQuickProject(
    { partyId: cli.id, desc: "Obra", activityLine: "repairs", valueCents: 100000 },
    "bo",
  );
  assert(
    bare.state.projects.filter((p) => !p.closed).length === 1,
    "…with an open job, so the alert loop actually runs",
  );
  for (const m of [
    "alerts",
    "managedAlerts",
    "controlTower",
    "cashPosition",
    "receivables",
    "quarterlyPackage",
  ]) {
    let threw = "";
    try {
      bare[m]();
    } catch (e) {
      threw = e.message;
    }
    assert(
      !threw,
      `unconfigured workspace: ${m}() renders instead of throwing`,
      threw.slice(0, 90),
    );
  }
  assert(
    bare.marginThresholdBp() === 1500,
    "the margin threshold falls back to the value configureEntity would have set",
    String(bare.marginThresholdBp()),
  );
  /* PREVIEW IS A READ, and the first fix for this crash forgot that — it put
     the issue-time refusal into `previewInvoice` too, so the generator died on
     the very workspace this block exists to protect. The loop above could not
     catch it because previewInvoice needs a draft and so sits outside it.
     Nothing pinned it but the browser suite, twelve minutes away. */
  {
    const job = bare.state.projects[0];
    let threw = "";
    let pv = null;
    try {
      pv = bare.previewInvoice({ projectId: job.id, baseCents: 50000 });
    } catch (e) {
      threw = e.message;
    }
    assert(!threw, "unconfigured workspace: previewInvoice() renders instead of throwing", threw);
    assert(
      pv && pv.doc && pv.baseCents === 50000,
      "…and the preview is a real document, not an empty shell",
    );
    assert(
      pv && (pv.blocks || []).length > 0,
      "…while still showing the operator why it cannot be issued",
    );
  }
  // …and the write path still refuses, in words that name the fix.
  let issueErr = "";
  try {
    bare.issueInvoice({ projectId: "nope", baseCents: 1000 }, "bo");
  } catch (e) {
    issueErr = e.message;
  }
  assert(issueErr.length > 0, "issuing on an unconfigured workspace is still refused", issueErr);
}

/**
 * A PHOTOGRAPHED DOCUMENT BECOMES A SUPPLIER INVOICE.
 *
 * Until now the trail stopped at `captured`: the reader extracted the issuer,
 * the number and the amounts, a person confirmed them, and nothing ever turned
 * that into a bill. Bank reconciliation matches a movement against a BILL, so
 * on a workspace where documents arrive by camera there was nothing to
 * reconcile against — a gap that no test noticed because every fixture calls
 * `registerBill` directly.
 *
 * The negative controls matter more than the happy path here: the two ways to
 * get this wrong are binding a cost to the wrong company, and carrying a split
 * across two records that measure different totals.
 */
{
  const e = new ERP();
  e.configureEntity(
    { legalName: "Obras Test SL", taxId: "B12345674", iban: "ES9121000418450200051332" },
    "bo",
  );
  const supplier = e.addParty(
    { name: "Suministros Vallès SL", taxId: "B12345674", roles: ["supplier"] },
    "bo",
  );
  const cust = e.addParty(
    {
      name: "Cliente Final",
      taxId: "12345678Z",
      roles: ["customer"],
      billStreet: "C/ Major 18",
      billPostalCode: "08950",
      billCity: "Esplugues de Llobregat",
      mobile: "600111222",
    },
    "bo",
  );
  const job = e.createQuickProject(
    { partyId: cust.id, desc: "Reforma", activityLine: "reforma", valueCents: 500000 },
    "bo",
  );

  const cap = e.captureDocument({ docType: "supplierInvoice", imageRef: "blob_1" }, "bo");
  // Not confirmed yet: refuse, because a reading nobody has checked is not a fact.
  throws(
    () => e.billFromCapture(cap.id, { supplierId: supplier.id }, "bo"),
    "billFromCapture refuses a document whose fields nobody has confirmed",
  );

  e.confirmCapture(
    cap.id,
    {
      issuerName: "Suministros Vallès SL",
      issuerTaxId: "B12345674",
      docNumber: "A-2026-118",
      date: e.state.today,
      baseCents: 100000,
      vatCents: 21000,
      totalCents: 121000,
    },
    "bo",
  );
  // The supplier is never guessed from the page.
  throws(
    () => e.billFromCapture(cap.id, {}, "bo"),
    "billFromCapture refuses to guess which company issued the document",
  );

  /* PK10-S3 · the split is made against the BASE now, in both doors. It used
     to be entered here against the document total — 121.000 rather than
     100.000 — which is what forced the operator to enter it twice in two
     different units: once to satisfy the capture screen, once to satisfy the
     bill drawer, which has always demanded the base. */
  e.allocateCapture(
    cap.id,
    [
      { projectId: job.id, kind: "material", amountCents: 75000 },
      { overheadCategory: "office", kind: "other", amountCents: 25000 },
    ],
    "bo",
  );
  const promoted = e.billFromCapture(cap.id, { supplierId: supplier.id }, "bo");

  assert(
    promoted.number === "A-2026-118",
    "…the bill takes the number that was read and confirmed",
  );
  assert(promoted.baseCents === 100000, "…and the taxable base, not the total", promoted.baseCents);
  assert(
    promoted.capId === cap.id &&
      e.state.captured.find((c) => c.id === cap.id).billId === promoted.id,
    "…and the document and the bill point at each other",
  );
  const allocSum = promoted.allocations.reduce((s, a) => s + a.amountCents, 0);
  assert(
    allocSum === promoted.baseCents,
    "…the split arrives at the bill footing to the taxable base, unchanged",
    allocSum + " vs " + promoted.baseCents,
  );
  assert(
    promoted.allocations[0].amountCents === 75000 && promoted.allocations[1].amountCents === 25000,
    "…and it is the operator's own figures, not a rescale of them",
  );
  assert(
    promoted.allocations.length === 2 &&
      promoted.allocations[0].projectId === job.id &&
      promoted.allocations[1].overheadCategory === "office",
    "…and every destination survives the rescale",
  );
  assert(
    promoted.supplierName === "Suministros Vallès SL" && promoted.supplierTaxId === "B12345674",
    "registerBill stamps the issuer's name and tax id onto the bill itself",
  );
  // Once promoted, again is a duplicate, not an update.
  throws(
    () => e.billFromCapture(cap.id, { supplierId: supplier.id }, "bo"),
    "a document already registered as a bill cannot be registered twice",
  );

  // A bill from before the stamp still names its issuer.
  const legacy = e.registerBill(
    { supplierId: supplier.id, number: "OLD-1", baseCents: 5000 },
    "bo",
  );
  delete legacy.supplierName;
  delete legacy.supplierTaxId;
  assert(
    e.billSupplier(legacy).name === "Suministros Vallès SL" &&
      e.billSupplier(legacy).taxId === "B12345674",
    "billSupplier falls back to the party file for a bill registered before the stamp",
  );
  assert(
    e.payables().every((r) => r.supplier),
    "…and payables still names every supplier",
  );

  // The accountant's dictionary carries the tax id, which it never used to.
  const pkgRows = e.state.bills.filter((b) => b.date === e.state.today);
  assert(pkgRows.length >= 1, "the quarter has bills to report");
}

/**
 * A COST CAN NAME THE PARTIDA IT PAID FOR — and only a true one.
 *
 * Every allocation path stops at the chapter today; block 5's reporting wants
 * one level deeper. The field is optional everywhere (every allocation written
 * before it existed stays valid), but a lineId that IS given must name a line
 * of the project's ACCEPTED version, in the chapter it claims — a cost filed
 * against a partida from the wrong chapter is exactly the wrong that no report
 * surfaces, because both numbers look plausible and the drill-down quietly
 * disagrees with the totals above it.
 */
{
  const e = new ERP("2026-03-02");
  e.configureEntity(
    {
      legalName: "Obras 1F SL",
      taxId: "B12345674",
      street: "s",
      postalCode: "08960",
      city: "c",
      iban: "ES9121000418450200051332",
    },
    "bo",
  );
  const cli = e.addParty(
    {
      roles: ["customer"],
      name: "Cli 1F",
      taxId: "12345678Z",
      billStreet: "s",
      billPostalCode: "08001",
      billCity: "BCN",
      mobile: "600111222",
      email: "cli1f@example.com",
    },
    "bo",
  );
  const sup = e.addParty({ roles: ["supplier"], name: "Prov 1F", taxId: "B12345674" }, "bo");
  const bg = e.createBudget({ partyId: cli.id }, "bo");
  const c1 = e.addChapter(bg.id, { name: "Demoliciones" }, "bo");
  const c2 = e.addChapter(bg.id, { name: "Pintura" }, "bo");
  const l1 = e.addLine(
    bg.id,
    c1.id,
    { desc: "Tabique", unit: "m2", qtyMilli: 10000, priceCents: 2000, costCents: 1000 },
    "bo",
  );
  e.addLine(
    bg.id,
    c2.id,
    { desc: "Pintar", unit: "m2", qtyMilli: 10000, priceCents: 1000, costCents: 500 },
    "bo",
  );
  e.issueVersion(bg.id, {}, "bo");
  e.acceptVersion(bg.id, e.currentVersion(bg.id).id, { evidenceRef: "ok" }, "bo");
  const pj = e.createProjectFromAcceptance(bg.id, "bo");

  // Happy path: the chapter is FILLED IN from the line, not asked for twice.
  const b1 = e.registerBill(
    {
      supplierId: sup.id,
      number: "1F-1",
      baseCents: 5000,
      allocations: [{ projectId: pj.id, lineId: l1.id, kind: "material", amountCents: 5000 }],
    },
    "bo",
  );
  assert(
    b1.allocations[0].lineId === l1.id && b1.allocations[0].chapterNum === String(c1.num),
    "an allocation that names a partida gets its chapter filled in from it",
    JSON.stringify(b1.allocations[0]),
  );

  // The wrong chapter for that partida is refused, not corrected silently.
  throws(
    () =>
      e.registerBill(
        {
          supplierId: sup.id,
          number: "1F-2",
          baseCents: 5000,
          allocations: [
            {
              projectId: pj.id,
              chapterNum: String(c2.num),
              lineId: l1.id,
              kind: "material",
              amountCents: 5000,
            },
          ],
        },
        "bo",
      ),
    "a partida filed under the wrong chapter is refused",
  );
  throws(
    () =>
      e.registerBill(
        {
          supplierId: sup.id,
          number: "1F-3",
          baseCents: 5000,
          allocations: [
            { projectId: pj.id, lineId: "lin_nope", kind: "material", amountCents: 5000 },
          ],
        },
        "bo",
      ),
    "a partida the accepted budget does not contain is refused",
  );
  throws(
    () =>
      e.registerBill(
        {
          supplierId: sup.id,
          number: "1F-4",
          baseCents: 5000,
          allocations: [
            { overheadCategory: "office", lineId: l1.id, kind: "other", amountCents: 5000 },
          ],
        },
        "bo",
      ),
    "an overhead cost cannot name a partida",
  );
  {
    const quick = e.createQuickProject(
      { partyId: cli.id, desc: "Rápido", activityLine: "reforma", valueCents: 100000 },
      "bo",
    );
    throws(
      () =>
        e.registerBill(
          {
            supplierId: sup.id,
            number: "1F-5",
            baseCents: 5000,
            allocations: [
              { projectId: quick.id, lineId: l1.id, kind: "material", amountCents: 5000 },
            ],
          },
          "bo",
        ),
      "a project with no accepted budget cannot take a partida allocation",
    );
  }

  // The bank path carries it too — a movement split names the same level.
  const acc = e.addBankAccount({ name: "Banco 1F", kind: "bank" }, "bo");
  e.importMovements(
    acc.id,
    [{ accountingDate: e.state.today, concept: "COMPRA 1F", amountCents: -5000 }],
    "bo",
  );
  const mv = e.state.movements[e.state.movements.length - 1];
  e.splitMovement(
    mv.id,
    [{ projectId: pj.id, lineId: l1.id, kind: "material", amountCents: 5000 }],
    "bo",
  );
  assert(
    mv.allocations[0].lineId === l1.id && mv.allocations[0].chapterNum === String(c1.num),
    "a bank movement's split can name the partida, chapter filled in",
    JSON.stringify(mv.allocations[0]),
  );

  /* UNDOING A MATCH UNDOES THE MONEY IT CREATED. For a while this class held
     TWO methods named unmatchMovement, and the later, thinner one won: it
     cleared `matched` and left the payment the match had created standing — a
     bill marked paid by a reconciliation that no longer exists. The stub is
     deleted; this is the control that keeps it deleted. */
  {
    const b2 = e.registerBill(
      { supplierId: sup.id, number: "1F-M", baseCents: 4132, vatBp: 2100 },
      "bo",
    );
    e.importMovements(
      acc.id,
      [{ accountingDate: e.state.today, concept: "PAGO 1F-M", amountCents: -b2.totalCents }],
      "bo",
    );
    const mv2 = e.state.movements[e.state.movements.length - 1];
    e.matchMovement(mv2.id, { billId: b2.id }, "bo");
    assert(
      e.billOutstandingCents(b2.id) === 0 && mv2.status === "matched",
      "matching a movement to a bill pays the bill",
      e.billOutstandingCents(b2.id) + " / " + mv2.status,
    );
    e.unmatchMovement(mv2.id, "bo");
    assert(
      e.billOutstandingCents(b2.id) === b2.totalCents &&
        !e.state.payments.some((p) => p.movementId === mv2.id) &&
        mv2.status === "unallocated" &&
        mv2.matched === null,
      "unmatching voids the payment it created — no phantom payment survives",
      JSON.stringify({
        outstanding: e.billOutstandingCents(b2.id),
        payments: e.state.payments.filter((p) => p.movementId === mv2.id).length,
        status: mv2.status,
      }),
    );
  }

  // Promotion keeps the partida — and, since PK10-S3, keeps the amount too:
  // both doors foot against the base, so there is nothing left to rescale.
  const cap = e.captureDocument({ docType: "supplierInvoice", imageRef: "b1f" }, "bo");
  e.confirmCapture(
    cap.id,
    {
      issuerName: "Prov 1F",
      issuerTaxId: "B12345674",
      docNumber: "1F-CAP",
      date: e.state.today,
      baseCents: 10000,
      vatCents: 2100,
      totalCents: 12100,
    },
    "bo",
  );
  e.allocateCapture(
    cap.id,
    [{ projectId: pj.id, lineId: l1.id, kind: "material", amountCents: 10000 }],
    "bo",
  );
  const promoted1f = e.billFromCapture(cap.id, { supplierId: sup.id }, "bo");
  assert(
    promoted1f.allocations[0].lineId === l1.id &&
      promoted1f.allocations[0].amountCents === promoted1f.baseCents,
    "capture → bill promotion keeps the partida and the amount",
    JSON.stringify(promoted1f.allocations[0]),
  );

  /* THE RESCALE IS STILL THERE, and still needed: a document allocated before
     the units were fixed carries rows summing to the VAT-inclusive total, and
     `billFromCapture` restates them rather than refusing a filing somebody
     already did. Exercised directly, because no screen produces this shape any
     more and an untested safety net is not one. */
  const legacyCap = e.captureDocument({ docType: "supplierInvoice", imageRef: "legacy" }, "bo");
  e.confirmCapture(
    legacyCap.id,
    {
      issuerName: "Prov 1F",
      issuerTaxId: "B12345674",
      docNumber: "1F-LEGACY",
      date: e.state.today,
      baseCents: 10000,
      vatCents: 2100,
      totalCents: 12100,
    },
    "bo",
  );
  const restated = e.billFromCapture(
    legacyCap.id,
    {
      supplierId: sup.id,
      allocations: [{ projectId: pj.id, kind: "material", amountCents: 12100 }],
    },
    "bo",
  );
  assert(
    restated.allocations[0].amountCents === 10000,
    "a split still carrying the old gross figure is restated to the base on promotion",
    JSON.stringify(restated.allocations[0]),
  );
}

/**
 * A CREDIT CARD IS AN ACCOUNT, NOT A SPECIAL MOVEMENT.
 *
 * Its statement imports as ordinary movements on its own account — so the
 * importer, the dedupe, the scoring and the matching screen all apply with no
 * second implementation — and the bank line that pays the card off is an
 * internal transfer naming the card it settles, because the PURCHASES are the
 * costs and counting the monthly charge too counts each of them twice.
 */
{
  const e = new ERP("2026-03-10");
  e.configureEntity(
    { legalName: "Obras 1C SL", taxId: "B12345674", iban: "ES9121000418450200051332" },
    "bo",
  );
  const sup = e.addParty({ roles: ["supplier"], name: "Ferretería 1C", taxId: "B12345674" }, "bo");
  throws(
    () => e.addBankAccount({ name: "??", kind: "wallet" }, "bo"),
    "an unknown account kind is refused, not stored",
  );
  const bank = e.addBankAccount({ name: "BBVA CC", kind: "bank" }, "bo");
  const card = e.addBankAccount({ name: "Visa empresa", kind: "card" }, "bo");

  // The card's statement, imported like any other statement.
  e.importMovements(
    card.id,
    [
      { accountingDate: "2026-03-03", concept: "FERRETERIA VALLES", amountCents: -12100 },
      { accountingDate: "2026-03-04", concept: "GASOLINERA REPSOL", amountCents: -6050 },
    ],
    "bo",
  );
  const purchases = e.state.movements.filter((m) => m.accountId === card.id);
  assert(purchases.length === 2, "the card statement lands on the card account", purchases.length);

  // Matching a card purchase to its invoice records a CARD payment.
  const bill = e.registerBill(
    { supplierId: sup.id, number: "T-88", baseCents: 10000, vatBp: 2100 },
    "bo",
  );
  e.matchMovement(purchases[0].id, { billId: bill.id }, "bo");
  const pay = e.state.payments.find((p) => p.movementId === purchases[0].id);
  assert(
    pay && pay.method === "card" && e.billOutstandingCents(bill.id) === 0,
    "matching a card purchase pays its bill BY CARD",
    JSON.stringify({ method: pay && pay.method, out: e.billOutstandingCents(bill.id) }),
  );

  // The bank line that pays the card off: internal transfer, naming the card.
  e.importMovements(
    bank.id,
    [{ accountingDate: "2026-03-31", concept: "LIQUIDACION VISA", amountCents: -18150 }],
    "bo",
  );
  const settle = e.state.movements.find((m) => m.accountId === bank.id);
  e.markCardSettlement(settle.id, card.id, "bo");
  assert(
    settle.class === "internalTransfer" &&
      settle.cardSettlement &&
      settle.cardSettlement.accountId === card.id,
    "the settlement is an internal transfer that names the card it pays",
    JSON.stringify({ class: settle.class, link: settle.cardSettlement }),
  );
  throws(
    () => e.markCardSettlement(settle.id, bank.id, "bo"),
    "a settlement must name a CARD — a bank account is refused",
  );
  throws(() => e.markCardSettlement(purchases[1].id, card.id, "bo"), "a card cannot settle itself");
}

/**
 * DELIBERATELY UNBACKED, WITH A REASON — and nothing is ever blocked.
 *
 * A bank fee has no invoice and none is coming; the operator says so once,
 * with a reason from the owner-maintained list, and the queue stops asking.
 * Only movements with NO invoice and NO reason keep being flagged. The mark
 * is information for the accountant, never a gate: the exception list stops
 * naming the movement, and the explained rows travel with their reasons.
 */
{
  const e = new ERP("2026-03-10");
  e.configureEntity(
    { legalName: "Obras 1D SL", taxId: "B12345674", iban: "ES9121000418450200051332" },
    "bo",
  );
  const acc = e.addBankAccount({ name: "BBVA", kind: "bank" }, "bo");
  e.importMovements(
    acc.id,
    [
      { accountingDate: "2026-03-05", concept: "COMISION MANTENIMIENTO", amountCents: -1200 },
      { accountingDate: "2026-03-06", concept: "COMPRA SIN EXPLICAR", amountCents: -5000 },
    ],
    "bo",
  );
  const [fee, mystery] = e.state.movements;

  assert(
    e.unreconciledMovements().length === 2,
    "before any mark, both movements are asked about",
    e.unreconciledMovements().length,
  );
  throws(
    () => e.markMovementUnbacked(fee.id, "inventado", "bo"),
    "a reason the owner list does not carry is refused",
  );
  e.markMovementUnbacked(fee.id, "comision", "bo");
  assert(
    fee.unbacked && fee.unbacked.reason === "comision",
    "the reason is stored by CODE on the movement",
    JSON.stringify(fee.unbacked),
  );
  assert(
    e.unreconciledMovements().length === 1 && e.unreconciledMovements()[0].id === mystery.id,
    "the queue stops asking about the explained one — and ONLY that one",
    e.unreconciledMovements().length,
  );
  const q = "2026-Q1";
  const ex = e.exceptionList(q);
  assert(
    !ex.unallocatedMovements.includes(fee.id) && ex.unallocatedMovements.includes(mystery.id),
    "the accountant exception names the unexplained movement, not the explained one",
    JSON.stringify(ex.unallocatedMovements),
  );
  const info = e.unbackedMovements(q);
  assert(
    info.length === 1 &&
      info[0].reason === "comision" &&
      info[0].reasonLabel === "Comisión bancaria",
    "the explained rows travel WITH their reasons, as information",
    JSON.stringify(info),
  );
  e.clearMovementUnbacked(fee.id, "bo");
  assert(
    e.unreconciledMovements().length === 2,
    "clearing the mark puts the movement back in the queue",
    e.unreconciledMovements().length,
  );
  // A movement already matched needs no excuse and is refused one.
  const sup = e.addParty({ roles: ["supplier"], name: "Prov 1D", taxId: "B12345674" }, "bo");
  const bill = e.registerBill(
    { supplierId: sup.id, number: "D-1", baseCents: 4132, vatBp: 2100 },
    "bo",
  );
  e.matchMovement(mystery.id, { billId: bill.id }, "bo");
  throws(
    () => e.markMovementUnbacked(mystery.id, "comision", "bo"),
    "a movement already backed by a document cannot be marked unbacked",
  );
}

/**
 * A SUPPORTING DOCUMENT IS A FILE, NOT A SENTENCE.
 *
 * attachMovementDoc took a free-text string — "está en la carpeta" cleared
 * the flag as effectively as a real receipt, and the accountant export can
 * ship neither. The record form carries a storageKey the blob store can
 * answer for; the string form stays legal because a reference is not wrong,
 * just poorer.
 */
{
  const e = new ERP("2026-03-10");
  const acc = e.addBankAccount({ name: "Caja", kind: "till" }, "bo");
  e.recordCashMovement(acc.id, { concept: "Ferretería", amountCents: -2000 }, "bo");
  const m = e.state.movements[0];
  assert(m.needsDoc === true, "a cash entry without its receipt is flagged", m.needsDoc);
  throws(
    () => e.attachMovementDoc(m.id, { name: "sin-clave.pdf" }, "bo"),
    "an attachment with no stored file behind it is refused",
  );
  e.attachMovementDoc(
    m.id,
    { storageKey: "mov_abc", name: "ticket.jpg", type: "image/jpeg", size: 1234 },
    "bo",
  );
  assert(
    m.needsDoc === false && m.supportingDoc && m.supportingDoc.storageKey === "mov_abc",
    "the record form stores the file and clears the flag",
    JSON.stringify(m.supportingDoc),
  );
  e.recordCashMovement(acc.id, { concept: "Parking", amountCents: -300 }, "bo");
  const m2 = e.state.movements[1];
  e.attachMovementDoc(m2.id, "archivador azul, pestaña 3", "bo");
  assert(
    m2.needsDoc === false &&
      m2.supportingDocRef === "archivador azul, pestaña 3" &&
      !m2.supportingDoc,
    "the string form still works, stored where it always was",
  );

  const sup = e.addParty({ roles: ["supplier"], name: "Prov 1E", taxId: "B12345674" }, "bo");
  const bill = e.registerBill({ supplierId: sup.id, number: "E-1", baseCents: 1000 }, "bo");
  e.attachBillDoc(
    bill.id,
    { storageKey: "bill_k1", name: "factura.pdf", type: "application/pdf" },
    "bo",
  );
  assert(
    bill.supportingDoc && bill.supportingDoc.storageKey === "bill_k1",
    "a manually registered bill takes its paper as a file",
  );
  const cap = e.captureDocument({ docType: "supplierInvoice", imageRef: "cap_blob_1e" }, "bo");
  e.confirmCapture(
    cap.id,
    {
      issuerName: "Prov 1E",
      issuerTaxId: "B12345674",
      docNumber: "E-2",
      date: e.state.today,
      baseCents: 1000,
      vatCents: 210,
      totalCents: 1210,
    },
    "bo",
  );
  const promoted = e.billFromCapture(cap.id, { supplierId: sup.id }, "bo");
  throws(
    () => e.attachBillDoc(promoted.id, { storageKey: "x" }, "bo"),
    "a bill promoted from a capture already has its file — a second is refused",
  );
}

/**
 * LABOUR, PER THE CLIENT REVIEW: a worker has a standard rate AND an overtime
 * rate; hours can name the partida; reports exist BY WORKER; and the month's
 * cash payments to a worker reconcile against that same worker's hours.
 */
{
  const e = new ERP("2026-03-02");
  e.configureEntity(
    { legalName: "Obras L SL", taxId: "B12345674", iban: "ES9121000418450200051332" },
    "bo",
  );
  const cli = e.addParty(
    {
      roles: ["customer"],
      name: "Cli L",
      taxId: "12345678Z",
      billStreet: "s",
      billPostalCode: "08001",
      billCity: "BCN",
      mobile: "600111222",
      email: "l@example.com",
    },
    "bo",
  );
  const bg = e.createBudget({ partyId: cli.id }, "bo");
  const ch = e.addChapter(bg.id, { name: "Albañilería" }, "bo");
  const ln = e.addLine(
    bg.id,
    ch.id,
    { desc: "Tabiques", unit: "m2", qtyMilli: 10000, priceCents: 2000, costCents: 1000 },
    "bo",
  );
  e.issueVersion(bg.id, {}, "bo");
  e.acceptVersion(bg.id, e.currentVersion(bg.id).id, { evidenceRef: "ok" }, "bo");
  const pj = e.createProjectFromAcceptance(bg.id, "bo");

  const w = e.addWorker({ name: "Andreu", kind: "employee" }, "bo");
  throws(
    () =>
      e.addWorkerRate(
        w.id,
        { from: "2026-03-01", rateCentsPerHour: 2000, extraRateCentsPerHour: -5 },
        "bo",
      ),
    "a negative overtime rate is refused",
  );
  e.addWorkerRate(
    w.id,
    { from: "2026-03-01", rateCentsPerHour: 2000, extraRateCentsPerHour: 2600 },
    "bo",
  );

  const hN = e.recordHours(
    { workerId: w.id, projectId: pj.id, lineId: ln.id, hoursMilli: 8000, date: "2026-03-03" },
    "op",
  );
  assert(
    hN.rateCents === 2000 && hN.costCents === 16000,
    "a normal hour costs the standard rate",
    JSON.stringify({ rate: hN.rateCents, cost: hN.costCents }),
  );
  assert(
    hN.lineId === ln.id && hN.chapterNum === String(ch.num),
    "hours can name the partida, and the chapter fills in from it",
    JSON.stringify({ lineId: hN.lineId, chapterNum: hN.chapterNum }),
  );
  const hX = e.recordHours(
    { workerId: w.id, projectId: pj.id, kind: "extra", hoursMilli: 2000, date: "2026-03-03" },
    "op",
  );
  assert(
    hX.rateCents === 2600 && hX.costCents === 5200,
    "an overtime hour costs the overtime rate",
    JSON.stringify({ rate: hX.rateCents, cost: hX.costCents }),
  );
  // A band that names no overtime rate falls back to the standard one —
  // an overtime hour that costs nothing is a lie a margin report repeats.
  const w2 = e.addWorker({ name: "Pau", kind: "employee" }, "bo");
  e.addWorkerRate(w2.id, { from: "2026-03-01", rateCentsPerHour: 1800 }, "bo");
  const hX2 = e.recordHours(
    { workerId: w2.id, projectId: pj.id, kind: "extra", hoursMilli: 1000, date: "2026-03-04" },
    "op",
  );
  assert(
    hX2.rateCents === 1800,
    "…and without one, extra falls back to standard, never zero",
    hX2.rateCents,
  );
  throws(
    () =>
      e.recordHours(
        {
          workerId: w.id,
          projectId: pj.id,
          chapterNum: "9",
          lineId: ln.id,
          hoursMilli: 1000,
          date: "2026-03-05",
        },
        "op",
      ),
    "hours on a partida under the wrong chapter are refused",
  );

  const byW = e.hoursByWorker("2026-03-01", "2026-03-31");
  const andreu = byW.find((x) => x.workerId === w.id);
  assert(
    andreu &&
      andreu.hoursMilli === 10000 &&
      andreu.extraHoursMilli === 2000 &&
      andreu.costCents === 21200 &&
      andreu.projects.length === 1,
    "the by-worker report: totals, overtime split, by site, at cost",
    JSON.stringify(andreu),
  );

  // The month's cash to the worker vs the month's hours by the worker.
  const till = e.addBankAccount({ name: "Caja", kind: "till" }, "bo");
  e.recordCashMovement(
    till.id,
    {
      concept: "Semana Andreu",
      amountCents: -20000,
      workerId: w.id,
      accountingDate: "2026-03-07",
      supportingDocRef: "recibo",
    },
    "bo",
  );
  const rec = e.workerMonthlyReconciliation("2026-03");
  const rA = rec.find((x) => x.workerId === w.id);
  assert(
    rA && rA.bookedCents === 21200 && rA.paidCents === 20000 && rA.diffCents === -1200,
    "per worker, the month's payments reconcile against the month's hours",
    JSON.stringify(rA),
  );
}

/**
 * A VARIATION IS A REAL BUDGET — blocks 5 and 6 of the client review.
 *
 * Created only after the project exists, built with the same builder, frozen
 * by the same acceptance — and on acceptance its chapters JOIN the project:
 * renumbered to carry on from the project's highest so every chapter-addressed
 * mechanism (allocations, progress, reports) works on them unchanged, the
 * economics grow by its sale and cost, certification sees its execution, and
 * the completion date extends by the days it adds.
 */
{
  const e = new ERP("2026-03-02");
  e.configureEntity(
    {
      legalName: "Obras V SL",
      taxId: "B12345674",
      street: "s",
      postalCode: "08960",
      city: "c",
      iban: "ES9121000418450200051332",
    },
    "bo",
  );
  const cli = e.addParty(
    {
      roles: ["customer"],
      name: "Cli V",
      taxId: "12345678Z",
      billStreet: "s",
      billPostalCode: "08001",
      billCity: "BCN",
      mobile: "600111222",
      email: "v@example.com",
    },
    "bo",
  );
  const bg = e.createBudget({ partyId: cli.id }, "bo");
  const c1 = e.addChapter(bg.id, { name: "Reforma base" }, "bo");
  e.addLine(
    bg.id,
    c1.id,
    { desc: "Obra", unit: "ud", qtyMilli: 1000, priceCents: 400000, costCents: 200000 },
    "bo",
  );
  e.issueVersion(bg.id, {}, "bo");
  e.acceptVersion(bg.id, e.currentVersion(bg.id).id, { evidenceRef: "ok" }, "bo");
  const pj = e.createProjectFromAcceptance(bg.id, "bo");
  e.updateProject(pj.id, { targetEnd: "2026-06-30" }, "bo");

  const vb = e.createVariationBudget(pj.id, { reason: "Baño extra", scheduleImpactDays: 10 }, "bo");
  assert(vb.variationOf === pj.id, "the variation knows its project", vb.variationOf);
  const vc = e.addChapter(vb.id, { name: "Baño adicional" }, "bo");
  const vl = e.addLine(
    vb.id,
    vc.id,
    { desc: "Baño completo", unit: "ud", qtyMilli: 1000, priceCents: 80000, costCents: 50000 },
    "bo",
  );
  e.issueVersion(vb.id, {}, "bo");

  // Before acceptance it counts for NOTHING — a draft variation is a proposal.
  assert(
    e.projectEconomics(pj.id).variationRevenueCents === 0,
    "an unaccepted variation adds nothing to the figures",
  );
  throws(
    () => e.createProjectFromAcceptance(vb.id, "bo"),
    "a variation cannot open a project of its own (pre-acceptance)",
  );

  e.acceptVersion(vb.id, e.currentVersion(vb.id).id, { evidenceRef: "firmado" }, "bo");
  throws(
    () => e.createProjectFromAcceptance(vb.id, "bo"),
    "a variation cannot open a project of its own (post-acceptance)",
  );

  // Chapters renumbered to continue the project's own sequence.
  const vAccepted = e.version(vb.id, vb.acceptedVersionId);
  assert(
    vAccepted.chapters[0].num === "2" && vAccepted.chapters[0].lines[0].num === "2.1",
    "the variation's chapters carry on from the project's numbering",
    JSON.stringify({ num: vAccepted.chapters[0].num, line: vAccepted.chapters[0].lines[0].num }),
  );

  // The economics grow by its sale and cost; the chapter table shows it.
  const ec = e.projectEconomics(pj.id);
  assert(
    ec.variationRevenueCents === 80000 &&
      ec.variationCostCents === 50000 &&
      ec.currentRevenueCents === 480000,
    "accepted, it joins the economics",
    JSON.stringify({
      vr: ec.variationRevenueCents,
      vc: ec.variationCostCents,
      cur: ec.currentRevenueCents,
    }),
  );
  const chRows = e.chapterEconomics(pj.id);
  const vRow = chRows.find((r) => r.variation);
  assert(
    vRow && vRow.num === "2" && vRow.saleCents === 80000 && vRow.budgetCostCents === 50000,
    "…and the chapter table carries its row, marked as a variation",
    JSON.stringify(vRow),
  );

  // Costs land on its chapter and its partida through the ordinary doors.
  const sup = e.addParty({ roles: ["supplier"], name: "Prov V", taxId: "B12345674" }, "bo");
  const bill = e.registerBill(
    {
      supplierId: sup.id,
      number: "V-1",
      baseCents: 30000,
      allocations: [{ projectId: pj.id, lineId: vl.id, kind: "material", amountCents: 30000 }],
    },
    "bo",
  );
  assert(
    bill.allocations[0].chapterNum === "2" && bill.allocations[0].lineId === vl.id,
    "a cost allocation reaches the variation's partida, chapter filled from it",
    JSON.stringify(bill.allocations[0]),
  );
  const drill = e.chapterCosts(pj.id, "2");
  assert(
    drill.length === 1 && drill[0].amountCents === 30000 && drill[0].lineId === vl.id,
    "the chapter drill-down lists exactly that cost, with its partida",
    JSON.stringify(drill),
  );

  // Progress: marking the variation's line moves the project's own percent.
  const before = e.projectProgressPct(pj.id);
  e.markLineProgress(pj.id, vl.id, { pct: 100 }, "op");
  const after = e.projectProgressPct(pj.id);
  assert(
    after > before,
    "progress on a variation line moves the project's percent",
    before + " -> " + after,
  );
  // …and certification sees the executed variation work.
  const cert = e.invoiceBases(pj.id).certification;
  assert(
    cert.chapters.some((c) => String(c.num) === "2" && c.doneCents === 80000),
    "certification proposes the variation's executed work",
    JSON.stringify(cert.chapters),
  );

  // Block 6: the deadline moved by the variation's days, automatically.
  assert(
    e.project(pj.id).dates.targetEnd === "2026-07-10",
    "acceptance extends the completion date by the variation's days",
    e.project(pj.id).dates.targetEnd,
  );
}

/* ===================================================================== PK7-B
   GASTOS DECIDES, CONCILIACIÓN IDENTIFIES, AVANCE ECONÓMICO REPORTS.

   Three properties, and the third is the one that had been quietly false.
   ===================================================================== */
{
  const e = new ERP("2026-08-27");
  const cli = e.addParty(
    {
      roles: ["customer"],
      name: "Cli 7B",
      taxId: "12345678Z",
      billStreet: "s",
      billPostalCode: "08001",
      billCity: "BCN",
      mobile: "600111222",
      email: "cli7b@example.com",
    },
    "bo",
  );
  const sup = e.addParty({ roles: ["supplier"], name: "Prov 7B", taxId: "B12345674" }, "bo");
  const bg = e.createBudget({ partyId: cli.id }, "bo");
  const c1 = e.addChapter(bg.id, { name: "Demoliciones" }, "bo");
  const c2 = e.addChapter(bg.id, { name: "Pintura" }, "bo");
  const l1 = e.addLine(
    bg.id,
    c1.id,
    { desc: "Tabique", unit: "m2", qtyMilli: 10000, priceCents: 2000, costCents: 1000 },
    "bo",
  );
  const l2 = e.addLine(
    bg.id,
    c2.id,
    { desc: "Pintar", unit: "m2", qtyMilli: 10000, priceCents: 1000, costCents: 500 },
    "bo",
  );
  e.issueVersion(bg.id, {}, "bo");
  e.acceptVersion(bg.id, e.currentVersion(bg.id).id, { evidenceRef: "ok" }, "bo");
  const pj = e.createProjectFromAcceptance(bg.id, "bo");

  /* THE INVARIANT. The per-partida table plus the pending-assignment block
     must add up to the project's own actual cost, whatever the cost's source.
     They used to enumerate separately — bills and labour in one, bills, labour
     and tickets in the other, movements in NEITHER — so a cost paid straight
     from an account counted towards the project and appeared in no row of
     either. Now one enumeration feeds all of them, and this is the property
     that keeps it that way. */
  const closes = (label) => {
    const total = e.actualCostCents(pj.id);
    const byCh = e.chapterEconomics(pj.id).reduce((s, r) => s + r.actualCents, 0);
    const pending = e.unassignedChapterCosts(pj.id).reduce((s, r) => s + r.amountCents, 0);
    assert(
      byCh + pending === total,
      "the partida table plus what is pending equals the project's cost — " + label,
      byCh + " + " + pending + " ≠ " + total,
    );
  };
  closes("nothing spent yet");

  const b1 = e.registerBill(
    {
      supplierId: sup.id,
      number: "7B-1",
      baseCents: 10000,
      allocations: [{ projectId: pj.id, lineId: l1.id, kind: "material", amountCents: 10000 }],
    },
    "bo",
  );
  closes("a supplier invoice on a partida");

  const acc = e.addBankAccount({ name: "Banco 7B", kind: "bank" }, "bo");
  const till = e.addBankAccount({ name: "Caja 7B", kind: "till" }, "bo");

  /* Petty cash on site: a project, and no partida yet — the operator's own
     exception, and the case that used to vanish from both tables at once. */
  const petty = e.recordCashMovement(
    till.id,
    {
      accountingDate: "2026-08-20",
      concept: "Tornillería 7B",
      amountCents: -3000,
      supportingDocRef: null,
    },
    "op",
  );
  e.splitMovement(petty.id, [{ projectId: pj.id, kind: "material", amountCents: 3000 }], "op");
  closes("petty cash on the job with no partida");
  assert(
    e.unassignedChapterCosts(pj.id).some((r) => r.source === "movement"),
    "a project cost paid from an account is listed as pending a partida",
    JSON.stringify(e.unassignedChapterCosts(pj.id)),
  );

  /* …and it can be given one, from the same block, through the same method a
     bill line uses. Before PK7-B this threw "Unknown cost source: movement". */
  const row = e.unassignedChapterCosts(pj.id).find((r) => r.source === "movement");
  e.assignChapterSplit(pj.id, row.id, [{ chapterNum: c2.num, amountCents: 3000 }], "bo");
  closes("after the petty cash is assigned a partida");
  assert(
    e.chapterCosts(pj.id, c2.num).some((r) => r.source === "movement" && r.amountCents === 3000),
    "the assigned petty cash appears under its partida",
    JSON.stringify(e.chapterCosts(pj.id, c2.num)),
  );

  /* THE CASCADE. A subpartida belongs to one partida of one project, and the
     engine refuses the ones that do not — not merely omits them from a list.
     A screen can be rebuilt; this is what makes the rebuild safe. */
  {
    const other = e.createQuickProject(
      { partyId: cli.id, desc: "Otra", activityLine: "reforma", valueCents: 100000 },
      "bo",
    );
    throws(
      () =>
        e.registerBill(
          {
            supplierId: sup.id,
            number: "7B-X",
            baseCents: 1000,
            allocations: [
              { projectId: other.id, lineId: l1.id, kind: "material", amountCents: 1000 },
            ],
          },
          "bo",
        ),
      "a subpartida of another project is refused",
    );
    throws(
      () =>
        e.registerBill(
          {
            supplierId: sup.id,
            number: "7B-Y",
            baseCents: 1000,
            allocations: [
              {
                projectId: pj.id,
                chapterNum: c2.num,
                lineId: l1.id,
                kind: "material",
                amountCents: 1000,
              },
            ],
          },
          "bo",
        ),
      "a subpartida of ANOTHER partida of the same project is refused",
    );
  }

  /* D1. Re-splitting a paid invoice across partidas moves the COST and leaves
     the PAYMENT and the MATCH exactly where they were. The two axes are
     independent — Gastos decides, Conciliación identifies — and this is that
     independence, measured. */
  e.importMovements(
    acc.id,
    [{ accountingDate: "2026-08-21", concept: "PAGO PROV 7B", amountCents: -12100 }],
    "bo",
  );
  const pay = e.state.movements[e.state.movements.length - 1];
  e.matchMovementSplit(pay.id, [{ billId: b1.id, amountCents: 12100 }], "bo");
  const paidOut = e.billOutstandingCents(b1.id);
  const costBefore = e.actualCostCents(pj.id);
  e.allocateBill(
    b1.id,
    [
      { projectId: pj.id, lineId: l1.id, kind: "material", amountCents: 4000 },
      { projectId: pj.id, lineId: l2.id, kind: "material", amountCents: 6000 },
    ],
    "bo",
  );
  const byChAfter = e.chapterEconomics(pj.id);
  assert(
    e.actualCostCents(pj.id) === costBefore,
    "re-splitting a paid invoice does not change what the project cost",
    costBefore + " → " + e.actualCostCents(pj.id),
  );
  assert(
    byChAfter.find((r) => String(r.num) === String(c2.num)).actualCents === 6000 + 3000,
    "the re-split moves the money to the other partida",
    JSON.stringify(byChAfter),
  );
  assert(
    e.billOutstandingCents(b1.id) === paidOut &&
      pay.matched &&
      pay.matched.documents.length === 1 &&
      e.state.payments.filter((x) => x.movementId === pay.id).length === 1,
    "the payment and the match are untouched by the re-split",
    JSON.stringify({ out: e.billOutstandingCents(b1.id), matched: pay.matched }),
  );
  closes("after D1");

  /* A general expense identified from Conciliación is an overhead, and says
     so. `splitMovement` used to stamp every split «coste de obra» whatever it
     named, which the allocation underneath then contradicted. */
  e.importMovements(
    acc.id,
    [{ accountingDate: "2026-08-22", concept: "PAPELERIA 7B", amountCents: -4500 }],
    "bo",
  );
  const gen = e.state.movements[e.state.movements.length - 1];
  e.splitMovement(gen.id, [{ overheadCategory: "office", amountCents: 4500 }], "bo");
  assert(
    gen.class === "overhead" && !gen.allocations.some((a) => a.projectId),
    "a split that names no project is a general expense, not a project cost",
    gen.class,
  );
  closes("a general expense changes no project");
}

/* ===================================================================== PK7-C
   IS THE REST STILL OWED, OR CLOSED? (A2) — and the two rules around it.
   ===================================================================== */
{
  const e = new ERP("2026-08-27");
  const cli = e.addParty(
    {
      roles: ["customer"],
      name: "Cli 7C",
      taxId: "12345678Z",
      billStreet: "s",
      billPostalCode: "08001",
      billCity: "BCN",
      mobile: "600111222",
      email: "cli7c@example.com",
    },
    "bo",
  );
  const sup = e.addParty(
    { roles: ["supplier"], name: "Materiales Vallès SA", taxId: "B12345674" },
    "bo",
  );
  const acc = e.addBankAccount({ name: "Banco 7C", kind: "bank" }, "bo");

  const bill = e.registerBill(
    { supplierId: sup.id, number: "7C-1", baseCents: 100000, allocations: [] },
    "bo",
  );
  const full = e.billOutstandingCents(bill.id);

  /* The payment lands 12,50 € short — a prompt-payment discount taken by the
     payer, which is the operator's own example. */
  e.importMovements(
    acc.id,
    [
      {
        accountingDate: "2026-08-20",
        concept: "PAGO MATERIALES VALLES",
        amountCents: -(full - 1250),
      },
    ],
    "bo",
  );
  const mv = e.state.movements[e.state.movements.length - 1];
  e.matchMovementSplit(mv.id, [{ billId: bill.id, amountCents: full - 1250 }], "bo");
  assert(
    e.billOutstandingCents(bill.id) === 1250,
    "a short payment leaves exactly the shortfall owing",
    String(e.billOutstandingCents(bill.id)),
  );

  /* A reason is required, and it has to be one of the tenant's own. «Closed»
     with no reason is indistinguishable from a mistake three months later. */
  throws(() => e.settleShortfall("bill", bill.id, "", "bo"), "closing the rest needs a reason");
  throws(
    () => e.settleShortfall("bill", bill.id, "porque-si", "bo"),
    "the reason has to come from the list",
  );
  throws(
    () => e.settleShortfall("bill", bill.id, "redondeo", "bo", 5000),
    "closing more than is owed is refused",
  );

  const wof = e.settleShortfall("bill", bill.id, "prontoPago", "bo");
  assert(
    e.billOutstandingCents(bill.id) === 0,
    "closing the rest drives the document to zero",
    String(e.billOutstandingCents(bill.id)),
  );
  assert(
    wof.reason === "prontoPago" && wof.amountCents === 1250 && wof.date && wof.by,
    "the close records its reason, its amount, its date and who said so",
    JSON.stringify(wof),
  );
  throws(
    () => e.settleShortfall("bill", bill.id, "redondeo", "bo"),
    "a settled document cannot be closed twice",
  );

  /* Reversible, because PK7-D's Deshacer has to be able to unwind it and
     because a wrong reason chosen in a hurry must not be permanent. */
  e.undoSettleShortfall("bill", bill.id, wof.id, "bo");
  assert(
    e.billOutstandingCents(bill.id) === 1250,
    "undoing the close puts the rest back on the register",
    String(e.billOutstandingCents(bill.id)),
  );

  /* The same on the money-in side, and the payment itself is untouched by
     either: closing a shortfall explains a document, it does not move cash. */
  const paidBefore = e.state.payments.filter((p) => p.movementId === mv.id).length;
  e.settleShortfall("bill", bill.id, "redondeo", "bo");
  assert(
    e.state.payments.filter((p) => p.movementId === mv.id).length === paidBefore &&
      mv.matched &&
      mv.matched.documents.length === 1,
    "closing the rest leaves the payment and the match exactly as they were",
    JSON.stringify(mv.matched),
  );

  /* CANDIDATES, CLOSEST FIRST (113c). The list used to arrive in creation
     order and the screen showed the first twelve of it — twelve documents
     chosen by age and unrelated to the movement in front of you. */
  const far = e.registerBill(
    { supplierId: sup.id, number: "7C-FAR", baseCents: 500000, allocations: [] },
    "bo",
  );
  const near = e.registerBill(
    { supplierId: sup.id, number: "7C-NEAR", baseCents: 20000, allocations: [] },
    "bo",
  );
  e.importMovements(
    acc.id,
    [{ accountingDate: "2026-08-22", concept: "PAGO 7C", amountCents: -24200 }],
    "bo",
  );
  const probe = e.state.movements[e.state.movements.length - 1];
  const cands = e.reconciliationCandidates(probe.id);
  assert(
    cands.length >= 2 && cands[0].id === near.id,
    "the nearest document in amount is offered first",
    cands.map((c) => c.reference + ":" + c.gapCents).join(", "),
  );
  assert(
    cands.every((c) => typeof c.gapCents === "number" && typeof c.daysApart === "number"),
    "every candidate carries how far it is, so the screen can say why",
    JSON.stringify(cands[0]),
  );
  assert(
    cands[0].gapCents <= cands[cands.length - 1].gapCents && far.id !== cands[0].id,
    "and the far one is not first",
    cands[0].reference,
  );
}

/* ===================================================================== PK7-D
   CONCILIADOS, DESHACER, AND TRANSFERS AS PAIRS.
   ===================================================================== */
{
  const e = new ERP("2026-08-27");
  const cli = e.addParty(
    {
      roles: ["customer"],
      name: "Cli 7D",
      taxId: "12345678Z",
      billStreet: "s",
      billPostalCode: "08001",
      billCity: "BCN",
      mobile: "600111222",
      email: "cli7d@example.com",
    },
    "bo",
  );
  const sup = e.addParty({ roles: ["supplier"], name: "Prov 7D", taxId: "B12345674" }, "bo");
  const bg = e.createBudget({ partyId: cli.id }, "bo");
  const c1 = e.addChapter(bg.id, { name: "Demoliciones" }, "bo");
  const l1 = e.addLine(
    bg.id,
    c1.id,
    { desc: "Tabique", unit: "m2", qtyMilli: 10000, priceCents: 2000, costCents: 1000 },
    "bo",
  );
  e.issueVersion(bg.id, {}, "bo");
  e.acceptVersion(bg.id, e.currentVersion(bg.id).id, { evidenceRef: "ok" }, "bo");
  const pj = e.createProjectFromAcceptance(bg.id, "bo");
  const bank = e.addBankAccount({ name: "Banco 7D", kind: "bank" }, "bo");
  const till = e.addBankAccount({ name: "Caja 7D", kind: "till" }, "bo");

  /* THE SAFETY PROPERTY THIS WHOLE PACKAGE RESTS ON.
     A matched movement contributes nothing to the project's cost — the BILL it
     paid does — so matching it, and then undoing that match, must leave the
     project exactly where it was. If undo could move cost, no reconciliation
     would ever be safe to correct, and the answer to "did I get this right?"
     would be "do not touch it". */
  const bill = e.registerBill(
    {
      supplierId: sup.id,
      number: "7D-1",
      baseCents: 10000,
      allocations: [{ projectId: pj.id, lineId: l1.id, kind: "material", amountCents: 10000 }],
    },
    "bo",
  );
  const costBefore = e.actualCostCents(pj.id);
  const owed = e.billOutstandingCents(bill.id);
  e.importMovements(
    bank.id,
    [{ accountingDate: "2026-08-20", concept: "PAGO PROV 7D", amountCents: -owed }],
    "bo",
  );
  const pay = e.state.movements[e.state.movements.length - 1];
  e.matchMovementSplit(pay.id, [{ billId: bill.id, amountCents: owed }], "bo");
  const costDuring = e.actualCostCents(pj.id);
  e.unexplainMovement(pay.id, "bo");
  const costAfter = e.actualCostCents(pj.id);
  assert(
    costBefore === costDuring && costDuring === costAfter && costAfter === 10000,
    "project cost is identical before a match, during it, and after Deshacer",
    [costBefore, costDuring, costAfter].join(" / "),
  );
  assert(
    e.billOutstandingCents(bill.id) === owed &&
      !pay.matched &&
      pay.status === "unallocated" &&
      !e.state.payments.some((p) => p.movementId === pay.id && !p.voided),
    "Deshacer unwinds the payment the match created and returns the movement to the queue",
    JSON.stringify({ owed: e.billOutstandingCents(bill.id), matched: pay.matched }),
  );

  /* A TRANSFER IS A PAIR, AND THE PRODUCT NOW HOLDS IT AS ONE.
     Before, the single-row path marked one leg and left the other in the
     queue, and nothing recorded that the two belonged together — so nothing
     could ever undo them together. */
  e.importMovements(
    bank.id,
    [{ accountingDate: "2026-08-21", concept: "TRASPASO A CAJA", amountCents: -50000 }],
    "bo",
  );
  const outLeg = e.state.movements[e.state.movements.length - 1];
  e.importMovements(
    till.id,
    [{ accountingDate: "2026-08-21", concept: "TRASPASO RECIBIDO", amountCents: 50000 }],
    "bo",
  );
  const inLeg = e.state.movements[e.state.movements.length - 1];

  throws(
    () => e.markInternalTransfer(outLeg.id, outLeg.id, "bo"),
    "a movement cannot be its own transfer",
  );
  {
    e.importMovements(
      bank.id,
      [{ accountingDate: "2026-08-21", concept: "DEVOLUCION", amountCents: 50000 }],
      "bo",
    );
    const sameAcct = e.state.movements[e.state.movements.length - 1];
    throws(
      () => e.markInternalTransfer(outLeg.id, sameAcct.id, "bo"),
      "two legs on the SAME account are a payment and its refund, not a transfer",
    );
  }

  const before = e.unreconciledMovements(null, null, null).length;
  e.markInternalTransfer(outLeg.id, inLeg.id, "bo");
  assert(
    outLeg.class === "internalTransfer" &&
      inLeg.class === "internalTransfer" &&
      outLeg.excludedFromPL &&
      inLeg.excludedFromPL,
    "marking a transfer marks BOTH legs and keeps both out of the profit figures",
    JSON.stringify({ out: outLeg.class, in: inLeg.class }),
  );
  assert(
    outLeg.transferPair.withMovementId === inLeg.id &&
      inLeg.transferPair.withMovementId === outLeg.id,
    "each leg records which movement it is paired with",
    JSON.stringify(outLeg.transferPair),
  );
  assert(
    e.unreconciledMovements(null, null, null).length === before - 2,
    "both legs leave the queue at once",
    String(e.unreconciledMovements(null, null, null).length),
  );

  /* Undoing from EITHER leg returns both. Pressing Deshacer on the incoming
     line and getting the outgoing one back is the whole point of storing the
     link. */
  e.unexplainMovement(inLeg.id, "bo");
  assert(
    !outLeg.transferPair &&
      !inLeg.transferPair &&
      outLeg.status === "unallocated" &&
      inLeg.status === "unallocated" &&
      !outLeg.excludedFromPL &&
      !inLeg.excludedFromPL,
    "Deshacer on one leg returns BOTH to the queue",
    JSON.stringify({ out: outLeg.status, in: inLeg.status }),
  );
  assert(
    e.unreconciledMovements(null, null, null).length === before,
    "…and the queue is exactly as it was",
    String(e.unreconciledMovements(null, null, null).length),
  );

  /* CONCILIADOS SAYS HOW, not merely that. Every kind of explanation is
     distinguished, because a screen that lumps them together cannot offer the
     right way back. */
  e.markInternalTransfer(outLeg.id, inLeg.id, "bo");
  e.importMovements(
    bank.id,
    [{ accountingDate: "2026-08-22", concept: "COMISION MANTENIMIENTO", amountCents: -1450 }],
    "bo",
  );
  const fee = e.state.movements[e.state.movements.length - 1];
  e.markMovementUnbacked(fee.id, "comision", "bo");
  e.importMovements(
    bank.id,
    [{ accountingDate: "2026-08-23", concept: "PAPELERIA", amountCents: -4500 }],
    "bo",
  );
  const gen = e.state.movements[e.state.movements.length - 1];
  e.splitMovement(gen.id, [{ overheadCategory: "office", amountCents: 4500 }], "bo");

  const explained = e.explainedMovements(null, null, null);
  const hows = {};
  for (const row of explained) hows[row.how] = (hows[row.how] || 0) + 1;
  assert(
    hows.internalTransfer === 2 && hows.unbacked === 1 && hows.allocated === 1,
    "Conciliados distinguishes transfer, sin-factura and allocated",
    JSON.stringify(hows),
  );
  assert(
    explained.find((x) => x.id === fee.id).detail === "Comisión bancaria",
    "the sin-factura row names the reason, not its code",
    explained.find((x) => x.id === fee.id).detail,
  );
  assert(
    explained.every((x) => x.undoable),
    "every explained row offers a way back while the period is open",
    JSON.stringify(explained.filter((x) => !x.undoable)),
  );

  /* Except the one explained by nothing but the seal over it: there is no
     decision to undo, and offering a button that would have to refuse is
     worse than saying so. */
  // The seal refuses while anything is unexplained — correctly. Clear the two
  // left over from the checks above (the un-matched payment and the refund
  // used as a negative control) so the seal has something to seal.
  for (const m of e.unreconciledMovements(null, null, null))
    e.markMovementUnbacked(m.id, "comision", "bo");
  e.closeBankPeriod("2026-08-01", "2026-08-31", "bo");
  const sealed = e.explainedMovements(null, null, null);
  assert(
    sealed.every((x) => !x.undoable),
    "a closed period takes the way back off every row in it",
    JSON.stringify(sealed.filter((x) => x.undoable).slice(0, 3)),
  );
  throws(() => e.unexplainMovement(fee.id, "bo"), "and Deshacer is refused inside a sealed period");
}

/* ===================================================================== PK7-E
   CLEARING THE QUARTER — bulk actions run the SAME calls the single-row
   panel runs, on a filtered set, and Deshacer undoes all of what they wrote
   in one press.
   ===================================================================== */
{
  const e = new ERP("2026-08-27");
  const sup = e.addParty({ roles: ["supplier"], name: "Prov 7E", taxId: "B12345674" }, "bo");
  const acc = e.addBankAccount({ name: "Banco 7E", kind: "bank" }, "bo");
  const till = e.addBankAccount({ name: "Caja 7E", kind: "till" }, "bo");

  const cards = e.importMovements(
    acc.id,
    [
      { accountingDate: "2026-08-01", concept: "CAFETERIA 1", amountCents: -260 },
      { accountingDate: "2026-08-02", concept: "CAFETERIA 2", amountCents: -310 },
      { accountingDate: "2026-08-03", concept: "CAFETERIA 3", amountCents: -280 },
    ],
    "bo",
  );

  /* A row already explained another way — matched to a document — before the
     bulk action runs. `splitMovement` itself carries NO guard against an
     already-matched movement (only `markMovementUnbacked` does); the bulk
     loop's own filter is the only thing standing between it and a shortcut
     the single-row panel would never permit. */
  const bill = e.registerBill(
    { supplierId: sup.id, number: "7E-1", baseCents: 5000, allocations: [] },
    "bo",
  );
  const owed = e.billOutstandingCents(bill.id);
  e.importMovements(
    acc.id,
    [{ accountingDate: "2026-08-04", concept: "PAGO PROV 7E", amountCents: -owed }],
    "bo",
  );
  const paid = e.state.movements[e.state.movements.length - 1];
  e.matchMovementSplit(paid.id, [{ billId: bill.id, amountCents: owed }], "bo");

  /* THE BULK LOOP, exactly as the queue's «Identificar» button runs it: one
     category, one reason, applied through the same two engine calls the
     single-row panel uses, filtered to rows still open at the moment of the
     click. */
  const targets = [...cards.map((m) => m.id), paid.id];
  const before = e.unreconciledMovements(null, null, acc.id).length;
  for (const id of targets) {
    const m = e.state.movements.find((x) => x.id === id);
    if (!m || m.status !== "unallocated") continue;
    e.splitMovement(
      id,
      [{ overheadCategory: "office", amountCents: Math.abs(m.amountCents) }],
      "bo",
    );
    e.markMovementUnbacked(id, "comision", "bo");
  }
  assert(
    e.unreconciledMovements(null, null, acc.id).length === before - cards.length,
    "the bulk classify clears exactly the open rows, not the already-matched one",
    String(e.unreconciledMovements(null, null, acc.id).length),
  );
  assert(
    e.billOutstandingCents(bill.id) === 0 &&
      paid.matched &&
      paid.matched.documents.length === 1 &&
      paid.allocations.length === 0,
    "the already-matched row is untouched — no shortcut around its own guard",
    JSON.stringify({ outstanding: e.billOutstandingCents(bill.id), allocations: paid.allocations }),
  );
  for (const m of cards) {
    assert(
      m.class === "overhead" &&
        m.allocations[0].overheadCategory === "office" &&
        m.unbacked.reason === "comision",
      "each classified row carries both the category and the reason",
      JSON.stringify({ class: m.class, allocations: m.allocations, unbacked: m.unbacked }),
    );
  }

  /* THE BUG THIS BLOCK WAS WRITTEN TO CATCH. `movementExplanation` reports
     "allocated" for a row that carries BOTH a category and a reason, because
     that check runs first — and a Deshacer that cleared only what was
     REPORTED, rather than everything the bulk action WROTE, would leave
     `unbacked` behind: the row would come back explained a second time
     instead of returning to the queue, and "one Deshacer" would have quietly
     become two. */
  const one = cards[0];
  const explanation = e.movementExplanation(one);
  assert(
    explanation.how === "allocated",
    "the compound row is reported as allocated — reasons come second",
    explanation.how,
  );
  e.unexplainMovement(one.id, "bo");
  assert(
    one.status === "unallocated" && !one.unbacked && one.allocations.length === 0 && !one.class,
    "ONE Deshacer clears the category AND the reason, not just the one that was reported",
    JSON.stringify({ status: one.status, unbacked: one.unbacked, allocations: one.allocations }),
  );
  assert(
    e.unreconciledMovements(null, null, acc.id).some((m) => m.id === one.id),
    "…and the row is back in the queue after that single press",
    String(e.unreconciledMovements(null, null, acc.id).some((m) => m.id === one.id)),
  );

  /* BULK "MARCAR SIN RESPALDO": the same call the single row makes, once per
     movement — a task per document owed, not one task for the whole batch. A
     fresh batch, deliberately: `cards[1]`/`cards[2]` are still carrying the
     category-and-reason the earlier loop wrote them, and a bulk action never
     runs twice on a row that already left the queue. */
  const missing = e.importMovements(
    acc.id,
    [
      { accountingDate: "2026-08-06", concept: "SUBCONTRATA SIN FACTURA 1", amountCents: -22000 },
      { accountingDate: "2026-08-06", concept: "SUBCONTRATA SIN FACTURA 2", amountCents: -18000 },
    ],
    "bo",
  );
  const tasksBefore = e.state.tasks.length;
  for (const m of missing) {
    if (m.status !== "unallocated") continue;
    e.flagMovementNoDoc(m.id, "bo");
  }
  assert(
    e.state.tasks.length === tasksBefore + missing.length,
    "one task per movement, not one task for the batch",
    String(e.state.tasks.length - tasksBefore),
  );
  assert(
    missing.every((m) => m.needsDoc === true),
    "every bulk-flagged row is marked needing its own receipt",
    JSON.stringify(missing.map((m) => m.needsDoc)),
  );

  /* PETTY CASH is untouched by any of this — the bulk action only ever runs
     against what was in the queue's selection, and a movement never selected
     stays exactly as the operator left it. */
  const petty = e.recordCashMovement(
    till.id,
    {
      accountingDate: "2026-08-05",
      concept: "Tornillería 7E",
      amountCents: -1200,
      supportingDocRef: null,
    },
    "op",
  );
  assert(
    petty.status === "unallocated" && !petty.class,
    "a movement outside the selection is not touched by the bulk action",
    JSON.stringify({ status: petty.status, class: petty.class }),
  );
}

/* Placed LAST on purpose. It registers a bill, and an older block reaches for
   `erp.state.bills[0]` by index — so inserting this earlier silently handed
   that block somebody else's document. The index is the fragile thing, not
   this block, but moving one file is cheaper than re-keying an assertion that
   is not what is under test here. */
/* ── PK10-S3 · a split distributes the COST, so it foots against the base ───
   `allocateCapture` demanded the VAT-inclusive total while `registerBill`
   demanded the taxable base — and `billDrawer` seeds a bill from the capture's
   own rows, so a split accepted by the first door was guaranteed to be refused
   by the second. The operator's own invoice is the fixture: 2.483,80 base,
   521,60 IVA, 3.005,40 total, distributed across two partidas and one row with
   no partida at all. */
{
  // Its own job and its own supplier: this block asserts about money, and
  // borrowing another block's records would make the figures depend on the
  // order the file happens to run in.
  const b = erp.createBudget({ partyId: cust.id, activityLine: "renovation" }, "bo");
  const ch1 = erp.addChapter(b.id, { name: "Tabiquería y trasdosados" }, "bo");
  const ch2 = erp.addChapter(b.id, { name: "Fontanería" }, "bo");
  erp.addLine(b.id, ch1.id, { desc: "Cabinas", unit: "ud", qtyMilli: 3000, priceCents: 80000 });
  erp.addLine(b.id, ch2.id, { desc: "Ramal", unit: "ud", qtyMilli: 1000, priceCents: 60000 });
  erp.issueVersion(b.id, { channel: "hand" }, "bo");
  erp.acceptVersion(b.id, erp.currentVersion(b.id).id, { evidenceRef: "ok" }, "bo");
  const prj = erp.createProjectFromAcceptance(b.id, "bo");
  const supplier = sup;

  const cap = erp.captureDocument({ docType: "supplierInvoice", imageRef: "img-pk10" }, "bo");
  erp.confirmCapture(
    cap.id,
    {
      issuerName: "SUMINISTROS CERDA MATERIALS, S.L.",
      issuerTaxId: "B62889417",
      docNumber: "F-2026/4471",
      date: erp.today,
      baseCents: 248380,
      vatCents: 52160,
      totalCents: 300540,
      iban: "",
    },
    "bo",
  );
  assert(
    erp.captureBasisCents(erp.state.captured.find((x) => x.id === cap.id).confirmed) === 248380,
    "the basis of a split is the taxable base, not the total",
  );

  const split = (a, b, c) => [
    { projectId: prj.id, chapterNum: "1", kind: "material", amountCents: a },
    { projectId: prj.id, chapterNum: "2", kind: "material", amountCents: b },
    // «Sin partida»: a real cost on the job that no budgeted chapter covers.
    { projectId: prj.id, chapterNum: null, kind: "material", amountCents: c },
  ];

  throws(
    () => erp.allocateCapture(cap.id, split(197614, 32966, 17800 + 52160), "bo"),
    "a split that totals the VAT-inclusive amount is refused",
  );
  const ok2 = erp.allocateCapture(cap.id, split(197614, 32966, 17800), "bo");
  assert(
    ok2.allocations.reduce((t, a) => t + a.amountCents, 0) === 248380,
    "…and the operator's own distribution, footing to the base, is accepted",
  );
  assert(
    ok2.allocations[2].chapterNum === null,
    "…including a row with no partida, which the engine has always allowed",
  );

  /* THE CATCH-22, stated as a test: the very rows this door accepted must be
     the rows the bill door accepts, because the bill drawer copies them. */
  const bill = erp.registerBill(
    {
      supplierId: supplier.id,
      number: "F-2026/4471",
      date: erp.today,
      baseCents: 248380,
      vatCents: 52160,
      capId: cap.id,
      allocations: ok2.allocations.map((a) => ({
        projectId: a.projectId,
        chapterNum: a.chapterNum,
        kind: a.kind,
        amountCents: a.amountCents,
      })),
    },
    "bo",
  );
  assert(
    bill.allocations.reduce((t, a) => t + a.amountCents, 0) === 248380,
    "the split accepted by the capture is the split the bill accepts — one door, one unit",
  );

  // Nothing known yet: assert nothing rather than assert against an invention.
  const blind = erp.captureDocument({ docType: "ticket", imageRef: "img-blind" }, "bo");
  const filed = erp.allocateCapture(
    blind.id,
    [{ overheadCategory: "office", kind: "material", amountCents: 1234 }],
    "bo",
  );
  assert(
    filed.allocations[0].amountCents === 1234,
    "an unconfirmed document can still be filed — there is nothing to check against",
  );
}

/* ── PK10-S6 · the same document, filed twice, and no way to remove either ──
   The operator filed one supplier invoice twice and the register showed them
   side by side with no warning: CAP-05 compared `issuerTaxId AND docNumber`,
   and the READER had changed between the two captures, so the two copies
   carried different tax ids. Identity that needs every field read the same way
   stops working the day the reader improves. And once filed, nothing could
   delete either one. */
{
  const cap = (n) =>
    erp.captureDocument({ docType: "supplierInvoice", imageRef: "img-" + n }, "bo");
  const confirm = (id, over) =>
    erp.confirmCapture(
      id,
      Object.assign(
        {
          // Its own number: the PK10-S3 block above files a document with the
          // operator's real one, and this rule would correctly call that a
          // duplicate of this — which is the rule working, and would make this
          // block's assertions depend on the order the file happens to run in.
          issuerName: "SUMINISTROS CERDA MATERIALS, S.L.",
          issuerTaxId: "B62889417",
          docNumber: "F-2026/8801",
          date: "2026-09-18",
          baseCents: 248380,
          vatCents: 52160,
          totalCents: 300540,
          iban: "",
        },
        over || {},
      ),
      "bo",
    );

  // The operator's own pair: same issuer and number, tax ids read differently.
  const first = cap("dup-a");
  confirm(first.id, {});
  const second = cap("dup-b");
  confirm(second.id, { issuerTaxId: "B66123456" });
  assert(
    erp.duplicateCaptureMap()[second.id] === first.id,
    "the same invoice filed twice is flagged even when the two readings disagree about the tax id",
    JSON.stringify(erp.duplicateCaptureMap()),
  );

  // Two documents nobody has confirmed yet are not duplicates of each other.
  const blankA = cap("blank-a");
  const blankB = cap("blank-b");
  confirm(blankA.id, { issuerName: "", issuerTaxId: "", docNumber: "", date: "", totalCents: 0 });
  confirm(blankB.id, { issuerName: "", issuerTaxId: "", docNumber: "", date: "", totalCents: 0 });
  assert(
    !erp.duplicateCaptureMap()[blankB.id],
    "…and two documents with nothing read on them are not duplicates of each other",
  );

  // No number anywhere: the same issuer, the same day and the same money is
  // the same document — nobody sends two.
  const tA = cap("tick-a");
  const tB = cap("tick-b");
  confirm(tA.id, {
    issuerName: "Materials Vallès S.L.",
    issuerTaxId: "",
    docNumber: "",
    totalCents: 58080,
    date: "2026-08-27",
  });
  confirm(tB.id, {
    issuerName: "Materials Valles S.L.",
    issuerTaxId: "",
    docNumber: "",
    totalCents: 58080,
    date: "2026-08-27",
  });
  assert(
    erp.duplicateCaptureMap()[tB.id] === tA.id,
    "…and an unnumbered ticket is matched on issuer, day and amount, accents aside",
  );

  // A different number is a different document, however alike the rest is.
  const other = cap("dup-c");
  confirm(other.id, { docNumber: "F-2026/8802" });
  assert(
    !erp.duplicateCaptureMap()[other.id],
    "a different document number is a different document",
  );

  // Deleting the copy: the archive's missing gesture.
  const before = erp.state.captured.length;
  erp.deleteCapture(second.id, "bo");
  assert(
    erp.state.captured.length === before - 1 && !erp.state.captured.some((x) => x.id === second.id),
    "a filed document can be deleted",
  );
  assert(
    !erp.duplicateCaptureMap()[first.id],
    "…and the one that is left stops being flagged as a duplicate",
  );
  assert(
    erp.state.audit.some((a) => a.action === "deleteCapture"),
    "…and the deletion is written to the audit log",
  );
  throws(
    () => erp.deleteCapture("cap-does-not-exist", "bo"),
    "deleting a document that is not there is refused",
  );

  // Once it is a bill it is an accounting record, and the photograph behind it
  // may not vanish from under it.
  const billed = cap("dup-billed");
  confirm(billed.id, { docNumber: "F-2026/9999" });
  erp.allocateCapture(
    billed.id,
    [{ overheadCategory: "office", kind: "material", amountCents: 248380 }],
    "bo",
  );
  erp.billFromCapture(billed.id, { supplierId: sup.id }, "bo");
  throws(
    () => erp.deleteCapture(billed.id, "bo"),
    "a document already registered as a bill is refused, and says to void the bill first",
  );
}

/* ── PK11 · a bill filed against the wrong company, and no way back ────────
   The supplier picker had no empty option, so a document whose tax id matched
   nobody was filed against whichever supplier happened to be FIRST in the
   list. It happened: an invoice from SUMINISTROS CERDA landed on Leroy Merlin
   and every screen downstream then correctly reported the wrong company.

   The picker is fixed in the screen. This block is about the other half —
   what the operator can do about the ones already filed — because a mistake
   with no way back is worse than the mistake. Three doors were shut at once:
   `correctBill` allows the numbers on the page and not the issuer, nothing
   deleted a bill, and `deleteCapture` refused precisely BECAUSE a bill
   pointed at the document. */
{
  const e = new ERP("2026-09-20");
  const wrong = e.addParty(
    { roles: ["supplier"], name: "Leroy Merlin 11", taxId: "B12345674" },
    "bo",
  );
  const right = e.addParty(
    {
      roles: ["subcontractor"],
      name: "SUMINISTROS CERDA 11, S.L.",
      taxId: "B62889415",
      irpfApplies: true,
      irpfRateBp: 1500,
    },
    "bo",
  );
  const c = e.captureDocument({ docType: "supplierInvoice", imageRef: "img-11" }, "bo");
  e.confirmCapture(
    c.id,
    {
      issuerName: "SUMINISTROS CERDA 11, S.L.",
      issuerTaxId: "B62889415",
      docNumber: "F-2026/4471",
      date: "2026-09-18",
      baseCents: 248380,
      vatCents: 52160,
      totalCents: 300540,
    },
    "bo",
  );
  const bill = e.billFromCapture(c.id, { supplierId: wrong.id }, "bo");
  assert(
    bill.supplierName === "Leroy Merlin 11",
    "the wrong choice is filed faithfully — the record says what it was told",
    bill.supplierName,
  );

  // A bill with no supplier at all is not a bill, and the rule is stated where
  // the record is made rather than only in the screen above it.
  throws(
    () => e.registerBill({ number: "X-1", baseCents: 1000 }, "bo"),
    "a bill with no supplier is refused by the engine, not only by the form",
  );

  /* `reassignBill` was here, and is deliberately gone. It repaired a bill's
     issuer in place, and the operator's answer to that screen was that only
     one action belongs on it: «The only option here is to Un-register.» A bill
     filed against the wrong company is not corrected, it is taken out of the
     ledger and re-filed from the document, which is one meaning instead of
     two. The assertions that covered it went with the method rather than
     being nudged to keep passing. */

  // ── the removal ──
  assert(e.billDeleteBlock(bill.id) === null, "nothing yet points at the bill, so it may go");
  const del = e.deleteBill(bill.id, "bo");
  assert(
    !e.state.bills.some((x) => x.id === bill.id) && del.releasedCapture === c.id,
    "a bill nobody has touched can be removed, and it names the document it released",
    JSON.stringify(del),
  );
  assert(
    e.state.captured.find((x) => x.id === c.id).billId === null,
    "…and the captured document goes back to being registrable, not orphaned",
  );
  // The door `deleteCapture` was holding shut is now openable from the inside.
  e.deleteCapture(c.id, "bo");
  assert(
    !e.state.captured.some((x) => x.id === c.id),
    "…so the document that only ever existed by mistake can finally be deleted too",
  );

  // ── and what may NOT go ──
  const paid = e.registerBill(
    { supplierId: wrong.id, number: "PAID-11", baseCents: 10000, vatBp: 2100 },
    "bo",
  );
  e.payBills(
    {
      amountCents: e.billOutstandingCents(paid.id),
      method: "transfer",
      billAllocations: [{ billId: paid.id, amountCents: e.billOutstandingCents(paid.id) }],
    },
    "bo",
  );
  /* PAID IS NOT THE QUESTION — WHETHER MONEY MOVED IS. This payment names no
     movement, so it never touched a bank: it is the entry the «Pagar» button
     on the payables register used to write, and the operator pressed it. That
     left an invoice marked «Pagada» against money that never moved, which
     `billDeleteBlock` then refused to release while `voidPayment` was
     reachable from no screen at all. A dead end built out of two reasonable
     rules. Un-registering voids it. */
  assert(
    e.billDeleteBlock(paid.id) === null,
    "a payment that never touched a bank does not block: it was a button press, not money",
    String(e.billDeleteBlock(paid.id)),
  );
  const payId = e.state.payments.find((x) =>
    (x.billAllocations || []).some((a) => a.billId === paid.id),
  ).id;
  e.deleteBill(paid.id, "bo");
  assert(
    !e.state.payments.some((x) => x.id === payId),
    "…and un-registering takes that phantom payment with it",
  );

  // Money that DID move is a different record, and stays refused.
  const real = e.registerBill(
    { supplierId: wrong.id, number: "REAL-11", baseCents: 10000, vatBp: 2100 },
    "bo",
  );
  const acc = e.addBankAccount({ name: "Banco 11", kind: "bank" }, "bo");
  e.importMovements(
    acc.id,
    [{ accountingDate: "2026-09-19", concept: "PAGO REAL", amountCents: -12100 }],
    "bo",
  );
  e.matchMovement(e.state.movements[0].id, { billId: real.id }, "bo");
  assert(
    e.billDeleteBlock(real.id) === "reconciled",
    "a bill settled by a real bank line says so, and says where to undo it",
    String(e.billDeleteBlock(real.id)),
  );
  throws(() => e.deleteBill(real.id, "bo"), "…and un-registering it is refused");

  // One payment can settle several invoices; releasing one must not un-pay
  // the rest behind the operator's back.
  const shA = e.registerBill(
    { supplierId: wrong.id, number: "SH-A", baseCents: 5000, vatBp: 0 },
    "bo",
  );
  const shB = e.registerBill(
    { supplierId: wrong.id, number: "SH-B", baseCents: 5000, vatBp: 0 },
    "bo",
  );
  e.payBills(
    {
      amountCents: 10000,
      method: "transfer",
      billAllocations: [
        { billId: shA.id, amountCents: 5000 },
        { billId: shB.id, amountCents: 5000 },
      ],
    },
    "bo",
  );
  assert(
    e.billDeleteBlock(shA.id) === "shared-payment",
    "a payment covering other invoices too is named, not silently voided",
    String(e.billDeleteBlock(shA.id)),
  );
  throws(() => e.deleteBill(shA.id, "bo"), "…and un-registering it is refused");
  assert(
    e.billOutstandingCents(shB.id) === 0,
    "…so the invoice beside it stays paid",
    e.billOutstandingCents(shB.id),
  );

  const credited = e.registerBill(
    { supplierId: wrong.id, number: "CRED-11", baseCents: 5000, vatBp: 2100 },
    "bo",
  );
  e.registerBill(
    {
      supplierId: wrong.id,
      number: "AB-11",
      baseCents: 5000,
      vatBp: 2100,
      creditNoteFor: credited.id,
    },
    "bo",
  );
  assert(
    e.billDeleteBlock(credited.id) === "credited",
    "a bill with a credit note against it says so",
    e.billDeleteBlock(credited.id),
  );
}

/* ── PK11 · a cost row quotes the invoice, never the party file ───────────
   `billSupplier` exists so that a filing stands on its own, and its own
   comment says every reader goes through it. `projectCostRows` was the
   exception: renaming a supplier would have quietly rewritten who issued a
   cost booked years earlier, and deactivating one would have thrown inside a
   report. */
{
  const e = new ERP("2026-09-20");
  const sup = e.addParty({ roles: ["supplier"], name: "Nombre Antiguo", taxId: "B12345674" }, "bo");
  const cust = e.addParty({ roles: ["customer"], name: "Cliente 11", taxId: "B62889415" }, "bo");
  const bud = e.createBudget({ partyId: cust.id, activityLine: "renovation" }, "bo");
  const ch = e.addChapter(bud.id, { name: "Capitulo 11" }, "bo");
  e.addLine(
    bud.id,
    ch.id,
    { desc: "Linea", unit: "ud", qtyMilli: 1000, priceCents: 100000, costCents: 60000 },
    "bo",
  );
  e.issueVersion(bud.id, { channel: "hand" }, "bo");
  e.acceptVersion(bud.id, e.currentVersion(bud.id).id, { evidenceRef: "ok" }, "bo");
  const proj = e.createProjectFromAcceptance(bud.id, "bo");
  e.registerBill(
    {
      supplierId: sup.id,
      number: "COST-11",
      baseCents: 10000,
      vatBp: 2100,
      allocations: [{ projectId: proj.id, chapterNum: "1", kind: "material", amountCents: 10000 }],
    },
    "bo",
  );
  e.updateParty(sup.id, { name: "Nombre Nuevo" }, "bo");
  const row = e.projectCostRows(proj.id).find((r) => r.ref === "COST-11");
  assert(
    row && row.party === "Nombre Antiguo" && row.desc === "Nombre Antiguo",
    "a cost row names the issuer the invoice named, not whatever the party is called today",
    JSON.stringify(row && { party: row.party, desc: row.desc }),
  );
}

/* ── PK11 · emptying an account to run a test ─────────────────────────────
   `discardMovements` keeps everything anyone has touched, which is right for
   a statement loaded onto the wrong account and wrong for starting a trial
   over: the movements somebody most wants gone afterwards are the ones they
   spent the trial reconciling, and undoing those one at a time is not a
   thing anyone does four hundred times. */
{
  const e = new ERP("2026-09-20");
  const sup = e.addParty({ roles: ["supplier"], name: "Prov 11R", taxId: "B12345674" }, "bo");
  const bank = e.addBankAccount({ name: "Banco 11R", kind: "bank" }, "bo");
  const card = e.addBankAccount({ name: "Visa 11R", kind: "card" }, "bo");
  e.importMovements(
    bank.id,
    [
      { accountingDate: "2026-09-01", concept: "PAGO PROVEEDOR", amountCents: -12100 },
      { accountingDate: "2026-09-02", concept: "SIN IDENTIFICAR", amountCents: -3000 },
    ],
    "bo",
  );
  e.importMovements(
    card.id,
    [{ accountingDate: "2026-09-03", concept: "FERRETERIA", amountCents: -5000 }],
    "bo",
  );
  const movs = e.state.movements.filter((m) => m.accountId === bank.id);
  const bill = e.registerBill(
    { supplierId: sup.id, number: "R-11", baseCents: 10000, vatBp: 2100 },
    "bo",
  );
  e.matchMovement(movs[0].id, { billId: bill.id }, "bo");

  const pv = e.discardPreview(bank.id);
  assert(
    pv.deletable === 1 && pv.byReason.matched === 1,
    "the import undo keeps the reconciled one — which is right, and not what a test reset needs",
    JSON.stringify(pv),
  );
  const rv = e.resetAccountPreview(bank.id);
  assert(
    rv.total === 2 && rv.reconciled === 1,
    "the reset preview counts what would have to be UNDONE, not what may be skipped",
    JSON.stringify(rv),
  );

  const r = e.resetAccountMovements(bank.id, "bo");
  assert(
    r.deleted === 2 && r.unwound === 1,
    "emptying the account removes every movement on it, reconciled ones included",
    JSON.stringify(r),
  );
  assert(
    !e.state.movements.some((m) => m.accountId === bank.id),
    "…and nothing of that account is left behind",
  );
  assert(
    e.billOutstandingCents(bill.id) === bill.totalCents,
    "…and the payment the reconciliation created is voided, so the bill owes again",
    e.billOutstandingCents(bill.id),
  );
  assert(
    e.state.movements.filter((m) => m.accountId === card.id).length === 1,
    "…and the card next to it is untouched: one account at a time, on purpose",
  );
  assert(
    !(e.state.importBatches || []).some((b) => b.accountId === bank.id),
    "…and its imports go with it, rather than leaving a menu of dead undo buttons",
  );

  // The one refusal, and it is not about lost work: a closed period is a line
  // somebody drew, and a test reset is not a reason to cross it.
  const e2 = new ERP("2026-09-20");
  const acc2 = e2.addBankAccount({ name: "Banco 11C", kind: "bank" }, "bo");
  e2.importMovements(
    acc2.id,
    [{ accountingDate: "2026-09-01", concept: "CERRADO", amountCents: -1000 }],
    "bo",
  );
  const m2 = e2.state.movements[0];
  e2.markMovementUnbacked(m2.id, "comision", "bo");
  e2.closeBankPeriod("2026-09-01", "2026-09-30", "bo");
  throws(
    () => e2.resetAccountMovements(acc2.id, "bo"),
    "a closed period refuses the reset, and says to reopen it first",
  );
  e2.reopenBankPeriod("2026-09-01", "prueba", "bo");
  assert(
    e2.resetAccountMovements(acc2.id, "bo").deleted === 1,
    "…and once the period is reopened, in the open, the reset goes through",
  );
}

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} manageability checks passed`);
process.exit(failed.length ? 1 : 0);

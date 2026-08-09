// =============================================================================
// Manageability test: every field a company must be able to change has a
// working update path, and everything immutable-by-design stays locked.
// Run: node tests/simulation/manageability-sim.mjs
// =============================================================================
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { ERP } = require("../../site/erp-engine.js");

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
  { code: "IT1", desc: "Tabique", unit: "m2", defaultCostCents: 1000, defaultPriceCents: 2000 },
  "bo",
);
erp.updateCatalogueItem(item.id, { desc: "Tabique cartón-yeso", defaultPriceCents: 2100 }, "bo");
assert(erp.state.catalogue[0].defaultPriceCents === 2100, "updateCatalogueItem price");
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
erp.markContractSent(con.id, "bo");
assert(erp.state.contracts[0].status === "sent", "markContractSent");
const con2status = erp.state.contracts[0];
erp.signContract(con.id, { method: "paper" }, "bo");
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
erp.approveChange(chg.id, "firma.png", "bo");
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
  throws(() => erp.allocateCapture(cap.id, [], "bo"), "a document must be allocated to something");
  throws(
    () =>
      erp.allocateCapture(
        cap.id,
        [{ projectId: prj.id, overheadCategory: "office", amountCents: 12100 }],
        "bo",
      ),
    "a line naming both a project and an overhead category is refused",
  );
  throws(
    () => erp.allocateCapture(cap.id, [{ amountCents: 12100 }], "bo"),
    "a line naming neither is refused too",
  );
  throws(
    () => erp.allocateCapture(cap.id, [{ overheadCategory: "biscuits", amountCents: 12100 }], "bo"),
    "an overhead category the engine does not know is refused",
  );
  throws(
    () =>
      erp.allocateCapture(cap.id, [{ projectId: prj.id, kind: "vibes", amountCents: 12100 }], "bo"),
    "a cost kind the engine does not know is refused",
  );
  throws(
    () => erp.allocateCapture(cap.id, [{ projectId: "prj-gone", amountCents: 12100 }], "bo"),
    "a project that is not there is refused, by the accessor that names it",
  );
  throws(
    () => erp.allocateCapture(cap.id, [{ projectId: prj.id, amountCents: 9000 }], "bo"),
    "a split that does not total the confirmed document is refused",
  );
  const split = erp.allocateCapture(
    cap.id,
    [
      { projectId: prj.id, chapterNum: "1", kind: "material", amountCents: 8000 },
      { overheadCategory: "office", amountCents: 4100 },
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
  erp.approveChange(extra.id, "firma.png", "bo");

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

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} manageability checks passed`);
process.exit(failed.length ? 1 : 0);

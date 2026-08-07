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
  taxId: "B66666666",
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

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} manageability checks passed`);
process.exit(failed.length ? 1 : 0);

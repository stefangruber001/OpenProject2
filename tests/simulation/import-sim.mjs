// =============================================================================
// Exercises the one-way legacy import in site/erp-store.js against the real
// engine. This is the code path that can damage a live dataset, so it is
// tested for what it must REFUSE to do at least as hard as for what it does:
//
//   * never merges automatically over an existing party
//   * never invents data for a row it cannot map
//   * never lets an engine validation failure (MDM-03) abort the whole import
//   * runs at most once, and is a no-op on every later boot
//   * never mutates or deletes the legacy source
//
// Drives applyLegacyCustomers, the synchronous core, so no IndexedDB is needed;
// importLegacyMasterData is a three-line wrapper that only supplies the data.
// Run: node tests/simulation/import-sim.mjs
// =============================================================================
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ERP } = require("../../site/erp-engine.js");
const Store = require("../../site/erp-store.js");

const checks = [];
const assert = (cond, name, detail) =>
  checks.push({ name, pass: !!cond, detail: cond ? "" : String(detail || "") });

function freshErp() {
  const erp = new ERP("2026-05-05");
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
  erp.state.schemaVersion = 2;
  erp.state.importConflicts = [];
  erp.state.imports = {};
  return erp;
}

// Mirrors the shape master-data.html actually stores under caneiMasterData/kv/"data".
const legacy = {
  customers: [
    // clean, importable
    {
      code: "C-001",
      legalName: "Familia Roca Puig",
      type: "B2C",
      // 46000000T: the check letter is real — the engine validates NIF
      // checksums (MDM-03), so a made-up id would be rejected as a conflict.
      nif: "46000000T",
      contact: "Marta Roca",
      email: "marta@example.com",
      phone: "600 111 222",
      billAddress: "Av. Barcelona 10",
      billCity: "Sant Just",
      billPc: "08960",
      source: "Referral",
      status: "Active",
    },
    // Invalid tax id — the engine must reject it (MDM-03) as a conflict, not a
    // crash. 46000000A is a real NIF pattern with the WRONG check letter (T is
    // correct), which is what makes it fail. A string like "NOT-A-VALID-ID"
    // would NOT work here: it survives the validator's structural EU-VAT
    // branch and would import cleanly.
    {
      code: "C-900",
      legalName: "NIF Roto S.L.",
      type: "B2B",
      nif: "46000000A",
      status: "Active",
    },
    // no name at all — unmappable
    { code: "C-901", legalName: "", type: "B2C", status: "Active" },
    // inactive in the legacy store — still imported, but deactivated
    {
      code: "C-002",
      legalName: "Cliente Inactivo S.L.",
      type: "B2B",
      nif: "B66000001",
      status: "Inactive",
    },
  ],
};

/* ---- 1. a normal first import ------------------------------------------- */
const erp = freshErp();
const before = JSON.parse(JSON.stringify(legacy));
const r1 = Store.applyLegacyCustomers(erp, legacy);

assert(r1.ran === true, "first import runs");
assert(r1.rows === 4, "saw every legacy row", r1.rows);
assert(r1.imported === 2, "imported the two mappable rows", r1.imported);
assert(r1.conflicts === 2, "flagged the two unmappable rows", r1.conflicts);
assert(JSON.stringify(legacy) === JSON.stringify(before), "the legacy source is never mutated");

const roca = erp.state.parties.find((p) => p.name === "Familia Roca Puig");
assert(!!roca, "the clean row became a party");
assert(roca && roca.taxId === "46000000T", "tax id carried across");
assert(roca && roca.roles.indexOf("customer") >= 0, "imported as a customer");
assert(roca && roca.billPostalCode === "08960", "address fields mapped");
assert(roca && roca.partyType === "individual", "B2C maps to individual");

const inactivo = erp.state.parties.find((p) => p.name === "Cliente Inactivo S.L.");
assert(!!inactivo && inactivo.active === false, "legacy Inactive status is honoured");
assert(!!inactivo && inactivo.partyType === "company", "B2B maps to company");

const reasons = erp.state.importConflicts.map((c) => c.reason).sort();
assert(
  JSON.stringify(reasons) === JSON.stringify(["rechazado", "sinNombre"]),
  "conflicts carry a machine-readable reason",
  reasons.join(","),
);
assert(
  erp.state.importConflicts.every((c) => c.source === "caneiMasterData"),
  "every conflict names its source",
);
assert(
  erp.state.importConflicts.some(
    (c) => c.reason === "rechazado" && /tax identifier/i.test(c.detail || ""),
  ),
  "the engine's own rejection reason is preserved for the operator",
);

/* ---- 2. it runs at most once -------------------------------------------- */
const r2 = Store.applyLegacyCustomers(erp, legacy);
assert(r2.ran === false, "a second import is a no-op");
assert(erp.state.parties.length === 2, "no duplicate parties on re-run", erp.state.parties.length);
assert(erp.state.importConflicts.length === 2, "conflicts are not re-appended");
assert(
  !!erp.state.imports["caneiMasterData"] && erp.state.imports["caneiMasterData"].imported === 2,
  "the import is recorded in state.imports",
);

/* ---- 3. never merges over an existing party ------------------------------ */
{
  const e2 = freshErp();
  e2.addParty({ name: "Familia Roca Puig", taxId: "46000000T", roles: ["customer"] }, "test");
  const r = Store.applyLegacyCustomers(e2, legacy);
  assert(r.imported === 1, "the already-present party is not imported again", r.imported);
  const dup = e2.state.importConflicts.find((c) => c.reason === "yaExiste");
  assert(!!dup, "an existing party becomes a yaExiste conflict for review");
  assert(!!dup && !!dup.existingCode, "the conflict points at the record it collided with");
  assert(
    e2.state.parties.filter((p) => p.name === "Familia Roca Puig").length === 1,
    "no duplicate was created",
  );
}

/* ---- 4. an empty or absent legacy store is harmless ---------------------- */
{
  const e3 = freshErp();
  const r = Store.applyLegacyCustomers(e3, null);
  assert(
    r.ran === true && r.imported === 0 && r.conflicts === 0,
    "absent legacy store imports nothing",
  );
  assert(e3.state.parties.length === 0, "and creates no parties");
}

/* ---------------- report ---------------- */
const failed = checks.filter((c) => !c.pass);
console.log(`\n──── legacy import simulation ────`);
console.log(
  `rows: ${r1.rows} · imported: ${r1.imported} · conflicts: ${r1.conflicts} (${reasons.join(", ")})`,
);
for (const c of failed) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} import checks passed`);
process.exit(failed.length ? 1 : 0);

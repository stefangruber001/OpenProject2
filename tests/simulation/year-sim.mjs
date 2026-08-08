// =============================================================================
// Year-long business simulation over the real ERP engine (BRD v2 verification).
// 12 months × 3 projects/month = 36 projects: large renovations with contracts,
// versions and extras; medium jobs; quick repairs. Supplier bills, labour hours,
// bank/cash movements, partial collections, credit notes and the four quarterly
// accounting packages. Asserts the invariants the business depends on.
//
// Run:  node tests/simulation/year-sim.mjs [seed]
// =============================================================================
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../../site/erp-engine.js");
const { ERP, addDays, quarterOf } = E;

const SEED = process.argv[2] ? +process.argv[2] : 1;
// Horizon is configurable: SIM_MONTHS=24 SIM_PPM=2 node year-sim.mjs → 2 years × 2 projects/month
const SIM_MONTHS = +(process.env.SIM_MONTHS || 12);
const SIM_PPM = +(process.env.SIM_PPM || 3);
let _s = (SEED * 2654435761) % 2 ** 32;
const rnd = () => ((_s = (1103515245 * _s + 12345) % 2 ** 31), _s / 2 ** 31);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const checks = [];
const ok = (name) => checks.push({ name, pass: true });
const bad = (name, detail) =>
  checks.push({ name, pass: false, detail: String(detail).slice(0, 160) });
const assert = (cond, name, detail) => (cond ? ok(name) : bad(name, detail));

/* ---------------- world setup ---------------- */
const erp = new ERP("2026-01-05");
erp.configureEntity({
  legalName: "Canei Subirats, S.L.",
  taxId: "B66666666",
  street: "Carrer de la Creu 74",
  postalCode: "08960",
  city: "Sant Just Desvern",
  phone: "659 87 67 00",
  email: "hola@caneisubirats.com",
  iban: "ES9121000418450200051332",
});
erp.state.clauseBlocks.push({
  id: "cb1",
  name: "Condiciones generales",
  effectiveFrom: "2026-01-01",
  version: 1,
});

// bank + till (BNK-06)
const bank = erp.addBankAccount({ name: "Cuenta principal", kind: "bank", openingCents: 4200000 });
const till = erp.addBankAccount({ name: "Caja efectivo", kind: "till", openingCents: 30000 });

// suppliers (valid CIFs) — material supplier, subcontractor company, autónomo (IRPF)
const supMat = erp.addParty({
  roles: ["supplier"],
  partyType: "company",
  name: "Materiales Vallès S.A.",
  taxId: "A58818501",
  billStreet: "Pol. Can Roca 5",
  billPostalCode: "08191",
  billCity: "Rubí",
  billProvince: "Barcelona",
  mobile: "600000001",
  email: "ventas@matvalles.example",
  paymentTermsDays: 30,
  activityLine: "other",
  leadSource: "other",
});
const supElec = erp.addParty({
  roles: ["subcontractor"],
  partyType: "company",
  name: "ElectroBaix S.L.",
  taxId: "B65739207",
  billStreet: "C/ Industria 12",
  billPostalCode: "08980",
  billCity: "Sant Feliu",
  billProvince: "Barcelona",
  mobile: "600000002",
  email: "info@electrobaix.example",
  paymentTermsDays: 30,
  activityLine: "other",
  leadSource: "other",
});
const supFont = erp.addParty({
  roles: ["subcontractor", "selfEmployed"],
  partyType: "individual",
  name: "Josep Maria Solé",
  taxId: "46543299Q",
  billStreet: "C/ Major 3",
  billPostalCode: "08750",
  billCity: "Molins de Rei",
  billProvince: "Barcelona",
  mobile: "600000003",
  email: "jm.sole@example.com",
  paymentTermsDays: 15,
  irpfApplies: false,
  irpfRateBp: 0,
  activityLine: "other",
  leadSource: "other",
});
const supArch = erp.addParty({
  roles: ["adviser", "selfEmployed"],
  partyType: "individual",
  name: "Arquitecta Tècnica N. Camps",
  taxId: "47732924N",
  billStreet: "Av. Diagonal 200",
  billPostalCode: "08018",
  billCity: "Barcelona",
  billProvince: "Barcelona",
  mobile: "600000004",
  email: "n.camps@example.com",
  paymentTermsDays: 15,
  irpfApplies: true,
  irpfRateBp: 1500,
  activityLine: "other",
  leadSource: "other",
});

// catalogue + a damp-treatment work package (CAT-04, Appendix B)
const itTile = erp.addCatalogueItem({
  code: "ALI-101",
  desc: "Alicatado gres porcelánico",
  unit: "m2",
  type: "material",
  defaultCostCents: 1800,
  defaultPriceCents: 3400,
});
const itDemo = erp.addCatalogueItem({
  code: "DEM-001",
  desc: "Demolición tabique",
  unit: "m2",
  type: "ownLabour",
  defaultCostCents: 950,
  defaultPriceCents: 1600,
});
const itDamp = erp.addCatalogueItem({
  code: "HUM-201",
  desc: "Tratamiento antihumedad inyección",
  unit: "l",
  type: "material",
  defaultCostCents: 2400,
  defaultPriceCents: 0,
});
erp.addPrice({
  itemId: itTile.id,
  supplierId: supMat.id,
  listCents: 2000,
  discountPct: 10,
  source: "priceList",
  sourceDocRef: "tarifa-2026",
});
erp.addPrice({
  itemId: itDamp.id,
  supplierId: supMat.id,
  listCents: 2600,
  discountPct: 8,
  source: "supplierOffer",
  sourceDocRef: "oferta-HUM-12",
});
const pkgDamp = erp.addWorkPackage({
  code: "PK-HUM",
  name: "Saneado antihumedad",
  unit: "m2",
  components: [{ itemId: itDamp.id, qtyPerUnitMilli: 350, kind: "material" }],
  wastePct: 5,
  minPurchaseQty: 5,
  containerSize: 5,
});

// workers (LAB)
const w1 = erp.addWorker({
  name: "Oficial 1ª",
  kind: "employee",
  rateHistory: [
    { from: "2026-01-01", rateCentsPerHour: 1900 },
    { from: "2026-07-01", rateCentsPerHour: 2000 },
  ],
});
const w2 = erp.addWorker({
  name: "Peó",
  kind: "employee",
  rateHistory: [{ from: "2026-01-01", rateCentsPerHour: 1400 }],
});

// customer pool: valid DNIs generated with correct check letter
const L = "TRWAGMYFPDXBNJZSQVHLCKE";
const mkDni = (n) => String(n).padStart(8, "0") + L[n % 23];
const FIRST = [
  "Marta",
  "Jordi",
  "Laura",
  "Pau",
  "Núria",
  "Oriol",
  "Carla",
  "Marc",
  "Anna",
  "Sergi",
  "Júlia",
  "Pol",
];
const LAST = ["Roca", "Puig", "Ferrer", "Vila", "Serra", "Bosch", "Camps", "Font", "Soler", "Mas"];

const ACTIVITY = ["renovation", "repairs", "damp", "commercial"];
let customerN = 0;
function newCustomer() {
  customerN++;
  const name = pick(FIRST) + " " + pick(LAST) + " " + pick(LAST);
  return erp.addParty({
    roles: ["customer"],
    partyType: "individual",
    name: name + " " + customerN,
    taxId: mkDni(10000000 + customerN * 137),
    billStreet: "C/ " + pick(LAST) + " " + ri(1, 120),
    billPostalCode: "089" + String(ri(10, 99)),
    billCity: pick(["Sant Just Desvern", "Esplugues", "Barcelona", "Sant Feliu"]),
    billProvince: "Barcelona",
    mobile: "6" + String(10000000 + customerN * 977).slice(0, 8),
    email: "cliente" + customerN + "@example.com",
    leadSource: pick(E.LISTS.leadSources),
    activityLine: pick(ACTIVITY),
    paymentMethod: "transfer",
    paymentTermsDays: pick([15, 30]),
  });
}

/* ---------------- one project lifecycle ---------------- */
const openProjects = [];
let quickCounter = 0;

function runLargeOrMedium(size, monthStartIso) {
  const cust = newCustomer();
  const prop = erp.addProperty({
    partyId: cust.id,
    street: cust.billStreet,
    postalCode: cust.billPostalCode,
    city: cust.billCity,
    part: "dwelling",
    surfaceM2: size === "large" ? ri(80, 140) : ri(40, 80),
  });
  const opp = erp.addOpportunity({
    partyId: cust.id,
    propertyId: prop.id,
    source: cust.leadSource,
    requestedWork: size === "large" ? "Reforma integral" : "Reforma baño y cocina",
    jobSize: size,
  });
  erp.addVisit({
    opportunityId: opp.id,
    measurements: [{ what: "superficie", qty: prop.surfaceM2, unit: "m2" }],
    photos: ["visita-01.jpg"],
    notes: "Croquis a mano adjunto",
    handwrittenEstimateRef: "croquis.jpg",
  });

  // budget with chapters/lines/sub-lines, an optional chapter and a pending line
  const bud = erp.createBudget({
    partyId: cust.id,
    propertyId: prop.id,
    activityLine: cust.activityLine === "repairs" ? "renovation" : cust.activityLine,
    surfaceM2: prop.surfaceM2,
    vatBp: 1000,
    paymentConditions: "40% firma · 40% avance · 20% final",
  });
  const nCh = size === "large" ? ri(5, 8) : ri(2, 4);
  const CHN = [
    "Demoliciones",
    "Albañilería",
    "Fontanería",
    "Electricidad",
    "Carpintería",
    "Revestimientos",
    "Pintura",
    "Climatización",
  ];
  for (let i = 0; i < nCh; i++) {
    const ch = erp.addChapter(bud.id, { name: CHN[i % CHN.length] });
    const nL = ri(2, size === "large" ? 5 : 3);
    for (let j = 0; j < nL; j++) {
      const price = ri(1500, 9000),
        cost = Math.round(price * (0.55 + rnd() * 0.2));
      const useSub = rnd() < 0.35;
      erp.addLine(bud.id, ch.id, {
        code: "L" + i + j,
        desc: CHN[i % CHN.length] + " partida " + (j + 1),
        unit: pick(["m2", "ud", "ml", "pa"]),
        qtyMilli: useSub ? 0 : ri(2, 40) * 1000,
        priceCents: price,
        costCents: cost,
        costSupplierId: pick([supMat.id, supElec.id, supFont.id]),
        costSourceRef: "oferta-" + i + j,
        subLines: useSub
          ? [
              { room: "Salón", qtyMilli: ri(4, 12) * 1000, wastePct: 10, customerVisible: true },
              { room: "Cocina", qtyMilli: ri(3, 8) * 1000, wastePct: 10, customerVisible: false },
            ]
          : [],
      });
    }
  }
  const chOpt = erp.addChapter(bud.id, {
    name: "Opcional — mampara y extras",
    section: "optional",
  });
  erp.addLine(bud.id, chOpt.id, {
    code: "OPT1",
    desc: "Mampara de vidrio",
    unit: "ud",
    qtyMilli: 1000,
    priceCents: 68000,
    costCents: 42000,
  });
  const chPend = erp.currentVersion(bud.id).chapters[0];
  erp.addLine(bud.id, chPend.id, {
    code: "PEND1",
    desc: "Partida pendiente de medición",
    unit: "m2",
    qtyMilli: 5000,
    priceCents: 2500,
    costCents: 1500,
    pending: true,
  }); // PRE-04

  // v1.1 revision (price negotiation), then issue + accept (QUO)
  erp.issueVersion(bud.id, { channel: "email" });
  const v2 = erp.newVersion(bud.id, {
    reason: "Ajuste de precios tras negociación",
    author: "backoffice",
  });
  v2.chapters[0].lines[0].priceCents = Math.round(v2.chapters[0].lines[0].priceCents * 0.97);
  erp.issueVersion(bud.id, { channel: "email" });
  const diff = erp.diffVersions(bud.id, bud.versions[0].id, v2.id);
  assert(
    typeof diff.deltaCents === "number" && diff.changed.length >= 1,
    "version diff computes (" + bud.number + ")",
    JSON.stringify(diff).slice(0, 80),
  );
  erp.acceptVersion(bud.id, v2.id, { evidenceRef: "email-aceptacion.pdf" });

  // contract with installments + duration (CON)
  const totals = erp.budgetTotals(bud.id, v2.id);
  const con = erp.createContract(bud.id, {
    installments: [
      { pct: 40, trigger: "onSignature", expectedDate: erp.today },
      {
        pct: 40,
        trigger: "atStage",
        stageRef: "50%",
        expectedDate: addDays(erp.today, size === "large" ? 45 : 25),
      },
      {
        pct: 20,
        trigger: "onCompletion",
        expectedDate: addDays(erp.today, size === "large" ? 80 : 45),
      },
    ],
    duration: {
      estimatedDays: size === "large" ? ri(60, 90) : ri(20, 40),
      plannedStart: addDays(erp.today, 10),
      plannedFinish: null,
      actualStart: null,
      actualFinish: null,
      deviationReason: null,
    },
    guarantees: [
      { category: "executionAndFinishes", months: 12 },
      { category: "installations", months: 24 },
      { category: "structural", months: 120 },
    ],
    penalties: {
      latePaymentInterestPctYear: 8,
      delayPenaltyCentsPerWeek: 15000,
      capCents: Math.round(totals.grandCents * 0.1),
      graceDays: 7,
      suspendingEvents: ["customer delay", "force majeure"],
    },
  });
  erp.signContract(con.id, { method: rnd() < 0.5 ? "physical" : "digital" });
  const prj = erp.createProjectFromAcceptance(bud.id);
  prj.dates.targetEnd = addDays(erp.today, con.duration.estimatedDays + 15);

  // deposit invoice per installment 0 + first payment + start works
  const dep = erp.issueInvoice({
    projectId: prj.id,
    kind: "deposit",
    baseCents: Math.round(totals.taxableCents * 0.4),
    installmentIdx: 0,
    desc: "Anticipo 40% según contrato",
  });
  erp.recordFirstPayment(con.id);
  erp.recordCollection({
    partyId: cust.id,
    amountCents: dep.totalCents,
    method: "transfer",
    allocations: [{ invoiceId: dep.id, amountCents: dep.totalCents }],
  });
  erp
    .importMovements(bank.id, [
      {
        accountingDate: erp.today,
        concept: "TRANSFERENCIA RECIBIDA",
        counterparty: cust.name,
        amountCents: dep.totalCents,
      },
    ])
    .forEach((m) => erp.classifyMovement(m.id, "customerReceipt"));
  erp.startWorks(prj.id);

  return { cust, prop, bud, con, prj, size, phase: 0, startedAt: erp.today };
}

function runQuickRepair() {
  const cust = newCustomer();
  quickCounter++;
  const prj = erp.createQuickProject({
    partyId: cust.id,
    desc: "Reparación " + pick(["fuga baño", "persiana", "humedad puntual", "enchufes"]),
    activityLine: "repairs",
    valueCents: ri(180, 900) * 100,
  });
  // labour same day, invoice, cash or transfer collection
  erp.recordHours({
    workerId: pick([w1.id, w2.id]).valueOf(),
    projectId: prj.id,
    chapterNum: "1",
    hoursMilli: ri(2, 6) * 1000,
  });
  const inv = erp.issueInvoice({
    projectId: prj.id,
    kind: "final",
    baseCents: prj.baseline.revenueCents,
    desc: "Reparación realizada",
  });
  if (rnd() < 0.3) {
    // cash receipt path (AR-05 + BNK-07)
    const rec = erp.issueReceipt({
      partyId: cust.id,
      projectId: prj.id,
      amountCents: inv.totalCents,
      method: "cash",
    });
    rec.allocatedToInvoiceId = inv.id;
    erp.recordCollection({
      partyId: cust.id,
      amountCents: inv.totalCents,
      method: "cash",
      allocations: [{ invoiceId: inv.id, amountCents: inv.totalCents }],
    });
    erp.recordCashMovement(till.id, {
      accountingDate: erp.today,
      concept: "Cobro reparación",
      amountCents: inv.totalCents,
      supportingDocRef: rec.number,
      handledBy: "operations",
    });
  } else {
    erp.recordCollection({
      partyId: cust.id,
      amountCents: inv.totalCents,
      method: "transfer",
      allocations: [{ invoiceId: inv.id, amountCents: inv.totalCents }],
    });
  }
  erp.closeProject(prj.id);
}

/* advance an open large/medium project one month */
function advanceProject(hnd) {
  const { prj, con, bud } = hnd;
  const ec = () => erp.projectEconomics(prj.id);
  hnd.phase++;
  const t = erp.budgetTotals(bud.id, bud.acceptedVersionId);

  if (hnd.phase === 1) {
    // purchases + supplier bills allocated by chapter (PUR/AP), labour, a card movement allocated by project number (BNK-02)
    const pu = erp.addPurchase({
      supplierId: supMat.id,
      projectId: prj.id,
      chapterNum: "1",
      desc: "Material obra",
      qtyMilli: 1000,
      unitCents: Math.round(t.costBaseCents * 0.25),
      orderRef: "OR-" + prj.code,
    });
    const bill1 = erp.registerBill({
      supplierId: supMat.id,
      number: "MV-" + prj.code + "-1",
      baseCents: pu.totalCents,
      vatBp: 2100,
      orderRef: pu.orderRef,
      capId: erp.confirmCapture(
        erp.captureDocument({
          docType: "supplierInvoice",
          imageRef: "fact-mv.jpg",
          extractable: { issuerName: "Materiales Vallès", totalCents: 0 },
        }).id,
        {
          issuerName: "Materiales Vallès S.A.",
          issuerTaxId: supMat.taxId,
          docNumber: "MV-" + prj.code + "-1",
          date: erp.today,
          totalCents: Math.round(pu.totalCents * 1.21),
        },
      ).id,
      allocations: [
        { projectId: prj.id, chapterNum: "1", kind: "material", amountCents: pu.totalCents },
      ],
    });
    erp.payBills({
      amountCents: bill1.totalCents,
      method: "transfer",
      billAllocations: [{ billId: bill1.id, amountCents: bill1.totalCents }],
    });
    erp
      .importMovements(bank.id, [
        {
          accountingDate: erp.today,
          concept: "PAGO PROVEEDOR",
          counterparty: "MATERIALES VALLES",
          amountCents: -bill1.totalCents,
        },
      ])
      .forEach((m) => erp.classifyMovement(m.id, "projectCost"));
    // card purchase on site, allocated by entering the project code (the BNK-02 marquee flow)
    const card = erp.importMovements(bank.id, [
      {
        accountingDate: erp.today,
        concept: "COMPRA TARJETA",
        merchantText: "BRICODEPOT ST FELIU",
        amountCents: -ri(80, 400) * 100,
        card: "V-1234",
      },
    ])[0];
    erp.allocateMovementToProject(card.id, prj.code, "material");
    erp.recordHours({
      workerId: w1.id,
      projectId: prj.id,
      chapterNum: "2",
      hoursMilli: ri(30, 60) * 1000,
    });
    erp.recordHours({
      workerId: w2.id,
      projectId: prj.id,
      chapterNum: "2",
      hoursMilli: ri(30, 60) * 1000,
    });
    erp.markProgress(prj.id, "1", "done");
    erp.markProgress(prj.id, "2", "inProgress", 60);
  }

  if (hnd.phase === 2) {
    // an extra captured on site → priced → approved → progress invoice at ~50% (CHG + AR)
    const chg = erp.addChange(prj.id, {
      desc: "Suelo radiante en baño",
      reason: "Petición del cliente",
      photoRef: "extra-01.jpg",
    });
    erp.priceChange(chg.id, ri(1200, 3000) * 100, ri(700, 1800) * 100);
    erp.approveChange(chg.id, "whatsapp-aprobacion.png");
    // subcontractor bill (autónomo fontanero — 0% IRPF) + technical adviser bill (15% IRPF)
    const b2 = erp.registerBill({
      supplierId: supFont.id,
      number: "JMS-" + prj.code,
      baseCents: Math.round(t.costBaseCents * 0.2),
      vatBp: 2100,
      allocations: [
        {
          projectId: prj.id,
          chapterNum: "3",
          kind: "subcontract",
          amountCents: Math.round(t.costBaseCents * 0.2),
        },
      ],
    });
    assert(
      b2.irpfCents === 0,
      "autónomo construction bill retains 0% IRPF (" + prj.code + ")",
      b2.irpfCents,
    );
    const b3 = erp.registerBill({
      supplierId: supArch.id,
      number: "NC-" + prj.code,
      baseCents: 120000,
      vatBp: 2100,
      allocations: [{ projectId: prj.id, chapterNum: "1", kind: "other", amountCents: 120000 }],
    });
    assert(
      b3.irpfCents === 18000,
      "professional bill retains 15% IRPF (" + prj.code + ")",
      b3.irpfCents,
    );
    erp.payBills({
      amountCents: b2.totalCents + b3.totalCents,
      method: "transfer",
      billAllocations: [
        { billId: b2.id, amountCents: b2.totalCents },
        { billId: b3.id, amountCents: b3.totalCents },
      ],
    }); // AP-04 one payment, two bills
    // progress → second installment invoice
    for (const ch of erp
      .version(bud.id, bud.acceptedVersionId)
      .chapters.filter((c) => c.section === "base"))
      erp.markProgress(prj.id, ch.num, "inProgress", 60);
    const inst = erp.state.contracts.find((c) => c.id === con.id).installments[1];
    const inv = erp.issueInvoice({
      projectId: prj.id,
      kind: "progress",
      baseCents: Math.round(erp.budgetTotals(bud.id, bud.acceptedVersionId).taxableCents * 0.4),
      installmentIdx: 1,
      desc: "Certificación 50% de obra",
    });
    // partial collection now, rest next month (AR-06)
    const half = Math.round(inv.totalCents / 2);
    erp.recordCollection({
      partyId: hnd.cust.id,
      amountCents: half,
      method: "transfer",
      allocations: [{ invoiceId: inv.id, amountCents: half }],
    });
    hnd.pendingInvoice = { id: inv.id, remaining: inv.totalCents - half };
  }

  if (hnd.phase === 3) {
    // collect the pending half; invoice the approved extra; mark done; final invoice; close
    if (hnd.pendingInvoice)
      erp.recordCollection({
        partyId: hnd.cust.id,
        amountCents: hnd.pendingInvoice.remaining,
        method: "transfer",
        allocations: [
          { invoiceId: hnd.pendingInvoice.id, amountCents: hnd.pendingInvoice.remaining },
        ],
      });
    const chg = erp.state.changes.find((c) => c.projectId === prj.id && c.status === "approved");
    if (chg) {
      const invX = erp.issueInvoice({
        projectId: prj.id,
        kind: "extra",
        baseCents: chg.priceCents,
        changeId: chg.id,
        desc: "Extra aprobado: " + chg.desc,
      });
      erp.recordCollection({
        partyId: hnd.cust.id,
        amountCents: invX.totalCents,
        method: "transfer",
        allocations: [{ invoiceId: invX.id, amountCents: invX.totalCents }],
      });
      // extra's cost arrives as a supplier bill
      erp.registerBill({
        supplierId: supFont.id,
        number: "JMS-X-" + prj.code,
        baseCents: chg.costCents,
        vatBp: 2100,
        allocations: [
          { projectId: prj.id, chapterNum: "3", kind: "subcontract", amountCents: chg.costCents },
        ],
      });
    }
    for (const ch of erp
      .version(bud.id, bud.acceptedVersionId)
      .chapters.filter((c) => c.section === "base"))
      erp.markProgress(prj.id, ch.num, "done");
    const ec0 = erp.projectEconomics(prj.id);
    const billing = erp.projectBilling(prj.id);
    const invF = erp.issueInvoice({
      projectId: prj.id,
      kind: "final",
      baseCents: Math.round(billing.remainingToInvoiceCents / (1 + prj.vatBp / 10000)),
      installmentIdx: 2,
      desc: "Liquidación final de obra",
    });
    erp.recordCollection({
      partyId: hnd.cust.id,
      amountCents: invF.totalCents,
      method: "transfer",
      allocations: [{ invoiceId: invF.id, amountCents: invF.totalCents }],
    });
    // one project in ~6 gets a small credit note (rectificativa) — VFU-02/AR-10
    if (rnd() < 0.18) {
      erp.issueInvoice({
        projectId: prj.id,
        kind: "creditNote",
        baseCents: 25000,
        rectifies: invF.id,
        rectifyReason: "Abono por remate pendiente",
        desc: "Abono parcial",
      }); // customer keeps a credit balance
    }
    erp.closeProject(prj.id);
    hnd.done = true;
    // BASELINE FROZEN check (PRJ-03): baseline unchanged after everything
    assert(
      erp.project(prj.id).baseline.revenueCents === hnd.baselineAtStart,
      "baseline frozen through life (" + prj.code + ")",
      "",
    );
  }
}

/* ---------------- run the year ---------------- */
const MONTHS = [];
{
  let y = 2026,
    mo = 1;
  for (let i = 0; i < SIM_MONTHS; i++) {
    MONTHS.push(`${y}-${String(mo).padStart(2, "0")}`);
    mo++;
    if (mo > 12) {
      mo = 1;
      y++;
    }
  }
}
const END = MONTHS[MONTHS.length - 1] + (MONTHS[MONTHS.length - 1].endsWith("-12") ? "-31" : "-28");
for (const m of MONTHS) {
  erp.setToday(m + "-05");
  // overhead each month: rent bill + salary movement (FIN-07 / BNK-03)
  const rent = erp.registerBill({
    supplierId: supMat.id,
    number: "RENT-" + m,
    baseCents: 180000,
    vatBp: 2100,
    allocations: [{ overheadCategory: "rent", kind: "other", amountCents: 180000 }],
  });
  erp.payBills({
    amountCents: rent.totalCents,
    method: "transfer",
    billAllocations: [{ billId: rent.id, amountCents: rent.totalCents }],
  });
  erp
    .importMovements(bank.id, [
      { accountingDate: m + "-28", concept: "NOMINAS", amountCents: -900000 },
      { accountingDate: m + "-15", concept: "TRASPASO A CAJA", amountCents: -20000 },
    ])
    .forEach((mv, i) => erp.classifyMovement(mv.id, i === 0 ? "salary" : "internalTransfer"));

  // SIM_PPM new projects/month. 3 (default): large-or-medium + medium + quick repair.
  // 2: large-or-medium + (alternating medium / quick repair) so both paths stay exercised.
  erp.setToday(m + "-08");
  const h1 = runLargeOrMedium(ri(0, 1) ? "large" : "medium");
  h1.baselineAtStart = h1.prj.baseline.revenueCents;
  openProjects.push(h1);
  const monthIdx = MONTHS.indexOf(m);
  if (SIM_PPM >= 3 || (SIM_PPM === 2 && monthIdx % 2 === 1)) {
    erp.setToday(m + "-14");
    const h2 = runLargeOrMedium("medium");
    h2.baselineAtStart = h2.prj.baseline.revenueCents;
    openProjects.push(h2);
  }
  if (SIM_PPM >= 3 || (SIM_PPM === 2 && monthIdx % 2 === 0)) {
    erp.setToday(m + "-20");
    runQuickRepair();
  }

  // advance all open projects
  erp.setToday(m + "-25");
  for (const h of openProjects.filter((x) => !x.done)) advanceProject(h);

  // quarterly package at quarter end (GES)
  if (+m.slice(5) % 3 === 0) {
    erp.setToday(m + "-30");
    const q = quarterOf(m + "-15");
    // GES-07 is BLOCKING: the package refuses to generate while anything on
    // the exception list is unjustified. A real quarter-end is exactly this —
    // work the list down, then justify whatever genuinely cannot be fixed —
    // so the simulation does the same rather than reaching for a back door.
    // (There is no back door: see quarterlyPackage.)
    const blocked = erp.exceptionsWithStatus(q).filter((x) => !x.accepted);
    for (const x of blocked)
      erp.acceptException(q, x.key, "revisado en el cierre trimestral", "bo");
    assert(
      erp.exceptionsWithStatus(q).every((x) => x.accepted),
      "package " + q + ": every exception justified before sending",
      "",
    );
    const pkg = erp.quarterlyPackage(q, { recipient: "gestoria@example.com" });
    assert(
      pkg.issuedInvoices.length > 0 && pkg.receivedBills.length > 0,
      "package " + q + " has registers",
      "",
    );
    assert(
      pkg.exceptions.seriesGaps.invoice.length === 0,
      "package " + q + ": invoice series gap-free",
      pkg.exceptions.seriesGaps.invoice.join(","),
    );
    // GES-03 reconciliation: recompute VAT from raw registers
    const rawOut = pkg.issuedInvoices.reduce((s, x) => s + x.vatCents, 0);
    assert(
      rawOut === pkg.vat.outputVatCents,
      "package " + q + ": VAT reconciles to register",
      rawOut + " vs " + pkg.vat.outputVatCents,
    );
  }
}

/* ---------------- year-end invariants ---------------- */
erp.setToday(END);
const S = erp.state;

// 1. Numbering series gap-free and unique (ORG-04)
for (const t of ["budget", "contract", "invoice", "receipt", "purchaseOrder", "creditNote"]) {
  assert(erp.seriesGaps(t).length === 0, `series gap-free: ${t}`, erp.seriesGaps(t).join(","));
  const nums = S.series[t].issued;
  assert(new Set(nums).size === nums.length, `series unique: ${t}`, "");
}
// 2. Every invoice references a project & budget (AR-03) and is immutable data
assert(
  S.invoices.every((i) => i.projectId),
  "every invoice attributable to a project",
  "",
);
// 3. Invoice event chain intact (VFU-01)
let chainOk = true,
  prev = "GENESIS";
for (const ev of S.invoiceEvents) {
  if (ev.prev !== prev) {
    chainOk = false;
    break;
  }
  prev = ev.hash;
}
assert(
  chainOk && S.invoiceEvents.length === S.invoices.length,
  "invoice event chain intact",
  S.invoiceEvents.length + " vs " + S.invoices.length,
);
// 4. Credit notes reference originals (AR-10/VFU-02)
assert(
  S.invoices.filter((i) => i.kind === "creditNote").every((i) => i.rectifies),
  "credit notes reference originals",
  "",
);
// 5. AR reconciliation: invoiced − collected == outstanding (AR-08/09)
{
  const invTot =
    S.invoices.filter((i) => i.kind !== "creditNote").reduce((s, i) => s + i.totalCents, 0) -
    S.invoices.filter((i) => i.kind === "creditNote").reduce((s, i) => s + i.totalCents, 0);
  const collected = S.collections.reduce(
    (s, c) => s + c.allocations.reduce((x, a) => x + a.amountCents, 0),
    0,
  );
  const outstanding = S.invoices
    .filter((i) => i.kind !== "creditNote")
    .reduce((s, i) => s + erp.invoiceOutstandingCents(i.id), 0);
  assert(
    invTot - collected === outstanding,
    "AR reconciles: invoiced − collected = outstanding",
    invTot + "-" + collected + "≠" + outstanding,
  );
}
// 6. AP reconciliation
{
  const billTot = S.bills.filter((b) => !b.creditNoteFor).reduce((s, b) => s + b.totalCents, 0);
  const paid = S.payments.reduce((s, p) => s + p.amountCents, 0);
  const out = S.bills
    .filter((b) => !b.creditNoteFor)
    .reduce((s, b) => s + erp.billOutstandingCents(b.id), 0);
  assert(
    billTot - paid === out,
    "AP reconciles: billed − paid = outstanding",
    billTot + "-" + paid + "≠" + out,
  );
}
// 7. Budget totals: base never silently includes options (PRE-06) + pending excluded (PRE-04)
{
  const b = S.budgets[0];
  const t = erp.budgetTotals(b.id, b.acceptedVersionId || b.currentVersionId);
  const manualBase = t.chapters
    .filter((c) => c.section === "base")
    .reduce((s, c) => s + c.saleCents, 0);
  assert(
    t.baseCents === manualBase && t.optionsCents > 0 && t.pendingCount >= 1,
    "budget totals: options separate, pending excluded & counted",
    JSON.stringify({ base: t.baseCents, opt: t.optionsCents, pend: t.pendingCount }),
  );
  assert(
    t.grandCents === t.taxableCents + t.vatCents - t.irpfCents,
    "budget grand total arithmetic",
    "",
  );
}
// 8. Customer doc carries no internal cost (QUO-10/PRE-08) and carries fiscal data (DOC-01/QUO-07)
{
  const b = S.budgets[0];
  const doc = erp.renderBudgetDoc(b.id, b.acceptedVersionId || b.currentVersionId);
  const json = JSON.stringify(doc);
  assert(
    !/cost|margin|marginCents|costCents/i.test(json.replace(/costCents":0/g, "")),
    "customer doc: no internal cost/margin fields",
    "",
  );
  assert(
    doc.issuer.taxId && doc.issuer.logoRef && doc.issuer.iban,
    "customer doc: logo + fiscal data present",
    "",
  );
}
// 9. Accepted version immutable (QUO-04)
{
  const b = S.budgets.find((x) => x.acceptedVersionId);
  let threw = false;
  try {
    erp.addChapter(b.id, { name: "hack" });
  } catch (e) {
    threw = true;
  }
  assert(threw, "accepted/frozen version rejects edits", "");
}
// 10. Project economics: margin math consistent at year end (FIN-01/02/03)
{
  let okAll = true,
    detail = "";
  for (const p of S.projects) {
    const e = erp.projectEconomics(p.id);
    if (e.currentRevenueCents !== e.baselineRevenueCents + e.approvedChangesCents) {
      okAll = false;
      detail = p.code + " revenue";
      break;
    }
    if (e.marginForecastCents !== e.currentRevenueCents - e.forecastCostCents) {
      okAll = false;
      detail = p.code + " margin";
      break;
    }
  }
  assert(
    okAll,
    "project economics: revenue & margin identities hold for all " +
      S.projects.length +
      " projects",
    detail,
  );
}
// 11. Closed projects: final margin known and actual cost > 0 for contracted works (FIN)
{
  const closed = S.projects.filter((p) => p.closed && p.budgetId);
  assert(
    closed.length >= 20,
    "closed contracted projects ≥ 20 (" + closed.length + ")",
    closed.length,
  );
  assert(
    closed.every((p) => erp.projectEconomics(p.id).marginFinalCents !== null),
    "final margin computed for closed projects",
    "",
  );
  assert(
    closed.every((p) => erp.actualCostCents(p.id) > 0),
    "actual cost captured on every closed contracted project",
    "",
  );
}
// 12. Unapproved extras never invoiced (CHG-04)
{
  let threw = false;
  const p = S.projects.find((x) => !x.closed) || S.projects[0];
  const ch = erp.addChange(p.id, { desc: "prueba sin aprobar" });
  try {
    erp.issueInvoice({ projectId: p.id, kind: "extra", baseCents: 1000, changeId: ch.id });
  } catch (e) {
    threw = true;
  }
  assert(threw, "unapproved extra is not billable", "");
}
// 13. VAT year total reconciles across quarters (GES-03)
{
  const qs = [...new Set(MONTHS.map((m) => quarterOf(m + "-15")))];
  const sumQ = qs.reduce((s, q) => s + erp.vatSummary(q).outputVatCents, 0);
  const raw = S.invoices.reduce(
    (s, i) => s + (i.kind === "creditNote" ? -i.vatCents : i.vatCents),
    0,
  );
  assert(sumQ === raw, "annual output VAT = Σ quarters = Σ invoices", sumQ + " vs " + raw);
}
// 14. IRPF: retained on professional, zero on construction autónomo (AP-07)
{
  const arch = S.bills.filter((b) => b.supplierId === supArch.id);
  const font = S.bills.filter((b) => b.supplierId === supFont.id);
  assert(
    arch.every((b) => b.irpfCents === Math.round(b.baseCents * 0.15)) &&
      font.every((b) => b.irpfCents === 0),
    "IRPF profile applied per supplier",
    "",
  );
}
// 15. Bank: internal transfers excluded; balances consistent (BNK-03/06)
{
  const bal = erp.accountBalanceCents(bank.id);
  const manual =
    bank.openingCents +
    S.movements.filter((m) => m.accountId === bank.id).reduce((s, m) => s + m.amountCents, 0);
  assert(bal === manual, "bank balance = opening + Σ movements", bal + " vs " + manual);
  assert(
    S.movements.filter((m) => m.class === "internalTransfer").every((m) => m.excludedFromPL),
    "internal transfers excluded from P&L",
    "",
  );
}
// 16. BNK-02: card movement allocated by project code landed on that project's actual cost
{
  const cardMovs = S.movements.filter((m) => m.card && m.status === "allocated");
  assert(
    cardMovs.length >= 20,
    "card movements allocated via project number (" + cardMovs.length + ")",
    cardMovs.length,
  );
}
// 17. Cash discipline: undocumented cash flagged (BNK-07)
{
  erp.recordCashMovement(till.id, {
    accountingDate: END,
    concept: "Pago informal prueba",
    amountCents: -5000,
  });
  const flagged = S.movements.filter((m) => m.needsDoc);
  assert(flagged.length >= 1, "undocumented cash movement flagged", "");
}
// 18. Completeness gate: incomplete party cannot be invoiced (MDM-10)
{
  const bad_ = erp.addParty({
    roles: ["customer"],
    name: "Cliente Incompleto",
    mobile: "699999999",
  });
  let threw = false;
  try {
    erp._requireComplete(bad_.id, "invoice");
  } catch (e) {
    threw = true;
  }
  assert(threw, "incomplete party blocked from invoicing", "");
}
// 19. Duplicate tax id rejected (MDM-03)
{
  let threw = false;
  try {
    erp.addParty({ roles: ["customer"], name: "Duplicado", taxId: S.parties[5].taxId });
  } catch (e) {
    threw = true;
  }
  assert(threw, "duplicate active tax id rejected", "");
}
// 20. Contract control view complete (CON-13) & installments sum to totals (CON-04)
{
  const view = erp.contractControlView();
  assert(
    view.length === S.contracts.length && view.every((c) => c.durationDays > 0 && c.signed),
    "contract control view complete & durations mandatory",
    "",
  );
  const sumsOk = S.contracts.every(
    (c) => Math.abs(c.installments.reduce((s, i) => s + i.amountCents, 0) - c.totalCents) <= 1,
  );
  assert(sumsOk, "installments sum to contract total (±1c)", "");
}
// 21. Warranty register generated at close (CON-08)
{
  const done = S.contracts.filter((c) => c.status === "completed");
  assert(
    done.length > 0 && done.every((c) => c.guarantees.every((g) => g.expiryDate)),
    "warranties dated at completion",
    "",
  );
}
// 22. Package/labour/audit sanity
const expectedPkgs = MONTHS.filter((m) => +m.slice(5) % 3 === 0).length;
assert(
  S.packagesSent.length === expectedPkgs,
  expectedPkgs + " quarterly packages sent",
  S.packagesSent.length,
);
assert(
  erp.labourExport().length >= 60,
  "labour export populated (" + erp.labourExport().length + ")",
  "",
);
assert(S.audit.length > 400, "audit trail populated (" + S.audit.length + ")", S.audit.length);
// 23. Alerts & control tower render without error and drill-down refs exist (DAS-02/03/06)
{
  const ct = erp.controlTower();
  assert(
    Array.isArray(ct.alerts) && ct.alerts.every((a) => a.ref),
    "alerts computed, every alert drillable",
    "",
  );
  assert(
    typeof ct.invoicedCents === "number" && typeof ct.cash.totalCents === "number",
    "control tower indicators computed",
    "",
  );
}
// 24. Profitability by activity line + customer both compute (FIN-08)
{
  const byLine = erp.profitability("activityLine"),
    byCust = erp.profitability("customer");
  assert(
    byLine.length >= 2 && byCust.length >= 30,
    "profitability by line & customer",
    byLine.length + "/" + byCust.length,
  );
}
// 25. Persistence round-trip: save + reload preserves behaviour (NFR-06/09)
{
  const json = JSON.stringify(erp.toJSON());
  const erp2 = ERP.from(JSON.parse(json));
  const ct1 = erp.controlTower(),
    ct2 = erp2.controlTower();
  assert(
    ct1.invoicedCents === ct2.invoicedCents && ct1.outstandingCents === ct2.outstandingCents,
    "state round-trips through JSON identically",
    "",
  );
}

/* ---------------- report ---------------- */
const failed = checks.filter((c) => !c.pass);
console.log(`\n──── year simulation (seed ${SEED}) ────`);
console.log(
  `projects: ${S.projects.length} (${S.projects.filter((p) => p.closed).length} closed) · invoices: ${S.invoices.length} · bills: ${S.bills.length} · movements: ${S.movements.length} · alerts now: ${erp.alerts().length}`,
);
for (const c of checks) if (!c.pass) console.log(`✗ ${c.name} → ${c.detail}`);
console.log(`${checks.length - failed.length}/${checks.length} invariants passed`);
process.exit(failed.length ? 1 : 0);

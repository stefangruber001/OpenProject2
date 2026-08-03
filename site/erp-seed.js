/* =============================================================================
   Shared starter dataset for the ERP workspace and the home launchpad.
   Builds ONE company dataset through the real engine so every screen and KPI
   is derived from the same records. Deterministic (no randomness).
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./erp-engine.js"), require("./erp-history.js"));
  else root.ErpSeed = factory(root.ErpEngine, root.ErpHistory);
})(typeof globalThis !== "undefined" ? globalThis : this, function (E, History) {
  "use strict";
  const { ERP, addDays } = E;

  function build(today) {
    const erp = new ERP("2026-03-02");
    erp.configureEntity({
      legalName: "Canei Subirats, S.L.",
      taxId: "B66666666",
      street: "Carrer de la Creu 74",
      postalCode: "08960",
      city: "Sant Just Desvern",
      phone: "659 87 67 00",
      email: "hola@caneisubirats.com",
      iban: "ES9121000418450200051332",
      registry: "R.M. Barcelona",
    });
    erp.state.clauseBlocks.push({
      id: "cb1",
      name: "Condiciones generales de contratación",
      effectiveFrom: "2026-01-01",
      version: 1,
    });

    const bank = erp.addBankAccount({
      name: "Cuenta principal",
      kind: "bank",
      iban: "ES9121000418450200051332",
      openingCents: 6400000,
    });
    const till = erp.addBankAccount({ name: "Caja efectivo", kind: "till", openingCents: 42000 });

    /* suppliers & subcontractors */
    const supMat = erp.addParty({
      roles: ["supplier"],
      partyType: "company",
      name: "Materiales Vallès S.A.",
      taxId: "A58818501",
      billStreet: "Pol. Ind. Can Roca 5",
      billPostalCode: "08191",
      billCity: "Rubí",
      billProvince: "Barcelona",
      mobile: "937000001",
      email: "ventas@matvalles.example",
      paymentTermsDays: 30,
      leadSource: "other",
    });
    const supElec = erp.addParty({
      roles: ["subcontractor"],
      partyType: "company",
      name: "ElectroBaix S.L.",
      taxId: "B65739207",
      billStreet: "C/ Indústria 12",
      billPostalCode: "08980",
      billCity: "Sant Feliu de Llobregat",
      billProvince: "Barcelona",
      mobile: "936000002",
      email: "info@electrobaix.example",
      paymentTermsDays: 30,
      leadSource: "other",
    });
    const supFont = erp.addParty({
      roles: ["subcontractor", "selfEmployed"],
      partyType: "individual",
      name: "Josep Maria Solé (fontanería)",
      taxId: "46543299Q",
      billStreet: "C/ Major 3",
      billPostalCode: "08750",
      billCity: "Molins de Rei",
      billProvince: "Barcelona",
      mobile: "610000003",
      email: "jm.sole@example.com",
      paymentTermsDays: 15,
      irpfApplies: false,
      irpfRateBp: 0,
      leadSource: "other",
    });
    const supArch = erp.addParty({
      roles: ["adviser", "selfEmployed"],
      partyType: "individual",
      name: "N. Camps, arquitecta técnica",
      taxId: "47732924N",
      billStreet: "Av. Diagonal 200",
      billPostalCode: "08018",
      billCity: "Barcelona",
      billProvince: "Barcelona",
      mobile: "620000004",
      email: "n.camps@example.com",
      paymentTermsDays: 15,
      irpfApplies: true,
      irpfRateBp: 1500,
      leadSource: "other",
    });

    /* customers — one deliberately incomplete (data-quality queue, MDM-10) */
    const cRoca = erp.addParty({
      roles: ["customer"],
      partyType: "individual",
      name: "Marta Roca Puig",
      taxId: "12345678Z",
      contactPerson: "Marta Roca Puig",
      landline: "934771208",
      billStreet: "Av. Barcelona 10, 3º 2ª",
      billPostalCode: "08960",
      billCity: "Sant Just Desvern",
      billProvince: "Barcelona",
      mobile: "600111222",
      email: "marta.roca@example.com",
      leadSource: "referrer",
      paymentMethod: "transfer",
      paymentTermsDays: 15,
    });
    const cBalmes = erp.addParty({
      roles: ["customer"],
      partyType: "community",
      name: "Comunidad Prop. Balmes 120",
      taxId: "H08571730",
      contactPerson: "Jordi Vives (administrador de fincas)",
      billStreet: "C/ Balmes 120",
      billPostalCode: "08008",
      billCity: "Barcelona",
      billProvince: "Barcelona",
      landline: "934000000",
      mobile: "634000000",
      email: "vives@fincasvives.example",
      leadSource: "propertyManager",
      paymentMethod: "transfer30",
      paymentTermsDays: 30,
    });
    const cNou = erp.addParty({
      roles: ["customer"],
      partyType: "company",
      name: "Nou Local Gràcia S.L.",
      taxId: "B66957286",
      contactPerson: "Jordi Massana",
      landline: "932184460",
      billStreet: "C/ Verdi 22",
      billPostalCode: "08012",
      billCity: "Barcelona",
      billProvince: "Barcelona",
      mobile: "620333444",
      email: "jordi@noulocal.example",
      leadSource: "website",
      paymentMethod: "transfer60",
      paymentTermsDays: 60,
      registry: "R.M. Barcelona, T.48001, F.120",
    });
    const cFerrer = erp.addParty({
      roles: ["customer"],
      partyType: "individual",
      name: "Pau Ferrer Vila",
      taxId: "46027840X",
      contactPerson: "Pau Ferrer Vila",
      landline: "933726611",
      billStreet: "C/ Laurel 8",
      billPostalCode: "08950",
      billCity: "Esplugues de Llobregat",
      billProvince: "Barcelona",
      mobile: "655001122",
      email: "pau.ferrer@example.com",
      leadSource: "leadPlatform",
      paymentMethod: "transfer",
      paymentTermsDays: 15,
    });
    const cIncompleta = erp.addParty({
      roles: ["customer"],
      partyType: "individual",
      name: "Sra. García (pendiente de datos)",
      mobile: "688777666",
      leadSource: "wordOfMouth",
    }); // no taxId/address — cleansing queue

    /* properties */
    const pRoca = erp.addProperty({
      partyId: cRoca.id,
      street: "Av. Barcelona 10, 3º 2ª",
      postalCode: "08960",
      city: "Sant Just Desvern",
      part: "dwelling",
      surfaceM2: 92,
      occupied: true,
    });
    const pBalmes = erp.addProperty({
      partyId: cBalmes.id,
      street: "C/ Balmes 120",
      postalCode: "08008",
      city: "Barcelona",
      part: "commonArea",
      surfaceM2: 260,
    });
    const pNou = erp.addProperty({
      partyId: cNou.id,
      street: "C/ Verdi 22, bajos",
      postalCode: "08012",
      city: "Barcelona",
      part: "commercialUnit",
      surfaceM2: 140,
    });
    const pFerrer = erp.addProperty({
      partyId: cFerrer.id,
      street: "C/ Laurel 8, PB",
      postalCode: "08950",
      city: "Esplugues",
      part: "dwelling",
      surfaceM2: 78,
    });

    /* catalogue, packages, prices (with source + date) */
    const items = {};
    [
      ["DEM-001", "Demolición de tabique de ladrillo", "m2", "ownLabour", 950, 1600],
      ["ALB-010", "Tabique de cartón-yeso 15+46+15", "m2", "material", 1750, 3200],
      ["FON-014", "Punto de agua empotrado (alta/baja)", "ud", "subcontract", 4800, 8200],
      ["ELE-020", "Punto de luz / enchufe empotrado", "ud", "subcontract", 2600, 4600],
      ["ALI-101", "Alicatado gres porcelánico 60×60", "m2", "material", 1800, 3400],
      ["PIN-001", "Pintura plástica lisa dos manos", "m2", "ownLabour", 420, 850],
      ["HUM-201", "Tratamiento antihumedad por inyección", "l", "material", 2400, 0],
      ["CAR-030", "Puerta de paso lacada con manillas", "ud", "material", 14500, 24500],
    ].forEach(([code, desc, unit, type, cost, price]) => {
      items[code] = erp.addCatalogueItem({
        code,
        desc,
        unit,
        type,
        defaultCostCents: cost,
        defaultPriceCents: price,
      });
    });
    erp.addPrice({
      itemId: items["ALI-101"].id,
      supplierId: supMat.id,
      listCents: 2000,
      discountPct: 10,
      source: "priceList",
      sourceDocRef: "Tarifa MV 2026",
      validUntil: "2026-12-31",
    });
    erp.addPrice({
      itemId: items["ALI-101"].id,
      supplierId: supElec.id,
      listCents: 2150,
      discountPct: 5,
      source: "supplierOffer",
      sourceDocRef: "Oferta EB-118",
    });
    erp.addPrice({
      itemId: items["HUM-201"].id,
      supplierId: supMat.id,
      listCents: 2600,
      discountPct: 8,
      source: "supplierOffer",
      sourceDocRef: "Oferta HUM-12",
      validUntil: "2026-02-28",
    }); // expired → alert
    erp.addPrice({
      itemId: items["CAR-030"].id,
      supplierId: supMat.id,
      listCents: 15800,
      discountPct: 12,
      source: "valuedDeliveryNote",
      sourceDocRef: "Albarán 2026-0141",
    });
    erp.addWorkPackage({
      code: "PK-HUM",
      name: "Saneado antihumedad por m²",
      unit: "m2",
      components: [{ itemId: items["HUM-201"].id, qtyPerUnitMilli: 350, kind: "material" }],
      wastePct: 5,
      minPurchaseQty: 5,
      containerSize: 5,
    });
    erp.addWorkPackage({
      code: "PK-BANY",
      name: "Baño completo (plantilla)",
      unit: "ud",
      components: [
        { itemId: items["FON-014"].id, qtyPerUnitMilli: 4000, kind: "subcontract" },
        { itemId: items["ALI-101"].id, qtyPerUnitMilli: 32000, kind: "material" },
      ],
      wastePct: 10,
      minPurchaseQty: 0,
      containerSize: 0,
    });

    /* workers */
    // Rate bands go back to 2024 because the history below books real hours
    // there and workerRateCents() refuses to guess a rate that was never in
    // force — effective dating doing its job. The 2026 figures are unchanged,
    // so every 2026 labour cost is exactly what it always was; the earlier
    // bands simply give two years of pay rises something to be read from.
    const w1 = erp.addWorker({
      name: "Oficial 1ª — Álvaro",
      kind: "employee",
      rateHistory: [
        { from: "2024-01-01", rateCentsPerHour: 1700 },
        { from: "2025-01-01", rateCentsPerHour: 1800 },
        { from: "2026-01-01", rateCentsPerHour: 1900 },
      ],
    });
    const w2 = erp.addWorker({
      name: "Peó — Ibra",
      kind: "employee",
      rateHistory: [
        { from: "2024-01-01", rateCentsPerHour: 1250 },
        { from: "2025-01-01", rateCentsPerHour: 1320 },
        { from: "2026-01-01", rateCentsPerHour: 1400 },
      ],
    });

    /* helper to build a budget quickly */
    function budgetWith(party, prop, line, chapters, opts) {
      const b = erp.createBudget(
        Object.assign(
          {
            partyId: party.id,
            propertyId: prop.id,
            activityLine: line,
            surfaceM2: prop.surfaceM2,
            vatBp: 1000,
            paymentConditions: "40% a la firma · 40% a mitad de obra · 20% a la finalización",
          },
          opts || {},
        ),
      );
      for (const [name, lines] of chapters) {
        const ch = erp.addChapter(b.id, { name });
        for (const l of lines) erp.addLine(b.id, ch.id, l);
      }
      return b;
    }

    /* ---- Two years of trading history (2024-06 … 2025-12) ----------------
       Runs BEFORE the 2026 story on purpose. Document series restart per
       fiscal year, so history occupies the 2024/2025 series and every 2026
       number the staged story below produces — and that ~147 browser checks
       assert by name — is exactly what it always was. See erp-history.js.
       Degrades silently if the module is absent so erp-seed.js keeps working
       standalone (some Node probes require it directly). */
    if (History && typeof History.apply === "function") {
      History.apply(erp, {
        items,
        suppliers: { material: supMat, electrical: supElec, plumbing: supFont, adviser: supArch },
        workers: [w1, w2],
        bank,
        till,
        budgetWith,
      });
    }

    /* ---- P1: Reforma Roca — accepted, in execution, extra approved, 50% invoiced ---- */
    erp.setToday("2026-03-04");
    const oRoca = erp.addOpportunity({
      partyId: cRoca.id,
      propertyId: pRoca.id,
      source: "referrer",
      requestedWork: "Reforma integral baño + cocina",
      expectedValue: 4100000,
    });
    erp.addVisit({
      opportunityId: oRoca.id,
      measurements: [{ what: "baño", qty: 12.5, unit: "m2" }],
      photos: ["visita-roca-01.jpg"],
      notes: "Croquis a mano; bajante en buen estado",
      handwrittenEstimateRef: "croquis-roca.jpg",
    });
    const bRoca = budgetWith(cRoca, pRoca, "renovation", [
      [
        "Demoliciones",
        [
          {
            code: "D1",
            itemId: items["DEM-001"].id,
            desc: "Demolición de tabiques y retirada",
            unit: "m2",
            qtyMilli: 34000,
            priceCents: 1600,
            costCents: 950,
            costSupplierId: supMat.id,
            costSourceRef: "propia",
          },
        ],
      ],
      [
        "Albañilería",
        [
          {
            code: "A1",
            itemId: items["ALB-010"].id,
            desc: "Tabiquería nueva en cocina",
            unit: "m2",
            qtyMilli: 0,
            priceCents: 3200,
            costCents: 1750,
            costSupplierId: supMat.id,
            costSourceRef: "Tarifa MV 2026",
            subLines: [
              { room: "Cocina", qtyMilli: 18000, wastePct: 10, customerVisible: true },
              { room: "Baño", qtyMilli: 9000, wastePct: 10, customerVisible: true },
            ],
          },
        ],
      ],
      [
        "Fontanería",
        [
          {
            code: "F1",
            itemId: items["FON-014"].id,
            desc: "Puntos de agua baño y cocina",
            unit: "ud",
            qtyMilli: 8000,
            priceCents: 8200,
            costCents: 4800,
            costSupplierId: supFont.id,
            costSourceRef: "Oferta JMS-31",
          },
        ],
      ],
      [
        "Electricidad",
        [
          {
            code: "E1",
            itemId: items["ELE-020"].id,
            desc: "Puntos de luz y enchufes",
            unit: "ud",
            qtyMilli: 22000,
            priceCents: 4600,
            costCents: 2600,
            costSupplierId: supElec.id,
            costSourceRef: "Oferta EB-119",
          },
        ],
      ],
      [
        "Revestimientos",
        [
          {
            code: "R1",
            itemId: items["ALI-101"].id,
            desc: "Alicatado baño y frente cocina",
            unit: "m2",
            qtyMilli: 41000,
            priceCents: 3400,
            costCents: 1800,
            costSupplierId: supMat.id,
            costSourceRef: "Tarifa MV 2026",
          },
        ],
      ],
    ]);
    const chOptR = erp.addChapter(bRoca.id, {
      name: "Opcional — mampara y espejo",
      section: "optional",
    });
    erp.addLine(bRoca.id, chOptR.id, {
      code: "OP1",
      desc: "Mampara de vidrio templado",
      unit: "ud",
      qtyMilli: 1000,
      priceCents: 68000,
      costCents: 42000,
    });
    erp.issueVersion(bRoca.id, { channel: "email" });
    erp.setToday("2026-03-12");
    const v2R = erp.newVersion(bRoca.id, {
      reason: "Rebaja negociada en revestimientos",
      author: "backoffice",
    });
    v2R.chapters[4].lines[0].priceCents = 3250;
    erp.issueVersion(bRoca.id, { channel: "email" });
    erp.acceptVersion(bRoca.id, v2R.id, { evidenceRef: "email-aceptacion-roca.pdf" });
    const tR = erp.budgetTotals(bRoca.id, v2R.id);
    const conR = erp.createContract(bRoca.id, {
      installments: [
        { pct: 40, trigger: "onSignature", expectedDate: "2026-03-16" },
        { pct: 40, trigger: "atStage", stageRef: "50% de obra", expectedDate: "2026-04-28" },
        { pct: 20, trigger: "onCompletion", expectedDate: "2026-06-05" },
      ],
      duration: {
        estimatedDays: 55,
        plannedStart: "2026-03-25",
        plannedFinish: "2026-06-01",
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
        capCents: Math.round(tR.grandCents * 0.1),
        graceDays: 7,
        suspendingEvents: ["retraso del cliente", "fuerza mayor", "cambio aprobado"],
      },
    });
    erp.setToday("2026-03-16");
    erp.signContract(conR.id, { method: "digital" });
    const prjR = erp.createProjectFromAcceptance(bRoca.id);
    prjR.dates.targetEnd = "2026-06-05";
    const depR = erp.issueInvoice({
      projectId: prjR.id,
      kind: "deposit",
      baseCents: Math.round(tR.taxableCents * 0.4),
      installmentIdx: 0,
      desc: "Anticipo 40% según contrato",
      worksAddress: pRoca.street,
    });
    erp.recordFirstPayment(conR.id);
    erp.recordCollection({
      partyId: cRoca.id,
      amountCents: depR.totalCents,
      method: "transfer",
      allocations: [{ invoiceId: depR.id, amountCents: depR.totalCents }],
    });
    erp
      .importMovements(bank.id, [
        {
          accountingDate: "2026-03-17",
          concept: "TRANSFERENCIA RECIBIDA",
          counterparty: "MARTA ROCA",
          amountCents: depR.totalCents,
        },
      ])
      .forEach((m) => erp.classifyMovement(m.id, "customerReceipt"));
    erp.setToday("2026-03-25");
    erp.startWorks(prjR.id);
    // purchases + bills + labour + card allocated by project number (BNK-02)
    const puR = erp.addPurchase({
      supplierId: supMat.id,
      projectId: prjR.id,
      chapterNum: "5",
      desc: "Gres porcelánico + material obra",
      qtyMilli: 1000,
      unitCents: 310000,
      orderRef: "OR-ROCA-1",
    });
    erp.setToday("2026-04-06");
    const capR = erp.captureDocument({
      docType: "supplierInvoice",
      imageRef: "factura-mv-2044.jpg",
      extractable: { issuerName: "Materiales Valles", totalCents: 375100 },
      confidence: 0.86,
    });
    erp.confirmCapture(capR.id, {
      issuerName: "Materiales Vallès S.A.",
      issuerTaxId: supMat.taxId,
      docNumber: "MV-2044",
      date: "2026-04-06",
      totalCents: 375100,
    });
    const b1R = erp.registerBill({
      supplierId: supMat.id,
      number: "MV-2044",
      baseCents: 310000,
      vatBp: 2100,
      orderRef: "OR-ROCA-1",
      capId: capR.id,
      allocations: [{ projectId: prjR.id, chapterNum: "5", kind: "material", amountCents: 310000 }],
    });
    erp.payBills({
      amountCents: b1R.totalCents,
      method: "transfer",
      billAllocations: [{ billId: b1R.id, amountCents: b1R.totalCents }],
    });
    erp
      .importMovements(bank.id, [
        {
          accountingDate: "2026-04-07",
          concept: "PAGO PROVEEDOR",
          counterparty: "MATERIALES VALLES",
          amountCents: -b1R.totalCents,
        },
      ])
      .forEach((m) => erp.classifyMovement(m.id, "projectCost"));
    const cardR = erp.importMovements(bank.id, [
      {
        accountingDate: "2026-04-09",
        concept: "COMPRA TARJETA",
        merchantText: "BRICODEPOT ST FELIU",
        amountCents: -18650,
        card: "V-1234",
      },
    ])[0];
    erp.allocateMovementToProject(cardR.id, prjR.code, "material");
    erp.learnMerchantRule("BRICODEPOT", { supplierId: supMat.id, category: "material" });
    erp.recordHours({ workerId: w1.id, projectId: prjR.id, chapterNum: "1", hoursMilli: 42000 });
    erp.recordHours({ workerId: w2.id, projectId: prjR.id, chapterNum: "1", hoursMilli: 38000 });
    erp.markProgress(prjR.id, "1", "done");
    erp.markProgress(prjR.id, "2", "done");
    erp.markProgress(prjR.id, "3", "inProgress", 60);
    // extra: captured on site → priced → approved (annex)
    erp.setToday("2026-04-15");
    const chgR = erp.addChange(prjR.id, {
      desc: "Suelo radiante eléctrico en baño",
      reason: "Petición de la clienta",
      photoRef: "extra-suelo-radiante.jpg",
    });
    erp.priceChange(chgR.id, 186000, 112000);
    erp.approveChange(chgR.id, "whatsapp-aprobacion.png");
    // 50% installment invoiced, half collected (partial, AR-06)
    erp.setToday("2026-04-28");
    const invR2 = erp.issueInvoice({
      projectId: prjR.id,
      kind: "progress",
      baseCents: Math.round(tR.taxableCents * 0.4),
      installmentIdx: 1,
      desc: "Certificación 50% de obra",
      worksAddress: pRoca.street,
    });
    erp.recordCollection({
      partyId: cRoca.id,
      amountCents: Math.round(invR2.totalCents / 2),
      method: "transfer",
      allocations: [{ invoiceId: invR2.id, amountCents: Math.round(invR2.totalCents / 2) }],
    });

    /* ---- P2: Fachada Balmes — contract signed, works NOT started (start-date risk) ---- */
    erp.setToday("2026-04-02");
    const oBal = erp.addOpportunity({
      partyId: cBalmes.id,
      propertyId: pBalmes.id,
      source: "propertyManager",
      requestedWork: "Rehabilitación de fachada",
      expectedValue: 6200000,
    });
    erp.addVisit({
      opportunityId: oBal.id,
      measurements: [{ what: "fachada", qty: 260, unit: "m2" }],
      photos: ["balmes-fachada.jpg"],
      notes: "Andamio necesario",
    });
    const bBal = budgetWith(
      cBalmes,
      pBalmes,
      "commercial",
      [
        [
          "Medios auxiliares",
          [
            {
              code: "M1",
              desc: "Andamio homologado, montaje y alquiler",
              unit: "pa",
              qtyMilli: 1000,
              priceCents: 780000,
              costCents: 520000,
              lumpSum: true,
              costSupplierId: supMat.id,
              costSourceRef: "Oferta AND-8",
            },
          ],
        ],
        [
          "Fachada",
          [
            {
              code: "FA1",
              desc: "Reparación de grietas y revoco monocapa",
              unit: "m2",
              qtyMilli: 260000,
              priceCents: 14500,
              costCents: 9200,
              costSupplierId: supMat.id,
              costSourceRef: "Oferta MV-77",
            },
          ],
        ],
        [
          "Pintura",
          [
            {
              code: "P1",
              itemId: items["PIN-001"].id,
              desc: "Pintura de fachada dos manos",
              unit: "m2",
              qtyMilli: 260000,
              priceCents: 850,
              costCents: 420,
            },
          ],
        ],
      ],
      { vatBp: 1000 },
    );
    erp.issueVersion(bBal.id, { channel: "email" });
    erp.setToday("2026-04-20");
    erp.acceptVersion(bBal.id, erp.currentVersion(bBal.id).id, { evidenceRef: "acta-junta.pdf" });
    const tB = erp.budgetTotals(bBal.id, bBal.acceptedVersionId);
    const conB = erp.createContract(bBal.id, {
      installments: [
        { pct: 30, trigger: "onSignature", expectedDate: "2026-04-25" },
        { pct: 50, trigger: "atStage", stageRef: "50% fachada", expectedDate: "2026-06-20" },
        { pct: 20, trigger: "onCompletion", expectedDate: "2026-07-25" },
      ],
      duration: {
        estimatedDays: 70,
        plannedStart: "2026-05-05",
        plannedFinish: "2026-07-20",
        actualStart: null,
        actualFinish: null,
        deviationReason: null,
      },
      guarantees: [
        { category: "executionAndFinishes", months: 12 },
        { category: "installations", months: 24 },
        { category: "structural", months: 120 },
      ],
    });
    erp.setToday("2026-04-25");
    erp.signContract(conB.id, { method: "physical" });
    const prjB = erp.createProjectFromAcceptance(bBal.id);
    prjB.dates.targetEnd = "2026-07-25";
    const depB = erp.issueInvoice({
      projectId: prjB.id,
      kind: "deposit",
      baseCents: Math.round(tB.taxableCents * 0.3),
      installmentIdx: 0,
      desc: "Anticipo 30% según contrato",
      worksAddress: pBalmes.street,
    });
    erp.recordFirstPayment(conB.id); // committed start = +15 days → at-risk alert while unstarted

    /* ---- P3: Local Gràcia — budget ISSUED with a pending line, awaiting decision ---- */
    erp.setToday("2026-04-10");
    const oNou = erp.addOpportunity({
      partyId: cNou.id,
      propertyId: pNou.id,
      source: "website",
      requestedWork: "Adecuación de local comercial",
      expectedValue: 3800000,
    });
    erp.addVisit({
      opportunityId: oNou.id,
      measurements: [{ what: "local", qty: 140, unit: "m2" }],
      photos: ["verdi-local.jpg"],
      notes: "Licencia de actividad en trámite",
    });
    const bNou = budgetWith(
      cNou,
      pNou,
      "commercial",
      [
        [
          "Demoliciones",
          [
            {
              code: "D1",
              itemId: items["DEM-001"].id,
              desc: "Demolición interior completa",
              unit: "m2",
              qtyMilli: 140000,
              priceCents: 1600,
              costCents: 950,
            },
          ],
        ],
        [
          "Instalaciones",
          [
            {
              code: "I1",
              itemId: items["ELE-020"].id,
              desc: "Instalación eléctrica completa",
              unit: "ud",
              qtyMilli: 48000,
              priceCents: 4600,
              costCents: 2600,
              costSupplierId: supElec.id,
              costSourceRef: "Oferta EB-131",
            },
          ],
        ],
        [
          "Carpintería",
          [
            {
              code: "C1",
              itemId: items["CAR-030"].id,
              desc: "Puertas y frentes lacados",
              unit: "ud",
              qtyMilli: 6000,
              priceCents: 24500,
              costCents: 13900,
              costSupplierId: supMat.id,
              costSourceRef: "Albarán 2026-0141",
            },
          ],
        ],
      ],
      { vatBp: 2100, validityDate: "2026-08-15" },
    );
    const chPendN = erp.currentVersion(bNou.id).chapters[1];
    erp.addLine(bNou.id, chPendN.id, {
      code: "I9",
      desc: "Climatización — pendiente de oferta del industrial",
      unit: "pa",
      qtyMilli: 1000,
      priceCents: 320000,
      costCents: 210000,
      lumpSum: true,
      pending: true,
    }); // PRE-04 pending
    erp.issueVersion(bNou.id, { channel: "email" }); // issued with pending → alert

    /* ---- P4: Tratamiento antihumedad Ferrer — closed profitable job (damp line) ---- */
    erp.setToday("2026-03-06");
    const oFer = erp.addOpportunity({
      partyId: cFerrer.id,
      propertyId: pFerrer.id,
      source: "leadPlatform",
      requestedWork: "Tratamiento de humedades por capilaridad",
      expectedValue: 480000,
    });
    erp.addVisit({
      opportunityId: oFer.id,
      measurements: [{ what: "muro afectado", qty: 18, unit: "ml" }],
      photos: ["humedad-01.jpg"],
      notes: "Humedad de capilaridad en PB",
    });
    const bFer = budgetWith(
      cFerrer,
      pFerrer,
      "damp",
      [
        [
          "Tratamiento antihumedad",
          [
            {
              code: "H1",
              itemId: items["HUM-201"].id,
              desc: "Inyección perimetral + saneado y pintura anti-moho",
              unit: "ml",
              qtyMilli: 18000,
              priceCents: 24000,
              costCents: 13800,
              costSupplierId: supMat.id,
              costSourceRef: "Oferta HUM-12",
            },
          ],
        ],
      ],
      { vatBp: 1000 },
    );
    erp.issueVersion(bFer.id, { channel: "whatsapp" });
    erp.setToday("2026-03-10");
    erp.acceptVersion(bFer.id, erp.currentVersion(bFer.id).id, { evidenceRef: "whatsapp-ok.png" });
    const conF = erp.createContract(bFer.id, {
      installments: [
        { pct: 50, trigger: "onSignature", expectedDate: "2026-03-12" },
        { pct: 50, trigger: "onCompletion", expectedDate: "2026-03-28" },
      ],
      duration: {
        estimatedDays: 10,
        plannedStart: "2026-03-16",
        plannedFinish: "2026-03-27",
        actualStart: null,
        actualFinish: null,
        deviationReason: null,
      },
      guarantees: [{ category: "executionAndFinishes", months: 24 }],
    });
    erp.setToday("2026-03-12");
    erp.signContract(conF.id, { method: "digital" });
    const prjF = erp.createProjectFromAcceptance(bFer.id);
    const tF = erp.budgetTotals(bFer.id, bFer.acceptedVersionId);
    const invF1 = erp.issueInvoice({
      projectId: prjF.id,
      kind: "deposit",
      baseCents: Math.round(tF.taxableCents * 0.5),
      installmentIdx: 0,
      desc: "Anticipo 50%",
      worksAddress: pFerrer.street,
    });
    erp.recordFirstPayment(conF.id);
    erp.recordCollection({
      partyId: cFerrer.id,
      amountCents: invF1.totalCents,
      method: "transfer",
      allocations: [{ invoiceId: invF1.id, amountCents: invF1.totalCents }],
    });
    erp.setToday("2026-03-16");
    erp.startWorks(prjF.id);
    const bF1 = erp.registerBill({
      supplierId: supMat.id,
      number: "MV-1990",
      baseCents: 92000,
      vatBp: 2100,
      allocations: [{ projectId: prjF.id, chapterNum: "1", kind: "material", amountCents: 92000 }],
    });
    erp.payBills({
      amountCents: bF1.totalCents,
      method: "transfer",
      billAllocations: [{ billId: bF1.id, amountCents: bF1.totalCents }],
    });
    erp.recordHours({ workerId: w1.id, projectId: prjF.id, chapterNum: "1", hoursMilli: 26000 });
    erp.setToday("2026-03-27");
    erp.markProgress(prjF.id, "1", "done");
    const billing = erp.projectBilling(prjF.id);
    const invF2 = erp.issueInvoice({
      projectId: prjF.id,
      kind: "final",
      baseCents: Math.round(billing.remainingToInvoiceCents / 1.1),
      installmentIdx: 1,
      desc: "Liquidación final tratamiento",
      worksAddress: pFerrer.street,
    });
    erp.recordCollection({
      partyId: cFerrer.id,
      amountCents: invF2.totalCents,
      method: "transfer",
      allocations: [{ invoiceId: invF2.id, amountCents: invF2.totalCents }],
    });
    erp.closeProject(prjF.id);

    /* ---- P5: quick repair — invoiced, UNPAID and overdue (collections alert) ---- */
    erp.setToday("2026-04-03");
    const prjQ = erp.createQuickProject({
      partyId: cRoca.id,
      desc: "Reparación persiana y grifería",
      valueCents: 32000,
    });
    erp.recordHours({ workerId: w2.id, projectId: prjQ.id, chapterNum: "1", hoursMilli: 4000 });
    erp.issueInvoice({
      projectId: prjQ.id,
      kind: "final",
      baseCents: 32000,
      desc: "Reparación realizada",
      vatBp: 2100,
    });

    /* ---- P5: a budget still being written ----
       Every other budget here has been issued or accepted, which freezes it.
       A dataset in which nothing is editable makes the constructor of §3.3
       impossible to see, and a real pipeline always has one budget in
       preparation — so this one stays a draft. It is also the one that carries
       the graphic annex: two of its lines have reference pictures, which is
       exactly the case the annex exists for. */
    erp.setToday("2026-05-01");
    const oBorr = erp.addOpportunity({
      partyId: cRoca.id,
      propertyId: pRoca.id,
      source: "referrer",
      requestedWork: "Segunda fase: salón y pasillo",
      expectedValue: 1850000,
    });
    erp.addVisit({
      opportunityId: oBorr.id,
      measurements: [
        { what: "Salón", qty: 28, unit: "m2" },
        { what: "Pasillo", qty: 9, unit: "m2" },
      ],
      photos: ["visita-salon-1.jpg", "visita-pasillo-1.jpg"],
      notes: "Suelo original recuperable en el pasillo; el salón necesita nivelación.",
    });
    const bBorr = budgetWith(
      cRoca,
      pRoca,
      "renovation",
      [
        [
          "Pavimentos",
          [
            {
              code: "P1",
              itemId: items["ALB-010"].id,
              desc: "Nivelación y pavimento cerámico salón",
              customerWording: "Nivelación del suelo y pavimento cerámico en salón",
              unit: "m2",
              qtyMilli: 28000,
              priceCents: 4200,
              costCents: 2650,
              imageRefs: [
                {
                  id: "img_seed_pav_1",
                  storageKey: "seed_img_pavimento",
                  caption: "Acabado de referencia acordado en la visita",
                  source: "visit",
                  internal: false,
                  mime: "image/png",
                  sizeBytes: 0,
                  width: 0,
                  height: 0,
                },
                {
                  id: "img_seed_pav_2",
                  storageKey: "seed_img_estado",
                  caption: "Estado actual antes de la nivelación",
                  source: "visit",
                  internal: false,
                  mime: "image/png",
                  sizeBytes: 0,
                  width: 0,
                  height: 0,
                },
              ],
            },
          ],
        ],
        [
          "Pintura",
          [
            {
              code: "PI1",
              itemId: items["PIN-001"].id,
              desc: "Pintura plástica salón y pasillo",
              unit: "m2",
              qtyMilli: 96000,
              priceCents: 780,
              costCents: 430,
              imageRefs: [
                {
                  id: "img_seed_pin_1",
                  storageKey: "seed_img_pintura",
                  caption: "Carta de color elegida",
                  source: "catalogue",
                  internal: false,
                  mime: "image/png",
                  sizeBytes: 0,
                  width: 0,
                  height: 0,
                },
                {
                  id: "img_seed_pin_2",
                  storageKey: "seed_img_interna",
                  caption: "Detalle del encuentro con el rodapié (nota interna)",
                  source: "upload",
                  internal: true,
                  mime: "image/png",
                  sizeBytes: 0,
                  width: 0,
                  height: 0,
                },
              ],
            },
          ],
        ],
      ],
      { vatBp: 2100, validityDate: "2026-06-30" },
    );
    void bBorr;

    /* ---- open items that feed the day views & exception lists ---- */
    erp.setToday("2026-05-02");
    erp.addOpportunity({
      partyId: cIncompleta.id,
      source: "wordOfMouth",
      requestedWork: "Goteras en terraza",
      jobSize: "small",
    }); // awaiting visit
    const capPend = erp.captureDocument({
      docType: "ticket",
      imageRef: "ticket-gasolinera.jpg",
      machineReadable: false,
      keyFields: { concepto: "Combustible furgoneta" },
    }); // captured, unvalidated
    erp.registerBill({
      supplierId: supElec.id,
      number: "EB-3301",
      baseCents: 148000,
      vatBp: 2100,
      allocations: [],
    }); // unallocated bill → exception
    erp
      .importMovements(bank.id, [
        {
          accountingDate: "2026-04-30",
          concept: "COMPRA TARJETA",
          merchantText: "LEROY MERLIN CORNELLA",
          amountCents: -23470,
          card: "V-1234",
        }, // unallocated → exception
        { accountingDate: "2026-04-28", concept: "NOMINAS", amountCents: -860000 },
        { accountingDate: "2026-04-30", concept: "TRASPASO A CAJA", amountCents: -20000 },
      ])
      .forEach((m, i) => {
        if (i === 1) erp.classifyMovement(m.id, "salary");
        if (i === 2) erp.classifyMovement(m.id, "internalTransfer");
      });
    erp.recordCashMovement(till.id, {
      accountingDate: "2026-05-02",
      concept: "Compra pequeño material",
      amountCents: -4200,
    }); // cash without doc → flagged

    /* ---- §5.3: statement lines the reconciliation screen has to explain ----
       Three deliberate shapes, because a screen with nothing to match on is a
       screen nobody can judge:
         1. a customer transfer quoting its invoice number — the one-click case;
         2. a supplier payment quoting its bill number — same, other direction;
         3. an equal-and-opposite pair across two accounts — an internal
            transfer, which counts as income AND expense until it is spotted.
       All three arrive UNCLASSIFIED, exactly as a bank hands them over. */
    erp.importMovements(bank.id, [
      {
        accountingDate: "2026-05-02",
        concept: "TRANSFERENCIA RECIBIDA FAC-2026-0002",
        counterparty: "COMUNIDAD BALMES 44",
        amountCents: 98888,
      },
      {
        accountingDate: "2026-05-04",
        concept: "TRANSF /FRA EB-3301",
        counterparty: "ELECTROBAIX SL",
        amountCents: -179080,
      },
      { accountingDate: "2026-05-04", concept: "TRASPASO ENTRE CUENTAS", amountCents: -60000 },
    ]);
    erp.importMovements(till.id, [
      { accountingDate: "2026-05-04", concept: "TRASPASO RECIBIDO", amountCents: 60000 },
    ]);
    erp.registerBill({
      supplierId: supArch.id,
      number: "NC-88",
      baseCents: 84000,
      vatBp: 2100,
      allocations: [{ projectId: prjB.id, chapterNum: "1", kind: "other", amountCents: 84000 }],
    }); // 15% IRPF retained
    erp.addTask({
      owner: "operations",
      due: "2026-05-04",
      title: "Visita goteras Sra. García",
      relatedRef: "oportunidad",
    });
    erp.addTask({
      owner: "backoffice",
      due: "2026-05-03",
      title: "Reclamar factura reparación Roca",
      relatedRef: "factura",
    });

    /* ---- §5.7: the starting template library and one rule per family ----
       A communications screen with an empty library teaches nothing: the
       question it has to answer is "what would go out, to whom, and when",
       and that needs something to look at. Every rule below is mode:"draft"
       — the shipped default — so the queue fills with things awaiting a
       person, which is the behaviour §5.7 asks for and the mandate requires
       (nothing is ever sent from here). */
    [
      {
        key: "quote-followup",
        label: "Seguimiento de presupuesto",
        family: "comercial",
        subject: "Su presupuesto {{number}}",
        body: "Hola {{cliente}},\n\n¿Ha podido revisar el presupuesto {{number}}? Quedamos a su disposición para cualquier ajuste.\n\nUn saludo,\nCanei Subirats",
        attach: "budget",
      },
      {
        key: "invoice-reminder",
        label: "Recordatorio de factura vencida",
        family: "cobros",
        subject: "Factura {{number}} pendiente",
        body: "Hola {{cliente}},\n\nLa factura {{number}}, por importe de {{importe}} €, figura pendiente en nuestros registros. Si ya la ha abonado, indíquenoslo y la conciliamos.\n\nGracias,\nCanei Subirats",
        attach: "invoice",
      },
      {
        key: "works-start",
        label: "Aviso de inicio de obra",
        family: "obra",
        subject: "Comenzamos su obra el {{fecha}}",
        body: "Hola {{cliente}},\n\nConfirmamos el inicio de los trabajos. El equipo llegará a primera hora y le informaremos del avance semanalmente.\n\nUn saludo,\nCanei Subirats",
      },
      {
        key: "docs-expired",
        label: "Documentación caducada",
        family: "proveedores",
        subject: "Documentación pendiente — {{number}}",
        body: "Buenos días,\n\nLa documentación asociada a {{number}} ({{oficio}}) figura caducada. Sin ella no es posible el acceso a obra.\n\nGracias,\nCanei Subirats",
      },
      {
        key: "warranty-followup",
        label: "Seguimiento posventa",
        family: "posventa",
        subject: "¿Todo correcto tras la obra?",
        body: "Hola {{cliente}},\n\nHa pasado un tiempo desde que terminamos. ¿Está todo a su gusto? Cualquier detalle en garantía lo revisamos sin coste.\n\nUn saludo,\nCanei Subirats",
      },
    ].forEach((t) => erp.addCommsTemplate(t, "seed"));
    [
      {
        label: "Seguir presupuesto a los 5 días",
        event: "quote-sent",
        template: "quote-followup",
        afterDays: 5,
      },
      {
        label: "Reclamar factura vencida a los 3 días",
        event: "invoice-overdue",
        template: "invoice-reminder",
        afterDays: 3,
      },
      {
        label: "Reclamar documentación a subcontrata",
        event: "subcontractor-docs-expired",
        template: "docs-expired",
        recipient: "supplier",
      },
    ].forEach((r) => erp.addCommsRule(r, "seed"));

    /* ---- A CURRENT project with the whole §4 chain on it ------------------
       The §4 screens (Compras, Subcontratos, Modificaciones, Horas) are scoped
       to the selected project, so a rich two-year history behind closed jobs
       still leaves them looking empty on the project the app opens with.
       Balmes carries the full chain instead: an order received, an awarded
       trade with valid paperwork and a certification, an approved extra, and
       four weeks of booked hours.

       Deliberately NOT the default project. P-2026-0001 sorts first and is
       what the browser suite drives, and several of those checks take "the
       first purchase order" or "the first subcontract" on screen — seeding
       records there would silently change which row they grab. Balmes is one
       click away in the project selector and carries no such coupling. */
    erp.setToday("2026-04-06");
    erp.startWorks(prjB.id, "operations");
    const puB = erp.addPurchase({
      supplierId: supMat.id,
      projectId: prjB.id,
      chapterNum: "2",
      desc: "Mortero monocapa y malla para fachada",
      qtyMilli: 1000,
      unitCents: 486000,
      totalCents: 486000,
    });
    erp.sendPurchase(puB.id, "backoffice");
    erp.setToday("2026-04-08");
    erp.acceptPurchase(puB.id, { expectedArrival: "2026-04-14" }, "backoffice");
    erp.setToday("2026-04-14");
    erp.receivePurchase(puB.id, { qtyMilli: 1000, docRef: "ALB-MV-4471" }, "operations");

    erp.setToday("2026-04-07");
    const scB = erp.addSubcontract(
      prjB.id,
      {
        supplierId: supElec.id,
        trade: "Electricidad — iluminación de fachada",
        chapterNum: "2",
        awardedCents: 640000,
        retentionPct: 5,
        retentionReleaseDate: "2027-01-25",
      },
      "backoffice",
    );
    ["insurance", "prl", "socialSecurity"].forEach((kind) =>
      erp.renewSubcontractDoc(
        scB.id,
        { kind, expiresOn: "2027-03-31", docRef: kind + "-electrobaix.pdf" },
        "backoffice",
      ),
    );
    erp.sendSubcontract(scB.id, "backoffice");
    erp.acceptSubcontract(
      scB.id,
      { plannedStart: "2026-04-20", plannedEnd: "2026-07-10" },
      "backoffice",
    );
    erp.setToday("2026-04-20");
    erp.markSubcontractStarted(scB.id, "operations");
    erp.setToday("2026-04-30");
    erp.certifySubcontract(
      scB.id,
      { amountCents: 210000, note: "Primera certificación — planta baja" },
      "backoffice",
    );

    erp.setToday("2026-04-21");
    const chB = erp.addChange(
      prjB.id,
      {
        desc: "Sustitución de bajantes vistas detectada al retirar el revestimiento",
        chapterNum: "2",
        origin: "siteFinding",
      },
      "operations",
    );
    erp.priceChange(chB.id, 384000, 246000, 4, "backoffice");
    erp.sendChange(chB.id, "backoffice");
    erp.setToday("2026-04-24");
    erp.approveChange(chB.id, "adenda-balmes-01.pdf", "backoffice");

    [w1, w2].forEach((w) =>
      erp.assignResource(
        prjB.id,
        { workerId: w.id, from: "2026-04-06", to: "2026-07-25" },
        "backoffice",
      ),
    );
    // The last two land in the week the demo opens on: the weekly grid shows
    // the CURRENT week, so hours booked only in April would leave it looking
    // empty on a screen that is meant to show a crew at work.
    ["2026-04-07", "2026-04-14", "2026-04-21", "2026-04-28", "2026-05-04", "2026-05-05"].forEach(
      (d, i) => {
        erp.setToday(d);
        [w1, w2].forEach((w) =>
          erp.recordHours(
            {
              workerId: w.id,
              projectId: prjB.id,
              chapterNum: i === 0 ? "1" : "2",
              date: d,
              hoursMilli: 8000,
            },
            "operations",
          ),
        );
      },
    );
    erp.setToday("2026-04-30");
    erp.markProgress(prjB.id, "1", "done", 100, "operations");
    erp.markProgress(prjB.id, "2", "inProgress", 35, "operations");

    /* ---- §2.1: a pinned project, and worker documentation with real dates ---- */
    erp.setProjectPriority(prjB.id, true, "seed");
    erp.addWorkerDoc(
      w1.id,
      { kind: "Carné de instalador eléctrico", expiresOn: "2026-04-28" },
      "seed",
    ); // already expired
    erp.addWorkerDoc(w2.id, { kind: "Reconocimiento médico", expiresOn: "2026-05-24" }, "seed"); // upcoming

    /* ---- §2.1: the alerts panel as a manager, not a read-only feed ----
       One of each action, so the demo shows a person actually working the
       list rather than just staring at it: assigned, snoozed with a reason,
       resolved with a note and evidence, and turned into a task. */
    {
      const open = erp.managedAlerts();
      const overdue = open.find((a) => a.code === "AR-OVERDUE");
      if (overdue) erp.assignAlert(overdue.key, "backoffice", "seed");
      const stale = open.find((a) => a.code === "OPP-STALE");
      if (stale)
        erp.snoozeAlert(
          stale.key,
          "2026-05-12",
          "Cliente de vacaciones — retomar a la vuelta",
          "seed",
        );
      const pending = open.find((a) => a.code === "QUO-PENDING-LINES");
      if (pending)
        erp.resolveAlert(
          pending.key,
          "La línea pendiente es un extra opcional que el cliente todavía está valorando; no bloquea el envío.",
          ["Captura del email del cliente confirmando que lo decide la semana que viene"],
          "seed",
        );
      const priceExpired = open.find((a) => a.code === "PRICE-EXPIRED");
      if (priceExpired)
        erp.convertAlertToTask(
          priceExpired.key,
          "Pedir tarifa actualizada al proveedor",
          "backoffice",
          "2026-05-08",
          "seed",
        );
      erp.updateAlertRule("AR-OVERDUE", { recipient: "backoffice", channel: "email" }, "seed");
    }

    erp.setToday(today || "2026-05-05");
    return erp;
  }

  return { build };
});

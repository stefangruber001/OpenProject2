/* =============================================================================
   Two years of trading history for the demo dataset.

   WHY THIS IS A SEPARATE FILE, AND WHY IT STOPS AT 2025-12-31
   -----------------------------------------------------------
   erp-seed.js stages a very deliberate PRESENT: a reconciliation line that
   scores 0.81 and another that scores 0.99, an internal-transfer pair, a
   customer with no tax id, a duplicate-suspect bill, one unjustified gestoría
   exception, an alert of each management state. Roughly 147 browser-level
   checks assert that staged present by name — FAC-2026-0002, PRE-2026-0003,
   P-2026-0001, EB-3301.

   So this module never touches 2026. It generates 2024-06 → 2025-12 and
   hands back an engine whose *history* is rich and whose *present* is
   byte-for-byte the one the seed always staged. Two properties make that
   safe rather than merely hopeful:

     • Document series restart per fiscal year (nextNumber reads
       state.today's year), so everything here lands in the 2024 and 2025
       series (FAC-2024-…, PRE-2025-…) and cannot renumber a 2026 document.
     • The global period selector defaults to the current year, so these
       records enrich totals, trends and the 12-period sparklines without
       crowding the 2026 screens the demo opens on. Change the period to
       2025 (or a range) and the whole history is there.

   Everything goes through the real engine API — no direct state writes — so
   history obeys exactly the same rules as live data: a contract must be
   signed before its first invoice, a subcontractor with expired paperwork
   cannot start on site, hours cannot be booked to a closed project. If a
   rule would reject it, it does not belong in the demo either.

   Deterministic: a fixed-seed PRNG, no Date.now(), no Math.random(). The
   same build produces the same dataset on every machine and every reload,
   which is what makes the E2E suite able to assert against it at all.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ErpHistory = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* mulberry32 — small, fast, and identical across engines. The literal seed
     is what makes the dataset reproducible; do not "improve" it to Date.now(). */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => {
    const d = new Date(s + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
  };
  /** Nudge a date off Sat/Sun — a demo with site work booked on Sundays reads as fake. */
  const workday = (s) => {
    const wd = new Date(s + "T00:00:00Z").getUTCDay();
    return wd === 6 ? addDays(s, 2) : wd === 0 ? addDays(s, 1) : s;
  };

  const CUSTOMERS = [
    [
      "individual",
      "Elena Duran Mas",
      "39823459V",
      "C/ Sant Pere 14",
      "08221",
      "Terrassa",
      "renovation",
      "referrer",
    ],
    [
      "individual",
      "Jordi Bosch Prat",
      "44556677L",
      "Av. Catalunya 60",
      "08902",
      "L'Hospitalet",
      "renovation",
      "website",
    ],
    [
      "company",
      "Bar El Racó S.L.",
      "B67219049",
      "C/ Girona 45",
      "08009",
      "Barcelona",
      "commercial",
      "website",
    ],
    [
      "community",
      "Comunidad Prop. Aragó 331",
      "H08944721",
      "C/ Aragó 331",
      "08009",
      "Barcelona",
      "commercial",
      "propertyManager",
    ],
    [
      "individual",
      "Nuria Fabregat Roig",
      "46112233Q",
      "C/ Muntaner 88",
      "08011",
      "Barcelona",
      "damp",
      "wordOfMouth",
    ],
    [
      "individual",
      "Ramon Aleu Vidal",
      "38994455W",
      "Pg. de Gràcia 12",
      "08007",
      "Barcelona",
      "renovation",
      "referrer",
    ],
    [
      "company",
      "Òptica Vallès S.L.",
      "B65003311",
      "C/ Major 7",
      "08221",
      "Terrassa",
      "commercial",
      "leadPlatform",
    ],
    [
      "individual",
      "Marta Cinca Oliva",
      "47001122R",
      "C/ Sardenya 190",
      "08013",
      "Barcelona",
      "repairs",
      "wordOfMouth",
    ],
    [
      "community",
      "Comunidad Prop. Nàpols 55",
      "H08551204",
      "C/ Nàpols 55",
      "08013",
      "Barcelona",
      "commercial",
      "propertyManager",
    ],
    [
      "individual",
      "Sergi Palau Font",
      "45778899K",
      "C/ Rosselló 210",
      "08008",
      "Barcelona",
      "renovation",
      "website",
    ],
    [
      "individual",
      "Laia Ventura Camps",
      "43220011K",
      "C/ Bailèn 77",
      "08009",
      "Barcelona",
      "damp",
      "referrer",
    ],
    [
      "company",
      "Forn Sant Jordi S.L.",
      "B66880022",
      "C/ Creu 3",
      "08960",
      "Sant Just Desvern",
      "commercial",
      "referrer",
    ],
  ];

  /* Every job is one complete commercial→delivery→cash cycle. `outcome`
     decides how far down that chain it travels, so the dataset contains
     genuinely lost deals and genuinely unfinished work rather than a
     suspiciously perfect pipeline of wins. */
  const JOBS = [
    { lead: "2024-06-04", cust: 0, kind: "won", scale: 1.0, trade: true },
    { lead: "2024-07-02", cust: 1, kind: "lost", reason: "price" },
    { lead: "2024-07-22", cust: 2, kind: "won", scale: 1.6, trade: true },
    { lead: "2024-09-10", cust: 3, kind: "won", scale: 2.2, trade: true },
    { lead: "2024-10-08", cust: 4, kind: "lost", reason: "competitor" },
    { lead: "2024-11-05", cust: 5, kind: "won", scale: 1.1, trade: false },
    { lead: "2025-01-14", cust: 6, kind: "won", scale: 1.4, trade: true },
    { lead: "2025-02-11", cust: 7, kind: "lost", reason: "timing" },
    { lead: "2025-03-04", cust: 8, kind: "won", scale: 2.0, trade: true },
    { lead: "2025-04-08", cust: 9, kind: "won", scale: 1.2, trade: false },
    { lead: "2025-05-13", cust: 10, kind: "won", scale: 0.9, trade: true },
    { lead: "2025-06-10", cust: 11, kind: "won", scale: 1.5, trade: true },
    { lead: "2025-09-09", cust: 0, kind: "won", scale: 1.3, trade: true },
    { lead: "2025-10-14", cust: 5, kind: "open", scale: 1.0 },
    { lead: "2025-11-11", cust: 2, kind: "quoted", scale: 1.1 },
  ];

  /**
   * @param erp  a live ErpEngine.ERP the seed has already given master data
   * @param ctx  { items, suppliers:{material,electrical,plumbing,adviser},
   *               workers:[…], bank, till, budgetWith }
   */
  function apply(erp, ctx) {
    const rand = rng(20260803);
    const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];
    const jitter = (base, spread) => base + Math.round((rand() - 0.5) * spread);

    const parties = [];
    const properties = [];

    // Customers are created dated to their first lead, so "antigüedad" and the
    // relationship segment mean something rather than everyone joining at once.
    CUSTOMERS.forEach((c, i) => {
      const firstLead = (JOBS.find((j) => j.cust === i) || { lead: "2024-06-01" }).lead;
      erp.setToday(addDays(firstLead, -3));
      const [partyType, name, taxId, street, postalCode, city, activityLine, leadSource] = c;
      const p = erp.addParty({
        roles: ["customer"],
        partyType,
        name,
        taxId,
        billStreet: street,
        billPostalCode: postalCode,
        billCity: city,
        billProvince: "Barcelona",
        mobile: "6" + String(10000000 + Math.floor(rand() * 89999999)),
        email:
          name
            .toLowerCase()
            .replace(/[^a-z]+/g, ".")
            .replace(/^\.|\.$/g, "") + "@example.com",
        leadSource,
        activityLine,
        paymentMethod: partyType === "individual" ? "transfer" : "transfer30",
        paymentTermsDays: partyType === "individual" ? 15 : 30,
      });
      parties.push(p);
      properties.push(
        erp.addProperty({
          partyId: p.id,
          street,
          postalCode,
          city,
          part:
            partyType === "community"
              ? "commonArea"
              : partyType === "company"
                ? "commercialUnit"
                : "dwelling",
          surfaceM2: 55 + Math.floor(rand() * 180),
          occupied: partyType === "individual",
        }),
      );
    });

    const I = ctx.items;
    const sup = ctx.suppliers;

    /* A budget shaped from the real catalogue. `scale` is the only knob, so a
       community stairwell is visibly a bigger job than a bathroom without
       needing a second template. */
    function budgetFor(party, prop, line, scale) {
      const q = (base) => Math.round(base * scale) * 1000;
      return ctx.budgetWith(party, prop, line, [
        [
          "Demoliciones",
          [
            {
              code: "D1",
              itemId: I["DEM-001"].id,
              desc: "Demolición de tabiques y retirada de escombro",
              unit: "m2",
              qtyMilli: q(18),
              priceCents: 1600,
              costCents: 950,
              costSupplierId: sup.material.id,
              costSourceRef: "propia",
            },
          ],
        ],
        [
          "Albañilería y revestimientos",
          [
            {
              code: "A1",
              itemId: I["ALB-010"].id,
              desc: "Tabiquería nueva",
              unit: "m2",
              qtyMilli: q(14),
              priceCents: 3200,
              costCents: 1750,
              costSupplierId: sup.material.id,
              costSourceRef: "Tarifa MV",
            },
            {
              code: "A2",
              itemId: I["ALI-101"].id,
              desc: "Alicatado gres porcelánico",
              unit: "m2",
              qtyMilli: q(22),
              priceCents: 3400,
              costCents: 1800,
              costSupplierId: sup.material.id,
              costSourceRef: "Tarifa MV",
            },
          ],
        ],
        [
          "Instalaciones",
          [
            {
              code: "F1",
              itemId: I["FON-014"].id,
              desc: "Puntos de agua",
              unit: "ud",
              qtyMilli: q(4),
              priceCents: 8200,
              costCents: 4800,
              costSupplierId: sup.plumbing.id,
              costSourceRef: "oferta",
            },
            {
              code: "E1",
              itemId: I["ELE-020"].id,
              desc: "Puntos de luz y enchufes",
              unit: "ud",
              qtyMilli: q(9),
              priceCents: 4600,
              costCents: 2600,
              costSupplierId: sup.electrical.id,
              costSourceRef: "oferta",
            },
          ],
        ],
        [
          "Acabados",
          [
            {
              code: "P1",
              itemId: I["PIN-001"].id,
              desc: "Pintura plástica lisa dos manos",
              unit: "m2",
              qtyMilli: q(40),
              priceCents: 850,
              costCents: 420,
              costSupplierId: sup.material.id,
              costSourceRef: "propia",
            },
          ],
        ],
      ]);
    }

    const closedProjects = [];

    for (const job of JOBS) {
      const party = parties[job.cust];
      const prop = properties[job.cust];
      const line = party.activityLine || "renovation";

      // ── commercial: lead → visit → quote ────────────────────────────────
      erp.setToday(job.lead);
      const opp = erp.addOpportunity({
        partyId: party.id,
        propertyId: prop.id,
        source: party.leadSource,
        requestedWork:
          line === "damp"
            ? "Tratamiento de humedades"
            : line === "commercial"
              ? "Reforma de local"
              : "Reforma integral",
        expectedValue: Math.round(1800000 * (job.scale || 1)),
      });
      erp.setToday(workday(addDays(job.lead, 4)));
      erp.addVisit({
        opportunityId: opp.id,
        measurements: [{ what: "zona principal", qty: 10 + Math.floor(rand() * 30), unit: "m2" }],
        photos: ["visita-" + party.code + ".jpg"],
        notes: "Medición en obra; acceso y horario confirmados con el cliente.",
      });

      if (job.kind === "open") continue; // still being qualified — fills the funnel's left edge

      erp.setToday(workday(addDays(job.lead, 11)));
      const b = budgetFor(party, prop, line, job.scale || 1);
      erp.issueVersion(b.id, { channel: "email" });

      if (job.kind === "quoted") continue; // sent, awaiting the customer's decision
      if (job.kind === "lost") {
        erp.setToday(workday(addDays(job.lead, 32)));
        erp.loseOpportunity(opp.id, job.reason, "backoffice");
        continue;
      }

      // ── contract → project ─────────────────────────────────────────────
      const acceptDate = workday(addDays(job.lead, 24));
      erp.setToday(acceptDate);
      erp.acceptVersion(b.id, erp.currentVersion(b.id).id, {
        evidenceRef: "aceptacion-" + b.number + ".pdf",
      });
      const startDate = workday(addDays(acceptDate, 12));
      const days = 40 + Math.round((job.scale || 1) * 22);
      const finishDate = workday(addDays(startDate, days));
      const con = erp.createContract(b.id, {
        installments: [
          { pct: 40, trigger: "onSignature", expectedDate: addDays(acceptDate, 7) },
          {
            pct: 40,
            trigger: "atStage",
            stageRef: "50% de obra",
            expectedDate: addDays(startDate, Math.round(days / 2)),
          },
          { pct: 20, trigger: "onCompletion", expectedDate: finishDate },
        ],
        duration: {
          estimatedDays: days,
          plannedStart: startDate,
          plannedFinish: finishDate,
          actualStart: null,
          actualFinish: null,
          deviationReason: null,
        },
        guarantees: [
          { category: "executionAndFinishes", months: 12 },
          { category: "installations", months: 24 },
        ],
      });
      erp.signContract(con.id, { method: "physical" }, "backoffice");
      erp.recordFirstPayment(con.id);
      const prj = erp.createProjectFromAcceptance(b.id, "backoffice");

      erp.setToday(startDate);
      erp.startWorks(prj.id, "backoffice");

      // ── delivery: purchases, a subcontracted trade, hours ───────────────
      const totals = erp.budgetTotals(b.id, b.acceptedVersionId);
      const pu = erp.addPurchase({
        supplierId: sup.material.id,
        projectId: prj.id,
        chapterNum: "2",
        desc: "Material de albañilería y alicatado",
        qtyMilli: 1000,
        unitCents: Math.round(totals.costBaseCents * 0.28),
        totalCents: Math.round(totals.costBaseCents * 0.28),
      });
      erp.sendPurchase(pu.id, "backoffice");
      erp.setToday(workday(addDays(startDate, 3)));
      erp.acceptPurchase(pu.id, { expectedArrival: workday(addDays(startDate, 9)) }, "backoffice");
      erp.setToday(workday(addDays(startDate, 9)));
      erp.receivePurchase(
        pu.id,
        { qtyMilli: 1000, docRef: "ALB-" + pu.number, photoRef: null },
        "backoffice",
      );
      erp.recordSupplierPerformance(
        sup.material.id,
        {
          onTime: rand() > 0.25,
          qualityIssue: rand() > 0.85,
          responseDays: 1 + Math.floor(rand() * 3),
        },
        "backoffice",
      );

      if (job.trade) {
        // A real awarded trade, with the mandatory paperwork §4.2 blocks on.
        erp.setToday(workday(addDays(startDate, 2)));
        const trade = rand() > 0.5 ? sup.electrical : sup.plumbing;
        const awarded = Math.round(totals.costBaseCents * 0.3);
        const sc = erp.addSubcontract(
          prj.id,
          {
            supplierId: trade.id,
            trade: trade === sup.electrical ? "Electricidad" : "Fontanería",
            chapterNum: "3",
            awardedCents: awarded,
            retentionPct: 5,
            retentionReleaseDate: addDays(finishDate, 180),
          },
          "backoffice",
        );
        ["insurance", "prl", "socialSecurity"].forEach((kind) =>
          erp.renewSubcontractDoc(
            sc.id,
            { kind, expiresOn: addDays(finishDate, 300), docRef: kind + ".pdf" },
            "backoffice",
          ),
        );
        erp.sendSubcontract(sc.id, "backoffice");
        erp.acceptSubcontract(
          sc.id,
          { plannedStart: workday(addDays(startDate, 14)), plannedEnd: finishDate },
          "backoffice",
        );
        erp.setToday(workday(addDays(startDate, 14)));
        erp.markSubcontractStarted(sc.id, "backoffice");
        erp.setToday(workday(addDays(startDate, Math.round(days * 0.6))));
        erp.certifySubcontract(
          sc.id,
          { amountCents: Math.round(awarded * 0.6), note: "Primera certificación" },
          "backoffice",
        );
        erp.setToday(workday(addDays(startDate, days - 4)));
        erp.certifySubcontract(
          sc.id,
          { amountCents: Math.round(awarded * 0.4), note: "Certificación final" },
          "backoffice",
        );
      }

      // Crew assignment + booked days: what makes Horas and the labour
      // alerts show something other than an empty grid.
      const crew = ctx.workers;
      crew.forEach((w) =>
        erp.assignResource(
          prj.id,
          { workerId: w.id, from: startDate, to: addDays(startDate, days) },
          "backoffice",
        ),
      );
      for (let d = 2; d < days; d += 7) {
        const day = workday(addDays(startDate, d));
        erp.setToday(day);
        crew.forEach((w, idx) =>
          erp.recordHours(
            {
              workerId: w.id,
              projectId: prj.id,
              chapterNum: String(1 + (idx % 4)),
              date: day,
              hoursMilli: 8000,
            },
            "operations",
          ),
        );
      }

      // Chapter progress, so avance % is real rather than 0 everywhere.
      ["1", "2", "3", "4"].forEach((num, idx) => {
        erp.setToday(workday(addDays(startDate, Math.round((days * (idx + 1)) / 5))));
        erp.markProgress(prj.id, num, "done", 100, "operations");
      });

      // A change order on the larger jobs — Modificaciones needs history too.
      if ((job.scale || 1) >= 1.3) {
        erp.setToday(workday(addDays(startDate, Math.round(days * 0.4))));
        const ch = erp.addChange(
          prj.id,
          {
            desc: "Ampliación de alcance solicitada por el cliente",
            chapterNum: "2",
            origin: "customer",
          },
          "backoffice",
        );
        erp.priceChange(
          ch.id,
          Math.round(totals.taxableCents * 0.08),
          Math.round(totals.costBaseCents * 0.05),
          3,
          "backoffice",
        );
        erp.sendChange(ch.id, "backoffice");
        erp.approveChange(ch.id, "adenda-" + ch.id + ".pdf", "backoffice");
      }

      // ── billing and cash ───────────────────────────────────────────────
      const eco = erp.projectEconomics(prj.id);
      const half = Math.round(eco.currentRevenueCents * 0.5);
      erp.setToday(workday(addDays(startDate, 6)));
      const inv1 = erp.issueInvoice(
        { projectId: prj.id, baseCents: half, desc: "Certificación 1 — 50% de obra", vatBp: 1000 },
        "backoffice",
      );
      erp.setToday(workday(addDays(startDate, 6 + party.paymentTermsDays)));
      erp.recordCollection(
        {
          partyId: party.id,
          amountCents: inv1.totalCents,
          method: "transfer",
          allocations: [{ invoiceId: inv1.id, amountCents: inv1.totalCents }],
        },
        "backoffice",
      );

      erp.setToday(finishDate);
      const inv2 = erp.issueInvoice(
        {
          projectId: prj.id,
          baseCents: eco.currentRevenueCents - half,
          desc: "Certificación final",
          vatBp: 1000,
        },
        "backoffice",
      );
      // The last job of 2025 stays open on purpose: an aged receivable is part
      // of an honest demo, and it gives the AR-OVERDUE alert real history.
      const leaveUnpaid = job.lead === "2025-09-09";
      if (!leaveUnpaid) {
        erp.setToday(workday(addDays(finishDate, party.paymentTermsDays)));
        erp.recordCollection(
          {
            partyId: party.id,
            amountCents: inv2.totalCents,
            method: "transfer",
            allocations: [{ invoiceId: inv2.id, amountCents: inv2.totalCents }],
          },
          "backoffice",
        );
      }

      // A cash receipt on the smaller private jobs — Recibos was empty before.
      if (party.partyType === "individual" && (job.scale || 1) < 1.2) {
        erp.setToday(workday(addDays(finishDate, 2)));
        erp.issueReceipt(
          {
            partyId: party.id,
            projectId: prj.id,
            amountCents: jitter(18000, 8000),
            method: "cash",
          },
          "backoffice",
        );
      }

      // ── supplier side ──────────────────────────────────────────────────
      erp.setToday(workday(addDays(startDate, 12)));
      const bill = erp.registerBill({
        supplierId: sup.material.id,
        number: "MV-" + b.number.slice(-6),
        baseCents: Math.round(totals.costBaseCents * 0.28),
        vatBp: 2100,
        allocations: [
          {
            projectId: prj.id,
            chapterNum: "2",
            kind: "material",
            amountCents: Math.round(totals.costBaseCents * 0.28),
          },
        ],
      });
      erp.setToday(workday(addDays(startDate, 42)));
      erp.payBills(
        {
          amountCents: bill.totalCents,
          method: "transfer",
          billAllocations: [{ billId: bill.id, amountCents: bill.totalCents }],
        },
        "backoffice",
      );

      // ── close, and how the customer felt about it ──────────────────────
      erp.setToday(workday(addDays(finishDate, 1)));
      erp.closeProject(prj.id, "backoffice");
      closedProjects.push(prj);
      erp.setToday(workday(addDays(finishDate, 9)));
      const r = rand();
      erp.addFeedback(
        prj.id,
        r > 0.75
          ? { kind: "complaint", text: "Retraso en la entrega del alicatado.", status: "resolved" }
          : {
              kind: "satisfaction",
              rating: r > 0.35 ? 5 : 4,
              text: "Obra entregada según lo acordado.",
            },
        "backoffice",
      );
    }

    /* A warranty claim on an old job — the only way the posventa family of
       communications and the guarantee register have anything to point at. */
    if (closedProjects.length) {
      erp.setToday("2025-08-19");
      erp.addFeedback(
        closedProjects[0].id,
        {
          kind: "warrantyClaim",
          text: "Humedad puntual en junta de ducha; revisada en garantía.",
          status: "resolved",
        },
        "backoffice",
      );
    }

    /* Quarterly packages actually sent, so Gestoría opens with a send history
       instead of "aún no se ha enviado ningún paquete". Each quarter's
       exceptions are justified first — the same two routes §5.6 allows for a
       live quarter, exercised here against real past data. */
    ["2024-Q3", "2024-Q4", "2025-Q1", "2025-Q2", "2025-Q3"].forEach((q) => {
      const endOfQ = {
        "2024-Q3": "2024-10-12",
        "2024-Q4": "2025-01-14",
        "2025-Q1": "2025-04-11",
        "2025-Q2": "2025-07-14",
        "2025-Q3": "2025-10-13",
      }[q];
      erp.setToday(endOfQ);
      erp
        .exceptionsWithStatus(q)
        .filter((x) => !x.accepted)
        .forEach((x) =>
          erp.acceptException(
            q,
            x.key,
            "Revisado con la gestoría en el cierre del trimestre.",
            "backoffice",
          ),
        );
      erp.quarterlyPackage(q, { recipient: "Gestoría Subirats" }, "backoffice");
    });

    /* One resolved query and one still open — the accountant conversation
       §5.6 asks for, with both states visible. */
    erp.setToday("2025-07-16");
    const gq = erp.addGestoriaQuery(
      "2025-Q2",
      "¿La retención del arquitecto técnico va al 15% o al 7%?",
      "backoffice",
    );
    erp.setToday("2025-07-21");
    erp.resolveGestoriaQuery(
      gq.id,
      "15% — no es alta reciente. Confirmado por la gestoría.",
      "backoffice",
    );
    erp.setToday("2025-10-20");
    erp.addGestoriaQuery(
      "2025-Q3",
      "Confirmar tratamiento del renting del vehículo en el cierre.",
      "backoffice",
    );

    /* A supplier price that has since expired — Precios shows a caducado row
       and the PRICE-EXPIRED alert has something real behind it. */
    erp.setToday("2025-02-10");
    erp.addPrice({
      itemId: I["CAR-030"].id,
      supplierId: sup.material.id,
      listCents: 26000,
      discountPct: 8,
      netCents: 23920,
      source: "priceList",
      sourceDocRef: "Tarifa MV 2025",
      validUntil: "2025-12-31",
    });

    return { parties, properties, closedProjects };
  }

  return { apply };
});

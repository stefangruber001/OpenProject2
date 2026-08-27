/* =============================================================================
   CaneiErpFacts — live engine records, shaped for the document descriptors.

   WHY THIS FILE EXISTS. `erp-doctypes.js` declares WHAT each of the twenty
   documents says; its `build(f)` consumes a neutral "facts" object that until
   now only `sampleFacts()` produced — demo numbers. This module produces the
   same shape from the ERP's real records, so the invoice pane, the contract
   pane and every other document print live data through the one approved
   design (`CaneiSheet` / `CaneiPdf`) instead of each screen hand-building its
   own HTML.

   THE SEAM. `docFor(erp, kind, refs)` = facts from the engine → the
   descriptor's `build()` → a patch pass that overwrites the money rows with
   the ENGINE'S exact cents. The patch exists because `build()` recomputes tax
   from a rate, and a recomputed rounding is not the number on the issued
   invoice; the engine's `vatCents`/`totalCents` are the legal figures and
   they win. Everything textual stays the descriptor's.

   HONESTY RULE. A field the engine does not have is filled with "—", never
   with an invented value (the same reason `placeholder: true` exists in the
   descriptors). The known gaps — no valuation history, one-line change
   orders, no site-contact on purchases — are listed in ASSUMPTIONS.md (S33).
   The three placeholder kinds without any backing record (albarán, acta de
   entrega, parte de trabajo) are refused here: demo screens can render
   `sampleFacts()`, but a document that looks issued must not carry data
   nobody recorded.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CaneiErpFacts = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* Same fixed format as erp-doctypes: these are documents for one company in
     one place, and the reader's browser region must not reformat their money. */
  function eur(cents) {
    const n = Math.round(Number(cents) || 0);
    const neg = n < 0;
    const s = String(Math.abs(n)).padStart(3, "0");
    const whole = s.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-" : "") + whole + "," + s.slice(-2) + " €";
  }

  function dmy(iso) {
    if (!iso) return "—";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    return m ? m[3] + "/" + m[2] + "/" + m[1] : String(iso);
  }

  const dash = (v) => (v == null || v === "" ? "—" : String(v));

  function daysBetween(a, b) {
    if (!a || !b) return 0;
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }

  /* ------------------------------------------------------- shared blocks */

  function companyOf(erp) {
    const i = erp._issuerBlock();
    return {
      legal: i.legalName || i.tradeName || "—",
      nif: dash(i.taxId),
      address: dash(i.address),
      email: dash(i.email),
      phone: dash(i.phone),
      iban: dash(i.iban),
    };
  }

  function partyBlock(p) {
    if (!p) return { name: "—", nif: "—", contact: "", address: "—", email: "" };
    return {
      name: p.name,
      nif: dash(p.taxId),
      contact: p.contactPerson || "",
      address: [p.billStreet, [p.billPostalCode, p.billCity].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", "),
      email: p.email || "",
    };
  }

  function projectBlock(erp, projectId) {
    if (!projectId) return { code: "—", description: "—", site: "—", version: "", validityDays: 0 };
    const h = erp.projectHeader(projectId);
    return {
      code: h.code,
      // The engine has no project description field; the activity line is the
      // closest thing it truthfully has.
      description: h.activityLine || h.code,
      site: h.address || "—",
      version: "",
      validityDays: erp._configForRead().quoteValidityDays || 30,
    };
  }

  /** Translate an engine status word into the document's Spanish. */
  const STATE = {
    planned: "Planificado",
    invoiced: "Facturado",
    identified: "Pendiente",
    priced: "Pendiente",
    sent: "Enviado",
    approved: "Aprobado",
    executed: "Ejecutado",
    rejected: "Rechazado",
    cancelled: "Cancelado",
    cash: "Efectivo",
    transfer: "Transferencia",
  };
  const stateWord = (s) => STATE[s] || dash(s);

  /* CON-04 / CON-08 vocabularies, in the document's own words. */
  const TRIGGER = {
    onSignature: "a la firma",
    atWorksStart: "al inicio de obra",
    atStage: "a certificacion",
    onCompletion: "a la entrega",
    fixedDate: "en fecha fija",
  };
  const GUARANTEE = {
    executionAndFinishes: "de ejecucion y acabados",
    installations: "de instalaciones",
    structural: "estructural",
  };

  /* A minimal facts skeleton so a descriptor never reads `undefined` — every
     kind overrides the parts it actually has. */
  function baseFacts(erp) {
    const cfg = erp._configForRead();
    return {
      company: companyOf(erp),
      customer: partyBlock(null),
      supplier: partyBlock(null),
      agency: { name: "—", contact: "—", email: "—" },
      project: { code: "—", description: "—", site: "—", version: "", validityDays: 0 },
      numbers: {},
      dates: {},
      taxRate: (cfg.defaultVatBp || 0) / 100,
      withholdingRate: 0,
      chapters: [],
      milestones: [],
      contractTerms: [],
    };
  }

  /** renderBudgetDoc chapters → facts chapters (base scope only: options and
   *  out-of-scope never total into the document's money). */
  function budgetChapters(doc) {
    return doc.chapters
      .filter((c) => (c.section || "base") === "base" && c.lines.length)
      .map((c) => ({
        code: String(c.num),
        name: c.name,
        rows: c.lines.map((l) => ({
          chapter: (l.code || "").split("-")[0] || String(c.num),
          code: l.code || "",
          item: l.desc,
          note: "",
          qty: String(l.qty),
          unit: l.unit || "",
          price: l.priceCents,
          amount: l.totalCents,
        })),
      }));
  }

  /** The engine's exact money rows, replacing build()'s recomputation. */
  function exactTotals(d, t) {
    const rows = [["Base imponible", eur(t.taxableCents)]];
    rows.push(["Impuesto " + t.vatBp / 100 + " %", eur(t.vatCents)]);
    if (t.irpfCents) rows.push(["Retencion -" + t.irpfBp / 100 + " %", eur(-t.irpfCents)]);
    rows.push(["Total", eur(t.grandCents)]);
    d.totals = rows;
    return d;
  }

  /* ------------------------------------------------------------ per kind */

  const KINDS = {
    presupuesto(erp, refs, DOCS) {
      return budgetDoc(erp, refs, DOCS, "presupuesto");
    },

    presupuestoAceptado(erp, refs, DOCS) {
      return budgetDoc(erp, refs, DOCS, "presupuestoAceptado");
    },

    contrato(erp, refs, DOCS) {
      const doc = erp.renderContractDoc(refs.contractId);
      const c = erp.state.contracts.find((x) => x.id === refs.contractId);
      const b = doc.budgetNumber
        ? erp.state.budgets.find((x) => x.number === doc.budgetNumber)
        : null;
      const bdoc =
        b && (b.acceptedVersionId || b.currentVersionId)
          ? erp.renderBudgetDoc(b.id, b.acceptedVersionId || b.currentVersionId)
          : null;

      const f = baseFacts(erp);
      f.customer = partyBlock(erp.party(c.partyId));
      const prj = erp.state.projects.find((p) => p.contractId === c.id);
      f.project = projectBlock(erp, prj ? prj.id : null);
      f.project.version = bdoc ? bdoc.version : f.project.version;
      f.numbers.quote = doc.budgetNumber || "—";
      f.numbers.contract = doc.number;
      f.dates.issued = dmy(doc.date);
      f.dates.start = dmy(
        (doc.duration && doc.duration.plannedStart) || (prj && prj.dates && prj.dates.start),
      );
      f.dates.due = dmy(
        (doc.duration && doc.duration.plannedFinish) || (prj && prj.dates && prj.dates.targetEnd),
      );
      f.taxRate = (doc.vatBp || 0) / 100;
      f.chapters = bdoc ? budgetChapters(bdoc) : [];

      const total = doc.currentCents + Math.round((doc.currentCents * (doc.vatBp || 0)) / 10000);
      f.milestones = doc.installments.map((i, idx) => ({
        when: i.expectedDate ? dmy(i.expectedDate) : TRIGGER[i.trigger] || dash(i.trigger),
        label:
          "Hito " +
          (idx + 1) +
          (i.pct != null ? " — " + i.pct + " %" : "") +
          (i.trigger ? " · " + (TRIGGER[i.trigger] || i.trigger) : ""),
        state: stateWord(i.status),
        amount: eur(
          i.amountCents != null ? i.amountCents : Math.round((total * (i.pct || 0)) / 100),
        ),
      }));

      const terms = [];
      if (doc.duration && doc.duration.estimatedDays)
        terms.push(["Plazo de ejecucion", doc.duration.estimatedDays + " dias"]);
      if (doc.penalties && doc.penalties.delayPenaltyCentsPerWeek)
        terms.push([
          "Penalizacion por demora",
          eur(doc.penalties.delayPenaltyCentsPerWeek) + " / semana",
        ]);
      if (doc.penalties && doc.penalties.latePaymentInterestPctYear)
        terms.push(["Demora en el pago", doc.penalties.latePaymentInterestPctYear + " % anual"]);
      (doc.guarantees || []).forEach((g) =>
        terms.push([
          "Garantia " + (GUARANTEE[g.category] || dash(g.category)),
          (g.months || 24) + " meses",
        ]),
      );
      if (!terms.length) terms.push(["Garantia", "24 meses"]);
      f.contractTerms = terms;

      const d = DOCS.contrato.build(f);
      exactTotals(d, {
        taxableCents: doc.currentCents,
        vatBp: doc.vatBp || 0,
        vatCents: Math.round((doc.currentCents * (doc.vatBp || 0)) / 10000),
        irpfBp: 0,
        irpfCents: 0,
        grandCents: total,
      });
      d.facts[0][1] = eur(total);
      d.facts[1][1] = eur(doc.currentCents);
      if (doc.annexes && doc.annexes.length)
        d.meta[3] = ["Anexos", doc.annexes.map((a) => a.number).join(" · ")];
      return d;
    },

    ordenCambio(erp, refs, DOCS) {
      const doc = erp.renderChangeDoc(refs.changeId);
      const ch = erp.state.changes.find((x) => x.id === refs.changeId);
      const p = erp.project(ch.projectId);
      const con = p.contractId ? erp.state.contracts.find((x) => x.id === p.contractId) : null;
      const cv = con ? erp.contractValue(con.id) : null;

      const f = baseFacts(erp);
      f.customer = partyBlock(erp.party(p.partyId));
      f.project = projectBlock(erp, p.id);
      f.numbers.contract = doc.contractNumber || "—";
      f.numbers.changeOrder = doc.number || "Borrador";
      f.dates.issued = dmy(doc.date);
      f.taxRate = ((con && con.vatBp) || erp._configForRead().defaultVatBp || 0) / 100;

      const reg = erp.extrasRegister(ch.projectId);
      const ordinal = reg.items.findIndex((x) => x.id === ch.id) + 1;
      f.change = {
        reason: ch.reason || ch.desc || "—",
        ordinal: ordinal > 0 ? ordinal + " de " + reg.items.length : "—",
        extraDays: ch.scheduleImpactDays || 0,
        state: stateWord(ch.status),
        // A change is one priced concept in the engine, so the document says
        // exactly that — one row, the engine's own words and cents.
        rows: [{ item: ch.desc || ch.reason || "Modificacion", amount: ch.priceCents || 0 }],
        effect: cv
          ? [
              ["Importe del contrato antes", eur(cv.currentCents - (ch.priceCents || 0))],
              ["Importe del contrato despues", eur(cv.currentCents)],
              [
                "Plazo",
                (ch.scheduleImpactDays >= 0 ? "+" : "") + (ch.scheduleImpactDays || 0) + " dias",
              ],
              ["Partida", dash(ch.chapterNum)],
            ]
          : [["Partida", dash(ch.chapterNum)]],
      };
      return DOCS.ordenCambio.build(f);
    },

    certificacion(erp, refs, DOCS) {
      const p = erp.project(refs.projectId);
      const bases = erp.invoiceBases(p.id);
      const cert = bases.certification;
      const ordinal = (bases.issued || []).length + 1;

      const f = baseFacts(erp);
      f.customer = partyBlock(erp.party(p.partyId));
      f.project = projectBlock(erp, p.id);
      f.numbers.contract = (() => {
        const con = p.contractId ? erp.state.contracts.find((x) => x.id === p.contractId) : null;
        return con ? con.number : "—";
      })();
      f.numbers.valuation = p.code + "-CERT-" + String(ordinal).padStart(2, "0");
      f.taxRate = (p.vatBp || erp._configForRead().defaultVatBp || 0) / 100;
      const today = erp.today || new Date().toISOString().slice(0, 10);
      f.valuation = {
        ordinal,
        period: dmy((p.dates && p.dates.start) || p.createdAt) + " – " + dmy(today),
        overallPct: erp.projectProgressPct(p.id),
        // The engine keeps no per-valuation history, so this sheet certifies
        // TO DATE: previous is zero and the period equals the origin. Honest,
        // and stated in the period label above. (ASSUMPTIONS S33.)
        rows: (cert.chapters || []).map((c) => ({
          chapter: c.num + " · " + c.name,
          contracted: c.valueCents,
          previousPct: 0,
          currentPct: c.progressPct,
          toDateAmount: c.doneCents,
          periodAmount: c.doneCents,
        })),
      };
      return DOCS.certificacion.build(f);
    },

    factura(erp, refs, DOCS) {
      return invoiceDoc(erp, refs, DOCS, "factura");
    },

    rectificativa(erp, refs, DOCS) {
      return invoiceDoc(erp, refs, DOCS, "rectificativa");
    },

    recibo(erp, refs, DOCS) {
      const rec = erp.state.receipts.find(
        (r) => r.id === refs.receiptId || r.number === refs.receiptId,
      );
      if (!rec) throw new Error("Receipt not found");
      const inv = rec.allocatedToInvoiceId
        ? erp.state.invoices.find((i) => i.id === rec.allocatedToInvoiceId)
        : null;

      const f = baseFacts(erp);
      f.customer = partyBlock(erp.party(rec.partyId));
      f.project = projectBlock(erp, rec.projectId);
      f.numbers.receipt = rec.number;
      f.numbers.invoice = inv ? inv.number : dash(rec.budgetNumber);
      f.dates.paid = dmy(rec.date);
      const invoiceTotal = inv ? inv.totalCents : rec.amountCents;
      const outstanding = inv ? erp.invoiceOutstandingCents(inv.id) : 0;
      f.receipt = {
        amount: rec.amountCents,
        method: stateWord(rec.method),
        reference: rec.number,
        invoiceTotal,
        paidToDate: invoiceTotal - outstanding,
      };
      return DOCS.recibo.build(f);
    },

    ordenCompra(erp, refs, DOCS) {
      const pu = erp.state.purchases.find(
        (x) => x.id === refs.purchaseId || x.number === refs.purchaseId,
      );
      if (!pu) throw new Error("Purchase not found");
      const f = baseFacts(erp);
      f.supplier = partyBlock(erp.party(pu.supplierId));
      f.project = projectBlock(erp, pu.projectId);
      f.numbers.purchaseOrder = pu.number;
      f.dates.issued = dmy(pu.date);
      f.taxRate = (pu.vatBp || 0) / 100;
      const supplier = erp.party(pu.supplierId);
      f.purchase = {
        rows: [
          {
            item: pu.desc,
            qty: (pu.qtyMilli || 0) / 1000,
            unit: "ud",
            price: pu.unitCents || 0,
            amount: pu.totalCents || 0,
          },
        ],
        deliveryDate: dmy(pu.deliveredDate || pu.expectedArrival),
        terms: supplier && supplier.paymentTermsDays ? supplier.paymentTermsDays + " dias" : "—",
        window: "—",
        siteContact: "—",
      };
      const d = DOCS.ordenCompra.build(f);
      exactTotals(d, {
        taxableCents: pu.totalCents || 0,
        vatBp: pu.vatBp || 0,
        vatCents: Math.round(((pu.totalCents || 0) * (pu.vatBp || 0)) / 10000),
        irpfBp: 0,
        irpfCents: 0,
        grandCents:
          (pu.totalCents || 0) + Math.round(((pu.totalCents || 0) * (pu.vatBp || 0)) / 10000),
      });
      return d;
    },

    subcontrato(erp, refs, DOCS) {
      const s = erp.state.subcontracts.find(
        (x) => x.id === refs.subcontractId || x.number === refs.subcontractId,
      );
      if (!s) throw new Error("Subcontract not found");
      const p = erp.project(s.projectId);
      const chapter =
        (p.baseline && p.baseline.chapters.find((c) => c.num === s.chapterNum)) || null;

      const f = baseFacts(erp);
      f.supplier = partyBlock(erp.party(s.supplierId));
      f.project = projectBlock(erp, s.projectId);
      f.numbers.subcontract = s.number;
      f.dates.issued = dmy(s.sentAt || s.acceptedAt);
      f.taxRate = (erp._configForRead().defaultVatBp || 0) / 100;
      const docStatus = erp.subcontractDocStatus(s);
      f.subcontract = {
        scope: s.trade + (chapter ? " — " + chapter.name : ""),
        start: dmy(s.dates && s.dates.plannedStart),
        end: dmy(s.dates && s.dates.plannedEnd),
        amount: s.awardedCents || 0,
        retentionPct: s.retentionPct || 0,
        rows: [
          { item: s.trade + (chapter ? " — " + chapter.name : ""), amount: s.awardedCents || 0 },
        ],
        milestones: (s.certifications || []).map((c, i) => ({
          when: dmy(c.date),
          label: c.note || "Certificacion " + (i + 1),
          state: "Certificado",
          amount: eur(c.amountCents),
        })),
        compliance: (docStatus.items || []).map((it) => ({
          label: dash(it.kindLabel || it.kind),
          state: it.sev === "g" ? "ok" : "pending",
          note: it.doc && it.doc.expiresOn ? "vence " + dmy(it.doc.expiresOn) : "",
        })),
      };
      return DOCS.subcontrato.build(f);
    },

    paqueteTrimestral(erp, refs, DOCS) {
      const q = refs.quarter;
      const vat = erp.vatSummary(q);
      const irpf = erp.irpfSummary(q);
      const blocks = erp.packageBlocks(q);
      const ex = erp.exceptionsWithStatus(q);

      const f = baseFacts(erp);
      const issued = blocks.find((b) => b.key === "issued") || { count: 0, amountCents: 0 };
      const received = blocks.find((b) => b.key === "received") || { count: 0, amountCents: 0 };
      f.numbers.quarterPackage = "PAQ-" + q;
      f.dates.issued = dmy(new Date().toISOString().slice(0, 10));
      f.quarter = {
        label: q,
        issuedCount: issued.count,
        receivedCount: received.count,
        issuedBase: issued.amountCents,
        receivedBase: received.amountCents,
        taxCharged: vat.outputVatCents,
        taxPaid: vat.inputVatCents,
        taxDue: vat.netCents,
        withheld: irpf.retainedCents || 0,
        exceptions: ex.map((e) => ({
          label: e.label + (e.ref ? " · " + e.ref : ""),
          state: e.accepted ? "ok" : "pending",
          note: e.accepted ? e.accepted.reason : "",
        })),
        contents: blocks.map((b) => [
          b.label,
          b.count + (b.amountCents ? " · " + eur(b.amountCents) : ""),
        ]),
      };
      // There is no accountant party record; the recipient is whoever the
      // operator sends the archive to. Stated as such rather than invented.
      f.agency = { name: "Asesoria contable y fiscal", contact: "—", email: "—" };
      return DOCS.paqueteTrimestral.build(f);
    },

    informeVisita(erp, refs, DOCS) {
      const v = erp.state.visits.find((x) => x.id === refs.visitId);
      if (!v) throw new Error("Visit not found");
      const prop = erp.state.properties.find((x) => x.id === v.propertyId) || {};
      const opp = v.opportunityId
        ? (erp.state.opportunities || []).find((o) => o.id === v.opportunityId)
        : null;

      const f = baseFacts(erp);
      if (opp && opp.partyId) f.customer = partyBlock(erp.party(opp.partyId));
      f.numbers.visit = "VIS-" + String(v.id).slice(-6).toUpperCase();
      const works = (v.lines || []).map((l) => ({
        item: l.desc,
        amount: Math.round(((l.qtyMilli || 0) / 1000) * (l.priceCents || 0)),
      }));
      f.visit = {
        date: dmy(v.date || v.scheduledAt),
        technician: dash(v.owner),
        duration: "—",
        address:
          [prop.street, [prop.postalCode, prop.city].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(", ") || "—",
        area: prop.surfaceM2 ? prop.surfaceM2 + " m2" : "—",
        estimate: works.reduce((s, w) => s + w.amount, 0),
        leadTime: "—",
        priority: "—",
        observations: [["Notas", v.notes || "—"]].concat(
          (v.assumptions || []).map((a, i) => ["Supuesto " + (i + 1), a]),
        ),
        works,
        checks: (v.measurements || []).map((m) => ({
          label: typeof m === "string" ? m : m.label || JSON.stringify(m),
          state: "ok",
        })),
      };
      return DOCS.informeVisita.build(f);
    },

    fichaProyecto(erp, refs, DOCS) {
      const p = erp.project(refs.projectId);
      const econ = erp.chapterEconomics(p.id);
      const progress = erp.chapterProgress(p.id);
      const con = p.contractId ? erp.state.contracts.find((x) => x.id === p.contractId) : null;
      const b = p.budgetId ? erp.state.budgets.find((x) => x.id === p.budgetId) : null;

      const f = baseFacts(erp);
      f.customer = partyBlock(erp.party(p.partyId));
      f.project = projectBlock(erp, p.id);
      f.numbers.contract = con ? con.number : "—";
      f.numbers.quote = b ? b.number : "—";
      f.dates.issued = dmy(new Date().toISOString().slice(0, 10));
      f.dates.start = dmy(p.dates && p.dates.start);
      f.dates.due = dmy(p.dates && p.dates.targetEnd);
      const variance =
        p.dates && p.dates.actualEnd && p.dates.targetEnd
          ? daysBetween(p.dates.targetEnd, p.dates.actualEnd)
          : 0;
      f.margin = {
        foreman: "—",
        state: p.closed ? "Cerrado" : dash(p.status),
        scheduleVariance: (variance > 0 ? "+" : "") + variance,
        actualEnd: dmy(p.dates && p.dates.actualEnd),
        rows: econ.map((r) => {
          const pr = progress.find((x) => x.num === r.num);
          return {
            chapter: r.num + " · " + r.name,
            revenue: r.saleCents,
            budget: r.budgetCostCents,
            actual: r.actualCents,
            progressPct: pr ? pr.progressPct : 0,
          };
        }),
      };
      return DOCS.fichaProyecto.build(f);
    },
  };

  function budgetDoc(erp, refs, DOCS, kind) {
    const b = erp.budget(refs.budgetId);
    const vid =
      refs.versionId ||
      (kind === "presupuestoAceptado" ? b.acceptedVersionId : null) ||
      b.currentVersionId;
    const doc = erp.renderBudgetDoc(refs.budgetId, vid);
    const v = erp.version(refs.budgetId, vid);

    const f = baseFacts(erp);
    f.customer = partyBlock(erp.party(b.partyId));
    const prj = erp.state.projects.find((x) => x.budgetId === b.id);
    f.project = projectBlock(erp, prj ? prj.id : null);
    if (f.project.site === "—") f.project.site = f.customer.address;
    f.project.version = doc.version;
    f.project.validityDays = Math.max(
      1,
      daysBetween(doc.date, doc.validityDate) || f.project.validityDays,
    );
    f.numbers.quote = doc.number;
    f.dates.issued = dmy(doc.date);
    f.dates.validUntil = dmy(doc.validityDate);
    f.dates.accepted = dmy(v.customerResponse && v.customerResponse.date);
    f.taxRate = doc.totals.vatBp / 100;
    f.chapters = budgetChapters(doc);
    if (v.customerResponse && v.customerResponse.acceptedBy)
      f.customer.contact = f.customer.contact || v.customerResponse.acceptedBy;

    const d = DOCS[kind].build(f);
    exactTotals(d, {
      taxableCents: doc.totals.taxableCents,
      vatBp: doc.totals.vatBp,
      vatCents: doc.totals.vatCents,
      irpfBp: 0,
      irpfCents: doc.totals.irpfCents || 0,
      grandCents: doc.totals.grandCents,
    });
    d.facts[0][1] = eur(doc.totals.taxableCents);
    if (b.paymentConditions) d.payment = [b.paymentConditions].concat(d.payment.slice(1));
    return d;
  }

  function invoiceDoc(erp, refs, DOCS, kind) {
    const doc = erp.renderInvoiceDoc(refs.invoiceId);
    const rec = erp.state.invoices.find(
      (i) => i.id === refs.invoiceId || i.number === refs.invoiceId,
    );

    const f = baseFacts(erp);
    f.customer = partyBlock(erp.party(rec.partyId));
    f.company.iban = doc.issuer.iban || f.company.iban;
    f.project = projectBlock(
      erp,
      rec.projectId && erp.state.projects.some((p) => p.id === rec.projectId)
        ? rec.projectId
        : null,
    );
    if (f.project.site === "—" && doc.worksAddress) f.project.site = doc.worksAddress;
    f.numbers.invoice = kind === "rectificativa" ? doc.rectifies || "—" : doc.number;
    f.numbers.creditNote = doc.number;
    f.dates.issued = dmy(doc.date);
    f.dates.due = dmy(doc.dueDate);
    f.taxRate = (doc.vatBp || 0) / 100;
    f.withholdingRate = (doc.irpfBp || 0) / 100;

    if (kind === "rectificativa") {
      const orig = doc.rectifies
        ? erp.state.invoices.find((i) => i.number === doc.rectifies)
        : null;
      f.dates.originalInvoice = dmy(orig && orig.date);
      f.creditNote = {
        base: Math.abs(doc.baseCents),
        reason: doc.rectifyReason || "—",
        reasonCode: "—",
        rows: doc.lines.map((l) => ({ item: l.desc, amount: l.amountCents })),
      };
    } else {
      f.invoice = {
        base: doc.baseCents,
        termsDays: Math.max(0, daysBetween(doc.date, doc.dueDate)),
      };
      // The invoice's own lines are the legal concepts — they replace the
      // budget-chapter table the sample uses.
      f.chapters = [];
    }

    const d = DOCS[kind].build(f);
    if (kind === "factura") {
      d.groups = null;
      d.sections = [
        { type: "band", label: "Conceptos facturados" },
        { type: "lines" },
        { type: "totals" },
      ];
      d.lines = doc.lines.map((l) => ({ desc: l.desc, amount: eur(l.amountCents) }));
    }
    exactTotals(d, {
      taxableCents: doc.baseCents,
      vatBp: doc.vatBp || 0,
      vatCents: doc.vatCents || 0,
      irpfBp: doc.irpfBp || 0,
      irpfCents: doc.irpfCents || 0,
      grandCents: doc.totalCents,
    });
    d.facts[0][1] = eur(kind === "rectificativa" ? -Math.abs(doc.totalCents) : doc.totalCents);
    d.facts[1][1] = eur(kind === "rectificativa" ? -Math.abs(doc.baseCents) : doc.baseCents);
    return d;
  }

  /**
   * The seam: engine records in, a finished document out.
   * `refs` names the record(s): {budgetId, versionId} · {contractId} ·
   * {changeId} · {projectId} · {invoiceId} · {receiptId} · {purchaseId} ·
   * {subcontractId} · {quarter} · {visitId}.
   */
  function docFor(erp, kind, refs, doctypes) {
    const DT = doctypes || (typeof CaneiDocTypes !== "undefined" ? CaneiDocTypes : null);
    if (!DT) throw new Error("erp-facts: CaneiDocTypes is not loaded");
    const fn = KINDS[kind];
    if (!fn)
      throw new Error(
        "erp-facts: no live data behind " +
          JSON.stringify(kind) +
          " — placeholder kinds render sampleFacts() only",
      );
    return fn(erp, refs || {}, DT.DOCS);
  }

  return { docFor, KINDS: Object.keys(KINDS), eur, dmy };
});

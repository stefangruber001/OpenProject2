/* =============================================================================
   Canei Subirats — ERP engine (BRD v2, Proyecto Diorka)
   One dataset, one legal entity (ORG-01). Money is integer cents throughout.
   Loadable from the browser (window.ErpEngine) and from Node (module.exports)
   so the year-long business simulation exercises exactly the code the app runs.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ErpEngine = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------------- money & misc helpers (cents everywhere) ---------------- */
  const cents = (n) => Math.round(Number(n) || 0);
  const mul = (qtyMilli, priceCents) => Math.round((qtyMilli * priceCents) / 1000); // qty in thousandths
  const pctOf = (amountCents, bp) => Math.round((amountCents * bp) / 10000); // bp = basis points
  const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const iso = (d) => (typeof d === "string" ? d : new Date(d).toISOString().slice(0, 10));
  const addDays = (isoDate, n) => {
    const d = new Date(isoDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const daysBetween = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);
  const quarterOf = (isoDate) =>
    isoDate.slice(0, 4) + "-Q" + (Math.floor((+isoDate.slice(5, 7) - 1) / 3) + 1);
  // deterministic light hash for the invoice event chain (VFU-01)
  const djb2 = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, "0");
  };

  /* ---------------- validators (MDM-03, MDM-08) ---------------- */
  const NIF_L = "TRWAGMYFPDXBNJZSQVHLCKE";
  function validTaxId(v) {
    v = String(v || "")
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "");
    if (/^[0-9]{8}[A-Z]$/.test(v)) return NIF_L[parseInt(v.slice(0, 8), 10) % 23] === v[8]; // DNI/NIF
    if (/^[XYZ][0-9]{7}[A-Z]$/.test(v)) {
      const n = { X: "0", Y: "1", Z: "2" }[v[0]] + v.slice(1, 8);
      return NIF_L[parseInt(n, 10) % 23] === v[8]; // NIE
    }
    if (/^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(v)) return true; // CIF structure
    if (/^[A-Z]{2}[0-9A-Z]{2,13}$/.test(v)) return true; // EU VAT (structural)
    return false;
  }
  function validIban(v) {
    v = String(v || "")
      .toUpperCase()
      .replace(/\s+/g, "");
    if (!/^[A-Z]{2}[0-9]{2}[0-9A-Z]{10,30}$/.test(v)) return false;
    const rearr = v.slice(4) + v.slice(0, 4);
    let rem = 0;
    for (const ch of rearr) {
      const d = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
      for (const dd of d) rem = (rem * 10 + +dd) % 97;
    }
    return rem === 1;
  }
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

  /* ---------------- reference lists (BRD dictionaries) ---------------- */
  const LISTS = {
    roles: [
      "customer",
      "supplier",
      "subcontractor",
      "selfEmployed",
      "employee",
      "partner",
      "adviser",
      "other",
    ], // MDM-01
    partyTypes: ["individual", "company", "community", "publicBody"], // 7.2
    leadSources: [
      "referrer",
      "leadPlatform",
      "searchEngine",
      "website",
      "socialMedia",
      "wordOfMouth",
      "propertyManager",
      "repeatCustomer",
      "other",
    ], // MDM-06
    activityLines: ["renovation", "repairs", "damp", "commercial", "other"], // ORG-02
    paymentMethods: [
      "cash",
      "transfer",
      "transfer30",
      "transfer60",
      "transfer90",
      "directDebit",
      "card",
      "onAccount",
      "oneOff",
    ], // MDM-07 / PAY-01
    units: ["ud", "pa", "m", "ml", "m2", "m3", "h", "kg", "l", "%"], // CAT-02
    itemTypes: [
      "material",
      "ownLabour",
      "subcontract",
      "machinery",
      "professional",
      "waste",
      "other",
    ], // CAT-03
    priceSources: [
      "priceList",
      "supplierPortal",
      "supplierOffer",
      "valuedDeliveryNote",
      "purchaseInvoice",
      "manualConfirmation",
    ], // SUP-03
    docTypes: [
      "supplierInvoice",
      "selfEmployedInvoice",
      "deliveryNote",
      "valuedDeliveryNote",
      "ticket",
      "supplierOffer",
      "orderConfirmation",
      "paymentProof",
      "creditNote",
    ], // CAP-02
    docStatuses: ["captured", "extracted", "validated", "allocated", "sentToAccounting", "paid"], // CAP-09
    installmentTriggers: ["onSignature", "atWorksStart", "atStage", "onCompletion", "fixedDate"], // CON-04
    contractStatuses: ["draft", "sent", "signed", "inForce", "completed", "cancelled"], // CON-13
    guaranteeCategories: ["executionAndFinishes", "installations", "structural"], // CON-08
    invoiceKinds: ["deposit", "progress", "final", "extra", "creditNote"], // AR-04
    movementClasses: [
      "projectCost",
      "overhead",
      "tax",
      "salary",
      "financial",
      "internalTransfer",
      "customerReceipt",
    ], // BNK-03
    costKinds: ["material", "labour", "subcontract", "other"], // BNK-02
    overheadCategories: [
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
    ], // GES-05/09
    changeStatuses: ["identified", "priced", "approved", "rejected", "executed", "invoiced"], // CHG-05
    progressStates: ["notStarted", "inProgress", "done"], // PRE-11 / PLN-03
    vatRates: [2100, 1000, 500, 0], // NFR-11 (basis points)
    lossReasons: ["price", "timing", "scope", "competitor", "noResponse", "withdrew"], // CRM-05
    employmentKinds: ["employee", "selfEmployed", "subcontractorStaff"], // LAB-04
  };

  // MDM-02: mandatory identification to invoice or contract
  const MANDATORY_TO_INVOICE = [
    "name",
    "taxId",
    "billStreet",
    "billPostalCode",
    "billCity",
    "billProvince",
    "billCountry",
  ];

  /* =============================================================================
     ERP — the aggregate. `state` is plain JSON (persist/restore friendly).
     ========================================================================== */
  class ERP {
    constructor(today) {
      this.state = {
        today: today || "2026-01-05",
        config: null, // ORG-01
        series: {}, // ORG-04 {type:{prefix,next,issued:[]}}
        parties: [],
        properties: [],
        opportunities: [],
        visits: [],
        catalogue: [],
        packages: [],
        prices: [],
        budgets: [], // {id,number,partyId,propertyId,activityLine, versions:[], currentVersionId, acceptedVersionId, status}
        contracts: [],
        clauseBlocks: [],
        projects: [],
        purchases: [],
        captured: [],
        changes: [],
        invoices: [],
        receipts: [],
        collections: [],
        bills: [],
        payments: [],
        bankAccounts: [],
        movements: [],
        merchantRules: [],
        labour: [],
        workers: [],
        tasks: [],
        packagesSent: [],
        audit: [],
        invoiceEvents: [], // ORG-07 / VFU-01
        seq: { id: 1 },
      };
    }
    /* ---------- persistence ---------- */
    toJSON() {
      return this.state;
    }
    static from(json) {
      const e = new ERP();
      e.state = json;
      return e;
    }

    /* ---------- internals ---------- */
    _id(p) {
      return p + "_" + this.state.seq.id++;
    }
    _log(user, action, ref) {
      this.state.audit.push({ ts: this.state.today, user: user || "system", action, ref });
    } // ORG-07
    setToday(d) {
      this.state.today = iso(d);
    }
    get today() {
      return this.state.today;
    }

    /* =========================== ORG — entity & series =========================== */
    configureEntity(cfg) {
      // ORG-01: once; applied to every document
      this.state.config = Object.assign(
        {
          legalName: "",
          taxId: "",
          street: "",
          postalCode: "",
          city: "",
          province: "Barcelona",
          country: "España",
          registry: "",
          phone: "",
          email: "",
          web: "",
          iban: "",
          logoRef: "canei-logo",
          marginThresholdBp: 1500,
        },
        cfg,
      );
      const mk = (t, prefix) =>
        (this.state.series[t] = this.state.series[t] || { prefix, next: 1, issued: [] });
      mk("budget", "PRE-");
      mk("contract", "CTR-");
      mk("invoice", "FAC-");
      mk("receipt", "REC-");
      mk("creditNote", "ABO-");
      mk("purchaseOrder", "OC-");
      this._log("backoffice", "configureEntity", this.state.config.legalName);
      return this.state.config;
    }
    nextNumber(type) {
      // ORG-04: controlled, gap-free, no manual overwriting
      const s = this.state.series[type];
      if (!s) throw new Error("Unknown series: " + type);
      const year = this.state.today.slice(0, 4);
      const num = `${s.prefix}${year}-${String(s.next).padStart(4, "0")}`;
      s.next++;
      s.issued.push(num);
      return num;
    }
    seriesGaps(type) {
      // GES-07: gap check
      const s = this.state.series[type];
      if (!s) return [];
      const nums = s.issued.map((n) => +n.slice(-4)).sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < nums.length; i++)
        if (nums[i] !== nums[i - 1] + 1) gaps.push(nums[i - 1] + 1);
      return gaps;
    }

    /* =========================== MDM — parties & properties =========================== */
    addParty(p, user) {
      const rec = Object.assign(
        {
          id: this._id("pty"),
          code: "T-" + String(this.state.parties.length + 1).padStart(4, "0"), // MDM-09 internal code
          accountingCode: "",
          roles: [],
          partyType: "individual",
          name: "",
          taxId: "",
          billStreet: "",
          billPostalCode: "",
          billCity: "",
          billProvince: "Barcelona",
          billCountry: "España",
          contactPerson: "",
          landline: "",
          mobile: "",
          email: "",
          preferredChannel: "mobile", // MDM-04
          leadSource: "",
          activityLine: "", // MDM-06 / ORG-02
          paymentMethod: "transfer",
          paymentTermsDays: 30,
          vatRegime: "standard",
          irpfApplies: false,
          irpfRateBp: 0, // MDM-07
          bank: null, // MDM-08 {bank,branch,holder,iban} — change-logged
          registry: "", // MDM-11
          active: true,
          legacy: false,
          notes: "",
        },
        p,
      );
      rec.accountingCode = rec.accountingCode || "43" + rec.code.replace(/\D/g, ""); // MDM-09 aligned pair
      if (rec.taxId && !validTaxId(rec.taxId))
        throw new Error("Invalid tax identifier: " + rec.taxId); // MDM-03
      const dup = this.findDuplicateParty(rec);
      if (dup && rec.taxId && dup.taxId === rec.taxId)
        throw new Error("Duplicate active party for tax id " + rec.taxId); // MDM-03
      rec.duplicateSuspect = dup ? dup.id : null;
      this.state.parties.push(rec);
      this._log(user, "addParty", rec.code);
      return rec;
    }
    findDuplicateParty(rec) {
      // MDM-03: on taxId, name, phone
      const norm = (s) =>
        String(s || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      return this.state.parties.find(
        (x) =>
          x.active &&
          x.id !== rec.id &&
          ((rec.taxId && x.taxId === rec.taxId) ||
            (rec.name && norm(x.name) === norm(rec.name)) ||
            (rec.mobile && x.mobile && x.mobile === rec.mobile)),
      );
    }
    updateParty(id, patch, user) {
      const p = this.party(id);
      if (patch.taxId && !validTaxId(patch.taxId)) throw new Error("Invalid tax identifier");
      if (patch.bank && patch.bank.iban && !validIban(patch.bank.iban))
        throw new Error("Invalid IBAN");
      if (patch.bank) this._log(user, "partyBankChange", p.code); // MDM-08 change-logged
      Object.assign(p, patch);
      this._log(user, "updateParty", p.code);
      return p;
    }
    deactivateParty(id, user) {
      this.party(id).active = false;
      this._log(user, "deactivateParty", id);
    } // MDM-12
    party(id) {
      const p = this.state.parties.find((x) => x.id === id);
      if (!p) throw new Error("Party not found");
      return p;
    }
    partyCompleteness(id) {
      // MDM-10
      const p = this.party(id);
      const missing = MANDATORY_TO_INVOICE.filter((f) => !String(p[f] || "").trim());
      if (p.taxId && !validTaxId(p.taxId)) missing.push("taxId(valid)");
      if (!p.mobile && !p.landline) missing.push("telephone");
      const extras = ["email", "leadSource", "activityLine"].filter(
        (f) => !String(p[f] || "").trim(),
      );
      const total =
        MANDATORY_TO_INVOICE.length + 1 + extras.length + (missing.includes("telephone") ? 0 : 0);
      const pct = Math.max(
        0,
        Math.round(100 * (1 - (missing.length + extras.length * 0.5) / (total || 1))),
      );
      return { pct, missing, recommendedMissing: extras, ok: missing.length === 0 };
    }
    _requireComplete(partyId, what) {
      // MDM-10 block
      const c = this.partyCompleteness(partyId);
      if (!c.ok)
        throw new Error(`Cannot issue ${what}: party data incomplete (${c.missing.join(", ")})`);
    }
    addProperty(pr, user) {
      // MDM-05
      const rec = Object.assign(
        {
          id: this._id("prop"),
          partyId: null,
          street: "",
          postalCode: "",
          city: "",
          part: "dwelling",
          surfaceM2: 0,
          access: "",
          occupied: false,
        },
        pr,
      );
      this.state.properties.push(rec);
      this._log(user, "addProperty", rec.id);
      return rec;
    }
    partyHistory(id) {
      // MDM-13
      const S = this.state;
      return {
        opportunities: S.opportunities.filter((o) => o.partyId === id),
        budgets: S.budgets.filter((b) => b.partyId === id),
        contracts: S.contracts.filter((c) => c.partyId === id),
        projects: S.projects.filter((p) => p.partyId === id),
        invoices: S.invoices.filter((i) => i.partyId === id),
        receipts: S.receipts.filter((r) => r.partyId === id),
        bills: S.bills.filter((b) => b.supplierId === id),
      };
    }

    /* =========================== CRM & site visits =========================== */
    addOpportunity(o, user) {
      // CRM-01
      const rec = Object.assign(
        {
          id: this._id("opp"),
          partyId: null,
          propertyId: null,
          source: "",
          date: this.state.today,
          requestedWork: "",
          owner: "operations",
          status: "awaitingVisit",
          nextAction: "Programar visita",
          expectedValue: 0,
          jobSize: "normal",
          lossReason: null,
          notes: [],
        },
        o,
      );
      this.state.opportunities.push(rec);
      this._log(user, "addOpportunity", rec.id);
      return rec;
    }
    loseOpportunity(id, reason, user) {
      // CRM-05
      const o = this.state.opportunities.find((x) => x.id === id);
      o.status = "lost";
      o.lossReason = reason;
      this._log(user, "loseOpportunity", id);
    }
    opportunityAges() {
      // CRM-04
      const t = this.state.today;
      return this.state.opportunities
        .filter((o) => !["won", "lost"].includes(o.status))
        .map((o) => ({ ...o, ageDays: daysBetween(t, o.date) }));
    }
    addVisit(v, user) {
      // VIS-01/02/03/06
      const rec = Object.assign(
        {
          id: this._id("vis"),
          opportunityId: null,
          date: this.state.today,
          measurements: [],
          photos: [],
          notes: "",
          assumptions: [],
          exclusions: [],
          handwrittenEstimateRef: null,
          lines: [], // lines → budget without retype (VIS-06)
        },
        v,
      );
      this.state.visits.push(rec);
      const o = this.state.opportunities.find((x) => x.id === rec.opportunityId);
      if (o && o.status === "awaitingVisit") o.status = "awaitingBudget";
      this._log(user, "addVisit", rec.id);
      return rec;
    }

    /* =========================== CAT — catalogue & packages =========================== */
    addCatalogueItem(it, user) {
      // CAT-01/02/03/06/08
      const rec = Object.assign(
        {
          id: this._id("cat"),
          code: "",
          desc: "",
          customerWording: "",
          unit: "ud",
          type: "material",
          chapter: "",
          active: true,
          imageRefs: [],
          defaultCostCents: 0,
          defaultPriceCents: 0,
        },
        it,
      );
      this.state.catalogue.push(rec);
      this._log(user, "addCatalogueItem", rec.code);
      return rec;
    }
    addWorkPackage(wp, user) {
      // CAT-04: yield, min purchase, container size
      const rec = Object.assign(
        {
          id: this._id("pkg"),
          code: "",
          name: "",
          unit: "m2",
          components: [], // {itemId, qtyPerUnitMilli, kind}
          yieldPerUnit: 1,
          wastePct: 0,
          minPurchaseQty: 0,
          containerSize: 0,
        },
        wp,
      );
      this.state.packages.push(rec);
      this._log(user, "addWorkPackage", rec.code);
      return rec;
    }
    packageCostCents(pkgId, qtyMilli) {
      // CAT-04: automatic cost of a measured quantity
      const wp = this.state.packages.find((p) => p.id === pkgId);
      let total = 0;
      for (const c of wp.components) {
        const item = this.state.catalogue.find((i) => i.id === c.itemId);
        const price = this.currentPriceCents(c.itemId) ?? item.defaultCostCents;
        let needMilli = Math.round(
          ((qtyMilli * c.qtyPerUnitMilli) / 1000) * (1 + wp.wastePct / 100),
        );
        if (wp.containerSize > 0) {
          // round up to whole containers (min purchase)
          const containers = Math.ceil(needMilli / (wp.containerSize * 1000));
          needMilli = Math.max(containers * wp.containerSize * 1000, wp.minPurchaseQty * 1000);
        }
        total += mul(needMilli, price);
      }
      return total;
    }

    /* =========================== SUP — prices with source & comparison =========================== */
    addPrice(pr, user) {
      // SUP-02/03/04/09
      const rec = Object.assign(
        {
          id: this._id("prc"),
          itemId: null,
          supplierId: null,
          date: this.state.today,
          listCents: 0,
          discountPct: 0,
          netCents: 0,
          source: "manualConfirmation",
          sourceDocRef: "",
          transportCents: 0,
          validUntil: null,
          dims: null, // SUP-09 {pieces,lengthMm,widthMm}
        },
        pr,
      );
      if (!LISTS.priceSources.includes(rec.source)) throw new Error("Unknown price source"); // SUP-03
      rec.netCents = rec.netCents || Math.round(rec.listCents * (1 - rec.discountPct / 100));
      this.state.prices.push(rec);
      this._log(user, "addPrice", rec.id);
      return rec; // SUP-05: append-only history
    }
    currentPriceCents(itemId, supplierId) {
      const cands = this.state.prices
        .filter((p) => p.itemId === itemId && (!supplierId || p.supplierId === supplierId))
        .sort((a, b) => b.date.localeCompare(a.date));
      return cands.length ? cands[0].netCents : null;
    }
    comparePrices(itemIds, supplierIds) {
      // SUP-06/07: missing is missing, never zero
      return itemIds.map((itemId) => {
        const perSupplier = supplierIds.map((sid) => {
          const price = this.currentPriceCents(itemId, sid);
          return { supplierId: sid, netCents: price, missing: price == null };
        });
        const present = perSupplier.filter((x) => !x.missing);
        const best = present.length ? Math.min(...present.map((x) => x.netCents)) : null;
        return {
          itemId,
          perSupplier,
          bestCents: best,
          variance: perSupplier.map((x) =>
            x.missing
              ? null
              : {
                  abs: x.netCents - best,
                  pct: best ? Math.round(((x.netCents - best) / best) * 1000) / 10 : 0,
                },
          ),
        };
      });
    }
    priceAlerts() {
      // DAS-06: expired / stale prices
      const t = this.state.today;
      return this.state.prices.filter((p) => p.validUntil && p.validUntil < t).map((p) => p.id);
    }

    /* =========================== PRE/QUO — budgets & versions =========================== */
    createBudget(b, user) {
      // PRE-15 header
      const rec = Object.assign(
        {
          id: this._id("bud"),
          number: this.nextNumber("budget"),
          date: this.state.today,
          internalRef: "",
          partyId: null,
          propertyId: null,
          preparedBy: user || "backoffice",
          validityDate: addDays(this.state.today, 30),
          status: "draft",
          language: "es",
          activityLine: "renovation",
          surfaceM2: 0,
          discountCents: 0,
          vatBp: 1000,
          irpfBp: 0,
          paymentConditions: "",
          exclusions: [],
          assumptions: [],
          versions: [],
          currentVersionId: null,
          acceptedVersionId: null,
          internalVariant: false, // PRE-13/QUO-06
        },
        b,
      );
      this.state.budgets.push(rec);
      this.newVersion(rec.id, { reason: "Versión inicial", author: user }, true);
      this._log(user, "createBudget", rec.number);
      return rec;
    }
    budget(id) {
      const b = this.state.budgets.find((x) => x.id === id);
      if (!b) throw new Error("Budget not found");
      return b;
    }
    version(budgetId, versionId) {
      const b = this.budget(budgetId);
      return b.versions.find((v) => v.id === versionId);
    }
    currentVersion(budgetId) {
      const b = this.budget(budgetId);
      return b.versions.find((v) => v.id === b.currentVersionId);
    }
    newVersion(budgetId, { reason, author, from } = {}, first) {
      // QUO-01/02: automatic numbering; frozen predecessors
      const b = this.budget(budgetId);
      if (b.acceptedVersionId)
        throw new Error("Budget already accepted; open a change order instead"); // QUO-04
      const prev = from ? b.versions.find((v) => v.id === from) : this.currentVersion(budgetId);
      const v = {
        id: this._id("ver"),
        vNumber: "1." + b.versions.length, // 1.0, 1.1 … per B.1 convention
        date: this.state.today,
        author: author || "backoffice",
        reason: reason || "",
        frozen: false,
        issued: false,
        sent: null,
        customerResponse: null,
        docRef: null,
        superseded: false,
        chapters: prev ? clone(prev.chapters) : [], // chapter: {num,name,section,order,lines[],progress}
      };
      if (prev && !first) {
        prev.superseded = true;
        if (prev.issued) prev.frozen = true;
      } // QUO-05
      b.versions.push(v);
      b.currentVersionId = v.id; // QUO-04: exactly one current
      this._log(author, "newVersion", b.number + " v" + v.vNumber);
      return v;
    }
    addChapter(budgetId, ch) {
      // PRE-01/06: section = base|optional|outOfScope|extras
      const v = this._editableVersion(budgetId);
      const rec = Object.assign(
        {
          id: this._id("chp"),
          num: String(v.chapters.length + 1),
          name: "",
          section: "base",
          order: v.chapters.length,
          progress: "notStarted",
          lines: [],
        },
        ch,
      );
      v.chapters.push(rec);
      return rec;
    }
    addLine(budgetId, chapterId, ln) {
      // PRE-02/03/04/05
      const v = this._editableVersion(budgetId);
      const c = v.chapters.find((x) => x.id === chapterId);
      const rec = Object.assign(
        {
          id: this._id("lin"),
          num: c.num + "." + (c.lines.length + 1),
          code: "",
          itemId: null,
          desc: "",
          customerWording: "",
          unit: "ud",
          qtyMilli: 0,
          priceCents: 0,
          costCents: 0,
          costSupplierId: null,
          costSourceRef: "", // PRE-08 / SUP-08
          lumpSum: false,
          pending: false,
          optionalLine: false,
          subLines: [], // {room, qtyMilli, wastePct, customerVisible}
          progress: "notStarted",
          progressPct: 0,
          imageRefs: [],
          notes: "",
        },
        ln,
      );
      if (rec.subLines.length) rec.qtyMilli = this._aggSubLines(rec.subLines); // PRE-03
      c.lines.push(rec);
      return rec;
    }
    _aggSubLines(subLines) {
      return sum(subLines, (s) => Math.round(s.qtyMilli * (1 + (s.wastePct || 0) / 100)));
    }
    _editableVersion(budgetId) {
      const b = this.budget(budgetId);
      const v = this.currentVersion(budgetId);
      if (!v || v.frozen || v.issued)
        throw new Error("Current version is frozen — create a new version"); // QUO-02
      if (b.acceptedVersionId === v.id) throw new Error("Accepted version is immutable"); // QUO-04
      return v;
    }
    budgetTotals(budgetId, versionId) {
      // PRE-06/07: the totals engine
      const b = this.budget(budgetId);
      const v = versionId ? this.version(budgetId, versionId) : this.currentVersion(budgetId);
      const chapters = v.chapters.map((c) => {
        let saleCents = 0,
          costCents = 0,
          pendingCount = 0,
          pendingEstCents = 0;
        for (const l of c.lines) {
          const qty = l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli;
          const lineTotal = l.lumpSum ? l.priceCents : mul(qty, l.priceCents);
          if (l.pending) {
            pendingCount++;
            pendingEstCents += lineTotal;
            continue;
          } // PRE-04: excluded, counted
          saleCents += lineTotal;
          costCents += l.lumpSum ? l.costCents : mul(qty, l.costCents);
        }
        return {
          id: c.id,
          num: c.num,
          name: c.name,
          section: c.section,
          saleCents,
          costCents,
          marginCents: saleCents - costCents,
          pendingCount,
          pendingEstCents,
        };
      });
      const bySec = (s) =>
        sum(
          chapters.filter((c) => c.section === s),
          (c) => c.saleCents,
        );
      const baseCents = bySec("base"),
        optionsCents = bySec("optional"),
        outCents = bySec("outOfScope"),
        extrasCents = bySec("extras");
      const costBase = sum(
        chapters.filter((c) => c.section === "base"),
        (c) => c.costCents,
      );
      const taxable = baseCents - b.discountCents;
      const vatCents = pctOf(taxable, b.vatBp);
      const irpfCents = pctOf(taxable, b.irpfBp);
      const grandCents = taxable + vatCents - irpfCents;
      const pendingCount = sum(chapters, (c) => c.pendingCount),
        pendingEstCents = sum(chapters, (c) => c.pendingEstCents);
      return {
        chapters,
        baseCents,
        optionsCents,
        outOfScopeCents: outCents,
        extrasCents,
        discountCents: b.discountCents,
        taxableCents: taxable,
        vatBp: b.vatBp,
        vatCents,
        irpfBp: b.irpfBp,
        irpfCents,
        grandCents,
        costBaseCents: costBase,
        marginBaseCents: baseCents - costBase,
        marginBasePct: baseCents ? Math.round(((baseCents - costBase) / baseCents) * 1000) / 10 : 0,
        perM2Cents: b.surfaceM2 > 0 ? Math.round(grandCents / b.surfaceM2) : null, // PRE-07 €/m²
        pendingCount,
        pendingEstCents, // PRE-04
      };
    }
    validateBudget(budgetId) {
      // PRE-09: pre-issue validation
      const v = this.currentVersion(budgetId);
      const issues = [];
      for (const c of v.chapters)
        for (const l of c.lines) {
          const qty = l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli;
          if (!l.pending && !l.lumpSum && qty === 0)
            issues.push({ level: "block", line: l.num, msg: "Cantidad cero" });
          if (!l.pending && l.priceCents === 0 && !l.optionalLine)
            issues.push({
              level: "block",
              line: l.num,
              msg: "Precio cero (marque pendiente si procede)",
            });
          if (!l.pending && l.costCents > l.priceCents && l.priceCents > 0)
            issues.push({ level: "warn", line: l.num, msg: "Coste superior al precio de venta" });
          if (l.pending)
            issues.push({ level: "warn", line: l.num, msg: "Línea pendiente de precio" });
        }
      const t = this.budgetTotals(budgetId);
      for (const c of t.chapters)
        if (c.section === "base" && c.marginCents < 0)
          issues.push({ level: "block", line: c.num, msg: "Capítulo con margen negativo" });
      return issues;
    }
    issueVersion(budgetId, { channel } = {}, user) {
      // QUO-02/05/07: freeze + generate customer doc from data
      const b = this.budget(budgetId);
      const v = this.currentVersion(budgetId);
      const blocks = this.validateBudget(budgetId).filter((i) => i.level === "block");
      if (blocks.length)
        throw new Error(
          "Budget fails validation: " + blocks.map((x) => x.line + " " + x.msg).join("; "),
        );
      this._requireComplete(b.partyId, "budget"); // MDM-10 (budget needs identified party)
      const ch = channel || "email";
      if (ch === "email" && !validEmail(this.party(b.partyId).email))
        throw new Error("Email required to send electronically (MDM-04)");
      v.issued = true;
      v.frozen = true;
      v.sent = { date: this.state.today, channel: ch }; // QUO-09 + MDM-04
      v.docRef = this._docName("presupuesto", b, v); // DOC-04
      b.status = "issued";
      const o = this.state.opportunities.find(
        (x) => x.partyId === b.partyId && !["won", "lost"].includes(x.status),
      );
      if (o) o.status = "awaitingResponse";
      this._log(user, "issueVersion", b.number + " v" + v.vNumber);
      return this.renderBudgetDoc(budgetId, v.id);
    }
    renderBudgetDoc(budgetId, versionId) {
      // QUO-05/07 + QUO-10 + DOC-01: customer doc from data; no internal cost
      const b = this.budget(budgetId);
      const v = this.version(budgetId, versionId);
      const cfg = this.state.config;
      const t = this.budgetTotals(budgetId, versionId);
      return {
        docType: "PRESUPUESTO",
        number: b.number,
        version: v.vNumber,
        date: v.date,
        issuer: {
          legalName: cfg.legalName,
          taxId: cfg.taxId,
          address: `${cfg.street}, ${cfg.postalCode} ${cfg.city}`,
          phone: cfg.phone,
          email: cfg.email,
          iban: cfg.iban,
          logoRef: cfg.logoRef,
        }, // DOC-01
        customer: (({ name, taxId, billStreet, billPostalCode, billCity }) => ({
          name,
          taxId,
          address: `${billStreet}, ${billPostalCode} ${billCity}`,
        }))(this.party(b.partyId)),
        language: b.language,
        validityDate: b.validityDate,
        paymentConditions: b.paymentConditions,
        exclusions: b.exclusions,
        assumptions: b.assumptions,
        chapters: v.chapters.map((c) => ({
          num: c.num,
          name: c.name,
          section: c.section,
          lines: c.lines
            .filter((l) => !l.pending)
            .map((l) => ({
              num: l.num,
              desc: l.customerWording || l.desc,
              unit: l.unit,
              qty: (l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli) / 1000,
              priceCents: l.priceCents,
              totalCents: l.lumpSum
                ? l.priceCents
                : mul(l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli, l.priceCents),
              subLines: l.subLines
                .filter((s) => s.customerVisible)
                .map((s) => ({ room: s.room, qty: s.qtyMilli / 1000 })), // PRE-03 optional visibility
              imageRefs: l.imageRefs, // PRE-10 / CAT-08
            })),
        })),
        totals: {
          baseCents: t.baseCents,
          optionsCents: t.optionsCents,
          discountCents: t.discountCents,
          taxableCents: t.taxableCents,
          vatBp: t.vatBp,
          vatCents: t.vatCents,
          irpfCents: t.irpfCents,
          grandCents: t.grandCents,
          perM2Cents: t.perM2Cents,
        },
        // QUO-10 / PRE-08: no cost or margin fields present, by construction
      };
    }
    diffVersions(budgetId, aId, bId) {
      // QUO-03
      const A = this.version(budgetId, aId),
        B = this.version(budgetId, bId);
      const key = (l) => l.code || l.num + "|" + l.desc;
      const mapA = new Map(),
        mapB = new Map();
      A.chapters.forEach((c) => c.lines.forEach((l) => mapA.set(key(l), l)));
      B.chapters.forEach((c) => c.lines.forEach((l) => mapB.set(key(l), l)));
      const added = [...mapB.keys()].filter((k) => !mapA.has(k));
      const removed = [...mapA.keys()].filter((k) => !mapB.has(k));
      const changed = [];
      for (const [k, lb] of mapB) {
        const la = mapA.get(k);
        if (!la) continue;
        if (la.qtyMilli !== lb.qtyMilli || la.priceCents !== lb.priceCents)
          changed.push({
            key: k,
            qtyFrom: la.qtyMilli / 1000,
            qtyTo: lb.qtyMilli / 1000,
            priceFromCents: la.priceCents,
            priceToCents: lb.priceCents,
          });
      }
      const tA = this.budgetTotals(budgetId, aId),
        tB = this.budgetTotals(budgetId, bId);
      return {
        added,
        removed,
        changed,
        totalFromCents: tA.grandCents,
        totalToCents: tB.grandCents,
        deltaCents: tB.grandCents - tA.grandCents,
        deltaPct: tA.grandCents
          ? Math.round(((tB.grandCents - tA.grandCents) / tA.grandCents) * 1000) / 10
          : 0,
      };
    }
    acceptVersion(budgetId, versionId, { evidenceRef, acceptedOptions } = {}, user) {
      // QUO-04/09 + PRJ-01
      const b = this.budget(budgetId);
      const v = this.version(budgetId, versionId);
      if (!v.issued) throw new Error("Only an issued version can be accepted");
      if (b.acceptedVersionId) throw new Error("A version is already accepted");
      v.customerResponse = {
        accepted: true,
        date: this.state.today,
        evidenceRef: evidenceRef || null,
        acceptedOptions: acceptedOptions || [],
      };
      v.frozen = true;
      b.acceptedVersionId = v.id;
      b.status = "accepted";
      const o = this.state.opportunities.find(
        (x) => x.partyId === b.partyId && !["won", "lost"].includes(x.status),
      );
      if (o) o.status = "won";
      this._log(user, "acceptVersion", b.number + " v" + v.vNumber);
      return v;
    }

    /* =========================== CON — contracts =========================== */
    createContract(budgetId, terms, user) {
      // CON-01..14
      const b = this.budget(budgetId);
      if (!b.acceptedVersionId) throw new Error("Contract requires an accepted budget version"); // CON-02
      this._requireComplete(b.partyId, "contract"); // 7.5 parties control
      const t = this.budgetTotals(budgetId, b.acceptedVersionId);
      const rec = Object.assign(
        {
          id: this._id("con"),
          number: this.nextNumber("contract"),
          date: this.state.today,
          partyId: b.partyId,
          propertyId: b.propertyId,
          budgetId,
          budgetNumber: b.number,
          acceptedVersionId: b.acceptedVersionId,
          valueCents: t.taxableCents,
          vatBp: t.vatBp,
          vatCents: t.vatCents,
          totalCents: t.grandCents, // CON-03 structured
          installments: [], // CON-04 {pct|amountCents, trigger, stageRef, expectedDate, invoicedInvoiceId, status}
          initiation: {
            scheduleWithinDays: 7,
            startWithinDays: 15,
            firstPaymentDate: null,
            committedStartDate: null,
          }, // CON-05
          duration: {
            estimatedDays: null,
            plannedStart: null,
            plannedFinish: null,
            actualStart: null,
            actualFinish: null,
            deviationReason: null,
          }, // CON-06
          penalties: {
            latePaymentInterestPctYear: 8,
            delayPenaltyCentsPerWeek: 0,
            capCents: 0,
            graceDays: 7,
            suspendingEvents: ["customer delay", "force majeure", "approved change"],
          }, // CON-07
          guarantees: [], // CON-08 {category, months, startDate, expiryDate}
          clauseBlockVersions: this.state.clauseBlocks
            .filter((cb) => cb.effectiveFrom <= this.state.today)
            .map((cb) => cb.id), // CON-09
          language: b.language, // CON-10
          signature: { customerSignedAt: null, companySignedAt: null, method: null }, // CON-11
          status: "draft",
          annexes: [],
          scopeAnnexRef: this._docName(
            "contrato-anexo",
            b,
            this.version(budgetId, b.acceptedVersionId),
          ),
        },
        terms || {},
      );
      if (!rec.duration.estimatedDays) throw new Error("Execution duration is mandatory (CON-06)");
      const instSum = sum(rec.installments, (i) =>
        i.pct != null ? pctOf(rec.totalCents, i.pct * 100) : i.amountCents,
      );
      if (rec.installments.length && Math.abs(instSum - rec.totalCents) > rec.installments.length)
        // cent-rounding tolerance
        rec.installments[rec.installments.length - 1].adjustCents = rec.totalCents - instSum;
      rec.installments.forEach((i, idx) => {
        i.idx = idx;
        i.status = "planned";
        i.amountCents =
          (i.pct != null ? pctOf(rec.totalCents, i.pct * 100) : i.amountCents) +
          (i.adjustCents || 0);
      });
      this.state.contracts.push(rec);
      this._log(user, "createContract", rec.number);
      return rec;
    }
    signContract(id, { method } = {}, user) {
      // CON-11
      const c = this.state.contracts.find((x) => x.id === id);
      c.signature = {
        customerSignedAt: this.state.today,
        companySignedAt: this.state.today,
        method: method || "physical",
      };
      c.status = "signed";
      c.guarantees.forEach((g) => {
        g.startDate = null;
      }); // set at completion
      this._log(user, "signContract", c.number);
      return c;
    }
    recordFirstPayment(contractId) {
      // CON-05: derive committed dates
      const c = this.state.contracts.find((x) => x.id === contractId);
      c.initiation.firstPaymentDate = this.state.today;
      c.initiation.committedStartDate = addDays(this.state.today, c.initiation.startWithinDays);
      c.status = "inForce";
      return c;
    }
    contractControlView() {
      // CON-13
      return this.state.contracts.map((c) => ({
        number: c.number,
        party: this.party(c.partyId).name,
        valueCents: c.totalCents,
        installments: c.installments.map((i) => ({
          trigger: i.trigger,
          amountCents: i.amountCents,
          status: i.status,
        })),
        startRule: c.initiation,
        durationDays: c.duration.estimatedDays,
        penalties: !!c.penalties,
        guarantees: c.guarantees.length,
        language: c.language,
        signed: !!c.signature.customerSignedAt,
        status: c.status,
      }));
    }

    /* =========================== PRJ — projects =========================== */
    createProjectFromAcceptance(budgetId, user) {
      // PRJ-01..04: no re-entry, frozen baseline
      const b = this.budget(budgetId);
      if (!b.acceptedVersionId) throw new Error("Acceptance required before project creation");
      const t = this.budgetTotals(budgetId, b.acceptedVersionId);
      const contract = this.state.contracts.find((c) => c.budgetId === budgetId);
      const rec = {
        id: this._id("prj"),
        code: "P-" + b.number.replace("PRE-", ""),
        partyId: b.partyId,
        propertyId: b.propertyId,
        budgetId,
        budgetNumber: b.number,
        acceptedVersionId: b.acceptedVersionId,
        contractId: contract ? contract.id : null,
        activityLine: b.activityLine,
        status: "active",
        baseline: Object.freeze({
          // PRJ-03/04: immutable
          revenueCents: t.taxableCents,
          costCents: t.costBaseCents,
          marginCents: t.taxableCents - t.costBaseCents,
          chapters: t.chapters
            .filter((c) => c.section === "base")
            .map((c) => ({
              num: c.num,
              name: c.name,
              saleCents: c.saleCents,
              costCents: c.costCents,
            })),
        }),
        vatBp: b.vatBp,
        surfaceM2: b.surfaceM2,
        dates: { start: null, targetEnd: null, actualEnd: null },
        milestones: [],
        diary: [], // PLN-05
        permits: [],
        dependencies: [],
        closed: false,
      };
      this.state.projects.push(rec);
      this._log(user, "createProject", rec.code);
      return rec;
    }
    createQuickProject({ partyId, desc, activityLine, valueCents }, user) {
      // PRJ-08: small repair without formal budget
      this._requireComplete(partyId, "quick project");
      const rec = {
        id: this._id("prj"),
        code: "P-R" + String(this.state.projects.length + 1).padStart(3, "0"),
        partyId,
        propertyId: null,
        budgetId: null,
        budgetNumber: null,
        contractId: null,
        activityLine: activityLine || "repairs",
        status: "active",
        baseline: Object.freeze({
          revenueCents: valueCents,
          costCents: 0,
          marginCents: valueCents,
          chapters: [{ num: "1", name: desc, saleCents: valueCents, costCents: 0 }],
        }),
        vatBp: 2100,
        surfaceM2: 0,
        dates: { start: this.state.today, targetEnd: null, actualEnd: null },
        milestones: [],
        diary: [],
        permits: [],
        dependencies: [],
        closed: false,
      };
      this.state.projects.push(rec);
      this._log(user, "createQuickProject", rec.code);
      return rec;
    }
    project(id) {
      const p = this.state.projects.find((x) => x.id === id || x.code === id);
      if (!p) throw new Error("Project not found: " + id);
      return p;
    }
    startWorks(projectId, user) {
      // CON-11: blocked if contract unsigned
      const p = this.project(projectId);
      if (p.contractId) {
        const c = this.state.contracts.find((x) => x.id === p.contractId);
        if (!c.signature.customerSignedAt)
          throw new Error("Contract not signed — works blocked (CON-11)");
        c.duration.actualStart = this.state.today;
      }
      p.dates.start = this.state.today;
      this._log(user, "startWorks", p.code);
    }
    markProgress(projectId, chapterNum, state_, pct, user) {
      // PRE-11 / PLN-03
      const p = this.project(projectId);
      if (!p.budgetId) {
        p.progressSimple = { state: state_, pct: pct ?? (state_ === "done" ? 100 : 50) };
        return;
      }
      const v = this.version(p.budgetId, p.acceptedVersionId);
      const c = v.chapters.find((x) => x.num === chapterNum);
      if (!c) throw new Error("Chapter not found: " + chapterNum);
      c.progress = state_;
      c.lines.forEach((l) => {
        l.progress = state_;
        l.progressPct = pct ?? (state_ === "done" ? 100 : state_ === "inProgress" ? 50 : 0);
      });
      this._log(user, "markProgress", p.code + " cap." + chapterNum + " → " + state_);
    }
    projectProgressPct(projectId) {
      // value-weighted, feeds progress invoicing (PLN-03)
      const p = this.project(projectId);
      if (!p.budgetId) return p.progressSimple ? p.progressSimple.pct : 0;
      const v = this.version(p.budgetId, p.acceptedVersionId);
      let done = 0,
        total = 0;
      for (const c of v.chapters.filter((x) => x.section === "base"))
        for (const l of c.lines.filter((l) => !l.pending)) {
          const amt = l.lumpSum
            ? l.priceCents
            : mul(l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli, l.priceCents);
          total += amt;
          done += amt * ((l.progress === "done" ? 100 : l.progressPct || 0) / 100);
        }
      return total ? Math.round((done / total) * 100) : 0;
    }

    /* =========================== CHG — change orders & extras =========================== */
    addChange(projectId, ch, user) {
      // CHG-01/02: cost AND price impact
      const p = this.project(projectId);
      const rec = Object.assign(
        {
          id: this._id("chg"),
          projectId: p.id,
          date: this.state.today,
          desc: "",
          reason: "",
          priceCents: 0,
          costCents: 0,
          scheduleImpactDays: 0,
          photoRef: null,
          status: "identified",
          approvedAt: null,
          evidenceRef: null,
          invoiceId: null,
          annexNumber: null,
        },
        ch,
      );
      this.state.changes.push(rec);
      this._log(user, "addChange", p.code + " " + rec.desc);
      return rec;
    }
    priceChange(changeId, priceCents, costCents, user) {
      const c = this.state.changes.find((x) => x.id === changeId);
      c.priceCents = priceCents;
      c.costCents = costCents;
      c.status = "priced";
      this._log(user, "priceChange", changeId);
    }
    approveChange(changeId, evidenceRef, user) {
      // CHG-03/04 + CON-12
      const c = this.state.changes.find((x) => x.id === changeId);
      if (c.status !== "priced") throw new Error("Change must be priced before approval");
      c.status = "approved";
      c.approvedAt = this.state.today;
      c.evidenceRef = evidenceRef || null;
      const p = this.project(c.projectId);
      const con = p.contractId ? this.state.contracts.find((x) => x.id === p.contractId) : null;
      if (con) {
        // CON-12 annex chain
        c.annexNumber = con.number + "-A" + (con.annexes.length + 1);
        con.annexes.push({
          number: c.annexNumber,
          changeId: c.id,
          valueCents: c.priceCents,
          date: this.state.today,
        });
      }
      this._log(user, "approveChange", changeId);
      return c;
    }
    extrasRegister(projectId) {
      // CHG-05/07
      const list = this.state.changes.filter((c) => c.projectId === projectId);
      return {
        items: list,
        identified: list.filter((c) => c.status === "identified").length,
        priced: list.filter((c) => c.status === "priced").length,
        approved: list.filter((c) => ["approved", "executed", "invoiced"].includes(c.status))
          .length,
        invoiced: list.filter((c) => c.status === "invoiced").length,
        approvedValueCents: sum(
          list.filter((c) => ["approved", "executed", "invoiced"].includes(c.status)),
          (c) => c.priceCents,
        ),
        unapprovedValueCents: sum(
          list.filter((c) => ["identified", "priced"].includes(c.status)),
          (c) => c.priceCents,
        ), // CHG-04 visible
      };
    }

    /* =========================== PUR — purchases =========================== */
    addPurchase(pu, user) {
      // PUR-01/02/06
      const rec = Object.assign(
        {
          id: this._id("pur"),
          number: this.nextNumber("purchaseOrder"),
          supplierId: null,
          projectId: null,
          chapterNum: null,
          date: this.state.today,
          desc: "",
          qtyMilli: 1000,
          unitCents: 0,
          vatBp: 2100,
          totalCents: 0,
          orderRef: "",
          status: {
            ordered: true,
            delivered: false,
            returnedCents: 0,
            invoicedBillId: null,
            paid: false,
          },
          docRefs: [],
          allocations: null,
          urgent: false,
        },
        pu,
      );
      rec.totalCents = rec.totalCents || mul(rec.qtyMilli, rec.unitCents);
      this.state.purchases.push(rec);
      this._log(user, "addPurchase", rec.number);
      return rec;
    }
    recordReturn(purchaseId, amountCents, user) {
      // PUR-09
      const pu = this.state.purchases.find((x) => x.id === purchaseId);
      pu.status.returnedCents += amountCents;
      this._log(user, "recordReturn", pu.number);
    }
    committedCostCents(projectId) {
      // FIN-02: committed = orders net of returns
      return sum(
        this.state.purchases.filter((p) => p.projectId === projectId),
        (p) => p.totalCents - p.status.returnedCents,
      );
    }

    /* =========================== CAP — document capture =========================== */
    captureDocument(doc, user) {
      // CAP-01..10
      if (!LISTS.docTypes.includes(doc.docType)) throw new Error("Unsupported document type"); // CAP-02
      const rec = Object.assign(
        {
          id: this._id("cap"),
          capturedAt: this.state.today,
          capturedBy: user || "operations",
          device: "mobile",
          docType: doc.docType,
          imageRef: doc.imageRef || null,
          machineReadable: doc.machineReadable !== false,
          extracted: null,
          confirmed: null,
          status: "captured",
          allocations: [],
          billId: null,
          keyFields: doc.keyFields || {}, // CAP-10 manual key fields for photos with no text
        },
        {},
      );
      // CAP-04: attempted extraction, ALWAYS pending human confirmation
      if (doc.extractable) {
        rec.extracted = clone(doc.extractable);
        rec.status = "extracted";
        rec.extractionConfidence = doc.confidence ?? 0.8;
      }
      this.state.captured.push(rec);
      this._log(user, "captureDocument", rec.id);
      return rec;
    }
    confirmCapture(capId, confirmed, user) {
      // CAP-04 human confirmation; CAP-05 duplicates
      const c = this.state.captured.find((x) => x.id === capId);
      const dup = this.state.captured.find(
        (x) =>
          x.id !== capId &&
          x.confirmed &&
          x.confirmed.issuerTaxId === confirmed.issuerTaxId &&
          x.confirmed.docNumber === confirmed.docNumber,
      );
      c.duplicateSuspect = dup ? dup.id : null;
      c.confirmed = clone(confirmed);
      c.status = "validated";
      c.stdName = [confirmed.issuerName, c.docType, confirmed.docNumber, confirmed.date]
        .filter(Boolean)
        .join("_")
        .replace(/\s+/g, "-"); // CAP-08/DOC-04
      this._log(user, "confirmCapture", capId);
      return c;
    }
    allocateCapture(capId, allocations, user) {
      // CAP-03/07: one project, split, or overhead
      const c = this.state.captured.find((x) => x.id === capId);
      const total = c.confirmed ? c.confirmed.totalCents : sum(allocations, (a) => a.amountCents);
      if (Math.abs(sum(allocations, (a) => a.amountCents) - total) > 1)
        throw new Error("Split must total the document amount"); // 7.4
      c.allocations = allocations.map((a) => ({
        projectId: a.projectId || null,
        overheadCategory: a.overheadCategory || null,
        chapterNum: a.chapterNum || null,
        kind: a.kind || "material",
        amountCents: a.amountCents,
      }));
      c.status = "allocated";
      this._log(user, "allocateCapture", capId);
      return c;
    }

    /* =========================== AR — invoices, receipts, collections =========================== */
    issueInvoice(inv, user) {
      // AR-01..04 / VFU-01/02
      const p = this.project(inv.projectId);
      this._requireComplete(p.partyId, "invoice"); // MDM-10
      const contract = p.contractId
        ? this.state.contracts.find((c) => c.id === p.contractId)
        : null;
      const firstForProject = !this.state.invoices.some(
        (i) => i.projectId === p.id && i.kind !== "creditNote",
      );
      if (contract && firstForProject && !contract.signature.customerSignedAt)
        throw new Error("First invoice blocked: contract not signed (CON-11)");
      const party = this.party(p.partyId);
      const baseCents = cents(inv.baseCents);
      const vatBp = inv.vatBp != null ? inv.vatBp : p.vatBp;
      const vatCents = pctOf(baseCents, vatBp);
      const irpfBp = inv.irpfBp || 0; // AR-07 customer withholds
      const irpfCents = pctOf(baseCents, irpfBp);
      const isCredit = inv.kind === "creditNote";
      const rec = {
        id: this._id("inv"),
        number: this.nextNumber(isCredit ? "creditNote" : "invoice"),
        kind: inv.kind || "progress",
        date: this.state.today,
        partyId: p.partyId,
        projectId: p.id,
        budgetNumber: p.budgetNumber, // AR-03
        worksAddress: inv.worksAddress || "",
        lines: inv.lines || [{ desc: inv.desc || "Certificación de obra", amountCents: baseCents }],
        baseCents,
        vatBp,
        vatCents,
        irpfBp,
        irpfCents,
        totalCents: baseCents + vatCents - irpfCents,
        dueDate: addDays(this.state.today, party.paymentTermsDays || 30),
        paymentMethod: party.paymentMethod,
        iban: this.state.config.iban, // AR-02
        rectifies: inv.rectifies || null,
        rectifyReason: inv.rectifyReason || null, // VFU-02
        installmentIdx: inv.installmentIdx != null ? inv.installmentIdx : null,
        changeId: inv.changeId || null,
        immutable: true,
        docRef: null,
      };
      if (isCredit && !rec.rectifies)
        throw new Error("Credit note must reference the original invoice (AR-10/VFU-02)");
      if (rec.changeId) {
        // extras: only approved are billable (CHG-04)
        const ch = this.state.changes.find((x) => x.id === rec.changeId);
        if (!["approved", "executed"].includes(ch.status))
          throw new Error("Unapproved extra is not billable (CHG-04)");
        ch.status = "invoiced";
        ch.invoiceId = rec.id;
      }
      rec.docRef = this._docName("factura", { number: rec.number, partyId: rec.partyId }, null); // DOC-01/04
      // VFU-01: chained event record
      const prev = this.state.invoiceEvents.length
        ? this.state.invoiceEvents[this.state.invoiceEvents.length - 1].hash
        : "GENESIS";
      const hash = djb2(prev + rec.number + rec.date + rec.totalCents);
      this.state.invoiceEvents.push({
        number: rec.number,
        date: rec.date,
        totalCents: rec.totalCents,
        prev,
        hash,
      });
      this.state.invoices.push(rec);
      if (contract && rec.installmentIdx != null) {
        const i = contract.installments[rec.installmentIdx];
        i.status = "invoiced";
        i.invoiceId = rec.id;
      }
      this._log(user, "issueInvoice", rec.number + " " + rec.totalCents);
      return rec;
    }
    issueReceipt(r, user) {
      // AR-05: numbered receipt for on-account/cash
      const rec = Object.assign(
        {
          id: this._id("rec"),
          number: this.nextNumber("receipt"),
          date: this.state.today,
          partyId: null,
          projectId: null,
          budgetNumber: null,
          amountCents: 0,
          method: "cash",
          printable: true,
          allocatedToInvoiceId: null,
        },
        r,
      );
      this.state.receipts.push(rec);
      this._log(user, "issueReceipt", rec.number);
      return rec;
    }
    recordCollection(col, user) {
      // AR-06: allocations incl. partial + on-account
      const rec = Object.assign(
        {
          id: this._id("col"),
          date: this.state.today,
          partyId: null,
          amountCents: 0,
          method: "transfer",
          allocations: [],
          onAccountCents: 0,
          movementId: null, // {invoiceId, amountCents}
        },
        col,
      );
      const allocated = sum(rec.allocations, (a) => a.amountCents);
      rec.onAccountCents = rec.amountCents - allocated;
      if (rec.onAccountCents < 0) throw new Error("Allocations exceed the amount received");
      this.state.collections.push(rec);
      this._log(user, "recordCollection", rec.amountCents + "c");
      return rec;
    }
    invoiceOutstandingCents(invId) {
      // AR-08
      const inv = this.state.invoices.find((i) => i.id === invId);
      const collected = sum(this.state.collections, (c) =>
        sum(
          c.allocations.filter((a) => a.invoiceId === invId),
          (a) => a.amountCents,
        ),
      );
      const credited = sum(
        this.state.invoices.filter((i) => i.rectifies === invId),
        (i) => i.totalCents,
      );
      return inv.kind === "creditNote" ? 0 : inv.totalCents - collected - credited;
    }
    receivables() {
      // AR-08 follow-up list
      const t = this.state.today;
      return this.state.invoices
        .filter((i) => i.kind !== "creditNote")
        .map((i) => {
          const out = this.invoiceOutstandingCents(i.id);
          return {
            number: i.number,
            partyId: i.partyId,
            party: this.party(i.partyId).name,
            contact: this.party(i.partyId).mobile || this.party(i.partyId).email,
            projectId: i.projectId,
            totalCents: i.totalCents,
            outstandingCents: out,
            dueDate: i.dueDate,
            daysOverdue: out > 0 ? Math.max(0, daysBetween(t, i.dueDate)) : 0,
          };
        })
        .filter((x) => x.outstandingCents > 0.005 || true);
    }
    projectBilling(projectId) {
      // AR-09
      const invs = this.state.invoices.filter((i) => i.projectId === projectId);
      const invoiced =
        sum(
          invs.filter((i) => i.kind !== "creditNote"),
          (i) => i.totalCents,
        ) -
        sum(
          invs.filter((i) => i.kind === "creditNote"),
          (i) => i.totalCents,
        );
      const outstanding = sum(
        invs.filter((i) => i.kind !== "creditNote"),
        (i) => this.invoiceOutstandingCents(i.id),
      );
      const ec = this.projectEconomics(projectId);
      const totalWithVat =
        ec.currentRevenueCents + pctOf(ec.currentRevenueCents, this.project(projectId).vatBp);
      return {
        invoicedCents: invoiced,
        collectedCents: invoiced - outstanding,
        outstandingCents: outstanding,
        remainingToInvoiceCents: Math.max(0, totalWithVat - invoiced),
      };
    }

    /* =========================== AP — supplier bills & payments =========================== */
    registerBill(b, user) {
      // AP-01/02/03/07
      const supplier = this.party(b.supplierId);
      const dup = this.state.bills.find(
        (x) => x.supplierId === b.supplierId && x.number === b.number,
      ); // AP-03
      const baseCents = cents(b.baseCents);
      const vatCents =
        b.vatCents != null ? cents(b.vatCents) : pctOf(baseCents, b.vatBp != null ? b.vatBp : 2100);
      const irpfBp = b.irpfBp != null ? b.irpfBp : supplier.irpfApplies ? supplier.irpfRateBp : 0; // AP-07 from profile
      const irpfCents = pctOf(baseCents, irpfBp);
      const rec = Object.assign(
        {
          id: this._id("bil"),
          supplierId: b.supplierId,
          number: b.number,
          date: b.date || this.state.today,
          dueDate:
            b.dueDate || addDays(b.date || this.state.today, supplier.paymentTermsDays || 30), // AP-05
          baseCents,
          vatBp: b.vatBp != null ? b.vatBp : 2100,
          vatCents,
          irpfBp,
          irpfCents,
          totalCents: baseCents + vatCents - irpfCents,
          allocations: b.allocations || [], // AP-02 {projectId|overheadCategory, chapterNum, kind, amountCents}
          docRef: b.docRef || null,
          capId: b.capId || null,
          status: "registered",
          disputed: false,
          duplicateSuspect: dup ? dup.id : null,
          creditNoteFor: b.creditNoteFor || null, // AP-09
        },
        {},
      );
      if (rec.allocations.length) {
        const s = sum(rec.allocations, (a) => a.amountCents);
        if (Math.abs(s - rec.baseCents) > 1)
          throw new Error("Bill allocations must total the taxable base");
      }
      this.state.bills.push(rec);
      if (rec.capId) {
        const c = this.state.captured.find((x) => x.id === rec.capId);
        if (c) {
          c.billId = rec.id;
        }
      }
      const pu = this.state.purchases.find(
        (x) =>
          x.supplierId === rec.supplierId && x.orderRef && b.orderRef && x.orderRef === b.orderRef,
      );
      if (pu) pu.status.invoicedBillId = rec.id; // PUR-03/04
      this._log(user, "registerBill", supplier.name + " " + rec.number);
      return rec;
    }
    billOutstandingCents(billId) {
      const b = this.state.bills.find((x) => x.id === billId);
      const paid = sum(this.state.payments, (p) =>
        sum(
          p.billAllocations.filter((a) => a.billId === billId),
          (a) => a.amountCents,
        ),
      );
      const credited = sum(
        this.state.bills.filter((x) => x.creditNoteFor === billId),
        (x) => x.totalCents,
      );
      return b.totalCents - paid - credited;
    }
    payBills(pay, user) {
      // AP-04: partial + one payment many bills
      const rec = Object.assign(
        {
          id: this._id("pay"),
          date: this.state.today,
          method: "transfer",
          amountCents: 0,
          billAllocations: [],
          proofRef: null,
          movementId: null, // AP-08
        },
        pay,
      );
      const s = sum(rec.billAllocations, (a) => a.amountCents);
      if (Math.abs(s - rec.amountCents) > 1)
        throw new Error("Payment must equal its bill allocations");
      this.state.payments.push(rec);
      for (const a of rec.billAllocations) {
        const b = this.state.bills.find((x) => x.id === a.billId);
        b.status = this.billOutstandingCents(b.id) <= 0 ? "paid" : "partPaid"; // AP-06
      }
      this._log(user, "payBills", rec.amountCents + "c");
      return rec;
    }
    payables() {
      // AP-06
      const t = this.state.today;
      return this.state.bills
        .filter((b) => !b.creditNoteFor)
        .map((b) => ({
          id: b.id,
          supplier: this.party(b.supplierId).name,
          number: b.number,
          dueDate: b.dueDate,
          totalCents: b.totalCents,
          outstandingCents: this.billOutstandingCents(b.id),
          status: b.disputed
            ? "disputed"
            : this.billOutstandingCents(b.id) <= 0
              ? "paid"
              : daysBetween(t, b.dueDate) > 0
                ? "overdue"
                : b.status,
          unallocated: !b.allocations.length,
        }));
    }

    /* =========================== BNK — bank, cash, reconciliation =========================== */
    addBankAccount(a, user) {
      // BNK-06
      const rec = Object.assign(
        { id: this._id("bank"), name: "", kind: "bank", iban: "", openingCents: 0 },
        a,
      );
      this.state.bankAccounts.push(rec);
      this._log(user, "addBankAccount", rec.name);
      return rec;
    }
    importMovements(accountId, rows, user) {
      // BNK-01: retain all export fields
      const out = rows.map((r) => {
        const rec = {
          id: this._id("mov"),
          accountId,
          accountingDate: r.accountingDate,
          valueDate: r.valueDate || r.accountingDate,
          opCode: r.opCode || "",
          concept: r.concept || "",
          counterparty: r.counterparty || "",
          merchantText: r.merchantText || "",
          observations: r.observations || "",
          reference: r.reference || "",
          amountCents: cents(r.amountCents),
          balanceCents: r.balanceCents ?? null,
          currency: "EUR",
          card: r.card || null,
          class: null,
          allocations: [],
          matched: null,
          status: "unallocated",
          needsDoc: false, // BNK-03/04
        };
        const rule = this.state.merchantRules.find(
          (m) => rec.merchantText && rec.merchantText.toUpperCase().includes(m.match),
        ); // BNK-05
        if (rule)
          rec.suggestion = {
            supplierId: rule.supplierId,
            category: rule.category,
            projectId: rule.projectId || null,
          };
        this.state.movements.push(rec);
        return rec;
      });
      this._log(user, "importMovements", rows.length + " movs");
      return out;
    }
    allocateMovementToProject(movId, ref, kind, user) {
      // BNK-02: enter a budget/project number → cost lands on the project
      const m = this.state.movements.find((x) => x.id === movId);
      const p =
        this.state.projects.find((x) => x.code === ref || x.budgetNumber === ref) ||
        this.project(ref);
      if (!LISTS.costKinds.includes(kind || "material")) throw new Error("Unknown cost kind");
      m.class = m.amountCents < 0 ? "projectCost" : "customerReceipt";
      m.allocations = [
        { projectId: p.id, kind: kind || "material", amountCents: Math.abs(m.amountCents) },
      ];
      m.status = "allocated";
      this._log(user, "allocateMovement", (m.merchantText || m.concept) + " → " + p.code);
      return m;
    }
    splitMovement(movId, allocations, user) {
      // BNK-09
      const m = this.state.movements.find((x) => x.id === movId);
      if (Math.abs(sum(allocations, (a) => a.amountCents) - Math.abs(m.amountCents)) > 1)
        throw new Error("Split must total the movement");
      m.allocations = allocations;
      m.class = "projectCost";
      m.status = "allocated";
      this._log(user, "splitMovement", movId);
      return m;
    }
    classifyMovement(movId, klass, user) {
      // BNK-03
      const m = this.state.movements.find((x) => x.id === movId);
      if (!LISTS.movementClasses.includes(klass)) throw new Error("Unknown movement class");
      m.class = klass;
      m.status = "allocated";
      if (klass === "internalTransfer") m.excludedFromPL = true; // must not distort income/expense
      this._log(user, "classifyMovement", movId + " → " + klass);
      return m;
    }
    matchMovement(movId, target, user) {
      // BNK-04
      const m = this.state.movements.find((x) => x.id === movId);
      m.matched = target;
      m.status = "matched";
      if (target.billId) {
        const pays = this.state.payments.find((p) => p.movementId === movId);
        if (!pays)
          this.payBills(
            {
              amountCents: Math.abs(m.amountCents),
              method: m.card ? "card" : "transfer",
              billAllocations: [{ billId: target.billId, amountCents: Math.abs(m.amountCents) }],
              movementId: movId,
            },
            user,
          );
        m.class = "projectCost";
      }
      if (target.invoiceId) {
        this.recordCollection(
          {
            partyId: this.state.invoices.find((i) => i.id === target.invoiceId).partyId,
            amountCents: m.amountCents,
            method: "transfer",
            allocations: [{ invoiceId: target.invoiceId, amountCents: m.amountCents }],
            movementId: movId,
          },
          user,
        );
        m.class = "customerReceipt";
      }
      this._log(user, "matchMovement", movId);
      return m;
    }
    learnMerchantRule(match, mapping, user) {
      // BNK-05
      this.state.merchantRules.push({ match: match.toUpperCase(), ...mapping });
      this._log(user, "learnMerchantRule", match);
    }
    recordCashMovement(tillId, mv, user) {
      // BNK-07: same discipline; flags when undocumented
      const rec = this.importMovements(tillId, [{ ...mv, opCode: "CASH" }], user)[0];
      if (!mv.supportingDocRef) {
        rec.needsDoc = true;
      } // flagged, never hidden
      rec.handledBy = mv.handledBy || user;
      return rec;
    }
    accountBalanceCents(accountId) {
      const acc = this.state.bankAccounts.find((a) => a.id === accountId);
      return (
        acc.openingCents +
        sum(
          this.state.movements.filter((m) => m.accountId === accountId),
          (m) => m.amountCents,
        )
      );
    }
    cashPosition() {
      // BNK-08
      return {
        accounts: this.state.bankAccounts.map((a) => ({
          name: a.name,
          kind: a.kind,
          balanceCents: this.accountBalanceCents(a.id),
        })),
        totalCents: sum(this.state.bankAccounts, (a) => this.accountBalanceCents(a.id)),
      };
    }
    cashForecast(weeks = 13) {
      // FIN-06 / BNK-08: weekly expected in/out
      const t = this.state.today,
        out = [];
      for (let w = 0; w < weeks; w++) {
        const from = addDays(t, w * 7),
          to = addDays(t, w * 7 + 6);
        let inflow = 0,
          outflow = 0;
        for (const r of this.receivables())
          if (r.outstandingCents > 0 && r.dueDate >= from && r.dueDate <= to)
            inflow += r.outstandingCents;
        for (const c of this.state.contracts)
          for (const i of c.installments)
            if (
              i.status === "planned" &&
              i.expectedDate &&
              i.expectedDate >= from &&
              i.expectedDate <= to
            )
              inflow += i.amountCents;
        for (const b of this.payables())
          if (b.outstandingCents > 0 && b.dueDate >= from && b.dueDate <= to)
            outflow += b.outstandingCents;
        out.push({
          from,
          to,
          inflowCents: inflow,
          outflowCents: outflow,
          netCents: inflow - outflow,
        });
      }
      return out;
    }

    /* =========================== LAB — labour hours =========================== */
    addWorker(w, user) {
      // LAB-04/05
      const rec = Object.assign(
        { id: this._id("wkr"), name: "", kind: "employee", rateHistory: [] },
        w,
      ); // rateHistory {from, rateCentsPerHour}
      this.state.workers.push(rec);
      this._log(user, "addWorker", rec.name);
      return rec;
    }
    workerRateCents(workerId, date) {
      // LAB-05 with history
      const w = this.state.workers.find((x) => x.id === workerId);
      const applicable = w.rateHistory
        .filter((r) => r.from <= date)
        .sort((a, b) => b.from.localeCompare(a.from));
      if (!applicable.length) throw new Error("No rate effective for " + date);
      return applicable[0].rateCentsPerHour;
    }
    recordHours(h, user) {
      // LAB-01/02/03 + LAB-07 (kind: normal|extra|festivo; optional extra-pay supplement)
      const rec = Object.assign(
        {
          id: this._id("lab"),
          workerId: null,
          projectId: null,
          chapterNum: null,
          date: this.state.today,
          hoursMilli: 0,
          kind: "normal",
          extraPayCents: 0,
        },
        h,
      );
      rec.rateCents = this.workerRateCents(rec.workerId, rec.date);
      rec.costCents = mul(rec.hoursMilli, rec.rateCents) + (rec.extraPayCents || 0);
      this.state.labour.push(rec);
      return rec;
    }
    labourCostCents(projectId) {
      return sum(
        this.state.labour.filter((l) => l.projectId === projectId),
        (l) => l.costCents,
      );
    }
    labourExport() {
      // LAB-09
      return this.state.labour.map((l) => ({
        worker: this.state.workers.find((w) => w.id === l.workerId).name,
        kind: this.state.workers.find((w) => w.id === l.workerId).kind,
        project: l.projectId ? this.project(l.projectId).code : null,
        date: l.date,
        hours: l.hoursMilli / 1000,
        costCents: l.costCents,
      }));
    }

    /* =========================== FIN — project economics =========================== */
    actualCostCents(projectId) {
      // FIN-02: bills + labour + direct movement allocations (no double count with matched bills)
      const bills =
        sum(
          this.state.bills.filter((b) => !b.creditNoteFor),
          (b) =>
            sum(
              b.allocations.filter((a) => a.projectId === projectId),
              (a) => a.amountCents,
            ),
        ) -
        sum(
          this.state.bills.filter((b) => b.creditNoteFor),
          (b) =>
            sum(
              b.allocations.filter((a) => a.projectId === projectId),
              (a) => a.amountCents,
            ),
        ); // AP-09 reduces
      const labour = this.labourCostCents(projectId);
      const billMovIds = new Set(this.state.payments.map((p) => p.movementId).filter(Boolean));
      const direct = sum(
        this.state.movements.filter(
          (m) => m.class === "projectCost" && !billMovIds.has(m.id) && !m.matched,
        ),
        (m) =>
          sum(
            m.allocations.filter((a) => a.projectId === projectId),
            (a) => a.amountCents,
          ),
      );
      const captured = sum(
        this.state.captured.filter(
          (c) => c.status === "allocated" && !c.billId && ["ticket"].includes(c.docType),
        ),
        (c) =>
          sum(
            c.allocations.filter((a) => a.projectId === projectId),
            (a) => a.amountCents,
          ),
      );
      return bills + labour + direct + captured;
    }
    projectEconomics(projectId) {
      // FIN-01/02/03
      const p = this.project(projectId);
      const approved = this.state.changes.filter(
        (c) => c.projectId === projectId && ["approved", "executed", "invoiced"].includes(c.status),
      );
      const changesPrice = sum(approved, (c) => c.priceCents),
        changesCost = sum(approved, (c) => c.costCents);
      const currentRevenueCents = p.baseline.revenueCents + changesPrice;
      const committed = this.committedCostCents(projectId);
      const actual = this.actualCostCents(projectId);
      const forecastCost = Math.max(p.baseline.costCents + changesCost, committed, actual);
      return {
        baselineRevenueCents: p.baseline.revenueCents,
        approvedChangesCents: changesPrice,
        currentRevenueCents,
        baselineCostCents: p.baseline.costCents,
        changesCostCents: changesCost,
        committedCents: committed,
        actualCents: actual,
        forecastCostCents: forecastCost,
        marginBaselineCents: p.baseline.marginCents,
        marginForecastCents: currentRevenueCents - forecastCost,
        marginForecastPct: currentRevenueCents
          ? Math.round(((currentRevenueCents - forecastCost) / currentRevenueCents) * 1000) / 10
          : 0,
        marginFinalCents: p.closed ? currentRevenueCents - actual : null,
        perM2Cents: p.surfaceM2 > 0 ? Math.round(currentRevenueCents / p.surfaceM2) : null, // FIN-08
        progressPct: this.projectProgressPct(projectId),
      };
    }
    chapterEconomics(projectId) {
      // FIN-03 at chapter level
      const p = this.project(projectId);
      const actualByCh = {};
      for (const b of this.state.bills)
        for (const a of b.allocations)
          if (a.projectId === projectId && a.chapterNum)
            actualByCh[a.chapterNum] =
              (actualByCh[a.chapterNum] || 0) + (b.creditNoteFor ? -a.amountCents : a.amountCents);
      for (const l of this.state.labour)
        if (l.projectId === projectId && l.chapterNum)
          actualByCh[l.chapterNum] = (actualByCh[l.chapterNum] || 0) + l.costCents;
      return p.baseline.chapters.map((c) => ({
        num: c.num,
        name: c.name,
        saleCents: c.saleCents,
        budgetCostCents: c.costCents,
        actualCents: actualByCh[c.num] || 0,
        overrun: (actualByCh[c.num] || 0) > c.costCents,
      }));
    }
    unallocatedSummary() {
      // FIN-04: quantified
      const bills = this.state.bills.filter((b) => !b.allocations.length);
      const movs = this.state.movements.filter(
        (m) => m.status === "unallocated" && !m.excludedFromPL,
      );
      const caps = this.state.captured.filter(
        (c) => !["allocated", "sentToAccounting", "paid"].includes(c.status),
      );
      const lab = this.state.labour.filter((l) => !l.projectId);
      return {
        billsCount: bills.length,
        billsCents: sum(bills, (b) => b.totalCents),
        movementsCount: movs.length,
        movementsCents: sum(movs, (m) => Math.abs(m.amountCents)),
        capturesCount: caps.length,
        labourCount: lab.length,
        labourCents: sum(lab, (l) => l.costCents),
      };
    }
    profitability(groupBy) {
      // FIN-08: by customer/activityLine/type/period
      const groups = {};
      for (const p of this.state.projects) {
        const ec = this.projectEconomics(p.id);
        const key =
          groupBy === "customer"
            ? this.party(p.partyId).name
            : groupBy === "activityLine"
              ? p.activityLine
              : p.status;
        const g = (groups[key] = groups[key] || { revenueCents: 0, costCents: 0, projects: 0 });
        g.revenueCents += ec.currentRevenueCents;
        g.costCents += ec.forecastCostCents;
        g.projects++;
      }
      return Object.entries(groups).map(([key, g]) => ({
        key,
        ...g,
        marginCents: g.revenueCents - g.costCents,
        marginPct: g.revenueCents
          ? Math.round(((g.revenueCents - g.costCents) / g.revenueCents) * 1000) / 10
          : 0,
      }));
    }
    overheadCents() {
      // FIN-07 separate from project cost
      const bills = sum(this.state.bills, (b) =>
        sum(
          b.allocations.filter((a) => a.overheadCategory),
          (a) => a.amountCents,
        ),
      );
      const movs = sum(
        this.state.movements.filter((m) => m.class === "overhead" || m.class === "salary"),
        (m) => Math.abs(m.amountCents),
      );
      return bills + movs;
    }
    closeProject(projectId, user) {
      // stage 16
      const p = this.project(projectId);
      p.closed = true;
      p.status = "closed";
      p.dates.actualEnd = this.state.today;
      const con = p.contractId ? this.state.contracts.find((c) => c.id === p.contractId) : null;
      if (con) {
        con.status = "completed";
        con.duration.actualFinish = this.state.today;
        con.guarantees.forEach((g) => {
          g.startDate = this.state.today;
          g.expiryDate = addDays(this.state.today, Math.round(g.months * 30.44));
        }); // CON-08 warranty register
      }
      this._log(user, "closeProject", p.code);
      return this.projectEconomics(projectId);
    }

    /* =========================== GES — accounting package =========================== */
    vatSummary(quarter) {
      // GES-03 reconciled to registers
      const inQ = (d) => quarterOf(d) === quarter;
      const byRate = {};
      for (const i of this.state.invoices.filter((x) => inQ(x.date))) {
        const r = (byRate[i.vatBp] = byRate[i.vatBp] || {
          outputBaseCents: 0,
          outputVatCents: 0,
          inputBaseCents: 0,
          inputVatCents: 0,
        });
        const sign = i.kind === "creditNote" ? -1 : 1;
        r.outputBaseCents += sign * i.baseCents;
        r.outputVatCents += sign * i.vatCents;
      }
      for (const b of this.state.bills.filter((x) => inQ(x.date))) {
        const r = (byRate[b.vatBp] = byRate[b.vatBp] || {
          outputBaseCents: 0,
          outputVatCents: 0,
          inputBaseCents: 0,
          inputVatCents: 0,
        });
        const sign = b.creditNoteFor ? -1 : 1;
        r.inputBaseCents += sign * b.baseCents;
        r.inputVatCents += sign * b.vatCents;
      }
      const outputVat = sum(Object.values(byRate), (r) => r.outputVatCents),
        inputVat = sum(Object.values(byRate), (r) => r.inputVatCents);
      return {
        quarter,
        byRate,
        outputVatCents: outputVat,
        inputVatCents: inputVat,
        netCents: outputVat - inputVat,
      };
    }
    irpfSummary(quarter) {
      // GES-04
      const inQ = (d) => quarterOf(d) === quarter;
      const retained = sum(
        this.state.bills.filter((b) => inQ(b.date) && b.irpfCents > 0),
        (b) => b.irpfCents,
      );
      const suffered = sum(
        this.state.invoices.filter((i) => inQ(i.date) && i.irpfCents > 0),
        (i) => i.irpfCents,
      );
      return { quarter, retainedCents: retained, sufferedCents: suffered };
    }
    exceptionList(quarter) {
      // GES-07
      const inQ = (d) => quarterOf(d) === quarter;
      return {
        billsWithoutDocument: this.state.bills
          .filter((b) => inQ(b.date) && !b.docRef && !b.capId)
          .map((b) => b.number),
        partiesWithoutTaxId: [
          ...new Set([
            ...this.state.invoices.filter((i) => inQ(i.date)).map((i) => i.partyId),
            ...this.state.bills.filter((b) => inQ(b.date)).map((b) => b.supplierId),
          ]),
        ]
          .filter((id) => !validTaxId(this.party(id).taxId))
          .map((id) => this.party(id).code),
        unallocatedMovements: this.state.movements
          .filter((m) => m.status === "unallocated" && inQ(m.accountingDate))
          .map((m) => m.id),
        unmatchedReceipts: this.state.receipts
          .filter((r) => inQ(r.date) && !r.allocatedToInvoiceId)
          .map((r) => r.number),
        seriesGaps: { invoice: this.seriesGaps("invoice"), receipt: this.seriesGaps("receipt") },
        undocumentedCash: this.state.movements
          .filter((m) => m.needsDoc && inQ(m.accountingDate))
          .map((m) => m.id),
      };
    }
    quarterlyPackage(quarter, user) {
      // GES-01/02/06/08
      const inQ = (d) => quarterOf(d) === quarter;
      const txFromInvoice = (i) => {
        const sg = i.kind === "creditNote" ? -1 : 1; // a rectificativa registers negative
        return {
          // GES-02 transaction dictionary
          partyCode: this.party(i.partyId).code,
          accountingCode: this.party(i.partyId).accountingCode,
          partyName: this.party(i.partyId).name,
          direction: "sale",
          category: "obra",
          invoiceExists: true,
          invoiceNumber: i.number,
          budgetRef: i.budgetNumber,
          date: i.date,
          treatment: "income",
          baseCents: sg * i.baseCents,
          vatBp: i.vatBp,
          vatCents: sg * i.vatCents,
          totalCents: sg * i.totalCents,
          irpfBp: i.irpfBp,
          irpfCents: sg * i.irpfCents,
          dueDate: i.dueDate,
          paymentMethod: i.paymentMethod,
          paidCents: sg * (i.totalCents - this.invoiceOutstandingCents(i.id)),
          docRef: i.docRef,
        };
      };
      const txFromBill = (b) => ({
        partyCode: this.party(b.supplierId).code,
        accountingCode: this.party(b.supplierId).accountingCode,
        partyName: this.party(b.supplierId).name,
        direction: "purchase",
        category: b.allocations[0]
          ? b.allocations[0].overheadCategory || "projectCost"
          : "unallocated",
        invoiceExists: true,
        invoiceNumber: b.number,
        budgetRef:
          b.allocations[0] && b.allocations[0].projectId
            ? this.project(b.allocations[0].projectId).budgetNumber
            : null,
        date: b.date,
        treatment: "expense",
        baseCents: b.baseCents,
        vatBp: b.vatBp,
        vatCents: b.vatCents,
        totalCents: b.totalCents,
        irpfBp: b.irpfBp,
        irpfCents: b.irpfCents,
        dueDate: b.dueDate,
        paidCents: b.totalCents - this.billOutstandingCents(b.id),
        docRef: b.docRef || b.capId,
      });
      const pkg = {
        quarter,
        generatedAt: this.state.today,
        issuedInvoices: this.state.invoices.filter((i) => inQ(i.date)).map(txFromInvoice),
        receivedBills: this.state.bills.filter((b) => inQ(b.date)).map(txFromBill),
        bankMovements: this.state.movements.filter((m) => inQ(m.accountingDate)),
        cashRecords: this.state.movements.filter(
          (m) =>
            inQ(m.accountingDate) &&
            this.state.bankAccounts.find((a) => a.id === m.accountId && a.kind === "till"),
        ),
        vat: this.vatSummary(quarter),
        irpf: this.irpfSummary(quarter),
        exceptions: this.exceptionList(quarter),
        lateItems: this.state.captured.filter(
          (c) => c.confirmed && inQ(c.confirmed.date) && quarterOf(c.capturedAt) > quarter,
        ),
      };
      this.state.packagesSent.push({
        quarter,
        date: this.state.today,
        invoices: pkg.issuedInvoices.length,
        bills: pkg.receivedBills.length,
        exceptions: Object.values(pkg.exceptions).flat(2).length,
      }); // GES-08
      // mark captured docs as sent
      this.state.captured
        .filter((c) => c.status === "allocated" && c.confirmed && inQ(c.confirmed.date))
        .forEach((c) => (c.status = "sentToAccounting"));
      this._log(user, "quarterlyPackage", quarter);
      return pkg;
    }

    /* =========================== DAS — alerts, tasks, control tower =========================== */
    addTask(t, user) {
      // DAS-07
      const rec = Object.assign(
        {
          id: this._id("tsk"),
          owner: "backoffice",
          due: this.state.today,
          status: "open",
          relatedRef: null,
          title: "",
        },
        t,
      );
      this.state.tasks.push(rec);
      return rec;
    }
    alerts() {
      // 8.2 + DAS-06 — every alert carries a drill-down ref (DAS-03)
      const t = this.state.today,
        A = [];
      const push = (sev, msg, ref) => A.push({ sev, msg, ref });
      for (const r of this.receivables())
        if (r.outstandingCents > 0 && r.daysOverdue > 0)
          push("critical", `Factura ${r.number} vencida ${r.daysOverdue} días (${r.party})`, {
            invoice: r.number,
          });
      for (const c of this.state.contracts)
        for (const i of c.installments)
          if (i.status === "planned" && i.expectedDate && i.expectedDate < t)
            push("critical", `Hito de cobro vencido — ${c.number}`, { contract: c.number });
      const cash7 = this.cashForecast(1)[0];
      if (cash7 && cash7.outflowCents > cash7.inflowCents + this.cashPosition().totalCents)
        push("critical", "Pagos previstos superan cobros esperados + caja", {
          view: "cashForecast",
        });
      for (const p of this.state.projects.filter((x) => !x.closed)) {
        const ec = this.projectEconomics(p.id);
        if (ec.marginForecastCents < 0)
          push("critical", `Margen negativo — ${p.code}`, { project: p.code });
        else if (ec.marginForecastPct * 100 < this.state.config.marginThresholdBp / 100)
          push("critical", `Margen bajo umbral — ${p.code} (${ec.marginForecastPct}%)`, {
            project: p.code,
          });
        const con = p.contractId ? this.state.contracts.find((c) => c.id === p.contractId) : null;
        if (con) {
          if (!con.signature.customerSignedAt && p.dates.start)
            push("critical", `Obra iniciada sin contrato firmado — ${p.code}`, {
              contract: con.number,
            });
          if (
            con.initiation.committedStartDate &&
            !con.duration.actualStart &&
            con.initiation.committedStartDate <= addDays(t, 3)
          )
            push("critical", `Fecha de inicio comprometida en riesgo — ${p.code}`, {
              contract: con.number,
            });
          if (
            con.duration.actualStart &&
            con.duration.estimatedDays &&
            !con.duration.actualFinish &&
            daysBetween(t, con.duration.actualStart) > con.duration.estimatedDays
          )
            push("critical", `Duración contractual excedida — ${p.code}`, { contract: con.number });
        }
      }
      for (const b of this.state.budgets.filter((x) => x.status === "issued")) {
        const tt = this.budgetTotals(b.id, b.currentVersionId);
        if (tt.pendingCount > 0)
          push("high", `Presupuesto ${b.number} emitido con ${tt.pendingCount} líneas pendientes`, {
            budget: b.number,
          });
        if (b.validityDate <= addDays(t, 7) && !b.acceptedVersionId)
          push("high", `Presupuesto ${b.number} caduca el ${b.validityDate}`, { budget: b.number });
      }
      for (const o of this.opportunityAges())
        if (o.ageDays > 14 && ["awaitingBudget", "awaitingResponse"].includes(o.status))
          push("high", `Oportunidad sin avance ${o.ageDays} días`, { opportunity: o.id });
      for (const pid of this.priceAlerts())
        push("high", "Precio de proveedor caducado", { price: pid });
      for (const p of this.state.projects.filter((x) => !x.closed && x.budgetId)) {
        for (const ch of this.chapterEconomics(p.id))
          if (ch.actualCents > ch.budgetCostCents && ch.budgetCostCents > 0)
            push("high", `Capítulo ${ch.num} por encima de coste previsto — ${p.code}`, {
              project: p.code,
              chapter: ch.num,
            });
      }
      for (const c of this.state.changes.filter(
        (x) => ["identified", "priced"].includes(x.status) && x.costCents > 0,
      ))
        push("high", `Extra sin aprobar con coste incurrido — ${this.project(c.projectId).code}`, {
          change: c.id,
        });
      const un = this.unallocatedSummary();
      if (un.billsCount)
        push("high", `${un.billsCount} facturas de proveedor sin asignar`, { view: "payables" });
      if (un.movementsCount)
        push("high", `${un.movementsCount} movimientos bancarios sin asignar`, { view: "bank" });
      for (const b of this.state.bills.filter((x) => x.duplicateSuspect))
        push("high", `Posible duplicado — ${b.number}`, { bill: b.number });
      for (const c of this.state.contracts)
        for (const g of c.guarantees)
          if (g.expiryDate && g.expiryDate <= addDays(t, 30) && g.expiryDate >= t)
            push("medium", `Garantía próxima a vencer — ${c.number}`, { contract: c.number });
      for (const m of this.state.movements.filter((x) => x.needsDoc))
        push("medium", "Movimiento de caja sin justificante", { movement: m.id });
      return A;
    }
    controlTower() {
      // DAS-02: consolidated, all drillable (DAS-03)
      const projects = this.state.projects.filter((p) => !p.closed);
      const invs = this.state.invoices.filter((i) => i.kind !== "creditNote");
      const invoiced =
        sum(invs, (i) => i.totalCents) -
        sum(
          this.state.invoices.filter((i) => i.kind === "creditNote"),
          (i) => i.totalCents,
        );
      const outstanding = sum(invs, (i) => this.invoiceOutstandingCents(i.id));
      const paysDue = sum(
        this.payables().filter((p) => p.outstandingCents > 0),
        (p) => p.outstandingCents,
      );
      const alerts = this.alerts();
      return {
        activeProjects: projects.map((p) => ({ code: p.code, ...this.projectEconomics(p.id) })),
        activeCount: projects.length,
        totalForecastMarginCents: sum(
          projects,
          (p) => this.projectEconomics(p.id).marginForecastCents,
        ),
        budgetedVsActual: projects.map((p) => ({
          code: p.code,
          budgetCents: p.baseline.costCents,
          actualCents: this.actualCostCents(p.id),
        })),
        invoicedCents: invoiced,
        collectedCents: invoiced - outstanding,
        outstandingCents: outstanding,
        supplierDueCents: paysDue,
        cash: this.cashPosition(),
        needAttention: projects
          .filter((p) => {
            const e = this.projectEconomics(p.id);
            return e.marginForecastCents < 0 || e.actualCents > e.baselineCostCents;
          })
          .map((p) => p.code),
        unapprovedExtras: this.state.changes.filter((c) =>
          ["identified", "priced"].includes(c.status),
        ).length,
        budgetsAwaiting: this.state.budgets
          .filter((b) => b.status === "issued" && !b.acceptedVersionId)
          .map((b) => b.number),
        awaitingValueCents: sum(
          this.state.budgets.filter((b) => b.status === "issued" && !b.acceptedVersionId),
          (b) => this.budgetTotals(b.id, b.currentVersionId).grandCents,
        ), // QUO-11
        docsAwaitingReview: this.state.captured.filter((c) =>
          ["captured", "extracted"].includes(c.status),
        ).length,
        alerts,
        alertCounts: {
          critical: alerts.filter((a) => a.sev === "critical").length,
          high: alerts.filter((a) => a.sev === "high").length,
          medium: alerts.filter((a) => a.sev === "medium").length,
        },
      };
    }
    operationalDay() {
      // DAS-04
      const t = this.state.today;
      return {
        visitsDue: this.state.opportunities
          .filter((o) => o.status === "awaitingVisit")
          .map((o) => ({ id: o.id, party: this.party(o.partyId).name })),
        milestones: this.state.projects
          .filter((p) => !p.closed && p.dates.targetEnd && p.dates.targetEnd <= addDays(t, 7))
          .map((p) => p.code),
        extrasToPrice: this.state.changes.filter((c) => c.status === "identified").length,
        hoursToReport: this.state.projects.filter((p) => !p.closed && p.dates.start).length,
        overdueTasks: this.state.tasks.filter(
          (x) => x.status === "open" && x.due < t && x.owner === "operations",
        ).length,
      };
    }
    backOfficeDay() {
      // DAS-05
      const t = this.state.today;
      return {
        budgetsToPrepare: this.state.opportunities.filter((o) => o.status === "awaitingBudget")
          .length,
        followUpsDue: this.opportunityAges().filter(
          (o) => o.status === "awaitingResponse" && o.ageDays > 7,
        ).length,
        invoicesToIssue: sum(
          this.state.contracts,
          (c) =>
            c.installments.filter(
              (i) => i.status === "planned" && i.expectedDate && i.expectedDate <= t,
            ).length,
        ),
        collectionsDue: this.receivables().filter(
          (r) => r.outstandingCents > 0 && r.daysOverdue >= 0,
        ).length,
        billsToAllocate: this.state.bills.filter((b) => !b.allocations.length).length,
        paymentsDue: this.payables().filter(
          (p) => p.outstandingCents > 0 && p.dueDate <= addDays(t, 7),
        ).length,
        docsMissing: this.state.captured.filter((c) => ["captured", "extracted"].includes(c.status))
          .length,
      };
    }

    /* =========================== gap-closure additions (BRD v2 audit) =========================== */
    markLegacy(kind, id, user) {
      // ORG-03: former-entity records readable but excluded from totals
      const coll = {
        party: this.state.parties,
        captured: this.state.captured,
        project: this.state.projects,
      }[kind];
      const rec = coll.find((x) => x.id === id);
      rec.legacy = true;
      this._log(user, "markLegacy", kind + ":" + id);
      return rec;
    }
    legacyItems() {
      // ORG-03: searchable register of legacy records
      return {
        parties: this.state.parties.filter((p) => p.legacy),
        captured: this.state.captured.filter((c) => c.legacy),
        projects: this.state.projects.filter((p) => p.legacy),
      };
    }
    addFeedback(projectId, f, user) {
      // CRM-07: satisfaction, complaints, warranty claims per project
      const p = this.project(projectId);
      this.state.feedback = this.state.feedback || [];
      const rec = Object.assign(
        {
          id: this._id("fbk"),
          projectId: p.id,
          partyId: p.partyId,
          date: this.state.today,
          kind: "satisfaction",
          rating: null,
          text: "",
          status: "open",
        },
        f,
      );
      if (!["satisfaction", "complaint", "warrantyClaim"].includes(rec.kind))
        throw new Error("Unknown feedback kind");
      this.state.feedback.push(rec);
      this._log(user, "addFeedback", p.code + " " + rec.kind);
      return rec;
    }
    validateVisit(visitId, patch, user) {
      // VIS-08: back office completes/corrects/validates the site capture
      const v = this.state.visits.find((x) => x.id === visitId);
      Object.assign(v, patch || {});
      v.validated = { by: user || "backoffice", date: this.state.today };
      this._log(user, "validateVisit", visitId);
      return v;
    }
    visitToBudgetLines(visitId, budgetId, chapterId, user) {
      // VIS-05/06: convert captured lines without retyping
      const vis = this.state.visits.find((x) => x.id === visitId);
      const out = [];
      for (const l of vis.lines || []) {
        const item = l.itemId ? this.state.catalogue.find((i) => i.id === l.itemId) : null;
        out.push(
          this.addLine(budgetId, chapterId, {
            itemId: l.itemId || null,
            code: item ? item.code : l.code || "",
            desc: l.desc || (item ? item.desc : ""),
            customerWording: item ? item.customerWording : "",
            unit: l.unit || (item ? item.unit : "ud"),
            qtyMilli: l.qtyMilli || 1000,
            priceCents: l.priceCents ?? (item ? item.defaultPriceCents : 0),
            costCents: l.costCents ?? (item ? item.defaultCostCents : 0),
          }),
        );
      }
      this._log(
        user,
        "visitToBudgetLines",
        visitId + " → " + this.budget(budgetId).number + " (" + out.length + " lines)",
      );
      return out;
    }
    importCatalogue(rows, sourceRef, user) {
      // CAT-10: controlled upsert preserving the source reference
      const res = { added: 0, updated: 0, skipped: 0 };
      for (const r of rows) {
        if (!r.code || !r.desc) {
          res.skipped++;
          continue;
        }
        const existing = this.state.catalogue.find((i) => i.code === r.code);
        if (existing) {
          Object.assign(existing, {
            desc: r.desc,
            unit: r.unit || existing.unit,
            defaultCostCents: r.defaultCostCents ?? existing.defaultCostCents,
            importSource: sourceRef,
          });
          res.updated++;
        } else {
          this.addCatalogueItem(Object.assign({}, r, { importSource: sourceRef }), user);
          res.added++;
        }
      }
      this._log(user, "importCatalogue", sourceRef + " +" + res.added + " ~" + res.updated);
      return res;
    }
    recordSupplierPerformance(supplierId, perf, user) {
      // SUP-11: reliability, quality, returns, response
      this.state.supplierPerf = this.state.supplierPerf || [];
      const rec = Object.assign(
        {
          id: this._id("spf"),
          supplierId,
          date: this.state.today,
          onTime: true,
          qualityIssue: false,
          returned: false,
          responseDays: 1,
          note: "",
        },
        perf,
      );
      this.state.supplierPerf.push(rec);
      this._log(user, "supplierPerformance", supplierId);
      return rec;
    }
    supplierRanking() {
      // SUP-11: simple ranking
      const perf = this.state.supplierPerf || [];
      const by = {};
      for (const r of perf) {
        const g = (by[r.supplierId] = by[r.supplierId] || {
          n: 0,
          onTime: 0,
          quality: 0,
          returns: 0,
          resp: 0,
        });
        g.n++;
        g.onTime += r.onTime ? 1 : 0;
        g.quality += r.qualityIssue ? 1 : 0;
        g.returns += r.returned ? 1 : 0;
        g.resp += r.responseDays;
      }
      return Object.entries(by)
        .map(([supplierId, g]) => ({
          supplierId,
          name: this.party(supplierId).name,
          records: g.n,
          onTimePct: Math.round((g.onTime / g.n) * 100),
          qualityIssues: g.quality,
          returns: g.returns,
          avgResponseDays: Math.round((g.resp / g.n) * 10) / 10,
          score: Math.round(
            (g.onTime / g.n) * 60 + (1 - g.quality / g.n) * 30 + (1 - g.returns / g.n) * 10,
          ),
        }))
        .sort((a, b) => b.score - a.score);
    }
    saveBenchmark(budgetId, label, user) {
      // PRE-14: preserve an initial benchmark study
      const b = this.budget(budgetId);
      b.benchmarks = b.benchmarks || [];
      const t = this.budgetTotals(budgetId);
      b.benchmarks.push({
        label,
        date: this.state.today,
        chapters: clone(t.chapters),
        costBaseCents: t.costBaseCents,
        baseCents: t.baseCents,
      });
      this._log(user, "saveBenchmark", b.number + " " + label);
    }
    compareBudgetCosts(budgetId, supplierIds) {
      // PRE-14: same measured scope vs several cost sources
      const b = this.budget(budgetId);
      const v = this.currentVersion(budgetId);
      const lines = [];
      for (const c of v.chapters)
        for (const l of c.lines.filter((x) => !x.pending)) {
          const qty = l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli;
          const perSupplier = supplierIds.map((sid) => {
            const price = l.itemId ? this.currentPriceCents(l.itemId, sid) : null;
            return {
              supplierId: sid,
              totalCents: price != null ? mul(qty, price) : null,
              missing: price == null,
            }; // SUP-07 missing ≠ 0
          });
          const selected = l.lumpSum ? l.costCents : mul(qty, l.costCents);
          const present = perSupplier.filter((x) => !x.missing);
          const best = present.length ? Math.min(...present.map((x) => x.totalCents)) : null;
          lines.push({
            chapter: c.num,
            line: l.num,
            desc: l.desc,
            selectedCents: selected,
            perSupplier,
            bestCents: best,
            varianceAbs: best != null ? selected - best : null,
            variancePct: best ? Math.round(((selected - best) / best) * 1000) / 10 : null,
          });
        }
      const chapters = {};
      for (const l of lines) {
        const g = (chapters[l.chapter] = chapters[l.chapter] || { selectedCents: 0, bestCents: 0 });
        g.selectedCents += l.selectedCents;
        g.bestCents += l.bestCents ?? l.selectedCents;
      }
      return { lines, chapters, benchmarks: b.benchmarks || [] };
    }
    renumberChapter(budgetId, oldNum, newNum, user) {
      // PRE-16: renumber without losing cost/progress links
      const v = this._editableVersion(budgetId);
      const c = v.chapters.find((x) => x.num === oldNum);
      if (!c) throw new Error("Chapter not found");
      if (v.chapters.some((x) => x.num === newNum))
        throw new Error("Chapter number already in use");
      c.num = newNum;
      c.lines.forEach((l, i) => (l.num = newNum + "." + (i + 1)));
      // keep every linked record pointing at the same chapter
      const remap = (arr, key) =>
        arr.forEach((r) => {
          if (r[key] === oldNum) r[key] = newNum;
        });
      const projId = (this.state.projects.find((p) => p.budgetId === budgetId) || {}).id;
      remap(
        this.state.purchases.filter((p) => p.projectId === projId),
        "chapterNum",
      );
      remap(
        this.state.labour.filter((l) => l.projectId === projId),
        "chapterNum",
      );
      this.state.bills.forEach((b2) =>
        b2.allocations.forEach((a) => {
          if (a.projectId === projId && a.chapterNum === oldNum) a.chapterNum = newNum;
        }),
      );
      this._log(user, "renumberChapter", oldNum + "→" + newNum);
      return c;
    }
    addProjectRequirement(projectId, req, user) {
      // PRJ-06: permits, safety docs, access, customer decisions
      const p = this.project(projectId);
      const rec = Object.assign(
        { id: this._id("req"), type: "permit", desc: "", status: "open", due: null },
        req,
      );
      if (!["permit", "safetyDoc", "access", "customerDecision", "dependency"].includes(rec.type))
        throw new Error("Unknown requirement type");
      (rec.type === "permit" || rec.type === "safetyDoc" ? p.permits : p.dependencies).push(rec);
      this._log(user, "addProjectRequirement", p.code + " " + rec.type);
      return rec;
    }
    assignResource(projectId, a, user) {
      // PLN-02: workers/crews/machinery to projects and periods
      this.state.assignments = this.state.assignments || [];
      const rec = Object.assign(
        {
          id: this._id("asg"),
          projectId,
          workerId: null,
          machine: null,
          from: this.state.today,
          to: this.state.today,
        },
        a,
      );
      this.state.assignments.push(rec);
      this._log(user, "assignResource", projectId);
      return rec;
    }
    resourceConflicts() {
      // PLN-02: overlapping assignments visible
      const A = this.state.assignments || [];
      const conflicts = [];
      for (let i = 0; i < A.length; i++)
        for (let j = i + 1; j < A.length; j++) {
          const a = A[i],
            b = A[j];
          const same =
            (a.workerId && a.workerId === b.workerId) || (a.machine && a.machine === b.machine);
          if (same && a.projectId !== b.projectId && a.from <= b.to && b.from <= a.to)
            conflicts.push({ a: a.id, b: b.id, resource: a.workerId || a.machine });
        }
      return conflicts;
    }
    addDiaryEntry(projectId, entry, user) {
      // PLN-05: site diary — notes, photos, incidents, deliveries
      const p = this.project(projectId);
      const rec = Object.assign(
        {
          date: this.state.today,
          note: "",
          photos: [],
          incident: false,
          delivery: false,
          workDone: "",
        },
        entry,
      );
      p.diary.push(rec);
      this._log(user, "addDiaryEntry", p.code);
      return rec;
    }
    upcomingNeeds(weeks = 3) {
      // PLN-08: resource/material requirements for the coming weeks
      const needs = [];
      for (const p of this.state.projects.filter((x) => !x.closed && x.budgetId)) {
        const v = this.version(p.budgetId, p.acceptedVersionId);
        for (const c of v.chapters.filter((x) => x.section === "base" && x.progress !== "done"))
          for (const l of c.lines.filter((x) => !x.pending && x.progress !== "done")) {
            const qty = l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli;
            needs.push({
              project: p.code,
              chapter: c.num,
              desc: l.desc,
              qty: qty / 1000,
              unit: l.unit,
              estCostCents: l.lumpSum ? l.costCents : mul(qty, l.costCents),
              supplierId: l.costSupplierId,
            });
          }
      }
      return needs;
    }
    hoursComparison(projectId) {
      // LAB-06: estimated vs actual hours by chapter
      const p = this.project(projectId);
      const est = {};
      if (p.budgetId) {
        const v = this.version(p.budgetId, p.acceptedVersionId);
        for (const c of v.chapters)
          for (const l of c.lines)
            if (l.estHoursMilli) est[c.num] = (est[c.num] || 0) + l.estHoursMilli;
      }
      const act = {};
      for (const l of this.state.labour.filter((x) => x.projectId === projectId))
        act[l.chapterNum || "?"] = (act[l.chapterNum || "?"] || 0) + l.hoursMilli;
      const chapters = [...new Set([...Object.keys(est), ...Object.keys(act)])].map((num) => ({
        chapter: num,
        estHours: (est[num] || 0) / 1000,
        actualHours: (act[num] || 0) / 1000,
        overrun: (act[num] || 0) > (est[num] || 0) && (est[num] || 0) > 0,
      }));
      return {
        chapters,
        estTotal: sum(Object.values(est)) / 1000,
        actualTotal: sum(Object.values(act)) / 1000,
      };
    }
    addRecurringInvoice(r, user) {
      // AR-11: periodic invoicing (maintenance contracts)
      this.state.recurring = this.state.recurring || [];
      const rec = Object.assign(
        {
          id: this._id("rcr"),
          partyId: null,
          projectId: null,
          desc: "Mantenimiento periódico",
          baseCents: 0,
          vatBp: 2100,
          cadenceMonths: 1,
          nextDate: this.state.today,
          active: true,
        },
        r,
      );
      this.state.recurring.push(rec);
      this._log(user, "addRecurringInvoice", rec.desc);
      return rec;
    }
    runRecurring(user) {
      // AR-11: issue every recurring invoice that is due
      const issued = [];
      for (const r of (this.state.recurring || []).filter(
        (x) => x.active && x.nextDate <= this.state.today,
      )) {
        issued.push(
          this.issueInvoice(
            {
              projectId: r.projectId,
              kind: "progress",
              baseCents: r.baseCents,
              vatBp: r.vatBp,
              desc: r.desc,
            },
            user,
          ),
        );
        const d = new Date(r.nextDate + "T00:00:00Z");
        d.setUTCMonth(d.getUTCMonth() + r.cadenceMonths);
        r.nextDate = d.toISOString().slice(0, 10);
      }
      return issued;
    }
    receivablesSpecial() {
      // FIN-09: retention, guarantee and disputed balances apart from normal AR
      const inv = this.state.invoices.filter((i) => i.kind !== "creditNote");
      return {
        retentionHeldCents: sum(inv, (i) => i.retentionHeldCents || 0),
        disputedCents: sum(
          inv.filter((i) => i.disputed),
          (i) => this.invoiceOutstandingCents(i.id),
        ),
        guaranteeCents: sum(
          this.state.contracts.filter((c) => c.status === "completed"),
          (c) => c.guaranteeRetainedCents || 0,
        ),
        normalOutstandingCents: sum(
          inv.filter((i) => !i.disputed),
          (i) => this.invoiceOutstandingCents(i.id),
        ),
      };
    }

    /* ---------- DOC-04 standardized naming ---------- */
    _docName(kind, b, v) {
      const party = b.partyId ? this.party(b.partyId).name.replace(/\s+/g, "-") : "";
      return [kind, b.number, v ? "v" + v.vNumber : "", party, this.state.today]
        .filter(Boolean)
        .join("_");
    }
  }

  return {
    ERP,
    LISTS,
    validTaxId,
    validIban,
    validEmail,
    cents,
    mul,
    pctOf,
    addDays,
    daysBetween,
    quarterOf,
  };
});

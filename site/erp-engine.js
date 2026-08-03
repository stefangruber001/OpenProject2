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
  // Monday of the ISO week containing dateIso (§4.6's weekly grid, LAB-01).
  const weekStartOf = (dateIso) => {
    const d = new Date(dateIso + "T00:00:00Z");
    const day = d.getUTCDay(); // 0=Sun..6=Sat
    d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
    return d.toISOString().slice(0, 10);
  };
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
    // §4.2: mandatory documentation before a trade enters the site.
    subcontractDocTypes: ["insurance", "prl", "socialSecurity"],
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
        subcontracts: [],
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
        bankPeriods: [], // §5.3: closed/reopened reconciliation periods
        commsTemplates: [], // §5.7
        commsRules: [],
        commsQueue: [],
        gestoriaQueries: [], // §5.6: what the accountant asked, and the answer
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
      // ORG-01: applied to every document. Partial re-calls update only the
      // provided fields — existing values are preserved, never reset.
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
        this.state.config || {},
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
      mk("subcontract", "SUB-");
      this._log("backoffice", "configureEntity", this.state.config.legalName);
      return this.state.config;
    }
    nextNumber(type) {
      // ORG-04: controlled, gap-free, no manual overwriting.
      // Series restart at 0001 each fiscal year (FAC-2027-0001 after FAC-2026-nnnn).
      const s = this.state.series[type];
      if (!s) throw new Error("Unknown series: " + type);
      const year = this.state.today.slice(0, 4);
      s.byYear = s.byYear || {};
      if (s.byYear[year] == null)
        s.byYear[year] = s.issued.filter((n) => n.startsWith(s.prefix + year + "-")).length + 1;
      const num = `${s.prefix}${year}-${String(s.byYear[year]).padStart(4, "0")}`;
      s.byYear[year]++;
      s.next++;
      s.issued.push(num);
      return num;
    }
    seriesGaps(type) {
      // GES-07: gap check, per fiscal year
      const s = this.state.series[type];
      if (!s) return [];
      const byYear = {};
      for (const n of s.issued) {
        const y = n.slice(s.prefix.length, s.prefix.length + 4);
        (byYear[y] = byYear[y] || []).push(+n.slice(-4));
      }
      const gaps = [];
      for (const y of Object.keys(byYear).sort()) {
        const nums = byYear[y].sort((a, b) => a - b);
        for (let i = 1; i < nums.length; i++)
          if (nums[i] !== nums[i - 1] + 1)
            gaps.push(`${y}-${String(nums[i - 1] + 1).padStart(4, "0")}`);
      }
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
        .filter(
          (p) => !p.annulled && p.itemId === itemId && (!supplierId || p.supplierId === supplierId),
        )
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
      return this.state.prices
        .filter((p) => !p.annulled && p.validUntil && p.validUntil < t)
        .map((p) => p.id);
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
          // PRE-10: the graphic annex is a property of the budget, switchable
          // per budget. Its layout is not computed here — see the annex
          // composer the document preview calls; this is only the setting.
          annex: { enabled: true, imagesPerPage: 2 },
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

    /* ---- the builder's edit surface (PRE-02/05, spec §3.3 "Disposición del
       constructor"). Every one of these goes through _editableVersion, so a
       frozen, issued or accepted version refuses the edit rather than silently
       rewriting a document that was already sent.

       NOTE the deliberate absence of updateLine/updateChapter/removeLine here:
       this class already defines them further down, keyed by chapter AND line
       reference. A second definition of the same name in a class body silently
       replaces the first, so adding one here would break every existing
       caller — which is exactly what a first draft of this block did, caught
       by the site E2E rather than by reading. ---- */

    /** The line with this id, wherever it sits, plus its chapter and version. */
    findLine(budgetId, lineId, versionId) {
      const v = versionId ? this.version(budgetId, versionId) : this.currentVersion(budgetId);
      for (const c of v.chapters) {
        const l = c.lines.find((x) => x.id === lineId);
        if (l) return { version: v, chapter: c, line: l };
      }
      return null;
    }

    /**
     * Write-through edit of one line, addressed by line id alone (updateLine
     * needs the chapter too, which a spreadsheet grid does not have to hand).
     *
     * `audit` exists because of how a grid is used: the constructor writes on
     * EVERY keystroke, so that the totals panel beside it is genuinely live
     * rather than an optimistic copy. Logging each of those would record one
     * audit entry per character typed and drown the trail that ORG-07 exists
     * to keep readable. The view therefore writes silently while a field is
     * being typed into and logs once when it is committed, which records the
     * same fact — this person changed this line — at the granularity a person
     * can actually read.
     */
    editLine(budgetId, lineId, patch, { audit = false, user } = {}) {
      const v = this._editableVersion(budgetId);
      const found = this.findLine(budgetId, lineId, v.id);
      if (!found) throw new Error("Line not found");
      // Identity and images are not patchable here: an id must stay stable for
      // the version diff to work, and images have their own guarded methods.
      const { id, num, imageRefs, ...safe } = patch || {};
      void id;
      void num;
      void imageRefs;
      Object.assign(found.line, safe);
      if (found.line.subLines.length) found.line.qtyMilli = this._aggSubLines(found.line.subLines);
      if (audit) this._log(user, "editLine", this.budget(budgetId).number + " " + found.line.num);
      return found.line;
    }

    /** Delete a line addressed by its id alone, renumbering what remains. */
    deleteLine(budgetId, lineId, user) {
      const v = this._editableVersion(budgetId);
      const found = this.findLine(budgetId, lineId, v.id);
      if (!found) throw new Error("Line not found");
      found.chapter.lines = found.chapter.lines.filter((l) => l.id !== lineId);
      // Line numbers are the reader's index into the document — and into the
      // graphic annex — so they are renumbered to stay contiguous.
      found.chapter.lines.forEach((l, i) => (l.num = found.chapter.num + "." + (i + 1)));
      this._log(user, "deleteLine", this.budget(budgetId).number + " " + found.line.num);
      return found.chapter;
    }

    removeChapter(budgetId, chapterId) {
      const v = this._editableVersion(budgetId);
      v.chapters = v.chapters.filter((c) => c.id !== chapterId);
      v.chapters.forEach((c, i) => {
        const num = String(i + 1);
        c.num = num;
        c.order = i;
        c.lines.forEach((l, j) => (l.num = num + "." + (j + 1)));
      });
      return v;
    }

    /* ---- PRE-10 / CAT-08 / DOC-02: images on a line.
       The image is informative and NEVER touches quantities, prices or totals —
       none of these methods so much as reads an amount. Bytes live in the blob
       store under `storageKey`; only the reference and its caption are state,
       which is what keeps the state blob small enough to re-serialise on every
       keystroke. Because a version deep-copies its chapters, freezing a version
       freezes its annex with it: an issued document can always be reproduced
       exactly as it was sent, even if the catalogue image changes later. ---- */
    attachLineImage(budgetId, lineId, img, user) {
      const v = this._editableVersion(budgetId);
      const found = this.findLine(budgetId, lineId, v.id);
      if (!found) throw new Error("Line not found");
      if (!img || !img.storageKey) throw new Error("Image needs a storage key");
      const rec = Object.assign(
        {
          id: this._id("img"),
          storageKey: "",
          caption: "",
          source: "upload", // catalogue | visit | upload | camera
          internal: false, // internal-only images never reach the customer doc
          mime: "image/jpeg",
          sizeBytes: 0,
          width: 0,
          height: 0,
        },
        img,
      );
      found.line.imageRefs.push(rec);
      this._log(user, "attachLineImage", found.line.num);
      return rec;
    }
    updateLineImage(budgetId, lineId, imageId, patch) {
      const v = this._editableVersion(budgetId);
      const found = this.findLine(budgetId, lineId, v.id);
      if (!found) throw new Error("Line not found");
      const img = found.line.imageRefs.find((x) => x.id === imageId);
      if (!img) throw new Error("Image not found");
      const { id, storageKey, ...safe } = patch || {};
      void id;
      void storageKey; // replacing the bytes is attach + remove, not a patch
      Object.assign(img, safe);
      return img;
    }
    removeLineImage(budgetId, lineId, imageId) {
      const v = this._editableVersion(budgetId);
      const found = this.findLine(budgetId, lineId, v.id);
      if (!found) throw new Error("Line not found");
      const img = found.line.imageRefs.find((x) => x.id === imageId);
      found.line.imageRefs = found.line.imageRefs.filter((x) => x.id !== imageId);
      // The blob itself is deliberately NOT deleted: an earlier frozen version
      // may still reference it, and orphaning a sent document's picture to
      // reclaim a few kilobytes is the wrong trade.
      return img || null;
    }
    moveLineImage(budgetId, lineId, imageId, delta) {
      const v = this._editableVersion(budgetId);
      const found = this.findLine(budgetId, lineId, v.id);
      if (!found) throw new Error("Line not found");
      const arr = found.line.imageRefs;
      const i = arr.findIndex((x) => x.id === imageId);
      if (i < 0) throw new Error("Image not found");
      const j = Math.max(0, Math.min(arr.length - 1, i + delta));
      if (i !== j) arr.splice(j, 0, arr.splice(i, 1)[0]);
      return arr;
    }
    setAnnexOptions(budgetId, opts) {
      const b = this.budget(budgetId);
      if (!b.annex) b.annex = { enabled: true, imagesPerPage: 2 };
      if (typeof opts.enabled === "boolean") b.annex.enabled = opts.enabled;
      if (opts.imagesPerPage != null) {
        const n = Math.round(Number(opts.imagesPerPage));
        b.annex.imagesPerPage = Math.max(1, Math.min(12, isFinite(n) ? n : 2));
      }
      return b.annex;
    }
    /** Every image on a version, flattened with the line it belongs to. */
    budgetImages(budgetId, versionId, { includeInternal = false } = {}) {
      const v = versionId ? this.version(budgetId, versionId) : this.currentVersion(budgetId);
      const out = [];
      for (const c of v.chapters)
        for (const l of c.lines)
          (l.imageRefs || []).forEach((img, i) => {
            if (!includeInternal && img.internal) return;
            out.push({
              image: img,
              order: i,
              lineId: l.id,
              lineNum: l.num,
              lineDesc: l.customerWording || l.desc,
              chapterNum: c.num,
              chapterName: c.name,
              section: c.section,
            });
          });
      return out;
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
      // PRE-10: freezing a version freezes its annex. The images are already
      // frozen (they live on this version's own copy of the chapters), but the
      // annex SETTINGS live on the budget and would otherwise keep changing
      // under an already-sent document. Snapshot them here so a reissued PDF is
      // laid out exactly as the one the customer received.
      v.annex = clone(b.annex || { enabled: true, imagesPerPage: 2 });
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
              // PRE-10 / CAT-08. Internal-only images are dropped at the
              // document boundary for the same reason cost and margin are: a
              // value that never enters the customer document cannot leak out
              // of one.
              imageRefs: (l.imageRefs || []).filter((img) => !img.internal),
            })),
        })),
        // The annex SETTINGS as they apply to this version: an issued version
        // carries its own frozen copy, a draft follows the budget's current
        // ones. What goes on which page is not decided here — the annex
        // composer in the capability layer does that from these images.
        annex: clone(v.annex || b.annex || { enabled: true, imagesPerPage: 2 }),
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
    /**
     * Progress on ONE line, by percentage or by the quantity actually built
     * (§4.3: "avance por cantidad ejecutada además de por porcentaje").
     *
     * Quantity is the honest input on site — nobody knows what 40 % of a wall
     * is, everybody knows how many square metres went up — so it is converted
     * here rather than asked for as a percentage the foreman had to invent.
     * The chapter's own state is then rolled up from its lines, so the two can
     * never contradict each other.
     */
    markLineProgress(projectId, lineId, { pct, qtyMilliDone }, user) {
      const p = this.project(projectId);
      if (!p.budgetId) throw new Error("Project has no budget to mark progress against");
      const v = this.version(p.budgetId, p.acceptedVersionId);
      for (const c of v.chapters) {
        const l = c.lines.find((x) => x.id === lineId);
        if (!l) continue;
        let value = pct;
        if (value == null && qtyMilliDone != null) {
          const total = l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli;
          value = total > 0 ? (qtyMilliDone / total) * 100 : 0;
        }
        l.progressPct = Math.max(0, Math.min(100, Math.round(value || 0)));
        l.progress =
          l.progressPct >= 100 ? "done" : l.progressPct > 0 ? "inProgress" : "notStarted";
        const pcts = c.lines.map((x) => x.progressPct || 0);
        c.progress = pcts.every((x) => x >= 100)
          ? "done"
          : pcts.some((x) => x > 0)
            ? "inProgress"
            : "notStarted";
        this._log(user, "markLineProgress", p.code + " " + l.num + " → " + l.progressPct + "%");
        return l;
      }
      throw new Error("Line not found: " + lineId);
    }
    /** Value-weighted progress per chapter, the input a cost forecast needs. */
    chapterProgress(projectId) {
      const p = this.project(projectId);
      if (!p.budgetId) {
        const pct = p.progressSimple ? p.progressSimple.pct : 0;
        return p.baseline.chapters.map((c) => ({ num: c.num, progressPct: pct }));
      }
      const v = this.version(p.budgetId, p.acceptedVersionId);
      return v.chapters
        .filter((c) => c.section === "base")
        .map((c) => {
          let value = 0,
            done = 0;
          for (const l of c.lines) {
            if (l.pending) continue;
            const qty = l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli;
            const amount = l.lumpSum ? l.priceCents : mul(qty, l.priceCents);
            value += amount;
            done += (amount * (l.progressPct || 0)) / 100;
          }
          return { num: c.num, progressPct: value ? Math.round((done / value) * 100) : 0 };
        });
    }
    /** Committed cost per chapter — orders and awarded subcontracts, net of returns (FIN-02, §4.1). */
    committedByChapter(projectId) {
      const out = {};
      for (const pu of this.state.purchases) {
        if (pu.projectId !== projectId || !pu.chapterNum || pu.cancelledAt) continue;
        out[pu.chapterNum] = (out[pu.chapterNum] || 0) + (pu.totalCents - pu.status.returnedCents);
      }
      for (const s of this.state.subcontracts || []) {
        if (s.projectId !== projectId || !s.chapterNum) continue;
        if (["draft", "cancelled", "rejected"].includes(s.status)) continue;
        out[s.chapterNum] = (out[s.chapterNum] || 0) + this._subcontractCommittedValue(s);
      }
      return out;
    }
    /**
     * What a subcontract counts as "comprometido": the full award, EXCEPT a
     * terminated one, which is only as good as what was actually certified —
     * the rest of the award was never going to be spent.
     */
    _subcontractCommittedValue(s) {
      return s.status === "terminated"
        ? sum(s.certifications, (c) => c.amountCents)
        : s.awardedCents;
    }
    /**
     * Material still to commit, by chapter (§4.1 block 1: "necesidades ...
     * derivadas del presupuesto, con lo ya pedido y lo pendiente"). Reads the
     * project's own frozen chapter budgets and compares them against
     * committedByChapter — the same figures the economics screen shows, so
     * the two can never disagree about how much of a chapter is still open.
     */
    purchaseNeeds(projectId) {
      const p = this.project(projectId);
      const committed = this.committedByChapter(projectId);
      return (p.baseline.chapters || []).map((c) => {
        const committedCents = committed[c.num] || 0;
        return {
          num: c.num,
          name: c.name,
          budgetCostCents: c.costCents,
          committedCents,
          pendingCents: Math.max(0, c.costCents - committedCents),
        };
      });
    }
    /**
     * A human's replacement for a calculated cost-at-completion (§4.4
     * "Proyección"). The reason is required and stored with it: an adjustment
     * nobody can review later is indistinguishable from a typo, and the point
     * of the figure is to start a conversation about why it moved.
     */
    setForecastOverride(projectId, chapterNum, { costCents, reason }, user) {
      const p = this.project(projectId);
      if (!reason || !String(reason).trim())
        throw new Error("An adjusted projection needs a reason");
      if (!p.forecastOverrides || typeof p.forecastOverrides !== "object") p.forecastOverrides = {};
      p.forecastOverrides[chapterNum] = {
        costCents: Math.round(costCents),
        reason: String(reason).trim(),
        at: this.state.today,
        by: user || "backoffice",
      };
      this._log(user, "setForecastOverride", p.code + " cap." + chapterNum);
      return p.forecastOverrides[chapterNum];
    }
    clearForecastOverride(projectId, chapterNum, user) {
      const p = this.project(projectId);
      if (p.forecastOverrides) delete p.forecastOverrides[chapterNum];
      this._log(user, "clearForecastOverride", p.code + " cap." + chapterNum);
    }
    /**
     * The fixed header of §4: everything the strip above every project
     * subsection has to show, in one call, so six views cannot each assemble
     * it slightly differently.
     */
    projectHeader(projectId) {
      const p = this.project(projectId);
      const e = this.projectEconomics(projectId);
      const party = this.party(p.partyId);
      const property = p.propertyId
        ? this.state.properties.find((x) => x.id === p.propertyId)
        : null;
      const contract = p.contractId
        ? this.state.contracts.find((c) => c.id === p.contractId)
        : null;
      // The next two dates that matter, whatever kind they are: a payment
      // milestone, the committed finish, a permit expiry. A header that only
      // knew about one kind would go quiet exactly when another is looming.
      const dates = [];
      if (p.dates.targetEnd) dates.push({ what: "Fin previsto", date: p.dates.targetEnd });
      if (contract) {
        for (const i of contract.installments || [])
          if (i.expectedDate && i.status !== "invoiced")
            dates.push({ what: "Hito de cobro", date: i.expectedDate });
      }
      for (const pm of p.permits || [])
        if (pm.expiresOn) dates.push({ what: "Permiso " + (pm.kind || ""), date: pm.expiresOn });
      dates.sort((a, b) => (a.date < b.date ? -1 : 1));
      return {
        id: p.id,
        code: p.code,
        partyId: p.partyId,
        partyName: party.name,
        address: property
          ? `${property.street || ""}, ${property.postalCode || ""} ${property.city || ""}`.trim()
          : "",
        status: p.closed ? "closed" : p.status,
        activityLine: p.activityLine,
        progressPct: e.progressPct,
        revenueCents: e.currentRevenueCents,
        actualCents: e.actualCents,
        marginCents: e.marginForecastCents,
        marginPct: e.marginForecastPct,
        nextDates: dates.slice(0, 2),
      };
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
          chapterNum: null, // which chapter's cost/margin this extra affects
          priceCents: 0,
          costCents: 0,
          scheduleImpactDays: 0,
          photoRef: null,
          status: "identified",
          sentAt: null,
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
    priceChange(changeId, priceCents, costCents, scheduleImpactDays, user) {
      // scheduleImpactDays sits before user (not after) so an existing 3-arg
      // call — every caller before this session — keeps meaning exactly what
      // it always meant, with the schedule effect simply left at its default.
      const c = this.state.changes.find((x) => x.id === changeId);
      c.priceCents = priceCents;
      c.costCents = costCents;
      if (scheduleImpactDays != null) c.scheduleImpactDays = Math.round(scheduleImpactDays);
      c.status = "priced";
      this._log(user, "priceChange", changeId);
    }
    /** Send the valued extra to the client before asking for acceptance. */
    sendChange(changeId, user) {
      const c = this.state.changes.find((x) => x.id === changeId);
      if (!c) throw new Error("Change not found");
      if (c.status !== "priced") throw new Error("Change must be priced before it can be sent");
      c.status = "sent";
      c.sentAt = this.state.today;
      this._log(user, "sendChange", changeId);
      return c;
    }
    approveChange(changeId, evidenceRef, user) {
      // CHG-03/04 + CON-12. Accepts "priced" too — sending to the client first
      // is a real step this spec adds, but skipping straight to acceptance
      // (a verbal yes, a signature on the spot) is common enough on site that
      // requiring the intermediate step would just get worked around.
      const c = this.state.changes.find((x) => x.id === changeId);
      if (!["priced", "sent"].includes(c.status))
        throw new Error("Change must be priced before approval");
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
        sent: list.filter((c) => c.status === "sent").length,
        approved: list.filter((c) => ["approved", "executed", "invoiced"].includes(c.status))
          .length,
        invoiced: list.filter((c) => c.status === "invoiced").length,
        rejected: list.filter((c) => ["rejected", "cancelled"].includes(c.status)).length,
        approvedValueCents: sum(
          list.filter((c) => ["approved", "executed", "invoiced"].includes(c.status)),
          (c) => c.priceCents,
        ),
        unapprovedValueCents: sum(
          list.filter((c) => ["identified", "priced", "sent"].includes(c.status)),
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
          expectedArrival: null, // PUR-06: arrivals calendar
          sentAt: null,
          acceptedAt: null,
          cancelledAt: null,
          cancelReason: "",
          receipts: [], // PUR-08: {date, qtyMilli, docRef, photoRef} — partial receiving accumulates
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
    /**
     * The lifecycle a purchase order visibly moves through (§4.1: "borrador,
     * enviada, aceptada, recibida parcial, recibida, facturada, pagada").
     * Derived from the underlying facts rather than stored as its own field —
     * a status string that forgets to update when, say, a payment is voided
     * is a worse bug than any of the booleans and dates it would replace.
     */
    purchaseStatus(pu) {
      if (pu.cancelledAt) return "cancelled";
      if (pu.status.paid) return "paid";
      if (pu.status.invoicedBillId) return "invoiced";
      if (pu.status.delivered) return "received";
      if ((pu.receipts || []).length) return "partialReceived";
      if (pu.acceptedAt) return "accepted";
      if (pu.sentAt) return "sent";
      return "draft";
    }
    /** Send the order to the supplier by email — PDF + template (PUR-...). */
    sendPurchase(id, user) {
      const pu = this.state.purchases.find((x) => x.id === id);
      if (!pu) throw new Error("Purchase not found");
      if (pu.cancelledAt) throw new Error("Purchase order is cancelled");
      this._requireComplete(pu.supplierId, "purchase order"); // MDM-10
      if (!validEmail(this.party(pu.supplierId).email))
        throw new Error("Supplier email required to send the order");
      pu.sentAt = this.state.today;
      this._log(user, "sendPurchase", pu.number);
      return pu;
    }
    acceptPurchase(id, { expectedArrival } = {}, user) {
      // supplier's acceptance + confirmed arrival date
      const pu = this.state.purchases.find((x) => x.id === id);
      if (!pu) throw new Error("Purchase not found");
      if (!pu.sentAt) throw new Error("Send the order before recording the supplier's acceptance");
      pu.acceptedAt = this.state.today;
      if (expectedArrival) pu.expectedArrival = expectedArrival;
      this._log(user, "acceptPurchase", pu.number);
      return pu;
    }
    cancelPurchase(id, reason, user) {
      const pu = this.state.purchases.find((x) => x.id === id);
      if (!pu) throw new Error("Purchase not found");
      if (pu.status.invoicedBillId)
        throw new Error("An invoiced order cannot be cancelled — register a return instead");
      pu.cancelledAt = this.state.today;
      pu.cancelReason = reason || "";
      this._log(user, "cancelPurchase", pu.number);
      return pu;
    }
    /**
     * Receive against the order, in full or in part, with the delivery note
     * and photo the spec asks for. Repeated partial receipts accumulate; the
     * order becomes "recibida" on its own once the received quantity reaches
     * what was ordered, so "recibida parcial" needs no separate close-out step.
     */
    receivePurchase(id, { qtyMilli, docRef, photoRef } = {}, user) {
      const pu = this.state.purchases.find((x) => x.id === id);
      if (!pu) throw new Error("Purchase not found");
      if (pu.cancelledAt) throw new Error("Purchase order is cancelled");
      const qty = Math.round(Number(qtyMilli) || 0);
      if (qty <= 0) throw new Error("Received quantity must be positive");
      pu.receipts = pu.receipts || [];
      pu.receipts.push({
        date: this.state.today,
        qtyMilli: qty,
        docRef: docRef || "",
        photoRef: photoRef || null,
      });
      const receivedQty = sum(pu.receipts, (r) => r.qtyMilli);
      if (receivedQty >= pu.qtyMilli) pu.status.delivered = true;
      pu.deliveredDate = this.state.today;
      this._log(user, "receivePurchase", pu.number + " " + qty / 1000);
      return pu;
    }
    duplicatePurchase(id, user) {
      const src = this.state.purchases.find((x) => x.id === id);
      if (!src) throw new Error("Purchase not found");
      return this.addPurchase(
        {
          supplierId: src.supplierId,
          projectId: src.projectId,
          chapterNum: src.chapterNum,
          desc: src.desc,
          qtyMilli: src.qtyMilli,
          unitCents: src.unitCents,
          vatBp: src.vatBp,
          orderRef: src.orderRef,
        },
        user,
      );
    }
    recordReturn(purchaseId, amountCents, user) {
      // PUR-09
      const pu = this.state.purchases.find((x) => x.id === purchaseId);
      pu.status.returnedCents += amountCents;
      this._log(user, "recordReturn", pu.number);
    }
    /** Order ↔ delivery note ↔ invoice, with the mismatches flagged (§4.1 "conciliación a tres bandas"). */
    purchaseReconciliation(id) {
      const pu = this.state.purchases.find((x) => x.id === id);
      if (!pu) throw new Error("Purchase not found");
      const receivedQty = sum(pu.receipts || [], (r) => r.qtyMilli);
      const bill = pu.status.invoicedBillId
        ? this.state.bills.find((b) => b.id === pu.status.invoicedBillId)
        : null;
      const qtyMismatch = pu.status.delivered && receivedQty !== pu.qtyMilli;
      // 1€ tolerance: rounding on unit prices should never itself read as a mismatch.
      const amountMismatch =
        !!bill && Math.abs(bill.baseCents - (pu.totalCents - pu.status.returnedCents)) > 100;
      return {
        orderedQtyMilli: pu.qtyMilli,
        receivedQtyMilli: receivedQty,
        orderedCents: pu.totalCents,
        invoicedCents: bill ? bill.baseCents : null,
        qtyMismatch,
        amountMismatch,
        ok: !qtyMismatch && !amountMismatch,
      };
    }
    /** Project-level committed cost: orders + awarded subcontracts, net of returns (FIN-02). */
    committedCostCents(projectId) {
      const purchases = sum(
        this.state.purchases.filter((p) => p.projectId === projectId && !p.cancelledAt),
        (p) => p.totalCents - p.status.returnedCents,
      );
      return purchases + this._committedSubcontractCents(projectId);
    }
    _committedSubcontractCents(projectId) {
      return sum(
        (this.state.subcontracts || []).filter(
          (s) =>
            s.projectId === projectId && !["draft", "cancelled", "rejected"].includes(s.status),
        ),
        (s) => this._subcontractCommittedValue(s),
      );
    }

    /* =========================== SUB — subcontracts (§4.2) =========================== */
    addSubcontract(projectId, s, user) {
      // PUR-01/02 + SUP-01..24 + CON-04: awarded work by trade, versioned like a PO
      const p = this.project(projectId);
      const rec = Object.assign(
        {
          id: this._id("sub"),
          number: this.nextNumber("subcontract"),
          projectId: p.id,
          supplierId: null,
          trade: "",
          chapterNum: null,
          format: "workOrder", // "workOrder" | "contract"
          awardedCents: 0,
          status: "draft", // draft|sent|accepted|inExecution|completed|terminated|rejected
          sentAt: null,
          acceptedAt: null,
          dates: { plannedStart: null, plannedEnd: null, actualStart: null, actualEnd: null },
          scheduleTaskRef: null, // links to the Gantt task executing this trade
          retentionPct: 0,
          retentionReleaseDate: null,
          retentionReleasedAt: null,
          docs: [], // {kind, expiresOn, docRef}
          certifications: [], // {date, amountCents, note}
          rejectedWork: [], // {date, desc}
          billIds: [],
        },
        s,
      );
      this.state.subcontracts.push(rec);
      this._log(user, "addSubcontract", rec.number);
      return rec;
    }
    sendSubcontract(id, user) {
      const s = this._subcontract(id);
      if (s.status !== "draft") throw new Error("Only a draft can be sent");
      this._requireComplete(s.supplierId, "subcontract"); // MDM-10
      if (!validEmail(this.party(s.supplierId).email))
        throw new Error("Supplier email required to send the subcontract");
      s.status = "sent";
      s.sentAt = this.state.today;
      this._log(user, "sendSubcontract", s.number);
      return s;
    }
    acceptSubcontract(id, { plannedStart, plannedEnd } = {}, user) {
      // PUR-...: registers acceptance with date; award value stands unless modifySubcontract changes it
      const s = this._subcontract(id);
      if (s.status !== "sent") throw new Error("Send the subcontract before recording acceptance");
      s.status = "accepted";
      s.acceptedAt = this.state.today;
      if (plannedStart) s.dates.plannedStart = plannedStart;
      if (plannedEnd) s.dates.plannedEnd = plannedEnd;
      this._log(user, "acceptSubcontract", s.number);
      return s;
    }
    /**
     * Start work on site. Blocks — not just alerts — on expired mandatory
     * documentation, per §4.2's "bloqueo ... si está vencida": the alert list
     * can warn about a lot of things, but letting an uninsured trade start on
     * site is the one that should not merely be visible, it should not happen.
     */
    markSubcontractStarted(id, user) {
      const s = this._subcontract(id);
      if (!["accepted", "inExecution"].includes(s.status))
        throw new Error("Accept the subcontract before work can start");
      const ds = this.subcontractDocStatus(s);
      if (ds.worst === "r")
        throw new Error("Mandatory documentation is missing or expired — cannot enter the site");
      s.status = "inExecution";
      if (!s.dates.actualStart) s.dates.actualStart = this.state.today;
      this._log(user, "markSubcontractStarted", s.number);
      return s;
    }
    markSubcontractCompleted(id, user) {
      const s = this._subcontract(id);
      if (s.status !== "inExecution") throw new Error("Only work in execution can be completed");
      s.status = "completed";
      s.dates.actualEnd = this.state.today;
      this._log(user, "markSubcontractCompleted", s.number);
      return s;
    }
    modifySubcontract(id, patch, user) {
      const s = this._subcontract(id);
      if (["completed", "terminated"].includes(s.status))
        throw new Error("A completed or terminated subcontract cannot be modified");
      const allowed = ["trade", "chapterNum", "format", "awardedCents", "retentionPct"];
      for (const k of Object.keys(patch)) if (!allowed.includes(k)) delete patch[k];
      Object.assign(s, patch);
      this._log(user, "modifySubcontract", s.number);
      return s;
    }
    extendSubcontract(id, { plannedEnd }, user) {
      const s = this._subcontract(id);
      if (["completed", "terminated"].includes(s.status))
        throw new Error("A completed or terminated subcontract cannot be extended");
      s.dates.plannedEnd = plannedEnd;
      this._log(user, "extendSubcontract", s.number);
      return s;
    }
    terminateSubcontract(id, reason, user) {
      const s = this._subcontract(id);
      if (["completed", "terminated"].includes(s.status)) throw new Error("Already closed");
      s.status = "terminated";
      s.terminatedReason = reason || "";
      s.dates.actualEnd = this.state.today;
      this._log(user, "terminateSubcontract", s.number);
      return s;
    }
    certifySubcontract(id, { amountCents, note }, user) {
      // Valuation of executed work — the base for the subcontractor's invoice.
      const s = this._subcontract(id);
      if (!["accepted", "inExecution"].includes(s.status))
        throw new Error("Certify only an accepted or in-execution subcontract");
      if (!(amountCents > 0)) throw new Error("Certification amount must be positive");
      s.certifications.push({
        date: this.state.today,
        amountCents: Math.round(amountCents),
        note: note || "",
      });
      this._log(user, "certifySubcontract", s.number);
      return s;
    }
    recordRejectedWork(id, desc, user) {
      const s = this._subcontract(id);
      s.rejectedWork.push({ date: this.state.today, desc: desc || "" });
      this._log(user, "recordRejectedWork", s.number);
      return s;
    }
    /** Approve the subcontractor's invoice: registers it as a supplier bill,
        allocated to this subcontract's project and chapter (AP-01..07). */
    approveSubcontractorInvoice(id, bill, user) {
      const s = this._subcontract(id);
      const rec = this.registerBill(
        Object.assign({}, bill, {
          supplierId: s.supplierId,
          allocations: [
            {
              projectId: s.projectId,
              chapterNum: s.chapterNum,
              kind: "subcontract",
              amountCents: bill.baseCents,
            },
          ],
        }),
        user,
      );
      s.billIds.push(rec.id);
      this._log(user, "approveSubcontractorInvoice", s.number + " " + rec.number);
      return rec;
    }
    releaseSubcontractRetention(id, user) {
      const s = this._subcontract(id);
      if (!(s.retentionPct > 0)) throw new Error("This subcontract has no retention to release");
      if (s.retentionReleasedAt) throw new Error("Retention already released");
      s.retentionReleasedAt = this.state.today;
      this._log(user, "releaseSubcontractRetention", s.number);
      return s;
    }
    /** Upsert one mandatory document by kind — a renewal replaces the prior expiry. */
    renewSubcontractDoc(id, { kind, expiresOn, docRef }, user) {
      const s = this._subcontract(id);
      if (!LISTS.subcontractDocTypes.includes(kind)) throw new Error("Unknown document kind");
      s.docs = s.docs.filter((d) => d.kind !== kind);
      s.docs.push({ kind, expiresOn: expiresOn || null, docRef: docRef || "" });
      this._log(user, "renewSubcontractDoc", s.number + " " + kind);
      return s;
    }
    _subcontract(id) {
      const s = this.state.subcontracts.find((x) => x.id === id);
      if (!s) throw new Error("Subcontract not found");
      return s;
    }
    /**
     * Traffic light over the three mandatory documents (§4.2: insurance, PRL,
     * Social Security registration). Missing counts the same as expired — an
     * absent document cannot be assumed valid.
     */
    subcontractDocStatus(s) {
      const t = this.state.today;
      const byKind = {};
      for (const d of s.docs || [])
        if (!byKind[d.kind] || (d.expiresOn || "") > (byKind[d.kind].expiresOn || ""))
          byKind[d.kind] = d;
      let worst = "g";
      const items = LISTS.subcontractDocTypes.map((kind) => {
        const d = byKind[kind];
        let sev = "g";
        if (!d || !d.expiresOn) sev = "r";
        else if (d.expiresOn < t) sev = "r";
        else if (d.expiresOn <= addDays(t, 30)) sev = "y";
        if (sev === "r") worst = "r";
        else if (sev === "y" && worst !== "r") worst = "y";
        return { kind, doc: d || null, sev };
      });
      return { items, worst };
    }
    /** The project's subcontracts with awarded/certified/invoiced/pending and doc status (§4.2 list). */
    subcontractsForProject(projectId) {
      return this.state.subcontracts
        .filter((s) => s.projectId === projectId)
        .map((s) => {
          const certifiedCents = sum(s.certifications, (c) => c.amountCents);
          const invoicedCents = sum(
            this.state.bills.filter((b) => s.billIds.includes(b.id)),
            (b) => b.baseCents,
          );
          return {
            ...clone(s),
            certifiedCents,
            invoicedCents,
            pendingCents: Math.max(0, s.awardedCents - certifiedCents),
            docStatus: this.subcontractDocStatus(s),
          };
        });
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
    /**
     * Rows a statement import would ADD, and rows it would duplicate (§5.3
     * "detección de duplicados y de solapamiento de periodos ya cargados").
     *
     * Read-only on purpose: the caller sees what an import would do before it
     * does it. A statement re-uploaded because someone was not sure whether it
     * had gone in is the single most common way a bank balance ends up wrong,
     * and it is silent — every duplicated movement reconciles perfectly
     * against a document that is now double-counted.
     */
    previewImport(accountId, rows) {
      const existing = this.state.movements.filter((m) => m.accountId === accountId);
      const key = (r) =>
        [r.accountingDate, cents(r.amountCents), (r.concept || "").trim().toUpperCase()].join("|");
      const seen = new Map();
      for (const m of existing) seen.set(key(m), m.id);
      const fresh = [];
      const duplicates = [];
      const withinBatch = new Set();
      for (const r of rows) {
        const k = key(r);
        if (seen.has(k) || withinBatch.has(k))
          duplicates.push({ row: r, existingId: seen.get(k) || null });
        else {
          withinBatch.add(k);
          fresh.push(r);
        }
      }
      const dates = rows
        .map((r) => r.accountingDate)
        .filter(Boolean)
        .sort();
      const overlaps = existing.some(
        (m) =>
          dates.length &&
          m.accountingDate >= dates[0] &&
          m.accountingDate <= dates[dates.length - 1],
      );
      return {
        fresh,
        duplicates,
        overlapsExistingPeriod: overlaps,
        from: dates[0] || null,
        to: dates[dates.length - 1] || null,
      };
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

    /* ---- §5.3: reconciliation as its own discipline ----
       The matching itself is @repo/capability-reconciliation's; everything
       here is the part that owns state — undoing, locking a period, and the
       candidate list the matcher scores against. */

    /**
     * Undo a reconciliation (§5.3 "deshacer una conciliación").
     *
     * Reversing the movement's own status is the easy half. The half that
     * matters is the payment or collection `matchMovement` created: leaving
     * that behind would show the bill as paid on one screen and the movement
     * as unreconciled on another, which is precisely the state reconciliation
     * exists to make impossible.
     */
    unmatchMovement(movId, user) {
      const m = this.state.movements.find((x) => x.id === movId);
      if (!m) throw new Error("Movement not found");
      if (this.bankPeriodClosed(m.accountingDate))
        throw new Error("The period is closed — reopen it before undoing a reconciliation");
      for (const p of this.state.payments.filter((x) => x.movementId === movId)) {
        this.voidPayment(p.id, user);
      }
      for (const c of this.state.collections.filter((x) => x.movementId === movId)) {
        this.voidCollection(c.id, user);
      }
      m.matched = null;
      m.allocations = [];
      m.class = null;
      m.status = "unallocated";
      this._log(user, "unmatchMovement", movId);
      return m;
    }

    /** Every movement of a period that nothing yet explains (§5.3's health indicator). */
    unreconciledMovements(from, to) {
      return this.state.movements.filter(
        (m) =>
          m.status === "unallocated" &&
          !m.excludedFromPL &&
          (!from || m.accountingDate >= from) &&
          (!to || m.accountingDate <= to),
      );
    }

    /**
     * The documents a movement could plausibly be, projected into the shape
     * the matcher wants. Money out looks at supplier bills, money in at issued
     * invoices — the direction is decided here, from the sign the bank wrote,
     * because only this layer knows what an invoice and a bill ARE.
     */
    reconciliationCandidates(movId) {
      const m = this.state.movements.find((x) => x.id === movId);
      if (!m) throw new Error("Movement not found");
      const out = [];
      if (m.amountCents < 0) {
        for (const b of this.state.bills) {
          const open = this.billOutstandingCents(b.id);
          if (open <= 0) continue;
          out.push({
            id: b.id,
            kind: "bill",
            amountCents: b.totalCents,
            outstandingCents: open,
            direction: "out",
            date: b.date,
            reference: b.number,
            counterparty: this.party(b.supplierId).name,
          });
        }
      } else {
        for (const i of this.state.invoices) {
          if (i.kind === "creditNote") continue;
          const open = this.invoiceOutstandingCents(i.id);
          if (open <= 0) continue;
          out.push({
            id: i.id,
            kind: "invoice",
            amountCents: i.totalCents,
            outstandingCents: open,
            direction: "in",
            date: i.date,
            reference: i.number,
            counterparty: this.party(i.partyId).name,
          });
        }
      }
      return out;
    }

    /** A movement as the matcher's input value. Text is everything a bank wrote. */
    movementValue(m) {
      return {
        id: m.id,
        amountCents: m.amountCents,
        date: m.accountingDate,
        text: [m.concept, m.counterparty, m.merchantText, m.reference, m.observations]
          .filter(Boolean)
          .join(" "),
        accountRef: m.accountId,
      };
    }

    /**
     * Mark a movement as having no supporting document, and raise the task to
     * go and get it (§5.3 "marcar «sin respaldo» y generar la tarea").
     *
     * The task is the point. A flag on a movement is a fact nobody is
     * responsible for; a task has an owner and a date, and turns up in the
     * day view until somebody deals with it.
     */
    flagMovementNoDoc(movId, user) {
      const m = this.state.movements.find((x) => x.id === movId);
      if (!m) throw new Error("Movement not found");
      m.needsDoc = true;
      this.addTask(
        {
          title: "Reclamar justificante — " + (m.merchantText || m.concept || m.id),
          owner: "backoffice",
          due: addDays(this.state.today, 7),
          relatedRef: "movimiento",
        },
        user,
      );
      this._log(user, "flagMovementNoDoc", movId);
      return m;
    }

    /**
     * Close a reconciled period (§5.3 "cerrar y bloquear el periodo").
     *
     * Refuses while anything in it is still unexplained. A closed period whose
     * movements do not all reconcile is a lie told to whoever reads it next,
     * and the exception panel exists precisely so that this refusal is never a
     * surprise.
     */
    closeBankPeriod(from, to, user) {
      const open = this.unreconciledMovements(from, to);
      if (open.length)
        throw new Error(open.length + " movimientos sin conciliar — no se puede cerrar el periodo");
      this.state.bankPeriods.push({
        from,
        to,
        closedAt: this.state.today,
        closedBy: user || "backoffice",
        reopenedAt: null,
        reopenReason: "",
      });
      this._log(user, "closeBankPeriod", from + "→" + to);
      return this.state.bankPeriods[this.state.bankPeriods.length - 1];
    }
    /** Reopening leaves a record — "sin reapertura registrada" is the rule (§5.3). */
    reopenBankPeriod(from, reason, user) {
      const p = (this.state.bankPeriods || []).find((x) => x.from === from && !x.reopenedAt);
      if (!p) throw new Error("No closed period starting on " + from);
      if (!reason || !String(reason).trim())
        throw new Error("Reopening a closed period needs a reason");
      p.reopenedAt = this.state.today;
      p.reopenReason = String(reason).trim();
      p.reopenedBy = user || "backoffice";
      this._log(user, "reopenBankPeriod", from);
      return p;
    }
    bankPeriodClosed(dateIso) {
      return (this.state.bankPeriods || []).some(
        (p) => !p.reopenedAt && p.from <= dateIso && dateIso <= p.to,
      );
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
        { id: this._id("wkr"), name: "", kind: "employee", rateHistory: [], docs: [] },
        w,
      ); // rateHistory {from, rateCentsPerHour}; docs {kind, expiresOn, docRef}
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
    /** A worker's own mandatory documentation (§4.6's "trabajador sin
        documentación válida" — the alert, not a hard block: only subcontracted
        TRADES are blocked from entering the site, per §4.2). */
    addWorkerDoc(workerId, { kind, expiresOn, docRef }, user) {
      const w = this.state.workers.find((x) => x.id === workerId);
      if (!w) throw new Error("Worker not found");
      w.docs = (w.docs || []).filter((d) => d.kind !== kind);
      w.docs.push({ kind, expiresOn: expiresOn || null, docRef: docRef || "" });
      this._log(user, "addWorkerDoc", w.name + " " + kind);
      return w;
    }
    recordHours(h, user) {
      // LAB-01/02/03 + LAB-07 (kind: normal|extra|festivo; optional extra-pay supplement)
      if (h.projectId) {
        const p = this.state.projects.find((x) => x.id === h.projectId);
        // Refusing this outright is worth more than an alert: "horas imputadas
        // a un proyecto cerrado" (§4.6) can then never actually happen going
        // forward, rather than being merely visible after the fact.
        if (p && p.closed) throw new Error("Cannot record hours against a closed project");
      }
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
          locked: false,
          approvedAt: null,
          approvedBy: null,
        },
        h,
      );
      rec.rateCents = this.workerRateCents(rec.workerId, rec.date);
      rec.costCents = mul(rec.hoursMilli, rec.rateCents) + (rec.extraPayCents || 0);
      this.state.labour.push(rec);
      return rec;
    }
    deleteHours(id, user) {
      // "registrar, corregir y eliminar horas" (§4.6)
      const idx = this.state.labour.findIndex((x) => x.id === id);
      if (idx < 0) throw new Error("Hours entry not found");
      if (this.state.labour[idx].locked)
        throw new Error("Hours entry is in an approved week — reopen the week first");
      const rec = this.state.labour[idx];
      this.state.labour.splice(idx, 1);
      this._log(user, "deleteHours", id);
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
    /**
     * The weekly grid §4.6 asks for: worker × day, with totals. Rows are every
     * worker who is either assigned to the project over the week or already
     * has hours logged on it — an assigned worker with nothing logged yet is
     * exactly the "jornada sin registrar" the alert list flags, and it has to
     * appear as an empty row for that to be visible rather than invisible.
     */
    labourWeek(projectId, weekStart) {
      const start = weekStartOf(weekStart);
      const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));
      const workerIds = new Set([
        ...(this.state.assignments || [])
          .filter(
            (a) => a.projectId === projectId && a.workerId && a.from <= days[6] && a.to >= days[0],
          )
          .map((a) => a.workerId),
        ...this.state.labour
          .filter((l) => l.projectId === projectId && days.includes(l.date))
          .map((l) => l.workerId),
      ]);
      const rows = [...workerIds].map((workerId) => {
        const w = this.state.workers.find((x) => x.id === workerId);
        const cells = days.map((date) => {
          const entries = this.state.labour.filter(
            (l) => l.workerId === workerId && l.projectId === projectId && l.date === date,
          );
          return {
            date,
            hoursMilli: sum(entries, (e) => e.hoursMilli),
            locked: entries.length > 0 && entries.every((e) => e.locked),
            entryIds: entries.map((e) => e.id),
          };
        });
        return {
          workerId,
          name: w ? w.name : "?",
          kind: w ? w.kind : "employee",
          cells,
          totalMilli: sum(cells, (c) => c.hoursMilli),
        };
      });
      return {
        weekStart: start,
        days,
        rows,
        totalsByDayMilli: days.map((date, i) => sum(rows, (r) => r.cells[i].hoursMilli)),
      };
    }
    /** Approve (lock) a worker's week — "aprobar ... partes semanales" (§4.6). */
    approveLabourWeek(workerId, weekStart, user) {
      const start = weekStartOf(weekStart);
      const end = addDays(start, 6);
      const rows = this.state.labour.filter(
        (l) => l.workerId === workerId && l.date >= start && l.date <= end,
      );
      if (!rows.length) throw new Error("No hours recorded for that worker in that week");
      rows.forEach((l) => {
        l.locked = true;
        l.approvedAt = this.state.today;
        l.approvedBy = user || "backoffice";
      });
      this._log(user, "approveLabourWeek", workerId + " " + start);
      return rows;
    }
    /** Reject/reopen — the counterpart of approveLabourWeek. */
    unapproveLabourWeek(workerId, weekStart, user) {
      const start = weekStartOf(weekStart);
      const end = addDays(start, 6);
      const rows = this.state.labour.filter(
        (l) => l.workerId === workerId && l.date >= start && l.date <= end,
      );
      rows.forEach((l) => {
        l.locked = false;
        l.approvedAt = null;
        l.approvedBy = null;
      });
      this._log(user, "unapproveLabourWeek", workerId + " " + start);
      return rows;
    }
    /**
     * "Posibilidad de repetir el parte del día anterior" (§4.6) — the one-step
     * mobile flow the spec asks for. A worker already logged on `toDate` is
     * left alone rather than duplicated, so pressing the button twice is safe.
     */
    repeatDay(projectId, fromDate, toDate, user) {
      const src = this.state.labour.filter((l) => l.projectId === projectId && l.date === fromDate);
      if (!src.length) throw new Error("No hours recorded on " + fromDate + " to repeat");
      const already = new Set(
        this.state.labour
          .filter((l) => l.projectId === projectId && l.date === toDate)
          .map((l) => l.workerId),
      );
      const created = [];
      for (const l of src) {
        if (already.has(l.workerId)) continue;
        created.push(
          this.recordHours(
            {
              workerId: l.workerId,
              projectId: l.projectId,
              chapterNum: l.chapterNum,
              hoursMilli: l.hoursMilli,
              kind: l.kind,
              date: toDate,
            },
            user,
          ),
        );
      }
      this._log(user, "repeatDay", projectId + " " + fromDate + "→" + toDate);
      return created;
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
    /**
     * The completeness traffic light of §5.6: each block of the package with
     * its document count, its value, and how many things are wrong with it.
     *
     * Green/amber/red rather than a single "ready" flag, because the blocks
     * fail differently and independently: an empty cash register in a quarter
     * with no petty cash is fine, an empty issued-invoice register in a
     * quarter that billed is not, and both would read the same as "0 items".
     */
    packageBlocks(quarter) {
      const inQ = (d) => quarterOf(d) === quarter;
      const ex = this.exceptionList(quarter);
      const invoices = this.state.invoices.filter((i) => inQ(i.date));
      const bills = this.state.bills.filter((b) => inQ(b.date));
      const movements = this.state.movements.filter((m) => inQ(m.accountingDate));
      const tillIds = new Set(
        this.state.bankAccounts.filter((a) => a.kind === "till").map((a) => a.id),
      );
      const cash = movements.filter((m) => tillIds.has(m.accountId));
      const late = this.lateDocuments(quarter);
      const assets = this.fixedAssetRegister(quarter);
      const sev = (n) => (n > 0 ? "r" : "g");
      return [
        {
          key: "issued",
          label: "Facturas emitidas",
          count: invoices.length,
          amountCents: sum(invoices, (i) =>
            i.kind === "creditNote" ? -i.totalCents : i.totalCents,
          ),
          issues: ex.seriesGaps.invoice.length,
          sev: sev(ex.seriesGaps.invoice.length),
        },
        {
          key: "received",
          label: "Facturas soportadas",
          count: bills.length,
          amountCents: sum(bills, (b) => b.totalCents),
          issues: ex.billsWithoutDocument.length,
          sev: sev(ex.billsWithoutDocument.length),
        },
        {
          key: "bank",
          label: "Movimientos bancarios",
          count: movements.length - cash.length,
          amountCents: sum(
            movements.filter((m) => !tillIds.has(m.accountId)),
            (m) => m.amountCents,
          ),
          issues: ex.unallocatedMovements.length,
          sev: sev(ex.unallocatedMovements.length),
        },
        {
          key: "cash",
          label: "Caja",
          count: cash.length,
          amountCents: sum(cash, (m) => m.amountCents),
          issues: ex.undocumentedCash.length,
          sev: sev(ex.undocumentedCash.length),
        },
        {
          key: "late",
          label: "Extemporáneos",
          count: late.length,
          amountCents: sum(late, (l) => (l.confirmed && l.confirmed.totalCents) || 0),
          // Amber, never red: a late document is a fact to declare in its own
          // block, not an error to fix. The goal §5.6 states is that this
          // block shrinks over time, which needs it visible rather than alarming.
          issues: 0,
          sev: late.length ? "y" : "g",
        },
        {
          key: "assets",
          label: "Activos, vehículos y renting",
          count: assets.length,
          amountCents: sum(assets, (a) => a.baseCents),
          issues: 0,
          sev: "g",
        },
        {
          key: "summaries",
          label: "Resúmenes fiscales",
          count: 2,
          amountCents: this.vatSummary(quarter).netCents,
          issues: ex.partiesWithoutTaxId.length,
          sev: sev(ex.partiesWithoutTaxId.length),
        },
      ];
    }

    /**
     * Block 8 of the package: fixed assets, vehicles and renting, kept apart
     * from direct site cost. They are the costs an accountant treats
     * differently from everything else, and lumping them into project cost is
     * both wrong for the accounts and flattering to the job's margin.
     */
    fixedAssetRegister(quarter) {
      const inQ = (d) => quarterOf(d) === quarter;
      const CATS = ["fixedAsset", "renting", "vehicles"];
      const out = [];
      for (const b of this.state.bills.filter((x) => inQ(x.date))) {
        for (const a of b.allocations || []) {
          if (!a.overheadCategory || !CATS.includes(a.overheadCategory)) continue;
          out.push({
            billId: b.id,
            number: b.number,
            date: b.date,
            supplier: this.party(b.supplierId).name,
            category: a.overheadCategory,
            baseCents: a.amountCents,
          });
        }
      }
      return out;
    }

    /**
     * Documents belonging to this quarter that only arrived after it closed
     * (§5.6's "documentos extemporáneos"), with duplicate detection against
     * what an earlier package already carried.
     */
    lateDocuments(quarter) {
      const inQ = (d) => quarterOf(d) === quarter;
      const alreadySent = new Set(
        (this.state.packagesSent || [])
          .filter((p) => p.quarter === quarter)
          .flatMap((p) => p.lateRefs || []),
      );
      return this.state.captured
        .filter((c) => c.confirmed && inQ(c.confirmed.date) && quarterOf(c.capturedAt) > quarter)
        .map((c) => ({ ...c, alreadySent: alreadySent.has(c.id) }));
    }

    /**
     * Every exception, flattened, each with whether a person has justified it.
     *
     * §5.6 makes this list blocking: "el envío se permite sólo cuando la lista
     * está a cero o cuando el usuario justifica y acepta expresamente cada
     * excepción". Flattening it here means the blocking check and the screen
     * read the same list, so the two can never disagree about what is
     * outstanding.
     */
    exceptionsWithStatus(quarter) {
      const ex = this.exceptionList(quarter);
      const accepted = this.state.exceptionsAccepted || {};
      const rows = [];
      const push = (kind, label, refs) => {
        for (const ref of refs) {
          const key = quarter + "|" + kind + "|" + ref;
          rows.push({ kind, label, ref, key, accepted: accepted[key] || null });
        }
      };
      push("billNoDoc", "Factura sin documento", ex.billsWithoutDocument);
      push("partyNoTaxId", "Tercero sin NIF válido", ex.partiesWithoutTaxId);
      push("movUnallocated", "Movimiento sin asignar", ex.unallocatedMovements);
      push("receiptUnmatched", "Cobro sin emparejar", ex.unmatchedReceipts);
      push("cashNoDoc", "Caja sin justificante", ex.undocumentedCash);
      push("seriesGap", "Hueco en la numeración", [
        ...ex.seriesGaps.invoice,
        ...ex.seriesGaps.receipt,
      ]);
      return rows;
    }
    /** Justify one exception so the package may go out despite it (GES-07). */
    acceptException(quarter, key, reason, user) {
      if (!reason || !String(reason).trim())
        throw new Error("Accepting an exception needs a justification");
      if (!this.state.exceptionsAccepted || typeof this.state.exceptionsAccepted !== "object")
        this.state.exceptionsAccepted = {};
      this.state.exceptionsAccepted[key] = {
        reason: String(reason).trim(),
        at: this.state.today,
        by: user || "backoffice",
      };
      this._log(user, "acceptException", key);
      return this.state.exceptionsAccepted[key];
    }
    /** Record a query the accountant raised, and later its answer (§5.6). */
    addGestoriaQuery(quarter, question, user) {
      const rec = {
        id: this._id("gq"),
        quarter,
        question: String(question || "").trim(),
        raisedAt: this.state.today,
        resolvedAt: null,
        resolution: "",
      };
      this.state.gestoriaQueries.push(rec);
      this._log(user, "addGestoriaQuery", quarter);
      return rec;
    }
    resolveGestoriaQuery(id, resolution, user) {
      const q = this.state.gestoriaQueries.find((x) => x.id === id);
      if (!q) throw new Error("Query not found");
      q.resolvedAt = this.state.today;
      q.resolution = String(resolution || "").trim();
      this._log(user, "resolveGestoriaQuery", id);
      return q;
    }
    /** Reopen a quarter already sent, leaving the record §5.6 requires. */
    reopenQuarter(quarter, reason, user) {
      const sent = (this.state.packagesSent || []).filter((p) => p.quarter === quarter);
      if (!sent.length) throw new Error("That quarter has not been sent");
      if (!reason || !String(reason).trim())
        throw new Error("Reopening a sent quarter needs a reason");
      const rec = {
        quarter,
        reopenedAt: this.state.today,
        reopenReason: String(reason).trim(),
        by: user || "backoffice",
      };
      sent[sent.length - 1].reopened = rec;
      this._log(user, "reopenQuarter", quarter);
      return rec;
    }

    /**
     * Generate the package (GES-01/02/06/08).
     *
     * BLOCKING, per §5.6: an exception must either not exist or have been
     * justified by name. `opts.recipient` records who it went to, which is the
     * other half of "marcar el periodo como enviado con fecha y destinatario".
     *
     * The refusal names the outstanding items rather than just counting them.
     * A blocked send that says "8 exceptions" sends someone hunting; one that
     * says which eight is a to-do list.
     */
    quarterlyPackage(quarter, opts, user) {
      // Kept callable as quarterlyPackage(quarter, user): every caller before
      // this session passed the user second, and a signature change that
      // silently reinterprets an existing argument is the worst kind.
      if (typeof opts === "string" || opts == null) {
        user = opts;
        opts = {};
      }
      // No override, deliberately. §5.6 allows exactly two ways past this —
      // the list is empty, or every item on it has been justified by name —
      // and a `force` flag would be a third that nobody would ever remove.
      const outstanding = this.exceptionsWithStatus(quarter).filter((x) => !x.accepted);
      if (outstanding.length) {
        throw new Error(
          "Excepciones sin justificar (" +
            outstanding.length +
            "): " +
            outstanding
              .slice(0, 4)
              .map((x) => x.label + " " + x.ref)
              .join("; ") +
            (outstanding.length > 4 ? "…" : ""),
        );
      }
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
        recipient: (opts && opts.recipient) || "",
        invoices: pkg.issuedInvoices.length,
        bills: pkg.receivedBills.length,
        exceptions: Object.values(pkg.exceptions).flat(2).length,
        acceptedExceptions: this.exceptionsWithStatus(quarter).filter((x) => x.accepted).length,
        // What went out as extemporaneous, so the NEXT package can tell an
        // already-declared late document from a genuinely new one.
        lateRefs: pkg.lateItems.map((c) => c.id),
      }); // GES-08
      // mark captured docs as sent
      this.state.captured
        .filter((c) => c.status === "allocated" && c.confirmed && inQ(c.confirmed.date))
        .forEach((c) => (c.status = "sentToAccounting"));
      this._log(user, "quarterlyPackage", quarter);
      return pkg;
    }

    /* =========================== COM — communications (§5.7) ===========================
       Templates, rules and the queue they fill. Deliberately NOT a sender:
       every state here is "drafted", "approved" or "cancelled", and the only
       thing that could put a message on a wire is the messaging capability's
       email-out port, whose sole bound adapter records and delivers nothing.
       The mandate is explicit — no real emails — and this section is where
       that would otherwise leak. */
    addCommsTemplate(t, user) {
      const rec = Object.assign(
        {
          id: this._id("tpl"),
          key: "",
          label: "",
          family: "comercial", // comercial|contractual|obra|cobros|proveedores|posventa
          lang: "es",
          subject: "",
          body: "",
          attach: "", // which document rides along: budget|invoice|contract|""
          version: 1,
          active: true,
        },
        t,
      );
      if (!rec.key) throw new Error("A template needs a key");
      this.state.commsTemplates.push(rec);
      this._log(user, "addCommsTemplate", rec.key);
      return rec;
    }
    /**
     * Editing a template makes a NEW version and retires the old one, rather
     * than overwriting it. A message already sent was rendered from some exact
     * wording, and "which version did the customer actually receive" has to
     * stay answerable after somebody improves the template.
     */
    updateCommsTemplate(id, patch, user) {
      const cur = this.state.commsTemplates.find((x) => x.id === id);
      if (!cur) throw new Error("Template not found");
      const allowed = ["label", "family", "lang", "subject", "body", "attach"];
      const next = Object.assign({}, cur, { id: this._id("tpl"), version: cur.version + 1 });
      for (const k of Object.keys(patch)) if (allowed.includes(k)) next[k] = patch[k];
      cur.active = false;
      cur.supersededBy = next.id;
      this.state.commsTemplates.push(next);
      this._log(user, "updateCommsTemplate", next.key + " v" + next.version);
      return next;
    }
    commsTemplate(key, lang) {
      const all = this.state.commsTemplates.filter(
        (t) => t.key === key && t.active && (!lang || t.lang === lang),
      );
      return all[all.length - 1] || null;
    }
    addCommsRule(r, user) {
      const rec = Object.assign(
        {
          id: this._id("crl"),
          label: "",
          event: "",
          template: "",
          recipient: "customer",
          afterDays: 0,
          channel: "email",
          mode: "draft", // see the capability: draft is the default, on purpose
          requiresFlag: undefined,
          active: true,
        },
        r,
      );
      if (!rec.event || !rec.template) throw new Error("A rule needs an event and a template");
      this.state.commsRules.push(rec);
      this._log(user, "addCommsRule", rec.event + " → " + rec.template);
      return rec;
    }
    updateCommsRule(id, patch, user) {
      const r = this.state.commsRules.find((x) => x.id === id);
      if (!r) throw new Error("Rule not found");
      const allowed = [
        "label",
        "event",
        "template",
        "recipient",
        "afterDays",
        "channel",
        "mode",
        "requiresFlag",
        "active",
      ];
      for (const k of Object.keys(patch)) if (allowed.includes(k)) r[k] = patch[k];
      this._log(user, "updateCommsRule", id);
      return r;
    }
    /**
     * The lifecycle facts the rules watch, projected out of engine state.
     *
     * A projection, not a log: recomputed from what is true now, so a rule
     * added today still sees the invoice that went overdue last week. The
     * alternative — appending events as they happen — means a new rule only
     * ever applies to the future, which is exactly not what somebody adding
     * "chase at 3 days" expects.
     */
    commsEvents() {
      const t = this.state.today;
      const ev = [];
      const addr = (partyId) => {
        const p = this.party(partyId);
        return { customer: p.email || "", supplier: p.email || "" };
      };
      for (const b of this.state.budgets) {
        const v = b.versions.find((x) => x.id === b.currentVersionId);
        if (v && v.sent && !b.acceptedVersionId)
          ev.push({
            event: "quote-sent",
            subjectRef: b.number,
            date: v.sent.date,
            recipients: addr(b.partyId),
            vars: { number: b.number, cliente: this.party(b.partyId).name },
          });
      }
      for (const r of this.receivables()) {
        if (r.outstandingCents > 0 && r.daysOverdue > 0)
          ev.push({
            event: "invoice-overdue",
            subjectRef: r.number,
            date: r.dueDate,
            recipients: addr(r.partyId),
            vars: { number: r.number, importe: r.outstandingCents / 100, cliente: r.party },
            flags: { unpaid: true },
          });
      }
      for (const c of this.state.contracts)
        if (c.signature && c.signature.customerSignedAt)
          ev.push({
            event: "contract-signed",
            subjectRef: c.number,
            date: c.signature.customerSignedAt,
            recipients: addr(c.partyId),
            vars: { number: c.number },
          });
      for (const p of this.state.projects)
        if (p.closed && p.dates.actualEnd)
          ev.push({
            event: "works-finished",
            subjectRef: p.code,
            date: p.dates.actualEnd,
            recipients: addr(p.partyId),
            vars: { number: p.code },
          });
      for (const s of this.state.subcontracts || []) {
        const ds = this.subcontractDocStatus(s);
        if (ds.worst === "r" && !["draft", "cancelled", "rejected"].includes(s.status))
          ev.push({
            event: "subcontractor-docs-expired",
            subjectRef: s.number,
            date: t,
            recipients: addr(s.supplierId),
            vars: { number: s.number, oficio: s.trade },
          });
      }
      return ev;
    }
    /**
     * Put a planned message in the queue. NOTHING is sent — `mode:"auto"` only
     * means it does not need a person to approve it before its due date.
     */
    queueCommunication(planned, user) {
      const tpl = this.commsTemplate(planned.template);
      const rec = {
        id: this._id("cq"),
        key: planned.ruleId + "|" + planned.subjectRef,
        ruleId: planned.ruleId,
        event: planned.event,
        subjectRef: planned.subjectRef,
        templateKey: planned.template,
        templateId: tpl ? tpl.id : null,
        to: planned.to,
        channel: planned.channel,
        dueDate: planned.dueDate,
        vars: planned.vars || {},
        status: planned.blocked ? "blocked" : "draft",
        blocked: planned.blocked || null,
        approvedAt: null,
        approvedBy: null,
        cancelledAt: null,
        sentAt: null,
      };
      this.state.commsQueue.push(rec);
      this._log(user, "queueCommunication", rec.key);
      return rec;
    }
    /** A person says yes. Still not sent — see the section note. */
    approveCommunication(id, user) {
      const q = this.state.commsQueue.find((x) => x.id === id);
      if (!q) throw new Error("Queued message not found");
      if (q.status === "blocked") throw new Error("This message has no recipient address");
      if (q.status !== "draft") throw new Error("Only a draft can be approved");
      q.status = "approved";
      q.approvedAt = this.state.today;
      q.approvedBy = user || "backoffice";
      this._log(user, "approveCommunication", q.key);
      return q;
    }
    cancelCommunication(id, user) {
      const q = this.state.commsQueue.find((x) => x.id === id);
      if (!q) throw new Error("Queued message not found");
      if (q.sentAt) throw new Error("A sent message cannot be cancelled");
      q.status = "cancelled";
      q.cancelledAt = this.state.today;
      this._log(user, "cancelCommunication", q.key);
      return q;
    }
    /**
     * Hand an approved message to the outbox.
     *
     * The name says "record", not "send", because that is what it does: the
     * only bound adapter is the log-only one, and this method exists so the
     * queue can move on rather than to put anything on a wire. When a real
     * provider is bound one day it goes behind `email-out@1` — never here.
     */
    recordCommunicationSent(id, user) {
      const q = this.state.commsQueue.find((x) => x.id === id);
      if (!q) throw new Error("Queued message not found");
      if (q.status !== "approved")
        throw new Error("Only an approved message can be marked as sent");
      q.status = "sent";
      q.sentAt = this.state.today;
      this._log(user, "recordCommunicationSent", q.key);
      return q;
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
        (x) => ["identified", "priced", "sent"].includes(x.status) && x.costCents > 0,
      ))
        push("high", `Extra sin aprobar con coste incurrido — ${this.project(c.projectId).code}`, {
          change: c.id,
        });
      // §4.1 — orders overdue on their confirmed arrival, and a three-way
      // reconciliation that does not add up once an order has been invoiced.
      for (const pu of this.state.purchases) {
        if (pu.cancelledAt || pu.status.delivered) continue;
        if (pu.expectedArrival && pu.expectedArrival < t)
          push("medium", `Llegada de material retrasada — orden ${pu.number}`, {
            purchase: pu.number,
          });
      }
      for (const pu of this.state.purchases.filter((p) => p.status.invoicedBillId)) {
        if (!this.purchaseReconciliation(pu.id).ok)
          push("medium", `Diferencias en la conciliación de la orden ${pu.number}`, {
            purchase: pu.number,
          });
      }
      // §4.2 — subcontracts: expired documentation, over-certification,
      // an unbilled trade past a reasonable window, retention past its release.
      for (const s of this.state.subcontracts || []) {
        if (["draft", "cancelled", "rejected"].includes(s.status)) continue;
        const proj = this.state.projects.find((x) => x.id === s.projectId);
        if (!proj || proj.closed) continue;
        if (this.subcontractDocStatus(s).worst === "r")
          push("high", `Documentación caducada — subcontrata ${s.number} (${proj.code})`, {
            subcontract: s.number,
          });
        const certifiedCents = sum(s.certifications, (c) => c.amountCents);
        if (s.awardedCents > 0 && certifiedCents > s.awardedCents * 1.1)
          push("medium", `Certificado por encima de lo adjudicado — subcontrata ${s.number}`, {
            subcontract: s.number,
          });
        if (
          ["accepted", "inExecution"].includes(s.status) &&
          s.dates.actualStart &&
          !s.billIds.length &&
          daysBetween(t, s.dates.actualStart) > 60
        )
          push("medium", `Subcontrata sin factura tras 60 días — ${s.number}`, {
            subcontract: s.number,
          });
        if (
          s.retentionPct > 0 &&
          !s.retentionReleasedAt &&
          s.retentionReleaseDate &&
          s.retentionReleaseDate < t
        )
          push("medium", `Retención no liberada tras el plazo de garantía — ${s.number}`, {
            subcontract: s.number,
          });
      }
      // §4.6 — a worker's own documentation has lapsed.
      for (const w of this.state.workers)
        for (const d of w.docs || [])
          if (d.expiresOn && d.expiresOn < t) {
            push("medium", `Documentación caducada — ${w.name} (${d.kind})`, { worker: w.id });
            break;
          }
      // §4.6 — a worker assigned to an open project with a working day past
      // and nothing logged for it. Counted, not itemised: one alert per
      // project keeps this from drowning the list on a large crew.
      for (const p of this.state.projects.filter((x) => !x.closed)) {
        let missing = 0;
        for (const a of (this.state.assignments || []).filter(
          (x) => x.projectId === p.id && x.workerId,
        )) {
          const from = a.from > (p.dates.start || a.from) ? a.from : p.dates.start || a.from;
          for (let d = from; d < t && d <= a.to; d = addDays(d, 1)) {
            const wd = new Date(d + "T00:00:00Z").getUTCDay();
            if (wd === 0 || wd === 6) continue; // weekends are not working days here
            if (
              !this.state.labour.some(
                (l) => l.workerId === a.workerId && l.projectId === p.id && l.date === d,
              )
            )
              missing++;
          }
        }
        if (missing > 0)
          push("medium", `${missing} jornada(s) sin registrar — ${p.code}`, { project: p.code });
      }
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
          ["identified", "priced", "sent"].includes(c.status),
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

    /* ============ manageability — correction & update paths (field audit) ============
       Every field a company must be able to change has a method here (or in its
       domain section). Immutable-by-design stays immutable: issued/frozen budget
       versions, invoice numbers/series, signed contract terms, project baselines,
       the chained invoice event log, and audit entries. Every correction is
       audit-logged. */
    updateCatalogueItem(id, patch, user) {
      const it = this.state.catalogue.find((x) => x.id === id);
      if (!it) throw new Error("Catalogue item not found");
      delete patch.id;
      delete patch.code;
      Object.assign(it, patch);
      this._log(user, "updateCatalogueItem", it.code || it.id);
      return it;
    }
    updateWorkPackage(id, patch, user) {
      const wp = this.state.packages.find((x) => x.id === id);
      if (!wp) throw new Error("Work package not found");
      if (patch.components) {
        for (const c of patch.components) {
          if (!this.state.catalogue.find((x) => x.id === c.itemId))
            throw new Error("Component item not found: " + c.itemId);
          if (!(c.qtyPerUnitMilli > 0)) throw new Error("Component qty must be positive");
        }
      }
      delete patch.id;
      Object.assign(wp, patch);
      this._log(user, "updateWorkPackage", wp.name || wp.id);
      return wp;
    }
    voidPrice(id, reason, user) {
      // prices stay append-only; a wrong entry is annulled, never deleted
      const p = this.state.prices.find((x) => x.id === id);
      if (!p) throw new Error("Price not found");
      p.annulled = { date: this.state.today, reason: reason || "" };
      this._log(user, "voidPrice", id);
      return p;
    }
    updateOpportunity(id, patch, user) {
      const o = this.state.opportunities.find((x) => x.id === id);
      if (!o) throw new Error("Opportunity not found");
      if (patch.status === "open" && o.status === "won")
        throw new Error("A won opportunity cannot be reopened");
      delete patch.id;
      Object.assign(o, patch);
      this._log(user, "updateOpportunity", id);
      return o;
    }
    resolveFeedback(id, resolution, user) {
      const f = (this.state.feedback || []).find((x) => x.id === id);
      if (!f) throw new Error("Feedback not found");
      f.status = "closed";
      f.resolution = resolution || "";
      f.resolvedAt = this.state.today;
      this._log(user, "resolveFeedback", id);
      return f;
    }
    updateBudget(id, patch, user) {
      // header-level corrections; frozen once a version is issued or accepted
      const b = this.budget(id);
      const cur = this.currentVersion(id);
      if (b.acceptedVersionId || (cur && cur.issued))
        throw new Error("Budget is issued/accepted — create a new version instead");
      const allowed = ["internalRef", "propertyId", "discountCents", "vatBp", "validityDays"];
      for (const k of Object.keys(patch)) if (!allowed.includes(k)) delete patch[k];
      Object.assign(b, patch);
      this._log(user, "updateBudget", b.number);
      return b;
    }
    _editableChapter(budgetId, chapterRef) {
      // chapterRef: chapter id or its num ("1")
      const v = this._editableVersion(budgetId);
      const ch = v.chapters.find((c) => c.id === chapterRef || c.num === String(chapterRef));
      if (!ch) throw new Error("Chapter not found");
      return ch;
    }
    _findLine(ch, lineRef) {
      // lineRef: line id or its num ("1.2")
      const ln = ch.lines.find((l) => l.id === lineRef || l.num === String(lineRef));
      if (!ln) throw new Error("Line not found");
      return ln;
    }
    updateChapter(budgetId, chapterRef, patch, user) {
      const ch = this._editableChapter(budgetId, chapterRef);
      delete patch.num;
      delete patch.lines;
      Object.assign(ch, patch);
      this._log(user, "updateChapter", this.budget(budgetId).number + " c" + ch.num);
      return ch;
    }
    updateLine(budgetId, chapterRef, lineRef, patch, user) {
      const ch = this._editableChapter(budgetId, chapterRef);
      const ln = this._findLine(ch, lineRef);
      delete patch.num;
      Object.assign(ln, patch);
      // _aggSubLines, not a plain sum: addLine, budgetTotals and editLine all
      // apply the waste percentage, so a plain sum here made an edited line
      // quietly disagree with the total it feeds.
      if (ln.subLines && ln.subLines.length) ln.qtyMilli = this._aggSubLines(ln.subLines);
      this._log(user, "updateLine", this.budget(budgetId).number + " " + ln.num);
      return ln;
    }
    removeLine(budgetId, chapterRef, lineRef, user) {
      const ch = this._editableChapter(budgetId, chapterRef);
      const ln = this._findLine(ch, lineRef);
      ch.lines.splice(ch.lines.indexOf(ln), 1);
      ch.lines.forEach((l, idx) => (l.num = ch.num + "." + (idx + 1)));
      this._log(user, "removeLine", this.budget(budgetId).number + " " + ln.num);
    }
    resolvePendingLine(budgetId, chapterRef, lineRef, { priceCents, costCents }, user) {
      const ln = this.updateLine(
        budgetId,
        chapterRef,
        lineRef,
        { priceCents: priceCents || 0, costCents: costCents || 0, pending: false },
        user,
      );
      this._log(user, "resolvePendingLine", this.budget(budgetId).number);
      return ln;
    }
    markContractSent(id, user) {
      const c = this.state.contracts.find((x) => x.id === id);
      if (!c) throw new Error("Contract not found");
      c.status = "sent";
      this._log(user, "markContractSent", c.number);
      return c;
    }
    cancelContract(id, reason, user) {
      const c = this.state.contracts.find((x) => x.id === id);
      if (!c) throw new Error("Contract not found");
      if (c.signature && c.signature.customerSignedAt)
        throw new Error("A signed contract cannot be cancelled here — needs a formal annex");
      c.status = "cancelled";
      c.cancelReason = reason || "";
      this._log(user, "cancelContract", c.number);
      return c;
    }
    updateProject(id, patch, user) {
      // planning-level fields only; the baseline stays frozen
      const p = this.project(id);
      const allowed = ["targetEnd", "name", "notes", "siteAddress"];
      const clean = {};
      for (const k of allowed) if (k in patch) clean[k] = patch[k];
      if ("targetEnd" in clean) {
        p.dates = p.dates || {};
        p.dates.targetEnd = clean.targetEnd;
        delete clean.targetEnd;
      }
      Object.assign(p, clean);
      this._log(user, "updateProject", p.code);
      return p;
    }
    reopenProject(id, user) {
      const p = this.project(id);
      if (!p.closed) throw new Error("Project is not closed");
      p.closed = false;
      p.status = "inExecution";
      this._log(user, "reopenProject", p.code);
      return p;
    }
    resolveRequirement(projectId, reqId, status, user) {
      const p = this.project(projectId);
      const r = (p.requirements || []).find((x) => x.id === reqId);
      if (!r) throw new Error("Requirement not found");
      r.status = status || "resolved";
      r.resolvedAt = this.state.today;
      this._log(user, "resolveRequirement", p.code);
      return r;
    }
    updateAssignment(id, patch, user) {
      const a = (this.state.assignments || []).find((x) => x.id === id);
      if (!a) throw new Error("Assignment not found");
      delete patch.id;
      Object.assign(a, patch);
      this._log(user, "updateAssignment", id);
      return a;
    }
    removeAssignment(id, user) {
      const A = this.state.assignments || [];
      const i = A.findIndex((x) => x.id === id);
      if (i < 0) throw new Error("Assignment not found");
      A.splice(i, 1);
      this._log(user, "removeAssignment", id);
    }
    rejectChange(id, reason, user) {
      const ch = this.state.changes.find((x) => x.id === id);
      if (!ch) throw new Error("Change not found");
      if (ch.invoiceId)
        throw new Error("An invoiced extra cannot be rejected — issue a credit note");
      ch.status = "rejected";
      ch.rejectReason = reason || "";
      this._log(user, "rejectChange", id);
      return ch;
    }
    markChangeExecuted(id, user) {
      const ch = this.state.changes.find((x) => x.id === id);
      if (!ch) throw new Error("Change not found");
      if (ch.status !== "approved")
        throw new Error("Only an approved extra can be marked executed");
      ch.executed = { date: this.state.today };
      this._log(user, "markChangeExecuted", id);
      return ch;
    }
    /** Annul a change that has not been invoiced yet — the effect it never
        should have had unwinds because approved-only totals feed the economics. */
    cancelChange(id, reason, user) {
      const ch = this.state.changes.find((x) => x.id === id);
      if (!ch) throw new Error("Change not found");
      if (ch.invoiceId)
        throw new Error("An invoiced extra cannot be cancelled — issue a credit note");
      ch.status = "cancelled";
      ch.cancelReason = reason || "";
      this._log(user, "cancelChange", id);
      return ch;
    }
    /**
     * The adenda: a customer-facing document generated from the contract and
     * the change, with a correlative number (§4.5). No cost or margin field —
     * the same QUO-10 rule the budget document follows, for the same reason.
     */
    renderChangeDoc(changeId) {
      const c = this.state.changes.find((x) => x.id === changeId);
      if (!c) throw new Error("Change not found");
      const p = this.project(c.projectId);
      const con = p.contractId ? this.state.contracts.find((x) => x.id === p.contractId) : null;
      const cfg = this.state.config;
      return {
        docType: "MODIFICACION",
        number: c.annexNumber || null,
        date: c.approvedAt || c.date,
        contractNumber: con ? con.number : null,
        issuer: {
          legalName: cfg.legalName,
          taxId: cfg.taxId,
          address: `${cfg.street}, ${cfg.postalCode} ${cfg.city}`,
        },
        customer: (({ name, taxId, billStreet, billPostalCode, billCity }) => ({
          name,
          taxId,
          address: `${billStreet}, ${billPostalCode} ${billCity}`,
        }))(this.party(p.partyId)),
        project: p.code,
        chapterNum: c.chapterNum,
        desc: c.desc,
        reason: c.reason,
        priceCents: c.priceCents,
        scheduleImpactDays: c.scheduleImpactDays,
      };
    }
    updatePurchase(id, patch, user) {
      const pu = this.state.purchases.find((x) => x.id === id);
      if (!pu) throw new Error("Purchase not found");
      if (pu.status.invoicedBillId && ("qtyMilli" in patch || "unitCents" in patch))
        throw new Error("Purchase already invoiced — correct the supplier bill instead");
      const allowed = [
        "projectId",
        "chapterNum",
        "desc",
        "qtyMilli",
        "unitCents",
        "orderRef",
        "urgent",
      ];
      for (const k of Object.keys(patch)) if (!allowed.includes(k)) delete patch[k];
      Object.assign(pu, patch);
      pu.totalCents = mul(pu.qtyMilli, pu.unitCents);
      this._log(user, "updatePurchase", pu.number);
      return pu;
    }
    markPurchaseDelivered(id, date, user) {
      const pu = this.state.purchases.find((x) => x.id === id);
      if (!pu) throw new Error("Purchase not found");
      pu.status.delivered = true;
      pu.deliveredDate = date || this.state.today;
      this._log(user, "markPurchaseDelivered", pu.number);
      return pu;
    }
    _billLocked(b) {
      if (b.status === "paid" || b.status === "partPaid") return "paid";
      const q = quarterOf(b.date);
      if ((this.state.packagesSent || []).some((p) => p.quarter === q)) return "quarter-sent";
      return null;
    }
    correctBill(id, patch, user) {
      const b = this.state.bills.find((x) => x.id === id);
      if (!b) throw new Error("Bill not found");
      const lock = this._billLocked(b);
      if (lock)
        throw new Error("Bill is locked (" + lock + ") — register a supplier credit note instead");
      const allowed = ["baseCents", "vatBp", "number", "date", "dueDate"];
      for (const k of Object.keys(patch)) if (!allowed.includes(k)) delete patch[k];
      Object.assign(b, patch);
      b.vatCents = Math.round((b.baseCents * (b.vatBp || 0)) / 10000);
      b.irpfCents =
        b.irpfCents && b.irpfRateBp
          ? Math.round((b.baseCents * b.irpfRateBp) / 10000)
          : b.irpfCents;
      b.totalCents = b.baseCents + b.vatCents - (b.irpfCents || 0);
      this._log(user, "correctBill", b.number);
      return b;
    }
    allocateBill(id, allocations, user) {
      const b = this.state.bills.find((x) => x.id === id);
      if (!b) throw new Error("Bill not found");
      const s = sum(allocations, (a) => a.amountCents);
      if (Math.abs(s - b.baseCents) > 1)
        throw new Error("Allocations must equal the bill base amount");
      b.allocations = allocations;
      this._log(user, "allocateBill", b.number);
      return b;
    }
    voidPayment(id, user) {
      const i = this.state.payments.findIndex((p) => p.id === id);
      if (i < 0) throw new Error("Payment not found");
      const rec = this.state.payments[i];
      this.state.payments.splice(i, 1);
      for (const a of rec.billAllocations || []) {
        const b = this.state.bills.find((x) => x.id === a.billId);
        if (b)
          b.status = this.billOutstandingCents(b.id) >= b.totalCents ? "registered" : "partPaid";
      }
      this._log(user, "voidPayment", id + " " + rec.amountCents + "c");
      return rec;
    }
    /**
     * The mirror of voidPayment, on the money-in side. Added for §5.3's
     * "deshacer una conciliación": undoing a match that created a collection
     * has to remove the collection too, or the invoice stays settled while the
     * movement goes back to unexplained — two screens, two different truths.
     */
    voidCollection(id, user) {
      const i = this.state.collections.findIndex((c) => c.id === id);
      if (i < 0) throw new Error("Collection not found");
      const rec = this.state.collections[i];
      this.state.collections.splice(i, 1);
      this._log(user, "voidCollection", id + " " + rec.amountCents + "c");
      return rec;
    }
    allocateCollection(id, allocations, user) {
      const c = this.state.collections.find((x) => x.id === id);
      if (!c) throw new Error("Collection not found");
      const s = sum(allocations, (a) => a.amountCents);
      if (s > c.amountCents) throw new Error("Allocations exceed the amount received");
      c.allocations = allocations;
      c.onAccountCents = c.amountCents - s;
      this._log(user, "allocateCollection", id);
      return c;
    }
    updateRecurring(id, patch, user) {
      const r = (this.state.recurring || []).find((x) => x.id === id);
      if (!r) throw new Error("Recurring template not found");
      const allowed = [
        "baseCents",
        "vatBp",
        "concept",
        "active",
        "dayOfMonth",
        "partyId",
        "projectId",
      ];
      for (const k of Object.keys(patch)) if (!allowed.includes(k)) delete patch[k];
      Object.assign(r, patch);
      this._log(user, "updateRecurring", id);
      return r;
    }
    voidMovement(id, reason, user) {
      // fixes duplicate imports; a void movement leaves balances and P&L
      const m = this.state.movements.find((x) => x.id === id);
      if (!m) throw new Error("Movement not found");
      if (m.status === "void") return m;
      m.status = "void";
      m.voidReason = reason || "";
      m.excludedFromPL = true;
      m.voidedAmountCents = m.amountCents;
      m.amountCents = 0;
      this._log(user, "voidMovement", id);
      return m;
    }
    unmatchMovement(id, user) {
      const m = this.state.movements.find((x) => x.id === id);
      if (!m) throw new Error("Movement not found");
      m.matched = null;
      this._log(user, "unmatchMovement", id);
      return m;
    }
    attachMovementDoc(id, docRef, user) {
      const m = this.state.movements.find((x) => x.id === id);
      if (!m) throw new Error("Movement not found");
      m.supportingDocRef = docRef;
      m.needsDoc = false;
      this._log(user, "attachMovementDoc", id);
      return m;
    }
    addWorkerRate(workerId, { from, rateCentsPerHour }, user) {
      // append-only: past effective rows stay; recorded hours keep their historic cost
      const w = this.state.workers.find((x) => x.id === workerId);
      if (!w) throw new Error("Worker not found");
      if (!(rateCentsPerHour > 0)) throw new Error("Rate must be positive");
      w.rateHistory.push({ from: from || this.state.today, rateCentsPerHour });
      w.rateHistory.sort((a, b) => a.from.localeCompare(b.from));
      this._log(user, "addWorkerRate", w.name);
      return w;
    }
    correctHours(id, patch, user) {
      // Also how §4.6's "reimputar horas de un proyecto a otro" happens: pass
      // a different projectId/chapterNum and the cost moves with it.
      const rec = this.state.labour.find((x) => x.id === id);
      if (!rec) throw new Error("Hours entry not found");
      if (rec.locked) throw new Error("Hours entry is in an approved week — reopen the week first");
      const allowed = ["projectId", "chapterNum", "hoursMilli", "date", "kind", "extraPayCents"];
      for (const k of Object.keys(patch)) if (!allowed.includes(k)) delete patch[k];
      if (patch.projectId) {
        const p = this.state.projects.find((x) => x.id === patch.projectId);
        if (p && p.closed) throw new Error("Cannot reallocate hours onto a closed project");
      }
      Object.assign(rec, patch);
      rec.rateCents = this.workerRateCents(rec.workerId, rec.date);
      rec.costCents = mul(rec.hoursMilli, rec.rateCents) + (rec.extraPayCents || 0);
      this._log(user, "correctHours", id);
      return rec;
    }
    completeTask(id, user) {
      const t = this.state.tasks.find((x) => x.id === id);
      if (!t) throw new Error("Task not found");
      t.status = "done";
      t.completedAt = this.state.today;
      t.completedBy = user || "system";
      this._log(user, "completeTask", t.title || id);
      return t;
    }
    updateTask(id, patch, user) {
      const t = this.state.tasks.find((x) => x.id === id);
      if (!t) throw new Error("Task not found");
      const allowed = ["title", "due", "assignee", "projectId", "status", "notes"];
      for (const k of Object.keys(patch)) if (!allowed.includes(k)) delete patch[k];
      Object.assign(t, patch);
      this._log(user, "updateTask", id);
      return t;
    }
    updateBankAccount(id, patch, user) {
      const a = this.state.bankAccounts.find((x) => x.id === id);
      if (!a) throw new Error("Account not found");
      const allowed = ["name", "iban", "notes"];
      for (const k of Object.keys(patch)) if (!allowed.includes(k)) delete patch[k];
      Object.assign(a, patch);
      this._log(user, "updateBankAccount", a.name);
      return a;
    }
    adminPatch(entity, id, patch, user) {
      // Guarded escape hatch so NO editable field is ever dead-ended, even before
      // it has a dedicated control. Refuses everything immutable-by-design and
      // audit-logs the full patch.
      const COLLECTIONS = {
        party: "parties",
        property: "properties",
        opportunity: "opportunities",
        visit: "visits",
        catalogueItem: "catalogue",
        workPackage: "packages",
        price: "prices",
        purchase: "purchases",
        capture: "captures",
        task: "tasks",
        worker: "workers",
        bankAccount: "bankAccounts",
        recurring: "recurring",
        assignment: "assignments",
        feedback: "feedback",
      };
      const col = COLLECTIONS[entity];
      if (!col)
        throw new Error("adminPatch not allowed for '" + entity + "' — use the dedicated method");
      const rec = (this.state[col] || []).find((x) => x.id === id);
      if (!rec) throw new Error(entity + " not found");
      const FORBIDDEN = ["id", "code", "number", "issued", "frozen", "baseline", "events"];
      for (const k of FORBIDDEN) delete patch[k];
      Object.assign(rec, patch);
      this._log(user, "adminPatch:" + entity, id + " " + JSON.stringify(patch).slice(0, 120));
      return rec;
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

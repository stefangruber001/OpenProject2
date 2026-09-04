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

  /**
   * Document series and their prefixes (ORG-04).
   *
   * One table, used both to set the series up and to repair a state that never
   * had them. Adding a document type means adding it here and nowhere else.
   */
  const SERIES_PREFIX = {
    budget: "PRE-",
    contract: "CTR-",
    invoice: "FAC-",
    receipt: "REC-",
    creditNote: "ABO-",
    purchaseOrder: "OC-",
    subcontract: "SUB-",
  };

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
  // First day of the calendar month containing dateIso, and the month after it.
  // The forecast grid buckets by month as well as by week, and a month is the
  // one bucket whose length is not a constant.
  const monthStartOf = (isoDate) => isoDate.slice(0, 7) + "-01";
  const addMonths = (isoDate, n) => {
    const y = +isoDate.slice(0, 4),
      m = +isoDate.slice(5, 7) - 1 + n;
    const ny = y + Math.floor(m / 12),
      nm = ((m % 12) + 12) % 12;
    return `${ny}-${String(nm + 1).padStart(2, "0")}-01`;
  };
  // Inverse of quarterOf: the last calendar day of a "YYYY-Qn" label.
  const quarterEndDate = (q) => {
    const [y, qn] = q.split("-Q");
    const endMonth = Number(qn) * 3; // Q1->3, Q2->6, Q3->9, Q4->12
    const firstOfNext =
      endMonth === 12
        ? `${Number(y) + 1}-01-01`
        : `${y}-${String(endMonth + 1).padStart(2, "0")}-01`;
    return addDays(firstOfNext, -1);
  };
  // deterministic light hash for the invoice event chain (VFU-01)
  const djb2 = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, "0");
  };

  /* ---------------- validators (MDM-03, MDM-08) ---------------- */
  const NIF_L = "TRWAGMYFPDXBNJZSQVHLCKE";
  /**
   * A tax identifier reduced to what actually identifies it.
   *
   * Case and punctuation are presentation, not identity: «07300000-f» and
   * «07300000F» are one taxpayer. Validation has always normalised this way;
   * the UNIQUENESS rule did not, and compared the stored strings raw — so the
   * hard MDM-03 rule could be walked straight past by typing the same
   * identifier with a dash. Both now ask the same question of the same value.
   */
  function normTaxId(v) {
    return String(v || "")
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "");
  }
  function validTaxId(v) {
    v = normTaxId(v);
    if (/^[0-9]{8}[A-Z]$/.test(v)) return NIF_L[parseInt(v.slice(0, 8), 10) % 23] === v[8]; // DNI/NIF
    if (/^[XYZ][0-9]{7}[A-Z]$/.test(v)) {
      const n = { X: "0", Y: "1", Z: "2" }[v[0]] + v.slice(1, 8);
      return NIF_L[parseInt(n, 10) % 23] === v[8]; // NIE
    }
    if (/^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(v)) return cifControlOk(v); // CIF, digit checked
    if (/^[A-Z]{2}[0-9A-Z]{2,13}$/.test(v)) return true; // EU VAT (structural)
    return false;
  }
  /**
   * CIF check digit (MDM-03: "validated for format and check digit").
   *
   * The DNI/NIE branches above compute their own check letter; this one used
   * to accept anything of the right shape. That gap is what let a scanned
   * NIF come back wrong-but-plausible during the S0b OCR spike — a corrupted
   * character in a mixed letter/digit code produces something that still
   * matches the regex, and only the check digit catches it.
   *
   * The seven digits are summed with the odd positions (1st, 3rd, 5th, 7th)
   * doubled and digit-summed first; the total's last digit gives a control
   * digit, which is looked up as a letter for organisation types that require
   * one. Verified against the workbook during the spike: 166 of 170
   * CIF-shaped values passed, a rate consistent with occasional scanning
   * errors rather than a wrong algorithm.
   */
  function cifControlOk(v) {
    const letter = v[0],
      digits = v.slice(1, 8),
      control = v[8];
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      let d = +digits[i];
      if (i % 2 === 0) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    const controlDigit = (10 - (sum % 10)) % 10;
    const controlLetter = "JABCDEFGHI"[controlDigit];
    if (/[ABEH]/.test(letter)) return control === String(controlDigit); // digit-only orgs
    if (/[NPQRSW]/.test(letter)) return control === controlLetter; // letter-only orgs
    return control === String(controlDigit) || control === controlLetter; // either is accepted
  }
  /**
   * Why `validTaxId` said no, in words a person can act on.
   *
   * The refusal used to be "Invalid tax identifier: 07000000F" — the value
   * the operator had just typed, handed back with an adjective, in English,
   * on a Spanish screen. It explains nothing: not which document type was
   * detected, not which character is wrong, not what it should have been.
   * Reported from the demo on 28/08 as exactly that — a message that gives
   * no purchase on the problem.
   *
   * This mirrors `validTaxId`'s own branches, because the shape it detects
   * IS the answer to "what did you mean to type": a DNI typed with the wrong
   * check letter is a different mistake from nine characters that match no
   * Spanish document at all. Returns null when the value is valid — callers
   * already know it is not, from `validTaxId`, before they call this.
   */
  function taxIdReason(v) {
    const s = normTaxId(v);
    if (/^[0-9]{8}[A-Z]$/.test(s)) {
      const expected = NIF_L[parseInt(s.slice(0, 8), 10) % 23];
      return expected === s[8]
        ? null
        : `DNI/NIF: la letra de control no corresponde — para ${s.slice(0, 8)} debería ser ${expected}, no ${s[8]}.`;
    }
    if (/^[XYZ][0-9]{7}[A-Z]$/.test(s)) {
      const n = { X: "0", Y: "1", Z: "2" }[s[0]] + s.slice(1, 8);
      const expected = NIF_L[parseInt(n, 10) % 23];
      return expected === s[8]
        ? null
        : `NIE: la letra de control no corresponde — para ${s.slice(0, 8)} debería ser ${expected}, no ${s[8]}.`;
    }
    if (/^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(s))
      return cifControlOk(s)
        ? null
        : `CIF: el dígito o letra de control no corresponde a los siete dígitos ${s.slice(1, 8)}.`;
    if (/^[A-Z]{2}[0-9A-Z]{2,13}$/.test(s)) return null; // EU VAT — structural only
    if (s.length !== 9)
      return `No tiene la longitud de un DNI, NIE o CIF español (9 caracteres) ni la de un IVA intracomunitario (dos letras de país + dígitos).`;
    return `El formato no corresponde a un DNI/NIF (8 dígitos y una letra), un NIE (X, Y o Z seguido de 7 dígitos y una letra) ni un CIF (una letra seguida de 7 dígitos y un dígito o letra).`;
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
    /* CON-04. `atProgressPct` carries a `progressPct` on the milestone — 10…90
       in tens — and replaces «al llegar a una fase» as the thing a customer can
       actually check: which fase, and how far into it, had no answer. `atStage`
       stays because contracts already signed carry it. The TRIGGER and the
       AMOUNT remain independent: a milestone reached at 50 % of the work may
       release 20 % of the money, which is the ordinary case. */
    installmentTriggers: [
      "onSignature",
      "atWorksStart",
      "atStage",
      "atProgressPct",
      "onCompletion",
      "fixedDate",
    ],
    /** The thresholds offered for `atProgressPct` — tens, so the list is short
     *  enough to choose from and precise enough to mean something. */
    progressTriggerSteps: [10, 20, 30, 40, 50, 60, 70, 80, 90],
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
    alertTypes: ["economica", "tecnica", "documental", "fiscal"], // DAS-06 grouping
  };

  /* ---------------- owner-maintained lists (DMC-03/04/05) ----------------
   *
   * Four of the lists above are not the system's business at all — they are
   * the company's vocabulary, and the company changes it. A new payment term,
   * a lead source that only this owner uses, a unit their suppliers quote in:
   * each of those was a code edit and a deploy, which is the definition of a
   * list nobody maintains.
   *
   * So these four move into `state.lists`, where the owner edits them from
   * DMC-03/04/05, and what stays here is only the SEED a new company starts
   * from. The rest of LISTS above is genuinely structural — invoice kinds,
   * document statuses, movement classes are keys the engine branches on, and
   * an owner renaming one would not be configuration, it would be a bug.
   *
   * The shape is `{code, es, ca, active}`, and the distinction matters:
   *
   *   code   what records store, forever. Never edited — a record written
   *          last year has to keep resolving, so renaming the LABEL is the
   *          supported operation and renaming the key is not offered.
   *   es/ca  what a person reads. Both, from the first day: the doc requires
   *          unit names in Spanish and Catalan regardless of the interface
   *          language, and a list that only carries one of them makes the
   *          Catalan interface fall back to Spanish silently (decision 20).
   *   active deactivate, never delete — the system-wide rule. A retired
   *          entry leaves the pickers and keeps resolving on the records
   *          that already carry it.
   */
  const LIST_DEFAULTS = {
    // CAT-02. The code IS the abbreviation shown in a table cell; es/ca are
    // the full names a picker and the printed document need.
    units: [
      { code: "ud", es: "unidad", ca: "unitat" },
      { code: "pa", es: "partida alzada", ca: "partida alçada" },
      { code: "m", es: "metro", ca: "metre" },
      { code: "ml", es: "metro lineal", ca: "metre lineal" },
      { code: "m2", es: "metro cuadrado", ca: "metre quadrat" },
      { code: "m3", es: "metro cúbico", ca: "metre cúbic" },
      { code: "h", es: "hora", ca: "hora" },
      { code: "kg", es: "kilogramo", ca: "quilogram" },
      { code: "l", es: "litro", ca: "litre" },
      { code: "%", es: "porcentaje", ca: "percentatge" },
    ],
    // MDM-06. These used to render as their raw English key in the Spanish
    // interface ("referrer" in a customer record) — nobody had a label to show
    // because there was no field to put one in.
    leadSources: [
      { code: "referrer", es: "Prescriptor", ca: "Prescriptor" },
      { code: "leadPlatform", es: "Plataforma de leads", ca: "Plataforma de leads" },
      { code: "searchEngine", es: "Buscador", ca: "Cercador" },
      { code: "website", es: "Web propia", ca: "Web pròpia" },
      { code: "socialMedia", es: "Redes sociales", ca: "Xarxes socials" },
      { code: "wordOfMouth", es: "Boca a boca", ca: "Boca-orella" },
      { code: "propertyManager", es: "Administrador de fincas", ca: "Administrador de finques" },
      { code: "repeatCustomer", es: "Cliente recurrente", ca: "Client recurrent" },
      { code: "other", es: "Otros", ca: "Altres" },
    ],
    // CRM-05. Shown beside the sources on DMC-04, because "where did it come
    // from" and "why was it lost" are the same conversation.
    lossReasons: [
      { code: "price", es: "Precio", ca: "Preu" },
      { code: "timing", es: "Plazos", ca: "Terminis" },
      { code: "scope", es: "Alcance", ca: "Abast" },
      { code: "competitor", es: "Competencia", ca: "Competència" },
      { code: "noResponse", es: "Sin respuesta", ca: "Sense resposta" },
      { code: "withdrew", es: "Desistió", ca: "Va desistir" },
    ],
    // DMC-01. The catalogue's chapter tree, and the reason it is a LIST and
    // not a derived set of the distinct values on items: a tree the owner can
    // drag into order needs somewhere to keep that order, and a chapter with
    // nothing in it yet still has to be visible or it can never be filled.
    itemChapters: [
      { code: "DEM", es: "Demoliciones", ca: "Enderrocs" },
      { code: "ALB", es: "Albañilería", ca: "Paleteria" },
      { code: "FON", es: "Fontanería", ca: "Lampisteria" },
      { code: "ELE", es: "Electricidad", ca: "Electricitat" },
      { code: "CLI", es: "Climatización", ca: "Climatització" },
      { code: "REV", es: "Revestimientos", ca: "Revestiments" },
      { code: "CAR", es: "Carpintería", ca: "Fusteria" },
      { code: "PIN", es: "Pintura", ca: "Pintura" },
      { code: "SAN", es: "Sanitarios y grifería", ca: "Sanitaris i aixetes" },
      { code: "VAR", es: "Varios", ca: "Diversos" },
    ],
    // MDM-07 / PAY-01.
    paymentMethods: [
      { code: "cash", es: "Efectivo", ca: "Efectiu" },
      { code: "transfer", es: "Transferencia", ca: "Transferència" },
      { code: "transfer30", es: "Transferencia 30 días", ca: "Transferència 30 dies" },
      { code: "transfer60", es: "Transferencia 60 días", ca: "Transferència 60 dies" },
      { code: "transfer90", es: "Transferencia 90 días", ca: "Transferència 90 dies" },
      { code: "directDebit", es: "Domiciliación", ca: "Domiciliació" },
      { code: "card", es: "Tarjeta", ca: "Targeta" },
      { code: "onAccount", es: "A cuenta", ca: "A compte" },
      { code: "oneOff", es: "Pago único", ca: "Pagament únic" },
    ],
    /* §5.3, sharpened by the client review: every bank movement is backed by
       an invoice — EXCEPT the ones that legitimately never will be, and those
       are marked person-by-person with a reason from this list, never guessed
       by a rule. Only movements with no invoice AND no reason are flagged.
       Owner-maintained like every list here: the codes are stored on the
       movements forever, the labels are what get edited. */
    unbackedReasons: [
      { code: "comision", es: "Comisión bancaria", ca: "Comissió bancària" },
      {
        code: "traspaso",
        es: "Traspaso entre cuentas propias",
        ca: "Traspàs entre comptes propis",
      },
      { code: "interes", es: "Intereses", ca: "Interessos" },
      { code: "impuesto", es: "Cargo de impuestos", ca: "Càrrec d'impostos" },
    ],
    /* A2, from the acceptance review: a payment lands a few cents or a few
       euros short of what the document says, and the honest question is not
       "did this match?" but «¿el resto sigue pendiente o se da por cerrado?».
       Both answers are legitimate and they are not the same: still-pending
       leaves the document owing, closed drives it to zero — and a document
       driven to zero without a stated reason is a number the gestoría cannot
       explain. Owner-maintained like every list here; the codes live on the
       documents forever, the labels are what get edited. */
    settlementReasons: [
      { code: "prontoPago", es: "Descuento por pronto pago", ca: "Descompte per pagament ràpid" },
      { code: "redondeo", es: "Redondeo", ca: "Arrodoniment" },
      { code: "comisionBancaria", es: "Comisión bancaria", ca: "Comissió bancària" },
      { code: "abonoPendiente", es: "Abono pendiente del proveedor", ca: "Abonament pendent" },
    ],
    /* Package 1, slide 9: the milestone split printed on a presupuesto — "40%
       a la firma…" — was a free-text box, so the same split got retyped
       slightly differently every time and never came back for a comparison.
       Unlike the lists above, its code IS its Spanish wording rather than a
       short identifier: nobody types a code for a payment split, they type
       the split itself, and the picker that replaces the free-text box (see
       erp.html) lets a new one be added inline without ever leaving the
       presupuesto — `addListEntry` accepts that exactly as DMC-05 does. */
    paymentConditions: [
      {
        code: "40% a la firma · 40% a mitad de obra · 20% a la finalización",
        es: "40% a la firma · 40% a mitad de obra · 20% a la finalización",
        ca: "40% a la signatura · 40% a mitja obra · 20% a la finalització",
      },
      {
        code: "50% a la firma · 50% a la entrega",
        es: "50% a la firma · 50% a la entrega",
        ca: "50% a la signatura · 50% a l'entrega",
      },
      {
        code: "30% a la firma · 70% a la entrega",
        es: "30% a la firma · 70% a la entrega",
        ca: "30% a la signatura · 70% a l'entrega",
      },
      {
        code: "100% a la entrega",
        es: "100% a la entrega",
        ca: "100% a l'entrega",
      },
    ],
    /* Package 1, slide 2: "Próxima acción" was a free-text box on the
       oportunidad — same reasoning and the same code-is-the-wording shape as
       paymentConditions above. `scheduleVisit`'s label matches the engine's
       own default (addOpportunity, "Programar visita") so a lead created
       before this list existed still resolves to a real entry rather than a
       synthetic "(retirada)" one. */
    nextActions: [
      { code: "Programar visita", es: "Programar visita", ca: "Programar visita" },
      { code: "Enviar presupuesto", es: "Enviar presupuesto", ca: "Enviar pressupost" },
      { code: "Volver a llamar", es: "Volver a llamar", ca: "Tornar a trucar" },
      {
        code: "Esperar respuesta del cliente",
        es: "Esperar respuesta del cliente",
        ca: "Esperar resposta del client",
      },
      { code: "Hacer seguimiento", es: "Hacer seguimiento", ca: "Fer seguiment" },
    ],
    /**
     * GAP 13 — the chart of accounts, and the reason it is a LIST.
     *
     * Rule 07 of the specification says every cost lands on a project **or an
     * account**. The account half had no field anywhere in the model, and the
     * chart itself lived in a separate page's own dataset that the engine had
     * never heard of. Bringing it in as `state.lists.accounts` does three
     * things at once: it gives the resolver something to validate against, it
     * makes the chart owner-maintainable through the same DMC-03/04/05 screen
     * as every other reference list, and it keeps the codes out of code.
     *
     * `overhead` names which overhead category defaults to this account, so
     * the mapping is a property of the account rather than a second table that
     * has to be kept in step with this one.
     */
    accounts: [
      { code: "600", es: "Compras de material", ca: "Compres de material", cost: "material" },
      { code: "601", es: "Subcontratas", ca: "Subcontractes", cost: "subcontract" },
      { code: "602", es: "Mano de obra de obra", ca: "Mà d'obra d'obra", cost: "labour" },
      { code: "629", es: "Otros costes de obra", ca: "Altres costos d'obra", cost: "other" },
      { code: "621", es: "Alquileres", ca: "Lloguers", overhead: "rent" },
      { code: "624", es: "Vehículos", ca: "Vehicles", overhead: "vehicles" },
      {
        code: "628",
        es: "Combustible y suministros",
        ca: "Combustible i subministraments",
        overhead: "fuel",
      },
      { code: "625", es: "Seguros", ca: "Assegurances", overhead: "insurance" },
      { code: "629.1", es: "Oficina", ca: "Oficina", overhead: "office" },
      {
        code: "623",
        es: "Servicios profesionales",
        ca: "Serveis professionals",
        overhead: "accountingFirm",
      },
      { code: "627", es: "Marketing", ca: "Màrqueting", overhead: "marketing" },
      { code: "662", es: "Gastos financieros", ca: "Despeses financeres", overhead: "financial" },
      { code: "631", es: "Otros tributos", ca: "Altres tributs", overhead: "taxes" },
      { code: "218", es: "Inmovilizado", ca: "Immobilitzat", overhead: "fixedAsset" },
      { code: "621.1", es: "Renting", ca: "Rènting", overhead: "renting" },
      {
        code: "629.9",
        es: "Otros gastos generales",
        ca: "Altres despeses generals",
        overhead: "otherOverhead",
      },
    ],
  };
  /** The four kinds DMC-03/04/05 maintain, in the order those screens show them. */
  const LIST_KINDS = Object.keys(LIST_DEFAULTS);
  /** A fresh copy — callers mutate what they get back, seeds must not drift. */
  function seedLists() {
    const out = {};
    for (const kind of LIST_KINDS)
      out[kind] = LIST_DEFAULTS[kind].map((e) => Object.assign({ active: true }, e));
    return out;
  }

  /*
   * DAS-06 — one entry per alert CONDITION alerts() can raise, keyed by a
   * stable code. This is the single place that says what TYPE a condition
   * belongs to (económica/técnica/documental/fiscal) and, for the conditions
   * §2.1/§3.2 explicitly call "configurable", what its default threshold is.
   * alerts() only adds a `code` at each push() site; everything else about
   * the alert (type, label, whether a threshold applies) is looked up here,
   * so a call site never has to repeat metadata that belongs in one place.
   * A code with no `thresholdKind` has no adjustable number — its rule still
   * exists (see ensureAlertRules) so it can be enabled/disabled and given a
   * recipient/channel, just not a threshold that would not mean anything.
   */
  const ALERT_META = {
    "AR-OVERDUE": { type: "economica", label: "Factura vencida" },
    "CON-INSTALLMENT-OVERDUE": { type: "economica", label: "Hito de cobro vencido" },
    "CASH-SHORTFALL": { type: "economica", label: "Caja no cubre los pagos previstos" },
    "PROJ-MARGIN-NEG": { type: "economica", label: "Margen negativo" },
    // Threshold intentionally NOT here: this condition already reads
    // state.config.marginThresholdBp (ORG-01, set via configureEntity). This
    // entry exists only so the alert can be enabled/disabled and grouped like
    // every other one — a second, competing threshold store would be the bug.
    "PROJ-MARGIN-LOW": { type: "economica", label: "Margen bajo el umbral configurado" },
    "CON-UNSIGNED-STARTED": { type: "tecnica", label: "Obra iniciada sin contrato firmado" },
    "CON-START-AT-RISK": {
      type: "tecnica",
      label: "Fecha de inicio comprometida en riesgo",
      thresholdKind: "days",
      defaultThreshold: 3,
    },
    "CON-DURATION-EXCEEDED": { type: "tecnica", label: "Duración contractual excedida" },
    "QUO-PENDING-LINES": { type: "documental", label: "Presupuesto con líneas pendientes" },
    "QUO-EXPIRING": {
      type: "economica",
      label: "Presupuesto por caducar",
      thresholdKind: "days",
      defaultThreshold: 7,
    },
    // §3.2: "alerta de oportunidad sin actividad durante X días (configurable)" —
    // the one condition the spec names explicitly as needing a tunable X.
    "OPP-STALE": {
      type: "economica",
      label: "Oportunidad sin avance",
      thresholdKind: "days",
      defaultThreshold: 14,
    },
    "PRICE-EXPIRED": { type: "documental", label: "Precio de proveedor caducado" },
    "PROJ-CHAPTER-OVERCOST": { type: "economica", label: "Partida por encima de coste previsto" },
    "CHG-UNAPPROVED-COST": { type: "economica", label: "Extra sin aprobar con coste incurrido" },
    "PUR-ARRIVAL-DELAYED": { type: "tecnica", label: "Llegada de material retrasada" },
    "PUR-RECONCILE-DIFF": {
      type: "economica",
      label: "Diferencias en la conciliación de una orden",
    },
    "SUB-DOC-EXPIRED": { type: "documental", label: "Documentación caducada de una subcontrata" },
    "SUB-OVERCERTIFIED": { type: "economica", label: "Certificado por encima de lo adjudicado" },
    "SUB-UNBILLED": {
      type: "documental",
      label: "Subcontrata sin factura",
      thresholdKind: "days",
      defaultThreshold: 60,
    },
    "SUB-RETENTION-DUE": { type: "economica", label: "Retención no liberada tras su plazo" },
    "WORKER-DOC-EXPIRED": { type: "documental", label: "Documentación caducada de un trabajador" },
    "LAB-MISSING-DAYS": { type: "tecnica", label: "Jornadas sin registrar" },
    "AP-UNALLOCATED": { type: "documental", label: "Facturas de proveedor sin asignar" },
    "BNK-UNALLOCATED": { type: "documental", label: "Movimientos bancarios sin asignar" },
    "AP-DUPLICATE": { type: "documental", label: "Posible factura duplicada" },
    "CON-WARRANTY-EXPIRING": {
      type: "documental",
      label: "Garantía próxima a vencer",
      thresholdKind: "days",
      defaultThreshold: 30,
    },
    "BNK-CASH-NODOC": { type: "documental", label: "Movimiento de caja sin justificante" },
    // Advisory internal reminder, NOT a legal filing deadline — no AEAT date
    // is asserted anywhere in this engine (see LEGAL_REVIEW.md §5). The
    // threshold is "days after quarter-end this tenant wants the package
    // sent by", entirely tenant-configurable and defaulting to a cushion
    // ahead of typical quarterly filing windows.
    "GES-PACKAGE-DUE": {
      type: "fiscal",
      label: "Paquete trimestral sin enviar a gestoría",
      thresholdKind: "days",
      defaultThreshold: 15,
    },
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

  /**
   * The BILLING ARRANGEMENT of a project: who owes for it, and on what terms.
   *
   * One job does not always have one payer. A general contractor hired by the
   * end customer sub-hires Canei; part of the work is then owed by the
   * contractor and part directly by the end customer — one project, one budget,
   * one set of costs and one margin, two people to invoice.
   *
   * Every project has this array. A job with a single payer holds exactly one
   * entry, which is what `defaultBilling` returns and what every project
   * created before this existed is migrated to, so the ordinary case is not a
   * special case of the split one — it is the same structure with one row.
   *
   * `vatBp` and `taxTreatment` live HERE and not on the project, because two
   * payers on one job are routinely taxed differently: work billed to a private
   * individual on their dwelling and the same work billed to a contractor are
   * not the same transaction in tax terms. `taxJustification` is the operator's
   * written reason, persisted on every invoice issued under it — this system
   * records tax decisions with their justification rather than re-deriving them
   * later from a rule that may since have changed.
   *
   * NOTHING here is inferred. `taxTreatment` defaults to "standard" and only an
   * operator moves it; see LEGAL_REVIEW.md. Guessing a reverse charge from the
   * shape of a party is how a filing goes wrong quietly.
   *
   * `paymentTermsDays: null` means "ask the party", which is what `issueInvoice`
   * already did — a second copy of a number the party record owns would go
   * stale the first time somebody renegotiated terms.
   */
  function defaultBilling(partyId, vatBp) {
    return [
      {
        partyId: partyId,
        role: "customer", // "customer" | "mainContractor"
        vatBp: vatBp,
        taxTreatment: "standard", // "standard" | "reverseCharge" | "exempt"
        taxJustification: "",
        paymentTermsDays: null,
      },
    ];
  }

  /**
   * The company's own record before anybody has filled it in.
   *
   * One shape, two callers: `configureEntity` merges onto it, and
   * `_configForRead` hands it to the document builders when `state.config` is
   * still null. Keeping them the same object literal is the point — a preview
   * on an unconfigured workspace shows precisely the fields the setup screen
   * will ask for, in the same order, with nothing invented.
   */
  function blankConfig() {
    return {
      /* --- who the company is (ORG-01) --- */
      legalName: "", // denominación social, as registered
      tradeName: "", // what it trades as, when that differs
      taxId: "",
      logo: null, // an uploaded file {storageKey,name,type,size}
      logoRef: "canei-logo", // the named pictogram, for the vector document stack

      /* --- the registered office, and where the work is actually run from ---
         Two addresses because a company has two: the one the register holds
         and the one on the letterhead. They are printed in different places —
         the trading address in the header, the registered office in the small
         print — and mirroring one onto the other is a decision the operator
         makes with a tick box, not something inferred here. */
      regStreet: "",
      regPostalCode: "",
      regCity: "",
      regProvince: "Barcelona",
      regCountry: "España",
      sameAsRegistered: false,
      street: "",
      postalCode: "",
      city: "",
      province: "Barcelona",
      country: "España",

      /* --- the mercantile register, which commercial correspondence carries --- */
      registry: "",
      registryTomo: "",
      registryFolio: "",
      registryHoja: "",

      /* --- how to reach it --- */
      phone: "",
      email: "",
      web: "",

      /* --- where it gets paid (AR-02) --- */
      iban: "",
      bic: "",
      bankName: "",

      /* --- the company's own defaults, which used to be literals in this
         file. Every value below is the number that was hard-coded at the site
         that now reads it, so an unconfigured workspace behaves exactly as it
         did before this record grew. --- */
      defaultVatBp: 1000,
      defaultIrpfBp: 0,
      paymentTermsDays: 30,
      quoteValidityDays: 30,
      defaultLanguage: "es",
      latePaymentInterestPctYear: 8,
      graceDays: 7,
      scheduleWithinDays: 7,
      startWithinDays: 15,
      marginThresholdBp: 1500,

      /* --- free text printed under every document --- */
      legalFooter: "",
    };
  }

  /**
   * One address filled in means both are known.
   *
   * A company that has typed only its trading address still has a registered
   * office — the same one — and a document that printed an empty «domicilio
   * social» beside a full header would look like a fault rather than a blank
   * field. Mirrors whichever side is missing, and honours the operator's tick
   * box when they say the two are the same.
   */
  function normaliseAddresses(c) {
    const hasReg = !!(c.regStreet || c.regCity);
    const hasTrade = !!(c.street || c.city);
    if (c.sameAsRegistered || (hasReg && !hasTrade)) {
      c.street = c.regStreet;
      c.postalCode = c.regPostalCode;
      c.city = c.regCity;
      c.province = c.regProvince;
      c.country = c.regCountry;
    } else if (hasTrade && !hasReg) {
      c.regStreet = c.street;
      c.regPostalCode = c.postalCode;
      c.regCity = c.city;
      c.regProvince = c.province;
      c.regCountry = c.country;
    }
    return c;
  }

  /* =============================================================================
     The standard message library.

     One definition, used by both the demonstration seeder and any company that
     has none — see ensureCommsTemplates(). It lived only in the seeder, which
     meant a real company had an empty library and the send path's
     `if (template)` quietly did nothing.

     Wording, not law: every one of these is editable on the Comunicaciones
     screen, and editing makes a new version rather than overwriting, so a
     message already sent stays reproducible.
     ========================================================================== */
  const STANDARD_COMMS_TEMPLATES = [
    {
      key: "quote-send",
      label: "Envío de presupuesto",
      family: "comercial",
      subject: "Su presupuesto {{number}}",
      body: "Hola {{cliente}},\n\nAdjuntamos el presupuesto {{number}}. Quedamos a su disposición para cualquier duda.\n\nUn saludo,",
      attach: "budget",
    },
    {
      key: "quote-followup",
      label: "Seguimiento de presupuesto",
      family: "comercial",
      subject: "Su presupuesto {{number}}",
      body: "Hola {{cliente}},\n\n¿Ha podido revisar el presupuesto {{number}}? Quedamos a su disposición para cualquier ajuste.\n\nUn saludo,",
      attach: "budget",
    },
    {
      key: "invoice-reminder",
      label: "Recordatorio de factura vencida",
      family: "cobros",
      subject: "Factura {{number}} pendiente",
      body: "Hola {{cliente}},\n\nLa factura {{number}}, por importe de {{importe}} €, figura pendiente en nuestros registros. Si ya la ha abonado, indíquenoslo y la conciliamos.\n\nGracias,",
      attach: "invoice",
    },
    {
      key: "works-start",
      label: "Aviso de inicio de obra",
      family: "obra",
      subject: "Comenzamos su obra el {{fecha}}",
      body: "Hola {{cliente}},\n\nConfirmamos el inicio de los trabajos. El equipo llegará a primera hora y le informaremos del avance semanalmente.\n\nUn saludo,",
    },
    {
      key: "docs-expired",
      label: "Documentación caducada",
      family: "proveedores",
      subject: "Documentación pendiente — {{number}}",
      body: "Buenos días,\n\nLa documentación asociada a {{number}} ({{oficio}}) figura caducada. Sin ella no es posible el acceso a obra.\n\nGracias,",
    },
    {
      key: "warranty-followup",
      label: "Seguimiento posventa",
      family: "posventa",
      subject: "¿Todo correcto tras la obra?",
      body: "Hola {{cliente}},\n\nHa pasado un tiempo desde que terminamos. ¿Está todo a su gusto? Cualquier detalle en garantía lo revisamos sin coste.\n\nUn saludo,",
    },
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
        importBatches: [], // BNK-06: one record per statement import, so it can be undone
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
        alertRules: [], // DAS-06: enabled/threshold/recipient/channel per alert code
        alertOverrides: {}, // DAS-07: assign/due/snooze/resolve/task-link, keyed by alertKey()
        // Declared here, not created lazily on first write. The migration
        // ladder already promises these to a restored blob, so leaving them out
        // of a NEW engine made the two shapes disagree — and it defeated the
        // backfill in from(), which can only restore collections it can see on
        // a fresh instance.
        feedback: [],
        supplierPerf: [],
        assignments: [],
        recurring: [],
        importConflicts: [],
        imports: {},
        plans: {},
        // DMC-03/04/05: the company's own vocabulary, not the engine's. Seeded
        // rather than empty — a new company that had to type its own units
        // before it could write a line would be worse off than one with a
        // starting list it can edit.
        lists: seedLists(),
        seq: { id: 1 },
      };
    }
    /* ---------- persistence ---------- */
    toJSON() {
      return this.state;
    }
    static from(json) {
      const e = new ERP();
      const fresh = e.state;
      e.state = json;
      // Backfill collections added after this blob was written, so restored
      // state has the same shape as a new engine. Without it, a document stored
      // by an older build is missing whatever arrays this build added, and the
      // first `state.x.filter(...)` throws somewhere far from the cause — on
      // the server that is a 500 on a page that has nothing to do with the new
      // feature. Cheap here, very expensive to diagnose there.
      for (const k of Object.keys(fresh))
        if (Array.isArray(fresh[k]) && !Array.isArray(e.state[k])) e.state[k] = [];
      // `lists` is an object, not an array, so the loop above cannot restore
      // it — and a blob without it has no units and no payment terms, which is
      // every picker in the application empty. The v10 migration is the real
      // owner; this is the belt-and-braces for a blob that reached `from()`
      // without passing through the ladder (a direct construction in a test,
      // a fixture written by hand).
      if (!e.state.lists || typeof e.state.lists !== "object") e.state.lists = seedLists();
      for (const kind of LIST_KINDS)
        if (!Array.isArray(e.state.lists[kind])) e.state.lists[kind] = seedLists()[kind];
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

    /* ============ DMC-03/04/05 — the lists the owner maintains ============
     *
     * Four reference lists that used to be code. Everything here is about one
     * distinction: a CODE is what records store and is therefore permanent,
     * a LABEL is what people read and is therefore editable. Offering to
     * rename a code would be offering to break every record already carrying
     * it, so it is not offered — `updateListEntry` patches labels and nothing
     * else.
     */
    /** Every entry of a kind, retired ones included — what DMC-03/04/05 edit. */
    listAll(kind) {
      if (!LIST_KINDS.includes(kind)) throw new Error("Unknown list: " + kind);
      if (!Array.isArray(this.state.lists[kind])) this.state.lists[kind] = seedLists()[kind];
      return this.state.lists[kind];
    }
    /** The entries a picker should offer: active only, in the owner's order. */
    listActive(kind) {
      return this.listAll(kind).filter((e) => e.active !== false);
    }
    /**
     * The label to show for a stored code.
     *
     * A code with no entry returns the code itself rather than an empty
     * string: a record written before the entry was retired — or one carrying
     * a code from an import nobody has curated yet — must still render as
     * SOMETHING a person can read and act on. A blank cell in a customer's
     * "origen" is indistinguishable from a customer who never had one.
     */
    listLabel(kind, code, lang) {
      const hit = this.listAll(kind).find((e) => e.code === code);
      if (!hit) return String(code || "");
      return (lang === "ca" ? hit.ca : hit.es) || hit.es || hit.code;
    }
    addListEntry(kind, entry, user) {
      const rows = this.listAll(kind);
      const code = String((entry && entry.code) || "").trim();
      if (!code) throw new Error("A list entry needs a code");
      if (rows.some((e) => e.code === code))
        throw new Error("That code already exists in " + kind + ": " + code);
      const es = String((entry && entry.es) || "").trim();
      if (!es) throw new Error("A list entry needs a Spanish name");
      const rec = {
        code,
        es,
        // Catalan falls back to the Spanish name rather than to empty, so a
        // half-filled entry degrades to a readable interface instead of a
        // blank one. The coverage guard is what stops that being permanent.
        ca: String((entry && entry.ca) || "").trim() || es,
        active: true,
      };
      rows.push(rec);
      this._log(user, "addListEntry", kind + "/" + code);
      return rec;
    }
    updateListEntry(kind, code, patch, user) {
      const hit = this.listAll(kind).find((e) => e.code === code);
      if (!hit) throw new Error("No such entry in " + kind + ": " + code);
      // `code` is deliberately absent from what a patch may touch — see the
      // block comment above.
      if (patch && typeof patch.es === "string") {
        const es = patch.es.trim();
        if (!es) throw new Error("A list entry needs a Spanish name");
        hit.es = es;
      }
      if (patch && typeof patch.ca === "string") hit.ca = patch.ca.trim() || hit.es;
      this._log(user, "updateListEntry", kind + "/" + code);
      return hit;
    }
    /**
     * Retire an entry. Deactivate, never delete — the system-wide rule.
     *
     * Deliberately NOT refused when the code is still in use: a list is
     * retired precisely BECAUSE it is no longer how the company works, and
     * every record already carrying it keeps resolving through `listLabel`.
     * Blocking on use would mean the only lists you can tidy are the ones
     * nobody ever used.
     */
    setListEntryActive(kind, code, active, user) {
      const hit = this.listAll(kind).find((e) => e.code === code);
      if (!hit) throw new Error("No such entry in " + kind + ": " + code);
      if (!active && this.listActive(kind).length <= 1 && hit.active !== false)
        throw new Error("A list cannot be left with no active entries");
      hit.active = !!active;
      this._log(user, active ? "activateListEntry" : "deactivateListEntry", kind + "/" + code);
      return hit;
    }
    /**
     * Move an entry within its list. The array order IS the display order,
     * which is what makes DMC-01's chapter tree draggable without a second
     * "sortIndex" field that could disagree with it.
     */
    moveListEntry(kind, code, toIndex, user) {
      const rows = this.listAll(kind);
      const from = rows.findIndex((e) => e.code === code);
      if (from < 0) throw new Error("No such entry in " + kind + ": " + code);
      const to = Math.max(0, Math.min(rows.length - 1, toIndex));
      if (to === from) return rows;
      rows.splice(to, 0, rows.splice(from, 1)[0]);
      this._log(user, "moveListEntry", kind + "/" + code + "→" + to);
      return rows;
    }
    /** How many stored records still carry this code — shown before retiring one. */
    listEntryUsage(kind, code) {
      const S = this.state;
      if (kind === "itemChapters") return S.catalogue.filter((i) => i.chapter === code).length;
      if (kind === "leadSources")
        return (
          S.parties.filter((p) => p.leadSource === code).length +
          S.opportunities.filter((o) => o.source === code).length
        );
      if (kind === "lossReasons")
        return S.opportunities.filter((o) => o.lossReason === code).length;
      if (kind === "units")
        return (
          S.catalogue.filter((i) => i.unit === code).length +
          sum(S.budgets, (b) =>
            sum(b.versions, (v) =>
              sum(v.chapters, (c) => c.lines.filter((l) => l.unit === code).length),
            ),
          )
        );
      if (kind === "paymentMethods")
        return (
          S.contracts.filter((c) => c.paymentMethod === code).length +
          S.invoices.filter((i) => i.paymentMethod === code).length
        );
      if (kind === "paymentConditions")
        return S.budgets.filter((b) => b.paymentConditions === code).length;
      if (kind === "nextActions")
        return S.opportunities.filter((o) => o.nextAction === code).length;
      return 0;
    }

    /* =========================== ORG — entity & series =========================== */
    configureEntity(cfg) {
      // ORG-01: applied to every document. Partial re-calls update only the
      // provided fields — existing values are preserved, never reset.
      this.state.config = Object.assign(blankConfig(), this.state.config || {}, cfg);
      for (const t of Object.keys(SERIES_PREFIX)) this.ensureSeries(t);
      this._log("backoffice", "configureEntity", this.state.config.legalName);
      return this.state.config;
    }
    /**
     * The margin below which a job raises an alert, in basis points.
     *
     * READ THROUGH A METHOD, because `state.config` is NULL until somebody
     * runs `configureEntity` — and `alerts()` is reached from the Torre, which
     * is the FIRST screen a workspace opens. A company that had not yet
     * entered its own legal details therefore crashed on the landing screen
     * with `Cannot read properties of null`, and the whole Torre went to the
     * error card: four indicators, the project list and every alert, gone,
     * because of one unconfigured field.
     *
     * That is the wrong failure. Not knowing the company's VAT number is a
     * reason to refuse to ISSUE a document; it is not a reason to refuse to
     * SHOW one. Reads degrade to the same default `configureEntity` would have
     * written; writes still refuse, loudly, where the law needs the answer.
     */
    marginThresholdBp() {
      const c = this.state.config;
      return c && typeof c.marginThresholdBp === "number" ? c.marginThresholdBp : 1500;
    }
    /**
     * The company's own record, or a refusal naming what is missing.
     *
     * The issuing paths read `config.iban` directly and would throw a
     * TypeError on a workspace that has never been configured — true, but
     * unreadable, and it names a property rather than the thing to go and do.
     */
    _requireConfig(what) {
      // Not «does the record exist» but «is it usable»: a workspace that saved
      // the form with the NIF still blank has a config object and no identity,
      // and issuing against it would print an anonymous invoice.
      if (!this.companyConfigured())
        throw new Error(
          `Cannot issue ${what}: the company's own details are not set up yet ` +
            `(Configuración › Empresa). A document carries the seller's identity, so it ` +
            `cannot be issued before that identity exists.`,
        );
      return this.state.config;
    }
    /**
     * The company's own record for a READ, blank-filled rather than absent.
     *
     * The document builders below all open with `const cfg = this.state.config`
     * and then reach straight into it, so every one of them threw on an
     * unconfigured workspace — the invoice preview, the budget, the delivery
     * note and the archive package alike. Guarding them one property at a time
     * is how the first pass at this missed three of the four.
     *
     * Blank strings are also the honest answer: they are exactly what an
     * operator sees after opening the setup screen and saving nothing.
     */
    _configForRead() {
      /* MERGED, not returned as stored. A workspace configured before this
         record grew has none of the newer keys, and a default read as
         `undefined` is worse than one read as a blank: `addDays(today,
         undefined)` is an invalid date, and it would reach a customer's
         document. Merging means an older stored record keeps every value it
         has and inherits the rest. */
      return normaliseAddresses(Object.assign(blankConfig(), this.state.config || {}));
    }
    /**
     * The seller's own block, built once for every document.
     *
     * Four builders each concatenated the address themselves, which is how the
     * quote came to print a header the change order did not, and why adding a
     * trading address would otherwise have meant four edits. One function, one
     * shape: change the company record and every document changes with it,
     * which is exactly what the operator asked this record to be.
     */
    /**
     * The company's own record, for a screen to read and edit.
     *
     * Blank-filled and normalised, exactly as the document builders see it, so
     * the form shows the same values the printed sheet will carry.
     */
    companyProfile() {
      return this._configForRead();
    }
    /**
     * What is still missing before this company can issue a document.
     *
     * The four the law needs on a factura (RD 1619/2012): who is issuing, its
     * tax number, where it is, and — because a bill nobody can pay is not a
     * bill — the account to pay into. Returned as field keys so the caller
     * decides the wording, and so ORG-01 and the setup screen can never
     * disagree about what "configured" means.
     */
    companyMissing() {
      const c = this._configForRead();
      return ["legalName", "taxId", "street", "iban"].filter((k) => !String(c[k] || "").trim());
    }
    companyConfigured() {
      return this.companyMissing().length === 0;
    }
    /**
     * The language a document should speak — N1's chain, resolved once:
     * an explicit choice wins; else the job's budget (the customer accepted
     * it in that language); else the customer's own preference; else the
     * company default. Empty docLanguage means "follow the company".
     */
    _docLanguageFor(explicit, projectId, partyId) {
      if (explicit) return explicit;
      const p = projectId ? this.state.projects.find((x) => x.id === projectId) : null;
      const b = p && p.budgetId ? this.state.budgets.find((x) => x.id === p.budgetId) : null;
      if (b && b.language) return b.language;
      const party = partyId ? this.state.parties.find((x) => x.id === partyId) : null;
      if (party && party.docLanguage) return party.docLanguage;
      return this._configForRead().defaultLanguage || "es";
    }
    _issuerBlock() {
      const c = this._configForRead();
      const line = (street, pc, city) =>
        [street, [pc, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      return {
        legalName: c.legalName,
        // What the company trades as, falling back to what it is called in the
        // register: a header has to say something.
        tradeName: c.tradeName || c.legalName,
        taxId: c.taxId,
        // Where the work is run from — the letterhead address.
        address: line(c.street, c.postalCode, c.city),
        // The registered office, for the small print. Equal to the one above
        // in the ordinary case, and that is fine: printing it twice is honest.
        registeredAddress: line(c.regStreet, c.regPostalCode, c.regCity),
        registry: [
          c.registry,
          c.registryTomo && "Tomo " + c.registryTomo,
          c.registryFolio && "Folio " + c.registryFolio,
          c.registryHoja && "Hoja " + c.registryHoja,
        ]
          .filter(Boolean)
          .join(" · "),
        phone: c.phone,
        email: c.email,
        web: c.web,
        iban: c.iban,
        bic: c.bic,
        bankName: c.bankName,
        logo: c.logo,
        logoRef: c.logoRef,
        legalFooter: c.legalFooter,
      };
    }
    /**
     * The document series this ERP issues, and their prefixes.
     *
     * Hoisted out of `configureEntity` because it was the ONLY place that
     * created them, and a state that never went through that call had
     * `series: {}` — so the first attempt to issue anything threw "Unknown
     * series: budget" at the operator, from a button whose whole job is to
     * open the quote builder. Nothing was wrong with the quote, the visit or
     * the customer; the numbering had simply never been set up, and no screen
     * said so.
     */
    ensureSeries(type) {
      const prefix = SERIES_PREFIX[type];
      // A type that is not a document series at all is still a programming
      // error and still throws — this only stops a KNOWN series from being
      // missing.
      if (!prefix) throw new Error("Unknown series: " + type);
      if (!this.state.series) this.state.series = {};
      if (!this.state.series[type]) {
        this.state.series[type] = { prefix, next: 1, issued: [] };
      }
      return this.state.series[type];
    }

    nextNumber(type) {
      // ORG-04: controlled, gap-free, no manual overwriting.
      // Series restart at 0001 each fiscal year (FAC-2027-0001 after FAC-2026-nnnn).
      // Created on demand: see ensureSeries. A missing series is a setup step
      // nobody performed, not a reason to refuse the operator's work.
      const s = this.ensureSeries(type);
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
          // N1 · the language THIS customer's documents print in. Empty means
          // "follow the company default" — an explicit choice, not a gap.
          docLanguage: "",
          leadSource: "",
          // No activityLine here on purpose. A "línea de actividad" belongs to
          // the WORK, not to the person paying for it — the same customer can
          // have a bathroom, a damp survey and a shop fit-out — so it lives on
          // budgets and projects (where profitability("activityLine") reads it)
          // and was removed from the party model. Schema v9 drops it from
          // stored records too.
          businessLine: "", // DMT-01 "Línea de negocio" — which BUSINESS, not which job (v4 plan gap 1)
          category: "", // DMT-02 "Categoría" — a supplier's own classification (gap 2)
          sourceSystem: "", // "Fuente" — where this record's data originally came from (gap 3)
          aliases: [], // "Nombres originales" — every name this party was ever filed under; the
          // only way to re-match it against a future re-upload (gap 4)
          createdAt: this.state.today, // MDM-01: when this record entered the file
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
        throw new Error("NIF/CIF no válido — " + taxIdReason(rec.taxId)); // MDM-03
      this._assertTaxIdFree(rec.taxId, rec.id); // MDM-03, hard rule
      const dup = this.findDuplicateParty(rec);
      rec.duplicateSuspect = dup ? dup.id : null;
      this.state.parties.push(rec);
      this._log(user, "addParty", rec.code);
      return rec;
    }
    /**
     * MDM-03 as a hard rule: no two ACTIVE parties may share a tax identifier.
     *
     * This cannot be expressed through findDuplicateParty, which matches on tax
     * id OR name OR phone and returns the FIRST hit — so a genuine duplicate
     * slipped through whenever an unrelated party matched first on a shared
     * phone number. On a system holding tax records that splits one customer's
     * invoices across two records and makes the filing built from them wrong.
     *
     * Deliberately scoped to active parties: deactivation is how this system
     * retires a record, and a retired holder must not block a legitimate
     * re-registration under the same identifier.
     *
     * THE REFUSAL NAMES THE RECORD THAT CAUSED IT. It used to say only
     * «Duplicate active party for tax id X», which tells the operator that
     * something in the file holds that identifier but not WHAT — and nothing
     * in the product would tell them either: this rule reads the whole party
     * file, while Clientes shows only parties with the customer role, and no
     * register's search looked at the tax id at all. So a legitimate
     * registration was refused, in English, pointing at a record the operator
     * could not reach. The name is what makes it findable, and it is the same
     * courtesy the SOFT duplicate warning beside it has always extended.
     */
    _assertTaxIdFree(taxId, selfId) {
      const key = normTaxId(taxId);
      if (!key) return;
      const clash = this.state.parties.find(
        (x) => x.active && x.id !== selfId && normTaxId(x.taxId) === key,
      );
      if (clash)
        throw new Error(
          "Ya existe un registro activo con ese NIF: " + clash.name + " (" + clash.code + ")",
        );
    }
    /** Soft warning at capture time — a suspect, not a refusal. */
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
      if (patch.taxId && !validTaxId(patch.taxId))
        throw new Error("NIF/CIF no válido — " + taxIdReason(patch.taxId));
      if (patch.taxId) this._assertTaxIdFree(patch.taxId, p.id); // MDM-03 on edit too
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
    /**
     * Everything that would be orphaned by deleting this party, as a list of
     * human-readable references. Empty means the record is genuinely free.
     */
    partyEconomicRefs(id) {
      const S = this.state;
      const out = [];
      const add = (label, arr, ref) => arr.forEach((x) => out.push(label + " " + ref(x)));
      add(
        "presupuesto",
        S.budgets.filter((b) => b.partyId === id),
        (b) => b.number,
      );
      add(
        "contrato",
        S.contracts.filter((c) => c.partyId === id),
        (c) => c.number,
      );
      add(
        "proyecto",
        S.projects.filter((p) => p.partyId === id),
        (p) => p.code,
      );
      add(
        "factura",
        S.invoices.filter((i) => i.partyId === id),
        (i) => i.number,
      );
      add(
        "recibo",
        S.receipts.filter((r) => r.partyId === id),
        (r) => r.number,
      );
      add(
        "factura recibida",
        S.bills.filter((b) => b.supplierId === id),
        (b) => b.number,
      );
      add(
        "cobro",
        (S.collections || []).filter((c) => c.partyId === id),
        (c) => c.id,
      );
      add(
        "subcontrata",
        (S.subcontracts || []).filter((s) => s.supplierId === id),
        (s) => s.number,
      );
      add(
        "orden de compra",
        S.purchases.filter((p) => p.supplierId === id),
        (p) => p.number,
      );
      return out;
    }
    /**
     * Hard-delete a party (MDM-12 / §3.1).
     *
     * REFUSES while any economic document points at it — "no se permite
     * eliminar un cliente con documentos económicos asociados: se desactiva y
     * se conserva el histórico". Deleting the customer behind a issued invoice
     * would leave that invoice pointing at nothing, and an issued document is
     * immutable precisely so it can still be explained years later. The
     * refusal names what is in the way so the caller can offer the honest
     * alternative (deactivate) instead of guessing.
     */
    deleteParty(id, user) {
      const p = this.party(id);
      const refs = this.partyEconomicRefs(id);
      if (refs.length)
        throw new Error(
          "No se puede eliminar: tiene " +
            refs.length +
            " documento(s) asociado(s) — " +
            refs.slice(0, 4).join(", ") +
            (refs.length > 4 ? "…" : "") +
            ". Desactívalo para conservar el histórico.",
        );
      this.state.parties = this.state.parties.filter((x) => x.id !== id);
      this.state.properties = this.state.properties.filter((x) => x.partyId !== id);
      this.state.opportunities = this.state.opportunities.filter((x) => x.partyId !== id);
      this._log(user, "deleteParty", p.code + " " + p.name);
      return p;
    }
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
      // "activityLine" here used to reference a field that left the party
      // model in v9 (see addParty) — every party read as permanently missing
      // it, which quietly deflated everyone's completeness percentage for a
      // field nobody could ever fill in. businessLine is its DMT replacement.
      const extras = ["email", "leadSource", "businessLine"].filter(
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
    property(id) {
      const pr = this.state.properties.find((x) => x.id === id);
      if (!pr) throw new Error("Property not found");
      return pr;
    }
    /**
     * MDM-05's edit path — addProperty had no way back to a record once
     * created, which is why every inmueble in the system came from the seed:
     * nothing on screen could add one, and nothing could fix a typo in one
     * either. `id` and `partyId` are excluded: reassigning an inmueble to a
     * different client is a different operation (move it explicitly) than
     * correcting its own fields, and conflating the two is how a client's
     * address quietly becomes somebody else's.
     */
    updateProperty(id, patch, user) {
      const pr = this.property(id);
      const clean = Object.assign({}, patch);
      delete clean.id;
      delete clean.partyId;
      Object.assign(pr, clean);
      this._log(user, "updateProperty", pr.id);
      return pr;
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
      o.decidedAt = this.state.today; // DAS-01: "contratadas/perdidas últimos 12 meses"
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
      // VIS-01/02/03/06. Creates an already-COMPLETED visit in one step —
      // kept exactly as it was (seed/history call it this way six times) for
      // backfilling historical captures where scheduling was never a real
      // event. COM-02's own screen uses scheduleVisit/completeVisit below,
      // which is the two-step path a person actually lives through.
      const rec = Object.assign(
        {
          id: this._id("vis"),
          opportunityId: null,
          propertyId: null,
          date: this.state.today,
          status: "done",
          scheduledAt: this.state.today,
          completedAt: this.state.today,
          owner: "operations",
          measurements: [],
          photos: [],
          notes: "",
          assumptions: [],
          exclusions: [],
          handwrittenEstimateRef: null,
          budgetId: null,
          lines: [], // lines → budget without retype (VIS-06)
        },
        v,
      );
      // date is still the field callers pass; keep the derived stamps
      // aligned with it unless the caller overrode them explicitly.
      if (!("scheduledAt" in v)) rec.scheduledAt = rec.date;
      if (!("completedAt" in v)) rec.completedAt = rec.date;
      this.state.visits.push(rec);
      const o = this.state.opportunities.find((x) => x.id === rec.opportunityId);
      if (o && o.status === "awaitingVisit") o.status = "awaitingBudget";
      this._log(user, "addVisit", rec.id);
      return rec;
    }
    /**
     * COM-02's "programada" half. A visit that has not happened yet — no
     * measurements, no photos, just when and for whom. Kept as its own
     * record (not a field on the opportunity) because a visit has its own
     * lifecycle: it can be rescheduled, and once it happens it is completed
     * with a full capture, exactly like a visit created directly ever was.
     */
    scheduleVisit(v, user) {
      // VIS-01: date/time, client, address and who is going.
      if (!v || !v.opportunityId) throw new Error("A visit needs an opportunity");
      if (!v.scheduledAt) throw new Error("A visit needs a date");
      const rec = Object.assign(
        {
          id: this._id("vis"),
          opportunityId: null,
          propertyId: null,
          scheduledAt: this.state.today,
          scheduledTime: "",
          owner: "operations",
          status: "scheduled",
          date: null, // set by completeVisit — this visit has not happened
          completedAt: null,
          measurements: [],
          photos: [],
          notes: "",
          assumptions: [],
          exclusions: [],
          handwrittenEstimateRef: null,
          budgetId: null,
          lines: [],
        },
        v,
      );
      this.state.visits.push(rec);
      this._log(user, "scheduleVisit", rec.id);
      return rec;
    }
    /**
     * The capture step. Refuses on an already-completed visit — a finished
     * visit is corrected through `validateVisit` (VIS-08, back office), not
     * re-completed, so there is exactly one place a capture is first
     * recorded and exactly one place it is amended afterward.
     */
    completeVisit(id, patch, user) {
      const v = this.state.visits.find((x) => x.id === id);
      if (!v) throw new Error("Visit not found");
      if (v.status === "done")
        throw new Error("Visit is already completed — use validateVisit to correct it");
      const CAPTURE = [
        "measurements",
        "photos",
        "notes",
        "assumptions",
        "exclusions",
        "handwrittenEstimateRef",
        "lines",
      ];
      for (const k of CAPTURE) if (patch && k in patch) v[k] = patch[k];
      v.status = "done";
      v.date = this.state.today;
      v.completedAt = this.state.today;
      const o = this.state.opportunities.find((x) => x.id === v.opportunityId);
      if (o && o.status === "awaitingVisit") o.status = "awaitingBudget";
      this._log(user, "completeVisit", v.id);
      return v;
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
          // Not "material": the field is unused (Package 8 review, 28/08) and a
          // fabricated default is worse than an honest gap — see taxIdReason's
          // own reasoning for the same call on a different field. Left in the
          // schema so a record written before the form dropped it still reads
          // and prints correctly; nothing computes from it (grepped clean).
          type: "",
          chapter: "",
          active: true,
          imageRefs: [],
          defaultCostCents: 0,
          defaultPriceCents: 0,
          // DMC-01. What the customer is actually getting: the same "punto de
          // agua" at two qualities is two different jobs and two different
          // prices, and an argument on site months later is settled by what
          // the presupuesto said the brand and model were.
          brand: "",
          model: "",
          quality: "",
        },
        it,
      );
      // Package 8 review (28/08): a subpartida with no partida is unfindable —
      // the register's own tree can only show it under an orphan bucket, and
      // the builder's catalogue picker can only offer it from "todas las
      // partidas". Existing orphans (if any) are grandfathered; only creation
      // is refused, so nothing already in the catalogue is touched.
      if (!rec.chapter) throw new Error("La partida es obligatoria");
      this.state.catalogue.push(rec);
      this._log(user, "addCatalogueItem", rec.code);
      return rec;
    }
    /** DMC-01's edit path. `code` is excluded: budget lines store it. */
    updateCatalogueItem(id, patch, user) {
      const it = this.state.catalogue.find((x) => x.id === id);
      if (!it) throw new Error("Catalogue item not found");
      const clean = Object.assign({}, patch);
      delete clean.id;
      delete clean.code;
      Object.assign(it, clean);
      this._log(user, "updateCatalogueItem", it.code);
      return it;
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
          // DMC-02 detail (v4 plan gaps 6-9). taxRateBp and minOrder default to
          // null rather than 0: "no rate recorded" and "0% tax" are different
          // facts, and so are "no minimum" and "a minimum of nothing".
          taxRateBp: null, // gap 6 — «IVA %» on the price row
          supplierRef: "", // gap 7 — «Código art.», the SUPPLIER's code, not ours
          wasteCents: 0, // gap 8 — waste-management charge, alongside transport
          minOrder: null, // gap 8 — minimum order quantity
          projectRef: "", // gap 9 — «Proyecto» the price was quoted for
          notes: "", // gap 9 — «Notas»
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
      // PRE-15 header. The defaults are the company's, not this file's — see
      // blankConfig: validity, language and the tax rates all used to be
      // literals here and in a second place each, which is how a rate changed
      // in one and not the other.
      const cfg = this._configForRead();
      const rec = Object.assign(
        {
          id: this._id("bud"),
          number: this.nextNumber("budget"),
          date: this.state.today,
          internalRef: "",
          partyId: null,
          propertyId: null,
          preparedBy: user || "backoffice",
          validityDate: addDays(this.state.today, cfg.quoteValidityDays),
          status: "draft",
          // Resolved below once the party is known — N1's chain.
          language: "",
          activityLine: "renovation",
          surfaceM2: 0,
          discountCents: 0,
          vatBp: cfg.defaultVatBp,
          irpfBp: cfg.defaultIrpfBp,
          paymentConditions: "",
          exclusions: [],
          assumptions: [],
          /* How long the work itself takes, in working days. Asked for on the
             quote (Package 8 review, 28/08): a customer comparing two offers
             is choosing on price AND on when their kitchen is usable again,
             and the document said nothing about the second. A COUNT of days
             rather than a date, deliberately — the start depends on when they
             accept, which is not known while the quote is being written, and
             it is the same shape as the contract's `duration.estimatedDays`
             so the contract can inherit it later without a conversion.
             null, never 0: "not stated" and "immediate" are different
             promises, and only one of them is safe to print. */
          executionDays: null,
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
      // N1: explicit choice > this customer's docLanguage > company default.
      rec.language = this._docLanguageFor(rec.language, null, rec.partyId);
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
          manualNum: false, // COM-03 free numbering — see _renumber
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
          manualNum: false, // COM-03 free numbering — see _renumber
          code: "",
          itemId: null,
          desc: "",
          customerWording: "",
          unit: "ud",
          // What the catalogue entry SAYS this line is, carried onto the line.
          //
          // These four were on the catalogue record and nowhere else, so a line
          // taken from the catalogue arrived without them and the information
          // was visible on the price-book screen and invisible on the quote —
          // which is the one place it settles an argument. `addCatalogueItem`
          // already says why brand and model exist: the same water point at two
          // qualities is two jobs and two prices, and six months later the only
          // record of which was sold is the presupuesto.
          //
          // Copied, not looked up through `itemId`: a quote is a promise made on
          // a date, and re-reading today's catalogue would silently restate what
          // was offered when the price book moves. `itemId` still records where
          // the figures came from, so drift can be REPORTED without rewriting.
          type: "", // material | ownLabour | subcontract | machinery | professional | waste | other
          brand: "",
          model: "",
          quality: "",
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
          // Provenance for a line that arrived from an uploaded workbook
          // (v4 plan gap 12, decision 10). Empty on a line typed here, which
          // is the honest answer — and the reason a later filtered upload can
          // still be re-matched against what is already on file.
          sourceFile: "",
          sourceSheet: "",
          chapterOriginal: "",
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

    /**
     * Assign positional numbers across a whole version — EXCEPT to rows whose
     * number was typed by a person (`manualNum`).
     *
     * That exception is the whole of "free numbering" (v4 COM-03). The
     * automatic scheme is what most rows want: a number is the reader's index
     * into the document and into the graphic annex, so it has to stay
     * contiguous when rows are added, deleted or dragged. But a presupuesto is
     * sometimes written against a numbering the customer or the architect
     * already uses, and a system that silently renumbers those rows is a system
     * the estimator has to fight. So: a number you typed is yours and survives
     * every reorder; a number the system assigned belongs to the position and
     * moves with it. Clearing a manual number hands the row back to automatic.
     */
    _renumber(version) {
      version.chapters.forEach((c, i) => {
        c.order = i;
        if (!c.manualNum) c.num = String(i + 1);
        c.lines.forEach((l, j) => {
          if (!l.manualNum) l.num = c.num + "." + (j + 1);
        });
      });
      return version;
    }

    /** Delete a line addressed by its id alone, renumbering what remains. */
    deleteLine(budgetId, lineId, user) {
      const v = this._editableVersion(budgetId);
      const found = this.findLine(budgetId, lineId, v.id);
      if (!found) throw new Error("Line not found");
      found.chapter.lines = found.chapter.lines.filter((l) => l.id !== lineId);
      this._renumber(v);
      this._log(user, "deleteLine", this.budget(budgetId).number + " " + found.line.num);
      return found.chapter;
    }

    /**
     * Delete a chapter and everything filed under it.
     *
     * It existed with no caller and no audit entry: the estimator could add a
     * partida and never take one away, so a chapter added by mistake stayed in
     * the presupuesto and had to be emptied line by line and left standing at
     * zero. Now it is reachable, and it LOGS — deleting five priced subpartidas in
     * one press is exactly the kind of act that has to leave a trace.
     *
     * Guarded by `_editableVersion`, so a sent presupuesto cannot lose a
     * chapter under the customer's copy, and by `_renumber`, so the ones that
     * remain close the gap rather than leaving 1, 3, 4.
     */
    removeChapter(budgetId, chapterId, user) {
      const v = this._editableVersion(budgetId);
      const gone = v.chapters.find((c) => c.id === chapterId);
      if (!gone) throw new Error("Chapter not found");
      v.chapters = v.chapters.filter((c) => c.id !== chapterId);
      this._renumber(v);
      this._log(
        user,
        "removeChapter",
        `${this.budget(budgetId).number} ${gone.num}. ${gone.name} (${(gone.lines || []).length} subpartidas)`,
      );
      return gone;
    }

    /* ---- COM-03: reordering. The builder's tree and grid are dragged, and a
       drag has to mean something to the document, not just to the screen — so
       both of these renumber through _renumber and the emitted document follows
       automatically. Both go through _editableVersion, so a sent presupuesto
       cannot be quietly re-sequenced under the customer's copy. ---- */

    /** Move a chapter to a new position among its siblings. */
    moveChapter(budgetId, chapterId, toIndex, user) {
      const v = this._editableVersion(budgetId);
      const i = v.chapters.findIndex((c) => c.id === chapterId);
      if (i < 0) throw new Error("Chapter not found");
      const j = Math.max(0, Math.min(v.chapters.length - 1, Math.round(Number(toIndex))));
      if (i !== j) v.chapters.splice(j, 0, v.chapters.splice(i, 1)[0]);
      this._renumber(v);
      this._log(user, "moveChapter", this.budget(budgetId).number + " c" + v.chapters[j].num);
      return v.chapters;
    }

    /**
     * Move a line within its chapter, or into another one.
     *
     * Moving BETWEEN chapters is the point: a line put under the wrong partida
     * lands in the wrong subtotal and, if that chapter is `optional` or
     * `outOfScope`, in the wrong section of the customer's document — so the
     * estimator must be able to correct it by dragging rather than by retyping
     * the line somewhere else and deleting the original.
     */
    moveLine(budgetId, lineId, toChapterId, toIndex, user) {
      const v = this._editableVersion(budgetId);
      const found = this.findLine(budgetId, lineId, v.id);
      if (!found) throw new Error("Line not found");
      const dest = v.chapters.find((c) => c.id === (toChapterId || found.chapter.id));
      if (!dest) throw new Error("Chapter not found");
      found.chapter.lines.splice(found.chapter.lines.indexOf(found.line), 1);
      const n = dest.lines.length;
      const j = toIndex == null ? n : Math.max(0, Math.min(n, Math.round(Number(toIndex))));
      dest.lines.splice(j, 0, found.line);
      this._renumber(v);
      this._log(user, "moveLine", this.budget(budgetId).number + " " + found.line.num);
      return found.line;
    }

    /** Give a line the number a person typed, or "" to hand it back to automatic. */
    setLineNumber(budgetId, lineId, num, user) {
      const v = this._editableVersion(budgetId);
      const found = this.findLine(budgetId, lineId, v.id);
      if (!found) throw new Error("Line not found");
      const wanted = String(num == null ? "" : num).trim();
      if (!wanted) {
        found.line.manualNum = false;
        this._renumber(v);
      } else {
        this._requireFreeNumber(v, wanted, lineId);
        found.line.num = wanted;
        found.line.manualNum = true;
      }
      this._log(user, "setLineNumber", this.budget(budgetId).number + " " + found.line.num);
      return found.line;
    }

    /** The same for a chapter. Its lines follow unless they are manual too. */
    setChapterNumber(budgetId, chapterId, num, user) {
      const v = this._editableVersion(budgetId);
      const c = v.chapters.find((x) => x.id === chapterId);
      if (!c) throw new Error("Chapter not found");
      const wanted = String(num == null ? "" : num).trim();
      if (!wanted) {
        c.manualNum = false;
      } else {
        this._requireFreeNumber(v, wanted, chapterId);
        c.num = wanted;
        c.manualNum = true;
      }
      this._renumber(v);
      this._log(user, "setChapterNumber", this.budget(budgetId).number + " c" + c.num);
      return c;
    }

    /**
     * Two rows may not answer to one number: it is the reader's only index.
     *
     * The error carries a `code`, unlike most in this class, because this is
     * the one failure here a USER causes in normal work — mistyping a number
     * that is already taken — and an interface should answer that in the
     * language it is speaking, not echo an English sentence written for a
     * developer. Everything unexpected still surfaces as its raw message,
     * which is what makes an unexpected failure visible at all.
     */
    _requireFreeNumber(version, wanted, exceptId) {
      const clash = (what) => {
        const e = new Error("That number is already used by a " + what);
        e.code = "DUPLICATE_NUMBER";
        return e;
      };
      for (const c of version.chapters) {
        if (c.id !== exceptId && c.num === wanted) throw clash("chapter");
        for (const l of c.lines) if (l.id !== exceptId && l.num === wanted) throw clash("line");
      }
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
          /* A14 · a line carrying money and no words. The customer would be
             asked to accept an amount for nothing nameable, which is the one
             row on the document nobody can defend later. Placeholder text
             («...», «-», «x») counts as empty — it is typed to get past the
             cursor, not to describe work. */
          if (
            !l.pending &&
            (l.lumpSum ? l.priceCents > 0 : qty > 0 && l.priceCents > 0) &&
            !String(l.customerWording || l.desc || "").replace(/[\s.·\-_x?¿]+/gi, "")
          )
            issues.push({
              level: "block",
              line: l.num,
              msg: "Línea con importe y sin descripción",
            });
          if (l.pending)
            issues.push({ level: "warn", line: l.num, msg: "Línea pendiente de precio" });
        }
      const t = this.budgetTotals(budgetId);
      for (const c of t.chapters)
        if (c.section === "base" && c.marginCents < 0)
          issues.push({ level: "block", line: c.num, msg: "Partida con margen negativo" });
      return issues;
    }
    /**
     * @param sentDate  when the document actually left, for the "a mano"
     *                  channel — a paper copy handed over yesterday is
     *                  recorded on the day it happened, not on the day
     *                  somebody got round to logging it. Defaults to today.
     *                  A future date is refused, same reasoning as
     *                  acceptVersion: nothing can be sent tomorrow.
     * @param sentTime  the clock time alongside sentDate, free text (HH:MM),
     *                  optional — a date is always known, a time is not
     *                  always worth asking for.
     */
    issueVersion(budgetId, { channel, sentDate, sentTime } = {}, user) {
      // QUO-02/05/07: freeze + generate customer doc from data
      const b = this.budget(budgetId);
      const v = this.currentVersion(budgetId);
      const blocks = this.validateBudget(budgetId).filter((i) => i.level === "block");
      if (blocks.length)
        throw new Error(
          "Budget fails validation: " + blocks.map((x) => x.line + " " + x.msg).join("; "),
        );
      // No completeness block here (decision 21): a presupuesto is a commercial
      // offer, not a fiscal document, and it must proceed with whatever data
      // exists on the party — the RD 1619/2012 requirement for a full NIF and
      // address is specific to the factura, and to the contrato that precedes
      // it (see createContract and issueInvoice, which still call
      // _requireComplete). Only the channel-specific check below stands: you
      // cannot email a document to an address that does not exist.
      const ch = channel || "email";
      if (ch === "email" && !validEmail(this.party(b.partyId).email))
        throw new Error("Email required to send electronically (MDM-04)");
      const when = sentDate || this.state.today;
      if (when > this.state.today) throw new Error("The send date cannot be in the future");
      v.issued = true;
      v.frozen = true;
      // PRE-10: freezing a version freezes its annex. The images are already
      // frozen (they live on this version's own copy of the chapters), but the
      // annex SETTINGS live on the budget and would otherwise keep changing
      // under an already-sent document. Snapshot them here so a reissued PDF is
      // laid out exactly as the one the customer received.
      v.annex = clone(b.annex || { enabled: true, imagesPerPage: 2 });
      v.sent = { date: when, time: sentTime || null, channel: ch }; // QUO-09 + MDM-04
      v.docRef = this._docName("presupuesto", b, v); // DOC-04
      /* Part 2 · item 14: validity is thirty days FROM ISSUE, as policy. The
         create-time default counted from the day drafting started, so a
         quote that took two weeks to write went out with sixteen days left
         on it. Stamped here, the printed date is always send + 30. The
         header-edit API keeps accepting validityDate, so the old behaviour
         is one hidden control away (HIDDEN_CONTROLS in the shell). */
      b.validityDate = addDays(when, this._configForRead().quoteValidityDays);
      b.status = "issued";
      const o = this.state.opportunities.find(
        (x) => x.partyId === b.partyId && !["won", "lost"].includes(x.status),
      );
      if (o) o.status = "awaitingResponse";
      this._log(user, "issueVersion", b.number + " v" + v.vNumber);
      return this.renderBudgetDoc(budgetId, v.id);
    }
    /**
     * What the job IS, in the customer's own words, for the top of the quote.
     *
     * Reported on 28/08: the document was headed by the site address and a
     * project code, so two quotes to the same customer for two different jobs
     * were told apart only by their number. What is missing is the sentence
     * they themselves said when they asked — "reforma integral del baño".
     *
     * Two sources, and nothing invented when both are silent. NOT taken from
     * the project: a project record carries a code and an activity line and
     * has never had a name field — `projectBlock` in erp-facts.js already
     * says so where it falls back to the activity line — so reading one here
     * would be inventing a field rather than reporting one.
     *
     *   1. the `requestedWork` of the opportunity behind it — reached through
     *      the visit, because the link runs visit.budgetId → visit
     *      .opportunityId and the budget carries no opportunity of its own;
     *   2. "" — and the caller keeps whatever it already prints.
     *
     * Returns a string, never null, so callers can `||` it.
     */
    budgetWorkName(budgetId) {
      const b = this.budget(budgetId);
      const vis = this.state.visits.find((v) => v.budgetId === b.id && v.opportunityId);
      const o = vis && this.state.opportunities.find((x) => x.id === vis.opportunityId);
      if (o && o.requestedWork) return o.requestedWork;
      /* No visit recorded — a quote written straight off a lead. The lead is
         still findable through the customer, and an OPEN one for this
         customer is the request this quote answers. Restricted to a single
         candidate: with two open leads there is no way to tell which, and
         printing the wrong job on a quote is worse than printing none. */
      const open = this.state.opportunities.filter(
        (x) => x.partyId === b.partyId && x.requestedWork && !["lost"].includes(x.status),
      );
      return open.length === 1 ? open[0].requestedWork : "";
    }
    renderBudgetDoc(budgetId, versionId) {
      // QUO-05/07 + QUO-10 + DOC-01: customer doc from data; no internal cost
      const b = this.budget(budgetId);
      const v = this.version(budgetId, versionId);
      const t = this.budgetTotals(budgetId, versionId);
      return {
        docType: "PRESUPUESTO",
        number: b.number,
        version: v.vNumber,
        date: v.date,
        issuer: this._issuerBlock(), // DOC-01
        customer: (({
          name,
          taxId,
          billStreet,
          billPostalCode,
          billCity,
          contactPerson,
          mobile,
          phone,
          email,
        }) => ({
          name,
          taxId,
          address: `${billStreet}, ${billPostalCode} ${billCity}`,
          /* Who to ask and how to reach them. Reported on 28/08: the quote
             named the company and nothing else, so the person handling it had
             to look the customer up in another screen to phone them back. The
             contact person is dropped when it merely repeats the customer's
             own name, which is what it holds for an individual — a line that
             says the same thing twice is noise on a document. */
          contactPerson: contactPerson && contactPerson !== name ? contactPerson : "",
          phone: mobile || phone || "",
          email: email || "",
        }))(this.party(b.partyId)),
        language: b.language,
        validityDate: b.validityDate,
        // Days, or null when nobody stated one. See createBudget.
        executionDays: b.executionDays == null ? null : b.executionDays,
        projectName: this.budgetWorkName(b.id),
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
              /* The price-book code and the link behind it. Not money and not
                 a cost — the code is already printed on any quote an estimator
                 would recognise, and it is what lets the document draw the
                 subpartida's own mark and let a reader check the two against each
                 other. `itemId` carries the trade, which is what colours it. */
              code: l.code || "",
              itemId: l.itemId || null,
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
    /**
     * @param evidenceRef  legacy free-text note naming the backing document.
     *                     Kept because records written before a file could be
     *                     attached carry one, and a typed filename is still
     *                     better than nothing when that is all there is.
     * @param evidence     the backing document itself —
     *                     { storageKey, name, type, size, uploadedAt }.
     * @param date         when the customer actually answered. Defaults to
     *                     today, and may be EARLIER: the answer usually
     *                     arrives before anyone sits down to record it. A
     *                     future date is refused — nothing can be accepted
     *                     tomorrow.
     * @param acceptedBy   who on the customer's side gave the answer, by name
     *                     or by role. Free text, because the customer's staff
     *                     are not users of this system.
     */
    /**
     * A VARIATION IS A REAL BUDGET — blocks 5 and 6 of the client review.
     *
     * "It should be possible to create budgets for Variations once a budget
     * has already been accepted for a project." Modelled as exactly that: a
     * new budget flagged `variationOf: projectId`, going through the SAME
     * draft → issue → accept cycle as any other — same builder, same catalogue
     * picker, same freezing, same PDF, same signature machinery. Nothing about
     * the accepted original moves: its three immutability guards stand, and
     * the project's reporting reads base PLUS accepted variations.
     *
     * `scheduleImpactDays` is what block 6 asks to happen automatically: on
     * acceptance, the project's completion date extends by the days the
     * variation adds — when the project HAS a completion date; extending a
     * date that was never set would be inventing one.
     */
    createVariationBudget(projectId, { reason, scheduleImpactDays } = {}, user) {
      const p = this.project(projectId);
      if (p.closed) throw new Error("A closed project cannot take a variation");
      const base = p.budgetId ? this.budget(p.budgetId) : null;
      const rec = this.createBudget(
        {
          partyId: p.partyId,
          propertyId: base ? base.propertyId : null,
          activityLine: p.activityLine || (base ? base.activityLine : "renovation"),
          vatBp: base ? base.vatBp : 1000,
          irpfBp: base ? base.irpfBp : 0,
          internalRef: reason || "",
        },
        user,
      );
      rec.variationOf = projectId;
      rec.scheduleImpactDays = Math.max(0, Math.round(scheduleImpactDays || 0));
      this._log(user, "createVariationBudget", p.code + " ← " + rec.number);
      return rec;
    }
    /** The project's ACCEPTED variations, oldest first. */
    projectVariations(projectId) {
      return this.state.budgets.filter((b) => b.variationOf === projectId && b.acceptedVersionId);
    }
    /**
     * Every accepted (budget, version) pair a project's figures come from:
     * the base budget first, then each accepted variation. The single walk
     * every chapter-addressed mechanism goes through, so a variation's
     * chapters are found by exactly the code that finds the base ones.
     */
    _projectVersions(p) {
      const out = [];
      if (p.budgetId && p.acceptedVersionId)
        out.push({ budgetId: p.budgetId, version: this.version(p.budgetId, p.acceptedVersionId) });
      for (const b of this.projectVariations(p.id))
        out.push({ budgetId: b.id, version: this.version(b.id, b.acceptedVersionId) });
      return out;
    }
    /** Accepted base-section chapters across base + variations, flattened. */
    projectChapters(projectId) {
      const p = this.project(projectId);
      const out = [];
      for (const { budgetId, version } of this._projectVersions(p))
        for (const c of version.chapters.filter((x) => x.section === "base"))
          out.push({ budgetId, versionId: version.id, chapter: c });
      return out;
    }
    acceptVersion(
      budgetId,
      versionId,
      { evidenceRef, evidence, date, acceptedBy, acceptedOptions } = {},
      user,
    ) {
      // QUO-04/09 + PRJ-01
      const b = this.budget(budgetId);
      const v = this.version(budgetId, versionId);
      if (!v.issued) throw new Error("Only an issued version can be accepted");
      if (b.acceptedVersionId) throw new Error("A version is already accepted");
      /* A variation joining its project must not collide with the chapter
         numbers already in use there — every cost allocation, every progress
         mark and every report addresses a chapter by (projectId, num). So its
         chapters are RENUMBERED to carry on from the project's highest, at the
         last moment before the freeze; after it, the numbers are history like
         everything else in the version. */
      if (b.variationOf) {
        const taken = this.projectChapters(b.variationOf).map((x) => Number(x.chapter.num) || 0);
        let next = (taken.length ? Math.max(...taken) : 0) + 1;
        for (const c of v.chapters) {
          c.num = String(next++);
          c.lines.forEach((l, i) => {
            if (!l.manualNum) l.num = c.num + "." + (i + 1);
          });
        }
      }
      // Symmetric with rejectVersion: one version, one answer. Without this a
      // refused version could be accepted afterwards, overwriting the refusal
      // and flipping the opportunity from lost back to won with no trace of
      // which answer the customer actually gave. A customer who changes their
      // mind gets a NEW version, which is what newVersion is for.
      if (v.customerResponse) throw new Error("This version already has the customer's answer");
      const when = date || this.state.today;
      if (when > this.state.today) throw new Error("The answer cannot be dated in the future");
      v.customerResponse = {
        accepted: true,
        date: when,
        evidenceRef: evidenceRef || null,
        evidence: evidence || null,
        acceptedBy: acceptedBy || null,
        acceptedOptions: acceptedOptions || [],
      };
      v.frozen = true;
      b.acceptedVersionId = v.id;
      b.status = "accepted";
      const o = this.state.opportunities.find(
        (x) => x.partyId === b.partyId && !["won", "lost"].includes(x.status),
      );
      if (o) {
        o.status = "won";
        // The day the customer answered, not the day somebody typed it in:
        // a backdated acceptance must land in the quarter it happened, or
        // DAS-01's "contratadas/perdidas últimos 12 meses" counts it twice
        // over — once where it belongs and never where it is.
        o.decidedAt = when; // DAS-01: "contratadas/perdidas últimos 12 meses"
      }
      /* An accepted adicional does BOTH things now, through the same two
         methods the change register uses. It used to extend the deadline and
         write no annex, while an approved change wrote the annex and left the
         deadline alone — so whichever route was taken, half the consequence
         was missing and the contract had to be drawn up by hand. */
      if (b.variationOf) {
        this.extendProjectDeadline(b.variationOf, b.scheduleImpactDays, b.number, user);
        b.scheduleAppliedDays = Math.max(0, Math.round(b.scheduleImpactDays || 0));
        this.writeContractAnnex(
          b.variationOf,
          { valueCents: this.budgetTotals(b.id, v.id).baseCents || 0, budgetId: b.id },
          user,
        );
      }
      this._log(user, "acceptVersion", b.number + " v" + v.vNumber);
      return v;
    }

    /**
     * The customer said no. The mirror of acceptVersion, and it exists because
     * without it a refused presupuesto is indistinguishable from one nobody has
     * answered yet — which is precisely the difference the v4 list is grouped
     * by (Enviados vs Rechazados), and precisely the difference between a lead
     * worth chasing and one that is over.
     *
     * `reason` is a loss-reason CODE from the owner-maintained list (DMC-04),
     * the same vocabulary loseOpportunity records, so refusals stay countable
     * across both paths. Anything the customer actually said goes in `notes`,
     * which is free text and stays on the version.
     */
    rejectVersion(budgetId, versionId, { reason, notes, evidenceRef } = {}, user) {
      const b = this.budget(budgetId);
      const v = this.version(budgetId, versionId);
      if (!v) throw new Error("Version not found");
      if (!v.issued) throw new Error("Only an issued version can be refused");
      if (b.acceptedVersionId) throw new Error("A version is already accepted");
      if (v.customerResponse) throw new Error("This version already has the customer's answer");
      v.customerResponse = {
        accepted: false,
        date: this.state.today,
        reason: reason || "",
        notes: notes || "",
        evidenceRef: evidenceRef || null,
      };
      v.frozen = true;
      b.status = "rejected";
      const o = this.state.opportunities.find(
        (x) => x.partyId === b.partyId && !["won", "lost"].includes(x.status),
      );
      if (o) {
        o.status = "lost";
        o.lossReason = reason || "";
        o.decidedAt = this.state.today;
      }
      this._log(user, "rejectVersion", b.number + " v" + v.vNumber);
      return v;
    }

    /**
     * The one status a person recognises, derived rather than stored.
     *
     * `budget.status` is a stored field that only ever moves forward when
     * something is DONE to the record. Expiry is not done to a record — it just
     * becomes true on a date — so a stored status can never be trusted to know
     * about it without a nightly job nobody has written. Deriving all five
     * keeps them consistent by construction: draft · issued · accepted ·
     * rejected · expired, which is exactly the grouping the v4 list uses.
     */
    budgetStage(budgetOrId) {
      const b = typeof budgetOrId === "string" ? this.budget(budgetOrId) : budgetOrId;
      if (b.acceptedVersionId) return "accepted";
      if (b.versions.some((v) => v.customerResponse && !v.customerResponse.accepted))
        return "rejected";
      if (!b.versions.some((v) => v.issued)) return "draft";
      if (b.validityDate && b.validityDate < this.state.today) return "expired";
      return "issued";
    }

    /* =========================== CON — contracts =========================== */
    /**
     * The parts of a contract record that do not depend on WHERE it came
     * from, so the budget-derived path and the externally-signed one cannot
     * drift apart in what a contract is.
     *
     * @param origin  "generated" — this system drew it up from an accepted
     *                budget, and `renderContractDoc` IS the contract.
     *                "external" — it was signed elsewhere and is being
     *                recorded; the uploaded file is the contract and the
     *                structured data is our index of it.
     */
    _contractRecord({ origin, partyId, propertyId, valueCents, vatBp, language, date }) {
      // The company's own defaults, not literals in two places — see blankConfig.
      const cfg = this._configForRead();
      const vatCents = pctOf(valueCents, vatBp);
      return {
        id: this._id("con"),
        number: this.nextNumber("contract"),
        date: date || this.state.today,
        origin,
        partyId,
        propertyId: propertyId || null,
        budgetId: null,
        budgetNumber: null,
        acceptedVersionId: null,
        // The signed file itself, for an external contract. PK2-A's evidence
        // shape: { storageKey, name, type, size, uploadedAt }.
        document: null,
        valueCents,
        vatBp,
        vatCents,
        totalCents: valueCents + vatCents, // CON-03 structured
        installments: [], // CON-04 {pct|amountCents, trigger, stageRef, expectedDate, invoicedInvoiceId, status}
        initiation: {
          scheduleWithinDays: cfg.scheduleWithinDays,
          startWithinDays: cfg.startWithinDays,
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
          latePaymentInterestPctYear: cfg.latePaymentInterestPctYear,
          delayPenaltyCentsPerWeek: 0,
          capCents: 0,
          graceDays: cfg.graceDays,
          suspendingEvents: ["customer delay", "force majeure", "approved change"],
        }, // CON-07
        guarantees: [], // CON-08 {category, months, startDate, expiryDate}
        clauseBlockVersions: this.state.clauseBlocks
          .filter((cb) => cb.effectiveFrom <= this.state.today)
          .map((cb) => cb.id), // CON-09
        language: language || cfg.defaultLanguage, // CON-10
        signature: { customerSignedAt: null, companySignedAt: null, method: null, document: null }, // CON-11
        status: "draft",
        annexes: [],
        scopeAnnexRef: null,
      };
    }
    /**
     * Normalise and validate the terms both contract paths accept, then file
     * the record. Shared so a milestone entered by hand and one written by
     * the seed are checked identically.
     */
    /**
     * Everything that can refuse a contract, checked BEFORE a number is
     * minted.
     *
     * `nextNumber` is a side effect: it appends to `series.contract.issued`
     * and advances the counter whether or not the record it was minted for
     * survives. Validating afterwards therefore left a permanent hole in a
     * series ORG-04 requires to be gap-free — type a contract, forget the
     * duration, and CTR-YYYY-nnnn was gone for good. Both paths call this
     * first, and `_finishContract` keeps the same assertion as a backstop.
     */
    _validateContractTerms(terms) {
      const d = (terms || {}).duration || {};
      if (!d.estimatedDays) throw new Error("Execution duration is mandatory (CON-06)");
      /* The terms object is merged wholesale, which is deliberate — it is what
         lets a drawer pass `externalRef` with no whitelist to keep in step. The
         cost is that the same door reaches fields the ENGINE owns, and two of
         them matter: `number` is minted from a series ORG-04 requires to be
         gap-free, and `origin` decides whether the screen renders our document
         or the customer's signed file. Refused by name rather than by
         whitelisting everything else, so the open door stays open. */
      for (const owned of ["number", "origin", "id"])
        if (terms && Object.prototype.hasOwnProperty.call(terms, owned))
          throw new Error("A contract's " + owned + " is the engine's, not a term");
      /* The trigger list was declared in `config` and read by nothing, so any
         string at all was accepted and the contract printed it raw at the
         customer. Checked HERE rather than in `_finishContract` for the reason
         the duration is: this runs before `nextNumber`, and a refusal after it
         leaves a permanent hole in a series ORG-04 requires to be gap-free. */
      for (const i of (terms || {}).installments || []) {
        if (!i.trigger) continue; // a milestone with no trigger is a date-only one
        if (!LISTS.installmentTriggers.includes(i.trigger))
          throw new Error("Unknown payment milestone trigger: " + i.trigger + " (CON-04)");
        if (i.trigger !== "atProgressPct") continue;
        if (!LISTS.progressTriggerSteps.includes(i.progressPct))
          throw new Error(
            "A progress milestone needs one of " +
              LISTS.progressTriggerSteps.join(", ") +
              " per cent (CON-04)",
          );
      }
    }
    /**
     * Point a contract at the obra it governs — the repair for «Obra —».
     *
     * The link lives on the PROJECT (`project.contractId`), and `createContract`
     * writes it only when the project has none, never overwriting. That is the
     * right default and it has one hole: a SECOND contract drawn up on the same
     * budget can never claim the job, so its own screen shows no obra and
     * nothing in the interface could say otherwise. Everything downstream reads
     * this link — the signature gates, the annex chain, the expected
     * collections, the control tower's contracted amount — so a contract
     * without it is a contract outside all of them.
     *
     * Moving, not copying: a project has ONE contract, so linking here clears
     * whatever pointed at it before. The caller is telling us which contract
     * governs the job, and two answers to that question is the state this
     * method exists to leave behind.
     */
    /**
     * WHICH CONTRACT A BUDGET'S JOB BELONGS TO — asked in one place, because
     * three places used to answer it and two of them answered "the first one".
     *
     * `contracts.find(c => c.budgetId === id)` returns whatever was pushed
     * first, which on a live workspace is the oldest draft. The operator drew
     * up three contracts on one accepted quote, signed the third, and the job
     * had been pointing at the first since the day it was created — so CON-11
     * refused the first invoice on the strength of a draft nobody had signed,
     * while a signed contract for the same work sat two rows above it on the
     * same screen.
     *
     * The order below is the order a person would read it in: a signature
     * settles the question, and among signatures the most recent one does; if
     * nothing is signed, the newest live draft; and a cancelled contract is
     * never the answer, which `cancelContract` already says in its own way by
     * releasing the job.
     */
    _bestContractForBudget(budgetId, { exclude } = {}) {
      if (!budgetId) return null;
      const live = this.state.contracts.filter(
        (c) => c.budgetId === budgetId && c.status !== "cancelled" && c.id !== exclude,
      );
      if (!live.length) return null;
      // Date first, then the number, which breaks a same-day tie the way the
      // series itself orders them.
      const key = (c) => String(c.date || "") + "\u0000" + String(c.number || "");
      const newest = (list) =>
        list.reduce((best, c) => (best === null || key(c) > key(best) ? c : best), null);
      const signed = live.filter((c) => c.signature && c.signature.customerSignedAt);
      return signed.length ? newest(signed) : newest(live);
    }

    /** Has this contract already been invoiced through one of its milestones? */
    _contractHasInvoicedInstallment(contract) {
      return (contract.installments || []).some((i) => !!i.invoicedInvoiceId);
    }

    linkContractToProject(contractId, projectId, user) {
      const c = this.state.contracts.find((x) => x.id === contractId);
      if (!c) throw new Error("Contract not found");
      const p = this.state.projects.find((x) => x.id === projectId);
      if (!p) throw new Error("Project not found");
      if (p.contractId === contractId) return p;
      this.state.projects.forEach((x) => {
        if (x.contractId === contractId) x.contractId = null;
      });
      p.contractId = contractId;
      this._log(user, "linkContractToProject", c.number + " → " + p.code);
      return p;
    }
    _finishContract(rec, user, logAs) {
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
      /* The reverse link. `createProjectFromAcceptance` looks a contract up
         by budgetId — but the REAL order of work is the other way round: the
         acceptance creates the job immediately and the contract is drawn up
         afterwards, so on a live workspace every `project.contractId` stayed
         null forever. (The demo seeder happens to create contracts first,
         which is exactly why months of demo use never showed it.) Everything
         downstream reads this link: the CON-11 signature gates, CON-12's
         annex chain on an approved variation, the expected-collections
         recalculation, the control tower's contracted amount. Written here,
         in the one place both contract paths finish, so neither order of
         work can leave the job unlinked. Never overwrites: a project already
         linked to another contract keeps it. */
      const linkTo =
        rec.projectId ||
        (rec.budgetId
          ? (this.state.projects.find((p) => p.budgetId === rec.budgetId) || {}).id
          : null);
      if (linkTo) {
        const prj = this.state.projects.find((p) => p.id === linkTo);
        if (prj && !prj.contractId) prj.contractId = rec.id;
      }
      delete rec.projectId; // a linking hint, not a field of the contract
      this._log(user, logAs, rec.number);
      return rec;
    }
    /**
     * Record a contract that was signed OUTSIDE this system — on paper, by a
     * lawyer, or before this ERP existed (Package 2 slide 4).
     *
     * Deliberately not `createContract` with a null budget. CON-02's rule
     * ("a contract requires an accepted budget version") is real and stays
     * enforced for contracts this system DRAWS UP; what this method records
     * is a different kind of fact — one that already happened elsewhere —
     * and marking it `origin:"external"` is what lets the screen show the
     * signed file as the contract instead of printing a generated document
     * that nobody ever signed.
     *
     * Completeness is still required (decision 21 / RD 1619/2012): a contract
     * is one of the two documents that block on an incomplete tercero, and
     * recording one from paper does not change what the law needs before it
     * can be invoiced. The screen offers the missing fields inline rather
     * than sending the operator away.
     */
    registerExternalContract(data, user) {
      const d = data || {};
      if (!d.partyId) throw new Error("A contract needs a customer");
      if (!(d.valueCents > 0)) throw new Error("A contract needs an amount");
      if (d.date && d.date > this.state.today)
        throw new Error("A contract cannot be dated in the future");
      this._requireComplete(d.partyId, "contract"); // 7.5 parties control
      this._validateContractTerms(d); // before nextNumber — see the note there
      const rec = Object.assign(
        this._contractRecord({
          origin: "external",
          partyId: d.partyId,
          propertyId: d.propertyId,
          valueCents: d.valueCents,
          // Same default a new budget takes, so a hand-entered contract and a
          // quoted one start from the same rate rather than two different ones.
          vatBp: d.vatBp != null ? d.vatBp : this._configForRead().defaultVatBp,
          language: d.language,
          date: d.date,
        }),
        // Only the parts a person types; id/number/origin/totals stay ours.
        {
          // An external contract names no budget, so the job it belongs to
          // cannot be inferred — the operator says which, or none.
          projectId: d.projectId || null,
          installments: d.installments || [],
          duration: Object.assign({ estimatedDays: null }, d.duration || {}),
          guarantees: d.guarantees || [],
          document: d.document || null,
          externalRef: d.externalRef || null,
        },
      );
      return this._finishContract(rec, user, "registerExternalContract");
    }
    createContract(budgetId, terms, user) {
      // CON-01..14
      const cfg = this._configForRead(); // the company's defaults, not literals
      const b = this.budget(budgetId);
      if (!b.acceptedVersionId) throw new Error("Contract requires an accepted budget version"); // CON-02
      this._requireComplete(b.partyId, "contract"); // 7.5 parties control
      this._validateContractTerms(terms); // before nextNumber — see the note there
      const t = this.budgetTotals(budgetId, b.acceptedVersionId);
      const rec = Object.assign(
        {
          id: this._id("con"),
          number: this.nextNumber("contract"),
          date: this.state.today,
          origin: "generated",
          document: null,
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
            scheduleWithinDays: cfg.scheduleWithinDays,
            startWithinDays: cfg.startWithinDays,
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
            latePaymentInterestPctYear: cfg.latePaymentInterestPctYear,
            delayPenaltyCentsPerWeek: 0,
            capCents: 0,
            graceDays: cfg.graceDays,
            suspendingEvents: ["customer delay", "force majeure", "approved change"],
          }, // CON-07
          guarantees: [], // CON-08 {category, months, startDate, expiryDate}
          clauseBlockVersions: this.state.clauseBlocks
            .filter((cb) => cb.effectiveFrom <= this.state.today)
            .map((cb) => cb.id), // CON-09
          language: b.language, // CON-10
          signature: {
            customerSignedAt: null,
            companySignedAt: null,
            method: null,
            document: null,
          }, // CON-11
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
      return this._finishContract(rec, user, "createContract");
    }
    /**
     * @param date      when it was actually signed. Defaults to today and may
     *                  be EARLIER — a contract registered from paper was
     *                  signed before anybody typed it in. A future date is
     *                  refused, the same rule acceptVersion and issueVersion
     *                  already apply.
     * @param evidence  the signed copy itself — {storageKey,name,type,size}
     *                  for a file held here, or {ref} for one that is named
     *                  but kept elsewhere, the same distinction `evidenceRef`
     *                  draws on an accepted budget version.
     *
     *                  Required either way, and it is the whole point of the
     *                  signature: a contract that claims to be signed with no
     *                  signed document behind it is an assertion, not a fact,
     *                  and CON-11 opens the job's first invoice on the
     *                  strength of it. A contract recorded from outside
     *                  already carries that file as `document`, so it answers
     *                  this on its own rather than being asked for the same
     *                  PDF twice.
     */
    signContract(id, { method, date, evidence } = {}, user) {
      // CON-11
      const c = this.state.contracts.find((x) => x.id === id);
      const when = date || this.state.today;
      if (when > this.state.today) throw new Error("A signature cannot be dated in the future");
      const signed = evidence || c.document || null;
      if (!signed || !(signed.storageKey || signed.ref || signed.name))
        throw new Error("A signature needs the signed document (CON-11)");
      c.signature = {
        customerSignedAt: when,
        companySignedAt: when,
        method: method || "physical",
        document: signed,
      };
      c.status = "signed";
      c.guarantees.forEach((g) => {
        g.startDate = null;
      }); // set at completion
      /* THE SIGNATURE CLAIMS THE JOB, because that is what the operator means
         by signing it. `createContract` writes the reverse link only for a job
         that has none — right as a default, and it leaves the second contract
         on a budget unable to claim its job for good. So the moment that
         should obviously settle the question did nothing at all: they signed
         the real contract and CON-11 went on refusing the first invoice on the
         strength of the draft still holding the link.
         Two refusals, both about not overwriting a fact with a default:
         a job held by another SIGNED contract is left alone — two signatures
         on one budget is a question for a person, and «Vincular obra» is where
         they answer it; and a job whose contract has already been INVOICED
         through one of its milestones is left alone too, because those
         invoices point at that contract's installments and re-pointing the job
         would leave the money describing a document it no longer belongs to. */
      const holder = this.state.projects.find((p) => p.budgetId === c.budgetId && c.budgetId);
      if (holder && holder.contractId !== c.id) {
        const current = holder.contractId
          ? this.state.contracts.find((x) => x.id === holder.contractId)
          : null;
        const heldBySigned = !!(current && current.signature && current.signature.customerSignedAt);
        const heldByInvoiced = !!(current && this._contractHasInvoicedInstallment(current));
        if (!heldBySigned && !heldByInvoiced) {
          holder.contractId = c.id;
          this._log(user, "signContract:claimObra", c.number + " → " + holder.code);
        }
      }
      this._log(user, "signContract", c.number);
      return c;
    }
    /**
     * N1 · the language a contract prints in, changeable while it is still
     * paper in motion. A SIGNED contract is a fact: the customer signed the
     * words they were shown, and re-printing them in another language would
     * be a document nobody agreed to — same reasoning as invoice immutability.
     */
    setContractLanguage(id, language, user) {
      const c = this.state.contracts.find((x) => x.id === id);
      if (!c) throw new Error("Contract not found");
      if (!["es", "ca", "en"].includes(language)) throw new Error("Unknown language: " + language);
      if (c.signature && c.signature.customerSignedAt)
        throw new Error("El contrato firmado conserva su idioma (CON-10)");
      c.language = language;
      this._log(user, "setContractLanguage", c.number + " " + language);
      return c;
    }
    /** N1 · same rule for a change order: free until approved, frozen after —
     *  an approved annex is part of the signed chain. */
    setChangeLanguage(id, language, user) {
      const c = this.state.changes.find((x) => x.id === id);
      if (!c) throw new Error("Change not found");
      if (!["es", "ca", "en"].includes(language)) throw new Error("Unknown language: " + language);
      if (c.approvedAt) throw new Error("La adenda aprobada conserva su idioma");
      c.language = language;
      this._log(user, "setChangeLanguage", (c.annexNumber || c.id) + " " + language);
      return c;
    }
    /**
     * Move the expected dates of a contract's payment milestones — item 14 of
     * the money chain, which the v4 document asks about and which did not
     * exist.
     *
     * `cashForecast` has always read `installment.expectedDate`, and nothing
     * has ever written it after the contract was drawn up. So a job whose
     * plan slipped three weeks kept forecasting the same money in the same
     * week, and the forecast was wrong in the one direction that matters —
     * optimistic — with nothing on screen admitting it.
     *
     * What moves and what does not is the whole rule:
     *
     *   - only `planned` installments. An invoiced one is history, and history
     *     does not move because a plan did.
     *   - never a `fixedDate` trigger. That is what the name means, and a
     *     date the customer agreed to in writing is not the planner's to
     *     revise.
     *   - the reason is stored beside the date. A figure in a cash forecast
     *     that changed on its own, with nothing saying what moved it, is
     *     worse than the stale figure it replaced.
     *
     * The DATES are computed by the caller, because deriving them means
     * reading a schedule and this class knows nothing about scheduling. This
     * method owns the rule about which of them may be applied.
     */
    setInstallmentDates(contractId, byIdx, user, reason) {
      const c = this.state.contracts.find((x) => x.id === contractId);
      if (!c) throw new Error("Contract not found");
      const moved = [];
      c.installments.forEach((i, idx) => {
        const next = byIdx[idx];
        if (!next) return;
        if (i.status !== "planned") return;
        if (i.trigger === "fixedDate") return;
        if (i.expectedDate === next) return;
        moved.push({ idx, from: i.expectedDate || null, to: next, trigger: i.trigger });
        i.expectedDate = next;
        i.expectedDateSource = reason || "schedule";
        i.expectedDateSetAt = this.state.today;
      });
      if (moved.length) this._log(user, "setInstallmentDates", c.number + " ×" + moved.length);
      return { contractId, moved };
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
    /**
     * The contract's ORIGINAL value and what it is worth today — COM-04's two
     * money columns, and the reason the second one goes amber when it differs.
     *
     * Both are the taxable base, not the gross: an annex records a net price
     * (`change.priceCents`), so adding it to a VAT-inclusive figure would
     * produce a number that is neither one thing nor the other. A difference
     * between the two means annexes exist, which is exactly what the screen
     * is trying to say without making anybody open the contract to find out.
     */
    contractValue(contractId) {
      const c = this.state.contracts.find((x) => x.id === contractId);
      if (!c) throw new Error("Contract not found");
      const annexCents = sum(c.annexes || [], (a) => a.valueCents);
      const currentCents = c.valueCents + annexCents;
      return {
        originalCents: c.valueCents,
        annexCents,
        currentCents,
        /* B1 · the milestones are priced on the GROSS (createContract splits
           rec.totalCents), so any screen summing them must compare against
           a gross too — comparing against the base made every contract with
           tax look overrun by exactly the tax. Two grosses, for two uses:
           the ORIGINAL gross is what the milestones split (annexes bill
           separately, through their own invoices); the vigente gross is what
           the printed document quotes as the contract total today. */
        vatBp: c.vatBp,
        originalTotalCents: c.totalCents,
        totalCents: currentCents + pctOf(currentCents, c.vatBp || 0),
        annexes: (c.annexes || []).length,
        differs: annexCents !== 0,
      };
    }
    /**
     * Contracts as COM-04 lists them, split the way its two tabs split them.
     *
     * "Active" is about whether the contract still governs work, not about
     * whether it is signed: a draft is active because somebody is still
     * working on it, and a cancelled one is not, whatever its signature says.
     */
    contractsView() {
      return this.state.contracts.map((c) => {
        const v = this.contractValue(c.id);
        const project = this.state.projects.find((p) => p.contractId === c.id) || null;
        return {
          id: c.id,
          number: c.number,
          party: this.party(c.partyId).name,
          projectCode: project ? project.code : null,
          date: c.date,
          originalCents: v.originalCents,
          currentCents: v.currentCents,
          differs: v.differs,
          annexes: v.annexes,
          installments: c.installments.length,
          signed: !!c.signature.customerSignedAt,
          status: c.status,
          active: !["completed", "cancelled"].includes(c.status),
          origin: c.origin || "generated",
        };
      });
    }
    /**
     * The customer's contract document, from data.
     *
     * There is no uploaded PDF anywhere in this system and there does not need
     * to be: CON-03 made the terms structured on purpose, so the document is
     * rendered the same way the presupuesto is (QUO-05/DOC-01) rather than
     * requiring somebody to attach a scan of what the database already knows.
     * A signed scan, when there is one, is a captured document and belongs
     * beside this rather than instead of it.
     */
    renderContractDoc(contractId) {
      const c = this.state.contracts.find((x) => x.id === contractId);
      if (!c) throw new Error("Contract not found");
      const project = this.state.projects.find((p) => p.contractId === c.id) || null;
      const v = this.contractValue(c.id);
      return {
        docType: "CONTRATO",
        number: c.number,
        date: c.date,
        language: c.language,
        issuer: this._issuerBlock(),
        customer: (({ name, taxId, billStreet, billPostalCode, billCity }) => ({
          name,
          taxId,
          address: `${billStreet}, ${billPostalCode} ${billCity}`,
        }))(this.party(c.partyId)),
        projectCode: project ? project.code : null,
        budgetNumber: c.budgetNumber,
        originalCents: v.originalCents,
        currentCents: v.currentCents,
        totalCents: v.totalCents, // B1 · gross of the vigente amount
        originalTotalCents: v.originalTotalCents, // B1 · what the milestones split
        vatBp: c.vatBp,
        installments: c.installments.map((i, idx) => ({
          idx,
          trigger: i.trigger,
          pct: i.pct != null ? i.pct : null,
          amountCents: i.amountCents,
          expectedDate: i.expectedDate || null,
          // S8 made this date movable; the document has to say who moved it,
          // or the honesty that session bought is lost one screen along.
          expectedDateSource: i.expectedDateSource || null,
          status: i.status,
          // `invoiceId` is the pre-PK6-A spelling: milestones invoiced before
          // that fix stored the link under it, and they still resolve here
          // rather than needing a migration to say what they already knew.
          invoiceId: i.invoicedInvoiceId || i.invoiceId || null,
        })),
        initiation: clone(c.initiation),
        duration: clone(c.duration),
        penalties: clone(c.penalties),
        guarantees: clone(c.guarantees),
        annexes: clone(c.annexes || []),
        signature: clone(c.signature),
        status: c.status,
        // Where this contract came from, and the signed file when it came
        // from outside. A screen showing an externally-signed contract must
        // show THAT file rather than the document rendered below it, which
        // nobody ever signed — see registerExternalContract.
        origin: c.origin || "generated",
        document: c.document ? clone(c.document) : null,
        externalRef: c.externalRef || null,
      };
    }

    /* =========================== PRJ — projects =========================== */
    createProjectFromAcceptance(budgetId, user) {
      {
        const b0 = this.budget(budgetId);
        if (b0.variationOf)
          throw new Error("A variation joins its project — it does not open a new one");
      }
      // PRJ-01..04: no re-entry, frozen baseline
      const b = this.budget(budgetId);
      if (!b.acceptedVersionId) throw new Error("Acceptance required before project creation");
      const t = this.budgetTotals(budgetId, b.acceptedVersionId);
      const contract = this._bestContractForBudget(budgetId);
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
              // WHO OWES FOR THIS CHAPTER. In the baseline, and therefore
              // frozen with everything else in it: moving a chapter from one
              // payer to another after work has started changes what each of
              // them was told they were buying, which is a change order and not
              // an edit — exactly the rule the baseline already enforces for
              // money. Defaults to the project's own customer, so a job with
              // one payer reads as it always has.
              billToPartyId: b.partyId,
            })),
        }),
        billing: defaultBilling(b.partyId, b.vatBp),
        vatBp: b.vatBp,
        surfaceM2: b.surfaceM2,
        dates: { start: null, targetEnd: null, actualEnd: null },
        milestones: [],
        diary: [], // PLN-05
        permits: [],
        dependencies: [],
        closed: false,
        priority: false, // DAS-01 "marcar un proyecto como prioritario"
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
          chapters: [
            {
              num: "1",
              name: desc,
              saleCents: valueCents,
              costCents: 0,
              billToPartyId: partyId,
            },
          ],
        }),
        billing: defaultBilling(partyId, 2100),
        vatBp: 2100,
        surfaceM2: 0,
        dates: { start: this.state.today, targetEnd: null, actualEnd: null },
        milestones: [],
        diary: [],
        permits: [],
        dependencies: [],
        closed: false,
        priority: false, // DAS-01 "marcar un proyecto como prioritario"
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
    setProjectPriority(id, flag, user) {
      // DAS-01 "marcar un proyecto como prioritario" — a pin, not a status.
      const p = this.project(id);
      p.priority = !!flag;
      this._log(user, "setProjectPriority", p.code);
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
      const chapterLists = this._projectVersions(p).flatMap((x) => x.version.chapters);
      for (const c of chapterLists) {
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
      return this._projectVersions(p)
        .flatMap((x) => x.version.chapters)
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
      let done = 0,
        total = 0;
      const chs = this._projectVersions(p).flatMap((x) => x.version.chapters);
      for (const c of chs.filter((x) => x.section === "base"))
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
          language: "", // N1 · resolved at render through the same chain
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
    /**
     * @param evidenceRef  legacy free-text note. Kept for records written
     *                     before a file could be attached.
     * @param evidence     the real backing document —
     *                     { storageKey, name, type, size, uploadedAt } —
     *                     Package 2 slide 8's "respaldo" for the anexo this
     *                     approval generates.
     */
    approveChange(changeId, opts, user) {
      // The options object is NOT defaulted in the signature, deliberately: a
      // parameter with a default stops counting towards `Function.length`,
      // and `apps/web/lib/erp-commands.ts` pins each whitelisted method's
      // arity against exactly that — the server reads positional arguments
      // off a request body, so the count is part of the wire contract, not a
      // style choice. Defaulting it here silently changed approveChange's
      // declared arity from 3 to 1.
      const { evidenceRef, evidence } = opts || {};
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
      c.evidence = evidence || null;
      const annex = this.writeContractAnnex(
        c.projectId,
        { valueCents: c.priceCents, changeId: c.id },
        user,
      );
      if (annex) c.annexNumber = annex.number;
      /* …and the days it recorded finally reach the job. `priceChange` has
         taken `scheduleImpactDays` since CHG-02 and the screen has asked for
         it just as long; approving the change moved the Gantt bars and left
         the project's completion date exactly where it was. Measured on the
         seeded job: +7 days approved, target end unchanged. */
      this.extendProjectDeadline(c.projectId, c.scheduleImpactDays, c.annexNumber || c.desc, user);
      this._log(user, "approveChange", changeId);
      return c;
    }
    /**
     * Push a project's completion date out, once, from one place.
     *
     * Both kinds of adicional record days and only one of them ever applied
     * them: an accepted variation budget extended the date, an approved change
     * did not, and neither knew the other existed. Same rule, two callers, one
     * implementation — so the answer to "does an extra move the end date?"
     * cannot depend on which screen it was entered from.
     *
     * Silent when the project has no completion date: extending a date that
     * was never set would be inventing one.
     */
    extendProjectDeadline(projectId, days, ref, user) {
      const n = Math.round(days || 0);
      if (n <= 0) return null;
      const pj = this.state.projects.find((x) => x.id === projectId);
      if (!pj || !pj.dates || !pj.dates.targetEnd) return null;
      pj.dates.targetEnd = addDays(pj.dates.targetEnd, n);
      this._log(
        user,
        "variationExtendsDeadline",
        pj.code + " +" + n + "d → " + pj.dates.targetEnd + (ref ? " · " + ref : ""),
      );
      return pj.dates.targetEnd;
    }
    /**
     * The CON-12 annex chain, from one place too.
     *
     * `approveChange` built this inline, so an accepted variation budget — the
     * other way of agreeing an extra — produced no annex at all and the
     * contract had to be drawn up by hand outside the product. The operator
     * described exactly that: "you can upload the contract like any other
     * contract". Nothing needs uploading if the chain writes itself.
     *
     * Returns null rather than throwing when the project has no contract: an
     * extra agreed before the contract exists is ordinary, and refusing it
     * would block the work for a document that is still being drafted.
     */
    writeContractAnnex(projectId, { valueCents, changeId, budgetId }, user) {
      const p = this.state.projects.find((x) => x.id === projectId);
      if (!p || !p.contractId) return null;
      const con = this.state.contracts.find((x) => x.id === p.contractId);
      if (!con) return null;
      con.annexes = con.annexes || [];
      // Never twice for the same source — acceptance can be re-run.
      const already = con.annexes.find(
        (a) => (changeId && a.changeId === changeId) || (budgetId && a.budgetId === budgetId),
      );
      if (already) return already;
      const rec = {
        number: con.number + "-A" + (con.annexes.length + 1),
        changeId: changeId || null,
        budgetId: budgetId || null,
        valueCents: valueCents || 0,
        date: this.state.today,
      };
      con.annexes.push(rec);
      /* THE MONEY GETS A COLLECTION DATE, appended as its own milestone.
         The operator chose this over redistributing across the unbilled ones,
         and it is what `contractValue` already assumed: "annexes bill
         separately, through their own invoices". Appending leaves every
         existing milestone's cents exactly as the customer was shown them —
         redistribution would silently re-price figures already agreed, and
         some of them are already invoiced and cannot move at all.

         Gross, because milestones are priced on the gross (`_finishContract`
         splits `rec.totalCents`) while an annex value is a base. Adding a base
         to a list of grosses would understate every adicional by its tax. */
      const grossCents = (rec.valueCents || 0) + pctOf(rec.valueCents || 0, con.vatBp || 0);
      con.installments = con.installments || [];
      con.installments.push({
        idx: con.installments.length,
        annexNumber: rec.number,
        amountCents: grossCents,
        trigger: "onAnnex",
        expectedDate: this.state.today,
        status: "planned",
      });
      this._log(user, "writeContractAnnex", rec.number + " · " + grossCents + "c");
      return rec;
    }
    /**
     * Set (or change) the days an adicional adds, applying only the DIFFERENCE.
     *
     * The days are asked for twice on purpose — once when the adicional is
     * created, once when it joins the contract, which is where the operator
     * expects to state a term. Two doors onto one number means the second must
     * not add the whole figure again, so what is applied is the delta against
     * what this budget has already moved, and the budget remembers it.
     */
    setVariationScheduleDays(budgetId, days, user) {
      const b = this.budget(budgetId);
      if (!b.variationOf) throw new Error("Only an adicional carries days of its own");
      const want = Math.max(0, Math.round(days || 0));
      const applied = Math.max(0, Math.round(b.scheduleAppliedDays || 0));
      b.scheduleImpactDays = want;
      const delta = want - applied;
      if (delta !== 0 && b.acceptedVersionId) {
        /* Only once accepted. Before that the adicional is a proposal, and a
           proposal must not move a date the customer has not agreed to. */
        this.extendProjectDeadline(b.variationOf, delta, b.number, user);
        b.scheduleAppliedDays = want;
      }
      return b;
    }
    /**
     * The extras of one obra — or, with no argument, of every obra.
     *
     * PRY-03 is a register now rather than a per-project panel, so the figure
     * it shows is about the whole workspace. That total belongs here for the
     * same reason the per-project one does: a sum added up in the view is a
     * business rule living in neither a capability nor a pack, and a second
     * implementation of "what counts as unapproved" is the one that drifts
     * from CHG-04. One method, one definition, two scopes.
     */
    extrasRegister(projectId) {
      // CHG-05/07
      const list =
        projectId == null
          ? this.state.changes.slice()
          : this.state.changes.filter((c) => c.projectId === projectId);
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
    /**
     * The five PRY-03 counts by — identificado · valorado · aprobado ·
     * ejecutado · facturado — each with a count AND an amount.
     *
     * Derived from `status`, like every other stage reading in this engine,
     * and mapped rather than renamed: the doc's five and the record's eight
     * are different vocabularies for the same lifecycle. `sent` folds into
     * **valorado** because from the site's point of view a priced extra and
     * one already with the customer are the same thing — priced, not yet
     * agreed — and the difference is visible in the row's own status pill.
     *
     * `rejected` and `cancelled` are in none of the five, for the reason a
     * cancelled purchase order is in none of ADM-02's three: a counter that
     * includes work nobody will do has to be explained every time it is read.
     */
    changeStageSummary(projectId) {
      const STAGE = {
        identified: "identified",
        priced: "priced",
        sent: "priced",
        approved: "approved",
        executed: "executed",
        invoiced: "invoiced",
      };
      const out = {
        identified: { count: 0, amountCents: 0 },
        priced: { count: 0, amountCents: 0 },
        approved: { count: 0, amountCents: 0 },
        executed: { count: 0, amountCents: 0 },
        invoiced: { count: 0, amountCents: 0 },
      };
      this.state.changes
        .filter((c) => c.projectId === projectId)
        .forEach((c) => {
          const stage = STAGE[c.status];
          if (!stage) return; // rejected · cancelled
          out[stage].count += 1;
          out[stage].amountCents += c.priceCents || 0;
        });
      return out;
    }
    /** Which of the five a single extra is in — "" for rejected/cancelled. */
    changeStage(change) {
      return (
        {
          identified: "identified",
          priced: "priced",
          sent: "priced",
          approved: "approved",
          executed: "executed",
          invoiced: "invoiced",
        }[change.status] || ""
      );
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
    /**
     * The three the v4 screen counts by: oferta · pedido · facturado.
     *
     * Derived from `purchaseStatus`, not stored beside it. The seven-state
     * lifecycle above is what the record actually knows and it stays — this
     * is the coarser reading ADM-02 is built around, and two stored fields
     * that must agree about the same order is precisely how they stop
     * agreeing. A cancelled order is deliberately in none of the three: it is
     * shown in the list and counted nowhere, because a counter that includes
     * work nobody will do is a counter that has to be explained.
     */
    purchaseStage(pu) {
      const st = this.purchaseStatus(pu);
      if (st === "cancelled") return "cancelled";
      if (st === "invoiced" || st === "paid") return "invoiced";
      if (st === "draft") return "offer";
      return "order";
    }
    /** Count and committed amount per stage — the three counters of ADM-02. */
    purchaseStageSummary(projectId) {
      const out = {
        offer: { count: 0, amountCents: 0 },
        order: { count: 0, amountCents: 0 },
        invoiced: { count: 0, amountCents: 0 },
      };
      this.state.purchases
        .filter((p) => !projectId || p.projectId === projectId)
        .forEach((p) => {
          const stage = this.purchaseStage(p);
          if (!out[stage]) return; // cancelled
          out[stage].count += 1;
          out[stage].amountCents += p.totalCents - (p.status.returnedCents || 0);
        });
      return out;
    }
    /**
     * Put the supplier's own paperwork beside the order — the left zone of
     * ADM-02's detail. The document is a captured one, so the picture, the
     * reading and the provenance all come with it rather than being uploaded
     * a second time under a different name.
     */
    attachPurchaseDocument(purchaseId, capId, user) {
      const pu = this.state.purchases.find((x) => x.id === purchaseId);
      if (!pu) throw new Error("Purchase not found");
      const c = this.state.captured.find((x) => x.id === capId);
      if (!c) throw new Error("Captured document not found: " + capId);
      pu.docRefs = pu.docRefs || [];
      if (!pu.docRefs.includes(capId)) pu.docRefs.push(capId);
      this._log(user, "attachPurchaseDocument", pu.number + " " + capId);
      return pu;
    }
    detachPurchaseDocument(purchaseId, capId, user) {
      const pu = this.state.purchases.find((x) => x.id === purchaseId);
      if (!pu) throw new Error("Purchase not found");
      pu.docRefs = (pu.docRefs || []).filter((x) => x !== capId);
      this._log(user, "detachPurchaseDocument", pu.number + " " + capId);
      return pu;
    }
    /**
     * Base, tax and total for one order, as the foot of the record pane
     * states them. The order stores a net unit price, so the tax is computed
     * rather than read — a stored tax amount that disagrees with the rate is
     * one more thing that can be wrong on a document somebody pays from.
     */
    purchaseTotals(pu) {
      const baseCents = pu.totalCents - (pu.status.returnedCents || 0);
      const vatCents = pctOf(baseCents, pu.vatBp || 0);
      return { baseCents, vatBp: pu.vatBp || 0, vatCents, totalCents: baseCents + vatCents };
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
          // Gaps 10 and 11 of the workbook mapping. `sourcePath` is where the
          // file came from before it was ours — the "Ruta completa" column of
          // a folder tree nobody wants to lose the trail of; `reference` is
          // the number the supplier's own paperwork carries (an order ref, a
          // job number) and `notes` is what the person who filed it wanted the
          // next person to know. None of the three is derivable from the
          // document, which is exactly why they are stored.
          sourcePath: doc.sourcePath || "",
          reference: doc.reference || "",
          notes: doc.notes || "",
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
    /**
     * CAP-05 · IS THIS THE SAME DOCUMENT, FILED TWICE?
     *
     * The rule used to be `issuerTaxId === issuerTaxId && docNumber ===
     * docNumber`, which failed the operator the first time it was needed: they
     * filed one supplier invoice twice, and the two copies sat in the register
     * side by side with no warning, because the READER had changed in between
     * and given the two copies different tax ids. Identity that depends on
     * every field being read the same way is identity that stops working the
     * day the reader improves.
     *
     * Worse in the other direction: two documents nobody had confirmed yet
     * both carried an empty tax id and an empty number, and `"" === ""` made
     * every blank document a duplicate of every other one.
     *
     * So: a number identifies a document, and an issuer identifies who wrote
     * it — but the issuer may be known by a tax id OR by a name, and either
     * will do. Failing a number entirely, the same issuer billing the same
     * amount on the same day is the same document; nobody sends two.
     * Empty never matches empty, in any clause.
     */
    _dupKeys(confirmed) {
      if (!confirmed) return null;
      const squash = (v) =>
        String(v || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
      // Same folding `findDuplicateParty` uses for a name — accents off, case
      // off, runs of space collapsed. Two people typing one supplier will not
      // agree about «Vallès», and the archive should not care.
      const name = String(confirmed.issuerName || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return {
        number: squash(confirmed.docNumber),
        taxId: squash(confirmed.issuerTaxId),
        name,
        date: String(confirmed.date || ""),
        total: Math.round(confirmed.totalCents || 0),
      };
    }

    _sameDocument(a, b) {
      if (!a || !b) return false;
      const sameIssuer = (!!a.taxId && a.taxId === b.taxId) || (!!a.name && a.name === b.name);
      if (!sameIssuer) return false;
      if (a.number && b.number) return a.number === b.number;
      // No number to go on: the same issuer, the same day, the same money.
      return (
        !a.number &&
        !b.number &&
        !!a.date &&
        a.date === b.date &&
        a.total > 0 &&
        a.total === b.total
      );
    }

    /**
     * Every filed document that looks like another one — computed, not stamped.
     *
     * `confirmCapture` stamps `duplicateSuspect` at the moment of confirming,
     * which means a pair that only becomes recognisable LATER — because the
     * reader improved, or because somebody corrected a tax id by hand — stays
     * unflagged for ever, and the two documents the operator was looking at
     * were exactly that pair. Deriving it on read costs one pass and cannot go
     * stale.
     */
    duplicateCaptureMap() {
      const out = {};
      const seen = [];
      for (const c of this.state.captured) {
        const keys = this._dupKeys(c.confirmed);
        if (!keys) continue;
        const hit = seen.find((s) => this._sameDocument(s.keys, keys));
        if (hit) out[c.id] = hit.id;
        seen.push({ id: c.id, keys });
      }
      return out;
    }

    /**
     * Remove a filed document. The one thing the archive could not do.
     *
     * A capture is a photograph plus what a person confirmed about it, and
     * both are undoable facts until the moment it becomes a BILL — at which
     * point it is an accounting record with a supplier, a due date and a place
     * in the payables ledger, and deleting the photograph behind it would
     * leave that record describing a document nobody can produce. So the one
     * refusal is exactly that, and it says what to do instead.
     */
    deleteCapture(capId, user) {
      const i = this.state.captured.findIndex((x) => x.id === capId);
      if (i < 0) throw new Error("Captured document not found: " + capId);
      const c = this.state.captured[i];
      if (c.billId) {
        const bill = this.state.bills.find((b) => b.id === c.billId);
        throw new Error(
          "No se puede eliminar: ya está registrado como factura " +
            ((bill && bill.number) || c.billId) +
            ". Anula primero la factura.",
        );
      }
      this.state.captured.splice(i, 1);
      this._log(user, "deleteCapture", c.stdName || c.id);
      return c;
    }

    confirmCapture(capId, confirmed, user) {
      // CAP-04 human confirmation; CAP-05 duplicates
      const c = this.state.captured.find((x) => x.id === capId);
      const keys = this._dupKeys(confirmed);
      const dup = this.state.captured.find(
        (x) => x.id !== capId && this._sameDocument(this._dupKeys(x.confirmed), keys),
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
    /**
     * The three text fields a person adds to a filed document — the two
     * workbook columns the model had nowhere to put, plus the free note.
     *
     * Deliberately separate from `confirmCapture`: that method records what
     * the document SAYS and is the moment a reading becomes a fact, so it
     * re-derives the standard name and re-runs duplicate detection. These
     * three say nothing about the document's content and must not disturb
     * either — renaming a filed invoice because somebody added a note would
     * be a surprise, and a surprise in an archive is a lost document.
     */
    updateCapture(capId, patch, user) {
      const c = this.state.captured.find((x) => x.id === capId);
      if (!c) throw new Error("Captured document not found: " + capId);
      ["sourcePath", "reference", "notes"].forEach((k) => {
        if (patch[k] !== undefined) c[k] = String(patch[k] ?? "");
      });
      this._log(user, "updateCapture", capId);
      return c;
    }
    /**
     * WHAT A SPLIT MUST ADD UP TO — the taxable base, never the total.
     *
     * An allocation distributes a COST across the jobs and overheads that bear
     * it, and input VAT is not a cost: it is recoverable, handled on the tax
     * side, and charging it to a partida overstates that job by the rate.
     * `registerBill` and `allocateBill` have always said so — «Bill
     * allocations must total the taxable base» — while this door demanded the
     * VAT-inclusive total, and `projectCostRows` adds both into one figure.
     * Two doors, two units, one number.
     *
     * And it made the operator do the work twice, in two units. `billDrawer`
     * seeds a bill from the capture's own rows and then refuses them, because
     * it has always footed against the base — so a split entered here had to
     * be entered again there, against a different number, for the same
     * document. (`billFromCapture` rescales what it is handed, which is why
     * the promotion still produced a correct bill; the second entry was the
     * cost, not a wrong figure.) The screen's own refusal there — «El reparto
     * debe sumar la base imponible» — was the system saying which unit it
     * meant, in the one place that already knew.
     *
     * The base is taken from the record when it is there, and reconstructed
     * from total − tax when it is not, which is exact rather than a guess: a
     * document that states no tax has a base equal to its total, and one that
     * states tax has a base equal to the difference. Zero means nothing is
     * known yet, and the caller asserts nothing rather than asserting against
     * a figure it invented.
     */
    captureBasisCents(confirmed) {
      if (!confirmed) return 0;
      const base = cents(confirmed.baseCents || 0);
      if (base > 0) return base;
      const total = cents(confirmed.totalCents || 0);
      const vat = cents(confirmed.vatCents || 0);
      return Math.max(0, total - vat);
    }

    allocateCapture(capId, allocations, user) {
      // CAP-03/07: one project, split, or overhead
      const c = this.state.captured.find((x) => x.id === capId);
      if (!c) throw new Error("Captured document not found: " + capId);
      const rows = Array.isArray(allocations) ? allocations : [];
      if (!rows.length) throw new Error("A document must be allocated to something");
      rows.forEach((a) => {
        // Rule 4 of the mapping's entity model: every cost lands on a project
        // OR an account. "Both" is not a third option — it is two answers to
        // one question, and whichever one a later report happens to read
        // first decides where the money went.
        if (!!a.projectId === !!a.overheadCategory)
          throw new Error("Each line goes to a project or to an overhead category, not both");
        if (a.projectId) this.project(a.projectId); // throws with the id if it is gone
        if (a.overheadCategory && !LISTS.overheadCategories.includes(a.overheadCategory))
          throw new Error("Unknown overhead category: " + a.overheadCategory);
        if (a.kind && !LISTS.costKinds.includes(a.kind))
          throw new Error("Unknown cost kind: " + a.kind);
        if (!(Math.round(a.amountCents) > 0)) throw new Error("Every line needs a positive amount");
      });
      // A confirmed document has a base to check the split against. An
      // unconfirmed one does not, and inventing one from the split itself
      // would make the check agree with whatever it was handed — so the
      // arithmetic is only asserted where there is something to assert it
      // against, and filing an unread photograph stays possible. A confirmed
      // document with no usable figure is the same case: nothing to assert.
      const basis = this.captureBasisCents(c.confirmed);
      const target = basis > 0 ? basis : sum(rows, (a) => a.amountCents);
      if (Math.abs(sum(rows, (a) => a.amountCents) - target) > 1)
        throw new Error("Split must total the taxable base"); // 7.4
      c.allocations = rows.map((a) =>
        // Gap 13: the account is resolved at the moment the cost is filed, so
        // a later report never has to guess what somebody meant.
        this.withAccountCode({
          projectId: a.projectId || null,
          overheadCategory: a.overheadCategory || null,
          chapterNum: a.chapterNum || null,
          lineId: a.lineId || null,
          kind: a.kind || "material",
          amountCents: Math.round(a.amountCents),
        }),
      );
      c.status = "allocated";
      this._log(user, "allocateCapture", capId);
      return c;
    }

    /* =========================== AR — invoices, receipts, collections =========================== */

    /**
     * Everything standing between a draft and an issued invoice, as a LIST
     * rather than as the first exception thrown.
     *
     * The rules themselves are old — completeness, an unsigned contract, an
     * unapproved extra, an abono that names no original. What is new is that
     * a screen can now ask for them BEFORE trying, which is the whole
     * difference between "the invoice you were about to write is blocked, and
     * here is what to fix" and an error toast after the fact.
     *
     * There is exactly one copy of them, and `issueInvoice` throws on the
     * first entry of this same list. A second implementation for the screen
     * would be a second implementation of the law: it would agree on the day
     * it was written and drift silently from then on.
     */
    _invoiceBlocks(draft) {
      const out = [];
      const p = this.project(draft.projectId);
      /* ORG-01 — the seller's own identity, which a document cannot go out
         without. Stated HERE, as a block, so the operator reads it in the
         preview beside every other reason the invoice is not ready. It was
         previously only enforced at issue, where it surfaced as a thrown
         error from a button — the same fact, delivered as a crash. */
      if (!this.companyConfigured())
        out.push({
          code: "ORG-01",
          label: "Faltan los datos de la empresa",
          detail:
            "Complete el nombre fiscal, el NIF, la dirección y el IBAN en Configuración › Empresa. " +
            "La factura lleva la identidad del emisor y no puede emitirse sin ella.",
        });
      /* WHO IS BEING BILLED — the payer named on the draft, not the project's
         own customer. A job with one payer answers the same as it always did. */
      const billTo = draft.billToPartyId || p.partyId;
      const payer = this._billingFor(p, billTo);
      if (!payer)
        out.push({
          code: "AR-12",
          label: "Ese cliente no paga esta obra",
          detail: "Añádalo como pagador del proyecto antes de emitirle una factura.",
        });
      // THEIR fiscal data, not the project customer's. A contractor with no NIF
      // must block its own invoice and leave the end customer's alone.
      if (this.state.parties.some((x) => x.id === billTo)) {
        const comp = this.partyCompleteness(billTo);
        if (!comp.ok)
          out.push({
            code: "MDM-10",
            label: "Datos fiscales del cliente incompletos",
            detail: comp.missing.join(", "),
            data: true, // A12 · a field list is data — no translator touches it
          });
      }
      /* AR-11 — the guard the whole split rests on.
         Nobody may be billed for more than they owe. Without it the payer is a
         free choice per invoice and the same chapter can be billed to both, on
         two sealed documents in a gapless series, discovered months later.
         Credit notes are exempt: an abono REDUCES what a payer has been billed,
         so capping it would refuse the very correction that fixes an overbill. */
      /* An extra has its OWN rule and does not need this one as well.
         CHG-04 below already refuses an unapproved adicional, by name and with
         the reason an operator can act on; AR-11 fired alongside it only
         because an unapproved extra is not yet in the ceiling, which is a
         restatement of the same fact in worse words. Once approved the extra
         IS in the ceiling, so nothing is left unguarded either way. */
      if (payer && draft.kind !== "creditNote" && !draft.changeId) {
        const bases = this.invoiceBases(p.id, billTo);
        const room = bases.attributedCents - bases.billedBaseCents;
        const want = this._invoiceBase(draft);
        /* Rounding slack, and ONLY rounding slack.
           `projectBilling.remainingToInvoiceCents` is VAT-INCLUSIVE, so the
           natural way to size a final invoice is to divide it back down by the
           rate — and that round trip is worth up to a cent each time. The
           allowance is one cent per invoice this payer already has, plus one:
           the most the arithmetic can drift, and orders of magnitude below the
           euros a real scope error is made of. The year simulation issued its
           own final invoice one cent over and was refused. */
        const slack = (bases.issued || []).length + 1;
        if (want > room + slack)
          out.push({
            code: "AR-11",
            label: "Excede lo que este cliente debe por esta obra",
            detail: `Pendiente ${(room / 100).toFixed(2)} €, factura ${(want / 100).toFixed(2)} €`,
            data: true, // A12 · figures
          });
      }
      const contract = p.contractId
        ? this.state.contracts.find((c) => c.id === p.contractId)
        : null;
      /* The contract binds the payer it NAMES. A second payer who signed
         nothing is not blocked by the first one's unsigned contract, and — the
         direction that matters — the first payer's own first invoice is still
         blocked even if the second has already been invoiced. Scoping this to
         the project would have let one payer's invoice quietly unlock the
         other's. */
      const contractParty = contract ? contract.partyId || p.partyId : null;
      const firstForPayer = !this.state.invoices.some(
        (i) => i.projectId === p.id && i.partyId === billTo && i.kind !== "creditNote",
      );
      if (
        contract &&
        contractParty === billTo &&
        firstForPayer &&
        !contract.signature.customerSignedAt
      ) {
        /* NAME THE CONTRACT IT READ. The blocker used to say only that the
           contract was unsigned — while the operator was looking at a signed
           contract for the same customer, on the same screen, and had no way
           to learn that the job was pointing at a different record. Naming it
           turns "this is wrong" into "this is which", and when a signed
           contract exists on the same budget the sentence says so and where to
           go. The number rides in `ref` rather than inside `detail` so the
           sentence still translates and the record still does not. */
        const signedElsewhere = this._bestContractForBudget(contract.budgetId, {
          exclude: contract.id,
        });
        const other =
          signedElsewhere && signedElsewhere.signature && signedElsewhere.signature.customerSignedAt
            ? signedElsewhere
            : null;
        out.push({
          code: "CON-11",
          label: "Contrato sin firmar",
          detail: other
            ? "La obra está vinculada a un contrato sin firmar, y hay otro ya firmado para este presupuesto: vincúlelo a la obra desde el contrato."
            : "La primera factura de la obra necesita el contrato firmado.",
          ref: other ? contract.number + " → " + other.number : contract.number,
        });
      }
      if (draft.kind === "creditNote" && !draft.rectifies)
        out.push({
          code: "AR-10",
          label: "El abono no dice qué factura rectifica",
          detail: "Un abono siempre nombra la factura que corrige.",
        });
      if (draft.changeId) {
        const ch = this.state.changes.find((x) => x.id === draft.changeId);
        if (!ch)
          out.push({
            code: "CHG-04",
            label: "El adicional no existe",
            detail: draft.changeId,
            data: true, // A12 · an identifier
          });
        else if (!["approved", "executed"].includes(ch.status))
          out.push({
            code: "CHG-04",
            label: "Adicional sin aprobar",
            detail: "Sólo se factura un adicional que el cliente ya ha aprobado.",
          });
      }
      return out;
    }

    /**
     * The payer an invoice is for, and the terms that go with them.
     *
     * Returns null when the party named is not a payer on this project, rather
     * than throwing: `previewInvoice` has to keep rendering a draft that names
     * the wrong party, and `issueInvoice` has to turn it into a BLOCK — one
     * that fires before a number is minted. A throw from here would do neither.
     *
     * A project written before billing existed, or one whose array was somehow
     * emptied, falls back to its own customer on its own rate: the same
     * single-payer arrangement `defaultBilling` produces. The ordinary job
     * therefore never depends on the migration having run.
     */
    _billingFor(p, billToPartyId) {
      const rows =
        Array.isArray(p.billing) && p.billing.length
          ? p.billing
          : defaultBilling(p.partyId, p.vatBp);
      const wanted = billToPartyId || p.partyId;
      return rows.find((r) => r.partyId === wanted) || null;
    }

    /**
     * What one payer owes for on this project — their scope, not their progress.
     *
     * This is the ceiling the over-billing guard uses, and it is deliberately
     * SCOPE and not executed work: a deposit invoice legitimately precedes the
     * work it pays for, so capping against progress would refuse a perfectly
     * ordinary 40% up-front. What must never happen is billing somebody for
     * work that was never theirs.
     *
     * A single-payer job is attributed the baseline's own revenue figure rather
     * than the sum of its chapters. The two differ whenever the budget carried
     * a discount — `revenueCents` is the taxable total, chapter `saleCents` are
     * before it — and every other screen in the system quotes the baseline.
     * Summing chapters unconditionally would have made this guard refuse
     * legitimate invoices on every discounted job, which is a worse failure
     * than the one it exists to prevent.
     *
     * An approved extra belongs to whoever owes for the chapter it affects:
     * `change.chapterNum` already records which chapter that is, so nothing new
     * had to be stored to know who pays for it. An extra with no chapter falls
     * to the project's own customer, which is where it was always billed.
     */
    _attributedCents(p, partyId) {
      const chapters = (p.baseline && p.baseline.chapters) || [];
      const mine = chapters.filter((c) => (c.billToPartyId || p.partyId) === partyId);
      const base =
        mine.length === chapters.length
          ? p.baseline.revenueCents
          : sum(mine, (c) => c.saleCents || 0);
      const nums = new Set(mine.map((c) => String(c.num)));
      /* The SAME three statuses `projectEconomics` counts as revenue, and it
         has to stay that way. "invoiced" belongs here: issuing an invoice for
         an extra moves it to that status, and dropping it from the ceiling
         while it stays in `currentRevenueCents` made the cap fall below what
         the project legitimately still had to bill — the year simulation
         refused its own final invoice by 1 565 €. An extra that has been
         invoiced is still part of what the payer owes; it is already counted on
         the other side of the subtraction, in `billedBaseCents`. */
      const extras = this.state.changes.filter(
        (c) =>
          c.projectId === p.id &&
          ["approved", "executed", "invoiced"].includes(c.status) &&
          (c.chapterNum ? nums.has(String(c.chapterNum)) : partyId === p.partyId),
      );
      let variation = 0;
      if (partyId === p.partyId)
        for (const r of this.chapterEconomics(p.id)) if (r.variation) variation += r.saleCents;
      return base + sum(extras, (c) => c.priceCents || 0) + variation;
    }

    /**
     * Add a payer to a project — the general contractor beside the end customer.
     *
     * Their tax treatment is theirs, not the project's: see `defaultBilling`.
     * Nothing about it is inferred from the party's shape.
     */
    addProjectPayer(projectId, payer, user) {
      const p = this.project(projectId);
      const party = this.party(payer.partyId); // throws on an unknown party
      if (!Array.isArray(p.billing) || !p.billing.length)
        p.billing = defaultBilling(p.partyId, p.vatBp);
      if (p.billing.some((b) => b.partyId === party.id))
        throw new Error("Already a payer on this project: " + party.name);
      p.billing.push({
        partyId: party.id,
        role: payer.role || "mainContractor",
        vatBp: payer.vatBp != null ? payer.vatBp : p.vatBp,
        taxTreatment: payer.taxTreatment || "standard",
        taxJustification: payer.taxJustification || "",
        paymentTermsDays: payer.paymentTermsDays != null ? payer.paymentTermsDays : null,
      });
      this._log(user, "addProjectPayer", p.code);
      return p.billing;
    }

    /** Correct a payer's terms — the tax treatment above all, which is the one
     an operator sets after asking their gestor. Never their identity: that is
     `addProjectPayer` plus a reassignment, and both are refused once invoiced. */
    updateProjectPayer(projectId, partyId, patch, user) {
      const p = this.project(projectId);
      const row = this._billingFor(p, partyId);
      if (!row) throw new Error("Not a payer on this project");
      for (const k of ["role", "vatBp", "taxTreatment", "taxJustification", "paymentTermsDays"])
        if (k in patch) row[k] = patch[k];
      this._log(user, "updateProjectPayer", p.code);
      return row;
    }

    /**
     * Say which payer owes for a chapter.
     *
     * Refused once ANYTHING has been invoiced on the project. Before the first
     * invoice this is arrangement; after it, somebody has been told what they
     * are buying and moving a chapter between payers changes that silently —
     * which is a change order, not an edit. `Object.freeze` on the baseline is
     * shallow and would not have stopped it, so the rule is stated here rather
     * than assumed from the freeze.
     */
    assignChapterPayer(projectId, chapterNum, partyId, user) {
      const p = this.project(projectId);
      if (!this._billingFor(p, partyId))
        throw new Error("Not a payer on this project — add them first");
      if (this.state.invoices.some((i) => i.projectId === p.id))
        throw new Error(
          "Cannot reassign a chapter once the project has been invoiced — raise a change order",
        );
      const ch = ((p.baseline && p.baseline.chapters) || []).find(
        (c) => String(c.num) === String(chapterNum),
      );
      if (!ch) throw new Error("Chapter not found: " + chapterNum);
      ch.billToPartyId = partyId;
      this._log(user, "assignChapterPayer", p.code + " · " + chapterNum);
      return ch;
    }

    /** The base of a draft: its own lines when it has them, `baseCents` otherwise. */
    _invoiceBase(draft) {
      if (draft.baseCents != null) return cents(draft.baseCents);
      return sum(draft.lines || [], (l) => cents(l.amountCents));
    }

    /**
     * The four places an invoice legitimately comes from on one project, each
     * already a record somewhere else in the system.
     *
     * Nothing here is a suggestion the operator has to retype: a milestone
     * carries its own amount, a certification is the value-weighted progress
     * the S curve already draws, and an adicional is priced and approved
     * before it ever reaches this screen. The generator's job is to let
     * somebody pick one, not to make them add it up again.
     */
    invoiceBases(projectId, billToPartyId) {
      const p = this.project(projectId);
      const contract = p.contractId
        ? this.state.contracts.find((c) => c.id === p.contractId)
        : null;
      /* Scoped to ONE payer when asked, project-wide when not.
         Both are wanted and they are different questions: the invoice generator
         asks what this payer may still be billed, the economics screens ask what
         the whole job has billed. Keeping one function answering both is what
         stops the two drifting into different definitions of "billed". */
      const forParty = billToPartyId || null;
      const invs = this.state.invoices.filter(
        (i) => i.projectId === p.id && (!forParty || i.partyId === forParty),
      );
      // Already billed, as BASE and net of abonos — the figure a certification
      // has to subtract. Totals would be the wrong number: VAT is not revenue.
      const billedBase =
        sum(
          invs.filter((i) => i.kind !== "creditNote"),
          (i) => i.baseCents,
        ) -
        sum(
          invs.filter((i) => i.kind === "creditNote"),
          (i) => i.baseCents,
        );
      const prog = this.chapterProgress(p.id);
      const chapters = (p.baseline.chapters || [])
        .filter((c) => !forParty || (c.billToPartyId || p.partyId) === forParty)
        .map((c) => {
          const hit = prog.find((x) => x.num === c.num);
          const progressPct = hit ? hit.progressPct : 0;
          return {
            num: c.num,
            name: c.name,
            valueCents: c.saleCents,
            progressPct,
            doneCents: Math.round((c.saleCents * progressPct) / 100),
          };
        });
      /* Accepted variations certify like any other chapter. They are owed by
         the project's own payer (the default the attribution ceiling uses too),
         so a payer-scoped ask for anyone else does not see them. */
      if (!forParty || forParty === p.partyId)
        for (const r of this.chapterEconomics(p.id))
          if (r.variation) {
            const hit = prog.find((x) => String(x.num) === String(r.num));
            const progressPct = hit ? hit.progressPct : 0;
            chapters.push({
              num: r.num,
              name: r.name,
              valueCents: r.saleCents,
              progressPct,
              doneCents: Math.round((r.saleCents * progressPct) / 100),
            });
          }
      const executedCents = sum(chapters, (c) => c.doneCents);
      return {
        billedBaseCents: billedBase,
        // What this payer owes in total — the ceiling AR-11 enforces. Without a
        // payer it is the whole job, which is the same number it always was.
        attributedCents: this._attributedCents(p, forParty || p.partyId),
        // A milestone belongs to the payer the CONTRACT names. Offering the end
        // customer's instalments while invoicing the contractor would propose
        // billing one person on another's payment plan.
        milestones:
          contract && (!forParty || (contract.partyId || p.partyId) === forParty)
            ? contract.installments
                .map((i, idx) => ({
                  idx,
                  trigger: i.trigger,
                  pct: i.pct != null ? i.pct : null,
                  amountCents: i.amountCents,
                  /* THE INSTALMENT WITH ITS VAT TAKEN BACK OFF.
                     A contract states its payment schedule the way a customer
                     reads it — "40% a la firma" of `totalCents`, which is
                     `valueCents + vatCents`. An invoice is built from a BASE
                     and adds VAT itself, so feeding the instalment straight in
                     charged the tax twice: on a 1.000 € + 10% contract the
                     100% milestone billed 1.210 € against a 1.100 € contract.
                     That was live, and the over-billing guard is what found it.
                     The engine hands over the base so the screen never has to
                     do this division — the same reason the rest of this method
                     exists ("the generator's job is to let somebody pick one,
                     not to make them add it up again").
                     Stripped at the project's own rate, because that is the
                     rate baked into the figure the contract was signed on. */
                  baseCents: Math.round(i.amountCents / (1 + (p.vatBp || 0) / 10000)),
                  expectedDate: i.expectedDate || null,
                  status: i.status,
                }))
                .filter((i) => i.status === "planned")
            : [],
        certification: {
          chapters,
          executedCents,
          // Never negative: over-billing against progress is a real situation
          // (a deposit invoice precedes the work it pays for), and proposing a
          // negative certification would turn that into a nonsense line rather
          // than into "nothing to certify yet".
          proposedCents: Math.max(0, executedCents - billedBase),
        },
        changes: this.state.changes
          .filter(
            (c) =>
              c.projectId === p.id && ["approved", "executed"].includes(c.status) && !c.invoiceId,
          )
          .map((c) => ({ id: c.id, desc: c.desc, priceCents: c.priceCents, status: c.status })),
        issued: invs
          .filter((i) => i.kind !== "creditNote")
          .map((i) => ({ id: i.id, number: i.number, date: i.date, totalCents: i.totalCents })),
      };
    }

    /**
     * What this draft would become if it were issued now — and what stops it.
     *
     * The screen computes no money. Base, VAT, withholding and total come from
     * here, which is the same arithmetic `issueInvoice` performs, so a preview
     * cannot show one figure and the emitted document another. Nothing is
     * persisted and no number is minted: a draft that is abandoned must leave
     * no trace in a series that is required to have no gaps.
     */
    previewInvoice(draft) {
      const p = this.project(draft.projectId);
      // Same resolution as issueInvoice, through the same helper — the promise
      // this method's docstring makes ("a preview cannot show one figure and
      // the emitted document another") is only kept if the payer, the rate and
      // the terms are worked out in one place rather than twice.
      const payer =
        this._billingFor(p, draft.billToPartyId) || defaultBilling(p.partyId, p.vatBp)[0];
      const party = this.party(payer.partyId);
      const baseCents = this._invoiceBase(draft);
      const vatBp = draft.vatBp != null ? draft.vatBp : payer.vatBp != null ? payer.vatBp : p.vatBp;
      const vatCents = pctOf(baseCents, vatBp);
      const irpfBp = draft.irpfBp || 0;
      const irpfCents = pctOf(baseCents, irpfBp);
      const blocks = this._invoiceBlocks(draft);
      const rec = {
        number: null, // minted at issue, never before — see nextNumber
        kind: draft.kind || "progress",
        date: this.state.today,
        partyId: payer.partyId,
        taxTreatment: payer.taxTreatment || "standard",
        taxJustification: payer.taxJustification || "",
        projectId: p.id,
        budgetNumber: p.budgetNumber,
        worksAddress: draft.worksAddress || "",
        lines: this._invoiceLines(draft, baseCents),
        baseCents,
        vatBp,
        vatCents,
        irpfBp,
        irpfCents,
        totalCents: baseCents + vatCents - irpfCents,
        // A payer may carry terms of their own — a contractor at 60 days
        // beside an end customer at 30 — falling back to the party record so a
        // renegotiated term is not stale in a second copy.
        dueDate: addDays(
          this.state.today,
          payer.paymentTermsDays ||
            party.paymentTermsDays ||
            this._configForRead().paymentTermsDays,
        ),
        paymentMethod: party.paymentMethod,
        // Soft read, unlike the issuing path below. A preview draws what the
        // document would say; an unconfigured workspace makes that "no account
        // number yet", not an error page. The refusal belongs at issue.
        iban: (this.state.config && this.state.config.iban) || "",
        // N1: the language the issued document will speak, resolved the same
        // way the issuing path resolves it — a preview must not lie.
        language: this._docLanguageFor(draft.language, p.id, payer.partyId),
        rectifies: draft.rectifies || null,
        rectifyReason: draft.rectifyReason || null,
      };
      return {
        doc: this._invoiceDoc(rec),
        baseCents,
        vatBp,
        vatCents,
        irpfBp,
        irpfCents,
        totalCents: rec.totalCents,
        dueDate: rec.dueDate,
        blocks,
        // An invoice for nothing is not a blocked invoice, it is an empty one —
        // it gets its own flag rather than a rule number it does not have.
        empty: baseCents === 0,
        ok: blocks.length === 0 && baseCents !== 0,
      };
    }

    /**
     * A caller that supplies `baseCents` and no lines gets the one-line form
     * this has always produced. A draft with neither — the state the generator
     * is in before anybody has chosen an origin — previews as genuinely empty
     * rather than as a placeholder line for nothing, which reads like a real
     * concept somebody has already agreed to bill.
     */
    _invoiceLines(inv, baseCents) {
      if (inv.lines && inv.lines.length) return clone(inv.lines);
      if (!baseCents) return [];
      return [{ desc: inv.desc || "Certificación de obra", amountCents: baseCents }];
    }

    /**
     * The invoice as a document — the same projection shape a presupuesto and
     * a contrato already have, and for the same reason: the sheet that gets
     * printed reads one object rather than reaching into engine state.
     */
    _invoiceDoc(rec) {
      const project = this.state.projects.find((x) => x.id === rec.projectId) || null;
      const rectified = rec.rectifies
        ? this.state.invoices.find((i) => i.id === rec.rectifies || i.number === rec.rectifies)
        : null;
      return {
        docType: rec.kind === "creditNote" ? "FACTURA RECTIFICATIVA" : "FACTURA",
        number: rec.number,
        date: rec.date,
        dueDate: rec.dueDate,
        // The IBAN is the one exception to reading live: an issued invoice
        // carries the account it told the customer to pay into, and that must
        // not move under a payment already in flight.
        issuer: Object.assign(this._issuerBlock(), {
          iban: rec.iban || this._configForRead().iban,
        }),
        customer: (({ name, taxId, billStreet, billPostalCode, billCity }) => ({
          name,
          taxId,
          address: `${billStreet}, ${billPostalCode} ${billCity}`,
        }))(this.party(rec.partyId)),
        projectCode: project ? project.code : null,
        budgetNumber: rec.budgetNumber || null,
        worksAddress: rec.worksAddress || "",
        lines: clone(rec.lines || []),
        baseCents: rec.baseCents,
        vatBp: rec.vatBp,
        vatCents: rec.vatCents,
        irpfBp: rec.irpfBp,
        irpfCents: rec.irpfCents,
        totalCents: rec.totalCents,
        paymentMethod: rec.paymentMethod,
        // N1: records issued before the field resolve through the same chain,
        // which lands on the budget language they were always printed beside.
        language: rec.language || this._docLanguageFor(null, rec.projectId, rec.partyId),
        rectifies: rectified ? rectified.number : null,
        rectifyReason: rec.rectifyReason || null,
      };
    }

    /** The issued invoice as a document (AR-02/03, DOC-01). */
    renderInvoiceDoc(invoiceId) {
      const inv = this.state.invoices.find((i) => i.id === invoiceId || i.number === invoiceId);
      if (!inv) throw new Error("Invoice not found");
      return this._invoiceDoc(inv);
    }

    issueInvoice(inv, user) {
      // AR-01..04 / VFU-01/02
      const p = this.project(inv.projectId);
      /* EVERY refusal happens before a number is minted.
         `nextNumber` mutates the series — it increments the counter and pushes
         the number onto `issued` — so a check that fires after it has run
         leaves a number that exists in a gapless series and on no document.
         The credit-note and unapproved-extra checks used to sit below the
         record literal and did exactly that. */
      const blocked = this._invoiceBlocks(inv);
      if (blocked.length)
        throw new Error(
          `${blocked[0].code}: ${blocked[0].label}` +
            (blocked[0].detail ? ` (${blocked[0].detail})` : ""),
        );
      const contract = p.contractId
        ? this.state.contracts.find((c) => c.id === p.contractId)
        : null;
      /* The payer, resolved once. `_invoiceBlocks` has already refused a party
         who does not pay for this project (AR-12), so the fallback below is
         unreachable in practice — it is there so a project whose billing array
         is somehow absent still issues on its own customer rather than throwing
         after the blocks have passed. */
      const payer = this._billingFor(p, inv.billToPartyId) || defaultBilling(p.partyId, p.vatBp)[0];
      const party = this.party(payer.partyId);
      const baseCents = this._invoiceBase(inv);
      const vatBp = inv.vatBp != null ? inv.vatBp : payer.vatBp != null ? payer.vatBp : p.vatBp;
      const vatCents = pctOf(baseCents, vatBp);
      const irpfBp = inv.irpfBp || 0; // AR-07 customer withholds
      const irpfCents = pctOf(baseCents, irpfBp);
      const isCredit = inv.kind === "creditNote";
      const rec = {
        id: this._id("inv"),
        number: this.nextNumber(isCredit ? "creditNote" : "invoice"),
        kind: inv.kind || "progress",
        date: this.state.today,
        partyId: payer.partyId,
        /* The tax decision AND its justification, on the artifact.
           This system records why a rate was applied rather than leaving the
           document to be re-derived years later from a rule that may since have
           changed — and a reverse charge in particular has to carry its legal
           mention on the invoice itself. */
        taxTreatment: payer.taxTreatment || "standard",
        taxJustification: payer.taxJustification || "",
        projectId: p.id,
        budgetNumber: p.budgetNumber, // AR-03
        worksAddress: inv.worksAddress || "",
        lines: this._invoiceLines(inv, baseCents),
        baseCents,
        vatBp,
        vatCents,
        irpfBp,
        irpfCents,
        totalCents: baseCents + vatCents - irpfCents,
        // A payer may carry terms of their own — a contractor at 60 days
        // beside an end customer at 30 — falling back to the party record so a
        // renegotiated term is not stale in a second copy.
        dueDate: addDays(
          this.state.today,
          payer.paymentTermsDays ||
            party.paymentTermsDays ||
            this._configForRead().paymentTermsDays,
        ),
        paymentMethod: party.paymentMethod,
        iban: this._requireConfig(inv.kind === "creditNote" ? "a credit note" : "an invoice").iban, // AR-02
        // N1: chosen at creation, frozen at issue with the rest of the record.
        language: this._docLanguageFor(inv.language, p.id, payer.partyId),
        rectifies: inv.rectifies || null,
        rectifyReason: inv.rectifyReason || null, // VFU-02
        installmentIdx: inv.installmentIdx != null ? inv.installmentIdx : null,
        changeId: inv.changeId || null,
        immutable: true,
        docRef: null,
      };
      if (rec.changeId) {
        // Billable by now — _invoiceBlocks refused an unapproved one above,
        // before the number was minted (CHG-04).
        const ch = this.state.changes.find((x) => x.id === rec.changeId);
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
        /* `invoicedInvoiceId` is the name the installment shape declares and
           the name renderContractDoc reads. This wrote `invoiceId`, so a
           billed milestone showed as invoiced with no invoice behind it — the
           link was stored under a name nothing looked for. */
        i.invoicedInvoiceId = rec.id;
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
      /* The customer side of A4. Money received over and above an invoice is
         a real thing — an advance — but it belongs in `onAccountCents`, where
         it is visible, not pushed into the invoice to make its balance
         negative. Same reasoning and same placement as payBills: before the
         collection is pushed, or the outstanding already includes it. */
      for (const a of rec.allocations) {
        const open = this.invoiceOutstandingCents(a.invoiceId);
        if (a.amountCents > open + 1)
          throw new Error(
            "Se intentan cobrar " +
              a.amountCents +
              "c de una factura que sólo tiene pendiente " +
              open +
              "c. El exceso es un cobro a cuenta, no parte de esta factura.",
          );
      }
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
      if (inv.kind === "creditNote") return 0;
      return inv.totalCents - collected - credited - sum(inv.writeOffs || [], (w) => w.amountCents);
    }
    /**
     * Every issued invoice with its settlement state — the register a screen
     * lists, including the ones already collected.
     *
     * This used to be what receivables() returned, because its final filter
     * ended in `|| true` and so filtered nothing. The two lists answer
     * different questions and one of them was missing, so callers asking
     * "what is still owed" had to re-filter and the ones that forgot chased
     * paid invoices.
     */
    invoiceRegister() {
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
        });
    }
    /**
     * ADM-01's four counters: emitido · cobrado · pendiente · vencido.
     *
     * Every figure is derived from the register above rather than accumulated
     * separately, so the counters and the rows underneath them cannot tell
     * different stories — which is the failure mode a strip of totals over a
     * table exists to avoid, and the reason none of these is stored.
     *
     * `overdue` is a SUBSET of `outstanding`, not a fifth bucket beside it:
     * money that is late is still money that is owed. The doc paints that
     * counter red when it is non-zero, and a red counter that double-counts
     * would be the worst possible thing to paint red.
     */
    invoicingSummary(filter) {
      const rows = this.invoiceRegister().filter((r) => (filter ? filter(r) : true));
      const issuedCents = sum(rows, (r) => r.totalCents);
      const outstandingCents = sum(rows, (r) => r.outstandingCents);
      const overdue = rows.filter((r) => r.daysOverdue > 0);
      return {
        issued: { count: rows.length, amountCents: issuedCents },
        collected: {
          count: rows.filter((r) => r.outstandingCents <= 0).length,
          amountCents: issuedCents - outstandingCents,
        },
        outstanding: {
          count: rows.filter((r) => r.outstandingCents > 0).length,
          amountCents: outstandingCents,
        },
        overdue: {
          count: overdue.length,
          amountCents: sum(overdue, (r) => r.outstandingCents),
        },
      };
    }
    /** AR-08 follow-up list: what is still owed. A settled invoice belongs in
        the register, not in the chase list. */
    receivables() {
      return this.invoiceRegister().filter((x) => x.outstandingCents > 0);
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
      // Stated here, at the bottom, and not only in the screen above it: a bill
      // with no supplier is not a bill, and "Party not found" is what `party()`
      // would have said instead — true, and unhelpful about which party.
      if (!b.supplierId) throw new Error("A bill must name the supplier it belongs to");
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
          // AP-02 {projectId|overheadCategory, chapterNum, kind, amountCents,
          // accountCode}. Gap 13's field is resolved here so a bill registered
          // with its allocations already on it is filed as completely as one
          // allocated afterwards through `allocateBill`.
          allocations: (b.allocations || []).map((a) => this.withAccountCode(a)),
          // STAMPED, not looked up. The package that leaves for the accountant
          // has to stand on its own, and a foreign key into the party file is
          // not a name: the four fields named as the ones that matter are the
          // document number, its date, the issuer and the issuer's tax id, and
          // two of those lived only on another record. The party file stays the
          // place they are EDITED; these are what the invoice said on the day it
          // was filed, which is what a filing is for.
          supplierName: supplier.name || "",
          supplierTaxId: supplier.taxId || "",
          docRef: b.docRef || null,
          capId: b.capId || null,
          status: "registered",
          disputed: false,
          duplicateSuspect: dup ? dup.id : null,
          creditNoteFor: b.creditNoteFor || null, // AP-09
        },
        {},
      );
      /* A bill with no allocation used to be a legitimate state — filed, and
         belonging to nothing. Under the rule it is a cost with no home, which
         is the one thing that may not happen; the payables register flagged it,
         and flagging is not refusing. */
      if (!rec.allocations.length)
        throw new Error("A bill must be allocated: to a project's subpartidas, or to overheads");
      const allocSum = sum(rec.allocations, (a) => a.amountCents);
      if (Math.abs(allocSum - rec.baseCents) > 1)
        throw new Error("Bill allocations must total the taxable base");
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
    /**
     * Who issued a bill, for a reader that must not depend on the party file.
     *
     * Bills registered before the stamp above have neither field, and a bill
     * whose supplier was later deactivated still has to name its issuer — so
     * this prefers what was stamped and falls back to the party record. Every
     * report and export goes through here rather than reaching for
     * `party(b.supplierId).name` itself.
     */
    billSupplier(bill) {
      if (!bill) return { name: "", taxId: "" };
      if (bill.supplierName || bill.supplierTaxId)
        return { name: bill.supplierName || "", taxId: bill.supplierTaxId || "" };
      const p = this.state.parties.find((x) => x.id === bill.supplierId);
      return { name: p ? p.name || "" : "", taxId: p ? p.taxId || "" : "" };
    }
    /**
     * A validated document becomes the supplier invoice it always was.
     *
     * The reader has captured the issuer, the number, the date and the amounts
     * and a person has confirmed them; until now that was where the trail
     * stopped, because nothing promoted a `captured` record into a `bill`. The
     * consequence was quiet and large: bank reconciliation matches a movement
     * against a BILL, so on a workspace where every document arrived by camera
     * there was nothing to reconcile against.
     *
     * The supplier is not guessed. A tax id can be read off a page, but binding
     * a cost to the wrong company is not a mistake a screen should make on its
     * own, so the caller passes `supplierId` and the UI merely proposes one.
     *
     * ALLOCATIONS ARE RESCALED, because the two records measure different
     * things: a document is split across its TOTAL (`allocateCapture` asserts
     * exactly that), a bill across its TAXABLE BASE. Carrying the numbers
     * across untouched would fail `registerBill`'s own sum check, and carrying
     * them across silently wrong would be worse. Destinations are preserved,
     * amounts are scaled, and the last row absorbs the rounding so the total is
     * exact rather than approximately right.
     */
    billFromCapture(capId, opts, user) {
      const c = this.state.captured.find((x) => x.id === capId);
      if (!c) throw new Error("Captured document not found: " + capId);
      if (c.billId) throw new Error("This document has already been registered as a bill");
      const cf = c.confirmed;
      if (!cf) throw new Error("Confirm what the document says before registering it");
      const o = opts || {};
      if (!o.supplierId) throw new Error("Choose the supplier this document belongs to");
      const baseCents = o.baseCents != null ? cents(o.baseCents) : cents(cf.baseCents);
      const rows = o.allocations || c.allocations || [];
      const scaled = this._rescaleAllocations(rows, baseCents);
      return this.registerBill(
        {
          supplierId: o.supplierId,
          number: o.number != null ? o.number : cf.docNumber || "",
          date: o.date || cf.date || this.state.today,
          dueDate: o.dueDate || cf.dueDate || null,
          baseCents,
          vatCents: o.vatCents != null ? cents(o.vatCents) : cents(cf.vatCents),
          irpfBp: o.irpfBp,
          capId: c.id,
          allocations: scaled,
          docRef: o.docRef || c.stdName || null,
        },
        user,
      );
    }
    /**
     * The same destinations, summing to a different total, exactly.
     *
     * Proportional by amount, with the remainder given to the last row rather
     * than spread — a cent has to land somewhere, and a rule that says where is
     * worth more than one that is fair on average. An empty list stays empty:
     * an unallocated bill is a legitimate state and the screens say so.
     */
    _rescaleAllocations(rows, targetCents) {
      const list = (rows || []).filter((a) => a && Math.round(a.amountCents) > 0);
      if (!list.length) return [];
      const from = sum(list, (a) => Math.round(a.amountCents));
      if (!from) return [];
      let left = Math.round(targetCents);
      return list.map((a, i) => {
        const amountCents =
          i === list.length - 1
            ? left
            : Math.round((Math.round(a.amountCents) * targetCents) / from);
        left -= amountCents;
        return {
          projectId: a.projectId || null,
          overheadCategory: a.projectId ? null : a.overheadCategory || null,
          chapterNum: a.chapterNum || null,
          lineId: a.lineId || null,
          kind: a.kind || "material",
          amountCents,
        };
      });
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
      return b.totalCents - paid - credited - sum(b.writeOffs || [], (w) => w.amountCents);
    }
    /* ======================= A2 — is the rest still owed, or closed? ======
       A payment lands short. Until now the product had one answer: the
       document keeps owing the difference, forever, and a register of
       receivables slowly fills with 0,03 € and 12,50 € that nobody will ever
       collect and nobody dares delete. The other answer — this is closed, and
       here is why — was not expressible at all.

       Both are legitimate, they are not the same, and the difference is a
       question only a person can answer. So the product asks it, and records
       the answer: a write-off carries its reason code, its date and who said
       so, and `billOutstandingCents` / `invoiceOutstandingCents` subtract it.

       A reason is REQUIRED, and it comes from an owner-maintained list rather
       than free text. «Se da por cerrado» with no reason is indistinguishable
       from a mistake three months later, and the gestoría has to be able to
       tell a prompt-payment discount from a bank charge from a credit note
       that never arrived. Free text would answer the question in a way nothing
       could ever total.

       Written as a list rather than a single field because shortfalls repeat:
       two partial payments can each round, and the second must not overwrite
       the first's explanation. */
    _writeOffTarget(kind, docId) {
      if (kind === "bill") {
        const b = this.state.bills.find((x) => x.id === docId);
        if (!b) throw new Error("Bill not found");
        return { rec: b, open: this.billOutstandingCents(docId) };
      }
      if (kind === "invoice") {
        const i = this.state.invoices.find((x) => x.id === docId);
        if (!i) throw new Error("Invoice not found");
        if (i.kind === "creditNote")
          throw new Error("Una factura rectificativa no se da por cerrada");
        return { rec: i, open: this.invoiceOutstandingCents(docId) };
      }
      throw new Error("Unknown document kind: " + kind);
    }
    /**
     * Close the rest of a document, with a reason.
     *
     * `amountCents` defaults to everything still outstanding, which is the
     * case the drawer asks about. Passing more than is outstanding is refused
     * rather than clamped: a screen that silently writes off less than it was
     * told to has answered a different question than the one that was asked.
     */
    settleShortfall(kind, docId, reasonCode, user, amountCents) {
      const { rec, open } = this._writeOffTarget(kind, docId);
      if (open <= 0) throw new Error("Ese documento ya no debe nada");
      const reason = this.listActive("settlementReasons").find((r) => r.code === reasonCode);
      if (!reason) throw new Error("Elige un motivo de la lista");
      const amount = amountCents == null ? open : Math.round(amountCents);
      if (!(amount > 0)) throw new Error("El importe a cerrar tiene que ser positivo");
      if (amount > open)
        throw new Error(
          "Se intentan cerrar " + amount + "c de un documento que sólo debe " + open + "c.",
        );
      if (!Array.isArray(rec.writeOffs)) rec.writeOffs = [];
      const entry = {
        id: this._id("wof"),
        amountCents: amount,
        reason: reasonCode,
        date: this.state.today,
        by: user || "backoffice",
      };
      rec.writeOffs.push(entry);
      this._log(user, "settleShortfall", (rec.number || docId) + " · " + reasonCode);
      return entry;
    }
    /** Undo one. The rest is owed again, and the register says so. */
    undoSettleShortfall(kind, docId, writeOffId, user) {
      const { rec } = this._writeOffTarget(kind, docId);
      const list = rec.writeOffs || [];
      const i = list.findIndex((w) => w.id === writeOffId);
      if (i < 0) throw new Error("Ese cierre ya no existe");
      const [gone] = list.splice(i, 1);
      this._log(user, "undoSettleShortfall", (rec.number || docId) + " · " + gone.reason);
      return gone;
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
      /* No document may be paid more than it is owed (A4). Without this a
         4.000 € transfer matched against a 2.420 € invoice drove its balance
         to −1.580 € in silence, and a negative outstanding is not a number
         anybody reads as an error — it is a number that quietly changes what
         is owed to a supplier. Checked BEFORE the payment is pushed, or
         billOutstandingCents would already be counting it. */
      for (const a of rec.billAllocations) {
        const open = this.billOutstandingCents(a.billId);
        if (a.amountCents > open + 1)
          throw new Error(
            "Se intentan pagar " +
              a.amountCents +
              "c de un documento que sólo debe " +
              open +
              "c. Si el movimiento cubre varios documentos, repártelo entre ellos.",
          );
      }
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
          supplier: this.billSupplier(b).name,
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
      // BNK-06. Three kinds, and a CARD is deliberately one of them: its
      // statement imports as ordinary movements on its own account, so the
      // importer, the duplicate detection, the suggestion scoring and the
      // matching screen all apply to card purchases with no second
      // implementation to keep in step. The bank line that pays the card off
      // is an internal transfer that names the card it settles — see
      // markCardSettlement.
      const rec = Object.assign(
        { id: this._id("bank"), name: "", kind: "bank", iban: "", openingCents: 0 },
        a,
      );
      /* `till` is on its way out — schema v22 converts the stored ones, and
         the screens stop offering it in the same session that replaces what it
         was for (a cash box is a bank withdrawal awaiting its receipts, not a
         ledger of its own). The door stays open here until that replacement
         exists, because narrowing it first is what turns a rename into a
         half-migrated tree: the engine refusing what the seed still builds. */
      /* «till» IS NO LONGER CREATABLE, and is deliberately still READABLE.
         The operator's verdict on cash-box accounts was short — no need for
         them — and cash is now a withdrawal from a bank account (PK12-S7). A
         workspace saved before this, and the v1 migration fixture, still hold
         accounts of kind till and must still load: this guard runs on
         creation, never on read, so nothing stored is invalidated and no
         migration retypes a record. That is the reversible half of the change;
         an account somebody no longer wants is deleted through Configuración,
         which since PK12-S6c can actually do it. */
      if (!["bank", "card"].includes(rec.kind))
        throw new Error("Unknown account kind: " + rec.kind);
      this.state.bankAccounts.push(rec);
      this._log(user, "addBankAccount", rec.name);
      return rec;
    }
    /**
     * Why an account cannot simply be removed, or null when it can.
     *
     * A code rather than a sentence, and returned rather than thrown, for the
     * reason `_discardableMovement` and `billDeleteBlock` return codes: a
     * screen that must disable a button needs the reason before anybody
     * presses it, and «no» with nothing after it is a wall.
     */
    bankAccountDeleteBlock(id, opts) {
      const a = this.state.bankAccounts.find((x) => x.id === id);
      if (!a) throw new Error("Account not found");
      /* Checked FIRST because it is the one refusal that no confirmation can
         buy off. A line on another account is classified an internal transfer
         BECAUSE it names this card as what it settles; remove the card and
         that line silently becomes a cost again, double-counting every
         purchase already on it. That is a change to the accounts, not a
         cleanup, so it stays a wall whatever the operator asks for. */
      if (this.state.movements.some((m) => m.cardSettlement && m.cardSettlement.accountId === id))
        return "settled";
      /* Taking the movements too is a DIFFERENT act, and it is offered rather
         than assumed. "This account has history behind it" is the right answer
         to a stray click and the wrong answer to a demonstration workspace
         somebody now wants rid of — which is the case the operator actually
         hit: accounts deactivated because they could not be deleted, and then
         still on the screen, because deactivating was never what was wanted. */
      if (opts && opts.withMovements) {
        if (
          this.state.movements.some(
            (m) => m.accountId === id && this.bankPeriodClosed(m.accountingDate),
          )
        )
          return "closed-period";
        return null;
      }
      if (this.state.movements.some((m) => m.accountId === id)) return "has-movements";
      if ((this.state.importBatches || []).some((b) => b.accountId === id)) return "has-imports";
      return null;
    }
    /**
     * Remove an account that never held anything.
     *
     * The same rule the party file already applies to a company: deletion is
     * for a record that was created by mistake, not for one with history
     * behind it. An account carrying movements is not deleted — it is
     * DEACTIVATED, because its movements are reconciled against real
     * documents and removing the account they name would orphan every one of
     * them silently. So the two verbs are separate and the screen offers
     * whichever is honest.
     *
     * Until now there was neither: `addBankAccount` existed and nothing
     * removed, so a workspace that had been demonstrated on carried its demo
     * accounts for ever with no way to be rid of them.
     */
    deleteBankAccount(id, user, opts) {
      if (!this.state.bankAccounts.some((x) => x.id === id)) throw new Error("Account not found");
      const block = this.bankAccountDeleteBlock(id, opts);
      if (block) throw new Error("This account cannot be removed: " + block);
      /* The movements go through `resetAccountMovements`, not through a filter
         written here. That method already unwinds each reconciliation before
         dropping the row — so nothing is left claiming a bill was paid by a
         movement that no longer exists — and already clears the import
         batches that described them. Deleting the rows directly would leave
         both of those behind, which is the same orphaning this refused to do
         in the first place. The index is re-read afterwards: the reset does
         not touch this array today, and a delete that depends on that staying
         true is a delete that removes the wrong account the day it changes. */
      let movementsRemoved = 0;
      if (opts && opts.withMovements)
        movementsRemoved = this.resetAccountMovements(id, user).deleted;
      const i = this.state.bankAccounts.findIndex((x) => x.id === id);
      const [gone] = this.state.bankAccounts.splice(i, 1);
      this._log(user, "deleteBankAccount", gone.name);
      /* The account itself is returned, as before — callers pass it straight
         to a toast. What it also carries now is how much went with it, so a
         screen can say so without counting the rows again after they are
         gone. */
      gone.movementsRemoved = movementsRemoved;
      return gone;
    }
    /**
     * Keep the history, lose the account from the pickers.
     *
     * `active !== false` is the test everywhere, so an account that predates
     * this field is active — the same convention the party file uses, and the
     * reason neither needed a migration to introduce it.
     */
    setBankAccountActive(id, active, user) {
      const a = this.state.bankAccounts.find((x) => x.id === id);
      if (!a) throw new Error("Account not found");
      a.active = !!active;
      this._log(user, active ? "activateBankAccount" : "deactivateBankAccount", a.name);
      return a;
    }
    /** The accounts a picker should offer: everything still in use. */
    activeBankAccounts() {
      return this.state.bankAccounts.filter((a) => a.active !== false);
    }
    /**
     * The bank line that pays a card off, tied to the card it settles.
     *
     * The money truth of a card is: the PURCHASES are the costs (they live on
     * the card account and are matched to invoices there), and the bank's
     * monthly charge is NOT a cost — counting it too would count every card
     * purchase twice. So the settlement line is classified an internal
     * transfer, which the P&L already excludes, and it records WHICH card it
     * pays so the reader can walk from the bank line to the purchases it
     * covers. Refuses a target that is not a card, and refuses a movement
     * that itself sits on a card — a card cannot settle itself.
     */
    markCardSettlement(movId, cardAccountId, user) {
      const m = this.state.movements.find((x) => x.id === movId);
      if (!m) throw new Error("Movement not found");
      const card = this.state.bankAccounts.find((x) => x.id === cardAccountId);
      if (!card || card.kind !== "card") throw new Error("The settlement must name a card account");
      if (m.accountId === cardAccountId)
        throw new Error("A card cannot settle itself — pick the bank line that pays it");
      m.class = "internalTransfer";
      m.cardSettlement = { accountId: cardAccountId };
      m.status = m.status === "unallocated" ? "allocated" : m.status;
      this._log(user, "markCardSettlement", movId + " → " + card.name);
      return m;
    }
    /* =============== PK12-S7 — cash is a withdrawal, not an account ==========
       The operator described how cash actually works, and it is not a till:
       money is taken OUT of the bank, spent, and comes back as receipts; what
       is not spent is paid back IN. So the thing to be explained is the
       WITHDRAWAL, and it is explained by the documents it bought plus the
       deposit that returned the rest.

       A till account modelled the same money as a second balance to keep, and
       the operator's verdict on that was short: no need for them. Nothing here
       replaces the till with another container — the withdrawal is a bank line
       like every other, and the only new fact is what closes it. */
    /**
     * Declare a bank line to be cash taken out of the bank.
     *
     * Classified an internal transfer for `markCardSettlement`'s reason: at
     * the moment of the withdrawal nothing has been BOUGHT. The money is still
     * the company's, in a pocket instead of an account, and counting the
     * withdrawal as a cost would count it again when the receipts arrive.
     */
    markCashWithdrawal(movId, user) {
      const m = this.state.movements.find((x) => x.id === movId);
      if (!m) throw new Error("Movement not found");
      if (m.amountCents >= 0)
        throw new Error("A cash withdrawal takes money out — pick the line that leaves the bank");
      const acc = this.state.bankAccounts.find((a) => a.id === m.accountId);
      if (acc && acc.kind === "card")
        throw new Error("Cash comes out of an account, not off a card");
      this.classifyMovement(m.id, "internalTransfer", user);
      m.cashWithdrawal = { at: this.state.today, by: user || "backoffice" };
      this._log(user, "markCashWithdrawal", movId);
      return m;
    }
    /**
     * What is still unexplained about a withdrawal.
     *
     * Three ways money leaves a withdrawal and they are added, not chosen
     * between: the receipts it paid for, the cash handed back to the bank, and
     * whatever is still in somebody's pocket. The last is the number the
     * screen has to show, because "the rest is still out there" is a real and
     * ordinary state, not an error.
     */
    cashWithdrawalState(movId) {
      const m = this.state.movements.find((x) => x.id === movId);
      if (!m) throw new Error("Movement not found");
      const totalCents = Math.abs(cents(m.amountCents));
      const documentedCents = sum((m.matched && m.matched.documents) || [], (d) =>
        cents(d.amountCents),
      );
      const returnedCents = sum(
        this.state.movements.filter((x) => x.cashReturn && x.cashReturn.withdrawalId === movId),
        (x) => Math.abs(cents(x.amountCents)),
      );
      return {
        totalCents,
        documentedCents,
        returnedCents,
        outstandingCents: totalCents - documentedCents - returnedCents,
      };
    }
    /**
     * The unspent cash going back in, tied to the withdrawal it closes.
     *
     * Classified an internal transfer, and that is the whole point: the
     * company's own money returning to its own account is not revenue, and a
     * deposit left unclassified reads as income in every report that sums
     * incoming lines. The same trap `markCardSettlement` exists to avoid, at
     * the other end of the same journey.
     *
     * Refuses to return more than is left. A withdrawal of 1.000 that already
     * has 700 of receipts against it has 300 outstanding; a 400 deposit
     * pointed at it is either the wrong deposit or the wrong withdrawal, and
     * both are worth stopping before the arithmetic stops adding up.
     */
    markCashReturn(depositMovId, withdrawalMovId, user) {
      const d = this.state.movements.find((x) => x.id === depositMovId);
      const w = this.state.movements.find((x) => x.id === withdrawalMovId);
      if (!d || !w) throw new Error("Movement not found");
      if (d.id === w.id) throw new Error("A withdrawal cannot return to itself");
      if (d.amountCents <= 0)
        throw new Error("The return puts money back — pick the line that enters the bank");
      if (!w.cashWithdrawal) throw new Error("That movement is not a cash withdrawal");
      if (d.cashReturn && d.cashReturn.withdrawalId !== withdrawalMovId)
        throw new Error("That deposit is already the return of another withdrawal");
      const st = this.cashWithdrawalState(withdrawalMovId);
      if (cents(d.amountCents) > st.outstandingCents + 1)
        throw new Error("The return is larger than what is left of the withdrawal");
      this.classifyMovement(d.id, "internalTransfer", user);
      d.cashReturn = {
        withdrawalId: withdrawalMovId,
        at: this.state.today,
        by: user || "backoffice",
      };
      this._log(user, "markCashReturn", depositMovId + " → " + withdrawalMovId);
      return d;
    }
    /** Untie a return. The deposit goes back to being an unexplained line. */
    clearCashReturn(depositMovId, user) {
      const d = this.state.movements.find((x) => x.id === depositMovId);
      if (!d) throw new Error("Movement not found");
      if (!d.cashReturn) throw new Error("That movement is not the return of a withdrawal");
      delete d.cashReturn;
      d.class = null;
      d.excludedFromPL = false;
      d.status = "unallocated";
      this._log(user, "clearCashReturn", depositMovId);
      return d;
    }
    /**
     * Every cash withdrawal in a quarter, with what explains it.
     *
     * This is what `cashRecords` in the quarterly package is derived from now.
     * It used to be "every movement on an account of kind till", which asked
     * the accounts what cash was instead of asking the money.
     */
    cashWithdrawals(quarter) {
      return this.state.movements
        .filter((m) => m.cashWithdrawal && quarterOf(m.accountingDate) === quarter)
        .map((m) => ({ ...m, cash: this.cashWithdrawalState(m.id) }));
    }

    /* ============ PK7-D — a transfer is a PAIR, and the product must hold it ==
       `findInternalTransfers` has always proposed pairs and the bulk button
       has always marked both legs. Everything else treated a transfer as two
       unrelated facts: the single-row path marked one leg and left the other
       in the queue, nothing recorded that the two belonged together, and so
       undoing one could never undo the other. Two halves of one event, and the
       product knew about neither half's twin.

       The link is stored on both movements. That is what makes «Deshacer»
       able to act on both legs afterwards — a screen cannot re-derive the pair
       later, because by then both are out of the queue the matcher reads. */
    markInternalTransfer(outMovId, inMovId, user) {
      const a = this.state.movements.find((x) => x.id === outMovId);
      const b = this.state.movements.find((x) => x.id === inMovId);
      if (!a || !b) throw new Error("Movement not found");
      if (a.id === b.id) throw new Error("Un movimiento no puede ser su propio traspaso");
      if (a.accountId === b.accountId)
        throw new Error(
          "Los dos movimientos están en la misma cuenta: eso es un pago y su devolución, no un traspaso.",
        );
      if (a.amountCents > 0 === b.amountCents > 0)
        throw new Error("Un traspaso tiene una salida y una entrada, no dos del mismo signo");
      for (const m of [a, b]) {
        if (m.transferPair && m.transferPair.withMovementId !== (m === a ? b.id : a.id))
          throw new Error("Ese movimiento ya está emparejado con otro traspaso");
      }
      for (const [m, other] of [
        [a, b],
        [b, a],
      ]) {
        this.classifyMovement(m.id, "internalTransfer", user);
        m.transferPair = {
          withMovementId: other.id,
          at: this.state.today,
          by: user || "backoffice",
        };
      }
      this._log(user, "markInternalTransfer", a.id + " ↔ " + b.id);
      return { out: a, in: b };
    }
    /** Undo it — on BOTH legs, whichever one the person pressed. */
    unmarkInternalTransfer(movId, user) {
      const m = this.state.movements.find((x) => x.id === movId);
      if (!m) throw new Error("Movement not found");
      const other = m.transferPair
        ? this.state.movements.find((x) => x.id === m.transferPair.withMovementId)
        : null;
      const legs = other ? [m, other] : [m];
      for (const leg of legs) {
        if (this.bankPeriodClosed(leg.accountingDate))
          throw new Error("El periodo está cerrado — reábrelo antes de deshacer");
      }
      for (const leg of legs) {
        leg.transferPair = null;
        leg.class = null;
        leg.excludedFromPL = false;
        leg.status = "unallocated";
      }
      this._log(user, "unmarkInternalTransfer", legs.map((x) => x.id).join(" ↔ "));
      return legs;
    }

    /* ==================== PK7-D — Conciliados: what is explained, and HOW ====
       The queue answers "what is left". Nothing answered "what did I already
       decide, and on what grounds" — so a decision made in a hurry could only
       be found by remembering it. Every row here carries its own way back.

       The order of the tests below is the order of specificity, not the order
       of `_discardableMovement`, which lumps everything non-deletable under
       "matched" because for ITS purpose the distinction does not matter. Here
       it is the whole point. */
    movementExplanation(m) {
      if (m.matched && (m.matched.documents || []).length)
        return {
          how: "matched",
          detail: m.matched.documents
            .map((d) => {
              const rec = d.billId
                ? this.state.bills.find((b) => b.id === d.billId)
                : this.state.invoices.find((i) => i.id === d.invoiceId);
              return (rec && rec.number) || d.billId || d.invoiceId;
            })
            .join(" + "),
          undoable: true,
        };
      if (m.cardSettlement) {
        const card = this.state.bankAccounts.find((a) => a.id === m.cardSettlement.accountId);
        return { how: "cardSettlement", detail: (card && card.name) || "", undoable: true };
      }
      if (m.transferPair) {
        const other = this.state.movements.find((x) => x.id === m.transferPair.withMovementId);
        const acc = other && this.state.bankAccounts.find((a) => a.id === other.accountId);
        return { how: "internalTransfer", detail: (acc && acc.name) || "", undoable: true };
      }
      if (m.class === "internalTransfer")
        return { how: "internalTransfer", detail: "", undoable: true };
      if ((m.allocations || []).length) {
        const detail = m.allocations
          .map((a) => (a.projectId ? this.project(a.projectId).code : a.overheadCategory || ""))
          .filter(Boolean)
          .join(", ");
        return { how: "allocated", detail, undoable: true };
      }
      if (m.unbacked) {
        const r = this.listAll("unbackedReasons").find((x) => x.code === m.unbacked.reason);
        return { how: "unbacked", detail: (r && r.es) || m.unbacked.reason || "", undoable: true };
      }
      if (m.needsDoc === false && m.docRef)
        return { how: "receipted", detail: m.docRef, undoable: true };
      if (m.class) return { how: "classified", detail: m.class, undoable: true };
      // Explained by nothing except the seal over it: there is no decision to
      // undo, and saying so is more honest than offering a button that would
      // have to refuse.
      if (this.bankPeriodClosed(m.accountingDate))
        return { how: "closedPeriod", detail: "", undoable: false };
      return null;
    }
    /** Everything already explained, newest first, with how and its way back. */
    explainedMovements(from, to, accountId) {
      const out = [];
      for (const m of this.state.movements) {
        if (accountId && m.accountId !== accountId) continue;
        if (from && m.accountingDate < from) continue;
        if (to && m.accountingDate > to) continue;
        const e = this.movementExplanation(m);
        if (!e) continue;
        out.push({
          id: m.id,
          accountId: m.accountId,
          accountingDate: m.accountingDate,
          concept: m.concept || m.merchantText || "",
          counterparty: m.counterparty || "",
          amountCents: m.amountCents,
          how: e.how,
          detail: e.detail,
          undoable: e.undoable && !this.bankPeriodClosed(m.accountingDate),
        });
      }
      return out.sort((a, b) => String(b.accountingDate).localeCompare(String(a.accountingDate)));
    }
    /**
     * One «Deshacer», whatever the explanation was.
     *
     * A screen that lists six kinds of decision and offers six different ways
     * back is a screen that will grow a seventh kind and forget the seventh
     * way. The dispatch belongs where the kinds are decided.
     *
     * SAFETY PROPERTY, and the reason this package could be built at all:
     * undoing an explanation must not move project cost. A matched movement
     * contributed nothing to `actualCostCents` — the bill it paid did — so
     * unwinding the payment must leave the project exactly where it was.
     */
    unexplainMovement(movId, user) {
      const m = this.state.movements.find((x) => x.id === movId);
      if (!m) throw new Error("Movement not found");
      if (this.bankPeriodClosed(m.accountingDate))
        throw new Error("El periodo está cerrado — reábrelo antes de deshacer");
      const e = this.movementExplanation(m);
      if (!e) throw new Error("Ese movimiento no tiene nada que deshacer");
      if (!e.undoable) throw new Error("Sólo lo cierra el periodo: reábrelo para poder tocarlo");
      if (e.how === "internalTransfer" && m.transferPair)
        return this.unmarkInternalTransfer(movId, user);
      if (e.how === "matched") return this.unmatchMovement(movId, user);
      /* Everything else is a flag or a classification this layer set, and the
         way back is to clear ALL of it — not to call unmatch, which would
         void payments that were never created, and not to clear only
         whichever ONE field `movementExplanation` picked to report. A bulk
         classification writes an overhead category AND an unbacked reason
         together (PK7-E — "a class and a reason", the operator's own words
         for this exact case), and the explanation reports only "allocated"
         because that check runs first; clearing allocations alone would have
         left `unbacked` behind, and the row would have come back explained a
         second time instead of returning to the queue. Deshacer promised to
         be ONE press regardless of how many flags a screen wrote. */
      if (e.how === "receipted") {
        m.needsDoc = true;
        m.docRef = null;
        m.docKey = null;
      }
      m.unbacked = null;
      m.cardSettlement = null;
      m.allocations = [];
      m.class = null;
      m.excludedFromPL = false;
      m.status = "unallocated";
      this._log(user, "unexplainMovement", movId + " · " + e.how);
      return m;
    }

    /**
     * The statement's OWN arithmetic, read off the file it came in.
     *
     * Every real export carries a running balance beside each amount — BBVA
     * calls the column SALDO — and the parser has always stored it, on every
     * movement, and nothing has ever read it back. That omission is defect 111
     * of the acceptance test: `accountBalanceCents` is `openingCents + Σ`, and
     * `openingCents` defaults to zero, so importing a statement that begins
     * mid-history produces a balance short by exactly the money the account
     * held before the first row. On the operator's own file: the bank says
     * 13.764,37 and the product said −10.235,63, the difference being the
     * 24.000,00 nobody had told it about.
     *
     * The file answers it itself. The chronologically first row knows what the
     * balance was before it (`saldo − importe`), the last row knows what it
     * became, and the two must be joined by the sum of everything between. If
     * they are not, the file was not read completely — which is worth refusing
     * an import over, because the alternative is a register that looks right.
     *
     * Endpoints and the sum, deliberately, rather than checking every row
     * against the one before it. The failures worth refusing an import over —
     * a dropped row, a misparsed amount, a sign read backwards — all move the
     * sum, so all are caught. A per-row chain would additionally catch a typo
     * in a middle balance, which changes nothing (balances are evidence, only
     * amounts are imported), and would reject a perfectly good file whenever
     * the bank lists two movements of the same date in an order that is not
     * the order it applied them. Refusing a valid statement is the worse
     * error of the two.
     *
     * Returns null rather than guessing when the rows carry no balance at all
     * (an older export, a format with no such column): unverifiable is a
     * different answer from wrong, and only one of them should block anybody.
     */
    statementBalance(rows) {
      const list = (rows || []).filter((r) => r && r.accountingDate);
      if (!list.length) return null;
      // Every row must carry one. A chain with a hole in it cannot be checked,
      // and pretending otherwise would verify a subset and call it the file.
      if (list.some((r) => r.balanceCents == null)) return null;
      /* Statements arrive newest-first as often as oldest-first — BBVA exports
         descending — so the direction is read from the rows rather than
         assumed. Ties on a date keep their file order, which is the only
         evidence available about the sequence within a day. */
      const descending =
        list.length > 1 && list[0].accountingDate > list[list.length - 1].accountingDate;
      const chrono = descending ? list.slice().reverse() : list.slice();
      const first = chrono[0];
      const last = chrono[chrono.length - 1];
      const openingCents = cents(first.balanceCents) - cents(first.amountCents);
      const closingCents = cents(last.balanceCents);
      const sumCents = sum(list, (r) => cents(r.amountCents));
      const dates = list.map((r) => r.accountingDate).sort();
      return {
        openingCents,
        closingCents,
        sumCents,
        closes: openingCents + sumCents === closingCents,
        from: dates[0],
        to: dates[dates.length - 1],
      };
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
      /* Counted, not merely seen. Two transactions can be identical in date,
         amount and concept and still be two transactions: a real statement
         from this tenant pays two people 500 € of payroll on the same day,
         twice over. Treating the second as a duplicate of the first dropped
         1.000 € from the register and reported it as tidiness.
         So the question is not "has this key appeared?" but "how many of
         this key does the register already hold?" — the excess is the
         duplicate. Re-importing the same statement still finds every row a
         duplicate, because the counts then match exactly. */
      const held = new Map();
      const idOf = new Map();
      for (const m of existing) {
        const k = key(m);
        held.set(k, (held.get(k) || 0) + 1);
        if (!idOf.has(k)) idOf.set(k, m.id);
      }
      const fresh = [];
      const duplicates = [];
      for (const r of rows) {
        const k = key(r);
        const left = held.get(k) || 0;
        if (left > 0) {
          held.set(k, left - 1);
          duplicates.push({ row: r, existingId: idOf.get(k) || null });
        } else fresh.push(r);
      }
      /* A closed period is a statement somebody has signed off. Until now the
         importer wrote into one without a word — which is how 477 movements
         landed inside a sealed 2026 and could then not be taken out again,
         the seal refusing the undo it had never refused the import. */
      const closedRows = rows.filter((r) => this.bankPeriodClosed(r.accountingDate)).length;
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
        closedRows,
        overlapsExistingPeriod: overlaps,
        from: dates[0] || null,
        to: dates[dates.length - 1] || null,
        /* Computed over ALL rows, never over `fresh`: the running balance is a
           chain, and a chain with the duplicates removed does not join up. The
           caller hands this straight back to importMovements, which is why it
           is returned rather than recomputed there from the rows it writes. */
        statement: this.statementBalance(rows),
      };
    }
    importMovements(accountId, rows, user, { batch = true, statement = null } = {}) {
      // BNK-01: retain all export fields
      /* Every import is a batch, and the batch is remembered. An import is the
         one act in this product that writes hundreds of records at once from a
         file nobody has read line by line, so it is also the one act most
         likely to be wrong — a mis-parsed column, the wrong account, the wrong
         file. Until this existed there was no way back: 477 movements landed
         in a real register with amounts a parser bug had multiplied into the
         quadrillions, and nothing in the product could remove them. */
      const sealed = rows.filter((r) => this.bankPeriodClosed(r.accountingDate));
      if (sealed.length)
        throw new Error(
          sealed.length +
            " movimientos caen en un periodo cerrado — reábrelo en Conciliación antes de importar",
        );
      /* A statement that does not add up is a statement that was not read.
         Refusing it is the whole point of defect 111: the alternative is a
         register that looks right, which is the failure nobody catches. */
      if (statement && !statement.closes)
        throw new Error(
          "El extracto no cuadra consigo mismo: saldo inicial " +
            statement.openingCents +
            "c + movimientos " +
            statement.sumCents +
            "c ≠ saldo final " +
            statement.closingCents +
            "c. No se importa nada.",
        );
      const acc = this.state.bankAccounts.find((a) => a.id === accountId);
      /* The opening balance can only be learned from the FIRST statement an
         account ever receives. A later file starts mid-history, so its own
         opening is not the account's — reading it there would move the floor
         under every movement already filed. */
      const hadMovements = this.state.movements.some((m) => m.accountId === accountId);
      const openingBefore = acc ? acc.openingCents : 0;
      if (statement && acc && !hadMovements) acc.openingCents = statement.openingCents;
      const importId = this._id("imp");
      const out = rows.map((r) => {
        const rec = {
          id: this._id("mov"),
          accountId,
          importId,
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
          workerId: r.workerId || null,
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
      /* THE CHECK THE ACCEPTANCE TEST ASKED FOR, and the reason it runs here
         rather than in the preview: the preview can only predict, this knows.
         Reconciling against `cashCount` — the same arqueo the cash screen
         prints — means the number verified is the number the operator will
         read, not a parallel calculation that agrees with itself.
         Verified AFTER writing and rolled back on failure, because duplicate
         suppression makes "what will the balance be" genuinely hard to predict
         and genuinely easy to compute once the rows are in.

         ONLY WHEN THIS IMPORT SET THE OPENING BALANCE. The comparison asks
         "does the account agree with the bank", and that question is only
         answerable when the account's whole history came from this statement's
         lineage. An account already holding movements entered by hand, or
         seeded, or imported from a different range, will legitimately disagree
         with any one statement's closing figure — refusing there would block
         good imports to protect against nothing. The file's own arithmetic,
         checked above, is what actually guards defect 111, and it is checked
         every time. */
      if (statement && acc && !hadMovements) {
        const after = this.cashCount(accountId, null, statement.to).closingCents;
        if (after !== statement.closingCents) {
          this.state.movements = this.state.movements.filter((m) => m.importId !== importId);
          acc.openingCents = openingBefore;
          throw new Error(
            "Tras importar, el saldo a " +
              statement.to +
              " sería " +
              after +
              "c y el extracto dice " +
              statement.closingCents +
              "c. No se ha importado nada.",
          );
        }
      }
      if (batch && out.length)
        this.state.importBatches.push({
          id: importId,
          accountId,
          at: this.today,
          count: out.length,
          from: out.reduce((a, m) => (a && a < m.accountingDate ? a : m.accountingDate), null),
          to: out.reduce((a, m) => (a && a > m.accountingDate ? a : m.accountingDate), null),
          by: user || "system",
        });
      this._log(user, "importMovements", rows.length + " movs");
      return out;
    }
    /**
     * Can this movement be taken back out again?
     *
     * Only while it is still nothing but a line off a statement. Once it has
     * been matched, allocated, or deliberately marked as needing no invoice,
     * it carries a decision somebody made, and a decision is not the
     * importer's to discard. A closed period is closed.
     */
    _discardableMovement(m) {
      if (m.status !== "unallocated" || m.matched) return "matched";
      if ((m.allocations || []).length) return "allocated";
      if (m.unbacked) return "unbacked";
      if (m.needsDoc === false && m.docRef) return "receipted";
      if (this.bankPeriodClosed(m.accountingDate)) return "closedPeriod";
      return null;
    }
    /**
     * What an undo would do, and — when it would do nothing — why.
     *
     * "Kept: 477" with no reason is not an explanation, it is a wall. The
     * count that matters to somebody staring at a bad import is the one
     * blocking it, and the reason names the screen where it can be lifted.
     */
    discardPreview(accountId) {
      const here = this.state.movements.filter((m) => m.accountId === accountId);
      const byReason = {};
      let deletable = 0;
      for (const m of here) {
        const why = this._discardableMovement(m);
        if (!why) deletable++;
        else byReason[why] = (byReason[why] || 0) + 1;
      }
      return { total: here.length, deletable, kept: here.length - deletable, byReason };
    }
    /**
     * Undo an import: remove the movements it created that are still untouched.
     *
     * Never silently partial — the caller is told exactly how many were kept
     * and why, because "undone" with three matched movements left behind is a
     * different fact from "undone".
     */
    undoImport(importId, user) {
      const batch = this.state.importBatches.find((b) => b.id === importId);
      if (!batch) throw new Error("Import not found");
      return this._discard(
        this.state.movements.filter((m) => m.importId === importId),
        user,
        () => {
          this.state.importBatches = this.state.importBatches.filter((b) => b.id !== importId);
        },
      );
    }
    /**
     * Remove untouched movements from an account — the way back for a bad
     * import that happened before imports were batched, and for a statement
     * loaded onto the wrong account.
     */
    discardMovements(accountId, { from, to } = {}, user) {
      const target = this.state.movements.filter(
        (m) =>
          m.accountId === accountId &&
          (!from || m.accountingDate >= from) &&
          (!to || m.accountingDate <= to),
      );
      return this._discard(target, user);
    }
    _discard(candidates, user, after) {
      const kept = [];
      const doomed = new Set();
      for (const m of candidates) {
        const why = this._discardableMovement(m);
        if (why) kept.push({ id: m.id, why });
        else doomed.add(m.id);
      }
      this.state.movements = this.state.movements.filter((m) => !doomed.has(m.id));
      // A batch is only forgotten when nothing of it is left to point at.
      if (after && !kept.length) after();
      this._log(user, "discardMovements", doomed.size + " movs");
      return { deleted: doomed.size, kept: kept.length, keptDetail: kept.slice(0, 20) };
    }
    /**
     * What emptying an account would cost, before anybody empties it.
     *
     * `discardPreview` answers the neighbouring question — how much of this is
     * still untouched — and its answer is deliberately conservative. This one
     * counts what would have to be UNDONE, because that is the number a person
     * needs in front of them before agreeing to it.
     */
    resetAccountPreview(accountId) {
      const here = this.state.movements.filter((m) => m.accountId === accountId);
      return {
        total: here.length,
        closed: here.filter((m) => this.bankPeriodClosed(m.accountingDate)).length,
        reconciled: here.filter((m) => m.matched).length,
        allocated: here.filter((m) => !m.matched && (m.allocations || []).length).length,
      };
    }
    /**
     * Empty ONE account of its movements — the reset a trial run needs.
     *
     * Deliberately not `discardMovements`. That method keeps everything anyone
     * has touched, which is exactly right for a statement loaded onto the
     * wrong account and exactly wrong for starting a test over: the movements
     * a person most wants gone afterwards are the ones they spent the trial
     * reconciling. Undoing them one at a time was the only way, and nobody
     * does that four hundred times.
     *
     * So this one unwinds rather than skips — `unmatchMovement` first, which
     * voids the payment or collection the reconciliation created, so nothing
     * is left claiming a bill was paid by a movement that no longer exists.
     *
     * ONE refusal, and it is not negotiable: a closed period. That is not a
     * precaution about lost work, it is an accounting boundary somebody
     * deliberately drew, and a reset is not a reason to cross it. The period
     * is reopened first, in the open, or the movements stay.
     *
     * Scoped to a single account on purpose. "Clear the movements" is a
     * sentence about a database; every real version of it is about one
     * statement, one card, one till, and an account at a time is a mistake
     * that can be re-imported rather than one that cannot.
     */
    resetAccountMovements(accountId, user) {
      const acc = this.state.bankAccounts.find((a) => a.id === accountId);
      if (!acc) throw new Error("Account not found");
      const here = this.state.movements.filter((m) => m.accountId === accountId);
      const closed = here.filter((m) => this.bankPeriodClosed(m.accountingDate));
      /* The count is NOT in the message, by `closeBankPeriod`'s own rule three
         methods up: one distinct string per number the queue can hold is a set
         no dictionary can translate. The screen shows the number, next to the
         button, before anybody presses it. */
      if (closed.length)
        throw new Error(
          "The account has movements in a closed period — reopen it before emptying the account",
        );
      let unwound = 0;
      for (const m of here)
        if (m.matched) {
          this.unmatchMovement(m.id, user);
          unwound++;
        }
      const ids = new Set(here.map((m) => m.id));
      this.state.movements = this.state.movements.filter((m) => !ids.has(m.id));
      // The batches described movements that are gone; a list of imports whose
      // rows no longer exist is a menu of dead undo buttons.
      this.state.importBatches = (this.state.importBatches || []).filter(
        (b) => b.accountId !== accountId,
      );
      this._log(user, "resetAccountMovements", acc.name + " · " + here.length + " movs");
      return { deleted: here.length, unwound };
    }
    /**
     * BNK-02: enter a budget/project number → the cost lands on the project.
     *
     * `where` carries the partida and subpartida. It is a fourth argument
     * rather than a rewrite because the shape of this door is right — one
     * movement, one project — and only the destination was underspecified.
     *
     * The allocation now goes through `withAccountCode` like every other. It
     * used to be written straight onto the movement, which is exactly why it
     * was the one door in seven that the assignment rule did not reach: a
     * choke point only chokes what passes through it, and this did not.
     */
    allocateMovementToProject(movId, ref, kind, where, user) {
      const m = this.state.movements.find((x) => x.id === movId);
      const p =
        this.state.projects.find((x) => x.code === ref || x.budgetNumber === ref) ||
        this.project(ref);
      if (!LISTS.costKinds.includes(kind || "material")) throw new Error("Unknown cost kind");
      const w = where || {};
      m.class = m.amountCents < 0 ? "projectCost" : "customerReceipt";
      m.allocations = [
        this.withAccountCode({
          projectId: p.id,
          chapterNum: w.chapterNum || null,
          lineId: w.lineId || null,
          kind: kind || "material",
          amountCents: Math.abs(m.amountCents),
        }),
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
      m.allocations = allocations.map((a) => this.withAccountCode(a));
      /* The class follows the destinations rather than being assumed. A split
         that names no project is a general expense, and calling it «coste de
         obra» put a label on the screen that the allocation underneath it
         contradicted — harmless to the totals, because the project filter
         finds nothing, and wrong to read, which is its own defect. */
      m.class = allocations.some((a) => a.projectId) ? "projectCost" : "overhead";
      m.status = "allocated";
      this._log(user, "splitMovement", movId);
      return m;
    }
    /* =========================== GAP 13 — costs that land on an account ====
       §6's money chain has carried one ✗ since S0: a cost can reach an
       ACCOUNT rather than a project — insurance, utilities, marketing, fees,
       vehicles, rent — and no field carried it. The rest of the chain closed
       long ago; this is the last structural break in it. */

    /** The account a cost belongs to, resolved from where it was allocated. */
    resolveAccountCode(alloc) {
      // An explicit code always wins. Somebody who has typed one has looked at
      // the invoice; a rule has only looked at a category.
      if (alloc.accountCode) return alloc.accountCode;
      const accounts = this.listAll("accounts");
      if (alloc.overheadCategory) {
        const byOverhead = accounts.find((a) => a.overhead === alloc.overheadCategory);
        return byOverhead ? byOverhead.code : null;
      }
      if (alloc.projectId) {
        const byKind = accounts.find((a) => a.cost === (alloc.kind || "material"));
        return byKind ? byKind.code : null;
      }
      return null;
    }
    /**
     * A cost that names a subpartida, checked against the budget it names it from.
     *
     * `lineId` is the one level below the chapter, and it is OPTIONAL
     * everywhere: every allocation written before this field existed is valid
     * without touching it, and a cost that only knows its chapter stays legal
     * forever. But a lineId that IS given has to be true, because the whole
     * point of the field is that block-5 reporting will trust it — so it must
     * name a line of the project's accepted version, and if a chapter is also
     * named, the line must belong to that chapter. A cost filed against a
     * subpartida from the wrong chapter is precisely the kind of wrong that no
     * report ever surfaces: both numbers exist, both look plausible, and the
     * drill-down quietly disagrees with the chapter totals above it.
     *
     * When the chapter is NOT given, it is filled in from the line — a subpartida
     * implies its chapter, and asking the operator to say the same thing twice
     * is how the two answers end up different.
     */
    _lineAlloc(alloc) {
      if (!alloc.lineId) {
        /* EVERY EURO HAS A HOME, and for a project cost that home is a
           subpartida. The operator's rule, in their words: a cost goes to a
           project or to a general expense, and if it is a project it carries
           partida AND subpartida by obligation.
           
           This line used to normalise the gap away — `lineId: null`, stored,
           and nothing further asked. The consequence was money that reached a
           job and stopped: `unassignedChapterCosts` exists to itemise exactly
           that, and the per-subpartida table shows the whole cost of the demo
           seed's Demoliciones sitting under «sin subpartida» with no budget to
           compare it against. A total nobody can place is not a total.
           
           There is deliberately NO exception for a line with no natural
           subpartida — a delivery charge, a whole-invoice discount. The answer
           settled with the operator is that such a cost either belongs to a
           partida the budget should carry (administrative expenses, with
           logistics under it) or it is not a project cost at all and goes to
           the general-expense list. Attributing it proportionally across the
           lines it accompanies was the alternative, and it invents a
           distribution nobody chose in order to satisfy a rule.
           
           An OVERHEAD cost still passes: it names no project, so there is no
           subpartida for it to be missing. */
        if (alloc.projectId) {
          /* ONE EXEMPTION, AND IT IS NOT A LOOPHOLE. A quick repair job
             (`createQuickProject`, PRJ-08) is created without a budget: its
             baseline is a single chapter that IS the whole job, with no lines
             at all. There is no subpartida to name and no finer place for the
             money to hide — chapter level is already the finest grain that
             exists on it, so demanding one would be ceremony that makes a
             small repair unbookable.

             Scoped to `budgetId`, not to the accepted version: every project
             built through `createProjectFromAcceptance` has both, so this
             admits quick jobs and nothing else. */
          const proj = this.project(alloc.projectId);
          if (proj.budgetId) throw new Error("A project cost must name its partida and subpartida");
          return { ...alloc, lineId: null };
        }
        // Normalised to null (not undefined, not "") so every stored
        // allocation has the same shape whichever door it came through.
        return { ...alloc, lineId: null };
      }
      if (!alloc.projectId)
        throw new Error("A subpartida belongs to a project; an overhead cost cannot name one");
      const p = this.project(alloc.projectId);
      if (!p.budgetId || !p.acceptedVersionId)
        throw new Error("This project has no accepted budget to name a subpartida from");
      let hit = null;
      for (const { budgetId, version } of this._projectVersions(p)) {
        hit = this.findLine(budgetId, alloc.lineId, version.id);
        if (hit) break;
      }
      if (!hit) throw new Error("Unknown subpartida for this project's accepted budget");
      const chapterNum = String(hit.chapter.num);
      if (alloc.chapterNum && String(alloc.chapterNum) !== chapterNum)
        throw new Error(
          "Subpartida " +
            hit.line.num +
            " belongs to chapter " +
            chapterNum +
            ", not " +
            alloc.chapterNum,
        );
      return { ...alloc, lineId: alloc.lineId, chapterNum };
    }
    /** The same allocation with its account resolved onto it. */
    withAccountCode(alloc) {
      const a = this._lineAlloc(alloc);
      const code = this.resolveAccountCode(a);
      return code ? { ...a, accountCode: code } : a;
    }
    /**
     * Cost by account over a period — the roll-up that proves the wiring, and
     * the thing the gestoría package and ADM-09 both want.
     *
     * Reads bills, captured documents and bank/till movements together,
     * because rule 07 is about every cost and those are the three doors a cost
     * comes in through. A row with no resolvable account is reported under
     * `unassigned` rather than dropped: an account roll-up that quietly loses
     * money is worse than one that admits it.
     */
    accountLedger(from, to) {
      const inRange = (d) => (!from || d >= from) && (!to || d <= to);
      const byCode = {};
      let unassignedCents = 0;
      const add = (alloc, date, amountCents) => {
        if (!inRange(date)) return;
        const code = this.resolveAccountCode(alloc);
        if (!code) {
          unassignedCents += amountCents;
          return;
        }
        byCode[code] = (byCode[code] || 0) + amountCents;
      };
      for (const b of this.state.bills)
        for (const a of b.allocations)
          add(a, b.date, b.creditNoteFor ? -a.amountCents : a.amountCents);
      for (const c of this.state.captured)
        for (const a of c.allocations)
          add(a, (c.confirmed && c.confirmed.date) || c.capturedAt, a.amountCents);
      for (const m of this.state.movements) {
        if (m.excludedFromPL) continue;
        for (const a of m.allocations || []) add(a, m.accountingDate, a.amountCents);
      }
      const accounts = this.listAll("accounts");
      return {
        rows: Object.keys(byCode)
          .sort()
          .map((code) => {
            const acc = accounts.find((a) => a.code === code);
            return { code, name: acc ? acc.es : code, amountCents: byCode[code] };
          }),
        unassignedCents,
        totalCents: Object.values(byCode).reduce((s, v) => s + v, 0),
      };
    }
    /* =========================== ADM-06 — petty cash ======================
       The simplest screen in the document, and the one that most rewards not
       being clever: a till is a bank account whose statement nobody imports,
       so entries are typed and the count at the foot is what proves them. */

    /* ADM-06 records cash through the EXISTING `recordCashMovement` further
       down this class (BNK-07), not through a second one added here.

       This session briefly shipped a duplicate, and the class swallowed it
       without a word: a later definition of the same name silently wins, so
       the new method was dead the moment it was written and the tests failed
       against behaviour nobody could find. S1a wrote this hazard down after
       hitting it once; it is written down again here because writing it down
       once was demonstrably not enough. Before adding a method to this class,
       grep for its name. */
    /**
     * The arqueo at the foot of ADM-06: opening, in, out, closing.
     *
     * `closing` is computed from the opening balance and the period's
     * movements rather than read from anywhere, because that IS the count —
     * a stored closing balance is a number nobody counted.
     */
    cashCount(accountId, from, to) {
      const acc = this.state.bankAccounts.find((a) => a.id === accountId);
      if (!acc) throw new Error("Account not found");
      const movs = this.state.movements.filter((m) => m.accountId === accountId);
      // With no `from`, NOTHING is before: an unbounded count starts at the
      // account's opening balance. Writing this as `!from || …` made every
      // movement "before" the period and folded the whole history into the
      // opening figure — the count still balanced, which is what made it
      // dangerous.
      const before = from ? movs.filter((m) => m.accountingDate < from) : [];
      const inPeriod = movs.filter(
        (m) => (!from || m.accountingDate >= from) && (!to || m.accountingDate <= to),
      );
      const openingCents = (acc.openingCents || 0) + before.reduce((s, m) => s + m.amountCents, 0);
      const inCents = inPeriod
        .filter((m) => m.amountCents > 0)
        .reduce((s, m) => s + m.amountCents, 0);
      const outCents = inPeriod
        .filter((m) => m.amountCents < 0)
        .reduce((s, m) => s + Math.abs(m.amountCents), 0);
      return {
        openingCents,
        inCents,
        outCents,
        closingCents: openingCents + inCents - outCents,
        awaitingDoc: inPeriod.filter((m) => m.needsDoc).length,
        count: inPeriod.length,
      };
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
    /**
     * One movement against SEVERAL documents — the case a single transfer
     * paying two invoices has always been, and which the product got wrong.
     *
     * `matchMovement` takes one document and creates the payment for the whole
     * movement. Calling it once per document — which is exactly what the
     * reconciliation screen did with a combined proposal — meant the first
     * document was paid the entire amount and every later one was paid
     * nothing, because a payment for the movement already existed by then and
     * the guard skipped it. The invoice left unpaid still looked unpaid; the
     * first was overpaid; and `matched` named only whichever document happened
     * to be processed last. Nothing failed and nothing said so.
     *
     * So the split is stated, not inferred: each document is named with the
     * amount of THIS movement that settles it, one payment (or one collection)
     * carries them all, and the totals have to agree before anything is
     * written. Over-allocation is caught downstream by payBills /
     * recordCollection, which now refuse to pay a document more than it owes.
     */
    matchMovementSplit(movId, splits, user) {
      const m = this.state.movements.find((x) => x.id === movId);
      if (!m) throw new Error("Movement not found");
      const list = (splits || []).filter((s) => s && s.amountCents);
      if (!list.length) throw new Error("Indica qué documentos explica el movimiento");
      const total = sum(list, (s) => cents(s.amountCents));
      const movTotal = Math.abs(cents(m.amountCents));
      if (total > movTotal + 1)
        throw new Error("El reparto suma " + total + "c y el movimiento es de " + movTotal + "c");
      const bills = list.filter((s) => s.billId);
      const invoices = list.filter((s) => s.invoiceId);
      if (bills.length && invoices.length)
        throw new Error("Un movimiento no puede pagar facturas emitidas y recibidas a la vez");
      if (bills.length) {
        this.payBills(
          {
            amountCents: total,
            method:
              m.card ||
              (this.state.bankAccounts.find((a) => a.id === m.accountId) || {}).kind === "card"
                ? "card"
                : "transfer",
            billAllocations: bills.map((s) => ({
              billId: s.billId,
              amountCents: cents(s.amountCents),
            })),
            movementId: movId,
          },
          user,
        );
        m.class = "projectCost";
      } else {
        const first = this.state.invoices.find((i) => i.id === invoices[0].invoiceId);
        this.recordCollection(
          {
            partyId: first.partyId,
            amountCents: total,
            method: "transfer",
            allocations: invoices.map((s) => ({
              invoiceId: s.invoiceId,
              amountCents: cents(s.amountCents),
            })),
            movementId: movId,
          },
          user,
        );
        m.class = "customerReceipt";
      }
      // What it settled, all of it — not the last one considered.
      m.matched = { documents: list.map((s) => ({ ...s })) };
      m.status = "matched";
      this._log(user, "matchMovementSplit", movId + " → " + list.length + " doc(s)");
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
              method:
                m.card ||
                (this.state.bankAccounts.find((a) => a.id === m.accountId) || {}).kind === "card"
                  ? "card"
                  : "transfer",
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
    /**
     * `accountId` is optional, and its absence means every account on purpose:
     * closing a period is a company-wide act and must see the whole queue.
     * The reconciliation SCREEN is the opposite — it is worked one account at
     * a time, and until this argument existed it ignored the account picker
     * entirely, so selecting the credit card showed the current account's
     * queue unchanged. 533 movements either way, which is how it went
     * unnoticed until somebody counted them (acceptance test, step 117).
     */
    unreconciledMovements(from, to, accountId) {
      return this.state.movements.filter(
        (m) =>
          m.status === "unallocated" &&
          !m.unbacked &&
          !m.excludedFromPL &&
          (!accountId || m.accountId === accountId) &&
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
      /* CLOSEST FIRST. The list used to arrive in whatever order the documents
         were created, and the screen showed the first twelve of it — which,
         on a busy quarter, is twelve documents chosen by age and unrelated to
         the movement in front of you. Ordered by how far each one is from
         this movement's amount, then by how far its date is, a person reading
         the top of the list is reading the plausible answers. Each row now
         also carries those two distances, so the screen can say WHY it is
         near rather than merely putting it near the top. */
      const target = Math.abs(m.amountCents);
      for (const c of out) {
        c.gapCents = Math.abs(c.outstandingCents - target);
        c.daysApart = Math.abs(daysBetween(m.accountingDate, c.date));
      }
      return out.sort((a, b) => a.gapCents - b.gapCents || a.daysApart - b.daysApart);
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
    /**
     * A movement that legitimately has no invoice, and says why.
     *
     * A bank fee, a transfer between the company's own accounts, interest — no
     * invoice exists and none is coming, and a queue that keeps asking for one
     * teaches the operator to ignore the queue. The reason comes from the
     * owner-maintained list and is stored BY CODE on the movement, so renaming
     * the label later does not rewrite history. Nothing is ever blocked by the
     * absence of this mark — it only silences the asking. A movement already
     * matched to a document does not need an excuse and is refused one.
     */
    markMovementUnbacked(movId, reasonCode, user) {
      const m = this.state.movements.find((x) => x.id === movId);
      if (!m) throw new Error("Movement not found");
      if (m.matched) throw new Error("This movement is already backed by a document");
      const reason = this.listActive("unbackedReasons").find((r) => r.code === reasonCode);
      if (!reason) throw new Error("Unknown reason: " + reasonCode);
      m.unbacked = { reason: reason.code };
      this._log(user, "markMovementUnbacked", movId + " · " + reason.code);
      return m;
    }
    /** The mark was wrong — put the movement back in the queue. */
    clearMovementUnbacked(movId, user) {
      const m = this.state.movements.find((x) => x.id === movId);
      if (!m) throw new Error("Movement not found");
      m.unbacked = null;
      this._log(user, "clearMovementUnbacked", movId);
      return m;
    }
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
    /**
     * Everything standing between a quarter and being locked, itemised.
     *
     * The operator asked for the lock and then asked for its rules: "I like
     * the idea of locking but we have to improve on how we decide what to lock
     * and the rules to lock — everything in the period to be locked should be
     * assigned." Two changes follow from that sentence.
     *
     * The unit is a QUARTER, not a pair of dates somebody types. A period
     * whose boundaries are chosen by hand can be drawn around the awkward
     * week, and the quarter is the boundary the filings already use.
     *
     * And ASSIGNED is broader than reconciled. A movement nobody explained
     * blocks the quarter, as before; so does a cost that names no destination,
     * a project cost missing its partida and subpartida, an hour on a
     * budgeted job with no subpartida, cash still out of the bank with
     * nothing accounting for it, and a document captured and never filed.
     * Those are the same rule PK12-S2 made mandatory going forward, applied
     * to what is already stored — a workspace that predates the rule can hold
     * every one of them.
     *
     * Returned as a LIST rather than thrown as a sentence, for
     * `billDeleteBlock`'s reason: a screen has to show what is in the way
     * before anybody presses the button, and one string cannot itemise six
     * different things. Each entry carries its own count and its own
     * references, so the refusal can be read AND acted on.
     */
    periodLockBlockers(quarter) {
      const inQ = (d) => quarterOf(d) === quarter;
      const budgeted = (projectId) => {
        const p = this.state.projects.find((x) => x.id === projectId);
        return !!(p && p.budgetId);
      };
      const billAllocs = [];
      for (const b of this.state.bills.filter((x) => inQ(x.date)))
        for (const a of b.allocations || []) billAllocs.push({ bill: b, alloc: a });

      const out = [];
      const add = (key, refs) => {
        if (refs.length) out.push({ key, count: refs.length, refs: refs.slice(0, 20) });
      };
      add(
        "unreconciled",
        this.state.movements
          .filter((m) => m.status === "unallocated" && !m.unbacked && inQ(m.accountingDate))
          .map((m) => m.id),
      );
      add(
        "costWithoutDestination",
        billAllocs
          .filter((x) => !x.alloc.projectId && !x.alloc.overheadCategory)
          .map((x) => x.bill.number),
      );
      add(
        "costWithoutLine",
        billAllocs
          .filter((x) => x.alloc.projectId && budgeted(x.alloc.projectId) && !x.alloc.lineId)
          .map((x) => x.bill.number),
      );
      add(
        "hoursWithoutLine",
        this.state.labour
          .filter((h) => inQ(h.date) && h.projectId && budgeted(h.projectId) && !h.lineId)
          .map((h) => h.id),
      );
      add(
        "cashOutstanding",
        this.cashWithdrawals(quarter)
          .filter((m) => m.cash.outstandingCents > 0)
          .map((m) => m.id),
      );
      add(
        "documentsPending",
        this.state.captured
          .filter((c) => c.confirmed && inQ(c.confirmed.date) && !c.billId)
          .map((c) => c.id),
      );
      return out;
    }
    /** The quarter's first and last day — the only boundaries a lock may use. */
    quarterRange(quarter) {
      const [y, q] = String(quarter).split("-Q");
      const first = (Number(q) - 1) * 3 + 1;
      const last = first + 2;
      const pad = (n) => String(n).padStart(2, "0");
      /* No leap-year branch, and none is needed: a quarter ends in March,
         June, September or December, so February is never the last month and
         the 28th/29th question cannot arise. An earlier draft carried that
         check and it was unreachable code pretending to be careful. */
      const endDay = { 3: 31, 6: 30, 9: 30, 12: 31 }[last];
      return { from: `${y}-${pad(first)}-01`, to: `${y}-${pad(last)}-${endDay}` };
    }
    /**
     * Lock a whole quarter, or refuse and say everything that is in the way.
     *
     * `closeBankPeriod` stays underneath and keeps its own narrower guard —
     * this is the door with the rules on it, that one is the mechanism.
     */
    closeQuarter(quarter, user) {
      const blockers = this.periodLockBlockers(quarter);
      if (blockers.length) {
        const e = new Error("The quarter still has items that are not assigned");
        e.blockers = blockers;
        throw e;
      }
      const r = this.quarterRange(quarter);
      return this.closeBankPeriod(r.from, r.to, user);
    }

    closeBankPeriod(from, to, user) {
      const open = this.unreconciledMovements(from, to);
      /* The count is NOT in the message. It is already on screen, in the bar
         directly above the button that was just pressed, and putting it in the
         refusal too makes one distinct string per number the queue can hold —
         an unbounded set no dictionary can translate. The same fault
         `candDistance` and `countTag` were built to remove. */
      if (open.length)
        throw new Error("Quedan movimientos sin conciliar — no se puede cerrar el periodo");
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
      const rec = this.importMovements(tillId, [{ ...mv, opCode: "CASH" }], user, {
        batch: false,
      })[0];
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
    /**
     * The consolidated balance as it stood at the end of a past date — for
     * "saldo bancos: cierre mes anterior" (§2.1) and for reconstructing the
     * control-tower sparklines, neither of which can use accountBalanceCents
     * (which is always "as of right now").
     */
    cashPositionAsOf(dateIso) {
      return sum(
        this.state.bankAccounts,
        (a) =>
          a.openingCents +
          sum(
            this.state.movements.filter((m) => m.accountId === a.id && m.accountingDate <= dateIso),
            (m) => m.amountCents,
          ),
      );
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
    /**
     * The same expected in/out as cashForecast(), but over a single rolling
     * window of N days from today rather than N one-week buckets — what
     * "proyección de caja: 7 días / 14 días / 30 días" (§2.1) actually needs.
     */
    cashForecastWindow(days) {
      const t = this.state.today,
        to = addDays(t, days - 1);
      let inflow = 0,
        outflow = 0;
      for (const r of this.receivables())
        if (r.outstandingCents > 0 && r.dueDate >= t && r.dueDate <= to)
          inflow += r.outstandingCents;
      for (const c of this.state.contracts)
        for (const i of c.installments)
          if (
            i.status === "planned" &&
            i.expectedDate &&
            i.expectedDate >= t &&
            i.expectedDate <= to
          )
            inflow += i.amountCents;
      for (const b of this.payables())
        if (b.outstandingCents > 0 && b.dueDate >= t && b.dueDate <= to)
          outflow += b.outstandingCents;
      return {
        from: t,
        to,
        inflowCents: inflow,
        outflowCents: outflow,
        netCents: inflow - outflow,
      };
    }
    /**
     * ADM-08's forecast grid: one column per period, rows grouped into money
     * in and money out, and a cumulative balance along the foot.
     *
     * Three deliberate choices, because a forecast is only useful if you can
     * say what it does and does not claim:
     *
     * 1. It opens from `cashPositionAsOf(today)` — the money that is actually
     *    there — rather than from zero. A cumulative line that starts at zero
     *    answers "what is the net of the next 13 weeks", which is never the
     *    question. The question is "do we run out, and when".
     * 2. Every row is an EXPECTATION with a date somebody committed to: an
     *    outstanding invoice on its due date, a planned contract instalment on
     *    its expected date, an outstanding bill on its due date. Nothing is
     *    extrapolated from an average, because an average has no due date and
     *    cannot be chased.
     * 3. Anything already overdue lands in the FIRST bucket rather than being
     *    dropped for being in the past. Money that was due last week is still
     *    coming or still owed; a forecast that silently discards it is a
     *    forecast that gets rosier the later you are.
     *
     * `projectId` narrows all three rows to one job. A bill counts by the part
     * of its allocations that names that project, not by its whole total —
     * a shared bill belongs to several jobs and to none of them entirely.
     */
    cashFlowGrid(opts) {
      const o = opts || {};
      const mode = o.mode === "month" ? "month" : "week";
      const count = Math.max(1, Math.min(52, o.periods || (mode === "month" ? 6 : 13)));
      const projectId = o.projectId || null;
      const t = this.state.today;

      const periods = [];
      if (mode === "week") {
        for (let i = 0; i < count; i++) {
          const from = addDays(t, i * 7);
          periods.push({ from, to: addDays(from, 6) });
        }
      } else {
        const first = monthStartOf(t);
        for (let i = 0; i < count; i++) {
          const from = addMonths(first, i);
          periods.push({ from: i === 0 ? t : from, to: addDays(addMonths(first, i + 1), -1) });
        }
      }
      // Bucket 0 absorbs everything already due — see note 3 above.
      const bucketOf = (dateIso) => {
        if (dateIso <= periods[0].to) return 0;
        for (let i = 1; i < periods.length; i++)
          if (dateIso >= periods[i].from && dateIso <= periods[i].to) return i;
        return -1;
      };
      const empty = () => periods.map(() => 0);
      const put = (cells, dateIso, amountCents) => {
        const i = bucketOf(dateIso);
        if (i >= 0) cells[i] += amountCents;
      };

      const invoiceCells = empty();
      for (const r of this.receivables())
        if (r.outstandingCents > 0 && (!projectId || r.projectId === projectId))
          put(invoiceCells, r.dueDate, r.outstandingCents);

      const milestoneCells = empty();
      for (const c of this.state.contracts) {
        if (projectId && c.projectId !== projectId) continue;
        for (const i of c.installments)
          if (i.status === "planned" && i.expectedDate)
            put(milestoneCells, i.expectedDate, i.amountCents);
      }

      const billCells = empty();
      for (const b of this.state.bills) {
        if (b.creditNoteFor) continue;
        const outstanding = this.billOutstandingCents(b.id);
        if (outstanding <= 0) continue;
        let share = outstanding;
        if (projectId) {
          const allocated = sum(b.allocations, (a) => a.amountCents);
          const mine = sum(
            b.allocations.filter((a) => a.projectId === projectId),
            (a) => a.amountCents,
          );
          if (!mine) continue;
          // Pro-rate what is still owed by the project's share of the base:
          // a part-paid bill owes each job a part of what is left, not all.
          share = allocated ? Math.round((outstanding * mine) / allocated) : outstanding;
        }
        put(billCells, b.dueDate, share);
      }

      const rowsIn = [
        { key: "invoices", label: "Facturas emitidas pendientes", cells: invoiceCells },
        { key: "milestones", label: "Hitos de contrato previstos", cells: milestoneCells },
      ];
      const rowsOut = [{ key: "bills", label: "Facturas recibidas pendientes", cells: billCells }];
      const totalOf = (rows) => periods.map((_, i) => sum(rows, (r) => r.cells[i]));
      const inTotals = totalOf(rowsIn),
        outTotals = totalOf(rowsOut);
      const netCents = periods.map((_, i) => inTotals[i] - outTotals[i]);

      const openingCents = this.cashPositionAsOf(addDays(t, -1));
      let running = openingCents;
      const cumulativeCents = netCents.map((n) => (running += n));

      return {
        mode,
        projectId,
        periods,
        openingCents,
        groups: [
          { key: "in", label: "Entradas", rows: rowsIn, totals: inTotals },
          { key: "out", label: "Salidas", rows: rowsOut, totals: outTotals },
        ],
        netCents,
        cumulativeCents,
      };
    }
    /**
     * "Resultado operativo del mes/trimestre en curso: Ingresos − Gastos"
     * (§2.1) — issued revenue (net of credit notes) minus received-invoice
     * cost, both on their document date (accrual, not cash), plus overhead/
     * salary/financial bank movements that were classified directly rather
     * than matched to a bill. Movements matched to a bill via matchMovement
     * are deliberately excluded from "gastos": the bill already counted that
     * cost, and the movement is only its payment settling — counting both
     * would double the expense side of the same euro.
     */
    operatingResult(from, to) {
      const inRange = (d) => d >= from && d <= to;
      const revenueCents =
        sum(
          this.state.invoices.filter((i) => i.kind !== "creditNote" && inRange(i.date)),
          (i) => i.baseCents,
        ) -
        sum(
          this.state.invoices.filter((i) => i.kind === "creditNote" && inRange(i.date)),
          (i) => i.baseCents,
        );
      const billsCents = sum(
        this.state.bills.filter((b) => inRange(b.date)),
        (b) => b.baseCents,
      );
      const unbilledCashCents = sum(
        this.state.movements.filter(
          (m) =>
            inRange(m.accountingDate) &&
            !m.matched &&
            ["overhead", "salary", "financial"].includes(m.class),
        ),
        (m) => Math.abs(m.amountCents),
      );
      const expenseCents = billsCents + unbilledCashCents;
      return { revenueCents, expenseCents, resultCents: revenueCents - expenseCents };
    }

    /* =========================== LAB — labour hours =========================== */
    addWorker(w, user) {
      // LAB-04/05. DMT-04: personal interno is master data in its own right,
      // not just a name on the hours grid — the fields below are what a
      // registry screen needs that a timesheet never did.
      const rec = Object.assign(
        {
          id: this._id("wkr"),
          code: "P-" + String(this.state.workers.length + 1).padStart(4, "0"),
          name: "",
          kind: "employee",
          taxId: "",
          phone: "",
          email: "",
          active: true,
          rateHistory: [],
          docs: [],
        },
        w,
      ); // rateHistory {from, rateCentsPerHour}; docs {kind, expiresOn, docRef}
      if (rec.taxId && !validTaxId(rec.taxId))
        throw new Error("NIF/CIF no válido — " + taxIdReason(rec.taxId));
      this.state.workers.push(rec);
      this._log(user, "addWorker", rec.name);
      return rec;
    }
    /** DMT-04: the fields a registry screen edits after creation. Rates and
        documents are append-only history, not patchable here — addWorkerRate
        and addWorkerDoc own those. */
    updateWorker(id, patch, user) {
      const w = this.state.workers.find((x) => x.id === id);
      if (!w) throw new Error("Worker not found");
      if (patch.taxId && !validTaxId(patch.taxId))
        throw new Error("NIF/CIF no válido — " + taxIdReason(patch.taxId));
      Object.assign(w, patch);
      this._log(user, "updateWorker", w.name);
      return w;
    }
    /** Deactivate, never delete (system-wide invariant) — a worker's recorded
        hours and rate history must stay explainable after they leave. */
    deactivateWorker(id, user) {
      const w = this.state.workers.find((x) => x.id === id);
      if (!w) throw new Error("Worker not found");
      w.active = false;
      this._log(user, "deactivateWorker", w.name);
      return w;
    }
    workerRateCents(workerId, date, kind) {
      // LAB-05 with history. `kind` appended and defaulted so every existing
      // caller keeps meaning what it meant: no third argument is the standard
      // rate. An "extra"/"festivo" hour takes the band's overtime rate WHEN
      // THE BAND NAMES ONE — a band without it falls back to the standard
      // rate, because an unset overtime rate means "same as always", never
      // zero: an overtime hour that costs nothing is a lie a margin report
      // would repeat.
      const w = this.state.workers.find((x) => x.id === workerId);
      const applicable = w.rateHistory
        .filter((r) => r.from <= date)
        .sort((a, b) => b.from.localeCompare(a.from));
      if (!applicable.length) throw new Error("No rate effective for " + date);
      const band = applicable[0];
      if ((kind === "extra" || kind === "festivo") && band.extraRateCentsPerHour > 0)
        return band.extraRateCentsPerHour;
      return band.rateCentsPerHour;
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
          lineId: null,
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
      if (rec.lineId) {
        // Same truth test every cost allocation passes since 1F: the subpartida
        // must exist on the accepted version, in the chapter it claims, and
        // the chapter is filled in from it when absent.
        const a = this._lineAlloc({
          projectId: rec.projectId,
          chapterNum: rec.chapterNum,
          lineId: rec.lineId,
        });
        rec.chapterNum = a.chapterNum;
      } else if (
        rec.projectId &&
        (this.state.projects.find((x) => x.id === rec.projectId) || {}).budgetId
      ) {
        /* Hours are a project cost like any other, and the rule covers them:
           the operator was asked whether it applied to invoices only or to
           every project cost, and answered both. This branch read
           `rec.lineId = null` — the same silent normalisation `_lineAlloc`
           performed one level up, and the reason 464 of the demo seed's labour
           entries named a chapter and no line.

           BOTH hours doors carry it. `correctHours` has the identical branch,
           and guarding only the first would have left editing an entry as the
           way around the rule — file it with a subpartida, then take it off. */
        throw new Error("Hours on a project must name their partida and subpartida");
      } else rec.lineId = null;
      rec.rateCents = this.workerRateCents(rec.workerId, rec.date, rec.kind);
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
     * ADM-04's Resumen tab: hours and their cost per project, broken down by
     * the chapter each entry was booked to. Entries with no chapter are kept
     * under a null chapter rather than dropped — an hour nobody assigned is
     * the thing the summary exists to surface.
     */
    /**
     * LAB by WORKER — the grouping the client named and no report had.
     *
     * hoursSummary answers "what did this project cost in labour"; this one
     * answers "what did this person work, where, at what cost" — totals, by
     * site, split normal/overtime. Same rows, other axis; the two can never
     * disagree because neither stores anything.
     */
    hoursByWorker(from, to) {
      const rows = this.state.labour.filter(
        (l) => (!from || l.date >= from) && (!to || l.date <= to),
      );
      const byW = new Map();
      for (const l of rows) {
        if (!byW.has(l.workerId)) {
          const w = this.state.workers.find((x) => x.id === l.workerId);
          byW.set(l.workerId, {
            workerId: l.workerId,
            name: w ? w.name : l.workerId,
            hoursMilli: 0,
            extraHoursMilli: 0,
            costCents: 0,
            projects: new Map(),
          });
        }
        const acc = byW.get(l.workerId);
        acc.hoursMilli += l.hoursMilli;
        if (l.kind !== "normal") acc.extraHoursMilli += l.hoursMilli;
        acc.costCents += l.costCents;
        const pid = l.projectId || "";
        if (!acc.projects.has(pid)) {
          const p = this.state.projects.find((x) => x.id === pid);
          acc.projects.set(pid, {
            projectId: pid || null,
            code: p ? p.code : "",
            hoursMilli: 0,
            costCents: 0,
          });
        }
        const pj = acc.projects.get(pid);
        pj.hoursMilli += l.hoursMilli;
        pj.costCents += l.costCents;
      }
      return [...byW.values()]
        .map((w) => ({ ...w, projects: [...w.projects.values()] }))
        .sort((a, b) => b.costCents - a.costCents);
    }
    /**
     * §4 sharpened by the client review: "each month, the petty cash payment
     * to a worker should reconcile with the hours worked by that same
     * worker." Per worker, per month: the labour cost booked on the sheets
     * against the money that left with their name on it — cash or bank. A
     * payment can only carry a name since this same change (workerId on the
     * movement), so months before it simply show zero paid, which is true of
     * what was RECORDED and the only honest reading.
     */
    workerMonthlyReconciliation(monthIso) {
      const from = monthIso + "-01";
      const to = monthIso + "-31";
      const out = new Map();
      const row = (workerId) => {
        if (!out.has(workerId)) {
          const w = this.state.workers.find((x) => x.id === workerId);
          out.set(workerId, {
            workerId,
            name: w ? w.name : workerId,
            bookedCents: 0,
            paidCents: 0,
          });
        }
        return out.get(workerId);
      };
      for (const l of this.state.labour.filter((x) => x.date >= from && x.date <= to))
        row(l.workerId).bookedCents += l.costCents;
      for (const m of this.state.movements.filter(
        (x) => x.workerId && x.accountingDate >= from && x.accountingDate <= to,
      ))
        row(m.workerId).paidCents += Math.abs(m.amountCents);
      return [...out.values()]
        .map((r) => ({ ...r, diffCents: r.paidCents - r.bookedCents }))
        .sort((a, b) => Math.abs(b.diffCents) - Math.abs(a.diffCents));
    }
    hoursSummary(from, to, projectId) {
      const rows = this.state.labour.filter(
        (l) =>
          (!from || l.date >= from) &&
          (!to || l.date <= to) &&
          (!projectId || l.projectId === projectId),
      );
      const byProject = new Map();
      for (const l of rows) {
        if (!byProject.has(l.projectId))
          byProject.set(l.projectId, { projectId: l.projectId, chapters: new Map() });
        const p = byProject.get(l.projectId);
        const key = l.chapterNum || "";
        if (!p.chapters.has(key))
          p.chapters.set(key, { chapterNum: l.chapterNum || null, hoursMilli: 0, costCents: 0 });
        const c = p.chapters.get(key);
        c.hoursMilli += l.hoursMilli;
        c.costCents += l.costCents;
      }
      const projects = [...byProject.values()].map((p) => {
        const pr = p.projectId ? this.state.projects.find((x) => x.id === p.projectId) : null;
        const chapters = [...p.chapters.values()].sort((a, b) =>
          String(a.chapterNum || "~").localeCompare(String(b.chapterNum || "~")),
        );
        for (const c of chapters) {
          const bc =
            pr && pr.baseline && (pr.baseline.chapters || []).find((x) => x.num === c.chapterNum);
          c.name = bc ? bc.name : null;
        }
        return {
          projectId: p.projectId,
          code: pr ? pr.code : null,
          name: pr ? pr.name : null,
          chapters,
          hoursMilli: sum(chapters, (c) => c.hoursMilli),
          costCents: sum(chapters, (c) => c.costCents),
        };
      });
      projects.sort((a, b) => String(a.code || "~").localeCompare(String(b.code || "~")));
      return {
        from: from || null,
        to: to || null,
        projects,
        totalHoursMilli: sum(projects, (p) => p.hoursMilli),
        totalCostCents: sum(projects, (p) => p.costCents),
      };
    }
    /**
     * ADM-04's monthly reconciliation block: what the month's hours cost the
     * jobs, against what actually left the bank as wages.
     *
     * These two numbers are NOT supposed to be equal, and the block is honest
     * about that rather than painting a red flag every month. Hours cost is an
     * accrual booked to jobs on the day the work happened; wages are cash
     * leaving on payday, and they also pay for holidays, sick days, office
     * staff and the time nobody logged. So the difference is reported as
     * `unbookedCents` — labour that was paid for but never landed on a job —
     * and the useful reading is its trend and its size relative to the wage
     * bill, which is why `unbookedPctBp` comes back with it.
     *
     * A negative difference is the interesting one: more hours booked to jobs
     * than wages paid means either a payroll run that has not been imported
     * yet or hours recorded against the wrong month, and both are worth
     * knowing before the figures reach a job's margin.
     */
    labourReconciliation(monthIso) {
      // With no month named, reconcile the last month that has a wage payment
      // in it rather than the current one. A month whose payroll has not run
      // yet cannot be reconciled — on the 5th it would report every hour
      // booked so far as unpaid, which is a calendar fact dressed up as an
      // alarm. The last closed payroll is the last month there is an answer
      // for, and it is the month somebody asking this question means.
      if (!monthIso) {
        const paid = this.state.movements
          .filter((m) => m.class === "salary")
          .map((m) => m.accountingDate)
          .sort();
        monthIso = paid.length ? paid[paid.length - 1] : this.state.today;
      }
      const from = monthStartOf(monthIso);
      const to = addDays(addMonths(from, 1), -1);
      const entries = this.state.labour.filter((l) => l.date >= from && l.date <= to);
      const bookedCents = sum(entries, (l) => l.costCents);
      const wages = this.state.movements.filter(
        (m) => m.class === "salary" && m.accountingDate >= from && m.accountingDate <= to,
      );
      // Wages leave the account, so they arrive here negative; the block reads
      // in positive money because "nóminas pagadas: −4.200 €" helps nobody.
      const wagesCents = Math.abs(sum(wages, (m) => m.amountCents));
      const unbookedCents = wagesCents - bookedCents;
      return {
        month: from.slice(0, 7),
        from,
        to,
        bookedCents,
        bookedHoursMilli: sum(entries, (l) => l.hoursMilli),
        wagesCents,
        wagesCount: wages.length,
        unbookedCents,
        unbookedPctBp: wagesCents ? Math.round((unbookedCents * 10000) / wagesCents) : 0,
        approvedHoursMilli: sum(
          entries.filter((l) => l.locked),
          (l) => l.hoursMilli,
        ),
        openHoursMilli: sum(
          entries.filter((l) => !l.locked),
          (l) => l.hoursMilli,
        ),
      };
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
              /* The WHOLE destination, not half of it. This copied the chapter
                 and dropped the line, which was survivable while a subpartida
                 was optional and is not now: repeating a day would refuse
                 every entry it was asked to reproduce. The same shape as the
                 capture→bill catch-22 — a destination carried partially
                 between two doors that each demand all of it. */
              lineId: l.lineId,
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
    /**
     * Every cost that has reached this project, one row per allocation, each
     * carrying the partida it landed on or `null` when it has none yet.
     *
     * ONE enumeration behind four views — the project total, the per-partida
     * table, the partida drawer and the pending-assignment block. They used to
     * enumerate separately and disagreed: a cost paid straight from an account
     * (petty cash on site, which is the one place the product still assigns a
     * project outside Gastos) counted towards the project's actual cost and
     * appeared in NO row of the table that is supposed to explain it — not
     * even in the block whose whole job is to itemise the difference. A
     * per-partida table that adds up to less than the project it describes is
     * the same class of fault as a balance that ignores its opening figure.
     *
     * Movements behind a bill are excluded, exactly as before: the bill has
     * already carried that cost and counting the payment too would double it.
     */
    projectCostRows(projectId) {
      const out = [];
      const chap = (v) => (v || v === 0 ? String(v) : null);
      this.state.bills.forEach((b) => {
        (b.allocations || []).forEach((a, i) => {
          if (a.projectId !== projectId) return;
          out.push({
            source: "bill",
            id: "bill:" + b.id + ":" + i,
            ref: b.number,
            /* Both from the BILL, not from the party file. `billSupplier`'s own
               comment says every reader goes through it rather than reaching
               for `party(id).name`, and this line was the exception that
               proved nothing: renaming a supplier would have quietly rewritten
               who issued a cost booked years earlier, and deactivating one
               would have thrown inside a report. What the invoice said on the
               day it was filed is the answer a cost row wants. */
            party: this.billSupplier(b).name,
            desc: this.billSupplier(b).name,
            date: b.date,
            chapterNum: chap(a.chapterNum),
            lineId: a.lineId || null,
            kind: a.kind || "material",
            amountCents: b.creditNoteFor ? -a.amountCents : a.amountCents,
          });
        });
      });
      this.state.labour.forEach((l) => {
        if (l.projectId !== projectId) return;
        const who = (this.state.workers.find((w) => w.id === l.workerId) || {}).name || "";
        out.push({
          source: "labour",
          id: "labour:" + l.id + ":0",
          ref: who,
          party: who,
          desc: (l.hoursMilli / 1000).toString() + " h",
          date: l.date,
          chapterNum: chap(l.chapterNum),
          lineId: l.lineId || null,
          kind: "labour",
          amountCents: l.costCents,
        });
      });
      const billMovIds = new Set(this.state.payments.map((p) => p.movementId).filter(Boolean));
      this.state.movements.forEach((m) => {
        if (m.class !== "projectCost" || billMovIds.has(m.id) || m.matched) return;
        (m.allocations || []).forEach((a, i) => {
          if (a.projectId !== projectId) return;
          out.push({
            source: "movement",
            id: "movement:" + m.id + ":" + i,
            ref: m.concept || m.merchantText || "",
            party: m.counterparty || "",
            desc: "",
            date: m.accountingDate,
            chapterNum: chap(a.chapterNum),
            lineId: a.lineId || null,
            kind: a.kind || "material",
            amountCents: a.amountCents,
          });
        });
      });
      this.state.captured.forEach((c) => {
        if (c.status !== "allocated" || c.billId || !["ticket"].includes(c.docType)) return;
        (c.allocations || []).forEach((a, i) => {
          if (a.projectId !== projectId) return;
          out.push({
            source: "capture",
            id: "capture:" + c.id + ":" + i,
            ref: c.stdName || c.reference || c.id,
            party: (c.confirmed && c.confirmed.issuerName) || "",
            desc: (c.confirmed && c.confirmed.issuerName) || "",
            date: (c.confirmed && c.confirmed.date) || c.capturedAt || "",
            chapterNum: chap(a.chapterNum),
            lineId: a.lineId || null,
            kind: a.kind || "material",
            amountCents: a.amountCents,
          });
        });
      });
      return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    }
    actualCostCents(projectId) {
      // FIN-02: bills + labour + direct movement allocations + confirmed
      // tickets, counted once each. `projectCostRows` is the single
      // enumeration; a credit note's allocations arrive already negated (AP-09
      // reduces) and a movement behind a bill is already excluded there.
      return sum(this.projectCostRows(projectId), (r) => r.amountCents);
    }
    projectEconomics(projectId) {
      // FIN-01/02/03
      const p = this.project(projectId);
      const approved = this.state.changes.filter(
        (c) => c.projectId === projectId && ["approved", "executed", "invoiced"].includes(c.status),
      );
      const changesPrice = sum(approved, (c) => c.priceCents),
        changesCost = sum(approved, (c) => c.costCents);
      let variationRevenue = 0,
        variationCost = 0;
      for (const r of this.chapterEconomics(projectId))
        if (r.variation) {
          variationRevenue += r.saleCents;
          variationCost += r.budgetCostCents;
        }
      const currentRevenueCents = p.baseline.revenueCents + changesPrice + variationRevenue;
      const committed = this.committedCostCents(projectId);
      const actual = this.actualCostCents(projectId);
      const forecastCost = Math.max(
        p.baseline.costCents + changesCost + variationCost,
        committed,
        actual,
      );
      return {
        baselineRevenueCents: p.baseline.revenueCents,
        approvedChangesCents: changesPrice,
        variationRevenueCents: variationRevenue,
        variationCostCents: variationCost,
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
    /**
     * Every cost behind ONE chapter of a project — the drill-down block 5 asks
     * to click into. Mirrors actualCostCents' rules row for row (bills minus
     * credit notes, labour, direct movements that are not behind a bill,
     * allocated tickets), so the drawer's sum can never disagree with the
     * chapter total above it. Each row carries its subpartida when it names one.
     */
    /**
     * One partida's economics, broken down by subpartida.
     *
     * `chapterEconomics` one level further in, and for the same reason: a
     * chapter showing 596 spent against 280 budgeted does not say WHERE, and
     * the operator reported exactly that — the table stopped at chapter level,
     * so the line that moved stayed hidden. A chapter can be four lines with
     * three of them exactly on budget.
     *
     * The reported words are paraphrased rather than quoted, deliberately: the
     * translation audit reads comments, and a phrase inside guillemets is
     * indistinguishable to it from a string the screen prints. That trap is
     * recorded twice already in this repository.
     *
     * The figures come from the same place the chapter's do — the accepted
     * version's own lines, priced the way `chapterEconomics` prices a
     * variation chapter, so the two levels cannot disagree about what was
     * budgeted. Actuals are `projectCostRows` grouped by `lineId`, which every
     * allocation already carries.
     *
     * A cost naming no subpartida gets a row of its own with no budget behind
     * it. That is not a rounding of the truth: money landed on the partida and
     * this table cannot say where, which is exactly the state the assignment
     * rule exists to make impossible. Until then it is a visible count rather
     * than a silence, and the rows sum to the partida either way.
     */
    lineEconomics(projectId, chapterNum) {
      const num = String(chapterNum);
      const actualByLine = {};
      for (const r of this.projectCostRows(projectId)) {
        if (String(r.chapterNum) !== num) continue;
        const k = r.lineId || "";
        actualByLine[k] = (actualByLine[k] || 0) + r.amountCents;
      }
      const found = this.projectChapters(projectId).find((x) => String(x.chapter.num) === num);
      const rows = ((found && found.chapter.lines) || []).map((l) => {
        const qty = l.subLines && l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli;
        const saleCents = l.lumpSum ? l.priceCents : mul(qty, l.priceCents);
        const budgetCostCents = l.lumpSum ? l.costCents : mul(qty, l.costCents);
        return {
          lineId: l.id,
          num: l.num,
          name: l.desc || "",
          saleCents,
          budgetCostCents,
          actualCents: actualByLine[l.id] || 0,
          unassigned: false,
        };
      });
      const orphan = actualByLine[""] || 0;
      if (orphan)
        rows.push({
          lineId: null,
          num: null,
          name: null,
          saleCents: 0,
          budgetCostCents: 0,
          actualCents: orphan,
          unassigned: true,
        });
      return rows;
    }
    chapterCosts(projectId, chapterNum) {
      const num = String(chapterNum);
      return this.projectCostRows(projectId)
        .filter((r) => r.chapterNum === num)
        .map((r) => ({
          source: r.source,
          ref: r.ref,
          date: r.date,
          desc: r.desc,
          lineId: r.lineId,
          amountCents: r.amountCents,
        }));
    }
    chapterEconomics(projectId) {
      // FIN-03 at chapter level
      const p = this.project(projectId);
      /* All four sources, not just bills and labour. A cost paid straight from
         an account and a confirmed ticket both reach `actualCostCents`; while
         this table enumerated only two of the four it added up to less than
         the project it describes, and nothing on screen said why. */
      const actualByCh = {};
      for (const r of this.projectCostRows(projectId))
        if (r.chapterNum)
          actualByCh[r.chapterNum] = (actualByCh[r.chapterNum] || 0) + r.amountCents;
      const rows = p.baseline.chapters.map((c) => ({
        num: c.num,
        name: c.name,
        saleCents: c.saleCents,
        budgetCostCents: c.costCents,
        actualCents: actualByCh[c.num] || 0,
        overrun: (actualByCh[c.num] || 0) > c.costCents,
        variation: false,
      }));
      /* Accepted variations join the SAME table — that is block 5's ask in one
         line: "any new Line Items and Sub-line Items should be reflected here
         automatically so they can be tracked". Their figures come from their
         frozen version's lines, the way the baseline's came from the base
         version at project creation. */
      const baseNums = new Set(rows.map((r) => String(r.num)));
      for (const { chapter: c } of this.projectChapters(projectId)) {
        if (baseNums.has(String(c.num))) continue;
        const sale = sum(c.lines, (l) =>
          l.lumpSum
            ? l.priceCents
            : mul(l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli, l.priceCents),
        );
        const cost = sum(c.lines, (l) =>
          l.lumpSum
            ? l.costCents
            : mul(l.subLines.length ? this._aggSubLines(l.subLines) : l.qtyMilli, l.costCents),
        );
        rows.push({
          num: c.num,
          name: c.name,
          saleCents: sale,
          budgetCostCents: cost,
          actualCents: actualByCh[c.num] || 0,
          overrun: (actualByCh[c.num] || 0) > cost,
          variation: true,
        });
      }
      return rows;
    }
    /**
     * Money that reached this project and stopped there — allocated to the job
     * but to no partida (PRY-02's pending-assignment block).
     *
     * `chapterEconomics` above silently skips exactly these rows: a bill line
     * with a `projectId` and no `chapterNum` contributes to the project's
     * actual cost and to none of its chapters, so the per-partida table adds
     * up to less than the project does and nothing on screen says why. This
     * method is that difference, itemised.
     *
     * The row id is a composite of source, record and index rather than a new
     * stored key: these rows are a view of other records, they come and go as
     * those records are assigned, and minting ids for them would be inventing
     * a collection that has to be kept in step with three others.
     */
    unassignedChapterCosts(projectId) {
      this.project(projectId);
      return this.projectCostRows(projectId)
        .filter((r) => !r.chapterNum)
        .map((r) => ({
          id: r.id,
          source: r.source,
          // An hours entry has no reference of its own; the day it was worked
          // is what identifies it on this list, and always has.
          ref: r.source === "labour" ? r.date : r.ref,
          party: r.party,
          date: r.date,
          amountCents: r.amountCents,
          kind: r.kind,
        }));
    }
    assignChapterSplit(projectId, rowId, splits, user) {
      const p = this.project(projectId);
      const parts = Array.isArray(splits) ? splits : [];
      if (!parts.length) throw new Error("A cost must be split into at least one chapter");
      const known = new Set((p.baseline.chapters || []).map((c) => String(c.num)));
      for (const x of this.projectChapters(projectId)) known.add(String(x.chapter.num));
      parts.forEach((s) => {
        if (!known.has(String(s.chapterNum)))
          throw new Error("Unknown chapter for this project: " + s.chapterNum);
        if (!(Math.round(s.amountCents) > 0))
          throw new Error("Every chapter line needs a positive amount");
      });
      const [source, recId, idxRaw] = String(rowId).split(":");
      const idx = Number(idxRaw);
      /* A movement joins the same path as a bill and a ticket: it holds
         `allocations`, so splitting it across partidas is the identical act.
         It reaches this list because petty cash on site names a project and
         often no partida — the one project cost the product still records
         outside Gastos, by the operator's own rule. */
      const collection =
        source === "bill"
          ? this.state.bills
          : source === "capture"
            ? this.state.captured
            : source === "movement"
              ? this.state.movements
              : null;
      if (source === "labour") {
        const l = this.state.labour.find((x) => x.id === recId);
        if (!l || l.projectId !== projectId) throw new Error("Cost not found on this project");
        // Hours are one entry against one worker on one day; they are not
        // divisible without inventing a second timesheet row, so a labour
        // cost takes ONE chapter and says so rather than pretending.
        if (parts.length !== 1)
          throw new Error("An hours entry goes to a single chapter — split the timesheet instead");
        if (Math.abs(parts[0].amountCents - l.costCents) > 1)
          throw new Error("Split must total the cost");
        l.chapterNum = String(parts[0].chapterNum);
        this._log(user, "assignChapterSplit", rowId);
        return l;
      }
      if (!collection) throw new Error("Unknown cost source: " + source);
      const rec = collection.find((x) => x.id === recId);
      if (!rec) throw new Error("Cost not found on this project");
      const alloc = rec.allocations[idx];
      if (!alloc || alloc.projectId !== projectId || alloc.chapterNum)
        throw new Error("That cost is no longer waiting for a chapter");
      const total = Math.abs(alloc.amountCents);
      if (Math.abs(sum(parts, (s) => Math.round(s.amountCents)) - total) > 1)
        throw new Error("Split must total the cost");
      const replacement = parts.map((s) => ({
        ...clone(alloc),
        chapterNum: String(s.chapterNum),
        amountCents: Math.round(s.amountCents),
      }));
      rec.allocations.splice(idx, 1, ...replacement);
      this._log(user, "assignChapterSplit", rowId);
      return rec;
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
    /**
     * The quarter's deliberately-unbacked movements, WITH their reasons.
     *
     * Not an exception — an exception is something wrong, and these are the
     * operator saying, name by name, that nothing is. They travel to the
     * accountant as information (the export prints them with their reasons)
     * rather than as a gate to be justified past: the justification already
     * happened, one movement at a time.
     */
    unbackedMovements(quarter) {
      const inQ = (d) => !quarter || quarterOf(d) === quarter;
      return this.state.movements
        .filter((m) => m.unbacked && inQ(m.accountingDate))
        .map((m) => ({
          id: m.id,
          accountingDate: m.accountingDate,
          concept: m.concept || m.merchantText || "",
          amountCents: m.amountCents,
          reason: m.unbacked.reason,
          reasonLabel:
            (this.listAll("unbackedReasons").find((r) => r.code === m.unbacked.reason) || {}).es ||
            m.unbacked.reason,
        }));
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
          .filter((m) => m.status === "unallocated" && !m.unbacked && inQ(m.accountingDate))
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
      /* Cash is the WITHDRAWALS now, not the movements that happened to sit
         on an account of kind till. Asking the accounts what counted as cash
         meant a company that took money out of its ordinary account — which is
         what actually happens — had no cash records at all, while one that
         kept a till had every internal movement of it counted twice. */
      const cash = this.cashWithdrawals(quarter);
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
          /* EVERY movement, cash withdrawals included. It used to be every
             movement that was not on a till, because a till's lines were a
             separate register that the bank never saw. A withdrawal is a bank
             line — it is on the statement — so subtracting it here would make
             the bank block disagree with the statement it reports on. The two
             blocks stopped being a partition when the till went: Efectivo is
             now a LENS over these same lines, not a second set of them. */
          count: movements.length,
          amountCents: sum(movements, (m) => m.amountCents),
          issues: ex.unallocatedMovements.length,
          sev: sev(ex.unallocatedMovements.length),
        },
        {
          key: "cash",
          label: "Efectivo retirado",
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
            supplier: this.billSupplier(b).name,
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
        // From the bill, not the party file — see `billSupplier`. The four
        // fields the accountant works from are the number, the date, the issuer
        // and its tax id, and the tax id was the one of the four that this
        // dictionary did not carry at all.
        partyName: this.billSupplier(b).name,
        partyTaxId: this.billSupplier(b).taxId,
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
        cashRecords: this.cashWithdrawals(quarter),
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
    /**
     * The standard library, installed on demand.
     *
     * WHY THIS EXISTS. These six used to be created by the demonstration
     * seeder and nowhere else — and a real company's document is deliberately
     * NOT seeded, because writing demonstration data into a live register is
     * the worse failure. The result was a company whose template library was
     * empty, and a send path written as `if (template) { queue it; file the
     * draft }`: with no template the whole block was skipped, so sending a
     * quote froze the version, created no queued message, filed no draft, and
     * reported nothing at all. Silence produced by a missing default is still
     * silence, and it cost a day of looking at a mailbox that was working.
     *
     * Same shape as ensureAlertRules(): missing ones are created, existing
     * ones are never touched, so an operator's own edits and their retired
     * versions survive untouched.
     */
    ensureCommsTemplates(user) {
      for (const t of STANDARD_COMMS_TEMPLATES) {
        if (this.state.commsTemplates.some((x) => x.key === t.key)) continue;
        this.addCommsTemplate(Object.assign({}, t), user || "system");
      }
      return this.state.commsTemplates;
    }
    commsTemplate(key, lang) {
      const pick = () =>
        this.state.commsTemplates.filter(
          (t) => t.key === key && t.active && (!lang || t.lang === lang),
        );
      let all = pick();
      // Asked for one of the standard messages and it is not there: install
      // the library and answer, rather than returning null to a caller whose
      // only reaction is to do nothing quietly.
      if (!all.length && STANDARD_COMMS_TEMPLATES.some((t) => t.key === key)) {
        this.ensureCommsTemplates("system");
        all = pick();
      }
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
    /**
     * N2 · where the draft of this message ended up. NOT a status — the
     * queue's own lifecycle (draft/approved/sent) is untouched — but a fact
     * beside it: "mailbox" (filed in the company Drafts), "none" (no mailbox
     * connected, recorded only), "error" (tried and failed, said out loud).
     */
    recordCommunicationFiled(id, outcome, user, reason) {
      const q = this.state.commsQueue.find((x) => x.id === id);
      if (!q) throw new Error("Queued message not found");
      if (!["mailbox", "none", "error"].includes(outcome))
        throw new Error("Unknown filing outcome: " + outcome);
      q.filed = outcome;
      q.filedAt = this.state.today;
      // WHY THE REASON IS KEPT AND NOT JUST SHOWN ONCE. A filing that fails
      // does so on the mail server, and the only account of it is the line
      // the server sent back. That line used to live in a toast — which the
      // send then navigated away from, so the operator saw «enviado» and an
      // empty Drafts folder with nothing anywhere explaining the gap. It is
      // a fact about this message, so it is kept beside the message.
      q.filedReason = outcome === "mailbox" ? null : reason || null;
      this._log(user, "recordCommunicationFiled", q.key + " " + outcome);
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
      // Who entered it. Every other mutation on this engine takes `user` and
      // writes it to the audit trail; this one accepted the argument and threw
      // it away, so a shared schedule recorded what changed and never who
      // changed it. Found by signing in as two people and adding a task as
      // each: the entries were indistinguishable.
      rec.createdBy = user || "system";
      this.state.tasks.push(rec);
      this._log(user, "addTask", rec.id);
      return rec;
    }
    alerts() {
      // 8.2 + DAS-06 — every alert carries a drill-down ref (DAS-03), a code
      // that identifies WHICH condition raised it (see ALERT_META for its
      // type and, where the spec calls for one, its configurable threshold),
      // and is skipped outright when its rule has been disabled.
      const t = this.state.today,
        A = [];
      const push = (code, sev, msg, ref) => {
        if (!this.alertRuleEnabled(code)) return;
        const meta = ALERT_META[code] || { type: "tecnica" };
        A.push({ code, type: meta.type, sev, msg, ref });
      };
      for (const r of this.receivables())
        if (r.outstandingCents > 0 && r.daysOverdue > 0)
          push(
            "AR-OVERDUE",
            "critical",
            `Factura ${r.number} vencida ${r.daysOverdue} días (${r.party})`,
            {
              invoice: r.number,
            },
          );
      for (const c of this.state.contracts)
        for (const i of c.installments)
          if (i.status === "planned" && i.expectedDate && i.expectedDate < t)
            push("CON-INSTALLMENT-OVERDUE", "critical", `Hito de cobro vencido — ${c.number}`, {
              contract: c.number,
            });
      const cash7 = this.cashForecast(1)[0];
      if (cash7 && cash7.outflowCents > cash7.inflowCents + this.cashPosition().totalCents)
        push("CASH-SHORTFALL", "critical", "Pagos previstos superan cobros esperados + caja", {
          view: "cashForecast",
        });
      for (const p of this.state.projects.filter((x) => !x.closed)) {
        const ec = this.projectEconomics(p.id);
        if (ec.marginForecastCents < 0)
          push("PROJ-MARGIN-NEG", "critical", `Margen negativo — ${p.code}`, { project: p.code });
        else if (ec.marginForecastPct * 100 < this.marginThresholdBp() / 100)
          push(
            "PROJ-MARGIN-LOW",
            "critical",
            `Margen bajo umbral — ${p.code} (${ec.marginForecastPct}%)`,
            {
              project: p.code,
            },
          );
        const con = p.contractId ? this.state.contracts.find((c) => c.id === p.contractId) : null;
        if (con) {
          if (!con.signature.customerSignedAt && p.dates.start)
            push(
              "CON-UNSIGNED-STARTED",
              "critical",
              `Obra iniciada sin contrato firmado — ${p.code}`,
              {
                contract: con.number,
              },
            );
          if (
            con.initiation.committedStartDate &&
            !con.duration.actualStart &&
            con.initiation.committedStartDate <=
              addDays(t, this.alertRuleThreshold("CON-START-AT-RISK", 3))
          )
            push(
              "CON-START-AT-RISK",
              "critical",
              `Fecha de inicio comprometida en riesgo — ${p.code}`,
              {
                contract: con.number,
              },
            );
          if (
            con.duration.actualStart &&
            con.duration.estimatedDays &&
            !con.duration.actualFinish &&
            daysBetween(t, con.duration.actualStart) > con.duration.estimatedDays
          )
            push("CON-DURATION-EXCEEDED", "critical", `Duración contractual excedida — ${p.code}`, {
              contract: con.number,
            });
        }
      }
      for (const b of this.state.budgets.filter((x) => x.status === "issued")) {
        const tt = this.budgetTotals(b.id, b.currentVersionId);
        if (tt.pendingCount > 0)
          push(
            "QUO-PENDING-LINES",
            "high",
            `Presupuesto ${b.number} emitido con ${tt.pendingCount} líneas pendientes`,
            { budget: b.number },
          );
        if (
          b.validityDate <= addDays(t, this.alertRuleThreshold("QUO-EXPIRING", 7)) &&
          !b.acceptedVersionId
        )
          push("QUO-EXPIRING", "high", `Presupuesto ${b.number} caduca el ${b.validityDate}`, {
            budget: b.number,
          });
      }
      for (const o of this.opportunityAges())
        if (
          o.ageDays > this.alertRuleThreshold("OPP-STALE", 14) &&
          ["awaitingBudget", "awaitingResponse"].includes(o.status)
        )
          push("OPP-STALE", "high", `Oportunidad sin avance ${o.ageDays} días`, {
            opportunity: o.id,
          });
      for (const pid of this.priceAlerts())
        push("PRICE-EXPIRED", "high", "Precio de proveedor caducado", { price: pid });
      for (const p of this.state.projects.filter((x) => !x.closed && x.budgetId)) {
        for (const ch of this.chapterEconomics(p.id))
          if (ch.actualCents > ch.budgetCostCents && ch.budgetCostCents > 0)
            push(
              "PROJ-CHAPTER-OVERCOST",
              "high",
              `Partida ${ch.num} por encima de coste previsto — ${p.code}`,
              { project: p.code, chapter: ch.num },
            );
      }
      for (const c of this.state.changes.filter(
        (x) => ["identified", "priced", "sent"].includes(x.status) && x.costCents > 0,
      ))
        push(
          "CHG-UNAPPROVED-COST",
          "high",
          `Extra sin aprobar con coste incurrido — ${this.project(c.projectId).code}`,
          { change: c.id },
        );
      // §4.1 — orders overdue on their confirmed arrival, and a three-way
      // reconciliation that does not add up once an order has been invoiced.
      for (const pu of this.state.purchases) {
        if (pu.cancelledAt || pu.status.delivered) continue;
        if (pu.expectedArrival && pu.expectedArrival < t)
          push(
            "PUR-ARRIVAL-DELAYED",
            "medium",
            `Llegada de material retrasada — orden ${pu.number}`,
            {
              purchase: pu.number,
            },
          );
      }
      for (const pu of this.state.purchases.filter((p) => p.status.invoicedBillId)) {
        if (!this.purchaseReconciliation(pu.id).ok)
          push(
            "PUR-RECONCILE-DIFF",
            "medium",
            `Diferencias en la conciliación de la orden ${pu.number}`,
            { purchase: pu.number },
          );
      }
      // §4.2 — subcontracts: expired documentation, over-certification,
      // an unbilled trade past a reasonable window, retention past its release.
      for (const s of this.state.subcontracts || []) {
        if (["draft", "cancelled", "rejected"].includes(s.status)) continue;
        const proj = this.state.projects.find((x) => x.id === s.projectId);
        if (!proj || proj.closed) continue;
        if (this.subcontractDocStatus(s).worst === "r")
          push(
            "SUB-DOC-EXPIRED",
            "high",
            `Documentación caducada — subcontrata ${s.number} (${proj.code})`,
            { subcontract: s.number },
          );
        const certifiedCents = sum(s.certifications, (c) => c.amountCents);
        if (s.awardedCents > 0 && certifiedCents > s.awardedCents * 1.1)
          push(
            "SUB-OVERCERTIFIED",
            "medium",
            `Certificado por encima de lo adjudicado — subcontrata ${s.number}`,
            { subcontract: s.number },
          );
        if (
          ["accepted", "inExecution"].includes(s.status) &&
          s.dates.actualStart &&
          !s.billIds.length &&
          daysBetween(t, s.dates.actualStart) > this.alertRuleThreshold("SUB-UNBILLED", 60)
        )
          push("SUB-UNBILLED", "medium", `Subcontrata sin factura tras varios días — ${s.number}`, {
            subcontract: s.number,
          });
        if (
          s.retentionPct > 0 &&
          !s.retentionReleasedAt &&
          s.retentionReleaseDate &&
          s.retentionReleaseDate < t
        )
          push(
            "SUB-RETENTION-DUE",
            "medium",
            `Retención no liberada tras el plazo de garantía — ${s.number}`,
            { subcontract: s.number },
          );
      }
      // §4.6 — a worker's own documentation has lapsed.
      for (const w of this.state.workers)
        for (const d of w.docs || [])
          if (d.expiresOn && d.expiresOn < t) {
            push("WORKER-DOC-EXPIRED", "medium", `Documentación caducada — ${w.name} (${d.kind})`, {
              worker: w.id,
            });
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
          push("LAB-MISSING-DAYS", "medium", `${missing} jornada(s) sin registrar — ${p.code}`, {
            project: p.code,
          });
      }
      const un = this.unallocatedSummary();
      if (un.billsCount)
        push("AP-UNALLOCATED", "high", `${un.billsCount} facturas de proveedor sin asignar`, {
          view: "payables",
        });
      if (un.movementsCount)
        push("BNK-UNALLOCATED", "high", `${un.movementsCount} movimientos bancarios sin asignar`, {
          view: "bank",
        });
      for (const b of this.state.bills.filter((x) => x.duplicateSuspect))
        push("AP-DUPLICATE", "high", `Posible duplicado — ${b.number}`, { bill: b.number });
      for (const c of this.state.contracts)
        for (const g of c.guarantees)
          if (
            g.expiryDate &&
            g.expiryDate <= addDays(t, this.alertRuleThreshold("CON-WARRANTY-EXPIRING", 30)) &&
            g.expiryDate >= t
          )
            push("CON-WARRANTY-EXPIRING", "medium", `Garantía próxima a vencer — ${c.number}`, {
              contract: c.number,
            });
      for (const m of this.state.movements.filter((x) => x.needsDoc))
        push("BNK-CASH-NODOC", "medium", "Movimiento de caja sin justificante", { movement: m.id });
      // §5.6 — an internal reminder (not a legal deadline, see ALERT_META) that
      // the current quarter's package still has not gone out.
      {
        const q = quarterOf(t);
        const sentQ = (this.state.packagesSent || []).some((p) => p.quarter === q && !p.reopened);
        if (!sentQ) {
          const target = this.alertRuleThreshold("GES-PACKAGE-DUE", 15);
          const daysPast = daysBetween(t, quarterEndDate(q));
          if (daysPast >= target)
            push(
              "GES-PACKAGE-DUE",
              daysPast >= target * 2 ? "critical" : "medium",
              `Paquete de ${q} sin enviar a gestoría — ${daysPast} días desde el cierre del trimestre`,
              { quarter: q },
            );
        }
      }
      return A;
    }

    /* ---- DAS-06/07 — alert rules and the management layer over alerts() ----
       alerts() stays a pure projection recomputed from current state, exactly
       like commsEvents() in §5.7: a rule enabled today must still see a
       condition that has existed since last week. Everything a person DOES
       to an alert — assign it, give it a deadline, snooze it, resolve it with
       a note and evidence, or turn it into a task — is stored separately in
       alertOverrides, keyed by a stable composite of the alert's code and its
       ref, so an override survives from one day's recomputed alert to the
       next as long as the underlying condition is still the same one. */
    ensureAlertRules() {
      if (!Array.isArray(this.state.alertRules)) this.state.alertRules = [];
      for (const code of Object.keys(ALERT_META)) {
        if (this.state.alertRules.some((r) => r.code === code)) continue;
        const m = ALERT_META[code];
        this.state.alertRules.push({
          code,
          label: m.label,
          type: m.type,
          enabled: true,
          thresholdValue: m.defaultThreshold != null ? m.defaultThreshold : null,
          recipient: "backoffice",
          channel: "app",
        });
      }
      return this.state.alertRules;
    }
    alertRule(code) {
      return this.ensureAlertRules().find((r) => r.code === code) || null;
    }
    alertRuleEnabled(code) {
      const r = this.alertRule(code);
      return !r || r.enabled !== false; // an unconfigured code defaults to on
    }
    alertRuleThreshold(code, fallback) {
      const r = this.alertRule(code);
      return r && r.thresholdValue != null ? r.thresholdValue : fallback;
    }
    updateAlertRule(code, patch, user) {
      const r = this.alertRule(code);
      if (!r) throw new Error("Unknown alert rule: " + code);
      const allowed = ["enabled", "thresholdValue", "recipient", "channel"];
      for (const k of Object.keys(patch || {})) if (allowed.includes(k)) r[k] = patch[k];
      this._log(user, "updateAlertRule", code);
      return r;
    }
    alertKey(a) {
      return a.code + "|" + JSON.stringify(a.ref || null);
    }
    /** Resolve a project code from an alert's ref, for the "por proyecto" grouping (DAS-06). */
    alertProjectCode(ref) {
      if (!ref) return null;
      if (ref.project) return ref.project;
      const find = (arr, pred) => (arr || []).find(pred);
      if (ref.contract) {
        const c = find(this.state.contracts, (x) => x.number === ref.contract);
        const p = c && find(this.state.projects, (x) => x.contractId === c.id);
        return p ? p.code : null;
      }
      if (ref.budget) {
        const p = find(this.state.projects, (x) => x.budgetNumber === ref.budget);
        return p ? p.code : null;
      }
      if (ref.purchase) {
        const pu = find(this.state.purchases, (x) => x.number === ref.purchase);
        const p = pu && find(this.state.projects, (x) => x.id === pu.projectId);
        return p ? p.code : null;
      }
      if (ref.subcontract) {
        const s = find(this.state.subcontracts, (x) => x.number === ref.subcontract);
        const p = s && find(this.state.projects, (x) => x.id === s.projectId);
        return p ? p.code : null;
      }
      if (ref.invoice) {
        const i = find(this.state.invoices, (x) => x.number === ref.invoice);
        const p = i && find(this.state.projects, (x) => x.id === i.projectId);
        return p ? p.code : null;
      }
      if (ref.bill) {
        const b = find(this.state.bills, (x) => x.number === ref.bill);
        const a0 = b && (b.allocations || [])[0];
        const p = a0 && a0.projectId && find(this.state.projects, (x) => x.id === a0.projectId);
        return p ? p.code : null;
      }
      if (ref.change) {
        const c = find(this.state.changes, (x) => x.id === ref.change);
        const p = c && find(this.state.projects, (x) => x.id === c.projectId);
        return p ? p.code : null;
      }
      return null;
    }
    /**
     * alerts() with the management layer merged in, filtered to what is
     * still actionable (DAS-07 "gestor, no aviso"). Pass includeResolved /
     * includeSnoozed to see the full history instead.
     */
    managedAlerts(opts) {
      opts = opts || {};
      const overrides =
        this.state.alertOverrides && typeof this.state.alertOverrides === "object"
          ? this.state.alertOverrides
          : {};
      const t = this.state.today;
      return this.alerts()
        .map((a) => {
          const key = this.alertKey(a);
          const ov = overrides[key] || null;
          return Object.assign({ key }, a, {
            project: this.alertProjectCode(a.ref),
            assignee: (ov && ov.assignee) || null,
            dueDate: (ov && ov.dueDate) || null,
            snoozedUntil: (ov && ov.snoozedUntil) || null,
            snoozeReason: (ov && ov.snoozeReason) || "",
            resolvedAt: (ov && ov.resolvedAt) || null,
            resolutionNote: (ov && ov.resolutionNote) || "",
            evidence: (ov && ov.evidence) || [],
            resolvedBy: (ov && ov.resolvedBy) || null,
            taskId: (ov && ov.taskId) || null,
          });
        })
        .filter((a) => {
          if (a.resolvedAt && !opts.includeResolved) return false;
          if (a.snoozedUntil && a.snoozedUntil > t && !opts.includeSnoozed) return false;
          return true;
        });
    }
    _alertOverride(key) {
      if (!this.state.alertOverrides || typeof this.state.alertOverrides !== "object")
        this.state.alertOverrides = {};
      if (!this.state.alertOverrides[key])
        this.state.alertOverrides[key] = {
          assignee: null,
          dueDate: null,
          snoozedUntil: null,
          snoozeReason: "",
          resolvedAt: null,
          resolutionNote: "",
          evidence: [],
          resolvedBy: null,
          taskId: null,
        };
      return this.state.alertOverrides[key];
    }
    assignAlert(key, assignee, user) {
      const ov = this._alertOverride(key);
      ov.assignee = assignee || null;
      this._log(user, "assignAlert", key);
      return ov;
    }
    setAlertDue(key, dueDate, user) {
      const ov = this._alertOverride(key);
      ov.dueDate = dueDate || null;
      this._log(user, "setAlertDue", key);
      return ov;
    }
    snoozeAlert(key, until, reason, user) {
      if (!until) throw new Error("Snoozing an alert needs a date");
      const ov = this._alertOverride(key);
      ov.snoozedUntil = until;
      ov.snoozeReason = String(reason || "").trim();
      this._log(user, "snoozeAlert", key);
      return ov;
    }
    resolveAlert(key, note, evidence, user) {
      if (!note || !String(note).trim()) throw new Error("Resolving an alert needs a note");
      const ov = this._alertOverride(key);
      ov.resolvedAt = this.state.today;
      ov.resolutionNote = String(note).trim();
      ov.evidence = evidence || [];
      ov.resolvedBy = user || "backoffice";
      this._log(user, "resolveAlert", key);
      return ov;
    }
    reopenAlert(key, user) {
      const ov = this._alertOverride(key);
      ov.resolvedAt = null;
      ov.resolutionNote = "";
      ov.resolvedBy = null;
      this._log(user, "reopenAlert", key);
      return ov;
    }
    /** Turn an alert into a real task the caller already has the wording for (DAS-07). */
    convertAlertToTask(key, title, owner, due, user) {
      const ov = this._alertOverride(key);
      if (ov.taskId) throw new Error("Already converted to a task");
      const task = this.addTask(
        { title, owner: owner || "backoffice", due: due || this.state.today, relatedRef: key },
        user,
      );
      ov.taskId = task.id;
      this._log(user, "convertAlertToTask", key);
      return task;
    }
    /**
     * The eight-card grid §2.1 replaces the old indicator block with, each
     * carrying exactly the big/small figures the spec names — nothing more,
     * since a card that also tried to be a mini-report would defeat the
     * point of a dashboard. Kept apart from the older ad-hoc fields on
     * controlTower() below, which existing readers (year-sim, migrations-sim)
     * still use and which this method leaves untouched.
     */
    controlTowerCards() {
      const t = this.state.today;
      const monthStart = t.slice(0, 7) + "-01";
      const prevMonthEnd = addDays(monthStart, -1);
      const [qy, qn] = quarterOf(t).split("-Q").map(Number);
      const quarterStart = `${qy}-${String((qn - 1) * 3 + 1).padStart(2, "0")}-01`;
      const opMonth = this.operatingResult(monthStart, t);
      const opQuarter = this.operatingResult(quarterStart, t);
      const activeProjects = this.state.projects.filter((p) => !p.closed);
      const activeContractedCents = sum(activeProjects, (p) => {
        const c = p.contractId ? this.state.contracts.find((x) => x.id === p.contractId) : null;
        return c ? c.totalCents : p.baseline.revenueCents;
      });
      const wonLost12m = this.state.opportunities.filter(
        (o) => ["won", "lost"].includes(o.status) && daysBetween(t, o.decidedAt || o.date) <= 365,
      );
      const week1 = this.cashForecastWindow(7),
        week2Full = this.cashForecastWindow(14);
      return {
        activeProjects: { count: activeProjects.length, contractedCents: activeContractedCents },
        monthResult: { ...opMonth, from: monthStart, to: t },
        quarterResult: { ...opQuarter, from: quarterStart, to: t },
        bankBalance: {
          nowCents: this.cashPosition().totalCents,
          prevMonthCloseCents: this.cashPositionAsOf(prevMonthEnd),
        },
        cashForecast: {
          d7: this.cashForecastWindow(7),
          d14: this.cashForecastWindow(14),
          d30: this.cashForecastWindow(30),
        },
        supplierPayments: {
          thisWeekCents: week1.outflowCents,
          nextWeekCents: week2Full.outflowCents - week1.outflowCents,
        },
        opportunities: {
          openCount: this.opportunityAges().length,
          wonCount12m: wonLost12m.filter((o) => o.status === "won").length,
          lostCount12m: wonLost12m.filter((o) => o.status === "lost").length,
        },
        visits: {
          pendingCount: this.state.opportunities.filter((o) => o.status === "awaitingVisit").length,
          done30dCount: this.state.visits.filter((v) => daysBetween(t, v.date) <= 30).length,
        },
      };
    }
    /**
     * Twelve trailing points per card, each on its own natural cadence
     * (monthly for month-scoped figures, quarterly for the quarter figure,
     * weekly for the week-scoped supplier-payments figure) — "últimos 12
     * periodos" (§2.1) means twelve of THAT card's period, not twelve of a
     * single global one.
     */
    controlTowerSeries() {
      const t = this.state.today;
      const ty = Number(t.slice(0, 4)),
        tm = Number(t.slice(5, 7));
      // Oldest first, so a sparkline can render the array left-to-right as-is.
      const trailingMonths = (n) => {
        const out = [];
        for (let i = n - 1; i >= 0; i--) {
          let y = ty,
            m = tm - i;
          while (m <= 0) {
            m += 12;
            y -= 1;
          }
          const from = `${y}-${String(m).padStart(2, "0")}-01`;
          const firstOfNext =
            m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
          const to = i === 0 ? t : addDays(firstOfNext, -1); // the current month is truncated to "so far"
          out.push({ from, to });
        }
        return out;
      };
      const trailingWeeks = (n) => {
        const out = [];
        for (let i = n - 1; i >= 0; i--)
          out.push({ from: addDays(t, -7 * i - 6), to: addDays(t, -7 * i) });
        return out;
      };
      const trailingQuarters = (n) => {
        const rows = [];
        let [qy, qn] = quarterOf(t).split("-Q").map(Number);
        for (let i = 0; i < n; i++) {
          rows.push({ y: qy, qn });
          qn -= 1;
          if (qn === 0) {
            qn = 4;
            qy -= 1;
          }
        }
        rows.reverse();
        return rows.map((r, idx) => {
          const from = `${r.y}-${String((r.qn - 1) * 3 + 1).padStart(2, "0")}-01`;
          const to = idx === rows.length - 1 ? t : quarterEndDate(`${r.y}-Q${r.qn}`);
          return { from, to };
        });
      };
      const months = trailingMonths(12);
      const activeAsOf = (dateIso) =>
        this.state.projects.filter(
          (p) =>
            p.dates.start &&
            p.dates.start <= dateIso &&
            (!p.closed || (p.dates.actualEnd || "9999") > dateIso),
        ).length;
      return {
        activeProjects: months.map((m) => activeAsOf(m.to)),
        monthResult: months.map((m) => this.operatingResult(m.from, m.to).resultCents),
        quarterResult: trailingQuarters(12).map(
          (q) => this.operatingResult(q.from, q.to).resultCents,
        ),
        bankBalance: months.map((m) => this.cashPositionAsOf(m.to)),
        supplierPayments: trailingWeeks(12).map((w) =>
          sum(
            this.payables().filter(
              (p) => p.outstandingCents > 0 && p.dueDate >= w.from && p.dueDate <= w.to,
            ),
            (p) => p.outstandingCents,
          ),
        ),
        opportunities: months.map(
          (m) =>
            this.state.opportunities.filter(
              (o) => o.date <= m.to && (!o.decidedAt || o.decidedAt > m.to),
            ).length,
        ),
        visits: months.map(
          (m) => this.state.visits.filter((v) => v.date >= m.from && v.date <= m.to).length,
        ),
      };
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
      const alerts = this.managedAlerts();
      return {
        cards: this.controlTowerCards(),
        series: this.controlTowerSeries(),
        lastCalculatedAt: this.state.today,
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
    /**
     * The right-hand calendar of §2.2: every date type the spec names —
     * "hitos de proyecto (inicio, fases, entrega)... vencimientos de
     * contrato y de garantía, envío de documentación a la gestoría,
     * presentación y pago de impuestos, caducidad de seguros y
     * documentación obligatoria de subcontratas" — read from the records
     * that already own each date, never a second copy of it. Visits are
     * deliberately absent: they are logged AFTER they happen (VIS-01), so
     * there is no future date to put on a calendar for one, and they already
     * have their own place in operationalDay()'s "Hoy"/"Esta semana" list.
     * "Fases" (per-chapter Gantt dates) is also left out — that level of
     * detail already has a dedicated screen and duplicating it here would
     * make the calendar a second, easier-to-drift copy of the Gantt.
     */
    upcomingMilestones(from, to) {
      const out = [];
      const push = (date, kind, label, ref) => {
        if (date && date >= from && date <= to) out.push({ date, kind, label, ref });
      };
      for (const p of this.state.projects) {
        push(p.dates.start, "projectStart", `Inicio de obra — ${p.code}`, { project: p.code });
        push(p.dates.targetEnd, "projectEnd", `Entrega prevista — ${p.code}`, { project: p.code });
      }
      for (const c of this.state.contracts) {
        for (const i of c.installments)
          if (i.status === "planned")
            push(i.expectedDate, "collectionMilestone", `Cobro previsto — ${c.number}`, {
              contract: c.number,
            });
        push(
          c.duration.plannedFinish,
          "contractDeadline",
          `Fin de obra contractual — ${c.number}`,
          {
            contract: c.number,
          },
        );
        for (const g of c.guarantees)
          push(g.expiryDate, "warrantyExpiry", `Vencimiento de garantía — ${c.number}`, {
            contract: c.number,
          });
      }
      for (const b of this.state.bills)
        if (this.billOutstandingCents(b.id) > 0)
          push(b.dueDate, "paymentMilestone", `Pago a proveedor — ${b.number}`, { bill: b.number });
      for (const pu of this.state.purchases)
        if (!pu.cancelledAt && !pu.status.delivered)
          push(pu.expectedArrival, "materialDelivery", `Entrega de material — ${pu.number}`, {
            purchase: pu.number,
          });
      for (const s of this.state.subcontracts || [])
        for (const d of s.docs || [])
          push(d.expiresOn, "subcontractDocExpiry", `Documentación (${d.kind}) — ${s.number}`, {
            subcontract: s.number,
          });
      for (const w of this.state.workers)
        for (const d of w.docs || [])
          push(d.expiresOn, "workerDocExpiry", `Documentación (${d.kind}) — ${w.name}`, {
            worker: w.id,
          });
      for (const task of this.state.tasks)
        if (task.status === "open") push(task.due, "task", task.title, { task: task.id });
      // One advisory fiscal date per quarter touching the window — the same
      // non-legal reminder GES-PACKAGE-DUE raises as an alert once it's
      // close, shown here regardless of proximity so the calendar can plan
      // around it ahead of time. push() itself drops anything outside
      // [from,to], so walking one quarter past the end is harmless.
      let q = quarterOf(from);
      const qTo = quarterOf(to);
      for (let guard = 0; guard < 8; guard++) {
        const deadline = addDays(quarterEndDate(q), this.alertRuleThreshold("GES-PACKAGE-DUE", 15));
        push(deadline, "gestoriaDeadline", `Envío a gestoría — ${q}`, { quarter: q });
        if (q === qTo) break;
        const [qy, qn] = q.split("-Q").map(Number);
        q = qn === 4 ? `${qy + 1}-Q1` : `${qy}-Q${qn + 1}`;
      }
      out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      return out;
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
        const existing = this.state.catalogue.find((i) => i.code === r.code);
        // A partida is required on CREATE (see addCatalogueItem); an update
        // to an already-catalogued item never needs one, so the guard only
        // widens the skip condition for the branch that would otherwise throw.
        if (!r.code || !r.desc || (!existing && !r.chapter)) {
          res.skipped++;
          continue;
        }
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
      // validityDate, not validityDays — the budget record has never held a
      // day count, so the old name silently dropped every edit to the one
      // header field an owner most often corrects.
      //
      // The second row is COM-03's conditions bar: everything the customer
      // reads under the totals, plus the two fields that change what the
      // totals mean (`surfaceM2` drives the per-m² figure, `irpfBp` the
      // withholding). `language` is the CUSTOMER's language for the emitted
      // document — deliberately not the operator's interface language, which
      // is a separate choice made by a separate person.
      const allowed = [
        "internalRef",
        "propertyId",
        "discountCents",
        "vatBp",
        "validityDate",
        "language",
        "surfaceM2",
        "irpfBp",
        "paymentConditions",
        "exclusions",
        "assumptions",
        "executionDays",
      ];
      for (const k of Object.keys(patch)) if (!allowed.includes(k)) delete patch[k];
      // Package 3 slide 5: a validity date is how long the OFFER stands —
      // one already in the past expired before anyone read it, which is not
      // a state a presupuesto can be typed into. The `min` on the field
      // stops the date picker offering an earlier day; this is the check
      // that actually holds, since a picker's `min` does not stop a typed
      // or programmatic value.
      if (patch.validityDate && patch.validityDate < this.state.today)
        throw new Error("Validity date cannot be in the past");
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
      this._renumber(this.currentVersion(budgetId));
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
      /* Release the job. A cancelled contract must not keep gating it —
         CON-11 would refuse works and the first invoice on the strength of a
         contract that no longer exists, and a replacement contract could
         never take the slot (the reverse link never overwrites). */
      const prj = this.state.projects.find((p) => p.contractId === c.id);
      if (prj) prj.contractId = null;
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
      // addProjectRequirement files by type: permits and safety documents go to
      // p.permits, everything else to p.dependencies. Nothing ever wrote a
      // p.requirements collection, so looking only there meant this method
      // could never resolve anything it had itself created.
      const r = [...(p.permits || []), ...(p.dependencies || []), ...(p.requirements || [])].find(
        (x) => x.id === reqId,
      );
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
      // Without this the "executed" status in LISTS.changeStatuses was
      // unreachable: the date was stamped but the record still read "approved",
      // so every screen filtering on status showed executed work as pending.
      ch.status = "executed";
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
      return {
        docType: "MODIFICACION",
        number: c.annexNumber || null,
        date: c.approvedAt || c.date,
        language:
          c.language || (con && con.language) || this._docLanguageFor(null, p.id, p.partyId),
        contractNumber: con ? con.number : null,
        issuer: this._issuerBlock(),
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
      // The rate lives on the bill as irpfBp — registerBill copies it from the
      // supplier profile. Reading irpfRateBp (the field name on the PARTY) made
      // this condition permanently false, so correcting the base recomputed the
      // tax and left the withholding stale, and the total was wrong by the
      // difference.
      b.irpfCents = b.irpfBp ? Math.round((b.baseCents * b.irpfBp) / 10000) : b.irpfCents;
      b.totalCents = b.baseCents + b.vatCents - (b.irpfCents || 0);
      this._log(user, "correctBill", b.number);
      return b;
    }
    /**
     * The supplier's document behind a manually registered bill.
     *
     * A bill promoted from a capture already HAS its file — the photograph the
     * whole record came from — so attaching a second here is refused and the
     * message points at the capture. This is for the other door: a bill typed
     * in from paper, whose paper the accountant will still want to see.
     */
    attachBillDoc(billId, doc, user) {
      const b = this.state.bills.find((x) => x.id === billId);
      if (!b) throw new Error("Bill not found");
      if (b.capId)
        throw new Error("This bill's document is the captured file it was registered from");
      if (!doc || typeof doc !== "object" || !doc.storageKey)
        throw new Error("The attachment has no stored file behind it");
      b.supportingDoc = {
        storageKey: doc.storageKey,
        name: doc.name || "",
        type: doc.type || "",
        size: doc.size || 0,
        uploadedAt: doc.uploadedAt || this.state.today,
      };
      this._log(user, "attachBillDoc", b.number);
      return b;
    }
    /**
     * What still points at a bill, and therefore what must be undone first.
     *
     * A CODE, not a sentence, and returned rather than thrown — so a screen
     * can disable the button and say why in the reader's own language before
     * anybody presses it. `_discardableMovement` answers the same shape for
     * the same reason.
     */
    billDeleteBlock(id) {
      const b = this.state.bills.find((x) => x.id === id);
      if (!b) throw new Error("Bill not found");
      const q = quarterOf(b.date);
      if ((this.state.packagesSent || []).some((p) => p.quarter === q)) return "quarter-sent";
      /* PAID IS NOT THE QUESTION. WHETHER MONEY MOVED IS.
         This used to refuse any bill with a payment against it, and that
         conflated two records that look alike and are not. A payment that
         names a `movementId` was created by reconciling a real bank line —
         money left an account, and un-registering the invoice it settled has
         to start in Conciliación. A payment with NO movement never touched a
         bank: it is a bookkeeping entry somebody made by pressing a button,
         and refusing to undo it left the operator holding an invoice marked
         «Pagada» against money that never moved, undeletable, with
         `voidPayment` reachable from no screen. That was a dead end this
         method built. So it blocks on the first and voids the second. */
      const pays = this._billPayments(id);
      if (pays.some((p) => p.movementId)) return "reconciled";
      /* One payment can settle SEVERAL invoices — `payBills` takes a list —
         and voiding it whole to release one of them would quietly un-pay the
         others. Nothing on any screen would say so. Refused by name instead,
         so the operator undoes the payment deliberately rather than losing
         three settlements to fix a fourth. */
      if (
        pays.some((p) =>
          (p.billAllocations || []).some((a) => a.billId !== id && a.amountCents > 0),
        )
      )
        return "shared-payment";
      if (
        this.state.movements.some(
          (m) =>
            m.matched &&
            (m.matched.billId === b.id ||
              (m.matched.documents || []).some((d) => d.billId === b.id)),
        )
      )
        return "reconciled";
      if (this.state.bills.some((x) => x.creditNoteFor === b.id)) return "credited";
      return null;
    }
    /** Every payment that allocates anything to this bill. */
    _billPayments(billId) {
      return this.state.payments.filter((p) =>
        (p.billAllocations || []).some((a) => a.billId === billId),
      );
    }
    /**
     * Remove a bill that should never have been filed at all.
     *
     * Not a correction and not a credit note — those are for a document that
     * is real and wrong. This is for one that is not a document: an invoice
     * registered against the wrong company, or twice, or from a reading nobody
     * meant to keep. So it is refused the moment anything downstream has
     * treated it as real, and `billDeleteBlock` names which thing.
     *
     * The two forward pointers are RELEASED rather than left dangling. The
     * captured document goes back to being a validated capture that can be
     * registered again — or now deleted — which is the state it was in a
     * moment earlier; the purchase order goes back to delivered-and-not-yet-
     * invoiced, which is what it once more is. A record pointing at an id that
     * no longer exists is the failure this method exists to avoid.
     */
    deleteBill(id, user) {
      const i = this.state.bills.findIndex((x) => x.id === id);
      if (i < 0) throw new Error("Bill not found");
      const b = this.state.bills[i];
      const block = this.billDeleteBlock(id);
      if (block) throw new Error("This invoice cannot be removed: " + block);
      /* Voided BEFORE the bill goes, so `voidPayment` can still find what it
         is undoing. Only unreconciled ones reach here — `billDeleteBlock`
         refuses the rest — so this is never quietly reversing a bank line. */
      for (const pay of this._billPayments(id)) this.voidPayment(pay.id, user);
      this.state.bills.splice(i, 1);
      const cap = b.capId ? this.state.captured.find((c) => c.id === b.capId) : null;
      if (cap) cap.billId = null;
      for (const pu of this.state.purchases.filter((x) => x.status.invoicedBillId === id))
        pu.status.invoicedBillId = null;
      this._log(user, "deleteBill", b.number + " · " + this.billSupplier(b).name);
      return { bill: b, releasedCapture: cap ? cap.id : null };
    }
    allocateBill(id, allocations, user) {
      const b = this.state.bills.find((x) => x.id === id);
      if (!b) throw new Error("Bill not found");
      const s = sum(allocations, (a) => a.amountCents);
      if (Math.abs(s - b.baseCents) > 1)
        throw new Error("Allocations must equal the bill base amount");
      b.allocations = allocations.map((a) => this.withAccountCode(a));
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
      // Named after the record addRecurringInvoice actually builds: desc,
      // cadenceMonths and nextDate. "concept" and "dayOfMonth" exist nowhere,
      // so editing the description or the cadence did nothing at all.
      const allowed = [
        "baseCents",
        "vatBp",
        "desc",
        "active",
        "cadenceMonths",
        "nextDate",
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
    /* unmatchMovement lives further up, beside matchMovement. A second, thinner
       definition used to sit HERE — same name, same class — and in a class body
       the later definition wins, so the careful one (void the payment the match
       created, check the closed period, clear allocations) was silently dead
       and undoing a match would have left a phantom payment behind. Nothing in
       the UI called it, which is the only reason it never bit. Do not add a
       method to this class without grepping for its name first. */
    /**
     * The receipt behind a movement, as a REAL FILE.
     *
     * `doc` is the standard evidence record — {storageKey, name, type, size,
     * uploadedAt} — the same shape every other attachment in the product
     * carries, which is what lets the accountant export ship the actual bytes
     * instead of a filename somebody once typed. A plain string is still
     * accepted and stored where it always was: the free-text reference was
     * this method's whole contract until now, and a caller that only has a
     * reference is not wrong, just poorer.
     */
    attachMovementDoc(id, doc, user) {
      const m = this.state.movements.find((x) => x.id === id);
      if (!m) throw new Error("Movement not found");
      if (doc && typeof doc === "object") {
        if (!doc.storageKey) throw new Error("The attachment has no stored file behind it");
        m.supportingDoc = {
          storageKey: doc.storageKey,
          name: doc.name || "",
          type: doc.type || "",
          size: doc.size || 0,
          uploadedAt: doc.uploadedAt || this.state.today,
        };
      } else {
        m.supportingDocRef = doc;
      }
      m.needsDoc = false;
      this._log(user, "attachMovementDoc", id);
      return m;
    }
    addWorkerRate(workerId, { from, rateCentsPerHour, extraRateCentsPerHour }, user) {
      // append-only: past effective rows stay; recorded hours keep their historic cost
      const w = this.state.workers.find((x) => x.id === workerId);
      if (!w) throw new Error("Worker not found");
      if (!(rateCentsPerHour > 0)) throw new Error("Rate must be positive");
      if (extraRateCentsPerHour != null && !(extraRateCentsPerHour > 0))
        throw new Error("The overtime rate, when given, must be positive");
      w.rateHistory.push({
        from: from || this.state.today,
        rateCentsPerHour,
        extraRateCentsPerHour: extraRateCentsPerHour > 0 ? extraRateCentsPerHour : null,
      });
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
      const allowed = [
        "projectId",
        "chapterNum",
        "hoursMilli",
        "date",
        "kind",
        "extraPayCents",
        "lineId",
      ];
      for (const k of Object.keys(patch)) if (!allowed.includes(k)) delete patch[k];
      if (patch.projectId) {
        const p = this.state.projects.find((x) => x.id === patch.projectId);
        if (p && p.closed) throw new Error("Cannot reallocate hours onto a closed project");
      }
      Object.assign(rec, patch);
      if (rec.lineId) {
        const a = this._lineAlloc({
          projectId: rec.projectId,
          chapterNum: rec.chapterNum,
          lineId: rec.lineId,
        });
        rec.chapterNum = a.chapterNum;
      } else if (
        rec.projectId &&
        (this.state.projects.find((x) => x.id === rec.projectId) || {}).budgetId
      ) {
        /* Hours are a project cost like any other, and the rule covers them:
           the operator was asked whether it applied to invoices only or to
           every project cost, and answered both. This branch read
           `rec.lineId = null` — the same silent normalisation `_lineAlloc`
           performed one level up, and the reason 464 of the demo seed's labour
           entries named a chapter and no line.

           BOTH hours doors carry it. `correctHours` has the identical branch,
           and guarding only the first would have left editing an entry as the
           way around the rule — file it with a subpartida, then take it off. */
        throw new Error("Hours on a project must name their partida and subpartida");
      } else rec.lineId = null;
      rec.rateCents = this.workerRateCents(rec.workerId, rec.date, rec.kind);
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
        capture: "captured",
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
    STANDARD_COMMS_TEMPLATES,
    LISTS,
    LIST_DEFAULTS,
    LIST_KINDS,
    // Exported so migration 18 seeds the SAME shape a new project gets, the
    // way `LIST_DEFAULTS` is already shared with the ladder. Two copies of a
    // record's default shape drift, and the failure is quiet: a migrated
    // company and a new one would bill differently and nothing would say why.
    defaultBilling,
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

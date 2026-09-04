/* GENERATED — do not edit by hand. Rebuild: pnpm --filter @repo/erp-browser build */
"use strict";
var ErpFactory = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    BrowserIdGen: () => BrowserIdGen,
    SURFACE_VERSION: () => SURFACE_VERSION,
    createComms: () => createComms,
    createDocs: () => createDocs,
    createExtraction: () => createExtraction,
    createProjects: () => createProjects,
    createRates: () => createRates,
    createReconciliation: () => createReconciliation,
    createScheduling: () => createScheduling,
    defaultPorts: () => defaultPorts
  });

  // ../capabilities/extraction/src/model.ts
  var FIELD_KEYS = [
    "issuerName",
    "issuerTaxId",
    "docNumber",
    "issueDate",
    "dueDate",
    "netAmount",
    "taxAmount",
    "withholdingAmount",
    "totalAmount",
    "iban",
    "orderRef"
  ];
  var AMOUNT_FIELDS = [
    "netAmount",
    "taxAmount",
    "withholdingAmount",
    "totalAmount"
  ];

  // ../capabilities/extraction/src/ports.ts
  var EXTRACTION_PROFILE_PORT = "extraction-profile@1";

  // ../capabilities/extraction/src/normalise.ts
  function normaliseText(input) {
    const pages = Array.isArray(input) ? input : [input];
    const lines = [];
    const pageOf = [];
    pages.forEach((page, pageIndex) => {
      for (const raw of String(page ?? "").split(/\r\n|\r|\n/)) {
        const clean = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[\u00a0\u2007\u2009\u202f]/g, " ").replace(/\s+/g, " ").trim();
        if (!clean) continue;
        lines.push(clean);
        pageOf.push(pageIndex + 1);
      }
    });
    return { lines, pageOf };
  }
  function fold(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  // ../kernel/src/errors.ts
  var FactoryError = class extends Error {
    constructor(code, message, details) {
      super(`[${code}] ${message}`);
      __publicField(this, "code");
      __publicField(this, "details");
      this.name = "FactoryError";
      this.code = code;
      this.details = details;
    }
  };

  // ../kernel/src/money.ts
  function assertInt(value, what) {
    if (!Number.isSafeInteger(value)) {
      throw new FactoryError("MONEY_NOT_INTEGER", `${what} must be a safe integer, got ${value}`);
    }
  }
  function roundDivHalfUp(n, d) {
    assertInt(n, "numerator");
    assertInt(d, "denominator");
    const sign = n < 0 ? -1 : 1;
    const abs = Math.abs(n);
    const q = Math.floor(abs / d);
    const r = abs - q * d;
    const result = sign * (r * 2 >= d ? q + 1 : q);
    return result === 0 ? 0 : result;
  }
  function sumCents(values) {
    let total = 0;
    for (const v of values) {
      assertInt(v, "cents value");
      total += v;
    }
    assertInt(total, "sum");
    return total;
  }

  // ../kernel/src/effective.ts
  var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  function assertIsoDate(date, what = "date") {
    if (!ISO_DATE.test(date)) {
      throw new FactoryError("NO_EFFECTIVE_RULE", `${what} must be YYYY-MM-DD, got "${date}"`);
    }
  }
  function resolveAt(periods, date, what) {
    assertIsoDate(date, `${what} effective date`);
    for (const period of periods) {
      if (date >= period.validFrom && (period.validTo === void 0 || date <= period.validTo)) {
        return { value: period.value, period };
      }
    }
    throw new FactoryError(
      "NO_EFFECTIVE_RULE",
      `No effective rule for "${what}" at ${date}. Known windows start ${periods[0]?.validFrom ?? "(none)"}. Refusing to guess.`,
      { what, date }
    );
  }

  // ../kernel/src/clock.ts
  var SystemClock = class {
    todayIso() {
      return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    }
    nowIso() {
      return (/* @__PURE__ */ new Date()).toISOString();
    }
  };

  // ../kernel/src/ports.ts
  var PortRegistry = class {
    constructor() {
      __publicField(this, "bindings", /* @__PURE__ */ new Map());
    }
    bind(port, adapter, providerId) {
      const existing = this.bindings.get(port);
      if (existing) {
        throw new FactoryError(
          "PORT_CONFLICT",
          `Port ${port} is already bound by "${existing.providerId}"; "${providerId}" tried to bind it too. Two selected packs implement the same port \u2014 fix the tenant spec or the packs.`,
          { port, providers: [existing.providerId, providerId] }
        );
      }
      this.bindings.set(port, { adapter, providerId });
    }
    get(port) {
      const binding = this.bindings.get(port);
      if (!binding) {
        throw new FactoryError(
          "PORT_NOT_BOUND",
          `No adapter bound for port ${port}. A selected pack (jurisdiction or vertical) must provide it; the kernel and capabilities never ship defaults for it.`,
          { port }
        );
      }
      return binding.adapter;
    }
    tryGet(port) {
      return this.bindings.get(port)?.adapter ?? void 0;
    }
    has(port) {
      return this.bindings.has(port);
    }
    provider(port) {
      return this.bindings.get(port)?.providerId;
    }
    boundPorts() {
      return [...this.bindings.keys()].sort();
    }
  };

  // ../capabilities/extraction/src/service.ts
  var FIELD_TOKEN = {
    issuerName: "text",
    issuerTaxId: "taxId",
    docNumber: "text",
    issueDate: "date",
    dueDate: "date",
    netAmount: "amount",
    taxAmount: "amount",
    withholdingAmount: "amount",
    totalAmount: "amount",
    iban: "account",
    orderRef: "text"
  };
  var ExtractionService = class {
    constructor(deps) {
      __publicField(this, "deps", deps);
    }
    profile() {
      return this.deps.ports.get(EXTRACTION_PROFILE_PORT);
    }
    extract(input) {
      const profile = this.profile();
      const { lines, pageOf } = normaliseText(input.text);
      if (!lines.length) {
        throw new FactoryError(
          "INVALID_STATE",
          "No readable text: nothing to extract. Offer manual entry with the image attached."
        );
      }
      const folded = lines.map(fold);
      const exclude = {
        names: new Set((input.exclude?.names ?? []).map(fold).filter(Boolean)),
        taxIds: new Set(
          (input.exclude?.taxIds ?? []).map((t) => t.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean)
        )
      };
      const recipientAt = this.recipientBoundary(folded, profile);
      const perField = /* @__PURE__ */ new Map();
      for (const key of FIELD_KEYS) {
        perField.set(key, this.candidatesFor(key, lines, folded, pageOf, profile, exclude));
      }
      for (const key of ["issuerName", "issuerTaxId"]) {
        const all = perField.get(key) ?? [];
        const above = all.filter((c) => c.source.line < recipientAt);
        if (above.length && above.length < all.length) perField.set(key, above);
      }
      if (!perField.get("issuerName")?.length) {
        const guessed = this.unlabelledIssuer(lines, folded, pageOf, profile, exclude, recipientAt);
        if (guessed) perField.set("issuerName", [guessed]);
      }
      const issueDate = best(perField.get("issueDate"))?.value ?? input.assumeIssueDate;
      const taxBreakdown = this.taxBreakdown(lines, pageOf, profile);
      const fields = FIELD_KEYS.map((key) => this.toField(key, perField.get(key) ?? []));
      this.deriveMissingAmount(fields);
      const checks = this.check(fields, taxBreakdown, issueDate, profile);
      for (const check of checks) {
        if (check.status !== "mismatch") continue;
        for (const f of fields) {
          if (!check.fields.includes(f.key)) continue;
          f.confidence = round(Math.max(0, f.confidence - 0.25));
          f.reasons = [...f.reasons, `contradicted by ${check.id}`];
        }
      }
      this.applyVerdicts(fields, checks);
      const threshold = this.deps.config.reviewThreshold;
      const needsReview = fields.filter((f) => f.verdict === "amber" || f.confidence < threshold).map((f) => f.key);
      return {
        lines,
        fields,
        taxBreakdown,
        checks,
        needsReview,
        profile: { id: profile.id, version: profile.version },
        confirmed: false
      };
    }
    /**
     * Re-run the consistency checks over values a person has edited.
     *
     * The validation screen needs this: the moment someone fixes the total, the
     * arithmetic verdict must move with it, and it must be the same arithmetic
     * the extractor used rather than a second copy living in the UI.
     */
    recheck(result, corrections) {
      const profile = this.profile();
      const fields = result.fields.map((f) => {
        if (!Object.prototype.hasOwnProperty.call(corrections, f.key)) return { ...f };
        const value = corrections[f.key] ?? null;
        const revalidated = this.validateValue(f.key, value, profile);
        return {
          ...f,
          value,
          raw: value === null ? null : String(value),
          confidence: 1,
          reasons: revalidated.reasons.length ? ["corrected by hand", ...revalidated.reasons] : ["corrected by hand"],
          validated: revalidated.validated,
          verdict: "amber"
          // finalised below
        };
      });
      const issueDate = fields.find((f) => f.key === "issueDate")?.value;
      const checks = this.check(fields, result.taxBreakdown, issueDate, profile);
      this.applyVerdicts(fields, checks);
      const threshold = this.deps.config.reviewThreshold;
      return {
        ...result,
        fields,
        checks,
        needsReview: fields.filter((f) => f.verdict === "amber" || f.confidence < threshold).map((f) => f.key),
        confirmed: false
      };
    }
    /**
     * Run whatever validator this field's kind has against a value that did not
     * come off the page. Amounts return false here and are decided by the
     * arithmetic in `applyVerdicts`, exactly as read values are.
     */
    validateValue(key, value, profile) {
      if (value === null || value === "") return { validated: false, reasons: [] };
      const kind = FIELD_TOKEN[key];
      if (kind === "taxId") {
        const c = profile.checkTaxId(String(value));
        if (c?.valid) return { validated: true, reasons: ["passes its check digit"] };
        return { validated: false, reasons: ["fails its check digit \u2014 read it again"] };
      }
      if (kind === "account") {
        const c = profile.checkAccountNumber?.(String(value));
        if (c?.valid) return { validated: true, reasons: ["passes its check digit"] };
        return { validated: false, reasons: ["fails its check digit \u2014 read it again"] };
      }
      if (kind === "date") {
        const iso = isRealDate(String(value)) ? String(value) : profile.parseDate(String(value));
        if (iso && isRealDate(iso)) return { validated: true, reasons: ["is a real calendar date"] };
        return { validated: false, reasons: ["is not a real calendar date"] };
      }
      return { validated: false, reasons: [] };
    }
    /* ------------------------------------------------------------------ */
    candidatesFor(key, lines, folded, pageOf, profile, exclude) {
      const kind = FIELD_TOKEN[key];
      const keywords = (profile.keywords[key] ?? []).map(fold);
      const out = [];
      lines.forEach((line, i) => {
        const spans = this.tokens(kind, line, i, pageOf[i], profile, key, lines);
        for (const { span, value } of spans) {
          if (typeof value === "string") {
            if (kind === "taxId" && exclude.taxIds.has(value.toUpperCase().replace(/[^A-Z0-9]/g, "")))
              continue;
            if (kind === "text" && exclude.names.has(fold(value))) continue;
          }
          if (kind === "text" && typeof value === "string" && this.isLabelResidue(value, profile))
            continue;
          const reasons = [];
          let score2 = 0;
          let failedCheckDigit = false;
          let labelled = true;
          const hit = keywords.find((k) => folded[i].includes(k));
          if (hit && folded[i].indexOf(hit) < span.start) {
            score2 += 0.5;
            reasons.push(`labelled "${hit}"`);
          } else if (hit) {
            score2 += 0.35;
            reasons.push(`labelled "${hit}" on the same line`);
          } else if (i > 0 && keywords.some((k) => folded[i - 1].includes(k))) {
            score2 += 0.3;
            reasons.push("labelled on the line above");
          } else {
            labelled = false;
          }
          score2 += kind === "text" ? 0.15 : 0.3;
          reasons.push(`matched a ${kind} token`);
          let validated = false;
          if (kind === "taxId" || kind === "account") {
            const check = kind === "taxId" ? profile.checkTaxId(span.text) : profile.checkAccountNumber?.(span.text);
            if (check?.valid) {
              score2 += 0.2;
              validated = true;
              reasons.push("passes its check digit");
            } else if (check) {
              failedCheckDigit = true;
              reasons.push("fails its check digit \u2014 read it again");
            }
          }
          if (kind === "date" && typeof value === "string" && isRealDate(value)) {
            validated = true;
            reasons.push("is a real calendar date");
          }
          const position = i / Math.max(1, lines.length - 1);
          if (key === "totalAmount" && position > 0.6) {
            score2 += 0.1;
            reasons.push("near the foot of the document");
          }
          if ((key === "issuerTaxId" || key === "issuerName") && position < 0.4) {
            score2 += 0.1;
            reasons.push("near the head of the document");
          }
          if (!hit && score2 < 0.5) reasons.push("no label found nearby");
          if (failedCheckDigit) score2 = Math.min(score2, 0.5);
          out.push({
            value,
            raw: span.text,
            confidence: round(Math.min(1, score2)),
            source: span,
            reasons,
            labelled,
            validated
          });
        }
      });
      return out.sort((a, b) => b.confidence - a.confidence || a.source.line - b.source.line);
    }
    tokens(kind, line, lineIndex, page, profile, key, allLines) {
      const mk = (m2, value) => ({
        span: {
          line: lineIndex,
          text: m2[0],
          start: m2.index,
          end: m2.index + m2[0].length,
          page
        },
        value
      });
      if (kind === "text") {
        const keywords = (profile.keywords[key] ?? []).map(fold);
        const f = fold(line);
        for (const k of keywords) {
          const at = f.indexOf(k);
          if (at === -1) continue;
          const after = line.slice(at + k.length).replace(/^[\s:.#/–—-]+/, "");
          if (after && !this.isLabelResidue(after, profile)) {
            const start = line.length - after.length;
            return [
              {
                span: { line: lineIndex, text: after, start, end: line.length, page },
                value: after
              }
            ];
          }
          const below = allLines?.[lineIndex + 1]?.trim();
          if (below && this.isLabelResidue(line, profile) && !this.isLabelResidue(below, profile)) {
            return [
              {
                span: { line: lineIndex + 1, text: below, start: 0, end: below.length, page },
                value: below
              }
            ];
          }
        }
        return [];
      }
      const pattern = kind === "amount" ? profile.patterns.amount : kind === "date" ? profile.patterns.date : kind === "taxId" ? profile.patterns.taxId : profile.patterns.accountNumber;
      if (!pattern) return [];
      const re = new RegExp(
        pattern.source,
        pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"
      );
      const found = [];
      let m;
      while ((m = re.exec(line)) !== null) {
        if (m[0] === "") {
          re.lastIndex += 1;
          continue;
        }
        const value = kind === "amount" ? profile.parseAmountCents(m[0]) : kind === "date" ? profile.parseDate(m[0]) : kind === "taxId" ? profile.checkTaxId(m[0])?.value ?? null : profile.checkAccountNumber?.(m[0])?.value ?? m[0];
        if (value === null) continue;
        found.push(mk(m, value));
      }
      return found;
    }
    /**
     * Is this "value" just the rest of its own label?
     *
     * «OBRA / REFERENCIA» is a heading. Cutting at «obra» left «/ REFERENCIA»,
     * and the reader offered it as the job reference — a field filled with the
     * remainder of the words that announced it. So: strip every keyword this
     * profile knows, and if what survives has no word left in it, there was
     * never a value there.
     *
     * Every keyword, not just the field's own: a heading pairs words from
     * different fields («OBRA / REFERENCIA», «Fecha / Vencimiento»), and a rule
     * that only knew its own would keep the other half.
     *
     * What survives has to be alphanumeric, not a WORD. The first version asked
     * for three consecutive letters and threw away «OB-2026-014» and
     * «F-2026/0417» — real references, mostly digits, exactly the shape these
     * fields carry. A reference is not prose and must not be tested as though it
     * were.
     */
    isLabelResidue(text, profile) {
      let rest = fold(text);
      for (const list of Object.values(profile.keywords)) {
        for (const k of list ?? []) {
          const folded = fold(k);
          if (folded.length >= 3) rest = rest.split(folded).join(" ");
        }
      }
      return !/[\p{L}\p{N}]/u.test(rest);
    }
    /**
     * THE ISSUER, WHICH NO DOCUMENT LABELS.
     *
     * `keywords.issuerName` lists «razón social», «emisor», «proveedor» — words
     * that appear on almost no real invoice. A supplier's name is simply the
     * largest text at the top, announced by nothing, so a label-driven reader
     * could never find it and returned "not found" on documents that shout it in
     * 24-point bold.
     *
     * What IS true of it: it sits in the head of the document, it is not us, and
     * it is not a date, an amount, a tax id or an address. That is enough to
     * offer one — never to be sure of one, so the confidence stays low and the
     * dot stays amber, which is the honest posture for a guess about a name
     * nothing can check.
     *
     * A name that wrapped onto a second line is one name: «SUMINISTROS CERDA» /
     * «MATERIALS, S.L.» — joined when the line below ends in one of the legal
     * suffixes the profile names, because knowing what the end of a company name
     * looks like here is jurisdiction knowledge and does not belong in this file.
     */
    unlabelledIssuer(lines, folded, pageOf, profile, exclude, recipientAt) {
      const suffixes = (profile.issuerSuffixes ?? []).map(fold);
      const head = Math.min(lines.length, 8, recipientAt);
      for (let i = 0; i < head; i++) {
        const line = lines[i].trim();
        if (line.length < 3 || line.length > 80) continue;
        if (!/\p{Lu}/u.test(line)) continue;
        if (this.isLabelResidue(line, profile)) continue;
        if (exclude.names.has(fold(line))) continue;
        if (profile.parseDate(line) || profile.parseAmountCents(line)) continue;
        const letters = (line.match(/\p{L}/gu) ?? []).length;
        const digits = (line.match(/\d/gu) ?? []).length;
        if (digits >= letters) continue;
        let text = line;
        let end = i;
        const next = lines[i + 1]?.trim();
        if (next && next.length <= 40 && suffixes.some((sfx) => fold(next).includes(sfx))) {
          text = `${line} ${next}`;
          end = i + 1;
        }
        if (exclude.names.has(fold(text))) continue;
        return {
          value: text,
          raw: text,
          confidence: 0.35,
          source: { line: i, text, start: 0, end: lines[end].length, page: pageOf[i] },
          reasons: ["at the head of the document, and not this company"],
          labelled: false,
          validated: false
        };
      }
      return null;
    }
    /**
     * The line at which the document stops talking about the issuer.
     *
     * A heading, so the marker has to START the line — «FACTURAR A» does;
     * «Indíquese el número de factura al cliente» does not, and treating the
     * word wherever it fell would cut the document at a sentence in the payment
     * terms. Returns the line count when there is no such heading, which means
     * "no boundary" and leaves every candidate in play.
     */
    recipientBoundary(folded, profile) {
      const markers = (profile.recipientMarkers ?? []).map(fold).filter(Boolean);
      if (!markers.length) return folded.length;
      for (let i = 0; i < folded.length; i++) {
        const line = folded[i].trim();
        if (markers.some((m) => line.startsWith(m))) return i;
      }
      return folded.length;
    }
    /**
     * THE THIRD AMOUNT IS ARITHMETIC, NOT A GUESS.
     *
     * A photograph loses a table row: a real document came back with the net and
     * the total read cleanly and the tax missing, because the recogniser kept the
     * figure and lost the words that named it. But net + tax = total — with two
     * of the three present the third is not a guess, it is subtraction.
     *
     * Filled only when exactly one is missing and the others were actually read,
     * marked as derived rather than read, and left amber: nothing checked it,
     * and the totals check that runs immediately afterwards will contradict it
     * if the two it came from disagree with the rest of the document. A value
     * that arrives by arithmetic must never wear a green dot for it.
     */
    deriveMissingAmount(fields) {
      const get = (key) => fields.find((f) => f.key === key);
      const net = get("netAmount");
      const tax = get("taxAmount");
      const total = get("totalAmount");
      if (!net || !tax || !total) return;
      const wh = get("withholdingAmount");
      const whValue = typeof wh?.value === "number" ? wh.value : 0;
      const num = (f) => typeof f.value === "number" ? f.value : null;
      const n = num(net);
      const t = num(tax);
      const g = num(total);
      const fill = (f, value, from) => {
        f.value = round(value);
        f.confidence = 0.4;
        f.validated = false;
        f.verdict = "amber";
        f.derived = true;
        f.reasons = [`derived from ${from}, not read`];
      };
      if (n !== null && t !== null && g === null)
        fill(total, n + t - whValue, "the base and the tax");
      else if (n !== null && g !== null && t === null)
        fill(tax, g - n + whValue, "the base and the total");
      else if (t !== null && g !== null && n === null)
        fill(net, g - t + whValue, "the tax and the total");
    }
    /** Rows of a document that states several rates (spec §5.2). */
    taxBreakdown(lines, pageOf, profile) {
      const rows = [];
      lines.forEach((line, i) => {
        const pct2 = new RegExp(profile.patterns.percent.source, "g");
        const hit = pct2.exec(line);
        if (!hit) return;
        const rateBp = profile.parsePercentBp(hit[0]);
        if (rateBp === null) return;
        const amounts = [];
        const amt = new RegExp(profile.patterns.amount.source, "g");
        let m;
        while ((m = amt.exec(line)) !== null) {
          if (m.index === hit.index) continue;
          const cents = profile.parseAmountCents(m[0]);
          if (cents !== null) amounts.push(cents);
        }
        if (!amounts.length) return;
        rows.push({
          rateBp,
          baseCents: amounts.length > 1 ? amounts[0] : null,
          taxCents: amounts.length > 1 ? amounts[1] : amounts[0],
          source: { line: i, text: line, start: 0, end: line.length, page: pageOf[i] }
        });
      });
      return rows;
    }
    check(fields, breakdown, issueDate, profile) {
      const val = (key) => {
        const f = fields.find((x) => x.key === key);
        return typeof f?.value === "number" ? f.value : null;
      };
      const net = val("netAmount");
      const tax = val("taxAmount");
      const withheld = val("withholdingAmount") ?? 0;
      const total = val("totalAmount");
      const checks = [];
      if (net === null || tax === null || total === null) {
        checks.push({
          id: "totals",
          status: "unknown",
          detail: "Not enough amounts were read to check the arithmetic.",
          fields: ["netAmount", "taxAmount", "totalAmount"]
        });
      } else {
        const expected = net + tax - withheld;
        const off = Math.abs(expected - total);
        checks.push({
          id: "totals",
          status: off <= this.deps.config.totalsToleranceCents ? "ok" : "mismatch",
          detail: off <= this.deps.config.totalsToleranceCents ? "Net + tax \u2212 withholding equals the total." : `Net + tax \u2212 withholding is ${expected}, but the total reads ${total}.`,
          fields: ["netAmount", "taxAmount", "withholdingAmount", "totalAmount"]
        });
      }
      if (net !== null && tax !== null && net > 0 && issueDate) {
        const rateBp = Math.round(tax / net * 1e4);
        const allowed = profile.expectedTaxRatesBp(issueDate);
        const near = allowed.find((r) => Math.abs(r - rateBp) <= 25);
        checks.push({
          id: "taxRate",
          status: near !== void 0 ? "ok" : "mismatch",
          detail: near !== void 0 ? `The tax is ${fmtBp(near)} of the net amount.` : `The tax works out at ${fmtBp(rateBp)} of the net amount, which is not a rate in force on ${issueDate}.`,
          fields: ["netAmount", "taxAmount"]
        });
      }
      if (breakdown.length > 1 && tax !== null) {
        const summed = breakdown.reduce((s, r) => s + (r.taxCents ?? 0), 0);
        const off = Math.abs(summed - tax);
        checks.push({
          id: "breakdown",
          status: off <= this.deps.config.totalsToleranceCents ? "ok" : "mismatch",
          detail: off <= this.deps.config.totalsToleranceCents ? `The ${breakdown.length} rate rows add up to the tax total.` : `The ${breakdown.length} rate rows add up to ${summed}, but the tax total reads ${tax}.`,
          fields: ["taxAmount"]
        });
      }
      return checks;
    }
    toField(key, candidates) {
      const answerable = isAmountField(key) ? candidates.filter((c) => c.labelled) : candidates;
      const top = answerable[0];
      if (!top) {
        const unlabelled = candidates.slice(0, this.deps.config.maxAlternatives);
        if (unlabelled.length) {
          return {
            key,
            value: null,
            raw: null,
            confidence: 0,
            source: null,
            alternatives: unlabelled,
            reasons: ["found amounts, but none of them was labelled as this field"],
            validated: false,
            verdict: "amber"
          };
        }
      }
      if (!top) {
        return {
          key,
          value: null,
          raw: null,
          confidence: 0,
          source: null,
          alternatives: [],
          reasons: ["not found"],
          validated: false,
          verdict: "amber"
        };
      }
      const agreeing = answerable.filter((c) => c.value === top.value).length;
      const confidence = round(Math.min(1, top.confidence + (agreeing > 1 ? 0.05 : 0)));
      const alternatives = candidates.filter((c) => c !== top).filter((c) => c.value !== top.value).slice(0, this.deps.config.maxAlternatives);
      return {
        key,
        value: top.value,
        raw: top.raw,
        confidence,
        source: top.source,
        alternatives,
        reasons: agreeing > 1 ? [...top.reasons, `read ${agreeing} times`] : top.reasons,
        validated: top.validated,
        verdict: "amber"
        // finalised by applyVerdicts, once the checks are known
      };
    }
    /**
     * Colour the dots, after the consistency checks — which is the only moment
     * the answer is knowable, because an amount is validated by its arithmetic
     * rather than by anything about the amount itself.
     *
     * Mutates in place, deliberately: it runs on freshly built field objects
     * inside `extract` and `recheck`, and copying them again to set two
     * properties would only make the ordering harder to follow.
     */
    applyVerdicts(fields, checks) {
      const totals = checks.find((c) => c.id === "totals");
      const contradicted = /* @__PURE__ */ new Set();
      for (const c of checks)
        if (c.status === "mismatch") for (const k of c.fields) contradicted.add(k);
      for (const f of fields) {
        if (f.value === null || contradicted.has(f.key)) {
          f.verdict = "amber";
          continue;
        }
        if (isAmountField(f.key)) {
          const ok = totals?.status === "ok" && !f.derived;
          f.validated = ok;
          f.verdict = ok ? "green" : "amber";
          continue;
        }
        f.verdict = f.validated ? "green" : "amber";
      }
    }
  };
  function isRealDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const d = /* @__PURE__ */ new Date(iso + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
  }
  function isAmountField(key) {
    return AMOUNT_FIELDS.includes(key);
  }
  function best(candidates) {
    return candidates?.[0];
  }
  function round(n) {
    return Math.round(n * 100) / 100;
  }
  function fmtBp(bp3) {
    return `${(bp3 / 100).toFixed(2).replace(/\.00$/, "")} per cent`;
  }

  // ../packs/jurisdiction-es-es/src/tax/rates.ts
  var IVA_GENERAL_BP = [{ validFrom: "2012-09-01", value: 2100 }];
  var IVA_REDUCIDO_BP = [
    { validFrom: "2012-09-01", value: 1e3 }
  ];
  var IVA_SUPERREDUCIDO_BP = [
    { validFrom: "2012-09-01", value: 400 }
  ];

  // ../packs/jurisdiction-es-es/src/tax/adapter.ts
  var PACK_ID = "jurisdiction/es-ES";
  var PACK_VERSION = "1.0.0";

  // ../packs/jurisdiction-es-es/src/extraction/taxid.ts
  var NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
  var CIF_DIGIT_ONLY = /* @__PURE__ */ new Set(["A", "B", "E", "H"]);
  var CIF_LETTER_ONLY = /* @__PURE__ */ new Set(["K", "P", "Q", "S"]);
  var CIF_LETTERS = "JABCDEFGHI";
  function normaliseTaxId(raw) {
    return raw.toUpperCase().replace(/[\s.\-/]/g, "").trim();
  }
  function checkSpanishTaxId(raw) {
    const value = normaliseTaxId(raw);
    if (/^\d{8}[A-Z]$/.test(value)) {
      const digits = Number(value.slice(0, 8));
      return { value, valid: NIF_LETTERS[digits % 23] === value[8], kind: "nif" };
    }
    if (/^[XYZ]\d{7}[A-Z]$/.test(value)) {
      const lead = "XYZ".indexOf(value[0]);
      const digits = Number(`${lead}${value.slice(1, 8)}`);
      return { value, valid: NIF_LETTERS[digits % 23] === value[8], kind: "nie" };
    }
    if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(value)) {
      const body = value.slice(1, 8);
      let sum = 0;
      for (let i = 0; i < body.length; i++) {
        const digit = Number(body[i]);
        if (i % 2 === 0) {
          const doubled = digit * 2;
          sum += Math.floor(doubled / 10) + doubled % 10;
        } else {
          sum += digit;
        }
      }
      const control = (10 - sum % 10) % 10;
      const given = value[8];
      const lead = value[0];
      const validDigit = given === String(control);
      const validLetter = given === CIF_LETTERS[control];
      const valid = CIF_DIGIT_ONLY.has(lead) ? validDigit : CIF_LETTER_ONLY.has(lead) ? validLetter : validDigit || validLetter;
      return { value, valid, kind: "cif" };
    }
    return null;
  }
  function checkIban(raw) {
    const value = raw.toUpperCase().replace(/[\s-]/g, "");
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(value)) return null;
    const rearranged = value.slice(4) + value.slice(0, 4);
    const expanded = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let remainder = 0;
    for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
    return { value, valid: remainder === 1 };
  }

  // ../packs/jurisdiction-es-es/src/extraction/profile.ts
  var MONTHS = {
    enero: "01",
    febrero: "02",
    marzo: "03",
    abril: "04",
    mayo: "05",
    junio: "06",
    julio: "07",
    agosto: "08",
    septiembre: "09",
    setembre: "09",
    octubre: "10",
    noviembre: "11",
    diciembre: "12",
    // Catalan, because invoices in this market arrive in both languages.
    gener: "01",
    febrer: "02",
    mar\u00E7: "03",
    marc: "03",
    abril_ca: "04",
    maig: "05",
    juny: "06",
    juliol: "07",
    agost: "08",
    octubre_ca: "10",
    novembre: "11",
    desembre: "12"
  };
  var MONTH_ALTERNATION = Object.keys(MONTHS).filter((m) => !m.includes("_")).join("|");
  function parseAmountCents(raw) {
    const cleaned = raw.replace(/[€\s]/g, "").replace(/^[+]/, "");
    const m = /^(-?)(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/.exec(cleaned);
    if (!m) return null;
    const units = Number(m[2].replace(/\./g, ""));
    const cents = Number(m[3]);
    const value = units * 100 + cents;
    return m[1] === "-" ? -value : value;
  }
  function parseDate(raw) {
    const text = raw.trim().toLowerCase();
    const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
    if (numeric) {
      const day = numeric[1].padStart(2, "0");
      const month = numeric[2].padStart(2, "0");
      let year = numeric[3];
      if (year.length === 2) year = `20${year}`;
      return isRealDate2(year, month, day) ? `${year}-${month}-${day}` : null;
    }
    const long = new RegExp(
      `^(\\d{1,2})\\s+(?:de\\s+)?(${MONTH_ALTERNATION})\\s+(?:de[l]?\\s+)?(\\d{4})$`
    ).exec(text);
    if (long) {
      const month = MONTHS[long[2]];
      if (!month) return null;
      const day = long[1].padStart(2, "0");
      return isRealDate2(long[3], month, day) ? `${long[3]}-${month}-${day}` : null;
    }
    return null;
  }
  function isRealDate2(year, month, day) {
    const d = /* @__PURE__ */ new Date(`${year}-${month}-${day}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.getUTCFullYear() === Number(year) && d.getUTCMonth() + 1 === Number(month) && d.getUTCDate() === Number(day);
  }
  function parsePercentBp(raw) {
    const m = /^(\d{1,2})(?:[.,](\d{1,2}))?\s?%$/.exec(raw.trim());
    if (!m) return null;
    const whole = Number(m[1]) * 100;
    const frac = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
    return whole + frac;
  }
  function checkTaxId(raw) {
    const result = checkSpanishTaxId(raw);
    return result ? { value: result.value, valid: result.valid } : null;
  }
  var ES_EXTRACTION_PROFILE = {
    id: `${PACK_ID}/extraction`,
    version: PACK_VERSION,
    keywords: {
      issuerName: ["razon social", "emisor", "proveedor", "expedido por", "datos del emisor"],
      issuerTaxId: ["nif", "cif", "n.i.f", "c.i.f", "nie", "identificacion fiscal"],
      /* The number is almost never announced by the word «factura» on its own
         line. Real invoices head the block «FACTURA» and put «N.o F-2026/4471»
         underneath, or write «Nº», «N.º», «Núm.» beside the value — so the
         markers belong here as labels in their own right, not only the phrases
         that spell the word out. */
      docNumber: [
        "factura n",
        "n factura",
        "numero de factura",
        "num factura",
        "factura numero",
        "n de documento",
        "albaran n",
        "n.o",
        "n.\xBA",
        "n\xBA",
        "num.",
        "n\xFAm.",
        "numero",
        "factura"
      ],
      issueDate: ["fecha de factura", "fecha factura", "fecha de emision", "fecha emision", "fecha"],
      dueDate: ["vencimiento", "fecha de vencimiento", "vence el", "forma de pago vencimiento"],
      netAmount: ["base imponible", "base", "subtotal", "importe neto"],
      taxAmount: ["cuota iva", "iva", "i.v.a", "cuota"],
      withholdingAmount: ["retencion", "irpf", "ret. irpf", "retencion irpf"],
      totalAmount: ["total factura", "total a pagar", "importe total", "total"],
      iban: ["iban", "cuenta", "cta", "domiciliacion"],
      /* What ties a supplier's document to work of ours. «Contrato:» and
         «Presupuesto:» are the two that matter most and were missing entirely —
         a supplier who writes them is handing us the link to the job, the
         contract and the accepted quote, and the reader was throwing it away. */
      orderRef: [
        "pedido",
        "n pedido",
        "su pedido",
        "obra",
        "referencia obra",
        "referencia",
        "presupuesto n",
        "presupuesto",
        "contrato",
        "albaran",
        "albar\xE1n"
      ]
    },
    patterns: {
      // Money: optional euro sign, thousands points, decimal comma.
      amount: /-?\s?\d{1,3}(?:\.\d{3})*,\d{2}\s?€?|-?\s?\d+,\d{2}\s?€?/g,
      date: new RegExp(
        `\\b\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{2,4}\\b|\\b\\d{1,2}\\s+de\\s+(?:${MONTH_ALTERNATION})\\s+de[l]?\\s+\\d{4}\\b`,
        "gi"
      ),
      /* The leading letter may be separated from the digits, because «C.I.F.
         B-62889417» is how a great many Spanish suppliers write it. Without the
         optional separator the match started at the digits, dropped the B, and
         the result failed its own shape test — so the field came back empty on a
         document that states it perfectly clearly. */
      taxId: /\b[A-Z][-.\s]?\d{7,8}[-.\s]?[A-Z0-9]?\b|\b\d{8}[-.\s]?[A-Z]\b/g,
      percent: /\b\d{1,2}(?:[.,]\d{1,2})?\s?%/g,
      accountNumber: /\bES\d{2}[\s]?(?:\d{4}[\s]?){5}\b/g,
      docNumber: /\b[A-Z]{0,4}[-/]?\d{2,}[-/]?\d*\b/g
    },
    /* How a company's legal name ends here. The extractor uses these to tell a
       name that wrapped onto a second line from two unrelated lines — «SUMINISTROS
       CERDA» / «MATERIALS, S.L.» is one issuer, not two — and knows nothing about
       what the words mean. */
    issuerSuffixes: ["s.l.", "sl", "s.a.", "sa", "s.l.u.", "slu", "s.c.p.", "scp", "c.b.", "cb"],
    /* How the second party is announced here. Below one of these headings, the
       name and the tax id belong to whoever is being billed — us, usually — and
       not to the company that issued the document. */
    recipientMarkers: [
      "facturar a",
      "facturado a",
      "cliente",
      "destinatario",
      "datos del cliente",
      "razon social del cliente"
    ],
    parseAmountCents,
    parseDate,
    parsePercentBp,
    checkTaxId,
    checkAccountNumber(raw) {
      return checkIban(raw);
    },
    /**
     * The rates that were law on that date, resolved from the pack's own
     * effective-dated tables — never a constant. A document from before a rate
     * change must be checked against the rate of its own day.
     */
    expectedTaxRatesBp(issueDateIso) {
      const at = (table, what) => {
        try {
          return resolveAt(table, issueDateIso, what).value;
        } catch {
          return null;
        }
      };
      return [
        at(IVA_GENERAL_BP, "general rate"),
        at(IVA_REDUCIDO_BP, "reduced rate"),
        at(IVA_SUPERREDUCIDO_BP, "super-reduced rate"),
        // Exempt and reverse-charge documents state no tax at all.
        0
      ].filter((r) => r !== null);
    }
  };

  // ../capabilities/docs/src/annex.ts
  var ANNEX_DEFAULT_ENABLED = true;
  var ANNEX_DEFAULT_IMAGES_PER_PAGE = 2;
  var ANNEX_MAX_IMAGES_PER_PAGE = 12;
  function resolveAnnexOptions(o) {
    const raw = Number(o?.imagesPerPage);
    const perPage = Number.isFinite(raw) ? Math.min(ANNEX_MAX_IMAGES_PER_PAGE, Math.max(1, Math.round(raw))) : ANNEX_DEFAULT_IMAGES_PER_PAGE;
    return {
      enabled: typeof o?.enabled === "boolean" ? o.enabled : ANNEX_DEFAULT_ENABLED,
      imagesPerPage: perPage
    };
  }
  function compareNumbering(a, b) {
    const pa = String(a).split(".");
    const pb = String(b).split(".");
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const sa = pa[i];
      const sb = pb[i];
      if (sa === void 0) return -1;
      if (sb === void 0) return 1;
      const na = Number(sa);
      const nb = Number(sb);
      if (Number.isFinite(na) && Number.isFinite(nb)) {
        if (na !== nb) return na - nb;
      } else if (sa !== sb) {
        return sa < sb ? -1 : 1;
      }
    }
    return 0;
  }
  function composeAnnex(images, options) {
    const opts = resolveAnnexOptions(options);
    if (!opts.enabled || images.length === 0) {
      return { enabled: opts.enabled, pages: [], plateCount: 0, markedItems: [] };
    }
    const ordered = images.map((img, i) => ({ img, i })).sort((a, b) => {
      const g = compareNumbering(a.img.groupNum, b.img.groupNum);
      if (g !== 0) return g;
      const it = compareNumbering(a.img.itemNum, b.img.itemNum);
      if (it !== 0) return it;
      const o = (a.img.order ?? 0) - (b.img.order ?? 0);
      if (o !== 0) return o;
      return a.i - b.i;
    }).map((x) => x.img);
    const perItem = /* @__PURE__ */ new Map();
    for (const img of ordered) perItem.set(img.itemNum, (perItem.get(img.itemNum) ?? 0) + 1);
    const seen = /* @__PURE__ */ new Map();
    const plates = ordered.map((img) => {
      const siblings = perItem.get(img.itemNum) ?? 1;
      const n = (seen.get(img.itemNum) ?? 0) + 1;
      seen.set(img.itemNum, n);
      return {
        ref: img.ref,
        groupNum: img.groupNum,
        groupName: img.groupName,
        itemNum: img.itemNum,
        itemLabel: img.itemLabel,
        caption: img.caption ?? "",
        sequence: siblings > 1 ? n : null,
        siblings
      };
    });
    const pages = [];
    for (let i = 0; i < plates.length; i += opts.imagesPerPage) {
      pages.push({
        number: pages.length + 1,
        plates: plates.slice(i, i + opts.imagesPerPage)
      });
    }
    return {
      enabled: true,
      pages,
      plateCount: plates.length,
      markedItems: [...perItem.keys()].sort(compareNumbering)
    };
  }

  // ../capabilities/scheduling/src/calendar.ts
  function everyDayCalendar() {
    return { workingWeekdays: [0, 1, 2, 3, 4, 5, 6], nonWorkingDates: [] };
  }
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  var MAX_SEARCH_DAYS = 3660;
  function assertIso(date) {
    if (!ISO.test(date)) {
      throw new FactoryError("INVALID_STATE", `Date must be ISO yyyy-mm-dd, received "${date}".`);
    }
  }
  function toUtc(date) {
    assertIso(date);
    const ms = Date.parse(`${date}T00:00:00.000Z`);
    if (Number.isNaN(ms)) throw new FactoryError("INVALID_STATE", `Not a real date: "${date}".`);
    return new Date(ms);
  }
  function toIso(d) {
    return d.toISOString().slice(0, 10);
  }
  function shift(date, days) {
    const d = toUtc(date);
    d.setUTCDate(d.getUTCDate() + days);
    return toIso(d);
  }
  function isWorkingDay(cal, date) {
    const weekday = toUtc(date).getUTCDay();
    if (!cal.workingWeekdays.includes(weekday)) return false;
    return !cal.nonWorkingDates.includes(date);
  }
  function snapForward(cal, date) {
    let cursor = date;
    for (let i = 0; i <= MAX_SEARCH_DAYS; i++) {
      if (isWorkingDay(cal, cursor)) return cursor;
      cursor = shift(cursor, 1);
    }
    throw noWorkingDay(date, "after");
  }
  function snapBack(cal, date) {
    let cursor = date;
    for (let i = 0; i <= MAX_SEARCH_DAYS; i++) {
      if (isWorkingDay(cal, cursor)) return cursor;
      cursor = shift(cursor, -1);
    }
    throw noWorkingDay(date, "before");
  }
  function addWorkingDays(cal, date, steps) {
    let cursor = steps >= 0 ? snapForward(cal, date) : snapBack(cal, date);
    const dir = steps >= 0 ? 1 : -1;
    let remaining = Math.abs(steps);
    let guard = 0;
    while (remaining > 0) {
      cursor = shift(cursor, dir);
      if (isWorkingDay(cal, cursor)) remaining -= 1;
      guard += 1;
      if (guard > MAX_SEARCH_DAYS) throw noWorkingDay(date, dir > 0 ? "after" : "before");
    }
    return cursor;
  }
  function workingDaysInclusive(cal, start, finish) {
    if (finish < start) return 0;
    let count = 0;
    let cursor = start;
    for (let i = 0; i <= MAX_SEARCH_DAYS && cursor <= finish; i++) {
      if (isWorkingDay(cal, cursor)) count += 1;
      cursor = shift(cursor, 1);
    }
    return count;
  }
  function workingDayOffset(cal, from, to) {
    if (from === to) return 0;
    const forward = to > from;
    const [a, b] = forward ? [from, to] : [to, from];
    const span = workingDaysInclusive(cal, a, b);
    const steps = Math.max(0, span - 1);
    return forward ? steps : -steps;
  }
  function finishOf(cal, start, durationDays) {
    if (durationDays <= 0) return snapForward(cal, start);
    return addWorkingDays(cal, start, durationDays - 1);
  }
  function startFor(cal, finish, durationDays) {
    if (durationDays <= 0) return snapBack(cal, finish);
    return addWorkingDays(cal, finish, -(durationDays - 1));
  }
  function noWorkingDay(date, direction) {
    return new FactoryError(
      "INVALID_STATE",
      `The calendar has no working day within ${MAX_SEARCH_DAYS} days ${direction} ${date}. Check workingWeekdays and nonWorkingDates.`
    );
  }

  // ../capabilities/scheduling/src/cpm.ts
  function calendarOf(plan) {
    return plan.calendar ?? everyDayCalendar();
  }
  function durationOf(cal, task) {
    if (task.milestone) return 0;
    if (typeof task.durationDays === "number") return Math.max(0, Math.round(task.durationDays));
    return Math.max(1, workingDaysInclusive(cal, task.plannedStart, task.plannedEnd));
  }
  function topologicalOrder(tasks, deps) {
    const indegree = /* @__PURE__ */ new Map();
    const successors = /* @__PURE__ */ new Map();
    for (const t of tasks) {
      indegree.set(t.id, 0);
      successors.set(t.id, []);
    }
    for (const d of deps) {
      if (!indegree.has(d.predecessorId) || !indegree.has(d.successorId)) {
        throw new FactoryError(
          "NOT_FOUND",
          `Dependency ${d.id} points at a task that is not in the plan.`,
          { predecessorId: d.predecessorId, successorId: d.successorId }
        );
      }
      successors.get(d.predecessorId).push(d.successorId);
      indegree.set(d.successorId, (indegree.get(d.successorId) ?? 0) + 1);
    }
    const ready = tasks.filter((t) => (indegree.get(t.id) ?? 0) === 0).map((t) => t.id);
    const order = [];
    while (ready.length) {
      const id = ready.shift();
      order.push(id);
      for (const s of successors.get(id) ?? []) {
        const left = (indegree.get(s) ?? 0) - 1;
        indegree.set(s, left);
        if (left === 0) ready.push(s);
      }
    }
    if (order.length !== tasks.length) {
      const stuck = tasks.filter((t) => !order.includes(t.id)).map((t) => t.id);
      throw new FactoryError(
        "INVALID_STATE",
        `The dependencies form a cycle: ${stuck.join(" \u2192 ")}.`,
        {
          taskIds: stuck
        }
      );
    }
    return order;
  }
  function computeSchedule(plan, opts = {}) {
    const cal = calendarOf(plan);
    const tasks = plan.tasks;
    const deps = plan.dependencies ?? [];
    if (!tasks.length) {
      const anchor = snapForward(cal, opts.from ?? "1970-01-01");
      return { start: anchor, finish: anchor, tasks: [], criticalPath: [] };
    }
    const order = topologicalOrder(tasks, deps);
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const predsOf = /* @__PURE__ */ new Map();
    const succsOf = /* @__PURE__ */ new Map();
    for (const t of tasks) {
      predsOf.set(t.id, []);
      succsOf.set(t.id, []);
    }
    for (const d of deps) {
      predsOf.get(d.successorId).push(d);
      succsOf.get(d.predecessorId).push(d);
    }
    const anchors = tasks.map((t) => t.earliestStart ?? t.plannedStart);
    const planStart = snapForward(cal, opts.from ?? anchors.reduce((a, b) => a < b ? a : b));
    const start = /* @__PURE__ */ new Map();
    const finish = /* @__PURE__ */ new Map();
    for (const id of order) {
      const task = byId.get(id);
      const duration = durationOf(cal, task);
      let earliest = snapForward(cal, task.earliestStart ?? planStart);
      for (const d of predsOf.get(id) ?? []) {
        const ps = start.get(d.predecessorId);
        const pf = finish.get(d.predecessorId);
        let candidate;
        if (d.type === "FS") candidate = addWorkingDays(cal, pf, 1 + d.lagDays);
        else if (d.type === "SS") candidate = addWorkingDays(cal, ps, d.lagDays);
        else candidate = startFor(cal, addWorkingDays(cal, pf, d.lagDays), duration);
        if (candidate > earliest) earliest = candidate;
      }
      start.set(id, earliest);
      finish.set(id, finishOf(cal, earliest, duration));
    }
    const planFinish = order.map((id) => finish.get(id)).reduce((a, b) => a > b ? a : b);
    const lateStart = /* @__PURE__ */ new Map();
    const lateFinish = /* @__PURE__ */ new Map();
    for (const id of [...order].reverse()) {
      const task = byId.get(id);
      const duration = durationOf(cal, task);
      let latestFinish = planFinish;
      for (const d of succsOf.get(id) ?? []) {
        const ss = lateStart.get(d.successorId);
        const sf = lateFinish.get(d.successorId);
        let candidate;
        if (d.type === "FS") candidate = addWorkingDays(cal, ss, -(1 + d.lagDays));
        else if (d.type === "SS")
          candidate = finishOf(cal, addWorkingDays(cal, ss, -d.lagDays), duration);
        else candidate = addWorkingDays(cal, sf, -d.lagDays);
        if (candidate < latestFinish) latestFinish = candidate;
      }
      lateFinish.set(id, latestFinish);
      lateStart.set(id, startFor(cal, latestFinish, duration));
    }
    const scheduled = order.map((id) => {
      const task = byId.get(id);
      const float = workingDayOffset(cal, start.get(id), lateStart.get(id));
      return {
        taskId: id,
        start: start.get(id),
        finish: finish.get(id),
        durationDays: durationOf(cal, task),
        lateStart: lateStart.get(id),
        lateFinish: lateFinish.get(id),
        totalFloatDays: float,
        critical: float <= 0
      };
    });
    return {
      start: scheduled.map((s) => s.start).reduce((a, b) => a < b ? a : b, planStart),
      finish: planFinish,
      tasks: scheduled,
      criticalPath: scheduled.filter((s) => s.critical).map((s) => s.taskId)
    };
  }
  function applySchedule(plan, schedule) {
    const byId = new Map(schedule.tasks.map((s) => [s.taskId, s]));
    return {
      ...plan,
      tasks: plan.tasks.map((t) => {
        const s = byId.get(t.id);
        return s ? { ...t, plannedStart: s.start, plannedEnd: s.finish } : t;
      })
    };
  }

  // ../capabilities/scheduling/src/baseline.ts
  function freezeBaseline(plan, input) {
    const existing = plan.baselines ?? [];
    if (existing.some((b) => b.label === input.label)) {
      throw new FactoryError(
        "IMMUTABLE",
        `A baseline labelled "${input.label}" already exists and cannot be replaced.`
      );
    }
    const cal = calendarOf(plan);
    const tasks = plan.tasks.map((t) => ({
      taskId: t.id,
      title: t.title,
      start: t.plannedStart,
      finish: t.plannedEnd,
      durationDays: durationOf(cal, t),
      milestone: t.milestone
    }));
    const finish = tasks.length ? tasks.map((t) => t.finish).reduce((a, b) => a > b ? a : b) : input.frozenAt;
    const baseline = {
      id: input.id,
      label: input.label,
      frozenAt: input.frozenAt,
      finish,
      tasks
    };
    return { ...plan, baselines: [...existing, baseline] };
  }
  function compareToBaseline(plan, baselineId) {
    const baselines = plan.baselines ?? [];
    if (!baselines.length) {
      throw new FactoryError("NOT_FOUND", "The plan has no baseline to compare against.");
    }
    const baseline = baselineId ? baselines.find((b) => b.id === baselineId) : baselines[baselines.length - 1];
    if (!baseline) {
      throw new FactoryError("NOT_FOUND", `Baseline ${baselineId} not found.`);
    }
    const cal = calendarOf(plan);
    const current = new Map(plan.tasks.map((t) => [t.id, t]));
    const drifts = [];
    for (const b of baseline.tasks) {
      const now = current.get(b.taskId);
      if (!now) {
        drifts.push({
          taskId: b.taskId,
          title: b.title,
          status: "removed",
          startDriftDays: 0,
          finishDriftDays: 0,
          durationDriftDays: -b.durationDays
        });
        continue;
      }
      const startDrift = workingDayOffset(cal, b.start, now.plannedStart);
      const finishDrift = workingDayOffset(cal, b.finish, now.plannedEnd);
      drifts.push({
        taskId: b.taskId,
        title: now.title,
        status: finishDrift > 0 ? "late" : finishDrift < 0 ? "ahead" : "on_plan",
        startDriftDays: startDrift,
        finishDriftDays: finishDrift,
        durationDriftDays: durationOf(cal, now) - b.durationDays
      });
    }
    const known = new Set(baseline.tasks.map((t) => t.taskId));
    for (const t of plan.tasks) {
      if (known.has(t.id)) continue;
      drifts.push({
        taskId: t.id,
        title: t.title,
        status: "added",
        startDriftDays: 0,
        finishDriftDays: 0,
        durationDriftDays: durationOf(cal, t)
      });
    }
    const currentFinish = plan.tasks.length ? plan.tasks.map((t) => t.plannedEnd).reduce((a, b) => a > b ? a : b) : baseline.finish;
    return {
      baselineId: baseline.id,
      label: baseline.label,
      baselineFinish: baseline.finish,
      currentFinish,
      finishDriftDays: workingDayOffset(cal, baseline.finish, currentFinish),
      tasks: drifts
    };
  }

  // ../capabilities/scheduling/src/derive.ts
  var DEFAULT_DURATION_DAYS = 5;
  function compareNumbering2(a, b) {
    const pa = String(a).split(".");
    const pb = String(b).split(".");
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const sa = pa[i];
      const sb = pb[i];
      if (sa === void 0) return -1;
      if (sb === void 0) return 1;
      const na = Number(sa);
      const nb = Number(sb);
      if (Number.isFinite(na) && Number.isFinite(nb)) {
        if (na !== nb) return na - nb;
      } else if (sa !== sb) {
        return sa < sb ? -1 : 1;
      }
    }
    return 0;
  }
  function durationFor(item, defaultDays) {
    if (typeof item.durationDays === "number" && Number.isFinite(item.durationDays)) {
      return { days: Math.max(1, Math.round(item.durationDays)), basis: "explicit" };
    }
    const qty = Number(item.quantity);
    const rate = Number(item.ratePerDay);
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate) && rate > 0) {
      return { days: Math.max(1, Math.ceil(qty / rate)), basis: "quantity" };
    }
    return { days: Math.max(1, Math.round(defaultDays)), basis: "default" };
  }
  function planFromWorkBreakdown(items, options) {
    const cal = options.calendar ?? everyDayCalendar();
    const granularity = options.granularity ?? "group";
    const defaultDays = options.defaultDurationDays ?? DEFAULT_DURATION_DAYS;
    const groupLag = options.groupLagDays ?? 0;
    const start = snapForward(cal, options.from);
    const skipped = [];
    const usable = items.filter((it) => {
      if (it.skip || !it.title) {
        skipped.push(it.ref);
        return false;
      }
      return true;
    });
    const ordered = usable.map((item, i) => ({ item, i })).sort((a, b) => {
      const g = compareNumbering2(a.item.groupNum, b.item.groupNum);
      if (g !== 0) return g;
      const it = compareNumbering2(a.item.itemNum ?? "", b.item.itemNum ?? "");
      if (it !== 0) return it;
      return a.i - b.i;
    }).map((x) => x.item);
    const tasks = [];
    const dependencies = [];
    const notes = [];
    const push = (id, title, days, note, assignee, sourceRef, lag) => {
      const previous = tasks[tasks.length - 1];
      tasks.push({
        id,
        title,
        assignee,
        // A first pass, deliberately: every task starts where the work could
        // start, and the CPM engine then pushes it out behind its predecessors.
        plannedStart: start,
        plannedEnd: finishOf(cal, start, days),
        status: "planned",
        progressPct: 0,
        milestone: false,
        durationDays: days,
        sourceRef
      });
      if (previous) {
        dependencies.push({
          id: `dep_${previous.id}__${id}`,
          predecessorId: previous.id,
          successorId: id,
          type: "FS",
          lagDays: lag
        });
      }
      notes.push(note);
    };
    if (granularity === "item") {
      let lastGroup = null;
      for (const item of ordered) {
        const { days, basis } = durationFor(item, defaultDays);
        const lag = lastGroup !== null && lastGroup !== item.groupNum ? groupLag : 0;
        lastGroup = item.groupNum;
        push(
          `task_${item.ref}`,
          `${item.itemNum ? item.itemNum + " " : ""}${item.title}`,
          days,
          {
            taskId: `task_${item.ref}`,
            title: item.title,
            durationDays: days,
            basis,
            quantity: item.quantity,
            unit: item.unit,
            ratePerDay: item.ratePerDay
          },
          item.assignee,
          item.ref,
          lag
        );
      }
    } else {
      const groups = /* @__PURE__ */ new Map();
      for (const item of ordered) {
        const { days } = durationFor(item, defaultDays);
        const g = groups.get(item.groupNum);
        if (g) {
          g.days += days;
          g.refs.push(item.ref);
        } else {
          groups.set(item.groupNum, { name: item.groupName, days, refs: [item.ref] });
        }
      }
      let first = true;
      for (const [num, g] of groups) {
        const id = `task_group_${num}`;
        push(
          id,
          `${num}. ${g.name}`,
          g.days,
          { taskId: id, title: g.name, durationDays: g.days, basis: "quantity" },
          void 0,
          `group:${num}`,
          first ? 0 : groupLag
        );
        first = false;
      }
    }
    return {
      plan: { tasks, dependencies, calendar: cal, baselines: [] },
      notes,
      skipped
    };
  }
  function mergeDerivedPlan(previous, derived) {
    const before = new Map(previous.tasks.map((t) => [t.id, t]));
    return {
      ...derived,
      tasks: derived.tasks.map((t) => {
        const old = before.get(t.id);
        if (!old) return t;
        return {
          ...t,
          progressPct: old.progressPct,
          status: old.status,
          assignee: old.assignee ?? t.assignee,
          earliestStart: old.earliestStart
        };
      }),
      // Baselines are promises already made; a re-derivation does not get to
      // rewrite them.
      baselines: previous.baselines ?? [],
      progressLog: previous.progressLog
    };
  }

  // ../capabilities/scheduling/src/tracking.ts
  var clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  var pct = (part, whole) => whole === 0 ? 0 : Math.round(part / whole * 1e3) / 10;
  function weightOf(weights, st) {
    const w = weights?.[st.taskId];
    if (typeof w === "number" && Number.isFinite(w) && w > 0) return w;
    return Math.max(st.durationDays, 1);
  }
  function plannedFractionAt(cal, st, date) {
    if (date < st.start) return 0;
    if (date >= st.finish) return 1;
    const done = workingDaysInclusive(cal, st.start, date);
    const total = Math.max(1, st.durationDays);
    return clamp(done / total, 0, 1);
  }
  function recordedPctAt(log, taskId, date) {
    let best2 = null;
    for (const e of log) {
      if (e.taskId !== taskId || e.date > date) continue;
      if (!best2 || e.date > best2.date) best2 = e;
    }
    return best2 ? best2.pct : null;
  }
  function progressCurve(plan, schedule, options) {
    const cal = calendarOf(plan);
    const log = plan.progressLog ?? [];
    const asOf = options.asOf;
    const scheduled = schedule.tasks;
    const totalWeight = scheduled.reduce((s, st) => s + weightOf(options.weights, st), 0);
    const plannedAt = (date) => pct(
      scheduled.reduce(
        (s, st) => s + weightOf(options.weights, st) * plannedFractionAt(cal, st, date),
        0
      ),
      totalWeight
    );
    const byId = new Map(plan.tasks.map((t) => [t.id, t]));
    const actualAt = (date) => {
      let sum = 0;
      for (const st of scheduled) {
        const recorded = recordedPctAt(log, st.taskId, date);
        sum += weightOf(options.weights, st) * (clamp(recorded ?? 0, 0, 100) / 100);
      }
      return pct(sum, totalWeight);
    };
    const observationDates = new Set(log.map((e) => e.date)).size;
    const canProject = observationDates >= 2;
    const actualNow = pct(
      scheduled.reduce((s, st) => {
        const t = byId.get(st.taskId);
        return s + weightOf(options.weights, st) * (clamp(t?.progressPct ?? 0, 0, 100) / 100);
      }, 0),
      totalWeight
    );
    const plannedNow = plannedAt(asOf);
    const performanceIndex = plannedNow > 0 ? Math.round(actualNow / plannedNow * 100) / 100 : null;
    const remainingDays = asOf >= schedule.finish ? 0 : Math.max(0, workingDaysInclusive(cal, asOf, schedule.finish) - 1);
    const stretch = performanceIndex && performanceIndex > 0 ? 1 / performanceIndex : 1;
    const projectedFinish = !canProject || remainingDays === 0 ? schedule.finish : addWorkingDays(cal, snapForward(cal, asOf), Math.round(remainingDays * stretch));
    const horizon = projectedFinish > schedule.finish ? projectedFinish : schedule.finish;
    const origin = asOf < schedule.start ? snapForward(cal, asOf) : schedule.start;
    const span = Math.max(1, workingDaysInclusive(cal, origin, horizon));
    const samples = Math.max(2, Math.min(options.samples ?? 24, span));
    const step = Math.max(1, Math.ceil(span / samples));
    const points = [];
    for (let d = 0; d < span; d += step) {
      const date = addWorkingDays(cal, origin, d);
      points.push({
        date,
        plannedPct: plannedAt(date),
        actualPct: date <= asOf ? actualAt(date) : null,
        // Anchored on the actual line so the two meet rather than jumping at
        // `asOf`, then continuing at the observed pace: the work the plan
        // expects between now and `date`, achieved at `performanceIndex` of it.
        projectedPct: canProject && date > asOf ? clamp(actualNow + (plannedAt(date) - plannedNow) * (performanceIndex ?? 1), 0, 100) : null
      });
    }
    const last = points[points.length - 1];
    if (!last || last.date !== horizon) {
      points.push({
        date: horizon,
        plannedPct: plannedAt(horizon),
        actualPct: horizon <= asOf ? actualAt(horizon) : null,
        projectedPct: canProject && horizon > asOf ? 100 : null
      });
    }
    if (asOf <= horizon && !points.some((pt) => pt.date === asOf)) {
      points.push({
        date: asOf,
        plannedPct: plannedNow,
        actualPct: actualAt(asOf),
        projectedPct: null
      });
      points.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    }
    return {
      asOf,
      points,
      plannedPct: plannedNow,
      actualPct: actualNow,
      driftPct: Math.round((actualNow - plannedNow) * 10) / 10,
      performanceIndex,
      plannedFinish: schedule.finish,
      projectedFinish
    };
  }
  function riskReport(plan, schedule, options) {
    const cal = calendarOf(plan);
    const asOf = options.asOf;
    const tolerance = options.tolerancePct ?? 10;
    const threshold = options.thresholdDays ?? 5;
    const byId = new Map(plan.tasks.map((t) => [t.id, t]));
    const baselines = plan.baselines ?? [];
    const baseline = options.baselineLabel ? baselines.find((b) => b.label === options.baselineLabel) : baselines[baselines.length - 1];
    const baselineFinish = baseline ? baseline.finish : null;
    const delayDays = baselineFinish ? workingDayOffset(cal, baselineFinish, schedule.finish) : 0;
    const items = [];
    for (const st of schedule.tasks) {
      const task = byId.get(st.taskId);
      if (!task) continue;
      const actual = clamp(task.progressPct ?? 0, 0, 100);
      const planned = Math.round(plannedFractionAt(cal, st, asOf) * 100);
      if (actual >= 100) continue;
      if (st.finish < asOf) {
        items.push({
          taskId: st.taskId,
          title: task.title,
          kind: "overdue",
          critical: st.critical,
          days: workingDayOffset(cal, st.finish, asOf),
          plannedPct: planned,
          actualPct: actual
        });
      } else if (actual === 0 && st.start < asOf) {
        items.push({
          taskId: st.taskId,
          title: task.title,
          kind: "not_started",
          critical: st.critical,
          days: workingDayOffset(cal, st.start, asOf),
          plannedPct: planned,
          actualPct: actual
        });
      } else if (planned - actual > tolerance) {
        items.push({
          taskId: st.taskId,
          title: task.title,
          kind: "behind",
          critical: st.critical,
          days: 0,
          plannedPct: planned,
          actualPct: actual
        });
      }
    }
    items.sort((a, b) => Number(b.critical) - Number(a.critical) || b.days - a.days);
    return {
      asOf,
      finish: schedule.finish,
      baselineFinish,
      delayDays,
      overThreshold: delayDays >= threshold,
      items,
      criticalAtRisk: items.filter((i) => i.critical).length
    };
  }

  // ../capabilities/scheduling/src/service.ts
  var STATUSES = ["planned", "in_progress", "done", "blocked"];
  var SchedulingService = class {
    constructor(deps) {
      __publicField(this, "deps", deps);
    }
    empty() {
      return { tasks: [] };
    }
    addTask(plan, input) {
      if (input.plannedEnd < input.plannedStart) {
        throw new FactoryError("INVALID_STATE", "plannedEnd is before plannedStart.");
      }
      const task = {
        id: this.deps.idGen.next("task"),
        projectRef: input.projectRef,
        title: input.title,
        assignee: input.assignee,
        plannedStart: input.plannedStart,
        plannedEnd: input.plannedEnd,
        status: "planned",
        progressPct: 0,
        milestone: input.milestone ?? false,
        durationDays: input.durationDays,
        earliestStart: input.earliestStart,
        sourceRef: input.sourceRef
      };
      return { ...plan, tasks: [...plan.tasks, task] };
    }
    /**
     * Remove a task and every dependency that touched it. The cleanup is the
     * point: a dependency left pointing at a deleted task makes the next
     * schedule throw, so deletion has to be a single operation the engine owns
     * rather than two the caller must remember to pair.
     */
    removeTask(plan, taskId) {
      if (!plan.tasks.some((t) => t.id === taskId)) {
        throw new FactoryError("NOT_FOUND", `Task ${taskId} not found.`);
      }
      return {
        ...plan,
        tasks: plan.tasks.filter((t) => t.id !== taskId),
        dependencies: (plan.dependencies ?? []).filter(
          (d) => d.predecessorId !== taskId && d.successorId !== taskId
        )
      };
    }
    renameTask(plan, taskId, title) {
      const clean = title.trim();
      if (!clean) throw new FactoryError("INVALID_STATE", "A task needs a title.");
      return this.mutate(plan, taskId, (t) => ({ ...t, title: clean }));
    }
    setStatus(plan, taskId, status) {
      return this.mutate(plan, taskId, (t) => ({
        ...t,
        status,
        progressPct: status === "done" ? 100 : t.progressPct
      }));
    }
    /**
     * Record how far a task has got — and WHEN it got there.
     *
     * The observation is appended to the plan's progress log as well as written
     * onto the task, because the two answer different questions. The task
     * answers "where is this now", which is all a chart needs; the log answers
     * "where was this in March", which nothing can reconstruct afterwards and
     * which the actual-progress curve is entirely made of. One entry per task
     * per day: correcting today's figure replaces today's entry rather than
     * leaving a trail of keystrokes in the record.
     */
    setProgress(plan, taskId, pct2, asOf) {
      const clamped = Math.max(0, Math.min(100, Math.round(pct2)));
      const date = asOf ?? this.deps.clock.todayIso();
      const next = this.mutate(plan, taskId, (t) => ({
        ...t,
        progressPct: clamped,
        status: clamped === 100 ? "done" : t.status === "planned" ? "in_progress" : t.status
      }));
      const log = (next.progressLog ?? []).filter((e) => !(e.taskId === taskId && e.date === date));
      return {
        ...next,
        progressLog: [...log, { taskId, date, pct: clamped }].sort(
          (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0
        )
      };
    }
    reschedule(plan, taskId, plannedStart, plannedEnd) {
      if (plannedEnd < plannedStart)
        throw new FactoryError("INVALID_STATE", "plannedEnd is before plannedStart.");
      return this.mutate(plan, taskId, (t) => ({ ...t, plannedStart, plannedEnd }));
    }
    /* ---------------------------------------------------------------------
       Network: calendar, dependencies, and the recalculation they drive.
       Every one of these returns a new Plan — the capability stays pure and
       the host owns persistence.
       --------------------------------------------------------------------- */
    /** Replace the working calendar. Durations are re-read against it on the next pass. */
    setCalendar(plan, calendar) {
      if (!calendar.workingWeekdays.length) {
        throw new FactoryError("INVALID_STATE", "A calendar needs at least one working weekday.");
      }
      return { ...plan, calendar };
    }
    /**
     * Tie two tasks together. The link is rejected if it would close a cycle —
     * checked by scheduling the result, so the answer comes from the same code
     * that would have to live with it.
     */
    link(plan, input) {
      const { predecessorId, successorId } = input;
      if (predecessorId === successorId) {
        throw new FactoryError("INVALID_STATE", "A task cannot depend on itself.");
      }
      for (const id of [predecessorId, successorId]) {
        if (!plan.tasks.some((t) => t.id === id)) {
          throw new FactoryError("NOT_FOUND", `Task ${id} not found.`);
        }
      }
      const deps = plan.dependencies ?? [];
      const type = input.type ?? "FS";
      if (deps.some(
        (d) => d.predecessorId === predecessorId && d.successorId === successorId && d.type === type
      )) {
        throw new FactoryError(
          "INVALID_STATE",
          `Those two tasks are already linked ${type}; edit the existing dependency instead.`
        );
      }
      const dep = {
        id: this.deps.idGen.next("dep"),
        predecessorId,
        successorId,
        type,
        lagDays: Math.round(input.lagDays ?? 0)
      };
      const next = { ...plan, dependencies: [...deps, dep] };
      computeSchedule(next);
      return next;
    }
    unlink(plan, dependencyId) {
      const deps = plan.dependencies ?? [];
      if (!deps.some((d) => d.id === dependencyId)) {
        throw new FactoryError("NOT_FOUND", `Dependency ${dependencyId} not found.`);
      }
      return { ...plan, dependencies: deps.filter((d) => d.id !== dependencyId) };
    }
    /** Change how long a task takes, in working days. Milestones stay at zero. */
    setDuration(plan, taskId, durationDays) {
      if (durationDays < 0) {
        throw new FactoryError("INVALID_STATE", "Duration cannot be negative.");
      }
      return this.mutate(plan, taskId, (t) => ({
        ...t,
        durationDays: t.milestone ? 0 : Math.round(durationDays)
      }));
    }
    /**
     * Pin a task to a date — what dragging a bar means. It becomes a
     * start-no-earlier-than constraint rather than a fixed date, so the task
     * still moves if a predecessor pushes it later; it simply stops drifting
     * earlier than the date a human chose.
     */
    moveTask(plan, taskId, start) {
      return this.mutate(plan, taskId, (t) => ({ ...t, earliestStart: start }));
    }
    /** Drop the pin and let the task float back to its earliest possible date. */
    unpin(plan, taskId) {
      return this.mutate(plan, taskId, (t) => ({ ...t, earliestStart: void 0 }));
    }
    /** Both CPM passes: dates, floats and the critical path. Does not mutate. */
    schedule(plan, from) {
      return computeSchedule(plan, { from });
    }
    /**
     * Rewrite every task's planned dates from the schedule. This is what makes
     * the plan's finish move on its own when a task is dragged, a duration
     * changes or a link is added.
     */
    recalculate(plan, from) {
      return applySchedule(plan, computeSchedule(plan, { from }));
    }
    /** The plan's finish — the date the last task ends. */
    finishDate(plan, from) {
      return computeSchedule(plan, { from }).finish;
    }
    /** Tasks with no float, in dependency order. */
    criticalPath(plan, from) {
      const ids = computeSchedule(plan, { from }).criticalPath;
      const byId = new Map(plan.tasks.map((t) => [t.id, t]));
      return ids.map((id) => byId.get(id)).filter(Boolean);
    }
    /* ---------------------------------------------------------------------
       Baselines
       --------------------------------------------------------------------- */
    /** Freeze the plan under a label — approval, contract signature, revision. */
    freezeBaseline(plan, label, asOf) {
      return freezeBaseline(plan, {
        id: this.deps.idGen.next("bl"),
        label,
        frozenAt: asOf ?? this.deps.clock.todayIso()
      });
    }
    /** Current dates against a frozen baseline, in working days. */
    compareToBaseline(plan, baselineId) {
      return compareToBaseline(plan, baselineId);
    }
    /** Tasks past their planned end and not done, soonest end first. */
    overdue(plan, asOf) {
      const today = asOf ?? this.deps.clock.todayIso();
      return plan.tasks.filter((t) => t.status !== "done" && t.plannedEnd < today).sort((a, b) => a.plannedEnd < b.plannedEnd ? -1 : 1);
    }
    /* ---------------------------------------------------------------------
       Derivation and tracking
       --------------------------------------------------------------------- */
    /**
     * A plan derived from a work breakdown, already put through the network so
     * its dates are the scheduled ones rather than the first-pass layout.
     *
     * `previous` is the plan being replaced, if any: progress, pinned dates and
     * frozen baselines are carried across for every task that survived the
     * re-derivation. Without that, re-deriving after a quote change would quietly
     * throw away everything the site had recorded.
     */
    fromWorkBreakdown(items, options, previous) {
      const derived = planFromWorkBreakdown(items, options);
      const merged = previous ? mergeDerivedPlan(previous, derived.plan) : derived.plan;
      return { ...derived, plan: this.recalculate(merged, options.from) };
    }
    /** Planned vs actual vs projected, over time. */
    progressCurve(plan, options) {
      return progressCurve(plan, computeSchedule(plan), {
        ...options,
        asOf: options.asOf || this.deps.clock.todayIso()
      });
    }
    /** Which tasks are late, by how much, and whether the slip crosses the line. */
    riskReport(plan, options) {
      return riskReport(plan, computeSchedule(plan), {
        ...options,
        asOf: options.asOf || this.deps.clock.todayIso()
      });
    }
    byAssignee(plan, assignee) {
      return plan.tasks.filter((t) => t.assignee === assignee);
    }
    summary(plan) {
      return STATUSES.map((status) => ({
        status,
        count: plan.tasks.filter((t) => t.status === status).length
      }));
    }
    mutate(plan, taskId, fn) {
      const idx = plan.tasks.findIndex((t) => t.id === taskId);
      if (idx === -1) throw new FactoryError("NOT_FOUND", `Task ${taskId} not found.`);
      return { ...plan, tasks: plan.tasks.map((t, i) => i === idx ? fn(t) : t) };
    }
  };

  // ../capabilities/reconciliation/src/model.ts
  var RECONCILIATION_DEFAULTS = {
    dateToleranceDays: 7,
    amountToleranceCents: 50,
    autoAcceptScore: 0.8,
    maxCombinationSize: 3,
    maxSuggestions: 5
  };
  function resolveReconciliationConfig(partial) {
    const num = (v, fallback, lo, hi) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
    };
    const d = RECONCILIATION_DEFAULTS;
    return {
      dateToleranceDays: num(partial?.dateToleranceDays, d.dateToleranceDays, 0, 180),
      amountToleranceCents: num(partial?.amountToleranceCents, d.amountToleranceCents, 0, 1e5),
      autoAcceptScore: num(partial?.autoAcceptScore, d.autoAcceptScore, 0, 1),
      maxCombinationSize: num(partial?.maxCombinationSize, d.maxCombinationSize, 1, 6),
      maxSuggestions: num(partial?.maxSuggestions, d.maxSuggestions, 1, 50)
    };
  }

  // ../capabilities/reconciliation/src/match.ts
  var W_AMOUNT_EXACT = 0.45;
  var W_AMOUNT_NEAR = 0.3;
  var W_DATE_SAME = 0.2;
  var W_DATE_NEAR = 0.12;
  var W_REFERENCE = 0.3;
  var W_COUNTERPARTY = 0.15;
  var clamp01 = (n) => Math.max(0, Math.min(1, n));
  var round2 = (n) => Math.round(n * 100) / 100;
  function daysBetween(a, b) {
    const ms = Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z");
    return Number.isFinite(ms) ? Math.abs(Math.round(ms / 864e5)) : Number.MAX_SAFE_INTEGER;
  }
  function normalise(text) {
    return String(text ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]/g, "");
  }
  function referenceQuoted(movementText, reference) {
    if (!reference) return false;
    const ref = normalise(reference);
    if (ref.length < 4) return false;
    return normalise(movementText).includes(ref);
  }
  function counterpartyNamed(movementText, counterparty) {
    if (!counterparty) return false;
    const haystack = normalise(movementText);
    const words = counterparty.split(/\s+/).map(normalise).filter((w) => w.length > 3);
    if (!words.length) return false;
    return words.some((w) => haystack.includes(w));
  }
  function directionAgrees(movement, doc) {
    return movement.amountCents < 0 ? doc.direction === "out" : doc.direction === "in";
  }
  var openAmount = (doc) => typeof doc.outstandingCents === "number" ? doc.outstandingCents : doc.amountCents;
  function score(movement, docs, config) {
    if (!docs.length) return null;
    if (!docs.every((d) => directionAgrees(movement, d))) return null;
    const reasons = ["directionAgrees"];
    const target = Math.abs(movement.amountCents);
    const total = docs.reduce((s, d) => s + openAmount(d), 0);
    const differenceCents = target - total;
    const gap = Math.abs(differenceCents);
    let points = 0;
    let partial = false;
    if (gap === 0) {
      points += W_AMOUNT_EXACT;
      reasons.push("exactAmount");
    } else if (gap <= config.amountToleranceCents) {
      points += W_AMOUNT_NEAR;
      reasons.push("amountWithinTolerance");
    } else if (docs.length === 1 && target < total && referenceQuoted(movement.text, docs[0].reference)) {
      partial = true;
      reasons.push("partialPayment");
    } else {
      return null;
    }
    const nearestDays = Math.min(...docs.map((d) => daysBetween(movement.date, d.date)));
    if (nearestDays === 0) {
      points += W_DATE_SAME;
      reasons.push("sameDate");
    } else if (nearestDays <= config.dateToleranceDays) {
      points += W_DATE_NEAR * (1 - nearestDays / (config.dateToleranceDays + 1));
      reasons.push("dateWithinTolerance");
    }
    if (docs.some((d) => referenceQuoted(movement.text, d.reference))) {
      points += W_REFERENCE;
      reasons.push("referenceQuoted");
    }
    if (docs.some((d) => counterpartyNamed(movement.text, d.counterparty))) {
      points += W_COUNTERPARTY;
      reasons.push("counterpartyNamed");
    }
    const confidence = round2(clamp01(points));
    const autoAcceptable = !partial && confidence >= config.autoAcceptScore && reasons.includes("counterpartyNamed");
    return {
      movementId: movement.id,
      docIds: docs.map((d) => d.id),
      confidence,
      reasons,
      differenceCents,
      combination: docs.length > 1,
      autoAcceptable
    };
  }
  function* subsets(docs, maxSize) {
    const n = docs.length;
    for (let size = 2; size <= Math.min(maxSize, n); size++) {
      const idx = Array.from({ length: size }, (_, i) => i);
      for (; ; ) {
        yield idx.map((i) => docs[i]);
        let k = size - 1;
        while (k >= 0 && idx[k] === n - size + k) k--;
        if (k < 0) break;
        idx[k]++;
        for (let j = k + 1; j < size; j++) idx[j] = idx[j - 1] + 1;
      }
    }
  }
  function suggestMatches(movement, candidates, config) {
    const open = candidates.filter((d) => openAmount(d) > 0);
    const singles = [];
    for (const doc of open) {
      const s = score(movement, [doc], config);
      if (s) singles.push(s);
    }
    const combos = [];
    if (config.maxCombinationSize > 1) {
      const combinable = open.filter((d) => directionAgrees(movement, d)).filter((d) => openAmount(d) < Math.abs(movement.amountCents)).slice(0, 24);
      for (const subset of subsets(combinable, config.maxCombinationSize)) {
        const s = score(movement, subset, config);
        if (s) combos.push(s);
      }
    }
    return [...singles, ...combos].sort(
      (a, b) => b.confidence - a.confidence || a.docIds.length - b.docIds.length || Math.abs(a.differenceCents) - Math.abs(b.differenceCents)
    ).slice(0, config.maxSuggestions);
  }
  function suggestForAll(movements, candidates, config) {
    const out = {};
    for (const m of movements) {
      const s = suggestMatches(m, candidates, config);
      if (s.length) out[m.id] = s;
    }
    return out;
  }
  function findInternalTransfers(movements, config) {
    const outs = movements.filter((m) => m.amountCents < 0);
    const ins = movements.filter((m) => m.amountCents > 0);
    const taken = /* @__PURE__ */ new Set();
    const found = [];
    for (const out of outs) {
      let best2 = null;
      let fitting = 0;
      for (const inc of ins) {
        if (taken.has(inc.id)) continue;
        if (out.accountRef && inc.accountRef && out.accountRef === inc.accountRef) continue;
        if (Math.abs(Math.abs(out.amountCents) - inc.amountCents) > config.amountToleranceCents)
          continue;
        const days = daysBetween(out.date, inc.date);
        if (days > config.dateToleranceDays) continue;
        fitting++;
        if (!best2 || days < best2.days) best2 = { mv: inc, days };
      }
      if (best2) {
        taken.add(best2.mv.id);
        const gap = Math.abs(Math.abs(out.amountCents) - best2.mv.amountCents);
        const reasons = [
          gap === 0 ? "oppositeAmount" : "amountWithinTolerance",
          "differentAccounts"
        ];
        if (best2.days === 0) reasons.push("sameDate");
        else reasons.push("dateWithinTolerance");
        found.push({
          outMovementId: out.id,
          inMovementId: best2.mv.id,
          amountCents: Math.abs(out.amountCents),
          daysApart: best2.days,
          reasons,
          /**
           * THE PAIR THAT IS ONLY A GUESS.
           *
           * A real quarter repeats amounts — the same 60,00 EUR transfer every
           * week, the same round top-up — and "nearest by date" then picks one
           * of several equally good candidates and says nothing. Marking that
           * pair moves two movements out of the queue and out of the profit
           * figures, and if it is the wrong two, both errors are invisible:
           * the amounts still net to zero. So the count of rivals travels with
           * the proposal, and a caller can refuse to accept in bulk what it
           * cannot tell apart.
           */
          alternatives: fitting - 1,
          ambiguous: fitting > 1
        });
      }
    }
    return found;
  }

  // ../capabilities/messaging/src/rules.ts
  var COMMS_RULE_DEFAULTS = {
    recipient: "customer",
    afterDays: 0,
    channel: "email",
    mode: "draft",
    active: true
  };
  function resolveRule(rule) {
    return {
      id: rule.id,
      label: rule.label,
      event: rule.event,
      template: rule.template,
      recipient: rule.recipient ?? COMMS_RULE_DEFAULTS.recipient,
      afterDays: rule.afterDays ?? COMMS_RULE_DEFAULTS.afterDays,
      channel: rule.channel ?? COMMS_RULE_DEFAULTS.channel,
      mode: rule.mode ?? COMMS_RULE_DEFAULTS.mode,
      requiresFlag: rule.requiresFlag,
      active: rule.active ?? COMMS_RULE_DEFAULTS.active
    };
  }
  function addDays(dateIso, days) {
    const d = /* @__PURE__ */ new Date(dateIso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function planMessages(rules, events, options) {
    const planned = [];
    for (const event of events) {
      for (const raw of rules) {
        const rule = resolveRule(raw);
        if (!rule.active) continue;
        if (rule.event !== event.event) continue;
        if (rule.requiresFlag && !event.flags?.[rule.requiresFlag]) continue;
        const dueDate = addDays(event.date, rule.afterDays);
        const to = event.recipients?.[rule.recipient] ?? null;
        planned.push({
          ruleId: rule.id,
          event: rule.event,
          subjectRef: event.subjectRef,
          template: rule.template,
          recipient: rule.recipient,
          to,
          channel: rule.channel,
          dueDate,
          mode: rule.mode,
          vars: event.vars ?? {},
          due: dueDate <= options.asOf,
          ...to ? {} : { blocked: "noRecipient" }
        });
      }
    }
    return planned.sort(
      (a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0)
    );
  }
  function newMessages(planned, existing) {
    const seen = new Set(existing);
    return planned.filter((p) => !seen.has(`${p.ruleId}|${p.subjectRef}`));
  }
  function messageKey(m) {
    return `${m.ruleId}|${m.subjectRef}`;
  }

  // ../capabilities/messaging/src/service.ts
  function renderTemplate(tpl, vars) {
    return tpl.replace(
      /\{\{\s*(\w+)\s*\}\}/g,
      (_m, key) => key in vars ? String(vars[key]) : `{{${key}}}`
    );
  }

  // ../capabilities/projects/src/forecast.ts
  var bp = (part, whole) => whole === 0 ? 0 : roundDivHalfUp(part * 1e4, Math.abs(whole));
  var DEFAULT_OVERRUN_THRESHOLD_BP = 1e3;
  var DEFAULT_MIN_PROGRESS_PCT = 10;
  function calculatedFor(budgetCents, committedCents, actualCents, progressPct) {
    const floor = Math.max(actualCents, committedCents);
    if (actualCents <= 0) return Math.max(budgetCents, floor);
    if (progressPct >= 100) return actualCents;
    if (progressPct <= 0) return Math.max(budgetCents, floor);
    const extrapolated = roundDivHalfUp(actualCents * 100, progressPct);
    return Math.max(extrapolated, floor);
  }
  function forecastToCompletion(project, input) {
    const threshold = input.overrunThresholdBp ?? DEFAULT_OVERRUN_THRESHOLD_BP;
    const minProgress = input.minProgressPct ?? DEFAULT_MIN_PROGRESS_PCT;
    const progressBy = new Map(input.progress.map((p) => [p.chapter, p.progressPct]));
    const overrideBy = new Map((input.overrides ?? []).map((o) => [o.chapter, o]));
    const chapters = /* @__PURE__ */ new Set([
      ...project.baselineByChapter.map((c) => c.chapter),
      ...project.costs.map((c) => c.chapter),
      ...project.changeOrders.filter((c) => c.status === "approved").map((c) => c.chapter)
    ]);
    const byChapter = [...chapters].map((chapter) => {
      const baseline = project.baselineByChapter.find((c) => c.chapter === chapter)?.budgetCents ?? 0;
      const approved = project.changeOrders.filter((c) => c.status === "approved" && c.chapter === chapter).reduce((s, c) => s + c.deltaCents, 0);
      const budgetCents2 = baseline + approved;
      const committedCents = project.costs.filter((c) => c.kind === "committed" && c.chapter === chapter).reduce((s, c) => s + c.amountCents, 0);
      const actualCents = project.costs.filter((c) => c.kind === "actual" && c.chapter === chapter).reduce((s, c) => s + c.amountCents, 0);
      const progressPct = Math.max(0, Math.min(100, progressBy.get(chapter) ?? 0));
      const calculatedCents = calculatedFor(budgetCents2, committedCents, actualCents, progressPct);
      const override = overrideBy.get(chapter);
      const usable = override && override.reason.trim() ? override : void 0;
      const adjustedCents = usable ? usable.costCents : null;
      const forecastCents2 = adjustedCents ?? calculatedCents;
      const varianceCents2 = forecastCents2 - budgetCents2;
      return {
        chapter,
        budgetCents: budgetCents2,
        committedCents,
        actualCents,
        progressPct,
        calculatedCents,
        adjustedCents,
        adjustmentReason: usable ? usable.reason : null,
        forecastCents: forecastCents2,
        varianceCents: varianceCents2,
        varianceBp: bp(varianceCents2, budgetCents2),
        provisional: progressPct > 0 && progressPct < minProgress && adjustedCents === null
      };
    });
    const total = (pick) => byChapter.reduce((s, c) => s + pick(c), 0);
    const budgetCents = total((c) => c.budgetCents);
    const forecastCents = total((c) => c.forecastCents);
    const varianceCents = forecastCents - budgetCents;
    const revenueCents = project.revenueCents;
    const marginForecastCents = revenueCents - forecastCents;
    return {
      byChapter,
      budgetCents,
      committedCents: total((c) => c.committedCents),
      actualCents: total((c) => c.actualCents),
      calculatedCents: total((c) => c.calculatedCents),
      forecastCents,
      varianceCents,
      varianceBp: bp(varianceCents, budgetCents),
      revenueCents,
      marginForecastCents,
      marginForecastBp: bp(marginForecastCents, revenueCents || budgetCents),
      overrunChapters: byChapter.filter((c) => c.varianceCents > 0 && c.varianceBp >= threshold).sort((a, b) => b.varianceBp - a.varianceBp).map((c) => c.chapter)
    };
  }

  // ../capabilities/projects/src/service.ts
  var bp2 = (part, whole) => whole === 0 ? 0 : roundDivHalfUp(part * 1e4, Math.abs(whole));
  var ProjectsService = class {
    constructor(deps) {
      __publicField(this, "deps", deps);
    }
    /**
     * Create a project from an accepted quote WITHOUT re-entering figures. The
     * chapter budgets and total are copied once and then frozen (PRJ baseline).
     */
    fromAcceptedQuote(input) {
      if (input.baselineByChapter.length === 0) {
        throw new FactoryError(
          "INVALID_STATE",
          "A project needs at least one chapter budget from the quote."
        );
      }
      const baselineCents = sumCents(input.baselineByChapter.map((c) => c.budgetCents));
      return {
        id: this.deps.idGen.next("prj"),
        name: input.name,
        customerRef: input.customerRef,
        sourceQuoteId: input.sourceQuoteId,
        baselineCents,
        baselineByChapter: input.baselineByChapter.map((c) => ({ ...c })),
        revenueCents: 0,
        costs: [],
        changeOrders: [],
        status: "active",
        createdAt: this.deps.clock.nowIso()
      };
    }
    bookCost(project, input) {
      this.assertActive(project);
      const entry = {
        id: this.deps.idGen.next("cost"),
        kind: input.kind,
        chapter: input.chapter,
        description: input.description,
        amountCents: input.amountCents,
        date: this.deps.clock.todayIso(),
        ref: input.ref
      };
      return { ...project, costs: [...project.costs, entry] };
    }
    recordRevenue(project, amountCents) {
      this.assertActive(project);
      return { ...project, revenueCents: project.revenueCents + amountCents };
    }
    /** Raise a change order (proposed). The baseline is never touched. */
    proposeChange(project, input) {
      this.assertActive(project);
      const co = {
        id: this.deps.idGen.next("chg"),
        chapter: input.chapter,
        description: input.description,
        deltaCents: input.deltaCents,
        status: "proposed",
        date: this.deps.clock.todayIso()
      };
      return { ...project, changeOrders: [...project.changeOrders, co] };
    }
    decideChange(project, changeId, approve) {
      const idx = project.changeOrders.findIndex((c) => c.id === changeId);
      if (idx === -1) throw new FactoryError("NOT_FOUND", `Change order ${changeId} not found.`);
      if (project.changeOrders[idx].status !== "proposed") {
        throw new FactoryError("INVALID_STATE", `Change order ${changeId} is already decided.`);
      }
      const changeOrders = project.changeOrders.map(
        (c, i) => i === idx ? { ...c, status: approve ? "approved" : "rejected" } : c
      );
      return { ...project, changeOrders };
    }
    close(project) {
      return { ...project, status: "closed" };
    }
    /** The financial truth: budget vs committed vs actual vs revenue, margin,
     *  forecast, and quoted-vs-actual per chapter. */
    financials(project) {
      const approvedChangesCents = sumCents(
        project.changeOrders.filter((c) => c.status === "approved").map((c) => c.deltaCents)
      );
      const currentBudgetCents = project.baselineCents + approvedChangesCents;
      const committedCents = sumCents(
        project.costs.filter((c) => c.kind === "committed").map((c) => c.amountCents)
      );
      const actualCents = sumCents(
        project.costs.filter((c) => c.kind === "actual").map((c) => c.amountCents)
      );
      const marginCents = project.revenueCents - actualCents;
      const forecastProfitCents = currentBudgetCents - Math.max(actualCents, committedCents);
      const marginBp = bp2(marginCents, project.revenueCents || currentBudgetCents);
      const marginBelowFloor = project.revenueCents > 0 && marginBp < this.deps.config.marginFloorBp;
      return {
        baselineCents: project.baselineCents,
        approvedChangesCents,
        currentBudgetCents,
        committedCents,
        actualCents,
        revenueCents: project.revenueCents,
        marginCents,
        marginBp,
        forecastProfitCents,
        marginBelowFloor,
        byChapter: this.marginByChapter(project)
      };
    }
    /**
     * Where the cost is heading, not where it has got to. `financials()` reports
     * what has happened; this reports what it implies — see forecast.ts for why
     * the two are different questions and why both are worth showing.
     */
    forecast(project, input) {
      return forecastToCompletion(project, input);
    }
    /** Per-chapter budget vs committed vs actual + variance (the core pain). */
    marginByChapter(project) {
      const chapters = /* @__PURE__ */ new Set([
        ...project.baselineByChapter.map((c) => c.chapter),
        ...project.costs.map((c) => c.chapter),
        ...project.changeOrders.filter((c) => c.status === "approved").map((c) => c.chapter)
      ]);
      return [...chapters].map((chapter) => {
        const baseline = project.baselineByChapter.find((c) => c.chapter === chapter)?.budgetCents ?? 0;
        const approved = sumCents(
          project.changeOrders.filter((c) => c.status === "approved" && c.chapter === chapter).map((c) => c.deltaCents)
        );
        const budgetCents = baseline + approved;
        const committedCents = sumCents(
          project.costs.filter((c) => c.kind === "committed" && c.chapter === chapter).map((c) => c.amountCents)
        );
        const actualCents = sumCents(
          project.costs.filter((c) => c.kind === "actual" && c.chapter === chapter).map((c) => c.amountCents)
        );
        const varianceCents = actualCents - budgetCents;
        return {
          chapter,
          budgetCents,
          committedCents,
          actualCents,
          varianceCents,
          varianceBp: bp2(varianceCents, budgetCents)
        };
      });
    }
    assertActive(project) {
      if (project.status !== "active") {
        throw new FactoryError("INVALID_STATE", `Project ${project.id} is closed.`);
      }
    }
  };

  // ../packs/vertical-construction-reformas/src/rates.ts
  var DAILY_OUTPUT_BY_UNIT = {
    m2: 20,
    "m\xB2": 20,
    m3: 6,
    "m\xB3": 6,
    m: 40,
    ml: 40,
    ud: 4,
    u: 4,
    pa: 1,
    // a lump sum has no quantity to speak of; it takes a day unless told otherwise
    PA: 1,
    h: 8,
    kg: 200,
    l: 200
  };
  var DAILY_OUTPUT_BY_CHAPTER = {
    "Demoliciones y trabajos previos": { m2: 30, "m\xB2": 30, m3: 8, "m\xB3": 8 },
    Estructura: { m2: 8, "m\xB2": 8, m3: 3, "m\xB3": 3 },
    "Alba\xF1iler\xEDa y tabiquer\xEDa": { m2: 12, "m\xB2": 12 },
    "Revestimientos y acabados": { m2: 14, "m\xB2": 14 },
    "Aparatos sanitarios": { ud: 3, u: 3 },
    "Carpinter\xEDa interior": { ud: 3, u: 3 },
    "Carpinter\xEDa exterior": { ud: 2, u: 2 },
    Cocina: { ud: 1, u: 1, ml: 3, m: 3 },
    Pintura: { m2: 60, "m\xB2": 60 },
    "Instalaci\xF3n el\xE9ctrica": { ud: 8, u: 8, m2: 25, "m\xB2": 25 },
    Climatizaci\u00F3n: { ud: 1, u: 1 },
    Ventilaci\u00F3n: { ud: 2, u: 2, ml: 20, m: 20 },
    Fontaner\u00EDa: { ud: 3, u: 3, ml: 15, m: 15 },
    Saneamiento: { ud: 3, u: 3, ml: 15, m: 15 },
    Telecomunicaciones: { ud: 8, u: 8 },
    "Protecci\xF3n contra incendios": { ud: 6, u: 6 }
  };
  function dailyOutputFor(lookup) {
    const unit = (lookup.unit ?? "").trim();
    if (!unit) return null;
    const sources = [
      lookup.chapter ? lookup.overridesByChapter?.[lookup.chapter] : void 0,
      lookup.chapter ? DAILY_OUTPUT_BY_CHAPTER[lookup.chapter] : void 0,
      lookup.overridesByUnit,
      DAILY_OUTPUT_BY_UNIT
    ];
    for (const table of sources) {
      const rate = table?.[unit];
      if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) return rate;
    }
    return null;
  }

  // src/index.ts
  var BrowserIdGen = class {
    constructor() {
      __publicField(this, "counter", 0);
    }
    next(prefix) {
      const uuid = globalThis.crypto?.randomUUID?.();
      if (uuid) return `${prefix}_${uuid}`;
      this.counter += 1;
      const rand = Math.random().toString(36).slice(2, 10);
      return `${prefix}_${Date.now().toString(36)}${this.counter.toString(36)}${rand}`;
    }
  };
  function defaultPorts() {
    return { clock: new SystemClock(), idGen: new BrowserIdGen() };
  }
  function createScheduling(ports = defaultPorts()) {
    const svc = new SchedulingService({
      clock: ports.clock,
      idGen: ports.idGen,
      config: {}
    });
    return {
      /** An empty plan value — callers own persistence, as capabilities are pure. */
      empty() {
        return svc.empty();
      },
      /** Count of tasks per status, in a fixed status order. */
      summary(plan) {
        return svc.summary(plan);
      },
      /** Not-done tasks past their planned end, soonest first. */
      overdue(plan, asOf) {
        return svc.overdue(plan, asOf);
      },
      /**
       * Calendar arithmetic, exposed because a chart genuinely needs it: to
       * shade the closed days on its axis and to convert a pixel drag into a
       * date. Without this the view would reimplement working-day maths beside
       * the engine that owns it, and the two would drift apart on the first
       * closure someone adds.
       */
      calendar: {
        everyDay: everyDayCalendar,
        isWorkingDay,
        addWorkingDays,
        workingDaysInclusive,
        workingDayOffset
      },
      service: svc
    };
  }
  function createProjects(ports = defaultPorts()) {
    const svc = new ProjectsService({
      clock: ports.clock,
      idGen: ports.idGen,
      config: { marginFloorBp: 1200 }
    });
    return {
      /** Where the cost is heading, per chapter and in total. */
      forecast(project, input) {
        return forecastToCompletion(project, input);
      },
      service: svc
    };
  }
  function createRates() {
    return {
      /** Daily output for a line, or null when nothing in the tables applies. */
      dailyOutputFor(lookup) {
        return dailyOutputFor(lookup);
      }
    };
  }
  function createReconciliation(config) {
    const cfg = resolveReconciliationConfig(config);
    return {
      config: cfg,
      /** What might explain one movement, best first. */
      suggest(movement, candidates) {
        return suggestMatches(movement, candidates, cfg);
      },
      /** The same for a whole statement, keyed by movement id. */
      suggestAll(movements, candidates) {
        return suggestForAll(movements, candidates, cfg);
      },
      /** Pairs that are one transfer between the tenant's own accounts. */
      internalTransfers(movements) {
        return findInternalTransfers(movements, cfg);
      }
    };
  }
  function createComms() {
    return {
      /** Fill `{{tokens}}`; unknown ones are left visible rather than blanked. */
      render(template, vars) {
        return renderTemplate(template, vars);
      },
      /** What the rules say should be queued, given what has happened. */
      plan(rules, events, asOf) {
        return planMessages(rules, events, { asOf });
      },
      /** Drop anything the caller has already queued, sent or cancelled. */
      unseen(planned, existingKeys) {
        return newMessages(planned, existingKeys);
      },
      /** The de-duplication key, exported so callers cannot drift from it. */
      key: messageKey
    };
  }
  function createExtraction(config) {
    const ports = new PortRegistry();
    ports.bind(EXTRACTION_PROFILE_PORT, ES_EXTRACTION_PROFILE, "pack/jurisdiction-es-es");
    const svc = new ExtractionService({
      ports,
      config: {
        reviewThreshold: 0.75,
        totalsToleranceCents: 2,
        maxAlternatives: 3,
        ...config ?? {}
      }
    });
    return {
      /**
       * Recognised text in, candidate fields with dots and provenance out.
       *
       * The second argument used to be the assumed issue date and still may be,
       * because callers pass one; an object carries that plus `exclude`, which
       * is how the host says who WE are so the reader cannot return our own name
       * and tax id as the issuer's. Every document names two companies.
       */
      read(text, opts) {
        const o = typeof opts === "string" ? { assumeIssueDate: opts } : opts ?? {};
        return svc.extract({ text, ...o });
      },
      /**
       * Re-run the checks over values a person has edited. The screen calls this
       * on every correction so the dots and the arithmetic move together — and
       * so a typed value is re-checked rather than merely believed.
       */
      recheck(result, corrections) {
        return svc.recheck(result, corrections);
      },
      /** The profile actually bound, for a screen that wants to say so. */
      profile() {
        return { id: ES_EXTRACTION_PROFILE.id, version: ES_EXTRACTION_PROFILE.version };
      }
    };
  }
  function createDocs() {
    return {
      /** Fills in the defaults and pulls out-of-range values back into range. */
      annexOptions(raw) {
        return resolveAnnexOptions(raw);
      },
      /** Lays the given images out as annex pages, in document order. */
      compose(images, options) {
        return composeAnnex(images, options);
      }
    };
  }
  var SURFACE_VERSION = 7;
  return __toCommonJS(index_exports);
})();

import { describe, expect, it } from "vitest";
import { PortRegistry, isFactoryError } from "@repo/kernel";
import { extractionConfigSchema, type ExtractedField, type FieldKey } from "./model";
import { EXTRACTION_PROFILE_PORT, type ExtractionProfile } from "./ports";
import { ExtractionService } from "./service";

/**
 * A profile for a country that does not exist.
 *
 * That is the point: if these tests pass, the capability cannot be carrying
 * knowledge of any real jurisdiction — no Spanish month names, no European
 * decimal comma, no national tax-id shape. Amounts here are written
 * `1_234|56`, dates `yyyy.mm.dd`, and a tax id is two letters and six digits
 * whose check digit is the digit sum modulo 10.
 */
const invented: ExtractionProfile = {
  id: "test/invented",
  version: "1.0.0",
  keywords: {
    issuerName: ["issued by"],
    issuerTaxId: ["registry no"],
    docNumber: ["doc"],
    issueDate: ["dated"],
    dueDate: ["payable"],
    netAmount: ["net"],
    taxAmount: ["levy"],
    withholdingAmount: ["retained"],
    totalAmount: ["grand total"],
    iban: ["account"],
    orderRef: ["order"],
  },
  patterns: {
    amount: /\d{1,3}(?:_\d{3})*\|\d{2}/g,
    date: /\d{4}\.\d{2}\.\d{2}/g,
    taxId: /\b[A-Z]{2}\d{6}\b/g,
    percent: /\d{1,2}\s?pct/g,
    accountNumber: /\bACC-\d{8}\b/g,
  },
  parseAmountCents(raw) {
    const m = /^(\d{1,3}(?:_\d{3})*)\|(\d{2})$/.exec(raw.trim());
    if (!m) return null;
    return Number(m[1]!.replace(/_/g, "")) * 100 + Number(m[2]);
  },
  parseDate(raw) {
    const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(raw.trim());
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  },
  parsePercentBp(raw) {
    const m = /^(\d{1,2})\s?pct$/.exec(raw.trim());
    return m ? Number(m[1]) * 100 : null;
  },
  checkTaxId(raw) {
    const value = raw.trim().toUpperCase().replace(/[\s-]/g, "");
    if (!/^[A-Z]{2}\d{6}$/.test(value)) return null;
    const digits = value.slice(2).split("").map(Number);
    const sum = digits.slice(0, 5).reduce((a, b) => a + b, 0);
    return { value, valid: sum % 10 === digits[5] };
  },
  checkAccountNumber(raw) {
    const value = raw.trim().toUpperCase();
    return /^ACC-\d{8}$/.test(value) ? { value, valid: true } : null;
  },
  expectedTaxRatesBp() {
    return [1000, 2000];
  },
};

function svc(overrides: Partial<ExtractionProfile> = {}, config = {}) {
  const ports = new PortRegistry();
  ports.bind(EXTRACTION_PROFILE_PORT, { ...invented, ...overrides }, "test/pack");
  return new ExtractionService({ ports, config: extractionConfigSchema.parse(config) });
}

const DOC = [
  "ACME SUPPLIES",
  "Issued by: Acme Supplies Ltd",
  "Registry no AB123400",
  "Doc: F-2026/0417",
  "Dated 2026.03.14",
  "Payable 2026.04.13",
  "3 cases of tiles 1_000|00",
  "Net 1_000|00",
  "Levy 20 pct 200|00",
  "Retained 50|00",
  "Grand total 1_150|00",
  "Account ACC-12345678",
].join("\n");

const field = (r: { fields: ExtractedField[] }, key: FieldKey): ExtractedField =>
  r.fields.find((f) => f.key === key)!;

describe("ExtractionService", () => {
  it("reads a whole document through a profile it has never seen", () => {
    const r = svc().extract({ text: DOC });
    expect(field(r, "issuerName").value).toBe("Acme Supplies Ltd");
    expect(field(r, "issuerTaxId").value).toBe("AB123400");
    expect(field(r, "docNumber").value).toBe("F-2026/0417");
    expect(field(r, "issueDate").value).toBe("2026-03-14");
    expect(field(r, "dueDate").value).toBe("2026-04-13");
    expect(field(r, "netAmount").value).toBe(100000);
    expect(field(r, "taxAmount").value).toBe(20000);
    expect(field(r, "withholdingAmount").value).toBe(5000);
    expect(field(r, "totalAmount").value).toBe(115000);
    expect(field(r, "iban").value).toBe("ACC-12345678");
  });

  it("never marks anything confirmed", () => {
    const r = svc().extract({ text: DOC });
    expect(r.confirmed).toBe(false);
    // …and the flag survives a round of corrections, which is when a caller
    // would be most tempted to treat the result as settled.
    expect(svc().recheck(r, { totalAmount: 115000 }).confirmed).toBe(false);
  });

  it("carries provenance for every field it found", () => {
    const r = svc().extract({ text: DOC });
    const total = field(r, "totalAmount");
    expect(r.lines[total.source!.line]).toContain("Grand total");
    expect(total.source!.text).toBe("1_150|00");
  });

  it("checks the arithmetic and says so when it does not add up", () => {
    const r = svc().extract({ text: DOC });
    expect(r.checks.find((c) => c.id === "totals")!.status).toBe("ok");

    const wrong = DOC.replace("Grand total 1_150|00", "Grand total 1_200|00");
    const bad = svc().extract({ text: wrong });
    const check = bad.checks.find((c) => c.id === "totals")!;
    expect(check.status).toBe("mismatch");
    expect(check.detail).toMatch(/but the total reads/);
    // A contradicted field must reach a human, whatever it scored.
    expect(bad.needsReview).toContain("totalAmount");
  });

  it("asks the profile which rates were law, and flags one that never was", () => {
    const ok = svc().extract({ text: DOC });
    expect(ok.checks.find((c) => c.id === "taxRate")!.status).toBe("ok");

    const odd = DOC.replace("Levy 20 pct 200|00", "Levy 20 pct 170|00").replace(
      "Grand total 1_150|00",
      "Grand total 1_120|00",
    );
    const r = svc().extract({ text: odd });
    expect(r.checks.find((c) => c.id === "taxRate")!.status).toBe("mismatch");
  });

  it("scores a valid check digit above a broken one", () => {
    const good = svc().extract({ text: DOC });
    const bad = svc().extract({ text: DOC.replace("AB123400", "AB123409") });
    expect(field(good, "issuerTaxId").confidence).toBeGreaterThan(
      field(bad, "issuerTaxId").confidence,
    );
    // Still offered — a failed check digit usually means a misread character,
    // not a fabricated supplier.
    expect(field(bad, "issuerTaxId").value).toBe("AB123409");
    expect(bad.needsReview).toContain("issuerTaxId");
  });

  it("sends unlabelled and missing fields for review", () => {
    const bare = ["ACME SUPPLIES", "1_000|00", "2026.03.14"].join("\n");
    const r = svc().extract({ text: bare });
    expect(r.needsReview).toContain("totalAmount");
    expect(field(r, "docNumber").value).toBeNull();
    expect(field(r, "docNumber").reasons).toContain("not found");
  });

  it("keeps runners-up so a correction is one tap, not retyping", () => {
    const r = svc().extract({ text: DOC });
    const net = field(r, "netAmount");
    expect(net.alternatives.length).toBeGreaterThan(0);
    expect(net.alternatives.every((a) => a.value !== 100000)).toBe(true);
  });

  it("reads a document that mixes two rates and checks the rows against the tax total", () => {
    const mixed = [
      "Issued by: Acme Supplies Ltd",
      "Registry no AB123400",
      "Dated 2026.03.14",
      "Base 10 pct 500|00 50|00",
      "Base 20 pct 500|00 100|00",
      "Net 1_000|00",
      "Levy 150|00",
      "Grand total 1_150|00",
    ].join("\n");
    const r = svc().extract({ text: mixed });
    expect(r.taxBreakdown).toHaveLength(2);
    expect(r.taxBreakdown.map((x) => x.rateBp)).toEqual([1000, 2000]);
    expect(r.checks.find((c) => c.id === "breakdown")!.status).toBe("ok");
  });

  it("re-checks against a human's correction using the same arithmetic", () => {
    const wrong = DOC.replace("Grand total 1_150|00", "Grand total 1_200|00");
    const r = svc().extract({ text: wrong });
    expect(r.checks.find((c) => c.id === "totals")!.status).toBe("mismatch");
    const fixed = svc().recheck(r, { totalAmount: 115000 });
    expect(fixed.checks.find((c) => c.id === "totals")!.status).toBe("ok");
    expect(fixed.needsReview).not.toContain("totalAmount");
  });

  it("refuses an unreadable document instead of returning empty fields", () => {
    try {
      svc().extract({ text: "   \n\n  " });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "INVALID_STATE")).toBe(true);
      expect(String(e)).toMatch(/manual entry/);
    }
  });

  it("fails loudly when no profile is bound", () => {
    const s = new ExtractionService({
      ports: new PortRegistry(),
      config: extractionConfigSchema.parse({}),
    });
    try {
      s.extract({ text: DOC });
      throw new Error("should throw");
    } catch (e) {
      expect(isFactoryError(e, "PORT_NOT_BOUND")).toBe(true);
    }
  });

  it("does not leak regex state between documents", () => {
    const s = svc();
    const first = s.extract({ text: DOC });
    const second = s.extract({ text: DOC });
    expect(second.fields.map((f) => f.value)).toEqual(first.fields.map((f) => f.value));
  });

  /* ---------------------------------------------------------------------
     The dots. A field goes green ONLY when a validator vouched for it — the
     rule the OCR spike exists to justify, and the one thing on this screen a
     confident misreading must not be able to satisfy.
     --------------------------------------------------------------------- */
  describe("verdicts", () => {
    it("turns green only where something actually checked the value", () => {
      const r = svc().extract({ text: DOC });
      // Checked: a check digit that computes, a real calendar date, and
      // arithmetic that balances.
      expect(field(r, "issuerTaxId").verdict).toBe("green");
      expect(field(r, "iban").verdict).toBe("green");
      expect(field(r, "issueDate").verdict).toBe("green");
      expect(field(r, "dueDate").verdict).toBe("green");
      expect(field(r, "netAmount").verdict).toBe("green");
      expect(field(r, "totalAmount").verdict).toBe("green");
      // Nothing can check a name, a document number or an order reference —
      // so they stay amber however cleanly they were read. (The spike never
      // once read a document number correctly off a raster.)
      expect(field(r, "issuerName").verdict).toBe("amber");
      expect(field(r, "docNumber").verdict).toBe("amber");
      expect(field(r, "issuerName").confidence).toBeGreaterThan(0.6);
    });

    it("keeps a well-read but unverifiable tax id amber, not green", () => {
      // AB123401 is perfectly shaped, sits under its own label at the head of
      // the document, and reads cleanly. Its check digit is simply wrong —
      // which is exactly the shape of the spike's A08912907.
      const doc = DOC.replace("Registry no AB123400", "Registry no AB123401");
      const r = svc().extract({ text: doc });
      const nif = field(r, "issuerTaxId");
      expect(nif.value).toBe("AB123401");
      expect(nif.validated).toBe(false);
      expect(nif.verdict).toBe("amber");
      expect(nif.reasons.join(" ")).toMatch(/fails its check digit/);
      expect(r.needsReview).toContain("issuerTaxId");
    });

    it("sends every amount amber when the arithmetic does not balance", () => {
      const wrong = DOC.replace("Grand total 1_150|00", "Grand total 1_200|00");
      const r = svc().extract({ text: wrong });
      for (const key of ["netAmount", "taxAmount", "totalAmount"] as FieldKey[]) {
        expect(field(r, key).verdict).toBe("amber");
        expect(r.needsReview).toContain(key);
      }
      // …and leaves the fields the arithmetic says nothing about alone.
      expect(field(r, "issuerTaxId").verdict).toBe("green");
    });

    it("leaves amounts amber when there was not enough to check them with", () => {
      const r = svc().extract({ text: "Issued by: Acme\nGrand total 1_150|00" });
      expect(r.checks.find((c) => c.id === "totals")!.status).toBe("unknown");
      expect(field(r, "totalAmount").value).toBe(115000);
      expect(field(r, "totalAmount").verdict).toBe("amber");
    });

    it("refuses a date that is shaped like one but is not a day", () => {
      const r = svc().extract({ text: DOC.replace("Dated 2026.03.14", "Dated 2026.02.31") });
      const d = field(r, "issueDate");
      expect(d.validated).toBe(false);
      expect(d.verdict).toBe("amber");
    });

    it("re-checks a value a person typed instead of trusting it", () => {
      const r = svc().extract({ text: DOC });
      // A hand-typed tax id with a bad check digit is still amber, however
      // certain the person was. Typing is where a digit gets transposed.
      const typedBad = svc().recheck(r, { issuerTaxId: "AB123401" });
      expect(field(typedBad, "issuerTaxId").confidence).toBe(1);
      expect(field(typedBad, "issuerTaxId").verdict).toBe("amber");
      expect(typedBad.needsReview).toContain("issuerTaxId");

      // Correcting it properly turns the dot green — the point of the dot.
      const typedGood = svc().recheck(r, { issuerTaxId: "AB123400" });
      expect(field(typedGood, "issuerTaxId").verdict).toBe("green");
      expect(typedGood.needsReview).not.toContain("issuerTaxId");
    });

    it("turns the amounts green again once a correction makes them balance", () => {
      const wrong = DOC.replace("Grand total 1_150|00", "Grand total 1_200|00");
      const r = svc().extract({ text: wrong });
      expect(field(r, "totalAmount").verdict).toBe("amber");
      const fixed = svc().recheck(r, { totalAmount: 115000 });
      expect(fixed.checks.find((c) => c.id === "totals")!.status).toBe("ok");
      expect(field(fixed, "totalAmount").verdict).toBe("green");
      expect(field(fixed, "netAmount").verdict).toBe("green");
    });

    it("never reports a field as green while it is still on the review list", () => {
      // The invariant the screen relies on: the dots and the review list are
      // two readings of one decision, not two decisions.
      for (const text of [DOC, DOC.replace("Grand total 1_150|00", "Grand total 9_999|00")]) {
        const r = svc().extract({ text });
        for (const f of r.fields) {
          if (r.needsReview.includes(f.key)) continue;
          expect(f.verdict).toBe("green");
        }
      }
    });
  });

  it("tracks which page a value came from", () => {
    const r = svc().extract({ text: ["Issued by: Acme Supplies Ltd", "Grand total 1_150|00"] });
    const totalPaged = field(r, "totalAmount");
    expect(totalPaged.source!.page).toBe(2);
  });
});

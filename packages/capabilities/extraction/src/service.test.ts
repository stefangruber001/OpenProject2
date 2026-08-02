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

  it("tracks which page a value came from", () => {
    const r = svc().extract({ text: ["Issued by: Acme Supplies Ltd", "Grand total 1_150|00"] });
    const totalPaged = field(r, "totalAmount");
    expect(totalPaged.source!.page).toBe(2);
  });
});

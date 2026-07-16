import { describe, expect, it } from "vitest";
import { EsTaxAdapter, HINT_WORKS_ON_DWELLING } from "./adapter";

const adapter = new EsTaxAdapter();
const ISSUE = "2026-07-16";

function decide(
  attributes: Record<string, string | number | boolean>,
  hint: string | undefined = HINT_WORKS_ON_DWELLING,
) {
  const { perLine } = adapter.determine({
    issueDate: ISSUE,
    attributes,
    lines: [{ lineId: "l1", baseCents: 100_000, categoryHint: hint }],
  });
  return perLine[0]!;
}

const ELIGIBLE = {
  "construction.recipient": "individual-private",
  "construction.dwellingPrivateUse": true,
  "construction.dwellingCompletedYearsAgo": 15,
  "construction.materialsShareBp": 3500,
};

describe("es-ES VAT adapter — dwelling renovation rule (art. 91.Uno.2.10º)", () => {
  it("grants the reduced rate when all conditions hold", () => {
    const d = decide(ELIGIBLE);
    expect(d.rateBp).toBe(1000);
    expect(d.taxCode).toBe("ES-IVA-REDUCIDO");
    expect(d.justification.legalBasis).toContain("91.Uno.2.10");
    expect(d.justification.legallyVerified).toBe(false);
    expect(d.justification.inputs["construction.materialsShareBp"]).toBe(3500);
  });

  it("accepts community-of-owners as recipient", () => {
    const d = decide({ ...ELIGIBLE, "construction.recipient": "community-of-owners" });
    expect(d.rateBp).toBe(1000);
  });

  it("materials share boundary: exactly 40% is still eligible", () => {
    expect(decide({ ...ELIGIBLE, "construction.materialsShareBp": 4000 }).rateBp).toBe(1000);
    const over = decide({ ...ELIGIBLE, "construction.materialsShareBp": 4001 });
    expect(over.rateBp).toBe(2100);
    expect(over.justification.explanation).toMatch(/materiales/);
  });

  it("business recipient ⇒ general rate", () => {
    const d = decide({ ...ELIGIBLE, "construction.recipient": "business" });
    expect(d.rateBp).toBe(2100);
    expect(d.taxCode).toBe("ES-IVA-GENERAL");
  });

  it("dwelling younger than 2 years ⇒ general rate", () => {
    const d = decide({ ...ELIGIBLE, "construction.dwellingCompletedYearsAgo": 1 });
    expect(d.rateBp).toBe(2100);
    expect(d.justification.explanation).toMatch(/2 años/);
  });

  it("missing eligibility data ⇒ conservative general rate", () => {
    const d = decide({});
    expect(d.rateBp).toBe(2100);
    expect(d.justification.explanation).toMatch(/faltan datos/);
  });

  it("lines without the construction hint get the general rate", () => {
    const { perLine } = adapter.determine({
      issueDate: ISSUE,
      attributes: ELIGIBLE,
      lines: [{ lineId: "l1", baseCents: 100_000 }], // no categoryHint at all
    });
    expect(perLine[0]!.rateBp).toBe(2100);
    expect(perLine[0]!.justification.ruleId).toBe("es.iva.general");
  });

  it("refuses dates before the encoded era instead of guessing", () => {
    expect(() =>
      adapter.determine({
        issueDate: "2009-01-01",
        attributes: {},
        lines: [{ lineId: "l1", baseCents: 1000 }],
      }),
    ).toThrowError(/NO_EFFECTIVE_RULE/);
  });

  it("persists provider identity and effective date in the justification", () => {
    const d = decide(ELIGIBLE);
    expect(d.justification.providerId).toBe("jurisdiction/es-ES");
    expect(d.justification.effectiveDate).toBe("2012-09-01");
    expect(d.justification.explanation).toContain(ISSUE);
  });
});

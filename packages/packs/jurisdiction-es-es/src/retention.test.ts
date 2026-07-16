import { describe, expect, it } from "vitest";
import { retentionFor } from "./retention";

describe("es-ES IRPF retention (profile-dependent, LEGAL_REVIEW #3)", () => {
  it("business (empresarial) suppliers carry no retention — the common reformas case", () => {
    expect(retentionFor("business", "2026-07-16").rateBp).toBe(0);
  });

  it("professional profiles", () => {
    expect(retentionFor("professional", "2026-07-16").rateBp).toBe(1500);
    expect(retentionFor("professional_new", "2026-07-16").rateBp).toBe(700);
    expect(retentionFor("modulos_1", "2026-07-16").rateBp).toBe(100);
  });

  it("is effective-dated and refuses pre-era dates", () => {
    expect(() => retentionFor("professional", "2014-01-01")).toThrowError(/NO_EFFECTIVE_RULE/);
    expect(retentionFor("professional", "2015-07-12").rateBp).toBe(1500);
  });

  it("never claims legal verification", () => {
    expect(retentionFor("professional", "2026-07-16").legallyVerified).toBe(false);
  });
});

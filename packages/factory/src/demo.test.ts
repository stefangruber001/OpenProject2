import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDemo } from "./demo";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SPEC = join(REPO_ROOT, "tenants/reformas-demo/tenant.yaml");

describe("P1 walking skeleton — presupuesto → factura for tenant #1", () => {
  const out = mkdtempSync(join(tmpdir(), "factory-demo-"));
  const result = runDemo(SPEC, out);

  it("composes the tenant from es-ES + construction-reformas", () => {
    expect(result.resolved.report.packs.map((p) => p.id).sort()).toEqual([
      "jurisdiction/es-ES",
      "vertical/construction-reformas",
    ]);
  });

  it("private dwelling renovation gets the reduced rate with justification", () => {
    const inv = result.invoiceEligible;
    expect(inv.displayNumber).toBe("FAC-2026-0001");
    expect(inv.baseCents).toBe(287_200);
    expect(inv.taxSummary).toEqual([
      { taxCode: "ES-IVA-REDUCIDO", rateBp: 1000, baseCents: 287_200, taxCents: 28_720 },
    ]);
    expect(inv.totalCents).toBe(315_920);
    const j = inv.taxDecisions[0]!.justification;
    expect(j.legalBasis).toContain("91.Uno.2.10");
    expect(j.providerId).toBe("jurisdiction/es-ES");
    expect(j.legallyVerified).toBe(false);
    expect(j.inputs["construction.materialsShareBp"]).toBe(3500);
  });

  it("the same works for a business client fall back to the general rate", () => {
    const inv = result.invoiceBusiness;
    expect(inv.displayNumber).toBe("FAC-2026-0002");
    expect(inv.taxSummary[0]!.rateBp).toBe(2100);
    expect(inv.totalCents).toBe(605_000);
    expect(inv.taxDecisions[0]!.justification.explanation).toMatch(/destinatario/);
  });

  it("invoices are chained (tamper evidence)", () => {
    expect(result.invoiceEligible.seal?.seq).toBe(1);
    expect(result.invoiceEligible.seal?.prevHash).toBeNull();
    expect(result.invoiceBusiness.seal?.seq).toBe(2);
    expect(result.invoiceBusiness.seal?.prevHash).toBe(result.invoiceEligible.seal?.hash);
  });

  it("writes the artifact set, in Spanish, with locale money formatting", () => {
    expect(result.files.length).toBeGreaterThanOrEqual(7);
    const html = readFileSync(
      result.files.find((f) => f.endsWith("factura-FAC-2026-0001.html"))!,
      "utf8",
    );
    expect(html).toContain("Factura FAC-2026-0001");
    expect(html).toContain("IVA");
    expect(html).toContain("3159,20");
    expect(html).toContain("Base imponible");
  });

  it("is deterministic: same spec ⇒ identical artifacts (principle 7)", () => {
    const out2 = mkdtempSync(join(tmpdir(), "factory-demo-"));
    const second = runDemo(SPEC, out2);
    const read = (r: typeof result, suffix: string) =>
      readFileSync(
        r.files.find((f) => f.endsWith(suffix))!,
        "utf8",
      );
    expect(read(second, "factura-FAC-2026-0001.json")).toBe(
      read(result, "factura-FAC-2026-0001.json"),
    );
    expect(read(second, "chain.json")).toBe(read(result, "chain.json"));
  });
});

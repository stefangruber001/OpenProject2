import { describe, expect, it } from "vitest";
import { PortRegistry } from "@repo/kernel";
import {
  EXTRACTION_PROFILE_PORT,
  ExtractionService,
  extractionConfigSchema,
  type ExtractedField,
  type FieldKey,
} from "@repo/capability-extraction";
import { ES_EXTRACTION_PROFILE } from "./profile";
import { checkIban, checkSpanishTaxId } from "./taxid";

function svc() {
  const ports = new PortRegistry();
  ports.bind(EXTRACTION_PROFILE_PORT, ES_EXTRACTION_PROFILE, "es-ES/test");
  return new ExtractionService({ ports, config: extractionConfigSchema.parse({}) });
}

const field = (r: { fields: ExtractedField[] }, key: FieldKey): ExtractedField =>
  r.fields.find((f) => f.key === key)!;

/** A supplier invoice as one actually arrives off a phone camera. */
const FACTURA = [
  "MATERIALES VALLES S.A.",
  "C/ Industria 44, 08191 Rubí (Barcelona)",
  "CIF: A08123457",
  "Factura nº 2026/A-1187",
  "Fecha de factura: 14/03/2026",
  "Vencimiento: 13/04/2026",
  "Su pedido: OB-2026-014",
  "",
  "Descripción            Cantidad   Precio      Importe",
  "Azulejo porcelánico       45,00     18,20      819,00",
  "Cemento cola sacos        12,00     14,25      171,00",
  "",
  "Base imponible                                990,00",
  "IVA 21%                                       207,90",
  "TOTAL FACTURA                               1.197,90",
  "Domiciliación IBAN: ES91 2100 0418 4502 0005 1332",
].join("\n");

describe("Spanish extraction profile", () => {
  it("reads a supplier invoice written the way they are written here", () => {
    const r = svc().extract({ text: FACTURA });
    expect(field(r, "issuerTaxId").value).toBe("A08123457");
    expect(field(r, "issueDate").value).toBe("2026-03-14");
    expect(field(r, "dueDate").value).toBe("2026-04-13");
    expect(field(r, "netAmount").value).toBe(99000);
    expect(field(r, "taxAmount").value).toBe(20790);
    expect(field(r, "totalAmount").value).toBe(119790);
    expect(field(r, "iban").value).toBe("ES9121000418450200051332");
    expect(field(r, "orderRef").value).toBe("OB-2026-014");
  });

  /**
   * THE OPERATOR'S OWN INVOICE, transcribed from the PDF's text layer exactly
   * as pdf.js hands it over — the wrapped issuer name, the number under its
   * heading, the two tax ids, the «OBRA / REFERENCIA» block over its contents.
   *
   * Before PK10-S4 this document returned NOTHING for the issuer, its tax id
   * or the document number, and «/ REFERENCIA» — the remainder of a heading —
   * for the job reference. Every failure was in the rules, not the reading:
   * this is the text layer, so OCR had nothing to do with it.
   */
  const CERDA = [
    "SUMINISTROS CERDA",
    "MATERIALS, S.L.",
    "FACTURA",
    "N.o F-2026/4471",
    "Fecha: 18/09/2026",
    "Vencimiento: 18/10/2026",
    "C.I.F. B-62889417 · Poligon Industrial Can Salvatella, nau 14, 08210 Barbera del Valles (Barcelona) · Tel. 937 118 240",
    "FACTURAR A",
    "DIORCA REFORMAS, S.L.",
    "C.I.F. B-66123456",
    "Calle Rafael Casanova 12",
    "08750 Molins de Rei (Barcelona)",
    "OBRA / REFERENCIA",
    "Reforma de aseos — local comercial",
    "Carrer del Comerc 44, bajos · 08003 Barcelona",
    "Contrato: CTR-2026-0004",
    "Presupuesto: PRE-2026-0009",
    "Albaran: ALB-2026/9903 de 16/09/2026",
    "Base imponible 2.483,80 €",
    "I.V.A. 21% 521,60 €",
    "TOTAL FACTURA 3.005,40 €",
  ].join("\n");

  it("reads the four fields a real invoice states and a label-driven reader missed", () => {
    const r = svc().extract({ text: CERDA });
    // The name is not labelled anywhere, and it wraps onto a second line.
    expect(field(r, "issuerName").value).toBe("SUMINISTROS CERDA MATERIALS, S.L.");
    // «C.I.F. B-62889417» — the letter is separated from the digits.
    expect(field(r, "issuerTaxId").value).toBe("B62889417");
    // «FACTURA» heads the block; «N.o» announces the value on the next line.
    expect(field(r, "docNumber").value).toBe("F-2026/4471");
    // The reference that ties the document to work of ours, rather than the
    // second half of the heading that announced it.
    expect(field(r, "orderRef").value).toBe("CTR-2026-0004");
  });

  it("takes the issuer's tax id, not the one belonging to whoever is billed", () => {
    const r = svc().extract({ text: CERDA });
    expect(field(r, "issuerTaxId").value).not.toBe("B66123456");
    // …and says so even when the customer's number is the one that validates:
    // this document's issuer CIF is invented, so it cannot pass its check.
    expect(field(r, "issuerTaxId").validated).toBe(false);
    expect(field(r, "issuerTaxId").verdict).toBe("amber");
  });

  it("still finds the issuer when the caller says who it is not", () => {
    const r = svc().extract({
      text: CERDA,
      exclude: { names: ["DIORCA REFORMAS, S.L."], taxIds: ["B-66123456"] },
    });
    expect(field(r, "issuerName").value).toBe("SUMINISTROS CERDA MATERIALS, S.L.");
    expect(field(r, "issuerTaxId").value).toBe("B62889417");
  });

  it("derives the tax when the photograph loses its label, and says it was derived", () => {
    /* What the operator's phone actually did to «I.V.A. 21% 521,60 €»: the
       amount survived and the words naming it did not, so the reader had a
       number it could not attribute — «found amounts, but none of them was
       labelled as this field» — and left the field empty. A split row is not
       this case: the label-above rule already recovers that one. */
    const broken = CERDA.replace("I.V.A. 21% 521,60 €", "521,60 €");
    const r = svc().extract({ text: broken });
    expect(field(r, "taxAmount").value).toBe(52160);
    expect(field(r, "taxAmount").reasons.join(" ")).toMatch(/derived/);
    // Derived is not checked, and a derived value never wears a green dot.
    expect(field(r, "taxAmount").validated).toBe(false);
    expect(r.checks.find((c) => c.id === "totals")!.status).toBe("ok");
  });

  it("reconciles the arithmetic and the rate against the law of that date", () => {
    const r = svc().extract({ text: FACTURA });
    expect(r.checks.find((c) => c.id === "totals")!.status).toBe("ok");
    expect(r.checks.find((c) => c.id === "taxRate")!.status).toBe("ok");
    expect(r.confirmed).toBe(false);
  });

  it("flags a rate that was never in force", () => {
    // 17 % has never been a Spanish rate in the encoded era.
    const odd = FACTURA.replace("IVA 21%", "IVA 17%")
      .replace("207,90", "168,30")
      .replace("1.197,90", "1.158,30");
    const r = svc().extract({ text: odd });
    expect(r.checks.find((c) => c.id === "taxRate")!.status).toBe("mismatch");
  });

  it("reads a self-employed invoice with withholding", () => {
    const autonomo = [
      "JOSEP MARIA SOLÉ — Fontanería",
      "NIF 46000000T",
      "Factura nº 2026-031",
      "Fecha: 2 de abril de 2026",
      "Base imponible 1.500,00",
      "IVA 21% 315,00",
      "Retención IRPF 15% -225,00",
      "Total a pagar 1.590,00",
    ].join("\n");
    const r = svc().extract({ text: autonomo });
    expect(field(r, "issuerTaxId").value).toBe("46000000T");
    expect(field(r, "issueDate").value).toBe("2026-04-02");
    expect(field(r, "netAmount").value).toBe(150000);
    expect(field(r, "taxAmount").value).toBe(31500);
    // The withholding is stated negative on the page; the arithmetic check
    // works either way round, and the totals reconcile.
    expect(Math.abs(field(r, "withholdingAmount").value as number)).toBe(22500);
    expect(field(r, "totalAmount").value).toBe(159000);
  });

  it("sends a tax id that fails its check character for review", () => {
    // 46000000X is the id the legacy mock data used; T is the correct letter.
    const r = svc().extract({ text: FACTURA.replace("A08123457", "46000000X") });
    expect(r.needsReview).toContain("issuerTaxId");
    expect(field(r, "issuerTaxId").confidence).toBeLessThanOrEqual(0.5);
  });

  it("understands both date notations and refuses an impossible one", () => {
    const p = ES_EXTRACTION_PROFILE;
    expect(p.parseDate("14/03/2026")).toBe("2026-03-14");
    expect(p.parseDate("14-3-26")).toBe("2026-03-14");
    expect(p.parseDate("2 de abril de 2026")).toBe("2026-04-02");
    expect(p.parseDate("2 de abril del 2026")).toBe("2026-04-02");
    expect(p.parseDate("31/02/2026")).toBeNull();
    expect(p.parseDate("marzo 2026")).toBeNull();
  });

  it("reads money the way it is written here, and refuses what is not money", () => {
    const p = ES_EXTRACTION_PROFILE;
    expect(p.parseAmountCents("1.197,90")).toBe(119790);
    expect(p.parseAmountCents("990,00 €")).toBe(99000);
    expect(p.parseAmountCents("-225,00")).toBe(-22500);
    expect(p.parseAmountCents("1,234.56")).toBeNull(); // that notation is not used here
    expect(p.parseAmountCents("2026")).toBeNull();
  });

  it("resolves the rates in force from the effective-dated tables", () => {
    const p = ES_EXTRACTION_PROFILE;
    expect(p.expectedTaxRatesBp("2026-03-14")).toEqual([2100, 1000, 400, 0]);
    // Before the earliest encoded era the tables refuse to guess, and so does
    // the profile: it returns only the "no tax" case rather than inventing one.
    expect(p.expectedTaxRatesBp("1999-01-01")).toEqual([0]);
  });
});

describe("Spanish tax identifiers", () => {
  it("validates a NIF, a NIE and a CIF", () => {
    expect(checkSpanishTaxId("46000000T")).toEqual({
      value: "46000000T",
      valid: true,
      kind: "nif",
    });
    expect(checkSpanishTaxId("X1234567L")).toEqual({
      value: "X1234567L",
      valid: true,
      kind: "nie",
    });
    expect(checkSpanishTaxId("A08123457")!.valid).toBe(true);
  });

  it("rejects a wrong check character without rejecting the shape", () => {
    const wrong = checkSpanishTaxId("46000000X")!;
    expect(wrong.kind).toBe("nif");
    expect(wrong.valid).toBe(false);
  });

  it("normalises punctuation and case", () => {
    expect(checkSpanishTaxId("a-08.123.457")!.value).toBe("A08123457");
    expect(checkSpanishTaxId("not-an-id")).toBeNull();
  });

  it("validates an IBAN by its modulus-97 check", () => {
    expect(checkIban("ES91 2100 0418 4502 0005 1332")).toEqual({
      value: "ES9121000418450200051332",
      valid: true,
    });
    expect(checkIban("ES91 2100 0418 4502 0005 1333")!.valid).toBe(false);
    expect(checkIban("hola")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { Invoice } from "./model";
import { DEFAULT_LABELS } from "./ports";
import { renderInvoiceHtml } from "./render";

const invoice: Invoice = {
  id: "inv_0001",
  tenantId: "t1",
  kind: "standard",
  series: "INV",
  number: 1,
  displayNumber: "INV-2026-0001",
  issueDate: "2026-07-16",
  currency: "EUR",
  seller: { name: "Seller & Co", taxId: "X1" },
  buyer: { name: "Buyer <SL>" },
  lines: [
    {
      id: "l1",
      description: "Work item",
      unit: "u",
      qtyMillis: 12_500,
      unitCents: 1840,
      totalCents: 23_000,
    },
  ],
  taxDecisions: [],
  taxSummary: [{ taxCode: "T", rateBp: 1000, baseCents: 23_000, taxCents: 2300 }],
  baseCents: 23_000,
  taxCents: 2300,
  totalCents: 25_300,
};

describe("invoice rendering", () => {
  it("renders deterministic, escaped HTML with locale formatting", () => {
    const a = renderInvoiceHtml(invoice, DEFAULT_LABELS, "es-ES");
    const b = renderInvoiceHtml(invoice, DEFAULT_LABELS, "es-ES");
    expect(a).toBe(b);
    expect(a).toContain("INV-2026-0001");
    expect(a).toContain("Buyer &lt;SL&gt;");
    expect(a).toContain("Seller &amp; Co");
    expect(a).toContain("253,00");
    expect(a).toContain("12,5");
  });
});

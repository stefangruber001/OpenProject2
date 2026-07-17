import {
  FixedClock,
  InMemoryAppendOnlyStore,
  InMemoryCounterStore,
  InMemoryEventLog,
  PortRegistry,
  SeqIdGen,
  isFactoryError,
} from "@repo/kernel";
import { describe, expect, it } from "vitest";
import type { BillingConfig, Invoice } from "./model";
import { BillingService, type BillableSource } from "./service";
import { TAX_PORT, type TaxPort } from "./ports";

const FLAT_RATE_BP = 1500;

/** Context-free fake adapter — proves billing carries no tax knowledge. */
const fakeTax: TaxPort = {
  determine({ issueDate, lines }) {
    return {
      perLine: lines.map((l) => ({
        lineId: l.lineId,
        taxCode: "FAKE-FLAT",
        rateBp: FLAT_RATE_BP,
        justification: {
          ruleId: "fake.flat",
          legalBasis: "test fixture",
          effectiveDate: issueDate,
          providerId: "test/fake",
          providerVersion: "0.0.0",
          legallyVerified: false,
          explanation: "flat rate for tests",
          inputs: {},
        },
      })),
    };
  },
};

const config: BillingConfig = {
  seller: { name: "Seller Co", taxId: "X1", address: "1 Test St" },
  series: [
    { id: "INV", kind: "standard", pad: 4, yearly: true },
    { id: "COR", kind: "rectificative", pad: 4, yearly: true },
  ],
};

function setup(withTax = true) {
  const ports = new PortRegistry();
  if (withTax) ports.bind(TAX_PORT, fakeTax, "test/fake");
  const make = () =>
    new BillingService({
      tenantId: "t1",
      currency: "EUR",
      config,
      ports,
      store: new InMemoryAppendOnlyStore<Invoice>(),
      counters: new InMemoryCounterStore(),
      clock: new FixedClock("2026-07-16"),
      idGen: new SeqIdGen(),
      events: new InMemoryEventLog(),
    });
  return { ports, make };
}

/** Structural stand-in for an accepted quote (capabilities stay decoupled). */
function acceptedQuote(status = "accepted"): BillableSource {
  return {
    id: "quote_0001",
    status,
    currency: "EUR",
    lines: [
      { id: "l1", description: "work", qtyMillis: 10_000, unitCents: 5000, totalCents: 50_000 },
      { id: "l2", description: "more", qtyMillis: 1000, unitCents: 49_999, totalCents: 49_999 },
    ],
  };
}

describe("billing", () => {
  it("refuses to exist without a tax adapter (loud, early)", () => {
    const { make } = setup(false);
    try {
      make();
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "PORT_NOT_BOUND")).toBe(true);
      expect((e as Error).message).toMatch(/tax@1/);
    }
  });

  it("issues an immutable invoice with persisted tax decisions", async () => {
    const { make } = setup();
    const billing = make();
    const invoice = await billing.issueFromQuote(acceptedQuote(), {
      buyer: { name: "Buyer" },
      seriesId: "INV",
    });
    expect(invoice.displayNumber).toBe("INV-2026-0001");
    expect(invoice.baseCents).toBe(99_999);
    expect(invoice.taxSummary).toHaveLength(1);
    expect(invoice.taxCents).toBe(15_000); // group-rounded 15% of 999.99
    expect(invoice.totalCents).toBe(114_999);
    expect(invoice.taxDecisions[0]?.justification.providerId).toBe("test/fake");
    expect(Object.isFrozen(invoice)).toBe(true);
    expect(Object.isFrozen(invoice.lines[0])).toBe(true);
  });

  it("numbers gapless per series and resets yearly", async () => {
    const { make } = setup();
    const billing = make();
    const q = acceptedQuote();
    const a = await billing.issueFromQuote(q, { buyer: { name: "B" }, seriesId: "INV" });
    const b = await billing.issueFromQuote(q, { buyer: { name: "B" }, seriesId: "INV" });
    const c = await billing.issueFromQuote(q, {
      buyer: { name: "B" },
      seriesId: "INV",
      issueDate: "2027-01-02",
    });
    expect(a.displayNumber).toBe("INV-2026-0001");
    expect(b.displayNumber).toBe("INV-2026-0002");
    expect(c.displayNumber).toBe("INV-2027-0001");
  });

  it("rejects draft quotes and wrong series kinds", async () => {
    const { make } = setup();
    const billing = make();
    await expect(
      billing.issueFromQuote(acceptedQuote("draft"), { buyer: { name: "B" }, seriesId: "INV" }),
    ).rejects.toThrowError(/INVALID_STATE/);
    await expect(
      billing.issueFromQuote(acceptedQuote(), { buyer: { name: "B" }, seriesId: "COR" }),
    ).rejects.toThrowError(/INVALID_STATE/);
  });

  it("rectifies via a negative invoice in a rectificative series", async () => {
    const { make } = setup();
    const billing = make();
    const original = await billing.issueFromQuote(acceptedQuote(), {
      buyer: { name: "B" },
      seriesId: "INV",
    });
    await expect(
      billing.rectify(original.id, { buyer: { name: "B" }, seriesId: "INV", reason: "bad" }),
    ).rejects.toThrowError(/rectificative/);
    const correction = await billing.rectify(original.id, {
      buyer: { name: "B" },
      seriesId: "COR",
      reason: "pricing error",
    });
    expect(correction.kind).toBe("rectificative");
    expect(correction.rectifies).toBe(original.id);
    expect(correction.totalCents).toBe(-original.totalCents);
    expect(correction.displayNumber).toBe("COR-2026-0001");
  });
});

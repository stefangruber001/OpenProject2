import { describe, expect, it } from "vitest";
import { EsInvoiceChainAdapter } from "./chain";

const record = (n: string, total: number) => ({
  tenantId: "t1",
  series: "FAC",
  displayNumber: n,
  issueDate: "2026-07-16",
  totalCents: total,
});

describe("es-ES invoice chain", () => {
  it("links each seal to the previous hash", async () => {
    const chain = new EsInvoiceChainAdapter();
    const a = await chain.seal(record("FAC-2026-0001", 100));
    const b = await chain.seal(record("FAC-2026-0002", 200));
    expect(a.seq).toBe(1);
    expect(a.prevHash).toBeNull();
    expect(b.seq).toBe(2);
    expect(b.prevHash).toBe(a.hash);
    expect(b.hash).not.toBe(a.hash);
  });

  it("is deterministic for identical histories", async () => {
    const c1 = new EsInvoiceChainAdapter();
    const c2 = new EsInvoiceChainAdapter();
    expect((await c1.seal(record("X", 1))).hash).toBe((await c2.seal(record("X", 1))).hash);
  });

  it("any field change changes the hash (tamper evidence)", async () => {
    const c1 = new EsInvoiceChainAdapter();
    const c2 = new EsInvoiceChainAdapter();
    expect((await c1.seal(record("X", 1))).hash).not.toBe((await c2.seal(record("X", 2))).hash);
  });
});

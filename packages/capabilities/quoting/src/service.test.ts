import {
  FixedClock,
  InMemoryEventLog,
  InMemoryRepository,
  SeqIdGen,
  isFactoryError,
} from "@repo/kernel";
import { describe, expect, it } from "vitest";
import type { Quote } from "./model";
import { QuotingService } from "./service";

function service() {
  return new QuotingService({
    tenantId: "t1",
    currency: "EUR",
    store: new InMemoryRepository<Quote>(),
    clock: new FixedClock("2026-07-16"),
    idGen: new SeqIdGen(),
    events: new InMemoryEventLog(),
  });
}

describe("quoting", () => {
  it("totals lines with integer math", async () => {
    const svc = service();
    const q = await svc.create("Job A");
    await svc.addLine(q.id, { description: "a", qtyMillis: 12_500, unitCents: 1840 });
    await svc.addLine(q.id, { description: "b", qtyMillis: 24_750, unitCents: 3200 });
    await svc.addLine(q.id, { description: "c", qtyMillis: 1000, unitCents: 185_000 });
    expect((await svc.get(q.id)).baseCents).toBe(287_200);
  });

  it("freezes accepted quotes and blocks further edits", async () => {
    const svc = service();
    const q = await svc.create("Job B");
    await svc.addLine(q.id, { description: "a", qtyMillis: 1000, unitCents: 100 });
    const accepted = await svc.accept(q.id);
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(Object.isFrozen(accepted.lines[0])).toBe(true);
    try {
      await svc.addLine(q.id, { description: "late", qtyMillis: 1000, unitCents: 100 });
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "IMMUTABLE")).toBe(true);
    }
  });

  it("refuses to accept an empty quote", async () => {
    const svc = service();
    const q = await svc.create("Empty");
    await expect(svc.accept(q.id)).rejects.toThrowError(/INVALID_STATE/);
  });
});

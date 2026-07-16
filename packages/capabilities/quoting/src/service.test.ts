import { FixedClock, InMemoryEventLog, SeqIdGen, isFactoryError } from "@repo/kernel";
import { describe, expect, it } from "vitest";
import { QuotingService } from "./service";

function service() {
  return new QuotingService({
    tenantId: "t1",
    currency: "EUR",
    clock: new FixedClock("2026-07-16"),
    idGen: new SeqIdGen(),
    events: new InMemoryEventLog(),
  });
}

describe("quoting", () => {
  it("totals lines with integer math", () => {
    const svc = service();
    const q = svc.create("Job A");
    svc.addLine(q.id, { description: "a", qtyMillis: 12_500, unitCents: 1840 });
    svc.addLine(q.id, { description: "b", qtyMillis: 24_750, unitCents: 3200 });
    svc.addLine(q.id, { description: "c", qtyMillis: 1000, unitCents: 185_000 });
    expect(svc.get(q.id).baseCents).toBe(287_200);
  });

  it("freezes accepted quotes and blocks further edits", () => {
    const svc = service();
    const q = svc.create("Job B");
    svc.addLine(q.id, { description: "a", qtyMillis: 1000, unitCents: 100 });
    const accepted = svc.accept(q.id);
    expect(Object.isFrozen(accepted)).toBe(true);
    expect(Object.isFrozen(accepted.lines[0])).toBe(true);
    try {
      svc.addLine(q.id, { description: "late", qtyMillis: 1000, unitCents: 100 });
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "IMMUTABLE")).toBe(true);
    }
  });

  it("refuses to accept an empty quote", () => {
    const svc = service();
    const q = svc.create("Empty");
    expect(() => svc.accept(q.id)).toThrowError(/INVALID_STATE/);
  });
});

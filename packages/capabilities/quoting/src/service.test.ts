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
    clock: new FixedClock("2026-07-17"),
    idGen: new SeqIdGen(),
    events: new InMemoryEventLog(),
  });
}

describe("quoting", () => {
  it("totals base and optional lines separately (options never inflate the base)", async () => {
    const svc = service();
    const q = await svc.create("Job A");
    await svc.addLine(q.id, { description: "a", qtyMillis: 12_500, unitCents: 1840 });
    await svc.addLine(q.id, { description: "b", qtyMillis: 24_750, unitCents: 3200 });
    await svc.addLine(q.id, { description: "c", qtyMillis: 1000, unitCents: 185_000 });
    await svc.addLine(q.id, {
      description: "premium extra",
      qtyMillis: 1000,
      unitCents: 50_000,
      optional: true,
    });
    const quote = await svc.get(q.id);
    expect(quote.baseCents).toBe(287_200);
    expect(quote.optionalCents).toBe(50_000);
  });

  it("acceptance includes only chosen options and records them", async () => {
    const svc = service();
    const q = await svc.create("Job B");
    await svc.addLine(q.id, { description: "base", qtyMillis: 1000, unitCents: 10_000 });
    const opt1 = (
      await svc.addLine(q.id, {
        description: "opt 1",
        qtyMillis: 1000,
        unitCents: 5000,
        optional: true,
      })
    ).lines.at(-1)!;
    await svc.addLine(q.id, {
      description: "opt 2",
      qtyMillis: 1000,
      unitCents: 7000,
      optional: true,
    });

    const accepted = await svc.accept(q.id, { includeOptionIds: [opt1.id] });
    expect(accepted.lines).toHaveLength(2); // base + chosen option
    expect(accepted.baseCents).toBe(10_000);
    expect(accepted.optionalCents).toBe(5000);
    expect(accepted.acceptedOptionIds).toEqual([opt1.id]);
    expect(Object.isFrozen(accepted)).toBe(true);
  });

  it("rejects accepting a base line as an option, or edits after acceptance", async () => {
    const svc = service();
    const q = await svc.create("Job C");
    const withLine = await svc.addLine(q.id, {
      description: "base",
      qtyMillis: 1000,
      unitCents: 100,
    });
    const baseLine = withLine.lines[0]!;
    await expect(svc.accept(q.id, { includeOptionIds: [baseLine.id] })).rejects.toThrowError(
      /base scope/,
    );
    await svc.accept(q.id);
    try {
      await svc.addLine(q.id, { description: "late", qtyMillis: 1000, unitCents: 100 });
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "IMMUTABLE")).toBe(true);
      expect((e as Error).message).toMatch(/revise/);
    }
  });

  it("refuses to accept an empty quote", async () => {
    const svc = service();
    const q = await svc.create("Empty");
    await expect(svc.accept(q.id)).rejects.toThrowError(/INVALID_STATE/);
  });

  it("revise() creates the next linked version as a mutable draft, frozen source intact", async () => {
    const svc = service();
    const q = await svc.create("Job D");
    await svc.addLine(q.id, { description: "base", qtyMillis: 1000, unitCents: 10_000 });
    const v1 = await svc.accept(q.id);
    expect(v1.version).toBe(1);

    const v2 = await svc.revise(q.id);
    expect(v2.version).toBe(2);
    expect(v2.revisionOf).toBe(v1.id);
    expect(v2.status).toBe("draft");

    await svc.addLine(v2.id, { description: "added in v2", qtyMillis: 1000, unitCents: 2000 });
    const v2now = await svc.get(v2.id);
    expect(v2now.baseCents).toBe(12_000);
    // the accepted v1 snapshot is untouched and still frozen
    const v1again = await svc.get(v1.id);
    expect(v1again.baseCents).toBe(10_000);
    expect(Object.isFrozen(v1again)).toBe(true);
  });
});

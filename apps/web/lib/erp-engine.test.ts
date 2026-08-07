/**
 * The engine has to work on this side of the network, unchanged.
 *
 * These are not tests of the engine — `tests/simulation/year-sim.mjs` does that
 * far more thoroughly. They test the IMPORT: that the UMD module resolves from
 * inside the Next app, that the class instantiates, that state round-trips
 * through JSON the way the store will store it, and that the migration ladder
 * is reachable. Every one of those is a way the server can be wired up wrong
 * while the engine itself is perfect.
 */
import { describe, expect, it } from "vitest";
import { ERP, Migrations } from "./erp-engine";

describe("the ERP engine, loaded server-side", () => {
  it("instantiates with an injected date", () => {
    const erp = new ERP("2026-03-01");
    expect(erp.state.today).toBe("2026-03-01");
  });

  it("does the actual work — a party gets a code and lands in the register", () => {
    const erp = new ERP("2026-03-01") as unknown as {
      state: { parties: { name: string; code: string }[]; audit: unknown[] };
      addParty: (p: Record<string, unknown>, user: string) => unknown;
    };
    erp.addParty(
      { name: "Test Cliente S.L.", taxId: "B66666666", roles: ["customer"], active: true },
      "server-test",
    );
    expect(erp.state.parties).toHaveLength(1);
    expect(erp.state.parties[0]?.name).toBe("Test Cliente S.L.");
    // Every mutation is supposed to be attributable — that is the whole reason
    // the command API takes the user from the session rather than the body.
    expect(erp.state.audit.length).toBeGreaterThan(0);
  });

  it("round-trips through JSON, which is how it will be stored", () => {
    const erp = new ERP("2026-03-01");
    const wire = JSON.parse(JSON.stringify(erp.toJSON()));
    const restored = ERP.from(wire);
    expect(restored.state.today).toBe("2026-03-01");
    expect(restored.toJSON()).toEqual(erp.toJSON());
  });

  it("ERP.from backfills collections a stored blob predates", () => {
    const stale = { today: "2026-03-01", seq: { id: 1 }, parties: [] } as never;
    const restored = ERP.from(stale);
    // The engine declares ~36 collections; an old blob missing them must not
    // make the first `state.x.filter(...)` throw somewhere far from the cause.
    expect(Array.isArray(restored.state.invoices)).toBe(true);
    expect(Array.isArray(restored.state.audit)).toBe(true);
  });

  it("the migration ladder is reachable and idempotent", () => {
    const v1 = { today: "2026-03-01", seq: { id: 1 } } as never;
    const once = Migrations.migrate(v1);
    expect(once.to).toBe(Migrations.CURRENT_VERSION);
    const twice = Migrations.migrate(once.state);
    expect(twice.applied).toEqual([]);
    expect(twice.state).toEqual(once.state);
  });

  it("refuses a blob newer than this build rather than reseeding over it", () => {
    const future = { today: "2026-03-01", seq: { id: 1 }, schemaVersion: 999 } as never;
    expect(() => Migrations.migrate(future)).toThrow();
  });

  it("holds no browser globals — it must run where there is no window", () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(() => new ERP("2026-03-01")).not.toThrow();
  });
});

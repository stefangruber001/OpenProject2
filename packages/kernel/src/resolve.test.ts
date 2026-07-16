import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isFactoryError } from "./errors";
import { PortRegistry } from "./ports";
import { resolveTenant, type Registries } from "./resolve";
import type { CapabilityManifest, PackManifest } from "./spec";

const CAP_NEEDS_PORT: CapabilityManifest = {
  id: "capX",
  version: "1.0.0",
  requiredPorts: ["portx@1"],
};

const PACK_A: PackManifest = {
  id: "jurisdiction/aa-AA",
  shortId: "aa-AA",
  layer: "jurisdiction",
  version: "1.0.0",
  kernelRange: "^1",
  configSchema: z.object({ flag: z.boolean().default(false) }),
  register(binder) {
    binder.bind("portx@1", { hello: "aa" });
  },
};

const PACK_B_CONFLICT: PackManifest = {
  id: "vertical/vv",
  shortId: "vv",
  layer: "vertical",
  version: "1.0.0",
  kernelRange: "^1",
  register(binder) {
    binder.bind("portx@1", { hello: "vv" });
  },
};

const baseConfig = {
  locale: "xx-XX",
  currency: "EUR",
  branding: { legalName: "Test Co" },
};

function registries(overrides?: Partial<Registries>): Registries {
  return {
    capabilities: new Map([[CAP_NEEDS_PORT.id, CAP_NEEDS_PORT]]),
    packs: [PACK_A, PACK_B_CONFLICT],
    ...overrides,
  };
}

describe("resolveTenant", () => {
  it("composes packs, validates config, binds ports", () => {
    const resolved = resolveTenant(
      {
        tenant: "t1",
        capabilities: ["capX"],
        jurisdiction: "aa-AA@2026-07-16",
        config: { ...baseConfig, jurisdiction: {} },
      },
      registries(),
    );
    expect(resolved.ports.has("portx@1")).toBe(true);
    expect(resolved.report.packs[0]?.id).toBe("jurisdiction/aa-AA");
    expect((resolved.config.jurisdiction as { flag: boolean }).flag).toBe(false);
  });

  it("fails loudly when a required port has no provider (no jurisdiction selected)", () => {
    try {
      resolveTenant({ tenant: "t1", capabilities: ["capX"], config: baseConfig }, registries());
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "MISSING_PORT_IMPLEMENTATION")).toBe(true);
      expect((e as Error).message).toMatch(/portx@1/);
      expect((e as Error).message).toMatch(/jurisdiction/i);
    }
  });

  it("detects conflicting port implementations at resolve time", () => {
    try {
      resolveTenant(
        {
          tenant: "t1",
          capabilities: ["capX"],
          jurisdiction: "aa-AA",
          vertical: "vv",
          config: { ...baseConfig, jurisdiction: {} },
        },
        registries(),
      );
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "PORT_CONFLICT")).toBe(true);
    }
  });

  it("rejects unknown packs with the known list", () => {
    try {
      resolveTenant(
        { tenant: "t1", capabilities: ["capX"], jurisdiction: "zz-ZZ", config: baseConfig },
        registries(),
      );
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "UNKNOWN_PACK")).toBe(true);
      expect((e as Error).message).toMatch(/aa-AA/);
    }
  });

  it("rejects config keys no fragment claims (config drift)", () => {
    try {
      resolveTenant(
        {
          tenant: "t1",
          capabilities: ["capX"],
          jurisdiction: "aa-AA",
          config: { ...baseConfig, jurisdiction: {}, rogue: true },
        },
        registries(),
      );
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "CONFIG_INVALID")).toBe(true);
    }
  });

  it("port registry itself refuses unbound gets", () => {
    const ports = new PortRegistry();
    try {
      ports.get("tax@1");
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "PORT_NOT_BOUND")).toBe(true);
    }
  });
});

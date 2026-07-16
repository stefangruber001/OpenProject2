import { describe, expect, it } from "vitest";
import { isFactoryError, resolveTenant } from "@repo/kernel";
import { registries } from "./registry";

/**
 * Mandate §12.3 — the falsifiability test. Kernel + billing with NO
 * jurisdiction pack must fail loudly. If billing could produce a tax rate
 * without a jurisdiction pack, Spain would have leaked into the core and the
 * whole modularity claim would be false.
 */
const baseConfig = {
  locale: "xx-XX",
  currency: "EUR",
  branding: { legalName: "No Jurisdiction Co" },
  billing: {
    seller: { name: "No Jurisdiction Co" },
    series: [{ id: "INV", kind: "standard" as const }],
  },
};

describe("negative test: no jurisdiction pack loaded", () => {
  it("resolution fails loudly with the missing tax port named", () => {
    try {
      resolveTenant(
        { tenant: "no-jur", capabilities: ["quoting", "billing"], config: baseConfig },
        registries,
      );
      expect.unreachable("resolution must not succeed without a jurisdiction pack");
    } catch (e) {
      expect(isFactoryError(e, "MISSING_PORT_IMPLEMENTATION")).toBe(true);
      expect((e as Error).message).toMatch(/tax@1/);
      expect((e as Error).message).toMatch(/jurisdiction/i);
    }
  });

  it("an unknown jurisdiction is rejected with the known list", () => {
    try {
      resolveTenant(
        {
          tenant: "no-jur",
          capabilities: ["billing"],
          jurisdiction: "de-DE@2026-07-16",
          config: { ...baseConfig, jurisdiction: {} },
        },
        registries,
      );
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "UNKNOWN_PACK")).toBe(true);
      expect((e as Error).message).toMatch(/es-ES/);
    }
  });
});

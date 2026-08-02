import { PortRegistry, binderFor, isFactoryError } from "@repo/kernel";
import { TAX_PORT } from "@repo/capability-billing";
import { describe, expect, it } from "vitest";
import { esConfigSchema, esPack } from "./manifest";

const kernelConfig = { locale: "es-ES", currency: "EUR", branding: { legalName: "X" } };

describe("es-ES pack manifest", () => {
  it("binds tax, chain and labels adapters", () => {
    const ports = new PortRegistry();
    esPack.register(binderFor(ports, esPack.id), {
      tenantId: "t1",
      config: esConfigSchema.parse({}),
      kernelConfig,
    });
    expect(ports.has(TAX_PORT)).toBe(true);
    expect(ports.boundPorts()).toEqual([
      "doc-labels@1",
      "extraction-profile@1",
      "invoice-chain@1",
      "tax@1",
    ]);
    expect(ports.provider(TAX_PORT)).toBe("jurisdiction/es-ES");
  });

  it("hard-gates Verifactu until legally verified (LEGAL_REVIEW #1)", () => {
    const ports = new PortRegistry();
    try {
      esPack.register(binderFor(ports, esPack.id), {
        tenantId: "t1",
        config: esConfigSchema.parse({ verifactu: { enabled: true } }),
        kernelConfig,
      });
      expect.unreachable();
    } catch (e) {
      expect(isFactoryError(e, "CONFIG_INVALID")).toBe(true);
      expect((e as Error).message).toMatch(/Verifactu/i);
      expect((e as Error).message).toMatch(/LEGAL_REVIEW/);
    }
  });
});

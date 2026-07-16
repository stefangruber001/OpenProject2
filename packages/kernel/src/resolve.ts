import { z, type ZodTypeAny } from "zod";
import { FactoryError } from "./errors";
import { inWindow } from "./effective";
import { PortRegistry, binderFor, type PortId } from "./ports";
import {
  KERNEL_VERSION,
  kernelConfigSchema,
  kernelSatisfies,
  parsePackRef,
  tenantSpecSchema,
  type CapabilityManifest,
  type PackManifest,
  type TenantSpec,
} from "./spec";

/**
 * Resolve-time composition (mandate §6.2): read the spec, select packs, check
 * compatibility, compose the config schema from fragments, validate, bind
 * adapters, verify every required port is implemented. Conflicts fail loudly
 * HERE — never at runtime in front of a user.
 */
export interface Registries {
  capabilities: ReadonlyMap<string, CapabilityManifest>;
  packs: readonly PackManifest[];
}

export interface ResolvedTenant {
  spec: TenantSpec;
  kernelVersion: string;
  kernelConfig: z.infer<typeof kernelConfigSchema>;
  /** Full validated config (kernel + capability + pack fragments). */
  config: Record<string, unknown>;
  selectedCapabilities: CapabilityManifest[];
  selectedPacks: PackManifest[];
  ports: PortRegistry;
  /** Machine-readable resolution report — persisted with artifacts. */
  report: {
    tenant: string;
    kernelVersion: string;
    capabilities: { id: string; version: string }[];
    packs: { id: string; version: string; layer: string }[];
    boundPorts: { port: PortId; provider: string }[];
  };
}

function findPack(
  packs: readonly PackManifest[],
  layer: "jurisdiction" | "vertical",
  ref: string,
): { pack: PackManifest; date?: string } {
  const { id, date } = parsePackRef(ref);
  const pack = packs.find((p) => p.layer === layer && p.shortId === id);
  if (!pack) {
    const known = packs
      .filter((p) => p.layer === layer)
      .map((p) => p.shortId)
      .join(", ");
    throw new FactoryError(
      "UNKNOWN_PACK",
      `No ${layer} pack "${id}" in the registry. Known ${layer} packs: [${known || "none"}].`,
      { layer, ref },
    );
  }
  return { pack, date };
}

export function resolveTenant(rawSpec: unknown, registries: Registries): ResolvedTenant {
  const parsed = tenantSpecSchema.safeParse(rawSpec);
  if (!parsed.success) {
    throw new FactoryError("SPEC_INVALID", `Tenant spec invalid: ${parsed.error.message}`);
  }
  const spec = parsed.data;

  if (!kernelSatisfies(spec.kernel)) {
    throw new FactoryError(
      "KERNEL_INCOMPATIBLE",
      `Spec requires kernel "${spec.kernel}" but this kernel is ${KERNEL_VERSION}.`,
    );
  }

  const selectedCapabilities = spec.capabilities.map((id) => {
    const cap = registries.capabilities.get(id);
    if (!cap) {
      throw new FactoryError(
        "UNKNOWN_CAPABILITY",
        `Capability "${id}" is not installed. Known: [${[...registries.capabilities.keys()].join(", ")}].`,
      );
    }
    return cap;
  });

  const selectedPacks: { pack: PackManifest; date?: string; configKey: string }[] = [];
  if (spec.jurisdiction) {
    const { pack, date } = findPack(registries.packs, "jurisdiction", spec.jurisdiction);
    selectedPacks.push({ pack, date, configKey: "jurisdiction" });
  }
  if (spec.vertical) {
    const { pack, date } = findPack(registries.packs, "vertical", spec.vertical);
    selectedPacks.push({ pack, date, configKey: "vertical" });
  }

  for (const { pack, date } of selectedPacks) {
    if (!kernelSatisfies(pack.kernelRange)) {
      throw new FactoryError(
        "KERNEL_INCOMPATIBLE",
        `Pack ${pack.id}@${pack.version} requires kernel "${pack.kernelRange}", kernel is ${KERNEL_VERSION}.`,
      );
    }
    if (date && !inWindow(date, pack.validFrom, pack.validTo)) {
      throw new FactoryError(
        "PACK_WINDOW",
        `Pack ${pack.id} is not effective at ${date} (window ${pack.validFrom ?? "-∞"} → ${pack.validTo ?? "∞"}).`,
      );
    }
  }

  // Compose the config schema: kernel base + capability fragments + pack fragments.
  const shape: Record<string, ZodTypeAny> = { ...kernelConfigSchema.shape };
  for (const cap of selectedCapabilities) {
    if (cap.configSchema) shape[cap.id] = cap.configSchema;
  }
  for (const { pack, configKey } of selectedPacks) {
    if (pack.configSchema) shape[configKey] = pack.configSchema;
  }
  const composedSchema = z.object(shape).strict();

  const configParsed = composedSchema.safeParse(spec.config);
  if (!configParsed.success) {
    throw new FactoryError(
      "CONFIG_INVALID",
      `Tenant config does not match the composed schema (kernel + ${selectedPacks
        .map((s) => s.pack.id)
        .join(" + ")}): ${configParsed.error.message}`,
    );
  }
  const config = configParsed.data as Record<string, unknown>;
  const kernelConfig = kernelConfigSchema.parse({
    locale: config.locale,
    currency: config.currency,
    branding: config.branding,
  });

  // Bind adapters — jurisdiction first, then vertical (both may bind; conflicts throw).
  const ports = new PortRegistry();
  for (const { pack, configKey } of selectedPacks) {
    pack.register(binderFor(ports, pack.id), {
      tenantId: spec.tenant,
      config: config[configKey],
      kernelConfig,
    });
  }

  // The falsifiability check (mandate §12.3): every required port must be bound.
  for (const cap of selectedCapabilities) {
    for (const port of cap.requiredPorts) {
      if (!ports.has(port)) {
        throw new FactoryError(
          "MISSING_PORT_IMPLEMENTATION",
          `Capability "${cap.id}" requires port ${port}, but no selected pack provides it. ` +
            `Selected packs: [${selectedPacks.map((s) => s.pack.id).join(", ") || "none"}]. ` +
            `A jurisdiction pack is likely missing from the tenant spec.`,
          { capability: cap.id, port },
        );
      }
    }
  }

  return {
    spec,
    kernelVersion: KERNEL_VERSION,
    kernelConfig,
    config,
    selectedCapabilities,
    selectedPacks: selectedPacks.map((s) => s.pack),
    ports,
    report: {
      tenant: spec.tenant,
      kernelVersion: KERNEL_VERSION,
      capabilities: selectedCapabilities.map((c) => ({ id: c.id, version: c.version })),
      packs: selectedPacks.map((s) => ({
        id: s.pack.id,
        version: s.pack.version,
        layer: s.pack.layer,
      })),
      boundPorts: ports.boundPorts().map((port) => ({
        port,
        provider: ports.provider(port) ?? "?",
      })),
    },
  };
}

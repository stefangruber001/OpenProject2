import { z, type ZodTypeAny } from "zod";
import { FactoryError } from "./errors";
import type { PortBinder, PortId } from "./ports";

export const KERNEL_VERSION = "1.0.0";

/**
 * The tenant spec is the single source of truth (principle 6). This is the
 * kernel fragment; selected packs and capabilities contribute config-schema
 * fragments that the resolver composes into the full validator.
 */
export const tenantSpecSchema = z.object({
  tenant: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "tenant id: lowercase letters, digits, hyphens"),
  kernel: z.string().default("^1"),
  capabilities: z.array(z.string()).nonempty(),
  jurisdiction: z.string().optional(),
  vertical: z.string().optional(),
  plugins: z.array(z.string()).default([]),
  config: z.record(z.unknown()).default({}),
});

export type TenantSpec = z.infer<typeof tenantSpecSchema>;

/** Kernel-owned config every tenant has, regardless of packs. */
export const kernelConfigSchema = z.object({
  locale: z.string().min(2),
  currency: z.string().length(3),
  branding: z.object({
    legalName: z.string().min(1),
    tradeName: z.string().min(1).optional(),
  }),
});

/** `es-ES@2026-07-16` → { id: "es-ES", date: "2026-07-16" } (date optional). */
export function parsePackRef(ref: string): { id: string; date?: string } {
  const at = ref.lastIndexOf("@");
  if (at === -1) return { id: ref };
  return { id: ref.slice(0, at), date: ref.slice(at + 1) };
}

/**
 * Deliberately naive range matcher: `*` or `^MAJOR[...]`. Packs pin `^1`.
 * Swappable for a full semver library behind this exact signature.
 */
export function kernelSatisfies(range: string, version: string = KERNEL_VERSION): boolean {
  if (range === "*") return true;
  const m = /^\^(\d+)(?:\.\d+)*$/.exec(range.trim());
  if (!m) {
    throw new FactoryError(
      "KERNEL_INCOMPATIBLE",
      `Unsupported kernel range "${range}" (use "^MAJOR" or "*")`,
    );
  }
  return version.split(".")[0] === m[1];
}

/** What capability modules declare (they are code, selected by the spec). */
export interface CapabilityManifest {
  id: string;
  version: string;
  requiredPorts: PortId[];
  optionalPorts?: PortId[];
  /** Config fragment mounted at `config.<id>` when present. */
  configSchema?: ZodTypeAny;
}

/** What packs declare. Packs are the ONLY place adapters come from. */
export interface PackManifest<C = unknown> {
  /** Full id, e.g. "jurisdiction/es-ES" or "vertical/construction/reformas". */
  id: string;
  /** Spec-facing short id, e.g. "es-ES" or "construction/reformas". */
  shortId: string;
  layer: "jurisdiction" | "vertical";
  version: string;
  kernelRange: string;
  validFrom?: string;
  validTo?: string;
  /** Config fragment mounted at `config.jurisdiction` / `config.vertical`. */
  configSchema?: ZodTypeAny;
  /** Bind adapters. Called once per tenant resolution. */
  register(binder: PortBinder, ctx: PackRegisterContext<C>): void;
}

export interface PackRegisterContext<C = unknown> {
  tenantId: string;
  /** This pack's validated config fragment. */
  config: C;
  /** Kernel-level config (locale, currency, branding). */
  kernelConfig: z.infer<typeof kernelConfigSchema>;
}

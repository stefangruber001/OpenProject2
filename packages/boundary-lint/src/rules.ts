/**
 * The architecture, as data. Layers depend strictly downward (mandate §6.1);
 * packs never import packs. Tooling packages (eslint/tsconfig presets) are
 * layer-neutral dev dependencies.
 */
export type Layer = "kernel" | "capability" | "jurisdiction" | "vertical";

export const TOOLING_PACKAGES = new Set(["@repo/eslint-config", "@repo/typescript-config"]);

/** Which @repo runtime packages each layer may depend on / import. */
export function allowedForLayer(layer: Layer): { kernel: boolean; capability: boolean } {
  switch (layer) {
    case "kernel":
      return { kernel: false, capability: false };
    case "capability":
      return { kernel: true, capability: false }; // capabilities: kernel only
    case "jurisdiction":
    case "vertical":
      return { kernel: true, capability: true }; // packs: kernel + capabilities, never packs
  }
}

export function classifyPackageDir(relDir: string): Layer | undefined {
  if (relDir === "packages/kernel") return "kernel";
  if (relDir.startsWith("packages/capabilities/")) return "capability";
  if (relDir.startsWith("packages/packs/jurisdiction-")) return "jurisdiction";
  if (relDir.startsWith("packages/packs/vertical-")) return "vertical";
  return undefined; // host layer (factory, apps, db, ui, tooling) — not constrained here
}

export function classifyDependency(depName: string): Layer | "tooling" | "other" | undefined {
  if (!depName.startsWith("@repo/")) return undefined; // external deps are out of scope
  if (TOOLING_PACKAGES.has(depName)) return "tooling";
  if (depName === "@repo/kernel") return "kernel";
  if (depName.startsWith("@repo/capability-")) return "capability";
  if (depName.startsWith("@repo/pack-jurisdiction-")) return "jurisdiction";
  if (depName.startsWith("@repo/pack-vertical-")) return "vertical";
  return "other"; // @repo/db, @repo/ui, @repo/factory... never allowed inside the stack
}

/**
 * Forbidden literals in kernel + capabilities: jurisdiction/sector knowledge
 * must live in packs (mandate §8). Checked in non-test source files.
 */
export const FORBIDDEN_LITERALS: { pattern: RegExp; why: string }[] = [
  { pattern: /\bIVA\b/, why: "Spanish tax name — belongs in a jurisdiction pack" },
  { pattern: /\bIRPF\b/, why: "Spanish tax name — belongs in a jurisdiction pack" },
  { pattern: /\bVerifactu\b/i, why: "Spanish anti-fraud regime — jurisdiction pack" },
  { pattern: /\bAEAT\b/, why: "Spanish tax agency — jurisdiction pack" },
  { pattern: /Modelo\s?\d{3}\b/, why: "Spanish tax filing — jurisdiction pack" },
  { pattern: /\bpartida/i, why: "construction vocabulary — vertical pack" },
  { pattern: /\bmedici[oó]n/i, why: "construction vocabulary — vertical pack" },
  { pattern: /\bcertificaci[oó]n/i, why: "construction vocabulary — vertical pack" },
  { pattern: /\b0\.21\b|\b0\.10\b|\b0\.04\b/, why: "hardcoded tax-rate-like constant" },
  { pattern: /\b21\s?%|\b10\s?%|\b4\s?%/, why: "hardcoded tax-rate-like percentage" },
  { pattern: /\bes-ES\b/, why: "hardcoded locale — locale comes from tenant config" },
];

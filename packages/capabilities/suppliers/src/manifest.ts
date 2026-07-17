import type { CapabilityManifest } from "@repo/kernel";
import { suppliersConfigSchema } from "./model";

export const suppliersManifest: CapabilityManifest = {
  id: "suppliers",
  version: "1.0.0",
  requiredPorts: [],
  configSchema: suppliersConfigSchema,
};

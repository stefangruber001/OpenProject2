import type { CapabilityManifest } from "@repo/kernel";
import { procurementConfigSchema } from "./model";

export const procurementManifest: CapabilityManifest = {
  id: "procurement",
  version: "1.0.0",
  requiredPorts: [],
  configSchema: procurementConfigSchema,
};

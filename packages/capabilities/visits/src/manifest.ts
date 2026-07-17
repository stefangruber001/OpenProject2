import type { CapabilityManifest } from "@repo/kernel";
import { visitsConfigSchema } from "./model";

export const visitsManifest: CapabilityManifest = {
  id: "visits",
  version: "1.0.0",
  requiredPorts: [],
  configSchema: visitsConfigSchema,
};

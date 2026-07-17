import type { CapabilityManifest } from "@repo/kernel";
import { crmConfigSchema } from "./model";

export const crmManifest: CapabilityManifest = {
  id: "crm",
  version: "1.0.0",
  requiredPorts: [],
  configSchema: crmConfigSchema,
};

import type { CapabilityManifest } from "@repo/kernel";
import { receivablesConfigSchema } from "./model";

export const receivablesManifest: CapabilityManifest = {
  id: "receivables",
  version: "1.0.0",
  requiredPorts: [],
  configSchema: receivablesConfigSchema,
};

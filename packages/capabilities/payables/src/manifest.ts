import type { CapabilityManifest } from "@repo/kernel";
import { payablesConfigSchema } from "./model";

export const payablesManifest: CapabilityManifest = {
  id: "payables",
  version: "1.0.0",
  requiredPorts: [],
  configSchema: payablesConfigSchema,
};

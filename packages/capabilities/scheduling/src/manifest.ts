import type { CapabilityManifest } from "@repo/kernel";
import { schedulingConfigSchema } from "./model";

export const schedulingManifest: CapabilityManifest = {
  id: "scheduling",
  version: "1.0.0",
  requiredPorts: [],
  configSchema: schedulingConfigSchema,
};

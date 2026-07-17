import type { CapabilityManifest } from "@repo/kernel";
import { timeConfigSchema } from "./model";

export const timeManifest: CapabilityManifest = {
  id: "time",
  version: "1.0.0",
  requiredPorts: [],
  configSchema: timeConfigSchema,
};

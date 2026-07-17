import type { CapabilityManifest } from "@repo/kernel";
import { accessConfigSchema } from "./model";

export const accessManifest: CapabilityManifest = {
  id: "access",
  version: "1.0.0",
  requiredPorts: [],
  configSchema: accessConfigSchema,
};

import type { CapabilityManifest } from "@repo/kernel";
import { reconciliationConfigSchema } from "./config";

export const reconciliationManifest: CapabilityManifest = {
  id: "reconciliation",
  version: "1.0.0",
  // Pure scoring over values the caller supplies — no store, no clock, no ids.
  requiredPorts: [],
  configSchema: reconciliationConfigSchema,
};

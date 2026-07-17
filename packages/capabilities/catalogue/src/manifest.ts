import type { CapabilityManifest } from "@repo/kernel";
import { catalogueConfigSchema } from "./model";

export const catalogueManifest: CapabilityManifest = {
  id: "catalogue",
  version: "1.0.0",
  requiredPorts: [],
  configSchema: catalogueConfigSchema,
};

import type { CapabilityManifest } from "@repo/kernel";
import { projectsConfigSchema } from "./model";

export const projectsManifest: CapabilityManifest = {
  id: "projects",
  version: "1.0.0",
  requiredPorts: [],
  configSchema: projectsConfigSchema,
};

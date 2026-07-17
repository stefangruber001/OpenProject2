import type { CapabilityManifest } from "@repo/kernel";
import { docsConfigSchema } from "./model";
import { BLOB_STORE_PORT } from "./service";

export const docsManifest: CapabilityManifest = {
  id: "docs",
  version: "1.0.0",
  requiredPorts: [],
  // Bytes are optional: metadata works without a store; the app binds one.
  optionalPorts: [BLOB_STORE_PORT],
  configSchema: docsConfigSchema,
};

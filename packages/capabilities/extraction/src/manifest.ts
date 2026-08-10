import type { CapabilityManifest } from "@repo/kernel";
import { extractionConfigSchema } from "./config";
import { EXTRACTION_PROFILE_PORT } from "./ports";

export const extractionManifest: CapabilityManifest = {
  id: "extraction",
  version: "1.0.0",
  /**
   * Required, not optional: an extractor with no profile has no idea how the
   * documents in front of it are written, and would silently read nothing.
   * Failing at resolve time is the whole point of the port being required.
   */
  requiredPorts: [EXTRACTION_PROFILE_PORT],
  configSchema: extractionConfigSchema,
};

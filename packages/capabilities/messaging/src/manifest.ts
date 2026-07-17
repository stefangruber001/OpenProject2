import type { CapabilityManifest } from "@repo/kernel";
import { messagingConfigSchema } from "./model";
import { EMAIL_OUT_PORT } from "./ports";

export const messagingManifest: CapabilityManifest = {
  id: "messaging",
  version: "1.0.0",
  // Sending is OPTIONAL: a tenant can draft without a provider bound. The app
  // injects a log-only outbox in dev; a real provider adapter binds it later.
  requiredPorts: [],
  optionalPorts: [EMAIL_OUT_PORT],
  configSchema: messagingConfigSchema,
};

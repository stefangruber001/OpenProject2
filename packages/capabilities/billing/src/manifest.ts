import type { CapabilityManifest } from "@repo/kernel";
import { billingConfigSchema } from "./model";
import { DOC_LABELS_PORT, INVOICE_CHAIN_PORT, TAX_PORT } from "./ports";

export const billingManifest: CapabilityManifest = {
  id: "billing",
  version: "1.0.0",
  // No jurisdiction pack ⇒ no tax adapter ⇒ resolution fails loudly.
  requiredPorts: [TAX_PORT],
  optionalPorts: [INVOICE_CHAIN_PORT, DOC_LABELS_PORT],
  configSchema: billingConfigSchema,
};

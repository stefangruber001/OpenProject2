import { z } from "zod";
import { FactoryError, type PackManifest } from "@repo/kernel";
import { DOC_LABELS_PORT, INVOICE_CHAIN_PORT, TAX_PORT } from "@repo/capability-billing";
import { EsInvoiceChainAdapter } from "./chain";
import { ES_DOC_LABELS } from "./labels";
import { EsTaxAdapter, PACK_ID, PACK_VERSION } from "./tax/adapter";

export const esConfigSchema = z.object({
  verifactu: z
    .object({
      /**
       * Hard gate: the certified Verifactu registro/QR/submission is NOT
       * implemented (LEGAL_REVIEW.md #1). Enabling before certification must
       * fail resolution — it cannot reach a tenant silently.
       */
      enabled: z.boolean().default(false),
    })
    .default({ enabled: false }),
});

export type EsConfig = z.infer<typeof esConfigSchema>;

export const esPack: PackManifest<EsConfig> = {
  id: PACK_ID,
  shortId: "es-ES",
  layer: "jurisdiction",
  version: PACK_VERSION,
  kernelRange: "^1",
  validFrom: "2012-09-01", // earliest effective era encoded in the rate tables
  configSchema: esConfigSchema,
  register(binder, ctx) {
    if (ctx.config.verifactu.enabled) {
      throw new FactoryError(
        "CONFIG_INVALID",
        `${PACK_ID}: verifactu.enabled=true, pero el modo certificado Verifactu aún no está ` +
          `implementado ni verificado legalmente (LEGAL_REVIEW.md #1, plazo 2027). ` +
          `Gate: legally_verified=false — desactívalo o espera a la certificación.`,
      );
    }
    binder.bind(TAX_PORT, new EsTaxAdapter());
    // Chain head persists via host-provided KV when available (durable in P2).
    binder.bind(INVOICE_CHAIN_PORT, new EsInvoiceChainAdapter(ctx.infra?.kv));
    binder.bind(DOC_LABELS_PORT, ES_DOC_LABELS);
  },
};

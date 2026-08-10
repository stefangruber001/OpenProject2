import { z } from "zod";
import { RECONCILIATION_DEFAULTS } from "./model";

/**
 * The tenant-file schema, kept apart from model.ts on purpose.
 *
 * The factory imports this to validate `config.reconciliation` in a tenant
 * yaml; the matcher and the browser bundle import the plain resolver from
 * model.ts instead. Keeping the two in separate modules is what lets esbuild
 * drop zod from the committed browser artifact — the same 130 KB lesson
 * sessions 9 and 10a each learned once.
 *
 * The defaults come from RECONCILIATION_DEFAULTS so the two cannot drift: a
 * schema whose defaults disagree with the runtime's is worse than no schema.
 */
export const reconciliationConfigSchema = z
  .object({
    dateToleranceDays: z
      .number()
      .int()
      .min(0)
      .max(180)
      .default(RECONCILIATION_DEFAULTS.dateToleranceDays),
    amountToleranceCents: z
      .number()
      .int()
      .min(0)
      .max(100_000)
      .default(RECONCILIATION_DEFAULTS.amountToleranceCents),
    autoAcceptScore: z.number().min(0).max(1).default(RECONCILIATION_DEFAULTS.autoAcceptScore),
    maxCombinationSize: z
      .number()
      .int()
      .min(1)
      .max(6)
      .default(RECONCILIATION_DEFAULTS.maxCombinationSize),
    maxSuggestions: z.number().int().min(1).max(50).default(RECONCILIATION_DEFAULTS.maxSuggestions),
  })
  .default({});

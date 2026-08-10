import { z } from "zod";

/**
 * The extractor's configuration, and the ONLY module in this capability that
 * touches zod.
 *
 * That separation is load-bearing rather than tidy. `model.ts` carries runtime
 * constants (`FIELD_KEYS`, `AMOUNT_FIELDS`) that the service needs, so a
 * bundler must include that module — and a schema built by a top-level
 * `z.object(...)` call sitting beside them cannot be proven side-effect-free,
 * so it is kept, and zod comes with it. Roughly 60 KB of a validator into a
 * browser that has nothing to validate: it is handed a config, it does not
 * parse one. Validating a config is a RESOLVE-time job the factory does.
 *
 * Alone in its own module, this is unreachable from the browser surface and
 * drops out entirely. CI asserts it: `grep ZodError site/erp-factory.js` fails
 * the build.
 */
export const extractionConfigSchema = z
  .object({
    /** Below this, a field is sent for review. */
    reviewThreshold: z.number().min(0).max(1).default(0.75),
    /** Cents of slack allowed when checking net + tax − withholding = total. */
    totalsToleranceCents: z.number().int().min(0).default(2),
    /** Alternatives kept per field. */
    maxAlternatives: z.number().int().min(0).max(10).default(3),
  })
  .default({});

export type ExtractionConfig = z.infer<typeof extractionConfigSchema>;

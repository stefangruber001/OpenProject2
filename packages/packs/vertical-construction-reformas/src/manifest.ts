import { z } from "zod";
import type { PackManifest } from "@repo/kernel";

export const reformasConfigSchema = z.object({
  terminology: z
    .object({
      quote: z.string().default("Presupuesto"),
      line: z.string().default("Partida"),
      measurement: z.string().default("Medición"),
    })
    .default({}),
  defaultUnits: z.array(z.string()).default(["ud", "m", "m²", "m³", "h", "PA"]),
  /** Default contractor-materials share when a project hasn't measured it yet. */
  materialsShareDefaultBp: z.number().int().min(0).max(10_000).default(3500),
});

export type ReformasConfig = z.infer<typeof reformasConfigSchema>;

export const reformasPack: PackManifest<ReformasConfig> = {
  id: "vertical/construction-reformas",
  shortId: "construction/reformas",
  layer: "vertical",
  version: "1.0.0",
  kernelRange: "^1",
  configSchema: reformasConfigSchema,
  register() {
    // v1 supplies vocabulary, mediciones math and config — no port bindings yet.
    // Certificaciones/quoted-vs-actual land here in P2 as quoting extensions.
  },
};

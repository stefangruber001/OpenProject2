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
  /**
   * Standard renovation chapter catalogue — seeded from real project
   * evidence (tenant intake, BRD Appendix A.2). Pure data: tenants override
   * freely; quotes/comparisons use these as grouping keys.
   */
  chapters: z
    .array(z.string())
    .default([
      "Demoliciones y trabajos previos",
      "Estructura",
      "Albañilería y tabiquería",
      "Revestimientos y acabados",
      "Aparatos sanitarios",
      "Carpintería interior",
      "Carpintería exterior",
      "Cocina",
      "Pintura",
      "Instalación eléctrica",
      "Climatización",
      "Ventilación",
      "Fontanería",
      "Saneamiento",
      "Telecomunicaciones",
      "Protección contra incendios",
      "Varios y generales",
      "Trabajos opcionales",
    ]),
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

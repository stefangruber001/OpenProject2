import { z } from "zod";
import type { PackManifest } from "@repo/kernel";

const termsSchema = z.object({
  quote: z.string(),
  line: z.string(),
  measurement: z.string(),
});

export const reformasConfigSchema = z.object({
  terminology: z
    .object({
      quote: z.string().default("Presupuesto"),
      line: z.string().default("Partida"),
      measurement: z.string().default("Medición"),
    })
    .default({}),
  /**
   * Domain vocabulary per UI language (data, not a fork). Working language is
   * English; es/ca ship alongside and are switched on before handover. The UI
   * picks the set for the active language and falls back to `terminology`.
   */
  terminologyByLang: z.record(termsSchema).default({
    en: { quote: "Quote", line: "Line item", measurement: "Measurement" },
    es: { quote: "Presupuesto", line: "Partida", measurement: "Medición" },
    ca: { quote: "Pressupost", line: "Partida", measurement: "Amidament" },
  }),
  /**
   * Display labels for chapters per UI language, keyed by the canonical chapter
   * value. The canonical `chapters` entries stay stable (they are grouping keys
   * on stored quotes); only the shown label changes with the language. A key
   * with no translation falls back to the canonical value.
   */
  chapterLabels: z.record(z.record(z.string())).default({
    en: {
      "Demoliciones y trabajos previos": "Demolition & preliminary works",
      Estructura: "Structure",
      "Albañilería y tabiquería": "Masonry & partitions",
      "Revestimientos y acabados": "Coverings & finishes",
      "Aparatos sanitarios": "Sanitary fixtures",
      "Carpintería interior": "Interior joinery",
      "Carpintería exterior": "Exterior joinery",
      Cocina: "Kitchen",
      Pintura: "Painting",
      "Instalación eléctrica": "Electrical installation",
      Climatización: "HVAC / climate control",
      Ventilación: "Ventilation",
      Fontanería: "Plumbing",
      Saneamiento: "Drainage",
      Telecomunicaciones: "Telecommunications",
      "Protección contra incendios": "Fire protection",
      "Varios y generales": "Miscellaneous & general",
    },
    ca: {
      "Demoliciones y trabajos previos": "Enderrocs i treballs previs",
      Estructura: "Estructura",
      "Albañilería y tabiquería": "Paleteria i envans",
      "Revestimientos y acabados": "Revestiments i acabats",
      "Aparatos sanitarios": "Aparells sanitaris",
      "Carpintería interior": "Fusteria interior",
      "Carpintería exterior": "Fusteria exterior",
      Cocina: "Cuina",
      Pintura: "Pintura",
      "Instalación eléctrica": "Instal·lació elèctrica",
      Climatización: "Climatització",
      Ventilación: "Ventilació",
      Fontanería: "Lampisteria",
      Saneamiento: "Sanejament",
      Telecomunicaciones: "Telecomunicacions",
      "Protección contra incendios": "Protecció contra incendis",
      "Varios y generales": "Diversos i generals",
    },
  }),
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

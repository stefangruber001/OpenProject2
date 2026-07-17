import { z } from "zod";
import type { Cents } from "@repo/kernel";

/**
 * A catalogue is generic: work/material items grouped by an opaque chapter key,
 * each with a unit, a selling price and optional internal cost (for margin),
 * plus room templates that expand into ready-made quote lines. No sector or
 * jurisdiction knowledge lives here.
 */
export type ItemKind = "material" | "labour" | "other";

export const catalogueItemSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  chapter: z.string().min(1),
  unit: z.string().min(1),
  kind: z.enum(["material", "labour", "other"]).default("material"),
  unitPriceCents: z.number().int().min(0),
  unitCostCents: z.number().int().min(0).optional(),
});
export type CatalogueItem = z.infer<typeof catalogueItemSchema>;

export const roomTemplateSchema = z.object({
  name: z.string().min(1),
  lines: z
    .array(z.object({ itemCode: z.string().min(1), qtyMillis: z.number().int().min(0) }))
    .default([]),
});
export type RoomTemplate = z.infer<typeof roomTemplateSchema>;

export interface Catalogue {
  items: CatalogueItem[];
  templates: RoomTemplate[];
}

/** Config seeds the catalogue as tenant data (items + templates). */
export const catalogueConfigSchema = z
  .object({
    items: z.array(catalogueItemSchema).default([]),
    templates: z.array(roomTemplateSchema).default([]),
  })
  .default({});
export type CatalogueConfig = z.infer<typeof catalogueConfigSchema>;

/** A template line resolved against the catalogue into a costed quote line. */
export interface ExpandedLine {
  itemCode: string;
  name: string;
  chapter: string;
  unit: string;
  qtyMillis: number;
  unitPriceCents: Cents;
  lineCents: Cents;
}

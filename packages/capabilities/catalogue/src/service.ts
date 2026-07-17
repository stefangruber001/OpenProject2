import { FactoryError, lineTotalCents, roundDivHalfUp, type Cents } from "@repo/kernel";
import type {
  Catalogue,
  CatalogueConfig,
  CatalogueItem,
  ExpandedLine,
  RoomTemplate,
} from "./model";

/**
 * Catalogue engine. Register work/material items and room templates, look up
 * prices, compute margin, and expand a template into costed quote lines.
 * Seeded from config; pure over a Catalogue value.
 */
export class CatalogueService {
  constructor(private readonly config: CatalogueConfig) {}

  /** Catalogue seeded from tenant config (items + templates as data). */
  seed(): Catalogue {
    return { items: [...this.config.items], templates: [...this.config.templates] };
  }

  addItem(cat: Catalogue, item: CatalogueItem): Catalogue {
    if (cat.items.some((i) => i.code === item.code)) {
      throw new FactoryError("INVALID_STATE", `Item code "${item.code}" already exists.`);
    }
    return { ...cat, items: [...cat.items, item] };
  }

  byCode(cat: Catalogue, code: string): CatalogueItem | undefined {
    return cat.items.find((i) => i.code === code);
  }

  byChapter(cat: Catalogue, chapter: string): CatalogueItem[] {
    return cat.items.filter((i) => i.chapter === chapter);
  }

  /** Unit margin (price − cost) in basis points of price; 0 if no cost known. */
  marginBp(item: CatalogueItem): number {
    if (item.unitCostCents == null || item.unitPriceCents === 0) return 0;
    return roundDivHalfUp((item.unitPriceCents - item.unitCostCents) * 10_000, item.unitPriceCents);
  }

  addTemplate(cat: Catalogue, template: RoomTemplate): Catalogue {
    if (cat.templates.some((t) => t.name === template.name)) {
      throw new FactoryError("INVALID_STATE", `Template "${template.name}" already exists.`);
    }
    return { ...cat, templates: [...cat.templates, template] };
  }

  /** Expand a room template into costed lines, resolving each item's price. */
  expandTemplate(cat: Catalogue, templateName: string): ExpandedLine[] {
    const template = cat.templates.find((t) => t.name === templateName);
    if (!template) throw new FactoryError("NOT_FOUND", `Template "${templateName}" not found.`);
    return template.lines.map((l) => {
      const item = this.byCode(cat, l.itemCode);
      if (!item) throw new FactoryError("NOT_FOUND", `Item "${l.itemCode}" not in catalogue.`);
      const lineCents: Cents = lineTotalCents(l.qtyMillis, item.unitPriceCents);
      return {
        itemCode: item.code,
        name: item.name,
        chapter: item.chapter,
        unit: item.unit,
        qtyMillis: l.qtyMillis,
        unitPriceCents: item.unitPriceCents,
        lineCents,
      };
    });
  }
}

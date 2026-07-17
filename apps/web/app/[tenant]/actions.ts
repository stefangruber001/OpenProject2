"use server";

import { revalidatePath } from "next/cache";
import {
  HINT_WORKS_ON_DWELLING,
  dwellingWorksAttributes,
  medicionQtyMillis,
  type ReformasConfig,
} from "@repo/pack-vertical-construction-reformas";
import { getTenantRuntime } from "@/lib/tenant-runtime";

/**
 * P2.2 first slice: issue a presupuesto → factura through the tenant's
 * composed services (same path as the CLI demo, but live and persistent).
 * Form-driven creation UIs replace this as the shell grows.
 */
export async function createDemoJob(tenantId: string): Promise<void> {
  const rt = await getTenantRuntime(tenantId);
  const quoting = rt.quoting!;
  const billing = rt.billing!;
  const vertical = rt.resolved.config.vertical as ReformasConfig;
  const t = vertical.terminology;

  const quote = await quoting.create(`${t.quote} — Reforma de baño, C/ Mayor 12, Madrid`);
  const partidas = [
    {
      description: "Demolición de alicatado y retirada de escombros",
      unit: "m²",
      medicion: { unidades: 1, largo: 5, ancho: 2.5 },
      unitCents: 18_40,
    },
    {
      description: "Alicatado de paredes con azulejo cerámico 20×60",
      unit: "m²",
      medicion: { unidades: 5, largo: 2.5, ancho: 1.98 },
      unitCents: 32_00,
    },
    {
      description: "Instalación de fontanería completa de baño",
      unit: "ud",
      medicion: { unidades: 1 },
      unitCents: 1_850_00,
    },
  ];
  for (const p of partidas) {
    await quoting.addLine(quote.id, {
      description: p.description,
      unit: p.unit,
      qtyMillis: medicionQtyMillis(p.medicion),
      unitCents: p.unitCents,
      taxCategoryHint: HINT_WORKS_ON_DWELLING,
      meta: { medicion: p.medicion },
    });
  }
  const accepted = await quoting.accept(quote.id);

  await billing.issueFromQuote(accepted, {
    buyer: { name: "María García López", taxId: "00000000T", address: "C/ Mayor 12, Madrid" },
    seriesId: "FAC",
    attributes: dwellingWorksAttributes({
      recipient: "individual-private",
      dwellingPrivateUse: true,
      dwellingCompletedYearsAgo: 15,
      materialsShareBp: vertical.materialsShareDefaultBp,
    }),
  });

  revalidatePath(`/${tenantId}`);
}

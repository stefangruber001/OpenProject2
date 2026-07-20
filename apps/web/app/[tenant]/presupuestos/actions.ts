"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  HINT_WORKS_ON_DWELLING,
  dwellingWorksAttributes,
  medicionQtyMillis,
  type DwellingRecipient,
} from "@repo/pack-vertical-construction-reformas";
import { getTenantRuntime } from "@/lib/tenant-runtime";
import { eurosToCents, num } from "@/lib/parse";

export async function createPresupuesto(tenantId: string, formData: FormData): Promise<void> {
  const rt = await getTenantRuntime(tenantId);
  const title = String(formData.get("title") ?? "").trim() || "Presupuesto sin título";
  const quote = await rt.quoting!.create(title);
  redirect(`/${tenantId}/presupuestos/${quote.id}`);
}

export async function addPartida(
  tenantId: string,
  quoteId: string,
  formData: FormData,
): Promise<void> {
  const rt = await getTenantRuntime(tenantId);
  const chapter = String(formData.get("chapter") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const unit = String(formData.get("unit") ?? "ud");
  const medicion = {
    unidades: num(formData.get("unidades"), 1),
    largo: num(formData.get("largo"), 0) || undefined,
    ancho: num(formData.get("ancho"), 0) || undefined,
    alto: num(formData.get("alto"), 0) || undefined,
  };
  await rt.quoting!.addLine(quoteId, {
    description: chapter ? `${chapter} — ${description}` : description,
    unit,
    qtyMillis: medicionQtyMillis(medicion),
    unitCents: eurosToCents(formData.get("precio")),
    taxCategoryHint: HINT_WORKS_ON_DWELLING,
    meta: { medicion, chapter },
  });
  revalidatePath(`/${tenantId}/presupuestos/${quoteId}`);
}

export async function acceptPresupuesto(tenantId: string, quoteId: string): Promise<void> {
  const rt = await getTenantRuntime(tenantId);
  await rt.quoting!.accept(quoteId);
  revalidatePath(`/${tenantId}/presupuestos/${quoteId}`);
}

export async function reviseQuote(tenantId: string, quoteId: string): Promise<void> {
  const rt = await getTenantRuntime(tenantId);
  const next = await rt.quoting!.revise(quoteId);
  redirect(`/${tenantId}/presupuestos/${next.id}`);
}

export async function emitirFactura(
  tenantId: string,
  quoteId: string,
  formData: FormData,
): Promise<void> {
  const rt = await getTenantRuntime(tenantId);
  const quote = await rt.quoting!.get(quoteId);
  const materialsPct = num(formData.get("materialsPct"), 35);
  const invoice = await rt.billing!.issueFromQuote(quote, {
    buyer: {
      name: String(formData.get("buyerName") ?? "").trim() || "Cliente",
      taxId: String(formData.get("buyerTaxId") ?? "").trim() || undefined,
      address: String(formData.get("buyerAddress") ?? "").trim() || undefined,
    },
    seriesId: "FAC",
    attributes: dwellingWorksAttributes({
      recipient: (String(formData.get("recipient")) as DwellingRecipient) || "individual-private",
      dwellingPrivateUse: formData.get("privateUse") === "on",
      dwellingCompletedYearsAgo: num(formData.get("ageYears"), 0),
      materialsShareBp: Math.round(materialsPct * 100),
    }),
  });
  revalidatePath(`/${tenantId}`);
  redirect(`/${tenantId}/facturas/${invoice.id}`);
}

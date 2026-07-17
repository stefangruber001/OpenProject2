import { isFactoryError } from "@repo/kernel";
import { renderInvoiceHtml } from "@repo/capability-billing";
import { getTenantRuntime } from "@/lib/tenant-runtime";

export const dynamic = "force-dynamic";

/** Serve the deterministic invoice document (PDF conversion: pending port). */
export async function GET(_req: Request, ctx: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant, id } = await ctx.params;
  try {
    const rt = await getTenantRuntime(tenant);
    const invoice = await rt.billing!.get(id);
    const html = renderInvoiceHtml(invoice, rt.labels, rt.resolved.kernelConfig.locale);
    return new Response(
      `<!doctype html><html lang="${rt.resolved.kernelConfig.locale}"><head><meta charset="utf-8"><title>${invoice.displayNumber}</title></head><body>${html}</body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  } catch (e) {
    if (isFactoryError(e)) {
      return new Response(e.message, { status: e.code === "NOT_FOUND" ? 404 : 400 });
    }
    throw e;
  }
}

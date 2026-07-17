import { isFactoryError } from "@repo/kernel";
import { renderInvoiceHtml } from "@repo/capability-billing";
import { getTenantRuntime } from "@/lib/tenant-runtime";
import { brandedDocument } from "@/lib/brand-doc";

export const dynamic = "force-dynamic";

/** Serve the invoice as a fully brand-styled document (logo + CI + contact). */
export async function GET(_req: Request, ctx: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant, id } = await ctx.params;
  try {
    const rt = await getTenantRuntime(tenant);
    const { locale, branding } = rt.resolved.kernelConfig;
    const invoice = await rt.billing!.get(id);
    const bodyHtml = renderInvoiceHtml(invoice, rt.labels, locale);
    const doc = brandedDocument({
      branding,
      locale,
      title: invoice.displayNumber,
      subtitle: invoice.issueDate,
      bodyHtml,
    });
    return new Response(doc, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (e) {
    if (isFactoryError(e)) {
      return new Response(e.message, { status: e.code === "NOT_FOUND" ? 404 : 400 });
    }
    throw e;
  }
}

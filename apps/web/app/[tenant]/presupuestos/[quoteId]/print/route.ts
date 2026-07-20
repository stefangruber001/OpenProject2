import { formatMoney, isFactoryError } from "@repo/kernel";
import { getTenantRuntime } from "@/lib/tenant-runtime";
import { brandedDocument } from "@/lib/brand-doc";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Serve a quote as a fully brand-styled, print-ready document (QUO-15/16). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tenant: string; quoteId: string }> },
) {
  const { tenant, quoteId } = await ctx.params;
  try {
    const rt = await getTenantRuntime(tenant);
    const { locale, currency, branding } = rt.resolved.kernelConfig;
    const quote = await rt.quoting!.get(quoteId);
    const money = (c: number) => formatMoney(c, currency, locale);
    const qty = (m: number) => (m / 1000).toLocaleString(locale);

    const row = (l: (typeof quote.lines)[number]) =>
      `<tr><td>${esc(l.description)}</td><td class="n">${qty(l.qtyMillis)}${l.unit ? " " + esc(l.unit) : ""}</td><td class="n">${money(l.unitCents)}</td><td class="n">${money(l.totalCents)}</td></tr>`;

    const bodyHtml = `
      <p style="margin:0 0 4px"><b>${esc(quote.title)}</b></p>
      <p style="margin:0 0 14px;color:var(--muted);font-size:11.5px">Quote v${quote.version} · ${quote.status === "accepted" ? "accepted" : "draft"}${quote.acceptedAt ? " (" + esc(quote.acceptedAt.slice(0, 10)) + ")" : ""}</p>
      <table>
        <thead><tr><th>Item</th><th class="n">Quantity</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead>
        <tbody>${quote.lines.map(row).join("")}
        <tr class="total"><td colspan="3">Base total (VAT excluded)</td><td class="n">${money(quote.baseCents)}</td></tr></tbody>
      </table>`;

    const doc = brandedDocument({
      branding,
      locale,
      title: "Quote",
      subtitle: `v${quote.version}`,
      bodyHtml,
      note: "The quote is broken down by chapter with clear measurements. VAT is applied on the final invoice by the applicable legal rule. A single point of contact throughout · 2-year guarantee on the works.",
    });
    return new Response(doc, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (e) {
    if (isFactoryError(e)) {
      return new Response(e.message, { status: e.code === "NOT_FOUND" ? 404 : 400 });
    }
    throw e;
  }
}

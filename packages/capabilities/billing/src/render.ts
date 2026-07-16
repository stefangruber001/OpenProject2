import { formatMoney } from "@repo/kernel";
import type { Invoice } from "./model";
import type { DocLabels } from "./ports";

/**
 * Deterministic HTML rendering of an invoice. All wording comes from labels
 * (pack-supplied); all formatting from the tenant's locale. Same invoice +
 * same labels + same locale ⇒ byte-identical output (principle 7).
 */
export function renderInvoiceHtml(invoice: Invoice, labels: DocLabels, locale: string): string {
  const money = (cents: number) => formatMoney(cents, invoice.currency, locale);
  const qty = (millis: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(millis / 1000);
  const title = invoice.kind === "rectificative" ? labels.rectificativeTitle : labels.invoiceTitle;

  const rows = invoice.lines
    .map(
      (l) => `<tr>
  <td>${escapeHtml(l.description)}</td>
  <td class="num">${qty(l.qtyMillis)}${l.unit ? ` ${escapeHtml(l.unit)}` : ""}</td>
  <td class="num">${money(l.unitCents)}</td>
  <td class="num">${money(l.totalCents)}</td>
</tr>`,
    )
    .join("\n");

  const taxRows = invoice.taxSummary
    .map(
      (s) => `<tr>
  <td>${labels.taxLabel} ${(s.rateBp / 100).toLocaleString(locale)} % <span class="code">(${escapeHtml(s.taxCode)})</span></td>
  <td class="num">${money(s.baseCents)}</td>
  <td class="num">${money(s.taxCents)}</td>
</tr>`,
    )
    .join("\n");

  const rectifies =
    invoice.kind === "rectificative" && invoice.rectifies
      ? `<p class="rectifies">${labels.rectifiesLabel}: ${escapeHtml(invoice.rectifies)} — ${escapeHtml(
          invoice.rectificationReason ?? "",
        )}</p>`
      : "";

  return `<!-- generated: deterministic invoice document -->
<article class="invoice">
  <style>
    .invoice { font-family: system-ui, sans-serif; max-width: 46rem; margin: 0 auto; padding: 2rem; color: #111; }
    .invoice h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
    .invoice .meta, .invoice .parties { margin: .75rem 0; font-size: .95rem; }
    .invoice table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: .95rem; }
    .invoice th, .invoice td { border-bottom: 1px solid #ddd; padding: .4rem .5rem; text-align: left; }
    .invoice .num { text-align: right; white-space: nowrap; }
    .invoice .total td { font-weight: 700; border-top: 2px solid #111; }
    .invoice .code { color: #777; font-size: .8em; }
    .invoice .rectifies { color: #a00; }
  </style>
  <h1>${title} ${escapeHtml(invoice.displayNumber)}</h1>
  <p class="meta">${labels.date}: ${invoice.issueDate}</p>
  ${rectifies}
  <div class="parties">
    <p><strong>${labels.seller}:</strong> ${escapeHtml(invoice.seller.name)}${
      invoice.seller.taxId ? ` · ${labels.taxIdLabel} ${escapeHtml(invoice.seller.taxId)}` : ""
    }${invoice.seller.address ? ` · ${escapeHtml(invoice.seller.address)}` : ""}</p>
    <p><strong>${labels.buyer}:</strong> ${escapeHtml(invoice.buyer.name)}${
      invoice.buyer.taxId ? ` · ${labels.taxIdLabel} ${escapeHtml(invoice.buyer.taxId)}` : ""
    }${invoice.buyer.address ? ` · ${escapeHtml(invoice.buyer.address)}` : ""}</p>
  </div>
  <table>
    <thead><tr><th>${labels.description}</th><th class="num">${labels.quantity}</th><th class="num">${labels.unitPrice}</th><th class="num">${labels.lineTotal}</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <table>
    <thead><tr><th></th><th class="num">${labels.taxBase}</th><th class="num">${labels.taxLabel}</th></tr></thead>
    <tbody>
${taxRows}
      <tr class="total"><td>${labels.total}</td><td class="num">${money(invoice.baseCents)}</td><td class="num">${money(
        invoice.totalCents,
      )}</td></tr>
    </tbody>
  </table>
  ${invoice.seal ? `<p class="code">seal #${invoice.seal.seq} · ${invoice.seal.algorithm} · ${invoice.seal.hash}</p>` : ""}
</article>
`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

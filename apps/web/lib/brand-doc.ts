import type { brandingSchema } from "@repo/kernel";
import type { z } from "zod";

type Branding = z.infer<typeof brandingSchema>;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The Canei brand mark: a rounded square in the brand green carrying a minimal
 * white house/roof glyph (renovations), with a small yellow "spark" — the
 * pictogram echo. Data-driven from the tenant palette; premium at any size.
 */
export function brandMarkSvg(palette: Record<string, string> = {}, size = 40): string {
  const green = palette.brandGreen ?? "#48733c";
  const spark = palette.brandYellow ?? "#f2c230";
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" role="img" aria-label="Canei Subirats">
    <rect x="1" y="1" width="38" height="38" rx="10" fill="${green}"/>
    <path d="M11 21.5 L20 13 L29 21.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M13.5 20 V28.5 H26.5 V20" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="18" y="23.5" width="4" height="5" rx="1" fill="#fff"/>
    <rect x="28" y="28" width="6.5" height="6.5" rx="2" fill="${spark}"/>
  </svg>`;
}

/** Full logo lockup (mark + serif wordmark + slogan) as HTML. */
export function brandLockupHtml(branding: Branding): string {
  const name = esc(branding.tradeName ?? branding.legalName);
  const slogan = branding.slogan ? esc(branding.slogan) : "";
  return `<div class="brand">
    ${brandMarkSvg(branding.palette, 40)}
    <div class="brand-txt"><span class="brand-name">${name}</span>${slogan ? `<span class="brand-slogan">${slogan}</span>` : ""}</div>
  </div>`;
}

/**
 * Wrap document body HTML (a quote or invoice) in the full corporate identity:
 * the logo lockup header, brand-green rule, Roboto Serif / Inter typography and
 * a contact footer built from the tenant's branding. One premium shell for
 * every document.
 */
export function brandedDocument(opts: {
  branding: Branding;
  locale: string;
  title: string;
  subtitle?: string;
  bodyHtml: string;
  note?: string;
}): string {
  const { branding, locale, title, subtitle, bodyHtml, note } = opts;
  const p = branding.palette ?? {};
  const green = p.brandGreen ?? "#48733c";
  const c = branding.contact ?? {};
  const contactLine = [c.address, c.phone, c.email]
    .filter((x): x is string => Boolean(x))
    .map(esc)
    .join(" · ");
  const legal = esc(branding.legalName);

  return `<!doctype html><html lang="${esc(locale)}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<style>
  :root{ --green:${green}; --spark:${p.brandYellow ?? "#f2c230"}; --ink:#171911; --body:#40433a; --muted:#8a8d80; --line:#eceae4; --paper:#fff;
    --serif:"Roboto Serif",Georgia,"Times New Roman",serif; --sans:Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif; }
  @page{ size:A4; margin:16mm 15mm; }
  *{ box-sizing:border-box; } html,body{ margin:0; padding:0; }
  body{ font-family:var(--sans); color:var(--body); font-size:13px; line-height:1.55; background:#f6f5f2; }
  .sheet{ max-width:820px; margin:22px auto; background:var(--paper); border:1px solid var(--line); border-radius:14px;
    box-shadow:0 1px 2px rgba(30,40,20,.04),0 22px 44px -26px rgba(30,40,20,.22); padding:34px 40px 30px; }
  @media print{ body{ background:#fff; } .sheet{ margin:0; border:none; box-shadow:none; border-radius:0; padding:0; } .noprint{ display:none; } }
  h1,h2,h3{ font-family:var(--serif); color:var(--ink); font-weight:600; margin:0; }
  .head{ display:flex; justify-content:space-between; align-items:flex-start; gap:20px; border-bottom:3px solid var(--green); padding-bottom:16px; }
  .brand{ display:flex; align-items:center; gap:12px; }
  .brand-name{ font-family:var(--serif); font-weight:600; font-size:20px; color:var(--ink); line-height:1.05; display:block; }
  .brand-slogan{ font-size:11px; font-style:italic; color:var(--muted); }
  .doc-meta{ text-align:right; }
  .doc-meta .t{ font-family:var(--serif); font-size:22px; font-weight:600; color:var(--green); }
  .doc-meta .s{ font-size:12px; color:var(--muted); margin-top:2px; }
  main{ padding-top:18px; }
  table{ width:100%; border-collapse:collapse; font-size:12.5px; font-variant-numeric:tabular-nums; }
  th{ text-align:left; font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); border-bottom:1.5px solid var(--green); padding:7px 8px; }
  td{ padding:7px 8px; border-bottom:1px solid var(--line); }
  td.n,th.n{ text-align:right; white-space:nowrap; }
  tr.total td{ font-weight:700; color:var(--ink); border-top:2px solid var(--green); border-bottom:none; }
  .note{ margin-top:16px; border-left:3px solid var(--green); background:#f2f6ef; border-radius:0 8px 8px 0; padding:9px 13px; font-size:11.5px; color:var(--ink); }
  footer{ margin-top:22px; border-top:1px solid var(--line); padding-top:12px; font-size:10.5px; color:var(--muted); display:flex; justify-content:space-between; gap:14px; flex-wrap:wrap; }
  .bar{ margin-top:16px; text-align:center; }
  .btn{ display:inline-block; background:var(--green); color:#fff; border:none; border-radius:10px; padding:10px 20px; font:600 13px var(--sans); cursor:pointer; }
</style></head>
<body>
  <div class="sheet">
    <div class="head">
      ${brandLockupHtml(branding)}
      <div class="doc-meta"><div class="t">${esc(title)}</div>${subtitle ? `<div class="s">${esc(subtitle)}</div>` : ""}</div>
    </div>
    <main>${bodyHtml}</main>
    ${note ? `<div class="note">${note}</div>` : ""}
    <footer>
      <span>${legal}${contactLine ? " · " + contactLine : ""}</span>
      <span>${branding.slogan ? esc(branding.slogan) : ""}</span>
    </footer>
  </div>
  <div class="bar noprint"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div>
</body></html>`;
}

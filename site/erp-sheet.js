/* =============================================================================
   CaneiSheet — the approved design, rendered as HTML.

   WHY THIS FILE EXISTS. `erp-pdf.js` draws the twenty documents as vector PDF
   and `site/documentos/` holds the designer's static pages, but the screens
   the operator actually looks at — the invoice pane, the contract pane, the
   quote preview, the change-order drawer — were four hand-built renderers that
   each spoke its own dialect of an older design. "No other old design is used
   to generate any document" (operator, Aug 2026) means those four go away and
   everything renders through one module. This is that module.

   WHAT IT IS. The same contract as the PDF writer — `render(doc, brand, tr)`
   where `doc` is the shape `CaneiDocTypes.build()` produces — but the output
   is the documentos design system in HTML: `.sheet`, `.runbar`, `.hdr`,
   `.meta`, `.facts`, `.band`, `.totals`, `.sig`, `.docfoot`. The CSS is
   lifted from the committed templates (06-factura carries the complete
   system; only `.tl` lives elsewhere), so what a browser prints from here is
   what the designer approved, running header and all.

   ISOLATION. The class names are the design's own (`table`, `h1`, `.lbl`,
   `.badge` — names the app also uses), so a sheet must never share a
   stylesheet scope with the app. `page()` produces a complete standalone
   document for exactly that reason: embed it in an <iframe srcdoc> for
   preview and print it from its own window, and neither cascade can touch
   the other. `render()`/`css()` exist for callers that manage scoping
   themselves (tests, mostly).

   The same searchability discipline as the templates applies: letter-spacing
   stays at zero and the print block turns kerning and ligatures off, because
   "FACT URA" is not findable with Ctrl+F and being searchable is not
   optional.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(typeof globalThis !== "undefined" ? globalThis : root);
  else root.CaneiSheet = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  /* --------------------------------------------------------------- helpers */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** "FACTURA RECTIFICATIVA" → "Factura rectificativa" — the templates put the
   *  document's name in sentence case and let the type style shout instead. */
  function sentence(s) {
    const t = String(s || "");
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }

  /** The audience band colour — the design's own device (mirrors erp-pdf). */
  const BAND_TONE = { cliente: "blue", cobro: "yellow", proveedor: "grey", interno: "grey" };

  /** The house symbol, exactly as the templates draw it. */
  function houseSvg(cls, fill) {
    return (
      '<svg class="' +
      cls +
      '" viewBox="0 0 118.391 137.002" xmlns="http://www.w3.org/2000/svg"><path fill="' +
      fill +
      '" fill-rule="nonzero" d="M60.449 0 0 38.374V137.002H118.391V38.445ZM107.462 126.073H71.480L56.137 122.671V71.986L82.416 65.524H45.953V126.073H10.929V44.382L60.318 13.028L107.462 44.311Z"/></svg>'
    );
  }

  /* ------------------------------------------------------------------- css */

  /* The design system, from the committed templates. Element selectors are
     deliberately bare — a sheet lives in its own document (see ISOLATION). */
  const SHEET_CSS = [
    '.sheet{width:210mm;min-height:297mm;margin:10mm auto;padding:15mm 16mm 12mm;background:#fff;position:relative;box-shadow:0 1px 2px rgba(0,0,0,.05),0 30px 60px -30px rgba(0,0,0,.22);overflow:hidden;font:400 9.3pt/1.45 Inter,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:#3D3D3D;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    ".sheet *,.sheet *::before,.sheet *::after{box-sizing:border-box}",
    ".inner{position:relative;z-index:1;display:flex;flex-direction:column;min-height:267mm}",
    ".doctbl{width:100%;border-collapse:collapse}",
    ".doctbl>thead>tr>td,.doctbl>tbody>tr>td{padding:0;vertical-align:top}",
    '.runbar{border-bottom:1.5px solid #48733C;padding-bottom:4px;margin-bottom:6mm;display:flex;justify-content:space-between;align-items:baseline;font-family:"Roboto Serif",Georgia,serif;font-size:6.8pt;color:#48733C}',
    ".runbar b{font-weight:600;letter-spacing:0;text-transform:uppercase;font-size:6.8pt}",
    ".runbar .rb{font-variant-numeric:tabular-nums}",
    ".flexcol{display:flex;flex-direction:column;min-height:255mm}",
    ".chap{break-inside:avoid}",
    '.serif{font-family:"Roboto Serif",Georgia,serif}',
    ".wm{position:absolute;top:0;right:0;width:96mm;height:64mm;overflow:hidden;z-index:0;pointer-events:none}",
    ".wm svg{position:absolute;top:-36mm;right:-32mm;width:128mm;height:auto;display:block}",
    ".hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:12mm}",
    ".lockup{display:flex;align-items:center;gap:11px}",
    ".sym{width:33px;height:auto;flex:none}",
    "img.sym{width:auto;max-width:44mm;max-height:14mm}",
    '.wordmark{font:400 16pt/1 "Roboto Serif",Georgia,serif;color:#000;letter-spacing:0}',
    ".tagline{font-family:\"Roboto Serif\",Georgia,serif;font-weight:200;font-variation-settings:'wght' 200;font-size:7.4pt;color:#48733C;margin-top:3px;letter-spacing:0}",
    ".docref{text-align:right;flex:none}",
    '.doctype{font-family:"Roboto Serif",Georgia,serif;font-weight:500;font-size:9pt;letter-spacing:0;text-transform:uppercase;color:#48733C}',
    '.docnum{font-family:"Roboto Serif",Georgia,serif;font-weight:600;font-size:18pt;color:#000;font-variant-numeric:tabular-nums;margin-top:2px;letter-spacing:0}',
    ".meta{display:grid;grid-auto-flow:column;grid-auto-columns:auto;justify-content:start;border-top:1px solid #E0E0E0;border-bottom:1px solid #E0E0E0;margin-top:5mm}",
    ".meta>div{padding:6px 9px 7px;border-left:1px solid #E0E0E0}",
    ".meta>div:first-child{border-left:0;padding-left:0}",
    ".lbl{font:600 6.6pt Inter,sans-serif;letter-spacing:0;text-transform:uppercase;color:#767676;margin-bottom:3px}",
    ".val{font:600 9.2pt Inter,sans-serif;color:#000;font-variant-numeric:tabular-nums;white-space:nowrap}",
    '.sheet h1{font-family:"Roboto Serif",Georgia,serif;font-weight:600;font-size:17.5pt;letter-spacing:-.01em;color:#000;margin:5.5mm 0 0;text-wrap:pretty}',
    ".subject{font-size:9.4pt;color:#3D3D3D;margin-top:1.5mm;max-width:155mm;text-wrap:pretty}",
    ".facts{display:flex;flex-wrap:wrap;row-gap:3mm;margin-top:5mm}",
    ".facts>div{padding:0 7mm 0 0;margin-right:7mm;border-right:1px solid #E0E0E0}",
    ".facts>div:last-child{border-right:0;margin-right:0;padding-right:0}",
    '.fig{font-family:"Roboto Serif",Georgia,serif;font-weight:600;font-size:13.5pt;color:#000;font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap}',
    ".fig.hero{font-size:17pt}",
    ".punct{display:inline-block;width:11px;height:auto;margin-right:7px;vertical-align:baseline}",
    '.band{font-family:"Roboto Serif",Georgia,serif;font-weight:500;font-size:8.4pt;letter-spacing:0;text-transform:uppercase;color:#000;padding:4px 10px;margin:4.5mm 0 3mm;display:flex;justify-content:space-between;align-items:baseline;gap:8mm}',
    ".band .bandnote{font:400 7.4pt Inter,sans-serif;letter-spacing:0;text-transform:none;color:#3D3D3D}",
    ".band.blue{background:#C2D2F2}.band.yellow{background:#F2D64B}.band.grey{background:#F2F2F2}",
    ".parties{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:4.5mm}",
    ".plabel{font:600 6.6pt Inter,sans-serif;letter-spacing:0;text-transform:uppercase;color:#48733C;margin-bottom:4px}",
    '.pname{font-family:"Roboto Serif",Georgia,serif;font-weight:600;font-size:10.5pt;color:#000;margin-bottom:2px}',
    ".pdet{font-size:8.3pt;line-height:1.5;color:#3D3D3D}",
    ".sheet table{width:100%;border-collapse:collapse;font-size:8.6pt}",
    ".sheet thead th{background:#F2F2F2;font:600 6.7pt Inter,sans-serif;letter-spacing:0;text-transform:uppercase;color:#3D3D3D;text-align:left;padding:5px 8px;border-bottom:1px solid #E0E0E0}",
    ".sheet thead th.num{text-align:right}",
    ".sheet tbody td{padding:5px 8px;border-bottom:1px solid #ECECEA;vertical-align:top;color:#3D3D3D}",
    ".sheet tbody td b,.sheet tbody td strong{color:#000}",
    ".num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}",
    '.sheet tr.chapter td{font-family:"Roboto Serif",Georgia,serif;font-weight:600;font-size:9.2pt;color:#375A2E;padding:10px 8px 4px;border-bottom:1.5px solid #48733C;background:#fff}',
    ".sheet tr.sub td{font-weight:600;color:#000;background:#FAFAF8;border-bottom:1px solid #E0E0E0}",
    ".sheet tr.sub td.cap{font-weight:400;color:#767676;text-align:right}",
    ".small{font-size:8pt;line-height:1.5}",
    ".muted{color:#767676}",
    ".notecell{color:#767676;font-size:7.8pt}",
    ".totals{margin-left:auto;min-width:76mm;width:auto!important;margin-top:4mm}",
    ".sheet .totals td{padding:3px 10px;border:0;font-size:9pt;color:#000}",
    ".sheet .totals td:first-child{color:#767676}",
    '.sheet .totals tr.grand td{border-top:2px solid #48733C;background:#F2F2F2;padding-top:8px;padding-bottom:7px;font-family:"Roboto Serif",Georgia,serif;font-weight:600;font-size:12.5pt;color:#000;letter-spacing:-.01em}',
    ".note{border-left:3px solid #48733C;background:#F4F7F1;padding:8px 11px;font-size:8.6pt;margin:3.5mm 0}",
    ".note.warn{border-left-color:#F2D64B;background:#FBF5DA}",
    ".box{border:1px solid #E0E0E0;padding:10px 13px;background:#fff}",
    ".sheet ul.clean{margin:2mm 0 0;padding-left:14px}",
    ".sheet ul.clean li{margin-bottom:1.2mm}",
    ".prog{height:6px;background:#F2F2F2;position:relative}",
    ".prog i{position:absolute;top:0;left:0;height:100%;display:block}",
    /* field/value cells — the receipt's and the project sheet's grid */
    ".kvgrid{display:grid;gap:3mm 8mm;margin:2mm 0 3mm}",
    ".kvgrid .kval{font:600 9.2pt Inter,sans-serif;color:#000;font-variant-numeric:tabular-nums}",
    /* the punch list — the tick is drawn, not typed, so it prints everywhere */
    ".ckl{display:flex;gap:8px;align-items:baseline;padding:4px 0;border-bottom:1px solid #ECECEA;font-size:8.6pt}",
    ".ckbox{flex:none;width:9px;height:9px;position:relative;top:1px;border:1px solid #E0E0E0;background:#F4F7F1}",
    ".ckbox.ok{background:#48733C;border-color:#48733C}",
    ".ckbox.fail{background:#fff;border-color:#8F2D1B;box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 9px #8F2D1B}",
    ".ckl .ckby{margin-left:auto;color:#767676;font-size:8pt;white-space:nowrap}",
    ".overrun{color:#8F2D1B}",
    /* the line's coloured plate, when a pictogram module is present */
    ".descell{display:flex;gap:8px;min-width:0}",
    ".pictwrap{flex:0 0 auto;line-height:0}",
    ".plate{display:inline-flex;flex-direction:column;align-items:center;gap:1px;line-height:1}",
    ".plate svg{display:block}",
    ".platec{font:600 8px Inter,sans-serif;letter-spacing:.02em;color:#767676;white-space:nowrap}",
    /* the discreet mark on a row whose picture waits in the graphic annex */
    ".amark{font:700 7px Inter,sans-serif;color:#48733C;border:1px solid #48733C;border-radius:3px;padding:0 2px;margin-left:4px;vertical-align:super}",
    ".sig{display:grid;gap:14mm}",
    ".sig .line{border-top:1px solid #000;margin-top:11mm;padding-top:5px;font-size:7.8pt;color:#767676}",
    ".terms{margin-top:auto;padding-top:4.5mm}",
    ".docfoot{margin-top:auto;padding-top:4mm}",
    "footer.brand{border-top:2px solid #48733C;padding-top:4mm;display:flex;justify-content:space-between;gap:12mm;align-items:flex-start}",
    '.legal{font-family:"Roboto Serif",Georgia,serif;font-size:6.8pt;line-height:1.6;color:#48733C;max-width:132mm}',
    '.site{text-align:right;font-family:"Roboto Serif",Georgia,serif;color:#48733C;flex:none}',
    ".site .url{font-weight:700;font-size:8.6pt}",
    ".site .loc{font-weight:200;font-variation-settings:'wght' 200;font-size:6.8pt;margin-top:2px}",
  ].join("\n");

  /* Print discipline — the templates' own, including the kerning-off block
     that keeps the extracted text searchable and the CANEI-PRINT-FIX rules
     (margins on @page so every page gets them; never strand a heading). */
  const PRINT_CSS = [
    "@page{size:A4;margin:11mm 13mm 10mm}",
    "@media print{",
    "html,body{background:#fff!important}",
    ".sheet{margin:0!important;padding:0!important;width:auto!important;min-height:0!important;box-shadow:none!important;border:0!important;overflow:visible!important}",
    ".inner{min-height:auto;display:block}.flexcol{min-height:auto}",
    ".wm{display:none!important}",
    '*,*::before,*::after{font-kerning:none;font-variant-ligatures:none;font-feature-settings:"kern" 0,"liga" 0}',
    "thead{display:table-header-group}",
    "tfoot{display:table-footer-group}",
    "tr{break-inside:avoid;page-break-inside:avoid}",
    ".box,.note,.sig,.facts,.meta,.docfoot,.totals,.parties,.ckl,.kvgrid{break-inside:avoid;page-break-inside:avoid}",
    "h1,h2,h3,.band,tr.chapter,.doctype{break-after:avoid;page-break-after:avoid}",
    "tr.chapter+tr{break-before:avoid;page-break-before:avoid}",
    "p,li,td{orphans:3;widows:3}",
    "table{break-inside:auto}",
    ".sheet{zoom:0.95}",
    "}",
  ].join("\n");

  /* ---------------------------------------------------------- the renderer */

  function Sheet(doc, brand, tr, opts) {
    this.doc = doc;
    this.brand = brand || {};
    this.tr = tr || String;
    this.opts = opts || {};
    this.out = [];
  }

  /** Translated, escaped text — every human-readable string goes through the
   *  same hook the PDF writer has, and the hook decides what it knows. */
  Sheet.prototype.T = function (s) {
    return esc(this.tr(String(s == null ? "" : s)));
  };

  Sheet.prototype.push = function (s) {
    this.out.push(s);
  };

  Sheet.prototype.header = function () {
    const d = this.doc,
      b = this.brand;
    const wordmark = b.wordmark || b.tradeName || b.legalName || "";
    // The company's uploaded logo is a stored blob, not a URL: it renders as
    // img[data-blob] for the host's paintImages() to fill, exactly like every
    // other stored image. A plain string is taken as a URL (tests, emails).
    const mark =
      b.logo && b.logo.storageKey
        ? '<img class="sym" data-blob="' + esc(b.logo.storageKey) + '" alt="">'
        : typeof b.logo === "string" && b.logo
          ? '<img class="sym" src="' + esc(b.logo) + '" alt="">'
          : houseSvg("sym", "#48733C");
    this.push(
      '<header class="hdr"><div class="lockup">' +
        mark +
        '<div><div class="wordmark">' +
        esc(wordmark) +
        "</div>" +
        (b.slogan ? '<div class="tagline">' + this.T(b.slogan) + "</div>" : "") +
        "</div></div>" +
        '<div class="docref"><div class="doctype">' +
        this.T(sentence(d.docType)) +
        '</div><div class="docnum">' +
        esc(d.number) +
        "</div></div></header>",
    );
    const cells = d.meta || [];
    if (cells.length) {
      this.push(
        '<div class="meta">' +
          cells
            .map(
              (c) =>
                '<div><div class="lbl">' +
                this.T(c[0]) +
                '</div><div class="val">' +
                this.T(c[1]) +
                "</div></div>",
            )
            .join("") +
          "</div>",
      );
    }
  };

  Sheet.prototype.title = function () {
    const d = this.doc;
    this.push("<h1>" + this.T(d.title) + "</h1>");
    if (d.subtitle) this.push('<div class="subject">' + this.T(d.subtitle) + "</div>");
    const facts = d.facts || [];
    if (facts.length) {
      this.push(
        '<div class="facts">' +
          facts
            .map(
              (f, i) =>
                '<div><div class="lbl">' +
                this.T(f[0]) +
                '</div><div class="fig' +
                (i === 0 ? " hero" : "") +
                '">' +
                // The small gold mark beside the headline figure — the brand's
                // own way of pointing at the number that matters.
                (i === 0 ? houseSvg("punct", "#F2D64B") : "") +
                this.T(f[1]) +
                "</div></div>",
            )
            .join("") +
          "</div>",
      );
    }
  };

  Sheet.prototype.parties = function () {
    const d = this.doc;
    if (!d.parties || !d.parties.length) return;
    this.push(
      '<div class="parties">' +
        d.parties
          .map(
            (p) =>
              '<div><div class="plabel">' +
              this.T(p.label) +
              '</div><div class="pname">' +
              esc(p.name) +
              '</div><div class="pdet">' +
              p.lines
                .filter(Boolean)
                .map((l) => esc(l))
                .join("<br>") +
              "</div></div>",
          )
          .join("") +
        "</div>",
    );
  };

  Sheet.prototype.note = function (text, warn) {
    this.push('<div class="note' + (warn ? " warn" : "") + '">' + this.T(text) + "</div>");
  };

  Sheet.prototype.band = function (label, note, tone) {
    const cls = BAND_TONE[tone || this.doc.audience || "cliente"] || "blue";
    this.push(
      '<div class="band ' +
        cls +
        '"><span>' +
        this.T(label) +
        "</span>" +
        (note ? '<span class="bandnote">' + this.T(note) + "</span>" : "") +
        "</div>",
    );
  };

  /** The line's plate, when the pictogram module is around. Derived from the
   *  item's own words unless the caller named one — same rule as the PDF. */
  Sheet.prototype.plate = function (r, chapterName) {
    // A row may carry its plate ready-made (the app's plateFor knows the
    // catalogue); otherwise derive one from the row's own words.
    if (r.plateHtml) return '<span class="pictwrap">' + r.plateHtml + "</span>";
    const PICT = this.opts.pict || root.ErpPictograms;
    if (!PICT || !r.code) return "";
    const key = PICT.pick({
      pictogram: r.pictogram,
      desc: r.item,
      chapter: r.chapter,
      chapterName: chapterName,
    });
    return '<span class="pictwrap">' + PICT.plate(key, r.code || "", r.chapter, 18) + "</span>";
  };

  Sheet.prototype.groups = function () {
    const d = this.doc;
    if (!d.groups || !d.groups.length) return;
    const h = [];
    h.push(
      '<table><thead><tr><th style="width:47%">' +
        this.T("Descripcion") +
        '</th><th class="num" style="width:11%">' +
        this.T("Medicion") +
        '</th><th style="width:8%">' +
        this.T("Ud.") +
        '</th><th class="num" style="width:15%">' +
        this.T("Precio") +
        '</th><th class="num" style="width:19%">' +
        this.T("Importe") +
        "</th></tr></thead>",
    );
    for (const g of d.groups) {
      h.push(
        '<tbody class="chap"><tr class="chapter"><td colspan="5">' + esc(g.chapter) + "</td></tr>",
      );
      for (const r of g.rows) {
        const plate = this.plate(r, g.chapter);
        const desc =
          (plate ? '<div class="descell">' + plate + "<div>" : "") +
          esc(r.item) +
          // Pictures never enter a row: the row carries a mark and the
          // picture waits in the annex, so a table of numbers stays one.
          (r.flag ? '<sup class="amark" title="anexo">A</sup>' : "") +
          (r.code ? ' <span class="notecell">' + esc(r.code) + "</span>" : "") +
          (r.note ? '<br><span class="notecell">' + esc(r.note) + "</span>" : "") +
          (plate ? "</div></div>" : "");
        h.push(
          "<tr><td>" +
            desc +
            '</td><td class="num">' +
            esc(r.qtyLabel) +
            "</td><td>" +
            esc(r.unit || "") +
            '</td><td class="num">' +
            esc(r.priceLabel) +
            '</td><td class="num">' +
            esc(r.amount) +
            "</td></tr>",
        );
      }
      h.push(
        '<tr class="sub"><td colspan="4" class="cap">' +
          this.T("Subtotal") +
          " " +
          esc(g.chapter) +
          '</td><td class="num">' +
          esc(g.subtotal) +
          "</td></tr></tbody>",
      );
    }
    h.push("</table>");
    this.push(h.join(""));
  };

  Sheet.prototype.plainLines = function () {
    const d = this.doc;
    if (!d.lines || !d.lines.length) return;
    this.push(
      "<table><thead><tr><th>" +
        this.T("Concepto") +
        '</th><th class="num">' +
        this.T("Importe") +
        "</th></tr></thead><tbody>" +
        d.lines
          .map(
            (li) =>
              "<tr><td>" + esc(li.desc) + '</td><td class="num">' + esc(li.amount) + "</td></tr>",
          )
          .join("") +
        "</tbody></table>",
    );
  };

  Sheet.prototype.totals = function () {
    const d = this.doc;
    if (!d.totals || !d.totals.length) return;
    this.push(
      '<table class="totals"><tbody>' +
        d.totals
          .map(
            (t, i) =>
              '<tr class="' +
              (i === d.totals.length - 1 ? "grand" : "") +
              '"><td>' +
              this.T(t[0]) +
              '</td><td class="num">' +
              esc(t[1]) +
              "</td></tr>",
          )
          .join("") +
        "</tbody></table>",
    );
  };

  Sheet.prototype.progressBars = function (rows, opts) {
    if (!rows || !rows.length) return;
    this.push(
      "<table><thead><tr><th>" +
        this.T((opts && opts.label) || "Concepto") +
        '</th><th class="num">' +
        this.T("Avance") +
        "</th></tr></thead><tbody>" +
        rows
          .map((r) => {
            const pct = Math.max(0, Math.min(100, Number(r.pct) || 0));
            return (
              "<tr><td>" +
              esc(r.label) +
              '<div class="prog" style="margin-top:5px;max-width:52mm"><i style="width:' +
              pct.toFixed(0) +
              '%;background:#48733C"></i></div>' +
              (r.note ? '<span class="notecell">' + esc(r.note) + "</span>" : "") +
              '</td><td class="num">' +
              esc(r.amount || pct.toFixed(0) + " %") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>",
    );
  };

  Sheet.prototype.milestones = function (rows) {
    if (!rows || !rows.length) return;
    this.push(
      "<table><thead><tr><th>" +
        this.T("Fecha") +
        "</th><th>" +
        this.T("Hito") +
        "</th><th>" +
        this.T("Estado") +
        '</th><th class="num">' +
        this.T("Importe") +
        "</th></tr></thead><tbody>" +
        rows
          .map(
            (r) =>
              "<tr><td>" +
              esc(r.when || "-") +
              "</td><td>" +
              esc(r.label) +
              '</td><td class="muted">' +
              this.T(r.state || "") +
              '</td><td class="num">' +
              esc(r.amount || "") +
              "</td></tr>",
          )
          .join("") +
        "</tbody></table>",
    );
  };

  Sheet.prototype.checklist = function (rows) {
    if (!rows || !rows.length) return;
    this.push(
      rows
        .map(
          (r) =>
            '<div class="ckl"><span class="ckbox ' +
            (r.state === "ok" ? "ok" : r.state === "fail" ? "fail" : "") +
            '"></span><div>' +
            esc(r.label) +
            (r.note ? '<br><span class="notecell">' + esc(r.note) + "</span>" : "") +
            "</div>" +
            (r.by ? '<span class="ckby">' + esc(r.by) + "</span>" : "") +
            "</div>",
        )
        .join(""),
    );
  };

  Sheet.prototype.kvGrid = function (rows, cols) {
    if (!rows || !rows.length) return;
    const n = cols || 3;
    this.push(
      '<div class="kvgrid" style="grid-template-columns:repeat(' +
        n +
        ',1fr)">' +
        rows
          .map(
            (r) =>
              '<div><div class="lbl">' +
              this.T(r[0]) +
              '</div><div class="kval">' +
              this.T(r[1]) +
              "</div></div>",
          )
          .join("") +
        "</div>",
    );
  };

  Sheet.prototype.marginTable = function (rows) {
    if (!rows || !rows.length) return;
    this.push(
      "<table><thead><tr><th>" +
        this.T("Partida") +
        '</th><th class="num">' +
        this.T("Previsto") +
        '</th><th class="num">' +
        this.T("Real") +
        '</th><th class="num">' +
        this.T("Desviacion") +
        '</th><th class="num">' +
        this.T("Margen") +
        "</th></tr></thead><tbody>" +
        rows
          .map((r) => {
            // Over budget is stated with a sign as well as colour — a reader
            // who prints in greyscale still gets the fact.
            const over = r.over === true;
            const b = r.total ? "b" : "span";
            return (
              "<tr><td><" +
              b +
              ">" +
              esc(r.label) +
              "</" +
              b +
              '></td><td class="num">' +
              esc(r.budget || "") +
              '</td><td class="num">' +
              esc(r.actual || "") +
              '</td><td class="num' +
              (over ? " overrun" : "") +
              '">' +
              (over ? "+" : "") +
              esc(r.variance || "") +
              '</td><td class="num' +
              (over ? " overrun" : "") +
              '">' +
              esc(r.margin || "") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>",
    );
  };

  /** Terms and legal notes, boxed above the foot. */
  Sheet.prototype.blocks = function () {
    const d = this.doc;
    const items = []
      .concat(d.payment && d.payment.length ? [["Condiciones de pago", d.payment]] : [])
      .concat(d.notes && d.notes.length ? [["Notas", d.notes]] : []);
    if (!items.length) return;
    this.push(
      '<div class="terms">' +
        items
          .map(
            ([label, rows]) =>
              '<div class="box small" style="margin-bottom:2mm"><div class="lbl">' +
              this.T(label) +
              '</div><ul class="clean">' +
              rows.map((r) => "<li>" + this.T(r) + "</li>").join("") +
              "</ul></div>",
          )
          .join("") +
        "</div>",
    );
  };

  Sheet.prototype.signatures = function () {
    const d = this.doc;
    if (!d.signatures || !d.signatures.length) return;
    this.push(
      '<div class="sig" style="grid-template-columns:repeat(' +
        d.signatures.length +
        ',1fr)">' +
        d.signatures.map((s) => '<div><div class="line">' + this.T(s) + "</div></div>").join("") +
        "</div>",
    );
  };

  Sheet.prototype.docfoot = function () {
    const b = this.brand;
    const legal =
      b.legalFooter ||
      [
        [b.legalName, b.taxId, b.registeredAddress || b.address].filter(Boolean).join(" · "),
        [b.phone, b.email, b.registry].filter(Boolean).join(" · "),
      ]
        .filter(Boolean)
        .join("\n");
    const site = b.web ? '<div class="site"><div class="url">' + esc(b.web) + "</div></div>" : "";
    this.push(
      '<div class="docfoot"><footer class="brand"><div class="legal">' +
        esc(legal).replace(/\n/g, "<br>") +
        "</div>" +
        site +
        "</footer></div>",
    );
  };

  /* The same section dispatch as the PDF writer, and the same hard error: a
     silently ignored section is a block of the document that goes missing
     without saying so. */
  const SECTION = {
    band: (s, x) => s.band(x.label, x.note, x.tone),
    note: (s, x) => s.note(x.text),
    table: (s, x) => {
      if (x.label) s.band(x.label, x.note);
      s.groups();
    },
    lines: (s) => s.plainLines(),
    totals: (s) => s.totals(),
    progressBars: (s, x) => s.progressBars(x.rows, x),
    milestones: (s, x) => s.milestones(x.rows),
    checklist: (s, x) => s.checklist(x.rows),
    kvGrid: (s, x) => s.kvGrid(x.rows, x.cols),
    marginTable: (s, x) => s.marginTable(x.rows),
  };

  function render(doc, brand, tr, opts) {
    const s = new Sheet(doc, brand, tr, opts);
    const b = s.brand;
    s.header();
    s.title();
    s.parties();
    if (doc.intro) s.note(doc.intro);

    if (doc.sections && doc.sections.length) {
      for (const x of doc.sections) {
        const fn = SECTION[x.type];
        if (!fn) throw new Error("erp-sheet: unknown section type " + JSON.stringify(x.type));
        fn(s, x);
      }
    } else if (doc.groups && doc.groups.length) {
      s.band(doc.tableLabel || "Detalle por partidas", doc.tableNote || "");
      s.groups();
      s.totals();
    } else {
      s.plainLines();
      s.totals();
    }

    s.blocks();
    s.signatures();
    s.docfoot();

    const wordmark = b.wordmark || b.tradeName || b.legalName || "";
    return (
      '<div class="sheet" translate="no">' +
      '<div class="wm">' +
      houseSvg("", "#F2F2F2") +
      "</div>" +
      '<div class="inner">' +
      '<table class="doctbl"><thead><tr><td><div class="runbar"><b>' +
      esc(wordmark) +
      '</b><span class="rb">' +
      s.T(sentence(doc.docType)) +
      " · " +
      esc(doc.number) +
      "</span></div></td></tr></thead><tbody><tr><td>" +
      '<div class="flexcol">' +
      s.out.join("\n") +
      "</div></td></tr></tbody></table></div></div>"
    );
  }

  function css() {
    return SHEET_CSS + "\n" + PRINT_CSS;
  }

  /**
   * The same stylesheet, caged for a host page that has styles of its own.
   *
   * Every selector is prefixed with the scope DOUBLED (`.cnsheet.cnsheet .lbl`)
   * so a sheet rule outguns the host's own single- and double-class rules for
   * the same names (`.lbl`, `.note`, `.meta` — the app uses them all), while
   * host rules never gain new subjects. `@page` is dropped: the host owns its
   * print geometry, and a second `@page` would change how EVERYTHING the host
   * prints, not just the sheet. `@media print` survives with its inner rules
   * scoped the same way.
   */
  function scopedCss(scope) {
    const pre = scope + scope + " ";
    const scopeRules = (block) =>
      block.replace(/(^|\})\s*([^@{}][^{}]*)\{/g, (m, brace, sels) => {
        const scoped = sels
          .split(",")
          .map((s) => pre + s.trim())
          .join(",");
        return (brace || "") + scoped + "{";
      });
    const out = [];
    let inMedia = false;
    for (const raw of (SHEET_CSS + "\n" + PRINT_CSS).split("\n")) {
      const rule = raw.trim();
      if (!rule) continue;
      if (rule.startsWith("@page")) continue;
      if (rule.startsWith("@media")) {
        if (rule.endsWith("}")) {
          // single-line block: scope what sits between its braces
          const i = rule.indexOf("{");
          out.push(rule.slice(0, i + 1) + scopeRules(rule.slice(i + 1, rule.length - 1)) + "}");
        } else {
          // the multi-line print block: open it, rule lines follow
          out.push(rule);
          inMedia = true;
        }
      } else if (inMedia && rule === "}") {
        out.push(rule);
        inMedia = false;
      } else {
        out.push(scopeRules(rule));
      }
    }
    return out.join("\n");
  }

  /**
   * A complete standalone document — the only supported way to show a sheet
   * inside the app (iframe srcdoc) or to print one (own window). Neither
   * stylesheet can reach the other; see ISOLATION above.
   */
  function page(doc, brand, tr, opts) {
    const o = opts || {};
    const body = render(doc, brand, tr, o) + (o.extraHtml || "");
    return (
      '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      "<title>" +
      esc(sentence(doc.docType) + " " + doc.number) +
      "</title>" +
      '<link rel="stylesheet" href="' +
      esc(o.fontsHref || "assets/canei-fonts.css") +
      '">' +
      "<style>html,body{margin:0;padding:0}body{background:#EDEDEB}" +
      css() +
      (o.extraCss || "") +
      "</style></head><body>" +
      body +
      "</body></html>"
    );
  }

  return { render, css, scopedCss, page, BAND_TONE };
});

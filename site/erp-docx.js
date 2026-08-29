/* =============================================================================
   CaneiDocx — every document this system prints, as a Word file.

   WHY IT EXISTS. The operator asked for a Word version of every PDF, an exact
   mirror. The way to make two formats agree is NOT to write the document
   twice: it is to write it once and render it twice. So this reads exactly the
   same descriptor `CaneiDocTypes.build()` produces and `erp-pdf.js` consumes —
   same title, same meta strip, same chapters, same totals, same terms, same
   signature lines, same annex plates, in the same order — and emits OOXML
   instead of PDF operators. A field that reaches one reaches the other, and a
   document type added tomorrow gets both without being told.

   WHAT «EXACT MIRROR» HONESTLY MEANS. Every fact, label, row and figure is the
   same, in the same order, with the same corporate identity — the green rules,
   the serif headings, the shaded party blocks, the gold mark beside the
   headline figure. It is NOT the same pagination: Word reflows text on the
   reader's own machine with the fonts it happens to have, and a file that
   pretended otherwise would be lying about something the format does not let
   anybody control. Where the PDF draws a progress BAR this writes the same
   percentage as a shaded cell of that width, because a bar is a picture of a
   number and the number is what has to survive.

   FONTS. The PDF embeds the house faces; a .docx cannot without shipping the
   font files inside every document. Georgia stands in for the serif and Arial
   for the sans — the pair the house style falls back to on screen — so the
   document opens looking like itself on a machine that has never seen this
   company. Recorded in ASSUMPTIONS.

   NO DEPENDENCY. A .docx is a ZIP of XML parts; CaneiZip stores them. Nothing
   is fetched, nothing is bundled, and the whole writer can be read in one
   sitting — the same bargain erp-pdf.js already made.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./erp-zip.js"));
  else root.CaneiDocx = factory(root.CaneiZip);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Zip) {
  "use strict";

  /* The palette, taken from the PDF writer so the two cannot drift apart. */
  const C = {
    ink: "14160F",
    body: "3D3D3D",
    muted: "6B7063",
    green: "48733C",
    line: "D8DCD2",
    wash: "F1F4EE",
    white: "FFFFFF",
    spark: "C8A24B",
  };
  const SERIF = "Georgia";
  const SANS = "Arial";

  /* A4 in twentieths of a point, and the content width the tables share.
     20 twips = 1 pt; the PDF's 18 mm margins are 1020 twips. */
  const PAGE_W = 11906;
  const MARGIN = 1020;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const esc = (v) =>
    String(v === null || v === undefined ? "" : v).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c],
    );

  /** Word measures type in HALF-points, which is the single most common way
   *  to end up with a document at twice the intended size. */
  const half = (pt) => Math.round(pt * 2);

  /**
   * One paragraph. `o` = { font, size, color, bold, align, space, caps,
   * shade, tracking, indent }.
   */
  /*  ORDER IS NOT STYLE, IT IS VALIDITY. OOXML's schema fixes the sequence of
      every child in `pPr`, `rPr` and `tcPr`, and Word does not repair a file
      that gets it wrong — it refuses to open it with «problems with the
      contents», naming nothing. The order below is the schema's own:
        pPr : pBdr, shd, spacing, ind, jc, rPr
        rPr : rFonts, b, caps, color, spacing, sz  */
  function p(text, o) {
    o = o || {};
    const runs = String(text === null || text === undefined ? "" : text).split("\n");
    const rpr =
      `<w:rPr><w:rFonts w:ascii="${o.font || SANS}" w:hAnsi="${o.font || SANS}"/>` +
      (o.bold ? "<w:b/>" : "") +
      (o.caps ? "<w:caps/>" : "") +
      `<w:color w:val="${o.color || C.body}"/>` +
      (o.tracking ? `<w:spacing w:val="${Math.round(o.tracking * 20)}"/>` : "") +
      `<w:sz w:val="${half(o.size || 9)}"/>` +
      "</w:rPr>";
    const body = runs
      .map(
        (r, i) =>
          (i ? "<w:r><w:br/></w:r>" : "") +
          `<w:r>${rpr}<w:t xml:space="preserve">${esc(r)}</w:t></w:r>`,
      )
      .join("");
    return (
      "<w:p><w:pPr>" +
      (o.rule
        ? `<w:pBdr><w:bottom w:val="single" w:sz="${o.ruleSize || 6}" w:space="1" w:color="${o.ruleColor || C.line}"/></w:pBdr>`
        : "") +
      (o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : "") +
      `<w:spacing w:before="${o.space === undefined ? 40 : o.space}" w:after="${o.after === undefined ? 40 : o.after}"/>` +
      (o.indent ? `<w:ind w:left="${o.indent}"/>` : "") +
      (o.align ? `<w:jc w:val="${o.align}"/>` : "") +
      rpr +
      "</w:pPr>" +
      body +
      "</w:p>"
    );
  }

  /** A cell. `c` = { text | xml, w, shade, align, font, size, bold, color, span }. */
  function cell(c) {
    const inner = c.xml !== undefined ? c.xml : p(c.text, c);
    // tcPr's schema sequence: tcW, gridSpan, tcBorders, shd, tcMar, vAlign.
    return (
      "<w:tc><w:tcPr>" +
      `<w:tcW w:w="${c.w || 0}" w:type="dxa"/>` +
      (c.span ? `<w:gridSpan w:val="${c.span}"/>` : "") +
      (c.top
        ? `<w:tcBorders><w:top w:val="single" w:sz="${c.topSize || 6}" w:space="0" w:color="${c.topColor || C.line}"/></w:tcBorders>`
        : "") +
      (c.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${c.shade}"/>` : "") +
      '<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>' +
      '<w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>' +
      '<w:vAlign w:val="top"/>' +
      "</w:tcPr>" +
      // A cell may never be empty: Word requires at least one block-level
      // child, and a `<w:tc>` with nothing in it is another file that will
      // not open.
      (inner || p("")) +
      // A nested table must be FOLLOWED by a paragraph inside the same cell.
      // Word treats a cell that ends on `</w:tbl>` as malformed content.
      (/<\/w:tbl>\s*$/.test(inner) ? p("", { size: 1, space: 0, after: 0 }) : "") +
      "</w:tc>"
    );
  }

  /** A borderless table — the layout tool, exactly as the PDF uses columns. */
  function table(rows, opts) {
    opts = opts || {};
    const width = opts.width || CONTENT_W;
    // tblGrid is REQUIRED, not decorative: without it Word has no column
    // geometry to lay the rows against and treats the file as damaged. The
    // widths come from the widest row, which is the one that defines the grid.
    const widest = rows.reduce((a, r) => (r.length > a.length ? r : a), rows[0] || []);
    const grid = widest.length
      ? widest.map((c) => `<w:gridCol w:w="${c.w || Math.floor(width / widest.length)}"/>`).join("")
      : `<w:gridCol w:w="${width}"/>`;
    return (
      "<w:tbl><w:tblPr>" +
      `<w:tblW w:w="${width}" w:type="dxa"/>` +
      "<w:tblBorders>" +
      ["top", "left", "bottom", "right", "insideH", "insideV"]
        .map((s) => `<w:${s} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`)
        .join("") +
      "</w:tblBorders>" +
      '<w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>' +
      "</w:tblPr>" +
      `<w:tblGrid>${grid}</w:tblGrid>` +
      rows.map((r) => "<w:tr>" + r.map(cell).join("") + "</w:tr>").join("") +
      "</w:tbl>"
    );
  }

  /** Evenly divided columns, the meta strip and the facts row's shape. */
  const evenly = (n) => Math.floor(CONTENT_W / Math.max(1, n));

  /** A label-over-value cell, the idiom the PDF's meta and facts rows use. */
  const labelValue = (label, value, w, o) => ({
    w,
    xml:
      p(label, { size: 6.5, font: SANS, bold: true, color: C.muted, caps: true, after: 0 }) +
      p(value, {
        size: (o && o.size) || 9,
        font: SERIF,
        bold: true,
        color: C.ink,
        space: 0,
      }),
  });

  /* ---------------------------------------------------------------- writer */

  function Doc(doc, brand, tr) {
    this.doc = doc || {};
    this.brand = brand || {};
    this.tr = tr || String;
    this.out = [];
    this.media = []; // { name, bytes, ext }
  }

  Doc.prototype.push = function (xml) {
    this.out.push(xml);
  };
  Doc.prototype.t = function (s) {
    return this.tr(s === null || s === undefined ? "" : String(s));
  };

  /** A page break — the annex opens on its own page, as it does in the PDF. */
  Doc.prototype.pageBreak = function () {
    this.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  };

  Doc.prototype.header = function () {
    const d = this.doc,
      b = this.brand;
    const halfW = Math.floor(CONTENT_W / 2);
    this.push(
      table([
        [
          {
            w: halfW,
            xml:
              p(b.wordmark || "Canei Subirats", {
                font: SERIF,
                size: 15,
                color: C.ink,
                after: 0,
              }) +
              (b.slogan ? p(b.slogan, { font: SERIF, size: 7.5, color: C.green, space: 0 }) : ""),
          },
          {
            w: halfW,
            xml:
              p(this.t(d.docType || ""), {
                font: SANS,
                size: 8,
                bold: true,
                color: C.green,
                caps: true,
                align: "right",
                after: 0,
                tracking: 0.04,
              }) +
              p(d.number || "", {
                font: SERIF,
                size: 17,
                bold: true,
                color: C.ink,
                align: "right",
                space: 0,
              }),
          },
        ],
      ]),
    );
    this.push(p("", { size: 2, rule: true, after: 60 }));

    const cells = d.meta || [];
    if (cells.length) {
      const w = evenly(cells.length);
      this.push(table([cells.map((c) => labelValue(this.t(c[0]), this.t(c[1]), w))]));
      this.push(p("", { size: 2, rule: true, after: 80 }));
    }
  };

  Doc.prototype.title = function () {
    const d = this.doc;
    this.push(p(this.t(d.title), { font: SERIF, size: 17, bold: true, color: C.ink, after: 20 }));
    if (d.subtitle) this.push(p(this.t(d.subtitle), { size: 9, color: C.body, space: 0 }));

    const facts = d.facts || [];
    if (facts.length) {
      const w = evenly(facts.length);
      this.push(
        table([
          facts.map((f, i) =>
            i === 0
              ? {
                  w,
                  xml:
                    p(this.t(f[0]), {
                      size: 6.5,
                      bold: true,
                      color: C.muted,
                      caps: true,
                      after: 0,
                    }) +
                    // The gold mark beside the headline figure, as a filled
                    // rule under it: Word has no free-floating rectangle that
                    // survives a reflow, and the mark's job is to point at
                    // this number wherever the number ends up.
                    p(this.t(f[1]), {
                      font: SERIF,
                      size: 14,
                      bold: true,
                      color: C.ink,
                      space: 0,
                      rule: true,
                      ruleColor: C.spark,
                      ruleSize: 12,
                    }),
                }
              : labelValue(this.t(f[0]), this.t(f[1]), w, { size: 11.5 }),
          ),
        ]),
      );
      this.push(p("", { size: 2, after: 60 }));
    }
  };

  Doc.prototype.parties = function () {
    const d = this.doc;
    if (!d.parties || !d.parties.length) return;
    const w = Math.floor((CONTENT_W - 200) / d.parties.length);
    this.push(
      table([
        d.parties.map((party) => ({
          w,
          shade: C.wash,
          xml:
            p(this.t(party.label), {
              size: 6.5,
              bold: true,
              color: C.muted,
              caps: true,
              after: 0,
            }) +
            p(party.name, {
              font: SERIF,
              size: 10,
              bold: true,
              color: C.ink,
              space: 0,
              after: 20,
            }) +
            (party.lines || [])
              .filter(Boolean)
              .map((l) => p(this.t(l), { size: 8, color: C.body, space: 0, after: 0 }))
              .join(""),
        })),
      ]),
    );
    this.push(p("", { size: 2, after: 80 }));
  };

  Doc.prototype.band = function (label, note, tone) {
    this.push(
      table([
        [
          {
            w: CONTENT_W,
            shade: tone === "quiet" ? C.wash : C.green,
            xml:
              p(this.t(label), {
                size: 8,
                bold: true,
                caps: true,
                color: tone === "quiet" ? C.green : C.white,
                font: SANS,
                tracking: 0.04,
                after: note ? 0 : 40,
              }) +
              (note
                ? p(this.t(note), {
                    size: 7.5,
                    color: tone === "quiet" ? C.muted : C.white,
                    space: 0,
                  })
                : ""),
          },
        ],
      ]),
    );
    this.push(p("", { size: 2, space: 0, after: 40 }));
  };

  Doc.prototype.note = function (text) {
    if (!text) return;
    this.push(p(this.t(text), { size: 8.5, color: C.body }));
  };

  /** The chapter tables — the shape the quote, the order and the invoice share. */
  Doc.prototype.groups = function () {
    const d = this.doc;
    const groups = d.groups || [];
    const W = [
      Math.round(CONTENT_W * 0.44),
      Math.round(CONTENT_W * 0.12),
      Math.round(CONTENT_W * 0.14),
      Math.round(CONTENT_W * 0.14),
      Math.round(CONTENT_W * 0.16),
    ];
    for (const g of groups) {
      if (g.chapter)
        this.push(
          p(this.t(g.chapter), {
            font: SERIF,
            size: 10,
            bold: true,
            color: C.green,
            rule: true,
            after: 20,
          }),
        );
      const head = [
        { w: W[0], text: this.t("Descripción"), size: 6.5, bold: true, color: C.muted, caps: true },
        {
          w: W[1],
          text: this.t("Ud."),
          size: 6.5,
          bold: true,
          color: C.muted,
          caps: true,
          align: "right",
        },
        {
          w: W[2],
          text: this.t("Cantidad"),
          size: 6.5,
          bold: true,
          color: C.muted,
          caps: true,
          align: "right",
        },
        {
          w: W[3],
          text: this.t("Precio"),
          size: 6.5,
          bold: true,
          color: C.muted,
          caps: true,
          align: "right",
        },
        {
          w: W[4],
          text: this.t("Importe"),
          size: 6.5,
          bold: true,
          color: C.muted,
          caps: true,
          align: "right",
        },
      ];
      const rows = [head];
      for (const r of g.rows || []) {
        rows.push([
          {
            w: W[0],
            xml:
              p((r.code ? r.code + "  " : "") + (r.item || ""), {
                size: 9,
                color: C.ink,
                after: r.note ? 0 : 40,
              }) + (r.note ? p(r.note, { size: 7.5, color: C.muted, space: 0 }) : ""),
          },
          { w: W[1], text: r.unit || "", size: 8.5, color: C.body, align: "right" },
          { w: W[2], text: r.qtyLabel || "", size: 8.5, color: C.body, align: "right" },
          { w: W[3], text: r.priceLabel || "", size: 8.5, color: C.body, align: "right" },
          { w: W[4], text: r.amount || "", size: 9, bold: true, color: C.ink, align: "right" },
        ]);
      }
      if (g.subtotal)
        rows.push([
          {
            w: W[0] + W[1] + W[2] + W[3],
            span: 4,
            text: this.t("Subtotal"),
            size: 8,
            bold: true,
            color: C.muted,
            align: "right",
            top: true,
          },
          {
            w: W[4],
            text: g.subtotal,
            size: 9,
            bold: true,
            color: C.ink,
            align: "right",
            top: true,
          },
        ]);
      this.push(table(rows));
      this.push(p("", { size: 2, after: 60 }));
    }
  };

  /** A document with no chapters — the plain list. */
  Doc.prototype.plainLines = function () {
    const lines = this.doc.lines || [];
    if (!lines.length) return;
    const W = [Math.round(CONTENT_W * 0.7), Math.round(CONTENT_W * 0.3)];
    this.push(
      table(
        lines.map((l) => [
          {
            w: W[0],
            xml:
              // `desc` is the field the descriptors actually use for a plain
              // line; item/label are the table idiom. Reading only the latter
              // printed every change order, visit report and work sheet with
              // its amounts intact and its descriptions blank.
              p(l.desc || l.item || l.label || "", {
                size: 9,
                color: C.ink,
                after: l.note ? 0 : 40,
              }) + (l.note ? p(l.note, { size: 7.5, color: C.muted, space: 0 }) : ""),
          },
          { w: W[1], text: l.amount || "", size: 9, bold: true, color: C.ink, align: "right" },
        ]),
      ),
    );
    this.push(p("", { size: 2, after: 60 }));
  };

  Doc.prototype.totals = function () {
    const totals = this.doc.totals || [];
    if (!totals.length) return;
    const labelW = Math.round(CONTENT_W * 0.62);
    const boxW = CONTENT_W - labelW;
    const rows = totals.map((t, i) => {
      const last = i === totals.length - 1;
      return [
        { w: labelW, text: "", size: 6 },
        {
          w: boxW,
          shade: last ? C.wash : undefined,
          top: last,
          topColor: C.green,
          topSize: 12,
          xml: table(
            [
              [
                {
                  w: Math.round(boxW * 0.55),
                  text: this.t(t[0]),
                  size: last ? 10.5 : 8.5,
                  font: last ? SERIF : SANS,
                  bold: last,
                  color: last ? C.ink : C.body,
                },
                {
                  w: Math.round(boxW * 0.45),
                  text: t[1],
                  size: last ? 12 : 9,
                  font: last ? SERIF : SANS,
                  bold: true,
                  color: C.ink,
                  align: "right",
                },
              ],
            ],
            { width: boxW },
          ),
        },
      ];
    });
    this.push(table(rows));
    this.push(p("", { size: 2, after: 80 }));
  };

  /* ------------------------------------------------------ block primitives
     The same five shapes erp-pdf.js grew for the documents a table cannot
     express. Each one keeps the numbers; only the drawing changes. */

  Doc.prototype.progressBars = function (rows, opts) {
    if (!rows || !rows.length) return;
    const labelW = Math.round(CONTENT_W * 0.44);
    const barW = Math.round(CONTENT_W * 0.36);
    const valW = CONTENT_W - labelW - barW;
    const out = [
      [
        {
          w: labelW,
          text: this.t((opts && opts.label) || "Concepto"),
          size: 6.5,
          bold: true,
          color: C.muted,
          caps: true,
        },
        { w: barW, text: "", size: 6 },
        {
          w: valW,
          text: this.t("Avance"),
          size: 6.5,
          bold: true,
          color: C.muted,
          caps: true,
          align: "right",
        },
      ],
    ];
    for (const r of rows) {
      const pct = Math.max(0, Math.min(100, Number(r.pct) || 0));
      const filled = Math.max(1, Math.round((barW * pct) / 100));
      out.push([
        {
          w: labelW,
          xml:
            p(this.t(r.label), { size: 9, color: C.body, after: r.note ? 0 : 40 }) +
            (r.note ? p(this.t(r.note), { size: 7.5, color: C.muted, space: 0 }) : ""),
        },
        {
          w: barW,
          // The bar, as a two-cell table whose filled part is exactly the
          // percentage wide. A picture of the number, drawn the only way a
          // reflowing format can draw one.
          xml: table(
            [
              [
                { w: filled, shade: C.green, text: "", size: 6 },
                { w: Math.max(1, barW - filled), shade: C.wash, text: "", size: 6 },
              ],
            ],
            { width: barW },
          ),
        },
        {
          w: valW,
          text: r.amount || pct.toFixed(0) + " %",
          size: 9,
          bold: true,
          color: C.ink,
          align: "right",
        },
      ]);
    }
    this.push(table(out));
    this.push(p("", { size: 2, after: 60 }));
  };

  Doc.prototype.milestones = function (rows) {
    if (!rows || !rows.length) return;
    const W = [
      Math.round(CONTENT_W * 0.16),
      Math.round(CONTENT_W * 0.5),
      Math.round(CONTENT_W * 0.34),
    ];
    const out = [
      [
        { w: W[0], text: this.t("Fecha"), size: 6.5, bold: true, color: C.muted, caps: true },
        { w: W[1], text: this.t("Concepto"), size: 6.5, bold: true, color: C.muted, caps: true },
        {
          w: W[2],
          text: this.t("Importe"),
          size: 6.5,
          bold: true,
          color: C.muted,
          caps: true,
          align: "right",
        },
      ],
    ];
    for (const r of rows) {
      out.push([
        { w: W[0], text: r.when || r.date || "", size: 8.5, color: C.body },
        {
          w: W[1],
          xml:
            p(this.t(r.label), { size: 9, color: C.ink, after: r.note ? 0 : 40 }) +
            (r.note ? p(this.t(r.note), { size: 7.5, color: C.muted, space: 0 }) : ""),
        },
        {
          w: W[2],
          xml:
            p(r.amount || "", {
              size: 9,
              bold: true,
              color: C.ink,
              align: "right",
              after: r.state ? 0 : 40,
            }) +
            (r.state
              ? p(this.t(r.state), { size: 7.5, color: C.muted, align: "right", space: 0 })
              : ""),
        },
      ]);
    }
    this.push(table(out));
    this.push(p("", { size: 2, after: 60 }));
  };

  Doc.prototype.checklist = function (rows) {
    if (!rows || !rows.length) return;
    const W = [
      Math.round(CONTENT_W * 0.08),
      Math.round(CONTENT_W * 0.62),
      CONTENT_W - Math.round(CONTENT_W * 0.7),
    ];
    const out = [];
    for (const r of rows) {
      out.push([
        {
          w: W[0],
          // A box, not a tick: the PDF draws an empty square for anything not
          // done, and a document that arrives pre-ticked is a different claim.
          text: r.state === "done" || r.state === true ? "☑" : "☐",
          size: 11,
          color: r.state === "done" || r.state === true ? C.green : C.muted,
        },
        {
          w: W[1],
          xml:
            p(this.t(r.label), { size: 9, color: C.ink, after: r.note ? 0 : 40 }) +
            (r.note ? p(this.t(r.note), { size: 7.5, color: C.muted, space: 0 }) : ""),
        },
        { w: W[2], text: this.t(r.by || ""), size: 8, color: C.muted, align: "right" },
      ]);
    }
    this.push(table(out));
    this.push(p("", { size: 2, after: 60 }));
  };

  Doc.prototype.kvGrid = function (rows, cols) {
    if (!rows || !rows.length) return;
    const n = Math.max(1, Math.min(cols || 2, 3));
    const w = evenly(n);
    const out = [];
    for (let i = 0; i < rows.length; i += n) {
      out.push(
        rows
          .slice(i, i + n)
          .map((r) => labelValue(this.t(r[0] || r.label), this.t(r[1] || r.value), w, { size: 9 })),
      );
    }
    this.push(table(out));
    this.push(p("", { size: 2, after: 60 }));
  };

  Doc.prototype.marginTable = function (rows) {
    if (!rows || !rows.length) return;
    const W = [
      Math.round(CONTENT_W * 0.34),
      Math.round(CONTENT_W * 0.165),
      Math.round(CONTENT_W * 0.165),
      Math.round(CONTENT_W * 0.165),
      Math.round(CONTENT_W * 0.165),
    ];
    const out = [
      [
        { w: W[0], text: this.t("Concepto"), size: 6.5, bold: true, color: C.muted, caps: true },
        {
          w: W[1],
          text: this.t("Presupuestado"),
          size: 6.5,
          bold: true,
          color: C.muted,
          caps: true,
          align: "right",
        },
        {
          w: W[2],
          text: this.t("Real"),
          size: 6.5,
          bold: true,
          color: C.muted,
          caps: true,
          align: "right",
        },
        {
          w: W[3],
          text: this.t("Desviación"),
          size: 6.5,
          bold: true,
          color: C.muted,
          caps: true,
          align: "right",
        },
        {
          w: W[4],
          text: this.t("Margen"),
          size: 6.5,
          bold: true,
          color: C.muted,
          caps: true,
          align: "right",
        },
      ],
    ];
    for (const r of rows) {
      out.push([
        {
          w: W[0],
          text: this.t(r.label),
          size: 9,
          color: r.total ? C.ink : C.body,
          bold: !!r.total,
        },
        {
          w: W[1],
          text: r.budget || "",
          size: 8.5,
          color: C.body,
          align: "right",
          bold: !!r.total,
        },
        {
          w: W[2],
          text: r.actual || "",
          size: 8.5,
          color: C.body,
          align: "right",
          bold: !!r.total,
        },
        {
          w: W[3],
          text: r.variance || "",
          size: 8.5,
          color: r.over ? "8F2D1B" : C.body,
          align: "right",
          bold: !!r.total,
        },
        { w: W[4], text: r.margin || "", size: 8.5, color: C.ink, align: "right", bold: !!r.total },
      ]);
    }
    this.push(table(out));
    this.push(p("", { size: 2, after: 60 }));
  };

  /** Terms and notes. */
  Doc.prototype.blocks = function () {
    const d = this.doc;
    const items = []
      .concat(d.payment && d.payment.length ? [["Condiciones de pago", d.payment]] : [])
      .concat(d.notes && d.notes.length ? [["Notas", d.notes]] : []);
    for (const [label, rows] of items) {
      this.push(
        table([
          [
            {
              w: CONTENT_W,
              shade: C.white,
              top: true,
              xml:
                p(this.t(label), {
                  size: 6.5,
                  bold: true,
                  caps: true,
                  color: C.green,
                  tracking: 0.04,
                  after: 20,
                }) +
                rows
                  .map((r) => p("— " + this.t(r), { size: 8, color: C.body, space: 0, after: 20 }))
                  .join(""),
            },
          ],
        ]),
      );
      this.push(p("", { size: 2, after: 60 }));
    }
  };

  Doc.prototype.signatures = function () {
    const sigs = this.doc.signatures;
    if (!sigs || !sigs.length) return;
    const w = evenly(sigs.length);
    this.push(p("", { size: 8, after: 200 }));
    this.push(
      table([
        sigs.map((s) => ({
          w,
          xml:
            p("", { size: 8, rule: true, after: 40 }) +
            p(this.t(typeof s === "string" ? s : s.label || ""), {
              size: 8,
              color: C.body,
              space: 0,
              after: 0,
            }) +
            (typeof s === "object" && s.name
              ? p(s.name, { size: 8.5, bold: true, color: C.ink, space: 0 })
              : ""),
        })),
      ]),
    );
  };

  /**
   * The graphic annex. Each plate becomes a real image part; a plate whose
   * bytes never arrived is skipped rather than drawn as an empty frame,
   * which is the same choice the PDF writer makes.
   */
  Doc.prototype.annex = function () {
    const a = this.doc.annex;
    if (!a || !a.pages || !a.pages.length) return;
    const perRow = Math.min(Math.max(1, a.perPage || 2), 2);
    for (const pg of a.pages) {
      this.pageBreak();
      this.push(
        p(
          `${this.t(a.label || "Anexo gráfico")} — ${this.t(a.pageWord || "página")} ${pg.number} ${this.t(a.ofWord || "de")} ${a.pages.length}`,
          { size: 9, bold: true, color: C.green, caps: true, rule: true, after: 60 },
        ),
      );
      const plates = (pg.plates || []).filter((x) => x && x.jpeg);
      const w = Math.floor(CONTENT_W / perRow) - 60;
      for (let i = 0; i < plates.length; i += perRow) {
        this.push(
          table([
            plates.slice(i, i + perRow).map((plate) => {
              const id = this.media.length + 1;
              this.media.push({ name: "image" + id + ".jpeg", bytes: plate.jpeg });
              // EMU: 914400 per inch, 635 per twip. The frame keeps the
              // photograph's own proportions where they are known.
              const cx = w * 635;
              const ratio = plate.ratio || 2 / 3;
              const cy = Math.round(cx * (1 / Math.max(0.2, ratio)));
              return {
                w: Math.floor(CONTENT_W / perRow),
                xml:
                  drawing(id, cx, Math.min(cy, 3600000)) +
                  p(this.t(plate.caption || plate.label || ""), {
                    size: 7.5,
                    color: C.muted,
                    space: 0,
                  }),
              };
            }),
          ]),
        );
      }
    }
  };

  /** One inline image, in the shape Word insists on. */
  function drawing(id, cx, cy) {
    const rid = "rId" + (100 + id);
    return (
      '<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
      `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/>` +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      `<pic:nvPicPr><pic:cNvPr id="${id}" name="Picture ${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>"
    );
  }

  /* ------------------------------------------------------------ the parts */

  const CONTENT_TYPES = (media) =>
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    (media.length ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : "") +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    "</Types>";

  const ROOT_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  const docRels = (media) =>
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    media
      .map(
        (m, i) =>
          `<Relationship Id="rId${101 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`,
      )
      .join("") +
    "</Relationships>";

  const STYLES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    "<w:docDefaults><w:rPrDefault><w:rPr>" +
    `<w:rFonts w:ascii="${SANS}" w:hAnsi="${SANS}"/><w:sz w:val="18"/><w:color w:val="${C.body}"/>` +
    "</w:rPr></w:rPrDefault></w:docDefaults>" +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
    "</w:styles>";

  /**
   * The document, as .docx bytes.
   *
   * Same signature as `CaneiPdf.build(doc, brand, tr)` on purpose: the caller
   * that can print one can print the other by changing the word.
   */
  function build(doc, brand, tr) {
    const d = new Doc(doc, brand, tr);
    d.header();
    d.title();
    d.parties();
    if (doc && doc.intro) d.note(doc.intro);

    if (doc && doc.sections && doc.sections.length) {
      for (const s of doc.sections) {
        switch (s.type) {
          case "band":
            d.band(s.label, s.note, s.tone);
            break;
          case "note":
            d.note(s.text);
            break;
          case "table":
            if (s.label) d.band(s.label, s.note);
            d.groups();
            break;
          case "lines":
            d.plainLines();
            break;
          case "totals":
            d.totals();
            break;
          case "progressBars":
            d.progressBars(s.rows, s);
            break;
          case "milestones":
            d.milestones(s.rows);
            break;
          case "checklist":
            d.checklist(s.rows);
            break;
          case "kvGrid":
            d.kvGrid(s.rows, s.cols);
            break;
          case "marginTable":
            d.marginTable(s.rows);
            break;
          default:
            // Loud, exactly as the PDF writer is: a section nobody rendered is
            // a section missing from the customer's copy, and silence there is
            // how the two formats would drift apart without anyone noticing.
            throw new Error("erp-docx: unknown section type " + JSON.stringify(s.type));
        }
      }
    } else if (doc && doc.groups && doc.groups.length) {
      d.band(doc.tableLabel || "Detalle por partidas", doc.tableNote || "");
      d.groups();
      d.totals();
    } else {
      d.plainLines();
      d.totals();
    }

    d.blocks();
    d.signatures();
    d.annex();

    const body =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
      "<w:body>" +
      d.out.join("") +
      `<w:sectPr><w:pgSz w:w="${PAGE_W}" w:h="16838"/>` +
      `<w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="0" w:footer="0" w:gutter="0"/>` +
      "</w:sectPr></w:body></w:document>";

    const files = [
      { path: "[Content_Types].xml", bytes: CONTENT_TYPES(d.media) },
      { path: "_rels/.rels", bytes: ROOT_RELS },
      { path: "word/document.xml", bytes: body },
      { path: "word/styles.xml", bytes: STYLES },
      { path: "word/_rels/document.xml.rels", bytes: docRels(d.media) },
    ];
    for (const m of d.media) files.push({ path: "word/media/" + m.name, bytes: m.bytes });
    return Zip.zip(files);
  }

  return { build, PALETTE: C, SERIF, SANS };
});

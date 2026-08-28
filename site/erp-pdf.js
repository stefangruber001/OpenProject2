/* Canei Subirats — the document PDF writer.
 *
 * WHAT CHANGED AND WHY IT IS A REWRITE RATHER THAN A RESTYLE.
 *
 * The previous writer emitted one page. Literally: its page tree said
 * `Kids[3 0 R] /Count 1`, so a quote with more chapters than fit simply ran off
 * the bottom and the rest was gone. Nobody had noticed because the sample data
 * fitted. That alone required a new layout engine, not new colours.
 *
 * On top of that it had one font family (Helvetica, regular and bold) and
 * measured text as `length * size * 0.5`, which is wrong for every character
 * that is not exactly half an em — so right-aligned money columns were only
 * approximately right-aligned. In a table of figures that is the thing the eye
 * checks first.
 *
 * So this file is: a paginating layout engine, real font metrics for the four
 * base-14 faces it uses, and the approved design expressed in drawing
 * primitives. It stays the SINGLE SOURCE OF TRUTH for produced documents — the
 * HTML set under site/documentos/ is the design reference the layout follows,
 * not a second generator.
 *
 * NO EMBEDDED FONTS, DELIBERATELY. Roboto Serif and Inter would each need a
 * subsetted TrueType embedded with a CID mapping, and a bug there produces a
 * file that opens blank in some readers and fine in others — the worst failure
 * mode available for an invoice. The base-14 faces are present in every PDF
 * reader ever written: Times for the serif voice the design uses for figures
 * and titles, Helvetica for the sans. The proportions and colour are the
 * brand's; the exact typeface is not, and that is the honest trade.
 *
 * Text is WinAnsi (Latin-1), which covers Spanish and Catalan — accents, ñ,
 * ç, ·, ¿¡ — and the Euro sign at 0x80. Callers pass a `tr` that does the
 * mapping.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./erp-pictograms.js"));
  else root.CaneiPdf = factory(root.ErpPictograms);
})(typeof globalThis !== "undefined" ? globalThis : this, function (PICT) {
  "use strict";

  /* ---------------------------------------------------------------- metrics
   * Base-14 advance widths for codes 32..126, in 1/1000 em. Anything outside
   * that range (accented Latin-1) is charged the width of "n", which is within
   * a few thousandths for these faces and keeps wrapping honest. */
  const W = {
    H: "278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584",
    HB: "278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584",
    T: "250 333 408 500 500 833 778 180 333 333 500 564 250 333 250 278 500 500 500 500 500 500 500 500 500 500 278 278 564 564 564 444 921 722 667 667 722 611 556 722 722 333 389 722 611 889 722 722 556 722 667 556 611 722 722 944 722 722 611 333 278 333 469 500 333 444 500 444 500 444 333 500 500 278 278 500 278 778 500 500 500 500 333 389 278 500 500 722 500 500 444 480 200 480 541",
    TB: "250 333 555 500 500 1000 833 278 333 333 500 570 250 333 250 278 500 500 500 500 500 500 500 500 500 500 333 333 570 570 570 500 930 722 667 722 722 667 611 778 778 389 500 778 667 944 722 778 611 778 722 556 667 722 722 1000 722 722 667 333 278 333 581 500 333 500 556 444 556 444 333 500 556 278 333 556 278 833 556 500 556 500 444 389 333 556 500 722 500 500 444 394 220 394 520",
  };
  const TABLE = {};
  for (const k of Object.keys(W)) TABLE[k] = W[k].split(" ").map(Number);
  /** Font ids as written into the page resources. */
  const FONT = { sans: "H", sansB: "HB", serif: "T", serifB: "TB" };

  function widthOf(text, font, size) {
    const t = TABLE[font] || TABLE.H;
    let w = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      w += c >= 32 && c <= 126 ? t[c - 32] : t[110 - 32];
    }
    return (w * size) / 1000;
  }

  /* ------------------------------------------------------------- geometry */
  const MM = 72 / 25.4;
  const PAGE = { w: 595.28, h: 841.89 };
  const M = { top: 13 * MM, side: 13 * MM, bottom: 16 * MM };
  const CONTENT_W = PAGE.w - 2 * M.side;
  const X0 = M.side;
  const X1 = PAGE.w - M.side;

  /* --------------------------------------------------------------- colour */
  const rgb = (hex) => {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(" ");
  };
  const C = {
    green: rgb("#48733c"),
    deep: rgb("#31532a"),
    spark: rgb("#f2c230"),
    ink: rgb("#14160f"),
    body: rgb("#4f5347"),
    muted: rgb("#8b8f80"),
    line: rgb("#dde5d6"),
    wash: rgb("#f4f7f1"),
    blue: rgb("#e8eef7"),
    grey: rgb("#eeeeea"),
    white: "1 1 1",
  };
  /** The audience band colour — the design's own device. */
  const BAND = { cliente: C.blue, cobro: rgb("#fbf0cf"), proveedor: C.grey, interno: C.grey };

  /* ============================================================ the engine */
  /* The standard fonts speak WinAnsi, and a JS string does not: an em-dash
     is U+2014 where the PDF wants 0x97, and one untranslated code point past
     255 corrupts the stream (and breaks btoa for anyone attaching the file).
     The label layer writes real typography — «—», «…», a true minus — so the
     writer maps it rather than asking every caller to avoid it. Anything
     WinAnsi genuinely cannot say degrades to its nearest honest ASCII. */
  const WINANSI = {
    "\u2014": "\x97",
    "\u2013": "\x96",
    "\u2018": "\x91",
    "\u2019": "\x92",
    "\u201c": "\x93",
    "\u201d": "\x94",
    "\u2026": "\x85",
    "\u20ac": "\x80",
    "\u2212": "-",
    "\u00a0": " ",
  };
  function winAnsi(s) {
    let out = "";
    for (const ch of String(s)) out += ch.charCodeAt(0) > 255 ? WINANSI[ch] || "?" : ch;
    return out;
  }

  function Doc(opts) {
    this.o = opts;
    // Every string the writer touches goes through the caller's tr and then
    // through the WinAnsi map — one seam, so no code path can skip it.
    const rawTr = opts.tr || String;
    this.o = Object.assign({}, opts, { tr: (s) => winAnsi(rawTr(s)) });
    this.pages = [];
    this.c = "";
    this.y = 0;
    this.pageNo = 0;
    this.newPage(true);
  }

  Doc.prototype.esc = function (s) {
    return this.o.tr(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  };

  Doc.prototype.text = function (x, y, size, font, colour, s, opts) {
    const str = this.o.tr(s);
    if (!str) return 0;
    const ls = (opts && opts.tracking) || 0;
    // Tracking is written as a PDF character-spacing operator rather than by
    // moving each glyph, so a text extractor still sees one word. Capped for
    // the same reason the HTML templates cap it: wide spacing makes extractors
    // insert spaces, and "FAC T U R A" is not searchable.
    const tc = Math.min(ls, 0.04) * size;
    this.c += `${colour} rg BT /${font} ${size} Tf ${tc ? tc.toFixed(2) + " Tc " : ""}${x.toFixed(2)} ${y.toFixed(2)} Td (${this.esc(s)}) Tj ET\n`;
    if (tc) this.c += "BT 0 Tc ET\n";
    return widthOf(str, font, size) + tc * Math.max(0, str.length - 1);
  };

  Doc.prototype.textRight = function (xr, y, size, font, colour, s, opts) {
    const w = widthOf(this.o.tr(s), font, size);
    return this.text(xr - w, y, size, font, colour, s, opts);
  };

  Doc.prototype.textCentre = function (xc, y, size, font, colour, s) {
    const w = widthOf(this.o.tr(s), font, size);
    return this.text(xc - w / 2, y, size, font, colour, s);
  };

  Doc.prototype.rect = function (x, y, w, h, colour) {
    this.c += `${colour} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;
  };

  Doc.prototype.rule = function (x, y, w, colour, thickness) {
    this.rect(x, y, w, thickness || 0.6, colour);
  };

  /** Wrap to a pixel width rather than a character count — the old writer
   *  counted characters, which overflows on wide words and wastes space on
   *  narrow ones. */
  Doc.prototype.wrap = function (s, font, size, maxW) {
    const words = this.o.tr(s).split(/\s+/).filter(Boolean);
    const out = [];
    let cur = "";
    for (const w of words) {
      const probe = cur ? cur + " " + w : w;
      if (widthOf(probe, font, size) > maxW && cur) {
        out.push(cur);
        cur = w;
      } else cur = probe;
    }
    if (cur) out.push(cur);
    return out.length ? out : [""];
  };

  Doc.prototype.newPage = function (first) {
    if (!first) this.pages.push(this.c);
    this.c = "";
    this.pageNo++;
    this.y = PAGE.h - M.top;
    if (this.pageNo > 1) this.runningHeader();
  };

  /** Room for `h` points, or start a new page. */
  Doc.prototype.need = function (h) {
    if (this.y - h < M.bottom + 26) {
      this.newPage();
      return true;
    }
    return false;
  };

  /** A slim identification strip on continuation pages, so a loose sheet is
   *  still attributable to a document and a company. */
  Doc.prototype.runningHeader = function () {
    const d = this.o.doc;
    this.text(X0, this.y - 8, 8, FONT.sansB, C.green, d.docType.toUpperCase(), { tracking: 0.04 });
    this.textRight(X1, this.y - 8, 8.5, FONT.serifB, C.ink, d.number);
    this.y -= 14;
    this.rule(X0, this.y, CONTENT_W, C.line);
    this.y -= 16;
  };

  /* =========================================================== the design */

  /** The house mark: a simple line-drawn house, the same silhouette the brand
   *  uses. Vector rather than an image so it stays crisp at any size and adds
   *  no bytes worth counting. */
  Doc.prototype.mark = function (x, y, s) {
    const g = C.green;
    this.c += `${g} RG ${(s * 0.09).toFixed(2)} w\n`;
    // body of the house
    this.c += `${(x + s * 0.1).toFixed(2)} ${(y + s * 0.06).toFixed(2)} ${(s * 0.8).toFixed(2)} ${(s * 0.55).toFixed(2)} re S\n`;
    // roof
    this.c += `${(x + s * 0.02).toFixed(2)} ${(y + s * 0.6).toFixed(2)} m ${(x + s * 0.5).toFixed(2)} ${(y + s * 0.95).toFixed(2)} l ${(x + s * 0.98).toFixed(2)} ${(y + s * 0.6).toFixed(2)} l S\n`;
  };

  Doc.prototype.header = function () {
    const d = this.o.doc,
      b = this.o.brand;
    const top = this.y;

    this.mark(X0, top - 26, 26);
    this.text(X0 + 34, top - 12, 15, FONT.serif, C.ink, b.wordmark || "CaneiSubirats");
    this.text(X0 + 34, top - 22, 7.5, FONT.serif, C.green, b.slogan);

    this.textRight(X1, top - 8, 8, FONT.sansB, C.green, d.docType.toUpperCase(), {
      tracking: 0.04,
    });
    this.textRight(X1, top - 26, 17, FONT.serifB, C.ink, d.number);

    this.y = top - 42;
    this.rule(X0, this.y, CONTENT_W, C.line);
    this.y -= 4;

    // The meta strip: label above value, evenly divided.
    const cells = d.meta || [];
    if (cells.length) {
      const cw = CONTENT_W / cells.length;
      cells.forEach((cell, i) => {
        const cx = X0 + i * cw;
        if (i) this.rule(cx - 6, this.y - 26, 0.6, C.line, 24);
        this.text(cx, this.y - 10, 6.5, FONT.sansB, C.muted, cell[0].toUpperCase(), {
          tracking: 0.04,
        });
        this.text(cx, this.y - 22, 9, FONT.serifB, C.ink, cell[1]);
      });
      this.y -= 32;
      this.rule(X0, this.y, CONTENT_W, C.line);
      this.y -= 14;
    }
  };

  /** The title, and under it the figures the reader is looking for. */
  Doc.prototype.title = function () {
    const d = this.o.doc;
    this.need(70);
    for (const line of this.wrap(d.title, FONT.serifB, 17, CONTENT_W)) {
      this.text(X0, this.y - 15, 17, FONT.serifB, C.ink, line);
      this.y -= 21;
    }
    if (d.subtitle) {
      this.text(X0, this.y - 9, 9, FONT.sans, C.body, d.subtitle);
      this.y -= 15;
    }
    this.y -= 4;

    const facts = d.facts || [];
    if (facts.length) {
      this.need(46);
      const cw = CONTENT_W / facts.length;
      facts.forEach((f, i) => {
        const cx = X0 + i * cw;
        if (i) this.rule(cx - 8, this.y - 30, 0.6, C.line, 28);
        this.text(cx, this.y - 9, 6.5, FONT.sansB, C.muted, f[0].toUpperCase(), { tracking: 0.04 });
        const hero = i === 0;
        let vx = cx;
        if (hero) {
          // The small gold mark beside the headline figure — the brand's own
          // way of pointing at the number that matters.
          this.rect(cx, this.y - 26, 4.5, 9, C.spark);
          vx = cx + 8;
        }
        this.text(vx, this.y - 26, hero ? 14 : 11.5, FONT.serifB, C.ink, f[1]);
      });
      this.y -= 38;
    }
  };

  /** EMISOR / CLIENTE side by side. */
  Doc.prototype.parties = function () {
    const d = this.o.doc;
    if (!d.parties || !d.parties.length) return;
    const cw = (CONTENT_W - 14) / 2;
    const lines = d.parties.map((p) => {
      const rows = [];
      for (const l of p.lines.filter(Boolean)) rows.push(...this.wrap(l, FONT.sans, 8, cw - 16));
      return rows;
    });
    const h = 30 + Math.max(...lines.map((l) => l.length)) * 10;
    this.need(h + 8);
    d.parties.forEach((p, i) => {
      const x = X0 + i * (cw + 14);
      this.rect(x, this.y - h, cw, h, C.wash);
      this.text(x + 8, this.y - 13, 6.5, FONT.sansB, C.muted, p.label.toUpperCase(), {
        tracking: 0.04,
      });
      this.text(x + 8, this.y - 25, 10, FONT.serifB, C.ink, p.name);
      lines[i].forEach((l, j) => this.text(x + 8, this.y - 36 - j * 10, 8, FONT.sans, C.body, l));
    });
    this.y -= h + 12;
  };

  /** A coloured band with a label — the audience device from the design. */
  Doc.prototype.band = function (label, note, tone) {
    this.need(24);
    const colour = BAND[tone || this.o.doc.audience || "cliente"] || C.blue;
    this.rect(X0, this.y - 15, CONTENT_W, 15, colour);
    this.text(X0 + 7, this.y - 11, 7.5, FONT.sansB, C.ink, label.toUpperCase(), { tracking: 0.04 });
    if (note) this.textRight(X1 - 7, this.y - 11, 7, FONT.sans, C.body, note);
    this.y -= 21;
  };

  Doc.prototype.note = function (text) {
    const lines = this.wrap(text, FONT.sans, 8.5, CONTENT_W - 20);
    const h = lines.length * 11 + 12;
    this.need(h + 6);
    this.rect(X0, this.y - h, CONTENT_W, h, C.wash);
    this.rect(X0, this.y - h, 2.2, h, C.green);
    lines.forEach((l, i) => this.text(X0 + 10, this.y - 14 - i * 11, 8.5, FONT.sans, C.body, l));
    this.y -= h + 10;
  };

  /* ------------------------------------------------------------ the table */
  /* The line drawing's gutter, ahead of the description.
     A fixed indent rather than a column: the mark hangs in the margin of the
     description the way a bullet does, so a partida that wraps to three lines
     still reads as one item under one picture. `descW` loses the same amount,
     which is what keeps the wrap honest — text measured against a width it is
     not given is how a table runs into the column beside it. */
  /* Wide enough for the CODE, not just the plate. At 18pt the plate fitted and
     "DEM-101" under it did not — the code ran under the description's second
     line, which is the one place on the page a reader is following a sentence.
     The gutter is sized to the longest thing in it, which is the text. */
  const PICT_W = 26;
  const COLS = () => {
    const qty = X1 - 250,
      unit = X1 - 205,
      price = X1 - 120,
      amt = X1;
    return {
      desc: X0 + PICT_W,
      descW: qty - X0 - 55 - PICT_W,
      mark: X0,
      qty,
      unit,
      price,
      amt,
    };
  };

  Doc.prototype.tableHead = function () {
    const c = COLS();
    this.text(c.desc, this.y - 8, 6.5, FONT.sansB, C.muted, "DESCRIPCION", { tracking: 0.04 });
    this.textRight(c.qty, this.y - 8, 6.5, FONT.sansB, C.muted, "MEDICION", { tracking: 0.04 });
    this.text(c.unit - 22, this.y - 8, 6.5, FONT.sansB, C.muted, "UD.", { tracking: 0.04 });
    this.textRight(c.price, this.y - 8, 6.5, FONT.sansB, C.muted, "PRECIO", { tracking: 0.04 });
    this.textRight(c.amt, this.y - 8, 6.5, FONT.sansB, C.muted, "IMPORTE", { tracking: 0.04 });
    this.y -= 13;
    this.rule(X0, this.y, CONTENT_W, C.line, 1.2);
    this.y -= 6;
  };

  Doc.prototype.groups = function () {
    const d = this.o.doc;
    if (!d.groups || !d.groups.length) return;
    const c = COLS();
    this.tableHead();

    for (const g of d.groups) {
      // A chapter heading must never be the last thing on a page.
      if (this.need(40)) this.tableHead();
      this.text(X0, this.y - 9, 9.5, FONT.serifB, C.green, g.chapter);
      this.y -= 14;
      this.rule(X0, this.y + 2, CONTENT_W, C.green, 0.8);
      this.y -= 4;

      for (const r of g.rows) {
        const desc = this.wrap(r.item, FONT.sans, 9, c.descW);
        const extra = r.note ? this.wrap(r.note, FONT.sans, 7.5, c.descW) : [];
        const h = desc.length * 11 + extra.length * 9 + 7;
        if (this.need(h)) this.tableHead();
        /* The line's drawing, in the gutter beside the first line of the
           description. DERIVED HERE from the item's own words unless the caller
           named one, so every producer of `groups` — the presupuestador, the
           doctype descriptors, anything added later — gets the same picture for
           the same partida without being changed, and none of them can hand the
           writer a mark that disagrees with the catalogue's. */
        /* The line's plate: the drawing on a wash of its trade's colour, with
           the code beside the description below. Colour groups the trade and
           the code names the partida — six hues cannot identify twenty
           chapters and are not asked to. */
        if (PICT) {
          var pkey = PICT.pick({
            pictogram: r.pictogram,
            desc: r.item,
            chapter: r.chapter,
            chapterName: g.chapter,
          });
          this.c += PICT.pdfPlate(pkey, r.chapter || "", c.mark, this.y - 18, 12);
        }
        desc.forEach((l, i) => this.text(c.desc, this.y - 9 - i * 11, 9, FONT.sans, C.body, l));
        // The code under the plate, small and quiet: it is what makes the
        // picture checkable rather than decorative.
        if (r.code) this.text(c.mark, this.y - 24.5, 5, FONT.sansB, C.muted, String(r.code));
        extra.forEach((l, i) =>
          this.text(c.desc, this.y - 9 - desc.length * 11 - i * 9, 7.5, FONT.sans, C.muted, l),
        );
        this.textRight(c.qty, this.y - 9, 9, FONT.sans, C.body, r.qtyLabel);
        this.text(c.unit - 22, this.y - 9, 9, FONT.sans, C.body, r.unit || "");
        this.textRight(c.price, this.y - 9, 9, FONT.sans, C.body, r.priceLabel);
        this.textRight(c.amt, this.y - 9, 9, FONT.sansB, C.ink, r.amount);
        this.y -= h;
        this.rule(X0, this.y + 3, CONTENT_W, rgb("#f0f4ec"));
      }

      if (this.need(20)) this.tableHead();
      this.rect(X0, this.y - 14, CONTENT_W, 14, C.wash);
      this.textRight(c.price, this.y - 10, 8, FONT.sans, C.muted, "Subtotal " + g.chapter);
      this.textRight(c.amt, this.y - 10, 9, FONT.sansB, C.ink, g.subtotal);
      this.y -= 22;
    }
  };

  Doc.prototype.plainLines = function () {
    const d = this.o.doc;
    if (!d.lines || !d.lines.length) return;
    this.text(X0, this.y - 8, 6.5, FONT.sansB, C.muted, "CONCEPTO", { tracking: 0.04 });
    this.textRight(X1, this.y - 8, 6.5, FONT.sansB, C.muted, "IMPORTE", { tracking: 0.04 });
    this.y -= 13;
    this.rule(X0, this.y, CONTENT_W, C.line, 1.2);
    this.y -= 6;
    for (const li of d.lines) {
      const w = this.wrap(li.desc, FONT.sans, 9.5, CONTENT_W - 130);
      const h = w.length * 12 + 8;
      this.need(h);
      w.forEach((l, i) => this.text(X0, this.y - 10 - i * 12, 9.5, FONT.sans, C.body, l));
      this.textRight(X1, this.y - 10, 9.5, FONT.sansB, C.ink, li.amount);
      this.y -= h;
      this.rule(X0, this.y + 3, CONTENT_W, rgb("#f0f4ec"));
    }
    this.y -= 6;
  };

  Doc.prototype.totals = function () {
    const d = this.o.doc;
    if (!d.totals || !d.totals.length) return;
    const boxW = 210;
    const x = X1 - boxW;
    const h = d.totals.length * 16 + 10;
    this.need(h + 10);
    d.totals.forEach((t, i) => {
      const last = i === d.totals.length - 1;
      const yy = this.y - 12 - i * 16;
      if (last) {
        this.rule(x, yy + 12, boxW, C.deep, 1.4);
        this.rect(x, yy - 6, boxW, 18, C.wash);
      }
      this.text(
        x + 6,
        yy - (last ? 1 : 0),
        last ? 10.5 : 8.5,
        last ? FONT.serifB : FONT.sans,
        last ? C.ink : C.body,
        t[0],
      );
      this.textRight(
        X1 - 6,
        yy - (last ? 1 : 0),
        last ? 12 : 9,
        last ? FONT.serifB : FONT.sansB,
        C.ink,
        t[1],
      );
    });
    this.y -= h + 8;
  };

  /** Terms and legal notes, in two columns when they fit. */
  Doc.prototype.blocks = function () {
    const d = this.o.doc;
    const items = []
      .concat(d.payment && d.payment.length ? [["Condiciones de pago", d.payment]] : [])
      .concat(d.notes && d.notes.length ? [["Notas", d.notes]] : []);
    for (const [label, rows] of items) {
      const wrapped = [];
      for (const r of rows) wrapped.push(...this.wrap("- " + r, FONT.sans, 8, CONTENT_W - 20));
      const h = wrapped.length * 10.5 + 24;
      this.need(h + 6);
      this.rect(X0, this.y - h, CONTENT_W, h, C.white);
      this.rule(X0, this.y - h, CONTENT_W, C.line);
      this.rule(X0, this.y, CONTENT_W, C.line);
      this.text(X0 + 8, this.y - 13, 6.5, FONT.sansB, C.green, label.toUpperCase(), {
        tracking: 0.04,
      });
      wrapped.forEach((l, i) => this.text(X0 + 8, this.y - 25 - i * 10.5, 8, FONT.sans, C.body, l));
      this.y -= h + 10;
    }
  };

  /* ------------------------------------------------------ block primitives
   *
   * The thirteen documents the quote and the invoice do not cover need shapes
   * the table cannot express: a percentage per chapter, a payment schedule, a
   * punch list, a field/value sheet, a budget-versus-actual comparison.
   *
   * Every one of them calls `need()` before drawing a row and redraws its own
   * heading after a break. That is not decoration. The writer this replaced
   * emitted `Count 1` and discarded everything past the first page in silence,
   * and a block that measures its height once and then draws N rows reproduces
   * exactly that failure one document at a time. */

  /** Percentage per line — progress valuation, physical completion. */
  Doc.prototype.progressBars = function (rows, opts) {
    if (!rows || !rows.length) return;
    const labelW = 190;
    const barX = X0 + labelW + 8;
    const barW = X1 - barX - 62;
    const head = () => {
      this.text(X0, this.y - 8, 6.5, FONT.sansB, C.muted, (opts && opts.label) || "CONCEPTO", {
        tracking: 0.04,
      });
      this.textRight(X1, this.y - 8, 6.5, FONT.sansB, C.muted, "AVANCE", { tracking: 0.04 });
      this.y -= 13;
      this.rule(X0, this.y, CONTENT_W, C.line, 1.2);
      this.y -= 6;
    };
    head();
    for (const r of rows) {
      const lines = this.wrap(r.label, FONT.sans, 9, labelW);
      const h = Math.max(lines.length * 11, 11) + 10;
      if (this.need(h)) head();
      lines.forEach((l, i) => this.text(X0, this.y - 9 - i * 11, 9, FONT.sans, C.body, l));
      const pct = Math.max(0, Math.min(100, Number(r.pct) || 0));
      this.rect(barX, this.y - 11, barW, 7, C.wash);
      if (pct > 0) this.rect(barX, this.y - 11, (barW * pct) / 100, 7, C.green);
      this.textRight(X1, this.y - 9, 9, FONT.sansB, C.ink, r.amount || pct.toFixed(0) + " %");
      if (r.note) {
        this.text(barX, this.y - 11 - lines.length * 11 + 2, 7.5, FONT.sans, C.muted, r.note);
      }
      this.y -= h;
      this.rule(X0, this.y + 3, CONTENT_W, rgb("#f0f4ec"));
    }
    this.y -= 8;
  };

  /** A dated schedule — contract payment milestones, planned visits. */
  Doc.prototype.milestones = function (rows) {
    if (!rows || !rows.length) return;
    const whenX = X0,
      labelX = X0 + 86,
      stateX = X1 - 190;
    const head = () => {
      this.text(whenX, this.y - 8, 6.5, FONT.sansB, C.muted, "FECHA", { tracking: 0.04 });
      this.text(labelX, this.y - 8, 6.5, FONT.sansB, C.muted, "HITO", { tracking: 0.04 });
      this.text(stateX, this.y - 8, 6.5, FONT.sansB, C.muted, "ESTADO", { tracking: 0.04 });
      this.textRight(X1, this.y - 8, 6.5, FONT.sansB, C.muted, "IMPORTE", { tracking: 0.04 });
      this.y -= 13;
      this.rule(X0, this.y, CONTENT_W, C.line, 1.2);
      this.y -= 6;
    };
    head();
    for (const r of rows) {
      const lines = this.wrap(r.label, FONT.sans, 9, stateX - labelX - 12);
      const h = lines.length * 11 + 8;
      if (this.need(h)) head();
      this.text(whenX, this.y - 9, 9, FONT.sans, C.body, r.when || "-");
      lines.forEach((l, i) => this.text(labelX, this.y - 9 - i * 11, 9, FONT.sans, C.body, l));
      this.text(stateX, this.y - 9, 8, FONT.sans, C.muted, r.state || "");
      this.textRight(X1, this.y - 9, 9, FONT.sansB, C.ink, r.amount || "");
      this.y -= h;
      this.rule(X0, this.y + 3, CONTENT_W, rgb("#f0f4ec"));
    }
    this.y -= 8;
  };

  /**
   * A punch list. The mark is drawn, not typed: a tick and a cross as glyphs
   * are outside WinAnsi, so they would arrive as a substituted character or as
   * nothing at all on the customer's reader.
   */
  Doc.prototype.checklist = function (rows) {
    if (!rows || !rows.length) return;
    const boxX = X0 + 2,
      textX = X0 + 18;
    for (const r of rows) {
      const lines = this.wrap(r.label, FONT.sans, 9, X1 - textX - 120);
      const note = r.note ? this.wrap(r.note, FONT.sans, 7.5, X1 - textX - 120) : [];
      const h = lines.length * 11 + note.length * 9 + 8;
      this.need(h);
      const top = this.y - 11;
      this.rect(boxX, top, 9, 9, r.state === "ok" ? C.green : C.wash);
      if (r.state !== "ok") {
        this.c += `${C.line} RG 0.6 w ${boxX.toFixed(2)} ${top.toFixed(2)} 9 9 re S\n`;
      }
      if (r.state === "fail") this.rect(boxX + 2.5, top + 3.5, 4, 2, rgb("#8f2d1b"));
      lines.forEach((l, i) => this.text(textX, this.y - 9 - i * 11, 9, FONT.sans, C.body, l));
      note.forEach((l, i) =>
        this.text(textX, this.y - 9 - lines.length * 11 - i * 9, 7.5, FONT.sans, C.muted, l),
      );
      if (r.by) this.textRight(X1, this.y - 9, 8, FONT.sans, C.muted, r.by);
      this.y -= h;
    }
    this.y -= 6;
  };

  /** Field/value pairs in columns — receipts, project sheets, summaries. */
  Doc.prototype.kvGrid = function (rows, cols) {
    if (!rows || !rows.length) return;
    const n = cols || 3;
    const cw = CONTENT_W / n;
    for (let i = 0; i < rows.length; i += n) {
      const slice = rows.slice(i, i + n);
      const wrapped = slice.map((r) => this.wrap(String(r[1]), FONT.serifB, 9.5, cw - 12));
      const h = 14 + Math.max(...wrapped.map((w) => w.length)) * 12;
      // Measured per ROW OF CELLS, not once for the whole grid: a value that
      // wraps to three lines makes its row taller than the rest, and a single
      // height for all of them is how a long address ends up drawn over the
      // block underneath.
      this.need(h + 4);
      slice.forEach((r, j) => {
        const x = X0 + j * cw;
        this.text(x, this.y - 8, 6.5, FONT.sansB, C.muted, String(r[0]).toUpperCase(), {
          tracking: 0.04,
        });
        wrapped[j].forEach((l, k) =>
          this.text(x, this.y - 21 - k * 12, 9.5, FONT.serifB, C.ink, l),
        );
      });
      this.y -= h;
      this.rule(X0, this.y + 4, CONTENT_W, rgb("#f0f4ec"));
      this.y -= 4;
    }
    this.y -= 6;
  };

  /** Budget against actual, with the variance called out. */
  Doc.prototype.marginTable = function (rows) {
    if (!rows || !rows.length) return;
    const budgetX = X1 - 300,
      actualX = X1 - 190,
      varX = X1 - 80,
      pctX = X1;
    const head = () => {
      this.text(X0, this.y - 8, 6.5, FONT.sansB, C.muted, "PARTIDA", { tracking: 0.04 });
      this.textRight(budgetX, this.y - 8, 6.5, FONT.sansB, C.muted, "PREVISTO", { tracking: 0.04 });
      this.textRight(actualX, this.y - 8, 6.5, FONT.sansB, C.muted, "REAL", { tracking: 0.04 });
      this.textRight(varX, this.y - 8, 6.5, FONT.sansB, C.muted, "DESVIACION", { tracking: 0.04 });
      this.textRight(pctX, this.y - 8, 6.5, FONT.sansB, C.muted, "MARGEN", { tracking: 0.04 });
      this.y -= 13;
      this.rule(X0, this.y, CONTENT_W, C.line, 1.2);
      this.y -= 6;
    };
    head();
    for (const r of rows) {
      const lines = this.wrap(r.label, FONT.sans, 9, budgetX - X0 - 60);
      const h = lines.length * 11 + 8;
      if (this.need(h)) head();
      const over = r.over === true;
      lines.forEach((l, i) =>
        this.text(X0, this.y - 9 - i * 11, 9, FONT[r.total ? "sansB" : "sans"], C.body, l),
      );
      this.textRight(budgetX, this.y - 9, 9, FONT.sans, C.body, r.budget || "");
      this.textRight(actualX, this.y - 9, 9, FONT.sans, C.body, r.actual || "");
      // Over budget is stated in words as well as colour. A reader who prints
      // in greyscale, or cannot distinguish the two, still gets the fact.
      this.textRight(
        varX,
        this.y - 9,
        9,
        FONT.sansB,
        over ? rgb("#8f2d1b") : C.ink,
        (over ? "+" : "") + (r.variance || ""),
      );
      this.textRight(
        pctX,
        this.y - 9,
        9,
        FONT.sansB,
        over ? rgb("#8f2d1b") : C.green,
        r.margin || "",
      );
      this.y -= h;
      this.rule(X0, this.y + 3, CONTENT_W, over ? rgb("#f2dcd6") : rgb("#f0f4ec"));
    }
    this.y -= 8;
  };

  Doc.prototype.signatures = function () {
    const d = this.o.doc;
    if (!d.signatures || !d.signatures.length) return;
    this.need(58);
    const cw = (CONTENT_W - 24) / d.signatures.length;
    this.y -= 26;
    d.signatures.forEach((s, i) => {
      const x = X0 + i * (cw + 24);
      this.rule(x, this.y, cw, C.ink, 0.8);
      this.text(x, this.y - 11, 7.5, FONT.sans, C.muted, s);
    });
    this.y -= 22;
  };

  /** Drawn onto every page after layout, so it can carry "page n of m". */
  Doc.prototype.footerFor = function (n, total) {
    const b = this.o.brand;
    let s = `${C.green} rg ${X0.toFixed(2)} ${(M.bottom + 22).toFixed(2)} ${CONTENT_W.toFixed(2)} 1 re f\n`;
    const put = (x, y, size, font, colour, txt) => {
      const t = this.o.tr(txt);
      s += `${colour} rg BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")}) Tj ET\n`;
    };
    put(X0, M.bottom + 12, 6.5, FONT.sans, C.muted, `${b.legal} - ${b.cif} - ${b.address}`);
    put(
      X0,
      M.bottom + 3,
      6.5,
      FONT.sans,
      C.muted,
      `${b.phone} - ${b.from}${b.iban ? " - " + b.iban : ""}`,
    );
    const label = `${n} / ${total}`;
    const w = widthOf(this.o.tr(label), FONT.sansB, 7);
    put(X1 - w, M.bottom + 12, 7, FONT.sansB, C.green, label);
    return s;
  };

  /* -------------------------------------------------------------- assemble */
  Doc.prototype.finish = function () {
    this.pages.push(this.c);
    const total = this.pages.length;
    const streams = this.pages.map((p, i) => p + this.footerFor(i + 1, total));

    const fonts = [
      ["H", "Helvetica"],
      ["HB", "Helvetica-Bold"],
      ["T", "Times-Roman"],
      ["TB", "Times-Bold"],
    ];
    const objs = [];
    const push = (s) => objs.push(s) && objs.length;

    push("<</Type/Catalog/Pages 2 0 R>>");
    push("PAGES_PLACEHOLDER");
    const fontIds = fonts.map(([, base]) =>
      push(`<</Type/Font/Subtype/Type1/BaseFont/${base}/Encoding/WinAnsiEncoding>>`),
    );
    const res = "<</Font<<" + fonts.map(([id], i) => `/${id} ${fontIds[i]} 0 R`).join("") + ">>>>";

    const pageIds = [];
    for (const st of streams) {
      const contentId = push(`<</Length ${st.length}>>\nstream\n${st}\nendstream`);
      pageIds.push(
        push(
          `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PAGE.w} ${PAGE.h}]/Resources${res}/Contents ${contentId} 0 R>>`,
        ),
      );
    }
    objs[1] = `<</Type/Pages/Kids[${pageIds.map((i) => i + " 0 R").join(" ")}]/Count ${pageIds.length}>>`;

    let pdf = "%PDF-1.4\n";
    const off = [];
    objs.forEach((o, i) => {
      off.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    off.forEach((o) => (pdf += String(o).padStart(10, "0") + " 00000 n \n"));
    pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
    return pdf;
  };

  /**
   * Build one document.
   *
   * `doc` is the same shape the previous writer took, plus the fields the new
   * design needs: `meta`, `facts`, `parties`, `audience`, `signatures`. Callers
   * that pass only the old fields still get a valid document — the new blocks
   * are skipped when absent, so nothing breaks while callers are updated.
   */
  /**
   * The body, when a document declares one.
   *
   * `doc.sections` is an ordered list of `{ type, … }`. It exists because the
   * twenty documents do not share one body: a delivery note has a conformity
   * list where an invoice has a totals block, and a project sheet has both a
   * field sheet and a variance table. Encoding that as a fixed sequence with
   * flags produced a build() nobody could read; encoding it as data means a new
   * document type is a descriptor and not an edit here.
   *
   * An unknown type is a hard error rather than a skip. A silently ignored
   * section is a page of the document that goes missing without saying so,
   * which is the exact failure this writer was rewritten to end.
   */
  const SECTION = {
    band: (d, s) => d.band(s.label, s.note, s.tone),
    note: (d, s) => d.note(s.text),
    table: (d, s) => {
      if (s.label) d.band(s.label, s.note);
      d.groups();
    },
    lines: (d) => d.plainLines(),
    totals: (d) => d.totals(),
    progressBars: (d, s) => d.progressBars(s.rows, s),
    milestones: (d, s) => d.milestones(s.rows),
    checklist: (d, s) => d.checklist(s.rows),
    kvGrid: (d, s) => d.kvGrid(s.rows, s.cols),
    marginTable: (d, s) => d.marginTable(s.rows),
  };

  function build(doc, brand, tr) {
    const d = new Doc({ doc, brand, tr: tr || String });
    d.header();
    d.title();
    d.parties();
    if (doc.intro) d.note(doc.intro);

    if (doc.sections && doc.sections.length) {
      for (const s of doc.sections) {
        const fn = SECTION[s.type];
        if (!fn) throw new Error("erp-pdf: unknown section type " + JSON.stringify(s.type));
        fn(d, s);
      }
    } else if (doc.groups && doc.groups.length) {
      d.band(doc.tableLabel || "Detalle por partidas", doc.tableNote || "");
      d.groups();
      d.totals();
    } else {
      d.plainLines();
      d.totals();
    }

    d.blocks();
    d.signatures();
    return d.finish();
  }

  return { build, widthOf, PAGE, MM, SECTION_TYPES: Object.keys(SECTION) };
});

/* =============================================================================
   Bank statement import — the PDF sibling of erp-import.js.

   Same bank, same account, a different export shape: the .xlsx is a
   spreadsheet with a real BENEFICIARIO column; the PDF is a printed
   "Extracto integral" with no such column — CONCEPTO carries whatever the
   beneficiary/observations text is, and amounts and balances are printed
   with their own " EUR" suffix rather than living in a typed numeric cell.
   See erp-import.js's own header for why a changed layout is a parser SWAP,
   not surgery on the reconciliation screen — this file is that swap for the
   other shape, not a replacement for it.

   A PDF text layer is not a table: pdf.js hands back one item per
   text-showing operator, each with its own (x, y) baseline, in whatever
   order the page draws them — usually left to right, top to bottom, but that
   is a convention, not a guarantee. So reading proceeds in two passes:

     1. GROUP items into visual lines by y (a tolerance, not an equality,
        because two runs on what is visually one baseline rarely share the
        exact same float), then sort each line's items by x and join them.
     2. GROUP lines into ROWS: a line beginning with a date starts a new
        movement; every line after it, up to the next date-line, is a
        continuation of that movement's concept — the one signal available
        for "this line still belongs to the row above", since a wrapped
        concept's continuation carries no date and no amount of its own.

   Money and dates reuse erp-import.js's own toCents/toIsoDate — the same
   number is still the same number, spreadsheet or printed page — after
   stripping the literal "EUR" the PDF format appends and toCents does not
   expect (it strips the €symbol and spaces, not the three letters).
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./erp-import.js"));
  else root.ErpImportPdf = factory(root.ErpImport);
})(typeof globalThis !== "undefined" ? globalThis : this, function (ErpImport) {
  "use strict";

  const { toCents, toIsoDate } = ErpImport;

  const DATE_RE = /^(\d{1,2}\/\d{1,2}\/\d{4})\b/;
  // "-8,41 EUR" and "9.961,33 EUR" — the amount/balance shape this export
  // uses. Matched globally against the WHOLE row text because the balance
  // can land on a continuation line when the concept itself is short enough
  // to leave no room for it beside the amount.
  const MONEY_RE = /-?\d{1,3}(?:\.\d{3})*,\d{2}\s*EUR\b/gi;

  /** Every text-showing item on every page, grouped into visual lines, ONE ARRAY PER PAGE. */
  async function pdfLines(arrayBuffer, pdfjs) {
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const rows = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const x = it.transform[4];
        const y = it.transform[5];
        // 2pt tolerance: two runs on the same printed baseline can differ by
        // sub-pixel float noise without being two different lines.
        let row = rows.find((r) => Math.abs(r.y - y) < 2);
        if (!row) {
          row = { y, items: [] };
          rows.push(row);
        }
        row.items.push({ x, str: it.str });
      }
      rows.sort((a, b) => b.y - a.y);
      const lines = [];
      for (const r of rows) {
        r.items.sort((a, b) => a.x - b.x);
        const text = r.items
          .map((i) => i.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) lines.push(text);
      }
      pages.push(lines);
    }
    return pages;
  }

  /**
   * Pages of lines → row groups: each group starts at a date-line, per the
   * header comment above. Grouping resets at every PAGE boundary, not just
   * at the very first line of the file — a multi-page statement reprints its
   * column headers on every page, and without the reset the second page's
   * "F. OPERACION F. VALOR CONCEPTO …" row silently became part of the
   * concept of whichever movement happened to fall last on the page before
   * it. A row's own wrap is never split across a page break (nor is a real
   * statement's), so nothing is lost by never carrying a group over.
   */
  function groupLines(pages) {
    const groups = [];
    for (const lines of pages) {
      let open = null;
      for (const line of lines) {
        if (DATE_RE.test(line)) {
          open = [line];
          groups.push(open);
        } else if (open) open.push(line);
        // Preamble on THIS page (title, repeated column headers, account
        // metadata) before its own first date-line — ignored, exactly as
        // erp-import.js's findHeader skips the .xlsx preamble by NAME
        // rather than by position.
      }
    }
    return groups;
  }

  /** One row group → a row in the shape importMovements/previewImport expect, or null. */
  function parseRowGroup(lines) {
    const first = lines[0];
    const dm = first.match(DATE_RE);
    if (!dm) return null;
    let rest = first.slice(dm[0].length).trim();
    // F. Valor prints right after F. Operación on the row's first line when
    // the export carries it; not every BBVA PDF shape does.
    const dm2 = rest.match(DATE_RE);
    const valueDateRaw = dm2 ? dm2[0] : null;

    const whole = lines.join(" ");
    const money = [...whole.matchAll(MONEY_RE)];
    if (!money.length) return null;
    const strip = (tok) => tok.replace(/EUR/i, "").trim();

    let concept = whole.replace(dm[0], "");
    if (valueDateRaw) concept = concept.replace(valueDateRaw, "");
    for (const m of money) concept = concept.replace(m[0], "");
    concept = concept.replace(/\s+/g, " ").trim();

    const accountingDate = toIsoDate(dm[0]);
    const amountCents = toCents(strip(money[0][0]));
    if (!accountingDate || amountCents == null) return null;

    return {
      accountingDate,
      valueDate: (valueDateRaw && toIsoDate(valueDateRaw)) || accountingDate,
      concept,
      // No separate counterparty column on this export shape — see the file
      // header. Everything the bank printed about who this was lives in
      // `concept`, which is where movWho/queue search already look first.
      counterparty: "",
      merchantText: "",
      observations: "",
      opCode: "",
      reference: "",
      amountCents,
      balanceCents: money[1] ? toCents(strip(money[1][0])) : null,
      currency: "EUR",
    };
  }

  /**
   * The file, as rows `importMovements` accepts. `pdfjs` is the loaded
   * pdfjs-dist module — the caller's to load, so this function runs
   * identically from a browser (`ErpOcr.loadPdfjs()`) and from a plain-Node
   * test (`import("pdfjs-dist/legacy/build/pdf.mjs")`), same as pdfText in
   * erp-ocr.js is loaded lazily by its own caller.
   * Returns `{rows, skipped}`; throws only when no date-led row is found at
   * all — a row that starts right but fails to parse is counted in
   * `skipped`, never silently dropped.
   */
  async function parseBbvaPdf(arrayBuffer, pdfjs) {
    const lines = await pdfLines(arrayBuffer, pdfjs);
    const groups = groupLines(lines);
    if (!groups.length)
      throw new Error(
        "No he encontrado ningún movimiento con fecha en el PDF. ¿Es un extracto de BBVA?",
      );
    const rows = [];
    let skipped = 0;
    for (const g of groups) {
      const row = parseRowGroup(g);
      if (!row) {
        skipped++;
        continue;
      }
      rows.push(row);
    }
    // Chronological, whatever order the export printed — same reasoning as
    // erp-import.js's parseBbva: BBVA prints newest first, and the running
    // balance only tells its story read the other way.
    if (rows.length > 1 && rows[0].accountingDate > rows[rows.length - 1].accountingDate)
      rows.reverse();
    return { rows, skipped };
  }

  return { parseBbvaPdf, pdfLines, groupLines, parseRowGroup };
});

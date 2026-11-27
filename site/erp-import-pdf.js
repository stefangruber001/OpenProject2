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
  /* ONE OR TWO DECIMALS, not two. BBVA trims a trailing zero in this export —
     it prints «-427,5 EUR» for 427,50 and «2.311,1 EUR» for 2.311,10 — and a
     pattern that insisted on two digits simply did not see those amounts.

     The failure was silent and it moved money. With the amount unmatched, the
     first money token on the row became the running BALANCE, so the row was
     imported with the balance as its amount (and usually with the sign
     flipped, a charge arriving as a credit); the balance then came out null,
     which ALSO disabled `statementOf` — one null balance anywhere turns off
     the opening+movements=closing check for the whole statement. So the very
     guard that exists to catch a bad import was switched off by the same bug
     that caused it.

     Measured on a real statement of 74 rows: 10 amounts wrong, 13 balances
     missing, and a net of +41.134,51 against the true +381,26. */
  const MONEY_RE = /-?\d{1,3}(?:\.\d{3})*,\d{1,2}\s*EUR\b/gi;

  /** Every text-showing item on every page, grouped into visual lines, ONE ARRAY PER PAGE. */
  /**
   * Every page as visual lines, each KEEPING its items and their x.
   *
   * The account statement only ever needed the joined text of a line. The card
   * listing needs the positions: its four columns are told apart by WHERE each
   * cell sits under its header, because a merchant can be called «COMPRA FACIL»
   * and joined text cannot say where the concept ends and the movement type
   * begins. So the PDF is read once into positioned items, and `pdfLines` is
   * the text projection of that — the same output it always had.
   */
  async function pdfItemLines(arrayBuffer, pdfjs) {
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
      for (const r of rows) r.items.sort((a, b) => a.x - b.x);
      pages.push(rows);
    }
    return pages;
  }
  function textOf(line) {
    return line.items
      .map((i) => i.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function linesOf(itemPages) {
    return itemPages.map((rows) => rows.map(textOf).filter(Boolean));
  }
  async function pdfLines(arrayBuffer, pdfjs) {
    return linesOf(await pdfItemLines(arrayBuffer, pdfjs));
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
  /* ===================== THE CARD LISTING ===================================
     BBVA's other PDF: «Listado de movimientos de tarjeta», what a business
     credit card exports. Not the account statement with a different header —
     a different document:

       · dates are ISO (2026-11-23), not dd/mm/yyyy, so the statement reader
         found no movement at all and refused the file outright;
       · there is NO running balance, so the statement's own arithmetic
         (opening + movements = closing) has nothing to work on;
       · there is a TYPE column — Compra, Reembolso, «Sin categoría» — that
         joined text cannot separate from the merchant's name.

     What it does print is an «Importe total» in its header, and that is the
     guard this format gets instead of the balance: the rows read must add up
     to it to the cent, or NOTHING is imported. A reader that silently drops a
     line hands the reconciliation a card that paid less than it did.

     Columns are found by the x of their header cells — repeated on every page
     at the same place — and each cell of a row goes to the column it sits
     under. And one line is not a purchase: «RECIBO MES ANTERIOR» is the card
     being PAID OFF from the current account, the other leg of the transfer
     `markCardSettlement` records on the bank side. It is flagged, so the
     screen can file it as an internal transfer instead of leaving the
     gestoría an unexplained income four times a quarter. */
  const CARD_TITLE = /listado de movimientos de tarjeta/i;
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const CARD_HEAD = {
    date: "FECHA DE OPERACION",
    concept: "CONCEPTO",
    kind: "TIPO DE MOVIMIENTO",
    amount: "IMPORTE",
  };
  const CARD_REPAYMENT = "RECIBO MES ANTERIOR";
  function foldU(s) {
    return String(s == null ? "" : s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }
  function eurCents(s) {
    return toCents(String(s || "").replace(/\s*EUR\s*$/i, ""));
  }
  function eurTxt(c) {
    return (c / 100).toFixed(2).replace(".", ",");
  }
  function parseCardListing(itemPages) {
    const meta = {};
    const LABELS = [
      ["number", "Nº de tarjeta"],
      ["holder", "Titular de la tarjeta"],
      ["period", "Periodo"],
      ["total", "Importe total"],
    ];
    let cols = null;
    let last = null;
    const rows = [];
    let skipped = 0;
    for (const lines of itemPages)
      for (const line of lines) {
        const items = line.items;
        const f = items.map((it) => foldU(it.str));
        for (const [key, lab] of LABELS) {
          if (meta[key] != null) continue;
          const at = f.indexOf(foldU(lab));
          if (at >= 0 && items[at + 1]) meta[key] = items[at + 1].str.trim();
        }
        if (f.includes(CARD_HEAD.date) && f.includes(CARD_HEAD.amount)) {
          cols = {};
          for (const [key, head] of Object.entries(CARD_HEAD)) {
            const it = items.find((x) => foldU(x.str) === head);
            if (it) cols[key] = it.x;
          }
          last = null;
          continue;
        }
        if (!cols || !items.length) continue;
        const order = Object.entries(cols).sort((a, b) => a[1] - b[1]);
        const columnOf = (x) => {
          let k = order[0][0];
          for (const [name, cx] of order) if (x >= cx - 3) k = name;
          return k;
        };
        if (!ISO_DATE.test(items[0].str.trim())) {
          /* A concept too long for its cell wraps onto a line of its own,
             with text only under CONCEPTO. Anything else without a date — a
             page number, the next page's header block — is not part of a
             movement. */
          if (last && items.every((it) => columnOf(it.x) === "concept")) {
            last.concept = (last.concept + " " + textOf(line)).trim();
            last.merchantText = last.concept;
          }
          continue;
        }
        const cell = { date: [], concept: [], kind: [], amount: [] };
        for (const it of items) cell[columnOf(it.x)].push(it.str.trim());
        const amountCents = eurCents(cell.amount.join(" "));
        if (amountCents == null) {
          skipped++;
          last = null;
          continue;
        }
        const date = cell.date[0];
        const concept = cell.concept.join(" ").replace(/\s+/g, " ").trim();
        const row = {
          accountingDate: date,
          valueDate: date,
          concept,
          // The merchant, where BNK-05's merchant rules look — so a line from
          // «PLATAFORMA CONSTR.-SANT J» can propose its supplier by itself.
          merchantText: concept,
          opCode: cell.kind.join(" ").trim(),
          amountCents,
          balanceCents: null,
          card: meta.number ? "…" + String(meta.number).replace(/\D/g, "").slice(-4) : "tarjeta",
        };
        if (foldU(concept) === CARD_REPAYMENT) row.cardRepayment = true;
        rows.push(row);
        last = row;
      }
    if (!rows.length)
      throw new Error(
        "El PDF es un listado de tarjeta, pero no he encontrado ningún movimiento en él.",
      );
    const sum = rows.reduce((a, r) => a + r.amountCents, 0);
    const printed = meta.total != null ? eurCents(meta.total) : null;
    if (printed != null && printed !== sum)
      throw new Error(
        "El listado dice que sus movimientos suman " +
          eurTxt(printed) +
          " € y los que he leído suman " +
          eurTxt(sum) +
          " €. No se importa nada: falta o sobra algún movimiento en la lectura.",
      );
    /* By date, oldest first, STABLY. The export is mostly newest-first but
       prints still-pending movements in a block of their own at the top, in
       the other order; with no balance whose story a reversal must keep, a
       sort is the honest reading. */
    const ordered = rows
      .map((r, i) => ({ r, i }))
      .sort((a, b) =>
        a.r.accountingDate < b.r.accountingDate
          ? -1
          : a.r.accountingDate > b.r.accountingDate
            ? 1
            : a.i - b.i,
      )
      .map((x) => x.r);
    const last4 = meta.number ? String(meta.number).replace(/\D/g, "").slice(-4) : "";
    return {
      rows: ordered,
      skipped,
      layout: "card",
      card: {
        number: meta.number || "",
        last4,
        holder: meta.holder || "",
        period: meta.period || "",
        totalCents: printed,
        verified: printed != null,
      },
      repayments: rows.filter((r) => r.cardRepayment).length,
    };
  }

  async function parseBbvaPdf(arrayBuffer, pdfjs) {
    /* ONE read. pdf.js may hand the buffer to its worker and leave this side
       of it detached, so a second `getDocument` on the same bytes is not a
       thing to rely on — the layout is decided from what was already read. */
    const itemPages = await pdfItemLines(arrayBuffer, pdfjs);
    const lines = linesOf(itemPages);
    if (lines.some((page) => page.some((l) => CARD_TITLE.test(l))))
      return parseCardListing(itemPages);
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

  return { parseBbvaPdf, pdfLines, pdfItemLines, groupLines, parseRowGroup, parseCardListing };
});

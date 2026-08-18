/* =============================================================================
   Bank statement import — the file parser, and nothing else.

   `previewImport` and `importMovements` have been ready in the engine since
   §5.3 was built, and no file has ever reached them: there was no parser and
   no screen. This module is the parser. It is deliberately its OWN file so the
   day the layout changes — a second bank, or BBVA moving a column — the
   replacement is a parser swap, not surgery on the reconciliation screen.

   THE LAYOUT IS FIXED, AND THAT IS A RECORDED TRADE-OFF. This reads the
   export BBVA produces today: a preamble of title rows, then a header row
   naming the columns in Spanish, then one row per movement. It finds the
   header by its NAMES (fecha / concepto / importe), not by its position, so a
   longer or shorter preamble does not matter — but renamed columns would. The
   reversible upgrade is a column-mapping step per account; see ASSUMPTIONS.md.

   An .xlsx is a ZIP of XML. The ZIP is read from its central directory (the
   one place sizes and offsets are always true, even for writers that stream
   with data descriptors), entries are inflated with DecompressionStream —
   present in every browser this product supports and in Node 18+, which is
   how the same file runs under tests/bank-import — and the two XML parts that
   matter are read with string scanning, not a DOM: sharedStrings.xml for the
   text table and the first worksheet for the cells. No dependency, the same
   spirit as the hand-rolled zipStore that writes our exports.

   Numbers are handled as STRINGS end to end. "1.234,56" (Spanish text) and
   "1234.56" (a numeric cell) both become 123456 integer cents by splitting on
   the separator, never by multiplying a float — this engine keeps money in
   integer cents and a parser that drifts by a cent per line is a statement
   that does not reconcile. Dates arrive as DD/MM/YYYY text or as an Excel
   serial; both become ISO.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ErpImport = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------- ZIP ---------- */

  function u16(b, o) {
    return b[o] | (b[o + 1] << 8);
  }
  function u32(b, o) {
    return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  }

  /** The central directory: name → {offset, method, csize} for every entry. */
  function centralDirectory(bytes) {
    // EOCD signature PK\x05\x06, within the last 64KB + 22 bytes.
    const min = Math.max(0, bytes.length - 65558);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= min; i--) {
      if (
        bytes[i] === 0x50 &&
        bytes[i + 1] === 0x4b &&
        bytes[i + 2] === 0x05 &&
        bytes[i + 3] === 0x06
      ) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("Not a ZIP file (no end-of-central-directory)");
    const count = u16(bytes, eocd + 10);
    let p = u32(bytes, eocd + 16);
    const entries = {};
    for (let n = 0; n < count; n++) {
      if (u32(bytes, p) !== 0x02014b50) break;
      const method = u16(bytes, p + 10);
      const csize = u32(bytes, p + 20);
      const nameLen = u16(bytes, p + 28);
      const extraLen = u16(bytes, p + 30);
      const commentLen = u16(bytes, p + 32);
      const offset = u32(bytes, p + 42);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
      entries[name] = { method, csize, offset };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  /** One entry's bytes, inflated if the writer deflated them. */
  async function readEntry(bytes, entry) {
    // The local header repeats the name/extra with its OWN lengths, which may
    // differ from the central ones — so the data offset is computed here, not
    // assumed from the central record.
    const p = entry.offset;
    if (u32(bytes, p) !== 0x04034b50) throw new Error("Corrupt ZIP entry");
    const nameLen = u16(bytes, p + 26);
    const extraLen = u16(bytes, p + 28);
    const data = bytes.subarray(
      p + 30 + nameLen + extraLen,
      p + 30 + nameLen + extraLen + entry.csize,
    );
    if (entry.method === 0) return data;
    if (entry.method !== 8) throw new Error("Unsupported ZIP compression method: " + entry.method);
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([data]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  /* ---------- XML, by scanning ---------- */

  function unescapeXml(s) {
    return s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&amp;/g, "&");
  }

  /** sharedStrings.xml → array of strings. A <si> may hold several <t> runs. */
  function sharedStrings(xml) {
    const out = [];
    const si = xml.match(/<si[\s>][\s\S]*?<\/si>/g) || [];
    for (const one of si) {
      let text = "";
      const ts = one.match(/<t[^>]*>[\s\S]*?<\/t>|<t[^>]*\/>/g) || [];
      for (const t of ts) {
        const m = t.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        if (m) text += unescapeXml(m[1]);
      }
      out.push(text);
    }
    return out;
  }

  function colIndex(ref) {
    let n = 0;
    for (const ch of ref) {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90) n = n * 26 + (c - 64);
      else break;
    }
    return n - 1;
  }

  /** One worksheet → rows of raw cell strings (shared strings resolved). */
  function sheetRows(xml, strings) {
    const rows = [];
    const rowXml = xml.match(/<row[\s>][\s\S]*?<\/row>/g) || [];
    for (const r of rowXml) {
      const cells = [];
      const cellXml = r.match(/<c [^>]*\/>|<c [^>]*>[\s\S]*?<\/c>/g) || [];
      for (const c of cellXml) {
        const ref = (c.match(/r="([A-Z]+)\d+"/) || [])[1];
        const t = (c.match(/t="([^"]+)"/) || [])[1] || "";
        let val = "";
        if (t === "inlineStr") {
          const m = c.match(/<t[^>]*>([\s\S]*?)<\/t>/);
          val = m ? unescapeXml(m[1]) : "";
        } else {
          const m = c.match(/<v>([\s\S]*?)<\/v>/);
          if (m) {
            val = unescapeXml(m[1]);
            if (t === "s") val = strings[Number(val)] ?? "";
            else if (!t || t === "n") {
              /* A numeric cell keeps its NUMBER, because the type is the only
                 thing that tells «1.234» the thousand from «1.234» the one
                 point two three four: a sheet writes numbers in canonical
                 form with a dot, a Spanish text cell writes them with a
                 comma and groups thousands with the dot. Reading both as
                 text made one of them wrong, and which one depended on the
                 bank. */
              const n = Number(val);
              if (val !== "" && Number.isFinite(n)) val = n;
            }
          }
        }
        const idx = ref != null ? colIndex(ref) : cells.length;
        cells[idx] = val;
      }
      rows.push(cells);
    }
    return rows;
  }

  /** The whole file → the first worksheet's rows of strings. */
  async function parseXlsxRows(arrayBuffer) {
    const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
    const entries = centralDirectory(bytes);
    const sheetName =
      entries["xl/worksheets/sheet1.xml"] != null
        ? "xl/worksheets/sheet1.xml"
        : Object.keys(entries)
            .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
            .sort()[0];
    if (!sheetName) throw new Error("The file has no worksheet — is it really an .xlsx?");
    const strings = entries["xl/sharedStrings.xml"]
      ? sharedStrings(
          new TextDecoder().decode(await readEntry(bytes, entries["xl/sharedStrings.xml"])),
        )
      : [];
    return sheetRows(new TextDecoder().decode(await readEntry(bytes, entries[sheetName])), strings);
  }

  /* ---------- values ---------- */

  const fold = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase();

  /** "1.234,56", "-1234.56", "1 234,56 €" → integer cents. Null when not a number. */
  /**
   * Money as exact integer cents, from whatever the sheet holds.
   *
   * Two languages arrive here. A NUMBER is the sheet's own value: the decimal
   * point is a decimal point, and it may carry the full binary expansion of a
   * float — a real BBVA export writes sixty-nine euros ten as
   * -69.099999999999994. Rounding is the only correct reading of that, and
   * the text path below would have read its fifteen tail digits as euros:
   * that one row alone became -6,909,999,999,999,999,000 cents, past the
   * point where integers are even exact.
   *
   * TEXT is a human number in the export's own locale: «1.234,56», «-1.000»,
   * «(12,00)». There the last separator is the decimal one when both appear;
   * with only one separator a three-digit tail is the thousands grouping
   * Spanish writes, and any other length is a fraction.
   */
  function toCents(raw) {
    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) return null;
      const sign = raw < 0 ? -1 : 1;
      return sign * Math.round(Math.abs(raw) * 100);
    }
    let s = String(raw ?? "").trim();
    if (!s) return null;
    s = s.replace(/[€\s ]/g, "");
    let sign = 1;
    if (/^\(.*\)$/.test(s)) {
      sign = -1;
      s = s.slice(1, -1);
    }
    if (s.startsWith("-")) {
      sign *= -1;
      s = s.slice(1);
    } else if (s.startsWith("+")) s = s.slice(1);
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    let intPart = s;
    let decPart = "";
    const dec = Math.max(lastComma, lastDot);
    if (dec >= 0) {
      const tail = s.slice(dec + 1);
      const both = lastComma >= 0 && lastDot >= 0;
      if (/^\d*$/.test(tail) && (both || tail.length !== 3)) {
        intPart = s.slice(0, dec);
        decPart = tail;
      }
    }
    intPart = intPart.replace(/[.,]/g, "");
    if (!/^\d*$/.test(intPart) || (intPart === "" && decPart === "")) return null;
    // Rounded, not truncated: «,995» is a cent up, not a cent lost.
    let whole = Number(intPart || "0");
    let cents = decPart ? Math.round(Number("0." + decPart) * 100) : 0;
    if (cents >= 100) {
      whole += Math.floor(cents / 100);
      cents = cents % 100;
    }
    return sign * (whole * 100 + cents);
  }

  /** DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD or an Excel serial → ISO date. */
  function toIsoDate(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    if (/^\d+(\.\d+)?$/.test(s)) {
      const serial = Math.floor(Number(s));
      if (serial > 20000 && serial < 80000) {
        // Excel's day zero is 1899-12-30 (its leap-year bug already priced in).
        const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
        return d.toISOString().slice(0, 10);
      }
    }
    return null;
  }

  /* ---------- the BBVA layout ---------- */

  const HEADERS = {
    accountingDate: ["fecha", "f. contable", "fecha contable"],
    valueDate: ["f. valor", "fecha valor", "f.valor"],
    concept: ["concepto"],
    detail: ["movimiento", "concepto ampliado", "descripcion", "más datos", "mas datos"],
    amount: ["importe"],
    currency: ["divisa"],
    balance: ["disponible", "saldo"],
    observations: ["observaciones"],
    // Present in every real export and dropped by the first version of this
    // parser: the counterparty is the single most useful field for deciding
    // WHICH invoice a transaction pays.
    counterparty: ["beneficiario", "ordenante", "benef"],
    opCode: ["codigo", "cod."],
    reference: ["remesa", "referencia"],
  };

  function findHeader(rows) {
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const cells = (rows[i] || []).map(fold);
      const has = (names) =>
        cells.findIndex((c) => c && names.some((n) => c === n || c.startsWith(n)));
      const fecha = has(HEADERS.accountingDate);
      const importe = has(HEADERS.amount);
      const concepto = has(HEADERS.concept);
      if (fecha >= 0 && importe >= 0 && concepto >= 0) {
        const col = {};
        for (const [key, names] of Object.entries(HEADERS)) {
          const at = has(names);
          if (at >= 0) col[key] = at;
        }
        // "concepto" startsWith also matches "concepto ampliado"; when both
        // exist the SHORT one is the concept and the long one the detail.
        if (col.concept != null && col.detail != null && col.concept === col.detail) {
          const exact = cells.findIndex((c) => c === "concepto");
          if (exact >= 0) col.concept = exact;
        }
        return { rowIndex: i, col };
      }
    }
    return null;
  }

  /**
   * The file, as rows `importMovements` accepts. Returns
   * `{rows, headerRowIndex, skipped}`; throws only when the file is not a
   * spreadsheet or no header row can be found — a row that merely fails to
   * parse is counted in `skipped` and reported, never silently dropped.
   */
  async function parseBbva(arrayBuffer) {
    const raw = await parseXlsxRows(arrayBuffer);
    const head = findHeader(raw);
    if (!head)
      throw new Error(
        "No he encontrado la cabecera del extracto (Fecha / Concepto / Importe). ¿Es el export de movimientos de BBVA?",
      );
    const { rowIndex, col } = head;
    const rows = [];
    let skipped = 0;
    for (let i = rowIndex + 1; i < raw.length; i++) {
      const r = raw[i] || [];
      const get = (k) => (col[k] != null ? r[col[k]] : "");
      if (!r.some((c) => String(c || "").trim())) continue; // blank row
      const accountingDate = toIsoDate(get("accountingDate"));
      const amountCents = toCents(get("amount"));
      if (!accountingDate || amountCents == null) {
        skipped++;
        continue;
      }
      const concept = String(get("concept") || "").trim();
      const detail = String(get("detail") || "").trim();
      const observations = String(get("observations") || "").trim();
      /* Where the merchant actually is. A card payment on a real statement
         says «PAGO CON TARJETA EN HOGAR, MUEBLES, DECORACION Y ELECTR» as its
         concept — the scheme's category, the same for every hardware shop in
         the country — and names the shop in OBSERVACIONES. Leaving
         merchantText empty meant the merchant rules (BNK-05), which key on
         it, could never fire on a real import, and the screen showed a
         category where the operator was looking for a supplier. */
      const merchantText = detail && detail !== concept ? detail : observations;
      rows.push({
        accountingDate,
        valueDate: toIsoDate(get("valueDate")) || accountingDate,
        concept: concept || detail,
        counterparty: String(get("counterparty") || "").trim(),
        merchantText,
        observations,
        opCode: String(get("opCode") || "").trim(),
        reference: String(get("reference") || "").trim(),
        amountCents,
        balanceCents: toCents(get("balance")),
        currency: String(get("currency") || "EUR").trim() || "EUR",
      });
    }
    /* Chronological, whatever order the export used. BBVA writes newest
       first; a ledger reads oldest first, and the running balance only tells
       its story in that direction. The reversal preserves the bank's own
       sequence within a day, which sorting by date would not. */
    if (rows.length > 1 && rows[0].accountingDate > rows[rows.length - 1].accountingDate)
      rows.reverse();
    return { rows, headerRowIndex: rowIndex, skipped };
  }

  return {
    parseXlsxRows,
    parseBbva,
    toCents,
    toIsoDate,
    // The raw ZIP reader, exported so the accountant export can be READ BACK
    // by the same code that reads bank statements — the test opens the
    // archive it produced instead of trusting that producing it worked.
    zip: { centralDirectory, readEntry },
  };
});

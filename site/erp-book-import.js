/* =============================================================================
   The price book and a budget, as ONE uploaded workbook each.

   Two formats, both read here, both written by `plantilla()` below so the file
   the operator downloads and the file this parses can never drift:

     EL LIBRO DE PRECIOS — títulos, partidas and subpartidas in one sheet.
     UN PRESUPUESTO      — the same three levels, plus quantities and prices.

   WHY ONE FORMAT FOR THE WHOLE BOOK rather than three. The operator asked for
   an import button in each of the three registers and then, reading it back,
   said the better idea was «just one format to upload everything». They are
   right, and the reason is the relationship: a subpartida cannot be filed
   without a partida, so a subpartida-only sheet either carries its partida
   anyway — at which point it is this format with columns missing — or imports
   two hundred rows that then have to be filed by hand, one at a time. Títulos
   and partidas stand alone; a subpartida row REQUIRES its partida.

   WHAT A TÍTULO IS NOT, because the sheet makes it look otherwise. Writing
   «Reforma de baño | Fontanería | Punto de agua» on one row reads like a
   hierarchy, and it is not one: since v24 a título groups partidas INSIDE ONE
   BUDGET and the price book keeps no global answer to "which partidas belong
   under it". So on a price-book row the Título column creates the título and
   nothing else. In the BUDGET format the same three columns DO nest, because
   there the grouping is exactly what is being described.

   READ, PLAN, APPLY — in that order, and they are separate on purpose.
   `parse*` reads a file, `plan*` compares it against the current state and
   returns what WOULD change without touching anything, and only `apply*` acts
   on a plan the caller has already been shown. That separation is what lets
   the screen put a preview in front of the operator before a spreadsheet
   rewrites prices in their book — the half of "rewrite what is different"
   that makes it safe — and it is why the planner is testable without a
   browser, a file or a click.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./erp-import.js"));
  else root.ErpBookImport = factory(root.ErpImport);
})(typeof globalThis !== "undefined" ? globalThis : this, function (ErpImport) {
  "use strict";

  /* ---------- the two headers, and they are also the templates ---------- */

  /** The price book. `key` is what the planner reads; `lab` is what Excel shows. */
  var BOOK_COLUMNS = [
    { key: "title", lab: "Título" },
    { key: "chapter", lab: "Partida" },
    { key: "item", lab: "Subpartida" },
    { key: "ca", lab: "Nom (CA)" },
    { key: "unit", lab: "Unidad" },
    { key: "type", lab: "Tipo" },
    { key: "brand", lab: "Marca" },
    { key: "model", lab: "Modelo" },
    { key: "quality", lab: "Calidad" },
    { key: "cost", lab: "Coste" },
    { key: "price", lab: "Precio" },
  ];

  /** A budget. The same three levels, and here they really do nest. */
  var BUDGET_COLUMNS = [
    { key: "title", lab: "Título" },
    { key: "chapter", lab: "Partida" },
    { key: "item", lab: "Subpartida" },
    { key: "unit", lab: "Unidad" },
    { key: "qty", lab: "Cantidad" },
    { key: "price", lab: "Precio" },
    { key: "cost", lab: "Coste" },
  ];

  /* ---------- text ---------- */

  /* Accent- and case-folded, spaces collapsed. This is what "already exists"
     means for every match below: «Fontanería», «FONTANERIA» and «fontaneria »
     are one partida, because a person typing a second sheet will not reproduce
     the first one's accents and would otherwise get a duplicate that looks
     identical on screen. */
  function fold(s) {
    return String(s == null ? "" : s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
  function text(s) {
    return String(s == null ? "" : s)
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * A quantity in thousandths, from whatever the sheet holds.
   *
   * Money goes through `ErpImport.toCents`, which this product already trusts
   * with bank statements; quantities need the same treatment for the same
   * reason — "1.234,5" is one thousand two hundred in Spanish and one point
   * two in English, and a budget whose quantities are out by a thousand prices
   * a job wrong. Same rule as the money reader: split on the separator, never
   * multiply a float.
   */
  function toMilli(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return Math.round(v * 1000);
    var s = String(v).replace(/\s/g, "");
    if (!s) return null;
    var neg = /^-/.test(s);
    s = s.replace(/^-/, "");
    var lastDot = s.lastIndexOf("."),
      lastComma = s.lastIndexOf(",");
    var sep = lastDot > lastComma ? "." : lastComma > -1 ? "," : "";
    var whole = s,
      frac = "";
    if (sep) {
      whole = s.slice(0, sep === "." ? lastDot : lastComma);
      frac = s.slice((sep === "." ? lastDot : lastComma) + 1);
    }
    whole = whole.replace(/[.,]/g, "");
    if (!/^\d*$/.test(whole) || !/^\d*$/.test(frac)) return null;
    if (!whole && !frac) return null;
    var milli = Number(whole || 0) * 1000 + Number(((frac || "") + "000").slice(0, 3));
    return neg ? -milli : milli;
  }

  /* ---------- reading the file ---------- */

  /**
   * Find the header row by its NAMES, never by its position.
   *
   * Same decision as the bank parser: a person will add a title row, a logo or
   * a blank line above the table and the file must still read. A renamed
   * column is what this cannot survive, which is why the template exists and
   * why the error below names the columns it could not find.
   */
  function findHeader(raw, columns) {
    var required = columns.filter(function (c) {
      return c.key === "item" || c.key === "chapter" || c.key === "title";
    });
    for (var i = 0; i < raw.length && i < 50; i++) {
      var row = raw[i] || [];
      var col = {};
      for (var c = 0; c < row.length; c++) {
        var f = fold(row[c]);
        if (!f) continue;
        for (var k = 0; k < columns.length; k++)
          if (col[columns[k].key] == null && fold(columns[k].lab) === f) col[columns[k].key] = c;
      }
      var got = required.filter(function (r) {
        return col[r.key] != null;
      });
      if (got.length === required.length) return { rowIndex: i, col: col };
    }
    return null;
  }

  function readSheet(raw, columns) {
    var head = findHeader(raw, columns);
    if (!head)
      throw new Error(
        "No encuentro la fila de encabezados. Descarga la plantilla y usa sus columnas: " +
          columns
            .map(function (c) {
              return c.lab;
            })
            .join(", "),
      );
    var out = [];
    for (var i = head.rowIndex + 1; i < raw.length; i++) {
      var r = raw[i] || [];
      var any = false;
      for (var j = 0; j < r.length; j++)
        if (text(r[j])) {
          any = true;
          break;
        }
      if (!any) continue;
      var rec = { row: i + 1 };
      for (var k = 0; k < columns.length; k++) {
        var cix = head.col[columns[k].key];
        rec[columns[k].key] = cix == null ? "" : text(r[cix]);
      }
      out.push(rec);
    }
    return { rows: out, headerRowIndex: head.rowIndex };
  }

  function parseBook(buffer) {
    return ErpImport.parseXlsxRows(buffer).then(function (raw) {
      return readSheet(raw, BOOK_COLUMNS);
    });
  }
  function parseBudget(buffer) {
    return ErpImport.parseXlsxRows(buffer).then(function (raw) {
      return readSheet(raw, BUDGET_COLUMNS);
    });
  }

  /* ---------- what the file WOULD do ---------- */

  var TYPES = {
    material: "material",
    "mano de obra": "ownLabour",
    subcontrata: "subcontract",
    maquinaria: "machinery",
    profesional: "professional",
    residuos: "waste",
    otros: "other",
  };
  function toType(v) {
    var f = fold(v);
    return f ? TYPES[f] || "" : "";
  }

  /**
   * A subpartida is INCOMPLETE until it carries both figures.
   *
   * The operator's rule: «If there is no Price or Cost in Subpartida, leave it
   * marked as not completed.» Derived, never stored — there is no new field
   * and no migration, and a figure typed in tomorrow completes the record with
   * nothing to re-stamp. A missing PRICE already had consequences and keeps
   * them (the line enters a budget `pending`, out of the total and off the
   * document); a missing COST has none, because cost is what the company pays
   * and changes nothing the customer is shown.
   */
  function incomplete(item) {
    return !item || !item.defaultPriceCents || !item.defaultCostCents;
  }

  /** The fields a price-book row can carry into an existing subpartida. */
  var ITEM_FIELDS = [
    ["unit", "unit", text],
    ["type", "type", toType],
    ["brand", "brand", text],
    ["model", "model", text],
    ["quality", "quality", text],
    ["cost", "defaultCostCents", null],
    ["price", "defaultPriceCents", null],
  ];

  /**
   * What an uploaded price book would create and what it would change.
   *
   * «Rewrite what is different» is the operator's choice, and the word that
   * carries the weight is DIFFERENT: a blank cell is not a value, so it never
   * erases what is on file. Only a cell with something in it, whose something
   * disagrees with the record, becomes a change — and every one of those
   * changes is listed by field, old value and new, so the preview can show
   * exactly what a stale spreadsheet is about to do to the prices.
   */
  function planBook(erp, rows) {
    var titles = erp.listAll("itemTitles"),
      chapters = erp.listAll("itemChapters");
    var byTitle = {},
      byChapter = {},
      byItem = {};
    titles.forEach(function (t) {
      byTitle[fold(t.es)] = t;
    });
    chapters.forEach(function (c) {
      byChapter[fold(c.es)] = c;
    });
    erp.state.catalogue.forEach(function (i) {
      byItem[fold(i.desc)] = i;
    });

    var plan = { titles: [], chapters: [], items: [], errors: [], seen: {} };
    var newTitles = {},
      newChapters = {};

    rows.forEach(function (r) {
      var tName = text(r.title),
        cName = text(r.chapter),
        iName = text(r.item);

      /* A subpartida needs its partida — the one rule the operator stated
         outright, and the reason this is one format rather than three. */
      if (iName && !cName) {
        plan.errors.push({ row: r.row, msg: "«" + iName + "» no dice de qué partida es" });
        return;
      }

      if (tName) {
        var tKey = fold(tName);
        if (byTitle[tKey]) {
          var tCa = text(r.ca);
          if (!iName && !cName && tCa && tCa !== text(byTitle[tKey].ca))
            plan.titles.push({
              row: r.row,
              action: "update",
              code: byTitle[tKey].code,
              name: tName,
              changes: [{ field: "Nom (CA)", from: text(byTitle[tKey].ca), to: tCa }],
              ca: tCa,
            });
        } else if (!newTitles[tKey]) {
          newTitles[tKey] = true;
          plan.titles.push({
            row: r.row,
            action: "create",
            name: tName,
            ca: !iName && !cName ? text(r.ca) : "",
          });
        }
      }

      if (cName) {
        var cKey = fold(cName);
        if (byChapter[cKey]) {
          var cCa = text(r.ca);
          if (!iName && cCa && cCa !== text(byChapter[cKey].ca))
            plan.chapters.push({
              row: r.row,
              action: "update",
              code: byChapter[cKey].code,
              name: cName,
              changes: [{ field: "Nom (CA)", from: text(byChapter[cKey].ca), to: cCa }],
              ca: cCa,
            });
        } else if (!newChapters[cKey]) {
          newChapters[cKey] = true;
          plan.chapters.push({
            row: r.row,
            action: "create",
            name: cName,
            ca: !iName ? text(r.ca) : "",
          });
        }
      }

      if (!iName) return;

      var want = {
        unit: text(r.unit),
        type: toType(r.type),
        brand: text(r.brand),
        model: text(r.model),
        quality: text(r.quality),
        defaultCostCents: ErpImport.toCents(r.cost),
        defaultPriceCents: ErpImport.toCents(r.price),
      };
      var iKey = fold(iName);
      var existing = byItem[iKey];

      if (!existing) {
        /* A description twice in one file is one subpartida, not two — the
           second row's figures win, because a person correcting a sheet edits
           the row they find rather than deleting the first. */
        if (plan.seen[iKey] != null) {
          var prev = plan.items[plan.seen[iKey]];
          ITEM_FIELDS.forEach(function (f) {
            var v = want[f[1]];
            if (v !== "" && v != null) prev.values[f[1]] = v;
          });
          if (prev.chapters.indexOf(cName) < 0) prev.chapters.push(cName);
          return;
        }
        plan.seen[iKey] = plan.items.length;
        plan.items.push({
          row: r.row,
          action: "create",
          desc: iName,
          chapters: [cName],
          values: want,
          incomplete: incomplete(want),
        });
        return;
      }

      var changes = [];
      ITEM_FIELDS.forEach(function (f) {
        var v = want[f[1]];
        if (v === "" || v == null) return; // a blank cell erases nothing
        if (String(existing[f[1]] == null ? "" : existing[f[1]]) === String(v)) return;
        changes.push({
          field: BOOK_COLUMNS.filter(function (c) {
            return c.key === f[0];
          })[0].lab,
          from: existing[f[1]],
          to: v,
        });
      });
      var filed = erp.itemPartidas(existing.id) || [];
      var chapCode = byChapter[fold(cName)] ? byChapter[fold(cName)].code : null;
      var addChapter = cName && (!chapCode || filed.indexOf(chapCode) < 0);
      if (!changes.length && !addChapter) return; // unchanged: nothing to report but a count
      plan.items.push({
        row: r.row,
        action: "update",
        id: existing.id,
        code: existing.code,
        desc: existing.desc,
        chapters: addChapter ? [cName] : [],
        changes: changes,
        values: want,
        incomplete: incomplete(Object.assign({}, existing, stripBlank(want))),
      });
    });

    return plan;
  }

  /** The patch a row actually applies: only the cells that carried something. */
  function stripBlank(values) {
    var out = {};
    Object.keys(values).forEach(function (k) {
      if (values[k] !== "" && values[k] != null) out[k] = values[k];
    });
    return out;
  }

  /**
   * An uploaded budget, as the chapters and lines it would become.
   *
   * Here the three columns DO nest: a partida is a chapter of this budget and
   * the título is the heading that chapter prints under, which is exactly the
   * shape `addChapter` already takes. Blank Título or Partida cells repeat the
   * row above — the way anybody writes a grouped table by hand — so only the
   * first row of a run needs to carry them.
   */
  function planBudget(erp, rows) {
    var chapters = [],
      byKey = {},
      errors = [];
    var lastTitle = "",
      lastChapter = "";

    rows.forEach(function (r) {
      var tName = text(r.title) || lastTitle;
      var cName = text(r.chapter) || lastChapter;
      lastTitle = tName;
      lastChapter = cName;
      var iName = text(r.item);
      if (!iName) return; // a row that only opens a heading
      if (!cName) {
        errors.push({ row: r.row, msg: "«" + iName + "» no dice de qué partida es" });
        return;
      }
      /* Keyed on partida AND título, because the same trade in two parts of
         one job is two chapters — that is the whole of the 17 Sep change, and
         a budget sheet is exactly where it shows up. */
      var key = fold(tName) + "\u0000" + fold(cName);
      if (!byKey[key]) {
        byKey[key] = { title: tName, name: cName, lines: [] };
        chapters.push(byKey[key]);
      }
      byKey[key].lines.push({
        row: r.row,
        desc: iName,
        unit: text(r.unit),
        qtyMilli: toMilli(r.qty) || 0,
        priceCents: ErpImport.toCents(r.price) || 0,
        costCents: ErpImport.toCents(r.cost) || 0,
      });
    });

    /* What the book is missing. The same planner as above, so a budget upload
       and a price-book upload cannot disagree about what counts as new. */
    var bookRows = [];
    chapters.forEach(function (c) {
      if (c.title) bookRows.push({ row: 0, title: c.title, chapter: "", item: "" });
      bookRows.push({ row: 0, title: "", chapter: c.name, item: "" });
      c.lines.forEach(function (l) {
        bookRows.push({
          row: l.row,
          title: "",
          chapter: c.name,
          item: l.desc,
          unit: l.unit,
          cost: l.costCents == null ? "" : String(l.costCents / 100),
          price: l.priceCents == null ? "" : String(l.priceCents / 100),
        });
      });
    });
    var book = planBook(erp, bookRows);

    return { chapters: chapters, book: book, errors: errors.concat(book.errors) };
  }

  /* ---------- the template, written from the same column lists ---------- */

  /**
   * The rows of the template workbook — header plus a worked example.
   *
   * Written from BOOK_COLUMNS/BUDGET_COLUMNS rather than typed out, so the
   * file the operator downloads and the file this parses cannot drift. The
   * example rows are there because a header alone does not tell you that a
   * subpartida row repeats its partida, or that a título row leaves the rest
   * blank; one look at three filled rows does.
   */
  function plantilla(kind) {
    var cols = kind === "budget" ? BUDGET_COLUMNS : BOOK_COLUMNS;
    var head = cols.map(function (c) {
      return c.lab;
    });
    var rows = [head];
    if (kind === "budget") {
      rows.push([
        "Reforma de baño",
        "Fontanería",
        "Punto de agua empotrado",
        "ud",
        "3",
        "85",
        "42",
      ]);
      rows.push(["", "", "Sustitución de bajante", "ml", "4,5", "54", "26"]);
      rows.push(["", "Alicatado", "Alicatado de pared 30x60", "m2", "24", "39", "19"]);
      rows.push([
        "Reforma de cocina",
        "Solados",
        "Solado de gres porcelánico",
        "m2",
        "18",
        "46",
        "23",
      ]);
    } else {
      rows.push(["Reforma de baño", "", "", "Reforma de bany", "", "", "", "", "", "", ""]);
      rows.push(["", "Fontanería", "", "Lampisteria", "", "", "", "", "", "", ""]);
      rows.push([
        "",
        "Fontanería",
        "Punto de agua empotrado",
        "",
        "ud",
        "Material",
        "",
        "",
        "",
        "42",
        "85",
      ]);
      rows.push([
        "",
        "Alicatado",
        "Alicatado de pared 30x60",
        "",
        "m2",
        "Material",
        "",
        "",
        "",
        "19",
        "39",
      ]);
    }
    return { name: kind === "budget" ? "Presupuesto" : "Libro de precios", rows: rows };
  }

  /* ---------- acting on a plan ---------- */

  /**
   * Apply a price-book plan. Returns what it did, counted.
   *
   * The order is the dependency order and cannot be rearranged: títulos and
   * partidas first, because a subpartida is filed under a partida and one
   * created three rows later in the sheet still has to exist by the time the
   * filing happens. `setItemPartidas` is given the UNION of what the item
   * already had and what the sheet names, never the sheet alone — an upload
   * that mentions one partida must not un-file the item from three others.
   */
  function applyBook(erp, plan, user) {
    var made = { titles: 0, chapters: 0, items: 0, updated: 0 };
    plan.titles.forEach(function (t) {
      if (t.action === "create") {
        erp.addListEntry(
          "itemTitles",
          { code: erp.suggestListCode("itemTitles", t.name), es: t.name, ca: t.ca || "" },
          user,
        );
        made.titles++;
      } else {
        erp.updateListEntry("itemTitles", t.code, { ca: t.ca }, user);
        made.updated++;
      }
    });
    plan.chapters.forEach(function (c) {
      if (c.action === "create") {
        erp.addListEntry(
          "itemChapters",
          { code: erp.suggestListCode("itemChapters", c.name), es: c.name, ca: c.ca || "" },
          user,
        );
        made.chapters++;
      } else {
        erp.updateListEntry("itemChapters", c.code, { ca: c.ca }, user);
        made.updated++;
      }
    });

    /* Partida NAMES become codes only now, after every partida in the file
       exists. Resolved by the same folded match the planner used, so the two
       cannot disagree about which partida a name meant. */
    var byName = {};
    erp.listAll("itemChapters").forEach(function (c) {
      byName[fold(c.es)] = c.code;
    });
    var codesFor = function (names) {
      var out = [];
      (names || []).forEach(function (n) {
        var code = byName[fold(n)];
        if (code && out.indexOf(code) < 0) out.push(code);
      });
      return out;
    };

    plan.items.forEach(function (i) {
      if (i.action === "create") {
        var rec = erp.addCatalogueItem(
          Object.assign({ code: nextItemCode(erp), desc: i.desc }, stripBlank(i.values)),
          user,
        );
        var codes = codesFor(i.chapters);
        if (codes.length) erp.setItemPartidas(rec.id, codes, user);
        made.items++;
      } else {
        if (i.changes && i.changes.length)
          erp.updateCatalogueItem(i.id, stripBlank(i.values), user);
        if (i.chapters && i.chapters.length) {
          var had = erp.itemPartidas(i.id) || [];
          var want = had.slice();
          codesFor(i.chapters).forEach(function (c) {
            if (want.indexOf(c) < 0) want.push(c);
          });
          if (want.length !== had.length) erp.setItemPartidas(i.id, want, user);
        }
        made.updated++;
      }
    });
    return made;
  }

  /**
   * The next subpartida código.
   *
   * The correlative the operator asked for on 18 September, read off the book
   * rather than counted: an import that minted `SUB-` + (length + 1) would
   * collide the moment a book had a gap in it, and a bulk upload is exactly
   * where a hundred collisions arrive at once.
   */
  function nextItemCode(erp) {
    var max = 0;
    (erp.state.catalogue || []).forEach(function (i) {
      var m = /^SUB-(\d+)$/.exec(String(i.code || ""));
      if (m) max = Math.max(max, Number(m[1]) || 0);
    });
    var taken = {};
    (erp.state.catalogue || []).forEach(function (i) {
      taken[String(i.code || "").toUpperCase()] = true;
    });
    for (var n = max + 1; n < max + 100000; n++) {
      var c = "SUB-" + String(n).padStart(4, "0");
      if (!taken[c]) return c;
    }
    return "";
  }

  /**
   * Draft a budget from an uploaded sheet: the book first, then the chapters.
   *
   * The budget must already exist and name its customer — a spreadsheet is a
   * list of work, not a client record, and inventing a party from one would
   * put a customer on the books that nobody entered. So this fills the
   * budget's editable version and never creates the budget itself.
   *
   * Every line carries `sourceFile`/`chapterOriginal`, the provenance fields
   * `addLine` has held since the v4 plan: what the sheet called this chapter
   * survives even after the partida is renamed here, which is what makes a
   * later corrected upload re-matchable against what was already loaded.
   */
  function applyBudget(erp, budgetId, plan, user, opts) {
    var o = opts || {};
    var made = applyBook(erp, plan.book, user);
    var byDesc = {};
    erp.state.catalogue.forEach(function (i) {
      byDesc[fold(i.desc)] = i;
    });
    var chapters = 0,
      lines = 0;
    plan.chapters.forEach(function (c) {
      var chap = erp.addChapter(budgetId, { name: c.name, title: c.title || "" }, user);
      chapters++;
      c.lines.forEach(function (l) {
        var item = byDesc[fold(l.desc)];
        erp.addLine(
          budgetId,
          chap.id,
          {
            itemId: item ? item.id : null,
            code: item ? item.code : "",
            desc: l.desc,
            unit: l.unit || (item ? item.unit : "") || "ud",
            qtyMilli: l.qtyMilli,
            priceCents: l.priceCents,
            costCents: l.costCents,
            /* No price is «pendiente de valorar», the same state the catalogue
               picker puts a line in — out of the total, off the document, and
               counted on Torre until somebody prices it. */
            pending: !l.priceCents,
            sourceFile: o.fileName || "",
            sourceSheet: o.sheetName || "",
            chapterOriginal: c.name,
          },
          user,
        );
        lines++;
      });
    });
    return Object.assign(made, { chapters: chapters, lines: lines });
  }

  return {
    BOOK_COLUMNS: BOOK_COLUMNS,
    BUDGET_COLUMNS: BUDGET_COLUMNS,
    parseBook: parseBook,
    parseBudget: parseBudget,
    planBook: planBook,
    planBudget: planBudget,
    plantilla: plantilla,
    applyBook: applyBook,
    applyBudget: applyBudget,
    nextItemCode: nextItemCode,
    incomplete: incomplete,
    fold: fold,
    toMilli: toMilli,
  };
});

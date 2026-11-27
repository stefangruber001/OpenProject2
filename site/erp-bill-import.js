/* =============================================================================
   LAS FACTURAS DE PROVEEDOR, COMO UNA HOJA SUBIDA — SÓLO LA CABECERA.

   Para qué: conciliar el banco. La reunión con la gestoría del 26 de
   noviembre lo dejó dicho — «solo proveedor, nº de factura, base imponible y
   total» — y el reparto por obra, partida y subpartida viene después. Así que
   esto registra facturas SIN destino, y por eso exige que la empresa tenga
   apagado «Exigir destino» (`requireCostDestination`): con él encendido
   `registerBill` refusa una factura sin repartir, y es correcto que lo haga.

   LEER, PLANEAR, APLICAR, separados como en `erp-supplier-import.js`: nada se
   escribe hasta el segundo botón, y lo que se enseña antes es lo que va a
   pasar, fila a fila.

   LA REGLA DEL SIGNO, que es la razón de que esto exista en vez de una
   carga ingenua. El listado trimestral que exporta BigMat trae los abonos en
   POSITIVO; cargado tal cual sobrevalora el trimestre en 562,98 € de base,
   porque suma lo que había que restar. Y su identificador interno no los
   distingue: `ZCO25893685` es una rectificativa con el prefijo de siempre.
   Lo único que la delata es la SERIE de su número fiscal.

   Así que el signo de cada fila sale de la evidencia que haya, y hay tres:

     · el TIPO escrito en la hoja («Factura», «Rectificativa», «Vale»);
     · un IMPORTE NEGATIVO, que es como lo escribe el registro manual de
       Diorca — y sólo cuenta cuando es negativo, porque un importe positivo
       es una magnitud y no dice nada del sentido;
     · la SERIE del número, según las reglas que la propia hoja trae en su
       pestaña «Series» para cada proveedor. Datos, no código: qué serie es un
       abono lo decide la numeración de cada proveedor, y eso no se escribe en
       un programa que han de usar mil empresas.

   Si la evidencia coincide, manda. Si se contradice —la hoja dice
   «Factura» y el importe es negativo, o la serie dice abono y el tipo dice
   factura— la fila NO se importa y se dice por qué: un signo equivocado no
   es un error de un céntimo, es el doble del importe en el sentido contrario.
   Y si un proveedor tiene reglas de serie y el número no encaja en ninguna,
   la fila entra como factura pero SEÑALADA: no se adivina en silencio.

   CÓMO SE GUARDA UN ABONO: importes NEGATIVOS y `creditNoteFor` vacío. El
   motor conoce otra convención (AP-09: importes positivos más
   `creditNoteFor`), y las dos no se pueden combinar nunca — `vatSummary`
   niega lo que lleva `creditNoteFor`, y negar un negativo lo vuelve a sumar.
   Ésta es la que sirve aquí porque el listado nunca dice QUÉ factura rectifica
   un abono, y está medida contra la conciliación: un cargo de tarjeta que
   paga una factura y descuenta un abono, y una devolución que entra en la
   tarjeta, cuadran los dos a cero.

   EL IVA SALE DEL TIPO, NO DE LA DIFERENCIA. El total de la hoja es una
   COMPROBACIÓN. Si no trae tipo, se busca entre los tipos que la empresa
   tiene configurados el único que, con la retención del proveedor, da ese
   total al céntimo — y si ninguno lo da, la fila se refusa en vez de
   inventarse un 11,2 %. Dos filas del listado de BigMat son exactamente eso:
   seis euros menos que base × 1,21, un descuento después del impuesto, no
   otro tipo de IVA.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./erp-import.js"), require("./erp-engine.js"));
  else root.ErpBillImport = factory(root.ErpImport, root.ErpEngine);
})(typeof globalThis !== "undefined" ? globalThis : this, function (ErpImport, ErpEngine) {
  "use strict";

  /* ---------- las dos pestañas, que son también la plantilla ---------- */

  var FACTURA_COLUMNS = [
    { key: "supplierTaxId", lab: "NIF/CIF proveedor" },
    { key: "supplierName", lab: "Proveedor" },
    { key: "number", lab: "Nº factura" },
    { key: "supplierDocRef", lab: "Ref. del proveedor" },
    { key: "date", lab: "Fecha" },
    { key: "kind", lab: "Tipo" },
    { key: "base", lab: "Base imponible" },
    { key: "vatRate", lab: "IVA %" },
    { key: "total", lab: "Total" },
    { key: "dueDate", lab: "Vencimiento" },
  ];
  /* Qué serie de cada proveedor es un abono. Opcional: un proveedor que sólo
     emite facturas no necesita ninguna fila aquí. */
  var SERIE_COLUMNS = [
    { key: "supplierTaxId", lab: "NIF/CIF proveedor" },
    { key: "prefix", lab: "Empieza por" },
    { key: "kind", lab: "Tipo" },
  ];
  /* Los campos que NO se pasan por `text()`: llegan como números de la hoja
     y convertirlos en cadena antes de tiempo es como un flotante de quince
     decimales acabó leído como euros en el importador del banco. */
  var RAW = { base: 1, total: 1, vatRate: 1, date: 1, dueDate: 1 };

  /* ---------- texto ---------- */

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
  /** Letras y dígitos en mayúsculas: lo que significa «el mismo número». */
  function squash(v) {
    return String(v == null ? "" : v)
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "");
  }

  /**
   * Qué dice la columna «Tipo». El orden importa: «Factura rectificativa
   * (devolución)», que es como lo escribe el registro manual, contiene la
   * palabra «factura» y es un abono.
   */
  function kindOf(v) {
    var f = fold(v);
    if (!f) return "";
    if (/rectific|abono|devoluc|nota de credito/.test(f)) return "credit";
    if (/\bvale\b|cheque/.test(f)) return "voucher";
    if (/factura|ticket|simplificada/.test(f)) return "invoice";
    return "?";
  }
  /** Un abono y un vale restan; una factura suma. */
  function directionOf(kind) {
    if (kind === "credit" || kind === "voucher") return "credit";
    if (kind === "invoice") return "invoice";
    return "";
  }

  /**
   * UN TIPO DE IVA, EN PUNTOS BÁSICOS, O NULL SI LA CELDA NO DICE NADA.
   *
   * Tres escrituras del mismo 21 % llegan de verdad: «21», «21 %» y 0,21 — esta
   * última es como lo guarda el registro manual, porque la celda tiene formato
   * de porcentaje. Un valor por debajo de 1 es una fracción: no existe ningún
   * tipo de IVA del uno por ciento con el que confundirlo.
   */
  function toVatBp(v) {
    if (v == null || v === "") return null;
    var n = typeof v === "number" ? v : Number(text(v).replace(/%/g, "").replace(",", "."));
    if (!isFinite(n) || n < 0) return NaN;
    if (n > 0 && n < 1) n = n * 100;
    return Math.round(n * 100);
  }

  /* ---------- leer ---------- */

  function findHeader(raw, columns, required) {
    for (var i = 0; i < raw.length && i < 50; i++) {
      var row = raw[i] || [];
      var col = {};
      for (var c = 0; c < row.length; c++) {
        var f = fold(row[c]);
        if (!f) continue;
        for (var k = 0; k < columns.length; k++)
          if (col[columns[k].key] == null && fold(columns[k].lab) === f) col[columns[k].key] = c;
      }
      var ok = required.every(function (key) {
        return Array.isArray(key)
          ? key.some(function (alt) {
              return col[alt] != null;
            })
          : col[key] != null;
      });
      if (ok) return { rowIndex: i, col: col };
    }
    return null;
  }

  function readWith(raw, head, columns) {
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
        var key = columns[k].key;
        var cix = head.col[key];
        var v = cix == null ? "" : r[cix];
        rec[key] = RAW[key] ? (v == null ? "" : v) : text(v);
      }
      out.push(rec);
    }
    return out;
  }

  /**
   * Lee el libro: la pestaña de facturas y, si está, la de series.
   *
   * Cada pestaña se busca POR SU CABECERA, nunca por su posición. Pedirle a
   * `parseXlsxRows` la hoja 4 de un libro de tres devuelve la hoja 1 en vez de
   * nada, así que buscar las series «en la segunda pestaña» de un fichero que
   * sólo tiene una leería las facturas como reglas de serie.
   */
  function parseFacturas(buffer) {
    var reads = [];
    for (var i = 1; i <= 4; i++) reads.push(ErpImport.parseXlsxRows(buffer, i));
    return Promise.all(reads).then(function (sheets) {
      var inv = null;
      var ser = null;
      sheets.forEach(function (raw) {
        if (!inv) {
          var h = findHeader(raw, FACTURA_COLUMNS, [
            "number",
            "base",
            ["supplierTaxId", "supplierName"],
          ]);
          if (h) inv = { rows: readWith(raw, h, FACTURA_COLUMNS), headerRowIndex: h.rowIndex };
        }
        if (!ser) {
          var hs = findHeader(raw, SERIE_COLUMNS, ["prefix", "kind"]);
          if (hs) ser = readWith(raw, hs, SERIE_COLUMNS);
        }
      });
      if (!inv)
        throw new Error(
          "No encuentro la fila de encabezados. Descarga la plantilla y usa sus columnas: " +
            FACTURA_COLUMNS.map(function (c) {
              return c.lab;
            }).join(", "),
        );
      return { rows: inv.rows, series: ser || [], headerRowIndex: inv.headerRowIndex };
    });
  }

  /* ---------- lo que el fichero HARÍA ---------- */

  var SUPPLIER_ROLES = ["supplier", "subcontractor", "selfEmployed"];

  /**
   * Compara la hoja contra el libro y devuelve lo que pasaría.
   *
   * Cuatro cestas: `creates` (con sus avisos), `unchanged` (ya registradas,
   * que es lo que hace inocua la segunda pasada), `errors` (con su fila y su
   * motivo) y, a nivel de todo el plan, `blocked` cuando la empresa no puede
   * registrar ninguna factura sin repartir.
   */
  function planFacturas(erp, rows, series) {
    var plan = { creates: [], unchanged: [], errors: [], blocked: null };
    if (erp.requireCostDestination && erp.requireCostDestination())
      plan.blocked =
        "La empresa exige repartir cada factura al registrarla. Para cargar sólo la cabecera y conciliar el banco, desmarca «Exigir que cada factura diga a dónde va» en Configuración › Empresa.";

    var parties = ((erp.state && erp.state.parties) || []).filter(function (p) {
      return (
        p.active !== false &&
        (p.roles || []).some(function (r) {
          return SUPPLIER_ROLES.indexOf(r) !== -1;
        })
      );
    });
    var ourTaxId = squash(((erp.state && erp.state.config) || {}).taxId);
    var rates = ((ErpEngine.LISTS && ErpEngine.LISTS.vatRates) || [2100, 1000, 500, 0]).slice();

    /* Las reglas de serie, por proveedor, de la más larga a la más corta: un
       prefijo más específico manda sobre uno que lo contiene. */
    var rules = {};
    (series || []).forEach(function (s) {
      var t = squash(s.supplierTaxId);
      var p = squash(s.prefix);
      var k = kindOf(s.kind);
      if (!t || !p || !k || k === "?") return;
      (rules[t] = rules[t] || []).push({ prefix: p, kind: k });
    });
    Object.keys(rules).forEach(function (t) {
      rules[t].sort(function (a, b) {
        return b.prefix.length - a.prefix.length;
      });
    });

    var bills = (erp.state && erp.state.bills) || [];
    var seen = []; // las de esta misma hoja, para el duplicado interno

    rows.forEach(function (r) {
      var err = function (msg) {
        plan.errors.push({ row: r.row, msg: msg });
      };
      var number = text(r.number);
      var ref = text(r.supplierDocRef);
      var label = number || ref || "fila " + r.row;
      if (!number) return err("Falta el número de factura");

      /* ── el proveedor: por NIF, y si no hay NIF, por nombre o alias ── */
      var tax = squash(r.supplierTaxId);
      if (tax && ourTaxId && tax === ourTaxId)
        return err(
          "«" + label + "» la emitió la propia empresa: es una factura emitida, no una recibida",
        );
      var sup = null;
      if (tax) {
        sup = parties.filter(function (p) {
          return squash(p.taxId) === tax;
        })[0];
        if (!sup)
          return err(
            "No hay ningún proveedor con NIF " +
              text(r.supplierTaxId) +
              ": importa antes la hoja de proveedores",
          );
      } else {
        var name = fold(r.supplierName);
        if (!name) return err("«" + label + "» no dice de qué proveedor es (falta NIF y nombre)");
        var hits = parties.filter(function (p) {
          return (
            fold(p.name) === name ||
            (p.aliases || []).some(function (a) {
              return fold(a) === name;
            })
          );
        });
        if (hits.length > 1)
          return err("«" + text(r.supplierName) + "» coincide con varios proveedores: pon el NIF");
        sup = hits[0];
        if (!sup)
          return err(
            "No hay ningún proveedor «" +
              text(r.supplierName) +
              "»: pon su NIF o importa antes la hoja de proveedores",
          );
      }

      /* ── la fecha ── */
      var date = ErpImport.toIsoDate(r.date);
      if (!date) return err("«" + label + "»: la fecha «" + text(r.date) + "» no se entiende");
      var due = r.dueDate === "" || r.dueDate == null ? null : ErpImport.toIsoDate(r.dueDate);
      if (text(r.dueDate) && !due)
        return err("«" + label + "»: el vencimiento «" + text(r.dueDate) + "» no se entiende");

      /* ── los importes, como MAGNITUDES; el signo se decide aparte ── */
      var baseC = ErpImport.toCents(r.base);
      if (baseC == null) return err("«" + label + "»: falta la base imponible");
      if (baseC === 0) return err("«" + label + "»: la base imponible es cero");
      var totalC = r.total === "" || r.total == null ? null : ErpImport.toCents(r.total);
      if (text(r.total) && totalC == null)
        return err("«" + label + "»: el total «" + text(r.total) + "» no es un importe");
      if (totalC != null && totalC !== 0 && baseC < 0 !== totalC < 0)
        return err("«" + label + "»: la base y el total tienen signos distintos");

      /* ── EL SIGNO: cada fuente de evidencia vota, y no pueden discrepar ── */
      var votes = [];
      var flags = [];
      var stated = kindOf(r.kind);
      if (stated === "?")
        return err(
          "«" + label + "»: Tipo «" + text(r.kind) + "» — pon Factura, Rectificativa o Vale",
        );
      if (stated) votes.push({ by: "el Tipo", dir: directionOf(stated) });
      if (baseC < 0 || (totalC != null && totalC < 0))
        votes.push({ by: "el importe negativo", dir: "credit" });
      var supRules = rules[squash(sup.taxId)];
      var serieKind = "";
      if (supRules) {
        var keys = [squash(number), squash(ref)].filter(Boolean);
        for (var i = 0; i < supRules.length && !serieKind; i++)
          for (var j = 0; j < keys.length; j++)
            if (keys[j].indexOf(supRules[i].prefix) === 0) {
              serieKind = supRules[i].kind;
              break;
            }
        if (serieKind) votes.push({ by: "la serie", dir: directionOf(serieKind) });
        else flags.push("serie desconocida para este proveedor: entra como factura");
      }
      var dirs = votes.map(function (v) {
        return v.dir;
      });
      if (dirs.indexOf("credit") !== -1 && dirs.indexOf("invoice") !== -1)
        return err(
          "«" +
            label +
            "»: el signo no está claro — " +
            votes
              .map(function (v) {
                return v.by + " dice " + (v.dir === "credit" ? "abono" : "factura");
              })
              .join(", ") +
            ". No se importa: un signo equivocado es el doble del importe al revés",
        );
      var credit = dirs.indexOf("credit") !== -1;
      var docKind = stated || serieKind || (credit ? "credit" : "invoice");
      if (docKind === "invoice" && credit) docKind = "credit";

      /* ── EL IVA: del tipo, comprobado contra el total ── */
      var irpfBp = sup.irpfApplies ? sup.irpfRateBp || 0 : 0;
      var baseAbs = Math.abs(baseC);
      var totalAbs = totalC == null ? null : Math.abs(totalC);
      var totalFor = function (bp) {
        return baseAbs + ErpEngine.pctOf(baseAbs, bp) - ErpEngine.pctOf(baseAbs, irpfBp);
      };
      var vatBp = toVatBp(r.vatRate);
      if (vatBp !== null && isNaN(vatBp))
        return err("«" + label + "»: el IVA «" + text(r.vatRate) + "» no es un porcentaje");
      if (vatBp !== null && rates.indexOf(vatBp) === -1)
        return err(
          "«" +
            label +
            "»: un IVA del " +
            vatBp / 100 +
            " % no está entre los tipos de la empresa (" +
            rates
              .map(function (b) {
                return b / 100 + " %";
              })
              .join(", ") +
            ")",
        );
      /* SIN TIPO ESCRITO, SÓLO SE DEDUCE EL GENERAL.
         La primera versión buscaba entre todos los tipos de la empresa el que
         cuadrara, y el listado real de BigMat la desmintió en la primera
         pasada: dos facturas llevan exactamente seis euros menos que
         base × 1,21 — un descuento después del impuesto — y una de ellas,
         54,55 → 60,01, cuadra al céntimo con un 10 % por pura coincidencia.
         Se aceptaba en silencio como una compra de material al 10 %, que un
         almacén no factura a una empresa. Deducir el tipo GENERAL de una
         cabecera es seguro; deducir uno reducido de la aritmética es como se
         inventa un tipo. Un tipo reducido se escribe, o la fila no entra. */
      var general = rates[0];
      if (vatBp === null) {
        if (totalAbs == null) return err("«" + label + "»: falta el IVA % o el total");
        if (Math.abs(totalFor(general) - totalAbs) <= 1) vatBp = general;
        else {
          var other = rates.filter(function (bp) {
            return bp !== general && Math.abs(totalFor(bp) - totalAbs) <= 1;
          })[0];
          return err(
            "«" +
              label +
              "»: el total " +
              eur(totalAbs) +
              " no sale de la base " +
              eur(baseAbs) +
              " con IVA " +
              general / 100 +
              " %" +
              (irpfBp ? " y la retención del " + irpfBp / 100 + " %" : "") +
              (other != null
                ? ". Cuadra con un " +
                  other / 100 +
                  " %, pero un tipo reducido no se supone: si la factura es a ese tipo, escríbelo en «IVA %»; si no, el total lleva un descuento"
                : " — mira la factura: puede ser un descuento después del impuesto, o llevar dos tipos de IVA desglosados"),
          );
        }
      } else if (totalAbs != null && Math.abs(totalFor(vatBp) - totalAbs) > 1) {
        return err(
          "«" +
            label +
            "»: con IVA " +
            vatBp / 100 +
            " %" +
            (irpfBp ? " y retención " + irpfBp / 100 + " %" : "") +
            " el total sería " +
            eur(totalFor(vatBp)) +
            ", y la hoja dice " +
            eur(totalAbs),
        );
      }

      /* ── ¿ya está en el libro? ¿se repite en la hoja? ──
         Mismo proveedor, algún número en común (fiscal o del proveedor, en
         cualquier cruce) y el MISMO AÑO: un autónomo que numera «7» cada año
         emite dos facturas nº 7 distintas en dos años, y saltarse la segunda
         la perdería en silencio. */
      var keys2 = [squash(number), squash(ref)].filter(Boolean);
      var year = date.slice(0, 4);
      var sameDoc = function (supplierId, n, rf, d) {
        if (supplierId !== sup.id || String(d || "").slice(0, 4) !== year) return false;
        var theirs = [squash(n), squash(rf)].filter(Boolean);
        return keys2.some(function (k) {
          return theirs.indexOf(k) !== -1;
        });
      };
      var prior = bills.filter(function (b) {
        return sameDoc(b.supplierId, b.number, b.supplierDocRef, b.date);
      })[0];
      var sign = credit ? -1 : 1;
      var vatAbs = ErpEngine.pctOf(baseAbs, vatBp);
      if (prior) {
        var differs =
          Math.abs(prior.baseCents - sign * baseAbs) > 1 ? "con otra base en el libro" : "";
        plan.unchanged.push({
          row: r.row,
          number: number,
          supplier: sup.name,
          billId: prior.id,
          differs: differs,
        });
        return;
      }
      var twin = seen.filter(function (s) {
        return sameDoc(s.supplierId, s.number, s.ref, s.date);
      })[0];
      if (twin) return err("«" + label + "» repite la factura de la fila " + twin.row);
      seen.push({ supplierId: sup.id, number: number, ref: ref, date: date, row: r.row });

      if (ref && squash(ref) === squash(number))
        flags.push("el número es la referencia del proveedor: falta el número fiscal");

      plan.creates.push({
        row: r.row,
        supplierId: sup.id,
        supplier: sup.name,
        number: number,
        supplierDocRef: ref,
        date: date,
        dueDate: due,
        kind: docKind,
        sign: sign,
        baseCents: sign * baseAbs,
        vatBp: vatBp,
        vatCents: sign * vatAbs,
        irpfBp: irpfBp,
        totalCents: sign * totalFor(vatBp),
        flags: flags,
      });
    });
    return plan;
  }

  function eur(c) {
    var n = Math.abs(c) / 100;
    var s = n.toFixed(2).replace(".", ",");
    return (c < 0 ? "−" : "") + s.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
  }

  /* ---------- la plantilla ---------- */

  /**
   * Dos pestañas, escritas desde las mismas listas que lee el parser.
   *
   * Los ejemplos son facturas reales de la carpeta del cliente, con sus
   * importes reales, para que la plantilla enseñe los tres casos que una carga
   * ingenua estropea: una factura de BigMat con sus DOS números, una
   * rectificativa de BigMat que sólo la serie delata, y el alquiler, cuyo total
   * no sale de base + IVA porque el arrendador retiene. Si alguien sube la
   * plantilla sin tocar, registra tres facturas que existen, y la segunda vez
   * no registra nada.
   */
  function plantilla() {
    var head = FACTURA_COLUMNS.map(function (c) {
      return c.lab;
    });
    var shead = SERIE_COLUMNS.map(function (c) {
      return c.lab;
    });
    return {
      sheets: [
        {
          name: "Facturas",
          rows: [
            head,
            [
              "B88430459",
              "Estrategias BigMat, S.L.U.",
              "00002-2026/A2101/00014649",
              "ZCO25884582",
              "03/11/2026",
              "Factura",
              "44,53",
              "21",
              "53,88",
              "",
            ],
            [
              "B88430459",
              "Estrategias BigMat, S.L.U.",
              "00003-2026/A2181/00000523",
              "ZCO25893685",
              "04/11/2026",
              "",
              "72,80",
              "21",
              "88,09",
              "",
            ],
            [
              "E16698854",
              "Luengo Sanchez C.B.",
              "7",
              "",
              "01/10/2026",
              "Factura",
              "750,00",
              "21",
              "765,00",
              "",
            ],
          ],
        },
        {
          name: "Series",
          rows: [
            shead,
            ["B88430459", "00002", "Factura"],
            ["B88430459", "00003", "Rectificativa"],
            ["B88430459", "08002", "Rectificativa"],
            ["B88430459", "VAL", "Vale"],
            /* NO «ZVA». Un documento ZVA de BigMat resultó ser una
               rectificativa y otro un ANTICIPO —un pago que la empresa HIZO,
               consumido después por tres facturas—. Ponerlo aquí como abono
               habría cargado 106,84 € pagados como 106,84 € recibidos. Un
               prefijo que significa dos cosas no es una serie. */
          ],
        },
      ],
    };
  }

  /* ---------- actuar sobre un plan ---------- */

  /**
   * Registra las altas del plan. Las ya registradas no se tocan: una factura
   * es un registro contable, y se corrige por sus propias vías (y con el
   * trimestre abierto), no reescribiéndola desde una hoja.
   *
   * Cada fila que el motor refuse entra en `failed` con su motivo y la pasada
   * sigue: ochenta y cinco facturas no se tiran porque la nueve tenga el
   * trimestre cerrado.
   */
  function applyFacturas(erp, plan, user) {
    if (plan.blocked) throw new Error(plan.blocked);
    var done = { created: 0, failed: [] };
    plan.creates.forEach(function (c) {
      try {
        erp.registerBill(
          {
            supplierId: c.supplierId,
            number: c.number,
            supplierDocRef: c.supplierDocRef,
            date: c.date,
            dueDate: c.dueDate,
            baseCents: c.baseCents,
            vatBp: c.vatBp,
            vatCents: c.vatCents,
            allocations: [],
          },
          user,
        );
        done.created++;
      } catch (e) {
        done.failed.push({ row: c.row, number: c.number, msg: e.message });
      }
    });
    return done;
  }

  return {
    FACTURA_COLUMNS: FACTURA_COLUMNS,
    SERIE_COLUMNS: SERIE_COLUMNS,
    parseFacturas: parseFacturas,
    planFacturas: planFacturas,
    applyFacturas: applyFacturas,
    plantilla: plantilla,
    kindOf: kindOf,
    toVatBp: toVatBp,
    eur: eur,
  };
});

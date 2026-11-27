/* =============================================================================
   LOS PROVEEDORES, COMO UNA HOJA SUBIDA.

   Primero los proveedores y después las facturas, y ese orden no es una
   preferencia: **el total de una factura con retención no es verificable sin
   la ficha del proveedor**. El alquiler del cliente lo demuestra en una línea
   — base 750,00, IVA 157,50, IRPF −142,50, total 765,00 — porque la carga de
   cabecera acordada (proveedor, número, base, total) deduciría un IVA de
   15,00 € de la diferencia entre base y total, el banco cuadraría igual, y el
   error viajaría a la gestoría sin que nada lo señalara. `registerBill` ya
   sabe hacerlo bien: toma `irpfBp` del perfil del proveedor cuando la carga no
   lo trae (AP-07). Lo único que le falta es que el perfil exista.

   LEER, PLANEAR, APLICAR — en ese orden y separados a propósito, igual que en
   `erp-book-import.js`. `parseProveedores` lee el fichero, `planProveedores`
   lo compara contra lo que ya hay y devuelve lo que PASARÍA sin tocar nada, y
   sólo `applyProveedores` actúa sobre un plan que al operador ya se le ha
   enseñado. Esa separación es la que permite poner una vista previa delante de
   alguien antes de que una hoja de cálculo reescriba su fichero de contactos.

   TRES REGLAS QUE NO SON OBVIAS Y QUE EL MATERIAL DEL CLIENTE OBLIGÓ A FIJAR:

   1. **Una celda vacía no borra nada.** Significa «no opino», no «déjalo en
      blanco». Es la misma regla que el libro de precios, y aquí importa más:
      la hoja que trae los datos de pago de un proveedor no suele traer su
      dirección, y una importación no puede vaciar el domicilio fiscal de un
      registro que ya facturaba.

   2. **El rótulo de la tienda no es la razón social.** «Obramat» factura como
      Bricolaje Bricoman, S.L.U.; «BigMat La Plataforma Sant Just» factura como
      Estrategias BigMat, S.L.U. Al libro va la razón social; el rótulo se
      guarda como ALIAS, que es el único campo que permite volver a casar este
      registro contra una subida futura — y es por donde la clienta lo va a
      buscar, porque es el nombre que ella usa.

   3. **Los roles se suman, nunca se sustituyen.** Un proveedor que además es
      cliente no deja de serlo porque una hoja de proveedores lo mencione.
      Misma razón por la que `setItemPartidas` recibe la UNIÓN.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./erp-import.js"), require("./erp-engine.js"));
  else root.ErpSupplierImport = factory(root.ErpImport, root.ErpEngine);
})(typeof globalThis !== "undefined" ? globalThis : this, function (ErpImport, ErpEngine) {
  "use strict";

  /* El validador de NIF/CIF vive en el MÓDULO del motor, no en la instancia —
     `erp.validTaxId` es `undefined` y un guardia escrito contra él convertiría
     cada fila de la hoja en un error. Se toma de aquí, que es el mismo código
     que `addParty` ejecutará después: si esto acepta una fila, el alta no la
     va a refusar por el NIF. */
  var validTaxId = ErpEngine.validTaxId;
  var taxIdKind = ErpEngine.taxIdKind;

  /* ---------- la cabecera, que es también la plantilla ---------- */

  /**
   * `key` es lo que lee el planificador; `lab` es lo que muestra Excel.
   *
   * No está «Nº de cliente nuestro», que sí existe en la hoja de la clienta.
   * No hay campo para él en la ficha y añadir uno pide una migración que esta
   * carga no justifica, así que entra en las notas y sólo al CREAR: en una
   * actualización no se toca, que es lo que mantiene la segunda pasada
   * idéntica a la primera.
   */
  var PROVEEDOR_COLUMNS = [
    { key: "name", lab: "Razón social" },
    { key: "taxId", lab: "NIF/CIF" },
    { key: "tradeName", lab: "Nombre comercial" },
    { key: "kind", lab: "Tipo" },
    { key: "street", lab: "Domicilio" },
    { key: "postalCode", lab: "C.P." },
    { key: "city", lab: "Población" },
    { key: "province", lab: "Provincia" },
    { key: "country", lab: "País" },
    { key: "phone", lab: "Teléfono" },
    { key: "email", lab: "Email" },
    { key: "terms", lab: "Días de pago" },
    { key: "irpf", lab: "Retención IRPF %" },
    { key: "clientNo", lab: "Nº de cliente" },
    { key: "category", lab: "Categoría" },
    { key: "notes", lab: "Notas" },
  ];

  /** Lo que la columna «Tipo» significa para el fichero de contactos. */
  var KINDS = {
    proveedor: "supplier",
    subcontrata: "subcontractor",
    autonomo: "selfEmployed",
    autónomo: "selfEmployed",
  };

  /* ---------- texto ---------- */

  /* Sin acentos, sin mayúsculas, espacios colapsados. Esto es lo que significa
     «ya existe» para cada comparación de nombre de aquí abajo: «Saltoki
     Cornellà» y «SALTOKI CORNELLA» son un proveedor, porque quien teclea la
     segunda hoja no reproduce los acentos de la primera. */
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
  /** Igual que `normTaxId` del motor: sólo letras y dígitos, en mayúsculas. */
  function normTaxId(v) {
    return String(v == null ? "" : v)
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "");
  }

  /**
   * UN PORCENTAJE, DISTINGUIENDO «VACÍO» DE «CERO».
   *
   * Los dos existen y no significan lo mismo: vacío es «esta hoja no habla de
   * la retención» y en una actualización no toca nada; un cero explícito es
   * «este proveedor NO retiene» y sí la apaga. Devuelve null para el vacío y
   * puntos básicos para todo lo demás, que es como el motor guarda `irpfRateBp`.
   */
  function toBp(v) {
    var s = text(v).replace(/%/g, "").replace(/\s/g, "");
    if (!s) return null;
    s = s.replace(",", ".");
    var n = Number(s);
    if (!isFinite(n) || n < 0 || n > 100) return NaN;
    return Math.round(n * 100);
  }

  /** Un entero de días, o null si la celda no dice nada. */
  function toDays(v) {
    var s = text(v).replace(/[^0-9-]/g, "");
    if (!s) return null;
    var n = parseInt(s, 10);
    return isFinite(n) && n >= 0 ? n : NaN;
  }

  /**
   * LA FORMA JURÍDICA, DEDUCIDA DEL SUFIJO DE LA RAZÓN SOCIAL.
   *
   * `addParty` crea todo como «individual», que es falso para cualquier
   * sociedad y lo sería para los seis proveedores reales de este cliente. El
   * sufijo lo dice sin ambigüedad y es parte del nombre legal, no una
   * suposición sobre el negocio: «S.L.», «S.A.» y «S.L.U.» son sociedades;
   * «C.B.» es una comunidad de bienes — y una de las facturas del cliente, la
   * del alquiler, viene justamente de una C.B. Sin sufijo reconocible se deja
   * como persona física, que es lo que es un autónomo.
   *
   * Sólo afecta a cómo se clasifica y se muestra la ficha; ninguna aritmética
   * cuelga de esto. Si alguna sale mal, se corrige en Contactos en un clic.
   */
  function toPartyType(name) {
    var f = fold(name).replace(/[.,]/g, "");
    if (/\b(sl|sa|slu|sau|slp|sccl|scp|sl unipersonal)\b/.test(f)) return "company";
    if (/\b(cb|comunidad de bienes|comunitat de bens)\b/.test(f)) return "community";
    if (/\b(ayuntamiento|ajuntament|generalitat|diputacion|consorcio)\b/.test(f))
      return "publicBody";
    return "individual";
  }

  /* ---------- leer ---------- */

  function findHeader(raw) {
    for (var i = 0; i < raw.length && i < 50; i++) {
      var row = raw[i] || [];
      var col = {};
      for (var c = 0; c < row.length; c++) {
        var f = fold(row[c]);
        if (!f) continue;
        for (var k = 0; k < PROVEEDOR_COLUMNS.length; k++)
          if (col[PROVEEDOR_COLUMNS[k].key] == null && fold(PROVEEDOR_COLUMNS[k].lab) === f)
            col[PROVEEDOR_COLUMNS[k].key] = c;
      }
      /* Razón social y NIF: las dos que identifican la fila. Con una sola no
         hay cabecera — una hoja cualquiera con una columna «Nombre» no es
         una hoja de proveedores. */
      if (col.name != null && col.taxId != null) return { rowIndex: i, col: col };
    }
    return null;
  }

  function readSheet(raw) {
    var head = findHeader(raw);
    if (!head)
      throw new Error(
        "No encuentro la fila de encabezados. Descarga la plantilla y usa sus columnas: " +
          PROVEEDOR_COLUMNS.map(function (c) {
            return c.lab;
          }).join(", "),
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
      for (var k = 0; k < PROVEEDOR_COLUMNS.length; k++) {
        var cix = head.col[PROVEEDOR_COLUMNS[k].key];
        rec[PROVEEDOR_COLUMNS[k].key] = cix == null ? "" : text(r[cix]);
      }
      out.push(rec);
    }
    return { rows: out, headerRowIndex: head.rowIndex };
  }

  function parseProveedores(buffer) {
    return ErpImport.parseXlsxRows(buffer).then(function (raw) {
      return readSheet(raw);
    });
  }

  /* ---------- lo que el fichero HARÍA ---------- */

  /** Los campos de la ficha que esta hoja puede tocar, y de qué columna salen. */
  var FIELD_OF = {
    name: "name",
    taxId: "taxId",
    street: "billStreet",
    postalCode: "billPostalCode",
    city: "billCity",
    province: "billProvince",
    country: "billCountry",
    email: "email",
    category: "category",
  };

  /**
   * Compara la hoja contra el fichero de contactos y devuelve lo que pasaría.
   *
   * Cada fila acaba en exactamente una de cuatro cestas: `creates`, `updates`
   * (con el detalle campo a campo, viejo y nuevo, para que la vista previa lo
   * pueda enseñar), `unchanged` y `errors`. Que «sin cambios» sea una cesta
   * propia y no un update vacío es lo que hace honesta la segunda pasada: subir
   * el mismo fichero dos veces tiene que decir «no hay nada que hacer», no
   * «dieciséis actualizaciones» de nada.
   */
  function planProveedores(erp, rows) {
    var plan = { creates: [], updates: [], unchanged: [], errors: [] };
    var parties = (erp.state && erp.state.parties) || [];

    /* Índices sobre lo que YA hay. El del NIF manda: es la identidad fiscal y
       es además lo único que el lector de documentos acierta de forma fiable. */
    var byTax = {};
    var byName = {};
    parties.forEach(function (p) {
      var t = normTaxId(p.taxId);
      if (t && byTax[t] == null) byTax[t] = p;
      var n = fold(p.name);
      if (n && byName[n] == null) byName[n] = p;
      (p.aliases || []).forEach(function (a) {
        var fa = fold(a);
        if (fa && byName[fa] == null) byName[fa] = p;
      });
    });

    /* Y sobre la propia hoja, porque una hoja puede contradecirse a sí misma y
       es mejor decirlo que aplicar la última fila y callar. */
    var seenTax = {};

    rows.forEach(function (r) {
      var name = text(r.name);
      var taxId = normTaxId(r.taxId);
      if (!name) return plan.errors.push({ row: r.row, msg: "Falta la razón social" });
      if (!taxId)
        return plan.errors.push({
          row: r.row,
          msg: "«" + name + "» no trae NIF/CIF — sin él no se puede casar ninguna factura con él",
        });
      if (!validTaxId(taxId))
        return plan.errors.push({
          row: r.row,
          msg: "«" + name + "»: NIF/CIF no válido (" + taxId + ") — " + whyBadTaxId(taxId),
        });
      if (seenTax[taxId])
        return plan.errors.push({
          row: r.row,
          msg: "«" + name + "» repite el NIF de la fila " + seenTax[taxId],
        });
      seenTax[taxId] = r.row;

      var bp = toBp(r.irpf);
      if (bp !== null && isNaN(bp))
        return plan.errors.push({
          row: r.row,
          msg: "«" + name + "»: la retención «" + r.irpf + "» no es un porcentaje",
        });
      var days = toDays(r.terms);
      if (days !== null && isNaN(days))
        return plan.errors.push({
          row: r.row,
          msg: "«" + name + "»: los días de pago «" + r.terms + "» no son un número",
        });
      var role = r.kind ? KINDS[fold(r.kind)] : "supplier";
      if (!role)
        return plan.errors.push({
          row: r.row,
          msg: "«" + name + "»: Tipo «" + r.kind + "» — pon Proveedor, Subcontrata o Autónomo",
        });

      var hit = byTax[taxId];
      if (!hit) {
        /* Sin NIF que case: ¿hay alguien con este mismo nombre? Si lo hay y
           lleva OTRO NIF, son dos cosas distintas o una está mal, y en los dos
           casos lo que no se puede hacer es crear un segundo registro en
           silencio — MDM-03 refusaría el alta más adelante, pero lo haría en
           mitad de la pasada y sin decir cuál era. Si el que existe no tiene
           NIF, esta hoja es justo lo que le faltaba. */
        var same = byName[fold(name)] || byName[fold(r.tradeName)];
        if (same && normTaxId(same.taxId) && normTaxId(same.taxId) !== taxId)
          return plan.errors.push({
            row: r.row,
            msg:
              "«" +
              name +
              "» ya existe con otro NIF (" +
              same.taxId +
              ", " +
              same.code +
              ") — revisa cuál es el bueno",
          });
        if (same) hit = same;
      }

      if (!hit) {
        plan.creates.push({
          row: r.row,
          name: name,
          taxId: taxId,
          role: role,
          partyType: toPartyType(name),
          fields: buildFields(r, taxId),
          phone: text(r.phone),
          aliases: aliasesOf(r, name),
          irpfBp: bp,
          termsDays: days,
          clientNo: text(r.clientNo),
          notes: text(r.notes),
        });
        return;
      }

      /* Ya existe: sólo lo que la hoja DICE y además es DISTINTO. */
      var changes = [];
      var fields = buildFields(r, taxId);
      Object.keys(fields).forEach(function (f) {
        var now = text(hit[f]);
        if (fields[f] !== now) changes.push({ field: f, from: now, to: fields[f] });
      });
      if (bp !== null) {
        var wasBp = hit.irpfApplies ? hit.irpfRateBp || 0 : 0;
        if (wasBp !== bp)
          changes.push({ field: "irpfRateBp", from: String(wasBp), to: String(bp) });
      }
      var ph = phoneField(r.phone);
      if (ph && text(hit[ph.field]) !== ph.value)
        changes.push({ field: ph.field, from: text(hit[ph.field]), to: ph.value });
      if (days !== null && (hit.supplierTermsDays || 0) !== days)
        changes.push({
          field: "supplierTermsDays",
          from: String(hit.supplierTermsDays || 0),
          to: String(days),
        });
      var newRoles = (hit.roles || []).indexOf(role) === -1 ? [role] : [];
      if (newRoles.length)
        changes.push({ field: "roles", from: (hit.roles || []).join("+"), to: role });
      var newAliases = aliasesOf(r, name).filter(function (a) {
        if (fold(a) === fold(hit.name)) return false;
        return (hit.aliases || []).every(function (x) {
          return fold(x) !== fold(a);
        });
      });
      if (newAliases.length)
        changes.push({
          field: "aliases",
          from: (hit.aliases || []).join(", "),
          to: newAliases.join(", "),
        });

      var entry = {
        row: r.row,
        id: hit.id,
        code: hit.code,
        name: hit.name,
        changes: changes,
        fields: fields,
        phone: text(r.phone),
        role: newRoles.length ? role : "",
        aliases: newAliases,
        irpfBp: bp,
        termsDays: days,
      };
      if (changes.length) plan.updates.push(entry);
      else plan.unchanged.push(entry);
    });
    return plan;
  }

  /** Los campos planos de la ficha que esta fila rellena, los vacíos fuera. */
  function buildFields(r, taxId) {
    var out = {};
    Object.keys(FIELD_OF).forEach(function (k) {
      var v = k === "taxId" ? taxId : text(r[k]);
      if (v) out[FIELD_OF[k]] = v;
    });
    return out;
  }

  /**
   * El teléfono no tiene columna propia en la ficha: hay fijo y hay móvil.
   *
   * Un número que empieza por 6 o 7 en España es móvil y cualquier otro es
   * fijo. `partyCompleteness` pide UNO de los dos, no los dos, así que acertar
   * cuál importa poco; lo que importa es que no se quede sin ninguno, que es
   * lo que deja la ficha incompleta y bloquea MDM-10.
   */
  function phoneField(v) {
    var digits = String(v == null ? "" : v).replace(/[^0-9]/g, "");
    if (!digits) return null;
    var local = digits.replace(/^34/, "");
    return { field: /^[67]/.test(local) ? "mobile" : "landline", value: text(v) };
  }

  /**
   * Por qué se refusa un NIF, en una frase.
   *
   * El motor tiene un `taxIdReason` mucho mejor — dice qué letra debería
   * llevar — pero no lo exporta; sólo `taxIdKind`. Antes que no decir nada,
   * esto distingue las dos cosas que le pasan a un NIF en una hoja: el
   * formato no se reconoce, o se reconoce y el dígito de control no sale.
   * La segunda es casi siempre un dígito mal copiado de una factura.
   */
  function whyBadTaxId(taxId) {
    var kind = taxIdKind ? taxIdKind(taxId) : "";
    if (/-bad$/.test(String(kind)))
      return "el formato es correcto pero el dígito de control no corresponde; revísalo en la factura";
    return "no reconozco el formato (DNI, NIE, CIF o NIF intracomunitario)";
  }

  function aliasesOf(r, name) {
    var t = text(r.tradeName);
    if (!t || fold(t) === fold(name)) return [];
    return [t];
  }

  /* ---------- la plantilla, escrita desde la misma lista ---------- */

  /**
   * La plantilla sale de `PROVEEDOR_COLUMNS`, que es la lista que lee el
   * parser, de modo que el fichero que el operador se descarga y el fichero
   * que esto lee no pueden separarse nunca.
   *
   * Las filas de ejemplo son los proveedores reales del cliente, con su razón
   * social y su CIF verdaderos, porque una plantilla con «Proveedor Ejemplo
   * S.L.» se rellena mal: el error que se repite es poner el rótulo de la
   * tienda donde va la razón social, y la única manera de enseñarlo es
   * enseñarlo. La fila del alquiler lleva su 19 % de retención, que es el
   * caso que la carga de facturas no puede deducir sola.
   */
  function plantilla() {
    var head = PROVEEDOR_COLUMNS.map(function (c) {
      return c.lab;
    });
    return {
      name: "Proveedores",
      rows: [
        head,
        [
          "Estrategias BigMat, S.L.U.",
          "B88430459",
          "BigMat La Plataforma Sant Just",
          "Proveedor",
          "Av. de los Pirineos 7, planta 1",
          "28703",
          "San Sebastián de los Reyes",
          "Madrid",
          "España",
          "933788340",
          "",
          "30",
          "",
          "56619894",
          "Material de construcción",
          "",
        ],
        [
          "Bricolaje Bricoman, S.L.U.",
          "B84406289",
          "Obramat Badalona",
          "Proveedor",
          "C/ Margarita Salas 6",
          "28919",
          "Leganés",
          "Madrid",
          "España",
          "934003131",
          "",
          "30",
          "",
          "",
          "Material de construcción",
          "",
        ],
        [
          "Luengo Sanchez C.B.",
          "E16698854",
          "",
          "Proveedor",
          "Vial Doctor Josep Mª Tarruella 20",
          "08753",
          "Pallejà",
          "Barcelona",
          "España",
          "",
          "",
          "30",
          "19",
          "",
          "Alquiler",
          "Retiene IRPF: el total de su factura no sale de base + IVA",
        ],
      ],
    };
  }

  /* ---------- actuar sobre un plan ---------- */

  /**
   * Aplica un plan de proveedores. Devuelve lo que hizo, contado.
   *
   * `addParty` valida el NIF y refusa un duplicado activo (MDM-03), así que
   * esto no vuelve a comprobarlo: el planificador ya ha separado altas de
   * actualizaciones y lo que llegue aquí como alta es, por construcción, un
   * NIF que nadie tiene. Si el motor refusa igualmente, la fila entra en
   * `failed` con su motivo y la pasada sigue — una hoja de treinta
   * proveedores no se tira a la basura porque la fila nueve esté mal.
   */
  function applyProveedores(erp, plan, user) {
    var done = { created: 0, updated: 0, failed: [] };

    plan.creates.forEach(function (c) {
      try {
        var p = Object.assign({}, c.fields, {
          roles: [c.role],
          partyType: c.partyType,
          aliases: c.aliases,
          sourceSystem: "Importación de proveedores",
        });
        if (c.irpfBp !== null) {
          p.irpfApplies = c.irpfBp > 0;
          p.irpfRateBp = c.irpfBp;
        }
        if (c.termsDays !== null) p.supplierTermsDays = c.termsDays;
        var ph = phoneField(c.phone);
        if (ph) p[ph.field] = ph.value;
        /* El número de cliente sólo al crear: ver PROVEEDOR_COLUMNS. */
        var notes = [c.notes, c.clientNo ? "Nº de cliente: " + c.clientNo : ""]
          .filter(Boolean)
          .join(" · ");
        if (notes) p.notes = notes;
        erp.addParty(p, user);
        done.created++;
      } catch (e) {
        done.failed.push({ row: c.row, name: c.name, msg: e.message });
      }
    });

    plan.updates.forEach(function (u) {
      try {
        var patch = Object.assign({}, u.fields);
        /* El nombre NO se reescribe desde la hoja cuando el registro ya
           existe. Casamos por NIF, y un NIF que casa con otra razón social
           significa que el nombre cambió o que la hoja lo trae peor escrito;
           ninguna de las dos es razón para renombrar un contacto por el que ya
           pasan facturas. El nombre de la hoja entra como ALIAS, que es donde
           no estorba y donde además sirve para volver a casarlo. */
        delete patch.name;
        if (u.irpfBp !== null) {
          patch.irpfApplies = u.irpfBp > 0;
          patch.irpfRateBp = u.irpfBp;
        }
        if (u.termsDays !== null) patch.supplierTermsDays = u.termsDays;
        var uph = phoneField(u.phone);
        if (uph) patch[uph.field] = uph.value;
        var cur = erp.party(u.id);
        if (u.role) patch.roles = (cur.roles || []).concat([u.role]);
        if (u.aliases.length) patch.aliases = (cur.aliases || []).concat(u.aliases);
        erp.updateParty(u.id, patch, user);
        done.updated++;
      } catch (e) {
        done.failed.push({ row: u.row, name: u.name, msg: e.message });
      }
    });

    return done;
  }

  return {
    PROVEEDOR_COLUMNS: PROVEEDOR_COLUMNS,
    parseProveedores: parseProveedores,
    planProveedores: planProveedores,
    applyProveedores: applyProveedores,
    plantilla: plantilla,
    toPartyType: toPartyType,
    toBp: toBp,
    toDays: toDays,
    fold: fold,
  };
});

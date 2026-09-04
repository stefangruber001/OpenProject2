/* =============================================================================
   CaneiDocTypes — one descriptor per document the ERP produces.

   WHY THIS FILE EXISTS. The approved redesign covers twenty documents, and
   before this file the ERP could generate three of them. The other seventeen
   existed as HTML the designer produced and nothing in the system could emit.
   Anyone needing a contract or a progress valuation was going to build it
   somewhere else, in some other layout, and the "one design" the operator
   approved would have lasted a fortnight.

   WHAT IT IS. A descriptor is data: it turns a facts object into the shape
   `CaneiPdf.build()` already takes. No drawing happens here and no layout
   decisions are made here — the writer owns those, and it owns them once. A
   new document type is a new entry in DOCS, not an edit to the writer.

   NAMED erp-doctypes AND NOT erp-documents. `site/erp-docs.js` already exists
   and is the STORAGE layer (IndexedDB, or the company's copy on the server).
   Two modules a letter apart, one about storing records and one about printing
   paper, would be confused permanently.

   ENGINE-FED AND PLACEHOLDER-FED. Nine of the seventeen have real data behind
   them today; four do not (change order, delivery note, timesheet, handover),
   and their inputs come from a form. `placeholder: true` marks those in the
   descriptor rather than in a comment, so a caller can ask, and so a figure's
   provenance is never ambiguous — an invented number that looks measured is
   worse than a blank.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CaneiDocTypes = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ------------------------------------------------------------- formatting
   * Money is formatted here rather than with Intl, and deliberately: these
   * documents are legal and accounting artifacts for one company in one place,
   * and their number format must not change because the reader's browser is
   * set to a different region. A euro total that renders as "10,407.80" to one
   * recipient and "10.407,80" to another is a dispute waiting to happen. */
  function eur(cents) {
    const n = Math.round(Number(cents) || 0);
    const neg = n < 0;
    const s = String(Math.abs(n)).padStart(3, "0");
    const whole = s.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-" : "") + whole + "," + s.slice(-2) + " €";
  }
  const pct = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(0) + " %";

  /** Every descriptor gets the same party pair unless it says otherwise. */
  function parties(f, rightLabel) {
    return [
      {
        label: "Contratista",
        name: f.company.legal,
        lines: [f.company.nif, f.company.address, f.company.email],
      },
      {
        label: rightLabel || "Cliente",
        name: f.customer.name,
        /* The phone joins the block (Package 8 review, 28/08): whoever picks
           the document up should be able to ring the customer from it rather
           than looking them up on another screen. Falsy entries are dropped
           downstream, so a customer with no mobile simply has one line
           fewer — nothing prints an empty row. */
        lines: [
          f.customer.nif,
          f.customer.contact,
          f.customer.address,
          f.customer.phone,
          f.customer.email,
        ],
      },
    ];
  }

  function supplierParties(f) {
    return [
      {
        label: "Comprador",
        name: f.company.legal,
        lines: [f.company.nif, f.company.address, f.company.email],
      },
      {
        label: "Proveedor",
        name: f.supplier.name,
        lines: [f.supplier.nif, f.supplier.contact, f.supplier.address, f.supplier.email],
      },
    ];
  }

  /** Chapters as the writer's table groups. */
  function chapterGroups(f) {
    return f.chapters.map((c) => ({
      chapter: c.code + " · " + c.name,
      rows: c.rows.map((r) => ({
        item: r.item,
        // Carried through so the writer can draw the line's plate and print
        // its code — the two things that let a reader check the picture.
        code: r.code || "",
        chapter: r.chapter || c.code || "",
        note: r.note || "",
        qtyLabel: r.qty,
        unit: r.unit || "",
        priceLabel: eur(r.price),
        amount: eur(r.amount),
        // The presentation hints a caller may attach: the annex mark on a row
        // whose picture waits at the back, and a ready-made plate from a host
        // that knows the catalogue. Writers that don't draw them ignore them.
        pictogram: r.pictogram,
        flag: r.flag,
        plateHtml: r.plateHtml,
      })),
      subtotal: eur(c.rows.reduce((s, r) => s + r.amount, 0)),
    }));
  }

  const chapterTotal = (c) => c.rows.reduce((s, r) => s + r.amount, 0);
  const baseOf = (f) => f.chapters.reduce((s, c) => s + chapterTotal(c), 0);

  /** Base, tax, withholding, total — the same four lines in the same order. */
  function taxTotals(f, base) {
    const b = base === undefined ? baseOf(f) : base;
    const tax = Math.round((b * f.taxRate) / 100);
    const wh = f.withholdingRate ? Math.round((b * f.withholdingRate) / 100) : 0;
    const rows = [
      ["Base imponible", eur(b)],
      ["Impuesto " + f.taxRate + " %", eur(tax)],
    ];
    if (wh) rows.push(["Retencion -" + f.withholdingRate + " %", eur(-wh)]);
    rows.push(["Total", eur(b + tax - wh)]);
    return { rows, base: b, tax, wh, total: b + tax - wh };
  }

  /* ============================================================ descriptors */

  const DOCS = {
    /* ---- 01 · client ---------------------------------------------------- */

    presupuesto: {
      title: "Presupuesto",
      audience: "cliente",
      template: "01-cliente/01-presupuesto.html",
      build(f) {
        const t = taxTotals(f);
        return {
          docType: "PRESUPUESTO",
          number: f.numbers.quote,
          audience: "cliente",
          title: "Presupuesto de obra",
          /* WHAT THE JOB IS, then where it is. The heading used to be the
             site address alone, so two quotes to one customer for two
             different jobs were told apart only by their number. The
             description is the customer's own words for what they asked
             for; it falls back to the address when nothing said otherwise,
             which is what this line always printed. */
          subtitle: f.project.workName
            ? f.project.workName + " · " + f.project.site
            : f.project.site,
          meta: [
            ["Fecha", f.dates.issued],
            ["Valido hasta", f.dates.validUntil],
            ["Version", f.project.version],
            ["Contacto", f.company.phone],
          ],
          /* The plazo is APPENDED, not swapped in for the project code. The
             strip is `display:flex; flex-wrap:wrap` with a row-gap, so a
             fifth entry wraps onto a second line rather than overflowing —
             checked in erp-sheet.js rather than assumed, and both the
             printable-margin gate and the PDF writer's pagination gate agree.
             The operator asked for the plazo to be added; nothing asked for
             the project reference to stop being printed.

             Absent when nobody stated one: a promise nobody made must not
             appear on a quote, least of all as a zero. */
          facts: [
            ["Base (sin impuesto)", eur(t.base)],
            ["Partidas", String(f.chapters.length)],
            ["Validez", f.project.validityDays + " dias"],
            ["Proyecto", f.project.code],
          ].concat(
            f.project.executionDays
              ? [["Plazo de ejecucion", f.project.executionDays + " dias"]]
              : [],
          ),
          parties: parties(f),
          groups: chapterGroups(f),
          sections: [
            {
              type: "table",
              label: "Detalle por partidas",
              note: "precios unitarios sin impuesto",
            },
            { type: "totals" },
          ],
          totals: t.rows,
          payment: [
            "Los trabajos opcionales solo se incluyen si los acepta por escrito.",
            "El impuesto se aplica en la factura final segun la regla legal aplicable.",
          ],
          notes: [
            "Precios validos " + f.project.validityDays + " dias desde la fecha de emision.",
            "Este presupuesto se convierte en su proyecto con una linea base fija.",
            "Garantia de 2 anos sobre los trabajos.",
          ],
          signatures: ["Por " + f.company.legal, "Conforme - el cliente (firma y fecha)"],
        };
      },
    },

    presupuestoAceptado: {
      title: "Presupuesto aceptado",
      audience: "cliente",
      template: "01-cliente/02-presupuesto-aceptado.html",
      build(f) {
        const d = DOCS.presupuesto.build(f);
        d.docType = "PRESUPUESTO ACEPTADO";
        d.title = "Presupuesto aceptado - version congelada";
        d.meta = [
          ["Aceptado", f.dates.accepted],
          ["Version", f.project.version],
          ["Proyecto", f.project.code],
          ["Contacto", f.company.phone],
        ];
        d.notes = [
          "Version congelada. Cualquier cambio posterior se documenta como orden de cambio.",
          "Aceptado por " + f.customer.contact + " el " + f.dates.accepted + ".",
        ].concat(d.notes.slice(2));
        return d;
      },
    },

    /* THE ADICIONAL, and what makes it its own document rather than a second
       quote: every row is a DIFFERENCE. A customer who is handed the whole
       revised scope has to diff two papers to find what they are agreeing to;
       this one says «ADI-2026-0001», names the quote it revises, and its total
       is the amount the contract grows by. */
    adicional: {
      title: "Adicional",
      audience: "cliente",
      template: "01-cliente/01-presupuesto.html",
      build(f) {
        const t = taxTotals(f);
        const a = f.adicional || {};
        return {
          docType: "ADICIONAL",
          number: f.numbers.quote,
          audience: "cliente",
          title: "Adicional al presupuesto",
          subtitle: a.reason || f.project.workName || f.project.site,
          meta: [
            ["Fecha", f.dates.issued],
            ["Sobre el presupuesto", a.ofNumber || "—"],
            ["Version revisada", a.ofVersion || "—"],
            ["Contacto", f.company.phone],
          ],
          facts: [
            ["Base (sin impuesto)", eur(t.base)],
            ["Partidas afectadas", String(f.chapters.length)],
            ["Proyecto", f.project.code],
          ].concat(a.days ? [["Plazo adicional", a.days + " dias"]] : []),
          parties: parties(f),
          groups: chapterGroups(f),
          sections: [
            {
              type: "table",
              label: "Cambios sobre el presupuesto aceptado",
              note: "cantidades e importes son la diferencia, no el total",
            },
            { type: "totals" },
          ],
          totals: t.rows,
          payment: [
            "Este adicional se suma al contrato en vigor y se cobra como un hito propio.",
            "El impuesto se aplica en la factura final segun la regla legal aplicable.",
          ],
          notes: [
            "Las cantidades e importes de esta hoja son la DIFERENCIA sobre el presupuesto aceptado.",
            "El presupuesto original se conserva sin cambios y sigue siendo consultable.",
          ].concat(a.days ? ["La fecha de fin de obra se amplia en " + a.days + " dias."] : []),
          signatures: ["Por " + f.company.legal, "Conforme - el cliente (firma y fecha)"],
        };
      },
    },

    contrato: {
      title: "Contrato de obra",
      audience: "cliente",
      template: "01-cliente/03-contrato-obra.html",
      build(f) {
        const t = taxTotals(f);
        return {
          docType: "CONTRATO DE OBRA",
          number: f.numbers.contract,
          audience: "cliente",
          title: "Contrato de ejecucion de obra",
          subtitle: f.project.description + " · " + f.project.site,
          meta: [
            ["Fecha", f.dates.issued],
            ["Presupuesto", f.numbers.quote + " v" + f.project.version],
            ["Proyecto", f.project.code],
            ["Anexos", "I · Presupuesto - II · Planificacion"],
          ],
          facts: [
            ["Total contratado", eur(t.total)],
            ["Base imponible", eur(t.base)],
            ["Inicio", f.dates.start],
            ["Entrega prevista", f.dates.due],
          ],
          parties: parties(f, "Promotor / Cliente"),
          intro:
            "Ejecucion de " +
            f.project.description +
            " en " +
            f.project.site +
            ", conforme al presupuesto " +
            f.numbers.quote +
            " version " +
            f.project.version +
            ", que se adjunta como Anexo I y forma parte inseparable de este contrato.",
          sections: [
            {
              type: "band",
              label: "Precio y forma de pago",
              note: f.milestones.length + " hitos · transferencia a " + f.company.iban,
            },
            { type: "milestones", rows: f.milestones },
            { type: "totals" },
            { type: "band", label: "Alcance contratado" },
            { type: "table" },
            { type: "band", label: "Condiciones particulares" },
            { type: "kvGrid", cols: 2, rows: f.contractTerms },
          ],
          groups: chapterGroups(f),
          totals: t.rows,
          payment: [
            "Transferencia a " + f.company.iban + " en los hitos indicados.",
            "Demora en el pago: interes legal del dinero desde el vencimiento.",
          ],
          notes: [
            "Plazo de ejecucion: " + f.dates.start + " a " + f.dates.due + ".",
            "Garantia de 2 anos sobre los trabajos ejecutados.",
            "Cualquier modificacion del alcance requiere orden de cambio firmada.",
          ],
          signatures: ["Por " + f.company.legal, "Por " + f.customer.name + " (firma y fecha)"],
        };
      },
    },

    ordenCambio: {
      title: "Orden de cambio",
      audience: "cliente",
      placeholder: true,
      template: "01-cliente/04-orden-de-cambio.html",
      build(f) {
        const base = f.change.rows.reduce((s, r) => s + r.amount, 0);
        const t = taxTotals(f, base);
        return {
          docType: "ORDEN DE CAMBIO",
          number: f.numbers.changeOrder,
          audience: "cliente",
          title: "Orden de cambio al contrato " + f.numbers.contract,
          subtitle: f.change.reason,
          meta: [
            ["Fecha", f.dates.issued],
            ["Contrato", f.numbers.contract],
            ["Proyecto", f.project.code],
            ["Orden", f.change.ordinal],
          ],
          facts: [
            ["Importe del cambio", eur(t.total)],
            ["Base", eur(t.base)],
            ["Plazo adicional", f.change.extraDays + " dias"],
            ["Estado", f.change.state],
          ],
          parties: parties(f),
          intro:
            "Este documento modifica el alcance contratado. No se ejecuta ningun trabajo " +
            "incluido aqui hasta que ambas partes lo firmen.",
          sections: [
            { type: "band", label: "Trabajos anadidos o suprimidos" },
            { type: "lines" },
            { type: "totals" },
            { type: "band", label: "Efecto sobre el contrato" },
            { type: "kvGrid", cols: 2, rows: f.change.effect },
          ],
          lines: f.change.rows.map((r) => ({ desc: r.item, amount: eur(r.amount) })),
          totals: t.rows,
          notes: [
            "El plazo de entrega se amplia en " + f.change.extraDays + " dias naturales.",
            "El resto de condiciones del contrato permanece sin cambios.",
          ],
          signatures: [
            "Por " + f.company.legal,
            "Conforme - " + f.customer.name + " (firma y fecha)",
          ],
        };
      },
    },

    certificacion: {
      title: "Progress valuation",
      audience: "cliente",
      template: "01-cliente/05-certificacion-obra.html",
      build(f) {
        const period = f.valuation.rows.reduce((s, r) => s + r.periodAmount, 0);
        const t = taxTotals(f, period);
        const toDate = f.valuation.rows.reduce((s, r) => s + r.toDateAmount, 0);
        return {
          docType: "CERTIFICACION",
          number: f.numbers.valuation,
          audience: "cliente",
          title: "Certificacion n " + f.valuation.ordinal + " de obra ejecutada",
          subtitle: f.project.site,
          meta: [
            ["Periodo", f.valuation.period],
            ["Proyecto", f.project.code],
            ["Contrato", f.numbers.contract],
            ["Certificacion", "N " + f.valuation.ordinal],
          ],
          facts: [
            ["A facturar", eur(t.total)],
            ["Avance global", pct(f.valuation.overallPct)],
            ["Ejecutado a origen", eur(toDate)],
            ["Periodo", f.valuation.period],
          ],
          parties: parties(f),
          sections: [
            {
              type: "band",
              label: "Avance por partida",
              note: "porcentaje ejecutado sobre lo contratado",
            },
            {
              type: "progressBars",
              label: "PARTIDA",
              rows: f.valuation.rows.map((r) => ({
                label: r.chapter,
                pct: r.currentPct,
                amount: eur(r.toDateAmount),
                note:
                  "contratado " +
                  eur(r.contracted) +
                  " · anterior " +
                  pct(r.previousPct) +
                  " · en este periodo " +
                  eur(r.periodAmount),
              })),
            },
            { type: "band", label: "Importe a certificar en este periodo" },
            { type: "lines" },
            { type: "totals" },
          ],
          lines: f.valuation.rows
            .filter((r) => r.periodAmount)
            .map((r) => ({ desc: r.chapter, amount: eur(r.periodAmount) })),
          totals: t.rows,
          notes: [
            "La certificacion mide obra ejecutada, no obra facturada.",
            "Se factura por separado con referencia a esta certificacion.",
          ],
          signatures: ["Jefe de obra", "Conforme - direccion facultativa"],
        };
      },
    },

    factura: {
      title: "Factura",
      audience: "cobro",
      template: "01-cliente/06-factura.html",
      build(f) {
        const t = taxTotals(f, f.invoice.base);
        return {
          docType: "FACTURA",
          number: f.numbers.invoice,
          audience: "cobro",
          title: "Factura de obra",
          subtitle: f.project.site,
          meta: [
            ["Fecha", f.dates.issued],
            ["Vencimiento", f.dates.due],
            ["Forma de pago", "Transferencia"],
            ["Plazo", f.invoice.termsDays + " dias"],
          ],
          facts: [
            ["Total a pagar", eur(t.total)],
            ["Base imponible", eur(t.base)],
            ["Impuesto", f.taxRate + " %"],
            ["Vencimiento", f.dates.due],
          ],
          parties: parties(f, "Destinatario"),
          groups: chapterGroups(f),
          sections: [{ type: "table", label: "Detalle de la obra" }, { type: "totals" }],
          totals: t.rows,
          payment: [
            "Forma de pago: transferencia · " + f.invoice.termsDays + " dias.",
            "IBAN: " + f.company.iban + "   ·   Referencia: " + f.numbers.invoice,
          ],
          notes: [
            "Las correcciones se emiten como factura rectificativa; esta factura es inmutable.",
            "Garantia de 2 anos sobre los trabajos.",
          ],
        };
      },
    },

    rectificativa: {
      title: "Factura rectificativa",
      audience: "cobro",
      template: "01-cliente/07-factura-rectificativa.html",
      build(f) {
        const base = -Math.abs(f.creditNote.base);
        const t = taxTotals(f, base);
        return {
          docType: "FACTURA RECTIFICATIVA",
          number: f.numbers.creditNote,
          audience: "cobro",
          title: "Factura rectificativa de " + f.numbers.invoice,
          subtitle: f.creditNote.reason,
          meta: [
            ["Fecha", f.dates.issued],
            ["Rectifica", f.numbers.invoice],
            ["Motivo", f.creditNote.reasonCode],
            ["Proyecto", f.project.code],
          ],
          facts: [
            ["Importe rectificado", eur(t.total)],
            ["Base rectificada", eur(t.base)],
            ["Factura original", f.numbers.invoice],
            ["Fecha original", f.dates.originalInvoice],
          ],
          parties: parties(f, "Destinatario"),
          intro:
            "Esta factura rectifica la factura " +
            f.numbers.invoice +
            " de " +
            f.dates.originalInvoice +
            ". La factura original permanece emitida e inmutable; el efecto contable es " +
            "la suma de ambas.",
          sections: [
            { type: "band", label: "Conceptos rectificados" },
            { type: "lines" },
            { type: "totals" },
          ],
          lines: f.creditNote.rows.map((r) => ({
            desc: r.item,
            amount: eur(-Math.abs(r.amount)),
          })),
          totals: t.rows,
          notes: [
            "El abono se aplica al saldo pendiente o se devuelve por transferencia.",
            "IBAN de devolucion: " + f.company.iban,
          ],
        };
      },
    },

    recibo: {
      title: "Recibo",
      audience: "cobro",
      template: "01-cliente/08-recibo.html",
      build(f) {
        return {
          docType: "RECIBO",
          number: f.numbers.receipt,
          audience: "cobro",
          title: "Recibo de pago",
          subtitle: "Factura " + f.numbers.invoice + " · " + f.project.site,
          meta: [
            ["Fecha", f.dates.paid],
            ["Factura", f.numbers.invoice],
            ["Medio", f.receipt.method],
            ["Proyecto", f.project.code],
          ],
          facts: [
            ["Importe recibido", eur(f.receipt.amount)],
            ["Factura", eur(f.receipt.invoiceTotal)],
            ["Pendiente", eur(f.receipt.invoiceTotal - f.receipt.paidToDate)],
            ["Fecha valor", f.dates.paid],
          ],
          parties: parties(f, "Pagador"),
          sections: [
            { type: "band", label: "Detalle del cobro" },
            {
              type: "kvGrid",
              cols: 3,
              rows: [
                ["Factura", f.numbers.invoice],
                ["Importe de la factura", eur(f.receipt.invoiceTotal)],
                ["Recibido en este pago", eur(f.receipt.amount)],
                ["Pagado a origen", eur(f.receipt.paidToDate)],
                ["Pendiente", eur(f.receipt.invoiceTotal - f.receipt.paidToDate)],
                ["Medio de pago", f.receipt.method],
                ["Referencia", f.receipt.reference],
                ["Cuenta de abono", f.company.iban],
                ["Fecha valor", f.dates.paid],
              ],
            },
          ],
          notes: [
            "Este recibo acredita el cobro indicado y no sustituye a la factura.",
            f.receipt.invoiceTotal - f.receipt.paidToDate > 0
              ? "Queda pendiente " + eur(f.receipt.invoiceTotal - f.receipt.paidToDate) + "."
              : "La factura queda totalmente cobrada.",
          ],
          signatures: ["Por " + f.company.legal],
        };
      },
    },

    actaEntrega: {
      title: "Acta de entrega",
      audience: "cliente",
      placeholder: true,
      template: "01-cliente/13-acta-entrega.html",
      build(f) {
        const open = f.handover.punchList.filter((r) => r.state !== "ok").length;
        return {
          docType: "ACTA DE ENTREGA",
          number: f.numbers.handover,
          audience: "cliente",
          title: "Acta de entrega de obra",
          subtitle: f.project.description + " · " + f.project.site,
          meta: [
            ["Fecha", f.dates.handover],
            ["Proyecto", f.project.code],
            ["Contrato", f.numbers.contract],
            ["Garantia", "2 anos"],
          ],
          facts: [
            ["Estado", open === 0 ? "Sin reservas" : open + " reservas"],
            ["Entregado", f.dates.handover],
            ["Inicio garantia", f.dates.handover],
            ["Fin garantia", f.dates.warrantyEnd],
          ],
          parties: parties(f, "Recibe"),
          intro:
            "Las partes reconocen la terminacion de los trabajos contratados y proceden a " +
            "su entrega. Las reservas anotadas mas abajo no impiden la recepcion y se " +
            "subsanan en el plazo indicado.",
          sections: [
            { type: "band", label: "Comprobaciones de recepcion" },
            { type: "checklist", rows: f.handover.checks },
            { type: "band", label: "Reservas (punch list)" },
            { type: "checklist", rows: f.handover.punchList },
            { type: "band", label: "Documentacion entregada" },
            { type: "kvGrid", cols: 2, rows: f.handover.documents },
          ],
          notes: [
            "La garantia de 2 anos comienza en la fecha de esta acta.",
            "Las reservas abiertas se subsanan antes de " + f.handover.punchDue + ".",
          ],
          signatures: ["Por " + f.company.legal, "Por " + f.customer.name + " (firma y fecha)"],
        };
      },
    },

    /* ---- 02 · supplier -------------------------------------------------- */

    ordenCompra: {
      title: "Orden de compra",
      audience: "proveedor",
      template: "02-proveedor/10-orden-compra.html",
      build(f) {
        const base = f.purchase.rows.reduce((s, r) => s + r.amount, 0);
        const t = taxTotals(f, base);
        return {
          docType: "ORDEN DE COMPRA",
          number: f.numbers.purchaseOrder,
          audience: "proveedor",
          title: "Orden de compra",
          subtitle: "Entrega en " + f.project.site,
          meta: [
            ["Fecha", f.dates.issued],
            ["Entrega", f.purchase.deliveryDate],
            ["Proyecto", f.project.code],
            ["Pago", f.purchase.terms],
          ],
          facts: [
            ["Total", eur(t.total)],
            ["Base", eur(t.base)],
            ["Lineas", String(f.purchase.rows.length)],
            ["Entrega", f.purchase.deliveryDate],
          ],
          parties: supplierParties(f),
          sections: [
            { type: "band", label: "Material solicitado", tone: "proveedor" },
            { type: "lines" },
            { type: "totals" },
            { type: "band", label: "Condiciones de entrega", tone: "proveedor" },
            {
              type: "kvGrid",
              cols: 2,
              rows: [
                ["Direccion de entrega", f.project.site],
                ["Ventana horaria", f.purchase.window],
                ["Contacto en obra", f.purchase.siteContact],
                ["Referencia obligatoria", f.numbers.purchaseOrder],
              ],
            },
          ],
          lines: f.purchase.rows.map((r) => ({
            desc: r.item + " — " + r.qty + " " + (r.unit || "") + " x " + eur(r.price),
            amount: eur(r.amount),
          })),
          totals: t.rows,
          notes: [
            "Indique " + f.numbers.purchaseOrder + " en el albaran y en la factura.",
            "Una factura sin orden de compra referenciada no se tramita.",
            "Pago: " + f.purchase.terms + " desde la fecha de factura conforme.",
          ],
        };
      },
    },

    subcontrato: {
      title: "Contrato de subcontratacion",
      audience: "proveedor",
      template: "02-proveedor/11-contrato-subcontratacion.html",
      build(f) {
        const t = taxTotals(f, f.subcontract.amount);
        return {
          docType: "SUBCONTRATACION",
          number: f.numbers.subcontract,
          audience: "proveedor",
          title: "Contrato de subcontratacion de obra",
          subtitle: f.subcontract.scope + " · " + f.project.site,
          meta: [
            ["Fecha", f.dates.issued],
            ["Obra", f.project.code],
            ["Inicio", f.subcontract.start],
            ["Fin", f.subcontract.end],
          ],
          facts: [
            ["Importe", eur(t.total)],
            ["Base", eur(t.base)],
            ["Retencion garantia", pct(f.subcontract.retentionPct)],
            ["Plazo", f.subcontract.start + " - " + f.subcontract.end],
          ],
          parties: supplierParties(f),
          intro:
            "El subcontratista ejecutara " +
            f.subcontract.scope +
            " en la obra " +
            f.project.code +
            ", bajo la direccion del jefe de obra del contratista y conforme al " +
            "calendario acordado.",
          sections: [
            { type: "band", label: "Alcance y precio", tone: "proveedor" },
            { type: "lines" },
            { type: "totals" },
            { type: "band", label: "Hitos de pago", tone: "proveedor" },
            { type: "milestones", rows: f.subcontract.milestones },
            { type: "band", label: "Obligaciones documentales", tone: "proveedor" },
            { type: "checklist", rows: f.subcontract.compliance },
          ],
          lines: f.subcontract.rows.map((r) => ({ desc: r.item, amount: eur(r.amount) })),
          totals: t.rows,
          notes: [
            "Retencion de garantia del " +
              f.subcontract.retentionPct +
              " %, liberada a los 12 meses de la recepcion.",
            "La documentacion de cumplimiento es condicion previa al acceso a la obra.",
          ],
          signatures: ["Por " + f.company.legal, "Por " + f.supplier.name],
        };
      },
    },

    albaran: {
      title: "Albaran de entrega",
      audience: "proveedor",
      placeholder: true,
      template: "02-proveedor/12-albaran-entrega.html",
      build(f) {
        return {
          docType: "ALBARAN",
          number: f.numbers.deliveryNote,
          audience: "proveedor",
          title: "Albaran de entrega en obra",
          subtitle: f.project.site,
          meta: [
            ["Fecha", f.dates.delivered],
            ["Orden de compra", f.numbers.purchaseOrder],
            ["Proyecto", f.project.code],
            ["Recibido por", f.delivery.receivedBy],
          ],
          facts: [
            ["Lineas", String(f.delivery.rows.length)],
            ["Conformes", String(f.delivery.rows.filter((r) => r.state === "ok").length)],
            ["Con incidencia", String(f.delivery.rows.filter((r) => r.state !== "ok").length)],
            ["Entregado", f.dates.delivered],
          ],
          parties: supplierParties(f),
          sections: [
            { type: "band", label: "Material recibido", tone: "proveedor" },
            { type: "lines" },
            { type: "band", label: "Conformidad linea a linea", tone: "proveedor" },
            { type: "checklist", rows: f.delivery.rows },
          ],
          lines: f.delivery.rows.map((r) => ({
            desc: r.label,
            amount: r.qty,
          })),
          notes: [
            "La conformidad se da sobre cantidad y estado aparente, no sobre calidad oculta.",
            "Una incidencia anotada aqui bloquea el pago de la linea correspondiente.",
          ],
          signatures: ["Transportista", "Por " + f.company.legal + " (recibido)"],
        };
      },
    },

    /* ---- 03 · agency ---------------------------------------------------- */

    paqueteTrimestral: {
      title: "Paquete trimestral",
      audience: "interno",
      template: "03-gestoria/16-paquete-trimestral-gestoria.html",
      build(f) {
        const q = f.quarter;
        return {
          docType: "PAQUETE TRIMESTRAL",
          number: f.numbers.quarterPackage,
          audience: "interno",
          title: "Paquete trimestral para la asesoria",
          subtitle: q.label + " · " + f.company.legal,
          meta: [
            ["Periodo", q.label],
            ["Emitidas", String(q.issuedCount)],
            ["Recibidas", String(q.receivedCount)],
            ["Generado", f.dates.issued],
          ],
          facts: [
            ["Impuesto a liquidar", eur(q.taxDue)],
            ["Repercutido", eur(q.taxCharged)],
            ["Soportado", eur(q.taxPaid)],
            ["Excepciones", String(q.exceptions.length)],
          ],
          parties: [
            {
              label: "Remitente",
              name: f.company.legal,
              lines: [f.company.nif, f.company.address, f.company.email],
            },
            {
              label: "Destinatario",
              name: f.agency.name,
              lines: [f.agency.contact, f.agency.email],
            },
          ],
          sections: [
            { type: "band", label: "Resumen del periodo", tone: "interno" },
            {
              type: "kvGrid",
              cols: 3,
              rows: [
                ["Facturas emitidas", q.issuedCount + " · " + eur(q.issuedBase)],
                ["Facturas recibidas", q.receivedCount + " · " + eur(q.receivedBase)],
                ["Impuesto repercutido", eur(q.taxCharged)],
                ["Impuesto soportado", eur(q.taxPaid)],
                ["A liquidar", eur(q.taxDue)],
                ["Retenciones practicadas", eur(q.withheld)],
              ],
            },
            { type: "band", label: "Excepciones que requieren decision", tone: "interno" },
            { type: "checklist", rows: q.exceptions },
            { type: "band", label: "Contenido del archivo", tone: "interno" },
            { type: "kvGrid", cols: 2, rows: q.contents },
          ],
          notes: [
            "Cada excepcion lleva su justificacion o queda marcada como pendiente.",
            "Un paquete con excepciones sin justificar no debe presentarse.",
          ],
        };
      },
    },

    /* ---- 04 · internal -------------------------------------------------- */

    informeVisita: {
      title: "Informe de visita",
      audience: "interno",
      template: "04-interno/09-informe-visita.html",
      build(f) {
        const v = f.visit;
        return {
          docType: "INFORME DE VISITA",
          number: f.numbers.visit,
          audience: "interno",
          title: "Informe de visita tecnica",
          subtitle: v.address,
          meta: [
            ["Fecha", v.date],
            ["Tecnico", v.technician],
            ["Duracion", v.duration],
            ["Uso", "Interno"],
          ],
          facts: [
            ["Presupuesto estimado", eur(v.estimate)],
            ["Superficie", v.area],
            ["Plazo estimado", v.leadTime],
            ["Prioridad", v.priority],
          ],
          parties: parties(f, "Solicitante"),
          sections: [
            { type: "band", label: "Estado observado", tone: "interno" },
            { type: "kvGrid", cols: 2, rows: v.observations },
            { type: "band", label: "Trabajos previstos", tone: "interno" },
            { type: "lines" },
            { type: "band", label: "Comprobaciones en obra", tone: "interno" },
            { type: "checklist", rows: v.checks },
          ],
          lines: v.works.map((w) => ({ desc: w.item, amount: eur(w.amount) })),
          notes: [
            "Documento interno. No es un presupuesto y no compromete precio.",
            "El presupuesto se emite tras validar mediciones en obra.",
          ],
          signatures: [v.technician + " - tecnico"],
        };
      },
    },

    parteTrabajo: {
      title: "Parte de trabajo",
      audience: "interno",
      placeholder: true,
      template: "04-interno/14-parte-de-trabajo.html",
      build(f) {
        const ts = f.timesheet;
        const hours = ts.rows.reduce((s, r) => s + r.hours, 0);
        return {
          docType: "PARTE DE TRABAJO",
          number: f.numbers.timesheet,
          audience: "interno",
          title: "Parte de trabajo semanal",
          subtitle: ts.week + " · " + f.project.site,
          meta: [
            ["Semana", ts.week],
            ["Proyecto", f.project.code],
            ["Jefe de obra", ts.foreman],
            ["Uso", "Interno"],
          ],
          facts: [
            ["Horas del periodo", hours.toFixed(1) + " h"],
            ["Coste de esas horas", eur(ts.cost)],
            ["Operarios", String(ts.workers)],
            ["Sin aprobar", ts.unapproved.toFixed(1) + " h"],
          ],
          parties: [
            {
              label: "Empresa",
              name: f.company.legal,
              lines: [f.company.nif, f.company.address],
            },
            { label: "Obra", name: f.project.code, lines: [f.project.site, f.customer.name] },
          ],
          sections: [
            { type: "band", label: "Horas por dia y operario", tone: "interno" },
            { type: "lines" },
            { type: "band", label: "Reparto por partida", tone: "interno" },
            {
              type: "progressBars",
              label: "PARTIDA",
              rows: ts.byChapter.map((c) => ({
                label: c.chapter,
                pct: c.pctOfWeek,
                amount: c.hours.toFixed(1) + " h",
                note: "coste " + eur(c.cost),
              })),
            },
          ],
          lines: ts.rows.map((r) => ({
            desc: r.day + " · " + r.worker + " · " + r.task,
            amount: r.hours.toFixed(1) + " h",
          })),
          notes: [
            "Las horas sin aprobar no llegan al coste del proyecto hasta que el jefe de obra las valida.",
            "Documento interno. No se envia al cliente.",
          ],
          signatures: [ts.foreman + " - jefe de obra"],
        };
      },
    },

    fichaProyecto: {
      title: "Ficha de proyecto",
      audience: "interno",
      template: "04-interno/15-ficha-proyecto.html",
      build(f) {
        const m = f.margin;
        const revenue = m.rows.reduce((s, r) => s + r.revenue, 0);
        const cost = m.rows.reduce((s, r) => s + r.actual, 0);
        return {
          docType: "FICHA DE PROYECTO",
          number: f.project.code,
          audience: "interno",
          title: f.project.description,
          subtitle: f.project.site,
          meta: [
            ["A fecha", f.dates.issued],
            ["Jefe de obra", m.foreman],
            ["Estado", m.state],
            ["Uso", "Interno"],
          ],
          facts: [
            ["Margen del proyecto", eur(revenue - cost)],
            ["Ingresos", eur(revenue)],
            ["Coste real", eur(cost)],
            ["Desviacion de plazo", m.scheduleVariance + " dias"],
          ],
          parties: parties(f),
          sections: [
            { type: "band", label: "Identificacion", tone: "interno" },
            {
              type: "kvGrid",
              cols: 3,
              rows: [
                ["Cliente", f.customer.name],
                ["Contrato", f.numbers.contract],
                ["Presupuesto", f.numbers.quote + " v" + f.project.version],
                ["Inicio", f.dates.start],
                ["Entrega prevista", f.dates.due],
                ["Entrega real", m.actualEnd],
              ],
            },
            { type: "band", label: "Margen por partida", tone: "interno" },
            {
              type: "marginTable",
              rows: m.rows
                .map((r) => ({
                  label: r.chapter,
                  budget: eur(r.budget),
                  actual: eur(r.actual),
                  variance: eur(r.actual - r.budget),
                  margin: pct(((r.revenue - r.actual) / (r.revenue || 1)) * 100),
                  over: r.actual > r.budget,
                }))
                .concat([
                  {
                    label: "Total",
                    budget: eur(m.rows.reduce((s, r) => s + r.budget, 0)),
                    actual: eur(cost),
                    variance: eur(cost - m.rows.reduce((s, r) => s + r.budget, 0)),
                    margin: pct(((revenue - cost) / (revenue || 1)) * 100),
                    over: cost > m.rows.reduce((s, r) => s + r.budget, 0),
                    total: true,
                  },
                ]),
            },
            { type: "band", label: "Avance fisico", tone: "interno" },
            {
              type: "progressBars",
              label: "PARTIDA",
              rows: m.rows.map((r) => ({
                label: r.chapter,
                pct: r.progressPct,
                amount: pct(r.progressPct),
              })),
            },
          ],
          notes: [
            "Documento interno. Contiene costes y margenes que no se comparten con el cliente.",
            "Las cifras se recalculan de los libros; editar aqui no cambia nada.",
          ],
        };
      },
    },
  };

  /* The four emails keep their own renderer (HTML, not PDF) but are listed so
     "every document the ERP produces" is answerable from one place. */
  const EMAILS = {
    emailAceptacion: {
      title: "Email — presupuesto aceptado",
      template: "01-cliente/17-email-aceptacion.html",
    },
    emailFactura: { title: "Email — factura", template: "01-cliente/18-email-factura.html" },
    emailRecordatorio: {
      title: "Email — recordatorio de pago",
      template: "01-cliente/19-email-recordatorio-pago.html",
    },
    emailResena: {
      title: "Email — solicitud de resena",
      template: "01-cliente/20-email-solicitud-resena.html",
    },
  };

  /* ============================================================== the facts
   *
   * A complete, self-consistent input. The ERP overrides what it knows; the
   * gate uses it as-is with `chapters` scaled up so every document overflows
   * onto a second page, because a one-page document cannot demonstrate that
   * pagination works and the writer this replaced passed exactly that test. */
  function sampleFacts(opts) {
    const o = opts || {};
    const chapterCount = o.chapters || 9;
    const rowsPer = o.rowsPerChapter || 5;
    /* Chapter names AND their price-book codes. The codes are what give a line
       its trade colour and its partida code on the page — without them every
       plate rendered the neutral grey and carried no code, which is a demo
       document that cannot show what a real one looks like. */
    const chapCodes = [
      "DEM",
      "AIS",
      "FON",
      "CLI",
      "ELE",
      "REV",
      "CAR",
      "PIN",
      "LIM",
      "ALB",
      "FON",
      "CLI",
    ];
    const names = [
      "Demolicion y trabajos previos",
      "Impermeabilizacion",
      "Fontaneria",
      "Calefaccion y climatizacion",
      "Electricidad",
      "Alicatado y solado",
      "Carpinteria y vidrio",
      "Pintura y acabados",
      "Limpieza y retirada",
      "Ayudas de albanileria",
      "Instalacion de gas",
      "Ventilacion",
    ];
    const chapters = [];
    for (let i = 0; i < chapterCount; i++) {
      const rows = [];
      for (let j = 0; j < rowsPer; j++) {
        const qty = 2 + ((i * 7 + j * 3) % 18);
        const price = 1800 + ((i * 311 + j * 977) % 9000);
        rows.push({
          chapter: chapCodes[i % chapCodes.length],
          code: chapCodes[i % chapCodes.length] + "-1" + String(j + 1).padStart(2, "0"),
          item: names[i % names.length] + " — subpartida " + (j + 1),
          note:
            j === 0
              ? "Incluye medios auxiliares, retirada de escombros y limpieza de la zona de trabajo."
              : "",
          qty: String(qty),
          unit: ["m2", "ud", "ml", "h", "m3"][j % 5],
          price: price,
          amount: qty * price,
        });
      }
      chapters.push({
        code: String(i + 1).padStart(2, "0"),
        name: names[i % names.length],
        rows: rows,
      });
    }

    const base = chapters.reduce((s, c) => s + c.rows.reduce((t, r) => t + r.amount, 0), 0);

    return {
      company: {
        legal: "Canei Subirats, S.L.",
        nif: "NIF B-67123456",
        address: "Carrer de la Creu 74, 08960 Sant Just Desvern, Barcelona",
        email: "if@2iberia.com",
        phone: "659 87 67 00",
        iban: "ES91 2100 0418 4502 0005 1332",
      },
      customer: {
        name: "Comunidad de Propietarios Balmes 120",
        nif: "NIF H-08571730",
        contact: "Jordi Vives (administrador de fincas)",
        address: "Carrer de Balmes 120, esc. A, 08008 Barcelona",
        email: "vives@fincasvives.example",
      },
      supplier: {
        name: "Subministraments Vallvidrera, S.L.",
        nif: "NIF B-60998877",
        contact: "Nuria Camps",
        address: "Poligon Can Roqueta 12, 08202 Sabadell",
        email: "comandes@vallvidrera.example",
      },
      agency: {
        name: "Assessoria Puig i Associats",
        contact: "Roser Puig",
        email: "roser@puigassociats.example",
      },
      project: {
        code: "P-2026-0002",
        description: "Reforma integral del bano de planta baja",
        site: "Carrer de Balmes 120, esc. A, 08008 Barcelona",
        version: "1.0",
        validityDays: 30,
      },
      numbers: {
        quote: "PRE-2026-0014",
        contract: "CTR-2026-0009",
        changeOrder: "OC-C-2026-003",
        valuation: "CERT-2026-0002-02",
        invoice: "FAC-2026-0021",
        creditNote: "ABO-2026-0003",
        receipt: "REC-2026-0044",
        handover: "ACT-2026-0009",
        purchaseOrder: "OC-2026-0087",
        subcontract: "SUB-2026-0012",
        deliveryNote: "ALB-2026-0155",
        quarterPackage: "GES-2026-T2",
        visit: "V-2026-0031",
        timesheet: "PT-2026-W24",
      },
      dates: {
        issued: "20/05/2026",
        validUntil: "19/06/2026",
        accepted: "22/05/2026",
        start: "01/06/2026",
        due: "25/06/2026",
        paid: "03/07/2026",
        delivered: "08/06/2026",
        handover: "27/06/2026",
        warrantyEnd: "27/06/2028",
        originalInvoice: "20/06/2026",
      },
      taxRate: 10,
      withholdingRate: 0,
      chapters: chapters,

      milestones: [
        {
          when: "20/05/2026",
          label: "Hito 1 — Firma del contrato (40 %)",
          state: "Facturado",
          amount: eur(Math.round(base * 0.4)),
        },
        {
          when: "A certificacion",
          label: "Hito 2 — 50 % de obra certificada (40 %)",
          state: "Pendiente",
          amount: eur(Math.round(base * 0.4)),
        },
        {
          when: "A entrega",
          label: "Hito 3 — Acta de entrega (20 %)",
          state: "Pendiente",
          amount: eur(Math.round(base * 0.2)),
        },
      ],
      contractTerms: [
        ["Plazo de ejecucion", "01/06/2026 a 25/06/2026"],
        ["Penalizacion por demora", "60,00 € por dia natural"],
        ["Retencion de garantia", "5 % liberado a 12 meses"],
        ["Seguro de responsabilidad civil", "600.000 € por siniestro"],
        ["Direccion facultativa", "A cargo del promotor"],
        ["Residuos", "Gestor autorizado, certificado al cierre"],
      ],

      change: {
        ordinal: "3 de 3",
        reason: "Sustitucion de mampara por vidrio templado a peticion del cliente",
        state: "Pendiente de firma",
        extraDays: 3,
        rows: [
          { item: "Mampara de ducha de vidrio templado 8 mm, medida especial", amount: 68500 },
          { item: "Suplemento de mano de obra por montaje de vidrio", amount: 18000 },
          { item: "Retirada de la mampara prevista en el contrato original", amount: -24000 },
        ],
        effect: [
          ["Importe del contrato antes", eur(base)],
          ["Importe del contrato despues", eur(base + 62500)],
          ["Entrega prevista antes", "25/06/2026"],
          ["Entrega prevista despues", "28/06/2026"],
        ],
      },

      valuation: {
        ordinal: 2,
        period: "01/06 – 15/06/2026",
        overallPct: 53,
        rows: chapters.map((c, i) => {
          const contracted = c.rows.reduce((s, r) => s + r.amount, 0);
          const prev = i < 3 ? 100 : i < 6 ? 40 : 0;
          const cur = i < 3 ? 100 : i < 6 ? 75 : 20;
          return {
            chapter: c.code + " · " + c.name,
            contracted: contracted,
            previousPct: prev,
            currentPct: cur,
            toDateAmount: Math.round((contracted * cur) / 100),
            periodAmount: Math.round((contracted * (cur - prev)) / 100),
          };
        }),
      },

      invoice: { base: Math.round(base * 0.4), termsDays: 30 },

      creditNote: {
        base: 47500,
        reasonCode: "R4 · descuento posterior",
        reason: "Descuento acordado por retraso en la entrega de material",
        rows: [
          { item: "Descuento sobre partida 03 · Fontaneria", amount: 30000 },
          { item: "Descuento sobre partida 05 · Electricidad", amount: 17500 },
        ],
      },

      receipt: {
        amount: Math.round(base * 0.44),
        invoiceTotal: Math.round(base * 0.44),
        paidToDate: Math.round(base * 0.44),
        method: "Transferencia bancaria",
        reference: "FAC-2026-0021",
      },

      handover: {
        punchDue: "11/07/2026",
        checks: [
          {
            label: "Instalacion de fontaneria probada sin fugas a 6 bar",
            state: "ok",
            by: "Marc S.",
          },
          {
            label: "Cuadro electrico etiquetado y diferencial probado",
            state: "ok",
            by: "Marc S.",
          },
          { label: "Ventilacion forzada en funcionamiento", state: "ok", by: "Marc S." },
          { label: "Juntas de alicatado selladas y limpias", state: "ok", by: "Marc S." },
          {
            label: "Retirada de residuos con certificado de gestor autorizado",
            state: "ok",
            by: "Oficina",
          },
        ],
        punchList: [
          {
            label: "Repaso de pintura en el encuentro techo-pared, lado ventana",
            state: "pending",
            note: "Subsanacion prevista antes del 11/07/2026.",
            by: "Pintura",
          },
          {
            label: "Ajuste del cierre de la puerta corredera",
            state: "pending",
            note: "Material pedido; llega el 06/07.",
            by: "Carpinteria",
          },
        ],
        documents: [
          ["Manual de instalaciones", "Entregado en papel y PDF"],
          ["Certificado de instalacion electrica", "Entregado"],
          ["Garantias de fabricante", "Entregadas (6 documentos)"],
          ["Certificado de gestion de residuos", "Entregado"],
        ],
      },

      purchase: {
        deliveryDate: "08/06/2026",
        terms: "30 dias fecha factura",
        window: "07:00 – 09:00, acceso por Carrer de Balmes",
        siteContact: "Marc Subirats · 659 87 67 00",
        rows: [
          {
            item: "Azulejo porcelanico 60x60 blanco mate",
            qty: "48",
            unit: "m2",
            price: 2190,
            amount: 105120,
          },
          {
            item: "Adhesivo cementoso C2TE, saco 25 kg",
            qty: "14",
            unit: "ud",
            price: 1450,
            amount: 20300,
          },
          {
            item: "Lamina impermeabilizante liquida, 15 kg",
            qty: "3",
            unit: "ud",
            price: 6800,
            amount: 20400,
          },
          {
            item: "Tubo multicapa 16 mm, rollo 50 m",
            qty: "4",
            unit: "ud",
            price: 8900,
            amount: 35600,
          },
          {
            item: "Plato de ducha resina 120x80, blanco",
            qty: "1",
            unit: "ud",
            price: 34500,
            amount: 34500,
          },
          {
            item: "Grifo termostatico empotrado",
            qty: "1",
            unit: "ud",
            price: 28900,
            amount: 28900,
          },
        ],
      },

      subcontract: {
        scope: "Instalacion completa de fontaneria y sanitarios",
        start: "03/06/2026",
        end: "17/06/2026",
        amount: 486000,
        retentionPct: 5,
        rows: [
          { item: "Instalacion de fontaneria — mano de obra y pequeno material", amount: 386000 },
          { item: "Montaje de sanitarios y griferia", amount: 100000 },
        ],
        milestones: [
          {
            when: "03/06/2026",
            label: "Inicio de los trabajos (30 %)",
            state: "Pagado",
            amount: eur(145800),
          },
          {
            when: "10/06/2026",
            label: "Instalacion vista terminada (40 %)",
            state: "Pendiente",
            amount: eur(194400),
          },
          {
            when: "17/06/2026",
            label: "Pruebas y recepcion (30 %)",
            state: "Pendiente",
            amount: eur(145800),
          },
        ],
        compliance: [
          { label: "Alta en la Seguridad Social de todo el personal en obra", state: "ok" },
          { label: "Seguro de responsabilidad civil en vigor", state: "ok" },
          { label: "Formacion en prevencion de riesgos acreditada", state: "ok" },
          {
            label: "Certificado de estar al corriente de obligaciones tributarias",
            state: "pending",
            note: "Solicitado el 28/05.",
          },
        ],
      },

      delivery: {
        receivedBy: "Marc Subirats",
        rows: [
          { label: "Azulejo porcelanico 60x60 blanco mate", qty: "48 m2", state: "ok" },
          { label: "Adhesivo cementoso C2TE, saco 25 kg", qty: "14 ud", state: "ok" },
          { label: "Lamina impermeabilizante liquida, 15 kg", qty: "3 ud", state: "ok" },
          {
            label: "Tubo multicapa 16 mm, rollo 50 m",
            qty: "3 ud de 4",
            state: "fail",
            note: "Falta un rollo. Se anota incidencia y no se da conforme la linea.",
          },
          { label: "Plato de ducha resina 120x80, blanco", qty: "1 ud", state: "ok" },
        ],
      },

      quarter: {
        label: "T2 2026 (abril – junio)",
        issuedCount: 14,
        receivedCount: 22,
        issuedBase: 4870000,
        receivedBase: 2910000,
        taxCharged: 487000,
        taxPaid: 291000,
        taxDue: 196000,
        withheld: 84000,
        exceptions: [
          {
            label: "Factura recibida sin numero de orden de compra (2 casos)",
            state: "pending",
            note: "Pendiente de decidir si se acepta o se devuelve al proveedor.",
          },
          {
            label: "Movimiento bancario sin justificante (1 caso)",
            state: "pending",
            note: "Importe 148,90 € del 12/05.",
          },
          {
            label: "Factura emitida con impuesto reducido — justificada",
            state: "ok",
            note: "Renovacion de vivienda, condiciones acreditadas.",
          },
        ],
        contents: [
          ["Facturas emitidas", "14 PDF + indice CSV"],
          ["Facturas recibidas", "22 PDF + indice CSV"],
          ["Extractos bancarios", "3 meses, conciliados"],
          ["Libro de caja", "Con justificante por movimiento"],
        ],
      },

      visit: {
        date: "12/05/2026",
        technician: "Marc Subirats",
        duration: "45 min",
        address: "Carrer de Balmes 120, esc. A, 08008 Barcelona",
        estimate: 1050000,
        area: "6,4 m2",
        leadTime: "4 semanas",
        priority: "Alta",
        observations: [
          [
            "Estado del alicatado",
            "Original de los anos 70, con piezas sueltas en la zona de ducha.",
          ],
          ["Instalacion de fontaneria", "Plomo en la bajante; sustitucion obligada."],
          ["Instalacion electrica", "Sin toma de tierra en el bano."],
          ["Ventilacion", "Solo natural; se propone extraccion forzada."],
          ["Humedades", "Mancha activa en el techo, procedente del piso superior."],
          ["Accesos", "Escalera sin ascensor; carga y descarga por la calle."],
        ],
        works: [
          { item: "Demolicion completa de alicatado y solado", amount: 148000 },
          { item: "Sustitucion de bajante y red de fontaneria", amount: 310000 },
          { item: "Nueva instalacion electrica con toma de tierra", amount: 165000 },
          { item: "Impermeabilizacion de la zona humeda", amount: 92000 },
          { item: "Alicatado, solado y acabados", amount: 335000 },
        ],
        checks: [
          { label: "Mediciones tomadas en obra y contrastadas con el plano", state: "ok" },
          { label: "Fotografias del estado previo archivadas", state: "ok" },
          {
            label: "Origen de la humedad confirmado con el vecino",
            state: "pending",
            note: "Visita pendiente al piso superior.",
          },
        ],
      },

      timesheet: {
        week: "Semana 24 · 08/06 – 14/06/2026",
        foreman: "Marc Subirats",
        workers: 3,
        cost: 268400,
        unapproved: 6.5,
        rows: [
          { day: "Lun 08/06", worker: "Marc S.", task: "Replanteo y demolicion", hours: 8 },
          { day: "Lun 08/06", worker: "Ivan R.", task: "Demolicion y retirada", hours: 8 },
          { day: "Mar 09/06", worker: "Marc S.", task: "Fontaneria — bajante", hours: 8 },
          { day: "Mar 09/06", worker: "Ivan R.", task: "Ayudas de albanileria", hours: 8 },
          { day: "Mie 10/06", worker: "Marc S.", task: "Fontaneria — red interior", hours: 8 },
          { day: "Mie 10/06", worker: "Laia P.", task: "Electricidad — canalizacion", hours: 7.5 },
          { day: "Jue 11/06", worker: "Marc S.", task: "Impermeabilizacion", hours: 8 },
          { day: "Jue 11/06", worker: "Ivan R.", task: "Impermeabilizacion", hours: 8 },
          { day: "Vie 12/06", worker: "Laia P.", task: "Electricidad — mecanismos", hours: 6.5 },
        ],
        byChapter: [
          { chapter: "01 · Demolicion y trabajos previos", hours: 16, pctOfWeek: 24, cost: 62400 },
          { chapter: "03 · Fontaneria", hours: 16, pctOfWeek: 24, cost: 68800 },
          { chapter: "02 · Impermeabilizacion", hours: 16, pctOfWeek: 24, cost: 64000 },
          { chapter: "05 · Electricidad", hours: 14, pctOfWeek: 21, cost: 60200 },
          { chapter: "10 · Ayudas de albanileria", hours: 8, pctOfWeek: 12, cost: 31200 },
        ],
      },

      margin: {
        foreman: "Marc Subirats",
        state: "Entregado",
        actualEnd: "27/06/2026",
        scheduleVariance: "+2",
        rows: chapters.map((c, i) => {
          const revenue = c.rows.reduce((s, r) => s + r.amount, 0);
          const budget = Math.round(revenue * 0.62);
          const drift = [0, -0.06, 0.18, 0.02, 0.09, -0.03, 0.11, 0, 0.04][i % 9];
          return {
            chapter: c.code + " · " + c.name,
            revenue: revenue,
            budget: budget,
            actual: Math.round(budget * (1 + drift)),
            progressPct: [100, 100, 100, 100, 92, 80, 65, 40, 15][i % 9],
          };
        }),
      },
    };
  }

  /** Every PDF document kind, in the order the ERP produces them. */
  const KINDS = Object.keys(DOCS);

  function build(kind, facts) {
    const d = DOCS[kind];
    if (!d) throw new Error("erp-doctypes: unknown document kind " + JSON.stringify(kind));
    return d.build(facts || sampleFacts());
  }

  return { DOCS, EMAILS, KINDS, build, sampleFacts, eur, pct };
});

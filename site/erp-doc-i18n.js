/* =============================================================================
   CaneiDocI18n — every label a printed document can carry, in es / ca / en.

   WHY THIS FILE EXISTS. The descriptors in `erp-doctypes.js` emit their labels
   in plain unaccented Spanish (a choice made for the PDF writer), and both
   writers — `erp-pdf.js` and `erp-sheet.js` — already take a `tr` hook they
   apply to every human string. Until now every caller passed `String`, so an
   "English" contract printed Spanish and nobody chose that. This module is
   the hook's other half: `tr(lang)` returns a function that translates the
   known strings and leaves everything else (numbers, names, references)
   untouched.

   THREE LANGUAGES, ONE TABLE. Each entry maps the descriptor's source string
   to [es, ca, en]. The Spanish column is not a no-op: it restores the accents
   the descriptors dropped ("Descripcion" → "Descripción"), so even a Spanish
   document comes out properly written. English wording reuses the app
   dictionary's existing pair wherever one exists (i18n-dict.js — the
   source-audit rule); the few deliberate departures are where the dictionary
   pair carries a screen meaning that is wrong on paper ("Orden" → "Sort
   order", "Vencimiento" → "Expiry") — a printed invoice says "Order" and
   "Due date". Catalan likewise follows i18n-dict-ca.js.

   DYNAMIC STRINGS. Descriptors interpolate ("Impuesto 21 %", "Por Canei
   Subirats, S.L.", "Precios validos 30 dias…"), so after the exact table a
   list of pattern rules runs; $1…$n carry the data through unchanged. A
   string neither table nor pattern knows passes through as-is — data must
   never be "translated".
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CaneiDocI18n = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* source string → [es, ca, en] */
  const T = {
    /* ---- document names (sentence-cased docType + runbar) --------------- */
    Presupuesto: ["Presupuesto", "Pressupost", "Quotation"],
    "Presupuesto aceptado": ["Presupuesto aceptado", "Pressupost acceptat", "Accepted quotation"],
    "Contrato de obra": ["Contrato de obra", "Contracte d'obra", "Works contract"],
    "Orden de cambio": ["Orden de cambio", "Ordre de canvi", "Change order"],
    Certificacion: ["Certificación", "Certificació", "Progress valuation"],
    Factura: ["Factura", "Factura", "Invoice"],
    "Factura rectificativa": ["Factura rectificativa", "Factura rectificativa", "Credit note"],
    Recibo: ["Recibo", "Rebut", "Receipt"],
    "Acta de entrega": ["Acta de entrega", "Acta de lliurament", "Handover certificate"],
    "Orden de compra": ["Orden de compra", "Ordre de compra", "Purchase order"],
    Subcontratacion: ["Subcontratación", "Subcontractació", "Subcontract"],
    Albaran: ["Albarán", "Albarà", "Delivery note"],
    "Paquete trimestral": ["Paquete trimestral", "Paquet trimestral", "Quarterly package"],
    "Informe de visita": ["Informe de visita", "Informe de visita", "Visit report"],
    "Parte de trabajo": ["Parte de trabajo", "Comunicat de feina", "Timesheet"],
    "Ficha de proyecto": ["Ficha de proyecto", "Fitxa de projecte", "Project sheet"],

    /* ---- titles ---------------------------------------------------------- */
    "Presupuesto de obra": ["Presupuesto de obra", "Pressupost d'obra", "Works quotation"],
    "Presupuesto aceptado - version congelada": [
      "Presupuesto aceptado — versión congelada",
      "Pressupost acceptat — versió congelada",
      "Accepted quotation — frozen version",
    ],
    "Contrato de ejecucion de obra": [
      "Contrato de ejecución de obra",
      "Contracte d'execució d'obra",
      "Works execution contract",
    ],
    "Factura de obra": ["Factura de obra", "Factura d'obra", "Works invoice"],
    "Recibo de pago": ["Recibo de pago", "Rebut de pagament", "Payment receipt"],
    "Acta de entrega de obra": [
      "Acta de entrega de obra",
      "Acta de lliurament d'obra",
      "Works handover certificate",
    ],
    "Albaran de entrega en obra": [
      "Albarán de entrega en obra",
      "Albarà de lliurament a l'obra",
      "On-site delivery note",
    ],
    "Contrato de subcontratacion de obra": [
      "Contrato de subcontratación de obra",
      "Contracte de subcontractació d'obra",
      "Works subcontract",
    ],
    "Paquete trimestral para la asesoria": [
      "Paquete trimestral para la asesoría",
      "Paquet trimestral per a l'assessoria",
      "Quarterly package for the accountants",
    ],
    "Informe de visita tecnica": [
      "Informe de visita técnica",
      "Informe de visita tècnica",
      "Technical visit report",
    ],
    "Parte de trabajo semanal": [
      "Parte de trabajo semanal",
      "Comunicat de feina setmanal",
      "Weekly timesheet",
    ],

    /* ---- meta + facts labels -------------------------------------------- */
    Fecha: ["Fecha", "Data", "Date"],
    "Valido hasta": ["Válido hasta", "Vàlid fins a", "Valid to"],
    Version: ["Versión", "Versió", "Version"],
    Contacto: ["Contacto", "Contacte", "Contact"],
    Aceptado: ["Aceptado", "Acceptat", "Accepted"],
    Proyecto: ["Proyecto", "Projecte", "Project"],
    Anexos: ["Anexos", "Annexos", "Annexes"],
    Contrato: ["Contrato", "Contracte", "Contract"],
    Orden: ["Orden", "Ordre", "Order"],
    Periodo: ["Periodo", "Període", "Period"],
    Vencimiento: ["Vencimiento", "Venciment", "Due date"],
    "Forma de pago": ["Forma de pago", "Forma de pagament", "Payment method"],
    Plazo: ["Plazo", "Termini", "Term"],
    Rectifica: ["Rectifica", "Rectifica", "Corrects"],
    Motivo: ["Motivo", "Motiu", "Reason"],
    Medio: ["Medio", "Mitjà", "Method"],
    Garantia: ["Garantía", "Garantia", "Warranty"],
    Entrega: ["Entrega", "Lliurament", "Delivery"],
    Pago: ["Pago", "Pagament", "Payment"],
    Obra: ["Obra", "Obra", "Site"],
    Inicio: ["Inicio", "Inici", "Start"],
    Fin: ["Fin", "Fi", "End"],
    Semana: ["Semana", "Setmana", "Week"],
    "Jefe de obra": ["Jefe de obra", "Cap d'obra", "Site manager"],
    Uso: ["Uso", "Ús", "Use"],
    Interno: ["Interno", "Intern", "Internal"],
    "A fecha": ["A fecha", "A data", "As of"],
    Estado: ["Estado", "Estat", "Status"],
    Emitidas: ["Emitidas", "Emeses", "Issued"],
    Recibidas: ["Recibidas", "Rebudes", "Received"],
    Generado: ["Generado", "Generat", "Generated"],
    Tecnico: ["Técnico", "Tècnic", "Technician"],
    Duracion: ["Duración", "Durada", "Duration"],
    "Recibido por": ["Recibido por", "Rebut per", "Received by"],
    Transferencia: ["Transferencia", "Transferència", "Bank transfer"],
    "Base (sin impuesto)": ["Base (sin IVA)", "Base (sense IVA)", "Base (before tax)"],
    Partidas: ["Partidas", "Partides", "Line items"],
    Validez: ["Validez", "Validesa", "Validity"],
    "Total contratado": ["Total contratado", "Total contractat", "Contract total"],
    "Base imponible": ["Base imponible", "Base imposable", "Taxable base"],
    "Entrega prevista": ["Entrega prevista", "Lliurament previst", "Expected delivery"],
    "Entrega real": ["Entrega real", "Lliurament real", "Actual delivery"],
    "Importe del cambio": ["Importe del cambio", "Import del canvi", "Change amount"],
    Base: ["Base", "Base", "Base"],
    "Plazo adicional": ["Plazo adicional", "Termini addicional", "Additional time"],
    "A facturar": ["A facturar", "A facturar", "To invoice"],
    "Avance global": ["Avance global", "Avanç global", "Overall progress"],
    "Ejecutado a origen": ["Ejecutado a origen", "Executat a origen", "Executed to date"],
    "Total a pagar": ["Total a pagar", "Total a pagar", "Total to pay"],
    Impuesto: ["IVA", "IVA", "VAT"],
    "Importe rectificado": ["Importe rectificado", "Import rectificat", "Corrected amount"],
    "Base rectificada": ["Base rectificada", "Base rectificada", "Corrected base"],
    "Factura original": ["Factura original", "Factura original", "Original invoice"],
    "Fecha original": ["Fecha original", "Data original", "Original date"],
    "Importe recibido": ["Importe recibido", "Import rebut", "Amount received"],
    Pendiente: ["Pendiente", "Pendent", "Outstanding"],
    "Fecha valor": ["Fecha valor", "Data valor", "Value date"],
    Entregado: ["Entregado", "Lliurat", "Delivered"],
    "Inicio garantia": ["Inicio garantía", "Inici garantia", "Warranty start"],
    "Fin garantia": ["Fin garantía", "Fi garantia", "Warranty end"],
    "Sin reservas": ["Sin reservas", "Sense reserves", "No reservations"],
    Total: ["Total", "Total", "Total"],
    Lineas: ["Líneas", "Línies", "Lines"],
    Conformes: ["Conformes", "Conformes", "Accepted"],
    "Con incidencia": ["Con incidencia", "Amb incidència", "With an issue"],
    "Retencion garantia": ["Retención garantía", "Retenció garantia", "Retention"],
    "Impuesto a liquidar": ["IVA a liquidar", "IVA a liquidar", "Tax due"],
    Repercutido: ["Repercutido", "Repercutit", "Charged"],
    Soportado: ["Soportado", "Suportat", "Paid"],
    Excepciones: ["Excepciones", "Excepcions", "Exceptions"],
    "Presupuesto estimado": ["Presupuesto estimado", "Pressupost estimat", "Estimated budget"],
    Superficie: ["Superficie", "Superfície", "Area"],
    "Plazo estimado": ["Plazo estimado", "Termini estimat", "Estimated lead time"],
    Prioridad: ["Prioridad", "Prioritat", "Priority"],
    "Horas del periodo": ["Horas del periodo", "Hores del període", "Hours in the period"],
    "Coste de esas horas": ["Coste de esas horas", "Cost d'aquestes hores", "Cost of those hours"],
    Operarios: ["Operarios", "Operaris", "Workers"],
    "Sin aprobar": ["Sin aprobar", "Sense aprovar", "Unapproved"],
    "Margen del proyecto": ["Margen del proyecto", "Marge del projecte", "Project margin"],
    Ingresos: ["Ingresos", "Ingressos", "Income"],
    "Coste real": ["Coste real", "Cost real", "Actual cost"],
    "Desviacion de plazo": ["Desviación de plazo", "Desviació de termini", "Schedule variance"],

    /* ---- band labels ----------------------------------------------------- */
    "Detalle por partidas": ["Detalle por partidas", "Detall per partides", "Detail by line item"],
    "precios unitarios sin impuesto": [
      "precios unitarios sin IVA",
      "preus unitaris sense IVA",
      "unit prices before tax",
    ],
    "Precio y forma de pago": [
      "Precio y forma de pago",
      "Preu i forma de pagament",
      "Price and payment terms",
    ],
    "Alcance contratado": ["Alcance contratado", "Abast contractat", "Contracted scope"],
    "Condiciones particulares": [
      "Condiciones particulares",
      "Condicions particulars",
      "Particular conditions",
    ],
    "Trabajos anadidos o suprimidos": [
      "Trabajos añadidos o suprimidos",
      "Treballs afegits o suprimits",
      "Works added or removed",
    ],
    "Efecto sobre el contrato": [
      "Efecto sobre el contrato",
      "Efecte sobre el contracte",
      "Effect on the contract",
    ],
    "Avance por partida": ["Avance por partida", "Avanç per partida", "Progress by line item"],
    "porcentaje ejecutado sobre lo contratado": [
      "porcentaje ejecutado sobre lo contratado",
      "percentatge executat sobre el contractat",
      "percentage executed of the contracted amount",
    ],
    "Importe a certificar en este periodo": [
      "Importe a certificar en este periodo",
      "Import a certificar en aquest període",
      "Amount to certify this period",
    ],
    "Detalle de la obra": ["Detalle de la obra", "Detall de l'obra", "Works detail"],
    "Conceptos rectificados": [
      "Conceptos rectificados",
      "Conceptes rectificats",
      "Corrected items",
    ],
    "Detalle del cobro": ["Detalle del cobro", "Detall del cobrament", "Payment detail"],
    "Comprobaciones de recepcion": [
      "Comprobaciones de recepción",
      "Comprovacions de recepció",
      "Acceptance checks",
    ],
    "Reservas (punch list)": ["Reservas (punch list)", "Reserves (punch list)", "Punch list"],
    "Documentacion entregada": [
      "Documentación entregada",
      "Documentació lliurada",
      "Documentation handed over",
    ],
    "Material solicitado": ["Material solicitado", "Material sol·licitat", "Material ordered"],
    "Condiciones de entrega": [
      "Condiciones de entrega",
      "Condicions de lliurament",
      "Delivery conditions",
    ],
    "Alcance y precio": ["Alcance y precio", "Abast i preu", "Scope and price"],
    "Hitos de pago": ["Hitos de pago", "Fites de pagament", "Payment milestones"],
    "Obligaciones documentales": [
      "Obligaciones documentales",
      "Obligacions documentals",
      "Documentation obligations",
    ],
    "Material recibido": ["Material recibido", "Material rebut", "Material received"],
    "Conformidad linea a linea": [
      "Conformidad línea a línea",
      "Conformitat línia a línia",
      "Line-by-line acceptance",
    ],
    "Resumen del periodo": ["Resumen del periodo", "Resum del període", "Period summary"],
    "Excepciones que requieren decision": [
      "Excepciones que requieren decisión",
      "Excepcions que requereixen decisió",
      "Exceptions that need a decision",
    ],
    "Contenido del archivo": ["Contenido del archivo", "Contingut de l'arxiu", "Archive contents"],
    "Estado observado": ["Estado observado", "Estat observat", "Observed condition"],
    "Trabajos previstos": ["Trabajos previstos", "Treballs previstos", "Planned works"],
    "Comprobaciones en obra": [
      "Comprobaciones en obra",
      "Comprovacions a l'obra",
      "On-site checks",
    ],
    "Horas por dia y operario": [
      "Horas por día y operario",
      "Hores per dia i operari",
      "Hours by day and worker",
    ],
    "Reparto por partida": ["Reparto por partida", "Repartiment per partida", "Split by line item"],
    Identificacion: ["Identificación", "Identificació", "Identification"],
    "Margen por partida": ["Margen por partida", "Marge per partida", "Margin by line item"],
    "Avance fisico": ["Avance físico", "Avanç físic", "Physical progress"],

    /* ---- table headings (erp-sheet's own) -------------------------------- */
    Descripcion: ["Descripción", "Descripció", "Description"],
    Medicion: ["Medición", "Amidament", "Quantity"],
    "Ud.": ["Ud.", "Ut.", "Unit"],
    Precio: ["Precio", "Preu", "Price"],
    Importe: ["Importe", "Import", "Amount"],
    Concepto: ["Concepto", "Concepte", "Description"],
    Avance: ["Avance", "Avanç", "Progress"],
    Hito: ["Hito", "Fita", "Milestone"],
    PARTIDA: ["PARTIDA", "PARTIDA", "LINE ITEM"],
    Partida: ["Partida", "Partida", "Line item"],
    Previsto: ["Previsto", "Previst", "Budgeted"],
    Real: ["Real", "Real", "Actual"],
    Desviacion: ["Desviación", "Desviació", "Variance"],
    Margen: ["Margen", "Marge", "Margin"],
    Subtotal: ["Subtotal", "Subtotal", "Subtotal"],
    "Condiciones de pago": ["Condiciones de pago", "Condicions de pagament", "Payment terms"],
    Notas: ["Notas", "Notes", "Notes"],

    /* ---- party labels ---------------------------------------------------- */
    Contratista: ["Contratista", "Contractista", "Contractor"],
    Cliente: ["Cliente", "Client", "Customer"],
    "Promotor / Cliente": ["Promotor / Cliente", "Promotor / Client", "Developer / Customer"],
    Destinatario: ["Destinatario", "Destinatari", "Recipient"],
    Pagador: ["Pagador", "Pagador", "Payer"],
    Recibe: ["Recibe", "Rep", "Received by"],
    Comprador: ["Comprador", "Comprador", "Buyer"],
    Proveedor: ["Proveedor", "Proveïdor", "Supplier"],
    Remitente: ["Remitente", "Remitent", "Sender"],
    Solicitante: ["Solicitante", "Sol·licitant", "Requested by"],
    Empresa: ["Empresa", "Empresa", "Company"],

    /* ---- kv labels the descriptors emit ---------------------------------- */
    "Direccion de entrega": ["Dirección de entrega", "Adreça de lliurament", "Delivery address"],
    "Ventana horaria": ["Ventana horaria", "Finestra horària", "Delivery window"],
    "Contacto en obra": ["Contacto en obra", "Contacte a l'obra", "Site contact"],
    "Referencia obligatoria": [
      "Referencia obligatoria",
      "Referència obligatòria",
      "Mandatory reference",
    ],
    "Facturas emitidas": ["Facturas emitidas", "Factures emeses", "Invoices issued"],
    "Facturas recibidas": ["Facturas recibidas", "Factures rebudes", "Invoices received"],
    "Impuesto repercutido": ["IVA repercutido", "IVA repercutit", "Tax charged"],
    "Impuesto soportado": ["IVA soportado", "IVA suportat", "Tax paid"],
    "A liquidar": ["A liquidar", "A liquidar", "Due"],
    "Retenciones practicadas": [
      "Retenciones practicadas",
      "Retencions practicades",
      "Withholdings applied",
    ],
    "Importe de la factura": ["Importe de la factura", "Import de la factura", "Invoice amount"],
    "Recibido en este pago": [
      "Recibido en este pago",
      "Rebut en aquest pagament",
      "Received in this payment",
    ],
    "Pagado a origen": ["Pagado a origen", "Pagat a origen", "Paid to date"],
    "Medio de pago": ["Medio de pago", "Mitjà de pagament", "Payment method"],
    Referencia: ["Referencia", "Referència", "Reference"],
    "Cuenta de abono": ["Cuenta de abono", "Compte d'abonament", "Refund account"],

    /* ---- fixed sentences (notes / payment / signatures) ------------------ */
    "Los trabajos opcionales solo se incluyen si los acepta por escrito.": [
      "Los trabajos opcionales solo se incluyen si los acepta por escrito.",
      "Els treballs opcionals només s'inclouen si els accepta per escrit.",
      "Optional works are only included if you accept them in writing.",
    ],
    "El impuesto se aplica en la factura final segun la regla legal aplicable.": [
      "El IVA se aplica en la factura final según la regla legal aplicable.",
      "L'IVA s'aplica a la factura final segons la regla legal aplicable.",
      "Tax is applied on the final invoice according to the applicable legal rule.",
    ],
    "Este presupuesto se convierte en su proyecto con una linea base fija.": [
      "Este presupuesto se convierte en su proyecto con una línea base fija.",
      "Aquest pressupost es converteix en el seu projecte amb una línia base fixa.",
      "This quotation becomes your project with a fixed baseline.",
    ],
    "Garantia de 2 anos sobre los trabajos.": [
      "Garantía de 2 años sobre los trabajos.",
      "Garantia de 2 anys sobre els treballs.",
      "2-year warranty on the works.",
    ],
    "Garantia de 2 anos sobre los trabajos ejecutados.": [
      "Garantía de 2 años sobre los trabajos ejecutados.",
      "Garantia de 2 anys sobre els treballs executats.",
      "2-year warranty on the executed works.",
    ],
    "Version congelada. Cualquier cambio posterior se documenta como orden de cambio.": [
      "Versión congelada. Cualquier cambio posterior se documenta como orden de cambio.",
      "Versió congelada. Qualsevol canvi posterior es documenta com a ordre de canvi.",
      "Frozen version. Any later change is documented as a change order.",
    ],
    "Cualquier modificacion del alcance requiere orden de cambio firmada.": [
      "Cualquier modificación del alcance requiere orden de cambio firmada.",
      "Qualsevol modificació de l'abast requereix una ordre de canvi signada.",
      "Any change of scope requires a signed change order.",
    ],
    "Demora en el pago: interes legal del dinero desde el vencimiento.": [
      "Demora en el pago: interés legal del dinero desde el vencimiento.",
      "Demora en el pagament: interès legal del diner des del venciment.",
      "Late payment: statutory interest from the due date.",
    ],
    "Este documento modifica el alcance contratado. No se ejecuta ningun trabajo incluido aqui hasta que ambas partes lo firmen.":
      [
        "Este documento modifica el alcance contratado. No se ejecuta ningún trabajo incluido aquí hasta que ambas partes lo firmen.",
        "Aquest document modifica l'abast contractat. No s'executa cap treball inclòs aquí fins que ambdues parts el signin.",
        "This document changes the contracted scope. No work included here is carried out until both parties sign it.",
      ],
    "El resto de condiciones del contrato permanece sin cambios.": [
      "El resto de condiciones del contrato permanece sin cambios.",
      "La resta de condicions del contracte roman sense canvis.",
      "All other contract conditions remain unchanged.",
    ],
    "La certificacion mide obra ejecutada, no obra facturada.": [
      "La certificación mide obra ejecutada, no obra facturada.",
      "La certificació mesura obra executada, no obra facturada.",
      "The valuation measures work executed, not work invoiced.",
    ],
    "Se factura por separado con referencia a esta certificacion.": [
      "Se factura por separado con referencia a esta certificación.",
      "Es factura per separat amb referència a aquesta certificació.",
      "It is invoiced separately with reference to this valuation.",
    ],
    "Las correcciones se emiten como factura rectificativa; esta factura es inmutable.": [
      "Las correcciones se emiten como factura rectificativa; esta factura es inmutable.",
      "Les correccions s'emeten com a factura rectificativa; aquesta factura és immutable.",
      "Corrections are issued as a credit note; this invoice is immutable.",
    ],
    "El abono se aplica al saldo pendiente o se devuelve por transferencia.": [
      "El abono se aplica al saldo pendiente o se devuelve por transferencia.",
      "L'abonament s'aplica al saldo pendent o es retorna per transferència.",
      "The credit is applied to the outstanding balance or refunded by bank transfer.",
    ],
    "Este recibo acredita el cobro indicado y no sustituye a la factura.": [
      "Este recibo acredita el cobro indicado y no sustituye a la factura.",
      "Aquest rebut acredita el cobrament indicat i no substitueix la factura.",
      "This receipt evidences the stated payment and does not replace the invoice.",
    ],
    "La factura queda totalmente cobrada.": [
      "La factura queda totalmente cobrada.",
      "La factura queda totalment cobrada.",
      "The invoice is paid in full.",
    ],
    "Una factura sin orden de compra referenciada no se tramita.": [
      "Una factura sin orden de compra referenciada no se tramita.",
      "Una factura sense ordre de compra referenciada no es tramita.",
      "An invoice without a referenced purchase order is not processed.",
    ],
    "La documentacion de cumplimiento es condicion previa al acceso a la obra.": [
      "La documentación de cumplimiento es condición previa al acceso a la obra.",
      "La documentació de compliment és condició prèvia a l'accés a l'obra.",
      "Compliance documentation is a precondition for site access.",
    ],
    "La conformidad se da sobre cantidad y estado aparente, no sobre calidad oculta.": [
      "La conformidad se da sobre cantidad y estado aparente, no sobre calidad oculta.",
      "La conformitat es dona sobre quantitat i estat aparent, no sobre qualitat oculta.",
      "Acceptance covers quantity and apparent condition, not hidden quality.",
    ],
    "Una incidencia anotada aqui bloquea el pago de la linea correspondiente.": [
      "Una incidencia anotada aquí bloquea el pago de la línea correspondiente.",
      "Una incidència anotada aquí bloqueja el pagament de la línia corresponent.",
      "An issue noted here blocks payment of the corresponding line.",
    ],
    "Cada excepcion lleva su justificacion o queda marcada como pendiente.": [
      "Cada excepción lleva su justificación o queda marcada como pendiente.",
      "Cada excepció porta la seva justificació o queda marcada com a pendent.",
      "Each exception carries its justification or is marked as pending.",
    ],
    "Un paquete con excepciones sin justificar no debe presentarse.": [
      "Un paquete con excepciones sin justificar no debe presentarse.",
      "Un paquet amb excepcions sense justificar no s'ha de presentar.",
      "A package with unjustified exceptions must not be filed.",
    ],
    "Documento interno. No es un presupuesto y no compromete precio.": [
      "Documento interno. No es un presupuesto y no compromete precio.",
      "Document intern. No és un pressupost i no compromet preu.",
      "Internal document. It is not a quotation and does not commit a price.",
    ],
    "El presupuesto se emite tras validar mediciones en obra.": [
      "El presupuesto se emite tras validar mediciones en obra.",
      "El pressupost s'emet després de validar amidaments a l'obra.",
      "The quotation is issued after measurements are validated on site.",
    ],
    "Documento interno. No se envia al cliente.": [
      "Documento interno. No se envía al cliente.",
      "Document intern. No s'envia al client.",
      "Internal document. Not sent to the customer.",
    ],
    "Las horas sin aprobar no llegan al coste del proyecto hasta que el jefe de obra las valida.": [
      "Las horas sin aprobar no llegan al coste del proyecto hasta que el jefe de obra las valida.",
      "Les hores sense aprovar no arriben al cost del projecte fins que el cap d'obra les valida.",
      "Unapproved hours do not reach the project cost until the site manager validates them.",
    ],
    "Documento interno. Contiene costes y margenes que no se comparten con el cliente.": [
      "Documento interno. Contiene costes y márgenes que no se comparten con el cliente.",
      "Document intern. Conté costos i marges que no es comparteixen amb el client.",
      "Internal document. It contains costs and margins that are not shared with the customer.",
    ],
    "Las cifras se recalculan de los libros; editar aqui no cambia nada.": [
      "Las cifras se recalculan de los libros; editar aquí no cambia nada.",
      "Les xifres es recalculen dels llibres; editar aquí no canvia res.",
      "The figures are recalculated from the books; editing here changes nothing.",
    ],
    "La garantia de 2 anos comienza en la fecha de esta acta.": [
      "La garantía de 2 años comienza en la fecha de esta acta.",
      "La garantia de 2 anys comença en la data d'aquesta acta.",
      "The 2-year warranty starts on the date of this certificate.",
    ],
    "Las partes reconocen la terminacion de los trabajos contratados y proceden a su entrega. Las reservas anotadas mas abajo no impiden la recepcion y se subsanan en el plazo indicado.":
      [
        "Las partes reconocen la terminación de los trabajos contratados y proceden a su entrega. Las reservas anotadas más abajo no impiden la recepción y se subsanan en el plazo indicado.",
        "Les parts reconeixen l'acabament dels treballs contractats i procedeixen al seu lliurament. Les reserves anotades més avall no impedeixen la recepció i s'esmenen en el termini indicat.",
        "The parties acknowledge completion of the contracted works and proceed to hand them over. The reservations noted below do not prevent acceptance and will be remedied within the stated period.",
      ],
    "Conforme - el cliente (firma y fecha)": [
      "Conforme — el cliente (firma y fecha)",
      "Conforme — el client (signatura i data)",
      "Agreed — the customer (signature and date)",
    ],
    "Conforme - direccion facultativa": [
      "Conforme — dirección facultativa",
      "Conforme — direcció facultativa",
      "Agreed — the site supervision",
    ],
    Transportista: ["Transportista", "Transportista", "Carrier"],
    "2 anos": ["2 años", "2 anys", "2 years"],

    /* ---- contract terms / change-effect / handover kv labels ------------- */
    "Plazo de ejecucion": ["Plazo de ejecución", "Termini d'execució", "Execution period"],
    "Penalizacion por demora": [
      "Penalización por demora",
      "Penalització per demora",
      "Delay penalty",
    ],
    "Retencion de garantia": ["Retención de garantía", "Retenció de garantia", "Retention"],
    "Seguro de responsabilidad civil": [
      "Seguro de responsabilidad civil",
      "Assegurança de responsabilitat civil",
      "Civil liability insurance",
    ],
    "Direccion facultativa": ["Dirección facultativa", "Direcció facultativa", "Site supervision"],
    Residuos: ["Residuos", "Residus", "Waste"],
    "Importe del contrato antes": [
      "Importe del contrato antes",
      "Import del contracte abans",
      "Contract amount before",
    ],
    "Importe del contrato despues": [
      "Importe del contrato después",
      "Import del contracte després",
      "Contract amount after",
    ],
    "Entrega prevista antes": [
      "Entrega prevista antes",
      "Lliurament previst abans",
      "Expected delivery before",
    ],
    "Entrega prevista despues": [
      "Entrega prevista después",
      "Lliurament previst després",
      "Expected delivery after",
    ],
    "Manual de instalaciones": [
      "Manual de instalaciones",
      "Manual d'instal·lacions",
      "Installations manual",
    ],
    "Certificado de instalacion electrica": [
      "Certificado de instalación eléctrica",
      "Certificat d'instal·lació elèctrica",
      "Electrical installation certificate",
    ],
    "Garantias de fabricante": [
      "Garantías de fabricante",
      "Garanties de fabricant",
      "Manufacturer warranties",
    ],
    "Certificado de gestion de residuos": [
      "Certificado de gestión de residuos",
      "Certificat de gestió de residus",
      "Waste management certificate",
    ],
    "Demora en el pago": ["Demora en el pago", "Demora en el pagament", "Late payment"],
    "Garantia de ejecucion y acabados": [
      "Garantía de ejecución y acabados",
      "Garantia d'execució i acabats",
      "Execution and finishes warranty",
    ],
    "Garantia de instalaciones": [
      "Garantía de instalaciones",
      "Garantia d'instal·lacions",
      "Installations warranty",
    ],
    "Garantia estructural": ["Garantía estructural", "Garantia estructural", "Structural warranty"],
    Certificado: ["Certificado", "Certificat", "Certified"],
    "a la firma": ["a la firma", "a la signatura", "on signature"],
    "al inicio de obra": ["al inicio de obra", "a l'inici d'obra", "at works start"],
    "a certificacion": ["a certificación", "a certificació", "on valuation"],
    "a la entrega": ["a la entrega", "al lliurament", "on handover"],
    "en fecha fija": ["en fecha fija", "en data fixa", "on a fixed date"],
    "Extractos bancarios": ["Extractos bancarios", "Extractes bancaris", "Bank statements"],
    "Libro de caja": ["Libro de caja", "Llibre de caixa", "Cash book"],
    Pendientes: ["Pendientes", "Pendents", "Pending"],
    Facturado: ["Facturado", "Facturat", "Invoiced"],
    Planificado: ["Planificado", "Planificat", "Planned"],
    Aprobado: ["Aprobado", "Aprovat", "Approved"],
    Ejecutado: ["Ejecutado", "Executat", "Executed"],
    Enviado: ["Enviado", "Enviat", "Sent"],
    Rechazado: ["Rechazado", "Rebutjat", "Rejected"],
    Cancelado: ["Cancelado", "Cancel·lat", "Cancelled"],
    Efectivo: ["Efectivo", "Efectiu", "Cash"],
    "I · Presupuesto - II · Planificacion": [
      "I · Presupuesto — II · Planificación",
      "I · Pressupost — II · Planificació",
      "I · Quotation — II · Schedule",
    ],
  };

  /* Dynamic strings: [regex, es, ca, en] — $1…$n carry the data through. */
  const P = [
    [/^Impuesto (\d+(?:[.,]\d+)?) %$/, "IVA $1 %", "IVA $1 %", "VAT $1 %"],
    [/^Retencion -(\d+(?:[.,]\d+)?) %$/, "Retención −$1 %", "Retenció −$1 %", "Withholding −$1 %"],
    [/^IVA (\d+(?:[.,]\d+)?) %$/, "IVA $1 %", "IVA $1 %", "VAT $1 %"],
    [/^(\d+(?:[.,]\d+)?) dias$/, "$1 días", "$1 dies", "$1 days"],
    [
      /^(\d+) hitos · transferencia a (.+)$/,
      "$1 hitos · transferencia a $2",
      "$1 fites · transferència a $2",
      "$1 milestones · bank transfer to $2",
    ],
    [/^N (\d+)$/, "N.º $1", "Núm. $1", "No. $1"],
    [/^(\d+) reservas$/, "$1 reservas", "$1 reserves", "$1 reservations"],
    [
      /^Por (.+) \(firma y fecha\)$/,
      "Por $1 (firma y fecha)",
      "Per $1 (signatura i data)",
      "For $1 (signature and date)",
    ],
    [/^Por (.+)$/, "Por $1", "Per $1", "For $1"],
    [
      /^Conforme - (.+) \(firma y fecha\)$/,
      "Conforme — $1 (firma y fecha)",
      "Conforme — $1 (signatura i data)",
      "Agreed — $1 (signature and date)",
    ],
    /* Compound: the trailing trigger phrase is translated through the table
       again — the one place a pattern needs recursion. */
    [
      /^Hito (\d+)((?: — [\d.,]+ %)?)(?: · (.+))?$/,
      (m, t) => "Hito " + m[1] + m[2] + (m[3] ? " · " + t(m[3]) : ""),
      (m, t) => "Fita " + m[1] + m[2] + (m[3] ? " · " + t(m[3]) : ""),
      (m, t) => "Milestone " + m[1] + m[2] + (m[3] ? " · " + t(m[3]) : ""),
    ],
    [/^(\d+) meses$/, "$1 meses", "$1 mesos", "$1 months"],
    [/^(.+) % anual$/, "$1 % anual", "$1 % anual", "$1 % per year"],
    [/^(.+) \/ semana$/, "$1 / semana", "$1 / setmana", "$1 / week"],
    [/^vence (.+)$/, "vence $1", "venç $1", "expires $1"],
    [/^(\d+) de (\d+)$/, "$1 de $2", "$1 de $2", "$1 of $2"],
    [
      /^Certificacion n (\d+) de obra ejecutada$/,
      "Certificación n.º $1 de obra ejecutada",
      "Certificació núm. $1 d'obra executada",
      "Progress valuation no. $1 of executed works",
    ],
    [
      /^Orden de cambio al contrato (.+)$/,
      "Orden de cambio al contrato $1",
      "Ordre de canvi al contracte $1",
      "Change order to contract $1",
    ],
    [
      /^Factura rectificativa de (.+)$/,
      "Factura rectificativa de $1",
      "Factura rectificativa de $1",
      "Credit note for $1",
    ],
    [/^Certificacion$/, "Certificación", "Certificació", "Valuation"],
    [
      /^Precios validos (\d+) dias desde la fecha de emision\.$/,
      "Precios válidos $1 días desde la fecha de emisión.",
      "Preus vàlids $1 dies des de la data d'emissió.",
      "Prices valid for $1 days from the issue date.",
    ],
    [
      /^Aceptado por (.+) el (.+)\.$/,
      "Aceptado por $1 el $2.",
      "Acceptat per $1 el $2.",
      "Accepted by $1 on $2.",
    ],
    [
      /^Transferencia a (.+) en los hitos indicados\.$/,
      "Transferencia a $1 en los hitos indicados.",
      "Transferència a $1 a les fites indicades.",
      "Bank transfer to $1 at the stated milestones.",
    ],
    [
      /^Plazo de ejecucion: (.+) a (.+)\.$/,
      "Plazo de ejecución: $1 a $2.",
      "Termini d'execució: $1 a $2.",
      "Execution period: $1 to $2.",
    ],
    [
      /^El plazo de entrega se amplia en (\d+) dias naturales\.$/,
      "El plazo de entrega se amplía en $1 días naturales.",
      "El termini de lliurament s'amplia en $1 dies naturals.",
      "The delivery deadline is extended by $1 calendar days.",
    ],
    [
      /^Forma de pago: transferencia · (\d+) dias\.$/,
      "Forma de pago: transferencia · $1 días.",
      "Forma de pagament: transferència · $1 dies.",
      "Payment: bank transfer · $1 days.",
    ],
    [
      /^IBAN: (.+?)\s+·\s+Referencia: (.+)$/,
      "IBAN: $1 · Referencia: $2",
      "IBAN: $1 · Referència: $2",
      "IBAN: $1 · Reference: $2",
    ],
    [
      /^Ejecucion de (.+) en (.+), conforme al presupuesto (\S+) version (\S+), que se adjunta como Anexo I y forma parte inseparable de este contrato\.$/,
      "Ejecución de $1 en $2, conforme al presupuesto $3 versión $4, que se adjunta como Anexo I y forma parte inseparable de este contrato.",
      "Execució de $1 a $2, conforme al pressupost $3 versió $4, que s'adjunta com a Annex I i forma part inseparable d'aquest contracte.",
      "Execution of $1 at $2, as per quotation $3 version $4, attached as Annex I and forming an inseparable part of this contract.",
    ],
    [
      /^Esta factura rectifica la factura (\S+) de (\S+)\. La factura original permanece emitida e inmutable; el efecto contable es la suma de ambas\.$/,
      "Esta factura rectifica la factura $1 de $2. La factura original permanece emitida e inmutable; el efecto contable es la suma de ambas.",
      "Aquesta factura rectifica la factura $1 de $2. La factura original roman emesa i immutable; l'efecte comptable és la suma d'ambdues.",
      "This credit note corrects invoice $1 of $2. The original invoice remains issued and immutable; the accounting effect is the sum of both.",
    ],
    [
      /^El subcontratista ejecutara (.+) en la obra (\S+), bajo la direccion del jefe de obra del contratista y conforme al calendario acordado\.$/,
      "El subcontratista ejecutará $1 en la obra $2, bajo la dirección del jefe de obra del contratista y conforme al calendario acordado.",
      "El subcontractista executarà $1 a l'obra $2, sota la direcció del cap d'obra del contractista i conforme al calendari acordat.",
      "The subcontractor will execute $1 on site $2, under the direction of the contractor's site manager and according to the agreed schedule.",
    ],
    [
      /^IBAN de devolucion: (.+)$/,
      "IBAN de devolución: $1",
      "IBAN de devolució: $1",
      "Refund IBAN: $1",
    ],
    [
      /^Queda pendiente (.+)\.$/,
      "Queda pendiente $1.",
      "Queda pendent $1.",
      "$1 remains outstanding.",
    ],
    [
      /^Indique (.+) en el albaran y en la factura\.$/,
      "Indique $1 en el albarán y en la factura.",
      "Indiqui $1 a l'albarà i a la factura.",
      "Quote $1 on the delivery note and the invoice.",
    ],
    [
      /^Pago: (.+) desde la fecha de factura conforme\.$/,
      "Pago: $1 desde la fecha de factura conforme.",
      "Pagament: $1 des de la data de factura conforme.",
      "Payment: $1 from the date the invoice is accepted.",
    ],
    [
      /^Retencion de garantia del (.+) %, liberada a los 12 meses de la recepcion\.$/,
      "Retención de garantía del $1 %, liberada a los 12 meses de la recepción.",
      "Retenció de garantia del $1 %, alliberada als 12 mesos de la recepció.",
      "Retention of $1 %, released 12 months after acceptance.",
    ],
    [
      /^Las reservas abiertas se subsanan antes de (.+)\.$/,
      "Las reservas abiertas se subsanan antes de $1.",
      "Les reserves obertes s'esmenen abans de $1.",
      "Open reservations are remedied before $1.",
    ],
    [/^(.+) - tecnico$/, "$1 — técnico", "$1 — tècnic", "$1 — technician"],
    [/^(.+) - jefe de obra$/, "$1 — jefe de obra", "$1 — cap d'obra", "$1 — site manager"],
    [/^Entrega en (.+)$/, "Entrega en $1", "Lliurament a $1", "Delivery to $1"],
  ];

  const IDX = { es: 0, ca: 1, en: 2 };

  /**
   * The hook itself. `tr("en")` → a function for the writers' `tr` slot.
   * Unknown strings pass through untranslated — they are data, not labels.
   */
  function tr(lang) {
    const i = IDX[lang] === undefined ? 0 : IDX[lang];
    return function t(s) {
      const k = String(s == null ? "" : s);
      const hit = T[k];
      if (hit) return hit[i];
      for (const rule of P) {
        const rep = rule[1 + i];
        if (typeof rep === "function") {
          const m = rule[0].exec(k);
          if (m) return rep(m, t);
        } else if (rule[0].test(k)) return k.replace(rule[0], rep);
      }
      return k;
    };
  }

  return { tr, TABLE: T, PATTERNS: P, LANGS: ["es", "ca", "en"] };
});

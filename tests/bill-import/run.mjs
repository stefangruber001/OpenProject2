/* =============================================================================
   La carga de facturas de proveedor: sólo la cabecera, para conciliar.

   `node tests/bill-import/run.mjs`

   LO QUE ESTO FIJA, y por qué cada cosa puede fallar sola:

     · LA REGLA DEL SIGNO. El listado de BigMat trae los abonos en positivo, y
       su identificador interno no los distingue. El signo sale del Tipo, de
       un importe negativo o de la serie del número fiscal; cuando esas
       fuentes se contradicen la fila NO entra. Cada caso tiene aquí su prueba
       porque cada uno, mal resuelto, es el doble del importe al revés.
     · EL IVA SALE DEL TIPO, Y SÓLO EL GENERAL SE DEDUCE. Una factura real de
       BigMat cuadra al céntimo con un 10 % por coincidencia y lleva en verdad
       un descuento: deducir un tipo reducido de la aritmética lo inventa.
     · LA RETENCIÓN SALE DE LA FICHA. El alquiler: base 750 → total 765, y
       restar base de total habría dado 15 € de IVA en vez de 157,50.
     · UN ABONO CARGADO ASÍ SE CONCILIA: un cargo que paga una factura y
       descuenta un abono, y una devolución que entra, cuadran los dos a cero.
     · LA SEGUNDA PASADA NO HACE NADA, y un «7» de dos años distintos son dos
       facturas, no una repetida.
     · LAS PESTAÑAS SE ENCUENTRAN POR SU CABECERA: un libro de una sola hoja no
       lee sus facturas como reglas de serie.
   ========================================================================== */
import { createRequire } from "node:module";
import { deflateRawSync } from "node:zlib";
const require = createRequire(import.meta.url);
const B = require("../../site/erp-bill-import.js");
const { ERP } = require("../../site/erp-engine.js");

const checks = [];
const ok = (n, d) => checks.push({ n, pass: true, d: d || "" });
const bad = (n, d) => checks.push({ n, pass: false, d: String(d == null ? "" : d) });
const is = (cond, n, d) => (cond ? ok(n) : bad(n, d));

const BIG = "B88430459";
const ALQ = "E16698854";
const OBR = "B84406289";
/* Las series de BigMat como las dejó medidas el material del cliente. Sin
   «ZVA»: uno de esos documentos era una rectificativa y otro un anticipo, y
   un prefijo que significa dos cosas no es una serie. La prueba de que una
   serie se lee también en la referencia del proveedor usa un prefijo
   inventado («RCT»), para no documentar aquí una regla falsa sobre BigMat. */
const SERIES = [
  ["00002", "Factura"],
  ["00003", "Rectificativa"],
  ["08002", "Rectificativa"],
  ["VAL", "Vale"],
  ["RCT", "Rectificativa"],
].map(([prefix, kind]) => ({ supplierTaxId: BIG, prefix, kind }));

/** Una empresa con sus tres proveedores dados de alta, lista para cargar. */
function freshErp(opts) {
  const o = opts || {};
  const erp = new ERP("2026-11-27");
  erp.configureEntity({
    legalName: "Canei Subirats, S.L.",
    taxId: "B26942003",
    iban: "ES9121000418450200051332",
    requireCostDestination: o.requireDestination ? true : false,
  });
  erp.addParty(
    {
      name: "Estrategias BigMat, S.L.U.",
      taxId: BIG,
      roles: ["supplier"],
      aliases: ["BigMat La Plataforma Sant Just"],
    },
    "t",
  );
  erp.addParty(
    {
      name: "Luengo Sanchez C.B.",
      taxId: ALQ,
      roles: ["supplier"],
      irpfApplies: true,
      irpfRateBp: 1900,
    },
    "t",
  );
  erp.addParty(
    { name: "Bricolaje Bricoman, S.L.U.", taxId: OBR, roles: ["supplier"], aliases: ["Obramat"] },
    "t",
  );
  return erp;
}
let n = 1;
const row = (o) => Object.assign({ row: ++n, supplierTaxId: BIG, date: "05/11/2026" }, o);
const plan = (erp, rows, series) => B.planFacturas(erp, rows, series || SERIES);
const errOf = (p, r) => (p.errors.find((e) => e.row === r.row) || {}).msg || "";

/* ---------- 1 · la plantilla se planifica bajo su propio planificador ---------- */
{
  const t = B.plantilla();
  const toRows = (sh, cols) =>
    sh.rows.slice(1).map((r, i) => {
      const o = { row: i + 2 };
      sh.rows[0].forEach((lab, j) => (o[cols.find((c) => c.lab === lab).key] = r[j]));
      return o;
    });
  is(
    t.sheets[0].rows[0].every((h, i) => h === B.FACTURA_COLUMNS[i].lab) &&
      t.sheets[1].rows[0].every((h, i) => h === B.SERIE_COLUMNS[i].lab),
    "las dos cabeceras de la plantilla SON las listas que lee el parser",
  );
  const p = plan(
    freshErp(),
    toRows(t.sheets[0], B.FACTURA_COLUMNS),
    toRows(t.sheets[1], B.SERIE_COLUMNS),
  );
  is(
    p.errors.length === 0 && p.creates.length === 3,
    "la plantilla se planifica sin errores",
    JSON.stringify(p.errors),
  );
}

/* ---------- 2 · con «Exigir destino» encendido no se carga nada ---------- */
{
  const erp = freshErp({ requireDestination: true });
  const p = plan(erp, [row({ number: "F-1", base: "100", total: "121" })]);
  /* Con las palabras de la casilla tal como está en pantalla: un mensaje que
     manda a buscar «Exigir destino» manda a buscar algo que no existe. */
  is(
    !!p.blocked && p.blocked.indexOf("Exigir que cada factura diga a dónde va") !== -1,
    "el plan dice qué casilla hay que desmarcar, con su texto real",
    p.blocked,
  );
  let refused = false;
  try {
    B.applyFacturas(erp, p, "t");
  } catch {
    refused = true;
  }
  is(refused && erp.state.bills.length === 0, "y aplicarlo no registra ninguna factura");
}

/* ---------- 3 · LA REGLA DEL SIGNO ---------- */
{
  const erp = freshErp();
  const r = {
    /* Un proveedor SIN reglas de serie, para que el Tipo sea la única
       evidencia: con un número de la serie de facturas de BigMat, el Tipo
       «Rectificativa» contradiría a la serie y la fila no entraría — que es
       la regla funcionando, y la prueba de abajo lo fija aparte. */
    statedCredit: row({
      supplierTaxId: OBR,
      number: "028-0011-999",
      kind: "Rectificativa",
      base: "72,80",
      total: "88,09",
    }),
    statedCreditVsSeries: row({
      number: "00002-2026/X/1",
      kind: "Rectificativa",
      base: "72,80",
      total: "88,09",
    }),
    longestWins: row({ number: "00002-2026/A2101/77", base: "10,00", total: "12,10" }),
    negative: row({ number: "F-NEG", base: "-72,80", total: "-88,09" }),
    bySeries: row({
      number: "00003-2026/A2181/00000523",
      supplierDocRef: "ZCO25893685",
      base: "72,80",
      total: "88,09",
    }),
    byRefSeries: row({
      number: "RCT20201408",
      supplierDocRef: "RCT20201408",
      base: "20,39",
      total: "24,67",
    }),
    statedVsNegative: row({ number: "F-CONTRA", kind: "Factura", base: "-10,00", total: "-12,10" }),
    statedVsSeries: row({
      number: "00003-2026/A2181/9",
      kind: "Factura",
      base: "10,00",
      total: "12,10",
    }),
    negativeVsSeries: row({ number: "00002-2026/A2101/9", base: "-10,00", total: "-12,10" }),
    unknownSeries: row({
      number: "ZCO25884582",
      supplierDocRef: "ZCO25884582",
      base: "44,53",
      total: "53,88",
    }),
    noRules: row({
      supplierTaxId: OBR,
      number: "028-0011-645866",
      base: "237,24",
      total: "287,06",
    }),
    mixedSigns: row({ number: "F-MIX", base: "10,00", total: "-12,10" }),
  };
  /* La serie más larga manda: «00002» y un «000» ficticio de abono. */
  const series = SERIES.concat([{ supplierTaxId: BIG, prefix: "000", kind: "Rectificativa" }]);
  const p = plan(erp, Object.values(r), series);
  const c = (x) => p.creates.find((k) => k.row === x.row);

  is(
    c(r.statedCredit) && c(r.statedCredit).totalCents === -8809,
    "Tipo «Rectificativa» con importe positivo → abono",
    JSON.stringify(c(r.statedCredit)),
  );
  is(c(r.negative) && c(r.negative).totalCents === -8809, "importe negativo sin Tipo → abono");
  is(
    c(r.bySeries) && c(r.bySeries).totalCents === -8809 && c(r.bySeries).flags.length === 0,
    "SÓLO LA SERIE (00003) convierte en abono la rectificativa que el listado trae en positivo",
    JSON.stringify(c(r.bySeries)),
  );
  is(
    c(r.byRefSeries) && c(r.byRefSeries).totalCents === -2467,
    "la serie también se lee en la referencia del proveedor",
  );
  /* Y un documento ZVA, sin regla que lo diga, NO se convierte en abono: entra
     como factura y señalado, que es lo que es un anticipo pagado. */
  const zva = plan(erp, [
    row({ number: "ZVA20199766", supplierDocRef: "ZVA20199766", base: "88,30", total: "106,84" }),
  ]);
  is(
    zva.creates[0] &&
      zva.creates[0].totalCents === 10684 &&
      zva.creates[0].flags.some((f) => /serie desconocida/.test(f)),
    "un anticipo (ZVA) no se toma por abono: entra en positivo, señalado",
    JSON.stringify(zva.creates[0]),
  );
  is(
    /signo no está claro/.test(errOf(p, r.statedVsNegative)),
    "«Factura» con importe negativo: no entra",
    errOf(p, r.statedVsNegative),
  );
  is(
    /serie dice abono/.test(errOf(p, r.statedVsSeries)),
    "«Factura» en una serie de abonos: no entra, y dice quién discrepa",
    errOf(p, r.statedVsSeries),
  );
  is(
    /signo no está claro/.test(errOf(p, r.negativeVsSeries)),
    "importe negativo en una serie de facturas: no entra",
    errOf(p, r.negativeVsSeries),
  );
  is(
    c(r.unknownSeries) &&
      c(r.unknownSeries).totalCents === 5388 &&
      c(r.unknownSeries).flags.some((f) => /serie desconocida/.test(f)),
    "un número que no encaja en ninguna serie del proveedor entra como factura, SEÑALADO",
    JSON.stringify(c(r.unknownSeries)),
  );
  is(
    c(r.noRules) && c(r.noRules).totalCents === 28706 && c(r.noRules).flags.length === 0,
    "un proveedor sin series: factura, sin aviso",
  );
  is(
    /signos distintos/.test(errOf(p, r.mixedSigns)),
    "base y total con signos distintos: no entra",
  );
  /* «00002» (factura) y «000» (abono) encajan los dos; si mandara el corto
     esta factura entraría como abono. */
  is(
    c(r.longestWins) && c(r.longestWins).totalCents === 1210,
    "el prefijo más largo manda sobre uno que lo contiene",
    JSON.stringify(c(r.longestWins) || errOf(p, r.longestWins)),
  );
  is(
    /serie dice factura/.test(errOf(p, r.statedCreditVsSeries)),
    "«Rectificativa» en la serie de facturas del proveedor: no entra",
    errOf(p, r.statedCreditVsSeries),
  );
}

/* ---------- 4 · EL IVA ---------- */
{
  const erp = freshErp();
  const r = {
    derived: row({ number: "F-21", base: "18,76", total: "22,70" }),
    coincidence: row({ number: "ZCO25925068", base: "54,55", total: "60,01" }),
    discount: row({ number: "ZCO25941514", base: "61,41", total: "68,31" }),
    statedReduced: row({ number: "F-10", base: "54,55", vatRate: "10", total: "60,01" }),
    statedMismatch: row({ number: "F-MAL", base: "61,41", vatRate: "21", total: "68,31" }),
    notOurs: row({ number: "F-4", base: "100", vatRate: "4", total: "104" }),
    fraction: row({ number: "F-FR", base: "44,53", vatRate: 0.21, total: 53.88 }),
    rent: row({
      supplierTaxId: ALQ,
      number: "7",
      date: "01/10/2026",
      base: "750,00",
      total: "765,00",
    }),
    nothing: row({ number: "F-NADA", base: "100" }),
    voucher: row({
      number: "VAL 20123799",
      supplierDocRef: "VAL20123799",
      kind: "Vale",
      base: "100",
      vatRate: "0",
      total: "100",
    }),
  };
  const p = plan(erp, Object.values(r));
  const c = (x) => p.creates.find((k) => k.row === x.row);
  is(
    c(r.derived) && c(r.derived).vatBp === 2100,
    "sin tipo escrito, el general se deduce del total",
  );
  is(
    !c(r.coincidence) && /Cuadra con un 10 %.*no se supone/.test(errOf(p, r.coincidence)),
    "un total que sólo cuadra con un tipo REDUCIDO no se acepta sin escribirlo (el caso real de BigMat)",
    errOf(p, r.coincidence),
  );
  is(
    /descuento después del impuesto/.test(errOf(p, r.discount)),
    "un total que no cuadra con nada: no entra, y sugiere el descuento",
  );
  is(
    c(r.statedReduced) && c(r.statedReduced).vatBp === 1000,
    "un 10 % ESCRITO y cuadrado sí entra",
  );
  is(
    /el total sería 74,31 €, y la hoja dice 68,31 €/.test(errOf(p, r.statedMismatch)),
    "tipo escrito y total que no cuadra: dice las dos cifras",
    errOf(p, r.statedMismatch),
  );
  is(
    /no está entre los tipos de la empresa/.test(errOf(p, r.notOurs)),
    "un tipo que la empresa no tiene configurado: no entra",
  );
  is(
    c(r.fraction) && c(r.fraction).vatBp === 2100 && c(r.fraction).totalCents === 5388,
    "0,21 (celda en formato porcentaje) es un 21 %",
  );
  is(
    c(r.rent) && c(r.rent).vatCents === 15750 && c(r.rent).totalCents === 76500,
    "alquiler: la retención del 19 % sale de la ficha y el total 765 cuadra a 21 %",
    JSON.stringify(c(r.rent)),
  );
  is(76500 - 75000 === 1500, "y restar base de total habría dado 15,00 € de IVA, no 157,50");
  is(/falta el IVA % o el total/.test(errOf(p, r.nothing)), "sin tipo ni total no se adivina");
  is(
    c(r.voucher) && c(r.voucher).totalCents === -10000 && c(r.voucher).kind === "voucher",
    "el vale, al 0 % escrito, resta 100",
  );
}

/* ---------- 5 · el proveedor ---------- */
{
  const erp = freshErp();
  erp.addParty(
    {
      name: "Saltoki Cornellà, S.A.",
      taxId: "A64207400",
      roles: ["supplier"],
      aliases: ["Obramat"],
    },
    "t",
  );
  const r = {
    unknown: row({ supplierTaxId: "B70972336", number: "F-1", base: "10", total: "12,10" }),
    byAlias: row({
      supplierTaxId: "",
      supplierName: "BigMat La Plataforma Sant Just",
      number: "F-2",
      base: "10",
      total: "12,10",
    }),
    ambiguous: row({
      supplierTaxId: "",
      supplierName: "Obramat",
      number: "F-3",
      base: "10",
      total: "12,10",
    }),
    ours: row({ supplierTaxId: "B26942003", number: "15-2026", base: "11921", total: "13113,10" }),
    noOne: row({ supplierTaxId: "", supplierName: "", number: "F-4", base: "10", total: "12,10" }),
  };
  const p = plan(erp, Object.values(r));
  is(
    /importa antes la hoja de proveedores/.test(errOf(p, r.unknown)),
    "un NIF que no está dado de alta: dice qué cargar antes",
  );
  is(
    p.creates.some((c) => c.row === r.byAlias.row),
    "sin NIF, el rótulo de la tienda encuentra al proveedor por su alias",
  );
  is(/varios proveedores/.test(errOf(p, r.ambiguous)), "un nombre que casa con dos: pide el NIF");
  is(
    /propia empresa/.test(errOf(p, r.ours)),
    "la factura emitida por la propia empresa no entra como compra",
  );
  is(/no dice de qué proveedor/.test(errOf(p, r.noOne)), "sin NIF ni nombre: error");
}

/* ---------- 6 · la segunda pasada, los duplicados y el año ---------- */
{
  const erp = freshErp();
  const rows = [
    row({
      number: "00002-2026/A2101/00014649",
      supplierDocRef: "ZCO25884582",
      base: "44,53",
      total: "53,88",
    }),
    row({ supplierTaxId: ALQ, number: "7", date: "01/10/2026", base: "750", total: "765" }),
  ];
  B.applyFacturas(erp, plan(erp, rows), "t");
  const before = JSON.stringify(erp.state.bills);
  const again = plan(erp, rows);
  is(
    again.creates.length === 0 && again.unchanged.length === 2,
    "subir el mismo fichero otra vez: nada que crear, dos ya registradas",
  );
  B.applyFacturas(erp, again, "t");
  is(JSON.stringify(erp.state.bills) === before, "y aplicarlo no cambia un solo byte del libro");

  /* La misma factura llegando del LISTADO: sólo con el id interno. */
  const fromListing = plan(erp, [
    row({
      number: "ZCO25884582",
      supplierDocRef: "ZCO25884582",
      base: "44,53",
      total: "53,88",
      date: "03/11/2026",
    }),
  ]);
  is(
    fromListing.unchanged.length === 1,
    "la misma factura por su referencia del proveedor ya está en el libro",
  );

  /* El «7» del año que viene es OTRA factura. */
  const nextYear = plan(erp, [
    row({ supplierTaxId: ALQ, number: "7", date: "01/01/2027", base: "750", total: "765" }),
  ]);
  is(
    nextYear.creates.length === 1,
    "un nº 7 de 2027 no es el nº 7 de 2026",
    JSON.stringify(nextYear.unchanged),
  );

  const twice = plan(freshErp(), [
    row({ number: "F-9", base: "10", total: "12,10" }),
    row({ number: "F-9", base: "10", total: "12,10" }),
  ]);
  is(
    twice.creates.length === 1 &&
      /repite la factura de la fila/.test(twice.errors[0] && twice.errors[0].msg),
    "repetida dentro de la hoja: la segunda dice cuál es la primera",
  );

  const changed = plan(erp, [
    row({ number: "00002-2026/A2101/00014649", base: "45,00", total: "54,45", date: "03/11/2026" }),
  ]);
  is(
    changed.unchanged.length === 1 && /otra base/.test(changed.unchanged[0].differs),
    "ya registrada con otro importe: no se reescribe, se avisa",
  );
}

/* ---------- 7 · un abono cargado así SE CONCILIA ---------- */
{
  const erp = freshErp();
  const acc = erp.addBankAccount({ name: "Visa", kind: "card" }, "t");
  const p = plan(erp, [
    row({ number: "00002-2026/A2181/1", base: "100,00", total: "121,00" }),
    row({ number: "00003-2026/A2181/9", base: "17,36", total: "21,01" }),
    row({ number: "00003-2026/A2181/10", base: "72,80", total: "88,09" }),
  ]);
  B.applyFacturas(erp, p, "t");
  const bill = (num) => erp.state.bills.find((b) => b.number === num);
  const A = bill("00002-2026/A2181/1");
  const C1 = bill("00003-2026/A2181/9");
  const C2 = bill("00003-2026/A2181/10");
  erp.importMovements(
    acc.id,
    [
      {
        date: "2026-11-05",
        accountingDate: "2026-11-05",
        concept: "BIGMAT",
        amountCents: -(A.totalCents + C1.totalCents),
      },
      {
        date: "2026-11-06",
        accountingDate: "2026-11-06",
        concept: "DEVOLUCION BIGMAT",
        amountCents: -C2.totalCents,
      },
    ],
    "t",
  );
  const [m1, m2] = erp.state.movements;
  erp.matchMovementSplit(
    m1.id,
    [
      { billId: A.id, amountCents: A.totalCents },
      { billId: C1.id, amountCents: C1.totalCents },
    ],
    "t",
  );
  erp.matchMovementSplit(m2.id, [{ billId: C2.id, amountCents: C2.totalCents }], "t");
  is(
    erp.billOutstandingCents(A.id) === 0 &&
      erp.billOutstandingCents(C1.id) === 0 &&
      m1.status === "matched",
    "un cargo que paga una factura y descuenta un abono cuadra los dos a cero",
  );
  is(
    erp.billOutstandingCents(C2.id) === 0 && m2.status === "matched",
    "una devolución que entra en la tarjeta cuadra el abono a cero",
  );
  /* 21,00 de la factura, menos 3,65 (17,36 × 21 %) y 15,29 de los abonos. */
  const v = erp.vatSummary("2026-Q4");
  is(
    C1.vatCents === -365 && C2.vatCents === -1529 && v.inputVatCents === 2100 - 365 - 1529,
    "y el IVA soportado del trimestre resta los dos abonos",
    JSON.stringify({ c1: C1.vatCents, c2: C2.vatCents, input: v.inputVatCents }),
  );
}

/* ---------- 8 · las fechas como llegan ---------- */
{
  const p = plan(freshErp(), [
    row({ number: "F-H", date: "20/11/2026 13:36:13", base: "10", total: "12,10" }),
    row({ number: "F-S", date: 46329, base: "10", total: "12,10" }),
    row({ number: "F-X", date: "mañana", base: "10", total: "12,10" }),
  ]);
  const d = (num) => (p.creates.find((c) => c.number === num) || {}).date;
  is(d("F-H") === "2026-11-20", "«dd/mm/aaaa hh:mm:ss», como lo exporta BigMat");
  is(d("F-S") === "2026-11-03", "un número de serie de Excel, como lo guarda el registro manual");
  is(
    p.errors.some((e) => /no se entiende/.test(e.msg)),
    "una fecha que no es fecha: error",
  );
}

/* ---------- 9 · las pestañas se encuentran por su cabecera ---------- */
function xlsx(sheets) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const col = (n) => {
    let s = "";
    n++;
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = ((n - (r + 1)) / 26) | 0;
    }
    return s;
  };
  const sheetXml = (rows) =>
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` +
    rows
      .map(
        (r, i) =>
          `<row r="${i + 1}">` +
          r
            .map((c, j) => `<c r="${col(j)}${i + 1}" t="inlineStr"><is><t>${esc(c)}</t></is></c>`)
            .join("") +
          `</row>`,
      )
      .join("") +
    `</sheetData></worksheet>`;
  const files = [["xl/workbook.xml", "<workbook/>"]].concat(
    sheets.map((rows, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(rows)]),
  );
  const crcT = [];
  for (let k = 0; k < 256; k++) {
    let c = k;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcT[k] = c >>> 0;
  }
  const crc = (b) => {
    let c = 0xffffffff;
    for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const parts = [],
    cen = [];
  let off = 0;
  for (const [name, content] of files) {
    const data = Buffer.from(content),
      comp = deflateRawSync(data),
      nb = Buffer.from(name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc(data), 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc(data), 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nb.length, 28);
    ch.writeUInt32LE(off, 42);
    parts.push(lh, nb, comp);
    cen.push(ch, nb);
    off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(cen),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(off, 16);
  const buf = Buffer.concat([...parts, cd, end]);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
{
  const head = B.FACTURA_COLUMNS.map((c) => c.lab);
  const shead = B.SERIE_COLUMNS.map((c) => c.lab);
  const inv = [
    head,
    [
      BIG,
      "",
      "00003-2026/A2181/00000523",
      "ZCO25893685",
      "04/11/2026",
      "",
      "72,80",
      "",
      "88,09",
      "",
    ],
  ];
  const ser = [shead, [BIG, "00003", "Rectificativa"]];

  const one = await B.parseFacturas(xlsx([inv]));
  is(
    one.rows.length === 1 && one.series.length === 0,
    "un libro de UNA hoja: sus facturas no se leen como series",
    JSON.stringify({ r: one.rows.length, s: one.series.length }),
  );

  const swapped = await B.parseFacturas(xlsx([ser, [["notas"]], inv]));
  is(
    swapped.rows.length === 1 && swapped.series.length === 1,
    "series primero y facturas en la tercera pestaña: se encuentran igual",
  );
  const p = plan(freshErp(), swapped.rows, swapped.series);
  is(
    p.creates[0] && p.creates[0].totalCents === -8809,
    "y la serie leída del fichero hace su trabajo",
  );
}

/* ---------- informe ---------- */
const failed = checks.filter((c) => !c.pass);
console.log("\n──── carga de facturas ────\n");
for (const c of checks) console.log(`${c.pass ? "✓" : "✗"} ${c.n}${c.d ? `  → ${c.d}` : ""}`);
console.log(`\n${checks.length - failed.length}/${checks.length} comprobaciones pasadas`);
process.exit(failed.length ? 1 : 0);

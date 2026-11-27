/* =============================================================================
   La hoja de proveedores, leída y planeada.

   `node tests/supplier-import/run.mjs`

   LO QUE ESTO FIJA, y por qué cada cosa puede fallar sola:

     · la plantilla que se descarga parsea bajo su propio parser — lo único que
       impide que la plantilla y el lector se separen;
     · **el arco de la retención**: un proveedor con 19 % en la hoja hace que
       `registerBill` calcule 157,50 de IVA y 142,50 de retención sobre una
       base de 750, en vez de los 15,00 que daría restar base de total. Ése es
       el motivo entero de cargar proveedores ANTES que facturas;
     · «reescribe lo que es distinto» significa DISTINTO: una celda vacía no
       borra nada, una celda igual no es un cambio, y la segunda pasada del
       mismo fichero no hace nada en absoluto;
     · los roles y los alias se SUMAN; el nombre de un contacto por el que ya
       pasan facturas no se reescribe desde una hoja;
     · un NIF inválido, repetido o ausente es un error CON MOTIVO y con número
       de fila, y no detiene el resto de la hoja;
     · la forma jurídica sale del sufijo de la razón social, porque `addParty`
       crea todo como persona física y eso es falso para cualquier sociedad.
   ========================================================================== */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const S = require("../../site/erp-supplier-import.js");
const { ERP } = require("../../site/erp-engine.js");

const checks = [];
const ok = (n, d) => checks.push({ n, pass: true, d: d || "" });
const bad = (n, d) => checks.push({ n, pass: false, d: String(d == null ? "" : d) });
const is = (cond, n, d) => (cond ? ok(n) : bad(n, d));

/** Una empresa recién configurada, sin contactos. */
function freshErp() {
  const erp = new ERP();
  erp.setToday("2026-11-27");
  erp.configureEntity({
    legalName: "Empresa de pruebas, S.L.",
    taxId: "B26942003",
    iban: "ES9121000418450200051332",
  });
  return erp;
}

/** Las filas de la plantilla, tal y como las devolvería el parser. */
function plantillaRows() {
  return S.plantilla()
    .rows.slice(1)
    .map((r, i) => {
      const o = { row: i + 2 };
      S.PROVEEDOR_COLUMNS.forEach((c, j) => (o[c.key] = r[j] == null ? "" : String(r[j])));
      return o;
    });
}

/* ---------- 1 · la plantilla parsea bajo su propio parser ---------- */
{
  const t = S.plantilla();
  const head = t.rows[0];
  is(
    head.length === S.PROVEEDOR_COLUMNS.length &&
      head.every((h, i) => h === S.PROVEEDOR_COLUMNS[i].lab),
    "la cabecera de la plantilla ES la lista de columnas que lee el parser",
    JSON.stringify(head),
  );
  is(
    t.rows.slice(1).every((r) => r.length === head.length),
    "cada fila de ejemplo tiene tantas celdas como columnas",
    JSON.stringify(t.rows.map((r) => r.length)),
  );

  const erp = freshErp();
  const plan = S.planProveedores(erp, plantillaRows());
  is(
    plan.errors.length === 0 && plan.creates.length === 3,
    "la plantilla se planifica sin un solo error",
    JSON.stringify(plan.errors),
  );
}

/* ---------- 2 · la forma jurídica sale del sufijo ---------- */
{
  is(S.toPartyType("Estrategias BigMat, S.L.U.") === "company", "«S.L.U.» es una sociedad");
  is(S.toPartyType("Saltoki Cornellà, S.A.") === "company", "«S.A.» es una sociedad");
  is(S.toPartyType("Luengo Sanchez C.B.") === "community", "«C.B.» es una comunidad de bienes");
  is(S.toPartyType("Júlia Garcia Gómez") === "individual", "sin sufijo, persona física");
  is(S.toPartyType("Anthropic, PBC") === "company", "«PBC» es una sociedad extranjera");
  is(S.toPartyType("Acme GmbH") === "company", "«GmbH» también");
  is(
    S.toPartyType("Spa Vallès") === "individual",
    "«Spa» no es una sigla: no se confunde con S.p.A.",
  );
}

/* ---------- 3 · EL ARCO DE LA RETENCIÓN, que es el motivo de todo esto ---------- */
{
  const erp = freshErp();
  erp.configureEntity({ requireCostDestination: false }); // la vía de la conciliación
  const plan = S.planProveedores(erp, plantillaRows());
  S.applyProveedores(erp, plan, "t");

  const alq = erp.state.parties.find((p) => p.taxId === "E16698854");
  is(
    alq && alq.irpfApplies === true && alq.irpfRateBp === 1900,
    "el proveedor del alquiler queda con retención del 19 %",
    alq && alq.irpfApplies + "/" + alq.irpfRateBp,
  );

  /* La factura real del cliente: base 750,00. Nada más — ni IVA ni retención
     ni total en la carga, que es justo lo que la cabecera no trae. */
  const bill = erp.registerBill(
    { supplierId: alq.id, number: "7", date: "2026-10-01", baseCents: 75000 },
    "t",
  );
  is(bill.vatCents === 15750, "IVA 157,50 calculado del tipo", bill.vatCents);
  is(bill.irpfCents === 14250, "retención 142,50 tomada del perfil", bill.irpfCents);
  is(bill.totalCents === 76500, "total 765,00 — el importe que verá el banco", bill.totalCents);
  /* Y el contraste que justifica el orden de carga: lo que habría salido de
     deducir el IVA restando la base del total. */
  is(
    bill.totalCents - bill.baseCents === 1500 && bill.vatCents !== bill.totalCents - bill.baseCents,
    "restar base de total habría dado 15,00 de IVA en vez de 157,50",
    bill.totalCents - bill.baseCents,
  );
}

/* ---------- 4 · la segunda pasada no hace nada ---------- */
{
  const erp = freshErp();
  const first = S.planProveedores(erp, plantillaRows());
  S.applyProveedores(erp, first, "t");
  const before = JSON.stringify(erp.state.parties);

  const second = S.planProveedores(erp, plantillaRows());
  is(
    second.creates.length === 0 && second.updates.length === 0 && second.unchanged.length === 3,
    "subir el mismo fichero dos veces: 3 sin cambios, 0 altas, 0 actualizaciones",
    JSON.stringify({
      c: second.creates.length,
      u: second.updates.length,
      s: second.unchanged.length,
    }),
  );
  S.applyProveedores(erp, second, "t");
  is(
    JSON.stringify(erp.state.parties) === before,
    "y aplicarla no cambia un solo byte del fichero de contactos",
  );
}

/* ---------- 5 · una celda vacía no borra nada ---------- */
{
  const erp = freshErp();
  S.applyProveedores(erp, S.planProveedores(erp, plantillaRows()), "t");
  const big = erp.state.parties.find((p) => p.taxId === "B88430459");
  const street = big.billStreet;

  /* La misma empresa, en una hoja que sólo trae el email: ni dirección, ni
     teléfono, ni nada más. */
  const plan = S.planProveedores(erp, [
    {
      row: 2,
      name: "Estrategias BigMat, S.L.U.",
      taxId: "B88430459",
      email: "facturacion@bigmat.example",
    },
  ]);
  is(
    plan.updates.length === 1 && plan.updates[0].changes.length === 1,
    "sólo cambia el email: un cambio, no diez borrados",
    JSON.stringify(plan.updates[0] && plan.updates[0].changes),
  );
  S.applyProveedores(erp, plan, "t");
  const after = erp.state.parties.find((p) => p.taxId === "B88430459");
  is(after.billStreet === street, "el domicilio sigue donde estaba", after.billStreet);
  is(after.email === "facturacion@bigmat.example", "y el email entró", after.email);
}

/* ---------- 6 · roles y alias se suman; el nombre no se reescribe ---------- */
{
  const erp = freshErp();
  const cli = erp.addParty(
    {
      name: "Saltoki Cornellà, S.A.",
      taxId: "A64207400",
      roles: ["customer"],
      billStreet: "Pg Famades, C/ Silici 17",
      billPostalCode: "08940",
      billCity: "Cornellà",
    },
    "t",
  );
  const plan = S.planProveedores(erp, [
    {
      row: 2,
      name: "SALTOKI CORNELLA SA",
      taxId: "A64207400",
      tradeName: "Saltoki Barcelona Norte",
      kind: "Proveedor",
    },
  ]);
  is(plan.updates.length === 1, "casa por NIF aunque el nombre venga sin acentos ni puntos");
  S.applyProveedores(erp, plan, "t");
  const after = erp.party(cli.id);
  is(
    after.roles.indexOf("customer") !== -1 && after.roles.indexOf("supplier") !== -1,
    "sigue siendo cliente Y ahora además proveedor",
    JSON.stringify(after.roles),
  );
  is(
    after.name === "Saltoki Cornellà, S.A.",
    "el nombre del contacto NO se reescribe desde la hoja",
    after.name,
  );
  is(
    (after.aliases || []).indexOf("Saltoki Barcelona Norte") !== -1,
    "el rótulo comercial entra como alias",
    JSON.stringify(after.aliases),
  );
}

/* ---------- 7 · el alias vuelve a casar la misma empresa ---------- */
{
  const erp = freshErp();
  S.applyProveedores(erp, S.planProveedores(erp, plantillaRows()), "t");
  /* Una hoja posterior que usa el RÓTULO donde va la razón social, que es el
     error que se repite — y que no debe crear un segundo Obramat. */
  const plan = S.planProveedores(erp, [{ row: 2, name: "Obramat Badalona", taxId: "B84406289" }]);
  is(
    plan.creates.length === 0 && plan.unchanged.length + plan.updates.length === 1,
    "el rótulo en la columna de la razón social no crea un duplicado",
    JSON.stringify({ c: plan.creates.length, u: plan.updates.length, s: plan.unchanged.length }),
  );
}

/* ---------- 8 · lo que es un error, con su motivo y su fila ---------- */
{
  const erp = freshErp();
  const plan = S.planProveedores(erp, [
    { row: 2, name: "Sin NIF, S.L.", taxId: "" },
    { row: 3, name: "Dígito malo, S.L.", taxId: "B88430450" },
    { row: 4, name: "", taxId: "B70972336" },
    { row: 5, name: "Buena, S.L.", taxId: "B70972336" },
    { row: 6, name: "Repetida, S.L.", taxId: "B70972336" },
    { row: 7, name: "Retención rara, S.L.", taxId: "A64207400", irpf: "mucho" },
    { row: 8, name: "Tipo raro, S.L.", taxId: "B84406289", kind: "Amigo" },
  ]);
  const at = (n) => plan.errors.find((e) => e.row === n);
  is(at(2) && /NIF/.test(at(2).msg), "fila sin NIF: error que lo dice", at(2) && at(2).msg);
  is(
    at(3) && /control/.test(at(3).msg),
    "dígito de control malo: el motivo señala el dígito",
    at(3) && at(3).msg,
  );
  is(at(4) && /razón social/.test(at(4).msg), "fila sin nombre: error", at(4) && at(4).msg);
  is(
    at(6) && /fila 5/.test(at(6).msg),
    "NIF repetido dentro de la hoja: señala la fila anterior",
    at(6) && at(6).msg,
  );
  is(at(7) && /porcentaje/.test(at(7).msg), "retención no numérica: error", at(7) && at(7).msg);
  is(
    at(8) && /Proveedor/.test(at(8).msg),
    "Tipo desconocido: dice los válidos",
    at(8) && at(8).msg,
  );
  is(
    plan.creates.length === 1 && plan.creates[0].row === 5,
    "y la única fila buena de la hoja se sigue dando de alta",
    JSON.stringify(plan.creates.map((c) => c.row)),
  );
}

/* ---------- 8b · la propia empresa no es proveedora suya ---------- */
{
  /* `B26942003` es el NIF que más aparece en los papeles del cliente, porque
     está impreso en todas las facturas que RECIBE. Es exactamente el que una
     hoja hecha a mano recoge por descuido. */
  const erp = freshErp();
  const plan = S.planProveedores(erp, [
    { row: 2, name: "Empresa de pruebas, S.L.", taxId: "B26942003" },
    { row: 3, name: "Un proveedor de verdad, S.L.", taxId: "B70972336" },
  ]);
  is(
    plan.creates.length === 1 &&
      plan.errors.length === 1 &&
      /propia empresa/.test(plan.errors[0].msg),
    "la propia empresa en la hoja es un error, y el resto de la hoja sigue",
    JSON.stringify(plan.errors),
  );
}

/* ---------- 9 · un nombre que ya existe con OTRO NIF no se duplica en silencio ---------- */
{
  const erp = freshErp();
  erp.addParty({ name: "Sinelec Ciutadella, S.L.", taxId: "B70972336", roles: ["supplier"] }, "t");
  const plan = S.planProveedores(erp, [
    { row: 2, name: "Sinelec Ciutadella, S.L.", taxId: "A64207400" },
  ]);
  is(
    plan.creates.length === 0 && plan.errors.length === 1 && /otro NIF/.test(plan.errors[0].msg),
    "mismo nombre con otro NIF: error que nombra el registro que ya existe",
    JSON.stringify(plan.errors),
  );
}

/* ---------- 10 · vacío y cero no son lo mismo ---------- */
{
  const erp = freshErp();
  erp.addParty(
    {
      name: "Con retención, S.L.",
      taxId: "B70972336",
      roles: ["supplier"],
      irpfApplies: true,
      irpfRateBp: 1500,
    },
    "t",
  );
  const blank = S.planProveedores(erp, [
    { row: 2, name: "Con retención, S.L.", taxId: "B70972336", irpf: "" },
  ]);
  is(
    blank.unchanged.length === 1,
    "celda de retención vacía: no opina, no cambia nada",
    JSON.stringify(blank.updates),
  );
  const zero = S.planProveedores(erp, [
    { row: 2, name: "Con retención, S.L.", taxId: "B70972336", irpf: "0" },
  ]);
  is(zero.updates.length === 1, "un cero explícito SÍ es una opinión");
  S.applyProveedores(erp, zero, "t");
  const p = erp.state.parties.find((x) => x.taxId === "B70972336");
  is(p.irpfApplies === false && p.irpfRateBp === 0, "y apaga la retención", p.irpfApplies);
}

/* ---------- 11 · el teléfono acaba en el campo que existe ---------- */
{
  is(S.toBp("19") === 1900 && S.toBp("19%") === 1900 && S.toBp("") === null, "porcentajes");
  is(S.toDays("30") === 30 && S.toDays("") === null, "días de pago");
  const erp = freshErp();
  S.applyProveedores(
    erp,
    S.planProveedores(erp, [
      { row: 2, name: "Fijo, S.L.", taxId: "B70972336", phone: "933788340" },
      { row: 3, name: "Móvil, S.L.", taxId: "A64207400", phone: "629787958" },
    ]),
    "t",
  );
  const fijo = erp.state.parties.find((p) => p.taxId === "B70972336");
  const movil = erp.state.parties.find((p) => p.taxId === "A64207400");
  is(fijo.landline === "933788340" && !fijo.mobile, "un 93… es fijo", fijo.landline);
  is(movil.mobile === "629787958" && !movil.landline, "un 6… es móvil", movil.mobile);
}

/* ---------- 12 · una fila completa deja al proveedor facturable (MDM-10) ---------- */
{
  const erp = freshErp();
  S.applyProveedores(
    erp,
    S.planProveedores(erp, [
      {
        row: 2,
        name: "Completa, S.L.",
        taxId: "B70972336",
        street: "C/ Conreu 2",
        postalCode: "08960",
        city: "Sant Just Desvern",
        province: "Barcelona",
        country: "España",
        phone: "933788340",
        kind: "Subcontrata",
      },
    ]),
    "t",
  );
  const p = erp.state.parties.find((x) => x.taxId === "B70972336");
  const c = erp.partyCompleteness(p.id);
  is(c.ok, "ficha completa: MDM-10 no la bloquea", JSON.stringify(c.missing));
  is(p.roles.indexOf("subcontractor") !== -1, "«Subcontrata» es el rol subcontractor", p.roles);
}

/* ---------- informe ---------- */
const failed = checks.filter((c) => !c.pass);
console.log("\n──── hoja de proveedores ────\n");
for (const c of checks) console.log(`${c.pass ? "✓" : "✗"} ${c.n}${c.d ? `  → ${c.d}` : ""}`);
console.log(`\n${checks.length - failed.length}/${checks.length} comprobaciones pasadas`);
process.exit(failed.length ? 1 : 0);

/* =============================================================================
   The uploaded workbook, read and planned.

   `node tests/book-import/run.mjs`

   WHAT THIS PINS, and why each one can fail on its own:

     · the two formats read at all — header found by NAME, past a preamble;
     · a subpartida with no partida is an ERROR and not a silent unfiled row,
       which is the one rule the operator stated outright;
     · «rewrite what is different» means DIFFERENT — a blank cell erases
       nothing, an equal cell is not a change, and a changed cell is reported
       with its old and new value so a preview can show it;
     · a subpartida with no price OR no cost reads as incomplete;
     · a budget sheet nests, blank Título/Partida cells repeat the row above,
       and the same trade under two títulos stays TWO chapters — the property
       the 17 Sep change exists for, and a budget sheet is where it shows up;
     · the template this ships parses under its own parser, which is the only
       thing that stops the template and the reader drifting apart.
   ========================================================================== */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const B = require("../../site/erp-book-import.js");
const { ERP } = require("../../site/erp-engine.js");

const checks = [];
const ok = (n, d) => checks.push({ n, pass: true, d: d || "" });
const bad = (n, d) => checks.push({ n, pass: false, d: String(d == null ? "" : d) });
const is = (cond, n, d) => (cond ? ok(n) : bad(n, d));

/* ---------- a book with something already in it ---------- */
function bookErp() {
  const erp = new ERP();
  erp.setToday("2026-09-25");
  erp.addListEntry("itemTitles", { code: "BANO", es: "Reforma de baño", ca: "" }, "t");
  erp.addListEntry("itemChapters", { code: "FON", es: "Fontanería", ca: "Lampisteria" }, "t");
  const it = erp.addCatalogueItem(
    {
      code: "SUB-0001",
      desc: "Punto de agua empotrado",
      unit: "ud",
      defaultCostCents: 4200,
      defaultPriceCents: 8500,
    },
    "t",
  );
  erp.setItemPartidas(it.id, ["FON"], "t");
  return erp;
}

/* ---------- 1 · the price book ---------- */
{
  const erp = bookErp();
  const rows = [
    // a título on its own, new
    { row: 2, title: "Reforma de cocina", chapter: "", item: "", ca: "Reforma de cuina" },
    // a título that exists, with a Catalan name it did not have
    { row: 3, title: "Reforma de baño", chapter: "", item: "", ca: "Reforma de bany" },
    // a partida on its own, new
    { row: 4, title: "", chapter: "Alicatado", item: "", ca: "Enrajolat" },
    // an existing subpartida whose price moved and whose cost is unchanged
    {
      row: 5,
      title: "",
      chapter: "FONTANERIA",
      item: "  punto de AGUA empotrado ",
      unit: "ud",
      cost: "42",
      price: "91",
    },
    // a new subpartida with no price — incomplete
    { row: 6, title: "", chapter: "Alicatado", item: "Alicatado 30x60", unit: "m2", cost: "19" },
    // a new subpartida with no cost — also incomplete
    { row: 7, title: "", chapter: "Alicatado", item: "Rodapié cerámico", unit: "ml", price: "12" },
    // the rule: a subpartida with no partida is refused
    { row: 8, title: "", chapter: "", item: "Huérfana" },
  ];
  const p = B.planBook(erp, rows);

  is(
    p.titles.filter((t) => t.action === "create").length === 1 &&
      p.titles.filter((t) => t.action === "create")[0].name === "Reforma de cocina",
    "a new título is created once",
    JSON.stringify(p.titles),
  );
  const tUpd = p.titles.filter((t) => t.action === "update")[0];
  is(
    tUpd && tUpd.changes.length === 1 && tUpd.changes[0].to === "Reforma de bany",
    "an existing título gains only the field that differs",
    JSON.stringify(p.titles),
  );
  is(
    p.chapters.filter((c) => c.action === "create").length === 1,
    "a new partida is created once",
    JSON.stringify(p.chapters),
  );
  is(
    !p.chapters.some((c) => c.action === "update"),
    "…and the partida whose Catalan name already matched is NOT rewritten",
    JSON.stringify(p.chapters),
  );

  const upd = p.items.filter((i) => i.action === "update")[0];
  is(
    upd && upd.changes.length === 1 && upd.changes[0].field === "Precio",
    "a subpartida matched past case, accents and spacing changes only its price",
    JSON.stringify(p.items),
  );
  is(
    upd && String(upd.changes[0].from) === "8500" && String(upd.changes[0].to) === "9100",
    "…and the change carries the old value and the new, for the preview",
    upd && JSON.stringify(upd.changes),
  );

  const created = p.items.filter((i) => i.action === "create");
  is(created.length === 2, "two new subpartidas", JSON.stringify(created.map((c) => c.desc)));
  is(
    created.every((c) => c.incomplete),
    "a subpartida missing EITHER price or cost is marked incomplete",
    JSON.stringify(created.map((c) => [c.desc, c.incomplete])),
  );
  is(
    created.every((c) => c.chapters.length === 1 && c.chapters[0] === "Alicatado"),
    "…and each is filed under the partida on its own row",
    JSON.stringify(created.map((c) => c.chapters)),
  );
  is(
    p.errors.length === 1 && p.errors[0].row === 8,
    "a subpartida with no partida is an error, naming its row",
    JSON.stringify(p.errors),
  );
}

/* ---------- 2 · a blank cell erases nothing ---------- */
{
  const erp = bookErp();
  const p = B.planBook(erp, [
    {
      row: 2,
      title: "",
      chapter: "Fontanería",
      item: "Punto de agua empotrado",
      unit: "",
      price: "",
    },
  ]);
  is(
    p.items.length === 0,
    "a row whose cells are all blank changes nothing at all",
    JSON.stringify(p.items),
  );
}

/* ---------- 3 · the same description twice in one file ---------- */
{
  const erp = bookErp();
  const p = B.planBook(erp, [
    { row: 2, title: "", chapter: "Alicatado", item: "Nueva", unit: "m2", price: "10" },
    { row: 3, title: "", chapter: "Pintura", item: "NUEVA", unit: "m2", price: "12", cost: "6" },
  ]);
  const made = p.items.filter((i) => i.action === "create");
  is(made.length === 1, "one subpartida, not two", JSON.stringify(p.items));
  is(
    made[0] && made[0].values.defaultPriceCents === 1200,
    "…the later row's figures win",
    made[0] && made[0].values.defaultPriceCents,
  );
  is(
    made[0] && made[0].chapters.length === 2,
    "…and it is filed under both partidas it was named in",
    made[0] && JSON.stringify(made[0].chapters),
  );
}

/* ---------- 4 · a budget nests, and repeats ---------- */
{
  const erp = bookErp();
  const rows = [
    {
      row: 2,
      title: "Reforma de baño",
      chapter: "Fontanería",
      item: "Punto de agua empotrado",
      unit: "ud",
      qty: "3",
      price: "85",
      cost: "42",
    },
    {
      row: 3,
      title: "",
      chapter: "",
      item: "Sustitución de bajante",
      unit: "ml",
      qty: "4,5",
      price: "54",
      cost: "26",
    },
    {
      row: 4,
      title: "",
      chapter: "Alicatado",
      item: "Alicatado 30x60",
      unit: "m2",
      qty: "24",
      price: "39",
      cost: "19",
    },
    // the same trade again, under a different título — two chapters, not one
    {
      row: 5,
      title: "Reforma de cocina",
      chapter: "Fontanería",
      item: "Grifería",
      unit: "ud",
      qty: "1",
      price: "145",
      cost: "78",
    },
  ];
  const p = B.planBudget(erp, rows);

  is(
    p.chapters.length === 3,
    "three chapters",
    JSON.stringify(p.chapters.map((c) => c.title + "/" + c.name)),
  );
  is(
    p.chapters[0].lines.length === 2,
    "a blank Título/Partida repeats the row above",
    JSON.stringify(p.chapters[0].lines.map((l) => l.desc)),
  );
  const fons = p.chapters.filter((c) => B.fold(c.name) === "fontaneria");
  is(
    fons.length === 2 && fons[0].title !== fons[1].title,
    "the same partida under two títulos stays TWO chapters",
    JSON.stringify(fons.map((c) => c.title)),
  );
  is(
    p.chapters[0].lines[1].qtyMilli === 4500,
    "a Spanish decimal quantity reads as thousandths",
    p.chapters[0].lines[1].qtyMilli,
  );
  is(
    p.book.items.filter((i) => i.action === "create").length === 3,
    "the three subpartidas the book does not have are planned as new",
    JSON.stringify(p.book.items.map((i) => i.desc + ":" + i.action)),
  );
  is(
    p.book.titles.filter((t) => t.action === "create").length === 1,
    "…and the one título it does not have",
    JSON.stringify(p.book.titles.map((t) => t.name + ":" + t.action)),
  );
}

/* ---------- 5 · the template reads under its own parser ---------- */
{
  for (const kind of ["book", "budget"]) {
    const t = B.plantilla(kind);
    const cols = kind === "budget" ? B.BUDGET_COLUMNS : B.BOOK_COLUMNS;
    is(
      t.rows[0].length === cols.length && t.rows.length > 1,
      `${kind}: the template has a header and worked rows`,
      JSON.stringify(t.rows[0]),
    );
    is(
      t.rows.every((r) => r.length === cols.length),
      `${kind}: every template row has one cell per column`,
      JSON.stringify(t.rows.map((r) => r.length)),
    );
  }
}

/* ---------- 6 · applying a book actually lands it ---------- */
{
  const erp = bookErp();
  const rows = [
    { row: 2, title: "Reforma de cocina", chapter: "", item: "", ca: "Reforma de cuina" },
    { row: 3, title: "", chapter: "Alicatado", item: "", ca: "Enrajolat" },
    {
      row: 4,
      title: "",
      chapter: "Alicatado",
      item: "Alicatado 30x60",
      unit: "m2",
      cost: "19",
      price: "39",
    },
    { row: 5, title: "", chapter: "FONTANERIA", item: "punto de agua empotrado", price: "91" },
  ];
  const before = erp.state.catalogue.length;
  const made = B.applyBook(erp, B.planBook(erp, rows), "t");

  is(
    erp.listAll("itemTitles").some((t) => t.es === "Reforma de cocina"),
    "applying creates the título",
    JSON.stringify(erp.listAll("itemTitles").map((t) => t.es)),
  );
  is(
    erp.listAll("itemChapters").some((c) => c.es === "Alicatado"),
    "…and the partida",
    JSON.stringify(erp.listAll("itemChapters").map((c) => c.es)),
  );
  const made1 = erp.state.catalogue.find((i) => i.desc === "Alicatado 30x60");
  is(
    erp.state.catalogue.length === before + 1 && !!made1,
    "…and exactly one new subpartida",
    erp.state.catalogue.length + " vs " + before,
  );
  is(
    /^SUB-\d{4}$/.test(made1 ? made1.code : ""),
    "…with a correlative código",
    made1 && made1.code,
  );
  const alic = erp.listAll("itemChapters").find((c) => c.es === "Alicatado");
  is(
    made1 && alic && (erp.itemPartidas(made1.id) || []).includes(alic.code),
    "…filed under the partida the sheet named, created in the same run",
    made1 && JSON.stringify(erp.itemPartidas(made1.id)),
  );
  const punto = erp.state.catalogue.find((i) => i.desc === "Punto de agua empotrado");
  is(
    punto && punto.defaultPriceCents === 9100,
    "an existing subpartida is re-priced",
    punto && punto.defaultPriceCents,
  );
  is(
    punto && punto.defaultCostCents === 4200,
    "…and what the sheet left blank is untouched",
    punto && punto.defaultCostCents,
  );
  is(made.items === 1 && made.updated >= 1, "the count reports what it did", JSON.stringify(made));

  // Applying the SAME file again must be a no-op: nothing new, nothing changed.
  const n2 = erp.state.catalogue.length;
  const plan2 = B.planBook(erp, rows);
  is(
    plan2.items.length === 0 && plan2.titles.length === 0 && plan2.chapters.length === 0,
    "the same file a second time plans no change at all",
    JSON.stringify({ i: plan2.items.length, t: plan2.titles.length, c: plan2.chapters.length }),
  );
  B.applyBook(erp, plan2, "t");
  is(
    erp.state.catalogue.length === n2,
    "…and creates nothing",
    erp.state.catalogue.length + " vs " + n2,
  );
}

/* ---------- 7 · a budget is drafted from the sheet ---------- */
{
  const erp = bookErp();
  const cli = erp.addParty(
    {
      name: "Cliente Hoja",
      partyType: "individual",
      roles: ["customer"],
      email: "h@example.invalid",
    },
    "t",
  );
  const b = erp.createBudget({ partyId: cli.id }, "t");
  const rows = [
    {
      row: 2,
      title: "Reforma de baño",
      chapter: "Fontanería",
      item: "Punto de agua empotrado",
      unit: "ud",
      qty: "3",
      price: "85",
      cost: "42",
    },
    {
      row: 3,
      title: "",
      chapter: "",
      item: "Bajante nueva",
      unit: "ml",
      qty: "4,5",
      price: "54",
      cost: "26",
    },
    {
      row: 4,
      title: "Reforma de cocina",
      chapter: "Solados",
      item: "Gres porcelánico",
      unit: "m2",
      qty: "18",
      price: "",
      cost: "23",
    },
  ];
  const plan = B.planBudget(erp, rows);
  const made = B.applyBudget(erp, b.id, plan, "t", { fileName: "obra.xlsx" });

  const v = erp.currentVersion(b.id);
  is(v.chapters.length === 2, "the budget gains a chapter per partida run", v.chapters.length);
  is(
    v.chapters[0].name === "Fontanería" && v.chapters[0].title === "Reforma de baño",
    "…each carrying the título it was written under",
    JSON.stringify(v.chapters.map((c) => c.title + "/" + c.name)),
  );
  const all = v.chapters.reduce((a, c) => a.concat(c.lines), []);
  is(all.length === 3, "three lines", all.length);
  is(
    all[0].qtyMilli === 3000 && all[0].priceCents === 8500,
    "…with the sheet's quantity and price",
    JSON.stringify({ q: all[0].qtyMilli, p: all[0].priceCents }),
  );
  const noPrice = all.find((l) => l.desc === "Gres porcelánico");
  is(
    noPrice && noPrice.pending === true,
    "a line with no price lands «pendiente de valorar»",
    noPrice && noPrice.pending,
  );
  is(
    all.every((l) => l.sourceFile === "obra.xlsx" && l.chapterOriginal),
    "…and every line remembers the file it came from",
    JSON.stringify(all.map((l) => l.sourceFile + "/" + l.chapterOriginal)),
  );
  const linked = all.find((l) => l.desc === "Punto de agua empotrado");
  is(
    linked && !!linked.itemId,
    "a line whose subpartida exists is linked to it",
    linked && linked.itemId,
  );
  is(
    erp.state.catalogue.some((i) => i.desc === "Bajante nueva"),
    "…and one the book lacked was created by the same upload",
    JSON.stringify(erp.state.catalogue.map((i) => i.desc)),
  );
  is(made.lines === 3 && made.chapters === 2, "the count reports the draft", JSON.stringify(made));
}

/* ---------- report ---------- */
const failed = checks.filter((c) => !c.pass);
console.log("\n──── uploaded workbook ────\n");
for (const c of checks) console.log(`${c.pass ? "✓" : "✗"} ${c.n}${c.d ? `  → ${c.d}` : ""}`);
console.log(`\n${checks.length - failed.length}/${checks.length} workbook checks passed`);
process.exit(failed.length ? 1 : 0);

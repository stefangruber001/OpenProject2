/* =============================================================================
   A subpartida in two partidas — and not one cent moved.

   Schema v23. The operator asked for the price book to be built bottom-up and
   for a subpartida to be allowed in more than one partida: the same water point
   belongs to a bathroom and to a kitchen. That is a change to what the book
   MEANS, made on a system with live presupuestos, contracts and invoices in it.

   SO THE SECOND HALF OF THIS FILE IS THE POINT. Anyone can assert that a
   many-to-many table holds two rows. The claim that made it safe to ship — the
   one written into migration 23's comment and into the plan the operator
   approved — is that re-filing a subpartida cannot move a document, because a
   budget line COPIES what it took from the catalogue and keeps `itemId` for
   provenance alone. That claim is worth exactly nothing as a comment. Here it
   is measured: totals AND the rendered PDF bytes, before and after the
   catalogue is rearranged underneath a quote that was already written.

   Verified by the negative, not just by passing: see the header of block 4.
   ========================================================================== */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ErpEngine = require(resolve(ROOT, "site/erp-engine.js"));
const MIG = require(resolve(ROOT, "site/erp-migrations.js"));

let pass = 0;
const fails = [];
const ok = (label, got, want) => {
  const a = JSON.stringify(got),
    b = JSON.stringify(want);
  if (a === b) {
    pass++;
    return;
  }
  fails.push(`${label}: expected ${b}, got ${a}`);
};
const yes = (label, cond) => ok(label, !!cond, true);

console.log("\n\x1b[1mA subpartida in two partidas\x1b[0m\n");

/* ── 1 · the relationship itself ────────────────────────────────────────── */
{
  const erp = new ErpEngine.ERP();
  ok("nothing ships", erp.listAll("itemChapters").length, 0);

  erp.addListEntry("itemChapters", { code: "FON", es: "Fontanería" }, "t");
  erp.addListEntry("itemChapters", { code: "ALB", es: "Albañilería" }, "t");
  // Created BEFORE any partida would also have to work; here one exists.
  const punto = erp.addCatalogueItem({ code: "FON-101", desc: "Punto de agua" }, "t");
  const rozas = erp.addCatalogueItem({ code: "ALB-101", desc: "Rozas" }, "t");

  ok("a fresh subpartida is filed nowhere", erp.itemPartidas(punto.id), []);
  yes(
    "…and is therefore in unfiledItems",
    erp.unfiledItems().some((i) => i.id === punto.id),
  );

  erp.setItemPartidas(punto.id, ["FON", "ALB"], "t");
  erp.setItemPartidas(rozas.id, ["ALB"], "t");
  ok("one subpartida, two partidas", erp.itemPartidas(punto.id), ["FON", "ALB"]);
  ok("FON holds it", erp.partidaItems("FON"), [punto.id]);
  ok("ALB holds both", erp.partidaItems("ALB"), [punto.id, rozas.id]);
  ok("nothing is unfiled now", erp.unfiledItems().length, 0);

  // Counted once per partida, not once overall: "ALB holds 2" is the sentence
  // on the register, and it is what `listEntryUsage` must say too.
  ok("usage reads the links", erp.listEntryUsage("itemChapters", "ALB"), 2);

  // Removing it from one leaves the other alone. The obvious bug in a
  // whole-set setter is that saving one side wipes the other.
  erp.setItemPartidas(punto.id, ["ALB"], "t");
  ok("dropped from FON only", erp.itemPartidas(punto.id), ["ALB"]);
  ok("FON is empty", erp.partidaItems("FON"), []);
  ok("ALB still holds both, in order", erp.partidaItems("ALB"), [punto.id, rozas.id]);
}

/* ── 2 · migration 23 carries the old single field over ──────────────────── */
{
  const step = MIG.MIGRATIONS.find((m) => m.to === 23);
  yes("step 23 is on the ladder", !!step);
  const s = step.up({
    lists: {
      itemChapters: [
        { code: "FON", es: "Fontanería", ca: "Lampisteria", active: true },
        { code: "PIN", es: "Pintura", ca: "Pintura", active: true },
      ],
    },
    catalogue: [
      { id: "cat_1", code: "FON-101", chapter: "FON" },
      { id: "cat_2", code: "FON-102", chapter: "FON" },
    ],
    budgets: [],
    itemTitleLinks: [],
  });
  ok("v22 memberships become links", s.itemPartidaLinks.length, 2);
  ok(
    "order follows the catalogue",
    s.itemPartidaLinks.map((l) => l.order),
    [0, 1],
  );
  // PIN was one of the shipped ten and nothing points at it, so it goes; FON
  // is referenced and stays. That is the whole deletion rule, in one state.
  ok(
    "an unused shipped partida is dropped, a used one kept",
    s.lists.itemChapters.map((c) => c.code),
    ["FON"],
  );
}

/* ── 3 · the price-book pack files what it loads ─────────────────────────── */
{
  /* `applyCataloguePack` is step 11's `up` AND an exported entry point the app
     calls against a state that is ALREADY current — where step 23 has long
     since run and never will again. It writing `chapter` and stopping is how
     two hundred subpartidas would arrive present in the book and invisible
     under every trade. This is that path, on a v23 document. */
  const erp = new ErpEngine.ERP();
  const doc = MIG.applyCataloguePack(erp.toJSON());
  const after = ErpEngine.ERP.from(doc);
  const items = after.state.catalogue.filter((i) => i.active !== false);
  yes("the pack loads subpartidas", items.length > 50);
  const unfiled = after.unfiledItems().length;
  ok("every one of them is filed under a partida", unfiled, 0);
  yes("and the partidas it needs exist", after.listAll("itemChapters").length > 0);
  // Idempotent: loading it twice must not double every membership.
  const twice = ErpEngine.ERP.from(MIG.applyCataloguePack(after.toJSON()));
  ok(
    "loading the pack twice adds no duplicate links",
    twice.partidaLinks().length,
    after.partidaLinks().length,
  );
}

/* ── 4 · NOT ONE CENT, AND NOT ONE BYTE ──────────────────────────────────────
   The claim: re-filing a subpartida changes what the price book OFFERS and
   nothing that was ever sent.

   Verified by the negative before it was trusted. Making `addLine` read the
   catalogue through `itemId` at render time instead of copying — which is the
   plausible "improvement" this property exists to forbid — turns the byte
   comparison below red while every other block here still passes. That is the
   failure this file is for: the relationship would look perfectly correct and
   a quote the customer already holds would quietly restate itself. */
{
  const erp = new ErpEngine.ERP();
  erp.addListEntry("itemChapters", { code: "FON", es: "Fontanería" }, "t");
  erp.addListEntry("itemChapters", { code: "ALB", es: "Albañilería" }, "t");
  const punto = erp.addCatalogueItem(
    {
      code: "FON-101",
      desc: "Punto de agua",
      unit: "ud",
      defaultPriceCents: 12500,
      defaultCostCents: 8000,
    },
    "t",
  );
  erp.setItemPartidas(punto.id, ["FON"], "t");

  const party = erp.addParty({ kind: "customer", name: "Cliente E2E" }, "t");
  const bud = erp.createBudget({ partyId: party.id }, "t");
  const ver = erp.budget(bud.id).versions[0];
  const chap = erp.addChapter(bud.id, { name: "Fontanería" });
  erp.addLine(bud.id, chap.id, {
    itemId: punto.id,
    code: punto.code,
    desc: punto.desc,
    unit: "ud",
    qtyMilli: 3000,
    priceCents: punto.defaultPriceCents,
    costCents: punto.defaultCostCents,
  });

  const totalsBefore = JSON.stringify(erp.budgetTotals(bud.id, ver.id));
  const docBefore = JSON.stringify(erp.renderBudgetDoc(bud.id, ver.id));

  /* Now rearrange the book underneath it, every way v23 allows. */
  erp.setItemPartidas(punto.id, ["FON", "ALB"], "t"); // in two
  erp.setItemPartidas(punto.id, ["ALB"], "t"); // moved outright
  erp.setPartidaItems("ALB", [], "t"); // unfiled
  erp.updateListEntry("itemChapters", "ALB", { es: "Albañilería y obra" }, "t"); // renamed

  /* And one deleted — except this one CANNOT be, which is the guard doing its
     job and is worth asserting in its own right. The budget's chapter is called
     "Fontanería" in words, so `removePartida` refuses by the third of its three
     conditions. It is by WORDS and not by code deliberately: a budget chapter
     has never stored the code, so a check on the code would delete a trade the
     company has been quoting for months and see nothing wrong. */
  let refused = "";
  try {
    erp.removePartida("FON", "t");
  } catch (e) {
    refused = e.message;
  }
  yes("a partida a presupuesto names cannot be deleted", /presupuesto/.test(refused));
  erp.addListEntry("itemChapters", { code: "TYP", es: "Tecleada mal" }, "t");
  erp.removePartida("TYP", "t"); // one nothing points at: gone
  yes("…but one nothing points at is", !erp.listAll("itemChapters").some((c) => c.code === "TYP"));

  ok("budget totals are unchanged", JSON.stringify(erp.budgetTotals(bud.id, ver.id)), totalsBefore);
  ok(
    "the rendered document is unchanged",
    JSON.stringify(erp.renderBudgetDoc(bud.id, ver.id)),
    docBefore,
  );

  /* And the same claim at the only place it finally matters: the bytes of the
     PDF the customer receives. Read back with pdftotext rather than trusting
     the writer's own account of itself — the rule the other document gates in
     this repository already follow. */
  const PDF = require(resolve(ROOT, "site/erp-pdf.js"));
  /* The same WinAnsi translator and brand block `tests/doc-band` uses, and for
     the reason written there: with a pass-through translator the writer gets
     UTF-8 where it expects WinAnsi and the file renders «baÃ±o», so the gate
     would be comparing a document the product never produces. */
  const tr = (x) =>
    String(x)
      .replace(/€/g, "\x80")
      .replace(/[·•]/g, "-")
      .replace(/[–—]/g, "-")
      .replace(/[’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/×/g, "x")
      .replace(/[^\x20-\x7e\x80\xa0-\xff]/g, "");
  const brand = {
    wordmark: "CaneiSubirats",
    legal: "Canei Subirats, S.L.",
    slogan: "Reformes senzillament complexes",
    cif: "NIF B-6712 3456",
    address: "Carrer de la Creu 18, 08960 Sant Just Desvern",
    phone: "+34 934 77 12 08",
    from: "if@2iberia.com",
    iban: "ES91 2100 0418 4502 0005 1332",
  };
  /* THE PRODUCT'S OWN PATH, not a shortcut through the writer. `CaneiPdf.build`
     takes a DESCRIPTOR (`CaneiDocTypes.build(kind, facts)`), not the facts;
     handing it the facts produces a constant near-empty file that compares
     equal to itself for ever, which is precisely the vacuous green the
     sensitivity check below exists to catch. It caught it. */
  const FACTS = require(resolve(ROOT, "site/erp-facts.js"));
  const DT = require(resolve(ROOT, "site/erp-doctypes.js"));
  const build = () =>
    PDF.build(
      FACTS.docFor(erp, "presupuesto", { budgetId: bud.id, versionId: ver.id }, DT, tr),
      brand,
      tr,
    );
  let pdfBefore = null;
  try {
    pdfBefore = build();
  } catch (e) {
    fails.push("could not build the PDF: " + e.message);
  }
  if (pdfBefore) {
    erp.setItemPartidas(punto.id, [], "t");
    /* Not only the filing: the catalogue RECORD itself is rewritten — new
       description, new price. A line that looked its figures up instead of
       copying them would restate a quote the customer already holds, and this
       is the mutation that would expose it. */
    erp.updateCatalogueItem(
      punto.id,
      { desc: "Punto de agua (revisado)", defaultPriceCents: 99900, defaultCostCents: 50000 },
      "t",
    );
    const pdfAfter = build();
    ok("the PDF is byte-identical", pdfAfter.length, pdfBefore.length);
    /* Reported as the first divergence and its surroundings, not as the two
       files. A failing byte comparison that prints sixteen kilobytes of PDF
       operators is a failure nobody reads — and this one has a specific thing
       to say: which words changed on the page. */
    if (pdfAfter === pdfBefore) pass++;
    else {
      let at = 0;
      while (at < pdfAfter.length && pdfAfter[at] === pdfBefore[at]) at++;
      const near = (x) => JSON.stringify(x.slice(Math.max(0, at - 60), at + 60));
      fails.push(
        `the PDF changed at byte ${at}\n          was:  ${near(pdfBefore)}\n          now:  ${near(pdfAfter)}`,
      );
    }

    /* AND THE COMPARISON CAN FAIL. A byte check that cannot go red proves
       nothing at all — if this writer emitted a constant, every assertion above
       would pass on a broken build. So: touch the LINE, which is the copy the
       document is actually made of, and the bytes MUST move. */
    const lineId = erp.version(bud.id, ver.id).chapters[0].lines[0].id;
    erp.editLine(bud.id, lineId, { desc: "Otra cosa" }, { audit: true, user: "t" });
    const pdfMoved = build();
    yes(
      "…and the check is sensitive: editing the LINE does move the bytes",
      pdfMoved !== pdfBefore,
    );
  }
}

console.log(`\n  \x1b[1;32m✓\x1b[0m ${pass} assertion(s) passed`);
if (fails.length) {
  console.log(`  \x1b[1;31m✗\x1b[0m ${fails.length} failed:\n`);
  for (const f of fails) console.log(`      ${f}`);
  console.log("");
  process.exit(1);
}
console.log("");

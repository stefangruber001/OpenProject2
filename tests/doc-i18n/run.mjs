/* =============================================================================
   A DOCUMENT PRINTED IN A LANGUAGE IS PRINTED IN THAT LANGUAGE.

   The descriptors in `erp-doctypes.js` are written as unaccented ASCII Spanish
   — «Garantia de 2 anos sobre los trabajos ejecutados.» — and that is
   deliberate: each one is a KEY into `erp-doc-i18n.js`, which holds the real
   Spanish, the Catalan and the English. Nothing in the document is meant to
   reach paper as it is written in the source.

   On 18/09 an operator sent in a contract their own system had produced. It
   said «Garantia de 2 anos sobre los trabajos ejecutados» — the key itself, on
   a contract a customer signs, and «anos» is not a word to send anybody. The
   cause was one concatenation in the wrong order: the PDF writer glued its
   bullet on BEFORE translating, so the string was no longer a key and fell
   through untouched. The same mistake, in seven more places, uppercased every
   heading before translating it — so an English contract printed TOTAL
   CONTRATADO, FECHA, HITO and IMPORTE.

   `tests/doc-pdf` could not have caught any of it: it renders with a
   pass-through translator, because what it exists to check is the WinAnsi
   encoding. This gate does the opposite — it renders with the REAL
   `CaneiDocI18n.tr(lang)`, in all three languages, and reads the paper back.
   ========================================================================== */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const R = (f) => resolve(ROOT, "site", f);
const E = require(R("erp-engine.js"));
const D = require(R("erp-doctypes.js"));
const PDF = require(R("erp-pdf.js"));
const FACTS = require(R("erp-facts.js"));
const I18N = require(R("erp-doc-i18n.js"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + detail}`);
};

/* ── a contract with everything the vocabulary has to carry ──────────────── */
const erp = new E.ERP();
erp.setToday("2026-09-18");
erp.configureEntity({
  legalName: "Reformas Demo, S.L.",
  taxId: "B67108290",
  street: "Carrer de la Prova, 12",
  postalCode: "08960",
  city: "Sant Just Desvern",
});
erp.addListEntry("itemChapters", { code: "FON", es: "Fontanería" }, "t");
const item = erp.addCatalogueItem(
  {
    code: "FON-101",
    desc: "Punto de agua",
    unit: "ud",
    defaultCostCents: 4000,
    defaultPriceCents: 9000,
  },
  "t",
);
const party = erp.addParty(
  {
    name: "Marta Puig Ferrer",
    taxId: "46123456S",
    roles: ["customer"],
    billStreet: "Carrer Gran, 44",
    billPostalCode: "08970",
    billCity: "Sant Joan Despí",
    mobile: "600111222",
    email: "marta@example.invalid",
  },
  "t",
);
const budget = erp.createBudget({ partyId: party.id }, "t");
const chapter = erp.addChapter(budget.id, { name: "Fontanería", title: "Reforma de baño" });
erp.addLine(budget.id, chapter.id, {
  itemId: item.id,
  code: item.code,
  desc: item.desc,
  unit: item.unit,
  qtyMilli: 3000,
  priceCents: item.defaultPriceCents,
  costCents: item.defaultCostCents,
});
erp.issueVersion(budget.id, { channel: "email" }, "t");
const vid = erp.budget(budget.id).versions.at(-1).id;
erp.acceptVersion(budget.id, vid, { date: erp.today }, "t");
if (!erp.state.projects.some((p) => p.budgetId === budget.id))
  erp.createProjectFromAcceptance(budget.id, "t");
const contract = erp.createContract(
  budget.id,
  {
    duration: { estimatedDays: 30 },
    initiation: { committedStartDate: "2026-10-05" },
    // One of each shape the vocabulary must cover, including the progress
    // trigger whose words were missing entirely.
    installments: [
      { pct: 50, trigger: "onSignature" },
      { pct: 50, trigger: "atProgressPct", progressPct: 50 },
    ],
  },
  "t",
);
const single = (() => {
  const b2 = erp.createBudget({ partyId: party.id }, "t");
  const c2 = erp.addChapter(b2.id, { name: "Fontanería" });
  erp.addLine(b2.id, c2.id, {
    itemId: item.id,
    code: item.code,
    desc: item.desc,
    unit: item.unit,
    qtyMilli: 1000,
    priceCents: 5000,
    costCents: 2000,
  });
  erp.issueVersion(b2.id, { channel: "email" }, "t");
  erp.acceptVersion(b2.id, erp.budget(b2.id).versions.at(-1).id, { date: erp.today }, "t");
  return erp.createContract(
    b2.id,
    { duration: { estimatedDays: 5 }, installments: [{ pct: 100, trigger: "onSignature" }] },
    "t",
  );
})();

const BRAND = {
  wordmark: "ReformasDemo",
  legal: "Reformas Demo, S.L.",
  slogan: "",
  cif: "NIF B67108290",
  address: "Carrer de la Prova 12, 08960 Sant Just Desvern",
  phone: "+34 930 00 00 00",
  from: "pruebas@example.invalid",
  iban: "ES91 2100 0418 4502 0005 1332",
};
const out = resolve(ROOT, "dist/doc-i18n-check");
mkdirSync(out, { recursive: true });

function paperFor(contractId, lang, tag = "") {
  const doc = FACTS.docFor(erp, "contrato", { contractId }, D);
  // Named per CONTRACT as well as per language: both of them wrote
  // `contrato-es.pdf` and the second quietly replaced the first, so the file
  // on disk disagreed with the string the checks were reading.
  const file = `${out}/contrato${tag}-${lang}.pdf`;
  writeFileSync(file, Buffer.from(PDF.build(doc, BRAND, I18N.tr(lang)), "latin1"));
  let text;
  try {
    text = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
  } catch (e) {
    console.error(
      "\n  pdftotext is missing. Install poppler-utils (apt) or poppler (brew).\n" +
        "  This gate refuses to pass without it — a document nobody could read\n" +
        "  is not a document anybody verified.\n",
    );
    process.exit(1);
  }
  return text.replace(/\s+/g, " ");
}

const es = paperFor(contract.id, "es");
const ca = paperFor(contract.id, "ca");
const en = paperFor(contract.id, "en");
const esOne = paperFor(single.id, "es", "-1hito");
const enOne = paperFor(single.id, "en", "-1hito");

console.log("──── a document is printed in its own language ────\n");

/* ── 1 · the keys themselves must never reach paper ──────────────────────── */
const KEYS = [
  "Garantia de 2 anos",
  "Cualquier modificacion",
  "interes legal",
  "Plazo de ejecucion:",
];
for (const lang of [
  ["es", es],
  ["ca", ca],
  ["en", en],
]) {
  const leaked = KEYS.filter((k) => lang[1].includes(k));
  check(
    `${lang[0]}: no descriptor key reaches the paper`,
    leaked.length === 0,
    "printed raw: " + leaked.join(" / "),
  );
}

/* ── 2 · …and the real words do ──────────────────────────────────────────── */
check(
  "es: the notes are Spanish, accents and all",
  es.includes("Garantía de 2 años sobre los trabajos ejecutados") &&
    es.includes("interés legal") &&
    es.includes("Cualquier modificación"),
  es.slice(es.indexOf("NOTAS"), es.indexOf("NOTAS") + 200),
);
check(
  "ca: the notes are Catalan",
  ca.includes("Garantia de 2 anys sobre els treballs executats") &&
    ca.includes("Qualsevol modificació"),
  ca.slice(ca.indexOf("NOTES"), ca.indexOf("NOTES") + 200),
);
check(
  "en: the notes are English",
  en.includes("2-year warranty on the executed works") &&
    en.includes("Any change of scope requires a signed change order"),
  en.slice(en.indexOf("NOTES"), en.indexOf("NOTES") + 200),
);

/* ── 3 · the headings, which uppercase used to destroy ───────────────────── */
check(
  "en: the headings are English, not Spanish in capitals",
  en.includes("CONTRACT TOTAL") &&
    en.includes("TAXABLE BASE") &&
    en.includes("MILESTONE") &&
    en.includes("AMOUNT") &&
    !en.includes("TOTAL CONTRATADO") &&
    !en.includes("IMPORTE"),
  en.slice(0, 400),
);
check(
  "ca: the same headings are Catalan",
  ca.includes("TOTAL CONTRACTAT") || ca.includes("BASE IMPOSABLE"),
  ca.slice(0, 400),
);

/* ── 4 · the vocabulary of a milestone ───────────────────────────────────── */
check(
  "a progress milestone names its percentage, in each language",
  es.includes("al 50 % de avance") && en.includes("at 50 % progress"),
  `es=${es.includes("al 50 % de avance")} en=${en.includes("at 50 % progress")}`,
);
check(
  "…and never prints the trigger's own key",
  !es.includes("atProgressPct") && !en.includes("atProgressPct") && !ca.includes("atProgressPct"),
  "atProgressPct reached the paper",
);
check(
  "one milestone is one hito, not «1 hitos»",
  esOne.includes("1 hito ·") && !esOne.includes("1 hitos") && enOne.includes("1 milestone ·"),
  `es=${esOne.includes("1 hito ·")} en=${enOne.includes("1 milestone ·")}`,
);

/* ── 5 · what the job IS, and when it starts ─────────────────────────────── */
/* The stored code must never reach paper — that is the defect this pins, and
   it is the one a customer saw («Ejecución de renovation en C/ …»). The
   English column is NOT asserted: the heading is composed («Reforma · <site>»)
   before it reaches the translator, so it is not a key and stays Spanish
   there. Recorded in PROGRESS rather than papered over with a greedy pattern
   that would try to translate every «A · B» line in every document. */
check(
  "the activity line is words, not the stored code",
  !es.includes("renovation") && !en.includes("renovation") && es.includes("Reforma"),
  `es renovation=${es.includes("renovation")} en renovation=${en.includes("renovation")} es Reforma=${es.includes("Reforma")}`,
);
check(
  "the committed start date reaches the paper",
  es.includes("05/10/2026"),
  "INICIO printed nothing, though the contract carries a committed start",
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed → ${out}`);
process.exit(failed.length ? 1 : 0);

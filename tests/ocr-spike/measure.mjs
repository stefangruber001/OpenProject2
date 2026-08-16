/* S0b — measure what is actually readable, per field, per input quality. */
import fs from "node:fs";

// Ground truth: the eleven fields ADM-03 says must be extracted.
const TRUTH = {
  issuer: "Distribuciones Cerygres",
  nif: "A08932907",
  docType: "FACTURA",
  number: "26OFV001345",
  date: "26/02/2026",
  dueDate: "27/03/2026",
  base: "1.683,96",
  vatRate: "21",
  vatAmount: "353,63",
  total: "2.037,59",
  iban: "ES63 2100 0362 1601 0102 4471",
};

const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const squash = (s) =>
  norm(s)
    .toLowerCase()
    .replace(/[^a-z0-9,.]/g, "");

/** A field counts as found when its value appears in the text, tolerant of spacing. */
function score(text) {
  const flat = norm(text);
  const tight = squash(text);
  const out = {};
  for (const [k, v] of Object.entries(TRUTH)) {
    out[k] = flat.includes(v) || tight.includes(squash(v));
  }
  return out;
}

async function pdfText(path) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(path)),
    useSystemFonts: true,
  }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const c = await (await doc.getPage(p)).getTextContent();
    out += c.items.map((i) => i.str).join(" ") + "\n";
  }
  return out;
}

async function ocr(path, langs) {
  const { createWorker } = await import("tesseract.js");
  const w = await createWorker(langs, 1, {
    langPath: "./langs",
    gzip: true,
    cacheMethod: "none",
    logger: () => {},
  });
  const t0 = Date.now();
  const { data } = await w.recognize(path);
  const ms = Date.now() - t0;
  await w.terminate();
  return { text: data.text, conf: data.confidence, ms };
}

const rows = [];
const digital = await pdfText("invoice-digital.pdf");
rows.push({
  input: "PDF digital (text layer)",
  engine: "pdf.js",
  ms: 0,
  conf: 100,
  ...score(digital),
});

for (const f of ["scan-good.jpg", "scan-poor.jpg", "photo-phone.jpg"]) {
  const r = await ocr(f, "spa");
  rows.push({
    input: f,
    engine: "tesseract spa",
    ms: r.ms,
    conf: Math.round(r.conf),
    ...score(r.text),
  });
  fs.writeFileSync(f + ".txt", r.text);
}

const FIELDS = Object.keys(TRUTH);
console.log(
  "\n" + "input".padEnd(26) + "engine".padEnd(15) + "time".padEnd(8) + "conf".padEnd(6) + "hits",
);
for (const r of rows) {
  const hit = FIELDS.filter((f) => r[f]).length;
  console.log(
    r.input.padEnd(26) +
      r.engine.padEnd(15) +
      (r.ms ? (r.ms / 1000).toFixed(1) + "s" : "—").padEnd(8) +
      String(r.conf).padEnd(6) +
      `${hit}/${FIELDS.length}`,
  );
}
console.log("\nper field:");
console.log("field".padEnd(12) + rows.map((r) => r.input.slice(0, 13).padEnd(15)).join(""));
for (const f of FIELDS) {
  console.log(f.padEnd(12) + rows.map((r) => (r[f] ? "✓" : "✗").padEnd(15)).join(""));
}
fs.writeFileSync("results.json", JSON.stringify(rows, null, 2));

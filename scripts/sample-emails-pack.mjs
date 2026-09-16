/**
 * THE SAMPLE PACK AS ONE PDF — the deliverable the operator asked for.
 *
 * `sample-emails.mjs` produces the parts: every email this ERP composes, each
 * one's `.eml`, each one's branded HTML body, and the PDF each one attaches.
 * This binds them into a single document in the order somebody reads it: cover,
 * inventory, then each email followed immediately by the file it carries.
 *
 * SECTION BY SECTION, NOT ONE LONG PAGE. Each part is rendered to its own PDF
 * and the whole is joined with `pdfunite`. A single render would give no way to
 * put an attachment straight after the email that carries it — it would have to
 * be guessed from a page count, and a guess that drifts puts the wrong invoice
 * behind the wrong message.
 *
 * The commentary is ENGLISH, per CLAUDE.md: the product speaks Spanish,
 * Catalan and English, and the reporting does not. The emails themselves are
 * reproduced exactly as they are sent — Spanish, unedited — because that is the
 * thing being shown.
 *
 * Run:  node scripts/sample-emails-pack.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { samples, gaps, iss, erp, OUT, PARTS, latin1 } from "./sample-emails.mjs";

const ROOT = path.resolve(OUT, "..", "..");
/* The same resolution scripts/guides-pdf.mjs and the browser suite use, and for
   the same reason: the workspace hoists playwright-core under .pnpm, where a
   bare import cannot reach it, and CI may have the full package instead. */
const PW = path.resolve(
  ROOT,
  "node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js",
);
const CHROME =
  process.env.CHROME_PATH ||
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find((p) =>
    fs.existsSync(p),
  ) ||
  undefined;
const chromium = await (async () => {
  for (const spec of [PW, "playwright-core", "playwright"]) {
    try {
      const m = await import(spec);
      const c = (m.default || m).chromium;
      if (c) return c;
    } catch {}
  }
  throw new Error("playwright-core not found (run `pnpm install`)");
})();
const SECTIONS = path.join(OUT, "sections");
fs.mkdirSync(SECTIONS, { recursive: true });

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/* The pack's own chrome, in the product's palette. Every selector is prefixed:
   the email bodies are dropped in with their inline styles intact and nothing
   here may reach inside them. */
const CSS = `
  @page { size: A4; margin: 16mm 14mm; }
  html,body { margin:0; padding:0; }
  body { font:400 10.5pt/1.5 Georgia,'Times New Roman',serif; color:#3D3D3D; }
  .pk-h1 { font:400 26pt/1.15 Georgia,serif; color:#000; margin:0 0 6mm; }
  .pk-h2 { font:400 15pt/1.2 Georgia,serif; color:#000; margin:0 0 3mm;
           border-bottom:2px solid #48733C; padding-bottom:2mm; }
  .pk-kicker { font:700 8pt/1 Inter,Arial,sans-serif; letter-spacing:.22em;
               text-transform:uppercase; color:#48733C; margin:0 0 3mm; }
  .pk-lede { font-size:11pt; color:#3D3D3D; margin:0 0 5mm; max-width:150mm; }
  .pk-note { font-size:9pt; color:#6B6B6B; margin:0 0 3mm; }
  .pk-tbl { width:100%; border-collapse:collapse; font:400 8.5pt/1.4 Inter,Arial,sans-serif; }
  .pk-tbl th { text-align:left; border-bottom:1.5px solid #48733C; padding:2mm 2mm 1.5mm;
               font-weight:700; color:#000; font-size:7.5pt; letter-spacing:.06em;
               text-transform:uppercase; }
  .pk-tbl td { border-bottom:.5px solid #D8D8D4; padding:1.8mm 2mm; vertical-align:top; }
  .pk-tbl tr:nth-child(even) td { background:#F6F6F4; }
  .pk-env { border:1px solid #D8D8D4; border-left:3px solid #48733C; background:#F6F6F4;
            padding:4mm 5mm; margin:0 0 5mm; font:400 9.5pt/1.6 Inter,Arial,sans-serif; }
  .pk-env dl { margin:0; display:grid; grid-template-columns:26mm 1fr; gap:1mm 3mm; }
  .pk-env dt { font-weight:700; color:#48733C; font-size:8pt; letter-spacing:.05em;
               text-transform:uppercase; padding-top:.6mm; }
  .pk-env dd { margin:0; color:#1F1F1F; }
  .pk-sub { font-weight:700; font-size:11pt; }
  .pk-lbl { font:700 7.5pt/1 Inter,Arial,sans-serif; letter-spacing:.16em;
            text-transform:uppercase; color:#6B6B6B; margin:0 0 2mm; }
  .pk-plain { white-space:pre-wrap; font:400 8.5pt/1.5 'SF Mono',Menlo,Consolas,monospace;
              background:#FFF; border:1px solid #D8D8D4; padding:3mm 4mm; margin:0 0 5mm;
              color:#3D3D3D; }
  .pk-frame { border:1px solid #D8D8D4; background:#EDEDEB; padding:4mm; }
  .pk-foot { margin-top:6mm; font-size:8.5pt; color:#6B6B6B; border-top:1px solid #D8D8D4;
             padding-top:2mm; }
  .pk-warn { border:1px solid #C8A33C; background:#FBF6E7; padding:3mm 4mm; margin:0 0 5mm;
             font:400 9.5pt/1.5 Inter,Arial,sans-serif; color:#5B4A12; }
`;

const page = (inner) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${inner}</body></html>`;

/** The body of an email document, lifted out so the pack's page does not nest
 *  a second <html>. The inline styles travel with it, which is the whole
 *  reason the email design survives a mail client. */
const innerBody = (html) => {
  const m = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return m ? m[1] : html;
};

const browser = await chromium.launch({ executablePath: CHROME });
const pg = await browser.newPage();
const rendered = [];

async function renderTo(file, html) {
  await pg.setContent(html, { waitUntil: "load" });
  await pg.emulateMedia({ media: "print" });
  await pg.pdf({ path: file, format: "A4", printBackground: true });
  rendered.push(file);
}

/* ---------------------------------------------------------------- 1 · cover */
const withAtt = samples.filter((s) => s.attach);
const families = [...new Set(samples.map((s) => s.family))];
await renderTo(
  path.join(SECTIONS, "00-cover.pdf"),
  page(`
  <p class="pk-kicker">Canei Subirats · ERP</p>
  <h1 class="pk-h1">Email sample pack</h1>
  <p class="pk-lede">Every email this system composes, with the document each one
   attaches. ${samples.length} emails across ${families.length} families;
   ${withAtt.length} carry an attachment.</p>
  <div class="pk-env"><dl>
    <dt>Company</dt><dd>${esc(iss.legalName)}${iss.taxId ? " · " + esc(iss.taxId) : ""}</dd>
    <dt>Sender</dt><dd>${esc(iss.email || "(not configured)")}</dd>
    <dt>Data</dt><dd>Demonstration workspace, as at ${esc(erp.state.today)}</dd>
    <dt>Generated</dt><dd>${new Date().toISOString().slice(0, 10)}</dd>
  </dl></div>
  <h2 class="pk-h2">How to read this</h2>
  <p class="pk-lede">Each email gets one page: the envelope it is sent with, the
   plain-text part a phone notification shows, and the branded HTML body the
   recipient sees. Where an email carries a document, that document follows
   immediately — the real file, not a picture of it.</p>
  <p class="pk-lede">Nothing here was written for the pack. Every subject line,
   sentence, name, reference and figure comes from the product's own code
   running against the demonstration company: the message library from the
   engine, the token fill from the messaging capability, the branded body from
   the same function the send path uses, and the attachments from the same
   writer that produces the customer's download.</p>
  <div class="pk-warn"><b>Nothing in this system sends email.</b> A composed
   message is written into the company mailbox's own Drafts folder; the send
   button is the operator's, in their own mail client, after they have read it.
   The addresses in this pack are demonstration addresses and the account
   credentials shown are not valid.</div>
  ${
    gaps.length
      ? `<h2 class="pk-h2">Not shown</h2>${gaps
          .map((g) => `<p class="pk-note"><b>${esc(g.label)}</b> — ${esc(g.why)}.</p>`)
          .join("")}`
      : `<p class="pk-note">No email in the library was left out.</p>`
  }
`),
);

/* ------------------------------------------------------------ 2 · inventory */
await renderTo(
  path.join(SECTIONS, "01-inventory.pdf"),
  page(`
  <p class="pk-kicker">Contents</p>
  <h1 class="pk-h1">The ${samples.length} emails</h1>
  <table class="pk-tbl"><thead><tr>
    <th style="width:7mm">#</th><th>Email</th><th>What raises it</th>
    <th>Goes to</th><th>Attaches</th></tr></thead><tbody>
  ${samples
    .map(
      (s) => `<tr>
    <td>${s.n}</td>
    <td><b>${esc(s.label)}</b><br><span style="color:#6B6B6B">${esc(s.key)} · ${esc(s.family)}</span></td>
    <td>${esc(s.trigger)}<br><span style="color:#6B6B6B">event: ${esc(s.event)}</span></td>
    <td>${esc(s.toName || "—")}<br><span style="color:#6B6B6B">${esc(s.toEmail)}</span></td>
    <td>${s.attach ? esc(s.attach.name) : "—"}</td></tr>`,
    )
    .join("")}
  </tbody></table>
  <h2 class="pk-h2" style="margin-top:8mm">Attachments, and where they come from</h2>
  <p class="pk-lede">Three documents appear as attachments, chosen by the
   reference the message is about — a quote reference attaches the quote, an
   invoice reference the invoice, a contract reference the contract. Each is
   built by the same writer that produces the copy the customer downloads from
   the app, so the file in the email and the file on screen cannot differ.</p>
  <table class="pk-tbl"><thead><tr><th>File</th><th>Document</th><th>Language</th>
    <th>Pages</th><th>On email</th></tr></thead><tbody>
  ${withAtt
    .map((s) => {
      const f = path.join(PARTS, s.stem + "-" + s.attach.name);
      const info = spawnSync("pdfinfo", [f], { encoding: "utf8" }).stdout || "";
      const pages = (/^Pages:\s*(\d+)/m.exec(info) || [, "?"])[1];
      return `<tr><td>${esc(s.attach.name)}</td><td>${esc(s.attach.kind)}</td>
        <td>${esc(s.attach.lang)}</td><td>${pages}</td><td>#${s.n} ${esc(s.label)}</td></tr>`;
    })
    .join("")}
  </tbody></table>
`),
);

/* ------------------------------------------------- 3 · one page per email */
for (const s of samples) {
  const attFile = s.attach ? path.join(PARTS, s.stem + "-" + s.attach.name) : null;
  await renderTo(
    path.join(SECTIONS, `${String(s.n + 10).padStart(2, "0")}-${s.key}.pdf`),
    page(`
    <p class="pk-kicker">Email ${s.n} of ${samples.length} · ${esc(s.family)}</p>
    <h1 class="pk-h1" style="font-size:20pt;margin-bottom:4mm">${esc(s.label)}</h1>
    <div class="pk-env"><dl>
      <dt>From</dt><dd>${esc(iss.tradeName || iss.legalName)} &lt;${esc(iss.email || "")}&gt;</dd>
      <dt>To</dt><dd>${esc(s.toName)} &lt;${esc(s.toEmail)}&gt;</dd>
      <dt>Subject</dt><dd class="pk-sub">${esc(s.subject)}</dd>
      <dt>Attachment</dt><dd>${s.attach ? esc(s.attach.name) + " — follows this page" : "none"}</dd>
      <dt>Raised by</dt><dd>${esc(s.trigger)}</dd>
      <dt>Rule</dt><dd>${esc(s.rule)}</dd>
      <dt>About</dt><dd>${esc(s.ref)} · ${esc(s.date)}</dd>
      <dt>Template</dt><dd>${esc(s.key)}</dd>
    </dl></div>
    <p class="pk-lbl">Plain-text part — what a phone notification shows</p>
    <div class="pk-plain">${esc(s.text)}</div>
    <p class="pk-lbl">HTML part — what the recipient sees</p>
    <div class="pk-frame">${innerBody(s.html)}</div>
    <p class="pk-foot">Envelope ${s.emlBytes.toLocaleString("en-GB")} bytes ·
     multipart/mixed with a text and an HTML alternative${
       s.attach ? " and one PDF attachment" : ""
     } · <code>X-Unsent: 1</code>, so a mail client opens it as a draft to finish
     rather than a message to display.</p>
  `),
  );
  if (attFile) {
    const tagged = path.join(SECTIONS, `${String(s.n + 10).padStart(2, "0")}-${s.key}-cover.pdf`);
    await renderTo(
      tagged,
      page(`
      <p class="pk-kicker">Attachment to email ${s.n}</p>
      <h1 class="pk-h1" style="font-size:20pt;margin-bottom:4mm">${esc(s.attach.name)}</h1>
      <p class="pk-lede">The ${esc(s.attach.kind)} carried by <b>${esc(s.label)}</b>, reproduced
       on the following page${/Pages:\s*1\b/.test(spawnSync("pdfinfo", [attFile], { encoding: "utf8" }).stdout || "") ? "" : "s"}
       exactly as it is attached. Built by the same writer that produces the
       customer's own download, from the same record.</p>
      <div class="pk-env"><dl>
        <dt>Reference</dt><dd>${esc(s.ref)}</dd>
        <dt>Document</dt><dd>${esc(s.attach.kind)}</dd>
        <dt>Language</dt><dd>${esc(s.attach.lang)}</dd>
        <dt>Bytes</dt><dd>${fs.statSync(attFile).size.toLocaleString("en-GB")}</dd>
      </dl></div>
      ${s.attach.note ? `<p class="pk-note">${esc(s.attach.note)}</p>` : ""}
    `),
    );
    rendered.push(attFile);
  }
}

await browser.close();

/* ---------------------------------------------------------------- 4 · bind */
const PACK = path.join(OUT, "EMAIL-SAMPLE-PACK.pdf");
const unite = spawnSync("pdfunite", [...rendered, PACK], { encoding: "utf8" });
if (unite.status !== 0) throw new Error("pdfunite failed: " + unite.stderr);

const info = spawnSync("pdfinfo", [PACK], { encoding: "utf8" }).stdout || "";
const pages = (/^Pages:\s*(\d+)/m.exec(info) || [, "?"])[1];
const text = spawnSync("pdftotext", [PACK, "-"], { encoding: "utf8" }).stdout || "";

/* The pack has to CONTAIN what it claims to. Checked here rather than trusted:
   a 40-page PDF that silently lost a section looks exactly like one that did
   not, and this file is going to a client. */
const missing = [];
for (const s of samples) {
  if (!text.includes(s.subject)) missing.push(`subject of #${s.n} (${s.key})`);
  if (s.attach && !text.includes(s.attach.name)) missing.push(`attachment name of #${s.n}`);
}
if (!/Email sample pack/.test(text)) missing.push("the cover");
if (missing.length) throw new Error("the pack is missing: " + missing.join(", "));

console.log(`\n${PACK}`);
console.log(`${pages} pages · ${(fs.statSync(PACK).size / 1024).toFixed(0)} KB`);
console.log(
  `${samples.length} emails, ${withAtt.length} attachments, ${rendered.length} sections bound`,
);
console.log("every subject line and attachment name verified present in the text layer");
void latin1;

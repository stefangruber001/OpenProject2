/**
 * THE SAMPLE PACK: every email this ERP can compose, with its attachments.
 *
 * Asked for by the operator — one PDF holding a sample of every email the
 * system generates, and a sample of every attachment those emails carry.
 *
 * WHY IT IS GENERATED AND NOT DRAWN. A sample pack assembled by hand is a
 * drawing of the product: it agrees with the code on the day it is made and
 * drifts silently afterwards, which is how a client ends up approving wording
 * that was changed two sessions ago. So every part of this comes from the
 * product's own code:
 *
 *   · the message library        `STANDARD_COMMS_TEMPLATES` (erp-engine.js)
 *   · which event raises it      `commsEvents()` + the seeded `commsRules`
 *   · the `{{token}}` fill       the comms capability, through erp-bridge
 *   · the branded HTML body      `CaneiEml.bodyHtml` — the same function
 *                                erp.html sends with
 *   · the envelope (.eml)        `CaneiEml.build`
 *   · the attachments            `CaneiErpFacts.docFor` + `CaneiPdf.build`,
 *                                the same PDF the customer downloads
 *
 * Nothing here invents a sentence, an address or a figure. Where the seeded
 * company has no record to raise an email about, that is reported as a gap
 * rather than filled with a plausible one.
 *
 * Run:  node scripts/sample-emails.mjs
 * Out:  dist/sample-emails/EMAIL-SAMPLE-PACK.pdf  (+ the parts it was made of)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createContext, runInContext } from "node:vm";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(ROOT, "dist/sample-emails");
const PARTS = path.join(OUT, "parts");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(PARTS, { recursive: true });

/* ---------------------------------------------------------------- the engine */
const { ERP } = require("../site/erp-engine.js");
const Seed = require("../site/erp-seed.js");
const Bridge = require("../site/erp-bridge.js");

/* The UMD modules the page loads as scripts. Through a VM sandbox exactly as
   tests/doc-pdf does it: imported as ES modules they take the UMD's global
   branch and the named export comes back undefined, which fails as a missing
   function rather than as a loading problem. Pictograms FIRST — the PDF writer
   captures it at factory time. */
const sandbox = { globalThis: null, module: undefined, console, btoa, atob };
sandbox.globalThis = sandbox;
createContext(sandbox);
for (const f of [
  "erp-pictograms.js",
  "erp-pdf.js",
  "erp-doc-i18n.js",
  "erp-doctypes.js",
  "erp-facts.js",
  "erp-eml.js",
])
  runInContext(fs.readFileSync(path.join(ROOT, "site", f), "utf8"), sandbox);
const { CaneiPdf, CaneiDocTypes, CaneiDocI18n, CaneiErpFacts, CaneiEml } = sandbox;
for (const [n, v] of Object.entries({
  CaneiPdf,
  CaneiDocTypes,
  CaneiDocI18n,
  CaneiErpFacts,
  CaneiEml,
}))
  if (!v) throw new Error(`site/${n} did not publish its global`);

/* The demonstration company, on the date the app opens with. `Seed.build`
   makes its own ERP; `ERP` is required above because the seed needs it loaded. */
void ERP;
const erp = Seed.build("2026-05-05");
const comms = Bridge.comms || null;
const render = (t, vars) => (comms && comms.available ? comms.render(t, vars) : t);
const iss = erp._issuerBlock();

/* ------------------------------------------------------- attachments, by ref
   The same branching `draftAttachmentFor` uses in erp.html: the reference on
   the message decides which document is attached, because the message is about
   that document and nothing else. The quote is the one exception — it is built
   through the budget route so its graphic annex comes with it, and that route
   is async and browser-only, so here the quote is attached through the same
   descriptor the other documents use and the annex is noted as absent. */
const brand = {
  wordmark: iss.tradeName,
  legal: iss.legalName,
  slogan: "",
  cif: iss.taxId,
  address: iss.address,
  phone: iss.phone,
  from: iss.email,
  iban: iss.iban,
};
function attachmentFor(ref) {
  let kind = null,
    refs = null,
    lang = "es";
  if (/^PRE-/.test(ref)) {
    const b = erp.state.budgets.find((x) => x.number === ref);
    if (!b) return null;
    kind = "presupuesto";
    refs = { budgetId: b.id, versionId: b.acceptedVersionId || b.currentVersionId };
    lang = b.language || "es";
  } else if (/^(FAC|ABO)-/.test(ref)) {
    const inv = erp.state.invoices.find((x) => x.number === ref);
    if (!inv) return null;
    kind = inv.kind === "creditNote" ? "rectificativa" : "factura";
    refs = { invoiceId: inv.id };
    lang = inv.language || "es";
  } else if (/^CTR-/.test(ref)) {
    const c = erp.state.contracts.find((x) => x.number === ref && x.origin !== "external");
    if (!c) return null;
    kind = "contrato";
    refs = { contractId: c.id, lineText: (l) => l.desc || "" };
    lang = c.language || "es";
  } else return null;
  const T = CaneiDocI18n.tr(lang);
  const doc = CaneiErpFacts.docFor(erp, kind, refs, CaneiDocTypes, T);
  const pdf = CaneiPdf.build(doc, brand, T);
  /* THE ONE PLACE THIS SAMPLE IS NOT THE WHOLE OF THE SENT FILE. A quote the
     app sends goes through the budget route, which resolves the photographs of
     a line into a graphic annex; that route draws in a browser and cannot run
     here. It matters only for a quote that HAS photographs, so rather than
     claim the files are identical, the pack says which quote this is. */
  let note = null;
  if (kind === "presupuesto") {
    const b = erp.state.budgets.find((x) => x.id === refs.budgetId);
    const v = (b.versions || []).find((x) => x.id === refs.versionId) || {};
    const plates = (v.chapters || []).reduce(
      (n, ch) => n + (ch.lines || []).filter((l) => (l.images || []).length).length,
      0,
    );
    note = plates
      ? `The sent copy also carries a graphic annex of ${plates} plate(s), which is drawn in the app and is not reproduced here.`
      : "This quote has no photographs, so its graphic annex is empty and the file above is the whole of what is sent.";
  }
  return { name: ref + ".pdf", kind, lang, pdf, note };
}

/* ------------------------------------------------- what the rules would raise
   `commsEvents()` is a projection of what is true now, so this is the real
   answer to "which of these emails does this company actually have cause to
   send today", not a list of what the library contains. */
const events = erp.commsEvents();
const evFor = (name) => events.filter((e) => e.event === name);
const templates = erp.ensureCommsTemplates("sample-pack");
const rules = erp.state.commsRules || [];
const tplByKey = (k) => templates.find((t) => t.key === k);

/* The event each template answers. `quote-send` is the one with no rule: it is
   raised by a person pressing «Enviar al cliente», not by a date passing, so
   its trigger is stated here and its subject comes from the same budget the
   quote-sent event reports. */
const TRIGGER = {
  "quote-send": { event: "quote-sent", by: "Sent by hand from the quote screen" },
  "quote-followup": { event: "quote-sent", by: "Rule · 5 days after the quote was sent" },
  "invoice-reminder": { event: "invoice-overdue", by: "Rule · 3 days after the due date" },
  "works-start": { event: "contract-signed", by: "Rule · when the customer signs" },
  "docs-expired": {
    event: "subcontractor-docs-expired",
    by: "Rule · while a trade's paperwork is out of date",
  },
  "warranty-followup": { event: "works-finished", by: "Rule · after the job is closed" },
};

const samples = [];
const gaps = [];

for (const tpl of templates) {
  const trig = TRIGGER[tpl.key];
  const ev = trig ? evFor(trig.event)[0] : null;
  if (!ev) {
    gaps.push({
      key: tpl.key,
      label: tpl.label,
      why: `the seeded company has no ${trig ? trig.event : "matching"} event to raise it`,
    });
    continue;
  }
  /* THE EVENT'S OWN VARIABLES, NOT A SET TOPPED UP HERE. An unsupplied
     `{{token}}` is left visible by `renderTemplate`, so filling a gap in this
     script would hide it: the pack would read correctly while the product sent
     braces to a customer. Three messages did exactly that until generating
     this pack read them as a customer would. Gaps belong in the engine's
     `commsEvents()`, where the send path sees them too. */
  const vars = ev.vars;
  const to = tpl.family === "proveedores" ? ev.recipients.supplier : ev.recipients.customer;
  const party = erp.state.parties.find((x) => x.email === to);
  const subject = render(tpl.subject, vars);
  const text = render(tpl.body, vars);
  const att = attachmentFor(ev.subjectRef);
  samples.push({
    n: samples.length + 1,
    key: tpl.key,
    label: tpl.label,
    family: tpl.family,
    event: ev.event,
    trigger: trig.by,
    rule: (rules.find((r) => r.template === tpl.key) || {}).label || "—",
    ref: ev.subjectRef,
    date: ev.date,
    toName: (party && party.name) || vars.cliente || "",
    toEmail: to || "",
    subject,
    text,
    html: CaneiEml.bodyHtml(subject, text, iss),
    attach: att,
    declared: tpl.attach || null,
  });
}

/* -------------------------------------------------- the two account emails
   A different family: composed on the SERVER (apps/web/lib/invite-mail.ts),
   addressed to a colleague rather than a customer, and never carrying an
   attachment. They are in the pack because the question was every email the
   system creates, and these are two of them. Rendered through that module's
   own exports, for the reason the rest of this file is generated. */
const invite = await (async () => {
  const r = spawnSync(
    "pnpm",
    [
      "--silent",
      "exec",
      "tsx",
      "-e",
      `import {inviteHtml,inviteText} from "./apps/web/lib/invite-mail";
       const base={company:"Canei Subirats, S.L.",to:"mcasals@caneisubirats.example",
         loginUrl:"https://178-105-10-156.sslip.io/entrar",
         tempPassword:"rura-VENT-9274",
         link:"https://178-105-10-156.sslip.io/clave?t=MUESTRA-NO-VALIDA"};
       const out=(["activation","reset"]).map((purpose)=>{const c={...base,purpose};
         return {purpose,html:inviteHtml(c),text:inviteText(c)};});
       process.stdout.write(JSON.stringify(out));`,
    ],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    gaps.push({
      key: "account emails",
      label: "Activation and password reset",
      why: "the server module could not be rendered here: " + String(r.stderr || "").slice(0, 200),
    });
    return [];
  }
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("[")));
})();

const SUBJECT = {
  activation: "Su acceso a Canei Subirats",
  reset: "Su nueva contraseña — Canei Subirats",
};
for (const i of invite)
  samples.push({
    n: samples.length + 1,
    key: "invite-" + i.purpose,
    label: i.purpose === "activation" ? "Alta de cuenta" : "Contraseña nueva",
    family: "cuentas",
    event: i.purpose === "activation" ? "account-created" : "password-reset",
    trigger:
      i.purpose === "activation"
        ? "Created when an account is added in Master data → Usuarios"
        : "Created when an administrator resets somebody's password",
    rule: "— (not rule-driven)",
    ref: "mcasals@caneisubirats.example",
    date: erp.state.today,
    toName: "Marta Casals",
    toEmail: "mcasals@caneisubirats.example",
    subject: SUBJECT[i.purpose],
    text: i.text,
    html: i.html,
    attach: null,
    declared: null,
  });

/* ----------------------------------------------------------------- the parts */
for (const s of samples) {
  const eml = CaneiEml.build({
    fromName: iss.tradeName || iss.legalName,
    fromEmail: iss.email || "",
    toName: s.toName,
    toEmail: s.toEmail,
    subject: s.subject,
    text: s.text,
    html: s.html,
    // `btoa` on the writer's latin-1 string, exactly as erp.html attaches it.
    attachments: s.attach ? [{ name: s.attach.name, b64: btoa(s.attach.pdf) }] : [],
  });
  const stem = String(s.n).padStart(2, "0") + "-" + s.key;
  fs.writeFileSync(path.join(PARTS, stem + ".eml"), eml);
  fs.writeFileSync(path.join(PARTS, stem + ".html"), s.html);
  if (s.attach)
    fs.writeFileSync(
      path.join(PARTS, stem + "-" + s.attach.name),
      Buffer.from(latin1(s.attach.pdf)),
    );
  s.stem = stem;
  s.emlBytes = Buffer.byteLength(eml);
}

/** The PDF writer emits a latin-1 STRING, one character per byte. A mask, not
 *  an encode: TextEncoder would turn every byte above 127 into two. */
function latin1(s) {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}

fs.writeFileSync(
  path.join(OUT, "inventory.json"),
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      company: iss.legalName,
      seedToday: erp.state.today,
      emails: samples.map((s) => ({
        n: s.n,
        key: s.key,
        label: s.label,
        family: s.family,
        event: s.event,
        trigger: s.trigger,
        rule: s.rule,
        ref: s.ref,
        to: s.toEmail,
        subject: s.subject,
        attachment: s.attach ? s.attach.name : null,
        attachmentKind: s.attach ? s.attach.kind : null,
        declaredAttach: s.declared,
        emlBytes: s.emlBytes,
      })),
      gaps,
    },
    null,
    2,
  ),
);

console.log(`${samples.length} emails, ${samples.filter((s) => s.attach).length} with attachments`);
for (const s of samples)
  console.log(
    `  ${String(s.n).padStart(2)} ${s.key.padEnd(18)} ${(s.attach ? s.attach.name : "—").padEnd(20)} ${s.subject}`,
  );
for (const g of gaps) console.log(`  !! ${g.key}: ${g.why}`);

export { samples, gaps, iss, erp, OUT, PARTS, latin1 };

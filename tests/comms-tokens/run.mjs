/**
 * NO MESSAGE MAY REACH A CUSTOMER LOOKING LIKE A MACHINE WROTE IT.
 *
 * This gate began as one assertion — no `{{token}}` survives to the reader —
 * and it earned the rest of them the same way: by something shipping.
 *
 * 1 · THE TOKENS. `renderTemplate` leaves an unsupplied `{{token}}` visible,
 *     and that is the right choice: a sentence that silently loses its subject
 *     is worse than one that obviously did. But it makes the contract between
 *     the two halves of the message system load-bearing and invisible — a
 *     template names the variables it needs, `commsEvents()` supplies them, and
 *     nothing ever checked that the two agreed. They did not. `works-start`
 *     went out under «Comenzamos su obra el {{fecha}}» and greeted «Hola
 *     {{cliente}},»; `warranty-followup` greeted the same way. The screens show
 *     the template, not the rendered message, so the braces were only ever
 *     visible in the sent mail.
 *
 * 2 · EVERYTHING ELSE A CUSTOMER SEES. Asked to make the emails look like they
 *     came from a company rather than from a script, the finding was that the
 *     repository held THREE email designs and shipped the weakest — twelve
 *     lines of markup with a `display:flex` Outlook ignores, no preheader, no
 *     figures, no way to pay, and a footer naming three fields out of the
 *     fourteen the company record already holds. Every one of those is a thing
 *     nobody would notice from inside the product, because every screen shows
 *     the template rather than the message. So they are all asserted here, on
 *     the RENDERED message, in every language the library ships.
 *
 * A template nobody can raise is a failure too — an email that cannot be
 * produced is not covered by this check, and silence about that is how the
 * first gap survived.
 *
 * Run:  node tests/comms-tokens/run.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Seed = require("../../site/erp-seed.js");
const Eml = require("../../site/erp-eml.js");

const erp = Seed.build("2026-05-05");
const templates = erp.ensureCommsTemplates("comms-token-gate");
const events = erp.commsEvents();
const issuer = Object.assign(erp._issuerBlock(), {
  privacyUrl: "https://example.invalid/privacy.html",
});

/* Which event raises which template. The rules the product ships supply most of
   this; `quote-send` is sent by hand from the quote screen and has no rule, so
   it is named here. Kept as one table rather than read from the seeded rules
   alone, because a template with NO rule is exactly the case that would
   otherwise drop out of the sweep unexamined. */
const RAISED_BY = {
  "quote-send": "quote-sent",
  "quote-accepted": "quote-accepted",
  "invoice-send": "invoice-issued",
  "quote-followup": "quote-sent",
  "invoice-reminder": "invoice-overdue",
  "works-start": "contract-signed",
  "docs-expired": "subcontractor-docs-expired",
  "warranty-followup": "works-finished",
};

/* The languages the library must ship. A language that quietly stops being
   installed is a customer who quietly starts getting Spanish. */
const LANGS = ["es", "ca", "en"];

let pass = 0;
const fail = [];
const check = (ok, why) => {
  if (ok) pass += 1;
  else fail.push(why);
};

for (const lang of LANGS) {
  for (const key of Object.keys(RAISED_BY)) {
    const tpl = templates.find((t) => t.key === key && t.lang === lang && t.active);
    if (!tpl) {
      fail.push(`${key} · ${lang}: the library installs no template in this language`);
      continue;
    }
    const ev = events.find((e) => e.event === RAISED_BY[key]);
    if (!ev) {
      fail.push(
        `${key}: the demonstration company raises no ${RAISED_BY[key]}, so it is unchecked`,
      );
      continue;
    }
    const at = `${key} · ${lang}`;
    const msg = erp.composeCommsMessage(tpl, ev.vars, {
      issuer,
      attachment: tpl.attach ? { name: (ev.vars.number || "doc") + ".pdf", size: "180 kB" } : null,
    });
    if (!msg) {
      fail.push(`${at}: composes to nothing`);
      continue;
    }
    const html = Eml.bodyHtml(msg, issuer);
    const text = Eml.textPart(msg, issuer);

    /* ---- 1 · no token reaches anybody, in any part ---- */
    for (const [part, s] of [
      ["subject", msg.subject],
      ["html", html],
      ["text", text],
    ]) {
      const left = String(s).match(/\{\{\s*\w+\s*\}\}/g);
      check(!left, `${at} ${part}: ${left ? [...new Set(left)].join(", ") : ""} left unfilled`);
    }

    /* ---- 2 · the message is addressed, signed and introduced ---- */
    check(Boolean(msg.greeting), `${at}: no greeting — a message to nobody`);
    check(
      Boolean(msg.signoff && msg.signoff.who),
      `${at}: nothing signs it, so it reads as a notification`,
    );
    check(
      /display:none;max-height:0/.test(html),
      `${at}: no preheader — the phone notification shows the first thing it finds`,
    );
    check(
      msg.subject.length > 0 && msg.subject.length <= 60,
      `${at}: subject is ${msg.subject.length} characters (max 60, and it gets truncated)`,
    );

    /* ---- 3 · it says what it is about ---- */
    check(
      (msg.facts || []).length > 0 || (msg.steps || []).length > 0,
      `${at}: neither figures nor steps — prose with nothing in it`,
    );
    if (ev.vars.number)
      check(text.includes(ev.vars.number), `${at}: the plain part never names ${ev.vars.number}`);
    /* An email about money says how to pay it. */
    if (ev.vars.iban)
      check(
        Boolean(msg.payment && msg.payment.iban),
        `${at}: the event carries an account and the message does not offer it`,
      );

    /* ---- 4 · it will render where it lands ---- */
    check(!/display:\s*flex/i.test(html), `${at}: uses flexbox, which Outlook lays out as a stack`);
    check(!/<style[\s>]/i.test(html), `${at}: carries a <style> block, which Gmail strips`);
    check(
      !/(src|url\()\s*=?\s*["']?https?:/i.test(html),
      `${at}: fetches a remote image, which Outlook and Gmail block by default`,
    );
    for (const img of html.match(/<img\b[^>]*>/gi) || []) {
      check(/src="cid:/.test(img), `${at}: an image is not a cid: part`);
      check(/alt="[^"]+"/.test(img), `${at}: an image has no alt text`);
    }
    /* Every band paints its own ground, or a force-inverting dark mode turns
       its text the colour of the paper behind it. */
    const naked = (html.match(/<td style="(?![^"]*background)[^"]*color:#[^"]*"/gi) || []).length;
    check(naked === 0, `${at}: ${naked} cell(s) paint text on a ground they do not state`);

    /* ---- 5 · the plain part is a message, not stripped markup ---- */
    check(
      text.length > 200,
      `${at}: the plain part is ${text.length} characters — too short to read`,
    );
    check(!/[<>]/.test(text), `${at}: the plain part carries markup`);
    check(!/\*[^*]+\*/.test(text), `${at}: the plain part still shows its emphasis markers`);

    /* ---- 6 · the company can be identified (LSSI-CE art. 10) ---- */
    const mustCarry = [
      issuer.legalName,
      issuer.taxId,
      issuer.registeredAddress || issuer.address,
      issuer.phone,
      issuer.email,
      issuer.registry,
    ].filter(Boolean);
    for (const fact of mustCarry)
      check(html.includes(Eml.esc(fact)), `${at}: the foot omits «${fact}»`);
    check(/2016\/679/.test(html), `${at}: no data-protection notice in the foot`);
    check(
      /confidencial|confidenciales|confidencials|confidential/i.test(html),
      `${at}: no confidentiality notice in the foot`,
    );
  }
}

/* A gate that checked nothing would pass. Eight templates in three languages,
   each of them examined against a long list — anything far under this means
   the sweep lost its subject rather than found it clean. */
const FLOOR = 8 * 3 * 20;
if (pass + fail.length < FLOOR)
  fail.push(
    `only ${pass + fail.length} checks ran, expected at least ${FLOOR} — the sweep found nothing to sweep`,
  );

console.log("──── every generated email, as the recipient reads it ────");
for (const f of fail) console.log("  ✗ " + f);
console.log(`${pass}/${pass + fail.length} passed`);
if (fail.length) process.exit(1);

/**
 * NO MESSAGE MAY REACH A CUSTOMER WITH A {{token}} STILL IN IT.
 *
 * `renderTemplate` leaves an unsupplied `{{token}}` visible, and that is the
 * right choice — a sentence that silently loses its subject is worse than one
 * that obviously did. But it makes the contract between the two halves of the
 * message system load-bearing and invisible: a template names the variables it
 * needs, `commsEvents()` supplies them, and nothing ever checked that the two
 * agreed.
 *
 * They did not. `works-start` went out under the subject «Comenzamos su obra el
 * {{fecha}}» and greeted «Hola {{cliente}},»; `warranty-followup` greeted the
 * same way. Both had been in the standard library since §5.7 and neither had
 * ever been read the way a customer reads it — the screens show the template,
 * not the rendered message, so the braces were only visible in the sent mail.
 * Found by generating the sample pack for the client.
 *
 * So: every standard template, rendered against the variables of the event that
 * actually raises it, must come back with no braces left. A template nobody can
 * raise is a failure too — an email that cannot be produced is not covered by
 * this check, and silence about that is how the first gap survived.
 *
 * Run:  node tests/comms-tokens/run.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Seed = require("../../site/erp-seed.js");
const Bridge = require("../../site/erp-bridge.js");

const erp = Seed.build("2026-05-05");
const templates = erp.ensureCommsTemplates("comms-token-gate");
const events = erp.commsEvents();
const render = (t, v) => Bridge.comms.render(t || "", v || {});

/* Which event raises which template. The rules the product ships supply most of
   this; `quote-send` is sent by hand from the quote screen and has no rule, so
   it is named here. Kept as one table rather than read from the seeded rules
   alone, because a template with NO rule is exactly the case that would
   otherwise drop out of the sweep unexamined. */
const RAISED_BY = {
  "quote-send": "quote-sent",
  "quote-followup": "quote-sent",
  "invoice-reminder": "invoice-overdue",
  "works-start": "contract-signed",
  "docs-expired": "subcontractor-docs-expired",
  "warranty-followup": "works-finished",
};

let pass = 0;
const fail = [];

for (const tpl of templates) {
  const evName = RAISED_BY[tpl.key];
  if (!evName) {
    fail.push(`${tpl.key}: no event is declared for it — add one to RAISED_BY or remove it`);
    continue;
  }
  const ev = events.find((e) => e.event === evName);
  if (!ev) {
    fail.push(`${tpl.key}: the demonstration company raises no ${evName}, so it is unchecked`);
    continue;
  }
  for (const part of ["subject", "body"]) {
    const out = render(tpl[part], ev.vars);
    const left = out.match(/\{\{\s*\w+\s*\}\}/g);
    if (left)
      fail.push(
        `${tpl.key} ${part}: ${[...new Set(left)].join(", ")} — "${out.trim().split("\n")[0].slice(0, 70)}"`,
      );
    else pass += 1;
  }
}

/* A gate that checked nothing would pass. The library ships six templates and
   each has a subject and a body, so anything under twelve means the sweep lost
   its subject rather than found it clean. */
if (pass + fail.length < 12)
  fail.push(
    `only ${pass + fail.length} template parts were examined — the sweep found nothing to sweep`,
  );

console.log("──── comms templates render with no token left ────");
for (const f of fail) console.log("  ✗ " + f);
console.log(`${pass}/${pass + fail.length} passed`);
if (fail.length) process.exit(1);

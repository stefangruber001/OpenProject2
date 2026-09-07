# Every generated email to the invitation's level

Written 6 Sep 2026, after the operator held the invitation email up as the
standard: _"bring all emails which are generated to the next level of design,
navigation and full premium corporate identity like the attached one."_

## Where things actually stand

There are **two email designs in this system, and only one of them is good.**

|            | The invitation                                                                                                           | Everything else                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Built by   | `apps/web/lib/invite-mail.ts`                                                                                            | `draftEmailHtml()` in `site/erp.html`                             |
| Runs on    | the server, TypeScript                                                                                                   | the browser, JavaScript                                           |
| Looks like | brand header, dark hero with a title and a button, a green credential band, numbered steps, a quiet note, a legal footer | a small logo, a green rule, plain paragraphs, a legal footer line |
| Covers     | invitation, password reset — two messages                                                                                | every message to a customer or supplier — see the list below      |

So the message a person receives **once**, when their account is created, is the
polished one; the messages the company sends its **customers**, for money, are
the plain ones. That is exactly the wrong way round.

Transport is already shared and should stay that way: `site/erp-eml.js` builds
the MIME for every draft, and its own header explains why — _"two copies of MIME
assembly would disagree within a month"_. The same argument applies to the
design, and is the reason step 1 below exists rather than "restyle the four".

## The plan

### 1 · One email design module, shared by both sides

Extract the primitives from `invite-mail.ts` into a module both the server and
the workspace call — same shape as `erp-eml.js`, which already solves this
problem for the envelope:

- `band(kind, content)` — the six band kinds below
- `dataRow(label, value, copyable)` — the credential block, generalised
- `steps([…])` — the numbered list
- `button(label, href)` — the call to action
- `legalFoot(issuer)` — the company's own legal line

Restyling the four emails in place would leave two design systems in two
languages, drifting apart from the day it shipped.

### 2 · The six bands

The invitation's anatomy, named so every email is assembled from the same parts:

1. **Brand** — monogram, company name, trade line
2. **Hero** (dark) — what this is, one sentence of why, and the button
3. **Data** (green) — the two to four facts that matter, each on its own row
4. **Steps** (light) — numbered, only where there is a sequence
5. **Note** (quiet) — the caveat, the expiry, the alternative route
6. **Legal foot** — name, tax id, address, contact

An email uses the bands it needs. A quote has no steps; an invitation has no
document total.

### 3 · What each email carries

**Corrected scope.** An earlier draft of this document said "the four business
emails", taken from an old task label. The catalogue in `erp-engine.js` holds
**six standard templates**, and `commsTemplates` is tenant data with add and
edit commands — so the company can define more without a line of code changing.

That makes the shared module of step 1 the requirement rather than the tidy
option: a template somebody adds next year has to inherit the design, not wait
to be restyled.

| Template            | Message                     | To       | Hero button          | Data band                                   |
| ------------------- | --------------------------- | -------- | -------------------- | ------------------------------------------- |
| `quote-send`        | Envío de presupuesto        | customer | Open the quote       | number, total, valid until                  |
| `quote-followup`    | Seguimiento de presupuesto  | customer | Open the quote       | number, total, valid until                  |
| `invoice-reminder`  | Recordatorio de factura     | customer | Open the invoice     | number, amount, due date, payment reference |
| `works-start`       | Aviso de inicio de obra     | customer | See the job          | job, start date, who to call                |
| `docs-expired`      | Documentación caducada      | supplier | Send the document    | what expired, trade, the job it blocks      |
| `warranty-followup` | Seguimiento posventa        | customer | Report something     | job, when it finished                       |
| _(credit note)_     | Abono                       | customer | Open the credit note | number, amount, the invoice it corrects     |
| _(contract)_        | Contrato                    | customer | Read and sign        | number, job, amount, start date             |
| _(accountant)_      | Paquete gestoría            | gestoría | Download             | period, what is inside, document count      |
| _tenant-added_      | whatever the company writes | either   | optional             | optional — the bands degrade to none        |

The PDF stays attached. The data band is not a replacement for the document —
it is what lets somebody decide, on a phone, whether to open it now.

### 4 · The customer's own language

Documents already resolve a language per customer (`_docLanguageFor`: the
document's own choice, then the accepted quote's, then the customer's, then the
company default). **The email must use the same chain.** Today `draftEmailHtml`
renders whatever text it was handed, so a Catalan customer can receive a
Spanish covering message wrapped around a Catalan document.

### 5 · Dark mode is not optional

The operator's screenshot is the invitation rendered in a **dark** mail client.
It survives because every band paints its own background. Any new band must do
the same, and be looked at in a dark client before it ships — an email that
assumes a white page is an email that is unreadable for half its readers.

### 6 · The gate

Extend the document gate: render each email to HTML and assert the bands are
present, the legal foot carries the issuer's real details, every style is
inline, and the language matches the document it accompanies. The four business
emails have no test of their appearance today.

## Cost and order

One working session. Step 1 is most of it; steps 2–5 are then small and
independent, and step 6 is what stops the two designs diverging again.

Order: module → invitation moved onto it unchanged (proving it lost nothing) →
the four business emails → language → gate.

# Session 7 — Extraction capability + Spanish profile

## CONTEXT PACK — paste into a new session

```
Repo stefangruber001/OpenProject2 · branch claude/candi-programme-session-4-07amo8
Spec: intake/diorka/canei-spec-extracted.txt — §5.2 "Captura de factura de
  proveedor por fotografía" (Improvement #2). Read the "Campos que se extraen",
  "Pantalla de validación" and "Casos no ideales" paragraphs: they are the
  requirements this session implements the reading half of.
Plan + session index: docs/worklog/WORKLOG.md  (12 sessions; this was #7)

THE READER EXISTS, IN TWO HALVES THAT KNOW NOTHING OF EACH OTHER:

  packages/capabilities/extraction   @repo/capability-extraction
    model.ts     FieldKey (issuerName · issuerTaxId · docNumber · issueDate ·
                 dueDate · netAmount · taxAmount · withholdingAmount ·
                 totalAmount · iban · orderRef), ExtractedField {value, raw,
                 confidence, source, alternatives, reasons}, SourceSpan
                 {line, text, start, end, page}, ConsistencyCheck,
                 ExtractionResult {…, needsReview[], confirmed: false}.
    ports.ts     EXTRACTION_PROFILE_PORT = "extraction-profile@1" and the
                 ExtractionProfile interface a pack must implement.
    normalise.ts recognised text → clean lines (+ which page each came from).
    service.ts   extract() and recheck(). Scoring is deterministic and
                 explained: label on the same line 0.5, label above 0.3,
                 token shape 0.3, valid check digit +0.2, position ±0.1.
    REQUIRED PORT, not optional: an extractor with no profile would silently
    read nothing, so resolution fails instead.

  packages/packs/jurisdiction-es-es/src/extraction/
    taxid.ts     NIF/NIE modulus-23, CIF control character, IBAN modulus-97.
    profile.ts   ES_EXTRACTION_PROFILE: decimal comma + thousands point,
                 dd/mm/yyyy and "2 de abril de 2026" (Spanish and Catalan
                 month names), the keyword sets, and expectedTaxRatesBp()
                 resolved from the pack's EFFECTIVE-DATED rate tables.
    Bound in the pack manifest; the tenant resolves 4 ports now.

  TWO RULES THIS SESSION IS ABOUT
    1. NOTHING IS EVER CONFIRMED. ExtractionResult.confirmed is the literal
       type `false`. A caller cannot persist a "confirmed" extraction by
       accident; a person confirms, elsewhere (CAP-04).
    2. AN UNLABELLED AMOUNT IS NEVER THE ANSWER. Amounts have no shape of
       their own — only a word beside them says which is the net and which
       the total — so an unlabelled amount may be OFFERED as an alternative
       but never becomes the field's value. Breaking this rule (the first
       version did) makes the extractor nominate a random number as the
       withholding on documents that have none, which then contradicts the
       arithmetic and poisons every other field's confidence.

  The capability's own tests run against a profile for an INVENTED country
  (amounts `1_234|56`, dates `yyyy.mm.dd`, two-letter tax ids). If they pass,
  the capability cannot be carrying Spanish knowledge.

Ownership: 19 engine · 2 factory · 4 unbuilt. extraction-ocr stays "unbuilt"
— no screen reaches this yet.

Next: session 8 (OCR bridge + invoice capture). It needs: a recognition
adapter (Apple Vision / Android ML Kit through the iOS JS bridge in
ios/CaneiSubirats/Web/WebViewStore.swift, Tesseract.js WASM in a plain
browser), this capability added to packages/erp-browser's bundle, and the
validation screen from §5.2 — image on one side, fields on the other, low
confidence highlighted and focused first, tapping a field highlighting where
it was read from (that is what SourceSpan is for). The engine already models
capture → extract → validate → allocate → register.

ENVIRONMENT: Node 22 + pnpm 10. `pnpm install && pnpm lint && pnpm boundaries
&& pnpm check-types && pnpm test && pnpm build`, `make gates`, `make demo`,
`node tests/site-e2e/run.mjs` (64), the five sims under tests/simulation/.

Start next by: reading packages/capabilities/extraction/src/service.ts, then
§5.2's "Pantalla de validación" paragraph — the screen it describes is a
direct rendering of ExtractionResult.
```

## Goal

Per the plan and spec §5.2: the half of photo capture that turns recognised
text into a proposed supplier-invoice record — with a confidence and a
provenance per field, arithmetic that reconciles, and a locale profile living
where locale knowledge belongs. No camera, no OCR engine, no UI: session 8.

## What changed

**`@repo/capability-extraction`** (new capability). Scans normalised lines for
each field, scores candidates deterministically, and reports what it found,
how sure it is, and where on the page it came from. Two structural properties
matter more than its hit rate:

- **`confirmed: false` is a literal type.** Not a boolean that happens to be
  false — the type itself. A caller cannot persist something that looks
  confirmed without deliberately constructing a different object, which is the
  strongest form CAP-04 ("ningún dato se da por bueno sin confirmación
  explícita") can take in a type system.
- **It knows no locale.** Number and date notation, tax-id shapes and their
  check characters, the words that announce each field, and which tax rates
  were law on a date all arrive through `extraction-profile@1`. Its own test
  suite runs against a profile for a country that does not exist.

**`@repo/pack-jurisdiction-es-es`** gained the Spanish profile: NIF/NIE
modulus-23, the CIF control character, IBAN modulus-97, `1.234,56`,
`14/03/2026` and `2 de abril de 2026` (Spanish and Catalan month names, since
invoices arrive in both), the keyword sets, and `expectedTaxRatesBp()` reading
the pack's **effective-dated** tables — a document from before a rate change is
checked against the rate of its own day, and a date before the earliest encoded
era makes the profile decline to guess rather than invent one.

**Consistency, in two layers.** Pure arithmetic in the capability
(net + tax − withholding = total, within tolerance) and rate plausibility
whose _rates_ come from the profile. A contradiction does not hide a number: it
docks its confidence and pushes every implicated field into `needsReview`,
which is exactly the "los de confianza baja aparecen resaltados y con el foco
de entrada" the validation screen needs.

**Wiring.** Registered in the factory registry and added to tenant #1;
`pnpm factory validate` now reports 17 capabilities and 4 bound ports.

## Verification

| Check                                                          | Result                                             |
| -------------------------------------------------------------- | -------------------------------------------------- |
| `@repo/capability-extraction` tests (invented profile)         | **14/14**                                          |
| `@repo/pack-jurisdiction-es-es` tests (real Spanish documents) | **30/30** (was 20)                                 |
| `pnpm factory validate tenants/diorka`                         | 17 capabilities · 2 packs · **4 ports**            |
| `make demo` · `make gates`                                     | both green, artifacts unchanged                    |
| `@repo/factory` tests incl. the negative test (§12.3)          | 8/8                                                |
| `pnpm lint` · `boundaries` · `check-types` · `test` · `build`  | all pass                                           |
| Five simulations + ownership guard                             | 145/145 · 34/34 · 23/23 · 25/25 · 16/16 · 25 areas |

The pack tests read documents as they actually arrive: a materials supplier's
invoice with a CIF, an IBAN and 21 % VAT; a self-employed plumber's with a
15 % withholding stated as a negative; a rate that was never in force; and a
tax id whose check character fails.

## Three things the tooling caught, which is the point of having it

1. **The boundary linter rejected my own doc-comment.** `ports.ts` used a
   rate-like literal as an example of a percentage token. In a capability that
   is exactly the forbidden thing, comments included — `CLAUDE.md` warns about
   this and the linter enforced it.
2. **A fabricated CIF.** The fixture `A08123456` fails the control-character
   algorithm; the valid one for that body is `A08123457`. The code was right
   and the test data was wrong — the same shape of error session 3 hit with
   `46000000X`.
3. **The unlabelled-amount bug**, found by a failing arithmetic check rather
   than by inspection: the extractor was nominating the first amount on the
   page as the withholding on a document with none. See the context pack's
   rule 2 for the fix.

## Decisions (ASSUMPTIONS.md #51)

1. `extraction-profile@1` is a **required** port. An extractor with no profile
   reads nothing; failing at resolve time is what a required port is for.
2. **The profile is an adapter, not config.** It carries behaviour (parsers,
   check-character algorithms), not just data, and adapters are how behaviour
   crosses the layer boundary in this architecture.
3. **Amounts need a label to be an answer**; dates, tax ids and account
   numbers have enough shape to stand alone.
4. **A failed check character caps confidence at 0.5**, applied after every
   other bonus, so a well-labelled well-placed wrong id still reaches a human.
5. **`recheck()` lives in the capability**, so the validation screen re-runs
   the same arithmetic rather than a second copy of it in the view.
6. `extraction-ocr` stays **`unbuilt`**: the domain exists, no screen reaches it.

## Open issues for the next session

- Session 8 must add this capability to `packages/erp-browser`'s bundle; it is
  not there yet, deliberately, because nothing in the browser calls it.
- The extractor is line-oriented. A real invoice is a table, and a
  column-aware pass (using the x-offsets a recogniser gives) would read
  multi-rate breakdowns far better than the current "percentage and two numbers
  on one line" heuristic. Worth doing when real photographs exist to test
  against — not before.
- `tests/i18n-coverage.mjs` remains owed. This session added no UI strings.

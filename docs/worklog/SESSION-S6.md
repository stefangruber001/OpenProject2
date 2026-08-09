# S6 · The machine reads, and says what it could not check

> Context pack. Where recognition ends and meaning begins, why a green dot is
> a type rather than a screen convention, the three browser-only bugs this
> session had to find, and what S7 inherits.

## What was wrong

`extraction-ocr` was the last `unbuilt` area in the ownership guard. An
earlier session had built the half that turns recognised text into candidate
fields with confidence, provenance and arithmetic checks — and **nothing could
reach it**, because there was no way to turn a PDF or a photograph into text
in the first place. The capture inbox was a read-only table of records only
the seed could create.

## The split, and why it is where it is

| Half            | Lives in                             | Knows about                             |
| --------------- | ------------------------------------ | --------------------------------------- |
| **Recognition** | `site/erp-ocr.js` (~9 KB)            | files, canvases, workers — no invoices  |
| **Meaning**     | `@repo/capability-extraction`        | issuers, tax ids, amounts — no browsers |
| **Locale**      | `pack-jurisdiction-es-es/extraction` | how Spain writes a date, a NIF, an IBAN |
| **The screen**  | `erp.html` ADM-03 validation         | neither — it shows and it asks          |

Recognition is host infrastructure: ~7 MB of pdf.js and tesseract.js with no
business meaning at all. Meaning is domain code, and stays testable against a
jurisdiction that does not exist. That is the whole reason the split is worth
having — the capability's 22 tests never open a browser, and this file's tests
never mention an invoice.

`ErpBridge.extraction` is the seam (bundle surface **v7**).

## The rule this session exists for

**A field goes green only where a validator vouched for its value.** Never on
confidence, however high.

The S0b spike is why. Its scanned NIF came back `A08912907` for `A08932907` —
not a blank anyone would notice, but a plausible lie, read with perfect
confidence, that would have flowed into duplicate detection, the archive and a
filing. A check digit catches it; a confidence score never will, because the
reader was not in doubt.

So `ExtractedField.verdict` is computed **in the capability**:

- tax id → the profile's check digit computes
- account number → mod-97 comes out
- date → is a real day in a real month (`2026-02-31` is not)
- amounts → net + tax − withholding = total, and if the arithmetic could not
  be done at all the amounts are amber, because nothing checked them
- anything contradicted by a consistency check → amber, whatever vouched for
  it in isolation

And a consequence stated rather than hidden: **fields with no validator
available are always amber.** An issuer name, a document number, an order
reference. That matches the spike never once reading a document number
correctly off a raster. Amber is not failure here; it is where the cursor
goes.

`needsReview` is now the amber list rather than a separate confidence
threshold, so the dots and the review list are two readings of one decision
instead of two decisions that can disagree.

**A typed correction is re-checked, not believed.** Typing is exactly where a
NIF acquires a transposed digit, and a check digit does not care who produced
the number.

## What ships to the browser, and when

7.23 MB under `site/vendor`, copied by `tools/vendor-ocr.mjs` and committed —
`pages.yml` publishes `site/**` from a bare checkout with no Node, and a bare
static host and a site with no signal both forbid the CDN these libraries
reach for by default. A script rather than a one-time copy so the provenance
of 7 MB of binaries is a command anybody can re-run and diff.

**None of it loads until a file is handed over**, and the OCR half never loads
at all for a PDF that turned out to have a text layer — which is most supplier
quotes, and which reads in about 170 ms. `prepareOffline()` is the explicit,
user-pressed pre-fetch for the no-signal site; 7 MB must never land on
somebody's mobile data because a screen opened.

## Three bugs only a browser could find

All three were in this session's own new code, all three were silent or
hanging rather than loud, and none would have been caught by reading:

1. **tesseract's default `blob:` worker has no script directory**, so the
   Emscripten core inside it resolved its `.wasm` to a bare filename, threw
   "Invalid URL" from deep inside the wasm loader, and left a promise that
   never settled. `workerBlobURL: false` loads the worker from
   `vendor/tesseract/` so the `.wasm` beside it is found.
2. **The image's object URL was revoked in `onload`**, before tesseract read
   `img.src`. The dimensions were all that was ever wanted from the `<img>`;
   the File goes to the recogniser, which needs no URL at all.
3. **`logger: undefined`** throws once per progress tick, because tesseract
   calls it unchecked — which the site E2E's zero-console-errors rule would
   have failed on.

## Decisions worth knowing

- **Provenance is the LINE, not a pixel box.** The capability records
  character offsets into the recognised text, not image coordinates. So the
  honest rendering of the doc's "highlight the area of the image it came from"
  is to show the lines the reader saw and highlight the one a value was read
  off. Claiming a pixel box we do not have would be a nicer screen and a lie.
- **`captureDocument` is called at the END**, by a person pressing Confirmar.
  CAP-04 is therefore enforced by the flow as well as by the capability's
  `confirmed: false` type. The machine's reading is stored beside the
  confirmed values, never instead of them.
- **The capture minimum is about pixels, not steadiness** — the spike's angled
  phone photo beat a low-resolution scan 9/11 to 5/11 — and it warns rather
  than blocks. A bad photograph of a document nobody can find again still
  beats nothing, and the amber dots say what could not be read.
- **The profile gets its own export subpath** (`@repo/pack-jurisdiction-es-es/
extraction`). The pack's index pulls in its invoice-chain module, which needs
  `node:crypto` and has no place in a browser bundle.
- **The memo's own fixture IBAN was invented** and fails mod-97. The pipeline
  flagged it on its first real run — §3's defence catching exactly §3's
  failure, before a human looked. `docs/CANEI-V4-OCR-SPIKE.md` §6 records it.

## What S7 inherits

S7 owns ADM-03's remaining shape and ADM-02:

- **The inbox is still a plain table.** The doc wants a **372 left column of
  96 px cards** (thumbnail, detected supplier, detected amount) beside a
  **756 validated list**. The records and the thumbnails now exist to build it
  from — `captured[].imageRef` is a real blob key, and `captured[].extracted`
  carries what the machine proposed.
- **Allocation is not built.** `erp.allocateCapture` exists and nothing calls
  it; that is the ADM-03 screen's other half (one project, a split, or an
  overhead category).
- **Gaps 10 and 11** (`captured.sourcePath`, `captured.reference`,
  `captured.notes`) are S7's, and none of this session's work blocks them.
- **The two-zone full-screen primitive** (`.cap2`, 620 / 480, inside `.pb`) is
  built and proven; ADM-02's quote-PDF-and-record screen is the same shape.

**Every string S7 adds must ship with Catalan AND a real-browser render
assertion.** That rule has now caught a gap in three consecutive sessions.

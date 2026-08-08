# S0b · OCR spike — what is actually readable, and what S6 should build

> **No product code.** A measurement, run before S6 commits to an approach (plan decision 14).
> The workbook's own Resumen warned that OCR on the GESTOR folder was _"muy baja: solo 3 páginas
> dejan leer el total con fiabilidad"_ out of 24, so the question was whether in-browser extraction
> is a feature or a fallback.
>
> **Answer: both, and the split is predictable.** Digital PDFs extract perfectly and instantly;
> scans lose the identifiers first, and lose them as **near-misses rather than blanks** — which is
> the dangerous failure. The design below turns that into a safe one.

## 1 · What was measured

`pdfjs-dist 6.2.108` and `tesseract.js 7.0.0` with Spanish `best_int` language data, against one
invoice rendered four ways: a **digital PDF** (text layer), and three raster degradations produced
in a real browser — rotation, blur, noise, JPEG loss and downscaling.

The test document reproduces the shape of a real supplier factura, using field values taken from
the workbook's own `Documentos` sheet (issuer `Distribuciones Cerygres, S.A.`, NIF `A08932907`,
number `26OFV001345`, base `1.683,96`, IVA 21% `353,63`, total `2.037,59`). The eleven fields
scored are the eleven ADM-03 names.

> **Unverified — requires the real files.** The actual GESTOR scans live on the operator's machine
> (`C:\Users\ignac\OneDrive\…` per the workbook's `Ruta completa` column) and were not available
> here. The degradations approximate a bad scan; they do not replace one. The harness
> (`measure.mjs`) scores any folder of files, so re-running against the real bundles is one
> command — **worth doing before S6 starts.**

## 2 · Accuracy

| Input                        | Engine        | Time  | Confidence | Fields found |
| ---------------------------- | ------------- | ----- | ---------- | ------------ |
| **PDF digital** (text layer) | pdf.js        | ~0 s  | —          | **11 / 11**  |
| Scan, good quality           | tesseract spa | 1.9 s | 85         | **10 / 11**  |
| Phone photo, angled          | tesseract spa | 1.3 s | 82         | **9 / 11**   |
| Scan, poor / low-resolution  | tesseract spa | 1.2 s | 59         | **5 / 11**   |

Per field, the pattern is consistent and it is not random:

| Field                                     | Digital | Good scan | Phone | Poor scan |
| ----------------------------------------- | ------- | --------- | ----- | --------- |
| issuer · docType · vatRate · total · IBAN | ✓       | ✓         | ✓     | ✓         |
| date · dueDate · base · IVA amount        | ✓       | ✓         | ✓     | ✗         |
| **NIF**                                   | ✓       | ✓         | ✗     | ✗         |
| **document number**                       | ✓       | ✗         | ✗     | ✗         |

**Three findings that shape the build.**

1. **The identifiers fail first.** `26OFV001345` was never read correctly from any raster, and the
   NIF failed on two of three. Mixed letter/digit codes get no help from the language model and are
   exactly where `O/0`, `I/1`, `S/5` confusions live. Prose, amounts and dates survive because
   format and dictionary constrain them.
2. **Resolution dominates.** The angled phone photo (9/11) beat the low-resolution scan (5/11)
   despite worse rotation and noise. Capture quality is about **pixels, not steadiness**.
3. **Confidence tracks reality** — 85 / 82 / 59 against 10 / 9 / 5 hits. It is a usable signal for
   the doc's green/amber dots, not decoration.

## 3 · The dangerous failure, and a free defence

The NIF did not come back blank. It came back **wrong but plausible**:

| Truth       | Read as     | Input       |
| ----------- | ----------- | ----------- |
| `A08932907` | `A08912907` | poor scan   |
| `A08932907` | `A08937`    | phone photo |

A blank field is honest — the doc's amber dot handles it. `A08912907` is a lie that looks like
data, and it would flow into duplicate detection, the gestoría package and a factura.

**The Spanish CIF check digit catches it.** Computed properly, `A08912907` is invalid while
`A08932907` is valid. But the engine does not compute it:

```js
// site/erp-engine.js — validTaxId()
if (/^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(v)) return true; // CIF structure
```

DNI and NIE both compute their check letter; **the CIF branch checks structure only**. The doc's
DMT rule says the NIF is _"validated for format and check digit"_ — so this is a real gap against
the specification, independent of OCR, and it is what let the corrupted value through.

Implemented and verified against the workbook: **166 of 170 CIF-shaped values pass, 4 fail (2%)** —
a rate consistent with occasional scanning errors in the workbook itself, not with a wrong
algorithm. One of the failures, `B67219049`, computes to `…048`: the same one-digit signature.

**Action: implement the CIF check digit in `validTaxId()`** (S2, with the other DMT work). It closes
a specification gap, it is ~10 lines, and it makes every OCR near-miss on a NIF self-detecting.

## 4 · What has to ship to the browser

Measured, gzipped where the artefact is:

| Artefact                                           | Size        |
| -------------------------------------------------- | ----------- |
| `pdf.min.mjs` + `pdf.worker.min.mjs`               | **1.68 MB** |
| `tesseract.min.js` + `worker.min.js`               | 0.17 MB     |
| `tesseract-core-simd-lstm.wasm`                    | 2.70 MB     |
| Language data, **`best_int`**: spa 2.00 + cat 0.61 | **2.61 MB** |
| **Total, OCR path**                                | **~7.2 MB** |
| **PDF-only path** (text layer, no OCR)             | **1.68 MB** |

Choosing `best_int` over the standard 4.0.0 data cuts languages from **10.58 MB to 2.61 MB** — an
8 MB saving for no measured accuracy cost at this document quality. Language data is fetched from a
CDN by default, which a bare static host and offline capture both forbid, so **it is vendored**;
`@tesseract.js-data/{spa,cat}` on npm supplies it, since `tessdata.projectnaptha.com` is not
reachable from CI.

**The operational catch.** Rule 09 wants site capture on poor signal, but the OCR bundle needs a
good connection **once** to install. Mitigation for S6: load pdf.js eagerly (small, covers digital
quotes) and **offer an explicit "preparar para trabajar sin cobertura"** action that pre-fetches the
OCR bundle on wifi. Never download 7 MB silently over mobile data.

Timings above are a development machine. A phone will be several times slower — **unmeasured, and
worth checking on a real device in S6.**

## 5 · Recommendation for S6

**Partial extraction, validation-gated.** Not "full extraction", not "text layer only".

1. **Try the text layer first, always.** `pdf.js` scored 11/11 instantly and costs 1.68 MB. Most
   supplier quotes are digital PDFs; for those, OCR never runs.
2. **OCR only when there is no text layer** — a scan, a photo, an image.
3. **A field goes green only if it passes a validator**, never on OCR confidence alone:
   - NIF → **CIF/NIF check digit** (§3)
   - IBAN → mod-97, which `validIban()` already implements correctly
   - dates → parse to a real calendar date
   - amounts → **base + IVA = total**, a free arithmetic cross-check; on the poor scan the total
     and rate were read correctly while base and IVA amount were not, so the identity fails and
     flags itself
4. **The document number is always amber.** It was never read correctly from any raster. Do not
   pretend; put the cursor there.
5. **Enforce a capture minimum** — resolution, not steadiness (§2.2). Warn before accepting an
   image below it, rather than producing a 5/11 result and a shrug.
6. **Confidence drives the doc's dots**, per-field, and the first amber field takes focus exactly
   as ADM-03 specifies.

This keeps the doc's promise — _"the system reads the PDF and tries to fill in the header and the
lines, and presents the result for human confirmation"_ — while never letting a partial extraction
create a validated record in silence, which is the rule ADM-03 already states.

**S6 scope is therefore confirmed, not reduced.** The honest expectation to set with the operator:
**digital supplier quotes will feel automatic; scanned and photographed invoices will feel like a
fast form that fills in most of itself and points at what it could not read.**

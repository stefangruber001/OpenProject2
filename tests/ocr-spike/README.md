# OCR spike harness (S0b)

Measures what in-browser extraction can actually read, per field, per input quality.
Findings and the recommendation for S6: `docs/CANEI-V4-OCR-SPIKE.md`.

```bash
npm install tesseract.js pdfjs-dist @tesseract.js-data/spa @tesseract.js-data/cat
mkdir -p langs && cp node_modules/@tesseract.js-data/*/4.0.0_best_int/*.gz langs/
node degrade.mjs     # renders invoice.html into three degraded rasters
node measure.mjs     # scores every input against the eleven ADM-03 fields
```

`tessdata.projectnaptha.com` is unreachable from CI, so the language data comes from npm.

**Re-run this against the real GESTOR scans before S6 starts.** The degradations here approximate
a bad scan; they do not replace one. Point `measure.mjs` at the real files and update the memo.

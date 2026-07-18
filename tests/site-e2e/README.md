# Site E2E — autonomous customer-journey test

A dependency-light harness that drives the **live web app** (the pages the iOS
app loads) end-to-end in a real browser and asserts the outcomes. No human
intervention — this is the "Claude as QA" loop for the product logic.

## What it checks

- **Loads** every app-surfaced page cleanly (title + no console/page errors)
- **Sample → Start → advance** through all 13 lifecycle stages
- The **P&L ledger** shows a real revenue figure after the invoice stage
- Every reached stage is **navigable and renders** via the phase rail
- The **project folder exports** as a valid (PK-signature) `.zip`
- **No horizontal overflow** at 390px (the "cut boxes" regression) on the key pages

## Run

```bash
pnpm test:site          # or: node tests/site-e2e/run.mjs
```

It serves `./site` on a random localhost port, runs headless Chromium, prints a
`✓/✗` report, and exits non-zero if anything regresses. Set `CHROME_PATH` to
use a specific browser; otherwise it falls back to Playwright's Chromium.

## CI

The **“Site E2E (autonomous journey)”** workflow runs it on every push to
`main` and on PRs that touch `site/` or the test.

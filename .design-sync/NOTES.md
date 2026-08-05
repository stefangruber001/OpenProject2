# design-sync notes — Canei Subirats DS (@repo/ui)

- The DS was purpose-built from the shipped site's CSS (site/index.html, site/erp.html);
  classes are `cnx-*`, tokens are `--cnx-*` in packages/ui/styles.css. The site is the
  visual reference for any fidelity question.
- Build: `pnpm -F @repo/ui build` (tsc → dist/, ESM + d.ts). The old Turborepo starter
  stubs at src/button.tsx, src/card.tsx, src/code.tsx stay untouched — apps/web imports
  them via the `./*` path export; the DS barrel is src/index.ts → dist.
- Fonts: the site ships NO webfonts by design — "Roboto Serif"/Inter fall back to
  Georgia/system-ui everywhere. `runtimeFontPrefixes` covers both; do not ship font files.
- Render check needs `DS_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  in this container (playwright cache pins build 1194; the .ds-sync playwright wants 1228).
- Preview text must never start with "⚠ " — the card harness uses that prefix for its own
  caught-error cells and the capture pass flags the cell as an error (hit with Toast).
- Known render warns (triaged legitimate):
  - LogoMark: "mounts have no text" — it is an SVG-only mark; renders fine.
- Tr/Td ship as floor cards deliberately — they only make sense inside Table (whose
  preview composes them); Input/Select also have standalone authored previews.

## Re-sync risks

- The DS mirrors the hand-written site CSS; if site/*.html styles evolve, styles.css here
  must be updated by hand — nothing detects that drift automatically.
- First sync never uploaded (no claude.ai/design authorization in the headless session);
  if config.json lacks projectId, the next run must create/pin the project first.

# Building with the Canei Subirats design system

This is the component vocabulary of a live construction-company ERP (Spanish
reformas SME). Screens are calm, light, premium: soft-green surfaces, serif
headings, generous whitespace.

## Setup

No provider is needed. Wrap each page in a `div.cnx-root` to get the brand
background wash, base font and text color:

```jsx
<div className="cnx-root" style={{ minHeight: "100vh", padding: 26 }}>
  <TopBar subtitle="Plataforma de gestión">
    <Button variant="primary">Abrir torre de control →</Button>
  </TopBar>
  {/* content */}
</div>
```

Components also self-carry the brand sans, so they render correctly even
without the shell — but page backgrounds only come from `cnx-root`.

## Styling idiom

Style through component props and the CSS custom properties — do not invent
utility classes. Layout glue is plain inline style or your own classes using
the tokens. The tokens (all defined in `styles.css`):

- Color: `--cnx-green`, `--cnx-green-deep`, `--cnx-green-lt`, `--cnx-green-soft`,
  `--cnx-green-pale`, `--cnx-spark` (gold accent), `--cnx-ink`, `--cnx-body`,
  `--cnx-muted`, `--cnx-faint`, `--cnx-line`, `--cnx-hair`, `--cnx-bg`,
  `--cnx-paper`, `--cnx-danger`, `--cnx-danger-soft`, `--cnx-amber`, `--cnx-amber-soft`
- Elevation: `--cnx-shadow`, `--cnx-shadow-lg` · Radii: `--cnx-r-sm|md|lg`
- Type: `--cnx-serif` (headings, big figures), `--cnx-sans` (everything else)

Headings and KPI figures are serif (`var(--cnx-serif)`); UI text is sans.
Money renders with `font-variant-numeric: tabular-nums` (Table's `Td numeric`
and StatTile do this for you).

## Composition patterns

- Dashboard header: a grid of `StatTile` (one `variant="highlight"`, alerts as
  `variant="warn"`).
- Navigation grids: `ModuleCard` (the single `variant="tower"` card spans 2 columns).
- Record lists: `Table head={[…]}` + `Tr`/`Td` rows, states as `Tag`
  (`ok`/`neutral`/`warn`/`danger`/`spark`).
- Record editing: `Drawer` on the right containing `Card` sections of
  `Field`+`Input`/`Select`, closing with `Button variant="primary"`.
- Section starts: `SectionHeader title hint`; day summaries: `ListItem strong`;
  inline policy notes: `NotePanel tone`.

Content language is Spanish (the customer's working language) — use realistic
ERP content: FAC-2026-0001 numbering, € amounts with dot thousands
("23.640 €"), real trade terms (presupuesto, obra, gestoría).

## Where the truth lives

Read `styles.css` (tokens + every `cnx-*` class) before styling anything, and
each component's `.d.ts`/`.prompt.md` for its exact API.

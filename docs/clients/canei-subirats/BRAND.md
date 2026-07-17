# Canei Subirats — Corporate Identity (brand spec)

> **What this is.** The durable capture of Canei Subirats' brand, extracted from
> their own public website (`cane.gestortectic.com`, WordPress + Avada theme) on
> 2026-07-16. This is the source of truth for applying their identity to
> **everything we build for them** — the ERP UI, presupuestos/facturas,
> published demos, delivery docs. Company-specific material is **data**, never a
> code fork (see `CLAUDE.md` → "Customisation is config"). The machine-readable
> tokens live in `tenants/diorka/tenant.yaml` → `config.branding`; this file is
> the human-readable rationale behind them.
>
> **Working language is English** (operator's instruction: build in English,
> switch to Spanish/Catalan before handover). Their real-world site is
> **Catalan-first (CAT) with a Spanish (ESP) toggle**; that is the handover
> target, not the working default.

## 1. Company

| Field           | Value                                                            |
| --------------- | ---------------------------------------------------------------- |
| Legal name      | **Canei Subirats, S.L.**                                         |
| Trade name      | Canei Subirats                                                   |
| Sector          | Integral renovations, installations & interior design (reformas) |
| Registered seat | Carrer de la Creu, 74 · 08960 Sant Just Desvern · Barcelona · ES |
| Phone           | 659 87 67 00                                                     |
| Email           | hola@caneisubirats.com                                           |
| Web             | https://cane.gestortectic.com (their live site)                  |
| Social          | Instagram                                                        |
| Experience      | 20+ years in renovation & construction                           |
| Guarantee       | 2 years on renovations · 6 months on repairs                     |

> **Tax ID (CIF)** is not published on the website → still `pending-validation`
> in `tenant.yaml` (confirm at the BRD §11.1 workshop). Everything above is
> public, first-party fact taken from their own footer/contact page.

## 2. The name (use it — it is the brand's soul)

> _"Canei, a word of Taíno origin describing the rural dwellings of the
> Caribbean, and Subirats, the family legacy that drives us."_

The name fuses **craft/shelter** (Canei = a home you build) with **family
legacy** (Subirats). When we need a human touch in copy, this is the well to
draw from: they build homes, as a family trade, with 20 years of hands in it.

## 3. Voice & positioning

- **Slogan (keep verbatim, do not translate in the logo lockup):**
  **"Reformes senzillament complexes"** — _Renovations, simply complex._
  Working-English rendering for UI copy: **"Renovations, simply complex."**
- **Hero promise:** "We build the space you've already imagined."
  (CA: _Construïm l'espai que ja has imaginat._)
- **Core tension they own:** the work is genuinely complex; the _client's_
  experience must be simple. Everything we build should reduce the client's
  effort, not show off the machinery.
- **The formula (two beats, reuse as a UX principle):**
  1. **Complex analysis** — every technical detail studied to the millimetre.
  2. **Simple execution** — for you: one point of contact, fixed deadlines,
     no headaches.
- **Tone:** warm, precise, reassuring, craftsman-proud. "Construction as a
  craft of precision; renovation as an exercise in trust." Long-term
  relationships over transactions.

### Three trust pillars (their "why us")

1. **Consolidated team** — in-house technicians (installers, bricklayers,
   plasterboarders) + trusted partner brands, working shoulder-to-shoulder.
2. **Total site control** — integrated works direction, constant quality
   control, **a single interlocutor** for the client.
3. **Guarantee & seriousness** — respect for agreed deadlines and budgets;
   2-year renovation / 6-month repair guarantee.

> These three map directly onto ERP value: the single-interlocutor promise is
> why the presupuesto→factura flow must be one clean thread; "respect for
> budgets" is why quoted-vs-actual per partida matters to them.

## 4. Services (their taxonomy — use as vertical/reformas labels)

| #   | Service (EN working)       | Catalan (handover)          | One-liner                                                                |
| --- | -------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| 1   | Interior design            | Interiorisme                | "We give soul to your space."                                            |
| 2   | Full renovations           | Reformes Integrals          | "Total transformation, seamless."                                        |
| 3   | Kitchen & bath renovations | Reformes de Cuines i Banys  | "The engineering of detail in the key rooms."                            |
| 4   | Installations & efficiency | Instal·lacions i Eficiència | "The invisible engine of your home." (water/elec/gas, HVAC, aerothermal) |
| 5   | Vertical works             | Treballs Verticals          | "Specialists in challenges at height." (no scaffold)                     |

## 5. Palette

Extracted from the Avada `--awb-*` CSS variables. Primary is a grounded,
natural **green** (build/earth/trust); the yellow pictogram is the spark accent.

| Token           | Hex       | Role                                                                                              |
| --------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `brand.green`   | `#48733C` | Primary — headings, primary buttons, brand bar                                                    |
| `brand.greenLt` | `#65BC7B` | Secondary green — accents, success, hovers                                                        |
| `brand.yellow`  | `#F2C230` | Accent (from `picto-groc` pictogram) — sparingly. _Approximate; refine from the SVG at handover._ |
| `neutral.ink`   | `#000000` | Primary text                                                                                      |
| `neutral.body`  | `#333333` | Body text                                                                                         |
| `neutral.muted` | `#747474` | Secondary text                                                                                    |
| `neutral.line`  | `#D2D2D2` | Borders / rules                                                                                   |
| `neutral.mist`  | `#E5E4E3` | Soft fills / section bands                                                                        |
| `neutral.paper` | `#FFFFFF` | Surface / paper                                                                                   |

## 6. Typography

- **Display / headings:** **Roboto Serif** — the serif carries the "craft,
  established, trustworthy" note. Use for H1–H3, presupuesto/factura titles.
- **Body / UI:** **Inter** (stack: `Inter, Arial, Helvetica, sans-serif`) —
  clean, legible, non-fussy. Use for everything running text and controls.

## 7. Logo assets (their originals — reference, do not recreate)

| Asset                            | Use                                   |
| -------------------------------- | ------------------------------------- |
| `logo-Caneisubirats-2.svg`       | Main logo (on light)                  |
| `logo-Caneisubirats_blanc-1.svg` | White logo (on green/dark)            |
| `caneisubirats_verd.png`         | Green wordmark (raster)               |
| `picto-groc.png`                 | Yellow pictogram / favicon-scale mark |

> We do not have the source files in-repo (they live on their WordPress media
> library). Until they are handed over, our UI uses a **typographic wordmark**
> ("Canei Subirats" in Roboto Serif, brand green) as a faithful stand-in, plus a
> small green square + yellow spark echoing the pictogram. Swap for the real
> SVGs at handover. Tracked in `INTEGRATIONS_PENDING.md`.

## 8. How this maps to the ERP

- **UI chrome:** brand-green top bar, white logo lockup, Inter UI, Roboto Serif
  headings, greenLt for success/accepted states, yellow only for a single
  call-to-action or highlight.
- **Documents (presupuesto/factura):** Roboto Serif document title with a thin
  brand-green rule; footer carries legal name, seat, phone, email exactly as
  §1. The slogan may sit under the logo, never inside the fiscal block.
- **Language:** UI ships an English label set now; Spanish + Catalan sets are
  data, switched on before handover (their site proves CAT-first/ESP-toggle is
  the expectation). Fiscal locale stays `es-ES` (Spanish VAT + `1.234,56 €`).

---

_Source: first-party extraction of `cane.gestortectic.com` (5 page webarchives,
2026-07-16). Reviews shown on their site are a mis-scoped Trustindex widget
(restaurant reviews) and are **not** Canei Subirats testimonials — ignore._

# ROADMAP PROMPT — FINDING TENANT #2…#N IN THE BARCELONA REGION

## An IESE-style market-entry and account-identification process for an ERP factory

Approved by the operator on 2026-09-12 and executed unattended. Each phase below
is run by its own agent on the model the table names; each agent receives the
phase prompt verbatim plus the artefacts of the phases before it.

### MODEL ASSIGNMENT AND RATIONALE

| Phase                            | Model               | Why this model                                                                                  |
| -------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| 0 Reference-case codification    | Opus                | Reads a real codebase and a real business and separates what generalises from what was bespoke. |
| 1 Market definition & sizing     | Opus + web          | Multi-source reconciliation with contradictory statistics.                                      |
| 2 ICP & distance model           | Opus                | Framework design; errors compound.                                                              |
| 3 Trigger & regulatory mapping   | Opus + web          | Legal deadlines must be right; primary sources only.                                            |
| 4 List construction & enrichment | Haiku               | Schema-bound extraction at volume.                                                              |
| 4b Enrichment QA                 | Sonnet              | Spot-audits at ~10% sample.                                                                     |
| 5 Scoring & prioritisation       | Sonnet              | Fixed rubric across many rows.                                                                  |
| 6 Value proposition & ROI        | Opus                | Quantified argument that must survive a CFO.                                                    |
| 7 Tailoring cost model           | Opus                | Reads the architecture and measures the CLI.                                                    |
| 8 Go-to-market motion            | Sonnet + web        | Structured planning against a known framework.                                                  |
| 9 Outreach assets (ES/CA/EN)     | Fable               | Prose quality is the product.                                                                   |
| 10 Pilot design                  | Sonnet              | Operational specification.                                                                      |
| 11 Red team / pre-mortem         | Opus, fresh context | Adversarial reasoning against the thesis.                                                       |
| 12 Board synthesis               | Opus                | Compression without loss.                                                                       |

---

## PHASE 0 — CODIFY THE REFERENCE CASE

You are a senior IESE case writer and enterprise-software strategist. I run an
ERP factory: a system that takes a specification and emits a running, tested,
jurisdiction-compliant ERP, designed to repeat across 1000+ EU SME tenants.
Tenant #1 is Canei Subirats, S.L., a construction and renovation ("reformas")
SME in Sant Just Desvern, Barcelona.

The architecture is strictly layered, downward only:
`plugins → tenant config (data only) → vertical packs → jurisdiction packs →
capabilities → kernel`. The kernel and capabilities contain ZERO jurisdiction
or sector knowledge. Capabilities define ports; packs supply adapters; a
resolver binds them per tenant from `tenants/<id>/tenant.yaml`. Customisation
is configuration (data), never a code fork.

The delivered system covers: quotations with chapters, line items, versions and
a graphic annex; a priced catalogue; contracts with clause blocks, signature and
instalments; projects with Gantt scheduling, baseline, critical path and S-curve;
variations/change orders; progress valuations; customer invoicing, credit notes,
receipts and receivables; supplier invoices, purchases and subcontracts with
document-expiry compliance; bank statement import and reconciliation, petty cash
and cards; labour hours with a site-worker role, approvals and corrections; an
accountant hand-off package; a 13-phase customer journey; every document in PDF,
Word and Excel in Spanish, Catalan and English; templated communications filed as
mailbox drafts; and a native iOS app.

TASK. Write the reference case in three parts.

PART A — WHAT GENERALISES. For each capability above, judge whether it is (i)
universal to any project-based SME, (ii) specific to construction/reformas, (iii)
specific to Spain or Catalonia, or (iv) specific to Canei alone. Be strict:
anything you cannot defend as generalising, mark as bespoke. State your evidence.

PART B — WHAT THE CUSTOMER ACTUALLY BOUGHT. Reconstruct the buying rationale.
What was the pain before? What was the trigger? Who decided? What would they have
bought instead? What did they refuse to change about how they work? Where you do
not know, say so and list it as a question to put to the customer — do not invent
a motive.

PART C — THE TRANSFERABLE ASSET. State in one page what a second customer is
actually buying: not "an ERP", but the specific accumulated fit. Name the three
capabilities that took the most effort to get right and would take a competitor
longest to copy.

Output as a structured document with an explicit "open questions for the
customer" list at the end. Flag every assumption in bold.

Artefact: `00-REFERENCE-CASE.md`

---

## PHASE 1 — MARKET DEFINITION AND SIZING

Using `00-REFERENCE-CASE.md`, define and size the market for this ERP in the
Barcelona region.

1. MARKET DEFINITION. Define the market by job-to-be-done, not by product
   category. State explicitly what is IN and what is OUT, and defend both edges.
2. SEGMENTATION BY CNAE. Work through the relevant Spanish CNAE-2009 codes —
   at minimum 41.1 (promoción inmobiliaria), 41.2 (construcción de edificios),
   43.1 (demolición y preparación), 43.2 (instalaciones: 43.21 eléctricas,
   43.22 fontanería/climatización, 43.29 otras), 43.3 (acabado de edificios:
   43.31 revocamiento, 43.32 carpintería, 43.33 revestimiento de suelos y
   paredes, 43.34 pintura, 43.39 otros), 43.9 (otras especializadas). For each,
   assess fit against the reference case.
3. SIZE IT. Produce TAM / SAM / SOM for Barcelona province and for Catalonia,
   segmented by employee band (1–9, 10–49, 50–249). Use INE DIRCE and Idescat as
   primary sources; cite every figure with source and year. Where sources
   disagree, show both and say which you trust and why.
4. THE SWEET SPOT. Identify the employee-count and revenue band where the pain
   is acute enough to pay and the organisation is simple enough to deploy into.
   Defend the upper and lower bounds — state what breaks above and below.
5. ADJACENCY MAP. Rank adjacent niches by transferability from reformas:
   installers, industrial maintenance, landscaping/jardinería, facility
   management, interior fit-out, restoration/rehabilitación, solar/energy
   retrofit. Score each on how much of the reference case survives the move.

Cite everything. Where you cannot find a figure, say "not found" rather than
estimating silently. If you estimate, label it ESTIMATE and show the method.

Artefact: `01-MARKET-MAP.md`

---

## PHASE 2 — IDEAL CUSTOMER PROFILE AND THE DISTANCE MODEL

Build the targeting instrument. Two parts.

PART A — ICP. From `00-REFERENCE-CASE.md` and `01-MARKET-MAP.md`, write the Ideal
Customer Profile: firmographics, operating characteristics, technology estate,
organisational signals, and disqualifiers. Disqualifiers matter as much as
qualifiers — name at least six firms you would actively decline and why.

PART B — THE DISTANCE MODEL. Adapt Pankaj Ghemawat's CAGE Distance Framework
(Ghemawat is IESE's own; the framework was built for country distance — you are
adapting it to measure distance from our reference implementation). Score each
prospect on:

- **Cultural distance** — working language (Spanish/Catalan), owner-managed vs.
  professionalised, craft vs. process culture, appetite for being measured.
- **Administrative distance** — legal form, tax regime, collective agreement,
  subcontracting compliance load (REA, CAE, Libro de Subcontratación), whether
  they bid for public work, their gestoría relationship.
- **Geographic distance** — travel time for on-site deployment, number of
  simultaneous sites, whether crews are mobile.
- **Economic distance** — revenue band, project size distribution, margin
  structure, payment terms and working-capital stress.

PART C — THE LAYER-DISTANCE OVERLAY. This is the one that governs our unit
economics. For any prospect, estimate the deepest architectural layer their
requirements force us into:

- **L0 — tenant config only** (data: rates, series, clause blocks, catalogue,
  users). Marginal cost near zero. THIS IS THE TARGET.
- **L1 — plugin** (additive, isolated).
- **L2 — new or extended vertical pack** (a sector we have not modelled).
- **L3 — new or extended jurisdiction pack** (a tax or filing regime we lack).
- **L4 — new capability** (a port that does not exist). Expensive, but reusable
  across every future tenant — price it as investment, not as project cost.
- **L5 — kernel change.** Forbidden by architecture. A prospect requiring this
  is a prospect we decline, and you must say so.

Produce a scoring rubric, 0–100, weighted, with explicit anchors for each score
band so that two different analysts would score the same firm within 10 points.
Weight layer-distance most heavily. Output the rubric as a table ready to apply.

Artefact: `02-ICP-AND-RUBRIC.md`

---

## PHASE 3 — TRIGGER AND REGULATORY URGENCY MAP

SMEs buy ERP when something forces them to, not when it would be wise. Map the
forcing functions for Spanish construction SMEs, as at today's date.

For each of the following, establish: the current legal position, the deadline
applicable to a company of our ICP's size, the penalty for non-compliance, and
what it obliges the software to do. Verify each against BOE, AEAT or the
relevant authority — cite the instrument (law, royal decree, article) and its
date. Where a deadline has moved, say so and give the amending instrument.
If you cannot verify a claim against a primary source, mark it UNVERIFIED and
do not build an argument on it.

1. Ley 11/2021 antifraude and the Verifactu / certified-billing-software regime
   (RD 1007/2023 and its amendments) — applicable dates by taxpayer type.
2. Ley 18/2022 "Crea y Crece" mandatory B2B electronic invoicing — status,
   implementing regulation, and phase-in by company size.
3. SII (Suministro Inmediato de Información) thresholds.
4. Construction-specific obligations: Libro de Subcontratación, REA registration,
   CAE coordination duties, TPC cards, Convenio General del Sector de la
   Construcción obligations on hours and site records.
5. Periodic tax filings an SME must produce (e.g. Modelo 303, 111, 190, 347) and
   what data the ERP must hold to produce them cleanly.
6. Digitalisation subsidies: Kit Digital and any Catalan/ACCIÓ successor
   programmes — current status, eligibility by employee band, amounts, deadlines.

THEN: rank these by urgency-to-buy. For each, write the one sentence a sales
conversation should open with. Finally, list non-regulatory triggers — a failed
audit, a lost margin on a big job, a generational handover, an ERP renewal date,
a new gestoría, rapid headcount growth — and how each is DETECTABLE from
outside the company.

Artefact: `03-TRIGGER-MAP.md` — the detectability column drives Phase 4.

---

## PHASE 4 — TARGET LIST CONSTRUCTION

4a — Source plan. Produce a sourcing plan naming, for each source: what it
yields, how to access it, cost, refresh rate, and legal basis for processing
under GDPR/LOPDGDD. Cover at least:

- SABI (Bureau van Dijk) — Iberian financials, the standard for this work
- Informa D&B / eInforma / Axesor — Spanish company data
- BORME — incorporations, changes of officer, capital events
- INE DIRCE and Idescat — sector and size distributions
- Ajuntament de Barcelona open data — building permits (llicències d'obres)
  and equivalent open portals for Hospitalet, Badalona, Sabadell, Terrassa,
  Mataró, Sant Cugat. Permit records name the contractor: this is the single
  best signal of who is actively building, right now, at what value.
- Plataforma de Contratación del Sector Público and Contractació Pública de
  Catalunya — who bids for and wins public work
- Trade bodies: Gremi de Constructors d'Obres de Barcelona, Cambra de
  Contractistes d'Obres de Catalunya, Gremi d'Instal·ladors, Foment del Treball
- Professional colleges as referral channels: CAATEEB (aparelladors — they sit
  between owner and builder on almost every reform) and COAC (architects)
- Marketplaces: Habitissimo, Houzz, Cronoshare — review volume and recency
- LinkedIn Sales Navigator; Google Maps/Places for footprint and reviews

4b — Extraction. For each candidate firm, extract to this exact schema, one
JSON object per firm, leaving any field you cannot source as `null` — never
guess:
`{legal_name, trade_name, nif, cnae, municipality, province, founded_year,
employees_band, revenue_band_eur, revenue_year, directors[], website,
email, phone, public_contracts_count, permits_last_24m, permit_value_total_eur,
review_count, review_avg, review_recency_months, known_software[], source_urls[]}`
Process in batches of 50. Do not editorialise. Output JSONL only.

4c — QA. Sample 10% of the extracted rows at random. For each, re-derive every
field from `source_urls` and report mismatches. Report the error rate by field.
If any field exceeds 5% error, state that the field is unreliable and must be
excluded from scoring rather than silently used.

Artefacts: `04a-SOURCE-PLAN.md`, `04-PROSPECTS.jsonl`, `04-EXTRACTION-QA.md`

---

## PHASE 5 — SCORING AND PRIORITISATION

Apply `02-ICP-AND-RUBRIC.md` to every row in `04-PROSPECTS.jsonl`. For each firm
output: the four CAGE distance scores, the estimated layer-distance (L0–L5) with
the single requirement that drives it, the total weighted score, the detected
triggers from `03-TRIGGER-MAP.md`, and a one-line rationale.

Then, applying customer-equity thinking in the tradition of IESE's Julián
Villanueva (customer lifetime value as the unit of account, not first-year
revenue), estimate for each firm: expected annual contract value, expected
retention, gross margin after the tailoring cost from Phase 7, and CLV. Show the
assumptions as an explicit table — they will be challenged.

Output four tiers:

- Tier A — Design partners (5–8 firms). L0 or L1, strong trigger, reachable,
  and willing to be a reference. These are not just the highest scores; they are
  the ones whose success is most CITABLE to the rest of the segment.
- Tier B — Near-term (20–30). L0–L1, weaker trigger or harder to reach.
- Tier C — Investment cases (5–10). L2–L4, but the pack or capability they
  force unlocks a named sub-segment. Quantify the unlock: how many Tier-A/B
  prospects does that pack make L0?
- Tier D — Decline. Say why, plainly. Include any L5.

For every firm in Tier A and B, name the single most likely reason we LOSE them.

Artefact: `05-TARGET-LIST.md`

---

## PHASE 6 — VALUE PROPOSITION AND QUANTIFIED ROI

For each of the top three segments in `05-TARGET-LIST.md`, build the economic
case the way a CFO would demand it — in the tradition of IESE's Pablo Fernández
on value creation: state the cash-flow effect, not the feature.

For each segment:

1. The three most expensive operational failures today, each with a plausible
   annual euro cost and the method used to derive it.
2. Which specific capability removes each failure, and by how much.
3. A defensible payback-period model with named assumptions, plus a sensitivity
   table: what has to be true for payback to exceed 24 months?
4. The strongest argument AGAINST buying — including "keep using Excel and a
   gestoría", which is the real incumbent. Beat it honestly or concede the segment.
5. Pricing hypothesis: per-seat, per-project, per-site, or flat. Recommend one
   and justify against how this segment already buys things.

Do not use the words "streamline", "efficiency", "solution" or "digital
transformation". Every claim must be a number with a derivation or an
observation with a source.

Artefact: `06-VALUE-CASE.md`

---

## PHASE 7 — TAILORING COST MODEL

You have the ERP factory codebase. Build the cost model for onboarding a new
tenant, which is the number that decides whether this business scales.

1. INVENTORY THE CONFIGURATION SURFACE. From `tenants/<id>/tenant.yaml` and the
   resolver, enumerate every knob that is data rather than code. This set IS the
   L0 boundary. State it precisely.
2. MEASURE TENANT #1. Reconstruct what it actually took to tailor for Canei:
   which changes were config, which were pack, which were capability, and which
   were bespoke and should be pushed down. Name the technical debt explicitly.
3. COST PER LAYER. Give an engineering-hours estimate and a calendar estimate
   for onboarding at each of L0–L4, with a confidence interval and what drives
   the variance.
4. THE 15-MINUTE TEST. The stated Definition of Done requires tenant #2 in under
   15 minutes, configuration-only. Assess honestly whether that holds today. If
   not, list exactly what blocks it, ordered by cost to fix. This is the single
   most commercially important answer in this document — do not soften it.
5. MARGINAL ECONOMICS. Gross margin per tenant at each layer, at the pricing
   hypothesis from Phase 6. Identify the tenant count at which each Tier-C pack
   investment pays back.
6. THE COMPOUNDING CLAIM. For each Tier-C pack, state how many currently-L2
   prospects it converts to L0. That conversion — not the first customer's fee —
   is the return on the pack.

Artefact: `07-TAILORING-ECONOMICS.md` — this feeds back and revises Phase 5's CLV.

---

## PHASE 8 — GO-TO-MARKET MOTION

Design the route to market for Tier A and B. Address:

1. Channel vs. direct. Assess three channel hypotheses specific to Catalonia:
   (a) gestorías and asesorías — they already hold the books of hundreds of
   these firms and feel the compliance pain directly; (b) CAATEEB
   aparelladors — they sit between owner and contractor on most reforms and are
   trusted by both; (c) trade gremis as endorsement and event access.
   For each: incentive structure, conflict risk, time-to-first-referral, and what
   would have to be true for it to beat direct sales.
2. Sequencing. Which segment first, and why that one earns the right to the
   next. Name the reference you are trying to manufacture.
3. Qualification. Adapt MEDDPICC to this buyer — in an owner-managed SME the
   Economic Buyer, Champion and end user are frequently the same person, which
   breaks the standard framework. Say how you adapt it.
4. Sales cycle. Expected length, stages, exit criteria per stage, and the
   artefact that moves each stage (a demo on THEIR data is likely the pivot —
   assess whether the factory can produce one cheaply, using Phase 7's answer).
5. Language. Where Catalan is required rather than merely appreciated, and
   what that implies for materials and for who does the selling.
6. Objection register. The twelve objections you will actually hear, with
   the honest answer to each — including the ones where the honest answer is
   "we are not the right fit".

Artefact: `08-GTM-PLAN.md`

---

## PHASE 9 — OUTREACH ASSETS

Write the outreach assets for Tier A, in Spanish and Catalan, with English
versions for internal review. You are writing to an owner-manager of a
12-to-40-person construction firm who is on site, reads on a phone, is sold to
constantly, and can smell a template.

Produce: (1) a first-touch email, under 120 words, referencing something
specific and verifiable about their business; (2) two follow-ups on different
angles; (3) a LinkedIn message under 300 characters; (4) a one-page leave-behind;
(5) a 90-second spoken pitch; (6) a referral-request note for a gestoría or
aparellador to forward.

Rules. No corporate register. No "transformación digital", no "solución
integral", no "líder". Lead with the problem in their own vocabulary. Catalan
must be written, not translated — if the Catalan reads as a translation of the
Spanish, it has failed. Every factual claim must trace to `06-VALUE-CASE.md`; do
not invent a statistic or a customer quote. Where you would normally put a
testimonial, put a placeholder marked `[REQUIRES CUSTOMER CONSENT]`.

Artefact: `09-OUTREACH-KIT.md`

---

## PHASE 10 — DESIGN-PARTNER PILOT

Specify the pilot offered to Tier A. Cover: what they get and what they give
(data access, time, reference rights); duration and exit criteria; the three
success metrics measured on THEIR numbers, with the baseline captured before
anything is installed — a pilot with no pre-measurement can only produce
opinion; pricing during and after; what we learn that is reusable, mapped to the
layer model; the kill criteria — state the conditions under which we stop, in
advance, in writing; and the data-protection posture, given this is real
financial and employee data under GDPR/LOPDGDD, including the processor
agreement and the retention position.

Artefact: `10-PILOT-SPEC.md`

---

## PHASE 11 — RED TEAM AND PRE-MORTEM

You are an IESE professor supervising this plan, and you are sceptical. Here are
the artefacts from Phases 0–10. It is eighteen months from now and the effort
has failed to land a single profitable tenant beyond the first.

1. Write the pre-mortem: the five most probable causes, most likely first.
2. Attack the market sizing. Which number is load-bearing, and what happens to
   the conclusion if it is wrong by half?
3. Attack the layer model. Where is the claim that a prospect is "L0" most likely
   to be wrong, and what does it cost when it is?
4. Attack the ICP. What if the firms that fit best are precisely the ones least
   willing to pay — because they are well-run and already coping?
5. Attack the value case. Which euro figure is softest?
6. Name what the plan has not considered at all.
7. State the three cheapest experiments that would falsify the riskiest
   assumptions inside 30 days. Cheapest first. Each must have a pre-committed
   threshold that counts as failure.

Be specific and be unkind. A plan that survives a polite review has not been
reviewed.

Artefact: `11-RED-TEAM.md`

---

## PHASE 12 — SYNTHESIS

Compress everything into a decision document, in English.

- One page: the thesis, the named Tier-A targets, the ask, the decision required.
- Three pages: market, ICP, value case, economics, motion, risks.
- Appendices: the full artefacts.
- A 90-day plan with named owners, weekly milestones, and the Phase-11
  experiments scheduled first.
- A falsification section: the three things that, if observed, mean we stop.
  Written before we start, so that stopping is a decision we already made rather
  than one we argue about later.

Where the evidence is thin, say so in the body rather than in a footnote.

Artefact: `12-SYNTHESIS.md`

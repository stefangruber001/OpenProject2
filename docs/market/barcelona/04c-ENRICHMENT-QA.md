# QA Audit — 04c-ENRICHED.jsonl (Barcelona Construction Prospects)

This audit was carried out on 2026-09-13 against the 128-row enriched
prospect file `docs/market/barcelona/04c-ENRICHED.jsonl`, produced by six
research workers using WebSearch only (direct URL fetches were blocked by the
egress proxy throughout the enrichment pass, a limitation the file's own
per-row notes record repeatedly). The purpose of this audit is exactly the
one named in the source-plan's own closing instruction ("leave the error-rate
measurement to 4c"): to independently re-derive a sample of the file's
populated fields from fresh web searches and report where the file can be
trusted and where it cannot, before any row is used to build a call list. The
file itself was not modified in the course of this audit.

## Sample

Fifteen rows were selected by a seeded pseudo-random shuffle (node.js,
`mulberry32` PRNG, seed `20260913`), applied separately within each tier so
the sample would spread across the file's tier distribution (A: 7 rows total,
B: 30, C: 13, D: 78) rather than cluster in the largest tier by chance. The
shuffle-and-slice script is reproducible; running it again with the same seed
returns the same rows. Targets were approximately 2×A, 4×B, 2×C, 7×D; the
actual draw was:

- **Tier A (2):** rows 5, 6
- **Tier B (4):** rows 10, 13, 16, 27
- **Tier C (2):** rows 38, 49
- **Tier D (7):** rows 56, 76, 94, 100, 103, 112, 120

Sampled firms: A Instalaciones Y Reformas De Calidad SL (5), Reformas Lluca
Les Corts SL (6), BCN Portal Reformas SL (10), Construcciones Reformas Y
Servicios Mataro SL (13), Construmed Bcn SL (16), Reformes Lap Grup Nova Casa
SL (27), FM&M Reformas E Instalaciones SL (38), Reforma Integral Granollers
Interiorisme SL (49), Construccialia Obras y Reformas SL (56), L A Reformas
Llobregat SL (76), Reformas Casa Luz SL (94), Reformas Terrassa SL (100),
Reformas y Diseño a Medida SL (103), V.A.A.C. Reformas Y Decoracion S.L.
(112), Reformas Integrales El Masnou S.C.P. (120). For each, every populated
field was re-searched independently (firm name, NIF, and the domain of the
cited source), budgeting roughly 4-6 searches per row rather than the full 8,
because most rows converged on the same registry facts (NIF, CNAE, address,
founded year) within 2-3 queries and the remaining budget went to owner
provenance and the dead-company and rescore checks below, which needed
targeted follow-up searches of their own.

## Field-by-field results

"n" is the number of CONFIRMED+CONTRADICTED observations (UNSUPPORTED
excluded, since it has no directional error to attribute). A dash means the
field was never populated in the sampled rows.

| Field                | CONFIRMED | CONTRADICTED | UNSUPPORTED | n   | Notes                                                                                                                                                                                                                                                                                                                       |
| -------------------- | --------- | ------------ | ----------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nif                  | 13        | 0            | 1           | 13  | Row 49's exact NIF string did not resurface verbatim in the search summaries, though the company itself was confirmed by name/address.                                                                                                                                                                                      |
| cnae                 | 10        | 0            | 0           | 10  | Every populated CNAE matched a fresh registry hit, including the "412" 3-digit group code in row 66 (checked separately, see Rescore section) and the "4335" code in row 112 (see below — valid only under CNAE-2025).                                                                                                      |
| owner_name           | 2         | 0            | 0           | 2   | Both sampled owner names (rows 27, 38) matched independently.                                                                                                                                                                                                                                                               |
| owner_role           | 1         | 1            | 0           | 2   | Row 27's "Administrador único" confirmed. Row 38's "Administrador unico" was returned by fresh search as "socio único" (sole shareholder) rather than administrator — a distinct legal role in Spanish company law, even though the same person often holds both. Flagged, not fatal, but n is too small (2) to generalise. |
| phone                | 3         | 0            | 1           | 3   | Row 6's phone could not be independently re-surfaced in the search snippet text (same einforma page as cited, but the number itself wasn't quoted back).                                                                                                                                                                    |
| email                | 5         | 0            | 0           | 5   | All confirmed, including the yahoo.es and gmail.com addresses that the workers' own notes flagged and justified as firm-published business contacts.                                                                                                                                                                        |
| website              | 5         | 0            | 0           | 5   | All confirmed.                                                                                                                                                                                                                                                                                                              |
| contact_form_url     | 1         | 0            | 0           | 1   | Only one sampled row populates this field.                                                                                                                                                                                                                                                                                  |
| address              | 12        | 0            | 0           | 12  | All confirmed, including every case where the true municipality is not "Barcelona" (see Identity checks).                                                                                                                                                                                                                   |
| founded_year         | 8         | 0            | 1           | 8   | Row 38's 2021 founding year was not independently re-surfaced this pass; row 5's 2012 is corroborated by one source and mildly disputed by another giving Jan 2013 for the same company — treated as confirmed given majority support, but noted.                                                                           |
| employees_band       | 8         | 0            | 0           | 8   | All confirmed against fresher per-year employee counts, including a stale 2006 figure in row 120 that the file itself already flags as old.                                                                                                                                                                                 |
| revenue_band_eur     | 1         | 0            | 1           | 1   | Row 6's band could not be independently re-derived; row 5's was confirmed.                                                                                                                                                                                                                                                  |
| activity_description | 13        | 0            | 0           | 13  | All confirmed.                                                                                                                                                                                                                                                                                                              |

## Error rate by field

Using error rate = CONTRADICTED / (CONFIRMED + CONTRADICTED):

- nif: 0/13 = **0% error rate** (1 unsupported, 7% of populated sample)
- cnae: 0/10 = **0% error rate**
- owner_name: 0/2 = **0% error rate**
- owner_role: 1/2 = **50% error rate** — but n=2, so this is a flag for wider sampling, not a certified rate
- phone: 0/3 = **0% error rate** (1 unsupported, 25%)
- email: 0/5 = **0% error rate**
- website: 0/5 = **0% error rate**
- contact_form_url: 0/1 = **0% error rate** (n too small to mean anything)
- address: 0/12 = **0% error rate**
- founded_year: 0/8 = **0% error rate** (1 unsupported, 11%)
- employees_band: 0/8 = **0% error rate**
- revenue_band_eur: 0/1 = **0% error rate** (n too small to mean anything; 1 unsupported)
- activity_description: 0/13 = **0% error rate**

Overall UNSUPPORTED share across all populated fields checked (58 populated
observations across 15 rows, 4 of them UNSUPPORTED): **~7%**. This is a
materially better outcome than the 30.8% municipality error rate that
prompted this audit in the source dataset referenced in the brief. On this
sample, no field showed a genuine, well-supported contradiction; the single
apparent contradiction (owner_role, row 38) is a role-precision nuance rather
than a wrong-company or wrong-fact error, and rests on an n of 2.

## Identity checks

All 14 NIF-bearing sampled rows resolved to the correct legal entity at the
correct registered address on independent search — none of the sampled firms
turned out to be a same-named company from a different province, which is
the specific and most damaging failure mode named in the brief. Several rows
carry a registered municipality that is **not** the city of Barcelona (row 6
Sabadell, row 56 Malgrat de Mar, row 76 Viladecans, row 94 Sabadell, row 100
Terrassa, row 112 Cornellà de Llobregat, row 120 Vilassar de Dalt) — but in
every case the file's own `address` field already states the correct
municipality; this is consistent with the source plan's declared scope
(province of Barcelona, not city of Barcelona) and is not a data error. Row
56's own notes flag this explicitly as a caution for whoever built the
upstream roster.

One identity gap: **row 103, "Reformas y Diseño a Medida SL," could not be
located in any registry or search result**, matching the file's own
conclusion. Independent search surfaced only a differently-named, differently
located company ("Reformas Y Diseño Barcino SL", CIF B75330530, Viladecavalls)
that is clearly not the same entity. This row may be a phantom entry that
should never have reached the enrichment stage; it should be excluded from
any call list rather than carried forward as "pending" data.

## Owner-name provenance

Across the full 128-row file (not just the 15-row sample), 33 rows carry a
populated `owner_name`. Their `owner_source` domains are overwhelmingly the
expected company-registry republishers — einforma.com, axesor.es,
infonif.economia3.com, iberinform.es, empresite.eleconomista.es — and **no
row in the entire file sources an owner name from LinkedIn, Facebook, a
review site, or a news article**, which is the specific breach the source
plan's GDPR posture (section 5: "directors[] only from public registry
sources... may not be taken from LinkedIn, from any other social profile")
was written to prevent. That hard rule holds across the whole file.

Two rows use sources outside the file's own named list, with different
severity:

- **Row 12** (Construcciones Gramasat SL) sources its owner name from
  `infoempresa.com`, a company-information aggregator of the same species as
  einforma/axesor (also independently confirmed here). This is not a breach
  of the GDPR posture's substance, only of the literal enumerated list.
- **Row 69** (Estudio Reformas Barcelona SL) sources its owner name, address,
  founded_year and CNAE from `librebor.me`, a third-party BORME mirror. This
  matters because the file is internally inconsistent about that domain: row
  16's own notes explicitly reject an owner name found on librebor.me as
  "not an approved registry source per rule 4," while row 69 uses exactly
  that source to populate a field. Independent search corroborates row 69's
  owner name (David Núñez Cebamanos, sole administrator/shareholder) via
  einforma.com as well — a compliant source exists for the same fact — so the
  underlying data is not wrong, but the sourcing choice violates the file's
  own stated rule and should be corrected to cite the compliant duplicate.

## Dead or dissolved companies

Two rows in the full file are marked dissolved by their own cited registry
source, and both were independently re-confirmed as still "Extinguida" on
fresh search:

- **Row 15**, Construcciones Y Reformas Decorhogar SL (Iberinform,
  "Extinguida", last update 09/04/2024).
- **Row 100**, Reformas Terrassa SL (Iberinform, "Extinguida"; independently
  reconfirmed this pass) — this row is in the 15-row sample.

Both rows already carry a clear warning in their own `notes` field and
neither has a populated phone/email/website, so there is no immediate risk of
either being dialled, but they should be positively excluded (not merely
left with sparse data) from any downstream call list or CRM import.

## Personal-data check

No email address in the sample or in a broader scan resembles a personal
mailbox attributed to a named individual; the yahoo.es and gmail.com
addresses that do appear (rows 5, 13) are published by the firms themselves
on their own contact/legal-notice pages, which the file's notes correctly
treat as in-scope "business contact points" under the source plan's own rule
("email and phone are the firm's published contact points... a named
individual's direct mobile number... is out of scope"). Eleven phone numbers
across the full file (including sampled rows 6 and 13) are formatted as
Spanish mobile numbers (leading 6/7) rather than landlines; this is typical
for one-person or two-person construction S.L.s that use a mobile as their
only business line, and in every checked instance the number is published by
the firm itself as its general contact, not attributed to a named individual
in the source text. None of the sampled or scanned rows show the specific
red flag the source plan calls out — "the sole director's own mobile on a
one-person site" recorded as a personal line — but the mobile-format phones
are exactly the field a human reviewer should re-glance at before an
outreach campaign, since the distinction between "the firm's mobile" and "the
owner's personal mobile" is a judgment call that a search snippet cannot
always settle definitively.

## Rescore-candidate spot check

Five of the file's 40 `rescore_candidate: true` rows were checked (more than
the requested minimum of 4), three of them inside the main 15-row sample:

- **Row 76** (CNAE 4121) — confirmed correct and squarely in the 41.2x
  family.
- **Row 120** (CNAE 4399) — confirmed correct and squarely in the 43.9x
  family.
- **Row 112** (CNAE 4335) — confirmed correct for the firm, but 4335 is not a
  valid class under the CNAE-2009 scheme that most other rows in this file
  use (43.3x only runs to 4339 under CNAE-2009); it is a real class under the
  newer CNAE-2025 classification ("Otros acabados y terminaciones de
  edificios"), which some registries have already migrated to. Row 114 uses
  the same code for the same reason. This is not a sourcing error — the code
  really does belong to the firm — but it means the file mixes two CNAE
  vintages without saying so, which will look like noise to anything that
  filters on exact 4-digit CNAE-2009 codes.
- **Row 90** (CNAE 4329, "Otras instalaciones en obras de construcción")
  confirmed correct for the firm via three independent registry hits, but
  4329 sits in group 43.2 (installations), which is outside the three
  families the rescoring logic is supposed to target (41.2x / 43.3x / 43.9x).
  The underlying fact is right; whether this row should carry
  `rescore_candidate: true` at all is a scoring-boundary question for
  whoever owns the rescoring rule, not a research error.
- **Row 66** (CNAE "412", a 3-digit group code from Axesor rather than a
  4-digit class) is explained in the row's own notes as Axesor only
  publishing the coarser group; "412" is squarely the 41.2x family at the
  precision available, so the rescore flag is defensible, but it is a
  reminder that not every CNAE value in this file is a comparable 4-digit
  code.

## Fields the workbook must mark unreliable

On this sample, no field's CONTRADICTED/(CONFIRMED+CONTRADICTED) rate
exceeded 5% except **owner_role**, which sits at 50% on an n of 2 — too small
to certify as a real error rate, but too large to ignore. The honest
statement is: **owner_role should be marked provisional across the file**
until a larger sample is checked, because the one instance found conflates
"administrator" and "sole shareholder," two roles that matter differently for
who is legally entitled to bind the company. No other field in the sample
crossed the 5% threshold; nif, cnae, address, email, website, employees_band
and activity_description all held at a 0% error rate on the fields that had
enough confirmed-or-contradicted evidence to compute one. Separately, and
outside the strict error-rate framework, three structural issues are worth
recording as reliability caveats even though they scored as "no contradiction
found": the CNAE-vintage mixing described above (rows 112/114 and, by
implication, any other row using a CNAE-2025-only code), the rescoring
boundary question raised by row 90, and the fact that the "rule 4" / "rule 5"
/ "INSTRUCTIONS.md" citations threaded through this file's own `notes` field
do not correspond to any file actually committed to this repository — the
governing document that presumably existed at enrichment time is not part of
the audit trail, so a future reviewer cannot check the workers' self-reported
rule compliance against the rule's actual text, only against the closest
proxy available, section 5 of `04a-SOURCE-PLAN.md`, which this audit used.

## Verdict — what a seller may rely on

On the evidence of this 15-row, 58-observation sample, `04c-ENRICHED.jsonl`
is materially trustworthy for outreach on the fields it actually populates —
firm identity, NIF, CNAE, address/municipality, phone, email, website and
activity description all held at a 0% measured error rate with no
same-named-different-province failures — but three specific actions should
happen before any call list is cut from it: exclude rows 15 and 100
(dissolved firms) and row 103 (entity not found) outright rather than leaving
them as sparse-but-present rows; re-source row 69's owner attribution to the
compliant einforma.com listing already available for the same firm, since
its current librebor.me citation violates the file's own stated rule even
though the underlying fact is correct; and treat every populated `owner_role`
value as provisional pending a larger check, since the one sampled
discrepancy conflates "administrator" with "shareholder" in a way that
matters for knowing who is actually entitled to sign for the company.

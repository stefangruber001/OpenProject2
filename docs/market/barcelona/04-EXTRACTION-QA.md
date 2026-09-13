# 04 — Extraction QA (Phase 4c)

This report was produced on 2026-09-13 as Phase 4c of the Barcelona market roadmap. It audits `04-PROSPECTS.jsonl` (128 rows, reformas/construction SMEs in and around Barcelona) against the schema fixed in Phase 4b and against the GDPR/LOPDGDD posture fixed in `04a-SOURCE-PLAN.md`. The method follows the phase brief exactly: a 10% random sample was pulled, every non-null field in the sample was re-derived independently via web search rather than trusted at face value, and the resulting error rate by field decides what Phase 5 may use. A separate, purely mechanical pass covers the full 128 rows for schema conformance, null rates, duplicates, personal-data patterns and geographic distribution. Nothing in `04-PROSPECTS.jsonl` was altered to produce this report.

## Sample

Thirteen rows (10.2% of 128) were drawn with a seeded Mulberry32 shuffle (`seed=42`) over row indices 1–128, run via `node -e`, so the draw is reproducible. The sampled row numbers, in file order, are:

**12, 16, 37, 55, 67, 74, 75, 78, 83, 86, 101, 110, 117**

For each row, every non-null field was re-derived by searching the firm's legal name, its NIF where populated, and the domain of each cited `source_urls` entry, then comparing what independent search returned against the recorded value. Because this environment has no fetch access, verification could not open the exact cited URL and diff it; it relied on search-engine snippets and, where available, alternate registry mirrors (Infonif, Axesor, Iberinform, Empresite, DatosCif) carrying the same registry facts. That is a real limitation, noted throughout as UNSUPPORTED where search returned nothing usable, and it means the error rates below are a floor, not a ceiling — a value search could not reach might still be wrong.

## Field-by-field results

Only fields with at least one non-null value in the sample can be scored; the rest are marked NULL (not populated, not audited) or N/A (populated nowhere in the sample). CONFIRMED means independent search returned the same value; CONTRADICTED means search returned a different, specific value; UNSUPPORTED means search returned nothing that either confirms or contradicts.

| Row | legal_name                                                           | trade_name | nif       | cnae        | municipality                                                             | province                                  | founded_year | employees_band | website   | email     |
| --- | -------------------------------------------------------------------- | ---------- | --------- | ----------- | ------------------------------------------------------------------------ | ----------------------------------------- | ------------ | -------------- | --------- | --------- |
| 12  | CONFIRMED                                                            | CONFIRMED  | CONFIRMED | NULL        | **CONTRADICTED** (registry address is Barcelona city, not Castelldefels) | CONFIRMED                                 | NULL         | NULL           | NULL      | NULL      |
| 16  | CONFIRMED                                                            | CONFIRMED  | CONFIRMED | UNSUPPORTED | CONFIRMED                                                                | CONFIRMED                                 | NULL         | NULL           | CONFIRMED | CONFIRMED |
| 37  | CONFIRMED                                                            | CONFIRMED  | NULL      | NULL        | CONFIRMED                                                                | CONFIRMED                                 | NULL         | NULL           | NULL      | NULL      |
| 55  | UNSUPPORTED (no registered legal entity found, only a trading brand) | CONFIRMED  | NULL      | NULL        | CONFIRMED                                                                | CONFIRMED                                 | NULL         | NULL           | CONFIRMED | NULL      |
| 67  | CONFIRMED (entity exists)                                            | CONFIRMED  | NULL      | NULL        | **CONTRADICTED** (registered in Gondomar, Pontevedra)                    | **CONTRADICTED** (province is Pontevedra) | NULL         | NULL           | NULL      | NULL      |
| 74  | CONFIRMED (entity exists; not a construction firm — see note)        | CONFIRMED  | NULL      | NULL        | CONFIRMED                                                                | CONFIRMED                                 | NULL         | NULL           | NULL      | NULL      |
| 75  | CONFIRMED (entity exists; real-estate developer, not a contractor)   | CONFIRMED  | NULL      | NULL        | **CONTRADICTED** (registered in Badalona, not Barcelona)                 | CONFIRMED                                 | NULL         | NULL           | NULL      | NULL      |
| 78  | CONFIRMED                                                            | CONFIRMED  | CONFIRMED | NULL        | CONFIRMED                                                                | CONFIRMED                                 | NULL         | NULL           | NULL      | NULL      |
| 83  | CONFIRMED                                                            | CONFIRMED  | CONFIRMED | CONFIRMED   | CONFIRMED                                                                | CONFIRMED                                 | NULL         | NULL           | NULL      | NULL      |
| 86  | CONFIRMED                                                            | CONFIRMED  | NULL      | NULL        | CONFIRMED                                                                | CONFIRMED                                 | NULL         | NULL           | NULL      | NULL      |
| 101 | CONFIRMED                                                            | CONFIRMED  | NULL      | CONFIRMED   | CONFIRMED                                                                | CONFIRMED                                 | CONFIRMED    | NULL           | NULL      | NULL      |
| 110 | CONFIRMED                                                            | CONFIRMED  | NULL      | NULL        | **CONTRADICTED** (registered in Montcada i Reixac, not Granollers)       | CONFIRMED                                 | NULL         | NULL           | NULL      | NULL      |
| 117 | CONFIRMED                                                            | CONFIRMED  | CONFIRMED | CONFIRMED   | CONFIRMED                                                                | CONFIRMED                                 | NULL         | CONFIRMED      | NULL      | NULL      |

Notes that don't fit the grid:

- **Row 55 (MAYORCASA)** — the business itself is real (Houzz profile, own domain, physical address on Enric Granados), but no search result surfaced a full legal entity name, NIF, or registry filing. The row's `legal_name` field holds a trade name, not a verifiable registered legal name. This is a provenance gap, not a factual contradiction.
- **Row 67 (Coperfi)** — this is the sharpest finding in the sample. "Construcciones y Reformas Coperfi SL" is a real, registered company (NIF B36853505) — but it is headquartered in Gondomar, Pontevedra, on the opposite side of the country, with a phone number and email on a Galician area code. Its listing in a Barcelona-area reformas list, with `municipality` and `province` both overwritten to "Barcelona", cannot be a sourcing error at the field level; the wrong company was pulled into the list. This row should not just lose its municipality field — it should be excluded from the prospect list entirely pending re-verification, because nothing about it is a Barcelona prospect.
- **Rows 74 and 75** — both entities exist and both are real companies, but neither appears to be a reformas/construction contractor. Row 74 ("Binder Meridian SL") is registered for real-estate sales with a broad corporate purpose spanning restaurants, cafeterias and hotels; row 75 ("Group Arfil SL") is classified under CNAE 6812, real-estate development, and is physically in Badalona rather than Barcelona city as recorded. These are sector-adjacency misses, not fabrications, but they indicate the extraction net is pulling in some property/real-estate names alongside genuine building contractors.
- **Row 110 (Garle)** — NIF B64574742 is real and correctly attached to "Garle Reformas Integrales SL", but that company sits in Montcada i Reixac, not Granollers. A different, unrelated firm ("Reforma Integral Granollers SL", NIF B66032095) is the one actually based in Granollers — a plausible mechanism for how the municipality got swapped during extraction (name-similarity confusion between two differently located firms).

## Error rate by field

Error rate is defined, as instructed, as CONTRADICTED ÷ (CONFIRMED + CONTRADICTED); NULL and UNSUPPORTED values are excluded from the denominator and reported separately as their own share of the sample.

| Field                                                                                                                               | Confirmed                      | Contradicted | Unsupported | Null (not populated) | Error rate         | Unsupported share    |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------ | ----------- | -------------------- | ------------------ | -------------------- |
| legal_name                                                                                                                          | 12                             | 0            | 1           | 0                    | **0.0%**           | 7.7%                 |
| trade_name                                                                                                                          | 13                             | 0            | 0           | 0                    | **0.0%**           | 0.0%                 |
| nif                                                                                                                                 | 5                              | 0            | 0           | 8                    | **0.0%**           | 0.0% (of populated)  |
| cnae                                                                                                                                | 3                              | 0            | 1           | 9                    | **0.0%**           | 25.0% (of populated) |
| municipality                                                                                                                        | 9                              | 4            | 0           | 0                    | **30.8%**          | 0.0%                 |
| province                                                                                                                            | 12                             | 1            | 0           | 0                    | **7.7%**           | 0.0%                 |
| founded_year                                                                                                                        | 1                              | 0            | 0           | 12                   | 0.0% (n too small) | —                    |
| employees_band                                                                                                                      | 1                              | 0            | 0           | 12                   | 0.0% (n too small) | —                    |
| website                                                                                                                             | 2                              | 0            | 0           | 11                   | 0.0% (n too small) | —                    |
| email                                                                                                                               | 1                              | 0            | 0           | 12                   | 0.0% (n too small) | —                    |
| phone                                                                                                                               | 0                              | 0            | 0           | 13                   | not audited        | —                    |
| revenue_band_eur, revenue_year                                                                                                      | 0                              | 0            | 0           | 13                   | not audited        | —                    |
| directors[]                                                                                                                         | 0 populated (all empty arrays) | —            | —           | 13                   | not audited        | —                    |
| public_contracts_count, permits_last_24m, permit_value_total_eur, review_count, review_avg, review_recency_months, known_software[] | 0                              | 0            | 0           | 13                   | not audited        | —                    |

Two fields exceed the 5% threshold set by the phase brief: **municipality at 30.8%** and **province at 7.7%**. Municipality's error is broad-based — four independent rows (12, 67, 75, 110), each with a different underlying cause (registered-address mismatch, wrong-company inclusion, wrong-town-within-province, and name-similarity confusion) — which argues this is a real, structural problem with the field rather than one bad row. Province's single error (row 67) is driven entirely by the same wrong-company inclusion that also broke that row's municipality; on the other twelve rows province was correct even where municipality was wrong, because a firm in the wrong town within Barcelona province still carries the right province. Read plainly, one error in thirteen already clears 5%, so per the phase brief it is reported as exceeding threshold, but the underlying cause is a single row, not a systematic provincial mislabelling — worth re-testing on a second, larger sample before treating province as equally unreliable as municipality.

Every other field with at least one audited value came back at 0% error, but five of them (nif, cnae, founded_year, employees_band, website, email) have fewer than five CONFIRMED+CONTRADICTED observations in the sample. A 0% rate on one to five data points is not evidence of reliability; it is an absence of evidence either way, and is reported as such rather than rounded up to "safe."

## Fields excluded from scoring

Per the phase brief's rule — any field exceeding 5% error must be excluded from scoring, not silently used — the following fields **fail this audit and must be excluded from Phase 5 scoring**:

- **`municipality`** (30.8% error, four independent failure mechanisms) — cannot be trusted as an ICP geographic filter without row-by-row re-verification.
- **`province`** (7.7% error) — excluded by the same literal rule, though the finding rests on one row; recommend a second, independent sample of at least 20 rows to decide whether this is a real field-level problem or noise from a single bad record before Phase 6 relies on it even loosely.

No other field breaches 5%, so none of the remaining fields are excluded on error-rate grounds. However, several are excluded on a different, equally disqualifying ground — **insufficient audited signal** — and Phase 5 should treat them as unscored, not as "confirmed safe":

- `founded_year`, `employees_band`, `website`, `email`: 1–2 audited values each. Zero errors observed, but the sample is too small to support any claim of reliability.
- `phone`, `revenue_band_eur`, `revenue_year`, `directors[]`, `public_contracts_count`, `permits_last_24m`, `permit_value_total_eur`, `review_count`, `review_avg`, `review_recency_months`, `known_software[]`: zero audited values in the 13-row sample (`review_count` has exactly one populated value in the whole 128-row file, outside the sample — see Whole-file audit). No error rate can be computed for these at all.

`legal_name`, `trade_name`, `nif` and `cnae` cleared the bar with 0% error on their audited values (5 for nif, 3–4 for cnae) and are the closest this list has to a load-bearing core, but nif and cnae in particular should be treated as provisionally reliable rather than proven, given how thin the sample is.

## Whole-file audit

A mechanical pass (node script, no search) over all 128 rows found:

**Schema conformance.** All 128 rows parse as valid JSON, and all 128 carry exactly the 22 keys from the Phase 4b schema in the exact specified order. Zero schema violations.

**Null rates per field** (128 rows; an empty array counts as not-populated):

| Field                  | Populated | Null / empty | Null rate |
| ---------------------- | --------- | ------------ | --------- |
| legal_name             | 128       | 0            | 0.0%      |
| trade_name             | 128       | 0            | 0.0%      |
| nif                    | 46        | 82           | 64.1%     |
| cnae                   | 46        | 82           | 64.1%     |
| municipality           | 128       | 0            | 0.0%      |
| province               | 128       | 0            | 0.0%      |
| founded_year           | 10        | 118          | 92.2%     |
| employees_band         | 19        | 109          | 85.2%     |
| revenue_band_eur       | 4         | 124          | 96.9%     |
| revenue_year           | 7         | 121          | 94.5%     |
| directors[]            | 0         | 128          | 100.0%    |
| website                | 13        | 115          | 89.8%     |
| email                  | 4         | 124          | 96.9%     |
| phone                  | 15        | 113          | 88.3%     |
| public_contracts_count | 0         | 128          | 100.0%    |
| permits_last_24m       | 0         | 128          | 100.0%    |
| permit_value_total_eur | 0         | 128          | 100.0%    |
| review_count           | 1         | 127          | 99.2%     |
| review_avg             | 0         | 128          | 100.0%    |
| review_recency_months  | 0         | 128          | 100.0%    |
| known_software[]       | 0         | 128          | 100.0%    |
| source_urls[]          | 128       | 0            | 0.0%      |

Six of the twenty-two fields (`directors`, `public_contracts_count`, `permits_last_24m`, `permit_value_total_eur`, `review_avg`, `review_recency_months`, `known_software`) are effectively unused across the entire file — this is a coverage problem for Phase 5, independent of the accuracy problem the sample audit found, and it means several inputs the scoring rubric may expect (e.g. permit activity, review volume) simply are not there for almost any row.

**Duplicates.** Zero duplicate `legal_name` values (128 distinct) and zero duplicate `nif` values among the 46 populated (46 distinct). No row shares an identity with another.

**NIF format.** All 46 populated NIFs match the expected CIF shape (one letter, followed by eight characters covering the seven-digit body plus one control character, i.e. nine characters total) under a structural regex check. None are malformed by length or character class. This is a format check only, not a checksum validation of the control character, and it does not catch a well-formed NIF attributed to the wrong company — that class of error can only be caught by the search-based sample audit above, which found none among the five NIFs it tested.

**Personal data in email/phone.** Of the 4 populated emails, 2 use free consumer webmail domains rather than a firm domain: row 39 (`barcelonareformas@yahoo.es`) and row 47 (`grupotecnico82@gmail.com`). Both are attached to small firms (`A Barcelona Reformas SL`, `Reformas Barcelona Grupo Técnico SL`) with 1–9 employees or unstated headcount; a webmail address published as a firm's own registry contact is common practice for one- and two-person outfits in this sector and is not per se the "plainly personal mailbox" the GDPR posture rules out, but it cannot be positively distinguished from one either, and both rows should get a manual look before Phase 9 outreach rather than an automatic pass. A third email, row 114 (`935702566`), is not an email address at all — it is the same nine-digit string recorded in that row's own `phone` field, duplicated into the wrong field during extraction. That is a mechanical data-quality defect, not a personal-data issue, but it means one of the four populated emails (25%) is simply wrong in kind, which is a second, independent reason `email` cannot be trusted at face value even though it wasn't hit by the search-based sample. Of the 15 populated phone numbers, 14 are landline-shaped (fixed area codes, mostly Barcelona's 93 prefix) and one, row 70 (`+34-690-757075`), is mobile-shaped (leading 6). Row 70 has no NIF, no email and no other identifying field, so it is not possible to confirm whether this is a firm switchboard forwarded to a mobile or an individual's personal number recorded in place of a firm line; per the GDPR posture's own instruction ("where the only published contact point is plainly personal... 4b sets the field to null"), this one row should be reviewed and very possibly nulled before it reaches an outreach list.

**`directors[]`.** Populated in 0 of 128 rows. The posture document permits registry-sourced director names; 4b simply never populated the field. That is the safe failure direction for GDPR purposes — no name has been pulled from a non-registry source — but it also means the field carries zero information for Phase 5 and cannot support any officer-based signal.

**Municipality distribution** (128 rows, 24 distinct municipalities):

| Municipality              | Rows | Municipality             | Rows |
| ------------------------- | ---- | ------------------------ | ---- |
| Barcelona                 | 47   | Sant Cugat del Vallès    | 2    |
| Granollers                | 10   | Montcada i Reixac        | 2    |
| Sabadell                  | 8    | Santa Coloma de Gramenet | 2    |
| Castelldefels             | 7    | Sant Joan Despí          | 1    |
| Cornellà de Llobregat     | 6    | Sant Feliu de Llobregat  | 1    |
| Badalona                  | 6    | Vilassar de Dalt         | 1    |
| Terrassa                  | 6    | El Masnou                | 1    |
| Gavà                      | 5    | Vic                      | 1    |
| Mollet del Vallès         | 5    | Manresa                  | 1    |
| Rubí                      | 4    |                          |      |
| L'Hospitalet de Llobregat | 3    |                          |      |
| Mataró                    | 3    |                          |      |
| Viladecans                | 2    |                          |      |
| Esplugues de Llobregat    | 2    |                          |      |
| Molins de Rei             | 2    |                          |      |

Barcelona city accounts for 36.7% of the file; the remainder is spread across the metro ring and a long tail of single-firm outliers (Vic, Manresa) that sit outside the Baix Llobregat/Vallès/Maresme core the source plan targeted. Given the 30.8% municipality error rate found in the sample, this distribution table should be read as an approximate, not exact, geographic footprint until the field is re-verified.

**Source domains.** 88 of the 128 rows cite `einforma.com`, with `empresite.eleconomista.es` (16), `axesor.es` (12) and `infonif.economia3.com` (7) as the next most common — consistent with the sourcing plan's registry-mirror strategy. A long tail of firm-owned domains, Houzz and Instagram profiles, and one review-aggregation site (`ranking-empresas.eleconomista.es`, 6) round out the remainder. No row cites a source outside the domains named or implied by the 4a source plan.

## GDPR posture check

`04a-SOURCE-PLAN.md` §5 sets four hard constraints on the extraction: `directors[]` only from public-registry sources, no personal emails or mobile numbers, legitimate-interest basis under GDPR art. 6.1.f and LOPDGDD art. 19, and a defined retention/objection mechanism. This audit checked what it can mechanically and through the sample:

- **Directors.** Compliant by omission — 0 of 128 rows populate `directors[]`, so there is no way the field could have breached the registry-only sourcing rule. The cost, noted above, is that the field is entirely unusable for Phase 5, not that it is unsafe.
- **Personal emails/mobiles.** Not clearly compliant. Two webmail addresses (rows 39, 47) and one mobile-shaped phone (row 70) fall into the grey zone the posture document itself anticipates — plausibly a firm's own published contact, plausibly an individual's personal one — and the posture's own instruction is to null the field when it is "plainly personal." None of these three were nulled. This is a posture-adherence finding for Phase 4b to act on, not a scoring-accuracy finding; it does not appear as an error in the field-by-field table because it was not tested by search against a different value, it is a rule-conformance question.
- **Company-level scope.** The overwhelming majority of the schema (legal name, NIF, CNAE, municipality, employee/revenue bands, contract/permit/review counts) is company data outside the material scope of GDPR, consistent with the posture's framing; the audit did not find any field being used to build an inferential profile of a named individual.
- **Retention and objection mechanics** (the `privacitat@` mailbox, the four retention clocks, the art. 30 register entry) are Phase 9 operational commitments, not properties of the JSONL file, and are outside what a file-level QA pass can verify; they are noted here only to record that this audit did not (and could not) check them.

## Verdict for Phase 5

Phase 5 scoring **may rely on**: `legal_name`, `trade_name` (0% error, fully populated, used only as identifiers, not scoring inputs in themselves) and, with the caveat that the audited sample is thin, `nif` and `cnae` (0% error each, but only 5 and 3–4 audited values respectively — treat as provisionally usable, and re-verify against a larger sample before any scoring weight is placed on CNAE-based sector filtering).

Phase 5 **must treat as unknown / must not use**:

- `municipality` — 30.8% sample error, four independent failure causes; do not use for geographic tiering or radius scoring without a full re-verification pass, and pull row 67 (Coperfi) out of the candidate pool entirely pending confirmation it belongs in a Barcelona list at all.
- `province` — 7.7% sample error; technically excluded by the 5% rule, though the finding is currently a single row. Re-test with ≥20 rows before deciding whether it needs the same treatment as municipality or can be reinstated.
- `founded_year`, `employees_band`, `website`, `email`, `phone` — too few audited values (0–2 each) to certify; usable only as soft, unweighted context a human reviewer glances at, never as a scored input, until a larger audit exists. `email` carries the additional, independently-found defect that one of its four populated values is a phone number rather than an address.
- `revenue_band_eur`, `revenue_year`, `directors[]`, `public_contracts_count`, `permits_last_24m`, `permit_value_total_eur`, `review_count`, `review_avg`, `review_recency_months`, `known_software[]` — effectively unpopulated across the whole file (0–1 of 128 rows); there is nothing here for Phase 5 to score even before reliability is considered.

Net effect: of the 22 schema fields, exactly four (`legal_name`, `trade_name`, `nif`, `cnae`) leave this audit in a state Phase 5 can build on, and two of those four rest on fewer than five verified data points. Every geographic field failed its error-rate test outright. Phase 5's scoring rubric should be designed around firm identity and sector code as the only load-bearing inputs from this extraction, with everything else — including location — held for a second extraction/QA cycle before it carries any weight, and row 67 should be dropped from the pool rather than merely down-weighted.

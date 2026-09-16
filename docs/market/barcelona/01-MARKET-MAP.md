# 01 — MARKET MAP: DEFINITION AND SIZING, BARCELONA REGION

This document is Phase 1 of the Barcelona market roadmap (`docs/market/barcelona/ROADMAP.md`). It defines the market that the ERP factory actually serves — by job-to-be-done rather than by product category — segments it against the Spanish CNAE classification, sizes it for the province of Barcelona and for Catalonia by employee band, names the employee-and-revenue band where the pain is acute enough to pay and the organisation simple enough to deploy into, and ranks the adjacent niches by how much of the reference case survives the move. It is written on **2026-09-12** and reads `00-REFERENCE-CASE.md` as its brief: Part A's strict separation of what generalises from what is bespoke, and Part C's statement of what a second customer is actually buying. Every external figure in it was gathered by web research on that same date, 2026-09-12, and carries its source, its table or publication name where one exists, its URL and its reference year; **the figures should be re-checked against the primary tables before this document is shown to anyone outside the team**, for a reason set out immediately below that materially affects how much weight each number can carry.

---

## 0. Provenance, and one constraint that shapes every number here

The research environment for this phase had outbound document retrieval restricted by network policy. Direct retrieval of `ine.es`, `idescat.cat`, `datos.gob.es`, `observatoriodelaconstruccion.com`, `diba.cat` and several secondary press domains was refused at the egress layer, and the INE statistical API (`servicios.ine.es`) was likewise refused. Search retrieval against those same domains worked. Consequently:

- Every figure below was obtained by **search-engine extraction against the named source page**, not by reading the source table directly. The source, table name, URL and year are given so that each figure can be re-derived in ten minutes by anyone with unrestricted access.
- Where a figure is the product of arithmetic on other figures, it is labelled **ESTIMATE** and the method is shown inline. No estimate is presented as a sourced figure.
- Where a figure was sought and not obtained, the text says **not found**. Section 6 lists every one of them in a single place, so the gaps are a work item rather than a silence.
- The most consequential gap is that **no source was retrieved giving construction enterprise counts for the province of Barcelona at three-digit CNAE and by employee band**. INE table 301 (`Locales por provincia, actividad principal (divisiones CNAE 2009) y estrato de asalariados`) holds exactly this at division level and is the first thing to read when access allows. Until then, every Barcelona-province count in Section 3 is an apportionment of a sourced Catalan figure, labelled as such, with the apportionment base stated and a range given rather than a single number.

A second constraint is classificatory rather than technical. **CNAE-2025 is now in force and has re-cut the construction codes.** Promoción inmobiliaria, CNAE-2009 41.10, maps one-to-one to CNAE-2025 68.12, which moves property development out of construction and into real estate; and the Observatorio Industrial de la Construcción warns that from January 2026 its year-on-year variations are not strictly comparable for this reason. The roadmap's Phase 1 brief names the CNAE-2009 codes, and this document works in CNAE-2009 because that is the vintage in which the sourced stock figures (DIRCE at 1 January 2025) are published — but **any list built in Phase 4 will be pulled from registries that have already migrated, and the crosswalk has to be held explicitly or the segments will silently change shape.**

---

## 1. MARKET DEFINITION

### 1.1 The job, stated as the customer would state it

Part C of the reference case is explicit that a second customer is not buying an ERP. Restated as a job-to-be-done, the market is:

> **"Let me know, while a job is still running, whether I am making money on it — and let the paperwork that proves it to my customer, my subcontractors, my crew and my accountant come out of the same record, in the language each of them reads, without anyone typing it twice."**

Three clauses in that sentence carry all the weight, and each maps to a capability cluster the reference case already paid for.

_"While a job is still running"_ is the immutable-baseline claim. The accepted quote becomes the project baseline; change orders move the current budget and leave the baseline queryable; executed-minus-billed drives the progress valuation. The job being bought is not reporting — it is the **non-editability of the number you are judged against**. Firms that can answer the margin question only at year-end, from the accountant, are the market. Firms that already have a controller producing weekly job-cost variance are not.

_"The same record"_ is the single-truth claim, and it is the one with an enemy. The incumbent is not a competing product; the reference case says so plainly in Part B.4 — paper quotations, spreadsheets, supplier prices spread across portals and past invoices, and a gestoría at the end of it. The eight pain points the customer's own requirements document listed (data captured more than once; information split across files, portals and personal knowledge; no controlled view of latest price and prior purchase evidence; inability to prove what was accepted; budget and real cost not reconciled by item; dependence on one owner for operations and the other for administration; no single view of collections and commitments; no consolidated multi-company view) are eight descriptions of the same absence. That absence is the market.

_"In the language each of them reads"_ is the trilingual-document claim, and it is the edge of the market that is specifically regional. Part C is candid that translation is cheap and that the expensive thing is keeping the same document correct in three languages across four frozen legal states and two file formats, enforced by a build that fails otherwise. A market that needs only Spanish does not value that; a Catalan-first owner-manager whose customer signs in Catalan and whose accountant files in Spanish does.

### 1.2 What is IN

1. **Project-based trades where the quote is the contract.** A firm that wins work by issuing a structured, chaptered, priced document which the customer accepts in whole or in part, and then executes against it. This is the spine of the reference case and the thing a competitor cannot retrofit.
2. **Firms whose margin is decided at purchase time, not at sale time.** The comparison sheet — roughly 245 rows and 18 columns comparing four named cost alternatives against an initial study — is the object the customer's margin actually depends on. The market is firms that do this work by hand today, and know they do.
3. **Firms inside the Spanish tax and Catalan language perimeter.** The jurisdiction pack is Spain; the document layer is Spanish, Catalan and English. Everything about the effective-dated, self-justifying tax decision is an asset inside that perimeter and dead weight outside it.
4. **Firms that subcontract, and therefore carry a document-expiry burden.** Supplier and subcontractor document expiry is classed in Part A as a universal mechanism whose _importance_ is construction-specific. A firm with no subcontractors is buying a feature it will not open.
5. **Firms with a real split between an operational decision-maker and an administrative one.** The two-owner permission split — operations must not be forced to complete back-office fields on site, back office must be able to complete and correct operational entries — is encoded literally in the tenant configuration. Below the headcount at which those two roles exist as distinct people, the product's central design decision has no one to serve.
6. **Firms whose crews are on site and whose owner reads on a phone.** A striking share of the defects in the build log were found by using the product on a phone, and the crew-facing surface has no money figures in it at all because they are removed server-side. The market is mobile-crew work, not desk work.

### 1.3 What is OUT, and why the edge is where it is

1. **Property developers (CNAE-2009 41.1, CNAE-2025 68.12) are out**, notwithstanding that the roadmap brief asks them to be assessed. A developer's unit of account is a scheme with land, financing, sales and a long capitalisation period; the quote-to-acceptance spine does not exist, because a developer does not quote — it appoints. The part of the reference case that survives is the payer-attribution work and the invoicing chain, which is real but is perhaps a fifth of the asset. **Defending this edge:** developers are numerous and visibly well-capitalised, which makes them tempting; but selling into them means building a capability that does not exist (scheme-level capitalisation and sales pipeline), which is L4 work by Phase 2's layer model, for a segment whose buying process is a committee. Out, and Phase 5 should place any developer in Tier C at best.
2. **Civil engineering and public-works contractors (CNAE-2009 42) are out at this stage.** Public tendering brings a different document universe — tender files, public-sector invoicing, classification registers — and a filing regime the jurisdiction pack does not hold. That is L3-plus-L4. Out, but out _provisionally_: it is the single largest named unlock in the adjacency map and the natural Tier C investment case.
3. **Pure service and maintenance businesses are out**, even where their CNAE sits inside construction. A firm whose revenue is a recurring maintenance contract with an SLA and a ticket queue needs a contract-and-work-order spine, not a quote-and-baseline spine. The reference case has no recurring-contract object and no SLA clock. **Defending this edge:** this is the most commonly blurred boundary, because installers (43.2) frequently do both project work and maintenance rounds, and a prospect will describe itself as the former while earning from the latter. Phase 2's qualification must test it with a question about revenue mix, not about activity description.
4. **Firms outside the Spanish tax perimeter are out.** Not because the architecture forbids it — a new jurisdiction pack is exactly the designed extension point — but because the reference case's accumulated fit is Spanish, and Part C's hardest-won asset is the _separation_ that makes a second jurisdiction cheap later. Selling a second jurisdiction before the second Spanish tenant converts an asset into a project.
5. **Sole traders and firms with no employees are out.** This is the lower edge, argued at length in Section 4. Briefly: no back-office role, no subcontractor compliance load, no payroll-hours problem, and willingness to pay below the floor at which onboarding can be served.
6. **Firms above roughly fifty employees are out of the near-term market**, argued as the upper edge in Section 4. Briefly: SII filing obligations, public tendering, a finance function with an incumbent system and an integration list, and a committee purchase.

A fair objection to this definition is that it is drawn to fit the asset, which is precisely the criticism Phase 11 will make. The honest answer is that drawing the market to fit the asset is correct when the asset is real and the alternative is to widen the definition until every prospect requires a new pack. The discipline is that the definition must be **falsifiable**, and it is: if Tier A prospects selected on it turn out to need L2 or worse, the definition was wrong, not the prospects.

---

## 2. SEGMENTATION BY CNAE

The brief asks for a working-through of the relevant CNAE-2009 codes with a fit assessment against the reference case. Counts are given where a source was retrieved and marked **not found** where not. Two count columns appear, and they do not agree; Section 2.2 says which to trust.

| CNAE-2009 | Activity                                                                                                      | Spain, DIRCE active enterprises, 1 Jan 2025 | Spain, directory count (eInforma, balance yr 2024) | Fit against the reference case                                                                                                                                                                                                                                                                                                                                           | Layer implied                           |
| --------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| 41.1      | Promoción inmobiliaria                                                                                        | not found                                   | not found                                          | **Poor.** No quote-to-acceptance spine. Payer attribution and invoice chain survive; the baseline, valuation and comparison-sheet assets do not. Moved to 68.12 under CNAE-2025.                                                                                                                                                                                         | L4                                      |
| 41.2      | Construcción de edificios                                                                                     | not found (group level)                     | 194,187                                            | **Strong, with a caveat.** The reference case is a reformas contractor that sits in 41.2 or 43.x depending on registration habit. New-build housing contractors fit the baseline and valuation spine exactly; the 18-chapter taxonomy is renovation-shaped and would need a different default set, which is pack _data_, not code.                                       | L0 (reformas) / L1 (new build chapters) |
| 43.1      | Demolición y preparación de terrenos                                                                          | not found                                   | 3,004 (43.11) + 13,186 (43.12)                     | **Moderate.** Measurement-heavy, quote-and-valuation shaped, frequently a subcontractor rather than a main contractor — which inverts the document-expiry flow (they supply documents rather than collect them). Catalogue and comparison sheet less central.                                                                                                            | L0–L1                                   |
| 43.2      | Instalaciones (43.21 eléctricas, 43.22 fontanería/climatización, 43.29 otras)                                 | **78,775** (group 432)                      | 47,115 (43.21) + 32,390 (43.22)                    | **Strong for project installers, poor for service-led installers.** Largest single retrievable segment and the one nearest the reference case in operating shape: chaptered quotes, material comparison, site crews, subcontracted specialities. The split inside it is the revenue-mix question in §1.3(3). Also carries its own certification and registration burden. | L0 (project) / L2 (service)             |
| 43.3      | Acabado de edificios (43.31 revocamiento, 43.32 carpintería, 43.33 revestimiento, 43.34 pintura, 43.39 otros) | not found                                   | 14,009 (group 433 — **inconsistent, see §2.2**)    | **Strongest fit of all.** This is the reference case's own trade family. Chapters, measurements, options kept out of the base total, photographic annex, selective acceptance, optional works — all of it was built for exactly this work. Employs 12.4% of sector personnel nationally.                                                                                 | L0                                      |
| 43.9      | Otras actividades de construcción especializada                                                               | not found                                   | 52,524                                             | **Moderate to strong, but heterogeneous.** Contains roofing, structural work, scaffolding and the restoration trades. A restoration contractor is an excellent fit; a scaffolding hire business is not a fit at all, because it is an asset-rental business wearing a construction CNAE. Must be sub-qualified by hand.                                                  | L0–L2                                   |

Supporting distribution facts, all from INE's first edition of the _Estadística Estructural de Empresas: Sector Construcción_, reference year 2024, which replaced the Ministerio de Transportes' EEIC survey: sector turnover **€205,204 million**; value added **€66,024 million**; **95% of construction enterprises had fewer than ten employees**, and those firms employed **44.9%** of sector personnel; **5% of enterprises accounted for 62% of turnover**; employment by activity was **building construction 35.2%, electrical and plumbing installations 26.8%, building finishing 12.4%**; and turnover by autonomous community put **Madrid at 25.0%, Catalonia at 16.3% and Andalusia at 13.5%**.

### 2.1 Reading the fit assessment against Part A

The fit column above is not an opinion about how construction-like each code is. It is an assessment of how much of the seventeen universal mechanisms Part A identified can be bound without new pack or capability work. Three codes score well because all of the following hold simultaneously: the firm issues a structured priced document the customer accepts; the firm buys materials from several suppliers and its margin depends on which it chooses; the firm subcontracts and therefore must hold other firms' documents and watch them expire; the firm has crews on sites and a split between who decides work and who raises invoices; and the firm bills in instalments or against executed progress rather than once on completion. Where any one of those is absent, the layer column rises, because something has to be built.

### 2.2 Where the two count columns disagree, and which to trust

**Trust DIRCE.** The INE Directorio Central de Empresas counts _economically active_ units at a reference date (1 January 2025) under a published methodology, and it is the source both Idescat and the Ministerio use. Its construction total for Spain is **389,146 enterprises, 11.8% of the 3,310,824 active enterprises** in the country.

The eInforma column is a **register-derived directory count** and is shown only as an order-of-magnitude cross-check, because two of its values cannot both be right. Its group 432 components (43.21 at 47,115 plus 43.22 at 32,390 equals 79,505) land within 1% of DIRCE's sourced 78,775 for the same group, which is reassuring. But its 41.2 value of 194,187 would make building construction exactly half of all Spanish construction enterprises, and its group 433 value of 14,009 is smaller than plausible for a family that employs 12.4% of the sector — which is the larger of the two errors and the one to ignore outright. The likely explanation is that the directory mixes scopes (some pages count a group, some a class, some only firms with filed accounts). **Conclusion: use eInforma and similar directories in Phase 4 for names, addresses and officers — which is what they are good at — and never for segment sizing.**

A third source measures a different population and is useful precisely because of it. The Observatorio Industrial de la Construcción (Fundación Laboral de la Construcción), drawing on Ministerio de Trabajo records, counts construction firms **with at least one employee**: **145,189 in November 2025, up 2.2% year on year**, of which **2,059 firms in the 50–249 band (up 5.4%)** and **179 firms at 250 or more (up 4.7%)**. Because DIRCE counts firms with and without employees and this counts only the former, the two together give the zero-employee share directly, which is how Section 3 is built.

---

## 3. TAM / SAM / SOM — SIZING BY EMPLOYEE BAND

### 3.1 The three definitions used, stated before any number

- **TAM** — every construction-sector enterprise with at least one employee in the geography, regardless of sub-trade or size, valued at a plausible annual software-and-service spend. This is the outer boundary of "could conceivably run on a project-based ERP".
- **SAM** — enterprises inside the CNAE groups judged a strong or moderate fit in Section 2 (41.2, 43.1, 43.3, 43.9, and the project-led share of 43.2), with **3 to 49 employees**, inside the Spanish tax perimeter. This is the set the existing asset can serve at L0 or L1, which is the only set whose unit economics work before Phase 7 says otherwise.
- **SOM** — the share of SAM winnable in thirty-six months, bounded by delivery capacity rather than by demand, because the reference case's own ledger (Part C.4) records that the fifteen-minute onboarding claim has never been run against a real intake.

### 3.2 Sourced anchors

| Figure                                                        | Value                                                                                                | Source, table, year                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Active enterprises, Spain                                     | 3,310,824 (+1.7%)                                                                                    | INE, DIRCE press note, 1 Jan 2025                                      |
| Construction enterprises, Spain                               | 389,146 (11.8% of total)                                                                             | INE, DIRCE, 1 Jan 2025                                                 |
| Enterprises with no employees, Spain                          | ~1.80 million (54.4%)                                                                                | INE, DIRCE, 1 Jan 2025                                                 |
| Enterprises with 1–2 employees, Spain                         | 901,955 (27.2%); ≤2 employees = 81.6%                                                                | INE, DIRCE, 1 Jan 2025                                                 |
| Enterprises, Catalonia (registered office)                    | 610,062                                                                                              | Idescat, _Empreses i establiments_, from INE DIRCE, 1 Jan 2025         |
| Catalonia share of Spanish enterprises                        | 18.4%, highest of any autonomous community                                                           | INE, DIRCE, 1 Jan 2025                                                 |
| Construction enterprises, Catalonia                           | 68,134 (11.2% of Catalan total; 17.8% of Spain's construction firms per source, 17.5% by arithmetic) | Idescat / gencat _Nombre i dimensió_, from DIRCE, 1 Jan 2025           |
| Size distribution, all sectors, Catalonia                     | 56.0% no employees; 39.0% 1–9; 4.1% 10–49; 0.9% over 49                                              | gencat _Nombre i dimensió_, from DIRCE, 1 Jan 2025                     |
| Construction enterprises in CNAE group 432, Spain / Catalonia | 78,775 / 14,357                                                                                      | INE DIRCE 2025, via sector aggregation                                 |
| Construction firms with employees, Spain                      | 145,189 (Nov 2025)                                                                                   | Observatorio Industrial de la Construcción, from Ministerio de Trabajo |
| Of which 50–249 / 250+                                        | 2,059 / 179                                                                                          | same, Nov 2025                                                         |
| Construction firms with employees, Catalonia                  | 24,260 (February; year not pinned in the retrieved text) and 23,843 (2021)                           | Observatorio Industrial de la Construcción                             |
| Share of construction firms under 10 employees, Spain         | 95%, employing 44.9% of personnel                                                                    | INE, EEE Sector Construcción, 2024                                     |
| Barcelona province population                                 | 5,877,672                                                                                            | INE census, 2024                                                       |

### 3.3 Deriving the employee bands for construction (method shown)

DIRCE publishes the size distribution for all sectors, not for construction alone at the granularity needed, so the construction bands below are built from four sourced numbers and one sourced ratio.

1. Construction firms with employees, Spain = **145,189** (sourced). Construction firms in total = **389,146** (sourced). Therefore firms with no employees = 389,146 − 145,189 = **243,957, or 62.7%** — materially more zero-employee than the 54.4% all-sector figure, which is what one would expect of a trade with heavy self-employment. _Note the date mismatch: the numerator is November 2025 and the denominator 1 January 2025. ESTIMATE, and the error is small relative to the conclusion._
2. 50–249 band = **2,059**; 250+ = **179** (both sourced).
3. EEE 2024 states **95%** of construction firms have fewer than ten employees. Applying that to 389,146 gives 369,689 firms under ten, so firms with ten or more = **19,457**. Subtracting the two sourced upper bands leaves the 10–49 band = 19,457 − 2,059 − 179 = **17,219. ESTIMATE.**
4. The 1–9 band is then 145,189 − 17,219 − 2,059 − 179 = **125,732. ESTIMATE.**
5. Catalonia is apportioned at its sourced **17.51%** share of Spanish construction firms (68,134 ÷ 389,146). **ESTIMATE.** Direction of likely error: Catalonia holds 17.5% of the firms but 16.3% of national turnover, so Catalan construction firms are on average slightly _smaller_ by revenue than the national mean, and a flat apportionment therefore very slightly over-counts the upper bands.
6. Barcelona province is apportioned from Catalonia across a **range**, because no provincial construction count was retrieved. The lower bound of 73% is the province's demographic weight (5,877,672 of a Catalan population of approximately 8.0 million); the upper bound of 80% is the province's sourced share of new company formation in Catalonia in 2025 (12,023 of 14,966 across the four provinces, or 80.3%). The central case takes 76%. **ESTIMATE throughout, and the single weakest number in this document.**

**Cross-check that matters.** The derivation gives Catalonia 22,016 + 3,015 + 361 + 31 = **25,423 construction firms with employees**. The Observatorio reports **24,260** for Catalonia on a different date. The derivation is 4.8% high against an independent source built from different records — close enough to use, and the discrepancy is in the expected direction given point 5. This cross-check is the main reason to trust the band table at all.

### 3.4 Construction enterprises by employee band — **Catalonia**

| Employee band                         | Enterprises | Basis                                       |
| ------------------------------------- | ----------- | ------------------------------------------- |
| 0 (no employees)                      | 42,717      | ESTIMATE — 17.51% of 243,957                |
| 1–9                                   | 22,016      | ESTIMATE — 17.51% of 125,732                |
| 10–49                                 | 3,015       | ESTIMATE — 17.51% of 17,219                 |
| 50–249                                | 361         | ESTIMATE — 17.51% of 2,059                  |
| 250+                                  | 31          | ESTIMATE — 17.51% of 179                    |
| **Total**                             | **68,134**  | **Sourced** — Idescat / DIRCE, 1 Jan 2025   |
| _of which with at least one employee_ | _25,423_    | _ESTIMATE; independent source gives 24,260_ |

### 3.5 Construction enterprises by employee band — **province of Barcelona**

| Employee band                         | Low (73%)  | Central (76%) | High (80%) | Basis                                               |
| ------------------------------------- | ---------- | ------------- | ---------- | --------------------------------------------------- |
| 0 (no employees)                      | 31,183     | 32,465        | 34,174     | ESTIMATE                                            |
| 1–9                                   | 16,072     | 16,732        | 17,613     | ESTIMATE                                            |
| 10–49                                 | 2,201      | 2,291         | 2,412      | ESTIMATE                                            |
| 50–249                                | 264        | 274           | 289        | ESTIMATE                                            |
| 250+                                  | 23         | 24            | 25         | ESTIMATE                                            |
| **Total construction enterprises**    | **49,738** | **51,786**    | **54,507** | ESTIMATE — apportioned from a sourced Catalan total |
| _of which with at least one employee_ | _18,559_   | _19,321_      | _20,339_   | _ESTIMATE_                                          |

### 3.6 Annual-value assumptions, stated so they can be attacked

No price has been set; Phase 6 sets it. For sizing only, the following per-tenant annual recurring values are used, anchored on the one public number that tells us what a Spanish SME of each size has recently been given permission to spend on software: the **Kit Digital** grant ceilings — Segment I (10–49 employees) up to **€12,000**, Segment II (3–9) **€6,000**, Segment III (under 3) **€3,000**, Segment IV (50–99) **€25,000**, Segment V (100–249) **€29,000**.

| Band                        | Assumed annual recurring value | Reasoning                                                           |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| 1–9 (whole band)            | €2,400                         | Band is dominated by 1–2 employee firms; below Segment II's ceiling |
| 3–9 (sweet-spot lower half) | €3,600                         | Has payroll and subcontractors; comfortably inside Segment II       |
| 10–49                       | €6,000                         | Half of Segment I's ceiling, so the grant covers year one with room |
| 50–249                      | €18,000                        | Below Segment IV's ceiling; assumes integration work                |
| 250+                        | €40,000                        | Out of scope; included only for completeness                        |

### 3.7 TAM

**TAM, province of Barcelona.** 19,321 construction enterprises with at least one employee (central case, ESTIMATE). Annual value: 16,732 × €2,400 + 2,291 × €6,000 + 274 × €18,000 + 24 × €40,000 = **€59.8 million per year. ESTIMATE.**

**TAM, Catalonia.** 25,423 construction enterprises with at least one employee (ESTIMATE; sourced cross-check 24,260). Annual value: 22,016 × €2,400 + 3,015 × €6,000 + 361 × €18,000 + 31 × €40,000 = **€78.8 million per year. ESTIMATE.**

For scale, Catalonia's construction sector employed **236,500 people in 2024, 6.2% of Catalan employment**, and contributed **4.8% of Catalan gross value added**; counting promotion alongside construction, one Catalan estimate puts the combined sector at **400,000 jobs and 7% of GDP**. Applying Catalonia's sourced **16.3%** share of the €205,204 million national construction turnover gives Catalan sector turnover of approximately **€33,450 million** (ESTIMATE by apportionment). The Catalan TAM above is therefore about **0.24% of sector turnover**, which is a credible software-and-service share for this kind of firm and is a useful sanity check on the value assumptions rather than on the counts.

### 3.8 SAM

SAM restricts TAM three ways: to the 3–49 employee range, to the CNAE groups judged strong or moderate, and to firms whose revenue is project work rather than recurring service.

1. **Split the 1–9 band at three employees.** DIRCE reports nationally that 54.4% of all enterprises have no employees and 27.2% have one or two, so firms with one or two employees are 27.2 ÷ (100 − 54.4) = **59.6%** of all firms that have any employees. Applying that proportion inside construction's 1–9 band — **ESTIMATE**, and slightly conservative since construction skews smaller than the all-sector average — leaves 40.4% of the band in the 3–9 range.
2. **Apply a 20% exclusion for codes and business models out of scope** — 41.1 promoción inmobiliaria, 42 civil engineering, service-led installers, and asset-rental businesses carrying a construction code. **ESTIMATE**; it is the least evidenced step here and Phase 4's extraction will replace it with a count.

|                                 | Barcelona province                                  | Catalonia                                           |
| ------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| 3–9 employees, in-scope codes   | 5,410                                               | 7,116                                               |
| 10–49 employees, in-scope codes | 1,833                                               | 2,412                                               |
| **SAM, enterprises**            | **≈7,240**                                          | **≈9,530**                                          |
| **SAM, annual value**           | 5,410 × €3,600 + 1,833 × €6,000 = **€30.5 million** | 7,116 × €3,600 + 2,412 × €6,000 = **€40.1 million** |

All four figures are **ESTIMATE**. Reported with a deliberate false precision only so the arithmetic can be checked; the honest statement is **"roughly 7,000 firms and roughly €30 million a year in the province of Barcelona, roughly 9,500 firms and roughly €40 million a year in Catalonia."**

### 3.9 SOM

SOM is set by supply. The reference case records that a second tenant was created configuration-only in 0.02 seconds of machine time, that the Definition of Done targets a timed onboarding under fifteen minutes, and that **the timed run against a real intake has not happened**. Until Phase 7 answers that, the binding constraint on SOM is how many real intakes can be absorbed, not how many firms exist.

Capacity assumption (**ESTIMATE**): two onboardings a month in year one, four in year two, six in year three, with 10% annual churn — giving a thirty-six-month cumulative of about **120 tenants** at the optimistic end. Against the observation that a pilot is slower than a deployment and that Tier A design partners consume disproportionate attention, a conservative case is **40**. Central case **75 tenants**.

|                                          | Conservative | Central  | Optimistic |
| ---------------------------------------- | ------------ | -------- | ---------- |
| Tenants at month 36                      | 40           | 75       | 120        |
| Penetration of Barcelona SAM (≈7,240)    | 0.55%        | 1.04%    | 1.66%      |
| Annual recurring value at €4,800 blended | €192,000     | €360,000 | €576,000   |

**SOM, province of Barcelona, 36 months: 40–120 tenants, €0.19m–€0.58m annual recurring value. ESTIMATE.** The number that should worry a reader is not the penetration rate, which is modest, but the absolute revenue: at central case this market supports a small team, not a venture outcome, unless either the price per tenant or the geography expands. **That is the load-bearing conclusion of this section and Phase 11 should attack it first.** The counter-argument, which Phase 7 must price, is that the same SAM arithmetic applied to Spain as a whole rather than to Catalonia multiplies the count by roughly 5.7 (68,134 ÷ 389,146 inverted) with no additional jurisdiction work at all — and the architecture's entire premise is that this is a configuration change.

### 3.10 Where sources disagree

1. **Catalonia's construction firm count: 68,134 (DIRCE, all firms) versus 24,260 (Observatorio, firms with employees).** Not a contradiction — two populations. Trust both, for their own population, and never mix them in one ratio. The factory's market is the second number.
2. **Catalonia's share of Spain's construction firms: "17.8%" as stated by the secondary source versus 17.51% by arithmetic on the two primary figures.** Trust the arithmetic; the difference changes nothing.
3. **Average household reform spend, Spain: €1,261** in one Andimac release and **€2,700** in a later one, both describing 2025, against a common figure of **1.9 million interventions**. Trust neither without reading the definitions; the first is probably spend per household across all households surveyed and the second spend per household that actually reformed. Only the second is relevant here, and the divergence is a warning about reform-market value figures generally.
4. **Public works tendering in Catalonia 2025: "+26% to €1,120 million in the first nine months" versus "+45%, reaching second place by volume".** The two cannot be reconciled from the retrieved text and one of the figures carries an implausible unit. **Treat Catalan public tendering as "growing strongly, magnitude not established"** and do not build an argument on it.
5. **Catalonia's residential stock needing rehabilitation: "1.3 million dwellings requiring urgent rehabilitation", "82% of the stock built before 2006" and "3,945,099 older dwellings"** come from secondary compilations, not from the Ministerio. They are directionally consistent with the national statement that more than ten million Spanish dwellings predate 1980, but the Catalan numbers should be re-sourced before use.

---

## 4. THE SWEET SPOT

**The sweet spot is 8 to 40 employees, with annual revenue between approximately €1.0 million and €8.0 million, in CNAE 43.3, 43.9 and the renovation end of 41.2, with at least a third of cost passing through subcontractors.**

Revenue band derivation: national construction turnover of €205,204 million (2024) across approximately 1.53 million people employed in the sector in 2025 gives **€134,000 of turnover per employed person**. At that productivity, eight employees implies about €1.07 million and forty implies about €5.4 million. The band is widened at the top to €8 million because reformas contractors subcontract heavily, so turnover per _direct_ employee runs above the sector mean. **ESTIMATE, method shown.**

### 4.1 What breaks below the lower bound

- **The two-role split stops existing.** The reference case's defining configuration decision is that operations must not be forced into back-office fields on site while back office must be able to correct operational entries. Under roughly eight people there is usually one person doing both, often in the evening, and the permission model's central distinction is inert.
- **The subcontractor document burden stops being painful.** Below this size a firm is more often _the_ subcontractor than the one collecting others' documents — which inverts the compliance flow the product was built for.
- **Willingness to pay falls below the serving floor.** Kit Digital's Segment II ceiling of €6,000 is the signal of what a 3–9 employee firm will countenance spending on software in total, across all tools. A product needing any human onboarding at all cannot be profitably delivered into the bottom of that.
- **Excel plus a gestoría remains the rational choice.** This must be conceded rather than argued around. A five-person firm running three jobs at a time can hold the margin question in one head. The product's value begins when the number of simultaneous jobs exceeds what one person can track, which is the real variable the employee count is standing in for.
- **The phone-first crew surface has no audience.** Redacting money figures before data leaves the server matters when crews are people other than the owners.

### 4.2 What breaks above the upper bound

- **Filing obligations change.** Above the SII threshold the firm is reporting invoice data to the tax authority near-continuously rather than periodically, and the jurisdiction pack's scope changes from producing documents to sustaining a filing channel. That is pack work, probably capability work, and it is investment rather than onboarding.
- **Public tendering appears.** Larger Catalan contractors bid for public work — Catalan public tendering grew strongly in 2025 and nationally 42.5% of the amount tendered was rehabilitation and maintenance, which is exactly these firms' trade. Public-sector invoicing, tender files and classification registers are absent from the reference case. L3 and L4.
- **A finance function appears, and with it an incumbent and an integration list.** Above roughly fifty people there is a controller, a payroll bureau, often an accounting package already in place, and a requirement to integrate rather than replace. The product's strongest claim — one record, no second copy anywhere — is the claim hardest to honour next to an incumbent ledger.
- **The buying centre fragments.** The reference case's purchase was two owners deciding jointly with no evidence of anyone else in the room. Above this band that becomes a committee, a written specification and a comparison against named commercial products, and the sales cycle lengthens past what the factory's unit economics tolerate before it has references.
- **The competitive field changes character.** 5% of Spanish construction firms account for 62% of turnover; those firms are already sold to, by vendors with implementation partners. Competing there on the strength of one reference is a losing position.
- **Administrative load grows in ways the product does not yet cover.** Every construction firm with employees has been obliged since February 2024 to operate the sector pension plan under the Convenio General del Sector de la Construcción, with contributions rising alongside the 2025–2026 pay settlement of 7.25%. At 10 employees that is a payroll line; at 150 it is a function.

### 4.3 Why 8–40 specifically, and how to test it cheaply

Eight is where a second administrative person appears and where simultaneous jobs typically exceed three. Forty is where a controller appears and where public work and SII begin to show up in the same firm. Both bounds are **judgements**, consistent with the sourced distribution but not derived from it — and both are cheap to test in Phase 5, because the distribution says the band is thin: in the province of Barcelona the 10–49 band holds only about **2,291 firms** and the in-scope 3–9 band about **5,410** (both ESTIMATE). A sample of thirty firms split either side of each bound, scored on the Phase 2 rubric, would settle it before any material spend.

One consequence deserves stating plainly. The sweet spot contains of the order of **7,000 firms in the province and 9,500 in Catalonia**, and the market is therefore **narrow and knowable**. It is small enough to enumerate by name in Phase 4 — which is a strategic advantage, not a limitation, because it means coverage is an operational problem rather than a marketing one. Building permits name their contractor, and the permit portals of Barcelona and the larger municipalities are open: the list of firms actively building right now is obtainable.

---

## 5. ADJACENCY MAP

Adjacencies are ranked by how much of the reference case survives the move, scored out of 100 across seven components carrying the weights shown, with the deepest architectural layer the move forces and the named blocker.

| Weight | Component surviving the move                                                                |
| ------ | ------------------------------------------------------------------------------------------- |
| 25     | Quote with chapters, line items, options, versions, acceptance                              |
| 20     | Immutable baseline, change orders, progress valuation                                       |
| 15     | Spanish tax, numbering, chaining, certified-billing posture (survives for any Spanish firm) |
| 12     | Supplier and subcontractor documents with expiry                                            |
| 10     | Catalogue and multi-supplier cost comparison                                                |
| 10     | Trilingual, multi-format documents                                                          |
| 8      | Crew-facing, money-redacted mobile surface                                                  |

| Rank | Adjacent niche                                                               | Score  | Layer                                    | What survives                                                                                                                                                                                         | What breaks, and the named blocker                                                                                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------- | ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Interior fit-out** (43.3, 43.32, 43.33)                                    | **95** | L0                                       | Everything. This is the reference trade under a different commercial label; chapter taxonomy, photographic annex, options and selective acceptance all transfer unchanged                             | Nothing structural. Chapter defaults may need re-ordering, which is pack data                                                                                                                                                                              |
| 2    | **Restoration and rehabilitación** (43.9, renovation 41.2)                   | **88** | L0–L1                                    | Quote-and-valuation spine, measurement, subcontractor documents, the payer-attribution model which fits owners' associations well                                                                     | Grant and subsidy files attached to a job, and heritage-authority approvals, want a document-tracking plugin. Additive, isolated                                                                                                                           |
| 3    | **Project installers — electrical, plumbing, climate** (43.21, 43.22, 43.29) | **78** | L0 for project work, L2 for service work | Chaptered quotes, material comparison, crews, subcontracting, document expiry. Largest retrievable segment: 78,775 firms in Spain, 14,357 in Catalonia                                                | Any firm earning materially from recurring maintenance needs a contract-and-work-order object that does not exist. This is the blocker, and it is a pack, not a plugin                                                                                     |
| 4    | **Solar and energy retrofit** (43.21 with 35.x)                              | **70** | L1–L2                                    | Quote, baseline, valuation, subcontracting, trilingual documents. A live market: Spanish self-consumption reached 9.3 GW, with installations rising from 12,000 a year in 2022 to over 47,000 in 2025 | Per-installation asset records, registration and commissioning files, and subsidy-linked revenue recognition. Also an unusually volatile demand curve — 1,139 MW in 2025 was 3.7% _down_ on 2024                                                           |
| 5    | **Landscaping and jardinería** (81.30)                                       | **58** | L1–L2                                    | One-off garden construction maps cleanly onto quote, chapters and valuation                                                                                                                           | Recurring maintenance rounds and seasonal cycles dominate most firms' revenue; plant material behaves unlike a catalogue line. Segment also small — one directory count gives 3,176 firms in Spain, which is too small to carry pack investment on its own |
| 6    | **Facility management** (81.10)                                              | **44** | L2–L4                                    | Jurisdiction pack, documents, payables, time recording                                                                                                                                                | The quote-and-baseline spine does not fit a contract-and-SLA business at all. Needs a recurring-contract capability, an asset register and penalty clocks — three ports that do not exist. Decline unless a Tier C case names the unlock                   |
| 7    | **Industrial maintenance** (33.1)                                            | **38** | L2–L4                                    | Jurisdiction pack, time recording, payables, supplier comparison                                                                                                                                      | Work-order and asset-centric rather than project-centric; a different collective agreement; a different document-expiry regime; and customers who are industrial buyers with their own portals. Furthest from the reference case of the seven              |

**The two adjacencies to pursue are interior fit-out and restoration/rehabilitación**, for three reasons beyond their scores. They sit inside the same CNAE families already being listed for the core market, so Phase 4 costs nothing extra to cover them. They share the core's buying centre — an owner-manager, often the same gremi, often the same aparellador introducing the job. And restoration in particular has a demand tailwind that is independent of new-build cycles: Spain closed 2025 with **1.9 million home reform interventions, up 1.6%**, with **three in ten households** having made some improvement, an average spend of **€2,700** per reforming household and an average integral-reform budget near **€32,000**; nationally **42.5% of the amount tendered** for public works was rehabilitation and maintenance; and the Catalan stock is old, with secondary compilations putting **1.3 million Catalan dwellings** in need of rehabilitation.

Project installers rank third and are the most commercially interesting _tension_ in this map: the segment is the largest and best-measured of any here, and it is half-fit. If Phase 4 can reliably separate project-led installers from service-led ones — and a revenue-mix question plus permit records probably can — then the third rank converts into the second-largest L0 population available. If it cannot, every installer is a coin toss, and Phase 5 should route them to Tier B rather than Tier A regardless of score.

A channel observation bearing on all of the above, for Phase 8 rather than this document: the **Gremi de Constructors d'Obres de Barcelona i Comarques** reports **1,332 affiliated companies** across itself and its linked comarcal guilds. Against a Barcelona-province SAM of roughly 7,000 firms, that single body already holds a fifth of the market by count, and its members self-select for being the firms that join things.

---

## 6. Figures sought and not found

Listed so that the gaps are a work item. Each is obtainable; none was obtainable from this environment today.

1. Construction enterprise counts for the **province of Barcelona** at CNAE three-digit level and by employee band — **not found**. Source to read: INE table 301, `Locales por provincia, actividad principal (divisiones CNAE 2009) y estrato de asalariados`, and Idescat's provincial enterprise tables. Every Barcelona-province count in Section 3 depends on this and is an ESTIMATE until it is read.
2. **Construction-specific** employee-band distribution for Catalonia from Idescat, rather than the all-sector distribution — **not found**. Source: Idescat, _Empreses amb seu social a Catalunya per sector, branca d'activitat i nombre d'assalariats_.
3. DIRCE counts at group level for **41.1, 41.2, 43.1, 43.3 and 43.9**, Spain and Catalonia — **not found** (only group 432 was retrieved). Source: INE table 39372, `Empresas por CCAA, actividad principal (grupos CNAE 2009) y estrato de asalariados`.
4. Membership of the **Cambra de Contractistes d'Obres de Catalunya** — **not found**.
5. Membership of **Cateb**, the Col·legi de l'Arquitectura Tècnica de Barcelona, formerly CAATEEB — **not found**. Worth having: it is Phase 8's strongest referral hypothesis, and the body has been renamed, which any outreach copy must reflect.
6. **Catalonia-specific** rehabilitación turnover, and the number of rehabilitation visados in Catalonia — **not found**. National figures and secondary Catalan compilations only.
7. Average revenue per construction firm **by employee band** — **not found**. The €134,000 per employed person used in Section 4 is a sector-wide quotient, not a banded figure. Source: INE, EEE Sector Construcción 2024 detailed tables.
8. Counts for **CNAE group 433 sub-classes** (43.31, 43.32, 43.33, 43.34, 43.39) from any primary source — **not found**, and the one directory figure retrieved for the group is internally inconsistent and was rejected in §2.2.

---

## Sources

All URLs below were consulted on 2026-09-12. Where retrieval of the document itself was refused by network policy, the figure was extracted from search results against that page; §0 states this constraint and its consequence.

**Primary statistical sources**

- INE, _Directorio Central de Empresas (DIRCE)_, press note, 1 January 2025 — https://www.ine.es/dyngs/Prensa/DIRCE2025.htm and https://www.ine.es/dyngs/Prensa/DIRCE2025.pdf
- INE, DIRCE operation and results index — https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736160707&menu=ultiDatos&idp=1254735576550
- INE, table 39372, _Empresas por CCAA, actividad principal (grupos CNAE 2009) y estrato de asalariados_ — https://www.ine.es/jaxiT3/Tabla.htm?t=39372
- INE, table 298, _Empresas por CCAA, actividad principal (grupos CNAE 2009) y estrato de asalariados (antigua estratificación)_ — https://www.ine.es/jaxiT3/Tabla.htm?t=298
- INE, table 301, _Locales por provincia, actividad principal (divisiones CNAE 2009) y estrato de asalariados_ — https://www.ine.es/jaxiT3/Tabla.htm?t=301
- INE, table 39374, _Empresas por provincia y estrato de asalariados_ — https://www.ine.es/jaxiT3/Tabla.htm?t=39374
- INE, _Estadística Estructural de Empresas: Sector Construcción_, year 2024, press note — https://www.ine.es/dyngs/Prensa/EEESCONS2024.htm
- INE, EEE Sector Construcción, operation index — https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736177121&menu=ultiDatos&idp=1254735576550
- INE, _Clasificación Nacional de Actividades Económicas 2025_ (CNAE-2025 project document) — https://www.ine.es/normativa/leyes/cse/proyecto_CNAE2025.pdf
- Idescat, _Empreses i establiments. Empreses amb seu social a Catalunya a 1 de gener. Per sector, branca d'activitat econòmica i nombre d'assalariats de l'empresa_ — https://www.idescat.cat/pub/?id=ee&n=20920
- Idescat, _Anuari estadístic de Catalunya. Empreses i establiments a 1 de gener. Per sectors d'activitat i nombre d'assalariats_ — https://www.idescat.cat/indicadors/?id=aec&n=15949
- Idescat, _Empreses i establiments_ statistics index — https://www.idescat.cat/pub/?id=ee
- Idescat, _Novetats. Empreses i establiments. 01/01/2025_ — https://www.idescat.cat/novetats/?id=5481
- Idescat, _Novetats. Afiliats i afiliacions a la Seguretat Social_, 11/2025 — https://www.idescat.cat/novetats/?id=5396
- Idescat, classification browser, CNAE-2025 group 432 — https://www.idescat.cat/classificacions/?tc=6&v0=1&id=cnae-2025-es&v3=432&lang=es
- Generalitat de Catalunya, Departament d'Economia i Finances, _Nombre i dimensió_ (enterprise counts and size distribution, Catalonia) — https://economia.gencat.cat/ca/ambits-actuacio/economia-catalana/trets/empresa/nombre-dimensio/
- Generalitat de Catalunya, Departament d'Economia i Finances, _Sector de la construcció_ — https://economia.gencat.cat/ca/ambits-actuacio/economia-catalana/trets/estructura-productiva/sector-construccio/index.html
- datos.gob.es, dataset record for INE table 301 — https://datos.gob.es/en/catalogo/ea0042823-locales-por-provincia-actividad-principal-divisiones-cnae-2009-y-estrato-de-asalariados-anual-provincias-explotacion-estadistica-del-directorio-central-de-empresas-identificador-api-3011

**Sector bodies and sector statistics**

- Observatorio Industrial de la Construcción (Fundación Laboral de la Construcción), _Empresas inscritas en la Seguridad Social_ barometer — https://www.observatoriodelaconstruccion.com/barometro/empresas-seguridad-social
- Observatorio Industrial de la Construcción, _Radiografía del empleo en construcción 2025_ — https://www.observatoriodelaconstruccion.com/informes/detalle/radiografia-del-empleo-en-construccion-2025
- Fundación Laboral de la Construcción, _La construcción cierra 2025 con datos positivos…_ (December 2025 figures, November 2025 company counts by size) — https://www.fundacionlaboral.org/actualidad/notas-de-prensa/la-construccion-cierra-2025-con-datos-positivos-y-destaca-en-hipotecas-licitaciones-visados-ocupados-y-afiliados
- Fundación Laboral de la Construcción, monthly company-count release — https://www.fundacionlaboral.org/en/current-affairs/news/sector/el-numero-de-empresas-del-sector-de-la-construccion-inscritas-en-la-seguridad-social-aumento-un-19-en-el-indice-interanual
- Fundación Laboral de la Construcción de Catalunya, _La construcció tanca el 2025 amb dades positives…_ — https://catalunya.fundacionlaboral.org/en/current-affairs/news/foundation/la-construccio-tanca-el-2025-amb-dades-positives-i-destaca-en-hipoteques-licitacions-visats-ocupacio-i-afiliacio
- Fundación Laboral de la Construcción de Catalunya, Catalan sector company counts — https://catalunya.fundacionlaboral.org/cat/actualitat/noticies/sector/el-numero-de-empresas-del-sector-de-la-construccion-inscritas-en-la-seguridad-social-aumento-un-22-en-el-indice-interanual
- Gremi de Constructors d'Obres de Barcelona i Comarques, linked comarcal guilds — https://www.gremi-obres.org/es/nosotros/organizaciones-empresariales-vinculadas/ and https://www.gremi-obres.org/
- Cateb — Col·legi de l'Arquitectura Tècnica de Barcelona (formerly CAATEEB) — https://www.cateb.cat/ and https://www.cateb.cat/directori-de-collegiats/
- UNEF, self-consumption installed capacity to 2025 — https://www.unef.es/es/comunicacion/comunicacion-post/el-autoconsumo-fotovoltaico-en-espana-alcanza-los-9-3-gw-instalados
- UNEF, Catalan self-consumption outlook — https://www.unef.es/es/comunicacion/comunicacion-post/el-sector-espera-que-el-nuevo-decreto-de-renovables-y-las-ayudas-al-autoconsumo-desbloquearan-el-desarrollo-fotovoltaico-en-cataluna
- Andimac, _3 de cada 10 hogares hicieron alguna mejora de su vivienda en 2025_ — https://www.andimac.org/2026/03/24/3-de-cada-10-hogares-hicieron-alguna-mejora-de-su-vivienda-en-2025/
- Andimac reform-market figures, reported — https://www.cicconstruccion.com/texto-diario/mostrar/5823391/reformas-viviendas-alcanzan-19-millones-2025-crecimiento-moderado-16 and https://observatorioinmobiliario.es/noticias/residencial/el-mercado-de-la-reforma-alcanzar%C3%A1-19-millones-de-viviendas-en-2025-y-la-rehabilitaci%C3%B3n-crecer%C3%A1-un-75/
- Alimarket, _Informe 2025 sobre Rehabilitación en España_ — https://www.alimarket.es/construccion/informe/403100/informe-2025-sobre-rehabilitacion-en-espana
- Alimarket, _La construcción avanzó en sus principales indicadores durante 2025_ — https://www.alimarket.es/construccion/noticia/420192/la-construccion-avanzo-en-sus-principales-indicadores-durante-2025

**Regional and territorial context**

- Diputació de Barcelona / Cambra de Comerç de Barcelona, _Informe econòmic local de la província de Barcelona 2025_ — https://www.diba.cat/es/web/informe-economic-local-de-la-provincia-de-barcelona/2025/barcelona-provincia and https://cambrabcn.org/informe-economic-local-de-la-provincia-de-barcelona-2025/
- XODEL (Diputació de Barcelona), _Estructura empresarial de la província de Barcelona. Edició 2025_ — https://xodel.diba.cat/news/2025/11/20/estructura-empresarial-de-provincia-de-barcelona-edicio-2025 and the press note at https://xodel.diba.cat/sites/xodel.diba.cat/files/ot_xodel_informe_empresarial_nota_premsa_2025_aaff_def.pdf
- Ajuntament de Barcelona, _Barcelona Dades — Nombre d'empreses_ — https://portaldades.ajuntament.barcelona.cat/estad%C3%ADstiques/pd4ir2wytr
- Ajuntament de Barcelona, _Nombre de comptes de cotització per secció (CCAE 2025)_ — https://portaldades.ajuntament.barcelona.cat/estad%C3%ADstiques/zteuv7ie6r
- Generalitat de Catalunya, _Informe anual de l'economia catalana 2024_ — https://record.bibliotecadigital.gencat.cat/bitstream/handle/20.500.14345/2295/informe-anual-economia-catalana-2024.pdf
- Focus UPF, Catalan construction and promotion sector weight — https://www.upf.edu/web/focus/w/el-sector-de-la-construcci%C3%B3-i-promoci%C3%B3-a-catalunya-genera-400.000-llocs-de-treball-i-representa-el-7-del-pib
- ON ECONOMIA (El Nacional), Catalan company formation by province, 2025 — https://www.elnacional.cat/oneconomia/ca/empreses/catalunya-va-tancar-any-2025-25000-noves-empreses_1550708_102.html
- Statista, population of the province of Barcelona — https://www.statista.com/statistics/1201888/population-of-the-spanish-province-of-barcelona/
- Ministerio de Industria, _Estructura y dinámica empresarial en España_ — https://industria.gob.es/es-es/estadisticas/Estadisticas_Territoriales/Estructura-Dinamica-Empresarial-2023.pdf
- ipyme, _Cifras PYME_ — https://ipyme.org/Publicaciones/Cifras%20PYME/CifrasPyme_mayo_2025.pdf

**Company directories used as order-of-magnitude cross-checks only (rejected for sizing, see §2.2)**

- eInforma sectoral reports: CNAE 412 — https://www.einforma.com/informes-sectoriales/cnae-412-empresas-construccion-de-edificios · CNAE 432 — https://www.einforma.com/informes-sectoriales/cnae-432-empresas-instalaciones-electricas-de-fontaneria-y-otras-instalaciones-en-obras-de-construccion · CNAE 4321 — https://www.einforma.com/informes-sectoriales/cnae-4321-empresas-instalaciones-electricas · CNAE 4322 — https://www.einforma.com/informes-sectoriales/cnae-4322-empresas-fontaneria-instalacion-de-sistemas-de-calefaccion-y-aire-acondicionado · CNAE 433 — https://www.einforma.com/informes-sectoriales/cnae-433-empresas-acabado-de-edificios · CNAE 439 — https://www.einforma.com/informes-sectoriales/cnae-439-empresas-otras-actividades-de-construccion-especializada · CNAE 4311 — https://www.einforma.com/informes-sectoriales/cnae-4311-empresas-demolicion · CNAE 4312 — https://www.einforma.com/informes-sectoriales/cnae-4312-empresas-preparacion-de-terrenos · CNAE 8110 — https://www.einforma.com/informes-sectoriales/cnae-8110-empresas-servicios-integrales-a-edificios-e-instalaciones · CNAE 8130 — https://www.einforma.com/servlet/app/prod/FICHA_INFORME_SECTORIAL/id/8130 · CNAE 3312 — https://www.einforma.com/informes-sectoriales/cnae-3312-empresas-reparacion-de-maquinaria
- Iberinform CNAE directory — https://www.iberinform.es/informacion-de-empresas/directorio-cnae/4321/instalaciones-electricas
- Sector aggregation of INE DIRCE 2025 by CNAE group and autonomous community — https://www.globalgrowth.consulting/datos/clima-hvac/ccaa/canarias and https://www.globalgrowth.consulting/datos/consultoras-negocio/ccaa/cataluna
- OpenMercantil BORME directory, Barcelona — https://openmercantil.es/empresas/barcelona

**Regulatory and subsidy context cited in passing (Phase 3 verifies against primary instruments)**

- Programa Kit Digital, España Digital 2026 — http://espanadigital.gob.es/lineas-de-actuacion/programa-kit-digital
- Red.es, Kit Digital Segment I call (10 to under 50 employees) — https://sede.red.gob.es/es/procedimientos/convocatoria-de-ayudas-destinadas-la-digitalizacion-de-empresas-del-segmento-i-entre
- Convenio General del Sector de la Construcción, sector pension plan obligation — https://www.gremicat.es/en/obligation-of-construction-companies-to-adhere-to-the-new-pension-plan/ and https://www.wolterskluwer.com/es-es/expert-insights/plan-pensiones-construccion
- Construction sector pay settlement 2025–2026 — https://www.elnacional.cat/oneconomia/es/economia/sector-construccion-pacta-subida-salarial-725-hasta-2026_1509703_102.html

---

_Phase 1 artefact. Inputs: `ROADMAP.md` §PHASE 1, `00-REFERENCE-CASE.md` Parts A and C. Outputs consumed by Phase 2 (`02-ICP-AND-RUBRIC.md`), which turns the sweet spot and the adjacency scores into a scoring instrument, and by Phase 4, which turns the CNAE segmentation and the SAM boundary into a sourcing plan._

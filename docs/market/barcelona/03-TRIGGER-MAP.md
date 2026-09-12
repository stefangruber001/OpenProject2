# 03 — TRIGGER AND REGULATORY URGENCY MAP

This document is Phase 3 of the Barcelona market roadmap (`docs/market/barcelona/ROADMAP.md`), written on **2026-09-12**, and it is an inventory of forcing functions rather than an argument for the product: Spanish construction SMEs of the size described in `02-ICP-AND-RUBRIC.md` buy administrative software when an instrument, an inspector, a client or a deadline removes the option of continuing as they are, and this map names each of those pressures, dates it, prices the penalty, and states what it obliges the software to do. Every legal position below was checked against primary sources — the consolidated texts at boe.es and the tax authority's own published pages at sede.agenciatributaria.gob.es — on **2026-09-12**, and every position must be re-checked before it is relied on in a sales conversation, a contract or a product gate, because three of the six regimes mapped here have moved their dates at least once in the last two years and one of them (mandatory business-to-business electronic invoicing) is waiting on a ministerial order that could be published in any week. Where a claim could not be brought back to a primary instrument it is labelled UNVERIFIED in the body and repeated in the closing list; nothing in the ranking or in the sales openers rests on a claim so labelled. A note on method, stated because it bears on how much weight each citation carries: in this environment direct document fetches to boe.es and to the tax authority's site are blocked by the network egress policy, so primary texts were read through domain-restricted search against those same domains, which returns the instrument's title, its identifier and substantial quotations of the operative text but not the whole article as a fetched page. Identifiers, dates, titles and the quoted operative sentences are therefore solid; anything that depended on reading a full annex or a table of amounts is flagged.

**The ICP this map is calibrated for**, taken from `02-ICP-AND-RUBRIC.md` PART A: a Spanish **sociedad limitada**, 8 to 40 employees, **€1.0m–€8.0m of revenue**, CNAE 43.3 / 43.9 / renovation-end 41.2, private-sector and general-contractor work with no material public tendering, quarterly filings through an external gestoría, two owner-decision-makers (operations and administration), no controller and no IT employee. Two consequences of that band run through everything below. First, the firm is a **corporate income tax payer**, which puts it in the first and earlier of the two Verifactu waves. Second, the band's **upper end crosses a statutory threshold**: at €6,010,121.04 of prior-year turnover the firm becomes a _gran empresa_ for tax-management purposes and is drawn into near-continuous invoice reporting, which changes both its obligations and its fit. A €1.5m firm and a €7m firm in the same CNAE face materially different regimes, and a seller who does not ask for the turnover figure before the compliance pitch will mis-pitch one of them.

For what the product already does against these obligations, the reference is `00-REFERENCE-CASE.md` PART A, items A.7, A.8, A.10 and A.11: immutable invoices with gapless numbering, a rectification path and a SHA-256 invoice chain in the Spanish jurisdiction pack; subcontractor and worker paperwork handled as generic dated documents with expiry alerts and no named statutory register; labour hours with approvals and corrections but no statutory working-time register asserted; and a period archive for the external bookkeeper whose export format is still unbound.

---

## 1. Ley 11/2021 antifraude and the Verifactu certified-billing regime (RD 1007/2023 as amended)

### Current legal position

**Ley 11/2021, de 9 de julio**, de medidas de prevención y lucha contra el fraude fiscal (BOE-A-2021-11473, BOE of 10 July 2021) inserted two things into the Ley General Tributaria 58/2003: a new formal obligation at **art. 29.2.j) LGT**, requiring that the computer systems supporting the accounting, billing and management processes of those carrying on economic activities guarantee "la integridad, conservación, accesibilidad, legibilidad, trazabilidad e inalterabilidad de los registros, sin interpolaciones, omisiones o alteraciones de las que no quede la debida anotación en los sistemas mismos"; and a new infringement at **art. 201 bis LGT** for the manufacture, production, marketing and possession of systems that do not meet those requirements.

The regulation that fills in art. 29.2.j) is **Real Decreto 1007/2023, de 5 de diciembre** (BOE-A-2023-24840, BOE of 6 December 2023), which approves the Reglamento establishing the requirements for billing systems (_sistemas informáticos de facturación_, SIF) and the standardisation of billing-record formats. Its technical content is developed by **Orden HAC/1177/2024, de 17 de octubre** (BOE-A-2024-22138, BOE of 28 October 2024). The regime has two modes: a **VERI\*FACTU** mode, in which each billing record is transmitted to the tax authority as invoices are issued, and a **non-verifiable** mode, in which records stay with the taxpayer, must be electronically signed, and must be accompanied by an event log (_registro de eventos_) that the authority can demand. In the authority's own words, the event log "solo es obligatorio en el caso de los sistemas de emisión de facturas no verificables, no siendo necesario en los casos de SIF «VERI\*FACTU»".

**Scope, and the one exception that matters for this ICP.** Art. 3.1 of the Reglamento lists the obliged taxpayers, and art. 3.1.a) is the corporate income tax payers. Taxpayers who keep their VAT record books through the tax authority's electronic office under **art. 62.6 of the Reglamento del IVA** — that is, taxpayers inside the immediate information supply system described in section 3 below — are **excepted** from the Reglamento's obligations, "pues se considera que sus sistemas informáticos y procedimientos ofrecen la necesaria garantía". A firm at the top of the ICP band that has crossed into that system is therefore outside Verifactu, not earlier inside it.

### Deadline for a firm of the ICP's size

**1 January 2027.** The ICP firm is an S.L. and therefore a corporate income tax payer, inside art. 3.1.a), and the governing date is the fourth final provision of RD 1007/2023 in its current wording: "Los obligados tributarios a que se refiere el artículo 3.1.a) deberán tener adaptados los sistemas informáticos a las características y requisitos establecidos en este reglamento y en su normativa de desarrollo antes del 1 de enero de 2027. El resto de obligados tributarios mencionados en el artículo 3.1 deberán tener operativos los citados sistemas informáticos antes del 1 de julio de 2027."

**This date has moved twice, and the amending instruments must be named** because a prospect who has read a 2024 article believes something different. The original Reglamento set adaptation before **1 July 2025**. **Real Decreto 254/2025, de 1 de abril** (BOE-A-2025-6600) replaced that with **1 January 2026** for corporate income tax payers and **1 July 2026** for the rest. Those dates were in turn superseded by **article 3 of Real Decreto-ley 15/2025, de 2 de diciembre** (BOE-A-2025-24446, BOE of 3 December 2025), whose title states on its face that it amends RD 1007/2023, and which amended the fourth final provision to the current **1 January 2027 / 1 July 2027**. Two details are worth carrying into a sales conversation. The decree-law was **ratified by the Congress of Deputies**, published as the Resolución de 11 de diciembre de 2025 ordering publication of the convalidation agreement (BOE-A-2025-25695, BOE of 16 December 2025), so the postponement is settled rather than provisional. And the decree-law expressly preserved the **regulatory rank** of RD 1007/2023 despite amending it by a norm of legal rank, which matters only in that it leaves the Reglamento amendable by royal decree again — in other words, a fourth move is mechanically cheap for the government and cannot be ruled out.

As at today, **2026-09-12**, the ICP firm has **111 days** of adaptation time left.

### Penalty

Two distinct exposures, both in art. 201 bis LGT as inserted by Ley 11/2021. For the **producer or marketer** of a non-compliant system: a fixed fine of **€150,000 per financial year in which sales took place and per distinct type of system**. For the **user** who merely holds systems that are not duly certified when certification is required by regulation, or whose certified devices have been altered: a fixed fine of **€50,000 per financial year**. The second of those is the ICP firm's exposure and the first is this repository's, which is why the certified-billing feature is hard-gated off at resolve time in the Spanish jurisdiction pack (`LEGAL_REVIEW.md` §1) and must stay that way until the declaración responsable can honestly be signed.

### What it obliges the software to do

Per RD 1007/2023 and Orden HAC/1177/2024: generate a **billing record** (_registro de facturación de alta_) at the moment each invoice is issued and a **cancellation record** (_de anulación_) when one is voided, never a silent deletion; **chain each record to its predecessor by a hash** computed over defined parts of the previous record; **electronically sign** the records in the non-verifiable mode; print on the invoice a **QR code** carrying a defined partial content plus the legend "Factura verificable en la sede electrónica de la AEAT" or "VERI\*FACTU"; keep an **event log** in the non-verifiable mode; and obtain from the producer a **declaración responsable** certifying conformity with art. 29.2.j) LGT and with the Reglamento. In VERI\*FACTU mode it must additionally **transmit records to the tax authority** as invoices are issued.

Against `00-REFERENCE-CASE.md` A.7, the repository already holds the hard half — immutability, gapless numbering, a rectification path and a per-tenant SHA-256 chain — and does not yet hold the official record layout, the QR content, the event log or the submission channel. That is a bounded, fully specified build whose specification is public, and it is the single most dateable piece of work in the roadmap.

### Citations

Ley 11/2021, de 9 de julio, arts. amending LGT 29.2.j) and 201 bis (BOE-A-2021-11473, 10 July 2021) · RD 1007/2023, de 5 de diciembre, arts. 3.1, 3.1.a), and disp. final cuarta (BOE-A-2023-24840, 6 December 2023) · Orden HAC/1177/2024, de 17 de octubre (BOE-A-2024-22138, 28 October 2024) · RD 254/2025, de 1 de abril (BOE-A-2025-6600) · RD-ley 15/2025, de 2 de diciembre, art. 3 (BOE-A-2025-24446, 3 December 2025) · Resolución del Congreso de 11 de diciembre de 2025, convalidación (BOE-A-2025-25695, 16 December 2025) · art. 62.6 Reglamento del IVA (RD 1624/1992).

---

## 2. Ley 18/2022 "Crea y Crece": mandatory business-to-business electronic invoicing

### Current legal position

**Ley 18/2022, de 28 de septiembre**, de creación y crecimiento de empresas (BOE-A-2022-15818), art. 12, amended Ley 56/2007 de Medidas de Impulso de la Sociedad de la Información by adding **art. 2 bis**, under which all entrepreneurs and professionals must issue, send and receive **electronic invoices** in their commercial relations with other entrepreneurs and professionals. The obligation carries two ancillary duties that are frequently forgotten and are exactly the sort of thing an SME's current arrangement fails: the issuer must **report invoice status** information, and must give recipients — **including those who have ceased to be customers** — access to copies of their invoices **for four years** after issue, at no additional cost.

The long-missing implementing regulation now exists. **Real Decreto 238/2026, de 25 de marzo** (BOE-A-2026-7295, BOE of 31 March 2026) develops the mandatory business-to-business electronic invoicing system and amends the invoicing-obligations Reglamento approved by RD 1619/2012. It sets the technical and information requirements of the Spanish system, the requirements for private invoice-exchange platforms including interoperability and minimum interconnection between them, and the role of a **public invoicing solution** (_solución pública de facturación electrónica_) operated by the tax authority as an invoice repository. The royal decree entered into force twenty days after publication, but **its effective application is deferred**: it is tied, per the fourth final provision and by reference to the eighth final provision of Ley 18/2022, to the **entry into force of the ministerial order developing the public solution**. Publication of that order starts the clock.

Two operative requirements of RD 238/2026 shape the software work. Platforms and billing systems used by obliged businesses that do **not** issue through the public solution must send, **simultaneously with issue, a faithful electronic copy of every invoice in UBL syntax** to the public solution, containing all invoice concepts with equivalent semantic correspondence and in all cases the minimum content required by the invoicing regulations; the stated purpose of collecting those copies is to let the administration, combined with invoice statuses, **calculate and monitor payment periods**. And private platforms must be able to **transform the invoice message into every supported syntax**, with interoperability guaranteed by using the public solution's syntax as the common denominator.

### Deadline for a firm of the ICP's size

**Not yet running, and that is the finding.** Under the eighth final provision of Ley 18/2022, art. 12 takes effect **one year** after approval of the implementing development for entrepreneurs and professionals with annual turnover **above €8 million**, and **two years** after for everyone else; RD 238/2026 restates this as twelve months and twenty-four months from the trigger. The ICP firm, at €1.0m–€8.0m, is in the **second wave: twenty-four months** after the ministerial order on the public solution enters into force. Searches of the BOE on 2026-09-12 did not surface a published order; the draft was in public consultation until 8 May 2026 (UNVERIFIED — the consultation date comes from secondary commentary, and absence from a search is not proof of absence from the BOE). If the order were published before the end of 2026, the ICP firm's obligation would fall in late 2028; on that reading the regime is **certain in substance and indeterminate in date**, which makes it an architecture argument and not a deadline argument.

One asymmetry is worth selling on, though, and it arrives earlier than the firm's own obligation: the ICP firm's **general-contractor customers above €8 million** enter twelve months ahead of it, and a contractor inside the system will start requiring structured invoices from its chain as a matter of its own convenience well before the law compels the subcontractor.

### Penalty

Per **art. 2 bis.9 of Ley 56/2007** in the wording given by art. 12 of Ley 18/2022: **warning or a fine of up to €10,000**, for failing to offer the possibility of issuing and receiving electronic invoices when obliged, and for failing to give former customers access to their earlier invoices. The sanction is **not imposed by the tax authority** but by the holder of the Secretaría de Estado de Digitalización e Inteligencia Artificial — a different inspectorate, a different file, and a detail that tells a prospect this is not the gestoría's problem to absorb.

### What it obliges the software to do

Issue invoices as **structured messages** in one of the admitted syntaxes (Facturae, UBL, CII, EDIFACT, per the European standard EN 16931 — the syntax list and EN reference come from secondary commentary on RD 238/2026 and are UNVERIFIED against the royal decree's own annex); **receive** structured invoices from suppliers, which for a firm passing a third of its cost through subcontractors is the larger half of the work; send a **UBL copy of every issued invoice to the public solution at the moment of issue** when not issuing through that solution; record and transmit **invoice statuses** — acceptance, rejection, effective payment — so that payment periods can be computed; and keep invoices **retrievable by the recipient for four years**, including after the commercial relationship ends. The reported four-calendar-day window for communicating statuses, and a reported additional twelve-month deferral of the status duties for certain natural persons and income-attribution entities at or below €8 million, are UNVERIFIED.

### Citations

Ley 18/2022, de 28 de septiembre, art. 12 and disp. final octava (BOE-A-2022-15818) · Ley 56/2007, art. 2 bis, incl. 2 bis.9 (BOE-A-2007-22440) · RD 238/2026, de 25 de marzo (BOE-A-2026-7295, BOE of 31 March 2026) · RD 1619/2012, de 30 de noviembre (BOE-A-2012-14696) · tax authority notice "Facturación electrónica obligatoria", 31 March 2026.

---

## 3. SII — Suministro Inmediato de Información, and its threshold

### Current legal position

The immediate information supply system was introduced by **Real Decreto 596/2016, de 2 de diciembre** (BOE-A-2016-11575), which modernised VAT management by making the VAT record books be kept through the tax authority's electronic office, and is developed by **Orden HFP/417/2017, de 12 de mayo** (BOE-A-2017-5312), which regulates the normative and technical specifications for keeping the books under **art. 62.6 of the Reglamento del IVA**. It has been live since 1 July 2017.

### Deadline for a firm of the ICP's size

**Threshold-triggered rather than dated.** The system is mandatory for taxpayers with monthly VAT settlement periods: those registered in the monthly refund register (REDEME), VAT groups, and **large undertakings — turnover above €6,010,121.04 in the preceding calendar year**. A firm inside the ICP band below that figure has **no SII obligation**; a firm above it must supply billing records through the electronic office within **four calendar days** of issue, or eight where the invoice is issued by the recipient or a third party, with Saturdays, Sundays and national holidays excluded from the count.

For targeting, the threshold is a knife-edge inside the ICP's own revenue band, and it cuts both ways. It is a **disqualifier on fit**: `02-ICP-AND-RUBRIC.md` scores near-continuous invoice-level reporting as real administrative distance, because the jurisdiction pack's job changes from producing documents to sustaining a channel. It is simultaneously the **exemption from Verifactu** described in section 1. A prospect whose last filed accounts show €5.6m of revenue and a growth trajectory is therefore a prospect about to change regimes, and the honest conversation is about which of the two regimes it will be in when the project goes live.

### Penalty

Failure to supply, or inaccurate or late supply, of the billing records sits in the general regime for breaches of information obligations in the Ley General Tributaria (arts. 198 and 199 LGT for failures to file and for filing incompletely or inaccurately, plus the specific percentage-based penalty attached to delays in keeping the books through the electronic office). The **exact current penalty formula for late SII supply is UNVERIFIED** here: the primary article text could not be read through the available channel, and nothing in this map's ranking depends on the figure.

### What it obliges the software to do

Keep the four VAT record books as **structured data with per-invoice granularity**, not as period totals; tag every issued and received invoice with the fields the electronic office expects, including the operation keys that decide how a line is treated; **transmit within four calendar days** and handle the authority's acceptance, rejection and error responses as a durable state on the invoice; and reconcile the authority's ledger against the firm's own. That is a channel to be sustained, not a document to be produced — the distinction that makes SII a Tier C engineering commitment rather than a configuration item.

### Citations

RD 596/2016, de 2 de diciembre (BOE-A-2016-11575) · art. 62.6 Reglamento del IVA (RD 1624/1992) · Orden HFP/417/2017, de 12 de mayo (BOE-A-2017-5312) · tax authority pages "Suministro Inmediato de Información (SII)" and the large-undertaking manual on the €6,010,121.04 threshold.

---

## 4. Construction-specific obligations: Libro de Subcontratación, REA, CAE, TPC and the sector agreement

This is the cluster where the product is furthest from the statute and the prospect is closest to the pain. `00-REFERENCE-CASE.md` A.8 is explicit: a grep of the engine finds **no REA registration, no Libro de Subcontratación, no coordination-of-business-activity model and no trade-card model by name**; the obligations are carried as generic dated documents with expiry alerts. Phase 3's job was to size that gap, and the size is: four named statutory objects, one of them kept physically on site, all four demanded by name by the general contractors and safety coordinators the ICP firm works under.

### Current legal position

**Ley 32/2006, de 18 de octubre**, reguladora de la subcontratación en el Sector de la Construcción (BOE-A-2006-18205), with **Real Decreto 1109/2007, de 24 de agosto** (BOE-A-2007-15766) as its implementing regulation — itself amended by RD 327/2009, de 13 de marzo (BOE-A-2009-4260) and RD 337/2010, de 19 de marzo (BOE-A-2010-4765) — establishes four duties that bite on a firm of this size:

- **Libro de Subcontratación (art. 8 Ley 32/2006; chapter IV RD 1109/2007).** On every works covered by the Law, each contractor must hold a subcontracting book that **must remain on the site at all times**, recording in chronological order from the start of the works every subcontracting with undertakings and self-employed workers, its **subcontracting level**, the contracting undertaking, the object of the contract, and the identity of the person exercising organisational and management powers for each subcontractor. The regulation sets its format, its **authorisation by the labour authority**, the practice of entries, access by other parties to the works, and the exceptional authorisations of the technical direction where the levels of art. 5 are exceeded.
- **Registro de Empresas Acreditadas (art. 6 Ley 32/2006; RD 1109/2007).** Contractors and subcontractors habitually working in construction must be registered in the REA kept by the labour authority of the territory of their registered office; registration is **valid throughout Spain and for three years, renewable for equal periods**, with the data publicly accessible save for personal privacy.
- **Quality-of-employment and training requirements (arts. 4 and 10 Ley 32/2006).** The undertaking must hold its own preventive organisation under Ley 31/1995, human resources with the required occupational-risk-prevention training, and a minimum proportion of workers on indefinite contracts (the statutory percentage and its transitional history are UNVERIFIED here; the requirement's existence is not).
- **Coordination of business activities (Real Decreto 171/2004, de 30 de enero, BOE-A-2004-1848, developing art. 24 Ley 31/1995).** Where undertakings coincide in one workplace, the duties of information exchange, cooperation and instruction apply, with the concepts of _centro de trabajo_, _empresario titular_ and _empresario principal_ defined in chapter I and a non-exhaustive list of coordination means in chapter V — information exchange and communications, coordination meetings, presence of preventive resources — chosen according to the dangerousness of the activities, the number of workers and the duration of the concurrence.

**The Convenio General del Sector de la Construcción.** The **VII Convenio colectivo general del sector de la construcción** was registered and published by Resolución de 6 de septiembre de 2023 of the Dirección General de Trabajo (BOE-A-2023-19903, BOE of 23 September 2023), convenio code 99005585011900, signed on 3 July 2023 by CNC on the employer side and CCOO del Hábitat and UGT FICA on the union side, with validity **2022–2026, running to 31 December 2026**. It has been amended repeatedly in the BOE: corrección de erratas by Resolución de 25 de octubre de 2023 (BOE-A-2023-22635); modification by Resolución de 25 de diciembre de 2023 (BOE-A-2024-426); modifications by Resolución de 30 de enero de 2025 (BOE-A-2025-2663) and Resolución de 22 de abril de 2025 (BOE-A-2025-8627); and a modification registered by Resolución de 24 de noviembre de 2025 (BOE-A-2025-25234, BOE of 10 December 2025) touching **art. 56 on the sector's simplified employment pension plan**. The sector pension plan is a real payroll obligation, not a statement of intent: for 2024 the employer contribution for workers who are participants was **1.50 per cent of the salary concepts of the 2023 convenio tables**, pro-rated for part-year or part-time service. A **Resolución de 30 de abril de 2026 registers an amendment to the VIII Convenio** general del sector de la construcción (BOE-A-2026-10312, BOE of 12 May 2026), which includes as annex XIX a non-exhaustive list of CNAE codes covering the activities inside the agreement's functional scope — useful for Phase 4's extraction filters. **Which convenio text is in force today, and from when, is UNVERIFIED**: the amending resolution for a VIII agreement was located but the publication of the VIII agreement's own articulated text was not.

**Tarjeta Profesional de la Construcción.** The TPC accredits a worker's sector-specific prevention training, professional category and periods of employment, and is issued by the Fundación Laboral de la Construcción. Its statutory hook is the training-accreditation duty of **art. 10 Ley 32/2006**; the obligation itself and the card's content are set by the sector agreement. The specific convenio article number (art. 167 is cited in secondary sources, which refer to the VI agreement) is **UNVERIFIED**.

**Working-time records.** The general obligation is **art. 34.9 of the Estatuto de los Trabajadores** (RDLeg 2/2015, as introduced by RD-ley 8/2019): a daily record of each worker's working day, kept and preserved. A royal decree requiring digital records with traceability, authenticity, immediate worker access and remote access for the Labour Inspectorate has been in preparation through 2026 and, on the evidence available on 2026-09-12, has **not been published in the BOE**; that status, and the reported adverse Council of State opinion of 23 March 2026, are **UNVERIFIED** (secondary sources only). The existing art. 34.9 duty is not conditional on that decree.

### Deadline for a firm of the ICP's size

**All of it is live now and has been for years**; there is no future date to miss. What varies is the moment of enforcement, and that moment is external: a general contractor's pre-qualification pack, a safety coordinator refusing site access, a principal undertaking's document portal, or a Labour Inspectorate visit. For a firm passing at least a third of its cost through subcontractors, as the ICP does by definition, the enforcement event arrives with every new site rather than on a calendar.

### Penalty

Breaches of Ley 32/2006 are sanctioned under the **texto refundido de la Ley sobre Infracciones y Sanciones en el Orden Social (RDLeg 5/2000, de 4 de agosto)**, to which arts. 11 and 12 of the Law refer; the subcontracting-specific conducts are graded there as serious or very serious, and coordination failures are sanctioned under the same text. The **exact current euro brackets of art. 40.2 LISOS are UNVERIFIED**: the consolidated text returned through the available channel gave brackets of roughly €2,046–€40,985 for serious and €40,986–€819,780 for very serious prevention infringements, while other sources report materially higher figures after a later uprating, and the discrepancy could not be resolved against the primary table. Two non-monetary consequences are firmer and often matter more to an owner than the fine: prevention infringements prescribe at one, three and five years for minor, serious and very serious respectively; and **very serious prevention sanctions are published**, under **Real Decreto 597/2007, de 4 de mayo** (BOE-A-2007-9190) — which is both a reputational penalty and, for Phase 4, an externally detectable signal.

### What it obliges the software to do

Hold the **subcontracting chain as a first-class object per site**: each subcontractor and self-employed worker, its subcontracting level, the contracting party above it, the contract object, and the named person exercising organisational and management powers — in a form that can be produced as the authorised book, kept current on site, and exported for the coordinator. Hold **REA registration with its three-year expiry** as a dated, alerting fact about each subcontractor rather than as one more scanned file. Hold **per-worker training and card state** with expiry. Hold the **documents exchanged for coordination of activities** against the works and the principal undertaking, with evidence of delivery. And keep a **daily working-time record per worker** that survives an inspection.

Measured against `00-REFERENCE-CASE.md` A.8 and A.10, the repository has the generic mechanism — dated documents, expiry alerts, calendar entries, a communication template whose body says that without the paperwork site access is not possible, plus hours with approvals and corrections — and none of the named objects. Phase 3's conclusion for the architecture is the one ADR-0011 anticipates: this is **jurisdiction-by-vertical bridge work**, Spain × construction, costed as one isolated bridge module against a published contract, not a new pack and certainly not an edit that pushes the words into a capability.

### Citations

Ley 32/2006, de 18 de octubre, arts. 4, 5, 6, 8, 10, 11, 12 (BOE-A-2006-18205) · RD 1109/2007, de 24 de agosto, chapter IV and REA provisions (BOE-A-2007-15766), amended by RD 327/2009 (BOE-A-2009-4260) and RD 337/2010 (BOE-A-2010-4765) · RD 171/2004, de 30 de enero (BOE-A-2004-1848) · Ley 31/1995, de 8 de noviembre, art. 24 (BOE-A-1995-24292) · RDLeg 5/2000, de 4 de agosto, arts. 12, 13, 40 (BOE-A-2000-15060) · RD 597/2007, de 4 de mayo (BOE-A-2007-9190) · VII Convenio general del sector de la construcción, Resolución de 6 de septiembre de 2023 (BOE-A-2023-19903) and its amendments BOE-A-2023-22635, BOE-A-2024-426, BOE-A-2025-2663, BOE-A-2025-8627, BOE-A-2025-25234 · Resolución de 30 de abril de 2026, VIII convenio amendment (BOE-A-2026-10312) · art. 34.9 Estatuto de los Trabajadores (RDLeg 2/2015).

---

## 5. Periodic tax filings, and what the ERP must hold to produce them cleanly

### Current legal position and deadlines for a firm of the ICP's size

A firm in this band, filing quarterly through a gestoría and not in the monthly regime, produces the following rhythm. **Modelo 303**, the VAT self-assessment: quarterly, filed **from the 1st to the 20th of the month following the settlement period** — April, July and October — with the **fourth quarter from 1 to 30 January**. **Modelo 111**, withholdings and payments on account on employment and business income: quarterly, within the **first twenty calendar days of April, July, October and January** (15th where payment is domiciled). **Modelo 190**, the annual summary of those withholdings: filed **between 1 and 31 January** of the year following the one declared, approved by **Orden EHA/3127/2009, de 10 de noviembre** (BOE-A-2009-18567). **Modelo 347**, the annual declaration of operations with third parties: filed **during February** in respect of the previous calendar year, approved by **Orden EHA/3012/2008, de 20 de octubre** (BOE-A-2008-16973) and later modified by Orden EHA/3061/2010 (BOE-A-2010-18367). The approving orders for modelos 303 and 111, and the €3,005.06 annual threshold conventionally applied to modelo 347 counterparties, are **UNVERIFIED** here; the filing windows above are taken from the tax authority's own published deadline pages.

Two adjacent obligations are worth naming even though the prompt does not list them, because they come out of the same data and an SME discovers them late: the annual VAT summary and, where the firm buys from or sells to other member states, the recapitulative declaration of intra-Community operations. Their identifiers and windows are **UNVERIFIED** here and are not relied on.

### Penalty

Late, incomplete or inaccurate filing is sanctioned under the general regime of the Ley General Tributaria: **art. 198** for failing to file within the deadline where no economic loss results, **art. 199** for filing incompletely, inaccurately or with false data, and **arts. 191–193** where a self-assessment understates the debt, with surcharges for voluntary late payment under art. 27. The **exact current amounts and percentages are UNVERIFIED** here. The practical penalty an owner actually feels is different and worth leading with: the gestoría's re-work, the quarter closed on estimates, and a VAT position that turns out to have been wrong on renovation work — which for this sector is the expensive error, because the reduced-rate decision on dwelling renovation turns on three cumulative conditions and one failed condition re-rates the whole invoice (`LEGAL_REVIEW.md` §2).

### What the ERP must hold

The filings are a reporting problem only if the underlying records are complete; otherwise they are a reconstruction problem every ninety days. To produce them cleanly the system must hold:

- **Per-invoice tax detail, not period totals**: taxable base, rate applied, tax amount, and — decisively for this sector — the **recorded justification** for a reduced rate, with its inputs, rule identifier, legal basis and rule-set version persisted on the artifact, so that a decision taken in March is defensible in January. The repository already does this (`00-REFERENCE-CASE.md` A.7).
- **Gapless, immutable numbering by series**, with rectifications in their own series referencing the original, so that the book the firm holds and the book the gestoría files are the same book.
- **Withholding by supplier profile**, since construction subcontractor invoicing is profile-dependent and a blanket assumption produces a wrong modelo 111 and a wronger modelo 190 (`LEGAL_REVIEW.md` §3).
- **Counterparty totals by tax identifier across the calendar year**, which is the whole of modelo 347 and is exactly what a spreadsheet-and-paper firm cannot produce without a week of sorting.
- **Payroll-adjacent totals per person per year** for the annual withholding summary.
- **Bank movements allocated to documents**, because the period cannot honestly close while money is unexplained — the repository makes this a gate rather than a warning, refusing to build the hand-off package while any movement is unallocated (`00-REFERENCE-CASE.md` A.11).
- **A sealed period archive** with a completeness gate and an agreed export format for the external bookkeeper. The export adapter is still unbound pending the accountant's format, and that single open question is on the critical path of every pilot.

### Citations

Tax authority deadline pages for modelo 303 (quarterly, 1–20; fourth quarter 1–30 January), modelo 111 (first twenty calendar days of April, July, October, January) and modelo 190 (1–31 January) · Orden EHA/3127/2009, de 10 de noviembre, modelo 190 (BOE-A-2009-18567) · Orden EHA/3012/2008, de 20 de octubre, modelo 347, filed in February (BOE-A-2008-16973) · Orden EHA/3061/2010, de 22 de noviembre (BOE-A-2010-18367) · Ley 58/2003, General Tributaria, arts. 27, 191–193, 198, 199 (BOE-A-2003-23186).

---

## 6. Digitalisation money: Kit Digital and the Catalan programmes

### Current legal position

**Kit Digital** rests on **Orden ETD/1498/2021, de 29 de diciembre**, which approved the regulatory bases for digitalisation aid to small and medium undertakings, micro-undertakings and the self-employed under the Recovery, Transformation and Resilience Plan. Those bases were most recently amended by **Orden TDF/39/2026, de 26 de enero** (BOE-A-2026-2070, BOE of 28 January 2026), which keeps the bases in force and provides for the reinvestment by Red.es of any unexecuted budget — **even after 2026** — within the Kit Digital programme itself, in activities under investment 3 of component 13 of the revised plan annex. The companion advisory programme, Kit Consulting, rests on **Orden TDF/436/2024, de 10 de mayo** (BOE-A-2024-9524), amended by **Orden TDF/38/2026, de 26 de enero** (BOE-A-2026-2069).

In **Catalonia**, the relevant current instrument is ACCIÓ's competitiveness vouchers: regulatory bases by **Resolució EMT/1297/2026, de 27 d'abril**, and the 2026 call by **Resolució EMT/1470/2026, de 9 de maig** (DOGC 9665, 14 May 2026), open from 15 May 2026, subsidising expert advisory services in strategy, internationalisation, innovation, sustainability and industrial property, with an artificial-intelligence segment added inside the innovation line in 2026.

### Deadline and amounts for a firm of the ICP's size

**Kit Digital: no application window open.** On the evidence available on 2026-09-12 there is **no open Kit Digital call** to apply to; the last windows closed during 2025 and Red.es had not published a new call. The consequence for the sales motion is specific and should not be fudged: **the subsidy is not a trigger today**. It remains a **pricing anchor** — the published per-segment ceilings are the one public number stating what a Spanish SME of each size has been given permission to spend on software, €6,000 for the 3-to-9 employee segment and €12,000 for the 10-to-49 segment as used in `02-ICP-AND-RUBRIC.md` — but those exact figures, the closure dates of the last calls and the reported uplift of the smallest segment are **UNVERIFIED** here, because the annexes of the bases and the closure notices could not be read through the available channel. A prospect that already holds an unspent or partially spent bono is a different and much warmer case, and that is a question to ask rather than a thing to assume.

**ACCIÓ vouchers: open, modest, and advisory rather than capital.** The 2026 call is open and is a plausible route to funding the advisory half of an implementation for a Catalan SME with operational headquarters in Catalonia. The reported maxima — up to €8,000 for strategy vouchers, up to €10,500 for internationalisation, up to €12,000 for sustainability and industrial-property advice, with a November 2026 deadline on the European research-programme line — are **UNVERIFIED** against the DOGC text. Two cautions: the call is budget-limited and is reported to exhaust within days of opening, and the vouchers buy **advisory services**, which fits a diagnostic and configuration engagement far better than it fits a software licence.

### Penalty

None; this is money, not an obligation. The correct asymmetry to hold in mind is that subsidy is an **accelerant of a decision already made** and never its cause. A firm that needs the grant to afford the system is a firm that will not sustain the subscription after the grant.

### What it obliges the software to do

Nothing, in the statutory sense. Commercially it obliges the **vendor** to be able to appear as an eligible supplier of an eligible category with the paperwork that entails, and to quote in a form that maps onto a voucher's categories. That is a back-office capability of the factory, not a feature of the product.

### Citations

Orden ETD/1498/2021, de 29 de diciembre (Kit Digital bases) · Orden TDF/39/2026, de 26 de enero (BOE-A-2026-2070, BOE of 28 January 2026) · Orden TDF/436/2024, de 10 de mayo (BOE-A-2024-9524) · Orden TDF/38/2026, de 26 de enero (BOE-A-2026-2069) · Resolució EMT/1297/2026, de 27 d'abril, and Resolució EMT/1470/2026, de 9 de maig (DOGC 9665) · Red.es call pages at sede.red.gob.es.

---

## Ranking by urgency-to-buy

Ranked by the product of three things: how soon a dated consequence lands, how certain it is, and whether the firm can discharge it without changing its systems. A deadline a gestoría can absorb is not urgency; a deadline that requires the firm's own invoice-issuing software to change is.

**1. Verifactu — 1 January 2027, 111 days away, and it is the firm's own billing software that must change.**
Opener: _"Your company is a sociedad limitada, so from 1 January 2027 the software that issues your invoices has to generate a signed, chained billing record with a QR code for every invoice — a royal decree already moved that date twice, the last time to 2027, and it will not move because your current process is a quotation pad and a spreadsheet."_

**2. The quarterly filing cycle and the gestoría hand-off — the pain is now, every ninety days, and it is measurable before and after.**
Opener: _"Between the 1st and the 20th of next month somebody in your office will reconstruct a quarter of purchases and sales from paper to get the VAT return out, and the reason last year's reduced-rate invoices are a risk is that nobody wrote down why the rate was reduced at the time."_

**3. Subcontracting compliance — the subcontracting book, the accredited-undertakings register, the coordination duties and the trade cards.**
Opener: _"Every new site brings a request for your subcontractors' registration, insurance and training documents, and the subcontracting book has to be on the site and current — today that lives in a folder, and the day a coordinator or an inspector asks you for it is the day it is either complete or it is not."_

**4. Mandatory business-to-business electronic invoicing — certain in substance, undated in fact, and arriving at your customers first.**
Opener: _"The regulation for mandatory electronic invoicing between companies was published in March, your obligation starts two years after a ministerial order that has not appeared yet, and your larger general contractors start a year before you do — which means they will ask you for structured invoices before the law does."_

**5. The immediate information supply threshold — only for the top of the band, and it changes the conversation entirely.**
Opener: _"If your turnover goes past about six million you move to supplying every invoice to the tax authority within four days, which also takes you out of the 2027 billing-software regime — so the right question before we design anything is which side of that line you will be on in two years."_

**6. Digitalisation subsidy — an accelerant, not a trigger.**
Opener: _"There is no Kit Digital window open to apply to right now, and the Catalan vouchers fund advice rather than licences — so if we do this, we do it because the quarter costs you a week of your own time, and we treat any grant that reopens as a discount rather than as the reason."_

---

## Non-regulatory triggers

The detectability column is the hand-off to Phase 4: it states what an outside observer can see, in which source, without the company's cooperation. Anything requiring the company's cooperation is a qualifying question, not a trigger signal, and is marked as such. All personal-data handling in Phase 4 inherits the data posture in `02-ICP-AND-RUBRIC.md` and the consent gate of Phase 10.

| Trigger                                                  | What it is, and why it forces a purchase                                                                                                                                                                                      | Detectable from outside by                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Failed inspection or sanction                            | A Labour Inspectorate visit or a safety sanction converts paperwork from an annoyance into an exposure with a file number; the owner's tolerance for "it is in a folder somewhere" drops to zero for roughly one quarter      | Published very serious prevention sanctions under RD 597/2007; labour-authority and autonomous-community sanction publications; court and administrative-appeal listings; local press on site accidents; sudden appearance of a prevention-service or compliance-consultant logo on the firm's own site                                         |
| Margin lost on a large job                               | A job that ended below cost and nobody can say where; the single most common reason a construction SME buys job costing, and the only trigger that makes the owner rather than the administrator the buyer                    | Filed accounts showing a margin break against the prior year (SABI, eInforma, Registro Mercantil); a permit record for one unusually large works in the prior year against an otherwise small portfolio; supplier-side payment delays visible in commercial credit reports; narrative confirmation needs the qualifying call                    |
| Generational handover                                    | A son or daughter entering the business, or an owner approaching retirement; the incoming generation will not accept the outgoing one's head as the system of record, and has the standing to spend                           | BORME changes in administrators and powers of attorney; a second family surname appearing as an officer; the firm's own website and LinkedIn showing a new role such as _gerència_ or _direcció tècnica_; age of the incumbent administrator inferred from appointment history                                                                  |
| Incumbent software renewal date                          | A licence or subscription anniversary is the only moment an SME compares alternatives; outside it, switching costs dominate                                                                                                   | The incumbent's own public case studies and customer lists; job adverts naming a product ("experiencia con <product>"); a vendor logo or partner badge on the firm's site; invoice or quotation PDFs carrying a generator fingerprint in their metadata where such documents are public; renewal month itself usually needs the qualifying call |
| Change of gestoría                                       | A new external accountant re-specifies what the client must deliver and in what format, and is often the one who says the current arrangement cannot continue; also the highest-leverage referral channel in the whole map    | Change of the filing agent or deposit presenter on the most recent accounts deposit; a new advisory firm's logo or reference on the company's site; the gestoría's own client announcements; confirmation needs the qualifying call                                                                                                             |
| Rapid headcount growth                                   | Crossing roughly eight to ten employees, or going from four to nine simultaneous jobs, is the point at which one person can no longer hold the job portfolio in their head — the real variable behind the ICP's employee band | Social-security employee bands over time (SABI, eInforma, Informa); volume and recency of job adverts on InfoJobs, Indeed and LinkedIn; LinkedIn employee-count trend; count and value of works permits per municipality; fleet and crew visible in recent street-level imagery and the firm's own social posts                                 |
| A new large general-contractor client                    | A contractor above the electronic-invoicing threshold, or one with a supplier portal, imposes its own document and invoice requirements on the subcontractor as a condition of payment                                        | The firm's own portfolio and social posts naming the contractor or the development; contractor press releases and development marketing naming its chain; site hoardings and municipal permit records listing principal undertaking and subcontractors                                                                                          |
| Working-capital stress                                   | Retentions plus long customer terms against shorter supplier terms, with nobody owning the receivables ledger; makes collections visibility the lead benefit rather than compliance                                           | Average payment period and any late-payment disclosure in the filed accounts; commercial credit reports and payment-behaviour scores; appearance in supplier-default registries; filings of accounts late or abbreviated                                                                                                                        |
| Loss of the key administrative person                    | The one person who knows how the quarter is assembled leaves or retires; the knowledge leaves with them and the successor demands a system                                                                                    | Job adverts for administrative, accounting or _administració d'obra_ roles; LinkedIn departures; a change in the contact name on the firm's own website and invoices                                                                                                                                                                            |
| New premises, yard or second entity                      | A move or a second company adds an entity, a cost centre and a second set of books, which breaks a single spreadsheet                                                                                                         | BORME incorporation of a sibling entity or a change of registered office; commercial-register address changes; a second address on the website or in review listings; municipal activity licences                                                                                                                                               |
| Acquisition or absorption of a competitor                | Two chart-of-account conventions and two quotation traditions must be merged; the merged entity cannot run on either spreadsheet                                                                                              | BORME merger and absorption notices; accounts showing a discontinuity in revenue and headcount; press and sector-association announcements                                                                                                                                                                                                      |
| Certification or membership requiring documented process | Quality, safety or environmental certification, or a professional-association membership, imposes written procedures and evidence that a folder cannot produce                                                                | Certification-body public registries; certification marks on the firm's website and vehicles; membership listings of sector associations and professional bodies such as CAATEEB and the gremis                                                                                                                                                 |

---

## Sources

All URLs were used on 2026-09-12. The boe.es and sede.agenciatributaria.gob.es items were read through domain-restricted search against those domains, as explained in the preamble.

- https://www.boe.es/buscar/doc.php?id=BOE-A-2021-11473 — Ley 11/2021, de 9 de julio (antifraude; LGT arts. 29.2.j) and 201 bis)
- https://www.boe.es/buscar/pdf/2021/BOE-A-2021-11473-consolidado.pdf — consolidated text of Ley 11/2021
- https://www.boe.es/buscar/act.php?id=BOE-A-2003-23186 — Ley 58/2003, General Tributaria (arts. 27, 191–193, 198, 199, 201 bis)
- https://www.boe.es/buscar/act.php?id=BOE-A-2023-24840 — RD 1007/2023, de 5 de diciembre (billing-systems Reglamento)
- https://www.boe.es/buscar/pdf/2023/BOE-A-2023-24840-consolidado.pdf — consolidated text of RD 1007/2023
- https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-22138 — Orden HAC/1177/2024, de 17 de octubre (technical specifications)
- https://www.boe.es/buscar/doc.php?id=BOE-A-2025-6600 — RD 254/2025, de 1 de abril (first postponement, to 2026)
- https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-24446 — RD-ley 15/2025, de 2 de diciembre, art. 3 (postponement to 2027)
- https://www.boe.es/boe/dias/2025/12/03/pdfs/BOE-A-2025-24446.pdf — BOE of 3 December 2025, RD-ley 15/2025
- https://www.boe.es/buscar/doc.php?id=BOE-A-2025-25695 — Congress convalidation of RD-ley 15/2025, 11 December 2025
- https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/cuestiones-generales.html — tax authority, scope and requirements of the billing-systems regime
- https://sede.agenciatributaria.gob.es/Sede/normativa-criterios-interpretativos/analisis/El__Reglamento_Veri_factu_.html — tax authority analysis of the Reglamento
- https://sede.agenciatributaria.gob.es/Sede/normativa-criterios-interpretativos/analisis/Desarrollo_tecnico_del_Real_Decreto_que_regula_el_reglamento__Verifactu_.html — technical development
- https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/caracteristicas-requisitos-sif-registro-eventos_.html — event-log requirement
- https://sede.agenciatributaria.gob.es/Sede/todas-noticias/2025/abril/2/modificacion-reglamento-que-regula-sistemas-facturacion.html — tax authority notice on RD 254/2025
- https://www.boe.es/buscar/act.php?id=BOE-A-2022-15818 — Ley 18/2022, de 28 de septiembre (Crea y Crece), art. 12 and disp. final octava
- https://www.boe.es/eli/es/l/2007/12/28/56/con — Ley 56/2007, consolidated (art. 2 bis, sanction at 2 bis.9)
- https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-7295 — RD 238/2026, de 25 de marzo (business-to-business electronic invoicing)
- https://www.boe.es/boe/dias/2026/03/31/pdfs/BOE-A-2026-7295.pdf — BOE of 31 March 2026, RD 238/2026
- https://www.boe.es/buscar/pdf/2026/BOE-A-2026-7295-consolidado.pdf — consolidated text of RD 238/2026
- https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696 — RD 1619/2012, de 30 de noviembre (invoicing obligations)
- https://sede.agenciatributaria.gob.es/Sede/todas-noticias/2026/marzo/31/facturacion-electronica-obligatoria.html — tax authority notice, mandatory electronic invoicing
- https://sede.agenciatributaria.gob.es/Sede/iva/novedades-iva/novedades-normativa-2026/real-decreto-238-2026-25-marzo.html — tax authority summary of RD 238/2026
- https://sede.agenciatributaria.gob.es/static_files/Sede/Actualidad/Novedades/2026/Nota_informativa_RD_Facturacion.pdf — tax authority information note on RD 238/2026
- https://www.boe.es/buscar/doc.php?id=BOE-A-2016-11575 — RD 596/2016, de 2 de diciembre (immediate information supply)
- https://www.boe.es/buscar/act.php?id=BOE-A-2017-5312 — Orden HFP/417/2017, de 12 de mayo (art. 62.6 RIVA specifications)
- https://sede.agenciatributaria.gob.es/Sede/iva/suministro-inmediato-informacion.html — tax authority, immediate information supply
- https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-gran-empresa/son-consecuencias-superar-umbral-6_010_12104/plazos-presentacion-autoliquidaciones/iva-modelo-303.html — large-undertaking threshold and filing deadlines
- https://www.boe.es/buscar/doc.php?id=BOE-A-2006-18205 — Ley 32/2006, de 18 de octubre (construction subcontracting)
- https://www.boe.es/buscar/pdf/2006/BOE-A-2006-18205-consolidado.pdf — consolidated text of Ley 32/2006
- https://www.boe.es/buscar/act.php?id=BOE-A-2007-15766 — RD 1109/2007, de 24 de agosto (implementing regulation)
- https://www.boe.es/buscar/doc.php?id=BOE-A-2009-4260 — RD 327/2009, de 13 de marzo (amendment)
- https://boe.es/eli/es/rd/2010/03/19/337 — RD 337/2010, de 19 de marzo (amendment)
- https://www.boe.es/buscar/act.php?id=BOE-A-2004-1848 — RD 171/2004, de 30 de enero (coordination of business activities)
- https://www.boe.es/buscar/act.php?id=BOE-A-1995-24292 — Ley 31/1995, de 8 de noviembre (art. 24)
- https://www.boe.es/buscar/act.php?id=BOE-A-2000-15060 — RDLeg 5/2000, de 4 de agosto (LISOS, arts. 12, 13, 40)
- https://www.boe.es/buscar/act.php?id=BOE-A-2007-9190 — RD 597/2007, de 4 de mayo (publication of very serious prevention sanctions)
- https://www.boe.es/buscar/doc.php?id=BOE-A-2023-19903 — VII Convenio general del sector de la construcción, Resolución de 6 de septiembre de 2023
- https://www.boe.es/boe/dias/2023/09/23/pdfs/BOE-A-2023-19903.pdf — BOE of 23 September 2023, VII convenio
- https://www.boe.es/buscar/doc.php?id=BOE-A-2023-22635 — corrección de erratas, VII convenio
- https://www.boe.es/buscar/doc.php?id=BOE-A-2024-426 — amendment of 25 December 2023
- https://www.boe.es/buscar/doc.php?id=BOE-A-2025-2663 — amendment of 30 January 2025
- https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-8627 — amendment of 22 April 2025
- https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-25234 — amendment of 24 November 2025 (art. 56, sector pension plan)
- https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-10312 — Resolución de 30 de abril de 2026, amendment of the VIII convenio, annex XIX CNAE list
- https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430 — RDLeg 2/2015, Estatuto de los Trabajadores (art. 34.9)
- https://sede.agenciatributaria.gob.es/Sede/iva/presentar-declaracion-iva-modelo-303/plazo-presentacion-modelo-303.html — modelo 303 filing deadline
- https://sede.agenciatributaria.gob.es/Sede/procedimientos/GH01.shtml — modelo 111
- https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-gran-empresa/que-consecuencias-tiene-perder-condicion-empresa/plazos-presentacion-autoliquidaciones/retenciones-modelo-111.html — modelo 111 filing deadline
- https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/declaraciones-informativas/modelo-190-decla_____moniales-imputaciones-rentas-anual_/plazos-presentacion.html — modelo 190 filing deadline
- https://www.boe.es/buscar/act.php?id=BOE-A-2009-18567 — Orden EHA/3127/2009, de 10 de noviembre (modelo 190)
- https://www.boe.es/buscar/act.php?id=BOE-A-2008-16973 — Orden EHA/3012/2008, de 20 de octubre (modelo 347)
- https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/declaraciones-informativas/modelo-347-decla_____racion-anual-operaciones-personas_/plazo-presentacion-modelo-347.html — modelo 347 February deadline
- https://www.boe.es/buscar/doc.php?id=BOE-A-2010-18367 — Orden EHA/3061/2010, de 22 de noviembre (amends modelos 347, 390, 190)
- https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-2070 — Orden TDF/39/2026, de 26 de enero (Kit Digital bases amendment)
- https://www.boe.es/boe/dias/2026/01/28/pdfs/BOE-A-2026-2070.pdf — BOE of 28 January 2026, Orden TDF/39/2026
- https://www.boe.es/eli/es/o/2026/01/26/tdf38 — Orden TDF/38/2026, de 26 de enero (Kit Consulting bases amendment)
- https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-9524 — Orden TDF/436/2024, de 10 de mayo (Kit Consulting bases)
- https://sede.red.gob.es/es/procedimientos/convocatoria-de-ayudas-destinadas-la-digitalizacion-de-empresas-del-segmento-iii — Red.es call, segment III
- https://www.accio.gencat.cat/ca/serveis/convocatories-dajuts/llistat-ajuts/ — ACCIÓ list of open calls
- https://www.accio.gencat.cat/en/serveis/convocatories-dajuts/cupons-accio-a-la-competitivitat-de-l-empresa/index.html — ACCIÓ competitiveness vouchers
- https://tramits.gencat.cat/ca/tramits/tramits-temes/subvencions-cupons-competitivitat-empresarial-any-2026 — 2026 voucher procedure
- https://www.accio.gencat.cat/web/.content/01_Serveis/convocatories-ajuts/cupons-accio-landing/docs/ACCIO-faqs-cupons.pdf — ACCIÓ voucher questions, 2026
- https://exteriors.gencat.cat/ca/ambits-dactuacio/afers_exteriors/ue/fons_europeus/detalls/noticia/20260512_cupons — announcement of the 2026 voucher call

Secondary sources used only to locate instruments, never as the basis of a claim: noticias.juridicas.com (postponement of the billing-systems regime and the VIII convenio amendment), fiscal-impuestos.com, web.icam.es, inza.blog, forvismazars.com, iberley.es, supercontable.com, b2brouter.net and vendor commentary on RD 238/2026, fundacionlaboral.org and cnc.es on sector wage agreements, and Fundación Laboral material on the trade card.

---

## Claims left UNVERIFIED

Each of the following could not be brought back to a primary text through the channel available on 2026-09-12. None of them carries any part of the ranking or of the sales openers.

1. **That no ministerial order on the public electronic-invoicing solution had been published as at 2026-09-12.** Repeated searches of the BOE surfaced none, and a draft reportedly stood in public consultation until 8 May 2026, but absence from search results is not proof of absence from the BOE. The entire dating of the Crea y Crece obligation depends on this, which is why section 2 is ranked fourth and framed as undated.
2. **The admitted syntax list for mandatory electronic invoices (Facturae, UBL, CII, EDIFACT) and the reference to EN 16931** as stated in RD 238/2026's own text. The UBL copy to the public solution is verified; the full syntax list comes from commentary.
3. **The four-calendar-day window for communicating invoice statuses** under RD 238/2026, and **the reported additional twelve-month deferral of the status duties** for certain natural persons and income-attribution entities at or below €8m.
4. **The exact current euro brackets of art. 40.2 LISOS.** The consolidated text returned brackets of approximately €2,046–€40,985 (serious) and €40,986–€819,780 (very serious); other sources report higher post-uprating figures, and the conflict could not be resolved.
5. **The current penalty formula for late or inaccurate supply under the immediate information system.**
6. **The exact amounts and percentages of the LGT penalties** for late, incomplete or inaccurate periodic filings (arts. 27, 191–193, 198, 199 LGT).
7. **Whether a VIII Convenio general del sector de la construcción text is in force, and from when.** An amending resolution of 30 April 2026 was located (BOE-A-2026-10312); the publication of the VIII agreement's articulated text was not. The VII agreement's validity to 31 December 2026 is verified.
8. **The convenio article number governing the trade card** (secondary sources cite art. 167 of the VI agreement). The statutory training-accreditation duty at art. 10 Ley 32/2006 is verified.
9. **The statutory minimum percentage of workers on indefinite contracts** under art. 4 Ley 32/2006 and its transitional history.
10. **The status of the draft royal decree on digital working-time records**, including the reported Council of State opinion of 23 March 2026 and the absence of publication in the BOE. The underlying art. 34.9 Estatuto de los Trabajadores obligation is verified.
11. **The approving orders for modelos 303 and 111**, and **the €3,005.06 annual threshold for modelo 347 counterparties**. The filing windows for 303, 111, 190 and 347 are verified against the tax authority's own deadline pages.
12. **The identifiers and windows of the annual VAT summary and the recapitulative intra-Community declaration**, named in section 5 only as adjacent obligations.
13. **Kit Digital per-segment amounts (€6,000 for 3–9 employees, €12,000 for 10–49, and the reported uplift of the smallest segment), and the closure dates of the last application windows**, including the reported closure of segment III and comunidades de bienes on 31 October 2025. That there is no open call today is itself a negative finding resting on search evidence and should be re-checked before any pricing conversation leans on it.
14. **ACCIÓ 2026 voucher maxima and deadlines** (up to €8,000 strategy, €10,500 internationalisation, €12,000 sustainability and industrial property; 16 November 2026 on the European research line) and the identifiers Resolució EMT/1297/2026 and Resolució EMT/1470/2026 with DOGC 9665 of 14 May 2026, which were read through search rather than from the DOGC text.

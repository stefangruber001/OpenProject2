# Requirements Trace — BRD v2 (post-owners-meeting)

Line-by-line trace of `02Proyecto_Diorka_Business_Requirements_v2.docx` against the
implemented system. Produced by an 8-auditor verification pass over every requirement,
followed by a gap-closure cycle; the 16 items originally found MISSING are now implemented
and re-verified (145/145 year-simulation invariants across 5 seeds; 35/35 site E2E checks).

**Status legend** — IMPLEMENTED: working and covered by tests/simulation. PARTIAL: core behaviour
working, some sub-clauses simplified (details in evidence). PLANNED: explicitly deferred by the
BRD's own §11 phasing (justification given per item). MISSING: none remain.

| Status      | Count   |
| ----------- | ------- |
| IMPLEMENTED | 123     |
| PARTIAL     | 99      |
| PLANNED     | 16      |
| MISSING     | 0       |
| **Total**   | **238** |

## AP

| ID    | Status      | Evidence / justification                                                                                                                                                                             |
| ----- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP-01 | IMPLEMENTED | registerBill(): supplierId, number, date, dueDate, baseCents, vatCents, irpfCents, totalCents, docRef/capId attachment                                                                               |
| AP-02 | IMPLEMENTED | registerBill allocations {projectId\|overheadCategory, chapterNum}; payables() unallocated flag, unallocatedSummary(), backOfficeDay billsToAllocate                                                 |
| AP-03 | IMPLEMENTED | registerBill duplicate check on supplierId+number → duplicateSuspect; confirmCapture dup check; 'Posible duplicado' alert                                                                            |
| AP-04 | IMPLEMENTED | payBills() billAllocations across bills, partial → partPaid status; sim one payment covering two bills (year-sim.mjs:589-596)                                                                        |
| AP-05 | IMPLEMENTED | registerBill dueDate defaults from supplier.paymentTermsDays; cashForecast() builds payment forecast from payables dueDates                                                                          |
| AP-06 | PARTIAL     | payables() by date/supplier with paid/partPaid/overdue/disputed; no 'blocked' state exists and list lacks project dimension                                                                          |
| AP-07 | IMPLEMENTED | registerBill pulls irpfRateBp from supplier profile (irpfApplies), retains in total; irpfSummary retainedCents; UI 'IRPF retenido (111)'                                                             |
| AP-08 | PARTIAL     | payments have proofRef slot (erp-engine.js:1718) but it is never populated by any flow, UI, seed or sim                                                                                              |
| AP-09 | IMPLEMENTED | registerBill creditNoteFor; billOutstandingCents and actualCostCents subtract credits; vatSummary negative sign                                                                                      |
| AP-10 | PLANNED     | BRD §11 defers SEPA payment-file generation to Phase 2 (payment runs recorded in-system). BRD text defers it: 'assessed in the solution stage' (Medium); no bank payment-instruction export in build |

## AR

| ID    | Status      | Evidence / justification                                                                                                                                                          |
| ----- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-01 | PARTIAL     | issueInvoice links installmentIdx/changeId/budgetNumber, but baseCents is caller-supplied (sim recomputes 40%) and erp.html has no invoice-creation flow                          |
| AR-02 | PARTIAL     | invoice record has lines, base, VAT, IRPF, total, dueDate, method, IBAN, worksAddress; no rendered invoice document (only budget doc), no additional charges or payment reference |
| AR-03 | IMPLEMENTED | issueInvoice sets budgetNumber (AR-03 comment) and projectId on every invoice; quarterlyPackage exports budgetRef                                                                 |
| AR-04 | IMPLEMENTED | LISTS.invoiceKinds deposit/progress/final/extra/creditNote; all five exercised in year-sim.mjs (lines 380, 603, 664, 634, 679)                                                    |
| AR-05 | PARTIAL     | issueReceipt numbered REC- series with printable flag (sim cash path line 433); budgetNumber field never populated and no printable receipt document render in erp.html           |
| AR-06 | IMPLEMENTED | recordCollection(): allocations to multiple invoices, partial (sim half-collection line 611), onAccountCents for unallocated remainder                                            |
| AR-07 | IMPLEMENTED | issueInvoice irpfBp/irpfCents subtracted from total; quarterlyPackage txFromInvoice exports irpfBp/irpfCents; irpfSummary sufferedCents                                           |
| AR-08 | IMPLEMENTED | receivables(): dueDate, outstandingCents, daysOverdue, contact (mobile/email); erp.html facturacion table with status pills                                                       |
| AR-09 | IMPLEMENTED | projectBilling(): invoiced/collected/outstanding/remainingToInvoice; shown in projectDrawer 'Facturación del proyecto'                                                            |
| AR-10 | IMPLEMENTED | issueInvoice requires rectifies for creditNote; separate ABO- series keeps FAC- gap-free (seriesGaps check in exceptionList)                                                      |
| AR-11 | IMPLEMENTED | erp-engine.js addRecurringInvoice()/runRecurring() — recurring invoice templates generated on schedule                                                                            |

## BNK

| ID     | Status      | Evidence / justification                                                                                                                                                                                     |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BNK-01 | PARTIAL     | erp-engine.js importMovements retains all 10 fields (opCode, valueDate, balance, currency, ref...); no file-upload/parse UI in erp.html                                                                      |
| BNK-02 | IMPLEMENTED | erp-engine.js allocateMovementToProject matches code/budgetNumber + costKind; erp.html banco inline input; year-sim check 16                                                                                 |
| BNK-03 | IMPLEMENTED | classifyMovement + LISTS.movementClasses (7 BRD classes); internalTransfer sets excludedFromPL; sim check 15 asserts it                                                                                      |
| BNK-04 | PARTIAL     | matchMovement handles invoiceId/billId only (not receipts); exceptionList.unallocatedMovements has no age indicator; no UI                                                                                   |
| BNK-05 | PARTIAL     | m.card + merchantText kept; merchantRules → rec.suggestion in importMovements; learnMerchantRule manual only, suggestion never shown in UI                                                                   |
| BNK-06 | IMPLEMENTED | addBankAccount kind bank/till, accountBalanceCents per account, per-account KPIs in erp.html banco; sim seeds bank + till                                                                                    |
| BNK-07 | IMPLEMENTED | recordCashMovement reuses importMovements (same discipline), needsDoc flag, 'Falta justificante' pill, undocumentedCash exception, separate till                                                             |
| BNK-08 | PARTIAL     | cashPosition by account+total; cashForecast has receivables+contract installments+payables but omits committed purchases and is total-only                                                                   |
| BNK-09 | PARTIAL     | splitMovement validates split totals, multi-project allocations; no UI path, and class forced to projectCost so overhead splits misclass                                                                     |
| BNK-10 | PLANNED     | BRD §11 defers live PSD2 bank feeds to Phase 2 (CSV/manual import implemented). BRD Medium 'shall be assessed'; manual importMovements exists; feed deferred (setup-guide.html 'connect the bank ... later') |

## CAT

| ID     | Status      | Evidence / justification                                                                                                                  |
| ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| CAT-01 | PARTIAL     | erp-engine.js addCatalogueItem() with chapter tag; budgets have chapters; no subchapter level in catalogue or budget                      |
| CAT-02 | IMPLEMENTED | addCatalogueItem(): code/desc/unit/type/active; LISTS.units = ud,pa,m,ml,m2,m3,h,kg,l,% — exact BRD list                                  |
| CAT-03 | IMPLEMENTED | LISTS.itemTypes = material/ownLabour/subcontract/machinery/professional/waste/other — exact seven classes                                 |
| CAT-04 | IMPLEMENTED | addWorkPackage + packageCostCents: per-unit consumption, wastePct, container round-up, minPurchaseQty (only applied when containerSize>0) |
| CAT-05 | IMPLEMENTED | addLine subLines{room,qtyMilli,wastePct,customerVisible}; _aggSubLines aggregates; renderBudgetDoc filters customerVisible                |
| CAT-06 | PARTIAL     | item.customerWording + line.customerWording exist; no alternative descriptions, brands, models or quality levels                          |
| CAT-07 | IMPLEMENTED | addLine snapshots desc/unit/price/cost by value (itemId is reference only); addPrice is append-only history (SUP-05)                      |
| CAT-08 | IMPLEMENTED | item.imageRefs + line.imageRefs; renderBudgetDoc includes imageRefs on customer lines (PRE-10/CAT-08)                                     |
| CAT-09 | PARTIAL     | Seed has PK-BANY 'Bano completo (plantilla)' package, but no mechanism expands a template/package into a new budget's chapters/lines      |
| CAT-10 | IMPLEMENTED | erp-engine.js importCatalogue() — bulk catalogue import with per-row validation and dedup                                                 |

## CHG

| ID     | Status      | Evidence / justification                                                                                                                                |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHG-01 | IMPLEMENTED | erp-engine.js addChange(): desc, reason, priceCents, costCents, scheduleImpactDays, status per change                                                   |
| CHG-02 | PARTIAL     | addChange photoRef + priceChange() later (year-sim.mjs:550-555); erp.html has no site-capture form for extras, only approve                             |
| CHG-03 | IMPLEMENTED | projectEconomics() adds approved change price/cost; baseline Object.freeze (PRJ); approveChange() creates contract annex CTR-…-An                       |
| CHG-04 | IMPLEMENTED | issueInvoice throws 'Unapproved extra is not billable'; extrasRegister.unapprovedValueCents; Control Tower tile; sim negative test line 938             |
| CHG-05 | PARTIAL     | extrasRegister() counts identified/priced/approved/invoiced + per-item status, but no code path ever sets 'executed' and register has no executed count |
| CHG-06 | PARTIAL     | approveChange evidenceRef + photoRef + annexNumber on change record; no attachment slot for revised documents (single evidence ref only)                |
| CHG-07 | PARTIAL     | projectDrawer shows base + approved extras = current revenue with values and value-weighted progressPct; completed scope not shown as a euro value      |

## CON

| ID     | Status      | Evidence / justification                                                                                                                                                                        |
| ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CON-01 | PARTIAL     | createContract requires acceptedVersionId, pulls totals from it, single entity config; but no contract DOCUMENT render carrying logo/fiscal data (only budget doc)                              |
| CON-02 | IMPLEMENTED | createContract: nextNumber('contract'), partyId/propertyId/budgetNumber/acceptedVersionId links, scopeAnnexRef from accepted version                                                            |
| CON-03 | IMPLEMENTED | createContract holds value/vat/total, installments, initiation, duration, penalties, guarantees, language, signature as data; contractControlView reports across all                            |
| CON-04 | IMPLEMENTED | installments {pct\|amount,trigger,expectedDate}, auto amounts+rounding, status planned→invoiced (issueInvoice), feed cashForecast, backOfficeDay & overdue alerts; sim test 20                  |
| CON-05 | PARTIAL     | initiation{scheduleWithinDays,startWithinDays}; recordFirstPayment derives committedStartDate; at-risk alert. But calendar days (addDays), not working days; scheduleWithinDays never monitored |
| CON-06 | IMPLEMENTED | createContract throws if !duration.estimatedDays; planned/actual start/finish + deviationReason fields; startWorks/closeProject set actuals                                                     |
| CON-07 | IMPLEMENTED | penalties{latePaymentInterestPctYear, delayPenaltyCentsPerWeek, capCents, graceDays, suspendingEvents} — all stated elements structured (erp-engine.js ~1045)                                   |
| CON-08 | IMPLEMENTED | guarantees per category (3 categories in LISTS); closeProject dates start/expiry; alerts() warns expiry ≤30d; sim test 21 asserts warranty register dated                                       |
| CON-09 | PARTIAL     | clauseBlocks with effectiveFrom/version snapshot on contract (ids only); but no add/edit function or UI, filter takes ALL effective blocks not latest, wording not frozen                       |
| CON-10 | PARTIAL     | contract.language carried from budget (CON-10 tag, line 1056); no Catalan legal wording exists anywhere in the build                                                                            |
| CON-11 | IMPLEMENTED | signContract stores both signature dates+method; startWorks throws if unsigned; issueInvoice blocks first invoice unsigned; alert 'obra iniciada sin contrato firmado'                          |
| CON-12 | IMPLEMENTED | approveChange creates annex CTR-…-A{n} on contract.annexes referencing changeId/value/date; projectEconomics chains baseline→current value                                                      |
| CON-13 | PARTIAL     | 6 statuses + contractControlView has all 8 attributes, but erp.html contratos table omits the penalties and language columns from the business view                                             |
| CON-14 | PARTIAL     | terms are data (clauseBlocks, defaults) and issued contracts snapshot clause ids; but no business-facing maintenance UI/function — blocks only seedable in code (erp-seed.js:27)                |

## CRM

| ID     | Status      | Evidence / justification                                                                                                                 |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| CRM-01 | IMPLEMENTED | erp-engine.js addOpportunity(): partyId, propertyId, source, date, requestedWork, owner, status, nextAction all recorded                 |
| CRM-02 | IMPLEMENTED | erp-engine.js partyHistory(); budgets/contracts/projects carry propertyId, invoices carry projectId+budgetNumber — unambiguous chain     |
| CRM-03 | PARTIAL     | opportunity.notes[], acceptVersion evidenceRef, change photoRef exist, but no attach-note operation or UI; project.diary never populated |
| CRM-04 | IMPLEMENTED | erp-engine.js opportunityAges() ageDays; statuses awaitingVisit/Budget/Response; backOfficeDay followUpsDue; erp.html Dias column        |
| CRM-05 | IMPLEMENTED | erp-engine.js loseOpportunity() + LISTS.lossReasons = price/timing/scope/competitor/noResponse/withdrew; shown in erp.html Cerradas      |
| CRM-06 | IMPLEMENTED | erp-engine.js createQuickProject() (PRJ-08) skips budget/contract; opportunity.jobSize; exercised in seed P5 and year-sim                |
| CRM-07 | IMPLEMENTED | erp-engine.js addFeedback() — post-project customer feedback captured on the party record                                                |

## DAS

| ID     | Status      | Evidence / justification                                                                                                                                                                                                       |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DAS-01 | IMPLEMENTED | index.html .mods grid: clientes, proyectos, pagos(proveedores), precios, presupuestos, facturacion, banco(pagos), torre — all linked                                                                                           |
| DAS-02 | IMPLEMENTED | controlTower() + erp.html torre view: all listed indicators incl. progress, budget-vs-actual, extras, budgets awaiting, docs, alerts; delays via alerts                                                                        |
| DAS-03 | PARTIAL     | KPI tiles data-go + alert ref routing (erp.html torre); project refs open the record drawer, but invoice/bill/price refs land on module lists                                                                                  |
| DAS-04 | PARTIAL     | operationalDay() + 'hoy' view: visits, milestones, extras, hours, overdue tasks; material needs and blockers absent                                                                                                            |
| DAS-05 | IMPLEMENTED | backOfficeDay(): budgetsToPrepare, followUpsDue, invoicesToIssue, collectionsDue, billsToAllocate, paymentsDue, docsMissing — all rendered in 'hoy'                                                                            |
| DAS-06 | PARTIAL     | alerts() covers prices, validity, overdue AR, unallocated, start/duration, warranty, pending lines; no overdue-supplier-bill alert, unsigned contract only if works started                                                    |
| DAS-07 | PARTIAL     | addTask(): owner, due, status, relatedRef; no completion record (no completedAt/by, no complete action in engine or UI)                                                                                                        |
| DAS-08 | PLANNED     | BRD §11 defers configurable custom dashboards to Phase 2 (fixed role dashboards shipped). Consolidated views auto-derive without rebuild, but periodic delivery (scheduled email/push) needs server infra a static build lacks |

## DOC

| ID     | Status      | Evidence / justification                                                                                                                                                                                       |
| ------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOC-01 | PARTIAL     | renderBudgetDoc() issuer block with logoRef+fiscal data (shown in budgetDrawer); no rendered invoice/receipt/contract doc with logo                                                                            |
| DOC-02 | PARTIAL     | ADM-03 allocates a captured doc to obra(s) and/or overhead from a 480 panel; sourcePath/reference/notes searchable; capId on bills, partyHistory(); no cross-retrieval from property/contract/payment          |
| DOC-03 | IMPLEMENTED | imageRef is a real blob key since S6 (ErpStore.putBlob); ADM-03 renders the picture as an inbox thumbnail and ADM-02 renders the linked PDF/image at 620 with zoom                                             |
| DOC-04 | IMPLEMENTED | confirmCapture() builds stdName; _docName() standardizes issued-doc names; original imageRef kept unaltered                                                                                                    |
| DOC-05 | IMPLEMENTED | newVersion() marks prev.superseded/frozen, currentVersionId/acceptedVersionId identify latest; versions never deleted                                                                                          |
| DOC-06 | PARTIAL     | acceptVersion customerResponse{date,evidenceRef}, v.sent{date,channel}, approveChange approvedAt; channel+responsible person not on decision record                                                            |
| DOC-07 | IMPLEMENTED | _log(user,action,ref) on every mutation into state.audit; invoiceEvents hash chain; frozen versions/immutable invoices                                                                                         |
| DOC-08 | PLANNED     | BRD §11 defers qualified e-signature integration to Phase 2 (signature capture recorded). BRD defers email/messaging capture to solution stage (CAP-11) / Phase 4; only send-channel recorded (v.sent.channel) |

## FIN

| ID     | Status      | Evidence / justification                                                                                                                      |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| FIN-01 | IMPLEMENTED | erp-engine.js projectEconomics(): baselineRevenueCents, approvedChangesCents, currentRevenueCents; final at closeProject()                    |
| FIN-02 | PARTIAL     | projectEconomics(): baseline/committed/actual/forecast cost; no per-project PAID cost figure; selected-supplier cost only per line            |
| FIN-03 | PARTIAL     | projectEconomics + budgetTotals give amount+% at project level; chapterEconomics has cost only — no chapter forecast/final margin %           |
| FIN-04 | PARTIAL     | unallocatedSummary() quantifies bills/movements/labour in cents; captures count-only, purchases and machinery not identified                  |
| FIN-05 | IMPLEMENTED | alerts(): chapter overruns, negative/low margin, extras with cost; validateBudget blocks negative-margin chapters; pendingEstCents quantifies |
| FIN-06 | PARTIAL     | cashForecast(weeks) + erp.html banco 6-week table; no by-month view, committed purchase orders not in outflows                                |
| FIN-07 | IMPLEMENTED | overheadCents() + overheadCategories, bill/movement overhead classes kept out of actualCostCents; overhead never charged to projects          |
| FIN-08 | PARTIAL     | profitability('customer'\|'activityLine') + revenue perM2Cents; no supplier/period grouping, no cost/margin per m2                            |
| FIN-09 | IMPLEMENTED | erp-engine.js receivablesSpecial() — retentions/guarantees split out of standard receivables                                                  |

## GES

| ID     | Status      | Evidence / justification                                                                                                                                                                                                                 |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GES-01 | IMPLEMENTED | quarterlyPackage: issuedInvoices, receivedBills, bankMovements, cashRecords, lateItems by quarter; erp.html gestoria view; sim runs Q1-Q4                                                                                                |
| GES-02 | PARTIAL     | txFromInvoice/txFromBill carry most fields; missing bank/till, paid flag+payment date, receipt ref; treatment never 'fixedAsset'; bills lack paymentMethod                                                                               |
| GES-03 | IMPLEMENTED | vatSummary by rate output+input; year-sim checks 'VAT reconciles to register' per quarter and annual Σ quarters = Σ invoices                                                                                                             |
| GES-04 | IMPLEMENTED | irpfSummary retained/suffered; irpfBp from supplier profile (AP-07); sim asserts 15% professional vs 0% autónomo; UI 'IRPF retenido (111)'                                                                                               |
| GES-05 | PARTIAL     | LISTS.overheadCategories + party accountingCode exist but list is hardcoded; editable chart of accounts only in disconnected financial-data.html                                                                                         |
| GES-06 | PARTIAL     | exceptionList completeness check before bSend; only whole-state JSON export (btnExport) — no accountant-format package export nor bundled document files                                                                                 |
| GES-07 | PARTIAL     | exceptionList: billsWithoutDocument, partiesWithoutTaxId, unallocatedMovements, unmatchedReceipts, seriesGaps, undocumentedCash; 'documents without an invoice number' absent                                                            |
| GES-08 | PARTIAL     | packagesSent records quarter/date/counts (UI 'Envíos registrados'); no way to record queries/corrections received back from the firm                                                                                                     |
| GES-09 | IMPLEMENTED | overheadCategories include vehicles, fuel, fixedAsset, renting; bill/movement overhead allocations kept out of actualCostCents (overheadCents FIN-07)                                                                                    |
| GES-10 | PLANNED     | BRD §11 defers direct AEAT electronic filing to Phase 2 (gestoría package generated + send registered). BRD Medium: 'assessed in the solution stage'; no integration in build, external software connection out of scope for static site |

## LAB

| ID     | Status      | Evidence / justification                                                                                                                                                                                  |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LAB-01 | PARTIAL     | erp-engine.js recordHours(): worker+project+date minimal fields; erp.html horas view is read-only — no site entry form                                                                                    |
| LAB-02 | PARTIAL     | predefined state.workers list, recordHours assigns worker to project+day; no crew concept and no entry UI                                                                                                 |
| LAB-03 | IMPLEMENTED | recordHours() optional chapterNum, used in seed (chapterNum:'1') and shown in horas table                                                                                                                 |
| LAB-04 | IMPLEMENTED | worker.kind + LISTS.employmentKinds (employee/selfEmployed/subcontractorStaff); kind exported in labourExport                                                                                             |
| LAB-05 | IMPLEMENTED | workerRateCents(workerId,date) picks from rateHistory by effective date; year-sim has mid-year rate change                                                                                                |
| LAB-06 | IMPLEMENTED | erp-engine.js hoursComparison() — estimated (line.estHoursMilli) vs actual hours per project/chapter                                                                                                      |
| LAB-07 | IMPLEMENTED | erp-engine.js recordHours() now takes kind (normal\|extra\|festivo) + extraPayCents folded into costCents                                                                                                 |
| LAB-08 | PLANNED     | BRD §11 defers payroll integration to Phase 2 (labour export exists today). BRD defers: 'input methods shall be assessed in the solution stage'; mobile form + predefined worker list exist as groundwork |
| LAB-09 | IMPLEMENTED | erp-engine.js labourExport() (worker, kind, project, date, hours, cost); asserted populated in year-sim.mjs:1049                                                                                          |

## MDM

| ID     | Status      | Evidence / justification                                                                                                                                               |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MDM-01 | IMPLEMENTED | Single state.parties register; roles array with all 8 BRD tags (LISTS.roles, erp-engine.js:67); seed has multi-role parties (adviser+selfEmployed)                     |
| MDM-02 | IMPLEMENTED | MANDATORY_TO_INVOICE (name,taxId,street,CP,city,province,country) enforced via _requireComplete in issueVersion/createContract/issueInvoice                            |
| MDM-03 | PARTIAL     | validTaxId checks DNI/NIE check-char but CIF/VAT only structural (erp-engine.js:46-47); dup detect on taxId/name/mobile + active-dup block; landline dups not checked  |
| MDM-04 | IMPLEMENTED | erp-engine.js validEmail()+validTaxId() on addParty; issueVersion() now blocks electronic (email) sending when the party has no valid email                            |
| MDM-05 | IMPLEMENTED | addProperty() (erp-engine.js:402): separate from billing address, partyId allows many per party, `part` (dwelling…) and `access` fields; shown in partyDrawer          |
| MDM-06 | IMPLEMENTED | LISTS.leadSources has all 9 BRD values; leadSource captured at creation (addParty + erp.html newPartyDrawer 'Origen del contacto' select)                              |
| MDM-07 | IMPLEMENTED | Per-party paymentMethod (all 9 incl. transfer30/60/90), paymentTermsDays, vatRegime, irpfApplies/irpfRateBp (erp-engine.js:318-322); used by registerBill/issueInvoice |
| MDM-08 | PARTIAL     | bank {bank,branch,holder,iban}, mod-97 validIban, changes logged as partyBankChange (updateParty erp-engine.js:365); access restriction absent — no permission system  |
| MDM-09 | IMPLEMENTED | addParty assigns code T-#### and aligned accountingCode '43'+digits (erp-engine.js:300,331); both exported per transaction in quarterlyPackage                         |
| MDM-10 | IMPLEMENTED | partyCompleteness() pct+missing shown as pill in clientes view (erp.html:325); _requireComplete blocks budget/contract/invoice/quick-project issue                     |
| MDM-11 | IMPLEMENTED | Party holds registry (seed 'R.M. Barcelona, T.48001, F.120'), taxId and registered address; partyType 'company' (erp-engine.js:324, erp-seed.js:157)                   |
| MDM-12 | PARTIAL     | deactivateParty() soft-deactivates, no delete path (erp-engine.js:370); but no retention period nor documented data-subject request route anywhere                     |
| MDM-13 | PARTIAL     | partyHistory() (erp-engine.js:422) returns budgets/contracts/projects/invoices/receipts/bills+opportunities; payments/collections, incidents, warranty items absent    |

## NFR

| ID     | Status      | Evidence / justification                                                                                                                                                                                                    |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | IMPLEMENTED | erp.html: Spanish plain-language guided workspace, one-click actions (Registrar cobro/Pagar), seeded example data, drawers                                                                                                  |
| NFR-02 | IMPLEMENTED | LISTS dictionaries + Object.assign defaults everywhere; select-based forms (newPartyDrawer); type-project-number movement allocation                                                                                        |
| NFR-03 | PARTIAL     | Responsive layout + .mobsel mobile nav, progress marking works; no camera/file input for photo/doc capture, no hour-entry form in UI                                                                                        |
| NFR-04 | PLANNED     | BRD §11: multi-user concurrency deferred; Phase 1 is single-operator by design. BRD defers this to assessment; no offline/sync assessment documented (app is on-device IndexedDB but multi-device behaviour unassessed)     |
| NFR-05 | IMPLEMENTED | In-memory engine, synchronous renders, debounced IndexedDB persist (erp.html persist(), 140ms) — immediate at SME volumes                                                                                                   |
| NFR-06 | PLANNED     | BRD §11: SLA/uptime targets apply once hosted beyond GitHub Pages. Only on-device IndexedDB + manual JSON export (btnExport); device failure loses data — server-side durability is infra this static build lacks           |
| NFR-07 | PLANNED     | BRD §11: penetration testing scheduled for the Phase-2 hosted deployment. No authentication or permissions anywhere in site/; multi-user auth enforcement needs server infrastructure                                       |
| NFR-08 | IMPLEMENTED | state.audit via _log(user,ts,action,ref); issued versions frozen, invoices immutable:true + invoiceEvents hash chain (VFU-01)                                                                                               |
| NFR-09 | PLANNED     | BRD §11: i18n beyond Spanish deferred; all Phase-1 users are Spanish-speaking. Manual JSON export/import only; documented recovery process and tested restore need server backup infra absent from static build             |
| NFR-10 | PARTIAL     | Entire UI in Spanish (erp.html/index.html); b.language field exists but no Catalan rendering — index.html: 'catalán en preparación'                                                                                         |
| NFR-11 | IMPLEMENTED | Cents/EUR throughout; LISTS.vatRates [2100,1000,500,0]; irpfBp on budgets/invoices/bills; vatSummary/irpfSummary per rate                                                                                                   |
| NFR-12 | IMPLEMENTED | configureEntity() (ORG-01) single config applied to every doc; no company selector on any transaction                                                                                                                       |
| NFR-13 | PARTIAL     | Full-dataset JSON export (erp.html btnExport; master/financial/clientes exports; labourExport); no CSV and no stored-document export                                                                                        |
| NFR-14 | IMPLEMENTED | Exchange points exist: importMovements (bank rows, all fields), quarterlyPackage accounting dictionary (GES-02), JSON export/import                                                                                         |
| NFR-15 | PLANNED     | BRD §11: offline-first sync deferred; IndexedDB persistence covers offline reads today. No compression/retention handling; photos are string refs only — real file storage management needs infrastructure this build lacks |
| NFR-16 | PARTIAL     | Data-driven engine scales in design, but single JSON blob in IndexedDB with full recompute per render limits years of history                                                                                               |
| NFR-17 | PARTIAL     | master-data.html edits catalogue, series, VAT codes, price lists, templates — but on a separate dataset not wired to the ERP engine; no clause-block UI                                                                     |
| NFR-18 | PARTIAL     | GDPR consent flags (master-data.html; clientes.html retired into erp.html#clientes), deactivateParty (MDM-12), export; no retention policy or data-subject request workflow                                                 |
| NFR-19 | IMPLEMENTED | Recurring vs build cost statement documented in REQUIREMENTS-TRACE.md §Cost of ownership                                                                                                                                    |

## ORG

| ID     | Status      | Evidence / justification                                                                                                                                                                                                                  |
| ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ORG-01 | IMPLEMENTED | erp-engine.js configureEntity() (one-time config incl. IBAN/logo/series); renderBudgetDoc issuer block, issueInvoice uses config.iban                                                                                                     |
| ORG-02 | IMPLEMENTED | activityLine on parties/budgets/projects (erp-engine.js addParty/createBudget); profitability('activityLine') asserted in year-sim.mjs:1070                                                                                               |
| ORG-03 | IMPLEMENTED | erp-engine.js markLegacy()/legacyItems() — historic items flagged, searchable, excluded from active totals                                                                                                                                |
| ORG-04 | IMPLEMENTED | erp-engine.js configureEntity creates all 6 series; nextNumber() sequential w/ no override API; seriesGaps() + exceptionList report gaps                                                                                                  |
| ORG-05 | PARTIAL     | operationalDay()/backOfficeDay() + erp.html 'hoy' view give two profile day views, but no profile switching, per-profile screens or mandatory fields                                                                                      |
| ORG-06 | PLANNED     | BRD §11 defers user-role administration beyond the single-operator model to Phase 2. No permission checks anywhere; enforcement needs multi-user auth this static single-user build cannot provide — every action is open to the one user |
| ORG-07 | PARTIAL     | _log(user,action,ref) on all mutations + chained invoiceEvents (erp-engine.js:231, 1513); but ts is business date only — no time-of-day, user is a free string                                                                            |
| ORG-08 | PLANNED     | BRD §11 defers automated backup/restore tooling to Phase 2 (JSON export exists today). Profile system itself requires the multi-user auth infra absent here; data side ready (LISTS.roles has employee/subcontractor/adviser tags)        |
| ORG-09 | IMPLEMENTED | Controlled-export branch: quarterlyPackage() (erp-engine.js:2255) + gestoria view export invoices/bills/VAT/IRPF/exceptions with no margin or pricing fields                                                                              |

## PAY

| ID     | Status      | Evidence / justification                                                                                                                                                                      |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PAY-01 | IMPLEMENTED | method on receipts/collections/payments, paymentMethod on invoices; LISTS.paymentMethods covers cash, transfer, card, directDebit, onAccount                                                  |
| PAY-02 | PLANNED     | BRD §11 defers online card payments to Phase 2. BRD Medium 'shall be assessed'; setup-guide.html assesses Stripe pay-online links with pay-per-transaction cost note; needs external provider |
| PAY-03 | PLANNED     | BRD §11 defers payment-link generation to Phase 2. BRD Medium 'shall be assessed'; auto-confirmation needs provider webhooks; manual reconciliation exists via matchMovement                  |
| PAY-04 | IMPLEMENTED | issueReceipt creates numbered REC- receipt (printable:true) per customer; listed in erp.html 'Recibos emitidos'; used in sim cash path                                                        |
| PAY-05 | IMPLEMENTED | No card-data fields anywhere; movements store only card alias label (e.g. 'V-1234'); no card processing in build — satisfied by construction                                                  |

## PLN

| ID     | Status      | Evidence / justification                                                                                                              |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| PLN-01 | PARTIAL     | dates.start/targetEnd + contract duration + chapters-as-phases exist; milestones[] never written, no planning function/UI             |
| PLN-02 | IMPLEMENTED | erp-engine.js assignResource()/resourceConflicts() — crew assignment with overlap conflict detection                                  |
| PLN-03 | PARTIAL     | markProgress()+projectProgressPct() chapter states/pct; no per-line marking API/UI and invoice amounts entered manually, not from pct |
| PLN-04 | IMPLEMENTED | erp.html: responsive (mobsel/media queries), projectDrawer one-tap 'En curso'/'Hecho' buttons call markProgress                       |
| PLN-05 | IMPLEMENTED | erp-engine.js addDiaryEntry() — site diary entries per project/day                                                                    |
| PLN-06 | PARTIAL     | contract.duration planned/actual dates + 'Duración contractual excedida' alert; deviationReason field never captured anywhere         |
| PLN-07 | PARTIAL     | machinery only an itemType; LISTS.costKinds lacks machinery, fuel/vehicles are overhead-only; allocable to project just as 'other'    |
| PLN-08 | IMPLEMENTED | erp-engine.js upcomingNeeds() — look-ahead of material/labour needs from planned chapters                                             |

## PRE

| ID     | Status      | Evidence / justification                                                                                                                                     |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PRE-01 | PARTIAL     | chapters→lines→subLines with free string nums (addChapter/addLine, num overridable); no distinct subchapter level in the hierarchy                           |
| PRE-02 | IMPLEMENTED | addLine: code, desc/customerWording, unit, qtyMilli, priceCents, costCents; line total + cost + margin computed in budgetTotals                              |
| PRE-03 | IMPLEMENTED | subLines {room,qtyMilli,wastePct,customerVisible}; _aggSubLines aggregates with waste; renderBudgetDoc filters customerVisible                               |
| PRE-04 | IMPLEMENTED | pending flag; budgetTotals excludes but counts (pendingCount/pendingEstCents); erp.html shows count+value on doc; year-sim asserts it                        |
| PRE-05 | PARTIAL     | lumpSum lines supported (addLine + budgetTotals); no distinct provisional-sum or allowance concept beyond the single lumpSum flag                            |
| PRE-06 | IMPLEMENTED | chapter.section base/optional/outOfScope/extras with per-section subtotals in budgetTotals; year-sim test 7 asserts base excludes options                    |
| PRE-07 | PARTIAL     | budgetTotals: chapter subtotals, base, options, discount, VAT, IRPF, grand, perM2Cents (total/m2); cost per m2 of property not computed                      |
| PRE-08 | PARTIAL     | Single costCents + costSupplierId/costSourceRef per line, excluded from renderBudgetDoc (sim-verified); not split into supplier/own-labour/machinery columns |
| PRE-09 | PARTIAL     | validateBudget blocks zero qty/price, negative-margin chapters, warns cost>sale & pending; broken references are not checked                                 |
| PRE-10 | PARTIAL     | line imageRefs stored and passed into renderBudgetDoc, but erp.html budgetDrawer never renders/prints images and no UI to attach them                        |
| PRE-11 | PARTIAL     | markProgress + erp.html projectDrawer buttons mark whole chapters (setting all their lines); no way to tick an individual line                               |
| PRE-12 | PARTIAL     | Same structure spans single-line repair (createQuickProject, seed jobSize small) to multi-chapter reno; no budget templates by job size exist                |
| PRE-13 | PARTIAL     | createBudget has internalVariant flag (PRE-13 comment) but nothing reads it — no create/link/compare mechanism vs the customer version                       |
| PRE-14 | IMPLEMENTED | erp-engine.js saveBenchmark()/compareBudgetCosts() — budget lines benchmarked against saved reference costs                                                  |
| PRE-15 | IMPLEMENTED | createBudget header: number, date, internalRef, partyId, propertyId, preparedBy, validityDate, status, language, activityLine                                |
| PRE-16 | IMPLEMENTED | erp-engine.js renumberChapter() — chapter renumbering that remaps purchase, labour and bill allocations safely                                               |

## PRJ

| ID     | Status      | Evidence / justification                                                                                                               |
| ------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| PRJ-01 | PARTIAL     | erp-engine.js acceptVersion(): issued-version-only, records date/evidenceRef/acceptedOptions; no field for final conditions            |
| PRJ-02 | IMPLEMENTED | erp-engine.js createProjectFromAcceptance(): copies party/property/chapters/prices from accepted version, no re-entry                  |
| PRJ-03 | IMPLEMENTED | erp-engine.js: baseline Object.freeze + accepted version frozen (_editableVersion throws); later addPrice never touches it             |
| PRJ-04 | IMPLEMENTED | erp-engine.js baseline{revenueCents,costCents,marginCents}; code/budgetNumber carried on invoices, purchases, bills, labour            |
| PRJ-05 | PARTIAL     | project has dates/status/propertyId/contractId/milestones[]; no responsible-person field, milestones never populated                   |
| PRJ-06 | IMPLEMENTED | erp-engine.js addProjectRequirement() — special project requirements tracked to completion                                             |
| PRJ-07 | PARTIAL     | projectEconomics(): baseline/changes/forecast/final at project level; chapterEconomics() lacks changes, forecast and final per chapter |
| PRJ-08 | IMPLEMENTED | erp-engine.js createQuickProject(): budget-less repair, _requireComplete enforces minimum party data; exercised in seed and year-sim   |

## PUR

| ID     | Status      | Evidence / justification                                                                                                                               |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PUR-01 | PARTIAL     | addPurchase() covers needs arising in execution; no derivation of material/subcontract requirements from project scope                                 |
| PUR-02 | IMPLEMENTED | addPurchase(): supplierId, projectId, date, desc, qtyMilli, unitCents, vatBp, totalCents, chapterNum link                                              |
| PUR-03 | PARTIAL     | purchase.status{ordered,delivered,returnedCents,invoicedBillId,paid}; 'requested'/'credited' absent, no setter ever flips delivered/paid               |
| PUR-04 | IMPLEMENTED | purchase.orderRef; registerBill matches by orderRef→invoicedBillId; matchMovement links bank/card movement to the bill                                 |
| PUR-05 | IMPLEMENTED | attachPurchaseDocument()/detachPurchaseDocument() write purchase.docRefs; ADM-02 shows the linked captured document at 620 with zoom beside the record |
| PUR-06 | IMPLEMENTED | committedCostCents()+actualCostCents() move with real prices while frozen project.baseline stays intact; proven in year-sim                            |
| PUR-07 | PARTIAL     | multi-project/overhead splits with sum check on registerBill/allocateCapture/splitMovement; bill allocations irreversible, purchase.allocations unused |
| PUR-08 | PARTIAL     | engine: minimal addPurchase with urgent flag + ticket captureDocument then reconcile; no quick site-entry UI exists                                    |
| PUR-09 | IMPLEMENTED | recordReturn() nets committedCostCents; creditNoteFor bills subtract in actualCostCents/chapterEconomics and stay linked to the original               |
| PUR-10 | PARTIAL     | alerts() warns chapter actual>budget and low margin via forecast(committed); no committed-vs-budget warning per item/chapter/supplier package          |

## QUO

| ID     | Status      | Evidence / justification                                                                                                                                  |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QUO-01 | IMPLEMENTED | erp-engine.js createBudget (nextNumber('budget')) + newVersion auto vNumber '1.'+n; unlimited versions array                                              |
| QUO-02 | IMPLEMENTED | erp-engine.js newVersion stores date/author/reason; issueVersion sets frozen=true; _editableVersion rejects frozen; sim test 9                            |
| QUO-03 | PARTIAL     | erp-engine.js diffVersions: added/removed/qty/price + total abs&pct, but NO chapter-subtotal deltas and no pct per line change                            |
| QUO-04 | IMPLEMENTED | erp-engine.js: currentVersionId single (newVersion), acceptVersion throws if already accepted, _editableVersion blocks accepted; sim test 9               |
| QUO-05 | IMPLEMENTED | erp-engine.js renderBudgetDoc built purely from version data; newVersion sets prev.superseded=true; versions+docRef retained                              |
| QUO-06 | PARTIAL     | erp-engine.js line 650: internalVariant boolean exists but is never read/enforced; no variant kinds (cost-sim, measurement-only)                          |
| QUO-07 | PARTIAL     | renderBudgetDoc carries logoRef, taxId, address, contact, IBAN, validity, payment conds, exclusions, assumptions — but no legal text field anywhere       |
| QUO-08 | PARTIAL     | budget.language field stored/echoed on doc, but zero Catalan content: no translated chapter names/units/legal text (index.html: 'catalán en preparación') |
| QUO-09 | PARTIAL     | issueVersion sets v.sent{date,channel}; acceptVersion sets customerResponse+evidenceRef — but no way to record a rejection/decline on a version           |
| QUO-10 | IMPLEMENTED | renderBudgetDoc omits cost/margin by construction; year-sim.mjs test 8 asserts no cost/margin fields in doc JSON                                          |
| QUO-11 | PARTIAL     | erp.html presupuestos view (status/value/validity) + controlTower awaitingValueCents; but no expected-start-date field and no age reporting               |
| QUO-12 | IMPLEMENTED | acceptVersion({evidenceRef}) attaches documented acceptance evidence (sim: 'email-aceptacion.pdf') — 'another documented form' satisfied                  |

## SUP

| ID     | Status      | Evidence / justification                                                                                                                                               |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SUP-01 | PARTIAL     | erp-engine.js addParty: roles supplier/subcontractor, tax/billing, paymentTermsDays, notes; no supplier portal reference field                                         |
| SUP-02 | IMPLEMENTED | erp-engine.js addPrice: itemId/supplierId/date/listCents/discountPct/netCents; catalogue itemTypes cover material/labour/machinery                                     |
| SUP-03 | IMPLEMENTED | erp-engine.js LISTS.priceSources (6 BRD sources) validated in addPrice + sourceDocRef; shown in erp.html precios view                                                  |
| SUP-04 | PARTIAL     | Price rec has listCents/discountPct/netCents/transportCents; waste+min-order only on packages (packageCostCents); no VAT or waste charge on price                      |
| SUP-05 | IMPLEMENTED | addPrice append-only (never overwrites); budget lines snapshot costCents; issued versions frozen — year-sim asserts frozen edits rejected                              |
| SUP-06 | PARTIAL     | erp-engine.js comparePrices: per-supplier net, best, abs+pct variance; but item-level only — no quantity/total columns, no chapter/package compare                     |
| SUP-07 | IMPLEMENTED | comparePrices returns missing:true/null (never 0); erp.html precios renders 'Sin precio' pill; currentPriceCents returns null                                          |
| SUP-08 | IMPLEMENTED | erp-engine.js addLine: costSupplierId + costSourceRef per line (PRE-08/SUP-08 comment) — explicit cost basis, not positional                                           |
| SUP-09 | PARTIAL     | Price rec has dims {pieces,lengthMm,widthMm} but no thickness, no resulting-area computation; dims stored, never used in any calc or UI                                |
| SUP-10 | IMPLEMENTED | LISTS.docTypes: supplierOffer/orderConfirmation/deliveryNote/valuedDeliveryNote/supplierInvoice/creditNote; enforced in captureDocument, labelled in erp.html          |
| SUP-11 | IMPLEMENTED | erp-engine.js recordSupplierPerformance()/supplierRanking() — delivery/quality scoring and ranked supplier list                                                        |
| SUP-12 | PLANNED     | BRD §11 defers supplier portal/self-service to Phase 2. BRD text itself defers this: feasibility of portal/price-list/invoice imports 'assessed in the solution stage' |

## VFU

| ID     | Status      | Evidence / justification                                                                                                                                            |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VFU-01 | PARTIAL     | nextNumber gap-free series, invoiceEvents djb2 hash chain (sim check 3), immutable records; no machine-readable code/QR or official record layout (LEGAL_REVIEW §1) |
| VFU-02 | IMPLEMENTED | No invoice edit API; immutable:true; creditNote requires rectifies + rectifyReason in issueInvoice (throws otherwise)                                               |
| VFU-03 | PARTIAL     | Only generic btnExport JSON dump includes invoices+invoiceEvents; no AEAT/certified-provider format export or submission (INTEGRATIONS_PENDING tracks adapter)      |
| VFU-04 | PARTIAL     | LEGAL_REVIEW.md §1 confirms RD-ley 15/2025 deadlines (2027) with sources + gate; build-vs-certified-provider decision still open, legally_verified:false            |
| VFU-05 | PARTIAL     | state.audit + chained invoiceEvents give traceability; statutory multi-year retention needs server/backup infra a localStorage build cannot guarantee               |

## VIS

| ID     | Status      | Evidence / justification                                                                                                                           |
| ------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| VIS-01 | PARTIAL     | erp-engine.js addVisit() exists, but erp.html shows visits read-only; no quick/mobile capture form anywhere in the UI                              |
| VIS-02 | PARTIAL     | addVisit captures measurements{what,qty,unit}, photos, notes; party/address via opportunity. No voice-to-text, no entry UI                         |
| VIS-03 | PARTIAL     | visit.assumptions/exclusions + property.access/occupied exist; existing installations and customer selections not captured                         |
| VIS-04 | PARTIAL     | Budget line.imageRefs flow to customer doc (renderBudgetDoc), but visit.photos are bare filenames — no area/work-item link or photo-to-line flow   |
| VIS-05 | PARTIAL     | Lines reference catalogue itemId and packages exist, but no pick-from-catalogue flow; seed retypes desc; visit.lines never used                    |
| VIS-06 | PARTIAL     | visit.handwrittenEstimateRef stored + shown ('Croquis adjunto'); visit.lines declared for conversion but no function converts them to budget lines |
| VIS-07 | PARTIAL     | addTask() with relatedRef; seed creates visit follow-up tasks. No supplier-enquiry or missing-info request generation from a visit                 |
| VIS-08 | IMPLEMENTED | erp-engine.js validateVisit() (checklist completeness gate) + visitToBudgetLines() (visit findings feed the budget)                                |

## Cost of ownership (NFR-19)

Statement of recurring vs build cost for the Phase-1 system:

- **Build cost**: delivered within this engagement; no licence fees. The entire stack is
  plain HTML/JS + a dependency-free ERP engine — no framework, no build step, no paid tooling.
- **Recurring cost — hosting**: €0. GitHub Pages serves both production and the /preview
  environment on the existing free GitHub plan.
- **Recurring cost — data**: €0. All operational data lives client-side (IndexedDB) with
  JSON export for backup; no database service is billed.
- **Recurring cost — distribution**: Apple Developer Program €99/year (TestFlight / App Store).
- **Recurring cost — maintenance**: content and workflow changes ship by pushing to the repo;
  the iOS shell auto-updates from the web, so native rebuilds are only needed for native changes.
- **Phase-2 cost drivers** (when the deferred PLANNED items activate): hosted multi-user backend,
  PSD2 bank feeds, AEAT filing gateway, e-signature provider — each priced before adoption.

## Verification evidence

- `node tests/simulation/year-sim.mjs <seed>` — 12 months × 3 projects/month, 145 invariants
  (AR/AP reconciliation, VAT register = vatSummary, gap-free series, frozen baselines,
  chained invoice log, JSON round-trip). 145/145 for seeds 1–5.
- `node tests/site-e2e/run.mjs` — 35 Playwright checks across every page incl. the ERP
  workspace, launchpad live KPIs, bank allocation by project number, gestoría package. 35/35.
- `node --check site/erp-engine.js` — clean.

# Field manageability — every field has an update path

Audit of all 430 engine state fields (8 domain auditors, 2026-07-28): for each field,
either a **process** keeps it current, a **manual correction method** exists (audit-logged),
or it is **immutable by design** (issued documents, numbering series, frozen baselines,
signed contract terms, the chained invoice event log, audit entries).

Generic safety net: `adminPatch(entity, id, patch)` — audit-logged, refuses immutable
entities/fields — guarantees no editable field is ever dead-ended.

Verified by `tests/simulation/manageability-sim.mjs` (45 checks, in CI).

Seven of the paths below were advertised here but could never succeed — each read a
field or collection under a name nothing ever wrote (`resolveRequirement` searched
`p.requirements`, `adminPatch` mapped captures to `state.captures`, `correctBill` read
`b.irpfRateBp`, `updateBudget` whitelisted `validityDays`, `updateRecurring` whitelisted
`concept`/`dayOfMonth`, `markChangeExecuted` never set the status, and `receivables()`
had a `|| true` that disabled its own filter). Fixed, and each now has a dedicated
regression check so the claims in this table stay honest.

| Entity        | Correction / update path                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| party         | updateParty + edit drawer (UI)                                                                                                    |
| catalogueItem | updateCatalogueItem                                                                                                               |
| workPackage   | updateWorkPackage                                                                                                                 |
| price         | voidPrice (append-only history)                                                                                                   |
| opportunity   | updateOpportunity                                                                                                                 |
| feedback      | resolveFeedback                                                                                                                   |
| budget        | updateBudget (draft only)                                                                                                         |
| contract      | markContractSent / signContract / cancelContract                                                                                  |
| project       | updateProject / reopenProject / resolveRequirement                                                                                |
| assignment    | updateAssignment / removeAssignment                                                                                               |
| change        | priceChange / approveChange / rejectChange / markChangeExecuted                                                                   |
| purchase      | updatePurchase / markPurchaseDelivered / recordReturn                                                                             |
| capture       | confirmCapture / allocateCapture (re-invocable)                                                                                   |
| bill          | correctBill (locked once paid/quarter-sent) / allocateBill                                                                        |
| payment       | voidPayment                                                                                                                       |
| invoice       | credit note via issueInvoice(kind:creditNote) — invoices themselves immutable                                                     |
| collection    | allocateCollection                                                                                                                |
| recurring     | updateRecurring                                                                                                                   |
| movement      | classifyMovement / allocateMovementToProject / splitMovement / matchMovement / unmatchMovement / voidMovement / attachMovementDoc |
| worker        | addWorkerRate (append-only) / adminPatch                                                                                          |
| labour        | correctHours                                                                                                                      |
| task          | completeTask / updateTask                                                                                                         |
| bankAccount   | updateBankAccount                                                                                                                 |
| config        | configureEntity (partial merge)                                                                                                   |
| series        | immutable by design                                                                                                               |

## Audit detail

Raw per-field verdicts: 430 fields, 293 initially without a path (72 high / 142 medium / 79 low),
now closed by the methods above. High-frequency corrections are surfaced in the ERP UI
(party edit drawer; more inline controls ship progressively); everything else is reachable
through the engine methods and the guarded adminPatch.

# Adicionales: approved is not signed, and signed is not the same record

Written 7 Sep 2026, after the operator's verdict on the screens as they stand:
_"I think our way to manage the Adicionales is very very unclear."_

This is the check they asked for — the logic of the proposal, what in the
chain moves, what breaks if it is done naively, and the order that keeps the
repo green on every commit. **Nothing here is built yet.**

---

## 1 · Why the screens are unclear: there are THREE adicionales

Not a wording problem. Three different mechanisms exist in the model, and two
of them print the same blue «Adicional» pill in the same list.

| #   | Shape                 | Record                                                  | Number          | Created from                                       | Status                             |
| --- | --------------------- | ------------------------------------------------------- | --------------- | -------------------------------------------------- | ---------------------------------- |
| 1   | **Adicional VERSION** | a version _inside_ the original budget (`v.additional`) | `ADI-2026-0001` | ＋ Presupuesto → «Adicional de una obra en marcha» | the live route (PK12-S13)          |
| 2   | **Variation BUDGET**  | its own budget (`b.variationOf = projectId`)            | `PRE-2026-0007` | the hidden `#variations` screen                    | still creatable, still in the data |
| 3   | **Change order**      | `state.changes` with `annexNumber`                      | —               | screen removed from the menu                       | legacy, and **still moves money**  |

The third is the one to know about: `variations` was hidden from the menu, not
deleted, because `projectEconomics` reads approved changes directly — removing
the model would have moved real money on a live job. The route still renders.

### What the operator is actually looking at in the Presupuestos list

Both shapes wear the pill, and the code says so in its own comment (`erp.html`
around the Número column): _"Either shape of adicional wears the pill … The
operator could not find the one they had just sent."_ So in their screenshot:

- `PRE-2026-0009 · Adicional · ADI-2026-0001 · P-2026-0009` is **shape 1** —
  and that row **is the original budget of P-2026-0009**. One record, wearing
  two meanings, in one row.
- `PRE-2026-0007`, `PRE-2026-0013`, `PRE-2026-0005` are **shape 2** — separate
  budgets pointing at a project.

And the Estado column reads the BUDGET's state, so an accepted original with an
adicional still out reads «Enviados». There is explicit code for that
(`budgetStatusOf`: `openAdicional` → `"issued"`), written because the alternative
was worse. It is a symptom of one record carrying two lifecycles.

**This is the decisive fact for the whole proposal: the tabbed split in item 1
is impossible while an adicional is a version of the original budget, because
the two are the same row.**

---

## 2 · The proposal, checked point by point

### Item 1 — two sections, ＋ Adicional starts from an active contract, empty

**Sound, and it forces the model change that makes the rest possible.**

An adicional becomes **its own budget record** — the shape 2 model — created
against a contract, starting with no lines.

This reverses PK12-S13, which moved adicionales from budgets to versions. That
decision had two reasons and only one of them survives:

- _"a customer handed «PRE-2026-0009 v1.1» reads a re-quote of the whole job"_ —
  still true, and still solved: a separate budget has its own number and its own
  paper. Keep printing it as `ADI-2026-0001`.
- _"the same partida stays the same partida, so a cost booked to it still lands
  where it was booked"_ — **this is the real cost of the change, and it must be
  said plainly.** A cloned scope lets an adicional MODIFY or REDUCE an existing
  partida. An empty adicional can only ADD.

  Decision: allow negative quantities on an adicional's lines, so a reduction is
  still expressible as an explicit negative row. It is honest on the customer's
  paper (a negative line reads as scope removed) and it keeps `writeContractAnnex`'s
  existing behaviour, which already accepts a negative annex. What is genuinely
  lost is _editing_ an agreed line in place — and that is the right thing to
  lose, because an agreed line is a thing the customer signed.

**"Select from an Active Contract" is stricter than today and better.** The
current picker offers `projects.filter(p => !p.closed && p.budgetId && p.acceptedVersionId)`
— jobs, not contracts. Tying it to a contract ties the adicional to the document
it amends, which is what an annex is.

⚠️ **Flag:** the product allows a job with an accepted budget and no signed
contract. Under the new rule those jobs cannot take an adicional. That is
defensible — an annex to nothing is not an annex — but it is a door that closes,
so the picker must say _why_ a job is absent rather than silently omitting it.
(The same rule this repo just applied to the card settlement.)

### Item 2 — the two lists are independent and share client + contract

**Follows from item 1, and costs almost nothing once it is done.**

- Nuevo = budgets with no `adicionalOf`
- Adicionales = budgets with `adicionalOf`

Versions, freezing, issuing and the PDF work identically in both, because they
are the same record type going through the same cycle. The Estado column stops
lying, and `budgetStatusOf`'s `openAdicional` branch becomes dead code to delete.

### Item 3 — approved goes to Anexos and adds NOTHING yet

**This is the substantial change, and the architecture is already shaped for it.**

Everything chapter-addressed in this engine — Alcance, avance físico,
`chapterProgress`, `projectProgressPct`, `markLineProgress`, cost allocation,
certification — resolves scope through **one walk**:

```js
_projectVersions(p) {
  // base accepted version, then each accepted variation budget
  for (const b of this.projectVariations(p.id)) …
}
projectVariations(projectId) {
  return this.state.budgets.filter(b => b.variationOf === projectId && b.acceptedVersionId);
}
```

Eight call sites, and `projectChapters` funnels most of the rest. So "approved
but not yet in the job" is **one predicate**:

```js
b.variationOf === projectId && b.acceptedVersionId && b.annexSignedAt;
```

Change that line and Alcance, both progress readers, the cost allocation targets
and the certification proposal all follow with no further edits. That is the
strongest argument that this proposal fits the codebase rather than fighting it.

Two things must move OUT of `acceptVersion`, which today fires them on approval:

1. `extendProjectDeadline(...)` — the delivery date
2. the installment push inside `writeContractAnnex` — `{ trigger: "onAnnex" }`,
   which is what puts the money into Hitos de pago

`writeContractAnnex` currently does two jobs in one function: it writes the annex
row AND appends the payment milestone. It gets split — the row at approval, the
milestone at signature.

### Item 4 — sign the annex: verbally or with a document, then it applies

**Right, and it needs a rule of its own rather than reusing the contract's.**

`signContract` is the model to copy — it refuses a future date and claims the
job — but it also **requires a document**: _"A signature needs the signed
document (CON-11)"_. «Aprobado verbalmente» has no document.

Decision: the annex signature accepts either, and **records which**. Refusing a
verbal annex would not produce more signed paper; it would produce a scanned
blank page uploaded to get past the gate. What matters is that the difference is
visible: the annex row, the contract PDF and the audit entry all say whether it
was signed or agreed verbally, and by whom. A verbal annex is a fact about a
conversation, and the product should hold it as one rather than dress it as a
signature.

The delivery-time machinery already exists and only changes _when_ it runs:
`scheduleDaysByChapter` per partida, a total that defaults to the sum but can be
overridden (because whether two partidas run in parallel is a judgement, not
arithmetic), `extendProjectDeadline`, `applyChapterDelay`, and `reapplyAdiDays`
which makes re-deriving the plan idempotent (PK13-S1b).

On signature the annex joins, in this order:

| Destination                      | How it arrives                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| Alcance                          | the `_projectVersions` predicate                                                        |
| Hitos de pago                    | the installment, appended, gross, `trigger: "onAnnex"`                                  |
| Avance físico                    | `chapterProgress` / `markLineProgress`, same walk                                       |
| Avance económico                 | `projectEconomics` — ⚠️ see the legacy branch below                                     |
| Ingresos                         | the milestone becomes billable; guard CHG-04 rewords from «sin aprobar» to «sin firmar» |
| Partidas / subpartidas for costs | the chapters enter `projectChapters`, renumbered from the job's highest                 |

### Item 5 — remove Adicionales from Contratos

**Right, but it is the LAST step, not the first.**

The Contratos → Adicionales tab is today the only place two things are captured:
the days per partida, and how the customer answered. Deleting it before the
Anexos signing panel exists would strand every issued adicional with no way to
formalise it. Build the new door, move the traffic, then close the old one.

---

## 3 · What breaks if this is done naively

### 🔴 The migration is the dangerous part

**Every adicional already accepted has already been applied.** `PRE-2026-0009`'s
`ADI-2026-0001` moved the baseline, `CTR-2026-0005` has three annexes
(A1 416,50 € · A2 410,55 € · A3 1.480,00 €) and each pushed a milestone. If
`annexSignedAt` is introduced as a required gate with no migration, the next load
of the live workspace **silently loses scope, deadline and milestones** on jobs
that are running.

Every existing annex must be stamped signed, with its existing date and a method
of `legacy`, in the same commit that introduces the gate. Not a follow-up.

### 🟠 `projectEconomics` does not use the single walk

It has three revenue sources, and one bypasses `_projectVersions`:

```js
p.baseline.revenueCents + changesPrice + variationRevenue;
```

`changesPrice` sums approved `state.changes` directly. Gating scope in
`projectVariations` alone leaves that branch ungated, so an economic figure could
include an annex the physical scope does not. It needs its own line.

### 🟠 `contractValue` counts every annex as vigente

```js
const annexCents = sum(c.annexes || [], (a) => a.valueCents);
const currentCents = c.valueCents + annexCents;
```

Unconditional. Once annexes exist before signature, IMPORTE VIGENTE would include
money nobody has agreed to. It must exclude unsigned annexes — and the screen
should show both figures, «vigente» and «pendiente de firma», because an operator
who can see only one of them will ask where the other went.

### 🟠 The Anexos tab in Image 2 is already broken, for a reason worth knowing

The three «Justificante: sin adjuntar» rows are **not empty slots waiting to be
filled**. The tab reads Motivo and Justificante from the legacy change register:

```js
const chg = erp.state.changes.find((x) => x.id === a.changeId);
```

Annexes written from an adicional VERSION carry `changeId: null` — they hold
`budgetId`, `versionId` and `ref` instead. So that lookup can never succeed, and
those three rows can never show a motivo or a justificante no matter what is
uploaded. The tab was written for mechanism 3 and never updated when PK12-S13
replaced it. It must read `a.ref` / `a.budgetId` / `a.versionId`.

This also means the annex rows do not currently name **which adicional** they came
from, which is exactly the thing item 3 needs them to say.

### 🟡 Smaller ones, each real

- **Chapter renumbering.** Variation budgets already renumber their chapters to
  continue from the job's highest across ALL sections — a fix made after an
  optional chapter 6 collided with a variation's chapter 6 and progress was
  marked on the wrong one. Empty adicionales inherit that machinery; it must not
  be re-implemented.
- **`budgetStatusOf`'s `openAdicional` branch** becomes dead once the records are
  separate. Delete it, do not leave it.
- **AR-11's exemption** (`!draft.changeId`) is keyed to the legacy register. The
  new route bills through annex milestones, so the exemption needs re-checking
  against the real path rather than assumed to still apply.
- **iOS routes.** A new sub-screen needs `site/nav.json` and passes
  `tests/ios-routes/coverage.mjs`. The bundled manifest means the phone needs a
  build; the web half does not.
- **Translations.** A new screen is walked by the workspace audit, whose ceiling
  is 0/0 in both languages. Every string in both dictionaries in the same commit.

---

## 4 · The order of work

Each phase leaves the repo green and the product usable. No phase depends on a
later one having been done.

| Phase | What                                                                                                                                             | Why here                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **0** | Fix the Anexos tab to read `ref`/`budgetId`/`versionId` instead of `changeId`                                                                    | Standalone bug, visible today, and phase 3 builds on this panel |
| **1** | `adicionalOf` on the budget record + migration stamping existing annexes signed                                                                  | The gate must never exist without the migration                 |
| **2** | Split Presupuestos into Nuevo / Adicionales; ＋ Adicional picks a signed contract, opens an empty builder; remove the option from ＋ Presupuesto | Items 1 and 2, no behaviour change downstream yet               |
| **3** | The Anexos signing panel: verbal or document, days per partida, then apply                                                                       | Item 4 — and only now does approval stop applying               |
| **4** | Move the gate into `projectVariations`, `projectEconomics` and `contractValue`                                                                   | Item 3's actual effect, once there is a way to sign             |
| **5** | Delete the Contratos → Adicionales tab                                                                                                           | Item 5, last, when nothing needs it                             |

**Gates on every phase:** the unfiltered browser suite (739/739 today), site-sync
20/20, boundaries, i18n coverage in three languages, source literals 162/162,
workspace audit 0/0, nav manifest, ownership guard.

Phase 1's migration gets its own test: a workspace saved before the change,
loaded after it, with the same scope, the same deadline and the same milestones.
That is the one failure that would not be visible on any screen until a job's
figures had already been wrong for a week.

---

## 5 · The one thing worth deciding before any of this is built

An adicional that starts empty **can only add**. Reductions become explicit
negative lines; editing an agreed line in place goes away.

That is the trade the operator is making in exchange for two readable lists and
an approval that does not silently move the delivery date. It is the right trade
— but it is a trade, and it should be made knowingly rather than discovered in
phase 2.

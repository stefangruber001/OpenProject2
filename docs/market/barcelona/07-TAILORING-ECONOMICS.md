# 07 — TAILORING ECONOMICS: THE COST OF TENANT #N+1

This document is Phase 7 of the Barcelona market roadmap (`docs/market/barcelona/ROADMAP.md`), written on **2026-09-13**, and it is the only phase that answers its question by running the product rather than by reasoning about it. Everything below was measured against the repository at today's commit: the configuration surface was enumerated by composing the resolver's own schema and printing its keys, the onboarding path was walked end to end with a real probe tenant created, edited, resolved, validated and demonstrated under `time`, and every structural claim about what else has to happen before a firm can sign in carries the file and line that makes it true. Four numbers are inherited and not re-litigated: the planning annual contract values from `06-VALUE-CASE.md` §5 — **€3,600 for Segment 1, €6,480 for Segment 2, €2,160 for Segment 3** — and the one-time onboarding fees as currently priced, €1,200, €2,400 and €900. The verdict on the Definition of Done's fifteen-minute clause is stated in §4 without softening, because the phase brief asks for that specifically and because a cost model whose headline number is wrong in the optimistic direction is worse than no cost model: it converts a sales promise into a delivery loss one tenant at a time. Every figure that rests on judgement rather than on a file or a stopwatch is marked in bold as an assumption.

---

## 1 · Configuration surface

The **configuration surface** is not a matter of opinion in this codebase, and that is its single most commercially valuable property. `packages/kernel/src/resolve.ts` composes a validator from three sources — the kernel's own fragment, one fragment per selected capability mounted at `config.<capability-id>`, and one fragment per selected pack mounted at `config.jurisdiction` and `config.vertical` — and then parses the tenant file with `z.object(shape).strict()`. Strictness is the boundary made mechanical: a key no fragment declares does not get ignored, it fails resolution. So the question "is this prospect configuration-only?" has a decidable answer, and the answer is "can the requirement be written as a value of one of the keys below, without a code change?"

Enumerated by composing the registry's full capability set and printing the resolved top-level keys, the surface is exactly twenty top-level config entries plus seven spec-level entries.

**Spec-level keys** (`tenants/<id>/tenant.yaml`, validated by `tenantSpecSchema` in `packages/kernel/src/spec.ts`): `tenant` (lowercase slug, regex-enforced), `kernel` (a range; `*` or a caret-major only), `capabilities` (non-empty array of installed capability ids), `jurisdiction` (pack reference with an optional effective date after an `@`), `vertical` (pack reference), `plugins` (array of strings), `config` (record).

**Kernel config keys**, present for every tenant regardless of pack selection: `config.locale`, `config.currency` (exactly three characters), and `config.branding` carrying `legalName` (required), and optionally `tradeName`, `slogan`, `contact` (`address`, `phone`, `email`, `web`), `palette` as a free token-to-value map, `typography` (`display`, `body`) and `logo` (`wordmark`, `white`, `mark`).

**Capability config fragments.** Eighteen capabilities are installed in `packages/factory/src/registry.ts`. Sixteen declare a config fragment; `quoting` and `sourcing` declare none, so writing `config.quoting` is a resolution error rather than a no-op. Of the sixteen, six declare an empty object and therefore expose nothing to set today. The ten that carry real keys are:

| Key                     | Keys inside it                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `config.billing`        | `seller` (`name`, `taxId`, `address`, `countryCode`), `series[]` of `{ id, kind, pad, yearly }`        |
| `config.access`         | `roles`: role name to permission-string array                                                          |
| `config.catalogue`      | `items[]` (code, name, chapter, unit, kind, unit price and unit cost in cents), `templates[]`          |
| `config.crm`            | `pipeline[]`: ordered stage names, the first is the entry stage                                        |
| `config.messaging`      | `from`, `signature`, `templates[]` (event, subject, body with token substitution)                      |
| `config.projects`       | `marginFloorBp`                                                                                        |
| `config.receivables`    | `agingDays[]`                                                                                          |
| `config.time`           | `defaultRatePerHourCents`                                                                              |
| `config.reconciliation` | `dateToleranceDays`, `amountToleranceCents`, `autoAcceptScore`, `maxCombinationSize`, `maxSuggestions` |
| `config.extraction`     | `reviewThreshold`, `totalsToleranceCents`, `maxAlternatives`                                           |

The six empty ones are `config.docs`, `config.payables`, `config.procurement`, `config.scheduling`, `config.suppliers` and `config.visits`.

**Pack config fragments.** `config.jurisdiction.verifactu.enabled` for the Spanish pack — one boolean, hard-gated in `packages/packs/jurisdiction-es-es/src/manifest.ts` to throw at resolve time when true, because the certified mode is neither implemented nor legally verified. And `config.vertical` for the renovation pack: `terminology` (`quote`, `line`, `measurement`), `terminologyByLang` (the same three words per interface language, shipping English, Spanish and Catalan), `chapterLabels` (per-language display labels keyed by the canonical chapter value), `defaultUnits[]`, `materialsShareDefaultBp`, and `chapters[]` — the eighteen-entry default renovation chapter catalogue, overridable per tenant as an ordinary array.

**Group-level keys**, one file per owner group (`tenants/_groups/<id>.yaml`): `group`, `displayName`, `owners`, `members`, plus bookkeeping fields for pending validations and current tools. A group is data over tenants; each legal entity stays its own tenant with its own numbering and isolation partition.

`02-ICP-AND-RUBRIC.md` §C.0 published a first draft of this inventory and asked Phase 7 to keep the two in agreement. They agree, with three corrections that matter commercially.

**Correction one: `config.extraction` is not reachable from a tenant file today.** The `extraction` capability declares `extraction-profile@1` as a _required_ port, and no pack binds it. Resolution of any spec that selects `extraction` fails, reproducibly:

```
[MISSING_PORT_IMPLEMENTATION] Capability "extraction" requires port extraction-profile@1,
but no selected pack provides it. Selected packs: [jurisdiction/es-ES,
vertical/construction-reformas]. A jurisdiction pack is likely missing from the tenant spec.
```

The Spanish profile exists — `packages/packs/jurisdiction-es-es/src/extraction/profile.ts`, 275 lines with 242 lines of tests — but it is bound in a _host_, at `packages/erp-browser/src/index.ts:311`, not in the pack's `register()`. So one of eighteen capabilities cannot be selected by any tenant, and the document-reading feature reaches a tenant only through the browser bundle, which is built once for everybody. This is a two-line fix in the pack manifest and it is the cheapest item on the entire debt list.

**Correction two: `plugins` is inert.** A spec carrying `plugins: ["anything-at-all"]` resolves cleanly. There is no loader, no registry, no sandbox, no contract test and no expiry. `02-ICP-AND-RUBRIC.md` §C.2 suspected this; it is confirmed. Every requirement classified L1 must therefore be costed as L2 until a loader exists.

**Correction three: the surface validates shape, not fitness.** This is the most important finding in §1 and it is worth stating as a list, because each line is a way a tenant can pass `validate` and then be wrong in production. Probing the resolver with fifteen deliberately broken specs, these were **refused**: an undeclared config key, an unknown capability, `verifactu.enabled: true`, an unknown jurisdiction, an effective date before the pack's validity window, a missing jurisdiction pack (caught by the required-port check, which is the negative test working), a lowercase series id, and a currency that is not three characters. And these were **accepted silently**:

- the template's placeholder tax identifier `B00000000` left in place;
- a tax identifier of `NOT-A-CIF`;
- no tax identifier at all;
- no fiscal address at all;
- the branding legal name left as the template's unsubstituted LEGAL_NAME token;
- two series sharing the same id;
- `locale: klingon`.

The pack contains a complete Spanish tax-identifier checker with the modulus-23 and CIF check-character arithmetic (`packages/packs/jurisdiction-es-es/src/extraction/taxid.ts`), and it is wired only into the document _reader_. It never looks at the tenant's own seller identity, because `partySchema` in `packages/capabilities/billing/src/model.ts` types `taxId` as an optional non-empty string. Worse, the placeholder `B00000000` is itself check-digit valid — verified by calling the checker directly — so even wiring the validator in would not catch the one wrong value that is actually in the repository three times over: `tenants/_template`, `tenants/azulejos-lopez` and `tenants/diorka` all carry it. Every invoice in this system is immutable, gaplessly numbered and hash-chained. A tenant that goes live with a placeholder tax identifier does not get a warning; it gets a register it cannot correct except by rectification.

**So the L0 boundary, stated precisely: twenty config keys and seven spec keys, of which ten config keys carry real structure, one capability is unreachable, one spec key is inert, and the validator proves composability rather than correctness.** That is a narrower and more honest statement than "customisation is configuration", and it is still a genuinely unusual asset — no competitor in this segment can print its own configuration boundary from its own code.

---

## 2 · What tenant #1 took

Reconstructed from `PROGRESS.md`, `ASSUMPTIONS.md`, `docs/worklog/WORKLOG.md` and the ownership ledger `site/erp-ownership.json`, the Canei Subirats delivery divides into four buckets. The measurable frame: 452 commits across 29 distinct working days, about 11,200 lines of non-test package code, 5,200 lines of package tests, 43,700 lines in the site layer, 27 named domain areas, roughly 38 recorded sessions and feedback packages.

**Config (what the factory was built to absorb).** Real identity, brand tokens and palette, typography, logo references, contact block, trilingual message templates, the two-role administration/operations split with explicit grant lists, five catalogue items and one room template, invoicing series, the renovation chapter order and the Spanish and Catalan chapter labels, the contractor-materials share. All of it lives in `tenants/diorka/tenant.yaml` as data, and the file is the proof that the surface in §1 is not theoretical. This bucket cost hours, not weeks, and it is the bucket that makes tenant #2 cheap.

**Pack (reusable inside Spain, or inside renovation work).** The effective-dated tax tables and the dwelling-renovation reduced-rate decision engine with its persisted justification; the withholding profiles; the Spanish document labels; the SHA-256 invoice chain; the resolve-time certified-billing gate; the Spanish extraction profile with tax-identifier and IBAN check arithmetic. On the vertical side: the eighteen-chapter catalogue from the customer's own requirements appendix, the measurement arithmetic, the construction attribute contract, the three-word vocabulary in three languages. Measured: 1,148 lines in the jurisdiction pack including tests, 397 in the vertical pack. The vertical pack binds **no ports at all** — its `register()` is empty by design — which is worth knowing before costing a second vertical.

**Capability (reusable everywhere).** Eight of twenty-seven domain areas have made the trip from the hand-written engine into typed capabilities: the graphic annex, banking reconciliation, project economics, scheduling and the Gantt, extraction and optical reading, communication templates, the task-status summary, and the reconciliation matcher. Measured sizes put `scheduling` at 2,629 lines, `extraction` at 1,817 and `reconciliation` at 1,131 — each roughly one or two recorded sessions of work. Nineteen areas remain engine-owned.

**Bespoke, and it should be pushed down.** This is the list that decides the cost of tenant #2, so it is named in full with paths.

1. **The bank statement importer reads one bank.** `site/erp-import.js` finds the header row by Spanish column names and its own error message names the bank: "¿Es el export de movimientos de BBVA?" A renamed column fails loudly; a second bank is a second profile. `INTEGRATIONS_PENDING.md` already anticipates the fix as a `bank-statements@1` port over **N43**, the Spanish interbank statement standard every bank exports. The importer also met the customer's two real exports for the first time on 2026-08-18 and failed three ways, each silent and each about money. This is the highest-value piece of bespoke code in the repository and §6 costs removing it.
2. **The live invoice path is not the factory's invoice path.** `site/erp-ownership.json` records `invoices-collections` and `org-entity-numbering` as **engine**-owned, and `site/erp-engine.js:327` carries its own `vatRates: [2100, 1000, 500, 0]` with a per-party `vatBp` chosen as data. The effective-dated rule engine, the persisted legal basis, the rule identifier and the pack version — everything `00-REFERENCE-CASE.md` §C.2 names as the asset a competitor cannot copy quickly — are exercised by `pnpm factory demo` and by tests, and are not what issues the invoices the customer sends. `site/erp-bridge.js` covers plans, the annex, extraction and reconciliation; it does not cover tax or billing. This is the largest single piece of technical debt in the product and it is not a cosmetic one: it is the difference between selling the compliance asset and demonstrating it.
3. **The tenant's own identity is held twice, and the running ERP uses the copy the factory does not own.** `site/erp-engine.js`'s `_issuerBlock()` reads legal name, tax identifier, addresses, registry entries, bank details and logo from the ERP document's own config, entered through a setup screen — not from `config.branding` or `config.billing.seller`. Nothing in `site/` consumes `/api/<tenant>/resolution`, which is served and unread. And `packages/capabilities/billing/src/render.ts` ignores `branding` entirely: the demo invoice for the probe tenant carried its name, tax identifier and address, and none of its palette, typography or logo.
4. **Tenant #1's identity is in the shipped product, not only in its tenant file.** `site/erp-seed.js` hardcodes `legalName: "Canei Subirats, S.L."` with a tax identifier and an IBAN, and a fresh workspace is seeded from it. `site/erp.html:11` titles the page "Canei Subirats — ERP" and line 5176 puts the name in the sidebar; `site/erp-ds.css` hardcodes the brand green `#48733C` four times; the native shell is detected by a `CaneiApp/` user-agent token; and the global namespaces the whole site layer is built on are `CaneiPdf`, `CaneiSheet`, `CaneiZip`, `CaneiDocI18n`, `CaneiErpFacts`, `CaneiEml`. The identifiers are harmless; the title, the sidebar, the seed identity and the stylesheet colour are tenant #1's data sitting in code.
5. **The deployment is one stack per customer, with the customer named in it.** `apps/web/lib/access.ts:43` resolves the workspace's `~` alias to `process.env.ERP_DEFAULT_TENANT` with a literal `"diorka"` default; the production compose project is named `canei-erp`; the provisioning template's domain, access domain and backup bucket are tenant #1's.
6. **Tenant specs are build artefacts.** `Dockerfile:98` copies `/repo/tenants` into the image and pins `TENANTS_DIR=/app/tenants`; `.github/workflows/deploy.yml` lists `tenants/**` as a path that triggers a rebuild, with the comment "copied into the image and read at request time". A new tenant file reaches production only through a commit, a CI build, an image publish and a deploy.
7. **The fleet registry is a hardcoded list.** `packages/db/prisma/seed.ts` upserts exactly two tenant ids, `reformas-demo` and `azulejos-lopez`. `diorka` — the real customer — is not in it. `factory new-tenant` does not create the `Tenant` row. Registering tenant #2 in a database-backed deployment is an edit to a TypeScript file or a hand-written insert.
8. **Account membership is not tenant-scoped in every mode.** Database-held users are correctly keyed `(tenant_id, email)` with row-level security. But `apps/web/lib/user-admin.ts` merges environment accounts (`ERP_USERS`) into _every_ tenant's user list, the shared-password route has no account behind it at all, and the session token carries no tenant claim — `resolveTenant(param)` in `access.ts` takes any other tenant id at face value. This is safe today only because each deployment serves exactly one tenant. It is the blocking defect for putting two customers on one stack.
9. **`docs/architecture.md` predates the factory.** It describes a Next.js application with a Prisma data layer and says "the product is still being defined". It does not mention the kernel, capabilities, packs, the resolver or the layer rules. A new engineer onboarding from the documented architecture learns the wrong system.

**Assumption, and it is the load-bearing one for §3: moving an area from engine to capability is cheaper than building it, because eight areas have already made that trip with each move's reasoning recorded — but it is not free, and the nineteen that have not moved are the reason tenant #2 is not a data change yet.**

---

## 3 · Cost per layer

The **cost per layer** below is expressed in engineering hours and in calendar time, each with a confidence interval, and each derived from something measurable in this repository rather than from an industry benchmark.

**Rate and productivity, stated before the numbers.** All hour figures are _delivered_ hours at the build rate this repository has actually demonstrated: 27 domain areas and roughly 60,000 lines across 29 distinct working days, with the full quality gate green on each commit. **Assumption: one engineer working with heavy automated assistance, at a fully loaded internal cost of €70 an hour. A conventional human-only team should multiply every hour figure by three to five and every calendar figure by two to three.** That multiplier is stated once and applies throughout; it does not change any margin conclusion in §5 because the dominant term there turns out not to be the tailoring cost.

**L0 — tenant configuration only.** Measured, and split into the part the fifteen-minute claim actually covers and the part it does not.

| Step                                                                       | Hours    | Evidence                                            |
| -------------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| `factory new-tenant`, edit four identity fields, `resolve`, `validate`     | **0.25** | measured, §4                                        |
| Intake conversation to obtain the values the keys need                     | 0.5–3.0  | `00-REFERENCE-CASE.md` open questions 15–17         |
| Catalogue and room templates loaded as data                                | 0.5–6.0  | `tenants/diorka/tenant.yaml`                        |
| Roles, message templates, brand tokens, chapter order                      | 0.5–2.0  | same                                                |
| Commit, CI build, image publish, deploy                                    | 0.5      | `Dockerfile:98`, `deploy.yml`                       |
| Provision a stack: server, tunnel, DNS, access policy, backup bucket, keys | 1.5      | `ops/provision.sh`; guide says ~90 min              |
| Create the `Tenant` row                                                    | 0.3      | `packages/db/prisma/seed.ts`                        |
| Create accounts and issue invitations                                      | 0.4      | `apps/web/lib/user-admin.ts`                        |
| Enter company identity, series and clause blocks in the ERP document       | 1.5      | `site/erp-engine.js` `_issuerBlock()`               |
| Clear the demo seed and load opening data                                  | 1.0–3.0  | `site/erp-seed.js`, `docs/CLEANING-TEST-RECORDS.md` |
| Smoke-test the money chain: quote, contract, invoice, all three downloaded | 1.0      | `PROGRESS.md` S19                                   |
| Handover note                                                              | 0.3      | —                                                   |

Of that, **6.5 hours are fixed** — identical for every tenant regardless of size — and the remainder scales with the firm. Per segment: **S3 8.0 h central (interval 6–14), S1 11.0 h central (8–18), S2 16.0 h central (11–26)**. Calendar: **3 to 10 working days**, dominated not by work but by waiting for the customer's tax identifier, fiscal address, bank export and accountant's preferred format — three of which `00-REFERENCE-CASE.md` lists as unanswered since July.

**Variance drivers at L0**, in order of contribution: (i) whether the firm's registry and fiscal data are to hand at the first call or need a lookup; (ii) the size of the price catalogue, which is the single largest variable block and the only one that can triple the total; (iii) whether opening balances and receivables have to be loaded or the firm starts clean at a period boundary; (iv) whether the firm banks with the one supported bank, which if false converts the engagement from L0 to L4 on that axis alone; (v) whether the deployment is a new stack or an existing one with capacity.

**L1 — additive plugin.** There is no loader, so this is costed as bespoke additive code in a package with its own tests and release: **40 h central, interval 20–90**, calendar 2–5 weeks. Anchor: the smallest real capabilities in the repository (`access` at 158 lines, `visits` at 160, `time` at 203) are the shape an additive plugin would take, and each was a fraction of a session.

**L2 — new or extended vertical pack.** **60 h central, interval 30–140**, calendar 3–6 weeks. Anchor: the renovation pack is 397 lines including tests and binds no ports, so a second vocabulary-and-taxonomy pack is genuinely small. The interval's upper half is where the sector needs _objects_ rather than words — and that case is not L2, it is L2 plus L4, which §6 prices correctly for the installer pack.

**L3 — new or extended jurisdiction pack.** **120 h central, interval 70–260**, calendar 8–16 weeks. Anchor: the Spanish pack is 1,148 lines including tests, and the build was roughly one session — but the build is the cheap half. The expensive half is the legal work recorded in `LEGAL_REVIEW.md`: three cumulative conditions for one reduced rate, sources checked and dated, a deadline that moved to 2027, withholding that is profile-dependent, and every finding stamped unverified pending a human adviser. Calendar here is adviser availability, not engineering. A **bridge module** for law that is genuinely one jurisdiction _and_ one sector — the subcontracting and employer registers per ADR-0011 — is smaller and better bounded: **70 h central, interval 40–140**, calendar 4–8 weeks.

**L4 — new capability.** **110 h central, interval 60–220**, calendar 4–9 weeks. Anchor: `scheduling` at 2,629 lines across two sessions including its Gantt surface, `extraction` at 1,817 across one, `reconciliation` at 1,131. A capability is not done when its tests pass: it needs a bridge entry, a site-layer surface, an ownership-ledger move and a browser-bundle rebuild, and the three largest capabilities in the repository each took that whole path.

**L5 — kernel change.** Not costed, because it is not sold. ADR-0010 names money math, invoice immutability, tax-decision override, numbering gaplessness, the audit trail, per-tenant schema shape and effective-dating semantics as never configurable for any customer, with the stated consequence that some prospects walk because they were buying a fork. `05-TARGET-LIST.md` found zero L5 evidence across 128 rows, which is expected: that evidence only surfaces in a sales conversation.

---

## 4 · The 15-minute test

The Definition of Done in `CLAUDE.md` requires "tenant #2 in <15 min config-only". `PROGRESS.md` records the mechanism as proven at 0.02 seconds and the formal timed run with a real intake as still owed. This section is that run. A probe tenant was created, edited to look like a Tier A firm from `05-TARGET-LIST.md` (Gonzvilarsa S.L., Sant Joan Despí, with a placeholder tax identifier of valid CIF shape), resolved, validated, demonstrated, and then removed. Every command and its wall clock:

```
$ pnpm factory new-tenant --name roadmap-probe
OK — tenant "roadmap-probe" created and resolved in 0.02s (config only, zero code).
  spec: /home/user/OpenProject2/tenants/roadmap-probe/tenant.yaml
real    0m0.885s

# configuration-only edit: legalName, seller.name, seller.taxId (B12345674),
# seller.address — four values in tenants/roadmap-probe/tenant.yaml
00:44:44.876 → 00:44:51.514                                 elapsed 6.6s

$ pnpm factory resolve tenants/roadmap-probe/tenant.yaml
{ "tenant": "roadmap-probe", "kernelVersion": "1.0.0", 6 capabilities,
  2 packs, 3 boundPorts: doc-labels@1, invoice-chain@1, tax@1 }
real    0m1.085s

$ pnpm factory validate tenants/roadmap-probe/tenant.yaml
OK — tenant "roadmap-probe" resolves: 6 capabilities, 2 packs, 3 ports bound.
real    0m0.854s

$ pnpm factory demo tenants/roadmap-probe/tenant.yaml --out <scratch>
FAC-2026-0001  base 2872,00 € · tax 10% (ES-IVA-REDUCIDO) · total 3159,20 €
    justification: Ley 37/1992 (LIVA), art. 91.Uno.2.10º · seal #1 87f3271fa4a9f790…
FAC-2026-0002  base 5000,00 € · tax 21% (ES-IVA-GENERAL) · total 6050,00 €
    justification: Ley 37/1992 (LIVA), art. 90.Uno; art. 91.Uno.2.10º no aplicable
  artifacts (8)
real    0m0.914s
```

`new-tenant` created `tenants/roadmap-probe/tenant.yaml` from the template and appended one row to `tenants/INDEX.md`. Nothing else. **Four commands, 3.74 seconds of machine time; with an honest allowance for a person typing four fields with the data in front of them, call it 5 to 8 minutes including opening the file and sanity-checking the tax identifier. On that scope, the fifteen-minute claim holds with room to spare, and it is a real achievement: the spec validated, the packs bound, and the same spec produced two invoices with an effective-dated rate and a persisted legal basis on each.**

**And on the scope the Definition of Done actually implies, it does not hold, and the gap is not close.** The requirement is a running, tested, compliant ERP — a firm that can sign in, with its own branding, series and clause blocks. Here is what else has to happen, traced through the code, in order of cost to fix.

**Cheapest first — minutes to hours each.**

1. **Create the `Tenant` row.** `packages/db/prisma/seed.ts` is a hardcoded two-element array and `new-tenant` does not touch the database. Fix: make `new-tenant` upsert the row, or read the seed from `tenants/`. Under an hour.
2. **Bind `extraction-profile@1` in the pack.** Two lines in `packages/packs/jurisdiction-es-es/src/manifest.ts`; the adapter already exists and is tested. Until then one of eighteen capabilities cannot be selected by any tenant.
3. **Validate the seller identity at resolve time.** The CIF checker exists and is tested; `partySchema` does not call it. Today a tenant passes `validate` with `B00000000`, with `NOT-A-CIF`, with no tax identifier at all, with no address, with the template's unsubstituted legal-name token, and with two series sharing an id — and then issues immutable, gapless, hash-chained invoices. Refusing a placeholder is a few hours and it is the highest ratio of risk removed to work done in this whole list.
4. **Feed `config.branding` into the document renderer.** `packages/capabilities/billing/src/render.ts` ignores palette, typography and logo; the probe's invoice carried its name and address and none of its brand. A day.

**Then — days to two weeks each.**

5. **One identity, not two.** The running ERP reads its issuer from the ERP document, not from the tenant spec; `/api/<tenant>/resolution` is served and unread by `site/`. Until the spec is the source, "configuration-only" describes a file that the product the customer uses does not read. Seed the ERP document's config from the resolved spec on first boot: a week, and it deletes a whole class of onboarding error.
6. **Start a tenant empty, or start it from its own data.** A fresh workspace is seeded from `site/erp-seed.js`, which hardcodes tenant #1's legal name, tax identifier and IBAN plus a year of demo history; `docs/CLEANING-TEST-RECORDS.md` records that there is no automatic purge by choice. Tenant #2's first hour is currently spent deleting tenant #1's fixtures. A clean-start path plus an opening-balances import: one to two weeks.
7. **Take tenant #1's identity out of the shipped product.** Page title, sidebar name, seed identity, the brand green in `site/erp-ds.css`, the native-shell user-agent token. Each is a lookup against resolved branding. One to two weeks together.

**Then — the two that are weeks and are structural.**

8. **A tenant must be data at runtime, not a build artefact.** `Dockerfile:98` bakes `tenants/` into the image and `deploy.yml` triggers a rebuild on `tenants/**`. So the minimum latency between "the spec is valid" and "the customer can use it" is a CI build and a deploy — which, even fully automated, is not fifteen minutes, and which puts every new customer behind the same release train as every code change. Fix: read specs from a mounted volume or a control-plane store (`TENANTS_DIR` already exists and is the seam). **Two to four weeks**, and this is the item that most directly converts the claim from false to true.
9. **Bind a session to a tenant before putting two customers on one stack.** `apps/web/lib/access.ts` resolves `~` to a single deployment-wide default and accepts any other tenant id at face value; the session token carries no tenant claim; `user-admin.ts` merges environment accounts into every tenant's membership; the shared-password route has no account at all. Row-level security is correct in the database and the per-tenant user table is correct — but the authorisation layer above them assumes one customer per deployment. **Three to six weeks** including tests that assert a cross-tenant request is refused, which is the kind of test that must exist before the second customer, not after.

**The unsoftened verdict, in the terms the phase brief demands.** Measured L0 is **8 hours for Segment 3, 11 for Segment 1, 16 for Segment 2** — that is **32 to 64 times the fifteen-minute target**, and 6.5 of those hours are fixed costs that no amount of configuration skill reduces. The fifteen-minute claim is true of the _specification_ and false of the _tenant_. It should be restated in two parts before anybody repeats it to a prospect or an investor: **"a validated tenant specification in under fifteen minutes, configuration-only, measured" — which this document proves — and "a signed-in, branded, data-loaded, smoke-tested tenant in one to two working days" — which this document also measures, and which is a perfectly good number to sell.** What must stop is quoting the first figure and delivering the second. `06-VALUE-CASE.md` §3.7 already prices Segment 3 with a hard eight-hour onboarding cap; the measured central for that segment is exactly 8.0 hours, so half of all Segment 3 onboardings overrun the cap by construction. That is not a forecast, it is arithmetic on a measurement, and §5 carries it through.

For completeness: after the measurement the probe was removed and the index restored. `git status --short` reports only this file and `05-TARGET-LIST.md` as modified.

---

## 5 · Marginal economics

Revenue per tenant is fixed by `06-VALUE-CASE.md` §5. Cost per tenant has two parts, and the measurement above shows that the part everyone worried about is the smaller one.

**Cost to serve, per tenant per year.** Infrastructure is measured, not assumed: `docs/HETZNER-SETUP.md` states **about €9 a month** for a dedicated stack — server €7.05, its backups €1.40, object-store backups €0.20 — which is **€108 a year**. Against Segment 1's €3,600 that is 3% of revenue, and the marginal infrastructure cost of tenant N+1 on a shared tier would be lower still. Support is the real cost. **Assumption, no source: year-one human support of 24 hours for Segment 1, 36 for Segment 2 and 12 for Segment 3, falling to 6, 9 and 4 hours in steady state, at the same €70 an hour.** That gives a cost to serve of **€1,788 / €2,628 / €948** in year one and **€528 / €738 / €388** thereafter. `05-TARGET-LIST.md` Table 3 carried a placeholder of 15–20% of revenue; the measured steady state is 11–18%, so the placeholder was close — but it was being applied to year one, where the true figure is 44% for Segment 3.

**Tailoring cost per tenant at L0**, from §3 at €70 an hour: **S1 €770, S2 €1,120, S3 €560**. Compare with the onboarding fees `06-VALUE-CASE.md` already prices — €1,200, €2,400, €900 — and the first good news in this document appears: **the onboarding fee as currently priced covers the measured L0 delivery cost with 36%, 53% and 38% of headroom.** L0 onboarding is fee-positive. It is also fee-positive only at the central estimate: at the top of the S2 interval (26 hours, €1,820) the fee still covers it; at the top of the S3 interval (14 hours, €980) it does not.

**Gross margin per tenant, year one, by layer and segment.** Revenue is the annual contract value plus the onboarding fee. Cost is the cost to serve plus the L0 tailoring cost plus — in this table, and deliberately — the _whole_ cost of the layer charged to the first tenant that forces it. That is the project reading, and it exists to show why a pack must never be sold as a project.

| Layer                        | S1 (rev €4,800)    | S2 (rev €8,880)    | S3 (rev €3,060)    |
| ---------------------------- | ------------------ | ------------------ | ------------------ |
| **L0** config only           | **€2,242 · 46.7%** | **€5,132 · 57.8%** | **€1,552 · 50.7%** |
| **L1** additive (€2,800)     | −€558 · −11.6%     | €2,332 · 26.3%     | −€1,248 · −40.8%   |
| **L2** vertical (€4,200)     | −€1,958 · −40.8%   | €932 · 10.5%       | −€2,648 · −86.5%   |
| **L3** jurisdiction (€8,400) | −€6,158 · −128.3%  | −€2,868 · −32.3%   | −€6,848 · −223.8%  |
| **L4** capability (€7,700)   | −€5,458 · −113.7%  | −€2,168 · −24.4%   | −€6,148 · −200.9%  |

Read plainly: **only Segment 2 can absorb any layer above L0 inside a single tenant's first year, and only up to L2.** Every other cell above L0 is negative. This is the arithmetic behind `02-ICP-AND-RUBRIC.md`'s instruction to price L2 and above as investment and not as project cost, and behind `05-TARGET-LIST.md`'s decision to route every non-L0 firm to Tier C rather than into the pipeline.

**Gross margin per tenant, steady state (year two onward).** The layer has been built, so margin is annual contract value less cost to serve, and it is layer-independent:

| Segment | ACV    | Cost to serve | Gross margin       |
| ------- | ------ | ------------- | ------------------ |
| S1      | €3,600 | €528          | **€3,072 · 85.3%** |
| S2      | €6,480 | €738          | **€5,742 · 88.6%** |
| S3      | €2,160 | €388          | **€1,772 · 82.0%** |

Weighted at Tier A+B's actual composition of twelve, nineteen and six firms, the blended steady-state margin is **86.5%**, against the 82.5% midpoint `05-TARGET-LIST.md` used provisionally. The business is a high-margin business in steady state. Its whole risk is concentrated in year one, and within year one it is concentrated in support hours rather than in tailoring hours — which inverts the question Phase 5 thought it was asking.

**The tenant count at which each Tier-C pack pays back.** Payback unit is the year-one L0 gross margin of the segment the pack's firms belong to, which is the conservative choice: it requires the pack to return its cost inside the first year of each converted tenant rather than over a lifetime.

| Investment                                      | Cost (hours → €) | Converted-tenant margin | **Payback at**   | Population available              |
| ----------------------------------------------- | ---------------- | ----------------------- | ---------------- | --------------------------------- |
| **N43 bank-statement adapter** (not in Tier C)  | 50 h → €3,500    | €2,242 (S1)             | **2 tenants**    | effectively all 37 Tier A+B firms |
| **Plugin loader** (not in Tier C)               | 90 h → €6,300    | €1,960 saved per L1     | **4 L1 tenants** | every future L1 requirement       |
| **Pack 1** — recurring contracts + work orders  | 170 h → €11,900  | €2,242 (S1)             | **6 tenants**    | 8 named; ~14,357 in Catalonia     |
| **Spain × construction bridge** (registers)     | 70 h → €4,900    | €5,132 (S2)             | **1 tenant**     | 19 S2 firms + 8 Tier C installers |
| **Pack 2** — civil engineering / plant register | 220 h → €15,400  | €2,242 (S1)             | **7 tenants**    | **1–2** → decline, confirmed      |
| **Pack 3** — promoción / unit sales pipeline    | 220 h → €15,400  | €2,242 (S1)             | **7 tenants**    | **1** → decline, confirmed        |

Two of those rows are corrections to `05-TARGET-LIST.md` rather than confirmations of it, and they are the commercially important ones. The Tier C section was built from _sector adjacency_ — which firms need a vertical the product does not have — and it is right about what it looked at. But the most expensive per-tenant blocker in the code is not sectoral at all: it is that the statement importer reads one bank, and every prospect has a bank. **Assumption, no source: the supported bank holds at most one in five primary banking relationships among Spanish construction SMEs, so roughly thirty of the thirty-seven Tier A+B firms are blocked on this single axis today.** The fix is not per-bank work: `INTEGRATIONS_PENDING.md` already names N43, the Spanish interbank statement standard that every Spanish bank exports, and a single adapter in the jurisdiction pack serves all of them — while also deleting the bespoke importer from the site layer where it does not belong. It pays back at two tenants. Nothing else on the board is close.

---

## 6 · The compounding claim

The phase brief asks, for each Tier-C pack, how many currently-L2 prospects it converts to L0, on the argument that the conversion and not the first customer's fee is the return. The answer requires one honest reconciliation first, because `05-TARGET-LIST.md`'s own layer labels and its Tier C groupings do not line up, and papering over that would produce a **compounding** claim that is larger than the evidence.

**The reconciliation.** Counted from 05's scoring table and Tier C write-ups, the thirteen Tier C firms carry these labels: the eight Pack 1 installers are scored **L1** — five at "L1 (43.2x installer family — maintenance-mix unknown)" and three at "L1 (name-inferred installer — no CNAE)" — not L2. Pack 2's two firms are one L1 (demolition and site preparation) and one **L2** (civil engineering). Pack 3's three firms are **L2+** (retail trade and real-estate development), of which 05's own quality audit confirms two are not contractors at all. So the literal count of currently-L2 prospects across all three named packs is **three, of which one is genuine.** That is the number, and inflating it would be exactly the kind of unforced precision 05 argues against elsewhere.

**But the L1 label on Pack 1's eight firms is itself too generous, and correcting it moves them into the count.** 05 describes the pack as needing "a recurring-contract object and a work-order spine that do not exist in any capability today". A new domain object in the vertical layer is L2; a spine that does not exist in any capability is L4. And since there is no plugin loader, 05's own instruction to price L1 as L2 applies anyway. So Pack 1's eight firms are **L2 (with an L4 component)**, not L1, and the corrected count of off-L0 prospects the three named packs convert is **eleven of thirteen** — eight at L2-plus-L4, one L2 civil-engineering firm, one L1 demolition firm, one genuine real-estate candidate — with two of the thirteen being extraction misses that should leave the pipeline rather than be converted.

**What each investment converts, stated per pack.**

**Pack 1 — recurring contracts and work orders for project-led installers. Converts 8 named prospects from L2 to L0.** It pays back at six of those eight, which is a 75% conversion requirement on firms whose revenue mix has not yet been confirmed by a call — tight, and it is the right investment anyway for the reason 05 gives: the Catalan population behind CNAE 43.21, 43.22 and 43.29 is about 14,357 firms, the largest adjacent segment Phase 1 identified, and the eight found in a 128-row extraction are a visible fraction of it rather than the whole. Build it _after_ the first Segment 2 reference converts, not before: selling an adjacency before the core segment has a named reference turns an asset into a project.

**Pack 2 — civil engineering and site preparation. Converts 1 L2 firm and 1 L1 firm; needs 7 to pay back. Decline, confirmed arithmetically.** 05 recommended against it on population size; the cost model agrees by a factor of three and a half, and 05's own note that one of the two reads more plausibly as registry noise than as a population signal makes the true denominator one.

**Pack 3 — promoción and real estate. Converts 1 genuine L2+ prospect; needs 7 to pay back. Decline, confirmed arithmetically.** Two of the three are extraction misses to be filtered from the sourcing query, not prospects of any tier.

**The two investments Tier C does not contain, and which compound harder than any of the three that it does.**

**The N43 bank-statement adapter converts no prospect's _sector_, and roughly thirty of thirty-seven Tier A+B prospects' _banks_.** Today a firm that does not bank with the one supported bank is L4 on an axis that has nothing to do with its trade, and the blocker sits in bespoke host code (`site/erp-import.js`) rather than in a pack. One adapter against a documented national standard, bound to `bank-statements@1` in the jurisdiction pack, moves all of them to L0, removes the bespoke parser, and costs 50 hours. It pays back at two tenants. **This is the single highest-return item identified anywhere in Phases 5 to 7, and it should be built before the first new-tenant sale closes, not after.**

**The plugin loader converts a cost class rather than a prospect list.** Every additive requirement — one extra document type, one extra report, one integration behind an existing port — currently costs €2,800 because it must ship as a reviewed package. With a loader it costs perhaps €840. That saves €1,960 each time and pays back after four such requirements, which across thirty-seven firms is a near-certainty rather than a forecast. It also makes the L1 band in the scoring rubric mean what it says, which matters for every future tier list.

**And the bridge pays back on one tenant.** The Spain-by-construction registers — the subcontracting book, the employer register, coordination of business activities, trade cards — are carried at zero captured value in `06-VALUE-CASE.md` Segment 2 and are therefore pure upside on nineteen Tier B firms plus eight Tier C installers. ADR-0011's bridge pattern bounds the work at one isolated module: 70 hours, €4,900, against a converted Segment 2 tenant's first-year margin of €5,132. One tenant.

**What compounding actually means here, stated without inflation.** It does not mean that each pack makes the next one cheaper — packs never import packs, by the architecture's own rule, so they do not compound into each other. What compounds is narrower and more durable: **each layer of investment permanently enlarges the set of prospects for whom the answer is a value in a file rather than a release.** The Spanish jurisdiction pack already did this once — it is why a second Spanish reformas firm is 11 hours and not 120 — and the boundary linter plus the negative test in `packages/factory/src/negative.test.ts` are what stop that gain leaking back out, because they fail the build when jurisdiction knowledge reaches a capability and when a tenant without a jurisdiction pack resolves quietly. The compounding is real and it is measurable in exactly one unit: the ratio of configuration hours to engineering hours per new customer. Today that ratio is 11 hours of configuration against zero hours of engineering for a Barcelona reformas S.L. with the supported bank, and 11 against 110 for the same firm with any other bank. Closing the second case is worth more than any new vertical on the board.

One caution to carry into Phase 8, and it follows directly from §4 rather than from any forecast. The nine blockers listed there total roughly **seven to fourteen weeks** of work before the shared-tier, control-plane, sign-in-ready path exists, and two of those nine are authorisation-shaped rather than feature-shaped. Until they are closed, every new tenant is a new stack with its own €108 a year, its own secrets and its own ~90-minute provisioning run — which is affordable at ten tenants, is the whole of the operational cost at a hundred, and is the reason ADR-0007 chose a shared tier in the first place. The factory resolves a tenant in under a second. The business around it does not yet.

# ASSUMPTIONS — decisions taken instead of questions

Every entry: what was decided, why, and how to reverse it. This file is the
operator's review channel.

## Tenant #1 intake (source: synthetic — a real intake overwrites cleanly)

Intake §1 was blank, so per mandate §0 the first tenant is synthesised. Every
field below is `source: synthetic` and lives in `tenants/reformas-demo/tenant.yaml`.

```yaml
company_name: Reformas Iberia Demo S.L. # source: synthetic
legal_form: S.L. # source: synthetic
cif_nif: B00000000 # source: synthetic (invalid on purpose — placeholder pattern)
location: Madrid, Madrid # source: synthetic
headcount: 20 (6 office / 14 field) # source: synthetic
annual_revenue: ~2M€ # source: synthetic
customer_mix: 70% B2C / 25% B2B / 5% public # source: synthetic
typical_project: 8–40k€, 3–10 weeks # source: synthetic
subcontractors: yes, mostly autónomos # source: synthetic
current_tools: Excel + WhatsApp + gestor # source: synthetic
biggest_pain: quoted-vs-actual drift per partida (margin leaks in modificados) # source: synthetic
must_keep: their gestor and their numbering habits # source: synthetic
languages: es-ES # source: synthetic
```

## Platform & runtime

1. **Reuse the existing verified foundation** (Turborepo/TS/Next/Prisma) as the
   factory substrate instead of restarting. Reversal: packages are standalone;
   any piece can be swapped. (Principle 9: boring, one language.)
2. **P1 persistence is in-memory behind kernel ports.** No Docker daemon in the
   build sandbox; correctness is proven by tests. The Postgres adapter (via
   existing `packages/db`, RLS per ADR-0007) is a P2 task. Reversal: implement
   the same `EventStore`/`Repository` ports with Prisma; contract tests already
   exist and run against any adapter.
3. **Execution via `tsx` + Vitest with `moduleResolution: Bundler`** for factory
   packages (new `packages/typescript-config/node-library.json`). Production
   build output is a P3 packaging task. Reversal: add tsup/esbuild build step.
4. **Naive semver matcher** (`^MAJOR` and `*` only) in the resolver — avoids a
   dependency; packs pin `^1`. Reversal: swap in `semver` package behind the
   same function.
5. **“Days of runtime” is implemented as resumability, not one long process**:
   every unit commits green and `PROGRESS.md` is the checkpoint; any restart
   continues. (Also logged in OBJECTIONS.md.)
6. **Multi-platform delivery** = responsive web (exists) now; PWA for
   mobile/tablet and Tauri shells for Mac/Windows are P3+ packaging tasks —
   the capability core doesn't care. Logged in OBJECTIONS.md too.

## Domain & money

7. **Money = integer cents; quantities = integer millis (thousandths); rates =
   basis points.** Rounding half-up (away from zero for negatives) **per line**,
   consistent with common Spanish practice under RD 1619/2012; gestor-level
   rounding differences are a known risk (RISKS.md). Reversal: rounding policy
   is a single kernel function.
8. **Tax rate history encoded from 2012-09-01 onward** (current 21/10/4 era).
   Dates before the earliest effective period **throw** rather than guess.
   Reversal: append earlier periods to the pack's rule table (data, not code).
9. **Renovation reduced-rate rule** implements art. 91.Uno.2.10º for
   `renovation_repair` works. Structural **rehabilitación** (art. 20.Uno.22º.B)
   is NOT auto-decided in v1: it conservatively falls back to the general rate
   with an explanatory justification. LEGAL_REVIEW.md tracks it.
10. **Missing eligibility attributes ⇒ general (higher) rate**, never the
    reduced one — conservative and defensible by construction.
11. **Invoices are immutable once issued; corrections are rectificativas**
    (credit-note style) in their own series. This is generic good practice the
    capability enforces; es-ES also requires it, ahead of Verifactu.
12. **Hash chaining** (SHA-256 over canonical JSON, per-tenant sequence) is
    implemented now as the es-ES chain adapter; the exact Verifactu _registro_
    field layout + QR (Orden HAC/1177/2024) is gated `legally_verified: false`
    until certified (deadline moved to 2027 — see LEGAL_REVIEW.md).
13. **Demo dates are fixed (2026-07-16)** via an injected clock so
    `make demo` is deterministic (principle 7).
14. **Line-item vocabulary**: capability stays generic (`lines`, `sections`);
    _partida/medición_ terminology and structures live in the reformas pack;
    tax-eligibility attributes travel as namespaced opaque keys
    (`construction.*`) interpreted by the jurisdiction adapter (ADR-0011).
15. **Boundary-linter “deliberate violation” is a committed fixture** the
    linter's own tests must flag — not a red commit on the mainline (mandate
    also demands every commit green; this satisfies both readings).
16. **IRPF retention**: general professional 15% / new-professional 7% /
    módulos 1% supported, selected by supplier profile; construction autónomos
    on _estimación directa_ (empresarial) default to **no retention** — the
    common real-world case, frequently gotten wrong. LEGAL_REVIEW.md has the
    citations; the profile field is explicit tenant data, not a guess.

17. **Persistence seam (P2.1a)**: capabilities take injected async store ports
    (`Repository`, `AppendOnlyStore`, `CounterStore`, `KeyValueStore`) defined
    in the kernel; in-memory adapters ship with contract-test kits that any
    durable adapter must pass unchanged (ADR-0007). Chain-head state is behind
    `KeyValueStore` (in-memory default until the durable hook lands in P2.1b).

## Diorka onboarding (real intake, 2026-07-17)

18. **"ERP START INPUT" baseline** = tag `erp-start-input` pinned by SHA in
    `docs/ERP-START-INPUT.md` (git proxy hides tags; the committed SHA is the
    durable record). New companies start via `factory new-tenant` — the
    baseline is conceptually present in every commit (no code forks exist).
19. **Diorka modelled as an owner GROUP over tenants** (BRD ORG-01..04): one
    tenant per legal entity, group registry `tenants/_groups/diorka.yaml`
    (pure data). Only entity #1 (`diorka`) exists until the BRD §11.1
    workshop confirms legal names — adding entities is `new-tenant`, minutes.
20. **Identity placeholders** in `tenants/diorka/tenant.yaml` are marked
    `source: pending-validation` (the BRD itself defers legal names/CIFs to
    its §11 workshop). Real values are a config-only overwrite.
21. **Sourcing comparison engine** built as a GENERIC capability (kernel-only
    vocabulary: lines/groups/bidders) — the Diorka evidence workbook is the
    motivating instance, not a special case. Missing price ≠ zero; selection
    explicit; prices dated + sourced (BRD SUP-03/04, Appendix A.1).
22. **Chapter catalogue** seeded into the reformas pack as config DEFAULT
    data (BRD Appendix A.2, Spanish wording) — tenants override freely;
    Catalan label set queued as config addition (NFR-10).
23. **Quote options & versions** implemented in the quoting capability
    (QUO-07/12/13): optional totals separate, acceptance selects options,
    revisions are new linked versions; accepted versions stay frozen.
24. ~~**cane.gestortectic.com** identified as a TecTic hosted "Gestor"
    instance (Catalan vendor; anonymous access 403).~~ **CORRECTED
    2026-07-17:** `cane.gestortectic.com` is Canei Subirats' own **public
    marketing website** (WordPress + Avada theme), not a login-gated gestor
    tool — the earlier 403 was transient/anti-bot, not an auth wall. The five
    page webarchives the operator supplied are the source. `gestortectic.com`
    is merely the hosting/staging domain their web agency uses.
25. **Real client identity = Canei Subirats, S.L.** (Carrer de la Creu 74,
    08960 Sant Just Desvern, Barcelona; hola@caneisubirats.com; 659 87 67
    00). The `diorka` tenant is the internal project/group codename; Canei
    Subirats S.L. is company #1's confirmed legal/trade identity, so the
    `tenant.yaml` branding + billing-seller placeholders are filled with
    these **public, first-party** values. **CIF (tax ID) stays
    `pending-validation`** — not published on their site; confirm at the BRD
    §11.1 workshop. Most reversible: fill known public facts now, keep the
    one unknown gated. Corporate identity captured in
    `docs/clients/canei-subirats/BRAND.md`.
26. **Working language = English; handover = Spanish/Catalan.** Per operator
    instruction we build the UI in English now and switch label sets before
    handover. UI strings are a **data label layer** (en/es/ca), not code, so
    the switch is config. Fiscal locale stays `es-ES` (Spanish VAT + money
    formatting `1.234,56 €`) — display language and fiscal locale are
    independent. Their live site (CAT default, ESP toggle) confirms
    Catalan-first is the handover expectation (NFR-10).
27. **"Execute the plan fully" (2026-07-17)** interpreted as: build the
    demonstrable **end-to-end customer-journey slice** now — the 12-stage
    lifecycle (lead→…→close), per-project financial control
    (budget/committed/actual/revenue/margin/cash/forecast), the full
    dashboard suite (pipeline, projects, margins, suppliers, purchasing, AR,
    AP, cash forecast, performance, alerts/tasks), and auto-drafted emails.
    R1→R4 in full is months of work; this cycle lands the working, visual
    whole-journey control tower + the email-drafting module so the vision is
    usable and inspectable. Most reversible: a self-contained interactive
    dashboard mirroring the real kernel logic (as `site/frontend.html` does)
    - real capability code behind it, all gates green. Deeper persistence
      wiring continues in later cycles.
28. **Emails: auto-generated, one Send press, never really sent.** Lifecycle
    events auto-draft an email (subject+body from templates that are DATA,
    not kernel/capability literals); the user edits if needed and presses
    **Send**, which drives a **log-only fake adapter** (`email-out@1`). No
    real email is ever sent from dev (mandate §3); real SMTP/provider stays
    in `INTEGRATIONS_PENDING.md` until the tenant supplies credentials.
29. **Premium redesign + review-request stage + Outlook drafts (this cycle).**
    E2E-tested the whole lead→invoice flow (headless, all 13 stages, ledger
    balances, no JS errors) and found the missing final step: a **review
    request**. Added it as the 13th lifecycle stage (`lead → profit → review`)
    across `site/journey.html` and `site/dashboard.html`, closing the
    reputation loop. Applied a lighter-white, winning-website design language
    (larger display type, generous whitespace, layered soft shadows, gradient
    accents, brand-mark SVG everywhere) to journey, dashboard and landing.
    Emails now render **full corporate identity** (logo, gradient bar, CTA,
    PDF-attachment chip, CI footer). **Outlook link:** no Microsoft Graph
    credentials/MCP exist here, so the most reversible honest option is a
    downloadable **`.eml` with `X-Unsent: 1`** — Outlook opens it as an
    **editable draft** in the compose window — carrying a **dependency-free
    generated PDF** attachment. Real save-to-Drafts via Graph is logged in
    `INTEGRATIONS_PENDING.md` (`outlook-drafts@1`) pending tenant M365 creds.
30. **More brand colour, still premium (this cycle).** "Less white, more their
    colours." Chose the most reversible strong-brand move: deep brand-green
    gradient headers with a white brand mark, a soft sage-green canvas (not flat
    white), richer green/gold washes, and a bold green featured card — while
    keeping white cards for contrast so it reads premium, not heavy. Tokens only
    - header markup; trivially tunable.
31. **Operator enters all data; site-visit photos; per-step project folder.**
    The journey page became a real client-side workspace: a full intake for
    every customer-journey input (feeds ledger/PDF/email automation), site-visit
    camera capture (`<input capture=environment>`), and a project folder with one
    subfolder per lifecycle step. Since the published site is static (no server),
    the most reversible honest implementation is browser-side: IndexedDB holds
    the project + files (photos compressed via canvas), artifacts (quote/invoice
    PDFs, .eml emails, notes) auto-file per step, and a dependency-free
    store-method ZIP writer (with CRC32) exports the real nested folder. Works on
    the live link and on mobile. The production equivalent (server-side folders
    on the docs/blob-store port) is described in the operations guide.
32. **Operations & setup PDF.** Built a branded, print-ready HTML guide rendered
    to a real 14-page PDF via the environment's headless Chromium (`page.pdf`):
    visual infrastructure diagram (SVG), layered architecture, 13-step process,
    RACI matrix, and a very detailed non-technical go-live setup (accounts → env
    vars → deploy → config), plus runbook, backups/GDPR, roadmap, glossary.
    Recommended hosting (Vercel + managed Postgres) is a suggestion, not a
    commitment — the hosting decision stays R4.
33. **Mobile fixes, best-practice documents, folder UX, process audit (this cycle).**
    From operator screenshots: (a) mobile was overflowing — root cause was
    grid/flex inputs without `min-width:0`; fixed that + wrapped wide stage tables
    in horizontal scrollers + small-screen type/padding. (b) Generated invoice/quote
    PDFs were too sparse — rebuilt them as full documents (seller+CIF, buyer+NIF,
    number, issue/due or valid-until dates, line items, base/IVA/total, IBAN +
    payment terms, and legal notes: art.91 justification, Verifactu 2027, immutable
    - rectificativa/SHA-256, guarantee). Added the missing intake inputs (buyer
      NIF/CIF, quote number, payment-terms days); dates auto from the browser clock.
      Seller CIF/IBAN are honest placeholders (pending validation). (c) Project-folder
      finder + step buttons made leaner (file-count badge, open/closed icons, current
      folder highlighted, one primary Download button, quiet Edit/Start-over links,
      '+ Attach file → folder'). (d) Step-by-step input→output audit added to the
      operations guide roadmap; the deeper practical gaps (quantity×unit pricing,
      deposit/certificación invoicing, IRPF retention, per-step dates, supplier/PO
      numbers, change orders) are mostly surfacing existing capability fields in the
      UI — configuration, not new architecture. Logged as roadmap, not built this cycle.
34. **Pages-email fix + interactive journey (this cycle).** (a) The Pages
    workflow triggered on `claude/**` pushes, which the github-pages environment
    rejects by branch protection — every branch push failed and emailed a
    failure. Restricted the push trigger to `main` (feature branches use
    workflow_dispatch). (b) Made the phase rail clickable (navigate to any
    reached stage; forward replays, back reviews). (c) Added a real estimator on
    the Estimate stage (qty × unit-rate lines → range; "Use as the quote"
    reflows chapters + ledger) — the estimate→quote path. (d) Gave every stage
    best-practice input fields (lead source; visit date/area; quote validity;
    acceptance date/method/deposit; project dates/PM; supplier/PO/delivery; bill
    no/date/progress; invoice date/type/IRPF; payment date/method; close
    date/notes; review platform/date), persisted + saved as details.txt; the
    invoice honours invoice date, type (full/deposit/certificación) and an IRPF
    retention line, regenerating live. Deeper best-in-class features (catalogue
    line-pricing, scheduling calendar, change orders) exist as capabilities and
    remain UI-surfacing roadmap, logged in the operations guide.
35. **"Build further" batch (this cycle).** (a) Locked zoom on all site pages
    (viewport maximum-scale=1/user-scalable=no + touch-action:manipulation) for
    premium navigation; added the missing viewport meta to frontend/backend.
    (b) Expanded the price-book catalogue to 34 items/11 chapters and shipped a
    complete itemised sample project (~€9.1k) with prefilled stage details.
    (c) Enhanced the estimator (catalogue quick-add, units, contingency %).
    (d) Added a scheduling timeline (tasks + mini-Gantt) on the Project stage and
    change orders (variations) on Execution — baseline frozen, current contract =
    baseline + variations, invoice revenue includes approved variations, new
    ledger row. (e) Upgraded the landing to a world-class page (feature grid,
    how-it-works ribbon, closing CTA). All client-side in the journey demo;
    reviewed end-to-end (full run, rail nav, valid 30-file zip, no JS errors,
    mobile clean). Production equivalents of scheduling/change-orders exist as
    capabilities; the demo mirrors them for the shareable link.
36. **iOS app — premium native shell over the live web app (this cycle).**
    Mandate: "build the iOS app so web changes flow through to the app later,
    make it very premium, best-in-class navigation, ship via TestFlight, give us
    a one-PDF manual of what to do on our side; then review/improve/audit in a
    loop until world-class; don't ask questions."
    Decisions (most reversible option, logged not asked):
    (a) **Architecture = native SwiftUI shell hosting the live GitHub-Pages web
    app in enhanced WKWebViews.** This is the single design that satisfies "web
    changes flow to the app automatically" — content/workflow/pricing changes
    need no App Store update; only native-shell changes (icon, tabs, OS) require
    a new build. Alternative (a full native rewrite of every screen) was rejected:
    it would fork the UI and break the "one change, everywhere" property that is
    the whole point. Files under `ios/` (kept out of the pnpm workspace and out
    of the boundary-lint scan, which only reads packages/kernel|capabilities|packs
    .ts — so no CI impact).
    (b) **Premium layer, all native:** animated brand splash, custom floating tab
    bar (material + gold matched-geometry pill + haptics), translucent top bar
    with a live determinate progress line, native pull-to-refresh, graceful
    offline state, native share sheet, JS⇄native bridge (haptics/share), and a
    `native-app` class + injected CSS that collapses the site's own header inside
    the shell so there is no duplicated chrome. Zoom already locked site-side.
    (c) **File exports work natively:** WKDownloadDelegate captures the web app's
    ZIP/PDF/.eml exports and routes them to the share sheet (Save to Files,
    AirDrop). Camera/photo Info.plist permission strings included for site-visit
    capture. Persistent WKWebsiteDataStore so the IndexedDB project workspace
    survives launches.
    (d) **Robustness (audit rounds):** tab bar as a bottom safe-area inset (web
    content never hidden behind it); re-tap active tab = scroll-to-top (preserves
    form state); NWPathMonitor auto-recovers the offline screen when signal
    returns (field-site drops); auto-reload on web-content-process termination;
    VoiceOver labels. Colour scheme forced light to match the locked-light web.
    (e) **Bundle id** = honest placeholder `com.caneisubirats.erp`; DEVELOPMENT_TEAM
    left empty for the operator to set (documented). No secrets committed;
    `.gitignore` blocks `*.p8`/certs. No real Apple uploads performed here — the
    operator runs them (fakes-behind-ports discipline extends to "no real
    filings/uploads on our behalf").
    (f) **TestFlight setup:** ready-to-open Xcode 16 project (file-system-
    synchronized) + XcodeGen `project.yml`/`setup.sh` fallback; fastlane `beta`
    lane; a **manual-dispatch-only** GitHub Actions workflow (never fires on
    ordinary pushes → no failure emails). Delivered a 12-page premium
    **iOS Beta Onboarding PDF** (`site/Canei-Subirats-iOS-Beta-Onboarding.pdf`,
    linked from the landing page) covering every manual step for a non-technical
    operator: Developer Program, App Store Connect app record, three build paths,
    the API key, inviting testers, a test checklist, updates, FAQ, glossary.
    (g) Could not compile here (no Xcode/Swift toolchain on Linux); mitigated with
    rigorous static review + an independent adversarial Swift review pass, and the
    guaranteed-valid XcodeGen regeneration path. The in-app web appearance was
    verified by simulating the shell in headless Chromium (inject `native-app`
    class + CSS at iPhone size) — headers collapse cleanly, no horizontal overflow.
37. **iOS build green on TestFlight + full automation & testing (this cycle).**
    (a) The CI TestFlight pipeline went green: build #9 compiled, signed
    (automatic cloud signing via -allowProvisioningUpdates + ASC API key on the
    ARCHIVE only — export reuses the installed profile; passing auth to export
    caused xcodebuild error 64), exported the .ipa, and uploaded. Sequence of
    real fixes (all logged in git): base64 .p8 secret (invalid-curve-name),
    empty-CI-env→default guard (env_or), apple-generic versioning for the
    build-number bump, absolute /tmp key path, archive-only auth, and finally
    **Xcode 26 / iOS 26 SDK** on macos-latest (Apple 409 rejects the iOS 18.5
    SDK). Team ID 5V62K942X6 and ASC key id/issuer baked in as non-secret
    defaults; only ASC_KEY_P8 (base64) is a required secret. I drove the runs
    myself via workflow_dispatch and read the logs to converge.
    (b) **Autonomous web E2E** (`tests/site-e2e/run.mjs`, `pnpm test:site`):
    serves `site/` and drives the whole journey in headless Chromium —
    sample→Start→advance 13 stages, asserts ledger revenue (€9,149.00), rail
    navigation, a valid PK-zip export, no console errors, and no 390px overflow.
    13/13 green here; CI workflow `site-e2e.yml` runs it on main/PR. It caught a
    real bug — no favicon → `/favicon.ico` 404 — fixed by adding `site/favicon.svg`
    (brand mark) + `<link rel=icon>` on all pages.
    (c) **Autonomous native UI tests** via Maestro (`ios/maestro/*.yaml` +
    `ios-ui-tests.yml`): builds the app for the simulator (no signing), boots a
    sim, installs, runs launch/tab-nav/journey flows, uploads a JUnit report +
    screenshots. macOS-only (can't run in this Linux env) — authored + documented,
    manual-dispatch to avoid failure emails. Mirrors the article's two ideas
    (fastlane deployment automation = already built; Maestro autonomous testing).

38. **Development preview site at /preview + direct-to-main (this cycle).**
    Operator wants a separate live URL to co-develop with a collaborator on the
    dev branch, promoting to production after alignment; also asked that changes
    go straight to `main` from now on. (a) `pages.yml` now assembles ONE Pages
    deployment: `main`→ site root (production), the dev branch → `/preview/`
    (dev). Preview pages get a small fixed "Dev preview" pill. All site links are
    relative, so the subpath works. (b) The `github-pages` environment only lets
    `main` deploy, so a dev-branch push can't deploy directly; `preview-refresh.yml`
    fires on dev-branch pushes and dispatches `pages.yml` on `main`, which
    rebuilds `/preview/` from the dev branch by name — auto-refresh with **no
    repo-settings change**. (c) Per operator instruction I now commit directly to
    `main` (branch + main kept in sync); the collaborative flow is: iterate on the
    dev branch → watch `/preview/` → merge to `main` to publish. Reversible: revert
    the two workflow files to return to single-site publishing.

39. **Reusable, self-improving "App Producer" agent + Template repo (this cycle).**
    Packaged the whole web→native-iOS→TestFlight→testing pipeline as a Claude Code
    agent (`.claude/agents/app-producer.md`) so it's reusable in any project/chat,
    and into the shared `stefangruber001/Template` repo (installer copies agents
    into a new repo's `.claude/agents/`). Made it **self-improving**: it reads a
    git-backed `learnings/LEARNINGS.md` ledger in the Template repo on start and
    appends new `symptom→cause→fix` learnings on finish, so every project teaches
    it and every call arrives updated. **Reversibility/decisions:** (a) named the
    agent "App Producer" (per operator) and superseded the earlier
    `ios-web-shipper.md` rather than keeping both, to avoid a stale duplicate —
    git history preserves it. (b) Ledger lives in the Template repo (single shared
    memory across all projects), not per-project. (c) Hard guardrail baked into
    the agent + ledger header: **never** persist secrets, `.p8`/keys, tokens, PII
    or client-confidential data — only generalizable technical learnings. (d) The
    installer copies agent files only; learnings are pulled by the agent at
    runtime so a stale local copy can't shadow newer shared knowledge.

40. **Master Data + Financial Data tabs (this cycle).** Operator asked for two
    full, best-practice tabs capturing _everything_ to run the company, structured
    for automation. (a) **`site/master-data.html`** — a schema-driven register
    (21 entities across Organisation, Commercial, Supply, Catalogue & Pricing,
    Operations & Resources, Governance & Automation): company/legal, branches,
    bank accounts, numbering, customers, contacts, leads, suppliers/subcontractors
    (with IRPF profile), payment terms, items/catalogue, chapters, price lists,
    VAT codes, UoM, warehouses, stock, team, equipment, projects, documents,
    automation rules. Add/edit/delete via a typed drawer, search, seed sample,
    IndexedDB persistence, **Export/Import JSON** (the automation feed). (b)
    **`site/financial-data.html`** — chart of accounts + monthly P&L ledger + BS
    snapshots + AR/AP open items + VAT + loans + bank + drivers, which **compute**
    the P&L (actual vs budget), Balance sheet (with A=L+E check), Cash flow
    (indirect, reconciled to cash), a KPI cockpit (GM, EBITDA, DSO/DPO, ratios,
    net debt…) and AR/AP aging. **Decisions:** seed data is synthetic and
    deliberately **fully reconciling** (verified in the E2E: BS balances, CF ties
    to cash, aging totals match AR/AP); money as euros for capture (kernel keeps
    integer-cent); everything derived, not typed, so it is automation-ready.
    Wired into `index.html` cards and as two iOS tabs (Master, Finance) in
    `Config.swift` — the tabs need one TestFlight build, but the Home tab's new
    cards already reach both pages in-app now. Extended `tests/site-e2e/run.mjs`
    (now 26/26): both pages load clean, no 390px overflow, Master Data record
    persists across reload + exports JSON, Financial statements compute and
    reconcile. Reversible: both are standalone static pages; revert the cards/tabs
    to remove.

41. **Production-hardening cycle + 4-persona review + 5× simulation (this cycle).**
    Operator mandate: remove developer comments/hints, make the environment
    production-ready, run 4 real-world-trained persona agents (operator, customer,
    supplier, owner) that walk the process and report gaps, run 5× end-to-end
    simulation, strengthen premium/lean/mistake-proof UX, and produce a handover.
    **Done:** (a) stripped demo/dev language across all user pages; (b) mistake-
    proofing — locale-safe `num()` for Spanish decimals across 38 journey fields,
    VAT picker, NIF/CIF-checksum + email required before start, Master-Data
    duplicate guard + import confirm; (c) customer trust — Spanish emails,
    WinAnsi PDF accents, removed internal QA text + "(pending)" from invoices,
    term-driven (not hardcoded) email terms, unified phone; (d) Control-Tower
    correctness — 10× budget typo, AR aging buckets, honest cash forecast
    (incl. payroll), revenue-weighted margin. Verified: site E2E 26/26 across 5
    stable runs. **Decisions:** where a gap was structural (single dataset across
    pages, cross-store linking/customer-picker/auto-numbering, real itemised PO +
    retention application, per-partida cost + change-order cost, 13-week cash
    forecast, project/customer profitability, compliance alerts, partial billing,
    multi-device backend, WhatsApp), I implemented the contained high-impact fixes
    now and captured the rest as a prioritized roadmap in `HANDOVER.md` rather
    than half-build architecture. CIF/IBAN remain placeholders (we lack the real
    values) — the go-live checklist and invoice guard flag that the operator must
    set them before issuing invoices. Reversible: all edits are contained per file.

42. **BRD v2 (Proyecto Diorka, 28-Jul-2026) implementation cycle.** Owners'
    updated requirements read line by line (1,382 lines) and implemented per the
    document's own §11 phasing (Phase-1 MVP + explicitly requested Phase-2 items).
    (a) **One integrated engine** (`site/erp-engine.js`, money in cents,
    Node+browser) implementing MDM/CRM/VIS/CAT/SUP/PRE/QUO/CON/PRJ/PLN/LAB/PUR/
    CHG/AR/AP/BNK/GES/VFU/PAY/FIN/DOC/DAS with gap-free numbering (ORG-04),
    audit trail (ORG-07) and a chained invoice event log (VFU-01). (b) **Year
    simulation** (12 months × 3 projects) — 145/145 invariants across 5 seeds.
    (c) **Home rebuilt as an ERP launchpad** per DAS-01 with live indicators from
    the same dataset; **`erp.html` workspace** with Torre de control (DAS-02/03),
    day views (DAS-04/05) and all modules incl. the BNK-02 allocate-by-project-
    number flow. **Decisions:** single entity = Canei Subirats, S.L. (ASSUMPTIONS
    #25; BRD names roles, not names); new-page UI in Spanish per NFR-10 while
    older analytical pages remain English (recorded as PARTIAL in the trace);
    former-entity history handling (ORG-03) modeled via `legacy` flag; deferred
    items follow the BRD's own Phase 2-4 list (bank feeds, portal imports, OCR at
    scale, e-signature, certified Verifactu provider, customer portal). Merged
    Ignacio's parallel `clientes.html` + iOS Clients tab (kept, linked from the
    launchpad). Reversible: all new files are additive; the old home is in git.

- **#43 — Google Play twin app ships as a WebView shell with scrollable tab bar (2026-07-28).**
  The Android app mirrors ios/Config.swift exactly (same 7 tabs, same /preview base URL) as a
  classic-Views WebView shell (no Compose) to keep the first CI build low-risk. Android's bottom
  navigation caps at 5 items, so the 7 tabs use a scrollable Material tab bar instead. Signing
  falls back to the debug key when secrets are absent so the pipeline is testable before the
  Play account exists (PLAY-SETUP.md). Reversible: swap to Compose/bottom-nav later without
  touching the pipeline.
- **#44 — Session-limit pause honoured per operator mandate (2026-07-28).** The i18n-extraction
  and field-audit agent fleets hit the platform session limit (resets 20:30 UTC). Completed
  results were banked (scratchpad *-partial.json), high-value fixes continued in the main loop,
  and both workflows are scheduled to resume automatically after the reset — matching the
  operator's standing instruction to pause on empty cloud quota and restart when it returns.
- **#45 — CANEI functional-spec programme, session 1: close the CI gap before any feature work
  (2026-07-31).** The owner's `20260731_REQUERMIENTOS BÁSICO CANEI.docx` was turned into a
  12-session implementation plan (hybrid architecture: new domain logic as `packages/`
  capabilities, bundled by esbuild into `site/erp-factory.js`, reached through a new
  `site/erp-bridge.js` seam; `erp-engine.js` retired area by area; see `docs/worklog/WORKLOG.md`).
  Session 1 found that `site-e2e.yml` triggered on `push: branches: [main]` only, while
  `preview-refresh.yml` republishes `/preview` — the exact URL the iOS/Android beta builds load —
  on every push to the dev branch. A direct dev-branch push could therefore reach beta users with
  zero browser-level or business-invariant test coverage. Fixed: `site-e2e.yml` now also triggers
  on `claude/**`; the two business simulations moved into a new `ci.yml` job (`simulations`,
  unconditional on every push/PR, not gated on `site/**` paths) alongside a new
  `tests/parity/ownership-guard.mjs` validating `site/erp-ownership.json` — the migration-state
  record the whole programme's strangler-fig discipline depends on. Also captured a frozen,
  real (not fabricated) `tests/fixtures/state-v1-seed.json` from the live seed, for session 3's
  migration ladder to prove against. No product code changed. **Verification note:** this working
  environment has no Node.js runtime; every script above was nonetheless actually executed (not
  estimated) via a throwaway JavaScriptCore-based Node shim built for this session (not committed)
  — baseline confirmed green at 145/145, 206/206 and 34/34 invariants before any edit. The real
  `pnpm` gate was not run locally and should be the first check in the next session. Reversible:
  all changes are additive (new files, new CI job, widened trigger); no legacy behaviour removed.
- **#46 — CANEI session 2: the capability seam, and how it is built without a local toolchain
  (2026-07-31).** `packages/erp-browser` (a HOST package, outside the boundary linter's layer
  matrix like `packages/factory`) bundles typed capabilities with esbuild into two committed
  artifacts, `site/erp-factory.js` (IIFE) + `.cjs`, which `site/erp-bridge.js` calls on behalf of
  `erp.html`. Committed rather than built at deploy time because `pages.yml` publishes `site/**`
  from a bare checkout with no Node; CI rebuilds and diffs them, and also asserts they stay
  tracked (`git diff` ignores untracked files, so a deleted artifact would pass silently).
  **Decisions:** (a) the bundle build lives in `ci.yml`, not a `workflow_dispatch` workflow —
  dispatch only registers from the default branch and this work never pushes to `main`; the job
  uploads the artifact so a machine with no Node can still obtain a built bundle. (b) Browser
  target `es2020`, not `es2019`/`safari14`: the conservative target made esbuild fail trying to
  downlevel a dependency's destructuring, and had no audience — every runtime loading this bundle
  is a modern WebView. (c) `"sideEffects": false` on all 16 capabilities + kernel so zod
  tree-shakes out (verified: 5.7 KB bundle, no zod; CI fails if `ZodError` reappears).
  (d) `BrowserIdGen` overrides the kernel's `RandomIdGen`, which calls
  `globalThis.crypto.randomUUID()` — undefined in a non-secure context and older WKWebViews,
  where it would throw on first id and blank the page. (e) The first bridge call is a _derived
  read_ (task counts by status in Mi día), not an ownership move: doing both at once would have
  confounded "is the pipeline correct?" with "is the migration correct?". **Constraint worth
  recording:** this environment has no Node/pnpm/esbuild, so `pnpm-lock.yaml` could not be
  regenerated — the new package's importer entry was hand-written and passed `--frozen-lockfile`
  in CI (shape recorded in `docs/worklog/SESSION-02.md`). Reversible: `erp.html` degrades to its
  previous behaviour if the bundle is absent, and nothing was removed from `erp-engine.js`.
- **#47 — CANEI session 3: the persisted state gets a version, and one owner (2026-07-31).**
  `ERP.from(json)` assigned the stored blob straight onto `this.state`, which is fine until the
  shape changes and a live data-loss hazard the moment it does. Added `site/erp-migrations.js`
  (pure, idempotent ladder; v1→v2 purely additive, declaring the four collections the engine
  creates lazily plus `importConflicts`/`imports`) and `site/erp-store.js` (the only module that
  touches IndexedDB; `caneiERP` v2 adds `blobs` + `meta` while leaving `kv`/`"state"` at exactly
  the same coordinates so existing data is untouched; writes a one-shot `state.backup.v<n>` before
  migrating). **Decisions:** (a) migration runs in the host, NOT inside `ERP.from` — putting it in
  the engine would make `erp-engine.js` depend on the new persistence layer, the old→new direction
  the strangler rule forbids, and would risk the two Node simulations that `require()` it.
  (b) A blob newer than the build **throws** rather than being downgraded, and `erp.html` shows a
  dedicated screen instead of reseeding over it — the case is real, because the web ships
  continuously to `/preview` while the shells ship through store review. (c) Import conflicts
  surface as a Torre _view banner_, not through the engine's `alerts()`, which `year-sim.mjs`
  asserts on. (d) `caneiMasterData` is imported one-way but **not deleted** (most reversible);
  `caneiFinance`/`caneiJourney` are deliberately untouched per spec §6 and session 12.
  **Also fixed a live bug:** `index.html` hardcoded `indexedDB.open("caneiERP", 1)`, which would
  have thrown `VersionError` and blanked the launchpad the moment `erp.html` upgraded the schema;
  it now reads through `ErpStore` like every other page. Two new simulations (`migrations-sim`,
  `import-sim`) run in CI; the import test asserts what the import must REFUSE as hard as what it
  does. Reversible: `kv`/`"state"` coordinates unchanged, backups written, legacy stores intact.
- **#48 — CANEI session 4: one workspace, three panels, and four screens retired (2026-07-31).**
  Spec §1 replaces the flat side menu with sections → subsections → content, adds a global bar
  (universal search, contextual create, alert bell, period selector, profile/help) and states that
  the old home page "ceases to exist as an intermediate screen". **Decisions:** (a) the hash stays
  the _subsection_ key, unchanged from the flat menu, so every deep link — including both native
  shells' tabs, the e2e suite and printed links — still lands where it did; the section is derived
  from the subsection, never routed to. (b) `index.html`, `dashboard.html`, `clientes.html` and
  `frontend.html` become redirect stubs rather than deletions: the site root, GitHub Pages and the
  shells' cached tabs all resolve to files that must keep existing, and a stub is the most
  reversible retirement. They use `location.replace`, so a retired screen never sits in history.
  `index.html` is retired too even though the session brief only listed the other three — §1 is
  explicit that the system opens straight on the control tower. (c) Subsections the spec defines
  but the code cannot serve yet (compras, subcontratos, seguimiento técnico/económico,
  modificaciones, conciliación, comunicaciones, reportes) render a short "en preparación" card
  saying what will live there and linking to where that data is managed today. A menu entry that
  opens a blank panel is worse than one that explains itself. (d) The period selector defaults to
  **year**, and its reference date is the dataset's `today`, not the wall clock: this dataset lives
  in its own exercise year, so a wall-clock period would empty every table for reasons the user
  cannot see. Every filtered table prints how many rows it is hiding. (e) The period lives in the
  store's `meta` object store, **never in the state blob** — it is a preference, not business data,
  so it needs no schema migration and can never collide with an engine key. (f) "+ Crear" calls the
  engine's own `addOpportunity` / `createQuickProject` / `addTask` / `addParty`, so every validation
  and audit-log entry applies exactly as it does elsewhere: the bar is a shortcut to existing rules,
  never a way around them. (g) The spec says "eight sections" but enumerates seven (chapters 2-8);
  seven are implemented, and the eighth is not invented here. **Ownership:** `three-panel-shell`
  moves `unbuilt` → `engine` with `engineSection: null` — it is view-layer only, and the schema has
  no "view" owner value. Reversible: the retired pages' previous content is one `git revert` away
  and no engine code changed.
- **#49 — CANEI session 5: the planning engine, and where a calendar is allowed to live (2026-07-31).**
  Spec §3.3 wants a Gantt with FS/SS/FF dependencies, positive and negative lag, a working calendar
  with closures, automatic movement of the finish date, a critical path and a baseline frozen at
  approval. Session 5 built all of that as domain code in `@repo/capability-scheduling`; the chart
  itself is session 6. **Decisions:** (a) the working calendar is **data**, not knowledge —
  `workingWeekdays` + `nonWorkingDates` arrive from the host, and the fallback for a plan with no
  calendar is a **seven-day** week. Defaulting to Monday-Friday would have put a jurisdiction
  assumption inside a capability, which the architecture forbids and the forbidden-literal linter
  cannot catch. (b) Float and baseline drift are counted in **working days**: a plan crossing a
  two-week closure has not slipped two weeks, and saying it has sends someone to a site meeting
  with the wrong number. (c) Dragging a task sets a **start-no-earlier-than pin**, not a fixed
  date — it holds the position a human chose but still moves when a predecessor pushes it later,
  because the alternative is a chart that silently produces impossible plans. (d) **FS, SS and FF
  only.** The spec names those three; start-to-finish is left unimplemented rather than
  half-implemented. (e) Every new `Task`/`Plan` field is **optional**, so the hand-built plans
  `site/erp-bridge.js` produces (no calendar, no durations, no links) still schedule — durations
  are read back off the dates — and no persisted data needed migrating. There is a test pinned to
  exactly that legacy shape. (f) The calendar walkers are **bounded** (3660 days): a config with no
  working weekday is one typo away and would otherwise hang the scheduler instead of failing it.
  (g) `scheduling-gantt` stays **`unbuilt`** in `site/erp-ownership.json` even though the domain now
  exists and ships in the bundle — an area becomes `factory` when `erp.html` genuinely goes through
  the bridge for it, and anything else makes that file describe intentions instead of code.
  (h) `SURFACE_VERSION` 1 → 2, and the engine is reached as `service` rather than through named
  passthroughs: wrapping an API before its caller exists is how a surface collects methods nobody
  calls. **New guard:** `tests/simulation/scheduling-sim.mjs` drives the engine through the
  **committed** `site/erp-factory.cjs`, keeping "the capability is correct" and "the artifact the
  phones load is correct" as two separately-proven claims. Reversible: the capability's previous
  API is untouched and nothing in `site/` calls the new code yet.
- **#50 — CANEI session 6: the chart, and keeping the arithmetic out of it (2026-07-31).**
  Spec §3.3 asks for a Gantt with FS/SS/FF dependencies, lead/lag, a working calendar with
  closures, a finish date that moves by itself, a visible critical path, the contract's payment
  milestones on the same timeline, a baseline frozen at approval, and "interacción simple:
  arrastrar para mover, tirar del borde para alargar, y unir tareas con el ratón". Session 6
  built exactly that in `erp.html` (Proyectos → Seguimiento técnico) over session 5's engine.
  **Decisions:** (a) **the view computes no dates.** Bar positions, floats, the critical path, the
  finish and baseline drift are all asked of `@repo/capability-scheduling` through
  `ErpBridge.scheduling.plans`; the only arithmetic in the chart is pixels ↔ _calendar_ days for
  the axis and for turning a drag into a date, and working-day questions go back to the engine's
  own calendar helpers (newly exposed on the browser surface, `SURFACE_VERSION` 2 → 3). A second
  implementation of working-day maths in the view would disagree with the engine the first time
  someone added a closure. (b) **Plans persist in `state.plans` (schema v3)**, one per project:
  a capability-owned value riding inside the engine's blob, which `erp-engine.js` neither writes
  nor knows about. Cheaper and more reversible than a second IndexedDB store, and it is the
  strangler seam working as designed. (c) **Dragging sets the engine's start-no-earlier-than pin**
  rather than a fixed date, so successors still follow and the plan stays possible. (d) **Payment
  milestones are drawn, never scheduled** — they belong to the contract, and letting the planner
  move them would let a chart edit a contract. (e) **`seedFromChapters` is explicitly a seed**;
  session 10a owns the real budget→plan derivation. It exists so a chart opened on a real project
  is not an empty grid, and only runs when the user asks. (f) **The default five-day calendar
  lives in `erp-bridge.js`**, a host file allowed to hold local convention; the capability keeps
  its seven-day neutrality and tenant config will replace that one constant. (g) **Gestures use
  Pointer Events**, one path for mouse, pen and touch — the ERP runs in two WebViews and a
  mouse-only chart would be useless on the site visit it is for. (h) `scheduling-gantt` →
  **`factory`**: the first area the capability layer owns end to end.
  **A trap worth recording:** SVG geometry attributes are overridable by CSS in Chromium, so the
  chart's `class="bar"` inherited the table progress-bar rule `.bar{height:7px}` and silently
  flattened every bar. All chart classes are now `g`-prefixed and the e2e asserts bar height, so
  it cannot come back. Reversible: no engine code changed, and the migration only adds an empty
  object.
- **#51 — CANEI session 7: the reader, and where a country's paperwork conventions live (2026-08-01).**
  Spec §5.2 (Improvement #2) wants a photographed supplier invoice to pre-fill a received-invoice
  record: issuer and tax id, number, dates, base, tax — several rates allowed — withholding, total,
  payment details and an order reference, each with a confidence, each traceable back to the part of
  the image it came from, and nothing taken as true without explicit human confirmation. Session 7
  built the reading half. **Decisions:** (a) `ExtractionResult.confirmed` is the **literal type
  `false`**, not a boolean — a caller cannot accidentally persist a confirmed-looking extraction,
  which is the strongest form CAP-04 can take in a type system. (b) All locale knowledge sits behind
  a **required** port, `extraction-profile@1`: number and date notation, tax-id shapes and their
  check characters, the words that announce each field, and which tax rates were law on a given
  date. Required rather than optional because an extractor with no profile silently reads nothing,
  and resolve-time failure is exactly what a required port buys. (c) The profile is an **adapter,
  not config**: it carries behaviour (parsers, checksum algorithms), and adapters are how behaviour
  crosses a layer boundary here. (d) **An unlabelled amount is never the answer** — every number on
  a page looks like every other, and only a word beside it says which is the net and which the
  total; unlabelled amounts are offered as alternatives instead. The first version got this wrong
  and nominated a random number as the withholding on documents that have none, which contradicted
  the arithmetic and dragged every other field's confidence down with it. (e) A **failed check
  character caps confidence at 0.5**, applied after every other bonus, so a beautifully labelled
  wrong tax id still reaches a human. (f) `recheck()` lives in the capability so the validation
  screen re-runs the _same_ arithmetic rather than a second copy in the view. (g) The Spanish
  profile resolves expected rates from the pack's **effective-dated** tables, and declines to guess
  for a date before the earliest encoded era. (h) `extraction-ocr` stays **`unbuilt`** in the
  ownership file: the domain exists and is composed into tenant #1, but no screen reaches it until
  session 8. **Tooling earned its keep:** the boundary linter rejected a rate-like literal in my own
  doc-comment inside the capability, and a fabricated CIF in a fixture was caught by the very
  control-character algorithm the session added. Reversible: nothing in `site/` changed, the browser
  bundle is untouched, and the capability is additive.

- **#52 — CANEI session 9: the constructor, and pictures that stay out of the table (2026-08-02).**
  Spec §3.3 asks for a three-zone budget constructor and, as Improvement #1, a graphic annex:
  pictures attached to a line but printed at the end of the document rather than in its row.
  **Decisions:** (a) **The constructor computes no money.** Every figure it shows — line amounts,
  chapter subtotals, base, tax, withholding, total, margin, the value of lines still pending a
  price — is asked of `erp.budgetTotals()`, the same function the emitted document uses, so the
  "live" panel is genuinely live rather than an optimistic copy that drifts from the document by a
  cent and is discovered by a customer. `budgets-versions` therefore stays `engine`: the
  constructor is a view. (b) **The annex layout is a capability** —
  `@repo/capability-docs/annex.ts` — because grouping, ordering, correlative numbering, pagination
  and which rows carry a mark are generic document composition with no sector or jurisdiction in
  them. It is reached only through `ErpBridge.docs.annex`, and its tests use groups and items, not
  chapters and lines. (c) **Annex options are an argument, not tenant config,** so they are plain
  values with plain defaults rather than a zod schema: importing the schema into the browser
  surface pulled all of zod into the committed bundle and took it from 23 KB to 152 KB, to validate
  two numbers in a bundle that ships to a mobile WebView. (d) They are **repaired, not rejected** —
  a stored `imagesPerPage: 40` clamps to 12 rather than making a customer's quotation unprintable
  over a formatting preference. (e) **Default: annex on, two per page.** On costs nothing when no
  line has a picture, and two is what stays readable on a portrait page. (f) **Issuing a version
  snapshots the annex settings onto it.** The images were already frozen (a version deep-copies its
  chapters), but the settings live on the budget and would otherwise keep changing under a document
  that was already sent. (g) **Internal-only images are dropped by `renderBudgetDoc`,** beside cost
  and margin: a value that never enters the customer document cannot leak out of one. (h) **A
  deleted image does not delete its blob** — an earlier frozen version may still reference it, and
  orphaning a sent document's picture to reclaim a few kilobytes is the wrong trade. (i) **The seed
  gained a fifth budget, left in draft.** Every other seeded budget is issued or accepted, hence
  frozen, which made the constructor impossible to see or test; a real pipeline always has one
  budget in preparation. Its four demo pictures are _drawn_ on a canvas at first run, so no binary
  enters the repository and nothing is fetched over the network. (j) **Keystrokes do not reach the
  audit trail.** The grid writes through on every keystroke so the totals are real, and logs once
  when a field is committed — an audit entry per character is a trail nobody reads. Reversible: the
  annex is switchable per budget and off means no pages and no marks; the schema step (v4) is
  additive and idempotent, and the constructor is an alternative view of data the engine already
  owned.

- **#53 — CANEI session 10a: what a plan is derived from, and what a cost is heading for (2026-08-03).**
  Spec §4 asks for one project as the context of every subsection; §4.3 for a Gantt built from the
  accepted budget, progress recorded by executed quantity, planned-vs-actual-vs-projected and a
  deviations panel; §4.4 for per-chapter budgeted/committed/actual/**projected** with the margin
  that results. **Decisions:** (a) **The plan is derived, not seeded.** Session 6's placeholder gave
  every chapter five days; the real derivation reads the accepted version's lines, and each
  duration is quantity ÷ the daily output of that unit in that chapter. The division is the
  capability's, the rates are the **vertical pack's** — put them in the capability and the planner
  works for exactly one trade in one country. (b) **Derived task ids come from the caller's own
  references, not a generator.** That is what makes re-deriving after a quote change a merge rather
  than a reset: progress, pinned dates and frozen baselines survive for every line that survived.
  (c) **The actual-progress curve is drawn from an append-only progress log**, never from today's
  percentages. Dates and the critical path recompute from the network whenever you like; "how much
  was done by the end of March" exists only if somebody wrote it down in March, and a curve that
  drew today's figure backwards would make every past week look like it went to plan. Where the log
  is empty the actual line is `null`, not zero — "nobody recorded anything" and "nothing was done"
  are different claims. (d) **The projected line is labelled an extrapolation** and its
  `performanceIndex` is returned, so what it rests on is visible. (e) **A cost forecast never comes
  in below what is already spent or committed**, and a chapter with _nothing booked_ keeps its
  budget whatever its progress says: finished-with-no-bill overwhelmingly means the bill has not
  arrived, not that the work was free, and forecasting zero there hands the project a profit it is
  about to lose. This was caught by driving the seeded data, not by reading the code — two of the
  five chapters forecast €0. (f) **A manual adjustment requires a reason and never replaces the
  calculation**: both figures are reported, because the reason is the only reviewable part of a
  judgement call. (g) **Progress is written to both records in one action.** The budget's chapters
  feed certification and the economics; the plan feeds the chart and the curve. Letting a user
  update one is how a job comes to be 80 % done on one screen and 40 % on another, so the bridge
  writes both — a projection concern, not a rule, which is why it lives there. (h) **The project
  context is the section's, not a screen's.** One selector above every subsection, with favourites
  and recents in `meta`; `gProject` was promoted from the chart's local dropdown. (i) **The browser
  bundle now composes a PACK.** `@repo/erp-browser` is a host and may; the import is the pack's
  zod-free `rates` subpath, because a validation library has no business travelling into a phone to
  look up a number in a table. (j) `project-economics` and `scheduling-gantt` are **`factory`**;
  `projects` stays **`engine`** — the baselines, numbering and cost ledger are correct where they
  are, and only the two derivations that did not exist anywhere moved. Reversible: the derivation is
  a button the user presses, the schema step (v5) is additive and idempotent, and every new figure
  is a read-side derivation over data the engine already owned.

- **#54 — CANEI session 10b: what "comprometido" actually means, and where a block earns its place over an alert (2026-08-03).**
  Spec §4.1 (Compras), §4.2 (Subcontratos), §4.5 (Modificaciones Contractuales) and §4.6 (Personal y
  Horas). **Decisions:** (a) **A purchase order's lifecycle is derived, never stored as its own
  field.** `purchaseStatus(pu)` reads `sentAt`/`acceptedAt`/`receipts`/`status.delivered`/
  `status.invoicedBillId`/`status.paid`/`cancelledAt` and computes draft→sent→accepted→partial→
  received→invoiced→paid — a status string that forgets to update when, say, a payment is voided
  is a worse bug than any of the fields it would replace. (b) **"Comprometido" includes awarded
  subcontracts, not just purchase orders.** `committedByChapter`/`committedCostCents` were
  purchases-only since session 10a; §4.1 and §4.4 both define comprometido as "órdenes y
  subcontratos adjudicados", and the economics screen would have quietly undercounted every
  project with a subcontract on it. A terminated subcontract counts only what was actually
  certified, never the full award — the rest was never going to be spent. (c) **Starting work on
  site is BLOCKED, not merely alerted, on expired or missing mandatory documentation** (insurance,
  PRL, Social Security registration) — the one rule in this session that took the harder of the
  two available forms on purpose, because §4.2 says so explicitly ("bloqueo ... si está vencida")
  and because letting an uninsured trade start is the kind of thing a dashboard tile should not be
  the only defence against. (d) **Recording hours against a closed project is refused outright**,
  for the same reason: it makes the spec's own "horas imputadas a un proyecto cerrado" alert
  structurally impossible going forward rather than a thing to notice after the fact — a stronger
  guarantee than an alert is, wherever prevention is cheap enough to build. (e) **`priceChange`
  gained a `scheduleImpactDays` parameter inserted BEFORE `user`**, not after: every existing
  caller (the seed, year-sim) passes exactly three positional arguments and has never passed
  `user`, so the new parameter could go in the one slot that changes nothing for them. (f) **A
  change order's schedule effect is applied to the Gantt through an explicit, separate action**
  (`ErpBridge.scheduling.plans.applyChapterDelay`), not automatically inside `approveChange` — the
  engine's approval only ever touches the budget's numbers, and folding a Gantt mutation into that
  call would make one action responsible for two systems of record. The baseline is "conserved" for
  free, because a baseline is a frozen snapshot `setDuration` never touches. (g) **The adenda
  document has no cost or margin field**, the same QUO-10/PRE-08 rule the budget document already
  follows, for the same reason. (h) **The weekly hours grid deletes a cell's entry when its value
  is set to zero**, rather than leaving a stray zero-hour row — "corregir y eliminar" for a grid is
  one gesture, not two. (i) A grid cell that already carries more than one entry (hours split
  across chapters by hand) is rendered read-only with a note pointing at the register table below,
  rather than the grid silently collapsing a split day into one number. Reversible: every new
  method is additive over existing collections, schema v6 backfills every new field to its
  pre-existing default, and nothing here removed or renamed anything session 1-10a built.

- **#55 — CANEI session 11: where a suggestion earns trust, and the three refusals of Administración (2026-08-03).**
  Spec §5.3 (Conciliación bancaria), §5.4 (Banco y caja), §5.6 (Gestoría) and §5.7 (Comunicaciones).
  **Decisions:** (a) **Every match suggestion carries its reasons, and the screen renders them.**
  `@repo/capability-reconciliation` returns `{confidence, reasons, differenceCents, combination}`
  rather than a bare score, because a person is being asked to accept or reject a proposal and
  "0,99" gives them nothing to judge on. A confidence with no argument behind it trains people to
  click accept without reading, which is the exact failure the screen exists to prevent. (b)
  **Direction is a gate, not a weight.** A credit can never be explained by a supplier bill, so a
  wrong-direction candidate is excluded outright instead of scoring low and surfacing under a
  thin threshold. For the same reason an amount outside tolerance returns nothing rather than a
  weak guess: a suggestion nobody should accept is worse than no suggestion. (c) **A single
  document outranks a combination of equal confidence**, and combinations stop at three — beyond
  that the search finds coincidences, not explanations. (d) **Allocation was removed from the
  Banco screen entirely** (§5.4's "retirando la parte de asignación"). Casar un movimiento con su
  documento y repartirlo entre obras is one gesture; doing it in two screens produced movements
  assigned to a job with no invoice behind them. Banco keeps position, movements and forecast, and
  links across. (e) **`quarterlyPackage` now REFUSES**, naming up to four outstanding items rather
  than counting them. §5.6 allows exactly two ways past — the list is empty, or every item has been
  justified by name — so `acceptException(quarter, key, reason, user)` requires a written reason and
  there is no third route. A `force` flag was written during this session and then deliberately
  removed: an override nobody ever takes back out is how the check stops meaning anything. The
  year-sim was updated to justify each exception, which is what a real quarter-end does. (f) **The
  completeness traffic light is per block, not one number** — the eight blocks fail independently
  (an empty cash register in a quarter with no petty cash is fine; an empty issued-invoice register
  in a quarter that billed is not) and an aggregate hides which one. (g) **Late documents are amber,
  never red**: an extemporaneous document is a fact to declare in its own block, not an error to
  fix, and §5.6's goal is that the block shrinks over time, which needs it visible rather than
  alarming. (h) **The communications rule default is `mode:"draft"`** — the single most consequential
  default in the session. An ERP that mails customers by itself is one bad rule away from an apology,
  so a rule prepares a message and a person releases it; "Aprobar" and "Registrar envío" are labelled
  honestly as the two different things they do, and nothing on the screen sends. (i) **`commsEvents()`
  is a projection, not an append-only log**, recomputed from current state so a rule added today
  still sees the invoice that went overdue last week — which is what somebody adding "chase at 3
  days" expects; an event log would only ever apply to the future. (j) **Editing a template mints a
  new version and retires the old with `supersededBy`**, so "which wording did the customer receive"
  stays answerable after somebody improves it. (k) **`closeBankPeriod` refuses while anything in the
  range is unreconciled**, and reopening requires a reason: a closed period whose whole value is
  that it contains no open question cannot be allowed to contain one. Reversible: the capability is
  a new package nothing else depends on, schema v7 is additive and idempotent, `quarterlyPackage`
  stayed callable in its old `(quarter, user)` shape, and every engine addition is new methods over
  existing collections — nothing sessions 1–10b built was removed or renamed.

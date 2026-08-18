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
- **#48 — The 13-stage journey becomes a transaction, not a narration (2026-08-07).**
  A full end-to-end audit of `site/journey.html` as an employee would use it
  (`docs/JOURNEY-AUDIT.md`) found the stages produced a complete set of documents from an empty
  form, and that the money on them was invented: committed cost was `chapter budget ×
committedPct` and actual cost `× actualPct`, so every chapter reported an identical variance
  and the supplier / PO-number / bill-number fields the operator filled in were never read.
  **Decision:** fix the journey in place rather than demote it to a demo — the request framed the
  reviewer as an employee "using this ERP system in daily operations", and each serious defect
  (fabricated numbers, seven dead fields, no gates) is downstream of the page not deriving its
  figures from entered data. Purchase orders and supplier bills are now rows the operator enters
  and the ledger sums; `depositPct` and `progressPct` drive the invoice; collections take an
  amount so a part payment is representable; every stage states its preconditions and Advance
  refuses until they are met. Most reversible: no engine change was needed for any of it, and the
  sample carries seeded PO/bill rows so the walkthrough still demonstrates a complete project.
  **Deliberately NOT done in this pass:** wiring the journey through `erp-engine.js`. It remains
  the right end state — the page still writes to its own `caneiJourney` database while the ERP
  uses `caneiERP`, so a customer is typed twice and the journey's invoice is not the accountant's
  invoice — but it needs idempotent stage→record mapping (re-advancing must not duplicate
  records) and a decision about abandoned journeys polluting the live dataset. Started badly it
  would leave the repo half-migrated, which the mandate forbids; it is scoped as Tier-1 item 1 in
  the audit's roadmap and lands as its own commit series.
- **#49 — `receivables()` means what it says; the billing list moves (2026-08-07).**
  `receivables()` ended in `.filter(x => x.outstandingCents > 0.005 || true)` — a no-op that kept
  settled invoices in the AR follow-up list. Fixing it would have silently removed paid invoices
  from `erp.html`'s Facturación screen, which renders a "Cobrada" pill and therefore expects
  them. Added `invoiceRegister()` (every issued invoice, same row shape) for the list and left
  `receivables()` as true AR; the view now reads the register. Most reversible: no data change,
  and the three engine consumers already filtered on `outstandingCents > 0` themselves.
- **#50 — Tax-ID validation now differs between the journey and the engine (2026-08-07).**
  Driving the journey found that `B66666666` — the CIF used throughout the repo's seed and
  test fixtures — is refused by the journey (which verifies the CIF control digit) and accepted
  by `erp-engine.js`, whose `validTaxId` checks CIF structure only (`:47`). The journey is
  right: the control digit for `B6666666_` is `0`. **Decision:** report it rather than tighten
  the engine in this pass. Tightening means correcting seed data and re-baselining the year and
  manageability simulations, which is real work with real blast radius — not a one-line change —
  and doing it half-way would leave the fixtures inconsistent with the validator. Logged as M1
  in `docs/JOURNEY-E2E-TEST.md` and Tier-1 item 5. Most reversible: no behaviour changed, and
  the stricter of the two validators is the one facing the operator.
- **#51 — Hosting: Hetzner + Cloudflare, built for handover to a third party (2026-08-07).**
  The owner will hand the running system to Canei Subirats and step away, with a third-party
  IT provider maintaining it. **Decisions:** (a) **Hetzner CX32 (x86), Falkenstein/Nuremberg,
  ~€9/mo all-in** — EU data residency for personal and tax data, 3–5× cheaper than a
  hyperscaler; x86 rather than the cheaper ARM CAX21 so no cross-architecture image build has
  to be explained to whoever inherits it (€0.50/mo for one less moving part). (b) **Cloudflare
  for the edge, not the compute** — Tunnel (no inbound port exists), Access (auth without
  building auth), R2 (encrypted backups), Pages; Workers were rejected because the app needs
  Node crypto for the invoice hash chain, interactive Prisma transactions carrying the RLS
  GUC, and long-running jobs, and an OpenNext compatibility layer under a system holding tax
  records buys nothing. (c) **Self-hosted PostgreSQL with encrypted off-site backups** rather
  than managed: at one tenant, spend on backups, not redundancy — an hour of downtime is
  annoying, a lost invoice register is fatal. Revisit at ~10 paying tenants. (d) **Pull-based
  deployment** (systemd timer pulls from GHCR every 60s) rather than SSH-from-CI, so no deploy
  key exists and no inbound rule is needed. (e) **Full `node:22-bookworm`, not `-slim`** — the
  slim image ships no libssl, so Prisma falls back to an openssl-1.1.x engine and dies with a
  bare "Schema engine error"; the full image needs no apt-get at all, so the build works
  behind a proxy or an air-gapped mirror. Found by building it the wrong way first.
  (f) **Boring technology on purpose** — Docker Compose, PostgreSQL, systemd. The constraint
  is not "can it be built" but "can a stranger keep it alive". Most reversible: nothing is
  Hetzner-specific; the compose stack runs on any Debian host, and the rebuild drill in
  `docs/HANDOVER-OPS.md` is the test that it genuinely does.
- **#52 — Accounts are created in the customer's name from day one (2026-08-07).**
  Hetzner, Cloudflare and GitHub are registered to `Canei Subirats, S.L.` with a role address
  (`sistemas@…`), the customer's card, and the builder added afterwards as an admin who
  removes himself at handover — never the reverse. Several providers make ownership transfer
  painful and some impossible, and a domain transfer carries a 60-day registrar lock, so
  retro-fitting ownership turns a handover into a migration. Costs nothing now.
  The **age backup private key is deliberately not on the server**: a backup the compromised
  host can decrypt is not protection. It lives only in the customer's password manager, which
  means losing it makes every backup unreadable — recorded in the escalation table.
- **#53 — Cloudflare deferred; the interim server is private, not published (2026-08-07).**
  The Hetzner account and `canei-erp` project exist, but Cloudflare is on hold pending
  agreement with the customer. **Decision: run without it, and keep the server unreachable
  from the internet rather than exposing it.** The reason is specific, not cautious —
  `apps/web` has **no authentication of any kind**: no middleware, no auth library, no login
  route. Cloudflare Access was the entire login layer. Publishing ports 80/443 in its absence
  would put the customer's invoice register on the open internet behind nothing. So the
  interim mode reaches the app over an SSH tunnel (`ssh -L 3000:localhost:3000`), which is in
  fact stricter than the Cloudflare design, just less convenient.
  **Implementation:** the `tunnel` service moved behind a compose profile, so the default
  `up -d` starts a fully private stack; `backup.sh` gained `BACKUP_TARGET=local` (still
  age-encrypted, pruned by count) and `provision.sh` gained `SKIP_CLOUDFLARE=1`.
  **The accepted gap:** with no R2, the encrypted dumps live on the same machine as the
  database. Hetzner snapshots are the second copy, so disk/instance failure is survivable,
  but losing the account or region takes both — and the monthly restore drill cannot run.
  Acceptable for test data; **not once Canei enters a real invoice**, which is the trigger to
  finish the Cloudflare step. Fully reversible: `docs/INTERIM-HETZNER-ONLY.md` documents the
  ~20-minute switch-on with no rebuild and no data migration, and records what would have to
  replace Cloudflare (another zero-trust proxy, Caddy + basic auth, or building real auth
  into the app) if the customer declines.
- **#54 — Row-level security was decorative; the app now connects as a restricted role
  (2026-08-07).** Verification step 5 of the server-move plan ("query the table with no
  `app.tenant_id` set and get zero rows") **failed**. Every tenant table has had an RLS policy
  and `FORCE ROW LEVEL SECURITY` since `0001_init`, and ADR-0007 calls it defense in depth —
  but the application connected as `POSTGRES_USER`, which the postgres image makes a
  SUPERUSER, and **Postgres lets superusers bypass RLS unconditionally; FORCE does not change
  that**. Measured on a real database: as the owner, an unscoped `SELECT` returned every row
  of every tenant; as a plain role, zero. So the database half of the isolation did not exist,
  and the existing test named "tenant scoping (defense in depth)" only ever exercised the
  adapters' own `WHERE tenant_id` — it passes with RLS switched off entirely.
  **Decision: split the roles.** The owner keeps DDL and runs migrations; the app connects as
  `canei_app` — `NOSUPERUSER NOBYPASSRLS`, DML only, no access to `_prisma_migrations`.
  `ops/harden-db-role.sh` creates it, is idempotent (it is also the password-rotation path),
  and **refuses to exit 0 unless it can prove the role sees zero rows without a tenant set**.
  It runs as a one-shot compose service after `migrate`, in CI, and in the deploy smoke test —
  so the published image is now exercised under the privileges it will actually have, which
  also catches a missing GRANT before the server does.
  Four new tests assert the database-level behaviour over a restricted connection; they were
  confirmed to **fail** against the owner connection before being trusted. The misleading test
  name was corrected rather than left to reassure the next reader.
  Most reversible: additive. Existing data untouched, no schema change to existing tables, and
  a server that has not yet run `db-role` keeps working until it does.
- **#55 — The workspace UI is served by the server, same-origin (2026-08-07).**
  Pointing `site/erp.html` at the API raised a question the plan had not: the static
  site is published by GitHub Pages, so a browser there talking to the Hetzner box is
  cross-origin. That needs CORS, and a permissive CORS policy in front of an API with no
  authentication is worse than it sounds. **Decision: the Next server publishes its own
  copy of `site/` at `/workspace/`**, generated at build time by
  `apps/web/scripts/sync-workspace.mjs`, which injects `<meta name="erp-api" content="">`
  — the marker `erp-backend.js` reads to use the server instead of IndexedDB. The Pages
  copy is byte-identical apart from that tag and stays the offline demo, so nothing
  published today changes. Same-origin also means that when real accounts land, one
  session cookie covers the workspace and the API; two origins would mean inventing token
  plumbing. `public/` is generated and gitignored, and `Dockerfile` copies it explicitly —
  Next does not trace `public/` into the standalone output, and without the COPY the
  server would host an API with no user interface while reporting healthy. Reversible:
  delete the sync step and the marker, and the pages are local-only again.
- **#56 — Duplicate tax identifiers were admissible; the rule is now enforced directly
  (2026-08-07).** Found because the new server E2E suite was intermittent, which was worth
  chasing rather than papering over. `addParty` enforced MDM-03 through
  `findDuplicateParty`, a SOFT check that matches on tax id **or** name **or** phone and
  returns the first hit — then rejected only if _that_ record shared the tax id. So a real
  duplicate went in whenever an unrelated party matched first on a shared phone number.
  `updateParty` never checked at all, so the rule could be sidestepped by creating a party
  and editing its identifier afterwards. Both reproduced before fixing.
  On a system holding tax records this is not cosmetic: two active parties with one NIF
  means a customer's invoices split across two accounts and a tax filing built from them
  that does not add up. **Decision: separate the hard rule from the soft signal** — a new
  `_activeTaxIdHolder` enforces "no two ACTIVE parties share a tax id" in both `addParty`
  and `updateParty`, while `findDuplicateParty` keeps its original job of flagging
  suspects for review. Deliberately scoped to _active_ parties, so deactivating a record
  still allows a legitimate re-registration under the same identifier.
  Three checks added to `manageability-sim.mjs` (48/48); all three were confirmed to fail
  against the previous engine before being trusted. Year simulations unchanged at 145/145
  and 253/253.
- **#57 — The deploy smoke test never ran, and the server could not have pulled anything
  (2026-08-07).** Checking the real GitHub state before writing provisioning instructions
  turned up three faults, each verified against the live registry rather than reasoned about:
  **(a) An uppercase image name.** `github.repository` is `stefangruber001/OpenProject2`;
  OCI names must be lowercase. `docker/metadata-action` lowercases it for the push, so the
  `images` job was green all along and the images really are published — but the `smoke`
  job's bare `docker run` was rejected before contacting the registry
  (`invalid reference format … must be lowercase`), failing every run for a day. Because
  `images` still succeeded and the VPS follows the rolling `:main` tag, **unsmoked images
  would have shipped to the server regardless of the red workflow.** The newly added
  `db-role` step, `ERP_OPERATOR`, the tenant-route check and `tests/server-e2e` had
  therefore never executed in CI once. `ops/provision.sh` rendered the same uppercase name
  into cloud-init, so the server's own pull would have failed identically — the stack would
  simply never have started, with the error buried in a systemd timer's journal.
  **(b) Private images, no credentials.** The repository is private, so its packages are
  private; `docker pull` as an anonymous client returns `unauthorized` (measured). cloud-init
  had no `docker login`. Making the packages public was rejected as the fix: the image
  contains the built application, i.e. the private repository's code. A `read:packages`
  token is now required by `provision.sh`, which refuses to provision without one and says
  exactly how to mint it.
  **(c) A regression from #55.** `ERP_OPERATOR` is a person's name and went into `.env`
  unquoted, but `ops/backup.sh:15` and `ops/restore.sh:19` read that file with `. ./.env` —
  `Ana Ruiz` would have run `Ruiz` as a command and aborted the nightly backup under
  `set -e`. Now quoted; verified that `sh` sources it and that Compose still strips the
  quotes.
  Verified end to end by rendering the real cloud-init with a spaced name: valid YAML, no
  placeholders left, `.env` sources cleanly under `sh`, `docker compose config` resolves the
  lowercase images and the restricted database role, and the login snippet runs. The deploy
  workflow's path filter also missed `ops/**`, `site/**`, `tenants/**` and
  `tests/server-e2e/**` — all of which are in the image or the smoke test — so changes to
  them never triggered the job that checks them.
- **#58 — cloud-init cloned a private repository with no credentials; the server would
  have started nothing (2026-08-07).** A verification sweep run before telling the operator
  to provision found that `ops/cloud-init.yaml` did
  `git clone --depth 1 https://github.com/stefangruber001/OpenProject2.git`. The repository
  is private and a fresh machine has no GitHub identity, so the clone fails with
  "Repository not found" — and everything downstream is repo content that then never
  arrives: `docker-compose.prod.yml` (the `-f` target), `ops/harden-db-role.sh`
  (bind-mounted by the db-role service) and `ops/backup.sh` (the backup unit's ExecStart).
  `docker compose up -d` would fail with "no such file or directory" and **not one
  container would start, database included.** The `read:packages` token added in #57 cannot
  clone source, and its `docker login` runs after the clone in any case.
  **Decision: stop cloning.** `provision.sh` now inlines the four files the machine actually
  needs into cloud-init `write_files` (27.3 KB rendered, against Hetzner's 32 KB user_data
  limit, checked before upload). This also keeps the server's only credential a read-only
  package token rather than something that can read the source. Verified by rendering the
  real thing: valid cloud-config, all four files byte-identical to the repo, modes 0644/0755,
  the shell scripts still parse after the YAML round trip, and no `git clone` anywhere.
  Two guards were added and both earned their place immediately — the marker check caught a
  decoy `__PLACEHOLDER__` inside the template's own header comment, since removed.
  The same anonymous-clone assumption existed in the manual path
  (`ops/bootstrap-server.sh`, `docs/HETZNER-SETUP.md`, `docs/HANDOVER-OPS.md`) and is now
  corrected there too — an IT provider following the runbook would have hit it identically.
- **#59 — `tr | head` killed the provisioner silently (2026-08-07).** The first real run
  stopped dead after "age keypair created" with no error and no exit message. Cause:
  `tr -dc 'A-Za-z0-9' </dev/urandom | head -c 40` — `head` exits the moment it has 40 bytes,
  `tr` is killed by SIGPIPE, and under the script's own `set -o pipefail` the pipeline
  returns 141 and `set -e` ends everything. Reproduced exactly (exit 141). It failed safely
  — before any server existed — but it is the worst failure shape available: no output at
  all. Fixed by bounding the read at the SOURCE (`head -c 4096 /dev/urandom | tr | cut`), so
  no stage exits early, plus a length assertion on both generated passwords, because a
  short or empty one would produce a database nobody can log into. Two other
  `… | head -1` pipelines were changed to `sed -n '1p'` for the same reason.
- **#60 — The hardcoded server type had been retired (2026-08-07).** The first successful
  run of `provision.sh` reached server creation and was refused by Hetzner with
  `server type 105 is deprecated` — `SERVER_TYPE="cx32"`, correct when written, retired
  since. It failed after the SSH key and firewall had been created, which is a confusing
  place to stop, and the message names an internal id rather than anything actionable.
  **Decision: validate against the API instead of hardcoding a guess.** `provision.sh` now
  lists `/server_types` before creating anything and requires the configured type to be
  present, not deprecated, and available in `SERVER_LOCATION`; on failure it prints the
  suitable alternatives (4+ vCPU, 8+ GB) with prices, cheapest first.
  **The check also requires `architecture == "x86"`, which matters more than the
  deprecation.** Hetzner's ARM line (`cax*`) is cheaper and an operator picking on price
  would choose it — and `.github/workflows/deploy.yml` builds amd64 images only, so the
  machine would boot perfectly and then run not one container. Rejecting ARM at
  provisioning time is the cheap fix; building multi-arch images is the real one, and is
  the trigger to revisit. Verified against a representative payload: deprecated, ARM, and
  wrong-location types are all rejected, valid ones accepted, suggestions sorted by price.
- **#61 — The SSH-tunnel access path never worked: nothing was listening (2026-08-07).**
  The stack came up healthy on the real server and `ssh -L 3000:localhost:3000` then failed
  with `ECONNRESET`. Cause: `docker-compose.prod.yml` deliberately published **no** ports —
  a rule written to stop anyone exposing an app that has no login — so the server's own
  `localhost:3000` was a closed door. The tunnel forwards to the server's loopback, finds
  nothing, and resets. The interim access design and the compose file contradicted each
  other, and neither was wrong on its own; the combination had simply never been run.
  **Decision: publish `127.0.0.1:3000:3000` — loopback, never `0.0.0.0`.** Loopback is not
  routable from outside, the firewall drops inbound regardless, and it is exactly what an
  SSH tunnel needs. The distinction is one string and the difference between a private
  server and the customer's invoice register on the open internet, so the file now spells
  both forms out and says which is which. Verified with `docker compose config`: the app is
  the only published service and its `host_ip` is `127.0.0.1`.
- **#62 — Reopening the firewall was one word, and a stray paste triggered it (2026-08-07).**
  SSH was correctly narrowed to a single address and verified. Two illustrative commands
  were then pasted together, each carrying a trailing `# comment` — and **zsh does not treat
  `#` as a comment interactively** (`INTERACTIVE_COMMENTS` is off by default), so both lines
  ran. The first was refused by the IP validation, which did its job. The second was
  `--open`, and the firewall went back to `0.0.0.0/0` with nothing asking whether that was
  intended.
  **Decision: make the dangerous direction ask.** `--open` now requires either an interactive
  confirmation (typing `open`) or an explicit `--yes`, and refuses outright when stdin is not
  a terminal — so a paste, a script, or a copied line cannot silently undo the hardening.
  Narrowing stays a single command, because the safe direction should be frictionless.
  Verified across all four paths: no-tty refuses, wrong answer cancels, `--yes` proceeds, and
  a stray `#` argument is still rejected by the address check.
  Also a note to self about this operator's environment: **never put `#` comments on the same
  line as a command in copy-paste instructions for zsh.** Put explanation in prose above the
  block instead.
- **#63 — Remote checks swallowed the script they were part of (2026-08-07).** `status.sh`
  and the earlier ad-hoc check both reported the first few results and then went quiet:
  everything after the health check came back empty, so RLS, the tenant count, both timers
  and the running image all read as "could not determine". Nothing was actually wrong with
  the server. The script is piped to `ssh … bash -s` over **stdin**, and
  `docker compose exec -T` **reads stdin** — so the first exec consumed the remainder of
  the script as input to the container, and bash had nothing left to run. Reproduced with
  `cat` as a stand-in: the line after the greedy command shows up as its _output_.
  Fixed by closing stdin on every remote `exec -T` (`</dev/null`). Worth remembering
  generally: any command that reads stdin — docker exec, ssh, psql, cat — poisons a
  heredoc-piped remote script unless its stdin is redirected. The failure is silent and
  looks exactly like the checks failing.
- **#64 — The smoke test was not a deploy gate, despite saying so (2026-08-07).** Asked
  whether two people could push updates to the server, I checked the path rather than
  recalling it, and found the release ordering wrong. `deploy.yml`'s `images` job published
  **both** the immutable `sha-…` tag and the rolling `main` tag; `smoke` ran afterwards as a
  separate job. The server follows `:main` and pulls every 60s — so an image reached
  production roughly three minutes _before_ the tests that decide whether it boots had
  finished. The comment above `smoke` claimed it ran "before the server is allowed to pull
  it", which is worse than no gate: it reads as protection. This is not hypothetical; the
  lowercase-image-name bug already left `smoke` red for a day while every push shipped
  regardless.
  **Decision: publish only the sha tag from the build, and move `:main` in a new `promote`
  job that `needs: smoke`.** `docker buildx imagetools create` retags inside the registry,
  so production runs the byte-identical manifest that was tested — rebuilding at promote
  time would ship an artifact no test had ever seen. `promote` is additionally guarded with
  `if: github.ref == 'refs/heads/main'`, because `workflow_dispatch` can be fired from any
  branch and would otherwise point `:main` at unreviewed code from a dropdown.
  Chosen over the alternatives — gating on the sha tag in the server's `.env` (needs a
  server edit per release) or having CI SSH in (puts a production key in CI, which the whole
  design avoids). Reversible: deleting the `promote` job and restoring
  `type=ref,event=branch` returns the previous behaviour exactly.
  Context: this matters now because a second person (`ignaciofo-dotcom`, write access) is
  about to start pushing. With one careful operator an ungated deploy is survivable; with
  two concurrent pushers it is not.
- **#65 — "Don't wanna use the Mac at all anymore" reverses the skip-Cloudflare decision
  (2026-08-07).** The Mac is load-bearing for exactly two things: reaching the ERP at all
  (the app binds loopback and the firewall admits one address, so the only way in is an SSH
  tunnel) and running the ops scripts (the key and `provision.conf` are gitignored and exist
  only there). Deploying code was already browser-only. So dropping the Mac means publishing
  the app, and publishing it as it stood would have put a customer's invoice register on the
  open internet.
  **Decision: turn on the Cloudflare path that `ops/provision.sh` already builds** — tunnel,
  DNS record, and an Access policy admitting `@caneisubirats.com`. Chosen over building
  first-party login (days of work, and the Mac stays load-bearing until it ships) and over
  Caddy + Let's Encrypt on 80/443 (opens ports and still needs an identity system). It is
  also the most reversible: deleting a tunnel restores the private posture exactly, with no
  code to unpick. This overrides the operator's earlier "Cloudflare we said we skip for this
  pilot" — that was decided when the constraint was one person at one desk, and the
  constraint has changed. Flagged rather than buried.
  I did ask about this instead of deciding, which the mandate forbids; the operator declined
  the question and was right to. Recorded so the reflex is corrected, not repeated.
- **#66 — Identity is verified, not read from a header (2026-08-07).** With a login in front,
  the obvious implementation of `requireUser` is four lines: read the email header the proxy
  adds. Rejected. That header is trustworthy only while the application is unreachable except
  through the proxy, which is a deployment fact rather than an enforced one — one published
  port, one added network, one migration, and any caller can name whoever they like as the
  author of an invoice, invisibly, because the forged name simply appears in `state.audit` as
  a colleague's work.
  **Decision: verify the signed assertion.** `apps/web/lib/session.ts` checks the RS256
  signature against the identity provider's published keys, pins the algorithm (so `alg:none`
  and the HMAC-with-public-key confusion are refused), checks audience — a token minted for
  any other application behind the same provider is not permission to be in this one —
  issuer, and expiry, then takes the email from inside the token. Keys are cached for an hour,
  refetched on an unknown key id so a rotation is not an outage, and served stale if the
  provider blips rather than failing every write. No new dependency: Node's `crypto` verifies
  RS256 from a JWK directly.
  Half-configuration is refused rather than downgraded: if one of the two variables is missing,
  start-up fails instead of silently falling back to the single-seat name, because that
  failure mode credits everybody's work to one person and looks completely normal.
  21 tests cover the ways this could be got around, each one a real forgery attempt rather
  than a shape assertion. Unset variables leave today's single-seat behaviour byte-identical.
- **#67 — Ops moved to a browser button, and the firewall had to stop being
  single-occupancy first (2026-08-07).** Checking what the operator's laptop was actually
  load-bearing for turned up a blocker neither of us had noticed: `ops/narrow-ssh.sh` uses
  Hetzner's `set_rules`, which REPLACES every rule. It was written for one person at one
  desk and is actively harmful with two — the second person runs it and locks out the first,
  with no error on either side. The same property blocks any automation, which needs to let
  itself in briefly and then leave.
  **Decision: add `ops/ssh-allow.sh`, which changes exactly one entry** and writes the whole
  set back, preserving non-SSH rules and anyone already listed. `add` of a present address
  and `remove` of an absent one are no-ops rather than errors, because the remove half
  usually runs in a cleanup handler after something else has already failed. Removing the
  last address is permitted — denying access is the safe direction and a prompt would break
  automated cleanup — but says so loudly, since the resulting state is invisible from
  outside. `narrow-ssh.sh` is left alone; "set it to only me" is still a legitimate thing to
  want.
  Verified against seven fixtures before it went near the live API: add-second, add-duplicate,
  remove-one-of-two, remove-last, remove-absent, non-SSH-rules-preserved, add-when-no-rules.
- **#68 — The production SSH key now lives in repository secrets (2026-08-07).** `ops.yml`
  runs `status`, `backup-now` and `list-ssh-allowed` from an Actions button, which needs the
  key. This is a genuine widening and is recorded rather than buried: **anyone who can push a
  workflow to this repository can print that secret**, so repository write access and
  production SSH access are now the same privilege — and a second person with write access
  was just added.
  **Decision: accept it, gated on the `production` environment**, so a required reviewer can
  be added in one browser click and every run then waits for approval. The alternative —
  hand-editing on the machine through Hetzner's web console — stores no credential anywhere
  but makes every routine check a manual typing exercise on a phone, which in practice means
  the checks stop happening. A stale, unmonitored server is the larger risk.
  Each run adds its own address to the firewall and removes it in an `always()` step: a
  cleanup that only ran on success would slowly fill the allow-list with addresses nobody
  recognises. Credentials are shredded from the runner afterwards, and the key is validated
  with `ssh-keygen -y` at the point of use so a CRLF-mangled paste fails with a sentence
  instead of "invalid format".
- **#69 — "The server is not working" was four other things (2026-08-07).** A task added to
  the calendar on one phone never appeared on the other, and the reasonable conclusion was
  that the server was broken. It is not; it had been verified end to end hours earlier. The
  calendar cannot reach a colleague for four independent reasons, any one of which is
  sufficient on its own:
  (1) both mobile apps load `stefangruber001.github.io/OpenProject2/preview/` — GitHub Pages,
  a static site with no server behind it, so everything entered on a phone stays on that
  phone. This is not calendar-specific: customers and invoices are equally private.
  (2) the Pages copy of `erp.html` carries no `erp-api` marker (`grep -c` → 0), so even that
  page uses browser storage there; the marker is injected only into the copy the server
  serves.
  (3) the scheduler lives in `journey.html` and persists to the `caneiJourney` browser
  database, a different store from the ERP's — it has never passed through `erp-engine.js`.
  (4) `addTask` was not on the API's command whitelist, so a correctly wired calendar would
  still have been refused.
  **Decision: fix (4) now and document the rest rather than half-fix the chain.** `addTask`,
  `updateTask` and `completeTask` are on the whitelist with round-trip tests — a task written
  by one person is loaded by another, and the audit trail names who completed it. The other
  three are ordered in `docs/WHY-THE-CALENDAR-IS-NOT-SHARED.md`, because they must be done in
  sequence: publishing has to come first or there is no address to point the apps at.
  Worth recording as a class of failure: **a save into browser storage is indistinguishable
  from a save to the server** from the operator's side. The page looks identical, the toast
  is identical, the record appears. Everything downstream of that ambiguity gets diagnosed as
  a broken backend. The ten-second test is the address bar, which is now written down.
- **#70 — The pilot gets its own login rather than a third party's (2026-08-07).** The
  operator ruled out Cloudflare and said the domain will not transfer soon, so the published
  path built earlier is unavailable: it needs a domain in a Cloudflare account. Publishing
  the ERP without any login was never an option — that puts a customer's invoice register on
  the open internet.
  **Decision: build first-party sign-in, and get HTTPS from a hostname nobody has to own.**
  Accounts are `ERP_USERS` in the server's `.env` (email + scrypt hash, no password stored),
  sessions are a signed cookie with no session table, and `middleware.ts` is default-deny —
  a short allow-list of public paths, everything else protected, so a route added next month
  by somebody who never read the file is still behind the lock. Reachability is Caddy
  terminating TLS for `<ip-with-dashes>.sslip.io`, which resolves to the server with no
  registration and is a real enough name for Let's Encrypt to certify. A self-signed
  certificate was rejected: an iOS web view refuses it outright, so the phone app could never
  work. Moving to the company domain later is one variable.
  Chosen over Tailscale (a VPN client on every device, and still a third party) and over
  waiting for the domain (blocks the pilot indefinitely). Reversible: `./ops/open-web.sh
--close` takes it off the internet, and unsetting two variables restores today's behaviour
  byte-for-byte.
  Pilot-shaped compromises, recorded rather than discovered later: accounts in an environment
  variable instead of a table (no migration, no admin screen, no password-reset flow — fine
  for two people, wrong for a third); no session store, so an individual session cannot be
  revoked before it expires (rotating `SESSION_SECRET` revokes all of them); and no rate
  limiting on the login form yet, which is why the hash script refuses a password under 12
  characters.
- **#71 — addTask ignored the acting user (2026-08-07).** Found by driving two signed-in
  sessions against a real server rather than by reading: Ignacio added a task, and the audit
  trail's last entry still named Stefan. Not misattribution — `addTask` took `user` and never
  called `_log`, so a task had no author anywhere, while `completeTask` and `updateTask` both
  recorded one. Invisible with a single operator; wrong the moment two people share a
  schedule, because "who put this in the calendar?" had no answer at all.
  **Decision: log it and stamp `createdBy` on the record**, so the question is answerable
  from the task itself — which is what a schedule screen renders — and not only from the
  audit trail. Two regression tests. All four simulations still pass.
- **#72 — The env template the runbooks tell you to copy was gitignored (2026-08-07).**
  `.gitignore` has `.env.*`, which swallowed `.env.production.example`. It contains no
  secrets — only placeholders and the explanation of each value — but it was never in a
  fresh clone, so the first instruction in two runbooks pointed at a missing file.
  **Decision: negate it explicitly** (`!.env.production.example`) rather than rename it,
  because every document already refers to it by that name. The pilot variables were also
  added to the `.env` that `ops/cloud-init.yaml` writes, so a newly provisioned server has
  them present and empty instead of absent.
- **#73 — Shared access reaches the live data, on the operator's instruction (2026-08-07).** The
  ask was a link and a password that anyone can use, so owners and operators of a company
  evaluating the ERP can try it on their own laptop, tablet or phone. I began building the
  cautious version — a `guest` role confined to a separate demonstration tenant — and the
  operator stopped me: **"No demo data anymore to be added, from now on it should be live."**
  **Decision: implement exactly that.** `ERP_ACCESS_PASSWORD` opens a session with the same
  reach as a named account, on the live company. The confinement code was removed rather than
  left switched off, because dead authorisation paths are read later as protection that
  exists.
  The concern was stated once and is recorded here rather than argued twice: anybody holding
  the link and the password can change or delete real records, and will see real customer
  names, addresses and figures — third parties' personal data, disclosed to a prospect. That
  is the operator's company and the operator's call. What the code does instead of preventing
  it is make it recoverable and attributable: backups already run nightly and `backup-now`
  takes one on demand, changing `ERP_ACCESS_PASSWORD` closes the door, changing
  `SESSION_SECRET` ends sessions already open, and every change a shared session makes is
  stamped `invitado-XXXX` in the audit trail so it can be told from a colleague's work
  afterwards.
  Two things kept from the confined design because they are right regardless: the session
  carries a role (named vs shared), and the workspace asks the server for the `~` tenant
  rather than naming a company in a file served to everybody.
  Bug caught on the way: the middleware treated "has a login" as `ERP_USERS` alone, so a
  deployment reached only through the shared link — no named accounts — would have switched
  the lock off entirely and served every page to anyone who found the address. `ops/open-web.sh`
  had the same assumption and would have refused to publish that deployment at all.
- **#74 — A password hash in `.env` would have killed the nightly backup (2026-08-07).** Found
  while walking the operator through setup, not by reading. `ops/backup.sh` and
  `ops/restore.sh` do `set -euo pipefail` and then `set -a; . ./.env; set +a`. A scrypt hash
  legitimately contains `$16384`, and inside the double quotes the documentation told people
  to use, the shell reads that as positional parameter `$1` followed by `6384` — which under
  `set -u` is an unbound variable, so the script exits **before taking a backup**. The nightly
  job would simply have stopped, leaving nothing behind but a timer that fires and a directory
  that never grows. Reproduced both ways before fixing.
  **Decision: fix the script, not only the guidance.** `set +u` now brackets the source in both
  scripts, so no value anyone ever puts in `.env` can stop a backup. Guidance changed to single
  quotes as well — in `.env.production.example`, `ops/cloud-init.yaml`, the runbook, and the
  hash tool's own output — because the value is also silently truncated under double quotes
  even where it does not abort. But quoting advice is a note in a file, and the next person to
  edit `.env` will not have read it; the script had to stop being brittle.
  Worth generalising: this whole class — a config file that is data to one reader and shell to
  another — has now cost a silent failure twice (the `#` in a zsh paste, and this).
- **#75 — The server's stack definition never updated, and the symptom was a lie
  (2026-08-07).** The operator followed the setup, `.env` was correct, and
  `docker compose up -d` reported "Running" with no Caddy container. `open-web.sh`
  then correctly refused to publish, because the running application served the
  workspace to a request with no session. Everything looked configured and nothing
  was.
  The cause: `docker-compose.prod.yml` and the `ops/` scripts reached the machine
  **once**, through `provision.sh`'s embed-and-splice at creation time. Nothing
  updates them afterwards — `canei-deploy.service` pulls _images_ and runs
  `up -d`, so application code flows to the server continuously while the stack
  definition is frozen at the day the machine was born. The compose file there had
  no `web` service and no lines passing `ERP_USERS` or `SESSION_SECRET` to the
  app, so the settings sat in `.env` and were never handed to the process.
  **Decision: add `ops/sync-server.sh`** — copies the compose file, Caddyfile and
  ops scripts up, keeps the previous compose file as `.bak`, decides on the
  `pilot` profile by reading whether `PUBLIC_HOSTNAME` is actually set, and
  restarts. One command, run whenever the stack changes.
  This is a patch, not the cure. The cure is for the definition to travel with
  the image — ship it inside the container and have the deploy service extract it
  before `up -d` — so a stack change deploys itself like everything else. Recorded
  as the next piece of ops work rather than done now, because the operator is
  mid-setup and a manual sync unblocks them today.
  Worth naming the pattern: **"configured" and "running what you configured" are
  different claims, and only the second one matters.** `open-web.sh` refusing to
  publish is the only reason this was caught before the ERP went on the internet
  with no login at all.
- **#76 — The front door still showed the scaffold from day one (2026-08-07).** The operator
  published the ERP, signed in, and landed on "A solid foundation, ready to build on" — a list
  of engineering practices, version control and CI — then asked why the ERP was not there. It
  was, and had been for months, at `/workspace/…`. Nothing anywhere pointed at it.
  `apps/web/app/page.tsx` was still the Next.js starter page the repository was born with:
  accurate on the first day, and by the time there was a real system it was actively telling
  the operator their product did not exist.
  **Decision: `/` redirects to `/workspace/index.html`**, the launchpad — a signpost rather
  than a page, since the workspace is static HTML already served from `public/`.
  Verified the actual click-path rather than the build output: anonymous `/` → `/login?next=/`,
  sign in with the shared password, `/` → `/workspace/index.html`, launchpad returns 200 with
  the title "Canei Subirats — Plataforma de gestión".
  The lesson is not about a redirect. Every check ever run against this deployment asked
  whether a _known_ address behaved correctly — health, tenant routes, the workspace, the login
  redirect — and all of them passed while the one address a human actually types led nowhere
  useful. **Nothing tested the path a person takes from the URL they were given to the thing
  they came to use.** That path is now the first thing to check after any change to routing.
- **#77 — A shared link showed the framework's logo, not the company's (2026-08-07).** The
  operator sent the address to a colleague and WhatsApp rendered a black triangle with
  "OpenProject2 — a new product built on a profe…". The metadata in `app/layout.tsx` was, like
  the page under it, the scaffold's.
  **Decision: brand the preview from the tenant's own tokens** — the green, the yellow and the
  house mark already in `tenants/diorka/tenant.yaml` and `site/favicon.svg` — rather than
  inventing a logo. A 1200×630 card is rendered from that and committed as
  `apps/web/public/brand/og.png`.
  Two things about link previews that are invisible from a browser and were the actual work:
  **(1)** the crawler is anonymous, so it follows the redirect and reads the tags on `/login`
  — which is why they live on the root layout rather than on a page behind the session; and
  **(2)** the image must be fetchable with no session, or the card renders with no thumbnail
  and looks like a missing file. `/brand/` is on the middleware's public list for that reason
  and no other; it holds a logo and a picture of a logo, no company data.
  `metadataBase` is computed per request from `PUBLIC_HOSTNAME` rather than fixed at build,
  because the address is an sslip.io name today and the company's domain later — and a
  hardcoded base would point the preview at an image on a host that no longer serves it.
  `PUBLIC_HOSTNAME` had to be added to the **app** service in compose; it was only being passed
  to Caddy, so the absolute image URL would have come out as `localhost`.
  Verified as a crawler sees it: `curl -L` with a WhatsApp user agent and no cookie returns all
  five tags with an absolute image URL, `/brand/og.png` returns 200 and `image/png`
  anonymously, and `/workspace/erp.html` still returns 307.
  Also set `robots: noindex` — a private system's login page in search results is a cost with
  no benefit.
- **#78 — The brand assets were gitignored, so the preview image existed only on my machine
  (2026-08-07).** Caught by noticing `git status` did not list `og.png` after I regenerated it.
  `apps/web/public/` is ignored wholesale, correctly — `sync-workspace.mjs` rebuilds it from
  `site/` on every build. But the logo and the link-preview card are **source**, not generated,
  and they were swallowed by the same rule. Every check I ran passed against a file that would
  never have reached the server: the metadata pointed at `/brand/og.png`, and the server would
  have returned 404, producing a card with no thumbnail — the exact symptom the work was meant
  to fix.
  **Decision: ignore `apps/web/public/*` rather than `apps/web/public/`, then negate
  `!apps/web/public/brand/`.** Git does not descend into an excluded _directory_, so a negation
  under `public/` could never have taken effect; excluding the contents instead is what makes
  the negation work at all. Verified both directions afterwards — `brand/og.png` tracked,
  `workspace/erp.html` still ignored — rather than assuming the pattern did what I intended.
  Checked two adjacent things while here: `sync-workspace.mjs` deletes `public/workspace`, not
  `public/`, so a build does not wipe the assets; and the Dockerfile copies all of `public/`,
  so they reach the image.
  Third time this shape has bitten in two days — `.env.production.example`, the server's stale
  compose file, and now this. **A file being correct on the machine that made it says nothing
  about whether it reaches the machine that serves it.** Worth checking `git status` after
  generating any artifact that something else is expected to fetch.
- **#79 — The preview image URL pointed at the server's own localhost (2026-08-07).** Second
  round on the same symptom, and a different cause each time. The title and description
  rendered correctly in WhatsApp and no thumbnail appeared. Title and description are string
  literals, so they shipped; the image URL was _computed_ from `PUBLIC_HOSTNAME`, which I had
  added to the `app` service in compose — and the server was still running the compose file
  from before that change, because the operator ran `canei-deploy` (which pulls an image) and
  not `sync-server.sh` (which updates the stack definition). So the variable was absent, the
  fallback used `NEXT_PUBLIC_APP_URL` — set to `https://localhost:3000` on that machine — and
  every crawler was politely told to fetch the image from its own computer.
  **Decision: derive `metadataBase` from the request instead of from configuration.**
  `x-forwarded-host` / `x-forwarded-proto`, falling back to `host`. The host that just served
  the page is the one host guaranteed to be reachable by whoever fetched it; it needs no
  configuration, cannot drift out of step with the deployment, and survives the eventual move
  to the company's domain with no change at all.
  Verified in the failing configuration deliberately — `PUBLIC_HOSTNAME` unset, `APP_URL`
  localhost — that a request carrying Caddy's forwarding headers still produces
  `https://178-105-10-156.sslip.io/brand/og.png`, and that a different host produces that host.
  Two lessons, both about the same thing. **A value that must match the deployment should be
  read from the deployment, not configured alongside it** — configuration is a second copy of
  the truth and this one was stale within the hour. And: a partially-working preview is a
  strong signal. Literals worked, computed values did not, and that split named the bug before
  I looked at anything.
- **#80 — Adding a person is one command (2026-08-07).** Adding an account meant: run the hash
  tool, ssh in, open `.env` in nano, find a single line hundreds of characters long, append a
  comma and paste, save, restart. Every step is a chance to break the line that also holds the
  database passwords, and the operator would do this every time somebody joins.
  **Decision: `ops/add-user.sh <email>`.** Asks for the password, hashes it locally so it never
  leaves the operator's machine, updates the server, restarts, prints where to sign in.
  Re-running for the same address REPLACES that entry, so the same command is also how a
  password is changed — including the operator's own.
  The edit is Python, not `sed`. A scrypt hash contains `$`, `/` and `+`, all of which mean
  something to `sed`, and the file being edited holds the database passwords — a mangled
  substitution there breaks considerably more than a login. The entry is passed as an argument
  rather than interpolated into the script, so nothing inside a hash can be read as code, and
  the file is written once at the end rather than progressively.
  Tested against fixtures before it went near the server: a third person added, the same person
  re-added (replaced, not duplicated), a differently-cased address matched, a file with no
  `ERP_USERS` line at all, and an existing double-quoted value rewritten single-quoted. Checked
  in every case that the database password survived untouched and that the hashes came through
  byte-for-byte.
- **#81 — The phone was never looking at the server (2026-08-08).** A customer entered in the
  browser on a laptop could not be found in the iPhone app. Two independent causes, either of
  which alone is enough, and neither of which reports an error:
  1. **The apps pointed at GitHub Pages, not the server.** `Config.swift` and `MainActivity.kt`
     both carried `https://stefangruber001.github.io/OpenProject2/preview/` — a static copy of
     the same screens with no database behind it. Every screen rendered, every form saved, and
     the data went into storage inside the phone. A shell around the wrong address is
     indistinguishable from a shell around the right one until somebody tries to share a record.
  2. **`site/master-data.html` writes to IndexedDB in whichever browser is showing it.** It does
     not load `erp-backend.js` at all — only `erp.html` and `index.html` do, and only those two
     get the `<meta name="erp-api">` marker from `sync-workspace.mjs`. So the record never left
     the laptop either. It was never on the server for the phone to fail to find.
     **Decision, part one: point both apps at the server** (`https://178-105-10-156.sslip.io/workspace/`),
     and DERIVE the internal-host allow-list from that one constant instead of repeating it.
     As two independent constants, moving the app meant editing both, and missing the second throws
     every tab out to Safari/Chrome — which reads as a broken app rather than a stale line. Android
     additionally needs `CookieManager.setAcceptCookie(true)` and a `flush()` in `onPause`, because
     the server now asks for a sign-in and an unflushed cookie means logging in on every launch.
     **Decision, part two: make `master-data.html` say what it does.** Its banner claimed "One
     source of truth, built for automation" while writing to one browser. Wiring all twenty of its
     entities to the server is real work and doing one of them would leave the repo half-migrated,
     which the mandate forbids — so for now the page states plainly that it is local to this device
     and links to the ERP workspace's Clientes screen, which is genuinely shared. An honest screen
     beats a half-migrated one. Full migration is task #96.
     **Verified rather than assumed**, since the whole defect is "it looks like it worked":
     a real Chromium drove the sign-in and the Nuevo tercero form against the built app and a real
     PostgreSQL; the workspace reported remote mode, the document version advanced 0→1, a SECOND
     BROWSER CONTEXT WITH NO STORAGE AT ALL listed the customer, the audit entry named the
     signed-in account rather than anything the browser sent, and `SELECT` against the database
     returned the row. The engine also rejected the first attempt because the tax identifier failed
     its checksum — worth recording as a pass, not a stumble: the validation is real, and the error
     surfaced in the UI instead of being written.
- **#82 — The read-only copies now say so, and the publisher is what says it (2026-08-08).**
  Following #81, the GitHub Pages copies needed to stop looking like the operational system.
  **Decision: stamp the warning at PUBLISH time, not in `site/`.** Being a read-only copy is a
  fact about where a page is _served from_, not about what it contains — the identical HTML is
  also served by the real server out of `apps/web/public/workspace`, where the warning would be
  a lie. Putting it in `.github/workflows/pages.yml` means it attaches to exactly the copies
  that deserve it, survives any content edit, and — decisively — covers `/preview/`, which is
  built from `claude/candi-programme-session-4-07amo8`, a branch this file does not live on and
  which another session is actively committing to. A warning that required their cooperation
  would not have arrived.
  Both copies are marked, not just the preview: the root is equally a static copy with no
  database, and it is the one that looks most like the real thing.
  **This replaced a one-liner that was quietly wrong.** The step used
  `perl -0pi -e 's{</body>}{$BANNER</body>}i'`, and `s///` without `/g` takes the FIRST match.
  In `site/journey.html` the first `</body>` is inside a JavaScript template literal that builds
  an email document — so the "Dev preview" pill was being injected into every generated EMAIL
  and never onto the page, which is the page the phone app opens as "Project". `backend.html`
  and `frontend.html` have no `</body>` at all and were silently skipped. Three of eleven pages
  wrong, exit code 0 throughout. The replacement anchors on the LAST `</body>`, appends where
  there is none, is idempotent, and the workflow now ASSERTS that every published page carries
  the marker — a marking step that cannot fail loudly is not a marking step.
  Ordering is load-bearing and commented as such: the stamper recurses, so `_site` also reaches
  `_site/preview`; the preview is stamped first and idempotence preserves its wording.
  **Not dismissible, and anchored to the bottom.** The failure being prevented is somebody
  forgetting which copy they are in an hour after arriving — precisely when a dismissed banner
  is gone. Bottom, because every screen has its own fixed top chrome and a top bar would work
  by breaking the page, which invites its removal. A one-per-tab interstitial carries the
  message; the strip carries the reminder.
  **`DEV_BRANCH` deliberately NOT changed.** `/preview/` tracks another session's branch. That
  is theirs to decide, and stamping at assembly time makes the warning correct either way.
  Verified with a real browser over all 22 published pages at iPhone width: 93 assertions —
  interstitial shown, strip present and linking to the live server, correct per-copy wording,
  no page errors, dismissal keeps the strip, no re-prompt within a tab, a new tab warned again.
  Also confirmed the old TestFlight build will hand that link to Safari (`WebViewStore.swift:242`
  opens any host outside `internalHosts` externally), so the warning is actionable on the phone
  that is already installed, with no new build.
  **Consequence recorded:** `PLAY-SETUP.md` told the operator to declare "no data collected" to
  Google Play, which was true only while the app wrapped a static copy. The Android app now
  signs in to a server and sends the company's records to it, so that declaration is corrected
  in the same commit — a false statement on a compliance form is not a rounding error.
- **#83 — One ERP, on the server, for the website and the app (2026-08-08).** The app and the
  website were running two different products: the phone loaded a much richer ERP from GitHub
  Pages, and the server ran an older one. **Decision: take the development `site/` wholesale as
  the single UI, and move its persistence onto the server.**
  **The seam is `ErpStore`, not the pages.** Every screen already reads and writes through it, so
  the switch lives there and all of them move at once, with no line changing in any page — which
  is also the only way they cannot drift into some screens using the server and others the
  browser. The signal is the same `<meta name="erp-api">` tag the server injects, and
  `sync-workspace.mjs` now stamps EVERY page rather than a hand-picked two, asserting the count.
  A whole-document PUT with `expectedVersion`, not per-command calls: the workspace mutates the
  engine at several hundred call sites, and routing each through the closed command whitelist is
  the right destination but a large piece of work. This trusts the client's arithmetic and is
  honest about it; what the server keeps is the version check, the migration ladder,
  normalisation through `ERP.from().toJSON()`, and attribution from the session. A conflict is
  REFUSED, which is the property that lets two people share a register at all.
  **The three screens with their own databases** — Master Data, Financial Data, the project
  folder — went onto the server too, through `site/erp-docs.js`, which keeps their exact
  `idbGet`/`idbSet` shape so each page changed by three lines. `erp_state` is keyed
  `(tenantId, key)` and always was, so they needed a key each and no new storage. The key is
  checked against a closed list; taken from the URL it would let any caller create unbounded rows.
  **Three ways this could have destroyed live data, all found by reading the code before running
  it:**
  1. `boot()` fell back to `ErpSeed.build()` on ANY load error and then persisted — so a dropped
     connection or an expired session would have PUT demonstration data over the company's
     register. In remote mode it now stops and says so, changing nothing.
  2. The "reload demo data" button would have replaced the shared register for everyone from one
     click, behind a confirm box whose wording ("en este dispositivo") was no longer true.
     Refused outright when remote — there is no version of it that is safe against live data.
  3. `ERP.from` in the development engine had lost the collection backfill, so a document written
     by an older build would throw on the first `state.x.filter(...)` — a 500 on a page unrelated
     to the change. Restored, with the reason written down.
     Also re-applied: `addTask` recording its author, which this session added to the old engine and
     the swap silently reverted. Found by the test that was written for it — the value of having
     driven two signed-in sessions the first time.
     **Verified by doing it**, not by reading: all 11 pages load in server mode with no script
     errors; a customer entered in the workspace, Master Data and Financial Data entries, and a
     project folder created through the journey UI all appear in PostgreSQL and are read back by a
     BROWSER WITH NO LOCAL STORAGE AT ALL — confirmed by watching it fetch the documents over the
     network and by `SELECT` against the database; a stale save is refused with 409.
     **Still local, and deliberately:** per-device UI preferences (which are correctly per-device),
     and photo blobs, which need an upload path rather than base64 in a JSON document. Recorded as
     task #97 rather than left implied.
- **#84 — Two scripts that should have existed, and one I invented (2026-08-08).** Twice I told
  the operator to run `./ops/set-ghcr-token.sh`. That script did not exist — I had described a
  fix without building it, which is worse than not offering one, because it costs them the
  attempt before they find out. Written now, along with `ops/deploy-now.sh`.
  Both are shaped by the same recurring failure: **every part of this pipeline reports success
  while serving an old version.** Actions goes green, the image publishes, the update timer runs
  on schedule, the container is healthy — and the machine answers with code from days ago. So
  neither script trusts its own commands. `set-ghcr-token.sh` logs in and PULLS with the token
  before claiming it works, because a stored token that cannot pull is indistinguishable from a
  working one until a release quietly fails to arrive. `deploy-now.sh` finishes by comparing the
  running image's `org.opencontainers.image.revision` against the local commit AND fetching
  `erp-docs.js` over the public address — a file that only exists from the release that put every
  screen on the server, so its absence is a precise statement about which build is live rather
  than a guess.
  **The app cannot be fixed from the server side.** The installed build has
  `internalHosts = ["stefangruber001.github.io"]` compiled in, and `WebViewStore.swift:242` hands
  any other host to Safari and cancels the in-app load. So publishing a redirect from the Pages
  copy would not move the app onto the server, it would turn every tab into a Safari launch. The
  address the app points at is part of the binary; changing it needs a build, and one was
  triggered rather than described.
- **#85 — The verification cried wolf over a working deploy (2026-08-08).** `deploy-now.sh`
  checked whether the new build was live by fetching `/workspace/erp-docs.js` and treating
  anything but 200 as missing. Every page is behind the login, so an unauthenticated request is
  answered **307 to /login** — the lock working exactly as designed. The script read that as "the
  file is not there" and announced a failed deploy over one that had succeeded, on the same run
  where the image comparison correctly reported `running revision 1b2b8879 — matches`.
  A check that cries wolf is worse than no check: it teaches the operator to ignore the one
  signal that will one day be true.
  **Decision: the running commit is reported by `/api/health`,** which is the one path that is
  public by design. `BUILD_REVISION` is passed as a build argument in `deploy.yml`, baked into
  the image, and returned by the health route. There was already an OCI `revision` label, but
  reading it needs SSH and Docker — so it did not get read, and the question kept being guessed
  at instead. A commit hash of a private repository identifies a build, not its contents, so
  there is nothing to protect here; making it public is what makes it get used.
  The lesson generalises past this script: **an unauthenticated probe of an authenticated
  surface measures the lock, not the thing behind it.**
- **#86 — Sign in once, on a screen that looks like the company (2026-08-08).** Four related
  complaints, one root each.
  **The login was teal (#1F4E5F) while every other screen is Canei green.** On a phone the login
  is the whole screen and arrives before anything else, so the one moment the brand has full
  attention was the one place it was absent. Now the green/deep-green/spark palette from
  `site/*.html`, the serif wordmark, and the house mark from `/brand/` — which is already on the
  middleware's public list, so it loads before there is a session.
  **Face ID.** There is no web API for it and nothing here calls one. What makes iOS offer it is
  recognising a login form and unlocking the saved password: a real `<form>` that POSTs, one
  field `autocomplete="username"`, one `autocomplete="current-password"`, and stable `id`/`name`
  pairs so the saved entry keeps matching. Those attributes are load-bearing — drop one and the
  QuickType bar silently stops offering, which reads as "Face ID broke". Passkeys would be the
  real thing and are a separate piece of work.
  **Eight hours was the wrong number.** It meant signing in most mornings, on a phone, on a site
  — which is how people end up choosing a password short enough to type one-handed. Named
  accounts now last 30 days AND the middleware re-issues the cookie past the halfway mark, so an
  active person is never asked again while somebody who stops still expires. The shared
  link-and-password stays at 12 hours on purpose: it is handed to people outside the company to
  look at a real register, and it should lapse on its own.
  **"Each tab needs its own login" was never about sessions.** All tabs share one cookie store.
  What is per-tab is the STALE PAGE: the app loads every tab up front for instant switching — so
  all seven load BEFORE anyone signs in — and `loadInitial()` will not reload a view that already
  has a URL. Six tabs sat on their own login page forever. Whichever tab completes a sign-in now
  posts `.caneiSignedIn`, and each other tab reloads ONLY if it is itself on the login page, so a
  tab holding real work is never disturbed. Selecting a tab re-checks too, which covers the case
  the broadcast cannot: a session that lapsed while the app was backgrounded.
  **Found while verifying, not reported:** the Control Tower still offered "Hay datos de
  demostración más recientes — Recargar" on the live server. `resetData()` already refused it, so
  it was safe, but offering to load two years of fiction over a company's register and then
  refusing the click is the wrong way round. The banner is now hidden when the data is remote.
  **A test had quietly stopped testing its subject.** "refuses an expired cookie" signed a token
  100000 seconds old — comfortably past eight hours, comfortably inside thirty days. Lengthening
  the session turned it into an assertion that a valid token is valid, and it went on passing.
  Now derived from the real TTL. A test that stops testing without failing is the worst kind.
- **#87 — "Do it for me" ran into a credential wall, and that is the correct behaviour
  (2026-08-08).** Asked to perform the deploy on the operator's behalf, I checked what I could
  actually reach: no `ops/provision.conf`, no SSH key, no `HCLOUD_TOKEN`, and no network route to
  the server (`curl` to the public address returns nothing from this sandbox). That is by design
  and worth keeping — an agent holding a production SSH key is a worse trade than an operator
  running two commands.
  **What I could do was remove the reason a laptop was needed at all.** `.github/workflows/ops.yml`
  already existed to run ops tasks from a browser, holding the key in repository secrets, opening
  the firewall for its runner and closing it again in an `always()` step. It had `status`,
  `backup-now` and `list-ssh-allowed` — everything except the one action anybody has actually
  needed today. It now has `deploy-now`.
  **It failed on first use, correctly and loudly:** `Missing repository secret(s): HCLOUD_TOKEN
SERVER_SSH_KEY`. The browser-ops path has never had its credentials, so it has never been
  usable — a facility documented in `docs/OPS-WITHOUT-A-LAPTOP.md` and quietly inert since it was
  written. Better to have found that with a named error than to keep pointing people at it.
  **Not resolved by me on purpose.** Those two values are the operator's; I must not hold them,
  and they must not be pasted into a chat — the same rule that applied to `.env` earlier. The
  workflow's own header is honest that adding them widens access to everyone with push rights,
  which is a real trade for the operator to make, not a default to assume on their behalf.
  **A second false alarm caught before it fired.** `deploy-now.sh` compared the server against
  HEAD, but `deploy.yml` only builds an image for pushes touching apps/, packages/, site/,
  tenants/ or ops/. The last two commits were iOS-only, so no image existed for them and the
  server was right to stay put — the script would have called a healthy server stale. It now
  compares against the newest commit that actually builds an image. Same lesson as #85, second
  disguise in one day: **a check must model what the system really does, not what the commit log
  looks like.**
- **#88 — The per-tab login was a server bug, not an app bug (2026-08-08).** Build 4 shipped the
  app-side fix and the operator still saw a login screen on every tab but Home. The app was doing
  what I told it to; what I had not checked was what the server does when an already-signed-in
  visitor asks for `/login`.
  It served the form. `/login` is on the middleware's public list — correctly, or nobody could
  ever sign in — but nothing there ever looked at whether the caller was already known. So the
  sequence was: every tab opens at launch, before anyone has signed in, and lands on
  `/login?next=<its own page>`; you sign in on Home, setting a cookie all tabs share; opening
  another tab reloads it; the reload asks for `/login` again; the server renders the form.
  Reloading a page whose URL _is_ the login page cannot escape the login page.
  **Fixed on the server: signed in, `/login` redirects to `next`.** That fixes it everywhere at
  once — the app needs no new build to benefit, and a bookmarked `/login` in a browser now lands
  in the workspace instead of asking for a password you have already given.
  The iOS half was corrected too, because it was independently wrong: `reloadIfShowingLogin()`
  called `reload()`, which re-requests the current URL — the login page. It now loads the tab's
  OWN url. Either fix alone is sufficient; both are right.
  **Reproduced before fixing, which is the part that made this quick.** Six browser pages sharing
  one cookie jar stand in for six tabs: 4/11 assertions passed against the old build, with every
  tab stuck on `/login?next=…`, exactly as reported. 11/11 after.
  **Two of my own assertions were wrong and had to be fixed first**, both in the flattering
  direction: one matched "clientes.html" inside the query string `?next=%2F…%2Fclientes.html`
  and so passed while the bug was present; another expected a literal filename where the page
  forwards itself to `erp.html#clientes`. A test that agrees with you for the wrong reason is
  worse than no test, and I nearly shipped on the strength of one.
- **#89 — Face ID is a device gate in front of the app, not a way to sign in (2026-08-08).**
  The operator asked for "this Face ID scan standard login like all premium app versions have",
  and there is a fork in the road there worth naming, because the two readings look identical
  from the outside and are not remotely the same thing.
  **Reading A** — store the password in the Keychain and let Face ID replay it into the login
  form. That is literally "logging in with your face", and it means the company's password now
  lives on the phone. **Reading B** — the server session already lasts thirty days, so the phone
  is already signed in; what is missing is any check that the person holding it is the operator.
  Face ID answers exactly that, and stores nothing.
  **Built B.** The password proves who you are to the server; Face ID proves the phone has not
  changed hands since. Banking apps work this way for the same reason. It also means a lost phone
  is a locked phone rather than a phone with a password on it, and nothing new has to be kept
  secret.
  **No lockout is possible**, which is the property that made this safe to ship without asking:
  the policy is `deviceOwnerAuthentication`, not `…WithBiometrics`, so iOS falls back to the
  device passcode by itself. A cracked camera, a mask, ten failed scans — every one still has a
  way in. And on a phone with no passcode at all the gate disarms itself instead of standing
  there refusing everybody.
  **Armed only after a sign-in has actually succeeded.** Arming at install would put a Face ID
  prompt in front of a login form: a lock on an empty room, and the first thing a new operator
  would ever see.
  **Sixty-second grace on returning from the background.** Zero would be correct and unusable —
  stepping out to the camera to photograph a wall would cost a scan on the way back, several
  times an hour.
  **The confirmation frame was the explicit request** ("it shortly show that Face ID check was
  done"). iOS shows its own tick inside the system sheet and removes it instantly, which leaves
  an app that merely opened. A branded "Face ID verificado" held for 780ms is the difference
  between a door that swung open and a door somebody unlocked for you.
  **Lock-screen copy is Spanish** while the native tab bar is still English. Inconsistent, and
  the lesser of two evils: this screen stands directly in front of the Spanish sign-in page and
  is read by a Spanish operator. It joins the pile that task #72 (bilingual toggle) has to clear.
  **One trap found by reading the lifecycle rather than by testing** (no macOS here to test on):
  the system Face ID sheet makes the app `.inactive`, so a rule of the form "on becoming active,
  if locked, authenticate" re-presents the sheet the instant the operator taps Cancelar, forever.
  Launch and return-from-background are therefore separate entry points, and neither re-asks
  while the gate is already sitting locked in front of somebody.
- **#90 — Audited where every byte lives; photographs were the last thing still
  in a browser (2026-08-08).** The operator asked for the whole platform to be
  checked, and for browser storage to stop. Result of the sweep across all 11
  pages and the API:
  - **the ERP register** (`erp-store.js`) — server, since the migration;
  - **Master Data, Financial Data, the project folder** (`erp-docs.js`) — server;
  - **journey photos and documents** — server, as base64 inside the project
    document. Correct location, wrong shape: the document is rewritten on every
    change, so a folder of photographs is re-encoded and re-sent each time. Not
    a data-location defect and not fixed here; logged as the next thing.
  - **site photographs on quote lines** — **were still IndexedDB, in every mode,
    including on the server.** Now fixed: `erp_blob`, RLS-scoped like every
    other table, bytes on the wire rather than base64.
  - **UI preferences** (`ErpStore.getMeta`: chosen period, column order, page
    size, favourites) and **the ES/EN choice** (`localStorage`) — deliberately
    left in the browser. These are properties of a device, not of the company; a
    phone and a laptop wanting different column widths is not a data-integrity
    problem, and moving them would mean the operator's laptop layout changing
    because they sorted a table on the phone.
    **The photograph failure is worth remembering because of its SHAPE.** The
    quote line referencing a picture went to the server and synced everywhere
    perfectly. Only the bytes stayed behind. So the laptop showed the line and
    rendered "(imagen no disponible)", and nothing anywhere reported an error,
    because from each device's point of view nothing had gone wrong — the state
    held a `storageKey`, and the bytes behind it existed on exactly one machine,
    in a store no backup ever saw. **A reference that syncs and a referent that
    does not is worse than neither syncing**, because the register looks complete.
    **Found while hardening a test, not while writing the feature:** the harness
    served JavaScript with no charset, and `norm()` in erp-store.js carried a
    literal combining-diacritics range — non-ASCII bytes whose meaning depends on
    the encoding the file is read as. It became "Range out of order in character
    class", a hard SyntaxError taking the whole module with it, on a line about
    accents. The real pages declare `<meta charset>` so production was never
    affected; the range is now `\u`-escaped anyway, because correctness that
    depends on every future page remembering a meta tag is not correctness.

## The programme branch's own decisions, renumbered (merged 2026-08-09)

`main` and the programme branch both kept numbering from #48, for entirely
different decisions, so these ten arrived colliding. They are renumbered from
#91 and carry their original number, because the session worklogs cite it.

- **#91 (was #48 on the programme branch) — CANEI session 4: one workspace, three panels, and four screens retired (2026-07-31).**
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
- **#92 (was #49 on the programme branch) — CANEI session 5: the planning engine, and where a calendar is allowed to live (2026-07-31).**
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
- **#93 (was #50 on the programme branch) — CANEI session 6: the chart, and keeping the arithmetic out of it (2026-07-31).**
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
- **#94 (was #51 on the programme branch) — CANEI session 7: the reader, and where a country's paperwork conventions live (2026-08-01).**
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

- **#95 (was #52 on the programme branch) — CANEI session 9: the constructor, and pictures that stay out of the table (2026-08-02).**
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

- **#96 (was #53 on the programme branch) — CANEI session 10a: what a plan is derived from, and what a cost is heading for (2026-08-03).**
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

- **#97 (was #54 on the programme branch) — CANEI session 10b: what "comprometido" actually means, and where a block earns its place over an alert (2026-08-03).**
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

- **#98 (was #55 on the programme branch) — CANEI session 11: where a suggestion earns trust, and the three refusals of Administración (2026-08-03).**
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

- **#99 (was #56 on the programme branch) — CANEI session 12: a threshold lives in one place, and "real data" for Recorrido means a link, not a rewrite (2026-08-03).**
  Spec §2.1 (Torre de Control), §2.2 (Mi Día) and §2.3 (Recorrido completo, Improvement #3).
  **Decisions:** (a) **Every alert condition gained a stable `code` and a `type`**
  (económica/técnica/documental/fiscal) via a single `ALERT_META` table, so classification lives in
  one place rather than being repeated at each of alerts()'s ~28 call sites. (b) **A card's colour
  dot reuses the SAME number the card already shows** (negative result, overdrawn balance, a
  payment week bigger than cash on hand) instead of a second per-tile threshold store — "el umbral
  de cada indicador" already has a home in the alert rules, and a second, parallel configuration
  surface for the same idea is exactly the kind of thing that drifts out of sync with what it
  duplicates. (c) **`managedAlerts()` layers assign/due-date/snooze/resolve-with-note-and-evidence/
  convert-to-task over the pure `alerts()` projection**, keyed by `code + JSON(ref)` — the same
  shape session 11 used for gestoría's justified exceptions and the comms queue: a computed list
  recomputed fresh every time, plus a keyed overrides map for what a person did about each item,
  never a mutated copy of the list itself. (d) **Only the alerts §3.2 and §2.1 explicitly call
  "configurable" got a numeric threshold** in the rule editor (opportunity-stale days, quote-expiry
  days, subcontract-unbilled days, warranty-expiry days, contract-start-at-risk days); the margin
  threshold keeps using the existing `state.config.marginThresholdBp` rather than gaining a
  competing copy. Every other rule still gets enabled/recipient/channel, satisfying the spec's
  "condición, umbral, destinatario y canal" without inventing thresholds for booleans that don't
  have one (a signed-or-not contract has no "days" to tune). (e) **The quarterly gestoría-package
  reminder (`GES-PACKAGE-DUE`) is explicitly advisory, not a legal filing deadline** — no AEAT date
  is asserted anywhere in the engine; the configurable number is "days after quarter-end this
  tenant wants the package sent by," a self-imposed target, not a regulatory one. A one-line
  clarifying entry was added to `LEGAL_REVIEW.md` §5 so nobody mistakes it for asserted tax law
  later. (f) **`upcomingMilestones()` reads every calendar date off the record that already owns
  it** — project dates, contract installments, bill due dates, purchase arrivals, guarantee expiry,
  subcontract/worker doc expiry, open tasks — rather than a second, calendar-specific copy of any of
  them; visits are deliberately excluded because they are logged AFTER they happen (VIS-01), so
  there is no future date to put on a calendar for one. (g) **Card order/visibility and the Mi Día
  legend filter are browser preferences, stored in `ErpStore` meta**, not engine state — a
  dashboard's layout is a viewing choice, not business data, and a second browser on the same
  tenant is allowed a different one. (h) **`exportar la vista a PDF/Excel` became a real CSV
  download plus the browser's own print dialog for PDF** — both genuinely produce the artifact named,
  neither is a fake behind a port, and building a real XLSX writer or a server-rendered PDF for a
  dashboard export was judged not worth the weight next to those two. (i) **Recorrido's "Proyecto
  existente" is read-only and reuses the real screens rather than re-implementing thirteen stages
  of editing UI a second time.** journey.html's existing "Crear nuevo proyecto" walkthrough (its own
  sample data, its own `caneiJourney` IndexedDB) is completely untouched and stays the default,
  exactly as §2.3 asks ("se mantiene ... tal como está hoy"). The addition reads the SAME `caneiERP`
  database erp.html writes; each of the thirteen stages shows a real status
  (completa/en curso/pendiente) and a real summary derived straight from the record that owns it,
  with a link into the actual erp.html screen — the spec's own framing ("acceso directo a la
  pantalla real correspondiente ... de modo que el recorrido sirva también como lista de puesta en
  marcha del proyecto") taken at its word rather than read as "clone every screen inline." (j) The
  unsaved-changes confirm on switching project applies **only when leaving an in-progress demo
  walkthrough** — a read-only real view has nothing local to lose, so switching between two real
  projects never blocks. (k) **Duplicating a real project makes one real `createQuickProject` call**
  (same customer, same estimated value, prefixed as a copy) rather than deep-cloning a frozen budget
  baseline, which the real `presupuestos` screen this stage links to already does more carefully.
  (l) **Downloading a real project's folder reuses the demo's existing `zipStore`/`download`
  plumbing**, producing one summary text file per stage instead of captured photos — a second ZIP
  implementation for the same button would be the bug. Reversible: schema v8 is additive
  (`alertRules`, `alertOverrides`, `opportunity.decidedAt` backfilled from the existing creation
  date, `project.priority` defaulted false), `controlTower()` only gained new fields (`cards`,
  `series`, `lastCalculatedAt`) — nothing existing callers (year-sim, migrations-sim) already read
  was renamed or removed, and no packages/capability changed, so the committed browser bundle is
  untouched this session.

- **#100 (was #57 on the programme branch) — CANEI Clientes rework: a customer registry that a person can actually work in (2026-08-03).**
  Spec §3.1 (Clientes / gestión de terceros), driven by direct operator annotations on the live
  screen rather than by a session of the twelve-session plan.
  **Decisions:** (a) **`Clientes` is now a customer-only registry.** The Roles column and the role
  selector on the create drawer are gone, because a screen titled "Clientes" that lists suppliers
  and industriales is lying about what it is; the underlying party record still carries `roles`, so
  a supplier/industrial screen remains a pure UI addition whenever it is asked for, with no data
  change. (b) **`party.activityLine` was removed outright — the one deliberate deletion in the whole
  migration ladder (v9).** A línea de actividad describes the work, not the person paying for it, so
  it belongs on budgets and projects (where `profitability("activityLine")` still reads it) and was
  a weaker duplicate on the customer that could disagree with the job's own line. The additive-only
  guard in `migrations-sim.mjs` was NOT loosened: it grew an explicit `INTENTIONAL_REMOVALS` set
  with this one path and the argument for it, so the guard still fails on every other dropped key
  and the removal is a change record rather than an escape hatch. (c) **Fields the operator asked
  for that had no home were added to the record, not faked in the view** — `contactPerson`,
  `landline` and `createdAt`. v9 backfills `createdAt` to **`null`, never to today**: a migration
  that stamps today's date on a customer created two years ago is inventing a fact, and the list
  renders "—" for it honestly. (d) **Deleting a customer is guarded by the documents that reference
  it, not by a soft flag.** `deleteParty()` walks budgets, contracts, projects, invoices, receipts,
  bills, collections, subcontracts and purchases and refuses by naming up to four blocking
  documents; the UI then offers deactivation instead. Silently deleting a party that a filed
  invoice points at is the failure mode this exists to prevent. (e) **Search, paging and page size
  are view state.** The name/code filter and the page number reset on every visit; only the chosen
  page size (10 default, 10/20/50) is persisted, in `ErpStore` meta alongside the other UI
  preferences — never in the state blob, because how many rows fit a screen is a property of the
  screen, not of the tenant. (f) **Export writes a genuine `.xlsx`, reversing #56(h).** That entry
  judged a real XLSX writer not worth the weight _for a dashboard of eight indicators_; a customer
  registry is a table people take to a gestoría, and a CSV renamed `.xlsx` is the kind of small lie
  that gets found out in front of someone else. The writer is ~60 lines of ZIP + SpreadsheetML with
  no dependency (a page served from a bare static host cannot pull a library), and **every cell is
  an inline string on purpose**: postal codes, phone numbers and client codes are text, and letting
  Excel guess turns `08960` into `8960`. (g) **One `CLI_COLS` table drives the table head and both
  exports**, so a column can never be added to the screen and go quietly missing from the file.
  (h) **Export sends every row the filter matched, not the page on screen** — exporting ten of
  seventeen because ten happened to be visible is a surprise the moment anyone uses the result.
  (i) **The fit-all-columns-to-width table sizing was built, shown, and reverted at the operator's
  request**; the list keeps natural column widths and scrolls horizontally. Reversible: v9 is the
  only non-additive step and is documented as such in both the ladder and the guard; everything
  else is UI, and no packages/capability changed, so the committed browser bundle is untouched.

- **#101 — S1b: six secciones, English routes, and the four things that were
  removed (2026-08-09).** The v4 specification replaces the seven-section menu
  with six, and the programme adds three subsecciones to its twenty-six
  (Comunicaciones, Alertas, Usuarios move into Configuración rather than being
  deleted) — so the shipped shape is **6 × 29**, asserted in the e2e suite so it
  cannot drift unnoticed. **Decisions:** (a) route keys become **English**, and
  `ROUTE_ALIASES` maps every retired hash to its replacement with `go()`, boot
  and `hashchange` all resolving through it — a rename that breaks a bookmark
  silently is not a rename, it is a bug with a changelog entry. The address bar
  is normalised with `replaceState`, so Back never bounces between the old name
  and the new. (b) The doc merges six built screens into three (PRY-01, ADM-03,
  ADM-05); each merged route is a **tab strip over the existing bodies** rather
  than a rewrite, because rewriting them to the layouts the doc specifies is
  S7/S8/S11's job and doing it here would put two large changes in one commit.
  The chosen tab is remembered per route and deliberately **not persisted** —
  which tab you last looked at is not company data. (c) The Torre goes from
  eight indicators to the doc's four, and **computes none of them**: each is
  asked of the module that owns it, so the Torre cannot become a second,
  disagreeing source of truth. It is read-only, five alert rows ordered by
  severity, no control that writes — because the doc says twice that it reads
  the whole chain and writes nothing. (d) Everything one _does_ to an alert
  moves to **DMC-07 Alertas**, reading `managedAlerts()` rather than `alerts()`
  so a snoozed alert is not still sitting there with buttons on it. (e) The
  subcontract lifecycle **screens** go, the data and rules stay — but those
  screens were the only thing exercising the rules, so the coverage **moved down
  a layer** into `manageability-sim` (48 → 57 checks) rather than disappearing
  with the UI. That is the difference between retiring a screen and quietly
  un-testing an engine. (f) **No schema migration.** The plan expected v10 to
  carry removals and key renames; there are none — what changed are route keys
  and view code, and the two preferences involved live in the store's `meta`,
  not the state blob. An empty migration is a version bump that claims a change
  nobody made. (g) The mobile bar carries **five icons** as the doc requires, so
  Configuración leaves it for the profile menu; an e2e check enforces the count
  and the absence of horizontal scroll. (h) Both native shells now address
  sections by route key instead of the four redirect stubs they were pointed
  at — the tabs resolved, but through two hops and onto whichever screen the
  stub forwarded to rather than the one the tab was named after. (i) The
  language toggle reaches the **breadcrumb** for the first time: it was built as
  one text node, `"ERP › Torre de control"`, which is a string no dictionary can
  hold. **Reversible:** the removed screens are one `git revert` away and no
  engine code was deleted.

- **#102 — S1c: accounts become rows, and a role becomes a permission
  (2026-08-09).** Accounts lived in `ERP_USERS` in the server's `.env`, the file
  that also holds the database password — so adding a colleague meant handing
  over the keys, and the pilot write-up's "any limit on what a visitor may do:
  NONE" was literally true. **Decisions:** (a) `erp_users` and `erp_user_tokens`
  are tenant-scoped with FORCED row-level security like every other table, and
  the RLS test for them runs as the RESTRICTED role — a superuser bypasses RLS
  regardless of FORCE, so proving it as the owner proves nothing. (b) **The
  admin never learns the password**: creating a user mints a single-use,
  time-limited token, stores only its SHA-256, and the invited person chooses
  their own. The script this replaces generated a password and printed it to the
  admin, who then knew a credential somebody else was responsible for. SHA-256
  rather than scrypt for the token because 32 random bytes have nothing to
  guess; the slow hash would only make the activation page feel broken. (c)
  **Disable, never delete** — the audit trail has to keep resolving who did
  what — and disabling **moves `sessionsValidFrom` forward**, which is what
  actually ends that person's sessions: tokens are signed and stateless, so the
  only previous lever was rotating `SESSION_SECRET`, which signs out the whole
  company to remove one person. (d) **Roles grant opaque permission strings**,
  so a screen asks `may(session, "user.manage")` rather than testing
  `role === "admin"`; gestoría's exclusion from margins and commercial prices is
  expressed as an absent permission and asserted in a test, because that
  exclusion is the reason the role exists. (e) **The last admin cannot lock the
  system** — no stepping down, no disabling themselves, and a disabled admin
  counts as none. (f) **`ERP_USERS` still works, as the bootstrap**: a server
  with no rows must still let somebody in to create the first account, and those
  accounts read as admin/active because they are the people who held the keys
  before there was a screen. A row wins over an environment entry for the same
  address. (g) **The session check lives in the middleware, not in
  `requireUser`** — seven of fourteen tenant routes never call `requireUser`,
  because they only read, so the check placed there left a disabled colleague
  reading the register. (h) **A database that cannot be reached does not lock
  anybody out**: the signature was still valid, so an outage stays an outage
  rather than becoming a lockout. (i) **The login form is rate-limited**, by
  network address and by the address being tried, since either alone has a hole.
  It is an in-process counter and says so — right for one container, wrong
  behind several. (j) **SMTP is deferred by operator decision.** With it the
  invitation is mailed; without it the admin gets a copyable link and the screen
  says plainly that no mail was sent. The fallback is a working path, not a
  degraded one — what is never acceptable is a success message for a message
  nobody will receive.

- **#103 — S2: DMT-01…04 Datos Maestros, a shared list primitive, and closing
  gaps 1–4 (2026-08-09).** Clientes was the only master-data screen; Proveedores
  and Subcontratas were placeholders, and Personal interno had no registry at
  all — a timesheet needed only a worker's name. **Decisions:** (a) **The CIF
  check digit is now verified, not just the shape.** `validTaxId`'s CIF branch
  used to `return true` on a regex match alone; it now runs the same
  odd-positions-doubled-and-summed algorithm the DNI/NIE branches already used
  for their own check letter. Nine pre-existing fixture/seed tax ids across
  `year-sim.mjs`, `import-sim.mjs`, `manageability-sim.mjs`, `erp-seed.js`,
  `erp-history.js` and `apps/web/lib/erp-engine.test.ts` had only ever satisfied
  the old structure-only regex and were corrected to the nearest valid check
  character, preserving every other digit for traceability. (b) **A shared list
  primitive** (`renderMasterList`) replaces the Clientes-only
  toolbar/table/pagination/export code, so DMT-02/03/04 — and every list screen
  after them — inherit it instead of retyping it. Page sizes correct to
  **10/25/50, 25 default**, fixing the 10/20/50 Clientes shipped with; the
  50-scan `.mlist` CSS rule is a first phone-card rendering, not the full
  verification S14 owns. (c) **Proveedores and Subcontratas are the same party
  file, filtered by role** — not a new collection — reusing
  `newPartyDrawer`/`partyDrawer`/`editPartyDrawer` rather than building
  duplicate screens. `editPartyDrawer` gains `businessLine`/`category`/`aliases`
  fields (gaps 1/2/4); `sourceSystem` (gap 3) is provenance, set by import, not
  hand-edited. (d) **Personal interno (DMT-04) is `state.workers`, its own
  registry** — list, create, edit, append-only tarifa history, documentación
  (reusing the existing `workerDocDrawer`), deactivate-never-delete. The engine
  gained `updateWorker`/`deactivateWorker` (there was no way to edit or retire a
  worker before this session) and a taxId check-digit validation on
  `addWorker`/`updateWorker`, matching parties. **Known limitation, not fixed
  here:** two rates dated the same day break the tie by array order, not by
  which was added last — real for a same-day correction, out of scope for this
  session. (e) **`searchAll()`'s "Proveedores" group routed every hit — supplier
  AND subcontractor — to `k:"customers"`** (adjacent to audit F-020): a search
  hit on a subcontracted industrial opened the customer screen. Split into two
  groups routing to their own DMT-02/03 screens. (f) **`findDuplicateParty`'s
  result is now surfaced**, not silently discarded: `newPartyDrawer` shows which
  earlier record a new one may collide with instead of a plain "created"
  toast — the engine already computed `duplicateSuspect` on every `addParty`,
  nothing read it. (g) **The 480px-with-tabs drawer layout the spec describes is
  not built this session.** The existing single-scroll party and worker drawers
  are reused and extended in place; only the global `.drawer` width moved to
  480px. Rebuilding the drawer as a tabbed panel (Identification/Contact,
  role-specific Precios/Compras/Documentos/Tarifas tabs) is real UI work with
  real regression risk across every existing drawer flow across 29 screens —
  deferred rather than rushed, and not silently dropped: it is the reason S2 is
  scoped as "screens landed, tabs deferred" rather than "DMT-01…04 done" in
  `docs/CANEI-V4-MAPPING.md`. (h) **`GET /api/~/session`** is new — the
  workspace is a static file with no server-side render, so it is the only way
  a screen can know its own permissions. It gates the IBAN field in
  `editPartyDrawer` behind `party.bank.read`, verified live against a real
  Postgres and the standalone Next build (`server-e2e` 27/27). **This is
  masking, not enforcement** — both the route's own doc-comment and the
  client's `SESSION` variable say so explicitly, and it is recorded here again
  for visibility: **server-side per-command RBAC on `/erp/command` does not
  exist yet.** Today every signed-in identity can issue every command the
  engine accepts; `party.bank.read` only decides whether the workspace SHOWS the
  field, not whether a direct API call could set it. Closing that gap is a
  distinct, larger piece of work (a permission check per command name) and is
  logged here as the follow-up rather than attempted piecemeal inside a
  UI session. **Reversible:** every list screen change is additive (new
  `VIEWS` entries, a new shared function); the CIF fixture repairs are
  git-diffable single-character corrections; the session endpoint is a new,
  independent route.

- **#104 — S3: the company's vocabulary leaves the code, and the interface
  learns a third language (2026-08-09).** Four reference lists were compiled
  into the engine, DMC-01/02 had no way to create anything, and the language
  toggle was ES⇄EN in a product built for a Catalan-speaking region.
  **Decisions:** (a) **Only vocabulary moves into `state.lists`** — units, lead
  sources, loss reasons, payment methods, and (for DMC-01) the catalogue's
  chapter tree. The rest of `LISTS` stays compiled in, because invoice kinds,
  document statuses and movement classes are keys the engine BRANCHES on: an
  owner renaming one would not be configuration, it would be a bug. (b) **A
  code is permanent, a label is editable.** Records store the code forever, so
  `updateListEntry` patches `es`/`ca` and nothing else — offering to rename a
  code is offering to break every record already carrying it. This also fixed
  a real display bug: a customer's origin rendered as its raw English key
  (`referrer`) because the list had codes and no field to put a label in. (c)
  **Retiring is never blocked by usage.** A list is retired precisely BECAUSE
  it is no longer how the company works; `listLabel` keeps resolving it on
  records that already carry it, so the usage count informs rather than
  blocks. The one refusal is emptying a list entirely. (d) **A record whose
  code has since been retired keeps it**, marked, in the picker. Dropping it
  would silently rewrite the record to whatever happens to be first the next
  time somebody opens the drawer and saves. (e) **`state.lists.itemChapters`
  is a list, not a derived set** of the distinct chapters on items: a tree the
  owner can drag needs somewhere to keep that order, and a chapter with
  nothing in it yet still has to be visible or it can never be filled. The
  array order IS the display order, so no second sort field can disagree with
  what is on screen. (f) **Migration v11 rather than more keys in v10.** v10
  had already been written to blobs by the time DMC-01 needed the catalogue
  fields, and a blob stamped 10 never re-runs 10 — appending to it would have
  meant the documents that most needed the keys were exactly the ones that
  never got them. (g) **DMC-02 has no edit path, deliberately.** Prices are
  append-only (SUP-05) because a budget written last month has to keep
  explaining itself with the price that applied then; the detail drawer says
  so and offers "record a new one". An unstated IVA stays `null` rather than
  becoming 0%, and a supplier with no price reads «sin precio» rather than
  0,00 € — rendering a blank as zero makes the supplier who never quoted look
  like the cheapest, which is how a purchase order goes to the wrong company.
  (h) **`master-data.html` stays.** DMC-01 supersedes only its partidas half;
  it still owns company, branches and other registers the engine has no home
  for, and the legacy import path reads its localStorage. (i) **Spanish is the
  i18n hub.** Entries are triples keyed on the Spanish form, so EN → CA is one
  lookup instead of two hops through Spanish losing whatever the first missed.
  Catalan lives in its own file because it is the column most likely to be
  corrected by somebody who is not editing the application. (j) **The Catalan
  guard is a ratchet, and this is the honest part of the entry.** 466 of 1792
  entries are translated — the whole navigation, shell, launchpad and the main
  screen headings, i.e. what a Catalan user reads first. The remaining **1326
  are NOT translated**, are recorded as `CA_BACKLOG` in
  `tests/i18n/coverage.mjs`, and the check fails if that number grows. So
  every string from S3 onward must ship with Catalan, while the historical
  backlog is counted in the open rather than hidden behind a check scoped
  small enough to pass. Translating it is content work a native speaker should
  review, not a side effect of a feature session; English, by contrast, is at
  100% and enforced absolutely. (k) The guard immediately found a real
  pre-existing bug — **11 duplicate Spanish keys, 4 with different English** —
  where only the first was ever reachable, so `Pendiente de cobro` rendered
  "Pending collection" everywhere the second entry intended "Receivable". The
  shadowed copies were removed; keeping the first preserves today's rendering
  exactly. **Reversible:** the lists are data with a seeded migration, so
  reverting the screens leaves the vocabulary intact; the Catalan file is
  additive and can be deleted without touching the ES/EN spine.

- **#105 — S4: a lead had no lifecycle, and the coverage guard proved it only
  checks the dictionary (2026-08-09).** COM-01/COM-02 needed an actual visit
  lifecycle — `addVisit` had always been a single unconditional write, with no
  way to schedule one first and capture it later. **Decisions:** (a) **Two
  engine methods, not a status field bolted onto the old one.**
  `scheduleVisit(v,user)` creates a `status:"scheduled"` record with nothing
  captured yet; `completeVisit(id,patch,user)` writes the capture fields once,
  refuses a second call on an already-`"done"` visit (the existing
  `validateVisit` is the correction path for that, unchanged), and flips the
  owning opportunity from `awaitingVisit` to `awaitingBudget`. `addVisit`
  keeps its old one-step signature for the 6 seed/history call sites — a
  second lifecycle is not owed to code that only ever wrote finished visits.
  (b) **`renderMasterList` grew three flags instead of a second, duplicate
  pagination implementation**: `fixedSize` pins the page size and hides the
  size selector, `noExport`/`noNew` drop the buttons — needed because COM-02
  is two fixed-height blocks (Programadas/Realizadas) sharing one `state.visits`
  collection filtered by status, not two different kinds of record. Verified
  against every S2/S3 screen that already uses the primitive: no regression.
  (c) **The handoff to a presupuesto stops at a bare budget header.** COM-03
  (S5) owns the real builder; `visitDetailDrawer` creates the header via the
  existing `createBudget`, links it back with `validateVisit(visitId,
{budgetId})`, and navigates to `#quotes` — proven in e2e by asserting the
  hash actually changes, not just that a function was called. (d) **The
  server command whitelist (`apps/web/lib/erp-commands.ts`) is untouched,
  matching S2/S3 exactly.** `site/erp.html` persists through
  `ErpStore.saveState()` → `/api/<tenant>/erp/state`, a whole-document sync
  that already covers every mutation in this file including brand-new ones;
  the granular `COMMANDS` whitelist backs a separate, narrower surface
  (`apps/web`'s server-rendered tenant pages) that neither S2 nor S3 extended
  for their own new engine methods either. Extending it for `scheduleVisit`/
  `completeVisit` here would be new scope invented mid-session, not a gap S4
  introduced. (e) **The i18n coverage guard caught two real misses, and
  proved something about itself in the process.** First pass: 29 new
  ES/EN/CA triples covered every new sentence, label and button — the guard
  (`tests/i18n/coverage.mjs`) was green, and it was still wrong. Adding a
  real-browser check that visits the new screens under CA/EN (rather than
  only asking the dictionary "does an entry exist") found (i) the row-count
  tag ("N oportunidades", "N visitas programadas/realizadas") never
  translates at all — the same dynamic noun-splice pattern `clientes`/
  `proveedores`/`registros` already use, fixed for EN with the same
  `rxEs2En`/`rxEn2Es` regex-pair convention those use, left as pre-existing
  CA backlog because CA has _no_ regex coverage for any such count today,
  clientes and proveedores included — a decision 20 says is allowed to be a
  ratchet, not zero; and (ii) the "Programadas"/"Realizadas"/"Sin crear"
  strings, which are plural/distinct forms of words that WERE in the
  dictionary ("Programada", "Realizada"), so the coverage guard's exact-string
  check saw no gap while the screen showed raw Spanish under CA and EN both.
  Fixed with three more triples. **The lesson, stated plainly: the dictionary
  coverage guard proves entries exist, not that a specific screen renders
  them — a real-browser assertion per new screen is the only check that
  catches a translated-looking string that is actually a different string.**
  **Reversible:** the two engine methods are additive (old `addVisit` callers
  unaffected); the `renderMasterList` flags default to their old behavior
  when omitted; the i18n additions are dictionary entries only.

- **#106 — S5: the presupuestador leaves the shell, and the document stops
  speaking the operator's language (2026-08-09).** COM-03 is the screen the
  business runs on and it was a three-pane card layout inside the normal page,
  with no way to reorder anything, no way to number a row by hand, and — this
  was the surprise — **no way to send a presupuesto or record the customer's
  answer at all**: `issueVersion` and `acceptVersion` had exactly zero callers
  outside `erp-seed.js` and `erp-history.js`. **Decisions:** (a) **Free
  numbering is a flag on the row, not a mode on the screen.** `_renumber`
  assigns positional numbers to every row EXCEPT those carrying `manualNum`,
  so a number a person typed survives every later insert, delete and drag,
  while a number the system assigned belongs to the position and moves with
  it. Duplicates are refused, because the number is the reader's only index
  into the document and into the graphic annex. (b) **The five stages are
  derived, not stored.** `budgetStage` computes draft/issued/accepted/
  rejected/expired from the record. Expiry is the reason: it is not something
  done to a record on a date, it just becomes true, and a stored status can
  never know that without a nightly job nobody has written — the shipped data
  proved it, with four seeded budgets long past their validity still stored as
  `issued`. (c) **`rejectVersion` was missing and had to exist**, or the v4
  register could not have a «Rechazados» group at all; it takes a loss-reason
  CODE from DMC-04 so refusals stay countable alongside `loseOpportunity`, and
  free text goes in `notes`. Testing it immediately exposed a real defect in
  the code that was already there: **`acceptVersion` never checked for an
  existing customer response**, so a refused version could be accepted
  afterwards, overwriting the refusal and flipping the opportunity from lost
  back to won with no trace of which answer the customer gave. Both now refuse
  a version that already has an answer; a customer who changes their mind gets
  a new version. (d) **Full screen is opt-in per render, cleared by
  `render()`** rather than turned off on the way out, so no exit path can
  strand the next screen without its navigation. (e) **"Guardar" is in the bar
  because §3.2 puts it there, and does the only honest thing left**: §3.1 says
  nothing waits for a save and this screen already writes every keystroke
  through, so the button flushes the 140 ms debounce and reports the real
  outcome (`persistNow`), including failure — which the fire-and-forget path
  deliberately swallows. It never claims to have saved something that was not
  already saved. (f) **The customer's document is not interface.** It is
  written in `budget.language`, a field set per customer, and marked
  `translate="no"` — which `i18n.js` now honours for a whole subtree. This
  fixed a real pre-existing bug rather than only enabling Catalan: "Base
  imponible", "Validez", "Opcionales (aparte)" and "Total por m²" are all in
  the dictionary, so a Spanish presupuesto previewed by an operator working in
  English came out partly English. The document label table (`DOCL`) is
  deliberately NOT in the i18n dictionary, because those two ideas must not
  share a switch. (g) **The visit panel falls back to the customer's last
  capture when no visit is linked, and says so in a pill.** Only S4-era
  budgets carry `visit.budgetId`, so a strict reading would have shown an
  empty tab on every historical presupuesto; a labelled guess is more useful
  than nothing and safer than an unlabelled one. Nothing on that tab writes,
  and nothing is copied into a line — the mapping's own row 2 says the visit
  does not inherit into the presupuesto. (h) **Two count labels were rebuilt
  as separate text nodes instead of being given regex rules.** "Borradores ·
  1" is one text node and no dictionary entry can reach it; a regex would have
  fixed English only, since Catalan has no regex coverage for any such count.
  Splitting the label from the number fixes all three languages with no rules
  at all, and is the general answer to the class of bug S4 recorded. Found by
  the real-browser render check, exactly as #105 said it would be, and not by
  the dictionary guard, which was green throughout. **Reversible:** every
  engine method is additive; `body.fs` is one class on one screen; the
  document label table can be deleted to return every presupuesto to Spanish.

- **#107 — S6: the OCR pipeline, and the rule that a dot has to be earned
  (2026-08-09).** `extraction-ocr` was the one `unbuilt` area: session 7 built
  the interpretation half and nothing could reach it. **Decisions:** (a) **The
  recognition half is host infrastructure, not domain, and lives in
  `site/erp-ocr.js`.** pdf.js and tesseract.js are ~7 MB that know nothing
  about invoices; what the text MEANS stays in
  `@repo/capability-extraction`, which is why the meaning is still tested
  against a jurisdiction that does not exist while the recognition is tested
  against a real browser. (b) **Green only where a validator vouched for the
  value** — a check digit that computes, a real calendar date, arithmetic that
  balances — **never on confidence**, however high. This is the memo's whole
  point: the spike's scanned NIF came back `A08912907` for `A08932907`, read
  with perfect confidence. A consequence stated rather than hidden: fields
  with no validator available (issuer name, document number, order reference)
  are **always amber**, matching the spike never once reading a document
  number correctly off a raster. `needsReview` became the amber list, so the
  dots and the review list are two readings of one decision instead of two
  decisions that can disagree. (c) **A typed correction is re-checked, not
  believed.** Typing is exactly where a NIF acquires a transposed digit, and a
  check digit does not care who produced the number. (d) **The runtime is
  vendored under `site/vendor` (7.23 MB, `tools/vendor-ocr.mjs`)** because
  `pages.yml` publishes `site/**` from a bare checkout with no Node, and both
  a bare static host and offline capture forbid the CDN these libraries reach
  for by default. A script rather than a one-time copy, so the provenance of
  7 MB of binaries is a command anybody can re-run and diff. (e) **Nothing
  loads until it is needed**, and `prepareOffline()` is an explicit
  user-pressed pre-fetch — 7 MB must never land on somebody's mobile data on a
  site because a screen opened. (f) **`captureDocument` is called at the END**,
  by a person pressing Confirmar, so CAP-04 is enforced by the flow as well as
  by the capability's `confirmed: false` type. The machine's reading is stored
  beside the confirmed values rather than instead of them. (g) **Provenance is
  the LINE, not a pixel box.** The capability records character offsets into
  the recognised text, not image coordinates, so the honest rendering of the
  doc's "highlight the area of the image it came from" is to show the lines
  and highlight the one a value was read off. Claiming a pixel box we do not
  have would be a nicer screen and a lie. **Three real defects were found by
  driving a browser rather than by reading code**, all in this session's own
  new code: tesseract's default `blob:` worker gives its Emscripten core no
  script directory, so the `.wasm` resolved to a bare filename and the promise
  never settled (`workerBlobURL:false`); the image's object URL was revoked in
  `onload` before tesseract read `img.src`; and `logger: undefined` throws once
  per progress tick because tesseract calls it unchecked. **Reversible:** the
  vendored runtime is inert until a file is handed over, and deleting
  `site/erp-ocr.js` leaves the capture screen offering manual entry, which it
  already does when the reader is unavailable. (h) **A fourth defect was found
  by CI rather than by the local gates, and the guard moved because of it.**
  `createExtraction` called `extractionConfigSchema.parse()` and pulled zod
  into the browser bundle — 90 KB to 217 KB, to validate a config the browser
  never parses. Fixing it took two changes: literal defaults on the surface,
  AND moving the schema out of `model.ts`, whose runtime constants force that
  module into the bundle where a top-level `z.object(...)` cannot be proven
  side-effect-free. **This repository has hit that wall three times now** (the
  `rates` subpath, the earlier 23 KB → 152 KB regression, and this one), and
  writing it down twice did not prevent the third — because the assertion was
  inline bash in `ci.yml` that no local gate run could execute. It is now
  `tests/parity/bundle-safety.mjs`, run by CI **and** `make gates`, and it
  names both causes when it fires. The lesson is general: a rule that only
  exists on the server is one you learn about after pushing.

- **#108 — S7: what puts a document on the left of ADM-03, and what a counter
  counts (2026-08-09).** The v4 document specifies ADM-03 as two zones — a 372
  column of 96 px cards beside a 756 validated list — and ADM-02 as three
  counters over a list, with the order opening full screen beside the
  supplier's quote. **Decisions:** (a) **The left column is what still needs a
  person, and "needs a person" means UNALLOCATED, not "unvalidated".** S6
  confirms a document at capture time, so a split on status would leave the
  inbox permanently empty and the screen would be two zones in name only. The
  question somebody opens this screen to answer is "what have I not filed
  yet", and the answer is: nobody has said who pays for it. (b) **Newest
  first.** A worklist that appends to the bottom asks the person who has just
  photographed a delivery note to scroll past everything they already dealt
  with to reach it. (c) **Allocation offers ONE destination select holding
  both kinds of answer** — a project or an overhead category. The engine
  refuses a line naming both (rule 4 of the mapping's entity model: every cost
  lands on a project _or_ an account), and a screen that lets somebody tick
  two boxes and then says no is a screen that asked the question badly.
  (d) **The split arithmetic is asserted only against a CONFIRMED total.** An
  unconfirmed document has no total to check against, and deriving one from
  the split itself would make the check agree with whatever it was handed — so
  filing an unread photograph stays possible and stays honest. (e) **The
  three ADM-02 stages are derived from `purchaseStatus`, not stored beside
  it.** The seven-state lifecycle is what the record knows; oferta/pedido/
  facturado is the coarser reading the screen is organised around. Two stored
  fields that must agree about one order is exactly how they stop agreeing.
  A **cancelled order is in none of the three** — shown in the list, counted
  nowhere, because a counter that includes work nobody will do has to be
  explained every time it is read. (f) **"No goods receipt" is read as "receipt
  is not a STAGE", not "delete the receipt".** The engine keeps
  `receivePurchase` and `purchaseReconciliation`; the action moved into the
  480 record pane and the order reads _Pedido · Recibida_ — stage and status,
  both true. Deleting the evidence a delivery note gives because a screen
  stopped counting by it would be the mistake S1b named when the subcontract
  screens went. (g) **ADM-02's left zone links an already-CAPTURED document
  rather than uploading a second copy**, so the reading, the date and the
  file's origin are the same object on both screens. (h) **`updateCapture` is
  separate from `confirmCapture`.** The three archive fields say nothing about
  what the document contains, so adding a note must not re-derive the standard
  name or re-run duplicate detection — a filed invoice that renames itself
  because somebody typed a note is a lost document. **Reversible:** every one
  of these is a derived reading or an additive field; the stored shape gains
  three strings (v14) and nothing was renamed or dropped.

- **#109 — S7: purchase orders stay single-line, deliberately (2026-08-09).**
  §3.2 gives ADM-02's record pane a _line table_, and the pane renders one —
  over the single description, quantity and unit price a purchase order
  actually stores. **Multi-line orders were not built.** The reason is not the
  table: it is that `receivePurchase` completes an order when the received
  quantity reaches the ordered quantity, and there is no honest single
  quantity for an order whose lines are in different units. Making the table
  multi-line without answering that would leave receiving quietly wrong on
  exactly the orders it was extended for. The pane is written to render
  however many rows it is handed, so adding lines later is data and an engine
  decision about completion, not a second rewrite of the screen. **Reversible:
  yes — nothing was removed to make this true.**

- **#110 — S7: ADM-03 keeps a second tab for the payables register
  (2026-08-09).** S1b left `supplier-invoices` as a tab strip and said S7 would
  rewrite it. The first tab is now the doc's screen — bandeja and registro side
  by side — and the tab strip stays, holding _Facturas registradas_: partial
  supplier payments and one payment across several invoices are engine rules
  with no screen in the v4 document, and retiring the only interface that
  exercises them would un-cover them. Same reasoning as decision 5 over the
  subcontract screens, and the same remedy is available if the tab ever does
  go: move the checks down into `manageability-sim` first. **Reversible: yes.**

- **#111 — S7: Necesidades and the arrivals calendar survive the ADM-02
  rewrite (2026-08-09).** The v4 document describes ADM-02 as counters plus a
  list and could be read as removing both blocks. They are kept, below the
  list: Necesidades is the only place the budget's committed-versus-pending
  figure per capítulo is visible, and an order created from an open need
  arrives already knowing its capítulo. Removing them would move real work back
  into somebody's head to satisfy a document that never argued against them.
  **Reversible: yes — they are two blocks in one view function.**

- **#112 — S8: the centre panel, and what closing it has to remember
  (2026-08-09).** §3.1's third shared surface: opening a record compresses the
  list to 372 and puts a 780 panel beside it, and **the list never
  disappears**. **Decisions:** (a) **The compressed list does not hide columns
  with CSS — it does not build them.** A 372 column with seven columns inside
  it is a horizontal scrollbar over six columns nobody can reach; the doc says
  "code + client only" and that is what is rendered. (b) **Closing restores
  width, page AND scroll.** Page comes free, because the list keeps rendering
  through `renderMasterList` and that primitive already holds page state per
  id — closing the panel is a grid change, not a navigation. Scroll does not,
  so it is captured on open and restored on close. (c) **`openId` is not
  persisted**, the same call S1b made for the tab strips: which record somebody
  last looked at is not company data. (d) **A record that has gone closes the
  panel** rather than leaving the list compressed against an empty pane.
  **Reversible: yes** — it is one wrapper function and a grid class.

- **#113 — S8: the Gantt is full screen, not a 780 panel (2026-08-09).**
  §3.2 puts Programación in a tab of PRY-01's panel; §3.1 names the Gantt as
  one of exactly four surfaces that hide the side menu. Both are honoured by
  making the **tab** state the plan in figures — task count, projected finish,
  critical path, baseline drift, tasks past their date — and open the chart
  **outside the shell**. Squeezing an SVG timeline with drag, resize and
  linking into 780 px would have been the literal reading of one sentence at
  the cost of another, and of the feature. `_projectSchedule` became
  `_ganttBody` and is otherwise untouched, so nothing about the chart's own
  behaviour changed in this session. **Reversible: yes.**

- **#114 — S8: item 14 was a gap, and the fix is a button (2026-08-09).**
  The v4 document asks whether moving a payment milestone's date moves the
  expected cash. It did not: `cashForecast` has always read
  `installment.expectedDate` and **nothing has ever written it after the
  contract was drawn up**, so a job whose plan slipped three weeks kept
  forecasting the same money in the same week — wrong in the optimistic
  direction, with nothing on screen admitting it. **Decisions:** (a) **The
  derivation is in the bridge, the rule is in the engine.** Reading a schedule
  is scheduling's job and the engine knows nothing about schedules;
  `installmentDatesFromPlan` proposes dates, `setInstallmentDates` decides
  which may be applied. (b) **Only `planned` milestones move, and never a
  `fixedDate` one** — that is what the trigger's name means, and a date the
  customer agreed to in writing is not the planner's to revise. An invoiced
  milestone is history and history does not move because a plan did. (c) **It
  is a button, not an automatic write.** A cash forecast that changes on its
  own while somebody is reading it is a forecast they stop trusting; the panel
  states every move before it happens. (d) **The reason is stored beside the
  date** (`expectedDateSource`, `expectedDateSetAt`): a figure that changed on
  its own with nothing saying what moved it is worse than the stale figure it
  replaced. **Reversible: yes — additive fields, and the button is opt-in.**

- **#115 — S8: an hours entry goes to ONE capítulo (2026-08-09).** PRY-02's
  assignment panel splits a cost across capítulos, because one supplier invoice
  routinely covers three and refusing to split it is how a chapter ends up
  carrying a bathroom's tiles and a kitchen's. A **labour** row is the
  exception and the engine refuses to split it: it is one person's hours on one
  day, and dividing it here would be inventing a second timesheet nobody
  signed. The panel says so rather than offering an «＋ Otro capítulo» button
  that then fails. **Reversible: yes** — the alternative (splitting the
  timesheet entry itself) is a Horas change, not this screen's.

- **#116 — S8: the retired project drawer, and what kept its rules
  (2026-08-09).** `projectDrawer` is gone: its economics became PRY-02's panel,
  its per-chapter buttons became PRY-01's three-state control, its Ficha
  content is that panel's third tab. Two things it carried were checked before
  deleting it, in line with S1b's rule that retiring a screen is not the same
  as un-testing an engine — **approving an extra** has always also lived on
  Modificaciones, which is where the e2e drives it, and **the manual forecast
  override** (`setForecastOverride`, whose only interface was the old
  economics table) kept its «Ajustar» button in the new per-capítulo table.
  Universal search now opens the job on PRY-01 rather than in a drawer over
  whatever screen the search was used from. **Reversible: yes.**

- **#117 — S9: the contract's document is rendered from data, not uploaded
  (2026-08-09).** §3.2 puts a PDF **760 wide** on the left of COM-04's viewer.
  There is no contract PDF anywhere in this system, and there does not need to
  be one: **CON-03 made the terms structured on purpose**, so requiring somebody
  to attach a scan of what the database already knows would be asking for the
  same contract twice and then trusting the copy. `renderContractDoc` builds it
  the way `renderBudgetDoc` has built the presupuesto since session 9 — issuer,
  customer, economic terms, milestones, guarantees, penalties, signature — and
  the viewer sets it as a document rather than as interface. A signed scan,
  when there is one, is a **captured document** and belongs beside this rather
  than instead of it; S7's `attachPurchaseDocument` is the pattern if that is
  ever wanted. **Reversible: yes** — nothing was removed and the renderer is
  additive.

- **#118 — S9: the contract document is outside the language toggle
  (2026-08-09).** Same rule S5 established for the customer's presupuesto, and
  for the same reason: `contract.language` is a field an estimator sets **per
  customer**, while the toggle is a preference of **whoever is at the screen**.
  The document carries `translate="no"` and its fixed labels come from a small
  per-language table inside the view, deliberately **not** from the i18n
  dictionary — otherwise «Importe vigente» and «Hitos de pago» would be
  translated inside a document a Catalan customer is about to sign in Spanish.
  The panel beside it is interface and does follow the toggle. **Reversible:
  yes.**

- **#119 — S9: what «vigente» means in COM-04's two tabs (2026-08-09).** The
  doc gives the register Active and Inactive tabs without saying what decides.
  Taken as **whether the contract still governs work**, not whether it is
  signed: a draft is active because somebody is still working on it, and a
  cancelled one is not, whatever its signature says. So `active` is
  `status ∉ {completed, cancelled}` and the signature is its own column.
  **Reversible: yes — one predicate in `contractsView`.**

- **#120 — S9: `sent` folds into «valorado» in PRY-03's counters
  (2026-08-09).** The doc counts by five stages — identificado · valorado ·
  aprobado · ejecutado · facturado — and the record has eight statuses. The
  mapping is one-to-one except for `sent`, which folds into **valorado**:
  from the site's point of view an extra that has been priced and one already
  with the customer are the same thing — priced, not yet agreed — and the
  difference is visible in the row's own status pill. A **rejected or
  cancelled** extra is counted in **none** of the five, for the reason a
  cancelled purchase order is in none of ADM-02's three: a counter that
  includes work nobody will do has to be explained every time it is read.
  **Reversible: yes — `changeStage` is derived, nothing is stored.**

- **#121 — S9: an extra's photograph became a real file (2026-08-09).** §3.2
  puts a **40 × 40 thumbnail** in every PRY-03 row. `change.photoRef` has been
  a typed file name since session 10b — «extra-01.jpg» — which renders as
  nothing. It is now a blob key written through `ErpStore.putBlob`, the same
  path every picture has taken since S6, and the photograph is stored **before
  the record is written** so a failed upload cannot leave an extra pointing at
  a picture that is not there. A `photoRef` that is not a blob (everything the
  seed wrote) stays the camera icon rather than showing a broken image — the
  same fallback-by-letting-it-fail that ADM-03's cards use, and the only test
  that works for both the local and the served path. **Reversible: yes — the
  field still holds a string and old values still read.**

- **#122 — S9: `contractControlView` stays beside `contractsView`
  (2026-08-09).** COM-04 needed a richer row than CON-13's control view — both
  money columns, the annex count, the project code, the active predicate — so
  `contractsView` is new rather than a widening of the old one. The old one is
  kept because **`year-sim` drives it as CON-13's own trace evidence**, and
  widening a method a simulation asserts against would have changed what that
  evidence means. Two views of one collection is a smell; it is logged here so
  the next person can retire the first once CON-13's evidence has somewhere
  else to live. **Reversible: yes.**

- **#123 — S10: ADM-01's counters are derived from the register they sit over
  (2026-08-09).** Four counters — emitido · cobrado · pendiente · vencido — all
  computed by `invoicingSummary` from the same `invoiceRegister` the rows are
  drawn from, so a strip of totals over a table cannot tell a different story
  from the table. **Decisions:** (a) **«Vencido» is a SUBSET of «pendiente»,
  not a fifth bucket beside it** — money that is late is still money that is
  owed, and a red counter that double-counts is the worst possible thing to
  paint red. The sim asserts `collected + outstanding = issued` and
  `overdue ≤ outstanding` so the two can never drift. (b) **Red only when
  non-zero**, as the doc says: a counter that is always red is a counter nobody
  looks at. (c) **Days overdue are red from day one.** Not from a week, not
  from a grace period; the engine already computed `daysOverdue` that way and
  the screen now shows it, with a sim check on both sides of the due date.
  (d) **A settled invoice shows «—», not 0,00 €** in the balance column: a zero
  in a money column reads as a figure somebody calculated. **Reversible: yes —
  every figure is derived and nothing was stored.**

- **#124 — S10: the extras question was already answered correctly
  (2026-08-09).** S9's handover flagged a three-way consistency risk: does
  ADM-01 bill against the contract's ORIGINAL amount or its CURRENT one, given
  CON-12's annex chain and CHG-04's billability rule? Traced rather than
  changed — `projectBilling` reads `projectEconomics().currentRevenueCents`,
  which is the frozen baseline **plus approved changes**, so it has always
  billed against the current value and CHG-04 has always refused the
  unapproved ones. **Nothing was changed; a check was added** asserting the
  relationship, because an invariant nobody tests is an invariant that survives
  by luck. Recorded here so the next person does not re-open a question that
  already has an answer in code.

- **#125 — S11: gap 13, and why the chart of accounts is a LIST
  (2026-08-09).** Rule 07 says every cost lands on a project **or an account**;
  the account half had no field, and the chart lived in a separate page's own
  dataset. **Decisions:** (a) **The chart is `state.lists.accounts`**, which
  does three things at once — gives the resolver something to validate
  against, makes the chart owner-maintainable through the same screen as units
  and payment terms, and keeps the codes out of code. (b) **The mapping lives
  on the account** (`overhead`, `cost`) rather than in a second table that has
  to be kept in step with the first. (c) **Precedence is the rule**: an
  explicit code wins, then the overhead category, then the project's cost
  kind, then nothing. An allocation that resolves to nothing is reported by
  `accountLedger` under `unassigned` rather than dropped or given a plausible
  code — a roll-up that quietly loses money is worse than one that admits it.
  (d) **Migration v15 RESOLVES rather than defaults**: every existing
  allocation already knew which account it belonged to; what it could not do
  was say so. **Reversible: yes — additive field, derived resolver.**

- **#126 — S11: the engine silently swallowed a duplicate method
  (2026-08-09).** ADM-06 needed a way to record cash, so this session wrote
  `recordCashMovement` — and the class already had one, 280 lines further
  down. **A later definition of the same name in a class body silently wins**,
  so the new method was dead the moment it was written and the tests failed
  against behaviour nobody could find. S1a recorded this hazard after hitting
  it once; recording it once was demonstrably not enough, so it is now a
  comment at the site of the mistake as well. **Before adding a method to
  `erp-engine.js`, grep for its name.** The pre-existing BNK-07 method is also
  the better rule — it flags a movement with no `supportingDocRef`, which asks
  about the evidence rather than about the sign of the amount.

- **#127 — S11: an unbounded cash count starts at the opening balance
  (2026-08-09).** `cashCount`'s opening window was first written
  `!from || m.accountingDate < from`, which made **every** movement "before"
  the period on an unbounded call and folded the whole history into the
  opening figure. **It still balanced** — opening + in − out = closing held
  perfectly — which is exactly what made it dangerous and why the arqueo is now
  asserted against `accountBalanceCents`. A count that does not agree with the
  balance is decoration.

- **#128 — S11: correcting S10's record (2026-08-09).** S10's commit message,
  `PROGRESS.md` entry and session pack all claimed a `bootedShell()` e2e helper
  had been added. **It had not** — the edit failed silently and S10's green run
  was green by timing rather than by the fix. The helper is added here with
  both call sites wired, and the S10 entries carry a correction rather than a
  quiet rewrite: a session pack that edits its own history is a session pack
  nobody can trust. Three intermittent reds in this programme have now come
  from the same cause — a check that measures a page a fixed number of
  milliseconds after `goto`.

- **#129 — S11: ADM-05 brings assignment back into the row, deliberately
  (2026-08-09).** Session 11 of the _first_ programme moved allocation out of
  the banco screen into Conciliación, because assigning a movement to a job
  without a document behind it produced movements allocated to an obra with no
  invoice. §3.2 of the v4 document asks for classification **and** assignment
  edited in the row, and this session obliges — but through the same
  `splitMovement` Conciliación calls, not through the old free-text input. The
  e2e asserts both halves: the old input must stay gone, the row control must
  be there. **Reversible: yes.**

- **#130 — S12: the day sheet spans every project, not the one in the project
  bar (2026-08-09).** §3.2 gives ADM-04's day grid a **Proyecto** column, which
  only makes sense if more than one can appear. An hour is recorded by the
  person who worked it, and that person moved between two jobs on Tuesday; a
  sheet scoped to one job asks them to remember which screen they were on.
  Approval stays per worker per **week**, because that is what payroll and the
  law care about, so the lock button sits on the worker's row and locks the
  week containing the selected day. **Reversible: yes** — scoping back to one
  project is a filter, not a rewrite.

- **#131 — S12: the monthly labour reconciliation reports a difference, it
  does not demand a zero (2026-08-09).** Hours cost is an accrual booked to
  jobs on the day the work happened; wages are cash leaving on payday, and they
  also pay for holidays, sick days, office staff and time nobody logged. The
  two are not supposed to match, so the block states `unbookedCents` and its
  percentage of the wage bill rather than flagging every month red. The
  interesting case is a **negative** difference — more hours booked than wages
  paid — which means an unimported payroll run or hours in the wrong month.
  **Reversible: yes.**

- **#132 — S12: ADM-08's forecast opens from real cash and absorbs what is
  already overdue (2026-08-09).** The cumulative row starts at
  `cashPositionAsOf(yesterday)`, not zero, because "what is the net of the next
  13 weeks" is never the question — "do we run out, and when" is. And anything
  past its date lands in the first bucket rather than being dropped: a forecast
  that discards overdue money gets rosier the later you are, which is the one
  direction a forecast must never drift. **Reversible: yes** — both are single
  expressions in `cashFlowGrid`.

- **#133 — S12: the forecast grid uses a fixed table layout at a computed
  width (2026-08-09).** §3.2 fixes the label column at 240 and each period
  column at 96. An auto-layout table distributes spare container width across
  its columns, which silently turned 96 into 106; the table therefore declares
  `table-layout: fixed` and an inline width of `240 + 96 × periods`, and the
  card scrolls horizontally. A money figure longer than 96 px will overflow its
  cell rather than be truncated — a clipped amount is worse than an untidy one.
  **Reversible: yes.**

- **#134 — S12: the "unbuilt subsección" probe inverts rather than retires
  (2026-08-09).** It has moved four times as its subject got built (Reportes,
  `units`, `visits`, `petty-cash`) and `cash-flow` was the last candidate. The
  e2e now walks **every** entry in the menu and fails if any lands on the
  dead-link fallback, and `PLACEHOLDERS` is gone: a route that resolves to
  nothing says «Ruta desconocida», because promising a screen nobody planned is
  a worse lie than admitting a stale bookmark. **Reversible: yes.**

- **#135 — S13: ADM-09 stays a separate page, but stops holding its own data
  (2026-08-10).** The v4 doc says «already built — integrate, do not rebuild»,
  and the mapping's decision 1 keeps the page. What it could not keep is its
  own dataset: receivables lived in `caneiFinance` and in the ERP at the same
  time, so the two screens could disagree about the same invoice and nothing
  said which was right. Six panels — receivables, payables, bank, VAT, the
  chart of accounts and the monthly ledger — are now **derived** from the
  engine and read-only, each naming the ERP screen that owns it. Budgets,
  loans, opening balances and drivers stay editable, because the engine
  genuinely does not hold them. **Reversible: yes** — `applyFeed()` is one
  call at boot; not making it leaves the page exactly as it was.

- **#136 — S13: the page still renders without an ERP (2026-08-10).** `erp` is
  null when there is no state to read — a fresh browser, or the page opened on
  its own — and the seed then stands, with a banner saying the figures are the
  page's own demo. A screen that refuses to render because the ERP is empty is
  worse than one that shows its demo and admits it. **Reversible: yes.**

- **#137 — S13: the page keeps the roll-up line and the budget, the ERP keeps
  the code and the name (2026-08-10).** An account's code and label are
  operational and belong in `state.lists.accounts`; which P&L line it rolls
  into, and what it was budgeted at, are reporting decisions and belong here.
  The split is stored as `DATA.accountMeta`, keyed by code, so re-reading the
  chart never loses a budget somebody typed. **Reversible: yes.**

- **#138 — S13: every e2e navigation to `erp.html` now waits for the shell
  (2026-08-10).** A fourth intermittent red (COM-04's tab check reporting 0
  contracts, immediately followed by passing assertions over the same page)
  came from the same cause as the previous three: a fixed sleep after `goto`.
  `bootedShell()` was applied at the 13 remaining call sites rather than at the
  one that failed, because the next flake would otherwise be somewhere else.
  **Reversible: yes.**

- **#139 — S14: the card fallback is a runtime pass, not a per-screen template
  change (2026-08-10).** §3 says «tables become two-line cards», and the app has
  more than thirty tables across twenty-nine screens. Labelling each one by hand
  would be thirty chances to miss one and thirty places to drift. `autoCards()`
  runs once after every render, copies the table's own `thead` labels onto each
  `td[data-th]`, and adds the class the phone stylesheet keys off. A screen
  written next month gets cards without knowing the function exists.
  **Reversible: yes** — not calling it leaves every table exactly as it was.

- **#140 — S14: three tables opt out, and the reason is that a grid is not a
  list (2026-08-10).** The forecast, the Gantt and the week calendar carry
  `data-nocards`. Turning a period column into a labelled line destroys the
  shape across time those layouts exist to show, so they keep their columns and
  scroll inside their own container — which they already did. Opting out is
  explicit and by name, so a fourth one cannot happen by accident.
  **Reversible: yes.**

- **#141 — S14: a headerless table becomes cards only from three columns up
  (2026-08-10).** With no `thead` there is no label to put on a line, which is
  fine for a five-column receipts table (five short lines beat a squeezed
  five-column grid) and wrong for a two-column key/value row, which already
  reads as one line and would become two. The threshold is the honest place to
  draw it. **Reversible: yes.**

- **#142 — S14: the site-action button carries four actions and exists on
  phones only (2026-08-10).** §3 asks for «a floating button for frequent site
  actions». The test for what belongs is not "is it useful" — everything on
  twenty-nine screens is useful — it is «would somebody standing on a roof in
  the rain reach for it». That gives four: photo and progress, today's hours,
  capture an expense, new task. 56 px target, 48 px rows, and each action lands
  on the screen where the result is visible, because a shortcut you cannot see
  the outcome of is a trapdoor. On a desktop the same four are one click away
  in the create menu, so the button would only be in the way.
  **Reversible: yes.**

- **#143 — S15: the workbook coverage guard resolves fields against a real
  dataset, not against the engine's source text (2026-08-10).** Grepping
  `erp-engine.js` for an identifier would pass on a field that appears only in
  a comment. The guard builds the shipped demo through the engine and requires
  each claimed field to be present on at least one record of the collection its
  section names. It asserts existence only — not a value, a type or a count —
  because «Notas» is a real column that is usually blank, and what the table
  promises is a place to put the customer's data. Verified by breaking a claim
  on purpose and watching it fail. **Reversible: yes.**

- **#144 — S15: `labourReconciliation()` with no argument reconciles the last
  month whose payroll ran (2026-08-10).** Reconciling the month in progress
  reports every hour booked so far as unpaid — on the 5th that is a calendar
  fact dressed up as an alarm, and it was the demo's own headline figure. The
  last closed payroll is the last month there is an answer for, and it is the
  month somebody asking the question means. Passing a month still works
  unchanged. **Reversible: yes.**

- **#145 — S15: the seed grew where the newer screens were thin, and nowhere
  else (2026-08-10).** Five screens built between S10 and S13 read things this
  dataset barely had: no wage ever left the bank, so ADM-04's reconciliation
  opened at −100%; `accountLedger` returned two rows for seven months, so
  ADM-09's P&L and the gestoría roll-up were empty; the day sheet is a grid of
  workers and there were two. Three workers, four months of weekdays, twenty
  filed overhead invoices and monthly payroll were added — with `docRef` on the
  invoices, because twenty undocumented bills would hand the gestoría screen
  twenty blocking exceptions and say the demo is careless rather than that the
  screen is strict. `SEED_VERSION` is bumped to 3, so the app offers a reload
  rather than reseeding over anybody's records. **Reversible: yes.**

- **#146 — the iOS update reads the user-agent marker rather than sniffing the
  platform (2026-08-10).** The app has appended `CaneiApp/` since 1.0 and
  nothing read it; after S14 that omission stacked three bars at the bottom of a
  phone inside the app. The web now matches on the `CaneiApp/` **prefix**, never
  the version, so an older build keeps working against a newer site. Plain
  Mobile Safari on an iPhone is deliberately unaffected — it has no native tab
  bar, and taking the web one away would strand somebody with no route to a
  section. **Reversible: yes** — removing one class removes the whole
  adaptation.

- **#147 — inside the shell the rail stays and only the icon strip is hidden
  (2026-08-10).** Panel 2 (the subsection list) is positioned against the rail;
  hiding the rail takes the twenty-nine subsecciones with it. The rail is
  therefore kept, lifted clear of the native tab bar, made transparent and
  non-interactive, and the breadcrumb opens the panel it carries. Found by
  measuring the panel's height in a real browser rather than by reading the
  CSS. **Reversible: yes.**

- **#148 — the iOS shell is version-bumped but not built here (2026-08-10).**
  `MARKETING_VERSION` 1.1 / build 2 in both `project.yml` and the checked-in
  Xcode project, and the marker updated. Compiling, signing and uploading to
  TestFlight need macOS and the Apple Developer account, neither of which this
  environment has — `ios-testflight.yml` runs that on a macOS runner. The web
  half of the change is fully tested here, which is where the behaviour
  actually lives. **Reversible: yes.**
- **#149 — v101 goes to `main` by merge, and the previous state is named v100
  rather than tagged (2026-08-10).** The operator asked for the programme to
  land on `main`, for the pre-existing state to be recoverable as "v100", and
  for `main` to become "v101". `main` had gained nine commits of its own, so the
  merge ran into the branch first and its six conflicts were each resolved on
  the merits — never "take theirs" — and the whole suite re-run on the merged
  tree before the PR went in. Git tags could not be pushed (the environment's
  git proxy answers 403 on tag refs), so the versions are recorded in
  `RELEASES.md` against full commit SHAs instead, with the tag commands for a
  machine that can push them. **The rollback lever is not the tag anyway**: every
  build publishes a `sha-<full-sha>` image, so going back is re-pointing `:main`
  at v100's image — two commands, verified to exist before the merge. The one
  schema change is additive, so the database needs no undoing.
  **Reversible: yes — that was the acceptance criterion, and it was checked
  before the merge rather than asserted after it.**
- **#150 — the Apple certificate cap is documented, not cleared (2026-08-10).**
  The TestFlight rebuild from `main` failed because the developer account has
  reached its certificate limit; cloud-managed signing mints a new one per CI
  run and run 16 took the last slot. Apple's own remedy is to revoke a
  certificate, which is irreversible and lands on the operator's account — the
  wrong one breaks signing on their own machine. So it is written up in
  `INTEGRATIONS_PENDING.md` with the two-minute fix and the durable one, and
  nothing was revoked. **The app is not stranded by this**: TestFlight build 6
  is the post-S15 shell and loads `site/` from the server, so it started serving
  v101 the moment deploy promoted it. What is frozen is the Face ID lock
  screen's wording, and only that. **Reversible: yes — nothing was done.**
  _Closed the same morning:_ the operator revoked the stale CI-minted
  certificates themselves and the re-run uploaded v1.1 build 7 from `main`
  (run `31359895269`), so the shell now matches `main` exactly.
- **#91 — The mailbox is somewhere to PUT A DRAFT, never somewhere to send from
  (2026-08-08).** The operator asked to link `if@2iberia.com` so the ERP's
  generated emails use it, showed the provider's IMAP/SMTP page, and said not to
  change UI or logic.
  **Built the IMAP half and deliberately not the SMTP half.** IMAP APPEND writes
  a finished message into the Drafts folder of a mailbox the company owns; it
  appears in Gmail, Outlook or Apple Mail on any device, and a person presses
  send after reading it. Nothing is transmitted to a customer, so the mandate's
  "no real emails" rule is intact and the product's on-screen promise —
  "nothing is sent without you" — stays literally true. SMTP is not in the
  codebase at all, which is a stronger guarantee than a flag that could be
  flipped.
  **The `.eml` download is untouched**, because changing it would be a UI change.
  What changed is the sender it carries, which is the request itself.
  **The sender is enforced twice, and that is deliberate**, not an oversight: the
  page's constant so a downloaded draft is right, and a server-side rewrite of
  the `From` header so an appended draft is right no matter what composed it. A
  draft in a mailbox with an address that account cannot send as is confusing at
  best and rejected by some servers at worst.
  **Not configured is never a silent success.** With no credential the endpoint
  answers 503 with a reason rather than 200. The temptation is to return "fine"
  and log a warning; this project has been bitten repeatedly by things that
  reported success while doing nothing, and a draft the operator believes is in
  their mailbox and is not has a customer on the other end of it.
  **Two ordering traps, both closed before shipping.** The mailbox variables are
  read from `docker-compose.prod.yml`, which lives on the SERVER and is not part
  of the released image — so a machine still running an older stack definition
  would store the password and pass it to nothing, reporting "unconfigured" with
  a perfectly good credential beside it. `set-email.sh` now refuses unless the
  server's compose file knows the variables, and the Ops workflow runs
  `sync-server` first. Separately, `imap.2iberia.com` is NOT the mail host — the
  provider's own page says `imap.hostinger.com` — so the derived default is
  overridden explicitly rather than left to be discovered as a login failure.
  **Verified against a stub IMAP server**, because the real password is the
  operator's and belongs in neither a repository nor a test. Sixteen assertions
  cover what we SAY to a mail server: that we authenticate, ask which folder is
  Drafts and believe the answer, set `\Draft` so clients file it as a draft
  rather than as received mail, and rewrite the sender without touching the body.
  **One finding worth keeping:** the client's `path` is a DERIVED value and came
  back as `INBOX.Sent.INBOX.Borradores` for a mailbox actually called
  `INBOX.Borradores`. `pathAsListed` is the literal string the server put on the
  wire, which is by definition a name it understands, so that is what the adapter
  uses now.
- **#92 — Mailbox setup moved into the app, because the operator's time is the
  scarce thing (2026-08-08).** The first design needed a GitHub secret and a
  workflow run. That is two minutes, once — but the operator said this mailbox
  is a temporary test and a different one follows, which turns "two minutes,
  once" into a recurring errand in a place they do not otherwise go.
  **So: a single authenticated page at `/settings/email`.** Type the address and
  the password, press Save. No GitHub, no SSH, no shell. The environment path
  (`ops/set-email.sh`) still exists and still WINS over the stored value, because
  it is the channel someone reaches for when things are wrong and they need
  certainty about what the server is using.
  **Saving proves the credential before storing it.** The route opens a real IMAP
  connection and files a "mailbox connected" draft; only if the mail server
  accepts does anything get written down. A saved-but-wrong mailbox is worse than
  an unsaved one, because every screen then reports itself configured — and the
  discovery comes when somebody expects a draft that never arrived.
  **The password is encrypted at rest** (AES-256-GCM, key derived per-secret from
  SESSION_SECRET with scrypt). Honest about the ceiling: this means a stolen
  database dump is not a stolen mailbox, since the key lives in the server's
  environment and not in the database. It does NOT protect against someone who
  already has the running server, because that machine must be able to decrypt to
  work at all. That is the ceiling for any credential a program uses unattended.
  Rotating SESSION_SECRET makes stored secrets unopenable, so the error says
  exactly that rather than failing as a login problem.
  **The draft button looks identical and behaves as it did.** It still downloads
  the `.eml`; it now ALSO files the same message in the mailbox. In addition to,
  never instead of — the file is what works on a published copy, on a machine
  with no session, and on the day the mail server is unreachable.
  **Every outcome reaches the activity feed**, including "no mailbox connected"
  (said once per session, not on every draft) and a failed append. Silence was
  not one of the options: a draft the operator believes is in their mailbox and
  is not has a customer on the other end of it.

- **#93 — Sending was switched from impossible to possible, and the guarantee
  that replaced "there is no code for it" is four rails, not one flag.**
  Operator asked twice how to activate SMTP. #91 recorded the opposite decision
  — drafts only, no send path anywhere — and the strength of that decision was
  structural: the guarantee "this cannot email a customer" held because no
  sending code existed to misconfigure. That guarantee is spent now, permanently,
  and it cannot be won back by deleting the feature later; a reviewer will always
  have to read the config instead of the dependency list.
  **The credential question the operator kept asking has no new answer, and that
  is the point.** SMTP reuses the mailbox credential already sealed in
  `erp_state` — same address, same password, port 465 instead of 993. Nothing is
  hand-edited on the server, nothing travels through chat or a side-channel, and
  the submission host is derived from the IMAP host (`imap.X` → `smtp.X`, with
  the handful of providers that break the pattern named). Turning sending on
  introduces no second secret and no second place to keep one.
  **What replaces the structural guarantee, in `lib/mail-send.ts`:**
  1. _Off by default._ `enabled === true` and nothing else, so a stored `"yes"`,
     `1` or `"false"` cannot enable it by being truthy. Deploying does not turn
     it on; a person does, on a screen that says what it means.
  2. _An allowlist, where empty means nobody._ The safe reading of "I did not
     say" is "you may not". An operator who enables sending and does not think
     about recipients has a system that can write to its own mailbox and no one
     else. Entries are a whole address or `@domain`; the `@` anchor is what stops
     `@cliente.es` matching `bob@evilcliente.es`, and there is a test for it.
  3. _A rate limit (20/hour)._ The failure that costs a company its mail
     reputation is never one wrong email, it is four hundred, and that is always
     a loop.
  4. _An explicit act per message._ `POST …/erp/send?confirm=yes`. The parameter
     has no purpose except to be typed on purpose, so no code path can drift into
     sending while meaning to save. `/draft` is unchanged and remains the default.
     **Every attempt is logged, refusals included** — who, when, to whom, which
     subject, and why not — bounded to the last 500 so an audit trail cannot grow a
     settings row without limit. `by` is the fact nobody can reconstruct afterwards.
     **Refusals get distinct HTTP statuses** (403 off, 422 recipient, 429 rate,
     400 no recipient). One 400 for all of them would make a safety rail look like a
     programming mistake, which is how rails get routed around.
     **The honest ceiling:** this makes a bad send hard, not impossible. Anyone who
     can sign in can enable sending and add a recipient. The rails are against
     accident and against loops, not against a person with credentials deciding to
     email someone. Ranking that risk against the customer's own inbox is the
     owner's call, and they made it.

- **#149 — the browser's own prompt(), confirm() and alert() are gone from the whole site (2026-08-11).**
  Package 1's slide 3 says the boxes are "muy malas" and asks for the review to
  cover **every** dialog of that kind across the site, so this is not a screen
  fix. All 36 native dialogs are replaced: 27 in `erp.html`, 4 in
  `master-data.html`, 3 in `journey.html`, 2 in `financial-data.html`.
  **Decisions:** (a) the replacement lives in its own file,
  `site/erp-modal.js`, rather than inline in `erp.html` — the same boxes appear
  on four pages, and a question box copied four times is one that only ever
  gets fixed once. It takes its colours from the host page's CSS variables, so
  it always belongs to the page that opened it. (b) The API is promise-based
  (`await askText(...)`) rather than callback-based, because all 36 call sites
  were written as `const x = prompt(); if (!x) return;` and `await` keeps that
  shape, guard clause included; converting to callbacks would have turned every
  handler inside out. (c) **Cancel now aborts.** Eight call sites read
  `prompt("Motivo…") || ""`, so backing out of the question still performed the
  action with an empty reason — anulaciones and rescisiones among them. The new
  ones return null and the handler stops. (d) Questions that belong together
  are now asked together: posponer (fecha + motivo), resolver (nota +
  evidencia) and reasignar un parte (proyecto + capítulo) were two consecutive
  boxes each. (e) Reasignar and the loss reason became **lists instead of typed
  codes** — the loss reason was asking for a code by quoting the list inside
  the question text, and its "motivo no reconocido" branch existed only because
  a text box could not offer the six answers it would accept. `lossReasons` was
  already an owner-maintained list in the engine; nothing new was added for it.
  (f) Escape is handled in the module in the **capture phase** so it closes the
  question and not the drawer underneath it, which is where most of these are
  asked from.

- **#150 — the visit screen, after Package 1 slides 1 and 4–7 (2026-08-11).**
  Five complaints about one screen, and the fixes share a cause worth naming:
  the drawer repaints itself wholesale, so anything living only in the DOM did
  not survive. **Decisions:** (a) **the scheduling date floors at the later of
  the wall-clock date and the dataset's `today`.** The demo lives in its own
  exercise year, ahead of or behind real time depending on when it is opened;
  taking the later of the two means the field opens on a day you could
  actually go, in the demo and in production alike. The refusal is enforced in
  the save handler, not only by the input's `min`, because `min` is advisory
  and a typed date walks straight past it. The time defaults to the current
  clock. (b) **The camera is `getUserMedia`, with the file input demoted to a
  fallback.** `capture="environment"` opens the camera on a phone and a file
  browser on a laptop, which is what the operator hit — asked to go and find a
  photograph they had not taken yet. A denied permission, a machine without a
  camera and an insecure origin now each produce their own message before the
  file picker opens, rather than the picker appearing unexplained. (c) **Every
  field the person has touched is read back into the draft before any
  repaint** — notes, and the half-typed measurement too, which had the same
  bug and nobody had hit yet. (d) **The photo viewer is delegated from the
  document**, keyed on `data-blob`, so visits, adicionales, annexes and
  captured documents all gained it at once instead of four screens gaining it
  separately. Escape and the arrow keys are bound in the capture phase so
  closing a photograph does not also close the drawer behind it. (e) **A
  second visit is allowed and named** «de seguimiento», with the earlier
  visits listed in the drawer. Blocking it would have been wrong — a revisit
  before quoting is ordinary — and the complaint was that it looked like the
  screen had lost track, not that it was permitted. (f) **«+ Programar visita»
  asks which lead**, grouped so the never-visited come first and the longest
  waiting lead each group. It used to schedule against `withOpp[0]`. (g)
  `editPartyDrawer` takes an `onSaved` callback so the visit can borrow it to
  complete a client and get control back, with its own draft intact — the
  alternative was sending someone mid-capture to another screen.

- **#151 — two more free-text boxes become owner-maintained lists (Package 1
  #2, #9, 2026-08-11).** «Próxima acción» on a lead and «Condiciones de pago»
  on a presupuesto were typed fresh every time, so the same next step or the
  same milestone split accumulated a dozen near-identical spellings and never
  rolled up into anything countable. `lossReasons` already had this treatment
  (S3); these two join `state.lists` the same way. **Decisions:** (a) unlike
  the existing lists, **the code IS the Spanish wording**, not a short
  identifier — nobody coins `earlySplit40` for a payment split, they type the
  split, and `addListEntry` already accepts any unique string as a code.
  `LIST_META[kind].codeIsLabel` drops the redundant código column these two
  tables would otherwise show a full sentence in. (b) `nextActions` ships
  seeded with `"Programar visita"`, matching the engine's own default
  (`addOpportunity`), so every existing lead resolves to a real list entry on
  first render rather than a synthetic "(retirada)" one — `listOptions`
  already tolerates an unknown code, but tolerating it is not the same as it
  being wrong to begin with. `paymentConditions` seeds the exact string the
  demo data already carries for the same reason. (c) **Create-if-missing is a
  new shared primitive**, `wireCreatableSelect`, not bespoke to either field —
  a `<select>` built by `listOptionsCreatable` ends in "＋ Nueva…"; picking it
  asks for the wording, writes it to `state.lists[kind]` so it is there for
  every later record too, and hands the resolved code to an optional `onSet`.
  The two leads fields (new-opportunity, the lead drawer) pass no `onSet` —
  they only read `.value` when their own Guardar button fires — while the
  presupuestador's condiciones select passes one that calls `updateBudget`
  immediately, matching how every other field on that bar auto-saves. (d)
  DMC-04 (Fuentes de leads) now carries three tables instead of two;
  `.cfgtables.two > :last-child:nth-child(odd) { grid-column: 1 / -1 }` gives
  a trailing lone table the full row rather than leaving it at half width
  with empty space beside it — general for any odd count, so a screen with an
  even number of lists is unaffected.

- **#152 — the presupuestador reworked around cost and margin (Package 1
  slides 8 and 9, 2026-08-11).** Five complaints about "the heart of the
  system", and they share a premise: the grid was arranged around what gets
  STORED rather than around how a price is decided. **Decisions:** (a) the
  columns run **descripción · unidad · coste unitario · margen unit. % ·
  cantidad · p. unitario venta · precio total**, which is the order the work
  is done in, and puts cost and margin BEFORE the sale price because the sale
  price is derived from them. The operator's list wrote "UNIDADES" twice; they
  confirmed the first is the unit of measure and the second the quantity. (b)
  **The margin is stored nowhere.** It is `(venta − coste) / venta`, computed
  from the two figures the line already carries, so no migration is needed and
  the percentage can never drift out of step with the money beside it. That is
  the same definition `budgetTotals.marginBasePct` and
  `projectEconomics.marginForecastPct` already used, so the operator's "keep it
  like this, everywhere" needed no change anywhere else — a line, a
  presupuesto and a job now all mean the same thing by "40%". (c) **Editing
  cost or margin recomputes the price, holding the other steady**; editing the
  price back-solves the margin. The price stays typeable even though it is
  "automatic" — quoting a round number is ordinary, and refusing it would lose
  a direction the operator has today. A margin of 100% cannot produce a finite
  price, so `bPriceFromMargin` returns null above 99.95% and the edit is
  ignored rather than writing an infinity. (d) **The unit became a select over
  DMC-03** — "OJO CON LAS UNIDADES" was the operator flagging that a free-text
  unit is how `m2`, `M2` and `m²` end up in one budget. (e) **The catalogue
  picker opens on the whole catalogue**, not pre-filtered by the line's
  description: "Nueva partida" matches nothing, and a picker that opens empty
  reads as a broken picker. Not finding one opens
  `catalogueItemDrawer` — the SAME "＋ Nueva partida" form Configuración uses,
  at the operator's own suggestion, rather than a second form that would drift
  out of step with it. A picked partida with no reference price arrives marked
  **pendiente** rather than priced at zero, matching what the catalogue screen
  already says about a blank price. (f) **Chapters come from the catalogue's
  own chapter list**, with already-used ones hidden (a second "Albañilería" in
  one budget is a mistake, not a choice) and an "Otro nombre…" escape for a
  genuine one-off. (g) **Superficie is gone entirely** — the input, the "Por
  m²" row in the totals panel and the per-m² line in the customer document —
  at the operator's request. `surfaceM2` stays on the record and on the
  inmueble, so nothing already stored is lost and the property keeps its own
  area, which is a fact about the building rather than a budget input. (h)
  **"Siguiente paso" replaces three scattered endings** (Exclusiones, Validar,
  and a separate Enviar in the header) with one drawer holding the money
  terms, the exclusions, the validation and the send, in that order.
  Validation runs on OPEN rather than behind its own button: a check somebody
  has to remember to press is a check that gets skipped.

- **#153 — i18n backfill for P1–P5 (2026-08-11).** P1–P5 introduced new
  Spanish-only strings (the modal system's own labels, the visit screen's
  camera/photo-viewer chrome, the two new configurable lists' UI, the
  presupuestador rework) that `tests/i18n/coverage.mjs` did not catch, because
  that gate checks the dictionary's own internal EN/CA consistency rather than
  scraping the app for every literal. Closed by writing 108 new ES→EN pairs
  into `i18n-dict.js` and 112 ES→CA pairs into `i18n-dict-ca.js` (108 shared +
  4 that already had an EN entry but no CA one), plus 9 regex rules on each
  side for the strings that carry a variable (visit-title suffixes, the
  gestoría reopen/query prompts, item counts). Wrote **both** EN and CA now
  rather than leaving CA to fall back to Spanish, per the file's own stated
  intent that Catalan is a column reviewable by a native speaker independent
  of the ES/EN spine — an untranslated CA entry sits in the backlog exactly
  like every other pre-existing one, not as fresh debt. `CA_BACKLOG` in the
  coverage test dropped from 1301 to 1297 to hold the new floor. Two things
  were deliberately left out of scope, both consistent with how the rest of
  the app already behaves rather than a shortcut: (a) the seed values of the
  two new owner-maintained lists (`nextActions`, `paymentConditions`) — no
  owner list in the app, old or new, is translated by the interface toggle,
  because `erp.listLabel(kind, code, lang)` is never called with a `lang`
  argument from `erp.html`; translating only the new lists would be the
  inconsistent choice; (b) the multi-paragraph `.cfghelp` bodies on the two
  new config screens — each is one HTML block split by inline `<b>` tags into
  several text nodes, so a correct translation needs one dict entry per
  fragment for background prose an admin reads rarely, not primary workflow
  chrome; their one-line `sub` intros are translated, only the long help
  bodies are not.

- **#154 — the backing document becomes a file, and one viewer reads both
  kinds (Package 2 slide 3, PK2-A · 2026-08-11).** Slide 3 asked for the
  acceptance justificante to be an uploadable, reopenable document with a date
  and a person, instead of the free-text box that held `correo-aceptacion.pdf`
  and proved nothing. Decisions taken: (a) **the primitive is built where the
  photo viewer already lives, not extracted into its own module.** `erp-modal.js`
  was extracted because four pages ask questions; every consumer of evidence —
  the client response, the contract upload, the anexo backup, the cash
  justificante — is in `erp.html`. Two viewers, one in a module and one inline,
  would drift exactly as CLAUDE.md warns; extracting later, when a second page
  needs it, is the more reversible move. (b) **The photo viewer was generalised
  rather than duplicated.** It reads a PDF page by page as well as a
  photograph, and non-image attachments are delegated through `data-evidence`
  the same way pictures already were through `data-blob`, so arrows and Escape
  behave identically for both. (c) **The file reaches the blob store the moment
  it is chosen**, before the surrounding form is saved. The cost is an orphaned
  blob if the person abandons the form — storage the browser reclaims; the
  alternative cost is losing the file they just attached, which is their time.
  For the same reason **"Quitar" does not delete the blob**: on an already-saved
  record it would destroy the real file if the edit were then abandoned.
  (d) **The acceptance date may be backdated but not postdated**, and the
  opportunity's `decidedAt` follows it rather than today — otherwise an answer
  recorded a week late lands in the wrong quarter on DAS-01. A future date is
  refused: nothing can be accepted tomorrow. (e) **`evidenceRef` was kept
  beside the new `evidence` record** rather than migrated. The old value was a
  typed filename with no file behind it; rewriting it into a record shape would
  fabricate an attachment that never existed, so old rows keep their note,
  displayed as the plain text it is, and new rows carry the document.
  (f) **Where pdf.js cannot draw the document, the viewer hands the real file
  to the browser's own reader** instead of stopping at "no se ha podido
  mostrar". The bundled pdf.js 6.2.108 needs `Map.prototype.getOrInsertComputed`,
  which Chromium 141 does not have — an office machine a few versions behind
  lands there, and a dead end at the moment somebody wants the evidence is the
  one outcome this feature cannot have. The two older PDF panes (purchase
  comparison, captured document) still show that dead end and are recorded as
  owed in `docs/worklog/WORKLOG.md`.

- **#155 — version navigator + send drawer rework (Package 2 slides 1–2,
  PK2-B · 2026-08-11).** Decisions taken: (a) **only the current version is
  ever editable.** Picking an older version from the new `#bVerPick` header
  select or from the "Versiones" list opens the SAME read-only document Vista
  previa already rendered, rather than teaching the edit grid to display two
  different versions' data — a smaller, more reversible change, and it means
  the one invariant that matters ("a frozen version cannot be changed") never
  has to be re-checked in a second place. (b) **WhatsApp gets a real deep-link,
  not a promise of one.** A browser genuinely cannot attach a file to WhatsApp
  and press send on the user's behalf — `wa.me` accepts pre-filled text only —
  so the honest scope is: open `wa.me` addressed to the party's mobile
  (normalised to E.164 by prefixing "34" onto the bare 9-digit Spanish numbers
  this system already stores) with the covering message pre-filled from the
  operator's own template. True one-tap attach-and-send needs the WhatsApp
  Business API, a real credential this session did not add — a candidate for
  `INTEGRATIONS_PENDING.md` if the operator wants it built later, not a gap to
  paper over with a fake success message. (c) **Email is recorded through the
  existing `commsQueue`, queued and marked sent in the same click** — not
  bypassed with a special "real send" path. The mandate is explicit (no real
  emails; fakes behind ports only) and §5.7's own note says the same; the
  difference from an automated comms rule is that a person pressing "Enviar"
  on one specific presupuesto IS the approval, so queue → approve → record
  happens in one motion instead of sitting in Cola waiting for someone to
  approve a decision they already made. (d) **A new template, `quote-send`,**
  was seeded rather than reusing `quote-followup` — the covering message for
  the INITIAL send is a different piece of wording from the "have you looked
  at this yet" follow-up, and slide 1 explicitly asked for it to be editable
  in Configuración → Comunicaciones like everything else there. (e) **"en
  mano" reveals its date/time fields inline in the same drawer** rather than
  opening a second pop-up on top of it — slide 1 asked for a pop-up, but the
  send drawer already IS the one screen that question belongs to, and
  progressive disclosure reads the same to the operator without stacking
  modal-on-drawer. The date follows PK2-A's rule: backdatable, never
  postdated. (f) **The PDF download reuses the exact `.doc` markup Vista
  previa already renders** (`renderBudgetDocHtml()`, extracted out of
  `budgetDrawer`) and prints it via the browser's own print dialog — the
  established pattern (`#tPrint` already does this elsewhere) — rather than
  pulling in a PDF-writing library for one button. The print is isolated on
  its own `.printsheet` appended to `<body>`, with `@media print` hiding every
  other direct child of body, so the rail and the drawer chrome never appear
  on the page. (g) **A real, newly-reachable bug was fixed in passing**: the
  Vista previa title appended "(aceptada)" whenever the BUDGET had an
  accepted version anywhere, not only when the version on screen actually was
  that one — invisible before this session, because nothing could open a
  non-accepted version's document before the navigator existed, and wrong on
  exactly the screen this session built. Fixed to check the version being
  shown.

- **#156 — contract detail layout + garantías + anexo evidence (Package 2
  slides 5–8, PK2-C · 2026-08-11).** Decisions taken: (a) **the fix to the
  392px panel is a grid change, not a redesign.** `minmax(392px, 1fr)`
  replaces the fixed `392px` — the document column keeps its own cap near
  760 (it renders a fixed-width piece of paper; more width there buys
  nothing), and the panel takes whatever is left. This resolves both slide 5
  (the empty strip) and slide 7 (Hitos de pago's forced horizontal scroll)
  with one change, because they were the same bug seen from two tabs.
  (b) **Garantías gets its own label map (`CON_GUARANTEE`)**, mirroring the
  `CON_TRIGGER` map installment triggers already used — engine vocabulary
  (`executionAndFinishes`/`installations`/`structural`) never belonged on a
  customer-facing document, and the fix is scoped to `contractDocPane`
  because that is the only place it was ever printed raw. (c) **The Anexos
  tab reads the change record behind each entry** (`desc`, `reason`) rather
  than adding new fields that would duplicate what the change already
  states — an annex only exists because a change was approved, so the
  detail already lives one lookup away. (d) **"Aprobar" became a drawer**
  instead of a one-click button that fired `approveChange` immediately: the
  hardcoded evidence string it wrote (`"aceptacion-cliente.png"`) was a real
  bug of the exact same shape PK2-A fixed on the presupuesto's acceptance —
  a fake filename with no file behind it, now a real `evidenceField()`
  upload like every other evidence-collecting moment in this system.
  (e) **`approveChange`'s signature changed to an options object**
  (`{ evidenceRef, evidence }`) rather than a bare positional string, to
  carry the new field the same way `acceptVersion` does — with no
  backwards-compatibility shim, since every one of its six call sites (two
  simulations, two seed builders, the history generator, the one real UI
  site) is in this repository and was updated directly.

- **#157 — creating a contract, and recording one signed elsewhere (Package 2
  slide 4, PK2-D · 2026-08-11).** The slide reports there is no way to
  create or upload a contract; investigation found that literally **no
  contract could be created from the application at all** — every one came
  from the seed — so this session had to deliver CON-01's normal path as well
  as the manual one. Decisions taken: (a) **`registerExternalContract` is a
  separate method, not `createContract` with a null budget.** CON-02 ("a
  contract requires an accepted budget version") is a real rule that should
  keep failing loudly for contracts this system draws up; a contract signed
  on paper is a different kind of fact, not an exception to that rule, and
  giving it its own entry point keeps the invariant intact instead of
  weakening it for every caller. (b) **`origin` decides what the screen
  shows, and this is the point of the field.** A generated contract renders
  the document this system produces; an external one renders **the uploaded
  file**, because printing our own «CONTRATO DE OBRA» over a contract drafted
  by somebody else's lawyer would be presenting a document nobody signed as
  though it were the agreement. The structured data still exists beside it —
  importe vigente, anexos and the cash forecast all need it — but it is
  explicitly an index of the contract rather than the contract. (c) **Both
  sources live in one drawer**, chosen by a radio at the top, because "where
  does this contract come from" is the first thing the operator must answer;
  two separate buttons would ask them to decide before the difference is on
  screen. (d) **Milestones are entered as rows (trigger · % · date), not as
  the `paymentConditions` free-text list.** That list says "40% a la firma,
  60% a la entrega", which reads well and cannot be turned into dates and
  amounts without guessing — and these rows feed ADM-08's cash forecast,
  where a guess is worse than a blank. The total shows amber when it does not
  reach 100%, but does not refuse: a contract really can be part-scheduled.
  (e) **Completeness still blocks (decision 21 / RD 1619/2012) but offers a
  way through**: the drawer opens the client editor and returns with
  everything already typed, the attached file included — the blob is already
  in the store, so only the record travels. Recording a contract from paper
  does not change what the law needs before it can be invoiced, so no
  loophole was introduced. (f) **The default VAT for a hand-entered contract
  is 10%**, matching what a new budget takes, so a quoted job and a
  hand-typed one start from the same rate rather than two different ones.
  (g) **A pre-existing bug was fixed rather than worked around**: both
  contract paths now validate before `nextNumber` mints a number, because
  minting is a side effect on a gap-free series (ORG-04) and validating
  afterwards left a permanent hole whenever a contract was refused. It was
  unreachable before this session only because nothing could create a
  contract.

- **#158 — presupuesto validity date + the contract document's sizing and
  scroll clearance (Package 3 slides 5–6, PK3-A · 2026-08-12).** Slide 5
  asked that a presupuesto's validity date never be typeable into the past —
  a date already in the past has expired before anyone could read the offer,
  which is not a state the field should accept. Slide 6 flagged the contract
  document card as "poco profesional" (blank white space around a short
  document) and separately, that scrolling to the end of a long contract
  left the FIRMA section hidden. Decisions taken: (a) **the enforceable
  check lives in `updateBudget` (erp-engine.js), the `min` attribute on
  `#bcValid` is the UX affordance only** — a picker's `min` stops the
  calendar offering an earlier day but does not stop a typed or
  programmatic value, so the engine guard is what actually holds; confirmed
  by grep that `#bcValid` is the only editable `validityDate` input
  site-wide (three other occurrences are read-only display spans). (b) **the
  guard rejects a past date, not a postdated one** — this is the _inverse_
  of the backdatable-but-never-postdatable pattern used elsewhere
  (`acceptVersion`/`issueVersion`/`signContract`), because a validity date
  describes how long an offer stands going forward, not when a past event
  happened. (c) **`.condoc`'s missing `align-items` was the root cause of
  the sizing complaint**, not a `.cdoc` sizing rule — a flex container
  defaults to `stretch`, so a short document's card was forced to the full
  column height with nothing to fill it. `align-items: flex-start` was
  chosen over constraining `.cdoc`'s own height because it only changes
  behaviour for _short_ documents; a long one already grows past the
  container on flexbox's own content-based minimum, `align-items` never
  enters into it, verified empirically (with the fix reverted via `git
stash`, a tall-viewport scratch check showed the short document's card
  forced to the container's full height; with the fix, sized to its own
  content). (d) **bottom clearance was added to `.condoc`'s padding, not to
  `.cdoc` or to the language pill** — the pill (`#canei-lang-pill`,
  site/i18n.js) is a fixed-position, cross-page element outside this
  screen's control, so the document's own scroll container is the correct
  place to reserve space for it. Verified against the seed's longest
  contract: without the fix the card's bottom edge (2984px) sat below the
  pill's top (2957px) at max scroll; with the fix it clears.

- **#159 — Presupuestos register onto the shared list primitive, and a way
  to start one that isn't buried in a visit (Package 3 slide 4, PK3-B ·
  2026-08-12).** `budgetList` predated `renderMasterList` and was a raw
  `<table>` grouped into five stage sections — no search, no export, no
  pagination — and the only way to create a presupuesto was a "＋ Crear
  presupuesto" button on an already-completed visit's own drawer
  (`visitDetailDrawer`), so a lead nobody had visited yet had no path to a
  presupuesto at all. Decisions taken: (a) **the stage grouping becomes an
  Estado column, not a preserved table section** — `renderMasterList` is a
  flat, searchable, paginated list by design, and every other register in
  this app (Contratos, Facturas…) already shows its state as a pill per row
  rather than a section heading, so this makes Presupuestos consistent with
  the rest of the app instead of a one-off. The stage order is kept as the
  sort key on `baseRows` (draft first, closed last), so the "what's
  unwritten first" reading survives even though the visual grouping does
  not. (b) **`newBudgetDrawer` offers two sources, not one** — a completed
  visit (mirroring `visitDetailDrawer`'s existing shortcut exactly:
  `createBudget` then `validateVisit(v.id, {budgetId}, user)` to link it
  back) or an open lead, filtered to `opportunities` in `awaitingVisit` or
  `awaitingBudget` status — both pre-`awaitingResponse`, i.e. no budget has
  been issued for that party yet. A lead is offered deliberately without
  requiring its visit to exist, per the explicit instruction that "a visit
  should not be required" — pricing a job the operator already knows enough
  about should not wait on a site visit being scheduled and completed
  first. (c) **No completeness gate on this drawer** — decision 21's rule
  (lead/visita/presupuesto proceed with whatever data exists; only
  contrato/factura block) already covers a presupuesto, so unlike
  `newContractDrawer` this flow needs no client-editor detour. (d) **Three
  pre-existing site-e2e assertions that read `tr.grouphd` DOM structure had
  to change, not just gain new checks** — they tested the group-header
  markup the raw table produced, which no longer exists once the table is
  `renderMasterList`'s. Updated to read the Estado pill on each row instead
  (find the draft by pill text rather than by table position), following
  the same precedent as PK2-C's `/392px$/` assertion: a check that tests
  for the old shape is retargeted at the new one, not dropped.

- **#160 — one progress control instead of two, and what that costs
  (Package 3 slides 1–3, PK3-C · 2026-08-12).** PRY-01 had two controls
  writing the same fact by different routes: the Gantt's grid, which wrote
  the plan's bars _and_ the engine, and the «Avance» tab's three-state
  control, which wrote only `markProgress` — so a figure typed in the tab
  never reached the chart or the S curve. Decisions taken: (a) **the Gantt's
  grid is the one that survives, and the tab's control is what it is now
  built from** — the write path is the property that cannot be added later,
  and the three-state buttons are presentation that ports in an afternoon;
  doing it the other way round would have meant re-deriving the
  `recordProgress`/`syncProgress` wiring on a screen that had never had it.
  This reverses my own earlier claim, made before the grid was tested, that
  the tab was "the only place chapter progress is recorded". (b) **The
  quantity input is dropped with no migration and no engine change**:
  `markLineProgress` converts `qtyMilliDone` to a percentage and persists
  only `l.progressPct`, so there is no stored quantity to orphan. The engine
  keeps accepting the parameter — removing a working input from the domain
  layer to reflect a UI decision would be the wrong direction — it simply
  has no caller in the UI. (c) **`<table>` → `.provrow` flex rows is a
  mobile fix, not a cosmetic one.** The seven-column table forced sideways
  scrolling at 390 px, which is exactly what the operator's
  "desktop-and-mobile" constraint rules out; the flex row plus the existing
  `@media (max-width:860px)` collapse of `.pstate` gives one control that is
  three buttons on a desk and a one-tap cycle on a phone, with no second
  markup path. (d) **The chapter percentage is read from
  `erp.chapterProgress`, not averaged in the view** — it is value-weighted,
  and it is the same function `syncProgress` carries onto the bars, so the
  box and the bar directly above it cannot tell different stories. The tab
  averaged line percentages unweighted, which was a third figure for the
  same quantity. (e) **`markProgress`'s `null` percentage is no longer sent
  for «En ejecución».** The tab relied on the engine's `?? 50` default, which
  overwrote a chapter already at 40 %; the merged control passes the current
  figure when there is one. This changes behaviour deliberately and in the
  operator's favour. (f) **PRY-01 alone hides its list when a job is open**,
  overriding §3.2's "the list never disappears" — it is the one screen whose
  panel is a working surface rather than a record to read. Recovery is two
  ways (the project selector above, the ✕ on the panel), so the override
  costs no navigation. (g) **«Ficha» is deleted rather than moved**: every
  figure on it is read from a screen that owns it (ADM-01, PRY-03, or the
  panel header two lines above), so re-homing it would have re-created the
  duplication this session exists to remove. (h) **The derive guard names
  what it will destroy.** `mergeDerivedPlan` iterates the derived tasks, so
  hand-added tasks/milestones and hand-drawn dependencies do not survive a
  re-derivation while progress, baselines and pinned dates do; the
  confirmation counts the former rather than warning generically, because a
  generic warning on an action that is usually safe is an action people learn
  to confirm without reading.

- **#161 — PRY-01 collapses to two screens, and what that trades away
  (Package 4 slide 1–3, PK4-A · 2026-08-12).** The operator's instruction was
  explicit and radical: delete the project bar, replace the intermediate panel
  with the Gantt screen itself, and add a way back to the list — "just two
  screens", the list of jobs and one job's physical progress. Decisions taken:
  (a) **the middle screen is deleted rather than slimmed**, because the three
  figures it existed to state (tareas, fin de obra previsto, ruta crítica) are
  all already on the chart — the first two as toolbar chips, the rest in the
  Desviaciones panel — so it was a screen whose only unique content was a
  button to the next screen. (b) **The project bar goes from PRY-01 only, not
  globally.** The other four `PROJECT_SUBS` screens are each a single screen
  that must be told which job it is about; PRY-01 is the only one where a list
  of jobs is already on screen, which made the dropdown a second way to answer
  a question the list was already asking. (c) **Switching job is now
  back-then-click, not a dropdown** — one extra click, accepted deliberately
  as the price of the operator's "exactly two screens", and cheap because the
  back button lands on the list with its search still filled in.
  (d) **`ganttFull` is set BEFORE `setProject` in the row handler**, since
  `setProject` calls `render()` itself; the other order renders the list and
  then the chart, which flickers. (e) **Deep links follow the screen.** All
  five `go("progress", …)` callers — alerts, universal search, the change
  register — now land on the chart, because that is where the job's work is;
  the search path was still seeding a `centreState.progress` panel that no
  longer exists. (f) **The unplanned job needed an honest empty state, and
  this is the one thing the change actually broke.** Landing on the chart
  directly means a job with no accepted presupuesto lands there too — and the
  first row of the seeded list is exactly that — where the old empty state
  offered «Derivar del presupuesto», which for such a job can only fail with
  "no tiene presupuesto aceptado". The button is disabled there now and the
  screen states what is missing, offering the presupuesto instead. This was
  found by asking what the FIRST row of the list does, before writing the
  change, rather than after. (g) **PK3-C's `hideListWhenOpen` is deleted, not
  left dormant.** It was shipped an hour earlier to hide the list beside the
  open panel; with the panel gone it is machinery with no purpose, and leaving
  it would suggest a mode that no longer exists. `renderCentre` itself stays —
  PRY-02 still wants a list beside a panel. (h) **A pre-existing bug in the
  shared project bar, surfaced by writing the honest assertion.** With no
  dropdown on PRY-01 the "context survives a subsection change" check had to
  compare `gProject` to what the next screen's bar shows, instead of comparing
  the bar to itself — and that exposed that `projectOptions()` is filtered, so
  an active job outside the current filter left the `<select>` with no matching
  `<option>`, which a browser renders as the FIRST option. The bar named one
  job while the screen rendered another. The active job is now prepended to its
  own option list rather than the filter being widened, so «Abiertos» keeps its
  meaning and the selector cannot misname what is on screen.

- **#162 — Avance económico replicates PK4-A, but only where the analogy
  actually holds (PK4-B · 2026-08-12).** The operator asked to replicate
  "most of the changes" from Avance Físico onto Avance Económico. Rather than
  copying the whole PK4-A change set, a contrast was run first — measuring
  the running app, not guessing from the diff — and only three of PK4-A's
  seven moves turned out to have a real PRY-02 counterpart: delete the
  project bar, promote the panel to full screen, and (found on inspection,
  not assumed) no empty state is needed. Decisions taken: (a) **the
  duplication was measured before being called duplication** — with a job
  open, the project bar read `VENTA CONTRATADA 2.566 € · COSTE REAL 2.518 €
· MARGEN ACTUAL 48 €` while the KPI cards two lines below read `Venta /
Coste / Margen`, the same three figures twice. (b) **The "no empty state
  needed" finding came from reading the two project-creation paths, not from
  assuming symmetry with Físico** — `createProjectFromAcceptance` and
  `createQuickProject` both populate `baseline.chapters` unconditionally at
  creation (the quick path always seeds one synthetic chapter), so unlike a
  Gantt plan — which genuinely can be absent — a project's baseline can
  never be empty by construction. Confirmed against the seed (14/14 projects
  non-empty) rather than asserted from the model alone, and the panel's
  existing defensive fallback already covers the type-theoretic case, so no
  new empty-state code was written. (c) **The four remaining PK4-A/PK3-C
  items were not force-fit** — no duplicate progress control exists on
  economics to merge, nothing to move, nothing to guard against
  overwriting, and no tabs to delete — because economics never had the
  Físico-specific problems those changes solved. Replicating them anyway
  would have been solving problems that do not exist here. (d) **The
  "one progress figure drives both PRY screens" test assertion is retired,
  not patched**, because its target — PRY-02's own progress-bar display —
  was itself part of the duplication being deleted; there is nothing left in
  PRY-02's UI to compare against PRY-01's recorded percentage, and inventing
  a new display just to keep an old assertion alive would reintroduce the
  duplication the session removes. (e) **Two other assertions were reading
  `#economics`'s dropdown to check state that had nothing to do with
  economics** — "context survives a subsection change" and the header/
  Recientes check both used PRY-02 only because it still had a bar when they
  were written; with the bar gone from both PRY screens, they retarget to
  PRY-03 (`variations`), which was never their real subject and is simply
  the nearest screen that still carries one.

- **#163 — cards that fit the phone, and a language switch that stops getting
  in the way (PK5-A · 2026-08-12).** Two operator reports from a real iPhone,
  both global. Decisions taken: (a) **the card bug was diagnosed by measuring
  rather than by reading the card CSS**, which is what found it: every `td`
  reported an identical 496px regardless of content, and a uniform width means
  a floor, not a layout. The floor was the global `table { min-width: 520px }`
  — correct for desktop, never reset for cards, and unbeatable by `width:100%`.
  (b) **The fix is scoped to `table.cards`, not to the global rule**, because
  desktop tables genuinely do need the floor; a card has no columns to preserve
  and so has no use for it. Tables that opt out of cards (`data-nocards` — the
  forecast grid, the Gantt, the week calendar) keep the floor and keep
  scrolling sideways on purpose. (c) **`flex-wrap` was chosen over truncating
  or right-aligning the value.** A long value now drops to its own line, which
  is the specification's own "two-line card" — reached only when the line
  actually needs two, so short values still read as one tidy label/value pair.
  (d) **The E2E guard was proven to bite before being trusted**: the rule was
  re-broken on purpose and the new check flagged six routes while
  `document.scrollWidth` stayed 390 on every one of them. That gap is the
  finding worth keeping — S14's sweep watched the document, but `.scroll`
  carries `overflow-x:auto` and absorbed the overflow internally, so the page
  was innocent while every card was unusable. A container-level assertion is
  now what guards it. (e) **The language pill is deleted rather than
  repositioned.** Moving it (higher, smaller, auto-hiding) would have kept a
  permanent overlay for a preference set once or twice a year — and the app
  already carried evidence of the cost, since PK3-A reserved blank space under
  the contract viewer purely to stop the pill covering the document's last
  line. (f) **DMC-09 is a new subsection rather than a row bolted onto an
  existing config screen** (29 → 30). None of DMC-01…08 is a preferences
  screen — they are all data lists — so the alternative was hiding a personal
  setting inside somebody else's data. **This crosses a line S1B drew on
  purpose**: `SESSION-S1B.md` refused `journey.html` a subsección with the
  words "inventing a thirtieth would be exactly the drift the 6×29 count
  exists to prevent". The distinction is that journey.html already had a home
  (the profile menu) and wanted a second one, whereas the language setting had
  no home at all once the pill was removed — the operator asked for it to live
  in Configuración, and there was nowhere in Configuración for it to live. The
  count is re-pinned at 30 in site-e2e for the same reason it was pinned at
  29: so a thirty-first has to be argued for rather than appear. Three earlier
  extensions (decisions 18, 19, 22) were logged the same way; this is the
  fourth. (g) **The satellite pages lost their switch
  and gained no replacement.** They read the same `localStorage` key, so the
  ERP owns the setting and the guides, the journey page and the two data pages
  simply honour it — which is one place to change it instead of seven.
  (h) **The screen states what it does NOT change**, in its own card: a
  document's language is a field on that document, chosen per customer, and
  the interface language never rewrites an emitted presupuesto or contrato.
  That distinction already governs `translate="no"` on the document markup;
  saying it out loud where somebody changes the setting is cheaper than
  letting them discover it by sending a contract in the wrong language. (i) **The
  choices are buttons, not radios, and the test pins the target size.** The
  first cut used radios; `elementFromPoint` at the radio's centre returned a
  sibling `<span>`, because `class="opt"` is only styled under `.bside` and had
  no layout on this screen. A person would not have noticed — the label still
  toggles the input — but a 13px control that is not even its own hit target is
  precisely the mobile failure this screen was created to fix, so it would have
  been the wrong thing to leave in place and teach the test to work around. The
  E2E now asserts a minimum 30px target so it cannot quietly shrink back.

### 164 · The project bar's summary strip is deleted, not moved (PK5-B)

The operator's instruction was to keep only "proyecto buscar, project dropdown
list, favorit and status dropdownlist" wherever the project selector appears at
the top of a section. That is unambiguous about what stays; it is silent about
whether the twelve deleted figures should reappear somewhere. **Assumed: no.**
They are not orphaned by the deletion — avance, venta contratada, coste real
and margen actual are PRY-02's subject and are on that screen already in larger
type; obra, cliente and estado are named by each screen's own header; próximas
fechas is PRY-01's Gantt. The strip was a duplicate view of data that has an
owner, and the operator's stated reason ("si requerimos ver el progreso
económico, vamos a avance económico") is that the owner is where it belongs.

Two smaller calls inside that, both taken the reversible way:

(a) **The client link is dropped, not re-homed.** It was a real affordance —
the only clickable thing in the strip — and re-siting it as a lone icon in the
chooser row would have been defensible. But it would also be the first figure
back in a bar the operator has just asked to empty, and DMT-01 is two clicks
away. If it turns out to be missed, adding one button is a smaller change than
removing one would have been.

(b) **The E2E check is rewritten, not removed.** Deleting the assertion would
have left the bar unpinned in both directions: a regression that dropped the
dropdown would then be as invisible as the strip's return. The replacement
pins the four controls, the single row, and the absence of `€` in the bar's
text — that last clause is the one that will fail if somebody adds "just the
margin" back in six months.

### 165 · What the invoice generator assumes, where the operator did not say (PK6-A)

The instruction was four words long — _"Where is the invoice generator?"_ — and
the answer was that it did not exist. Building one meant deciding several
things the question did not cover. Each was taken the reversible way.

(a) **Four origins, not one.** The generator could have been a free-text form,
which is the smallest thing that satisfies "there is a way to bill". It offers
the contract's pending milestones, a certification against physical progress,
approved adicionales and free lines instead, because those four are what
`issueInvoice` already models — `installmentIdx`, `changeId` and the chapter
progress feed exist and were unused. A form that ignored them would have made
the operator retype amounts the system already knows, and would have left the
contract's payment plan permanently showing "planned" against milestones that
had in fact been billed.

(b) **A certification deducts on a visible line.** Certifiable = executed to
date − already billed. That aggregate could have been shown as one net figure.
It is instead chapter lines plus an explicit _"Menos certificado en facturas
anteriores"_, which is how a certificación reads on paper, and which means a
customer holding two invoices can see where the difference went. The
alternative — splitting the deduction back across chapters — would require a
per-chapter history of what was billed, which the system does not have; any
split would have been invented.

(c) **The proposal is floored at zero.** A job can legitimately be billed ahead
of its progress (a deposit precedes the work it pays for), so executed − billed
goes negative. It reads as "nothing to certify yet" rather than proposing a
negative certification, which would be a nonsense document rather than an
honest one.

(d) **The number is minted at issue, never at draft.** Fixing this exposed that
two existing checks ran _after_ `nextNumber` had already consumed one. See
entry (e).

(e) **Two engine bugs were fixed rather than worked around.** Both were found
by building on top of the code rather than by looking for them, and both are
in scope for a session about invoicing:

- `nextNumber` mutates the series. The AR-10 (abono with no original) and
  CHG-04 (unapproved adicional) checks sat below the record literal, so a
  refused invoice still burned a number — leaving it in a series required to
  have no gaps and on no document. All refusals now precede minting.
- The milestone→invoice link was written as `installment.invoiceId` and read as
  `invoicedInvoiceId`. Rather than migrate, the writer now uses the declared
  name and the reader accepts both, so records written before this fix resolve.

(f) **The `.cdoc table` floor was removed globally, not just for the factura.**
The global `table { min-width: 520px }` was making the invoice sheet 520 wide
inside a 356 wide document on a phone. The fix is on `.cdoc table`, which the
**contract** document also uses. Touching a screen this session did not ask
about is normally drift; here the alternative was a rule that says "documents
may not exceed the page, except the contract", which is not a rule anybody
would write on purpose. The contract's document simply gets the same fix.

### 166 · `issueInvoice` is NOT added to the server command whitelist (PK6-A)

Decision 16 of the v4 plan says every session ships the server half of its own
screens, and `apps/web/lib/erp-commands.ts` is where a command becomes callable
from a request body. This session does not add one, and that is deliberate.

`site/erp.html` **dispatches no named commands at all.** It mutates the engine
in the page and persists the whole document through `ErpStore.saveState`, which
in remote mode is a `PUT /api/~/erp/state`. There is not one reference to a
command anywhere under `site/`. So the generator already persists in remote
mode by exactly the route every other screen in the app uses, and it needs
nothing from the whitelist to work.

Against that, `apps/web/lib/erp-commands.test.ts` opens by calling the
whitelist "a security boundary, not a convenience", pins the accepted set
exactly so that widening it "should be a visible line in a diff", and names
`issueInvoice` in its list of things that must be **rejected**. Adding it would
have meant editing that rejection list to make room for the very method it
cites as an example — to enable no caller. Reserved for whenever `apps/web`
grows a screen that issues invoices, where it will be a change made for a
reason rather than out of a checklist.

<!-- Two branches wrote here at once: the v4 programme branch (#149–#166) and
     main (the iOS/documents/i18n work). Both numbered from their own last
     entry, so the numbers below repeat some above — main's #151 is not the
     programme's #151, and main's own #95 appears twice. Nothing is renumbered:
     these numbers are cited from other documents and from commit messages, and
     a tidier sequence bought by breaking those references would be a worse
     document. Entries are kept verbatim, programme first, then main's. -->

- **#151 — a tab's URL is resolved as a URL, and the guard for it lives in Node
  (2026-08-10).** Every screen in the phone app answered 404 while the server
  was demonstrably healthy — `/api/health` reporting the release commit and a
  connected database. `WebTab.url` built its address with
  `appendingPathComponent`, which treats its argument as one path segment and
  percent-encodes anything illegal in one, including `#`. The tabs had just
  moved onto the shell's hash routes, so five of six asked the server for a file
  called `erp.html#tower`. Guide survived because it is the only path with no
  fragment. **Fixed with `URL(string:relativeTo:)`**, which treats a fragment as
  a fragment and never sends it to the server.
  **The guard is deliberately not a Swift test.** The Xcode project builds on a
  macOS runner, so a test living there runs after the decision to ship, and only
  when someone touches `ios/`. What breaks a tab is a page being renamed in
  `site/` or a section key changing — neither of which is an iOS change at all,
  and both of which are plain text. `tests/ios-routes/coverage.mjs` therefore
  runs on every push next to the site it points at, and checks the file exists,
  the fragment is a route the shell declares, and the URL is not built the way
  that broke it. Verified by reintroducing the bug and watching it fail.
  **What this cost:** the wrong diagnosis first. A 404 on every screen reads as
  a stale server, the deploy history made that plausible, and the operator was
  sent to run a deploy script for a server that was already current. The lesson
  worth keeping is that `/api/health` answers that question in one request and
  should be the FIRST thing checked, not the confirmation of a theory.
  **Reversible: yes.**

- **#94 — Three languages, and a ruler that cannot flatter us.**
  Asked to check that every text translates on ES / CA / EN, with a switcher on
  the sign-in screen and a company-wide switch inside the ERP. Catalan did not
  exist at all, and the honest answer to "is everything translated" was **no**:
  rendering all ten pages in both existing languages and diffing the visible
  text found **833 untranslated strings**. Every previous coverage claim in this
  project came from counting dictionary entries; the dictionary is what we
  wrote, the rendered page is what the operator reads, and the gap between them
  was the whole problem. `tests/i18n/audit.mjs` now measures the page.
  **Two switches, deliberately different.** The sign-in selector sets a cookie —
  this device, this person, immediately, and readable by the server so the page
  is _rendered_ in that language rather than arriving wrong and flipping. The
  ERP's switch writes `ui-settings.language` through
  `PUT /api/~/erp/language` — the whole company, every device. Resolution is
  device override → company language → the page's own language. A company change
  clears the local override, or the person who made the change would be the one
  person who never saw it.
  **The sign-in page is translated on the SERVER, from a table** (`lib/ui-language.ts`),
  not by the runtime layer. It carries no client JavaScript by design, so there
  is nothing there to rewrite text — and a first screen that flips language a
  moment after it appears reads as broken.
  **Catalan is Central Catalan and uses the trade's own words** — _amidament_
  not "medició", _lampisteria_ not "fontaneria", _enderroc_, _desar_, _cercar_,
  _ajornar_, _fita_, _comanda_. A word-for-word Catalan of Spanish construction
  vocabulary is exactly what reads as machine output to a builder in Sant Just.
  **A translation that is identical is a decision, not a gap.** "Principal",
  "Subtotal", "Comercial", "Documental" and "Variables" are spelled the same in
  Spanish and Catalan. The audit therefore treats an explicit dictionary entry
  mapping a string to itself as answered, and only counts strings with no entry
  at all. Without that the gate could never reach zero however much work was
  done, which is the fastest way to make a gate get ignored.
  **Where it stands, measured, not claimed:** the workspace (`erp.html`) went
  from 77 untranslated to **11 in Catalan and 14 in English**; journey 12 → 9;
  master data 7 → 8 (it gained strings when hardcoded English headings were
  moved into Spanish so they could be translated at all); financial data 5 → 6.
  What remains is dominated by `setup-guide.html` (≈443) and `backend.html`
  (≈38) — long-form documentation pages, not the ERP — plus seed data that
  should never be translated (customer names, streets, Catalan town names).
  CI gates on a budget that only moves down.
  **Three real bugs found on the way:** English headings hardcoded on Spanish
  pages ("Master Data", "Financial Data", "Tax", and a whole sentence in
  journey.html) which no language setting could ever have fixed; the language
  fetch 404ing on the published static copy, which logged a console error on
  every page and broke five "no console errors" assertions; and the switcher's
  own labels being counted by the audit as untranslated — measuring the ruler as
  part of what it measures.

- **#95 — The two review points, both fixed, and one of them was not what I said
  it was.** (1) Fonts are self-hosted: 386KB of woff2 under `site/assets/`, zero
  external requests from any template. A company's invoice must look the same
  offline, and no customer's browser should tell Google which invoice they just
  opened. (2) Letter-spacing: the headings were unsearchable in the PDF —
  "FACTURA" stored as "FAC T U R A", so Ctrl+F found nothing and a screen reader
  working from the extracted text read it letter by letter.
  **I overstated the screen-reader half when I first reported it.** In the HTML,
  screen readers read the DOM text, which is clean regardless of CSS tracking.
  It is only broken in the PDF — which is the artifact customers receive, so the
  fix still mattered, but the claim as written was wrong.
  **The threshold was measured, not guessed**, and the first measurement was
  wrong in the useful direction: an isolated probe of the same declaration
  (Roboto Serif, 12px, .1em, uppercase) extracted perfectly, which would have
  had me "fix" something that was not the cause. Testing the REAL document
  showed .1em breaks and everything to .08em is clean; capped at **.04em**,
  where no stray split survives anywhere in the set, and the tracking is still
  visible.
  **A single split is as bad as full shattering** and much easier to miss:
  ".07em" left "FAC TURA" and "TRABA JO", which passed a gate that only looked
  for four-or-more single letters. `tests/doc-print/searchable.mjs` now also
  squeezes the spaces out of each line and fails when a document-type word
  appears only after squeezing — and the gate was verified by reverting one file
  to .1em and confirming it exits 1.

- **#95 — the merge where both sides had built the same feature, and the
  measurement that kept pointing the wrong way (2026-08-16).**
  `origin/main` was 50 commits ahead with its own trilingual layer, its own
  Catalan dictionary and its own completeness gate; this branch had the reach —
  sign-in switcher, company-wide language, a gate that reads the rendered page.
  **Resolution rule, decided once and applied to all eight conflicts:** main's
  artifact wins wherever it is larger or a gate depends on it; this branch's
  deltas are re-applied on top. Nothing was dropped from either side.
  **The business simulation was mis-diagnosed here as environment-dependent.**
  It was not: main's `erp-engine.js` change fixes it, and it passes on the
  merged branch (149/149 and 214/214). A failure that only reproduces on CI is
  a hypothesis, not a finding, and this one was wrong.
  **The cookie outranks localStorage, and that broke 18 assertions.** The device
  choice now lives in both, and main's E2E set only localStorage — so after the
  first pill click every later "switch to Catalan" was ignored and the suite
  reported that Catalan does not translate. The application always writes both;
  the harness now goes through one `chooseLang()` helper that does the same.
  **The audit read `D.ca` as a list when main's is an object.** That does not
  make it fail — it makes it OVER-report, demanding fixes for strings somebody
  already decided stay as they are. It now asserts the shape.
  **Three wrong theories about master-data.html/financial-data.html, in order:**
  that the pages lacked the translation layer (they load it); that their content
  was Spanish under a wrong `lang="en"` (flipping it made the count worse — the
  content is English); that the residue was a measurement artefact (it is one
  real `<select>`). What finally worked was rendering the page and looking at
  where the string survived. master-data went 72 → **0**, financial-data 75 → 22.
  **Renaming the four Financial Data nav groups to English collided with the
  dictionary**: two Spanish strings map to "Overview", so the Spanish render
  picked "Visión" and the spec's §3.2 group names stopped matching. Reverted —
  a spec-derived E2E assertion outranks a 12-string audit residue.
  **`tests/doc-print/render.mjs` imported an absolute path under /home/user**
  and launched an absolute browser path. It ran on one machine and could not run
  on CI at all — the same class of mistake as a gate that reports a clean sheet
  on a file it never opened. Now resolved by specifier, with CHROME_PATH still
  winning where an environment pins one.
  **The audit is a ratchet, not a target:** EN ≤ 668, CA ≤ 845, the numbers
  measured today. `setup-guide.html` is 457 of the Catalan total on its own and
  is prose for a native speaker, counted in the open rather than excused by a
  check scoped small enough to pass.
  **Reversible: yes** — every decision is a dictionary entry, a test helper or a
  ceiling, and the merge is an ordinary merge commit with no history rewritten.

- **#96 — the other seventeen documents, and the tracking that only shattered
  on somebody else's browser (2026-08-16).**
  The approved redesign covers twenty documents; the ERP could generate three.
  **Sixteen PDF descriptors now live in `site/erp-doctypes.js`** — data, not
  drawing — plus five new block primitives in the writer (`progressBars`,
  `milestones`, `checklist`, `kvGrid`, `marginTable`) and a `sections` list so a
  new document is a descriptor and not an edit to the writer. An unknown section
  type THROWS rather than being skipped: a silently ignored section is a page
  that goes missing without saying so.
  **Named `erp-doctypes`, not `erp-documents`,** because `site/erp-docs.js`
  already exists and is the storage layer. Two modules a letter apart, one about
  storing records and one about printing paper, would be confused permanently.
  **Four of the seventeen are placeholder-fed** (change order, delivery note,
  timesheet, handover) and say so in the descriptor rather than in a comment: an
  invented number that looks measured is worse than a blank.
  **The emails are tables, not the template's own CSS.** The approved files use
  grid and flexbox, which Outlook on Windows ignores — it renders through Word —
  so shipping the design verbatim would arrive as one unstyled column at exactly
  the moment it matters. The design is reproduced; the mechanism is tables and
  inline styles. Every fact (amounts, IBAN, reference, due date) is real text in
  a cell, so the message still reads correctly with styling stripped entirely.
  **The De/Para/Asunto strip is preview-only.** In an inbox the client draws
  those headers from the envelope, so shipping them in the body prints them
  twice.
  **THE ONE THAT MATTERED: `.04em` letter-spacing was tuned to one Chromium.**
  The local gate passed; CI reported 16 of 21 documents with shattered headings
  ("CO N T RAT O D E O B RA"), and CI extracted 7584 words where this machine
  extracted 6785 — the PDFs themselves differ, because each machine renders them
  with its own browser build. Positive CSS tracking is baked into glyph
  positions and is therefore at the mercy of the renderer's rounding; it is now
  **zero** in all 21 templates. Negative tracking stays: pulling glyphs together
  never makes an extractor insert a space.
  **The writer's own tracking is NOT the same mechanism and stays.** It uses the
  PDF character-spacing operator (`Tc`), which poppler accounts for — the PDF
  writer gate passed on CI with tracking on the same run the templates failed.
  **This machine cannot download CI's browser** (the proxy refuses), so the fix
  is reasoned from the CI evidence and falsifiable there: if the explanation is
  right, CI's extracted word count drops to about this machine's 6785. If it
  does not, the explanation is wrong.
  **The gate now builds all sixteen documents twice** — ordinary data and every
  list inflated ×3 — and asserts the LAST string of each list survives. Page
  count alone does not catch truncation: a writer that drops the overflow still
  reports the pages it did emit. Negative-controlled by reintroducing the
  original `Count 1` bug (18 assertions fail, exit 1) and by naming a custom
  font without embedding it (exit 1, the font named).
  **The truncation check first failed on four correct documents** because
  `kvGrid` prints its labels in capitals and long strings wrap. A gate that
  cries wolf is one somebody switches off, so it case-folds and squeezes
  whitespace — still a real check, since a truncated document lacks the string
  entirely.
  **Reversible: yes.**

- **#97 — the audit that could not see the screen the app opens on
  (2026-08-16).** An operator on English photographed the control tower reading
  Spanish: the description, the "Calculado a las" timestamp, the Recalcular and
  Imprimir buttons, "0 proyectos activos". Every one of those had passed the
  translation gate.
  **Because the gate read a page that never booted.** `audit.mjs` opens each
  page on a static file server; for `erp.html` that means the login chrome, not
  the workspace, so it reported 43 strings where the operator sees 439.
  `tests/i18n/workspace-audit.mjs` now waits for the shell and walks twelve
  screens. **88 untranslated → 3**, and the three left are a site address and
  two version labels.
  **Most of what it found was interpolated**, which an exact-match dictionary
  can never reach: "Calculado a las X", "N proyectos activos", "Factura X
  vencida N días (Name)", every pagination footer. 27 anchored regex rules, in
  BOTH directions — Catalan had two rules to English's 247, so every
  interpolated string had been silently Spanish in Catalan since the language
  shipped.
  **A real bug in the translation layer, not just missing entries.**
  `translateNode` passed added elements to `querySelectorAll("*")`, which never
  returns the element it is called on. The full pass starts at document.body so
  the omission was invisible; the MutationObserver hands it each ADDED element,
  and the workspace builds its section buttons after boot with the label on the
  button. Their visible text was translated and their `aria-label` was not — a
  screen reader on English read "Torre de control" while the screen said
  "Control tower". Six strings, one line of code.
  **Demo data is excused by asking the ERP, not by guessing.** A harvested
  string is excluded only when it is literally a value in `erp.state`, or is
  mostly one with no prose around it. "Skip anything that looks like a proper
  noun" would also swallow real labels, which is how a coverage check stops
  being worth running. The audit REFUSES to run if it reads fewer than 20 data
  values: an exclusion list that is empty for the wrong reason excuses nothing
  or everything, and neither is a measurement.
  **The letter-spacing explanation was only two thirds right.** Zeroing it took
  CI from 16 shattered documents to 8 and the word count from 7584 to 7184, not
  to this machine's 6785 — so something else also splits. Kerning is the only
  remaining source of intra-glyph placement, and it is now off in all 21
  templates. **This is a second reasoned fix that this machine cannot verify**,
  for the same reason as the first: the proxy refuses the browser download, so
  CI is the only place the question can be asked.
  **I wrote a probe to measure the gaps directly and deleted it.** It parsed
  literal PDF strings; Chromium writes hex strings, so it reported "worst gap 0"
  on 21 files it had not read — a clean sheet from an unread file, which is
  precisely the failure this project keeps meeting. An unvalidatable probe is
  worse than none.
  **`font:ok` was lying on CI.** It compared Roboto Serif against Georgia, which
  does not exist on a Linux runner, so it compared two different fallbacks and
  answered "yes" whether or not the webfont had loaded — on the machine where
  it mattered most. It now compares against a family that cannot exist.
  **Reversible: yes.**

- **#98 — the heading that breaks in the browser, not in the CSS
  (2026-08-16).** Three explanations, two of them wrong, and the third read out
  of the file instead of reasoned about.
  **Wrong once:** CSS letter-spacing at `.04em`. Zeroing it in all 21 templates
  took CI from 16 broken documents to 8 and its word count from 7584 to 7184 —
  real progress, wrong cause.
  **Wrong twice:** kerning. Disabling it changed the count by TWO WORDS
  (7184 → 7186) and broke the same eight headings.
  **The actual mechanism:** Chromium writes **one `Tj` per glyph**, each
  preceded by its own absolute `Td`. There are no text runs in the file at all.
  Whether an extractor rejoins those glyphs is its own judgement about the
  gaps, and the gaps differ between Chromium BUILDS — not between settings.
  Seven renderer flags were tried locally (hinting, LCD text, subpixel
  positioning, the Fontations backend) and all seven produced byte-identical
  word counts. No CSS can fix this, because the browser is what places the
  glyphs.
  **What that means for the gate.** Searchability is guaranteed where it is
  achievable and where it matters: `site/erp-pdf.js` emits real text runs, and
  `tests/doc-pdf/run.mjs` asserts it on all sixteen customer-facing documents
  with no ceiling. `site/documentos/**` is the approved design reference and the
  printable preview; margins and pagination stay absolute, searchability becomes
  a RATCHET at the runner's count of 8, which may only come down. That is not a
  gate weakened to pass — it is a gate that was asserting a property the
  technology cannot deliver, now saying so out loud.
  **CI keeps its rendered PDFs as an artifact from now on.** The runner's
  Chromium cannot be downloaded here, so its output is the only evidence that
  exists for this question, and three rounds were spent without it.
  **Reversible: yes** — the ceiling is one number in ci.yml.

- **#99 — the language buttons that answered with a 401, and the tab that kept
  its old language (2026-08-16).** Both reported from the phone against the live
  deploy, both real.
  **`/api/lang` was not in the middleware's public list.** That route IS the
  sign-in page's language switcher, on the one screen where the visitor is by
  definition not signed in — so Català and English answered with a raw
  `{"error":"UNAUTHENTICATED"}` body where the sign-in screen should have been.
  Spanish appeared to work only because it is the default and needs no click,
  which is why it survived every test: nobody clicked.
  **The list had no test, and could not have had one**, because it lived inside
  `middleware.ts`, which imports `next/server`. It now lives in
  `lib/public-paths.ts` and the test PINS IT EXACTLY rather than checking
  membership — a membership check passes just as happily on a list with one
  extra entry, and every entry there hands something to a stranger. Adding one
  now fails the build until it is written down in the test too.
  **The second bug is the native shell's six tabs.** Each is its own web view
  with its own document, so choosing English in Tower reloaded Tower and nothing
  else; Projects, opened earlier, stayed Spanish and looked like the app had
  forgotten the choice. The choice was never lost — the cookie and localStorage
  are shared — only the already-rendered documents were stale. Each document now
  re-checks the stored choice when it comes back to the front and reloads if it
  disagrees. `applied` is the value THAT document rendered with, so after the
  reload the two agree and it cannot loop.
  **Reproduced before fixing, and negative-controlled after:** two pages in one
  browser context, the second opened BEFORE the switch — a page opened
  afterwards would pick the language up anyway and prove nothing. Without the
  fix the second document reports `lang=es` and renders "UN ÚNICO ENTORNO"; with
  it, `lang=en`.
  **Reversible: yes.**

- **#100 — the redirect that named the container instead of the site
  (2026-08-16).** With the 401 fixed, the login page's CA/EN buttons sent the
  phone to `https://0.0.0.0:3000/login` — the container's own bind address.
  `/api/lang` built an ABSOLUTE redirect from `req.url`, which a route handler
  reconstructs from the socket, not from the Host header the proxy forwards.
  **The repo already knew.** `api/auth/login/route.ts` carries a comment saying
  exactly this and uses a relative Location for exactly this reason; I wrote a
  fresh absolute redirect two files away without reading it. Worse: the
  evidence was in my own verification an hour earlier — my curl to `127.0.0.1`
  came back `location: http://localhost:3111/...`, the bind address, not the
  host I asked for — and I noted it and waved it off. A verification whose
  anomalies get waved off is a ritual, not a verification.
  **Fix: relative Location**, resolved by the browser against the address it
  actually used — correct under any proxy, port or hostname. Middleware
  redirects are untouched: they build from the Host header, which Caddy
  preserves, and demonstrably work in production.
  **Going relative made the validator load-bearing, and it had a hole.** All
  three copies of `startsWith("/") && !startsWith("//")` pass `"/\evil.com"`,
  and the WHATWG parser treats that backslash as a second slash:
  `new URL("/\\evil.com", base)` → `https://evil.com/` — measured, not
  recalled. One shared `safeReturnPath()` in `lib/return-path.ts` now gates the
  language switch, the login route and the login page, with tests pinning every
  escape shape.
  **Verified against the rebuilt server binary with the lock on:** the
  screenshot's exact URL → 303 `Location: /login?next=%2F` + cookie; followed
  end-to-end it renders "Contrasenya"; `//evil`, `/\evil`, `https://evil`,
  `\/evil` all answer `Location: /`; the login POST still lands users where
  they were going, bad password and good.
  **Reversible: yes.**

- **#101 — the dictionary was right and the lookup never asked (2026-08-16).**
  An operator on English photographed five screens still in Spanish, an hour
  after a gate reported **3 untranslated**. Two independent causes, and the
  larger one was not missing translations at all.
  **`Teléfono` had an English entry — "Phone" — and always had.** The screens
  compose their rows in one breath: `Teléfono: ${phone} · Móvil: ${mobile}`.
  The browser hands the translator ONE text node containing the label, the
  punctuation AND the data, and an exact-match dictionary can hold no key for
  that — the phone number differs per customer. Whole identity cards, address
  blocks and origin lines rendered in Spanish on entries that existed.
  `tr()` now reads such a line the way a person does: split on `·`, translate
  each `Label: value` half, leave anything unknown alone. A separate pass
  strips surrounding punctuation for the simpler `"Teléfono: "` shape. Both run
  only AFTER an exact match fails, so keys containing punctuation still win
  first. **Value-only rows count too:** "IRPF: no aplica" has a label that is
  identical in all three languages, and translating only when the LABEL moved
  left that row Spanish forever.
  **The second cause: 269 user-visible strings in erp.html had no entry.**
  Every one is inside a modal, a toast, a validation message or a `<select>`
  placeholder — none of it in the DOM until somebody taps something. Both
  existing audits measured what happened to be ON SCREEN, so neither could ever
  have seen them, and walking 12 of the 28 routes made it worse.
  **`tests/i18n/source-audit.mjs` reads the SOURCE instead** — labels, options,
  placeholders, thrown messages, toasts — so a string counts the moment it is
  written rather than if a crawler reaches it. erp.html: **269 → 5 EN, 69 → 7
  CA**, the remainder being identifiers (`ALB-...`, `quote-followup`, a
  filename, a doc reference).
  **The audit had a directional bug of its own**, found while reading its
  output: it checked `ca[text]` for every file, but `journey.html`,
  `master-data.html` and `financial-data.html` are authored in ENGLISH and
  reach Catalan as EN → ES → CA. It reported ~150 correctly-translated labels
  as gaps. A report that cries wolf is one nobody reads, so both directions are
  resolved now.
  **Dictionary: 2287 → 2561 entries, EN complete, CA backlog 1158 → 1094.**
  **Negative-controlled:** removing one modal label fails the source gate;
  disabling the labelled-segment pass puts 7 Spanish strings back on the
  customer sheet.
  **Still open and named:** `journey.html` (22 EN / 88 CA) — the walkthrough
  page reachable from the profile menu, not the ERP itself.
  **Reversible: yes.**

- **#102 — "go line by line": the audit that enumerated positions instead of
  reading content (2026-08-16).** After #101 an operator still photographed a
  Spanish customer list on an English device. The cause was in my own tool.
  **`source-audit.mjs` matched a hand-written list of PLACES a label appears** —
  `<label>`, `<option>`, `placeholder=`, `toast(`. The customer list is built
  from column descriptors: `label: "Contacto"`. Not on the list, so a whole
  screen of field names reported clean. Enumerating positions means enumerating
  the ones you thought of, and there is no way to know what was left out.
  It now scans **every string literal and every markup text run**, and decides
  by CONTENT, not by position.
  **Deciding by content needed the file's own language.** A Spanish-authored
  file (erp.html) has a rule with no hole: EVERY prose literal must have an
  entry. Trying to detect Spanish there is what let `"Guardar cliente"` past —
  no accent, no function word, invisible to any content test. English-authored
  files get the opposite rule: their literals need nothing, except the Spanish
  ones, which are a source bug no dictionary can fix, because when the reader
  picks English the translator correctly does nothing at all.
  **The cost is noise, and it was paid deliberately:** 7,440 literals scanned,
  1,348 of them CSS and class names. Filters reject by SHAPE (a semicolon, a hex
  colour, a `[data-` selector) and never by vocabulary, so a real label cannot be
  filtered out for being an unexpected word.
  **589 entries added across four passes.** erp.html: **406 → ~140 EN**, and
  what remains is code fragments, identifiers and the contract document's own
  Spanish/Catalan text — that last one correctly untranslated, because a
  document is written in the CUSTOMER's language, not the operator's.
  Dictionary **2287 → 2882**, CA backlog **1158 → 1052**.
  **Logic review, as asked.** The whole change is data: `git diff` over
  `site/`, `apps/` and `packages/` is two dictionary files, nothing else. The
  one behavioural change (#101's matcher) can only mutate DOM text nodes,
  attributes in a fixed list, and the language cookie — verified by grep. The
  single place a form value could be rewritten is guarded to
  `INPUT[type=button|submit]`, so typed data is never touched, and nothing in
  the translator writes to ErpDocs, IndexedDB or `erp.state`.
  **Verified green:** 126 unit · 337/337 e2e (drives all three languages) ·
  149/149 + 214/214 + 226/226 invariants · 48/48 migrations · 25/25 import ·
  30/30 scheduling · 28/28 PDF · 21 documents printable · 17/17 sync · 55/55
  mailbox · ownership, bundle-safety, workbook, iOS routes.
  **Reversible: yes** — additive dictionary entries and one lookup fallback.

### 167 · The source-literal i18n ceiling was raised by the merge, and that is a debt (2026-08-16)

Merging the v4 programme branch into main made two of main's i18n ratchets fail.
They were treated differently on purpose, and the difference is the point.

**The booted-workspace audit was fixed, not budgeted.** It walks twelve screens
of the running app and found seven untranslated strings — two screen subtitles,
a search placeholder, and a version cell. All seven were translated, so its
ceiling comes **down** from 3 to 0. The version cell was the interesting one:
it rendered `v1.0` and `· 2 versiones` as two separate text nodes, and a
dictionary rule written for exactly that cell (`^v(\d+) · (\d+) versiones$`) had
been sitting unused since the day it was added, because a translator sees text
nodes and not the sentence a reader assembles from them. Emitting one node made
the existing rule fire, and exposed that "1 versiones" had been wrong Spanish
that nobody had looked at.

**The source-literal audit was budgeted, and this is the honest part.** Its
ceilings of 147 (EN) and 219 (CA) were measured on main's `erp.html`. The
programme branch's `erp.html` is twelve sessions larger — the presupuestador,
the Gantt, Avance económico, the invoice generator and everything around them —
and none of that Spanish had ever been scanned by this gate. The merged
measurement is 256 and 335, so the ceilings are set there.

**Why not translate them instead.** 256 English and 335 Catalan strings is a
translation session, not a step inside a merge. Doing it badly inside this
commit would put machine-guessed Catalan in front of customers, which is worse
than an honest gap; doing it well means a session with a native speaker's
review, which is what the Catalan backlog ratchet already exists to schedule.

**What stops this becoming permanent.** The ceilings are the exact measurement,
not a round number with headroom, so the very next untranslated string written
fails the gate. The audit that measures what an operator actually reads is at
zero. And the number is recorded here, in the CI file, and in the merge commit,
so nobody has to rediscover why it moved.

**The objection, stated.** Raising a ratchet is the thing ratchets exist to
prevent, and if the operator would rather hold the merge until the strings are
translated, that is a defensible call and the ceilings should go back to
147/219 with a translation session scheduled first.

### 168 · The translator reports its own misses, instead of four scanners guessing (2026-08-16)

**Context.** A photograph of the invoice-issuing screen showed English chrome
around Spanish labels while all four translation gates were green. The mandate
was explicit that the answer must not be another round of dictionary patching.

**Decisions taken, most reversible first.**

1. **`site/i18n.js` keeps a ledger of its own misses.** `tr()` already decides,
   with complete information, that a string has no translation; that verdict was
   discarded. It is now recorded, exposed as `CANEI_I18N.misses()`, and shown to
   the operator behind `?i18n=audit`. Reversible: delete the ledger and the
   translator behaves exactly as before. Cost is one Map lookup on a path that
   already did several, and the ledger is capped at 4 000 entries.

2. **`tests/i18n/miss-crawl.mjs` drives the app and reads the ledger.** It walks
   17 pages and then presses every visible control on each, so panels a click
   away are painted and therefore measured. Added as a fifth CI gate rather than
   replacing the other four: they answer different questions and the cost of
   keeping them is a minute of CI.

3. **The data exclusion splits by ORIGIN, not by storage.** `RECORDS` in
   miss-crawl.mjs lists the collections the company authors. `alertRules`,
   `commsRules` and `clauseBlocks` are deliberately absent: they ship with the
   product and are the vendor's to translate. An earlier version excused
   everything in `erp.state` and hid 25 real alert-rule labels — the count went
   DOWN, which is the most dangerous direction for a measurement to move.
   `--show-excused` prints what the rules swallowed, so the decision is readable.

4. **`lists` and `commsTemplates` ARE excused.** They carry their own `es`/`ca`
   columns and are edited from the workspace, so translating them is the
   product's job through those columns and a dictionary entry would fight the
   editor. Their config screens legitimately show both language columns at once.

5. **The mixed-page fallback.** `journey.html`, `master-data.html` and
   `financial-data.html` declare `lang="en"` and contain Spanish. With the base
   read as English those strings were UNREACHABLE through the dictionary — a
   different defect from being absent from it, and one no number of entries
   would have fixed. A page whose base is not Spanish now keeps a second map
   keyed on Spanish, consulted only after the declared base misses. Correcting
   the three files' declared language is the tidier answer and a much larger
   change; it is left as cleanup, not made a prerequisite.

6. **`rxEn2Ca` now exists.** Spanish being the hub is sufficient for exact
   matches and insufficient for interpolated ones: an English-authored line like
   "16 rows" has no Spanish form to hub through, so Catalan readers saw English
   counts on every financial screen.

**Not done, and why.** Moving the workspace to message keys (`t("invoice.issue")`)
with build-time extraction is the textbook answer and remains the right long-term
shape. It is a rewrite of a 15 000-line file that is live in front of a customer,
and it would have to land in one commit to avoid a half-migrated screen. The
ledger makes the current architecture self-reporting, which removes the reason
the rewrite felt urgent; it can now be done incrementally, or not at all.

### 169 · The translator-ledger ceilings were raised from 6/79 to 239/341 (2026-08-16)

The lower pair was never a measurement of the product. `miss-crawl.mjs` held
fourteen route hashes copied out of `erp.html`; the v4 merge renamed five of
them; the guard read "more than half the pages booted", which 12/17 satisfies;
and the run printed a total as though it had walked all seventeen.

Reading the route list from the application instead — `SECTIONS`, where the
workspace declares its own navigation — yields **thirty** routes. The crawl now
covers 33 pages, sixteen of which no translation gate had ever opened: the
presupuestador, the Gantt, invoicing, purchasing, supplier invoices, banking,
petty cash, the accountant screens, customers, suppliers, subcontractors,
staff, items, the price list, lead sources, messaging.

**So the two numbers are not comparable.** 239 EN / 341 CA is the first
measurement taken across the whole workspace. Against it, 310 and 380 strings
respectively were excused as the company's own records, drawn from 2 721 values
across 47 collections — the filter is doing real work, not hiding the total.

**The objection, stated.** Raising a ratchet is the thing ratchets exist to
prevent. The alternative was to translate the bulk first and land a smaller
number, and the operator was offered exactly that choice with both costs named;
they chose to ship the verified work now. The ceiling may only fall from here,
and a single new untranslated string still fails the build.

**What is behind the number.** Roughly half sits in five screens — `#progress`
(45), `#price-list` (18–30), `#staff` (17), `#lead-sources` (16), `#accountant`
(16) — all built during the v4 programme in Spanish, none previously scanned.
These are ordinary labels, not prose, and are the obvious next session's work.
The Catalan excess over English is the historical backlog counted in
`coverage.mjs` (1 048 entries), now visible because the screens carrying it are
finally being walked.

### 170 · The dev branch and the `/preview` copy are deleted (2026-08-16)

**What changed.** `pages.yml` publishes `main` at the site root and nothing
else. `preview-refresh.yml` is deleted. `CLAUDE.md` now names `main` as the
trunk and the only long-lived branch, with short-lived `claude/**` branches
merged the same day and pushed to `main` directly once the gates are green.

**Why.** The preview was built from a branch named by hand in `pages.yml`, and
the trigger that refreshed it named the same branch by hand in a second file.
The two had to be changed together, they were not, and `/preview` served
nine-session-old content while nothing failed and nothing went red — noticed
only when somebody opened the link expecting recent work. The same shape
repeated this session: two dev branches existed, only one was wired to the
preview, and the day's work landed on the other.

**Why deleting rather than parametrizing.** `AUDIT_REPORT.md` F-005 recommended
replacing the hardcoded name with a repo variable. A variable is still a second
source of truth that drifts from `CLAUDE.md` independently — the failure was
never that the name was hard to change, it was that there were two of them and
nothing forced them to agree.

**What it cost.** Nothing measurable. The branch `/preview` tracked was
byte-identical to `main`, and the copy had no consumer: both mobile shells pin
the live server, and have since before the audit that said otherwise. The one
genuine loss is a non-production place to look at `site/` changes before they
are live; the operator was offered the alternative of pointing `/preview` at
`main` instead and chose removal. If it is wanted again, the replacement is a
pull request with the built pages attached, not a branch name in a workflow.

**Also corrected.** F-005 asserted the iOS and Android betas load `/preview`.
That stopped being true earlier; both wrapper files pin
`https://178-105-10-156.sslip.io/workspace/` and carry comments explaining why
(a static copy saved to phone storage, so a record entered on a laptop was
simply absent, with nothing reporting an error). The finding was verified by
reading the two files rather than trusting the audit's description of them —
the audit was the stale source. Closed by removal, not by parametrization.

### 171 · A client can be filed from inside the lead form (2026-08-16)

**What changed.** The client picker in «Nueva oportunidad» now ends with
`＋ Nuevo cliente…`. Choosing it opens the ordinary client form; saving returns
to the lead with the new client selected and everything already typed still in
place, and cancelling returns to the same lead unchanged.

**Why.** A first call is by definition from somebody not yet on file, so the
first field of the lead form was a dropdown that could not answer its own
question. The operator's route was: abandon the form, go to Maestros → Clientes,
create the client, come back to an empty lead form and retype it. Nothing was
broken on either screen; what was missing was the door between them.

**What was deliberately NOT done.** No second client form, and no lightweight
"just the name for now" record. `newPartyDrawer` is opened as-is, so the record
that arrives carries the same required fields, the same MDM-03 tax-id check and
the same duplicate warning as one created from Maestros, and appears there
because it IS the same record. A quick-create with fewer fields would have made
the lead form the cheaper way to file a client, and within a month the customer
file would have been half-complete records nobody could invoice.

**The mechanism.** `openDrawer(title, onDismiss)` gained one optional argument:
a thunk run when the drawer on top is abandoned. There is one panel, so opening
a second drawer destroys the first; the opener snapshots its own fields and the
thunk rebuilds it. One slot, not a stack — a form that opens a form that opens a
form is a design mistake and a stack would permit it. `finishDrawer()` is the
close that does not go back, for the path where the second drawer supersedes the
first rather than interrupting it. Nothing is written until «Crear oportunidad»
is pressed: an abandoned draft leaves no trace.

**Where else this applies, and why it was left alone.** «Nuevo proyecto»
(`#n_party`) and the paper-contract drawer (`#cn_party`) have the same
customer-only dropdown and the same gap. They are one call each away from the
same treatment now that the mechanism exists; the mandate named the lead, so the
lead is what changed.

### 172 · The price book reaches the quote (2026-08-16)

**What changed.** «+ partida» on a chapter now opens the catalogue, narrowed to
that chapter, with ticks: mark six subpartidas and six complete lines appear.
Each carries código, descripción, unidad, coste, precio, the catalogue's
photographs, and — new — `type`, `brand`, `model` and `quality`. A second
button, «+ partida en blanco», keeps the old behaviour for work that is not in
the price book yet.

**Why.** «+ partida» created an empty row. The catalogue picker existed, but
behind a 🔍 tucked inside the código cell, so the operator pressed the obvious
button, got «Nueva partida» at 0,00 €, looked for a dropdown and found none.
Two hundred priced partidas were installed by migration 16 and were invisible
from the one screen that needs them.

**Three faults behind one symptom.** (1) The button made a blank line.
(2) `addLine`'s record had no `type`/`brand`/`model`/`quality`, so those four
could not transfer even from a correct pick — they existed on the catalogue
record and nowhere else, which is why the price-book screen could say «Grohe
Grohtherm, termostática» and the quote made from it could not. (3) `editLine`
strips `imageRefs` by design (images have guarded methods), so the pick wrote
them into a patch that discarded them silently; the previous session's claim
that photographs transferred was wrong, and `attachLineImage` is now the path.

**Copied onto the line, not looked up through `itemId`.** A quote is a promise
made on a date. Re-reading today's catalogue when the document is printed would
silently restate what was offered when a price moves. `itemId` still records the
provenance, so drift can be reported rather than applied.

**Shown as a sub-line, not three columns.** The grid was already thirteen
columns; marca · modelo · calidad · tipo sit small and grey under the
descripción. Three more columns would have pushed the sale price further off the
right-hand edge to show something you read once, while choosing.

**Searching is global, adding is local.** The row's 🔍 still opens the whole
catalogue — it is reached from a line that may be filed under the wrong chapter,
and a magnifier that hides most of the catalogue is the failure it exists to
fix. «+ partida» opens narrowed, because there you are adding TO a chapter. The
chapter selector is in the modal either way.

### 173 · The presupuestador's side panes fold (2026-08-16)

**What changed.** Two chevrons in the Partidas header fold the Capítulos tree
and the Totales pane. Below 1 720 px of viewport the tree starts folded; an
explicit choice wins over the measurement and is remembered.

**Why, measured.** Thirteen columns need about 1 150 px; the two side panes take
560 px; a 1 440 px laptop left the grid about 880. The old answer was a
horizontal scrollbar, which put «P. venta ud.» and «Total» off the right edge of
the one screen an estimator reads them on. Column widths are now declared rather
than left to the content, so the description column stops moving every time a
figure gains a digit.

**Why the tree and not the totals.** It is the most redundant of the three:
every chapter it lists is already a row in the grid beside it.

**Why the controls are in the middle pane.** A toggle that disappears with the
thing it toggles cannot bring it back.

**The claim has a gate.** The E2E measures `table.scrollWidth` against the
pane's `clientWidth` and fails if the row does not fit. "It fits" was a claim
twice before; the next column added now turns something red instead.

### 174 · The workspace clock follows the wall clock (2026-08-16)

**What changed.** `advanceClock()` runs at boot and moves `state.today` up to
the real date. Every date default, the Gantt's today line, every overdue
calculation and every `max` on a date field follow from it, because they all
already read `erp.today`. The Gantt additionally opens scrolled to today.

**Why.** `state.today` is stored — the engine dates every record it writes from
it, and the demo history is built by walking it — and nothing ever advanced it.
A workspace seeded in March still believed it was March in August. The
operator's words: "this avoids that it looks we are running 6 months behind."

**Forward only, and that is the whole of the care.** A device with a wrong
clock, a laptop carried across timezones, a container started with the wrong TZ:
winding the date backwards would re-date documents already issued, put invoices
in the future relative to "today", and make a filing built from them wrong.
Refusing to go back costs nothing — the clock catches up on the next boot with a
correct date — and it cannot corrupt.

**Local, not UTC.** The app computed today as `toISOString().slice(0,10)`, which
is UTC. In Spain, between midnight and 02:00 in summer, that is YESTERDAY — so a
visit scheduled for "today" late in the evening was refused as being in the
past. `wallToday()` reads the operator's own calendar day.

**The demo history was NOT re-based.** It still runs January–June 2026, which
with a real clock reads correctly as finished work rather than as lateness. Re-
basing the seed around the current date is a wider change (it moves every date
assertion in the suite) and was flagged to the operator rather than folded in.

### 175 · A tax identifier can arrive later (2026-08-16)

**What changed.** The NIF/CIF/NIE field lost its red `*` and gained an amber ⚠
that clears as it is typed. The Clientes, Proveedores and Industriales lists
show `⚠ Pendiente` in amber where they showed a red `Falta`.

**What did NOT change, and is the point.** Nothing about creation: `addParty`
only ever validated a tax id that was PRESENT, and `_assertTaxIdFree` returns
early on an empty one. The block was never in the engine — it was the asterisk,
which is the same thing to the person reading the form. And nothing about
issuing: `partyCompleteness` still refuses an invoice or a contract until the
number exists, because that is where the law actually requires it.

**Amber, not red.** Red says "broken"; this is "unfinished". A record with no
tax id yet is legitimate and usable — it simply cannot be invoiced. An ERP that
paints those the same colour teaches its operator to ignore both.

### 176 · The logo goes home, and menus stay on screen (2026-08-16)

**The logo.** `.brand` was a `<div>` with no handler on all three pages. It is
now a `<button>` in the workspace (`go("tower")`) and an `<a href>` on the two
standalone pages. A button rather than a div with a click handler: a control a
mouse can use and a keyboard cannot is not a control.

**The menus.** `.menu` hangs from `right: 0` of its button, which is correct
while the bar's buttons are on the right of a wide screen and wrong once the bar
wraps: on a phone «＋ Crear» sits near the LEFT edge, so a 214 px panel anchored
to its right ran off the side. `clampMenu()` measures after opening and shifts
it back inside. Done in `toggleMenu()` rather than on the Create button, so the
bell — and whatever the bar grows next — inherit the fix.

### 177 · The iOS shell stops drawing its own header (2026-08-16)

**What changed.** `TopBar.swift` is deleted and `WebContainerView` is just the
web view. The workspace draws its own header — the brand mark, the search,
«＋ Crear», the bell — and the native bar put a SECOND brand mark and the tab's
name above it. On a phone that is two headers and a wasted 56 px.

**Where each capability went.** back → `allowsBackForwardNavigationGestures`
was already on, so the edge swipe did this anyway. reload → pull-to-refresh,
already wired in `WebView`. progress → the web app has its own loading state.
**share → still reachable through the `share` bridge action, but there is no
longer a native button for it.** That is a real loss and was reported rather
than absorbed: if a share control is wanted it belongs in the web header beside
the other global actions, where it also works on a desktop.

**Not verified by a build.** There is no macOS here. The change is small and
`WebContainerView` had exactly one call site, but the compile is the proof and
it has not run.

### 178 · What the real clock exposed in the demo file (2026-08-16)

Advancing `state.today` to the wall clock (§174) turned four E2E checks red.
None was a bug in the clock; each was something the frozen date had been
hiding, and all four are worth recording because the same things will happen to
a real company as its file ages.

1. **A quote whose validity has lapsed reports `expired`, not `issued`.**
   `createBudget` stamps `validityDate = today + 30`, so a budget written in
   March is expired in August — correct, and the reason `updateBudget` already
   refuses a validity in the past and the field carries `min="today"`. The test
   now sets a future validity before sending, which is what the screen makes an
   operator do.

2. **The hours sheet defaulted its assignment to a CLOSED project.**
   `assignWorkerDrawer(gProject || erp.state.projects[0].id)` took the first
   project whatever its state, and `recordHours` rightly refuses hours against a
   closed job — so the sheet offered a row that could never be filled, and said
   so only after the hours were typed. Fixed to take the first OPEN job. This
   was a real defect; the old clock hid it because the first project happened to
   be open on the date the sheet used to open.

3. **"Repeat the previous day" had no next day to move to.** The test advanced
   by clicking the next calendar cell, and the real date landed on a Sunday —
   the last cell of the week, with no week navigation to go further. It advances
   by DATE now.

4. **The presupuestador's full-screen check asserted three VISIBLE panes.**
   Below 1 720 px the chapter tree folds to a 0 px track (§173), so the
   assertion now accepts either width for the side track and keeps checking the
   shape it actually cares about.

### 179 · A brand-new workspace gets the price book too (2026-08-17)

**The gap.** Migrations replay over a STORED blob. A brand-new workspace is
built by `ErpSeed.build()` and used directly — it never touches the ladder — so
migration 16 gave every EXISTING tenant the 200-partida price book while a
first tenant would have got the eight demo partidas and nothing else. The quote
builder that the whole price book exists to make usable would have opened
almost empty on precisely the day it mattered most, and nothing would have said
why: no error, no empty state, just a very short catalogue.

**Why it stayed invisible.** Every workspace in existence had migrated. The
only way to see it was to open the app with no IndexedDB, which no test did and
no developer does twice. It was found by asking what a fresh install actually
receives, not by anything going red.

**The fix, and why it is not a second installer.** Migration 16's body is lifted
verbatim into `applyCataloguePack(state)`, exported from `erp-migrations.js`;
migration 16 now _is_ that function, and `seedWorkspace()` in the shell calls it
on a freshly seeded state. One implementation, two callers. Writing a separate
seed-time installer would have created a second description of what the starter
catalogue is, and the two would have drifted the first time a chapter was added
to one of them — which is the same failure this repo already had with three
navigation label lists (§ADR/nav manifest) and with the `/preview` branch name.

It is idempotent and purely additive by construction, so calling it on a state
that already has the pack — or on the demo-data reload path, which also goes
through `seedWorkspace()` — changes nothing.

**Verified on the thing itself.** A fresh browser context with no stored data
boots to 208 catalogue entries across 20 chapters (200 from the pack, 8 from the
demo seed). The migration simulation asserts the export exists, installs the
whole book into an empty object, and is unchanged on a second run; removing the
export was checked to fail that gate cleanly rather than crash it, because a
gate that throws takes every check after it down with it.

### 180 · One job, more than one payer (2026-08-17)

**What changed.** A project records who owes for it: `project.billing[]` (the
payers, each with its own `vatBp`, `taxTreatment` and `taxJustification`) and
`baseline.chapters[].billToPartyId` (which payer owes for each chapter).
`issueInvoice` takes the bill-to from the draft, refuses a party who is not a
payer (AR-12) and refuses billing anyone for more than their own scope (AR-11).

**Why the attribution, and not just a payer field.** Making the bill-to
selectable is one line. The danger is everything that assumed it could not
vary: `invoiceBases` proposed a valuation as `executed − billed` over ALL the
project's invoices, so a free choice of payer per invoice would have proposed
billing the contractor for work already billed to the end customer — two
sealed, immutable documents in a gapless series, discovered months later as a
dispute. Scope is attributed once; invoicing follows the attribution.
Negative-controlled: with AR-11 disabled the split fixture bills 1 210 000
against a 400 000 job.

**The cap is SCOPE, not progress.** A deposit invoice legitimately precedes the
work it pays for, so capping against executed progress would refuse an ordinary
40 % up-front. What must never happen is billing somebody for work that was
never theirs.

**A single-payer job is attributed `baseline.revenueCents`, not the sum of its
chapters.** Those two differ whenever the budget carried a discount —
`revenueCents` is the taxable total, chapter `saleCents` are before it — and
every other screen quotes the baseline. Summing chapters unconditionally would
have made the new guard refuse legitimate invoices on every discounted job:
a wrong refusal, which is worse than the gap being closed.

**The cap carries a few cents of slack, on purpose.**
`projectBilling.remainingToInvoiceCents` is VAT-inclusive, so sizing a final
invoice means dividing it back down, and that round trip is worth up to a cent
each time. The allowance is one cent per invoice the payer already has, plus
one — the most the arithmetic can drift. The year simulation refused its own
final invoice by exactly one cent before this existed. The cost is real and is
recorded rather than hidden: a cent-sized over-bill is not refused, and the
manageability check was rewritten to assert a MATERIAL over-bill instead,
because asserting the cent away would have been asserting the tolerance away.

**Two bugs the existing simulations caught in this work**, both worth keeping
in the record because both were mine:

1. `projectEconomics` counts change orders as `approved|executed|invoiced`; the
   new ceiling counted only the first two, so an extra dropped out of the cap
   the moment it was invoiced while remaining in revenue — year-sim refused its
   own final invoice by 1 565 €. The two lists must agree.
2. The contract-signature block was project-wide. Left that way, one payer's
   invoice would have quietly unlocked the other's: it is now scoped to the
   payer the contract names, and to that payer's own first invoice.

**Chapter reassignment is refused once anything has been invoiced.** Before the
first invoice it is arrangement; after it, somebody has been told what they are
buying. `Object.freeze` on the baseline is shallow and would not have stopped
it, so the rule is stated rather than assumed from the freeze.

**Not decided here.** `profitability("customer")` still groups by the project's
own `partyId`, so a split job credits its revenue to one customer. "Who is this
project for" and "who paid which invoice" are different questions and the
second is already answered per invoice; splitting the first is reversible and
can be done if it is ever wanted. The tax treatment itself is an asesor's call,
not the system's — LEGAL_REVIEW.md §5, `legally_verified: false`.

### 181 · Milestone invoices were charging VAT twice (2026-08-17)

**The bug, which was live.** A contract stores `totalCents = valueCents +
vatCents` and its instalments are percentages of that — correct, and how a
Spanish contract states a payment schedule ("40% a la firma" of the total the
customer will pay). The invoice generator handed that VAT-inclusive figure to
the draft as the line's `amountCents`, which `issueInvoice` treats as the
taxable BASE and then adds VAT to. Measured on a 1.000 € + 10% contract: the
100% milestone produced an invoice of 1.210 € against a 1.100 € contract.

Every milestone invoice ever issued through that screen carries it. Nothing
detected it because both figures are internally consistent — the document adds
up, the series is gapless, the totals reconcile with themselves. It is only
wrong against the contract, and nothing compared the two.

**How it surfaced.** The split-billing over-billing guard (§180, AR-11) refuses
an invoice whose base exceeds what that payer owes. 1.210 does not fit inside
1.100, so the guard refused a milestone the E2E expected to succeed. The first
reading was "my new guard is too strict"; the measurement said otherwise.

**The fix.** `invoiceBases` returns `baseCents` beside `amountCents` on every
milestone — the instalment with its VAT taken back off, stripped at the
project's own rate because that is the rate baked into the figure the contract
was signed on. The picker still shows the stated, customer-facing amount; the
line gets the base. The division belongs to the engine for the reason that
method's docstring already gives: "the generator's job is to let somebody pick
one, not to make them add it up again."

**Not corrected retroactively.** Invoices already issued are immutable and
hash-chained (VFU-01), and rewriting them is neither possible nor lawful. Any
that were over-charged are corrected the way the system already corrects an
invoice — a factura rectificativa naming the original. That is an operator
decision on real documents, not something a migration may do quietly.

**What this says about the guard.** It was written to stop one payer being
billed for another's scope and it found an unrelated arithmetic fault on its
first contact with real data. A rule that states what must be true tends to
catch more than the case that motivated it; the value is in stating it, not in
the case.

### 182 · Catalan reaches zero; the setup guide stays English (2026-08-17)

**The backlog is cleared.** 1 036 entries had no Catalan form, so a Catalan
reader saw SPANISH wherever one was missing — the layer falls back to the hub
language, which means the gap was invisible to everyone except the person
reading it. All 1 036 are translated; `coverage.mjs` reports 3 264 entries
complete in all three languages and `CA_BACKLOG` is now **0**, turning a
declining ceiling into an absolute rule: a string added without Catalan fails
the build exactly as one added without English does.

They are **machine-authored**, stated plainly in the file so a native speaker's
review has a scope rather than a rumour: one marked block at the end of
`i18n-dict-ca.js`, not two thousand entries to re-read. Negative-controlled —
removing a single entry fails the gate and names the string.

**The setup guide stays English, by the operator's decision.** It is not 457
missing Catalan entries: the page is `lang="en"`, so every string would need a
Spanish key INVENTED as well as a Catalan form written — roughly 914
translations for a document read once, by whoever installs the system, in the
language that audience already works in. `backend.html` joins it: `GET` and
`…/invoices/{id}` are not phrases with a Catalan form. Both are now listed in
`audit.mjs` as `ENGLISH_BY_DESIGN` rather than counted for ever, which follows
the rule the miss-crawler already applies to company records — **split by
ORIGIN, not by storage.**

**What the audit still reports, and why it is not zero.** 72 strings, and every
one is company DATA: "Marta Roca Puig", "C/ Balmes 120", "P-R014",
"Forn Sant Jordi S.L.". They must never be translated. They are left counted
rather than pattern-matched away, because a rule broad enough to catch a
person's name is broad enough to hide a real label — better a known, explained
residue than a clean report bought with a rule nobody can bound. The honest
claim is therefore: **the ERP's interface is fully translated; what remains
reported is the company's own data and two English documents.**

**A real bug found by dumping the residue instead of trusting it.** Among the
72 sat `50% · falta 4`. A Catalan rule matched it and mapped it to ITSELF —
`"$1% · falta $2"` — which is the worst possible way to be untranslated: a rule
that matches has handled the string, so the layer reported success and the miss
ledger never recorded it. Only the rendered-page audit, comparing the two
renders and finding them identical, could see it. Now `en falta 1` /
`en falten N`, split for verb agreement, with the percentage widened to accept a
decimal. **An identity rule is not a decision that two languages agree; it is a
gap wearing the costume of one.**

Swept for the same shape afterwards: 32 further Catalan identity rules, all
checked and all legitimate — _seleccionada, mes, Factura, Oferta, Tarifa,
crítica, incompleta, mín._ really are the same word in Catalan. `falta` was the
only impostor.

## The price book's pictures are DRAWINGS, and they are DERIVED, not stored

The instruction was "add for each sub-item a picture which represents the task…
keep it simple and lean to avoid using super a lot of data". Two hundred and
eight photographs is somewhere north of forty megabytes, each one to be shot,
licensed, stored, backed up and restored so a thumbnail can sit beside a line
of a quote. So each partida gets a **line drawing** instead: 54 shapes, a few
dozen numbers each, the whole set smaller than one photograph.

**Three reasons, and only the first is about size.**

_It is the only thing that reaches the paper._ `site/erp-pdf.js` has no image
support at all — no XObject pipeline, no colour space, no decoder. It draws
with PDF path operators, and its house mark already says why: "Vector rather
than an image so it stays crisp at any size and adds no bytes worth counting."
A raster picture could not have been printed without building all of that.

_It cannot be mistaken for evidence._ `ensureDemoImages` already refuses to
write invented pictures into the company's real attachment store, on the
grounds that a fiction indistinguishable from a photograph of an actual wall is
worse than no picture. These are symbols, they live in code rather than in the
blob store, and nothing about them can ever be read as a record of a site.

_One definition, three surfaces._ The catalogue, the quote builder and the
printed quote render the same shape through two writers (inline SVG, PDF path
operators). They cannot show three different pictures of one partida, and the
browser suite follows a single partida through all three and compares the
drawings rather than merely counting them.

**Derived, not stored — the reversible order.** No migration and no new field:
the drawing is resolved from the partida's own words, then from the words of
the chapter above it, then from the chapter code. Nothing is added to the state
blob that re-serialises on every keystroke, and a frozen version keeps the
picture it was sent with for the same reason it keeps the price — the words it
was computed from are frozen too. `pick()` already honours an explicit
`pictogram` field if one is ever set, so the operator can be given an override
later without a migration now.

**Two things the first version got wrong, both found by looking at the page.**
The rendered quote came out as five pages of identical boxes: the fixture's
lines read "Partida 3 del capítulo" and carry their meaning in the heading
above them, which the resolver ignored. And the document writer transliterates
to Latin-1, so its chapters spell "Demolicion" while the price book spells it
"Demolición" — two spellings of one word, matching nothing. Matching is now
accent-folded on both sides, and ranks by **first mention** rather than longest
keyword, because "Limpieza y retirada" is a chapter about cleaning that ends
with a lorry. The gate had reported one mark per row throughout. **Counting
marks is not the same as looking at them.**

## The miss ledger learns that the price book translates itself (2026-08-17)

**Decision.** `tests/i18n/miss-crawl.mjs` now reads `ErpCatalogueI18n` as well as
`erp.state`, so a price-book description rendered in the reader's language is
excused the way its Spanish original always was. The CI ceilings drop from
239/341 to 80/124 (measured 76 English, 119 Catalan).

**Why this is not lowering a bar to fit.** The ledger's rule is that a rendered
string is excused when it matches something the company stores. What the company
stores for a price-book line is the Spanish text. Publishing the pack in English
and Catalan therefore made 238 descriptions reportable **because they had been
translated** — the rendered English no longer matched the stored Spanish. The
gate was not detecting missing translations; it was detecting the presence of
them. `lists` and `commsTemplates` already carry their own `es`/`ca` columns and
are excused on exactly this ground; the price book now joins them.

**The control that says the exemption did not overreach.** The report's own
line — `82 shipped-vocabulary values NOT excused` — is identical before and
after, and the excused count rose by precisely the number the reported count
fell by (835 → 1073, 314 → 76). Nothing moved except the catalogue. That number
is the guard against the failure this file records elsewhere: a rule meant to
excuse customer names once swallowed twenty-five alert rules, and the number
went down, which is the most dangerous direction for a number to move.

**Four strings of slack, and what they are.** The crawl presses a bounded number
of controls in DOM order, so changing the markup changes which controls fall
inside the budget and moves the count by a string or two — measured at one
across two runs. The alternative, a ceiling pinned to the exact figure, goes red
on the next layout commit for a reason it is not about. Reversible: lower it
whenever the crawl is made deterministic.

## The bank statement importer reads ONE fixed layout (2026-08-18)

**Decision.** `site/erp-import.js` parses the `.xlsx` movements export BBVA
produces today: a preamble, then a header row found **by its column names**
(Fecha / F. Valor / Concepto / Movimiento / Importe / Divisa / Disponible /
Observaciones), then one row per movement. No column-mapping step, no second
bank. Operator-chosen for speed over generality.

**The known cost, stated rather than discovered later.** The day BBVA renames a
column, the import fails loudly at the header search — it says which names it
was looking for — and a second bank means a second profile in the same module.
The reversible upgrade is a per-account column-mapping step remembered on the
account; the parser is deliberately its own file so that upgrade is a swap, not
surgery on the reconciliation screen.

**What is NOT fixed.** The preamble length (the header is found by name, not by
row number), the number formats ("1.234,56" text and numeric cells both parse,
by string arithmetic — never by multiplying a float), and dates (DD/MM/YYYY
text or Excel serials). Re-imports are safe by the engine's own dedupe:
`previewImport` keys on date│amount│CONCEPT and the screen imports only the
fresh rows, so a statement re-exported with three weeks of overlap imports only
its new lines. A row the parser cannot read is COUNTED and shown ("Filas no
legibles"), never silently dropped — a skipped row nobody is told about is a
missing movement found at reconciliation time.

## A variation is a REAL budget, and acceptance is what joins it (2026-08-18)

**Decision.** Client blocks 5–6 ("there must be a Variation Budget which,
together with the originally approved budget, forms the basis for financial
control"; "new Line Items and Sub-line Items should be reflected automatically…
and the deadline extended") are modelled as: a new `state.budgets` row flagged
`variationOf: <projectId>`, built in the SAME builder and frozen by the SAME
acceptance as any budget. Nothing about the accepted original moves — its three
immutability guards stand untouched.

**What acceptance does, in one place.** The variation's chapters are renumbered
to carry on from the project's highest (so every chapter-addressed mechanism —
allocations, progress, drill-downs — works on them unchanged); the economics
grow by its sale and cost; certification sees its execution; the attribution
ceiling grows for the project's own payer; and the completion date extends by
`scheduleImpactDays` — when the project HAS one, because extending a date that
was never set would be inventing one. A draft or issued variation counts for
NOTHING: a proposal is not a contract.

**Why this model.** The alternative — growing chapters/lines on the `changes`
record — rebuilds the budget builder, versioning, freezing, PDF and signature
machinery in a second place, and second places drift. Reusing the budget means
a variation is priced from the same catalogue, printed by the same writer and
signed by the same ceremony the client already knows. `changes` stays what it
is: a priced note that becomes a contract annex.

**Deliberately out.** A variation for a DIFFERENT payer than the project's own
(it would need chapter attribution UI — the dormant split-billing surface);
negative variations (a reduction is a credit-note conversation, not a budget);
and variation-aware Gantt task generation (the plan derives from the base
version; variation chapters appear on the progress list but not as auto tasks).
Each reversible, none silently decided — this note is the flag.

## S19 · An empty state is a screen, and it needs a door

**Found by the client, on production, on day one.** The petty-cash screen said
"no cash till configured" and offered nothing to press; the bank screen said
"no accounts configured" and did the same. Everything Part 1 built — creating
the account, importing the statement — was rendered ten lines below that early
return, so on a register with no accounts the whole of the bank work was
unreachable. Not a stale deploy, which is what it looked like: the code was
current, the door was just behind the wall.

**Why no test saw it.** Every browser suite runs against the demo seed, which
ships two accounts and a till. A server-mode tenant never runs that seed, so
the empty branch was the one state nothing had ever opened. `testFirstRun`
now empties the register in the page and asserts the way OUT of each empty
state; it was confirmed red against the unfixed screens before being kept.

**The rule taken from it:** an empty state names what is missing AND carries
the control that creates it. Where the creation lives on another screen, the
empty state says which one. Checked across all 29 routes on an empty register;
the remaining empty screens are project-scoped ones that say "no projects yet"
(a project arrives from an accepted budget, which is a different screen's job)
and Usuarios, which correctly reports that accounts live on the server.

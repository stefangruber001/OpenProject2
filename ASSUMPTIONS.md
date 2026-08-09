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
  already does when the reader is unavailable.

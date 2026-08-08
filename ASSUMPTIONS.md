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

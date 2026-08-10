# INTEGRATIONS_PENDING — real adapters to replace fakes

Each is a port with a fake/stub adapter today. No credentials exist in this
repo; none were invented (mandate §3).

| Port                                     | Fake today                                                  | Real integration pending                                                                                                                                  | Notes                                                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tax-authority-submission@1` (Verifactu) | not bound (gated)                                           | AEAT Verifactu endpoints + certified registro/QR                                                                                                          | after certification review; deadline 2027 (LEGAL_REVIEW #1)                                                                                                                   |
| `einvoice@1`                             | not bound                                                   | Facturae 3.2.x XML + FACe (public sector); Crea y Crece B2B when reglamento lands                                                                         | public-sector tenants only at first                                                                                                                                           |
| `bank-statements@1`                      | fixture N43 file parser (P2)                                | real N43 fetch (PSD2 aggregator or manual upload)                                                                                                         | cheapest cash-visibility win                                                                                                                                                  |
| `payments-out@1` / `direct-debit@1`      | none                                                        | SEPA N34 / N19 file generation                                                                                                                            | file-based, no API needed                                                                                                                                                     |
| `doc-render@1`                           | deterministic HTML adapter                                  | PDF via headless Chromium (present in env)                                                                                                                | keep HTML as source of truth                                                                                                                                                  |
| `email-out@1`                            | log-only fake                                               | SMTP/provider of tenant's choice                                                                                                                          | never sends for real in dev (mandate §3)                                                                                                                                      |
| `outlook-drafts@1` (save-to-Drafts)      | downloadable `.eml` (X-Unsent:1) + generated PDF attachment | Microsoft Graph `POST /me/messages` to place the branded email straight in the Outlook Drafts folder                                                      | needs tenant Microsoft 365 app registration + delegated `Mail.ReadWrite`; no creds in repo. The `.eml` (opens as an editable Outlook draft) is the honest artifact until then |
| `accounting-export@1`                    | none                                                        | gestor-friendly export (A3/Holded/Sage CSV)                                                                                                               | ask the gestor's preferred format (OPEN_QUESTIONS)                                                                                                                            |
| `price-db-import@1`                      | none                                                        | FIEBDC-3 `.bc3` import (BEDEC/CYPE/Preoc)                                                                                                                 | P2; adoption-critical                                                                                                                                                         |
| `legacy-data-import@1` (Diorka)          | none                                                        | migration from Excel workbooks (Comparatiu, catalogues); NB cane.gestortectic.com is their **public marketing site** (WordPress/Avada), not a data source | BRD §7.3; credentials stay out of the repo                                                                                                                                    |
| `brand-assets@1` (Canei Subirats)        | typographic wordmark stand-in                               | real logo SVGs (`logo-Caneisubirats-2.svg`, `_blanc-1.svg`, `caneisubirats_verd.png`, `picto-groc.png`) from their WP media library                       | see docs/clients/canei-subirats/BRAND.md; swap at handover                                                                                                                    |
| `google-play-publishing@1` (Android)     | CI builds debug-signed `.aab` artifact                      | signed upload + Play API release via `android-play.yml` (secrets: ANDROID_KEYSTORE_*, PLAY_SERVICE_ACCOUNT_JSON)                                          | needs owner: Play account ($25), upload keystore, service account — PLAY-SETUP.md has the 30-min checklist; pipeline already runs end to end without them                     |

## SMTP — sending an invitation (S1c, 2026-08-09)

**What is blocked:** nothing. Accounts can be created, roles set, people
disabled and passwords reset today. What SMTP changes is only whether the
invitation _arrives on its own_.

|                      | With `SMTP_URL` + `SMTP_FROM` | Without                                    |
| -------------------- | ----------------------------- | ------------------------------------------ |
| The account          | created                       | created                                    |
| The activation link  | mailed to the person          | shown to the admin to pass on              |
| What the screen says | "invitación enviada"          | "no se ha enviado ningún correo" — plainly |

The screen never claims a message was sent when none was. That rule is the
reason this is a config gap and not a broken feature: the fallback is a working
path, not a degraded one, and the admin hands the link over by WhatsApp or in
person. For a pilot of two or three people that is a small cost; at ten it
becomes an irritation worth removing.

**What is still to build when the credential arrives:** the transport itself.
`apps/web/lib/invite-mail.ts` detects the configuration and says out loud that
nothing was wired yet, rather than half-implementing a mailer that swallows its
own errors. Roughly: add the dependency, send, and return `true` on success —
the call sites and the honest-failure path already exist and are tested.

**What is needed:** an SMTP account (host, port, user, password) and a From
address on a domain the company controls. Invitations sent from an address that
fails SPF/DKIM land in spam, which looks exactly like the feature not working.

| Port                                     | Fake today                                                  | Real integration pending                                                                                                                                                                       | Notes                                                                                                                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tax-authority-submission@1` (Verifactu) | not bound (gated)                                           | AEAT Verifactu endpoints + certified registro/QR                                                                                                                                               | after certification review; deadline 2027 (LEGAL_REVIEW #1)                                                                                                                                                                                 |
| `einvoice@1`                             | not bound                                                   | Facturae 3.2.x XML + FACe (public sector); Crea y Crece B2B when reglamento lands                                                                                                              | public-sector tenants only at first                                                                                                                                                                                                         |
| `bank-statements@1`                      | fixture N43 file parser (P2)                                | real N43 fetch (PSD2 aggregator or manual upload)                                                                                                                                              | cheapest cash-visibility win                                                                                                                                                                                                                |
| `payments-out@1` / `direct-debit@1`      | none                                                        | SEPA N34 / N19 file generation                                                                                                                                                                 | file-based, no API needed                                                                                                                                                                                                                   |
| `doc-render@1`                           | deterministic HTML adapter                                  | PDF via headless Chromium (present in env)                                                                                                                                                     | keep HTML as source of truth                                                                                                                                                                                                                |
| `email-out@1` (actually SENDING)         | log-only fake                                               | SMTP/provider of tenant's choice — deliberately still unbuilt; drafts are the whole posture                                                                                                    | never sends for real in dev (mandate §3)                                                                                                                                                                                                    |
| `outlook-drafts@1` (save-to-Drafts)      | downloadable `.eml` (X-Unsent:1) + generated PDF attachment | **BUILT — IMAP APPEND** to the mailbox's Drafts folder (`apps/web/lib/draft-mailbox.ts`, `POST /api/<tenant>/erp/draft`). Works with any IMAP provider, so no Microsoft 365 tenant is required | Needs only the mailbox password, set with `ops/set-email.sh` or Ops → `set-email`; never in the repo. **Appends, never sends** — there is no SMTP in this codebase. No screen calls it yet: the `.eml` download is still what the UI offers |
| `accounting-export@1`                    | none                                                        | gestor-friendly export (A3/Holded/Sage CSV)                                                                                                                                                    | ask the gestor's preferred format (OPEN_QUESTIONS)                                                                                                                                                                                          |
| `price-db-import@1`                      | none                                                        | FIEBDC-3 `.bc3` import (BEDEC/CYPE/Preoc)                                                                                                                                                      | P2; adoption-critical                                                                                                                                                                                                                       |
| `legacy-data-import@1` (Diorka)          | none                                                        | migration from Excel workbooks (Comparatiu, catalogues); NB cane.gestortectic.com is their **public marketing site** (WordPress/Avada), not a data source                                      | BRD §7.3; credentials stay out of the repo                                                                                                                                                                                                  |
| `brand-assets@1` (Canei Subirats)        | typographic wordmark stand-in                               | real logo SVGs (`logo-Caneisubirats-2.svg`, `_blanc-1.svg`, `caneisubirats_verd.png`, `picto-groc.png`) from their WP media library                                                            | see docs/clients/canei-subirats/BRAND.md; swap at handover                                                                                                                                                                                  |
| `google-play-publishing@1` (Android)     | CI builds debug-signed `.aab` artifact                      | signed upload + Play API release via `android-play.yml` (secrets: ANDROID_KEYSTORE_*, PLAY_SERVICE_ACCOUNT_JSON)                                                                               | needs owner: Play account ($25), upload keystore, service account — PLAY-SETUP.md has the 30-min checklist; pipeline already runs end to end without them                                                                                   |

## Apple signing certificates — the TestFlight lane has run out of them

**Status:** blocked in Apple's account, not in this repo. Nothing to build.

`ios/fastlane/Fastfile`'s `beta` lane signs with Xcode **cloud-managed**
signing: `build_app` passes `-allowProvisioningUpdates` plus the App Store
Connect API key, and xcodebuild asks Apple to mint the distribution certificate
and profile during the archive. That is the arrangement that needs no `match`
repo and no `.p12` in a secret, which is why it was chosen.

Its cost is that **a fresh CI runner holds no private key**, so every run mints
a _new_ certificate rather than reusing one. Apple caps how many an account may
hold. Run 16 (2026-08-10 04:38, build 6) consumed the last slot and succeeded;
run 17, forty minutes later, failed in the archive step with:

> Choose a certificate to revoke. Your account has reached the maximum number
> of certificates.

**Why this was not fixed here.** The fix Apple names is revoking certificates,
which is irreversible and is done against the operator's developer account — it
cannot be undone by re-running anything, and revoking the wrong one breaks
signing on the operator's own Mac. Under the autonomy contract that is the less
reversible option, so it is written down rather than done.

**What unblocks it (2 minutes, once):** developer.apple.com → Certificates,
Identifiers & Profiles → Certificates, revoke the stale _Apple Distribution_
certificates — the cloud-managed ones minted by earlier CI runs, which no
machine holds a private key for. Then re-run `ios-testflight.yml`.

**The durable fix,** if the app is going to ship often: give CI one certificate
to reuse instead of minting one per run — either fastlane `match` with a
private cert repo (needs the repo and a `MATCH_PASSWORD` secret) or a
distribution `.p12` exported once and imported from a secret. Both need a Mac
and the account owner, which is why neither is wired.

**What is NOT blocked:** the app in TestFlight already runs the current build.
It loads `site/` from the server, so it picked up v101 when deploy promoted it.
Only the native shell is frozen at `136b131`, and the only thing that differs
there is the Face ID lock screen's wording — see `RELEASES.md`.

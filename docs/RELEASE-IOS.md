# Shipping the iOS app as a Custom App (Apple Business Manager)

Written 5 Sep 2026. The operator chose the private route:
_"adjust to the Apple private business manager concept"_.

Canei Subirats is the working system of one company. It has no public sign-up
and is of no use to anyone outside the company, so it is distributed **privately
to that company** rather than listed on the App Store. Same binary, same
metadata, same review — but the reviewer is not asking whether the general
public would want it, which is the question a single-company ERP fails.

---

## Read this first: is Business Manager already set up?

This is the one thing that decides whether the private route is available
**tomorrow** or **next week**, and it is worth checking before anything else.

A Custom App is distributed to an organisation, and that organisation has to
exist in **Apple Business Manager** with its own Organization ID.

| If Canei Subirats…                                | Then                                                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **already has** an Apple Business Manager account | You can do the whole thing tomorrow. You need its **Organization ID** (Business Manager → Settings → Enrollment Information). |
| **does not**                                      | Enrolment needs a **D-U-N-S number** and Apple verifies the company by phone. That is **days, not hours** — sometimes a week. |

**If Business Manager is not in place, nothing is lost and nothing is blocked.**
TestFlight already works, is already carrying the current build, and takes up to
100 internal testers with no review at all. That is a perfectly good way to run
the app inside the company while enrolment goes through — it is how the team has
been using it already.

Start the enrolment at <https://business.apple.com>; come back to this document
when the Organization ID exists.

### Enrolling in Apple Business Manager — what it actually involves

Checked 14 Sep 2026: **Canei is not enrolled.** Until it is, there is no
Organization ID, App Store Connect cannot be set to custom distribution, and a
submission would go in as a PUBLIC app — into precisely the rejection this whole
route exists to avoid. So this is the critical path, and it is worth starting
before anything else.

1. **Get a D-U-N-S number if the company has none.** It is a free nine-digit
   identifier from Dun & Bradstreet, and Apple has its own request form for it:
   <https://developer.apple.com/enroll/duns-lookup/>. Look the company up first —
   most registered Spanish companies already have one and do not know it. If it
   has to be created, allow up to five business days.
2. **Enrol at <https://business.apple.com>.** You need the legal entity name
   exactly as registered, the D-U-N-S number, and a work email address on the
   company's own domain — a Gmail address is refused.
3. **Name a verification contact.** Apple telephones this person to confirm the
   enrolment is genuine and that whoever signed up can bind the company. It is a
   short call, but it is a human on a telephone, so it happens in business hours
   and it is the step that decides how long this takes.
4. **Accept the terms**, and the account is live.
5. **Take the Organization ID** from Business Manager → **Settings → Enrollment
   Information**. That is the value App Store Connect asks for.

Expect **days, occasionally a week**. Nothing else waits on it: TestFlight
carries the app inside the company the whole time, with no Apple review at all.

---

## What is ready in this repository

### The build — done, and green

`.github/workflows/ios-testflight.yml` — Actions → **iOS · TestFlight** → Run
workflow. TestFlight currently holds **version 1.1, build 14** (8 Sep).

**Run #26, on 14 Sep, failed — and not because of anything in this repository.**
Apple refused to mint a signing certificate:

> Choose a certificate to revoke. Your account has reached the maximum number of
> certificates.

That is the known consequence of cloud-managed signing, which asks Apple for a
_new_ certificate on every CI run. It is written up in `INTEGRATIONS_PENDING.md`
and it is **two minutes to clear**, below. It has to be cleared before a
submission, because the build now in TestFlight predates the current work — and
predates the privacy manifest, which Apple has required since May 2024.

The web content updates by itself on every deploy; a new build is only needed
when something bundled into the shell changes — the tab bar, the icon,
permissions, the privacy manifest.

#### The certificate cap — cleared once, and then it stops happening

The cause was structural, not bad luck. The build lane signed with
`-allowProvisioningUpdates`, which tells `xcodebuild` to **ask Apple for a new
distribution certificate whenever it cannot find one locally** — and a CI runner
is a fresh machine every time, so it never found one. Every build minted
another. Apple caps a standard account at three.

**One-off, yours (five minutes).**

1. developer.apple.com → **Certificates, Identifiers & Profiles → Certificates**.
   Revoke every **Distribution** and **iOS Distribution** certificate whose
   _Created By_ is an API key. They were minted on runners; each private key
   died with the machine that made it, so they can sign nothing anywhere,
   including on your own Mac. **Keep** anything created by a person, and keep
   **Distribution Managed**, whose key Apple holds. The `Created via API`
   _Development_ entries are harmless — development certificates have no cap —
   but you may as well clear them so the list is readable.
2. GitHub → Settings → Secrets and variables → Actions → **`MATCH_PASSWORD`**.
   Any long passphrase. Keep a copy where you keep passwords: without it the
   certificate store cannot be opened and the setup has to be done again.
3. Actions → **iOS · Signing setup** → Run workflow, typing `CREATE` in the
   confirmation box. It uses one of the three slots, on purpose, for the last
   time.

That lane creates one certificate and one App Store profile, encrypts them with
your passphrase, and stores them on the `certificates` branch of this
repository. Every build from then on **downloads and reuses** them: the build
lanes run `match` in read-only mode, so they can use what exists and can create
nothing.

There is no second secret. `match` reaches the branch with the workflow's own
`GITHUB_TOKEN`, assembled at run time.

**How you know it worked:** run **iOS · TestFlight** afterwards and look at the
certificate list again. The count went up by exactly one, at step 3, and never
moves again.

### The listing — written, both languages

`ios/fastlane/metadata/`, in fastlane's `deliver` layout. A Custom App still
carries a full listing: the reviewer reads it, and the people installing from
Business Manager see it. It is simply not publicly searchable.

| File                                                              | What it is                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `en-US/`, `es-ES/`                                                | name, subtitle, description, keywords, promotional text, release notes, three URLs                     |
| `copyright.txt`, `primary_category.txt`, `secondary_category.txt` | Canei Subirats, S.L. · Business · Productivity                                                         |
| `review_information/notes.txt`                                    | that this is a custom app for one company, what to look at, and how to switch the interface to English |

All fields are within Apple's limits.

### The privacy policy — published

`site/privacy.html`, live at `/privacy.html`. Apple requires a reachable privacy
URL for a Custom App exactly as for a public one. It describes what the system
actually does, and every sentence was checked against the code.

Logged in `LEGAL_REVIEW.md` §8 with `legally_verified: false`. Have the gestoría
read it. The gap that matters most: no written data-processing agreement
(contrato de encargado) with the server, mail and banking providers, which the
RGPD requires whatever the distribution method.

### The screenshots — taken

`ios/fastlane/screenshots/{en-US,es-ES}/` — five screens each, at 1320 × 2868
(the 6.9-inch iPhone, the one size Apple requires). Captured from the running
workspace, which is the interface the app shows; they do not include the native
tab bar the shell draws, because that belongs to the shell and not the page.
Replace them with device captures from TestFlight if you prefer — same
filenames, they sort in display order.

They are **committed**, which is the only reason the submission workflow can
find them: it checks the repository out clean on a fresh machine, so a
screenshot that lives only on someone's laptop is a screenshot Apple never sees.
Regenerate them with `node scripts/app-store-shots.mjs` and commit the result.

### The submission — one click

`.github/workflows/ios-release.yml` — Actions → **iOS · App Store submission** →
Run workflow. Uploads the listing and submits the build **already in TestFlight**
for review. It builds nothing: submitting a fresh binary would put a version
nobody has run in front of a reviewer.

---

## What you do in App Store Connect (once)

Custom App distribution is a **setting on the app record**, not something
fastlane can send. It is set once and then every future submission follows it.

1. App Store Connect → the app → **Pricing and Availability**.
2. Under distribution, choose the **private / custom app** option rather than
   public App Store availability.
3. Add **Canei Subirats** as the organisation allowed to install it, by its
   Apple Business Manager **Organization ID**.
4. Price: free (or a bulk price if the app is ever sold to another company —
   not the case here).

Apple's exact wording on that screen has changed more than once; if the labels
do not match, look for _availability_, _distribution_ or _custom app_ on the
Pricing and Availability page. The concept is stable even when the words move.

After review, the app appears in **Apps and Books** in Business Manager, where
you assign licences to people or devices. It never appears in App Store search.

---

## The values only you have — two of three are now filled

The `release` lane stops and names them rather than submitting without them.
That is not pedantry: an app a reviewer cannot sign into is rejected under
**guideline 2.1**, and a rejection costs days. Custom apps are reviewed too.

| Value              | Where                                       | Why                                             |
| ------------------ | ------------------------------------------- | ----------------------------------------------- |
| `phone_number.txt` | `ios/fastlane/metadata/review_information/` | App Review calls it if something is wrong       |
| `demo_user.txt`    | same folder                                 | the reviewer has to get in; there is no sign-up |
| the demo password  | secret `ASC_DEMO_PASSWORD`, **not** a file  | a password does not belong in git               |

**Filled on 15 Sep:** the App Review contact number (`+34 659 87 67 00`) and the
demo account (`stefan@caneisubirats.com`). Only the password is outstanding, and
it is outstanding on purpose — it goes in Settings → Secrets and variables →
Actions → **`ASC_DEMO_PASSWORD`**, never in a file.

**One caution about that account.** It is the operator's own Administrador login
on the live system. App Review shares reviewer credentials internally, and the
account stays live afterwards. A separate `revisor` account is two minutes —
Configuración → Usuarios → ＋ Nuevo usuario, `Administrador` so the reviewer sees
the whole app — and it can be disabled the day the app is approved. Whichever you
choose, the password belongs in the secret and nowhere else.

You will also want the **Business Manager Organization ID** to hand for step 3
above. It is not a file in this repository because nothing here sends it.

---

## Apple's own questions, pre-answered

Three screens in App Store Connect that nothing in this repository can send, and
each of them a rejection if answered wrongly. Every answer below was checked
against the code, not guessed.

### App Privacy — "Data Collection"

> **Do you or your third-party partners collect data from this app?** → **No**

That is the whole questionnaire, and it is the truthful answer. The app is a
shell around the company's own workspace: nothing is collected for analytics,
advertising, personalisation or any other purpose Apple's list names, there is
no SDK in the binary that collects anything, and there is no third-party partner
at all. Data the user types goes to the company's own server as part of the
service, which is what the app is for — Apple's own guidance is that this is not
"collection" to be disclosed unless it is used for one of the listed purposes.

If a reviewer questions it, the supporting facts are: no IDFA, no analytics SDK,
no advertising SDK, no crash reporter, no tracking domains, and a privacy
manifest declaring `NSPrivacyTracking: false` with an empty
`NSPrivacyCollectedDataTypes`.

### Export compliance

> **Does your app use encryption?** → **Yes** (it speaks HTTPS)
> **Does it qualify for the exemption?** → **Yes**

The only cryptography in the app is the operating system's own TLS and the
keychain. That is exemption (b) — standard encryption provided by Apple, used
only to protect the app's own traffic — so no CCATS, no year-end self-
classification report. The `release` lane already declares
`export_compliance_uses_encryption: false`, which is fastlane's way of saying
"nothing that needs documentation".

### Content rights and advertising

> **Does it contain third-party content?** → **No**
> **Does it use the Advertising Identifier (IDFA)?** → **No**

Both already declared by the lane.

### Age rating

Answer **no** to every question in the questionnaire. The result is **4+**. There
is no user-generated content shown to other users, no unmoderated content, no
web browser, no gambling, no contests.

## Tomorrow morning, in order

1. **Check Business Manager.** Organization ID in hand → continue. Not enrolled
   → start enrolment, keep using TestFlight, stop here.
2. **Fill the three values** above.
3. **Install the TestFlight build** (#24 is waiting) and open it once. Anything
   wrong is cheaper to find here than in review.
4. **Set custom-app distribution** in App Store Connect (the section above).
5. Actions → **iOS · App Store submission** → Run workflow with
   `submit: false`. Read the listing in App Store Connect.
6. Run it again with `submit: true`.

Apple's own questions — age rating, the App Privacy questionnaire, export
compliance — are answered once in App Store Connect and are not files. They are
written out field by field in the section above, so each is a copy rather than a
judgement. The lane declares what it can: no IDFA, no encryption beyond HTTPS,
no third-party content.

### What checks the submission before Apple does

`node tests/app-store/run.mjs` reads this repository the way App Review reads a
submission: every listing field against Apple's character limits in both
languages, no locale missing a field the other has, the URLs, the categories, the
screenshots measured from their PNG headers rather than trusted from their
filenames, the privacy manifest, and the review notes. It runs in CI on every
commit, and the submission workflow runs it again with `--ready`, where the
values only you can supply stop being pending and become failures.

Roughly two in five first submissions are rejected, and the published reasons are
mostly this kind of thing rather than anything about the software. This is the
cheapest possible place to find them.

---

## What "one click" honestly means

Steps 4, 5 and 6 are one click each. Steps 1 and 2 are yours because the values
do not exist in this repository and cannot: an Organization ID belongs to your
Business Manager account, and a working demo password must never be committed.
Everything that could be automated from here is.

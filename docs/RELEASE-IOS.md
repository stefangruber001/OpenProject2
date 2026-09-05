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

---

## What is ready in this repository

### The build — done, and green

`.github/workflows/ios-testflight.yml` — Actions → **iOS · TestFlight** → Run
workflow. Last run: **#24, success, on `8830f42`**, which carries the current web
work. The build is in App Store Connect → TestFlight now.

The web content updates by itself on every deploy; a new build is only needed
when something bundled into the shell changes — the tab bar, the icon,
permissions.

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

## The three values only you have

The `release` lane stops and names them rather than submitting without them.
That is not pedantry: an app a reviewer cannot sign into is rejected under
**guideline 2.1**, and a rejection costs days. Custom apps are reviewed too.

| Value              | Where                                       | Why                                             |
| ------------------ | ------------------------------------------- | ----------------------------------------------- |
| `phone_number.txt` | `ios/fastlane/metadata/review_information/` | App Review calls it if something is wrong       |
| `demo_user.txt`    | same folder                                 | the reviewer has to get in; there is no sign-up |
| the demo password  | secret `ASC_DEMO_PASSWORD`, **not** a file  | a password does not belong in git               |

Make the demo account a **real account on the live system** with the
`Administrador` permission, so the reviewer sees the whole app: Configuración →
Usuarios → ＋ Nuevo usuario. Then add the secret at Settings → Secrets and
variables → Actions → `ASC_DEMO_PASSWORD`.

You will also want the **Business Manager Organization ID** to hand for step 3
above. It is not a file in this repository because nothing here sends it.

---

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
compliance — are answered once in App Store Connect and are not files. The lane
declares what it can: no IDFA, no encryption beyond HTTPS, no third-party
content.

---

## What "one click" honestly means

Steps 4, 5 and 6 are one click each. Steps 1 and 2 are yours because the values
do not exist in this repository and cannot: an Organization ID belongs to your
Business Manager account, and a working demo password must never be committed.
Everything that could be automated from here is.

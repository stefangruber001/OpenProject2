# Shipping the iOS app — what is ready, and what is yours

Written 5 Sep 2026, at the operator's request: _"update all meta data for Apple
so I can submit with one click"_.

Everything Apple asks for that could be prepared from inside this repository is
prepared. Three values could not be, because only you have them, and the release
lane refuses to run until they are filled — that refusal is deliberate and is
explained under **The three values** below.

---

## Read this first: the App Store may not be the right door

Canei Subirats is the **private system of one company**. It has no public
sign-up, and it is of no use to anyone who does not work for Canei Subirats.
Apple reviews against that: an app whose audience is a single organisation is
routinely refused on the public App Store under **guideline 4.2 (minimum
functionality)** or **4.3**, and the reviewer is told to use the private route
instead.

The private route is **Apple Business Manager → Custom Apps**. Same binary, same
build, same submission — but distributed privately to your own organisation
instead of listed publicly. It skips the "is this useful to the general public"
question entirely, because the answer is no and it is not supposed to be yes.

|                                | Public App Store    | Custom App (Business Manager)      |
| ------------------------------ | ------------------- | ---------------------------------- |
| Who can install                | anyone              | only people you name               |
| Review                         | full, incl. 4.2/4.3 | lighter, no public-usefulness test |
| Listing text, screenshots      | required            | required (same files)              |
| Risk of rejection for this app | **real**            | low                                |

Everything in this repository serves either route — the metadata, the
screenshots and the lane are identical. The choice is made in App Store Connect
(Pricing and Availability → Distribution), not here.

**Recommendation:** submit as a Custom App unless there is a reason to be
publicly listed. If you want the public listing anyway, submit it — a rejection
costs a review cycle and tells you exactly what Apple wants changed, and the
description already says plainly that access is issued by the company, which is
the honest framing and the one most likely to pass.

---

## What is ready

### The build

`.github/workflows/ios-testflight.yml` — Actions → **iOS · TestFlight** → Run
workflow. Builds, signs, increments the build number and uploads. This is what
refreshes the app after web changes; the web content itself updates on its own,
but anything bundled into the shell (the tab bar, the icon, permissions) needs a
new build.

### The listing

`ios/fastlane/metadata/` in fastlane's `deliver` layout:

| File                                                              | What it is                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `en-US/`, `es-ES/`                                                | name, subtitle, description, keywords, promotional text, release notes, three URLs     |
| `copyright.txt`, `primary_category.txt`, `secondary_category.txt` | Canei Subirats, S.L. · Business · Productivity                                         |
| `review_information/notes.txt`                                    | what the reviewer should look at, in order, and how to switch the interface to English |

All fields are inside Apple's limits (name 14/30, subtitle 27/30, keywords
94/100 and 97/100, promotional text ~107/170).

### The privacy policy

`site/privacy.html`, published at `/privacy.html`. **Apple will not accept a
submission without a reachable privacy URL and there was none**, which is why it
exists. It describes what the system actually does — no public sign-up, no
advertising, no analytics, no IDFA, no third-party trackers, camera only when a
photo is attached to a visit, email composed into your own Drafts and never
sent. Every sentence was checked against the code.

It is **not a lawyer's information clause**, and it is logged as such in
`LEGAL_REVIEW.md` §8 with `legally_verified: false`. Have the gestoría read it.
The gap that matters most: no written data-processing agreement (contrato de
encargado) is on file with the server, mail or banking providers, and the RGPD
requires one.

### The submission

`.github/workflows/ios-release.yml` — Actions → **iOS · App Store submission** →
Run workflow. Uploads the listing and submits the build **already in
TestFlight** for review. Run it once with `submit: false` if you want to see the
listing in App Store Connect before anything goes to review.

It does not build a binary on purpose: submitting a freshly built one would put
a version nobody has run in front of App Review.

---

## The three values only you have

The `release` lane stops and names them rather than submitting without them.
That is not pedantry — an app a reviewer cannot sign into is rejected under
**guideline 2.1**, and a rejection costs days.

| Value              | Where                                       | Why                                             |
| ------------------ | ------------------------------------------- | ----------------------------------------------- |
| `phone_number.txt` | `ios/fastlane/metadata/review_information/` | App Review calls it if something is wrong       |
| `demo_user.txt`    | same folder                                 | the reviewer has to get in; there is no sign-up |
| the demo password  | secret `ASC_DEMO_PASSWORD`, **not** a file  | a password does not belong in git               |

Make the demo account a **real account on the live system** with the
`Administrador` permission, so the reviewer sees the whole app. Create it the
normal way — Configuración → Usuarios → ＋ Nuevo usuario — and set a password you
are willing to have written down in App Store Connect.

Add the secret at: Settings → Secrets and variables → Actions → New repository
secret → `ASC_DEMO_PASSWORD`.

---

## Screenshots

`ios/fastlane/screenshots/en-US/` and `es-ES/`. Apple requires at least one
6.9-inch iPhone set. These were captured from the running workspace at
1320 × 2868, which is the same interface the app shows — the app is a shell
around it — but they were taken in a browser rather than inside the shell, so
they do not show the native tab bar at the bottom.

That is a fair representation and Apple accepts screenshots that show the app's
actual UI. If you would rather have true in-app captures, take them on a device
from TestFlight and drop them in the same folders; the filenames sort in display
order.

---

## The order to do it in

1. **Fill the three values** above.
2. Actions → **iOS · TestFlight** → Run workflow. Wait for the build to appear
   in App Store Connect → TestFlight (a few minutes of processing).
3. Install it from TestFlight and open it once. Anything that looks wrong is
   cheaper to find here than in review.
4. Decide public listing or Custom App (see the top of this document).
5. Actions → **iOS · App Store submission** → Run workflow, `submit: false`.
   Read the listing in App Store Connect.
6. Run it again with `submit: true`.

Apple's own answers — the age rating, the App Privacy questionnaire and export
compliance — are asked once in App Store Connect and are not files. The lane
declares the ones it can: no IDFA, no encryption beyond HTTPS, no third-party
content.

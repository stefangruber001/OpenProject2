# Canei Subirats — iOS app

A premium **native SwiftUI shell** around the live Canei Subirats web app.

## Why this design

The web app (in `../site`, published to GitHub Pages) is the single source of
truth for every screen and workflow. This iOS app loads those pages inside
enhanced `WKWebView`s and wraps them in a fully native experience: an animated
launch, a custom floating tab bar with haptics, a translucent top bar with a
live progress line, pull‑to‑refresh, graceful offline handling, native share,
and a JavaScript ⇄ native bridge.

**The payoff:** anything you change on the website flows into the app
automatically — on the next launch or pull‑to‑refresh. No App Store review is
needed for content, pricing, catalogue, or workflow changes. You only ship a
new build when you change the _native shell_ (rare).

### The one contract between the two (since 1.1)

The web view's user agent carries `CaneiApp/` (see `Config.userAgentMarker`),
and the web app reads it. Inside the shell it hides **its own** five-icon
section bar, because the native tab bar does that job better, and turns the
breadcrumb into the opener for the subsection list — the one thing a six-tab
native bar cannot reach.

Without that contract a phone inside the app showed three things stacked at the
bottom of the screen: the web's section bar, this app's floating tab bar over
it, and the web's site-action button positioned to clear the bar that was no
longer the one in front.

The match is on the `CaneiApp/` **prefix**, never the version, so an older build
keeps working against a newer site. Plain Mobile Safari is deliberately
unaffected — it has no native tab bar, so taking the web one away would strand
somebody with no route to a section. `tests/site-e2e/run.mjs` asserts both
halves by spoofing each user agent.

```
Native shell (this app)         Web app (../site → GitHub Pages)
  splash / tab bar / haptics       Home · Project · Control Tower · Guide
  offline · share · progress       all business logic, documents, data
        └──────── WKWebView loads the live pages ────────┘
```

## Requirements

- macOS with **Xcode 16 or newer**
- An **Apple Developer Program** membership ($99/yr) for TestFlight
- (For automated uploads) Ruby + fastlane — installed via `bundle install`

## Open & run (2 minutes)

1. Double‑click **`CaneiSubirats.xcodeproj`**.
   _If it doesn't open cleanly, run `./setup.sh` — it regenerates the project._
2. Select the **CaneiSubirats** target → **Signing & Capabilities** →
   choose your **Team**. Xcode will manage the signing certificate for you.
3. Pick an iPhone simulator (or your device) and press **▶ Run**.

That's it — the app launches, shows the brand splash, then the live web app.

## Configuration

Everything app‑level lives in `CaneiSubirats/Support/Config.swift`:

- `baseURL` — which website the app points at (production vs staging).
- `tabs` — the tab bar. Add/rename/reorder tabs here; each maps to a page.
- `internalHosts` — hosts that stay inside the app (others open in Safari).

## Ship to TestFlight

The full 2‑page quickstart is **`../site/Canei-Subirats-iOS-Beta-Onboarding.pdf`**.

**A. From your Mac — fill one file, run one command**

```bash
cd ios
make setup      # installs fastlane + creates fastlane/.env.default to fill once
#                 → paste 4 values into fastlane/.env.default (see .env.example)
make ship       # signs, auto‑bumps the build number, uploads to TestFlight
```

`fastlane/.env.default` (gitignored) holds `ASC_KEY_ID`, `ASC_ISSUER_ID`,
`ASC_KEY_P8_PATH` (path to your `.p8`), `DEVELOPER_TEAM_ID`, `APP_BUNDLE_ID`.
fastlane loads it automatically, so after the first fill every release is just
`make ship`.

**B. From GitHub (hands‑off)**

Add the four values as repository **Secrets** (`ASC_KEY_ID`, `ASC_ISSUER_ID`,
`ASC_KEY_P8` = the .p8 contents, `DEVELOPER_TEAM_ID`; optional repo **variable**
`APP_BUNDLE_ID`), then run the **“iOS · TestFlight”** workflow from the Actions
tab. It only runs when you click **Run workflow** — never on ordinary commits.

## Project layout

```
ios/
  CaneiSubirats.xcodeproj/      ready‑to‑open project (Xcode 16, synced folders)
  CaneiSubirats/
    App/        CaneiApp, RootView, AppState
    Web/        WebViewStore (the WKWebView engine), WebView, WebContainerView
    UI/         Theme, BrandMark, Splash, TabBar, TopBar, Offline, Haptics, Share
    Support/    Config
    Resources/  Info.plist, Assets.xcassets (AppIcon, colors)
  Makefile      make setup / make ship (one‑command release)
  fastlane/     Appfile, Fastfile (the `beta` lane), .env.example (fill once)
  project.yml   XcodeGen spec (only for regenerating the project)
  setup.sh      installs XcodeGen + regenerates + opens the project
  ExportOptions.plist
```

## The web ⇄ native bridge

The web app can call native features when running inside the shell:

```js
// Haptic feedback
window.webkit?.messageHandlers?.native?.postMessage({ action: "haptic", type: "success" });

// Native share sheet
window.webkit?.messageHandlers?.native?.postMessage({ action: "share", url: location.href });
```

`document.documentElement` also gets the class `native-app`, so the site can
hide its own top navigation when it's inside the app:

```css
html.native-app .site-header {
  display: none;
}
```

These are optional enhancements — the site works unchanged without them.

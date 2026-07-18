# Maestro — autonomous native UI tests

These flows drive the **native app** on an iOS Simulator (or a real device):
they launch it, walk the tab bar, and drive the customer journey through the
WKWebView — no hand-written XCUITest code. Maestro reads the accessibility
tree, so it sees both the native chrome (tab labels) and the web content.

## Flows

| File              | What it checks                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `01-smoke.yaml`   | Launch → splash → all four tabs present → each tab's page loads → state preserved when switching back |
| `02-journey.yaml` | Open **Project** → Load sample → Start the journey → advance stages → pull-to-refresh → screenshot    |

## Run locally (Mac + Xcode)

```bash
# 1) Install Maestro (once)
curl -Ls "https://get.maestro.mobile.dev" | bash

# 2) Build the app for the simulator and install it
cd ios
xcodebuild -project CaneiSubirats.xcodeproj -scheme CaneiSubirats \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build-sim CODE_SIGNING_ALLOWED=NO build
xcrun simctl boot "iPhone 16" || true
xcrun simctl install booted "$(find build-sim/Build/Products -name CaneiSubirats.app -type d | head -1)"

# 3) Run the flows
maestro test maestro
```

Or use **Maestro Studio** to explore the UI interactively and author new flows:
`maestro studio`.

## Run in CI

The **“iOS UI tests (Maestro)”** GitHub Actions workflow does all of the above
on a macOS runner and uploads a JUnit report + screenshots. Trigger it from the
Actions tab (manual only, so it never emails failures for routine commits).

## Claude as QA

Because Maestro is driven by simple YAML and exposes the accessibility tree,
Claude Code can extend these flows (or, with the Maestro MCP server, drive the
running app directly): tap through screens, fill forms, check edge cases, then
read the logs and report bugs — the “autonomous QA” loop. Add new `NN-*.yaml`
files here and they run automatically in the workflow.

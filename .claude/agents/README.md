# Reusable Claude Code agents

## `ios-web-shipper`

Turns any existing web app / website into a **premium native iOS app**, ships it
to **TestFlight** (fastlane + GitHub Actions), and sets up **autonomous testing**
(Playwright web E2E + Maestro native UI) — driving the CI runs itself until green.
It encodes the full playbook and every hard-won fix (Xcode 26 SDK, base64 `.p8`,
empty-env guard, archive-only signing auth, robust simulator boot, the
Maestro/WKWebView split, …), so it reaches green fast.

### Use it in THIS project

Just ask, e.g.:

> "Use the ios-web-shipper agent to ship the site to TestFlight and set up tests."

Claude routes the task to the agent (or invoke it explicitly via the Agent tool).

### Use it in ANOTHER project / another Claude chat

Agents are files. Copy the definition into the other project:

```bash
# per-project (committed to that repo, shared with the team)
mkdir -p <other-project>/.claude/agents
cp .claude/agents/ios-web-shipper.md <other-project>/.claude/agents/

# …or make it available in ALL your projects (user-level)
mkdir -p ~/.claude/agents
cp .claude/agents/ios-web-shipper.md ~/.claude/agents/
```

Then in that project's Claude chat, ask it to "ship this web app to iOS /
TestFlight with tests" — the `ios-web-shipper` agent picks it up. It will ask for
the few inputs it needs (app name, bundle id, web app URL, brand colour, Apple
Team ID + App Store Connect key id/issuer; the `.p8` stays local, never pasted).

> The single `.md` file **is** the agent — nothing else to install. It regenerates
> the `ios/` project, tests, CI workflows, icon and docs from scratch for whatever
> web app that project points at.

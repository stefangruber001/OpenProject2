# Reusable Claude Code agents

## `app-producer` — self-improving

Turns any existing web app / website into a **premium native iOS app**, ships it
to **TestFlight** (fastlane + GitHub Actions), and sets up **autonomous testing**
(Playwright web E2E + Maestro native UI) — driving the CI runs itself until green.
It encodes the full playbook and every hard-won fix (Xcode 26 SDK, base64 `.p8`,
empty-env guard, archive-only signing auth, robust simulator boot, the
Maestro/WKWebView split, …), so it reaches green fast.

**It gets smarter every run.** App Producer keeps a shared, git-backed learnings
ledger in the Template repo (`stefangruber001/Template` →
`learnings/LEARNINGS.md`). On **start** it pulls the ledger and reads every
learning gathered across all the projects it has run in; on **finish** it distils
new `symptom → cause → fix` insights and pushes them back. So every project it
touches teaches it something, and every time you call it, it arrives updated with
all learnings so far. (It never writes secrets, keys, tokens or client-confidential
data into the ledger — only generalizable technical learnings.)

### Use it in THIS project

Just ask, e.g.:

> "Use the App Producer agent to ship the site to TestFlight and set up tests."

Claude routes the task to the agent (or invoke it explicitly via the Agent tool).

### Use it in ANOTHER project / another Claude chat

Agents are files. Copy the definition into the other project:

```bash
# per-project (committed to that repo, shared with the team)
mkdir -p <other-project>/.claude/agents
cp .claude/agents/app-producer.md <other-project>/.claude/agents/

# …or make it available in ALL your projects (user-level)
mkdir -p ~/.claude/agents
cp .claude/agents/app-producer.md ~/.claude/agents/
```

…or bootstrap it (plus any future agents) straight from the Template repo:

```bash
curl -fsSL https://raw.githubusercontent.com/stefangruber001/Template/main/install.sh | bash
```

Then in that project's Claude chat, ask it to "ship this web app to iOS /
TestFlight with tests" — the `app-producer` agent picks it up. It will ask for
the few inputs it needs (app name, bundle id, web app URL, brand colour, Apple
Team ID + App Store Connect key id/issuer; the `.p8` stays local, never pasted),
and it will pull the latest learnings before it starts.

> The single `.md` file **is** the agent — nothing else to install. It regenerates
> the `ios/` project, tests, CI workflows, icon and docs from scratch for whatever
> web app that project points at, and improves itself via the Template ledger.

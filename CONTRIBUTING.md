# Contributing & branching convention

This repo is worked on by two people (Stefan and Ignacio). The rules below keep
us from stepping on each other's toes. New here? Start with
[`docs/onboarding.md`](./docs/onboarding.md).

## Golden rules

1. **Never commit directly to `main`.** It is protected. All changes land via a
   Pull Request.
2. **One branch = one focused change.** Keep branches small and short-lived.
3. **Every PR needs a review from the other person** before it merges.
4. **Pull `main` before you branch, and rebase often** so branches don't drift.
5. **CI must be green.** Lint, types, tests, and build all pass before merge.

## Branch naming

Namespace every branch with your initials so two branches never collide, then a
type, then a short kebab-case description:

```
<initials>/<type>/<short-description>
```

- Stefan → `sg/…`
- Ignacio → `in/…`

**Types**

| Type    | Use for                             |
| ------- | ----------------------------------- |
| `feat`  | new feature or behaviour            |
| `fix`   | bug fix                             |
| `chore` | tooling, deps, config, housekeeping |
| `docs`  | documentation only                  |

**Examples**

```
sg/feat/user-login
in/fix/date-parsing
sg/chore/ci-setup
in/docs/readme-quickstart
```

## Day-to-day workflow

```bash
# 1. Start from the latest main
git checkout main
git pull origin main

# 2. Create your branch
git checkout -b in/feat/user-login

# 3. Work, commit in small steps
git add -p
git commit -m "Add login form"

# 4. Push and open a PR
git push -u origin in/feat/user-login
# ...open the PR on GitHub against main

# 5. Keep up to date while the PR is open
git fetch origin
git rebase origin/main
```

## Before you open a PR

Run the same checks CI runs — if these pass locally, CI should pass:

```bash
pnpm lint && pnpm check-types && pnpm test && pnpm build
```

A pre-commit hook auto-formats staged files, so formatting never shows up in
review. The PR template will prompt you for the what/why, changes, and how to
test.

## Merging

- Use **Squash and merge** to keep `main` history clean (one commit per PR).
- **Delete the branch** after merge (GitHub offers a button).
- The PR author merges once it's approved and checks are green.

## Commit messages

Short imperative summary line, e.g. `Add login form validation`. Add a body if
the "why" isn't obvious from the diff.

## Making significant decisions

Changing the stack, the data model in a big way, or another architecturally
significant choice? Write a short [ADR](./docs/adr/) in the same PR so the
reasoning is recorded.

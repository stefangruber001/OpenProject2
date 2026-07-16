# Contributing & branching convention

This repo is worked on by two people (Stefan and Ignacio). The rules below keep
us from stepping on each other's toes.

## Golden rules

1. **Never commit directly to `main`.** It is protected. All changes land via a
   Pull Request.
2. **One branch = one focused change.** Keep branches small and short-lived.
3. **Every PR needs a review from the other person** before it merges.
4. **Pull `main` before you branch, and rebase often** so branches don't drift.

## Branch naming

Namespace every branch with your initials so two branches never collide, then a
type, then a short kebab-case description:

```
<initials>/<type>/<short-description>
```

- Stefan → `sg/…`
- Ignacio → `in/…`

**Types**

| Type    | Use for                                  |
|---------|------------------------------------------|
| `feat`  | new feature or behaviour                 |
| `fix`   | bug fix                                  |
| `chore` | tooling, deps, config, housekeeping      |
| `docs`  | documentation only                       |

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

## Merging

- Use **Squash and merge** to keep `main` history clean (one commit per PR).
- **Delete the branch** after merge (GitHub offers a button).
- The PR author merges once it's approved and checks are green.

## Commit messages

Short imperative summary line, e.g. `Add login form validation`. Add a body if
the "why" isn't obvious from the diff.

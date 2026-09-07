# RELEASES — what is in production, and how to go back

Production follows the `:main` tag of two images in GHCR. The VPS pulls them
every 60 seconds; there is no SSH step and no inbound port. **Rolling back is
re-pointing that tag**, which is what `deploy.yml` was built around.

| Version  | Commit    | Date       | What it is                                                                |
| -------- | --------- | ---------- | ------------------------------------------------------------------------- |
| **v101** | `6ba1850` | 2026-08-10 | CANEI CRM v4, sessions S1–S15 — all 29 subsecciones, mobile, iOS contract |
| **v100** | `8b22095` | 2026-08-10 | The state before the v4 programme landed: mailbox feature, English chrome |

v101 was promoted by deploy run `31358917862`: both images built, the `smoke`
job ran the migrations and drove the ERP end to end inside the published image,
and only then did `promote` re-point `:main`.

Confirmed live: `/api/health` over the public address reports `status ok`,
`database connected`, revision `6ba1850…`. **The VPS serves v101.**

> **A wrong turn, kept on the record.** When the phone showed a 404 on every
> screen, this file briefly said the VPS had failed to pull the release — the
> deploy history made a silently-stale server the likely suspect, and the Next
> 404 fitted it. It was wrong: the box was current the whole time, and the
> operator was sent to run `ops/deploy-now.sh` against a server that needed
> nothing. `/api/health` answers "is the server current?" in one request from
> any phone, and it is the FIRST thing to check, not the confirmation of a
> theory formed without it. The real fault was in the app — see below.

## TestFlight build 12 — the site worker's tab bar

**1.1 build 12**, from `38adc51`, uploaded 2026-09-05 03:25 and processed.

The hours redesign itself does NOT need it: the shell loads the live URL, so
both the office's three tabs and the site worker's two screens reach an older
build on the next launch. What needs a binary is `nav.json`, which is bundled —
and it now carries a second tab set. A `site` account gets ONE tab, «Horas /
Hores / Hours», generated from the same `SECTIONS` and the same dictionary as
the other six.

The bar follows the role a launch late, because the shell draws it before the
first request completes. That is deliberate and it is safe here for a reason
worth writing down rather than assuming: a tab is a URL into the web app, the
web app sends a site worker back to the hours screen from every route, and the
server refuses every write the account may not make. A stale bar is untidy, not
open.

## The iOS app against v101

**Install v1.1 build 8** (`becd9f9`, uploaded 2026-08-10 06:23). Builds 6 and 7
are on TestFlight and **should not be used**: every tab but Guide answers 404 in
them, against a perfectly healthy server.

`WebTab.url` built each tab's address with `appendingPathComponent`, which
treats its argument as one path segment and therefore percent-encodes anything
illegal in one — including `#`. 1.1 was the release that moved the tabs off
standalone pages and onto the ERP shell's hash routes, so it was the first
release with a `#` for that call to bite on:

    what shipped    /workspace/erp.html%23tower   → 404
    what was meant  /workspace/erp.html           → 200, shell opens #tower

Guide survived because it is the only tab whose path has no fragment. Build 8
resolves the path with `URL(string:relativeTo:)`, which treats a fragment as a
fragment and never sends it to the server. `tests/ios-routes/coverage.mjs` now
guards it on every push — in Node rather than Swift, because what usually breaks
a tab is a page renamed in `site/`, which is not an iOS change and would never
trigger the macOS build.

Two earlier steps are worth keeping for the record. Build 6 (04:43, from the
programme branch head `136b131`) was the first post-S15 shell. The first rebuild
from `main` failed on Apple's certificate cap — each CI run mints a fresh
signing certificate and the account was full; the operator revoked the stale
CI-minted ones and the re-run went green as build 7, whose only visible change
was the Face ID lock screen's language (Spanish → main's English). The
certificate mechanism and the routine for next time are in
`INTEGRATIONS_PENDING.md`.

## Going back to v100

Two commands, from anywhere with `docker` and a GHCR login:

```sh
BASE=ghcr.io/stefangruber001/openproject2
V100=8b220959b644411b09352adfd6473c2ef8e62f6e

docker buildx imagetools create -t $BASE/app:main     $BASE/app:sha-$V100
docker buildx imagetools create -t $BASE/migrate:main $BASE/migrate:sha-$V100
```

The server picks it up within a minute. Every build ever made publishes a
`sha-<full-sha>` tag, so any past commit can be restored the same way — v100 is
not special, it is just the one worth naming.

### Why this is safe

**The database does not need undoing.** v101 adds exactly one migration,
`0004_erp_users`, and it is purely additive — `CREATE TABLE` plus an index, no
`DROP`, no column removal. Running v100's application against it leaves one
unused table behind and changes nothing else.

**Browser-held ERP state is recoverable.** `site/erp-store.js` writes a one-shot
copy of the pre-migration blob to `state.backup.v<n>` before it upgrades
anybody's data. A browser that has run v101 (state schema v15) still holds its
pre-upgrade shape, so a rollback is a support conversation rather than a loss.

**Anything already invoiced stays invoiced.** Issued invoices are immutable by
design and corrections go through a rectificativa, so no rollback can quietly
rewrite a document a customer has already seen.

## Tags

The git tags `v100` and `v101` could not be pushed from the build environment —
its git proxy rejects tag refs with HTTP 403. To create them from a machine with
normal push rights:

```sh
git tag -a v100 8b220959b644411b09352adfd6473c2ef8e62f6e -m "Before the v4 programme"
git tag -a v101 6ba1850848ceae65532fb305de6bb01f2fbc87b9 -m "CANEI CRM v4, sessions S1-S15"
git push origin v100 v101
```

Nothing depends on the tags existing: the commits and the image `sha-` tags are
the durable record. The tags are a convenience for humans reading `git log`.

## What v101 does NOT change

- **Compliance gates stay shut.** Verifactu is still uncertified and everything
  touching it ships behind `legally_verified: false`. See `LEGAL_REVIEW.md`.
- **Twelve ports still run on fakes** — see `INTEGRATIONS_PENDING.md`.
- **Persistence is unchanged.** Durable multi-user storage is a P2 item.

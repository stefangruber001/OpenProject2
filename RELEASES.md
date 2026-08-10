# RELEASES — what is in production, and how to go back

Production follows the `:main` tag of two images in GHCR. The VPS pulls them
every 60 seconds; there is no SSH step and no inbound port. **Rolling back is
re-pointing that tag**, which is what `deploy.yml` was built around.

| Version  | Commit    | Date       | What it is                                                                |
| -------- | --------- | ---------- | ------------------------------------------------------------------------- |
| **v101** | `6ba1850` | 2026-08-10 | CANEI CRM v4, sessions S1–S15 — all 29 subsecciones, mobile, iOS contract |
| **v100** | `8b22095` | 2026-08-10 | The state before the v4 programme landed: mailbox feature, English chrome  |

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

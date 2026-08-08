# Canei ERP — operations handbook

**For the IT provider taking this system over.** It assumes you are competent
with Linux and Docker and have never seen this project. Everything here is
commands you can paste; nothing requires knowing the application's internals.

Original setup, if you ever need to rebuild from nothing: `docs/HETZNER-SETUP.md`.

---

## 1. What this is

A small ERP for a renovation company: quotes, projects, purchase orders,
supplier bills, invoices, collections. It holds **invoice records and personal
data**, which is why the backup and restore sections matter more than the
uptime sections. An hour of downtime is an inconvenience. A lost invoice
register is a legal problem.

```
                    ┌───────────────────────────────┐
  browser ─────────▶│ Cloudflare (DNS, WAF, Access) │
                    └───────────────┬───────────────┘
                                    │  tunnel, dialled OUT from the server
                                    ▼
  ┌──────────────────── Hetzner VPS, Debian 12 ─────────────────────┐
  │  cloudflared ──▶ app (Next.js, :3000) ──▶ db (PostgreSQL 17)    │
  │                                             │                   │
  │                          nightly 02:30 ─────┘                   │
  │                          pg_dump → age-encrypted → Cloudflare R2 │
  └──────────────────────────────────────────────────────────────────┘
```

**No inbound port is open except SSH.** The tunnel dials out. If you ever find
yourself opening 80 or 443, or adding `ports:` to the compose file, stop —
that is not how this is meant to work and it removes the main security property.

Everything lives in **`/opt/canei-erp`** on the server.

---

## 2. Account inventory

All accounts are owned by **Canei Subirats, S.L.** and billed to their card.
You should hold **named accounts** on each, not shared passwords.

| Service         | What it does                                               | Cost/month | Where to look            |
| --------------- | ---------------------------------------------------------- | ---------- | ------------------------ |
| Hetzner Cloud   | The server (`canei-erp-prod`, CX32, Falkenstein/Nuremberg) | ~€7.05     | console.hetzner.cloud    |
| Hetzner Backups | Whole-server snapshots                                     | ~€1.40     | same, on the server      |
| Cloudflare      | DNS, tunnel, Access login, WAF                             | €0         | dash.cloudflare.com      |
| Cloudflare R2   | Encrypted database backups                                 | ~€0.20     | R2 → `canei-erp-backups` |
| GitHub          | Source, CI, container registry                             | €0         | the repository           |
| **Total**       |                                                            | **~€9**    |                          |

**Credentials** are in the customer's password manager. The critical one is the
**age private key** (`AGE-SECRET-KEY-…`): without it, every backup is
unreadable. It is deliberately not on the server. Confirm you can reach it
**before** you need it.

---

## 3. Daily operations

All commands run from `/opt/canei-erp` on the server.

```bash
# What is running
docker compose -f docker-compose.prod.yml ps

# Logs (add -f to follow)
docker compose -f docker-compose.prod.yml logs app --tail 100
docker compose -f docker-compose.prod.yml logs db --tail 100
docker compose -f docker-compose.prod.yml logs tunnel --tail 100

# Is the app healthy, and can it see the database?
docker compose -f docker-compose.prod.yml exec app \
  node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"

# Restart just the app (safe; the database keeps running)
docker compose -f docker-compose.prod.yml restart app

# Timers
systemctl list-timers 'canei-*'
journalctl -u canei-deploy.service -n 50 --no-pager
journalctl -u canei-backup.service -n 50 --no-pager
```

### Deployment

CI builds images on every push to `main`, pushes them to GHCR, and smoke-tests
them against a real PostgreSQL. The server pulls every 60 seconds via
`canei-deploy.timer`. **Nothing pushes to the server**, which is why there is no
deploy key and no inbound rule.

```bash
# Deploy now instead of waiting for the timer
systemctl start canei-deploy.service
```

### Rolling back

`.env` normally follows the rolling `:main` tag. To pin an older build:

```bash
cd /opt/canei-erp
# find the tag you want (or read the commit SHA from GitHub)
docker image ls | grep canei

nano .env      # IMAGE_APP=ghcr.io/OWNER/REPO/app:sha-<commit>
               # IMAGE_MIGRATE=ghcr.io/OWNER/REPO/migrate:sha-<commit>

systemctl stop canei-deploy.timer     # stop it pulling :main back over you
docker compose -f docker-compose.prod.yml up -d
```

> Migrations do not roll back. If the bad release changed the schema, restoring
> a backup (§5) is the correct move, not pinning an older image.

Remember to put `:main` back and re-enable the timer once fixed.

---

## 4. Backups

Nightly at 02:30 (± up to 10 min), by `canei-backup.timer`:

`pg_dump -Fc` → encrypted with **age** to a public key → uploaded to R2 →
anything older than 30 days pruned.

The dump is encrypted to a key whose private half is **not on the server**, so
whoever compromises the box still cannot read the invoice history.

```bash
# Run one now
systemctl start canei-backup.service
journalctl -u canei-backup.service -n 30 --no-pager

# What is in R2
./ops/restore.sh --list
```

The script **refuses to upload a dump under 4 KB**, so a broken backup cannot
quietly rotate a good one out of retention.

### The monthly drill

GitHub Actions → **Restore drill** runs on the 1st of each month. It pulls the
newest backup, decrypts it, restores it into a scratch database and asserts:
the table count, that the migration ledger is populated, that the newest backup
is under 48h old, and **that row-level security survived the restore** (without
it, a restored database would show every tenant's data to every tenant).

**A red badge on that workflow means the company currently has no proven
recoverable copy of its data.** Treat it as a production incident, not a chore.

---

## 5. Restoring

**This overwrites live data.** The script makes you type the database name first.

```bash
cd /opt/canei-erp

# 1. Put the age PRIVATE key on the server, temporarily
nano age-key.txt          # paste AGE-SECRET-KEY-… from the password manager

# 2. Restore (newest, or name one from --list)
./ops/restore.sh
./ops/restore.sh canei-erp-2026-08-07T02-30-11Z.dump.age

# 3. Verify, then DELETE the key
rm -f age-key.txt
```

Afterwards: check `/api/health` reports `database: connected`, and have someone
at Canei confirm the most recent invoices they remember are present.

---

## 6. Alert catalogue

| Symptom                                | Means                                | First three checks                                                                                 |
| -------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Cloudflare **error 1033**              | Tunnel connector is down             | `logs tunnel`; `docker compose … up -d tunnel`; is the token still valid in Cloudflare Zero Trust? |
| **502 / 521**                          | App container down or unhealthy      | `ps`; `logs app --tail 200`; `restart app`                                                         |
| Login loop at Cloudflare Access        | Access policy or session issue       | Zero Trust → Access → Applications → policy still includes the user's email domain?                |
| `migrate` exits non-zero               | Migration failed; app will not start | `logs migrate`; usually a wrong `DATABASE_URL` or a schema conflict; do **not** delete the volume  |
| Health says `"database":"error"`       | App is up, database is not           | `ps db`; `logs db`; disk full? (`df -h`)                                                           |
| Disk above 80%                         | Docker images and Postgres WAL       | `docker system prune -af`; `du -sh /var/lib/docker/*`                                              |
| Backup job failed                      | No new backup tonight                | `journalctl -u canei-backup.service -n 50`; check R2 credentials in `.env`                         |
| Restore drill red                      | **No proven recoverable backup**     | Read the workflow log; run a manual backup; escalate to the customer today                         |
| Deploys stopped                        | Timer dead or registry auth expired  | `systemctl status canei-deploy.timer`; `docker login ghcr.io`                                      |
| Server unreachable, Hetzner console OK | Firewall or SSH restriction          | Hetzner web console → check `ufw status`                                                           |

---

## 7. Routine maintenance (~1–2 h/month)

- **Weekly** — glance at the deploy and backup timers; check disk with `df -h`.
- **Monthly** — confirm the restore drill went green; review and merge the
  dependency-update PRs (CI gates them: lint, types, unit tests, the
  simulations, and a 47-check browser end-to-end suite — if those pass, the
  update is safe to merge).
- **Quarterly** — check the Hetzner and Cloudflare invoices still charge the
  customer's card; confirm the age private key is still retrievable from the
  password manager by someone other than you.
- **Annually** — run the rebuild drill below. Renew the domain.

OS security patches install themselves (`unattended-upgrades`, reboot window
04:00). You do not need to do anything for those, but do check after a kernel
reboot that all four containers came back.

---

## 8. The rebuild drill

This is the exercise that proves the handover is real. Run it once at takeover
and once a year after that.

**Goal:** a working system on a brand-new server, using only this document, the
repository and the backups. Target: **under one hour**.

1. Hetzner → new CX32, Debian 12, same location. Do **not** touch the live one.
2. `git clone` the repo to `/opt/canei-erp` **with credentials** — it is
   private, and an anonymous clone fails with "Repository not found", leaving
   the machine with no compose file and no containers. Then run
   `bash ops/bootstrap-server.sh`. (`ops/provision.sh` avoids this entirely by
   inlining the needed files into cloud-init.)
3. Copy `.env` across (or rebuild it from the password manager — better, since
   that tests the password manager too).
4. Create a **second** Cloudflare tunnel pointed at a temporary hostname, and
   put its token in the new `.env`. Never point two servers at one tunnel.
5. `docker compose -f docker-compose.prod.yml up -d`
6. Restore the newest backup per §5.
7. Confirm the temporary hostname serves the app with the real data.
8. Destroy the test server and the temporary tunnel.

**If any step needed knowledge that was not in this document, add it to this
document and run the drill again.** That gap is the whole point of the exercise.

---

## 9. Escalation

| Layer                                 | Who                                                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application behaviour, bugs, features | The customer decides; changes go through a pull request on the repository, never edited on the server                                                                                                                     |
| Server, Docker, backups, restores     | You                                                                                                                                                                                                                       |
| Hetzner outage                        | status.hetzner.com → Hetzner support ticket                                                                                                                                                                               |
| Cloudflare outage                     | cloudflarestatus.com                                                                                                                                                                                                      |
| Lost age private key                  | **Unrecoverable.** Every existing backup becomes unreadable. Generate a new key immediately, update `BACKUP_AGE_RECIPIENT` in `.env` and `BACKUP_AGE_PRIVATE_KEY` in GitHub secrets, and take a fresh backup the same day |

Never edit application code on the server. The container is rebuilt from
`main` on every deploy, so anything changed in place is silently reverted
within 60 seconds — and the change exists nowhere in the history.

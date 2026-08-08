# Interim: GitHub + Hetzner, no Cloudflare yet

For running the ERP before the customer has agreed to Cloudflare. Everything
works; the server is simply **private** instead of published.

---

## The thing to understand first

**The application has no login of its own.** No middleware, no auth library, no
password screen — verified in `apps/web`. Cloudflare Access was going to be the
entire authentication layer.

That leads to one rule for this interim period:

> **Do not open ports 80 or 443.** A published server with no authentication is
> the customer's invoice register on the open internet, findable by anyone
> scanning the IPv4 space — which is everyone, constantly.

So the interim setup keeps the server closed and reaches it over SSH. That is
not a compromise: it is genuinely more secure than the Cloudflare setup, just
less convenient.

|                  | Interim (now)                   | With Cloudflare (later)                  |
| ---------------- | ------------------------------- | ---------------------------------------- |
| Who can reach it | You, over SSH                   | Anyone with a `@caneisubirats.com` email |
| Login            | None needed — nothing is public | Cloudflare Access, email code            |
| Open ports       | SSH only                        | SSH only                                 |
| Public URL       | none                            | `https://erp.caneisubirats.com`          |
| Backups          | Encrypted, **on the server**    | Encrypted, **off-site** in R2            |
| Restore drill    | Not possible yet                | Monthly, automated                       |
| Cost             | ~€8.45/mo                       | ~€8.65/mo                                |

**The one real gap is off-site backups.** Until R2 exists, the encrypted dumps
sit on the same machine as the database. Hetzner's own snapshots are the second
copy, so a disk or instance failure is survivable — but losing the Hetzner
account or region would take both. Acceptable while the data is test data.
**Not acceptable once Canei enters a real invoice.**

---

## Provisioning

You have already created the Hetzner account and the `canei-erp` project. The
rest is one command.

```bash
cp ops/provision.conf.example ops/provision.conf
$EDITOR ops/provision.conf
```

Only two values matter in this mode — leave everything Cloudflare blank:

```bash
HCLOUD_TOKEN="..."                        # Hetzner → Security → API tokens (Read & Write)
GITHUB_REPO="stefangruber001/OpenProject2"
```

Then:

```bash
SKIP_CLOUDFLARE=1 ./ops/provision.sh
```

It creates the SSH key, the firewall (inbound SSH only), and a server that
installs Docker, the app, PostgreSQL, automatic security patching, auto-deploy
and nightly encrypted local backups **while it boots**. You do not log in to
set anything up.

Takes about 10 minutes, most of it waiting for cloud-init.

---

## Reaching it

An SSH tunnel forwards the app to your own machine:

```bash
ssh -i ops/.provisioned/id_ed25519 -L 3000:localhost:3000 root@<SERVER_IP>
```

Leave that running, then open **http://localhost:3000**. The forwarding lasts
as long as the SSH session.

To show the customer, screen-share it. If you need them to click around it
themselves, that is the point at which Cloudflare becomes worth the
conversation — see below.

---

## Checking on it

```bash
ssh -i ops/.provisioned/id_ed25519 root@<SERVER_IP>
cd /opt/canei-erp

docker compose -f docker-compose.prod.yml ps          # db, migrate (exited 0), app
docker compose -f docker-compose.prod.yml logs app --tail 50

# Health, from inside — there is no published port
docker compose -f docker-compose.prod.yml exec app \
  node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"

systemctl list-timers 'canei-*'                       # deploy + backup
```

Deployment still works exactly as designed: push to `main`, CI builds and
smoke-tests the images, the server pulls them within 60 seconds.

---

## Backups in this mode

`BACKUP_TARGET=local` in `/opt/canei-erp/.env`. Nightly at 02:30: `pg_dump`,
encrypted with age, written to `/opt/canei-erp/backups/`, keeping 30.

Still encrypted to a key whose private half is not on the server, so the dumps
are useless to anyone who gets in.

```bash
systemctl start canei-backup.service
journalctl -u canei-backup.service -n 20 --no-pager
ls -lh /opt/canei-erp/backups/
```

**Turn Hetzner's own backups on** for the server in the console if you did not
at creation — about €1.40/month, and right now it is the only second copy that
exists. Pull a dump down to your laptop occasionally as a third:

```bash
scp -i ops/.provisioned/id_ed25519 \
  root@<SERVER_IP>:/opt/canei-erp/backups/canei-erp-*.dump.age ./
```

---

## Switching Cloudflare on later

About 20 minutes. **No rebuild, no data migration, no downtime worth
mentioning.**

1. Create the Cloudflare account and point the domain at it (guide steps 2).
2. Fill in `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `DOMAIN` in `ops/provision.conf`.
3. Run `./ops/provision.sh` — **without** `SKIP_CLOUDFLARE`. It sees the server
   already exists, leaves it alone, and creates only the tunnel, DNS record,
   Access policy and R2 bucket.
4. Mint the R2 token when it pauses, run it once more.
5. On the server, update `/opt/canei-erp/.env`:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=<from the script output>
   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=canei-erp-backups
   BACKUP_TARGET=r2
   APP_URL=https://erp.caneisubirats.com
   ```
6. Start the tunnel and switch the deploy timer to the profile:
   ```bash
   cd /opt/canei-erp
   docker compose -f docker-compose.prod.yml --profile cloudflare up -d
   sed -i 's|prod.yml pull|prod.yml --profile cloudflare pull|;
           s|prod.yml up -d|prod.yml --profile cloudflare up -d|' \
     /etc/systemd/system/canei-deploy.service
   systemctl daemon-reload
   ```
7. Push the existing local backups into R2 so history is not lost:
   ```bash
   set -a; . ./.env; set +a
   AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY \
     aws s3 cp ./backups/ "s3://$R2_BUCKET/" --recursive \
     --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
   ```
8. Run the **Restore drill** workflow in GitHub. Green means recoverable.

The database, the images and the whole application are untouched throughout —
only how traffic arrives and where backups land change.

---

## If the customer says no to Cloudflare

Then something else has to provide the two things it was doing: **a way in**
and **a login**. The realistic options, in order of how much work they are:

1. **Another zero-trust proxy** — Tailscale Funnel, or a Bunny/Fastly setup.
   Same shape, different vendor. Cheapest change.
2. **Caddy on the server** with Let's Encrypt and HTTP basic auth. Needs a
   domain pointed at the server's IP and opens 80/443. Basic auth is weak
   (one shared password, no per-user audit) — acceptable for a pilot, not for
   a system holding tax records.
3. **Build authentication into the app.** The right long-term answer, and the
   most work: a users table, sessions, password reset, roles. The engine has no
   permission model at all today (`user` is a free string used only for the
   audit log), so this is a real feature, not a configuration change.

Worth putting to the customer plainly: Cloudflare's free tier is providing the
login, the certificate, the firewall and the DDoS protection for €0. Replacing
it costs either money or development time.

# Server setup — every step you do by hand

> **Most of this is now automated.** `./ops/provision.sh` does steps 3–10 for
> you: the tunnel, DNS, Access policy, R2 bucket, secrets, the server, and the
> GitHub secrets. You need only create the two accounts and mint the tokens.
> **Start with `docs/Canei-ERP-Server-Setup-Guide.pdf`** — about 35 minutes.
>
> This document remains the manual fallback: use it if the script fails, if you
> want to understand what it did, or if you are rebuilding by hand.

Follow this once, top to bottom. Roughly **90 minutes**, most of it waiting.

Everything the repo can automate is already automated; what remains is
account creation, which needs a human with a credit card. Steps are ordered so
nothing blocks on something later.

> **The single most important rule on this page.** Every account below is
> created **in the customer's name** — legal entity `Canei Subirats, S.L.`,
> their billing card, and `sistemas@caneisubirats.com` (or whatever role
> address they use) as the owner. You add _yourself_ afterwards as an admin.
> Doing it the other way round means handover requires a migration, and some
> providers do not permit account transfer at all. This costs nothing today and
> is expensive to undo.

**Running cost: about €9/month.** Hetzner ~€7.05, its backups ~€1.40, R2 ~€0.20,
everything on Cloudflare free.

---

## Before you start

| You need                                 | Where from                                 |
| ---------------------------------------- | ------------------------------------------ |
| Company details for Canei Subirats, S.L. | The customer — legal name, address, CIF    |
| A payment card in the company's name     | The customer                               |
| A role email address                     | e.g. `sistemas@caneisubirats.com`          |
| The domain                               | Either already theirs, or buy it in step 2 |
| A password manager the customer owns     | Bitwarden or 1Password, free tier is fine  |

Create the password manager vault **first** and put every credential in it as
you go. If it only exists in your terminal history, it does not exist.

---

## Step 1 — Hetzner Cloud (~10 min)

1. Go to **console.hetzner.cloud** → _Register_.
   - Register with the **role address**, company name `Canei Subirats, S.L.`,
     company address and CIF. Hetzner will ask for identity verification on new
     accounts — this can take a few hours, so do this step first.
2. Create a project called **`canei-erp`**.
3. **Add Server**:
   - Location: **Falkenstein** or **Nuremberg** (Germany — keeps personal and
     tax data in the EU)
   - Image: **Debian 12**
   - Type: **CX32** — shared vCPU, x86, 4 vCPU / 8 GB / 80 GB
   - Volumes / networks: none
   - **Backups: ON** (this is the ~€1.40; it is the cheapest insurance here)
   - SSH key: paste your public key (`cat ~/.ssh/id_ed25519.pub`). If you have
     none: `ssh-keygen -t ed25519`
   - Name: `canei-erp-prod`
4. Note the server's **IPv4 address** → password manager.

> Choosing x86 (CX32) over the cheaper ARM CAX21 is deliberate: it avoids
> cross-architecture image builds, which is one less thing to explain to
> whoever inherits this. The difference is about €0.50/month.

---

## Step 2 — Cloudflare account and domain (~15 min)

1. **dash.cloudflare.com** → _Sign up_, again with the **role address**.
2. Decide the hostname. Suggested: **`erp.caneisubirats.com`**.
3. Add the domain:
   - **Already registered elsewhere?** _Add a site_ → follow the instructions →
     change the nameservers at the current registrar to the two Cloudflare
     gives you. Propagation takes up to 24h; carry on with the other steps
     meanwhile.
   - **Not registered?** _Domain Registration_ → _Register Domain_. Simplest,
     since it lands in the right account already.
4. Under **SSL/TLS → Overview**, set encryption mode to **Full (strict)**.

---

## Step 3 — Cloudflare Tunnel (~10 min)

This is what lets the server have **no open ports at all**.

1. **Zero Trust** (left sidebar) → the first visit asks you to pick a team name
   and a plan → choose **Free**.
2. **Networks → Tunnels → Create a tunnel** → _Cloudflared_ → name it
   `canei-erp-prod`.
3. On the "Install and run a connector" screen, **copy the token** — the long
   string after `--token` in the shown command. → password manager, and into
   `.env` as `CLOUDFLARE_TUNNEL_TOKEN` in step 6.
4. **Public Hostnames → Add a public hostname**:
   - Subdomain `erp`, Domain `caneisubirats.com`
   - Service type **HTTP**, URL **`app:3000`**
     (`app` is the compose service name — the tunnel resolves it on the Docker
     network, which is why nothing needs to be published to the host.)
5. Save.

---

## Step 4 — Cloudflare Access (~5 min)

Puts a login in front of the ERP so it is not simply public.

1. **Zero Trust → Access → Applications → Add an application → Self-hosted**
2. Name `Canei ERP`, session duration 24h, domain `erp.caneisubirats.com`
3. **Add policy**: name `Staff`, action **Allow**, include
   **Emails ending in** `@caneisubirats.com` (plus your own address while you
   are still working on it — and remove it at handover).
4. Save. Visiting the URL now asks for an email code before the app is reached.

---

## Step 5 — Cloudflare R2 for backups (~10 min)

1. **R2 → Create bucket** → name `canei-erp-backups`, location **EU**.
2. **R2 → Manage API tokens → Create API token**:
   - Permission **Object Read & Write**
   - Scope it to **this bucket only** — not "all buckets"
   - Save the **Access Key ID**, **Secret Access Key** and your **Account ID**
     → password manager
3. Generate the backup encryption key **on your own machine**:
   ```
   age-keygen -o canei-backup-key.txt
   ```
   - The line starting `age1…` (public) → `.env` as `BACKUP_AGE_RECIPIENT`
   - The line starting `AGE-SECRET-KEY-…` (private) → **password manager only**
   - Do **not** put the private key on the server. A backup that the server
     itself can decrypt is no protection against that server being compromised.

---

## Step 6 — Bring the server up (~20 min)

SSH in as root using the IP from step 1:

```bash
ssh root@<SERVER_IP>

apt-get update && apt-get install -y git
git clone https://github.com/<OWNER>/<REPO>.git /opt/canei-erp
cd /opt/canei-erp
bash ops/bootstrap-server.sh
```

That installs Docker, turns on automatic security patching with a 04:00 reboot
window, sets the firewall to deny everything inbound except SSH, and installs
the deploy and backup timers. It takes a few minutes and prints the remaining
steps when it finishes.

Then create the configuration:

```bash
cp .env.production.example .env
nano .env
```

Fill in every `CHANGE_ME`:

| Key                           | Value                                                      |
| ----------------------------- | ---------------------------------------------------------- |
| `POSTGRES_PASSWORD`           | `openssl rand -base64 32` — also into the password manager |
| `APP_URL`                     | `https://erp.caneisubirats.com`                            |
| `IMAGE_APP` / `IMAGE_MIGRATE` | replace `OWNER/REPO` with the real repo path               |
| `CLOUDFLARE_TUNNEL_TOKEN`     | from step 3                                                |
| `R2_*`                        | from step 5                                                |
| `BACKUP_AGE_RECIPIENT`        | the `age1…` public key from step 5                         |

If the repository is private, authenticate to the image registry once
(a GitHub token with `read:packages` is enough):

```bash
docker login ghcr.io -u <github-username>
```

Start it:

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Expect `db` healthy, `migrate` exited **(0)**, `app` healthy, `tunnel` running.

---

## Step 7 — GitHub configuration (~10 min)

In the repository → **Settings**:

**Secrets and variables → Actions → Variables** → _New variable_:

| Name      | Value                           |
| --------- | ------------------------------- |
| `APP_URL` | `https://erp.caneisubirats.com` |

**Secrets** → _New repository secret_ (these are for the monthly restore drill):

| Name                     | Value                             |
| ------------------------ | --------------------------------- |
| `R2_ACCOUNT_ID`          | from step 5                       |
| `R2_ACCESS_KEY_ID`       | from step 5                       |
| `R2_SECRET_ACCESS_KEY`   | from step 5                       |
| `R2_BUCKET`              | `canei-erp-backups`               |
| `BACKUP_AGE_PRIVATE_KEY` | the whole `AGE-SECRET-KEY-…` line |

Then push to `main` (or run **Actions → Deploy → Run workflow**). It builds both
images, pushes them to GHCR, and smoke-tests them against a real PostgreSQL
before the server is allowed to pull anything.

---

## Step 8 — Turn on automatic deployment (~2 min)

Only after step 7 has produced images successfully:

```bash
systemctl enable --now canei-deploy.timer
systemctl list-timers canei-*
```

The server now checks for new images every 60 seconds. There is no SSH from CI
and no inbound port — the box pulls, nothing pushes to it.

---

## Step 9 — Prove the backups work, today (~10 min)

Do not skip this. A backup nobody has restored is a hope, not a backup.

```bash
systemctl start canei-backup.service
journalctl -u canei-backup.service -n 30 --no-pager
```

Expect `[backup] OK — canei-erp-….dump.age`. Confirm the object exists in the
R2 bucket in the Cloudflare dashboard.

Then run **Actions → Restore drill → Run workflow** in GitHub. It downloads
that backup, decrypts it, restores it into a scratch database and checks the
tables, the migration ledger, and that row-level security survived the restore.
**Green means the company is recoverable. Red means it is not.**

---

## Step 10 — Close the door behind you (~5 min)

```bash
# Restrict SSH to your own address (find it: curl -s ifconfig.me)
ufw allow from <YOUR_IP> to any port 22 proto tcp
ufw delete allow 22/tcp
ufw status verbose
```

Final checks:

- `https://erp.caneisubirats.com` asks for an email code, then loads the app
- `https://erp.caneisubirats.com/api/health` → `"database":"connected"`
- `http://<SERVER_IP>` in a browser → **must time out.** If it loads, something
  published a port and that needs fixing before you go any further.

---

## When you hand over

1. Give the IT provider `docs/HANDOVER-OPS.md` and their own named accounts on
   Hetzner, Cloudflare and GitHub.
2. Run the rebuild drill in that document **with them**, onto a throwaway
   server. That is the real handover; the paperwork is secondary.
3. Transfer the password-manager vault to the customer.
4. Remove your address from the Cloudflare Access policy, and your user from
   Hetzner, Cloudflare and the GitHub repo.
5. Confirm the card on file is the customer's, on all three accounts.

---

## If something goes wrong

| Symptom                          | Look at                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Site shows Cloudflare error 1033 | Tunnel is down: `docker compose -f docker-compose.prod.yml logs tunnel`                |
| Site shows 502                   | App is down: `… logs app`                                                              |
| `migrate` exited non-zero        | `… logs migrate` — usually a bad `DATABASE_URL`                                        |
| Deploys stopped arriving         | `systemctl status canei-deploy.timer`, then `journalctl -u canei-deploy.service -n 50` |
| Backup job failing               | `journalctl -u canei-backup.service -n 50`                                             |

Full operational detail, including rollback, lives in `docs/HANDOVER-OPS.md`.

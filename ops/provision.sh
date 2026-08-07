#!/usr/bin/env bash
# =============================================================================
# One-command provisioning. Run from your laptop, not from a server.
#
#   ./ops/provision.sh
#
# It creates: the Cloudflare tunnel, the DNS record, the Access login policy,
# the R2 backup bucket, the encryption keys, the database password, and a
# Hetzner server that boots already configured and already serving.
#
# You do NOT ssh in. You do NOT edit .env by hand. cloud-init does all of it
# while the server is still booting.
#
# What this script cannot do, because it needs a human with a credit card:
#   • create the Hetzner account            → console.hetzner.cloud
#   • create the Cloudflare account         → dash.cloudflare.com
#   • point the domain at Cloudflare        → your registrar
#   • mint the two API tokens it asks for   → see docs/SETUP-GUIDE.pdf
#
# Safe to re-run: everything is create-if-absent. It will not replace a server
# that already exists — delete it first if you really mean to start over.
# =============================================================================
set -euo pipefail

say()  { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null || die "Missing '$1'. Install it and re-run. ($2)"; }
need curl "brew install curl / apt install curl"
need jq   "brew install jq / apt install jq"
need age  "brew install age / apt install age"
need ssh-keygen "part of openssh"

CONF="${CONF:-ops/provision.conf}"
if [ -f "$CONF" ]; then
  say "Reading $CONF"
  # shellcheck disable=SC1090
  set -a; . "./$CONF"; set +a
else
  cat >&2 <<EOF

No $CONF found. Create it from the template:

    cp ops/provision.conf.example ops/provision.conf
    \$EDITOR ops/provision.conf

It holds the two API tokens and four settings. It is gitignored.
EOF
  exit 1
fi

: "${HCLOUD_TOKEN:?set HCLOUD_TOKEN in $CONF}"

# SKIP_CLOUDFLARE=1 builds a PRIVATE server: no tunnel, no DNS, no login, no
# off-site backups. Reachable only over an SSH tunnel from your own machine.
# The right mode while the Cloudflare decision is still open, because the app
# has no authentication of its own — see docs/INTERIM-HETZNER-ONLY.md.
SKIP_CLOUDFLARE="${SKIP_CLOUDFLARE:-0}"
if [ "$SKIP_CLOUDFLARE" != "1" ]; then
  : "${CF_API_TOKEN:?set CF_API_TOKEN in $CONF (or SKIP_CLOUDFLARE=1)}"
  : "${CF_ACCOUNT_ID:?set CF_ACCOUNT_ID in $CONF (or SKIP_CLOUDFLARE=1)}"
  : "${DOMAIN:?set DOMAIN in $CONF (or SKIP_CLOUDFLARE=1)}"
fi
DOMAIN="${DOMAIN:-local}"
: "${HOSTNAME_PREFIX:=erp}"
: "${ACCESS_EMAIL_DOMAIN:=$DOMAIN}"
: "${GITHUB_REPO:?set GITHUB_REPO in $CONF (e.g. owner/repo)}"
: "${SERVER_NAME:=canei-erp-prod}"
: "${SERVER_TYPE:=cx32}"
: "${SERVER_LOCATION:=fsn1}"
: "${R2_BUCKET:=canei-erp-backups}"

FQDN="${HOSTNAME_PREFIX}.${DOMAIN}"
OUT="ops/.provisioned"; mkdir -p "$OUT"

CF="https://api.cloudflare.com/client/v4"
cf() { # cf METHOD PATH [JSON]
  local m="$1" p="$2" body="${3:-}"
  local args=(-sS -X "$m" "$CF$p" -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")
  [ -n "$body" ] && args+=(-d "$body")
  local r; r="$(curl "${args[@]}")"
  if [ "$(jq -r '.success' <<<"$r")" != "true" ]; then
    printf '%s\n' "$r" | jq . >&2; die "Cloudflare API call failed: $m $p"
  fi
  printf '%s' "$r"
}
hz() { # hz METHOD PATH [JSON]
  local m="$1" p="$2" body="${3:-}"
  local args=(-sS -X "$m" "https://api.hetzner.cloud/v1$p" -H "Authorization: Bearer $HCLOUD_TOKEN" -H "Content-Type: application/json")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}

# ── 0. Validate the tokens before creating anything ─────────────────────────
say "Checking API tokens"
[ "$SKIP_CLOUDFLARE" = "1" ] || { cf GET "/user/tokens/verify" >/dev/null && info "Cloudflare token OK"; }
hz GET "/servers?per_page=1" | jq -e '.servers' >/dev/null 2>&1 \
  || die "Hetzner token rejected. Check HCLOUD_TOKEN (it must be Read & Write)."
info "Hetzner token OK"

if [ "$SKIP_CLOUDFLARE" = "1" ]; then
  say "Cloudflare SKIPPED — building a private server"
  info "no tunnel, no DNS, no login page, no off-site backups"
  info "reachable only over an SSH tunnel; see docs/INTERIM-HETZNER-ONLY.md"
  FQDN="localhost:3000"
  TUNNEL_TOKEN=""
  R2_ACCOUNT_ID=""; R2_ACCESS_KEY_ID=""; R2_SECRET_ACCESS_KEY=""
  BACKUP_TARGET="local"
else
  BACKUP_TARGET="r2"
  ZONE_ID="$(cf GET "/zones?name=${DOMAIN}" | jq -r '.result[0].id // empty')"
  [ -n "$ZONE_ID" ] || die "Domain '${DOMAIN}' is not in this Cloudflare account yet. Add it first (docs step 2)."
  info "Zone ${DOMAIN} → ${ZONE_ID}"
fi

# ── 1. Secrets, generated locally ───────────────────────────────────────────
say "Generating secrets"
if [ ! -f "$OUT/age-key.txt" ]; then
  age-keygen -o "$OUT/age-key.txt" 2>/dev/null
  chmod 600 "$OUT/age-key.txt"
  info "age keypair created"
else
  info "age keypair already present, reusing"
fi
AGE_PUB="$(grep -oE 'age1[a-z0-9]+' "$OUT/age-key.txt" | head -1)"
AGE_PRIV="$(grep '^AGE-SECRET-KEY-' "$OUT/age-key.txt")"

[ -f "$OUT/pg-password" ] || { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 40 > "$OUT/pg-password"; }
PG_PASSWORD="$(cat "$OUT/pg-password")"

if [ ! -f "$OUT/id_ed25519" ]; then
  ssh-keygen -t ed25519 -N "" -C "canei-erp-provision" -f "$OUT/id_ed25519" >/dev/null
  info "SSH keypair created"
fi
SSH_PUB="$(cat "$OUT/id_ed25519.pub")"

if [ "$SKIP_CLOUDFLARE" != "1" ]; then
# ── 2. Cloudflare tunnel ────────────────────────────────────────────────────
say "Cloudflare tunnel"
TUNNEL_ID="$(cf GET "/accounts/${CF_ACCOUNT_ID}/cfd_tunnel?name=${SERVER_NAME}&is_deleted=false" \
             | jq -r '.result[0].id // empty')"
if [ -z "$TUNNEL_ID" ]; then
  TUNNEL_ID="$(cf POST "/accounts/${CF_ACCOUNT_ID}/cfd_tunnel" \
    "$(jq -nc --arg n "$SERVER_NAME" '{name:$n, config_src:"cloudflare"}')" | jq -r '.result.id')"
  info "created tunnel ${TUNNEL_ID}"
else
  info "tunnel already exists: ${TUNNEL_ID}"
fi
TUNNEL_TOKEN="$(cf GET "/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/token" | jq -r '.result')"

# Route the hostname at the app container. `app` resolves on the compose
# network, which is why nothing has to be published to the host.
cf PUT "/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  "$(jq -nc --arg h "$FQDN" '{config:{ingress:[
      {hostname:$h, service:"http://app:3000"},
      {service:"http_status:404"}]}}')" >/dev/null
info "ingress ${FQDN} → http://app:3000"

# ── 3. DNS ──────────────────────────────────────────────────────────────────
say "DNS record"
REC_ID="$(cf GET "/zones/${ZONE_ID}/dns_records?name=${FQDN}" | jq -r '.result[0].id // empty')"
DNS_BODY="$(jq -nc --arg n "$HOSTNAME_PREFIX" --arg c "${TUNNEL_ID}.cfargotunnel.com" \
  '{type:"CNAME", name:$n, content:$c, proxied:true}')"
if [ -z "$REC_ID" ]; then
  cf POST "/zones/${ZONE_ID}/dns_records" "$DNS_BODY" >/dev/null; info "created CNAME ${FQDN}"
else
  cf PUT "/zones/${ZONE_ID}/dns_records/${REC_ID}" "$DNS_BODY" >/dev/null; info "updated CNAME ${FQDN}"
fi

# ── 4. Access policy ────────────────────────────────────────────────────────
say "Cloudflare Access (login in front of the ERP)"
APP_ID="$(cf GET "/accounts/${CF_ACCOUNT_ID}/access/apps" \
          | jq -r --arg d "$FQDN" '.result[]? | select(.domain==$d) | .id' | head -1)"
if [ -z "$APP_ID" ]; then
  APP_ID="$(cf POST "/accounts/${CF_ACCOUNT_ID}/access/apps" \
    "$(jq -nc --arg d "$FQDN" '{name:"Canei ERP", domain:$d, type:"self_hosted", session_duration:"24h"}')" \
    | jq -r '.result.id')"
  cf POST "/accounts/${CF_ACCOUNT_ID}/access/apps/${APP_ID}/policies" \
    "$(jq -nc --arg e "$ACCESS_EMAIL_DOMAIN" \
      '{name:"Staff", decision:"allow", include:[{email_domain:{domain:$e}}]}')" >/dev/null
  info "created Access app + Staff policy (@${ACCESS_EMAIL_DOMAIN})"
else
  info "Access app already exists: ${APP_ID}"
fi

# ── 5. R2 bucket ────────────────────────────────────────────────────────────
say "R2 backup bucket"
if cf GET "/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}" >/dev/null 2>&1; then
  info "bucket ${R2_BUCKET} already exists"
else
  cf POST "/accounts/${CF_ACCOUNT_ID}/r2/buckets" \
    "$(jq -nc --arg n "$R2_BUCKET" '{name:$n, locationHint:"eeur"}')" >/dev/null
  info "created bucket ${R2_BUCKET}"
fi

if [ -z "${R2_ACCESS_KEY_ID:-}" ] || [ -z "${R2_SECRET_ACCESS_KEY:-}" ]; then
  cat >&2 <<EOF

  ────────────────────────────────────────────────────────────────────────
  One manual step left before the server can back itself up.

  R2 API tokens cannot be minted reliably through the API, so:

    dash.cloudflare.com → R2 → Manage API tokens → Create API token
      • Permission:  Object Read & Write
      • Scope:       ONLY the bucket "${R2_BUCKET}"

  Put the two values in ${CONF}:

      R2_ACCESS_KEY_ID="..."
      R2_SECRET_ACCESS_KEY="..."

  Then run this script again. Everything above is already done and will be
  skipped.
  ────────────────────────────────────────────────────────────────────────
EOF
  exit 2
fi
info "R2 credentials present"
fi   # end SKIP_CLOUDFLARE guard

# ── 6. The server, booting pre-configured ───────────────────────────────────
say "Hetzner server"
SSH_KEY_ID="$(hz GET "/ssh_keys?name=canei-erp" | jq -r '.ssh_keys[0].id // empty')"
if [ -z "$SSH_KEY_ID" ]; then
  SSH_KEY_ID="$(hz POST "/ssh_keys" "$(jq -nc --arg k "$SSH_PUB" '{name:"canei-erp", public_key:$k}')" \
                | jq -r '.ssh_key.id')"
  info "uploaded SSH key ${SSH_KEY_ID}"
fi

FW_ID="$(hz GET "/firewalls?name=canei-erp" | jq -r '.firewalls[0].id // empty')"
if [ -z "$FW_ID" ]; then
  # Inbound: SSH only. The app is reached through the tunnel, which dials out.
  FW_ID="$(hz POST "/firewalls" "$(jq -nc '{
      name:"canei-erp",
      rules:[{direction:"in", protocol:"tcp", port:"22", source_ips:["0.0.0.0/0","::/0"],
              description:"SSH — narrow this to your own IP once provisioned"}]}')" \
           | jq -r '.firewall.id')"
  info "created firewall ${FW_ID} (inbound: SSH only)"
fi

EXISTING="$(hz GET "/servers?name=${SERVER_NAME}" | jq -r '.servers[0].public_net.ipv4.ip // empty')"
if [ -n "$EXISTING" ]; then
  info "server ${SERVER_NAME} already exists at ${EXISTING} — not touching it"
  SERVER_IP="$EXISTING"
else
  say "Rendering cloud-init"
  CLOUD_INIT="$(
    sed -e "s|__REPO__|https://github.com/${GITHUB_REPO}.git|g" \
        -e "s|__PG_PASSWORD__|${PG_PASSWORD}|g" \
        -e "s|__APP_URL__|https://${FQDN}|g" \
        -e "s|__IMAGE_APP__|ghcr.io/${GITHUB_REPO}/app:main|g" \
        -e "s|__IMAGE_MIGRATE__|ghcr.io/${GITHUB_REPO}/migrate:main|g" \
        -e "s|__TUNNEL_TOKEN__|${TUNNEL_TOKEN}|g" \
        -e "s|__R2_ACCOUNT_ID__|${CF_ACCOUNT_ID}|g" \
        -e "s|__R2_ACCESS_KEY_ID__|${R2_ACCESS_KEY_ID}|g" \
        -e "s|__R2_SECRET__|${R2_SECRET_ACCESS_KEY}|g" \
        -e "s|__R2_BUCKET__|${R2_BUCKET}|g" \
        -e "s|__AGE_PUB__|${AGE_PUB}|g" \
        -e "s|__BACKUP_TARGET__|${BACKUP_TARGET}|g" \
        -e "s|__COMPOSE_PROFILE__|$([ "$SKIP_CLOUDFLARE" = "1" ] && echo "" || echo "--profile cloudflare")|g" \
        ops/cloud-init.yaml
  )"
  say "Creating ${SERVER_NAME} (${SERVER_TYPE}, ${SERVER_LOCATION})"
  RESP="$(hz POST "/servers" "$(jq -nc \
      --arg n "$SERVER_NAME" --arg t "$SERVER_TYPE" --arg l "$SERVER_LOCATION" \
      --arg u "$CLOUD_INIT" --argjson k "$SSH_KEY_ID" --argjson f "$FW_ID" \
      '{name:$n, server_type:$t, location:$l, image:"debian-12",
        ssh_keys:[$k], firewalls:[{firewall:$f}], user_data:$u,
        public_net:{enable_ipv4:true, enable_ipv6:true}}')")"
  SERVER_IP="$(jq -r '.server.public_net.ipv4.ip // empty' <<<"$RESP")"
  [ -n "$SERVER_IP" ] || { jq . <<<"$RESP" >&2; die "Server creation failed"; }
  info "server created at ${SERVER_IP}"
  info "cloud-init is now installing Docker and starting the stack (5–10 min)"
fi

# ── 7. Record everything ────────────────────────────────────────────────────
cat > "$OUT/summary.txt" <<EOF
Canei ERP — provisioned $(date -u +%Y-%m-%dT%H:%M:%SZ)

  URL              https://${FQDN}
  Server IP        ${SERVER_IP}
  SSH              ssh -i ops/.provisioned/id_ed25519 root@${SERVER_IP}
  Tunnel ID        ${TUNNEL_ID}
  R2 bucket        ${R2_BUCKET}

PUT THESE IN THE CUSTOMER'S PASSWORD MANAGER, THEN DELETE ops/.provisioned/

  Postgres password    ${PG_PASSWORD}
  age public key       ${AGE_PUB}
  age PRIVATE key      ${AGE_PRIV}
  SSH private key      ops/.provisioned/id_ed25519

Losing the age private key makes every backup permanently unreadable.
EOF
chmod 600 "$OUT/summary.txt"

# ── 8. GitHub secrets for the restore drill ─────────────────────────────────
say "GitHub secrets (for the monthly restore drill)"
if [ "$SKIP_CLOUDFLARE" = "1" ]; then
  info "skipped — the restore drill needs off-site backups, which arrive with Cloudflare R2"
elif command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh variable set APP_URL --repo "$GITHUB_REPO" --body "https://${FQDN}" >/dev/null
  gh secret set R2_ACCOUNT_ID          --repo "$GITHUB_REPO" --body "$CF_ACCOUNT_ID"        >/dev/null
  gh secret set R2_ACCESS_KEY_ID       --repo "$GITHUB_REPO" --body "$R2_ACCESS_KEY_ID"     >/dev/null
  gh secret set R2_SECRET_ACCESS_KEY   --repo "$GITHUB_REPO" --body "$R2_SECRET_ACCESS_KEY" >/dev/null
  gh secret set R2_BUCKET              --repo "$GITHUB_REPO" --body "$R2_BUCKET"            >/dev/null
  gh secret set BACKUP_AGE_PRIVATE_KEY --repo "$GITHUB_REPO" --body "$AGE_PRIV"             >/dev/null
  info "set 1 variable + 5 secrets on ${GITHUB_REPO}"
else
  info "GitHub CLI not available — run these yourself:"
  cat <<EOF

  gh variable set APP_URL --repo $GITHUB_REPO --body "https://${FQDN}"
  gh secret set R2_ACCOUNT_ID          --repo $GITHUB_REPO --body "$CF_ACCOUNT_ID"
  gh secret set R2_ACCESS_KEY_ID       --repo $GITHUB_REPO --body "$R2_ACCESS_KEY_ID"
  gh secret set R2_SECRET_ACCESS_KEY   --repo $GITHUB_REPO --body "<the secret>"
  gh secret set R2_BUCKET              --repo $GITHUB_REPO --body "$R2_BUCKET"
  gh secret set BACKUP_AGE_PRIVATE_KEY --repo $GITHUB_REPO --body "<from ops/.provisioned/age-key.txt>"
EOF
fi

# ── 9. Wait for it to answer ────────────────────────────────────────────────
if [ "$SKIP_CLOUDFLARE" = "1" ]; then
  cat <<EOF

────────────────────────────────────────────────────────────────────────────
Private server is up at ${SERVER_IP}. It is not on the internet.

Reach it from your laptop with an SSH tunnel:

    ssh -i ops/.provisioned/id_ed25519 -L 3000:localhost:3000 root@${SERVER_IP}

…then open  http://localhost:3000  in your browser. The tunnel lives as long
as that ssh session does.

Still to do:
  1. Copy ops/.provisioned/summary.txt into the password manager, then
     rm -rf ops/.provisioned
  2. Check it came up:
       ssh -i ops/.provisioned/id_ed25519 root@${SERVER_IP} \\
         'cd /opt/canei-erp && docker compose -f docker-compose.prod.yml ps'
  3. Narrow SSH: Hetzner console → Firewalls → canei-erp → source <your-ip>/32

When the customer agrees to Cloudflare, see docs/INTERIM-HETZNER-ONLY.md §
"Switching Cloudflare on" — about 20 minutes, no rebuild, no data migration.
────────────────────────────────────────────────────────────────────────────
EOF
  exit 0
fi

say "Waiting for https://${FQDN}/api/health"
info "(cloud-init takes 5–10 minutes on a fresh server; Ctrl-C is safe)"
for i in $(seq 1 90); do
  if curl -fsS --max-time 5 "https://${FQDN}/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
    say "LIVE — https://${FQDN}"
    break
  fi
  printf '.'; sleep 20
done
echo

cat <<EOF

────────────────────────────────────────────────────────────────────────────
Done. What is left for you:

  1. Read ops/.provisioned/summary.txt, copy every secret into the customer's
     password manager, then:  rm -rf ops/.provisioned

  2. Prove the backups work — today, not later:
        ssh -i ops/.provisioned/id_ed25519 root@${SERVER_IP} \\
          'systemctl start canei-backup.service && journalctl -u canei-backup -n 20 --no-pager'
     then run the "Restore drill" workflow in GitHub Actions. Green = the
     company is recoverable.

  3. Narrow SSH to your own address:
        Hetzner console → Firewalls → canei-erp → edit the SSH rule
        source: \$(curl -s ifconfig.me)/32
────────────────────────────────────────────────────────────────────────────
EOF

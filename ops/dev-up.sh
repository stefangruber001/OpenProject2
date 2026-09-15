#!/usr/bin/env bash
# =============================================================================
# Bring up the DEVELOPMENT stack beside production, on the same machine.
#
#   bash /opt/canei-erp/ops/dev-up.sh          (runs ON THE SERVER, as root)
#
# Normally reached through Actions → Ops → target: dev, action: dev-up, because
# nothing here should need a laptop.
#
# IDEMPOTENT. Run it as often as you like. It creates what is missing, leaves
# what exists, and never overwrites a `.env` that is already there — so a re-run
# cannot silently change the password somebody is using or reset a database
# somebody is working in. It finishes by printing the address and the password,
# whether it just made them or found them.
#
# WHAT IT IS CAREFUL ABOUT, AND WHY
#
#   1. THE PROJECT NAME. docker-compose.prod.yml carries `name: canei-erp`.
#      Brought up without an override, the dev stack would land INSIDE the
#      production project — same container names, same volumes — and
#      `up -d --remove-orphans` would delete the production containers it did not
#      recognise. The `.env` written here sets COMPOSE_PROJECT_NAME, the deploy
#      unit refuses to run without it, and this script verifies the resolved name
#      before it starts anything.
#
#   2. THE DISK. One 80 GB disk is shared with production, and the whole purpose
#      of this stack is to be broken. Dev's database lives on a fixed-size
#      loopback filesystem, so filling it breaks dev and leaves production's free
#      space untouched.
#
#   3. THE FRONT DOOR. Production's Caddy grows a second address rather than dev
#      getting its own — two things cannot both bind 443. Caddy will not start on
#      a config it cannot parse, so the config is validated BEFORE it is reloaded.
#      A development feature must not be able to take the real ERP offline.
#
#   4. NO BACKUPS. Deliberately. R2_BUCKET is one repository-wide secret and the
#      monthly restore drill proves THE NEWEST OBJECT in that bucket; a dev dump
#      would make the drill certify dev's backup and report green while
#      production's went unchecked. Dev holds invented data — there is nothing
#      here worth keeping.
# =============================================================================
set -euo pipefail

PROD_DIR="${PROD_DIR:-/opt/canei-erp}"
DEV_DIR="${DEV_DIR:-/opt/canei-erp-dev}"
DEV_DISK_IMG="${DEV_DISK_IMG:-/var/lib/canei-dev-db.img}"
DEV_DISK_MNT="${DEV_DISK_MNT:-/var/lib/canei-dev-db}"
DEV_DISK_SIZE="${DEV_DISK_SIZE:-12G}"
DEV_TENANT="${DEV_TENANT:-reformas-demo}"
DEV_PORT="${DEV_PORT:-3001}"
EDGE_NET="canei-edge"

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
die() {
  printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

[ "$(id -u)" = "0" ] || die "Run as root."
command -v docker >/dev/null || die "docker is not installed."
[ -d "$PROD_DIR" ] || die "$PROD_DIR does not exist — this runs on the ERP server."
[ -f "$PROD_DIR/.env" ] || die "$PROD_DIR/.env is missing; production is not configured."

# The dev hostname is a SIBLING of production's, never a subdomain of it.
# sslip.io answers any name containing an address, so both resolve to this
# machine without a registrar, but neither sits beneath the other. Cookies here
# are host-only anyway (no Domain attribute — see lib/session-token.ts), so this
# is belt and braces rather than the only thing holding.
PROD_HOST="$(sed -n 's/^PUBLIC_HOSTNAME=//p' "$PROD_DIR/.env" | tr -d '"'"'"' ' | head -1)"
[ -n "$PROD_HOST" ] || die "PUBLIC_HOSTNAME is not set in $PROD_DIR/.env."
DEV_HOST="${DEV_HOSTNAME:-dev-${PROD_HOST}}"

say "Development stack on $(hostname)"
info "production : https://${PROD_HOST}"
info "development: https://${DEV_HOST}"

# ── 1 · the shared network ───────────────────────────────────────────────────
say "1/8  Shared network"
if docker network inspect "$EDGE_NET" >/dev/null 2>&1; then
  info "$EDGE_NET exists"
else
  docker network create "$EDGE_NET" >/dev/null
  info "$EDGE_NET created"
fi

# ── 2 · the capped disk ──────────────────────────────────────────────────────
# ext4 in a file, mounted over loop. Considered and rejected: docker's
# storage_opt (needs a storage driver this host does not use), XFS project
# quotas (the filesystem is ext4), a second Hetzner volume (costs money, which is
# the thing running on one box was meant to avoid).
say "2/8  Capped disk for the dev database (${DEV_DISK_SIZE})"
if [ -f "$DEV_DISK_IMG" ]; then
  info "$DEV_DISK_IMG exists — left alone"
else
  fallocate -l "$DEV_DISK_SIZE" "$DEV_DISK_IMG" 2>/dev/null ||
    dd if=/dev/zero of="$DEV_DISK_IMG" bs=1M count=$((${DEV_DISK_SIZE%G} * 1024)) status=none
  mkfs.ext4 -q -F "$DEV_DISK_IMG"
  info "created and formatted"
fi
mkdir -p "$DEV_DISK_MNT"
if mountpoint -q "$DEV_DISK_MNT"; then
  info "already mounted at $DEV_DISK_MNT"
else
  mount -o loop "$DEV_DISK_IMG" "$DEV_DISK_MNT"
  info "mounted at $DEV_DISK_MNT"
fi
# Survives a reboot. Without this the dev database comes back on the SHARED
# disk after a restart, quietly undoing the one guarantee this step exists for.
if ! grep -q "^${DEV_DISK_IMG} " /etc/fstab; then
  echo "${DEV_DISK_IMG} ${DEV_DISK_MNT} ext4 loop,defaults,nofail 0 2" >>/etc/fstab
  info "added to /etc/fstab (nofail: a bad image must not stop the machine booting)"
fi
df -h "$DEV_DISK_MNT" | tail -1 | sed 's/^/  /'

# ── 3 · the directory ────────────────────────────────────────────────────────
say "3/8  ${DEV_DIR}"
mkdir -p "$DEV_DIR/ops" "$DEV_DIR/backups"
cp "$PROD_DIR/docker-compose.prod.yml" "$DEV_DIR/"
[ -f "$PROD_DIR/docker-compose.dev.yml" ] &&
  cp "$PROD_DIR/docker-compose.dev.yml" "$DEV_DIR/"
[ -f "$DEV_DIR/docker-compose.dev.yml" ] ||
  die "docker-compose.dev.yml is missing — run the sync first (Ops → sync-server)."
for f in harden-db-role.sh import-erp-state.sh; do
  [ -f "$PROD_DIR/ops/$f" ] && cp "$PROD_DIR/ops/$f" "$DEV_DIR/ops/"
done
chmod +x "$DEV_DIR/ops/"*.sh 2>/dev/null || true
info "compose files and ops scripts in place"

# ── 4 · the environment ──────────────────────────────────────────────────────
say "4/8  Environment"
if [ -f "$DEV_DIR/.env" ]; then
  info ".env exists — NOT regenerated (the password in use stays the password in use)"
else
  gen() { openssl rand -base64 "$1" | tr -d '\n/+=' | cut -c1-"$2"; }
  # Typeable on purpose: this gets read aloud and typed on a phone. It guards a
  # system holding invented data, so the bar is "not guessable from outside",
  # not "resistant to an offline attack on a password file".
  DEV_PW="canei-dev-$(openssl rand -hex 3)-$(openssl rand -hex 3)"
  cat >"$DEV_DIR/.env" <<EOF
# Generated by ops/dev-up.sh. Not in git, and never will be.
#
# THE LINE THAT KEEPS PRODUCTION ALIVE — see docker-compose.dev.yml.
COMPOSE_PROJECT_NAME=canei-erp-dev

IMAGE_APP="$(sed -n 's/^IMAGE_APP=//p' "$PROD_DIR/.env" | tr -d '"' | sed 's/:main$/:dev/')"
IMAGE_MIGRATE="$(sed -n 's/^IMAGE_MIGRATE=//p' "$PROD_DIR/.env" | tr -d '"' | sed 's/:main$/:dev/')"

POSTGRES_USER="canei"
POSTGRES_PASSWORD="$(gen 32 40)"
POSTGRES_DB="canei_erp_dev"
APP_DB_USER="canei_app"
APP_DB_PASSWORD="$(gen 32 40)"

APP_PORT=${DEV_PORT}
PUBLIC_HOSTNAME="${DEV_HOST}"
APP_URL="https://${DEV_HOST}"
ERP_PUBLIC_URL="https://${DEV_HOST}"

ERP_ENVIRONMENT="dev"
ERP_DEFAULT_TENANT="${DEV_TENANT}"
ERP_OPERATOR="Dev"

SESSION_SECRET="$(gen 48 64)"
ERP_ACCESS_PASSWORD="${DEV_PW}"
ERP_USERS=""

# Mail stays unconfigured. This is the guarantee that nothing done here can
# reach a real customer, and it holds because the feature is off.
ERP_MAIL_FROM=""
ERP_MAIL_USER=""
ERP_MAIL_PASSWORD=""
ERP_MAIL_IMAP_HOST=""
ERP_MAIL_IMAP_PORT=""
ERP_MAIL_DRAFTS=""
EOF
  chmod 600 "$DEV_DIR/.env"
  info ".env generated with fresh secrets"
fi

# Production's Caddy needs to know the second name. Added to production's .env
# rather than hard-coded in the Caddyfile so one machine's address never has to
# be a fact in the repository.
# Corrected, not merely added. A wrong value written once would otherwise be
# permanent, because the only code that looked at it would skip it for being
# present — which is exactly how a hostname carrying literal apostrophes
# survived a run and failed the next one's certificate check.
# The WHOLE LINE is compared, not the value read out of it: reading strips the
# quoting, so a stored dev-'178-…' reads back identical to a correct
# dev-178-…, reports "already correct", and stays broken forever.
WANT_LINE="DEV_HOSTNAME=\"${DEV_HOST}\""
CURRENT_LINE="$(grep -m1 '^DEV_HOSTNAME=' "$PROD_DIR/.env" || true)"
if [ "$CURRENT_LINE" = "$WANT_LINE" ]; then
  info "DEV_HOSTNAME already correct in production's .env"
else
  [ -n "$CURRENT_LINE" ] && warn "replacing a wrong line: ${CURRENT_LINE}"
  sed -i '/^DEV_HOSTNAME=/d' "$PROD_DIR/.env"
  printf 'DEV_HOSTNAME="%s"\n' "$DEV_HOST" >>"$PROD_DIR/.env"
  info "DEV_HOSTNAME set to ${DEV_HOST} in production's .env"
fi

# ── 5 · the guard, checked rather than trusted ───────────────────────────────
say "5/8  Project name"
RESOLVED="$(cd "$DEV_DIR" && docker compose -f docker-compose.prod.yml -f docker-compose.dev.yml config 2>/dev/null | sed -n 's/^name: //p' | head -1)"
[ "$RESOLVED" = "canei-erp-dev" ] ||
  die "The dev stack resolves to project '${RESOLVED}', not 'canei-erp-dev'. REFUSING to start it: at 'canei-erp' it would adopt and then remove production's containers."
info "resolves to '${RESOLVED}' — production's project is untouched"

# ── 6 · the deploy timer ─────────────────────────────────────────────────────
say "6/8  Auto-deploy timer for dev"
cat >/etc/systemd/system/canei-deploy-dev.service <<EOF
[Unit]
Description=Pull and apply the development stack
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=${DEV_DIR}
# The guard, again, at the only moment that matters. If the project name is ever
# lost from .env this refuses to run rather than bringing the dev stack up on top
# of production's containers.
ExecStartPre=/bin/bash -c 'grep -q "^COMPOSE_PROJECT_NAME=canei-erp-dev\$" ${DEV_DIR}/.env || { echo "COMPOSE_PROJECT_NAME missing — refusing"; exit 1; }'
ExecStartPre=/bin/bash -c 'docker network inspect ${EDGE_NET} >/dev/null 2>&1 || docker network create ${EDGE_NET} >/dev/null'
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml -f docker-compose.dev.yml pull --quiet
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml -f docker-compose.dev.yml up -d --remove-orphans
EOF
cat >/etc/systemd/system/canei-deploy-dev.timer <<'EOF'
[Unit]
Description=Check for a new development image

[Timer]
OnBootSec=4min
OnUnitActiveSec=60s
# Offset from production's timer so two `docker compose pull` runs do not
# contend for the dockerd lock and the registry at the same instant.
RandomizedDelaySec=20s
AccuracySec=15s

[Install]
WantedBy=timers.target
EOF

# Production's unit learns to heal a missing shared network. Its compose file now
# declares one, and a missing external network makes `up` fail outright — so the
# machine must be able to recover without somebody reading a runbook.
if [ -f /etc/systemd/system/canei-deploy.service ] &&
  ! grep -q "network create ${EDGE_NET}" /etc/systemd/system/canei-deploy.service; then
  sed -i "/^ExecStart=/i ExecStartPre=/bin/bash -c 'docker network inspect ${EDGE_NET} >/dev/null 2>&1 || docker network create ${EDGE_NET} >/dev/null'" \
    /etc/systemd/system/canei-deploy.service
  info "production's deploy unit will now recreate ${EDGE_NET} if it goes missing"
fi

# WRITTEN AND ENABLED, BUT NOT STARTED — the timer is armed at the END of the
# next step, once the stack is actually up.
#
# `enable --now` here fired the deploy service immediately, and that service
# runs `docker compose up -d` — at the same moment as the `up -d` below. Two
# compose operations on one project raced, and the run died on «container name
# canei-erp-dev-db-1 is already in use». The fix is ordering, not retrying: the
# timer exists to keep a RUNNING stack current, so it has no business starting
# before there is one.
systemctl daemon-reload
systemctl enable canei-deploy-dev.timer >/dev/null 2>&1
info "canei-deploy-dev.timer written and enabled (armed after the stack is up)"
info "no backup timer for dev — deliberate, see the header"

# ── 7 · up ───────────────────────────────────────────────────────────────────
say "7/8  Starting"
cd "$DEV_DIR"

# Nothing else may be holding this project while we work on it. Belt and braces
# against the race above, and against a human who ran the service by hand.
systemctl stop canei-deploy-dev.timer canei-deploy-dev.service >/dev/null 2>&1 || true

docker compose -f docker-compose.prod.yml -f docker-compose.dev.yml pull --quiet || true

# `down` first, then `up`. On a stack that is already healthy this costs a few
# seconds; on one left half-created by an interrupted run it is the difference
# between healing and failing on a name conflict for ever. Named volumes survive
# `down` (only `down -v` removes them) and dev's database is a bind mount to the
# capped disk, so nothing here loses data — and dev's data is invented anyway.
#
# Scoped to the dev project by COMPOSE_PROJECT_NAME in .env, which step 5 has
# already refused to proceed without.
docker compose -f docker-compose.prod.yml -f docker-compose.dev.yml down --remove-orphans >/dev/null 2>&1 || true
docker compose -f docker-compose.prod.yml -f docker-compose.dev.yml up -d --remove-orphans
docker compose -f docker-compose.prod.yml -f docker-compose.dev.yml ps

# Now that there is something to keep current, let the timer do it.
systemctl start canei-deploy-dev.timer >/dev/null 2>&1 || true
info "canei-deploy-dev.timer started (60s, offset from production's)"

say "Waiting for it to answer"
OK=""
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${DEV_PORT}/api/health" >/tmp/devhealth 2>/dev/null; then
    OK=1
    break
  fi
  sleep 3
done
if [ -n "$OK" ]; then
  cat /tmp/devhealth | sed 's/^/  /'
  echo
else
  warn "no answer on 127.0.0.1:${DEV_PORT} after two minutes"
  docker compose -f docker-compose.prod.yml -f docker-compose.dev.yml logs --tail 40 app || true
fi

# ── 8 · the front door learns the second name ────────────────────────────────
# DEV_HOSTNAME went into production's .env above, but Caddy read its environment
# when it started and has not seen it. Only the `web` service is recreated — the
# application and the database are left running, so the real system's downtime is
# one container restart measured in seconds, not a stack bounce.
#
# VALIDATED FIRST, ALWAYS. Caddy will not start on a config it cannot parse, and
# this is the container holding the company's TLS. If validation fails we stop
# here: the dev stack is already up and merely unreachable from outside, which is
# a far better place to be than production being down.
say "8/8  Teaching the front door the second address"
cd "$PROD_DIR"
set -a
# shellcheck disable=SC1091
. ./.env
set +a
if docker run --rm \
  -e PUBLIC_HOSTNAME="${PUBLIC_HOSTNAME:-}" \
  -e ACME_EMAIL="${ACME_EMAIL:-}" \
  -e DEV_HOSTNAME="${DEV_HOSTNAME:-dev.invalid}" \
  -v "$PROD_DIR/ops/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  docker compose -f docker-compose.prod.yml --profile pilot up -d web
  info "Caddy recreated; https://${DEV_HOST} should answer within a few seconds"
  info "(first request takes longer — that is Let's Encrypt issuing the certificate)"
else
  warn "The Caddyfile does not validate. The front door was NOT touched."
  warn "Production is unaffected; the dev stack is up but not reachable from outside."
fi
cd "$DEV_DIR"

# Production is asked whether it is still well, as the last thing, every time.
# This script's whole risk is that it disturbs the system it runs beside.
say "Production, after all of the above"
curl -fsS "http://127.0.0.1:3000/api/health" 2>/dev/null | sed 's/^/  /' ||
  warn "production did not answer on 127.0.0.1:3000 — INVESTIGATE BEFORE DOING ANYTHING ELSE"
echo

DEV_PW_NOW="$(sed -n 's/^ERP_ACCESS_PASSWORD=//p' "$DEV_DIR/.env" | tr -d '"' | head -1)"
cat <<EOF

────────────────────────────────────────────────────────────────────────────
  DEVELOPMENT SYSTEM

    https://${DEV_HOST}
    password: ${DEV_PW_NOW}

  One shared password, no username. The data is invented. Mail is off.
  Reset it any time with: Ops → target dev → dev-reset
────────────────────────────────────────────────────────────────────────────

EOF

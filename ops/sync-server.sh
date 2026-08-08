#!/usr/bin/env bash
# =============================================================================
# Copy the stack definition and ops scripts up to the server, then restart it.
#
#   ./ops/sync-server.sh
#
# WHY THIS EXISTS. The server gets its application by pulling a new container
# image every 60 seconds, and that works well. But `docker-compose.prod.yml`,
# `ops/Caddyfile` and the ops scripts are NOT in the image — they were written
# to the machine once, at provisioning, and nothing has updated them since.
#
# So a change to the stack itself — a new service, a new environment variable
# passed to the app, a fix in the backup script — reaches the repository, passes
# CI, and then sits there. The server keeps running the definition it was born
# with, and the symptom is maddening: `docker compose up -d` reports "Running",
# nothing is recreated, and the new setting you just added to `.env` is silently
# never handed to the application.
#
# That is exactly how the pilot's login appeared to be configured and was not:
# the settings were in `.env`, and the compose file on the machine had no line
# passing them through.
#
# Run this whenever docker-compose.prod.yml or anything in ops/ changes.
# =============================================================================
set -euo pipefail

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die() {
  printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

command -v jq >/dev/null || die "jq is required"

CONF="${CONF:-ops/provision.conf}"
if [ -f "$CONF" ]; then
  # shellcheck disable=SC1090
  set -a
  . "./$CONF"
  set +a
fi
: "${HCLOUD_TOKEN:?HCLOUD_TOKEN missing — set it in $CONF or the environment}"
SERVER_NAME="${SERVER_NAME:-canei-erp-prod}"
KEY="${KEY:-ops/.provisioned/id_ed25519}"
[ -f docker-compose.prod.yml ] || die "Run this from the repository root."

IP="$(curl -sS -H "Authorization: Bearer $HCLOUD_TOKEN" \
  "https://api.hetzner.cloud/v1/servers?name=${SERVER_NAME}" |
  jq -r '.servers[0].public_net.ipv4.ip // empty')"
[ -n "$IP" ] || die "No server named '${SERVER_NAME}'."
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -i "$KEY")

say "Server ${IP}"

# Keep the previous definition. If a new compose file is wrong, the way back is
# a copy, not a reconstruction from memory at an awkward moment.
ssh "${SSH_OPTS[@]}" "root@${IP}" \
  "cd /opt/canei-erp && cp docker-compose.prod.yml docker-compose.prod.yml.bak && mkdir -p ops" </dev/null
info "previous compose file kept as docker-compose.prod.yml.bak"

say "Copying the stack definition and ops scripts"
scp "${SSH_OPTS[@]}" -q docker-compose.prod.yml "root@${IP}:/opt/canei-erp/docker-compose.prod.yml"
scp "${SSH_OPTS[@]}" -q \
  ops/Caddyfile ops/backup.sh ops/restore.sh ops/harden-db-role.sh \
  "root@${IP}:/opt/canei-erp/ops/"
ssh "${SSH_OPTS[@]}" "root@${IP}" "chmod +x /opt/canei-erp/ops/*.sh" </dev/null
info "docker-compose.prod.yml, Caddyfile, backup.sh, restore.sh, harden-db-role.sh"

# The `pilot` profile is only started when the machine is configured for it.
# Starting Caddy on a server with no PUBLIC_HOSTNAME leaves a container in a
# restart loop, which looks like a broken deployment rather than a setting
# nobody filled in.
PROFILE=""
if ssh "${SSH_OPTS[@]}" "root@${IP}" \
  "grep -q \"^PUBLIC_HOSTNAME=['\\\"]\\?[a-zA-Z0-9]\" /opt/canei-erp/.env" </dev/null 2>/dev/null; then
  PROFILE="--profile pilot"
  info "PUBLIC_HOSTNAME is set — the HTTPS front door will be started too"
else
  info "PUBLIC_HOSTNAME is empty — starting the private stack only"
fi

say "Restarting"
ssh "${SSH_OPTS[@]}" "root@${IP}" \
  "cd /opt/canei-erp && docker compose -f docker-compose.prod.yml ${PROFILE} up -d && docker compose -f docker-compose.prod.yml ${PROFILE} ps" </dev/null

cat <<EOF

  If the app container says "Recreated" above, it picked up the current
  settings. "Running" means nothing changed — which is correct only when
  nothing needed to.

  Next: ./ops/open-web.sh

EOF

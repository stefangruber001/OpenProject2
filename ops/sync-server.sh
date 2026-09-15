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
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
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
scp "${SSH_OPTS[@]}" -q docker-compose.prod.yml docker-compose.dev.yml \
  "root@${IP}:/opt/canei-erp/"
scp "${SSH_OPTS[@]}" -q \
  ops/Caddyfile ops/backup.sh ops/restore.sh ops/harden-db-role.sh \
  ops/import-erp-state.sh ops/dev-up.sh \
  "root@${IP}:/opt/canei-erp/ops/"
ssh "${SSH_OPTS[@]}" "root@${IP}" "chmod +x /opt/canei-erp/ops/*.sh" </dev/null
info "compose (prod + dev), Caddyfile, backup, restore, harden-db-role, import-erp-state, dev-up"

# ── The shared network, BEFORE anything is brought up ────────────────────────
# docker-compose.prod.yml declares `canei-edge` as an EXTERNAL network, which
# Caddy uses to reach the development stack's app. An external network that does
# not exist is not a warning — `docker compose up` refuses to start ANYTHING,
# and that file is production.
#
# So it is created here, idempotently, before the restart below, and again by an
# ExecStartPre on the deploy timer so a machine that loses it heals itself
# rather than staying down until somebody reads a runbook.
say "Shared network"
ssh "${SSH_OPTS[@]}" "root@${IP}" \
  "docker network inspect canei-edge >/dev/null 2>&1 || docker network create canei-edge >/dev/null; docker network inspect canei-edge --format 'canei-edge: {{.Id}}' | cut -c1-24" </dev/null

# ── The second address, named before the config that mentions it is read ────
# The Caddyfile carries a site block for the development stack, written as
# `{$DEV_HOSTNAME:dev.invalid}`. The default is a genuine last resort, not the
# normal path, for two reasons: Caddy applies a placeholder default only when the
# variable is UNSET (an empty string is a value, and produces a site block with
# no address, which does not parse); and Caddy asks Let's Encrypt for a
# certificate for every address it serves at start-up, so a placeholder that
# can never resolve means a failing ACME attempt on every boot.
#
# Both disappear if the real name is simply present. It is derived, not
# configured — `dev-` in front of the production hostname — because sslip.io
# answers any name containing an address, so this resolves to this machine with
# no registrar and no DNS record. A SIBLING of the production name rather than a
# subdomain of it, so nothing scoped to one host is in scope for the other.
#
# The block points at an upstream that may not exist yet and answers 502 until
# the dev stack is built. That is the right order: the address exists before the
# thing behind it, not the other way round.
# THE VALUE IS BUILT HERE, NOT OVER THERE. The first attempt did the reading,
# stripping and writing inside one remote shell string, three layers of quoting
# deep. `.env` quotes that value with SINGLE quotes, the `tr` that was supposed
# to remove them had been escaped into removing only double ones, and the
# hostname went in as dev-'178-105-10-156.sslip.io' — literal apostrophes and
# all. Caddy rejected it ("subject does not qualify for certificate") and the
# validation below refused the deploy, which is the only reason it was not an
# outage. Remote commands are now the simplest thing that works: read one line,
# write one line. Anything resembling string handling happens on this side.
#
# AND IT CORRECTS, IT DOES NOT SKIP. "Leave it alone if the key is present"
# would have made that malformed value permanent — the run that wrote it also
# guaranteed no later run would look at it. The value is recomputed every time
# and rewritten when it differs, so a bad one heals on the next run.
say "The development address"
read_env() {
  ssh "${SSH_OPTS[@]}" "root@${IP}" \
    "sed -n 's/^$1=//p' /opt/canei-erp/.env | head -1" </dev/null 2>/dev/null |
    tr -d "\"' \r" | head -1
}
PROD_HOST="$(read_env PUBLIC_HOSTNAME)"

if [ -z "$PROD_HOST" ]; then
  info "PUBLIC_HOSTNAME is empty — no front door on this machine, nothing to name"
else
  WANT_DEV="dev-${PROD_HOST}"
  # A shape check before anything downstream trusts it. Caddy's own complaint
  # ("subject does not qualify for certificate") arrives far from the cause and
  # only at validation time; this says which value is wrong, here.
  printf '%s' "$WANT_DEV" | grep -Eq '^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$' ||
    die "Derived development hostname «${WANT_DEV}» is not a hostname. Check PUBLIC_HOSTNAME in the server's .env."

  # THE WHOLE LINE IS COMPARED, NOT THE VALUE READ OUT OF IT. Reading strips the
  # quoting, which is exactly what makes a broken value look correct: a stored
  # dev-'178-…' reads back identical to a stored dev-178-…, so a comparison on
  # the parsed value reports "already correct" and leaves the broken line in
  # place forever. The raw line cannot be fooled that way.
  WANT_LINE="DEV_HOSTNAME=\"${WANT_DEV}\""
  CURRENT_LINE="$(ssh "${SSH_OPTS[@]}" "root@${IP}" \
    "grep -m1 '^DEV_HOSTNAME=' /opt/canei-erp/.env || true" </dev/null 2>/dev/null | tr -d '\r')"

  if [ "$CURRENT_LINE" = "$WANT_LINE" ]; then
    info "already correct: ${WANT_DEV}"
  else
    [ -n "$CURRENT_LINE" ] && warn "replacing a wrong line: ${CURRENT_LINE}"
    ssh "${SSH_OPTS[@]}" "root@${IP}" \
      "sed -i '/^DEV_HOSTNAME=/d' /opt/canei-erp/.env && printf 'DEV_HOSTNAME=\"%s\"\n' '${WANT_DEV}' >> /opt/canei-erp/.env" </dev/null
    info "set: ${WANT_DEV}"
  fi
fi

# ── The Caddyfile parses, BEFORE the container that reads it is restarted ────
# Caddy will not start on a config it cannot parse, and Caddy is what terminates
# TLS for the real system. A typo here — or a `{$DEV_HOSTNAME}` with nothing
# behind it and no default — takes the company's ERP off the internet, as a side
# effect of a change to a development feature. Validating first turns that from
# an outage into a refusal.
say "Validating the Caddyfile"
ssh "${SSH_OPTS[@]}" "root@${IP}" "
  set -e
  cd /opt/canei-erp
  set -a; . ./.env; set +a
  docker run --rm \
    -e PUBLIC_HOSTNAME=\"\${PUBLIC_HOSTNAME:-}\" \
    -e ACME_EMAIL=\"\${ACME_EMAIL:-}\" \
    -e DEV_HOSTNAME=\"\${DEV_HOSTNAME:-dev.invalid}\" \
    -v /opt/canei-erp/ops/Caddyfile:/etc/caddy/Caddyfile:ro \
    caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
" </dev/null || die "The Caddyfile does not parse. NOTHING has been restarted; production is untouched."
info "parses — safe to restart the front door"

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

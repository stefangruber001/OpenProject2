#!/usr/bin/env bash
# =============================================================================
# Put the latest release on the server, now, and PROVE it arrived.
#
#   ./ops/deploy-now.sh
#
# The pipeline already builds, tests and publishes every push to main, and the
# server has a timer that pulls every minute. When all of that is working this
# script is unnecessary. It exists because when it is NOT working, every part
# still looks fine: green ticks in Actions, a running timer, a healthy container
# — serving a version from days ago.
#
# So the check at the end is the point. It does not ask "did the commands
# succeed", it asks "is the code I just pushed the code that is answering", by
# comparing the running image against this checkout's commit and by fetching a
# file over the public address. Anything less has already fooled us once.
# =============================================================================
set -euo pipefail

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
die() {
  printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

command -v jq >/dev/null || die "jq is required (brew install jq)"
[ -f docker-compose.prod.yml ] || die "Run this from the repository root."

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

WANT="$(git rev-parse HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

IP="$(curl -sS -H "Authorization: Bearer $HCLOUD_TOKEN" \
  "https://api.hetzner.cloud/v1/servers?name=${SERVER_NAME}" |
  jq -r '.servers[0].public_net.ipv4.ip // empty')"
[ -n "$IP" ] || die "No server named '${SERVER_NAME}'."
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -i "$KEY")

say "Local checkout"
info "branch ${BRANCH} at ${WANT:0:8}"
if [ -n "$(git status --porcelain)" ]; then
  warn "You have uncommitted changes. Only what is PUSHED can be deployed."
fi

say "Pulling the published release onto the server"
# `pull` before `up` and reported separately: an authentication failure here is
# the single most common reason a release does not arrive, and it is worth
# naming rather than letting `up -d` report "Running" over a stale image.
ssh "${SSH_OPTS[@]}" "root@${IP}" "bash -s" <<'PY' 2>&1 | sed 's/^/  /'
set -uo pipefail
cd /opt/canei-erp
if ! docker compose -f docker-compose.prod.yml pull 2>&1 | tail -4; then
  echo "PULL FAILED"
fi
PY

say "Restarting"
ssh "${SSH_OPTS[@]}" "root@${IP}" "bash -s" <<'PY' 2>&1 | tail -14 | sed 's/^/  /'
set -uo pipefail
cd /opt/canei-erp
PROFILE=""
grep -q '^PUBLIC_HOSTNAME=.\+' .env && PROFILE="--profile pilot"
# shellcheck disable=SC2086
docker compose -f docker-compose.prod.yml $PROFILE up -d 2>&1 | tail -8
sleep 4
docker compose -f docker-compose.prod.yml ps --format '{{.Service}} {{.Status}}'
PY

say "Is the new version actually the one answering?"
RUNNING="$(ssh "${SSH_OPTS[@]}" "root@${IP}" \
  "docker inspect --format '{{index .Config.Labels \"org.opencontainers.image.revision\"}}' \
   \$(docker compose -f /opt/canei-erp/docker-compose.prod.yml -p canei-erp ps -q app 2>/dev/null | head -1) 2>/dev/null" </dev/null || true)"
RUNNING="$(printf '%s' "$RUNNING" | tr -d '[:space:]')"

if [ -z "$RUNNING" ]; then
  warn "The image carries no revision label, so it cannot be compared to a commit."
  warn "Falling back to checking the served files below."
elif [ "$RUNNING" = "$WANT" ]; then
  info "running revision ${RUNNING:0:8} — matches this checkout"
else
  warn "running revision ${RUNNING:0:8}, this checkout is ${WANT:0:8}"
  warn "The server is NOT on your latest commit. Usual causes, in order:"
  warn "  1. the commit is not pushed, or its build has not finished"
  warn "  2. the registry token is missing or revoked → ./ops/set-ghcr-token.sh"
  warn "  3. the compose file on the server is stale     → ./ops/sync-server.sh"
fi

HOST="$(ssh "${SSH_OPTS[@]}" "root@${IP}" \
  "sed -n 's/^PUBLIC_HOSTNAME=//p' /opt/canei-erp/.env | tr -d '\"' | tr -d \"'\"" </dev/null || true)"
HOST="$(printf '%s' "$HOST" | tr -d '[:space:]')"

if [ -n "$HOST" ]; then
  say "What the public address actually serves"
  for f in erp-store.js erp-docs.js erp-engine.js; do
    CODE="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "https://${HOST}/workspace/${f}" || echo 000)"
    if [ "$CODE" = "200" ]; then
      info "${f}  ${CODE}"
    else
      warn "${f}  ${CODE}  ← this file is part of the current build and is not being served"
    fi
  done
  # erp-docs.js only exists from the release that put every screen on the server,
  # so its absence is a precise signal: the server is on an older build.
  CODE="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "https://${HOST}/workspace/erp-docs.js" || echo 000)"
  echo
  if [ "$CODE" = "200" ]; then
    printf '  \033[1;32mThe server is serving the current build.\033[0m\n'
    printf '  Open https://%s and sign in.\n\n' "$HOST"
  else
    printf '  \033[1;31mThe server is still serving an older build.\033[0m\n'
    printf '  Work through the three causes listed above, then run this again.\n\n'
    exit 1
  fi
else
  warn "PUBLIC_HOSTNAME is not set on the server, so there is no public address to check."
fi

#!/usr/bin/env bash
# =============================================================================
# Stop the development stack and give production its address back.
#
# WHY THIS EXISTS AS ITS OWN BUTTON. On 16/09 the company's own address served
# the development system (ASSUMPTIONS S138): the dev app answers to `app` on the
# shared network as well as to `app-dev`, Caddy sits on both networks, and its
# production block said `reverse_proxy app:3000`. Two answers, wrong one chosen.
#
# The fix is a one-word change to the production Caddyfile — but a fix that is
# only in the repository does nothing for a client looking at invented data
# right now. Stopping the dev stack removes the second answer immediately, from
# a browser, without anybody needing an SSH key.
#
# It is deliberately NOT destructive. The dev database, its capped filesystem
# and its data all stay exactly where they are; `dev-up` brings it back. What
# stops is the containers.
#
# Run as root on the server.
# =============================================================================
set -euo pipefail

PROD_DIR="${PROD_DIR:-/opt/canei-erp}"
DEV_DIR="${DEV_DIR:-/opt/canei-erp-dev}"

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
info() { printf '  \033[1;32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$1"; }
die() {
  printf '  \033[1;31m✗\033[0m %s\n' "$1" >&2
  exit 1
}

[ "$(id -u)" = "0" ] || die "Run as root."
[ -d "$PROD_DIR" ] || die "$PROD_DIR does not exist — this runs on the ERP server."

say "1/3  Stopping the development stack"
if [ -d "$DEV_DIR" ]; then
  cd "$DEV_DIR"
  # --remove-orphans is NOT passed, and that is not an oversight. The dev stack
  # shares a compose FILE with production; if its project name were ever wrong,
  # --remove-orphans would delete production's containers as strangers. The one
  # guard that matters here is the one we decline to disarm.
  if docker compose -f docker-compose.prod.yml -f docker-compose.dev.yml down; then
    info "dev containers stopped (its database and disk are untouched)"
  else
    warn "compose down reported a problem; continuing to the front door anyway"
  fi
else
  warn "$DEV_DIR does not exist — nothing to stop"
fi

say "2/3  Giving production's front door a clean answer"
cd "$PROD_DIR"
# Recreating Caddy makes it resolve `app` again. With the dev container gone
# there is only one answer, so this is what actually restores the company's
# address — the step above only removes the competitor.
docker compose -f docker-compose.prod.yml --profile pilot up -d --force-recreate web
info "Caddy recreated"

say "3/3  Proving it"
sleep 3
BODY="$(docker compose -f docker-compose.prod.yml exec -T app \
  node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)" 2>/dev/null || true)"
printf '  %s\n' "${BODY:-(the app did not answer)}"

case "$BODY" in
  *'"environment":"production"'* | *'"environment": "production"'*)
    info "the application reports production"
    ;;
  "")
    warn "no answer from the app container — check: docker compose -f docker-compose.prod.yml ps"
    ;;
  *)
    die "the app still reports something other than production — do not hand this to the client yet"
    ;;
esac

printf '\n  Now open https://%s/api/health from OUTSIDE and confirm the same.\n' \
  "$(sed -n 's/^PUBLIC_HOSTNAME=//p' "$PROD_DIR/.env" | tr -d '"'"'"' ' | head -1)"
printf '  That is the number that matters: this check asked the container directly,\n'
printf '  and the fault was in which container the ADDRESS reaches.\n\n'

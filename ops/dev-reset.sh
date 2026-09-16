#!/usr/bin/env bash
# =============================================================================
# Put the development system back to the invented company it started as.
#
#   bash /opt/canei-erp-dev/ops/dev-reset.sh /tmp/dev-seed.json
#
# Normally reached through Actions → Ops → action: dev-reset, which generates the
# seed on the runner and hands it here.
#
# THIS DESTROYS THE DEV DATABASE. That is what it is for. An environment people
# are afraid to break is production with extra steps, and the thing that makes
# them unafraid is knowing this takes thirty seconds.
#
# IT REFUSES TO RUN ANYWHERE ELSE. Every destructive command below is scoped to
# the dev compose project, and the script checks three separate things first: the
# directory, the resolved project name, and ERP_ENVIRONMENT. A reset script that
# could be pointed at production by a wrong argument is a loaded gun, so it has
# no argument that says which system to act on — only the payload.
# =============================================================================
set -euo pipefail

DEV_DIR="${DEV_DIR:-/opt/canei-erp-dev}"
SEED="${1:-}"
COMPOSE=(-f docker-compose.prod.yml -f docker-compose.dev.yml)

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die() {
  printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

[ -n "$SEED" ] && [ -f "$SEED" ] || die "usage: $0 <seed.json>  (generate with ops/dev-seed.mjs)"
[ -d "$DEV_DIR" ] || die "$DEV_DIR does not exist. Run ops/dev-up.sh first."
cd "$DEV_DIR"

# ── The three checks, before anything is destroyed ───────────────────────────
say "Confirming this is the development system"

RESOLVED="$(docker compose "${COMPOSE[@]}" config 2>/dev/null | sed -n 's/^name: //p' | head -1)"
[ "$RESOLVED" = "canei-erp-dev" ] ||
  die "This resolves to project '${RESOLVED}', not 'canei-erp-dev'. REFUSING."
info "compose project: ${RESOLVED}"

grep -q '^ERP_ENVIRONMENT="\?dev"\?$' .env ||
  die "ERP_ENVIRONMENT is not 'dev' in ${DEV_DIR}/.env. REFUSING."
info "ERP_ENVIRONMENT: dev"

DB="$(sed -n 's/^POSTGRES_DB=//p' .env | tr -d '"' | head -1)"
case "$DB" in
*_dev) info "database: ${DB}" ;;
*) die "The database is named '${DB}', which does not end in _dev. REFUSING." ;;
esac

PORT="$(sed -n 's/^APP_PORT=//p' .env | tr -d '"' | head -1)"
PORT="${PORT:-3001}"
TENANT="$(sed -n 's/^ERP_DEFAULT_TENANT=//p' .env | tr -d '"' | head -1)"
TENANT="${TENANT:-reformas-demo}"

# ── Drop it ──────────────────────────────────────────────────────────────────
# The app is stopped first: dropping a database out from under open connections
# either fails or leaves the app holding handles to something that is gone.
say "Dropping ${DB}"
docker compose "${COMPOSE[@]}" stop app >/dev/null
USER_="$(sed -n 's/^POSTGRES_USER=//p' .env | tr -d '"' | head -1)"
docker compose "${COMPOSE[@]}" exec -T db \
  psql -U "$USER_" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"${DB}\" WITH (FORCE);" \
  -c "CREATE DATABASE \"${DB}\" OWNER \"${USER_}\";"
info "dropped and recreated, empty"

# ── Build it back ────────────────────────────────────────────────────────────
# `up -d` reruns `migrate` and `db-role` because both are one-shot services that
# the app depends on — so the schema and the restricted role come back exactly as
# a fresh install would have them, rather than as whatever this box had drifted to.
say "Migrations and the restricted role"
docker compose "${COMPOSE[@]}" up -d
for i in $(seq 1 40); do
  curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && break
  sleep 3
done
curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 ||
  die "The dev app did not come back on 127.0.0.1:${PORT}."
info "answering again"

# ── Fill it ──────────────────────────────────────────────────────────────────
say "Loading the invented company into '${TENANT}'"
# The dev stack has a shared password, so every API call needs a session. The
# import signs in with this the way a browser would; without it the server
# answers 401 and the script blames the SSH tunnel.
DEV_PW="$(sed -n 's/^ERP_ACCESS_PASSWORD=//p' .env | tr -d '"' | head -1)"
OVERWRITE=1 ERP_BASE_URL="http://127.0.0.1:${PORT}" ERP_ACCESS_PASSWORD="$DEV_PW" \
  bash "${DEV_DIR}/ops/import-erp-state.sh" "$SEED" "$TENANT"

say "Production, untouched — confirming"
curl -fsS "http://127.0.0.1:3000/api/health" 2>/dev/null | sed 's/^/  /' ||
  printf '  \033[1;33m!\033[0m production did not answer on 127.0.0.1:3000 — INVESTIGATE\n'
echo

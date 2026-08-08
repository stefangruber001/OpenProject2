#!/usr/bin/env bash
# =============================================================================
# Restore the ERP database from an encrypted R2 backup.
#
#   ops/restore.sh                       restore the most recent backup
#   ops/restore.sh canei-erp-2026-…age   restore a specific one
#   ops/restore.sh --list                show what is available
#
# Needs the age PRIVATE key, which is deliberately not stored on this server.
# Put it at $AGE_KEY_FILE (default ./age-key.txt) for the duration of the
# restore and delete it afterwards — the script reminds you.
#
# THIS OVERWRITES THE LIVE DATABASE. It asks first.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "FATAL: no .env next to docker-compose.prod.yml" >&2; exit 1; }
# `set +u` around the source, deliberately. This file holds human-entered
# values, and a password hash legitimately contains "$16384" — which the shell
# reads as positional parameter $1 followed by "6384", and under `set -u` that
# is an unbound variable and this script exits before taking a backup. The
# nightly job would simply stop, with nothing in the log but a dead timer.
# Quoting guidance alone does not survive the next person editing .env.
set -a; set +u; . ./.env; set -u; set +a
: "${POSTGRES_USER:?}" "${POSTGRES_DB:?}" "${R2_ACCOUNT_ID:?}" "${R2_BUCKET:?}"

AGE_KEY_FILE="${AGE_KEY_FILE:-./age-key.txt}"
S3="aws s3 --endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

if [ "${1:-}" = "--list" ]; then
  $S3 ls "s3://${R2_BUCKET}/" | sort -r | head -40
  exit 0
fi

NAME="${1:-}"
if [ -z "$NAME" ]; then
  NAME=$($S3 ls "s3://${R2_BUCKET}/" | awk '{print $4}' | grep -E '^canei-erp-' | sort | tail -1)
  [ -n "$NAME" ] || { echo "FATAL: no backups found in ${R2_BUCKET}" >&2; exit 1; }
  echo "[restore] latest is ${NAME}"
fi

[ -f "$AGE_KEY_FILE" ] || {
  echo "FATAL: age private key not found at ${AGE_KEY_FILE}." >&2
  echo "       It is in the customer's password manager, not on this server." >&2
  exit 1; }

echo
echo "  About to REPLACE the contents of database '${POSTGRES_DB}' with ${NAME}."
echo "  Everything currently in it will be gone."
read -r -p "  Type the database name to confirm: " CONFIRM
[ "$CONFIRM" = "$POSTGRES_DB" ] || { echo "Aborted."; exit 1; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
echo "[restore] downloading …"
$S3 cp "s3://${R2_BUCKET}/${NAME}" "$TMP/enc" --only-show-errors
echo "[restore] decrypting …"
age -d -i "$AGE_KEY_FILE" -o "$TMP/dump" "$TMP/enc"

# Stop the app so nothing writes while the schema is being swapped. The tunnel
# stays up, so visitors get a clean error rather than a hanging connection.
echo "[restore] stopping app …"
docker compose -f docker-compose.prod.yml stop app

echo "[restore] restoring …"
# --clean --if-exists drops existing objects first; without it a restore over a
# live schema half-merges and leaves something that looks fine and is not.
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner < "$TMP/dump"

echo "[restore] starting app …"
docker compose -f docker-compose.prod.yml start app

echo
echo "[restore] done. Now:"
echo "  1. check https://${APP_URL#https://}/api/health reports database: connected"
echo "  2. spot-check the invoice register against what you expected to see"
echo "  3. DELETE ${AGE_KEY_FILE} from this server"

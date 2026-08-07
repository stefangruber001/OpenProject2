#!/usr/bin/env bash
# =============================================================================
# Nightly encrypted backup of the ERP database to Cloudflare R2.
#
#   ops/backup.sh            run a backup now
#
# Installed as a systemd timer by ops/bootstrap-server.sh. Encrypts with age to
# a public key whose private half is NOT on this machine — so a compromise of
# the server does not hand over the invoice register's history.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "FATAL: no .env next to docker-compose.prod.yml" >&2; exit 1; }
set -a; . ./.env; set +a

: "${POSTGRES_USER:?}" "${POSTGRES_DB:?}" "${BACKUP_AGE_RECIPIENT:?}"
: "${R2_ACCOUNT_ID:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}" "${R2_BUCKET:?}"

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
NAME="canei-erp-${STAMP}.dump.age"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[backup] dumping ${POSTGRES_DB} …"
# -Fc is the custom format: compressed, and restorable table-by-table.
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$TMP/dump"

RAW=$(stat -c%s "$TMP/dump")
# A dump smaller than this is not a database, it is an error message. Refusing
# to upload it keeps a broken backup from silently rotating out a good one.
if [ "$RAW" -lt 4096 ]; then
  echo "[backup] FATAL: dump is only ${RAW} bytes — refusing to upload" >&2
  exit 1
fi

echo "[backup] encrypting to ${BACKUP_AGE_RECIPIENT} …"
age -r "$BACKUP_AGE_RECIPIENT" -o "$TMP/$NAME" "$TMP/dump"

echo "[backup] uploading to r2://${R2_BUCKET}/${NAME} …"
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
aws s3 cp "$TMP/$NAME" "s3://${R2_BUCKET}/${NAME}" \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  --only-show-errors

# Prune anything older than the retention window.
CUTOFF=$(date -u -d "${BACKUP_RETENTION_DAYS:-30} days ago" +%Y-%m-%d)
echo "[backup] pruning backups older than ${CUTOFF} …"
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
aws s3 ls "s3://${R2_BUCKET}/" \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  | awk '{print $4}' | grep -E '^canei-erp-' || true \
  | while read -r old; do
      d="${old#canei-erp-}"; d="${d%%T*}"
      if [[ "$d" < "$CUTOFF" ]]; then
        AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
        AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
        aws s3 rm "s3://${R2_BUCKET}/${old}" \
          --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" --only-show-errors
        echo "[backup] pruned ${old}"
      fi
    done

echo "[backup] OK — ${NAME} ($(numfmt --to=iec "$RAW") uncompressed)"

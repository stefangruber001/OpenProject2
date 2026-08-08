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
# `set +u` around the source, deliberately. This file holds human-entered
# values, and a password hash legitimately contains "$16384" — which the shell
# reads as positional parameter $1 followed by "6384", and under `set -u` that
# is an unbound variable and this script exits before taking a backup. The
# nightly job would simply stop, with nothing in the log but a dead timer.
# Quoting guidance alone does not survive the next person editing .env.
set -a; set +u; . ./.env; set -u; set +a

: "${POSTGRES_USER:?}" "${POSTGRES_DB:?}" "${BACKUP_AGE_RECIPIENT:?}"

# BACKUP_TARGET=r2 (default) uploads off-site. BACKUP_TARGET=local keeps the
# encrypted dumps on this server only — an interim setting for before the
# object-storage decision is made. Local means ONE machine holds both the
# database and its backups, so it is not disaster recovery; Hetzner's own
# snapshots are the second copy until off-site storage exists.
BACKUP_TARGET="${BACKUP_TARGET:-r2}"
if [ "$BACKUP_TARGET" = "r2" ]; then
  : "${R2_ACCOUNT_ID:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}" "${R2_BUCKET:?}"
fi

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

if [ "$BACKUP_TARGET" = "local" ]; then
  mkdir -p ./backups
  mv "$TMP/$NAME" "./backups/$NAME"
  # Prune by count rather than by parsing dates — simpler and hard to get wrong.
  ls -1t ./backups/canei-erp-*.dump.age 2>/dev/null \
    | tail -n +$(( ${BACKUP_RETENTION_DAYS:-30} + 1 )) \
    | xargs -r rm -f
  KEPT=$(ls -1 ./backups/canei-erp-*.dump.age 2>/dev/null | wc -l)
  echo "[backup] OK — backups/${NAME} ($(numfmt --to=iec "$RAW") uncompressed, ${KEPT} kept)"
  echo "[backup] NOTE: local target — this server holds both the data and its backups."
  echo "[backup]       Off-site copies start as soon as BACKUP_TARGET=r2 is set."
  exit 0
fi

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

#!/usr/bin/env bash
# =============================================================================
# Move an ERP document from a browser onto the server.
#
#   ./ops/import-erp-state.sh canei-erp.json [tenant]
#
# Where the file comes from: open the workspace in the browser that holds the
# data, click "⤓ Exportar", and keep the downloaded canei-erp.json.
#
# Where it goes: the server, over whatever URL you can reach it on. In the
# interim setup that is an SSH tunnel:
#
#   ssh -i ops/.provisioned/id_ed25519 -L 3000:localhost:3000 root@<SERVER_IP>
#   ERP_BASE_URL=http://localhost:3000 ./ops/import-erp-state.sh canei-erp.json
#
# It refuses to overwrite a tenant that already holds data unless you pass
# OVERWRITE=1, and even then the server checks the version — so a second,
# absent-minded run cannot quietly replace a day's work.
# =============================================================================
set -euo pipefail

FILE="${1:-}"
TENANT="${2:-${ERP_TENANT:-diorka}}"
BASE="${ERP_BASE_URL:-http://localhost:3000}"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "usage: $0 <exported.json> [tenant]" >&2
  echo "       ERP_BASE_URL=http://localhost:3000 (default)" >&2
  exit 1
fi
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

# Fail early and clearly rather than posting a megabyte of the wrong thing.
jq -e '(.data // .) | (.parties | type == "array") and (.seq | type == "object")' \
  "$FILE" >/dev/null 2>&1 || {
  echo "✗ $FILE does not look like an ERP export (no parties[]/seq{})." >&2
  echo "  Use the file produced by 'Exportar' in the workspace." >&2
  exit 1
}

echo "▸ Reading current state of \"$TENANT\" at $BASE"
current="$(curl -fsS "$BASE/api/$TENANT/erp/state" | jq -r '.version')" || {
  echo "✗ Could not reach $BASE/api/$TENANT/erp/state" >&2
  echo "  Is the SSH tunnel open, and is the tenant name right?" >&2
  exit 1
}
echo "  version $current"

QUERY=""
if [ "$current" != "0" ]; then
  if [ "${OVERWRITE:-0}" != "1" ]; then
    cat >&2 <<EOF

✗ "$TENANT" already holds data (version $current).

  Importing would REPLACE it. If the server's copy is the real one, stop —
  what you want is probably to work in the server's copy, not overwrite it.

  If you are certain, re-run with:

      OVERWRITE=1 $0 $FILE $TENANT

EOF
    exit 1
  fi
  QUERY="?overwrite=true&expectedVersion=$current"
  echo "▸ Overwriting version $current (you asked for it)"
fi

echo "▸ Uploading $(wc -c < "$FILE" | tr -d ' ') bytes"
out="$(curl -fsS -X POST "$BASE/api/$TENANT/erp/import$QUERY" \
  -H 'content-type: application/json' --data-binary "@$FILE")" || {
  echo "✗ Import rejected. The server's reason:" >&2
  curl -sS -X POST "$BASE/api/$TENANT/erp/import$QUERY" \
    -H 'content-type: application/json' --data-binary "@$FILE" | jq . >&2 || true
  exit 1
}

echo
echo "$out" | jq '{tenant, version, replaced, importedBy, migrated}'
echo
echo "What arrived:"
echo "$out" | jq -r '.counts | to_entries[] | "  \(.value)\t\(.key)"' | sort -rn
echo
echo "✓ Imported. Open the workspace and check the figures before trusting it."

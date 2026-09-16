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

# ── Sign in, when the server expects it ─────────────────────────────────────
# This script predates the ERP having any login: it was written when the only
# way in was an SSH tunnel to a server that asked nobody for anything. A server
# with ERP_ACCESS_PASSWORD set answers 401 to every one of the calls below, and
# the message it produced — "is the SSH tunnel open?" — sends you looking in
# precisely the wrong place.
#
# Set ERP_ACCESS_PASSWORD and it signs in first, the same way a browser does:
# a form post with NO address, which is what selects the shared-password path in
# app/api/auth/login. The cookie lives in a jar that is deleted on the way out,
# whatever happens.
JAR=""
if [ -n "${ERP_ACCESS_PASSWORD:-}" ]; then
  JAR="$(mktemp)"
  trap 'rm -f "$JAR"' EXIT
  echo "▸ Signing in with the shared password"
  curl -fsS -o /dev/null -c "$JAR" \
    --data-urlencode "email=" \
    --data-urlencode "password=${ERP_ACCESS_PASSWORD}" \
    "$BASE/api/auth/login" 2>/dev/null || true
  grep -q 'canei_session' "$JAR" 2>/dev/null || {
    echo "✗ Sign-in did not return a session cookie." >&2
    echo "  Check ERP_ACCESS_PASSWORD matches the one in the server's .env." >&2
    exit 1
  }
  echo "  signed in"
fi
CURL=(curl -fsS)
[ -n "$JAR" ] && CURL+=(-b "$JAR")

echo "▸ Reading current state of \"$TENANT\" at $BASE"
current="$("${CURL[@]}" "$BASE/api/$TENANT/erp/state" | jq -r '.version')" || {
  echo "✗ Could not reach $BASE/api/$TENANT/erp/state" >&2
  echo "  Reachable at all? A 401 here means the server wants a password:" >&2
  echo "  set ERP_ACCESS_PASSWORD (or ERP_USERS credentials) and run again." >&2
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
out="$("${CURL[@]}" -X POST "$BASE/api/$TENANT/erp/import$QUERY" \
  -H 'content-type: application/json' --data-binary "@$FILE")" || {
  echo "✗ Import rejected. The server's reason:" >&2
  # Without -f, so the body of the refusal is printed rather than swallowed.
  curl -sS ${JAR:+-b "$JAR"} -X POST "$BASE/api/$TENANT/erp/import$QUERY" \
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

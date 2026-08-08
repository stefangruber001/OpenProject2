#!/usr/bin/env bash
# =============================================================================
# Give the server a working registry token, and prove it works.
#
#   ./ops/set-ghcr-token.sh
#
# The application is a private container image. The server needs a GitHub token
# to download it, and when that token is missing, expired or revoked, NOTHING
# VISIBLE HAPPENS: the deploy pipeline goes green, a new image is published, the
# server's update timer runs on schedule — and the machine keeps serving the old
# version indefinitely. The symptom is "you fixed it but nothing changed".
#
# So this does not just write the token. It logs in with it and pulls, and tells
# you which of those failed if one does.
#
# Make the token at:
#   github.com → Settings → Developer settings → Personal access tokens
#   → Tokens (classic) → Generate new token (classic)
#   → tick ONLY `read:packages`
# =============================================================================
set -euo pipefail

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
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
GH_USER="${GH_USER:-stefangruber001}"

IP="$(curl -sS -H "Authorization: Bearer $HCLOUD_TOKEN" \
  "https://api.hetzner.cloud/v1/servers?name=${SERVER_NAME}" |
  jq -r '.servers[0].public_net.ipv4.ip // empty')"
[ -n "$IP" ] || die "No server named '${SERVER_NAME}'."
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -i "$KEY")

say "New registry token"
info "Paste the token and press Enter. Nothing appears as you type."
read -r -s TOKEN
printf '\n'
[ -n "$TOKEN" ] || die "No token entered — nothing was changed."
case "$TOKEN" in
  ghp_* | github_pat_*) ;;
  *) die "That does not look like a GitHub token (expected ghp_… or github_pat_…)." ;;
esac

say "Storing it on the server and testing it"
# Written by Python rather than sed: a token is opaque text and .env also holds
# the database passwords, so a mangled substitution here costs more than a
# failed login. The value arrives as an argument, never interpolated into code.
RESULT="$(ssh "${SSH_OPTS[@]}" "root@${IP}" "python3 - '$TOKEN'" <<'PY' 2>&1
import pathlib, sys
token = sys.argv[1]
path = pathlib.Path("/opt/canei-erp/.env")
lines = path.read_text().splitlines()
out, found = [], False
for line in lines:
    if line.startswith("GHCR_TOKEN="):
        out.append("GHCR_TOKEN='" + token + "'")
        found = True
    else:
        out.append(line)
if not found:
    out.append("GHCR_TOKEN='" + token + "'")
path.write_text("\n".join(out) + "\n")
print("STORED")
PY
)"
printf '%s\n' "$RESULT" | sed 's/^/  /'
printf '%s' "$RESULT" | grep -q '^STORED' || die "The token was not stored. Nothing else was changed."

# The part that actually matters: can this token pull? A stored token that
# cannot is indistinguishable from a working one until a release silently fails
# to arrive.
say "Logging in and pulling — this is the real test"
ssh "${SSH_OPTS[@]}" "root@${IP}" "bash -s" <<PY 2>&1 | sed 's/^/  /'
set -euo pipefail
cd /opt/canei-erp
echo '${TOKEN}' | docker login ghcr.io -u '${GH_USER}' --password-stdin >/dev/null 2>&1 \
  && echo "login: OK" || { echo "login: FAILED — the token was rejected by ghcr.io"; exit 1; }
docker pull ghcr.io/stefangruber001/openproject2/app:main >/dev/null 2>&1 \
  && echo "pull:  OK" || { echo "pull:  FAILED — the token cannot read this package (tick read:packages)"; exit 1; }
PY

cat <<'EOF'

  The server can download releases again.

  Now bring it up to the latest version:

      ./ops/deploy-now.sh

EOF

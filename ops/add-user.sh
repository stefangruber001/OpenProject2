#!/usr/bin/env bash
# =============================================================================
# Give somebody an account on the ERP.
#
#   ./ops/add-user.sh maria@caneisubirats.com
#
# Asks for a password, turns it into a hash on YOUR machine, adds it to the
# server's account list and restarts the application. The password itself never
# leaves this computer and is never stored anywhere.
#
# Running it again for the same address REPLACES that person's entry, so this is
# also how you change somebody's password — including your own.
#
# This is for named accounts, which put a real name in the audit trail. The
# shared link-and-password (ERP_ACCESS_PASSWORD) is a different thing and is not
# touched here.
# =============================================================================
set -euo pipefail

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die() {
  printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

EMAIL="${1:-}"
case "$EMAIL" in
  *@*.*) ;;
  *) die "Usage: $0 someone@caneisubirats.com" ;;
esac

command -v jq >/dev/null || die "jq is required"
command -v node >/dev/null || die "node is required (brew install node)"
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

IP="$(curl -sS -H "Authorization: Bearer $HCLOUD_TOKEN" \
  "https://api.hetzner.cloud/v1/servers?name=${SERVER_NAME}" |
  jq -r '.servers[0].public_net.ipv4.ip // empty')"
[ -n "$IP" ] || die "No server named '${SERVER_NAME}'."
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -i "$KEY")

say "Password for ${EMAIL}"
info "Nothing appears as you type. At least 12 characters."
# The hash tool prints explanation as well as the entry; the entry is the one
# line containing "scrypt$". Everything else on stdout is for the human.
ENTRY="$(node apps/web/scripts/hash-password.mjs "$EMAIL" | grep 'scrypt\$' | tail -1 | tr -d '[:space:]')"
[ -n "$ENTRY" ] || die "No hash was produced — nothing was changed on the server."

say "Adding to the server's account list"

# The edit is done in Python rather than sed. A scrypt hash contains "$", "/"
# and "+", every one of which means something to sed, and .env also holds the
# database passwords — a mangled substitution here breaks more than a login.
# Python treats all of it as text.
#
# ENTRY is passed as an argument, not interpolated into the script, so nothing
# in the hash can be read as code.
RESULT="$(ssh "${SSH_OPTS[@]}" "root@${IP}" "python3 - '$ENTRY'" <<'PY' 2>&1
import pathlib, sys

entry = sys.argv[1]
email = entry.split(":", 1)[0].strip().lower()
path = pathlib.Path("/opt/canei-erp/.env")
lines = path.read_text().splitlines()

out, found = [], False
for line in lines:
    if line.startswith("ERP_USERS="):
        found = True
        raw = line[len("ERP_USERS=") :].strip()
        if raw[:1] in ("'", '"') and raw[-1:] == raw[:1]:
            raw = raw[1:-1]
        # Drop any existing entry for this address, so re-running is a password
        # change rather than a duplicate the application would have to choose
        # between.
        kept = [
            e.strip()
            for e in raw.split(",")
            if e.strip() and e.split(":", 1)[0].strip().lower() != email
        ]
        replaced = len(kept) != len([e for e in raw.split(",") if e.strip()])
        kept.append(entry)
        # SINGLE quotes: a hash contains "$16384", and ops/backup.sh sources
        # this file — inside double quotes the shell reads that as a variable.
        out.append("ERP_USERS='" + ",".join(kept) + "'")
        print(("REPLACED " if replaced else "ADDED ") + email)
        print("ACCOUNTS " + str(len(kept)))
    else:
        out.append(line)

if not found:
    out.append("ERP_USERS='" + entry + "'")
    print("ADDED " + email)
    print("ACCOUNTS 1")

# Written back in one go, after every line has been decided. A partial write
# here would leave the server with no database password.
path.write_text("\n".join(out) + "\n")
PY
)"
printf '%s\n' "$RESULT" | sed 's/^/  /'
printf '%s' "$RESULT" | grep -q '^\(ADDED\|REPLACED\) ' || die "The account list was not updated. Nothing was restarted."

say "Restarting so it takes effect"
ssh "${SSH_OPTS[@]}" "root@${IP}" \
  "cd /opt/canei-erp && docker compose -f docker-compose.prod.yml --profile pilot up -d app >/dev/null 2>&1 && sleep 3 && docker compose -f docker-compose.prod.yml ps --format '{{.Service}} {{.Status}}' | grep '^app'" </dev/null | sed 's/^/  /'

HOST="$(ssh "${SSH_OPTS[@]}" "root@${IP}" \
  "sed -n 's/^PUBLIC_HOSTNAME=//p' /opt/canei-erp/.env | tr -d '\"' | tr -d \"'\"" </dev/null)"

cat <<EOF

  ${EMAIL} can now sign in at:

      https://${HOST:-<PUBLIC_HOSTNAME not set>}

  with the password you just typed. Their changes will appear in the audit
  trail under their own address rather than a shared name.

  To change their password later, run this same command again.

EOF

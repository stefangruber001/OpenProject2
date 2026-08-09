#!/usr/bin/env bash
# =============================================================================
# Connect the company mailbox, so the ERP can put its drafts in it.
#
#   ./ops/set-email.sh if@2iberia.com
#
# Asks for the mailbox password, writes it into the server's configuration and
# restarts the application. The password is typed on THIS machine, travels over
# the SSH connection you already trust, and is stored only in the server's .env
# — never in this repository, never in a workflow log, never in a commit.
#
# WHAT THIS ENABLES, precisely: the ERP can APPEND a finished message to the
# Drafts folder of that mailbox. It cannot send. There is no SMTP anywhere in
# this codebase; the draft appears in Gmail / Outlook / Apple Mail like any
# other draft, and a person presses send after reading it.
#
# Re-running it replaces the stored password, so this is also how you rotate it.
# =============================================================================
set -euo pipefail

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die() {
  printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

ADDRESS="${1:-}"
case "$ADDRESS" in
  *@*.*) ;;
  *) die "Usage: $0 if@2iberia.com" ;;
esac

# Derived from the address unless given, because for almost every provider it is
# exactly this and asking would be ceremony. Override for a mailbox elsewhere:
#   IMAP_HOST=imap.hostinger.com ./ops/set-email.sh if@2iberia.com
DOMAIN="${ADDRESS#*@}"
IMAP_HOST="${IMAP_HOST:-imap.${DOMAIN}}"
IMAP_PORT="${IMAP_PORT:-993}"
# Empty means "ask the server which folder is Drafts", which is right nearly
# always. Set it only if drafts land somewhere unexpected.
DRAFTS="${DRAFTS:-}"

command -v jq >/dev/null || die "jq is required"
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

# The stack definition lives on the SERVER, not in the container image. If it
# predates the mailbox variables, the password lands in .env and is then passed
# to nothing — the application would report itself unconfigured with a perfectly
# good credential sitting next to it.
if ! ssh "${SSH_OPTS[@]}" "root@${IP}" \
  "grep -q ERP_MAIL_PASSWORD /opt/canei-erp/docker-compose.prod.yml" </dev/null 2>/dev/null; then
  die "The server's stack definition does not know about the mailbox variables yet.
    Run ./ops/sync-server.sh first (or Ops -> sync-server), then run this again.
    Nothing was changed."
fi

say "Mailbox"
info "address   ${ADDRESS}"
info "IMAP      ${IMAP_HOST}:${IMAP_PORT}"
info "drafts    ${DRAFTS:-(detected from the server)}"

# Two front doors, one implementation. From a laptop the password is typed and
# never echoed; from the Ops workflow it arrives in MAIL_PASSWORD out of a
# repository secret, which GitHub masks in logs. It is never a command-line
# argument in either case — that would put it in the process list.
if [ -n "${MAIL_PASSWORD:-}" ]; then
  PASSWORD="$MAIL_PASSWORD"
else
  # From the terminal rather than stdin, so this still works when the script
  # itself is piped, and -s so it is never echoed.
  printf '\n  Mailbox password for %s: ' "$ADDRESS" >&2
  read -rs PASSWORD < /dev/tty
  printf '\n' >&2
fi
[ -n "$PASSWORD" ] || die "No password given. Nothing was changed."

# ── The remote edit ──────────────────────────────────────────────────────────
# Python, not sed: a mail password may contain "$", "/", "&" and quotes, every
# one of which means something to a shell substitution — and this file also
# holds the database credentials, so a mangled edit breaks far more than email.
#
# The password reaches it on STDIN and nowhere else. Not as an argument, which
# would put it in the remote process list for anyone running `ps`; not in the
# command string, which would put it in shell history and any SSH debug log.
# The script itself is base64'd only so it can travel in the command line while
# stdin stays reserved for the secret.
PY_SRC=$(
  cat <<'PY'
import os, pathlib, sys

password = sys.stdin.read().strip()
if not password:
    print("NOCHANGE empty password")
    raise SystemExit(1)

values = {
    "ERP_MAIL_FROM": os.environ["ADDRESS"],
    "ERP_MAIL_USER": os.environ["ADDRESS"],
    "ERP_MAIL_IMAP_HOST": os.environ["HOST"],
    "ERP_MAIL_IMAP_PORT": os.environ["PORT"],
    "ERP_MAIL_DRAFTS": os.environ["DRAFTS"],
    "ERP_MAIL_PASSWORD": password,
}


def quoted(value):
    # SINGLE quotes: ops/backup.sh sources this file, and a password containing
    # "$" inside double quotes would be read as a variable and silently become
    # the empty string — a login that fails for a reason nothing explains.
    return "'" + value.replace("'", "'\\''") + "'"


path = pathlib.Path("/opt/canei-erp/.env")
lines = path.read_text().splitlines()
out, seen = [], set()
for line in lines:
    key = line.split("=", 1)[0] if "=" in line else ""
    if key in values:
        seen.add(key)
        out.append(key + "=" + quoted(values[key]))
    else:
        out.append(line)
for key, value in values.items():
    if key not in seen:
        out.append(key + "=" + quoted(value))

# One write, after every line is decided. A partial write here would leave the
# server without a database password.
path.write_text("\n".join(out) + "\n")
print("STORED " + values["ERP_MAIL_FROM"])
PY
)
PY_B64="$(printf '%s' "$PY_SRC" | base64 | tr -d '\n')"

say "Storing it on the server"
RESULT="$(printf '%s' "$PASSWORD" | ssh "${SSH_OPTS[@]}" "root@${IP}" \
  "ADDRESS='${ADDRESS}' HOST='${IMAP_HOST}' PORT='${IMAP_PORT}' DRAFTS='${DRAFTS}' \
   python3 -c \"import base64;exec(base64.b64decode('${PY_B64}'))\"" 2>&1)" || true
unset PASSWORD

printf '%s\n' "$RESULT" | sed 's/^/  /'
printf '%s' "$RESULT" | grep -q '^STORED ' || die "The mailbox was not stored. Nothing was restarted."

say "Restarting so it takes effect"
ssh "${SSH_OPTS[@]}" "root@${IP}" \
  "cd /opt/canei-erp && docker compose -f docker-compose.prod.yml --profile pilot up -d app >/dev/null 2>&1 && sleep 3 && docker compose -f docker-compose.prod.yml ps --format '{{.Service}} {{.Status}}' | grep '^app'" </dev/null | sed 's/^/  /'

cat <<EOF

  The ERP will now write its drafts to ${ADDRESS}.
  Nothing is sent — drafts appear in that mailbox for a person to read and send.

EOF

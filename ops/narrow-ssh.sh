#!/usr/bin/env bash
# =============================================================================
# Restrict SSH to the address you are calling from right now.
#
#   ./ops/narrow-ssh.sh              # lock to this machine's current IP
#   ./ops/narrow-ssh.sh 1.2.3.4      # lock to a specific address
#   ./ops/narrow-ssh.sh --open       # back to anywhere (recovery)
#
# The firewall starts open on port 22 because provisioning has to be able to
# reach a machine whose address it does not know yet. Leaving it that way means
# every scanner on the internet gets to try. This closes it.
#
# IF YOU LOCK YOURSELF OUT — a home connection's address changes, and then SSH
# stops working — you are not stranded. Hetzner's web console reaches the
# machine out-of-band, past the firewall entirely:
#
#     console.hetzner.com → canei-erp → the server → Console
#
# Or just re-run this script from the new location; it only needs the API
# token, not SSH.
# =============================================================================
set -euo pipefail

say()  { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

command -v jq   >/dev/null || die "jq is required (brew install jq)"
command -v curl >/dev/null || die "curl is required"

CONF="${CONF:-ops/provision.conf}"
[ -f "$CONF" ] || die "No $CONF — run this from the repo root."
# shellcheck disable=SC1090
set -a; . "./$CONF"; set +a
: "${HCLOUD_TOKEN:?HCLOUD_TOKEN missing from $CONF}"
FW_NAME="${FW_NAME:-canei-erp}"

hz() {
  local m="$1" p="$2" body="${3:-}"
  local args=(-sS -X "$m" "https://api.hetzner.cloud/v1$p"
              -H "Authorization: Bearer $HCLOUD_TOKEN" -H "Content-Type: application/json")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}

say "Finding the firewall"
FW="$(hz GET "/firewalls?name=${FW_NAME}")"
FW_ID="$(jq -r '.firewalls[0].id // empty' <<<"$FW")"
[ -n "$FW_ID" ] || die "No firewall named '${FW_NAME}' in this project."
info "${FW_NAME} → ${FW_ID}"
info "SSH currently allowed from: $(jq -r '[.firewalls[0].rules[] | select(.port=="22") | .source_ips[]] | join(", ")' <<<"$FW")"

if [ "${1:-}" = "--open" ]; then
  SOURCES='["0.0.0.0/0","::/0"]'
  DESC="SSH — open to the internet (recovery mode; narrow this again)"
  say "Reopening SSH to the whole internet"
else
  IP="${1:-}"
  if [ -z "$IP" ]; then
    say "Detecting your public address"
    # Two providers, because one being down should not stop you securing a box.
    IP="$(curl -sS --max-time 8 https://api.ipify.org 2>/dev/null \
       || curl -sS --max-time 8 https://ifconfig.me/ip 2>/dev/null || true)"
    IP="$(printf '%s' "$IP" | tr -d '[:space:]')"
  fi
  # Refuse anything that is not a plain IPv4 address rather than sending
  # garbage to the API and ending up with a rule that matches nothing.
  case "$IP" in
    *[!0-9.]*|"") die "Could not determine a valid IPv4 address (got '${IP:-empty}'). Pass one explicitly: $0 1.2.3.4" ;;
  esac
  [ "$(printf '%s' "$IP" | tr -cd '.' | wc -c | tr -d ' ')" = "3" ] || die "'$IP' is not an IPv4 address."
  info "$IP"
  SOURCES="$(jq -nc --arg c "${IP}/32" '[$c]')"
  DESC="SSH — ${IP}/32 only"
  say "Restricting SSH to ${IP}/32"
fi

# set_rules REPLACES every rule, so the full desired set is sent. Outbound is
# deliberately absent: with no outbound rules Hetzner allows all outbound,
# which is what the server needs to pull images and reach the registry.
RULES="$(jq -nc --argjson s "$SOURCES" --arg d "$DESC" \
  '{rules:[{direction:"in", protocol:"tcp", port:"22", source_ips:$s, description:$d}]}')"

RESP="$(hz POST "/firewalls/${FW_ID}/actions/set_rules" "$RULES")"
jq -e '.actions' >/dev/null 2>&1 <<<"$RESP" || { jq . <<<"$RESP" >&2; die "Firewall update rejected."; }

say "Confirming"
AFTER="$(hz GET "/firewalls/${FW_NAME:+?name=$FW_NAME}")"
info "SSH now allowed from: $(jq -r '[.firewalls[0].rules[] | select(.port=="22") | .source_ips[]] | join(", ")' <<<"$AFTER")"

cat <<EOF

  Test it from another terminal BEFORE closing your current session:

      ssh -i ops/.provisioned/id_ed25519 root@<SERVER_IP> true && echo "still in"

  If that fails, you are not locked out — either re-run this script from
  wherever you are now, or use the out-of-band console:
  console.hetzner.com → canei-erp → the server → Console

EOF

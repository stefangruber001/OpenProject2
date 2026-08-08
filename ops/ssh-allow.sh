#!/usr/bin/env bash
# =============================================================================
# Add or remove ONE address from the set allowed to reach SSH.
#
#   ./ops/ssh-allow.sh list
#   ./ops/ssh-allow.sh add 1.2.3.4          # or `add` with no address = yours
#   ./ops/ssh-allow.sh remove 1.2.3.4
#
# WHY THIS EXISTS SEPARATELY FROM narrow-ssh.sh. Hetzner's firewall API has one
# verb, set_rules, and it REPLACES every rule. narrow-ssh.sh uses it as intended
# — "from now on, only me" — which is right for one person at one desk and wrong
# the moment there are two: the second person runs it and locks out the first,
# silently, with no error on either side. It is also wrong for anything
# automated, which needs to let itself in for ninety seconds and then leave.
#
# So this script reads the current sources, changes exactly one entry, and
# writes the whole set back. Adding an address that is already allowed, or
# removing one that is not, is a no-op rather than an error — that matters
# because the remove half usually runs in a cleanup handler after something else
# has already failed.
#
# LOCKED OUT? You are not stranded. The firewall is managed through the API, so
# running this from wherever you are now fixes it, and Hetzner's web console
# reaches the machine out-of-band regardless:
#   console.hetzner.com -> the server -> Console
# =============================================================================
set -euo pipefail

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die() {
  printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

command -v jq >/dev/null || die "jq is required"
command -v curl >/dev/null || die "curl is required"

CONF="${CONF:-ops/provision.conf}"
if [ -f "$CONF" ]; then
  # shellcheck disable=SC1090
  set -a
  . "./$CONF"
  set +a
fi
: "${HCLOUD_TOKEN:?HCLOUD_TOKEN missing — set it in $CONF or the environment}"
FW_NAME="${FW_NAME:-canei-erp}"

hz() {
  local m="$1" p="$2" body="${3:-}"
  local args=(-sS -X "$m" "https://api.hetzner.cloud/v1$p"
    -H "Authorization: Bearer $HCLOUD_TOKEN" -H "Content-Type: application/json")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}

ACTION="${1:-list}"

FW="$(hz GET "/firewalls?name=${FW_NAME}")"
FW_ID="$(jq -r '.firewalls[0].id // empty' <<<"$FW")"
[ -n "$FW_ID" ] || die "No firewall named '${FW_NAME}' in this project."

current() {
  jq -r '[.firewalls[0].rules[]? | select(.port=="22") | .source_ips[]?] | join(", ")' <<<"$FW"
}

if [ "$ACTION" = "list" ]; then
  info "SSH allowed from: $(current)"
  exit 0
fi

case "$ACTION" in
  add | remove) ;;
  *) die "Unknown action '$ACTION'. Use: list | add [ip] | remove <ip>" ;;
esac

IP="${2:-}"
if [ -z "$IP" ]; then
  [ "$ACTION" = "remove" ] && die "remove needs an address: $0 remove 1.2.3.4"
  say "Detecting your public address"
  # Two providers, because one being down should not stop you getting in.
  IP="$(curl -sS --max-time 8 https://api.ipify.org 2>/dev/null ||
    curl -sS --max-time 8 https://ifconfig.me/ip 2>/dev/null || true)"
  IP="$(printf '%s' "$IP" | tr -d '[:space:]')"
fi
# Refuse anything that is not a plain IPv4 address rather than sending garbage
# to the API and ending up with a rule that matches nothing.
case "$IP" in
  *[!0-9.]* | "") die "Not a valid IPv4 address: '${IP:-empty}'" ;;
esac
[ "$(printf '%s' "$IP" | tr -cd '.' | wc -c | tr -d ' ')" = "3" ] || die "'$IP' is not an IPv4 address."
CIDR="${IP}/32"

info "firewall ${FW_NAME} (${FW_ID})"
info "currently: $(current)"

# Rebuild the FULL rule set — set_rules replaces everything, so any rule not
# sent here is deleted. Non-SSH rules are carried through untouched; only the
# port-22 sources change. If no SSH rule exists yet, `add` creates one.
RULES="$(jq -c --arg cidr "$CIDR" --arg act "$ACTION" '
  [ .firewalls[0].rules[]? ] as $all
  | ($all | map(select(.port == "22"))) as $ssh
  | ($all | map(select(.port != "22"))) as $rest
  | (if ($ssh | length) > 0 then ($ssh[0].source_ips // []) else [] end) as $srcs
  | (if $act == "add"
       then ($srcs + [$cidr] | unique)
       else ($srcs - [$cidr])
     end) as $next
  | { rules:
      ( $rest
        + ( if ($next | length) > 0
            then [ { direction: "in", protocol: "tcp", port: "22",
                     source_ips: $next,
                     description: ("SSH — " + ($next | join(", "))) } ]
            # Every source removed means no inbound SSH rule at all, which is
            # the correct representation of "nobody". Sending an empty
            # source_ips list would be rejected by the API.
            else [] end ) )
    }
' <<<"$FW")"

if [ "$(jq -r '.rules | map(select(.port=="22")) | length' <<<"$RULES")" = "0" ]; then
  # Allowed, because denying access is the safe direction and an automated
  # cleanup must never be blocked by a prompt. Loud, because the state it
  # leaves is not obvious from the outside — SSH simply stops working.
  printf '\n\033[1;33m  ! %s was the last allowed address. SSH is now closed to everyone.\033[0m\n' "$CIDR"
  printf '    Get back in with: %s add        (from wherever you are)\n' "$0"
  printf '    Or out-of-band:   console.hetzner.com -> the server -> Console\n'
fi

say "$([ "$ACTION" = "add" ] && echo "Allowing" || echo "Removing") ${CIDR}"
RESP="$(hz POST "/firewalls/${FW_ID}/actions/set_rules" "$RULES")"
jq -e '.actions' >/dev/null 2>&1 <<<"$RESP" || {
  jq . <<<"$RESP" >&2
  die "Firewall update rejected."
}

FW="$(hz GET "/firewalls?name=${FW_NAME}")"
info "now allowed: $(current)"

#!/usr/bin/env bash
# =============================================================================
# Open ports 80 and 443 so the ERP can be reached from a phone.
#
#   ./ops/open-web.sh              # open, after checking sign-in is configured
#   ./ops/open-web.sh --close      # take it back off the internet
#
# THIS IS THE ONE SCRIPT THAT EXPOSES THE COMPANY'S DATA TO THE INTERNET, so it
# checks first, on the machine, that:
#
#   • a way to sign in exists in the server's .env — named accounts and/or the
#     shared password, plus SESSION_SECRET — and
#   • the running application actually redirects an anonymous request to a
#     login page rather than serving the workspace.
#
# The second check is the one that matters. Configuration being present proves
# somebody intended a login; only a request proves there is one. An application
# that was rebuilt without the middleware, or started before the variables were
# added, looks perfectly healthy and is wide open.
#
# It refuses to open anything if either check fails. --close needs no checks:
# closing is always safe.
# =============================================================================
set -euo pipefail

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '  \033[1;33m! %s\033[0m\n' "$*"; }
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
SERVER_NAME="${SERVER_NAME:-canei-erp-prod}"
KEY="${KEY:-ops/.provisioned/id_ed25519}"

hz() {
  local m="$1" p="$2" body="${3:-}"
  local args=(-sS -X "$m" "https://api.hetzner.cloud/v1$p"
    -H "Authorization: Bearer $HCLOUD_TOKEN" -H "Content-Type: application/json")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}

CLOSING=0
[ "${1:-}" = "--close" ] && CLOSING=1

FW="$(hz GET "/firewalls?name=${FW_NAME}")"
FW_ID="$(jq -r '.firewalls[0].id // empty' <<<"$FW")"
[ -n "$FW_ID" ] || die "No firewall named '${FW_NAME}'."

if [ "$CLOSING" = "0" ]; then
  IP="$(hz GET "/servers?name=${SERVER_NAME}" | jq -r '.servers[0].public_net.ipv4.ip // empty')"
  [ -n "$IP" ] || die "No server named '${SERVER_NAME}'."
  SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -i "$KEY")

  say "Checking that a login exists before opening anything"

  # Read the two values without sourcing: .env holds human-entered text, and one
  # unquoted value with a space in it would run as a command.
  CFG="$(ssh "${SSH_OPTS[@]}" "root@${IP}" bash -s <<'EOS' 2>/dev/null
cd /opt/canei-erp || exit 0
u="$(sed -n 's/^ERP_USERS=//p' .env | tr -d '"' | tr -d "'")"
a="$(sed -n 's/^ERP_ACCESS_PASSWORD=//p' .env | tr -d '"' | tr -d "'")"
s="$(sed -n 's/^SESSION_SECRET=//p' .env | tr -d '"' | tr -d "'")"
h="$(sed -n 's/^PUBLIC_HOSTNAME=//p' .env | tr -d '"' | tr -d "'")"
echo "HOST=$h"
# Either named accounts or the shared password is a login. Requiring ERP_USERS
# would refuse to publish a server reached only through the shared link, which
# is a legitimate setup.
{ [ -n "$u" ] || [ -n "$a" ]; } && echo "USERS=yes" || echo "USERS=no"
[ -n "$s" ] && echo "SECRET=yes" || echo "SECRET=no"
# What an anonymous browser actually gets. -o /dev/null -w '%{http_code}' with
# no -L so a redirect is visible as a redirect rather than followed silently.
code="$(docker compose -f docker-compose.prod.yml exec -T app \
  node -e 'fetch("http://127.0.0.1:3000/workspace/erp.html",{redirect:"manual"}).then(r=>console.log(r.status)).catch(()=>console.log("ERR"))' \
  </dev/null 2>/dev/null | tail -1)"
echo "ANON=$code"
EOS
  )"
  val() { printf '%s\n' "$CFG" | sed -n "s/^$1=//p" | head -1; }

  [ "$(val USERS)" = "yes" ] || die "Neither ERP_USERS nor ERP_ACCESS_PASSWORD is set in the server's .env — there is no way to sign in, so there is no login. See docs/PILOT-WITHOUT-CLOUDFLARE.md"
  [ "$(val SECRET)" = "yes" ] || die "SESSION_SECRET is not set in the server's .env — sessions cannot be signed. See docs/PILOT-WITHOUT-CLOUDFLARE.md"
  info "sign-in is configured (accounts and/or shared password, plus SESSION_SECRET)"

  ANON="$(val ANON)"
  case "$ANON" in
    200)
      die "The running application served the workspace to a request with no session (HTTP 200).
     Configuration says there should be a login, and there is not — most likely the
     container predates it. Deploy the current image, then run this again.
     NOTHING WAS OPENED." ;;
    30[1237] | 401)
      info "an anonymous request is turned away (HTTP ${ANON})" ;;
    "" | ERR)
      die "Could not ask the application what it does with an anonymous request.
     Refusing to open the firewall on an unverified assumption. NOTHING WAS OPENED." ;;
    *)
      die "Unexpected response ${ANON} to an anonymous request — expected a redirect to the
     login page. NOTHING WAS OPENED." ;;
  esac
fi

# Rebuild the FULL rule set: set_rules replaces everything, so rules not sent
# here are deleted. SSH and anything else are carried through untouched.
RULES="$(jq -c --argjson open "$([ "$CLOSING" = "0" ] && echo true || echo false)" '
  [ .firewalls[0].rules[]? ] as $all
  | ($all | map(select(.port != "80" and .port != "443"))) as $rest
  | { rules: ( $rest + ( if $open then
        [ {direction:"in", protocol:"tcp", port:"80",  source_ips:["0.0.0.0/0","::/0"],
           description:"HTTP — ACME certificate issuance and redirect to HTTPS"},
          {direction:"in", protocol:"tcp", port:"443", source_ips:["0.0.0.0/0","::/0"],
           description:"HTTPS — the ERP (behind its own login)"} ]
      else [] end ) ) }
' <<<"$FW")"

say "$([ "$CLOSING" = "0" ] && echo "Opening 80 and 443" || echo "Closing 80 and 443")"
RESP="$(hz POST "/firewalls/${FW_ID}/actions/set_rules" "$RULES")"
jq -e '.actions' >/dev/null 2>&1 <<<"$RESP" || {
  jq . <<<"$RESP" >&2
  die "Firewall update rejected."
}

AFTER="$(hz GET "/firewalls?name=${FW_NAME}")"
info "inbound now: $(jq -r '[.firewalls[0].rules[]? | select(.direction=="in") | .port] | join(", ")' <<<"$AFTER")"

if [ "$CLOSING" = "0" ]; then
  URL="https://$(val HOST)"
  [ "$URL" = "https://" ] && URL="https://<PUBLIC_HOSTNAME is not set in the server's .env>"
  cat <<EOF

  The ERP is now reachable from the internet, behind its own login.

  Give it a minute: Caddy has to obtain a certificate on first request, and
  that only works once port 80 is genuinely open — which it now is.

  Check from a phone, on mobile data rather than the office wifi, so you are
  testing the real path:

      ${URL}

  To take it back off the internet at any time:

      ./ops/open-web.sh --close

EOF
else
  info "The ERP is no longer reachable from the internet. SSH is unaffected."
fi

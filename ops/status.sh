#!/usr/bin/env bash
# =============================================================================
# One command that answers "is the ERP actually alright?"
#
#   ./ops/status.sh
#
# Written to be run by whoever is on duty, including someone who has never seen
# this system. Every line is either OK, a warning, or a problem, and the ones
# that are not OK say what to do about it.
#
# It checks two sides that can disagree: what Hetzner believes (the server
# exists, backups are on, the firewall is narrow) and what is actually true on
# the machine (containers up, database reachable, timers armed, backups on
# disk, room to write more). A green console page and a dead application look
# identical from the outside.
# =============================================================================
set -uo pipefail

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[1;31m'; GRN=$'\033[1;32m'; YEL=$'\033[1;33m'; OFF=$'\033[0m'
ok()   { printf '  %s✓%s %s\n' "$GRN" "$OFF" "$*"; }
warn() { printf '  %s!%s %s\n' "$YEL" "$OFF" "$*"; WARNINGS=$((WARNINGS+1)); }
bad()  { printf '  %s✗%s %s\n' "$RED" "$OFF" "$*"; PROBLEMS=$((PROBLEMS+1)); }
head_() { printf '\n%s%s%s\n' "$BOLD" "$*" "$OFF"; }
WARNINGS=0; PROBLEMS=0

command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }
CONF="${CONF:-ops/provision.conf}"
[ -f "$CONF" ] || { echo "Run this from the repo root (no $CONF)."; exit 1; }
# shellcheck disable=SC1090
set -a; . "./$CONF"; set +a
: "${HCLOUD_TOKEN:?HCLOUD_TOKEN missing from $CONF}"
SERVER_NAME="${SERVER_NAME:-canei-erp-prod}"
FW_NAME="${FW_NAME:-canei-erp}"
KEY="${KEY:-ops/.provisioned/id_ed25519}"

hz() { curl -sS -H "Authorization: Bearer $HCLOUD_TOKEN" "https://api.hetzner.cloud/v1$1"; }

# ── What Hetzner says ────────────────────────────────────────────────────────
head_ "Hetzner"
SRV="$(hz "/servers?name=${SERVER_NAME}")"
IP="$(jq -r '.servers[0].public_net.ipv4.ip // empty' <<<"$SRV")"
if [ -z "$IP" ]; then
  bad "No server named ${SERVER_NAME}. Nothing else can be checked."
  exit 1
fi
STATUS="$(jq -r '.servers[0].status' <<<"$SRV")"
TYPE="$(jq -r '.servers[0].server_type.name' <<<"$SRV")"
[ "$STATUS" = "running" ] && ok "${SERVER_NAME} (${TYPE}) is ${STATUS} at ${IP}" \
                          || bad "${SERVER_NAME} is ${STATUS} — expected running"

if [ "$(jq -r '.servers[0].backup_window // "null"' <<<"$SRV")" = "null" ]; then
  bad "Automated backups are OFF — console → ${SERVER_NAME} → Backups → Enable"
  printf '      %sRight now the encrypted dumps live on the same disk as the database.%s\n' "$DIM" "$OFF"
else
  ok "Automated backups ON (Hetzner takes them in the $(jq -r '.servers[0].backup_window' <<<"$SRV") UTC window)"
fi

SSH_SRC="$(hz "/firewalls?name=${FW_NAME}" | jq -r '[.firewalls[0].rules[]? | select(.port=="22") | .source_ips[]] | join(", ")')"
case "$SSH_SRC" in
  *0.0.0.0/0*) warn "SSH is open to the whole internet — ./ops/narrow-ssh.sh" ;;
  "")          warn "No SSH rule found on firewall ${FW_NAME}" ;;
  *)           ok "SSH restricted to ${SSH_SRC}" ;;
esac

# ── What the machine says ────────────────────────────────────────────────────
head_ "The server"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new -i "$KEY")
if ! ssh "${SSH_OPTS[@]}" "root@${IP}" true 2>/dev/null; then
  bad "Cannot SSH to ${IP}."
  printf '      %sIf your address changed, re-run ./ops/narrow-ssh.sh — it needs no SSH.%s\n' "$DIM" "$OFF"
  printf '      %sOut-of-band: console.hetzner.com → the server → Console%s\n' "$DIM" "$OFF"
  exit 1
fi

REMOTE="$(ssh "${SSH_OPTS[@]}" "root@${IP}" bash -s <<'EOS' 2>/dev/null
cd /opt/canei-erp || { echo "NODIR"; exit 0; }
C="docker compose -f docker-compose.prod.yml"
echo "RUNNING=$($C ps --services --filter status=running 2>/dev/null | tr '\n' ',')"
echo "ONESHOT=$($C ps -a --format '{{.Service}}:{{.ExitCode}}' 2>/dev/null | grep -E '^(migrate|db-role):' | tr '\n' ',')"
echo "HEALTH=$($C exec -T app node -e 'fetch("http://127.0.0.1:3000/api/health").then(r=>r.text()).then(t=>console.log(t.replace(/\s+/g,"")))' </dev/null 2>/dev/null | tail -1)"
echo "WORKSPACE=$($C exec -T app node -e 'fetch("http://127.0.0.1:3000/workspace/erp.html").then(r=>console.log(r.status))' </dev/null 2>/dev/null | tail -1)"
echo "BYPASS=$($C exec -T db psql -U "${POSTGRES_USER:-canei}" -d "${POSTGRES_DB:-canei_erp}" -tAc "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname='${APP_DB_USER:-canei_app}'" </dev/null 2>/dev/null | tr -d ' ')"
echo "TENANTS=$($C exec -T db psql -U "${POSTGRES_USER:-canei}" -d "${POSTGRES_DB:-canei_erp}" -tAc "SELECT count(*) FROM erp_state" </dev/null 2>/dev/null | tr -d ' ')"
echo "DEPLOYTIMER=$(systemctl is-active canei-deploy.timer 2>/dev/null)"
echo "BACKUPTIMER=$(systemctl is-active canei-backup.timer 2>/dev/null)"
echo "LASTBACKUP=$(ls -t backups/*.age 2>/dev/null | head -1)"
echo "BACKUPAGE=$(find backups -name '*.age' -mtime -2 2>/dev/null | wc -l | tr -d ' ')"
echo "BACKUPCOUNT=$(ls backups/*.age 2>/dev/null | wc -l | tr -d ' ')"
echo "DISK=$(df -P / | awk 'NR==2{print $5}' | tr -d '%')"
echo "IMAGE=$(docker inspect --format '{{index .Config.Image}}' canei-erp-app-1 2>/dev/null)"
EOS
)"
val() { printf '%s\n' "$REMOTE" | sed -n "s/^$1=//p" | head -1; }

if [ "$(val NODIR)" = "" ] && printf '%s' "$REMOTE" | grep -q NODIR; then
  bad "/opt/canei-erp does not exist on the server"; exit 1
fi

case ",$(val RUNNING)," in
  *,app,*) : ;; *) bad "The app container is not running" ;;
esac
case ",$(val RUNNING)," in
  *,db,*)  : ;; *) bad "The database container is not running" ;;
esac
[ -n "$(val RUNNING)" ] && ok "Containers running: $(val RUNNING | sed 's/,$//')"

ONESHOT="$(val ONESHOT)"
if printf '%s' "$ONESHOT" | grep -qE '(migrate|db-role):[1-9]'; then
  bad "A start-up step failed: ${ONESHOT%,}"
else
  ok "Migrations and role hardening completed cleanly (${ONESHOT%,})"
fi

H="$(val HEALTH)"
case "$H" in
  *'"status":"ok"'*'"database":"connected"'*) ok "App healthy, database connected" ;;
  "") bad "No response from the app's health endpoint" ;;
  *)  bad "Unhealthy: $H" ;;
esac

[ "$(val WORKSPACE)" = "200" ] && ok "Workspace UI served (HTTP 200)" \
                               || bad "Workspace UI returned '$(val WORKSPACE)' — expected 200"

case "$(val BYPASS)" in
  f) ok "Application database role cannot bypass row-level security" ;;
  t) bad "The app's database role CAN bypass row-level security — tenant isolation is not real" ;;
  *) warn "Could not determine whether the app's role bypasses RLS" ;;
esac

T="$(val TENANTS)"
[ -n "$T" ] && ok "erp_state holds ${T} tenant document(s)" || warn "Could not read erp_state"

[ "$(val DEPLOYTIMER)" = "active" ] && ok "Auto-deploy timer active (pulls new images every 60s)" \
                                    || warn "Auto-deploy timer is $(val DEPLOYTIMER)"
[ "$(val BACKUPTIMER)" = "active" ] && ok "Nightly backup timer active (02:30 UTC)" \
                                    || warn "Backup timer is $(val BACKUPTIMER)"

head_ "Backups on the machine"
BC="$(val BACKUPCOUNT)"; BA="$(val BACKUPAGE)"
if [ "${BC:-0}" -eq 0 ]; then
  warn "No encrypted dumps yet — the first runs tonight at 02:30 UTC"
  printf '      %sTo take one now: ssh … root@%s systemctl start canei-backup.service%s\n' "$DIM" "$IP" "$OFF"
elif [ "${BA:-0}" -eq 0 ]; then
  bad "${BC} dumps present but none newer than 48h — the backup job has stopped"
else
  ok "${BC} encrypted dumps, most recent $(basename "$(val LASTBACKUP)")"
fi

D="$(val DISK)"
if [ -n "$D" ]; then
  [ "$D" -lt 80 ] && ok "Disk ${D}% used" || bad "Disk ${D}% used — backups will start failing"
fi

head_ "Summary"
printf '  running image: %s\n' "$(val IMAGE)"
if [ "$PROBLEMS" -gt 0 ]; then
  printf '\n  %s%d problem(s)%s and %d warning(s). Address the ✗ lines first.\n\n' "$RED" "$PROBLEMS" "$OFF" "$WARNINGS"
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  printf '\n  %sNo problems, %d warning(s).%s\n\n' "$YEL" "$WARNINGS" "$OFF"
else
  printf '\n  %sEverything checks out.%s\n\n' "$GRN" "$OFF"
fi

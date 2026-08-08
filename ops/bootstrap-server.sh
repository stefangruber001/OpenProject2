#!/usr/bin/env bash
# =============================================================================
# One-time setup of a fresh Hetzner (or any Debian 12/Ubuntu 24.04) server.
#
# Run ONCE, as root, on a brand-new box:
#
#   apt-get update && apt-get install -y git
#   git clone https://<user>:<token>@github.com/OWNER/REPO.git /opt/canei-erp
#
# NOTE the credentials in that URL: the repository is PRIVATE, so a plain
# anonymous clone fails with "Repository not found" and the machine ends up
# with no compose file and no containers. The token needs `repo` scope, which
# is why the automated path (ops/provision.sh) does NOT clone at all — it
# inlines the four files the server needs into cloud-init and keeps the only
# credential on the box scoped to read:packages.
#   cd /opt/canei-erp && bash ops/bootstrap-server.sh
#
# Idempotent: safe to re-run. Does NOT start the app — you still need to write
# /opt/canei-erp/.env first (see .env.production.example), then:
#   docker compose -f docker-compose.prod.yml up -d
# =============================================================================
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }

APP_DIR="${APP_DIR:-/opt/canei-erp}"
APP_USER="${APP_USER:-canei}"

echo "── 1/7  System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl gnupg git ufw age awscli \
  unattended-upgrades apt-listchanges jq

echo "── 2/7  Docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "── 3/7  Unattended security upgrades"
# Security patches apply themselves and the box reboots at 04:00 if a kernel
# update needs it. This is the single highest-value thing on an unattended
# server: most compromises are unpatched known CVEs, not clever attacks.
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/51unattended-upgrades-local <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
EOF
systemctl enable --now unattended-upgrades

echo "── 4/7  Firewall"
# Everything inbound is denied except SSH. The app is reachable only through
# the Cloudflare tunnel, which dials OUT — there is no inbound rule for it and
# there must never be one. If you are tempted to open 80/443, don't.
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH — restrict to a known IP once you have one'
ufw --force enable
ufw status verbose

echo "── 5/7  Service user"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
usermod -aG docker "$APP_USER"
mkdir -p "$APP_DIR/backups"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "── 6/7  Auto-deploy timer (pull-based, no inbound access)"
# CI pushes images to GHCR; this box pulls them. That is why the deploy
# workflow needs no SSH key and no open port.
cat > /etc/systemd/system/canei-deploy.service <<EOF
[Unit]
Description=Pull the latest Canei ERP images and restart if they changed
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml pull --quiet
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d --remove-orphans
ExecStart=/usr/bin/docker image prune -f
EOF
cat > /etc/systemd/system/canei-deploy.timer <<'EOF'
[Unit]
Description=Check for new Canei ERP images every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=60s
AccuracySec=15s

[Install]
WantedBy=timers.target
EOF

echo "── 7/7  Nightly backup timer"
cat > /etc/systemd/system/canei-backup.service <<EOF
[Unit]
Description=Encrypted Canei ERP database backup to Cloudflare R2
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/ops/backup.sh
EOF
cat > /etc/systemd/system/canei-backup.timer <<'EOF'
[Unit]
Description=Nightly Canei ERP backup

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
EOF

chmod +x "$APP_DIR"/ops/*.sh
systemctl daemon-reload
systemctl enable canei-backup.timer
# The deploy timer stays DISABLED until .env exists — otherwise it would loop
# on a broken compose file every minute and fill the journal.
echo
echo "──────────────────────────────────────────────────────────────────────"
echo "Server is ready. Remaining steps, in order:"
echo
echo "  1. cp .env.production.example .env  &&  \$EDITOR .env"
echo "  2. docker login ghcr.io -u <github-user>       (if the repo is private)"
echo "  3. docker compose -f docker-compose.prod.yml up -d"
echo "  4. curl -s localhost:3000/api/health            (via: docker compose exec app …)"
echo "  5. systemctl enable --now canei-deploy.timer    (turns on auto-deploy)"
echo "  6. systemctl start canei-backup.service         (prove a backup works TODAY)"
echo
echo "Then restrict SSH:  ufw allow from <your.ip> to any port 22 && ufw delete allow 22/tcp"
echo "──────────────────────────────────────────────────────────────────────"

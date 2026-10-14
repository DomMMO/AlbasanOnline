#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu/Debian Hetzner server. Run as root:
#   ssh root@SERVER 'bash -s' < deploy/server-setup.sh
set -euo pipefail

# Docker Engine + Compose plugin.
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# Firewall: SSH + HTTP/HTTPS only. Postgres and the game port stay inside Docker.
apt-get update -y
apt-get install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# Small servers: 2 GB swap so the Vite build doesn't run out of memory.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

mkdir -p /opt/mmo
if [ ! -f /opt/mmo/.env ]; then
  echo "DOMAIN=CHANGE_ME" > /opt/mmo/.env
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" >> /opt/mmo/.env
  chmod 600 /opt/mmo/.env
  echo ">>> /opt/mmo/.env created; set DOMAIN in it."
fi
# Nightly database dump at 02:00 UTC (05:00 Turkey); /opt/mmo/backup.sh arrives with the first deploy.
cat > /etc/cron.d/mmo-backup <<'CRON'
0 2 * * * root [ -x /opt/mmo/backup.sh ] && /opt/mmo/backup.sh >> /var/log/mmo-backup.log 2>&1
CRON

echo ">>> Server ready."

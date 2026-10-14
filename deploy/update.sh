#!/usr/bin/env bash
# Server side of a deploy, installed at /opt/mmo/update.sh. Reads a .tar.gz of the code on
# stdin, swaps it into /opt/mmo/app and rebuilds. The GitHub Actions key may run only this.
# Licensed assets (not in git) are kept in /opt/mmo/licensed and copied into every build.
set -euo pipefail
cd /opt/mmo
exec 9>/opt/mmo/.deploy.lock
flock 9

rm -rf app.new && mkdir app.new
tar -xzf - -C app.new
if [ -d licensed ]; then
  mkdir -p app.new/client/src/assets/licensed
  cp -a licensed/. app.new/client/src/assets/licensed/
fi
rm -rf app.old
[ -d app ] && mv app app.old
mv app.new app
rm -rf app.old

cd app
docker compose -p mmo --env-file /opt/mmo/.env up -d --build --remove-orphans
docker image prune -f >/dev/null
docker compose -p mmo --env-file /opt/mmo/.env ps

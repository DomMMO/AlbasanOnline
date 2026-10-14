#!/usr/bin/env bash
# Ship the current working tree (plus the licensed assets that are not in git) to the
# server and rebuild. Usage: deploy/deploy.sh root@SERVER
# Code lives in /opt/mmo/app (replaced on every deploy); secrets stay in /opt/mmo/.env.
set -euo pipefail
TARGET="${1:?usage: deploy/deploy.sh user@host}"
cd "$(dirname "$0")/.."

# Tracked + untracked-but-not-ignored files, and the git-ignored licensed assets.
{ git ls-files -co --exclude-standard; [ -d client/src/assets/licensed ] && find client/src/assets/licensed -type f; } \
  | sort -u | tar -czf - -T - \
  | ssh "$TARGET" 'set -e; cd /opt/mmo; rm -rf app.new; mkdir app.new; tar -xzf - -C app.new; \
      rm -rf app.old; [ -d app ] && mv app app.old; mv app.new app; rm -rf app.old'

ssh "$TARGET" 'cd /opt/mmo/app && docker compose -p mmo --env-file /opt/mmo/.env up -d --build \
  && docker image prune -f >/dev/null && docker compose -p mmo --env-file /opt/mmo/.env ps'

#!/usr/bin/env bash
# Replace the live database with a dump. Run on the server:
#   /opt/mmo/app/deploy/restore.sh /opt/mmo/backups/mmo-YYYYMMDD-HHMM.dump
# The game server is stopped meanwhile so nobody writes to the old data.
set -euo pipefail
DUMP="${1:?usage: restore.sh <dump file>}"
[ -f "$DUMP" ] || { echo "no such file: $DUMP"; exit 1; }
cd /opt/mmo/app
COMPOSE="docker compose -p mmo --env-file /opt/mmo/.env"

/opt/mmo/backup.sh   # safety copy of what is about to be replaced
$COMPOSE stop app
docker exec -i mmo-db-1 pg_restore -U mmo -d mmo --clean --if-exists --no-owner < "$DUMP"
$COMPOSE start app
echo "restored $DUMP"

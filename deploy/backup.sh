#!/usr/bin/env bash
# Nightly database dump, installed at /opt/mmo/backup.sh and run by /etc/cron.d/mmo-backup.
# pg_dump reads a consistent snapshot while the game keeps running.
# Restore: deploy/restore.sh (see README).
set -euo pipefail
umask 077  # dumps hold password hashes
DIR=/opt/mmo/backups
KEEP_DAYS=14
mkdir -p "$DIR"
chmod 700 "$DIR"

FILE="$DIR/mmo-$(date -u +%Y%m%d-%H%M).dump"
docker exec mmo-db-1 pg_dump -U mmo -d mmo --format=custom > "$FILE.part"
mv "$FILE.part" "$FILE"
find "$DIR" -name 'mmo-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "$(date -u +%FT%TZ) ok $(du -h "$FILE" | cut -f1) $FILE"

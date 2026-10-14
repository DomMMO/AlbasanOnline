#!/usr/bin/env bash
# Manual deploy of the current working tree (uncommitted changes included).
# Usage: deploy/deploy.sh root@SERVER. Pushes to main deploy on their own (.github/workflows/deploy.yml).
set -euo pipefail
TARGET="${1:?usage: deploy/deploy.sh user@host}"
cd "$(dirname "$0")/.."

# The server-side script, and the licensed assets that are not in git.
ssh "$TARGET" 'cat > /opt/mmo/update.sh && chmod +x /opt/mmo/update.sh' < deploy/update.sh
if [ -d client/src/assets/licensed ]; then
  tar -czf - -C client/src/assets/licensed . \
    | ssh "$TARGET" 'rm -rf /opt/mmo/licensed && mkdir -p /opt/mmo/licensed && tar -xzf - -C /opt/mmo/licensed'
fi

# Tracked + untracked-but-not-ignored files.
git ls-files -co --exclude-standard | tar -czf - -T - | ssh "$TARGET" /opt/mmo/update.sh

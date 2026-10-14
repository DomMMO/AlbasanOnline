#!/usr/bin/env bash
# Puts the Godot client's web build on the server: it is the game at https://<domain>/.
# Usage: deploy/deploy-godot.sh root@SERVER [path/to/web-build]
#
# The build (index.html, .wasm, .pck...) is kept in /opt/mmo/godot-web and copied into
# client/public/ on every deploy by update.sh, like the licensed assets. The app is rebuilt
# from the code the server already runs, so nothing else changes. Export the build from the
# same code as the server (the Godot data must match the server's maps).
set -euo pipefail
TARGET="${1:?usage: deploy/deploy-godot.sh user@host [build dir]}"
cd "$(dirname "$0")/.."
BUILD="${2:-build/godot-web}"
[ -f "$BUILD/index.html" ] || { echo "no web build in $BUILD"; exit 1; }

# Install the update script that knows about the Godot build.
ssh "$TARGET" 'cat > /opt/mmo/update.sh && chmod +x /opt/mmo/update.sh' < deploy/update.sh
tar -czf - -C "$BUILD" . | ssh "$TARGET" 'rm -rf /opt/mmo/godot-web.new && mkdir -p /opt/mmo/godot-web.new && tar -xzf - -C /opt/mmo/godot-web.new && rm -rf /opt/mmo/godot-web && mv /opt/mmo/godot-web.new /opt/mmo/godot-web'
# Rebuild with the server's current code, minus the previous build's copies (update.sh adds
# the licensed assets and the new Godot build).
ssh "$TARGET" "tar -czf - -C /opt/mmo/app --exclude=./client/src/assets/licensed --exclude=./client/public/oyun --exclude='./client/public/index.*' --exclude=./node_modules . | /opt/mmo/update.sh"

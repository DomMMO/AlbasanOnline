import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// In production the game is the Godot web build, which deploy/update.sh copies into public/
// (index.html, index.wasm, index.pck...); then the old web client is not built at all.
const godotBuild = existsSync(resolve(__dirname, "public/index.html"));

export default defineConfig({
  build: {
    rollupOptions: {
      // The game (unless the Godot build replaces it), the GM panel and the GM map editor.
      input: {
        ...(godotBuild ? {} : { main: resolve(__dirname, "index.html") }),
        admin: resolve(__dirname, "admin.html"),
        editor: resolve(__dirname, "editor.html"),
      },
    },
  },
  server: {
    // Expose on the LAN so the game can be opened from a phone on the same network.
    host: true,
    port: 5173,
    fs: { allow: [".."] },
    // Same-origin API in dev; in production a reverse proxy does the same.
    proxy: { "/api": "http://localhost:2567" },
  },
});

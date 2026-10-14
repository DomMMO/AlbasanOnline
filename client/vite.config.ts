import { resolve } from "node:path";
import { defineConfig } from "vite";

// The game is the Godot client (yeni-oyun-projesi/); its web build is copied into public/ by
// deploy/update.sh and served at the site root. This client builds only the GM pages.
export default defineConfig({
  build: {
    rollupOptions: {
      // The GM panel and the GM map editor.
      input: { admin: resolve(__dirname, "admin.html"), editor: resolve(__dirname, "editor.html") },
    },
  },
  server: {
    host: true,
    port: 5173,
    fs: { allow: [".."] },
    // Same-origin API in dev; in production a reverse proxy does the same.
    proxy: { "/api": "http://localhost:2567" },
  },
});

import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      // Two pages: the game and the GM panel.
      input: { main: resolve(__dirname, "index.html"), admin: resolve(__dirname, "admin.html") },
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

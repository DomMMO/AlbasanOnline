import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

// Dev server for the Godot bake (tools/godot/bake.mjs): serves bake.html and writes what the
// page sends (POST /__bake/write, header x-path) into the Godot project.

const OUT = resolve(__dirname, process.env.GODOT_OUT ?? "../yeni-oyun-projesi");
const API = process.env.BAKE_API ?? "https://albasanonline.com";

function bakeWriter(): Plugin {
  return {
    name: "godot-bake-writer",
    configureServer(server) {
      server.middlewares.use("/__bake", (req, res) => {
        if (req.method !== "POST") return void res.writeHead(405).end();
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          const path = String(req.headers["x-path"] ?? "");
          if (req.url === "/log") {
            process.stdout.write(`[bake] ${Buffer.concat(chunks).toString("utf8")}\n`);
          } else if (req.url === "/done") {
            writeFileSync(resolve(OUT, ".bake-done"), Buffer.concat(chunks));
          } else if (path && !path.includes("..")) {
            const file = resolve(OUT, path);
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, Buffer.concat(chunks));
          } else {
            return void res.writeHead(400).end();
          }
          res.writeHead(200).end("ok");
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [bakeWriter()],
  server: {
    port: 5190,
    strictPort: true,
    fs: { allow: [".."] },
    // Map edits and uploaded tile art come from the live server, so the bake matches it.
    proxy: { "/api": { target: API, changeOrigin: true } },
  },
});

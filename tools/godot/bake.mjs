// Bakes the game's art and data for the Godot client (yeni-oyun-projesi):
//   node tools/godot/bake.mjs [--zones town,world] [--quick] [--api https://albasanonline.com]
// --quick skips the icons and UI pictures (the map editor bakes a zone this way).
// Starts a Vite server for client/bake.html, opens it in headless Chrome (the page draws every
// zone with the Phaser code and posts the results back), waits until it is done, then copies
// the third-party art sheets (mobs, items, decor, fonts) into the Godot project.

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "yeni-oyun-projesi");
const DONE = join(OUT, ".bake-done");
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const zones = arg("zones");
const api = arg("api") ?? "https://albasanonline.com";
const quick = args.includes("--quick");

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find(existsSync);
if (!CHROME) throw new Error("Chrome not found");

rmSync(DONE, { force: true });
if (!zones) {
  // A full bake replaces the old zones and decor (stale pictures would pile up otherwise).
  for (const dir of ["art/zones", "art/decor", "data/zones"]) rmSync(join(OUT, dir), { recursive: true, force: true });
}

const vite = spawn(process.execPath, [join(ROOT, "node_modules/vite/bin/vite.js"), "--config", "vite.bake.config.ts"], {
  cwd: join(ROOT, "client"),
  env: { ...process.env, BAKE_API: api, GODOT_OUT: OUT },
  stdio: ["ignore", "pipe", "inherit"],
});
vite.stdout.on("data", (d) => {
  const text = d.toString();
  for (const line of text.split("\n")) if (line.startsWith("[bake]")) console.log(line);
});

/** Recursive copy (fs.cpSync crashes Node 25 on this Windows path). */
function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    if (statSync(src).isDirectory()) copyTree(src, join(to, name));
    else copyFileSync(src, join(to, name));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch("http://localhost:5190/bake.html");
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error("vite did not start");
}

let chrome;
function cleanup() {
  chrome?.kill();
  vite.kill();
}
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));

try {
  await waitForServer();
  const profile = join(tmpdir(), `godot-bake-${Date.now()}`);
  mkdirSync(profile, { recursive: true });
  // The page echoes this id into the done marker, so a stale marker is never taken for this run.
  const runId = String(Date.now());
  const url = `http://localhost:5190/bake.html?run=${runId}${zones ? `&zones=${zones}` : ""}${quick ? "&quick=1" : ""}`;
  chrome = spawn(
    CHROME,
    ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox", `--user-data-dir=${profile}`, "--window-size=800,600", "--remote-debugging-port=9333", url],
    { stdio: "ignore" },
  );
  const started = Date.now();
  let result = "";
  for (;;) {
    if (Date.now() - started > 30 * 60_000) throw new Error("bake timed out");
    await sleep(1000);
    if (!existsSync(DONE)) continue;
    const [run, ...rest] = readFileSync(DONE, "utf8").split(" ");
    if (run !== runId) continue;
    result = rest.join(" ");
    break;
  }
  rmSync(DONE, { force: true });
  if (result !== "ok") throw new Error(result);

  // Third-party art kept out of the repository (client/src/assets/licensed): copied as is.
  const licensed = join(ROOT, "client/src/assets/licensed");
  for (const dir of ["mobs", "bosses", "items", "decor", "fonts", "music"]) {
    const from = join(licensed, dir);
    if (!existsSync(from) || readdirSync(from).length === 0) continue;
    copyTree(from, join(OUT, "art/licensed", dir));
  }
  console.log("[bake] finished");
} finally {
  cleanup();
}

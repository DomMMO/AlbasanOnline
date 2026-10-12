// Stops everything `npm run dev` started: the database (cleanly, so no data is lost),
// the game server and the client dev server. Also catches leftovers from earlier
// runs that didn't shut down (on Windows, child processes can outlive their parent).
// Usage: npm run stop

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const asciiHome = path.join(process.env.LOCALAPPDATA ?? os.homedir(), "mmo-creation");
const isAscii = (p: string) => /^[\x00-\x7F]*$/.test(p);

// 1. Database: same locations dev-db.ts uses.
const repoDataDir = path.join(root, ".data", "postgres");
const dataDir = process.env.MMO_DB_DIR ?? (isAscii(repoDataDir) ? repoDataDir : path.join(asciiHome, "data"));
const exe = process.platform === "win32" ? ".exe" : "";
// The binaries were copied to %LOCALAPPDATA%\mmo-creation\postgres-<version> by dev-db.ts.
const pgCtlCandidates = existsSync(asciiHome)
  ? readdirSync(asciiHome)
      .filter((name) => name.startsWith("postgres-"))
      .map((name) => path.join(asciiHome, name, "bin", `pg_ctl${exe}`))
  : [];
const pgCtl = pgCtlCandidates.find((p) => existsSync(p));
if (pgCtl && existsSync(path.join(dataDir, "postmaster.pid"))) {
  const result = spawnSync(pgCtl, ["stop", "-D", dataDir, "-m", "fast", "-w"], { stdio: "ignore" });
  console.log(result.status === 0 ? "[stop] veritabanı durduruldu" : "[stop] veritabanı zaten kapalı");
} else {
  console.log("[stop] veritabanı çalışmıyor");
}

// 2. Node processes started from this project (game server, Vite, watchers).
if (process.platform === "win32") {
  const script = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*${root.replace(/'/g, "''")}*' -and $_.ProcessId -ne ${process.pid} -and $_.ProcessId -ne ${process.ppid} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId }`;
  const killed = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], { encoding: "utf8" }).trim();
  const count = killed ? killed.split(/\s+/).length : 0;
  console.log(`[stop] ${count} süreç kapatıldı (oyun sunucusu, istemci)`);
} else {
  spawnSync("pkill", ["-f", root]);
  console.log("[stop] oyun sunucusu ve istemci kapatıldı");
}

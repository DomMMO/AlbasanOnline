// Runs a real PostgreSQL for local development, without installing anything system-wide.
// The Postgres binaries come from the embedded-postgres npm packages; data survives restarts.
// Production uses DATABASE_URL instead.
//
// It runs as its own process (not inside the game server) so that `tsx watch`
// restarting the server doesn't restart the database.
//
// Windows quirk: Postgres can't cope with non-ASCII characters in its own install
// path or data path (e.g. a project under "Masaüstü"). In that case the binaries are
// copied once and the data kept under %LOCALAPPDATA%\mmo-creation.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { DEV_DB } from "../src/config";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const isAscii = (p: string) => /^[\x00-\x7F]*$/.test(p);
const asciiHome = path.join(process.env.LOCALAPPDATA ?? os.homedir(), "mmo-creation");
const exe = process.platform === "win32" ? ".exe" : "";

function log(message: string) {
  console.log(`[db] ${message}`);
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr!.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(command)} failed: ${stderr}`))));
  });
}

/** Directory containing bin/, lib/, share/ of the platform's Postgres package. */
async function findBinaries(): Promise<string> {
  const platform = { win32: "windows", darwin: "darwin", linux: "linux" }[process.platform as string];
  const packageName = `@embedded-postgres/${platform}-${process.arch}`;
  const binaries: { initdb: string } = await import(packageName);
  const nativeDir = path.dirname(path.dirname(binaries.initdb));
  if (isAscii(nativeDir)) return nativeDir;

  const packageDir = path.dirname(nativeDir);
  const { version } = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8"));
  const target = path.join(asciiHome, `postgres-${version}`);
  if (!existsSync(path.join(target, "bin", `postgres${exe}`))) {
    log(`copying Postgres binaries to ${target} (one time, ~100 MB)...`);
    const temp = `${target}.tmp`;
    await rm(temp, { recursive: true, force: true });
    await mkdir(path.dirname(target), { recursive: true });
    await cp(nativeDir, temp, { recursive: true });
    await rename(temp, target);
  }
  return target;
}

async function initCluster(binDir: string, dataDir: string) {
  log(`creating database cluster in ${dataDir} (first run only)...`);
  await mkdir(path.dirname(dataDir), { recursive: true });
  const passwordFile = path.join(os.tmpdir(), `mmo-pg-${process.pid}`);
  await writeFile(passwordFile, `${DEV_DB.password}\n`);
  try {
    await run(path.join(binDir, `initdb${exe}`), [
      `--pgdata=${dataDir}`,
      `--username=${DEV_DB.user}`,
      `--pwfile=${passwordFile}`,
      "--auth=scram-sha-256",
      "--encoding=UTF8",
      // The OS locale name may itself be non-ASCII (e.g. "Turkish_Türkiye.1254").
      "--locale=C",
    ]);
  } finally {
    await unlink(passwordFile).catch(() => {});
  }
}

async function ensureDatabase() {
  const client = new pg.Client({
    host: "127.0.0.1",
    port: DEV_DB.port,
    user: DEV_DB.user,
    password: DEV_DB.password,
    database: "postgres",
  });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DEV_DB.database]);
    if (!rowCount) {
      await client.query(`CREATE DATABASE ${DEV_DB.database}`);
      log(`created database "${DEV_DB.database}"`);
    }
  } finally {
    await client.end();
  }
}

async function waitForPort(port: number, child: ChildProcess, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await isPortOpen(port))) {
    if (child.exitCode !== null) throw new Error(`postgres exited with code ${child.exitCode}`);
    if (Date.now() > deadline) throw new Error("postgres did not start in time");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function main() {
  if (await isPortOpen(DEV_DB.port)) {
    // Most likely left running by a previous session that didn't shut down cleanly.
    log(`something is already listening on port ${DEV_DB.port}; assuming it's our Postgres`);
    setInterval(() => {}, 1 << 30);
    return;
  }

  const binDir = path.join(await findBinaries(), "bin");
  const repoDataDir = path.join(root, ".data", "postgres");
  const dataDir = process.env.MMO_DB_DIR ?? (isAscii(repoDataDir) ? repoDataDir : path.join(asciiHome, "data"));
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) await initCluster(binDir, dataDir);

  const postgres = spawn(path.join(binDir, `postgres${exe}`), ["-D", dataDir, "-p", String(DEV_DB.port)], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  postgres.stderr!.on("data", (chunk) => (stderr = (stderr + chunk).slice(-4000)));

  try {
    await waitForPort(DEV_DB.port, postgres);
    await ensureDatabase();
  } catch (error) {
    postgres.kill();
    throw new Error(`${(error as Error).message}\n${stderr}`);
  }
  log(`PostgreSQL ready on port ${DEV_DB.port} (data: ${dataDir})`);

  postgres.on("exit", (code) => {
    log(`postgres exited (code ${code})`);
    process.exit(code ?? 1);
  });

  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    log("stopping...");
    // Fast shutdown: rolls back open transactions and exits cleanly.
    spawnSync(path.join(binDir, `pg_ctl${exe}`), ["stop", "-D", dataDir, "-m", "fast", "-w"], { stdio: "ignore" });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[db] failed to start:", error);
  process.exit(1);
});

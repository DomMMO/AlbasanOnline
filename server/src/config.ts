import { SERVER_PORT } from "../../shared/src";

export const DEV_DB = {
  port: 5433,
  user: "postgres",
  password: "postgres",
  database: "mmo",
};

export const config = {
  port: Number(process.env.PORT ?? SERVER_PORT),
  /** In production set DATABASE_URL; in dev we talk to the embedded Postgres from scripts/dev-db.ts. */
  databaseUrl:
    process.env.DATABASE_URL ??
    `postgres://${DEV_DB.user}:${DEV_DB.password}@localhost:${DEV_DB.port}/${DEV_DB.database}`,
  /**
   * Express "trust proxy": how many reverse proxies sit in front of us, so req.ip is the
   * player's address. Hosts like Render add one; locally only loopback is trusted.
   */
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : "loopback",
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  autosaveIntervalMs: 30_000,
};

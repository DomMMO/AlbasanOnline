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
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  autosaveIntervalMs: 30_000,
};

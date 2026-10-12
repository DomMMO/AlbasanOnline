import pg from "pg";
import { config } from "../config";

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

pool.on("error", (error) => console.error("[db] idle client error:", error.message));

/** In dev the database process may still be booting when the server starts. */
export async function waitForDatabase(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let warned = false;
  for (;;) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      if (!warned) {
        console.log("[db] waiting for database...");
        warned = true;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

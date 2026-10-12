import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { config } from "../config";
import { pool } from "./pool";

const BCRYPT_COST = 10;

export interface Account {
  id: number;
  username: string;
  isAdmin: boolean;
}

/** Returns null if the username is taken. */
export async function createAccount(username: string, password: string): Promise<Account | null> {
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const { rows } = await pool.query<Account>(
    `INSERT INTO accounts (username, password_hash) VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING id, username, is_admin AS "isAdmin"`,
    [username, hash],
  );
  return rows[0] ?? null;
}

export async function verifyLogin(username: string, password: string): Promise<Account | null> {
  const { rows } = await pool.query<Account & { password_hash: string }>(
    `SELECT id, username, is_admin AS "isAdmin", password_hash FROM accounts WHERE lower(username) = lower($1)`,
    [username],
  );
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return null;
  return { id: row.id, username: row.username, isAdmin: row.isAdmin };
}

// Sessions: the client holds a random token; we only store its hash, so a leaked
// database can't be used to log in.

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(accountId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await pool.query("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, $3)", [
    hashToken(token),
    accountId,
    new Date(Date.now() + config.sessionTtlMs),
  ]);
  return token;
}

export async function accountForToken(token: string): Promise<Account | null> {
  const { rows } = await pool.query<Account>(
    `SELECT a.id, a.username, a.is_admin AS "isAdmin" FROM sessions s JOIN accounts a ON a.id = s.account_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

export async function deleteSession(token: string) {
  await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

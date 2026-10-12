// Grants (or with --remove, revokes) GM rights.
// Usage: npm run make-admin -w server -- <username> [--remove]

import { pool } from "../src/db/pool";

const args = process.argv.slice(2);
const username = args.find((arg) => !arg.startsWith("--"));
const grant = !args.includes("--remove");

if (!username) {
  console.error("Kullanım: npm run make-admin -w server -- <kullanıcı-adı> [--remove]");
  process.exit(1);
}

const { rowCount } = await pool.query("UPDATE accounts SET is_admin = $2 WHERE lower(username) = lower($1)", [username, grant]);
console.log(rowCount ? `${username}: GM yetkisi ${grant ? "verildi" : "alındı"}` : `${username} adında hesap bulunamadı`);
await pool.end();
process.exit(rowCount ? 0 : 1);

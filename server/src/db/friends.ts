import { pool } from "./pool";

// Friend lists and friend requests (see migration 13: one row per direction).

export interface FriendRow {
  characterId: number;
  name: string;
  cls: string;
  level: number;
}

export interface FriendLists {
  friends: FriendRow[];
  /** Requests others sent to this character. */
  incoming: FriendRow[];
  /** Requests this character sent that are still unanswered. */
  outgoing: FriendRow[];
}

const COLUMNS = "c.id AS \"characterId\", c.name, c.class AS cls, c.level";

export async function loadFriendLists(characterId: number): Promise<FriendLists> {
  const [friends, incoming, outgoing] = await Promise.all([
    pool.query<FriendRow>(
      `SELECT ${COLUMNS} FROM friendships f JOIN characters c ON c.id = f.friend_id
       WHERE f.character_id = $1 AND f.status = 'accepted' ORDER BY lower(c.name)`,
      [characterId],
    ),
    pool.query<FriendRow>(
      `SELECT ${COLUMNS} FROM friendships f JOIN characters c ON c.id = f.character_id
       WHERE f.friend_id = $1 AND f.status = 'pending' ORDER BY f.created_at`,
      [characterId],
    ),
    pool.query<FriendRow>(
      `SELECT ${COLUMNS} FROM friendships f JOIN characters c ON c.id = f.friend_id
       WHERE f.character_id = $1 AND f.status = 'pending' ORDER BY f.created_at`,
      [characterId],
    ),
  ]);
  return { friends: friends.rows, incoming: incoming.rows, outgoing: outgoing.rows };
}

/** Ids of everyone on this character's friend list. */
export async function friendIds(characterId: number): Promise<number[]> {
  const { rows } = await pool.query<{ id: number }>(
    "SELECT friend_id AS id FROM friendships WHERE character_id = $1 AND status = 'accepted'",
    [characterId],
  );
  return rows.map((row) => row.id);
}

export async function findCharacterByName(name: string): Promise<{ id: number; name: string } | null> {
  const { rows } = await pool.query<{ id: number; name: string }>("SELECT id, name FROM characters WHERE lower(name) = lower($1)", [name]);
  return rows[0] ?? null;
}

/** The row from `a` to `b`, if any. */
export async function friendshipStatus(a: number, b: number): Promise<"pending" | "accepted" | null> {
  const { rows } = await pool.query<{ status: "pending" | "accepted" }>(
    "SELECT status FROM friendships WHERE character_id = $1 AND friend_id = $2",
    [a, b],
  );
  return rows[0]?.status ?? null;
}

export async function countFriendships(characterId: number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>("SELECT count(*) AS n FROM friendships WHERE character_id = $1", [characterId]);
  return Number(rows[0].n);
}

export async function insertRequest(from: number, to: number) {
  await pool.query("INSERT INTO friendships (character_id, friend_id, status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING", [from, to]);
}

/** `to` accepts `from`'s request. False if there was no such request. */
export async function acceptRequest(from: number, to: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      "UPDATE friendships SET status = 'accepted' WHERE character_id = $1 AND friend_id = $2 AND status = 'pending'",
      [from, to],
    );
    if (updated.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      `INSERT INTO friendships (character_id, friend_id, status) VALUES ($1, $2, 'accepted')
       ON CONFLICT (character_id, friend_id) DO UPDATE SET status = 'accepted'`,
      [to, from],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Removes the friendship or request between the two, in both directions. */
export async function deleteFriendship(a: number, b: number): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM friendships WHERE (character_id = $1 AND friend_id = $2) OR (character_id = $2 AND friend_id = $1)",
    [a, b],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function characterName(characterId: number): Promise<string> {
  const { rows } = await pool.query<{ name: string }>("SELECT name FROM characters WHERE id = $1", [characterId]);
  return rows[0]?.name ?? "?";
}

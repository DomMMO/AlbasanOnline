import type pg from "pg";
import { CLASSES, type CharacterSummary, type ClassId, type QuestProgress } from "../../../shared/src";
import { newStack, type StoredItem } from "../game/inventory";
import { pool } from "./pool";

export interface CharacterRecord {
  id: number;
  accountId: number;
  name: string;
  class: string;
  color: number;
  level: number;
  xp: number;
  gold: number;
  hp: number | null;
  /** Zone x/y belong to. */
  zone: string;
  x: number | null;
  y: number | null;
  pvpRating: number;
  pvpKills: number;
  pvpDeaths: number;
  items: StoredItem[];
  quests: QuestProgress[];
}

/** The part of a character that changes during play. */
export interface CharacterProgress {
  level: number;
  xp: number;
  hp: number;
  /** null = keep the stored zone and position (dungeons, arena). */
  zone: string | null;
  x: number | null;
  y: number | null;
  pvpRating: number;
  pvpKills: number;
  pvpDeaths: number;
}

async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function insertItems(client: pg.PoolClient, characterId: number, items: StoredItem[]) {
  if (items.length === 0) return;
  await client.query(
    `INSERT INTO items (uid, character_id, def_id, qty, enhance, container, position)
     SELECT uid, $1, def_id, qty, enhance, container, position
     FROM unnest($2::uuid[], $3::text[], $4::int[], $5::int[], $6::text[], $7::text[])
       AS t(uid, def_id, qty, enhance, container, position)`,
    [
      characterId,
      items.map((i) => i.uid),
      items.map((i) => i.defId),
      items.map((i) => i.qty),
      items.map((i) => i.enhance),
      items.map((i) => i.container),
      items.map((i) => i.position),
    ],
  );
}

export async function listCharacters(accountId: number): Promise<CharacterSummary[]> {
  const { rows } = await pool.query<CharacterSummary>(
    "SELECT id, name, class, level, zone FROM characters WHERE account_id = $1 ORDER BY id",
    [accountId],
  );
  return rows;
}

export async function countCharacters(accountId: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>("SELECT count(*) FROM characters WHERE account_id = $1", [
    accountId,
  ]);
  return Number(rows[0].count);
}

/** Creates a character with its class's starter gear. Returns null if the name is taken. */
export async function createCharacter(accountId: number, name: string, color: number, classId: ClassId): Promise<CharacterSummary | null> {
  const { starterEquipment, starterInventory } = CLASSES[classId];
  return transaction(async (client) => {
    const { rows } = await client.query<CharacterSummary>(
      `INSERT INTO characters (account_id, name, color, class) VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING id, name, class, level, zone`,
      [accountId, name, color, classId],
    );
    const character = rows[0];
    if (!character) return null;

    const starter: StoredItem[] = [
      ...Object.entries(starterEquipment).map(([slot, defId]) => ({
        ...newStack(defId!, 1),
        container: "equipment" as const,
        position: slot,
      })),
      ...starterInventory.map(({ defId, qty }, index) => ({
        ...newStack(defId, qty),
        container: "inventory" as const,
        position: String(index),
      })),
    ];
    await insertItems(client, character.id, starter);
    return character;
  });
}

/** Loads a character only if it belongs to the account. */
export async function loadCharacter(characterId: number, accountId: number): Promise<CharacterRecord | null> {
  const { rows } = await pool.query<Omit<CharacterRecord, "items" | "quests">>(
    `SELECT id, account_id AS "accountId", name, class, color, level, xp, gold, hp, zone, x, y,
            pvp_rating AS "pvpRating", pvp_kills AS "pvpKills", pvp_deaths AS "pvpDeaths"
     FROM characters WHERE id = $1 AND account_id = $2`,
    [characterId, accountId],
  );
  if (!rows[0]) return null;
  const items = await pool.query<StoredItem>(
    `SELECT uid, def_id AS "defId", qty, enhance, container, position FROM items WHERE character_id = $1`,
    [characterId],
  );
  const quests = await pool.query<QuestProgress>(
    `SELECT quest_id AS id, status, kills FROM character_quests WHERE character_id = $1`,
    [characterId],
  );
  return { ...rows[0], items: items.rows, quests: quests.rows };
}

/** Replaces gold and items only (GM edits of offline characters). */
export async function saveInventory(characterId: number, gold: number, items: StoredItem[]) {
  await transaction(async (client) => {
    await client.query("UPDATE characters SET gold = $2, updated_at = now() WHERE id = $1", [characterId, gold]);
    await client.query("DELETE FROM items WHERE character_id = $1", [characterId]);
    await insertItems(client, characterId, items);
  });
}

/** Loads any character by id, regardless of owner (GM tools only). */
export async function loadCharacterById(characterId: number): Promise<CharacterRecord | null> {
  const { rows } = await pool.query<{ accountId: number }>("SELECT account_id AS \"accountId\" FROM characters WHERE id = $1", [
    characterId,
  ]);
  return rows[0] ? loadCharacter(characterId, rows[0].accountId) : null;
}

/** Top PvP players (only those who have fought at least once). */
export async function pvpLeaderboard(limit = 20) {
  const { rows } = await pool.query<{ id: number; name: string; class: string; level: number; rating: number; kills: number; deaths: number }>(
    `SELECT id, name, class, level, pvp_rating AS rating, pvp_kills AS kills, pvp_deaths AS deaths
     FROM characters WHERE pvp_kills + pvp_deaths > 0
     ORDER BY pvp_rating DESC, pvp_kills DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

export interface CharacterSave {
  characterId: number;
  progress: CharacterProgress;
  gold: number;
  items: StoredItem[];
  quests: QuestProgress[];
}

/**
 * Saves several characters in one transaction. A trade between two players must land
 * for both or for neither: otherwise a crash in between duplicates or loses the item.
 */
export async function saveCharacters(saves: CharacterSave[]) {
  await transaction(async (client) => {
    for (const { characterId, progress, gold } of saves) {
      await client.query(
        `UPDATE characters SET level = $2, xp = $3, hp = $4, zone = COALESCE($5, zone), x = CASE WHEN $5::text IS NULL THEN x ELSE $6 END,
           y = CASE WHEN $5::text IS NULL THEN y ELSE $7 END, gold = $8, pvp_rating = $9, pvp_kills = $10, pvp_deaths = $11, updated_at = now()
         WHERE id = $1`,
        [characterId, progress.level, progress.xp, progress.hp, progress.zone, progress.x, progress.y, gold, progress.pvpRating, progress.pvpKills, progress.pvpDeaths],
      );
    }
    // All deletes before any insert: a traded item keeps its uid and moves between characters.
    // Replacing the whole set is simple and fine at this size; revisit if inventories grow large.
    await client.query("DELETE FROM items WHERE character_id = ANY($1::int[])", [saves.map((s) => s.characterId)]);
    for (const { characterId, items } of saves) await insertItems(client, characterId, items);
    for (const { characterId, quests } of saves) {
      await client.query("DELETE FROM character_quests WHERE character_id = $1", [characterId]);
      if (quests.length === 0) continue;
      await client.query(
        `INSERT INTO character_quests (character_id, quest_id, status, kills)
         SELECT $1, id, status, string_to_array(kills, ',')::int[] FROM unnest($2::text[], $3::text[], $4::text[]) AS t(id, status, kills)`,
        [characterId, quests.map((q) => q.id), quests.map((q) => q.status), quests.map((q) => q.kills.join(","))],
      );
    }
  });
}

import {
  isUpgradeable,
  MAX_AFFIXES,
  ITEMS,
  MAX_ENHANCE,
  MAX_LEVEL,
  type EquipSlot,
  type ItemView,
} from "../../../shared/src";
import { loadCharacterById, saveInventory } from "../db/characters";
import { pool } from "../db/pool";
import { addItem, fromStored, toStored, toView, type InventoryData } from "./inventory";
import { notice, refreshStats, sendInventory } from "./items";
import { onlineCharacters } from "./registry";
import { revalidateRanks } from "./talents";

// GM operations on a character. Online characters are changed in the running game
// (and see it immediately); offline ones are changed in the database.

export class GmError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export interface CharacterSnapshot {
  id: number;
  name: string;
  account: string;
  level: number;
  xp: number;
  gold: number;
  online: boolean;
  slots: (ItemView | null)[];
  equipment: Partial<Record<EquipSlot, ItemView>>;
}

const GM_COLOR = "#7fe3ff";

function live(characterId: number) {
  const entry = onlineCharacters.get(characterId);
  if (!entry) return null;
  const player = entry.game.state.players.get(entry.sessionId);
  const runtime = entry.game.playerRuntime.get(entry.sessionId);
  return player && runtime ? { ...entry, player, runtime } : null;
}

/** Runs `change` on the character's inventory wherever it lives, then persists or pushes it. */
async function withInventory<T>(characterId: number, change: (inv: InventoryData) => T, message?: (result: T) => string): Promise<T> {
  const online = live(characterId);
  if (online) {
    const result = change(online.runtime.inventory);
    refreshStats(online.game, online.sessionId);
    sendInventory(online.game, online.sessionId);
    if (message) notice(online.game, online.sessionId, message(result), GM_COLOR);
    return result;
  }
  const record = await loadCharacterById(characterId);
  if (!record) throw new GmError("Karakter bulunamadı", 404);
  const inv = fromStored(record.gold, record.items);
  const result = change(inv);
  await saveInventory(characterId, inv.gold, toStored(inv));
  return result;
}

export async function searchCharacters(query: string) {
  const { rows } = await pool.query<{ id: number; name: string; level: number; gold: number; account: string }>(
    `SELECT c.id, c.name, c.level, c.gold, a.username AS account
     FROM characters c JOIN accounts a ON a.id = c.account_id
     WHERE c.name ILIKE $1 OR a.username ILIKE $1
     ORDER BY c.updated_at DESC
     LIMIT 50`,
    [`%${query.replace(/[%_\\]/g, "\\$&")}%`],
  );
  return rows.map((row) => {
    const online = live(row.id);
    return { ...row, online: !!online, level: online?.player.level ?? row.level, gold: online?.runtime.inventory.gold ?? row.gold };
  });
}

export async function getCharacter(characterId: number): Promise<CharacterSnapshot> {
  const { rows } = await pool.query<{ account: string }>(
    "SELECT a.username AS account FROM characters c JOIN accounts a ON a.id = c.account_id WHERE c.id = $1",
    [characterId],
  );
  if (!rows[0]) throw new GmError("Karakter bulunamadı", 404);
  const online = live(characterId);
  if (online) {
    return {
      id: characterId,
      name: online.player.name,
      account: rows[0].account,
      level: online.player.level,
      xp: online.player.xp,
      online: true,
      ...toView(online.runtime.inventory),
    };
  }
  const record = (await loadCharacterById(characterId))!;
  return {
    id: characterId,
    name: record.name,
    account: rows[0].account,
    level: record.level,
    xp: record.xp,
    online: false,
    ...toView(fromStored(record.gold, record.items)),
  };
}

/** `affixCount` 1-5 gives equipment exactly that many modifiers; 0 rolls them as a drop would. */
export async function giveItem(characterId: number, itemId: string, qty: number, enhance: number, affixCount = 0) {
  const def = ITEMS[itemId];
  if (!def) throw new GmError("Böyle bir item yok");
  const amount = Math.floor(qty);
  if (!(amount >= 1 && amount <= 999)) throw new GmError("Adet 1-999 arası olmalı");
  const plus = Math.floor(enhance) || 0;
  if (plus < 0 || plus > MAX_ENHANCE) throw new GmError(`+N 0-${MAX_ENHANCE} arası olmalı`);
  if (plus > 0 && !isUpgradeable(def)) throw new GmError("Bu item yükseltilemez, +N verilemez");
  const count = Math.floor(affixCount) || 0;
  if (count < 0 || count > MAX_AFFIXES) throw new GmError(`Stat sayısı 0-${MAX_AFFIXES} arası olmalı (0 = rastgele)`);
  if (count > 0 && !def.slot) throw new GmError("Stat sayısı sadece ekipmanda seçilebilir");

  const left = await withInventory(
    characterId,
    (inv) => addItem(inv, itemId, amount, plus, count ? { count } : {}),
    (left) => `GM sana ${def.name}${plus ? ` +${plus}` : ""}${amount - left > 1 ? ` x${amount - left}` : ""} verdi`,
  );
  return { given: amount - left, leftover: left };
}

export async function removeItem(characterId: number, uid: string) {
  const removed = await withInventory(characterId, (inv) => {
    const index = inv.slots.findIndex((stack) => stack?.uid === uid);
    if (index !== -1) {
      const stack = inv.slots[index]!;
      inv.slots[index] = null;
      return stack;
    }
    for (const [slot, stack] of Object.entries(inv.equipment)) {
      if (stack?.uid === uid) {
        delete inv.equipment[slot as EquipSlot];
        return stack;
      }
    }
    for (const socket of inv.passives) {
      if (socket.major?.uid === uid) {
        const stack = socket.major;
        socket.major = null;
        return stack;
      }
      const minor = socket.minors.findIndex((stack) => stack?.uid === uid);
      if (minor !== -1) {
        const stack = socket.minors[minor]!;
        socket.minors[minor] = null;
        return stack;
      }
    }
    return null;
  });
  if (!removed) throw new GmError("Item bulunamadı", 404);
  return removed;
}

export async function addGold(characterId: number, amount: number) {
  const delta = Math.trunc(amount);
  if (!Number.isFinite(delta) || delta === 0) throw new GmError("Geçerli bir miktar gir");
  return withInventory(
    characterId,
    (inv) => {
      inv.gold = Math.min(2_000_000_000, Math.max(0, inv.gold + delta));
      return inv.gold;
    },
    () => (delta > 0 ? `GM sana ${delta} altın verdi` : `GM ${-delta} altınını aldı`),
  );
}

export async function setLevel(characterId: number, level: number) {
  const target = Math.floor(level);
  if (!(target >= 1 && target <= MAX_LEVEL)) throw new GmError(`Seviye 1-${MAX_LEVEL} arası olmalı`);
  const online = live(characterId);
  if (online) {
    online.player.level = target;
    online.player.xp = 0;
    revalidateRanks(online.game, online.sessionId);
    refreshStats(online.game, online.sessionId);
    online.player.hp = online.player.maxHp;
    sendInventory(online.game, online.sessionId);
    notice(online.game, online.sessionId, `GM seviyeni ${target} yaptı`, GM_COLOR);
    return;
  }
  const { rowCount } = await pool.query("UPDATE characters SET level = $2, xp = 0, hp = NULL WHERE id = $1", [characterId, target]);
  if (!rowCount) throw new GmError("Karakter bulunamadı", 404);
}

export async function logAdminAction(adminId: number, characterId: number, action: string, details: object) {
  await pool.query("INSERT INTO admin_log (admin_id, character_id, action, details) VALUES ($1, $2, $3, $4)", [
    adminId,
    characterId,
    action,
    JSON.stringify(details),
  ]);
}

export async function recentAdminLog(characterId: number) {
  const { rows } = await pool.query(
    `SELECT l.action, l.details, l.created_at AS "createdAt", a.username AS admin
     FROM admin_log l JOIN accounts a ON a.id = l.admin_id
     WHERE l.character_id = $1 ORDER BY l.id DESC LIMIT 20`,
    [characterId],
  );
  return rows;
}

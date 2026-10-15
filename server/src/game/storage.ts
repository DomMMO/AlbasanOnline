import { distance, ITEMS, MAX_GOLD, NPC_RANGE, NPCS, type SlotRef } from "../../../shared/src";
import type { Game } from "./Game";
import { fitsProfession, placeStack, type InventoryData, type ItemStack } from "./inventory";
import { notice, sendInventory } from "./items";

// Storage (depo) at the Depocu, Knight Online style: a second set of slots and a gold
// vault that belong to the character and stay in town. Items only move while standing
// next to her. The items keep their identity (uid, +N, modifiers) and are saved with the
// rest of the character, so a move is never half done in the database.

const GOLD_COLOR = "#ffd34d";

function context(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  return player && runtime && !player.dead ? { player, runtime, inv: runtime.inventory } : null;
}

/** The player with a storage keeper in reach; when `npcId` is given it must be that one. */
function atStorage(game: Game, sessionId: string, npcId?: string) {
  const ctx = context(game, sessionId);
  if (!ctx) return null;
  const keepers = game.zone.npcs.filter((id) => NPCS[id]?.role === "storage" && (npcId === undefined || id === npcId));
  if (!keepers.some((id) => distance(ctx.player, NPCS[id]) <= NPC_RANGE)) {
    notice(game, sessionId, "Depoya ulaşmak için Depocu'nun yanında olmalısın");
    return null;
  }
  return ctx;
}

const validIndex = (index: number, size: number) => Number.isInteger(index) && index >= 0 && index < size;

/**
 * Moves the stack at from[i] onto to[j]: merges into the same item if it stacks,
 * otherwise swaps the two slots.
 */
export function moveBetween(from: (ItemStack | null)[], i: number, to: (ItemStack | null)[], j: number) {
  const a = from[i];
  const b = to[j];
  if (!a) return;
  const def = ITEMS[a.defId];
  if (b && b !== a && b.defId === a.defId && b.enhance === a.enhance && def.maxStack > 1) {
    const take = Math.min(def.maxStack - b.qty, a.qty);
    b.qty += take;
    a.qty -= take;
    if (a.qty <= 0) from[i] = null;
    return;
  }
  from[i] = b;
  to[j] = a;
}

type Row = "inv" | "prof" | "storage";

function rowOf(inv: InventoryData, area: Row): (ItemStack | null)[] {
  return area === "inv" ? inv.slots : area === "prof" ? inv.profession : inv.storage;
}

/** Drag and drop involving storage slots (bags or profession bag <-> storage, or within storage). */
export function moveWithStorage(game: Game, sessionId: string, from: SlotRef, to: SlotRef) {
  if (from.area === "equip" || to.area === "equip") return notice(game, sessionId, "Önce item'ı çıkar, sonra depola");
  if (from.area === "tool" || to.area === "tool") return notice(game, sessionId, "Önce aleti çantaya al, sonra depola");
  if (from.area === "passive" || to.area === "passive") return;
  const ctx = atStorage(game, sessionId);
  if (!ctx) return;
  const source = rowOf(ctx.inv, from.area);
  const target = rowOf(ctx.inv, to.area);
  if (!validIndex(from.index, source.length) || !validIndex(to.index, target.length)) return;
  if (from.area === to.area && from.index === to.index) return;
  // A swap puts the target's stack where the dragged one was: both must fit their new row.
  const a = source[from.index];
  const b = target[to.index];
  const merges = a && b && a.defId === b.defId && a.enhance === b.enhance && ITEMS[a.defId].maxStack > 1;
  if ((to.area === "prof" && !fitsProfession(a)) || (from.area === "prof" && !merges && !fitsProfession(b))) {
    return notice(game, sessionId, "Meslek çantasına sadece maden, bitki ve balık konur");
  }
  moveBetween(source, from.index, target, to.index);
  sendInventory(game, sessionId);
}

/** Right-click: sends a stack to the other side, merging with what is already there. Storage -> the bags (ore, herbs, fish: the profession bag first). */
export function quickStorage(game: Game, sessionId: string, npcId: string, from: { area: "inv" | "prof" | "storage"; index: number }) {
  const ctx = atStorage(game, sessionId, npcId);
  if (!ctx) return;
  const { inv } = ctx;
  const source = rowOf(inv, from.area);
  if (from.area === "storage") {
    if (!validIndex(from.index, source.length)) return;
    const stack = source[from.index];
    if (!stack) return;
    const into = fitsProfession(stack) ? [inv.profession, inv.slots] : [inv.slots];
    if (!into.some((row) => placeStack(row, stack))) return notice(game, sessionId, "Envanter dolu");
    source[from.index] = null;
    return sendInventory(game, sessionId);
  }
  const target = inv.storage;
  if (!validIndex(from.index, source.length)) return;
  const stack = source[from.index];
  if (!stack) return;
  if (!placeStack(target, stack)) return notice(game, sessionId, "Depo dolu");
  source[from.index] = null;
  sendInventory(game, sessionId);
}

/** Moves gold between the purse and the vault: positive deposits, negative withdraws. */
export function storageGold(game: Game, sessionId: string, npcId: string, rawAmount: unknown) {
  const ctx = atStorage(game, sessionId, npcId);
  if (!ctx) return;
  const { inv } = ctx;
  const amount = Number(rawAmount);
  if (!Number.isSafeInteger(amount) || amount === 0) return notice(game, sessionId, "Geçersiz miktar");
  if (amount > 0) {
    if (amount > inv.gold) return notice(game, sessionId, "Kesende o kadar altın yok");
    if (inv.storageGold + amount > MAX_GOLD) return notice(game, sessionId, "Depo kasası dolu");
  } else {
    if (-amount > inv.storageGold) return notice(game, sessionId, "Depoda o kadar altın yok");
    if (inv.gold - amount > MAX_GOLD) return notice(game, sessionId, "Kesen dolu");
  }
  inv.gold -= amount;
  inv.storageGold += amount;
  const text = Math.abs(amount).toLocaleString("tr-TR");
  notice(game, sessionId, amount > 0 ? `${text} altın depoya kondu` : `${text} altın depodan alındı`, GOLD_COLOR);
  sendInventory(game, sessionId);
}

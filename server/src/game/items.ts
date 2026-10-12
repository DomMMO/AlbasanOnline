import {
  COMBAT_TIMEOUT_MS,
  HOME_ZONE,
  TOWN_SPOTS,
  distance,
  INVENTORY_SIZE,
  ITEMS,
  LOOT_DESPAWN_MS,
  LOOT_OWNER_MS,
  LOOT_RANGE,
  Msg,
  NPC_RANGE,
  NPCS,
  POTION_COOLDOWN_MS,
  classOf,
  RARITY_COLORS,
  statsWithEquipment,
  type EquipSlot,
  type InventoryEvent,
  type MobDef,
  type NoticeEvent,
  type SkillUsedEvent,
  type SlotRef,
} from "../../../shared/src";
import { Loot } from "../rooms/schema/WorldState";
import { broadcastCombat } from "./combat";
import type { Game } from "./Game";
import { addItem, equippedItems, hasSpaceFor, indexOfItem, newStack, removeAt, toView, type ItemStack } from "./inventory";
import { partyIdOf } from "./party";

// Everything players do with items: equip, use, move, loot, buy, sell.
// Each action validates on the server, mutates the inventory, then pushes a fresh snapshot to the owner.

const GOLD_COLOR = "#ffd34d";
const ERROR_COLOR = "#ff5a5a";

export interface LootContents {
  gold: number;
  items: ItemStack[];
}

export function notice(game: Game, sessionId: string, message: string, color = ERROR_COLOR) {
  game.io.send(sessionId, Msg.Notice, { message, color } satisfies NoticeEvent);
}

export function sendInventory(game: Game, sessionId: string) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime) return;
  game.io.send(sessionId, Msg.Inventory, { ...toView(runtime.inventory), stats: runtime.stats } satisfies InventoryEvent);
}

/** Recomputes combat stats from level + equipment. Call after any equipment or level change. */
export function refreshStats(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime) return;
  runtime.stats = statsWithEquipment(player.cls, player.level, equippedItems(runtime.inventory));
  player.maxHp = runtime.stats.maxHp;
  player.maxResource = classOf(player.cls).maxResource(player.level);
  player.resource = Math.min(player.resource, player.maxResource);
  const { equipment } = runtime.inventory;
  player.weapon = equipment.weapon?.defId ?? "";
  player.weaponPlus = equipment.weapon?.enhance ?? 0;
  player.gearHead = equipment.head?.defId ?? "";
  player.gearChest = equipment.chest?.defId ?? "";
  player.gearLegs = equipment.legs?.defId ?? "";
  player.gearFeet = equipment.feet?.defId ?? "";
  player.hp = Math.min(player.hp, player.maxHp);
}

function changed(game: Game, sessionId: string, statsChanged = false) {
  if (statsChanged) refreshStats(game, sessionId);
  sendInventory(game, sessionId);
}

function context(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  return player && runtime ? { player, runtime, inv: runtime.inventory } : null;
}

const validIndex = (index: unknown): index is number =>
  Number.isInteger(index) && (index as number) >= 0 && (index as number) < INVENTORY_SIZE;

// ---- Equipment -----------------------------------------------------------------

function equipFromInventory(game: Game, sessionId: string, index: number) {
  const ctx = context(game, sessionId)!;
  const stack = ctx.inv.slots[index];
  const def = stack && ITEMS[stack.defId];
  if (!stack || !def?.slot) return;
  if (ctx.player.level < def.level) return notice(game, sessionId, `Seviye ${def.level} gerekli`);
  if (def.classes && !def.classes.includes(classOf(ctx.player.cls).id)) {
    return notice(game, sessionId, `${classOf(ctx.player.cls).name} bu item'ı kullanamaz`);
  }
  // Swap: whatever was equipped goes into the slot the new item came from.
  ctx.inv.slots[index] = ctx.inv.equipment[def.slot] ?? null;
  ctx.inv.equipment[def.slot] = stack;
  changed(game, sessionId, true);
}

export function unequip(game: Game, sessionId: string, slot: EquipSlot, toIndex?: number) {
  const ctx = context(game, sessionId);
  const stack = ctx?.inv.equipment[slot];
  if (!ctx || !stack) return;
  const index = toIndex !== undefined && ctx.inv.slots[toIndex] === null ? toIndex : ctx.inv.slots.indexOf(null);
  if (index === -1) return notice(game, sessionId, "Envanter dolu");
  ctx.inv.slots[index] = stack;
  delete ctx.inv.equipment[slot];
  changed(game, sessionId, true);
}

// ---- Moving --------------------------------------------------------------------

export function moveItem(game: Game, sessionId: string, from: SlotRef, to: SlotRef) {
  const ctx = context(game, sessionId);
  if (!ctx) return;
  const { inv } = ctx;

  if (from.area === "inv" && to.area === "inv") {
    if (!validIndex(from.index) || !validIndex(to.index) || from.index === to.index) return;
    const a = inv.slots[from.index];
    const b = inv.slots[to.index];
    if (!a) return;
    const def = ITEMS[a.defId];
    if (b && b.defId === a.defId && b.enhance === a.enhance && def.maxStack > 1) {
      const take = Math.min(def.maxStack - b.qty, a.qty);
      b.qty += take;
      removeAt(inv, from.index, take);
    } else {
      inv.slots[from.index] = b;
      inv.slots[to.index] = a;
    }
    return changed(game, sessionId);
  }

  if (from.area === "inv" && to.area === "equip") {
    if (!validIndex(from.index)) return;
    const stack = inv.slots[from.index];
    if (!stack || ITEMS[stack.defId]?.slot !== to.slot) return notice(game, sessionId, "Bu item oraya kuşanılamaz");
    return equipFromInventory(game, sessionId, from.index);
  }

  if (from.area === "equip" && to.area === "inv") {
    if (!validIndex(to.index)) return;
    const target = inv.slots[to.index];
    // Dropping onto an item that fits the same slot swaps them.
    if (target && ITEMS[target.defId]?.slot === from.slot) return equipFromInventory(game, sessionId, to.index);
    if (target) return unequip(game, sessionId, from.slot);
    return unequip(game, sessionId, from.slot, to.index);
  }
}

// ---- Using ---------------------------------------------------------------------

export function useItem(game: Game, sessionId: string, index: number | undefined, defId: string | undefined) {
  const ctx = context(game, sessionId);
  if (!ctx) return;
  if (index === undefined && defId !== undefined) index = indexOfItem(ctx.inv, defId);
  if (!validIndex(index)) {
    if (defId) notice(game, sessionId, `${ITEMS[defId]?.name ?? "Item"} kalmadı`);
    return;
  }
  const stack = ctx.inv.slots[index];
  const def = stack && ITEMS[stack.defId];
  if (!stack || !def) return;

  if (def.slot) return equipFromInventory(game, sessionId, index);
  if (def.recall) return recall(game, sessionId, index);
  if (!def.heal && !def.mana) return;

  const { player, runtime } = ctx;
  if (player.dead) return;
  if (player.level < def.level) return notice(game, sessionId, `Seviye ${def.level} gerekli`);
  const group = def.cooldownGroup ?? def.id;
  if (game.now() < (runtime.cooldowns.get(group) ?? 0)) return notice(game, sessionId, "Henüz hazır değil");
  if (def.mana) {
    if (classOf(player.cls).resource !== "mana") return notice(game, sessionId, "Mana kullanmıyorsun");
    if (player.resource >= player.maxResource) return notice(game, sessionId, "Manan zaten dolu");
    player.resource = Math.min(player.maxResource, player.resource + def.mana);
  } else {
    if (player.hp >= player.maxHp) return notice(game, sessionId, "Canın zaten dolu");
    const amount = Math.min(def.heal!, player.maxHp - player.hp);
    player.hp += amount;
    broadcastCombat(game, { sourceId: sessionId, targetId: sessionId, targetKind: "player", amount, crit: false, heal: true });
  }
  removeAt(ctx.inv, index, 1);
  runtime.cooldowns.set(group, game.now() + POTION_COOLDOWN_MS);
  game.io.send(sessionId, Msg.SkillUsed, { skillId: group, cooldownMs: POTION_COOLDOWN_MS, gcdMs: 0 } satisfies SkillUsedEvent);
  changed(game, sessionId);
}

/** Return scroll: back to the main town, unless fighting. */
function recall(game: Game, sessionId: string, index: number) {
  const ctx = context(game, sessionId)!;
  if (ctx.player.dead) return;
  if (game.zone.id === HOME_ZONE) return notice(game, sessionId, "Zaten Ana Merkez'desin");
  if (game.now() - ctx.runtime.lastCombatAt < COMBAT_TIMEOUT_MS) return notice(game, sessionId, "Savaşırken kullanılamaz");
  removeAt(ctx.inv, index, 1);
  changed(game, sessionId);
  game.io.transfer(sessionId, HOME_ZONE, TOWN_SPOTS.spawn);
}

// ---- Loot ----------------------------------------------------------------------

export function dropLoot(game: Game, x: number, y: number, mobDef: MobDef, ownerId: string | null) {
  const { gold: [min, max], drops } = mobDef.loot;
  const contents: LootContents = { gold: min + Math.floor(game.random() * (max - min + 1)), items: [] };
  for (const drop of drops) {
    if (game.random() >= drop.chance) continue;
    const lo = drop.min ?? 1;
    const hi = drop.max ?? lo;
    contents.items.push(newStack(drop.item, lo + Math.floor(game.random() * (hi - lo + 1)), drop.enhance ?? 0));
  }

  const lootId = game.newId("l");
  const loot = new Loot();
  loot.x = x;
  loot.y = y;
  // A party's kill belongs to the whole party ("party:<id>"), otherwise to the killer.
  const ownerParty = ownerId ? partyIdOf(game.playerRuntime.get(ownerId)?.characterId ?? -1) : null;
  loot.owner = ownerParty ? `party:${ownerParty}` : (ownerId ?? "");
  game.state.loot.set(lootId, loot);
  game.lootContents.set(lootId, contents);
  game.after(LOOT_OWNER_MS, () => {
    const current = game.state.loot.get(lootId);
    if (current) current.owner = "";
  });
  game.after(LOOT_DESPAWN_MS, () => removeLoot(game, lootId));
}

function removeLoot(game: Game, lootId: string) {
  game.state.loot.delete(lootId);
  game.lootContents.delete(lootId);
}

export function pickupLoot(game: Game, sessionId: string, lootId: string) {
  const ctx = context(game, sessionId);
  const loot = game.state.loot.get(lootId);
  const contents = game.lootContents.get(lootId);
  if (!ctx || !loot || !contents || ctx.player.dead) return;
  const myParty = partyIdOf(ctx.runtime.characterId);
  if (loot.owner && loot.owner !== sessionId && loot.owner !== `party:${myParty}`) return notice(game, sessionId, "Bu ganimet senin değil");
  if (distance(ctx.player, loot) > LOOT_RANGE) return notice(game, sessionId, "Çok uzak");

  if (contents.gold > 0) {
    ctx.inv.gold += contents.gold;
    notice(game, sessionId, `+${contents.gold} altın`, GOLD_COLOR);
    contents.gold = 0;
  }
  const leftovers: ItemStack[] = [];
  for (const stack of contents.items) {
    const left = addItem(ctx.inv, stack.defId, stack.qty, stack.enhance);
    const taken = stack.qty - left;
    const def = ITEMS[stack.defId];
    if (taken > 0) notice(game, sessionId, `${def.name}${taken > 1 ? ` x${taken}` : ""}`, RARITY_COLORS[def.rarity]);
    if (left > 0) leftovers.push({ ...stack, qty: left });
  }
  contents.items = leftovers;
  if (leftovers.length > 0) notice(game, sessionId, "Envanter dolu");
  else removeLoot(game, lootId);
  changed(game, sessionId);
}

// ---- Merchant ------------------------------------------------------------------

function nearNpc(game: Game, sessionId: string, npcId: string) {
  const ctx = context(game, sessionId);
  const npc = NPCS[npcId];
  if (!ctx || !npc || npc.role !== "merchant" || !game.zone.npcs.includes(npcId)) return null;
  if (distance(ctx.player, npc) > NPC_RANGE) {
    notice(game, sessionId, "Tüccardan çok uzaktasın");
    return null;
  }
  return { ...ctx, npc };
}

export function buy(game: Game, sessionId: string, npcId: string, itemId: string, qty: number) {
  const ctx = nearNpc(game, sessionId, npcId);
  if (!ctx) return;
  const def = ITEMS[itemId];
  if (!def || def.buyPrice === undefined || !ctx.npc.shop.includes(itemId)) return;
  const amount = Math.max(1, Math.min(Math.floor(qty) || 1, def.maxStack));
  const cost = def.buyPrice * amount;
  if (ctx.inv.gold < cost) return notice(game, sessionId, "Yeterli altının yok");
  if (!hasSpaceFor(ctx.inv, itemId, amount)) return notice(game, sessionId, "Envanter dolu");
  ctx.inv.gold -= cost;
  addItem(ctx.inv, itemId, amount);
  notice(game, sessionId, `${def.name}${amount > 1 ? ` x${amount}` : ""} alındı (-${cost} altın)`, GOLD_COLOR);
  changed(game, sessionId);
}

export function sell(game: Game, sessionId: string, npcId: string, index: number) {
  const ctx = nearNpc(game, sessionId, npcId);
  if (!ctx || !validIndex(index)) return;
  const stack = ctx.inv.slots[index];
  if (!stack) return;
  const def = ITEMS[stack.defId];
  if (def.questItem) return notice(game, sessionId, "Görev eşyası satılamaz");
  const value = def.sellPrice * stack.qty;
  ctx.inv.slots[index] = null;
  ctx.inv.gold += value;
  notice(game, sessionId, `${def.name}${stack.qty > 1 ? ` x${stack.qty}` : ""} satıldı (+${value} altın)`, GOLD_COLOR);
  changed(game, sessionId);
}

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
  itemRarity,
  itemSellPrice,
  JEWEL_DROPS,
  MOB_TUNING,
  ranksToAffixes,
  MAX_AFFIXES,
  RARITY_COLORS,
  statsWithEquipment,
  TOOL_SLOT_NAMES,
  type EquipSlot,
  type InventoryEvent,
  type MobDef,
  type NoticeEvent,
  type SkillUsedEvent,
  type SlotRef,
} from "../../../shared/src";
import { Loot } from "../rooms/schema/WorldState";
import { broadcastCombat } from "./combat";
import { broadcastSystem } from "./chat";
import type { Game } from "./Game";
import { addItem, equippedItems, fitsProfession, hasSpaceFor, indexOfItem, newStack, removeAt, socketedJewels, sortInventory, toView, type InventoryData, type ItemStack } from "./inventory";
import { autoSocket, socketJewel, unsocketJewel } from "./passives";
import { moveBetween, moveWithStorage } from "./storage";
import { toggleFishing } from "./fishing";
import { partyIdOf } from "./party";

// Everything players do with items: equip, use, move, loot, buy, sell.
// Each action validates on the server, mutates the inventory, then pushes a fresh snapshot to the owner.

const GOLD_COLOR = "#ffd34d";
const ERROR_COLOR = "#ff5a5a";
const INFO_COLOR = "#d8cba8";

export interface LootContents {
  gold: number;
  items: ItemStack[];
  /** A player put it down (dropItem): pets leave it alone. */
  dropped?: boolean;
}

export function notice(game: Game, sessionId: string, message: string, color = ERROR_COLOR) {
  game.io.send(sessionId, Msg.Notice, { message, color } satisfies NoticeEvent);
}

export function sendInventory(game: Game, sessionId: string) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime) return;
  const buyback = (soldItems.get(runtime.characterId) ?? []).map(({ stack, price }) => ({ ...stack, price }));
  game.io.send(sessionId, Msg.Inventory, { ...toView(runtime.inventory), stats: runtime.stats, buyback } satisfies InventoryEvent);
}

/** Recomputes combat stats from level + equipment. Call after any equipment or level change. */
export function refreshStats(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime) return;
  runtime.stats = statsWithEquipment(
    player.cls,
    player.level,
    [...equippedItems(runtime.inventory), ...socketedJewels(runtime.inventory)],
    ranksToAffixes(player.cls, runtime.skillRanks),
  );
  player.maxHp = runtime.stats.maxHp;
  const cls = classOf(player.cls);
  player.maxResource = cls.maxResource(player.level) + (cls.resource === "mana" ? runtime.stats.manaBonus : 0);
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

const PROFESSION_ONLY = "Meslek çantasına sadece maden, bitki ve balık konur";

/** The bags or the profession bag, with the index checked against it (null = no such slot). */
function bagSlot(inv: InventoryData, area: "inv" | "prof", index: unknown): { row: (ItemStack | null)[]; index: number } | null {
  const row = area === "prof" ? inv.profession : inv.slots;
  return Number.isInteger(index) && (index as number) >= 0 && (index as number) < row.length ? { row, index: index as number } : null;
}

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

  if (from.area === "storage" || to.area === "storage") return moveWithStorage(game, sessionId, from, to);
  if (from.area === "tool" || to.area === "tool") return moveTool(game, sessionId, from, to);

  if (from.area === "prof" || to.area === "prof") {
    if ((from.area !== "inv" && from.area !== "prof") || (to.area !== "inv" && to.area !== "prof")) return;
    const source = bagSlot(inv, from.area, from.index);
    const target = bagSlot(inv, to.area, to.index);
    if (!source || !target || (source.row === target.row && source.index === target.index)) return;
    const a = source.row[source.index];
    const b = target.row[target.index];
    if (!a) return;
    // A swap puts the target's stack where the dragged one was: both must fit their new row.
    const merges = b && b.defId === a.defId && b.enhance === a.enhance && ITEMS[a.defId].maxStack > 1;
    if ((to.area === "prof" && !fitsProfession(a)) || (from.area === "prof" && !merges && !fitsProfession(b))) {
      return notice(game, sessionId, PROFESSION_ONLY);
    }
    moveBetween(source.row, source.index, target.row, target.index);
    return changed(game, sessionId);
  }

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

  if (from.area === "inv" && to.area === "passive") {
    if (!validIndex(from.index)) return;
    return socketJewel(game, sessionId, from.index, to.socket, to.minor);
  }

  if (from.area === "passive" && to.area === "inv") {
    if (!validIndex(to.index)) return;
    return unsocketJewel(game, sessionId, from.socket, from.minor, to.index);
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

/** Drag and drop on the profession bag's tool slots: only the right tool goes in, out to the bags. */
function moveTool(game: Game, sessionId: string, from: SlotRef, to: SlotRef) {
  const { inv } = context(game, sessionId)!;
  if (from.area === "inv" && to.area === "tool") {
    if (!validIndex(from.index)) return;
    const stack = inv.slots[from.index];
    if (!stack) return;
    if (ITEMS[stack.defId]?.tool !== to.slot) return notice(game, sessionId, `Bu yuvaya sadece ${TOOL_SLOT_NAMES[to.slot]} konur`);
    // Swap: a tool already there goes where the new one came from.
    inv.slots[from.index] = inv.tools[to.slot] ?? null;
    inv.tools[to.slot] = stack;
    return changed(game, sessionId);
  }
  if (from.area === "tool" && to.area === "inv") {
    if (!validIndex(to.index)) return;
    const stack = inv.tools[from.slot];
    if (!stack) return;
    const target = inv.slots[to.index];
    if (target && ITEMS[target.defId]?.tool === from.slot) {
      inv.tools[from.slot] = target;
      inv.slots[to.index] = stack;
      return changed(game, sessionId);
    }
    const index = target ? inv.slots.indexOf(null) : to.index;
    if (index === -1) return notice(game, sessionId, "Envanter dolu");
    inv.slots[index] = stack;
    delete inv.tools[from.slot];
    return changed(game, sessionId);
  }
  if (to.area === "tool") return notice(game, sessionId, `Bu yuvaya sadece ${TOOL_SLOT_NAMES[to.slot]} konur`);
}

// ---- Using ---------------------------------------------------------------------

export function useItem(game: Game, sessionId: string, index: number | undefined, defId: string | undefined) {
  const ctx = context(game, sessionId);
  if (!ctx) return;
  if (index === undefined && defId !== undefined && ITEMS[defId]?.fishingRod && ctx.inv.tools.rod) return toggleFishing(game, sessionId);
  if (index === undefined && defId !== undefined) index = indexOfItem(ctx.inv, defId);
  if (!validIndex(index)) {
    if (defId) notice(game, sessionId, `${ITEMS[defId]?.name ?? "Item"} kalmadı`);
    return;
  }
  const stack = ctx.inv.slots[index];
  const def = stack && ITEMS[stack.defId];
  if (!stack || !def) return;

  if (def.slot) return equipFromInventory(game, sessionId, index);
  if (def.jewel) return autoSocket(game, sessionId, index);
  if (def.recall) return recall(game, sessionId, index);
  if (def.fishingRod) return toggleFishing(game, sessionId);
  if (def.tool) return moveTool(game, sessionId, { area: "inv", index }, { area: "tool", slot: def.tool });
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

/** `power` > 1 (night): more gold, likelier drops and better item modifiers. */
export function dropLoot(game: Game, x: number, y: number, mobDef: MobDef, ownerId: string | null, power = 1) {
  const { gold: [min, max], drops } = mobDef.loot;
  const contents: LootContents = { gold: Math.round((min + Math.floor(game.random() * (max - min + 1))) * power), items: [] };
  for (const drop of drops) {
    if (game.random() >= drop.chance * power) continue;
    const lo = drop.min ?? 1;
    const hi = drop.max ?? lo;
    contents.items.push(newStack(drop.item, lo + Math.floor(game.random() * (hi - lo + 1)), drop.enhance ?? 0, { luck: power }));
  }
  // Passive tree jewels can drop from anything; their effects scale with the mob's level.
  const jewelOdds = mobDef.boss ? JEWEL_DROPS.boss : (mobDef.scale ?? 1) > 1 ? JEWEL_DROPS.elite : JEWEL_DROPS.normal;
  if (game.random() < jewelOdds.minor * power * MOB_TUNING.dropChance) contents.items.push(newStack("minor_jewel", 1, 0, { level: mobDef.level, luck: power }));
  if (game.random() < jewelOdds.major * power * MOB_TUNING.dropChance) contents.items.push(newStack("major_jewel", 1, 0, { level: mobDef.level, luck: power }));
  if (game.random() < jewelOdds.greater * power * MOB_TUNING.dropChance) contents.items.push(newStack("greater_jewel", 1, 0, { level: mobDef.level, luck: power }));

  // A party's kill belongs to the whole party ("party:<id>"), otherwise to the killer.
  const ownerParty = ownerId ? partyIdOf(game.playerRuntime.get(ownerId)?.characterId ?? -1) : null;
  spawnLoot(game, x, y, contents, ownerParty ? `party:${ownerParty}` : (ownerId ?? ""));
}

/** A loot pile only `owner` may pick up for a while, then anyone, until it despawns. */
function spawnLoot(game: Game, x: number, y: number, contents: LootContents, owner: string) {
  const lootId = game.newId("l");
  const loot = new Loot();
  loot.x = x;
  loot.y = y;
  loot.owner = owner;
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

/** Whether the loot is ours to take (ours, our party's, or nobody's any more). */
export function mayLoot(game: Game, sessionId: string, loot: Loot): boolean {
  if (!loot.owner || loot.owner === sessionId) return true;
  const characterId = game.playerRuntime.get(sessionId)?.characterId;
  return characterId !== undefined && loot.owner === `party:${partyIdOf(characterId)}`;
}

export function pickupLoot(game: Game, sessionId: string, lootId: string) {
  const ctx = context(game, sessionId);
  const loot = game.state.loot.get(lootId);
  if (!ctx || !loot || ctx.player.dead) return;
  if (!mayLoot(game, sessionId, loot)) return notice(game, sessionId, "Bu ganimet senin değil");
  if (distance(ctx.player, loot) > LOOT_RANGE) return notice(game, sessionId, "Çok uzak");
  collectLoot(game, sessionId, lootId);
}

/**
 * Moves a loot pile's gold and items into the player's bags (whatever fits). The caller
 * checks who may take it and from where (the player in range, or their pet).
 * Returns false when something was left behind (bags full).
 */
export function collectLoot(game: Game, sessionId: string, lootId: string): boolean {
  const ctx = context(game, sessionId);
  const contents = game.lootContents.get(lootId);
  if (!ctx || !contents) return true;
  if (contents.gold > 0) {
    ctx.inv.gold += contents.gold;
    notice(game, sessionId, `+${contents.gold} altın`, GOLD_COLOR);
    contents.gold = 0;
  }
  const leftovers: ItemStack[] = [];
  for (const stack of contents.items) {
    const left = addItem(ctx.inv, stack.defId, stack.qty, stack.enhance, stack.affixes);
    const taken = stack.qty - left;
    const def = ITEMS[stack.defId];
    if (taken > 0) notice(game, sessionId, `${def.name}${taken > 1 ? ` x${taken}` : ""}`, RARITY_COLORS[itemRarity(def, stack.affixes)]);
    if (taken > 0 && stack.affixes.length === MAX_AFFIXES) broadcastSystem(`${ctx.player.name}, ${MAX_AFFIXES} statlı ${def.name} buldu!`);
    if (left > 0) leftovers.push({ ...stack, qty: left });
  }
  contents.items = leftovers;
  if (leftovers.length > 0) notice(game, sessionId, "Envanter dolu");
  else removeLoot(game, lootId);
  changed(game, sessionId);
  return leftovers.length === 0;
}

/** Puts a bag stack on the ground at your feet; it is yours for a while, like a kill's loot. */
export function dropItem(game: Game, sessionId: string, index: number, area: "inv" | "prof" = "inv") {
  const ctx = context(game, sessionId);
  const at = ctx && bagSlot(ctx.inv, area, index);
  if (!ctx || !at || ctx.player.dead) return;
  const stack = at.row[at.index];
  if (!stack) return;
  const def = ITEMS[stack.defId];
  if (def.questItem) return notice(game, sessionId, "Görev eşyası yere atılamaz");
  at.row[at.index] = null;
  spawnLoot(game, ctx.player.x, ctx.player.y, { gold: 0, items: [stack], dropped: true }, sessionId);
  notice(game, sessionId, `${def.name}${stack.qty > 1 ? ` x${stack.qty}` : ""} yere atıldı`, INFO_COLOR);
  changed(game, sessionId);
}

export function destroyItem(game: Game, sessionId: string, index: number, area: "inv" | "prof" = "inv") {
  const ctx = context(game, sessionId);
  const at = ctx && bagSlot(ctx.inv, area, index);
  if (!ctx || !at) return;
  const stack = at.row[at.index];
  if (!stack) return;
  const def = ITEMS[stack.defId];
  at.row[at.index] = null;
  notice(game, sessionId, `${def.name}${stack.qty > 1 ? ` x${stack.qty}` : ""} yok edildi`, INFO_COLOR);
  changed(game, sessionId);
}

/** The bags' "Düzenle" button. */
export function sortBags(game: Game, sessionId: string) {
  const ctx = context(game, sessionId);
  if (!ctx) return;
  sortInventory(ctx.inv);
  changed(game, sessionId);
}

// ---- Merchant ------------------------------------------------------------------

/** How many sold items a merchant will sell back. */
const BUYBACK_SIZE = 10;
/**
 * What each character sold lately (characterId -> newest first). Module-wide, so it follows
 * them from zone to zone; it is not saved and is gone when the server restarts.
 */
const soldItems = new Map<number, { stack: ItemStack; price: number }[]>();

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
  // Merchant gear is plain: always a single modifier.
  addItem(ctx.inv, itemId, amount, 0, { count: 1 });
  notice(game, sessionId, `${def.name}${amount > 1 ? ` x${amount}` : ""} alındı (-${cost} altın)`, GOLD_COLOR);
  changed(game, sessionId);
}

export function sell(game: Game, sessionId: string, npcId: string, index: number, area: "inv" | "prof" = "inv") {
  const ctx = nearNpc(game, sessionId, npcId);
  const at = ctx && bagSlot(ctx.inv, area, index);
  if (!ctx || !at) return;
  const stack = at.row[at.index];
  if (!stack) return;
  const def = ITEMS[stack.defId];
  if (def.questItem) return notice(game, sessionId, "Görev eşyası satılamaz");
  const value = itemSellPrice(def, stack.affixes) * stack.qty;
  at.row[at.index] = null;
  ctx.inv.gold += value;
  const sold = soldItems.get(ctx.runtime.characterId) ?? [];
  soldItems.set(ctx.runtime.characterId, [{ stack, price: value }, ...sold].slice(0, BUYBACK_SIZE));
  notice(game, sessionId, `${def.name}${stack.qty > 1 ? ` x${stack.qty}` : ""} satıldı (+${value} altın)`, GOLD_COLOR);
  changed(game, sessionId);
}

/** Buys a sold item back, as it was (+N and modifiers), for what the merchant paid. */
export function buyback(game: Game, sessionId: string, npcId: string, uid: string) {
  const ctx = nearNpc(game, sessionId, npcId);
  if (!ctx) return;
  const sold = soldItems.get(ctx.runtime.characterId) ?? [];
  const entry = sold.find((e) => e.stack.uid === uid);
  if (!entry) return;
  const { stack, price } = entry;
  const def = ITEMS[stack.defId];
  if (ctx.inv.gold < price) return notice(game, sessionId, "Yeterli altının yok");
  if (!hasSpaceFor(ctx.inv, stack.defId, stack.qty)) return notice(game, sessionId, "Envanter dolu");
  ctx.inv.gold -= price;
  if (def.maxStack > 1) addItem(ctx.inv, stack.defId, stack.qty, stack.enhance, stack.affixes);
  else if (def.tool && !ctx.inv.tools[def.tool]) ctx.inv.tools[def.tool] = stack;
  else ctx.inv.slots[ctx.inv.slots.indexOf(null)] = stack;
  soldItems.set(ctx.runtime.characterId, sold.filter((e) => e !== entry));
  notice(game, sessionId, `${def.name}${stack.qty > 1 ? ` x${stack.qty}` : ""} geri alındı (-${price} altın)`, GOLD_COLOR);
  changed(game, sessionId);
}

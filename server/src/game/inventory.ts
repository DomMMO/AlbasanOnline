import { randomUUID } from "node:crypto";
import {
  EQUIP_SLOTS,
  fitsBigSocket,
  hasAffixes,
  INVENTORY_SIZE,
  itemRarity,
  ITEMS,
  MINOR_SOCKETS,
  PASSIVE_SOCKETS,
  PROFESSION_BAG_SIZE,
  rollAffixes,
  STORAGE_SIZE,
  sanitizeAffixes,
  TOOL_SLOTS,
  type Affix,
  type AffixRollOptions,
  type EquipSlot,
  type ItemDef,
  type ItemView,
  type PassiveSocketView,
  type ToolSlot,
} from "../../../shared/src";

// Pure inventory data operations: no networking, no game rules beyond stacking.

export interface ItemStack {
  uid: string;
  defId: string;
  qty: number;
  enhance: number;
  /** Random modifiers; equipment only, [] for everything else. */
  affixes: Affix[];
}

/** One big socket of the passive tree and its small sockets. */
export interface PassiveSocket {
  major: ItemStack | null;
  minors: (ItemStack | null)[];
}

export interface InventoryData {
  gold: number;
  slots: (ItemStack | null)[];
  equipment: Partial<Record<EquipSlot, ItemStack>>;
  /** Profession bag: a tool in each tool slot, and the ore / herb / fish slots. */
  tools: Partial<Record<ToolSlot, ItemStack>>;
  profession: (ItemStack | null)[];
  passives: PassiveSocket[];
  /** Kept at the Depocu: only reachable standing next to her. */
  storage: (ItemStack | null)[];
  storageGold: number;
}

export function emptyPassives(): PassiveSocket[] {
  return Array.from({ length: PASSIVE_SOCKETS }, () => ({ major: null, minors: Array(MINOR_SOCKETS).fill(null) }));
}

/**
 * Database row shape. position = slot index for the inventory and storage, slot name for equipment,
 * "<socket>" for a big passive socket and "<socket>.<minor>" for a small one, tool slot name for a tool,
 * slot index for the profession bag.
 */
export interface StoredItem {
  uid: string;
  defId: string;
  qty: number;
  enhance: number;
  affixes?: Affix[];
  container: "inventory" | "equipment" | "passive" | "storage" | "tool" | "profession";
  position: string;
}

/** How a new item's modifiers are decided: fixed ones (an existing item moving), or a roll. */
export type ItemQuality = Affix[] | AffixRollOptions;

export function newStack(defId: string, qty: number, enhance = 0, quality: ItemQuality = {}): ItemStack {
  const affixes = Array.isArray(quality) ? quality : rollAffixes(ITEMS[defId], Math.random, quality);
  return { uid: randomUUID(), defId, qty, enhance, affixes };
}

const canMerge = (stack: ItemStack | null, defId: string, enhance: number) =>
  stack !== null && stack.defId === defId && stack.enhance === enhance;

/** Only ore, herbs and fish go in the profession bag. */
export const fitsProfession = (stack: ItemStack | null) => !stack || !!ITEMS[stack.defId]?.profession;

/** The rows of slots an item is picked up into, in order: profession materials try their own bag first. */
function rowsFor(inv: InventoryData, def: ItemDef): (ItemStack | null)[][] {
  return def.profession ? [inv.profession, inv.slots] : [inv.slots];
}

/**
 * Adds up to `qty`; returns how many did NOT fit. Each new equipment piece rolls its own modifiers unless given.
 * A tool fills its empty tool slot first, ore / herbs / fish the profession bag, the rest goes in the bags.
 */
export function addItem(inv: InventoryData, defId: string, qty: number, enhance = 0, quality: ItemQuality = {}): number {
  const def = ITEMS[defId];
  if (!def) return qty;
  let left = qty;
  if (def.tool && !inv.tools[def.tool] && left > 0) {
    inv.tools[def.tool] = newStack(defId, 1, enhance, quality);
    left--;
  }
  for (const row of rowsFor(inv, def)) left = addToRow(row, def, left, enhance, quality);
  return left;
}

function addToRow(slots: (ItemStack | null)[], def: ItemDef, qty: number, enhance: number, quality: ItemQuality): number {
  const defId = def.id;
  let left = qty;
  if (def.maxStack > 1) {
    for (const stack of slots) {
      if (left === 0) break;
      if (!canMerge(stack, defId, enhance)) continue;
      const take = Math.min(def.maxStack - stack!.qty, left);
      stack!.qty += take;
      left -= take;
    }
  }
  while (left > 0) {
    const index = slots.indexOf(null);
    if (index === -1) break;
    const take = Math.min(def.maxStack, left);
    slots[index] = newStack(defId, take, enhance, quality);
    left -= take;
  }
  return left;
}

/**
 * Moves a whole stack into a row of slots (bags, storage): merges into matching stacks first,
 * the rest keeps its identity (uid, +N, modifiers) in a free slot. Returns false, changing
 * nothing, if it doesn't all fit.
 */
export function placeStack(slots: (ItemStack | null)[], stack: ItemStack): boolean {
  const def = ITEMS[stack.defId];
  if (!def) return false;
  const merges = def.maxStack > 1 ? slots.filter((s): s is ItemStack => canMerge(s, stack.defId, stack.enhance)) : [];
  const room = merges.reduce((sum, s) => sum + def.maxStack - s.qty, 0);
  const free = slots.indexOf(null);
  if (room < stack.qty && free === -1) return false;
  let left = stack.qty;
  for (const target of merges) {
    const take = Math.min(def.maxStack - target.qty, left);
    target.qty += take;
    left -= take;
  }
  if (left > 0) slots[free] = { ...stack, qty: left };
  return true;
}

export function hasSpaceFor(inv: InventoryData, defId: string, qty: number): boolean {
  const def = ITEMS[defId];
  if (!def) return false;
  let capacity = def.tool && !inv.tools[def.tool] ? 1 : 0;
  if (capacity >= qty) return true;
  for (const row of rowsFor(inv, def)) {
    for (const stack of row) {
      if (stack === null) capacity += def.maxStack;
      else if (def.maxStack > 1 && canMerge(stack, defId, 0)) capacity += def.maxStack - stack.qty;
      if (capacity >= qty) return true;
    }
  }
  return false;
}

/** How many of an item are carried: bags, profession bag and tool slots (equipment not counted). */
export function countOf(inv: InventoryData, defId: string): number {
  const count = (row: (ItemStack | null)[]) => row.reduce((sum, stack) => sum + (stack?.defId === defId ? stack.qty : 0), 0);
  return count(inv.slots) + count(inv.profession) + count(Object.values(inv.tools));
}

/** Removes up to `count` of an item from the bags and the profession bag, smallest stacks first. */
export function takeItems(inv: InventoryData, defId: string, count: number) {
  let left = count;
  const found = [inv.slots, inv.profession]
    .flatMap((row) => row.map((stack, index) => ({ row, stack, index })))
    .filter((s) => s.stack?.defId === defId)
    .sort((a, b) => a.stack!.qty - b.stack!.qty);
  for (const { row, stack, index } of found) {
    if (left <= 0) break;
    const take = Math.min(left, stack!.qty);
    stack!.qty -= take;
    if (stack!.qty <= 0) row[index] = null;
    left -= take;
  }
}

/** A tool of this kind, in its tool slot or anywhere in the bags. */
export function hasTool(inv: InventoryData, slot: ToolSlot): boolean {
  return !!inv.tools[slot] || inv.slots.some((stack) => stack && ITEMS[stack.defId]?.tool === slot);
}

/**
 * Tools from the bags into their empty tool slots, ore / herbs / fish from the bags into the
 * profession bag (as much as fits). On load and on "Düzenle".
 */
export function tidyProfession(inv: InventoryData) {
  inv.slots.forEach((stack, index) => {
    const def = stack && ITEMS[stack.defId];
    if (!stack || !def) return;
    if (def.tool && !inv.tools[def.tool]) {
      inv.tools[def.tool] = stack;
      inv.slots[index] = null;
    } else if (def.profession && placeStack(inv.profession, stack)) {
      inv.slots[index] = null;
    }
  });
}

export function indexOfItem(inv: InventoryData, defId: string): number {
  return inv.slots.findIndex((stack) => stack?.defId === defId);
}

/** Removes `qty` from a slot, clearing it when empty. */
export function removeAt(inv: InventoryData, index: number, qty: number) {
  const stack = inv.slots[index];
  if (!stack) return;
  stack.qty -= qty;
  if (stack.qty <= 0) inv.slots[index] = null;
}

/** Sort order of a stack in the bags: gear by slot, then jewels, consumables, quest items, materials. */
function sortKey(stack: ItemStack): (string | number)[] {
  const def = ITEMS[stack.defId];
  const rarityRank = ["legendary", "epic", "rare", "uncommon", "common"];
  if (def.slot) {
    const rarity = itemRarity(def, stack.affixes);
    return [0, EQUIP_SLOTS.indexOf(def.slot), rarityRank.indexOf(rarity), -def.level, -stack.enhance, def.name];
  }
  if (def.jewel) return [1, ["greater", "major", "minor"].indexOf(def.jewel), -(stack.affixes[0]?.tier ?? 0), def.name];
  if (def.heal || def.mana || def.recall) return [2, def.mana ? 1 : def.recall ? 2 : 0, -def.level, def.name];
  if (def.questItem) return [3, def.name];
  return [4, rarityRank.indexOf(def.rarity), def.name];
}

function compareKeys(a: (string | number)[], b: (string | number)[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x).localeCompare(String(y), "tr");
  }
  return 0;
}

/**
 * "Düzenle": tools and materials go to the profession bag, then in both the bags and the
 * profession bag partial stacks merge and everything is laid out from the first slot without gaps.
 */
export function sortInventory(inv: InventoryData) {
  tidyProfession(inv);
  inv.slots = sortRow(inv.slots);
  inv.profession = sortRow(inv.profession);
}

function sortRow(slots: (ItemStack | null)[]): (ItemStack | null)[] {
  const stacks = slots.filter((s): s is ItemStack => s !== null);
  const merged: ItemStack[] = [];
  for (const stack of stacks) {
    const def = ITEMS[stack.defId];
    let left = stack.qty;
    if (def.maxStack > 1) {
      for (const into of merged) {
        if (left === 0) break;
        if (into.defId !== stack.defId || into.enhance !== stack.enhance || into.qty >= def.maxStack) continue;
        const take = Math.min(def.maxStack - into.qty, left);
        into.qty += take;
        left -= take;
      }
    }
    if (left > 0) merged.push({ ...stack, qty: left });
  }
  merged.sort((a, b) => compareKeys(sortKey(a), sortKey(b)));
  return Array.from({ length: slots.length }, (_, i) => merged[i] ?? null);
}

export function equippedItems(inv: InventoryData): ItemStack[] {
  return EQUIP_SLOTS.map((slot) => inv.equipment[slot]).filter((stack): stack is ItemStack => !!stack);
}

/** Every jewel in the passive tree (their modifiers count towards the stats). */
export function socketedJewels(inv: InventoryData): ItemStack[] {
  return inv.passives.flatMap((socket) => [socket.major, ...socket.minors]).filter((stack): stack is ItemStack => !!stack);
}

export function toView(inv: InventoryData): {
  gold: number;
  slots: (ItemView | null)[];
  equipment: Partial<Record<EquipSlot, ItemView>>;
  tools: Partial<Record<ToolSlot, ItemView>>;
  profession: (ItemView | null)[];
  passives: PassiveSocketView[];
  storage: { gold: number; slots: (ItemView | null)[] };
} {
  const view = (stack: ItemStack | null) => (stack ? { ...stack } : null);
  return {
    gold: inv.gold,
    slots: inv.slots.map(view),
    equipment: Object.fromEntries(EQUIP_SLOTS.filter((slot) => inv.equipment[slot]).map((slot) => [slot, { ...inv.equipment[slot]! }])),
    tools: Object.fromEntries(TOOL_SLOTS.filter((slot) => inv.tools[slot]).map((slot) => [slot, { ...inv.tools[slot]! }])),
    profession: inv.profession.map(view),
    passives: inv.passives.map((socket) => ({ major: view(socket.major), minors: socket.minors.map(view) })),
    storage: { gold: inv.storageGold, slots: inv.storage.map(view) },
  };
}

/** Puts a stored jewel back in its socket; false if the position is invalid or taken. */
function placeJewel(inv: InventoryData, position: string, stack: ItemStack): boolean {
  const [socketText, minorText] = position.split(".");
  const socket = inv.passives[Number(socketText)];
  const kind = ITEMS[stack.defId]?.jewel;
  if (!socket || !Number.isInteger(Number(socketText))) return false;
  if (minorText === undefined) {
    if (!fitsBigSocket(kind, Number(socketText)) || socket.major) return false;
    socket.major = stack;
    return true;
  }
  const minor = Number(minorText);
  if (kind !== "minor" || !Number.isInteger(minor) || minor < 0 || minor >= MINOR_SOCKETS || socket.minors[minor]) return false;
  socket.minors[minor] = stack;
  return true;
}

export function fromStored(gold: number, items: StoredItem[], storageGold = 0): InventoryData {
  const inv: InventoryData = {
    gold,
    slots: Array(INVENTORY_SIZE).fill(null),
    equipment: {},
    tools: {},
    profession: Array(PROFESSION_BAG_SIZE).fill(null),
    passives: emptyPassives(),
    storage: Array(STORAGE_SIZE).fill(null),
    storageGold,
  };
  const misplaced: ItemStack[] = [];
  const misplacedInStorage: ItemStack[] = [];
  for (const item of items) {
    const def = ITEMS[item.defId];
    if (!def) continue; // item removed from the game
    // Equipment from before modifiers existed rolls them once, on its first load.
    let affixes = sanitizeAffixes(item.affixes);
    if (!hasAffixes(def)) affixes = [];
    else if (affixes.length === 0) affixes = rollAffixes(def, Math.random);
    const stack = { uid: item.uid, defId: item.defId, qty: item.qty, enhance: item.enhance, affixes };
    if (item.container === "equipment") {
      const slot = item.position as EquipSlot;
      if (def.slot === slot && !inv.equipment[slot]) inv.equipment[slot] = stack;
      else misplaced.push(stack);
    } else if (item.container === "tool") {
      const slot = item.position as ToolSlot;
      if (def.tool === slot && !inv.tools[slot]) inv.tools[slot] = stack;
      else misplaced.push(stack);
    } else if (item.container === "profession") {
      const index = Number(item.position);
      if (def.profession && Number.isInteger(index) && index >= 0 && index < PROFESSION_BAG_SIZE && !inv.profession[index]) inv.profession[index] = stack;
      else misplaced.push(stack);
    } else if (item.container === "passive") {
      if (!placeJewel(inv, item.position, stack)) misplaced.push(stack);
    } else if (item.container === "storage") {
      const index = Number(item.position);
      if (Number.isInteger(index) && index >= 0 && index < STORAGE_SIZE && !inv.storage[index]) inv.storage[index] = stack;
      else misplacedInStorage.push(stack);
    } else {
      const index = Number(item.position);
      if (Number.isInteger(index) && index >= 0 && index < INVENTORY_SIZE && !inv.slots[index]) inv.slots[index] = stack;
      else misplaced.push(stack);
    }
  }
  // Characters from before the profession bag: their tools and materials move in on the first load.
  tidyProfession(inv);
  for (const stack of misplaced) {
    if (ITEMS[stack.defId].profession && placeStack(inv.profession, stack)) continue;
    const index = inv.slots.indexOf(null);
    if (index !== -1) inv.slots[index] = stack;
    else misplacedInStorage.push(stack);
  }
  // What fits nowhere else waits in storage rather than being lost.
  for (const stack of misplacedInStorage) {
    const index = inv.storage.indexOf(null);
    if (index !== -1) inv.storage[index] = stack;
  }
  return inv;
}

export function toStored(inv: InventoryData): StoredItem[] {
  const items: StoredItem[] = [];
  inv.slots.forEach((stack, index) => {
    if (stack) items.push({ ...stack, container: "inventory", position: String(index) });
  });
  for (const slot of EQUIP_SLOTS) {
    const stack = inv.equipment[slot];
    if (stack) items.push({ ...stack, container: "equipment", position: slot });
  }
  for (const slot of TOOL_SLOTS) {
    const stack = inv.tools[slot];
    if (stack) items.push({ ...stack, container: "tool", position: slot });
  }
  inv.profession.forEach((stack, index) => {
    if (stack) items.push({ ...stack, container: "profession", position: String(index) });
  });
  inv.storage.forEach((stack, index) => {
    if (stack) items.push({ ...stack, container: "storage", position: String(index) });
  });
  inv.passives.forEach((socket, index) => {
    if (socket.major) items.push({ ...socket.major, container: "passive", position: String(index) });
    socket.minors.forEach((stack, minor) => {
      if (stack) items.push({ ...stack, container: "passive", position: `${index}.${minor}` });
    });
  });
  return items;
}

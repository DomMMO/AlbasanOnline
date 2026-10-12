import { randomUUID } from "node:crypto";
import {
  EQUIP_SLOTS,
  fitsBigSocket,
  hasAffixes,
  INVENTORY_SIZE,
  ITEMS,
  MINOR_SOCKETS,
  PASSIVE_SOCKETS,
  rollAffixes,
  sanitizeAffixes,
  type Affix,
  type AffixRollOptions,
  type EquipSlot,
  type ItemView,
  type PassiveSocketView,
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
  passives: PassiveSocket[];
}

export function emptyPassives(): PassiveSocket[] {
  return Array.from({ length: PASSIVE_SOCKETS }, () => ({ major: null, minors: Array(MINOR_SOCKETS).fill(null) }));
}

/**
 * Database row shape. position = slot index for the inventory, slot name for equipment,
 * "<socket>" for a big passive socket and "<socket>.<minor>" for a small one.
 */
export interface StoredItem {
  uid: string;
  defId: string;
  qty: number;
  enhance: number;
  affixes?: Affix[];
  container: "inventory" | "equipment" | "passive";
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

/** Adds up to `qty`; returns how many did NOT fit. Each new equipment piece rolls its own modifiers unless given. */
export function addItem(inv: InventoryData, defId: string, qty: number, enhance = 0, quality: ItemQuality = {}): number {
  const def = ITEMS[defId];
  if (!def) return qty;
  let left = qty;
  if (def.maxStack > 1) {
    for (const stack of inv.slots) {
      if (left === 0) break;
      if (!canMerge(stack, defId, enhance)) continue;
      const take = Math.min(def.maxStack - stack!.qty, left);
      stack!.qty += take;
      left -= take;
    }
  }
  while (left > 0) {
    const index = inv.slots.indexOf(null);
    if (index === -1) break;
    const take = Math.min(def.maxStack, left);
    inv.slots[index] = newStack(defId, take, enhance, quality);
    left -= take;
  }
  return left;
}

export function hasSpaceFor(inv: InventoryData, defId: string, qty: number): boolean {
  const def = ITEMS[defId];
  if (!def) return false;
  let capacity = 0;
  for (const stack of inv.slots) {
    if (stack === null) capacity += def.maxStack;
    else if (def.maxStack > 1 && canMerge(stack, defId, 0)) capacity += def.maxStack - stack.qty;
    if (capacity >= qty) return true;
  }
  return false;
}

/** How many of an item are in the bags (equipment not counted). */
export function countOf(inv: InventoryData, defId: string): number {
  return inv.slots.reduce((sum, stack) => sum + (stack?.defId === defId ? stack.qty : 0), 0);
}

/** Removes up to `count` of an item from the bags, smallest stacks first. */
export function takeItems(inv: InventoryData, defId: string, count: number) {
  let left = count;
  const indexes = inv.slots
    .map((stack, index) => ({ stack, index }))
    .filter((s) => s.stack?.defId === defId)
    .sort((a, b) => a.stack!.qty - b.stack!.qty);
  for (const { stack, index } of indexes) {
    if (left <= 0) break;
    const take = Math.min(left, stack!.qty);
    removeAt(inv, index, take);
    left -= take;
  }
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
  passives: PassiveSocketView[];
} {
  const view = (stack: ItemStack | null) => (stack ? { ...stack } : null);
  return {
    gold: inv.gold,
    slots: inv.slots.map(view),
    equipment: Object.fromEntries(EQUIP_SLOTS.filter((slot) => inv.equipment[slot]).map((slot) => [slot, { ...inv.equipment[slot]! }])),
    passives: inv.passives.map((socket) => ({ major: view(socket.major), minors: socket.minors.map(view) })),
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

export function fromStored(gold: number, items: StoredItem[]): InventoryData {
  const inv: InventoryData = { gold, slots: Array(INVENTORY_SIZE).fill(null), equipment: {}, passives: emptyPassives() };
  const misplaced: ItemStack[] = [];
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
    } else if (item.container === "passive") {
      if (!placeJewel(inv, item.position, stack)) misplaced.push(stack);
    } else {
      const index = Number(item.position);
      if (Number.isInteger(index) && index >= 0 && index < INVENTORY_SIZE && !inv.slots[index]) inv.slots[index] = stack;
      else misplaced.push(stack);
    }
  }
  for (const stack of misplaced) {
    const index = inv.slots.indexOf(null);
    if (index !== -1) inv.slots[index] = stack;
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
  inv.passives.forEach((socket, index) => {
    if (socket.major) items.push({ ...socket.major, container: "passive", position: String(index) });
    socket.minors.forEach((stack, minor) => {
      if (stack) items.push({ ...stack, container: "passive", position: `${index}.${minor}` });
    });
  });
  return items;
}

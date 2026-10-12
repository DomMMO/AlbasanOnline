import { randomUUID } from "node:crypto";
import { EQUIP_SLOTS, INVENTORY_SIZE, ITEMS, type EquipSlot, type ItemView } from "../../../shared/src";

// Pure inventory data operations: no networking, no game rules beyond stacking.

export interface ItemStack {
  uid: string;
  defId: string;
  qty: number;
  enhance: number;
}

export interface InventoryData {
  gold: number;
  slots: (ItemStack | null)[];
  equipment: Partial<Record<EquipSlot, ItemStack>>;
}

/** Database row shape. position = slot index for the inventory, slot name for equipment. */
export interface StoredItem {
  uid: string;
  defId: string;
  qty: number;
  enhance: number;
  container: "inventory" | "equipment";
  position: string;
}

export function newStack(defId: string, qty: number, enhance = 0): ItemStack {
  return { uid: randomUUID(), defId, qty, enhance };
}

const canMerge = (stack: ItemStack | null, defId: string, enhance: number) =>
  stack !== null && stack.defId === defId && stack.enhance === enhance;

/** Adds up to `qty`; returns how many did NOT fit. */
export function addItem(inv: InventoryData, defId: string, qty: number, enhance = 0): number {
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
    inv.slots[index] = newStack(defId, take, enhance);
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

export function toView(inv: InventoryData): { gold: number; slots: (ItemView | null)[]; equipment: Partial<Record<EquipSlot, ItemView>> } {
  return {
    gold: inv.gold,
    slots: inv.slots.map((stack) => (stack ? { ...stack } : null)),
    equipment: Object.fromEntries(EQUIP_SLOTS.filter((slot) => inv.equipment[slot]).map((slot) => [slot, { ...inv.equipment[slot]! }])),
  };
}

export function fromStored(gold: number, items: StoredItem[]): InventoryData {
  const inv: InventoryData = { gold, slots: Array(INVENTORY_SIZE).fill(null), equipment: {} };
  const misplaced: ItemStack[] = [];
  for (const item of items) {
    const def = ITEMS[item.defId];
    if (!def) continue; // item removed from the game
    const stack = { uid: item.uid, defId: item.defId, qty: item.qty, enhance: item.enhance };
    if (item.container === "equipment") {
      const slot = item.position as EquipSlot;
      if (def.slot === slot && !inv.equipment[slot]) inv.equipment[slot] = stack;
      else misplaced.push(stack);
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
  return items;
}

import { ITEMS, STORAGE_SIZE, type InventoryEvent, type ItemView, type NpcDef, type SlotRef } from "../../../shared/src";
import { DRAG_TYPE, renderSlot } from "./inventory";
import { isolateKeys } from "./market";
import { hideTooltip, showItemTooltip } from "./tooltip";
import { isTouchDevice } from "./touch";

// Storage window (Depocu): the character's storage slots and gold vault. Items move by
// drag and drop between this grid and the inventory, or by right-click (to the other
// side). Like the inventory it only shows what the server sent last.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const windowEl = $("storage-window");
const gridEl = $("storage-grid");
const goldEl = $("storage-gold");
const goldInput = $<HTMLInputElement>("storage-gold-input");

export interface StorageActions {
  move(from: SlotRef, to: SlotRef): void;
  /** Right-click: send a stack to the other side. */
  quick(npcId: string, from: { area: "inv" | "storage"; index: number }): void;
  /** Positive deposits, negative withdraws. */
  gold(npcId: string, amount: number): void;
  playerLevel(): number;
}

let actions: StorageActions;
let openNpc: NpcDef | null = null;
let slots: (ItemView | null)[] = [];
const slotEls: HTMLElement[] = [];
/** Touch: first tap shows the tooltip, the second one moves the item. */
let armedSlot: HTMLElement | null = null;

function makeSlot(index: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "item-slot";
  const ref: SlotRef = { area: "storage", index };
  el.addEventListener("dragstart", (event) => {
    if (!slots[index]) return event.preventDefault();
    event.dataTransfer!.setData(DRAG_TYPE, JSON.stringify(ref));
    event.dataTransfer!.effectAllowed = "move";
    hideTooltip();
  });
  el.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types.includes(DRAG_TYPE)) event.preventDefault();
  });
  el.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const from = JSON.parse(event.dataTransfer!.getData(DRAG_TYPE)) as SlotRef;
    actions.move(from, ref);
  });
  const withdraw = (event: MouseEvent) => {
    event.preventDefault();
    hideTooltip();
    if (openNpc && slots[index]) actions.quick(openNpc.id, { area: "storage", index });
  };
  el.addEventListener("contextmenu", withdraw);
  el.addEventListener("dblclick", withdraw);
  el.addEventListener("click", (event) => {
    if (!isTouchDevice) return;
    if (armedSlot !== el) {
      armedSlot = el;
      return;
    }
    armedSlot = null;
    withdraw(event);
  });
  el.addEventListener("mouseenter", () => {
    const item = slots[index];
    const def = item && ITEMS[item.defId];
    if (!item || !def) return;
    showItemTooltip(
      def,
      { qty: item.qty, enhance: item.enhance, affixes: item.affixes, playerLevel: actions.playerLevel(), footer: [{ text: "Sağ tık: envantere al" }] },
      el,
    );
  });
  el.addEventListener("mouseleave", hideTooltip);
  return el;
}

export function initStorage(storageActions: StorageActions) {
  actions = storageActions;
  closeStorage();
  if (slotEls.length > 0) return;
  for (let index = 0; index < STORAGE_SIZE; index++) {
    const el = makeSlot(index);
    slotEls.push(el);
    gridEl.append(el);
  }
  isolateKeys(goldInput);
  const sendGold = (sign: 1 | -1) => {
    const amount = Math.floor(Number(goldInput.value));
    if (!openNpc || !Number.isSafeInteger(amount) || amount <= 0) return;
    actions.gold(openNpc.id, sign * amount);
    goldInput.value = "";
  };
  for (const [id, sign] of [["storage-deposit", 1], ["storage-withdraw", -1]] as const) {
    const button = $(id);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => sendGold(sign));
  }
  $("storage-close").addEventListener("click", closeStorage);
  // Dropping an inventory item anywhere on the window (not on a slot) puts it in storage.
  windowEl.addEventListener("dragover", (event) => event.preventDefault());
  windowEl.addEventListener("drop", (event) => {
    event.preventDefault();
    const raw = event.dataTransfer?.getData(DRAG_TYPE);
    const from = raw ? (JSON.parse(raw) as SlotRef) : null;
    if (openNpc && from?.area === "inv") actions.quick(openNpc.id, { area: "inv", index: from.index });
  });
}

/** Called with every inventory snapshot (storage comes along with it). */
export function updateStorage(event: InventoryEvent) {
  slots = event.storage.slots;
  slotEls.forEach((el, index) => {
    renderSlot(el, slots[index]);
    el.draggable = !!slots[index];
  });
  goldEl.textContent = event.storage.gold.toLocaleString("tr-TR");
}

export function openStorage(npc: NpcDef) {
  openNpc = npc;
  windowEl.hidden = false;
}

export function closeStorage() {
  openNpc = null;
  windowEl.hidden = true;
  armedSlot = null;
  hideTooltip();
}

/** The Depocu whose storage is open, or null. */
export function storageNpc(): NpcDef | null {
  return openNpc;
}

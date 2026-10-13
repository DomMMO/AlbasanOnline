import {
  ATTRIBUTE_HELP,
  ATTRIBUTE_IDS,
  ATTRIBUTE_NAMES,
  EQUIP_SLOT_NAMES,
  EQUIP_SLOTS,
  glowTier,
  INVENTORY_SIZE,
  itemRarity,
  ITEMS,
  type EquipSlot,
  type InventoryEvent,
  type ItemView,
  type SlotRef,
} from "../../../shared/src";
import { itemIconUrl } from "../gfx/icons";
import { hideTooltip, showItemTooltip } from "./tooltip";
import { isTouchDevice } from "./touch";

/** Touch: the first tap on a slot shows its tooltip, a second tap uses it (no right-click on phones). */
let armedSlot: HTMLElement | null = null;

// Character + inventory window (I / C). Shows server state only: every action is
// sent as a request and the window redraws when the next InventoryEvent arrives.

export interface InventoryActions {
  move(from: SlotRef, to: SlotRef): void;
  /** Right-click / double-click on an inventory item. */
  activate(index: number): void;
  unequip(slot: EquipSlot): void;
  /** Hint shown at the bottom of tooltips for inventory items. */
  activateHint(index: number): string;
  playerLevel(): number;
}

const $ = (id: string) => document.getElementById(id)!;
const windowEl = $("inventory-window");
const equipEl = $("equipment");
const gridEl = $("inventory-grid");
const goldEl = $("gold");
const statsEl = $("stats");

let state: InventoryEvent | null = null;
let actions: InventoryActions;
export const DRAG_TYPE = "application/x-mmo-slot";

/** Makes a slot element look like it holds `item` (or nothing). */
export function renderSlot(el: HTMLElement, item: ItemView | null | undefined) {
  el.replaceChildren();
  el.classList.toggle("filled", !!item);
  const tier = item ? glowTier(item.enhance) : 0;
  for (const t of [7, 8, 9, 10]) el.classList.toggle(`glow-${t}`, tier === t);
  const def = item ? ITEMS[item.defId] : undefined;
  if (!item || !def) return;
  const img = document.createElement("img");
  img.src = itemIconUrl(def, item.affixes);
  img.draggable = false;
  el.append(img);
  el.style.setProperty("--rarity", `var(--rarity-${itemRarity(def, item.affixes)})`);
  if (item.qty > 1) el.append(Object.assign(document.createElement("span"), { className: "qty", textContent: String(item.qty) }));
  if (item.enhance > 0) el.append(Object.assign(document.createElement("span"), { className: "plus", textContent: `+${item.enhance}` }));
}

/** Bag and equipment slots (the passive tree and storage have their own windows). */
type BagRef = Extract<SlotRef, { area: "inv" | "equip" }>;

function itemAt(ref: BagRef): ItemView | null | undefined {
  if (!state) return null;
  return ref.area === "inv" ? state.slots[ref.index] : state.equipment[ref.slot];
}

function makeSlot(ref: BagRef, label?: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "item-slot";
  if (label) el.dataset.label = label;

  el.addEventListener("dragstart", (event) => {
    if (!itemAt(ref)) return event.preventDefault();
    event.dataTransfer!.setData(DRAG_TYPE, JSON.stringify(ref));
    event.dataTransfer!.effectAllowed = "move";
    hideTooltip();
  });
  el.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types.includes(DRAG_TYPE)) event.preventDefault();
  });
  el.addEventListener("drop", (event) => {
    event.preventDefault();
    const from = JSON.parse(event.dataTransfer!.getData(DRAG_TYPE)) as SlotRef;
    actions.move(from, ref);
  });

  const activate = (event: MouseEvent) => {
    event.preventDefault();
    hideTooltip();
    if (!itemAt(ref)) return;
    if (ref.area === "inv") actions.activate(ref.index);
    else actions.unequip(ref.slot);
  };
  el.addEventListener("contextmenu", activate);
  el.addEventListener("dblclick", activate);
  el.addEventListener("click", (event) => {
    if (!isTouchDevice) return;
    if (armedSlot !== el) {
      armedSlot = el;
      return;
    }
    armedSlot = null;
    activate(event);
  });

  el.addEventListener("mouseenter", () => {
    const item = itemAt(ref);
    const def = item && ITEMS[item.defId];
    if (!item || !def) return;
    const hint = ref.area === "inv" ? actions.activateHint(ref.index) : "Sağ tık: çıkar";
    showItemTooltip(def, { qty: item.qty, enhance: item.enhance, affixes: item.affixes, playerLevel: actions.playerLevel(), footer: [{ text: hint }] }, el);
  });
  el.addEventListener("mouseleave", hideTooltip);
  return el;
}

const equipSlots = new Map<EquipSlot, HTMLElement>();
const invSlots: HTMLElement[] = [];

/** Builds the slots once; later calls (after a zone change) only swap the action handlers. */
export function initInventory(inventoryActions: InventoryActions) {
  actions = inventoryActions;
  if (invSlots.length > 0) return;
  for (const slot of EQUIP_SLOTS) {
    const el = makeSlot({ area: "equip", slot }, EQUIP_SLOT_NAMES[slot]);
    // Slots sit next to the body part they cover (see #equipment grid areas).
    el.style.gridArea = slot;
    equipSlots.set(slot, el);
    equipEl.append(el);
  }
  for (let index = 0; index < INVENTORY_SIZE; index++) {
    const el = makeSlot({ area: "inv", index });
    invSlots.push(el);
    gridEl.append(el);
  }
  $("inventory-close").addEventListener("click", () => toggleInventory(false));
}

export function updateInventory(event: InventoryEvent) {
  state = event;
  for (const [slot, el] of equipSlots) {
    renderSlot(el, event.equipment[slot]);
    el.draggable = !!event.equipment[slot];
  }
  invSlots.forEach((el, index) => {
    renderSlot(el, event.slots[index]);
    el.draggable = !!event.slots[index];
  });
  goldEl.textContent = event.gold.toLocaleString("tr-TR");
  const { attack, defense, maxHp, attackSpeedMs, critChance, lifeSteal, attributes } = event.stats;
  statsEl.innerHTML = `
    <span>Saldırı <b>${attack}</b></span><span>Savunma <b>${defense}</b></span>
    <span>Can <b>${maxHp}</b></span><span>Hız <b>${(attackSpeedMs / 1000).toFixed(2)} sn</b></span>
    <span>Kritik <b>%${(critChance * 100).toFixed(1)}</b></span><span>Can Çalma <b>%${Math.round(lifeSteal * 100)}</b></span>
    ${ATTRIBUTE_IDS.map((id) => `<span title="${ATTRIBUTE_HELP[id]}">${ATTRIBUTE_NAMES[id]} <b>${attributes[id]}</b></span>`).join("")}`;
}

export function inventoryState() {
  return state;
}

export function countItem(defId: string): number {
  return state?.slots.reduce((sum, item) => sum + (item?.defId === defId ? item.qty : 0), 0) ?? 0;
}

export function toggleInventory(open = windowEl.hidden) {
  windowEl.hidden = !open;
  if (!open) hideTooltip();
}

export function isInventoryOpen() {
  return !windowEl.hidden;
}

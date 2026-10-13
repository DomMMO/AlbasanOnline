import { classOf, ITEMS, type SlotRef } from "../../../shared/src";
import { iconUrl, itemIconUrl } from "../gfx/icons";
import { countItem, DRAG_TYPE, inventoryState } from "./inventory";
import { hideTooltip, showItemTooltip } from "./tooltip";
import { Action } from "../input/InputManager";
import { actionKeyLabel } from "../input/keybindings";

// Two potion slots right of the health globe (Q and R). Each holds an item type (a potion or
// food); using it drinks the first one in the bags. Drag a potion from the bags onto a slot to
// change it, right-click to empty it. Saved per character in this browser.

export interface PotionActions {
  use(defId: string): void;
  playerLevel(): number;
}

const SLOTS = 2;
const ACTIONS = [Action.Potion1, Action.Potion2];
const $ = (id: string) => document.getElementById(id)!;
const container = $("potion-slots");

let actions: PotionActions;
let owner = "";
let potions: string[] = [];
const elements: { el: HTMLButtonElement; img: HTMLImageElement; count: HTMLElement; sweep: HTMLElement }[] = [];
/** Cooldown group -> [start, end] (performance.now()). */
const cooldowns = new Map<string, [number, number]>();
let looping = false;

const usable = (defId: string) => !!ITEMS[defId] && !!(ITEMS[defId].heal || ITEMS[defId].mana);

function save() {
  try {
    localStorage.setItem(`mmo-potions:${owner}`, JSON.stringify(potions));
  } catch {
    // storage blocked
  }
}

export function initPotions(name: string, cls: string, potionActions: PotionActions) {
  actions = potionActions;
  owner = name;
  const defaults = classOf(cls).potions;
  potions = [...defaults];
  try {
    const saved = JSON.parse(localStorage.getItem(`mmo-potions:${name}`) ?? "null");
    if (Array.isArray(saved)) potions = saved.map((id) => (typeof id === "string" && usable(id) ? id : ""));
  } catch {
    // keep the defaults
  }
  potions = Array.from({ length: SLOTS }, (_, i) => potions[i] ?? "");
  if (elements.length === 0) build();
  render();
  if (!looping) {
    looping = true;
    requestAnimationFrame(loop);
  }
}

function build() {
  for (let i = 0; i < SLOTS; i++) {
    const el = document.createElement("button");
    el.type = "button";
    el.tabIndex = -1;
    el.className = "slot potion";
    el.innerHTML = `<span class="slot-key">${actionKeyLabel(ACTIONS[i])}</span><span class="slot-sweep"></span>`;
    const img = Object.assign(document.createElement("img"), { draggable: false, alt: "" });
    const count = Object.assign(document.createElement("span"), { className: "slot-count" });
    el.prepend(img);
    el.append(count);
    el.addEventListener("mousedown", (e) => e.preventDefault());
    el.addEventListener("click", () => usePotion(i));
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      potions[i] = "";
      save();
      render();
    });
    el.addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types.includes(DRAG_TYPE)) e.preventDefault();
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      const ref = JSON.parse(e.dataTransfer!.getData(DRAG_TYPE)) as SlotRef;
      const item = ref.area === "inv" ? inventoryState()?.slots[ref.index] : undefined;
      if (!item || !usable(item.defId)) return;
      potions[i] = item.defId;
      save();
      render();
    });
    el.addEventListener("mouseenter", () => {
      const def = ITEMS[potions[i]];
      if (def) showItemTooltip(def, { qty: countItem(def.id), playerLevel: actions.playerLevel(), footer: [{ text: `${actionKeyLabel(ACTIONS[i]) || "Tık"}: iç · sağ tık: boşalt` }] }, el);
    });
    el.addEventListener("mouseleave", hideTooltip);
    elements.push({ el, img, count, sweep: el.querySelector(".slot-sweep")! });
    container.append(el);
  }
}

/** Key bindings changed: relabel the slots. */
export function refreshPotionKeys() {
  elements.forEach(({ el }, i) => {
    const label = el.querySelector(".slot-key");
    if (label) label.textContent = actionKeyLabel(ACTIONS[i]);
  });
}

export function usePotion(index: number) {
  const defId = potions[index];
  if (!defId) return;
  elements[index]?.el.classList.remove("pressed");
  void elements[index]?.el.offsetWidth;
  elements[index]?.el.classList.add("pressed");
  actions.use(defId);
}

/** Inventory changed: counts. */
export function render() {
  potions.forEach((defId, i) => {
    const { el, img, count } = elements[i];
    const def = ITEMS[defId];
    el.classList.toggle("empty", !def);
    img.hidden = !def;
    if (def) img.src = itemIconUrl(def);
    const have = def ? countItem(defId) : 0;
    count.textContent = def ? String(have) : "";
    el.classList.toggle("no-resource", !!def && have === 0);
  });
}

/** SkillUsed for an item cooldown group ("potion", "mana_potion", "food"). */
export function startPotionCooldown(group: string, ms: number) {
  if (ms <= 0) return;
  const now = performance.now();
  cooldowns.set(group, [now, now + ms]);
}

function loop() {
  const now = performance.now();
  potions.forEach((defId, i) => {
    const def = ITEMS[defId];
    const cd = def ? cooldowns.get(def.cooldownGroup ?? def.id) : undefined;
    const fraction = cd && now < cd[1] ? (cd[1] - now) / (cd[1] - cd[0]) : 0;
    elements[i].sweep.style.height = `${fraction * 100}%`;
  });
  requestAnimationFrame(loop);
}

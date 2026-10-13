import {
  HORSE_BREED_IDS,
  HORSE_BREEDS,
  HORSE_PALETTE,
  HORSE_STYLE_PRICE,
  horseLookOf,
  type HorseLook,
  type HorseStateEvent,
  type NpcDef,
} from "../../../shared/src";
import { horseIconUrl } from "../gfx/horse";
import { inventoryState } from "./inventory";

// Seyis Yusuf's window at the horse farm. "Atlar": every breed with its speed and price;
// buy one, or ride another one you own. "Düzenle": dye the ridden horse's coat, mane,
// blanket and saddle with a live preview. Both cost a fortune, so they ask first.

export interface StableActions {
  buy(npcId: string, breed: string): void;
  select(npcId: string, breed: string): void;
  style(npcId: string, look: HorseLook): void;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const windowEl = $("stable-window");
const bodyEl = $("stable-body");

let actions: StableActions;
let npc: NpcDef | null = null;
let horses: HorseStateEvent = { owned: ["village"], active: "village", looks: {} };
let tab: "breeds" | "style" = "breeds";
/** The colours being tried on in the Düzenle tab. */
let draft: HorseLook | null = null;
/** What is waiting for "Eminim": a breed to buy, or the restyle. */
let confirming: { kind: "buy"; breed: string } | { kind: "style" } | null = null;
let initialised = false;

const gold = (n: number) => n.toLocaleString("tr-TR");
const PART_NAMES: Record<keyof HorseLook, string> = { coat: "Don", mane: "Yele", blanket: "Örtü", saddle: "Eyer" };

export function initStable(stableActions: StableActions) {
  actions = stableActions;
  if (initialised) return;
  initialised = true;
  $("stable-close").addEventListener("click", closeStable);
  windowEl.addEventListener("mousedown", (event) => {
    if ((event.target as HTMLElement).tagName === "BUTTON") event.preventDefault();
  });
}

export function setHorseState(event: HorseStateEvent) {
  horses = event;
  draft = null;
  confirming = null;
  if (!windowEl.hidden) render();
}

/** The look of the horse we ride (for the HUD button). */
export function activeHorseLook(): HorseLook {
  return horseLookOf(horses);
}

export function openStable(target: NpcDef) {
  npc = target;
  tab = "breeds";
  draft = null;
  confirming = null;
  windowEl.hidden = false;
  render();
}

export function closeStable() {
  npc = null;
  windowEl.hidden = true;
}

export function stableNpc(): NpcDef | null {
  return windowEl.hidden ? null : npc;
}

/** Gold changed (inventory update): prices may become affordable. */
export function refreshStable() {
  if (!windowEl.hidden) render();
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void, className = "", disabled = false): HTMLButtonElement {
  const b = el("button", className, label);
  b.type = "button";
  b.tabIndex = -1;
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}

function render() {
  if (!npc) return;
  const purse = inventoryState()?.gold ?? 0;
  const tabs = el("div", "stable-tabs");
  for (const [id, label] of [["breeds", "Atlar"], ["style", "Düzenle"]] as const) {
    tabs.append(
      button(label, () => {
        tab = id;
        confirming = null;
        render();
      }, tab === id ? "active" : "secondary"),
    );
  }
  const purseEl = el("div", "stable-purse", `Kesende: ${gold(purse)} altın`);
  bodyEl.replaceChildren(tabs, purseEl, tab === "breeds" ? breedsView(purse) : styleView(purse));
}

function breedsView(purse: number): HTMLElement {
  const list = el("div", "stable-list");
  for (const id of HORSE_BREED_IDS) {
    const breed = HORSE_BREEDS[id];
    const owned = horses.owned.includes(id);
    const riding = horses.active === id;
    const row = el("div", `stable-row${riding ? " riding" : ""}`);
    const img = el("img", "stable-horse");
    img.src = horseIconUrl(3, horseLookOf(horses, id));
    img.alt = breed.name;
    const text = el("div", "stable-text");
    text.append(
      el("div", "stable-name", breed.name),
      el("div", "stable-speed", breed.speedBonus > 0 ? `+%${Math.round(breed.speedBonus * 100)} binek hızı` : "Normal binek hızı"),
      el("div", "stable-desc", breed.description),
    );
    const side = el("div", "stable-side");
    if (confirming?.kind === "buy" && confirming.breed === id) {
      side.append(
        el("div", "stable-ask", `${gold(breed.price)} altın. Emin misin?`),
        button("Eminim, al", () => {
          confirming = null;
          actions.buy(npc!.id, id);
        }),
        button("Vazgeç", () => {
          confirming = null;
          render();
        }, "secondary"),
      );
    } else if (riding) {
      side.append(el("div", "stable-badge", "Binilen"));
    } else if (owned) {
      side.append(button("Bin", () => actions.select(npc!.id, id)));
    } else {
      side.append(
        el("div", "stable-price", `${gold(breed.price)} altın`),
        button("Satın al", () => {
          confirming = { kind: "buy", breed: id };
          render();
        }, "", purse < breed.price),
      );
    }
    row.append(img, text, side);
    list.append(row);
  }
  return list;
}

function styleView(purse: number): HTMLElement {
  const box = el("div", "stable-style");
  const current = horseLookOf(horses);
  const look = (draft ??= { ...current });
  const preview = el("img", "stable-preview");
  preview.src = horseIconUrl(5, look);
  box.append(el("div", "stable-name", HORSE_BREEDS[horses.active].name), preview);

  for (const part of Object.keys(HORSE_PALETTE) as (keyof HorseLook)[]) {
    const row = el("div", "stable-swatches");
    row.append(el("span", "stable-part", PART_NAMES[part]));
    for (const color of HORSE_PALETTE[part]) {
      const swatch = button("", () => {
        draft = { ...look, [part]: color };
        confirming = null;
        render();
      }, `swatch${look[part] === color ? " active" : ""}`);
      swatch.style.background = `#${color.toString(16).padStart(6, "0")}`;
      row.append(swatch);
    }
    box.append(row);
  }

  const unchanged = (Object.keys(look) as (keyof HorseLook)[]).every((part) => look[part] === current[part]);
  const actionsRow = el("div", "stable-actions");
  if (confirming?.kind === "style") {
    actionsRow.append(
      el("div", "stable-ask", `Bu düzenleme ${gold(HORSE_STYLE_PRICE)} altın tutar. Emin misin?`),
      button("Eminim, düzenle", () => {
        confirming = null;
        actions.style(npc!.id, look);
      }),
      button("Vazgeç", () => {
        confirming = null;
        render();
      }, "secondary"),
    );
  } else {
    actionsRow.append(
      button("Geri al", () => {
        draft = null;
        render();
      }, "secondary", unchanged),
      button(`Düzenle (${gold(HORSE_STYLE_PRICE)} altın)`, () => {
        confirming = { kind: "style" };
        render();
      }, "", unchanged || purse < HORSE_STYLE_PRICE),
    );
  }
  box.append(actionsRow, el("p", "window-hint", "Renkler yalnızca bindiğin ata uygulanır. Başka bir atını düzenlemek için önce ona bin."));
  return box;
}

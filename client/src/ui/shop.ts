import { ITEMS, RARITY_COLORS, type NpcDef } from "../../../shared/src";
import { iconUrl, itemIconUrl } from "../gfx/icons";
import { hideTooltip, showItemTooltip } from "./tooltip";

// Merchant window. Buying is a click; selling happens from the inventory
// (right-click or drag an item onto this window).

const $ = (id: string) => document.getElementById(id)!;
const windowEl = $("shop-window");
const titleEl = $("shop-title");
const listEl = $("shop-list");

let openNpc: NpcDef | null = null;

export interface ShopActions {
  buy(npcId: string, itemId: string, qty: number): void;
  /** Called when an inventory item is dropped on the shop window. */
  sell(npcId: string, index: number): void;
  playerLevel(): number;
  gold(): number;
}

let actions: ShopActions;

let initialised = false;

export function initShop(shopActions: ShopActions) {
  actions = shopActions;
  closeShop();
  if (initialised) return;
  initialised = true;
  $("shop-close").addEventListener("click", closeShop);
  windowEl.addEventListener("dragover", (event) => event.preventDefault());
  windowEl.addEventListener("drop", (event) => {
    event.preventDefault();
    const raw = event.dataTransfer?.getData("application/x-mmo-slot");
    const from = raw ? JSON.parse(raw) : null;
    if (openNpc && from?.area === "inv") actions.sell(openNpc.id, from.index);
  });
}

export function openShop(npc: NpcDef) {
  openNpc = npc;
  titleEl.textContent = npc.name;
  listEl.replaceChildren(
    ...npc.shop.map((itemId) => {
      const def = ITEMS[itemId];
      const row = document.createElement("button");
      row.type = "button";
      row.className = "shop-row";
      row.tabIndex = -1;
      row.dataset.itemId = itemId;
      row.innerHTML = `<img alt="" /><span class="name"></span><span class="price"></span>`;
      (row.querySelector("img") as HTMLImageElement).src = itemIconUrl(def);
      const name = row.querySelector(".name") as HTMLElement;
      name.textContent = def.name;
      name.style.color = RARITY_COLORS[def.rarity];
      row.querySelector(".price")!.textContent = `${def.buyPrice}`;
      row.addEventListener("mousedown", (event) => event.preventDefault());
      row.addEventListener("click", (event) => actions.buy(npc.id, itemId, event.shiftKey && def.maxStack > 1 ? 5 : 1));
      row.addEventListener("mouseenter", () =>
        showItemTooltip(
          def,
          {
            playerLevel: actions.playerLevel(),
            affixHint: "1 rastgele stat (dükkân malı)",
            footer: [
              { text: `Fiyat: ${def.buyPrice} altın`, color: "#ffd34d" },
              { text: def.maxStack > 1 ? "Tık: 1 al · Shift+tık: 5 al" : "Tık: satın al" },
            ],
          },
          row,
        ),
      );
      row.addEventListener("mouseleave", hideTooltip);
      return row;
    }),
  );
  refreshShop();
  windowEl.hidden = false;
}

/** Greys out what the player can't afford. */
export function refreshShop() {
  if (!openNpc) return;
  for (const row of listEl.children) {
    const def = ITEMS[(row as HTMLElement).dataset.itemId!];
    row.classList.toggle("unaffordable", (def.buyPrice ?? 0) > actions.gold());
  }
}

export function closeShop() {
  openNpc = null;
  windowEl.hidden = true;
  hideTooltip();
}

export function openShopNpc(): NpcDef | null {
  return openNpc;
}

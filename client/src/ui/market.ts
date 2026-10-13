import {
  ITEMS,
  itemRarity,
  RARITY_COLORS,
  STALL_MAX_PRICE,
  STALL_SLOTS,
  STALL_TITLE_MAX,
  type ItemView,
  type MyStallEvent,
  type StallContentsEvent,
  type StallListingInput,
  type StallListingView,
} from "../../../shared/src";
import { itemIconUrl } from "../gfx/icons";
import { DRAG_TYPE, inventoryState } from "./inventory";
import { hideTooltip, showItemTooltip } from "./tooltip";

// Player market windows. "Pazar Kur" opens the setup window: put items in from the
// inventory (right-click or drag), set a price per unit and open the stall. Other
// players' stalls open in the browse window. The server checks every sale; these
// windows only show what it sends.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stallButton = $<HTMLButtonElement>("stall-button");
const setupEl = $("stall-setup");
const setupTitle = $<HTMLInputElement>("stall-title-input");
const setupList = $("stall-setup-list");
const setupHint = $("stall-setup-hint");
const setupTotal = $("stall-setup-total");
const setupAction = $<HTMLButtonElement>("stall-setup-action");
const browseEl = $("stall-browse");
const browseTitle = $("stall-browse-title");
const browseSeller = $("stall-browse-seller");
const browseList = $("stall-browse-list");

export interface MarketActions {
  open(title: string, items: StallListingInput[]): void;
  close(): void;
  buy(sellerId: string, uid: string, qty: number, price: number): void;
  playerLevel(): number;
  gold(): number;
}

let actions: MarketActions;
/** Items picked for the stall before it opens (uid -> price, "" = not set yet). */
let drafts: { uid: string; price: string }[] = [];
/** Our stall as the server last described it; null = closed. */
let myStall: MyStallEvent["stall"] = null;
let browsing: StallContentsEvent | null = null;
let initialised = false;

const formatGold = (n: number) => n.toLocaleString("tr-TR");

/** Typing in market inputs must not move the character or trigger hotkeys. */
export function isolateKeys(input: HTMLInputElement) {
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape" || event.key === "Enter") input.blur();
  });
}

export function initMarket(marketActions: MarketActions) {
  actions = marketActions;
  drafts = [];
  myStall = null;
  closeStallWindows();
  if (initialised) return;
  initialised = true;

  setupTitle.maxLength = STALL_TITLE_MAX;
  isolateKeys(setupTitle);
  stallButton.addEventListener("mousedown", (event) => event.preventDefault());
  stallButton.addEventListener("click", () => openStallSetup());
  $("stall-setup-close").addEventListener("click", () => (setupEl.hidden = true));
  $("stall-browse-close").addEventListener("click", closeBrowse);
  setupEl.addEventListener("dragover", (event) => event.preventDefault());
  setupEl.addEventListener("drop", (event) => {
    event.preventDefault();
    const raw = event.dataTransfer?.getData(DRAG_TYPE);
    const from = raw ? JSON.parse(raw) : null;
    if (from?.area === "inv") addToStall(from.index);
  });
  setupAction.addEventListener("mousedown", (event) => event.preventDefault());
  setupAction.addEventListener("click", () => {
    if (myStall) return actions.close();
    const items: StallListingInput[] = [];
    for (const draft of drafts) {
      const price = Number(draft.price);
      if (!Number.isSafeInteger(price) || price < 1 || price > STALL_MAX_PRICE) {
        setupHint.textContent = "Her item için geçerli bir fiyat yaz.";
        setupHint.classList.add("error");
        return;
      }
      items.push({ uid: draft.uid, price });
    }
    if (items.length === 0) {
      setupHint.textContent = "Önce envanterden item koy.";
      setupHint.classList.add("error");
      return;
    }
    actions.open(setupTitle.value, items);
  });
}

/** "Pazar Kur" on the market square; "Pazarım" (reopen the window) while our stall is open. */
export function setStallButtonVisible(onMarket: boolean) {
  stallButton.hidden = !onMarket && myStall === null;
  stallButton.textContent = myStall ? "Pazarım" : "Pazar Kur";
}

export function openStallSetup() {
  setupEl.hidden = false;
  renderSetup();
}

export function isStallSetupOpen() {
  return !setupEl.hidden;
}

function inventoryItem(uid: string): { item: ItemView; index: number } | null {
  const slots = inventoryState()?.slots ?? [];
  const index = slots.findIndex((s) => s?.uid === uid);
  return index === -1 ? null : { item: slots[index]!, index };
}

/** Puts an inventory item on the stall (setup window). Returns false if it can't go there. */
export function addToStall(index: number): boolean {
  if (myStall) return false;
  const item = inventoryState()?.slots[index];
  if (!item) return false;
  if (drafts.some((d) => d.uid === item.uid)) return true;
  if (drafts.length >= STALL_SLOTS) {
    setupHint.textContent = `En fazla ${STALL_SLOTS} item koyabilirsin.`;
    setupHint.classList.add("error");
    return false;
  }
  drafts.push({ uid: item.uid, price: "" });
  renderSetup();
  // Jump straight to the new row's price.
  const inputs = setupList.querySelectorAll<HTMLInputElement>("input");
  inputs[inputs.length - 1]?.focus();
  return true;
}

/** Inventory changed: drop drafts for items that are gone. */
export function refreshMarket() {
  if (!myStall) drafts = drafts.filter((d) => inventoryItem(d.uid));
  if (!setupEl.hidden) renderSetup();
  if (browsing) renderBrowse();
}

function itemRow(item: ItemView, extra: HTMLElement[]): HTMLElement {
  const def = ITEMS[item.defId];
  const row = document.createElement("div");
  row.className = "stall-row";
  const img = document.createElement("img");
  img.src = itemIconUrl(def, item.affixes);
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = `${def.name}${item.enhance ? ` +${item.enhance}` : ""}${item.qty > 1 ? ` x${item.qty}` : ""}`;
  name.style.color = RARITY_COLORS[itemRarity(def, item.affixes)];
  row.append(img, name, ...extra);
  row.addEventListener("mouseenter", () =>
    showItemTooltip(def, { qty: item.qty, enhance: item.enhance, affixes: item.affixes, playerLevel: actions.playerLevel() }, img),
  );
  row.addEventListener("mouseleave", hideTooltip);
  return row;
}

function renderSetup() {
  setupHint.classList.remove("error");
  setupTitle.disabled = myStall !== null;
  if (myStall) {
    setupTitle.value = myStall.title;
    setupList.replaceChildren(
      ...myStall.items.map((listing) => {
        const price = document.createElement("span");
        price.className = "price";
        price.textContent = formatGold(listing.price);
        return itemRow(listing, [price]);
      }),
    );
    const total = myStall.items.reduce((sum, l) => sum + l.price * l.qty, 0);
    setupTotal.textContent = `Kalan değer: ${formatGold(total)} altın`;
    setupHint.textContent = "Pazar açık. Satılanlar sohbete yazılır. Kapatana kadar yerinden kalkamazsın.";
    setupAction.textContent = "Pazarı Kapat";
    return;
  }

  setupList.replaceChildren(
    ...drafts.flatMap((draft) => {
      const found = inventoryItem(draft.uid);
      if (!found) return [];
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = String(STALL_MAX_PRICE);
      input.placeholder = "Birim fiyat";
      input.value = draft.price;
      isolateKeys(input);
      input.addEventListener("input", () => {
        draft.price = input.value;
        renderTotal();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.textContent = "×";
      remove.title = "Tezgâhtan kaldır";
      remove.addEventListener("click", () => {
        drafts = drafts.filter((d) => d !== draft);
        renderSetup();
      });
      return [itemRow(found.item, [input, remove])];
    }),
  );
  if (drafts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Tezgâh boş.";
    setupList.append(empty);
  }
  setupHint.textContent = `Envanterde sağ tıkla ya da item'ı buraya sürükle (en fazla ${STALL_SLOTS}). Fiyat birim başınadır.`;
  setupAction.textContent = "Pazarı Aç";
  renderTotal();
}

function renderTotal() {
  if (myStall) return;
  const total = drafts.reduce((sum, d) => sum + (Number(d.price) || 0) * (inventoryItem(d.uid)?.item.qty ?? 0), 0);
  setupTotal.textContent = `Toplam: ${formatGold(total)} altın`;
}

/** Server's view of our own stall (opened, something sold, closed). */
export function onMyStall(event: MyStallEvent) {
  const wasOpen = myStall !== null;
  myStall = event.stall;
  if (myStall) {
    setupEl.hidden = false;
  } else if (wasOpen) {
    drafts = [];
  }
  renderSetup();
}

export function isStallOpen() {
  return myStall !== null;
}

// ---- Browsing someone else's stall ------------------------------------------------

export function showStallContents(event: StallContentsEvent) {
  browsing = event;
  browseEl.hidden = false;
  renderBrowse();
}

function renderBrowse() {
  if (!browsing) return;
  const { sellerId, seller, title, items } = browsing;
  browseTitle.textContent = title;
  browseSeller.textContent = `Satıcı: ${seller}`;
  if (items.length === 0) {
    browseList.innerHTML = `<p class="muted">Tezgâhta bir şey kalmadı.</p>`;
    return;
  }
  browseList.replaceChildren(...items.map((listing) => browseRow(sellerId, listing)));
}

function browseRow(sellerId: string, listing: StallListingView): HTMLElement {
  const extra: HTMLElement[] = [];
  let qtyInput: HTMLInputElement | null = null;
  if (listing.qty > 1) {
    qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.max = String(listing.qty);
    qtyInput.value = "1";
    qtyInput.className = "qty";
    qtyInput.title = "Adet";
    isolateKeys(qtyInput);
    extra.push(qtyInput);
  }
  const price = document.createElement("span");
  price.className = "price";
  price.textContent = formatGold(listing.price);
  price.title = "Birim fiyat";
  const buy = document.createElement("button");
  buy.type = "button";
  buy.textContent = "Al";
  buy.addEventListener("mousedown", (event) => event.preventDefault());
  buy.addEventListener("click", () => {
    const qty = Math.max(1, Math.min(listing.qty, Math.floor(Number(qtyInput?.value ?? 1)) || 1));
    actions.buy(sellerId, listing.uid, qty, listing.price);
  });
  extra.push(price, buy);
  const row = itemRow(listing, extra);
  row.classList.toggle("unaffordable", listing.price > actions.gold());
  return row;
}

export function onStallClosed(sellerId: string) {
  if (browsing?.sellerId === sellerId) closeBrowse();
}

export function browsingSeller(): string | null {
  return browsing?.sellerId ?? null;
}

export function closeBrowse() {
  browsing = null;
  browseEl.hidden = true;
  hideTooltip();
}

export function closeStallWindows() {
  setupEl.hidden = true;
  stallButton.hidden = true;
  closeBrowse();
}

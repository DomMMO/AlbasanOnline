import { ITEMS, TRADE_INVITE_MS, TRADE_SLOTS, type ItemView, type TradeSideView, type TradeStateEvent } from "../../../shared/src";
import { DRAG_TYPE, inventoryState, renderSlot } from "./inventory";
import { isolateKeys } from "./market";
import { hideTooltip, showItemTooltip } from "./tooltip";
import { registerWindow } from "./windows";

// Player trade (takas): the request prompt and the trade window. Our side takes items from
// the inventory (right-click, or drag onto the window) and gold; the other side is read-only.
// "Teklifi Kilitle" freezes our offer; when both are frozen "Takası Tamamla" confirms.
// The server decides everything; this window only shows the last TradeState.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const inviteEl = $("trade-invite");
const inviteText = $("trade-invite-text");
const windowEl = $("trade-window");
const titleEl = $("trade-title");
const partnerEl = $("trade-partner");
const mineEl = $("trade-mine");
const theirsEl = $("trade-theirs");
const mineStatus = $("trade-mine-status");
const theirsStatus = $("trade-theirs-status");
const mineGrid = $("trade-mine-grid");
const theirsGrid = $("trade-theirs-grid");
const goldInput = $<HTMLInputElement>("trade-gold-input");
const theirsGold = $("trade-theirs-gold");
const hintEl = $("trade-hint");
const actionButton = $<HTMLButtonElement>("trade-action");

export interface TradeActions {
  respond(accept: boolean): void;
  offer(items: string[], gold: number): void;
  lock(): void;
  confirm(): void;
  cancel(): void;
  playerLevel(): number;
}

let actions: TradeActions;
let trade: TradeStateEvent["trade"] = null;
let initialised = false;
let inviteTimer = 0;
const mineSlots: HTMLElement[] = [];
const theirsSlots: HTMLElement[] = [];

function makeSlot(mine: boolean, index: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "item-slot";
  const item = () => (trade ? (mine ? trade.mine : trade.theirs).items[index] : undefined);
  el.addEventListener("mouseenter", () => {
    const view = item();
    const def = view && ITEMS[view.defId];
    if (!view || !def) return;
    const footer = mine && !trade?.mine.locked ? [{ text: "Tık: tekliften çıkar" }] : [];
    showItemTooltip(def, { qty: view.qty, enhance: view.enhance, affixes: view.affixes, playerLevel: actions.playerLevel(), footer }, el);
  });
  el.addEventListener("mouseleave", hideTooltip);
  if (mine) {
    el.addEventListener("click", () => {
      const view = item();
      if (!trade || !view || trade.mine.locked) return;
      hideTooltip();
      sendOffer(trade.mine.items.filter((i) => i.uid !== view.uid).map((i) => i.uid));
    });
  }
  return el;
}

export function initTrade(tradeActions: TradeActions) {
  actions = tradeActions;
  trade = null;
  windowEl.hidden = true;
  inviteEl.hidden = true;
  if (initialised) return;
  initialised = true;
  for (let i = 0; i < TRADE_SLOTS; i++) {
    const mine = makeSlot(true, i);
    const theirs = makeSlot(false, i);
    mineSlots.push(mine);
    theirsSlots.push(theirs);
    mineGrid.append(mine);
    theirsGrid.append(theirs);
  }
  $("trade-accept").addEventListener("click", () => answer(true));
  $("trade-decline").addEventListener("click", () => answer(false));
  // Esc on the request declines it; on the window it cancels the trade.
  registerWindow("trade-invite", () => answer(false));
  isolateKeys(goldInput);
  goldInput.addEventListener("change", () => trade && sendOffer(trade.mine.items.map((i) => i.uid)));
  actionButton.addEventListener("mousedown", (event) => event.preventDefault());
  actionButton.addEventListener("click", () => {
    if (!trade) return;
    if (!trade.mine.locked) {
      // Whatever is typed in the gold box counts, even if it wasn't committed yet.
      sendOffer(trade.mine.items.map((i) => i.uid));
      actions.lock();
    } else if (trade.theirs.locked && !trade.mine.confirmed) actions.confirm();
  });
  $("trade-cancel").addEventListener("click", () => actions.cancel());
  $("trade-close").addEventListener("click", () => actions.cancel());
  windowEl.addEventListener("dragover", (event) => event.preventDefault());
  windowEl.addEventListener("drop", (event) => {
    event.preventDefault();
    const raw = event.dataTransfer?.getData(DRAG_TYPE);
    const from = raw ? JSON.parse(raw) : null;
    if (from?.area === "inv") addToTrade(from.index);
  });
}

function answer(accept: boolean) {
  inviteEl.hidden = true;
  clearTimeout(inviteTimer);
  actions.respond(accept);
}

export function showTradeInvite(from: string) {
  inviteText.textContent = `${from} seninle takas yapmak istiyor.`;
  inviteEl.hidden = false;
  clearTimeout(inviteTimer);
  inviteTimer = window.setTimeout(() => (inviteEl.hidden = true), TRADE_INVITE_MS);
}

function offeredGold(): number {
  const gold = Math.floor(Number(goldInput.value));
  return Number.isSafeInteger(gold) && gold > 0 ? gold : 0;
}

function sendOffer(uids: string[]) {
  actions.offer(uids, offeredGold());
}

/** Right-click / drop from the inventory while trading. Returns false if it can't go in. */
export function addToTrade(index: number): boolean {
  const item = inventoryState()?.slots[index];
  if (!trade || !item) return false;
  if (trade.mine.locked) {
    hint("Teklifini kilitledin, artık değiştiremezsin.", true);
    return false;
  }
  const uids = trade.mine.items.map((i) => i.uid);
  if (uids.includes(item.uid)) return true;
  if (uids.length >= TRADE_SLOTS) {
    hint(`En fazla ${TRADE_SLOTS} item koyabilirsin.`, true);
    return false;
  }
  sendOffer([...uids, item.uid]);
  return true;
}

function hint(text: string, error = false) {
  hintEl.textContent = text;
  hintEl.style.color = error ? "var(--error)" : "";
}

function renderSide(els: HTMLElement[], side: TradeSideView) {
  els.forEach((el, i) => renderSlot(el, side.items[i] as ItemView | undefined));
}

function status(side: TradeSideView) {
  return side.confirmed ? "✓ onayladı" : side.locked ? "kilitledi" : "";
}

function render() {
  if (!trade) return;
  const { partner, mine, theirs } = trade;
  titleEl.textContent = `Takas: ${partner}`;
  partnerEl.textContent = `${partner} teklifi`;
  renderSide(mineSlots, mine);
  renderSide(theirsSlots, theirs);
  mineEl.classList.toggle("locked", mine.locked && !mine.confirmed);
  mineEl.classList.toggle("confirmed", mine.confirmed);
  theirsEl.classList.toggle("locked", theirs.locked && !theirs.confirmed);
  theirsEl.classList.toggle("confirmed", theirs.confirmed);
  mineStatus.textContent = status(mine);
  theirsStatus.textContent = status(theirs);
  goldInput.disabled = mine.locked;
  // Don't overwrite what we are typing; once locked show what the server holds.
  if (mine.locked || document.activeElement !== goldInput) goldInput.value = String(mine.gold);
  theirsGold.textContent = theirs.gold.toLocaleString("tr-TR");

  actionButton.disabled = false;
  if (!mine.locked) {
    actionButton.textContent = "Teklifi Kilitle";
    hint("Envanterde sağ tıkla ya da item'ı buraya sürükle. Altın yazıp kilitle.");
  } else if (!theirs.locked) {
    actionButton.textContent = "Karşı taraf bekleniyor";
    actionButton.disabled = true;
    hint(`${partner} teklifini kilitleyince takası onaylayabilirsin.`);
  } else if (!mine.confirmed) {
    actionButton.textContent = "Takası Tamamla";
    hint("İki teklif de kilitli. Karşı tarafın teklifini kontrol et ve onayla.");
  } else {
    actionButton.textContent = "Onay bekleniyor";
    actionButton.disabled = true;
    hint(`${partner} onaylayınca takas tamamlanır.`);
  }
}

export function onTradeState(event: TradeStateEvent) {
  const opening = !trade && event.trade;
  trade = event.trade;
  if (!trade) {
    windowEl.hidden = true;
    hideTooltip();
    return;
  }
  if (opening) goldInput.value = "0";
  windowEl.hidden = false;
  render();
}

export function isTradeOpen() {
  return trade !== null;
}

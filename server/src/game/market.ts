import {
  distance,
  ITEMS,
  MAX_GOLD,
  Msg,
  itemRarity,
  RARITY_COLORS,
  STALL_MAX_PRICE,
  STALL_RANGE,
  STALL_SLOTS,
  STALL_SPACING,
  STALL_TITLE_MAX,
  stallSpotProblem,
  Tile,
  TILE_SIZE,
  type ChatEvent,
  type MyStallEvent,
  type StallClosedEvent,
  type StallContentsEvent,
  type StallListingInput,
  type StallListingView,
} from "../../../shared/src";
import type { Game } from "./Game";
import { addItem, hasSpaceFor, removeAt } from "./inventory";
import { notice, sendInventory } from "./items";

// Player market (Knight Online style stalls). A player standing on the market square
// opens a stall: picks items from the inventory and a price per unit. While the stall
// is open they can't move or touch their inventory; the listed items stay in it (and
// are saved with it), so nothing is lost if the server stops. Other players browse
// the stall and buy; every sale is checked again here and both characters are then
// saved together in one transaction.

const GOLD_COLOR = "#ffd34d";

export interface StallState {
  title: string;
  /** Listed item uid -> price per unit. */
  listings: Map<string, number>;
  /** Session ids of players with this stall's window open. */
  browsers: Set<string>;
}

function ctx(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  return player && runtime ? { player, runtime, inv: runtime.inventory } : null;
}

function cleanTitle(raw: unknown, fallback: string): string {
  const title = typeof raw === "string" ? raw.replace(/\p{C}/gu, "").replace(/\s+/g, " ").trim().slice(0, STALL_TITLE_MAX) : "";
  return title || fallback;
}

/** Blocks inventory actions while the player's stall is open. Returns true if blocked. */
export function stallLocked(game: Game, sessionId: string): boolean {
  if (!game.playerRuntime.get(sessionId)?.stall) return false;
  notice(game, sessionId, "Pazar açıkken envanterini değiştiremezsin");
  return true;
}

/** Listings that are still in the seller's inventory (anything else is dropped). */
function listingsOf(game: Game, sellerId: string): StallListingView[] {
  const seller = ctx(game, sellerId);
  const stall = seller?.runtime.stall;
  if (!seller || !stall) return [];
  const items: StallListingView[] = [];
  for (const [uid, price] of stall.listings) {
    const stack = seller.inv.slots.find((s) => s?.uid === uid);
    if (stack) items.push({ ...stack, price });
    else stall.listings.delete(uid);
  }
  return items;
}

function contentsOf(game: Game, sellerId: string): StallContentsEvent {
  const seller = ctx(game, sellerId)!;
  return { sellerId, seller: seller.player.name, title: seller.runtime.stall!.title, items: listingsOf(game, sellerId) };
}

function sendMyStall(game: Game, sessionId: string) {
  const stall = game.playerRuntime.get(sessionId)?.stall;
  const event: MyStallEvent = { stall: stall ? { title: stall.title, items: listingsOf(game, sessionId) } : null };
  game.io.send(sessionId, Msg.MyStall, event);
}

/** Pushes the current contents to the seller and everyone browsing the stall. */
function stallChanged(game: Game, sellerId: string) {
  const stall = game.playerRuntime.get(sellerId)?.stall;
  if (!stall) return;
  sendMyStall(game, sellerId);
  const contents = contentsOf(game, sellerId);
  for (const browser of stall.browsers) game.io.send(browser, Msg.StallContents, contents);
}

export function openStall(game: Game, sessionId: string, rawTitle: unknown, rawItems: unknown) {
  const c = ctx(game, sessionId);
  if (!c) return;
  const { player, runtime, inv } = c;
  if (runtime.stall) return notice(game, sessionId, "Pazarın zaten açık");
  if (player.dead) return;
  // Anywhere in town, as long as it is not a doorway or someone's spot.
  const problem = stallSpotProblem(game.zone.id, player.x, player.y);
  if (problem) return notice(game, sessionId, problem);
  for (const [otherId, other] of game.state.players) {
    if (otherId !== sessionId && other.stall && distance(other, player) < STALL_SPACING) {
      return notice(game, sessionId, "Burası başka bir tezgâha çok yakın");
    }
  }

  if (!Array.isArray(rawItems) || rawItems.length === 0) return notice(game, sessionId, "Satmak için en az bir item koy");
  if (rawItems.length > STALL_SLOTS) return notice(game, sessionId, `En fazla ${STALL_SLOTS} item koyabilirsin`);
  const listings = new Map<string, number>();
  for (const raw of rawItems as Partial<StallListingInput>[]) {
    const uid = typeof raw?.uid === "string" ? raw.uid : "";
    const price = Number(raw?.price);
    const stack = inv.slots.find((s) => s?.uid === uid);
    if (!uid || listings.has(uid) || !stack) return notice(game, sessionId, "Item envanterinde değil");
    if (ITEMS[stack.defId]?.questItem) return notice(game, sessionId, "Görev eşyası satılamaz");
    if (!Number.isSafeInteger(price) || price < 1 || price > STALL_MAX_PRICE) {
      return notice(game, sessionId, `Fiyat 1 ile ${STALL_MAX_PRICE.toLocaleString("tr-TR")} arasında olmalı`);
    }
    listings.set(uid, price);
  }

  runtime.stall = { title: cleanTitle(rawTitle, `${player.name}'in Tezgâhı`), listings, browsers: new Set() };
  player.stall = runtime.stall.title;
  player.moving = false;
  runtime.targetId = null;
  runtime.attacking = false;
  notice(game, sessionId, "Pazar açıldı. Kapatana kadar yerinden kalkamazsın.", GOLD_COLOR);
  sendMyStall(game, sessionId);
}

export function closeStall(game: Game, sessionId: string, reason?: string) {
  const c = ctx(game, sessionId);
  // Whatever stall we were browsing forgets us.
  if (c?.runtime.browsing) {
    game.playerRuntime.get(c.runtime.browsing)?.stall?.browsers.delete(sessionId);
    c.runtime.browsing = null;
  }
  const stall = c?.runtime.stall;
  if (!c || !stall) return;
  for (const browser of stall.browsers) {
    const runtime = game.playerRuntime.get(browser);
    if (runtime?.browsing === sessionId) runtime.browsing = null;
    game.io.send(browser, Msg.StallClosed, { sellerId: sessionId } satisfies StallClosedEvent);
  }
  c.runtime.stall = null;
  c.player.stall = "";
  if (reason) notice(game, sessionId, reason, GOLD_COLOR);
  sendMyStall(game, sessionId);
}

/** Opens a stall's window: sends its contents and keeps us updated while we look. */
export function browseStall(game: Game, sessionId: string, sellerId: string) {
  const buyer = ctx(game, sessionId);
  const seller = ctx(game, sellerId);
  if (!buyer || sellerId === sessionId) return;
  if (!seller?.runtime.stall) return notice(game, sessionId, "Bu tezgâh kapandı");
  if (distance(buyer.player, seller.player) > STALL_RANGE) return notice(game, sessionId, "Tezgâha çok uzaksın");
  if (buyer.runtime.browsing && buyer.runtime.browsing !== sellerId) {
    game.playerRuntime.get(buyer.runtime.browsing)?.stall?.browsers.delete(sessionId);
  }
  buyer.runtime.browsing = sellerId;
  seller.runtime.stall.browsers.add(sessionId);
  game.io.send(sessionId, Msg.StallContents, contentsOf(game, sellerId));
}

export function buyFromStall(game: Game, sessionId: string, sellerId: string, uid: string, rawQty: unknown, expectedPrice: unknown) {
  const buyer = ctx(game, sessionId);
  const seller = ctx(game, sellerId);
  if (!buyer || sellerId === sessionId || buyer.player.dead) return;
  if (buyer.runtime.stall) return notice(game, sessionId, "Kendi pazarın açıkken alışveriş yapamazsın");
  const stall = seller?.runtime.stall;
  if (!seller || !stall) return notice(game, sessionId, "Bu tezgâh kapandı");
  if (distance(buyer.player, seller.player) > STALL_RANGE) return notice(game, sessionId, "Tezgâha çok uzaksın");

  const price = stall.listings.get(uid);
  const index = seller.inv.slots.findIndex((s) => s?.uid === uid);
  const stack = seller.inv.slots[index];
  if (price === undefined || !stack) {
    stallChanged(game, sellerId);
    return notice(game, sessionId, "Bu item artık satışta değil");
  }
  if (price !== expectedPrice) {
    stallChanged(game, sellerId);
    return notice(game, sessionId, "Fiyat değişmiş, tekrar bak");
  }
  const qty = Math.floor(Number(rawQty));
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > stack.qty) return notice(game, sessionId, "Geçersiz adet");
  const total = price * qty;
  if (buyer.inv.gold < total) return notice(game, sessionId, "Yeterli altının yok");
  if (seller.inv.gold + total > MAX_GOLD) return notice(game, sessionId, "Satıcının kesesi dolu");

  const def = ITEMS[stack.defId];
  if (def.maxStack > 1) {
    if (!hasSpaceFor(buyer.inv, stack.defId, qty)) return notice(game, sessionId, "Envanter dolu");
    addItem(buyer.inv, stack.defId, qty, stack.enhance);
    removeAt(seller.inv, index, qty);
  } else {
    // Single items change hands as the same instance (uid, +N and all).
    const free = buyer.inv.slots.indexOf(null);
    if (free === -1) return notice(game, sessionId, "Envanter dolu");
    seller.inv.slots[index] = null;
    buyer.inv.slots[free] = stack;
  }
  buyer.inv.gold -= total;
  seller.inv.gold += total;

  const label = `${def.name}${stack.enhance ? ` +${stack.enhance}` : ""}${qty > 1 ? ` x${qty}` : ""}`;
  notice(game, sessionId, `${label} alındı (-${total.toLocaleString("tr-TR")} altın)`, RARITY_COLORS[itemRarity(def, stack.affixes)]);
  notice(game, sellerId, `${label} satıldı (+${total.toLocaleString("tr-TR")} altın)`, GOLD_COLOR);
  // Sellers often step away from the keyboard: leave a line in their chat too.
  const line: ChatEvent = {
    channel: "system",
    text: `Pazar: ${buyer.player.name} senden ${label} aldı (+${total.toLocaleString("tr-TR")} altın)`,
  };
  game.io.send(sellerId, Msg.ChatMessage, line);
  sendInventory(game, sessionId);
  sendInventory(game, sellerId);

  if (listingsOf(game, sellerId).length === 0) closeStall(game, sellerId, "Tezgâhındaki her şey satıldı, pazar kapandı");
  else stallChanged(game, sellerId);
  game.io.persist([sessionId, sellerId]);
}

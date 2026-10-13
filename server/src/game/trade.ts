import {
  distance,
  ITEMS,
  MAX_GOLD,
  Msg,
  TRADE_INVITE_MS,
  TRADE_MAX_DISTANCE,
  TRADE_RANGE,
  TRADE_SLOTS,
  type ChatEvent,
  type ItemView,
  type TradeInviteEvent,
  type TradeSideView,
  type TradeStateEvent,
} from "../../../shared/src";
import type { Game } from "./Game";
import { placeStack, type ItemStack } from "./inventory";
import { notice, sendInventory } from "./items";

// Player to player trade (takas), Knight Online style. One player asks, the other accepts,
// and both get a trade window. Each side puts items (whole stacks) and gold on the table,
// then locks their offer; once both are locked each confirms, and the swap happens here in
// one step and is saved for both characters in one transaction. While a trade is open
// neither inventory can change, so what was offered is what changes hands; it is all
// checked again at the swap anyway.

export interface TradeOffer {
  /** Inventory item uids. */
  items: string[];
  gold: number;
  locked: boolean;
  confirmed: boolean;
}

/** Shared by both traders' runtimes. */
export interface TradeSession {
  id: string;
  sides: Map<string, TradeOffer>;
}

export interface TradeInvite {
  /** Asker's session id. */
  from: string;
  expiresAt: number;
}

const TRADE_COLOR = "#ffd34d";

function system(game: Game, sessionId: string, text: string) {
  game.io.send(sessionId, Msg.ChatMessage, { channel: "system", text } satisfies ChatEvent);
}

function context(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  return player && runtime ? { player, runtime, inv: runtime.inventory } : null;
}

function partnerOf(session: TradeSession, sessionId: string): string {
  return [...session.sides.keys()].find((id) => id !== sessionId)!;
}

function sessionByName(game: Game, name: string): string | undefined {
  const wanted = name.toLocaleLowerCase("tr-TR");
  for (const [id, player] of game.state.players) if (player.name.toLocaleLowerCase("tr-TR") === wanted) return id;
  return undefined;
}

/** Blocks inventory actions while a trade is open. Returns true if blocked. */
export function tradeLocked(game: Game, sessionId: string): boolean {
  if (!game.playerRuntime.get(sessionId)?.trade) return false;
  notice(game, sessionId, "Takas sürerken envanterini değiştiremezsin");
  return true;
}

function sideView(game: Game, ownerId: string, offer: TradeOffer): TradeSideView {
  const slots = game.playerRuntime.get(ownerId)?.inventory.slots ?? [];
  const items: ItemView[] = offer.items.flatMap((uid) => {
    const stack = slots.find((s) => s?.uid === uid);
    return stack ? [{ ...stack }] : [];
  });
  return { items, gold: offer.gold, locked: offer.locked, confirmed: offer.confirmed };
}

function sendState(game: Game, session: TradeSession) {
  for (const [id, offer] of session.sides) {
    const partnerId = partnerOf(session, id);
    const event: TradeStateEvent = {
      trade: {
        partner: game.state.players.get(partnerId)?.name ?? "?",
        partnerId,
        mine: sideView(game, id, offer),
        theirs: sideView(game, partnerId, session.sides.get(partnerId)!),
      },
    };
    game.io.send(id, Msg.TradeState, event);
  }
}

/** Ends the trade for both sides without swapping anything. */
export function cancelTrade(game: Game, sessionId: string, reason?: string) {
  const session = game.playerRuntime.get(sessionId)?.trade;
  if (!session) return;
  for (const id of session.sides.keys()) {
    const runtime = game.playerRuntime.get(id);
    if (runtime?.trade === session) runtime.trade = null;
    game.io.send(id, Msg.TradeState, { trade: null } satisfies TradeStateEvent);
    if (reason) notice(game, id, reason, TRADE_COLOR);
  }
}

/** /takas Name: asks a nearby player to trade. */
export function requestTrade(game: Game, sessionId: string, targetName: string) {
  const me = context(game, sessionId);
  if (!me) return;
  const targetId = sessionByName(game, targetName);
  const target = targetId ? context(game, targetId) : null;
  if (!targetId || !target) return system(game, sessionId, `${targetName} yakınında değil.`);
  if (targetId === sessionId) return system(game, sessionId, "Kendinle takas yapamazsın.");
  if (me.runtime.trade) return system(game, sessionId, "Zaten bir takastasın.");
  if (target.runtime.trade) return system(game, sessionId, `${target.player.name} şu an başka biriyle takas yapıyor.`);
  if (me.player.dead || target.player.dead) return system(game, sessionId, "Ölüyken takas olmaz.");
  if (me.runtime.stall || target.runtime.stall) return system(game, sessionId, "Pazar tezgâhı açıkken takas olmaz.");
  if (distance(me.player, target.player) > TRADE_RANGE) return system(game, sessionId, `Takas için ${target.player.name} yanına yaklaş.`);

  target.runtime.tradeInvite = { from: sessionId, expiresAt: game.now() + TRADE_INVITE_MS };
  game.io.send(targetId, Msg.TradeInvite, { from: me.player.name } satisfies TradeInviteEvent);
  system(game, sessionId, `${target.player.name} takasa davet edildi.`);
}

export function respondTrade(game: Game, sessionId: string, accept: boolean) {
  const me = context(game, sessionId);
  if (!me) return;
  const pending = me.runtime.tradeInvite;
  me.runtime.tradeInvite = null;
  if (!pending || pending.expiresAt < game.now()) return system(game, sessionId, "Takas davetinin süresi doldu.");
  const asker = context(game, pending.from);
  if (!asker) return system(game, sessionId, "Seni davet eden artık burada değil.");
  if (!accept) return system(game, pending.from, `${me.player.name} takası reddetti.`);
  if (me.runtime.trade || asker.runtime.trade) return system(game, sessionId, "Biriniz zaten bir takasta.");
  if (me.player.dead || asker.player.dead) return system(game, sessionId, "Ölüyken takas olmaz.");
  if (me.runtime.stall || asker.runtime.stall) return system(game, sessionId, "Pazar tezgâhı açıkken takas olmaz.");
  if (distance(me.player, asker.player) > TRADE_MAX_DISTANCE) return system(game, sessionId, `${asker.player.name} çok uzaklaştı.`);

  const empty = (): TradeOffer => ({ items: [], gold: 0, locked: false, confirmed: false });
  const session: TradeSession = {
    id: game.newId("trade"),
    sides: new Map([
      [pending.from, empty()],
      [sessionId, empty()],
    ]),
  };
  me.runtime.trade = session;
  asker.runtime.trade = session;
  sendState(game, session);
}

/** Replaces our whole offer (items by uid, and gold). Only before we lock it. */
export function setOffer(game: Game, sessionId: string, rawItems: unknown, rawGold: unknown) {
  const me = context(game, sessionId);
  const session = me?.runtime.trade;
  if (!me || !session) return;
  const offer = session.sides.get(sessionId)!;
  if (offer.locked) return notice(game, sessionId, "Teklifini kilitledin, artık değiştiremezsin");
  if (!Array.isArray(rawItems) || rawItems.length > TRADE_SLOTS) return notice(game, sessionId, `En fazla ${TRADE_SLOTS} item koyabilirsin`);
  const items: string[] = [];
  for (const uid of rawItems) {
    const stack = typeof uid === "string" ? me.inv.slots.find((s) => s?.uid === uid) : undefined;
    if (!stack || items.includes(stack.uid)) return notice(game, sessionId, "Item envanterinde değil");
    if (ITEMS[stack.defId]?.questItem) return notice(game, sessionId, "Görev eşyası takas edilemez");
    items.push(stack.uid);
  }
  const gold = Number(rawGold);
  if (!Number.isSafeInteger(gold) || gold < 0) return notice(game, sessionId, "Geçersiz altın miktarı");
  if (gold > me.inv.gold) return notice(game, sessionId, "Kesende o kadar altın yok");
  offer.items = items;
  offer.gold = gold;
  sendState(game, session);
}

/** Freezes our offer. When both offers are frozen, each side can confirm. */
export function lockOffer(game: Game, sessionId: string) {
  const session = game.playerRuntime.get(sessionId)?.trade;
  if (!session) return;
  session.sides.get(sessionId)!.locked = true;
  sendState(game, session);
}

export function confirmTrade(game: Game, sessionId: string) {
  const session = game.playerRuntime.get(sessionId)?.trade;
  if (!session) return;
  if ([...session.sides.values()].some((offer) => !offer.locked)) return notice(game, sessionId, "Önce iki taraf da teklifini kilitlemeli");
  session.sides.get(sessionId)!.confirmed = true;
  if ([...session.sides.values()].every((offer) => offer.confirmed)) completeTrade(game, session);
  else sendState(game, session);
}

/** Both confirmed: check everything again and swap. */
function completeTrade(game: Game, session: TradeSession) {
  const [aId, bId] = [...session.sides.keys()];
  const a = context(game, aId);
  const b = context(game, bId);
  if (!a || !b) return cancelTrade(game, aId, "Takas iptal edildi");
  const offerA = session.sides.get(aId)!;
  const offerB = session.sides.get(bId)!;

  // What each side gives, still in their bags.
  const given = (inv: typeof a.inv, offer: TradeOffer) => {
    const indexes = offer.items.map((uid) => inv.slots.findIndex((s) => s?.uid === uid));
    return indexes.includes(-1) ? null : indexes;
  };
  const indexesA = given(a.inv, offerA);
  const indexesB = given(b.inv, offerB);
  if (!indexesA || !indexesB) return cancelTrade(game, aId, "Takas iptal: teklif edilen bir item artık yok");
  if (offerA.gold > a.inv.gold || offerB.gold > b.inv.gold) return cancelTrade(game, aId, "Takas iptal: teklif edilen altın yok");
  if (a.inv.gold - offerA.gold + offerB.gold > MAX_GOLD || b.inv.gold - offerB.gold + offerA.gold > MAX_GOLD) {
    return cancelTrade(game, aId, "Takas iptal: kese altın sınırını aşıyor");
  }

  // Try it on copies first, so a full bag leaves both sides untouched.
  const after = (slots: (ItemStack | null)[], giving: number[], receiving: ItemStack[]) => {
    const copy = slots.map((s, i) => (giving.includes(i) || !s ? null : { ...s }));
    return receiving.every((stack) => placeStack(copy, { ...stack })) ? copy : null;
  };
  const stacksA = indexesA.map((i) => a.inv.slots[i]!);
  const stacksB = indexesB.map((i) => b.inv.slots[i]!);
  const slotsA = after(a.inv.slots, indexesA, stacksB);
  const slotsB = after(b.inv.slots, indexesB, stacksA);
  if (!slotsA || !slotsB) {
    const full = !slotsA ? a.player.name : b.player.name;
    return cancelTrade(game, aId, `Takas iptal: ${full} adlı oyuncunun envanterinde yer yok`);
  }

  slotsA.forEach((s, i) => (a.inv.slots[i] = s));
  slotsB.forEach((s, i) => (b.inv.slots[i] = s));
  a.inv.gold += offerB.gold - offerA.gold;
  b.inv.gold += offerA.gold - offerB.gold;

  const describe = (stacks: ItemStack[], gold: number) => {
    const parts = stacks.map((s) => `${ITEMS[s.defId].name}${s.enhance ? ` +${s.enhance}` : ""}${s.qty > 1 ? ` x${s.qty}` : ""}`);
    if (gold > 0) parts.push(`${gold.toLocaleString("tr-TR")} altın`);
    return parts.length > 0 ? parts.join(", ") : "hiçbir şey";
  };
  system(game, aId, `Takas tamamlandı. ${b.player.name} sana verdi: ${describe(stacksB, offerB.gold)}.`);
  system(game, bId, `Takas tamamlandı. ${a.player.name} sana verdi: ${describe(stacksA, offerA.gold)}.`);
  cancelTrade(game, aId, "Takas tamamlandı");
  sendInventory(game, aId);
  sendInventory(game, bId);
  game.io.persist([aId, bId]);
}

/** Per tick: traders who die or walk apart call the trade off; old invites expire. */
export function updateTrades(game: Game) {
  for (const [sessionId, runtime] of game.playerRuntime) {
    if (runtime.tradeInvite && runtime.tradeInvite.expiresAt < game.now()) runtime.tradeInvite = null;
    const session = runtime.trade;
    if (!session) continue;
    const partnerId = partnerOf(session, sessionId);
    const player = game.state.players.get(sessionId);
    const partner = game.state.players.get(partnerId);
    if (!player || !partner) cancelTrade(game, sessionId, "Takas iptal edildi: karşı taraf ayrıldı");
    else if (player.dead || partner.dead) cancelTrade(game, sessionId, "Takas iptal edildi");
    else if (distance(player, partner) > TRADE_MAX_DISTANCE) cancelTrade(game, sessionId, "Takas iptal edildi: birbirinizden çok uzaklaştınız");
  }
}

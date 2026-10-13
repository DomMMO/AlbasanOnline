import {
  distance,
  encodeHorseLook,
  HORSE_BREEDS,
  HORSE_STYLE_PRICE,
  horseLookOf,
  isHorseLook,
  Msg,
  NPC_RANGE,
  NPCS,
  type ChatEvent,
  type HorseStateEvent,
} from "../../../shared/src";
import type { Game } from "./Game";
import { notice, sendInventory } from "./items";

// The horse farm: Seyis Yusuf sells breeds, swaps the horse you ride, and restyles it.
// Prices and colours are in shared/src/data/horses.ts; every step is checked here.

const STABLE_COLOR = "#e0b070";

export function sendHorseState(game: Game, sessionId: string) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime) return;
  game.io.send(sessionId, Msg.HorseState, { ...runtime.horse } satisfies HorseStateEvent);
}

/** The synced fields everyone else draws the horse from. */
export function syncHorse(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime) return;
  player.horse = runtime.horse.active;
  player.horseLook = encodeHorseLook(horseLookOf(runtime.horse));
}

/** The stable master must be in this zone and within talking range. */
function atStable(game: Game, sessionId: string, npcId: unknown): boolean {
  const player = game.state.players.get(sessionId);
  const npc = typeof npcId === "string" ? NPCS[npcId] : undefined;
  if (!player || player.dead || !npc || npc.role !== "stable" || !game.zone.npcs.includes(npc.id)) return false;
  if (distance(player, npc) > NPC_RANGE + 8) {
    notice(game, sessionId, "Çok uzak");
    return false;
  }
  return true;
}

function changed(game: Game, sessionId: string, line: string) {
  syncHorse(game, sessionId);
  sendHorseState(game, sessionId);
  sendInventory(game, sessionId);
  notice(game, sessionId, line, STABLE_COLOR);
  game.io.send(sessionId, Msg.ChatMessage, { channel: "system", text: line } satisfies ChatEvent);
  game.io.persist([sessionId]);
}

export function buyHorse(game: Game, sessionId: string, npcId: unknown, breedId: unknown) {
  const runtime = game.playerRuntime.get(sessionId);
  const breed = typeof breedId === "string" ? HORSE_BREEDS[breedId] : undefined;
  if (!runtime || !breed || !atStable(game, sessionId, npcId)) return;
  if (runtime.horse.owned.includes(breed.id)) return notice(game, sessionId, `${breed.name} zaten senin`);
  const inv = runtime.inventory;
  if (inv.gold < breed.price) return notice(game, sessionId, `${breed.price.toLocaleString("tr-TR")} altın gerekli`);
  inv.gold -= breed.price;
  runtime.horse = { ...runtime.horse, owned: [...runtime.horse.owned, breed.id], active: breed.id };
  changed(game, sessionId, `${breed.name} artık senin! Seyis Yusuf eyerini vurdu; H ile binebilirsin.`);
}

export function selectHorse(game: Game, sessionId: string, npcId: unknown, breedId: unknown) {
  const runtime = game.playerRuntime.get(sessionId);
  const player = game.state.players.get(sessionId);
  if (!runtime || !player || typeof breedId !== "string" || !atStable(game, sessionId, npcId)) return;
  if (!runtime.horse.owned.includes(breedId) || runtime.horse.active === breedId) return;
  runtime.horse = { ...runtime.horse, active: breedId };
  changed(game, sessionId, `Artık ${HORSE_BREEDS[breedId].name} ile yoldasın.`);
}

/** Restyle the horse you ride (all four colours at once). */
export function styleHorse(game: Game, sessionId: string, npcId: unknown, look: unknown) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime || !isHorseLook(look) || !atStable(game, sessionId, npcId)) return;
  const inv = runtime.inventory;
  if (inv.gold < HORSE_STYLE_PRICE) return notice(game, sessionId, `${HORSE_STYLE_PRICE.toLocaleString("tr-TR")} altın gerekli`);
  const { coat, mane, blanket, saddle } = look;
  inv.gold -= HORSE_STYLE_PRICE;
  runtime.horse = { ...runtime.horse, looks: { ...runtime.horse.looks, [runtime.horse.active]: { coat, mane, blanket, saddle } } };
  changed(game, sessionId, `${HORSE_BREEDS[runtime.horse.active].name} baştan aşağı yenilendi. Seyis Yusuf gururla sırtını sıvazladı.`);
}

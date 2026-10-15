import {
  castSpot,
  Direction,
  FISHING_MAX_MS,
  FISHING_MIN_MS,
  ITEMS,
  Msg,
  RARITY_COLORS,
  rollCatch,
  type FishCatchEvent,
} from "../../../shared/src";
import { broadcastSystem } from "./chat";
import type { Game } from "./Game";
import { addItem, hasSpaceFor, hasTool } from "./inventory";
import { notice, sendInventory } from "./items";
import { dismount } from "./mount";

// Fishing (see shared/src/data/fishing.ts). Casting checks the zone, the rod and the water;
// after that a catch arrives on a timer until the player moves, dies, opens a trade or a
// stall, runs out of bag space or loses the rod. Nothing else is needed, so it can run AFK.

export interface FishingState {
  nextCatchAt: number;
}

const INFO_COLOR = "#74c0fc";

const FACING: Record<Direction, { dx: number; dy: number }> = {
  [Direction.Down]: { dx: 0, dy: 1 },
  [Direction.Up]: { dx: 0, dy: -1 },
  [Direction.Left]: { dx: -1, dy: 0 },
  [Direction.Right]: { dx: 1, dy: 0 },
};

const hasRod = (game: Game, sessionId: string) => {
  const inv = game.playerRuntime.get(sessionId)?.inventory;
  return !!inv && hasTool(inv, "rod");
};

const nextDelay = (game: Game) => FISHING_MIN_MS + game.random() * (FISHING_MAX_MS - FISHING_MIN_MS);

export function stopFishing(game: Game, sessionId: string, reason?: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime?.fishing) return;
  runtime.fishing = null;
  player.fishing = false;
  if (reason) notice(game, sessionId, reason, INFO_COLOR);
}

/** "Balık Tut" (or right-click on the rod): casts, or reels in when already fishing. */
export function toggleFishing(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime) return;
  if (runtime.fishing) return stopFishing(game, sessionId, "Oltayı topladın");
  if (!game.zone.fishing) return notice(game, sessionId, "Balık ancak Liman'da tutulur");
  if (player.dead) return;
  if (!hasRod(game, sessionId)) return notice(game, sessionId, "Oltan yok. Balıkçı Rıfat'tan alabilirsin");
  if (runtime.stall || runtime.trade) return notice(game, sessionId, "Şu an balık tutamazsın");
  const spot = castSpot(game.map, player.x, player.y, FACING[player.dir as Direction]);
  if (!spot) return notice(game, sessionId, "Balık tutmak için suyun kenarına ya da iskeleye git");

  dismount(game, sessionId);
  runtime.fishing = { nextCatchAt: game.now() + nextDelay(game) };
  runtime.targetId = null;
  runtime.attacking = false;
  player.fishing = true;
  player.fishX = spot.x;
  player.fishY = spot.y;
  // Face the water.
  const dx = spot.x - player.x;
  const dy = spot.y - (player.y - 8);
  player.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? Direction.Right : Direction.Left) : dy > 0 ? Direction.Down : Direction.Up;
  notice(game, sessionId, "Oltayı attın. Yürüyene kadar balık tutmaya devam edersin.", INFO_COLOR);
}

/** Per tick: catches for everyone fishing, and the things that stop them. */
export function updateFishing(game: Game) {
  const now = game.now();
  for (const [sessionId, runtime] of game.playerRuntime) {
    const fishing = runtime.fishing;
    if (!fishing) continue;
    const player = game.state.players.get(sessionId);
    if (!player || player.dead) {
      stopFishing(game, sessionId);
      continue;
    }
    if (runtime.stall || runtime.trade) {
      stopFishing(game, sessionId, "Oltayı topladın");
      continue;
    }
    if (now < fishing.nextCatchAt) continue;
    if (!hasRod(game, sessionId)) {
      stopFishing(game, sessionId, "Oltan kalmadı");
      continue;
    }

    const caught = rollCatch(game.random);
    const def = ITEMS[caught.item];
    if (!def || !hasSpaceFor(runtime.inventory, caught.item, 1)) {
      stopFishing(game, sessionId, "Envanterin dolu, oltayı topladın");
      continue;
    }
    addItem(runtime.inventory, caught.item, 1);
    fishing.nextCatchAt = now + nextDelay(game);
    sendInventory(game, sessionId);
    notice(game, sessionId, `Balık tuttun: ${def.name}`, RARITY_COLORS[def.rarity]);
    game.io.broadcast(Msg.FishCatch, { sessionId, item: caught.item } satisfies FishCatchEvent);
    if (caught.announce) broadcastSystem(`${player.name} Liman'da oltasıyla ${def.name} çıkardı!`);
  }
}

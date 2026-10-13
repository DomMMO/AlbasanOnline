import { benchSeats, Direction, distance, HOME_ZONE, TILE_SIZE, TOWN_BENCHES } from "../../../shared/src";
import type { Game } from "./Game";
import { notice } from "./items";
import { dismount } from "./mount";

// Sitting on the benches round the fountain: click one and your character sits on its
// nearest free seat, facing the fountain. Walking (or getting on the horse) gets you up.

/** How close you must be to a seat to sit on it. */
const SIT_RANGE = TILE_SIZE * 2.5;

export function sitOnBench(game: Game, sessionId: string, benchId: unknown) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const bench = game.zone.id === HOME_ZONE ? TOWN_BENCHES.find((b) => b.id === benchId) : undefined;
  if (!player || !runtime || !bench || player.dead || runtime.stall) return;
  // Seats someone else is already sitting on.
  const taken = (seat: { x: number; y: number }) =>
    [...game.state.players.entries()].some(([id, other]) => id !== sessionId && other.seated && distance(other, seat) < 2);
  const seat = benchSeats(bench)
    .filter((s) => !taken(s))
    .sort((a, b) => distance(player, a) - distance(player, b))[0];
  if (!seat) return notice(game, sessionId, "Bank dolu");
  if (distance(player, seat) > SIT_RANGE) return notice(game, sessionId, "Çok uzak");
  if (player.mounted) dismount(game, sessionId);
  player.x = seat.x;
  player.y = seat.y;
  player.dir = bench.facing === "up" ? Direction.Up : Direction.Down;
  player.moving = false;
  player.seated = true;
}

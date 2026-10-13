import { COMBAT_TIMEOUT_MS, MOUNT_COOLDOWN_MS } from "../../../shared/src";
import type { Game } from "./Game";
import { stopFishing } from "./fishing";
import { notice } from "./items";

// Horse riding. Anyone can call their horse in the open world (not in dungeons or the
// arena) when out of combat; riding is MOUNT_SPEED_MULTIPLIER faster (shared stepMovement,
// so the client predicts it exactly). Attacking, using a skill, fishing, opening a stall
// or dying gets you off; changing zones leaves the horse behind.

const INFO_COLOR = "#e0b070";

const canRideHere = (game: Game) => !game.zone.instanced && !game.zone.pvp;

export function dismount(game: Game, sessionId: string, reason?: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player?.mounted || !runtime) return;
  player.mounted = false;
  runtime.mountToggledAt = game.now();
  if (reason) notice(game, sessionId, reason, INFO_COLOR);
}

/** The horse button (H): get on, or off. */
export function toggleMount(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime || player.dead) return;
  if (game.now() - runtime.mountToggledAt < MOUNT_COOLDOWN_MS) return;
  if (player.mounted) return dismount(game, sessionId);
  if (!canRideHere(game)) return notice(game, sessionId, game.zone.pvp ? "Arenada ata binilmez" : "Zindanda ata binilmez");
  if (game.now() - runtime.lastCombatAt < COMBAT_TIMEOUT_MS) return notice(game, sessionId, "Savaşırken ata binemezsin");
  if (runtime.stall) return notice(game, sessionId, "Pazar açıkken ata binemezsin");
  if (runtime.casting) return notice(game, sessionId, "Büyü yaparken ata binemezsin");
  stopFishing(game, sessionId, "Oltayı topladın");
  player.seated = false;
  player.mounted = true;
  runtime.mountToggledAt = game.now();
}

/** Per tick: riders who died or got into a fight come off the horse. */
export function updateMounts(game: Game) {
  for (const [sessionId, player] of game.state.players) {
    if (!player.mounted) continue;
    const runtime = game.playerRuntime.get(sessionId);
    if (player.dead || !runtime) dismount(game, sessionId);
    else if (runtime.stall) dismount(game, sessionId);
  }
}

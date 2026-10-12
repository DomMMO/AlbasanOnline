import { Msg, PVP_REPEAT_KILL_MS, type PvpKillEvent } from "../../../shared/src";
import { broadcastSystem } from "./chat";
import type { Game } from "./Game";

// PvP bookkeeping: kill/death counts, an Elo-style rating, kill streaks.

const ELO_K = 32;
const STREAK_ANNOUNCE_EVERY = 5;

/** Rating the killer gains (and the victim loses). Beating a stronger player pays more. */
export function eloGain(killerRating: number, victimRating: number): number {
  const expected = 1 / (1 + 10 ** ((victimRating - killerRating) / 400));
  return Math.max(1, Math.round(ELO_K * (1 - expected)));
}

export function recordPvpKill(game: Game, killerId: string, victimId: string) {
  const killer = game.state.players.get(killerId);
  const victim = game.state.players.get(victimId);
  const killerRuntime = game.playerRuntime.get(killerId);
  const victimRuntime = game.playerRuntime.get(victimId);
  if (!killer || !victim || !killerRuntime || !victimRuntime || killerId === victimId) return;

  const now = Date.now();
  const lastKill = killerRuntime.recentKills.get(victimRuntime.characterId) ?? 0;
  const repeat = now - lastKill < PVP_REPEAT_KILL_MS;
  const gain = repeat ? 0 : eloGain(killer.pvpRating, victim.pvpRating);
  killerRuntime.recentKills.set(victimRuntime.characterId, now);

  killer.pvpRating += gain;
  victim.pvpRating = Math.max(0, victim.pvpRating - gain);
  killer.pvpKills++;
  victim.pvpDeaths++;
  killerRuntime.killStreak++;
  victimRuntime.killStreak = 0;

  game.io.broadcast(Msg.PvpKill, {
    killer: killer.name,
    victim: victim.name,
    killerClass: killer.cls,
    victimClass: victim.cls,
    ratingGain: gain,
    streak: killerRuntime.killStreak,
  } satisfies PvpKillEvent);
  if (killerRuntime.killStreak % STREAK_ANNOUNCE_EVERY === 0) {
    broadcastSystem(`${killer.name} Kan Arenası'nda durdurulamıyor! (${killerRuntime.killStreak} seri öldürme)`);
  }
  console.log(`[pvp] ${killer.name} killed ${victim.name} (+${gain}, streak ${killerRuntime.killStreak})`);
}

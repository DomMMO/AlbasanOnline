import { Msg, rankables, sanitizeRanks, skillPointsAt, spentPoints, type SkillRanksEvent } from "../../../shared/src";
import type { Game } from "./Game";
import { notice, refreshStats, sendInventory } from "./items";

// Skill points (Yetenekler page). Ranks are bought and taken back one at a time; the stats
// change at once. See shared/src/data/talents.ts for the rules.

export function sendSkillRanks(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime) return;
  game.io.send(sessionId, Msg.SkillRanks, {
    ranks: runtime.skillRanks,
    points: skillPointsAt(player.level) - spentPoints(runtime.skillRanks),
  } satisfies SkillRanksEvent);
}

function changed(game: Game, sessionId: string) {
  refreshStats(game, sessionId);
  sendInventory(game, sessionId);
  sendSkillRanks(game, sessionId);
}

export function changeRank(game: Game, sessionId: string, id: string, delta: number) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const entry = player ? rankables(player.cls).find((r) => r.id === id) : undefined;
  if (!player || !runtime || !entry || (delta !== 1 && delta !== -1)) return;
  const rank = runtime.skillRanks[id] ?? 0;
  if (delta === 1) {
    if (player.level < entry.level) return notice(game, sessionId, `Seviye ${entry.level} gerekli`);
    if (rank >= entry.max) return notice(game, sessionId, "En yüksek derecede");
    if (spentPoints(runtime.skillRanks) >= skillPointsAt(player.level)) return notice(game, sessionId, "Boş yetenek puanın yok");
    runtime.skillRanks = { ...runtime.skillRanks, [id]: rank + 1 };
  } else {
    if (rank <= 0) return;
    const ranks = { ...runtime.skillRanks, [id]: rank - 1 };
    if (ranks[id] === 0) delete ranks[id];
    runtime.skillRanks = ranks;
  }
  changed(game, sessionId);
}

/** After a level change (GM): drop ranks the new level doesn't allow. */
export function revalidateRanks(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime) return;
  runtime.skillRanks = sanitizeRanks(player.cls, player.level, runtime.skillRanks);
  changed(game, sessionId);
}

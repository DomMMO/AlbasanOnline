import {
  BAD_FORTUNES,
  distance,
  FORTUNE_GOOD_CHANCE,
  FORTUNE_UPGRADE_BONUS,
  fortuneDay,
  fortuneText,
  GOOD_FORTUNES,
  Msg,
  NPC_RANGE,
  NPCS,
  type FortuneEvent,
} from "../../../shared/src";
import type { Game, PlayerRuntime } from "./Game";
import { notice } from "./items";

// Ayşe Teyze's daily fortune (see shared/src/data/fortune.ts). Read once per calendar day;
// asking again the same day repeats it. Saved with the character, so relogging can't reroll it.

/** Today's upgrade bonus from a good fortune (0 otherwise). */
export function fortuneBonus(runtime: PlayerRuntime): number {
  return runtime.fortune?.day === fortuneDay() && runtime.fortune.good ? FORTUNE_UPGRADE_BONUS : 0;
}

export function readFortune(game: Game, sessionId: string, npcId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const npc = NPCS[npcId];
  if (!player || !runtime || !npc?.fortuneTeller || !game.zone.npcs.includes(npcId) || player.dead) return;
  if (distance(player, npc) > NPC_RANGE) return notice(game, sessionId, "Çok uzaktasın");
  const today = fortuneDay();
  if (runtime.fortune?.day !== today) {
    const good = game.random() < FORTUNE_GOOD_CHANCE;
    const lines = good ? GOOD_FORTUNES : BAD_FORTUNES;
    runtime.fortune = { day: today, good, line: Math.floor(game.random() * lines.length) };
  }
  game.io.send(sessionId, Msg.Fortune, {
    good: runtime.fortune.good,
    text: fortuneText(runtime.fortune),
    upgradeBonus: fortuneBonus(runtime),
  } satisfies FortuneEvent);
}

/** On join: tell the client about today's fortune (the upgrade window shows the bonus). */
export function sendFortuneState(game: Game, sessionId: string) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime?.fortune || runtime.fortune.day !== fortuneDay()) return;
  game.io.send(sessionId, Msg.Fortune, { good: runtime.fortune.good, upgradeBonus: fortuneBonus(runtime) } satisfies FortuneEvent);
}

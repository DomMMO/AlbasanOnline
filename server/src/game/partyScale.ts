import { PARTY_CAST_RATE_PER_PLAYER, PARTY_DROP_PER_PLAYER, PARTY_MOB_DAMAGE_PER_PLAYER } from "../../../shared/src";
import type { Game } from "./Game";

// Dungeon party scaling (DENGE.md, bölüm 6). `game.groupSize` only grows in instanced zones,
// so everywhere else these are all 1.

/** Mob health and XP: N times. */
export function groupHp(game: Game): number {
  return game.groupSize;
}

/** Mob plain hits. */
export function groupDamage(game: Game): number {
  return 1 + PARTY_MOB_DAMAGE_PER_PLAYER * (game.groupSize - 1);
}

/** Mob ability cooldowns are divided by this. */
export function groupCastRate(game: Game): number {
  return 1 + PARTY_CAST_RATE_PER_PLAYER * (game.groupSize - 1);
}

/** Drop chances. */
export function groupDrops(game: Game): number {
  return 1 + PARTY_DROP_PER_PLAYER * (game.groupSize - 1);
}

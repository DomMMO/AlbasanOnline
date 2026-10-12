import { classOf } from "./classes";
import { ITEMS } from "./items";
import { enhancedStats } from "./upgrade";

// Levelling and combat math. Shared so the client can display the same numbers the server uses.

export const MAX_LEVEL = 60;

export function xpToNextLevel(level: number): number {
  return Math.round(50 * Math.pow(level, 1.6));
}

export interface CombatStats {
  maxHp: number;
  attack: number;
  defense: number;
  attackSpeedMs: number;
}

/** Class base stats plus everything equipped. Weapons replace the swing timer. */
export function statsWithEquipment(classId: string, level: number, equipped: { defId: string; enhance: number }[]): CombatStats {
  const stats = classOf(classId).baseStats(level);
  for (const item of equipped) {
    const def = ITEMS[item.defId];
    if (!def) continue;
    const bonus = enhancedStats(def, item.enhance);
    stats.attack += bonus.attack ?? 0;
    stats.defense += bonus.defense ?? 0;
    stats.maxHp += bonus.maxHp ?? 0;
    if (def.attackSpeedMs) stats.attackSpeedMs = def.attackSpeedMs;
  }
  return stats;
}

/** Mana regenerates this fraction of max per second (faster out of combat). */
export const MANA_REGEN_IN_COMBAT = 0.015;
export const MANA_REGEN_OUT_OF_COMBAT = 0.05;

export const RAGE_MAX = 100;
export const RAGE_PER_SWING = 10;
export const RAGE_PER_HIT_TAKEN = 4;
export const RAGE_DECAY_PER_SECOND = 3;
/** Out of combat, health regenerates this fraction of max per second. */
export const REGEN_PER_SECOND = 0.04;

export const CRIT_CHANCE = 0.05;
export const CRIT_MULTIPLIER = 2;

export function rollDamage(attack: number, defense: number, random: () => number): { amount: number; crit: boolean } {
  const variance = 0.85 + random() * 0.3;
  const crit = random() < CRIT_CHANCE;
  let amount = Math.max(1, Math.round(attack * variance - defense * 0.5));
  if (crit) amount = Math.round(amount * CRIT_MULTIPLIER);
  return { amount, crit };
}

/** XP for a kill, scaled by level difference. Mobs 5+ levels below give nothing. */
export function xpForKill(baseXp: number, mobLevel: number, playerLevel: number): number {
  const diff = mobLevel - playerLevel;
  const multiplier = diff >= 0 ? 1 + 0.1 * Math.min(diff, 4) : Math.max(0, 1 + 0.2 * diff);
  return Math.floor(baseXp * multiplier);
}

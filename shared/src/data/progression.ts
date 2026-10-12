import { classOf } from "./classes";
import { ITEMS } from "./items";
import { enhancedStats } from "./upgrade";
import { sumAffixes, type Affix, type AttributeId } from "./affixes";

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
  /** 0..1 */
  critChance: number;
  /** Fraction of damage dealt healed back (0..1). */
  lifeSteal: number;
  /** Attributes from passive tree jewels. */
  attributes: Record<AttributeId, number>;
  /** Extra max mana (Zeka). */
  manaBonus: number;
  /** Skill id -> effect multiplier bonus (0.2 = 20% more). Includes Zeka's bonus to every skill under "*". */
  skillBonus: Record<string, number>;
  /** Special effects from the passive tree (fractions unless noted). */
  /** Minions up at once (1 + jewels). */
  minionCount: number;
  minionDamage: number;
  cooldownReduction: number;
  costReduction: number;
  damageReduction: number;
  /** Added to the crit multiplier (0.3 = crits do 2.3x instead of 2x). */
  critDamage: number;
  /** Health restored on a kill, as a fraction of max health. */
  killHeal: number;
  /** Health regenerated per second in combat, as a fraction of max health. */
  combatRegen: number;
  xpBonus: number;
}

/** Most extra minions the passive tree can give. */
export const MAX_EXTRA_MINIONS = 2;

/** How much a skill's damage / healing / shield is multiplied by. */
export function skillPower(stats: CombatStats, skillId: string): number {
  return 1 + (stats.skillBonus[skillId] ?? 0) + (stats.skillBonus["*"] ?? 0);
}

/**
 * Class base stats plus everything equipped and socketed: base stats, +N, then the
 * modifiers of equipment and passive tree jewels. Weapons replace the swing timer.
 */
export function statsWithEquipment(
  classId: string,
  level: number,
  equipped: { defId: string; enhance: number; affixes?: Affix[] }[],
  /** Modifiers that don't come from an item (skill and passive ranks). */
  extra: Affix[] = [],
): CombatStats {
  const stats: CombatStats = {
    ...classOf(classId).baseStats(level),
    critChance: CRIT_CHANCE,
    lifeSteal: 0,
    attributes: { str: 0, dex: 0, int: 0, vit: 0 },
    manaBonus: 0,
    skillBonus: {},
    minionCount: 1,
    minionDamage: 0,
    cooldownReduction: 0,
    costReduction: 0,
    damageReduction: 0,
    critDamage: 0,
    killHeal: 0,
    combatRegen: 0,
    xpBonus: 0,
  };
  const items = equipped.filter((item) => ITEMS[item.defId]);
  for (const item of items) {
    const def = ITEMS[item.defId];
    const bonus = enhancedStats(def, item.enhance);
    stats.attack += bonus.attack ?? 0;
    stats.defense += bonus.defense ?? 0;
    stats.maxHp += bonus.maxHp ?? 0;
    if (def.attackSpeedMs) stats.attackSpeedMs = def.attackSpeedMs;
  }
  const mods = sumAffixes([...items.map((item) => item.affixes), extra]);
  const { str, dex, int, vit } = mods;
  stats.attributes = { str, dex, int, vit };
  // Attributes (see ATTRIBUTE_HELP) count as flat bonuses, before the % modifiers.
  stats.attack = Math.round((stats.attack + mods.attack + str) * (1 + mods.attackPct / 100));
  stats.defense += mods.defense + Math.floor(vit * 0.5);
  stats.maxHp = Math.round((stats.maxHp + mods.maxHp + str * 2 + vit * 5) * (1 + mods.hpPct / 100));
  stats.attackSpeedMs = Math.round(stats.attackSpeedMs / (1 + (mods.attackSpeed + dex * 0.3) / 100));
  stats.critChance = Math.min(0.75, stats.critChance + (mods.critChance + dex * 0.2) / 100);
  stats.lifeSteal = Math.min(0.5, mods.lifeSteal / 100);
  stats.manaBonus = int * 4;
  for (const [skillId, pct] of Object.entries(mods.skills)) stats.skillBonus[skillId] = pct / 100;
  if (int > 0) stats.skillBonus["*"] = (int * 0.5) / 100;
  stats.minionCount = 1 + Math.min(MAX_EXTRA_MINIONS, mods.minionCount);
  stats.minionDamage = mods.minionDamage / 100;
  stats.cooldownReduction = Math.min(0.5, mods.cooldownReduction / 100);
  stats.costReduction = Math.min(0.6, mods.costReduction / 100);
  stats.damageReduction = Math.min(0.5, mods.damageReduction / 100);
  stats.critDamage = mods.critDamage / 100;
  stats.killHeal = Math.min(0.25, mods.killHeal / 100);
  stats.combatRegen = Math.min(0.03, mods.combatRegen / 1000);
  stats.xpBonus = mods.xpBonus / 100;
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

export function rollDamage(
  attack: number,
  defense: number,
  random: () => number,
  critChance = CRIT_CHANCE,
  critMultiplier = CRIT_MULTIPLIER,
): { amount: number; crit: boolean } {
  const variance = 0.85 + random() * 0.3;
  const crit = random() < critChance;
  let amount = Math.max(1, Math.round(attack * variance - defense * 0.5));
  if (crit) amount = Math.round(amount * critMultiplier);
  return { amount, crit };
}

/** XP for a kill, scaled by level difference. Mobs 5+ levels below give nothing. */
export function xpForKill(baseXp: number, mobLevel: number, playerLevel: number): number {
  const diff = mobLevel - playerLevel;
  const multiplier = diff >= 0 ? 1 + 0.1 * Math.min(diff, 4) : Math.max(0, 1 + 0.2 * diff);
  return Math.floor(baseXp * multiplier);
}

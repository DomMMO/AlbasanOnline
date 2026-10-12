import type { ItemDef, Rarity } from "./items";
import { SKILLS } from "./skills";

// Path of Exile-style random modifiers on equipment. Every weapon, armour piece and
// accessory rolls 1-5 of them when it is created; the number of modifiers is what makes
// an item good: 1 = the worst, 5 = the best. Rolling happens on the server only.
//
// Jewels for the passive tree (see passives.ts) use the same system with one modifier each:
// a major jewel has a big effect ("Girdap etkisi %20 artar"), a minor one an attribute (+5 Güç).

type EquipAffixId = "attack" | "defense" | "maxHp" | "attackPct" | "hpPct" | "critChance" | "attackSpeed" | "lifeSteal";
export type AttributeId = "str" | "dex" | "int" | "vit";
/** Bigger, build-shaping effects: mostly from greater jewels (Kadim Mücevher), some on major ones. */
export type SpecialAffixId =
  | "minionCount"
  | "minionDamage"
  | "cooldownReduction"
  | "costReduction"
  | "damageReduction"
  | "critDamage"
  | "killHeal"
  | "combatRegen"
  | "xpBonus";
/** `skill_<skillId>`: that skill does this much more damage (or healing / shielding). */
export type SkillAffixId = `skill_${string}`;
export type AffixId = EquipAffixId | AttributeId | SpecialAffixId | SkillAffixId;

export interface Affix {
  id: AffixId;
  value: number;
  /** Jewels only: rarity tier 0 (Sıradan) .. 4 (Efsanevi). Higher tiers roll higher values. */
  tier?: number;
}

export const MAX_AFFIXES = 5;

interface AffixDef {
  /** Tooltip line for a rolled value. */
  label: (value: number) => string;
  /** Value range for an item of this level. */
  range: (level: number) => [min: number, max: number];
}

const EQUIP_AFFIXES: Record<EquipAffixId, AffixDef> = {
  attack: { label: (v) => `+${v} Saldırı`, range: (l) => [1 + Math.floor(l * 0.6), 3 + Math.floor(l * 1.2)] },
  defense: { label: (v) => `+${v} Savunma`, range: (l) => [1 + Math.floor(l * 0.3), 2 + Math.floor(l * 0.6)] },
  maxHp: { label: (v) => `+${v} Can`, range: (l) => [5 + l * 3, 10 + l * 6] },
  attackPct: { label: (v) => `%${v} artırılmış Saldırı`, range: (l) => [3, 5 + Math.floor(l * 0.5)] },
  hpPct: { label: (v) => `%${v} artırılmış Can`, range: (l) => [3, 5 + Math.floor(l * 0.5)] },
  critChance: { label: (v) => `+%${v} Kritik Vuruş Şansı`, range: (l) => [1, 2 + Math.floor(l * 0.25)] },
  attackSpeed: { label: (v) => `%${v} daha hızlı Saldırı`, range: (l) => [2, 4 + Math.floor(l * 0.4)] },
  lifeSteal: { label: (v) => `Vurduğun hasarın %${v}'i kadar can çalar`, range: (l) => [1, 2 + Math.floor(l * 0.15)] },
};

export const ATTRIBUTE_IDS: AttributeId[] = ["str", "dex", "int", "vit"];
export const ATTRIBUTE_NAMES: Record<AttributeId, string> = { str: "Güç", dex: "Çeviklik", int: "Zeka", vit: "Dayanıklılık" };

/** What one point of each attribute gives (applied in statsWithEquipment). */
export const ATTRIBUTE_HELP: Record<AttributeId, string> = {
  str: "Her puan +1 Saldırı, +2 Can",
  dex: "Her puan +%0,2 Kritik, +%0,3 Saldırı Hızı",
  int: "Her puan +4 Mana, +%0,5 skill etkisi",
  vit: "Her puan +5 Can, +0,5 Savunma",
};

const minorRange = (l: number): [number, number] => [2 + Math.floor(l / 4), 5 + Math.floor(l / 2)];

const ATTRIBUTE_AFFIXES = Object.fromEntries(
  ATTRIBUTE_IDS.map((id) => [id, { label: (v: number) => `+${v} ${ATTRIBUTE_NAMES[id]}`, range: minorRange }]),
) as Record<AttributeId, AffixDef>;

const SKILL_AFFIXES: Record<SkillAffixId, AffixDef> = Object.fromEntries(
  Object.values(SKILLS).map((skill) => [
    `skill_${skill.id}`,
    { label: (v: number) => `${skill.name} etkisi %${v} artar`, range: (l: number) => [10, 20 + Math.floor(l / 2)] },
  ]),
);

const SPECIAL_AFFIXES: Record<SpecialAffixId, AffixDef> = {
  minionCount: { label: (v) => `+${v} İskelet: aynı anda ${v} iskelet daha çağırırsın`, range: () => [1, 1] },
  minionDamage: { label: (v) => `İskeletlerin %${v} daha fazla hasar verir`, range: (l) => [15, 30 + Math.floor(l / 2)] },
  cooldownReduction: { label: (v) => `Skill bekleme süreleri %${v} kısalır`, range: () => [5, 10] },
  costReduction: { label: (v) => `Skill'lerin öfke/mana bedeli %${v} azalır`, range: () => [8, 16] },
  damageReduction: { label: (v) => `Aldığın hasar %${v} azalır`, range: () => [4, 8] },
  critDamage: { label: (v) => `Kritik vuruşların %${v} daha fazla hasar verir`, range: () => [15, 30] },
  killHeal: { label: (v) => `Öldürdüğün her düşman canının %${v}'ini yeniler`, range: () => [2, 4] },
  /** Value is in tenths of a percent per second. */
  combatRegen: { label: (v) => `Savaşta her saniye canının %${(v / 10).toLocaleString("tr-TR")}'i yenilenir`, range: () => [5, 10] },
  xpBonus: { label: (v) => `%${v} daha fazla XP kazanırsın`, range: () => [5, 12] },
};

export const AFFIXES: Record<string, AffixDef> = { ...EQUIP_AFFIXES, ...ATTRIBUTE_AFFIXES, ...SPECIAL_AFFIXES, ...SKILL_AFFIXES };

const EQUIP_POOL = Object.keys(EQUIP_AFFIXES) as AffixId[];
const MINOR_JEWEL_POOL: AffixId[] = [...ATTRIBUTE_IDS];
/** Major jewels: a skill boost, or a general modifier rolled bigger than on equipment. */
const MAJOR_JEWEL_POOL: AffixId[] = [
  ...(Object.keys(SKILL_AFFIXES) as AffixId[]),
  "attackPct",
  "hpPct",
  "critChance",
  "attackSpeed",
  "lifeSteal",
  "minionDamage",
  "critDamage",
  "cooldownReduction",
  "xpBonus",
];
/** Greater jewels (Kadim Mücevher) for the greater sockets: the strong, specific effects. */
const GREATER_JEWEL_POOL = Object.keys(SPECIAL_AFFIXES) as AffixId[];
/** Equipment modifiers on a major jewel, and special effects on a greater one, roll this much higher. */
const MAJOR_JEWEL_SCALE = 2;

/** Chance weights for 1, 2, 3, 4 and 5 modifiers. */
const COUNT_WEIGHTS = [40, 28, 18, 10, 4];

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** Item rarity (name colour) by modifier count: 1 = Sıradan ... 5 = Efsanevi. */
const RARITY_BY_COUNT: Rarity[] = ["common", "common", "uncommon", "rare", "epic", "legendary"];

/** Sell price multiplier by modifier count. */
const VALUE_BY_COUNT = [1, 1, 1.5, 2.5, 4, 7];

export interface AffixRollOptions {
  /** Exact number of modifiers (1-5); otherwise rolled. Equipment only. */
  count?: number;
  /** > 1 makes more modifiers likelier (night mobs drop better items). */
  luck?: number;
  /** Item level for the value ranges (jewels: the level of the mob that dropped it). */
  level?: number;
}

/** Items that carry modifiers: equipment (1-5) and passive tree jewels (exactly 1). */
export function hasAffixes(def: ItemDef | undefined): boolean {
  return def?.slot !== undefined || def?.jewel !== undefined;
}

function rollCount(random: () => number, luck: number): number {
  const weights = COUNT_WEIGHTS.map((w, i) => w * Math.pow(luck, i));
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i + 1;
  }
  return weights.length;
}

function rollValue(id: AffixId, level: number, random: () => number, scale = 1): number {
  const [min, max] = AFFIXES[id].range(level);
  return Math.round((min + Math.floor(random() * (max - min + 1))) * scale);
}

/** Rolls the modifiers of a new item. Items that carry none get []. */
export function rollAffixes(def: ItemDef | undefined, random: () => number, options: AffixRollOptions = {}): Affix[] {
  if (!def || !hasAffixes(def)) return [];
  const level = Math.max(1, options.level ?? def.level);
  if (def.jewel) {
    // Rarity first (same odds as equipment modifier counts, luck included); it picks the
    // fifth of the value range the jewel rolls in, so a Legendary jewel is always a top roll.
    const tier = rollCount(random, options.luck ?? 1) - 1;
    const pool = def.jewel === "greater" ? GREATER_JEWEL_POOL : def.jewel === "major" ? MAJOR_JEWEL_POOL : MINOR_JEWEL_POOL;
    const id = pool[Math.floor(random() * pool.length)];
    const scaled = (def.jewel === "major" && id in EQUIP_AFFIXES) || (def.jewel === "greater" && id !== "minionCount");
    const scale = scaled ? MAJOR_JEWEL_SCALE : 1;
    const [min, max] = AFFIXES[id].range(level);
    const band = (max - min) / RARITY_ORDER.length;
    const value = Math.max(1, Math.round((min + band * tier + random() * band) * scale));
    return [{ id, value, tier }];
  }
  const count = options.count ? Math.max(1, Math.min(MAX_AFFIXES, Math.floor(options.count))) : rollCount(random, options.luck ?? 1);
  const pool = [...EQUIP_POOL];
  const affixes: Affix[] = [];
  for (let i = 0; i < count; i++) {
    const id = pool.splice(Math.floor(random() * pool.length), 1)[0];
    affixes.push({ id, value: rollValue(id, level, random) });
  }
  return affixes;
}

/** Drops anything malformed (stored data, client input). */
export function sanitizeAffixes(value: unknown): Affix[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((a): a is Affix => !!a && typeof a === "object" && typeof a.id === "string" && a.id in AFFIXES && Number.isFinite(a.value))
    .slice(0, MAX_AFFIXES)
    .map((a) => {
      const affix: Affix = { id: a.id, value: Math.round(a.value) };
      if (Number.isInteger(a.tier) && a.tier! >= 0 && a.tier! < RARITY_ORDER.length) affix.tier = a.tier;
      return affix;
    });
}

export function affixLabel(affix: Affix): string {
  return AFFIXES[affix.id]?.label(affix.value) ?? affix.id;
}

/** An equipment instance's rarity comes from its modifier count; everything else keeps its own. */
export function itemRarity(def: ItemDef, affixes?: Affix[]): Rarity {
  const tier = affixes?.[0]?.tier;
  if (def.jewel && tier !== undefined) return RARITY_ORDER[tier];
  if (!def.slot || !affixes?.length) return def.rarity;
  return RARITY_BY_COUNT[Math.min(affixes.length, MAX_AFFIXES)];
}

/** What a merchant pays for one of this instance. */
export function itemSellPrice(def: ItemDef, affixes?: Affix[]): number {
  const tier = affixes?.[0]?.tier;
  if (def.jewel && tier !== undefined) return Math.round(def.sellPrice * VALUE_BY_COUNT[tier + 1]);
  if (!def.slot) return def.sellPrice;
  return Math.round(def.sellPrice * VALUE_BY_COUNT[Math.min(affixes?.length ?? 0, MAX_AFFIXES)]);
}

export type AffixTotals = Record<EquipAffixId | AttributeId | SpecialAffixId, number> & {
  /** Skill id -> % more effect. */
  skills: Record<string, number>;
};

export function sumAffixes(lists: (Affix[] | undefined)[]): AffixTotals {
  const totals: AffixTotals = {
    attack: 0, defense: 0, maxHp: 0, attackPct: 0, hpPct: 0, critChance: 0, attackSpeed: 0, lifeSteal: 0,
    str: 0, dex: 0, int: 0, vit: 0,
    minionCount: 0, minionDamage: 0, cooldownReduction: 0, costReduction: 0, damageReduction: 0, critDamage: 0, killHeal: 0, combatRegen: 0, xpBonus: 0,
    skills: {},
  };
  for (const list of lists) {
    for (const affix of list ?? []) {
      if (affix.id.startsWith("skill_")) {
        const skillId = affix.id.slice("skill_".length);
        totals.skills[skillId] = (totals.skills[skillId] ?? 0) + affix.value;
      } else {
        totals[affix.id as EquipAffixId | AttributeId | SpecialAffixId] += affix.value;
      }
    }
  }
  return totals;
}

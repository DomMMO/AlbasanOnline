import type { Appearance } from "./appearance";
import { gearDrops } from "./loot";
import type { BossAbility, LootTable, MobDef } from "./mobs";

// The open-world mobs of the two zones off the Starting Valley: Kızıl Kanyon to the west
// (levels 20-30) and Ayaz Dağları to the east (levels 30-40), each with a field boss who
// comes back a few minutes after falling. Stats follow the same level curve as the big
// dungeons (dungeonMobs.ts), so a level 33 yeti is about as tough as a level 33 dungeon mob.

type Drop = LootTable["drops"][number];

const hpFor = (level: number) => Math.round(12 * level + 1.3 * level * level);
const xpFor = (level: number) => Math.round(0.6 * level * level + 6 * level);
const gearTier = (level: number) => Math.max(1, Math.min(10, Math.floor((level - 6) / 3)));

interface FieldSpec {
  id: string;
  name: string;
  level: number;
  appearance: Appearance;
  /** Multipliers on the level curve. */
  hp?: number;
  attack?: number;
  speed?: number;
  attackSpeedMs?: number;
  /** 0: leaves you alone until you hit it. */
  aggroRange?: number;
  nightOnly?: boolean;
  material: string;
  extraDrops?: Drop[];
}

function field(spec: FieldSpec): MobDef {
  const { level } = spec;
  const tier = gearTier(level);
  return {
    id: spec.id,
    name: spec.name,
    level,
    maxHp: Math.round(hpFor(level) * (spec.hp ?? 1)),
    attack: Math.round(3 * level * (spec.attack ?? 1)),
    defense: level,
    attackSpeedMs: spec.attackSpeedMs ?? 2100,
    speed: spec.speed ?? 58,
    xp: Math.round(xpFor(level) * (spec.hp ?? 1)),
    aggroRange: spec.aggroRange ?? 72,
    respawnMs: 25_000,
    nightOnly: spec.nightOnly,
    appearance: spec.appearance,
    loot: {
      gold: [level, level * 2],
      drops: [
        { item: spec.material, chance: 0.55, min: 1, max: 2 },
        { item: "super_hp_potion", chance: 0.06 },
        { item: "super_mana_potion", chance: 0.05 },
        { item: "upgrade_scroll_mid", chance: 0.06 },
        { item: "upgrade_scroll_high", chance: 0.01 },
        { item: "spirit_stone", chance: 0.012 },
        ...gearDrops(tier, 0.005),
        ...(spec.extraDrops ?? []),
      ],
    },
  };
}

interface FieldBossSpec {
  id: string;
  name: string;
  level: number;
  appearance: Appearance;
  scale: number;
  abilities: BossAbility[];
  addMob: string;
  material: string;
}

function fieldBoss(spec: FieldBossSpec): MobDef {
  const { level } = spec;
  const tier = gearTier(level);
  return {
    id: spec.id,
    name: spec.name,
    level,
    maxHp: Math.round(hpFor(level) * 14),
    attack: Math.round(3 * level * 1.3),
    defense: Math.round(level * 1.3),
    attackSpeedMs: 2300,
    speed: 60,
    xp: Math.round(xpFor(level) * 12),
    aggroRange: 96,
    respawnMs: 300_000,
    scale: spec.scale,
    appearance: spec.appearance,
    loot: {
      gold: [level * 15, level * 30],
      drops: [
        { item: spec.material, chance: 1, min: 3, max: 6 },
        { item: "upgrade_scroll_mid", chance: 1, min: 2, max: 4 },
        { item: "upgrade_scroll_high", chance: 0.5 },
        { item: "protection_charm", chance: 0.25 },
        { item: "spirit_stone", chance: 0.6, min: 1, max: 2 },
        { item: "super_hp_potion", chance: 1, min: 2, max: 4 },
        ...gearDrops(tier, 0.05),
        ...gearDrops(Math.min(10, tier + 1), 0.025),
      ],
    },
    boss: {
      abilities: spec.abilities,
      enrageAt: 0.3,
      enrageSwingMultiplier: 0.7,
      addsAt: [0.6, 0.3],
      addMob: spec.addMob,
      addCount: 2,
    },
  };
}

const slam = (level: number, interval = 11_000): BossAbility => ({ type: "slam", intervalMs: interval, castMs: 1500, radius: 52, damage: level * 7 });
const leap = (level: number, interval = 9000): BossAbility => ({ type: "leap", intervalMs: interval, castMs: 1300, radius: 40, damage: level * 8 });
const charge = (level: number, interval = 10_000): BossAbility => ({ type: "charge", intervalMs: interval, castMs: 1000, length: 150, width: 24, damage: level * 6 });

const list: MobDef[] = [
  // ---- Kızıl Kanyon, Sv 20-30
  field({ id: "sand_slime", name: "Kum Balçığı", level: 21, hp: 1.2, speed: 30, aggroRange: 0, appearance: { type: "slime", color: 0xe0b070 }, material: "sand_crystal" }),
  field({ id: "hyena", name: "Sırtlan", level: 22, attack: 1.1, speed: 76, attackSpeedMs: 1600, appearance: { type: "wolf", fur: 0xb59a6a }, material: "hyena_fang" }),
  field({ id: "canyon_jackal", name: "Kanyon Çakalı", level: 24, attack: 1.1, speed: 78, attackSpeedMs: 1600, appearance: { type: "wolf", fur: 0xc8a46e }, material: "hyena_fang" }),
  field({
    id: "desert_raider",
    name: "Çöl Akıncısı",
    level: 25,
    appearance: { type: "humanoid", tunic: 0x8a2a1a, skin: 0xc68a5a, hair: 0x1a1a1a, headwear: { color: 0xe8dcc0, style: "hood" } },
    material: "bandit_badge",
  }),
  field({
    id: "raider_veteran",
    name: "Akıncı Kıdemlisi",
    level: 27,
    hp: 1.3,
    appearance: { type: "humanoid", tunic: 0x5a1a10, skin: 0xc68a5a, hair: 0x1a1a1a, gear: { head: "iron_helm", chest: "chainmail" } },
    material: "bandit_badge",
  }),
  field({ id: "sandstone_golem", name: "Kumtaşı Golemi", level: 28, hp: 1.7, speed: 42, appearance: { type: "image", key: "golem_earth", tint: 0xd9a066 }, material: "golem_core" }),
  field({ id: "canyon_minotaur", name: "Kanyon Minotoru", level: 29, hp: 1.5, speed: 54, appearance: { type: "image", key: "minotaur_brown" }, material: "sand_crystal" }),
  // Night only.
  field({ id: "dune_wraith", name: "Kum Hortlağı", level: 26, hp: 0.9, attack: 1.3, nightOnly: true, appearance: { type: "image", key: "wraith_teal", tint: 0xd9a066 }, material: "night_essence" }),
  field({ id: "blood_jackal", name: "Kan Çakalı", level: 28, attack: 1.2, speed: 80, attackSpeedMs: 1500, nightOnly: true, appearance: { type: "wolf", fur: 0x8a1a1a }, material: "night_essence" }),
  fieldBoss({
    id: "raider_bey_toygar",
    name: "Akıncı Beyi Kara Toygar",
    level: 30,
    scale: 2,
    appearance: { type: "humanoid", tunic: 0x2a0a0a, skin: 0xc68a5a, hair: 0x1a1a1a, gear: { head: "plate_head_7", chest: "plate_chest_7", legs: "plate_legs_7" } },
    abilities: [slam(30, 12_000), charge(30)],
    addMob: "raider_veteran",
    material: "sand_crystal",
  }),

  // ---- Ayaz Dağları, Sv 30-40
  field({ id: "snow_slime", name: "Kar Balçığı", level: 30, hp: 1.2, speed: 30, aggroRange: 0, appearance: { type: "slime", color: 0xf1f5f9 }, material: "frost_shard" }),
  field({ id: "frost_wolf", name: "Ayaz Kurdu", level: 31, attack: 1.1, speed: 78, attackSpeedMs: 1600, appearance: { type: "wolf", fur: 0xe8eef5 }, material: "frost_shard" }),
  field({
    id: "mountain_raider",
    name: "Dağ Akıncısı",
    level: 32,
    appearance: { type: "humanoid", tunic: 0x5a4a3a, skin: 0xd8a47a, hair: 0x3a2a1a, gear: { head: "leather_cap", chest: "leather_vest", legs: "wolf_hide_leggings" } },
    material: "bandit_badge",
  }),
  field({
    id: "yeti",
    name: "Yeti",
    level: 34,
    hp: 1.6,
    speed: 50,
    appearance: { type: "humanoid", tunic: 0xf1f3f5, skin: 0xdde3ea, hair: 0xf8f9fa, hairStyle: "long" },
    material: "yeti_fur",
  }),
  field({ id: "frost_wraith", name: "Ayaz Hortlağı", level: 35, hp: 0.9, attack: 1.3, appearance: { type: "image", key: "wraith_teal" }, material: "frost_shard" }),
  field({ id: "ice_golem", name: "Buz Golemi", level: 36, hp: 1.8, speed: 42, appearance: { type: "image", key: "golem_stone", tint: 0xb8e0ff }, material: "frost_shard" }),
  // Night only.
  field({ id: "blizzard_spirit", name: "Tipi Ruhu", level: 37, hp: 1.0, attack: 1.35, nightOnly: true, appearance: { type: "image", key: "wraith_purple", tint: 0xd0ebff }, material: "night_essence" }),
  field({ id: "white_wolf", name: "Ak Börü", level: 38, attack: 1.2, speed: 82, attackSpeedMs: 1500, nightOnly: true, appearance: { type: "wolf", fur: 0xffffff }, material: "yeti_fur" }),
  fieldBoss({
    id: "frost_giant_ayazhan",
    name: "Buz Devi Ayazhan",
    level: 40,
    scale: 3,
    appearance: { type: "humanoid", tunic: 0x1c3d5a, skin: 0xb8c8d8, hair: 0xf1f3f5, hairStyle: "long", gear: { chest: "plate_chest_10" } },
    abilities: [slam(40, 12_000), leap(40), charge(40, 14_000)],
    addMob: "yeti",
    material: "yeti_fur",
  }),
];

export const FRONTIER_MOBS: Record<string, MobDef> = Object.fromEntries(list.map((mob) => [mob.id, mob]));

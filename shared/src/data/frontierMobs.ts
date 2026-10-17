import type { Appearance } from "./appearance";
import { gearDrops, gearTierFor, MAX_GEAR_TIER } from "./loot";
import type { BossAbility, LootTable, MobDef } from "./mobs";

// The open-world mobs of the zones off the Starting Valley: Kızıl Kanyon to the west
// (levels 20-30), Ayaz Dağları to the east (30-40) and Kor Toprakları to the south (40-50),
// each with a field boss who comes back a few minutes after falling. Stats follow the same level curve as the big
// dungeons (dungeonMobs.ts), so a level 33 yeti is about as tough as a level 33 dungeon mob.

type Drop = LootTable["drops"][number];

const hpFor = (level: number) => Math.round(12 * level + 1.3 * level * level);
const xpFor = (level: number) => Math.round(0.6 * level * level + 6 * level);

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
  const tier = gearTierFor(level);
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
  const tier = gearTierFor(level);
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
        ...gearDrops(Math.min(MAX_GEAR_TIER, tier + 1), 0.025),
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
  field({ id: "sand_slime", name: "Kum Mumyası", level: 21, hp: 1.2, speed: 30, aggroRange: 0, appearance: { type: "image", key: "mumya", tint: 0xe8d0a0 }, material: "sand_crystal" }),
  field({ id: "hyena", name: "Çöl Mumyası", level: 22, attack: 1.1, speed: 76, attackSpeedMs: 1600, appearance: { type: "image", key: "mumya", tint: 0xd0b080 }, material: "hyena_fang" }),
  field({ id: "canyon_jackal", name: "Kanyon Mumyası", level: 24, attack: 1.1, speed: 78, attackSpeedMs: 1600, appearance: { type: "image", key: "mumya", tint: 0xc8a878 }, material: "hyena_fang" }),
  field({
    id: "desert_raider",
    name: "Çöl Akıncısı",
    level: 25,
    appearance: { type: "image", key: "mumya_savasci" },
    material: "hyena_fang",
  }),
  field({
    id: "raider_veteran",
    name: "Akıncı Kıdemlisi",
    level: 27,
    hp: 1.3,
    appearance: { type: "image", key: "mumya_savasci", tint: 0xe0c8a0 },
    material: "hyena_fang",
  }),
  field({ id: "sandstone_golem", name: "Kumtaşı Muhafızı", level: 28, hp: 1.7, speed: 42, appearance: { type: "image", key: "mumya_savasci", tint: 0xd0a070 }, material: "hyena_fang" }),
  field({ id: "canyon_minotaur", name: "Kanyon Bekçisi", level: 29, hp: 1.5, speed: 54, appearance: { type: "image", key: "mumya_savasci", tint: 0xb08060 }, material: "sand_crystal" }),
  // Night only.
  field({ id: "dune_wraith", name: "Kum Kâhini", level: 26, hp: 0.9, attack: 1.3, nightOnly: true, appearance: { type: "image", key: "mumya_buyucu" }, material: "night_essence" }),
  field({ id: "blood_jackal", name: "Kanlı Mumya", level: 28, attack: 1.2, speed: 80, attackSpeedMs: 1500, nightOnly: true, appearance: { type: "image", key: "mumya", tint: 0xe09080 }, material: "night_essence" }),
  fieldBoss({
    id: "raider_bey_toygar",
    name: "Akıncı Beyi Kara Toygar",
    level: 30,
    scale: 2,
    appearance: { type: "image", key: "mumya_savasci", tint: 0xffd070 },
    abilities: [slam(30, 12_000), charge(30)],
    addMob: "raider_veteran",
    material: "sand_crystal",
  }),

  // ---- Ayaz Dağları, Sv 30-40
  field({ id: "snow_slime", name: "Kar Haydudu", level: 30, hp: 1.2, speed: 30, aggroRange: 0, appearance: { type: "image", key: "haydut_suikastci", tint: 0xd0e8ff }, material: "frost_shard" }),
  field({ id: "frost_wolf", name: "Ayaz Haydudu", level: 31, attack: 1.1, speed: 78, attackSpeedMs: 1600, appearance: { type: "image", key: "haydut_savasci", tint: 0xd0e0ff }, material: "frost_shard" }),
  field({
    id: "mountain_raider",
    name: "Dağ Akıncısı",
    level: 32,
    appearance: { type: "image", key: "haydut_savasci" },
    material: "bandit_badge",
  }),
  field({
    id: "yeti",
    name: "Dağ Zorbası",
    level: 34,
    hp: 1.6,
    speed: 50,
    appearance: { type: "image", key: "haydut_iri", tint: 0xf0f8ff },
    material: "yeti_fur",
  }),
  field({ id: "frost_wraith", name: "Ayaz Hortlağı", level: 35, hp: 0.9, attack: 1.3, appearance: { type: "image", key: "banshee" }, material: "frost_shard" }),
  field({ id: "ice_golem", name: "Buzkıran Haydut", level: 36, hp: 1.8, speed: 42, appearance: { type: "image", key: "haydut_iri", tint: 0xb8d8ff }, material: "frost_shard" }),
  // Night only.
  field({ id: "blizzard_spirit", name: "Tipi Ruhu", level: 37, hp: 1.0, attack: 1.35, nightOnly: true, appearance: { type: "image", key: "banshee", tint: 0xe0f0ff }, material: "night_essence" }),
  field({ id: "white_wolf", name: "Ak Hançer", level: 38, attack: 1.2, speed: 82, attackSpeedMs: 1500, nightOnly: true, appearance: { type: "image", key: "haydut_suikastci", tint: 0xf0f0f0 }, material: "yeti_fur" }),
  fieldBoss({
    id: "frost_giant_ayazhan",
    name: "Dağ Ağası Ayazhan",
    level: 40,
    scale: 1,
    appearance: { type: "image", key: "haydut_bekci", tint: 0xc8e0ff },
    abilities: [slam(40, 12_000), leap(40), charge(40, 14_000)],
    addMob: "yeti",
    material: "yeti_fur",
  }),

  // ---- Kor Toprakları, Sv 40-50
  field({ id: "magma_slime", name: "Magma Taşı", level: 40, hp: 1.2, speed: 30, aggroRange: 0, appearance: { type: "image", key: "tas" }, material: "obsidian_shard" }),
  field({ id: "ember_wolf", name: "Kor Taşı", level: 41, attack: 1.1, speed: 78, attackSpeedMs: 1600, appearance: { type: "image", key: "tas", tint: 0xffb080 }, material: "ember_core" }),
  field({
    id: "ash_cultist",
    name: "Kül Tapıcısı",
    level: 43,
    appearance: { type: "image", key: "tas_lav" },
    material: "obsidian_shard",
  }),
  field({ id: "fire_elemental", name: "Ateş Elementali", level: 44, hp: 0.9, attack: 1.35, appearance: { type: "image", key: "tas_lav", tint: 0xffd0a0 }, material: "ember_core" }),
  field({ id: "lava_salamander", name: "Lav Taşı", level: 45, attack: 1.15, speed: 76, attackSpeedMs: 1600, appearance: { type: "image", key: "tas", tint: 0xff9070 }, material: "ember_core" }),
  field({ id: "lava_golem", name: "Lav Golemi", level: 47, hp: 1.8, speed: 42, appearance: { type: "image", key: "tas_golem" }, material: "golem_core" }),
  // Night only.
  field({ id: "ash_ghost", name: "Kül Taşı Büyücü", level: 46, hp: 1.0, attack: 1.35, nightOnly: true, appearance: { type: "image", key: "tas_lav", tint: 0xc0c0c0 }, material: "night_essence" }),
  field({ id: "hellhound", name: "Cehennem Golemi", level: 48, attack: 1.2, speed: 82, attackSpeedMs: 1500, nightOnly: true, appearance: { type: "image", key: "tas_golem", tint: 0xff8060 }, material: "ember_core" }),
  fieldBoss({
    id: "ember_giant_atesan",
    name: "Kor Devi Ateşhan",
    level: 50,
    scale: 1,
    appearance: { type: "image", key: "tas_golem_buyuk" },
    abilities: [slam(50, 12_000), leap(50), charge(50, 14_000)],
    addMob: "lava_golem",
    material: "ember_core",
  }),

  // ---- Kurgan Ovası, Sv 50-58
  field({ id: "plague_villager", name: "Veba Köylüsü", level: 50, hp: 1.1, speed: 44, appearance: { type: "image", key: "zombi" }, material: "cursed_bone" }),
  field({ id: "pale_villager", name: "Solgun Köylü", level: 51, hp: 1.1, speed: 44, appearance: { type: "image", key: "zombi_sisman" }, material: "cursed_bone" }),
  field({ id: "grave_sentry", name: "Mezar Nöbetçisi", level: 52, hp: 1.3, appearance: { type: "image", key: "iskelet" }, material: "cursed_bone" }),
  field({ id: "barrow_skeleton", name: "Kurgan İskeleti", level: 53, hp: 1.2, appearance: { type: "image", key: "iskelet_savasci" }, material: "barrow_gold" }),
  field({ id: "dark_oracle", name: "Kara Kâhin", level: 55, hp: 0.9, attack: 1.4, appearance: { type: "image", key: "iskelet_buyucu", tint: 0xb0a0d0 }, material: "barrow_gold" }),
  field({ id: "fallen_knight", name: "Düşmüş Şövalye", level: 56, hp: 1.5, appearance: { type: "image", key: "zombi_kasli" }, material: "barrow_gold" }),
  field({ id: "black_guard", name: "Kara Muhafız", level: 57, hp: 1.6, attack: 1.1, appearance: { type: "image", key: "zombi_kasli", tint: 0x8080a0 }, material: "barrow_gold" }),
  // Night only.
  field({ id: "night_walker", name: "Gece Yürüyeni", level: 54, hp: 1.2, speed: 52, nightOnly: true, appearance: { type: "image", key: "zombi", tint: 0x9090b0 }, material: "cursed_bone" }),
  field({ id: "barrow_wraith", name: "Kurgan Hortlağı", level: 56, hp: 1.0, attack: 1.4, nightOnly: true, appearance: { type: "image", key: "banshee" }, material: "night_essence" }),
  fieldBoss({
    id: "fallen_commander_karacor",
    name: "Düşkün Başbuğ Karaçor",
    level: 58,
    scale: 1,
    appearance: { type: "image", key: "iskelet_savasci_buyuk", tint: 0xa0a0c0 },
    abilities: [slam(58, 12_000), leap(58), charge(58, 14_000)],
    addMob: "fallen_knight",
    material: "barrow_gold",
  }),
];

export const FRONTIER_MOBS: Record<string, MobDef> = Object.fromEntries(list.map((mob) => [mob.id, mob]));

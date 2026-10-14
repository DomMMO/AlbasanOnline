import type { Appearance, HumanoidGear } from "./appearance";
import { gearDrops } from "./loot";
import type { BossAbility, LootTable, MobDef } from "./mobs";

// Mobs and bosses of the big dungeons (see dungeons.ts / zones.ts). Stats come from
// one curve per level so the dungeons line up with the open world: a level 16 pack mob is
// about as tough as the Dark Forest's level 16 orcs. Dungeon mobs never respawn.

type Drop = LootTable["drops"][number];

const hpFor = (level: number) => Math.round(12 * level + 1.3 * level * level);
const xpFor = (level: number) => Math.round(0.6 * level * level + 6 * level);
/** Gear tier for a level: tier t is level 3t + 6 (gear.ts); there are ten. */
const gearTier = (level: number) => Math.max(1, Math.min(10, Math.floor((level - 6) / 3)));
const hpPotion = (level: number) => (level >= 17 ? "super_hp_potion" : "large_hp_potion");

interface TrashSpec {
  id: string;
  name: string;
  level: number;
  appearance: Appearance;
  /** Multipliers on the level curve. */
  hp?: number;
  attack?: number;
  speed?: number;
  attackSpeedMs?: number;
  material?: string;
  extraDrops?: Drop[];
}

function trash(spec: TrashSpec): MobDef {
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
    aggroRange: 72,
    respawnMs: 0,
    appearance: spec.appearance,
    loot: {
      gold: [level, level * 2],
      drops: [
        ...(spec.material ? [{ item: spec.material, chance: 0.4 }] : []),
        { item: hpPotion(level), chance: 0.07 },
        { item: "large_mana_potion", chance: 0.06 },
        { item: "upgrade_scroll_low", chance: 0.08 },
        { item: "upgrade_scroll_mid", chance: 0.04 },
        ...gearDrops(tier, 0.004),
        ...(spec.extraDrops ?? []),
      ],
    },
  };
}

interface BossSpec {
  id: string;
  name: string;
  level: number;
  appearance: Appearance;
  abilities: BossAbility[];
  /** The last boss of the dungeon: much tougher, better loot. */
  final?: boolean;
  scale?: number;
  addMob?: string;
  addsAt?: number[];
  extraDrops?: Drop[];
}

function boss(spec: BossSpec): MobDef {
  const { level } = spec;
  const tier = gearTier(level);
  const hpMult = spec.final ? 18 : 11;
  return {
    id: spec.id,
    name: spec.name,
    level,
    maxHp: Math.round(hpFor(level) * hpMult),
    attack: Math.round(3 * level * 1.3),
    defense: Math.round(level * 1.3),
    attackSpeedMs: 2300,
    speed: 60,
    xp: Math.round(xpFor(level) * (spec.final ? 15 : 8)),
    aggroRange: 96,
    respawnMs: 0,
    scale: spec.scale ?? 2,
    appearance: spec.appearance,
    boss: {
      abilities: spec.abilities,
      enrageAt: 0.3,
      enrageSwingMultiplier: 0.7,
      addsAt: spec.addMob ? (spec.addsAt ?? [0.6, 0.3]) : [],
      addMob: spec.addMob,
      addCount: spec.addMob ? 2 : 0,
    },
    loot: {
      gold: [level * 12, level * 25],
      drops: [
        { item: "upgrade_scroll_mid", chance: 1, min: 1, max: spec.final ? 4 : 2 },
        { item: "upgrade_scroll_high", chance: spec.final ? 0.6 : 0.2 },
        { item: "protection_charm", chance: spec.final ? 0.3 : 0.1 },
        { item: "spirit_stone", chance: spec.final ? 0.8 : 0.25, min: 1, max: spec.final ? 3 : 1 },
        { item: hpPotion(level), chance: 1, min: 2, max: 4 },
        ...gearDrops(tier, spec.final ? 0.06 : 0.025),
        ...(spec.final && tier < 10 ? gearDrops(tier + 1, 0.025) : []),
        ...(spec.extraDrops ?? []),
      ],
    },
  };
}

/** Ability presets scaled to the boss's level. */
const slam = (level: number, interval = 11_000): BossAbility => ({ type: "slam", intervalMs: interval, castMs: 1500, radius: 52, damage: level * 7 });
const leap = (level: number, interval = 9000): BossAbility => ({ type: "leap", intervalMs: interval, castMs: 1300, radius: 40, damage: level * 8 });
const charge = (level: number, interval = 10_000): BossAbility => ({ type: "charge", intervalMs: interval, castMs: 1000, length: 150, width: 24, damage: level * 6 });

const human = (tunic: number, skin: number, hair: number, gear?: HumanoidGear): Appearance => ({
  type: "humanoid",
  tunic,
  skin,
  hair,
  gear,
});

const list: MobDef[] = [
  // ---- 1. Terk Edilmiş Maden (Abandoned Mine), Sv 9-12
  trash({ id: "kobold_miner", name: "Kobold Madenci", level: 9, appearance: human(0x6b4a2b, 0xc2a35a, 0x3a2a1a, { head: "leather_cap" }), material: "goblin_ear" }),
  trash({ id: "rock_slime", name: "Kaya Balçığı", level: 10, hp: 1.3, attack: 0.85, speed: 30, appearance: { type: "slime", color: 0x868e96 }, material: "slime_gel" }),
  trash({ id: "tunnel_rat", name: "Tünel Kurdu", level: 10, attack: 1.1, speed: 72, attackSpeedMs: 1700, appearance: { type: "wolf", fur: 0x5c4b3a }, material: "wolf_pelt" }),
  trash({ id: "kobold_overseer", name: "Minotor Gözcü", level: 11, hp: 1.4, appearance: { type: "image", key: "minotaur_brown" }, material: "goblin_ear", extraDrops: [{ item: "minotaur_club", chance: 0.02 }] }),
  boss({ id: "foreman_dorak", name: "Ustabaşı Dorak", level: 10, scale: 1, appearance: { type: "image", key: "minotaur_blue_big" }, abilities: [slam(10)], addMob: "kobold_miner", extraDrops: [{ item: "silver_ring", chance: 0.2 }, { item: "minotaur_mace", chance: 0.25 }] }),
  boss({ id: "crystal_golem", name: "Kristal Golem", level: 11, scale: 1, appearance: { type: "image", key: "golem_stone_big", tint: 0xb8e0ff }, abilities: [leap(11), slam(11, 14_000)], extraDrops: [{ item: "pearl_earring", chance: 0.25 }, { item: "stone_blade", chance: 0.25 }] }),
  boss({ id: "mine_king", name: "Maden Kralı Gırtlak", level: 12, final: true, scale: 1, appearance: { type: "image", key: "minotaur_dark_big" }, abilities: [slam(12), charge(12)], addMob: "kobold_overseer", extraDrops: [{ item: "gold_ring", chance: 0.3 }, { item: "silver_necklace", chance: 0.3 }, { item: "minotaur_hammer", chance: 0.2 }] }),

  // ---- 2. Batık Tapınak (Sunken Temple), Sv 12-15
  trash({ id: "temple_guard", name: "Tapınak Muhafızı", level: 12, hp: 1.3, appearance: human(0x2b6b6b, 0xd9c3a5, 0x1a1a1a, { head: "iron_helm", chest: "scale_vest" }), material: "bandit_badge" }),
  trash({ id: "bog_slime", name: "Batak Balçığı", level: 13, hp: 1.2, speed: 32, appearance: { type: "slime", color: 0x2b8a6e }, material: "poison_sac" }),
  trash({ id: "serpent_hound", name: "Yılan Tazısı", level: 13, attack: 1.1, speed: 74, attackSpeedMs: 1700, appearance: { type: "wolf", fur: 0x3c7a4a }, material: "dark_wolf_pelt" }),
  trash({ id: "drowned_priest", name: "Boğulmuş Rahip", level: 14, hp: 0.9, attack: 1.25, appearance: { type: "image", key: "wraith_hood" }, material: "bone_dust" }),
  boss({ id: "stone_warden", name: "Taş Muhafız", level: 13, scale: 1, appearance: { type: "image", key: "golem_moss_big" }, abilities: [slam(13)], extraDrops: [{ item: "gold_ring", chance: 0.2 }, { item: "golem_axe", chance: 0.25 }] }),
  boss({ id: "sacrifice_priestess", name: "Kurban Rahibesi Selvara", level: 14, appearance: human(0x5f3dc4, 0xd9c3a5, 0x1a1a1a), abilities: [leap(14)], addMob: "drowned_priest", extraDrops: [{ item: "ruby_necklace", chance: 0.2 }] }),
  boss({ id: "tide_beast", name: "Gelgit Canavarı", level: 14, appearance: { type: "wolf", fur: 0x1c7ed6 }, abilities: [charge(14), leap(14, 12_000)], extraDrops: [{ item: "emerald_earring", chance: 0.25 }] }),
  boss({ id: "sunken_king", name: "Batık Kral Nerion", level: 15, final: true, appearance: human(0xe0a800, 0x9fb7c9, 0xf1f3f5, { head: "chieftain_helm", chest: "chainmail" }), abilities: [slam(15), charge(15)], addMob: "temple_guard", extraDrops: [{ item: "ruby_necklace", chance: 0.3 }, { item: "emerald_earring", chance: 0.3 }] }),

  // ---- 3. Kemik Mahzeni (Bone Crypt), Sv 15-18
  trash({ id: "bone_soldier", name: "Kemik Asker", level: 15, hp: 1.2, appearance: human(0x343a40, 0xe8e4d8, 0xe8e4d8, { chest: "chainmail" }), material: "bone_dust" }),
  trash({ id: "crypt_hound", name: "Mahzen Köpeği", level: 16, attack: 1.1, speed: 72, attackSpeedMs: 1700, appearance: { type: "wolf", fur: 0xe8e4d8 }, material: "bone_dust" }),
  trash({ id: "grave_wraith", name: "Mezar Hortlağı", level: 16, hp: 0.9, attack: 1.25, appearance: { type: "image", key: "wraith_purple" }, material: "night_essence" }),
  trash({ id: "plague_slime", name: "Veba Balçığı", level: 17, hp: 1.3, speed: 32, appearance: { type: "slime", color: 0x8ce99a }, material: "poison_sac" }),
  boss({ id: "grave_keeper", name: "Mezar Bekçisi Orvak", level: 16, appearance: human(0x2b2f36, 0xe8e4d8, 0xe8e4d8, { head: "iron_helm", chest: "chainmail", legs: "wolf_hide_leggings" }), abilities: [slam(16)], addMob: "bone_soldier", extraDrops: [{ item: "emerald_earring", chance: 0.2 }] }),
  boss({ id: "bone_beast", name: "Kemik Canavar", level: 17, appearance: { type: "wolf", fur: 0xf1f3f5 }, abilities: [charge(17), leap(17, 13_000)], extraDrops: [{ item: "sapphire_ring", chance: 0.2 }] }),
  boss({ id: "lich_azgor", name: "Lich Azgor", level: 18, final: true, scale: 1, appearance: { type: "image", key: "wraith_purple_big" }, abilities: [leap(18), slam(18)], addMob: "grave_wraith", addsAt: [0.75, 0.5, 0.25], extraDrops: [{ item: "dragon_eye_necklace", chance: 0.3 }, { item: "moonstone_earring", chance: 0.3 }] }),

  // ---- 4. Ork Kalesi (Orc Fortress), Sv 18-21
  trash({ id: "orc_warrior", name: "Ork Savaşçı", level: 18, hp: 1.2, appearance: human(0x4a3a2a, 0x5a7a3a, 0x1a1a1a, { head: "iron_helm", chest: "scale_vest" }), material: "orc_tusk" }),
  trash({ id: "orc_shaman", name: "Ork Şaman", level: 19, hp: 0.9, attack: 1.3, appearance: human(0x7a1f1f, 0x5a7a3a, 0xe8e4d8), material: "orc_tusk" }),
  trash({ id: "war_wolf", name: "Savaş Kurdu", level: 19, attack: 1.1, speed: 76, attackSpeedMs: 1600, appearance: { type: "wolf", fur: 0x3a2a1a }, material: "dark_wolf_pelt" }),
  trash({ id: "orc_brute", name: "Ork Zorba", level: 20, hp: 1.6, attack: 1.15, speed: 52, appearance: human(0x2a1a0a, 0x4a6a2a, 0x1a1a1a, { head: "chieftain_helm", legs: "wolf_hide_leggings" }), material: "orc_tusk" }),
  boss({ id: "gate_keeper_grom", name: "Kapı Bekçisi Grom", level: 19, appearance: human(0x4a3a2a, 0x5a7a3a, 0x1a1a1a, { head: "iron_helm", chest: "chainmail", feet: "iron_boots" }), abilities: [slam(19)], addMob: "orc_warrior", extraDrops: [{ item: "moonstone_earring", chance: 0.2 }] }),
  boss({ id: "wolf_rider_uruk", name: "Kurt Binicisi Uruk", level: 20, appearance: { type: "wolf", fur: 0x2a1a0a }, abilities: [charge(20), charge(20, 7000)], addMob: "war_wolf", extraDrops: [{ item: "sapphire_ring", chance: 0.25 }] }),
  boss({ id: "shaman_zulgar", name: "Şaman Zulgar", level: 20, appearance: human(0x9c1a3a, 0x5a7a3a, 0xe8e4d8), abilities: [leap(20), slam(20, 13_000)], addMob: "orc_shaman", extraDrops: [{ item: "dragon_eye_necklace", chance: 0.25 }] }),
  boss({ id: "warlord_mogthar", name: "Savaş Lordu Mog'Thar", level: 21, final: true, appearance: human(0x1a0a0a, 0x4a6a2a, 0x1a1a1a, { head: "chieftain_helm", chest: "chainmail", legs: "wolf_hide_leggings", feet: "iron_boots" }), abilities: [slam(21), charge(21), leap(21, 14_000)], addMob: "orc_brute", extraDrops: [{ item: "might_ring", chance: 0.15 }, { item: "seal_necklace", chance: 0.15 }] }),

  // ---- 5. Ejder İni (Dragon's Lair), Sv 21-24
  trash({ id: "dragon_cultist", name: "Ejder Tapıcısı", level: 21, appearance: human(0x9c1a1a, 0xd9a07a, 0x1a1a1a), material: "spirit_stone", extraDrops: [{ item: "red_dragon_earring", chance: 0.004 }] }),
  trash({ id: "fire_slime", name: "Ateş Balçığı", level: 22, hp: 1.3, speed: 34, appearance: { type: "slime", color: 0xff6b00 }, material: "night_essence" }),
  trash({ id: "drake", name: "Draka", level: 22, attack: 1.15, speed: 74, attackSpeedMs: 1700, appearance: { type: "wolf", fur: 0xb02020 }, material: "bear_claw" }),
  trash({ id: "dragonkin_guard", name: "Ejder Soylu Muhafız", level: 23, hp: 1.5, appearance: human(0x7a0a0a, 0xc9441a, 0x1a1a1a, { head: "chieftain_helm", chest: "chainmail" }), material: "spirit_stone" }),
  boss({ id: "ash_warden", name: "Kül Muhafızı", level: 22, appearance: human(0x495057, 0xc9441a, 0x1a1a1a, { head: "iron_helm", chest: "chainmail" }), abilities: [slam(22)], addMob: "dragon_cultist", extraDrops: [{ item: "red_dragon_earring", chance: 0.15 }] }),
  boss({ id: "lava_giant", name: "Lav Devi", level: 23, scale: 1, appearance: { type: "image", key: "golem_earth_big", tint: 0xff8a50 }, abilities: [leap(23), slam(23, 13_000)], addMob: "fire_slime", extraDrops: [{ item: "might_ring", chance: 0.15 }] }),
  boss({ id: "dragon_priest", name: "Ejder Rahibi Vael", level: 23, appearance: human(0x5c0a0a, 0xd9a07a, 0xf1f3f5), abilities: [leap(23), charge(23)], addMob: "dragonkin_guard", extraDrops: [{ item: "seal_necklace", chance: 0.15 }] }),
  boss({ id: "elder_dragon", name: "Kadim Ejder Azhdar", level: 24, final: true, scale: 3, appearance: { type: "wolf", fur: 0x8b0000 }, abilities: [slam(24), charge(24), leap(24, 15_000)], addMob: "drake", addsAt: [0.75, 0.5, 0.25], extraDrops: [{ item: "seal_fragment", chance: 1 }, { item: "might_ring", chance: 0.3 }, { item: "red_dragon_earring", chance: 0.3 }, { item: "seal_necklace", chance: 0.3 }] }),
  // ---- 6. Kızıl Mağaralar (Red Caves, Kızıl Kanyon), Sv 22-25
  trash({ id: "gnoll_hunter", name: "Gnol Avcı", level: 22, appearance: { type: "humanoid", tunic: 0x6b4423, skin: 0xb08850, hair: 0x4a3420, hairStyle: "spiky", gear: { chest: "leather_vest" } }, material: "hyena_fang" }),
  trash({ id: "cave_hyena", name: "Mağara Sırtlanı", level: 23, attack: 1.1, speed: 76, attackSpeedMs: 1600, appearance: { type: "wolf", fur: 0x9c7a4a }, material: "hyena_fang" }),
  trash({ id: "dust_slime", name: "Toz Balçığı", level: 23, hp: 1.3, speed: 32, appearance: { type: "slime", color: 0xd9a066 }, material: "sand_crystal" }),
  trash({ id: "gnoll_seer", name: "Gnol Kâhini", level: 24, hp: 0.9, attack: 1.3, appearance: { type: "humanoid", tunic: 0x8a2a1a, skin: 0xb08850, hair: 0xe8e4d8, hairStyle: "long", headwear: { color: 0x8a2a1a, style: "hood" } }, material: "sand_crystal" }),
  trash({ id: "red_minotaur", name: "Kızıl Minotor", level: 25, hp: 1.5, speed: 54, appearance: { type: "image", key: "minotaur_brown", tint: 0xc0583a }, material: "hyena_fang" }),
  boss({ id: "gnoll_chief", name: "Gnol Şefi Kıkırgan", level: 23, appearance: { type: "humanoid", tunic: 0x4a2a12, skin: 0xb08850, hair: 0x2a1a0a, hairStyle: "spiky", gear: { head: "chieftain_helm", chest: "leather_vest" } }, abilities: [slam(23), charge(23)], addMob: "gnoll_hunter" }),
  boss({ id: "hyena_matriarch", name: "Sırtlan Ana", level: 24, scale: 3, appearance: { type: "wolf", fur: 0x7a5a32 }, abilities: [charge(24), leap(24, 11_000)], addMob: "cave_hyena" }),
  boss({ id: "red_bull_tarhan", name: "Kızıl Boğa Tarhan", level: 25, final: true, scale: 1, appearance: { type: "image", key: "minotaur_dark_big", tint: 0xc0583a }, abilities: [charge(25), slam(25), leap(25, 15_000)], addMob: "red_minotaur", extraDrops: [{ item: "sand_crystal", chance: 1, min: 2, max: 4 }] }),

  // ---- 7. Gömülü Kervansaray (Buried Caravanserai, Kızıl Kanyon), Sv 26-29
  trash({ id: "shrouded_dead", name: "Kefenli Ölü", level: 26, hp: 1.2, speed: 48, appearance: { type: "humanoid", tunic: 0xd8cfb8, skin: 0xc8bfa8, hair: 0xd8cfb8, hairStyle: "bald" }, material: "bone_dust" }),
  trash({ id: "tomb_jackal", name: "Mezar Çakalı", level: 27, attack: 1.1, speed: 78, attackSpeedMs: 1600, appearance: { type: "wolf", fur: 0x3a2a1a }, material: "hyena_fang" }),
  trash({ id: "cursed_merchant", name: "Lanetli Tüccar", level: 27, hp: 0.9, attack: 1.3, appearance: { type: "image", key: "wraith_hood", tint: 0xc9a227 }, material: "sand_crystal" }),
  trash({ id: "sand_shade", name: "Kum Gölgesi", level: 28, hp: 0.9, attack: 1.3, appearance: { type: "image", key: "wraith_teal", tint: 0xd9a066 }, material: "night_essence" }),
  trash({ id: "ruin_golem", name: "Harabe Golemi", level: 28, hp: 1.7, speed: 44, appearance: { type: "image", key: "golem_earth", tint: 0xd9b48a }, material: "golem_core" }),
  boss({ id: "caravan_ghost", name: "Kervanbaşı Sadi'nin Hortlağı", level: 27, scale: 1, appearance: { type: "image", key: "wraith_purple_big", tint: 0xd9a066 }, abilities: [leap(27), slam(27, 13_000)], addMob: "cursed_merchant" }),
  boss({ id: "vizier_kamil", name: "Lanetli Vezir Kâmil", level: 28, appearance: { type: "humanoid", tunic: 0x5f3dc4, skin: 0xc8bfa8, hair: 0xf1f3f5, hairStyle: "long", headwear: { color: 0xe8b84a, style: "hat" } }, abilities: [leap(28), charge(28)], addMob: "shrouded_dead" }),
  boss({ id: "stone_sentinel", name: "Taş Nöbetçi", level: 28, scale: 1, appearance: { type: "image", key: "golem_stone_big", tint: 0xd9b48a }, abilities: [slam(28), leap(28, 14_000)], addMob: "ruin_golem", addsAt: [0.5] }),
  boss({ id: "sand_sultan", name: "Kum Sultanı Erkam", level: 29, final: true, appearance: { type: "humanoid", tunic: 0xe8b84a, skin: 0xc8bfa8, hair: 0x1a1a1a, gear: { head: "plate_head_7", chest: "plate_chest_7" } }, abilities: [slam(29), charge(29), leap(29, 14_000)], addMob: "sand_shade", addsAt: [0.75, 0.5, 0.25], extraDrops: [{ item: "sand_crystal", chance: 1, min: 3, max: 5 }] }),

  // ---- 8. Buz Mağarası (Frozen Cavern, Ayaz Dağları), Sv 31-34
  trash({ id: "ice_fox", name: "Buz Tilkisi", level: 31, attack: 1.1, speed: 80, attackSpeedMs: 1500, appearance: { type: "wolf", fur: 0xd0e8f5 }, material: "frost_shard" }),
  trash({ id: "crystal_slime", name: "Kristal Balçık", level: 32, hp: 1.3, speed: 30, appearance: { type: "slime", color: 0x9ad5ff }, material: "frost_shard" }),
  trash({ id: "frost_kobold", name: "Ayaz Koboldu", level: 32, appearance: { type: "humanoid", tunic: 0x3b5bdb, skin: 0x9fb7c9, hair: 0xf1f3f5, gear: { head: "leather_cap" } }, material: "frost_shard" }),
  trash({ id: "ice_elemental", name: "Buz Elementali", level: 33, hp: 1.6, speed: 46, appearance: { type: "image", key: "golem_stone", tint: 0xb8e0ff }, material: "frost_shard" }),
  trash({ id: "frozen_spirit", name: "Donuk Ruh", level: 34, hp: 0.9, attack: 1.3, appearance: { type: "image", key: "wraith_teal" }, material: "night_essence" }),
  boss({ id: "icebreaker_gorr", name: "Buzkıran Gorr", level: 32, scale: 1, appearance: { type: "image", key: "golem_stone_big", tint: 0xb8e0ff }, abilities: [slam(32), leap(32, 12_000)], addMob: "ice_elemental", addsAt: [0.5] }),
  boss({ id: "snow_mother_fox", name: "Ak Tilki Ana", level: 33, scale: 3, appearance: { type: "wolf", fur: 0xf8f9fa }, abilities: [charge(33), charge(33, 7000)], addMob: "ice_fox" }),
  boss({ id: "crystal_mother_neyra", name: "Kristal Ana Neyra", level: 34, final: true, appearance: { type: "humanoid", tunic: 0x74c0fc, skin: 0xdde3ea, hair: 0xe7f5ff, gender: "female", hairStyle: "long", headwear: { color: 0xb8e0ff, style: "hat" } }, abilities: [leap(34), slam(34), charge(34, 12_000)], addMob: "frozen_spirit", addsAt: [0.75, 0.5, 0.25], extraDrops: [{ item: "frost_shard", chance: 1, min: 3, max: 5 }] }),

  // ---- 9. Ayaz Kalesi (Frost Citadel, Ayaz Dağları), Sv 35-39
  trash({ id: "frost_knight", name: "Ayaz Şövalyesi", level: 35, hp: 1.4, appearance: { type: "humanoid", tunic: 0x1c3d5a, skin: 0xdde3ea, hair: 0x1a1a1a, gear: { head: "plate_head_8", chest: "plate_chest_8", legs: "plate_legs_8" } }, material: "frost_shard" }),
  trash({ id: "frost_mage", name: "Ayaz Büyücüsü", level: 36, hp: 0.9, attack: 1.35, appearance: { type: "humanoid", tunic: 0x3b5bdb, skin: 0xdde3ea, hair: 0xf1f3f5, hairStyle: "long", gear: { chest: "robe_chest_8" } }, material: "frost_shard" }),
  trash({ id: "ice_hound", name: "Buz Tazısı", level: 36, attack: 1.15, speed: 80, attackSpeedMs: 1500, appearance: { type: "wolf", fur: 0x8fbfe0 }, material: "yeti_fur" }),
  trash({ id: "giant_guard", name: "Dev Muhafız", level: 37, hp: 1.8, attack: 1.1, speed: 46, appearance: { type: "humanoid", tunic: 0x343a40, skin: 0xb8c8d8, hair: 0xf1f3f5, hairStyle: "bald", gear: { chest: "plate_chest_9" } }, material: "yeti_fur" }),
  trash({ id: "winter_wraith", name: "Kış Hortlağı", level: 38, hp: 1.0, attack: 1.35, appearance: { type: "image", key: "wraith_purple", tint: 0xb8e0ff }, material: "night_essence" }),
  boss({ id: "gate_commander_sergun", name: "Kapı Kumandanı Sergün", level: 36, appearance: { type: "humanoid", tunic: 0x1c3d5a, skin: 0xdde3ea, hair: 0x1a1a1a, gear: { head: "plate_head_9", chest: "plate_chest_9", legs: "plate_legs_9", feet: "plate_feet_9" } }, abilities: [slam(36), charge(36)], addMob: "frost_knight" }),
  boss({ id: "ice_witch_ayaza", name: "Buz Cadısı Ayaza", level: 37, appearance: { type: "humanoid", tunic: 0x5f3dc4, skin: 0xdde3ea, hair: 0xf8f9fa, gender: "female", hairStyle: "long", headwear: { color: 0x3b5bdb, style: "hat" } }, abilities: [leap(37), leap(37, 6000), slam(37, 14_000)], addMob: "frost_mage" }),
  boss({ id: "white_drake_kiragi", name: "Ak Ejder Kırağı", level: 38, scale: 3, appearance: { type: "wolf", fur: 0xe7f5ff }, abilities: [charge(38), slam(38), leap(38, 13_000)], addMob: "ice_hound" }),
  boss({ id: "winter_king_ulukan", name: "Kış Kralı Ulukan", level: 39, final: true, appearance: { type: "humanoid", tunic: 0x0b2540, skin: 0xdde3ea, hair: 0xf1f3f5, gear: { head: "plate_head_10", chest: "plate_chest_10", legs: "plate_legs_10", feet: "plate_feet_10" } }, abilities: [slam(39), charge(39), leap(39, 12_000)], addMob: "giant_guard", addsAt: [0.75, 0.5, 0.25], extraDrops: [{ item: "yeti_fur", chance: 1, min: 2, max: 4 }, { item: "upgrade_scroll_high", chance: 1 }] }),
];

export const DUNGEON_MOBS: Record<string, MobDef> = Object.fromEntries(list.map((mob) => [mob.id, mob]));

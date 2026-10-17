import { MELEE_RANGE, TILE_SIZE } from "../constants";
import type { QuestDef } from "./quests";
import type { EquipSlot } from "./items";
import type { CombatStats } from "./progression";

// Classes. Every character starts as an Acemi (novice) with no skills; the opening quest
// sends them into the keep, where one of the seven masters by the fire takes them on:
// Alp (Savaşçı), Kam (Şaman), Börü (Suikastçı), Tigin (Okçu), Erşek (Druid),
// Ak Ana (Şifacı) and Erlik Ruh Eğitmeni (Nekromant). Ayşe Teyze can undo the choice
// for gold, which makes the character an Acemi again.

export type ClassId = "novice" | "warrior" | "shaman" | "rogue" | "archer" | "druid" | "priest" | "necromancer";
/** Rage fills from fighting, mana regenerates slowly, energy regenerates quickly. */
export type ResourceType = "rage" | "mana" | "energy";
/** Classes with `specs` choose one at their master: a damage dealer or a tank. "" = not chosen yet. */
export type SpecId = "damage" | "tank";

export interface SpecDef {
  name: string;
  description: string;
}

/** What the tank spec does (DENGE.md, bölüm 6). */
export const TANK_SPEC = {
  /** Fraction of incoming damage actually taken. */
  damageTaken: 0.6,
  hpPct: 0.3,
  /** Tanks hit softer. */
  attackPct: -0.25,
} as const;

export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  resource: ResourceType;
  /** Stats before equipment. For casters, `attack` is spell power. */
  baseStats(level: number): Pick<CombatStats, "maxHp" | "attack" | "defense" | "attackSpeedMs">;
  /** Rage is always 100; mana grows with level. */
  maxResource(level: number): number;
  /** Plain attacks with the equipped weapon. Ranged ones need line of sight. */
  autoAttack: { range: number; multiplier: number; ranged: boolean };
  /** Active skills in hotbar order (see SkillDef.level for when each can be learned). */
  skills: string[];
  /** Its interrupt (Kesme): known from its level without points, not in the skill ranks. */
  interrupt?: string;
  /** Hotbar slots after the skills. */
  potions: string[];
  starterEquipment: Partial<Record<EquipSlot, string>>;
  starterInventory: { defId: string; qty: number }[];
  /** Drawn on the head when no helmet is worn, so classes are recognisable. */
  headwear?: { color: number; style: "hat" | "hood" };
  /** UI accent colour (chat names, class picker). */
  color: string;
  /** Gets this class's class-specific quest rewards when a quest has none of its own. */
  rewardsLike?: ClassId;
  /** Its two paths, chosen at the master. The tank pulls every mob it hits onto itself (TANK_SPEC). */
  specs?: Record<SpecId, SpecDef>;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  novice: {
    id: "novice",
    name: "Acemi",
    description: "Henüz bir ustanın yanında yetişmemiş. Yeteneği yok; kılıcıyla idare eder. Kaledeki ustalardan birini seçince yolu belli olur.",
    resource: "rage",
    baseStats: (level) => ({ maxHp: 75 + (level - 1) * 16, attack: 7 + (level - 1) * 2, defense: 2 + Math.floor((level - 1) * 0.6), attackSpeedMs: 2000 }),
    maxResource: () => 100,
    autoAttack: { range: MELEE_RANGE, multiplier: 1, ranged: false },
    skills: [],
    potions: ["minor_hp_potion", "hp_potion"],
    starterEquipment: { weapon: "rusty_sword", chest: "cloth_shirt" },
    starterInventory: [{ defId: "minor_hp_potion", qty: 5 }],
    color: "#ced4da",
  },
  warrior: {
    id: "warrior",
    name: "Savaşçı",
    description: "Alp'in yolu. Yakın dövüş; vurdukça ve hasar aldıkça öfke kazanır. Dayanıklıdır, grubun önünde durur.",
    resource: "rage",
    baseStats: (level) => ({ maxHp: 80 + (level - 1) * 20, attack: 8 + (level - 1) * 3, defense: 2 + (level - 1), attackSpeedMs: 2000 }),
    maxResource: () => 100,
    autoAttack: { range: MELEE_RANGE, multiplier: 1, ranged: false },
    skills: ["heroicStrike", "whirlwind", "secondWind", "hamstring", "leapSlam", "battleShout"],
    interrupt: "pummel",
    specs: {
      damage: { name: "Akıncı", description: "Öne atılır, sert vurur. Grubun hasarına omuz verir." },
      tank: { name: "Kalkan Eri", description: "Grubun önünde durur: vurduğu mobu üstüne çeker, aldığı hasar %40 az, canı %30 fazla; hasarı %25 düşük." },
    },
    potions: ["minor_hp_potion", "hp_potion"],
    starterEquipment: { weapon: "rusty_sword", chest: "cloth_shirt" },
    starterInventory: [{ defId: "minor_hp_potion", qty: 5 }],
    color: "#e03131",
  },
  shaman: {
    id: "shaman",
    name: "Şaman",
    description: "Kam'ın yolu. Göğü ve ataların ruhlarını çağırır: şimşek indirir, davuluyla düşmanı sarsar, yaralıyı iyileştirir. Mana kullanır.",
    resource: "mana",
    baseStats: (level) => ({ maxHp: 68 + (level - 1) * 15, attack: 10 + Math.round((level - 1) * 3.3), defense: 1 + Math.floor((level - 1) * 0.7), attackSpeedMs: 1800 }),
    maxResource: (level) => 125 + (level - 1) * 12,
    autoAttack: { range: TILE_SIZE * 7, multiplier: 0.5, ranged: true },
    skills: ["skyLash", "thunderDrum", "ancestorSpirit", "spiritBind", "windWalk", "skyBlessing"],
    interrupt: "windShear",
    potions: ["minor_hp_potion", "minor_mana_potion"],
    starterEquipment: { weapon: "apprentice_staff", chest: "cloth_shirt" },
    starterInventory: [
      { defId: "minor_hp_potion", qty: 5 },
      { defId: "minor_mana_potion", qty: 5 },
    ],
    headwear: { color: 0x1c7ed6, style: "hat" },
    color: "#339af0",
  },
  rogue: {
    id: "rogue",
    name: "Suikastçı",
    description: "Börü'nün yolu. Kurt gibi sessiz ve hızlı: kritikleri ölümcüldür, düşmanını sersemletip arkasında belirir. Hızla dolan enerji kullanır.",
    resource: "energy",
    baseStats: (level) => ({ maxHp: 72 + (level - 1) * 17, attack: 9 + Math.round((level - 1) * 3.1), defense: 2 + Math.floor((level - 1) * 0.8), attackSpeedMs: 1600 }),
    maxResource: () => 100,
    autoAttack: { range: MELEE_RANGE, multiplier: 0.9, ranged: false },
    skills: ["sinisterStrike", "fanOfKnives", "eviscerate", "blind", "shadowStep", "adrenaline"],
    interrupt: "throatKick",
    potions: ["minor_hp_potion", "hp_potion"],
    starterEquipment: { weapon: "rusty_sword", chest: "cloth_shirt" },
    starterInventory: [{ defId: "minor_hp_potion", qty: 5 }],
    headwear: { color: 0x343a40, style: "hood" },
    color: "#ffe066",
    rewardsLike: "warrior",
  },
  archer: {
    id: "archer",
    name: "Okçu",
    description: "Tigin'in yolu. Yay ve ok: uzaktan nişan alır, ok yağdırır, düşmanı yere çiviler. Hızla dolan enerji kullanır.",
    resource: "energy",
    baseStats: (level) => ({ maxHp: 70 + (level - 1) * 16, attack: 9 + Math.round((level - 1) * 3.2), defense: 2 + Math.floor((level - 1) * 0.8), attackSpeedMs: 1700 }),
    maxResource: () => 100,
    autoAttack: { range: TILE_SIZE * 7, multiplier: 0.75, ranged: true },
    skills: ["aimedShot", "arrowRain", "quickShot", "pinningShot", "hawkLeap", "eagleEye"],
    interrupt: "silencingShot",
    potions: ["minor_hp_potion", "hp_potion"],
    starterEquipment: { weapon: "short_bow", chest: "cloth_shirt" },
    starterInventory: [{ defId: "minor_hp_potion", qty: 5 }],
    headwear: { color: 0x2b5422, style: "hood" },
    color: "#94d82d",
    rewardsLike: "warrior",
  },
  druid: {
    id: "druid",
    name: "Druid",
    description: "Erşek'in yolu. Ormanın sesi: dikenle vurur, kökle bağlar, yaprakla iyileştirir, bozkurt gibi atılır. Mana kullanır.",
    resource: "mana",
    baseStats: (level) => ({ maxHp: 74 + (level - 1) * 17, attack: 9 + Math.round((level - 1) * 3.1), defense: 2 + Math.floor((level - 1) * 0.9), attackSpeedMs: 1800 }),
    maxResource: (level) => 125 + (level - 1) * 12,
    autoAttack: { range: TILE_SIZE * 7, multiplier: 0.45, ranged: true },
    skills: ["thornLash", "entangle", "rejuvenate", "barkskin", "wildCharge", "springTide"],
    interrupt: "thornGag",
    specs: {
      damage: { name: "Orman Gazabı", description: "Diken ve kökle uzaktan vurur, gerekince yaralıyı sarar." },
      tank: { name: "Ayı Ruhu", description: "Ayının ruhunu taşır: vurduğu mobu üstüne çeker, aldığı hasar %40 az, canı %30 fazla; hasarı %25 düşük." },
    },
    potions: ["minor_hp_potion", "minor_mana_potion"],
    starterEquipment: { weapon: "apprentice_staff", chest: "cloth_shirt" },
    starterInventory: [
      { defId: "minor_hp_potion", qty: 5 },
      { defId: "minor_mana_potion", qty: 5 },
    ],
    headwear: { color: 0x5c940d, style: "hood" },
    color: "#40c057",
    rewardsLike: "shaman",
  },
  priest: {
    id: "priest",
    name: "Şifacı",
    description: "Ak Ana'nın yolu. Arındırır ve kutsar: yaraları iyileştirir, kalkan verir, kutsal ışıkla kötülüğü yakar. Mana kullanır.",
    resource: "mana",
    baseStats: (level) => ({ maxHp: 70 + (level - 1) * 16, attack: 9 + (level - 1) * 3, defense: 1 + Math.floor((level - 1) * 0.8), attackSpeedMs: 1800 }),
    maxResource: (level) => 130 + (level - 1) * 12,
    autoAttack: { range: TILE_SIZE * 7, multiplier: 0.45, ranged: true },
    skills: ["smite", "heal", "shield", "holyNova", "holyChains", "lightStep", "divineSpirit"],
    interrupt: "holySilence",
    potions: ["minor_hp_potion", "minor_mana_potion"],
    starterEquipment: { weapon: "apprentice_staff", chest: "cloth_shirt" },
    starterInventory: [
      { defId: "minor_hp_potion", qty: 5 },
      { defId: "minor_mana_potion", qty: 5 },
    ],
    headwear: { color: 0xf1f3f5, style: "hood" },
    color: "#fab005",
  },
  necromancer: {
    id: "necromancer",
    name: "Nekromant",
    description: "Erlik Ruh Eğitmeni'nin yolu. Ölülerin efendisi: düşmanın canını emer, iskelet çağırır, kemik patlatır. Mana kullanır.",
    resource: "mana",
    baseStats: (level) => ({ maxHp: 66 + (level - 1) * 15, attack: 9 + Math.round((level - 1) * 3.2), defense: 1 + Math.floor((level - 1) * 0.7), attackSpeedMs: 1800 }),
    maxResource: (level) => 125 + (level - 1) * 12,
    autoAttack: { range: TILE_SIZE * 7, multiplier: 0.45, ranged: true },
    skills: ["drainLife", "boneNova", "summonSkeleton", "terror", "soulStep", "darkPact"],
    interrupt: "soulLock",
    potions: ["minor_hp_potion", "minor_mana_potion"],
    starterEquipment: { weapon: "apprentice_staff", chest: "cloth_shirt" },
    starterInventory: [
      { defId: "minor_hp_potion", qty: 5 },
      { defId: "minor_mana_potion", qty: 5 },
    ],
    headwear: { color: 0x2b2f36, style: "hood" },
    color: "#51cf66",
    rewardsLike: "shaman",
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
/** Classes a master can teach (everything but the novice). */
export const PLAYABLE_CLASS_IDS = CLASS_IDS.filter((id) => id !== "novice");

/** Ayşe Teyze's price for undoing the class choice. */
export function classResetPrice(level: number): number {
  return 100 * level;
}

export function isClassId(value: unknown): value is ClassId {
  return typeof value === "string" && value in CLASSES;
}

/** A quest's class-specific rewards for this class (falling back to `rewardsLike`). */
export function classQuestItems(quest: QuestDef, classId: string) {
  const cls = classOf(classId);
  const items = quest.reward.classItems;
  return items?.[cls.id] ?? (cls.rewardsLike ? items?.[cls.rewardsLike] : undefined) ?? [];
}

export function isSpecId(value: unknown): value is SpecId {
  return value === "damage" || value === "tank";
}

/** Whether this class and spec is a tank. */
export function isTank(cls: string, spec: string): boolean {
  return spec === "tank" && !!classOf(cls).specs;
}

/** Unknown or retired classes count as a novice (they choose again at the keep). */
export function classOf(value: string): ClassDef {
  return isClassId(value) ? CLASSES[value] : CLASSES.novice;
}

import { MELEE_RANGE, TILE_SIZE } from "../constants";
import type { QuestDef } from "./quests";
import type { EquipSlot } from "./items";
import type { CombatStats } from "./progression";

// Playable classes. Warrior = tank (rage), Mage = ranged damage (mana),
// Priest = healer (mana): the trio party content will be built around.

export type ClassId = "warrior" | "mage" | "priest" | "necromancer" | "guardian";
export type ResourceType = "rage" | "mana";

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
  /** Hotbar slots 1-3. */
  skills: string[];
  /** Hotbar slots 4-5. */
  potions: string[];
  starterEquipment: Partial<Record<EquipSlot, string>>;
  starterInventory: { defId: string; qty: number }[];
  /** Drawn on the head when no helmet is worn, so classes are recognisable. */
  headwear?: { color: number; style: "hat" | "hood" };
  /** UI accent colour (chat names, class picker). */
  color: string;
  /** Gets this class's class-specific quest rewards when a quest has none of its own. */
  rewardsLike?: ClassId;
  /** Tank: every hit pulls the mob's aggro off other players. */
  tauntOnHit?: boolean;
  /** Fraction of incoming damage actually taken (tanks < 1). */
  damageTaken?: number;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: "warrior",
    name: "Savaşçı",
    description: "Yakın dövüş. Vurdukça ve hasar aldıkça öfke kazanır. Dayanıklı; ileride grubun tankı.",
    resource: "rage",
    baseStats: (level) => ({ maxHp: 80 + (level - 1) * 20, attack: 8 + (level - 1) * 3, defense: 2 + (level - 1), attackSpeedMs: 2000 }),
    maxResource: () => 100,
    autoAttack: { range: MELEE_RANGE, multiplier: 1, ranged: false },
    skills: ["heroicStrike", "whirlwind", "secondWind"],
    potions: ["minor_hp_potion", "hp_potion"],
    starterEquipment: { weapon: "rusty_sword", chest: "cloth_shirt" },
    starterInventory: [{ defId: "minor_hp_potion", qty: 5 }],
    color: "#e03131",
  },
  mage: {
    id: "mage",
    name: "Büyücü",
    description: "Uzaktan güçlü büyüler. Mana kullanır. Kırılgandır; düşmanları dondurup mesafe korur.",
    resource: "mana",
    baseStats: (level) => ({ maxHp: 60 + (level - 1) * 14, attack: 10 + Math.round((level - 1) * 3.4), defense: 1 + Math.floor((level - 1) * 0.6), attackSpeedMs: 1800 }),
    maxResource: (level) => 120 + (level - 1) * 12,
    autoAttack: { range: TILE_SIZE * 7, multiplier: 0.5, ranged: true },
    skills: ["fireball", "frostNova", "lightning"],
    potions: ["minor_hp_potion", "minor_mana_potion"],
    starterEquipment: { weapon: "apprentice_staff", chest: "cloth_shirt" },
    starterInventory: [
      { defId: "minor_hp_potion", qty: 5 },
      { defId: "minor_mana_potion", qty: 5 },
    ],
    headwear: { color: 0x5f3dc4, style: "hat" },
    color: "#7950f2",
  },
  priest: {
    id: "priest",
    name: "Şifacı",
    description: "İyileştirir ve kalkan verir, kutsal ışıkla hasar yapar. Mana kullanır; ileride grubun şifacısı.",
    resource: "mana",
    baseStats: (level) => ({ maxHp: 70 + (level - 1) * 16, attack: 9 + (level - 1) * 3, defense: 1 + Math.floor((level - 1) * 0.8), attackSpeedMs: 1800 }),
    maxResource: (level) => 130 + (level - 1) * 12,
    autoAttack: { range: TILE_SIZE * 7, multiplier: 0.45, ranged: true },
    skills: ["smite", "heal", "shield"],
    potions: ["minor_hp_potion", "minor_mana_potion"],
    starterEquipment: { weapon: "apprentice_staff", chest: "cloth_shirt" },
    starterInventory: [
      { defId: "minor_hp_potion", qty: 5 },
      { defId: "minor_mana_potion", qty: 5 },
    ],
    headwear: { color: 0xf1f3f5, style: "hood" },
    color: "#fab005",
  },
  guardian: {
    id: "guardian",
    name: "Muhafız",
    description: "Grubun kalkanı. Vurduğu düşmanın dikkatini hemen üstüne çeker, %10 daha az hasar alır. Öfke kullanır; hasarı da hafife alınmaz.",
    resource: "rage",
    baseStats: (level) => ({ maxHp: 100 + (level - 1) * 25, attack: 7 + Math.round((level - 1) * 2.6), defense: 4 + Math.round((level - 1) * 1.5), attackSpeedMs: 2000 }),
    maxResource: () => 100,
    autoAttack: { range: MELEE_RANGE, multiplier: 1, ranged: false },
    skills: ["shieldSlam", "challengingShout", "shieldWall"],
    potions: ["minor_hp_potion", "hp_potion"],
    starterEquipment: { weapon: "rusty_sword", chest: "cloth_shirt" },
    starterInventory: [{ defId: "minor_hp_potion", qty: 5 }],
    headwear: { color: 0x868e96, style: "hood" },
    color: "#4dabf7",
    rewardsLike: "warrior",
    tauntOnHit: true,
    damageTaken: 0.9,
  },
  necromancer: {
    id: "necromancer",
    name: "Nekromant",
    description: "Ölülerin efendisi. Düşmanın canını emer, iskelet çağırır, kemik patlatır. Mana kullanır.",
    resource: "mana",
    baseStats: (level) => ({ maxHp: 66 + (level - 1) * 15, attack: 9 + Math.round((level - 1) * 3.2), defense: 1 + Math.floor((level - 1) * 0.7), attackSpeedMs: 1800 }),
    maxResource: (level) => 125 + (level - 1) * 12,
    autoAttack: { range: TILE_SIZE * 7, multiplier: 0.45, ranged: true },
    skills: ["drainLife", "summonSkeleton", "boneNova"],
    potions: ["minor_hp_potion", "minor_mana_potion"],
    starterEquipment: { weapon: "apprentice_staff", chest: "cloth_shirt" },
    starterInventory: [
      { defId: "minor_hp_potion", qty: 5 },
      { defId: "minor_mana_potion", qty: 5 },
    ],
    headwear: { color: 0x2b2f36, style: "hood" },
    color: "#51cf66",
    rewardsLike: "mage",
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

export function isClassId(value: unknown): value is ClassId {
  return typeof value === "string" && value in CLASSES;
}

/** A quest's class-specific rewards for this class (falling back to `rewardsLike`). */
export function classQuestItems(quest: QuestDef, classId: string) {
  const cls = classOf(classId);
  const items = quest.reward.classItems;
  return items?.[cls.id] ?? (cls.rewardsLike ? items?.[cls.rewardsLike] : undefined) ?? [];
}

/** Characters created before classes existed are warriors. */
export function classOf(value: string): ClassDef {
  return isClassId(value) ? CLASSES[value] : CLASSES.warrior;
}

import type { ClassId } from "./classes";
import { GEAR } from "./gear";

// Every item in the game. Instances (what a player actually owns) only store
// { defId, qty, enhance }; everything else is looked up here.

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#ffffff",
  uncommon: "#1eff00",
  rare: "#3d8bff",
  epic: "#b65cff",
  legendary: "#ff8000",
};

export const RARITY_NAMES: Record<Rarity, string> = {
  common: "Sıradan",
  uncommon: "Kaliteli",
  rare: "Nadir",
  epic: "Destansı",
  legendary: "Efsanevi",
};

export type EquipSlot = "weapon" | "head" | "chest" | "legs" | "feet" | "neck" | "ring" | "earring";

export const EQUIP_SLOTS: EquipSlot[] = ["weapon", "head", "chest", "legs", "feet", "neck", "ring", "earring"];

export const EQUIP_SLOT_NAMES: Record<EquipSlot, string> = {
  weapon: "Silah",
  head: "Baş",
  chest: "Gövde",
  legs: "Bacak",
  feet: "Ayak",
  neck: "Kolye",
  ring: "Yüzük",
  earring: "Küpe",
};

export type IconShape =
  | "sword"
  | "axe"
  | "helm"
  | "chest"
  | "legs"
  | "boots"
  | "potion"
  | "blob"
  | "pelt"
  | "ear"
  | "scroll"
  | "gem"
  | "scythe"
  | "staff"
  | "mace"
  | "ring"
  | "amulet"
  | "earring"
  | "bone"
  | "coin"
  | "fang"
  | "meat"
  | "bowl";

export interface ItemStats {
  attack?: number;
  defense?: number;
  maxHp?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** Required level to equip/use. */
  level: number;
  slot?: EquipSlot;
  stats?: ItemStats;
  /** Weapons only: replaces the base swing timer. */
  attackSpeedMs?: number;
  /** Consumables: health restored on use. */
  heal?: number;
  /** Consumables: mana restored on use. */
  mana?: number;
  /** Only these classes may equip it; undefined = everyone. */
  classes?: ClassId[];
  /** Items in the same group share one cooldown. */
  cooldownGroup?: string;
  maxStack: number;
  /** Price at the merchant; undefined = not sold there. */
  buyPrice?: number;
  sellPrice: number;
  icon: { shape: IconShape; color: number };
  /** Returns the player to the main town when used (Geri Dönüş Parşömeni). */
  recall?: boolean;
  /** Quest items can't be sold to merchants. */
  questItem?: boolean;
  /** How worn armour looks on the character: plain cloth/leather, chain "mail", or shiny "plate". */
  look?: "mail" | "plate";
  description?: string;
}

export const POTION_COOLDOWN_MS = 10_000;

const def = (item: ItemDef) => item;
const MELEE: ClassId[] = ["warrior"];
const CASTERS: ClassId[] = ["mage", "priest"];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [
    // ---- Weapons
    def({ id: "rusty_sword", classes: MELEE, name: "Paslı Kılıç", rarity: "common", level: 1, slot: "weapon", stats: { attack: 3 }, attackSpeedMs: 2000, maxStack: 1, sellPrice: 2, icon: { shape: "sword", color: 0xa07850 } }),
    def({ id: "iron_sword", classes: MELEE, name: "Demir Kılıç", rarity: "common", level: 3, slot: "weapon", stats: { attack: 7 }, attackSpeedMs: 2000, maxStack: 1, buyPrice: 60, sellPrice: 12, icon: { shape: "sword", color: 0xc8ccd4 } }),
    def({ id: "wolf_fang_blade", classes: MELEE, name: "Kurt Dişi Kılıcı", rarity: "uncommon", level: 3, slot: "weapon", stats: { attack: 10 }, attackSpeedMs: 1900, maxStack: 1, sellPrice: 25, icon: { shape: "sword", color: 0xe8e2c8 } }),
    def({ id: "war_axe", classes: MELEE, name: "Savaş Baltası", rarity: "common", level: 5, slot: "weapon", stats: { attack: 14 }, attackSpeedMs: 2400, maxStack: 1, buyPrice: 200, sellPrice: 40, icon: { shape: "axe", color: 0xb0b4bc } }),
    def({ id: "grukk_axe", classes: MELEE, name: "Grukk'un Baltası", rarity: "epic", level: 7, slot: "weapon", stats: { attack: 24, maxHp: 20 }, attackSpeedMs: 2300, maxStack: 1, sellPrice: 150, icon: { shape: "axe", color: 0xa83232 }, description: "Goblin Şefi'nin kanlı baltası." }),
    def({ id: "pumpkin_scythe", classes: MELEE, name: "Kabak Jack'in Tırpanı", rarity: "legendary", level: 8, slot: "weapon", stats: { attack: 30, maxHp: 30 }, attackSpeedMs: 2600, maxStack: 1, sellPrice: 300, icon: { shape: "scythe", color: 0x6e5a44 }, description: "Mahzenin lanetinden kalma tırpan. Ağır ama ölümcül." }),
    def({ id: "steel_sword", classes: MELEE, name: "Çelik Kılıç", rarity: "uncommon", level: 6, slot: "weapon", stats: { attack: 16 }, attackSpeedMs: 2000, maxStack: 1, buyPrice: 450, sellPrice: 90, icon: { shape: "sword", color: 0xe0e6f0 } }),
    def({ id: "goblin_cleaver", classes: MELEE, name: "Goblin Satırı", rarity: "rare", level: 5, slot: "weapon", stats: { attack: 17, maxHp: 10 }, attackSpeedMs: 2200, maxStack: 1, sellPrice: 70, icon: { shape: "axe", color: 0x7cb342 } }),

    def({ id: "apprentice_staff", classes: CASTERS, name: "Çırak Asası", rarity: "common", level: 1, slot: "weapon", stats: { attack: 3 }, attackSpeedMs: 1800, maxStack: 1, sellPrice: 2, icon: { shape: "staff", color: 0x8b5a2b } }),
    def({ id: "oak_staff", classes: CASTERS, name: "Meşe Asa", rarity: "common", level: 3, slot: "weapon", stats: { attack: 7 }, attackSpeedMs: 1800, maxStack: 1, buyPrice: 60, sellPrice: 12, icon: { shape: "staff", color: 0x6b8e23 } }),
    def({ id: "ash_staff", classes: CASTERS, name: "Dişbudak Asa", rarity: "uncommon", level: 6, slot: "weapon", stats: { attack: 15 }, attackSpeedMs: 1800, maxStack: 1, buyPrice: 450, sellPrice: 90, icon: { shape: "staff", color: 0xc9a66b } }),
    def({ id: "seer_staff", classes: CASTERS, name: "Kahin Asası", rarity: "rare", level: 5, slot: "weapon", stats: { attack: 15, maxHp: 10 }, attackSpeedMs: 1800, maxStack: 1, sellPrice: 70, icon: { shape: "staff", color: 0x7950f2 }, description: "Ucundaki taş hafifçe parlıyor." }),

    // ---- Armour
    def({ id: "leather_cap", name: "Deri Başlık", rarity: "common", level: 1, slot: "head", stats: { defense: 1 }, maxStack: 1, buyPrice: 15, sellPrice: 3, icon: { shape: "helm", color: 0x8b5a2b } }),
    def({ id: "iron_helm", name: "Demir Miğfer", rarity: "uncommon", level: 4, slot: "head", stats: { defense: 3, maxHp: 10 }, maxStack: 1, sellPrice: 20, icon: { shape: "helm", color: 0xb0b4bc }, look: "plate" }),
    def({ id: "chieftain_helm", name: "Şef Miğferi", rarity: "rare", level: 7, slot: "head", stats: { defense: 6, maxHp: 25 }, maxStack: 1, sellPrice: 90, icon: { shape: "helm", color: 0xd4a017 }, look: "plate" }),
    def({ id: "cloth_shirt", name: "Keten Gömlek", rarity: "common", level: 1, slot: "chest", stats: { defense: 1 }, maxStack: 1, sellPrice: 1, icon: { shape: "chest", color: 0xd8cfb0 } }),
    def({ id: "leather_vest", name: "Deri Yelek", rarity: "common", level: 2, slot: "chest", stats: { defense: 3 }, maxStack: 1, buyPrice: 40, sellPrice: 8, icon: { shape: "chest", color: 0x8b5a2b } }),
    def({ id: "chainmail", name: "Zincir Zırh", rarity: "rare", level: 5, slot: "chest", stats: { defense: 6, maxHp: 20 }, maxStack: 1, sellPrice: 60, icon: { shape: "chest", color: 0x9aa4b4 }, look: "mail" }),
    def({ id: "scale_vest", name: "Pullu Yelek", rarity: "uncommon", level: 5, slot: "chest", stats: { defense: 5 }, maxStack: 1, buyPrice: 260, sellPrice: 50, icon: { shape: "chest", color: 0x7c8a6e }, look: "mail" }),
    def({ id: "leather_pants", name: "Deri Pantolon", rarity: "common", level: 2, slot: "legs", stats: { defense: 2 }, maxStack: 1, buyPrice: 30, sellPrice: 6, icon: { shape: "legs", color: 0x8b5a2b } }),
    def({ id: "wolf_hide_leggings", name: "Kurt Postu Tozluk", rarity: "uncommon", level: 3, slot: "legs", stats: { defense: 4, maxHp: 10 }, maxStack: 1, sellPrice: 18, icon: { shape: "legs", color: 0x8a8f99 } }),
    def({ id: "iron_boots", name: "Demir Çizme", rarity: "common", level: 4, slot: "feet", stats: { defense: 3 }, maxStack: 1, buyPrice: 120, sellPrice: 24, icon: { shape: "boots", color: 0xa8adb6 }, look: "plate" }),
    def({ id: "worn_boots", name: "Eski Çizme", rarity: "common", level: 1, slot: "feet", stats: { defense: 1 }, maxStack: 1, buyPrice: 10, sellPrice: 2, icon: { shape: "boots", color: 0x6b4423 } }),

    // ---- Consumables
    def({ id: "minor_hp_potion", name: "Küçük Can İksiri", rarity: "common", level: 1, heal: 40, cooldownGroup: "potion", maxStack: 20, buyPrice: 5, sellPrice: 1, icon: { shape: "potion", color: 0xd94141 }, description: "40 can yeniler." }),
    def({ id: "hp_potion", name: "Can İksiri", rarity: "common", level: 4, heal: 100, cooldownGroup: "potion", maxStack: 20, buyPrice: 15, sellPrice: 3, icon: { shape: "potion", color: 0xff3d6e }, description: "100 can yeniler." }),

    def({ id: "minor_mana_potion", name: "Küçük Mana İksiri", rarity: "common", level: 1, mana: 50, cooldownGroup: "mana_potion", maxStack: 20, buyPrice: 6, sellPrice: 1, icon: { shape: "potion", color: 0x3b5bdb }, description: "50 mana yeniler." }),
    def({ id: "mana_potion", name: "Mana İksiri", rarity: "common", level: 4, mana: 120, cooldownGroup: "mana_potion", maxStack: 20, buyPrice: 18, sellPrice: 3, icon: { shape: "potion", color: 0x4c6ef5 }, description: "120 mana yeniler." }),

    // ---- Upgrading (see upgrade.ts)
    def({ id: "upgrade_scroll_low", name: "Düşük Sınıf Yükseltme Parşömeni", rarity: "common", level: 1, maxStack: 50, buyPrice: 30, sellPrice: 6, icon: { shape: "scroll", color: 0x3f7fd9 }, description: "Ekipmanı +1'den +4'e kadar yükseltir. Demirciye götür." }),
    def({ id: "upgrade_scroll_mid", name: "Orta Sınıf Yükseltme Parşömeni", rarity: "uncommon", level: 1, maxStack: 50, buyPrice: 450, sellPrice: 25, icon: { shape: "scroll", color: 0x3fae5a }, description: "Ekipmanı +5'ten +7'ye kadar yükseltir. Demirciye götür." }),
    def({ id: "upgrade_scroll_high", name: "Yüksek Sınıf Yükseltme Parşömeni", rarity: "rare", level: 1, maxStack: 50, sellPrice: 80, icon: { shape: "scroll", color: 0xb65cff }, description: "Ekipmanı +8'den +10'a kadar yükseltir. Demirciye götür." }),
    def({ id: "protection_charm", name: "Koruma Tılsımı", rarity: "epic", level: 1, maxStack: 20, sellPrice: 100, icon: { shape: "gem", color: 0xe0a83f }, description: "Yükseltme başarısız olursa item yanmaz." }),

    // ---- Food (Ayşe Teyze's dinner quests)
    def({ id: "ayse_stew", name: "Ayşe Teyze'nin Güveci", rarity: "uncommon", level: 1, heal: 150, cooldownGroup: "food", maxStack: 20, sellPrice: 4, icon: { shape: "bowl", color: 0xb5651d }, description: "Dumanı üstünde. 150 can yeniler; iksirlerle ayrı bekleme süresi var." }),
    def({ id: "wolf_meat", name: "Kurt Eti", rarity: "common", level: 1, maxStack: 50, sellPrice: 2, icon: { shape: "meat", color: 0xb5463a } }),

    // ---- Materials (sold for gold)
    def({ id: "slime_gel", name: "Balçık Jölesi", rarity: "common", level: 1, maxStack: 50, sellPrice: 1, icon: { shape: "blob", color: 0x6fcf5a } }),
    def({ id: "wolf_pelt", name: "Kurt Postu", rarity: "common", level: 1, maxStack: 50, sellPrice: 3, icon: { shape: "pelt", color: 0x8a8f99 } }),
    def({ id: "goblin_ear", name: "Goblin Kulağı", rarity: "common", level: 1, maxStack: 50, sellPrice: 5, icon: { shape: "ear", color: 0x7cb342 } }),
    ...GEAR,
  ].map((item) => [item.id, item]),
);


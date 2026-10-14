import type { ClassId } from "./classes";
import type { EquipSlot, IconShape, ItemDef, Rarity } from "./items";

// The big item catalogue for levels 5-45, in the spirit of Knight Online and Metin2:
// weapon lines per class, class armour sets, accessories (necklace, ring, earring),
// stronger potions, the return scroll, and the materials/quest items dropped by the
// Dark Forest mobs. Stats follow a formula per tier so the lines stay balanced;
// hand-written items live in items.ts.

/** Swords and axes: warriors and assassins. */
const WARRIOR: ClassId[] = ["warrior", "rogue"];
/** Plate: everyone who fights with steel or the bow. */
const PLATE: ClassId[] = ["warrior", "rogue", "archer"];
const CASTERS: ClassId[] = ["shaman", "druid", "priest", "necromancer"];
const PRIEST: ClassId[] = ["priest"];
/** Staves: shamans, druids and necromancers. */
const MAGE: ClassId[] = ["shaman", "druid", "necromancer"];
const ARCHER: ClassId[] = ["archer"];

/** Rarity by tier index (0 = first tier of a line). */
const TIER_RARITY: Rarity[] = ["uncommon", "uncommon", "rare", "rare", "epic", "epic", "epic", "epic", "legendary", "legendary", "legendary", "legendary", "legendary"];

const sellPrice = (level: number, rarity: Rarity) =>
  Math.round(level * level * 0.9 * { common: 1, uncommon: 1.3, rare: 1.8, epic: 2.6, legendary: 4 }[rarity]);

interface WeaponLine {
  idPrefix: string;
  classes: ClassId[];
  shape: IconShape;
  speedMs: number;
  /** Attack per level of the item. */
  attackPerLevel: number;
  tiers: { name: string; level: number; color: number; description?: string; maxHp?: number }[];
}

const WEAPON_LINES: WeaponLine[] = [
  {
    idPrefix: "sword",
    classes: WARRIOR,
    shape: "sword",
    speedMs: 2000,
    attackPerLevel: 2.15,
    tiers: [
      { name: "Hilal Kılıcı", level: 9, color: 0xd8dde6 },
      { name: "Dolunay Kılıcı", level: 12, color: 0xf2f0c8 },
      { name: "Zehirli Kılıç", level: 15, color: 0x8fd14f, description: "Ağzından yeşil bir sıvı damlıyor." },
      { name: "Aslan Kılıcı", level: 18, color: 0xe8b84a, maxHp: 20 },
      { name: "Ejderha Kılıcı", level: 21, color: 0xd9412b, maxHp: 40, description: "Kınından çıktığında havada kıvılcımlar uçuşur." },
      { name: "Akrep Kılıcı", level: 24, color: 0xc9a227, maxHp: 50 },
      { name: "Kum Fırtınası Kılıcı", level: 27, color: 0xe0b070, maxHp: 60 },
      { name: "Ayaz Kılıcı", level: 30, color: 0xb8e0ff, maxHp: 75 },
      { name: "Kutup Yıldızı Kılıcı", level: 33, color: 0xe7f5ff, maxHp: 90, description: "Kuzeyin en parlak yıldızı ağzına işlenmiş." },
      { name: "Kış Kralı Kılıcı", level: 36, color: 0x74c0fc, maxHp: 110, description: "Ulukan'ın kılıcı. Değdiği yeri kırağı tutar." },
      { name: "Obsidyen Kılıç", level: 39, color: 0x2b2b33, maxHp: 130 },
      { name: "Kor Kılıcı", level: 42, color: 0xff6b00, maxHp: 150 },
      { name: "Közhan'ın Pençesi", level: 45, color: 0xd9480f, maxHp: 175, description: "Ateş Ejderi'nin pençesinden dövülmüş; ağzı hiç soğumaz." },
    ],
  },
  {
    idPrefix: "axe",
    classes: WARRIOR,
    shape: "axe",
    speedMs: 2500,
    attackPerLevel: 2.75,
    tiers: [
      { name: "Kemik Balta", level: 10, color: 0xe8e2c8 },
      { name: "Savaş Teberi", level: 13, color: 0xa8adb6 },
      { name: "Kara Ay Baltası", level: 16, color: 0x4a4a6a },
      { name: "Gök Gürültüsü Baltası", level: 19, color: 0x6fb4ff, maxHp: 20 },
      { name: "Kızıl Ejder Teberi", level: 22, color: 0xb02020, maxHp: 45, description: "Ejder kanıyla dövülmüş dev bir teber." },
      { name: "Kanyon Baltası", level: 24, color: 0xb0613b, maxHp: 55 },
      { name: "Sultan Teberi", level: 27, color: 0xe8b84a, maxHp: 65 },
      { name: "Ayaz Baltası", level: 30, color: 0xa5d8ff, maxHp: 80 },
      { name: "Çığ Baltası", level: 33, color: 0xf1f3f5, maxHp: 95 },
      { name: "Ulukan'ın Teberi", level: 36, color: 0x4dabf7, maxHp: 115, description: "Bir vuruşta donmuş bir şelaleyi ikiye böler." },
      { name: "Bazalt Balta", level: 39, color: 0x495057, maxHp: 135 },
      { name: "Magma Teberi", level: 42, color: 0xf76707, maxHp: 155 },
      { name: "Volkan Kıran", level: 45, color: 0xc92a2a, maxHp: 180 },
    ],
  },
  {
    idPrefix: "staff",
    classes: MAGE,
    shape: "staff",
    speedMs: 1800,
    attackPerLevel: 2.05,
    tiers: [
      { name: "Kristal Asa", level: 9, color: 0x9ad5ff },
      { name: "Ateş Asası", level: 12, color: 0xff7a2a },
      { name: "Buzul Asası", level: 15, color: 0x74c0fc },
      { name: "Yıldırım Asası", level: 18, color: 0xffe14d, maxHp: 15 },
      { name: "Anka Asası", level: 21, color: 0xff4d2e, maxHp: 30, description: "Küllerinden doğan kuşun tüyü tepesinde yanıyor." },
      { name: "Serap Asası", level: 24, color: 0xffd8a8, maxHp: 40 },
      { name: "Kum Saati Asası", level: 27, color: 0xd9a066, maxHp: 50 },
      { name: "Kırağı Asası", level: 30, color: 0xd0ebff, maxHp: 60 },
      { name: "Kuzey Işığı Asası", level: 33, color: 0x63e6be, maxHp: 75, description: "Tepesinde yeşil bir ışık dalgalanıyor." },
      { name: "Kadim Buz Asası", level: 36, color: 0x91a7ff, maxHp: 90 },
      { name: "Kül Asası", level: 39, color: 0x868e96, maxHp: 105 },
      { name: "Alev Dili Asası", level: 42, color: 0xff922b, maxHp: 120 },
      { name: "Anka Kanadı Asası", level: 45, color: 0xffd43b, maxHp: 140, description: "Ucunda küllerinden doğan bir kuşun tüyü tutuşur." },
    ],
  },
  {
    idPrefix: "bow",
    classes: ARCHER,
    shape: "bow",
    speedMs: 1700,
    attackPerLevel: 2.05,
    tiers: [
      { name: "Boynuz Yay", level: 9, color: 0xd8c8a8 },
      { name: "Bozkır Yayı", level: 12, color: 0xb5835a },
      { name: "Akdoğan Yayı", level: 15, color: 0xf1f3f5 },
      { name: "Gökkuşağı Yayı", level: 18, color: 0x74c0fc, maxHp: 15 },
      { name: "Tigin'in Yayı", level: 21, color: 0xe8b84a, maxHp: 30, description: "Bozkırın en büyük okçusunun yayı. Kirişi altınla örülmüş." },
      { name: "Akrep Yayı", level: 24, color: 0xc9a227, maxHp: 40 },
      { name: "Çöl Kartalı Yayı", level: 27, color: 0xb5835a, maxHp: 50 },
      { name: "Ayaz Yayı", level: 30, color: 0xb8e0ff, maxHp: 60 },
      { name: "Kar Baykuşu Yayı", level: 33, color: 0xf8f9fa, maxHp: 75 },
      { name: "Gökbörü Yayı", level: 36, color: 0x5c7cfa, maxHp: 90, description: "Gökten inen kurdun dişinden oyulmuş." },
      { name: "Obsidyen Yay", level: 39, color: 0x2b2b33, maxHp: 105 },
      { name: "Kor Yayı", level: 42, color: 0xff6b00, maxHp: 120 },
      { name: "Güneş Oku Yayı", level: 45, color: 0xffd43b, maxHp: 140 },
    ],
  },
  {
    idPrefix: "mace",
    classes: PRIEST,
    shape: "mace",
    speedMs: 1900,
    attackPerLevel: 1.95,
    tiers: [
      { name: "Kutsal Topuz", level: 9, color: 0xe0e0e0, maxHp: 10 },
      { name: "Şafak Topuzu", level: 12, color: 0xffc9a0, maxHp: 15 },
      { name: "Güneş Topuzu", level: 15, color: 0xffd43b, maxHp: 20 },
      { name: "Melek Topuzu", level: 18, color: 0xf8f9fa, maxHp: 30 },
      { name: "Nur Topuzu", level: 21, color: 0xfff3bf, maxHp: 45, description: "Tutan elin karanlıkta bile yolunu aydınlatır." },
      { name: "Güneş Kursu Topuzu", level: 24, color: 0xffd43b, maxHp: 55 },
      { name: "Sultan Topuzu", level: 27, color: 0xe8b84a, maxHp: 65 },
      { name: "Kar Tanesi Topuzu", level: 30, color: 0xe7f5ff, maxHp: 80 },
      { name: "Şafak Yıldızı Topuzu", level: 33, color: 0xffe8cc, maxHp: 95 },
      { name: "Ebedî Nur Topuzu", level: 36, color: 0xfff9db, maxHp: 115 },
      { name: "Kutsal Ateş Topuzu", level: 39, color: 0xffa94d, maxHp: 135 },
      { name: "Kor Topuz", level: 42, color: 0xff6b00, maxHp: 155 },
      { name: "Şafak Ateşi Topuzu", level: 45, color: 0xfff3bf, maxHp: 180 },
    ],
  },
];

function weapons(): ItemDef[] {
  return WEAPON_LINES.flatMap((line) =>
    line.tiers.map((tier, index) => {
      const rarity = TIER_RARITY[index];
      return {
        id: `${line.idPrefix}_${index + 1}`,
        name: tier.name,
        rarity,
        level: tier.level,
        slot: "weapon" as const,
        classes: line.classes,
        stats: { attack: Math.round(tier.level * line.attackPerLevel), ...(tier.maxHp ? { maxHp: tier.maxHp } : {}) },
        attackSpeedMs: line.speedMs,
        maxStack: 1,
        // The first tier of each line is also sold in town.
        buyPrice: index === 0 ? sellPrice(tier.level, rarity) * 5 : undefined,
        sellPrice: sellPrice(tier.level, rarity),
        icon: { shape: line.shape, color: tier.color },
        description: tier.description,
      };
    }),
  );
}

interface ArmourSet {
  idPrefix: string;
  classes: ClassId[];
  look?: "mail" | "plate";
  /** Multipliers on the base defense/health per piece; casters trade armour for spell power. */
  defense: number;
  health: number;
  attack: number;
  pieceNames: Record<"head" | "chest" | "legs" | "feet", string>;
  tiers: { name: string; level: number; color: number }[];
}

/** Share of a set's stats each piece carries. */
const PIECE_WEIGHT = { head: 0.22, chest: 0.36, legs: 0.26, feet: 0.16 } as const;
const PIECE_SHAPE: Record<keyof typeof PIECE_WEIGHT, IconShape> = { head: "helm", chest: "chest", legs: "legs", feet: "boots" };

const ARMOUR_SETS: ArmourSet[] = [
  {
    idPrefix: "plate",
    classes: PLATE,
    look: "plate",
    defense: 1,
    health: 1,
    attack: 0,
    pieceNames: { head: "Miğferi", chest: "Zırhı", legs: "Dizliği", feet: "Çizmesi" },
    tiers: [
      { name: "Tunç", level: 8, color: 0xb5835a },
      { name: "Demir Pul", level: 11, color: 0x9aa4b4 },
      { name: "Kara Çelik", level: 14, color: 0x50525e },
      { name: "Kartal", level: 17, color: 0xd4a017 },
      { name: "Ejder Pulu", level: 20, color: 0xa8322d },
      { name: "Kum Pulu", level: 23, color: 0xc9a227 },
      { name: "Sultan", level: 26, color: 0xe8b84a },
      { name: "Ayaz", level: 29, color: 0xa5d8ff },
      { name: "Buzul", level: 32, color: 0xe7f5ff },
      { name: "Kış Kralı", level: 35, color: 0x4dabf7 },
      { name: "Bazalt", level: 38, color: 0x495057 },
      { name: "Magma", level: 41, color: 0xf76707 },
      { name: "Ejder Kanı", level: 44, color: 0xc92a2a },
    ],
  },
  {
    idPrefix: "robe",
    classes: CASTERS,
    defense: 0.55,
    health: 0.8,
    attack: 1,
    pieceNames: { head: "Başlığı", chest: "Cübbesi", legs: "Şalvarı", feet: "Çarığı" },
    tiers: [
      { name: "Çırak", level: 8, color: 0x6a4c93 },
      { name: "Bilgin", level: 11, color: 0x3b5bdb },
      { name: "Mistik", level: 14, color: 0x7048e8 },
      { name: "Yıldız", level: 17, color: 0x1c7ed6 },
      { name: "Kadim", level: 20, color: 0xc2255c },
      { name: "Serap", level: 23, color: 0xffa94d },
      { name: "Müneccim", level: 26, color: 0x845ef7 },
      { name: "Kırağı", level: 29, color: 0x74c0fc },
      { name: "Kuzey Işığı", level: 32, color: 0x63e6be },
      { name: "Ebedî", level: 35, color: 0xf8f9fa },
      { name: "Kül", level: 38, color: 0x868e96 },
      { name: "Alev", level: 41, color: 0xff922b },
      { name: "Anka", level: 44, color: 0xffd43b },
    ],
  },
];

function armour(): ItemDef[] {
  return ARMOUR_SETS.flatMap((set) =>
    set.tiers.flatMap((tier, index) => {
      const rarity = TIER_RARITY[index];
      // A full warrior set at level L gives about L*1.5 defense and L*6 health.
      const setDefense = tier.level * 1.5 * set.defense;
      const setHealth = tier.level * 6 * set.health;
      const setAttack = tier.level * 0.6 * set.attack;
      return (Object.keys(PIECE_WEIGHT) as (keyof typeof PIECE_WEIGHT)[]).map((piece) => {
        const w = PIECE_WEIGHT[piece];
        const attack = Math.round(setAttack * w);
        return {
          id: `${set.idPrefix}_${piece}_${index + 1}`,
          name: `${tier.name} ${set.pieceNames[piece]}`,
          rarity,
          level: tier.level,
          slot: piece,
          classes: set.classes,
          stats: { defense: Math.max(1, Math.round(setDefense * w)), maxHp: Math.round(setHealth * w), ...(attack ? { attack } : {}) },
          maxStack: 1,
          buyPrice: index === 0 ? sellPrice(tier.level, rarity) * 5 : undefined,
          sellPrice: sellPrice(tier.level, rarity),
          icon: { shape: PIECE_SHAPE[piece], color: tier.color },
          look: set.look,
        } satisfies ItemDef;
      });
    }),
  );
}

interface AccessoryLine {
  slot: EquipSlot;
  shape: IconShape;
  /** Which stat the line favours. */
  stat: "maxHp" | "attack" | "defense";
  tiers: { id: string; name: string; level: number; color: number; rarity?: Rarity; description?: string }[];
}

const ACCESSORIES: AccessoryLine[] = [
  {
    slot: "neck",
    shape: "amulet",
    stat: "maxHp",
    tiers: [
      { id: "copper_necklace", name: "Bakır Kolye", level: 4, color: 0xc87533 },
      { id: "silver_necklace", name: "Gümüş Kolye", level: 9, color: 0xd8dde6 },
      { id: "ruby_necklace", name: "Yakut Kolye", level: 13, color: 0xe03131 },
      { id: "dragon_eye_necklace", name: "Ejder Gözü Kolyesi", level: 17, color: 0xf59f00 },
      { id: "seal_necklace", name: "Mühürlü Kolye", level: 21, color: 0xffd43b, rarity: "epic", description: "Kırık Mühür'ün ışığından bir parça taşıyor." },
    ],
  },
  {
    slot: "ring",
    shape: "ring",
    stat: "attack",
    tiers: [
      { id: "copper_ring", name: "Bakır Yüzük", level: 3, color: 0xc87533 },
      { id: "silver_ring", name: "Gümüş Yüzük", level: 8, color: 0xd8dde6 },
      { id: "gold_ring", name: "Altın Yüzük", level: 12, color: 0xffd43b },
      { id: "sapphire_ring", name: "Safir Yüzük", level: 16, color: 0x1c7ed6 },
      { id: "might_ring", name: "Kudret Yüzüğü", level: 21, color: 0xff6b00, rarity: "epic", description: "Eski kralların parmağında taşınmış." },
    ],
  },
  {
    slot: "earring",
    shape: "earring",
    stat: "defense",
    tiers: [
      { id: "copper_earring", name: "Bakır Küpe", level: 5, color: 0xc87533 },
      { id: "pearl_earring", name: "İnci Küpe", level: 10, color: 0xf1f3f5 },
      { id: "emerald_earring", name: "Zümrüt Küpe", level: 14, color: 0x2f9e44 },
      { id: "moonstone_earring", name: "Ay Taşı Küpe", level: 18, color: 0xb197fc },
      { id: "red_dragon_earring", name: "Kızıl Ejder Küpesi", level: 22, color: 0xc92a2a, rarity: "epic" },
    ],
  },
];

function accessories(): ItemDef[] {
  return ACCESSORIES.flatMap((line) =>
    line.tiers.map((tier, index) => {
      const rarity = tier.rarity ?? (index === 0 ? "common" : index < 3 ? "uncommon" : "rare");
      const value = { maxHp: tier.level * 3, attack: Math.round(tier.level * 0.45), defense: Math.round(tier.level * 0.35) }[line.stat];
      // Every accessory also carries a little health.
      const stats = line.stat === "maxHp" ? { maxHp: value } : { [line.stat]: Math.max(1, value), maxHp: tier.level };
      return {
        id: tier.id,
        name: tier.name,
        rarity,
        level: tier.level,
        slot: line.slot,
        stats,
        maxStack: 1,
        buyPrice: index < 2 ? sellPrice(tier.level, rarity) * 5 : undefined,
        sellPrice: sellPrice(tier.level, rarity),
        icon: { shape: line.shape, color: tier.color },
        description: tier.description,
      };
    }),
  );
}

const def = (item: ItemDef) => item;

export const GEAR: ItemDef[] = [
  ...weapons(),
  ...armour(),
  ...accessories(),

  // ---- Consumables
  def({ id: "large_hp_potion", name: "Büyük Can İksiri", rarity: "common", level: 10, heal: 250, cooldownGroup: "potion", maxStack: 20, buyPrice: 40, sellPrice: 8, icon: { shape: "potion", color: 0xc2255c }, description: "250 can yeniler." }),
  def({ id: "super_hp_potion", name: "Süper Can İksiri", rarity: "uncommon", level: 17, heal: 450, cooldownGroup: "potion", maxStack: 20, buyPrice: 90, sellPrice: 18, icon: { shape: "potion", color: 0x9c1a3a }, description: "450 can yeniler." }),
  def({ id: "large_mana_potion", name: "Büyük Mana İksiri", rarity: "common", level: 10, mana: 260, cooldownGroup: "mana_potion", maxStack: 20, buyPrice: 45, sellPrice: 9, icon: { shape: "potion", color: 0x364fc7 }, description: "260 mana yeniler." }),
  def({ id: "super_mana_potion", name: "Süper Mana İksiri", rarity: "uncommon", level: 17, mana: 480, cooldownGroup: "mana_potion", maxStack: 20, buyPrice: 100, sellPrice: 20, icon: { shape: "potion", color: 0x1c2f8a }, description: "480 mana yeniler." }),
  def({ id: "return_scroll", name: "Geri Dönüş Parşömeni", rarity: "common", level: 1, recall: true, maxStack: 20, buyPrice: 25, sellPrice: 5, icon: { shape: "scroll", color: 0x2f9e44 }, description: "Okuyanı Ana Merkez'e ışınlar. Savaşta kullanılamaz." }),

  // ---- Dark Forest materials (sold for gold, wanted by quests)
  def({ id: "dark_wolf_pelt", name: "Kara Kurt Postu", rarity: "common", level: 1, maxStack: 50, sellPrice: 9, icon: { shape: "pelt", color: 0x3a3a44 } }),
  def({ id: "poison_sac", name: "Zehir Kesesi", rarity: "common", level: 1, maxStack: 50, sellPrice: 10, icon: { shape: "blob", color: 0x9bd13a } }),
  def({ id: "bandit_badge", name: "Haydut Nişanı", rarity: "common", level: 1, maxStack: 50, sellPrice: 12, icon: { shape: "coin", color: 0x8b2a2a } }),
  def({ id: "bone_dust", name: "Kemik Tozu", rarity: "common", level: 1, maxStack: 50, sellPrice: 13, icon: { shape: "bone", color: 0xe8e4d8 } }),
  def({ id: "orc_tusk", name: "Ork Dişi", rarity: "common", level: 1, maxStack: 50, sellPrice: 16, icon: { shape: "fang", color: 0xe8e2c8 } }),
  def({ id: "bear_claw", name: "Ayı Pençesi", rarity: "uncommon", level: 1, maxStack: 50, sellPrice: 30, icon: { shape: "fang", color: 0x6b4a2b } }),
  def({ id: "satyr_horn", name: "Satir Boynuzu", rarity: "common", level: 1, maxStack: 50, sellPrice: 13, icon: { shape: "fang", color: 0xd9c8a0 } }),
  def({ id: "golem_core", name: "Golem Çekirdeği", rarity: "uncommon", level: 1, maxStack: 50, sellPrice: 28, icon: { shape: "gem", color: 0x8bd35a } }),
  // Kızıl Kanyon and Ayaz Dağları.
  def({ id: "hyena_fang", name: "Sırtlan Dişi", rarity: "common", level: 1, maxStack: 50, sellPrice: 22, icon: { shape: "fang", color: 0xd9c8a0 } }),
  def({ id: "sand_crystal", name: "Kum Kristali", rarity: "uncommon", level: 1, maxStack: 50, sellPrice: 40, icon: { shape: "gem", color: 0xe0b070 }, description: "Güneşte tutunca içinde kum taneleri döner." }),
  def({ id: "frost_shard", name: "Ayaz Kristali", rarity: "common", level: 1, maxStack: 50, sellPrice: 30, icon: { shape: "gem", color: 0xb8e0ff } }),
  def({ id: "yeti_fur", name: "Yeti Postu", rarity: "uncommon", level: 1, maxStack: 50, sellPrice: 55, icon: { shape: "fang", color: 0xf1f3f5 }, description: "Kürkçüler bunun için altın öder." }),
  // Kor Toprakları.
  def({ id: "obsidian_shard", name: "Obsidyen Parçası", rarity: "common", level: 1, maxStack: 50, sellPrice: 38, icon: { shape: "gem", color: 0x343a40 } }),
  def({ id: "ember_core", name: "Kor Çekirdeği", rarity: "uncommon", level: 1, maxStack: 50, sellPrice: 70, icon: { shape: "gem", color: 0xff6b00 }, description: "Avucunda hâlâ sıcak. Demirciler bayılır." }),
  def({ id: "spirit_stone", name: "Ruh Taşı", rarity: "rare", level: 1, maxStack: 20, sellPrice: 150, icon: { shape: "gem", color: 0x845ef7 }, description: "İçinde sönük bir ruh ışığı yanıp sönüyor. Tüccarlar iyi para verir." }),

  // ---- Quest items
  def({ id: "seal_fragment", name: "Mühür Parçası", rarity: "epic", level: 1, questItem: true, maxStack: 5, sellPrice: 0, icon: { shape: "gem", color: 0xffd43b }, description: "Kırık Mühür'ün altın bir parçası. Bilge Ozan'a götür." }),
];

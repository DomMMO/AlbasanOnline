import { FOREST_SPOTS } from "../forest";
import { HARBOR_SPOTS } from "../harbor";
import { TOWN_SPOTS } from "../town";
import type { Appearance } from "./appearance";

export interface NpcDef {
  id: string;
  name: string;
  /** Feet position in pixels. */
  x: number;
  y: number;
  appearance: Appearance;
  /** quest = only gives quests and talks. storage = keeps your items (depo). guard = only says its greeting. */
  role: "merchant" | "blacksmith" | "quest" | "storage" | "guard";
  /** Item ids for sale; prices come from ItemDef.buyPrice. */
  shop: string[];
  /** First line of the conversation window. */
  greeting: string;
  /** Reads the player's coffee-cup fortune once a day (see fortune.ts). */
  fortuneTeller?: boolean;
}

/** Feet position of an NPC in the hunting grounds (valley map tiles). */
const valley = (tx: number, ty: number) => ({ x: (tx + 0.5) * 16, y: (ty + 1) * 16 });

// Which zone an NPC stands in is decided by ZoneDef.npcs.

/** A town guard in mail with a helmet; talking to one only gets its line. */
function guard(id: string, name: string, at: { x: number; y: number }, greeting: string): NpcDef {
  return {
    id,
    name,
    ...at,
    appearance: { type: "humanoid", tunic: 0x6b1a1a, hair: 0x3a2a1a, skin: 0xd8a47a, gear: { head: "iron_helm", chest: "chainmail" } },
    role: "guard",
    shop: [],
    greeting,
  };
}

export const NPCS: Record<string, NpcDef> = {
  weaponsmith: {
    id: "weaponsmith",
    name: "Silahçı Kerem",
    ...TOWN_SPOTS.weaponsmith,
    appearance: { type: "humanoid", tunic: 0x8a2e2e, hair: 0x2d2d2d, skin: 0xd8a47a },
    role: "merchant",
    shop: ["iron_sword", "war_axe", "steel_sword", "sword_1", "axe_1", "oak_staff", "ash_staff", "staff_1", "mace_1"],
    greeting: "Kılıç mı, balta mı, asa mı? Bende hepsinden var. Ucuz değil ama sağlam.",
  },
  armorer: {
    id: "armorer",
    name: "Zırhçı Leyla",
    ...TOWN_SPOTS.armorer,
    appearance: { type: "humanoid", tunic: 0x3b5f8a, hair: 0x8b4513 },
    role: "merchant",
    shop: [
      "leather_cap",
      "leather_vest",
      "leather_pants",
      "worn_boots",
      "scale_vest",
      "iron_boots",
      "plate_head_1",
      "plate_chest_1",
      "plate_legs_1",
      "plate_feet_1",
      "robe_head_1",
      "robe_chest_1",
      "robe_legs_1",
      "robe_feet_1",
    ],
    greeting: "Savaşçıya plaka, büyücüye cübbe. Ölçünü söyle, gerisini ben hallederim.",
  },
  scribe: {
    id: "scribe",
    name: "Parşömenci Nuri",
    ...TOWN_SPOTS.scribe,
    appearance: { type: "humanoid", tunic: 0x6a4c93, hair: 0xe0e0e0 },
    role: "merchant",
    shop: ["upgrade_scroll_low", "upgrade_scroll_mid", "return_scroll"],
    greeting: "Parşömenlerim mürekkebi kurumadan satılır. Geri Dönüş Parşömeni'ni unutma; ormanda hayat kurtarır.",
  },
  alchemist: {
    id: "alchemist",
    name: "İksirci Zehra",
    ...TOWN_SPOTS.alchemist,
    appearance: { type: "humanoid", tunic: 0x2f7a4f, hair: 0x1a1a1a },
    role: "merchant",
    shop: ["minor_hp_potion", "hp_potion", "large_hp_potion", "super_hp_potion", "minor_mana_potion", "mana_potion", "large_mana_potion", "super_mana_potion"],
    greeting: "Kazanım hiç soğumaz. Balçık jölesi getirirsen sana daha iyilerini de yaparım.",
  },
  blacksmith: {
    id: "blacksmith",
    name: "Demirci Hasan",
    ...TOWN_SPOTS.blacksmith,
    appearance: { type: "humanoid", tunic: 0x4a3a30, hair: 0x2d2d2d, skin: 0xd8a47a },
    role: "blacksmith",
    shop: [],
    greeting: "Örsüm de ateşim de hazır. Parşömenini getir, eşyanı güçlendirelim. Ama unutma: ateş bazen yakar.",
  },
  jeweler: {
    id: "jeweler",
    name: "Kuyumcu Selin",
    ...TOWN_SPOTS.jeweler,
    appearance: { type: "humanoid", tunic: 0x8c6d1f, hair: 0xd9480f },
    role: "merchant",
    shop: ["copper_ring", "copper_necklace", "copper_earring", "silver_ring", "silver_necklace", "pearl_earring"],
    greeting: "Bir yüzük, bir kolye, bir küpe... Küçük ama savaşın kaderini değiştirir.",
  },
  commander: {
    id: "commander",
    name: "Komutan Baran",
    ...TOWN_SPOTS.commander,
    appearance: { type: "humanoid", tunic: 0x6b1a1a, hair: 0x5a3825, skin: 0xd8a47a, gear: { head: "iron_helm", chest: "chainmail" } },
    role: "quest",
    shop: [],
    greeting: "Kapıdan sağ salim girdin, iyi. Bu şehir son kalemiz; nöbetimizi tutacak kılıçlara ihtiyacımız var.",
  },
  sage: {
    id: "sage",
    name: "Bilge Ozan",
    ...TOWN_SPOTS.sage,
    appearance: { type: "humanoid", tunic: 0xe9ecef, hair: 0xf1f3f5, headwear: { color: 0xadb5bd, style: "hood" } },
    role: "quest",
    shop: [],
    greeting: "Çeşmenin sesi eskisi gibi değil evlat. Mühür kırıldığından beri su bile kederli akıyor.",
  },
  cook: {
    id: "cook",
    name: "Ayşe Teyze",
    ...TOWN_SPOTS.cook,
    appearance: { type: "humanoid", tunic: 0x9c3b5a, hair: 0xb8b8b8, skin: 0xe8b48a, headwear: { color: 0xe9d8a6, style: "hood" } },
    role: "quest",
    shop: [],
    greeting: "Gel evladım gel, otur şöyle! Surdaki nöbetçiler aç, ben de bu yaşta tek başıma yetişemiyorum.",
    fortuneTeller: true,
  },
  craftsman: {
    id: "craftsman",
    name: "Zanaatkâr Murat",
    ...TOWN_SPOTS.craftsman,
    appearance: { type: "humanoid", tunic: 0x6b4a2b, hair: 0x3a2a1a, skin: 0xd9a07a, gear: { chest: "leather_vest" } },
    role: "merchant",
    shop: ["miners_pickaxe", "herb_sickle"],
    greeting: "Toprak altında cevher, toprak üstünde şifa var evlat. Kılıçla değil, kazma ve orakla da ekmek kazanılır. Madencilik mi, Botanik mi? İkisini de öğretirim.",
  },
  storekeeper: {
    id: "storekeeper",
    name: "Depocu Hatice",
    ...TOWN_SPOTS.storekeeper,
    appearance: { type: "humanoid", tunic: 0x7a5c3a, hair: 0x4a3020, skin: 0xe0b088, headwear: { color: 0xc9b48a, style: "hood" } },
    role: "storage",
    shop: [],
    greeting: "Ambarım kuru, kilidim sağlam. Ne bırakırsan bıraktığın gibi bulursun; hem de kuruşu kuruşuna.",
  },
  fisherman: {
    id: "fisherman",
    name: "Balıkçı Rıfat",
    ...HARBOR_SPOTS.fisherman,
    appearance: { type: "humanoid", tunic: 0x2f6b8a, hair: 0x9a9a9a, skin: 0xc68a5a, headwear: { color: 0xc9b48a, style: "hat" } },
    role: "merchant",
    shop: ["fishing_rod", "minor_hp_potion", "minor_mana_potion"],
    greeting: "Olta al, iskelenin ucuna otur, gerisini deniz halleder. Şansın varsa ağına parşömen bile takılır; ben bir kere Altın Balık çıkardım, yemin ederim!",
  },
  guard_gate_north: guard("guard_gate_north", "Kapı Nöbetçisi Ali", TOWN_SPOTS.guardGateNorth, "Kapıdan geçen herkesi görürüm. Sen de temiz görünüyorsun, geç bakalım."),
  guard_gate_south: guard("guard_gate_south", "Kapı Nöbetçisi Veli", TOWN_SPOTS.guardGateSouth, "Hendekte timsah yok... galiba. Ben olsam yine de yüzmezdim."),
  guard_keep_west: guard("guard_keep_west", "Kale Muhafızı Emre", TOWN_SPOTS.guardKeepWest, "İç Kale'ye yalnızca Komutan'ın izniyle girilir. Mühür kırıldığından beri kapı hiç açılmadı."),
  guard_keep_east: guard("guard_keep_east", "Kale Muhafızı Kaan", TOWN_SPOTS.guardKeepEast, "Surlarda gece nöbeti tutuyoruz. Ormandan gelen ışıkları gören olursa Komutan'a haber versin."),
  hunter: {
    id: "hunter",
    name: "Avcı Ayla",
    ...valley(35, 21),
    appearance: { type: "humanoid", tunic: 0x2f6b3a, hair: 0x8b4513, gear: { legs: "wolf_hide_leggings" } },
    role: "quest",
    shop: [],
    greeting: "Vadide yaratıklar her gün çoğalıyor. Yayımı gerersem bir tane düşer, beş tane gelir.",
  },
  ranger: {
    id: "ranger",
    name: "Orman Bekçisi Tarık",
    ...FOREST_SPOTS.ranger,
    appearance: { type: "humanoid", tunic: 0x1e3d22, hair: 0x2d2d2d, skin: 0xc68a5a, gear: { chest: "leather_vest", legs: "leather_pants" } },
    role: "quest",
    shop: [],
    greeting: "Sessiz ol. Bu orman dinler... ve hatırlar. Kara Murat'ın adamları her gece biraz daha yaklaşıyor.",
  },
  peddler: {
    id: "peddler",
    name: "Gezgin Tüccar Rıza",
    ...FOREST_SPOTS.peddler,
    appearance: { type: "humanoid", tunic: 0x8a6d3b, hair: 0x6b6b6b },
    role: "merchant",
    shop: ["large_hp_potion", "large_mana_potion", "hp_potion", "mana_potion", "return_scroll", "upgrade_scroll_low"],
    greeting: "Ormanın ortasında tüccar mı dedin? Kâr nerede, Rıza orada!",
  },
};

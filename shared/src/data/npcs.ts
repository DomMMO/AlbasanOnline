import { CANYON_SPOTS } from "../canyon";
import { FOREST_SPOTS } from "../forest";
import { FROST_SPOTS } from "../frost";
import { HARBOR_SPOTS } from "../harbor";
import { KEEP_HALL_SPOTS } from "../keepHall";
import { TOWN_SPOTS } from "../town";
import { VOLCANO_SPOTS } from "../volcano";
import type { Appearance } from "./appearance";
import type { ClassId } from "./classes";

export interface NpcDef {
  id: string;
  name: string;
  /** Feet position in pixels. */
  x: number;
  y: number;
  appearance: Appearance;
  /**
   * quest = only gives quests and talks. storage = keeps your items (depo). guard = greets
   * and gives directions round town. master = a class master who hands out advice.
   */
  role: "merchant" | "blacksmith" | "quest" | "storage" | "guard" | "master" | "stable";
  /** Item ids for sale; prices come from ItemDef.buyPrice. */
  shop: string[];
  /** First line of the conversation window. */
  greeting: string;
  /** Reads the player's coffee-cup fortune once a day (see fortune.ts). */
  fortuneTeller?: boolean;
  /** Sits (on a stool) instead of standing. */
  seated?: boolean;
  /** Which way they look (default: down, towards the camera). */
  facing?: "up" | "down" | "left" | "right";
  /** Masters: words of advice, one picked at random each time you ask. */
  advice?: string[];
  /** Masters: the class a novice can choose from them. */
  teaches?: ClassId;
}

/** Feet position of an NPC in the hunting grounds (valley map tiles). */
const valley = (tx: number, ty: number) => ({ x: (tx + 0.5) * 16, y: (ty + 1) * 16 });

// Which zone an NPC stands in is decided by ZoneDef.npcs.

/** A town guard in mail with a helmet; talking to one gets its line and directions (data/directions.ts). */
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

/** A class master sitting by the fire in the keep's great hall; novices choose their class here. */
function master(
  cls: keyof typeof KEEP_HALL_SPOTS.seats,
  name: string,
  appearance: Appearance,
  greeting: string,
  advice: string[],
): NpcDef {
  const { x, y, facing } = KEEP_HALL_SPOTS.seats[cls];
  return { id: `master_${cls}`, name, x, y, facing, seated: true, appearance, role: "master", shop: [], greeting, advice, teaches: cls };
}

export const NPCS: Record<string, NpcDef> = {
  weaponsmith: {
    id: "weaponsmith",
    name: "Silahçı Kerem",
    ...TOWN_SPOTS.weaponsmith,
    appearance: { type: "humanoid", tunic: 0x8a2e2e, hair: 0x2d2d2d, skin: 0xd8a47a },
    role: "merchant",
    shop: ["rusty_sword", "short_bow", "apprentice_staff", "iron_sword", "war_axe", "steel_sword", "sword_1", "axe_1", "hunting_bow", "yew_bow", "bow_1", "oak_staff", "ash_staff", "staff_1", "mace_1"],
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
  stable_master: {
    id: "stable_master",
    name: "Seyis Yusuf",
    ...TOWN_SPOTS.stableMaster,
    appearance: { type: "humanoid", tunic: 0x6b4a2b, hair: 0x8a8a8a, skin: 0xc68a5a, gear: { chest: "leather_vest", legs: "leather_pants" }, headwear: { color: 0x8a6a3a, style: "hat" } },
    role: "stable",
    shop: [],
    greeting:
      "Hoş geldin yiğidim! Bu çiftlikte bozkırın en iyi atları büyür. Pahalı mı? Pahalı. Ama Kara Yel'in sırtında rüzgârı geride bıraktığında parayı hatırlamazsın bile.",
  },
  guard_gate_north: guard("guard_gate_north", "Kapı Nöbetçisi Ali", TOWN_SPOTS.guardGateNorth, "Kapıdan geçen herkesi görürüm. Sen de temiz görünüyorsun, geç bakalım."),
  guard_gate_south: guard("guard_gate_south", "Kapı Nöbetçisi Veli", TOWN_SPOTS.guardGateSouth, "Surun dışı uçurum, altı bulut. Kenara yaklaşma, aşağı düşen bir daha geri tırmanamıyor... galiba."),
  guard_keep_west: guard("guard_keep_west", "Kale Muhafızı Emre", TOWN_SPOTS.guardKeepWest, "Kalenin kapısı herkese açık; yedi usta içeride, ateşin başında. Yolunu seçmediysen önce onlara git. Bir yer arıyorsan sor, tarif edeyim."),
  guard_keep_east: guard("guard_keep_east", "Kale Muhafızı Kaan", TOWN_SPOTS.guardKeepEast, "Surlarda gece nöbeti tutuyoruz. Ormandan gelen ışıkları gören olursa Komutan'a haber versin."),
  guard_hall_west: guard("guard_hall_west", "Salon Muhafızı Oğuz", KEEP_HALL_SPOTS.guardWest, "Ustaların sözü dinlenir, sesi yükseltilmez. Şehirde bir yer arıyorsan bana sor."),
  guard_hall_east: guard("guard_hall_east", "Salon Muhafızı Selim", KEEP_HALL_SPOTS.guardEast, "Ateş hiç sönmez burada. Sönerse kale düşer derler. Nereye gideceksin?"),

  master_warrior: master(
    "warrior",
    "Alp",
    { type: "humanoid", tunic: 0x8a2e2e, hair: 0x6b6b6b, skin: 0xd8a47a, gear: { chest: "chainmail" } },
    "Otur bakalım. Kılıcı tutmak kolay; asıl iş, düştüğünde yeniden kaldırmaktır. Alplerin yolu öndedir, kalkanın arkası değil.",
    [
      "Öfken boş kalmasın: vurdukça dolar, dolunca harca. Saklanan öfke bir işe yaramaz.",
      "Kalabalığa dalacaksan önce Girdap'ı, sonra Sıçrayış'ı düşün.",
      "Silahını demirciye götür, ama parşömenini esirgeme. +7'den sonrası yürek ister.",
      "Gece yaratıkları daha güçlüdür ama daha çok da verir. Korkak alpin cebi boş kalır.",
    ],
  ),
  master_shaman: master(
    "shaman",
    "Kam",
    { type: "humanoid", tunic: 0x1c4a7a, hair: 0x2d2d2d, skin: 0xc68a5a, headwear: { color: 0x5a3825, style: "hat" } },
    "Davulumu duydun mu? Gök Tengri konuşuyor evlat. Kamın yolu göğe ve atalara açılır; şimşeği indirir, ruhu çağırır.",
    [
      "Gök Kamçısı büyü ister; adım attığın an sözcükler dağılır.",
      "Davulunu kalabalığın ortasında döv, gök gürlesin.",
      "Ata Ruhu yalnız seni değil, yanındakini de iyileştirir. Grubunu unutma.",
      "Rüzgâr senin atındır: Yel Yürüyüşü ile kaçarsın, Yel Yürüyüşü ile yetişirsin.",
    ],
  ),
  master_rogue: master(
    "rogue",
    "Börü",
    { type: "humanoid", tunic: 0x2b2b33, hair: 0x6b6b6b, skin: 0xc68a5a, headwear: { color: 0x495057, style: "hood" } },
    "...Beni fark ettin demek. Fena değil. Çoğu kişi ateşi görür, kurdu görmez. Börünün yolu gölgededir.",
    [
      "İlk darbe her şeydir. Arkasından vur, yüzleşme.",
      "Enerjin dolarken bekle; aceleyle vurulan bıçak kınına erken döner.",
      "Kaçmak ayıp değildir. Ölmek ayıptır.",
      "Kara Orman'da Kara Murat'ın adamları gece dolaşır. Onları sen görmeden onlar seni görmesin.",
    ],
  ),
  master_archer: master(
    "archer",
    "Tigin",
    { type: "humanoid", tunic: 0x2b5422, hair: 0x8b4513, skin: 0xd9a07a, gear: { chest: "leather_vest" }, headwear: { color: 0x2b5422, style: "hood" } },
    "Bozkırda büyüdüm; at sırtında yayı germeyi yürümeden önce öğrendim. Tiginin yolu uzaktan vurmaktır, yakına gelmeden bitirmek.",
    [
      "Nişanlı Atış'ı düşman sana ulaşmadan at; ikinci oku Seri Atış'la gönder.",
      "Ok Yağmuru'nu sürünün ortasına bırak, kenarına değil.",
      "Biri sana çok yaklaştıysa Çivileyen Ok ile yere çivile, sonra Doğan Sıçrayışı ile uzaklaş.",
      "Yayının kirişini demirciye de götürebilirsin. Güçlü yay, güçlü ok demektir.",
    ],
  ),
  master_druid: master(
    "druid",
    "Erşek",
    { type: "humanoid", tunic: 0x5c4a2a, hair: 0xd8d8d8, skin: 0xc68a5a, headwear: { color: 0x2f6b3a, style: "hood" } },
    "Ağaçların dilini bilir misin? Bilmezsin elbet. Ben de bilmezdim; sonra orman benimle konuştu. Erşeğin yolu yeşildir.",
    [
      "Sarmaşık seni kuşatanları yerinde tutar; sonra Diken Kırbacı'nı rahatça savurursun.",
      "Ağaç Kabuğu'nu darbeler gelmeden giy; geldikten sonra geç kalırsın.",
      "Bahar Dalgası hem vurur hem iyileştirir. Grubun ortasında patlat.",
      "Orman seni korur ama gece Kara Orman'ın kendisi bile korkar.",
    ],
  ),
  master_priest: master(
    "priest",
    "Ak Ana",
    { type: "humanoid", tunic: 0xf1f3f5, hair: 0xf8f9fa, skin: 0xe8b48a, gender: "female", hairStyle: "long", headwear: { color: 0xe9ecef, style: "hood" } },
    "Gel yavrum, ısın. Ak Ana'nın yolu arındırmak ve kutsamaktır: yarayı sarar, kötülüğü ışıkla yakar.",
    [
      "Herkesi iyileştirmeye çalışma; önce düşmanın vurduğunu iyileştir.",
      "Koruyucu Kalkan bir şifadan ucuzdur. Darbeyi gelmeden karşıla.",
      "Şifacı ölürse grup da ölür. Kendi canını unutma.",
      "Manan azaldıysa savaştan önce iç; ortasında içmeye fırsat bulamazsın.",
    ],
  ),
  master_necromancer: master(
    "necromancer",
    "Erlik Ruh Eğitmeni",
    { type: "humanoid", tunic: 0x1f2b22, hair: 0x2d2d2d, skin: 0xb8b8a0, headwear: { color: 0x1f2b22, style: "hood" } },
    "Diğerleri bana tuhaf bakar. Oysa yeraltı da gök kadar eskidir; Erlik'in ruhları da ataların kadar konuşur. Dinlemeye hazır mısın?",
    [
      "İskeletlerin senin kalkanındır. Önlerine geç, arkalarında dur.",
      "Ruh Emme ile vur, canın azaldıkça daha çok em.",
      "Dehşet'i önce en güçlüsüne sal. Zayıflar zaten düşer.",
    ],
  ),

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

  // ---- Kızıl Kanyon: the caravan stop at the valley gate.
  caravan_master: {
    id: "caravan_master",
    name: "Kervancı Hasan",
    ...CANYON_SPOTS.caravanMaster,
    appearance: { type: "humanoid", tunic: 0xb5835a, hair: 0x2d2d2d, skin: 0xc68a5a, headwear: { color: 0xe8dcc0, style: "hood" } },
    role: "merchant",
    shop: ["super_hp_potion", "super_mana_potion", "large_hp_potion", "large_mana_potion", "return_scroll", "upgrade_scroll_low", "upgrade_scroll_mid"],
    greeting: "Kervan üç gündür gelmedi, mallar bende kaldı. Ucuz veririm, yeter ki sırtlanlara kalmasın.",
  },
  canyon_scout: {
    id: "canyon_scout",
    name: "Akıncı İzcisi Gökhan",
    ...CANYON_SPOTS.scout,
    appearance: { type: "humanoid", tunic: 0x5a1a10, hair: 0x1a1a1a, skin: 0xc68a5a, gear: { chest: "leather_vest", legs: "leather_pants" } },
    role: "quest",
    shop: [],
    greeting:
      "Bir zamanlar ben de Kara Toygar'ın akıncılarındandım. Kuzeybatıdaki ordugâhında oturur; yanına tek başına gitme. Batı yamacındaki Kızıl Mağaralar gnolların yuvası, kuzeyde kumun altındaki kervansaraydan ise dönen pek olmadı.",
  },

  // ---- Ayaz Dağları: the hunters' shelter at the valley gate.
  furrier: {
    id: "furrier",
    name: "Kürkçü Oğuz",
    ...FROST_SPOTS.furrier,
    appearance: { type: "humanoid", tunic: 0x6b4a2b, hair: 0x8b4513, skin: 0xe0b088, gear: { chest: "leather_vest", legs: "wolf_hide_leggings" } },
    role: "merchant",
    shop: ["super_hp_potion", "super_mana_potion", "return_scroll", "upgrade_scroll_low", "upgrade_scroll_mid"],
    greeting: "Yeti postu getirirsen iyi para veririm. Önce şu iksirlerden al; dağ, hazırlıksız geleni sevmez.",
  },
  mountain_guide: {
    id: "mountain_guide",
    name: "Dağ Rehberi Batu",
    ...FROST_SPOTS.guide,
    appearance: { type: "humanoid", tunic: 0x3b5bdb, hair: 0xf1f3f5, skin: 0xd8a47a, gear: { head: "leather_cap", chest: "leather_vest" } },
    role: "quest",
    shop: [],
    greeting:
      "Doğuda buzdan bir taht var; Buz Devi Ayazhan orada oturur, yaklaşanı ezer. Kuzeydoğudaki Buz Mağarası'nda kristaller şarkı söyler derler, güneydoğudaki Ayaz Kalesi'nde ise Kış Kralı Ulukan hüküm sürer. Gece olunca Ak Börüler iner, ateşten uzaklaşma.",
  },

  // ---- Kor Toprakları: the outpost at the valley gate.
  ember_trader: {
    id: "ember_trader",
    name: "Közcü Necmi",
    ...VOLCANO_SPOTS.trader,
    appearance: { type: "humanoid", tunic: 0x5c3a1e, hair: 0x2d2d2d, skin: 0xc68a5a, gear: { chest: "leather_vest" }, headwear: { color: 0x7a0a0a, style: "hood" } },
    role: "merchant",
    shop: ["super_hp_potion", "super_mana_potion", "return_scroll", "upgrade_scroll_low", "upgrade_scroll_mid"],
    greeting: "Burada her şey yanar, bir benim tezgâhım yanmaz. Obsidyen getirirsen altınla öderim.",
  },
  ash_sentinel: {
    id: "ash_sentinel",
    name: "Kül Gözcüsü Ilgaz",
    ...VOLCANO_SPOTS.sentinel,
    appearance: { type: "humanoid", tunic: 0x343a40, hair: 0x1a1a1a, skin: 0xd8a47a, gear: { head: "iron_helm", chest: "chainmail" } },
    role: "quest",
    shop: [],
    greeting:
      "Lav nehrini üç köprüden geçebilirsin, başka yolu yok. Güneybatıdaki kor kazanında Kor Devi Ateşhan uyur; uyanırsa kaç. Doğudaki Magma Ocakları'nda cüceler hâlâ örs döver, batıdaki Kül Tapınağı'nda ise Ateş Ejderi Közhan'a tapıyorlar.",
  },
};

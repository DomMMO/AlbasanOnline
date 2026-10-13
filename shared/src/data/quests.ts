import type { ClassId } from "./classes";

// Quests and the story they tell ("Kırık Mühür"). Quests come in chains: each one
// needs the previous one done. Objectives are kills (counted on the server, shared
// with party members near the kill) and items to collect (counted from the
// inventory and taken at turn-in). A quest with no objectives is a "go and talk to"
// errand: it completes at the turn-in NPC. Repeatable quests can be taken again.

export type QuestObjective =
  | { type: "kill"; mobs: string[]; count: number; label: string }
  | { type: "collect"; item: string; count: number };

export interface QuestRewardItem {
  item: string;
  qty?: number;
}

export interface QuestReward {
  xp: number;
  gold: number;
  items?: QuestRewardItem[];
  /** Extra items depending on the player's class (weapons, armour). */
  classItems?: Partial<Record<ClassId, QuestRewardItem[]>>;
}

export interface QuestDef {
  id: string;
  /** Chain name shown in the quest log. */
  chain: string;
  title: string;
  giver: string;
  turnIn: string;
  minLevel: number;
  /** Quest that must be completed first. */
  requires?: string;
  repeatable?: boolean;
  /** What the giver says when offering it. */
  text: string;
  /** What the turn-in NPC says while it isn't finished yet. */
  progressText?: string;
  /** What the turn-in NPC says when you complete it. */
  completeText: string;
  objectives: QuestObjective[];
  reward: QuestReward;
}

export const MAX_ACTIVE_QUESTS = 15;

const kill = (mobs: string | string[], count: number, label: string): QuestObjective => ({
  type: "kill",
  mobs: Array.isArray(mobs) ? mobs : [mobs],
  count,
  label,
});
const collect = (item: string, count: number): QuestObjective => ({ type: "collect", item, count });

const MAIN = "Kırık Mühür";
const FOREST = "Kara Orman";
const DAILY = "Tekrarlanabilir";
const DINNER = "Akşam Yemeği";
const CRAFTS = "Meslekler";

const QUEST_LIST: QuestDef[] = [
  // ---- Chapter 1: the valley -------------------------------------------------------
  {
    id: "m1_stranger",
    chain: MAIN,
    title: "Kapıdaki Yabancı",
    giver: "commander",
    turnIn: "sage",
    minLevel: 1,
    text: "Yeni bir yüz... Uzun zamandır bu kapıdan kimse girmemişti. Bu diyar eskisi gibi değil yabancı. Nedenini en iyi Bilge Ozan anlatır; onu meydandaki çeşmenin başında bulursun.",
    completeText:
      "Demek Baran seni gönderdi. Otur, dinle. Yüzyıllar önce Gölge Efendisi Moraz bu toprakları karanlığa boğmuştu. Atalarımız onu Altın Mühür ile yerin altına zincirledi. Ama mühür kırıldı evlat... Parçaları diyara saçıldı ve gölge sızmaya başladı. Balçıklar, kurtlar, goblinler: hepsi o gölgenin çağrısıyla azgınlaştı.",
    objectives: [],
    reward: { xp: 50, gold: 10, items: [{ item: "minor_hp_potion", qty: 3 }, { item: "return_scroll" }] },
  },
  {
    id: "m2_hunter",
    chain: MAIN,
    title: "Vadideki Avcı",
    giver: "sage",
    turnIn: "hunter",
    minLevel: 1,
    requires: "m1_stranger",
    text: "Mühürün parçalarını aramadan önce gücünü sınamalısın. Şehrin doğu kapısından çık; yolun sonundaki ışınlanma kapısı seni Başlangıç Vadisi'ne götürür. Avcı Ayla orada nöbet tutuyor. Ona yardım et; vadiyi en iyi o tanır.",
    completeText: "Ozan mı gönderdi? İyi. Burada iki el, bir yaydan iyidir. Gel, sana yapılacak işi göstereyim.",
    objectives: [],
    reward: { xp: 60, gold: 10 },
  },
  {
    id: "m3_slimes",
    chain: MAIN,
    title: "Balçık Temizliği",
    giver: "hunter",
    turnIn: "hunter",
    minLevel: 1,
    requires: "m2_hunter",
    text: "Şu yeşil balçıklar eskiden zararsızdı. Şimdi çoğalıp tarlaları yiyorlar. Kavşağın kuzeybatısında ve güneydoğusunda kaynıyorlar. 8 tanesini temizle de nefes alalım.",
    progressText: "Balçıklar hâlâ kaynıyor. Kılıcını konuştur!",
    completeText: "Fena değil! Al şu yüzüğü; babamdan kalma ama sende daha çok işe yarar.",
    objectives: [kill("slime", 8, "Balçık")],
    reward: { xp: 150, gold: 20, items: [{ item: "copper_ring" }] },
  },
  {
    id: "m4_gel",
    chain: MAIN,
    title: "Şifalı Jöle",
    giver: "hunter",
    turnIn: "alchemist",
    minLevel: 2,
    requires: "m3_slimes",
    text: "İksirci Zehra balçık jölesinden iksir yapıyor; şehrin yaralılarına lazım. 6 Balçık Jölesi topla ve ona götür. Dükkânı şehrin kuzey caddesinde, yeşil çatılı olan.",
    progressText: "Jöle olmadan kazanım boş kalır. 6 tane lazım canım.",
    completeText: "Ooo, taze jöle! Bunlardan bir kazan iksir çıkar. Bunlar da senin, yolda lazım olur.",
    objectives: [collect("slime_gel", 6)],
    reward: { xp: 150, gold: 15, items: [{ item: "minor_hp_potion", qty: 5 }, { item: "minor_mana_potion", qty: 5 }] },
  },
  {
    id: "m5_wolves",
    chain: MAIN,
    title: "Kurt Sürüsü",
    giver: "hunter",
    turnIn: "hunter",
    minLevel: 3,
    requires: "m4_gel",
    text: "Kuzeydoğudaki gri kurtların gözleri kızıl yanıyor; gölgenin işareti bu. Sürüyü dağıtmak lazım. 10 Gri Kurt avla. Dikkat et, sürü halinde saldırırlar.",
    progressText: "Ulumaları hâlâ duyuluyor.",
    completeText: "Sürü dağıldı, köylüler rahat uyuyacak. Bu silahı şehrin silahçısından senin için aldım.",
    objectives: [kill("wolf", 10, "Gri Kurt")],
    reward: {
      xp: 400,
      gold: 40,
      classItems: { warrior: [{ item: "iron_sword" }], mage: [{ item: "oak_staff" }], priest: [{ item: "oak_staff" }] },
    },
  },
  {
    id: "m6_pelts",
    chain: MAIN,
    title: "Postlar ve Zırhlar",
    giver: "hunter",
    turnIn: "armorer",
    minLevel: 3,
    requires: "m5_wolves",
    text: "Kurt postu iyi zırh olur. 6 Kurt Postu topla ve Zırhçı Leyla'ya götür; karşılığında sana bir şeyler diker.",
    progressText: "Post getirmeden zırh dikemem tatlım.",
    completeText: "Kaliteli postlar! İşte sana bir tozluk, bir de küpe; ikisi de kurt kadar dayanıklı.",
    objectives: [collect("wolf_pelt", 6)],
    reward: { xp: 300, gold: 20, items: [{ item: "wolf_hide_leggings" }, { item: "copper_earring" }] },
  },
  {
    id: "m7_goblins",
    chain: MAIN,
    title: "Goblin Tehdidi",
    giver: "hunter",
    turnIn: "hunter",
    minLevel: 5,
    requires: "m6_pelts",
    text: "Asıl dert güneybatıda. Goblinler mağaralarından çıkıp yağmaya başladı; başlarında Grukk diye bir şef varmış. Önce askerlerini azalt: 12 Goblin Yağmacı.",
    progressText: "Goblinler hâlâ köyleri yağmalıyor!",
    completeText: "Goblinler geri çekildi! Bunu bir goblinin elinden aldım; sende daha iyi durur.",
    objectives: [kill("goblin", 12, "Goblin Yağmacı")],
    reward: {
      xp: 900,
      gold: 60,
      classItems: { warrior: [{ item: "goblin_cleaver" }], mage: [{ item: "seer_staff" }], priest: [{ item: "seer_staff" }] },
    },
  },
  {
    id: "m8_ears",
    chain: MAIN,
    title: "Kulak Kanıtı",
    giver: "hunter",
    turnIn: "commander",
    minLevel: 5,
    requires: "m7_goblins",
    text: "Komutan Baran asker göndermeden önce kanıt ister. 10 Goblin Kulağı topla ve ona götür. Evet, iğrenç biliyorum.",
    progressText: "Kanıt getirmeden kimseye asker veremem.",
    completeText: "On kulak! Ayla seni boşuna övmemiş. Bu parşömenler demircide işine yarar; kolye de benden.",
    objectives: [collect("goblin_ear", 10)],
    reward: { xp: 600, gold: 100, items: [{ item: "upgrade_scroll_mid", qty: 2 }, { item: "copper_necklace" }] },
  },
  {
    id: "m9_grukk",
    chain: MAIN,
    title: "Şefin Sonu",
    giver: "commander",
    turnIn: "commander",
    minLevel: 6,
    requires: "m8_ears",
    text: "Goblinlerin başı Grukk, vadinin güneybatısındaki mağarada saklanıyor. Mağaranın en dibinde, arenasında bekliyor. Yere vurduğunda kızıl bir halka belirir; içinde kalma! Gerekirse yanına arkadaş al.",
    progressText: "Grukk yaşadıkça goblinler durmaz.",
    completeText: "Grukk öldü mü? Gerçekten mi? Şehir sana borçlu. Bu tılsım demircide eşyanı yanmaktan korur; iyi sakla.",
    objectives: [kill("goblin_chief", 1, "Goblin Şefi Grukk")],
    reward: { xp: 1500, gold: 150, items: [{ item: "protection_charm" }] },
  },
  {
    id: "m10_jack",
    chain: MAIN,
    title: "Mahzendeki Lanet",
    giver: "commander",
    turnIn: "sage",
    minLevel: 8,
    requires: "m9_grukk",
    text: "Mağaradan dönenler Grukk'un arenasının dibinde turuncu bir portal gördüklerini söylüyor. Ozan'a göre ötesinde lanetli bir mahzen ve Kabak Jack denen bir şey var. Mühür parçalarından biri orada olabilir. Jack'i yen, ne bulursan Ozan'a götür.",
    progressText: "Mahzenin laneti hâlâ hissediliyor...",
    completeText:
      "Bu ışıltı... Mühür Parçası! Jack bunu yıllardır içinde saklıyormuş; onu canavara çeviren de bu parçanın gücüymüş. Parçayı sen sakla evlat; ben taşırsam gölge beni bulur. Ama bir parça yetmez. Kara Orman'dan kötü haberler geliyor...",
    objectives: [kill("pumpkin_jack", 1, "Kabak Jack")],
    reward: { xp: 2500, gold: 200, items: [{ item: "silver_necklace" }, { item: "return_scroll", qty: 3 }] },
  },
  {
    id: "m11_forest",
    chain: MAIN,
    title: "Kara Orman'a Yolculuk",
    giver: "sage",
    turnIn: "ranger",
    minLevel: 9,
    requires: "m10_jack",
    text: "Vadinin kuzey ucundaki ışınlanma kapısı Kara Orman'a açılır. Orman Bekçisi Tarık'ın haberine göre Haydut Reisi Kara Murat ikinci bir parça bulmuş ve onunla adamlarını güçlendiriyor. Tarık'ı bul; o sana yol gösterir.",
    completeText: "Ozan'ın elçisi demek. Bu ormanda tek başına yürüyen ya çok cesurdur ya çok aptal. Bakalım sen hangisisin.",
    objectives: [],
    reward: { xp: 500, gold: 30, items: [{ item: "large_hp_potion", qty: 5 }] },
  },

  // ---- Chapter 2: the Dark Forest --------------------------------------------------
  {
    id: "f1_dark_wolves",
    chain: FOREST,
    title: "Kara Kurtlar",
    giver: "ranger",
    turnIn: "ranger",
    minLevel: 10,
    requires: "m11_forest",
    text: "Kampın kuzeydoğusundaki kara kurtlar gölgeyle beslenir; sıradan kurtlardan iki kat güçlüdür. 15 tanesini avla, sonra konuşuruz.",
    progressText: "Kurtlar hâlâ kampın çevresinde dolanıyor.",
    completeText: "Hâlâ ayaktasın, iyi. Şu zırhı kampta saklıyordum; senin gibisine yakışır.",
    objectives: [kill("dark_wolf", 15, "Kara Kurt")],
    reward: {
      xp: 2000,
      gold: 80,
      classItems: { warrior: [{ item: "plate_chest_1" }], mage: [{ item: "robe_chest_1" }], priest: [{ item: "robe_chest_1" }] },
    },
  },
  {
    id: "f2_swamp",
    chain: FOREST,
    title: "Zehirli Bataklık",
    giver: "ranger",
    turnIn: "ranger",
    minLevel: 11,
    requires: "f1_dark_wolves",
    text: "Batıdaki bataklıkta zehir balçıkları türedi; suyu zehirliyorlar. 12 tanesini yok et ve 8 Zehir Kesesi getir. Keseleri Zehra panzehire çevirecek.",
    progressText: "Bataklık hâlâ zehir kokuyor.",
    completeText: "Keseler sağlam. Zehra'ya yollarım. Bu iksirler ve başlık da senin.",
    objectives: [kill("poison_slime", 12, "Zehir Balçığı"), collect("poison_sac", 8)],
    reward: {
      xp: 2400,
      gold: 80,
      items: [{ item: "large_hp_potion", qty: 5 }, { item: "large_mana_potion", qty: 5 }],
      classItems: { warrior: [{ item: "plate_head_1" }], mage: [{ item: "robe_head_1" }], priest: [{ item: "robe_head_1" }] },
    },
  },
  {
    id: "f3_bandits",
    chain: FOREST,
    title: "Haydut Avı",
    giver: "ranger",
    turnIn: "ranger",
    minLevel: 12,
    requires: "f2_swamp",
    text: "Kara Murat'ın haydutları kuzeydoğudaki kamplarında. Parça yüzünden hepsi delirmiş gibi saldırıyor. 15 Haydut temizle.",
    progressText: "Haydutların ateşi hâlâ yanıyor.",
    completeText: "Kampın bir yanını boşalttın! Bu altın yüzük bir hayduttan çıktı; artık senin.",
    objectives: [kill("bandit", 15, "Haydut")],
    reward: { xp: 3000, gold: 120, items: [{ item: "gold_ring" }] },
  },
  {
    id: "f4_badges",
    chain: FOREST,
    title: "Nişanlar Komutana",
    giver: "ranger",
    turnIn: "commander",
    minLevel: 12,
    requires: "f3_bandits",
    text: "Haydutlar boyunlarında bir nişan taşıyor: Kara Murat'ın işareti. 10 Haydut Nişanı topla ve Komutan Baran'a götür. Şehir surları da tehlikede olabilir; bilmeli.",
    progressText: "Nişanlar olmadan şehrin konseyine bir şey kanıtlayamam.",
    completeText: "Bu nişanlar... Kara Murat şehre de casus sokmuş demek. Nöbeti iki katına çıkaracağım. Bu parşömenler ve altın hak ettiğin ödül.",
    objectives: [collect("bandit_badge", 10)],
    reward: { xp: 2000, gold: 300, items: [{ item: "upgrade_scroll_mid", qty: 3 }] },
  },
  {
    id: "f5_undead",
    chain: FOREST,
    title: "Huzursuz Ölüler",
    giver: "ranger",
    turnIn: "ranger",
    minLevel: 14,
    requires: "f4_badges",
    text: "Kuzeybatıdaki eski mezarlıkta ölüler kalkmış. Mühür parçasının gücü onları uyandırıyor. 15 İskelet Savaşçı yok et ve 10 Kemik Tozu getir; Ozan onlarla bir koruma büyüsü yapacak.",
    progressText: "Mezarlıktan hâlâ kemik sesleri geliyor.",
    completeText: "Mezarlık sustu. Bu silah eski bir şövalyenin mezarındaydı; onun da isteği bu olurdu.",
    objectives: [kill("skeleton", 15, "İskelet Savaşçı"), collect("bone_dust", 10)],
    reward: {
      xp: 4000,
      gold: 150,
      classItems: { warrior: [{ item: "sword_2" }], mage: [{ item: "staff_2" }], priest: [{ item: "mace_2" }] },
    },
  },
  {
    id: "f6_orcs",
    chain: FOREST,
    title: "Ork Oyuğu",
    giver: "ranger",
    turnIn: "ranger",
    minLevel: 16,
    requires: "f5_undead",
    text: "Güneybatıdaki oyukta orklar toplandı; Kara Murat onlara altın veriyor. 15 Ork Yağmacı öldür, anlaşmaları bozulsun.",
    progressText: "Orkların savaş davulu hâlâ duyuluyor.",
    completeText: "Ork davulları sustu! Al bunları; bir ork şefinin hazinesinden.",
    objectives: [kill("orc", 15, "Ork Yağmacı")],
    reward: {
      xp: 5000,
      gold: 200,
      items: [{ item: "emerald_earring" }],
      classItems: { warrior: [{ item: "plate_legs_3" }], mage: [{ item: "robe_legs_3" }], priest: [{ item: "robe_legs_3" }] },
    },
  },
  {
    id: "f7_bears",
    chain: FOREST,
    title: "Boz Ayının İni",
    giver: "ranger",
    turnIn: "ranger",
    minLevel: 17,
    requires: "f6_orcs",
    text: "Doğudaki inde dev boz ayılar uyandı; bir tanesi iki adamımı yaraladı. 3 Boz Ayı'yı yere ser. Tek başına zor, yanına birilerini al.",
    progressText: "Ayıların kükremesi kampa kadar geliyor.",
    completeText: "Üç dev ayı! Hikâyesi kamp ateşinde yıllarca anlatılır. Şu çizmeler ve iksirler seni Kara Murat'a hazırlar.",
    objectives: [kill("dire_bear", 3, "Boz Ayı")],
    reward: {
      xp: 5000,
      gold: 200,
      items: [{ item: "super_hp_potion", qty: 5 }],
      classItems: { warrior: [{ item: "plate_feet_3" }], mage: [{ item: "robe_feet_3" }], priest: [{ item: "robe_feet_3" }] },
    },
  },
  {
    id: "f8_murat",
    chain: FOREST,
    title: "Haydut Reisi Kara Murat",
    giver: "ranger",
    turnIn: "ranger",
    minLevel: 18,
    requires: "f7_bears",
    text: "Vakit geldi. Kara Murat haydut kampının kuzeyinde, büyük çadırların önünde. Mühür parçası onu devleştirdi: yere vurur, üstüne koşar, adamlarını çağırır. Grubunu topla ve onu indir. Parçayı da al!",
    progressText: "Kara Murat yaşadıkça bu orman nefes alamaz.",
    completeText: "Kara Murat düştü! Parçayı aldın mı? Güzel. Bu silah ve parşömen senin. Şimdi doğruca Ozan'a git.",
    objectives: [kill("bandit_chief", 1, "Kara Murat")],
    reward: {
      xp: 8000,
      gold: 500,
      items: [{ item: "upgrade_scroll_high" }],
      classItems: { warrior: [{ item: "sword_4" }], mage: [{ item: "staff_4" }], priest: [{ item: "mace_4" }] },
    },
  },
  {
    id: "f9_two_pieces",
    chain: MAIN,
    title: "İki Parça",
    giver: "ranger",
    turnIn: "sage",
    minLevel: 18,
    requires: "f8_murat",
    text: "Elinde iki mühür parçası var: biri Jack'ten, biri Kara Murat'tan. Onları Bilge Ozan'a götür; ne yapılacağını o bilir.",
    progressText: "İki parça lazım evlat; biri Jack'ten, biri Kara Murat'tan.",
    completeText:
      "İki parça bir araya geldiğinde nasıl parladığını gördün mü? Mühür bizi hatırlıyor! Ama üçüncü parça... onu Ejder Sırtı'nda, kızıl ejderin yuvasında hissediyorum. Oraya giden yol henüz kapalı. O gün geldiğinde hazır ol. Bu kolye parçaların ışığıyla dövüldü; seni gölgeden korusun.",
    objectives: [collect("seal_fragment", 2)],
    reward: { xp: 10000, gold: 1000, items: [{ item: "seal_necklace" }, { item: "protection_charm", qty: 2 }] },
  },

  // ---- Ayşe Teyze's dinner (a nod to Metin2's famous dinner quest) -----------------
  {
    id: "d1_dinner",
    chain: DINNER,
    title: "Akşam Yemeği",
    giver: "cook",
    turnIn: "cook",
    minLevel: 3,
    text: "Her akşam surdaki nöbetçilere güveç pişiririm ama bu hafta kiler bomboş. Vadideki gri kurtların eti çok lezzetlidir; bana 5 Kurt Eti getir. Bir de tatlı için 3 Balçık Jölesi... Gülme! İyi pişince lokum gibi olur.",
    progressText: "Kazan kaynıyor ama içine atacak bir şey yok evladım!",
    completeText: "Mis gibi! Al bakalım, ilk kepçe senin. Yolda acıkırsan ye; karnı tok olanın kılıcı keskin olur.",
    objectives: [collect("wolf_meat", 5), collect("slime_gel", 3)],
    reward: { xp: 300, gold: 20, items: [{ item: "ayse_stew", qty: 5 }] },
  },
  {
    id: "d2_guards",
    chain: DINNER,
    title: "Nöbetçilere Sıcak Yemek",
    giver: "cook",
    turnIn: "commander",
    minLevel: 3,
    requires: "d1_dinner",
    text: "Şu kazanı Komutan Baran'a götür; nöbetçiler sabahtan beri ağızlarına bir lokma koymadı. Soğumadan yetiştir, soğuk güveç olmaz!",
    completeText: "Ayşe Teyze'nin güveci mi bu? Kokusu kapıya kadar geldi! Askerler bu akşam şarkı söyleyerek nöbet tutacak. Al şunu, yolda lazım olur.",
    objectives: [],
    reward: { xp: 150, gold: 40, items: [{ item: "return_scroll" }] },
  },
  {
    id: "d3_sage",
    chain: DINNER,
    title: "Bilge'nin Kasesi",
    giver: "cook",
    turnIn: "sage",
    minLevel: 3,
    requires: "d2_guards",
    text: "Bilge Ozan yine yemeği unutmuştur; kitaplarına gömülür, akşam olduğunu bile anlamaz. Şu kaseyi ona götürüver, benden selam söyle.",
    completeText:
      "Ayşe yine beni unutmamış... Bilir misin evlat, mühür kırılmadan önce bu meydanda her akşam sofralar kurulurdu. Bütün şehir bir arada yerdi. O günler geri gelecek; parçaları topladıkça. Al, bu da senin payın.",
    objectives: [],
    reward: { xp: 150, gold: 10, items: [{ item: "ayse_stew", qty: 2 }] },
  },
  {
    id: "r_dinner",
    chain: DINNER,
    title: "Her Akşamın Güveci",
    giver: "cook",
    turnIn: "cook",
    minLevel: 3,
    requires: "d3_sage",
    repeatable: true,
    text: "Nöbetçiler artık her akşam güveç bekliyor, alıştırdık bir kere! 5 Kurt Eti getirirsen sana da bir tencere ayırırım.",
    progressText: "Et olmadan güveç olmaz evladım.",
    completeText: "Sağ ol evladım, bereket versin. Payın burada, sıcak sıcak ye.",
    objectives: [collect("wolf_meat", 5)],
    reward: { xp: 120, gold: 15, items: [{ item: "ayse_stew", qty: 3 }] },
  },

  // ---- Life skills: Zanaatkâr Murat (see gathering.ts) ---------------------------------
  {
    id: "lp1_tools",
    chain: CRAFTS,
    title: "Zanaatkârın Çırağı",
    giver: "craftsman",
    turnIn: "craftsman",
    minLevel: 2,
    text: "Elin kılıç tutmaya alışmış ama kazma tutabilir mi bakalım? Al şu kazmayla orağı. Kazma, vadideki kayalardaki bakır damarlarını; orak da tarladaki şifalı otları toplar. Envanterinde dursunlar yeter.",
    completeText: "İşte böyle! Artık hem madenci hem de otacısın. Damara ya da bitkiye tıkla, başında biraz bekle; yürürsen ya da biri sana vurursa iş yarım kalır. Ne kadar çok toplarsan o kadar ustalaşırsın.",
    objectives: [],
    reward: { xp: 60, gold: 0, items: [{ item: "miners_pickaxe" }, { item: "herb_sickle" }] },
  },
  {
    id: "lp2_copper",
    chain: CRAFTS,
    title: "İlk Cevher",
    giver: "craftsman",
    turnIn: "craftsman",
    minLevel: 2,
    requires: "lp1_tools",
    text: "Vadideki balçık tarlalarında, kayaların arasında turuncu parlayan damarlar görürsün. Onlar bakır. Bana 6 Bakır Cevheri getir, bakalım elin ne kadar hızlı.",
    progressText: "Bakır damarları turuncu parlar, kaçırma.",
    completeText: "Fena değil! Bakır kolay iştir ama her usta bakırla başlar. Al bakalım, emeğinin karşılığı.",
    objectives: [collect("copper_ore", 6)],
    reward: { xp: 150, gold: 30, items: [{ item: "hp_potion", qty: 3 }] },
  },
  {
    id: "lp3_herb",
    chain: CRAFTS,
    title: "Şifalı Otlar",
    giver: "craftsman",
    turnIn: "craftsman",
    minLevel: 2,
    requires: "lp1_tools",
    text: "Vadide kırmızı çiçekli küçük otlar var: şifalı ot. İksirci Zehra onlarsız iksir yapamaz. Bana 6 tane topla.",
    progressText: "Kırmızı çiçekli olanlar, evlat.",
    completeText: "Kokusu bile şifa! Zehra çok sevinecek. Bu da senin payın.",
    objectives: [collect("healing_herb", 6)],
    reward: { xp: 150, gold: 30, items: [{ item: "mana_potion", qty: 3 }] },
  },
  {
    id: "lp4_iron",
    chain: CRAFTS,
    title: "Demir Damarı",
    giver: "craftsman",
    turnIn: "craftsman",
    minLevel: 6,
    requires: "lp2_copper",
    text: "Goblinlerin yurdunda demir damarları var. Kolay değil: Madencilikte 12. seviye olmadan kazamazsın. Ustalaştığında bana 8 Demir Cevheri getir.",
    progressText: "Demir sabır ister. Önce bakırla elini alıştır.",
    completeText: "İşte gerçek madenci! Bu demirden Demirci Hasan güzel işler çıkarır. Al, yükseltmelerinde lazım olur.",
    objectives: [collect("iron_ore", 8)],
    reward: { xp: 500, gold: 120, items: [{ item: "upgrade_scroll_low", qty: 3 }] },
  },
  {
    id: "lp5_lavender",
    chain: CRAFTS,
    title: "Lavanta Tarlası",
    giver: "craftsman",
    turnIn: "craftsman",
    minLevel: 6,
    requires: "lp3_herb",
    text: "Vadinin kuzeydoğusunda, kurtların dolaştığı yerde mor lavantalar açar. Botanikte 12. seviye ister. 8 Lavanta getir; kokusu kurtları bile sakinleştirir derler.",
    progressText: "Mor çiçekler, kurtların arasında. Dikkatli ol.",
    completeText: "Ohh, mis gibi! Bunlarla yapılan iksir yorgunluğu alır. Al bakalım.",
    objectives: [collect("lavender", 8)],
    reward: { xp: 500, gold: 120, items: [{ item: "large_mana_potion", qty: 3 }] },
  },
  {
    id: "lp6_silver",
    chain: CRAFTS,
    title: "Gümüşün Parıltısı",
    giver: "craftsman",
    turnIn: "craftsman",
    minLevel: 10,
    requires: "lp4_iron",
    text: "Kara Orman'da, orkların oyuğunda ve kurtların ininde gümüş damarları var. Madencilikte 25. seviye ister. 10 Gümüş Cevheri getirirsen kuyumcu Selin sana borçlu kalır.",
    progressText: "Gümüş, ay ışığı gibi parlar.",
    completeText: "Bu ne parıltı! Selin bundan yüzükler döker. Al, bu da senin.",
    objectives: [collect("silver_ore", 10)],
    reward: { xp: 1400, gold: 300, items: [{ item: "silver_ring" }] },
  },
  {
    id: "lp7_nightbloom",
    chain: CRAFTS,
    title: "Gece Sefası",
    giver: "craftsman",
    turnIn: "craftsman",
    minLevel: 10,
    requires: "lp5_lavender",
    text: "Kara Orman'ın bataklığında, sadece gece açan mavi bir çiçek var: Gece Sefası. Gündüz dokunamazsın, kapanır. Botanikte 25. seviye ister. 6 tane topla.",
    progressText: "Gece açar, gündüz kapanır. Ay doğunca git.",
    completeText: "Gecenin rengi bu! Bunu çok az kişi toplayabilir. Al, gece yaratıklarının özünden de biraz.",
    objectives: [collect("night_bloom", 6)],
    reward: { xp: 1400, gold: 300, items: [{ item: "night_essence", qty: 3 }] },
  },
  {
    id: "lp8_mithril",
    chain: CRAFTS,
    title: "Efsanevi Mithril",
    giver: "craftsman",
    turnIn: "craftsman",
    minLevel: 15,
    requires: "lp6_silver",
    text: "Ayıların ininde, kayaların derinliğinde yeşil parlayan bir maden var: mithril. Madencilikte 40. seviye ister. 10 tane getirirsen ustalığını herkes konuşur.",
    progressText: "Mithril yeşil parlar ve ayılar onu kıskançlıkla korur.",
    completeText: "Mithril! Elimde tutacağımı hiç düşünmezdim. Sen artık usta madencisin.",
    objectives: [collect("mithril_ore", 10)],
    reward: { xp: 3500, gold: 800, items: [{ item: "upgrade_scroll_high" }] },
  },
  {
    id: "lp9_thorn",
    chain: CRAFTS,
    title: "Ejder Dikeni",
    giver: "craftsman",
    turnIn: "craftsman",
    minLevel: 15,
    requires: "lp7_nightbloom",
    text: "Eski mezarlıkta, kemiklerin arasında turuncu dikenler biter: Ejder Dikeni. Dokununca hâlâ sıcaktır. Botanikte 40. seviye ister. 8 tane getir.",
    progressText: "Eldivensiz dokunma, yakar.",
    completeText: "Ejder kanı bu topraklara karışmış derler. Sen artık usta otacısın. Al, bir felaketten seni korusun.",
    objectives: [collect("dragon_thorn", 8)],
    reward: { xp: 3500, gold: 800, items: [{ item: "protection_charm" }] },
  },
  {
    id: "r_crafts",
    chain: CRAFTS,
    title: "Zanaatkârın Siparişi",
    giver: "craftsman",
    turnIn: "craftsman",
    minLevel: 2,
    requires: "lp1_tools",
    repeatable: true,
    text: "Dükkânın stoğu hiç bitmez evlat. 10 Bakır Cevheri ve 10 Şifalı Ot getirirsen iyi para veririm.",
    progressText: "Bakır ve ot, onar tane.",
    completeText: "Bereket versin! Paran burada.",
    objectives: [collect("copper_ore", 10), collect("healing_herb", 10)],
    reward: { xp: 250, gold: 90 },
  },

  // ---- Repeatable -------------------------------------------------------------------
  {
    id: "r_valley_patrol",
    chain: DAILY,
    title: "Vadi Devriyesi",
    giver: "hunter",
    turnIn: "hunter",
    minLevel: 3,
    requires: "m5_wolves",
    repeatable: true,
    text: "Kurtlar bitmek bilmiyor. Her 10 Gri Kurt için sana avcı payı veririm.",
    completeText: "Teşekkürler. Payın burada; yarın yine gel.",
    objectives: [kill("wolf", 10, "Gri Kurt")],
    reward: { xp: 250, gold: 40 },
  },
  {
    id: "r_bandit_hunt",
    chain: DAILY,
    title: "Haydut Ödülü",
    giver: "ranger",
    turnIn: "ranger",
    minLevel: 12,
    requires: "f3_bandits",
    repeatable: true,
    text: "Şehir konseyi her haydut başına ödül koydu. 20 Haydut getir, ödülü al.",
    completeText: "20 haydut daha... Ödülün burada.",
    objectives: [kill("bandit", 20, "Haydut")],
    reward: { xp: 2500, gold: 200, items: [{ item: "upgrade_scroll_low", qty: 2 }] },
  },
  {
    id: "r_bone_dust",
    chain: DAILY,
    title: "Kemik Tozu Ticareti",
    giver: "alchemist",
    turnIn: "alchemist",
    minLevel: 14,
    requires: "f5_undead",
    repeatable: true,
    text: "Kemik tozu en güçlü iksirlerimin sırrı. 15 Kemik Tozu getirirsen iyi öderim.",
    completeText: "Mükemmel kalite! Al bakalım.",
    objectives: [collect("bone_dust", 15)],
    reward: { xp: 1200, gold: 300, items: [{ item: "large_hp_potion", qty: 5 }] },
  },
  {
    id: "r_spirit_stones",
    chain: DAILY,
    title: "Ruh Taşları",
    giver: "sage",
    turnIn: "sage",
    minLevel: 10,
    requires: "m11_forest",
    repeatable: true,
    text: "Kara Orman'daki yaratıklar bazen Ruh Taşı düşürür. 3 tane getirirsen içlerindeki gücü bir parşömene aktarırım.",
    completeText: "Ruhlar huzura erdi; güçleri artık bu parşömende.",
    objectives: [collect("spirit_stone", 3)],
    reward: { xp: 1500, gold: 0, items: [{ item: "upgrade_scroll_high" }] },
  },
];

export const QUESTS: Record<string, QuestDef> = Object.fromEntries(QUEST_LIST.map((q) => [q.id, q]));

/** Quests offered or turned in by an NPC, in story order. */
export function questsOfNpc(npcId: string): QuestDef[] {
  return QUEST_LIST.filter((q) => q.giver === npcId || q.turnIn === npcId);
}

/** Saved per character. kills[i] counts objective i (collect objectives stay 0). */
export interface QuestProgress {
  id: string;
  status: "active" | "done";
  kills: number[];
}

/** Can this quest be offered to a character in this state? */
export function questAvailable(quest: QuestDef, level: number, log: Map<string, QuestProgress>): boolean {
  const entry = log.get(quest.id);
  if (entry?.status === "active") return false;
  if (entry?.status === "done" && !quest.repeatable) return false;
  if (level < quest.minLevel) return false;
  return !quest.requires || log.get(quest.requires)?.status === "done";
}

/** True when every objective is met (kills counted, items in the inventory). */
export function questReady(quest: QuestDef, entry: QuestProgress, countItem: (defId: string) => number): boolean {
  return quest.objectives.every((objective, i) =>
    objective.type === "kill" ? (entry.kills[i] ?? 0) >= objective.count : countItem(objective.item) >= objective.count,
  );
}

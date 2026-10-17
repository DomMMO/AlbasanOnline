import { MELEE_RANGE, TILE_SIZE } from "../constants";
import type { Appearance } from "./appearance";

export type SkillEffect =
  /** Single-target hit on an enemy: attack * multiplier + bonus. */
  | { type: "strike"; multiplier: number; bonus: number }
  /** Hits every enemy within radius of the caster. */
  | { type: "whirlwind"; radius: number; multiplier: number }
  /** Restores a percentage of the caster's max health. */
  | { type: "heal"; percent: number }
  /** Hits every enemy within radius and roots them in place. */
  | { type: "nova"; radius: number; multiplier: number; rootMs: number }
  /** Heals the friendly target (or the caster): attack * multiplier + bonus. */
  | { type: "healTarget"; multiplier: number; bonus: number }
  /** Damage-absorbing shield on the friendly target (or the caster). */
  | { type: "shield"; multiplier: number; bonus: number; durationMs: number }
  /** Hits the enemy like strike and heals the caster for `healFraction` of the damage dealt. */
  | { type: "drain"; multiplier: number; bonus: number; healFraction: number }
  /** Raises minions that fight the caster's enemies until they expire. */
  | { type: "summon"; name: string; appearance: Appearance; durationMs: number; multiplier: number; swingMs: number; speed: number }
  /** The caster takes `reduction` less damage for a while. */
  | { type: "guard"; reduction: number; durationMs: number }
  /** Hits the enemy and stuns it (can't move or attack; bosses are immune). */
  | { type: "stun"; multiplier: number; bonus: number; stunMs: number }
  /** Hits every enemy within radius of the target enemy. */
  | { type: "blast"; radius: number; multiplier: number }
  /** Hits every enemy around the caster and heals the caster and party members in the same radius. */
  | { type: "radiance"; radius: number; multiplier: number; healMultiplier: number }
  /**
   * Moves the caster at once. forward = along the facing direction (no target needed);
   * toTarget = up to the enemy; behindTarget = just past the enemy. Then optionally hits
   * everyone around the landing spot, stuns the target, heals or shields the caster.
   */
  | {
      type: "dash";
      mode: "forward" | "toTarget" | "behindTarget";
      distance: number;
      landRadius?: number;
      multiplier?: number;
      stunMs?: number;
      healPercent?: number;
      shieldPercent?: number;
    }
  /**
   * Timed buff on the caster (and party members within `partyRadius`): more attack,
   * faster swings and/or less damage taken. `hpCostPercent` of max health is paid up front.
   */
  | { type: "buff"; durationMs: number; attackPct?: number; speedPct?: number; reductionPct?: number; partyRadius?: number; hpCostPercent?: number }
  /**
   * Kesme: a light hit that stops the enemy's magic cast (yellow bar; the mob can't start it
   * again for INTERRUPT_LOCK_MS) or a player's spell. Grey bars (physical) need a stun instead.
   */
  | { type: "interrupt"; multiplier: number; bonus: number };

/** How the client draws the skill; the server never looks at this. */
export type SkillVisual =
  | "melee"
  | "spin"
  | "fireball"
  | "frost"
  | "lightning"
  | "holy"
  | "heal"
  | "shield"
  | "selfHeal"
  | "drain"
  | "summon"
  | "bone"
  | "shout"
  | "guard"
  | "stun"
  | "blast"
  | "radiance"
  | "buff"
  | "blink"
  | "leap"
  | "charge"
  | "shadow"
  | "arrow"
  | "volley"
  | "storm"
  | "spirit"
  | "nature"
  | "roots";

/** What the skill is for (every class has at least one of each of the first five). */
export type SkillCategory = "single" | "aoe" | "cc" | "dash" | "buff" | "utility";

export const SKILL_CATEGORY_NAMES: Record<SkillCategory, string> = {
  single: "Tek hedef",
  aoe: "Alan",
  cc: "Kitle kontrol",
  dash: "Atılma",
  buff: "Güçlendirme",
  utility: "Destek",
};

export interface SkillDef {
  id: string;
  name: string;
  /** Two-letter label for the hotbar until we have icons. */
  short: string;
  description: string;
  category: SkillCategory;
  /** Character level needed to put points in it. */
  level: number;
  /** Rage for warriors, mana for casters, energy for assassins and archers. */
  cost: number;
  cooldownMs: number;
  triggersGcd: boolean;
  /** 0 = instant. Casting is interrupted by moving. */
  castMs: number;
  /** enemy: needs a hostile target in range. friendly: target player or self. none: no target. */
  target: "enemy" | "friendly" | "none";
  range: number;
  effect: SkillEffect;
  visual: SkillVisual;
  color: string;
}

const SPELL_RANGE = TILE_SIZE * 9;
const DASH_RANGE = TILE_SIZE * 8;

const skill = (def: SkillDef) => def;

/** Max mana grows by this share of its level 1 value per level (classes.ts maxResource). */
export const MANA_COST_GROWTH = 12 / 125;

/**
 * What a skill costs at a level, before passive tree reductions. Mana costs grow with the
 * level like max mana does, so a spell always takes the same share of the pool (rage and
 * energy pools don't grow, so neither do their costs). Mirrored in GameData.skill_cost().
 */
export function skillCostAt(skill: SkillDef, resource: string, level: number): number {
  return resource === "mana" ? Math.round(skill.cost * (1 + (level - 1) * MANA_COST_GROWTH)) : skill.cost;
}

/** Every class's interrupt: same rules, its own look. ClassDef.interrupt names it. */
function interrupts(): SkillDef[] {
  const base = { short: "", category: "utility" as const, level: 1, cost: 0, cooldownMs: 12_000, triggersGcd: false, castMs: 0, target: "enemy" as const, effect: { type: "interrupt" as const, multiplier: 0.3, bonus: 2 } };
  const tail = " Sarı (büyü) barı keser: o büyü 10 sn yeniden başlayamaz. Gri barı kesemez; onu sersemletme durdurur.";
  return [
    { ...base, id: "pummel", name: "Susturan Yumruk", short: "SY", description: "Kılıcının kabzasıyla hedefin boğazına vurur." + tail, range: MELEE_RANGE, visual: "stun", color: "#f59f00" },
    { ...base, id: "windShear", name: "Rüzgâr Kesiği", short: "RK", description: "Keskin bir rüzgâr hedefin sesini boğazında keser." + tail, range: SPELL_RANGE, visual: "spirit", color: "#f59f00" },
    { ...base, id: "throatKick", name: "Boğaz Tekmesi", short: "BT", description: "Hızlı bir tekmeyle hedefin nefesini keser." + tail, range: MELEE_RANGE, visual: "stun", color: "#f59f00" },
    { ...base, id: "silencingShot", name: "Susturan Ok", short: "SO", description: "Hedefin ağzına doğru küt uçlu bir ok gönderir." + tail, range: SPELL_RANGE, visual: "arrow", color: "#f59f00" },
    { ...base, id: "thornGag", name: "Diken Gemi", short: "DG", description: "Dikenli bir sarmaşık hedefin ağzını bağlar." + tail, range: SPELL_RANGE, visual: "nature", color: "#f59f00" },
    { ...base, id: "holySilence", name: "Kutsal Sessizlik", short: "KS", description: "Işık hedefin sesini bir anlığına söndürür." + tail, range: SPELL_RANGE, visual: "holy", color: "#f59f00" },
    { ...base, id: "soulLock", name: "Ruh Kilidi", short: "RK", description: "Hedefin ruhunu bir an kilitler, büyüsü dağılır." + tail, range: SPELL_RANGE, visual: "shadow", color: "#f59f00" },
  ];
}

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(
  [
    // ---- Warrior (rage)
    skill({ id: "heroicStrike", name: "Ağır Darbe", short: "AD", category: "single", level: 1, description: "Hedefe güçlü bir darbe indirir.", cost: 15, cooldownMs: 0, triggersGcd: true, castMs: 0, target: "enemy", range: MELEE_RANGE, effect: { type: "strike", multiplier: 1.2, bonus: 6 }, visual: "melee", color: "#c0392b" }),
    skill({ id: "whirlwind", name: "Girdap", short: "GR", category: "aoe", level: 2, description: "Etrafındaki tüm düşmanlara vurur.", cost: 25, cooldownMs: 8000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "whirlwind", radius: TILE_SIZE * 2, multiplier: 0.9 }, visual: "spin", color: "#d68910" }),
    skill({ id: "secondWind", name: "İkinci Nefes", short: "İN", category: "utility", level: 3, description: "Canının %30'unu yeniler.", cost: 0, cooldownMs: 30_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "heal", percent: 0.3 }, visual: "selfHeal", color: "#27ae60" }),
    skill({ id: "hamstring", name: "Sarsıcı Darbe", short: "SD", category: "cc", level: 4, description: "Hedefin kafasına vurur ve 2 sn sersemletir.", cost: 15, cooldownMs: 14_000, triggersGcd: true, castMs: 0, target: "enemy", range: MELEE_RANGE, effect: { type: "stun", multiplier: 0.7, bonus: 4, stunMs: 2000 }, visual: "stun", color: "#e8590c" }),
    skill({ id: "leapSlam", name: "Sıçrayış", short: "SY", category: "dash", level: 6, description: "Hedefin yanına sıçrar, indiği yerin çevresindeki herkese vurur.", cost: 15, cooldownMs: 15_000, triggersGcd: true, castMs: 0, target: "enemy", range: DASH_RANGE, effect: { type: "dash", mode: "toTarget", distance: DASH_RANGE, landRadius: TILE_SIZE * 2, multiplier: 0.8 }, visual: "leap", color: "#c92a2a" }),
    skill({ id: "battleShout", name: "Savaş Çığlığı", short: "SÇ", category: "buff", level: 8, description: "12 sn boyunca saldırın %25 artar.", cost: 10, cooldownMs: 40_000, triggersGcd: false, castMs: 0, target: "none", range: 0, effect: { type: "buff", durationMs: 12_000, attackPct: 0.25 }, visual: "buff", color: "#f08c00" }),

    // ---- Shaman (Kam, mana): sky and spirits
    skill({ id: "skyLash", name: "Gök Kamçısı", short: "GK", category: "single", level: 1, description: "Gökten hedefe bir şimşek kamçısı indirir. 1,3 sn büyü.", cost: 22, cooldownMs: 0, triggersGcd: true, castMs: 1300, target: "enemy", range: SPELL_RANGE, effect: { type: "strike", multiplier: 2.0, bonus: 7 }, visual: "lightning", color: "#4dabf7" }),
    skill({ id: "thunderDrum", name: "Gök Davulu", short: "GD", category: "aoe", level: 2, description: "Davulunu döver, gök gürler: çevrendeki tüm düşmanlara vurur.", cost: 30, cooldownMs: 9000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "whirlwind", radius: TILE_SIZE * 2.5, multiplier: 0.9 }, visual: "storm", color: "#1c7ed6" }),
    skill({ id: "ancestorSpirit", name: "Ata Ruhu", short: "AR", category: "utility", level: 3, description: "Ataların ruhunu çağırır: hedef oyuncuyu (yoksa kendini) iyileştirir. 1,2 sn büyü.", cost: 28, cooldownMs: 0, triggersGcd: true, castMs: 1200, target: "friendly", range: SPELL_RANGE, effect: { type: "healTarget", multiplier: 1.6, bonus: 14 }, visual: "spirit", color: "#63e6be" }),
    skill({ id: "spiritBind", name: "Ruh Bağı", short: "RB", category: "cc", level: 4, description: "Görünmez ruhlar hedefi sarar, 3 sn kıpırdayamaz.", cost: 25, cooldownMs: 15_000, triggersGcd: true, castMs: 0, target: "enemy", range: SPELL_RANGE, effect: { type: "stun", multiplier: 0.5, bonus: 4, stunMs: 3000 }, visual: "spirit", color: "#38d9a9" }),
    skill({ id: "windWalk", name: "Yel Yürüyüşü", short: "YY", category: "dash", level: 6, description: "Rüzgâra binip baktığın yöne 6 kare uçarsın.", cost: 20, cooldownMs: 12_000, triggersGcd: false, castMs: 0, target: "none", range: 0, effect: { type: "dash", mode: "forward", distance: TILE_SIZE * 6 }, visual: "blink", color: "#a5d8ff" }),
    skill({ id: "skyBlessing", name: "Tengri'nin Lütfu", short: "TL", category: "buff", level: 8, description: "12 sn boyunca sen ve yakındaki grup arkadaşların %15 daha güçlü ve %15 daha hızlı vurur.", cost: 35, cooldownMs: 45_000, triggersGcd: false, castMs: 0, target: "none", range: 0, effect: { type: "buff", durationMs: 12_000, attackPct: 0.15, speedPct: 0.15, partyRadius: TILE_SIZE * 8 }, visual: "buff", color: "#339af0" }),

    // ---- Archer (Tigin, energy): bow and arrow
    skill({ id: "aimedShot", name: "Nişanlı Atış", short: "NA", category: "single", level: 1, description: "Yayı sonuna kadar gerip tek, güçlü bir ok atar. 1 sn nişan.", cost: 30, cooldownMs: 0, triggersGcd: true, castMs: 1000, target: "enemy", range: SPELL_RANGE, effect: { type: "strike", multiplier: 1.9, bonus: 6 }, visual: "arrow", color: "#d9480f" }),
    skill({ id: "arrowRain", name: "Ok Yağmuru", short: "OY", category: "aoe", level: 2, description: "Hedefin üstüne ok yağdırır, çevresindeki tüm düşmanlara vurur.", cost: 40, cooldownMs: 9000, triggersGcd: true, castMs: 0, target: "enemy", range: SPELL_RANGE, effect: { type: "blast", radius: TILE_SIZE * 2.5, multiplier: 1.0 }, visual: "volley", color: "#e67700" }),
    skill({ id: "quickShot", name: "Seri Atış", short: "SA", category: "single", level: 3, description: "Hiç beklemeden peş peşe iki ok gönderir.", cost: 25, cooldownMs: 5000, triggersGcd: true, castMs: 0, target: "enemy", range: SPELL_RANGE, effect: { type: "strike", multiplier: 1.3, bonus: 4 }, visual: "arrow", color: "#f59f00" }),
    skill({ id: "pinningShot", name: "Çivileyen Ok", short: "ÇO", category: "cc", level: 4, description: "Hedefi olduğu yere çiviler: 2,5 sn kıpırdayamaz.", cost: 25, cooldownMs: 15_000, triggersGcd: true, castMs: 0, target: "enemy", range: SPELL_RANGE, effect: { type: "stun", multiplier: 0.6, bonus: 4, stunMs: 2500 }, visual: "arrow", color: "#a61e4d" }),
    skill({ id: "hawkLeap", name: "Doğan Sıçrayışı", short: "DS", category: "dash", level: 6, description: "Doğan gibi baktığın yöne 5 kare sıçrarsın.", cost: 20, cooldownMs: 12_000, triggersGcd: false, castMs: 0, target: "none", range: 0, effect: { type: "dash", mode: "forward", distance: TILE_SIZE * 5 }, visual: "blink", color: "#ffd8a8" }),
    skill({ id: "eagleEye", name: "Kartal Gözü", short: "KG", category: "buff", level: 8, description: "12 sn boyunca %20 daha güçlü ve %20 daha hızlı atarsın.", cost: 0, cooldownMs: 40_000, triggersGcd: false, castMs: 0, target: "none", range: 0, effect: { type: "buff", durationMs: 12_000, attackPct: 0.2, speedPct: 0.2 }, visual: "buff", color: "#f08c00" }),

    // ---- Druid (Erşek, mana): forest and beasts
    skill({ id: "thornLash", name: "Diken Kırbacı", short: "DK", category: "single", level: 1, description: "Topraktan fışkıran dikenli bir sarmaşık hedefi kırbaçlar. 1,2 sn büyü.", cost: 20, cooldownMs: 0, triggersGcd: true, castMs: 1200, target: "enemy", range: SPELL_RANGE, effect: { type: "strike", multiplier: 1.85, bonus: 6 }, visual: "nature", color: "#2f9e44" }),
    skill({ id: "entangle", name: "Sarmaşık", short: "SR", category: "cc", level: 2, description: "Çevrendeki düşmanların ayaklarını kökler sarar: hasar alır, 3,5 sn yerinden kıpırdayamaz.", cost: 30, cooldownMs: 12_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "nova", radius: TILE_SIZE * 2.5, multiplier: 0.5, rootMs: 3500 }, visual: "roots", color: "#5c940d" }),
    skill({ id: "rejuvenate", name: "Yaprak Şifası", short: "YŞ", category: "utility", level: 3, description: "Taze yapraklar hedef oyuncuyu (yoksa seni) sarar ve iyileştirir. 1,2 sn büyü.", cost: 28, cooldownMs: 0, triggersGcd: true, castMs: 1200, target: "friendly", range: SPELL_RANGE, effect: { type: "healTarget", multiplier: 1.7, bonus: 14 }, visual: "heal", color: "#69db7c" }),
    skill({ id: "barkskin", name: "Ağaç Kabuğu", short: "AK", category: "buff", level: 4, description: "Derin meşe kabuğu gibi sertleşir: 8 sn boyunca %35 daha az hasar alırsın.", cost: 15, cooldownMs: 25_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "guard", reduction: 0.35, durationMs: 8000 }, visual: "guard", color: "#8a5a2b" }),
    skill({ id: "wildCharge", name: "Bozkurt Hücumu", short: "BH", category: "dash", level: 6, description: "Bozkurt gibi hedefe atılır, çarptığında 1,5 sn sersemletirsin.", cost: 20, cooldownMs: 14_000, triggersGcd: true, castMs: 0, target: "enemy", range: DASH_RANGE, effect: { type: "dash", mode: "toTarget", distance: DASH_RANGE, multiplier: 0.6, stunMs: 1500 }, visual: "charge", color: "#868e96" }),
    skill({ id: "springTide", name: "Bahar Dalgası", short: "BD", category: "aoe", level: 8, description: "Etrafına yeşil bir dalga yayılır: düşmanlara vurur, seni ve yakındaki grup arkadaşlarını iyileştirir.", cost: 35, cooldownMs: 10_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "radiance", radius: TILE_SIZE * 3, multiplier: 0.75, healMultiplier: 0.6 }, visual: "nature", color: "#40c057" }),

    // ---- Priest (mana)
    skill({ id: "smite", name: "Kutsal Işık", short: "Kİ", category: "single", level: 1, description: "Hedefi kutsal ışıkla yakar. 1,2 sn büyü.", cost: 20, cooldownMs: 0, triggersGcd: true, castMs: 1200, target: "enemy", range: SPELL_RANGE, effect: { type: "strike", multiplier: 1.8, bonus: 6 }, visual: "holy", color: "#e0a800" }),
    skill({ id: "heal", name: "Şifa", short: "ŞF", category: "utility", level: 2, description: "Hedef oyuncuyu (yoksa kendini) iyileştirir. 1,5 sn büyü.", cost: 30, cooldownMs: 0, triggersGcd: true, castMs: 1500, target: "friendly", range: SPELL_RANGE, effect: { type: "healTarget", multiplier: 2.5, bonus: 20 }, visual: "heal", color: "#2f9e44" }),
    skill({ id: "shield", name: "Koruyucu Kalkan", short: "KK", category: "utility", level: 3, description: "Hedef oyuncuya (yoksa kendine) 10 sn hasar emen bir kalkan verir.", cost: 25, cooldownMs: 12_000, triggersGcd: true, castMs: 0, target: "friendly", range: SPELL_RANGE, effect: { type: "shield", multiplier: 2, bonus: 30, durationMs: 10_000 }, visual: "shield", color: "#4dabf7" }),
    skill({ id: "holyNova", name: "Kutsal Nova", short: "KN", category: "aoe", level: 4, description: "Etrafına ışık saçar: çevredeki düşmanlara vurur, seni ve yakındaki grup arkadaşlarını iyileştirir.", cost: 35, cooldownMs: 10_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "radiance", radius: TILE_SIZE * 3, multiplier: 0.7, healMultiplier: 0.8 }, visual: "radiance", color: "#ffd43b" }),
    skill({ id: "holyChains", name: "Kutsal Zincir", short: "KZ", category: "cc", level: 5, description: "Işıktan zincirler hedefi 3 sn yerinde tutar ve sersemletir.", cost: 25, cooldownMs: 16_000, triggersGcd: true, castMs: 0, target: "enemy", range: SPELL_RANGE, effect: { type: "stun", multiplier: 0.5, bonus: 4, stunMs: 3000 }, visual: "stun", color: "#fab005" }),
    skill({ id: "lightStep", name: "Işık Adımı", short: "IA", category: "dash", level: 6, description: "Baktığın yöne 5 kare süzülürsün ve canının %10'u kadar kalkan kazanırsın.", cost: 20, cooldownMs: 14_000, triggersGcd: false, castMs: 0, target: "none", range: 0, effect: { type: "dash", mode: "forward", distance: TILE_SIZE * 5, shieldPercent: 0.1 }, visual: "blink", color: "#fff3bf" }),
    skill({ id: "divineSpirit", name: "Kutsal Ruh", short: "KR", category: "buff", level: 8, description: "15 sn boyunca sen ve yakındaki grup arkadaşların %15 daha güçlü vurur ve iyileştirir.", cost: 40, cooldownMs: 45_000, triggersGcd: false, castMs: 0, target: "none", range: 0, effect: { type: "buff", durationMs: 15_000, attackPct: 0.15, partyRadius: TILE_SIZE * 8 }, visual: "buff", color: "#fcc419" }),

    // ---- Necromancer (mana)
    skill({ id: "drainLife", name: "Ruh Emme", short: "RE", category: "single", level: 1, description: "Hedefin ruhunu emer: hasar verir, verdiği hasarın %40'ı kadar seni iyileştirir. 1,3 sn büyü.", cost: 22, cooldownMs: 0, triggersGcd: true, castMs: 1300, target: "enemy", range: SPELL_RANGE, effect: { type: "drain", multiplier: 1.6, bonus: 6, healFraction: 0.4 }, visual: "drain", color: "#40c057" }),
    skill({ id: "boneNova", name: "Kemik Patlaması", short: "KP", category: "aoe", level: 2, description: "Etrafına keskin kemikler saçar, çevresindeki tüm düşmanlara vurur.", cost: 30, cooldownMs: 10_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "whirlwind", radius: TILE_SIZE * 2.5, multiplier: 0.85 }, visual: "bone", color: "#dee2e6" }),
    skill({ id: "summonSkeleton", name: "İskelet Çağır", short: "İÇ", category: "utility", level: 3, description: "25 sn boyunca hedefine saldıran bir iskelet çağırır. Kadim Mücevherlerle aynı anda daha fazla.", cost: 40, cooldownMs: 30_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "summon", name: "İskelet", appearance: { type: "humanoid", tunic: 0x3b3b3b, skin: 0xe8e4d8, hair: 0xe8e4d8 }, durationMs: 25_000, multiplier: 0.55, swingMs: 1500, speed: 78 }, visual: "summon", color: "#adb5bd" }),
    skill({ id: "terror", name: "Dehşet", short: "DH", category: "cc", level: 4, description: "Hedefin içine ölüm korkusu salar: 3 sn kıpırdayamaz, saldıramaz.", cost: 25, cooldownMs: 16_000, triggersGcd: true, castMs: 0, target: "enemy", range: SPELL_RANGE, effect: { type: "stun", multiplier: 0.4, bonus: 4, stunMs: 3000 }, visual: "stun", color: "#5c940d" }),
    skill({ id: "soulStep", name: "Ruh Göçü", short: "RG", category: "dash", level: 6, description: "Gölgelerin içinden baktığın yöne 5 kare geçersin, canının %8'i yenilenir.", cost: 20, cooldownMs: 14_000, triggersGcd: false, castMs: 0, target: "none", range: 0, effect: { type: "dash", mode: "forward", distance: TILE_SIZE * 5, healPercent: 0.08 }, visual: "shadow", color: "#2b8a3e" }),
    skill({ id: "darkPact", name: "Karanlık Pakt", short: "PK", category: "buff", level: 8, description: "Canının %10'unu feda edersin: 12 sn boyunca %35 daha güçlü vurursun.", cost: 0, cooldownMs: 40_000, triggersGcd: false, castMs: 0, target: "none", range: 0, effect: { type: "buff", durationMs: 12_000, attackPct: 0.35, hpCostPercent: 0.1 }, visual: "buff", color: "#5c940d" }),

    // ---- Rogue (energy)
    skill({ id: "sinisterStrike", name: "Sinsi Darbe", short: "SN", category: "single", level: 1, description: "Hızlı ve sinsi bir bıçak darbesi.", cost: 30, cooldownMs: 0, triggersGcd: true, castMs: 0, target: "enemy", range: MELEE_RANGE, effect: { type: "strike", multiplier: 1.3, bonus: 6 }, visual: "melee", color: "#ffe066" }),
    skill({ id: "fanOfKnives", name: "Bıçak Yelpazesi", short: "BY", category: "aoe", level: 2, description: "Etrafına bıçaklar fırlatır, çevredeki tüm düşmanlara vurur.", cost: 40, cooldownMs: 6000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "whirlwind", radius: TILE_SIZE * 2.5, multiplier: 0.8 }, visual: "spin", color: "#adb5bd" }),
    skill({ id: "eviscerate", name: "İç Parçalama", short: "İP", category: "single", level: 3, description: "Ölümcül bir son vuruş: çok yüksek hasar.", cost: 45, cooldownMs: 10_000, triggersGcd: true, castMs: 0, target: "enemy", range: MELEE_RANGE, effect: { type: "strike", multiplier: 2.4, bonus: 10 }, visual: "melee", color: "#e03131" }),
    skill({ id: "blind", name: "Kör Edici Toz", short: "KT", category: "cc", level: 4, description: "Hedefin gözüne toz atar, 3 sn sersemletir.", cost: 30, cooldownMs: 16_000, triggersGcd: true, castMs: 0, target: "enemy", range: MELEE_RANGE * 2, effect: { type: "stun", multiplier: 0.2, bonus: 2, stunMs: 3000 }, visual: "stun", color: "#ced4da" }),
    skill({ id: "shadowStep", name: "Gölge Adımı", short: "GA", category: "dash", level: 6, description: "Gölgelere karışıp hedefin arkasında belirirsin ve sırtına vurursun.", cost: 25, cooldownMs: 12_000, triggersGcd: false, castMs: 0, target: "enemy", range: DASH_RANGE, effect: { type: "dash", mode: "behindTarget", distance: DASH_RANGE, multiplier: 0.9 }, visual: "shadow", color: "#495057" }),
    // ---- Kesme: every class's own interrupt (innate: no points, from level 1, off the GCD) ----
    ...interrupts(),

    skill({ id: "adrenaline", name: "Adrenalin", short: "AR", category: "buff", level: 8, description: "12 sn boyunca %40 daha hızlı saldırırsın.", cost: 0, cooldownMs: 40_000, triggersGcd: false, castMs: 0, target: "none", range: 0, effect: { type: "buff", durationMs: 12_000, speedPct: 0.4 }, visual: "buff", color: "#fab005" }),
  ].map((def) => [def.id, def]),
);

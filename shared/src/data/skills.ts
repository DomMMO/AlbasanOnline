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
  /** Raises a minion that fights the caster's enemies until it expires (one at a time). */
  | { type: "summon"; name: string; appearance: Appearance; durationMs: number; multiplier: number; swingMs: number; speed: number }
  /** The caster takes `reduction` less damage for a while. */
  | { type: "guard"; reduction: number; durationMs: number };

/** How the client draws the skill; the server never looks at this. */
export type SkillVisual = "melee" | "spin" | "fireball" | "frost" | "lightning" | "holy" | "heal" | "shield" | "selfHeal" | "drain" | "summon" | "bone" | "shout" | "guard";

export interface SkillDef {
  id: string;
  name: string;
  /** Two-letter label for the hotbar until we have icons. */
  short: string;
  description: string;
  /** Rage for warriors, mana for casters. */
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

const skill = (def: SkillDef) => def;

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(
  [
    // ---- Warrior (rage)
    skill({ id: "heroicStrike", name: "Ağır Darbe", short: "AD", description: "Hedefe güçlü bir darbe indirir.", cost: 15, cooldownMs: 0, triggersGcd: true, castMs: 0, target: "enemy", range: MELEE_RANGE, effect: { type: "strike", multiplier: 1.2, bonus: 6 }, visual: "melee", color: "#c0392b" }),
    skill({ id: "whirlwind", name: "Girdap", short: "GR", description: "Etrafındaki tüm düşmanlara vurur.", cost: 25, cooldownMs: 8000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "whirlwind", radius: TILE_SIZE * 2, multiplier: 0.9 }, visual: "spin", color: "#d68910" }),
    skill({ id: "secondWind", name: "İkinci Nefes", short: "İN", description: "Canının %30'unu yeniler.", cost: 0, cooldownMs: 30_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "heal", percent: 0.3 }, visual: "selfHeal", color: "#27ae60" }),

    // ---- Guardian (rage, tank)
    skill({ id: "shieldSlam", name: "Kalkan Darbesi", short: "KD", description: "Hedefe kalkanla sert bir darbe indirir.", cost: 12, cooldownMs: 0, triggersGcd: true, castMs: 0, target: "enemy", range: MELEE_RANGE, effect: { type: "strike", multiplier: 1.35, bonus: 8 }, visual: "melee", color: "#1c7ed6" }),
    skill({ id: "challengingShout", name: "Meydan Okuma", short: "MO", description: "Etrafındaki tüm düşmanlara vurur ve hepsinin dikkatini üstüne çeker.", cost: 20, cooldownMs: 8000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "whirlwind", radius: TILE_SIZE * 2.5, multiplier: 0.75 }, visual: "shout", color: "#e03131" }),
    skill({ id: "shieldWall", name: "Kalkan Duvarı", short: "KW", description: "8 sn boyunca %50 daha az hasar alırsın.", cost: 0, cooldownMs: 25_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "guard", reduction: 0.5, durationMs: 8000 }, visual: "guard", color: "#74c0fc" }),

    // ---- Mage (mana)
    skill({ id: "fireball", name: "Ateş Topu", short: "AT", description: "Hedefe yüksek hasarlı bir ateş topu fırlatır. 1,5 sn büyü.", cost: 25, cooldownMs: 0, triggersGcd: true, castMs: 1500, target: "enemy", range: SPELL_RANGE, effect: { type: "strike", multiplier: 2.2, bonus: 8 }, visual: "fireball", color: "#e8590c" }),
    skill({ id: "frostNova", name: "Buz Halkası", short: "BH", description: "Etrafındaki düşmanlara hasar verir ve 4 sn dondurur.", cost: 30, cooldownMs: 12_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "nova", radius: TILE_SIZE * 2.5, multiplier: 0.6, rootMs: 4000 }, visual: "frost", color: "#1c7ed6" }),
    skill({ id: "lightning", name: "Yıldırım", short: "YD", description: "Hedefe anında yıldırım düşürür.", cost: 20, cooldownMs: 6000, triggersGcd: true, castMs: 0, target: "enemy", range: SPELL_RANGE, effect: { type: "strike", multiplier: 1.3, bonus: 4 }, visual: "lightning", color: "#f08c00" }),

    // ---- Priest (mana)
    skill({ id: "smite", name: "Kutsal Işık", short: "Kİ", description: "Hedefi kutsal ışıkla yakar. 1,2 sn büyü.", cost: 20, cooldownMs: 0, triggersGcd: true, castMs: 1200, target: "enemy", range: SPELL_RANGE, effect: { type: "strike", multiplier: 1.8, bonus: 6 }, visual: "holy", color: "#e0a800" }),
    skill({ id: "heal", name: "Şifa", short: "ŞF", description: "Hedef oyuncuyu (yoksa kendini) iyileştirir. 1,5 sn büyü.", cost: 30, cooldownMs: 0, triggersGcd: true, castMs: 1500, target: "friendly", range: SPELL_RANGE, effect: { type: "healTarget", multiplier: 2.5, bonus: 20 }, visual: "heal", color: "#2f9e44" }),
    // ---- Necromancer (mana)
    skill({ id: "drainLife", name: "Ruh Emme", short: "RE", description: "Hedefin ruhunu emer: hasar verir, verdiği hasarın %40'ı kadar seni iyileştirir. 1,3 sn büyü.", cost: 22, cooldownMs: 0, triggersGcd: true, castMs: 1300, target: "enemy", range: SPELL_RANGE, effect: { type: "drain", multiplier: 1.6, bonus: 6, healFraction: 0.4 }, visual: "drain", color: "#40c057" }),
    skill({ id: "summonSkeleton", name: "İskelet Çağır", short: "İÇ", description: "25 sn boyunca hedefine saldıran bir iskelet çağırır. Kadim Mücevherlerle aynı anda daha fazla.", cost: 40, cooldownMs: 30_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "summon", name: "İskelet", appearance: { type: "humanoid", tunic: 0x3b3b3b, skin: 0xe8e4d8, hair: 0xe8e4d8 }, durationMs: 25_000, multiplier: 0.55, swingMs: 1500, speed: 78 }, visual: "summon", color: "#adb5bd" }),
    skill({ id: "boneNova", name: "Kemik Patlaması", short: "KP", description: "Etrafına keskin kemikler saçar, çevresindeki tüm düşmanlara vurur.", cost: 30, cooldownMs: 10_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "whirlwind", radius: TILE_SIZE * 2.5, multiplier: 0.85 }, visual: "bone", color: "#dee2e6" }),
    skill({ id: "shield", name: "Koruyucu Kalkan", short: "KK", description: "Hedef oyuncuya (yoksa kendine) 10 sn hasar emen bir kalkan verir.", cost: 25, cooldownMs: 12_000, triggersGcd: true, castMs: 0, target: "friendly", range: SPELL_RANGE, effect: { type: "shield", multiplier: 2, bonus: 30, durationMs: 10_000 }, visual: "shield", color: "#4dabf7" }),
  ].map((def) => [def.id, def]),
);

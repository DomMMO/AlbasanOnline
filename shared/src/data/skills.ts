import { MELEE_RANGE, TILE_SIZE } from "../constants";

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
  | { type: "shield"; multiplier: number; bonus: number; durationMs: number };

/** How the client draws the skill; the server never looks at this. */
export type SkillVisual = "melee" | "spin" | "fireball" | "frost" | "lightning" | "holy" | "heal" | "shield" | "selfHeal";

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

    // ---- Mage (mana)
    skill({ id: "fireball", name: "Ateş Topu", short: "AT", description: "Hedefe yüksek hasarlı bir ateş topu fırlatır. 1,5 sn büyü.", cost: 25, cooldownMs: 0, triggersGcd: true, castMs: 1500, target: "enemy", range: SPELL_RANGE, effect: { type: "strike", multiplier: 2.2, bonus: 8 }, visual: "fireball", color: "#e8590c" }),
    skill({ id: "frostNova", name: "Buz Halkası", short: "BH", description: "Etrafındaki düşmanlara hasar verir ve 4 sn dondurur.", cost: 30, cooldownMs: 12_000, triggersGcd: true, castMs: 0, target: "none", range: 0, effect: { type: "nova", radius: TILE_SIZE * 2.5, multiplier: 0.6, rootMs: 4000 }, visual: "frost", color: "#1c7ed6" }),
    skill({ id: "lightning", name: "Yıldırım", short: "YD", description: "Hedefe anında yıldırım düşürür.", cost: 20, cooldownMs: 6000, triggersGcd: true, castMs: 0, target: "enemy", range: SPELL_RANGE, effect: { type: "strike", multiplier: 1.3, bonus: 4 }, visual: "lightning", color: "#f08c00" }),

    // ---- Priest (mana)
    skill({ id: "smite", name: "Kutsal Işık", short: "Kİ", description: "Hedefi kutsal ışıkla yakar. 1,2 sn büyü.", cost: 20, cooldownMs: 0, triggersGcd: true, castMs: 1200, target: "enemy", range: SPELL_RANGE, effect: { type: "strike", multiplier: 1.8, bonus: 6 }, visual: "holy", color: "#e0a800" }),
    skill({ id: "heal", name: "Şifa", short: "ŞF", description: "Hedef oyuncuyu (yoksa kendini) iyileştirir. 1,5 sn büyü.", cost: 30, cooldownMs: 0, triggersGcd: true, castMs: 1500, target: "friendly", range: SPELL_RANGE, effect: { type: "healTarget", multiplier: 2.5, bonus: 20 }, visual: "heal", color: "#2f9e44" }),
    skill({ id: "shield", name: "Koruyucu Kalkan", short: "KK", description: "Hedef oyuncuya (yoksa kendine) 10 sn hasar emen bir kalkan verir.", cost: 25, cooldownMs: 12_000, triggersGcd: true, castMs: 0, target: "friendly", range: SPELL_RANGE, effect: { type: "shield", multiplier: 2, bonus: 30, durationMs: 10_000 }, visual: "shield", color: "#4dabf7" }),
  ].map((def) => [def.id, def]),
);

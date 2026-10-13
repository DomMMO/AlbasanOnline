import type { Affix, AffixId } from "./affixes";
import { classOf, type ClassId } from "./classes";
import { SKILLS } from "./skills";

// Skill points (Yetenekler, K). Every level gives a point; points buy ranks in the class's
// active skills (rank 1 learns the skill, each rank after that makes it stronger) and in its
// passive skills. Points can be taken back freely. Ranks turn into modifiers (the same Affix
// system as items and jewels), so they flow into the stats like everything else.

export const SKILL_MAX_RANK = 5;
export const PASSIVE_MAX_RANK = 5;
/** Each active rank after the first: this much more effect (%). */
export const SKILL_RANK_BONUS = 12;

export function skillPointsAt(level: number): number {
  return level + 1;
}

export interface PassiveDef {
  id: string;
  name: string;
  /** Character level needed to put points in it. */
  level: number;
  /** Modifier given per rank. */
  affix: AffixId;
  perRank: number;
  /** Shown with the per-rank value, e.g. "+3% saldırı". */
  description: string;
}

const passive = (def: PassiveDef) => def;

export const CLASS_PASSIVES: Record<ClassId, PassiveDef[]> = {
  novice: [],
  warrior: [
    passive({ id: "w_strength", name: "Kas Gücü", level: 2, affix: "attackPct", perRank: 3, description: "Saldırın her derecede %3 artar." }),
    passive({ id: "w_ironSkin", name: "Demir Deri", level: 5, affix: "hpPct", perRank: 3, description: "Canın her derecede %3 artar." }),
    passive({ id: "w_fury", name: "Öfkeli Ruh", level: 10, affix: "critChance", perRank: 1, description: "Kritik şansın her derecede %1 artar." }),
  ],
  shaman: [
    passive({ id: "s_sky", name: "Gök Bilgisi", level: 2, affix: "attackPct", perRank: 3, description: "Gök gücün her derecede %3 artar." }),
    passive({ id: "s_ancestors", name: "Ataların Sesi", level: 5, affix: "int", perRank: 2, description: "Her derecede +2 Zeka." }),
    passive({ id: "s_drum", name: "Davulun Ritmi", level: 10, affix: "attackSpeed", perRank: 2, description: "Saldırı hızın her derecede %2 artar." }),
  ],
  archer: [
    passive({ id: "a_eye", name: "Keskin Göz", level: 2, affix: "critChance", perRank: 1, description: "Kritik şansın her derecede %1 artar." }),
    passive({ id: "a_draw", name: "Gergin Kiriş", level: 5, affix: "attackPct", perRank: 3, description: "Saldırın her derecede %3 artar." }),
    passive({ id: "a_nimble", name: "Çevik Parmaklar", level: 10, affix: "dex", perRank: 2, description: "Her derecede +2 Çeviklik." }),
  ],
  druid: [
    passive({ id: "d_roots", name: "Derin Kökler", level: 2, affix: "hpPct", perRank: 3, description: "Canın her derecede %3 artar." }),
    passive({ id: "d_growth", name: "Filizlenme", level: 5, affix: "attackPct", perRank: 3, description: "Doğanın gücü (hasar ve iyileştirme) her derecede %3 artar." }),
    passive({ id: "d_oak", name: "Meşe Yüreği", level: 10, affix: "damageReduction", perRank: 2, description: "Aldığın hasar her derecede %2 azalır." }),
  ],
  priest: [
    passive({ id: "p_faith", name: "İnanç", level: 2, affix: "attackPct", perRank: 3, description: "Kutsal gücün (hasar ve iyileştirme) her derecede %3 artar." }),
    passive({ id: "p_spirit", name: "Dayanıklı Ruh", level: 5, affix: "vit", perRank: 2, description: "Her derecede +2 Dayanıklılık." }),
    passive({ id: "p_grace", name: "Şifa Bereketi", level: 10, affix: "skill_heal", perRank: 8, description: "Şifa her derecede %8 daha çok iyileştirir." }),
  ],
  necromancer: [
    passive({ id: "n_lore", name: "Ölüm Bilgisi", level: 2, affix: "attackPct", perRank: 3, description: "Karanlık gücün her derecede %3 artar." }),
    passive({ id: "n_army", name: "Kemik Ordusu", level: 5, affix: "minionDamage", perRank: 8, description: "İskeletlerin her derecede %8 daha çok vurur." }),
    passive({ id: "n_leech", name: "Ruh Emici", level: 10, affix: "lifeSteal", perRank: 1, description: "Her derecede hasarının %1'i kadar can çalarsın." }),
  ],
  rogue: [
    passive({ id: "r_precision", name: "Ölümcül Hassasiyet", level: 2, affix: "critChance", perRank: 1, description: "Kritik şansın her derecede %1 artar." }),
    passive({ id: "r_blades", name: "Kanlı Bıçaklar", level: 5, affix: "critDamage", perRank: 6, description: "Kritik vuruşların her derecede %6 daha çok vurur." }),
    passive({ id: "r_agility", name: "Çeviklik Eğitimi", level: 10, affix: "dex", perRank: 2, description: "Her derecede +2 Çeviklik." }),
  ],
};

export function classPassives(classId: string): PassiveDef[] {
  return CLASS_PASSIVES[classOf(classId).id];
}

export type SkillRanks = Record<string, number>;

/** Everything a class can put points in, with its level requirement and max rank. */
export function rankables(classId: string): { id: string; level: number; max: number; kind: "skill" | "passive" }[] {
  return [
    ...classOf(classId).skills.map((id) => ({ id, level: SKILLS[id].level, max: SKILL_MAX_RANK, kind: "skill" as const })),
    ...classPassives(classId).map((p) => ({ id: p.id, level: p.level, max: PASSIVE_MAX_RANK, kind: "passive" as const })),
  ];
}

export function spentPoints(ranks: SkillRanks): number {
  return Object.values(ranks).reduce((sum, rank) => sum + rank, 0);
}

/** Starting allocation: rank 1 in each skill the level allows, in hotbar order, while points last. */
export function defaultRanks(classId: string, level: number): SkillRanks {
  const ranks: SkillRanks = {};
  let points = skillPointsAt(level);
  for (const id of classOf(classId).skills) {
    if (points === 0 || SKILLS[id].level > level) continue;
    ranks[id] = 1;
    points--;
  }
  return ranks;
}

/** Keeps only valid ranks (right class, level allows, within max); falls back to the default if over budget. */
export function sanitizeRanks(classId: string, level: number, value: unknown): SkillRanks {
  const ranks: SkillRanks = {};
  const stored = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  for (const { id, level: required, max } of rankables(classId)) {
    const rank = Math.floor(Number(stored[id]));
    if (rank > 0 && required <= level) ranks[id] = Math.min(rank, max);
  }
  if (Object.keys(ranks).length === 0 || spentPoints(ranks) > skillPointsAt(level)) return defaultRanks(classId, level);
  return ranks;
}

/** Ranks as modifiers: extra active ranks boost their skill, passive ranks give their stat. */
export function ranksToAffixes(classId: string, ranks: SkillRanks): Affix[] {
  const affixes: Affix[] = [];
  for (const id of classOf(classId).skills) {
    const rank = ranks[id] ?? 0;
    if (rank > 1) affixes.push({ id: `skill_${id}`, value: SKILL_RANK_BONUS * (rank - 1) });
  }
  for (const p of classPassives(classId)) {
    const rank = ranks[p.id] ?? 0;
    if (rank > 0) affixes.push({ id: p.affix, value: p.perRank * rank });
  }
  return affixes;
}

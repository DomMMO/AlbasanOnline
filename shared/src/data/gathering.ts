import { TILE_SIZE } from "../constants";

// Life skills: Madencilik (mining) and Botanik (herbalism). Ore veins and herbs grow in the
// open zones; gathering one takes a short channel (moving or taking damage breaks it), needs
// the right tool in your bags and a high enough skill, and raises the skill. Zanaatkâr Murat in
// town hands out the tools and the quests (see quests.ts, chain "Meslekler").

export type LifeSkillId = "mining" | "herbalism";

export const LIFE_SKILLS: Record<LifeSkillId, { name: string; tool: string; verb: string; color: string }> = {
  mining: { name: "Madencilik", tool: "miners_pickaxe", verb: "Kazılıyor", color: "#adb5bd" },
  herbalism: { name: "Botanik", tool: "herb_sickle", verb: "Toplanıyor", color: "#69db7c" },
};

export const LIFE_SKILL_IDS = Object.keys(LIFE_SKILLS) as LifeSkillId[];
export const MAX_LIFE_SKILL = 50;
/** Channel time of one gather. */
export const GATHER_MS = 2200;
/** How close you must stand to a node. */
export const GATHER_RANGE = TILE_SIZE * 1.6;

export function lifeXpToNext(level: number): number {
  return 30 + level * 15;
}

export interface LifeSkillProgress {
  level: number;
  xp: number;
}

export type LifeSkills = Record<LifeSkillId, LifeSkillProgress>;

export function newLifeSkills(): LifeSkills {
  return { mining: { level: 1, xp: 0 }, herbalism: { level: 1, xp: 0 } };
}

export interface NodeDef {
  id: string;
  name: string;
  skill: LifeSkillId;
  /** Skill level needed. */
  level: number;
  item: string;
  qty: [min: number, max: number];
  /** Skill XP per gather. */
  xp: number;
  respawnMs: number;
  /** How it is drawn: a rock with coloured ore, or a plant with coloured flowers. */
  look: { style: "ore" | "herb"; color: number };
  /** Only opens at night (Gece Sefası). */
  nightOnly?: boolean;
}

const node = (def: NodeDef) => def;

export const NODES: Record<string, NodeDef> = Object.fromEntries(
  [
    node({ id: "copper_vein", name: "Bakır Damarı", skill: "mining", level: 1, item: "copper_ore", qty: [1, 2], xp: 12, respawnMs: 40_000, look: { style: "ore", color: 0xd9822b } }),
    node({ id: "iron_vein", name: "Demir Damarı", skill: "mining", level: 12, item: "iron_ore", qty: [1, 2], xp: 22, respawnMs: 50_000, look: { style: "ore", color: 0xa8adb6 } }),
    node({ id: "silver_vein", name: "Gümüş Damarı", skill: "mining", level: 25, item: "silver_ore", qty: [1, 2], xp: 34, respawnMs: 60_000, look: { style: "ore", color: 0xe9ecef } }),
    node({ id: "mithril_vein", name: "Mithril Damarı", skill: "mining", level: 40, item: "mithril_ore", qty: [1, 2], xp: 48, respawnMs: 75_000, look: { style: "ore", color: 0x63e6be } }),
    node({ id: "healing_herb_node", name: "Şifalı Ot", skill: "herbalism", level: 1, item: "healing_herb", qty: [1, 2], xp: 12, respawnMs: 35_000, look: { style: "herb", color: 0xff8787 } }),
    node({ id: "lavender_node", name: "Lavanta", skill: "herbalism", level: 12, item: "lavender", qty: [1, 2], xp: 22, respawnMs: 45_000, look: { style: "herb", color: 0xb197fc } }),
    node({ id: "night_bloom_node", name: "Gece Sefası", skill: "herbalism", level: 25, item: "night_bloom", qty: [1, 2], xp: 34, respawnMs: 55_000, look: { style: "herb", color: 0x4dabf7 }, nightOnly: true }),
    node({ id: "dragon_thorn_node", name: "Ejder Dikeni", skill: "herbalism", level: 40, item: "dragon_thorn", qty: [1, 2], xp: 48, respawnMs: 70_000, look: { style: "herb", color: 0xff6b00 } }),
  ].map((n) => [n.id, n]),
);

/** Where nodes grow (tile centre and radius, like mob spawn zones). Respawn in place after a gather. */
export interface NodeSpawn {
  node: string;
  tx: number;
  ty: number;
  radius: number;
  count: number;
}

export const NODE_SPAWNS: Record<string, NodeSpawn[]> = {
  world: [
    { node: "copper_vein", tx: 24, ty: 17, radius: 6, count: 3 },
    { node: "copper_vein", tx: 41, ty: 31, radius: 6, count: 3 },
    { node: "healing_herb_node", tx: 24, ty: 17, radius: 6, count: 3 },
    { node: "healing_herb_node", tx: 41, ty: 31, radius: 6, count: 3 },
    { node: "iron_vein", tx: 13, ty: 37, radius: 6, count: 3 },
    { node: "lavender_node", tx: 50, ty: 11, radius: 6, count: 4 },
  ],
  forest: [
    { node: "iron_vein", tx: 48, ty: 14, radius: 5, count: 2 },
    { node: "silver_vein", tx: 12, ty: 33, radius: 5, count: 3 },
    { node: "silver_vein", tx: 41, ty: 27, radius: 5, count: 2 },
    { node: "mithril_vein", tx: 52, ty: 35, radius: 4, count: 3 },
    { node: "night_bloom_node", tx: 21, ty: 22, radius: 5, count: 4 },
    { node: "dragon_thorn_node", tx: 14, ty: 11, radius: 5, count: 3 },
  ],
};

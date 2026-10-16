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
    { node: "copper_vein", tx: 49, ty: 35, radius: 6, count: 3 },
    { node: "healing_herb_node", tx: 49, ty: 35, radius: 6, count: 3 },
    { node: "copper_vein", tx: 83, ty: 63, radius: 6, count: 3 },
    { node: "healing_herb_node", tx: 83, ty: 63, radius: 6, count: 3 },
    { node: "lavender_node", tx: 101, ty: 23, radius: 6, count: 4 },
    { node: "iron_vein", tx: 27, ty: 75, radius: 6, count: 3 },
    { node: "copper_vein", tx: 34, ty: 27, radius: 6, count: 3 },
    { node: "healing_herb_node", tx: 34, ty: 27, radius: 6, count: 3 },
    { node: "copper_vein", tx: 77, ty: 29, radius: 6, count: 3 },
    { node: "healing_herb_node", tx: 77, ty: 29, radius: 6, count: 3 },
    { node: "copper_vein", tx: 53, ty: 52, radius: 6, count: 3 },
    { node: "healing_herb_node", tx: 53, ty: 52, radius: 6, count: 3 },
    { node: "copper_vein", tx: 98, ty: 70, radius: 6, count: 3 },
    { node: "healing_herb_node", tx: 98, ty: 70, radius: 6, count: 3 },
    { node: "copper_vein", tx: 69, ty: 73, radius: 6, count: 3 },
    { node: "healing_herb_node", tx: 69, ty: 73, radius: 6, count: 3 },
    { node: "copper_vein", tx: 98, ty: 49, radius: 6, count: 3 },
    { node: "healing_herb_node", tx: 98, ty: 49, radius: 6, count: 3 },
    { node: "lavender_node", tx: 109, ty: 9, radius: 6, count: 4 },
    { node: "lavender_node", tx: 112, ty: 36, radius: 6, count: 4 },
    { node: "lavender_node", tx: 89, ty: 12, radius: 6, count: 4 },
    { node: "iron_vein", tx: 27, ty: 47, radius: 6, count: 3 },
    { node: "iron_vein", tx: 50, ty: 84, radius: 6, count: 3 },
    { node: "iron_vein", tx: 9, ty: 74, radius: 6, count: 3 },
  ],
  forest: [
    { node: "silver_vein", tx: 83, ty: 55, radius: 5.0, count: 2 },
    { node: "night_bloom_node", tx: 43, ty: 45, radius: 5.0, count: 4 },
    { node: "iron_vein", tx: 97, ty: 29, radius: 5.0, count: 2 },
    { node: "dragon_thorn_node", tx: 29, ty: 23, radius: 5.0, count: 3 },
    { node: "silver_vein", tx: 25, ty: 67, radius: 5.0, count: 3 },
    { node: "mithril_vein", tx: 105, ty: 71, radius: 4.0, count: 3 },
    { node: "silver_vein", tx: 76, ty: 70, radius: 5.0, count: 2 },
    { node: "silver_vein", tx: 74, ty: 40, radius: 5.0, count: 2 },
    { node: "silver_vein", tx: 87, ty: 82, radius: 5.0, count: 2 },
    { node: "night_bloom_node", tx: 40, ty: 73, radius: 5.0, count: 4 },
    { node: "night_bloom_node", tx: 57, ty: 20, radius: 5.0, count: 4 },
    { node: "night_bloom_node", tx: 25, ty: 48, radius: 5.0, count: 4 },
    { node: "iron_vein", tx: 97, ty: 47, radius: 5.0, count: 2 },
    { node: "iron_vein", tx: 76, ty: 20, radius: 5.0, count: 2 },
    { node: "iron_vein", tx: 112, ty: 9, radius: 5.0, count: 2 },
    { node: "dragon_thorn_node", tx: 12, ty: 16, radius: 5.0, count: 3 },
    { node: "dragon_thorn_node", tx: 14, ty: 35, radius: 5.0, count: 3 },
    { node: "dragon_thorn_node", tx: 43, ty: 12, radius: 5.0, count: 3 },
    { node: "silver_vein", tx: 11, ty: 85, radius: 5.0, count: 3 },
    { node: "silver_vein", tx: 10, ty: 61, radius: 5.0, count: 3 },
    { node: "silver_vein", tx: 28, ty: 86, radius: 5.0, count: 3 },
    { node: "mithril_vein", tx: 117, ty: 84, radius: 4.0, count: 3 },
    { node: "mithril_vein", tx: 101, ty: 85, radius: 4.0, count: 3 },
    { node: "mithril_vein", tx: 91, ty: 68, radius: 4.0, count: 3 },
  ],
};

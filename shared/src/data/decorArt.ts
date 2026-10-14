import { Tile } from "../map";

// Decor drawn from art files (the CraftPix tileset and object packs, built by
// tools/build_decor.py into client/src/assets/licensed/decor/). Both sides read this table:
// the server for the tiles a piece blocks, the client for how to draw it.
//
// The art is third-party and kept out of the repository, so every piece that blocks tiles
// says what to draw without it: `tile` (the blocked tiles become that tile, e.g. a dead tree,
// which the code draws by itself) or `fallback` (a code-drawn decor piece on the same spot).
// Loose scatter (bones, thorns, ferns) blocks nothing and simply isn't drawn without its art.

export type DecorArtFallback = "barrel" | "crate" | "sack" | "column" | "obelisk" | "balbal" | "dummy" | "cart" | "grave" | "banner" | "rack" | "shelf" | "table" | "tent" | "tree";

export interface DecorArtDef {
  /** Tiles it blocks, from its anchor tile rightwards and downwards; none for scatter. */
  size?: [w: number, h: number];
  /** The blocked tiles become this tile instead of Tile.Solid (drawn by itself without the art). */
  tile?: Tile;
  fallback?: DecorArtFallback;
  /** Lies on the ground (drawn under characters); otherwise depth-sorted like a prop. */
  flat?: boolean;
}

const scatter: DecorArtDef = { flat: true };
const standing: DecorArtDef = {};
const tree: DecorArtDef = { size: [1, 1], tile: Tile.DeadTree };
const keys = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}_${i + 1}`);
const many = (prefix: string, n: number, def: DecorArtDef) => Object.fromEntries(keys(prefix, n).map((key) => [key, def]));

export const DECOR_ART: Record<string, DecorArtDef> = {
  // ---- Undead tileset: Kurgan Ovası, crypts.
  u_lich: { size: [6, 2], fallback: "obelisk" },
  u_skull_door: standing,
  u_skull_pile: { size: [2, 1], fallback: "sack" },
  u_ruin_1: { size: [4, 2], fallback: "column" },
  u_ruin_2: { size: [4, 2], fallback: "column" },
  u_ruin_3: { size: [3, 1], fallback: "column" },
  u_ruin_4: { size: [3, 1], fallback: "column" },
  u_ruin_5: { size: [2, 1], fallback: "balbal" },
  ...many("u_dead_tree", 3, tree),
  ...many("u_tree", 3, tree),
  u_stump_1: tree,
  u_stump_2: tree,
  u_log: { size: [3, 1], fallback: "sack" },
  u_rock_1: { size: [3, 2], fallback: "balbal" },
  u_rock_2: { size: [3, 2], fallback: "balbal" },
  u_rock_3: { size: [2, 1], fallback: "balbal" },
  u_rock_4: { size: [2, 1], fallback: "balbal" },
  u_rock_5: { size: [1, 1], fallback: "balbal" },
  ...many("u_grave", 6, { size: [1, 1], fallback: "grave" }),
  ...many("u_bones", 12, scatter),
  u_bones_big: standing,
  u_ribs_1: standing,
  u_ribs_2: standing,
  u_skull_beast: standing,
  ...many("u_arm", 4, standing),
  ...many("u_thorn", 5, scatter),
  ...many("u_bush", 3, scatter),
  ...many("u_fern", 3, scatter),

  // ---- Dungeon objects: fortresses, mines, lairs.
  d_barrel_1: { size: [2, 1], fallback: "barrel" },
  d_barrel_2: { size: [2, 1], fallback: "barrel" },
  ...many("d_armor", 3, { size: [1, 1], fallback: "dummy" }),
  d_banner_red: { size: [1, 1], fallback: "banner" },
  d_banner_blue: { size: [1, 1], fallback: "banner" },
  d_dragon_skull_1: { size: [2, 1], fallback: "obelisk" },
  d_dragon_skull_2: { size: [2, 1], fallback: "obelisk" },
  d_skull_1: { size: [1, 1], fallback: "balbal" },
  d_skull_2: { size: [1, 1], fallback: "balbal" },
  ...many("d_rack", 4, { size: [2, 1], fallback: "rack" }),
  ...many("d_supplies", 5, { size: [2, 1], fallback: "crate" }),
  ...many("d_shelf", 6, { size: [2, 1], fallback: "shelf" }),

  // ---- Alchemy lab: roots, monster jars, shelves and desks (temples, lairs, ice caves).
  ...many("o_roots", 4, standing),
  o_cocoon_1: { size: [3, 1], fallback: "obelisk" },
  o_cocoon_2: { size: [2, 1], fallback: "obelisk" },
  ...many("o_jar", 5, { size: [1, 1], fallback: "column" }),
  ...many("o_alchemy", 5, { size: [1, 1], fallback: "shelf" }),
  ...many("o_desk", 4, { size: [2, 1], fallback: "table" }),

  // ---- Desert (painted art, scaled down): Kızıl Kanyon.
  ...many("s_cactus", 4, { size: [1, 1], fallback: "balbal" }),
  s_shrub_1: scatter,
  s_shrub_2: scatter,
  s_tent: { size: [3, 2], fallback: "tent" },
  s_wagon: { size: [3, 1], fallback: "cart" },
  s_skull: scatter,
  s_crates: { size: [1, 1], fallback: "crate" },
  s_tower: { size: [3, 2], fallback: "column" },
  s_house: { size: [4, 3], fallback: "column" },
  s_mesa_1: { size: [6, 3], tile: Tile.RedRock },
  s_mesa_2: { size: [7, 3], tile: Tile.RedRock },
  s_rocks_1: { size: [2, 1], tile: Tile.RedRock },
  s_rocks_2: { size: [2, 1], tile: Tile.RedRock },
  s_rock_1: { size: [1, 1], tile: Tile.RedRock },
  ...many("s_palm", 5, { size: [1, 1], fallback: "tree" }),
  s_acacia: { size: [1, 1], fallback: "tree" },
  s_baobab: { size: [2, 1], fallback: "tree" },
  s_dragon_tree: { size: [1, 1], fallback: "tree" },
  s_dead_tree_1: tree,
  s_dead_tree_2: tree,

  // ---- Tropical (painted art): Liman.
  t_palm_1: { size: [1, 1], fallback: "tree" },
  t_palm_2: { size: [1, 1], fallback: "tree" },
  t_statue: { size: [2, 1], fallback: "obelisk" },
  t_fern_1: scatter,
  t_fern_2: scatter,
  t_stones_1: scatter,
  t_stones_2: scatter,
};

/** Every key of a family, e.g. artKeys("u_grave") -> u_grave_1..u_grave_6. */
export const artKeys = (prefix: string) => Object.keys(DECOR_ART).filter((key) => key.startsWith(`${prefix}_`) || key === prefix);

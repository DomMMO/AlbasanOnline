import { TILE_SIZE } from "./constants";
import type { DungeonLayout, SpawnZone } from "./dungeons";
import { Tile } from "./map";
import { artKeys } from "./data/decorArt";
import { Terrain, tilePx } from "./wilds";

// Kurgan Ovası (the Barrow Plain), levels 50-58: south of Kor Toprakları. A withered steppe
// of dead trees where the old khans lie under their kurgans. Unlike the other frontier zones
// it is built from places, not clearings: an old kam's yurt camp at the gate, a dead village
// of plague-struck villagers with its streets and well in the north-east, the kurgan field
// with rows of balbal stones in the west (the great one is Han Kurganı, the dungeon), a
// fenced graveyard in the middle, a bog with a ring of balbals where the dark oracles gather
// in the south-west, and in the south-east the ruined fortress of the fallen knights, where
// Düşkün Başbuğ Karaçor still holds the broken hall.

const WIDTH = 72;
const HEIGHT = 56;

export const KURGAN_SPOTS = {
  /** Teleport gate back to Kor Toprakları, at the north edge. */
  volcanoGate: { x: 11 * TILE_SIZE, y: 3 * TILE_SIZE },
  /** Where you appear coming from Kor Toprakları. */
  fromVolcano: tilePx(10, 5),
  spawn: tilePx(11, 8),
  trader: tilePx(7, 8),
  kam: tilePx(15, 9),
};

const VILLAGE = { tx: 52, ty: 12 };
const KURGANS = { tx: 18, ty: 31 };
const GRAVEYARD = { x0: 33, y0: 24, x1: 46, y1: 37 };
const RITUAL = { tx: 30, ty: 47 };
/** The ruined fortress: outer wall bounds (two tiles thick) and the courtyard inside. */
const FORT = { x0: 48, y0: 33, x1: 68, y1: 52 };
const COURT = { x0: FORT.x0 + 2, y0: FORT.y0 + 2, x1: FORT.x1 - 2, y1: FORT.y1 - 2 };
const BOSS = { tx: 58, ty: 41 };

export const KURGAN_SPAWN_ZONES: SpawnZone[] = [
  { mob: "plague_villager", tx: VILLAGE.tx, ty: VILLAGE.ty, radius: 8, count: 7 },
  { mob: "pale_villager", tx: VILLAGE.tx, ty: VILLAGE.ty, radius: 8, count: 5 },
  { mob: "grave_sentry", tx: 39, ty: 30, radius: 5, count: 6 },
  { mob: "barrow_skeleton", tx: KURGANS.tx, ty: KURGANS.ty, radius: 7, count: 7 },
  { mob: "dark_oracle", tx: RITUAL.tx, ty: RITUAL.ty, radius: 4, count: 6 },
  { mob: "fallen_knight", tx: 58, ty: 38, radius: 4, count: 5 },
  { mob: "black_guard", tx: 52, ty: 48, radius: 2, count: 2 },
  { mob: "black_guard", tx: 64, ty: 48, radius: 2, count: 2 },
  // Night only.
  { mob: "night_walker", tx: VILLAGE.tx, ty: VILLAGE.ty, radius: 8, count: 4 },
  { mob: "barrow_wraith", tx: KURGANS.tx, ty: KURGANS.ty, radius: 7, count: 3 },
  { mob: "fallen_commander_karacor", tx: BOSS.tx, ty: BOSS.ty, radius: 1, count: 1 },
];

export function buildKurgan(): DungeonLayout {
  const t = new Terrain({
    seed: 5501,
    width: WIDTH,
    height: HEIGHT,
    floor: Tile.Blight,
    sprinkle: [[Tile.DeadTree, 0.02]],
    blocker: Tile.DeadTree,
    clump: 0.7,
  });
  const fill = (x0: number, y0: number, x1: number, y1: number, tile: Tile) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t.tiles[y][x] = tile;
  };

  // Open ground where people (and the dead) still walk.
  t.clearing(11, 8, 7, 5);
  t.clearing(VILLAGE.tx, VILLAGE.ty, 12, 9);
  t.clearing(KURGANS.tx, KURGANS.ty - 2, 13, 11);
  fill(GRAVEYARD.x0 - 1, GRAVEYARD.y0 - 1, GRAVEYARD.x1 + 1, GRAVEYARD.y1 + 1, Tile.Blight);
  t.clearing(RITUAL.tx, RITUAL.ty, 6, 5);
  fill(FORT.x0 - 2, FORT.y0 - 3, FORT.x1 + 1, FORT.y1 + 1, Tile.Blight);

  // Where the bones of a giant khan lie half out of the ground, south of the graveyard.
  t.clearing(40, 43, 6, 3);

  // The bog in the south-west: still black water among the dead trees.
  for (const [cx, cy, rx, ry] of [[9, 45, 4, 3], [18, 50, 4, 2], [6, 51, 2, 1], [22, 44, 2, 2]]) t.clearing(cx, cy, rx, ry, Tile.Bog);

  // Roads: down from the gate, east to the village, south past the graveyard to the fortress.
  t.road(10, 2, 10, 26);
  t.road(10, 12, 42, 12);
  t.road(10, 26, 16, 26);
  t.road(40, 12, 40, 30);
  t.road(40, 30, 58, 32);
  t.road(62, 14, 62, 30);
  t.road(58, 30, 62, 30);
  t.road(30, 30, 30, 42);
  t.road(19, 30, 30, 30);

  // ---- The dead village: cobbled streets, empty houses, the old well.
  fill(42, 12, 63, 13, Tile.Cobble);
  fill(51, 4, 52, 21, Tile.Cobble);
  const house = (tx: number, ty: number, w: number, h: number, roof: number, chimney = false) => {
    t.solid(tx, ty, w, h);
    t.decor.push({ kind: "building", tx, ty, w, h, roof, chimney, abandoned: true });
  };
  house(43, 5, 5, 4, 0x3a3a40, true);
  house(56, 5, 5, 4, 0x4a3a2e);
  house(43, 15, 5, 4, 0x2b2b33);
  house(56, 15, 6, 4, 0x3a3a40, true);
  house(46, 16, 3, 3, 0x4a3a2e);
  t.solid(47, 9, 2, 2);
  t.decor.push({ kind: "prop", tx: 47, ty: 9, prop: "well" });
  for (const [tx, ty, prop] of [[49, 17, "cart"], [62, 10, "barrel"], [61, 16, "crate"], [54, 9, "sack"]] as const) t.prop(tx, ty, prop);

  // ---- The kurgan field: mounds of the old khans, balbal stones in rows before them.
  const kurgan = (tx: number, ty: number, w: number, h: number) => {
    t.solid(tx, ty, w, h);
    t.decor.push({ kind: "kurgan", tx, ty, w, h });
  };
  // Han Kurganı, the great one: its door is the dungeon entrance at its foot.
  kurgan(14, 20, 9, 4);
  kurgan(5, 29, 5, 3);
  kurgan(23, 33, 6, 3);
  kurgan(9, 36, 4, 2);
  for (let x = 24; x <= 28; x += 2) t.prop(x, 24, "balbal");
  for (const [tx, ty] of [[11, 29], [11, 31], [21, 36], [14, 38]]) t.prop(tx, ty, "balbal");
  t.dungeonEntrances("kurgan");

  // ---- The graveyard: a fence with a gate north and east, rows of graves inside.
  const fence: { tx: number; ty: number }[] = [];
  const { x0, y0, x1, y1 } = GRAVEYARD;
  for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) fence.push({ tx: x, ty: y });
  for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) fence.push({ tx: x, ty: y });
  const gatePost = fence.filter(({ tx, ty }) => t.tiles[ty][tx] !== Tile.Path);
  t.decor.push({ kind: "fence", tiles: gatePost });
  for (const { tx, ty } of gatePost) t.solid(tx, ty);
  const graves = artKeys("u_grave");
  let g = 0;
  for (const y of [26, 28, 33, 35]) {
    for (const x of [35, 37, 43, 45]) {
      if (x >= x1) continue;
      t.art(graves[g++ % graves.length], x, y, false);
    }
  }
  // The dead reach out of the earth between the rows.
  for (const [tx, ty, key] of [[36, 30, "u_arm_1"], [44, 27, "u_arm_2"], [34, 34, "u_arm_3"], [42, 35, "u_arm_4"]] as const) t.decor.push({ kind: "art", key, tx, ty });

  // ---- The dark oracles' ring of balbals in the bog, a fire in the middle.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    t.prop(Math.round(RITUAL.tx + Math.cos(a) * 4), Math.round(RITUAL.ty + Math.sin(a) * 3), "balbal");
  }
  t.campfire(RITUAL.tx, RITUAL.ty);

  // ---- The ruined fortress: a curtain wall with corner towers, a gate north and a breach west.
  fill(COURT.x0, COURT.y0, COURT.x1, COURT.y1, Tile.Cobble);
  const wall: { tx: number; ty: number }[] = [];
  const towers = [
    { tx: FORT.x0 - 1, ty: FORT.y0 - 1 },
    { tx: FORT.x1 - 2, ty: FORT.y0 - 1 },
    { tx: FORT.x0 - 1, ty: FORT.y1 - 2 },
    { tx: FORT.x1 - 2, ty: FORT.y1 - 2 },
  ];
  const inTower = (x: number, y: number) => towers.some((tw) => x >= tw.tx && x < tw.tx + 4 && y >= tw.ty && y < tw.ty + 4);
  const gate = (x: number, y: number) => (x >= 57 && x <= 60 && y < COURT.y0) || (x < COURT.x0 && y >= 44 && y <= 45);
  for (let y = FORT.y0 - 1; y <= FORT.y1 + 1; y++) {
    for (let x = FORT.x0 - 1; x <= FORT.x1 + 1; x++) {
      const inWall = x >= FORT.x0 && x <= FORT.x1 && y >= FORT.y0 && y <= FORT.y1 && !(x >= COURT.x0 && x <= COURT.x1 && y >= COURT.y0 && y <= COURT.y1);
      if (inTower(x, y)) t.tiles[y][x] = Tile.Wall;
      else if (inWall && gate(x, y)) t.tiles[y][x] = Tile.Cobble;
      else if (inWall) {
        t.tiles[y][x] = Tile.Wall;
        wall.push({ tx: x, ty: y });
      }
    }
  }
  t.decor.push({ kind: "castleWall", tiles: wall, inner: COURT });
  towers.forEach(({ tx, ty }) => t.decor.push({ kind: "tower", tx, ty, w: 4, h: 4, flag: 0x2b2b33 }));
  // Where the hall stood: its broken arches and columns, graves of the fallen at its far end.
  t.art("u_ruin_1", 51, 43, false);
  t.art("u_ruin_2", 62, 43, false);
  t.art("u_ruin_3", 52, 48, false);
  t.art("u_ruin_4", 62, 48, false);
  t.art("u_ruin_5", 55, 39, false);
  for (const [i, tx] of [56, 58, 60].entries()) t.art(graves[i], tx, 49, false);
  for (const [tx, ty] of [[52, 37], [64, 37]]) t.decor.push({ kind: "torch", tx, ty }), t.solid(tx, ty);

  t.art("u_skull_pile", 31, 45, false);

  // ---- The giant khan's bones, Han Kurganı's skull door, and the dead land all round.
  t.art("u_lich", 37, 43, false);
  t.decor.push({ kind: "art", key: "u_skull_door", tx: 18, ty: 23 });
  for (const [tx, ty, key] of [[7, 26, "u_ribs_1"], [27, 28, "u_ribs_2"], [12, 33, "u_skull_beast"], [25, 21, "u_bones_big"]] as const) t.decor.push({ kind: "art", key, tx, ty });
  const keepOut = [
    { tx: 11, ty: 7, r: 6 },
    { tx: VILLAGE.tx, ty: VILLAGE.ty, r: 10 },
    { tx: 39, ty: 30, r: 9 },
    { tx: RITUAL.tx, ty: RITUAL.ty, r: 5 },
    { tx: 58, ty: 43, r: 13 },
    { tx: 18, ty: 26, r: 4 },
  ];
  t.artAround([...artKeys("u_dead_tree"), ...artKeys("u_tree"), "u_stump_1", "u_stump_2"], 26, keepOut);
  t.artAround(["u_rock_3", "u_rock_4", "u_rock_5", "u_log"], 8, keepOut);
  t.scatter(artKeys("u_bones"), KURGANS.tx, KURGANS.ty, 11, 14);
  t.scatter(artKeys("u_bones"), 58, 42, 7, 8);
  t.scatter([...artKeys("u_thorn"), ...artKeys("u_bush")], 36, 28, 34, 40);
  t.scatter(artKeys("u_fern"), 12, 47, 9, 10);
  t.scatter(["u_thorn_1", "u_bones_3", "u_bones_7"], VILLAGE.tx, VILLAGE.ty, 9, 8);

  // ---- The kam's camp at the gate: two felt yurts, a fire, balbals of his ancestors.
  t.tent(4, 5, 0xe8dfc8);
  t.tent(15, 4, 0xd8cfb8);
  t.campfire(13, 7);
  for (const [tx, ty] of [[5, 9], [6, 10]]) t.prop(tx, ty, "balbal");
  t.decor.push({ kind: "banner", tx: 8, ty: 5, color: 0x1c7ed6 });
  t.solid(8, 5);

  return {
    map: { width: WIDTH, height: HEIGHT, tiles: t.tiles, spawn: KURGAN_SPOTS.spawn },
    mobs: [],
    decor: t.decor,
    spawnZones: KURGAN_SPAWN_ZONES,
  };
}

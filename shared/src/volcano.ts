import type { DungeonLayout, SpawnZone } from "./dungeons";
import { Tile } from "./map";
import { Terrain, tilePx } from "./wilds";

// Kor Toprakları (the Ember Lands), levels 40-50: south of the Starting Valley. Ash plains
// among black basalt, cut in two by a river of lava that three bridges cross. An outpost at
// the valley gate, magma slimes and ember wolves in the north, ash cultists in their camp,
// fire elementals, salamanders and lava golems in the south. Ateşhan, the ember giant, waits
// in his cauldron in the south-west and rises again a few minutes after he falls. Two big
// dungeons open here: Magma Ocakları in the east, Kül Tapınağı in the west.

const WIDTH = 64;
const HEIGHT = 48;

export const VOLCANO_SPOTS = {
  /** Teleport gate back to the valley, at the north edge. */
  valleyGate: tilePx(32, 2),
  /** Where you appear coming from the valley. */
  fromValley: tilePx(32, 5),
  spawn: tilePx(31, 7),
  trader: tilePx(28, 6),
  sentinel: tilePx(36, 6),
};

const AREAS = {
  outpost: { tx: 32, ty: 7, r: 5 },
  slimes: { tx: 17, ty: 12, r: 6 },
  wolves: { tx: 47, ty: 12, r: 6 },
  cultists: { tx: 12, ty: 33, r: 6 },
  elementals: { tx: 30, ty: 31, r: 5 },
  salamanders: { tx: 50, ty: 31, r: 5 },
  golems: { tx: 40, ty: 41, r: 4 },
  cauldron: { tx: 22, ty: 42, r: 4 },
};

export const VOLCANO_SPAWN_ZONES: SpawnZone[] = [
  { mob: "magma_slime", tx: AREAS.slimes.tx, ty: AREAS.slimes.ty, radius: 6, count: 7 },
  { mob: "ember_wolf", tx: AREAS.wolves.tx, ty: AREAS.wolves.ty, radius: 6, count: 7 },
  { mob: "ash_cultist", tx: AREAS.cultists.tx, ty: AREAS.cultists.ty, radius: 5, count: 7 },
  { mob: "fire_elemental", tx: AREAS.elementals.tx, ty: AREAS.elementals.ty, radius: 5, count: 5 },
  { mob: "lava_salamander", tx: AREAS.salamanders.tx, ty: AREAS.salamanders.ty, radius: 5, count: 5 },
  { mob: "lava_golem", tx: AREAS.golems.tx, ty: AREAS.golems.ty, radius: 4, count: 4 },
  // Night only.
  { mob: "ash_ghost", tx: AREAS.elementals.tx, ty: AREAS.elementals.ty, radius: 5, count: 3 },
  { mob: "hellhound", tx: AREAS.wolves.tx, ty: AREAS.wolves.ty, radius: 6, count: 3 },
  { mob: "ember_giant_atesan", tx: AREAS.cauldron.tx, ty: AREAS.cauldron.ty, radius: 1, count: 1 },
];

/** Where the lava river runs: its top row at column x (it is RIVER_ROWS deep). */
const riverTop = (x: number) => 21 + Math.round(2 * Math.sin(x * 0.22));
const RIVER_ROWS = 3;

export function buildVolcano(): DungeonLayout {
  const t = new Terrain({
    seed: 4401,
    width: WIDTH,
    height: HEIGHT,
    floor: Tile.Ash,
    sprinkle: [[Tile.Lava, 0.012]],
    blocker: Tile.CaveWall,
    clump: 0.62,
  });
  for (const area of Object.values(AREAS)) t.clearing(area.tx, area.ty, area.r);
  // Ateşhan's cauldron: a ring of lava round the clearing he stands in.
  t.clearing(AREAS.cauldron.tx, AREAS.cauldron.ty, 6, 5, Tile.Lava);
  t.clearing(AREAS.cauldron.tx, AREAS.cauldron.ty, 4, 3);
  // Pools by the golems.
  t.clearing(36, 44, 1, 1, Tile.Lava);
  t.clearing(45, 39, 1, 1, Tile.Lava);

  // The lava river, with open ash along both banks.
  for (let x = 2; x < WIDTH - 2; x++) {
    const top = riverTop(x);
    for (const y of [top - 1, top + RIVER_ROWS]) t.tiles[y][x] = Tile.Ash;
    for (let y = top; y < top + RIVER_ROWS; y++) t.tiles[y][x] = Tile.Lava;
  }

  // Roads: south from the gate, out to every area and both dungeons; bridges where they cross the river.
  t.road(32, 2, 32, 45);
  t.road(17, 12, 32, 12);
  t.road(47, 12, 33, 12);
  t.road(12, 33, 12, 26);
  t.road(12, 26, 32, 26);
  t.road(50, 31, 50, 16);
  t.road(50, 16, 33, 16);
  t.road(30, 31, 31, 31);
  t.road(40, 41, 40, 34);
  t.road(40, 34, 33, 34);
  t.road(22, 38, 22, 34);
  t.road(22, 34, 31, 34);
  t.road(58, 31, 52, 31);
  t.road(6, 18, 6, 26);
  t.road(6, 26, 11, 26);
  // The cauldron's way in: a gap in the lava ring at the top.
  for (let y = 36; y <= 39; y++) for (const x of [22, 23]) t.tiles[y][x] = Tile.Path;
  // Each two-tile road that crosses the river gets one straight deck, bank to bank on both columns.
  for (let x = 2; x < WIDTH - 3; x++) {
    if (t.tiles[riverTop(x)][x] !== Tile.Path) continue;
    const top = Math.min(riverTop(x), riverTop(x + 1)) - 1;
    const bottom = Math.max(riverTop(x), riverTop(x + 1)) + RIVER_ROWS;
    for (let y = top; y <= bottom; y++) for (const bx of [x, x + 1]) t.tiles[y][bx] = Tile.Bridge;
    t.decor.push({ kind: "bridge", tx: x, ty: top, w: 2, h: bottom - top + 1 });
    x++;
  }
  t.dungeonEntrances("volcano");

  // The outpost at the gate.
  t.tent(25, 8, 0x5c3a1e);
  t.tent(37, 8, 0x3a2a1a);
  t.campfire(30, 9);
  for (const [tx, ty, prop] of [[27, 10, "barrel"], [36, 4, "crate"], [37, 4, "crate"], [26, 4, "sack"]] as const) t.prop(tx, ty, prop);
  // The cultists' camp: black tents round a fire.
  for (const [tx, ty] of [[7, 29], [15, 29], [8, 36]]) t.tent(tx, ty, 0x212529);
  t.campfire(12, 31);
  // Obelisks where the elementals gather.
  for (const [tx, ty] of [[26, 28], [35, 28], [26, 34], [35, 30]]) t.prop(tx, ty, "obelisk");

  return {
    map: { width: WIDTH, height: HEIGHT, tiles: t.tiles, spawn: VOLCANO_SPOTS.spawn },
    mobs: [],
    decor: t.decor,
    spawnZones: VOLCANO_SPAWN_ZONES,
  };
}

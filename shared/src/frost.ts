import type { DungeonLayout, SpawnZone } from "./dungeons";
import { Tile } from "./map";
import { Terrain, tilePx } from "./wilds";

// Ayaz Dağları (Frost Mountains), levels 30-40: east of the Starting Valley. Snowfields
// among dark pines, a frozen lake, a hunters' shelter at the valley gate, frost wolves,
// mountain raiders, yetis in the high north, ice golems and wraiths in the south. Ayazhan,
// the frost giant, sits on his throne of ice in the east and rises again a few minutes after
// he falls. Two big dungeons open here: Buz Mağarası in the north-east, Ayaz Kalesi in the south-east.

const WIDTH = 64;
const HEIGHT = 48;

export const FROST_SPOTS = {
  /** Teleport gate back to the valley, at the west edge. */
  valleyGate: tilePx(2, 24),
  /** Where you appear coming from the valley. */
  fromValley: tilePx(6, 25),
  spawn: tilePx(8, 26),
  furrier: tilePx(10, 21),
  guide: tilePx(6, 21),
};

const AREAS = {
  shelter: { tx: 9, ty: 24, r: 6 },
  wolves: { tx: 22, ty: 12, r: 6 },
  slimes: { tx: 23, ty: 36, r: 6 },
  raiders: { tx: 38, ty: 25, r: 6 },
  yetis: { tx: 44, ty: 9, r: 5 },
  wraiths: { tx: 38, ty: 40, r: 5 },
  golems: { tx: 50, ty: 32, r: 5 },
  throne: { tx: 55, ty: 21, r: 4 },
};

export const FROST_SPAWN_ZONES: SpawnZone[] = [
  { mob: "snow_slime", tx: AREAS.slimes.tx, ty: AREAS.slimes.ty, radius: 6, count: 7 },
  { mob: "frost_wolf", tx: AREAS.wolves.tx, ty: AREAS.wolves.ty, radius: 6, count: 7 },
  { mob: "mountain_raider", tx: AREAS.raiders.tx, ty: AREAS.raiders.ty, radius: 6, count: 7 },
  { mob: "yeti", tx: AREAS.yetis.tx, ty: AREAS.yetis.ty, radius: 4, count: 4 },
  { mob: "frost_wraith", tx: AREAS.wraiths.tx, ty: AREAS.wraiths.ty, radius: 5, count: 5 },
  { mob: "ice_golem", tx: AREAS.golems.tx, ty: AREAS.golems.ty, radius: 4, count: 4 },
  // Night only.
  { mob: "blizzard_spirit", tx: AREAS.wraiths.tx, ty: AREAS.wraiths.ty, radius: 5, count: 3 },
  { mob: "white_wolf", tx: AREAS.wolves.tx, ty: AREAS.wolves.ty, radius: 6, count: 3 },
  { mob: "frost_giant_ayazhan", tx: AREAS.throne.tx, ty: AREAS.throne.ty, radius: 1, count: 1 },
];

export function buildFrost(): DungeonLayout {
  const t = new Terrain({
    seed: 3301,
    width: WIDTH,
    height: HEIGHT,
    floor: Tile.Snow,
    sprinkle: [],
    blocker: Tile.SnowTree,
    clump: 0.6,
  });
  for (const area of Object.values(AREAS)) t.clearing(area.tx, area.ty, area.r);
  // The frozen lake between the wolves and the raiders (you can walk on it).
  t.clearing(30, 17, 5, 3, Tile.Ice);

  // Roads: east from the gate, out to every area and both dungeons.
  t.road(2, 24, 55, 24);
  t.road(22, 12, 22, 24);
  t.road(23, 36, 23, 25);
  t.road(44, 9, 44, 24);
  t.road(38, 40, 38, 25);
  t.road(50, 32, 50, 25);
  t.road(57, 9, 57, 24);
  t.road(56, 25, 56, 39);
  t.dungeonEntrances("frost");

  // The hunters' shelter at the gate.
  t.tent(12, 19, 0x6b4a2b);
  t.tent(4, 28, 0x4a3a2a);
  t.campfire(9, 22);
  for (const [tx, ty, prop] of [[13, 28, "barrel"], [14, 28, "crate"], [3, 20, "hay"], [12, 23, "sack"]] as const) t.prop(tx, ty, prop);
  // The raiders' cold camp.
  for (const [tx, ty] of [[33, 21], [41, 28]]) t.tent(tx, ty, 0x3a3a4a);
  t.campfire(38, 22);
  // Ayazhan's throne: a ring of ice-bound standing stones.
  for (const [tx, ty] of [[52, 18], [58, 18], [52, 24], [58, 24]]) t.prop(tx, ty, "obelisk");
  t.prop(55, 17, "column");

  return {
    map: { width: WIDTH, height: HEIGHT, tiles: t.tiles, spawn: FROST_SPOTS.spawn },
    mobs: [],
    decor: t.decor,
    spawnZones: FROST_SPAWN_ZONES,
  };
}

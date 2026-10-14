import type { DungeonLayout, SpawnZone } from "./dungeons";
import { Tile } from "./map";
import { artKeys } from "./data/decorArt";
import { Terrain, tilePx } from "./wilds";

// Kızıl Kanyon (Red Canyon), levels 20-30: west of the Starting Valley. Sand between red
// mesas, a caravan stop at the valley gate, hyenas and jackals in the dry gullies, desert
// raiders in their camp, sandstone golems among old standing stones and minotaurs in the
// south. Kara Toygar, the raiders' bey, rides back to his camp a few minutes after he falls.
// Two big dungeons open here: Kızıl Mağaralar in the west cliff, Gömülü Kervansaray in the north.

const WIDTH = 64;
const HEIGHT = 48;

export const CANYON_SPOTS = {
  /** Teleport gate back to the valley, at the east edge. */
  valleyGate: tilePx(61, 24),
  /** Where you appear coming from the valley. */
  fromValley: tilePx(57, 25),
  spawn: tilePx(55, 26),
  caravanMaster: tilePx(51, 21),
  scout: tilePx(55, 21),
};

const AREAS = {
  camp: { tx: 54, ty: 24, r: 6 },
  hyenas: { tx: 40, ty: 12, r: 6 },
  jackals: { tx: 44, ty: 37, r: 5 },
  dunes: { tx: 31, ty: 24, r: 6 },
  raiders: { tx: 16, ty: 11, r: 7 },
  stones: { tx: 14, ty: 36, r: 5 },
  bulls: { tx: 29, ty: 40, r: 5 },
};

export const CANYON_SPAWN_ZONES: SpawnZone[] = [
  { mob: "sand_slime", tx: AREAS.dunes.tx, ty: AREAS.dunes.ty, radius: 6, count: 7 },
  { mob: "hyena", tx: AREAS.hyenas.tx, ty: AREAS.hyenas.ty, radius: 6, count: 7 },
  { mob: "canyon_jackal", tx: AREAS.jackals.tx, ty: AREAS.jackals.ty, radius: 5, count: 6 },
  { mob: "desert_raider", tx: AREAS.raiders.tx, ty: AREAS.raiders.ty + 2, radius: 6, count: 6 },
  { mob: "raider_veteran", tx: AREAS.raiders.tx, ty: AREAS.raiders.ty, radius: 5, count: 3 },
  { mob: "sandstone_golem", tx: AREAS.stones.tx, ty: AREAS.stones.ty, radius: 4, count: 4 },
  { mob: "canyon_minotaur", tx: AREAS.bulls.tx, ty: AREAS.bulls.ty, radius: 4, count: 4 },
  // Night only.
  { mob: "dune_wraith", tx: AREAS.dunes.tx, ty: AREAS.dunes.ty, radius: 6, count: 4 },
  { mob: "blood_jackal", tx: AREAS.jackals.tx, ty: AREAS.jackals.ty, radius: 5, count: 3 },
  { mob: "raider_bey_toygar", tx: AREAS.raiders.tx, ty: AREAS.raiders.ty - 4, radius: 1, count: 1 },
];

export function buildCanyon(): DungeonLayout {
  const t = new Terrain({
    seed: 2201,
    width: WIDTH,
    height: HEIGHT,
    floor: Tile.Sand,
    sprinkle: [[Tile.Path, 0.06]],
    blocker: Tile.RedRock,
    clump: 0.64,
  });
  for (const area of Object.values(AREAS)) t.clearing(area.tx, area.ty, area.r);
  // An oasis among the dunes.
  t.clearing(33, 31, 3, 2, Tile.Water);
  t.clearing(33, 31, 5, 4);
  t.clearing(33, 31, 2, 1, Tile.Water);

  // Roads: west from the gate across the canyon, out to every area and both dungeons.
  t.road(61, 24, 6, 24);
  t.road(40, 12, 40, 24);
  t.road(44, 37, 44, 25);
  t.road(16, 11, 16, 24);
  t.road(14, 36, 14, 25);
  t.road(29, 40, 29, 25);
  t.road(32, 6, 32, 24);
  t.dungeonEntrances("canyon");

  // The caravan stop at the gate: tents, a fire, crates waiting for the next caravan.
  t.tent(48, 19, 0xb5835a);
  t.tent(57, 28, 0x8a5a2b);
  t.campfire(54, 23);
  for (const [tx, ty, prop] of [[50, 28, "crate"], [51, 28, "barrel"], [52, 29, "sack"], [58, 20, "cart"]] as const) t.prop(tx, ty, prop);
  // The raiders' camp.
  for (const [tx, ty] of [[10, 7], [19, 6], [21, 14]]) t.tent(tx, ty, 0x7a1f1f);
  t.campfire(15, 9);
  t.prop(12, 14, "dummy");
  // Old standing stones where the golems stir.
  for (const [tx, ty] of [[11, 33], [18, 33], [11, 39], [18, 39], [8, 36]]) t.prop(tx, ty, "obelisk");
  // Fallen columns round the way into the buried caravanserai.
  for (const [tx, ty] of [[29, 7], [35, 7], [28, 10], [36, 10]]) t.prop(tx, ty, "column");

  // The caravan stop's wagon and watchtower, a signpost at the gate road.
  t.artNear("s_wagon", 47, 27);
  t.artNear("s_tower", 58, 16);
  t.artNear("s_crates", 59, 22);
  t.artNear("s_house", 44, 17);
  // Red mesas and boulders standing out of the sand, cacti, dry shrubs and bleached skulls.
  const keepOut = [...Object.values(AREAS).map(({ tx, ty, r }) => ({ tx, ty, r: r + 1 })), { tx: 33, ty: 31, r: 5 }];
  for (const [key, tx, ty] of [["s_mesa_1", 5, 40], ["s_mesa_2", 50, 40], ["s_mesa_1", 22, 4], ["s_mesa_2", 46, 4], ["s_mesa_1", 36, 16]] as const) t.artNear(key, tx, ty, 8);
  t.artAround(["s_rocks_1", "s_rocks_2", "s_rock_1"], 10, keepOut);
  t.artAround(artKeys("s_cactus"), 22, keepOut.map((k) => ({ ...k, r: k.r - 3 })));
  // Lone savanna trees on the sand, and palms round the oasis.
  t.artAround(["s_acacia", "s_acacia", "s_baobab", "s_dragon_tree", "s_dead_tree_1", "s_dead_tree_2"], 14, keepOut);
  for (const [i, [tx, ty]] of [[28, 29], [38, 30], [30, 34], [36, 34], [33, 27]].entries()) t.artNear(artKeys("s_palm")[i % 5], tx, ty, 2);
  t.scatter(["s_shrub_1", "s_shrub_2", "s_skull"], 32, 24, 28, 30);

  return {
    map: { width: WIDTH, height: HEIGHT, tiles: t.tiles, spawn: CANYON_SPOTS.spawn },
    mobs: [],
    decor: t.decor,
    spawnZones: CANYON_SPAWN_ZONES,
  };
}

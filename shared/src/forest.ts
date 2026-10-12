import { TILE_SIZE } from "./constants";
import type { Decor, DungeonLayout, SpawnZone } from "./dungeons";
import { mulberry32, Tile, valueNoise } from "./map";

// Kara Orman (Dark Forest), levels 10-20: north of the Starting Valley. A dark wood
// with a swamp, the bandits' camp, an old graveyard, the orcs' hollow and a bear den.
// Rangers keep a small camp at the south gate. Kara Murat, the bandit chief, guards
// the second seal fragment in the bandit camp and comes back a few minutes after he falls.

const WIDTH = 64;
const HEIGHT = 48;

const px = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 1) * TILE_SIZE });

export const FOREST_SPOTS = {
  /** Teleport gate back to the valley, at the south edge. */
  valleyGate: px(32, 45),
  /** Where you appear coming from the valley. */
  fromValley: px(32, 42),
  spawn: px(32, 41),
  ranger: px(29, 40),
  peddler: px(36, 40),
};

const AREAS = {
  camp: { tx: 32, ty: 40, r: 5 },
  bandits: { tx: 48, ty: 12, r: 7 },
  graveyard: { tx: 14, ty: 11, r: 6 },
  orcs: { tx: 12, ty: 33, r: 6 },
  bears: { tx: 52, ty: 35, r: 5 },
  wolves: { tx: 41, ty: 27, r: 5 },
  swamp: { tx: 21, ty: 22, r: 6 },
};

export const FOREST_SPAWN_ZONES: SpawnZone[] = [
  { mob: "dark_wolf", tx: AREAS.wolves.tx, ty: AREAS.wolves.ty, radius: 6, count: 7 },
  { mob: "poison_slime", tx: AREAS.swamp.tx, ty: AREAS.swamp.ty, radius: 6, count: 7 },
  { mob: "bandit", tx: AREAS.bandits.tx, ty: AREAS.bandits.ty + 2, radius: 6, count: 8 },
  { mob: "skeleton", tx: AREAS.graveyard.tx, ty: AREAS.graveyard.ty, radius: 6, count: 8 },
  { mob: "orc", tx: AREAS.orcs.tx, ty: AREAS.orcs.ty, radius: 6, count: 7 },
  { mob: "dire_bear", tx: AREAS.bears.tx, ty: AREAS.bears.ty, radius: 4, count: 3 },
  { mob: "bandit_chief", tx: AREAS.bandits.tx, ty: AREAS.bandits.ty - 3, radius: 1, count: 1 },
];

export function buildForest(): DungeonLayout {
  const rand = mulberry32(9001);
  const noise = valueNoise(rand, WIDTH, HEIGHT, 7);
  const tiles: Tile[][] = [];
  for (let y = 0; y < HEIGHT; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < WIDTH; x++) {
      const n = noise(x, y);
      const r = rand();
      let t: Tile;
      if (x < 2 || y < 2 || x >= WIDTH - 2 || y >= HEIGHT - 2) t = Tile.Tree;
      else if (n > 0.62 && r < 0.75) t = Tile.Tree;
      else if (r < 0.05) t = Tile.Tree;
      else if (r < 0.08) t = Tile.Flower;
      else if (r < 0.25) t = Tile.GrassAlt;
      else t = Tile.DarkGrass;
      row.push(t);
    }
    tiles.push(row);
  }

  const clearing = (cx: number, cy: number, radius: number, tile = Tile.DarkGrass) => {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x < 2 || y < 2 || x >= WIDTH - 2 || y >= HEIGHT - 2) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) tiles[y][x] = tile;
      }
    }
  };
  for (const area of Object.values(AREAS)) clearing(area.tx, area.ty, area.r);
  // The swamp: open water pools inside its clearing.
  for (const [wx, wy] of [[19, 20], [23, 24], [18, 25]]) clearing(wx, wy, 1, Tile.Water);

  // Paths: up from the camp to the crossing, then out to every area.
  const path = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (const y of [y0, y0 + 1]) tiles[y][x] = Tile.Path;
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (const x of [x1, x1 + 1]) tiles[y][x] = Tile.Path;
  };
  path(32, 45, 32, 24);
  path(10, 24, 54, 24);
  path(32, 24, 32, 6);
  path(14, 12, 14, 24);
  path(48, 12, 48, 24);
  path(12, 33, 12, 25);
  path(52, 35, 52, 25);
  path(41, 27, 41, 25);

  const decor: Decor[] = [];
  const solid = (tx: number, ty: number, w = 1, h = 1) => {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) tiles[y][x] = Tile.Solid;
  };
  // Rangers' camp.
  solid(33, 38);
  decor.push({ kind: "campfire", tx: 33, ty: 38 });
  solid(26, 36, 3, 2);
  decor.push({ kind: "tent", tx: 26, ty: 36, w: 3, h: 2, color: 0x2f6b3a });
  solid(37, 36, 3, 2);
  decor.push({ kind: "tent", tx: 37, ty: 36, w: 3, h: 2, color: 0x6b4a2b });
  // Bandit camp tents and fire.
  for (const [tx, ty] of [[43, 8], [51, 7], [53, 14]]) {
    solid(tx, ty, 3, 2);
    decor.push({ kind: "tent", tx, ty, w: 3, h: 2, color: 0x7a1f1f });
  }
  solid(47, 15);
  decor.push({ kind: "campfire", tx: 47, ty: 15 });
  // Graveyard.
  for (const [tx, ty] of [[10, 8], [13, 8], [16, 8], [11, 14], [17, 13], [10, 11]]) {
    solid(tx, ty);
    decor.push({ kind: "grave", tx, ty });
  }

  return {
    map: { width: WIDTH, height: HEIGHT, tiles, spawn: FOREST_SPOTS.spawn },
    mobs: [],
    decor,
    spawnZones: FOREST_SPAWN_ZONES,
  };
}

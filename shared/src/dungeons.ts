import { TILE_SIZE } from "./constants";
import type { IconShape } from "./data/items";
import { mulberry32, Tile, type WorldMap } from "./map";

// Dungeon layouts are carved in code from rooms and corridors: easier to keep
// consistent than hand-aligned ASCII, and identical on server and client.

export interface MobPlacement {
  mob: string;
  /** Feet position in pixels. */
  x: number;
  y: number;
}

/**
 * Things drawn on top of the tiles (buildings, the fountain…), in tile coordinates.
 * The tiles underneath are Tile.Solid, so collision stays purely tile based.
 */
export type Decor =
  | { kind: "building"; tx: number; ty: number; w: number; h: number; roof: number; sign?: { shape: IconShape; color: number }; chimney?: boolean }
  | { kind: "fountain"; tx: number; ty: number; w: number; h: number }
  | { kind: "lamp"; tx: number; ty: number }
  | { kind: "anvil"; tx: number; ty: number }
  | { kind: "banner"; tx: number; ty: number; color: number }
  | { kind: "campfire"; tx: number; ty: number }
  | { kind: "tent"; tx: number; ty: number; w: number; h: number; color: number }
  | { kind: "grave"; tx: number; ty: number }
  | { kind: "bridge"; tx: number; ty: number; w: number; h: number }
  | { kind: "torch"; tx: number; ty: number };

/** An area where a kind of mob lives and respawns (tile coordinates). */
export interface SpawnZone {
  mob: string;
  tx: number;
  ty: number;
  /** Radius in tiles. */
  radius: number;
  count: number;
}

export interface DungeonLayout {
  map: WorldMap;
  mobs: MobPlacement[];
  /** Several spawn points (PvP arena); otherwise players spawn around map.spawn. */
  spawns?: { x: number; y: number }[];
  decor?: Decor[];
  /** Open-world zones: mobs live in these areas and respawn. */
  spawnZones?: SpawnZone[];
}

const px = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 1) * TILE_SIZE });

export function buildGoblinCave(): DungeonLayout {
  const width = 52;
  const height = 34;
  const tiles: Tile[][] = Array.from({ length: height }, () => Array(width).fill(Tile.CaveWall));
  const carve = (x: number, y: number, w: number, h: number) => {
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) tiles[ty][tx] = Tile.CaveFloor;
  };

  carve(2, 2, 10, 8); // entrance hall
  carve(12, 5, 6, 3); // tunnel east
  carve(18, 2, 13, 10); // slime cavern
  carve(23, 12, 3, 5); // tunnel south
  carve(14, 17, 20, 10); // goblin camp
  carve(34, 20, 5, 3); // tunnel to the arena
  carve(39, 13, 11, 18); // chieftain's arena

  // Rough up the walls a little so rooms aren't perfect rectangles.
  const rand = mulberry32(777);
  for (let ty = 1; ty < height - 1; ty++) {
    for (let tx = 1; tx < width - 1; tx++) {
      if (tiles[ty][tx] !== Tile.CaveFloor) continue;
      const nearWall = [tiles[ty - 1][tx], tiles[ty + 1][tx], tiles[ty][tx - 1], tiles[ty][tx + 1]].includes(Tile.CaveWall);
      if (nearWall && rand() < 0.12) tiles[ty][tx] = Tile.CaveWall;
    }
  }
  // ...but keep the doorways and spots we place things on open.
  carve(11, 5, 8, 3);
  carve(23, 11, 3, 7);
  carve(33, 20, 7, 3);
  carve(3, 2, 5, 6); // entrance exit portal + spawn point
  carve(45, 13, 4, 3); // portal to Jack's Cellar
  carve(40, 13, 4, 3); // arena exit portal

  const mobs: MobPlacement[] = [
    { mob: "cave_slime", ...px(21, 5) },
    { mob: "cave_slime", ...px(27, 4) },
    { mob: "cave_slime", ...px(24, 9) },
    { mob: "cave_slime", ...px(29, 9) },
    { mob: "goblin", ...px(17, 20) },
    { mob: "goblin", ...px(20, 24) },
    { mob: "goblin_guard", ...px(26, 21) },
    { mob: "goblin", ...px(29, 25) },
    { mob: "goblin_guard", ...px(31, 19) },
    { mob: "goblin_chief", ...px(45, 22) },
  ];
  for (const mob of mobs) carve(Math.floor(mob.x / TILE_SIZE) - 1, Math.floor(mob.y / TILE_SIZE) - 2, 3, 3);

  return { map: { width, height, tiles, spawn: px(6, 6) }, mobs };
}

/** PvP arena: an open meadow with tree clusters to break line of sight and a pond in the middle. */
export function buildPvpArena(): DungeonLayout {
  const width = 46;
  const height = 34;
  const rand = mulberry32(4242);
  const tiles: Tile[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) return Tile.Tree;
      const r = rand();
      return r < 0.05 ? Tile.Flower : r < 0.3 ? Tile.GrassAlt : Tile.Grass;
    }),
  );
  // Tree clusters (cover) placed symmetrically so no corner is favoured.
  const cluster = (cx: number, cy: number) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [1, 1]]) tiles[cy + dy][cx + dx] = Tile.Tree;
  };
  for (const [cx, cy] of [[12, 9], [33, 9], [12, 24], [33, 24], [22, 6], [22, 27], [7, 16], [38, 16]]) cluster(cx, cy);
  for (let y = 15; y <= 18; y++) for (let x = 20; x <= 25; x++) tiles[y][x] = Tile.Water;

  const spawns = [px(5, 5), px(40, 5), px(5, 29), px(40, 29)];
  for (const s of spawns) {
    const tx = Math.floor(s.x / TILE_SIZE);
    const ty = Math.floor(s.y / TILE_SIZE) - 1;
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) tiles[y][x] = Tile.Grass;
  }
  for (let y = 29; y <= 31; y++) for (let x = 21; x <= 24; x++) tiles[y][x] = Tile.Path; // exit portal pad

  return { map: { width, height, tiles, spawn: px(22, 30) }, mobs: [], spawns };
}

/** Jack's Cellar: a round arena reached through a short tunnel. */
export function buildJackLair(): DungeonLayout {
  const width = 34;
  const height = 28;
  const tiles: Tile[][] = Array.from({ length: height }, () => Array(width).fill(Tile.CaveWall));
  const centre = { x: 17, y: 11 };
  const rand = mulberry32(1031);
  for (let ty = 1; ty < height - 1; ty++) {
    for (let tx = 1; tx < width - 1; tx++) {
      const d = ((tx - centre.x) / 12) ** 2 + ((ty - centre.y) / 9) ** 2;
      // Slightly ragged edge.
      if (d <= 1 - rand() * 0.12) tiles[ty][tx] = Tile.CaveFloor;
    }
  }
  for (let ty = 19; ty < 26; ty++) for (let tx = 15; tx < 20; tx++) tiles[ty][tx] = Tile.CaveFloor; // tunnel + landing
  for (let ty = 23; ty < 26; ty++) for (let tx = 12; tx < 22; tx++) tiles[ty][tx] = Tile.CaveFloor;

  return { map: { width, height, tiles, spawn: px(17, 24) }, mobs: [{ mob: "pumpkin_jack", ...px(17, 10) }] };
}

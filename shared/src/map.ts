import { TILE_SIZE } from "./constants";

// Phase 0 uses a procedurally generated map so we don't need art assets yet.
// Both sides call generateWorldMap() with the same seed and get identical tiles,
// so the server can do collision and the client can render without sending the map.
// Later this gets replaced by maps made in the Tiled editor.

export enum Tile {
  Grass = 0,
  GrassAlt = 1,
  Path = 2,
  Water = 3,
  Tree = 4,
  Flower = 5,
  CaveFloor = 6,
  CaveWall = 7,
  /** Town streets. */
  Cobble = 8,
  /** Town square paving around the fountain. */
  Plaza = 9,
  /** Market square: players may open a stall only here. */
  Market = 10,
  /** City wall. */
  Wall = 11,
  /** Invisible blocker under buildings, the fountain and other decor drawn on top. */
  Solid = 12,
  /** Dark Forest floor. */
  DarkGrass = 13,
  /** Wooden bridge deck (walkable; rails are drawn as decor). */
  Bridge = 14,
}

export const TILE_COUNT = 15;

const BLOCKING = new Set<Tile>([Tile.Water, Tile.Tree, Tile.CaveWall, Tile.Wall, Tile.Solid]);

/** Goblin Cave entrance in the world (tile coordinates); a path leads there from the centre. */
export const CAVE_ENTRANCE_TILE = { tx: 10, ty: 43 };

/** The river in front of the cave and the bridge the cave path crosses it on (tile coordinates). */
export const CAVE_RIVER = { x0: 2, x1: 23, top: 35, rows: 3 };
export const CAVE_BRIDGE = { tx: 10, ty: 34, w: 2, h: 5 };
/** Torches either side of the cave mouth. */
export const CAVE_TORCHES = [
  { tx: 8, ty: 42 },
  { tx: 13, ty: 42 },
];

export interface WorldMap {
  width: number;
  height: number;
  /** tiles[y][x] */
  tiles: Tile[][];
  spawn: { x: number; y: number };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise in [0, 1], sampled on a coarse grid and bilinearly interpolated. */
export function valueNoise(rand: () => number, width: number, height: number, cell: number) {
  const gw = Math.ceil(width / cell) + 2;
  const gh = Math.ceil(height / cell) + 2;
  const grid: number[] = [];
  for (let i = 0; i < gw * gh; i++) grid.push(rand());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const gx = x / cell;
    const gy = y / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const at = (ix: number, iy: number) => grid[iy * gw + ix];
    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

export function generateWorldMap(seed = 1337, width = 64, height = 48): WorldMap {
  const rand = mulberry32(seed);
  const noise = valueNoise(rand, width, height, 8);
  const tiles: Tile[][] = [];

  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      const n = noise(x, y);
      const r = rand();
      let t: Tile;
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) t = Tile.Tree;
      else if (n < 0.25) t = Tile.Water;
      else if (n > 0.75 && r < 0.55) t = Tile.Tree;
      else if (r < 0.02) t = Tile.Tree;
      else if (r < 0.06) t = Tile.Flower;
      else if (r < 0.3) t = Tile.GrassAlt;
      else t = Tile.Grass;
      row.push(t);
    }
    tiles.push(row);
  }

  // A cross of paths through the centre keeps every region reachable from spawn.
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  for (let x = 2; x < width - 2; x++) tiles[cy][x] = tiles[cy + 1][x] = Tile.Path;
  for (let y = 2; y < height - 2; y++) tiles[y][cx] = tiles[y][cx + 1] = Tile.Path;

  // Path from the central crossroads down to the Goblin Cave entrance, with a clearing in front of it.
  const cave = CAVE_ENTRANCE_TILE;
  for (let y = cy; y <= cave.ty; y++) tiles[y][cave.tx] = tiles[y][cave.tx + 1] = Tile.Path;
  for (let x = cave.tx; x <= cx; x++) tiles[cy][x] = tiles[cy + 1][x] = Tile.Path;

  // A river crosses the cave path; the only way over is the bridge. It winds a little
  // but runs straight under the bridge, and ends in a pond.
  const river = CAVE_RIVER;
  for (let x = river.x0; x <= river.x1; x++) {
    const nearBridge = Math.abs(x - (CAVE_BRIDGE.tx + 0.5)) < 4;
    const top = river.top + (nearBridge ? 0 : Math.round(Math.sin(x * 0.45)));
    for (let y = top; y < top + river.rows; y++) tiles[y][x] = Tile.Water;
    // Open banks so the river reads clearly.
    for (const y of [top - 1, top + river.rows]) if (tiles[y][x] === Tile.Tree) tiles[y][x] = Tile.Grass;
  }
  for (let y = river.top - 2; y <= river.top + river.rows + 2; y++) {
    for (let x = river.x1 - 1; x <= river.x1 + 3; x++) tiles[y][x] = Tile.Water;
  }
  const bridge = CAVE_BRIDGE;
  for (let y = bridge.ty; y < bridge.ty + bridge.h; y++) for (let x = bridge.tx; x < bridge.tx + bridge.w; x++) tiles[y][x] = Tile.Bridge;
  for (const y of [bridge.ty - 1, bridge.ty + bridge.h]) {
    for (let x = bridge.tx - 1; x <= bridge.tx + bridge.w; x++) if (tiles[y][x] !== Tile.Path) tiles[y][x] = Tile.Grass;
  }

  for (let y = cave.ty - 2; y <= cave.ty + 1; y++) {
    for (let x = cave.tx - 2; x <= cave.tx + 3; x++) {
      if (tiles[y][x] !== Tile.Path) tiles[y][x] = Tile.Grass;
    }
  }
  for (const torch of CAVE_TORCHES) tiles[torch.ty][torch.tx] = Tile.Solid;

  // Clear plaza around spawn.
  for (let y = cy - 3; y <= cy + 4; y++) {
    for (let x = cx - 3; x <= cx + 4; x++) {
      if (tiles[y][x] !== Tile.Path) tiles[y][x] = Tile.Grass;
    }
  }

  return {
    width,
    height,
    tiles,
    spawn: { x: (cx + 1) * TILE_SIZE, y: (cy + 1) * TILE_SIZE },
  };
}

/** Tiles that block sight (ranged attacks); water doesn't. */
const OPAQUE = new Set<Tile>([Tile.Tree, Tile.CaveWall, Tile.Wall, Tile.Solid]);

/** True when nothing opaque stands between two characters (checked at chest height). */
export function hasLineOfSight(map: WorldMap, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const ax = a.x;
  const ay = a.y - 6;
  const dx = b.x - ax;
  const dy = b.y - 6 - ay;
  const steps = Math.ceil(Math.hypot(dx, dy) / 6);
  for (let i = 1; i < steps; i++) {
    const tx = Math.floor((ax + (dx * i) / steps) / TILE_SIZE);
    const ty = Math.floor((ay + (dy * i) / steps) / TILE_SIZE);
    if (OPAQUE.has(map.tiles[ty]?.[tx])) return false;
  }
  return true;
}

export function isBlockedTile(map: WorldMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
  return BLOCKING.has(map.tiles[ty][tx]);
}

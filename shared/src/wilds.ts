import { TILE_SIZE } from "./constants";
import type { Decor } from "./dungeons";
import { mulberry32, Tile, valueNoise } from "./map";
import { dungeonsIn, type DungeonHost } from "./bigDungeons";

// Shared tools for the open-world zones carved in code (Kızıl Kanyon, Ayaz Dağları): noisy
// ground with clumps of blockers, round clearings, two-tile roads, and the clear patch in
// front of every big dungeon entrance.

/** Feet position of a tile, in pixels. */
export const tilePx = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 1) * TILE_SIZE });

export interface TerrainSpec {
  seed: number;
  width: number;
  height: number;
  /** Walkable ground and its sprinkled variants (each with its share, the rest is `floor`). */
  floor: Tile;
  sprinkle: [tile: Tile, share: number][];
  /** Blocker for the map's rim and for clumps where the noise runs high. */
  blocker: Tile;
  /** Noise above this, mostly blocked (higher = fewer clumps). */
  clump: number;
}

export class Terrain {
  readonly tiles: Tile[][] = [];
  readonly decor: Decor[] = [];
  readonly rand: () => number;

  constructor(readonly spec: TerrainSpec) {
    const { width, height, floor, blocker, clump, sprinkle } = spec;
    this.rand = mulberry32(spec.seed);
    const noise = valueNoise(this.rand, width, height, 7);
    for (let y = 0; y < height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < width; x++) {
        const n = noise(x, y);
        let r = this.rand();
        let t = floor;
        if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) t = blocker;
        else if (n > clump && r < 0.75) t = blocker;
        else if (r < 0.03) t = blocker;
        else {
          r = this.rand();
          for (const [tile, share] of sprinkle) {
            if (r < share) {
              t = tile;
              break;
            }
            r -= share;
          }
        }
        row.push(t);
      }
      this.tiles.push(row);
    }
  }

  private inner(x: number, y: number) {
    return x >= 2 && y >= 2 && x < this.spec.width - 2 && y < this.spec.height - 2;
  }

  /** A round patch of `tile` (the floor by default). */
  clearing(cx: number, cy: number, rx: number, ry = rx, tile = this.spec.floor) {
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        if (this.inner(x, y) && ((x - cx) / (rx + 0.3)) ** 2 + ((y - cy) / (ry + 0.3)) ** 2 <= 1) this.tiles[y][x] = tile;
      }
    }
  }

  /** A two-tile road: across from (x0, y0) to x1, then up or down to y1. */
  road(x0: number, y0: number, x1: number, y1: number, tile = Tile.Path) {
    const put = (x: number, y: number) => {
      if (this.inner(x, y)) this.tiles[y][x] = tile;
    };
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (const y of [y0, y0 + 1]) put(x, y);
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (const x of [x1, x1 + 1]) put(x, y);
  }

  /** Marks tiles solid (decor is drawn on top of them). */
  solid(tx: number, ty: number, w = 1, h = 1) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) this.tiles[y][x] = Tile.Solid;
  }

  tent(tx: number, ty: number, color: number) {
    this.solid(tx, ty, 3, 2);
    this.decor.push({ kind: "tent", tx, ty, w: 3, h: 2, color });
  }

  campfire(tx: number, ty: number) {
    this.solid(tx, ty);
    this.decor.push({ kind: "campfire", tx, ty });
  }

  prop(tx: number, ty: number, prop: Extract<Decor, { kind: "prop" }>["prop"]) {
    this.solid(tx, ty);
    this.decor.push({ kind: "prop", tx, ty, prop });
  }

  /** Keeps the ground clear in front of this zone's big dungeon entrances, with a torch either side. */
  dungeonEntrances(host: DungeonHost) {
    for (const { entranceTile: { tx, ty } } of dungeonsIn(host)) {
      for (let y = ty - 1; y <= ty + 3; y++) for (let x = tx - 2; x <= tx + 2; x++) this.tiles[y][x] = this.spec.floor;
      for (const x of [tx - 2, tx + 2]) {
        this.solid(x, ty);
        this.decor.push({ kind: "torch", tx: x, ty });
      }
    }
  }
}

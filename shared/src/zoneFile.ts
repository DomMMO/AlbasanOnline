import type { Decor, DungeonLayout, MobPlacement, SpawnZone } from "./dungeons";
import { decorFootprint, floorNear, SOLID_DECOR } from "./mapEdits";
import { isBlockingTile, QUARTER, Tile, type BlockShape, type WorldMap } from "./map";
import { TILE_SIZE } from "./constants";

// A zone's map kept as a file (shared/maps/<zone>.json) instead of generated in code.
//
// Version 2: written by Godot from the zone's map scene (yeni-oyun-projesi/maps/<zone>.tscn,
// scripts/map/map_export.gd) every time it is saved; the server reads it, the game uses the scene.
//   tiles    one string per row, one base-36 digit per tile: what the ground is (Tile ids)
//   shapes   what blocks, in pixels: {"r": [x, y, w, h]} boxes and {"p": [x0, y0, ...]} convex
//            polygons; "f" 1 = blocks walking, 2 = blocks sight, 3 = both
//   spawn, spawns, mobs, spawnZones, npcs, portals  as below
//
// Version 1: a zone moved out of code (tools/godot/import-zone.mts) on its way into Godot
// (tools/migrate_map.gd turns it into a map scene):
//
//   tiles      one string per row, one base-36 digit per tile (Tile values); the tiles under
//              standing decor hold the floor, not Tile.Solid: layoutFromFile() puts the blockers
//              back from the decor (on open ground), so a house moved in the editor takes its
//              blocking with it
//   colliders  hitboxes not tied to any decor (invisible walls), [x, y, w, h] in pixels
//   decor      the Decor list as drawn by the client (order = drawing order). A piece may carry
//              `hitbox`: its collision boxes, [x, y, w, h] in pixels from its tile's top-left
//              corner, in place of the tiles it stands on ([] = walk-through)
//   blockMask  quarters of blocking tiles opened up (old web editor maps only)
//   npcs       feet positions of the zone's NPCs, portals the positions of its portals: they
//              override the ones in code (data/npcs.ts, zones.ts)

export type HitboxRect = [x: number, y: number, w: number, h: number];
export type FileDecor = Decor & { hitbox?: HitboxRect[] };

export interface ZoneFileV2 {
  version: 2;
  zone: string;
  width: number;
  height: number;
  tiles: string[];
  shapes: ({ r: HitboxRect; f: number } | { p: number[]; f: number })[];
  spawn: { x: number; y: number };
  spawns?: { x: number; y: number }[];
  mobs: MobPlacement[];
  spawnZones?: SpawnZone[];
  npcs?: Record<string, { x: number; y: number }>;
  portals?: Record<string, { x: number; y: number }>;
  /** Where you stand in this zone after coming through another zone's portal, by that portal's id. */
  arrivals?: Record<string, { x: number; y: number }>;
}

export type ZoneFile = ZoneFileV1 | ZoneFileV2;

export interface ZoneFileV1 {
  version: 1;
  zone: string;
  width: number;
  height: number;
  tiles: string[];
  blockMask?: [number, number][];
  colliders?: HitboxRect[];
  /** Tiles drawn turned, "x,y" -> degrees. */
  rotations?: Record<string, number>;
  spawn: { x: number; y: number };
  spawns?: { x: number; y: number }[];
  mobs: MobPlacement[];
  spawnZones?: SpawnZone[];
  decor: FileDecor[];
  npcs?: Record<string, { x: number; y: number }>;
  portals?: Record<string, { x: number; y: number }>;
}

const footprintTiles = (d: Decor, width: number, height: number) => {
  const f = SOLID_DECOR.has(d.kind) ? decorFootprint(d) : null;
  const out: [number, number][] = [];
  if (!f) return out;
  for (let y = Math.max(0, f.ty); y < f.ty + f.h && y < height; y++) for (let x = Math.max(0, f.tx); x < f.tx + f.w && x < width; x++) out.push([x, y]);
  return out;
};

const toRect = ([x, y, w, h]: HitboxRect, dx = 0, dy = 0): BlockShape => ({ x: x + dx, y: y + dy, w, h, walk: true, sight: true });

const parseTiles = (rows: string[]): Tile[][] => rows.map((row) => Array.from(row, (c) => Number.parseInt(c, 36) as Tile));

/** A Godot map's shapes as the collision code takes them. */
function shapesOf(file: ZoneFileV2): BlockShape[] {
  return file.shapes.map((s) => {
    const walk = (s.f & 1) !== 0;
    const sight = (s.f & 2) !== 0;
    if ("r" in s) return { x: s.r[0], y: s.r[1], w: s.r[2], h: s.r[3], walk, sight };
    const xs = s.p.filter((_, i) => i % 2 === 0);
    const ys = s.p.filter((_, i) => i % 2 === 1);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, points: s.p, walk, sight };
  });
}

/** The layout a zone file describes (version 1: blockers under standing decor and hitboxes included). */
export function layoutFromFile(file: ZoneFile): DungeonLayout & { map: WorldMap } {
  if (file.version === 2) {
    return {
      map: { width: file.width, height: file.height, tiles: parseTiles(file.tiles), spawn: file.spawn, shapesOnly: true, shapes: shapesOf(file) },
      mobs: file.mobs,
      ...(file.spawns ? { spawns: file.spawns } : {}),
      spawnZones: file.spawnZones ?? [],
      decor: [],
    };
  }
  const { width, height } = file;
  const tiles = parseTiles(file.tiles);
  const blockMask = new Map(file.blockMask ?? []);
  const rects: BlockShape[] = (file.colliders ?? []).map((r) => toRect(r));
  const decor: Decor[] = [];
  for (const { hitbox, ...rest } of file.decor) {
    const d = rest as Decor;
    decor.push(d);
    if (hitbox) {
      // Its own collision boxes, from its tile.
      if ("tx" in d && "ty" in d) for (const r of hitbox) rects.push(toRect(r, d.tx * TILE_SIZE, d.ty * TILE_SIZE));
      continue;
    }
    for (const [x, y] of footprintTiles(d, width, height)) {
      // Water, sky or a wall under it already blocks (and is drawn as itself).
      if (isBlockingTile(tiles[y][x])) continue;
      tiles[y][x] = Tile.Solid;
      blockMask.delete(y * width + x);
    }
  }
  return {
    map: { width, height, tiles, spawn: file.spawn, blockMask, ...(rects.length ? { shapes: rects } : {}) },
    mobs: file.mobs,
    ...(file.spawns ? { spawns: file.spawns } : {}),
    spawnZones: file.spawnZones ?? [],
    decor,
    rotations: file.rotations ?? {},
  };
}

/**
 * Boxes covering exactly the set cells of a grid `w` x `h` of QUARTER px squares: runs along
 * each row, stacked down while the rows below have the very same run.
 */
function quarterBoxes(blocked: Set<number>, w: number, h: number): HitboxRect[] {
  const boxes: HitboxRect[] = [];
  const done = new Set<number>();
  const free = (i: number) => blocked.has(i) && !done.has(i);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!free(y * w + x)) continue;
      let x1 = x;
      while (x1 + 1 < w && free(y * w + x1 + 1)) x1++;
      const sameRun = (row: number) => {
        for (let k = x; k <= x1; k++) if (!free(row * w + k)) return false;
        return (x === 0 || !free(row * w + x - 1)) && (x1 + 1 >= w || !free(row * w + x1 + 1));
      };
      let y1 = y;
      while (y1 + 1 < h && sameRun(y1 + 1)) y1++;
      for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) done.add(yy * w + xx);
      boxes.push([x * QUARTER, y * QUARTER, (x1 - x + 1) * QUARTER, (y1 - y + 1) * QUARTER]);
    }
  }
  return boxes;
}

/** Invisible blockers (Tile.Solid not under decor, blocked quarters) of a file turned into hitboxes. */
export function blockersToColliders(file: ZoneFileV1): ZoneFileV1 {
  const { width, height } = file;
  const original = file.tiles.map((row) => Array.from(row, (c) => Number.parseInt(c, 36) as Tile));
  const tiles = original.map((row) => [...row]);
  const masks = new Map(file.blockMask ?? []);
  const blocked = new Set<number>();
  const quarters = (x: number, y: number, mask: number) => {
    for (let q = 0; q < 4; q++) if (mask & (1 << q)) blocked.add((y * 2 + (q >> 1)) * width * 2 + x * 2 + (q & 1));
  };
  const kept: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mask = masks.get(y * width + x);
      if (tiles[y][x] === Tile.Solid) {
        tiles[y][x] = floorNear(original, x, y);
        quarters(x, y, mask ?? 15);
      } else if (mask !== undefined && !isBlockingTile(tiles[y][x])) {
        quarters(x, y, mask);
      } else if (mask !== undefined) {
        // A wall or water with quarters opened up: stays as it is.
        kept.push([y * width + x, mask]);
      }
    }
  }
  const colliders = [...(file.colliders ?? []), ...quarterBoxes(blocked, width * 2, height * 2)];
  const { blockMask: _old, colliders: _c, ...rest } = file;
  const out: ZoneFileV1 = { ...rest, tiles: tiles.map((row) => row.map((t) => t.toString(36)).join("")) };
  // Keep the key order of formatZoneFile: blockMask and colliders right after the tiles.
  const ordered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(out)) {
    ordered[key] = value;
    if (key === "tiles") {
      if (kept.length) ordered.blockMask = kept;
      if (colliders.length) ordered.colliders = colliders;
    }
  }
  return ordered as unknown as ZoneFileV1;
}

/** A zone file of a layout: the floor put back under standing decor, invisible blockers as hitboxes. */
export function fileFromLayout(
  zone: string,
  layout: DungeonLayout & { map: WorldMap },
  npcs: Record<string, { x: number; y: number }>,
  portals: Record<string, { x: number; y: number }>,
): ZoneFileV1 {
  const { width, height } = layout.map;
  const original = layout.map.tiles;
  const tiles = original.map((row) => [...row]);
  const decor: FileDecor[] = [];
  for (const d of layout.decor ?? []) {
    const cells = footprintTiles(d, width, height);
    for (const [x, y] of cells) if (original[y][x] === Tile.Solid) tiles[y][x] = floorNear(original, x, y);
    // Decor whose tiles the code left (partly) open: its hitbox is just the blocked ones.
    const open = cells.filter(([x, y]) => !isBlockingTile(original[y][x]));
    if (open.length === 0 || !("tx" in d)) {
      decor.push(d);
      continue;
    }
    const hitbox: HitboxRect[] = cells
      .filter(([x, y]) => original[y][x] === Tile.Solid)
      .map(([x, y]) => [(x - d.tx) * TILE_SIZE, (y - d.ty) * TILE_SIZE, TILE_SIZE, TILE_SIZE]);
    decor.push({ ...d, hitbox });
  }
  const blockMask = [...(layout.map.blockMask ?? new Map<number, number>()).entries()].sort((a, b) => a[0] - b[0]);
  return blockersToColliders({
    version: 1,
    zone,
    width,
    height,
    tiles: tiles.map((row) => row.map((t) => t.toString(36)).join("")),
    ...(blockMask.length ? { blockMask } : {}),
    ...(layout.rotations && Object.keys(layout.rotations).length ? { rotations: layout.rotations } : {}),
    spawn: layout.map.spawn,
    ...(layout.spawns ? { spawns: layout.spawns } : {}),
    mobs: layout.mobs,
    ...(layout.spawnZones?.length ? { spawnZones: layout.spawnZones } : {}),
    decor,
    npcs,
    portals,
  });
}

/**
 * The file as text, laid out for readable diffs: one row of tiles, one piece of decor, one mob
 * per line. The Godot editor writes the same layout (zone_file.gd).
 */
export function formatZoneFile(input: ZoneFile): string {
  // Fractions to 6 decimals, which both sides read back exactly.
  const file = JSON.parse(JSON.stringify(input, (_k, v) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1e6) / 1e6 : v))) as ZoneFile;
  const lines = Object.entries(file).map(([key, value]) => {
    const head = `  ${JSON.stringify(key)}: `;
    if (Array.isArray(value) && value.length > 0) return `${head}[\n${value.map((v) => `    ${JSON.stringify(v)}`).join(",\n")}\n  ]`;
    if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0) {
      return `${head}{\n${Object.entries(value).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n")}\n  }`;
    }
    return head + JSON.stringify(value);
  });
  return `{\n${lines.join(",\n")}\n}\n`;
}

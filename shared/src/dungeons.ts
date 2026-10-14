import { TILE_SIZE } from "./constants";
import type { IconShape } from "./data/items";
import { mulberry32, Tile, type WorldMap } from "./map";
import { artKeys, DECOR_ART } from "./data/decorArt";

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
  /** `abandoned`: nobody lives there (dark, boarded-up windows, a cold chimney). */
  | { kind: "building"; tx: number; ty: number; w: number; h: number; roof: number; sign?: { shape: IconShape; color: number }; chimney?: boolean; ridge?: "h" | "v"; abandoned?: boolean }
  | { kind: "fountain"; tx: number; ty: number; w: number; h: number }
  | { kind: "lamp"; tx: number; ty: number }
  | { kind: "anvil"; tx: number; ty: number }
  | { kind: "banner"; tx: number; ty: number; color: number }
  | { kind: "campfire"; tx: number; ty: number }
  | { kind: "tent"; tx: number; ty: number; w: number; h: number; color: number }
  | { kind: "grave"; tx: number; ty: number }
  | { kind: "bridge"; tx: number; ty: number; w: number; h: number }
  | { kind: "torch"; tx: number; ty: number }
  /** A wooden signboard on two posts with a word on it (walk-through, not solid). */
  | { kind: "signboard"; tx: number; ty: number; w: number; text: string }
  /** A wooden fence along these tiles (they are solid); each post joins its neighbours. */
  | { kind: "fence"; tiles: { tx: number; ty: number }[] }
  /** A painted line around an area on the ground (the market square). */
  | { kind: "groundFrame"; tx: number; ty: number; w: number; h: number; color: number }
  /**
   * Castle curtain wall on these (Tile.Wall) tiles: a raised wall walk with battlements
   * on the side facing away from `inner` (the courtyard, tile bounds inclusive). A wall that
   * is not a rectangle gives its courtyard as `innerShape` (see insideCastle) instead.
   */
  | { kind: "castleWall"; tiles: { tx: number; ty: number }[]; inner: { x0: number; y0: number; x1: number; y1: number }; innerShape?: CastleShape }
  /** A square wall tower with a crenellated top and a flag. */
  | { kind: "tower"; tx: number; ty: number; w: number; h: number; flag: number }
  /** The wall walk spanning a gate passage (players walk under it), portcullis raised. */
  | { kind: "gateArch"; tx: number; ty: number; w: number; h: number }
  /** The inner keep: a tall stone hall with turrets and hanging banners. */
  | { kind: "keep"; tx: number; ty: number; w: number; h: number; banner: number }
  /** A drawbridge running east-west over the moat (deck tiles are Tile.Bridge). */
  | { kind: "drawbridge"; tx: number; ty: number; w: number; h: number }
  /** Small street clutter on a solid tile (well is 2x2). */
  | { kind: "prop"; tx: number; ty: number; prop: "barrel" | "crate" | "hay" | "well" | "cart" | "column" | "obelisk" | "dummy" | "sack" | "balbal" }
  /** A piece of art decor (data/decorArt.ts): its anchor tile is the top-left of the tiles it blocks. */
  | { kind: "art"; key: string; tx: number; ty: number }
  /** A grassy burial mound (Kurgan Ovası) on these solid tiles, ringed with stones at its foot. */
  | { kind: "kurgan"; tx: number; ty: number; w: number; h: number }
  /** The arena's colosseum (stands, crowd, walls), drawn from COLOSSEUM. */
  | { kind: "colosseum" }
  /** A wooden pier over the water (deck tiles are Tile.Bridge): posts and shadow, no rails. */
  | { kind: "pier"; tx: number; ty: number; w: number; h: number }
  /** A sailing ship moored in the water, bow to the east. */
  | { kind: "ship"; tx: number; ty: number; w: number; h: number }
  /** A striped lighthouse on rocks, its lamp sweeping at night. */
  | { kind: "lighthouse"; tx: number; ty: number; w: number; h: number }
  /** Indoors: a 2x2 stone-ringed fire pit with a big fire. */
  | { kind: "firepit"; tx: number; ty: number }
  /** Indoors: a woven rug lying on the floor (walk-through). */
  | { kind: "rug"; tx: number; ty: number; w: number; h: number; color: number }
  /** Indoors: a long wooden table with mugs and candles, or with a campaign map. */
  | { kind: "table"; tx: number; ty: number; w: number; h: number; map?: boolean }
  /** Indoors: a bookshelf against the back wall. */
  | { kind: "shelf"; tx: number; ty: number; w: number }
  /** Indoors: a weapon rack with swords, axes and spears against the back wall. */
  | { kind: "rack"; tx: number; ty: number; w: number }
  /** Indoors: a three-legged stool someone sits on. */
  | { kind: "stool"; tx: number; ty: number }
  /** Indoors: a plank bench along a table. */
  | { kind: "bench"; tx: number; ty: number; w: number }
  /** A horse standing about (the horse farm): colours as in data/horses.ts. */
  | { kind: "horse"; tx: number; ty: number; look: { coat: number; mane: number; blanket: number; saddle: number }; facing: "left" | "right" | "down" }
  /** A wooden water trough (1x2 tiles wide). */
  | { kind: "trough"; tx: number; ty: number }
  /** A park bench to sit on (walk-through), w tiles wide; `facing` is the way its sitters look. */
  | { kind: "parkBench"; tx: number; ty: number; w: number; facing: "up" | "down" }
  /**
   * A round wooden fence (a paddock): posts on an ellipse round (cx, cy) with radii rx, ry (all
   * in tiles), rails between them, an opening between the angles `gate` (radians, y down).
   */
  | { kind: "roundFence"; cx: number; cy: number; rx: number; ry: number; gate: [number, number] }
  /** A small plant on the grass (walk-through): fern, tall grass, flowers or a weed, by `variant`. */
  | { kind: "plant"; tx: number; ty: number; variant: number }
  /** A round bush (walk-through), plain, with berries or with flowers by `variant`. */
  | { kind: "bush"; tx: number; ty: number; variant: number }
  /** A big leafy tree: its trunk stands on (tx, ty) (solid), the crown spreads about 3x3 tiles above. */
  | { kind: "bigTree"; tx: number; ty: number; variant: number }
  /** The sky round a floating island (w x h tiles): blue below everything, clouds drifting under the island. */
  | { kind: "clouds"; w: number; h: number };

/**
 * A rounded courtyard: tiles whose centre has |dx/a|^p + |dy/b|^p <= 1 round (cx, cy) are inside,
 * where a and b may swell with the angle by `wobble` (amplitude, number of bumps, phase).
 */
export interface CastleShape {
  cx: number;
  cy: number;
  a: number;
  b: number;
  p: number;
  wobble?: [amplitude: number, bumps: number, phase: number];
}

/** Whether tile (tx, ty) is inside a rounded castle shape. */
export function insideCastle(shape: CastleShape, tx: number, ty: number, shrink = 0): boolean {
  const dx = tx + 0.5 - shape.cx;
  const dy = ty + 0.5 - shape.cy;
  const [amp, bumps, phase] = shape.wobble ?? [0, 0, 0];
  const k = 1 + amp * Math.sin(bumps * Math.atan2(dy, dx) + phase);
  const a = Math.max(1, shape.a * k - shrink);
  const b = Math.max(1, shape.b * k - shrink);
  return Math.abs(dx / a) ** shape.p + Math.abs(dy / b) ** shape.p <= 1;
}

/** An area where a kind of mob lives and respawns (tile coordinates). */
export interface SpawnZone {
  mob: string;
  tx: number;
  ty: number;
  /** Radius in tiles. */
  radius: number;
  count: number;
}

/**
 * Places a piece of art decor: blocks its tiles (as Tile.Solid, or the tile its entry names)
 * and adds it to `decor`. Returns false, placing nothing, if any of those tiles isn't `free`.
 */
export function placeArt(tiles: Tile[][], decor: Decor[], key: string, tx: number, ty: number, free: (tx: number, ty: number) => boolean = () => true): boolean {
  const def = DECOR_ART[key];
  if (!def) throw new Error(`unknown decor art ${key}`);
  const [w, h] = def.size ?? [0, 0];
  for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (tiles[y]?.[x] === undefined || !free(x, y)) return false;
  for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) tiles[y][x] = def.tile ?? Tile.Solid;
  decor.push({ kind: "art", key, tx, ty });
  return true;
}

export interface DungeonLayout {
  map: WorldMap;
  mobs: MobPlacement[];
  /** Several spawn points (PvP arena); otherwise players spawn around map.spawn. */
  spawns?: { x: number; y: number }[];
  decor?: Decor[];
  /** Open-world zones: mobs live in these areas and respawn. */
  spawnZones?: SpawnZone[];
  /** Map editor: tiles drawn turned, "x,y" -> degrees (90, 180, 270). */
  rotations?: Record<string, number>;
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
/**
 * The Blood Arena as a colosseum: an oval of sand ringed by a marble podium wall, tiers of
 * stands full of spectators, an arcaded outer wall and the emperor's box in the north.
 * Rings are fractions of the outer ellipse (rx x ry tiles around cx, cy): the client draws
 * the same rings, so what you see matches where you can walk.
 */
export const COLOSSEUM = { cx: 32, cy: 23, rx: 28, ry: 21, floor: 0.607, podium: 0.64, wall: 0.93 };

/** Normalised elliptical distance from the colosseum centre (1 = the outer wall's edge), in pixels. */
export function colosseumRing(x: number, y: number): number {
  const { cx, cy, rx, ry } = COLOSSEUM;
  return Math.hypot((x - cx * TILE_SIZE) / (rx * TILE_SIZE), (y - cy * TILE_SIZE) / (ry * TILE_SIZE));
}

export function buildPvpArena(): DungeonLayout {
  const width = 64;
  const height = 48;
  const { cx, cy } = COLOSSEUM;
  const rand = mulberry32(4242);
  const tiles: Tile[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const ring = colosseumRing((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE);
      // Sand inside (with a little margin so feet stay off the podium), stands and walls solid.
      if (ring < COLOSSEUM.floor - 0.015) return Tile.Path;
      if (ring <= 1.02) return Tile.Solid;
      if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return Tile.Tree;
      return rand() < 0.08 ? Tile.Tree : Tile.Cobble;
    }),
  );

  const decor: Decor[] = [{ kind: "colosseum" }];
  const solid = (tx: number, ty: number) => (tiles[ty][tx] = Tile.Solid);
  // Marble columns and an obelisk in the middle: cover to break line of sight.
  for (const [tx, ty, prop] of [
    [cx - 7, cy - 3, "column"],
    [cx + 6, cy - 3, "column"],
    [cx - 7, cy + 4, "column"],
    [cx + 6, cy + 4, "column"],
    [cx - 1, cy, "obelisk"],
  ] as const) {
    solid(tx, ty);
    if (prop === "obelisk") solid(tx + 1, ty);
    decor.push({ kind: "prop", tx, ty, prop });
  }
  // Torches on the podium wall all the way round.
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + Math.PI / 16;
    const r = (COLOSSEUM.floor + COLOSSEUM.podium) / 2;
    const tx = Math.floor(cx + Math.cos(angle) * COLOSSEUM.rx * r);
    const ty = Math.floor(cy + Math.sin(angle) * COLOSSEUM.ry * r);
    if (Math.abs(Math.sin(angle)) > 0.97 && Math.sin(angle) > 0) continue; // keep the south gate clear
    decor.push({ kind: "torch", tx, ty });
  }
  // Banners along the top of the outer wall (north half, where you can see them).
  for (let i = 0; i <= 8; i++) {
    const angle = Math.PI + (i / 8) * Math.PI;
    const r = (COLOSSEUM.wall + 1) / 2;
    decor.push({ kind: "banner", tx: Math.floor(cx + Math.cos(angle) * COLOSSEUM.rx * r), ty: Math.floor(cy + Math.sin(angle) * COLOSSEUM.ry * r), color: 0x9c1a1a });
  }

  const spawns = [px(cx - 14, cy + 1), px(cx + 14, cy + 1), px(cx - 7, cy - 9), px(cx + 7, cy - 9)];
  return { map: { width, height, tiles, spawn: px(cx, cy + 10) }, mobs: [], spawns, decor };
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

// ---- Big dungeons -----------------------------------------------------------------
// Laid out by a generator: a chain of rooms on a grid, snaking left-right and down a row,
// joined by corridors. Rooms are an entrance, mob packs and boss rooms; the last boss
// room holds the exit, which opens once every boss in the dungeon is dead.
// A theme gives each dungeon its own look: the shapes its rooms are cut in (ragged caverns,
// pillared halls, rooms with pools in the corners...), its pools (water, lava), its clutter
// and torches. Every room keeps a three-tile cross through its centre open, so the corridors
// always join up and the boss always has room to stand.

export type DungeonRoom =
  | { kind: "entrance" }
  | { kind: "pack"; mobs: [mob: string, count: number][] }
  | { kind: "boss"; boss: string; guards?: [mob: string, count: number][]; final?: boolean };

export type DungeonTheme = "mine" | "temple" | "crypt" | "fortress" | "lair" | "redcave" | "ruins" | "ice" | "citadel" | "ashtemple";

type RoomShape = "rect" | "cavern" | "octagon" | "cross" | "pillars" | "pools" | "blocks";
type Prop = Extract<Decor, { kind: "prop" }>["prop"];

interface ThemeStyle {
  /** Shapes for pack rooms and boss rooms, used in turn. */
  packShapes: RoomShape[];
  bossShapes: RoomShape[];
  /** What fills the corner pools of "pools" rooms. */
  pool: Tile;
  /** Pillars: stone columns (drawn), or plain wall tiles (rock). */
  columns: boolean;
  /** Clutter standing along the walls. */
  props: Prop[];
  /** Graves in rows (crypts), a camp (tent and fire) in pack rooms, a weapon rack on the back wall. */
  graves?: boolean;
  camps?: boolean;
  racks?: boolean;
  torches: boolean;
  /** Rooms per row of the grid. */
  cols: number;
  /** Art decor (data/decorArt.ts): pieces standing along the walls, banners hung on the back wall, loose clutter on the floor. */
  art?: string[];
  banners?: string[];
  scatter?: string[];
}

const THEMES: Record<DungeonTheme, ThemeStyle> = {
  mine: { packShapes: ["cavern", "blocks", "cavern", "rect"], bossShapes: ["cavern", "pillars"], pool: Tile.Water, columns: false, props: ["crate", "barrel", "cart", "sack"], torches: true, cols: 4, art: [...artKeys("d_supplies"), ...artKeys("d_barrel")], scatter: ["u_rock_5", "u_bones_2"] },
  temple: { packShapes: ["pools", "pillars", "cross", "pools"], bossShapes: ["pillars", "pools"], pool: Tile.Water, columns: true, props: ["obelisk", "column"], torches: true, cols: 4, art: artKeys("o_jar"), scatter: artKeys("u_fern") },
  crypt: { packShapes: ["rect", "cross", "pillars", "octagon"], bossShapes: ["octagon", "pillars"], pool: Tile.Water, columns: true, props: ["column", "sack"], graves: true, torches: true, cols: 3, art: ["u_skull_pile", "d_skull_1", "d_skull_2", "u_ruin_5"], scatter: artKeys("u_bones") },
  fortress: { packShapes: ["rect", "blocks", "cross", "rect"], bossShapes: ["octagon", "blocks"], pool: Tile.Water, columns: false, props: ["barrel", "crate", "hay", "dummy"], camps: true, racks: true, torches: true, cols: 4, art: [...artKeys("d_armor"), ...artKeys("d_rack"), ...artKeys("d_supplies"), ...artKeys("d_barrel")], banners: ["d_banner_red"] },
  lair: { packShapes: ["cavern", "pools", "cavern", "blocks"], bossShapes: ["pools", "cavern"], pool: Tile.Lava, columns: false, props: ["obelisk"], torches: false, cols: 4, art: ["d_dragon_skull_1", "d_dragon_skull_2", ...artKeys("o_roots")], scatter: [...artKeys("u_bones"), "u_ribs_1", "u_ribs_2"] },
  redcave: { packShapes: ["cavern", "blocks", "cavern", "cross"], bossShapes: ["cavern", "octagon"], pool: Tile.Water, columns: false, props: ["sack", "crate", "barrel"], camps: true, torches: true, cols: 3, art: [...artKeys("d_supplies"), "d_skull_1"], scatter: ["s_skull", "u_bones_1", "u_bones_4"] },
  ruins: { packShapes: ["pillars", "cross", "blocks", "octagon"], bossShapes: ["pillars", "octagon"], pool: Tile.Water, columns: true, props: ["column", "obelisk", "sack", "cart"], torches: true, cols: 5, art: ["u_ruin_3", "u_ruin_4", "u_ruin_5", ...artKeys("d_supplies")], scatter: ["s_skull", "s_shrub_2", "u_bones_5"] },
  ice: { packShapes: ["cavern", "pools", "pillars", "cavern"], bossShapes: ["cavern", "pools"], pool: Tile.Water, columns: false, props: ["obelisk"], torches: false, cols: 4, art: [...artKeys("o_cocoon"), ...artKeys("o_roots")] },
  citadel: { packShapes: ["octagon", "pillars", "cross", "blocks"], bossShapes: ["pillars", "octagon"], pool: Tile.Ice, columns: true, props: ["barrel", "crate", "column"], racks: true, torches: true, cols: 4, art: [...artKeys("d_armor"), ...artKeys("d_rack"), ...artKeys("d_shelf")], banners: ["d_banner_blue"] },
  ashtemple: { packShapes: ["pillars", "pools", "octagon", "pools"], bossShapes: ["pools", "pillars"], pool: Tile.Lava, columns: true, props: ["obelisk", "column"], torches: true, cols: 4, art: [...artKeys("o_alchemy"), ...artKeys("o_desk"), ...artKeys("o_jar"), "d_dragon_skull_1"], banners: ["d_banner_red"] },
};

export interface DungeonSpec {
  seed: number;
  wall: Tile;
  floor: Tile;
  theme: DungeonTheme;
  rooms: DungeonRoom[];
}

export interface BuiltDungeon extends DungeonLayout {
  /** Way out from the entrance room (always open). */
  entrancePortal: { x: number; y: number };
  /** Way out from the final boss room (opens when the dungeon is cleared). */
  exitPortal: { x: number; y: number };
}

const CELL_W = 22;
const CELL_H = 17;

export function buildDungeon(spec: DungeonSpec): BuiltDungeon {
  const style = THEMES[spec.theme];
  const cols = style.cols;
  const rows = Math.ceil(spec.rooms.length / cols);
  const width = cols * CELL_W + 2;
  const height = rows * CELL_H + 2;
  const tiles: Tile[][] = Array.from({ length: height }, () => Array(width).fill(spec.wall));
  const rand = mulberry32(spec.seed);
  const inside = (tx: number, ty: number) => ty > 0 && tx > 0 && ty < height - 1 && tx < width - 1;
  const set = (tx: number, ty: number, tile: Tile) => {
    if (inside(tx, ty)) tiles[ty][tx] = tile;
  };
  const carve = (x: number, y: number, w: number, h: number) => {
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) set(tx, ty, spec.floor);
  };
  const jitter = () => Math.floor(rand() * 3) - 1;

  const rects = spec.rooms.map((room, i) => {
    const row = Math.floor(i / cols);
    const col = row % 2 === 0 ? i % cols : cols - 1 - (i % cols);
    const [baseW, baseH] = room.kind === "entrance" ? [10, 8] : room.kind === "pack" ? [15, 11] : room.final ? [19, 14] : [17, 13];
    const w = baseW + Math.floor(rand() * 3);
    const h = baseH + Math.floor(rand() * 2);
    return {
      x: 1 + col * CELL_W + Math.floor((CELL_W - w) / 2) + jitter(),
      y: 1 + row * CELL_H + Math.floor((CELL_H - h) / 2) + jitter(),
      w,
      h,
    };
  });
  type Rect = (typeof rects)[number];
  const centre = (r: Rect) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });
  /** The open cross through a room's centre, where corridors arrive and the boss stands. */
  const inCross = (r: Rect, tx: number, ty: number) => {
    const c = centre(r);
    return Math.abs(tx - c.x) <= 1 || Math.abs(ty - c.y) <= 1;
  };

  const shapeOf = (room: DungeonRoom, i: number): RoomShape => {
    if (room.kind === "entrance") return "rect";
    const list = room.kind === "pack" ? style.packShapes : style.bossShapes;
    return list[i % list.length];
  };
  const decor: Decor[] = [];

  // Rooms in their shapes.
  rects.forEach((r, i) => {
    carve(r.x, r.y, r.w, r.h);
    const c = centre(r);
    const shape = shapeOf(spec.rooms[i], i);
    const each = (fn: (tx: number, ty: number) => void) => {
      for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) if (!inCross(r, tx, ty)) fn(tx, ty);
    };
    if (shape === "cavern") {
      // An ellipse with a ragged rim.
      each((tx, ty) => {
        const d = ((tx + 0.5 - (r.x + r.w / 2)) / (r.w / 2)) ** 2 + ((ty + 0.5 - (r.y + r.h / 2)) / (r.h / 2)) ** 2;
        if (d > 0.95 - rand() * 0.2) set(tx, ty, spec.wall);
      });
    } else if (shape === "octagon") {
      each((tx, ty) => {
        const ex = Math.min(tx - r.x, r.x + r.w - 1 - tx);
        const ey = Math.min(ty - r.y, r.y + r.h - 1 - ty);
        if (ex + ey < 3) set(tx, ty, spec.wall);
      });
    } else if (shape === "cross") {
      const cw = Math.floor(r.w * 0.28);
      const ch = Math.floor(r.h * 0.3);
      each((tx, ty) => {
        const ex = Math.min(tx - r.x, r.x + r.w - 1 - tx);
        const ey = Math.min(ty - r.y, r.y + r.h - 1 - ty);
        if (ex < cw && ey < ch) set(tx, ty, spec.wall);
      });
    } else if (shape === "pillars") {
      // A grid of pillars, two tiles in from the walls.
      for (let ty = r.y + 2; ty < r.y + r.h - 2; ty += 3) {
        for (let tx = r.x + 2; tx < r.x + r.w - 2; tx += 4) {
          if (inCross(r, tx, ty)) continue;
          if (style.columns) {
            set(tx, ty, Tile.Solid);
            decor.push({ kind: "prop", tx, ty, prop: "column" });
          } else set(tx, ty, spec.wall);
        }
      }
    } else if (shape === "pools") {
      // A pool in each quarter of the room.
      for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = c.x + qx * Math.floor(r.w / 4);
        const cy = c.y + qy * Math.floor(r.h / 4);
        const rx = Math.max(1, Math.floor(r.w / 8));
        const ry = Math.max(1, Math.floor(r.h / 8));
        for (let ty = cy - ry; ty <= cy + ry; ty++) {
          for (let tx = cx - rx; tx <= cx + rx; tx++) {
            if (inCross(r, tx, ty) || tx <= r.x || ty <= r.y || tx >= r.x + r.w - 1 || ty >= r.y + r.h - 1) continue;
            if (((tx - cx) / (rx + 0.5)) ** 2 + ((ty - cy) / (ry + 0.5)) ** 2 <= 1) set(tx, ty, style.pool);
          }
        }
      }
    } else if (shape === "blocks") {
      // A chunk of wall to hide behind in each quarter.
      for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const bw = 2 + Math.floor(rand() * 2);
        const bh = 2;
        const bx = c.x + qx * (3 + Math.floor(rand() * 2)) - (qx < 0 ? bw - 1 : 0);
        const by = c.y + qy * 3 - (qy < 0 ? bh - 1 : 0);
        for (let ty = by; ty < by + bh; ty++) for (let tx = bx; tx < bx + bw; tx++) if (!inCross(r, tx, ty)) set(tx, ty, spec.wall);
      }
    }
  });

  // Corridors along the room centres (the open crosses line up with them).
  for (let i = 1; i < rects.length; i++) {
    const a = centre(rects[i - 1]);
    const b = centre(rects[i]);
    carve(Math.min(a.x, b.x) - 1, a.y - 1, Math.abs(a.x - b.x) + 3, 3);
    carve(b.x - 1, Math.min(a.y, b.y) - 1, 3, Math.abs(a.y - b.y) + 3);
  }

  const isFloor = (tx: number, ty: number) => tiles[ty]?.[tx] === spec.floor;
  const solid = (tx: number, ty: number) => (tiles[ty][tx] = Tile.Solid);
  /** Floor tiles of a room (off its open cross) that pass `test`. */
  const spots = (r: Rect, test: (tx: number, ty: number) => boolean) => {
    const out: [number, number][] = [];
    for (let ty = r.y + 1; ty < r.y + r.h - 1; ty++) {
      for (let tx = r.x + 1; tx < r.x + r.w - 1; tx++) if (isFloor(tx, ty) && !inCross(r, tx, ty) && test(tx, ty)) out.push([tx, ty]);
    }
    return out;
  };
  const againstWall = (tx: number, ty: number) => [tiles[ty - 1]?.[tx], tiles[ty + 1]?.[tx], tiles[ty]?.[tx - 1], tiles[ty]?.[tx + 1]].includes(spec.wall);
  const take = <T>(list: T[]) => list.splice(Math.floor(rand() * list.length), 1)[0];

  // Torches, racks, camps, graves and clutter.
  rects.forEach((r, i) => {
    const room = spec.rooms[i];
    if (room.kind === "entrance") return;
    if (style.torches) {
      for (const tx of [r.x + 3, r.x + r.w - 4]) {
        if (isFloor(tx, r.y) && !inCross(r, tx, r.y) && tiles[r.y - 1]?.[tx] === spec.wall) {
          solid(tx, r.y);
          decor.push({ kind: "torch", tx, ty: r.y });
        }
      }
    }
    if (style.racks && room.kind === "boss") {
      const tx = centre(r).x + 3;
      if ([tx, tx + 1].every((x) => isFloor(x, r.y) && !inCross(r, x, r.y))) {
        solid(tx, r.y);
        solid(tx + 1, r.y);
        decor.push({ kind: "rack", tx, ty: r.y, w: 2 });
      }
    }
    if (style.camps && room.kind === "pack" && i % 2 === 1) {
      // A tent in the top-left corner and its fire in front.
      const tx = r.x + 1;
      const ty = r.y + 1;
      const open = (x: number, y: number) => isFloor(x, y) && !inCross(r, x, y);
      if ([0, 1, 2].every((dx) => open(tx + dx, ty) && open(tx + dx, ty + 1)) && open(tx + 1, ty + 3)) {
        for (const dx of [0, 1, 2]) for (const dy of [0, 1]) solid(tx + dx, ty + dy);
        decor.push({ kind: "tent", tx, ty, w: 3, h: 2, color: spec.theme === "redcave" ? 0x8a5a2b : 0x6b1f1f });
        solid(tx + 1, ty + 3);
        decor.push({ kind: "campfire", tx: tx + 1, ty: ty + 3 });
      }
    }
    if (style.graves && room.kind === "pack") {
      for (const [tx, ty] of spots(r, (tx, ty) => (tx - r.x) % 3 === 2 && (ty - r.y) % 3 === 2)) {
        if (rand() < 0.45) {
          solid(tx, ty);
          decor.push({ kind: "grave", tx, ty });
        }
      }
    }
    const free = spots(r, againstWall);
    for (let n = 2 + Math.floor(rand() * 3); n > 0 && free.length > 0; n--) {
      const [tx, ty] = take(free);
      solid(tx, ty);
      decor.push({ kind: "prop", tx, ty, prop: style.props[Math.floor(rand() * style.props.length)] });
    }
    // Art decor: a banner on the back wall between the torches, pieces along the walls, clutter on the floor.
    const open = (x: number, y: number) => isFloor(x, y) && !inCross(r, x, y);
    if (style.banners) {
      const banner = style.banners[i % style.banners.length];
      for (const tx of r.w > 14 ? [r.x + 6, r.x + r.w - 7] : [r.x + 6]) {
        if (tiles[r.y - 1]?.[tx] === spec.wall) placeArt(tiles, decor, banner, tx, r.y, open);
      }
    }
    if (style.art) {
      const wallSpots = spots(r, againstWall);
      for (let n = 1 + Math.floor(rand() * 3), tries = 0; n > 0 && wallSpots.length > 0 && tries < 12; tries++) {
        const [tx, ty] = take(wallSpots);
        if (placeArt(tiles, decor, style.art[Math.floor(rand() * style.art.length)], tx, ty, open)) n--;
      }
    }
    if (style.scatter) {
      const floor = spots(r, (x, y) => !againstWall(x, y));
      for (let n = 3 + Math.floor(rand() * 4); n > 0 && floor.length > 0; n--) {
        const [tx, ty] = take(floor);
        decor.push({ kind: "art", key: style.scatter[Math.floor(rand() * style.scatter.length)], tx, ty });
      }
    }
  });

  // Mobs, the spawn point and the portals.
  const mobs: MobPlacement[] = [];
  let entrancePortal = { x: 0, y: 0 };
  let exitPortal = { x: 0, y: 0 };
  let spawn = { x: 0, y: 0 };
  spec.rooms.forEach((room, i) => {
    const r = rects[i];
    const c = centre(r);
    const scatter = (list: [string, number][], keepClear = 0) => {
      for (const [mob, count] of list) {
        for (let n = 0; n < count; n++) {
          let at = { tx: c.x, ty: c.y };
          for (let attempt = 0; attempt < 60; attempt++) {
            const tx = r.x + 2 + Math.floor(rand() * (r.w - 4));
            const ty = r.y + 2 + Math.floor(rand() * (r.h - 4));
            if (!isFloor(tx, ty) || !isFloor(tx, ty - 1) || Math.hypot(tx - c.x, ty - c.y) < keepClear) continue;
            at = { tx, ty };
            break;
          }
          mobs.push({ mob, ...px(at.tx, at.ty) });
        }
      }
    };
    if (room.kind === "entrance") {
      spawn = px(c.x, c.y);
      entrancePortal = px(r.x + 2, r.y + 1);
    } else if (room.kind === "pack") {
      scatter(room.mobs);
    } else {
      mobs.push({ mob: room.boss, ...px(c.x, c.y - 1) });
      // Guards stand off to the sides so the boss can be pulled on its own with care.
      scatter(room.guards ?? [], 5);
      // The way out: at the top of the room's open cross.
      if (room.final) exitPortal = px(c.x, r.y + 1);
    }
  });

  return { map: { width, height, tiles, spawn }, mobs, decor, entrancePortal, exitPortal };
}

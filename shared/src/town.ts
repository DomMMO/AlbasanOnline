import { TILE_SIZE } from "./constants";
import { insideCastle, type CastleShape, type Decor, type DungeonLayout } from "./dungeons";
import { mulberry32, Tile } from "./map";

// The main town (Ana Merkez): a castle town on a floating island above the clouds. The island
// is round-ish with a ragged edge (cliffs underneath, a waterfall where the brook runs off it);
// a rounded curtain wall with towers rings the town, with a gate east (the road to the valley
// gate and, round the south, the harbour gate) and one west (out to the brook and the pond).
// Inside: the keep in the north, the fountain square in the middle, shops and houses along
// crooked streets, the horse farm in the south-east. Stalls can be opened anywhere in town.
// No mobs and no PvP here.

const px = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 1) * TILE_SIZE });

export const TOWN_WIDTH = 150;
export const TOWN_HEIGHT = 132;

/** The island: an ellipse with a wavy edge and two headlands (east: the valley gate, south: the harbour gate). */
const ISLAND = { cx: 75, cy: 62, rx: 58, ry: 50 };

/** Whether tile (x, y) is on the island (the rest is sky). */
export function onIsland(x: number, y: number): boolean {
  const dx = (x + 0.5 - ISLAND.cx) / ISLAND.rx;
  const dy = (y + 0.5 - ISLAND.cy) / ISLAND.ry;
  const angle = Math.atan2(y + 0.5 - ISLAND.cy, x + 0.5 - ISLAND.cx);
  const bump = (centre: number, height: number, width: number) => {
    const d = Math.atan2(Math.sin(angle - centre), Math.cos(angle - centre));
    return height * Math.exp(-((d / width) ** 2));
  };
  const edge =
    1 +
    0.05 * Math.sin(3 * angle + 0.8) +
    0.035 * Math.sin(5 * angle + 2.1) +
    0.02 * Math.sin(11 * angle + 0.3) +
    bump(0, 0.13, 0.2) +
    bump(Math.PI / 2, 0.22, 0.2);
  return Math.hypot(dx, dy) <= edge;
}

/** The curtain wall's outer edge; the courtyard is this shrunk by the wall's thickness. */
export const CASTLE: CastleShape = { cx: 74, cy: 58, a: 40, b: 33, p: 2.3, wobble: [0.045, 3, 0.9] };
const WALL_THICKNESS = 2.6;
/** The courtyard (inside the wall), for the wall's battlements and for placing things. */
const COURTYARD: CastleShape = { ...CASTLE, a: CASTLE.a - WALL_THICKNESS, b: CASTLE.b - WALL_THICKNESS };
/** Rows of the east and west gates. */
const GATE_ROWS = [57, 58, 59];

/** The keep (14 x 6 tiles) in the north of the courtyard. */
const KEEP = { tx: 67, ty: 33, w: 14, h: 6 };
/** The fountain square (an ellipse of paving) and the fountain in its middle. */
const SQUARE = { cx: 74.5, cy: 60, rx: 10, ry: 7 };
const FOUNTAIN = { tx: 72, ty: 58, w: 5, h: 4 };
/** The horse farm's paddock (fence tiles, inclusive) and its two-tile gate in the north side. */
const HORSE_FARM = { x0: 86, y0: 72, x1: 96, y1: 80, gateX: 90 };
/** The arena yard (sand) round the PvP portal, north-west of the keep. */
const ARENA_YARD = { x0: 48, y0: 40, x1: 56, y1: 46 };
/** The pond south-west of the town, and the brook from it south to the island's edge (a waterfall). */
const POND = { cx: 40, cy: 97, rx: 5.5, ry: 3.5 };

/** A bench in town that players can sit on. */
export interface Bench {
  id: string;
  tx: number;
  ty: number;
  /** Width in tiles; one seat per tile. */
  w: number;
  /** The way someone sitting on it looks. */
  facing: "up" | "down";
}

/** Park benches round the fountain, all looking at it: two on the north side, two on the south. */
export const TOWN_BENCHES: Bench[] = [
  { id: "fountain_nw", tx: 69, ty: 55, w: 2, facing: "down" },
  { id: "fountain_ne", tx: 79, ty: 55, w: 2, facing: "down" },
  { id: "fountain_sw", tx: 69, ty: 65, w: 2, facing: "up" },
  { id: "fountain_se", tx: 79, ty: 65, w: 2, facing: "up" },
];

/** Feet positions of a bench's seats (pixels). */
export function benchSeats(bench: Bench): { x: number; y: number }[] {
  return Array.from({ length: bench.w }, (_, i) => px(bench.tx + i, bench.ty));
}

/** Where the login screen's characters stand (tile coordinates): the keep's forecourt, between the lamps. */
export const TOWN_LOBBY = {
  slots: [
    { tx: KEEP.tx + 3, ty: KEEP.ty + KEEP.h + 2.5 },
    { tx: KEEP.tx + 7.5, ty: KEEP.ty + KEEP.h + 2.5 },
    { tx: KEEP.tx + 12, ty: KEEP.ty + KEEP.h + 2.5 },
  ],
  preview: { tx: KEEP.tx + 7.5, ty: KEEP.ty + KEEP.h + 2.8 },
};

/** Feet positions of things placed in town (tile coordinates). */
export const TOWN_SPOTS = {
  /** Teleport gate on the east headland, at the end of the road from the east gate. */
  fieldGate: px(139, 58),
  /** Where you appear when you come back from the hunting grounds: on the road, facing the town. */
  fromField: px(133, 58),
  /** Teleport gate to the harbour, on the south headland. */
  harborGate: px(74, 115),
  fromHarbor: px(74, 111),
  /** The keep's front door (into the great hall) and where you come out of it. */
  keepDoor: { x: (KEEP.tx + KEEP.w / 2) * TILE_SIZE, y: (KEEP.ty + KEEP.h) * TILE_SIZE + 6 },
  fromKeep: px(KEEP.tx + 7, KEEP.ty + KEEP.h + 2),
  /** Stalls can be opened anywhere in town; most traders set up round the fountain. */
  market: px(74, 67),
  /** Seyis Yusuf, at the gate of the horse farm. */
  stableMaster: px(HORSE_FARM.gateX - 2, HORSE_FARM.y0 - 1),
  pvpPortal: px(52, 42),
  pvpReturn: px(52, 45),
  spawn: px(74, 68),
  weaponsmith: px(101, 56),
  armorer: px(85, 54),
  scribe: px(59, 38),
  alchemist: px(47, 47),
  blacksmith: px(47, 56),
  jeweler: px(53, 71),
  storekeeper: px(103, 72),
  commander: px(96, 61),
  sage: px(63, 60),
  cook: px(89, 66),
  guardGateNorth: px(106, 55),
  guardGateSouth: px(106, 61),
  guardKeepWest: px(KEEP.tx + 1, KEEP.ty + KEEP.h + 1),
  guardKeepEast: px(KEEP.tx + KEEP.w - 2, KEEP.ty + KEEP.h + 1),
  /** Zanaatkâr Murat (life skills), next to the jeweler. */
  craftsman: px(57, 71),
};

type Building = Extract<Decor, { kind: "building" }>;

export function buildTown(): DungeonLayout {
  const width = TOWN_WIDTH;
  const height = TOWN_HEIGHT;
  const rand = mulberry32(2024);
  const grass = () => {
    const r = rand();
    return r < 0.035 ? Tile.Flower : r < 0.32 ? Tile.GrassAlt : Tile.Grass;
  };
  const tiles: Tile[][] = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => (onIsland(x, y) ? grass() : Tile.Sky)));
  const fill = (x0: number, y0: number, x1: number, y1: number, tile: Tile) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (tiles[y]?.[x] !== undefined && tiles[y][x] !== Tile.Sky) tiles[y][x] = tile;
  };
  const isGreen = (t: Tile | undefined) => t === Tile.Grass || t === Tile.GrassAlt || t === Tile.Flower;
  /** Paints a winding street through these points, `radius` tiles either side of its centre line. */
  const street = (points: [number, number][], tile = Tile.Cobble, radius = 1) => {
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let s = 0; s <= steps; s++) {
        const cx = Math.round(ax + ((bx - ax) * s) / steps);
        const cy = Math.round(ay + ((by - ay) * s) / steps);
        for (let y = cy - radius; y <= cy + radius; y++) {
          for (let x = cx - radius; x <= cx + radius; x++) {
            const t = tiles[y]?.[x];
            // Streets never pave over the plaza, walls, water or the sky.
            if (isGreen(t) || t === Tile.Path) tiles[y][x] = tile;
          }
        }
      }
    }
  };
  const inCourtyard = (x: number, y: number) => insideCastle(COURTYARD, x, y);

  // ---- The curtain wall and its two gates ----
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (insideCastle(CASTLE, x, y) && !inCourtyard(x, y)) tiles[y][x] = Tile.Wall;
  }
  const [gateTop, , gateBottom] = GATE_ROWS;
  /** Opens a gate through the wall in the gate rows on one side; returns the passage's columns. */
  const openGate = (east: boolean) => {
    let x0 = Infinity;
    let x1 = -Infinity;
    for (const y of GATE_ROWS) {
      for (let x = 0; x < width; x++) {
        if (tiles[y][x] !== Tile.Wall || x > CASTLE.cx !== east) continue;
        tiles[y][x] = Tile.Cobble;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    }
    return { x0, x1 };
  };
  const eastGate = openGate(true);
  const westGate = openGate(false);

  // ---- Open spaces in town ----
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inCourtyard(x, y) && ((x + 0.5 - SQUARE.cx) / SQUARE.rx) ** 2 + ((y + 0.5 - SQUARE.cy) / SQUARE.ry) ** 2 <= 1) tiles[y][x] = Tile.Plaza;
    }
  }
  // The keep's forecourt, and the sand of the arena yard (PvP portal).
  fill(KEEP.tx - 1, KEEP.ty + KEEP.h, KEEP.tx + KEEP.w, KEEP.ty + KEEP.h + 3, Tile.Plaza);
  fill(ARENA_YARD.x0, ARENA_YARD.y0, ARENA_YARD.x1, ARENA_YARD.y1, Tile.Path);

  // ---- Streets ----
  const cx = Math.round(SQUARE.cx - 0.5);
  // Gate streets: from each gate to the square, kinking past the shops.
  street([[eastGate.x0 - 1, 58], [96, 58], [90, 60], [84, 59]]);
  street([[westGate.x1 + 1, 58], [52, 58], [58, 60], [64, 59]]);
  // Keep avenue, straight up from the square.
  street([[cx, 52], [cx, KEEP.ty + KEEP.h + 3]]);
  // North-west: past the forge and the alchemist to the arena yard and the scribe.
  street([[52, 58], [50, 50], [52, 47]]);
  street([[52, 47], [57, 43], [62, 40], [KEEP.tx - 1, 40]]);
  // North-east: from the gate street up past the armorer to the houses under the wall.
  street([[96, 58], [94, 50], [88, 45], [KEEP.tx + KEEP.w + 1, 41]]);
  // South: from the square down to the houses and the south garden.
  street([[cx, 67], [cx, 76], [70, 82]]);
  // South-west: jeweler's lane.
  street([[58, 60], [57, 67], [60, 74], [cx, 76]]);
  // South-east: Ayşe Teyze's door, the horse farm's gate and the storehouse.
  street([[90, 60], [91, 66], [HORSE_FARM.gateX, HORSE_FARM.y0 - 2], [100, 68], [104, 69]]);

  const decor: Decor[] = [{ kind: "clouds", w: width, h: height }];
  const solid = (tx: number, ty: number, w: number, h: number) => fill(tx, ty, tx + w - 1, ty + h - 1, Tile.Solid);
  const building = (tx: number, ty: number, w: number, h: number, roof: number, sign?: Building["sign"], chimney = false) => {
    solid(tx, ty, w, h);
    decor.push({ kind: "building", tx, ty, w, h, roof, sign, chimney });
  };
  const prop = (tx: number, ty: number, kind: Extract<Decor, { kind: "prop" }>["prop"]) => {
    solid(tx, ty, kind === "well" ? 2 : 1, kind === "well" ? 2 : 1);
    decor.push({ kind: "prop", tx, ty, prop: kind });
  };
  const lamp = (tx: number, ty: number) => {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "lamp", tx, ty });
  };
  const bigTree = (tx: number, ty: number) => {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "bigTree", tx, ty, variant: Math.floor(rand() * 3) });
  };

  // ---- The keep ----
  solid(KEEP.tx, KEEP.ty, KEEP.w, KEEP.h);
  decor.push({ kind: "keep", ...KEEP, banner: 0x9c2a2a });

  // ---- Shops, scattered along the streets; the keeper stands at the door ----
  building(98, 51, 6, 5, 0x9c3b2e, { shape: "sword", color: 0xc8ccd4 }); // Silahçı Kerem, by the east gate
  building(83, 50, 5, 4, 0x3b5f8a, { shape: "chest", color: 0x9aa4b4 }); // Zırhçı Leyla
  building(57, 34, 5, 4, 0x6a4c93, { shape: "scroll", color: 0x3f7fd9 }); // Parşömenci Nuri, by the keep
  building(44, 43, 6, 4, 0x2f7a4f, { shape: "potion", color: 0xd94141 }, true); // İksirci Zehra
  building(44, 51, 6, 5, 0x4a4040, { shape: "axe", color: 0xb0b4bc }, true); // Demirci Hasan's forge, by the west gate
  solid(50, 55, 1, 1);
  decor.push({ kind: "anvil", tx: 50, ty: 55 });
  building(50, 67, 6, 4, 0x8c6d1f, { shape: "ring", color: 0xffd43b }); // Kuyumcu Selin
  building(100, 68, 7, 4, 0x6b5a3a, { shape: "chest", color: 0xc8a165 }); // Depocu Hatice's storehouse
  building(86, 62, 6, 4, 0x9c3b5a, undefined, true); // Ayşe Teyze's house

  // The barracks by the east gate, and houses filling the streets out.
  building(94, 62, 6, 4, 0x6b1a1a);
  for (const [tx, ty, w, h, roof, chimney] of [
    [62, 45, 4, 3, 0x8a5a3a, true],
    [84, 42, 4, 4, 0x4f6b4a, true],
    [90, 46, 4, 3, 0x7a4a3a, false],
    [60, 64, 4, 3, 0x7a6a4a, true],
    [62, 70, 5, 4, 0x5a6b8a, true],
    [55, 76, 4, 3, 0x8a4a3a, false],
    [64, 79, 4, 3, 0x6b4a6a, true],
    [77, 70, 4, 3, 0x3a5a7a, false],
    [79, 77, 5, 4, 0x8a5a3a, true],
    [45, 61, 4, 3, 0x4a6a3a, false],
    [100, 45, 4, 3, 0x7a3a3a, true],
    [65, 51, 4, 3, 0x5a4a8a, false],
    [79, 45, 4, 3, 0x8a6a2a, false],
    [104, 62, 3, 3, 0x6a5a4a, false],
  ] as const) {
    building(tx, ty, w, h, roof, undefined, chimney);
  }

  solid(FOUNTAIN.tx, FOUNTAIN.ty, FOUNTAIN.w, FOUNTAIN.h);
  decor.push({ kind: "fountain", ...FOUNTAIN });
  // Benches round the fountain (walk-through: you sit by clicking one).
  for (const { tx, ty, w, facing } of TOWN_BENCHES) decor.push({ kind: "parkBench", tx, ty, w, facing });

  // ---- The horse farm ----
  // A red barn, a fenced paddock with horses grazing in it, hay and a water trough;
  // Seyis Yusuf waits at the paddock gate by the lane.
  building(HORSE_FARM.x1 + 2, HORSE_FARM.y0 + 1, 6, 4, 0x8a2a1a, undefined, true);
  // A round paddock in the farm's rectangle: a smooth ring of posts and rails (drawn off the
  // tile grid), the tiles under the ring solid, a gate at the top facing the lane.
  const ring = {
    cx: (HORSE_FARM.x0 + HORSE_FARM.x1 + 1) / 2,
    cy: (HORSE_FARM.y0 + HORSE_FARM.y1 + 1) / 2,
    rx: (HORSE_FARM.x1 - HORSE_FARM.x0 + 1) / 2 - 0.5,
    ry: (HORSE_FARM.y1 - HORSE_FARM.y0 + 1) / 2 - 0.5,
  };
  const gate: [number, number] = [-Math.PI / 2 - 0.24, -Math.PI / 2 + 0.24];
  const inGate = (angle: number) => angle >= gate[0] && angle <= gate[1];
  for (let y = HORSE_FARM.y0 - 1; y <= HORSE_FARM.y1 + 1; y++) {
    for (let x = HORSE_FARM.x0 - 1; x <= HORSE_FARM.x1 + 1; x++) {
      const dx = (x + 0.5 - ring.cx) / ring.rx;
      const dy = (y + 0.5 - ring.cy) / ring.ry;
      const off = (Math.hypot(dx, dy) - 1) * Math.min(ring.rx, ring.ry);
      if (Math.abs(off) <= 0.62 && !inGate(Math.atan2(dy, dx))) solid(x, y, 1, 1);
    }
  }
  decor.push({ kind: "roundFence", ...ring, gate });
  decor.push({ kind: "signboard", tx: HORSE_FARM.gateX + 2, ty: HORSE_FARM.y0 - 2, w: 6, text: "AT ÇİFTLİĞİ" });
  const farmHorses: Extract<Decor, { kind: "horse" }>[] = [
    { kind: "horse", tx: 88, ty: 74, look: { coat: 0xd8d4cc, mane: 0xf1f3f5, blanket: 0x1c7ed6, saddle: 0x8a5a2b }, facing: "right" },
    { kind: "horse", tx: 93, ty: 75, look: { coat: 0xd4a017, mane: 0x8a6a10, blanket: 0x2b8a3e, saddle: 0x6b1a1a }, facing: "left" },
    { kind: "horse", tx: 90, ty: 78, look: { coat: 0x26232a, mane: 0x0f0d12, blanket: 0x9c2a2a, saddle: 0x111111 }, facing: "down" },
    { kind: "horse", tx: 94, ty: 78, look: { coat: 0xb08850, mane: 0x3a2a1a, blanket: 0x7a2a2a, saddle: 0x5b3a1e }, facing: "left" },
  ];
  for (const horse of farmHorses) {
    solid(horse.tx, horse.ty, 1, 1);
    decor.push(horse);
  }
  solid(HORSE_FARM.x0 + 2, HORSE_FARM.y0 + 4, 2, 1);
  decor.push({ kind: "trough", tx: HORSE_FARM.x0 + 2, ty: HORSE_FARM.y0 + 4 });
  for (const [tx, ty] of [[HORSE_FARM.x1 - 3, HORSE_FARM.y0 + 5], [HORSE_FARM.x1 - 2, HORSE_FARM.y0 + 5], [HORSE_FARM.x0 + 6, HORSE_FARM.y0 + 2]] as const) prop(tx, ty, "hay");
  prop(HORSE_FARM.x1 + 3, HORSE_FARM.y0 + 6, "cart");
  lamp(HORSE_FARM.gateX - 1, HORSE_FARM.y0 - 1);

  // ---- Street life ----
  prop(58, 74, "well");
  for (const [tx, ty] of [[97, 50], [43, 50], [82, 54], [99, 67]] as const) prop(tx, ty, "barrel");
  for (const [tx, ty] of [[107, 67], [107, 68], [43, 56]] as const) prop(tx, ty, "crate");
  for (const [tx, ty] of [[101, 66], [102, 66]] as const) prop(tx, ty, "hay");
  prop(66, 57, "cart");
  for (const [tx, ty] of [
    [65, 54], [84, 54], [65, 66], [84, 66], // square
    [96, 55], [104, 60], [57, 55], [44, 60], // gate streets
    [70, 42], [79, 42], [62, 42], // forecourt and the north-west lane
    [cx - 2, 72], [86, 58], [54, 64], [92, 69], [95, 51],
  ]) {
    lamp(tx, ty);
  }
  // Trees in town: a little park under the north-east wall, and here and there along the lanes.
  for (const [tx, ty] of [[96, 41], [99, 40], [93, 38], [58, 50], [68, 74], [84, 74], [47, 66], [60, 82], [74, 84], [86, 84], [55, 37], [103, 53]] as const) {
    if (isGreen(tiles[ty]?.[tx])) bigTree(tx, ty);
  }

  // ---- The arena yard, with training dummies in its corner ----
  for (const [tx, ty] of [[50, 44], [55, 44], [50, 46], [55, 46]] as const) prop(tx, ty, "dummy");
  for (const [tx, ty] of [[ARENA_YARD.x0, ARENA_YARD.y0], [ARENA_YARD.x1, ARENA_YARD.y0]] as const) {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "torch", tx, ty });
  }
  for (const [tx, ty] of [[ARENA_YARD.x0, ARENA_YARD.y0 + 2], [ARENA_YARD.x1, ARENA_YARD.y0 + 2]] as const) {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "banner", tx, ty, color: 0x9c2a2a });
  }

  // ---- Outside the walls ----
  // The east road out to the valley gate on the headland, and the harbour road branching off it
  // round the south of the wall to the harbour gate on the south headland.
  street([[eastGate.x1 + 1, 58], [139, 58]], Tile.Path, 1);
  street([[122, 59], [121, 70], [115, 82], [104, 94], [90, 104], [79, 108], [74, 114]], Tile.Cobble, 1);
  street([[westGate.x0 - 1, 58], [30, 58], [24, 60]], Tile.Path, 1);
  // Paved circles round the two teleport gates and a little lookout at the end of the west road.
  for (const [gx, gy, r] of [[139, 58, 3.2], [74, 115, 3.4], [23, 60, 2.6]] as const) {
    for (let y = Math.floor(gy - r); y <= gy + r; y++) {
      for (let x = Math.floor(gx - r); x <= gx + r; x++) if (Math.hypot(x - gx, y - gy) <= r && tiles[y]?.[x] !== Tile.Sky) tiles[y][x] = Tile.Plaza;
    }
  }
  // The pond, and the brook from it south to the edge, where it falls off the island.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (((x + 0.5 - POND.cx) / POND.rx) ** 2 + ((y + 0.5 - POND.cy) / POND.ry) ** 2 <= 1 && tiles[y][x] !== Tile.Sky) tiles[y][x] = Tile.Water;
    }
  }
  for (let y = POND.cy; y < height && tiles[y][POND.cx] !== undefined; y++) {
    const x = Math.round(POND.cx - 1 + 2 * Math.sin(y * 0.35));
    if (tiles[y][x] === Tile.Sky && tiles[y][x + 1] === Tile.Sky) break;
    for (const xx of [x, x + 1]) if (tiles[y][xx] !== Tile.Sky) tiles[y][xx] = Tile.Water;
  }

  // Lamps along the roads, torches at the gates, banners at the teleport gates.
  for (let x = eastGate.x1 + 4; x < 136; x += 6) lamp(x, x % 12 === 0 ? 56 : 60);
  for (const [tx, ty] of [[118, 76], [109, 88], [96, 99], [84, 107]] as const) lamp(tx, ty);
  for (const [tx, ty] of [[eastGate.x1 + 1, gateTop - 1], [eastGate.x1 + 1, gateBottom + 1], [westGate.x0 - 1, gateTop - 1], [westGate.x0 - 1, gateBottom + 1]] as const) {
    if (tiles[ty]?.[tx] === Tile.Sky) continue;
    solid(tx, ty, 1, 1);
    decor.push({ kind: "torch", tx, ty });
  }
  for (const [tx, ty, color] of [[135, 55, 0x2b8a3e], [135, 61, 0x2b8a3e], [70, 112, 0x2f6b8a], [78, 112, 0x2f6b8a]] as const) {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "banner", tx, ty, color });
  }
  decor.push({ kind: "signboard", tx: 120, ty: 62, w: 5, text: "LİMAN" });
  lamp(21, 58);
  lamp(21, 62);

  // Woods: big trees outside the wall, thick in patches, thin elsewhere; none on the roads,
  // next to the wall or the edge.
  const trees: { x: number; y: number }[] = [];
  const clear = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!isGreen(tiles[y + dy]?.[x + dx])) return false;
    return true;
  };
  for (let y = 4; y < height - 4; y++) {
    for (let x = 4; x < width - 4; x++) {
      if (insideCastle(CASTLE, x, y, -4) || !clear(x, y, 2)) continue;
      const woods = Math.sin(x * 0.11 + 1.3) * Math.cos(y * 0.13 - 0.4) + 0.4 * Math.sin((x + y) * 0.07);
      if (rand() > (woods > 0.35 ? 0.2 : 0.035)) continue;
      if (trees.some((t) => Math.abs(t.x - x) < 3 && Math.abs(t.y - y) < 3)) continue;
      trees.push({ x, y });
    }
  }
  for (const t of trees) bigTree(t.x, t.y);

  // Bushes (walk-through): beside the houses in town, and along the edges of the woods.
  const bush = (tx: number, ty: number) => {
    if (!isGreen(tiles[ty]?.[tx])) return;
    decor.push({ kind: "bush", tx, ty, variant: Math.floor(rand() * 6) });
  };
  // By the houses: a bush on one side, crates, barrels or sacks stacked on the other.
  const goods: Extract<Decor, { kind: "prop" }>["prop"][] = ["crate", "barrel", "sack", "crate"];
  for (const d of [...decor]) {
    if (d.kind !== "building") continue;
    if (rand() < 0.75) bush(d.tx - 1, d.ty + d.h - 1);
    const sx = d.tx + d.w;
    const sy = d.ty + d.h - 1;
    if (rand() < 0.6 && isGreen(tiles[sy]?.[sx]) && isGreen(tiles[sy - 1]?.[sx])) {
      prop(sx, sy, goods[Math.floor(rand() * goods.length)]);
      if (rand() < 0.5) prop(sx, sy - 1, goods[Math.floor(rand() * goods.length)]);
    } else if (rand() < 0.5) bush(sx, sy);
  }
  for (const t of trees) {
    if (rand() < 0.45) bush(t.x + (rand() < 0.5 ? -2 : 2), t.y + 1);
  }
  // Plants scattered over the grass to break up the meadow: ferns, tall grass, flowers, weeds.
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (!isGreen(tiles[y][x]) || rand() > 0.055) continue;
      decor.push({ kind: "plant", tx: x, ty: y, variant: Math.floor(rand() * 64) });
    }
  }

  // ---- Fortifications ----
  // Towers round the wall, and a pair either side of each gate.
  const ringPoint = (angle: number) => {
    let r = 0;
    while (insideCastle(CASTLE, CASTLE.cx + Math.cos(angle) * (r + 0.25) - 0.5, CASTLE.cy + Math.sin(angle) * (r + 0.25) - 0.5, WALL_THICKNESS / 2)) r += 0.25;
    return { x: CASTLE.cx + Math.cos(angle) * r, y: CASTLE.cy + Math.sin(angle) * r };
  };
  const towers: { tx: number; ty: number }[] = [50, 90, 130, 230, 270, 310].map((deg) => {
    const p = ringPoint((deg * Math.PI) / 180);
    return { tx: Math.round(p.x - 2), ty: Math.round(p.y - 2) };
  });
  for (const gate of [eastGate, westGate]) {
    const tx = Math.round((gate.x0 + gate.x1) / 2 - 1.5);
    towers.push({ tx, ty: gateTop - 5 }, { tx, ty: gateBottom + 2 });
  }
  const towerTiles = new Set<string>();
  for (const { tx, ty } of towers) {
    fill(tx, ty, tx + 3, ty + 3, Tile.Wall);
    for (let y = ty; y < ty + 4; y++) for (let x = tx; x < tx + 4; x++) towerTiles.add(`${x},${y}`);
  }
  const wallTiles: { tx: number; ty: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (tiles[y][x] === Tile.Wall && !towerTiles.has(`${x},${y}`)) wallTiles.push({ tx: x, ty: y });
  }
  const inner = {
    x0: Math.ceil(COURTYARD.cx - COURTYARD.a),
    y0: Math.ceil(COURTYARD.cy - COURTYARD.b),
    x1: Math.floor(COURTYARD.cx + COURTYARD.a),
    y1: Math.floor(COURTYARD.cy + COURTYARD.b),
  };
  decor.push({ kind: "castleWall", tiles: wallTiles, inner, innerShape: COURTYARD });
  for (const gate of [eastGate, westGate]) decor.push({ kind: "gateArch", tx: gate.x0, ty: gateTop, w: gate.x1 - gate.x0 + 1, h: GATE_ROWS.length });
  towers.forEach(({ tx, ty }, i) => decor.push({ kind: "tower", tx, ty, w: 4, h: 4, flag: i % 2 === 0 ? 0x9c2a2a : 0xe0a83f }));

  return { map: { width, height, tiles, spawn: TOWN_SPOTS.spawn }, mobs: [], decor };
}

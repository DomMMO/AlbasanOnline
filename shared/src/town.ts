import { TILE_SIZE } from "./constants";
import type { Decor, DungeonLayout } from "./dungeons";
import { mulberry32, Tile } from "./map";

// The main town (Ana Merkez): a castle town. A moat and a thick curtain wall with towers
// ring it; the only way in is the east gatehouse over the drawbridge. Inside, the keep
// stands in the north, the fountain square in the middle and the market in the south;
// crooked streets wind between them and the shops are scattered along those streets
// rather than lined up. No mobs and no PvP here.

const px = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 1) * TILE_SIZE });

export const TOWN_WIDTH = 76;
export const TOWN_HEIGHT = 58;

/** Curtain wall, two tiles thick (outer tile bounds, inclusive). */
const WALL = { x0: 8, y0: 8, x1: 57, y1: 51 };
const WALL_THICKNESS = 2;
/** The courtyard inside the wall (inclusive). */
const INNER = { x0: WALL.x0 + WALL_THICKNESS, y0: WALL.y0 + WALL_THICKNESS, x1: WALL.x1 - WALL_THICKNESS, y1: WALL.y1 - WALL_THICKNESS };
/** Moat: a two-tile ring of water one tile outside the wall (outer bounds). */
const MOAT = { x0: WALL.x0 - 3, y0: WALL.y0 - 3, x1: WALL.x1 + 3, y1: WALL.y1 + 3 };
/** Rows of the east gate, the drawbridge and the road out to the teleport gate. */
const GATE_ROWS = [28, 29, 30];
/** The market square, where players may open stalls (tiles). */
const MARKET_AREA = { tx: 20, ty: 40, w: 24, h: 9 };
/** The market's north entrance, under its signboard (tiles). */
const MARKET_GATE = { tx: 30, w: 5 };
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
  { id: "fountain_nw", tx: 28, ty: 26, w: 2, facing: "down" },
  { id: "fountain_ne", tx: 35, ty: 26, w: 2, facing: "down" },
  { id: "fountain_sw", tx: 28, ty: 33, w: 2, facing: "up" },
  { id: "fountain_se", tx: 35, ty: 33, w: 2, facing: "up" },
];

/** Feet positions of a bench's seats (pixels). */
export function benchSeats(bench: Bench): { x: number; y: number }[] {
  return Array.from({ length: bench.w }, (_, i) => px(bench.tx + i, bench.ty));
}

/** The horse farm's paddock (fence tiles, inclusive) and its two-tile gate in the south side. */
const HORSE_FARM = { x0: 62, y0: 15, x1: 72, y1: 24, gateX: 66 };
/** The cobbled lane from the east road down to the harbour gate (centre line, tiles). */
const HARBOR_ROAD: [number, number][] = [[66, 31], [66, 34], [68, 37], [68, 41], [65, 44], [65, 46], [66, 48], [66, 52]];
/** The meadow the road runs through (columns cleared of trees). */
const HARBOR_ROAD_X0 = 61;
const HARBOR_ROAD_X1 = 72;
/** The fountain square (an ellipse of paving). */
const SQUARE = { cx: 32, cy: 30, rx: 7.5, ry: 5.5 };

/** The market square's edge tiles that get a fence: all but the gates (north, east, west). */
function marketFence(): { tx: number; ty: number }[] {
  const { tx, ty, w, h } = MARKET_AREA;
  const x1 = tx + w - 1;
  const y1 = ty + h - 1;
  const midY = ty + Math.floor(h / 2);
  const isGate = (x: number, y: number) =>
    (y === ty && x >= MARKET_GATE.tx && x < MARKET_GATE.tx + MARKET_GATE.w) || ((x === tx || x === x1) && Math.abs(y - midY) <= 1);
  const tiles: { tx: number; ty: number }[] = [];
  for (let y = ty; y <= y1; y++) {
    for (let x = tx; x <= x1; x++) {
      const edge = x === tx || x === x1 || y === ty || y === y1;
      if (edge && !isGate(x, y)) tiles.push({ tx: x, ty: y });
    }
  }
  return tiles;
}

/** Feet positions of things placed in town (tile coordinates). */
export const TOWN_SPOTS = {
  /** Teleport gate at the end of the east road. */
  fieldGate: px(71, 29),
  /** Where you appear when you come back from the hunting grounds: on the road, facing the drawbridge. */
  fromField: px(66, 29),
  /** Teleport gate to the harbour, at the end of the path branching south off the east road. */
  harborGate: px(66, 51),
  fromHarbor: px(66, 47),
  /** The keep's front door (into the great hall) and where you come out of it. */
  keepDoor: { x: 32 * TILE_SIZE, y: 18 * TILE_SIZE + 6 },
  fromKeep: px(32, 20),
  /** The market square's north entrance. */
  market: px(32, 40),
  /** Seyis Yusuf, at the gate of the horse farm north of the east road. */
  stableMaster: px(64, 26),
  pvpPortal: px(49, 15),
  pvpReturn: px(49, 18),
  spawn: px(32, 34),
  weaponsmith: px(47, 27),
  armorer: px(39, 26),
  scribe: px(20, 15),
  alchemist: px(15, 18),
  blacksmith: px(15, 28),
  jeweler: px(15, 38),
  storekeeper: px(50, 44),
  commander: px(50, 26),
  sage: px(27, 30),
  cook: px(43, 38),
  guardGateNorth: px(54, 27),
  guardGateSouth: px(54, 31),
  guardKeepWest: px(28, 18),
  guardKeepEast: px(36, 18),
  /** Zanaatkâr Murat (life skills), next to the jeweler. */
  craftsman: px(18, 38),
};

type Building = Extract<Decor, { kind: "building" }>;

export function buildTown(): DungeonLayout {
  const width = TOWN_WIDTH;
  const height = TOWN_HEIGHT;
  const rand = mulberry32(2024);
  const inRect = (x: number, y: number, r: { x0: number; y0: number; x1: number; y1: number }) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  const nearRoad = (y: number) => y >= GATE_ROWS[0] - 2 && y <= GATE_ROWS[2] + 2;
  const tiles: Tile[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) return Tile.Tree;
      const r = rand();
      // Woods outside the moat, thinning out towards the road.
      const outside = !inRect(x, y, MOAT);
      if (outside && r < 0.14 && !(x > MOAT.x1 && nearRoad(y))) return Tile.Tree;
      return r < 0.04 ? Tile.Flower : r < 0.3 ? Tile.GrassAlt : Tile.Grass;
    }),
  );
  const fill = (x0: number, y0: number, x1: number, y1: number, tile: Tile) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles[y][x] = tile;
  };
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
            // Streets never pave over the plaza, walls or water.
            if (t === Tile.Grass || t === Tile.GrassAlt || t === Tile.Flower || t === Tile.Path) tiles[y][x] = tile;
          }
        }
      }
    }
  };

  // ---- Moat, wall and the gate ----
  fill(MOAT.x0, MOAT.y0, MOAT.x1, MOAT.y1, Tile.Water);
  fill(MOAT.x0 + 2, MOAT.y0 + 2, MOAT.x1 - 2, MOAT.y1 - 2, Tile.Grass);
  fill(WALL.x0, WALL.y0, WALL.x1, WALL.y1, Tile.Wall);
  fill(INNER.x0, INNER.y0, INNER.x1, INNER.y1, Tile.Grass);
  for (let y = INNER.y0; y <= INNER.y1; y++) {
    for (let x = INNER.x0; x <= INNER.x1; x++) {
      const r = rand();
      tiles[y][x] = r < 0.03 ? Tile.Flower : r < 0.35 ? Tile.GrassAlt : Tile.Grass;
    }
  }
  const [gateTop, , gateBottom] = GATE_ROWS;
  // Gate passage through the wall, the bank, the drawbridge and the road to the teleport gate.
  fill(WALL.x1 - 1, gateTop, WALL.x1, gateBottom, Tile.Cobble);
  fill(WALL.x1 + 1, gateTop, WALL.x1 + 1, gateBottom, Tile.Path);
  fill(MOAT.x1 - 1, gateTop, MOAT.x1, gateBottom, Tile.Bridge);
  fill(MOAT.x1 + 1, gateTop, width - 3, gateBottom, Tile.Path);
  fill(MOAT.x1 + 1, gateTop - 1, width - 3, gateTop - 1, Tile.Grass);
  fill(MOAT.x1 + 1, gateBottom + 1, width - 3, gateBottom + 1, Tile.Grass);
  // The road south to the harbour gate: the woods are cleared back into a meadow and a
  // cobbled lane winds down to a paved circle round the gate (trees, lamps and flower
  // beds along it are placed with the rest of the decor below).
  for (let y = gateBottom + 1; y <= height - 3; y++) {
    for (let x = HARBOR_ROAD_X0; x <= HARBOR_ROAD_X1; x++) {
      if (tiles[y][x] === Tile.Tree) tiles[y][x] = rand() < 0.5 ? Tile.GrassAlt : Tile.Grass;
    }
  }
  for (let y = 48; y <= height - 3; y++) {
    for (let x = 62; x <= 70; x++) if (((x - 66) / 3.6) ** 2 + ((y - 51) / 2.6) ** 2 <= 1) tiles[y][x] = Tile.Plaza;
  }
  const roadCentre = new Map<number, number>();
  for (let i = 1; i < HARBOR_ROAD.length; i++) {
    const [ax, ay] = HARBOR_ROAD[i - 1];
    const [bx, by] = HARBOR_ROAD[i];
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let s = 0; s <= steps; s++) roadCentre.set(Math.round(ay + ((by - ay) * s) / steps), Math.round(ax + ((bx - ax) * s) / steps));
  }
  street(HARBOR_ROAD, Tile.Cobble, 1);

  // The horse farm north of the east road, outside the moat: the woods are cleared for it.
  for (let y = HORSE_FARM.y0 - 2; y <= GATE_ROWS[0] - 2; y++) {
    for (let x = HORSE_FARM.x0 - 1; x <= HORSE_FARM.x1 + 1; x++) if (tiles[y][x] === Tile.Tree) tiles[y][x] = Tile.Grass;
  }
  fill(HORSE_FARM.gateX, HORSE_FARM.y1, HORSE_FARM.gateX + 1, GATE_ROWS[0] - 1, Tile.Path);

  // ---- Open spaces ----
  // Fountain square: an oval of paving.
  for (let y = INNER.y0; y <= INNER.y1; y++) {
    for (let x = INNER.x0; x <= INNER.x1; x++) {
      if (((x - SQUARE.cx) / SQUARE.rx) ** 2 + ((y - SQUARE.cy) / SQUARE.ry) ** 2 <= 1) tiles[y][x] = Tile.Plaza;
    }
  }
  // The keep's forecourt and the sand of the arena yard (PvP portal).
  fill(27, 18, 37, 20, Tile.Plaza);
  fill(45, 12, 53, 19, Tile.Path);
  // Market square.
  fill(MARKET_AREA.tx, MARKET_AREA.ty, MARKET_AREA.tx + MARKET_AREA.w - 1, MARKET_AREA.ty + MARKET_AREA.h - 1, Tile.Market);

  // ---- Streets ----
  // Gate street: from the gatehouse to the square, kinking past the weaponsmith.
  street([[55, 29], [48, 29], [44, 31], [39, 30]]);
  // Keep avenue, straight up from the square.
  street([[32, 24], [32, 20]]);
  // Forge street: west from the square to the smithy.
  street([[25, 30], [20, 29], [12, 29]]);
  // Back alley north: past the alchemist and the scribe, then east to the keep.
  street([[21, 28], [21, 22], [17, 19], [13, 19]]);
  street([[21, 22], [20, 16]]);
  street([[20, 19], [27, 19]]);
  // Jeweller's lane and on to the market's west gate.
  street([[19, 30], [19, 37], [14, 39]]);
  street([[19, 37], [19, 44]]);
  // Market street, south from the square.
  street([[32, 35], [32, 39]]);
  // Arena lane: up from the gate street to the arena yard.
  street([[51, 28], [51, 21], [49, 19]]);
  // Back lane east: past Ayşe Teyze's door, the market's east gate and the storehouse.
  street([[47, 30], [47, 38], [43, 39]]);
  street([[47, 38], [45, 41], [45, 44], [51, 45]]);
  // Armourer's lane.
  street([[39, 26], [40, 29]], Tile.Cobble, 0);
  street([[38, 27], [41, 27]], Tile.Cobble, 0);

  const decor: Decor[] = [];
  const solid = (tx: number, ty: number, w: number, h: number) => fill(tx, ty, tx + w - 1, ty + h - 1, Tile.Solid);
  const building = (tx: number, ty: number, w: number, h: number, roof: number, sign?: Building["sign"], chimney = false) => {
    solid(tx, ty, w, h);
    decor.push({ kind: "building", tx, ty, w, h, roof, sign, chimney });
  };
  const prop = (tx: number, ty: number, kind: Extract<Decor, { kind: "prop" }>["prop"]) => {
    solid(tx, ty, kind === "well" ? 2 : 1, kind === "well" ? 2 : 1);
    decor.push({ kind: "prop", tx, ty, prop: kind });
  };
  const tree = (tx: number, ty: number) => (tiles[ty][tx] = Tile.Tree);

  // ---- The keep ----
  solid(25, 12, 14, 6);
  decor.push({ kind: "keep", tx: 25, ty: 12, w: 14, h: 6, banner: 0x9c2a2a });

  // ---- Shops, scattered along the streets; the keeper stands at the door ----
  building(44, 22, 6, 5, 0x9c3b2e, { shape: "sword", color: 0xc8ccd4 }); // Silahçı Kerem, by the gate
  building(37, 22, 5, 4, 0x3b5f8a, { shape: "chest", color: 0x9aa4b4 }); // Zırhçı Leyla
  building(18, 11, 5, 4, 0x6a4c93, { shape: "scroll", color: 0x3f7fd9 }); // Parşömenci Nuri, near the keep
  building(12, 14, 6, 4, 0x2f7a4f, { shape: "potion", color: 0xd94141 }, true); // İksirci Zehra, back alley
  building(12, 23, 6, 5, 0x4a4040, { shape: "axe", color: 0xb0b4bc }, true); // Demirci Hasan's forge
  solid(18, 27, 1, 1);
  decor.push({ kind: "anvil", tx: 18, ty: 27 });
  building(12, 34, 6, 4, 0x8c6d1f, { shape: "ring", color: 0xffd43b }); // Kuyumcu Selin
  building(47, 40, 7, 4, 0x6b5a3a, { shape: "chest", color: 0xc8a165 }); // Depocu Hatice's storehouse
  building(40, 34, 6, 4, 0x9c3b5a, undefined, true); // Ayşe Teyze's house

  // Houses and the barracks, to fill the streets out.
  building(49, 33, 6, 4, 0x6b1a1a); // barracks by the gate
  building(23, 21, 4, 3, 0x8a5a3a, undefined, true);
  building(11, 42, 5, 4, 0x5a6b8a, undefined, true);
  building(16, 46, 4, 3, 0x8a4a3a);
  building(22, 32, 4, 3, 0x7a6a4a, undefined, true);
  building(41, 13, 4, 4, 0x4f6b4a, undefined, true);

  solid(30, 28, 5, 4);
  decor.push({ kind: "fountain", tx: 30, ty: 28, w: 5, h: 4 });

  // ---- Street life ----
  for (const [tx, ty] of [[24, 15], [39, 19], [26, 37], [36, 23], [16, 32], [44, 47], [54, 39], [12, 47], [53, 23], [11, 12], [13, 11]] as const) tree(tx, ty);
  prop(22, 36, "well");
  for (const [tx, ty] of [[43, 25], [50, 22], [36, 37], [18, 26]] as const) prop(tx, ty, "barrel");
  for (const [tx, ty] of [[54, 41], [54, 42], [11, 27]] as const) prop(tx, ty, "crate");
  for (const [tx, ty] of [[54, 37], [53, 37]] as const) prop(tx, ty, "hay");
  prop(26, 24, "cart");

  for (const [tx, ty] of [
    [26, 26], [38, 26], [26, 34], [38, 34], // square
    [17, 41], [54, 44], // market and storehouse
    [44, 27], [53, 32], // gate street
    [22, 27], [18, 21], [29, 20], [35, 20], // west streets and the forecourt
    [52, 19], [46, 13], // arena yard
  ]) {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "lamp", tx, ty });
  }
  decor.push({ kind: "signboard", tx: 64, ty: 33, w: 5, text: "LİMAN" });
  // Benches round the fountain (walk-through: you sit by clicking one).
  for (const { tx, ty, w, facing } of TOWN_BENCHES) decor.push({ kind: "parkBench", tx, ty, w, facing });

  // ---- The horse farm ----
  // A red barn, a fenced paddock with horses grazing in it, hay and a water trough;
  // Seyis Yusuf waits at the paddock gate by the road.
  building(HORSE_FARM.x0 + 1, HORSE_FARM.y0 - 6, 6, 4, 0x8a2a1a, undefined, true);
  const paddock: { tx: number; ty: number }[] = [];
  for (let y = HORSE_FARM.y0; y <= HORSE_FARM.y1; y++) {
    for (let x = HORSE_FARM.x0; x <= HORSE_FARM.x1; x++) {
      const edge = x === HORSE_FARM.x0 || x === HORSE_FARM.x1 || y === HORSE_FARM.y0 || y === HORSE_FARM.y1;
      const gate = y === HORSE_FARM.y1 && (x === HORSE_FARM.gateX || x === HORSE_FARM.gateX + 1);
      if (edge && !gate) paddock.push({ tx: x, ty: y });
    }
  }
  for (const { tx, ty } of paddock) solid(tx, ty, 1, 1);
  decor.push({ kind: "fence", tiles: paddock });
  decor.push({ kind: "signboard", tx: HORSE_FARM.gateX - 1, ty: HORSE_FARM.y1 + 1, w: 4, text: "AT ÇİFTLİĞİ" });
  const farmHorses: Extract<Decor, { kind: "horse" }>[] = [
    { kind: "horse", tx: 64, ty: 17, look: { coat: 0xd8d4cc, mane: 0xf1f3f5, blanket: 0x1c7ed6, saddle: 0x8a5a2b }, facing: "right" },
    { kind: "horse", tx: 69, ty: 18, look: { coat: 0xd4a017, mane: 0x8a6a10, blanket: 0x2b8a3e, saddle: 0x6b1a1a }, facing: "left" },
    { kind: "horse", tx: 66, ty: 21, look: { coat: 0x26232a, mane: 0x0f0d12, blanket: 0x9c2a2a, saddle: 0x111111 }, facing: "down" },
    { kind: "horse", tx: 70, ty: 22, look: { coat: 0xb08850, mane: 0x3a2a1a, blanket: 0x7a2a2a, saddle: 0x5b3a1e }, facing: "left" },
  ];
  for (const horse of farmHorses) {
    solid(horse.tx, horse.ty, 1, 1);
    decor.push(horse);
  }
  solid(HORSE_FARM.x0 + 1, HORSE_FARM.y0 + 5, 2, 1);
  decor.push({ kind: "trough", tx: HORSE_FARM.x0 + 1, ty: HORSE_FARM.y0 + 5 });
  for (const [tx, ty] of [[HORSE_FARM.x1 - 1, HORSE_FARM.y0 + 1], [HORSE_FARM.x1 - 2, HORSE_FARM.y0 + 1], [HORSE_FARM.x0 + 1, HORSE_FARM.y1 - 1]] as const) prop(tx, ty, "hay");
  prop(HORSE_FARM.x0 + 7, HORSE_FARM.y0 - 3, "cart");
  for (const [tx, ty] of [[HORSE_FARM.gateX - 3, HORSE_FARM.y1 + 1], [HORSE_FARM.gateX + 4, HORSE_FARM.y1 + 1]] as const) {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "lamp", tx, ty });
  }

  // ---- The harbour road ----
  // An avenue of trees two tiles off the lane, lamps between them on alternate sides and
  // flower beds along the kerb; banners and barrels by the gate.
  const isFree = (x: number, y: number) => tiles[y]?.[x] === Tile.Grass || tiles[y]?.[x] === Tile.GrassAlt || tiles[y]?.[x] === Tile.Flower;
  for (const [y, cx] of roadCentre) {
    if (y < 35 || y > 47) continue;
    if (y % 3 === 0) {
      for (const x of [cx - 4, cx + 4]) if (isFree(x, y)) tree(x, y);
    } else if (y % 3 === 1) {
      const x = y % 6 === 1 ? cx - 3 : cx + 3;
      if (isFree(x, y)) {
        solid(x, y, 1, 1);
        decor.push({ kind: "lamp", tx: x, ty: y });
      }
    } else {
      for (const x of [cx - 2, cx + 2]) if (isFree(x, y) && rand() < 0.7) tiles[y][x] = Tile.Flower;
    }
  }
  for (const [tx, ty, color] of [[62, 50, 0x2f6b8a], [70, 50, 0x2f6b8a]] as const) {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "banner", tx, ty, color });
  }
  for (const [tx, ty] of [[63, 47], [69, 47]] as const) {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "lamp", tx, ty });
  }
  for (const [tx, ty] of [[71, 37], [71, 38]] as const) prop(tx, ty, "hay");
  prop(62, 41, "barrel");
  prop(62, 42, "crate");
  // Torches either side of the drawbridge and in the arena yard.
  for (const [tx, ty] of [[MOAT.x1 + 1, gateTop - 1], [MOAT.x1 + 1, gateBottom + 1], [45, 17], [53, 17]] as const) {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "torch", tx, ty });
  }
  for (const [tx, ty, color] of [[23, 39, 0xc92a2a], [27, 39, 0xe0a83f], [37, 39, 0x3b5bdb], [41, 39, 0x2f9e44], [45, 19, 0x9c2a2a], [53, 19, 0x9c2a2a]] as const) {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "banner", tx, ty, color });
  }
  // Make the market square unmistakable: a sign over its entrance and a gold line around it.
  decor.push({ kind: "signboard", tx: MARKET_GATE.tx, ty: MARKET_AREA.ty - 1, w: MARKET_GATE.w, text: "PAZAR" });
  decor.push({ kind: "groundFrame", ...MARKET_AREA, color: 0xe8c33a });
  const fence = marketFence();
  for (const { tx, ty } of fence) solid(tx, ty, 1, 1);
  decor.push({ kind: "fence", tiles: fence });

  // ---- Fortifications ----
  const towers: { tx: number; ty: number }[] = [
    { tx: WALL.x0 - 1, ty: WALL.y0 - 1 },
    { tx: WALL.x1 - 2, ty: WALL.y0 - 1 },
    { tx: WALL.x0 - 1, ty: WALL.y1 - 2 },
    { tx: WALL.x1 - 2, ty: WALL.y1 - 2 },
    { tx: 30, ty: WALL.y0 - 1 },
    { tx: 46, ty: WALL.y1 - 2 },
    { tx: WALL.x0 - 1, ty: 28 },
    // Gatehouse towers either side of the gate.
    { tx: WALL.x1 - 2, ty: gateTop - 4 },
    { tx: WALL.x1 - 2, ty: gateBottom + 1 },
  ];
  const towerTiles = new Set<string>();
  for (const { tx, ty } of towers) {
    fill(tx, ty, tx + 3, ty + 3, Tile.Wall);
    for (let y = ty; y < ty + 4; y++) for (let x = tx; x < tx + 4; x++) towerTiles.add(`${x},${y}`);
  }
  const wallTiles: { tx: number; ty: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (tiles[y][x] === Tile.Wall && !towerTiles.has(`${x},${y}`)) wallTiles.push({ tx: x, ty: y });
  }
  decor.push({ kind: "castleWall", tiles: wallTiles, inner: INNER });
  decor.push({ kind: "drawbridge", tx: MOAT.x1 - 1, ty: gateTop, w: 2, h: GATE_ROWS.length });
  decor.push({ kind: "gateArch", tx: WALL.x1 - 1, ty: gateTop, w: WALL_THICKNESS, h: GATE_ROWS.length });
  towers.forEach(({ tx, ty }, i) => decor.push({ kind: "tower", tx, ty, w: 4, h: 4, flag: i % 2 === 0 ? 0x9c2a2a : 0xe0a83f }));

  return { map: { width, height, tiles, spawn: TOWN_SPOTS.spawn }, mobs: [], decor };
}

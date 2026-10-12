import { TILE_SIZE } from "./constants";
import type { Decor, DungeonLayout } from "./dungeons";
import { mulberry32, Tile } from "./map";

// The main town (Ana Merkez): a walled city with the fountain square in the middle,
// shops along the north street, the blacksmith to the west and the market square
// in the south. The east gate opens onto a road that ends at the teleport gate
// to the hunting grounds. No mobs and no PvP here.

const px = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 1) * TILE_SIZE });

export const TOWN_WIDTH = 60;
export const TOWN_HEIGHT = 44;

/** City wall (inclusive tile bounds). */
const WALL = { x0: 3, y0: 3, x1: 44, y1: 40 };
/** The market square, where players may open stalls (tiles). */
const MARKET_AREA = { tx: 7, ty: 30, w: 34, h: 9 };
/** Rows of the east road, from the wall gap out to the teleport gate. */
const ROAD_ROWS = [20, 21, 22];

/** Feet positions of things placed in town (tile coordinates). */
export const TOWN_SPOTS = {
  /** Teleport gate at the end of the east road. */
  fieldGate: px(55, 21),
  /** Where you appear when you come back from the hunting grounds: on the road, facing the city. */
  fromField: px(50, 21),
  pvpPortal: px(39, 15),
  pvpReturn: px(39, 18),
  spawn: px(24, 25),
  weaponsmith: px(10, 10),
  armorer: px(19, 10),
  scribe: px(28, 10),
  alchemist: px(37, 10),
  blacksmith: px(8, 19),
  jeweler: px(9, 26),
  commander: px(41, 19),
  sage: px(20, 21),
  cook: px(34, 26),
};

export function buildTown(): DungeonLayout {
  const width = TOWN_WIDTH;
  const height = TOWN_HEIGHT;
  const rand = mulberry32(2024);
  const tiles: Tile[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) return Tile.Tree;
      const r = rand();
      // Woods outside the walls, thinning out towards the road.
      if (x > WALL.x1 && r < 0.12 && !ROAD_ROWS.some((row) => Math.abs(row - y) <= 2)) return Tile.Tree;
      return r < 0.05 ? Tile.Flower : r < 0.3 ? Tile.GrassAlt : Tile.Grass;
    }),
  );
  const fill = (x0: number, y0: number, x1: number, y1: number, tile: Tile) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles[y][x] = tile;
  };

  // Walls and streets.
  fill(WALL.x0, WALL.y0, WALL.x1, WALL.y1, Tile.Wall);
  fill(WALL.x0 + 1, WALL.y0 + 1, WALL.x1 - 1, WALL.y1 - 1, Tile.Cobble);
  // East gate and the road to the teleport gate.
  for (const row of ROAD_ROWS) for (let x = WALL.x1; x <= width - 3; x++) tiles[row][x] = Tile.Path;
  fill(WALL.x1 + 1, ROAD_ROWS[0] - 1, width - 3, ROAD_ROWS[0] - 1, Tile.Grass);
  fill(WALL.x1 + 1, ROAD_ROWS[2] + 1, width - 3, ROAD_ROWS[2] + 1, Tile.Grass);

  // Fountain square and the market.
  fill(17, 14, 31, 28, Tile.Plaza);
  fill(MARKET_AREA.tx, MARKET_AREA.ty, MARKET_AREA.tx + MARKET_AREA.w - 1, MARKET_AREA.ty + MARKET_AREA.h - 1, Tile.Market);

  // Little gardens on the square's diagonals.
  for (const [gx, gy] of [[18, 15], [29, 15], [18, 26], [29, 26]]) {
    fill(gx, gy, gx + 1, gy + 1, Tile.Grass);
    tiles[gy][gx + (gx < 24 ? 0 : 1)] = Tile.Flower;
    tiles[gy + 1][gx + (gx < 24 ? 1 : 0)] = Tile.Flower;
  }
  // Trees in the corners of the city.
  for (const [tx, ty] of [[5, 5], [42, 5], [5, 38], [42, 38], [42, 26], [5, 26]]) tiles[ty][tx] = Tile.Tree;

  const decor: Decor[] = [];
  const solid = (tx: number, ty: number, w: number, h: number) => fill(tx, ty, tx + w - 1, ty + h - 1, Tile.Solid);
  type Building = Extract<Decor, { kind: "building" }>;
  const building = (tx: number, ty: number, w: number, h: number, roof: number, sign?: Building["sign"], chimney = false) => {
    solid(tx, ty, w, h);
    decor.push({ kind: "building", tx, ty, w, h, roof, sign, chimney });
  };

  // North street: one shop per trade, the shopkeeper stands at the door.
  building(7, 5, 7, 5, 0x9c3b2e, { shape: "sword", color: 0xc8ccd4 });
  building(16, 5, 7, 5, 0x3b5f8a, { shape: "chest", color: 0x9aa4b4 });
  building(25, 5, 7, 5, 0x6a4c93, { shape: "scroll", color: 0x3f7fd9 });
  building(34, 5, 7, 5, 0x2f7a4f, { shape: "potion", color: 0xd94141 });
  // Blacksmith's forge with an anvil out front.
  building(5, 14, 6, 5, 0x4a4040, { shape: "axe", color: 0xb0b4bc }, true);
  solid(11, 18, 1, 1);
  decor.push({ kind: "anvil", tx: 11, ty: 18 });

  // Jeweller's shop below the forge.
  building(6, 22, 6, 4, 0x8c6d1f, { shape: "ring", color: 0xffd43b });

  solid(22, 19, 5, 4);
  decor.push({ kind: "fountain", tx: 22, ty: 19, w: 5, h: 4 });

  for (const [tx, ty] of [
    [17, 14], [31, 14], [17, 28], [31, 28], // square
    [7, 29], [40, 29], [7, 39], [40, 39], // market corners
    [46, 19], [46, 23], [52, 19], [52, 23], // road
  ]) {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "lamp", tx, ty });
  }
  for (const [tx, color] of [[12, 0xc92a2a], [20, 0xe0a83f], [28, 0x3b5bdb], [36, 0x2f9e44]] as const) {
    solid(tx, 29, 1, 1);
    decor.push({ kind: "banner", tx, ty: 29, color });
  }
  // Make the market square unmistakable: a sign over its entrance and a gold line around it.
  decor.push({ kind: "signboard", tx: 22, ty: 29, w: 5, text: "PAZAR" });
  decor.push({ kind: "groundFrame", ...MARKET_AREA, color: 0xe8c33a });

  return { map: { width, height, tiles, spawn: TOWN_SPOTS.spawn }, mobs: [], decor };
}

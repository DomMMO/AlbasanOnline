import { TILE_SIZE } from "./constants";
import { placeArt, type Decor, type DungeonLayout } from "./dungeons";
import { mulberry32, Tile } from "./map";

// The harbour (Liman), just south of the main town: a stone quay and a sandy beach on the
// sea, three wooden piers, a moored ship and a lighthouse on the rocks. Balıkçı Rıfat sells
// rods; anyone with a rod can fish at the water's edge (see data/fishing.ts).
// No mobs and no PvP.

const WIDTH = 56;
const HEIGHT = 40;
/** First row of the sea; everything below it is water (apart from the piers). */
const SEA_ROW = 21;

const px = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 1) * TILE_SIZE });

export const HARBOR_SPOTS = {
  /** Teleport gate back to town, at the top of the road. */
  townGate: px(28, 3),
  /** Where you appear coming from town. */
  fromTown: px(28, 6),
  spawn: px(28, 9),
  fisherman: px(24, 19),
};

/** Wooden piers reaching into the sea (tile rectangles, inclusive). */
const PIERS = [
  { x0: 11, y0: SEA_ROW, x1: 12, y1: 30 },
  { x0: 27, y0: SEA_ROW, x1: 29, y1: 34 },
  { x0: 23, y0: 33, x1: 33, y1: 34 },
  { x0: 40, y0: SEA_ROW, x1: 41, y1: 28 },
];

export function buildHarbor(): DungeonLayout {
  const rand = mulberry32(7331);
  const tiles: Tile[][] = Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => {
      if (y >= SEA_ROW) return Tile.Water;
      if (x < 2 || y < 2 || x >= WIDTH - 2) return Tile.Tree;
      const r = rand();
      // Trees thin out towards the shore.
      if (y < 12 && r < 0.1) return Tile.Tree;
      return r < 0.04 ? Tile.Flower : r < 0.3 ? Tile.GrassAlt : Tile.Grass;
    }),
  );
  const fill = (x0: number, y0: number, x1: number, y1: number, tile: Tile) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (tiles[y]?.[x] !== undefined) tiles[y][x] = tile;
  };

  // Sand beach to the west, stone quay to the east, and the road down from the town gate.
  fill(2, 17, 19, SEA_ROW - 1, Tile.Path);
  fill(20, 15, WIDTH - 3, SEA_ROW - 1, Tile.Cobble);
  fill(27, 2, 29, 14, Tile.Cobble);
  fill(20, 15, 21, 16, Tile.Path);
  for (const p of PIERS) fill(p.x0, p.y0, p.x1, p.y1, Tile.Bridge);
  // The sea reaches the map edges at the sides too.
  fill(0, SEA_ROW, 1, HEIGHT - 1, Tile.Water);

  const decor: Decor[] = [];
  const solid = (tx: number, ty: number, w: number, h: number) => fill(tx, ty, tx + w - 1, ty + h - 1, Tile.Solid);
  const building = (tx: number, ty: number, w: number, h: number, roof: number, sign?: Extract<Decor, { kind: "building" }>["sign"], chimney = false) => {
    solid(tx, ty, w, h);
    decor.push({ kind: "building", tx, ty, w, h, roof, sign, chimney });
  };
  const prop = (tx: number, ty: number, kind: Extract<Decor, { kind: "prop" }>["prop"]) => {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "prop", tx, ty, prop: kind });
  };

  // Along the quay: the fisherman's shed, the tavern, the warehouse and a house on the beach.
  building(21, 11, 6, 4, 0x2f6b8a, { shape: "fish", color: 0x8fa8c0 }); // Balıkçı Rıfat's shed
  building(32, 9, 7, 5, 0x9c3b2e, { shape: "bowl", color: 0xb5651d }, true); // Liman Meyhanesi
  building(41, 9, 8, 5, 0x6b5a3a, { shape: "chest", color: 0xc8a165 }); // warehouse
  building(9, 12, 5, 4, 0x8a5a3a, undefined, true);
  building(14, 7, 4, 3, 0x5a6b8a);

  // The lighthouse on its rocks at the east end of the quay.
  solid(49, 15, 3, 3);
  decor.push({ kind: "lighthouse", tx: 49, ty: 15, w: 3, h: 3 });

  for (const p of PIERS) decor.push({ kind: "pier", tx: p.x0, ty: p.y0, w: p.x1 - p.x0 + 1, h: p.y1 - p.y0 + 1 });
  // A ship moored on the east side of the last pier.
  decor.push({ kind: "ship", tx: 43, ty: 23, w: 9, h: 5 });

  for (const [tx, ty] of [[24, 16], [25, 16], [36, 16], [45, 16], [46, 17], [38, 19]] as const) prop(tx, ty, "crate");
  for (const [tx, ty] of [[23, 16], [33, 16], [34, 16], [44, 17], [16, 18]] as const) prop(tx, ty, "barrel");
  prop(31, 15, "cart");
  for (const [tx, ty] of [[26, 15], [30, 15], [22, 20], [35, 20], [44, 20], [10, 20], [26, 8], [30, 8], [26, 5], [30, 12]] as const) {
    solid(tx, ty, 1, 1);
    decor.push({ kind: "lamp", tx, ty });
  }

  // The road down from the town gate: an avenue of trees with flower beds along the kerb.
  const free = (x: number, y: number) => tiles[y][x] === Tile.Grass || tiles[y][x] === Tile.GrassAlt || tiles[y][x] === Tile.Flower;
  for (let y = 4; y <= 14; y++) {
    if (y % 3 === 1) {
      for (const x of [25, 31]) if (free(x, y)) tiles[y][x] = Tile.Tree;
    } else {
      for (const x of [26, 30]) if (free(x, y)) tiles[y][x] = Tile.Flower;
    }
  }
  // Clear the odd tree right beside the lane so the avenue reads cleanly.
  for (let y = 3; y <= 14; y++) for (const x of [24, 26, 30, 32]) if (tiles[y][x] === Tile.Tree) tiles[y][x] = Tile.Grass;

  // Palms along the beach, an old stone face looking out to sea, ferns and stones in the grass.
  const beach = (x: number, y: number) => tiles[y][x] === Tile.Path;
  for (const [i, [tx, ty]] of [[3, 17], [7, 18], [14, 17], [18, 17]].entries()) placeArt(tiles, decor, i % 2 ? "t_palm_2" : "t_palm_1", tx, ty, beach);
  placeArt(tiles, decor, "t_statue", 4, 14, free);
  const extra = mulberry32(7332);
  for (let n = 0; n < 14; n++) {
    const tx = 3 + Math.floor(extra() * 18);
    const ty = 3 + Math.floor(extra() * 12);
    if (free(tx, ty)) decor.push({ kind: "art", key: ["t_fern_1", "t_fern_2", "t_stones_1", "t_stones_2"][n % 4], tx, ty });
  }
  return { map: { width: WIDTH, height: HEIGHT, tiles, spawn: HARBOR_SPOTS.spawn }, mobs: [], decor };
}

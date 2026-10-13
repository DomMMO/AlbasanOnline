import { TILE_SIZE } from "./constants";
import type { Decor, DungeonLayout } from "./dungeons";
import { Tile } from "./map";

// Inside the keep (İç Kale): a timbered great hall entered through the keep's front door
// in town. The class masters sit round a fire pit in the middle; long tables, bookshelves,
// weapon racks and banners line the walls. Dim even by day, so the fire and torches glow.
// No mobs and no PvP.

const WIDTH = 30;
const HEIGHT = 22;
/** Back wall rows (the last of them is drawn as the wall's face). */
const BACK_WALL = 3;

const px = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 1) * TILE_SIZE });

/** The fire pit's top-left tile (it is 2x2). */
const FIRE = { tx: 14, ty: 10 };

export const KEEP_HALL_SPOTS = {
  /** The way out, in the gap of the front wall. */
  door: { x: 15 * TILE_SIZE, y: HEIGHT * TILE_SIZE - 2 },
  /** Where you appear coming in from town. */
  fromTown: px(14, 18),
  spawn: px(14, 17),
  /** The class masters' seats round the fire (feet positions) and which way they face. */
  seats: {
    warrior: { ...px(13, 8), facing: "down" },
    mage: { ...px(16, 8), facing: "down" },
    guardian: { ...px(11, 11), facing: "right" },
    priest: { ...px(18, 11), facing: "left" },
    rogue: { ...px(13, 13), facing: "up" },
    necromancer: { ...px(16, 13), facing: "up" },
  },
  guardWest: px(12, 19),
  guardEast: px(17, 19),
} as const;

export function buildKeepHall(): DungeonLayout {
  const tiles: Tile[][] = Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => {
      if (y < BACK_WALL || x === 0 || x === WIDTH - 1) return Tile.WoodWall;
      // Front wall, with the doorway in the middle.
      if (y === HEIGHT - 1 && (x < 14 || x > 15)) return Tile.WoodWall;
      return Tile.WoodFloor;
    }),
  );
  const decor: Decor[] = [];
  const solid = (tx: number, ty: number, w = 1, h = 1) => {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) tiles[y][x] = Tile.Solid;
  };
  const prop = (tx: number, ty: number, kind: Extract<Decor, { kind: "prop" }>["prop"]) => {
    solid(tx, ty);
    decor.push({ kind: "prop", tx, ty, prop: kind });
  };

  // A red runner from the door to the fire, and a round-ish rug under the masters' ring.
  decor.push({ kind: "rug", tx: 10, ty: 7, w: 10, h: 8, color: 0x7a2a2a });
  decor.push({ kind: "rug", tx: 14, ty: 15, w: 2, h: 6, color: 0x9c2a2a });

  // The fire pit and the masters' stools round it.
  solid(FIRE.tx, FIRE.ty, 2, 2);
  decor.push({ kind: "firepit", tx: FIRE.tx, ty: FIRE.ty });
  for (const seat of Object.values(KEEP_HALL_SPOTS.seats)) {
    const tx = Math.floor(seat.x / TILE_SIZE);
    const ty = seat.y / TILE_SIZE - 1;
    solid(tx, ty);
    decor.push({ kind: "stool", tx, ty });
  }

  // Along the back wall: bookshelves, weapon racks and the town's banners.
  for (const tx of [2, 23]) {
    solid(tx, BACK_WALL, 4, 1);
    decor.push({ kind: "shelf", tx, ty: BACK_WALL, w: 4 });
  }
  for (const tx of [8, 18]) {
    solid(tx, BACK_WALL, 4, 1);
    decor.push({ kind: "rack", tx, ty: BACK_WALL, w: 4 });
  }
  for (const tx of [13, 16]) {
    solid(tx, BACK_WALL);
    decor.push({ kind: "banner", tx, ty: BACK_WALL, color: 0x9c2a2a });
  }

  // Long feasting tables with benches on the west, the war table with its map on the east.
  solid(3, 9, 5, 2);
  decor.push({ kind: "table", tx: 3, ty: 9, w: 5, h: 2 });
  for (const ty of [8, 11]) {
    solid(3, ty, 5, 1);
    decor.push({ kind: "bench", tx: 3, ty, w: 5 });
  }
  solid(3, 15, 5, 2);
  decor.push({ kind: "table", tx: 3, ty: 15, w: 5, h: 2 });
  solid(3, 14, 5, 1);
  decor.push({ kind: "bench", tx: 3, ty: 14, w: 5 });
  solid(22, 9, 5, 3);
  decor.push({ kind: "table", tx: 22, ty: 9, w: 5, h: 3, map: true });

  // Torches down both side walls, barrels and crates in the corners.
  for (const [tx, ty] of [[1, 6], [1, 13], [1, 18], [28, 6], [28, 13], [28, 18], [11, 20], [18, 20]] as const) {
    solid(tx, ty);
    decor.push({ kind: "torch", tx, ty });
  }
  for (const [tx, ty] of [[1, 4], [2, 4], [27, 15], [28, 16]] as const) prop(tx, ty, "barrel");
  for (const [tx, ty] of [[28, 4], [27, 4], [24, 17], [25, 17]] as const) prop(tx, ty, "crate");

  return { map: { width: WIDTH, height: HEIGHT, tiles, spawn: KEEP_HALL_SPOTS.spawn }, mobs: [], decor };
}

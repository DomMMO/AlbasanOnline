import { mulberry32, Tile, TILE_COUNT, TILE_SIZE } from "../../../shared/src";

// The ground tiles, drawn in code (no Phaser here, so the map editor uses the very same pixels).
// A GM can replace any of them with an uploaded image (tileArt.ts).

/**
 * Render-only tile: a cave wall with floor below it, i.e. the rock face the camera
 * looks at. Collision still treats it as Tile.CaveWall.
 */
export const WALL_FACE_TILE = TILE_COUNT;
/** Render-only tile: the front face of the town wall. */
export const TOWN_WALL_FACE_TILE = TILE_COUNT + 1;
/** Render-only tile: the front of a timbered wall indoors (log courses, wainscot). */
export const WOOD_WALL_FACE_TILE = TILE_COUNT + 2;
/**
 * Render-only tiles under a floating island's edge: three rows of cliff (the island's
 * underside, narrowing into the sky), or of waterfall where water runs off the edge.
 */
export const CLIFF_TILES = [TILE_COUNT + 3, TILE_COUNT + 4, TILE_COUNT + 5];
export const FALL_TILES = [TILE_COUNT + 6, TILE_COUNT + 7, TILE_COUNT + 8];
/**
 * Render-only variants of the grass tiles, painted the same way with other random tufts, so a
 * big meadow does not show the same tile over and over.
 */
const VARIANTS: [Tile, number[]][] = [
  [Tile.Grass, [TILE_COUNT + 9, TILE_COUNT + 10]],
  [Tile.GrassAlt, [TILE_COUNT + 11]],
  [Tile.Flower, [TILE_COUNT + 12]],
];
/**
 * Stone floors are cut from one big seamless pattern of stones (size x size tiles) instead of
 * tile by tile: each spot shows its piece of it, so stones run across tile edges, every one has
 * its own shape, and the pattern repeats only every `size` tiles.
 */
const MACROS: { tile: Tile; size: number; start: number }[] = [
  { tile: Tile.Cobble, size: 6, start: TILE_COUNT + 13 },
  { tile: Tile.Plaza, size: 4, start: TILE_COUNT + 13 + 36 },
];
const VARIANT_BASE = new Map<number, Tile>([
  ...VARIANTS.flatMap(([tile, slots]) => slots.map((slot) => [slot, tile] as [number, Tile])),
  ...MACROS.flatMap(({ tile, size, start }) => Array.from({ length: size * size }, (_, i) => [start + i, tile] as [number, Tile])),
]);
const VARIANT_SLOTS = new Map<number, number[]>(VARIANTS.map(([tile, slots]) => [tile, [tile, ...slots]]));
/** Every tileset slot that shows a tile (itself, its variants, its piece of a stone pattern). */
const ALL_SLOTS = new Map<number, number[]>([
  ...VARIANTS.map(([tile, slots]) => [tile, [tile, ...slots]] as [number, number[]]),
  ...MACROS.map(({ tile, size, start }) => [tile, [tile, ...Array.from({ length: size * size }, (_, i) => start + i)]] as [number, number[]]),
]);
/** Tiles in the tileset: every Tile, the wall faces, cliff and waterfall rows, grass variants, stone patterns. */
export const RENDER_TILE_COUNT = TILE_COUNT + 13 + 36 + 16;
/** The tileset is laid out in rows of this many tiles (a single row gets too wide for some GPUs). */
export const TILESET_COLUMNS = 16;

/** Where a tileset index sits in the tileset (column, row). */
export function tileCell(index: number): { col: number; row: number } {
  return { col: index % TILESET_COLUMNS, row: Math.floor(index / TILESET_COLUMNS) };
}

/** The Tile a tileset index draws (a variant's own tile; anything else itself). */
export function tileBase(index: number): number {
  return VARIANT_BASE.get(index) ?? index;
}

/** What to draw for a tile at (x, y): its piece of a stone pattern, or one of its variants. */
function variantAt(tile: number, x: number, y: number): number {
  const macro = MACROS.find((m) => m.tile === tile);
  if (macro) return macro.start + (y % macro.size) * macro.size + (x % macro.size);
  const slots = VARIANT_SLOTS.get(tile);
  if (!slots) return tile;
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return slots[((h ^ (h >>> 16)) >>> 0) % slots.length];
}

interface StoneLook {
  stones: string[];
  joint: string;
  light: string;
  dark: string;
  /** Joints also open up where three stones meet, rounding the stones off. */
  round: number;
  /** How far each stone's centre wanders from a regular grid (0..1 of the spacing). */
  jitter: number;
}

const COBBLES: StoneLook = { stones: ["#a19b90", "#aaa498", "#979186", "#b0aa9e", "#918b80", "#b6b0a3"], joint: "#5a554e", light: "#cbc6ba", dark: "#77726a", round: 0.6, jitter: 0.8 };
const FLAGSTONES: StoneLook = { stones: ["#cec5b2", "#d6cdbb", "#c3b9a5", "#ddd5c3", "#c8bfab", "#b9af9b"], joint: "#7f7768", light: "#ece5d7", dark: "#a49a88", round: 0.85, jitter: 1.1 };

/**
 * A seamless (wrapping) pattern of stones, `sizeTiles` tiles square: Voronoi cells round
 * jittered points, the joints where two cells meet, each stone its own shade, lit along its
 * top-left edge and shaded along its bottom-right one.
 */
function stonePattern(sizeTiles: number, spacing: number, look: StoneLook, seed: number): HTMLCanvasElement {
  const S = sizeTiles * TILE_SIZE;
  const rand = mulberry32(seed);
  const n = Math.round(S / spacing);
  const step = S / n;
  const points = Array.from({ length: n * n }, (_, i) => ({
    x: ((i % n) + 0.5 + (rand() - 0.5) * look.jitter) * step,
    y: (Math.floor(i / n) + 0.5 + (rand() - 0.5) * look.jitter) * step,
    colour: look.stones[Math.floor(rand() * look.stones.length)],
  }));
  const owner = new Int32Array(S * S);
  const joint = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let d1 = Infinity;
      let d2 = Infinity;
      let best = 0;
      const gx = Math.floor(x / step);
      const gy = Math.floor(y / step);
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          const cx = (((gx + ox) % n) + n) % n;
          const cy = (((gy + oy) % n) + n) % n;
          const pt = points[cy * n + cx];
          // Distance on the torus, so the pattern wraps round seamlessly.
          let dx = Math.abs(x + 0.5 - pt.x);
          let dy = Math.abs(y + 0.5 - pt.y);
          dx = Math.min(dx, S - dx);
          dy = Math.min(dy, S - dy) * 1.15;
          const d = Math.hypot(dx, dy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = cy * n + cx;
          } else if (d < d2) d2 = d;
        }
      }
      owner[y * S + x] = best;
      joint[y * S + x] = d2 - d1 < 1.15 || d1 > step * look.round ? 1 : 0;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const at = (x: number, y: number) => ((((y % S) + S) % S) * S + (((x % S) + S) % S));
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      let colour = look.joint;
      if (!joint[i]) {
        const mine = owner[i];
        const edgeUp = joint[at(x, y - 1)] || owner[at(x, y - 1)] !== mine || joint[at(x - 1, y)] || owner[at(x - 1, y)] !== mine;
        const edgeDown = joint[at(x, y + 1)] || owner[at(x, y + 1)] !== mine || joint[at(x + 1, y)] || owner[at(x + 1, y)] !== mine;
        colour = edgeUp ? look.light : edgeDown ? look.dark : points[mine].colour;
      }
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // A few worn specks.
  for (let i = 0; i < S; i++) {
    const x = Math.floor(rand() * S);
    const y = Math.floor(rand() * S);
    if (joint[y * S + x]) continue;
    ctx.fillStyle = look.dark;
    ctx.fillRect(x, y, 1, 1);
  }
  return canvas;
}

/**
 * Cobblestones straying onto the paving at the edge of a cobbled street (n, e, s, w; variants
 * in columns): a few small rounded stones by the edge and fewer further in, so the street
 * fades into the square instead of stopping at a line.
 */
export function paintStoneFringe(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE * 4;
  canvas.height = TILE_SIZE * 4;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(4321);
  const last = TILE_SIZE - 1;
  const put = (side: number, variant: number, along: number, depth: number, colour: string) => {
    const [x, y] = side === 0 ? [along, depth] : side === 1 ? [last - depth, along] : side === 2 ? [along, last - depth] : [depth, along];
    if (x < 0 || y < 0 || x > last || y > last) return;
    ctx.fillStyle = colour;
    ctx.fillRect(variant * TILE_SIZE + x, side * TILE_SIZE + y, 1, 1);
  };
  for (let side = 0; side < 4; side++) {
    for (let variant = 0; variant < 4; variant++) {
      for (let k = 0; k < TILE_SIZE; ) {
        const w = 3 + Math.floor(rand() * 2);
        // A stone at the edge now and then, rarely one further in.
        for (const [depth, chance] of [[0, 0.5], [3, 0.15]] as const) {
          if (rand() > chance) continue;
          const d0 = depth + Math.floor(rand() * 2);
          const h = 2 + Math.floor(rand() * 2);
          const stone = COBBLES.stones[Math.floor(rand() * COBBLES.stones.length)];
          for (let a = 0; a < w - 1; a++) {
            for (let d = 0; d < h; d++) {
              const corner = (a === 0 || a === w - 2) && (d === 0 || d === h - 1);
              put(side, variant, k + a, d0 + d, corner ? COBBLES.joint : d === 0 ? COBBLES.light : d === h - 1 ? COBBLES.dark : stone);
            }
            put(side, variant, k + a, d0 + h, "rgba(60, 50, 40, 0.3)");
          }
        }
        // Gaps between them.
        k += w + 1 + Math.floor(rand() * 3);
      }
    }
  }
  return canvas;
}

/** Grass spilling over the edge of a stone or earth tile: 4 shapes for each side (n, e, s, w). */
export const FRINGE_VARIANTS = 4;
export const FRINGE_SIDES = ["n", "e", "s", "w"] as const;

/**
 * The grass overhanging stone floors from a neighbouring grass tile, one tile per side and
 * variant (rows: n, e, s, w; columns: variants): ragged tongues of grass a few pixels into
 * the stone, lit blade tips, and the little shadow they cast.
 */
export function paintGrassFringe(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE * FRINGE_VARIANTS;
  canvas.height = TILE_SIZE * FRINGE_SIDES.length;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(1234);
  const put = (side: number, variant: number, along: number, depth: number, colour: string) => {
    const ox = variant * TILE_SIZE;
    const oy = side * TILE_SIZE;
    const last = TILE_SIZE - 1;
    const [x, y] = side === 0 ? [along, depth] : side === 1 ? [last - depth, along] : side === 2 ? [along, last - depth] : [depth, along];
    ctx.fillStyle = colour;
    ctx.fillRect(ox + x, oy + y, 1, 1);
  };
  for (let side = 0; side < FRINGE_SIDES.length; side++) {
    for (let variant = 0; variant < FRINGE_VARIANTS; variant++) {
      const p1 = rand() * 6;
      const p2 = rand() * 6;
      for (let k = 0; k < TILE_SIZE; k++) {
        const depth = Math.max(0, Math.min(5, Math.round(1.6 + 1.4 * Math.sin(k * 0.7 + p1) + 0.9 * Math.sin(k * 1.9 + p2) + rand() * 0.8)));
        for (let d = 0; d < depth; d++) put(side, variant, k, d, d === depth - 1 ? "#5f9c44" : rand() < 0.15 ? "#447a33" : "#4f8a3c");
        // A blade now and then reaching further, lit at its tip; the shadow on the stone below.
        const blade = rand() < 0.3 ? 1 + Math.floor(rand() * 2) : 0;
        for (let d = depth; d < depth + blade; d++) put(side, variant, k, d, d === depth + blade - 1 ? "#8ccb5e" : "#6fae4c");
        put(side, variant, k, depth + blade, "rgba(20, 30, 10, 0.28)");
      }
    }
  }
  return canvas;
}
/** Nothing drawn (open sky: the clouds below show through). */
const EMPTY = -1;

/** Tile indexes to draw for a map (adds wall faces, hides blockers under decor). */
export function renderTiles(tiles: Tile[][]): number[][] {
  return tiles.map((row, y) =>
    row.map((tile, x) => {
      if (tile === Tile.CaveWall && tiles[y + 1]?.[x] === Tile.CaveFloor) return WALL_FACE_TILE;
      if (tile === Tile.Wall && tiles[y + 1]?.[x] !== undefined && tiles[y + 1][x] !== Tile.Wall) return TOWN_WALL_FACE_TILE;
      if (tile === Tile.WoodWall && tiles[y + 1]?.[x] !== undefined && tiles[y + 1][x] !== Tile.WoodWall) return WOOD_WALL_FACE_TILE;
      // Under buildings, lamps and the fountain: draw whatever ground surrounds it.
      if (tile === Tile.Solid) return variantAt(groundAround(tiles, x, y), x, y);
      if (tile === Tile.Sky) return underEdge(tiles, x, y);
      return variantAt(tile, x, y);
    }),
  );
}

/** Sky: the island's underside for three rows below its edge (a waterfall under water), else nothing. */
function underEdge(tiles: Tile[][], x: number, y: number): number {
  for (let k = 1; k <= 3; k++) {
    const above = tiles[y - k]?.[x];
    if (above === undefined) return EMPTY;
    if (above !== Tile.Sky) return (above === Tile.Water ? FALL_TILES : CLIFF_TILES)[k - 1];
  }
  return EMPTY;
}

function groundAround(tiles: Tile[][], x: number, y: number): Tile {
  // The market fence stands on the market's bricks, corners included.
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tiles[y + dy]?.[x + dx] === Tile.Market) return Tile.Market;
  for (let r = 1; r < 6; r++) {
    for (const [dx, dy] of [[0, r], [-r, 0], [r, 0], [0, -r]]) {
      const t = tiles[y + dy]?.[x + dx];
      if (t === Tile.Cobble || t === Tile.Plaza || t === Tile.Market || t === Tile.Grass || t === Tile.Path || t === Tile.DarkGrass || t === Tile.WoodFloor) return t;
    }
  }
  return Tile.Cobble;
}

const TILE_COLORS: Record<Tile, { base: string; speckle: string[] }> = {
  [Tile.Grass]: { base: "#4f8a3c", speckle: ["#5c9a47", "#447a33"] },
  [Tile.GrassAlt]: { base: "#4a8238", speckle: ["#6aa852", "#3d6f2e"] },
  [Tile.Path]: { base: "#b89a6a", speckle: ["#a88b5c", "#c7aa7a"] },
  [Tile.Water]: { base: "#3466a8", speckle: ["#4a7fc0", "#2b5890"] },
  [Tile.Tree]: { base: "#4f8a3c", speckle: ["#447a33"] },
  [Tile.Flower]: { base: "#4f8a3c", speckle: ["#5c9a47"] },
  [Tile.CaveFloor]: { base: "#3a332d", speckle: ["#453d36", "#2f2924", "#4d443c"] },
  [Tile.CaveWall]: { base: "#141211", speckle: ["#1b1817", "#0e0d0c"] },
  [Tile.Cobble]: { base: "#77716a", speckle: ["#837c74", "#6a645d"] },
  [Tile.Plaza]: { base: "#b3aa98", speckle: ["#bfb6a4", "#a59c8a"] },
  [Tile.Market]: { base: "#a5734a", speckle: ["#b07d52", "#956641"] },
  [Tile.Wall]: { base: "#8a8478", speckle: ["#958f83", "#7c766b"] },
  [Tile.Solid]: { base: "#77716a", speckle: ["#837c74"] },
  [Tile.DarkGrass]: { base: "#2f5a2c", speckle: ["#386a33", "#264a24", "#3f5a2a"] },
  [Tile.Bridge]: { base: "#94643a", speckle: ["#a0703f", "#86592f"] },
  [Tile.WoodFloor]: { base: "#7a5233", speckle: ["#845a38", "#6e4a2d"] },
  [Tile.WoodWall]: { base: "#3e2a1a", speckle: ["#46301e", "#352416"] },
  [Tile.Sky]: { base: "#8ec8ee", speckle: ["#a4d4f2", "#7fbde8"] },
};
/** A tile's main colour (the minimap paints one pixel of it per tile). */
export function tileBaseColor(tile: Tile): string {
  return TILE_COLORS[tile].base;
}

const WALL_FACE_COLORS = { base: "#3b3430", speckle: ["#4a423d", "#2c2724"] };
const TOWN_WALL_FACE_COLORS = { base: "#6b655b", speckle: ["#746e64", "#625c53"] };
const WOOD_WALL_FACE_COLORS = { base: "#5a3c24", speckle: ["#64432a", "#4e341f"] };
const CLIFF_COLORS = { base: "#6e5038", speckle: ["#7d5c41", "#5f442f", "#866548"] };
const FALL_COLORS = { base: "#5b8fc9", speckle: ["#7fb0e0", "#4a7fb8"] };

/** The code-drawn tiles, TILE_SIZE each, side by side in tileset order. */
export function paintTileStrip(): HTMLCanvasElement {
  const drawn = document.createElement("canvas");
  drawn.width = TILE_SIZE * RENDER_TILE_COUNT;
  drawn.height = TILE_SIZE;
  const ctx = drawn.getContext("2d")!;
  const rand = mulberry32(42);
  const px = (x: number, y: number, color: string, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  for (let slot = 0; slot < RENDER_TILE_COUNT; slot++) {
    const ox = slot * TILE_SIZE;
    // A variant paints as its own tile does.
    const t = tileBase(slot);
    const { base, speckle } =
      t === WALL_FACE_TILE
        ? WALL_FACE_COLORS
        : t === TOWN_WALL_FACE_TILE
          ? TOWN_WALL_FACE_COLORS
          : t === WOOD_WALL_FACE_TILE
            ? WOOD_WALL_FACE_COLORS
            : CLIFF_TILES.includes(t)
              ? CLIFF_COLORS
              : FALL_TILES.includes(t)
                ? FALL_COLORS
                : TILE_COLORS[t as Tile];
    px(ox, 0, base, TILE_SIZE, TILE_SIZE);
    for (let i = 0; i < 14; i++) {
      px(ox + Math.floor(rand() * TILE_SIZE), Math.floor(rand() * TILE_SIZE), speckle[i % speckle.length]);
    }

    if (t === Tile.Water) {
      px(ox + 3, 4, "#8fb8e8", 4, 1);
      px(ox + 9, 10, "#8fb8e8", 4, 1);
    } else if (t === Tile.Tree) {
      px(ox + 7, 11, "#5b3a1e", 2, 4); // trunk
      px(ox + 2, 2, "#1f4d1f", 12, 9); // canopy shadow
      px(ox + 3, 1, "#2e6b2a", 10, 9);
      px(ox + 4, 2, "#3b8236", 5, 4);
      px(ox + 5, 3, "#4f9a46", 2, 2);
      px(ox + 4, 15, "#00000033", 8, 1);
    } else if (t === WALL_FACE_TILE) {
      // Rock face seen from the front: lit lip at the top, cracks, dark foot where it meets the floor.
      px(ox, 0, "#5a514a", TILE_SIZE, 2);
      px(ox, 2, "#463e39", TILE_SIZE, 1);
      px(ox + 4, 5, "#1f1b19", 1, 5);
      px(ox + 5, 9, "#1f1b19", 3, 1);
      px(ox + 11, 4, "#1f1b19", 1, 4);
      px(ox + 9, 11, "#1f1b19", 4, 1);
      px(ox, 14, "#221e1c", TILE_SIZE, 2);
    } else if (t === Tile.Bridge) {
      // Planks lying across the deck, with gaps and nails.
      for (let y = 0; y < TILE_SIZE; y += 4) {
        px(ox, y + 3, "#4a2e16", TILE_SIZE, 1);
        px(ox, y, "#b07b48", TILE_SIZE, 1);
        px(ox + ((y * 5) % 11) + 2, y + 1, "#6b4423", 3, 1);
        px(ox + 1, y + 1, "#2a2a2a");
        px(ox + 14, y + 1, "#2a2a2a");
      }
    } else if (t === Tile.Cobble || t === Tile.Solid) {
      // Rounded cobblestones of different sizes in offset rows: dark joints, each stone lit on
      // its top-left edge and shaded on its bottom-right one.
      px(ox, 0, "#47433d", TILE_SIZE, TILE_SIZE);
      const greys = ["#8c867c", "#958f84", "#827c72", "#9a9387"];
      for (let row = 0, y = 0; y < TILE_SIZE; row++) {
        const h = 4 + Math.floor(rand() * 2);
        for (let x = row % 2 === 0 ? 0 : -3; x < TILE_SIZE; ) {
          const w = 4 + Math.floor(rand() * 3);
          const x0 = Math.max(0, x);
          const x1 = Math.min(TILE_SIZE, x + w - 1);
          const y1 = Math.min(TILE_SIZE, y + h - 1);
          if (x1 - x0 >= 1) {
            px(ox + x0, y, greys[Math.floor(rand() * greys.length)], x1 - x0, y1 - y);
            px(ox + x0 + 1, y, "#b0aa9e", Math.max(1, x1 - x0 - 2), 1);
            px(ox + x0, y + 1, "#a49e92", 1, Math.max(1, y1 - y - 2));
            px(ox + x0 + 1, y1 - 1, "#68635b", Math.max(1, x1 - x0 - 1), 1);
            px(ox + x1 - 1, y + 1, "#6e6960", 1, Math.max(1, y1 - y - 1));
            // Rounded corners: the joint shows through.
            px(ox + x0, y, "#5a554e");
            px(ox + x1 - 1, y1 - 1, "#55504a");
          }
          x += w;
        }
        y += h;
      }
    } else if (t === Tile.Plaza) {
      // Big flagstones in offset courses: pale stone, lit top-left edges, dark joints, worn spots.
      px(ox, 0, "#6f6758", TILE_SIZE, TILE_SIZE);
      const stones = ["#bdb3a0", "#c6bca8", "#b2a893", "#c9c0ae"];
      for (const [sx, sy, w, h] of [[0, 0, 9, 7], [9, 0, 7, 7], [-4, 8, 8, 8], [4, 8, 8, 8], [12, 8, 8, 8]] as const) {
        const x0 = Math.max(0, sx);
        const x1 = Math.min(TILE_SIZE, sx + w - 1);
        if (x1 - x0 < 1) continue;
        px(ox + x0, sy, stones[Math.floor(rand() * stones.length)], x1 - x0, h - 1);
        px(ox + x0, sy, "#ddd5c4", x1 - x0, 1);
        px(ox + x0, sy, "#d3cab8", 1, h - 1);
        px(ox + x0, sy + h - 2, "#9a9080", x1 - x0, 1);
        px(ox + x1 - 1, sy + 1, "#a39a89", 1, h - 2);
        if (rand() < 0.6) px(ox + x0 + 2 + Math.floor(rand() * Math.max(1, x1 - x0 - 4)), sy + 2 + Math.floor(rand() * 3), "#a8a08f", 2, 1);
      }
    } else if (t === Tile.Market) {
      // Brick herringbone so the market square stands out.
      for (let row = 0; row < 4; row++) {
        const y0 = row * 4;
        px(ox, y0 + 3, "#7e5333", TILE_SIZE, 1);
        const shift = row % 2 === 0 ? 0 : 4;
        px(ox + shift, y0, "#7e5333", 1, 3);
        px(ox + shift + 8, y0, "#7e5333", 1, 3);
        px(ox + shift + 1, y0, "#bd8a5e", 3, 1);
      }
    } else if (t === Tile.Wall) {
      // Wall walk seen from above: stone blocks with a parapet edge.
      px(ox, 0, "#a39d90", TILE_SIZE, 2);
      px(ox, 7, "#6f695e", TILE_SIZE, 1);
      px(ox + 5, 2, "#6f695e", 1, 5);
      px(ox + 11, 8, "#6f695e", 1, 8);
      px(ox, 15, "#6f695e", TILE_SIZE, 1);
    } else if (t === TOWN_WALL_FACE_TILE) {
      // Front of the town wall: brick courses and a lit top edge.
      px(ox, 0, "#9b9588", TILE_SIZE, 2);
      for (const y0 of [5, 9, 13]) px(ox, y0, "#4f4a43", TILE_SIZE, 1);
      for (const [bx, by] of [[4, 2], [12, 2], [0, 6], [8, 6], [4, 10], [12, 10], [8, 14]]) px(ox + bx, by, "#4f4a43", 1, 3);
      px(ox, 15, "#3a3631", TILE_SIZE, 1);
    } else if (t === Tile.WoodFloor) {
      // Long boards running left to right, joints staggered, a nail at each end.
      for (let row = 0; row < 4; row++) {
        const y0 = row * 4;
        px(ox, y0 + 3, "#4e331f", TILE_SIZE, 1);
        px(ox, y0, "#8e6440", TILE_SIZE, 1);
        const joint = (row * 7 + 3) % TILE_SIZE;
        px(ox + joint, y0, "#4e331f", 1, 3);
        px(ox + ((joint + 2) % TILE_SIZE), y0 + 1, "#3a2616");
        px(ox + ((row * 5 + 9) % 14) + 1, y0 + 2, "#6a472b", 3, 1);
      }
    } else if (t === Tile.WoodWall) {
      // Top of a timbered wall: a thick beam with its end grain.
      px(ox, 0, "#5a3c24", TILE_SIZE, 2);
      px(ox, 7, "#2a1c10", TILE_SIZE, 1);
      px(ox, 15, "#2a1c10", TILE_SIZE, 1);
      px(ox + 4, 3, "#2a1c10", 1, 3);
      px(ox + 11, 9, "#2a1c10", 1, 5);
    } else if (t === WOOD_WALL_FACE_TILE) {
      // Log courses with dark gaps, lit from above, a wainscot board at the foot.
      px(ox, 0, "#7a5233", TILE_SIZE, 1);
      for (const y0 of [4, 8]) {
        px(ox, y0, "#2a1c10", TILE_SIZE, 1);
        px(ox, y0 + 1, "#6e4a2d", TILE_SIZE, 1);
      }
      px(ox + 5, 1, "#3e2a1a", 1, 2);
      px(ox + 12, 6, "#3e2a1a", 1, 1);
      px(ox, 11, "#3a2616", TILE_SIZE, 1);
      px(ox, 12, "#8e6440", TILE_SIZE, 1);
      px(ox, 13, "#6e4a2d", TILE_SIZE, 2);
      px(ox, 15, "#1f150c", TILE_SIZE, 1);
    } else if (t === Tile.CaveFloor) {
      px(ox + 3, 11, "#5a5047", 2, 1);
      px(ox + 11, 5, "#5a5047", 1, 1);
    } else if (t === Tile.Sky) {
      // Only seen in the editor's palette: a puff of cloud.
      px(ox + 3, 7, "#ffffff", 10, 4);
      px(ox + 5, 5, "#ffffff", 5, 2);
      px(ox + 3, 10, "#dbe9f5", 10, 1);
    } else if (CLIFF_TILES.includes(t)) {
      // The island's underside: earth and rock in layers, a grass lip at the top, roots hanging
      // out of it, and the bottom row narrowing to ragged points over the sky.
      const row = CLIFF_TILES.indexOf(t);
      for (const y0 of [4, 9, 13]) px(ox, y0, "#4e3826", TILE_SIZE, 1);
      for (const [rx, ry] of [[3, 2], [11, 6], [6, 11]]) px(ox + rx, ry, "#8d6c4f", 3, 1);
      if (row === 0) {
        px(ox, 0, "#4f8a3c", TILE_SIZE, 3);
        for (const dx of [1, 5, 9, 13]) px(ox + dx, 3, "#3d6f2e", 2, 2);
        px(ox + 7, 3, "#3a2a1a", 1, 6);
        px(ox + 12, 5, "#3a2a1a", 1, 4);
      } else if (row === 1) {
        px(ox + 4, 0, "#3a2a1a", 1, 5);
        px(ox + 10, 2, "#5a4a3a", 2, 2);
      } else {
        // Ragged bottom: rock down to a different depth in each column, sky below.
        for (let x = 0; x < TILE_SIZE; x++) {
          const depth = 5 + Math.round(4 + 3 * Math.sin(x * 1.3) + 2 * Math.sin(x * 0.5 + 1));
          ctx.clearRect(ox + x, depth, 1, TILE_SIZE - depth);
          px(ox + x, depth - 1, "#4e3826");
        }
      }
    } else if (FALL_TILES.includes(t)) {
      // Water running off the edge: white streaks falling, and mist where it breaks up.
      const row = FALL_TILES.indexOf(t);
      for (const sx of [1, 4, 8, 11, 14]) px(ox + sx, (sx * 3 + row * 5) % 8, "#d8ecff", 1, 6);
      for (const sx of [2, 6, 10, 13]) px(ox + sx, (sx * 5 + row * 3) % 10 + 3, "#a8d0f4", 1, 4);
      if (row === 0) px(ox, 0, "#cfe6ff", TILE_SIZE, 2);
      if (row === 2) {
        for (let x = 0; x < TILE_SIZE; x++) {
          const depth = 8 + Math.round(3 * Math.sin(x * 0.9));
          ctx.clearRect(ox + x, depth, 1, TILE_SIZE - depth);
        }
        for (const [mx, my] of [[1, 9], [6, 11], [11, 9]]) px(ox + mx, my, "#ffffffcc", 4, 3);
      }
    }
    if (t === Tile.Grass || t === Tile.GrassAlt || t === Tile.Flower) {
      // Tufts: a dark root with lit blade tips above it, the way painted grass reads.
      const tip = t === Tile.GrassAlt ? "#79b85a" : "#6fae4c";
      // Dark strokes between the blades, then the tufts over them.
      for (let i = 0; i < 9; i++) {
        const gx = ox + Math.floor(rand() * 15);
        const gy = 1 + Math.floor(rand() * 14);
        px(gx, gy, "#3d7230", 1, 2);
        px(gx + 1, gy + 1, "#3d7230");
      }
      for (let i = 0; i < 12; i++) {
        const gx = ox + 1 + Math.floor(rand() * 13);
        const gy = 3 + Math.floor(rand() * 12);
        px(gx, gy, "#3a6a2a", 3, 1);
        px(gx, gy - 1, tip);
        px(gx + 2, gy - 1, tip);
        px(gx + 1, gy - 2, "#8ccb5e");
      }
      for (let i = 0; i < 6; i++) px(ox + Math.floor(rand() * TILE_SIZE), Math.floor(rand() * TILE_SIZE), "#3f7531");
      for (let i = 0; i < 4; i++) px(ox + Math.floor(rand() * TILE_SIZE), Math.floor(rand() * TILE_SIZE), "#9ad06a");
    }
    if (t === Tile.Flower) {
      // Little clusters of flowers: four petals round a centre, a dark stem under them.
      const colours: [string, string][] = [["#f2c94c", "#e8590c"], ["#ffffff", "#f2c94c"], ["#f783ac", "#fff3bf"], ["#ffa94d", "#c92a2a"]];
      for (let i = 0; i < 3; i++) {
        const fx = ox + 2 + Math.floor(rand() * 11);
        const fy = 2 + Math.floor(rand() * 11);
        const [petal, heart] = colours[Math.floor(rand() * colours.length)];
        px(fx, fy + 2, "#2f5e24");
        px(fx - 1, fy, petal);
        px(fx + 1, fy, petal);
        px(fx, fy - 1, petal);
        px(fx, fy + 1, petal);
        px(fx, fy, heart);
      }
    }
    if (t === Tile.Path) {
      // Packed earth with a few pebbles.
      for (let i = 0; i < 4; i++) {
        const sx = ox + 1 + Math.floor(rand() * 13);
        const sy = 1 + Math.floor(rand() * 13);
        px(sx, sy, "#8c8478", 2, 1);
        px(sx, sy - 1, "#b8b0a2");
        px(sx + 1, sy + 1, "#7a6648");
      }
    }
  }
  // The stone floors' patterns, cut into their tile slots.
  for (const [i, { size, start }] of MACROS.entries()) {
    const pattern = i === 0 ? stonePattern(size, 6.5, COBBLES, 77) : stonePattern(size, 10, FLAGSTONES, 91);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const slot = start + y * size + x;
        ctx.clearRect(slot * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
        ctx.drawImage(pattern, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, slot * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
      }
    }
  }
  return drawn;
}

/**
 * The tileset: the code-drawn tiles scaled up to `res` pixels per TILE_SIZE, with each uploaded
 * image (tileset index -> image) drawn over its slot.
 */
export function buildTileset(art: Map<number, HTMLImageElement>, res: number): HTMLCanvasElement {
  const drawn = paintTileStrip();
  const size = TILE_SIZE * res;
  const canvas = document.createElement("canvas");
  canvas.width = size * TILESET_COLUMNS;
  canvas.height = size * Math.ceil(RENDER_TILE_COUNT / TILESET_COLUMNS);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  for (let slot = 0; slot < RENDER_TILE_COUNT; slot++) {
    const { col, row } = tileCell(slot);
    ctx.drawImage(drawn, slot * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, col * size, row * size, size, size);
  }
  for (const [index, image] of art) {
    // An uploaded tile replaces its variants and stone pattern too.
    for (const slot of ALL_SLOTS.get(index) ?? [index]) {
      const { col, row } = tileCell(slot);
      ctx.clearRect(col * size, row * size, size, size);
      ctx.drawImage(image, col * size, row * size, size, size);
    }
  }
  return canvas;
}

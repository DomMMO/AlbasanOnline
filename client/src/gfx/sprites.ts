import type Phaser from "phaser";
import { mulberry32, TILE_SIZE } from "../../../shared/src";
import { Pix, shade, tone, type Rgb } from "./pixelArt";

// Pixel-art sprites painted in code, once per scene and look: big trees, bushes, timber-framed
// houses with shingled roofs (ridge across or front-to-back, so roofs face different ways), the
// well, a training dummy and the small props. Light falls from the top left: every round shape
// is shaded in four tones by which way its surface faces, and everything gets a dark outline.

const LIGHT = { x: -0.55, y: -0.83 };
/** How much a point on a dome (nx, ny in -1..1) faces the light, about -1..1. */
const lit = (nx: number, ny: number) => -(nx * LIGHT.x + ny * LIGHT.y) * 0.9 + (1 - Math.min(1, nx * nx + ny * ny)) * 0.25;

// ---- Trees and bushes ------------------------------------------------------------------

interface Leaves {
  dark: Rgb;
  mid: Rgb;
  light: Rgb;
  high: Rgb;
  line: Rgb;
}

const LEAVES: Leaves[] = [
  { dark: 0x24461c, mid: 0x356b26, light: 0x4f9131, high: 0x8cc650, line: 0x13260e },
  { dark: 0x3a4818, mid: 0x566b22, light: 0x7a9230, high: 0xb8c35a, line: 0x20290c },
  { dark: 0x1a3c25, mid: 0x275b34, light: 0x3a7e44, high: 0x72b56a, line: 0x0e2115 },
];
const BARK = { dark: 0x3c1911, mid: 0x6a2b1e, light: 0x8f422c, line: 0x200b07 };

/**
 * Foliage painted in tones (0 dark .. 3 highlight) before colouring: clumps are shaded domes
 * lit from the top left, then a scale of little leaves is stamped over them (each leaf's top
 * edge a tone lighter, its underside a tone darker), which is what makes it read as leaves.
 */
class Foliage {
  readonly tones: Int8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.tones = new Int8Array(w * h).fill(-1);
  }

  clump(cx: number, cy: number, r: number, rand: () => number) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const nx = (x + 0.5 - cx) / r;
        const ny = (y + 0.5 - cy) / (r * 0.92);
        if (nx * nx + ny * ny > 1) continue;
        const t = lit(nx, ny) + (rand() - 0.5) * 0.3;
        this.tones[y * this.w + x] = t > 0.62 ? 3 : t > 0.22 ? 2 : t > -0.32 ? 1 : 0;
      }
    }
  }

  /** Stamps the little leaves (staggered rows), then paints the tones in the leaves' colours. */
  paint(p: Pix, leaves: Leaves, rand: () => number) {
    const out = Int8Array.from(this.tones);
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? y * this.w + x : -1);
    const bump = (x: number, y: number, d: number) => {
      const i = at(x, y);
      if (i < 0 || this.tones[i] < 0) return;
      out[i] = Math.max(0, Math.min(3, this.tones[i] + d));
    };
    for (let y = 0, row = 0; y < this.h; y += 3, row++) {
      for (let x = (row % 2) * 2 + Math.floor(rand() * 2); x < this.w; x += 4) {
        if (at(x, y) < 0 || this.tones[at(x, y)] < 0) continue;
        bump(x, y, 1);
        bump(x + 1, y, 1);
        bump(x + 2, y + 1, -1);
        bump(x + 1, y + 2, -1);
        if (rand() < 0.3) bump(x - 1, y + 1, 1);
      }
    }
    const colours = [leaves.dark, leaves.mid, leaves.light, leaves.high];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (out[y * this.w + x] >= 0) p.px(x, y, colours[out[y * this.w + x]]);
  }
}

/** Feet of a sprite: where on the image the ground point is (from the bottom-left). */
export interface SpriteInfo {
  key: string;
  /** The image's origin, as fractions (Phaser setOrigin). */
  originX: number;
  originY: number;
}

/** A big tree, about four tiles across: a short thick trunk with roots, a dense bumpy crown. */
export function treeSprite(scene: Phaser.Scene, variant: number): SpriteInfo {
  const leaves = LEAVES[variant % LEAVES.length];
  const key = `spr-tree-${variant}`;
  const W = 66;
  const H = 70;
  if (!scene.textures.exists(key)) {
    const p = new Pix(W, H);
    const rand = mulberry32(variant * 977 + 13);
    const cx = W / 2;
    const cy = 29;
    // Trunk: thick, lit on the left, flaring into roots over the last rows.
    for (let y = 40; y < H - 2; y++) {
      const flare = y > H - 11 ? (y - (H - 11)) * 1.8 : 0;
      const w = 10 + flare;
      for (let x = Math.round(cx - w / 2); x < Math.round(cx + w / 2); x++) {
        const f = (x - (cx - w / 2)) / w;
        p.px(x, y, f < 0.28 ? BARK.light : f < 0.7 ? BARK.mid : BARK.dark);
      }
    }
    for (const [x, y, h] of [[cx - 2, 50, 9], [cx + 2, 55, 7], [cx - 4, 60, 5], [cx + 4, 61, 4]] as const) p.rect(x, y, 1, h, BARK.dark);
    // The crown: a ring of clumps round its edge (the bumpy outline) and more filling it in,
    // painted from the back (top) to the front (bottom).
    const clumps: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + rand() * 0.3;
      clumps.push({ x: cx + Math.cos(a) * 21, y: cy + Math.sin(a) * 17, r: 7.5 + rand() * 2.5 });
    }
    for (let i = 0; i < 12; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 0.75;
      clumps.push({ x: cx + Math.cos(a) * 21 * d, y: cy + Math.sin(a) * 17 * d, r: 8 + rand() * 3 });
    }
    clumps.sort((a, b) => a.y - b.y);
    const foliage = new Foliage(W, H);
    for (const c of clumps) foliage.clump(c.x, c.y, c.r, rand);
    foliage.paint(p, leaves, rand);
    p.outline(leaves.line);
    p.texture(scene, key);
  }
  return { key, originX: 0.5, originY: (H - 2) / H };
}

/** A round bush (about a tile), plain, with blue berries or with yellow flowers. */
export function bushSprite(scene: Phaser.Scene, variant: number): SpriteInfo {
  const key = `spr-bush-${variant}`;
  const W = 24;
  const H = 19;
  if (!scene.textures.exists(key)) {
    const p = new Pix(W, H);
    const rand = mulberry32(variant * 131 + 7);
    const leaves = LEAVES[variant % LEAVES.length];
    const clumps = Array.from({ length: 5 }, () => ({ x: 12 + (rand() - 0.5) * 10, y: 10 + (rand() - 0.5) * 5, r: 4 + rand() * 2.2 })).sort((a, b) => a.y - b.y);
    const foliage = new Foliage(W, H);
    for (const c of clumps) foliage.clump(c.x, c.y, c.r, rand);
    foliage.paint(p, leaves, rand);
    const kind = variant % 3;
    for (let i = 0; i < (kind === 0 ? 0 : 6); i++) {
      const x = Math.round(5 + rand() * 14);
      const y = Math.round(5 + rand() * 9);
      if (p.ctx.getImageData(x, y, 1, 1).data[3] === 0) continue;
      p.px(x, y, kind === 1 ? 0x3b5bdb : 0xf2c94c);
      p.px(x, y - 1, kind === 1 ? 0x91a7ff : 0xfff3bf);
    }
    p.outline(leaves.line);
    p.texture(scene, key);
  }
  return { key, originX: 0.5, originY: (H - 1) / H };
}

// ---- Houses ----------------------------------------------------------------------------

const PLASTER = { light: 0xeee3c8, mid: 0xdccdaa, dark: 0xbfae88 };
const TIMBER = { light: 0x8f5f37, mid: 0x6b4427, dark: 0x3f2615 };
const STONES = { light: 0xa9a294, mid: 0x857e71, dark: 0x5c574e };
const OUTLINE = 0x22150c;
/** How far a roof overhangs the walls on each side (pixels). */
export const ROOF_PAD = 3;

export interface HouseLook {
  w: number;
  h: number;
  roof: number;
  ridge: "h" | "v";
  chimney: boolean;
  sign: boolean;
  seed: number;
}

export interface HouseSprite extends SpriteInfo {
  /** Where things go, in image pixels from the image's left/bottom: the door's centre, the sign, the chimney top. */
  doorX: number;
  sign: { x: number; y: number } | null;
  chimney: { x: number; y: number } | null;
  /** The window panes (image pixels from the top-left), lit at night. */
  windows: { x: number; y: number; w: number; h: number }[];
}

/** One row of shingles: each its own shade, lit top edge, dark rounded bottom, dark gap between. */
function shingleRow(p: Pix, x0: number, x1: number, y: number, h: number, row: number, c: { light: Rgb; mid: Rgb; dark: Rgb }, rand: () => number, width = 6) {
  const offset = (row % 2) * Math.floor(width / 2);
  let body = c.mid;
  for (let x = x0; x < x1; x++) {
    const local = (x - x0 + offset) % width;
    if (local === 0) {
      const r = rand();
      body = r < 0.2 ? tone(c.mid, -0.08) : r < 0.35 ? tone(c.mid, 0.07) : c.mid;
    }
    for (let dy = 0; dy < h; dy++) {
      let col = body;
      if (dy === 0) col = local === 1 ? tone(c.light, 0.15) : c.light;
      if (dy === h - 1) col = local === 0 || local === width - 1 ? tone(c.dark, -0.25) : c.dark;
      if (local === width - 1 && dy > 0) col = c.dark;
      p.px(x, y + dy, col);
    }
  }
}

/** A timber-framed house, its footprint w x h tiles: wall on the front, roof over the rest. */
export function houseSprite(scene: Phaser.Scene, look: HouseLook): HouseSprite {
  const W = look.w * TILE_SIZE;
  const H = look.h * TILE_SIZE;
  const CW = W + ROOF_PAD * 2;
  const CH = H + 18;
  const key = `spr-house-${look.w}x${look.h}-${look.roof}-${look.ridge}-${look.chimney ? 1 : 0}-${look.sign ? 1 : 0}-${look.seed}`;
  const rand = mulberry32(look.seed);
  const roof = { light: shade(look.roof, 0.28), mid: look.roof, dark: shade(look.roof, -0.35), line: tone(look.roof, -0.65) };
  // Walls take about half the depth: a cottage gets one row of windows, a deeper house two.
  const WALL_H = Math.max(25, Math.min(40, Math.round(H * 0.55)));
  const twoStoreys = WALL_H >= 33;
  const wallTop = CH - WALL_H;
  const L = ROOF_PAD;
  const R = ROOF_PAD + W;
  const roofTop = CH - H - 8;
  // The door near the middle, windows in the panels either side.
  const doorX = L + Math.round(W / 2 + (look.w >= 6 ? (rand() < 0.5 ? -8 : 8) : 0)) - 5;
  const gable = look.ridge === "v" ? Math.min(15, Math.round(W * 0.28)) : 0;
  let chimney: { x: number; y: number } | null = null;
  let sign: { x: number; y: number } | null = null;
  const windows: HouseSprite["windows"] = [];

  const p = new Pix(CW, CH);
  // ---- Walls: plaster between timber beams, on a stone footing ----
  p.rect(L, wallTop, W, WALL_H, PLASTER.mid);
  for (let i = 0; i < W * 2; i++) p.px(L + Math.floor(rand() * W), wallTop + Math.floor(rand() * (WALL_H - 4)), rand() < 0.5 ? PLASTER.light : PLASTER.dark);
  p.rect(L, wallTop, W, 4, TIMBER.mid);
  p.rect(L, wallTop, W, 1, TIMBER.light);
  p.rect(L, wallTop + 3, W, 1, TIMBER.dark);
  p.rect(L, CH - 8, W, 3, TIMBER.mid);
  p.rect(L, CH - 8, W, 1, TIMBER.light);
  // The floor beam between the storeys.
  const floorY = wallTop + 14;
  if (twoStoreys) {
    p.rect(L, floorY, W, 2, TIMBER.mid);
    p.rect(L, floorY, W, 1, TIMBER.light);
  }
  const posts = [L, R - 4];
  for (let x = L + 15; x < R - 10; x += 15) if (Math.abs(x - doorX - 5) > 9) posts.push(x);
  for (const x of posts) {
    // Bevelled posts: lit face, body, shaded side, a knot here and there.
    p.rect(x, wallTop, 4, WALL_H - 5, TIMBER.mid);
    p.rect(x, wallTop, 1, WALL_H - 5, TIMBER.light);
    p.rect(x + 3, wallTop + 4, 1, WALL_H - 9, TIMBER.dark);
    for (let y = wallTop + 6; y < CH - 9; y += 7) p.px(x + 1 + (y % 2), y, TIMBER.dark);
  }
  // Corner boards: the house's edges in thick timber, down to the footing.
  for (const x of [L - 1, R - 4]) {
    p.rect(x, wallTop - 1, 5, WALL_H - 3, TIMBER.mid);
    p.rect(x, wallTop - 1, 1, WALL_H - 3, TIMBER.dark);
    p.rect(x + 1, wallTop - 1, 1, WALL_H - 3, TIMBER.light);
    p.rect(x + 4, wallTop - 1, 1, WALL_H - 3, TIMBER.dark);
  }
  // Windows between the posts (not over the door).
  const sorted = [...posts].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i] + 3;
    const b = sorted[i + 1];
    const mid = Math.round((a + b) / 2);
    if (b - a >= 8 && b - a < 12 && Math.abs(mid - (doorX + 5)) >= 11) {
      // A narrow panel: a diagonal brace instead of a window.
      const top = twoStoreys ? floorY + 2 : wallTop + 4;
      const h = CH - 8 - top;
      for (let i = 0; i < h; i++) p.rect(a + Math.round(((b - a - 2) * i) / h), top + i, 2, 1, i % 3 === 0 ? TIMBER.light : TIMBER.mid);
    }
    if (b - a < 12 || Math.abs(mid - (doorX + 5)) < 11) continue;
    const wx = mid - 4;
    const wy = twoStoreys ? floorY + 4 : wallTop + 6;
    if (twoStoreys) {
      // A smaller window upstairs, over the one below.
      p.rect(wx, wallTop + 4, 8, 8, TIMBER.dark);
      p.rect(wx + 1, wallTop + 5, 6, 6, 0x2c4559);
      p.rect(wx + 2, wallTop + 6, 1, 1, 0x9cc1d4);
      p.rect(wx + 3, wallTop + 5, 1, 6, TIMBER.mid);
      p.rect(wx - 1, wallTop + 11, 10, 1, TIMBER.light);
      windows.push({ x: wx + 1, y: wallTop + 5, w: 6, h: 6 });
    }
    windows.push({ x: wx, y: wy, w: 8, h: 8 });
    p.rect(wx - 1, wy - 1, 10, 10, TIMBER.dark);
    p.rect(wx, wy, 8, 8, 0x2c4559);
    p.rect(wx + 1, wy + 1, 2, 1, 0x9cc1d4);
    p.px(wx + 1, wy + 2, 0x6f97ad);
    p.rect(wx + 3, wy, 1, 8, TIMBER.mid);
    p.rect(wx, wy + 3, 8, 1, TIMBER.mid);
    p.rect(wx - 2, wy + 8, 12, 2, TIMBER.light);
    // Shutters in the roof's colour on the wider walls.
    if (b - a >= 16) {
      p.rect(wx - 4, wy - 1, 3, 10, roof.dark);
      p.rect(wx + 9, wy - 1, 3, 10, roof.dark);
      p.rect(wx - 4, wy - 1, 1, 10, roof.mid);
    }
  }
  if (twoStoreys) {
    p.rect(doorX + 1, wallTop + 4, 8, 8, TIMBER.dark);
    p.rect(doorX + 2, wallTop + 5, 6, 6, 0x2c4559);
    p.px(doorX + 3, wallTop + 6, 0x9cc1d4);
    p.rect(doorX + 4, wallTop + 5, 1, 6, TIMBER.mid);
    p.rect(doorX, wallTop + 11, 10, 1, TIMBER.light);
    windows.push({ x: doorX + 2, y: wallTop + 5, w: 6, h: 6 });
  }
  // The door: planks in a dark frame, a step in front.
  p.rect(doorX - 1, CH - 18, 12, 17, TIMBER.dark);
  p.rect(doorX, CH - 17, 10, 16, 0x7a4a2a);
  for (const x of [doorX + 3, doorX + 6]) p.rect(x, CH - 17, 1, 16, 0x5a341c);
  p.rect(doorX, CH - 17, 10, 1, 0x9a6438);
  p.px(doorX + 8, CH - 9, 0xe8c33a);
  // Footing: a course of stones, the step.
  for (let x = L; x < R; x += 5) {
    const w = Math.min(5, R - x);
    p.rect(x, CH - 5, w, 5, STONES.mid);
    p.rect(x, CH - 5, w - 1, 1, STONES.light);
    p.rect(x + w - 1, CH - 5, 1, 5, STONES.dark);
  }
  p.rect(doorX - 2, CH - 2, 14, 2, STONES.light);
  p.rect(doorX - 2, CH - 1, 14, 1, STONES.dark);

  // ---- Roof ----
  const eave = (x: number) => (look.ridge === "v" ? wallTop + 2 - Math.round(gable * (1 - Math.abs(x + 0.5 - CW / 2) / (CW / 2))) : wallTop + 2);
  if (look.ridge === "h") {
    // Ridge across: the back slope (light, foreshortened) above, the front slope below.
    const ridgeY = roofTop + Math.round((wallTop - roofTop) * 0.3);
    for (let y = roofTop, row = 0; y < ridgeY; y += 3, row++) shingleRow(p, 0, CW, y, Math.min(3, ridgeY - y), row, { light: tone(roof.light, 0.15), mid: roof.light, dark: roof.mid }, rand, 5);
    for (let y = ridgeY + 2, row = 0; y < wallTop + 2; y += 4, row++) shingleRow(p, 0, CW, y, Math.min(4, wallTop + 2 - y), row, roof, rand);
    p.rect(0, ridgeY, CW, 1, roof.line);
    p.rect(0, ridgeY + 1, CW, 1, tone(roof.light, 0.25));
    // Wooden barge boards down the gable ends.
    for (const x of [0, CW - 3]) {
      p.rect(x, roofTop, 3, wallTop + 2 - roofTop, TIMBER.mid);
      p.rect(x, roofTop, 1, wallTop + 2 - roofTop, TIMBER.light);
      p.rect(x + 2, roofTop, 1, wallTop + 2 - roofTop, TIMBER.dark);
    }
    if (look.chimney) chimney = paintChimney(p, CW - 13, roofTop, ridgeY - roofTop + 8);
  } else {
    // Ridge front to back: a light west slope, a dark east slope, the gable facing us.
    const mid = Math.floor(CW / 2);
    for (let y = roofTop, row = 0; y < wallTop + 2; y += 4, row++) {
      shingleRow(p, 0, mid, y, Math.min(4, wallTop + 2 - y), row, { light: tone(roof.light, 0.2), mid: roof.light, dark: roof.mid }, rand, 5);
      shingleRow(p, mid, CW, y, Math.min(4, wallTop + 2 - y), row + 1, { light: roof.mid, mid: roof.dark, dark: tone(roof.dark, -0.25) }, rand, 5);
    }
    // Cut the roof back along the gable's slopes (down to the wall), put the wall's top beam
    // back, and paint the gable: plaster, a barge board under the roof edge, timbers, a window.
    for (let x = 0; x < CW; x++) p.clear(x, eave(x), 1, wallTop + 2 - eave(x));
    p.rect(L, wallTop, W, 3, TIMBER.mid);
    p.rect(L, wallTop, W, 1, TIMBER.light);
    const apex = wallTop + 2 - gable;
    for (let y = apex; y < wallTop; y++) {
      const half = ((y - apex) / gable) * (CW / 2);
      const x0 = Math.max(L, Math.round(CW / 2 - half));
      const x1 = Math.min(R, Math.round(CW / 2 + half));
      p.rect(x0, y, x1 - x0, 1, PLASTER.mid);
    }
    for (let x = 0; x < CW; x++) {
      const y = eave(x);
      if (y >= wallTop) continue;
      p.px(x, y, roof.line);
      if (x >= L && x < R) {
        const h = Math.min(3, wallTop - y - 1);
        p.rect(x, y + 1, 1, h, TIMBER.mid);
        p.px(x, y + 1, TIMBER.light);
        if (h === 3) p.px(x, y + 3, TIMBER.dark);
      }
    }
    p.rect(mid - 1, apex + 2, 3, wallTop - apex, TIMBER.mid);
    p.rect(mid - 1, apex + 2, 1, wallTop - apex, TIMBER.light);
    for (let i = 0; i < gable - 4; i++) {
      p.px(mid - 3 - i, wallTop - 1 - Math.round(i * 0.55), TIMBER.dark);
      p.px(mid + 3 + i, wallTop - 1 - Math.round(i * 0.55), TIMBER.dark);
    }
    p.rect(mid - 3, apex + 5, 7, 5, TIMBER.dark);
    p.rect(mid - 2, apex + 6, 5, 3, 0x2c4559);
    p.px(mid - 1, apex + 6, 0x9cc1d4);
    windows.push({ x: mid - 2, y: apex + 6, w: 5, h: 3 });
    // Ridge cap down the middle.
    p.rect(mid - 1, roofTop, 1, apex - roofTop, tone(roof.light, 0.3));
    p.rect(mid, roofTop, 1, apex - roofTop, roof.line);
    if (look.chimney) chimney = paintChimney(p, mid + 5, roofTop, 12);
  }
  // The eave's edge (a thick board along the front of a ridge-across roof) and its shadow on the wall.
  if (look.ridge === "h") {
    // The eave: a thick wooden board along the roof's front edge.
    p.rect(0, wallTop - 2, CW, 3, TIMBER.mid);
    p.rect(0, wallTop - 2, CW, 1, TIMBER.light);
    p.rect(0, wallTop, CW, 1, TIMBER.dark);
  }
  for (let x = 0; x < CW; x++) {
    const y = eave(x);
    if (look.ridge === "h") p.px(x, y - 1, roof.line);
    if (x >= L && x < R) p.rect(x, y, 1, 3, 0x000000, 0.22);
  }
  if (look.sign) {
    // A hanging board on a bracket beside the door (the shop's icon is drawn over it).
    const sx = Math.min(R - 16, doorX + 13);
    const sy = Math.max(wallTop + 6, CH - 22);
    p.rect(sx + 1, sy - 2, 12, 1, TIMBER.dark);
    p.rect(sx + 3, sy - 1, 1, 2, TIMBER.dark);
    p.rect(sx + 10, sy - 1, 1, 2, TIMBER.dark);
    p.rect(sx - 1, sy + 1, 16, 14, TIMBER.dark);
    p.rect(sx, sy + 2, 14, 12, 0x9a6a3c);
    p.rect(sx, sy + 2, 14, 1, 0xc08a52);
    sign = { x: sx + 1, y: sy + 2 };
  }
  p.outline(OUTLINE);
  p.texture(scene, key);
  return { key, originX: 0, originY: 1, doorX: doorX + 5, sign, chimney, windows };
}

/**
 * A brick chimney rising `h` pixels from just above `roofTop` at x: courses of brick, a lit
 * edge, and its top seen from above: a cap round a sooty black flue. Returns where smoke rises.
 */
function paintChimney(p: Pix, x: number, roofTop: number, h: number) {
  const top = roofTop - 7;
  p.rect(x, top, 7, h, 0x8a4f3c);
  for (let y = top + 3; y < top + h - 1; y += 3) {
    p.rect(x, y, 7, 1, 0x5e3326);
    p.px(x + ((y / 3) % 2 ? 2 : 5), y - 2, 0x5e3326);
  }
  p.rect(x, top, 1, h, 0xa86a52);
  p.rect(x + 6, top, 1, h, 0x5e3326);
  // The cap and the flue, seen from above.
  p.rect(x - 1, top - 3, 9, 4, 0x6e3e30);
  p.rect(x - 1, top - 3, 9, 1, 0xb07a62);
  p.rect(x + 1, top - 2, 5, 2, 0x140a06);
  p.rect(x + 1, top - 2, 5, 1, 0x2a1810);
  return { x: x + 3, y: top - 3 };
}

// ---- Props -----------------------------------------------------------------------------

/** The well (2x2 tiles): stone ring round dark water, a little shingled roof on posts, a crank and a bucket. */
export function wellSprite(scene: Phaser.Scene): SpriteInfo {
  const key = "spr-well";
  const W = 36;
  const H = 46;
  if (!scene.textures.exists(key)) {
    const p = new Pix(W, H);
    const rand = mulberry32(5);
    const cx = W / 2;
    // The stone drum: front face in courses, the rim seen from above, water inside.
    for (let y = 30; y < 44; y++) {
      for (let x = 5; x < 31; x++) {
        const f = (x - 5) / 26;
        const course = Math.floor((y - 30) / 4);
        const joint = (x + course * 3) % 6 === 0 || (y - 30) % 4 === 3;
        p.px(x, y, joint ? STONES.dark : f < 0.25 ? STONES.light : f > 0.8 ? STONES.dark : STONES.mid);
      }
    }
    p.ellipse(cx, 30, 13, 6, (nx, ny) => (nx * nx + ny * ny < 0.5 ? null : ny < -0.2 || nx < -0.4 ? STONES.light : STONES.mid));
    p.ellipse(cx, 30, 9.5, 3.8, (nx, ny) => (ny < -0.3 ? 0x152434 : nx > 0.3 && ny > 0 ? 0x3b6a8a : 0x1f3a52));
    for (let i = 0; i < 10; i++) p.px(Math.round(cx - 12 + rand() * 24), 30 + Math.round((rand() - 0.5) * 9), STONES.dark);
    // Posts, the roller with the rope, the crank.
    for (const x of [6, 28]) {
      p.rect(x, 12, 3, 22, TIMBER.mid);
      p.rect(x, 12, 1, 22, TIMBER.light);
    }
    p.rect(8, 17, 20, 3, TIMBER.dark);
    p.rect(8, 17, 20, 1, TIMBER.light);
    p.rect(cx, 20, 1, 7, 0xc8b48a);
    p.rect(cx - 2, 26, 5, 4, 0x6b4423);
    p.rect(cx - 2, 26, 5, 1, 0x3a3a40);
    p.rect(31, 16, 3, 1, 0x3a3a40);
    p.rect(33, 16, 1, 4, 0x3a3a40);
    // A little gabled roof.
    for (let y = 4, row = 0; y < 14; y += 3, row++) {
      const inset = Math.max(0, 6 - (y - 4));
      shingleRow(p, 3 + inset, W - 3 - inset, y, 3, row, { light: 0xb5553f, mid: 0x8e3b2b, dark: 0x5e2419 }, rand, 4);
    }
    p.rect(3, 13, W - 6, 1, 0x3a160f);
    p.outline(OUTLINE);
    p.texture(scene, key);
  }
  return { key, originX: 0.5, originY: (H - 2) / H };
}

/** A training dummy: a post with arms, a burlap body tied with rope, a stitched head. */
export function dummySprite(scene: Phaser.Scene): SpriteInfo {
  const key = "spr-dummy";
  const W = 22;
  const H = 34;
  if (!scene.textures.exists(key)) {
    const p = new Pix(W, H);
    const cx = 11;
    p.rect(cx - 5, 31, 11, 2, TIMBER.dark);
    p.rect(cx - 1, 6, 3, 26, TIMBER.mid);
    p.rect(cx - 1, 6, 1, 26, TIMBER.light);
    p.rect(2, 13, 18, 3, TIMBER.mid);
    p.rect(2, 13, 18, 1, TIMBER.light);
    p.rect(1, 12, 2, 5, 0xc8a46a);
    p.rect(19, 12, 2, 5, 0xc8a46a);
    // Body: a burlap sack, light on the left.
    for (let y = 15; y < 27; y++) {
      for (let x = cx - 5; x <= cx + 5; x++) {
        const f = (x - (cx - 5)) / 10;
        p.px(x, y, f < 0.3 ? 0xd9b97a : f < 0.75 ? 0xbf9a5a : 0x9a7840);
      }
    }
    for (const y of [18, 23]) p.rect(cx - 5, y, 11, 1, 0x6b4a24);
    p.rect(cx - 2, 20, 2, 2, 0x8a2a1a);
    // Head: a stitched sack with a face drawn on.
    p.ellipse(cx + 0.5, 7, 5, 4.5, (nx, ny) => (lit(nx, ny) > 0.3 ? 0xd9b97a : lit(nx, ny) > -0.3 ? 0xbf9a5a : 0x9a7840));
    p.px(cx - 1, 6, 0x3a2414);
    p.px(cx + 2, 6, 0x3a2414);
    p.rect(cx - 1, 9, 4, 1, 0x6b4a24);
    p.rect(cx - 2, 3, 6, 1, 0x6b4a24);
    p.outline(OUTLINE);
    p.texture(scene, key);
  }
  return { key, originX: 0.5, originY: (H - 1) / H };
}

/** A barrel: staves, iron hoops, the lid seen from above. */
export function barrelSprite(scene: Phaser.Scene): SpriteInfo {
  const key = "spr-barrel";
  const W = 16;
  const H = 19;
  if (!scene.textures.exists(key)) {
    const p = new Pix(W, H);
    for (let y = 4; y < 18; y++) {
      const bulge = y > 6 && y < 15 ? 1 : 0;
      for (let x = 2 - bulge; x < 14 + bulge; x++) {
        const f = (x - 1) / 13;
        const stave = (x + 1) % 4 === 0;
        p.px(x, y, stave ? 0x4a2a14 : f < 0.3 ? 0xa06a3a : f < 0.75 ? 0x7a4a26 : 0x5a3418);
      }
    }
    for (const y of [6, 14]) p.rect(1, y, 14, 1, 0x3a3a42);
    p.ellipse(8, 4, 6, 2.5, (nx) => (nx < -0.2 ? 0xb07a48 : 0x8a5a30));
    p.rect(5, 4, 6, 1, 0x5a3418);
    p.outline(OUTLINE);
    p.texture(scene, key);
  }
  return { key, originX: 0.5, originY: (H - 1) / H };
}

/** A wooden crate with braces, its lid seen from above. */
export function crateSprite(scene: Phaser.Scene): SpriteInfo {
  const key = "spr-crate";
  const W = 16;
  const H = 18;
  if (!scene.textures.exists(key)) {
    const p = new Pix(W, H);
    p.rect(1, 1, 14, 5, 0xc79a5c);
    for (const y of [2, 4]) p.rect(1, y, 14, 1, 0xa87a42);
    p.rect(1, 6, 14, 11, 0x9a6a3c);
    p.rect(1, 6, 14, 1, 0x6b4423);
    for (let i = 0; i < 10; i++) {
      p.px(2 + i + (i > 4 ? 1 : 0), 7 + i, 0x6b4423);
      p.px(13 - i - (i > 4 ? 1 : 0), 7 + i, 0x6b4423);
    }
    p.rect(1, 6, 2, 11, 0x7a4e2a);
    p.rect(13, 6, 2, 11, 0x5e3a1d);
    p.outline(OUTLINE);
    p.texture(scene, key);
  }
  return { key, originX: 0.5, originY: (H - 1) / H };
}

/** A bale of hay, bound with twine. */
export function haySprite(scene: Phaser.Scene): SpriteInfo {
  const key = "spr-hay";
  const W = 18;
  const H = 15;
  if (!scene.textures.exists(key)) {
    const p = new Pix(W, H);
    const rand = mulberry32(3);
    p.rect(1, 1, 16, 5, 0xe8c45a);
    p.rect(1, 6, 16, 8, 0xc99a34);
    for (let i = 0; i < 26; i++) p.px(1 + Math.floor(rand() * 16), 1 + Math.floor(rand() * 13), rand() < 0.5 ? 0xf5dc84 : 0x9a7424);
    for (const x of [5, 12]) p.rect(x, 1, 1, 13, 0x6b4a1a);
    p.rect(1, 6, 16, 1, 0xa57a28);
    p.outline(OUTLINE);
    p.texture(scene, key);
  }
  return { key, originX: 0.5, originY: (H - 1) / H };
}

/** Plants scattered over the grass (walk-through): ferns, tall grass, flower clumps, broad-leaved weeds. */
export const PLANT_KINDS = 8;

export function plantSprite(scene: Phaser.Scene, variant: number): SpriteInfo {
  const kind = variant % PLANT_KINDS;
  const key = `spr-plant-${kind}`;
  const W = 20;
  const H = 16;
  if (!scene.textures.exists(key)) {
    const p = new Pix(W, H);
    const rand = mulberry32(kind * 53 + 9);
    const greens = kind % 2 === 0 ? LEAVES[0] : LEAVES[2];
    const base = { x: 10, y: H - 2 };
    if (kind < 3) {
      // A fern: long leaves fanning out from the root, each lit along its top edge.
      const count = 5 + (kind % 2);
      for (let i = 0; i < count; i++) {
        const a = Math.PI * (1.08 + (0.84 * i) / (count - 1));
        const len = 7 + rand() * 3;
        for (let t = 0; t < len; t++) {
          const droop = (t / len) ** 2 * 3;
          const x = Math.round(base.x + Math.cos(a) * t);
          const y = Math.round(base.y + Math.sin(a) * t * 0.8 + droop);
          p.px(x, y, t > len - 2 ? greens.light : greens.mid);
          p.px(x, y - 1, t % 2 === 0 ? greens.high : greens.light);
          if (t > 2 && t % 2 === 1) p.px(x + (Math.cos(a) > 0 ? 1 : -1), y + 1, greens.dark);
        }
      }
    } else if (kind < 5) {
      // Tall grass: thin blades of different heights, lit tips.
      for (let i = 0; i < 9; i++) {
        const x = 4 + Math.floor(rand() * 12);
        const h = 5 + Math.floor(rand() * 7);
        const lean = rand() < 0.5 ? -1 : 1;
        for (let t = 0; t < h; t++) p.px(x + (t > h * 0.6 ? lean : 0), base.y - t, t > h - 3 ? greens.high : t > h / 2 ? greens.light : greens.mid);
      }
    } else if (kind < 7) {
      // A clump of flowers on stems among leaves.
      const petals = kind === 5 ? [0xf2c94c, 0xfff3bf] : [0xe64980, 0xffdeeb];
      for (let i = 0; i < 5; i++) {
        const x = 4 + Math.floor(rand() * 12);
        const h = 4 + Math.floor(rand() * 5);
        p.rect(x, base.y - h, 1, h, greens.mid);
        p.px(x - 1, base.y - Math.floor(h / 2), greens.light);
        const fy = base.y - h - 1;
        p.px(x - 1, fy, petals[0]);
        p.px(x + 1, fy, petals[0]);
        p.px(x, fy - 1, petals[0]);
        p.px(x, fy + 1, petals[0]);
        p.px(x, fy, petals[1]);
      }
    } else {
      // A broad-leaved weed: a rosette of round leaves.
      for (const [dx, dy, r] of [[-4, -2, 3], [4, -2, 3], [0, -4, 3.2], [-2, 0, 2.6], [2, 0, 2.6]] as const) {
        p.ellipse(base.x + dx, base.y - 2 + dy, r, r * 0.7, (nx, ny) => (lit(nx, ny) > 0.3 ? greens.light : lit(nx, ny) > -0.3 ? greens.mid : greens.dark));
      }
    }
    p.outline(greens.line);
    p.texture(scene, key);
  }
  return { key, originX: 0.5, originY: (H - 1) / H };
}

/** Burlap sacks leaning together, tied at the neck. */
export function sackSprite(scene: Phaser.Scene): SpriteInfo {
  const key = "spr-sack";
  const W = 18;
  const H = 16;
  if (!scene.textures.exists(key)) {
    const p = new Pix(W, H);
    for (const [cx, cy, r] of [[6, 10, 5], [12, 11, 4.5]] as const) {
      p.ellipse(cx, cy, r, r * 0.95, (nx, ny) => (lit(nx, ny) > 0.35 ? 0xe0c48a : lit(nx, ny) > -0.25 ? 0xc4a46a : 0x977846));
      p.rect(cx - 1, cy - r - 2, 3, 3, 0xb08f58);
      p.rect(cx - 2, cy - r + 1, 5, 1, 0x6b4a24);
    }
    p.outline(OUTLINE);
    p.texture(scene, key);
  }
  return { key, originX: 0.5, originY: (H - 1) / H };
}

// ---- The palace (İç Kale) ----------------------------------------------------------------

// Gothic: weathered grey-brown stone like the town's, dark slate spires, bronze finials.
const PALACE_STONE = { high: 0xcac2b2, light: 0xb0a796, mid: 0x958c7c, dark: 0x766e61, deep: 0x575148, joint: 0x655e54 };
const BLUE_ROOF = { high: 0x8a95a6, light: 0x667184, mid: 0x4b5466, dark: 0x363d4b, deep: 0x262b35, line: 0x14171d };
const GOLD = { light: 0xe8cc8a, mid: 0xb8924a, dark: 0x7a5c2a };

export interface PalaceSprite extends SpriteInfo {
  /** Image pixels from the top-left: lantern flames, flag poles, window panes. */
  lanterns: { x: number; y: number }[];
  flags: { x: number; y: number; big: boolean }[];
  windows: { x: number; y: number; w: number; h: number }[];
  pad: number;
  height: number;
}

/** A stone colour for a point on a cylinder (nx -1 left .. 1 right), lit from the left. */
function roundStone(nx: number): number {
  const t = -nx * 0.65 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 0.45;
  return t > 0.55 ? PALACE_STONE.high : t > 0.25 ? PALACE_STONE.light : t > -0.05 ? PALACE_STONE.mid : t > -0.35 ? PALACE_STONE.dark : PALACE_STONE.deep;
}

/** A pointed blue cone roof over a round tower, shaded round, in rows of shingles, gold finial. */
function cone(p: Pix, cx: number, baseY: number, half: number, height: number) {
  for (let y = 0; y < height; y++) {
    const t = (y + 1) / height;
    const hw = half * t;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const nx = (x + 0.5 - cx) / Math.max(1, hw);
      if (Math.abs(nx) > 1) continue;
      const l = -nx * 0.7 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 0.35;
      let c = l > 0.5 ? BLUE_ROOF.high : l > 0.2 ? BLUE_ROOF.light : l > -0.15 ? BLUE_ROOF.mid : l > -0.45 ? BLUE_ROOF.dark : BLUE_ROOF.deep;
      // Shingle courses: a dark line every few rows, and joints across each course.
      const row = Math.floor((height - y) / 3);
      if ((height - y) % 3 === 0) c = tone(c, -0.22);
      else if (Math.round((nx + 1) * 6 + row * 0.5) % 2 === 0 && (height - y) % 3 === 1) c = tone(c, -0.1);
      p.px(x, baseY - height + y, c);
    }
  }
  // Eaves flaring out a little, then the gold finial.
  p.rect(Math.round(cx - half - 1), baseY - 1, Math.round(half * 2 + 3), 2, BLUE_ROOF.deep);
  p.rect(Math.round(cx - half - 1), baseY - 1, Math.round(half * 2 + 3), 1, BLUE_ROOF.dark);
  p.rect(Math.round(cx), baseY - height - 5, 1, 5, GOLD.dark);
  p.disc(Math.round(cx) + 0.5, baseY - height - 6, 1.5, GOLD.light);
  return { x: Math.round(cx), y: baseY - height - 7 };
}

/**
 * A round tower: a stone drum shaded like a cylinder, courses of stone, arrow-slit windows,
 * a crenellated parapet, and a pointed blue roof. Returns the finial's top (for a flag).
 */
function roundTower(p: Pix, cx: number, bottom: number, w: number, h: number, coneH: number, windows: PalaceSprite["windows"], slits = true) {
  const top = bottom - h;
  const half = w / 2;
  for (let y = top; y < bottom; y++) {
    const course = Math.floor((bottom - y) / 5);
    for (let x = Math.floor(cx - half); x < Math.ceil(cx + half); x++) {
      const nx = (x + 0.5 - cx) / half;
      let c = roundStone(nx);
      // Joints: between courses, and across each course (closer together towards the sides).
      if ((bottom - y) % 5 === 0) c = tone(c, -0.18);
      else if (Math.round(Math.asin(Math.max(-1, Math.min(1, nx))) * 4 + course * 0.5) !== Math.round(Math.asin(Math.max(-1, Math.min(1, (x + 1.5 - cx) / half))) * 4 + course * 0.5)) c = tone(c, -0.12);
      p.px(x, y, c);
    }
  }
  // A plinth at the foot.
  p.rect(Math.round(cx - half - 1), bottom - 3, Math.round(w + 2), 3, PALACE_STONE.dark);
  p.rect(Math.round(cx - half - 1), bottom - 3, Math.round(w + 2), 1, PALACE_STONE.light);
  // Arrow slits up the middle, lit at night.
  if (slits) {
    for (let wy = top + 10; wy < bottom - 14; wy += 18) {
      p.rect(Math.round(cx) - 2, wy - 1, 5, 10, PALACE_STONE.deep);
      p.rect(Math.round(cx) - 1, wy, 3, 8, 0x1c2638);
      p.px(Math.round(cx) - 1, wy, PALACE_STONE.light);
      windows.push({ x: Math.round(cx) - 1, y: wy + 1, w: 3, h: 7 });
    }
  }
  // Parapet: a corbelled band wider than the drum, merlons round its front.
  p.rect(Math.round(cx - half - 2), top - 4, Math.round(w + 4), 5, PALACE_STONE.mid);
  for (let x = Math.round(cx - half - 2); x < Math.round(cx + half + 2); x++) p.px(x, top - 4, roundStone(((x + 0.5 - cx) / (half + 2)) * 0.9));
  p.rect(Math.round(cx - half - 1), top + 1, Math.round(w + 2), 1, PALACE_STONE.deep);
  for (let x = Math.round(cx - half - 2); x < Math.round(cx + half + 1); x += 5) {
    const nx = (x + 1.5 - cx) / (half + 2);
    p.rect(x, top - 9, 3, 5, roundStone(nx));
    p.px(x, top - 9, PALACE_STONE.high);
  }
  return cone(p, cx, top - 6, half + 1, Math.round(coneH * 1.35));
}

/** A straight stretch of stone wall with a crenellated top (front face, lit evenly). */
function stoneWall(p: Pix, x0: number, x1: number, bottom: number, h: number, rand: () => number) {
  const top = bottom - h;
  for (let y = top, row = 0; y < bottom; y += 6, row++) {
    for (let x = x0 - (row % 2) * 5; x < x1; x += 10) {
      const a = Math.max(x0, x);
      const b = Math.min(x1, x + 10);
      const r = rand();
      const c = r < 0.3 ? PALACE_STONE.light : r < 0.85 ? PALACE_STONE.mid : PALACE_STONE.dark;
      p.rect(a, y, b - a, Math.min(6, bottom - y), c);
      p.rect(a, y, b - a, 1, tone(c, 0.15));
      p.rect(b - 1, y, 1, Math.min(6, bottom - y), PALACE_STONE.joint);
    }
    p.rect(x0, Math.min(bottom - 1, y + 5), x1 - x0, 1, PALACE_STONE.joint);
  }
  p.rect(x0 - 1, top - 3, x1 - x0 + 2, 3, PALACE_STONE.light);
  p.rect(x0 - 1, top - 1, x1 - x0 + 2, 1, PALACE_STONE.dark);
  for (let x = x0; x < x1 - 2; x += 6) {
    p.rect(x, top - 8, 4, 5, PALACE_STONE.mid);
    p.rect(x, top - 8, 4, 1, PALACE_STONE.high);
    p.rect(x + 3, top - 7, 1, 4, PALACE_STONE.dark);
  }
}

/** A pointed (lancet) window in a stone surround, with a mullion; returns its pane. */
function archWindow(p: Pix, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const peak = Math.ceil(w / 2) + 1;
  for (let i = 0; i <= peak; i++) {
    const hw = ((i + 1) / (peak + 1)) * (w / 2 + 1);
    p.rect(Math.round(cx - hw), y - 1 + i, Math.max(1, Math.round(hw * 2)), 1, PALACE_STONE.light);
  }
  p.rect(x - 1, y + peak, w + 2, h - peak + 1, PALACE_STONE.light);
  for (let i = 0; i < peak; i++) {
    const hw = ((i + 1) / (peak + 1)) * (w / 2);
    p.rect(Math.round(cx - hw), y + i + 1, Math.max(1, Math.round(hw * 2)), 1, 0x1c2230);
  }
  p.rect(x, y + peak, w, h - peak, 0x1c2230);
  if (w >= 6) p.rect(Math.round(cx), y + 2, 1, h - 2, PALACE_STONE.dark);
  p.px(x + 1, y + peak + 1, 0x8fa6b8);
  p.rect(x - 1, y + h, w + 2, 1, PALACE_STONE.dark);
  return { x, y: y + peak, w, h: h - peak };
}

/** A buttress against a wall: a stone pier stepping back as it rises. */
function buttress(p: Pix, x: number, bottom: number, h: number) {
  const steps = [[0, 6], [Math.round(h * 0.4), 5], [Math.round(h * 0.75), 4]] as const;
  for (const [rise, w] of steps) {
    const top = bottom - h + rise;
    const segH = h - rise;
    p.rect(x - Math.floor(w / 2), top, w, segH, PALACE_STONE.mid);
    p.rect(x - Math.floor(w / 2), top, 1, segH, PALACE_STONE.light);
    p.rect(x + Math.ceil(w / 2) - 1, top, 1, segH, PALACE_STONE.deep);
    p.rect(x - Math.floor(w / 2), top, w, 1, PALACE_STONE.high);
  }
}

/** A rose window: a round traceried window with spokes; returns its pane. */
function roseWindow(p: Pix, cx: number, cy: number, r: number) {
  p.disc(cx, cy, r + 1.5, PALACE_STONE.light);
  p.ellipse(cx, cy, r, r, (nx, ny) => {
    const a = Math.atan2(ny, nx);
    const spoke = Math.abs(Math.sin(a * 4)) < 0.22;
    const ring = Math.abs(Math.hypot(nx, ny) - 0.45) < 0.13;
    return spoke || ring ? PALACE_STONE.dark : 0x1c2230;
  });
  p.px(Math.round(cx - r / 2), Math.round(cy - r / 2), 0x8fa6b8);
  return { x: Math.round(cx - r * 0.7), y: Math.round(cy - r * 0.7), w: Math.round(r * 1.4), h: Math.round(r * 1.4) };
}

/**
 * The palace: a fairy-tale castle rising in tiers. At the back a tall round donjon and two
 * towers beside it; in the middle the keep with a steep blue roof and corner turrets; in front
 * a crenellated wall with the gate between two round gate towers, and big round towers at the
 * corners. Every tower has a pointed blue roof with a flag; lanterns by the gate, banners on
 * the wall, windows lit at night.
 */
export function palaceSprite(scene: Phaser.Scene, w: number, h: number, banner: number): PalaceSprite {
  const W = w * TILE_SIZE;
  const PAD = 10;
  const CW = W + PAD * 2;
  const CH = h * TILE_SIZE + 200;
  const key = `spr-palace3-${w}x${h}-${banner}`;
  const lanterns: PalaceSprite["lanterns"] = [];
  const flags: PalaceSprite["flags"] = [];
  const windows: PalaceSprite["windows"] = [];
  const result = (): PalaceSprite => ({ key, originX: 0, originY: 1, lanterns, flags, windows, pad: PAD, height: CH });
  // Painted once; later scenes (and every editor rebuild) reuse the texture and its points.
  const cached = palaces.get(key);
  if (cached && scene.textures.exists(key)) return cached;
  const rand = mulberry32(2718);
  const p = new Pix(CW, CH);
  const L = PAD;
  const R = PAD + W;
  const mid = Math.round(CW / 2);

  // ---- Back tier: the donjon and the towers beside it ----
  for (const dx of [-50, 50]) flags.push({ ...roundTower(p, mid + dx, CH - 60, 26, 92, 40, windows), big: false });
  flags.push({ ...roundTower(p, mid, CH - 62, 38, 124, 60, windows), big: true });

  // ---- Middle tier: the keep, a steep blue roof, turrets on its corners ----
  const keepL = mid - 62;
  const keepR = mid + 62;
  const keepBottom = CH - 30;
  const keepTop = CH - 96;
  // The roof first (its foot is hidden behind the keep's parapet).
  for (let y = keepTop - 38, row = 0; y < keepTop + 2; y += 3, row++) {
    const inset = Math.max(0, Math.round((keepTop - y) * 0.7));
    shingleRow(p, keepL + 4 + inset, keepR - 4 - inset, y, 3, row, { light: BLUE_ROOF.light, mid: BLUE_ROOF.mid, dark: BLUE_ROOF.dark }, rand, 5);
  }
  p.rect(keepL + 30, keepTop - 39, keepR - keepL - 60, 2, GOLD.dark);
  stoneWall(p, keepL, keepR, keepBottom, keepBottom - keepTop, rand);
  for (const dx of [-44, -22, 22, 44]) {
    windows.push(archWindow(p, mid + dx - 3, keepTop + 9, 6, 15));
    windows.push(archWindow(p, mid + dx - 3, keepTop + 33, 6, 15));
  }
  for (const dx of [-55, -33, -11, 11, 33, 55]) buttress(p, mid + dx, keepBottom, keepBottom - keepTop - 6);
  windows.push(roseWindow(p, mid, keepTop + 17, 8));
  for (const cx of [keepL, keepR]) flags.push({ ...roundTower(p, cx, keepTop + 26, 16, 30, 24, windows, false), big: false });

  // ---- Front tier: the curtain wall with the gate, gate towers, corner towers ----
  stoneWall(p, L + 16, R - 16, CH, 34, rand);
  // Banners hanging on the wall.
  for (const bx of [mid - 62, mid + 54]) {
    p.rect(bx - 1, CH - 32, 10, 2, GOLD.dark);
    p.rect(bx, CH - 30, 8, 22, banner);
    p.rect(bx, CH - 30, 2, 22, tone(banner, 0.2));
    p.rect(bx + 6, CH - 30, 2, 22, tone(banner, -0.3));
    p.rect(bx + 2, CH - 24, 4, 4, GOLD.mid);
    p.px(bx + 3, CH - 23, GOLD.light);
    for (let i = 0; i < 4; i++) {
      p.px(bx + i, CH - 8 + i, banner);
      p.px(bx + 7 - i, CH - 8 + i, tone(banner, -0.3));
    }
  }
  // The gate: a deep stone arch, oak doors with iron bands, the portcullis raised above.
  p.rect(mid - 14, CH - 30, 28, 30, PALACE_STONE.light);
  p.ellipse(mid, CH - 30, 14, 9, () => PALACE_STONE.light);
  for (let a = 0; a <= 8; a++) {
    const ang = Math.PI + (a / 8) * Math.PI;
    p.px(Math.round(mid + Math.cos(ang) * 13), Math.round(CH - 30 + Math.sin(ang) * 8.5), PALACE_STONE.joint);
  }
  p.rect(mid - 2, CH - 41, 4, 4, PALACE_STONE.high);
  p.ellipse(mid, CH - 29, 10.5, 7, () => 0x2a1810);
  p.rect(mid - 10, CH - 29, 21, 29, 0x2a1810);
  for (let x = mid - 10; x <= mid + 10; x += 3) p.rect(x, CH - 34, 1, 5, 0x3a3a42);
  p.rect(mid - 10, CH - 30, 21, 1, 0x3a3a42);
  p.rect(mid - 9, CH - 26, 19, 26, 0x7a4a2a);
  for (let x = mid - 9; x < mid + 10; x += 3) p.rect(x, CH - 26, 1, 26, 0x5a341c);
  p.rect(mid, CH - 26, 1, 26, 0x2a160c);
  for (const y of [CH - 20, CH - 8]) p.rect(mid - 9, y, 19, 2, 0x3a3a42);
  for (const x of [mid - 3, mid + 3]) p.disc(x + 0.5, CH - 13.5, 1.2, GOLD.mid);
  p.rect(mid - 16, CH - 3, 32, 3, PALACE_STONE.light);
  p.rect(mid - 16, CH - 1, 32, 1, PALACE_STONE.dark);
  // Gate towers either side of the arch, and the big towers on the corners.
  for (const dx of [-25, 25]) flags.push({ ...roundTower(p, mid + dx, CH, 22, 64, 30, windows), big: false });
  for (const cx of [L + 17, R - 17]) flags.push({ ...roundTower(p, cx, CH, 34, 92, 46, windows), big: false });
  // Lanterns on the gate towers, by the door.
  for (const lx of [mid - 17, mid + 16]) {
    p.rect(lx - 1, CH - 26, 4, 1, 0x2a2a30);
    p.rect(lx - 2, CH - 24, 5, 7, 0x2a2a30);
    p.rect(lx - 1, CH - 23, 3, 5, 0x6e6650);
    p.rect(lx - 1, CH - 17, 3, 1, 0x2a2a30);
    lanterns.push({ x: lx, y: CH - 21 });
  }

  p.outline(BLUE_ROOF.line);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  p.texture(scene, key);
  palaces.set(key, result());
  return palaces.get(key)!;
}

const palaces = new Map<string, PalaceSprite>();

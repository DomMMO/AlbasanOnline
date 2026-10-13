// A tiny pixel painter for the sprites drawn in code (buildings, trees, props): plain pixels on
// a canvas, no anti-aliasing, with helpers for shaded discs and a dark outline round whatever
// was painted, the way hand-made pixel art is drawn.

export type Rgb = number;

/** `color` moved towards white (amount > 0) or black (amount < 0), amount in -1..1. */
export function tone(color: Rgb, amount: number): Rgb {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const t = amount > 0 ? 255 : 0;
  const k = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (t - c) * k);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

/** A colour cast warmer/cooler: shadows lean blue, lights lean yellow (as painted pixel art does). */
export function shade(color: Rgb, amount: number): Rgb {
  const base = tone(color, amount);
  const r = (base >> 16) & 255;
  const g = (base >> 8) & 255;
  const b = base & 255;
  const warm = amount > 0 ? amount * 18 : amount * 10;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (clamp(r + warm) << 16) | (clamp(g + warm * 0.5) << 8) | clamp(b - warm);
}

const css = (c: Rgb) => `#${c.toString(16).padStart(6, "0")}`;

export class Pix {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext("2d")!;
  }

  px(x: number, y: number, c: Rgb, alpha = 1) {
    this.rect(x, y, 1, 1, c, alpha);
  }

  rect(x: number, y: number, w: number, h: number, c: Rgb, alpha = 1) {
    if (w <= 0 || h <= 0) return;
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = css(c);
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    this.ctx.globalAlpha = 1;
  }

  clear(x: number, y: number, w: number, h: number) {
    this.ctx.clearRect(x, y, w, h);
  }

  /** Every pixel of an ellipse (centre and radii in pixels), coloured by `color(dx, dy)` in -1..1. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: (nx: number, ny: number, x: number, y: number) => Rgb | null) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const c = color(nx, ny, x, y);
        if (c !== null) this.px(x, y, c);
      }
    }
  }

  disc(cx: number, cy: number, r: number, c: Rgb) {
    this.ellipse(cx, cy, r, r, () => c);
  }

  /** A 1px outline in `c` round everything painted so far (on transparent pixels next to it). */
  outline(c: Rgb, diagonal = false) {
    const data = this.ctx.getImageData(0, 0, this.w, this.h);
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < this.w && y < this.h && data.data[(y * this.w + x) * 4 + 3] > 40;
    const edge: [number, number][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) continue;
        const near = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1) || (diagonal && (solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1)));
        if (near) edge.push([x, y]);
      }
    }
    for (const [x, y] of edge) this.px(x, y, c);
  }

  /** Adds the canvas as a texture (once). */
  texture(scene: Phaser.Scene, key: string) {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, this.canvas);
    return key;
  }
}

/** A small deterministic hash of integers to 0..1 (for picking variants by position). */
export function hash01(...values: number[]): number {
  let h = 2166136261;
  for (const v of values) {
    h ^= v | 0;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

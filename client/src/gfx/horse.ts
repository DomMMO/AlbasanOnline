import Phaser from "phaser";

// The riding horse, drawn in code like the rest of the pixel art: a brown horse with a dark
// mane, a blue blanket and a red saddle. Frames (39x30, feet at the bottom centre):
// side (facing right) 0 idle + 1-4 walk, front 5-7, back 8-10 (idle + two walk frames).

export const HORSE_KEY = "horse";
/** The templates below are laid out on a 26x20 grid and drawn this much bigger. */
const SCALE = 1.5;
export const HORSE_W = Math.round(26 * SCALE);
export const HORSE_H = Math.round(20 * SCALE);
/** How far above the horse's feet the rider's feet sit (on the saddle). */
export const HORSE_RIDER_LIFT = 14;
export const HorseFrame = { Side: 0, Down: 5, Up: 8 } as const;

const C = {
  k: "#1a1420",
  hide: "#8b5a2b",
  dark: "#6b4423",
  light: "#a87040",
  mane: "#2a1a10",
  hoof: "#2a2a2a",
  blaze: "#f0e6d0",
  blanket: "#3b5f8a",
  saddle: "#9c2a2a",
  gold: "#e8c33a",
};

type Paint = (x: number, y: number, w: number, h: number, color: string) => void;

/** One leg: outline, leg, hoof. `lift` raises the hoof off the ground mid-stride. */
function leg(rect: Paint, x: number, lift: number, color = C.dark) {
  rect(x - 1, 12, 4, 7 - lift, C.k);
  rect(x, 12, 2, 6 - lift, color);
  rect(x, 17 - lift, 2, 1, C.hoof);
}

/** Side view facing right. phase -1 = standing; 0-3 = walk cycle. */
function side(rect: Paint, phase: number) {
  const swing = phase < 0 ? [0, 0, 0, 0] : [[1, -1, -1, 1], [0, 0, 0, 0], [-1, 1, 1, -1], [0, 0, 0, 0]][phase];
  const lift = phase < 0 ? [0, 0, 0, 0] : [[1, 0, 0, 1], [0, 1, 1, 0], [0, 1, 1, 0], [1, 0, 0, 1]][phase];
  // Far legs first (darker), then the body over their tops, then the near legs.
  leg(rect, 7 + swing[1], lift[1], C.mane);
  leg(rect, 17 + swing[3], lift[3], C.mane);
  // Tail.
  rect(1, 7, 3, 8, C.k);
  rect(2, 8, 2, 6, C.mane);
  // Body.
  rect(3, 6, 16, 8, C.k);
  rect(4, 7, 14, 6, C.hide);
  rect(5, 7, 10, 1, C.light);
  rect(4, 12, 14, 1, C.dark);
  // Neck and head.
  rect(15, 2, 6, 9, C.k);
  rect(16, 3, 4, 8, C.hide);
  rect(18, 1, 7, 6, C.k);
  rect(19, 2, 5, 4, C.hide);
  rect(23, 4, 2, 2, C.dark);
  rect(20, 3, 1, 1, C.k);
  rect(18, 0, 2, 2, C.k);
  rect(19, 0, 1, 1, C.hide);
  // Mane down the neck.
  rect(15, 2, 2, 7, C.mane);
  rect(18, 1, 2, 1, C.mane);
  // Blanket and saddle.
  rect(8, 6, 7, 4, C.blanket);
  rect(8, 9, 7, 1, C.gold);
  rect(9, 5, 5, 2, C.saddle);
  rect(10, 5, 2, 1, C.gold);
  leg(rect, 5 + swing[0], lift[0]);
  leg(rect, 15 + swing[2], lift[2]);
}

/** Seen from the front: the head low over the chest (it hides the rider's legs). */
function front(rect: Paint, phase: number) {
  const lifts = phase < 0 ? [0, 0] : phase === 0 ? [1, 0] : [0, 1];
  leg(rect, 9, lifts[0]);
  leg(rect, 15, lifts[1]);
  rect(7, 8, 12, 6, C.k);
  rect(8, 9, 10, 4, C.hide);
  rect(6, 8, 3, 4, C.blanket);
  rect(17, 8, 3, 4, C.blanket);
  rect(10, 3, 6, 11, C.k);
  rect(11, 4, 4, 9, C.hide);
  rect(12, 5, 2, 6, C.blaze);
  rect(11, 12, 4, 1, C.dark);
  rect(11, 6, 1, 1, C.k);
  rect(14, 6, 1, 1, C.k);
  rect(10, 2, 2, 2, C.k);
  rect(14, 2, 2, 2, C.k);
  rect(12, 3, 2, 1, C.mane);
}

/** Seen from behind: rump, tail and the ears showing past the rider. */
function back(rect: Paint, phase: number) {
  const lifts = phase < 0 ? [0, 0] : phase === 0 ? [1, 0] : [0, 1];
  rect(10, 0, 2, 3, C.k);
  rect(14, 0, 2, 3, C.k);
  rect(10, 2, 6, 5, C.k);
  rect(11, 2, 4, 4, C.mane);
  leg(rect, 9, lifts[0]);
  leg(rect, 15, lifts[1]);
  rect(7, 5, 12, 9, C.k);
  rect(8, 6, 10, 7, C.hide);
  rect(8, 12, 10, 1, C.dark);
  rect(7, 6, 12, 3, C.blanket);
  rect(9, 5, 8, 2, C.saddle);
  rect(12, 8, 2, 9, C.k);
  rect(12, 9, 2, 7, C.mane);
}

/** Builds the horse texture and its animations once per game. */
export function ensureHorse(scene: Phaser.Scene) {
  if (scene.textures.exists(HORSE_KEY)) return;
  const draws: ((rect: Paint) => void)[] = [
    (r) => side(r, -1),
    (r) => side(r, 0),
    (r) => side(r, 1),
    (r) => side(r, 2),
    (r) => side(r, 3),
    (r) => front(r, -1),
    (r) => front(r, 0),
    (r) => front(r, 1),
    (r) => back(r, -1),
    (r) => back(r, 0),
    (r) => back(r, 1),
  ];
  const texture = scene.textures.createCanvas(HORSE_KEY, HORSE_W * draws.length, HORSE_H)!;
  const ctx = texture.context;
  draws.forEach((draw, frame) => {
    const ox = frame * HORSE_W;
    draw((x, y, w, h, color) => {
      // Grid rectangles scaled up and snapped to whole pixels.
      const x0 = Math.round(x * SCALE);
      const y0 = Math.round((y + 1) * SCALE) - (HORSE_H - Math.round(20 * SCALE));
      ctx.fillStyle = color;
      ctx.fillRect(ox + x0, y0, Math.round((x + w) * SCALE) - x0, Math.round((y + 1 + h) * SCALE) - Math.round((y + 1) * SCALE));
    });
    texture.add(frame, 0, ox, 0, HORSE_W, HORSE_H);
  });
  texture.refresh();
  const anim = (key: string, frames: number[], rate: number) => {
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames: frames.map((frame) => ({ key: HORSE_KEY, frame })), frameRate: rate, repeat: -1 });
  };
  anim("horse-side", [1, 2, 3, 4], 10);
  anim("horse-down", [6, 7], 7);
  anim("horse-up", [9, 10], 7);
}

/** A small horse picture for the HUD button (side view, standing). */
export function horseIconUrl(scale = 2): string {
  const canvas = document.createElement("canvas");
  canvas.width = 26 * scale;
  canvas.height = 20 * scale;
  const ctx = canvas.getContext("2d")!;
  side((x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * scale, (y + 1) * scale, w * scale, h * scale);
  }, -1);
  return canvas.toDataURL();
}

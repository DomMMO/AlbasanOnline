import Phaser from "phaser";
import { DEFAULT_HORSE, encodeHorseLook, HORSE_BREEDS, type HorseLook } from "../../../shared/src";
import { Pix, shade, tone } from "./pixelArt";

// The riding horse (and the farm's horses), painted pixel by pixel like the rest of the pixel
// art: a shaded coat lit from the top left, mane and tail in strands, jointed legs and hooves,
// blanket and saddle. Its colours come from the breed (or a restyle at the stable,
// data/horses.ts); each look gets its own texture and animations. Frames (39x30, feet at the
// bottom centre): side (facing right) 0 idle + 1-4 walk, front 5-7, back 8-10 (idle + two walk).
/** Frames are painted pixel by pixel at their real size (39x30, feet at the bottom centre). */
export const HORSE_W = 39;
export const HORSE_H = 30;
/** How far above the horse's feet the rider's feet sit (on the saddle). */
export const HORSE_RIDER_LIFT = 14;
export const HorseFrame = { Side: 0, Down: 5, Up: 8 } as const;

const OUTLINE = 0x1a1420;
const HOOF = 0x2a2420;
const BLAZE = 0xf0e6d0;

interface Colours {
  coat: { high: number; light: number; mid: number; dark: number };
  mane: { light: number; mid: number; dark: number };
  blanket: number;
  saddle: number;
}

function colours(look: HorseLook): Colours {
  return {
    coat: { high: shade(look.coat, 0.32), light: shade(look.coat, 0.15), mid: look.coat, dark: shade(look.coat, -0.3) },
    mane: { light: shade(look.mane, 0.2), mid: look.mane, dark: shade(look.mane, -0.35) },
    blanket: look.blanket,
    saddle: look.saddle,
  };
}

const defaultLook = () => HORSE_BREEDS[DEFAULT_HORSE].look;

/** A dome of coat, shaded by which way it faces the light (top left). */
function coatDome(p: Pix, c: Colours["coat"], cx: number, cy: number, rx: number, ry: number, dim = 0) {
  p.ellipse(cx, cy, rx, ry, (nx, ny) => {
    const t = -(nx * -0.5 + ny * -0.85) - dim;
    return t > 0.65 ? c.high : t > 0.15 ? c.light : t > -0.45 ? c.mid : c.dark;
  });
}

/** A leg from the body down to its hoof; `lift` raises the hoof, `bend` swings it. */
function legSide(p: Pix, c: Colours["coat"], x: number, top: number, lift: number, bend: number, far: boolean) {
  const shadeC = far ? c.dark : c.mid;
  const litC = far ? c.mid : c.light;
  const ground = 28 - lift;
  for (let y = top; y < ground; y++) {
    const t = (y - top) / (ground - top);
    const lx = Math.round(x + bend * t);
    const w = t < 0.45 ? 4 : 3;
    p.rect(lx, y, w, 1, shadeC);
    p.px(lx, y, litC);
  }
  const hx = Math.round(x + bend);
  p.rect(hx - 1 + (bend > 0 ? 1 : 0), ground, 4, 2, HOOF);
  p.rect(hx, ground - 3, 3, 1, far ? c.dark : c.high);
}

/** Side view facing right. phase -1 = standing; 0-3 = walk cycle. */
function paintSide(p: Pix, c: Colours, phase: number) {
  const swing = phase < 0 ? [0, 0, 0, 0] : [[2, -2, -2, 2], [0, 0, 0, 0], [-2, 2, 2, -2], [0, 0, 0, 0]][phase];
  const lift = phase < 0 ? [0, 0, 0, 0] : [[1, 0, 0, 1], [0, 1, 1, 0], [0, 1, 1, 0], [1, 0, 0, 1]][phase];
  const bob = phase === 1 || phase === 3 ? 1 : 0;
  // Far legs, behind the body.
  legSide(p, c.coat, 11, 18 + bob, lift[1], swing[1], true);
  legSide(p, c.coat, 24, 18 + bob, lift[3], swing[3], true);
  // Tail, flowing down from the rump.
  for (let i = 0; i < 12; i++) {
    const x = Math.round(6 - i * 0.35 + Math.sin(i * 0.6 + (phase < 0 ? 0 : phase)) * 0.8);
    const y = 11 + bob + i;
    p.rect(x - 1, y, 3, 1, i % 3 === 0 ? c.mane.light : c.mane.mid);
    p.px(x + 1, y, c.mane.dark);
  }
  // Body: barrel, rump and chest.
  coatDome(p, c.coat, 17, 15 + bob, 11.5, 6.5);
  coatDome(p, c.coat, 9, 14 + bob, 5.5, 5.5);
  coatDome(p, c.coat, 25, 14 + bob, 5, 5.5);
  p.rect(9, 19 + bob, 16, 1, c.coat.dark);
  // Neck rising to the head.
  for (let i = 0; i <= 8; i++) coatDome(p, c.coat, 25 + i * 0.75, 13 + bob - i * 0.8, 4 - i * 0.05, 3.8);
  // Head: skull, cheek, muzzle, ear, eye, nostril.
  coatDome(p, c.coat, 32.5, 6 + bob, 4.4, 3.2);
  coatDome(p, c.coat, 35.6, 8 + bob, 2.6, 2.3, 0.2);
  p.px(37, 7 + bob, OUTLINE);
  p.rect(35, 10 + bob, 3, 1, c.coat.dark);
  p.rect(29, 1 + bob, 2, 3, c.coat.mid);
  p.px(29, 1 + bob, c.coat.high);
  p.px(33, 5 + bob, OUTLINE);
  p.px(32, 5 + bob, 0xffffff);
  // Mane down the neck, in strands.
  for (let i = 0; i <= 9; i++) {
    const x = Math.round(23.5 + i * 0.72);
    const y = Math.round(10 + bob - i * 0.8);
    p.rect(x - 1, y, 2, 3, i % 2 ? c.mane.mid : c.mane.light);
    p.px(x - 2, y + 2, c.mane.dark);
  }
  p.rect(28, 3 + bob, 3, 2, c.mane.mid);
  // Blanket and saddle.
  p.rect(13, 10 + bob, 10, 6, c.blanket);
  p.rect(13, 10 + bob, 10, 1, tone(c.blanket, 0.25));
  p.rect(13, 15 + bob, 10, 1, GOLD_TRIM);
  p.rect(14, 8 + bob, 7, 3, c.saddle);
  p.rect(14, 8 + bob, 7, 1, tone(c.saddle, 0.3));
  p.rect(20, 7 + bob, 2, 2, c.saddle);
  p.rect(17, 11 + bob, 1, 6, 0x3a2a1a);
  p.rect(16, 17 + bob, 3, 1, 0x9a9aa8);
  // Near legs, in front of the body.
  legSide(p, c.coat, 8, 17 + bob, lift[0], swing[0], false);
  legSide(p, c.coat, 22, 17 + bob, lift[2], swing[2], false);
}

const GOLD_TRIM = 0xe8c33a;

/** Seen from the front: the long head over the chest (it hides the rider's legs). */
function paintFront(p: Pix, c: Colours, phase: number) {
  const lifts = phase < 0 ? [0, 0] : phase === 0 ? [1, 0] : [0, 1];
  const cx = 19.5;
  for (const [x, lift] of [[14, lifts[0]], [22, lifts[1]]] as const) {
    p.rect(x, 19, 3, 9 - lift, c.coat.mid);
    p.rect(x, 19, 1, 9 - lift, c.coat.light);
    p.rect(x - 1, 27 - lift, 5, 2, HOOF);
  }
  coatDome(p, c.coat, cx, 17, 9, 6);
  p.rect(cx - 12, 13, 4, 6, c.blanket);
  p.rect(cx + 8, 13, 4, 6, tone(c.blanket, -0.2));
  p.rect(cx - 12, 18, 4, 1, GOLD_TRIM);
  p.rect(cx + 8, 18, 4, 1, GOLD_TRIM);
  // Head, long and narrow, with a white blaze; ears and forelock on top.
  coatDome(p, c.coat, cx, 10, 4, 7.5);
  p.rect(Math.round(cx) - 1, 6, 2, 9, BLAZE);
  coatDome(p, c.coat, cx, 16, 3, 2.2, 0.25);
  p.px(Math.round(cx) - 2, 16, OUTLINE);
  p.px(Math.round(cx) + 1, 16, OUTLINE);
  p.px(Math.round(cx) - 4, 8, OUTLINE);
  p.px(Math.round(cx) + 3, 8, OUTLINE);
  p.rect(Math.round(cx) - 5, 1, 2, 4, c.coat.mid);
  p.rect(Math.round(cx) + 3, 1, 2, 4, c.coat.dark);
  p.rect(Math.round(cx) - 2, 3, 4, 3, c.mane.mid);
  p.px(Math.round(cx) - 1, 3, c.mane.light);
}

/** Seen from behind: rump, tail and the ears showing past the rider. */
function paintBack(p: Pix, c: Colours, phase: number) {
  const lifts = phase < 0 ? [0, 0] : phase === 0 ? [1, 0] : [0, 1];
  const cx = 19.5;
  p.rect(Math.round(cx) - 4, 1, 2, 4, c.coat.mid);
  p.rect(Math.round(cx) + 2, 1, 2, 4, c.coat.dark);
  p.rect(Math.round(cx) - 2, 3, 4, 4, c.mane.mid);
  for (const [x, lift] of [[13, lifts[0]], [23, lifts[1]]] as const) {
    p.rect(x, 19, 4, 9 - lift, c.coat.mid);
    p.rect(x, 19, 1, 9 - lift, c.coat.light);
    p.rect(x - 1, 27 - lift, 5, 2, HOOF);
  }
  coatDome(p, c.coat, cx, 15, 9.5, 7);
  p.rect(Math.round(cx) - 10, 8, 20, 5, c.blanket);
  p.rect(Math.round(cx) - 10, 12, 20, 1, GOLD_TRIM);
  p.rect(Math.round(cx) - 5, 6, 10, 3, c.saddle);
  p.rect(Math.round(cx) - 5, 6, 10, 1, tone(c.saddle, 0.3));
  for (let i = 0; i < 12; i++) {
    const x = Math.round(cx - 1 + Math.sin(i * 0.5 + (phase < 0 ? 0 : phase)) * 0.8);
    p.rect(x, 13 + i, 3, 1, i % 3 === 0 ? c.mane.light : c.mane.mid);
  }
}

/** Texture key of a horse with this look (its animations are `${key}-side` and so on). */
export const horseKey = (look: HorseLook = defaultLook()) => `horse-${encodeHorseLook(look)}`;

/** Builds the texture and animations for a horse of this look (once per look); returns its key. */
export function ensureHorse(scene: Phaser.Scene, look: HorseLook = defaultLook()): string {
  const key = horseKey(look);
  if (scene.textures.exists(key)) return key;
  const c = colours(look);
  const draws: ((p: Pix) => void)[] = [
    (p) => paintSide(p, c, -1),
    (p) => paintSide(p, c, 0),
    (p) => paintSide(p, c, 1),
    (p) => paintSide(p, c, 2),
    (p) => paintSide(p, c, 3),
    (p) => paintFront(p, c, -1),
    (p) => paintFront(p, c, 0),
    (p) => paintFront(p, c, 1),
    (p) => paintBack(p, c, -1),
    (p) => paintBack(p, c, 0),
    (p) => paintBack(p, c, 1),
  ];
  const texture = scene.textures.createCanvas(key, HORSE_W * draws.length, HORSE_H)!;
  draws.forEach((draw, frame) => {
    const p = new Pix(HORSE_W, HORSE_H);
    draw(p);
    p.outline(OUTLINE);
    texture.context.drawImage(p.canvas, frame * HORSE_W, 0);
    texture.add(frame, 0, frame * HORSE_W, 0, HORSE_W, HORSE_H);
  });
  texture.refresh();
  const anim = (name: string, frames: number[], rate: number) => {
    const animKey = `${key}-${name}`;
    if (!scene.anims.exists(animKey)) scene.anims.create({ key: animKey, frames: frames.map((frame) => ({ key, frame })), frameRate: rate, repeat: -1 });
  };
  anim("side", [1, 2, 3, 4], 10);
  anim("down", [6, 7], 7);
  anim("up", [9, 10], 7);
  return key;
}

/** A small horse picture (side view, standing): the HUD button and the stable window. */
export function horseIconUrl(scale = 2, look: HorseLook = defaultLook()): string {
  const p = new Pix(HORSE_W, HORSE_H);
  paintSide(p, colours(look), -1);
  p.outline(OUTLINE);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(HORSE_W * scale * 0.67);
  canvas.height = Math.round(HORSE_H * scale * 0.67);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(p.canvas, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL();
}

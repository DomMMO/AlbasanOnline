import Phaser from "phaser";
import { TILE_SIZE, type Decor } from "../../../shared/src";
import { addLight } from "../fx/nightLights";
import { DOT_KEY } from "./decor";

// Indoor furniture for the keep's great hall, drawn in code like the town decor: the fire
// pit, rugs, tables, bookshelves, weapon racks, stools and benches. Depth-sorted by their
// bottom edge; stools and benches sit just under whoever is sitting on them.

type Piece<K extends Decor["kind"]> = Extract<Decor, { kind: K }>;

export function firepit(scene: Phaser.Scene, f: Piece<"firepit">) {
  const cx = (f.tx + 1) * TILE_SIZE;
  const bottom = (f.ty + 2) * TILE_SIZE;
  const cy = bottom - TILE_SIZE + 2;
  const g = scene.add.graphics().setPosition(cx, cy).setDepth(bottom - TILE_SIZE);
  // Ash bed and a ring of stones.
  g.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 34, 20);
  g.fillStyle(0x2a2420).fillEllipse(0, 0, 26, 15);
  g.fillStyle(0x3a332d).fillEllipse(0, 0, 20, 10);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sx = Math.cos(a) * 14;
    const sy = Math.sin(a) * 8;
    g.fillStyle(i % 3 === 0 ? 0x5e584f : 0x7d766a).fillEllipse(sx, sy, 7, 5);
    g.fillStyle(0x958e81).fillRect(sx - 2, sy - 2, 3, 1);
  }
  // Crossed logs, glowing at their ends.
  g.fillStyle(0x4a2e16).fillRect(-9, -2, 18, 3);
  g.fillStyle(0x5b3a1e).fillRect(-3, -6, 4, 10);
  g.fillStyle(0xff8c1a).fillRect(-9, -1, 2, 1).fillRect(7, -1, 2, 1);
  g.fillStyle(0xffd43b, 0.9).fillEllipse(0, 0, 10, 4);

  scene.add
    .particles(cx, cy - 2, DOT_KEY, {
      x: { min: -6, max: 6 },
      speedY: { min: -36, max: -16 },
      speedX: { min: -4, max: 4 },
      scale: { start: 2.4, end: 0.3 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe066, 0xffa94d, 0xff6b1a, 0xe03131],
      lifespan: 700,
      frequency: 22,
      blendMode: Phaser.BlendModes.ADD,
    })
    .setDepth(bottom + 0.2);
  // Sparks drifting up now and then, and the smoke that rises past the rafters.
  scene.add
    .particles(cx, cy - 8, DOT_KEY, {
      x: { min: -4, max: 4 },
      speedY: { min: -60, max: -30 },
      speedX: { min: -12, max: 12 },
      scale: 0.6,
      alpha: { start: 1, end: 0 },
      tint: 0xffd43b,
      lifespan: 900,
      frequency: 260,
      blendMode: Phaser.BlendModes.ADD,
    })
    .setDepth(bottom + 0.3);
  scene.add
    .particles(cx, cy - 18, DOT_KEY, {
      x: { min: -3, max: 3 },
      speedY: { min: -18, max: -10 },
      speedX: { min: -3, max: 5 },
      scale: { start: 2, end: 5 },
      alpha: { start: 0.18, end: 0 },
      tint: 0x8a8a8a,
      lifespan: 2200,
      frequency: 160,
    })
    .setDepth(bottom + 0.1);
  const glow = scene.add.circle(cx, cy - 4, 34, 0xff9a3c, 0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(bottom + 0.1);
  scene.tweens.add({ targets: glow, alpha: 0.11, scale: 0.88, duration: 240, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  addLight(scene, cx, cy - 4, 120, 0xffa850, 0.07);
}

export function rug(scene: Phaser.Scene, r: Piece<"rug">) {
  const x0 = r.tx * TILE_SIZE;
  const y0 = r.ty * TILE_SIZE;
  const W = r.w * TILE_SIZE;
  const H = r.h * TILE_SIZE;
  const color = Phaser.Display.Color.IntegerToColor(r.color);
  const dark = color.clone().darken(25).color;
  const light = color.clone().lighten(18).color;
  const g = scene.add.graphics().setPosition(x0, y0).setDepth(-0.5);
  g.fillStyle(0x000000, 0.25).fillRect(1, 2, W, H);
  g.fillStyle(r.color).fillRect(0, 0, W, H);
  // Gold border, an inner band and a repeating diamond pattern.
  g.fillStyle(0xc9a24a).fillRect(0, 0, W, 2).fillRect(0, H - 2, W, 2).fillRect(0, 0, 2, H).fillRect(W - 2, 0, 2, H);
  g.fillStyle(dark).fillRect(4, 4, W - 8, 2).fillRect(4, H - 6, W - 8, 2).fillRect(4, 4, 2, H - 8).fillRect(W - 6, 4, 2, H - 8);
  for (let y = 10; y < H - 8; y += 10) {
    for (let x = 10; x < W - 8; x += 10) {
      g.fillStyle((x + y) % 20 === 0 ? light : dark).fillTriangle(x, y - 3, x + 3, y, x, y + 3).fillTriangle(x, y - 3, x - 3, y, x, y + 3);
    }
  }
  // Fringe on the short ends.
  for (let x = 1; x < W; x += 2) {
    g.fillStyle(0xe9d8a6).fillRect(x, -2, 1, 2).fillRect(x, H, 1, 2);
  }
}

export function table(scene: Phaser.Scene, t: Piece<"table">) {
  const x0 = t.tx * TILE_SIZE;
  const W = t.w * TILE_SIZE;
  const bottom = (t.ty + t.h) * TILE_SIZE;
  const topH = t.h * TILE_SIZE - 4;
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom);
  g.fillStyle(0x000000, 0.3).fillRect(2, -3, W - 2, 4);
  // Legs, the front edge and the top seen from above.
  g.fillStyle(0x3a2616).fillRect(2, -8, 3, 8).fillRect(W - 5, -8, 3, 8);
  g.fillStyle(0x5b3a1e).fillRect(0, -10, W, 4);
  g.fillStyle(0x8a5a2b).fillRect(0, -10 - topH, W, topH);
  for (let y = -10 - topH + 4; y < -10; y += 5) g.fillStyle(0x6b4423).fillRect(0, y, W, 1);
  g.fillStyle(0xa8743f).fillRect(0, -10 - topH, W, 1);
  const top = -10 - topH;
  if (t.map) {
    // A campaign map pinned down with daggers, little flags on it.
    g.fillStyle(0xe9d8a6).fillRect(6, top + 4, W - 12, topH - 8);
    g.fillStyle(0xc9b48a).fillRect(6, top + 4, W - 12, 1).fillRect(6, top + topH - 5, W - 12, 1);
    g.lineStyle(1, 0x6b8e5a).strokeEllipse(W / 2 - 10, top + topH / 2, 22, 12);
    g.lineStyle(1, 0x3b6ea8).lineBetween(10, top + topH - 10, W - 14, top + 10);
    g.fillStyle(0x2b5422).fillRect(W / 2 - 16, top + topH / 2 - 2, 3, 3).fillRect(W / 2 - 8, top + topH / 2 + 1, 3, 3);
    for (const [fx, fy, c] of [[W / 2 + 10, top + 12, 0xc92a2a], [W / 2 - 4, top + topH - 12, 0x3b5bdb], [W - 20, top + 16, 0xc92a2a]] as const) {
      g.fillStyle(0x2a2a30).fillRect(fx, fy - 5, 1, 5);
      g.fillStyle(c).fillRect(fx + 1, fy - 5, 3, 2);
    }
    g.fillStyle(0xb0b4bc).fillRect(8, top + 6, 1, 6).fillRect(W - 10, top + topH - 12, 1, 6);
  } else {
    // Mugs, a loaf, a plate and candles down the length of the table.
    for (let x = 8; x < W - 6; x += 14) {
      g.fillStyle(0x8a8478).fillEllipse(x, top + topH / 2, 8, 4);
      g.fillStyle(0x6b4423).fillRect(x + 5, top + 4, 4, 5);
      g.fillStyle(0xe8c33a).fillRect(x + 5, top + 4, 4, 1);
    }
    g.fillStyle(0xc68a3a).fillEllipse(W / 2, top + topH - 6, 12, 5);
    g.fillStyle(0xe0a85a).fillEllipse(W / 2, top + topH - 7, 9, 3);
    for (const cx of [12, W - 12]) {
      g.fillStyle(0xf1ead8).fillRect(cx, top + 2, 2, 5);
      const flame = scene.add.ellipse(x0 + cx + 1, bottom + top + 1, 3, 4, 0xffd43b).setDepth(bottom + 0.2);
      scene.tweens.add({ targets: flame, scaleY: 0.7, duration: 180 + Math.random() * 120, yoyo: true, repeat: -1 });
      addLight(scene, x0 + cx + 1, bottom + top, 30, 0xffd08a, 0.1);
    }
  }
}

export function shelf(scene: Phaser.Scene, s: Piece<"shelf">) {
  const x0 = s.tx * TILE_SIZE;
  const W = s.w * TILE_SIZE;
  const bottom = (s.ty + 1) * TILE_SIZE;
  const H = 34;
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom);
  g.fillStyle(0x000000, 0.3).fillRect(1, -2, W, 3);
  g.fillStyle(0x3a2616).fillRect(0, -H, W, H);
  g.fillStyle(0x5b3a1e).fillRect(0, -H, W, 2).fillRect(0, -H, 2, H).fillRect(W - 2, -H, 2, H);
  const colors = [0x8a2e2e, 0x2b5f8a, 0x2f7a4f, 0x8c6d1f, 0x6a4c93, 0x7a5c3a, 0xe9d8a6];
  for (const [i, y] of [-H + 12, -H + 23, -2].entries()) {
    g.fillStyle(0x5b3a1e).fillRect(0, y, W, 2);
    let x = 3;
    let n = i * 3;
    while (x < W - 5) {
      const w = 2 + ((n * 7) % 3);
      const h = 7 + ((n * 5) % 3);
      // Now and then a gap, a lying book or a candle stub.
      if (n % 9 === 4) x += 4;
      else if (n % 11 === 7) {
        g.fillStyle(colors[n % colors.length]).fillRect(x, y - 3, 8, 3);
        x += 9;
      } else {
        g.fillStyle(colors[n % colors.length]).fillRect(x, y - h, w, h);
        g.fillStyle(0xe8c33a, 0.6).fillRect(x, y - h + 2, w, 1);
        x += w + 1;
      }
      n++;
    }
  }
}

export function rack(scene: Phaser.Scene, r: Piece<"rack">) {
  const x0 = r.tx * TILE_SIZE;
  const W = r.w * TILE_SIZE;
  const bottom = (r.ty + 1) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom);
  g.fillStyle(0x000000, 0.3).fillRect(1, -2, W, 3);
  // Frame: two posts and two cross bars.
  g.fillStyle(0x4a2e16).fillRect(1, -30, 3, 30).fillRect(W - 4, -30, 3, 30);
  g.fillStyle(0x6b4423).fillRect(0, -26, W, 3).fillRect(0, -6, W, 3);
  // Swords, an axe, a spear and a mace leaning in it.
  const steel = 0xc3c8cf;
  for (let i = 0, x = 9; x < W - 6; i++, x += 9) {
    switch (i % 4) {
      case 0: // sword
        g.fillStyle(steel).fillRect(x, -32, 2, 24);
        g.fillStyle(0xe8c33a).fillRect(x - 2, -9, 6, 2);
        g.fillStyle(0x5b3a1e).fillRect(x, -7, 2, 5);
        break;
      case 1: // axe
        g.fillStyle(0x6b4423).fillRect(x, -34, 2, 32);
        g.fillStyle(steel).fillTriangle(x + 2, -34, x + 8, -36, x + 8, -26).fillRect(x + 2, -33, 4, 5);
        break;
      case 2: // spear
        g.fillStyle(0x6b4423).fillRect(x, -36, 1, 34);
        g.fillStyle(steel).fillTriangle(x - 2, -36, x + 3, -36, x + 0.5, -42);
        g.fillStyle(0x9c2a2a).fillRect(x - 1, -35, 3, 2);
        break;
      default: // mace
        g.fillStyle(0x5b3a1e).fillRect(x, -28, 2, 26);
        g.fillStyle(0x6c707a).fillCircle(x + 1, -30, 4);
        g.fillStyle(steel).fillRect(x - 3, -31, 1, 1).fillRect(x + 4, -31, 1, 1).fillRect(x + 1, -35, 1, 1);
    }
  }
  // A shield hung on one end.
  g.fillStyle(0x2a1a0e).fillCircle(W - 10, -18, 7);
  g.fillStyle(0x9c2a2a).fillCircle(W - 10, -18, 6);
  g.fillStyle(0xe8c33a).fillCircle(W - 10, -18, 2);
}

export function stool(scene: Phaser.Scene, s: Piece<"stool">) {
  const x = (s.tx + 0.5) * TILE_SIZE;
  const bottom = (s.ty + 1) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x, bottom).setDepth(bottom - 0.5);
  g.fillStyle(0x000000, 0.3).fillEllipse(0, -1, 14, 4);
  g.fillStyle(0x4a2e16).fillRect(-6, -3, 2, 3).fillRect(4, -3, 2, 3);
  g.fillStyle(0x8a5a2b).fillEllipse(0, -4, 16, 5);
  g.fillStyle(0xa8743f).fillEllipse(0, -5, 12, 2);
}

export function bench(scene: Phaser.Scene, b: Piece<"bench">) {
  const x0 = b.tx * TILE_SIZE;
  const W = b.w * TILE_SIZE;
  const bottom = (b.ty + 1) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom - 0.5);
  g.fillStyle(0x000000, 0.3).fillRect(2, -2, W - 2, 3);
  g.fillStyle(0x3a2616).fillRect(3, -6, 3, 6).fillRect(W - 6, -6, 3, 6);
  g.fillStyle(0x6b4423).fillRect(0, -9, W, 4);
  g.fillStyle(0x8a5a2b).fillRect(0, -10, W, 2);
}

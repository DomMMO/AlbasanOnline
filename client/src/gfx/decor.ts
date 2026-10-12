import Phaser from "phaser";
import { TILE_SIZE, type Decor, type IconShape } from "../../../shared/src";
import { ICON_SIZE, paintIcon } from "./icons";

// Town decor drawn in code on top of the tiles: buildings, the fountain, lamps…
// Each piece is depth-sorted by its bottom edge like characters, so players walking
// behind a building disappear under its roof and players in front of it don't.

export const DOT_KEY = "decor-dot";

/** A 2x2 white texture for particles. */
export function ensureDot(scene: Phaser.Scene) {
  if (scene.textures.exists(DOT_KEY)) return;
  const texture = scene.textures.createCanvas(DOT_KEY, 2, 2)!;
  texture.context.fillStyle = "#ffffff";
  texture.context.fillRect(0, 0, 2, 2);
  texture.refresh();
}

function iconTexture(scene: Phaser.Scene, shape: IconShape, color: number) {
  const key = `decor-icon-${shape}-${color}`;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, ICON_SIZE, ICON_SIZE)!;
    paintIcon(texture.context, shape, color);
    texture.refresh();
  }
  return key;
}

export function drawDecor(scene: Phaser.Scene, decor: Decor[]) {
  ensureDot(scene);
  for (const piece of decor) {
    switch (piece.kind) {
      case "building":
        building(scene, piece);
        break;
      case "fountain":
        fountain(scene, piece);
        break;
      case "lamp":
        lamp(scene, piece.tx, piece.ty);
        break;
      case "anvil":
        anvil(scene, piece.tx, piece.ty);
        break;
      case "banner":
        banner(scene, piece.tx, piece.ty, piece.color);
        break;
      case "campfire":
        campfire(scene, piece.tx, piece.ty);
        break;
      case "tent":
        tent(scene, piece);
        break;
      case "grave":
        grave(scene, piece.tx, piece.ty);
        break;
      case "bridge":
        bridge(scene, piece);
        break;
      case "torch":
        torch(scene, piece.tx, piece.ty);
        break;
    }
  }
}

function building(scene: Phaser.Scene, b: Extract<Decor, { kind: "building" }>) {
  const W = b.w * TILE_SIZE;
  const H = b.h * TILE_SIZE;
  const x0 = b.tx * TILE_SIZE;
  const bottom = (b.ty + b.h) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom);
  const wallH = 26;

  // Front wall: plaster between timber beams on a stone footing.
  g.fillStyle(0xe3d3ad).fillRect(0, -wallH, W, wallH);
  g.fillStyle(0x5b3a1e).fillRect(0, -wallH, W, 2);
  for (let x = 0; x < W; x += TILE_SIZE * 2) g.fillRect(x, -wallH, 2, wallH);
  g.fillRect(W - 2, -wallH, 2, wallH);
  g.fillStyle(0x8a8478).fillRect(0, -4, W, 4);
  g.fillStyle(0x6f695e).fillRect(0, -1, W, 1);

  // Door in the middle, windows either side.
  const doorX = Math.round(W / 2 - 5);
  g.fillStyle(0x3b2414).fillRect(doorX - 1, -17, 12, 17);
  g.fillStyle(0x7a4e2a).fillRect(doorX, -16, 10, 16);
  g.fillStyle(0x5e3a1d).fillRect(doorX + 4, -16, 1, 16);
  g.fillStyle(0xe8c33a).fillRect(doorX + 7, -8, 1, 1);
  for (const wx of [10, W - 18]) {
    if (Math.abs(wx - doorX) < 14) continue;
    g.fillStyle(0x3b2414).fillRect(wx - 1, -21, 10, 9);
    g.fillStyle(0xf5d77a).fillRect(wx, -20, 8, 7);
    g.fillStyle(0x3b2414).fillRect(wx + 3, -20, 1, 7).fillRect(wx, -17, 8, 1);
  }

  // Roof with shingle rows, overhanging the wall a little.
  const roofTop = -(H + 8);
  const roofBottom = -wallH + 3;
  const roofDark = Phaser.Display.Color.IntegerToColor(b.roof).darken(25).color;
  g.fillStyle(b.roof).fillRect(-2, roofTop, W + 4, roofBottom - roofTop);
  for (let y = roofTop + 4, row = 0; y < roofBottom; y += 4, row++) {
    g.fillStyle(roofDark).fillRect(-2, y, W + 4, 1);
    for (let x = (row % 2) * 4; x < W + 4; x += 8) g.fillRect(x - 2, y - 3, 1, 3);
  }
  g.fillStyle(Phaser.Display.Color.IntegerToColor(b.roof).lighten(20).color).fillRect(-2, roofTop, W + 4, 2);
  g.fillStyle(0x000000, 0.35).fillRect(0, roofBottom, W, 2);

  if (b.chimney) {
    const cx = W - 16;
    g.fillStyle(0x6b3a2e).fillRect(cx, roofTop - 8, 7, 12);
    g.fillStyle(0x3a1f18).fillRect(cx - 1, roofTop - 9, 9, 2);
    scene.add
      .particles(x0 + cx + 3, bottom + roofTop - 10, DOT_KEY, {
        speedY: { min: -14, max: -8 },
        speedX: { min: -2, max: 5 },
        scale: { start: 1.5, end: 3 },
        alpha: { start: 0.5, end: 0 },
        tint: 0x9a9a9a,
        lifespan: 1800,
        frequency: 260,
      })
      .setDepth(bottom + 1);
  }

  if (b.sign) {
    // Hanging shop sign beside the door shows what is sold inside.
    const sx = doorX + 15;
    g.fillStyle(0x3b2414).fillRect(sx + 6, -wallH + 2, 1, 3);
    g.fillStyle(0x3b2414).fillRect(sx - 1, -wallH + 5, 16, 15);
    g.fillStyle(0x9a6a3c).fillRect(sx, -wallH + 6, 14, 13);
    scene.add.image(x0 + sx + 1, bottom - wallH + 7, iconTexture(scene, b.sign.shape, b.sign.color)).setOrigin(0, 0).setDepth(bottom + 0.1);
  }
}

function fountain(scene: Phaser.Scene, f: Extract<Decor, { kind: "fountain" }>) {
  const W = f.w * TILE_SIZE;
  const H = f.h * TILE_SIZE;
  const x0 = f.tx * TILE_SIZE;
  const bottom = (f.ty + f.h) * TILE_SIZE;
  const cx = W / 2;
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom);

  // Basin: stone rim, water, darker front face.
  g.fillStyle(0x6f695e).fillRoundedRect(0, -H + 6, W, H - 6, 12);
  g.fillStyle(0xa39d90).fillRoundedRect(1, -H + 6, W - 2, H - 12, 11);
  g.fillStyle(0x2f5f9e).fillRoundedRect(5, -H + 10, W - 10, H - 20, 8);
  g.fillStyle(0x3f7fd0).fillRoundedRect(6, -H + 12, W - 12, H - 23, 7);
  g.fillStyle(0xc4bdb0).fillRect(10, -H + 7, W - 20, 1);

  // Column with a small upper bowl.
  g.fillStyle(0x7c766b).fillRect(cx - 4, -H - 6, 8, H - 12);
  g.fillStyle(0xb8b2a6).fillRect(cx - 3, -H - 6, 5, H - 12);
  g.fillStyle(0x7c766b).fillEllipse(cx, -H - 7, 22, 8);
  g.fillStyle(0xb8b2a6).fillEllipse(cx, -H - 8, 20, 6);
  g.fillStyle(0x3f7fd0).fillEllipse(cx, -H - 8, 14, 3);

  // Ripples on the water.
  const ripples = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom + 0.05);
  const drawRipples = (phase: number) => {
    ripples.clear().fillStyle(0xbfe3ff, 0.8);
    for (let i = 0; i < 6; i++) {
      const x = 10 + ((i * 13 + phase * 3) % (W - 26));
      const y = -H + 15 + ((i * 7) % (H - 30));
      ripples.fillRect(x, y, 4, 1);
    }
  };
  let phase = 0;
  drawRipples(phase);
  scene.time.addEvent({ delay: 350, loop: true, callback: () => drawRipples(++phase) });

  // Water arcing up from the top bowl and falling back into the basin.
  scene.add
    .particles(x0 + cx, bottom - H - 10, DOT_KEY, {
      angle: { min: 215, max: 325 },
      speed: { min: 22, max: 38 },
      gravityY: 70,
      scale: { start: 0.9, end: 0.5 },
      alpha: { start: 0.9, end: 0.2 },
      tint: [0xbfe3ff, 0x7fb8ff, 0xffffff],
      lifespan: 900,
      frequency: 35,
      quantity: 2,
    })
    .setDepth(bottom + 0.2);
}

function lamp(scene: Phaser.Scene, tx: number, ty: number) {
  const x = (tx + 0.5) * TILE_SIZE;
  const bottom = (ty + 1) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x, bottom).setDepth(bottom);
  g.fillStyle(0x000000, 0.25).fillEllipse(0, -1, 10, 3);
  g.fillStyle(0x2a2a30).fillRect(-1, -24, 3, 23).fillRect(-3, -3, 7, 2);
  g.fillStyle(0x2a2a30).fillRect(-4, -31, 9, 2).fillRect(-3, -25, 7, 2);
  g.fillStyle(0xffd97a).fillRect(-3, -29, 7, 4);
  g.fillStyle(0xfff3c4).fillRect(-1, -28, 3, 2);
  const glow = scene.add
    .circle(x + 0.5, bottom - 27, 12, 0xffc04d, 0.18)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(bottom + 0.1);
  scene.tweens.add({ targets: glow, alpha: 0.1, scale: 0.85, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}

function anvil(scene: Phaser.Scene, tx: number, ty: number) {
  const x = (tx + 0.5) * TILE_SIZE;
  const bottom = (ty + 1) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x, bottom).setDepth(bottom);
  g.fillStyle(0x000000, 0.25).fillEllipse(0, -1, 14, 3);
  g.fillStyle(0x6b4423).fillRect(-5, -5, 10, 5);
  g.fillStyle(0x2d2f36).fillRect(-3, -8, 6, 3);
  g.fillStyle(0x3d4048).fillRect(-6, -11, 12, 3);
  g.fillTriangle(6, -11, 6, -8, 10, -10);
  g.fillStyle(0x6c707a).fillRect(-6, -11, 12, 1);

  // Sparks now and then, as if the smith had just struck it.
  scene.time.addEvent({
    delay: 1700,
    loop: true,
    callback: () => {
      for (let i = 0; i < 5; i++) {
        const spark = scene.add.rectangle(x, bottom - 12, 1, 1, i % 2 ? 0xffd43b : 0xff8c1a).setDepth(bottom + 1);
        scene.tweens.add({
          targets: spark,
          x: x + Phaser.Math.Between(-9, 9),
          y: bottom - 12 - Phaser.Math.Between(3, 10),
          alpha: 0,
          duration: Phaser.Math.Between(250, 450),
          ease: "Quad.easeOut",
          onComplete: () => spark.destroy(),
        });
      }
    },
  });
}

function banner(scene: Phaser.Scene, tx: number, ty: number, color: number) {
  const x = (tx + 0.5) * TILE_SIZE;
  const bottom = (ty + 1) * TILE_SIZE;
  const pole = scene.add.graphics().setPosition(x, bottom).setDepth(bottom);
  pole.fillStyle(0x000000, 0.25).fillEllipse(0, -1, 8, 3);
  pole.fillStyle(0x5b3a1e).fillRect(-1, -30, 2, 30);
  pole.fillStyle(0xe8c33a).fillRect(-1, -32, 2, 2);
  const cloth = scene.add.graphics().setPosition(x + 1, bottom - 29).setDepth(bottom + 0.1);
  cloth.fillStyle(color).fillRect(0, 0, 9, 11);
  cloth.fillTriangle(0, 11, 9, 11, 4.5, 15);
  cloth.fillStyle(0xffffff, 0.35).fillRect(0, 2, 9, 1);
  scene.tweens.add({ targets: cloth, scaleX: 0.8, duration: 1100 + Math.random() * 300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}

function campfire(scene: Phaser.Scene, tx: number, ty: number) {
  const x = (tx + 0.5) * TILE_SIZE;
  const bottom = (ty + 1) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x, bottom).setDepth(bottom);
  g.fillStyle(0x000000, 0.3).fillEllipse(0, -3, 16, 5);
  for (const [sx, sy] of [[-6, -4], [-3, -2], [2, -2], [5, -4], [0, -6]]) g.fillStyle(0x6f695e).fillRect(sx - 1, sy - 1, 3, 2);
  g.fillStyle(0x5b3a1e).fillRect(-5, -6, 10, 2).fillRect(-2, -8, 4, 5);
  scene.add
    .particles(x, bottom - 7, DOT_KEY, {
      x: { min: -3, max: 3 },
      speedY: { min: -22, max: -12 },
      scale: { start: 1.6, end: 0.2 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd43b, 0xff8c1a, 0xff4d1a],
      lifespan: 600,
      frequency: 40,
      blendMode: Phaser.BlendModes.ADD,
    })
    .setDepth(bottom + 0.2);
  const glow = scene.add.circle(x, bottom - 6, 26, 0xff9a3c, 0.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(bottom + 0.1);
  scene.tweens.add({ targets: glow, alpha: 0.08, scale: 0.9, duration: 260, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}

function tent(scene: Phaser.Scene, t: Extract<Decor, { kind: "tent" }>) {
  const W = t.w * TILE_SIZE;
  const H = t.h * TILE_SIZE;
  const x0 = t.tx * TILE_SIZE;
  const bottom = (t.ty + t.h) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom);
  const dark = Phaser.Display.Color.IntegerToColor(t.color).darken(30).color;
  g.fillStyle(0x000000, 0.25).fillEllipse(W / 2, -1, W + 4, 6);
  g.fillStyle(t.color).fillTriangle(-2, 0, W + 2, 0, W / 2, -H - 10);
  g.fillStyle(dark).fillTriangle(W / 2, -H - 10, W + 2, 0, W / 2 + 4, 0);
  g.fillStyle(0x1a1410).fillTriangle(W / 2 - 6, 0, W / 2 + 6, 0, W / 2, -14);
  g.fillStyle(0x5b3a1e).fillRect(W / 2 - 1, -H - 13, 2, 4);
}

function grave(scene: Phaser.Scene, tx: number, ty: number) {
  const x = (tx + 0.5) * TILE_SIZE;
  const bottom = (ty + 1) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x, bottom).setDepth(bottom);
  g.fillStyle(0x000000, 0.3).fillEllipse(0, -1, 14, 4);
  g.fillStyle(0x5a5850).fillRoundedRect(-5, -15, 10, 14, { tl: 5, tr: 5, bl: 0, br: 0 });
  g.fillStyle(0x7c7a70).fillRoundedRect(-4, -14, 7, 12, { tl: 4, tr: 4, bl: 0, br: 0 });
  g.fillStyle(0x3a3832).fillRect(-1, -12, 2, 7).fillRect(-3, -10, 6, 2);
  g.fillStyle(0x4f7a3a).fillRect(-6, -2, 3, 2).fillRect(3, -2, 4, 2);
}

/**
 * Wooden bridge running north-south: the deck is Tile.Bridge, this adds the shadow on the
 * water, beams under the deck and the rails with posts. Drawn under characters so players
 * walk between the rails.
 */
function bridge(scene: Phaser.Scene, b: Extract<Decor, { kind: "bridge" }>) {
  const W = b.w * TILE_SIZE;
  const H = b.h * TILE_SIZE;
  const x0 = b.tx * TILE_SIZE;
  const y0 = b.ty * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x0, y0).setDepth(y0 - 1);
  // Shadow cast on the water, and the side beams of the deck.
  g.fillStyle(0x000000, 0.28).fillRect(W, 6, 4, H - 10);
  g.fillStyle(0x4a2e16).fillRect(-3, 0, 3, H).fillRect(W, 0, 3, H);
  g.fillStyle(0x6b4423).fillRect(-3, 0, 1, H).fillRect(W, 0, 1, H);
  // Rails on posts.
  const posts = [0, Math.round(H / 2) - 2, H - 4];
  for (const side of [-4, W + 1]) {
    g.fillStyle(0x3b2414).fillRect(side, 2, 3, H - 4);
    g.fillStyle(0x8b5a2b).fillRect(side, 2, 2, H - 4);
    for (const y of posts) {
      g.fillStyle(0x2a1a0e).fillRect(side - 1, y - 6, 5, 9);
      g.fillStyle(0x7a4e2a).fillRect(side, y - 6, 3, 8);
      g.fillStyle(0xb07b48).fillRect(side, y - 6, 3, 1);
    }
  }
  // Little foam where the water meets the posts.
  const foam = scene.add.graphics().setPosition(x0, y0).setDepth(y0 - 0.9);
  let phase = 0;
  scene.time.addEvent({
    delay: 300,
    loop: true,
    callback: () => {
      phase++;
      foam.clear().fillStyle(0xd0ecff, 0.7);
      for (const [fx, fy] of [[-8, H / 2], [W + 6, H / 2 - 6], [-7, H / 2 + 8], [W + 5, H / 2 + 6]]) {
        if ((fx + fy + phase) % 3 !== 0) foam.fillRect(fx + (phase % 2), fy, 3, 1);
      }
    },
  });
}

function torch(scene: Phaser.Scene, tx: number, ty: number) {
  const x = (tx + 0.5) * TILE_SIZE;
  const bottom = (ty + 1) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x, bottom).setDepth(bottom);
  g.fillStyle(0x000000, 0.3).fillEllipse(0, -1, 10, 3);
  g.fillStyle(0x6f695e).fillRect(-3, -3, 6, 3);
  g.fillStyle(0x4a2e16).fillRect(-1, -20, 3, 18);
  g.fillStyle(0x2a2a30).fillRect(-3, -22, 7, 3);
  scene.add
    .particles(x + 0.5, bottom - 23, DOT_KEY, {
      x: { min: -2, max: 2 },
      speedY: { min: -26, max: -14 },
      scale: { start: 1.4, end: 0.2 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd43b, 0xff8c1a, 0xff4d1a],
      lifespan: 450,
      frequency: 45,
      blendMode: Phaser.BlendModes.ADD,
    })
    .setDepth(bottom + 0.2);
  const glow = scene.add.circle(x + 0.5, bottom - 24, 20, 0xff9a3c, 0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(bottom + 0.1);
  scene.tweens.add({ targets: glow, alpha: 0.09, scale: 0.85, duration: 220 + Math.random() * 120, yoyo: true, repeat: -1 });
}

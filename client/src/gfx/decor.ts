import Phaser from "phaser";
import { CASTLE_MERLON_H, CASTLE_TOWER_H, CASTLE_WALL_H, COLOSSEUM, DECOR_ART, insideCastle, mulberry32, TILE_SIZE, type Decor, type IconShape } from "../../../shared/src";
import { decorArtKey } from "./decorArt";
import { addGlow, addLight } from "../fx/nightLights";
import { ICON_SIZE, paintIcon } from "./icons";
import { bench, firepit, rack, rug, shelf, stool, table } from "./interior";
import { ensureHorse, HorseFrame } from "./horse";
import { hash01 } from "./pixelArt";
import { barrelSprite, bushSprite, crateSprite, dummySprite, haySprite, houseSprite, palaceSprite, plantSprite, ROOF_PAD, sackSprite, treeSprite, wellSprite, type SpriteInfo } from "./sprites";
import { decorArtTexture } from "./tileArt";

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

/** `onPiece` is told before each piece is drawn (its index), so callers can tell whose objects are whose. */
export function drawDecor(scene: Phaser.Scene, decor: Decor[], onPiece?: (index: number) => void) {
  ensureDot(scene);
  for (const [index, piece] of decor.entries()) {
    onPiece?.(index);
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
      case "kurgan":
        kurgan(scene, piece);
        break;
      case "art":
        art(scene, piece);
        break;
      case "bridge":
        bridge(scene, piece);
        break;
      case "torch":
        torch(scene, piece.tx, piece.ty);
        break;
      case "signboard":
        signboard(scene, piece);
        break;
      case "groundFrame":
        groundFrame(scene, piece);
        break;
      case "fence":
        fence(scene, piece.tiles);
        break;
      case "castleWall":
        castleWall(scene, piece);
        break;
      case "tower":
        tower(scene, piece);
        break;
      case "gateArch":
        gateArch(scene, piece);
        break;
      case "keep":
        keep(scene, piece);
        break;
      case "drawbridge":
        drawbridge(scene, piece);
        break;
      case "prop":
        prop(scene, piece);
        break;
      case "pier":
        pier(scene, piece);
        break;
      case "ship":
        ship(scene, piece);
        break;
      case "lighthouse":
        lighthouse(scene, piece);
        break;
      case "firepit":
        firepit(scene, piece);
        break;
      case "rug":
        rug(scene, piece);
        break;
      case "table":
        table(scene, piece);
        break;
      case "shelf":
        shelf(scene, piece);
        break;
      case "rack":
        rack(scene, piece);
        break;
      case "stool":
        stool(scene, piece);
        break;
      case "bench":
        bench(scene, piece);
        break;
      case "horse":
        farmHorse(scene, piece);
        break;
      case "trough":
        trough(scene, piece.tx, piece.ty);
        break;
      case "parkBench":
        parkBench(scene, piece);
        break;
      case "bigTree":
        bigTree(scene, piece.tx, piece.ty, piece.variant);
        break;
      case "roundFence":
        roundFence(scene, piece);
        break;
      case "plant": {
        // Its own spot within the tile, so plants do not line up on the grid.
        const jx = ((piece.variant * 7) % 9) - 4;
        const jy = ((piece.variant * 5) % 7) - 3;
        placeSprite(scene, plantSprite(scene, piece.variant), (piece.tx + 0.5) * TILE_SIZE + jx, (piece.ty + 1) * TILE_SIZE + jy);
        break;
      }
      case "bush": {
        const x = (piece.tx + 0.5) * TILE_SIZE;
        const bottom = (piece.ty + 1) * TILE_SIZE;
        groundShadow(scene, x + 3, bottom - 1, 20, 6);
        placeSprite(scene, bushSprite(scene, piece.variant), x, bottom);
        break;
      }
      case "clouds":
        clouds(scene, piece.w, piece.h);
        break;
      case "colosseum":
        colosseum(scene);
        break;
    }
  }
}

// ---- Castle -------------------------------------------------------------------------
// Fortifications are drawn "standing up": a wall tile's walk is lifted WALL_H pixels above
// its footprint, and where the camera sees the side of a wall (its south edge) a stone face
// fills the gap. Battlements line the side facing away from the courtyard.

// A GM can replace the wall walk, the wall face and whole towers with uploaded images
// (tileArt.ts); battlements are still drawn over an uploaded wall.

const WALL_H = CASTLE_WALL_H;
const TOWER_H = CASTLE_TOWER_H;
const STONE = {
  top: 0x9a9384,
  topDark: 0x847d6f,
  topLight: 0xb3ac9c,
  face: 0x7d766a,
  faceLight: 0x958e81,
  faceDark: 0x5e584f,
  mortar: 0x4f4a43,
  merlon: 0xa8a192,
  merlonTop: 0xc4bdb0,
  moss: 0x5a7a3a,
};

/** Stone courses on a vertical face: rows of blocks with offset joints. */
function stoneCourses(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, seed: number) {
  g.fillStyle(STONE.face).fillRect(x, y, w, h);
  for (let row = 0, cy = y; cy < y + h; row++, cy += 6) {
    g.fillStyle(STONE.mortar).fillRect(x, cy + 5, w, 1);
    for (let jx = ((row + seed) % 2) * 5 + 2; jx < w; jx += 10) g.fillRect(x + jx, cy, 1, Math.min(5, y + h - cy));
    g.fillStyle(STONE.faceLight).fillRect(x, cy, w, 1);
  }
}

/** Battlements along one edge of a raised walk, seen from above and the south. */
function merlons(g: Phaser.GameObjects.Graphics, side: "n" | "s" | "e" | "w", x: number, y: number, len: number) {
  for (let i = 1; i + 5 <= len; i += 8) {
    if (side === "n") {
      g.fillStyle(STONE.faceDark).fillRect(x + i, y - 6, 5, 7);
      g.fillStyle(STONE.merlon).fillRect(x + i, y - 6, 5, 4);
      g.fillStyle(STONE.merlonTop).fillRect(x + i, y - 6, 5, 1);
    } else if (side === "s") {
      // Rising above the front face: we see their fronts.
      g.fillStyle(STONE.face).fillRect(x + i, y - 6, 5, 6);
      g.fillStyle(STONE.merlonTop).fillRect(x + i, y - 6, 5, 1);
      g.fillStyle(STONE.mortar).fillRect(x + i + 4, y - 5, 1, 5);
    } else {
      // Down the west or east edge: block tops with a sliver of front face.
      const bx = side === "w" ? x : x - 4;
      g.fillStyle(STONE.merlon).fillRect(bx, y + i - 3, 4, 4);
      g.fillStyle(STONE.merlonTop).fillRect(bx, y + i - 3, 4, 1);
      g.fillStyle(STONE.faceDark).fillRect(bx, y + i + 1, 4, 2);
    }
  }
}

/** The wall walk of one wall tile, seen from above (big flagstones), `top` pixels up. */
function paintWallWalk(g: Phaser.GameObjects.Graphics, top: number, seed: number) {
  g.fillStyle(STONE.top).fillRect(0, top, TILE_SIZE, TILE_SIZE);
  g.fillStyle(STONE.topDark).fillRect(0, top + 7, TILE_SIZE, 1).fillRect(0, top + 15, TILE_SIZE, 1);
  g.fillRect((seed % 2) * 8 + 3, top, 1, 7).fillRect(((seed + 1) % 2) * 8 + 3, top + 8, 1, 7);
  g.fillStyle(STONE.topLight).fillRect((seed % 5) + 6, top + 2, 3, 1);
}

function castleWall(scene: Phaser.Scene, w: Extract<Decor, { kind: "castleWall" }>) {
  const keys = new Set(w.tiles.map(({ tx, ty }) => `${tx},${ty}`));
  const has = (tx: number, ty: number) => keys.has(`${tx},${ty}`);
  const inside = (tx: number, ty: number) =>
    w.innerShape ? insideCastle(w.innerShape, tx, ty) : tx >= w.inner.x0 && tx <= w.inner.x1 && ty >= w.inner.y0 && ty <= w.inner.y1;
  const topArt = decorArtTexture(scene, "castle_top");
  const faceArt = decorArtTexture(scene, "castle_face");
  for (const { tx, ty } of w.tiles) {
    const bottom = (ty + 1) * TILE_SIZE;
    const top = -TILE_SIZE - WALL_H;
    const seed = tx * 7 + ty * 13;
    const open = !has(tx, ty + 1);
    // Uploaded pieces first: the battlements (in g, same depth) go over them.
    if (topArt) scene.add.image(tx * TILE_SIZE, bottom + top, topArt).setOrigin(0, 0).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(bottom);
    if (faceArt && open) scene.add.image(tx * TILE_SIZE, bottom - WALL_H, faceArt).setOrigin(0, 0).setDisplaySize(TILE_SIZE, WALL_H).setDepth(bottom);
    // Each tile sorts on its own, so players pass behind and in front of the wall correctly.
    const g = scene.add.graphics().setPosition(tx * TILE_SIZE, bottom).setDepth(bottom);

    // The wall walk: big flagstones.
    if (!topArt) paintWallWalk(g, top, seed);

    // Seen from the south: the face down to the ground.
    if (open && faceArt) g.fillStyle(0x000000, 0.25).fillRect(0, -2, TILE_SIZE, 2);
    else if (open) {
      stoneCourses(g, 0, -WALL_H, TILE_SIZE, WALL_H, seed);
      g.fillStyle(0x000000, 0.25).fillRect(0, -2, TILE_SIZE, 2);
      if (seed % 3 === 0) g.fillStyle(STONE.moss).fillRect(seed % 11, -3, 4, 1).fillRect((seed % 11) + 1, -4, 2, 1);
      // Arrow slits on the outside face now and then.
      if (!inside(tx, ty + 1) && tx % 4 === 0) {
        g.fillStyle(0x1a1714).fillRect(7, -WALL_H + 7, 2, 10).fillRect(5, -WALL_H + 11, 6, 2);
      }
    }

    // Battlements on the outer edges; a low lip on the courtyard side.
    for (const [side, nx, ny] of [["n", tx, ty - 1], ["s", tx, ty + 1], ["w", tx - 1, ty], ["e", tx + 1, ty]] as const) {
      if (has(nx, ny)) continue;
      if (inside(nx, ny)) {
        g.fillStyle(STONE.faceDark);
        if (side === "w") g.fillRect(0, top, 2, TILE_SIZE);
        else if (side === "e") g.fillRect(TILE_SIZE - 2, top, 2, TILE_SIZE);
        else if (side === "n") g.fillRect(0, top, TILE_SIZE, 2);
        else g.fillStyle(STONE.topLight).fillRect(0, -WALL_H - 2, TILE_SIZE, 2);
        continue;
      }
      if (side === "n") merlons(g, "n", 0, top, TILE_SIZE);
      else if (side === "s") merlons(g, "s", 0, -WALL_H, TILE_SIZE);
      else if (side === "w") merlons(g, "w", 0, top, TILE_SIZE);
      else merlons(g, "e", TILE_SIZE, top, TILE_SIZE);
    }
  }
}

function waveFlag(scene: Phaser.Scene, x: number, y: number, color: number, depth: number, size = 1) {
  const pole = scene.add.graphics().setPosition(x, y).setDepth(depth);
  pole.fillStyle(0x3b2414).fillRect(0, -22 * size, 2, 22 * size);
  pole.fillStyle(0xe8c33a).fillRect(0, -24 * size, 2, 2);
  const cloth = scene.add.graphics().setPosition(x + 2, y - 21 * size).setDepth(depth + 0.01);
  cloth.fillStyle(color).fillRect(0, 0, 12 * size, 7 * size);
  cloth.fillTriangle(12 * size, 0, 12 * size, 7 * size, 15 * size, 3.5 * size);
  cloth.fillStyle(0xffffff, 0.3).fillRect(0, 1, 12 * size, 1);
  cloth.fillStyle(0xe8c33a).fillRect(4 * size, 2 * size, 3 * size, 3 * size);
  scene.tweens.add({ targets: cloth, scaleX: 0.75, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}

function tower(scene: Phaser.Scene, t: Extract<Decor, { kind: "tower" }>) {
  const W = t.w * TILE_SIZE;
  const D = t.h * TILE_SIZE;
  const x0 = t.tx * TILE_SIZE;
  const bottom = (t.ty + t.h) * TILE_SIZE;
  const art = decorArtTexture(scene, "tower");
  if (art) {
    // An uploaded tower is the whole thing, flag included; only its shadow is ours.
    scene.add.graphics().setPosition(x0, bottom).setDepth(bottom - 0.01).fillStyle(0x000000, 0.3).fillEllipse(W / 2, 0, W + 8, 6);
    scene.add.image(x0, bottom, art).setOrigin(0, 1).setDisplaySize(W, CASTLE_MERLON_H + D + TOWER_H).setDepth(bottom);
    return;
  }
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom);
  paintTower(g, W, D, t.tx + t.ty);
  waveFlag(scene, x0 + W / 2 - 1, bottom - TOWER_H - D / 2, t.flag, bottom + 0.1);
}

/** A tower W wide and D deep, drawn up from its bottom-left corner at (0, 0) in g. */
function paintTower(g: Phaser.GameObjects.Graphics, W: number, D: number, seed: number) {
  // Plinth, face with shaded corners, slits.
  g.fillStyle(0x000000, 0.3).fillEllipse(W / 2, 0, W + 8, 6);
  stoneCourses(g, 0, -TOWER_H, W, TOWER_H, seed);
  g.fillStyle(STONE.faceDark).fillRect(-1, -6, W + 2, 6);
  g.fillStyle(STONE.faceLight).fillRect(-1, -6, W + 2, 1);
  g.fillStyle(STONE.faceLight).fillRect(0, -TOWER_H, 2, TOWER_H - 6);
  g.fillStyle(STONE.faceDark).fillRect(W - 3, -TOWER_H, 3, TOWER_H - 6);
  for (const sx of [W / 2 - 1]) {
    g.fillStyle(0x1a1714).fillRect(sx, -TOWER_H + 8, 3, 12).fillRect(sx - 3, -TOWER_H + 13, 9, 2);
    g.fillStyle(0xffc04d, 0.35).fillRect(sx + 1, -TOWER_H + 10, 1, 8);
  }

  // Roof deck seen from above, framed by battlements on every side.
  const top = -TOWER_H - D;
  g.fillStyle(STONE.top).fillRect(0, top, W, D);
  g.fillStyle(STONE.topDark).fillRect(4, top + 4, W - 8, D - 8);
  for (let y = top + 10; y < top + D - 6; y += 8) g.fillStyle(STONE.top).fillRect(4, y, W - 8, 1);
  g.fillStyle(0x5b3a1e).fillRect(W - 14, top + D - 14, 7, 6);
  g.fillStyle(0x3b2414).fillRect(W - 13, top + D - 12, 5, 1);
  merlons(g, "n", 0, top, W);
  merlons(g, "w", 0, top, D);
  merlons(g, "e", W, top, D);
  merlons(g, "s", 0, -TOWER_H, W);
}

/**
 * A castle piece the way the game draws it, into g with its top-left at (0, 0): the editor
 * offers it as the "original" to download and draw over.
 */
export function paintCastlePiece(g: Phaser.GameObjects.Graphics, key: string) {
  if (key === "castle_top") paintWallWalk(g, 0, 0);
  else if (key === "castle_face") stoneCourses(g, 0, 0, TILE_SIZE, WALL_H, 0);
  else if (key === "tower") {
    const W = 4 * TILE_SIZE;
    const D = 4 * TILE_SIZE;
    const lift = CASTLE_MERLON_H + D + TOWER_H;
    g.translateCanvas(0, lift);
    paintTower(g, W, D, 0);
    // The flag, still (in the game it waves).
    const fx = W / 2 - 1;
    const fy = -TOWER_H - D / 2;
    g.fillStyle(0x3b2414).fillRect(fx, fy - 22, 2, 22);
    g.fillStyle(0xe8c33a).fillRect(fx, fy - 24, 2, 2);
    g.fillStyle(0x9c2a2a).fillRect(fx + 2, fy - 21, 12, 7);
    g.fillTriangle(fx + 14, fy - 21, fx + 14, fy - 14, fx + 17, fy - 17.5);
    g.fillStyle(0xe8c33a).fillRect(fx + 6, fy - 19, 3, 3);
    g.translateCanvas(0, -lift);
  }
}

function gateArch(scene: Phaser.Scene, a: Extract<Decor, { kind: "gateArch" }>) {
  const W = a.w * TILE_SIZE;
  const H = a.h * TILE_SIZE;
  const x0 = a.tx * TILE_SIZE;
  const y0 = a.ty * TILE_SIZE;
  const bottom = y0 + H;
  // The passage floor lies in the gate's shadow.
  scene.add.graphics().setDepth(-0.4).fillStyle(0x000000, 0.35).fillRect(x0, y0 - 4, W, H + 4);
  // The wall walk spans the passage overhead: players walking through go under it.
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom + 1);
  const top = -H - WALL_H;
  g.fillStyle(STONE.faceDark).fillRect(0, top + H, W, 5);
  g.fillStyle(STONE.top).fillRect(0, top, W, H);
  for (let y = top + 7; y < top + H; y += 8) g.fillStyle(STONE.topDark).fillRect(0, y, W, 1);
  g.fillStyle(STONE.topDark).fillRect(W / 2, top, 1, H);
  // The raised portcullis: iron bars along the outer (east) edge with spikes below.
  g.fillStyle(0x2a2a30).fillRect(W - 4, top, 4, H + 5);
  for (let y = top + 2; y < top + H + 5; y += 4) g.fillStyle(0x4a4a55).fillRect(W - 4, y, 4, 1);
  for (let y = top + 3; y < top + H; y += 6) g.fillStyle(0x6c707a).fillRect(W - 3, y, 1, 1);
  merlons(g, "e", W - 4, top, H);
}

/**
 * The palace (İç Kale): its painted sprite, flags waving from its three spires, lanterns by the
 * door that light up at dusk, and windows that glow at night.
 */
function keep(scene: Phaser.Scene, k: Extract<Decor, { kind: "keep" }>) {
  const W = k.w * TILE_SIZE;
  const x0 = k.tx * TILE_SIZE;
  const bottom = (k.ty + k.h) * TILE_SIZE;
  const sprite = palaceSprite(scene, k.w, k.h, k.banner);
  const left = x0 - sprite.pad;
  const top = bottom - sprite.height;
  groundShadow(scene, x0 + W / 2 + 10, bottom + 1, W + 30, 14, 0.3);
  placeSprite(scene, sprite, left, bottom);
  for (const f of sprite.flags) waveFlag(scene, left + f.x, top + f.y + 2, k.banner, bottom + 0.1, f.big ? 1.3 : 0.9);
  for (const w of sprite.windows) {
    const pane = scene.add
      .rectangle(left + w.x + w.w / 2, top + w.y + w.h / 2, w.w, w.h, 0xffc860)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(bottom + 0.05);
    addGlow(scene, pane, 0.8, 0.08);
  }
  for (const l of sprite.lanterns) {
    const x = left + l.x + 0.5;
    const y = top + l.y;
    const flame = scene.add.rectangle(x, y, 3, 5, 0xffe08a).setDepth(bottom + 0.06);
    addGlow(scene, flame, 1, 0.1);
    const halo = scene.add.circle(x, y, 13, 0xffc04d, 0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(bottom + 0.1);
    addGlow(scene, halo, 0.3, 0.25);
    addLight(scene, x, y + 8, 72, 0xffd08a, 0.05);
  }
}

function drawbridge(scene: Phaser.Scene, d: Extract<Decor, { kind: "drawbridge" }>) {
  const W = d.w * TILE_SIZE;
  const H = d.h * TILE_SIZE;
  const x0 = d.tx * TILE_SIZE;
  const y0 = d.ty * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x0, y0).setDepth(y0 - 1);
  g.fillStyle(0x000000, 0.3).fillRect(-2, H, W + 4, 5);
  g.fillStyle(0x94643a).fillRect(-2, 0, W + 4, H);
  for (let x = -2; x < W + 2; x += 4) {
    g.fillStyle(0x4a2e16).fillRect(x + 3, 0, 1, H);
    g.fillStyle(0xb07b48).fillRect(x, 0, 1, H);
  }
  for (const y of [6, H - 8]) {
    g.fillStyle(0x2a2a30).fillRect(-2, y, W + 4, 2);
    for (let x = 0; x < W; x += 6) g.fillStyle(0x6c707a).fillRect(x, y, 1, 1);
  }
  // Side beams with posts, and the chains up to the gatehouse.
  for (const y of [-3, H]) {
    g.fillStyle(0x4a2e16).fillRect(-2, y, W + 4, 3);
    g.fillStyle(0x6b4423).fillRect(-2, y, W + 4, 1);
    for (const x of [-3, W - 1]) {
      g.fillStyle(0x2a1a0e).fillRect(x, y - 8, 4, 10);
      g.fillStyle(0x7a4e2a).fillRect(x + 1, y - 8, 2, 9);
    }
  }
  const chains = scene.add.graphics().setDepth(y0 + H);
  for (const y of [y0 - 9, y0 + H - 8]) {
    for (let i = 0; i < 9; i++) chains.fillStyle(i % 2 ? 0x6c707a : 0x3a3a40).fillRect(x0 - 2 - i * 2.2, y - i * 2.6, 2, 2);
  }
}

/** Props painted as pixel sprites (the rest are drawn below). */
const PROP_SPRITES: Partial<Record<Extract<Decor, { kind: "prop" }>["prop"], (scene: Phaser.Scene) => SpriteInfo>> = {
  well: wellSprite,
  barrel: barrelSprite,
  crate: crateSprite,
  hay: haySprite,
  dummy: dummySprite,
  sack: sackSprite,
};

function prop(scene: Phaser.Scene, p: Extract<Decor, { kind: "prop" }>) {
  const painted = PROP_SPRITES[p.prop];
  if (painted) {
    const size = p.prop === "well" ? 2 : 1;
    const x = p.tx * TILE_SIZE + (size * TILE_SIZE) / 2;
    const bottom = (p.ty + size) * TILE_SIZE;
    groundShadow(scene, x + 3, bottom - 1, size * 16, size * 5);
    placeSprite(scene, painted(scene), x, bottom);
    return;
  }
  const size = p.prop === "well" ? 2 : 1;
  const wide = p.prop === "well" || p.prop === "obelisk" ? 2 : 1;
  const x = p.tx * TILE_SIZE + (wide * TILE_SIZE) / 2;
  const bottom = (p.ty + size) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x, bottom).setDepth(bottom);
  g.fillStyle(0x000000, 0.25).fillEllipse(0, -1, size * 14, 4);
  switch (p.prop) {
    case "barrel":
      g.fillStyle(0x6b4423).fillRoundedRect(-6, -15, 12, 14, 3);
      g.fillStyle(0x8a5a2b).fillRect(-4, -15, 3, 14);
      g.fillStyle(0x4a2e16).fillRect(1, -15, 1, 14).fillRect(4, -14, 1, 12);
      g.fillStyle(0x3a3a40).fillRect(-6, -12, 12, 1).fillRect(-6, -5, 12, 1);
      g.fillStyle(0x9a6a3c).fillEllipse(0, -15, 12, 4);
      g.fillStyle(0x5b3a1e).fillEllipse(0, -15, 8, 2);
      break;
    case "crate":
      g.fillStyle(0xb98a4e).fillRect(-7, -16, 14, 4);
      g.fillStyle(0x9a6a3c).fillRect(-7, -12, 14, 11);
      g.fillStyle(0x5b3a1e).lineStyle(1, 0x5b3a1e).strokeRect(-6.5, -11.5, 13, 10);
      g.lineBetween(-6, -11, 6, -2).lineBetween(6, -11, -6, -2);
      g.fillStyle(0xd6aa66).fillRect(-7, -16, 14, 1);
      break;
    case "hay":
      g.fillStyle(0xb8902e).fillRoundedRect(-7, -11, 14, 10, 2);
      g.fillStyle(0xd9b44a).fillRoundedRect(-7, -13, 14, 5, 2);
      for (const sx of [-5, -1, 3]) g.fillStyle(0x8a6a1e).fillRect(sx, -9, 1, 7);
      g.fillStyle(0x6b4423).fillRect(-7, -7, 14, 1);
      g.fillStyle(0xf0d070).fillRect(-4, -12, 3, 1).fillRect(2, -13, 2, 1);
      break;
    case "cart":
      g.fillStyle(0x6b4423).fillRect(-8, -14, 15, 7);
      g.fillStyle(0x8a5a2b).fillRect(-8, -14, 15, 2);
      g.fillStyle(0xd9b44a).fillRect(-6, -17, 11, 3);
      g.fillStyle(0x4a2e16).fillRect(6, -10, 6, 1);
      g.fillStyle(0x2a1a0e).fillCircle(-2, -5, 5);
      g.fillStyle(0x7a4e2a).fillCircle(-2, -5, 4);
      g.fillStyle(0x2a1a0e).fillCircle(-2, -5, 1).fillRect(-2, -9, 1, 8).fillRect(-6, -5, 8, 1);
      break;
    case "column": {
      // A marble column with a broken top, on a square plinth.
      g.fillStyle(0x6f695e).fillRect(-7, -5, 14, 5);
      g.fillStyle(0xb3ac9c).fillRect(-7, -6, 14, 2);
      g.fillStyle(0xe8e2d4).fillRect(-5, -30, 10, 25);
      g.fillStyle(0xc4bdb0).fillRect(1, -30, 4, 25);
      for (const fx of [-3, 0, 3]) g.fillStyle(0xa39d90).fillRect(fx, -29, 1, 23);
      g.fillStyle(0xe8e2d4).fillTriangle(-5, -30, 5, -30, 2, -35);
      g.fillStyle(0xc4bdb0).fillTriangle(1, -30, 5, -30, 2, -35);
      g.fillStyle(0x5a7a3a).fillRect(-5, -9, 3, 3).fillRect(3, -14, 2, 2);
      break;
    }
    case "balbal": {
      // An old Turkic grave stone: a rough grey pillar carved into a man holding a cup.
      g.fillStyle(0x5a5850).fillRoundedRect(-5, -24, 10, 23, { tl: 4, tr: 4, bl: 1, br: 1 });
      g.fillStyle(0x7c7a70).fillRoundedRect(-4, -23, 7, 21, { tl: 3, tr: 3, bl: 1, br: 1 });
      g.fillStyle(0x3a3832).fillRect(-3, -19, 2, 1).fillRect(1, -19, 2, 1);
      g.fillStyle(0x3a3832).fillRect(-1, -16, 2, 1).fillRect(-2, -14, 4, 1);
      g.fillStyle(0x3a3832).fillRect(-3, -10, 2, 1).fillRect(-1, -9, 3, 1).fillRect(1, -11, 2, 2);
      g.fillStyle(0x4f6a3a).fillRect(-5, -3, 3, 2).fillRect(3, -4, 2, 3);
      break;
    }
    case "obelisk": {
      // A tall red-granite obelisk with gold runes.
      g.fillStyle(0x000000, 0.3).fillEllipse(0, -1, 30, 6);
      g.fillStyle(0x6f695e).fillRect(-12, -6, 24, 6);
      g.fillStyle(0xb3ac9c).fillRect(-12, -7, 24, 2);
      g.fillStyle(0x7a2420).fillPoints([new Phaser.Math.Vector2(-7, -7), new Phaser.Math.Vector2(7, -7), new Phaser.Math.Vector2(4, -48), new Phaser.Math.Vector2(-4, -48)], true);
      g.fillStyle(0x5a1a16).fillPoints([new Phaser.Math.Vector2(2, -7), new Phaser.Math.Vector2(7, -7), new Phaser.Math.Vector2(4, -48), new Phaser.Math.Vector2(1, -48)], true);
      g.fillStyle(0xe8c33a).fillTriangle(-4, -48, 4, -48, 0, -54);
      for (let y = -42; y < -12; y += 7) g.fillStyle(0xe8c33a).fillRect(-2, y, 3, 1).fillRect(-1, y + 2, 1, 2);
      break;
    }
    case "well": {
      // Stone ring with dark water, two posts and a little shingled roof with a bucket.
      g.fillStyle(STONE.faceDark).fillEllipse(0, -8, 24, 12);
      g.fillStyle(STONE.face).fillRect(-12, -14, 24, 10);
      for (const sx of [-12, -4, 4]) g.fillStyle(STONE.mortar).fillRect(sx + 7, -14, 1, 10);
      g.fillStyle(STONE.mortar).fillRect(-12, -9, 24, 1);
      g.fillStyle(STONE.merlonTop).fillEllipse(0, -14, 24, 8);
      g.fillStyle(0x1f3a5c).fillEllipse(0, -14, 18, 5);
      g.fillStyle(0x3b2414).fillRect(-11, -36, 2, 24).fillRect(9, -36, 2, 24);
      g.fillStyle(0x5b3a1e).fillRect(-11, -30, 22, 2);
      g.fillStyle(0x9c3b2e).fillTriangle(-15, -34, 15, -34, 0, -44);
      g.fillStyle(0x7a2a20).fillTriangle(0, -44, 15, -34, 2, -34);
      g.fillStyle(0x2a2a30).fillRect(0, -28, 1, 6);
      g.fillStyle(0x6b4423).fillRect(-2, -22, 5, 4);
      break;
    }
  }
}

function signboard(scene: Phaser.Scene, s: Extract<Decor, { kind: "signboard" }>) {
  const W = s.w * TILE_SIZE;
  const x0 = s.tx * TILE_SIZE;
  const bottom = (s.ty + 1) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom);
  // Two posts with the board hanging between them.
  g.fillStyle(0x000000, 0.25).fillEllipse(4, -1, 8, 3).fillEllipse(W - 4, -1, 8, 3);
  g.fillStyle(0x5b3a1e).fillRect(3, -34, 3, 34).fillRect(W - 6, -34, 3, 34);
  g.fillStyle(0x2a1a08).fillRect(1, -36, W - 2, 16);
  g.fillStyle(0xb98a4e).fillRect(2, -35, W - 4, 14);
  g.fillStyle(0xd6aa66).fillRect(2, -35, W - 4, 2);
  g.fillStyle(0x8a6233).fillRect(2, -23, W - 4, 2);
  scene.add
    .text(x0 + W / 2, bottom - 28, s.text, {
      fontFamily: '"Cloister Black TR", serif',
      fontSize: "12px",
      color: "#2a1a08",
    })
    .setOrigin(0.5)
    .setResolution(4)
    .setDepth(bottom + 0.1);
}

/** One post per tile, with rails running to the neighbouring fence tiles. */
function fence(scene: Phaser.Scene, tiles: { tx: number; ty: number }[]) {
  const POST = 0x5b3a1e;
  const RAIL = 0x8a5a2b;
  const LIGHT = 0xb07b48;
  const keys = new Set(tiles.map(({ tx, ty }) => `${tx},${ty}`));
  const has = (tx: number, ty: number) => keys.has(`${tx},${ty}`);
  for (const { tx, ty } of tiles) {
    const bottom = (ty + 1) * TILE_SIZE;
    // Each tile is depth-sorted on its own, so players pass in front of and behind it correctly.
    const g = scene.add.graphics().setPosition(tx * TILE_SIZE, bottom).setDepth(bottom);
    g.fillStyle(0x000000, 0.22).fillEllipse(8, -2, 10, 3);
    // Rails along the row (left/right) at two heights.
    const left = has(tx - 1, ty) ? 0 : 7;
    const right = has(tx + 1, ty) ? 16 : 9;
    for (const y of [-12, -7]) {
      g.fillStyle(RAIL).fillRect(left, y, right - left, 2);
      g.fillStyle(LIGHT).fillRect(left, y, right - left, 1);
    }
    // Up the column: a rail reaching to the post above.
    if (has(tx, ty - 1)) {
      g.fillStyle(RAIL).fillRect(7, -28, 2, 16);
      g.fillStyle(LIGHT).fillRect(7, -28, 1, 16);
    }
    g.fillStyle(POST).fillRect(6, -15, 4, 14);
    g.fillStyle(LIGHT).fillRect(6, -16, 4, 2);
  }
}

function groundFrame(scene: Phaser.Scene, f: Extract<Decor, { kind: "groundFrame" }>) {
  // Just above the tiles, under everything standing on them.
  const g = scene.add.graphics().setDepth(-0.5);
  const x = f.tx * TILE_SIZE;
  const y = f.ty * TILE_SIZE;
  const w = f.w * TILE_SIZE;
  const h = f.h * TILE_SIZE;
  g.fillStyle(f.color, 0.08).fillRect(x, y, w, h);
  g.lineStyle(2, f.color, 0.7).strokeRect(x + 1, y + 1, w - 2, h - 2);
}

/** A sprite standing with its feet at (x, bottom), sorted with characters by its bottom edge. */
function placeSprite(scene: Phaser.Scene, sprite: SpriteInfo, x: number, bottom: number, depth = bottom) {
  return scene.add.image(x, bottom, sprite.key).setOrigin(sprite.originX, sprite.originY).setDepth(depth);
}

/** A soft shadow on the ground (under everyone walking past), cast down and right. */
function groundShadow(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.28) {
  scene.add.graphics().setDepth(-0.4).fillStyle(0x0b1a08, alpha).fillEllipse(x, y, w, h);
}

function building(scene: Phaser.Scene, b: Extract<Decor, { kind: "building" }>) {
  const W = b.w * TILE_SIZE;
  const H = b.h * TILE_SIZE;
  const x0 = b.tx * TILE_SIZE;
  const bottom = (b.ty + b.h) * TILE_SIZE;
  // Roofs face different ways: ridge across or front to back, by the map or by the spot.
  const ridge = b.ridge ?? (hash01(b.tx, b.ty, 7) < 0.4 ? "v" : "h");
  const sprite = houseSprite(scene, { w: b.w, h: b.h, roof: b.roof, ridge, chimney: !!b.chimney, sign: !!b.sign, seed: b.tx * 131 + b.ty * 31 });
  const left = x0 - ROOF_PAD;
  const top = bottom - (H + 18);
  // Its shadow falls to the right of it and a little in front.
  scene.add
    .graphics()
    .setDepth(-0.4)
    .fillStyle(0x0b1a08, 0.3)
    .fillRect(x0 + W + ROOF_PAD, bottom - H + 8, 9, H - 4)
    .fillTriangle(x0 + W + ROOF_PAD, bottom - H + 2, x0 + W + ROOF_PAD + 9, bottom - H + 8, x0 + W + ROOF_PAD, bottom - H + 8)
    .fillRect(x0 + 6, bottom, W + ROOF_PAD + 3, 4)
    .fillTriangle(x0 + 2, bottom, x0 + 6, bottom, x0 + 6, bottom + 4);
  placeSprite(scene, sprite, left, bottom);

  if (b.abandoned) {
    // Dark panes with two planks nailed across each.
    const g = scene.add.graphics().setDepth(bottom + 0.05);
    for (const w of sprite.windows) {
      const x = left + w.x;
      const y = top + w.y;
      g.fillStyle(0x15130f).fillRect(x, y, w.w, w.h);
      g.fillStyle(0x6b4a2b).fillRect(x - 1, y + 1, w.w + 2, 2).fillRect(x - 1, y + w.h - 3, w.w + 2, 2);
      g.fillStyle(0x3a2716).fillRect(x - 1, y + 2, w.w + 2, 1).fillRect(x - 1, y + w.h - 2, w.w + 2, 1);
    }
    return;
  }
  if (sprite.chimney) {
    scene.add
      .particles(left + sprite.chimney.x, top + sprite.chimney.y, DOT_KEY, {
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
  // Lit windows at night: a warm glow over each pane, with the lamps.
  for (const w of sprite.windows) {
    const pane = scene.add
      .rectangle(left + w.x + w.w / 2, top + w.y + w.h / 2, w.w, w.h, 0xffc860)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(bottom + 0.05);
    addGlow(scene, pane, 0.75, 0.08);
  }
  if (b.sign && sprite.sign) {
    // The shop's icon on its hanging board shows what is sold inside.
    scene.add.image(left + sprite.sign.x, top + sprite.sign.y, iconTexture(scene, b.sign.shape, b.sign.color)).setOrigin(0, 0).setDepth(bottom + 0.1);
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
  // The glass is dull by day; the flame behind it and its halo come up with the lamps.
  g.fillStyle(0x6e6650).fillRect(-3, -29, 7, 4);
  g.fillStyle(0x8a8266).fillRect(-1, -28, 3, 1);
  const flame = scene.add.graphics().setPosition(x, bottom).setDepth(bottom + 0.05);
  flame.fillStyle(0xffd97a).fillRect(-3, -29, 7, 4).fillStyle(0xfff3c4).fillRect(-1, -28, 3, 2);
  addGlow(scene, flame, 1, 0.05);
  const glow = scene.add
    .circle(x + 0.5, bottom - 27, 14, 0xffc04d, 0.28)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(bottom + 0.1);
  addGlow(scene, glow, 0.28, 0.2);
  addLight(scene, x + 0.5, bottom - 22, 58, 0xffd08a, 0.03);
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
  addLight(scene, x, bottom - 6, 80, 0xffa040, 0.08, false);
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

/**
 * Art decor (data/decorArt.ts): the image stands centred on the tiles it blocks, its bottom on
 * theirs; flat pieces lie under characters. Without the art file, its code-drawn fallback.
 */
function art(scene: Phaser.Scene, a: Extract<Decor, { kind: "art" }>) {
  const def = DECOR_ART[a.key];
  const [w, h] = def.size ?? [1, 1];
  const texture = decorArtKey(a.key);
  if (!scene.textures.exists(texture)) {
    if (def.fallback) drawDecor(scene, [artFallback(def.fallback, a.tx, a.ty, w, h)]);
    return;
  }
  const x = (a.tx + w / 2) * TILE_SIZE;
  const bottom = (a.ty + h) * TILE_SIZE;
  // Loose scatter gets a little jitter so rows of it don't line up on the grid.
  const jitter = def.size ? 0 : (hash01(a.tx, a.ty, 3) - 0.5) * 8;
  scene.add
    .image(Math.round(x + jitter), bottom, texture)
    .setOrigin(0.5, 1)
    .setDepth(def.flat ? -0.5 : bottom)
    .setFlipX(!def.size && hash01(a.tx, a.ty, 5) < 0.5);
}

function artFallback(fallback: NonNullable<(typeof DECOR_ART)[string]["fallback"]>, tx: number, ty: number, w: number, h: number): Decor {
  switch (fallback) {
    case "grave":
      return { kind: "grave", tx, ty };
    case "banner":
      return { kind: "banner", tx, ty, color: 0x9c2a2a };
    case "rack":
      return { kind: "rack", tx, ty, w };
    case "shelf":
      return { kind: "shelf", tx, ty, w };
    case "table":
      return { kind: "table", tx, ty, w, h };
    case "tent":
      return { kind: "tent", tx, ty, w, h, color: 0xc9a227 };
    case "tree":
      return { kind: "bigTree", tx, ty, variant: 0 };
    default:
      return { kind: "prop", tx, ty, prop: fallback };
  }
}

/** A burial mound: a low hump of withered grass, darker on its shaded side, stones round its foot. */
function kurgan(scene: Phaser.Scene, k: Extract<Decor, { kind: "kurgan" }>) {
  const W = k.w * TILE_SIZE;
  const H = k.h * TILE_SIZE;
  const x = k.tx * TILE_SIZE + W / 2;
  const bottom = (k.ty + k.h) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x, bottom).setDepth(bottom);
  const rise = H + 6;
  g.fillStyle(0x000000, 0.3).fillEllipse(3, -4, W + 6, 12);
  g.fillStyle(0x4a4630).fillEllipse(0, -rise / 2, W, rise + 4);
  g.fillStyle(0x6a6546).fillEllipse(-W * 0.08, -rise / 2 - 2, W * 0.84, rise);
  g.fillStyle(0x7d7652).fillEllipse(-W * 0.16, -rise / 2 - 5, W * 0.5, rise * 0.55);
  const rand = mulberry32(k.tx * 131 + k.ty * 7);
  for (let i = 0; i < W / 3; i++) {
    const tx = (rand() - 0.5) * W * 0.8;
    const ty = -4 - rand() * rise * 0.85;
    g.fillStyle(rand() < 0.5 ? 0x9a8f5e : 0x524e35).fillRect(tx, ty, 1, 2);
  }
  // Stones round the foot.
  for (let sx = -W / 2 + 4; sx < W / 2 - 2; sx += 6) {
    g.fillStyle(0x5a5850).fillRoundedRect(sx, -6 + Math.abs(sx) * 0.08, 5, 4, 1);
    g.fillStyle(0x8a877c).fillRect(sx + 1, -6 + Math.abs(sx) * 0.08, 3, 1);
  }
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

/** A horse standing in the paddock; now and then it takes a few steps and turns round. */
function farmHorse(scene: Phaser.Scene, h: Extract<Decor, { kind: "horse" }>) {
  const key = ensureHorse(scene, h.look);
  const x = (h.tx + 0.5) * TILE_SIZE;
  const bottom = (h.ty + 1) * TILE_SIZE;
  scene.add.ellipse(x, bottom - 1, 26, 5, 0x000000, 0.25).setDepth(bottom - 0.1);
  const side = h.facing !== "down";
  const sprite = scene.add
    .sprite(x, bottom, key, side ? HorseFrame.Side : HorseFrame.Down)
    .setOrigin(0.5, 1)
    .setDepth(bottom)
    .setFlipX(h.facing === "left");
  scene.time.addEvent({
    delay: 2500 + Math.random() * 3000,
    loop: true,
    callback: () => {
      if (!side || Math.random() < 0.5) return;
      sprite.anims.play(`${key}-side`, true);
      scene.time.delayedCall(500 + Math.random() * 400, () => {
        sprite.anims.stop();
        sprite.setFrame(HorseFrame.Side);
        if (Math.random() < 0.4) sprite.setFlipX(!sprite.flipX);
      });
    },
  });
}

/**
 * A park bench: wooden slats on cast-iron legs with a backrest. Sitters face `facing`; the
 * backrest is on the far side, so for a bench looking north (at the fountain from the south)
 * it stands in front of whoever sits there and is drawn over them.
 */
/**
 * A round fence: posts spaced evenly round an ellipse, two rails from post to post. Every post
 * and rail sorts by its own foot, so the far side stands behind what is in the paddock and the
 * near side in front of it.
 */
function roundFence(scene: Phaser.Scene, f: Extract<Decor, { kind: "roundFence" }>) {
  const cx = f.cx * TILE_SIZE;
  const cy = f.cy * TILE_SIZE;
  const rx = f.rx * TILE_SIZE;
  const ry = f.ry * TILE_SIZE;
  const around = Math.PI * Math.sqrt((rx * rx + ry * ry) * 2);
  const count = Math.max(12, Math.round(around / 11));
  const inGate = (a: number) => {
    const angle = Math.atan2(Math.sin(a), Math.cos(a));
    return angle >= f.gate[0] && angle <= f.gate[1];
  };
  const points = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return { a, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
  points.forEach((p, i) => {
    const q = points[(i + 1) % count];
    if (inGate(p.a) || inGate(q.a)) return;
    // The rails to the next post, at two heights, lit along the top.
    const g = scene.add.graphics().setDepth(Math.max(p.y, q.y) - 0.1);
    for (const h of [5, 10]) {
      g.lineStyle(2, 0x6b4423).lineBetween(p.x, p.y - h, q.x, q.y - h);
      g.lineStyle(1, 0xb07b48).lineBetween(p.x, p.y - h - 1, q.x, q.y - h - 1);
    }
  });
  for (const p of points) {
    if (inGate(p.a)) continue;
    const g = scene.add.graphics().setPosition(Math.round(p.x), Math.round(p.y)).setDepth(p.y);
    g.fillStyle(0x000000, 0.22).fillEllipse(1, 0, 7, 3);
    g.fillStyle(0x3b2414).fillRect(-2, -13, 5, 13);
    g.fillStyle(0x6b4423).fillRect(-1, -13, 3, 13);
    g.fillStyle(0xb07b48).fillRect(-1, -14, 3, 2);
  }
  // Gateposts either side of the opening, a little taller.
  for (const a of f.gate) {
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + Math.sin(a) * ry);
    const g = scene.add.graphics().setPosition(x, y).setDepth(y);
    g.fillStyle(0x3b2414).fillRect(-2, -17, 5, 17);
    g.fillStyle(0x7a4e2a).fillRect(-1, -17, 3, 17);
    g.fillStyle(0xc08a52).fillRect(-2, -18, 5, 2);
  }
}

// ---- Big trees and the sky ------------------------------------------------------------

/** A big tree: its painted sprite on the trunk's tile, its shadow cast down and right. */
function bigTree(scene: Phaser.Scene, tx: number, ty: number, variant: number) {
  const x = (tx + 0.5) * TILE_SIZE;
  const bottom = (ty + 1) * TILE_SIZE;
  groundShadow(scene, x + 9, bottom - 3, 48, 16, 0.3);
  placeSprite(scene, treeSprite(scene, variant), x, bottom);
}

const CLOUD_KEYS = ["cloud-0", "cloud-1", "cloud-2"];

/** Cloud puffs (soft white bubbles with a shaded underside), made once per scene. */
function ensureClouds(scene: Phaser.Scene) {
  CLOUD_KEYS.forEach((key, i) => {
    if (scene.textures.exists(key)) return;
    const rand = mulberry32(31 + i * 17);
    const w = 96 + i * 32;
    const h = 44 + i * 8;
    const texture = scene.textures.createCanvas(key, w, h)!;
    const ctx = texture.context;
    const puffs = Array.from({ length: 6 + i * 2 }, () => ({ x: 18 + rand() * (w - 36), y: h * 0.45 + (rand() - 0.5) * h * 0.3, r: 12 + rand() * (h * 0.32) }));
    for (const [color, dy] of [["#c3d6e8", 4], ["#f4f8fc", 0], ["#ffffff", -3]] as const) {
      ctx.fillStyle = color;
      for (const p of puffs) {
        ctx.beginPath();
        ctx.arc(p.x, p.y + dy, color === "#ffffff" ? p.r * 0.7 : p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    texture.refresh();
  });
}

/**
 * The sky under a floating island: a blue backdrop and clouds drifting slowly east below the
 * island (under the ground layer), wrapping round when they leave the map.
 */
function clouds(scene: Phaser.Scene, wTiles: number, hTiles: number) {
  scene.cameras.main.setBackgroundColor(0x8ec8ee);
  ensureClouds(scene);
  const width = wTiles * TILE_SIZE;
  const height = hTiles * TILE_SIZE;
  const rand = mulberry32(777);
  const drifting: { image: Phaser.GameObjects.Image; speed: number }[] = [];
  for (let i = 0; i < Math.round((wTiles * hTiles) / 260); i++) {
    const far = i % 3 === 0;
    const image = scene.add
      .image(rand() * (width + 300) - 150, rand() * height, CLOUD_KEYS[i % CLOUD_KEYS.length])
      .setDepth(far ? -3 : -2)
      .setAlpha(far ? 0.55 : 0.9)
      .setScale(far ? 0.7 : 1 + rand() * 0.6);
    drifting.push({ image, speed: (far ? 3 : 6) + rand() * 4 });
  }
  scene.time.addEvent({
    delay: 100,
    loop: true,
    callback: () => {
      for (const cloud of drifting) {
        cloud.image.x += cloud.speed * 0.1;
        if (cloud.image.x > width + 160) cloud.image.x = -160;
      }
    },
  });
}

function parkBench(scene: Phaser.Scene, b: Extract<Decor, { kind: "parkBench" }>) {
  const x0 = b.tx * TILE_SIZE;
  const W = b.w * TILE_SIZE;
  const bottom = (b.ty + 1) * TILE_SIZE;
  const IRON = 0x2a2a30;
  const WOOD = 0x8a5a2b;
  const WOOD_LIGHT = 0xb07b48;
  const WOOD_DARK = 0x5b3a1e;
  // Shadow, legs and seat sit just under the sitter.
  const seat = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom - 0.5);
  seat.fillStyle(0x000000, 0.25).fillEllipse(W / 2, -1, W, 4);
  for (const lx of [3, W - 5]) seat.fillStyle(IRON).fillRect(lx, -6, 2, 6).fillRect(lx - 1, -1, 4, 1);
  seat.fillStyle(WOOD_DARK).fillRect(1, -8, W - 2, 3);
  seat.fillStyle(WOOD).fillRect(1, -9, W - 2, 2).fillRect(1, -6, W - 2, 1);
  seat.fillStyle(WOOD_LIGHT).fillRect(1, -9, W - 2, 1);
  // Backrest: two slats on iron posts.
  const behind = b.facing === "down";
  const back = scene.add.graphics().setPosition(x0, bottom).setDepth(behind ? bottom - 0.6 : bottom + 0.5);
  const top = behind ? -18 : -6;
  for (const lx of [3, W - 5]) back.fillStyle(IRON).fillRect(lx, top, 2, behind ? 10 : 6);
  for (const [dy, color] of [[0, WOOD_LIGHT], [1, WOOD], [4, WOOD_LIGHT], [5, WOOD]] as const) back.fillStyle(color).fillRect(0, top + 1 + dy, W, 1);
  back.fillStyle(WOOD_DARK).fillRect(0, top + 3, W, 1).fillRect(0, top + 7, W, 1);
  for (const lx of [0, W - 1]) back.fillStyle(IRON).fillRect(lx, top, 1, 8);
}

/** A long wooden water trough (two tiles wide). */
function trough(scene: Phaser.Scene, tx: number, ty: number) {
  const x0 = tx * TILE_SIZE;
  const bottom = (ty + 1) * TILE_SIZE;
  const W = TILE_SIZE * 2;
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom);
  g.fillStyle(0x000000, 0.25).fillEllipse(W / 2, -1, W + 2, 4);
  g.fillStyle(0x4a2e16).fillRect(2, -4, 3, 4).fillRect(W - 5, -4, 3, 4);
  g.fillStyle(0x6b4423).fillRect(1, -11, W - 2, 8);
  g.fillStyle(0x8a5a2b).fillRect(1, -11, W - 2, 2);
  g.fillStyle(0x3466a8).fillRect(3, -10, W - 6, 2);
  g.fillStyle(0x8fb8e8).fillRect(6, -10, 4, 1).fillRect(W - 12, -10, 3, 1);
  g.fillStyle(0x4a2e16).fillRect(1, -7, W - 2, 1);
}

function torch(scene: Phaser.Scene, tx: number, ty: number) {
  const x = (tx + 0.5) * TILE_SIZE;
  const bottom = (ty + 1) * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x, bottom).setDepth(bottom);
  g.fillStyle(0x000000, 0.3).fillEllipse(0, -1, 10, 3);
  g.fillStyle(0x6f695e).fillRect(-3, -3, 6, 3);
  g.fillStyle(0x4a2e16).fillRect(-1, -20, 3, 18);
  g.fillStyle(0x2a2a30).fillRect(-3, -22, 7, 3);
  // The flame is lit with the lamps at dusk and put out at dawn.
  const flame = scene.add
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
  addGlow(scene, flame, 1, 0.1);
  const glow = scene.add.circle(x + 0.5, bottom - 24, 20, 0xff9a3c, 0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(bottom + 0.1);
  addGlow(scene, glow, 0.18, 0.4);
  addLight(scene, x + 0.5, bottom - 20, 62, 0xffa850, 0.08);
}

// ---- Harbour ------------------------------------------------------------------------

/** Posts standing in the water along both sides of the deck, and its shadow. Under characters. */
function pier(scene: Phaser.Scene, p: Extract<Decor, { kind: "pier" }>) {
  const W = p.w * TILE_SIZE;
  const H = p.h * TILE_SIZE;
  const x0 = p.tx * TILE_SIZE;
  const y0 = p.ty * TILE_SIZE;
  const g = scene.add.graphics().setPosition(x0, y0).setDepth(y0 - 1);
  g.fillStyle(0x000000, 0.28).fillRect(2, H, W, 5).fillRect(W, 4, 4, H);
  g.fillStyle(0x4a2e16).fillRect(-1, 0, 1, H).fillRect(W, 0, 1, H).fillRect(-1, H - 1, W + 2, 2);
  const posts: [number, number][] = [];
  for (let y = 6; y < H; y += 24) posts.push([-2, y], [W - 2, y]);
  for (let x = 6; x < W - 4; x += 24) posts.push([x, H - 2]);
  for (const [x, y] of posts) {
    g.fillStyle(0x2a1a0e).fillRect(x, y, 4, 7);
    g.fillStyle(0x6b4423).fillRect(x + 1, y, 2, 5);
    g.fillStyle(0xd0ecff, 0.6).fillRect(x - 1, y + 6, 6, 1);
  }
}

function ship(scene: Phaser.Scene, s: Extract<Decor, { kind: "ship" }>) {
  const W = s.w * TILE_SIZE;
  const H = s.h * TILE_SIZE;
  const x0 = s.tx * TILE_SIZE;
  const bottom = (s.ty + s.h) * TILE_SIZE;
  const ship = scene.add.container(x0, bottom).setDepth(bottom);
  const g = scene.add.graphics();
  ship.add(g);
  const deckTop = -H + 6;
  const deckBottom = -30;

  g.fillStyle(0x0f2a4a, 0.45).fillEllipse(W / 2 - 4, -4, W + 6, 14);
  // Deck seen from above, bow pointing east.
  g.fillStyle(0x8a5a2b).fillPoints(
    [
      new Phaser.Math.Vector2(6, deckTop),
      new Phaser.Math.Vector2(W - 34, deckTop),
      new Phaser.Math.Vector2(W, (deckTop + deckBottom) / 2),
      new Phaser.Math.Vector2(W - 34, deckBottom),
      new Phaser.Math.Vector2(6, deckBottom),
    ],
    true,
  );
  for (let y = deckTop + 5; y < deckBottom; y += 5) g.fillStyle(0x6b4423).fillRect(8, y, W - 46, 1);
  g.fillStyle(0xb07b48).fillRect(8, deckTop + 2, W - 46, 1);
  // Hull side facing us: dark planks, a red stripe, the waterline.
  g.fillStyle(0x4a2e16).fillPoints(
    [
      new Phaser.Math.Vector2(6, deckBottom),
      new Phaser.Math.Vector2(W - 34, deckBottom),
      new Phaser.Math.Vector2(W, (deckTop + deckBottom) / 2),
      new Phaser.Math.Vector2(W - 22, -6),
      new Phaser.Math.Vector2(14, -6),
      new Phaser.Math.Vector2(4, -18),
    ],
    true,
  );
  g.fillStyle(0x9c2a2a).fillRect(8, deckBottom + 4, W - 46, 3);
  g.fillStyle(0x3b2414).fillRect(10, deckBottom + 12, W - 44, 1).fillRect(12, deckBottom + 18, W - 46, 1);
  for (let x = 22; x < W - 50; x += 18) g.fillStyle(0x1a1410).fillCircle(x, deckBottom + 10, 2);
  g.fillStyle(0xd0ecff, 0.7).fillRect(14, -7, W - 36, 1);
  // Stern cabin with a lit window.
  g.fillStyle(0x6b4423).fillRect(8, deckTop - 6, 26, deckBottom - deckTop + 2);
  g.fillStyle(0x4a2e16).fillRect(8, deckTop - 8, 26, 3);
  g.fillStyle(0xf5d77a).fillRect(14, deckBottom - 10, 5, 4).fillRect(24, deckBottom - 10, 5, 4);
  // Two masts with full sails and a pennant.
  for (const [mx, mh] of [[W * 0.42, 74], [W * 0.68, 64]] as const) {
    const base = (deckTop + deckBottom) / 2;
    g.fillStyle(0x3b2414).fillRect(mx - 1, base - mh, 3, mh);
    g.fillStyle(0x5b3a1e).fillRect(mx - 16, base - mh + 8, 33, 2).fillRect(mx - 14, base - mh + 40, 29, 2);
    g.fillStyle(0xeee6d0).fillPoints(
      [
        new Phaser.Math.Vector2(mx - 15, base - mh + 10),
        new Phaser.Math.Vector2(mx + 16, base - mh + 10),
        new Phaser.Math.Vector2(mx + 18, base - mh + 40),
        new Phaser.Math.Vector2(mx - 13, base - mh + 40),
      ],
      true,
    );
    g.fillStyle(0xc9bfa4).fillRect(mx + 8, base - mh + 11, 8, 29);
    g.fillStyle(0x9c2a2a).fillRect(mx - 15, base - mh + 22, 31, 4);
    g.fillStyle(0x9c2a2a).fillTriangle(mx + 1, base - mh - 6, mx + 1, base - mh, mx + 12, base - mh - 3);
  }
  // Bowsprit.
  g.lineStyle(2, 0x3b2414).lineBetween(W - 6, (deckTop + deckBottom) / 2, W + 14, (deckTop + deckBottom) / 2 - 10);
  scene.tweens.add({ targets: ship, y: bottom + 1.5, angle: 0.4, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}

function lighthouse(scene: Phaser.Scene, l: Extract<Decor, { kind: "lighthouse" }>) {
  const W = l.w * TILE_SIZE;
  const x0 = l.tx * TILE_SIZE;
  const bottom = (l.ty + l.h) * TILE_SIZE;
  const cx = W / 2;
  const g = scene.add.graphics().setPosition(x0, bottom).setDepth(bottom);
  // Rocks.
  for (const [rx, ry, rw, rh, c] of [
    [cx - 14, -6, 22, 12, 0x5e584f],
    [cx + 10, -5, 18, 10, 0x6f695e],
    [cx - 2, -10, 30, 14, 0x7d766a],
    [cx - 20, -3, 14, 8, 0x6f695e],
  ] as const) {
    g.fillStyle(c).fillEllipse(rx, ry, rw, rh);
    g.fillStyle(0x958e81).fillEllipse(rx - 2, ry - 3, rw / 2, 2);
  }
  // Tapered tower in red and white bands.
  const baseW = 26;
  const topW = 18;
  const towerH = 76;
  const towerTop = -10 - towerH;
  for (let i = 0; i < 6; i++) {
    const y1 = -10 - (towerH / 6) * i;
    const y2 = y1 - towerH / 6;
    const w1 = baseW - ((baseW - topW) * i) / 6;
    const w2 = baseW - ((baseW - topW) * (i + 1)) / 6;
    g.fillStyle(i % 2 === 0 ? 0xf2efe6 : 0xc92a2a).fillPoints(
      [new Phaser.Math.Vector2(cx - w1 / 2, y1), new Phaser.Math.Vector2(cx + w1 / 2, y1), new Phaser.Math.Vector2(cx + w2 / 2, y2), new Phaser.Math.Vector2(cx - w2 / 2, y2)],
      true,
    );
  }
  g.fillStyle(0x000000, 0.18).fillRect(cx + 3, towerTop, 6, towerH);
  g.fillStyle(0x3b2414).fillRect(cx - 3, -22, 6, 10);
  g.fillStyle(0x1a1714).fillRect(cx - 1, -48, 3, 5);
  // Gallery, lantern room and cap.
  g.fillStyle(0x2a2a30).fillRect(cx - 13, towerTop - 2, 26, 3);
  g.fillStyle(0x3a3a40).fillRect(cx - 7, towerTop - 15, 14, 13);
  g.fillStyle(0xfff3c4).fillRect(cx - 5, towerTop - 13, 10, 9);
  g.fillStyle(0x9c2a2a).fillTriangle(cx - 9, towerTop - 15, cx + 9, towerTop - 15, cx, towerTop - 25);
  const lampY = bottom + towerTop - 8;
  const glow = scene.add.circle(x0 + cx, lampY, 18, 0xffe08a, 0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(bottom + 0.1);
  scene.tweens.add({ targets: glow, alpha: 0.12, scale: 0.8, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  addLight(scene, x0 + cx, lampY, 90, 0xfff0b0, 0.02);
  // The sweeping beam.
  const beam = scene.add.graphics().setPosition(x0 + cx, lampY).setDepth(bottom + 0.2).setBlendMode(Phaser.BlendModes.ADD);
  beam.fillStyle(0xfff3c4, 0.16).fillTriangle(0, 0, 150, -16, 150, 16);
  scene.tweens.add({ targets: beam, angle: 360, duration: 7000, repeat: -1 });
}

// ---- Colosseum (the Blood Arena) ------------------------------------------------------
// Painted pixel by pixel from the same rings the map is built from (COLOSSEUM): the marble
// podium wall around the sand, seven tiers of stone stands with aisles and tunnel mouths,
// the emperor's box in the north, the outer wall's top and, along the south, the arcaded
// facade seen from outside. The crowd lives on two frames that swap so it seems to cheer.

const COLOSSEUM_FACADE = 30;
const COLOSSEUM_TIERS = 7;

function colosseum(scene: Phaser.Scene) {
  const { cx, cy, rx, ry, floor, podium, wall } = COLOSSEUM;
  const T = TILE_SIZE;
  const ox = (cx - rx - 1) * T;
  const oy = (cy - ry - 1) * T;
  const W = (rx * 2 + 2) * T;
  const H = (ry * 2 + 2) * T + COLOSSEUM_FACADE;
  const cxP = cx * T;
  const cyP = cy * T;
  const RX = rx * T;
  const RY = ry * T;
  const ring = (x: number, y: number) => Math.hypot((x - cxP) / RX, (y - cyP) / RY);
  const angleOf = (x: number, y: number) => Math.atan2((y - cyP) / RY, (x - cxP) / RX);
  const aisles = 12;
  /** Within `width` pixels (along the ring at `k`) of one of `count` evenly spaced angles. */
  const nearAngle = (a: number, count: number, offset: number, width: number, k: number) => {
    const step = (Math.PI * 2) / count;
    const d = Math.abs(((((a - offset) % step) + step * 1.5) % step) - step / 2);
    return d * k * ((RX + RY) / 2) < width;
  };
  // The emperor's box, over the north stands.
  const box = { x0: cxP - 44, x1: cxP + 44, y0: cyP - RY * wall + 6, y1: cyP - RY * podium - 4 };
  const inBox = (x: number, y: number) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;

  const base = scene.textures.createCanvas("colosseum-base", W, H)!;
  const ctx = base.context;
  const img = ctx.createImageData(W, H);
  const put = (px: number, py: number, color: number) => {
    const i = (py * W + px) * 4;
    img.data[i] = (color >> 16) & 255;
    img.data[i + 1] = (color >> 8) & 255;
    img.data[i + 2] = color & 255;
    img.data[i + 3] = 255;
  };

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = ox + px + 0.5;
      const y = oy + py + 0.5;
      const k = ring(x, y);
      const dx = (x - cxP) / RX;
      if (k < floor) {
        // The north podium wall's face, seen across the sand.
        if (y < cyP && Math.abs(dx) < floor) {
          const edge = cyP - RY * floor * Math.sqrt(1 - (dx / floor) ** 2);
          const d = y - edge;
          if (d > 0 && d <= 9) put(px, py, d <= 1 ? 0xc45a4a : d >= 8 ? 0x2a0e0c : Math.round(d) === 5 ? 0xe8c33a : 0x7a2420);
        }
        continue;
      }
      if (k < podium) {
        const outer = (k - floor) / (podium - floor);
        put(px, py, outer > 0.75 ? 0xc45a4a : outer < 0.2 ? 0x4a1410 : 0x8b2a24);
        continue;
      }
      if (k < wall) {
        const a = angleOf(x, y);
        const s = (k - podium) / (wall - podium);
        const tier = Math.floor(s * COLOSSEUM_TIERS);
        const f = s * COLOSSEUM_TIERS - tier;
        if (nearAngle(a, 8, Math.PI / 8, 5, k) && s > 0.4 && s < 0.6) put(px, py, 0x1a1410);
        else if (nearAngle(a, aisles, 0, 2.5, k)) put(px, py, f < 0.3 ? 0x8a8478 : 0xc4bdb0);
        else put(px, py, f < 0.22 ? 0x5e584f : tier % 2 ? 0x958f83 : 0xa39d90);
        continue;
      }
      if (k < 1) {
        // The top of the outer wall, with posts for the awning ropes along its outer edge.
        const post = k > 0.975 && nearAngle(angleOf(x, y), 64, 0, 1.6, k);
        put(px, py, post ? 0x6f695e : k > 0.99 ? 0x8a8478 : 0xc4bdb0);
        continue;
      }
      // South facade: two storeys of arches below the outer wall's edge.
      if (y > cyP && Math.abs(dx) < 1) {
        const edge = cyP + RY * Math.sqrt(1 - dx * dx);
        const d = y - edge;
        if (d <= 0 || d > COLOSSEUM_FACADE) continue;
        const u = (((x - cxP) % 22) + 22) % 22;
        const archLow = d > 15 && d < 29 && u > 5 && u < 17 && (d > 19 || Math.hypot(u - 11, d - 19) < 6);
        const archHigh = d > 3 && d < 13 && u > 7 && u < 15 && (d > 6 || Math.hypot(u - 11, d - 6) < 4);
        if (archLow || archHigh) put(px, py, d > 26 || d < 5 ? 0x1a1410 : 0x2a2420);
        else if (d >= COLOSSEUM_FACADE - 1) put(px, py, 0x3a3631);
        else if (Math.floor(d) % 7 === 0 || Math.floor(d) === 14) put(px, py, 0x6f695e);
        else put(px, py, u < 2 || u > 20 ? 0xb3ac9c : 0xa39d90);
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  // The emperor's box: a red and gold balcony under a striped awning, with the throne.
  const bx = box.x0 - ox;
  const by = box.y0 - oy;
  const bw = box.x1 - box.x0;
  const bh = box.y1 - box.y0;
  ctx.fillStyle = "#4a1410";
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = "#6b1f1a";
  ctx.fillRect(bx + 4, by + 16, bw - 8, bh - 24);
  ctx.fillStyle = "#e8c33a";
  ctx.fillRect(bx, by + bh - 6, bw, 3);
  for (let x = bx + 2; x < bx + bw - 2; x += 5) ctx.fillRect(x, by + bh - 10, 1, 4);
  for (const x of [bx + 2, bx + bw - 5]) ctx.fillRect(x, by + 6, 3, bh - 6);
  for (let i = 0; i < bw; i += 8) {
    ctx.fillStyle = (i / 8) % 2 ? "#f1ece0" : "#b02020";
    ctx.fillRect(bx + i, by, Math.min(8, bw - i), 12);
    ctx.beginPath();
    ctx.moveTo(bx + i, by + 12);
    ctx.lineTo(bx + i + 8, by + 12);
    ctx.lineTo(bx + i + 4, by + 16);
    ctx.fill();
  }
  ctx.fillStyle = "#e8c33a";
  ctx.fillRect(bx + bw / 2 - 6, by + 18, 12, 12);
  ctx.fillStyle = "#9c1a1a";
  ctx.fillRect(bx + bw / 2 - 4, by + 20, 8, 8);
  base.refresh();
  scene.add.image(ox, oy, "colosseum-base").setOrigin(0, 0).setDepth(-0.6);

  // The crowd: a spectator every few pixels along each tier; in frame 1 some are on their feet.
  const shirts = [0xc92a2a, 0x3b5bdb, 0x2f9e44, 0xe0a83f, 0x9b5bd9, 0xe8e2d4, 0x8a5a2b, 0x3fc2c2, 0xd95ba6];
  const skins = [0xf0c49a, 0xd8a47a, 0xc68a5a, 0x9a6440];
  const hairs = [0x2d2d2d, 0x5a3825, 0x8b4513, 0xc8a165, 0xb8b8b8];
  const css = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
  const frames = [0, 1].map((f) => scene.textures.createCanvas(`colosseum-crowd-${f}`, W, H)!);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let tier = 0; tier < COLOSSEUM_TIERS; tier++) {
    const k = podium + ((tier + 0.62) / COLOSSEUM_TIERS) * (wall - podium);
    const count = Math.floor((Math.PI * 2 * k * ((RX + RY) / 2)) / 5);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + tier * 0.11;
      const x = Math.round(cxP + Math.cos(a) * RX * k);
      const y = Math.round(cyP + Math.sin(a) * RY * k);
      const empty = rnd() < 0.12;
      const shirt = shirts[Math.floor(rnd() * shirts.length)];
      const skin = skins[Math.floor(rnd() * skins.length)];
      const hair = hairs[Math.floor(rnd() * hairs.length)];
      const cheering = rnd() < 0.4;
      if (empty || nearAngle(a, aisles, 0, 4, k) || (nearAngle(a, 8, Math.PI / 8, 7, k) && tier >= 2 && tier <= 4) || inBox(x, y)) continue;
      // South of the centre they face north: we see the backs of their heads.
      const head = y > cyP ? hair : skin;
      frames.forEach((frame, f) => {
        const c = frame.context;
        const lift = f === 1 && cheering ? 1 : 0;
        const px = x - ox - 1;
        const py = y - oy - 3 - lift;
        c.fillStyle = css(shirt);
        c.fillRect(px, py + 2, 3, 2);
        c.fillStyle = css(head);
        c.fillRect(px + 1, py, 2, 2);
        if (lift) {
          c.fillStyle = css(skin);
          c.fillRect(px - 1, py - 1, 1, 2);
          c.fillRect(px + 3, py - 1, 1, 2);
        }
      });
    }
  }
  frames.forEach((frame) => frame.refresh());
  const crowd = [0, 1].map((f) => scene.add.image(ox, oy, `colosseum-crowd-${f}`).setOrigin(0, 0).setDepth(-0.55).setVisible(f === 0));
  let shown = 0;
  scene.time.addEvent({
    delay: 420,
    loop: true,
    callback: () => {
      shown = 1 - shown;
      crowd.forEach((image, f) => image.setVisible(f === shown));
    },
  });
}

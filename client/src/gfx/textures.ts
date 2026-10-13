import Phaser from "phaser";
import { ITEMS, mulberry32, Tile, TILE_COUNT, TILE_SIZE, type Appearance } from "../../../shared/src";
import { ensureImageAnims, IMAGE_SPRITES, imageTextureKey } from "./imageSprites";
import { humanoidFrames } from "./humanoid";
import { tileArt, tileArtResolution } from "./tileArt";
import { buildTileset } from "./tilePainter";

// Placeholder pixel art drawn in code, so we need no asset files yet.
// Swap these for real sprite sheets later; callers only see texture/animation keys.

export const TILESET_KEY = "tiles";

export { renderTiles, tileBaseColor, TOWN_WALL_FACE_TILE, WALL_FACE_TILE, WOOD_WALL_FACE_TILE } from "./tilePainter";

/**
 * The ground of a scene: a tilemap layer of `tiles` (renderTiles indexes). With uploaded tile
 * art bigger than TILE_SIZE the tileset is that many pixels per tile and the layer is scaled
 * down, so the map keeps its world size.
 */
export function createGroundLayer(scene: Phaser.Scene, tiles: number[][]) {
  createTileset(scene);
  const size = TILE_SIZE * tileArtResolution();
  const tilemap = scene.make.tilemap({ data: tiles, tileWidth: size, tileHeight: size });
  const layer = tilemap.createLayer(0, tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, size, size, 0, 0)!, 0, 0)!;
  return layer.setScale(TILE_SIZE / size).setDepth(-1);
}

export function createTileset(scene: Phaser.Scene) {
  if (scene.textures.exists(TILESET_KEY)) return;
  scene.textures.addCanvas(TILESET_KEY, buildTileset(tileArt, tileArtResolution()));
}

// ---- Sprite templates ------------------------------------------------------
// Each string is a pixel row. Letters map to palette colours, '.' is transparent.
// Common legend: k outline, e eye. Humanoid templates live in humanoid.ts (hair styles, gender).
// Worn armour recolours their layers (see humanoidPixel).
// Wolf/slime: f body, d body shade, w highlight.

/** Faces right. Frame 0 idle, 1 stride. */
const WOLF_BODY = [
  "............k.k.",
  "...........kfkfk",
  "..........kffffk",
  "kk.......kfffefk",
  ".kfkkkkkkffffffk",
  "..kffffffffffkkk",
  "..kfffffffffffk.",
  "..kddddddddddk..",
];
const WOLF_FRAMES: string[][] = [
  [...WOLF_BODY, "..kfkkfk..kfkfk.", "..kfkkfk..kfkfk.", "..kk.kk...kk.kk."],
  [...WOLF_BODY, "..kfk.kfk.kfk...", ".kfk...kfkfk....", ".kk.....kkkk...."],
];

const SLIME_FRAMES: string[][] = [
  [
    "............",
    "............",
    "....kkkk....",
    "...kffffk...",
    "..kfwfffffk.",
    ".kfwffffffk.",
    ".kffeffeffk.",
    ".kffffffffk.",
    ".kdffffffdk.",
    "..kkkkkkkk..",
  ],
  [
    "............",
    "............",
    "............",
    "....kkkk....",
    "..kkffffkk..",
    ".kfwfffffffk",
    "kfffeffefffk",
    "kffffffffffk",
    "kdffffffffdk",
    ".kkkkkkkkkk.",
  ],
];

const CHEST_FRAMES: string[][] = [
  [
    "..kkkkkkkk..",
    ".kddddddddk.",
    ".kmmmmmmmmk.",
    "kkkkkggkkkkk",
    "kmmmmggmmmmk",
    "kmmmmmmmmmmk",
    "kddddddddddk",
    "kkkkkkkkkkkk",
  ],
];

const CAVE_ENTRANCE_FRAMES: string[][] = [
  [
    "....kkkkkkkk....",
    "..kkrrrrrrrrkk..",
    ".krrlrrrrrrlrrk.",
    ".krrkkkkkkkkrrk.",
    "krrkxxxxxxxxkrrk",
    "krkxxxxxxxxxxkrk",
    "krkxxxxxxxxxxkrk",
    "krkxxxxxxxxxxkrk",
    "krkxxxxxxxxxxkrk",
    "krkxxxxxxxxxxkrk",
    "krkxxxxxxxxxxkrk",
    "kkkxxxxxxxxxxkkk",
  ],
];

const EXIT_PORTAL_A = [
  "....kkkk....",
  "..kkbbbbkk..",
  ".kbbccccbbk.",
  ".kbcwwwwcbk.",
  "kbcwccccwcbk",
  "kbcwcwwcwcbk",
  "kbcwcwwcwcbk",
  "kbcwccccwcbk",
  ".kbcwwwwcbk.",
  ".kbbccccbbk.",
  "..kkbbbbkk..",
  "....kkkk....",
];
/** Second frame swaps the two blues so the portal shimmers. */
const EXIT_PORTAL_FRAMES: string[][] = [EXIT_PORTAL_A, EXIT_PORTAL_A.map((row) => row.replace(/[bc]/g, (c) => (c === "b" ? "c" : "b")))];

/** Swirling energy inside the teleport gate; the second frame scrolls it upwards. */
const GATE_ENERGY = [
  "bccccccb",
  "bcwccwcb",
  "bccwcccb",
  "bcccwccb",
  "bcwcccwb",
  "bccccwcb",
  "bwcccccb",
  "bccwcccb",
  "bcccwccb",
  "bwccccwb",
  "bccwcccb",
  "bcccccwb",
  "bcwccccb",
  "bccccwcb",
];
const gateFrame = (shift: number) => [
  "....kkkkkkkk....",
  "..kkllllllllkk..",
  ".kllkkkkkkkkllk.",
  "kllk" + "bbbbbbbb" + "kllk",
  ...GATE_ENERGY.map((_, i) => "kslk" + GATE_ENERGY[(i + shift) % GATE_ENERGY.length] + "klsk"),
  "kssk" + "bbbbbbbb" + "kssk",
  "kkkk" + "........" + "kkkk",
];
/** Stone arch with energy inside: walk into it to teleport. */
const GATE_FRAMES: string[][] = [gateFrame(0), gateFrame(3)];

export const HumanoidFrame = { Down: 0, Up: 3, Side: 6 } as const;

export interface SpriteSet {
  key: string;
  appearance: Appearance;
  /** Pixel height of a frame, used to place health bars and names above the head. */
  height: number;
}

function css(color: number, factor = 1): string {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((color & 0xff) * factor));
  return `rgb(${r},${g},${b})`;
}

function paletteFor(appearance: Appearance): Record<string, string> {
  switch (appearance.type) {
    case "humanoid": {
      const skin = css(appearance.skin ?? 0xf0c49a);
      return {
        k: "#1a1420",
        e: "#1a1420",
        h: css(appearance.hair ?? 0x5a3825),
        s: skin,
        S: skin,
        r: css(appearance.skin ?? 0xf0c49a, 0.78),
        t: css(appearance.tunic),
        d: css(appearance.tunic, 0.65),
        p: "#4a3b2c",
        // Players without boots are barefoot; NPCs and mobs (no gear info) keep their default boots.
        b: appearance.gear ? skin : "#3b2a20",
      };
    }
    case "wolf":
      return { k: "#1a1420", e: "#e8c33a", f: css(appearance.fur), d: css(appearance.fur, 0.7) };
    case "slime":
      return {
        k: css(appearance.color, 0.35),
        e: "#1a1420",
        f: css(appearance.color),
        d: css(appearance.color, 0.7),
        w: css(appearance.color, 1.5),
      };
    case "chest":
      return { k: "#2a1a10", d: "#5c3a1c", m: "#8b5a2b", g: "#e8c33a" };
    case "portal":
      if (appearance.style === "cave") return { k: "#2a2420", r: "#6b6157", l: "#8a8073", x: "#050405" };
      if (appearance.style === "cursed") return { k: "#3a1a05", b: "#d2691e", c: "#ffb347", w: "#fff3d0" };
      if (appearance.style === "pvp") return { k: "#3a0508", b: "#c92a2a", c: "#ff6b6b", w: "#ffe3e3" };
      if (appearance.style === "gate") return { k: "#1a1a24", s: "#5c5f6b", l: "#8a8d99", b: "#3b2a8f", c: "#6f5bd9", w: "#c8f0ff" };
      return { k: "#0b1f3a", b: "#2f7fe0", c: "#7fd8ff", w: "#ffffff" };
    case "image":
      return {};
  }
}

function framesFor(appearance: Appearance): string[][] {
  if (appearance.type === "humanoid") return humanoidFrames(appearance.gender, appearance.hairStyle);
  if (appearance.type === "wolf") return WOLF_FRAMES;
  if (appearance.type === "chest") return CHEST_FRAMES;
  if (appearance.type === "portal") {
    if (appearance.style === "cave") return CAVE_ENTRANCE_FRAMES;
    return appearance.style === "gate" ? GATE_FRAMES : EXIT_PORTAL_FRAMES;
  }
  if (appearance.type === "image") return [];
  return SLIME_FRAMES;
}

/** Colour of one humanoid pixel once worn armour is applied, or undefined to keep the base palette. */
function humanoidPixel(appearance: Appearance & { type: "humanoid" }, char: string, x: number, y: number): string | undefined {
  const gear = appearance.gear;
  if (!gear) return undefined;
  const item = (id?: string) => (id ? ITEMS[id] : undefined);

  const head = item(gear.head);
  // A bald scalp ("S") is covered like hair.
  const hairLayer = char === "h" || char === "S";
  // Helmet covers the hair on the top of the head; the lowest covered row is the rim.
  if (head && hairLayer && y <= 3) {
    const shine = head.look === "plate" && y === 1 && x % 3 === 0;
    return css(head.icon.color, shine ? 1.5 : y === 3 ? 0.7 : y === 0 ? 1.2 : 1);
  }
  // No helmet: class headwear. Wizard hat = top of the head with a band; hood = all the hair.
  const headwear = !head ? appearance.headwear : undefined;
  if (headwear && hairLayer) {
    if (headwear.style === "hat" && y <= 3) return css(headwear.color, y === 3 ? 0.55 : y === 0 ? 1.3 : 1);
    if (headwear.style === "hood") return css(headwear.color, y >= 4 ? 0.85 : 1);
  }
  if (headwear?.style === "hat" && char === "k" && y === 0 && (x === 5 || x === 6)) return css(headwear.color, 1.3); // pointed tip
  const chest = item(gear.chest);
  if (chest && (char === "t" || char === "d")) {
    // Chain mail gets a checker pattern so it reads as rings rather than cloth.
    const ringShade = chest.look === "mail" && (x + y) % 2 === 0 ? 0.8 : 1;
    return css(chest.icon.color, (char === "d" ? 0.65 : 1) * ringShade);
  }
  const legs = item(gear.legs);
  if (legs && char === "p") return css(legs.icon.color, x % 4 === 3 ? 0.75 : 1);
  const feet = item(gear.feet);
  if (feet && char === "b") return css(feet.icon.color, y === 15 ? 0.6 : 1);
  return undefined;
}

export function frameSize(appearance: Appearance) {
  const frames = framesFor(appearance);
  return { width: frames[0][0].length, height: frames[0].length, count: frames.length };
}

/** Paints one animation frame at (ox, oy). Used for Phaser textures and the inventory character preview. */
export function paintFrame(ctx: CanvasRenderingContext2D, appearance: Appearance, frame: number, ox: number, oy: number) {
  const palette = paletteFor(appearance);
  framesFor(appearance)[frame].forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const char = row[x];
      const color = (appearance.type === "humanoid" ? humanoidPixel(appearance, char, x, y) : undefined) ?? palette[char];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}

/** Builds (once) the texture and animations for an appearance and returns their keys. */
export function ensureSpriteSet(scene: Phaser.Scene, appearance: Appearance): SpriteSet {
  if (appearance.type === "image") {
    // Loaded in preload(); only the animations need creating.
    ensureImageAnims(scene, appearance.key);
    return { key: imageTextureKey(appearance.key), appearance, height: IMAGE_SPRITES[appearance.key].meta.frameHeight };
  }
  const key = `sprite-${JSON.stringify(appearance)}`;
  const { width, height, count } = frameSize(appearance);
  const set = { key, appearance, height };
  if (scene.textures.exists(key)) return set;

  const texture = scene.textures.createCanvas(key, width * count, height)!;
  for (let frame = 0; frame < count; frame++) {
    paintFrame(texture.context, appearance, frame, frame * width, 0);
    texture.add(frame, 0, frame * width, 0, width, height);
  }
  texture.refresh();

  const anim = (name: string, frameIds: number[], frameRate: number) =>
    scene.anims.create({ key: `${key}-${name}`, frames: frameIds.map((frame) => ({ key, frame })), frameRate, repeat: -1 });

  if (appearance.type === "humanoid") {
    const walk = (first: number) => [first, first + 1, first, first + 2];
    anim("down", walk(HumanoidFrame.Down), 8);
    anim("up", walk(HumanoidFrame.Up), 8);
    anim("side", walk(HumanoidFrame.Side), 8);
  } else if (appearance.type === "wolf") {
    anim("side", [0, 1], 8);
  } else if (appearance.type === "slime") {
    anim("idle", [0, 1], 3);
  } else if (appearance.type === "portal" && appearance.style !== "cave") {
    anim("idle", [0, 1], 4);
  }
  return set;
}

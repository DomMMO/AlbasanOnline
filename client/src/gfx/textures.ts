import Phaser from "phaser";
import { ITEMS, mulberry32, Tile, TILE_COUNT, TILE_SIZE, type Appearance } from "../../../shared/src";
import { ensureImageAnims, IMAGE_SPRITES, imageTextureKey } from "./imageSprites";

// Placeholder pixel art drawn in code, so we need no asset files yet.
// Swap these for real sprite sheets later; callers only see texture/animation keys.

export const TILESET_KEY = "tiles";

/**
 * Render-only tile: a cave wall with floor below it, i.e. the rock face the camera
 * looks at. Collision still treats it as Tile.CaveWall.
 */
export const WALL_FACE_TILE = TILE_COUNT;
/** Render-only tile: the front face of the town wall. */
export const TOWN_WALL_FACE_TILE = TILE_COUNT + 1;
const RENDER_TILE_COUNT = TILE_COUNT + 2;

/** Tile indexes to draw for a map (adds wall faces, hides blockers under decor). */
export function renderTiles(tiles: Tile[][]): number[][] {
  return tiles.map((row, y) =>
    row.map((tile, x) => {
      if (tile === Tile.CaveWall && tiles[y + 1]?.[x] === Tile.CaveFloor) return WALL_FACE_TILE;
      if (tile === Tile.Wall && tiles[y + 1]?.[x] !== undefined && tiles[y + 1][x] !== Tile.Wall) return TOWN_WALL_FACE_TILE;
      // Under buildings, lamps and the fountain: draw whatever ground surrounds it.
      if (tile === Tile.Solid) return groundAround(tiles, x, y);
      return tile;
    }),
  );
}

function groundAround(tiles: Tile[][], x: number, y: number): Tile {
  // The market fence stands on the market's bricks, corners included.
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tiles[y + dy]?.[x + dx] === Tile.Market) return Tile.Market;
  for (let r = 1; r < 6; r++) {
    for (const [dx, dy] of [[0, r], [-r, 0], [r, 0], [0, -r]]) {
      const t = tiles[y + dy]?.[x + dx];
      if (t === Tile.Cobble || t === Tile.Plaza || t === Tile.Market || t === Tile.Grass || t === Tile.Path || t === Tile.DarkGrass) return t;
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
};
/** A tile's main colour (the minimap paints one pixel of it per tile). */
export function tileBaseColor(tile: Tile): string {
  return TILE_COLORS[tile].base;
}

const WALL_FACE_COLORS = { base: "#3b3430", speckle: ["#4a423d", "#2c2724"] };
const TOWN_WALL_FACE_COLORS = { base: "#6b655b", speckle: ["#746e64", "#625c53"] };

export function createTileset(scene: Phaser.Scene) {
  if (scene.textures.exists(TILESET_KEY)) return;
  const canvas = scene.textures.createCanvas(TILESET_KEY, TILE_SIZE * RENDER_TILE_COUNT, TILE_SIZE)!;
  const ctx = canvas.context;
  const rand = mulberry32(42);
  const px = (x: number, y: number, color: string, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  for (let t = 0; t < RENDER_TILE_COUNT; t++) {
    const ox = t * TILE_SIZE;
    const { base, speckle } = t === WALL_FACE_TILE ? WALL_FACE_COLORS : t === TOWN_WALL_FACE_TILE ? TOWN_WALL_FACE_COLORS : TILE_COLORS[t as Tile];
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
      // Rounded cobbles in offset rows, dark mortar between them.
      for (const [sx, sy, w] of [[0, 0, 5], [6, 0, 5], [12, 0, 4], [3, 5, 5], [9, 5, 6], [0, 10, 4], [5, 10, 5], [11, 10, 5]] as const) {
        px(ox + sx, sy + 4, "#5d5852", w, 1);
        px(ox + sx + w - 1, sy, "#5d5852", 1, 5);
        px(ox + sx + 1, sy + 1, "#8d867d", Math.max(1, w - 3), 1);
      }
    } else if (t === Tile.Plaza) {
      // Large square slabs.
      px(ox, 7, "#968d7c", TILE_SIZE, 1);
      px(ox + 7, 0, "#968d7c", 1, TILE_SIZE);
      px(ox, 15, "#968d7c", TILE_SIZE, 1);
      px(ox + 15, 0, "#968d7c", 1, TILE_SIZE);
      px(ox + 1, 1, "#c9c0ae", 3, 1);
      px(ox + 9, 9, "#c9c0ae", 3, 1);
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
    } else if (t === Tile.CaveFloor) {
      px(ox + 3, 11, "#5a5047", 2, 1);
      px(ox + 11, 5, "#5a5047", 1, 1);
    } else if (t === Tile.Flower) {
      for (const [fx, fy, c] of [
        [3, 4, "#f2d14a"],
        [10, 3, "#e86a8a"],
        [6, 10, "#f0f0f0"],
        [12, 12, "#f2d14a"],
      ] as const) {
        px(ox + fx, fy, c);
        px(ox + fx, fy + 1, "#2f6a28");
      }
    }
  }
  canvas.refresh();
}

// ---- Sprite templates ------------------------------------------------------
// Each string is a pixel row. Letters map to palette colours, '.' is transparent.
// Common legend: k outline, e eye. Humanoid: h hair, s skin, t tunic, d tunic shade, p trousers, b boots.
// Worn armour recolours these layers (see humanoidPixel).
// Wolf/slime: f body, d body shade, w highlight.

const HEAD_DOWN = [
  "...kkkkkk...",
  "..khhhhhhk..",
  ".khhhhhhhhk.",
  ".khsssssshk.",
  ".ksessssesk.",
  ".kssssssssk.",
  "..kssssssk..",
];
const HEAD_UP = [
  "...kkkkkk...",
  "..khhhhhhk..",
  ".khhhhhhhhk.",
  ".khhhhhhhhk.",
  ".khhhhhhhhk.",
  ".kshhhhhhsk.",
  "..kssssssk..",
];
const BODY_FRONT = [
  ".kdttttttdk.",
  "ksttttttttsk",
  "ksdttttttdsk",
  ".kdttttttdk.",
  ".kddddddddk.",
  "..kppkkppk..",
];
const LEGS_FRONT = [
  ["..kppkkppk..", "..kbbkkbbk..", "..kkk..kkk.."],
  ["..kppkkppk..", "..kkk.kbbk..", ".......kkk.."],
  ["..kppkkppk..", "..kbbk.kkk..", "..kkk......."],
];
const SIDE_HEAD_BODY = [
  "....kkkkk...",
  "...khhhhhk..",
  "..khhhhhhhk.",
  "..khhssssk..",
  "..khsssesk..",
  "..kssssssk..",
  "...kssssk...",
  "..kdttttdk..",
  "..kttttttk..",
  "..ktttsttk..",
  "..kdttttdk..",
  "..kddddddk..",
  "...kppppk...",
];
const LEGS_SIDE = [
  ["...kpppk....", "...kbbbk....", "...kkkkk...."],
  ["..kppkppk...", ".kbbk..kbbk.", ".kkk....kkk."],
  ["...kpppk....", "..kbbkbbk...", "..kkk.kkk..."],
];

/** 9 frames: down 0-2, up 3-5, side (facing right) 6-8. Frame 0 of each is idle. */
const HUMANOID_FRAMES: string[][] = [
  ...LEGS_FRONT.map((legs) => [...HEAD_DOWN, ...BODY_FRONT, ...legs]),
  ...LEGS_FRONT.map((legs) => [...HEAD_UP, ...BODY_FRONT, ...legs]),
  ...LEGS_SIDE.map((legs) => [...SIDE_HEAD_BODY, ...legs]),
];

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
  if (appearance.type === "humanoid") return HUMANOID_FRAMES;
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
  // Helmet covers the hair on the top of the head; the lowest covered row is the rim.
  if (head && char === "h" && y <= 3) {
    const shine = head.look === "plate" && y === 1 && x % 3 === 0;
    return css(head.icon.color, shine ? 1.5 : y === 3 ? 0.7 : y === 0 ? 1.2 : 1);
  }
  // No helmet: class headwear. Wizard hat = top of the head with a band; hood = all the hair.
  const headwear = !head ? appearance.headwear : undefined;
  if (headwear && char === "h") {
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

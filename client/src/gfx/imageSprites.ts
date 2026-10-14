import Phaser from "phaser";
import type { Appearance } from "../../../shared/src";

// Pre-rendered sprite sheets (art assets) as opposed to the code-drawn pixel art.
// Sheets are built from source frames by an offline script: uniform cells, the
// character's feet at (originX, originY), and named frame ranges per animation.
//
// The sheets are third-party art kept out of the repository (assets/licensed/, see
// CREDITS.md). Whatever is missing is simply absent here, and withFallback() draws that
// creature in code instead, so a fresh clone or a public build still runs.

export interface ImageSpriteMeta {
  frameWidth: number;
  frameHeight: number;
  originX: number;
  originY: number;
  anims: Record<string, number[]>;
}

interface ImageSprite {
  url: string;
  meta: ImageSpriteMeta;
  /** Frames per second per animation; animations not listed play at 10 fps. */
  fps: Record<string, number>;
  /** Animations that play once instead of looping. */
  once: string[];
}

// Mob sheets built by tools/build_sprites.py from the CraftPix packs: <key>.png + <key>.json.
const mobMetas = import.meta.glob<ImageSpriteMeta>("../assets/licensed/mobs/*.json", { eager: true, import: "default" });
const mobUrls = import.meta.glob<string>("../assets/licensed/mobs/*.png", { eager: true, query: "?url", import: "default" });
const jackMeta = import.meta.glob<ImageSpriteMeta>("../assets/licensed/bosses/jack.json", { eager: true, import: "default" });
const jackUrl = import.meta.glob<string>("../assets/licensed/bosses/jack.png", { eager: true, query: "?url", import: "default" });
const sheetKey = (path: string) => path.split("/").pop()!.replace(/\.(json|png)$/, "");
const only = <T>(found: Record<string, T>): T | undefined => Object.values(found)[0];

const jack = only(jackMeta);
const jackSheet = only(jackUrl);

export const IMAGE_SPRITES: Record<string, ImageSprite> = {
  ...(jack && jackSheet ? { jack: { url: jackSheet, meta: jack, fps: { walk: 12, run: 14, jump: 9, slide: 16, dead: 12 }, once: ["jump", "dead"] } } : {}),
  ...Object.fromEntries(
    Object.entries(mobMetas).flatMap(([path, meta]) => {
      const url = mobUrls[path.replace(/\.json$/, ".png")];
      if (!url) return [];
      const sprite: ImageSprite = { url, meta, fps: { idle: 8, walk: 14, attack: 18, hurt: 16, dead: 14 }, once: ["attack", "hurt", "dead"] };
      return [[sheetKey(path), sprite]];
    }),
  ),
};

/** Code-drawn stand-ins for each kind of sheet, used when its art isn't on this machine. */
const FALLBACK_LOOKS: [prefix: string, look: Extract<Appearance, { type: "humanoid" }>][] = [
  ["golem", { type: "humanoid", tunic: 0x6f695e, skin: 0x8a8478, hair: 0x5e584f, hairStyle: "bald" }],
  ["minotaur", { type: "humanoid", tunic: 0x5b3a1e, skin: 0x8b5a2b, hair: 0x2a1a0e, gear: { chest: "chainmail" } }],
  ["satyr", { type: "humanoid", tunic: 0x6b4423, skin: 0xc68a5a, hair: 0x3a2a1a, hairStyle: "spiky" }],
  ["wraith", { type: "humanoid", tunic: 0x3b2a5a, skin: 0x9a8fb0, hair: 0x1a1a1a, headwear: { color: 0x2b1f40, style: "hood" } }],
  ["jack", { type: "humanoid", tunic: 0x2b2b33, skin: 0xff922b, hair: 0x2f9e44, headwear: { color: 0x2f9e44, style: "hat" } }],
  ["goblin", { type: "humanoid", tunic: 0x7a5a2e, skin: 0x7cb342, hair: 0x2d2d2d }],
  ["orc", { type: "humanoid", tunic: 0x4a3a2a, skin: 0x5a7a3a, hair: 0x1a1a1a, gear: { head: "iron_helm", legs: "wolf_hide_leggings" } }],
  ["ogre", { type: "humanoid", tunic: 0x2a1a0a, skin: 0x4a6a2a, hair: 0x1a1a1a, hairStyle: "bald", gear: { legs: "wolf_hide_leggings" } }],
  ["skeleton", { type: "humanoid", tunic: 0x4a4a4a, skin: 0xe8e4d8, hair: 0xe8e4d8, hairStyle: "bald", gear: { chest: "chainmail" } }],
  ["zombie", { type: "humanoid", tunic: 0x5a5a3a, skin: 0x8a9a6a, hair: 0x3a3a2a }],
  ["oracle", { type: "humanoid", tunic: 0x212529, skin: 0xc8bfa8, hair: 0x1a1a1a, headwear: { color: 0x343a40, style: "hood" } }],
  ["knight", { type: "humanoid", tunic: 0x495057, skin: 0xd9a07a, hair: 0x1a1a1a, gear: { head: "iron_helm", chest: "chainmail" } }],
];

/** An image appearance whose sheet is missing becomes a drawn look-alike (the tint, if any, colours its clothes). */
export function withFallback(appearance: Appearance): Appearance {
  if (appearance.type !== "image" || IMAGE_SPRITES[appearance.key]) return appearance;
  const look = FALLBACK_LOOKS.find(([prefix]) => appearance.key.startsWith(prefix))?.[1] ?? { type: "humanoid" as const, tunic: 0x495057 };
  return appearance.tint === undefined ? look : { ...look, tunic: appearance.tint };
}

/** Whether a sheet has an animation of that name (e.g. "attack", "hurt"). */
export const hasImageAnim = (key: string, anim: string) => !!IMAGE_SPRITES[key]?.meta.anims[anim];

export const imageTextureKey = (key: string) => `img-${key}`;

/** Queue every sheet in a scene's preload(). */
export function preloadImageSprites(scene: Phaser.Scene) {
  for (const [key, sprite] of Object.entries(IMAGE_SPRITES)) {
    if (scene.textures.exists(imageTextureKey(key))) continue;
    scene.load.spritesheet(imageTextureKey(key), sprite.url, {
      frameWidth: sprite.meta.frameWidth,
      frameHeight: sprite.meta.frameHeight,
    });
  }
}

/** Creates the sheet's animations once (animations are global to the game). */
export function ensureImageAnims(scene: Phaser.Scene, key: string) {
  const sprite = IMAGE_SPRITES[key];
  const texture = imageTextureKey(key);
  for (const [name, frames] of Object.entries(sprite.meta.anims)) {
    const animKey = `${texture}-${name}`;
    if (scene.anims.exists(animKey)) continue;
    scene.anims.create({
      key: animKey,
      frames: frames.map((frame) => ({ key: texture, frame })),
      frameRate: sprite.fps[name] ?? 10,
      repeat: sprite.once.includes(name) ? 0 : -1,
    });
  }
}

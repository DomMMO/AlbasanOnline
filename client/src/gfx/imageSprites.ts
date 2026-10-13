import Phaser from "phaser";
import jackMeta from "../assets/bosses/jack.json";
import jackUrl from "../assets/bosses/jack.png";

// Pre-rendered sprite sheets (art assets) as opposed to the code-drawn pixel art.
// Sheets are built from source frames by an offline script: uniform cells, the
// character's feet at (originX, originY), and named frame ranges per animation.

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
const mobMetas = import.meta.glob<ImageSpriteMeta>("../assets/mobs/*.json", { eager: true, import: "default" });
const mobUrls = import.meta.glob<string>("../assets/mobs/*.png", { eager: true, query: "?url", import: "default" });
const sheetKey = (path: string) => path.split("/").pop()!.replace(/\.(json|png)$/, "");

export const IMAGE_SPRITES: Record<string, ImageSprite> = {
  jack: { url: jackUrl, meta: jackMeta, fps: { walk: 12, run: 14, jump: 9, slide: 16, dead: 12 }, once: ["jump", "dead"] },
  ...Object.fromEntries(
    Object.entries(mobMetas).map(([path, meta]) => {
      const url = mobUrls[path.replace(/\.json$/, ".png")];
      const sprite: ImageSprite = { url, meta, fps: { idle: 8, walk: 14, attack: 18, hurt: 16, dead: 14 }, once: ["attack", "hurt", "dead"] };
      return [sheetKey(path), sprite];
    }),
  ),
};

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

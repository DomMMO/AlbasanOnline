import type Phaser from "phaser";
import { TILE_ART_BY_KEY, TILE_SIZE } from "../../../shared/src";

// Art a GM uploaded in the map editor. Loaded once before the first scene: ground tiles go into
// the tileset (createTileset), castle pieces become textures the decor draws instead of its own.

export interface TileArtInfo {
  key: string;
  /** Width in pixels. */
  size: number;
  v: number;
}

/** Tileset index -> image. */
export const tileArt = new Map<number, HTMLImageElement>();
/** Castle piece (slot key) -> image. */
export const decorArt = new Map<string, HTMLImageElement>();
/** What the server listed on the last load. */
export let tileArtList: TileArtInfo[] = [];

/** Pixels per tile in the tileset: the biggest uploaded tile (1 = TILE_SIZE). */
export function tileArtResolution() {
  let res = 1;
  for (const image of tileArt.values()) res = Math.max(res, Math.round(image.naturalWidth / TILE_SIZE));
  return res;
}

export const tileArtUrl = (info: TileArtInfo) => `/api/tiles/${info.key}.png?v=${info.v}`;

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** Fetches the uploaded images (replacing what was loaded); a failure leaves the drawn ones. */
export async function loadTileArt() {
  try {
    const response = await fetch("/api/tiles");
    if (!response.ok) return;
    const list = (await response.json()) as TileArtInfo[];
    const loaded = await Promise.all(list.map(async (info) => ({ info, image: TILE_ART_BY_KEY[info.key] ? await loadImage(tileArtUrl(info)) : null })));
    tileArt.clear();
    decorArt.clear();
    for (const { info, image } of loaded) {
      const slot = TILE_ART_BY_KEY[info.key];
      if (!slot || !image) continue;
      if (slot.index !== undefined) tileArt.set(slot.index, image);
      else decorArt.set(slot.key, image);
    }
    tileArtList = list;
  } catch {
    // Offline or old server.
  }
}

/** Texture key of an uploaded castle piece, or null when the game draws its own. */
export function decorArtTexture(scene: Phaser.Scene, key: string): string | null {
  const image = decorArt.get(key);
  if (!image) return null;
  const textureKey = `art-${key}-${image.src}`;
  if (!scene.textures.exists(textureKey)) scene.textures.addImage(textureKey, image);
  return textureKey;
}

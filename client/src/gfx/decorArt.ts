import type Phaser from "phaser";

// Art decor files (data/decorArt.ts), built by tools/build_decor.py into assets/licensed/decor/.
// They are third-party art kept out of the repository: whatever is missing here is drawn as
// its code-drawn fallback by decor.ts.

const urls = import.meta.glob<string>("../assets/licensed/decor/*.png", { eager: true, query: "?url", import: "default" });
const ART_URLS: Record<string, string> = Object.fromEntries(Object.entries(urls).map(([path, url]) => [path.split("/").pop()!.replace(/\.png$/, ""), url]));

export const decorArtKey = (key: string) => `art-${key}`;

/** Queue every art decor file in a scene's preload(). */
export function preloadDecorArt(scene: Phaser.Scene) {
  for (const [key, url] of Object.entries(ART_URLS)) {
    if (!scene.textures.exists(decorArtKey(key))) scene.load.image(decorArtKey(key), url);
  }
}

// Art-asset item pictures (tools/build_sprites.py): <key>.png is the 36 px inventory icon,
// <key>_held.png the small sprite in a character's hand; items.json has each one's grip
// point (where the hand holds it, as a fraction of the held sprite). Third-party art kept
// out of the repository (assets/licensed/): without it items show their drawn icon.

const gripFiles = import.meta.glob<Record<string, { grip: number[] }>>("../assets/licensed/items/items.json", { eager: true, import: "default" });
const grips = Object.values(gripFiles)[0] ?? {};
const urls = import.meta.glob<string>("../assets/licensed/items/*.png", { eager: true, query: "?url", import: "default" });
const urlOf = (file: string) => urls[`../assets/licensed/items/${file}.png`];

export interface ItemImage {
  icon: string;
  held: string;
  grip: { x: number; y: number };
  /** Loaded at start-up so canvases (paper doll, world textures) can draw it straight away. */
  heldImage: HTMLImageElement;
}

const images = new Map<string, ItemImage>();
for (const [key, { grip }] of Object.entries(grips)) {
  const icon = urlOf(key);
  const held = urlOf(`${key}_held`);
  if (!icon || !held) continue;
  const heldImage = new Image();
  heldImage.src = held;
  images.set(key, { icon, held, grip: { x: grip[0], y: grip[1] }, heldImage });
}

export function itemImage(key: string | undefined): ItemImage | undefined {
  return key ? images.get(key) : undefined;
}

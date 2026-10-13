import grips from "../assets/items/items.json";

// Art-asset item pictures (tools/build_sprites.py): <key>.png is the 36 px inventory icon,
// <key>_held.png the small sprite in a character's hand; items.json has each one's grip
// point (where the hand holds it, as a fraction of the held sprite).

const urls = import.meta.glob<string>("../assets/items/*.png", { eager: true, query: "?url", import: "default" });
const urlOf = (file: string) => urls[`../assets/items/${file}.png`];

export interface ItemImage {
  icon: string;
  held: string;
  grip: { x: number; y: number };
  /** Loaded at start-up so canvases (paper doll, world textures) can draw it straight away. */
  heldImage: HTMLImageElement;
}

const images = new Map<string, ItemImage>();
for (const [key, { grip }] of Object.entries(grips as Record<string, { grip: number[] }>)) {
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

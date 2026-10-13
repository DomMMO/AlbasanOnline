import Phaser from "phaser";
import { Direction, type IconShape, type ItemDef } from "../../../shared/src";
import { ICON_SIZE, paintIcon } from "./icons";
import { itemImage } from "./itemImages";

// In-world item sprites (held weapons, armour falling off) reuse the inventory icon
// art. Each texture has two frames: 0 = as drawn (blade up-right), 1 = mirrored.

/** Where the hand grips an item's in-hand sprite: art assets carry their own grip point. */
export function weaponGripFor(def: ItemDef): { x: number; y: number } {
  return itemImage(def.image)?.grip ?? weaponGrip(def.icon.shape);
}

/** Where the hand grips each weapon icon (low on the handle), as a normalised origin. */
export function weaponGrip(shape: IconShape): { x: number; y: number } {
  if (shape === "axe") return { x: 7.5 / ICON_SIZE, y: 9.5 / ICON_SIZE };
  if (shape === "scythe") return { x: 6.5 / ICON_SIZE, y: 8.5 / ICON_SIZE };
  if (shape === "staff" || shape === "mace") return { x: 4.5 / ICON_SIZE, y: 8.5 / ICON_SIZE };
  return { x: 1.5 / ICON_SIZE, y: 10.5 / ICON_SIZE }; // sword: diagonal, handle bottom-left
}

/** Hand position relative to the character's feet, per facing. */
export const HAND: Record<Direction, { x: number; y: number }> = {
  [Direction.Right]: { x: 5, y: -5 },
  [Direction.Left]: { x: -5, y: -5 },
  [Direction.Down]: { x: -4, y: -5 },
  [Direction.Up]: { x: 4, y: -5 },
};

/** Facing left or down holds the blade towards the left of the screen. */
export const isWeaponMirrored = (facing: Direction) => facing === Direction.Left || facing === Direction.Down;

/** Height above the feet where each equipment piece sits on the body. */
export const BODY_PART_Y = { head: -14, chest: -9, legs: -4, feet: -1, weapon: -8, neck: -11, ring: -7, earring: -13 } as const;

export const SPARK_KEY = "spark";

export function ensureItemTexture(scene: Phaser.Scene, def: ItemDef): string {
  const key = `item-${def.id}`;
  if (scene.textures.exists(key)) return key;
  const picture = itemImage(def.image);
  if (picture?.heldImage.complete && picture.heldImage.naturalWidth > 0) {
    // Frame 0 as drawn, frame 1 mirrored, like the code-drawn icons.
    const { heldImage } = picture;
    const w = heldImage.naturalWidth;
    const h = heldImage.naturalHeight;
    const texture = scene.textures.createCanvas(key, w * 2, h)!;
    texture.context.drawImage(heldImage, 0, 0);
    texture.context.save();
    texture.context.translate(w * 2, 0);
    texture.context.scale(-1, 1);
    texture.context.drawImage(heldImage, 0, 0);
    texture.context.restore();
    texture.add(0, 0, 0, 0, w, h);
    texture.add(1, 0, w, 0, w, h);
    texture.refresh();
    return key;
  }
  const texture = scene.textures.createCanvas(key, ICON_SIZE * 2, ICON_SIZE)!;
  paintIcon(texture.context, def.icon.shape, def.icon.color, 0, false);
  paintIcon(texture.context, def.icon.shape, def.icon.color, ICON_SIZE, true);
  texture.add(0, 0, 0, 0, ICON_SIZE, ICON_SIZE);
  texture.add(1, 0, ICON_SIZE, 0, ICON_SIZE, ICON_SIZE);
  texture.refresh();
  return key;
}

/** 2x2 white pixel used by sparkle particles (tinted per particle). */
export function ensureSparkTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(SPARK_KEY)) return;
  const texture = scene.textures.createCanvas(SPARK_KEY, 2, 2)!;
  texture.context.fillStyle = "#ffffff";
  texture.context.fillRect(0, 0, 2, 2);
  texture.refresh();
}

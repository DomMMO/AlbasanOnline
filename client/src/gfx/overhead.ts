import Phaser from "phaser";

// Things shown above a character's name: the arena champion's crown and the GM tag.

export const CROWN_KEY = "crown";

const CROWN = [
  "k.....k.....k",
  "kgk..kgk..kgk",
  "kggkkgrgkkggk",
  "kglgggggggglk",
  "kgbgggrgggbgk",
  "kdgggggggggdk",
  "kdddddddddddk",
  "kkkkkkkkkkkkk",
];
const COLORS: Record<string, string> = {
  k: "#5a3a0a",
  g: "#ffd34d",
  l: "#fff3b0",
  d: "#c8961e",
  r: "#e03131",
  b: "#3b8bff",
};

/** A small gold crown with a ruby and two sapphires (13x8). */
export function ensureCrown(scene: Phaser.Scene) {
  if (scene.textures.exists(CROWN_KEY)) return;
  const texture = scene.textures.createCanvas(CROWN_KEY, CROWN[0].length, CROWN.length)!;
  CROWN.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = COLORS[row[x]];
      if (!color) continue;
      texture.context.fillStyle = color;
      texture.context.fillRect(x, y, 1, 1);
    }
  });
  texture.refresh();
}

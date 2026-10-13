import Phaser from "phaser";
import type { NodeDef } from "../../../shared/src";

// Pixel art for life skill nodes, drawn into canvas textures once per kind: a grey boulder
// with chunks of coloured ore, or a leafy plant with coloured flowers. 16x16, feet at the bottom.

const SIZE = 16;

function hex(color: number, factor = 1): string {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((color & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

function paintOre(ctx: CanvasRenderingContext2D, color: number) {
  const rows = [
    "................",
    "................",
    "................",
    ".....kkkkk......",
    "....kllrrrkk....",
    "...klrrrrrrrk...",
    "..klrroorrrrrk..",
    "..krroOorrrrrk..",
    ".klrrrorrrooork.",
    ".krrrrrrroOordk.",
    ".krrooorrrrrrdk.",
    ".krroOorrrrrddk.",
    "kdrrrorrrrrrdddk",
    "kddrrrrrrrrdddk.",
    ".kkddddddddddkk.",
    "..kkkkkkkkkkk...",
  ];
  const palette: Record<string, string> = {
    k: "#1a1410",
    l: "#9aa0a8",
    r: "#6c727a",
    d: "#4b5058",
    o: hex(color),
    O: hex(color, 1.4),
  };
  paint(ctx, rows, palette);
}

function paintHerb(ctx: CanvasRenderingContext2D, color: number) {
  const rows = [
    "................",
    "....fF....Ff....",
    "...fFf...fFf....",
    "....f..s..f.....",
    "....s..fF.s.....",
    "...gs.fFf.sg....",
    "..ggs..f..sgg...",
    "..gGgs.s.sgGg...",
    "...gGgsssgGg....",
    "..gggGgsgGggg...",
    ".ggGgggsgggGgg..",
    "..gggGgggGggg...",
    "...ggggggggg....",
    "....kkkkkkk.....",
    "................",
    "................",
  ];
  const palette: Record<string, string> = {
    k: "#2b1d12",
    g: "#2f9e44",
    G: "#69db7c",
    s: "#2b8a3e",
    f: hex(color),
    F: hex(color, 1.35),
  };
  paint(ctx, rows, palette);
}

function paint(ctx: CanvasRenderingContext2D, rows: string[], palette: Record<string, string>) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
}

/** Texture key for a node kind (created on first use). */
export function nodeTexture(scene: Phaser.Scene, def: NodeDef): string {
  const key = `node-${def.id}`;
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  if (def.look.style === "ore") paintOre(ctx, def.look.color);
  else paintHerb(ctx, def.look.color);
  scene.textures.addCanvas(key, canvas);
  return key;
}

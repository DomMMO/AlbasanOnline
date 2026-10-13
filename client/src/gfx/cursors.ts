// Mouse cursors in the game's medieval style, drawn in code: a forged iron arrow with gold
// trim by default, an armoured gauntlet pointing at things you can click, and a shape for what
// a click would do: a broadsword over enemies, a gauntlet scooping up coins over loot, a sealed
// scroll over NPCs, a rune circle over portals, a merchant's scale over market stalls.
// Each is a CSS cursor value (data URL + hotspot) for Phaser's interactive sprites and the DOM.

type Ctx = CanvasRenderingContext2D;
export type CursorKind = "default" | "pointer" | "attack" | "loot" | "talk" | "portal" | "trade" | "mine" | "gather";

const SIZE = 32;
const OUTLINE = "#140c06";
const GOLD = "#d4a53a";
const GOLD_LIGHT = "#f6dd8f";
const IRON_LIGHT = "#c3c8cf";
const IRON_DARK = "#4b5058";

function draw(paint: (ctx: Ctx) => void): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  paint(ctx);
  return canvas.toDataURL();
}

function fillStroke(ctx: Ctx, fill: string | CanvasGradient, width = 1.6) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width;
  ctx.stroke();
}

function iron(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, IRON_LIGHT);
  g.addColorStop(0.55, "#8a9099");
  g.addColorStop(1, IRON_DARK);
  return g;
}

function goldGrad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD_LIGHT);
  g.addColorStop(1, "#8a6512");
  return g;
}

function rivet(ctx: Ctx, x: number, y: number, r = 1.4) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = GOLD_LIGHT;
  ctx.fill();
}

/** Forged arrow: iron blade with a gold rim and a rivet, a little swallowtail at the back. */
function arrow(ctx: Ctx, bright = false) {
  ctx.beginPath();
  ctx.moveTo(2, 2);
  ctx.lineTo(3, 23);
  ctx.lineTo(8.5, 18);
  ctx.lineTo(12, 26);
  ctx.lineTo(14.5, 28.5);
  ctx.lineTo(17, 27);
  ctx.lineTo(16, 23.5);
  ctx.lineTo(12.5, 16.5);
  ctx.lineTo(20.5, 16);
  ctx.closePath();
  fillStroke(ctx, goldGrad(ctx, 2, 2, 20, 26), 1.6);
  ctx.beginPath();
  ctx.moveTo(4.5, 6.5);
  ctx.lineTo(5, 18.5);
  ctx.lineTo(9, 15);
  ctx.lineTo(16, 14.5);
  ctx.closePath();
  ctx.fillStyle = bright ? iron(ctx, 4, 6, 14, 18) : "#3b3f46";
  ctx.fill();
  rivet(ctx, 7.5, 12, 1.5);
}

/** Armoured gauntlet, index finger pointing up-left at the hotspot. */
function gauntletPointing(ctx: Ctx) {
  ctx.save();
  ctx.translate(3, 2);
  ctx.rotate(-0.55);
  // Index finger: three plates.
  ctx.beginPath();
  ctx.moveTo(-2.5, 1.5);
  ctx.quadraticCurveTo(0, -1.5, 2.5, 1.5);
  ctx.lineTo(2.8, 13);
  ctx.lineTo(-2.8, 13);
  ctx.closePath();
  fillStroke(ctx, iron(ctx, -3, 0, 3, 13));
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.9;
  for (const y of [5, 9]) {
    ctx.beginPath();
    ctx.moveTo(-2.6, y);
    ctx.lineTo(2.6, y);
    ctx.stroke();
  }
  // Curled fingers and back of the hand.
  ctx.beginPath();
  ctx.moveTo(-3.5, 12);
  ctx.lineTo(9.5, 12);
  ctx.quadraticCurveTo(11.5, 16, 10, 21);
  ctx.lineTo(-3.5, 22);
  ctx.quadraticCurveTo(-5, 17, -3.5, 12);
  fillStroke(ctx, iron(ctx, -4, 12, 10, 22));
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.9;
  for (const x of [3, 6.5]) {
    ctx.beginPath();
    ctx.moveTo(x, 12.5);
    ctx.lineTo(x, 15.5);
    ctx.stroke();
  }
  // Thumb.
  ctx.beginPath();
  ctx.moveTo(-3.5, 14);
  ctx.quadraticCurveTo(-8, 15, -7, 19);
  ctx.lineTo(-3.5, 19.5);
  ctx.closePath();
  fillStroke(ctx, iron(ctx, -8, 14, -3, 20));
  // Gold cuff with rivets.
  ctx.beginPath();
  ctx.moveTo(-4.5, 21.5);
  ctx.lineTo(11, 20.5);
  ctx.lineTo(12, 26);
  ctx.lineTo(-4, 27);
  ctx.closePath();
  fillStroke(ctx, goldGrad(ctx, -4, 21, 12, 27));
  for (const x of [-1, 3.5, 8]) rivet(ctx, x, 24, 1.1);
  ctx.restore();
}

/** Broadsword: steel blade with a fuller, curled gold crossguard, leather grip, round pommel. */
function broadsword(ctx: Ctx) {
  ctx.save();
  ctx.translate(2, 2);
  ctx.rotate(-Math.PI / 4);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(3.2, 4.5);
  ctx.lineTo(3.2, 23);
  ctx.lineTo(-3.2, 23);
  ctx.lineTo(-3.2, 4.5);
  ctx.closePath();
  fillStroke(ctx, iron(ctx, -3, 0, 3, 0), 1.4);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.lineTo(0, 21);
  ctx.strokeStyle = "#6c727a";
  ctx.lineWidth = 1;
  ctx.stroke();
  // Crossguard with curled ends.
  ctx.beginPath();
  ctx.moveTo(-9, 22.5);
  ctx.quadraticCurveTo(-10.5, 25.5, -7.5, 26);
  ctx.lineTo(7.5, 26);
  ctx.quadraticCurveTo(10.5, 25.5, 9, 22.5);
  ctx.closePath();
  fillStroke(ctx, goldGrad(ctx, -9, 22, 9, 26), 1.3);
  // Leather grip with wraps.
  ctx.beginPath();
  ctx.rect(-2, 26, 4, 7.5);
  fillStroke(ctx, "#6b4423", 1.2);
  ctx.strokeStyle = "#3d2614";
  ctx.lineWidth = 0.8;
  for (const y of [28, 30, 32]) {
    ctx.beginPath();
    ctx.moveTo(-2, y);
    ctx.lineTo(2, y + 1);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 35.5, 2.6, 0, Math.PI * 2);
  fillStroke(ctx, goldGrad(ctx, -2, 33, 2, 38), 1.2);
  ctx.restore();
}

/** Gauntlet reaching down to scoop up a little heap of gold coins. */
function gauntletLoot(ctx: Ctx) {
  // Coin heap first (behind the fingertips).
  const coin = (x: number, y: number) => {
    ctx.beginPath();
    ctx.ellipse(x, y, 4.6, 2.3, 0, 0, Math.PI * 2);
    fillStroke(ctx, goldGrad(ctx, x - 4, y - 2, x + 4, y + 2), 1.1);
    ctx.beginPath();
    ctx.ellipse(x, y - 0.3, 2.4, 1, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#8a6512";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  };
  coin(9, 28.5);
  coin(19, 28.5);
  coin(14, 26.5);
  coin(14, 29.5);
  // Gold cuff (top).
  ctx.beginPath();
  ctx.moveTo(8, 1.5);
  ctx.lineTo(22, 1.5);
  ctx.lineTo(23, 6.5);
  ctx.lineTo(7, 6.5);
  ctx.closePath();
  fillStroke(ctx, goldGrad(ctx, 7, 1, 23, 7));
  for (const x of [11, 15, 19]) rivet(ctx, x, 4, 1);
  // Back of the hand.
  ctx.beginPath();
  ctx.moveTo(6.5, 6.5);
  ctx.lineTo(23.5, 6.5);
  ctx.quadraticCurveTo(25.5, 11, 24, 15);
  ctx.lineTo(6, 15);
  ctx.quadraticCurveTo(4.5, 11, 6.5, 6.5);
  fillStroke(ctx, iron(ctx, 6, 6, 24, 15));
  // Four fingers curling down towards the coins, with knuckle plates.
  for (let i = 0; i < 4; i++) {
    const x = 7.5 + i * 4.3;
    ctx.beginPath();
    ctx.moveTo(x, 14.5);
    ctx.lineTo(x + 3.6, 14.5);
    ctx.lineTo(x + 3.2, 21);
    ctx.quadraticCurveTo(x + 1.8, 23.5, x + 0.4, 21);
    ctx.closePath();
    fillStroke(ctx, iron(ctx, x, 14, x + 4, 22), 1.2);
    ctx.beginPath();
    ctx.moveTo(x + 0.2, 18);
    ctx.lineTo(x + 3.4, 18);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  // Thumb.
  ctx.beginPath();
  ctx.moveTo(6.5, 9);
  ctx.quadraticCurveTo(1.5, 12, 3, 18);
  ctx.lineTo(6.5, 16.5);
  ctx.closePath();
  fillStroke(ctx, iron(ctx, 2, 9, 7, 18), 1.2);
}

/** Parchment scroll with rolled ends and a red wax seal. */
function scroll(ctx: Ctx) {
  ctx.beginPath();
  ctx.rect(6, 6, 20, 17);
  fillStroke(ctx, "#ead9b0", 1.4);
  ctx.strokeStyle = "#9c8457";
  ctx.lineWidth = 1;
  for (const y of [10.5, 14, 17.5]) {
    ctx.beginPath();
    ctx.moveTo(9, y);
    ctx.lineTo(23, y);
    ctx.stroke();
  }
  for (const y of [5, 24]) {
    ctx.beginPath();
    ctx.ellipse(16, y, 12, 2.6, 0, 0, Math.PI * 2);
    fillStroke(ctx, "#d4bf8e", 1.3);
  }
  ctx.beginPath();
  ctx.arc(22, 22, 4, 0, Math.PI * 2);
  fillStroke(ctx, "#a61e1e", 1.2);
  ctx.beginPath();
  ctx.moveTo(20, 26);
  ctx.lineTo(19, 30);
  ctx.lineTo(21.5, 28.5);
  ctx.lineTo(23, 30.5);
  ctx.lineTo(23.5, 26);
  ctx.fillStyle = "#a61e1e";
  ctx.fill();
  tip(ctx);
}

/** Standing-stone ring with glowing runes and a swirl in the middle. */
function runeCircle(ctx: Ctx) {
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  fillStroke(ctx, "#4a4a52", 1.6);
  ctx.beginPath();
  ctx.arc(16, 16, 9.5, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 10);
  g.addColorStop(0, "#f3d9fa");
  g.addColorStop(1, "#5f3dc4");
  fillStroke(ctx, g, 1.4);
  ctx.strokeStyle = "#d0bfff";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = 16 + Math.cos(a) * 11.8;
    const y = 16 + Math.sin(a) * 11.8;
    ctx.beginPath();
    ctx.moveTo(x - 1.2, y - 1.2);
    ctx.lineTo(x + 1.2, y + 1.2);
    ctx.moveTo(x + 1.2, y - 1.2);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.beginPath();
  for (let t = 0; t < Math.PI * 3.2; t += 0.12) {
    const r = (t / (Math.PI * 3.2)) * 7;
    ctx.lineTo(16 + Math.cos(t) * r, 16 + Math.sin(t) * r);
  }
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

/** A merchant's balance scale in gold. */
function scale(ctx: Ctx) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.4;
  const frame = () => {
    ctx.beginPath();
    ctx.moveTo(17, 6);
    ctx.lineTo(17, 26);
    ctx.moveTo(7, 9);
    ctx.lineTo(27, 9);
    ctx.moveTo(7, 9);
    ctx.lineTo(4, 18);
    ctx.moveTo(7, 9);
    ctx.lineTo(10, 18);
    ctx.moveTo(27, 9);
    ctx.lineTo(24, 18);
    ctx.moveTo(27, 9);
    ctx.lineTo(30, 18);
  };
  frame();
  ctx.stroke();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.6;
  frame();
  ctx.stroke();
  for (const x of [7, 27]) {
    ctx.beginPath();
    ctx.moveTo(x - 4.5, 18);
    ctx.quadraticCurveTo(x, 23, x + 4.5, 18);
    ctx.closePath();
    fillStroke(ctx, goldGrad(ctx, x - 4, 18, x + 4, 22), 1.2);
  }
  ctx.beginPath();
  ctx.moveTo(12, 29);
  ctx.lineTo(22, 29);
  ctx.lineTo(19, 25.5);
  ctx.lineTo(15, 25.5);
  ctx.closePath();
  fillStroke(ctx, goldGrad(ctx, 12, 25, 22, 29), 1.2);
  ctx.beginPath();
  ctx.arc(17, 5.5, 2, 0, Math.PI * 2);
  fillStroke(ctx, GOLD_LIGHT, 1);
  tip(ctx);
}

/** Pickaxe (mining veins): iron head, wooden haft. */
function pickaxe(ctx: Ctx) {
  ctx.save();
  ctx.translate(16, 16);
  ctx.rotate(-Math.PI / 4);
  ctx.beginPath();
  ctx.rect(-1.8, -4, 3.6, 19);
  fillStroke(ctx, "#8b5a2b", 1.3);
  ctx.beginPath();
  ctx.moveTo(-13, -5);
  ctx.quadraticCurveTo(0, -12, 13, -5);
  ctx.lineTo(12, -2.5);
  ctx.quadraticCurveTo(0, -8, -12, -2.5);
  ctx.closePath();
  fillStroke(ctx, iron(ctx, -13, -10, 13, -2), 1.4);
  ctx.beginPath();
  ctx.rect(-3, -7, 6, 5);
  fillStroke(ctx, goldGrad(ctx, -3, -7, 3, -2), 1.1);
  ctx.restore();
  tip(ctx);
}

/** Sickle (herbs): curved steel blade, wooden handle. */
function sickle(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(22, 4);
  ctx.bezierCurveTo(32, 12, 26, 26, 14, 24);
  ctx.bezierCurveTo(22, 22, 26, 13, 20, 7);
  ctx.closePath();
  fillStroke(ctx, iron(ctx, 18, 4, 28, 24), 1.3);
  ctx.beginPath();
  ctx.moveTo(14, 23);
  ctx.lineTo(8, 30);
  ctx.lineTo(10.5, 31.5);
  ctx.lineTo(16, 25);
  ctx.closePath();
  fillStroke(ctx, "#8b5a2b", 1.2);
  rivet(ctx, 14.5, 24, 1.2);
  tip(ctx);
}

/** A tiny forged arrow tip at the top-left hotspot, so shaped cursors still point precisely. */
function tip(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(1, 1);
  ctx.lineTo(7.5, 2.5);
  ctx.lineTo(2.5, 7.5);
  ctx.closePath();
  fillStroke(ctx, goldGrad(ctx, 1, 1, 7, 7), 1.1);
}

const PAINTERS: Record<CursorKind, { paint: (ctx: Ctx) => void; hotspot: [number, number]; fallback: string }> = {
  default: { paint: (ctx) => arrow(ctx), hotspot: [2, 2], fallback: "default" },
  pointer: { paint: gauntletPointing, hotspot: [2, 1], fallback: "pointer" },
  attack: { paint: broadsword, hotspot: [2, 2], fallback: "crosshair" },
  loot: { paint: gauntletLoot, hotspot: [15, 22], fallback: "pointer" },
  talk: { paint: scroll, hotspot: [1, 1], fallback: "pointer" },
  portal: { paint: runeCircle, hotspot: [16, 16], fallback: "pointer" },
  trade: { paint: scale, hotspot: [1, 1], fallback: "pointer" },
  mine: { paint: pickaxe, hotspot: [1, 1], fallback: "pointer" },
  gather: { paint: sickle, hotspot: [1, 1], fallback: "pointer" },
};

const cache = new Map<CursorKind, string>();

/** CSS cursor value, e.g. for `element.style.cursor` or Phaser's `{ cursor }` input option. */
export function cursor(kind: CursorKind): string {
  let value = cache.get(kind);
  if (!value) {
    const { paint, hotspot, fallback } = PAINTERS[kind];
    value = `url(${draw(paint)}) ${hotspot[0]} ${hotspot[1]}, ${fallback}`;
    cache.set(kind, value);
  }
  return value;
}

/** Puts the default and pointer cursors into CSS variables so stylesheets can use them. */
export function installCursorStyles() {
  const root = document.documentElement.style;
  root.setProperty("--cursor-default", cursor("default"));
  root.setProperty("--cursor-pointer", cursor("pointer"));
  root.setProperty("--cursor-attack", cursor("attack"));
}

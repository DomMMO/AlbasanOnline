import { SKILLS, type SkillDef } from "../../../shared/src";

// Skill icons, drawn in code (like the item icons) so every skill has a picture of what it
// does instead of a two-letter label. 64x64 canvases: a dark rune-stone tile tinted with the
// skill's colour, a gold rim, and a bone-white glyph with a glow. Cached as data URLs.

type Ctx = CanvasRenderingContext2D;
const SIZE = 64;
const INK = "#f6edd4";
const OUTLINE = "#1a1009";
const cache = new Map<string, string>();

export function skillIconUrl(skill: SkillDef): string {
  const cached = cache.get(skill.id);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  background(ctx, skill.color);
  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = skill.color;
  ctx.shadowBlur = 8;
  (GLYPHS[skill.id] ?? fallback)(ctx, skill.color);
  ctx.restore();
  const url = canvas.toDataURL();
  cache.set(skill.id, url);
  return url;
}

/** Effects that aren't skills (shown in the aura bar), with their tile colour. */
const AURA_COLORS: Record<string, string> = {
  aura_stun: "#f08c00",
  aura_protect: "#ffd43b",
  aura_fortune: "#9c3b5a",
};

/** Icon for an aura: a skill's own icon, or one of the aura_* pictures. */
export function auraIconUrl(icon: string): string {
  const skill = SKILLS[icon];
  if (skill) return skillIconUrl(skill);
  return skillIconUrl({ id: icon, color: AURA_COLORS[icon] ?? "#868e96" } as SkillDef);
}

function background(ctx: Ctx, color: string) {
  const g = ctx.createRadialGradient(SIZE * 0.4, SIZE * 0.35, 4, SIZE / 2, SIZE / 2, SIZE * 0.75);
  g.addColorStop(0, shade(color, 0.85));
  g.addColorStop(0.6, shade(color, 0.4));
  g.addColorStop(1, "#0b0705");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Carved rim.
  ctx.strokeStyle = "#c9a24a";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, SIZE - 4, SIZE - 4);
  ctx.strokeStyle = "#00000099";
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, SIZE - 10, SIZE - 10);
}

function shade(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

/** Fills and outlines the current path. */
function ink(ctx: Ctx, fill = INK, outline = OUTLINE, width = 2.5) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = outline;
  ctx.lineWidth = width;
  ctx.stroke();
}

function line(ctx: Ctx, points: [number, number][], color = INK, width = 3) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width + 2.5;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function at(ctx: Ctx, x: number, y: number, angle: number, scale: number, draw: () => void) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  draw();
  ctx.restore();
}

// ---- Glyph parts (drawn around 0,0, roughly -24..24) ---------------------------------

/** A sword pointing up. */
function sword(ctx: Ctx, length = 40) {
  const half = length / 2;
  ctx.beginPath();
  ctx.moveTo(0, -half);
  ctx.lineTo(4, -half + 7);
  ctx.lineTo(4, half - 12);
  ctx.lineTo(-4, half - 12);
  ctx.lineTo(-4, -half + 7);
  ctx.closePath();
  ink(ctx, "#e9ecef");
  ctx.beginPath();
  ctx.rect(-10, half - 13, 20, 4);
  ink(ctx, "#e8c33a");
  ctx.beginPath();
  ctx.rect(-2.5, half - 9, 5, 8);
  ink(ctx, "#8b5a2b");
  ctx.beginPath();
  ctx.arc(0, half - 0.5, 3.2, 0, Math.PI * 2);
  ink(ctx, "#e8c33a");
}

function dagger(ctx: Ctx, length = 30) {
  const half = length / 2;
  ctx.beginPath();
  ctx.moveTo(0, -half);
  ctx.quadraticCurveTo(5, -half + 10, 3.5, half - 9);
  ctx.lineTo(-3.5, half - 9);
  ctx.quadraticCurveTo(-5, -half + 10, 0, -half);
  ink(ctx, "#dee2e6");
  ctx.beginPath();
  ctx.rect(-7, half - 10, 14, 3);
  ink(ctx, "#495057");
  ctx.beginPath();
  ctx.rect(-2, half - 7, 4, 7);
  ink(ctx, "#343a40");
}

function shieldShape(ctx: Ctx, scale = 1, fill = "#4dabf7") {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.quadraticCurveTo(12, -14, 17, -16);
  ctx.quadraticCurveTo(18, 6, 0, 20);
  ctx.quadraticCurveTo(-18, 6, -17, -16);
  ctx.quadraticCurveTo(-12, -14, 0, -20);
  ink(ctx, fill);
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(0, 15);
  ctx.moveTo(-12, -6);
  ctx.lineTo(12, -6);
  ctx.strokeStyle = "#e8c33a";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function star(ctx: Ctx, x: number, y: number, r: number, fill = "#ffe066", points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
  }
  ctx.closePath();
  ink(ctx, fill, OUTLINE, 1.8);
}

/** Spiky burst (impact, explosion). */
function burst(ctx: Ctx, r: number, fill: string, spikes = 10) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.55;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  ctx.closePath();
  ink(ctx, fill);
}

function flame(ctx: Ctx, x: number, y: number, h: number, outer = "#ff922b", inner = "#ffe066") {
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.bezierCurveTo(x + h * 0.55, y - h * 0.35, x + h * 0.5, y + h * 0.2, x, y + h * 0.35);
  ctx.bezierCurveTo(x - h * 0.5, y + h * 0.2, x - h * 0.55, y - h * 0.35, x, y - h);
  ink(ctx, outer);
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.45);
  ctx.bezierCurveTo(x + h * 0.25, y - h * 0.1, x + h * 0.22, y + h * 0.18, x, y + h * 0.25);
  ctx.bezierCurveTo(x - h * 0.22, y + h * 0.18, x - h * 0.25, y - h * 0.1, x, y - h * 0.45);
  ctx.fillStyle = inner;
  ctx.fill();
}

function bolt(ctx: Ctx, scale = 1) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(6, -22);
  ctx.lineTo(-9, 2);
  ctx.lineTo(0, 2);
  ctx.lineTo(-6, 22);
  ctx.lineTo(11, -4);
  ctx.lineTo(2, -4);
  ctx.closePath();
  ink(ctx, "#ffe066");
  ctx.restore();
}

function snowflake(ctx: Ctx, r = 20) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const ex = Math.cos(a) * r;
    const ey = Math.sin(a) * r;
    line(ctx, [[0, 0], [ex, ey]], "#d0ebff", 3);
    const mx = Math.cos(a) * r * 0.6;
    const my = Math.sin(a) * r * 0.6;
    for (const side of [-1, 1]) {
      const b = a + side * 0.7;
      line(ctx, [[mx, my], [mx + Math.cos(b) * 6, my + Math.sin(b) * 6]], "#d0ebff", 2);
    }
  }
}

function skull(ctx: Ctx, scale = 1) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, -4, 15, Math.PI * 0.85, Math.PI * 2.15);
  ctx.lineTo(9, 10);
  ctx.lineTo(-9, 10);
  ctx.closePath();
  ink(ctx, "#f1f3f5");
  ctx.fillStyle = OUTLINE;
  for (const x of [-6, 6]) {
    ctx.beginPath();
    ctx.ellipse(x, -3, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-2.5, 6);
  ctx.lineTo(2.5, 6);
  ctx.closePath();
  ctx.fill();
  for (const x of [-5, 0, 5]) {
    ctx.fillRect(x - 0.8, 8, 1.6, 4);
  }
  ctx.restore();
}

function bone(ctx: Ctx, length = 26) {
  const half = length / 2;
  ctx.beginPath();
  ctx.rect(-half + 3, -2.5, length - 6, 5);
  for (const x of [-half + 3, half - 3]) {
    for (const y of [-3, 3]) ctx.moveTo(x + 3.5, y), ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  }
  ink(ctx, "#f1f3f5", OUTLINE, 1.8);
}

function cross(ctx: Ctx, size = 18, fill = "#8ce99a") {
  const w = size * 0.38;
  ctx.beginPath();
  ctx.rect(-w / 2, -size, w, size * 2);
  ctx.rect(-size, -w / 2, size * 2, w);
  ink(ctx, fill);
}

function heart(ctx: Ctx, s = 1, fill = "#ff6b6b") {
  ctx.save();
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.bezierCurveTo(-22, 2, -14, -18, 0, -6);
  ctx.bezierCurveTo(14, -18, 22, 2, 0, 16);
  ink(ctx, fill);
  ctx.restore();
}

function eye(ctx: Ctx, fill = "#f1f3f5", iris = "#5c940d") {
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.quadraticCurveTo(0, -16, 20, 0);
  ctx.quadraticCurveTo(0, 16, -20, 0);
  ink(ctx, fill);
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ink(ctx, iris, OUTLINE, 1.5);
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
}

function ring(ctx: Ctx, r: number, color: string, width = 3) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width + 2.5;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function swirl(ctx: Ctx, r = 18, color = INK) {
  ctx.beginPath();
  for (let t = 0; t < Math.PI * 3.2; t += 0.15) {
    const radius = (t / (Math.PI * 3.2)) * r;
    ctx.lineTo(Math.cos(t) * radius, Math.sin(t) * radius);
  }
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 5.5;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** Curved arrows around the centre (spinning attacks). */
function spinArrows(ctx: Ctx, r = 20, color = INK) {
  for (let i = 0; i < 2; i++) {
    const start = i * Math.PI;
    ctx.beginPath();
    ctx.arc(0, 0, r, start + 0.3, start + 2.4);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    const a = start + 2.4;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a + Math.PI / 2) * 6, y + Math.sin(a + Math.PI / 2) * 6);
    ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
    ctx.lineTo(x - Math.cos(a) * 5, y - Math.sin(a) * 5);
    ctx.closePath();
    ink(ctx, color, OUTLINE, 1.5);
  }
}

function speedLines(ctx: Ctx, x: number, ys: number[], length = 12, color = INK) {
  for (const y of ys) line(ctx, [[x, y], [x - length, y]], color, 2);
}

function wing(ctx: Ctx, flip = 1, fill = "#fff9db") {
  ctx.save();
  ctx.scale(flip, 1);
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.bezierCurveTo(10, -18, 24, -16, 22, -10);
  ctx.bezierCurveTo(20, -4, 16, 2, 12, 4);
  ctx.bezierCurveTo(16, 6, 14, 12, 8, 10);
  ctx.closePath();
  ink(ctx, fill);
  ctx.restore();
}

function chainLink(ctx: Ctx, x: number, y: number, angle: number, color = "#ffd43b") {
  at(ctx, x, y, angle, 1, () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5.5;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}

function drop(ctx: Ctx, x: number, y: number, s: number, fill = "#c92a2a") {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.bezierCurveTo(x + s * 0.8, y, x + s * 0.7, y + s * 0.8, x, y + s * 0.8);
  ctx.bezierCurveTo(x - s * 0.7, y + s * 0.8, x - s * 0.8, y, x, y - s);
  ink(ctx, fill, OUTLINE, 1.8);
}

function ghost(ctx: Ctx, fill = "#d3f9d8") {
  ctx.beginPath();
  ctx.moveTo(-12, 16);
  ctx.lineTo(-12, -4);
  ctx.arc(0, -4, 12, Math.PI, 0);
  ctx.lineTo(12, 16);
  for (let i = 0; i < 4; i++) ctx.lineTo(12 - (i * 2 + 1) * 3, i % 2 === 0 ? 11 : 16);
  ctx.closePath();
  ink(ctx, fill);
  ctx.fillStyle = OUTLINE;
  for (const x of [-4.5, 4.5]) {
    ctx.beginPath();
    ctx.ellipse(x, -4, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function hood(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.bezierCurveTo(16, -18, 18, 4, 16, 20);
  ctx.lineTo(-16, 20);
  ctx.bezierCurveTo(-18, 4, -16, -18, 0, -20);
  ink(ctx, "#343a40", "#000", 2.5);
  ctx.beginPath();
  ctx.ellipse(0, -2, 8, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#0b0705";
  ctx.fill();
  ctx.fillStyle = "#ffe066";
  for (const x of [-3, 3]) ctx.fillRect(x - 1.5, -4, 3, 2);
}

/** An arrow pointing right, centred on the origin. */
function arrowShape(ctx: Ctx, length = 36) {
  const half = length / 2;
  line(ctx, [[-half, 0], [half - 6, 0]], "#c9a66b", 2.5);
  ctx.beginPath();
  ctx.moveTo(half, 0);
  ctx.lineTo(half - 8, -4.5);
  ctx.lineTo(half - 8, 4.5);
  ctx.closePath();
  ink(ctx, "#ced4da", OUTLINE, 1.5);
  for (const dy of [-4, 4]) {
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(-half + 7, 0);
    ctx.lineTo(-half + 3, dy);
    ctx.lineTo(-half - 3, dy);
    ctx.closePath();
    ink(ctx, "#ff8787", OUTLINE, 1.2);
  }
}

/** A bow standing upright, string on the left. */
function bowShape(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(-8, -24);
  ctx.quadraticCurveTo(18, 0, -8, 24);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = "#a0522d";
  ctx.lineWidth = 4;
  ctx.stroke();
  line(ctx, [[-8, -24], [-8, 24]], "#f1f3f5", 1.2);
}

function leaf(ctx: Ctx, x: number, y: number, angle: number, size: number, fill = "#69db7c") {
  at(ctx, x, y, angle, 1, () => {
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.quadraticCurveTo(0, -size * 0.7, size, 0);
    ctx.quadraticCurveTo(0, size * 0.7, -size, 0);
    ink(ctx, fill, OUTLINE, 1.8);
    line(ctx, [[-size * 0.8, 0], [size * 0.8, 0]], "#2b8a3e", 1.2);
  });
}

/** A shaman's frame drum with a beater. */
function drum(ctx: Ctx) {
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 16, 0, 0, Math.PI * 2);
  ink(ctx, "#e9d8a6", OUTLINE, 2.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#c92a2a";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  star(ctx, 0, 0, 5, "#c92a2a", 4);
  line(ctx, [[10, 14], [22, 24]], "#8a5a2b", 3);
}

function paw(ctx: Ctx, x: number, y: number) {
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 6, 5, 0, 0, Math.PI * 2);
  ink(ctx, "#ced4da", OUTLINE, 1.5);
  for (const [dx, dy] of [[-6, -3], [-2, -6], [3, -6], [7, -3]] as const) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 2.2, 0, Math.PI * 2);
    ink(ctx, "#ced4da", OUTLINE, 1.2);
  }
}

function fallback(ctx: Ctx) {
  star(ctx, 0, 0, 16, INK);
}

// ---- Skill compositions ------------------------------------------------------------

const GLYPHS: Record<string, (ctx: Ctx, color: string) => void> = {
  // Warrior
  heroicStrike: (ctx) => {
    at(ctx, -3, 3, Math.PI / 4, 1.05, () => sword(ctx));
    star(ctx, 13, -13, 8, "#ffe066", 8);
  },
  whirlwind: (ctx) => {
    spinArrows(ctx, 22, "#ffd8a8");
    at(ctx, 0, 0, Math.PI / 4, 0.8, () => sword(ctx));
  },
  secondWind: (ctx) => {
    heart(ctx, 1, "#ff8787");
    at(ctx, 0, 0, 0, 0.45, () => cross(ctx, 18, "#d3f9d8"));
  },
  hamstring: (ctx) => {
    at(ctx, -6, 6, -Math.PI / 4, 0.95, () => sword(ctx));
    star(ctx, 10, -14, 6);
    star(ctx, 18, -2, 5);
    star(ctx, 2, -20, 4.5);
  },
  leapSlam: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-20, 8);
    ctx.quadraticCurveTo(-6, -26, 12, 4);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    at(ctx, 12, 8, 0, 0.55, () => burst(ctx, 22, "#ff8787", 9));
    line(ctx, [[-22, 20], [22, 20]], "#d9a066", 3);
  },
  battleShout: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-18, 6);
    ctx.quadraticCurveTo(-14, -12, 8, -12);
    ctx.lineTo(10, -2);
    ctx.quadraticCurveTo(-6, -2, -10, 10);
    ctx.closePath();
    ink(ctx, "#e9c46a");
    for (const r of [8, 14, 20]) {
      ctx.beginPath();
      ctx.arc(10, -7, r, -0.7, 0.7);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },

  // Shaman (Kam)
  skyLash: (ctx) => {
    ctx.beginPath();
    ctx.ellipse(0, -18, 18, 6, 0, 0, Math.PI * 2);
    ink(ctx, "#495057", OUTLINE, 1.5);
    bolt(ctx, 0.95);
  },
  thunderDrum: (ctx) => {
    for (const r of [18, 24]) ring(ctx, r, "#a5d8ff", 1.5);
    drum(ctx);
    at(ctx, 15, -15, 0.3, 0.35, () => bolt(ctx, 1));
  },
  ancestorSpirit: (ctx) => {
    at(ctx, -3, 2, 0, 0.95, () => ghost(ctx, "#c3fae8"));
    at(ctx, 13, -13, 0, 0.45, () => cross(ctx, 16, "#63e6be"));
  },
  spiritBind: (ctx) => {
    at(ctx, 0, -2, 0, 0.85, () => ghost(ctx, "#96f2d7"));
    for (const [x, y, a] of [[-14, 12, 0.4], [-2, 16, 0], [11, 12, -0.4]] as const) chainLink(ctx, x, y, a, "#38d9a9");
  },
  windWalk: (ctx) => {
    at(ctx, -8, 0, 0, 0.75, () => swirl(ctx, 16, "#d0ebff"));
    for (const y of [-8, 0, 8]) line(ctx, [[2, y], [20, y - 3]], "#a5d8ff", 2.5);
  },
  skyBlessing: (ctx) => {
    ring(ctx, 21, "#74c0fc", 2.5);
    star(ctx, 0, 0, 16, "#d0ebff", 8);
    at(ctx, 0, 0, 0, 0.45, () => bolt(ctx, 1));
  },

  // Archer (Tigin)
  aimedShot: (ctx) => {
    bowShape(ctx);
    at(ctx, 0, 0, 0, 1, () => arrowShape(ctx, 38));
    ring(ctx, 5, "#ff8787", 1.5);
  },
  arrowRain: (ctx) => {
    for (const [x, y] of [[-12, -6], [0, -12], [12, -4], [-4, 6], [8, 10]] as const) at(ctx, x, y, Math.PI / 2 + 0.2, 0.5, () => arrowShape(ctx, 30));
    ctx.beginPath();
    ctx.ellipse(0, 20, 20, 4, 0, 0, Math.PI * 2);
    ink(ctx, "#e67700", OUTLINE, 1.5);
  },
  quickShot: (ctx) => {
    for (const y of [-7, 7]) at(ctx, 4, y, 0, 0.8, () => arrowShape(ctx, 34));
    speedLines(ctx, -16, [-12, 0, 12], 10);
  },
  pinningShot: (ctx) => {
    at(ctx, 0, -4, Math.PI / 2 - 0.35, 0.85, () => arrowShape(ctx, 36));
    ctx.beginPath();
    ctx.ellipse(4, 16, 16, 5, 0, 0, Math.PI * 2);
    ink(ctx, "#a61e4d", OUTLINE, 1.5);
    star(ctx, -14, 6, 5);
    star(ctx, 18, 4, 4.5);
  },
  hawkLeap: (ctx) => {
    wing(ctx, 1, "#ffe8cc");
    wing(ctx, -1, "#ffe8cc");
    speedLines(ctx, -6, [14, 20], 12);
  },
  eagleEye: (ctx) => {
    eye(ctx, "#fff9db", "#f08c00");
    for (const a of [-2.4, -1.57, -0.74]) line(ctx, [[Math.cos(a) * 18, Math.sin(a) * 18], [Math.cos(a) * 24, Math.sin(a) * 24]], "#ffd43b", 2);
  },

  // Druid (Erşek)
  thornLash: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-20, 18);
    ctx.bezierCurveTo(-18, -6, 6, 10, 18, -18);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = "#5c940d";
    ctx.lineWidth = 4;
    ctx.stroke();
    for (const [x, y, a] of [[-16, 8, -2.2], [-8, 2, 0.6], [2, 4, -2.4], [10, -6, 0.4], [14, -12, -2]] as const) {
      at(ctx, x, y, a, 1, () => {
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(7, 0);
        ctx.lineTo(0, 2);
        ink(ctx, "#d8f5a2", OUTLINE, 1.2);
      });
    }
  },
  entangle: (ctx) => {
    ring(ctx, 21, "#94d82d", 2);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
      ctx.quadraticCurveTo(Math.cos(a + 0.9) * 10, Math.sin(a + 0.9) * 10, 0, 0);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 5.5;
      ctx.stroke();
      ctx.strokeStyle = "#8a5a2b";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    leaf(ctx, 0, 0, 0.6, 9, "#69db7c");
  },
  rejuvenate: (ctx) => {
    leaf(ctx, -4, 4, -0.6, 18, "#69db7c");
    leaf(ctx, 8, -6, 0.5, 12, "#8ce99a");
    at(ctx, 14, 12, 0, 0.4, () => cross(ctx, 16, "#d3f9d8"));
  },
  barkskin: (ctx) => {
    shieldShape(ctx, 1.1, "#8a5a2b");
    ctx.strokeStyle = "#4a2e16";
    ctx.lineWidth = 1.8;
    for (const x of [-7, 0, 7]) {
      ctx.beginPath();
      ctx.moveTo(x, -14);
      ctx.bezierCurveTo(x + 3, -4, x - 3, 4, x, 14);
      ctx.stroke();
    }
    leaf(ctx, 12, -16, 0.6, 7, "#69db7c");
  },
  wildCharge: (ctx) => {
    for (const [x, y] of [[-10, 8], [6, -6]] as const) paw(ctx, x, y);
    speedLines(ctx, -16, [-14, -4], 10);
  },
  springTide: (ctx) => {
    for (const r of [12, 18, 24]) ring(ctx, r, "#8ce99a", 1.5);
    leaf(ctx, 0, 0, -0.4, 15, "#40c057");
  },

  // Priest
  smite: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-7, -24);
    ctx.lineTo(7, -24);
    ctx.lineTo(12, 14);
    ctx.lineTo(-12, 14);
    ctx.closePath();
    ink(ctx, "#fff3bf", "#e0a800", 1.5);
    at(ctx, 0, 16, 0, 0.6, () => burst(ctx, 16, "#ffd43b", 8));
  },
  heal: (ctx) => {
    cross(ctx, 19, "#8ce99a");
    healSparkle(ctx);
  },
  shield: (ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#74c0fc55";
    ctx.fill();
    ring(ctx, 20, "#a5d8ff", 2.5);
    ctx.beginPath();
    ctx.arc(-6, -8, 6, Math.PI, Math.PI * 1.6);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    at(ctx, 0, 2, 0, 0.5, () => shieldShape(ctx, 1, "#f8f9fa"));
  },
  holyNova: (ctx) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      line(ctx, [[Math.cos(a) * 11, Math.sin(a) * 11], [Math.cos(a) * 22, Math.sin(a) * 22]], "#ffe066", 2.5);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ink(ctx, "#fff3bf");
  },
  holyChains: (ctx) => {
    for (let i = -2; i <= 2; i++) chainLink(ctx, i * 9, i * 9 * 0.6, i % 2 === 0 ? 0.55 : 0.55 + Math.PI / 2);
    star(ctx, 15, -15, 6, "#fff3bf", 4);
  },
  lightStep: (ctx) => {
    at(ctx, -2, 0, 0, 1, () => wing(ctx, 1, "#fff9db"));
    speedLines(ctx, -6, [-8, 0, 8], 14, "#ffe066");
  },
  divineSpirit: (ctx) => {
    ctx.beginPath();
    ctx.ellipse(0, -17, 11, 4, 0, 0, Math.PI * 2);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = "#ffd43b";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    at(ctx, 0, 4, 0, 0.9, () => {
      wing(ctx, 1);
      wing(ctx, -1);
    });
  },

  // Necromancer
  drainLife: (ctx) => {
    at(ctx, -6, -4, 0, 0.75, () => skull(ctx));
    ctx.beginPath();
    ctx.moveTo(4, 2);
    ctx.bezierCurveTo(16, 4, 8, 16, 20, 20);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = "#69db7c";
    ctx.lineWidth = 3.5;
    ctx.stroke();
    drop(ctx, 18, 16, 5, "#69db7c");
  },
  boneNova: (ctx) => {
    for (let i = 0; i < 6; i++) at(ctx, 0, 0, (i / 6) * Math.PI * 2, 0.7, () => at(ctx, 20, 0, 0, 1, () => bone(ctx, 22)));
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ink(ctx, "#f1f3f5");
  },
  summonSkeleton: (ctx) => {
    at(ctx, 0, 8, Math.PI / 5, 1, () => bone(ctx, 34));
    at(ctx, 0, 8, -Math.PI / 5, 1, () => bone(ctx, 34));
    at(ctx, 0, -6, 0, 0.85, () => skull(ctx));
  },
  terror: (ctx) => {
    eye(ctx, "#e9ecef", "#2b8a3e");
    for (const [x, y] of [[-18, -14], [18, -14], [-14, 16], [14, 16]] as [number, number][]) {
      line(ctx, [[x * 0.6, y * 0.6], [x, y]], "#b2f2bb", 2);
    }
  },
  soulStep: (ctx) => {
    at(ctx, 4, 0, 0, 0.85, () => ghost(ctx, "#b2f2bb"));
    speedLines(ctx, -10, [-6, 4, 14], 12, "#69db7c");
  },
  darkPact: (ctx) => {
    ring(ctx, 21, "#8f1d1d", 2);
    star(ctx, 0, 0, 19, "#2b0a0a", 5);
    drop(ctx, 0, 1, 9, "#e03131");
  },

  // Rogue
  sinisterStrike: (ctx) => {
    at(ctx, -2, 2, Math.PI / 4, 1.2, () => dagger(ctx));
    line(ctx, [[-14, -18], [12, 10]], "#ffe066", 1.5);
  },
  fanOfKnives: (ctx) => {
    for (const a of [-0.6, 0, 0.6]) at(ctx, Math.sin(a) * 12, -Math.cos(a) * 4, a, 0.95, () => dagger(ctx, 30));
  },
  eviscerate: (ctx) => {
    at(ctx, 0, 0, Math.PI / 4, 1.1, () => dagger(ctx));
    at(ctx, 0, 0, -Math.PI / 4, 1.1, () => dagger(ctx));
    drop(ctx, -14, 14, 5);
    drop(ctx, 15, 12, 4);
  },
  blind: (ctx) => {
    eye(ctx, "#f1f3f5", "#868e96");
    ctx.fillStyle = "#ced4da";
    for (const [x, y] of [[-16, -12], [-8, -16], [6, -14], [14, -10], [-12, 12], [10, 14], [18, 4]] as [number, number][]) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    line(ctx, [[-20, 16], [20, -16]], "#ff8787", 2.5);
  },
  shadowStep: (ctx) => {
    at(ctx, 3, 0, 0, 0.9, () => hood(ctx));
    speedLines(ctx, -12, [-8, 2, 12], 10, "#adb5bd");
  },
  // Auras that aren't skills
  aura_stun: (ctx) => {
    star(ctx, -9, -4, 9);
    star(ctx, 9, -8, 7);
    star(ctx, 2, 10, 8);
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 8, -0.2, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  },
  aura_protect: (ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe06655";
    ctx.fill();
    ring(ctx, 20, "#fff3bf", 2);
    ctx.beginPath();
    ctx.ellipse(0, -14, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.strokeStyle = "#ffd43b";
    ctx.lineWidth = 2.2;
    ctx.stroke();
    cross(ctx, 11, "#fff9db");
  },
  aura_fortune: (ctx) => {
    // A Turkish coffee cup on its saucer, steam curling up.
    ctx.beginPath();
    ctx.ellipse(0, 14, 20, 5, 0, 0, Math.PI * 2);
    ink(ctx, "#f1f3f5");
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.lineTo(12, -2);
    ctx.quadraticCurveTo(11, 13, 0, 13);
    ctx.quadraticCurveTo(-11, 13, -12, -2);
    ink(ctx, "#fff9db");
    ctx.beginPath();
    ctx.ellipse(0, -2, 12, 3, 0, 0, Math.PI * 2);
    ink(ctx, "#5c3b1e", OUTLINE, 1.5);
    ctx.beginPath();
    ctx.arc(13, 4, 4, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = "#fff9db";
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const x of [-5, 3]) {
      ctx.beginPath();
      ctx.moveTo(x, -8);
      ctx.bezierCurveTo(x - 4, -13, x + 4, -16, x, -22);
      ctx.strokeStyle = "#f1f3f5cc";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    star(ctx, 15, -15, 5, "#ffe066", 4);
  },

  adrenaline: (ctx) => {
    heart(ctx, 0.95, "#ff6b6b");
    bolt(ctx, 0.55);
  },
};

function healSparkle(ctx: Ctx) {
  star(ctx, 15, -15, 5, "#ffffff", 4);
  star(ctx, -16, 13, 4, "#ffffff", 4);
}

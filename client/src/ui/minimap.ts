import { Tile, TILE_SIZE, type WorldMap } from "../../../shared/src";
import { tileBaseColor } from "../gfx/textures";

// Minimap (top right, M toggles it): the ground around you, VIEW_RADIUS tiles each way with
// you in the middle and north up, and a dot for your party, other players, NPCs and portals.
// What it can't show (the place a guard sent you to, party members, pings further away)
// gets a triangle on its edge pointing the way. The ground is painted once per zone into a
// one-pixel-per-tile canvas; each redraw cuts the part around you out of it.

/** Tiles shown each way from you. */
const VIEW_RADIUS = 10;
/** Square; kept low enough that the quest tracker below never moves. */
const SIZE = 128;
const HIDDEN_KEY = "mmo.minimapHidden";

const frame = document.getElementById("minimap")!;
const canvas = document.getElementById("minimap-canvas") as HTMLCanvasElement;
const label = document.getElementById("minimap-zone")!;
const ctx = canvas.getContext("2d")!;

/** Colours that read better from far away than the tiles' own. */
const MINIMAP_COLORS: Partial<Record<Tile, string>> = {
  [Tile.Tree]: "#2b5422",
  [Tile.Sky]: "#8ec8ee",
  [Tile.Solid]: "#5a4636",
  [Tile.Wall]: "#4d483f",
  [Tile.Market]: "#d9a441",
};

export type MinimapDotKind = "self" | "party" | "player" | "enemy" | "npc" | "portal" | "ping" | "guide";

export interface MinimapDot {
  /** World position in pixels. */
  x: number;
  y: number;
  kind: MinimapDotKind;
}

/** Drawn in this order, so you and your party end up on top. */
const DOT_STYLE: Record<MinimapDotKind, { color: string; radius: number; order: number }> = {
  portal: { color: "#c084fc", radius: 2.5, order: 0 },
  npc: { color: "#74c0fc", radius: 2, order: 1 },
  player: { color: "#ffffff", radius: 2, order: 2 },
  enemy: { color: "#ff5a5a", radius: 2.5, order: 3 },
  party: { color: "#4cd964", radius: 3, order: 4 },
  self: { color: "#ffe14d", radius: 3, order: 5 },
  ping: { color: "#ff922b", radius: 4.5, order: 6 },
  /** Where a guard told us to go. */
  guide: { color: "#ffd43b", radius: 4, order: 7 },
};

let ground: HTMLCanvasElement | null = null;
/** Kinds that point the way from the minimap's edge when they are out of view. */
const POINTED: Partial<Record<MinimapDotKind, true>> = { guide: true, party: true, ping: true };

try {
  frame.hidden = localStorage.getItem(HIDDEN_KEY) === "1";
} catch {
  // Storage unavailable: the minimap simply starts visible.
}

/** Paints the zone's ground; call when entering a zone. */
export function setMinimapZone(map: WorldMap, zoneName: string) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  ground = document.createElement("canvas");
  ground.width = map.width;
  ground.height = map.height;
  const g = ground.getContext("2d")!;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.tiles[y][x];
      g.fillStyle = MINIMAP_COLORS[tile] ?? tileBaseColor(tile);
      g.fillRect(x, y, 1, 1);
    }
  }
  label.textContent = zoneName;
}

/** A triangle at (x, y) pointing along `angle`. */
function triangle(x: number, y: number, angle: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.7, -size * 0.75);
  ctx.lineTo(-size * 0.7, size * 0.75);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#000";
  ctx.stroke();
  ctx.restore();
}

/** Redraws the minimap round the "self" dot. */
export function drawMinimap(dots: MinimapDot[]) {
  if (!ground || frame.hidden) return;
  const self = dots.find((d) => d.kind === "self");
  if (!self) return;
  const span = VIEW_RADIUS * 2 + 1;
  const perTile = SIZE / span;
  // The view's top-left corner, in tiles (fractional: it glides as you walk).
  const left = self.x / TILE_SIZE - span / 2;
  const top = self.y / TILE_SIZE - span / 2;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0b0805";
  ctx.fillRect(0, 0, SIZE, SIZE);
  // The part of the ground inside the map (the rest stays dark).
  const sx = Math.max(0, left);
  const sy = Math.max(0, top);
  const ex = Math.min(ground.width, left + span);
  const ey = Math.min(ground.height, top + span);
  if (ex > sx && ey > sy) ctx.drawImage(ground, sx, sy, ex - sx, ey - sy, (sx - left) * perTile, (sy - top) * perTile, (ex - sx) * perTile, (ey - sy) * perTile);

  const toView = (d: MinimapDot) => ({ x: (d.x / TILE_SIZE - left) * perTile, y: (d.y / TILE_SIZE - top) * perTile });
  const inside = (v: { x: number; y: number }) => v.x >= 2 && v.y >= 2 && v.x <= SIZE - 2 && v.y <= SIZE - 2;
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 180);
  const centre = SIZE / 2;
  for (const dot of [...dots].sort((a, b) => DOT_STYLE[a.kind].order - DOT_STYLE[b.kind].order)) {
    const style = DOT_STYLE[dot.kind];
    const v = toView(dot);
    if (!inside(v)) {
      if (!POINTED[dot.kind]) continue;
      // Out of view: a triangle on the edge, pointing the way to it.
      const angle = Math.atan2(v.y - centre, v.x - centre);
      const reach = centre - 8;
      const k = reach / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
      ctx.globalAlpha = dot.kind === "guide" ? pulse : 0.9;
      triangle(centre + Math.cos(angle) * k, centre + Math.sin(angle) * k, angle, dot.kind === "guide" ? 7 : 5, style.color);
      ctx.globalAlpha = 1;
      continue;
    }
    if (dot.kind === "guide") {
      // In view: the place itself, with a triangle above it pointing down at it.
      ctx.globalAlpha = pulse;
      triangle(v.x, v.y - 10, Math.PI / 2, 6, style.color);
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(v.x, v.y, style.radius, 0, Math.PI * 2);
    ctx.fillStyle = style.color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#000";
    ctx.stroke();
  }
}

export function toggleMinimap() {
  frame.hidden = !frame.hidden;
  try {
    localStorage.setItem(HIDDEN_KEY, frame.hidden ? "1" : "0");
  } catch {
    // Not remembered; fine.
  }
}

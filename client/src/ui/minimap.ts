import { Tile, TILE_SIZE, type WorldMap } from "../../../shared/src";
import { tileBaseColor } from "../gfx/textures";

// Minimap (top right, M toggles it): the whole zone scaled to fit, with a dot for
// you, your party, other players, NPCs and portals. The ground is painted once per
// zone into a one-pixel-per-tile canvas; each redraw scales that up and adds the dots.

const MAX_WIDTH = 168;
/** Kept low enough that the quest tracker below never moves. */
const MAX_HEIGHT = 128;
const HIDDEN_KEY = "mmo.minimapHidden";

const frame = document.getElementById("minimap")!;
const canvas = document.getElementById("minimap-canvas") as HTMLCanvasElement;
const label = document.getElementById("minimap-zone")!;
const ctx = canvas.getContext("2d")!;

/** Colours that read better from far away than the tiles' own. */
const MINIMAP_COLORS: Partial<Record<Tile, string>> = {
  [Tile.Tree]: "#2b5422",
  [Tile.Solid]: "#5a4636",
  [Tile.Wall]: "#4d483f",
  [Tile.Market]: "#d9a441",
};

export type MinimapDotKind = "self" | "party" | "player" | "enemy" | "npc" | "portal";

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
};

let ground: HTMLCanvasElement | null = null;
let scale = 1;

try {
  frame.hidden = localStorage.getItem(HIDDEN_KEY) === "1";
} catch {
  // Storage unavailable: the minimap simply starts visible.
}

/** Paints the zone's ground; call when entering a zone. */
export function setMinimapZone(map: WorldMap, zoneName: string) {
  scale = Math.min(MAX_WIDTH / map.width, MAX_HEIGHT / map.height);
  canvas.width = Math.round(map.width * scale);
  canvas.height = Math.round(map.height * scale);
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

export function drawMinimap(dots: MinimapDot[]) {
  if (!ground || frame.hidden) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ground, 0, 0, canvas.width, canvas.height);
  const perPixel = scale / TILE_SIZE;
  for (const dot of [...dots].sort((a, b) => DOT_STYLE[a.kind].order - DOT_STYLE[b.kind].order)) {
    const style = DOT_STYLE[dot.kind];
    ctx.beginPath();
    ctx.arc(dot.x * perPixel, dot.y * perPixel, style.radius, 0, Math.PI * 2);
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

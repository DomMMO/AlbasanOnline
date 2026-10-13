import { TILE_SIZE } from "../constants";
import { Tile, type WorldMap } from "../map";

// Fishing at the harbour (Liman). With a rod in the bags, stand at the water's edge (shore
// or pier) and cast: a catch comes every few seconds until you walk away, so it works as
// an AFK farm. Mostly fish to sell, now and then junk, and very rarely upgrade scrolls.

/** Seconds between two catches: a random time in this range. */
export const FISHING_MIN_MS = 6_000;
export const FISHING_MAX_MS = 12_000;
/** Water must be within this distance of your feet to cast. */
export const FISHING_REACH = TILE_SIZE * 1.75;

export interface CatchEntry {
  item: string;
  /** Relative weight; the chance is weight / total weight. */
  weight: number;
  /** Rare catches are announced to the whole server. */
  announce?: boolean;
}

/** What comes out of the water. Weights add up to 10 000, so 1 = %0,01. */
export const CATCH_TABLE: CatchEntry[] = [
  { item: "fish_anchovy", weight: 3719 },
  { item: "fish_horse_mackerel", weight: 2500 },
  { item: "fish_seabass", weight: 1400 },
  { item: "fish_bream", weight: 900 },
  { item: "fish_bluefish", weight: 450 },
  { item: "sea_shell", weight: 865 },
  { item: "upgrade_scroll_low", weight: 100 },
  { item: "fish_golden", weight: 50, announce: true },
  { item: "upgrade_scroll_mid", weight: 10, announce: true },
  { item: "protection_charm", weight: 4, announce: true },
  { item: "upgrade_scroll_high", weight: 2, announce: true },
];

export function rollCatch(random: () => number): CatchEntry {
  const total = CATCH_TABLE.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of CATCH_TABLE) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return CATCH_TABLE[0];
}

/**
 * Where the float lands: the centre of the nearest water tile within reach, preferring
 * the direction the player faces (dx/dy). null = no water close enough.
 */
export function castSpot(map: WorldMap, x: number, y: number, facing: { dx: number; dy: number }): { x: number; y: number } | null {
  const fx = x;
  const fy = y - TILE_SIZE / 2;
  const tx0 = Math.floor(fx / TILE_SIZE);
  const ty0 = Math.floor(fy / TILE_SIZE);
  let best: { x: number; y: number; score: number } | null = null;
  for (let ty = ty0 - 2; ty <= ty0 + 2; ty++) {
    for (let tx = tx0 - 2; tx <= tx0 + 2; tx++) {
      if (map.tiles[ty]?.[tx] !== Tile.Water) continue;
      const cx = (tx + 0.5) * TILE_SIZE;
      const cy = (ty + 0.5) * TILE_SIZE;
      const dist = Math.hypot(cx - fx, cy - fy);
      if (dist > FISHING_REACH + TILE_SIZE / 2) continue;
      // Water in front of you beats water beside or behind you.
      const ahead = (cx - fx) * facing.dx + (cy - fy) * facing.dy;
      const score = dist - ahead * 0.75;
      if (!best || score < best.score) best = { x: cx, y: cy, score };
    }
  }
  return best && { x: best.x, y: best.y };
}

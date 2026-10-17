import { collides, type WorldMap } from "../../../shared/src";

// Paths for mobs: a grid of where a mob's feet fit (walls, props and their collision shapes
// all count, as for players), searched with A* when the way to the target isn't straight, so a
// chasing mob goes round a rock or through a doorway instead of walking into the wall.

/** Grid cell size in pixels (half a tile: doorways and gaps between props show up). */
const CELL = 8;
/** At most this many cells searched for one path (a far target outside it is approached). */
const MAX_SEARCH = 30000;
const SQRT2 = Math.SQRT2;

interface Grid {
  w: number;
  h: number;
  /** 1 = a mob's feet fit at the cell's middle. */
  open: Uint8Array;
}

const grids = new WeakMap<WorldMap, Grid>();

function gridOf(map: WorldMap): Grid {
  let grid = grids.get(map);
  if (grid) return grid;
  const w = Math.ceil((map.width * 16) / CELL);
  const h = Math.ceil((map.height * 16) / CELL);
  const open = new Uint8Array(w * h);
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      if (!collides(map, cx * CELL + CELL / 2, cy * CELL + CELL / 2)) open[cy * w + cx] = 1;
    }
  }
  grid = { w, h, open };
  grids.set(map, grid);
  return grid;
}

/** Whether a mob can walk straight from a to b (its feet fit all along the line). */
export function walkableLine(map: WorldMap, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.ceil(Math.hypot(dx, dy) / 4);
  for (let i = 1; i <= steps; i++) {
    if (collides(map, a.x + (dx * i) / steps, a.y + (dy * i) / steps)) return false;
  }
  return true;
}

/**
 * A walkable path from `from` towards `to` (pixel waypoints, the first one being the next to walk
 * to), or null when there is none. When `to` itself can't be stood on, or is too far to search,
 * the path ends at the reachable cell nearest to it.
 */
export function findPath(map: WorldMap, from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] | null {
  const grid = gridOf(map);
  const { w, h, open } = grid;
  const cellOf = (p: { x: number; y: number }) => {
    const cx = Math.min(w - 1, Math.max(0, Math.floor(p.x / CELL)));
    const cy = Math.min(h - 1, Math.max(0, Math.floor(p.y / CELL)));
    return cy * w + cx;
  };
  let start = cellOf(from);
  if (!open[start]) start = nearestOpen(grid, start);
  const goal = cellOf(to);
  if (start < 0) return null;
  const gx = goal % w;
  const gy = Math.floor(goal / w);
  const heuristic = (i: number) => {
    const ddx = Math.abs((i % w) - gx);
    const ddy = Math.abs(Math.floor(i / w) - gy);
    return Math.max(ddx, ddy) + (SQRT2 - 1) * Math.min(ddx, ddy);
  };
  const cost = new Map<number, number>([[start, 0]]);
  const came = new Map<number, number>();
  const heap = new MinHeap();
  heap.push(start, heuristic(start));
  let best = start;
  let bestH = heuristic(start);
  let searched = 0;
  while (heap.size > 0 && searched < MAX_SEARCH) {
    const cur = heap.pop();
    if (cur === goal) {
      best = cur;
      break;
    }
    searched++;
    const hcur = heuristic(cur);
    if (hcur < bestH) {
      bestH = hcur;
      best = cur;
    }
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    const base = cost.get(cur)!;
    for (let ddy = -1; ddy <= 1; ddy++) {
      for (let ddx = -1; ddx <= 1; ddx++) {
        if (ddx === 0 && ddy === 0) continue;
        const nx = cx + ddx;
        const ny = cy + ddy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (!open[n]) continue;
        // Diagonals don't cut the corners of walls.
        if (ddx !== 0 && ddy !== 0 && (!open[cy * w + nx] || !open[ny * w + cx])) continue;
        const next = base + (ddx !== 0 && ddy !== 0 ? SQRT2 : 1);
        if (next < (cost.get(n) ?? Infinity)) {
          cost.set(n, next);
          came.set(n, cur);
          heap.push(n, next + heuristic(n));
        }
      }
    }
  }
  if (best === start) return null;
  const cells: number[] = [];
  for (let c: number | undefined = best; c !== undefined && c !== start; c = came.get(c)) cells.push(c);
  cells.reverse();
  const points = cells.map((c) => ({ x: (c % w) * CELL + CELL / 2, y: Math.floor(c / w) * CELL + CELL / 2 }));
  if (best === goal && !collides(map, to.x, to.y)) points[points.length - 1] = { x: to.x, y: to.y };
  return smooth(map, from, points);
}

/** Drops the waypoints one can walk past in a straight line (no zigzag along the grid). */
function smooth(map: WorldMap, from: { x: number; y: number }, points: { x: number; y: number }[]) {
  const out: { x: number; y: number }[] = [];
  let at = from;
  let i = 0;
  while (i < points.length) {
    let j = points.length - 1;
    while (j > i && !walkableLine(map, at, points[j])) j--;
    out.push(points[j]);
    at = points[j];
    i = j + 1;
  }
  return out;
}

function nearestOpen(grid: Grid, cell: number): number {
  const { w, h, open } = grid;
  const cx = cell % w;
  const cy = Math.floor(cell / w);
  for (let r = 1; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < w && y < h && open[y * w + x]) return y * w + x;
      }
    }
  }
  return -1;
}

class MinHeap {
  private items: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.items.length;
  }
  push(item: number, key: number) {
    this.items.push(item);
    this.keys.push(key);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.items.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

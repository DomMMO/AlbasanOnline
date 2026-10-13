import { GALLOP_SPEED_MULTIPLIER, MOUNT_SPEED_MULTIPLIER, PLAYER_SPEED, TILE_SIZE } from "./constants";
import { blocksRect, type WorldMap } from "./map";
import { Direction, type Axis } from "./protocol";

// The single movement function used by both the server (authoritative) and the
// client (prediction). Because it is deterministic, a client that replays its
// unacknowledged inputs on top of the server position lands on the same spot.

/** Collision box at the character's feet; (x, y) is the bottom-centre. */
export const PLAYER_HITBOX = { halfWidth: 5, height: 6 };

export function collides(map: WorldMap, x: number, y: number): boolean {
  const x0 = x - PLAYER_HITBOX.halfWidth;
  const x1 = x + PLAYER_HITBOX.halfWidth;
  const y0 = y - PLAYER_HITBOX.height;
  const left = Math.floor(x0 / TILE_SIZE);
  const right = Math.floor((x1 - 0.001) / TILE_SIZE);
  const top = Math.floor(y0 / TILE_SIZE);
  const bottom = Math.floor((y - 0.001) / TILE_SIZE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      // Whole tiles, or only the blocked quarters of a tile the map editor split.
      if (blocksRect(map, tx, ty, x0, y0, x1, y)) return true;
    }
  }
  return false;
}

/** Moves along (vx, vy) — a unit vector — by `distance`, sliding along walls. */
export function moveWithCollision(
  map: WorldMap,
  x: number,
  y: number,
  vx: number,
  vy: number,
  distance: number,
): { x: number; y: number } {
  // Resolve each axis separately so the mover slides along walls.
  const nx = x + vx * distance;
  if (!collides(map, nx, y)) x = nx;
  const ny = y + vy * distance;
  if (!collides(map, x, ny)) y = ny;
  return { x, y };
}

export function stepMovement(
  map: WorldMap,
  x: number,
  y: number,
  dx: Axis,
  dy: Axis,
  dtSeconds: number,
  /** Riding a horse (MOUNT_SPEED_MULTIPLIER faster). */
  mounted = false,
  /** Galloping (Shift on horseback); ignored on foot. */
  gallop = false,
  /** The ridden breed's extra speed (data/horses.ts); ignored on foot. */
  horseBonus = 0,
): { x: number; y: number } {
  let vx: number = dx;
  let vy: number = dy;
  if (vx !== 0 && vy !== 0) {
    vx *= Math.SQRT1_2;
    vy *= Math.SQRT1_2;
  }
  const speed = mounted ? PLAYER_SPEED * MOUNT_SPEED_MULTIPLIER * (1 + horseBonus) * (gallop ? GALLOP_SPEED_MULTIPLIER : 1) : PLAYER_SPEED;
  return moveWithCollision(map, x, y, vx, vy, speed * dtSeconds);
}

export function directionFrom(dx: Axis, dy: Axis, previous: Direction): Direction {
  // Horizontal wins on diagonals, which looks better with side-facing sprites.
  if (dx < 0) return Direction.Left;
  if (dx > 0) return Direction.Right;
  if (dy < 0) return Direction.Up;
  if (dy > 0) return Direction.Down;
  return previous;
}

/** Facing for an arbitrary (non-grid) movement vector, e.g. a mob chasing a player. */
export function directionToward(dx: number, dy: number, previous: Direction): Direction {
  if (dx === 0 && dy === 0) return previous;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? Direction.Left : Direction.Right;
  return dy < 0 ? Direction.Up : Direction.Down;
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

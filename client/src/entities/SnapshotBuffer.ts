import { TICK_MS, type Direction } from "../../../shared/src";

/** Remote entities are drawn this far in the past so there are always two snapshots to blend between. */
export const INTERPOLATION_DELAY_MS = 100;

interface Snapshot {
  t: number;
  x: number;
  y: number;
  dir: Direction;
}

/** Snapshot interpolation for entities we don't control (other players, mobs). */
export class SnapshotBuffer {
  private snapshots: Snapshot[] = [];

  push(x: number, y: number, dir: Direction) {
    const now = performance.now();
    const last = this.snapshots[this.snapshots.length - 1];
    // After standing still there's a gap in the history; anchor the old position one
    // tick back so the entity starts moving smoothly instead of jumping.
    if (last && now - last.t > TICK_MS * 2) this.snapshots.push({ ...last, t: now - TICK_MS });
    this.snapshots.push({ t: now, x, y, dir });
  }

  sample(renderTime: number): { x: number; y: number; dir: Direction } | null {
    const snaps = this.snapshots;
    // Drop snapshots we no longer need, keeping the one just before renderTime.
    while (snaps.length > 2 && snaps[1].t <= renderTime) snaps.shift();
    const [a, b] = snaps;
    if (!a) return null;
    if (!b || renderTime <= a.t) return a;
    const t = Math.min(1, (renderTime - a.t) / (b.t - a.t));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dir: t < 1 ? a.dir : b.dir };
  }
}

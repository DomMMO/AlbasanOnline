import type { ItemView } from "../protocol";

// The passive tree. It has no fixed nodes: it is 20 big empty sockets, one opening per
// level from 2 to 21. A big socket takes a major jewel (one big effect, e.g. "Girdap etkisi
// %20 artar"); once it holds one, the socket's 5 small sockets open and take minor jewels
// (an attribute each, e.g. "+5 Güç"). Jewels drop from mobs and can be swapped freely.

export const PASSIVE_SOCKETS = 20;
export const MINOR_SOCKETS = 5;

/** Character level that opens big socket `index` (0-based). */
export function socketUnlockLevel(index: number): number {
  return index + 2;
}

/** Big sockets 1, 6, 11 and 16 (0-based 0, 5, 10, 15: a quarter of the ring apart) are greater sockets. */
export const GREATER_SOCKETS = [0, 5, 10, 15];

export function isGreaterSocket(index: number): boolean {
  return GREATER_SOCKETS.includes(index);
}

/** Can a jewel of this kind go in big socket `index`? */
export function fitsBigSocket(kind: "major" | "minor" | "greater" | undefined, index: number): boolean {
  return kind === "major" || (kind === "greater" && isGreaterSocket(index));
}

export function unlockedSockets(level: number): number {
  return Math.max(0, Math.min(PASSIVE_SOCKETS, level - 1));
}

export interface PassiveSocketView {
  major: ItemView | null;
  minors: (ItemView | null)[];
}

/** Jewel drop chances on top of every mob's own loot table. */
export const JEWEL_DROPS = {
  normal: { minor: 0.03, major: 0.01, greater: 0.002 },
  /** Mobs drawn bigger (elites). */
  elite: { minor: 0.12, major: 0.05, greater: 0.01 },
  boss: { minor: 0.6, major: 0.35, greater: 0.08 },
};

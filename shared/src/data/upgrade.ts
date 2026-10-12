import type { ItemDef, ItemStats } from "./items";

// Knight Online-style +N upgrading. All randomness happens on the server; these
// tables are shared so the client can show the same chances and costs.

export const MAX_ENHANCE = 10;

/** Success chance indexed by the level being attempted (+1 .. +10). */
export const UPGRADE_SUCCESS_CHANCE = [0, 1.0, 0.95, 0.9, 0.8, 0.7, 0.55, 0.4, 0.3, 0.2, 0.1];

/** Failing an attempt up to this level just fails; above it the item burns. */
export const SAFE_UPGRADE_LEVEL = 3;

/** Successful upgrades to this level or higher are announced to everyone. */
export const ANNOUNCE_UPGRADE_LEVEL = 7;

export const PROTECTION_ITEM = "protection_charm";

/** Visual glow tier for an upgrade level: 0 (none), 7, 8, 9 or 10. */
export function glowTier(enhance: number): 0 | 7 | 8 | 9 | 10 {
  if (enhance >= 10) return 10;
  if (enhance >= 7) return enhance as 7 | 8 | 9;
  return 0;
}

export function scrollForLevel(target: number): string {
  if (target <= 4) return "upgrade_scroll_low";
  if (target <= 7) return "upgrade_scroll_mid";
  return "upgrade_scroll_high";
}

export function upgradeGoldCost(target: number): number {
  return 5 * target * target + 5;
}

export function isUpgradeable(def: ItemDef): boolean {
  return def.slot !== undefined;
}

/** Each +1 adds 10% of the base value (rounded up) plus 1 to every stat the item has. */
export function enhancedStats(def: ItemDef, enhance: number): ItemStats {
  const scale = (base: number | undefined) => (base ? base + Math.ceil(base * 0.1 * enhance) + enhance : undefined);
  const stats = def.stats ?? {};
  return { attack: scale(stats.attack), defense: scale(stats.defense), maxHp: scale(stats.maxHp) };
}

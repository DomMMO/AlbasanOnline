import type { LootTable } from "./mobs";

type Drop = LootTable["drops"][number];

/** Gear tiers in gear.ts: tier t is item level 3t + 6. */
export const MAX_GEAR_TIER = 13;

/** The gear tier a mob of this level drops. */
export const gearTierFor = (level: number) => Math.max(1, Math.min(MAX_GEAR_TIER, Math.floor((level - 6) / 3)));

/** Every weapon and armour piece of one gear tier (see gear.ts), each with the same chance. */
export function gearDrops(tier: number, chance: number): Drop[] {
  const ids = [
    ...["sword", "axe", "staff", "mace", "bow"].map((line) => `${line}_${tier}`),
    ...["plate", "robe"].flatMap((set) => ["head", "chest", "legs", "feet"].map((piece) => `${set}_${piece}_${tier}`)),
  ];
  return ids.map((item) => ({ item, chance }));
}

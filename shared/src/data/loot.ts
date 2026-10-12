import type { LootTable } from "./mobs";

type Drop = LootTable["drops"][number];

/** Every weapon and armour piece of one gear tier (see gear.ts), each with the same chance. */
export function gearDrops(tier: number, chance: number): Drop[] {
  const ids = [
    ...["sword", "axe", "staff", "mace"].map((line) => `${line}_${tier}`),
    ...["plate", "robe"].flatMap((set) => ["head", "chest", "legs", "feet"].map((piece) => `${set}_${piece}_${tier}`)),
  ];
  return ids.map((item) => ({ item, chance }));
}

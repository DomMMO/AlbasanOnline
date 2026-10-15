import { TILE_SIZE } from "../constants";

// Pets. Petçi Nuri next to the horse farm sells them for a fortune. A summoned pet follows you
// and runs to collect the loot your kills drop (whatever you could pick up yourself), so you
// can keep fighting. Only one pet is out at a time; it can be sent home and called back.

export interface PetDef {
  id: string;
  name: string;
  /** Gold at Petçi Nuri. */
  price: number;
  /** Drawn by the client (a code-drawn pixel sprite). */
  appearance: { type: "rabbit"; fur: number };
  description: string;
}

const pet = (def: PetDef) => def;

export const PETS: Record<string, PetDef> = Object.fromEntries(
  [
    pet({
      id: "rabbit",
      name: "Tavşan",
      price: 1_000_000,
      appearance: { type: "rabbit", fur: 0xd8c4a8 },
      description: "Kulakları dik, burnu durmadan oynar. Kestiğin yaratıkların ganimetini zıplaya zıplaya toplayıp getirir.",
    }),
  ].map((def) => [def.id, def]),
);

export const PET_IDS = Object.keys(PETS);

/** A pet goes for loot this far from its owner. */
export const PET_COLLECT_RANGE = TILE_SIZE * 8;
/** Picks loot up from this close. */
export const PET_PICKUP_RANGE = TILE_SIZE * 0.75;
/** Pixels per second; a pet far behind its owner runs twice as fast. */
export const PET_SPEED = 150;
/** Stays this close to its owner when there is nothing to collect. */
export const PET_FOLLOW_DISTANCE = TILE_SIZE * 1.5;
/** Further than this from its owner (portal, gallop): it jumps back to them. */
export const PET_LEASH = TILE_SIZE * 14;

/** A character's pets: which they own and which is out ("" = all at home). */
export interface PetState {
  owned: string[];
  active: string;
}

/** Whatever is stored, as a valid state. */
export function sanitizePet(raw: unknown): PetState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const owned = [...new Set((Array.isArray(r.owned) ? r.owned : []).filter((id): id is string => typeof id === "string" && id in PETS))];
  const active = typeof r.active === "string" && owned.includes(r.active) ? r.active : "";
  return { owned, active };
}

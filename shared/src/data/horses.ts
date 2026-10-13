// Horses. Everyone has the village horse (H to ride). Seyis Yusuf at the horse farm outside
// the east gate sells faster breeds for a great deal of gold, and for even more restyles a
// horse: coat, mane, blanket and saddle colours. The ridden breed sets the riding speed
// (shared movement, so the client predicts it exactly) and how the horse looks to everyone.

export interface HorseLook {
  coat: number;
  mane: number;
  blanket: number;
  saddle: number;
}

export interface HorseBreed {
  id: string;
  name: string;
  /** Gold at the stable (0 = everyone has it). */
  price: number;
  /** Extra riding speed on top of the normal mount speed (0.2 = 20% faster). */
  speedBonus: number;
  look: HorseLook;
  description: string;
}

const breed = (def: HorseBreed) => def;

export const HORSE_BREEDS: Record<string, HorseBreed> = Object.fromEntries(
  [
    breed({ id: "village", name: "Köy Atı", price: 0, speedBonus: 0, look: { coat: 0x8b5a2b, mane: 0x2a1a10, blanket: 0x3b5f8a, saddle: 0x9c2a2a }, description: "Sadık, sabırlı, biraz da tembel. Herkesin ilk atı." }),
    breed({ id: "steppe", name: "Bozkır Atı", price: 25_000, speedBonus: 0.1, look: { coat: 0xb08850, mane: 0x3a2a1a, blanket: 0x7a2a2a, saddle: 0x5b3a1e }, description: "Yağız bozkırların küçük ama yorulmak bilmeyen atı. %10 daha hızlı." }),
    breed({ id: "arabian", name: "Arap Atı", price: 75_000, speedBonus: 0.2, look: { coat: 0xd8d4cc, mane: 0xf1f3f5, blanket: 0x1c7ed6, saddle: 0x8a5a2b }, description: "Çöl rüzgârı gibi hafif, kuğu boyunlu. %20 daha hızlı." }),
    breed({ id: "akhal", name: "Ahal-Teke", price: 200_000, speedBonus: 0.3, look: { coat: 0xd4a017, mane: 0x8a6a10, blanket: 0x2b8a3e, saddle: 0x6b1a1a }, description: "Altın donlu, güneşte parlayan efsanevi cins. %30 daha hızlı." }),
    breed({ id: "karayel", name: "Kara Yel", price: 500_000, speedBonus: 0.4, look: { coat: 0x26232a, mane: 0x0f0d12, blanket: 0x9c2a2a, saddle: 0x111111 }, description: "Gece kadar kara, fırtına kadar hızlı. Seyis'in en kıymetlisi. %40 daha hızlı." }),
  ].map((def) => [def.id, def]),
);

export const HORSE_BREED_IDS = Object.keys(HORSE_BREEDS);
export const DEFAULT_HORSE = "village";

/** Restyling a horse at the stable. */
export const HORSE_STYLE_PRICE = 1_000_000;

/** Colours the stable can dye a horse with. */
export const HORSE_PALETTE: Record<keyof HorseLook, number[]> = {
  coat: [0x8b5a2b, 0xb08850, 0xd8d4cc, 0xd4a017, 0x26232a, 0x6b4423, 0xa0a0a0, 0x7a3a1a, 0xf1ece0, 0x4a3a4a],
  mane: [0x2a1a10, 0x3a2a1a, 0xf1f3f5, 0x8a6a10, 0x0f0d12, 0xc9a24a, 0x7a3a1a, 0x868e96],
  blanket: [0x3b5f8a, 0x7a2a2a, 0x1c7ed6, 0x2b8a3e, 0x9c2a2a, 0x6a4c93, 0xe8c33a, 0x212529, 0xe9ecef, 0xd9480f],
  saddle: [0x9c2a2a, 0x5b3a1e, 0x8a5a2b, 0x6b1a1a, 0x111111, 0x3b2a1a, 0x1c3d5a, 0xc9a24a],
};

/** A character's horses: which breeds they own, which they ride, and any restyled colours. */
export interface HorseState {
  owned: string[];
  active: string;
  /** Restyled looks by breed; a breed not listed has its own colours. */
  looks: Record<string, HorseLook>;
}

const isLook = (value: unknown): value is HorseLook => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (Object.keys(HORSE_PALETTE) as (keyof HorseLook)[]).every((part) => HORSE_PALETTE[part].includes(v[part] as number));
};

/** Whatever is stored, as a valid state (the village horse is always owned). */
export function sanitizeHorse(raw: unknown): HorseState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const owned = [DEFAULT_HORSE, ...(Array.isArray(r.owned) ? r.owned : []).filter((id): id is string => typeof id === "string" && id in HORSE_BREEDS && id !== DEFAULT_HORSE)];
  const unique = [...new Set(owned)];
  const active = typeof r.active === "string" && unique.includes(r.active) ? r.active : DEFAULT_HORSE;
  const looks: Record<string, HorseLook> = {};
  if (r.looks && typeof r.looks === "object") {
    for (const [id, look] of Object.entries(r.looks as Record<string, unknown>)) if (unique.includes(id) && isLook(look)) looks[id] = look;
  }
  return { owned: unique, active, looks };
}

export function isHorseLook(value: unknown): value is HorseLook {
  return isLook(value);
}

export function horseLookOf(state: HorseState, breedId = state.active): HorseLook {
  return state.looks[breedId] ?? HORSE_BREEDS[breedId]?.look ?? HORSE_BREEDS[DEFAULT_HORSE].look;
}

/** Compact form for the synced player state: "coat,mane,blanket,saddle" in hex. */
export function encodeHorseLook(look: HorseLook): string {
  return [look.coat, look.mane, look.blanket, look.saddle].map((c) => c.toString(16)).join(",");
}

export function decodeHorseLook(text: string): HorseLook {
  const [coat, mane, blanket, saddle] = text.split(",").map((h) => parseInt(h, 16));
  if ([coat, mane, blanket, saddle].some((c) => !Number.isFinite(c))) return HORSE_BREEDS[DEFAULT_HORSE].look;
  return { coat, mane, blanket, saddle };
}

export function horseSpeedBonus(breedId: string): number {
  return HORSE_BREEDS[breedId]?.speedBonus ?? 0;
}

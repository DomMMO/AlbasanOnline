/** Worn armour, as item def ids. Only players have this; it's drawn on top of the body. */
export interface HumanoidGear {
  head?: string;
  chest?: string;
  legs?: string;
  feet?: string;
}

// ---- Player looks (character creation) ----------------------------------------------

export type Gender = "male" | "female";
export const GENDERS: Gender[] = ["male", "female"];
export const GENDER_NAMES: Record<Gender, string> = { male: "Erkek", female: "Kadın" };

export type HairStyle = "short" | "spiky" | "long" | "ponytail" | "bun" | "bald";
export const HAIR_STYLES: HairStyle[] = ["short", "spiky", "long", "ponytail", "bun", "bald"];
export const HAIR_STYLE_NAMES: Record<HairStyle, string> = {
  short: "Kısa",
  spiky: "Diken",
  long: "Uzun",
  ponytail: "At Kuyruğu",
  bun: "Topuz",
  bald: "Kel",
};

/** Colours offered at character creation; anything else stored is replaced by a default. */
export const HAIR_COLORS = [0x2d2d2d, 0x5a3825, 0x8b4513, 0xc8a165, 0xf0d58c, 0xd9480f, 0xb8b8b8, 0xf1f3f5, 0x6a4c93, 0x3b5bdb];
export const SKIN_COLORS = [0xf6d5b8, 0xf0c49a, 0xe0b088, 0xd8a47a, 0xc68a5a, 0x9a6440, 0x6b4430];
export const TUNIC_COLORS = [0xd94141, 0x3f7fd9, 0x3fae5a, 0xd9a13f, 0x9b5bd9, 0x3fc2c2, 0xd95ba6, 0xe0e0e0, 0x4a4040, 0x8a6d3b];

/** What a player chose at character creation (the tunic colour is stored separately, as `color`). */
export interface CharacterLook {
  gender: Gender;
  hairStyle: HairStyle;
  hairColor: number;
  skin: number;
}

/** Berber Cemil: a new hair style and/or colour (one price for the visit). */
export const BARBER_PRICE = 50_000;

export const DEFAULT_LOOK: CharacterLook = { gender: "male", hairStyle: "short", hairColor: 0x5a3825, skin: 0xf0c49a };

/** Turns whatever is stored or sent into a valid look (unknown values fall back to defaults). */
export function sanitizeLook(raw: unknown): CharacterLook {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    gender: GENDERS.includes(r.gender as Gender) ? (r.gender as Gender) : DEFAULT_LOOK.gender,
    hairStyle: HAIR_STYLES.includes(r.hairStyle as HairStyle) ? (r.hairStyle as HairStyle) : DEFAULT_LOOK.hairStyle,
    hairColor: HAIR_COLORS.includes(r.hairColor as number) ? (r.hairColor as number) : DEFAULT_LOOK.hairColor,
    skin: SKIN_COLORS.includes(r.skin as number) ? (r.skin as number) : DEFAULT_LOOK.skin,
  };
}

/** How an entity is drawn. The client turns this into pixel-art textures. */
export type Appearance =
  | {
      type: "humanoid";
      tunic: number;
      skin?: number;
      hair?: number;
      /** Body shape and face; default male. */
      gender?: Gender;
      /** Default short. */
      hairStyle?: HairStyle;
      gear?: HumanoidGear;
      /** Class headwear shown when no helmet is worn. */
      headwear?: { color: number; style: "hat" | "hood" };
    }
  | { type: "wolf"; fur: number }
  | { type: "slime"; color: number }
  | { type: "chest" }
  | { type: "portal"; style: "cave" | "exit" | "cursed" | "pvp" | "gate" | "door" }
  /** Pre-rendered sprite sheet (art assets), e.g. bosses. `key` names the sheet on the client. */
  | { type: "image"; key: string; tint?: number };

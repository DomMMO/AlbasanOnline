/** Worn armour, as item def ids. Only players have this; it's drawn on top of the body. */
export interface HumanoidGear {
  head?: string;
  chest?: string;
  legs?: string;
  feet?: string;
}

/** How an entity is drawn. The client turns this into pixel-art textures. */
export type Appearance =
  | {
      type: "humanoid";
      tunic: number;
      skin?: number;
      hair?: number;
      gear?: HumanoidGear;
      /** Class headwear shown when no helmet is worn. */
      headwear?: { color: number; style: "hat" | "hood" };
    }
  | { type: "wolf"; fur: number }
  | { type: "slime"; color: number }
  | { type: "chest" }
  | { type: "portal"; style: "cave" | "exit" | "cursed" | "pvp" | "gate" }
  /** Pre-rendered sprite sheet (art assets), e.g. bosses. `key` names the sheet on the client. */
  | { type: "image"; key: string };

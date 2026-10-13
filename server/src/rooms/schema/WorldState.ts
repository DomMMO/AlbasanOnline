import { MapSchema, Schema, type } from "@colyseus/schema";
import { Direction } from "../../../../shared/src";

// Everything decorated with @type() is synced to every client in the room.
// Server-only data (input queues, cooldowns, AI state...) lives in game/*Runtime instead.

export class Player extends Schema {
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("uint8") dir: Direction = Direction.Down;
  @type("boolean") moving = false;
  @type("uint32") color = 0xffffff;
  /** Last input seq the server applied; the owning client uses it for reconciliation. */
  @type("uint32") lastSeq = 0;

  @type("uint8") level = 1;
  @type("uint32") xp = 0;
  @type("uint16") hp = 1;
  @type("uint16") maxHp = 1;
  /** Class id: warrior, mage, priest. */
  @type("string") cls = "warrior";
  /** Rage or mana, depending on class. */
  @type("uint16") resource = 0;
  @type("uint16") maxResource = 100;
  /** Damage absorbed before health (priest shield). */
  @type("uint16") shield = 0;
  /** Frozen in place (Frost Nova in PvP). */
  @type("boolean") rooted = false;
  /** Kalkan Duvarı is up. */
  @type("boolean") guarded = false;
  /** Stunned (PvP): can't move or act. */
  @type("boolean") stunned = false;
  /** A buff skill is running. */
  @type("boolean") buffed = false;
  /** PvP spawn protection. */
  @type("boolean") protected = false;
  @type("uint16") pvpRating = 1000;
  @type("uint32") pvpKills = 0;
  @type("uint32") pvpDeaths = 0;
  @type("boolean") dead = false;
  /** Equipped weapon, visible to everyone. */
  @type("string") weapon = "";
  @type("uint8") weaponPlus = 0;
  /** Worn armour, visible to everyone. */
  @type("string") gearHead = "";
  @type("string") gearChest = "";
  @type("string") gearLegs = "";
  @type("string") gearFeet = "";
  /** Market stall title ("" = no stall). */
  @type("string") stall = "";
  /** Chosen at character creation: drawn for everyone. */
  @type("string") gender = "male";
  @type("string") hairStyle = "short";
  @type("uint32") hairColor = 0x5a3825;
  @type("uint32") skin = 0xf0c49a;
  /** Game master account: a bouncing "GM" over the name. */
  @type("boolean") gm = false;
  /** Riding a horse (moves faster, drawn on horseback). */
  @type("boolean") mounted = false;
  /** Galloping this tick (Shift on horseback): faster legs and dust for everyone watching. */
  @type("boolean") galloping = false;
  /** Sitting on a bench (moving gets you up). */
  @type("boolean") seated = false;
  /** Breed of the horse they ride (data/horses.ts) and its colours (encodeHorseLook). */
  @type("string") horse = "village";
  @type("string") horseLook = "";
  /** Fishing: the float lies on the water at (fishX, fishY). */
  @type("boolean") fishing = false;
  @type("number") fishX = 0;
  @type("number") fishY = 0;
}

export class Mob extends Schema {
  @type("string") kind = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("uint8") dir: Direction = Direction.Down;
  @type("boolean") moving = false;
  @type("uint8") level = 1;
  @type("uint16") hp = 1;
  @type("uint16") maxHp = 1;
  @type("boolean") enraged = false;
  /** Frozen in place (Frost Nova). */
  @type("boolean") rooted = false;
  /** Session id of the player it is attacking ("" = none). */
  @type("string") aggroId = "";
  /** Night-strengthened (or a night-only creature). */
  @type("boolean") empowered = false;
  /** Stunned: can't move or attack. */
  @type("boolean") stunned = false;
}

/** A player's summon (necromancer skeleton). Its look comes from the skill that summoned it. */
export class Minion extends Schema {
  @type("string") skill = "";
  @type("string") ownerId = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("uint8") dir: Direction = Direction.Down;
  @type("boolean") moving = false;
}

/** A town portal end (see game/townPortal.ts). Only its owner can use it. */
export class TownPortal extends Schema {
  @type("string") owner = "";
  @type("number") x = 0;
  @type("number") y = 0;
  /** Destination zone id. */
  @type("string") to = "";
  /** The town end, leading back out. */
  @type("boolean") back = false;
}

/** A mining vein or herb (life skills). */
export class GatherNode extends Schema {
  @type("string") kind = "";
  @type("number") x = 0;
  @type("number") y = 0;
}

export class Loot extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  /** sessionId allowed to loot; "" = anyone. Contents stay server-side until picked up. */
  @type("string") owner = "";
}

export class WorldState extends Schema {
  /** Which zone this room runs (decides the map on the client). */
  @type("string") zone = "world";
  /** Instanced zones: the boss is dead. */
  @type("boolean") cleared = false;
  /** World clock, minute of the day (0-1439). Shared by every zone. */
  @type("uint16") clock = 0;
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Mob }) mobs = new MapSchema<Mob>();
  @type({ map: Loot }) loot = new MapSchema<Loot>();
  @type({ map: Minion }) minions = new MapSchema<Minion>();
  @type({ map: TownPortal }) townPortals = new MapSchema<TownPortal>();
  @type({ map: GatherNode }) nodes = new MapSchema<GatherNode>();
}

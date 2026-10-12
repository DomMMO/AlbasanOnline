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
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Mob }) mobs = new MapSchema<Mob>();
  @type({ map: Loot }) loot = new MapSchema<Loot>();
}

// Shared between server and client. Changing a value here changes game behaviour on both sides.

export const TILE_SIZE = 16;

/** Server simulation rate. The client predicts its own movement at the same fixed rate. */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/** Pixels per second. */
export const PLAYER_SPEED = 80;

/**
 * Movement inputs the server may consume per tick when catching up after network jitter.
 * Sustained rate is still one input per tick, so sending inputs faster doesn't make you faster.
 */
export const MAX_INPUT_BURST = 3;

export const SERVER_PORT = 2567;
export const ROOM_WORLD = "world";

export const MAX_NAME_LENGTH = 16;

// ---- Combat ----------------------------------------------------------------

/** Max distance (feet to feet, px) for player melee attacks. */
export const MELEE_RANGE = 26;
/** Mobs stop chasing at this distance and start swinging. */
export const MOB_ATTACK_RANGE = 18;
/** A mob that gets this far from its spawn point gives up and walks home at full health. */
export const MOB_LEASH_RANGE = TILE_SIZE * 12;

export const GLOBAL_COOLDOWN_MS = 1000;
/** No damage dealt or taken for this long = out of combat (health regen, rage decay). */
export const COMBAT_TIMEOUT_MS = 5000;

// ---- Party -------------------------------------------------------------------

export const MAX_PARTY_SIZE = 5;
/** Party members this close to a kill share its XP. */
export const PARTY_XP_RANGE = TILE_SIZE * 40;
/** XP bonus per extra member who shares a kill (grouping is rewarded). */
export const PARTY_XP_BONUS = 0.2;
/** Bosses in a dungeon instance get this much more health per extra player. */
export const PARTY_BOSS_HP_PER_PLAYER = 0.6;
/** Warriors generate this much more threat (they are the tanks). */
export const WARRIOR_THREAT_MULTIPLIER = 2;
/** Threat per point healed, spread to the mobs fighting the healed player. */
export const HEAL_THREAT = 0.5;

// ---- PvP ----------------------------------------------------------------------

/** Player-vs-player damage is scaled down: skills are tuned against mobs with far more health. */
export const PVP_DAMAGE_MULTIPLIER = 0.5;
/** Fresh spawns in a PvP zone can't be hurt by players for this long (attacking ends it early). */
export const SPAWN_PROTECTION_MS = 5000;
/** Crowd control on players lasts this fraction of the normal duration. */
export const PVP_CC_MULTIPLIER = 0.5;
/** Killing the same player again within this window gives no rating (no farming alts). */
export const PVP_REPEAT_KILL_MS = 120_000;
export const PVP_START_RATING = 1000;

/** Tab targeting only considers targets within this distance. */
export const TAB_TARGET_RANGE = TILE_SIZE * 10;

// ---- Items & loot -------------------------------------------------------------

export const INVENTORY_SIZE = 32;
/** How close you must be to pick up loot / talk to an NPC. */
export const LOOT_RANGE = TILE_SIZE * 2;
export const NPC_RANGE = TILE_SIZE * 3;
/** Only the killer may loot for this long; afterwards anyone can. */
export const LOOT_OWNER_MS = 30_000;
export const LOOT_DESPAWN_MS = 90_000;

// ---- Player market (stalls) -----------------------------------------------------

/** Items one stall can list. */
export const STALL_SLOTS = 8;
export const STALL_TITLE_MAX = 24;
/** Highest price per unit (gold is stored as a 32-bit integer). */
export const STALL_MAX_PRICE = 100_000_000;
export const MAX_GOLD = 2_000_000_000;
/** How close you must be to browse or buy from a stall. */
export const STALL_RANGE = TILE_SIZE * 3;
/** Stalls can't be opened closer than this to another stall. */
export const STALL_SPACING = TILE_SIZE * 1.5;

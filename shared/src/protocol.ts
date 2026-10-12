import type { EquipSlot } from "./data/items";
import type { CombatStats } from "./data/progression";
import type { ZoneId } from "./zones";
import type { QuestProgress } from "./data/quests";

// Message names and payloads exchanged between client and server.

export const Msg = {
  // client -> server
  Input: "input",
  Ping: "ping",
  SetTarget: "setTarget",
  UseSkill: "useSkill",
  Respawn: "respawn",
  MoveItem: "moveItem",
  UseItem: "useItem",
  Unequip: "unequip",
  PickupLoot: "pickupLoot",
  Buy: "buy",
  Sell: "sell",
  Upgrade: "upgrade",
  UsePortal: "usePortal",
  Chat: "chat",
  /** Sent once the client's handlers are ready; the server replies with the inventory snapshot. */
  RequestInventory: "requestInventory",
  PartyRespond: "partyRespond",
  StallOpen: "stallOpen",
  StallClose: "stallClose",
  StallBrowse: "stallBrowse",
  StallBuy: "stallBuy",
  QuestAccept: "questAccept",
  QuestTurnIn: "questTurnIn",
  QuestAbandon: "questAbandon",
  // server -> client
  Pong: "pong",
  Combat: "combat",
  Attack: "attack",
  SkillUsed: "skillUsed",
  SkillError: "skillError",
  XpGained: "xpGained",
  LevelUp: "levelUp",
  Inventory: "inventory",
  Notice: "notice",
  UpgradeResult: "upgradeResult",
  Transfer: "transfer",
  BossCast: "bossCast",
  CastStart: "castStart",
  CastEnd: "castEnd",
  ChatMessage: "chatMessage",
  PvpKill: "pvpKill",
  PartyUpdate: "partyUpdate",
  PartyInvite: "partyInvite",
  /** A stall's contents (reply to StallBrowse, and pushed to browsers when it changes). */
  StallContents: "stallContents",
  /** The stall you were browsing closed. */
  StallClosed: "stallClosed",
  /** Your own stall: what is listed and still for sale (null = closed). */
  MyStall: "myStall",
  /** Your quest log (sent on join and whenever it changes). */
  QuestLog: "questLog",
} as const;

export interface QuestMessage {
  questId: string;
  /** NPC you are talking to (accept / turn in). */
  npcId?: string;
}

export interface QuestLogEvent {
  quests: QuestProgress[];
}

export type Axis = -1 | 0 | 1;

export interface InputMessage {
  /** Strictly increasing per client; the server echoes the last processed one as `lastSeq`. */
  seq: number;
  dx: Axis;
  dy: Axis;
}

export interface JoinOptions {
  /** Session token from the login API. */
  token: string;
  characterId: number;
  /** One-time pass from a portal; required to enter instanced zones. */
  ticket?: string;
}

export interface UsePortalMessage {
  portalId: string;
}

/** Tells the client to leave this room and join `zone` using `ticket`. */
export interface TransferEvent {
  zone: ZoneId;
  ticket: string;
  /** Join this existing instance (your party is already inside) instead of creating one. */
  roomId?: string;
}

/**
 * A boss starts a telegraphed ability. slam/leap: circle of `radius` at (x, y).
 * charge: lane of `width` from (x, y) to (toX, toY).
 */
export interface BossCastEvent {
  mobId: string;
  ability: "slam" | "leap" | "charge";
  x: number;
  y: number;
  radius?: number;
  toX?: number;
  toY?: number;
  width?: number;
  castMs: number;
}

/** WebSocket close code used when the same character logs in from somewhere else. */
export const CLOSE_LOGGED_IN_ELSEWHERE = 4001;

export interface SetTargetMessage {
  /** Mob id or another player's session id (friendly target), or null to clear. */
  targetId: string | null;
  /** Also start auto-attacking (click) vs. just select (Tab). */
  attack: boolean;
}

export interface UseSkillMessage {
  skillId: string;
}

export type EntityKind = "player" | "mob";

/** Broadcast whenever something takes damage or is healed. */
export interface CombatEvent {
  sourceId: string;
  targetId: string;
  targetKind: EntityKind;
  amount: number;
  crit: boolean;
  heal: boolean;
}

/** Broadcast once per swing/skill so clients can animate it (damage comes separately as CombatEvent). */
export interface AttackEvent {
  sourceId: string;
  sourceKind: EntityKind;
  /** Absent for untargeted skills such as Whirlwind. */
  targetId?: string;
  targetKind?: EntityKind;
  /** Skill id; absent for a plain auto-attack swing. */
  skill?: string;
}

/** Someone started a spell with a cast time (everyone sees it; the caster also gets a cast bar). */
export interface CastStartEvent {
  sourceId: string;
  skillId: string;
  castMs: number;
}

export interface CastEndEvent {
  sourceId: string;
  /** Moved, target lost, etc. */
  interrupted: boolean;
}

export interface PartyMemberView {
  characterId: number;
  name: string;
  cls: string;
  level: number;
  hp: number;
  maxHp: number;
  resource: number;
  maxResource: number;
  dead: boolean;
  online: boolean;
  leader: boolean;
  /** Where they are (only when online). */
  zone?: ZoneId;
  /** Their session id in their current room (to target them when in the same room). */
  sessionId?: string;
}

/** Sent to every member whenever the party changes, and a few times a second for live health. */
export interface PartyUpdateEvent {
  /** null = you are not in a party (left, kicked, disbanded). */
  partyId: string | null;
  members: PartyMemberView[];
}

export interface PartyInviteEvent {
  from: string;
}

export interface PartyRespondMessage {
  accept: boolean;
}

/** A player killed another player in a PvP zone. */
export interface PvpKillEvent {
  killer: string;
  victim: string;
  killerClass: string;
  victimClass: string;
  /** Rating change for the killer (0 = repeat kill or no rating). */
  ratingGain: number;
  /** Kills in a row without dying. */
  streak: number;
}

export interface ChatSendMessage {
  /** Plain text, or "/f Name message" to whisper. */
  text: string;
}

export type ChatChannel = "global" | "whisper" | "system" | "party";

export interface ChatEvent {
  channel: ChatChannel;
  text: string;
  /** Sender character name (absent for system messages). */
  from?: string;
  /** Sender session id when they are in the same room (speech bubble). */
  fromSession?: string;
  fromClass?: string;
  gm?: boolean;
  /** Whispers: the other side's name (for messages we sent). */
  to?: string;
}

/** Sent to the caster only, so the hotbar can start its cooldown sweep. */
export interface SkillUsedEvent {
  /** Skill id, or an item cooldown group such as "potion". */
  skillId: string;
  cooldownMs: number;
  gcdMs: number;
}

export interface SkillErrorEvent {
  message: string;
}

export interface XpGainedEvent {
  amount: number;
}

export interface LevelUpEvent {
  sessionId: string;
  level: number;
}

// ---- Items ----

export interface ItemView {
  uid: string;
  defId: string;
  qty: number;
  /** +N upgrade level (Phase 3). */
  enhance: number;
}

export type SlotRef = { area: "inv"; index: number } | { area: "equip"; slot: EquipSlot };

/** Full inventory snapshot, sent to the owner only whenever it changes. */
export interface InventoryEvent {
  gold: number;
  slots: (ItemView | null)[];
  equipment: Partial<Record<EquipSlot, ItemView>>;
  stats: CombatStats;
}

export interface MoveItemMessage {
  from: SlotRef;
  to: SlotRef;
}

/** Use/equip an inventory slot, or (hotbar) the first stack of an item. */
export interface UseItemMessage {
  index?: number;
  defId?: string;
}

export interface UnequipMessage {
  slot: EquipSlot;
}

export interface PickupLootMessage {
  lootId: string;
}

export interface BuyMessage {
  npcId: string;
  itemId: string;
  qty: number;
}

export interface SellMessage {
  npcId: string;
  index: number;
}

export interface UpgradeMessage {
  npcId: string;
  /** Item instance uid (must be in the inventory, not equipped). */
  uid: string;
  /** Spend a protection charm so a failure doesn't burn the item. */
  protect: boolean;
}

export type UpgradeOutcome = "success" | "failed" | "protected" | "burned";

export interface UpgradeResultEvent {
  outcome: UpgradeOutcome;
  defId: string;
  /** Upgrade level after the attempt (unchanged on failure). */
  enhance: number;
}

// ---- Player market ----

export interface StallListingInput {
  /** Inventory item uid. */
  uid: string;
  /** Price per unit in gold. */
  price: number;
}

export interface StallOpenMessage {
  title: string;
  items: StallListingInput[];
}

export interface StallBrowseMessage {
  /** Seller's session id. */
  sellerId: string;
}

export interface StallBuyMessage {
  sellerId: string;
  uid: string;
  qty: number;
  /** Price per unit the buyer saw; the sale fails if it changed. */
  price: number;
}

export interface StallListingView extends ItemView {
  price: number;
}

export interface StallContentsEvent {
  sellerId: string;
  seller: string;
  title: string;
  items: StallListingView[];
}

export interface StallClosedEvent {
  sellerId: string;
}

export interface MyStallEvent {
  stall: { title: string; items: StallListingView[] } | null;
}

/** Short feedback line for the player ("+5 altın", "Envanter dolu"). */
export interface NoticeEvent {
  message: string;
  color?: string;
}

export enum Direction {
  Down = 0,
  Up = 1,
  Left = 2,
  Right = 3,
}

/** Shape of a synced player as the client sees it (mirrors the server schema). */
export interface PlayerView {
  name: string;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  color: number;
  lastSeq: number;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  /** Class id (warrior, mage, priest). */
  cls: string;
  /** Rage or mana, depending on class. */
  resource: number;
  maxResource: number;
  /** Damage absorbed before health is lost (priest shield). */
  shield: number;
  /** Frozen in place (Frost Nova in PvP): can't move. */
  rooted: boolean;
  /** PvP spawn protection: players can't hurt this player yet. */
  protected: boolean;
  /** PvP stats, shown on the nameplate tooltip and leaderboard. */
  pvpRating: number;
  pvpKills: number;
  pvpDeaths: number;
  dead: boolean;
  /** Equipped weapon def id ("" = none) and its +N, so everyone can draw it. */
  weapon: string;
  weaponPlus: number;
  /** Worn armour def ids ("" = nothing), drawn on the character for everyone. */
  gearHead: string;
  gearChest: string;
  gearLegs: string;
  gearFeet: string;
  /** Market stall title ("" = no stall open). */
  stall: string;
}

export interface MobView {
  kind: string;
  enraged: boolean;
  rooted: boolean;
  /** Session id of the player it is attacking ("" = none): shows tanks who has aggro. */
  aggroId: string;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  level: number;
  hp: number;
  maxHp: number;
}

export interface LootView {
  x: number;
  y: number;
  /** sessionId of the player who may loot it; "" = anyone. */
  owner: string;
}

export function isAxis(v: unknown): v is Axis {
  return v === -1 || v === 0 || v === 1;
}

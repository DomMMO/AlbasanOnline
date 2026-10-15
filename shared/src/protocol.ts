import type { EquipSlot } from "./data/items";
import type { Affix } from "./data/affixes";
import type { PassiveSocketView } from "./data/passives";
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
  /** Friends: send a request by character name. */
  FriendRequest: "friendRequest",
  /** Friends: accept or decline someone's request. */
  FriendRespond: "friendRespond",
  /** Friends: remove a friend, or withdraw a request you sent. */
  FriendRemove: "friendRemove",
  DuelRespond: "duelRespond",
  StallOpen: "stallOpen",
  StallClose: "stallClose",
  StallBrowse: "stallBrowse",
  StallBuy: "stallBuy",
  QuestAccept: "questAccept",
  QuestTurnIn: "questTurnIn",
  /** Ask an NPC the question a "talk" quest objective needs. */
  QuestTalk: "questTalk",
  QuestAbandon: "questAbandon",
  /** Life skills: start gathering a vein or herb. */
  Gather: "gather",
  /** Inventory: stack and sort the bags. */
  SortInventory: "sortInventory",
  /** Inventory: put a bag stack on the ground at your feet. */
  DropItem: "dropItem",
  /** Inventory: destroy a bag stack for good. */
  DestroyItem: "destroyItem",
  /** Party ping on the map (Alt+click). */
  MapPing: "mapPing",
  /** Skill page: add (+1) or take back (-1) a rank; or reset all. */
  SkillRank: "skillRank",
  /** Ayşe Teyze: read today's fortune. */
  ReadFortune: "readFortune",
  /** Sit on a bench (town): the nearest free seat of it. Moving gets you up. */
  Sit: "sit",
  /** Stable: buy a breed, ride another of yours, or restyle the ridden one. */
  HorseBuy: "horseBuy",
  HorseSelect: "horseSelect",
  HorseStyle: "horseStyle",
  /** Petçi: buy a pet (it comes out with you). */
  PetBuy: "petBuy",
  /** Call one of your pets out, or send the one that is out home (pet: ""). */
  PetSummon: "petSummon",
  /** A novice asks a master in the keep to take them on (their class). */
  ChooseClass: "chooseClass",
  /** Ayşe Teyze: undo the class choice for gold (back to novice). */
  ResetClass: "resetClass",
  /** T: open a town portal where you stand. */
  OpenTownPortal: "openTownPortal",
  UseTownPortal: "useTownPortal",
  /** Storage: move gold between purse and storage (+ deposit, - withdraw). */
  StorageGold: "storageGold",
  /** Storage: right-click an item to send it to the other side (bag <-> storage). */
  StorageQuick: "storageQuick",
  TradeRespond: "tradeRespond",
  /** Replace your whole offer (only while not locked). */
  TradeOffer: "tradeOffer",
  /** Freeze your offer; once both sides have, each confirms. */
  TradeLock: "tradeLock",
  TradeConfirm: "tradeConfirm",
  TradeCancel: "tradeCancel",
  /** Answer to "your party member entered a dungeon: come along?". */
  DungeonRespond: "dungeonRespond",
  /** Cast the fishing rod, or reel it in. */
  Fish: "fish",
  /** Get on the horse, or off it. */
  Mount: "mount",
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
  /** The map editor changed this zone's map: fetch the edits again and rebuild the ground. */
  MapChanged: "mapChanged",
  BossCast: "bossCast",
  CastStart: "castStart",
  CastEnd: "castEnd",
  ChatMessage: "chatMessage",
  PvpKill: "pvpKill",
  PartyUpdate: "partyUpdate",
  PartyInvite: "partyInvite",
  DuelInvite: "duelInvite",
  /** Your duel started or ended (only the two duellists get it). */
  DuelState: "duelState",
  /** A stall's contents (reply to StallBrowse, and pushed to browsers when it changes). */
  StallContents: "stallContents",
  /** The stall you were browsing closed. */
  StallClosed: "stallClosed",
  /** Your own stall: what is listed and still for sale (null = closed). */
  MyStall: "myStall",
  /** Your quest log (sent on join and whenever it changes). */
  QuestLog: "questLog",
  /** Your skill ranks and free points (sent on join and whenever they change). */
  SkillRanks: "skillRanks",
  /** Today's fortune (after asking, and on join if one was read today). */
  Fortune: "fortune",
  /** Your buffs and debuffs (sent when they change). */
  Auras: "auras",
  /** Your life skill levels (on join and when they change). */
  LifeSkills: "lifeSkills",
  /** Gathering started (cast bar) or ended. */
  GatherStart: "gatherStart",
  GatherEnd: "gatherEnd",
  /** A party member pinged the map. */
  PingEvent: "pingEvent",
  TradeInvite: "tradeInvite",
  /** Your horses (on join and whenever they change). */
  HorseState: "horseState",
  /** Your pets (on join and whenever they change). */
  PetState: "petState",
  /** Your friend list and requests (on join and whenever they or a friend's status change). */
  FriendList: "friendList",
  /** A party member nearby just went into a dungeon: join them? */
  DungeonInvite: "dungeonInvite",
  /** Someone in the zone caught something (splash on their float). */
  FishCatch: "fishCatch",
  /** Your trade window: both offers (null = the trade is over). */
  TradeState: "tradeState",
} as const;

export interface QuestMessage {
  questId: string;
  /** NPC you are talking to (accept / turn in). */
  npcId?: string;
  /** Turn-in of a quest with a quiz: the option chosen. */
  answer?: string;
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
  /** Shift held: gallop if mounted. */
  sprint?: boolean;
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

export interface SkillRankMessage {
  /** Skill or passive id. */
  id: string;
  delta: 1 | -1;
}

export interface SkillRanksEvent {
  ranks: Record<string, number>;
  /** Points not spent yet. */
  points: number;
}

export interface GatherMessage {
  nodeId: string;
}

export interface GatherStartEvent {
  name: string;
  skill: string;
  ms: number;
}

export interface GatherEndEvent {
  interrupted: boolean;
}

export interface LifeSkillsEvent {
  skills: Record<string, { level: number; xp: number; next: number }>;
}

export type PingKind = "alert" | "attack" | "help" | "move";

export interface MapPingMessage {
  kind: PingKind;
  x: number;
  y: number;
  /** Mob pinged (attack). */
  targetId?: string;
}

export interface PingEvent {
  from: string;
  kind: PingKind;
  x: number;
  y: number;
  zone: string;
  /** What was pinged (a mob's name), if anything. */
  target?: string;
}

/** A buff or debuff on you. `icon` is a skill id, or an "aura_*" icon for effects that aren't skills. */
export interface AuraView {
  id: string;
  icon: string;
  kind: "buff" | "debuff";
  /** null = lasts until something ends it (today's fortune). */
  remainingMs: number | null;
}

export interface AurasEvent {
  auras: AuraView[];
}

export interface FortuneEvent {
  good: boolean;
  /** What Ayşe Teyze says (absent when just restoring today's state on join). */
  text?: string;
  /** Added to upgrade success chances today (0 on a bad day). */
  upgradeBonus: number;
}

export interface UseTownPortalMessage {
  /** Key in the room state's townPortals. */
  portalId: string;
}

/** A player's town portal: the far end leads to town, the town end (`back`) leads back out. */
export interface TownPortalView {
  owner: string;
  x: number;
  y: number;
  /** Destination zone id. */
  to: string;
  back: boolean;
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
  /** World position under the mouse: free dashes (blink and the like) go towards it. */
  aim?: { x: number; y: number };
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
  /** "minion" = a necromancer's summon. */
  sourceKind: EntityKind | "minion";
  /** Absent for untargeted skills such as Whirlwind. */
  targetId?: string;
  targetKind?: EntityKind;
  /** Skill id; absent for a plain auto-attack swing. */
  skill?: string;
  /** Dashes: where the caster set off from (its new position arrives with the state). */
  fromX?: number;
  fromY?: number;
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

export interface HorseStateEvent {
  owned: string[];
  active: string;
  looks: Record<string, { coat: number; mane: number; blanket: number; saddle: number }>;
}

export interface PetStateEvent {
  owned: string[];
  /** The pet that is out; "" = none. */
  active: string;
}

export interface PetBuyMessage {
  npcId: string;
  pet: string;
}

export interface PetSummonMessage {
  pet: string;
}

export interface FriendView {
  characterId: number;
  name: string;
  cls: string;
  level: number;
  online: boolean;
  /** Where they are, when online. */
  zone?: ZoneId;
}

export interface FriendListEvent {
  friends: FriendView[];
  /** Requests waiting for your answer. */
  incoming: FriendView[];
  /** Requests you sent that are still unanswered. */
  outgoing: FriendView[];
}

export interface FriendRequestMessage {
  name: string;
}

export interface FriendRespondMessage {
  characterId: number;
  accept: boolean;
}

export interface FriendRemoveMessage {
  characterId: number;
}

export interface PartyRespondMessage {
  accept: boolean;
}

export interface DuelInviteEvent {
  from: string;
}

export interface DuelRespondMessage {
  accept: boolean;
}

export interface DuelStateEvent {
  /** Session id of the player you are fighting, or null when the duel is over. */
  opponent: string | null;
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
  /** Random modifiers (equipment only): 1 = worst, 5 = best. */
  affixes?: Affix[];
}

/** passive: big socket `socket`; `minor` = one of its small sockets (null = the big one). storage: the Depocu's slots. */
export type SlotRef =
  | { area: "inv"; index: number }
  | { area: "storage"; index: number }
  | { area: "equip"; slot: EquipSlot }
  | { area: "passive"; socket: number; minor: number | null };

/** Full inventory snapshot, sent to the owner only whenever it changes. */
export interface InventoryEvent {
  gold: number;
  slots: (ItemView | null)[];
  equipment: Partial<Record<EquipSlot, ItemView>>;
  /** Passive tree: 20 big sockets, each with 5 small ones. */
  passives: PassiveSocketView[];
  /** What is kept at the Depocu (the window only opens next to it). */
  storage: { gold: number; slots: (ItemView | null)[] };
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

/** DropItem and DestroyItem: the bag slot. */
export interface BagSlotMessage {
  index: number;
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

// ---- Storage ----

export interface StorageGoldMessage {
  /** Positive: put gold in storage. Negative: take it out. */
  amount: number;
  npcId: string;
}

export interface StorageQuickMessage {
  from: { area: "inv" | "storage"; index: number };
  npcId: string;
}

// ---- Fishing ----

export interface FishCatchEvent {
  sessionId: string;
  /** Item id of the catch. */
  item: string;
}

// ---- Party dungeons ----

export interface DungeonInviteEvent {
  from: string;
  /** Dungeon name. */
  dungeon: string;
}

export interface DungeonRespondMessage {
  accept: boolean;
}

// ---- Player trade ----

export interface TradeInviteEvent {
  from: string;
}

export interface TradeRespondMessage {
  accept: boolean;
}

export interface TradeOfferMessage {
  /** Inventory item uids (whole stacks). */
  items: string[];
  gold: number;
}

export interface TradeSideView {
  items: ItemView[];
  gold: number;
  locked: boolean;
  confirmed: boolean;
}

export interface TradeStateEvent {
  /** null = no trade open (finished or cancelled). */
  trade: { partner: string; partnerId: string; mine: TradeSideView; theirs: TradeSideView } | null;
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
  /** Kalkan Duvarı is up (takes less damage). */
  guarded: boolean;
  /** Can't move or act (stun skills in PvP). */
  stunned: boolean;
  /** A buff skill is running (glow). */
  buffed: boolean;
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
  /** Chosen at character creation. */
  gender: string;
  hairStyle: string;
  hairColor: number;
  skin: number;
  /** Game master account. */
  gm: boolean;
  /** Riding a horse. */
  mounted: boolean;
  /** Galloping (Shift on horseback) this tick. */
  galloping: boolean;
  /** Sitting on a bench. */
  seated: boolean;
  /** Breed of the horse they ride (data/horses.ts): sets riding speed. */
  horse: string;
  /** Its colours, encodeHorseLook(). */
  horseLook: string;
  /** Fishing: the float lies on the water at (fishX, fishY). */
  fishing: boolean;
  fishX: number;
  fishY: number;
}

export interface MobView {
  kind: string;
  enraged: boolean;
  rooted: boolean;
  /** Session id of the player it is attacking ("" = none): shows tanks who has aggro. */
  aggroId: string;
  /** Stronger than normal: an outdoor mob at night, or a night-only creature. */
  empowered: boolean;
  /** Stunned: can't move or attack. */
  stunned: boolean;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  level: number;
  hp: number;
  maxHp: number;
}

/** A player's summoned minion (necromancer skeleton). Friendly to its owner's party. */
export interface MinionView {
  /** Skill that summoned it (its look and name come from the skill). */
  skill: string;
  ownerId: string;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
}

/** A mining vein or herb (life skills). */
export interface GatherNodeView {
  kind: string;
  x: number;
  y: number;
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

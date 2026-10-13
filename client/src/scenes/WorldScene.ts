import Phaser from "phaser";
import { getStateCallbacks, type Room } from "colyseus.js";
import {
  castSpot,
  sanitizeLook,
  Direction,
  RARITY_COLORS,
  directionFrom,
  directionToward,
  distance,
  isUpgradeable,
  itemSellPrice,
  ITEMS,
  LOOT_RANGE,
  MELEE_RANGE,
  type Axis,
  MOBS,
  Msg,
  NPC_RANGE,
  NPCS,
  PORTAL_RANGE,
  AUTO_GATE_RANGE,
  STALL_RANGE,
  Tile,
  ZONES,
  zoneLayout,
  SKILLS,
  stepMovement,
  TAB_TARGET_RANGE,
  TICK_MS,
  TILE_SIZE,
  xpToNextLevel,
  classOf,
  type Appearance,
  type AttackEvent,
  type CastEndEvent,
  type CastStartEvent,
  type ChatEvent,
  type PvpKillEvent,
  type PartyInviteEvent,
  type PartyUpdateEvent,
  type DuelInviteEvent,
  type DuelStateEvent,
  type TradeInviteEvent,
  type FishCatchEvent,
  type DungeonInviteEvent,
  type TradeStateEvent,
  type SkillDef,
  type BossCastEvent,
  type PortalDef,
  type TransferEvent,
  type WorldMap,
  type ZoneDef,
  type ZoneId,
  type CombatEvent,
  type InputMessage,
  type InventoryEvent,
  type LevelUpEvent,
  type LootView,
  type MobView,
  type MinionView,
  type TownPortalView,
  type SkillRanksEvent,
  type FortuneEvent,
  type AurasEvent,
  type NoticeEvent,
  type NpcDef,
  type UpgradeResultEvent,
  type PlayerView,
  type SetTargetMessage,
  type SkillErrorEvent,
  type SkillUsedEvent,
  type XpGainedEvent,
  type MyStallEvent,
  type StallClosedEvent,
  type StallContentsEvent,
  type QuestLogEvent,
} from "../../../shared/src";
import { EntityView, type SwingKind } from "../entities/EntityView";
import { setDollLook, updateDoll } from "../ui/doll";
import { addChatMessage, initChat } from "../ui/chat";
import { addKillFeed, initLeaderboard, setPvpStats, toggleLeaderboard } from "../ui/pvp";
import { initParty, renderParty, showInvite } from "../ui/party";
import { initDuel, showDuelInvite } from "../ui/duel";
import { initDungeonInvite, showDungeonInvite } from "../ui/dungeonInvite";
import { initFishButton, setFishButton } from "../ui/fishButton";
import { FishingLines, fishSplash } from "../fx/fishing";
import { closeStorage, initStorage, openStorage, storageNpc, updateStorage } from "../ui/storage";
import { addToTrade, initTrade, isTradeOpen, onTradeState, showTradeInvite } from "../ui/trade";
import { drawMinimap, setMinimapZone, toggleMinimap, type MinimapDot } from "../ui/minimap";
import { isMenuOpen, menuBack, openMenu } from "../ui/menu";
import { closeTopWindow, registerWindow } from "../ui/windows";
import { getSettings, onSettingsChange } from "../settings";
import { boneBurst, burst, castingGlow, frostRing, healSparkles, holyBeam, lightning, projectile, stunStars } from "../fx/spells";
import { initPassives, togglePassives, updatePassives } from "../ui/passives";
import { cursor } from "../gfx/cursors";
import { getBindings, onBindingsChange } from "../input/keybindings";
import { setAuras } from "../ui/auras";
import { initPotions, refreshPotionKeys, render as renderPotions, startPotionCooldown, usePotion } from "../ui/potions";
import { isTouchDevice } from "../ui/touch";
import { initSkills, setSkillRanks, skillRank, toggleSkills } from "../ui/skills";
import { hideSkillTooltip, showSkillTooltip } from "../ui/skillTooltip";
import { hideTooltip, showItemTooltip } from "../ui/tooltip";
import { initDamageMeter, recordCombat } from "../ui/damageMeter";
import { INTERPOLATION_DELAY_MS, SnapshotBuffer } from "../entities/SnapshotBuffer";
import { floatingText } from "../fx/floatingText";
import { ringEffect } from "../fx/slash";
import { preloadImageSprites } from "../gfx/imageSprites";
import { createTileset, renderTiles, TILESET_KEY } from "../gfx/textures";
import { drawDecor } from "../gfx/decor";
import {
  closeNpcDialog,
  dialogNpc,
  initQuests,
  npcMarker,
  openNpcDialog,
  refreshQuests,
  setQuestLog,
  showFortune,
  toggleQuestLog,
} from "../ui/quests";
import { gateAura, teleportIn, teleportOut } from "../fx/teleport";
import {
  addToStall,
  browsingSeller,
  closeBrowse,
  initMarket,
  isStallOpen,
  isStallSetupOpen,
  onMyStall,
  onStallClosed,
  refreshMarket,
  setStallButtonVisible,
  showStallContents,
} from "../ui/market";
import { Action, HOTBAR_ACTIONS, InputManager, setInputBlocker } from "../input/InputManager";
import * as hud from "../ui/hud";
import { countItem, initInventory, inventoryState, toggleInventory, updateInventory } from "../ui/inventory";
import { closeShop, initShop, openShop, openShopNpc, refreshShop } from "../ui/shop";
import { closeUpgrade, initUpgrade, openUpgrade, openUpgradeNpc, refreshUpgrade, selectForUpgrade, setUpgradeFortune, showUpgradeResult } from "../ui/upgrade";

const PING_INTERVAL_MS = 2000;

const HOTBAR_SLOTS = 10;

/**
 * The player's hotbar layout: 10 skill slots (no potions; those are used from the bags).
 * Arranged by dragging; saved per character in this browser. Default: the class's skills in order.
 */
function loadHotbarLayout(name: string, cls: string): string[] {
  const skills = classOf(cls).skills;
  let layout: string[] = [...skills];
  try {
    const saved = JSON.parse(localStorage.getItem(`mmo-hotbar:${name}`) ?? "null");
    if (Array.isArray(saved)) layout = saved.map((id) => (typeof id === "string" && skills.includes(id) ? id : ""));
  } catch {
    // no saved layout
  }
  return Array.from({ length: HOTBAR_SLOTS }, (_, i) => layout[i] ?? "");
}

function saveHotbarLayout(name: string, layout: string[]) {
  try {
    localStorage.setItem(`mmo-hotbar:${name}`, JSON.stringify(layout));
  } catch {
    // storage blocked: the layout lasts until the page is closed
  }
}

function hotbarFor(layout: string[]): hud.HotbarEntry[] {
  return layout.map((id) =>
    id && SKILLS[id] ? { kind: "skill" as const, skill: SKILLS[id], locked: skillRank(id) === 0 } : { kind: "empty" as const },
  );
}

const FRIENDLY_COLOR = 0x4cd964;
const HOSTILE_COLOR = 0xffe14d;
/** Other players in PvP zones. */
const ENEMY_PLAYER_COLOR = 0xff5a5a;
/** A correction bigger than this is a teleport (respawn), not a prediction error: don't blend. */
const TELEPORT_DISTANCE = 32;

interface Point {
  x: number;
  y: number;
}

/** A player's look: tunic colour plus whatever armour they wear. */
/** The parts of a humanoid appearance a player chose at character creation. */
export function lookAppearance(look: { gender: string; hairStyle: string; hairColor: number; skin: number }) {
  const valid = sanitizeLook(look);
  return { gender: valid.gender, hairStyle: valid.hairStyle, hair: valid.hairColor, skin: valid.skin };
}

function playerAppearance(player: PlayerView): Appearance {
  return {
    type: "humanoid",
    tunic: player.color,
    ...lookAppearance(player),
    headwear: classOf(player.cls).headwear,
    gear: {
      head: player.gearHead || undefined,
      chest: player.gearChest || undefined,
      legs: player.gearLegs || undefined,
      feet: player.gearFeet || undefined,
    },
  };
}

/** Our own character: moved immediately by local input, corrected by the server. */
interface LocalPlayer {
  state: PlayerView;
  view: EntityView;
  /** Positions at the previous and current fixed tick; rendering blends between them. */
  prev: Point;
  curr: Point;
  dir: Direction;
  moving: boolean;
}

/** Anything we only observe: other players and mobs. */
interface Remote<T> {
  state: T;
  view: EntityView;
  buffer: SnapshotBuffer;
}

export interface WorldSceneData {
  room: Room;
  zone: ZoneId;
  /** Called when the server sends us through a portal. */
  onTransfer: (event: TransferEvent) => void;
  /** We came here through a portal (play the arrival effect). */
  arrived?: boolean;
}

/** Awning, rug and title sign drawn around a player with an open market stall. */
interface StallView {
  title: string;
  back: Phaser.GameObjects.Graphics;
  sign: Phaser.GameObjects.Text;
}

export class WorldScene extends Phaser.Scene {
  private room!: Room;
  private zone!: ZoneDef;
  private map!: WorldMap;
  private onTransfer!: (event: TransferEvent) => void;
  private controls!: InputManager;
  private portals: { def: PortalDef; view: EntityView }[] = [];
  private bossId: string | null = null;
  private hotbar: hud.HotbarEntry[] = [];
  private hotbarLayout: string[] = [];
  /** Our party: id (for loot ownership) and members' session ids in this room. */
  private party: { id: string | null; sessions: Set<string> } = { id: null, sessions: new Set() };
  /** Session id of the player we are duelling (fight started), or null. */
  private duelOpponent: string | null = null;
  /** Standing on the market square last frame (to greet the player when they step on it). */
  private wasInMarket = false;
  /** Game time of the next minimap redraw (a few times a second is plenty). */
  private nextMinimapAt = 0;
  /** Re-checks a loot chest's visibility (ownership can change with the party). */
  private lootSyncs = new Map<string, () => void>();
  /** Pulsing rings under players who are casting, by session id. */
  private castGlows = new Map<string, () => void>();
  private shieldBubbles = new Map<string, Phaser.GameObjects.Graphics>();
  /** Last telegraph per boss, to place the landing effect when it resolves. */
  private lastCasts = new Map<string, BossCastEvent>();
  private stalls = new Map<string, StallView>();
  /** "!" / "?" over quest NPCs. */
  private npcMarkers: { npc: NpcDef; text: Phaser.GameObjects.Text }[] = [];
  private npcViews = new Map<string, EntityView>();
  private fishingLines!: FishingLines;
  private arrived = false;
  /** Teleporting out: no more input, the scene is about to be replaced. */
  private leaving = false;
  /** Our own dash in progress: the view glides from the take-off point to the landing spot. */
  private dashGlide: { from: Point; start: number; ms: number } | null = null;
  /**
   * Left click on something out of reach: walk straight at it (like holding the keys), then
   * run `act` once close enough. Any key press, or getting stuck on a wall, cancels it.
   */
  private approach: { target: () => Point | undefined; range: number; act: () => void; lastPos: Point; stuckTicks: number } | null = null;
  /** Teleport gates only fire once we have stepped away from them (not right after arriving next to one). */
  private gatesArmed = false;

  private local?: LocalPlayer;
  private players = new Map<string, Remote<PlayerView>>();
  private mobs = new Map<string, Remote<MobView>>();
  /** Summoned minions (necromancer skeletons). */
  private minions = new Map<string, Remote<MinionView>>();
  /** Town portal ends standing in this zone (T). */
  private townPortals = new Map<string, { state: TownPortalView; view: EntityView }>();
  private loot = new Map<string, { state: LootView; view: EntityView }>();

  private targetId: string | null = null;
  private targetRing!: Phaser.GameObjects.Graphics;

  /** Inputs sent to the server but not yet acknowledged via `lastSeq`. */
  private pendingInputs: InputMessage[] = [];
  private nextSeq = 1;
  private tickAccumulator = 0;

  constructor() {
    super("world");
  }

  init(data: WorldSceneData) {
    this.room = data.room;
    this.zone = ZONES[data.zone];
    this.map = zoneLayout(data.zone).map;
    this.onTransfer = data.onTransfer;
    this.arrived = data.arrived ?? false;
  }

  preload() {
    preloadImageSprites(this);
  }

  create() {
    createTileset(this);
    const tilemap = this.make.tilemap({ data: renderTiles(this.map.tiles), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0)!;
    tilemap.createLayer(0, tileset, 0, 0)!.setDepth(-1);
    const decor = zoneLayout(this.zone.id).decor;
    if (decor) drawDecor(this, decor);
    this.fishingLines = new FishingLines(this);
    setMinimapZone(this.map, this.zone.name);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.map.width * TILE_SIZE, this.map.height * TILE_SIZE);
    camera.setRoundPixels(true);
    this.fitZoom();
    const onResize = () => this.fitZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    const stopWatchingSettings = onSettingsChange(() => this.fitZoom());
    // The scale manager and settings outlive this scene (it is replaced on every zone change).
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      stopWatchingSettings();
    });

    this.targetRing = this.add.graphics().setDepth(0).setVisible(false);
    this.targetRing.lineStyle(1, 0xffe14d, 1).strokeEllipse(0, 0, 18, 7);

    // The canvas's own cursor; hovering something clickable swaps in that thing's cursor.
    this.input.setDefaultCursor(cursor("default"));

    for (const npc of this.zone.npcs.map((id) => NPCS[id])) {
      const view = new EntityView(this, npc.x, npc.y, npc.appearance, npc.name, "#7fe3ff");
      this.npcViews.set(npc.id, view);
      view.sprite.setInteractive({ cursor: cursor("talk") });
      view.sprite.on("pointerdown", () => this.walkTo(() => npc, NPC_RANGE - 4, () => this.talkTo(npc)));
      const marker = this.add
        .text(Math.round(npc.x), Math.round(view.headY) - 10, "", {
          fontFamily: "Courier New, monospace",
          fontSize: "12px",
          fontStyle: "bold",
          color: "#ffd34d",
          stroke: "#000000",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setResolution(4)
        .setDepth(100001 + npc.y);
      this.tweens.add({ targets: marker, y: marker.y - 2, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.npcMarkers.push({ npc, text: marker });
    }
    for (const def of this.zone.portals) {
      const label = def.minLevel ? `${def.label} (Sv ${def.minLevel}+)` : def.label;
      const view = new EntityView(this, def.x, def.y, { type: "portal", style: def.style }, label, "#ffb347");
      view.sprite.setInteractive({ cursor: cursor("portal") });
      view.sprite.on("pointerdown", () => this.walkTo(() => def, PORTAL_RANGE - 4, () => this.usePortal(def)));
      if (def.style === "gate") gateAura(this, def);
      this.portals.push({ def, view });
    }

    this.bindControls();
    this.bindState();
    this.bindMessages();

    this.time.addEvent({
      delay: PING_INTERVAL_MS,
      loop: true,
      callback: () => this.room.send(Msg.Ping, performance.now()),
    });
  }

  private fitZoom() {
    const { zoom } = getSettings();
    // Auto: roughly 30 tiles across on desktop, never smaller than 2x so pixels stay chunky.
    this.cameras.main.setZoom(zoom === "auto" ? Math.max(2, Math.floor(this.scale.width / 480)) : Number(zoom));
  }

  // ---- Wiring ---------------------------------------------------------------

  private bindControls() {
    this.controls = new InputManager(this, getBindings());
    // Key bindings changed in the menu: take effect at once, hotbar labels included.
    const stopBindings = onBindingsChange(() => {
      this.controls.rebind(getBindings());
      hud.refreshKeyLabels();
      refreshPotionKeys();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopBindings);
    this.controls.onPressed(Action.TargetNext, () => this.cycleTarget());
    document.getElementById("death-text")!.textContent = this.zone.respawnText;
    this.controls.onPressed(Action.Leaderboard, () => toggleLeaderboard());
    initLeaderboard();
    // Esc: menu first (it sits on top of everything), then the most recently opened
    // window, then the target; with nothing left to close it opens the menu.
    setInputBlocker(isMenuOpen);
    registerWindow("inventory-window", () => toggleInventory(false));
    registerWindow("shop-window", closeShop);
    registerWindow("upgrade-window", closeUpgrade);
    registerWindow("npc-dialog", closeNpcDialog);
    registerWindow("quest-log", () => toggleQuestLog(false));
    registerWindow("passive-window", () => togglePassives(false));
    registerWindow("skills-window", () => toggleSkills(false));
    registerWindow("leaderboard", () => void toggleLeaderboard(false));
    registerWindow("stall-browse", closeBrowse);
    registerWindow("storage-window", closeStorage);
    registerWindow("trade-window", () => this.room.send(Msg.TradeCancel));
    this.controls.onPressed(Action.ClearTarget, () => {
      if (isMenuOpen()) return menuBack();
      if (closeTopWindow()) return;
      if (this.targetId) return this.selectTarget(null, false);
      openMenu();
    });
    this.controls.onPressed(Action.Attack, () => this.targetId && this.selectTarget(this.targetId, true));
    this.controls.onPressed(Action.ToggleInventory, () => toggleInventory());
    this.controls.onPressed(Action.Interact, () => this.interact());
    this.controls.onPressed(Action.QuestLog, () => toggleQuestLog());
    this.controls.onPressed(Action.PassiveTree, () => togglePassives());
    this.controls.onPressed(Action.Skills, () => toggleSkills());
    this.controls.onPressed(Action.Potion1, () => usePotion(0));
    this.controls.onPressed(Action.Potion2, () => usePotion(1));
    this.controls.onPressed(Action.Minimap, () => toggleMinimap());
    this.controls.onPressed(Action.TownPortal, () => {
      if (this.local && !this.local.state.dead && !this.leaving) this.room.send(Msg.OpenTownPortal);
    });
    HOTBAR_ACTIONS.forEach((action, index) => this.controls.onPressed(action, () => this.useHotbar(index)));

    initChat((text) => this.room.send(Msg.Chat, { text }));
    initParty({
      select: (member) => {
        if (member.sessionId && this.players.has(member.sessionId)) this.selectTarget(member.sessionId, false);
      },
      respond: (accept) => this.room.send(Msg.PartyRespond, { accept }),
      leave: () => this.room.send(Msg.Chat, { text: "/ayril" }),
    });
    initDuel((accept) => this.room.send(Msg.DuelRespond, { accept }));
    initDungeonInvite((accept) => this.room.send(Msg.DungeonRespond, { accept }));
    initFishButton(() => this.room.send(Msg.Fish));
    initTrade({
      respond: (accept) => this.room.send(Msg.TradeRespond, { accept }),
      offer: (items, gold) => this.room.send(Msg.TradeOffer, { items, gold }),
      lock: () => this.room.send(Msg.TradeLock),
      confirm: () => this.room.send(Msg.TradeConfirm),
      cancel: () => this.room.send(Msg.TradeCancel),
      playerLevel: () => this.local?.state.level ?? 1,
    });
    hud.onRespawnClicked(() => this.room.send(Msg.Respawn));

    const playerLevel = () => this.local?.state.level ?? 1;
    initInventory({
      move: (from, to) => this.room.send(Msg.MoveItem, { from, to }),
      activate: (index) => {
        if (isTradeOpen()) return void addToTrade(index);
        const keeper = storageNpc();
        if (keeper) return this.room.send(Msg.StorageQuick, { npcId: keeper.id, from: { area: "inv", index } });
        if (openUpgradeNpc()) {
          if (!selectForUpgrade(index)) hud.showMessage("Bu item yükseltilemez");
          return;
        }
        if (isStallSetupOpen() && !isStallOpen()) return void addToStall(index);
        const npc = openShopNpc();
        if (npc) this.room.send(Msg.Sell, { npcId: npc.id, index });
        else this.room.send(Msg.UseItem, { index });
      },
      unequip: (slot) => this.room.send(Msg.Unequip, { slot }),
      activateHint: (index) => {
        const item = inventoryState()?.slots[index];
        const def = item && ITEMS[item.defId];
        if (!item || !def) return "";
        if (isTradeOpen()) return def.questItem ? "Görev eşyası takas edilemez" : "Sağ tık: takasa koy";
        if (storageNpc()) return "Sağ tık: depoya koy";
        if (openUpgradeNpc()) return isUpgradeable(def) ? "Sağ tık: yükseltmeye koy" : "Yükseltilemez";
        if (isStallSetupOpen() && !isStallOpen()) return "Sağ tık: tezgâha koy";
        if (openShopNpc()) return `Sağ tık: sat (${itemSellPrice(def, item.affixes) * item.qty} altın)`;
        if (def.fishingRod) return this.zone.fishing ? "Sağ tık: balık tut (suyun kenarında)" : "Liman'da balık tutmak için";
        if (def.slot) return "Sağ tık: kuşan";
        if (def.jewel) return "Sağ tık: pasif ağaca tak (P)";
        if (def.heal || def.mana || def.recall) return "Sağ tık: kullan";
        return `Satış değeri: ${itemSellPrice(def, item.affixes) * item.qty} altın`;
      },
      playerLevel,
    });
    initPassives({ move: (from, to) => this.room.send(Msg.MoveItem, { from, to }), playerLevel });
    initSkills({
      change: (id, delta) => this.room.send(Msg.SkillRank, { id, delta }),
      reset: () => this.room.send(Msg.SkillReset),
      playerLevel,
      playerClass: () => this.local?.state.cls ?? "warrior",
    });
    initShop({
      buy: (npcId, itemId, qty) => this.room.send(Msg.Buy, { npcId, itemId, qty }),
      sell: (npcId, index) => this.room.send(Msg.Sell, { npcId, index }),
      playerLevel,
      gold: () => inventoryState()?.gold ?? 0,
    });
    initUpgrade({
      upgrade: (npcId, uid, protect) => this.room.send(Msg.Upgrade, { npcId, uid, protect }),
    });
    initQuests({
      accept: (npcId, questId) => this.room.send(Msg.QuestAccept, { questId, npcId }),
      turnIn: (npcId, questId) => this.room.send(Msg.QuestTurnIn, { questId, npcId }),
      abandon: (questId) => this.room.send(Msg.QuestAbandon, { questId }),
      openShop: (npc) => this.openNpcWindow(npc),
      openUpgrade: (npc) => this.openNpcWindow(npc),
      readFortune: (npcId) => this.room.send(Msg.ReadFortune, { npcId }),
      playerLevel,
      playerClass: () => this.local?.state.cls ?? "warrior",
      changed: () => this.refreshNpcMarkers(),
    });
    initStorage({
      move: (from, to) => this.room.send(Msg.MoveItem, { from, to }),
      quick: (npcId, from) => this.room.send(Msg.StorageQuick, { npcId, from }),
      gold: (npcId, amount) => this.room.send(Msg.StorageGold, { npcId, amount }),
      playerLevel,
    });
    initMarket({
      open: (title, items) => this.room.send(Msg.StallOpen, { title, items }),
      close: () => this.room.send(Msg.StallClose),
      buy: (sellerId, uid, qty, price) => this.room.send(Msg.StallBuy, { sellerId, uid, qty, price }),
      playerLevel,
      gold: () => inventoryState()?.gold ?? 0,
    });
  }

  private bindState() {
    const $ = getStateCallbacks(this.room);

    $(this.room.state).players.onAdd((player: PlayerView, sessionId: string) => {
      const isLocal = sessionId === this.room.sessionId;
      const view = new EntityView(
        this,
        player.x,
        player.y,
        playerAppearance(player),
        player.name,
        // In PvP zones everyone outside your party is an enemy.
        isLocal ? "#ffe08a" : this.isEnemyPlayer(sessionId) ? "#ff6b6b" : "#ffffff",
      );

      if (isLocal) {
        const start = { x: player.x, y: player.y };
        this.local = { state: player, view, prev: start, curr: { ...start }, dir: player.dir, moving: false };
        $(player).onChange(() => {
          this.reconcile(player);
          this.refreshLocalUi();
        });
        this.refreshLocalUi();
        view.setWeapon(player.weapon, player.weaponPlus);
        setDollLook(player.color, player.cls, lookAppearance(player));
        this.rebuildHotbar(player.cls);
        initPotions(player.name, player.cls, {
          use: (defId) => this.room.send(Msg.UseItem, { defId }),
          playerLevel: () => this.local?.state.level ?? 1,
        });
        if (this.arrived) teleportIn(this, start);
        this.syncStall(sessionId, player);
        $(player).listen("stall", () => this.syncStall(sessionId, player));
      } else {
        const remote = { state: player, view, buffer: new SnapshotBuffer() };
        this.players.set(sessionId, remote);
        // Clicking another player: their market stall if they have one, else friendly
        // target (heals, shields), or attack in PvP zones.
        view.sprite.setInteractive({ cursor: this.playerCursor(sessionId, player) });
        view.sprite.on("pointerover", () => {
          // Hostility and stalls change; pick the cursor fresh each time.
          if (view.sprite.input) view.sprite.input.cursor = this.playerCursor(sessionId, player);
        });
        view.sprite.on("pointerdown", () => {
          if (player.stall) return this.browseStall(sessionId);
          this.selectTarget(sessionId, this.isEnemyPlayer(sessionId));
        });
        const sync = () => {
          remote.buffer.push(player.x, player.y, player.dir);
          view.setHealth(player.hp, player.maxHp, player.hp < player.maxHp && !player.dead);
          view.setDimmed(player.dead);
          view.setGhost(player.protected);
          view.setBaseTint(player.stunned ? 0xffe066 : player.rooted ? 0x9ad5ff : player.buffed ? 0xffe8a8 : null);
          view.setWeapon(player.weapon, player.weaponPlus);
          view.setLook(playerAppearance(player));
          this.syncStall(sessionId, player);
          if (sessionId === this.targetId) this.refreshTargetFrame();
        };
        sync();
        $(player).onChange(sync);
      }
      hud.setOnlineCount(this.room.state.players.size);
    });

    $(this.room.state).players.onRemove((_player: PlayerView, sessionId: string) => {
      this.players.get(sessionId)?.view.destroy();
      this.players.delete(sessionId);
      this.castGlows.get(sessionId)?.();
      this.castGlows.delete(sessionId);
      this.shieldBubbles.get(sessionId)?.destroy();
      this.shieldBubbles.delete(sessionId);
      this.removeStallView(sessionId);
      if (sessionId === this.targetId) this.selectTarget(null, false, false);
      hud.setOnlineCount(this.room.state.players.size);
    });

    $(this.room.state).mobs.onAdd((mob: MobView, mobId: string) => {
      const def = MOBS[mob.kind];
      // Bosses are drawn bigger and carry their name.
      const view = def.boss
        ? new EntityView(this, mob.x, mob.y, def.appearance, def.name, "#ff8c1a", def.scale ?? 1)
        : new EntityView(this, mob.x, mob.y, def.appearance, undefined, undefined, def.scale ?? 1);
      if (def.boss) this.bossId = mobId;
      view.sprite.setInteractive({ cursor: cursor("attack") });
      view.sprite.on("pointerdown", () => {
        this.selectTarget(mobId, true);
        // Melee classes close the distance; the server starts swinging once in range.
        const local = this.local;
        if (local && !classOf(local.state.cls).autoAttack.ranged) {
          this.walkTo(() => this.mobs.get(mobId)?.view, MELEE_RANGE - 6, () => {});
        }
      });

      const remote = { state: mob, view, buffer: new SnapshotBuffer() };
      this.mobs.set(mobId, remote);
      const sync = () => {
        remote.buffer.push(mob.x, mob.y, mob.dir);
        this.refreshMobHealth(mobId);
        view.setBaseTint(mob.stunned ? 0xffe066 : mob.rooted ? 0x9ad5ff : mob.enraged ? 0xff7070 : mob.empowered ? 0xc4b0ff : null);
        if (mobId === this.targetId) this.refreshTargetFrame();
      };
      sync();
      $(mob).onChange(sync);
    });

    // Some portals (the arena exit) only open once the boss is dead.
    const syncPortals = () => {
      for (const portal of this.portals) portal.view.setVisible(this.portalOpen(portal.def));
    };
    syncPortals();
    $(this.room.state).listen("cleared", syncPortals);
    $(this.room.state).listen("clock", (minute: number) => hud.setClock(minute, !!this.zone.outdoor));

    $(this.room.state).loot.onAdd((loot: LootView, lootId: string) => {
      const view = new EntityView(this, loot.x, loot.y, { type: "chest" });
      view.sprite.on("pointerdown", () => this.walkTo(() => this.loot.get(lootId)?.state, LOOT_RANGE - 4, () => this.room.send(Msg.PickupLoot, { lootId })));
      this.loot.set(lootId, { state: loot, view });
      // Loot is private to the killer at first; others only see it once it becomes free.
      const sync = () => {
        const visible = this.canLoot(loot);
        view.setVisible(visible);
        if (visible) view.sprite.setInteractive({ cursor: cursor("loot") });
        else view.sprite.disableInteractive();
      };
      sync();
      $(loot).onChange(sync);
      this.lootSyncs.set(lootId, sync);
    });

    $(this.room.state).loot.onRemove((_loot: LootView, lootId: string) => {
      this.loot.get(lootId)?.view.destroy(true);
      this.loot.delete(lootId);
      this.lootSyncs.delete(lootId);
    });

    $(this.room.state).townPortals.onAdd((portal: TownPortalView, portalId: string) => {
      this.townPortals.get(portalId)?.view.destroy(true);
      const label = `${portal.owner} → ${ZONES[portal.to as ZoneId]?.name ?? portal.to}`;
      const view = new EntityView(this, portal.x, portal.y, { type: "portal", style: portal.back ? "exit" : "gate" }, label, "#74c0fc");
      view.sprite.setInteractive({ cursor: cursor("portal") });
      view.sprite.on("pointerdown", () => {
        const portal = this.townPortals.get(portalId);
        if (portal) this.walkTo(() => portal.state, PORTAL_RANGE - 4, () => this.useTownPortal(portalId));
      });
      teleportIn(this, view);
      this.townPortals.set(portalId, { state: portal, view });
    });
    $(this.room.state).townPortals.onRemove((_portal: TownPortalView, portalId: string) => {
      this.townPortals.get(portalId)?.view.destroy(true);
      this.townPortals.delete(portalId);
    });

    $(this.room.state).minions.onAdd((minion: MinionView, minionId: string) => {
      const skill = SKILLS[minion.skill];
      if (!skill || skill.effect.type !== "summon") return;
      const owner = this.playerState(minion.ownerId);
      const name = owner ? `${skill.effect.name} (${owner.name})` : skill.effect.name;
      const view = new EntityView(this, minion.x, minion.y, skill.effect.appearance, name, "#b2f2bb");
      const remote = { state: minion, view, buffer: new SnapshotBuffer() };
      this.minions.set(minionId, remote);
      burst(this, minion, 0x495057, 10);
      const sync = () => remote.buffer.push(minion.x, minion.y, minion.dir);
      sync();
      $(minion).onChange(sync);
    });
    $(this.room.state).minions.onRemove((minion: MinionView, minionId: string) => {
      const remote = this.minions.get(minionId);
      if (remote) boneBurst(this, remote.view, 14);
      remote?.view.destroy(true);
      this.minions.delete(minionId);
    });

    $(this.room.state).mobs.onRemove((_mob: MobView, mobId: string) => {
      this.mobs.get(mobId)?.view.destroy(true);
      this.mobs.delete(mobId);
      if (mobId === this.bossId) this.bossId = null;
      // The server already cleared its side of the target.
      if (mobId === this.targetId) this.selectTarget(null, false, false);
    });
  }

  private bindMessages() {
    this.room.onMessage(Msg.Pong, (sentAt: number) => hud.setPing(performance.now() - sentAt));
    initDamageMeter();
    this.room.onMessage(Msg.Combat, (event: CombatEvent) => {
      this.showCombatEvent(event);
      recordCombat(event, {
        actor: (sessionId) => {
          if (sessionId !== this.room.sessionId && !this.party.sessions.has(sessionId)) return undefined;
          const player = this.playerState(sessionId);
          return player ? { name: player.name, cls: player.cls } : undefined;
        },
        enemyName: (e) => {
          if (e.targetKind === "mob") return MOBS[this.mobs.get(e.targetId)?.state.kind ?? ""]?.name;
          return this.playerState(e.targetId)?.name;
        },
      });
    });
    this.room.onMessage(Msg.Attack, (event: AttackEvent) => this.showAttack(event));
    this.room.onMessage(Msg.Transfer, (event: TransferEvent) => this.teleport(event));
    this.room.onMessage(Msg.MyStall, (event: MyStallEvent) => onMyStall(event));
    this.room.onMessage(Msg.QuestLog, (event: QuestLogEvent) => setQuestLog(event));
    this.room.onMessage(Msg.Auras, (event: AurasEvent) => setAuras(event));
    this.room.onMessage(Msg.SkillRanks, (event: SkillRanksEvent) => {
      setSkillRanks(event);
      if (this.local) this.rebuildHotbar(this.local.state.cls);
    });
    this.room.onMessage(Msg.Fortune, (event: FortuneEvent) => {
      setUpgradeFortune(event.upgradeBonus);
      if (event.text) showFortune(event.text, event.good);
    });
    this.room.onMessage(Msg.StallContents, (event: StallContentsEvent) => showStallContents(event));
    this.room.onMessage(Msg.StallClosed, (event: StallClosedEvent) => onStallClosed(event.sellerId));
    this.room.onMessage(Msg.BossCast, (event: BossCastEvent) => this.showBossCast(event));
    this.room.onMessage(Msg.CastStart, (event: CastStartEvent) => this.showCastStart(event));
    this.room.onMessage(Msg.CastEnd, (event: CastEndEvent) => this.showCastEnd(event));
    this.room.onMessage(Msg.ChatMessage, (event: ChatEvent) => this.showChat(event));
    this.room.onMessage(Msg.PvpKill, (event: PvpKillEvent) => addKillFeed(event, this.local?.state.name ?? ""));
    this.room.onMessage(Msg.PartyInvite, (event: PartyInviteEvent) => showInvite(event.from));
    this.room.onMessage(Msg.PartyUpdate, (event: PartyUpdateEvent) => this.onPartyUpdate(event));
    this.room.onMessage(Msg.DuelInvite, (event: DuelInviteEvent) => showDuelInvite(event.from));
    this.room.onMessage(Msg.DungeonInvite, (event: DungeonInviteEvent) => showDungeonInvite(event.from, event.dungeon));
    this.room.onMessage(Msg.FishCatch, (event: FishCatchEvent) => this.showCatch(event));
    this.room.onMessage(Msg.TradeInvite, (event: TradeInviteEvent) => showTradeInvite(event.from));
    this.room.onMessage(Msg.TradeState, (event: TradeStateEvent) => onTradeState(event));
    this.room.onMessage(Msg.DuelState, (event: DuelStateEvent) => {
      this.duelOpponent = event.opponent;
      this.refreshHostility();
    });
    // Anything sent while the scene was still loading was dropped; ask for the inventory again.
    this.room.send(Msg.RequestInventory);
    this.room.onMessage(Msg.SkillUsed, (event: SkillUsedEvent) =>
      (hud.startCooldown(event.skillId, event.cooldownMs, event.gcdMs), startPotionCooldown(event.skillId, event.cooldownMs)),
    );
    this.room.onMessage(Msg.SkillError, (event: SkillErrorEvent) => hud.showMessage(event.message));
    this.room.onMessage(Msg.Notice, (event: NoticeEvent) => hud.showMessage(event.message, "info", event.color));
    this.room.onMessage(Msg.Inventory, (event: InventoryEvent) => {
      updateInventory(event);
      renderPotions();
      updatePassives(event);
      updateDoll(event.equipment);
      updateStorage(event);
      refreshShop();
      refreshUpgrade();
      refreshMarket();
      refreshQuests();
    });
    this.room.onMessage(Msg.UpgradeResult, (event: UpgradeResultEvent) => showUpgradeResult(event));
    this.room.onMessage(Msg.XpGained, (event: XpGainedEvent) => {
      const view = this.local?.view;
      if (view) floatingText(this, view.x, view.headY - 6, `+${event.amount} XP`, "#c49bff");
    });
    this.room.onMessage(Msg.LevelUp, (event: LevelUpEvent) => {
      const view = this.viewFor(event.sessionId, "player");
      if (view) floatingText(this, view.x, view.headY - 4, "SEVİYE ATLADI!", "#ffd34d", true);
      if (event.sessionId === this.room.sessionId) {
        hud.showMessage(`Seviye ${event.level}!`, "level");
        refreshQuests();
        this.refreshTargetFrame(); // name colour depends on our level
      }
    });
  }

  // ---- Targeting & skills ----------------------------------------------------

  /** Selects a mob (hostile) or another player (friendly), or clears with null. */
  private selectTarget(targetId: string | null, attack: boolean, notifyServer = true) {
    const previous = this.targetId;
    if (this.local?.state.dead && targetId) return;
    this.targetId = targetId;
    if (notifyServer) this.room.send(Msg.SetTarget, { targetId, attack } satisfies SetTargetMessage);
    if (previous && previous !== targetId) this.refreshMobHealth(previous);
    if (targetId) this.refreshMobHealth(targetId);
    this.drawTargetRing();
    this.refreshTargetFrame();
  }

  private drawTargetRing() {
    const targetId = this.targetId;
    const isPlayer = targetId !== null && this.players.has(targetId);
    const ringColor = isPlayer ? (this.isEnemyPlayer(targetId!) ? ENEMY_PLAYER_COLOR : FRIENDLY_COLOR) : HOSTILE_COLOR;
    this.targetRing.clear().lineStyle(1, ringColor, 1).strokeEllipse(0, 0, 18, 7);
  }

  /** Tab: nearest enemy first (mobs, and players in PvP zones), then cycle outward. */
  private cycleTarget() {
    const local = this.local;
    if (!local) return;
    const enemies: [string, { view: EntityView }][] = [...this.mobs.entries()];
    for (const [id, p] of this.players) if (!p.state.dead && this.isEnemyPlayer(id)) enemies.push([id, p]);
    const candidates = enemies
      .map(([id, enemy]) => ({ id, dist: distance(local.view, enemy.view) }))
      .filter((c) => c.dist <= TAB_TARGET_RANGE)
      .sort((a, b) => a.dist - b.dist);
    if (candidates.length === 0) return;
    const index = candidates.findIndex((c) => c.id === this.targetId);
    this.selectTarget(candidates[(index + 1) % candidates.length].id, false);
  }

  private rebuildHotbar(cls: string) {
    const name = this.local?.state.name ?? "";
    if (this.hotbarLayout.length === 0) this.hotbarLayout = loadHotbarLayout(name, cls);
    this.hotbar = hotbarFor(this.hotbarLayout);
    hud.initHotbar(this.hotbar, (index) => this.useHotbar(index), countItem, (index, slot) => this.hotbarTooltip(index, slot), {
      drop: (index, drag) => {
        if (!classOf(cls).skills.includes(drag.skillId)) return;
        const layout = [...this.hotbarLayout];
        if (drag.from !== undefined) {
          // Slot to slot: swap.
          [layout[index], layout[drag.from]] = [layout[drag.from], layout[index]];
        } else {
          // From the skills page: one copy on the bar, moved to where it was dropped.
          const old = layout.indexOf(drag.skillId);
          if (old !== -1) layout[old] = "";
          layout[index] = drag.skillId;
        }
        this.setHotbarLayout(cls, layout);
      },
      clear: (index) => {
        const layout = [...this.hotbarLayout];
        layout[index] = "";
        this.setHotbarLayout(cls, layout);
      },
    });
  }

  private setHotbarLayout(cls: string, layout: string[]) {
    this.hotbarLayout = layout;
    saveHotbarLayout(this.local?.state.name ?? "", layout);
    this.rebuildHotbar(cls);
  }

  /** Hovering a hotbar slot: the detailed skill panel, or the item tooltip for potions. */
  private hotbarTooltip(index: number | null, slot: HTMLElement) {
    const entry = index === null ? undefined : this.hotbar[index];
    if (!entry || entry.kind === "empty" || !this.local) {
      hideSkillTooltip();
      hideTooltip();
      return;
    }
    const p = this.local.state;
    if (entry.kind === "skill") {
      showSkillTooltip(entry.skill, { rank: skillRank(entry.skill.id), playerLevel: p.level, playerClass: p.cls, stats: inventoryState()?.stats }, slot);
    } else {
      showItemTooltip(entry.item, { qty: countItem(entry.item.id), playerLevel: p.level }, slot);
    }
  }

  private useHotbar(slotIndex: number) {
    const entry = this.hotbar[slotIndex];
    if (!entry || entry.kind === "empty") return;
    if (entry.kind === "skill" && entry.locked) return hud.showMessage(`${entry.skill.name} öğrenilmedi: Yetenekler (K)`);
    hud.flashSlot(slotIndex);
    if (entry.kind === "skill") {
      // Free dashes (blink, soul step, light step) go towards the mouse; on touch screens, where you face.
      const effect = entry.skill.effect;
      const aimed = effect.type === "dash" && effect.mode === "forward" && !isTouchDevice;
      const pointer = this.input.activePointer;
      const aim = aimed ? this.cameras.main.getWorldPoint(pointer.x, pointer.y) : undefined;
      this.room.send(Msg.UseSkill, { skillId: entry.skill.id, aim: aim ? { x: aim.x, y: aim.y } : undefined });
    }
    else this.room.send(Msg.UseItem, { defId: entry.item.id });
  }

  // ---- Loot & NPCs ---------------------------------------------------------------

  private canLoot(loot: LootView) {
    return loot.owner === "" || loot.owner === this.room.sessionId || (this.party.id !== null && loot.owner === `party:${this.party.id}`);
  }

  /** In PvP zones, everyone outside our party is hostile; elsewhere only our duel opponent. */
  private isEnemyPlayer(sessionId: string) {
    if (sessionId === this.duelOpponent) return true;
    return !!this.zone.pvp && sessionId !== this.room.sessionId && !this.party.sessions.has(sessionId);
  }

  /** Who is hostile changed (party, duel): name colours, target ring and frame. */
  private refreshHostility() {
    for (const [sessionId, remote] of this.players) remote.view.setNameColor(this.isEnemyPlayer(sessionId) ? "#ff6b6b" : "#ffffff");
    this.drawTargetRing();
    this.refreshTargetFrame();
  }

  private onPartyUpdate(event: PartyUpdateEvent) {
    const sessions = new Set(event.members.filter((m) => m.online && m.zone === this.zone.id && m.sessionId).map((m) => m.sessionId!));
    const changed = event.partyId !== this.party.id || sessions.size !== this.party.sessions.size || [...sessions].some((s) => !this.party.sessions.has(s));
    this.party = { id: event.partyId, sessions };
    renderParty(event, this.local?.state.name ?? "", this.zone.id);
    if (!changed) return;
    // Party changes who is hostile (PvP), which loot we can open and the target frame.
    for (const sync of this.lootSyncs.values()) sync();
    this.refreshHostility();
  }

  /** Talking to an NPC: quest givers open the conversation first, others their shop or forge. */
  private talkTo(npc: NpcDef) {
    const local = this.local;
    if (!local || local.state.dead) return;
    if (distance(local.view, npc) > NPC_RANGE) return hud.showMessage("Çok uzak");
    closeShop();
    closeUpgrade();
    closeStorage();
    closeNpcDialog();
    if (npc.role === "guard") {
      const view = this.npcViews.get(npc.id);
      if (view) this.speechBubble(view, npc.greeting);
      return;
    }
    if (openNpcDialog(npc)) return;
    this.openNpcWindow(npc);
  }

  /** The NPC's shop or forge (only one NPC window at a time). */
  private openNpcWindow(npc: NpcDef) {
    closeNpcDialog();
    if (npc.role === "merchant") openShop(npc);
    else if (npc.role === "blacksmith") openUpgrade(npc);
    else if (npc.role === "storage") openStorage(npc);
    else return;
    toggleInventory(true);
  }

  private refreshNpcMarkers() {
    for (const { npc, text } of this.npcMarkers) {
      const marker = npcMarker(npc.id);
      text.setText(marker?.text ?? "");
      if (marker) text.setColor(marker.color);
    }
  }

  /** Portals that are currently open (some only after the boss is dead). */
  private portalOpen(def: PortalDef) {
    return !def.requiresClear || this.room.state.cleared;
  }

  /** Left click: interact now if close enough, otherwise walk there first. */
  private walkTo(target: () => Point | undefined, range: number, act: () => void) {
    const local = this.local;
    const at = target();
    if (!local || !at || local.state.dead || this.leaving) return;
    if (distance(local.curr, at) <= range) {
      this.approach = null;
      return act();
    }
    this.approach = { target, range, act, lastPos: { ...local.curr }, stuckTicks: 0 };
  }

  /** Direction to walk this tick for a pending click-to-interact, or null when done / cancelled. */
  private approachAxis(local: LocalPlayer): { dx: Axis; dy: Axis } | null {
    const approach = this.approach;
    if (!approach) return null;
    const at = approach.target();
    if (!at || local.state.dead) {
      this.approach = null;
      return null;
    }
    if (distance(local.curr, at) <= approach.range) {
      this.approach = null;
      approach.act();
      return null;
    }
    // Stuck behind a wall (no pathfinding): give up after a moment.
    if (distance(local.curr, approach.lastPos) < 0.5) approach.stuckTicks++;
    else approach.stuckTicks = 0;
    approach.lastPos = { ...local.curr };
    if (approach.stuckTicks > 8) {
      this.approach = null;
      hud.showMessage("Oraya yol yok");
      return null;
    }
    const axis = (d: number): Axis => (d > 3 ? 1 : d < -3 ? -1 : 0);
    return { dx: axis(at.x - local.curr.x), dy: axis(at.y - local.curr.y) };
  }

  /** Cursor over another player: coin for a stall, sword for an enemy (PvP, duel), else the pointer. */
  private playerCursor(sessionId: string, player: PlayerView): string {
    if (player.stall) return cursor("trade");
    return cursor(this.isEnemyPlayer(sessionId) ? "attack" : "pointer");
  }

  /** Our own town portal (others' are just scenery to us). */
  private ownTownPortal(portalId: string) {
    const portal = this.townPortals.get(portalId);
    return portal && portal.state.owner === this.local?.state.name ? portal : undefined;
  }

  private useTownPortal(portalId: string) {
    const local = this.local;
    const portal = this.ownTownPortal(portalId);
    if (!local || local.state.dead || this.leaving) return;
    if (!portal) return hud.showMessage("Bu portal senin değil");
    if (distance(local.view, portal.state) > PORTAL_RANGE) return hud.showMessage("Çok uzak");
    this.room.send(Msg.UseTownPortal, { portalId });
  }

  private usePortal(def: PortalDef) {
    const local = this.local;
    if (!local || local.state.dead || this.leaving || !this.portalOpen(def)) return;
    if (distance(local.view, def) > PORTAL_RANGE) return hud.showMessage("Çok uzak");
    this.room.send(Msg.UsePortal, { portalId: def.id });
  }

  /** The server let us through a portal: light takes us away, then the next zone loads. */
  private teleport(event: TransferEvent) {
    if (this.leaving) return;
    this.leaving = true;
    closeBrowse();
    const local = this.local;
    if (!local) return this.onTransfer(event);
    teleportOut(this, local.view, local.view.sprite, () => this.onTransfer(event));
  }

  /** Walking into a teleport gate sends us through it. */
  private checkGates(local: LocalPlayer) {
    const gates = this.portals.filter((p) => p.def.auto && this.portalOpen(p.def));
    if (gates.length === 0 || this.leaving || local.state.dead) return;
    const nearest = Math.min(...gates.map((g) => distance(local.view, g.def)));
    if (!this.gatesArmed) {
      this.gatesArmed = nearest > AUTO_GATE_RANGE * 2.5;
      return;
    }
    const gate = gates.find((g) => distance(local.view, g.def) <= AUTO_GATE_RANGE);
    if (!gate) return;
    // One request per approach; walking out and back in tries again.
    this.gatesArmed = false;
    this.usePortal(gate.def);
  }

  private browseStall(sellerId: string) {
    const local = this.local;
    const seller = this.players.get(sellerId);
    if (!local || !seller?.state.stall) return;
    if (distance(local.view, seller.view) > STALL_RANGE) return hud.showMessage("Tezgâha çok uzaksın");
    this.room.send(Msg.StallBrowse, { sellerId });
  }

  /** Draws (or removes) the market stall around a player when their stall opens or closes. */
  private syncStall(sessionId: string, player: PlayerView) {
    const existing = this.stalls.get(sessionId);
    if (existing && existing.title === player.stall) return;
    this.removeStallView(sessionId);
    if (!player.stall) return;
    const x = Math.round(player.x);
    const y = Math.round(player.y);
    // Rug under the seller, an awning on two poles behind them.
    const back = this.add.graphics().setPosition(x, y).setDepth(y - 0.5);
    back.fillStyle(0x8c2f39).fillRect(-12, -6, 24, 8);
    back.fillStyle(0xe0a83f).fillRect(-12, -6, 24, 1).fillRect(-12, 1, 24, 1);
    back.fillStyle(0x5b3a1e).fillRect(-12, -30, 2, 26).fillRect(10, -30, 2, 26);
    for (let i = 0; i < 6; i++) back.fillStyle(i % 2 ? 0xf2efe6 : 0xc92a2a).fillRect(-14 + i * 5, -34, 5, 6);
    back.fillStyle(0x000000, 0.25).fillRect(-14, -28, 30, 1);
    const sign = this.add
      .text(x, y - 40, player.stall, {
        fontFamily: '"Cloister Black TR", serif',
        fontSize: "9px",
        color: "#2a1a08",
        backgroundColor: "#e8c46a",
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setResolution(4)
      .setDepth(200000 + y);
    if (sessionId !== this.room.sessionId) {
      sign.setInteractive({ cursor: cursor("trade") });
      sign.on("pointerdown", () => this.walkTo(() => this.players.get(sessionId)?.view, STALL_RANGE - 4, () => this.browseStall(sessionId)));
    }
    this.stalls.set(sessionId, { title: player.stall, back, sign });
    if (sessionId === this.targetId) this.selectTarget(null, false);
  }

  private removeStallView(sessionId: string) {
    const view = this.stalls.get(sessionId);
    if (!view) return;
    view.back.destroy();
    view.sign.destroy();
    this.stalls.delete(sessionId);
  }

  /** Standing on the market square (in a market zone) lets us open a stall. */
  private onMarketTile(local: LocalPlayer) {
    if (!this.zone.market || local.state.dead) return false;
    const tile = this.map.tiles[Math.floor((local.view.y - 1) / TILE_SIZE)]?.[Math.floor(local.view.x / TILE_SIZE)];
    return tile === Tile.Market;
  }

  /**
   * Boss telegraph on the ground that fills up until the ability lands:
   * a circle (slam, leap) or a lane towards the target (charge).
   */
  private showBossCast(event: BossCastEvent) {
    this.lastCasts.set(event.mobId, event);
    const zone = this.add.graphics().setDepth(0.5).setPosition(Math.round(event.x), Math.round(event.y) - 2);
    const fill = { amount: 0 };
    let draw: () => void;
    if (event.ability === "charge") {
      const dx = (event.toX ?? event.x) - event.x;
      const dy = (event.toY ?? event.y) - event.y;
      const length = Math.hypot(dx, dy);
      const width = event.width ?? 20;
      zone.setRotation(Math.atan2(dy, dx));
      draw = () => {
        zone.clear();
        zone.fillStyle(0xff2020, 0.15).fillRect(0, -width / 2, length, width);
        zone.fillStyle(0xff2020, 0.35).fillRect(0, -width / 2, length * fill.amount, width);
        zone.lineStyle(1, 0xff4040, 0.9).strokeRect(0, -width / 2, length, width);
      };
    } else {
      const radius = event.radius ?? 40;
      draw = () => {
        zone.clear();
        zone.fillStyle(0xff2020, 0.15).fillEllipse(0, 0, radius * 2, radius);
        zone.fillStyle(0xff2020, 0.35).fillEllipse(0, 0, radius * 2 * fill.amount, radius * fill.amount);
        zone.lineStyle(1, 0xff4040, 0.9).strokeEllipse(0, 0, radius * 2, radius);
      };
    }
    draw();
    this.tweens.add({ targets: fill, amount: 1, duration: event.castMs, onUpdate: draw, onComplete: () => zone.destroy() });

    const boss = this.mobs.get(event.mobId)?.view;
    if (!boss) return;
    floatingText(this, boss.x, boss.headY - 2, "!!", "#ff3b3b", true);
    if (event.ability === "leap") {
      // Up into the air while the circle fills; land() brings it down at the target.
      boss.playAction("jump", event.castMs + 400);
      boss.rise(40, event.castMs * 0.6);
    }
  }

  /** Boss health bar while a boss is near. */
  private refreshBossBar() {
    const boss = this.bossId ? this.mobs.get(this.bossId) : undefined;
    const local = this.local;
    if (!boss || !local || distance(local.view, boss.view) > TILE_SIZE * 14) return hud.setBossBar(null);
    const { hp, maxHp, enraged, kind } = boss.state;
    hud.setBossBar({ name: MOBS[kind].name, hp, maxHp, enraged });
  }

  /** E: use a nearby portal, talk to a nearby NPC, otherwise open the nearest loot chest. */
  private interact() {
    const local = this.local;
    if (!local) return;
    const portal = this.portals.find((p) => this.portalOpen(p.def) && distance(local.view, p.def) <= PORTAL_RANGE);
    if (portal) return this.usePortal(portal.def);
    const townPortal = [...this.townPortals.keys()].find(
      (id) => this.ownTownPortal(id) && distance(local.view, this.townPortals.get(id)!.state) <= PORTAL_RANGE,
    );
    if (townPortal) return this.useTownPortal(townPortal);
    const npc = this.zone.npcs.map((id) => NPCS[id]).find((n) => distance(local.view, n) <= NPC_RANGE);
    if (npc) return this.talkTo(npc);
    const stall = [...this.players].find(([, p]) => p.state.stall && distance(local.view, p.view) <= STALL_RANGE);
    if (stall) return this.browseStall(stall[0]);

    let nearest: { id: string; dist: number } | null = null;
    for (const [id, loot] of this.loot) {
      if (!this.canLoot(loot.state)) continue;
      const dist = distance(local.view, loot.view);
      if (dist <= LOOT_RANGE && (!nearest || dist < nearest.dist)) nearest = { id, dist };
    }
    if (nearest) this.room.send(Msg.PickupLoot, { lootId: nearest.id });
  }

  // ---- UI sync ---------------------------------------------------------------

  private refreshLocalUi() {
    const local = this.local;
    if (!local) return;
    const p = local.state;
    hud.updatePlayerFrame({
      name: p.name,
      level: p.level,
      hp: p.hp,
      maxHp: p.maxHp,
      resource: p.resource,
      maxResource: p.maxResource,
      resourceType: classOf(p.cls).resource,
      shield: p.shield,
      xp: p.xp,
      xpToNext: xpToNextLevel(p.level),
    });
    hud.setDeathPanel(p.dead);
    local.view.setDimmed(p.dead);
    local.view.setGhost(p.protected);
    local.view.setBaseTint(p.stunned ? 0xffe066 : p.rooted ? 0x9ad5ff : p.buffed ? 0xffe8a8 : null);
    setPvpStats(this.zone.pvp ? { rating: p.pvpRating, kills: p.pvpKills, deaths: p.pvpDeaths } : null);
    local.view.setHealth(p.hp, p.maxHp, p.hp < p.maxHp && !p.dead);
    local.view.setWeapon(p.weapon, p.weaponPlus);
    local.view.setLook(playerAppearance(p));
    if (p.dead && this.targetId) this.selectTarget(null, false, false);
    if (p.dead) {
      closeShop();
      closeUpgrade();
      closeStorage();
    }
  }

  private refreshMobHealth(mobId: string) {
    const mob = this.mobs.get(mobId);
    if (!mob) return;
    const { hp, maxHp } = mob.state;
    mob.view.setHealth(hp, maxHp, hp < maxHp || mobId === this.targetId);
  }

  private refreshTargetFrame() {
    const friend = this.targetId ? this.players.get(this.targetId) : undefined;
    if (friend) {
      const { name, level, hp, maxHp, cls } = friend.state;
      const canInvite = !this.party.sessions.has(this.targetId!);
      // Arena fights need no duel; one duel at a time.
      const canDuel = !this.zone.pvp && this.duelOpponent === null;
      hud.setTargetFrame({
        name,
        level,
        hp,
        maxHp,
        color: this.isEnemyPlayer(this.targetId!) ? "#ff6b6b" : "#4cd964",
        subtitle: classOf(cls).name,
        onInvite: canInvite ? () => this.room.send(Msg.Chat, { text: `/davet ${name}` }) : undefined,
        onDuel: canDuel ? () => this.room.send(Msg.Chat, { text: `/duello ${name}` }) : undefined,
        onTrade: !this.isEnemyPlayer(this.targetId!) && !isTradeOpen() ? () => this.room.send(Msg.Chat, { text: `/takas ${name}` }) : undefined,
      });
      return;
    }
    const mob = this.targetId ? this.mobs.get(this.targetId) : undefined;
    if (!mob || !this.local) {
      hud.setTargetFrame(null);
      return;
    }
    const { kind, level, hp, maxHp, aggroId, empowered } = mob.state;
    hud.setTargetFrame({
      name: MOBS[kind].name,
      subtitle: MOBS[kind].nightOnly ? "Gece yaratığı" : empowered ? "Gece gücü" : undefined,
      level,
      hp,
      maxHp,
      color: hud.levelColor(level, this.local.state.level),
      aggro: aggroId ? this.playerState(aggroId)?.name : undefined,
    });
  }

  private viewFor(id: string, kind: "player" | "mob" | "minion"): EntityView | undefined {
    if (kind === "mob") return this.mobs.get(id)?.view;
    if (kind === "minion") return this.minions.get(id)?.view;
    if (id === this.room.sessionId) return this.local?.view;
    return this.players.get(id)?.view;
  }

  private showAttack(event: AttackEvent) {
    const source = this.viewFor(event.sourceId, event.sourceKind);
    if (!source) return;
    if (event.skill === "slam" || event.skill === "leap") {
      // Boss ability landing: shockwave where the telegraph was.
      const cast = this.lastCasts.get(event.sourceId);
      const at = cast ? { x: cast.x, y: cast.y } : source;
      const radius = cast?.radius ?? 48;
      if (event.skill === "leap") source.land();
      ringEffect(this, at.x, at.y - 2, 0xff3b3b, radius);
      if (this.local && distance(this.local.view, at) < radius * 2) {
        this.cameras.main.shake(180, 0.006);
        // Low on health: the health globe's liquid sloshes with the blow.
        hud.sloshGlobes();
      }
      return;
    }
    if (event.skill === "charge") {
      source.playAction("slide", 450);
      return;
    }
    // Dashes: a flash where the caster set off, another where it lands once its new position arrives.
    const dashSkill = event.skill ? SKILLS[event.skill] : undefined;
    if (dashSkill?.effect.type === "dash" && event.fromX !== undefined && event.fromY !== undefined) {
      if (event.sourceId === this.room.sessionId) this.dashGlide = { from: { x: event.fromX, y: event.fromY }, start: performance.now(), ms: 160 };
      this.showDash(dashSkill, { x: event.fromX, y: event.fromY }, source);
      return;
    }
    const target = event.targetId && event.targetKind ? this.viewFor(event.targetId, event.targetKind) : undefined;
    const skill = event.skill ? SKILLS[event.skill] : undefined;
    const caster = event.sourceKind === "player" ? this.playerState(event.sourceId) : undefined;
    if (skill && skill.visual !== "melee" && skill.visual !== "spin") {
      this.showSpell(skill, source, target);
    } else if (!skill && caster && classOf(caster.cls).autoAttack.ranged && target) {
      // Casters' plain attacks: a small bolt from the staff.
      projectile(this, source, target, caster.cls === "priest" ? 0xffe066 : caster.cls === "necromancer" ? 0x69db7c : 0xb197fc, 2);
    } else {
      const kind: SwingKind = event.skill === "whirlwind" ? "spin" : event.skill === "heroicStrike" || event.skill === "shieldSlam" ? "heavy" : "normal";
      source.playAttack(kind, target);
    }
    // Our own character turns to face what it hits when standing still.
    const local = this.local;
    if (local && target && event.sourceId === this.room.sessionId && !local.moving) {
      local.dir = directionToward(target.x - local.view.x, target.y - local.view.y, local.dir);
    }
  }

  private playerState(sessionId: string): PlayerView | undefined {
    return sessionId === this.room.sessionId ? this.local?.state : this.players.get(sessionId)?.state;
  }

  private showDash(skill: SkillDef, from: Point, view: EntityView) {
    const color = Phaser.Display.Color.HexStringToColor(skill.color).color;
    burst(this, from, color, 10);
    this.time.delayedCall(140, () => {
      const at = { x: view.x, y: view.y };
      if (skill.visual === "leap") {
        ringEffect(this, at.x, at.y - 2, color, skill.effect.type === "dash" && skill.effect.landRadius ? skill.effect.landRadius : 30);
        if (this.local && distance(this.local.view, at) < 120) this.cameras.main.shake(140, 0.004);
      } else {
        burst(this, at, color, 10);
      }
      if (skill.visual === "charge") view.playAttack("heavy");
    });
  }

  private showSpell(skill: SkillDef, source: EntityView, target: EntityView | undefined) {
    // Enemy spells need their target on screen (it may have died this very tick).
    if (skill.target === "enemy" && !target) return;
    const at = target ?? source;
    switch (skill.visual) {
      case "fireball":
        if (target) projectile(this, source, target, 0xff6b00, 3);
        break;
      case "lightning":
        lightning(this, at);
        break;
      case "frost":
        frostRing(this, source, skill.effect.type === "nova" ? skill.effect.radius : 40);
        break;
      case "holy":
        holyBeam(this, at);
        break;
      case "heal":
      case "selfHeal":
        healSparkles(this, at);
        break;
      case "shield":
        burst(this, at, 0x74c0fc, 10);
        break;
      case "drain":
        // The soul flows from the victim back to the caster.
        if (target) projectile(this, target, source, 0x51cf66, 3);
        break;
      case "summon":
        burst(this, source, 0x868e96, 12);
        break;
      case "bone":
        boneBurst(this, source, skill.effect.type === "whirlwind" ? skill.effect.radius : 40);
        break;
      case "stun":
        if (target) {
          burst(this, target, 0xffe066, 9);
          stunStars(this, target);
        }
        break;
      case "blast":
        if (target) {
          projectile(this, source, target, 0xff6b00, 3, () =>
            ringEffect(this, target.x, target.y - 2, 0xff6b00, skill.effect.type === "blast" ? skill.effect.radius : 40),
          );
        }
        break;
      case "radiance":
        ringEffect(this, source.x, source.y - 2, 0xffd43b, skill.effect.type === "radiance" ? skill.effect.radius : 40);
        healSparkles(this, source);
        break;
      case "buff":
        burst(this, source, Phaser.Display.Color.HexStringToColor(skill.color).color, 14);
        healSparkles(this, source);
        break;
      case "shout":
        ringEffect(this, source.x, source.y - 2, 0xe03131, skill.effect.type === "whirlwind" ? skill.effect.radius : 40);
        break;
      case "guard":
        burst(this, source, 0x74c0fc, 12);
        break;
    }
  }

  private showCastStart(event: CastStartEvent) {
    const skill = SKILLS[event.skillId];
    const view = this.viewFor(event.sourceId, "player");
    if (!skill || !view) return;
    this.castGlows.get(event.sourceId)?.();
    this.castGlows.set(event.sourceId, castingGlow(this, () => view, Phaser.Display.Color.HexStringToColor(skill.color).color));
    if (event.sourceId === this.room.sessionId) hud.startCastBar(skill.name, event.castMs, skill.color);
  }

  private showCastEnd(event: CastEndEvent) {
    this.castGlows.get(event.sourceId)?.();
    this.castGlows.delete(event.sourceId);
    if (event.sourceId === this.room.sessionId) hud.stopCastBar(event.interrupted);
  }

  private showChat(event: ChatEvent) {
    addChatMessage(event);
    // Same-room messages also appear as a speech bubble over the speaker.
    const view = event.fromSession ? this.viewFor(event.fromSession, "player") : undefined;
    if (!view || !getSettings().speechBubbles) return;
    this.speechBubble(view, event.text.length > 60 ? `${event.text.slice(0, 57)}…` : event.text);
  }

  /** Fishing lines for everyone, and the Balık Tut button for us. */
  private updateFishing() {
    const present = new Set<string>();
    const local = this.local;
    if (local) {
      present.add(this.room.sessionId);
      this.fishingLines.update(this.room.sessionId, local.view, local.state.fishing, { x: local.state.fishX, y: local.state.fishY });
      local.view.setWeaponHidden(local.state.fishing);
    }
    for (const [id, remote] of this.players) {
      present.add(id);
      this.fishingLines.update(id, remote.view, remote.state.fishing, { x: remote.state.fishX, y: remote.state.fishY });
      remote.view.setWeaponHidden(remote.state.fishing);
    }
    this.fishingLines.prune(present);

    if (!this.zone.fishing || !local || local.state.dead || local.state.stall) return setFishButton(null);
    if (local.state.fishing) return setFishButton({ fishing: true });
    const hasRod = inventoryState()?.slots.some((s) => s && ITEMS[s.defId]?.fishingRod) ?? false;
    const facing = { dx: local.dir === Direction.Right ? 1 : local.dir === Direction.Left ? -1 : 0, dy: local.dir === Direction.Down ? 1 : local.dir === Direction.Up ? -1 : 0 };
    const nearWater = castSpot(this.map, local.view.x, local.view.y, facing) !== null;
    setFishButton(hasRod && nearWater ? { fishing: false } : null);
  }

  /** Something bit: a splash at the float and the catch's name over the angler. */
  private showCatch(event: FishCatchEvent) {
    const isLocal = event.sessionId === this.room.sessionId;
    const entry = isLocal ? this.local : this.players.get(event.sessionId);
    const def = ITEMS[event.item];
    if (!entry || !def) return;
    fishSplash(this, entry.state.fishX, entry.state.fishY);
    floatingText(this, entry.view.x, entry.view.headY - 6, def.name, RARITY_COLORS[def.rarity], isLocal && def.rarity !== "common");
  }

  /** A line of speech over someone's head for a few seconds. */
  private speechBubble(view: EntityView, text: string) {
    const bubble = this.add
      .text(Math.round(view.x), Math.round(view.headY) - 12, text, {
        fontFamily: "Courier New, monospace",
        fontSize: "7px",
        color: "#1a1408",
        backgroundColor: "#fff8e1",
        padding: { x: 3, y: 2 },
        wordWrap: { width: 110 },
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setResolution(4)
      .setDepth(300000);
    const follow = () => bubble.setPosition(Math.round(view.x), Math.round(view.headY) - 12);
    this.events.on(Phaser.Scenes.Events.UPDATE, follow);
    this.time.delayedCall(4500, () => {
      this.events.off(Phaser.Scenes.Events.UPDATE, follow);
      this.tweens.add({ targets: bubble, alpha: 0, duration: 300, onComplete: () => bubble.destroy() });
    });
  }

  /** Bubble around players with an active shield. */
  private updateShieldBubble(sessionId: string, view: EntityView, shield: number, guarded = false) {
    let bubble = this.shieldBubbles.get(sessionId);
    if (shield <= 0 && !guarded) {
      bubble?.destroy();
      this.shieldBubbles.delete(sessionId);
      return;
    }
    if (!bubble) {
      bubble = this.add.graphics();
      bubble.fillStyle(0x74c0fc, 0.18).fillEllipse(0, 0, 20, 22);
      bubble.lineStyle(1, 0xa5d8ff, 0.9).strokeEllipse(0, 0, 20, 22);
      this.shieldBubbles.set(sessionId, bubble);
    }
    bubble.setPosition(Math.round(view.x), Math.round(view.y) - 8).setDepth(view.y + 0.7);
  }

  private showCombatEvent(event: CombatEvent) {
    const view = this.viewFor(event.targetId, event.targetKind);
    if (!view) return;
    if (!event.heal) view.flash();

    const me = this.room.sessionId;
    // Only show numbers that involve us, otherwise a busy area becomes unreadable.
    if (!getSettings().damageNumbers || (event.sourceId !== me && event.targetId !== me)) return;
    const y = view.headY - 2;
    if (event.heal) floatingText(this, view.x, y, `+${event.amount}`, "#4cd964");
    else if (event.targetId === me) floatingText(this, view.x, y, `-${event.amount}`, "#ff5a5a", event.crit);
    else if (event.crit) floatingText(this, view.x, y, `${event.amount}!`, "#ffd34d", true);
    else floatingText(this, view.x, y, `${event.amount}`, "#ffffff");
  }

  // ---- Simulation --------------------------------------------------------------

  /**
   * Server reconciliation: start from the authoritative position, then replay every
   * input the server hasn't processed yet. Since movement is deterministic, this
   * normally equals our prediction exactly and the player never notices.
   */
  private reconcile(server: PlayerView) {
    const local = this.local;
    if (!local) return;
    this.pendingInputs = this.pendingInputs.filter((input) => input.seq > server.lastSeq);
    let pos: Point = { x: server.x, y: server.y };
    for (const input of this.pendingInputs) {
      pos = stepMovement(this.map, pos.x, pos.y, input.dx, input.dy, TICK_MS / 1000);
    }
    if (distance(pos, local.curr) > TELEPORT_DISTANCE) local.prev = { ...pos };
    local.curr = pos;
  }

  /** You, your party (green), other players, NPCs and portals. */
  private refreshMinimap() {
    const local = this.local;
    if (!local) return;
    const dots: MinimapDot[] = [{ x: local.view.x, y: local.view.y, kind: "self" }];
    for (const [sessionId, remote] of this.players) {
      const kind = this.party.sessions.has(sessionId) ? "party" : this.isEnemyPlayer(sessionId) ? "enemy" : "player";
      dots.push({ x: remote.view.x, y: remote.view.y, kind });
    }
    for (const id of this.zone.npcs) dots.push({ x: NPCS[id].x, y: NPCS[id].y, kind: "npc" });
    for (const portal of this.zone.portals) dots.push({ x: portal.x, y: portal.y, kind: "portal" });
    drawMinimap(dots);
  }

  update(time: number, delta: number) {
    if (time >= this.nextMinimapAt) {
      this.nextMinimapAt = time + 100;
      this.refreshMinimap();
    }
    // Fixed-step simulation at the server's tick rate; clamp so a backgrounded tab doesn't burst.
    this.tickAccumulator = Math.min(this.tickAccumulator + delta, TICK_MS * 5);
    while (this.tickAccumulator >= TICK_MS) {
      this.fixedTick();
      this.tickAccumulator -= TICK_MS;
    }

    const local = this.local;
    if (local) {
      const alpha = this.tickAccumulator / TICK_MS;
      let x = local.prev.x + (local.curr.x - local.prev.x) * alpha;
      let y = local.prev.y + (local.curr.y - local.prev.y) * alpha;
      // Our own dash: glide from where we set off instead of popping to the landing spot.
      const glide = this.dashGlide;
      if (glide) {
        const t = Math.min(1, (performance.now() - glide.start) / glide.ms);
        const ease = 1 - (1 - t) * (1 - t);
        x = glide.from.x + (x - glide.from.x) * ease;
        y = glide.from.y + (y - glide.from.y) * ease;
        if (t >= 1) this.dashGlide = null;
      }
      local.view.setPosition(x, y);
      local.view.setAnimation(local.dir, local.moving);
      hud.setPosition(x, y);
      // Follow manually on whole pixels; Phaser's lerped follow causes sub-pixel jitter at high zoom.
      const camera = this.cameras.main;
      camera.centerOn(Math.round(x), Math.round(y));
      camera.scrollX = Math.round(camera.scrollX);
      camera.scrollY = Math.round(camera.scrollY);
    }

    if (local) {
      this.checkGates(local);
      const inMarket = this.onMarketTile(local);
      if (inMarket && !this.wasInMarket) hud.showMessage("Pazar alanı: burada tezgâh açıp eşya satabilirsin", "info", "#e8c33a");
      this.wasInMarket = inMarket;
      setStallButtonVisible(inMarket);
      const sellerId = browsingSeller();
      const seller = sellerId ? this.players.get(sellerId) : undefined;
      if (sellerId && (!seller || distance(local.view, seller.view) > STALL_RANGE + TILE_SIZE)) closeBrowse();
    }

    // Walking away from an NPC closes its window.
    const shopNpc = openShopNpc();
    if (shopNpc && local && distance(local.view, shopNpc) > NPC_RANGE + TILE_SIZE) closeShop();
    const keeper = storageNpc();
    if (keeper && local && distance(local.view, keeper) > NPC_RANGE + TILE_SIZE) closeStorage();
    const smith = openUpgradeNpc();
    if (smith && local && distance(local.view, smith) > NPC_RANGE + TILE_SIZE) closeUpgrade();
    const speaker = dialogNpc();
    if (speaker && local && distance(local.view, speaker) > NPC_RANGE + TILE_SIZE) closeNpcDialog();

    this.refreshBossBar();
    if (local) this.updateShieldBubble(this.room.sessionId, local.view, local.state.shield, local.state.guarded);
    for (const [sessionId, remote] of this.players) this.updateShieldBubble(sessionId, remote.view, remote.state.shield, remote.state.guarded);
    const renderTime = performance.now() - INTERPOLATION_DELAY_MS;
    for (const remote of this.players.values()) this.renderRemote(remote, renderTime);
    for (const remote of this.mobs.values()) this.renderRemote(remote, renderTime);
    for (const remote of this.minions.values()) this.renderRemote(remote, renderTime);
    this.updateFishing();

    const target = this.targetId ? (this.mobs.get(this.targetId) ?? this.players.get(this.targetId)) : undefined;
    this.targetRing.setVisible(!!target);
    if (target) this.targetRing.setPosition(Math.round(target.view.x), Math.round(target.view.y) - 1);
  }

  private fixedTick() {
    const local = this.local;
    if (!local) return;
    local.prev = { ...local.curr };

    let { dx, dy } = this.controls.moveAxis();
    // Keys win over a click-to-walk; otherwise keep walking towards what was clicked.
    if (dx !== 0 || dy !== 0) this.approach = null;
    else ({ dx, dy } = this.approachAxis(local) ?? { dx: 0, dy: 0 });
    // Rooted (Frost Nova in PvP) or keeping a stall: the server ignores movement, so don't predict any.
    if (local.state.dead || local.state.rooted || local.state.stall || this.leaving || (dx === 0 && dy === 0)) {
      local.moving = false;
      return;
    }

    const input: InputMessage = { seq: this.nextSeq++, dx, dy };
    local.curr = stepMovement(this.map, local.curr.x, local.curr.y, dx, dy, TICK_MS / 1000);
    local.dir = directionFrom(dx, dy, local.dir);
    local.moving = true;
    this.pendingInputs.push(input);
    this.room.send(Msg.Input, input);
  }

  private renderRemote(remote: Remote<PlayerView | MobView | MinionView>, renderTime: number) {
    const sample = remote.buffer.sample(renderTime);
    if (!sample) return;
    const moved = Math.abs(sample.x - remote.view.x) > 0.01 || Math.abs(sample.y - remote.view.y) > 0.01;
    remote.view.setPosition(sample.x, sample.y);
    remote.view.setAnimation(sample.dir, moved);
  }
}

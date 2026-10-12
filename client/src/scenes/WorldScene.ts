import Phaser from "phaser";
import { getStateCallbacks, type Room } from "colyseus.js";
import {
  Direction,
  directionFrom,
  directionToward,
  distance,
  isUpgradeable,
  itemSellPrice,
  ITEMS,
  LOOT_RANGE,
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
import { isMenuOpen, menuBack, openMenu } from "../ui/menu";
import { closeTopWindow, registerWindow } from "../ui/windows";
import { getSettings, onSettingsChange } from "../settings";
import { boneBurst, burst, castingGlow, frostRing, healSparkles, holyBeam, lightning, projectile } from "../fx/spells";
import { initPassives, togglePassives, updatePassives } from "../ui/passives";
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
import { closeUpgrade, initUpgrade, openUpgrade, openUpgradeNpc, refreshUpgrade, selectForUpgrade, showUpgradeResult } from "../ui/upgrade";

const PING_INTERVAL_MS = 2000;

/** Hotbar for a class: its three skills, then its two potions. */
function hotbarFor(cls: string): hud.HotbarEntry[] {
  const def = classOf(cls);
  return [
    ...def.skills.map((id) => ({ kind: "skill" as const, skill: SKILLS[id] })),
    ...def.potions.map((id) => ({ kind: "item" as const, item: ITEMS[id] })),
  ];
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
function playerAppearance(player: PlayerView): Appearance {
  return {
    type: "humanoid",
    tunic: player.color,
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
  /** Our party: id (for loot ownership) and members' session ids in this room. */
  private party: { id: string | null; sessions: Set<string> } = { id: null, sessions: new Set() };
  /** Session id of the player we are duelling (fight started), or null. */
  private duelOpponent: string | null = null;
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
  private arrived = false;
  /** Teleporting out: no more input, the scene is about to be replaced. */
  private leaving = false;
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

    for (const npc of this.zone.npcs.map((id) => NPCS[id])) {
      const view = new EntityView(this, npc.x, npc.y, npc.appearance, npc.name, "#7fe3ff");
      view.sprite.setInteractive({ useHandCursor: true });
      view.sprite.on("pointerdown", () => this.talkTo(npc));
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
      view.sprite.setInteractive({ useHandCursor: true });
      view.sprite.on("pointerdown", () => this.usePortal(def));
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
    this.controls = new InputManager(this);
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
    registerWindow("leaderboard", () => void toggleLeaderboard(false));
    registerWindow("stall-browse", closeBrowse);
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
    hud.onRespawnClicked(() => this.room.send(Msg.Respawn));

    const playerLevel = () => this.local?.state.level ?? 1;
    initInventory({
      move: (from, to) => this.room.send(Msg.MoveItem, { from, to }),
      activate: (index) => {
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
        if (openUpgradeNpc()) return isUpgradeable(def) ? "Sağ tık: yükseltmeye koy" : "Yükseltilemez";
        if (isStallSetupOpen() && !isStallOpen()) return "Sağ tık: tezgâha koy";
        if (openShopNpc()) return `Sağ tık: sat (${itemSellPrice(def, item.affixes) * item.qty} altın)`;
        if (def.slot) return "Sağ tık: kuşan";
        if (def.jewel) return "Sağ tık: pasif ağaca tak (P)";
        if (def.heal || def.mana || def.recall) return "Sağ tık: kullan";
        return `Satış değeri: ${itemSellPrice(def, item.affixes) * item.qty} altın`;
      },
      playerLevel,
    });
    initPassives({ move: (from, to) => this.room.send(Msg.MoveItem, { from, to }), playerLevel });
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
      playerLevel,
      playerClass: () => this.local?.state.cls ?? "warrior",
      changed: () => this.refreshNpcMarkers(),
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
        setDollLook(player.color, player.cls);
        this.hotbar = hotbarFor(player.cls);
        hud.initHotbar(this.hotbar, (index) => this.useHotbar(index), countItem);
        if (this.arrived) teleportIn(this, start);
        this.syncStall(sessionId, player);
        $(player).listen("stall", () => this.syncStall(sessionId, player));
      } else {
        const remote = { state: player, view, buffer: new SnapshotBuffer() };
        this.players.set(sessionId, remote);
        // Clicking another player: their market stall if they have one, else friendly
        // target (heals, shields), or attack in PvP zones.
        view.sprite.setInteractive({ useHandCursor: true });
        view.sprite.on("pointerdown", () => {
          if (player.stall) return this.browseStall(sessionId);
          this.selectTarget(sessionId, this.isEnemyPlayer(sessionId));
        });
        const sync = () => {
          remote.buffer.push(player.x, player.y, player.dir);
          view.setHealth(player.hp, player.maxHp, player.hp < player.maxHp && !player.dead);
          view.setDimmed(player.dead);
          view.setGhost(player.protected);
          view.setBaseTint(player.rooted ? 0x9ad5ff : null);
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
      view.sprite.setInteractive({ useHandCursor: true });
      view.sprite.on("pointerdown", () => this.selectTarget(mobId, true));

      const remote = { state: mob, view, buffer: new SnapshotBuffer() };
      this.mobs.set(mobId, remote);
      const sync = () => {
        remote.buffer.push(mob.x, mob.y, mob.dir);
        this.refreshMobHealth(mobId);
        view.setBaseTint(mob.rooted ? 0x9ad5ff : mob.enraged ? 0xff7070 : mob.empowered ? 0xc4b0ff : null);
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
      view.sprite.on("pointerdown", () => this.room.send(Msg.PickupLoot, { lootId }));
      this.loot.set(lootId, { state: loot, view });
      // Loot is private to the killer at first; others only see it once it becomes free.
      const sync = () => {
        const visible = this.canLoot(loot);
        view.setVisible(visible);
        if (visible) view.sprite.setInteractive({ useHandCursor: true });
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
      view.sprite.setInteractive({ useHandCursor: true });
      view.sprite.on("pointerdown", () => this.useTownPortal(portalId));
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
    this.room.onMessage(Msg.DuelState, (event: DuelStateEvent) => {
      this.duelOpponent = event.opponent;
      this.refreshHostility();
    });
    // Anything sent while the scene was still loading was dropped; ask for the inventory again.
    this.room.send(Msg.RequestInventory);
    this.room.onMessage(Msg.SkillUsed, (event: SkillUsedEvent) =>
      hud.startCooldown(event.skillId, event.cooldownMs, event.gcdMs),
    );
    this.room.onMessage(Msg.SkillError, (event: SkillErrorEvent) => hud.showMessage(event.message));
    this.room.onMessage(Msg.Notice, (event: NoticeEvent) => hud.showMessage(event.message, "info", event.color));
    this.room.onMessage(Msg.Inventory, (event: InventoryEvent) => {
      updateInventory(event);
      updatePassives(event);
      updateDoll(event.equipment);
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

  private useHotbar(slotIndex: number) {
    const entry = this.hotbar[slotIndex];
    if (!entry) return;
    hud.flashSlot(slotIndex);
    if (entry.kind === "skill") this.room.send(Msg.UseSkill, { skillId: entry.skill.id });
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
    closeNpcDialog();
    if (openNpcDialog(npc)) return;
    this.openNpcWindow(npc);
  }

  /** The NPC's shop or forge (only one NPC window at a time). */
  private openNpcWindow(npc: NpcDef) {
    closeNpcDialog();
    if (npc.role === "merchant") openShop(npc);
    else if (npc.role === "blacksmith") openUpgrade(npc);
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
      sign.setInteractive({ useHandCursor: true });
      sign.on("pointerdown", () => this.browseStall(sessionId));
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
    local.view.setBaseTint(p.rooted ? 0x9ad5ff : null);
    setPvpStats(this.zone.pvp ? { rating: p.pvpRating, kills: p.pvpKills, deaths: p.pvpDeaths } : null);
    local.view.setHealth(p.hp, p.maxHp, p.hp < p.maxHp && !p.dead);
    local.view.setWeapon(p.weapon, p.weaponPlus);
    local.view.setLook(playerAppearance(p));
    if (p.dead && this.targetId) this.selectTarget(null, false, false);
    if (p.dead) {
      closeShop();
      closeUpgrade();
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
      if (this.local && distance(this.local.view, at) < radius * 2) this.cameras.main.shake(180, 0.006);
      return;
    }
    if (event.skill === "charge") {
      source.playAction("slide", 450);
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
    const text = event.text.length > 60 ? `${event.text.slice(0, 57)}…` : event.text;
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

  update(_time: number, delta: number) {
    // Fixed-step simulation at the server's tick rate; clamp so a backgrounded tab doesn't burst.
    this.tickAccumulator = Math.min(this.tickAccumulator + delta, TICK_MS * 5);
    while (this.tickAccumulator >= TICK_MS) {
      this.fixedTick();
      this.tickAccumulator -= TICK_MS;
    }

    const local = this.local;
    if (local) {
      const alpha = this.tickAccumulator / TICK_MS;
      const x = local.prev.x + (local.curr.x - local.prev.x) * alpha;
      const y = local.prev.y + (local.curr.y - local.prev.y) * alpha;
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
      setStallButtonVisible(this.onMarketTile(local));
      const sellerId = browsingSeller();
      const seller = sellerId ? this.players.get(sellerId) : undefined;
      if (sellerId && (!seller || distance(local.view, seller.view) > STALL_RANGE + TILE_SIZE)) closeBrowse();
    }

    // Walking away from an NPC closes its window.
    const shopNpc = openShopNpc();
    if (shopNpc && local && distance(local.view, shopNpc) > NPC_RANGE + TILE_SIZE) closeShop();
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

    const target = this.targetId ? (this.mobs.get(this.targetId) ?? this.players.get(this.targetId)) : undefined;
    this.targetRing.setVisible(!!target);
    if (target) this.targetRing.setPosition(Math.round(target.view.x), Math.round(target.view.y) - 1);
  }

  private fixedTick() {
    const local = this.local;
    if (!local) return;
    local.prev = { ...local.curr };

    const { dx, dy } = this.controls.moveAxis();
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

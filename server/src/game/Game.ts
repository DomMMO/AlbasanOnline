import {
  collides,
  directionFrom,
  MAX_INPUT_BURST,
  classOf,
  MAX_LEVEL,
  PARTY_BOSS_HP_PER_PLAYER,
  SPAWN_PROTECTION_MS,
  stepMovement,
  TICK_MS,
  statsWithEquipment,
  sanitizeRanks,
  type FortuneState,
  type SkillRanks,
  type CombatStats,
  type InputMessage,
  type MobDef,
  type WorldMap,
  type ZoneDef,
  type ZoneId,
  type QuestProgress,
  zoneLayout,
  isNight,
  Msg,
  type NoticeEvent,
} from "../../../shared/src";
import type { CharacterProgress, CharacterRecord } from "../db/characters";
import { Player, type WorldState } from "../rooms/schema/WorldState";
import { cancelCast, forgetPlayer, updatePlayerCombat } from "./combat";
import { fromStored, toStored, type InventoryData, type StoredItem } from "./inventory";
import { refreshStats, sendInventory, type LootContents } from "./items";
import type { BossState } from "./boss";
import { closeStall, type StallState } from "./market";
import { questsFromStored, sendQuestLog } from "./quests";
import { nightChanged, spawnInitialMobs, updateMobs } from "./mobs";
import { dismissMinions, updateMinions, type MinionRuntime } from "./minions";
import { sendSkillRanks } from "./talents";
import { sendFortuneState } from "./fortune";
import { loseDuel, updateDuels, type DuelInvite, type DuelState } from "./duel";
import { worldMinute } from "./worldClock";
import type { SpawnZone } from "../../../shared/src";

// The game simulation, independent of networking. The room feeds it messages and
// calls tick(); it talks back only through GameIO. That keeps game rules testable
// and lets one process run many zones/instances at once (one Game per room).

export interface GameIO {
  broadcast(type: string, message: unknown): void;
  send(sessionId: string, type: string, message: unknown): void;
  /** Save these players right now, in one transaction (after a trade). */
  persist(sessionIds: string[]): void;
  /** Send a player to another zone (return scroll), as if through a portal. */
  transfer(sessionId: string, zone: ZoneId, arriveAt?: { x: number; y: number }): void;
}

export interface PlayerRuntime {
  characterId: number;
  inputQueue: InputMessage[];
  lastQueuedSeq: number;
  /** Token bucket: refills one per tick, caps at MAX_INPUT_BURST. */
  inputBudget: number;
  stats: CombatStats;
  inventory: InventoryData;
  /** Selected mob id, or null. Not synced: only the owner needs it. */
  targetId: string | null;
  attacking: boolean;
  nextSwingAt: number;
  gcdUntil: number;
  cooldowns: Map<string, number>;
  lastCombatAt: number;
  nextRegenAt: number;
  /** A spell with a cast time in progress. */
  casting: { skillId: string; endsAt: number; targetId: string | null } | null;
  shieldUntil: number;
  /** Kalkan Duvarı: takes `guardReduction` less damage until then. */
  guardUntil: number;
  guardReduction: number;
  /** GM accounts get a tag in chat. */
  isAdmin: boolean;
  /** Recent chat message times, for flood protection. */
  chatTimes: number[];
  /** Frost Nova in PvP: can't move until then. */
  rootedUntil: number;
  /** PvP spawn protection ends then (or when the player attacks). */
  protectedUntil: number;
  killStreak: number;
  /** victim character id -> wall-clock time of the last kill (rating farming guard). */
  recentKills: Map<number, number>;
  /** Our open market stall. While it is open we can't move or touch the inventory. */
  stall: StallState | null;
  /** Session id of the stall we have open in the browse window. */
  browsing: string | null;
  /** Quest log: active quests with kill counts, and completed ones. */
  quests: Map<string, QuestProgress>;
  /** Skill / passive ranks bought with skill points. */
  skillRanks: SkillRanks;
  /** Stun skills (PvP): can't move or act until then. */
  stunnedUntil: number;
  /** Active buff skills. */
  buffs: ActiveBuff[];
  /** Ayşe Teyze's fortune (the day it was read on decides whether it still counts). */
  fortune: FortuneState | null;
  /** The duel we are in (counting down or fighting). */
  duel: DuelState | null;
  /** A duel challenge waiting for our answer. */
  duelInvite: DuelInvite | null;
}

export interface ActiveBuff {
  skillId: string;
  until: number;
  attackPct: number;
  speedPct: number;
  reductionPct: number;
}

export type MobMode = "idle" | "chase" | "return";

export interface MobRuntime {
  def: MobDef;
  /** Respawn area; null = never respawns (dungeon mobs, boss adds). */
  zone: SpawnZone | null;
  home: { x: number; y: number };
  mode: MobMode;
  /** sessionId -> threat. Highest threat is the target; this is what party tanking builds on. */
  threat: Map<string, number>;
  /** First player to damage the mob gets the kill credit (WoW-style tagging). */
  taggedBy: string | null;
  nextSwingAt: number;
  wanderTo: { x: number; y: number } | null;
  nextWanderAt: number;
  /** Frost Nova: can't move until then. */
  rootedUntil: number;
  /** Stun skills: can't move or attack until then. */
  stunnedUntil: number;
  boss?: BossState;
  /** Stat and reward multiplier: 1, NIGHT_POWER at night outdoors, NIGHT_ONLY_POWER for night creatures. */
  power: number;
}

const MAX_QUEUED_INPUTS = 20;

export class Game {
  readonly map: WorldMap;
  readonly playerRuntime = new Map<string, PlayerRuntime>();
  readonly mobRuntime = new Map<string, MobRuntime>();
  readonly lootContents = new Map<string, LootContents>();
  readonly minionRuntime = new Map<string, MinionRuntime>();
  readonly random = Math.random;
  /** Night in an outdoor zone: mobs are stronger and night creatures are out. */
  night = false;
  /** Spawn areas of night-only creatures waiting for dark. */
  readonly dormantSpawns: SpawnZone[] = [];

  private time = 0;
  /** Most players this (instanced) zone has had at once; bosses are scaled to it. */
  private groupSize = 1;
  private timers: { at: number; fn: () => void }[] = [];
  private nextEntityId = 1;

  constructor(
    readonly state: WorldState,
    readonly io: GameIO,
    readonly zone: ZoneDef,
  ) {
    this.map = zoneLayout(zone.id).map;
    state.zone = zone.id;
    state.clock = Math.floor(worldMinute());
    this.night = !!zone.outdoor && isNight(state.clock);
    spawnInitialMobs(this);
  }

  /** Game time in ms since the room started. All cooldowns/timers use this clock. */
  now() {
    return this.time;
  }

  after(ms: number, fn: () => void) {
    this.timers.push({ at: this.time + ms, fn });
  }

  newId(prefix: string) {
    return `${prefix}${this.nextEntityId++}`;
  }

  tick() {
    this.time += TICK_MS;
    this.updateClock();
    this.runTimers();
    this.state.players.forEach((player, sessionId) => this.applyQueuedInputs(sessionId, player, this.playerRuntime.get(sessionId)!));
    updateMobs(this);
    updateMinions(this);
    updatePlayerCombat(this);
    updateDuels(this);
  }

  /**
   * Puts a loaded character into the zone: at the portal's arrival point, else at its
   * saved position (if saved in this zone and still walkable), else at the spawn.
   */
  addPlayer(sessionId: string, character: CharacterRecord, arriveAt?: { x: number; y: number }): Player {
    const player = new Player();
    player.name = character.name;
    player.color = character.color;
    player.cls = classOf(character.class).id;
    player.level = Math.min(Math.max(1, character.level), MAX_LEVEL);
    player.xp = character.xp;
    player.pvpRating = character.pvpRating;
    player.pvpKills = character.pvpKills;
    player.pvpDeaths = character.pvpDeaths;
    const savedSpot = this.zone.persistent && character.zone === this.zone.id && character.x !== null && character.y !== null;
    if (arriveAt && !collides(this.map, arriveAt.x, arriveAt.y)) {
      player.x = arriveAt.x;
      player.y = arriveAt.y;
    } else if (savedSpot && character.hp !== 0 && !collides(this.map, character.x!, character.y!)) {
      player.x = character.x!;
      player.y = character.y!;
    } else {
      this.placeAtSpawn(player);
    }

    this.state.players.set(sessionId, player);
    this.playerRuntime.set(sessionId, {
      characterId: character.id,
      inputQueue: [],
      lastQueuedSeq: 0,
      inputBudget: MAX_INPUT_BURST,
      stats: statsWithEquipment(character.class, 1, []), // set by refreshStats below
      inventory: fromStored(character.gold, character.items),
      targetId: null,
      attacking: false,
      nextSwingAt: 0,
      gcdUntil: 0,
      cooldowns: new Map(),
      lastCombatAt: -Infinity,
      nextRegenAt: 0,
      casting: null,
      shieldUntil: 0,
      guardUntil: 0,
      guardReduction: 0,
      isAdmin: false,
      chatTimes: [],
      rootedUntil: 0,
      protectedUntil: 0,
      killStreak: 0,
      recentKills: new Map(),
      stall: null,
      browsing: null,
      quests: questsFromStored(character.quests),
      skillRanks: sanitizeRanks(character.class, player.level, character.skillRanks),
      stunnedUntil: 0,
      buffs: [],
      fortune: character.fortune ?? null,
      duel: null,
      duelInvite: null,
    });

    refreshStats(this, sessionId);
    // Characters that logged out dead come back at spawn with full health, as if they respawned.
    player.hp = character.hp !== null && character.hp > 0 ? Math.min(character.hp, player.maxHp) : player.maxHp;
    // Rage starts empty, mana full.
    player.resource = classOf(player.cls).resource === "rage" ? 0 : player.maxResource;
    this.protectSpawn(sessionId);
    if (this.zone.instanced) this.scaleBossesForGroup(this.state.players.size);
    sendInventory(this, sessionId);
    sendQuestLog(this, sessionId);
    sendSkillRanks(this, sessionId);
    sendFortuneState(this, sessionId);
    return player;
  }

  /** What gets written to the database for this player. */
  progressOf(
    sessionId: string,
  ): { characterId: number; progress: CharacterProgress; gold: number; items: StoredItem[]; quests: QuestProgress[] } | null {
    const player = this.state.players.get(sessionId);
    const runtime = this.playerRuntime.get(sessionId);
    if (!player || !runtime) return null;
    return {
      characterId: runtime.characterId,
      progress: {
        level: player.level,
        xp: player.xp,
        hp: player.dead ? 0 : player.hp,
        // Only persistent zones are saved; leaving any other zone puts you back at its portal.
        zone: this.zone.persistent ? this.zone.id : null,
        x: this.zone.persistent ? player.x : null,
        y: this.zone.persistent ? player.y : null,
        pvpRating: player.pvpRating,
        pvpKills: player.pvpKills,
        pvpDeaths: player.pvpDeaths,
        skillRanks: runtime.skillRanks,
        fortune: runtime.fortune,
      },
      gold: runtime.inventory.gold,
      items: toStored(runtime.inventory),
      quests: [...runtime.quests.values()],
    };
  }

  removePlayer(sessionId: string) {
    loseDuel(this, sessionId, "left");
    closeStall(this, sessionId);
    dismissMinions(this, sessionId);
    forgetPlayer(this, sessionId);
    this.state.players.delete(sessionId);
    this.playerRuntime.delete(sessionId);
  }

  queueInput(sessionId: string, input: InputMessage) {
    const runtime = this.playerRuntime.get(sessionId);
    if (!runtime) return;
    // Out-of-order or replayed inputs are dropped.
    if (input.seq <= runtime.lastQueuedSeq) return;
    if (runtime.inputQueue.length >= MAX_QUEUED_INPUTS) return;
    runtime.lastQueuedSeq = input.seq;
    runtime.inputQueue.push(input);
  }

  /** Dungeon bosses get tougher as more party members come in (never weaker when someone leaves). */
  private scaleBossesForGroup(players: number) {
    if (players <= this.groupSize) return;
    const before = 1 + PARTY_BOSS_HP_PER_PLAYER * (this.groupSize - 1);
    const after = 1 + PARTY_BOSS_HP_PER_PLAYER * (players - 1);
    this.groupSize = players;
    for (const [id, runtime] of this.mobRuntime) {
      const mob = this.state.mobs.get(id);
      if (!runtime.boss || !mob) continue;
      const fraction = mob.hp / mob.maxHp;
      mob.maxHp = Math.round((mob.maxHp / before) * after);
      mob.hp = Math.max(1, Math.round(mob.maxHp * fraction));
    }
  }

  /** PvP zones: a fresh (re)spawn can't be hurt by players for a few seconds. */
  protectSpawn(sessionId: string) {
    const player = this.state.players.get(sessionId);
    const runtime = this.playerRuntime.get(sessionId);
    if (!player || !runtime || !this.zone.pvp) return;
    runtime.protectedUntil = this.time + SPAWN_PROTECTION_MS;
    player.protected = true;
  }

  placeAtSpawn(player: Player) {
    // Zones with several spawn points (PvP arena) pick one at random.
    const spawns = zoneLayout(this.zone.id).spawns;
    const spawn = spawns ? spawns[Math.floor(this.random() * spawns.length)] : this.map.spawn;
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = spawn.x + (this.random() - 0.5) * 48;
      const y = spawn.y + (this.random() - 0.5) * 48;
      if (!collides(this.map, x, y)) {
        player.x = x;
        player.y = y;
        return;
      }
    }
    player.x = spawn.x;
    player.y = spawn.y;
  }

  private applyQueuedInputs(sessionId: string, player: Player, runtime: PlayerRuntime) {
    runtime.inputBudget = Math.min(runtime.inputBudget + 1, MAX_INPUT_BURST);
    const dt = TICK_MS / 1000;
    let processed = 0;
    while (runtime.inputQueue.length > 0 && runtime.inputBudget >= 1) {
      const input = runtime.inputQueue.shift()!;
      // Dead, rooted or stall-keeping players' inputs are still acknowledged so the client's pending list drains.
      if (!player.dead && !player.rooted && !player.stall) {
        const next = stepMovement(this.map, player.x, player.y, input.dx, input.dy, dt);
        player.x = next.x;
        player.y = next.y;
        player.dir = directionFrom(input.dx, input.dy, player.dir);
        processed++;
      }
      player.lastSeq = input.seq;
      runtime.inputBudget--;
    }
    player.moving = processed > 0;
    // Moving interrupts spells with a cast time.
    if (processed > 0 && runtime.casting) cancelCast(this, sessionId, "Büyü iptal edildi");
  }

  private updateClock() {
    const minute = Math.floor(worldMinute());
    if (this.state.clock !== minute) this.state.clock = minute;
    const night = !!this.zone.outdoor && isNight(minute);
    if (night === this.night) return;
    this.night = night;
    nightChanged(this);
    // Town has no mobs; only hunting grounds announce it.
    if ((zoneLayout(this.zone.id).spawnZones ?? []).length > 0) {
      const message = night ? "Gece çöktü: yaratıklar güçlendi, gece yaratıkları ortaya çıktı!" : "Şafak söktü: gece yaratıkları çekildi.";
      this.io.broadcast(Msg.Notice, { message, color: night ? "#b197fc" : "#ffd34d" } satisfies NoticeEvent);
    }
  }

  private runTimers() {
    if (this.timers.length === 0) return;
    const due = this.timers.filter((t) => t.at <= this.time);
    if (due.length === 0) return;
    this.timers = this.timers.filter((t) => t.at > this.time);
    for (const timer of due) timer.fn();
  }
}

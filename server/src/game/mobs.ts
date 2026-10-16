import {
  collides,
  directionToward,
  distance,
  MOB_ATTACK_RANGE,
  MOB_FEAR_LEVEL_GAP,
  MOB_LEASH_RANGE,
  MOBS,
  mobBody,
  moveWithCollision,
  NIGHT_ONLY_POWER,
  NIGHT_POWER,
  type MobDef,
  TICK_MS,
  TILE_SIZE,
  zoneLayout,
  type SpawnZone,
} from "../../../shared/src";
import { Mob } from "../rooms/schema/WorldState";
import { bossSwingMultiplier, bossTick, newBossState, resetBoss } from "./boss";
import { mobAttackPlayer } from "./combat";
import type { Game, MobRuntime } from "./Game";

// Mob AI is a tiny state machine:
//   idle   -> wander around home; aggressive mobs pull nearby players into chase
//   chase  -> follow the highest-threat player and swing when in range
//   return -> walk home at full health (evading damage), then idle

const WANDER_RADIUS = TILE_SIZE * 3;
const RETURN_SPEED_MULTIPLIER = 1.6;
/** Keep mobs from spawning on top of the starting plaza. */
const SAFE_RADIUS_AROUND_SPAWN = TILE_SIZE * 6;
/** Mobs whose body ovals overlap are pushed apart by this share of the overlap each tick, at most
 *  this far (pixels), so they spread out instead of stacking on one another. */
const SEPARATION_SHARE = 0.5;
const SEPARATION_MAX = 2;
const SEPARATION_CELL = 48;
/** A dungeon pack: the mobs placed one after another round its first one (the pack's middle). */
const PACK_LINK = TILE_SIZE * 6;

export function spawnInitialMobs(game: Game) {
  const layout = zoneLayout(game.zone.id);
  // Dungeons (town and arena have none): fixed placements, no respawns, in packs.
  const packs = packsOf(layout.mobs);
  layout.mobs.forEach((placement, i) => spawnMobAt(game, placement.mob, placement, null, `p${packs[i]}`));
  // Open-world zones: mobs live in areas and respawn there; an area's mobs are a pack.
  for (const zone of layout.spawnZones ?? []) {
    for (let i = 0; i < zone.count; i++) spawnMob(game, zone);
  }
}

export function spawnMob(game: Game, zone: SpawnZone) {
  // Night creatures wait for dark.
  if (MOBS[zone.mob]?.nightOnly && !game.night) {
    game.dormantSpawns.push(zone);
    return;
  }
  const point = findSpawnPoint(game, zone);
  if (point) spawnMobAt(game, zone.mob, point, zone, `z${zone.tx},${zone.ty}`);
}

/**
 * Which pack each placed mob belongs to. A dungeon writes a pack's mobs one after another, the
 * first at the pack's middle and the rest round it: a mob far from the current pack's first one
 * starts the next pack. Then each mob on the border between two packs goes to the one whose
 * middle it is nearer (a pack whose middle was taken starts a little off it).
 */
export function packsOf(mobs: { x: number; y: number }[]): number[] {
  const out: number[] = [];
  let pack = 0;
  let first = mobs[0];
  for (const m of mobs) {
    if (Math.hypot(m.x - first.x, m.y - first.y) > PACK_LINK) {
      pack++;
      first = m;
    }
    out.push(pack);
  }
  const middle = (p: number) => {
    let x = 0;
    let y = 0;
    let n = 0;
    out.forEach((q, i) => {
      if (q === p) {
        x += mobs[i].x;
        y += mobs[i].y;
        n++;
      }
    });
    return n > 0 ? { x: x / n, y: y / n } : null;
  };
  for (let i = 0; i + 1 < mobs.length; i++) {
    if (out[i] === out[i + 1]) continue;
    // The last mob of one pack, the first of the next: each to the nearer middle.
    for (const k of [i, i + 1]) {
      const here = middle(out[k]);
      const other = middle(k === i ? out[i + 1] : out[i]);
      const others = out.filter((q) => q === out[k]).length;
      if (!here || !other || others < 2) continue;
      if (Math.hypot(mobs[k].x - other.x, mobs[k].y - other.y) < Math.hypot(mobs[k].x - here.x, mobs[k].y - here.y)) {
        out[k] = k === i ? out[i + 1] : out[i];
      }
    }
  }
  return out;
}

/** Pull one and the whole pack comes: the pack's idle mobs turn on the same player. */
function pullPack(game: Game, runtime: MobRuntime, sessionId: string) {
  if (!runtime.pack) return;
  for (const other of game.mobRuntime.values()) {
    if (other === runtime || other.pack !== runtime.pack || other.mode !== "idle") continue;
    other.threat.set(sessionId, (other.threat.get(sessionId) ?? 0) + 1);
    other.mode = "chase";
    other.wanderTo = null;
    other.nextSwingAt = Math.max(other.nextSwingAt, game.now() + 500 + game.random() * 400);
  }
}

/** Spawns a mob at an exact spot. `zone` = where it respawns after dying, or null for never. Returns its id. */
export function spawnMobAt(game: Game, mobId: string, point: { x: number; y: number }, zone: SpawnZone | null, pack: string | null = null): string | null {
  const def = MOBS[mobId];
  if (!def) return null;

  const id = game.newId("m");
  const mob = new Mob();
  const power = mobPower(game, def);
  mob.kind = def.id;
  mob.level = def.level;
  mob.maxHp = mob.hp = Math.round(def.maxHp * power);
  mob.empowered = power > 1;
  mob.x = point.x;
  mob.y = point.y;
  game.state.mobs.set(id, mob);
  game.mobRuntime.set(id, {
    def,
    zone,
    pack,
    home: { x: point.x, y: point.y },
    mode: "idle",
    threat: new Map(),
    taggedBy: null,
    nextSwingAt: 0,
    wanderTo: null,
    nextWanderAt: game.now() + game.random() * 5000,
    rootedUntil: 0,
    stunnedUntil: 0,
    boss: def.boss ? newBossState() : undefined,
    power,
  });
  return id;
}

function mobPower(game: Game, def: MobDef): number {
  if (def.nightOnly) return NIGHT_ONLY_POWER;
  return game.night ? NIGHT_POWER : 1;
}

/** Dusk or dawn: rescale every mob (keeping its health fraction) and wake or dismiss night creatures. */
export function nightChanged(game: Game) {
  for (const [id, runtime] of game.mobRuntime) {
    const mob = game.state.mobs.get(id);
    const power = mobPower(game, runtime.def);
    if (!mob || power === runtime.power) continue;
    const fraction = mob.hp / mob.maxHp;
    mob.maxHp = Math.round((mob.maxHp / runtime.power) * power);
    mob.hp = Math.max(1, Math.round(mob.maxHp * fraction));
    mob.empowered = power > 1;
    runtime.power = power;
  }
  if (game.night) {
    for (const zone of game.dormantSpawns.splice(0)) spawnMob(game, zone);
  }
}

/** A night creature caught by daylight fades away (only once nobody is fighting it). */
function fadeAtDawn(game: Game, id: string, runtime: MobRuntime) {
  game.state.mobs.delete(id);
  game.mobRuntime.delete(id);
  for (const playerRuntime of game.playerRuntime.values()) {
    if (playerRuntime.targetId === id) {
      playerRuntime.targetId = null;
      playerRuntime.attacking = false;
    }
  }
  if (runtime.zone) game.dormantSpawns.push(runtime.zone);
}

function findSpawnPoint(game: Game, zone: SpawnZone) {
  const cx = (zone.tx + 0.5) * TILE_SIZE;
  const cy = (zone.ty + 0.5) * TILE_SIZE;
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = game.random() * Math.PI * 2;
    const r = Math.sqrt(game.random()) * zone.radius * TILE_SIZE;
    const point = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    if (collides(game.map, point.x, point.y)) continue;
    if (distance(point, game.map.spawn) < SAFE_RADIUS_AROUND_SPAWN) continue;
    return point;
  }
  return null;
}

export function updateMobs(game: Game) {
  for (const [id, runtime] of game.mobRuntime) {
    const mob = game.state.mobs.get(id);
    if (!mob) continue;
    if (mob.rooted && game.now() >= runtime.rootedUntil) mob.rooted = false;
    // Stunned: stands still, doesn't swing (keeps its threat table).
    if (game.now() < runtime.stunnedUntil) {
      mob.moving = false;
      continue;
    }
    if (mob.stunned) mob.stunned = false;
    if (runtime.def.nightOnly && !game.night && runtime.mode === "idle") {
      fadeAtDawn(game, id, runtime);
      continue;
    }
    switch (runtime.mode) {
      case "idle":
        updateIdle(game, mob, runtime);
        break;
      case "chase":
        updateChase(game, id, mob, runtime);
        break;
      case "return":
        updateReturn(mob, runtime);
        break;
    }
  }
  separateMobs(game);
}

/**
 * Keeps mobs apart: each has a flat oval at its feet (mobBody, inside its own picture); where two
 * overlap they are pushed apart along the line between them, sliding along walls. A boss holds
 * its ground and only pushes the others.
 */
function separateMobs(game: Game) {
  const live: { id: string; mob: Mob; runtime: MobRuntime; rx: number; ry: number }[] = [];
  const grid = new Map<string, number[]>();
  for (const [id, runtime] of game.mobRuntime) {
    const mob = game.state.mobs.get(id);
    if (!mob || mob.hp <= 0) continue;
    const body = mobBody(runtime.def.id);
    const i = live.push({ id, mob, runtime, rx: body.rx, ry: body.ry }) - 1;
    const key = `${Math.floor(mob.x / SEPARATION_CELL)},${Math.floor(mob.y / SEPARATION_CELL)}`;
    const cell = grid.get(key);
    if (cell) cell.push(i);
    else grid.set(key, [i]);
  }
  for (let i = 0; i < live.length; i++) {
    const a = live[i];
    const cx = Math.floor(a.mob.x / SEPARATION_CELL);
    const cy = Math.floor(a.mob.y / SEPARATION_CELL);
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (const j of grid.get(`${gx},${gy}`) ?? []) {
          if (j <= i) continue;
          const b = live[j];
          const sx = a.rx + b.rx;
          const sy = a.ry + b.ry;
          let dx = b.mob.x - a.mob.x;
          let dy = b.mob.y - a.mob.y;
          let n = Math.hypot(dx / sx, dy / sy);
          if (n >= 1) continue;
          if (n < 1e-4) {
            // Exactly on top of each other: part them in a random direction.
            const angle = game.random() * Math.PI * 2;
            dx = Math.cos(angle) * sx * 0.01;
            dy = Math.sin(angle) * sy * 0.01;
            n = 0.01;
          }
          // Out along the line between them until the ovals just touch.
          const scale = (1 - n) / Math.max(n, 1e-4);
          let px = dx * scale;
          let py = dy * scale;
          const length = Math.hypot(px, py);
          const push = Math.min(length * SEPARATION_SHARE, SEPARATION_MAX);
          if (length === 0 || push <= 0) continue;
          px /= length;
          py /= length;
          const aMoves = !a.runtime.boss;
          const bMoves = !b.runtime.boss;
          if (!aMoves && !bMoves) continue;
          const share = aMoves && bMoves ? push / 2 : push;
          if (aMoves) nudge(game, a.mob, -px, -py, share);
          if (bMoves) nudge(game, b.mob, px, py, share);
        }
      }
    }
  }
}

function nudge(game: Game, mob: Mob, dx: number, dy: number, by: number) {
  const next = moveWithCollision(game.map, mob.x, mob.y, dx, dy, by);
  mob.x = next.x;
  mob.y = next.y;
}

/** Called when a player damages the mob (or it notices them). */
export function addThreat(game: Game, runtime: MobRuntime, sessionId: string, amount: number) {
  if (runtime.mode === "return") return;
  runtime.threat.set(sessionId, (runtime.threat.get(sessionId) ?? 0) + amount);
  if (runtime.mode === "idle") {
    runtime.mode = "chase";
    runtime.wanderTo = null;
    // Short reaction delay before the first swing.
    runtime.nextSwingAt = Math.max(runtime.nextSwingAt, game.now() + 500);
    pullPack(game, runtime, sessionId);
  }
}

function updateIdle(game: Game, mob: Mob, runtime: MobRuntime) {
  if (runtime.def.aggroRange > 0) {
    // Players far above the mob's level are left alone.
    const victim = nearestLivingPlayer(game, mob, runtime.def.aggroRange, (level) => level < mob.level + MOB_FEAR_LEVEL_GAP);
    if (victim) {
      addThreat(game, runtime, victim, 1);
      return;
    }
  }

  // ...and when one walks close, the mob edges away a little (bosses stand their ground).
  if (!runtime.boss && !mob.rooted && shyAway(game, mob, runtime)) return;

  if (!runtime.wanderTo && game.now() >= runtime.nextWanderAt) {
    const angle = game.random() * Math.PI * 2;
    const r = game.random() * WANDER_RADIUS;
    runtime.wanderTo = { x: runtime.home.x + Math.cos(angle) * r, y: runtime.home.y + Math.sin(angle) * r };
  }

  if (runtime.wanderTo && !mob.rooted) {
    const arrived = stepToward(game, mob, runtime.wanderTo, runtime.def.speed * 0.5);
    if (arrived) {
      runtime.wanderTo = null;
      runtime.nextWanderAt = game.now() + 3000 + game.random() * 5000;
    }
  } else {
    mob.moving = false;
  }
}

function updateChase(game: Game, mobId: string, mob: Mob, runtime: MobRuntime) {
  const targetId = highestThreat(game, runtime);
  const target = targetId ? game.state.players.get(targetId) : undefined;
  if (!targetId || !target || distance(mob, runtime.home) > MOB_LEASH_RANGE) {
    startReturn(mob, runtime);
    return;
  }
  mob.aggroId = targetId;
  if (runtime.boss && bossTick(game, mobId, mob, runtime, target)) return;

  if (distance(mob, target) > MOB_ATTACK_RANGE) {
    if (mob.rooted) mob.moving = false;
    else stepToward(game, mob, target, runtime.def.speed);
    return;
  }

  mob.moving = false;
  mob.dir = directionToward(target.x - mob.x, target.y - mob.y, mob.dir);
  if (game.now() >= runtime.nextSwingAt) {
    runtime.nextSwingAt = game.now() + runtime.def.attackSpeedMs * bossSwingMultiplier(runtime);
    mobAttackPlayer(game, mobId, runtime, targetId, target);
  }
}

function startReturn(mob: Mob, runtime: MobRuntime) {
  runtime.mode = "return";
  runtime.rootedUntil = 0;
  runtime.stunnedUntil = 0;
  mob.rooted = false;
  mob.stunned = false;
  mob.aggroId = "";
  runtime.threat.clear();
  runtime.taggedBy = null;
  mob.hp = mob.maxHp;
  if (runtime.boss) resetBoss(mob, runtime);
}

function updateReturn(mob: Mob, runtime: MobRuntime) {
  // Walk straight home ignoring walls, so a mob can never get stuck while evading.
  const dx = runtime.home.x - mob.x;
  const dy = runtime.home.y - mob.y;
  const dist = Math.hypot(dx, dy);
  const step = runtime.def.speed * RETURN_SPEED_MULTIPLIER * (TICK_MS / 1000);
  mob.dir = directionToward(dx, dy, mob.dir);
  if (dist <= step) {
    mob.x = runtime.home.x;
    mob.y = runtime.home.y;
    mob.moving = false;
    runtime.mode = "idle";
    return;
  }
  mob.x += (dx / dist) * step;
  mob.y += (dy / dist) * step;
  mob.moving = true;
}

/** Moves the mob toward `to`. Returns true once it is (nearly) there or blocked. */
function stepToward(game: Game, mob: Mob, to: { x: number; y: number }, speed: number) {
  const dx = to.x - mob.x;
  const dy = to.y - mob.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    mob.moving = false;
    return true;
  }
  // No pathfinding yet: mobs slide along walls and may get stuck behind them (A* comes later).
  const travel = Math.min(speed * (TICK_MS / 1000), dist);
  const before = { x: mob.x, y: mob.y };
  const next = moveWithCollision(game.map, mob.x, mob.y, dx / dist, dy / dist, travel);
  mob.x = next.x;
  mob.y = next.y;
  mob.dir = directionToward(dx, dy, mob.dir);
  const moved = before.x !== mob.x || before.y !== mob.y;
  mob.moving = moved;
  return !moved;
}

function highestThreat(game: Game, runtime: MobRuntime): string | null {
  let best: string | null = null;
  let bestThreat = -Infinity;
  for (const [sessionId, threat] of runtime.threat) {
    const player = game.state.players.get(sessionId);
    if (!player || player.dead) {
      runtime.threat.delete(sessionId);
      continue;
    }
    if (threat > bestThreat) {
      best = sessionId;
      bestThreat = threat;
    }
  }
  return best;
}

/** Shy-away range around a much stronger player, and how far from home a mob will back off. */
const SHY_RANGE = TILE_SIZE * 3.5;
const SHY_MAX_FROM_HOME = WANDER_RADIUS * 1.5;
const SHY_SPEED_MULTIPLIER = 0.35;

/** Steps slowly away from a nearby player MOB_FEAR_LEVEL_GAP+ levels above it. Returns true while doing so. */
function shyAway(game: Game, mob: Mob, runtime: MobRuntime): boolean {
  const strongId = nearestLivingPlayer(game, mob, SHY_RANGE, (level) => level >= mob.level + MOB_FEAR_LEVEL_GAP);
  const strong = strongId ? game.state.players.get(strongId) : undefined;
  if (!strong) return false;
  const dx = mob.x - strong.x;
  const dy = mob.y - strong.y;
  const dist = Math.hypot(dx, dy) || 1;
  const away = { x: mob.x + (dx / dist) * TILE_SIZE, y: mob.y + (dy / dist) * TILE_SIZE };
  runtime.wanderTo = null;
  runtime.nextWanderAt = game.now() + 2000;
  if (distance(away, runtime.home) > SHY_MAX_FROM_HOME) {
    // Backed off as far as it goes: just keep an eye on them.
    mob.moving = false;
    mob.dir = directionToward(-dx, -dy, mob.dir);
    return true;
  }
  stepToward(game, mob, away, runtime.def.speed * SHY_SPEED_MULTIPLIER);
  return true;
}

function nearestLivingPlayer(game: Game, mob: Mob, range: number, levelOk: (level: number) => boolean = () => true): string | null {
  let best: string | null = null;
  let bestDist = range;
  game.state.players.forEach((player, sessionId) => {
    if (player.dead || !levelOk(player.level)) return;
    const d = distance(mob, player);
    if (d <= bestDist) {
      best = sessionId;
      bestDist = d;
    }
  });
  return best;
}

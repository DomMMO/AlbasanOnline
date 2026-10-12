import {
  collides,
  directionToward,
  distance,
  MOB_ATTACK_RANGE,
  MOB_LEASH_RANGE,
  MOBS,
  moveWithCollision,
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

export function spawnInitialMobs(game: Game) {
  const layout = zoneLayout(game.zone.id);
  // Dungeons (town and arena have none): fixed placements, no respawns.
  for (const placement of layout.mobs) spawnMobAt(game, placement.mob, placement, null);
  // Open-world zones: mobs live in areas and respawn there.
  for (const zone of layout.spawnZones ?? []) {
    for (let i = 0; i < zone.count; i++) spawnMob(game, zone);
  }
}

export function spawnMob(game: Game, zone: SpawnZone) {
  const point = findSpawnPoint(game, zone);
  if (point) spawnMobAt(game, zone.mob, point, zone);
}

/** Spawns a mob at an exact spot. `zone` = where it respawns after dying, or null for never. Returns its id. */
export function spawnMobAt(game: Game, mobId: string, point: { x: number; y: number }, zone: SpawnZone | null): string | null {
  const def = MOBS[mobId];
  if (!def) return null;

  const id = game.newId("m");
  const mob = new Mob();
  mob.kind = def.id;
  mob.level = def.level;
  mob.maxHp = mob.hp = def.maxHp;
  mob.x = point.x;
  mob.y = point.y;
  game.state.mobs.set(id, mob);
  game.mobRuntime.set(id, {
    def,
    zone,
    home: { x: point.x, y: point.y },
    mode: "idle",
    threat: new Map(),
    taggedBy: null,
    nextSwingAt: 0,
    wanderTo: null,
    nextWanderAt: game.now() + game.random() * 5000,
    rootedUntil: 0,
    boss: def.boss ? newBossState() : undefined,
  });
  return id;
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
  }
}

function updateIdle(game: Game, mob: Mob, runtime: MobRuntime) {
  if (runtime.def.aggroRange > 0) {
    const victim = nearestLivingPlayer(game, mob, runtime.def.aggroRange);
    if (victim) {
      addThreat(game, runtime, victim, 1);
      return;
    }
  }

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
  mob.rooted = false;
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

function nearestLivingPlayer(game: Game, mob: Mob, range: number): string | null {
  let best: string | null = null;
  let bestDist = range;
  game.state.players.forEach((player, sessionId) => {
    if (player.dead) return;
    const d = distance(mob, player);
    if (d <= bestDist) {
      best = sessionId;
      bestDist = d;
    }
  });
  return best;
}

import {
  castsOf,
  directionToward,
  distance,
  hasLineOfSight,
  INTERRUPT_LOCK_MS,
  MOB_ATTACK_RANGE,
  MOB_CASTS,
  MOB_FIRST_CAST_MS,
  Msg,
  rollDamage,
  type AttackEvent,
  type MobCastDef,
  type MobCastEndEvent,
  type MobCastStartEvent,
} from "../../../shared/src";
import type { Mob, Player } from "../rooms/schema/WorldState";
import { broadcastCombat, cancelCast, hitPlayer } from "./combat";
import type { Game, MobRuntime } from "./Game";

// Mob abilities with a cast bar (shared/src/data/mobCasts.ts). A chasing mob starts one when it is
// ready and its target is near enough; while the bar fills it stands still and doesn't swing. When
// the bar is full the ability lands. An interrupt skill stops a magic cast (and locks that cast for
// INTERRUPT_LOCK_MS); a stun stops any cast (bosses can't be stunned).

export interface MobCastState {
  castId: string;
  endsAt: number;
  targetId: string;
  /** Area casts: where the target stood when the cast began (they can get out). */
  x: number;
  y: number;
}

/** Rage (Hiddet): harder and faster swings until `until`. */
export interface MobEnrage {
  until: number;
  attackPct: number;
  speedPct: number;
}

/** Below this share of health a pack mate is worth a heal. */
const MEND_BELOW = 0.75;
/** After a cast the mob waits this long before it swings. */
const AFTER_CAST_SWING_MS = 400;

/**
 * Runs while the mob is chasing `target`. Returns true when it is busy casting (it must not move
 * or swing this tick).
 */
export function mobCastTick(game: Game, mobId: string, mob: Mob, runtime: MobRuntime, targetId: string, target: Player): boolean {
  const now = game.now();
  if (runtime.cast) {
    mob.moving = false;
    if (now < runtime.cast.endsAt) {
      const facing = game.state.players.get(runtime.cast.targetId);
      if (facing) mob.dir = directionToward(facing.x - mob.x, facing.y - mob.y, mob.dir);
      return true;
    }
    const done = runtime.cast;
    runtime.cast = null;
    const def = MOB_CASTS[done.castId];
    runtime.castReady?.set(done.castId, now + def.cooldownMs);
    runtime.nextSwingAt = Math.max(runtime.nextSwingAt, now + AFTER_CAST_SWING_MS);
    game.io.broadcast(Msg.MobCastEnd, { mobId, interrupted: false } satisfies MobCastEndEvent);
    landCast(game, mobId, mob, runtime, def, done);
    return true;
  }
  const casts = castsOf(runtime.def);
  if (casts.length === 0) return false;
  if (!runtime.castReady) {
    // The fight just began: each ability comes a few seconds in, not all at once.
    const [from, to] = MOB_FIRST_CAST_MS;
    runtime.castReady = new Map(casts.map((id) => [id, now + from + game.random() * (to - from)]));
    return false;
  }
  for (const id of casts) {
    const def = MOB_CASTS[id];
    if (!def || now < (runtime.castReady.get(id) ?? 0) || !worthCasting(game, mob, runtime, def, target)) continue;
    startCast(game, mobId, mob, runtime, def, targetId, target);
    return true;
  }
  return false;
}

function worthCasting(game: Game, mob: Mob, runtime: MobRuntime, def: MobCastDef, target: Player): boolean {
  const reach = def.range ?? (runtime.def.ranged ? runtime.def.ranged.range : MOB_ATTACK_RANGE);
  if (distance(mob, target) > reach) return false;
  if (def.effect.type === "mend") return mendTargets(game, mob, runtime, def.effect.radius).some(([m]) => m.hp < m.maxHp * MEND_BELOW);
  if (def.effect.type === "enrage") return true;
  return hasLineOfSight(game.map, mob, target);
}

function startCast(game: Game, mobId: string, mob: Mob, runtime: MobRuntime, def: MobCastDef, targetId: string, target: Player) {
  runtime.cast = { castId: def.id, endsAt: game.now() + def.castMs, targetId, x: target.x, y: target.y };
  runtime.path = null;
  mob.moving = false;
  mob.dir = directionToward(target.x - mob.x, target.y - mob.y, mob.dir);
  const event: MobCastStartEvent = { mobId, castId: def.id, castMs: def.castMs };
  if (def.effect.type === "area") Object.assign(event, { x: target.x, y: target.y, radius: def.effect.radius });
  game.io.broadcast(Msg.MobCastStart, event);
}

/** The caster and its pack mates within radius that are alive (radius 0: only itself). */
function mendTargets(game: Game, mob: Mob, runtime: MobRuntime, radius: number): [Mob, MobRuntime][] {
  const out: [Mob, MobRuntime][] = [[mob, runtime]];
  if (radius <= 0 || !runtime.pack) return out;
  for (const [id, other] of game.mobRuntime) {
    if (other === runtime || other.pack !== runtime.pack) continue;
    const m = game.state.mobs.get(id);
    if (m && m.hp > 0 && distance(m, mob) <= radius) out.push([m, other]);
  }
  return out;
}

function landCast(game: Game, mobId: string, mob: Mob, runtime: MobRuntime, def: MobCastDef, cast: MobCastState) {
  const effect = def.effect;
  const attack = runtime.def.attack * runtime.power;
  const target = game.state.players.get(cast.targetId);
  const attackEvent = (targetId?: string) =>
    game.io.broadcast(Msg.Attack, { sourceId: mobId, sourceKind: "mob", skill: def.id, targetId, targetKind: targetId ? "player" : undefined } satisfies AttackEvent);
  switch (effect.type) {
    case "bolt":
    case "stun": {
      if (!target || target.dead) return;
      attackEvent(cast.targetId);
      const playerRuntime = game.playerRuntime.get(cast.targetId);
      if (!playerRuntime) return;
      const hit = rollDamage(attack * effect.multiplier, playerRuntime.stats.defense, game.random);
      hitPlayer(game, mobId, cast.targetId, target, hit.amount, hit.crit);
      if (effect.type === "stun" && !target.dead) stunPlayer(game, cast.targetId, target, effect.stunMs);
      return;
    }
    case "area": {
      attackEvent();
      game.state.players.forEach((player, sessionId) => {
        if (player.dead || distance(player, cast) > effect.radius) return;
        const playerRuntime = game.playerRuntime.get(sessionId);
        if (!playerRuntime) return;
        const hit = rollDamage(attack * effect.multiplier, playerRuntime.stats.defense, game.random);
        hitPlayer(game, mobId, sessionId, player, hit.amount, hit.crit);
      });
      return;
    }
    case "mend": {
      attackEvent();
      for (const [m] of mendTargets(game, mob, runtime, effect.radius)) {
        const healed = Math.min(Math.round(m.maxHp * effect.percent), m.maxHp - m.hp);
        if (healed <= 0) continue;
        m.hp += healed;
        const id = [...game.state.mobs.entries()].find(([, x]) => x === m)?.[0];
        if (id) broadcastCombat(game, { sourceId: mobId, targetId: id, targetKind: "mob", amount: healed, crit: false, heal: true });
      }
      return;
    }
    case "enrage": {
      attackEvent();
      runtime.enrage = { until: game.now() + effect.durationMs, attackPct: effect.attackPct, speedPct: effect.speedPct };
      return;
    }
  }
}

/** A mob's stun on a player: can't move, act or cast for a while. */
function stunPlayer(game: Game, sessionId: string, player: Player, ms: number) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime || player.protected) return;
  const until = game.now() + ms;
  runtime.stunnedUntil = Math.max(runtime.stunnedUntil, until);
  runtime.rootedUntil = Math.max(runtime.rootedUntil, until);
  player.stunned = true;
  player.rooted = true;
  cancelCast(game, sessionId);
}

/** Stops the mob's cast. `lockMs`: that cast can't start again for this long (else its cooldown). */
export function stopMobCast(game: Game, mobId: string, runtime: MobRuntime, lockMs?: number) {
  const cast = runtime.cast;
  if (!cast) return;
  runtime.cast = null;
  const now = game.now();
  runtime.castReady?.set(cast.castId, now + (lockMs ?? MOB_CASTS[cast.castId].cooldownMs));
  game.io.broadcast(Msg.MobCastEnd, { mobId, interrupted: true } satisfies MobCastEndEvent);
}

/**
 * An interrupt skill hits the mob: a magic cast stops and is locked for INTERRUPT_LOCK_MS.
 * "physical": it is casting something only a stun stops (or a boss's marked move); "idle": not casting.
 */
export function interruptMob(game: Game, mobId: string): "interrupted" | "physical" | "idle" {
  const runtime = game.mobRuntime.get(mobId);
  if (!runtime) return "idle";
  if (runtime.cast) {
    if (MOB_CASTS[runtime.cast.castId].kind !== "magic") return "physical";
    stopMobCast(game, mobId, runtime, INTERRUPT_LOCK_MS);
    return "interrupted";
  }
  return runtime.boss?.cast ? "physical" : "idle";
}

/** The mob stops fighting (leash, death): its cast, its rage and its ability timers go. */
export function resetMobCasts(game: Game, mobId: string, runtime: MobRuntime) {
  stopMobCast(game, mobId, runtime);
  runtime.castReady = null;
  runtime.enrage = null;
}

/** Rage on a mob right now (multipliers 1 when none). */
export function enrageOf(game: Game, runtime: MobRuntime): { attack: number; speed: number } {
  const rage = runtime.enrage;
  if (!rage || game.now() >= rage.until) return { attack: 1, speed: 1 };
  return { attack: 1 + rage.attackPct, speed: 1 + rage.speedPct };
}

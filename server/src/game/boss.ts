import {
  collides,
  Direction,
  directionToward,
  distance,
  Msg,
  rollDamage,
  type AttackEvent,
  type BossAbility,
  type BossCastEvent,
  type NoticeEvent,
} from "../../../shared/src";
import type { Mob } from "../rooms/schema/WorldState";
import { hitPlayer } from "./combat";
import type { Game, MobRuntime } from "./Game";
import { addThreat, spawnMobAt } from "./mobs";

// Boss mechanics, layered on top of normal mob AI:
//   - telegraphed abilities used in rotation (slam / leap / charge, see BossAbility)
//   - enrage below a health threshold: faster swings
//   - reinforcements at health thresholds

interface Cast {
  ability: BossAbility;
  endsAt: number;
  /** slam/leap: circle centre. charge: lane start. */
  x: number;
  y: number;
  /** charge: lane end. */
  toX: number;
  toY: number;
}

/** A charge in progress: the boss slides a few pixels per tick, hitting each player once. */
interface Dash {
  ux: number;
  uy: number;
  remaining: number;
  width: number;
  damage: number;
  hit: Set<string>;
}

export interface BossState {
  dash: Dash | null;
  nextAbilityAt: number;
  abilityIndex: number;
  cast: Cast | null;
  enraged: boolean;
  /** Indexes into def.boss.addsAt that already fired. */
  addsCalled: Set<number>;
}

const FIRST_ABILITY_DELAY_MS = 6000;
const FACING_VECTOR: Record<Direction, [number, number]> = {
  [Direction.Down]: [0, 1],
  [Direction.Up]: [0, -1],
  [Direction.Left]: [-1, 0],
  [Direction.Right]: [1, 0],
};
const BOSS_NOTICE_COLOR = "#ff8c1a";

export function newBossState(): BossState {
  return { dash: null, nextAbilityAt: 0, abilityIndex: 0, cast: null, enraged: false, addsCalled: new Set() };
}

function announce(game: Game, message: string) {
  game.io.broadcast(Msg.Notice, { message, color: BOSS_NOTICE_COLOR } satisfies NoticeEvent);
}

/** Runs every tick while the boss is fighting. Returns true when it is busy (casting) and must not move or swing. */
export function bossTick(game: Game, mobId: string, mob: Mob, runtime: MobRuntime, target: { x: number; y: number }): boolean {
  const state = runtime.boss!;
  const abilities = runtime.def.boss!.abilities;
  const now = game.now();
  if (state.nextAbilityAt === 0) state.nextAbilityAt = now + FIRST_ABILITY_DELAY_MS;

  if (state.dash) {
    advanceDash(game, mobId, mob, state);
    return true;
  }

  if (state.cast) {
    mob.moving = false;
    if (now < state.cast.endsAt) return true;
    resolveCast(game, mobId, mob, state.cast);
    state.nextAbilityAt = now + state.cast.ability.intervalMs;
    state.cast = null;
    // Give players a moment after the hit before melee resumes.
    runtime.nextSwingAt = Math.max(runtime.nextSwingAt, now + 600);
    return true;
  }

  if (now < state.nextAbilityAt || abilities.length === 0) return false;
  const ability = abilities[state.abilityIndex % abilities.length];
  state.abilityIndex++;
  state.cast = startCast(game, mobId, mob, ability, target);
  mob.moving = false;
  return true;
}

function startCast(game: Game, mobId: string, mob: Mob, ability: BossAbility, target: { x: number; y: number }): Cast {
  const endsAt = game.now() + ability.castMs;
  let cast: Cast;
  if (ability.type === "slam") {
    cast = { ability, endsAt, x: mob.x, y: mob.y, toX: mob.x, toY: mob.y };
  } else if (ability.type === "leap") {
    // Marks where the target stands now; they have castMs to get out.
    cast = { ability, endsAt, x: target.x, y: target.y, toX: target.x, toY: target.y };
  } else {
    let dx = target.x - mob.x;
    let dy = target.y - mob.y;
    // Standing on top of the target (e.g. right after a leap): charge the way the boss faces.
    if (Math.hypot(dx, dy) < 8) [dx, dy] = FACING_VECTOR[mob.dir as Direction];
    const len = Math.hypot(dx, dy);
    cast = { ability, endsAt, x: mob.x, y: mob.y, toX: mob.x + (dx / len) * ability.length, toY: mob.y + (dy / len) * ability.length };
  }
  mob.dir = directionToward(cast.toX - mob.x || target.x - mob.x, cast.toY - mob.y || target.y - mob.y, mob.dir);

  const event: BossCastEvent = { mobId, ability: ability.type, x: cast.x, y: cast.y, castMs: ability.castMs };
  if (ability.type === "charge") Object.assign(event, { toX: cast.toX, toY: cast.toY, width: ability.width });
  else event.radius = ability.radius;
  game.io.broadcast(Msg.BossCast, event);
  return cast;
}

function resolveCast(game: Game, mobId: string, mob: Mob, cast: Cast) {
  const { ability } = cast;
  const power = game.mobRuntime.get(mobId)?.power ?? 1;
  let hits: (player: { x: number; y: number }) => boolean;

  if (ability.type === "charge") {
    // The slide itself happens over the next few ticks (advanceDash).
    const len = Math.hypot(cast.toX - cast.x, cast.toY - cast.y) || 1;
    const boss = game.mobRuntime.get(mobId)!.boss!;
    boss.dash = {
      ux: (cast.toX - cast.x) / len,
      uy: (cast.toY - cast.y) / len,
      remaining: len,
      width: ability.width,
      damage: ability.damage * power,
      hit: new Set(),
    };
    game.io.broadcast(Msg.Attack, { sourceId: mobId, sourceKind: "mob", skill: "charge" } satisfies AttackEvent);
    advanceDash(game, mobId, mob, boss);
    return;
  } else {
    if (ability.type === "leap" && !collides(game.map, cast.x, cast.y)) {
      mob.x = cast.x;
      mob.y = cast.y;
    }
    hits = (p) => distance(p, cast) <= ability.radius;
  }

  game.io.broadcast(Msg.Attack, { sourceId: mobId, sourceKind: "mob", skill: ability.type } satisfies AttackEvent);
  game.state.players.forEach((player, sessionId) => {
    if (player.dead || !hits(player)) return;
    const playerRuntime = game.playerRuntime.get(sessionId);
    if (!playerRuntime) return;
    const hit = rollDamage(ability.damage * power, playerRuntime.stats.defense, game.random);
    hitPlayer(game, mobId, sessionId, player, hit.amount, hit.crit);
  });
}

const DASH_STEP = 28; // px per tick, ~560 px/s

function advanceDash(game: Game, mobId: string, mob: Mob, state: BossState) {
  const dash = state.dash!;
  const step = Math.min(DASH_STEP, dash.remaining);
  // Move in small increments so walls stop the slide cleanly.
  let moved = 0;
  while (moved + 4 <= step && !collides(game.map, mob.x + dash.ux * 4, mob.y + dash.uy * 4)) {
    mob.x += dash.ux * 4;
    mob.y += dash.uy * 4;
    moved += 4;
  }
  mob.moving = true;
  dash.remaining = moved < step ? 0 : dash.remaining - step;

  game.state.players.forEach((player, sessionId) => {
    if (player.dead || dash.hit.has(sessionId) || distance(player, mob) > dash.width / 2 + 6) return;
    const playerRuntime = game.playerRuntime.get(sessionId);
    if (!playerRuntime) return;
    dash.hit.add(sessionId);
    const hit = rollDamage(dash.damage, playerRuntime.stats.defense, game.random);
    hitPlayer(game, mobId, sessionId, player, hit.amount, hit.crit);
  });

  if (dash.remaining <= 0) {
    state.dash = null;
    mob.moving = false;
  }
}

/** Swing timer multiplier (enraged bosses swing faster). */
export function bossSwingMultiplier(runtime: MobRuntime): number {
  return runtime.boss?.enraged ? runtime.def.boss!.enrageSwingMultiplier : 1;
}

/** Health-threshold events; call after the boss takes damage. */
export function bossDamaged(game: Game, mob: Mob, runtime: MobRuntime) {
  const state = runtime.boss!;
  const def = runtime.def.boss!;
  const fraction = mob.hp / mob.maxHp;

  if (!state.enraged && fraction <= def.enrageAt) {
    state.enraged = true;
    mob.enraged = true;
    announce(game, `${runtime.def.name} öfkeleniyor!`);
  }

  def.addsAt.forEach((threshold, index) => {
    if (!def.addMob || fraction > threshold || state.addsCalled.has(index) || mob.hp === 0) return;
    state.addsCalled.add(index);
    announce(game, `${runtime.def.name} yardım çağırıyor!`);
    const victim = [...runtime.threat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    for (let i = 0; i < def.addCount; i++) {
      const angle = (Math.PI * 2 * i) / def.addCount + game.random();
      let point = { x: mob.x + Math.cos(angle) * 28, y: mob.y + Math.sin(angle) * 28 };
      if (collides(game.map, point.x, point.y)) point = { x: mob.x, y: mob.y };
      const addId = spawnMobAt(game, def.addMob, point, null);
      const add = addId ? game.mobRuntime.get(addId) : undefined;
      if (add && victim) addThreat(game, add, victim, 1);
    }
  });
}

/** Leash reset: the fight starts over. */
export function resetBoss(mob: Mob, runtime: MobRuntime) {
  runtime.boss = newBossState();
  mob.enraged = false;
}

export function bossDefeated(game: Game, runtime: MobRuntime) {
  // Field bosses come back after a while; only dungeon bosses open the way on.
  if (!game.zone.instanced) return announce(game, `${runtime.def.name} yenildi!`);
  // Big dungeons have several bosses: the way out opens with the last one.
  const left = [...game.mobRuntime.values()].filter((r) => r.boss).length;
  if (left > 0) return announce(game, `${runtime.def.name} yenildi! (${left} boss kaldı)`);
  game.state.cleared = true;
  announce(game, `${runtime.def.name} yenildi! Yeni portal açıldı.`);
}

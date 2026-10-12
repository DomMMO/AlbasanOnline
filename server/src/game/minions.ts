import { directionToward, distance, MELEE_RANGE, moveWithCollision, TICK_MS, TILE_SIZE, type SkillDef } from "../../../shared/src";
import { Minion } from "../rooms/schema/WorldState";
import { enemyAt, minionStrike } from "./combat";
import type { Game } from "./Game";

// Summoned minions (necromancer skeleton). A minion follows its owner, attacks whatever the
// owner is fighting and disappears when its time is up or the owner dies or leaves.
// Mobs never target minions; damage a minion deals counts as its owner's (kill credit, threat).

export interface MinionRuntime {
  ownerId: string;
  expiresAt: number;
  nextSwingAt: number;
  /** Damage per swing (owner's attack when summoned, scaled by the skill). */
  attack: number;
  swingMs: number;
  speed: number;
}

/** Stays this close to the owner when idle. */
const FOLLOW_DISTANCE = TILE_SIZE * 1.5;
/** Further than this from the owner (owner teleported, ran off): jumps back to them. */
const LEASH = TILE_SIZE * 16;
/** Looks for mobs attacking its owner within this range. */
const GUARD_RANGE = TILE_SIZE * 8;

type SummonSkill = SkillDef & { effect: { type: "summon" } };

/** Raises `count` minions around the owner (passive tree jewels can add more), replacing any already up. */
export function summonMinion(game: Game, ownerId: string, skill: SummonSkill, attack: number, count = 1) {
  const owner = game.state.players.get(ownerId);
  if (!owner) return;
  dismissMinions(game, ownerId);
  for (let i = 0; i < count; i++) {
    const id = game.newId("s");
    const minion = new Minion();
    minion.skill = skill.id;
    minion.ownerId = ownerId;
    const angle = (i / count) * Math.PI * 2;
    const spot = moveWithCollision(game.map, owner.x, owner.y, Math.cos(angle), Math.sin(angle), TILE_SIZE);
    minion.x = spot.x;
    minion.y = spot.y;
    game.state.minions.set(id, minion);
    game.minionRuntime.set(id, {
      ownerId,
      expiresAt: game.now() + skill.effect.durationMs,
      nextSwingAt: game.now() + 600 + i * 250,
      attack,
      swingMs: skill.effect.swingMs,
      speed: skill.effect.speed,
    });
  }
}

export function dismissMinions(game: Game, ownerId: string) {
  for (const [id, runtime] of game.minionRuntime) {
    if (runtime.ownerId !== ownerId) continue;
    game.minionRuntime.delete(id);
    game.state.minions.delete(id);
  }
}

export function updateMinions(game: Game) {
  for (const [id, runtime] of game.minionRuntime) {
    const minion = game.state.minions.get(id);
    const owner = game.state.players.get(runtime.ownerId);
    const ownerRuntime = game.playerRuntime.get(runtime.ownerId);
    if (!minion || !owner || !ownerRuntime || owner.dead || game.now() >= runtime.expiresAt) {
      game.minionRuntime.delete(id);
      game.state.minions.delete(id);
      continue;
    }
    if (distance(minion, owner) > LEASH) {
      minion.x = owner.x;
      minion.y = owner.y;
    }

    const targetId = pickTarget(game, runtime.ownerId, ownerRuntime.attacking ? ownerRuntime.targetId : null, minion);
    const target = targetId ? enemyAt(game, runtime.ownerId, targetId) : undefined;
    if (target) {
      if (distance(minion, target.entity) > MELEE_RANGE) {
        step(game, minion, target.entity, runtime.speed);
      } else {
        minion.moving = false;
        minion.dir = directionToward(target.entity.x - minion.x, target.entity.y - minion.y, minion.dir);
        if (game.now() >= runtime.nextSwingAt) {
          runtime.nextSwingAt = game.now() + runtime.swingMs;
          minionStrike(game, id, runtime.ownerId, target, runtime.attack);
        }
      }
    } else if (distance(minion, owner) > FOLLOW_DISTANCE) {
      step(game, minion, owner, runtime.speed);
    } else {
      minion.moving = false;
    }
  }
}

/** The owner's target if they are attacking, else the nearest mob going after the owner. */
function pickTarget(game: Game, ownerId: string, ownerTarget: string | null, minion: Minion): string | null {
  if (ownerTarget && enemyAt(game, ownerId, ownerTarget)) return ownerTarget;
  let best: string | null = null;
  let bestDist = GUARD_RANGE;
  game.state.mobs.forEach((mob, mobId) => {
    if (mob.aggroId !== ownerId) return;
    const d = distance(minion, mob);
    if (d < bestDist) {
      best = mobId;
      bestDist = d;
    }
  });
  return best;
}

function step(game: Game, minion: Minion, to: { x: number; y: number }, speed: number) {
  const dx = to.x - minion.x;
  const dy = to.y - minion.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const next = moveWithCollision(game.map, minion.x, minion.y, dx / dist, dy / dist, Math.min(speed * (TICK_MS / 1000), dist));
  minion.moving = next.x !== minion.x || next.y !== minion.y;
  minion.x = next.x;
  minion.y = next.y;
  minion.dir = directionToward(dx, dy, minion.dir);
}

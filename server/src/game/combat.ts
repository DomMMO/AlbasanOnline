import {
  classOf,
  COMBAT_TIMEOUT_MS,
  directionToward,
  distance,
  GLOBAL_COOLDOWN_MS,
  hasLineOfSight,
  MANA_REGEN_IN_COMBAT,
  MANA_REGEN_OUT_OF_COMBAT,
  MAX_LEVEL,
  HEAL_THREAT,
  MELEE_RANGE,
  Msg,
  PARTY_XP_BONUS,
  PARTY_XP_RANGE,
  PVP_CC_MULTIPLIER,
  PVP_DAMAGE_MULTIPLIER,
  RAGE_DECAY_PER_SECOND,
  RAGE_MAX,
  RAGE_PER_HIT_TAKEN,
  RAGE_PER_SWING,
  WARRIOR_THREAT_MULTIPLIER,
  REGEN_PER_SECOND,
  rollDamage,
  collides,
  CRIT_MULTIPLIER,
  SKILLS,
  skillPower,
  xpForKill,
  xpToNextLevel,
  type AttackEvent,
  type CastEndEvent,
  type CastStartEvent,
  type CombatEvent,
  type LevelUpEvent,
  type SkillDef,
  type SkillErrorEvent,
  type SkillUsedEvent,
  type XpGainedEvent,
} from "../../../shared/src";
import type { Mob, Player } from "../rooms/schema/WorldState";
import type { ActiveBuff, Game, MobRuntime, PlayerRuntime } from "./Game";
import { sendSkillRanks } from "./talents";
import { bossDamaged, bossDefeated } from "./boss";
import { dropLoot, refreshStats } from "./items";
import { questKill } from "./quests";
import { addThreat, spawnMob } from "./mobs";
import { sameParty } from "./party";
import { recordPvpKill } from "./pvp";
import { isDueling, loseDuel } from "./duel";
import { dismissMinions, summonMinion } from "./minions";

// All damage, healing, XP and death go through this file. The client never
// decides any of it; it only asks ("use skill X") and displays the results.

const REGEN_INTERVAL_MS = 1000;
/** Extra range allowed when a cast finishes (the target may have stepped back a little). */
const CAST_RANGE_TOLERANCE = 16;

const usesRage = (player: Player) => classOf(player.cls).resource === "rage";

function fail(game: Game, sessionId: string, message: string) {
  game.io.send(sessionId, Msg.SkillError, { message } satisfies SkillErrorEvent);
}

export type Enemy = { kind: "mob"; id: string; entity: Mob } | { kind: "player"; id: string; entity: Player };

/** Party members are never enemies, even in PvP zones. */
function partyMates(game: Game, a: string, b: string): boolean {
  const ra = game.playerRuntime.get(a);
  const rb = game.playerRuntime.get(b);
  return !!ra && !!rb && sameParty(ra.characterId, rb.characterId);
}

/** In PvP zones everyone outside your party; elsewhere only your duel opponent. */
function hostilePlayer(game: Game, sessionId: string, otherId: string): boolean {
  if (otherId === sessionId) return false;
  return game.zone.pvp ? !partyMates(game, sessionId, otherId) : isDueling(game, sessionId, otherId);
}

/** A hostile target: any mob, or another living player you may fight (PvP zone, duel). */
export function enemyAt(game: Game, sessionId: string, targetId: string | null): Enemy | undefined {
  if (!targetId) return undefined;
  const mob = game.state.mobs.get(targetId);
  if (mob) return { kind: "mob", id: targetId, entity: mob };
  const player = hostilePlayer(game, sessionId, targetId) ? game.state.players.get(targetId) : undefined;
  return player && !player.dead ? { kind: "player", id: targetId, entity: player } : undefined;
}

/** Attacking (or casting at) someone ends your own spawn protection. */
function dropProtection(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (player?.protected && runtime) {
    player.protected = false;
    runtime.protectedUntil = 0;
  }
}

/** A minion's swing: damage counts as its owner's. */
export function minionStrike(game: Game, minionId: string, ownerId: string, enemy: Enemy, attackValue: number) {
  game.io.broadcast(Msg.Attack, { sourceId: minionId, sourceKind: "minion", targetId: enemy.id, targetKind: enemy.kind } satisfies AttackEvent);
  const owner = game.playerRuntime.get(ownerId);
  if (owner) owner.lastCombatAt = game.now();
  dropProtection(game, ownerId);
  hitEnemy(game, ownerId, enemy, attackValue);
}

/** Damage from a player to an enemy (mob or, in PvP, another player). Returns the damage dealt. */
function hitEnemy(game: Game, sessionId: string, enemy: Enemy, attackValue: number): number {
  const stats = game.playerRuntime.get(sessionId)?.stats;
  const critChance = stats?.critChance;
  let dealt: number;
  if (enemy.kind === "mob") {
    const hit = rollDamage(attackValue, mobDefense(game, enemy.id), game.random, critChance, CRIT_MULTIPLIER + (stats?.critDamage ?? 0));
    dealt = Math.min(hit.amount, enemy.entity.hp);
    damageMob(game, sessionId, enemy.id, enemy.entity, hit.amount, hit.crit);
  } else {
    const victimRuntime = game.playerRuntime.get(enemy.id);
    if (!victimRuntime || enemy.entity.protected) return 0;
    const hit = rollDamage(attackValue * PVP_DAMAGE_MULTIPLIER, victimRuntime.stats.defense, game.random, critChance, CRIT_MULTIPLIER + (stats?.critDamage ?? 0));
    dealt = Math.min(hit.amount, enemy.entity.hp);
    hitPlayer(game, sessionId, enemy.id, enemy.entity, hit.amount, hit.crit);
  }
  if (stats?.lifeSteal) lifeSteal(game, sessionId, dealt * stats.lifeSteal);
  return dealt;
}

/** Item modifier: part of the damage dealt comes back as health. */
function lifeSteal(game: Game, sessionId: string, amount: number) {
  const player = game.state.players.get(sessionId);
  if (!player || player.dead) return;
  const healed = Math.min(Math.floor(amount), player.maxHp - player.hp);
  if (healed > 0) player.hp += healed;
}

/** Every enemy within `radius` of the caster. */
function enemiesAround(game: Game, sessionId: string, center: { x: number; y: number }, radius: number): Enemy[] {
  const enemies: Enemy[] = [];
  game.state.mobs.forEach((mob, id) => {
    if (distance(center, mob) <= radius) enemies.push({ kind: "mob", id, entity: mob });
  });
  game.state.players.forEach((player, id) => {
    if (!player.dead && hostilePlayer(game, sessionId, id) && distance(center, player) <= radius) {
      enemies.push({ kind: "player", id, entity: player });
    }
  });
  return enemies;
}

export function setTarget(game: Game, sessionId: string, targetId: string | null, attack: boolean) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime || player.dead) return;
  const isMob = targetId !== null && game.state.mobs.has(targetId);
  // Other players: friendly targets (heals, shields), or enemies in PvP zones and duels.
  const isPlayer = targetId !== null && targetId !== sessionId && game.state.players.has(targetId);
  runtime.targetId = isMob || isPlayer ? targetId : null;
  runtime.attacking = attack && (isMob || (isPlayer && hostilePlayer(game, sessionId, targetId!)));
}

/** Works out who a skill hits, or returns the reason it can't be used. */
function resolveTarget(game: Game, sessionId: string, player: Player, runtime: PlayerRuntime, skill: SkillDef, tolerance = 0): { targetId: string | null } | string {
  if (skill.target === "enemy") {
    const enemy = enemyAt(game, sessionId, runtime.targetId);
    if (!enemy) return "Hedef yok";
    if (distance(player, enemy.entity) > skill.range + tolerance) return "Hedef çok uzak";
    if (skill.range > MELEE_RANGE && !hasLineOfSight(game.map, player, enemy.entity)) return "Hedef görünmüyor";
    return { targetId: enemy.id };
  }
  if (skill.target === "friendly") {
    // Never heal an enemy (PvP: anyone outside the party; a duel opponent).
    if (runtime.targetId && hostilePlayer(game, sessionId, runtime.targetId)) return { targetId: sessionId };
    const friend = runtime.targetId ? game.state.players.get(runtime.targetId) : undefined;
    if (!friend || friend.dead) return { targetId: sessionId }; // no friendly target: yourself
    if (distance(player, friend) > skill.range + tolerance) return "Hedef çok uzak";
    if (!hasLineOfSight(game.map, player, friend)) return "Hedef görünmüyor";
    return { targetId: runtime.targetId };
  }
  return { targetId: null };
}

export function useSkill(game: Game, sessionId: string, skillId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const skill = SKILLS[skillId];
  if (!player || !runtime || !skill || !classOf(player.cls).skills.includes(skill.id)) return;
  const now = game.now();

  if (player.dead) return fail(game, sessionId, "Ölüyken yapamazsın");
  if ((runtime.skillRanks[skill.id] ?? 0) < 1) return fail(game, sessionId, "Bu yeteneği henüz öğrenmedin (K)");
  if (now < runtime.stunnedUntil) return fail(game, sessionId, "Sersemlemiş durumdasın");
  // Spamming a key during the GCD is normal; ignore it silently.
  if (skill.triggersGcd && now < runtime.gcdUntil) return;
  if (runtime.casting) return fail(game, sessionId, "Zaten büyü yapıyorsun");
  if (now < (runtime.cooldowns.get(skill.id) ?? 0)) return fail(game, sessionId, "Henüz hazır değil");
  const resolved = resolveTarget(game, sessionId, player, runtime, skill);
  if (typeof resolved === "string") return fail(game, sessionId, resolved);
  if (player.resource < skillCost(runtime, skill)) return fail(game, sessionId, usesRage(player) ? "Yeterli öfke yok" : "Yeterli mana yok");

  if (skill.castMs > 0) {
    // Cast time: start now, resolve in updatePlayerCombat. Moving cancels it.
    runtime.casting = { skillId: skill.id, endsAt: now + skill.castMs, targetId: resolved.targetId };
    if (skill.triggersGcd) runtime.gcdUntil = now + GLOBAL_COOLDOWN_MS;
    const target = resolved.targetId ? (game.state.mobs.get(resolved.targetId) ?? game.state.players.get(resolved.targetId)) : undefined;
    if (target && target !== player && !player.moving) player.dir = directionToward(target.x - player.x, target.y - player.y, player.dir);
    game.io.send(sessionId, Msg.SkillUsed, { skillId: skill.id, cooldownMs: 0, gcdMs: skill.triggersGcd ? GLOBAL_COOLDOWN_MS : 0 } satisfies SkillUsedEvent);
    game.io.broadcast(Msg.CastStart, { sourceId: sessionId, skillId: skill.id, castMs: skill.castMs } satisfies CastStartEvent);
    if (skill.target === "enemy") dropProtection(game, sessionId);
    return;
  }

  if (skill.triggersGcd) runtime.gcdUntil = now + GLOBAL_COOLDOWN_MS;
  performSkill(game, sessionId, player, runtime, skill, resolved.targetId);
}

/** Rage / mana a skill costs this player (passive tree jewels can lower it). */
function skillCost(runtime: PlayerRuntime, skill: SkillDef): number {
  return Math.ceil(skill.cost * (1 - runtime.stats.costReduction));
}

/** Applies a skill's effect, pays its cost and starts its cooldown. */
function performSkill(game: Game, sessionId: string, player: Player, runtime: PlayerRuntime, skill: SkillDef, targetId: string | null) {
  const now = game.now();
  const effect = skill.effect;
  // Passive tree jewels (and Zeka) make skills stronger.
  const power = skillPower(runtime.stats, skill.id);
  const attack = runtime.stats.attack * power * (1 + buffTotals(runtime, now).attackPct);
  const self = { sourceId: sessionId, sourceKind: "player" as const, skill: skill.id };

  switch (effect.type) {
    case "strike": {
      const enemy = enemyAt(game, sessionId, targetId);
      if (!enemy) return fail(game, sessionId, "Hedef yok");
      dropProtection(game, sessionId);
      broadcastAttack(game, player, { ...self, targetId: enemy.id, targetKind: enemy.kind }, enemy.entity);
      // Melee classes keep swinging at what they hit.
      if (!classOf(player.cls).autoAttack.ranged) runtime.attacking = true;
      runtime.lastCombatAt = now;
      hitEnemy(game, sessionId, enemy, attack * effect.multiplier + effect.bonus * power);
      break;
    }
    case "drain": {
      const enemy = enemyAt(game, sessionId, targetId);
      if (!enemy) return fail(game, sessionId, "Hedef yok");
      dropProtection(game, sessionId);
      broadcastAttack(game, player, { ...self, targetId: enemy.id, targetKind: enemy.kind }, enemy.entity);
      runtime.lastCombatAt = now;
      const dealt = hitEnemy(game, sessionId, enemy, attack * effect.multiplier + effect.bonus * power);
      const healed = player.dead ? 0 : Math.min(Math.round(dealt * effect.healFraction), player.maxHp - player.hp);
      if (healed > 0) {
        player.hp += healed;
        broadcastCombat(game, { sourceId: sessionId, targetId: sessionId, targetKind: "player", amount: healed, crit: false, heal: true });
      }
      break;
    }
    case "stun": {
      const enemy = enemyAt(game, sessionId, targetId);
      if (!enemy) return fail(game, sessionId, "Hedef yok");
      dropProtection(game, sessionId);
      broadcastAttack(game, player, { ...self, targetId: enemy.id, targetKind: enemy.kind }, enemy.entity);
      runtime.lastCombatAt = now;
      hitEnemy(game, sessionId, enemy, attack * effect.multiplier + effect.bonus * power);
      stunEnemy(game, enemy, effect.stunMs);
      break;
    }
    case "blast": {
      const enemy = enemyAt(game, sessionId, targetId);
      if (!enemy) return fail(game, sessionId, "Hedef yok");
      dropProtection(game, sessionId);
      broadcastAttack(game, player, { ...self, targetId: enemy.id, targetKind: enemy.kind }, enemy.entity);
      runtime.lastCombatAt = now;
      for (const victim of enemiesAround(game, sessionId, { x: enemy.entity.x, y: enemy.entity.y }, effect.radius)) {
        hitEnemy(game, sessionId, victim, attack * effect.multiplier);
      }
      break;
    }
    case "radiance": {
      const victims = enemiesAround(game, sessionId, player, effect.radius);
      if (victims.length > 0) {
        runtime.lastCombatAt = now;
        dropProtection(game, sessionId);
      }
      broadcastAttack(game, player, self);
      for (const victim of victims) hitEnemy(game, sessionId, victim, attack * effect.multiplier);
      for (const [friendId, friend] of friendsAround(game, sessionId, player, effect.radius)) {
        const healed = Math.min(Math.round(attack * effect.healMultiplier), friend.maxHp - friend.hp);
        if (healed <= 0) continue;
        friend.hp += healed;
        addHealThreat(game, sessionId, friendId, healed);
        broadcastCombat(game, { sourceId: sessionId, targetId: friendId, targetKind: "player", amount: healed, crit: false, heal: true });
      }
      break;
    }
    case "dash": {
      const enemy = effect.mode === "forward" ? undefined : enemyAt(game, sessionId, targetId);
      if (effect.mode !== "forward" && !enemy) return fail(game, sessionId, "Hedef yok");
      const from = { x: player.x, y: player.y };
      dash(game, player, enemy?.entity, effect.mode, effect.distance);
      game.io.broadcast(Msg.Attack, { ...self, targetId: enemy?.id, targetKind: enemy?.kind, fromX: from.x, fromY: from.y } satisfies AttackEvent);
      cancelCast(game, sessionId);
      if (enemy) {
        dropProtection(game, sessionId);
        runtime.lastCombatAt = now;
        player.dir = directionToward(enemy.entity.x - player.x, enemy.entity.y - player.y, player.dir);
      }
      const hitMultiplier = effect.multiplier ?? 0;
      if (effect.landRadius && hitMultiplier > 0) {
        const victims = enemiesAround(game, sessionId, player, effect.landRadius);
        if (victims.length > 0) runtime.lastCombatAt = now;
        for (const victim of victims) hitEnemy(game, sessionId, victim, attack * hitMultiplier);
      } else if (enemy && hitMultiplier > 0) {
        hitEnemy(game, sessionId, enemy, attack * hitMultiplier);
      }
      if (enemy && effect.stunMs) stunEnemy(game, enemy, effect.stunMs);
      if (enemy && !classOf(player.cls).autoAttack.ranged) runtime.attacking = true;
      if (effect.healPercent) {
        const healed = Math.min(Math.round(player.maxHp * effect.healPercent * power), player.maxHp - player.hp);
        if (healed > 0) {
          player.hp += healed;
          broadcastCombat(game, { sourceId: sessionId, targetId: sessionId, targetKind: "player", amount: healed, crit: false, heal: true });
        }
      }
      if (effect.shieldPercent) {
        player.shield = Math.max(player.shield, Math.round(player.maxHp * effect.shieldPercent * power));
        runtime.shieldUntil = Math.max(runtime.shieldUntil, now + 6000);
      }
      break;
    }
    case "buff": {
      if (effect.hpCostPercent) {
        const cost = Math.round(player.maxHp * effect.hpCostPercent);
        if (player.hp <= cost) return fail(game, sessionId, "Canın yetmiyor");
        player.hp -= cost;
      }
      const buff: ActiveBuff = {
        skillId: skill.id,
        until: now + effect.durationMs,
        attackPct: (effect.attackPct ?? 0) * power,
        speedPct: (effect.speedPct ?? 0) * power,
        reductionPct: effect.reductionPct ?? 0,
      };
      const targets = effect.partyRadius ? friendsAround(game, sessionId, player, effect.partyRadius) : [[sessionId, player] as const];
      for (const [friendId, friend] of targets) {
        const friendRuntime = game.playerRuntime.get(friendId);
        if (!friendRuntime) continue;
        // Re-casting refreshes rather than stacking.
        friendRuntime.buffs = [...friendRuntime.buffs.filter((b) => b.skillId !== skill.id), { ...buff }];
        friend.buffed = true;
      }
      broadcastAttack(game, player, self);
      break;
    }
    case "guard": {
      runtime.guardUntil = now + effect.durationMs;
      runtime.guardReduction = effect.reduction;
      player.guarded = true;
      broadcastAttack(game, player, self);
      break;
    }
    case "summon": {
      summonMinion(game, sessionId, skill as SkillDef & { effect: typeof effect }, attack * effect.multiplier * (1 + runtime.stats.minionDamage), runtime.stats.minionCount);
      broadcastAttack(game, player, self);
      break;
    }
    case "whirlwind":
    case "nova": {
      const victims = enemiesAround(game, sessionId, player, effect.radius);
      if (effect.type === "whirlwind" && victims.length === 0) return fail(game, sessionId, "Yakında düşman yok");
      if (victims.length > 0) {
        runtime.lastCombatAt = now;
        dropProtection(game, sessionId);
      }
      broadcastAttack(game, player, self);
      for (const enemy of victims) {
        if (effect.type === "nova") {
          if (enemy.kind === "mob") rootMob(game, enemy.id, enemy.entity, effect.rootMs);
          else if (!enemy.entity.protected) rootPlayer(game, enemy.id, enemy.entity, effect.rootMs * PVP_CC_MULTIPLIER);
        }
        hitEnemy(game, sessionId, enemy, attack * effect.multiplier);
      }
      break;
    }
    case "heal": {
      const amount = Math.min(Math.round(player.maxHp * effect.percent * power), player.maxHp - player.hp);
      player.hp += amount;
      broadcastAttack(game, player, { ...self, targetId: sessionId, targetKind: "player" });
      broadcastCombat(game, { sourceId: sessionId, targetId: sessionId, targetKind: "player", amount, crit: false, heal: true });
      break;
    }
    case "healTarget": {
      const friend = targetId ? game.state.players.get(targetId) : undefined;
      if (!friend || friend.dead || !targetId) return fail(game, sessionId, "Hedef yok");
      const amount = Math.min(Math.round(attack * effect.multiplier + effect.bonus * power), friend.maxHp - friend.hp);
      friend.hp += amount;
      addHealThreat(game, sessionId, targetId, amount);
      broadcastAttack(game, player, { ...self, targetId, targetKind: "player" }, targetId === sessionId ? undefined : friend);
      broadcastCombat(game, { sourceId: sessionId, targetId, targetKind: "player", amount, crit: false, heal: true });
      break;
    }
    case "shield": {
      const friend = targetId ? game.state.players.get(targetId) : undefined;
      const friendRuntime = targetId ? game.playerRuntime.get(targetId) : undefined;
      if (!friend || friend.dead || !friendRuntime || !targetId) return fail(game, sessionId, "Hedef yok");
      friend.shield = Math.round(attack * effect.multiplier + effect.bonus * power);
      friendRuntime.shieldUntil = now + effect.durationMs;
      broadcastAttack(game, player, { ...self, targetId, targetKind: "player" }, targetId === sessionId ? undefined : friend);
      break;
    }
  }

  player.resource = Math.max(0, player.resource - skillCost(runtime, skill));
  const cooldownMs = Math.round(skill.cooldownMs * (1 - runtime.stats.cooldownReduction));
  if (cooldownMs > 0) runtime.cooldowns.set(skill.id, now + cooldownMs);
  game.io.send(sessionId, Msg.SkillUsed, {
    skillId: skill.id,
    cooldownMs,
    // Cast-time skills already triggered the GCD when the cast started.
    gcdMs: skill.triggersGcd && skill.castMs === 0 ? GLOBAL_COOLDOWN_MS : 0,
  } satisfies SkillUsedEvent);
}

/** Stops a cast in progress (moved, died...). */
export function cancelCast(game: Game, sessionId: string, message?: string) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime?.casting) return;
  runtime.casting = null;
  game.io.broadcast(Msg.CastEnd, { sourceId: sessionId, interrupted: true } satisfies CastEndEvent);
  if (message) fail(game, sessionId, message);
}

function finishCast(game: Game, sessionId: string, player: Player, runtime: PlayerRuntime) {
  const casting = runtime.casting!;
  const skill = SKILLS[casting.skillId];
  // Re-check the target: it may have died, walked off or hidden behind a wall.
  const savedTarget = runtime.targetId;
  runtime.targetId = casting.targetId === sessionId ? null : casting.targetId;
  const resolved = resolveTarget(game, sessionId, player, runtime, skill, CAST_RANGE_TOLERANCE);
  runtime.targetId = savedTarget;
  if (typeof resolved === "string") return cancelCast(game, sessionId, resolved);
  if (player.resource < skillCost(runtime, skill)) return cancelCast(game, sessionId, "Yeterli mana yok");

  runtime.casting = null;
  game.io.broadcast(Msg.CastEnd, { sourceId: sessionId, interrupted: false } satisfies CastEndEvent);
  performSkill(game, sessionId, player, runtime, skill, resolved.targetId);
}

export function respawn(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime || !player.dead) return;
  player.dead = false;
  player.hp = player.maxHp;
  player.resource = usesRage(player) ? 0 : player.maxResource;
  runtime.lastCombatAt = -Infinity;
  game.placeAtSpawn(player);
  game.protectSpawn(sessionId);
}

/** Per-tick player combat: casts finishing, auto-attacks, regeneration, shield expiry. */
export function updatePlayerCombat(game: Game) {
  const now = game.now();
  game.state.players.forEach((player, sessionId) => {
    const runtime = game.playerRuntime.get(sessionId);
    if (!runtime || player.dead) return;

    if (runtime.targetId && !game.state.mobs.has(runtime.targetId) && !game.state.players.has(runtime.targetId)) {
      runtime.targetId = null;
      runtime.attacking = false;
    }

    if (runtime.casting && now >= runtime.casting.endsAt) finishCast(game, sessionId, player, runtime);

    const enemy = runtime.attacking ? enemyAt(game, sessionId, runtime.targetId) : undefined;
    if (enemy && !runtime.casting && now >= runtime.nextSwingAt) autoAttack(game, sessionId, player, runtime, enemy);

    if (player.shield > 0 && now >= runtime.shieldUntil) player.shield = 0;
    if (player.guarded && now >= runtime.guardUntil) player.guarded = false;
    if (player.stunned && now >= runtime.stunnedUntil) player.stunned = false;
    if (player.rooted && now >= runtime.rootedUntil) player.rooted = false;
    if (runtime.buffs.length > 0) {
      runtime.buffs = runtime.buffs.filter((b) => b.until > now);
      player.buffed = runtime.buffs.length > 0;
    }
    if (player.protected && now >= runtime.protectedUntil) player.protected = false;

    if (now >= runtime.nextRegenAt) {
      runtime.nextRegenAt = now + REGEN_INTERVAL_MS;
      const inCombat = now - runtime.lastCombatAt < COMBAT_TIMEOUT_MS;
      if (!inCombat) player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * REGEN_PER_SECOND));
      else if (runtime.stats.combatRegen > 0) player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * runtime.stats.combatRegen));
      if (usesRage(player)) {
        if (!inCombat) player.resource = Math.max(0, player.resource - RAGE_DECAY_PER_SECOND);
      } else if (classOf(player.cls).resource === "energy") {
        player.resource = Math.min(player.maxResource, player.resource + ENERGY_PER_SECOND);
      } else {
        const rate = inCombat ? MANA_REGEN_IN_COMBAT : MANA_REGEN_OUT_OF_COMBAT;
        player.resource = Math.min(player.maxResource, player.resource + Math.ceil(player.maxResource * rate));
      }
    }
  });
}

function autoAttack(game: Game, sessionId: string, player: Player, runtime: PlayerRuntime, enemy: Enemy) {
  const auto = classOf(player.cls).autoAttack;
  if (game.now() < runtime.stunnedUntil) return;
  if (distance(player, enemy.entity) > auto.range) return;
  if (auto.ranged && !hasLineOfSight(game.map, player, enemy.entity)) return;
  const buffs = buffTotals(runtime, game.now());
  runtime.nextSwingAt = game.now() + runtime.stats.attackSpeedMs / (1 + buffs.speedPct);
  runtime.lastCombatAt = game.now();
  dropProtection(game, sessionId);
  if (usesRage(player)) player.resource = Math.min(RAGE_MAX, player.resource + RAGE_PER_SWING);
  broadcastAttack(game, player, { sourceId: sessionId, sourceKind: "player", targetId: enemy.id, targetKind: enemy.kind }, enemy.entity);
  hitEnemy(game, sessionId, enemy, runtime.stats.attack * auto.multiplier * (1 + buffs.attackPct));
}

/** Rogues' energy refills this much per second, in or out of combat. */
const ENERGY_PER_SECOND = 12;

function buffTotals(runtime: PlayerRuntime, now: number) {
  const totals = { attackPct: 0, speedPct: 0, reductionPct: 0 };
  for (const buff of runtime.buffs) {
    if (buff.until <= now) continue;
    totals.attackPct += buff.attackPct;
    totals.speedPct += buff.speedPct;
    totals.reductionPct += buff.reductionPct;
  }
  return totals;
}

/** The caster and living party members within `radius` (for party heals and buffs). */
function friendsAround(game: Game, sessionId: string, center: { x: number; y: number }, radius: number): (readonly [string, Player])[] {
  const friends: (readonly [string, Player])[] = [];
  game.state.players.forEach((player, id) => {
    if (player.dead) return;
    if (id === sessionId || (partyMates(game, sessionId, id) && distance(center, player) <= radius)) friends.push([id, player] as const);
  });
  return friends;
}

/** Can't move or attack for a while. Bosses are immune; players (PvP) get half. */
function stunEnemy(game: Game, enemy: Enemy, durationMs: number) {
  const now = game.now();
  if (enemy.kind === "mob") {
    const runtime = game.mobRuntime.get(enemy.id);
    if (!runtime || runtime.boss || runtime.mode === "return") return;
    runtime.stunnedUntil = Math.max(runtime.stunnedUntil, now + durationMs);
    enemy.entity.stunned = true;
    enemy.entity.moving = false;
    return;
  }
  const runtime = game.playerRuntime.get(enemy.id);
  if (!runtime || enemy.entity.protected) return;
  const until = now + durationMs * PVP_CC_MULTIPLIER;
  runtime.stunnedUntil = Math.max(runtime.stunnedUntil, until);
  runtime.rootedUntil = Math.max(runtime.rootedUntil, until);
  enemy.entity.stunned = true;
  enemy.entity.rooted = true;
  cancelCast(game, enemy.id);
}

/**
 * Moves a player at once (dash skills), a few pixels at a time so walls stop it:
 * along the facing direction, up to an enemy, or just past it.
 */
function dash(game: Game, player: Player, target: { x: number; y: number } | undefined, mode: "forward" | "toTarget" | "behindTarget", maxDistance: number) {
  let dx: number;
  let dy: number;
  let length: number;
  if (!target) {
    const dirs = [
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 0],
    ];
    [dx, dy] = dirs[player.dir] ?? [0, 1];
    length = maxDistance;
  } else {
    const tx = target.x - player.x;
    const ty = target.y - player.y;
    const dist = Math.hypot(tx, ty) || 1;
    dx = tx / dist;
    dy = ty / dist;
    // Stop just short of the target, or land just past it.
    length = Math.min(maxDistance, mode === "behindTarget" ? dist + 14 : Math.max(0, dist - MELEE_RANGE * 0.6));
  }
  const step = 4;
  for (let moved = 0; moved + step <= length; moved += step) {
    const nx = player.x + dx * step;
    const ny = player.y + dy * step;
    if (collides(game.map, nx, ny)) break;
    player.x = nx;
    player.y = ny;
  }
  player.moving = false;
}

function rootPlayer(game: Game, sessionId: string, player: Player, durationMs: number) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime) return;
  runtime.rootedUntil = game.now() + durationMs;
  player.rooted = true;
  cancelCast(game, sessionId);
}

function rootMob(game: Game, mobId: string, mob: Mob, durationMs: number) {
  const runtime = game.mobRuntime.get(mobId);
  // Bosses are immune to crowd control.
  if (!runtime || runtime.boss || runtime.mode === "return") return;
  runtime.rootedUntil = game.now() + durationMs;
  mob.rooted = true;
}

export function mobAttackPlayer(game: Game, mobId: string, mobRuntime: MobRuntime, sessionId: string, player: Player) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime || player.dead) return;
  const hit = rollDamage(mobRuntime.def.attack * mobRuntime.power, runtime.stats.defense, game.random);
  game.io.broadcast(Msg.Attack, { sourceId: mobId, sourceKind: "mob", targetId: sessionId, targetKind: "player" } satisfies AttackEvent);
  hitPlayer(game, mobId, sessionId, player, hit.amount, hit.crit);
}

/** Applies damage from a mob to a player (melee or boss ability). Shields absorb first. */
export function hitPlayer(game: Game, sourceId: string, sessionId: string, player: Player, amount: number, crit: boolean) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime || player.dead) return;
  runtime.lastCombatAt = game.now();
  if (usesRage(player)) player.resource = Math.min(RAGE_MAX, player.resource + RAGE_PER_HIT_TAKEN);
  // Tanks shrug off part of every hit; Kalkan Duvarı, the passive tree and buffs on top of that.
  const guard = game.now() < runtime.guardUntil ? 1 - runtime.guardReduction : 1;
  const buffed = 1 - Math.min(0.6, buffTotals(runtime, game.now()).reductionPct);
  amount = Math.max(1, Math.round(amount * (classOf(player.cls).damageTaken ?? 1) * guard * buffed * (1 - runtime.stats.damageReduction)));
  const absorbed = Math.min(player.shield, amount);
  player.shield -= absorbed;
  const taken = amount - absorbed;
  // Duels never kill: the blow that would have is the winning one and leaves 1 HP.
  const duelWon = taken >= player.hp && isDueling(game, sessionId, sourceId);
  player.hp = duelWon ? 1 : Math.max(0, player.hp - taken);
  broadcastCombat(game, { sourceId, targetId: sessionId, targetKind: "player", amount: taken, crit, heal: false });
  if (duelWon) return loseDuel(game, sessionId, "beaten");
  if (player.hp === 0) {
    killPlayer(game, sessionId, player, runtime);
    // Killed by another player in a PvP zone: score it.
    if (game.zone.pvp && game.state.players.has(sourceId)) recordPvpKill(game, sourceId, sessionId);
  }
}

/** Removes a player from every mob's threat table (death, disconnect). */
export function forgetPlayer(game: Game, sessionId: string) {
  for (const runtime of game.mobRuntime.values()) {
    runtime.threat.delete(sessionId);
    if (runtime.taggedBy === sessionId) runtime.taggedBy = null;
  }
}

function damageMob(game: Game, sessionId: string, mobId: string, mob: Mob, amount: number, crit: boolean) {
  const runtime = game.mobRuntime.get(mobId);
  // Mobs walking home after a leash are immune ("evade").
  if (!runtime || runtime.mode === "return" || mob.hp === 0) return;

  const dealt = Math.min(amount, mob.hp);
  mob.hp -= dealt;
  runtime.taggedBy ??= sessionId;
  // Warriors are the tanks: their damage holds aggro better.
  const attacker = game.state.players.get(sessionId);
  // Guardians taunt: any hit puts them on top of the threat table at once.
  if (attacker && classOf(attacker.cls).tauntOnHit) {
    const top = Math.max(0, ...[...runtime.threat].filter(([id]) => id !== sessionId).map(([, threat]) => threat));
    if ((runtime.threat.get(sessionId) ?? 0) <= top) runtime.threat.set(sessionId, top + 1);
  }
  addThreat(game, runtime, sessionId, dealt * (attacker && usesRage(attacker) ? WARRIOR_THREAT_MULTIPLIER : 1));
  broadcastCombat(game, { sourceId: sessionId, targetId: mobId, targetKind: "mob", amount, crit, heal: false });

  if (runtime.boss) bossDamaged(game, mob, runtime);
  if (mob.hp === 0) killMob(game, mobId, mob, runtime, sessionId);
}

/** Healing draws threat from every mob fighting the healed player. */
function addHealThreat(game: Game, healerId: string, healedId: string, amount: number) {
  if (amount <= 0) return;
  const engaged = [...game.mobRuntime.values()].filter((r) => r.mode === "chase" && r.threat.has(healedId));
  for (const runtime of engaged) addThreat(game, runtime, healerId, (amount * HEAL_THREAT) / engaged.length);
}

/** The tagger plus their party members in this zone who are near the kill. */
function xpRecipients(game: Game, taggerId: string, at: { x: number; y: number }): string[] {
  const tagger = game.playerRuntime.get(taggerId);
  if (!tagger) return [];
  const recipients: string[] = [];
  game.state.players.forEach((player, sessionId) => {
    const runtime = game.playerRuntime.get(sessionId);
    if (!runtime || player.dead || !sameParty(tagger.characterId, runtime.characterId)) return;
    if (sessionId === taggerId || distance(player, at) <= PARTY_XP_RANGE) recipients.push(sessionId);
  });
  return recipients;
}

function killMob(game: Game, mobId: string, mob: Mob, runtime: MobRuntime, killerId: string) {
  // Passive tree: the killing blow heals.
  const killer = game.state.players.get(killerId);
  const killHeal = game.playerRuntime.get(killerId)?.stats.killHeal ?? 0;
  if (killer && !killer.dead && killHeal > 0) {
    const healed = Math.min(Math.round(killer.maxHp * killHeal), killer.maxHp - killer.hp);
    if (healed > 0) {
      killer.hp += healed;
      broadcastCombat(game, { sourceId: killerId, targetId: killerId, targetKind: "player", amount: healed, crit: false, heal: true });
    }
  }
  if (runtime.taggedBy) {
    // Split between nearby party members, with a bonus for grouping.
    const recipients = xpRecipients(game, runtime.taggedBy, mob);
    const share = (1 + PARTY_XP_BONUS * (recipients.length - 1)) / recipients.length;
    for (const sessionId of recipients) {
      const player = game.state.players.get(sessionId)!;
      const xpBonus = 1 + (game.playerRuntime.get(sessionId)?.stats.xpBonus ?? 0);
      grantXp(game, sessionId, player, Math.floor(xpForKill(runtime.def.xp * runtime.power, mob.level, player.level) * share * xpBonus));
      questKill(game, sessionId, runtime.def.id);
    }
  }

  for (const playerRuntime of game.playerRuntime.values()) {
    if (playerRuntime.targetId === mobId) {
      playerRuntime.targetId = null;
      playerRuntime.attacking = false;
    }
  }
  dropLoot(game, mob.x, mob.y, runtime.def, runtime.taggedBy, runtime.power);
  game.state.mobs.delete(mobId);
  game.mobRuntime.delete(mobId);
  if (runtime.boss) bossDefeated(game, runtime);
  const zone = runtime.zone;
  if (zone) game.after(runtime.def.respawnMs, () => spawnMob(game, zone));
}

function killPlayer(game: Game, sessionId: string, player: Player, runtime: PlayerRuntime) {
  loseDuel(game, sessionId, "died");
  cancelCast(game, sessionId);
  dismissMinions(game, sessionId);
  player.dead = true;
  player.moving = false;
  player.shield = 0;
  player.rooted = false;
  player.guarded = false;
  runtime.guardUntil = 0;
  player.stunned = false;
  player.buffed = false;
  runtime.stunnedUntil = 0;
  runtime.buffs = [];
  if (usesRage(player)) player.resource = 0;
  runtime.targetId = null;
  runtime.attacking = false;
  runtime.inputQueue.length = 0;
  forgetPlayer(game, sessionId);
}

export function grantXp(game: Game, sessionId: string, player: Player, amount: number) {
  if (amount <= 0 || player.level >= MAX_LEVEL) return;
  player.xp += amount;
  game.io.send(sessionId, Msg.XpGained, { amount } satisfies XpGainedEvent);

  while (player.level < MAX_LEVEL && player.xp >= xpToNextLevel(player.level)) {
    player.xp -= xpToNextLevel(player.level);
    player.level++;
    refreshStats(game, sessionId);
    player.hp = player.maxHp;
    game.io.broadcast(Msg.LevelUp, { sessionId, level: player.level } satisfies LevelUpEvent);
    // A new skill point (and maybe a skill or passive that just became learnable).
    sendSkillRanks(game, sessionId);
  }
  if (player.level >= MAX_LEVEL) player.xp = 0;
}

function mobDefense(game: Game, mobId: string) {
  const runtime = game.mobRuntime.get(mobId);
  return runtime ? runtime.def.defense * runtime.power : 0;
}

/** Announces a player's swing or spell; standing players turn to face their target. */
function broadcastAttack(game: Game, player: Player, event: AttackEvent, target?: { x: number; y: number }) {
  if (target && !player.moving) player.dir = directionToward(target.x - player.x, target.y - player.y, player.dir);
  game.io.broadcast(Msg.Attack, event);
}

export function broadcastCombat(game: Game, event: CombatEvent) {
  game.io.broadcast(Msg.Combat, event);
}

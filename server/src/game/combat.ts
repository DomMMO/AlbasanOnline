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
  SKILLS,
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
import type { Game, MobRuntime, PlayerRuntime } from "./Game";
import { bossDamaged, bossDefeated } from "./boss";
import { dropLoot, refreshStats } from "./items";
import { questKill } from "./quests";
import { addThreat, spawnMob } from "./mobs";
import { sameParty } from "./party";
import { recordPvpKill } from "./pvp";

// All damage, healing, XP and death go through this file. The client never
// decides any of it; it only asks ("use skill X") and displays the results.

const REGEN_INTERVAL_MS = 1000;
/** Extra range allowed when a cast finishes (the target may have stepped back a little). */
const CAST_RANGE_TOLERANCE = 16;

const usesRage = (player: Player) => classOf(player.cls).resource === "rage";

function fail(game: Game, sessionId: string, message: string) {
  game.io.send(sessionId, Msg.SkillError, { message } satisfies SkillErrorEvent);
}

type Enemy = { kind: "mob"; id: string; entity: Mob } | { kind: "player"; id: string; entity: Player };

/** Party members are never enemies, even in PvP zones. */
function partyMates(game: Game, a: string, b: string): boolean {
  const ra = game.playerRuntime.get(a);
  const rb = game.playerRuntime.get(b);
  return !!ra && !!rb && sameParty(ra.characterId, rb.characterId);
}

/** A hostile target: any mob, or (in PvP zones) another living player outside your party. */
function enemyAt(game: Game, sessionId: string, targetId: string | null): Enemy | undefined {
  if (!targetId) return undefined;
  const mob = game.state.mobs.get(targetId);
  if (mob) return { kind: "mob", id: targetId, entity: mob };
  const hostile = game.zone.pvp && targetId !== sessionId && !partyMates(game, sessionId, targetId);
  const player = hostile ? game.state.players.get(targetId) : undefined;
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

/** Damage from a player to an enemy (mob or, in PvP, another player). */
function hitEnemy(game: Game, sessionId: string, enemy: Enemy, attackValue: number) {
  if (enemy.kind === "mob") {
    const hit = rollDamage(attackValue, mobDefense(game, enemy.id), game.random);
    damageMob(game, sessionId, enemy.id, enemy.entity, hit.amount, hit.crit);
    return;
  }
  const victimRuntime = game.playerRuntime.get(enemy.id);
  if (!victimRuntime || enemy.entity.protected) return;
  const hit = rollDamage(attackValue * PVP_DAMAGE_MULTIPLIER, victimRuntime.stats.defense, game.random);
  hitPlayer(game, sessionId, enemy.id, enemy.entity, hit.amount, hit.crit);
}

/** Every enemy within `radius` of the caster. */
function enemiesAround(game: Game, sessionId: string, center: Player, radius: number): Enemy[] {
  const enemies: Enemy[] = [];
  game.state.mobs.forEach((mob, id) => {
    if (distance(center, mob) <= radius) enemies.push({ kind: "mob", id, entity: mob });
  });
  if (game.zone.pvp) {
    game.state.players.forEach((player, id) => {
      if (id !== sessionId && !player.dead && !partyMates(game, sessionId, id) && distance(center, player) <= radius) {
        enemies.push({ kind: "player", id, entity: player });
      }
    });
  }
  return enemies;
}

export function setTarget(game: Game, sessionId: string, targetId: string | null, attack: boolean) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime || player.dead) return;
  const isMob = targetId !== null && game.state.mobs.has(targetId);
  // Other players: friendly targets (heals, shields), or enemies in PvP zones.
  const isPlayer = targetId !== null && targetId !== sessionId && game.state.players.has(targetId);
  runtime.targetId = isMob || isPlayer ? targetId : null;
  runtime.attacking = attack && (isMob || (isPlayer && !!game.zone.pvp && !partyMates(game, sessionId, targetId!)));
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
    // PvP: only party members are friendly.
    if (game.zone.pvp && runtime.targetId && !partyMates(game, sessionId, runtime.targetId)) return { targetId: sessionId };
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
  // Spamming a key during the GCD is normal; ignore it silently.
  if (skill.triggersGcd && now < runtime.gcdUntil) return;
  if (runtime.casting) return fail(game, sessionId, "Zaten büyü yapıyorsun");
  if (now < (runtime.cooldowns.get(skill.id) ?? 0)) return fail(game, sessionId, "Henüz hazır değil");
  const resolved = resolveTarget(game, sessionId, player, runtime, skill);
  if (typeof resolved === "string") return fail(game, sessionId, resolved);
  if (player.resource < skill.cost) return fail(game, sessionId, usesRage(player) ? "Yeterli öfke yok" : "Yeterli mana yok");

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

/** Applies a skill's effect, pays its cost and starts its cooldown. */
function performSkill(game: Game, sessionId: string, player: Player, runtime: PlayerRuntime, skill: SkillDef, targetId: string | null) {
  const now = game.now();
  const effect = skill.effect;
  const attack = runtime.stats.attack;
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
      hitEnemy(game, sessionId, enemy, attack * effect.multiplier + effect.bonus);
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
      const amount = Math.min(Math.round(player.maxHp * effect.percent), player.maxHp - player.hp);
      player.hp += amount;
      broadcastAttack(game, player, { ...self, targetId: sessionId, targetKind: "player" });
      broadcastCombat(game, { sourceId: sessionId, targetId: sessionId, targetKind: "player", amount, crit: false, heal: true });
      break;
    }
    case "healTarget": {
      const friend = targetId ? game.state.players.get(targetId) : undefined;
      if (!friend || friend.dead || !targetId) return fail(game, sessionId, "Hedef yok");
      const amount = Math.min(Math.round(attack * effect.multiplier + effect.bonus), friend.maxHp - friend.hp);
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
      friend.shield = Math.round(attack * effect.multiplier + effect.bonus);
      friendRuntime.shieldUntil = now + effect.durationMs;
      broadcastAttack(game, player, { ...self, targetId, targetKind: "player" }, targetId === sessionId ? undefined : friend);
      break;
    }
  }

  player.resource = Math.max(0, player.resource - skill.cost);
  if (skill.cooldownMs > 0) runtime.cooldowns.set(skill.id, now + skill.cooldownMs);
  game.io.send(sessionId, Msg.SkillUsed, {
    skillId: skill.id,
    cooldownMs: skill.cooldownMs,
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
  if (player.resource < skill.cost) return cancelCast(game, sessionId, "Yeterli mana yok");

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
    if (player.rooted && now >= runtime.rootedUntil) player.rooted = false;
    if (player.protected && now >= runtime.protectedUntil) player.protected = false;

    if (now >= runtime.nextRegenAt) {
      runtime.nextRegenAt = now + REGEN_INTERVAL_MS;
      const inCombat = now - runtime.lastCombatAt < COMBAT_TIMEOUT_MS;
      if (!inCombat) player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * REGEN_PER_SECOND));
      if (usesRage(player)) {
        if (!inCombat) player.resource = Math.max(0, player.resource - RAGE_DECAY_PER_SECOND);
      } else {
        const rate = inCombat ? MANA_REGEN_IN_COMBAT : MANA_REGEN_OUT_OF_COMBAT;
        player.resource = Math.min(player.maxResource, player.resource + Math.ceil(player.maxResource * rate));
      }
    }
  });
}

function autoAttack(game: Game, sessionId: string, player: Player, runtime: PlayerRuntime, enemy: Enemy) {
  const auto = classOf(player.cls).autoAttack;
  if (distance(player, enemy.entity) > auto.range) return;
  if (auto.ranged && !hasLineOfSight(game.map, player, enemy.entity)) return;
  runtime.nextSwingAt = game.now() + runtime.stats.attackSpeedMs;
  runtime.lastCombatAt = game.now();
  dropProtection(game, sessionId);
  if (usesRage(player)) player.resource = Math.min(RAGE_MAX, player.resource + RAGE_PER_SWING);
  broadcastAttack(game, player, { sourceId: sessionId, sourceKind: "player", targetId: enemy.id, targetKind: enemy.kind }, enemy.entity);
  hitEnemy(game, sessionId, enemy, runtime.stats.attack * auto.multiplier);
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
  const hit = rollDamage(mobRuntime.def.attack, runtime.stats.defense, game.random);
  game.io.broadcast(Msg.Attack, { sourceId: mobId, sourceKind: "mob", targetId: sessionId, targetKind: "player" } satisfies AttackEvent);
  hitPlayer(game, mobId, sessionId, player, hit.amount, hit.crit);
}

/** Applies damage from a mob to a player (melee or boss ability). Shields absorb first. */
export function hitPlayer(game: Game, sourceId: string, sessionId: string, player: Player, amount: number, crit: boolean) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime || player.dead) return;
  runtime.lastCombatAt = game.now();
  if (usesRage(player)) player.resource = Math.min(RAGE_MAX, player.resource + RAGE_PER_HIT_TAKEN);
  const absorbed = Math.min(player.shield, amount);
  player.shield -= absorbed;
  const taken = amount - absorbed;
  player.hp = Math.max(0, player.hp - taken);
  broadcastCombat(game, { sourceId, targetId: sessionId, targetKind: "player", amount: taken, crit, heal: false });
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
  addThreat(game, runtime, sessionId, dealt * (attacker && usesRage(attacker) ? WARRIOR_THREAT_MULTIPLIER : 1));
  broadcastCombat(game, { sourceId: sessionId, targetId: mobId, targetKind: "mob", amount, crit, heal: false });

  if (runtime.boss) bossDamaged(game, mob, runtime);
  if (mob.hp === 0) killMob(game, mobId, mob, runtime);
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

function killMob(game: Game, mobId: string, mob: Mob, runtime: MobRuntime) {
  if (runtime.taggedBy) {
    // Split between nearby party members, with a bonus for grouping.
    const recipients = xpRecipients(game, runtime.taggedBy, mob);
    const share = (1 + PARTY_XP_BONUS * (recipients.length - 1)) / recipients.length;
    for (const sessionId of recipients) {
      const player = game.state.players.get(sessionId)!;
      grantXp(game, sessionId, player, Math.floor(xpForKill(runtime.def.xp, mob.level, player.level) * share));
      questKill(game, sessionId, runtime.def.id);
    }
  }

  for (const playerRuntime of game.playerRuntime.values()) {
    if (playerRuntime.targetId === mobId) {
      playerRuntime.targetId = null;
      playerRuntime.attacking = false;
    }
  }
  dropLoot(game, mob.x, mob.y, runtime.def, runtime.taggedBy);
  game.state.mobs.delete(mobId);
  game.mobRuntime.delete(mobId);
  if (runtime.boss) bossDefeated(game, runtime);
  const zone = runtime.zone;
  if (zone) game.after(runtime.def.respawnMs, () => spawnMob(game, zone));
}

function killPlayer(game: Game, sessionId: string, player: Player, runtime: PlayerRuntime) {
  cancelCast(game, sessionId);
  player.dead = true;
  player.moving = false;
  player.shield = 0;
  player.rooted = false;
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
  }
  if (player.level >= MAX_LEVEL) player.xp = 0;
}

function mobDefense(game: Game, mobId: string) {
  return game.mobRuntime.get(mobId)?.def.defense ?? 0;
}

/** Announces a player's swing or spell; standing players turn to face their target. */
function broadcastAttack(game: Game, player: Player, event: AttackEvent, target?: { x: number; y: number }) {
  if (target && !player.moving) player.dir = directionToward(target.x - player.x, target.y - player.y, player.dir);
  game.io.broadcast(Msg.Attack, event);
}

export function broadcastCombat(game: Game, event: CombatEvent) {
  game.io.broadcast(Msg.Combat, event);
}

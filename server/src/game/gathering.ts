import {
  collides,
  distance,
  GATHER_MS,
  GATHER_RANGE,
  ITEMS,
  LIFE_SKILL_IDS,
  LIFE_SKILLS,
  lifeXpToNext,
  MAX_LIFE_SKILL,
  Msg,
  newLifeSkills,
  NODE_SPAWNS,
  NODES,
  TILE_SIZE,
  type GatherEndEvent,
  type GatherStartEvent,
  type LifeSkills,
  type LifeSkillsEvent,
  type NodeSpawn,
} from "../../../shared/src";
import { GatherNode } from "../rooms/schema/WorldState";
import type { Game } from "./Game";
import { addItem, countOf, hasSpaceFor } from "./inventory";
import { notice, sendInventory } from "./items";

// Life skills (see shared/src/data/gathering.ts). Veins and herbs are entities in the zone's
// state; gathering one is a channel that moving or taking damage breaks. The first player to
// finish takes the node; it grows back in the same spot a while later.

const GOLD = "#ffd34d";
const SKILL_COLOR = "#8ce99a";

export function sanitizeLifeSkills(value: unknown): LifeSkills {
  const skills = newLifeSkills();
  const stored = value && typeof value === "object" ? (value as Record<string, { level?: unknown; xp?: unknown }>) : {};
  for (const id of LIFE_SKILL_IDS) {
    const level = Math.floor(Number(stored[id]?.level));
    const xp = Math.floor(Number(stored[id]?.xp));
    if (level >= 1) skills[id] = { level: Math.min(level, MAX_LIFE_SKILL), xp: Math.max(0, xp || 0) };
  }
  return skills;
}

export function sendLifeSkills(game: Game, sessionId: string) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime) return;
  const skills: LifeSkillsEvent["skills"] = {};
  for (const id of LIFE_SKILL_IDS) {
    const { level, xp } = runtime.lifeSkills[id];
    skills[id] = { level, xp, next: level >= MAX_LIFE_SKILL ? 0 : lifeXpToNext(level) };
  }
  game.io.send(sessionId, Msg.LifeSkills, { skills } satisfies LifeSkillsEvent);
}

/** A random walkable spot in the spawn area, not on top of another node. */
function spotIn(game: Game, spawn: NodeSpawn): { x: number; y: number } | null {
  const cx = (spawn.tx + 0.5) * TILE_SIZE;
  const cy = (spawn.ty + 0.5) * TILE_SIZE;
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = game.random() * Math.PI * 2;
    const r = Math.sqrt(game.random()) * spawn.radius * TILE_SIZE;
    const point = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    if (collides(game.map, point.x, point.y)) continue;
    let crowded = false;
    game.state.nodes.forEach((n) => {
      if (distance(n, point) < TILE_SIZE * 1.5) crowded = true;
    });
    if (!crowded) return point;
  }
  return null;
}

function placeNode(game: Game, kind: string, at: { x: number; y: number }) {
  const node = new GatherNode();
  node.kind = kind;
  node.x = at.x;
  node.y = at.y;
  game.state.nodes.set(game.newId("g"), node);
}

export function spawnGatherNodes(game: Game) {
  for (const spawn of NODE_SPAWNS[game.zone.id] ?? []) {
    for (let i = 0; i < spawn.count; i++) {
      const at = spotIn(game, spawn);
      if (at) placeNode(game, spawn.node, at);
    }
  }
}

export function cancelGather(game: Game, sessionId: string, message?: string) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime?.gathering) return;
  runtime.gathering = null;
  game.io.send(sessionId, Msg.GatherEnd, { interrupted: true } satisfies GatherEndEvent);
  if (message) notice(game, sessionId, message);
}

export function startGather(game: Game, sessionId: string, nodeId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const node = game.state.nodes.get(nodeId);
  const def = node ? NODES[node.kind] : undefined;
  if (!player || !runtime || !node || !def || player.dead) return;
  if (runtime.gathering || runtime.casting) return notice(game, sessionId, "Zaten meşgulsün");
  if (game.now() < runtime.stunnedUntil) return;
  if (distance(player, node) > GATHER_RANGE) return notice(game, sessionId, "Çok uzak");
  const skill = LIFE_SKILLS[def.skill];
  if (countOf(runtime.inventory, skill.tool) === 0) {
    return notice(game, sessionId, `${ITEMS[skill.tool].name} gerekli (Zanaatkâr Murat'tan alınır)`);
  }
  if (runtime.lifeSkills[def.skill].level < def.level) return notice(game, sessionId, `${skill.name} ${def.level} gerekli`);
  if (def.nightOnly && !game.night) return notice(game, sessionId, `${def.name} sadece gece açar`);
  if (!hasSpaceFor(runtime.inventory, def.item, def.qty[1])) return notice(game, sessionId, "Envanter dolu");
  runtime.gathering = { nodeId, endsAt: game.now() + GATHER_MS };
  game.io.send(sessionId, Msg.GatherStart, { name: def.name, skill: def.skill, ms: GATHER_MS } satisfies GatherStartEvent);
}

export function updateGathering(game: Game) {
  const now = game.now();
  for (const [sessionId, runtime] of game.playerRuntime) {
    const gathering = runtime.gathering;
    if (!gathering || now < gathering.endsAt) continue;
    runtime.gathering = null;
    const node = game.state.nodes.get(gathering.nodeId);
    const def = node ? NODES[node.kind] : undefined;
    if (!node || !def) {
      game.io.send(sessionId, Msg.GatherEnd, { interrupted: true } satisfies GatherEndEvent);
      notice(game, sessionId, "Başkası senden önce topladı");
      continue;
    }
    // Take the node; it grows back in the same place.
    const at = { x: node.x, y: node.y };
    game.state.nodes.delete(gathering.nodeId);
    game.after(def.respawnMs, () => placeNode(game, def.id, at));

    // Higher skill sometimes gives one more.
    const progress = runtime.lifeSkills[def.skill];
    const bonus = game.random() < Math.min(0.5, (progress.level - def.level) * 0.03) ? 1 : 0;
    const qty = def.qty[0] + Math.floor(game.random() * (def.qty[1] - def.qty[0] + 1)) + bonus;
    const left = addItem(runtime.inventory, def.item, qty);
    notice(game, sessionId, `${ITEMS[def.item].name} x${qty - left}`, GOLD);
    gainLifeXp(game, sessionId, def.skill, def.xp);
    game.io.send(sessionId, Msg.GatherEnd, { interrupted: false } satisfies GatherEndEvent);
    sendInventory(game, sessionId);
  }
}

function gainLifeXp(game: Game, sessionId: string, skillId: keyof LifeSkills, amount: number) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime) return;
  const progress = runtime.lifeSkills[skillId];
  if (progress.level >= MAX_LIFE_SKILL) return;
  progress.xp += amount;
  while (progress.level < MAX_LIFE_SKILL && progress.xp >= lifeXpToNext(progress.level)) {
    progress.xp -= lifeXpToNext(progress.level);
    progress.level++;
    notice(game, sessionId, `${LIFE_SKILLS[skillId].name} seviyesi ${progress.level}!`, SKILL_COLOR);
  }
  if (progress.level >= MAX_LIFE_SKILL) progress.xp = 0;
  sendLifeSkills(game, sessionId);
}

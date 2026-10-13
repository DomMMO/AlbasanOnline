import {
  classOf,
  classQuestItems,
  distance,
  ITEMS,
  MAX_ACTIVE_QUESTS,
  MAX_GOLD,
  Msg,
  NPC_RANGE,
  NPCS,
  QUESTS,
  questAvailable,
  questReady,
  type ChatEvent,
  type QuestDef,
  type QuestLogEvent,
  type QuestProgress,
} from "../../../shared/src";
import { grantXp } from "./combat";
import type { Game } from "./Game";
import { addItem, countOf, takeItems, type InventoryData } from "./inventory";
import { notice, sendInventory } from "./items";

// Quests on the server: accepting, counting kills, turning in for rewards. Every step
// is checked here (level, previous quest, distance to the NPC, items, free space).
// The definitions and the story live in shared/src/data/quests.ts.

const QUEST_COLOR = "#ffd34d";
const PROGRESS_COLOR = "#e8d48a";

export function sendQuestLog(game: Game, sessionId: string) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime) return;
  game.io.send(sessionId, Msg.QuestLog, { quests: [...runtime.quests.values()] } satisfies QuestLogEvent);
}

function questLine(game: Game, sessionId: string, text: string) {
  game.io.send(sessionId, Msg.ChatMessage, { channel: "system", text } satisfies ChatEvent);
}

/** The NPC must be in this zone and within talking range. */
function nearNpc(game: Game, sessionId: string, npcId: unknown): boolean {
  const player = game.state.players.get(sessionId);
  if (typeof npcId !== "string" || !player || !game.zone.npcs.includes(npcId)) return false;
  const npc = NPCS[npcId];
  if (!npc || distance(player, npc) > NPC_RANGE + 8) {
    notice(game, sessionId, "Çok uzak");
    return false;
  }
  return true;
}

export function acceptQuest(game: Game, sessionId: string, questId: string, npcId: unknown) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const quest = QUESTS[questId];
  if (!player || !runtime || !quest || player.dead) return;
  if (quest.giver !== npcId || !nearNpc(game, sessionId, npcId)) return;
  if (!questAvailable(quest, player.level, runtime.quests)) return notice(game, sessionId, "Bu görevi şu an alamazsın");
  const active = [...runtime.quests.values()].filter((q) => q.status === "active").length;
  if (active >= MAX_ACTIVE_QUESTS) return notice(game, sessionId, `En fazla ${MAX_ACTIVE_QUESTS} görev alabilirsin`);

  runtime.quests.set(quest.id, { id: quest.id, status: "active", kills: quest.objectives.map(() => 0) });
  notice(game, sessionId, `Yeni görev: ${quest.title}`, QUEST_COLOR);
  sendQuestLog(game, sessionId);
}

export function abandonQuest(game: Game, sessionId: string, questId: string) {
  const runtime = game.playerRuntime.get(sessionId);
  const entry = runtime?.quests.get(questId);
  if (!runtime || entry?.status !== "active") return;
  // A repeatable quest done before stays "done" so it doesn't block the chain.
  runtime.quests.delete(questId);
  notice(game, sessionId, `Görev bırakıldı: ${QUESTS[questId]?.title ?? questId}`, QUEST_COLOR);
  sendQuestLog(game, sessionId);
}

/** Reward items for this player's class. */
function rewardItems(quest: QuestDef, cls: string) {
  return [...(quest.reward.items ?? []), ...classQuestItems(quest, cls)].filter((r) => ITEMS[r.item]);
}

/** Would the rewards fit after the collected items are taken? Tried on a copy of the inventory. */
function rewardsFit(inv: InventoryData, quest: QuestDef, cls: string): boolean {
  const copy: InventoryData = { ...inv, slots: inv.slots.map((s) => (s ? { ...s } : null)) };
  for (const objective of quest.objectives) if (objective.type === "collect") takeItems(copy, objective.item, objective.count);
  return rewardItems(quest, cls).every((reward) => addItem(copy, reward.item, reward.qty ?? 1) === 0);
}

/** Asked the NPC a "talk" objective sends you to: that objective is done. */
export function talkForQuest(game: Game, sessionId: string, questId: string, npcId: unknown) {
  const runtime = game.playerRuntime.get(sessionId);
  const quest = QUESTS[questId];
  const entry = runtime?.quests.get(questId);
  if (!runtime || !quest || entry?.status !== "active" || !nearNpc(game, sessionId, npcId)) return;
  let changed = false;
  quest.objectives.forEach((objective, i) => {
    if (objective.type !== "talk" || objective.npc !== npcId || (entry.kills[i] ?? 0) >= 1) return;
    entry.kills[i] = 1;
    changed = true;
  });
  if (!changed) return;
  if (questReady(quest, entry, (defId) => countOf(runtime.inventory, defId))) {
    notice(game, sessionId, `${quest.title} hazır: ${NPCS[quest.turnIn]?.name ?? ""} ile konuş`, QUEST_COLOR);
  }
  sendQuestLog(game, sessionId);
}

export function turnInQuest(game: Game, sessionId: string, questId: string, npcId: unknown, answer?: unknown) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const quest = QUESTS[questId];
  const entry = runtime?.quests.get(questId);
  if (!player || !runtime || !quest || entry?.status !== "active" || player.dead) return;
  if (quest.turnIn !== npcId || !nearNpc(game, sessionId, npcId)) return;
  const inv = runtime.inventory;
  if (!questReady(quest, entry, (defId) => countOf(inv, defId), player.cls)) return notice(game, sessionId, "Görev henüz tamamlanmadı");
  if (!rewardsFit(inv, quest, player.cls)) return notice(game, sessionId, "Ödüller için envanterinde yer aç");
  // A quiz answered wrong: the NPC sends you back to ask again.
  if (quest.quiz && answer !== quest.quiz.correct) {
    quest.objectives.forEach((objective, i) => {
      if (objective.type === "talk") entry.kills[i] = 0;
    });
    questLine(game, sessionId, `${NPCS[quest.turnIn]?.name}: ${quest.quiz.wrongText}`);
    notice(game, sessionId, "Yanlış cevap: git bir daha sor");
    sendQuestLog(game, sessionId);
    return;
  }

  for (const objective of quest.objectives) if (objective.type === "collect") takeItems(inv, objective.item, objective.count);
  const items = rewardItems(quest, player.cls);
  for (const reward of items) addItem(inv, reward.item, reward.qty ?? 1);
  inv.gold = Math.min(MAX_GOLD, inv.gold + quest.reward.gold);
  runtime.quests.set(quest.id, { id: quest.id, status: "done", kills: [] });

  notice(game, sessionId, `Görev tamamlandı: ${quest.title}`, QUEST_COLOR);
  const parts = [
    quest.reward.xp ? `${quest.reward.xp} XP` : "",
    quest.reward.gold ? `${quest.reward.gold} altın` : "",
    ...items.map((r) => `${ITEMS[r.item].name}${(r.qty ?? 1) > 1 ? ` x${r.qty}` : ""}`),
  ].filter(Boolean);
  questLine(game, sessionId, `Görev tamamlandı: ${quest.title}. Ödül: ${parts.join(", ")}`);
  grantXp(game, sessionId, player, quest.reward.xp);
  sendInventory(game, sessionId);
  sendQuestLog(game, sessionId);
  game.io.persist([sessionId]);
}

/** A mob died and this player gets credit for it (killer or nearby party member). */
export function questKill(game: Game, sessionId: string, mobKind: string) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime) return;
  let changed = false;
  for (const entry of runtime.quests.values()) {
    const quest = QUESTS[entry.id];
    if (entry.status !== "active" || !quest) continue;
    quest.objectives.forEach((objective, i) => {
      if (objective.type !== "kill" || !objective.mobs.includes(mobKind)) return;
      const before = entry.kills[i] ?? 0;
      if (before >= objective.count) return;
      entry.kills[i] = before + 1;
      changed = true;
      notice(game, sessionId, `${objective.label}: ${entry.kills[i]}/${objective.count}`, PROGRESS_COLOR);
    });
    if (changed && questReady(quest, entry, (defId) => countOf(runtime.inventory, defId))) {
      notice(game, sessionId, `${quest.title} hazır: ${NPCS[quest.turnIn]?.name ?? ""} ile konuş`, QUEST_COLOR);
    }
  }
  if (changed) sendQuestLog(game, sessionId);
}

/** Quest log from the database rows, dropping quests that no longer exist. */
export function questsFromStored(rows: QuestProgress[]): Map<string, QuestProgress> {
  const log = new Map<string, QuestProgress>();
  for (const row of rows) {
    const quest = QUESTS[row.id];
    if (!quest) continue;
    const kills = row.status === "active" ? quest.objectives.map((_, i) => Number(row.kills?.[i] ?? 0)) : [];
    log.set(row.id, { id: row.id, status: row.status, kills });
  }
  return log;
}

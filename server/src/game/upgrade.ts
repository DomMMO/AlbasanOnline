import {
  ANNOUNCE_UPGRADE_LEVEL,
  distance,
  isUpgradeable,
  ITEMS,
  MAX_ENHANCE,
  Msg,
  NPC_RANGE,
  NPCS,
  PROTECTION_ITEM,
  SAFE_UPGRADE_LEVEL,
  scrollForLevel,
  UPGRADE_SUCCESS_CHANCE,
  upgradeGoldCost,
  type NoticeEvent,
  type UpgradeOutcome,
  type UpgradeResultEvent,
} from "../../../shared/src";
import type { Game } from "./Game";
import { broadcastSystem } from "./chat";
import { indexOfItem, removeAt } from "./inventory";
import { notice, sendInventory } from "./items";
import { fortuneBonus } from "./fortune";

// +N upgrading at the blacksmith. One attempt consumes a scroll, gold and (optionally)
// a protection charm up front, then rolls once on the server.

export function upgradeItem(game: Game, sessionId: string, npcId: string, uid: string, protect: boolean) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const npc = NPCS[npcId];
  if (!player || !runtime || !npc || npc.role !== "blacksmith" || !game.zone.npcs.includes(npcId) || player.dead) return;
  if (distance(player, npc) > NPC_RANGE) return notice(game, sessionId, "Demirciden çok uzaktasın");

  const inv = runtime.inventory;
  const index = inv.slots.findIndex((stack) => stack?.uid === uid);
  const stack = inv.slots[index];
  if (!stack) return notice(game, sessionId, "Item envanterinde olmalı");
  const def = ITEMS[stack.defId];
  if (!isUpgradeable(def)) return notice(game, sessionId, "Bu item yükseltilemez");
  if (stack.enhance >= MAX_ENHANCE) return notice(game, sessionId, `Item zaten +${MAX_ENHANCE}`);

  const target = stack.enhance + 1;
  const scrollId = scrollForLevel(target);
  const scrollIndex = indexOfItem(inv, scrollId);
  if (scrollIndex === -1) return notice(game, sessionId, `${ITEMS[scrollId].name} gerekli`);
  const cost = upgradeGoldCost(target);
  if (inv.gold < cost) return notice(game, sessionId, "Yeterli altının yok");
  // A charm is only spent when the attempt could actually burn the item.
  const useCharm = protect && target > SAFE_UPGRADE_LEVEL;
  const charmIndex = useCharm ? indexOfItem(inv, PROTECTION_ITEM) : -1;
  if (useCharm && charmIndex === -1) return notice(game, sessionId, "Koruma Tılsımın yok");

  // Pay first: the cost is spent whatever the outcome.
  removeAt(inv, scrollIndex, 1);
  if (useCharm) removeAt(inv, charmIndex, 1);
  inv.gold -= cost;

  let outcome: UpgradeOutcome;
  // A good fortune from Ayşe Teyze makes today's attempts likelier.
  if (game.random() < Math.min(1, UPGRADE_SUCCESS_CHANCE[target] + fortuneBonus(runtime))) {
    stack.enhance = target;
    outcome = "success";
  } else if (target <= SAFE_UPGRADE_LEVEL) {
    outcome = "failed";
  } else if (useCharm) {
    outcome = "protected";
  } else {
    inv.slots[index] = null;
    outcome = "burned";
  }

  console.log(`[upgrade] ${player.name}: ${def.name} +${target} -> ${outcome}`);
  game.io.send(sessionId, Msg.UpgradeResult, { outcome, defId: def.id, enhance: stack.enhance } satisfies UpgradeResultEvent);
  if (outcome === "success" && target >= ANNOUNCE_UPGRADE_LEVEL) {
    const message = `${player.name}, ${def.name} item'ını +${target} yaptı!`;
    game.io.broadcast(Msg.Notice, { message, color: "#ffd34d" } satisfies NoticeEvent);
    broadcastSystem(message);
  }
  sendInventory(game, sessionId);
}

import {
  CLASSES,
  classOf,
  classResetPrice,
  defaultRanks,
  distance,
  isSpecId,
  ITEMS,
  Msg,
  NPC_RANGE,
  NPCS,
  type ChatEvent,
  type ClassId,
  type EquipSlot,
  type NpcDef,
  type SkillRanks,
} from "../../../shared/src";
import type { Game } from "./Game";
import { notice, refreshStats, sendInventory } from "./items";
import { sendQuestLog } from "./quests";
import { sendSkillRanks } from "./talents";

// Choosing a class: every character starts as a novice and picks one of the masters in the
// keep's great hall. Ayşe Teyze undoes the choice for gold, making them a novice again
// (gear only the old class may wear comes off into the bags). Classes with specs (Savaşçı,
// Druid) also choose damage or tank there; a character of that class without one yet picks it
// once for free, after that only a reset changes it.

const PATH_COLOR = "#ffd34d";

/** The NPC, if it is in this zone, within talking range and passes `check`. */
function npcNearby(game: Game, sessionId: string, npcId: unknown, check: (npc: NpcDef) => boolean): NpcDef | null {
  const player = game.state.players.get(sessionId);
  const npc = typeof npcId === "string" ? NPCS[npcId] : undefined;
  if (!player || !npc || !game.zone.npcs.includes(npc.id) || !check(npc)) return null;
  if (distance(player, npc) > NPC_RANGE + 8) {
    notice(game, sessionId, "Çok uzak");
    return null;
  }
  return npc;
}

function setClass(game: Game, sessionId: string, cls: ClassId, ranks: SkillRanks, spec = "") {
  const player = game.state.players.get(sessionId)!;
  const runtime = game.playerRuntime.get(sessionId)!;
  player.cls = cls;
  player.spec = spec;
  runtime.skillRanks = ranks;
  refreshStats(game, sessionId);
  player.resource = CLASSES[cls].resource === "rage" ? 0 : player.maxResource;
  sendSkillRanks(game, sessionId);
  sendInventory(game, sessionId);
  // "Ustaların Ateşi" checks the class.
  sendQuestLog(game, sessionId);
  game.io.persist([sessionId]);
}

function say(game: Game, sessionId: string, text: string) {
  game.io.send(sessionId, Msg.ChatMessage, { channel: "system", text } satisfies ChatEvent);
}

export function chooseClass(game: Game, sessionId: string, npcId: unknown, spec: unknown) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime || player.dead) return;
  const master = npcNearby(game, sessionId, npcId, (npc) => npc.role === "master" && !!npc.teaches);
  if (!master) return;
  const cls = master.teaches!;
  const specs = CLASSES[cls].specs;
  if (specs && !isSpecId(spec)) return;
  const chosen = specs && isSpecId(spec) ? spec : "";
  if (player.cls === cls && specs && !player.spec) {
    setClass(game, sessionId, cls, runtime.skillRanks, chosen);
    notice(game, sessionId, `Yolun belli oldu: ${specs[chosen as "damage" | "tank"].name}`, PATH_COLOR);
    return;
  }
  if (player.cls !== "novice") return notice(game, sessionId, "Zaten bir yolun var. Değiştirmek istersen Ayşe Teyze'ye git.");
  setClass(game, sessionId, cls, defaultRanks(cls, player.level), chosen);
  notice(game, sessionId, `Yolun belli oldu: ${CLASSES[cls].name}${specs ? ` (${specs[chosen as "damage" | "tank"].name})` : ""}`, PATH_COLOR);
  say(game, sessionId, `${master.name} seni öğrencisi olarak kabul etti. Yeteneklerin K'da, Komutan Baran seni bekliyor.`);
}

export function resetClass(game: Game, sessionId: string, npcId: unknown) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime || player.dead) return;
  const teller = npcNearby(game, sessionId, npcId, (npc) => !!npc.fortuneTeller);
  if (!teller) return;
  if (player.cls === "novice") return notice(game, sessionId, "Sıfırlanacak bir yolun yok; kaledeki ustalara git.");
  const price = classResetPrice(player.level);
  const inv = runtime.inventory;
  if (inv.gold < price) return notice(game, sessionId, `${price} altın gerekli`);

  // Whatever only the old class may wear comes off into the bags; there must be room.
  const off = (Object.keys(inv.equipment) as EquipSlot[]).filter((slot) => {
    const def = ITEMS[inv.equipment[slot]!.defId];
    return def?.classes && !def.classes.includes("novice");
  });
  const free = inv.slots.filter((s) => s === null).length;
  if (free < off.length) return notice(game, sessionId, `Çıkarılacak eşyalar için envanterinde ${off.length} boş yer aç`);
  for (const slot of off) {
    inv.slots[inv.slots.indexOf(null)] = inv.equipment[slot]!;
    delete inv.equipment[slot];
  }
  inv.gold -= price;
  const old = classOf(player.cls).name;
  setClass(game, sessionId, "novice", {});
  notice(game, sessionId, "Yolun sıfırlandı: yeniden Acemisin", PATH_COLOR);
  say(game, sessionId, `${teller.name} fincanı ters çevirdi: ${old} yolu kapandı (${price} altın). Kaledeki ustalardan yeni birini seçebilirsin.`);
}

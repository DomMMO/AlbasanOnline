import {
  BARBER_PRICE,
  distance,
  HAIR_COLORS,
  HAIR_STYLE_NAMES,
  HAIR_STYLES,
  Msg,
  NPC_RANGE,
  NPCS,
  type ChatEvent,
  type HairStyle,
} from "../../../shared/src";
import type { Game } from "./Game";
import { notice, sendInventory } from "./items";

// Berber Cemil: a new hair style and colour for BARBER_PRICE gold. The look lives on the synced
// Player fields (everyone sees it at once) and is saved with the character (characters.look).

const BARBER_COLOR = "#e0b070";

export function restyleHair(game: Game, sessionId: string, npcId: unknown, hairStyle: unknown, hairColor: unknown) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const npc = typeof npcId === "string" ? NPCS[npcId] : undefined;
  if (!player || !runtime || player.dead || !npc || npc.role !== "barber" || !game.zone.npcs.includes(npc.id)) return;
  if (!HAIR_STYLES.includes(hairStyle as HairStyle) || !HAIR_COLORS.includes(hairColor as number)) return;
  if (distance(player, npc) > NPC_RANGE + 8) return notice(game, sessionId, "Çok uzak");
  if (player.hairStyle === hairStyle && player.hairColor === hairColor) return notice(game, sessionId, "Saçın zaten böyle");
  const inv = runtime.inventory;
  if (inv.gold < BARBER_PRICE) return notice(game, sessionId, `${BARBER_PRICE.toLocaleString("tr-TR")} altın gerekli`);
  inv.gold -= BARBER_PRICE;
  player.hairStyle = hairStyle as HairStyle;
  player.hairColor = hairColor as number;
  sendInventory(game, sessionId);
  const line = `Berber Cemil makası şakırdattı: ${HAIR_STYLE_NAMES[hairStyle as HairStyle]} saçın hayırlı olsun! (-${BARBER_PRICE.toLocaleString("tr-TR")} altın)`;
  notice(game, sessionId, line, BARBER_COLOR);
  game.io.send(sessionId, Msg.ChatMessage, { channel: "system", text: line } satisfies ChatEvent);
  game.io.persist([sessionId]);
}

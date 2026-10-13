import { MOBS, Msg, ZONES, type ChatEvent, type PingEvent, type PingKind } from "../../../shared/src";
import type { Game } from "./Game";
import { partyOf } from "./party";
import { onlineCharacters } from "./registry";

// Party pings (Alt+click on the map, like LoL / WoW): party members in the same zone see a
// marker at the spot (and on their minimap); members elsewhere get a line in party chat.
// Without a party only you see it. Rate-limited so nobody spams their friends.

const KINDS: Record<PingKind, string> = { alert: "Dikkat!", attack: "Saldır!", help: "Yardım lazım!", move: "Buraya gel!" };
const PINGS_PER_WINDOW = 4;
const WINDOW_MS = 5000;

export function isPingKind(value: unknown): value is PingKind {
  return typeof value === "string" && value in KINDS;
}

export function sendPing(game: Game, sessionId: string, kind: PingKind, x: number, y: number, targetId?: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime) return;
  const now = Date.now();
  runtime.pingTimes = runtime.pingTimes.filter((t) => now - t < WINDOW_MS);
  if (runtime.pingTimes.length >= PINGS_PER_WINDOW) return;
  runtime.pingTimes.push(now);
  if (x < 0 || y < 0 || x > game.map.width * 16 || y > game.map.height * 16) return;

  const mob = targetId ? game.state.mobs.get(targetId) : undefined;
  const event: PingEvent = { from: player.name, kind, x, y, zone: game.zone.id, target: mob ? MOBS[mob.kind]?.name : undefined };
  const members = partyOf(runtime.characterId)?.members ?? [runtime.characterId];
  for (const characterId of members) {
    const entry = onlineCharacters.get(characterId);
    if (!entry) continue;
    if (entry.game === game) {
      entry.game.io.send(entry.sessionId, Msg.PingEvent, event);
    } else {
      const where = ZONES[game.zone.id]?.name ?? game.zone.id;
      const text = `${KINDS[kind]}${event.target ? ` (${event.target})` : ""} · ${where}`;
      entry.game.io.send(entry.sessionId, Msg.ChatMessage, { channel: "party", text, from: player.name, fromClass: player.cls } satisfies ChatEvent);
    }
  }
}

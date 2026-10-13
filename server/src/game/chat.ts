import { Msg, type ChatEvent } from "../../../shared/src";
import type { Game } from "./Game";
import { challenge } from "./duel";
import { requestTrade } from "./trade";
import { invite, kick, leave, partyChat } from "./party";
import { requestFriend } from "./friends";
import { onlineCharacters } from "./registry";

// Chat: one global channel across every zone (dungeon instances included),
// whispers with "/f Name message", and system lines. Server-side validation only.

const MAX_LENGTH = 150;
const FLOOD_WINDOW_MS = 5000;
const FLOOD_MAX_MESSAGES = 5;

function clean(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\p{C}/gu, "") // control/format characters
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LENGTH);
}

function sendTo(game: Game, sessionId: string, event: ChatEvent) {
  game.io.send(sessionId, Msg.ChatMessage, event);
}

function system(game: Game, sessionId: string, text: string) {
  sendTo(game, sessionId, { channel: "system", text });
}

export function handleChat(game: Game, sessionId: string, raw: unknown) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const text = clean(raw);
  if (!player || !runtime || !text) return;

  const now = Date.now();
  runtime.chatTimes = runtime.chatTimes.filter((t) => t > now - FLOOD_WINDOW_MS);
  if (runtime.chatTimes.length >= FLOOD_MAX_MESSAGES) return system(game, sessionId, "Çok hızlı yazıyorsun, biraz bekle.");
  runtime.chatTimes.push(now);

  const sender = { from: player.name, fromClass: player.cls, gm: runtime.isAdmin || undefined };

  const whisper = text.match(/^\/[fw]\s+(\S+)\s+(.+)$/i);
  if (whisper) {
    const target = onlineCharacters.findByName(whisper[1]);
    if (!target) return system(game, sessionId, `${whisper[1]} çevrimiçi değil.`);
    sendTo(target.game, target.sessionId, { channel: "whisper", text: whisper[2], ...sender });
    sendTo(game, sessionId, { channel: "whisper", text: whisper[2], to: target.name });
    console.log(`[chat] ${player.name} -> ${target.name}: ${whisper[2]}`);
    return;
  }
  // Party commands.
  const [command, ...rest] = text.split(" ");
  const argument = rest.join(" ").trim();
  switch (command.toLocaleLowerCase("tr-TR")) {
    case "/davet":
      return argument ? invite(runtime.characterId, argument) : system(game, sessionId, "Kullanım: /davet İsim");
    case "/ayril":
    case "/ayrıl":
      return leave(runtime.characterId);
    case "/at":
      return argument ? kick(runtime.characterId, argument) : system(game, sessionId, "Kullanım: /at İsim");
    case "/p":
    case "/g":
      return argument ? partyChat(runtime.characterId, argument) : system(game, sessionId, "Kullanım: /p mesaj");
    case "/duello":
    case "/düello":
      return argument ? challenge(game, sessionId, argument) : system(game, sessionId, "Kullanım: /duello İsim");
    case "/arkadas":
    case "/arkadaş":
      return argument ? requestFriend(runtime.characterId, argument) : system(game, sessionId, "Kullanım: /arkadas İsim");
    case "/takas":
      return argument ? requestTrade(game, sessionId, argument) : system(game, sessionId, "Kullanım: /takas İsim");
  }
  if (text.startsWith("/")) {
    return system(game, sessionId, "Komutlar: /f İsim mesaj (fısıltı), /p mesaj (grup), /davet İsim, /ayril, /at İsim, /duello İsim, /takas İsim, /arkadas İsim");
  }

  for (const entry of onlineCharacters.all()) {
    // Same room: include the session so the client can show a speech bubble.
    const fromSession = entry.game === game ? sessionId : undefined;
    sendTo(entry.game, entry.sessionId, { channel: "global", text, fromSession, ...sender });
  }
  console.log(`[chat] ${player.name}: ${text}`);
}

/** A system line for everyone online (e.g. rare upgrade announcements). */
export function broadcastSystem(text: string) {
  for (const entry of onlineCharacters.all()) sendTo(entry.game, entry.sessionId, { channel: "system", text });
}

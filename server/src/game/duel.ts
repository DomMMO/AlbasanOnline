import {
  distance,
  DUEL_COUNTDOWN_S,
  DUEL_INVITE_MS,
  DUEL_MAX_DISTANCE,
  DUEL_RANGE,
  DUEL_TIME_LIMIT_MS,
  Msg,
  type ChatEvent,
  type DuelInviteEvent,
  type DuelStateEvent,
  type NoticeEvent,
} from "../../../shared/src";
import type { Game } from "./Game";

// Duels: two players in the same room agree to fight. Outside PvP zones they are then
// hostile to each other only. The blow that would kill the loser leaves them at 1 HP
// instead, and nothing (rating, loot, XP) changes hands. The state lives in the
// players' runtimes, so a duel ends as soon as either side leaves the room.

export interface DuelState {
  id: string;
  opponent: string;
  /** Game time the fight starts (after the countdown). */
  startsAt: number;
  endsAt: number;
}

export interface DuelInvite {
  /** Challenger's session id. */
  from: string;
  expiresAt: number;
}

const COUNTDOWN_COLOR = "#ffd34d";

function system(game: Game, sessionId: string, text: string) {
  game.io.send(sessionId, Msg.ChatMessage, { channel: "system", text } satisfies ChatEvent);
}

function announce(game: Game, sessionIds: string[], message: string) {
  for (const id of sessionIds) game.io.send(id, Msg.Notice, { message, color: COUNTDOWN_COLOR } satisfies NoticeEvent);
}

/** `a` and `b` are fighting each other right now (countdown over). */
export function isDueling(game: Game, a: string, b: string): boolean {
  const duel = game.playerRuntime.get(a)?.duel;
  return !!duel && duel.opponent === b && game.now() >= duel.startsAt;
}

function sessionByName(game: Game, name: string): string | undefined {
  const wanted = name.toLocaleLowerCase("tr-TR");
  let found: string | undefined;
  game.state.players.forEach((player, id) => {
    if (player.name.toLocaleLowerCase("tr-TR") === wanted) found = id;
  });
  return found;
}

export function challenge(game: Game, sessionId: string, targetName: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime) return;
  if (game.zone.pvp) return system(game, sessionId, "Arenada zaten herkes birbirine düşman.");
  const targetId = sessionByName(game, targetName);
  const target = targetId ? game.state.players.get(targetId) : undefined;
  const targetRuntime = targetId ? game.playerRuntime.get(targetId) : undefined;
  if (!targetId || !target || !targetRuntime) return system(game, sessionId, `${targetName} yakınında değil.`);
  if (targetId === sessionId) return system(game, sessionId, "Kendinle düello yapamazsın.");
  if (runtime.duel) return system(game, sessionId, "Zaten bir düellodasın.");
  if (targetRuntime.duel) return system(game, sessionId, `${target.name} zaten bir düelloda.`);
  if (player.dead || target.dead) return system(game, sessionId, "Ölüyken düello olmaz.");
  if (player.stall || target.stall) return system(game, sessionId, "Pazar açıkken düello olmaz.");
  if (distance(player, target) > DUEL_RANGE) return system(game, sessionId, `Düello için ${target.name} yanına yaklaş.`);

  targetRuntime.duelInvite = { from: sessionId, expiresAt: game.now() + DUEL_INVITE_MS };
  game.io.send(targetId, Msg.DuelInvite, { from: player.name } satisfies DuelInviteEvent);
  system(game, sessionId, `${target.name} düelloya davet edildi.`);
}

export function respondDuel(game: Game, sessionId: string, accept: boolean) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  if (!player || !runtime) return;
  const pending = runtime.duelInvite;
  runtime.duelInvite = null;
  if (!pending || pending.expiresAt < game.now()) return system(game, sessionId, "Düello davetinin süresi doldu.");
  const challenger = game.state.players.get(pending.from);
  const challengerRuntime = game.playerRuntime.get(pending.from);
  if (!challenger || !challengerRuntime) return system(game, sessionId, "Rakibin artık burada değil.");
  if (!accept) return system(game, pending.from, `${player.name} düelloyu reddetti.`);
  if (runtime.duel || challengerRuntime.duel) return system(game, sessionId, "Biriniz zaten bir düelloda.");
  if (player.dead || challenger.dead) return system(game, sessionId, "Ölüyken düello olmaz.");
  if (distance(player, challenger) > DUEL_MAX_DISTANCE) return system(game, sessionId, `${challenger.name} çok uzaklaştı.`);

  const id = game.newId("duel");
  const startsAt = game.now() + DUEL_COUNTDOWN_S * 1000;
  const endsAt = startsAt + DUEL_TIME_LIMIT_MS;
  runtime.duel = { id, opponent: pending.from, startsAt, endsAt };
  challengerRuntime.duel = { id, opponent: sessionId, startsAt, endsAt };

  const both = [pending.from, sessionId];
  const stillOn = () => game.playerRuntime.get(sessionId)?.duel?.id === id;
  announce(game, both, `${challenger.name} ile ${player.name} düelloya başlıyor!`);
  for (let left = DUEL_COUNTDOWN_S; left >= 1; left--) {
    game.after((DUEL_COUNTDOWN_S - left) * 1000, () => stillOn() && announce(game, both, String(left)));
  }
  game.after(DUEL_COUNTDOWN_S * 1000, () => {
    if (!stillOn()) return;
    announce(game, both, "Düello başladı!");
    game.io.send(sessionId, Msg.DuelState, { opponent: pending.from } satisfies DuelStateEvent);
    game.io.send(pending.from, Msg.DuelState, { opponent: sessionId } satisfies DuelStateEvent);
  });
}

/** Ends `sessionId`'s duel for both sides and tells everyone in the room how it went. */
function endDuel(game: Game, sessionId: string, text: string) {
  const duel = game.playerRuntime.get(sessionId)?.duel;
  if (!duel) return;
  for (const [id, other] of [
    [sessionId, duel.opponent],
    [duel.opponent, sessionId],
  ]) {
    const runtime = game.playerRuntime.get(id);
    if (!runtime) continue;
    runtime.duel = null;
    // Stop swinging at the former opponent.
    if (runtime.targetId === other) runtime.attacking = false;
    game.io.send(id, Msg.DuelState, { opponent: null } satisfies DuelStateEvent);
  }
  game.io.broadcast(Msg.ChatMessage, { channel: "system", text } satisfies ChatEvent);
}

/**
 * `loserId` lost their duel: beaten (left at 1 HP), killed by something else, or gone.
 * Before the countdown ends nobody wins; the duel is just called off.
 */
export function loseDuel(game: Game, loserId: string, how: "beaten" | "died" | "left") {
  const duel = game.playerRuntime.get(loserId)?.duel;
  if (!duel) return;
  const loser = game.state.players.get(loserId)?.name ?? "?";
  const winner = game.state.players.get(duel.opponent)?.name ?? "?";
  if (game.now() < duel.startsAt) return endDuel(game, loserId, `${winner} ile ${loser} arasındaki düello iptal edildi.`);
  const text =
    how === "beaten"
      ? `${winner} düelloda ${loser} karşısında galip geldi!`
      : how === "died"
        ? `${loser} öldü, düelloyu ${winner} kazandı.`
        : `${loser} düellodan kaçtı, ${winner} kazandı.`;
  endDuel(game, loserId, text);
}

/** Per tick: time limit and duellists running off. */
export function updateDuels(game: Game) {
  const now = game.now();
  for (const [sessionId, runtime] of game.playerRuntime) {
    const duel = runtime.duel;
    if (!duel) continue;
    const player = game.state.players.get(sessionId);
    const opponent = game.state.players.get(duel.opponent);
    const names = `${player?.name ?? "?"} ile ${opponent?.name ?? "?"}`;
    if (now >= duel.endsAt) endDuel(game, sessionId, `${names} arasındaki düello berabere bitti (süre doldu).`);
    else if (player && opponent && distance(player, opponent) > DUEL_MAX_DISTANCE) {
      endDuel(game, sessionId, `${names} arasındaki düello iptal edildi: birbirlerinden çok uzaklaştılar.`);
    }
  }
}

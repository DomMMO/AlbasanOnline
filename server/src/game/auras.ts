import { Msg, SKILLS, type AuraView, type AurasEvent } from "../../../shared/src";
import type { Player } from "../rooms/schema/WorldState";
import { fortuneBonus } from "./fortune";
import type { Game, PlayerRuntime } from "./Game";

// The buffs and debuffs on a player, for the aura bar above their hotbar (owner only).
// Rebuilt every combat tick; sent only when something appears, ends or gets refreshed.

function aurasOf(game: Game, player: Player, runtime: PlayerRuntime): AuraView[] {
  const now = game.now();
  const auras: AuraView[] = [];
  const add = (id: string, icon: string, kind: AuraView["kind"], until: number | null) => {
    if (until !== null && until <= now) return;
    auras.push({ id, icon, kind, remainingMs: until === null ? null : until - now });
  };
  for (const buff of runtime.buffs) add(`buff:${buff.skillId}`, buff.skillId, "buff", buff.until);
  add("guard", "shieldWall", "buff", runtime.guardUntil);
  if (player.shield > 0) add("shield", "shield", "buff", runtime.shieldUntil);
  if (player.protected) add("protected", "aura_protect", "buff", runtime.protectedUntil);
  if (fortuneBonus(runtime) > 0) add("fortune", "aura_fortune", "buff", null);
  add("stun", "aura_stun", "debuff", runtime.stunnedUntil);
  if (player.rooted && now >= runtime.stunnedUntil) add("root", "frostNova", "debuff", runtime.rootedUntil);
  return auras.filter((a) => a.icon.startsWith("aura_") || SKILLS[a.icon]);
}

/** Sends the aura list if it changed (an aura came, went, or was refreshed). */
export function syncAuras(game: Game, sessionId: string, player: Player, runtime: PlayerRuntime) {
  const auras = aurasOf(game, player, runtime);
  // Round to half seconds so a refresh (new end time) counts as a change but ticking down doesn't.
  const signature = auras.map((a) => `${a.id}@${a.remainingMs === null ? "-" : Math.round((a.remainingMs + game.now()) / 500)}`).join("|");
  if (signature === runtime.auraSignature) return;
  runtime.auraSignature = signature;
  game.io.send(sessionId, Msg.Auras, { auras } satisfies AurasEvent);
}

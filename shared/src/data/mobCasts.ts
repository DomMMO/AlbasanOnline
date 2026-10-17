import type { MobDef } from "./mobs";

// Mob abilities with a cast bar under their nameplate (WoW style). Normal swings, arrows and
// bolts stay quick; these are the dangerous moves a party has to answer in time:
//   magic (yellow bar): an interrupt skill or a stun stops it; an interrupted mob can't start that
//     same cast again for INTERRUPT_LOCK_MS.
//   physical (grey bar): interrupts don't work, only a stun stops it (bosses can't be stunned, so
//     theirs are warnings to get out of the way).
// The server (mobCasts.ts) runs them, the client draws the bar and the marked ground.

export type MobCastKind = "magic" | "physical";

export type MobCastEffect =
  /** A heavy hit on the target: attack * multiplier. */
  | { type: "bolt"; multiplier: number }
  /** Everyone within radius of where the target stood when the cast began (marked on the ground). */
  | { type: "area"; radius: number; multiplier: number }
  /** Heals the caster and its pack mates within radius by percent of their max health. */
  | { type: "mend"; radius: number; percent: number }
  /** Hits the target and stuns it (can't move, act or cast). */
  | { type: "stun"; multiplier: number; stunMs: number }
  /** The caster swings harder and faster for a while. */
  | { type: "enrage"; durationMs: number; attackPct: number; speedPct: number };

export interface MobCastDef {
  id: string;
  name: string;
  kind: MobCastKind;
  castMs: number;
  cooldownMs: number;
  /** How near the target must be to start it (pixels; the mob's reach when absent). */
  range?: number;
  effect: MobCastEffect;
  /** Drawn with this colour (the bolt, the marked ground). */
  color: string;
}

/** An interrupted cast can't be started again for this long. */
export const INTERRUPT_LOCK_MS = 10_000;
/** A mob's first cast comes this long (at random within) after the fight begins. */
export const MOB_FIRST_CAST_MS: [number, number] = [3000, 7000];
/** Mobs below this level fight without abilities (the first fields stay gentle). Not bosses. */
export const MOB_CAST_MIN_LEVEL = 8;

const cast = (def: MobCastDef) => def;

export const MOB_CASTS: Record<string, MobCastDef> = Object.fromEntries(
  [
    // ---- Magic (yellow): interrupt or stun ----
    cast({ id: "mob_bolt", name: "Yıkım Küresi", kind: "magic", castMs: 2500, cooldownMs: 14_000, range: 160, effect: { type: "bolt", multiplier: 3 }, color: "#b197fc" }),
    cast({ id: "mob_nova", name: "Lanet Patlaması", kind: "magic", castMs: 2500, cooldownMs: 16_000, range: 160, effect: { type: "area", radius: 40, multiplier: 2.2 }, color: "#e64980" }),
    cast({ id: "mob_mend", name: "Şifa Ayini", kind: "magic", castMs: 2500, cooldownMs: 18_000, range: 200, effect: { type: "mend", radius: 120, percent: 0.25 }, color: "#8ce99a" }),
    cast({ id: "mob_fear", name: "Dehşet Laneti", kind: "magic", castMs: 2000, cooldownMs: 20_000, range: 160, effect: { type: "stun", multiplier: 0.5, stunMs: 3000 }, color: "#845ef7" }),
    cast({ id: "boss_mend", name: "Kan Ayini", kind: "magic", castMs: 3000, cooldownMs: 25_000, range: 400, effect: { type: "mend", radius: 0, percent: 0.1 }, color: "#ff6b6b" }),
    // ---- Physical (grey): only a stun ----
    cast({ id: "mob_volley", name: "Ok Yağmuru", kind: "physical", castMs: 2000, cooldownMs: 15_000, range: 160, effect: { type: "area", radius: 36, multiplier: 1.8 }, color: "#ced4da" }),
    cast({ id: "mob_smash", name: "Ezici Darbe", kind: "physical", castMs: 1800, cooldownMs: 14_000, effect: { type: "bolt", multiplier: 2.8 }, color: "#ff922b" }),
    cast({ id: "mob_enrage", name: "Hiddet", kind: "physical", castMs: 2000, cooldownMs: 25_000, range: 400, effect: { type: "enrage", durationMs: 10_000, attackPct: 0.4, speedPct: 0.4 }, color: "#fa5252" }),
  ].map((def) => [def.id, def]),
);

/** The grey bar's names for the bosses' marked moves (BossAbility, physical). */
export const BOSS_ABILITY_NAMES: Record<string, string> = {
  slam: "Yer Sarsıntısı",
  leap: "Sıçrayış",
  charge: "Hücum",
};

/** Casters get one of these as their second spell (picked by their id, so it never changes). */
const CASTER_SECOND = ["mob_nova", "mob_mend", "mob_fear"];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * A mob's abilities: its own list when it has one, else by what it is. Casters (bolt shooters) a
 * big spell and one more, archers an arrow rain, fighters a crushing blow (and rage if they are
 * big); bosses their blood rite on top (and the casters' spells if they are casters).
 */
export function castsOf(def: MobDef): string[] {
  if (def.casts) return def.casts;
  if (!def.boss && def.level < MOB_CAST_MIN_LEVEL) return [];
  const caster = def.ranged?.kind === "bolt";
  const archer = def.ranged && !caster;
  const own = caster ? ["mob_bolt", CASTER_SECOND[hash(def.id) % CASTER_SECOND.length]] : archer ? ["mob_volley"] : ["mob_smash"];
  if (def.boss) return [...own, "boss_mend"];
  if (!caster && !archer && (def.scale ?? 1) > 1) own.push("mob_enrage");
  return own;
}

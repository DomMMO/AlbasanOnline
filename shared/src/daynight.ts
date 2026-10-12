// Day and night. One clock for the whole server; every outdoor zone sees the same time.
// At night outdoor mobs are stronger and give more, and night-only creatures come out.

export const MINUTES_PER_DAY = 24 * 60;
/** Real milliseconds per in-game minute: a full day takes 48 real minutes. */
export const MS_PER_GAME_MINUTE = 2000;

export const NIGHT_START = 20 * 60;
export const NIGHT_END = 6 * 60;

/** Outdoor mobs at night: health, attack, defense, XP, gold and drop chances. */
export const NIGHT_POWER = 1.2;
/** Night-only creatures, always. */
export const NIGHT_ONLY_POWER = 1.5;

export function isNight(minute: number): boolean {
  return minute >= NIGHT_START || minute < NIGHT_END;
}

/** 0 (bright day) .. 1 (deep night); dusk and dawn fade over the hours around the switch. */
export function darkness(minute: number): number {
  const h = minute / 60;
  if (h >= 7.5 && h < 18.5) return 0;
  if (h >= 18.5 && h < 20) return (h - 18.5) / 1.5;
  if (h >= 6 && h < 7.5) return 1 - (h - 6) / 1.5;
  return 1;
}

export function formatClock(minute: number): string {
  const m = Math.floor(minute) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

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

/**
 * How much the town's lamps, torches and lit windows burn (0 off .. 1 lit): they come on from
 * 18:00 (fully by 18:45) and go out towards dawn, dark again at 06:00. Smooth at both ends.
 */
export function lampLevel(minute: number): number {
  const h = (minute / 60) % 24;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  if (h >= 18 && h < 18.75) return smooth((h - 18) / 0.75);
  if (h >= 5.25 && h < 6) return 1 - smooth((h - 5.25) / 0.75);
  return h >= 18.75 || h < 5.25 ? 1 : 0;
}

export function formatClock(minute: number): string {
  const m = Math.floor(minute) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

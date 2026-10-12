import { isNight, MINUTES_PER_DAY, MS_PER_GAME_MINUTE } from "../../../shared/src";
import { pool } from "../db/pool";

// The one in-game clock every zone reads. By default it follows real time (so restarts
// don't jump it around); a GM can set it or freeze it, and that choice is saved.

interface ClockSetting {
  /** Game minute at `realMs`. */
  minute: number;
  realMs: number;
  paused: boolean;
}

/** Default: derived from the wall clock. */
let setting: ClockSetting = { minute: (Date.now() / MS_PER_GAME_MINUTE) % MINUTES_PER_DAY, realMs: Date.now(), paused: false };

const SETTING_KEY = "world_clock";

/** Current minute of the day, fractional (0 .. 1440). */
export function worldMinute(): number {
  if (setting.paused) return setting.minute;
  const elapsed = (Date.now() - setting.realMs) / MS_PER_GAME_MINUTE;
  return (((setting.minute + elapsed) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function clockInfo() {
  const minute = worldMinute();
  return { minute: Math.floor(minute), paused: setting.paused, night: isNight(minute), msPerMinute: MS_PER_GAME_MINUTE };
}

/** GM: jump to `minute` and/or freeze or resume the clock. */
export async function setWorldClock(change: { minute?: number; paused?: boolean }) {
  const minute = change.minute ?? worldMinute();
  if (!Number.isFinite(minute) || minute < 0 || minute >= MINUTES_PER_DAY) throw new Error("Saat 00:00-23:59 arası olmalı");
  setting = { minute, realMs: Date.now(), paused: change.paused ?? setting.paused };
  await pool.query(
    `INSERT INTO world_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [SETTING_KEY, JSON.stringify(setting)],
  );
}

export async function loadWorldClock() {
  const { rows } = await pool.query<{ value: ClockSetting }>("SELECT value FROM world_settings WHERE key = $1", [SETTING_KEY]);
  const saved = rows[0]?.value;
  if (saved && Number.isFinite(saved.minute) && Number.isFinite(saved.realMs)) setting = { ...saved, paused: !!saved.paused };
}

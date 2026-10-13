// Player preferences, kept in this browser (localStorage). Nothing here affects the server.

export interface Settings {
  /** Camera zoom: "auto" picks from the window width. */
  zoom: "auto" | "2" | "3" | "4";
  damageNumbers: boolean;
  speechBubbles: boolean;
  helpText: boolean;
  /** Damage / healing meter panel. */
  damageMeter: boolean;
  /** Music in boss fights that have a theme. */
  bossMusic: boolean;
}

const KEY = "mmo.settings";
const DEFAULTS: Settings = { zoom: "auto", damageNumbers: true, speechBubbles: true, helpText: true, damageMeter: true, bossMusic: true };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

let current = load();
const listeners = new Set<(settings: Settings) => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage unavailable (private mode): settings last until the page is closed.
  }
  for (const listener of listeners) listener(current);
}

/** Calls back on every change; returns an unsubscribe function. */
export function onSettingsChange(listener: (settings: Settings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

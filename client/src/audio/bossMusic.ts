import { getSettings, onSettingsChange } from "../settings";
import elderDragonTheme from "../assets/music/elder_dragon.weba?url";

// Boss fight music. A boss with a theme starts it when its health bar comes up and it
// fades out when the fight ends (boss dead, out of range, zone left). Toggle: Esc → Ayarlar.

const THEMES: Record<string, string> = {
  elder_dragon: elderDragonTheme,
};

const VOLUME = 0.55;
const FADE_MS = 1500;

let audio: HTMLAudioElement | null = null;
let playing: string | null = null;
let fade = 0;

function fadeTo(target: number, done?: () => void) {
  cancelAnimationFrame(fade);
  const el = audio;
  if (!el) return;
  const from = el.volume;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / FADE_MS);
    el.volume = from + (target - from) * t;
    if (t < 1) fade = requestAnimationFrame(step);
    else done?.();
  };
  fade = requestAnimationFrame(step);
}

/** The boss whose bar is showing (its mob kind), or null when there is none. Cheap to call every frame. */
export function setBossMusic(kind: string | null) {
  const theme = kind && getSettings().bossMusic ? THEMES[kind] : undefined;
  const wanted = theme ? kind : null;
  if (wanted === playing) return;
  playing = wanted;
  if (!wanted) {
    const el = audio;
    fadeTo(0, () => {
      el?.pause();
      if (audio === el) audio = null;
    });
    return;
  }
  audio?.pause();
  audio = new Audio(theme);
  audio.loop = true;
  audio.volume = 0;
  // Browsers only allow sound after the player has interacted with the page; by a boss fight they have.
  audio.play().catch(() => undefined);
  fadeTo(VOLUME);
}

// Turning the setting off silences a fight already under way.
onSettingsChange((settings) => {
  if (!settings.bossMusic && playing) setBossMusic(null);
});

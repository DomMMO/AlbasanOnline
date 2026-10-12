import { SKILLS, type AuraView, type AurasEvent } from "../../../shared/src";
import { auraIconUrl } from "../gfx/skillIcons";

// Aura bar above the hotbar: buffs on the left, debuffs on the right. Each icon counts down
// locally (the server only says when something starts, ends or is refreshed) with a dark sweep
// over the part of the duration that has passed. Hovering one shows what it is.

const $ = (id: string) => document.getElementById(id)!;
const buffsEl = $("buffs");
const debuffsEl = $("debuffs");
const tooltip = $("tooltip");

/** What the aura_* effects are (skills describe themselves). */
const SPECIAL: Record<string, { name: string; text: string }> = {
  aura_stun: { name: "Sersemlemiş", text: "Yürüyemez, saldıramaz ve skill kullanamazsın." },
  aura_protect: { name: "Doğuş Koruması", text: "Oyuncular sana vuramaz. Saldırınca koruma biter." },
  aura_fortune: { name: "Ayşe Teyze'nin Duası", text: "Fincanında iyi şeyler çıktı: bugün bütün yükseltmelerin başarı şansı %10 daha yüksek." },
  frostNova: { name: "Donmuş", text: "Yerinden kıpırdayamazsın." },
};

interface Shown {
  aura: AuraView;
  /** performance.now() when it ends (null = no end). */
  endsAt: number | null;
  /** Total length for the sweep: the longest remaining time seen since it appeared. */
  total: number;
  el: HTMLElement;
  time: HTMLElement;
  sweep: HTMLElement;
}

const shown = new Map<string, Shown>();
let timer = 0;

function auraInfo(aura: AuraView): { name: string; text: string } {
  const special = SPECIAL[aura.icon];
  if (special) return special;
  const skill = SKILLS[aura.icon];
  return { name: skill?.name ?? aura.icon, text: skill?.description ?? "" };
}

function formatRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.ceil(s / 60)}d` : `${s}`;
}

function showTip(entry: Shown) {
  const { name, text } = auraInfo(entry.aura);
  const left = entry.endsAt === null ? "Gün boyu" : `${Math.max(0, Math.ceil((entry.endsAt - performance.now()) / 1000))} sn kaldı`;
  tooltip.innerHTML = "";
  const title = document.createElement("div");
  title.className = "tt-title";
  title.textContent = name;
  title.style.color = entry.aura.kind === "buff" ? "#8ce99a" : "#ff8787";
  const kind = document.createElement("div");
  kind.className = "tt-muted";
  kind.textContent = `${entry.aura.kind === "buff" ? "Güçlendirme" : "Zayıflatma"} · ${left}`;
  const desc = document.createElement("div");
  desc.className = "tt-desc";
  desc.textContent = text;
  tooltip.append(title, kind, desc);
  tooltip.classList.remove("skill");
  tooltip.hidden = false;
  const rect = entry.el.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  tooltip.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - tip.width / 2, window.innerWidth - tip.width - 8))}px`;
  tooltip.style.top = `${Math.max(8, rect.top - tip.height - 8)}px`;
}

export function setAuras(event: AurasEvent) {
  const now = performance.now();
  const ids = new Set(event.auras.map((a) => a.id));
  for (const [id, entry] of shown) {
    if (ids.has(id)) continue;
    entry.el.remove();
    shown.delete(id);
  }
  for (const aura of event.auras) {
    const endsAt = aura.remainingMs === null ? null : now + aura.remainingMs;
    let entry = shown.get(aura.id);
    if (!entry) {
      const el = document.createElement("div");
      el.className = `aura ${aura.kind}`;
      const img = Object.assign(document.createElement("img"), { src: auraIconUrl(aura.icon), alt: "", draggable: false });
      const sweep = Object.assign(document.createElement("span"), { className: "aura-sweep" });
      const time = Object.assign(document.createElement("span"), { className: "aura-time" });
      el.append(img, sweep, time);
      entry = { aura, endsAt, total: aura.remainingMs ?? 0, el, time, sweep };
      const current = entry;
      el.addEventListener("mouseenter", () => showTip(current));
      el.addEventListener("mouseleave", () => (tooltip.hidden = true));
      (aura.kind === "buff" ? buffsEl : debuffsEl).append(el);
      shown.set(aura.id, entry);
    }
    entry.aura = aura;
    entry.endsAt = endsAt;
    // A refresh (longer than before) restarts the sweep.
    if (aura.remainingMs !== null && aura.remainingMs > entry.total - 600) entry.total = aura.remainingMs;
  }
  tick();
  if (!timer) timer = window.setInterval(tick, 250);
}

function tick() {
  const now = performance.now();
  for (const entry of shown.values()) {
    if (entry.endsAt === null) {
      entry.time.textContent = "";
      entry.sweep.style.height = "0%";
      continue;
    }
    const left = Math.max(0, entry.endsAt - now);
    entry.time.textContent = formatRemaining(left);
    entry.sweep.style.height = `${entry.total > 0 ? (1 - left / entry.total) * 100 : 0}%`;
  }
}

/** Leaving the game: drop everything. */
export function clearAuras() {
  for (const entry of shown.values()) entry.el.remove();
  shown.clear();
}

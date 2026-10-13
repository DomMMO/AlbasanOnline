import { darkness, formatClock, isNight, POTION_COOLDOWN_MS, type ItemDef, type SkillDef } from "../../../shared/src";
import { iconUrl, itemIconUrl } from "../gfx/icons";
import { skillIconUrl } from "../gfx/skillIcons";
import { installGlobeFrame } from "./globeFrame";
import { actionKeyLabel } from "../input/keybindings";
import { HOTBAR_ACTIONS } from "../input/InputManager";
import { clearAuras } from "./auras";

// Game UI lives in the DOM: easier to build, style and make responsive than
// drawing it inside the canvas. The scene pushes state in; clicks call back out.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const hud = $("hud");
const online = $("hud-online");
const ping = $("hud-ping");

const playerName = $("player-name");
const playerLevel = $("player-level");
const playerHpFill = $("player-hp-fill");
const playerHpText = $("player-hp-text");
const playerRageFill = $("player-rage-fill");
const playerRageText = $("player-rage-text");
const hpGlobe = $("hp-globe");
installGlobeFrame(hpGlobe, "left", ["#ff8787", "#7a0f0f"]);
installGlobeFrame($("resource-globe"), "right", ["#a5d8ff", "#0b2f6b"]);
const hpGlobeText = $("hp-globe-text");
const resourceGlobe = $("resource-globe");
const resourceGlobeText = $("resource-globe-text");
/** Health fraction last shown (the globe only sloshes when it is low). */
let hpFraction = 1;

const targetFrame = $("target-frame");
const targetName = $("target-name");
const targetLevel = $("target-level");
const targetHpFill = $("target-hp-fill");
const targetHpText = $("target-hp-text");
const targetInvite = $<HTMLButtonElement>("target-invite");
let inviteCallback: (() => void) | null = null;
targetInvite.addEventListener("mousedown", (e) => e.preventDefault());
targetInvite.addEventListener("click", () => inviteCallback?.());
const targetTrade = $<HTMLButtonElement>("target-trade");
let tradeCallback: (() => void) | null = null;
targetTrade.addEventListener("mousedown", (e) => e.preventDefault());
targetTrade.addEventListener("click", () => tradeCallback?.());
const targetDuel = $<HTMLButtonElement>("target-duel");
let duelCallback: (() => void) | null = null;
targetDuel.addEventListener("mousedown", (e) => e.preventDefault());
targetDuel.addEventListener("click", () => duelCallback?.());

const hotbar = $("hotbar");
const xpFill = $("xp-fill");
const xpText = $("xp-text");
const messages = $("messages");
const deathPanel = $("death");
const respawnButton = $<HTMLButtonElement>("respawn");

export function showHud() {
  hud.hidden = false;
}

/** Leaving the game (character switch / logout): hide the HUD and every in-game window. */
export function resetGameUi() {
  hud.hidden = true;
  for (const id of ["inventory-window", "shop-window", "upgrade-window", "leaderboard", "party-frames", "party-invite", "duel-invite", "boss-bar", "cast-bar", "target-frame", "pvp-stats", "death", "loading", "tooltip", "stall-button", "stall-setup", "stall-browse", "npc-dialog", "quest-log", "quest-tracker", "passive-window", "skills-window"]) {
    document.getElementById(id)!.hidden = true;
  }
  document.getElementById("killfeed")!.replaceChildren();
  clearAuras();
  nightOverlay.style.opacity = "0";
}

const clock = $("clock");
const nightOverlay = $("night-overlay");

/** World clock in the corner; outdoor zones also darken at night. */
export function setClock(minute: number, outdoor: boolean) {
  const night = isNight(minute);
  clock.textContent = `${night ? "☾" : "☀"} ${formatClock(minute)}`;
  clock.classList.toggle("night", night);
  clock.title = night ? "Gece: yaratıklar %20 daha güçlü ve ödüllü, gece yaratıkları dolaşıyor" : "Gündüz";
  nightOverlay.style.opacity = String(outdoor ? darkness(minute) * 0.6 : 0);
}

export function setOnlineCount(count: number) {
  online.textContent = `Çevrimiçi: ${count}`;
}

const position = $("hud-pos");
let lastPosition = "";

/** Our tile coordinates next to the online count. */
export function setPosition(x: number, y: number) {
  const text = `X: ${Math.floor(x / 16)} Y: ${Math.floor(y / 16)}`;
  if (text === lastPosition) return;
  lastPosition = text;
  position.textContent = text;
}

/** A boss blow shook the screen: when health is low, the health globe's liquid sloshes. */
export function sloshGlobes() {
  if (hpFraction >= 0.35) return;
  hpGlobe.classList.remove("slosh");
  void hpGlobe.offsetWidth; // restart the animation
  hpGlobe.classList.add("slosh");
}

export function setPing(ms: number) {
  ping.textContent = `Ping: ${Math.round(ms)} ms`;
}

const percent = (value: number, max: number) => `${max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0}%`;

export interface PlayerFrameData {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  /** Rage or mana. */
  resource: number;
  maxResource: number;
  resourceType: "rage" | "mana" | "energy";
  shield: number;
  xp: number;
  xpToNext: number;
}

export function updatePlayerFrame(data: PlayerFrameData) {
  playerName.textContent = data.name;
  playerLevel.textContent = `Sv ${data.level}`;
  const hpText = data.shield > 0 ? `${data.hp} / ${data.maxHp} (+${data.shield})` : `${data.hp} / ${data.maxHp}`;
  playerHpFill.style.width = percent(data.hp, data.maxHp);
  playerHpText.textContent = hpText;
  playerHpFill.parentElement!.classList.toggle("shielded", data.shield > 0);
  playerRageFill.style.width = percent(data.resource, data.maxResource);
  playerRageText.textContent = `${data.resource} / ${data.maxResource}`;
  playerRageFill.parentElement!.classList.toggle("mana", data.resourceType === "mana");
  playerRageFill.parentElement!.classList.toggle("energy", data.resourceType === "energy");

  // The globes: the liquid level eases to the new value (CSS transition on --level).
  hpFraction = data.maxHp > 0 ? data.hp / data.maxHp : 0;
  hpGlobe.style.setProperty("--level", percent(data.hp, data.maxHp));
  hpGlobe.classList.toggle("shielded", data.shield > 0);
  hpGlobe.classList.toggle("low", hpFraction < 0.35);
  hpGlobeText.textContent = hpText;
  resourceGlobe.style.setProperty("--level", percent(data.resource, data.maxResource));
  for (const type of ["rage", "mana", "energy"] as const) resourceGlobe.classList.toggle(type, data.resourceType === type);
  resourceGlobeText.textContent = `${data.resource} / ${data.maxResource}`;
  xpFill.style.width = percent(data.xp, data.xpToNext);
  xpText.textContent = `XP ${data.xp} / ${data.xpToNext}`;
  currentResource = data.resource;
}

// ---- Cast bar ------------------------------------------------------------

const castBar = $("cast-bar");
const castFill = $("cast-fill");
const castName = $("cast-name");
let castAnimation: Animation | null = null;

export function startCastBar(name: string, castMs: number, color: string) {
  castBar.hidden = false;
  castBar.classList.remove("interrupted");
  castName.textContent = name;
  castFill.style.background = color;
  castAnimation?.cancel();
  castAnimation = castFill.animate([{ width: "0%" }, { width: "100%" }], { duration: castMs, fill: "forwards" });
}

export function stopCastBar(interrupted: boolean) {
  if (castBar.hidden) return;
  castAnimation?.pause();
  if (interrupted) {
    castBar.classList.add("interrupted");
    castName.textContent = "İptal edildi";
  }
  setTimeout(() => (castBar.hidden = true), interrupted ? 500 : 150);
}

export interface TargetFrameData {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  /** CSS colour for the name, based on level difference (or friendliness). */
  color: string;
  /** Extra label, e.g. the class of a friendly player. */
  subtitle?: string;
  /** Who the mob is attacking (tanks watch this). */
  aggro?: string;
  /** Shows the "Gruba davet et" button when set. */
  onInvite?: () => void;
  /** Shows the "Düello" button when set. */
  onDuel?: () => void;
  /** Shows the "Takas" button when set. */
  onTrade?: () => void;
}

export function setTargetFrame(data: TargetFrameData | null) {
  targetFrame.hidden = data === null;
  if (!data) return;
  targetName.textContent = data.name;
  targetName.style.color = data.color;
  targetLevel.textContent = data.subtitle ? `${data.subtitle} · Sv ${data.level}` : `Sv ${data.level}`;
  targetHpFill.style.width = percent(data.hp, data.maxHp);
  targetHpText.textContent = data.aggro ? `${data.hp} / ${data.maxHp}  → ${data.aggro}` : `${data.hp} / ${data.maxHp}`;
  inviteCallback = data.onInvite ?? null;
  targetInvite.hidden = !data.onInvite;
  duelCallback = data.onDuel ?? null;
  targetDuel.hidden = !data.onDuel;
  tradeCallback = data.onTrade ?? null;
  targetTrade.hidden = !data.onTrade;
}

// ---- Hotbar ------------------------------------------------------------

/** `locked`: a skill with no points in it yet (shown greyed out). `empty`: a free slot to drop a skill on. */
export type HotbarEntry = { kind: "skill"; skill: SkillDef; locked?: boolean } | { kind: "item"; item: ItemDef } | { kind: "empty" };

/** Drag data for a skill dragged from the Yetenekler page (`from` absent) or from another slot. */
export const SKILL_DRAG_TYPE = "application/x-mmo-skill";
export interface SkillDrag {
  skillId: string;
  from?: number;
}

export interface HotbarCallbacks {
  /** A skill was dropped on slot `index`. */
  drop(index: number, drag: SkillDrag): void;
  /** Right-click: empty the slot. */
  clear(index: number): void;
}

interface Slot {
  entry: HotbarEntry;
  /** Key matched against SkillUsed events: skill id or item cooldown group. */
  cooldownId: string;
  cooldownLength: number;
  triggersGcd: boolean;
  element: HTMLButtonElement;
  sweep: HTMLElement;
  count?: HTMLElement;
  cooldownUntil: number;
}

let slots: Slot[] = [];
let gcdUntil = 0;
let gcdLength = 1;
let currentResource = 0;
let itemCount: (defId: string) => number = () => 0;
let renderLoopStarted = false;

/**
 * Safe to call again after a zone change: rebuilds the slots, keeps one render loop.
 * `onHover(index, slot)` shows a slot's tooltip (null = hide).
 */
export function initHotbar(
  entries: HotbarEntry[],
  onUse: (index: number) => void,
  countItem: (defId: string) => number,
  onHover: (index: number | null, slot: HTMLElement) => void = () => {},
  callbacks?: HotbarCallbacks,
) {
  itemCount = countItem;
  hotbar.replaceChildren();
  // Rearranging rebuilds the bar: keep cooldowns that are still running.
  const running = new Map(slots.map((slot) => [slot.cooldownId, { until: slot.cooldownUntil, length: slot.cooldownLength }]));
  slots = entries.map((entry, index) => {
    const element = document.createElement("button");
    element.className = "slot";
    // Don't let the button take keyboard focus away from the game.
    element.tabIndex = -1;
    element.addEventListener("mousedown", (event) => event.preventDefault());
    element.addEventListener("click", () => onUse(index));
    element.addEventListener("mouseenter", () => onHover(index, element));
    element.addEventListener("mouseleave", () => onHover(null, element));
    element.innerHTML = `<span class="slot-key">${actionKeyLabel(HOTBAR_ACTIONS[index])}</span><span class="slot-sweep"></span>`;
    if (callbacks) {
      element.addEventListener("dragover", (event) => {
        if (event.dataTransfer?.types.includes(SKILL_DRAG_TYPE)) {
          event.preventDefault();
          element.classList.add("drop-target");
        }
      });
      element.addEventListener("dragleave", () => element.classList.remove("drop-target"));
      element.addEventListener("drop", (event) => {
        event.preventDefault();
        element.classList.remove("drop-target");
        const raw = event.dataTransfer?.getData(SKILL_DRAG_TYPE);
        if (raw) callbacks.drop(index, JSON.parse(raw) as SkillDrag);
      });
      element.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        if (entry.kind !== "empty") callbacks.clear(index);
      });
      if (entry.kind === "skill") {
        element.draggable = true;
        element.addEventListener("dragstart", (event) => {
          event.dataTransfer!.setData(SKILL_DRAG_TYPE, JSON.stringify({ skillId: entry.skill.id, from: index } satisfies SkillDrag));
          event.dataTransfer!.effectAllowed = "move";
          onHover(null, element);
        });
      }
    }

    let count: HTMLElement | undefined;
    if (entry.kind === "skill") {
      const { skill } = entry;
      element.style.setProperty("--skill-color", skill.color);
      element.classList.add("skill");
      element.classList.toggle("locked", !!entry.locked);
      element.prepend(Object.assign(document.createElement("img"), { className: "slot-icon", src: skillIconUrl(skill), draggable: false, alt: skill.name }));
    } else if (entry.kind === "empty") {
      element.classList.add("empty");
      element.title = "Boş slot: Yetenekler (K) sayfasından bir skill sürükle";
    } else {
      const { item } = entry;
      element.classList.add("item");
      element.title = `${item.name}\n${item.description ?? ""}`;
      const img = Object.assign(document.createElement("img"), { src: itemIconUrl(item), draggable: false });
      count = Object.assign(document.createElement("span"), { className: "slot-count" });
      element.prepend(img);
      element.append(count);
    }
    hotbar.append(element);
    const cooldownId = entry.kind === "skill" ? entry.skill.id : entry.kind === "item" ? (entry.item.cooldownGroup ?? entry.item.id) : "";
    const still = cooldownId ? running.get(cooldownId) : undefined;
    return {
      entry,
      cooldownId,
      cooldownLength: still?.length ?? (entry.kind === "skill" ? entry.skill.cooldownMs : POTION_COOLDOWN_MS),
      triggersGcd: entry.kind === "skill" && entry.skill.triggersGcd,
      element,
      sweep: element.querySelector(".slot-sweep")!,
      count,
      cooldownUntil: still?.until ?? 0,
    };
  });
  if (!renderLoopStarted) requestAnimationFrame(renderHotbar);
  renderLoopStarted = true;
}

/** Key bindings changed: relabel the hotbar slots. */
export function refreshKeyLabels() {
  slots.forEach((slot, index) => {
    const label = slot.element.querySelector(".slot-key");
    if (label) label.textContent = actionKeyLabel(HOTBAR_ACTIONS[index]);
  });
}

export function startCooldown(cooldownId: string, cooldownMs: number, gcdMs: number) {
  const now = performance.now();
  for (const slot of slots) {
    if (slot.cooldownId === cooldownId && cooldownMs > 0) {
      slot.cooldownUntil = now + cooldownMs;
      slot.cooldownLength = cooldownMs;
    }
  }
  if (gcdMs > 0) {
    gcdUntil = now + gcdMs;
    gcdLength = gcdMs;
  }
}

function renderHotbar() {
  const now = performance.now();
  for (const slot of slots) {
    const ownRemaining = slot.cooldownUntil - now;
    const gcdRemaining = slot.triggersGcd ? gcdUntil - now : 0;
    let fraction = 0;
    if (ownRemaining > 0 && ownRemaining >= gcdRemaining) fraction = ownRemaining / slot.cooldownLength;
    else if (gcdRemaining > 0) fraction = gcdRemaining / gcdLength;
    slot.sweep.style.height = `${Math.max(0, Math.min(1, fraction)) * 100}%`;

    let usable: boolean;
    if (slot.entry.kind === "skill") {
      usable = !slot.entry.locked && currentResource >= slot.entry.skill.cost;
    } else if (slot.entry.kind === "empty") {
      usable = true;
    } else {
      const count = itemCount(slot.entry.item.id);
      slot.count!.textContent = String(count);
      usable = count > 0;
    }
    slot.element.classList.toggle("no-resource", !usable);
  }
  requestAnimationFrame(renderHotbar);
}

export function flashSlot(index: number) {
  const element = slots[index]?.element;
  if (!element) return;
  element.classList.remove("pressed");
  void element.offsetWidth; // restart the CSS animation
  element.classList.add("pressed");
}

// ---- Messages & death ----------------------------------------------------

export function showMessage(text: string, kind: "error" | "info" | "level" = "error", color?: string) {
  const line = document.createElement("div");
  line.className = `message ${kind}`;
  line.textContent = text;
  if (color) line.style.color = color;
  messages.append(line);
  while (messages.children.length > 5) messages.firstElementChild!.remove();
  setTimeout(() => line.remove(), kind === "level" ? 3000 : 1600);
}

export function setDeathPanel(visible: boolean) {
  deathPanel.hidden = !visible;
}

let respawnCallback: () => void = () => {};
respawnButton.addEventListener("click", () => respawnCallback());

export function onRespawnClicked(callback: () => void) {
  respawnCallback = callback;
}

const bossBar = $("boss-bar");
const bossName = $("boss-name");
const bossHpFill = $("boss-hp-fill");
const bossHpText = $("boss-hp-text");

export function setBossBar(data: { name: string; hp: number; maxHp: number; enraged: boolean } | null) {
  bossBar.hidden = data === null;
  if (!data) return;
  bossName.textContent = data.enraged ? `${data.name} · ÖFKELİ` : data.name;
  bossBar.classList.toggle("enraged", data.enraged);
  bossHpFill.style.width = percent(data.hp, data.maxHp);
  bossHpText.textContent = `${data.hp} / ${data.maxHp}`;
}

/** Name colour by level difference, like WoW: grey (trivial) to red (dangerous). */
export function levelColor(targetLevel: number, playerLevel: number): string {
  const diff = targetLevel - playerLevel;
  if (diff >= 5) return "#ff4040";
  if (diff >= 3) return "#ff8c1a";
  if (diff >= -2) return "#ffe14d";
  if (diff >= -4) return "#4cd964";
  return "#9a9a9a";
}

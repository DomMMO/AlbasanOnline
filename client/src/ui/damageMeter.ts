import { classOf, type CombatEvent } from "../../../shared/src";
import { getSettings, onSettingsChange } from "../settings";

// Damage meter in the spirit of WoW's Details!: one row per group member with a class-coloured
// bar, split into fights ("segments"). A fight starts with the first hit after a quiet spell
// and is named after the enemy that took the most damage; "Overall" adds every fight up.
// Modes: damage done, healing done, damage taken; each row shows the total and the per-second
// rate (DPS / HPS / DTPS) side by side. Counts what the server broadcasts, so a
// minion's hits count for its owner. Kept across zone changes until reset; toggled in settings.

type Mode = "damage" | "heal" | "taken";

/** Title and per-second unit of each mode. */
const MODES: Record<Mode, { title: string; rate: string }> = {
  damage: { title: "Damage Done", rate: "DPS" },
  heal: { title: "Healing Done", rate: "HPS" },
  taken: { title: "Damage Taken", rate: "DTPS" },
};

/** This long without any group combat ends the fight. */
const FIGHT_GAP_MS = 6000;
const MAX_HISTORY = 8;
const POSITION_KEY = "mmo-damage-meter-position";

interface Actor {
  name: string;
  cls: string;
  damage: number;
  heal: number;
  taken: number;
}

interface Segment {
  start: number;
  end: number;
  /** Combat time (ms); for one fight it's end - start, for the total the sum of all fights. */
  activeMs: number;
  actors: Map<string, Actor>;
  /** Enemy name -> damage the group did to it (names the fight). */
  targets: Map<string, number>;
}

/** Group member (us or a party member in this zone) behind a session id, or undefined. */
export interface MeterLookup {
  actor(sessionId: string): { name: string; cls: string } | undefined;
  enemyName(event: CombatEvent): string | undefined;
}

const $ = (id: string) => document.getElementById(id)!;
const panel = $("damage-meter");
const titleBar = panel.querySelector<HTMLElement>(".dm-title")!;
const titleText = $("dm-title-text");
const segmentText = $("dm-segment-name");
const rowsEl = $("damage-meter-rows");
const menuEl = $("dm-menu");

const newSegment = (now: number): Segment => ({ start: now, end: now, activeMs: 0, actors: new Map(), targets: new Map() });

let mode: Mode = "damage";
/** "current", "overall" or an index into history (0 = most recent finished fight). */
let view: "current" | "overall" | number = "current";
let current: Segment | null = null;
let history: Segment[] = [];
let overall = newSegment(0);
let dirty = true;
let initialised = false;

export function initDamageMeter() {
  if (initialised) return;
  initialised = true;
  $("dm-mode").addEventListener("click", (e) => {
    e.stopPropagation();
    openMenu(Object.entries(MODES).map(([key, { title }]) => ({ label: title, active: key === mode, pick: () => (mode = key as Mode) })));
  });
  $("dm-segment").addEventListener("click", (e) => {
    e.stopPropagation();
    openMenu([
      { label: "Current Segment", active: view === "current", pick: () => (view = "current") },
      ...history.map((segment, i) => ({ label: `${segmentName(segment)} (${clock(segment.activeMs)})`, active: view === i, pick: () => (view = i) })),
      { label: "Overall", active: view === "overall", pick: () => (view = "overall") },
    ]);
  });
  $("dm-reset").addEventListener("click", () => {
    current = null;
    history = [];
    overall = newSegment(0);
    view = "current";
    dirty = true;
    render();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!menuEl.hidden && !menuEl.contains(e.target as Node)) menuEl.hidden = true;
  });
  makeDraggable();

  const apply = () => {
    panel.hidden = !getSettings().damageMeter;
    dirty = true;
    render();
  };
  apply();
  onSettingsChange(apply);
  setInterval(() => {
    if (!panel.hidden && (dirty || view === "current")) render();
  }, 500);
}

function openMenu(items: { label: string; active: boolean; pick: () => void }[]) {
  menuEl.replaceChildren(
    ...items.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.tabIndex = -1;
      button.textContent = item.label;
      button.classList.toggle("active", item.active);
      button.addEventListener("click", () => {
        item.pick();
        menuEl.hidden = true;
        dirty = true;
        render();
      });
      return button;
    }),
  );
  menuEl.hidden = false;
}

function actorIn(segment: Segment, who: { name: string; cls: string }): Actor {
  let actor = segment.actors.get(who.name);
  if (!actor) {
    actor = { name: who.name, cls: who.cls, damage: 0, heal: 0, taken: 0 };
    segment.actors.set(who.name, actor);
  }
  return actor;
}

export function recordCombat(event: CombatEvent, lookup: MeterLookup) {
  if (event.amount <= 0) return;
  const source = lookup.actor(event.sourceId);
  const target = event.targetKind === "player" ? lookup.actor(event.targetId) : undefined;
  const dealt = source && !event.heal ? source : undefined;
  const healed = source && event.heal ? source : undefined;
  const hurt = target && !event.heal ? target : undefined;
  if (!dealt && !healed && !hurt) return;

  const now = performance.now();
  if (!current || now - current.end > FIGHT_GAP_MS) {
    if (current) history = [current, ...history].slice(0, MAX_HISTORY);
    if (typeof view === "number") view = Math.min(view + 1, history.length - 1);
    current = newSegment(now);
  } else {
    overall.activeMs += now - current.end;
  }
  current.end = now;
  current.activeMs = current.end - current.start;

  for (const segment of [current, overall]) {
    if (dealt) {
      actorIn(segment, dealt).damage += event.amount;
      const enemy = lookup.enemyName(event);
      if (enemy) segment.targets.set(enemy, (segment.targets.get(enemy) ?? 0) + event.amount);
    }
    if (healed) actorIn(segment, healed).heal += event.amount;
    if (hurt) actorIn(segment, hurt).taken += event.amount;
  }
  dirty = true;
}

function segmentName(segment: Segment): string {
  const top = [...segment.targets].sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? "Combat";
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

function shownSegment(): Segment | null {
  if (view === "overall") return overall.actors.size > 0 ? overall : null;
  if (view === "current") return current;
  return history[view] ?? null;
}

function render() {
  dirty = false;
  titleText.textContent = MODES[mode].title;
  const segment = shownSegment();
  segmentText.textContent = !segment
    ? view === "overall" ? "Overall" : "Current Segment"
    : view === "overall"
      ? `Overall · ${clock(segment.activeMs)}`
      : `${view === "current" ? "Current Segment: " : ""}${segmentName(segment)} · ${clock(segment.activeMs)}`;

  const seconds = Math.max(1, (segment?.activeMs ?? 0) / 1000);
  const field = mode;
  const actors = segment ? [...segment.actors.values()].filter((a) => a[field] > 0).sort((a, b) => b[field] - a[field]) : [];
  if (actors.length === 0) {
    rowsEl.innerHTML = `<div class="dm-empty">No combat data</div>`;
    return;
  }
  const top = actors[0][field];
  const total = actors.reduce((sum, a) => sum + a[field], 0);
  rowsEl.replaceChildren(
    ...actors.map((actor, i) => {
      const amount = actor[field];
      const rate = amount / seconds;
      const row = document.createElement("div");
      row.className = "dm-row";
      row.style.setProperty("--fill", `${(amount / top) * 100}%`);
      row.style.setProperty("--class", classOf(actor.cls).color);
      const name = document.createElement("span");
      name.className = "dm-name";
      name.textContent = `${i + 1}. ${actor.name}`;
      const value = document.createElement("span");
      value.className = "dm-value";
      const percent = `${Math.round((amount / total) * 100)}%`;
      // Total and per-second side by side, in every mode.
      value.textContent = `${short(amount)} · ${short(rate)} ${MODES[mode].rate} · ${percent}`;
      const line = (m: Mode) => `${MODES[m].title}: ${short(actor[m])} (${short(actor[m] / seconds)} ${MODES[m].rate})`;
      row.title = [actor.name, line("damage"), line("heal"), line("taken")].join("\n");
      row.append(name, value);
      return row;
    }),
  );
}

function makeDraggable() {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null") as { left: number; top: number } | null;
    if (saved && !document.body.classList.contains("touch")) place(saved.left, saved.top);
  } catch {
    // no saved position
  }
  titleBar.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest("button") || document.body.classList.contains("touch")) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    const offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    titleBar.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => place(e.clientX - offset.x, e.clientY - offset.y);
    const up = () => {
      titleBar.removeEventListener("pointermove", move);
      titleBar.removeEventListener("pointerup", up);
      const r = panel.getBoundingClientRect();
      try {
        localStorage.setItem(POSITION_KEY, JSON.stringify({ left: r.left, top: r.top }));
      } catch {
        // storage blocked
      }
    };
    titleBar.addEventListener("pointermove", move);
    titleBar.addEventListener("pointerup", up);
  });
  // Double-click the title: back to the default corner.
  titleBar.addEventListener("dblclick", () => {
    for (const prop of ["left", "top", "right", "bottom"] as const) panel.style[prop] = "";
    try {
      localStorage.removeItem(POSITION_KEY);
    } catch {
      // ignore
    }
  });
}

function place(left: number, top: number) {
  const x = Math.max(0, Math.min(left, window.innerWidth - panel.offsetWidth));
  const y = Math.max(0, Math.min(top, window.innerHeight - 40));
  panel.style.left = `${x}px`;
  panel.style.top = `${y}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
}

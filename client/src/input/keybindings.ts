import Phaser from "phaser";
import { Action, DEFAULT_BINDINGS } from "./InputManager";

// Player key bindings (Esc → Menü → Tuş Atamaları). Stored in this browser as overrides of
// DEFAULT_BINDINGS. A key belongs to one action at a time: binding it somewhere takes it away
// from wherever it was. Esc (menu) and Enter (chat) can't be rebound.

const KEY = "mmo.keybindings";

/** Rebindable actions, grouped for the settings page, with their Turkish names. */
export const BINDABLE: { group: string; actions: [Action, string][] }[] = [
  {
    group: "Skill barı",
    actions: [
      [Action.Skill1, "Slot 1"],
      [Action.Skill2, "Slot 2"],
      [Action.Skill3, "Slot 3"],
      [Action.Skill4, "Slot 4"],
      [Action.Skill5, "Slot 5"],
      [Action.Skill6, "Slot 6"],
      [Action.Skill7, "Slot 7"],
      [Action.Skill8, "Slot 8"],
      [Action.Skill9, "Slot 9"],
      [Action.Skill10, "Slot 10"],
      [Action.Potion1, "İksir 1"],
      [Action.Potion2, "İksir 2"],
    ],
  },
  {
    group: "Hareket ve savaş",
    actions: [
      [Action.MoveUp, "Yukarı"],
      [Action.MoveDown, "Aşağı"],
      [Action.MoveLeft, "Sola"],
      [Action.MoveRight, "Sağa"],
      [Action.TargetNext, "Sıradaki hedef"],
      [Action.Attack, "Hedefe saldır"],
      [Action.Interact, "Etkileşim (al, konuş, portal)"],
      [Action.TownPortal, "Şehir portalı"],
      [Action.Mount, "Ata bin / in"],
      [Action.Sprint, "Dörtnala koş (atta basılı tut)"],
    ],
  },
  {
    group: "Pencereler",
    actions: [
      [Action.ToggleInventory, "Karakter ve envanter"],
      [Action.Skills, "Yetenekler"],
      [Action.PassiveTree, "Pasif ağaç"],
      [Action.QuestLog, "Görev günlüğü"],
      [Action.Friends, "Arkadaşlar"],
      [Action.Leaderboard, "PvP sıralaması"],
      [Action.Minimap, "Mini harita"],
    ],
  },
];

/** Keys that stay reserved. */
const RESERVED = new Set(["ESC", "ENTER"]);

type Bindings = Record<Action, string[]>;

function loadOverrides(): Partial<Bindings> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

let overrides = loadOverrides();
const listeners = new Set<() => void>();

export function getBindings(): Bindings {
  const bindings = { ...DEFAULT_BINDINGS };
  for (const [action, keys] of Object.entries(overrides)) {
    if (action in bindings && Array.isArray(keys)) bindings[action as Action] = keys.filter((k) => typeof k === "string");
  }
  return bindings;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(overrides));
  } catch {
    // storage blocked: bindings last until the page is closed
  }
  for (const listener of listeners) listener();
}

/** Puts `keyName` on `action` (its only key) and takes it off every other action. */
export function bindKey(action: Action, keyName: string) {
  if (RESERVED.has(keyName)) return;
  const bindings = getBindings();
  for (const [other, keys] of Object.entries(bindings) as [Action, string[]][]) {
    if (other !== action && keys.includes(keyName)) overrides[other] = keys.filter((k) => k !== keyName);
  }
  overrides[action] = [keyName];
  save();
}

export function resetBindings() {
  overrides = {};
  save();
}

export function onBindingsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const KEY_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(Phaser.Input.Keyboard.KeyCodes).map(([name, code]) => [code as number, name]),
);

/** Phaser key name for a browser key event ("SPACE", "Q", "ONE"...), or null if unknown. */
export function keyNameOf(event: KeyboardEvent): string | null {
  return KEY_NAMES[event.keyCode] ?? null;
}

const PRETTY: Record<string, string> = {
  ZERO: "0", ONE: "1", TWO: "2", THREE: "3", FOUR: "4", FIVE: "5", SIX: "6", SEVEN: "7", EIGHT: "8", NINE: "9",
  SPACE: "Space", SHIFT: "Shift", CTRL: "Ctrl", ALT: "Alt", TAB: "Tab", BACKSPACE: "⌫", CAPS_LOCK: "Caps",
  UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→", BACKTICK: "`", COMMA: ",", PERIOD: ".", FORWARD_SLASH: "/",
  SEMICOLON: ";", QUOTES: "'", OPEN_BRACKET: "[", CLOSED_BRACKET: "]", BACK_SLASH: "\\", MINUS: "-", PLUS: "=",
};

/** Short label for a key name, for hotbar slots and the settings page. */
export function keyLabel(name: string | undefined): string {
  if (!name) return "";
  if (PRETTY[name]) return PRETTY[name];
  if (name.startsWith("NUMPAD_")) return `N${PRETTY[name.slice(7)] ?? name.slice(7)}`;
  return name.length <= 3 ? name : name.charAt(0) + name.slice(1).toLowerCase();
}

/** The label of an action's first key ("" if unbound). */
export function actionKeyLabel(action: Action): string {
  return keyLabel(getBindings()[action][0]);
}

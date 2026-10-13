import Phaser from "phaser";
import type { Axis } from "../../../shared/src";

// Game code asks about *actions* ("move up", "skill 1"), never about physical keys.
// Keyboard is the only source today; touch joystick/buttons and gamepad can
// feed the same actions later without touching gameplay code.

export enum Action {
  MoveUp = "moveUp",
  MoveDown = "moveDown",
  MoveLeft = "moveLeft",
  MoveRight = "moveRight",
  TargetNext = "targetNext",
  ClearTarget = "clearTarget",
  Attack = "attack",
  Skill1 = "skill1",
  Skill2 = "skill2",
  Skill3 = "skill3",
  Skill4 = "skill4",
  Skill5 = "skill5",
  Skill6 = "skill6",
  Skill7 = "skill7",
  Skill8 = "skill8",
  Skill9 = "skill9",
  Skill10 = "skill10",
  Skills = "skills",
  Potion1 = "potion1",
  Potion2 = "potion2",
  ToggleInventory = "toggleInventory",
  Interact = "interact",
  Leaderboard = "leaderboard",
  QuestLog = "questLog",
  PassiveTree = "passiveTree",
  TownPortal = "townPortal",
  Minimap = "minimap",
  Mount = "mount",
  Sprint = "sprint",
  Friends = "friends",
}

/** Hotbar slots in order. */
export const HOTBAR_ACTIONS = [
  Action.Skill1,
  Action.Skill2,
  Action.Skill3,
  Action.Skill4,
  Action.Skill5,
  Action.Skill6,
  Action.Skill7,
  Action.Skill8,
  Action.Skill9,
  Action.Skill10,
];

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  [Action.MoveUp]: ["W", "UP"],
  [Action.MoveDown]: ["S", "DOWN"],
  [Action.MoveLeft]: ["A", "LEFT"],
  [Action.MoveRight]: ["D", "RIGHT"],
  [Action.TargetNext]: ["TAB"],
  [Action.ClearTarget]: ["ESC"],
  [Action.Attack]: ["F"],
  [Action.Skill1]: ["ONE"],
  [Action.Skill2]: ["TWO"],
  [Action.Skill3]: ["THREE"],
  [Action.Skill4]: ["FOUR"],
  [Action.Skill5]: ["FIVE"],
  [Action.Skill6]: ["SIX"],
  [Action.Skill7]: ["SEVEN"],
  [Action.Skill8]: ["EIGHT"],
  [Action.Skill9]: ["NINE"],
  [Action.Skill10]: ["ZERO"],
  [Action.Skills]: ["K"],
  [Action.Potion1]: ["Q"],
  [Action.Potion2]: ["R"],
  [Action.ToggleInventory]: ["I", "C"],
  [Action.Interact]: ["E"],
  [Action.Leaderboard]: ["L"],
  [Action.QuestLog]: ["J"],
  [Action.PassiveTree]: ["P"],
  [Action.TownPortal]: ["T"],
  [Action.Minimap]: ["M"],
  [Action.Mount]: ["H"],
  [Action.Sprint]: ["SHIFT"],
  [Action.Friends]: ["O"],
};

// On-screen touch controls (ui/touch.ts) drive the same actions through these.
const virtualAxis: { dx: Axis; dy: Axis } = { dx: 0, dy: 0 };
let virtualHandlers = new Map<Action, (() => void)[]>();

/** While this returns true (game menu open) only Esc works; walking and hotkeys are ignored. */
let inputBlocked: () => boolean = () => false;
/** Actions that still work while input is blocked. */
const ALWAYS_ALLOWED = new Set<Action>([Action.ClearTarget]);

export function setInputBlocker(blocked: () => boolean) {
  inputBlocked = blocked;
}

/** Joystick direction; (0, 0) when released. */
export function setVirtualAxis(dx: Axis, dy: Axis) {
  virtualAxis.dx = dx;
  virtualAxis.dy = dy;
}

/** An on-screen button was tapped: fire the action as if its key was pressed. */
export function pressVirtual(action: Action) {
  if (inputBlocked() && !ALWAYS_ALLOWED.has(action)) return;
  for (const callback of virtualHandlers.get(action) ?? []) callback();
}

export class InputManager {
  private keys = new Map<Action, Phaser.Input.Keyboard.Key[]>();
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin;
  /** Every onPressed callback, so a rebind can hook them up to the new keys. */
  private readonly callbacks = new Map<Action, (() => void)[]>();

  constructor(scene: Phaser.Scene, bindings = DEFAULT_BINDINGS) {
    // One manager per scene; the previous zone's handlers go away with it.
    virtualHandlers = new Map();
    this.keyboard = scene.input.keyboard!;
    this.addKeys(bindings);
  }

  private addKeys(bindings: Record<Action, string[]>) {
    for (const [action, keyNames] of Object.entries(bindings) as [Action, string[]][]) {
      // addKey(..., enableCapture=true) stops arrows from scrolling and Tab from leaving the page.
      this.keys.set(
        action,
        keyNames.map((name) => this.keyboard.addKey(name, true)),
      );
    }
  }

  private listen(action: Action, key: Phaser.Input.Keyboard.Key, callback: () => void) {
    key.on("down", (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
      if (event.repeat || (inputBlocked() && !ALWAYS_ALLOWED.has(action))) return;
      callback();
    });
  }

  /** New key bindings (from the settings page): swap the keys, keep every callback. */
  rebind(bindings: Record<Action, string[]>) {
    for (const keys of this.keys.values()) {
      for (const key of keys) {
        key.removeAllListeners();
        this.keyboard.removeKey(key, true);
      }
    }
    this.keys.clear();
    this.addKeys(bindings);
    for (const [action, callbacks] of this.callbacks) {
      for (const key of this.keys.get(action) ?? []) for (const callback of callbacks) this.listen(action, key, callback);
    }
  }

  isDown(action: Action): boolean {
    return this.keys.get(action)?.some((key) => key.isDown) ?? false;
  }

  /** Fires once per key press (no auto-repeat). */
  onPressed(action: Action, callback: () => void) {
    virtualHandlers.set(action, [...(virtualHandlers.get(action) ?? []), callback]);
    this.callbacks.set(action, [...(this.callbacks.get(action) ?? []), callback]);
    for (const key of this.keys.get(action) ?? []) this.listen(action, key, callback);
  }

  moveAxis(): { dx: Axis; dy: Axis } {
    if (inputBlocked()) return { dx: 0, dy: 0 };
    const dx = (Number(this.isDown(Action.MoveRight)) - Number(this.isDown(Action.MoveLeft))) as Axis;
    const dy = (Number(this.isDown(Action.MoveDown)) - Number(this.isDown(Action.MoveUp))) as Axis;
    if (dx === 0 && dy === 0) return { ...virtualAxis };
    return { dx, dy };
  }
}

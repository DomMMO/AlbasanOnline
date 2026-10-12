import { BINDABLE, bindKey, getBindings, keyLabel, keyNameOf, onBindingsChange, resetBindings } from "../input/keybindings";
import type { Action } from "../input/InputManager";

// Menu → Tuş Atamaları: every rebindable action with its key. Click one, press a key: done.
// Esc cancels; a key already in use moves over (the old action is left without a key).

const listEl = document.getElementById("keybind-list")!;
let capturing: { action: Action; button: HTMLButtonElement } | null = null;

function stopCapture() {
  if (!capturing) return;
  capturing.button.classList.remove("capturing");
  capturing = null;
  window.removeEventListener("keydown", onKey, true);
  render();
}

function onKey(event: KeyboardEvent) {
  if (!capturing) return;
  // Swallow the key: it shouldn't also close the menu or trigger anything.
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.key === "Escape") return stopCapture();
  const name = keyNameOf(event);
  if (!name || name === "ENTER") return;
  bindKey(capturing.action, name);
  stopCapture();
}

function startCapture(action: Action, button: HTMLButtonElement) {
  stopCapture();
  capturing = { action, button };
  button.textContent = "Bir tuşa bas…";
  button.classList.add("capturing");
  window.addEventListener("keydown", onKey, true);
}

function render() {
  const bindings = getBindings();
  listEl.replaceChildren(
    ...BINDABLE.flatMap(({ group, actions }) => [
      Object.assign(document.createElement("h3"), { className: "keybind-group", textContent: group }),
      ...actions.map(([action, label]) => {
        const row = document.createElement("div");
        row.className = "keybind-row";
        const name = Object.assign(document.createElement("span"), { textContent: label });
        const button = document.createElement("button");
        button.type = "button";
        button.className = "keybind-key";
        const keys = bindings[action];
        button.textContent = keys.length > 0 ? keys.map(keyLabel).join(" / ") : "—";
        button.classList.toggle("unbound", keys.length === 0);
        button.addEventListener("click", () => startCapture(action, button));
        row.append(name, button);
        return row;
      }),
    ]),
  );
}

let initialised = false;

export function initKeybindMenu() {
  if (initialised) return;
  initialised = true;
  document.getElementById("keybind-reset")!.addEventListener("click", () => {
    stopCapture();
    resetBindings();
  });
  onBindingsChange(render);
  render();
}

/** Leaving the page (Geri, menu closed) cancels a key capture in progress. */
export function cancelKeyCapture() {
  stopCapture();
}

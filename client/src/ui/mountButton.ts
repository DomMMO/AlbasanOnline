import { horseIconUrl } from "../gfx/horse";
import { getBindings } from "../input/keybindings";
import { Action } from "../input/InputManager";

// The horse button in the bottom right (left of the resource globe): get on or off the horse.

const button = document.getElementById("mount-button") as HTMLButtonElement;
const keyLabel = button.querySelector(".slot-key") as HTMLElement;
let onClick: () => void = () => {};
let initialised = false;

export function initMountButton(click: () => void) {
  onClick = click;
  button.hidden = true;
  if (initialised) return;
  initialised = true;
  (button.querySelector("img") as HTMLImageElement).src = horseIconUrl(2);
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => onClick());
}

/** null hides it (dungeons, arena); otherwise whether we are riding. */
export function setMountButton(state: { mounted: boolean } | null) {
  button.hidden = state === null;
  if (!state) return;
  const key = getBindings()[Action.Mount]?.[0] ?? "";
  keyLabel.textContent = key;
  button.classList.toggle("active", state.mounted);
  button.title = `${state.mounted ? "Attan in" : "Ata bin"}${key ? ` (${key})` : ""}`;
}

// "Balık Tut" / "Oltayı Topla" button at the harbour (shown when you could fish or are fishing).

const button = document.getElementById("fish-button") as HTMLButtonElement;
let onClick: () => void = () => {};
let initialised = false;

export function initFishButton(click: () => void) {
  onClick = click;
  button.hidden = true;
  if (initialised) return;
  initialised = true;
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => onClick());
}

/** null hides it; otherwise whether the line is in the water. */
export function setFishButton(state: { fishing: boolean } | null) {
  button.hidden = state === null;
  if (state) button.textContent = state.fishing ? "Oltayı Topla" : "Balık Tut";
}

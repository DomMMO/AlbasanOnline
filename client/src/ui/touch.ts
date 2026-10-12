import type { Axis } from "../../../shared/src";
import { Action, pressVirtual, setVirtualAxis } from "../input/InputManager";
import { openChat } from "./chat";

// On-screen controls for phones and tablets: a joystick for walking and buttons for
// the actions that otherwise need a keyboard. They feed the same actions as the keys
// (see InputManager), so the game code doesn't know the difference. Tapping mobs,
// NPCs, portals and hotbar slots already works by touch.

const $ = (id: string) => document.getElementById(id)!;

/** Phones and tablets (or ?touch=1 in the address bar for testing on a computer). */
export const isTouchDevice =
  new URLSearchParams(location.search).has("touch") || matchMedia("(pointer: coarse)").matches;

/** Fraction of the joystick radius that counts as "not pushed". */
const DEAD_ZONE = 0.3;
/** Direction component needed to move on that axis (0.38 ≈ allows diagonals). */
const AXIS_THRESHOLD = 0.38;

let initialised = false;

export function initTouchControls() {
  if (initialised || !isTouchDevice) return;
  initialised = true;
  document.body.classList.add("touch");
  $("touch-controls").hidden = false;

  const stick = $("joystick");
  const knob = $("joystick-knob");
  let pointerId: number | null = null;
  const release = () => {
    pointerId = null;
    knob.style.transform = "translate(-50%, -50%)";
    setVirtualAxis(0, 0);
  };
  const move = (event: PointerEvent) => {
    const rect = stick.getBoundingClientRect();
    const radius = rect.width / 2;
    let vx = (event.clientX - (rect.left + radius)) / radius;
    let vy = (event.clientY - (rect.top + radius)) / radius;
    const length = Math.hypot(vx, vy);
    if (length > 1) {
      vx /= length;
      vy /= length;
    }
    knob.style.transform = `translate(calc(-50% + ${vx * radius * 0.6}px), calc(-50% + ${vy * radius * 0.6}px))`;
    if (length < DEAD_ZONE) return setVirtualAxis(0, 0);
    const nx = vx / Math.max(length, 1e-6);
    const ny = vy / Math.max(length, 1e-6);
    const axis = (v: number): Axis => (v > AXIS_THRESHOLD ? 1 : v < -AXIS_THRESHOLD ? -1 : 0);
    setVirtualAxis(axis(nx), axis(ny));
  };
  stick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pointerId = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    move(event);
  });
  stick.addEventListener("pointermove", (event) => {
    if (event.pointerId === pointerId) move(event);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    stick.addEventListener(type, (event) => {
      if (event.pointerId === pointerId) release();
    });
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>("#touch-controls [data-action]")) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.classList.add("pressed");
      pressVirtual(button.dataset.action as Action);
    });
    button.addEventListener("pointerup", () => button.classList.remove("pressed"));
    button.addEventListener("pointerleave", () => button.classList.remove("pressed"));
  }
  $("touch-chat").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    openChat();
  });
}

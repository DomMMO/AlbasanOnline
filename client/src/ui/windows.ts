// Window manager for the in-game windows (every `.window` in the HUD).
// - Keeps them in the order they were opened, so Esc closes the one on top.
// - Clicking a window brings it to the front.
// - Windows can be dragged by their title bar; positions are remembered per window.
// Windows don't need to tell us when they open or close: we watch their `hidden` attribute.

const POSITIONS_KEY = "mmo-window-positions";
const BASE_Z = 10;

/** Open windows, oldest first. */
const stack: HTMLElement[] = [];
/** Per-window close action (clears the window's own state); default is just hiding it. */
const closers = new Map<string, () => void>();
let initialised = false;

function loadPositions(): Record<string, { left: number; top: number }> {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function savePosition(id: string, left: number, top: number) {
  try {
    const positions = loadPositions();
    positions[id] = { left, top };
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // Storage blocked: positions just aren't remembered.
  }
}

function forgetPosition(id: string) {
  try {
    const positions = loadPositions();
    delete positions[id];
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // ignore
  }
}

function restack() {
  stack.forEach((el, i) => (el.style.zIndex = String(BASE_Z + i)));
}

function bringToFront(el: HTMLElement) {
  const index = stack.indexOf(el);
  if (index === -1 || index === stack.length - 1) return;
  stack.splice(index, 1);
  stack.push(el);
  restack();
}

/** Puts a window where it was dragged to last time, kept inside the screen. */
function place(el: HTMLElement, left: number, top: number) {
  const rect = el.getBoundingClientRect();
  const x = Math.max(0, Math.min(left, window.innerWidth - Math.min(rect.width, window.innerWidth)));
  const y = Math.max(0, Math.min(top, window.innerHeight - 40));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.transform = "none";
}

function resetPlacement(el: HTMLElement) {
  for (const prop of ["left", "top", "right", "bottom", "transform"] as const) el.style[prop] = "";
}

function opened(el: HTMLElement) {
  if (!stack.includes(el)) stack.push(el);
  restack();
  const saved = loadPositions()[el.id];
  if (saved && !document.body.classList.contains("touch")) requestAnimationFrame(() => place(el, saved.left, saved.top));
}

function closed(el: HTMLElement) {
  const index = stack.indexOf(el);
  if (index !== -1) stack.splice(index, 1);
}

function makeDraggable(el: HTMLElement) {
  const handle = el.querySelector<HTMLElement>(".window-title");
  if (!handle) return;
  handle.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest("button") || document.body.classList.contains("touch")) return;
    event.preventDefault();
    bringToFront(el);
    const rect = el.getBoundingClientRect();
    const offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    handle.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => place(el, e.clientX - offset.x, e.clientY - offset.y);
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      const r = el.getBoundingClientRect();
      savePosition(el.id, r.left, r.top);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  });
  // Double-click the title: back to the default spot.
  handle.addEventListener("dblclick", (event) => {
    if ((event.target as HTMLElement).closest("button")) return;
    forgetPosition(el.id);
    resetPlacement(el);
  });
}

/** Call once: finds every window, starts watching them. */
export function initWindows() {
  if (initialised) return;
  initialised = true;
  const windows = [...document.querySelectorAll<HTMLElement>("#hud .window")];
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const el = mutation.target as HTMLElement;
      if (el.hidden) closed(el);
      else opened(el);
    }
  });
  for (const el of windows) {
    observer.observe(el, { attributes: true, attributeFilter: ["hidden"] });
    el.addEventListener("pointerdown", () => bringToFront(el));
    makeDraggable(el);
    if (!el.hidden) opened(el);
  }
}

/** How a window closes (resets its state). Registered again by each new scene. */
export function registerWindow(id: string, close: () => void) {
  closers.set(id, close);
}

/** Esc: closes the window on top. Returns false when no window is open. */
export function closeTopWindow(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  const close = closers.get(top.id);
  if (close) close();
  else top.hidden = true;
  // Make sure it is gone even if its close action didn't hide it.
  if (!top.hidden) top.hidden = true;
  closed(top);
  return true;
}

export function anyWindowOpen() {
  return stack.length > 0;
}

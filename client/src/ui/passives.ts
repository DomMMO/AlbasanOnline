import {
  affixLabel,
  AFFIXES,
  ATTRIBUTE_HELP,
  ATTRIBUTE_IDS,
  ATTRIBUTE_NAMES,
  isGreaterSocket,
  ITEMS,
  MINOR_SOCKETS,
  PASSIVE_SOCKETS,
  socketUnlockLevel,
  type InventoryEvent,
  type ItemView,
  type SlotRef,
} from "../../../shared/src";
import { DRAG_TYPE, inventoryState, renderSlot } from "./inventory";
import { hideTooltip, showItemTooltip } from "./tooltip";
import { isTouchDevice } from "./touch";

// Passive tree window (P). The 20 big sockets sit on a ring, one opening per level from 2 to
// 21; sockets 1, 6, 11 and 16 are greater sockets (red, with diamonds) that also take greater jewels.
// Clicking one turns the ring so it comes to the top, and a line links it to its 5 small
// sockets in the middle of the ring: four on a small circle and one in its centre.
// A big socket takes a major (or greater) jewel; with one in, its small sockets take minor jewels.
// Jewels are dragged in from the bags (or right-clicked there); right-click / drag a socketed
// jewel to take it out.

export interface PassiveActions {
  move(from: SlotRef, to: SlotRef): void;
  playerLevel(): number;
}

const $ = (id: string) => document.getElementById(id)!;
const windowEl = $("passive-window");
const ringEl = $("passive-ring");
const summaryEl = $("passive-summary");

/** Ring angle (degrees, 0 = right, clockwise) of big socket i before any turning; socket 0 starts on top. */
const baseAngle = (i: number) => -90 + (360 / PASSIVE_SOCKETS) * i;
/** Small sockets in the middle of the ring, in units of the inner circle's radius: top, left, right, bottom, centre. */
const MINOR_OFFSETS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
  [0, 0],
];

let actions: PassiveActions;
let state: InventoryEvent | null = null;
let selected = 0;
/** Current ring rotation in degrees (accumulates so the ring always takes the short way round). */
let rotation = 0;
let spinEl: HTMLElement;
let infoEl: HTMLElement;
/** The small circle holding the selected socket's small sockets (lights up when the spoke's fill arrives). */
let innerEl: HTMLElement;
let minorLayerEl: HTMLElement;
/** One spoke per big socket, from the socket to the middle; the selected one fills with gold. */
const spokes: HTMLElement[] = [];
/** Positioned wrappers (ring + diamonds) around each big socket. */
const nodes: HTMLElement[] = [];
const majors: HTMLElement[] = [];
const minors: HTMLElement[] = [];
let armed: HTMLElement | null = null;

function itemAt(socket: number, minor: number | null): ItemView | null {
  const entry = state?.passives[socket];
  if (!entry) return null;
  return minor === null ? entry.major : entry.minors[minor];
}

function firstFreeBagSlot(): number {
  const index = inventoryState()?.slots.indexOf(null) ?? -1;
  return index === -1 ? 0 : index;
}

/** Small socket elements always point at the selected big socket. */
const refOf = (socketOf: () => number, minor: number | null): SlotRef => ({ area: "passive", socket: socketOf(), minor });

function makeSocket(socketOf: () => number, minor: number | null, onClick?: () => void): HTMLElement {
  const el = document.createElement("div");
  el.className = `item-slot passive-socket ${minor === null ? "major" : "minor"}`;

  el.addEventListener("dragstart", (event) => {
    if (!itemAt(socketOf(), minor)) return event.preventDefault();
    event.dataTransfer!.setData(DRAG_TYPE, JSON.stringify(refOf(socketOf, minor)));
    event.dataTransfer!.effectAllowed = "move";
    hideTooltip();
  });
  el.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types.includes(DRAG_TYPE)) event.preventDefault();
  });
  el.addEventListener("drop", (event) => {
    event.preventDefault();
    const from = JSON.parse(event.dataTransfer!.getData(DRAG_TYPE)) as SlotRef;
    if (from.area === "inv") actions.move(from, refOf(socketOf, minor));
    onClick?.();
  });

  const takeOut = (event: Event) => {
    event.preventDefault();
    hideTooltip();
    if (itemAt(socketOf(), minor)) actions.move(refOf(socketOf, minor), { area: "inv", index: firstFreeBagSlot() });
  };
  el.addEventListener("contextmenu", takeOut);
  el.addEventListener("dblclick", takeOut);
  el.addEventListener("click", (event) => {
    onClick?.();
    if (!isTouchDevice) return;
    // Touch: first tap selects / shows the tooltip, a second tap on the same socket takes the jewel out.
    if (armed !== el) {
      armed = el;
      return;
    }
    armed = null;
    takeOut(event);
  });

  el.addEventListener("mouseenter", () => {
    const item = itemAt(socketOf(), minor);
    const def = item && ITEMS[item.defId];
    if (item && def) {
      showItemTooltip(def, { affixes: item.affixes, playerLevel: actions.playerLevel(), footer: [{ text: "Sağ tık: çıkar" }] }, el);
    }
  });
  el.addEventListener("mouseleave", hideTooltip);
  return el;
}

export function initPassives(passiveActions: PassiveActions) {
  actions = passiveActions;
  if (majors.length > 0) return;

  const line = document.createElement("div");
  line.className = "passive-ring-line";
  spinEl = document.createElement("div");
  spinEl.className = "passive-spin";
  for (let s = 0; s < PASSIVE_SOCKETS; s++) {
    // The spoke turns with the ring, so the selected one always ends up pointing straight down from the top.
    const spoke = document.createElement("div");
    spoke.className = `passive-spoke${isGreaterSocket(s) ? " greater" : ""}`;
    spoke.style.setProperty("--angle", `${baseAngle(s)}deg`);
    spoke.append(Object.assign(document.createElement("span"), { className: "spoke-fill" }));
    spokes.push(spoke);
    spinEl.append(spoke);

    const node = document.createElement("div");
    node.className = `passive-node${isGreaterSocket(s) ? " greater" : ""}`;
    const angle = (baseAngle(s) * Math.PI) / 180;
    node.style.left = `calc(50% + var(--ring-radius) * ${Math.cos(angle).toFixed(4)})`;
    node.style.top = `calc(50% + var(--ring-radius) * ${Math.sin(angle).toFixed(4)})`;
    // Behind the jewel: the gold that rises inside the selected socket.
    node.append(Object.assign(document.createElement("span"), { className: "node-fill" }));
    for (const side of ["n", "e", "s", "w"]) node.append(Object.assign(document.createElement("span"), { className: `passive-gem ${side}` }));
    const el = makeSocket(() => s, null, () => select(s));
    node.append(el);
    nodes.push(node);
    majors.push(el);
    spinEl.append(node);
  }

  // The selected socket's small sockets: a small circle in the middle, where its spoke arrives.
  const minorLayer = document.createElement("div");
  minorLayer.className = "passive-minor-layer";
  minorLayerEl = minorLayer;
  const inner = document.createElement("div");
  inner.className = "passive-inner";
  innerEl = inner;
  minorLayer.append(inner);
  MINOR_OFFSETS.forEach(([dx, dy], m) => {
    const el = makeSocket(() => selected, m);
    el.style.setProperty("--i", String(m));
    el.style.left = `calc(50% + var(--inner-radius) * ${dx})`;
    el.style.top = `calc(50% + var(--inner-radius) * ${dy})`;
    minors.push(el);
    minorLayer.append(el);
  });

  ringEl.append(line, spinEl, minorLayer);
  infoEl = document.createElement("div");
  infoEl.id = "passive-info";
  ringEl.after(infoEl);
  $("passive-close").addEventListener("click", () => togglePassives(false));
  applyRotation();
}

/** Turns the ring so big socket `s` is on top, and shows its small sockets. */
function select(s: number) {
  if (s === selected && nodes[s].classList.contains("selected")) return;
  const wanted = -90 - baseAngle(s);
  let delta = (wanted - rotation) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  rotation += delta;
  selected = s;
  applyRotation();
  if (state) updatePassives(state);
}

function applyRotation() {
  spinEl.style.transform = `rotate(${rotation}deg)`;
  nodes.forEach((node, s) => {
    // Counter-rotate so the jewels stay upright while the ring turns.
    node.style.transform = `translate(-50%, -50%) rotate(${-rotation}deg)${s === selected ? " scale(1.3)" : ""}`;
    node.classList.toggle("selected", s === selected);
  });
  spokes.forEach((spoke, s) => spoke.classList.toggle("selected", s === selected));
  replayFill();
}

/** The small circle and its small sockets are lit for whichever socket is selected (the gold fades in via CSS). */
function replayFill() {
  innerEl.classList.add("filling");
  minorLayerEl.classList.add("filling");
}

export function updatePassives(event: InventoryEvent) {
  state = event;
  if (majors.length === 0) return;
  const level = actions?.playerLevel() ?? 1;
  event.passives.forEach((entry, s) => {
    const el = majors[s];
    const locked = level < socketUnlockLevel(s);
    renderSlot(el, entry.major);
    el.draggable = !!entry.major;
    el.classList.toggle("locked", locked);
    nodes[s].classList.toggle("locked", locked);
    if (locked) el.dataset.label = `Sv ${socketUnlockLevel(s)}`;
    else delete el.dataset.label;
  });

  const entry = event.passives[selected];
  const locked = level < socketUnlockLevel(selected);
  minors.forEach((el, m) => {
    renderSlot(el, entry?.minors[m]);
    el.draggable = !!entry?.minors[m];
    el.classList.toggle("locked", locked);
    el.classList.toggle("inactive", !locked && !entry?.major);
  });

  // Under the ring: what the selected socket does.
  const greater = isGreaterSocket(selected);
  const lines: string[] = [`<div class="passive-info-title${greater ? " greater" : ""}">${selected + 1}. ${greater ? "Kadim Yuva" : "Yuva"}</div>`];
  if (locked) lines.push(`<div class="muted">Seviye ${socketUnlockLevel(selected)}'de açılır</div>`);
  else if (!entry?.major) {
    lines.push(`<div class="muted">${greater ? "Kadim ya da Büyük Mücevher" : "Büyük Mücevher"} tak: envanterden sürükle ya da sağ tıkla</div>`);
  }
  else {
    for (const affix of entry.major.affixes ?? []) lines.push(`<div class="passive-major-effect">${affixLabel(affix)}</div>`);
    const smalls = entry.minors.flatMap((item) => item?.affixes ?? []).map(affixLabel);
    lines.push(smalls.length > 0 ? `<div>${smalls.join("<br>")}</div>` : `<div class="muted">Küçük slotlara Küçük Mücevher tak</div>`);
  }
  infoEl.innerHTML = lines.join("");
  renderSummary(event);
}

/** Totals of everything socketed, plus the attributes in effect. */
function renderSummary(event: InventoryEvent) {
  const totals = new Map<string, number>();
  for (const entry of event.passives) {
    for (const item of [entry.major, ...entry.minors]) {
      for (const affix of item?.affixes ?? []) totals.set(affix.id, (totals.get(affix.id) ?? 0) + affix.value);
    }
  }
  const attrs = ATTRIBUTE_IDS.map(
    (id) => `<span title="${ATTRIBUTE_HELP[id]}">${ATTRIBUTE_NAMES[id]} <b>${event.stats.attributes[id]}</b></span>`,
  ).join("");
  const effects = [...totals]
    .filter(([id]) => !(ATTRIBUTE_IDS as string[]).includes(id))
    .map(([id, value]) => AFFIXES[id]?.label(value))
    .filter(Boolean);
  const open = Math.max(0, Math.min(PASSIVE_SOCKETS, (actions?.playerLevel() ?? 1) - 1));
  summaryEl.innerHTML = `<div class="passive-attrs">${attrs}</div>`;
  const info = document.createElement("div");
  info.className = "passive-effects";
  info.textContent = effects.length > 0 ? effects.join(" · ") : `Açık slot: ${open}/${PASSIVE_SOCKETS}. Mücevherler yaratıklardan düşer.`;
  summaryEl.append(info);
}

export function togglePassives(open = windowEl.hidden) {
  windowEl.hidden = !open;
  if (open && state) updatePassives(state);
  if (open && nodes.length > 0) replayFill();
  if (!open) hideTooltip();
}

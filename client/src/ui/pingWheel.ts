import type { PingKind } from "../../../shared/src";

// Alt+click on the world opens this wheel at the cursor: four pings around a centre, like the
// LoL / WoW ping wheels. Click one to send it to your party; click anywhere else or Esc to close.

export const PING_STYLES: Record<PingKind, { label: string; icon: string; color: number; css: string }> = {
  alert: { label: "Dikkat!", icon: "!", color: 0xffd43b, css: "#ffd43b" },
  attack: { label: "Saldır!", icon: "⚔", color: 0xff6b6b, css: "#ff6b6b" },
  help: { label: "Yardım lazım!", icon: "✚", color: 0x74c0fc, css: "#74c0fc" },
  move: { label: "Buraya gel!", icon: "➜", color: 0x8ce99a, css: "#8ce99a" },
};

/** Where each option sits around the centre. */
const LAYOUT: [PingKind, string][] = [
  ["alert", "top"],
  ["attack", "right"],
  ["help", "bottom"],
  ["move", "left"],
];

const wheel = document.getElementById("ping-wheel")!;
let onPick: ((kind: PingKind) => void) | null = null;

function close() {
  wheel.hidden = true;
  onPick = null;
  window.removeEventListener("pointerdown", outside, true);
  window.removeEventListener("keydown", escape, true);
}

function outside(event: PointerEvent) {
  if (!wheel.contains(event.target as Node)) close();
}

function escape(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  event.stopImmediatePropagation();
  close();
}

export function openPingWheel(at: MouseEvent, pick: (kind: PingKind) => void) {
  onPick = pick;
  if (wheel.childElementCount === 0) {
    const centre = Object.assign(document.createElement("div"), { className: "ping-centre" });
    wheel.append(centre);
    for (const [kind, side] of LAYOUT) {
      const style = PING_STYLES[kind];
      const button = document.createElement("button");
      button.type = "button";
      button.tabIndex = -1;
      button.className = `ping-option ${side}`;
      button.style.setProperty("--ping", style.css);
      button.innerHTML = `<span class="ping-icon"></span><span class="ping-label"></span>`;
      button.querySelector(".ping-icon")!.textContent = style.icon;
      button.querySelector(".ping-label")!.textContent = style.label;
      button.addEventListener("click", () => {
        onPick?.(kind);
        close();
      });
      wheel.append(button);
    }
  }
  wheel.style.left = `${at.clientX}px`;
  wheel.style.top = `${at.clientY}px`;
  wheel.hidden = false;
  // Wait for this click to finish before listening for the next one.
  setTimeout(() => {
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", escape, true);
  });
}

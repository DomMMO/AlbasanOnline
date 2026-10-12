// The ornate frames around the health and resource globes, in the same dark wood and gold
// as the windows: a wooden back plate with a curled gold wing on the outer side (behind the
// glass), and over it a gold ring with rivets, a gem on top and a wooden plinth for the numbers.

type Side = "left" | "right";

function back(id: string, side: Side): string {
  const mirror = side === "right" ? ` transform="translate(200,0) scale(-1,1)"` : "";
  return `
<svg class="globe-frame back" viewBox="0 0 200 200" aria-hidden="true">
  <defs>
    <radialGradient id="${id}-wood" cx="50%" cy="45%" r="60%">
      <stop offset="0" stop-color="#3a2a1a"/><stop offset="1" stop-color="#140d07"/>
    </radialGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6dd8f"/><stop offset="0.5" stop-color="#c9a24a"/><stop offset="1" stop-color="#6e5320"/>
    </linearGradient>
  </defs>
  <g${mirror}>
    <path d="M30 58 C4 84 2 128 26 162 C20 132 22 100 40 76 Z" fill="url(#${id}-gold)" stroke="#3a2a18" stroke-width="1.5"/>
    <path d="M22 92 C10 112 12 138 26 156 C22 136 22 114 30 98 Z" fill="#6e5320" opacity="0.9"/>
    <path d="M40 36 C24 40 16 50 14 62 C24 54 34 50 46 48 Z" fill="url(#${id}-gold)" stroke="#3a2a18" stroke-width="1.2"/>
  </g>
  <circle cx="100" cy="100" r="95" fill="url(#${id}-wood)" stroke="#6e5320" stroke-width="2"/>
  <circle cx="100" cy="100" r="92" fill="none" stroke="#c9a24a" stroke-width="0.8" opacity="0.5"/>
</svg>`;
}

function front(id: string, gem: [string, string]): string {
  const studs = [45, 135, 225, 315]
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      const x = 100 + Math.cos(a) * 85;
      const y = 100 + Math.sin(a) * 85;
      return `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" transform="rotate(45 ${x} ${y})" fill="#f6dd8f" stroke="#3a2a18" stroke-width="1.2"/>`;
    })
    .join("");
  return `
<svg class="globe-frame front" viewBox="0 0 200 200" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-ring" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6dd8f"/><stop offset="0.45" stop-color="#c9a24a"/><stop offset="1" stop-color="#6e5320"/>
    </linearGradient>
    <radialGradient id="${id}-gem" cx="35%" cy="35%" r="70%">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="${gem[0]}"/><stop offset="1" stop-color="${gem[1]}"/>
    </radialGradient>
    <linearGradient id="${id}-plinth" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a1e13"/><stop offset="1" stop-color="#120c07"/>
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="85" fill="none" stroke="url(#${id}-ring)" stroke-width="10"/>
  <circle cx="100" cy="100" r="90.5" fill="none" stroke="#3a2a18" stroke-width="1.2"/>
  <circle cx="100" cy="100" r="79.5" fill="none" stroke="#3a2a18" stroke-width="1.5"/>
  <circle cx="100" cy="100" r="85" fill="none" stroke="#6e5320" stroke-width="1.4" stroke-dasharray="1.6 7.4"/>
  ${studs}
  <path d="M82 22 L88 6 L100 14 L112 6 L118 22 Z" fill="url(#${id}-ring)" stroke="#3a2a18" stroke-width="1.5"/>
  <circle cx="100" cy="17" r="8" fill="url(#${id}-gem)" stroke="#3a2a18" stroke-width="1.5"/>
  <path d="M44 174 H156 L166 185 L156 196 H44 L34 185 Z" fill="url(#${id}-plinth)" stroke="url(#${id}-ring)" stroke-width="2.5"/>
  <circle cx="40" cy="185" r="2.2" fill="#f6dd8f"/><circle cx="160" cy="185" r="2.2" fill="#f6dd8f"/>
</svg>`;
}

/** Puts the frame layers into a globe element (back plate behind the glass, ring and plinth over it). */
export function installGlobeFrame(globe: HTMLElement, side: Side, gem: [string, string]) {
  if (globe.querySelector(".globe-frame")) return;
  const id = `gf-${globe.id}`;
  globe.insertAdjacentHTML("afterbegin", back(id, side));
  globe.querySelector(".globe-orb")!.insertAdjacentHTML("afterend", front(id, gem));
}

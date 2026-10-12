import { classOf, ZONES, type PartyMemberView, type PartyUpdateEvent, type ZoneId } from "../../../shared/src";

import { registerWindow } from "./windows";

// Party frames (left side, under your own frame) and the invite prompt.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const framesEl = $("party-frames");
const inviteEl = $("party-invite");
const inviteText = $("party-invite-text");

export interface PartyActions {
  /** Click on a member's frame (target them if they're in the same room). */
  select(member: PartyMemberView): void;
  respond(accept: boolean): void;
  leave(): void;
}

let actions: PartyActions;
let initialised = false;
let inviteTimer = 0;

export function initParty(partyActions: PartyActions) {
  actions = partyActions;
  if (initialised) return;
  initialised = true;
  $("party-accept").addEventListener("click", () => answer(true));
  $("party-decline").addEventListener("click", () => answer(false));
  // Esc on the invite declines it.
  registerWindow("party-invite", () => answer(false));
}

function answer(accept: boolean) {
  inviteEl.hidden = true;
  clearTimeout(inviteTimer);
  actions.respond(accept);
}

export function showInvite(from: string) {
  inviteText.textContent = `${from} seni gruba davet ediyor.`;
  inviteEl.hidden = false;
  clearTimeout(inviteTimer);
  inviteTimer = window.setTimeout(() => (inviteEl.hidden = true), 30_000);
}

const pct = (value: number, max: number) => `${max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0}%`;

/** Redraws the frames; `mySession`/`myZone` decide which members are "here". */
export function renderParty(event: PartyUpdateEvent, myCharacterName: string, myZone: ZoneId) {
  const others = event.members.filter((m) => m.name !== myCharacterName);
  framesEl.hidden = event.partyId === null;
  if (event.partyId === null) return framesEl.replaceChildren();

  const rows = others.map((member) => {
    const row = document.createElement("div");
    row.className = `party-member${member.online ? "" : " offline"}${member.dead ? " dead" : ""}`;
    const def = classOf(member.cls);
    const away = member.online && member.zone && member.zone !== myZone ? ZONES[member.zone].name : "";
    row.innerHTML = `
      <div class="pm-title"><span class="pm-name"></span><span class="pm-info"></span></div>
      <div class="bar hp"><div class="fill"></div></div>
      <div class="bar rage${def.resource === "mana" ? " mana" : ""}"><div class="fill"></div></div>`;
    const name = row.querySelector(".pm-name") as HTMLElement;
    name.textContent = `${member.leader ? "♛ " : ""}${member.name}`;
    name.style.color = def.color;
    row.querySelector(".pm-info")!.textContent = !member.online ? "çevrimdışı" : member.dead ? "ölü" : away || `Sv ${member.level}`;
    (row.querySelector(".hp .fill") as HTMLElement).style.width = member.online ? pct(member.hp, member.maxHp) : "0%";
    (row.querySelector(".rage .fill") as HTMLElement).style.width = member.online ? pct(member.resource, member.maxResource) : "0%";
    row.addEventListener("click", () => actions.select(member));
    return row;
  });

  const leave = document.createElement("button");
  leave.className = "party-leave";
  leave.textContent = "Gruptan ayrıl";
  leave.tabIndex = -1;
  leave.addEventListener("mousedown", (e) => e.preventDefault());
  leave.addEventListener("click", () => actions.leave());
  framesEl.replaceChildren(...rows, leave);
}

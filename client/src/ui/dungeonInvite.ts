import { DUNGEON_INVITE_MS } from "../../../shared/src";
import { registerWindow } from "./windows";

// "Your party member went into a dungeon: come along?" (Katıl / Reddet).

const $ = (id: string) => document.getElementById(id)!;
const inviteEl = $("dungeon-invite");
const inviteText = $("dungeon-invite-text");

let respond: (accept: boolean) => void = () => {};
let initialised = false;
let inviteTimer = 0;

export function initDungeonInvite(onRespond: (accept: boolean) => void) {
  respond = onRespond;
  inviteEl.hidden = true;
  if (initialised) return;
  initialised = true;
  $("dungeon-accept").addEventListener("click", () => answer(true));
  $("dungeon-decline").addEventListener("click", () => answer(false));
  // Esc on the prompt declines it.
  registerWindow("dungeon-invite", () => answer(false));
}

function answer(accept: boolean) {
  inviteEl.hidden = true;
  clearTimeout(inviteTimer);
  respond(accept);
}

export function showDungeonInvite(from: string, dungeon: string) {
  inviteText.textContent = `${from}, ${dungeon} zindanına girdi. Sen de grubunla girmek ister misin?`;
  inviteEl.hidden = false;
  clearTimeout(inviteTimer);
  inviteTimer = window.setTimeout(() => (inviteEl.hidden = true), DUNGEON_INVITE_MS);
}

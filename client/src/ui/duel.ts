import { DUEL_INVITE_MS } from "../../../shared/src";
import { registerWindow } from "./windows";

// The duel challenge prompt (Kabul / Reddet).

const $ = (id: string) => document.getElementById(id)!;
const inviteEl = $("duel-invite");
const inviteText = $("duel-invite-text");

let respond: (accept: boolean) => void = () => {};
let initialised = false;
let inviteTimer = 0;

export function initDuel(onRespond: (accept: boolean) => void) {
  respond = onRespond;
  if (initialised) return;
  initialised = true;
  $("duel-accept").addEventListener("click", () => answer(true));
  $("duel-decline").addEventListener("click", () => answer(false));
  // Esc on the challenge declines it.
  registerWindow("duel-invite", () => answer(false));
}

function answer(accept: boolean) {
  inviteEl.hidden = true;
  clearTimeout(inviteTimer);
  respond(accept);
}

export function showDuelInvite(from: string) {
  inviteText.textContent = `${from} seni düelloya davet ediyor.`;
  inviteEl.hidden = false;
  clearTimeout(inviteTimer);
  inviteTimer = window.setTimeout(() => (inviteEl.hidden = true), DUEL_INVITE_MS);
}

import {
  MAX_PARTY_SIZE,
  Msg,
  ZONES,
  type ChatEvent,
  type PartyInviteEvent,
  type PartyMemberView,
  type PartyUpdateEvent,
} from "../../../shared/src";
import { onlineCharacters } from "./registry";

// Parties live outside rooms (members can be in different zones), keyed by character id.
// They exist in memory only: a server restart disbands every party.

interface Party {
  id: string;
  leader: number;
  members: number[];
  /** zone id -> room id of this party's dungeon instance. */
  instances: Map<string, string>;
  /** When the last member went offline (parties nobody is in get disbanded). */
  emptySince: number | null;
}

const parties = new Map<string, Party>();
const partyOfCharacter = new Map<number, string>();
/** invitee character id -> pending invite. */
const invites = new Map<number, { from: number; expiresAt: number }>();
/** Last known name/class, to show offline members. */
const known = new Map<number, { name: string; cls: string; level: number }>();

const INVITE_TTL_MS = 30_000;
const UPDATE_INTERVAL_MS = 500;
const EMPTY_PARTY_TTL_MS = 5 * 60_000;
let nextPartyId = 1;

function send(characterId: number, type: string, message: unknown) {
  const entry = onlineCharacters.get(characterId);
  entry?.game.io.send(entry.sessionId, type, message);
}

function system(characterId: number, text: string) {
  send(characterId, Msg.ChatMessage, { channel: "system", text } satisfies ChatEvent);
}

function nameOf(characterId: number) {
  return onlineCharacters.get(characterId)?.name ?? known.get(characterId)?.name ?? "?";
}

export function partyOf(characterId: number): Party | undefined {
  const id = partyOfCharacter.get(characterId);
  return id ? parties.get(id) : undefined;
}

export function partyIdOf(characterId: number): string | null {
  return partyOfCharacter.get(characterId) ?? null;
}

export function sameParty(a: number, b: number): boolean {
  const party = partyOfCharacter.get(a);
  return a === b || (party !== undefined && party === partyOfCharacter.get(b));
}

function memberView(party: Party, characterId: number): PartyMemberView {
  const entry = onlineCharacters.get(characterId);
  const player = entry?.game.state.players.get(entry.sessionId);
  if (entry && player) {
    known.set(characterId, { name: player.name, cls: player.cls, level: player.level });
    return {
      characterId,
      name: player.name,
      cls: player.cls,
      level: player.level,
      hp: player.hp,
      maxHp: player.maxHp,
      resource: player.resource,
      maxResource: player.maxResource,
      dead: player.dead,
      online: true,
      leader: party.leader === characterId,
      zone: entry.game.zone.id,
      sessionId: entry.sessionId,
    };
  }
  const info = known.get(characterId) ?? { name: "?", cls: "warrior", level: 1 };
  return { characterId, ...info, hp: 0, maxHp: 1, resource: 0, maxResource: 1, dead: false, online: false, leader: party.leader === characterId };
}

function broadcastUpdate(party: Party) {
  const event: PartyUpdateEvent = { partyId: party.id, members: party.members.map((id) => memberView(party, id)) };
  for (const id of party.members) send(id, Msg.PartyUpdate, event);
}

function tellParty(party: Party, text: string) {
  for (const id of party.members) system(id, text);
}

// ---- Commands ------------------------------------------------------------------

export function invite(fromId: number, targetName: string) {
  const target = onlineCharacters.findByName(targetName);
  if (!target) return system(fromId, `${targetName} çevrimiçi değil.`);
  if (target.characterId === fromId) return system(fromId, "Kendini davet edemezsin.");
  if (partyOfCharacter.has(target.characterId)) return system(fromId, `${target.name} zaten bir grupta.`);
  const party = partyOf(fromId);
  if (party && party.leader !== fromId) return system(fromId, "Sadece grup lideri davet edebilir.");
  if (party && party.members.length >= MAX_PARTY_SIZE) return system(fromId, "Grup dolu.");

  invites.set(target.characterId, { from: fromId, expiresAt: Date.now() + INVITE_TTL_MS });
  send(target.characterId, Msg.PartyInvite, { from: nameOf(fromId) } satisfies PartyInviteEvent);
  system(fromId, `${target.name} gruba davet edildi.`);
}

export function respond(characterId: number, accept: boolean) {
  const pending = invites.get(characterId);
  invites.delete(characterId);
  if (!pending || pending.expiresAt < Date.now()) return system(characterId, "Davetin süresi doldu.");
  if (!accept) return system(pending.from, `${nameOf(characterId)} daveti reddetti.`);
  if (partyOfCharacter.has(characterId)) return system(characterId, "Zaten bir gruptasın.");

  let party = partyOf(pending.from);
  if (!party) {
    party = { id: `p${nextPartyId++}`, leader: pending.from, members: [pending.from], instances: new Map(), emptySince: null };
    parties.set(party.id, party);
    partyOfCharacter.set(pending.from, party.id);
  }
  if (party.members.length >= MAX_PARTY_SIZE) return system(characterId, "Grup dolu.");
  party.members.push(characterId);
  partyOfCharacter.set(characterId, party.id);
  // A member already inside a dungeon makes that copy the party's: the others can follow them in.
  for (const id of party.members) {
    const entry = onlineCharacters.get(id);
    if (entry?.game.zone.instanced) registerInstance(id, entry.game.zone.id, entry.roomId);
  }
  tellParty(party, `${nameOf(characterId)} gruba katıldı.`);
  broadcastUpdate(party);
}

export function leave(characterId: number, reason = "gruptan ayrıldı") {
  const party = partyOf(characterId);
  if (!party) return system(characterId, "Bir grupta değilsin.");
  removeFromPartyInstance(party, characterId);
  party.members = party.members.filter((id) => id !== characterId);
  partyOfCharacter.delete(characterId);
  send(characterId, Msg.PartyUpdate, { partyId: null, members: [] } satisfies PartyUpdateEvent);
  system(characterId, "Gruptan ayrıldın.");

  if (party.members.length <= 1) return disband(party);
  const wasLeader = party.leader === characterId;
  if (wasLeader) party.leader = party.members[0];
  tellParty(party, `${nameOf(characterId)} ${reason}.`);
  if (wasLeader) tellParty(party, `Yeni grup lideri: ${nameOf(party.leader)}.`);
  broadcastUpdate(party);
}

export function kick(leaderId: number, targetName: string) {
  const party = partyOf(leaderId);
  if (!party) return system(leaderId, "Bir grupta değilsin.");
  if (party.leader !== leaderId) return system(leaderId, "Sadece grup lideri atabilir.");
  const target = party.members.find((id) => nameOf(id).toLocaleLowerCase("tr-TR") === targetName.toLocaleLowerCase("tr-TR"));
  if (target === undefined || target === leaderId) return system(leaderId, `${targetName} grupta değil.`);
  leave(target, "gruptan atıldı");
}

export function partyChat(characterId: number, text: string) {
  const party = partyOf(characterId);
  if (!party) return system(characterId, "Bir grupta değilsin.");
  const entry = onlineCharacters.get(characterId);
  const player = entry?.game.state.players.get(entry.sessionId);
  for (const id of party.members) {
    send(id, Msg.ChatMessage, { channel: "party", text, from: nameOf(characterId), fromClass: player?.cls } satisfies ChatEvent);
  }
}

function disband(party: Party) {
  for (const id of party.members) {
    partyOfCharacter.delete(id);
    send(id, Msg.PartyUpdate, { partyId: null, members: [] } satisfies PartyUpdateEvent);
    system(id, "Grup dağıldı.");
  }
  parties.delete(party.id);
}

// ---- Dungeon instances -----------------------------------------------------------

/**
 * Someone leaving the party (or kicked) can't stay in the party's dungeon copy: they are
 * sent out through the dungeon's exit, back in front of its entrance.
 */
function removeFromPartyInstance(party: Party, characterId: number) {
  const entry = onlineCharacters.get(characterId);
  const zone = entry?.game.zone;
  if (!entry || !zone?.instanced || party.instances.get(zone.id) !== entry.roomId) return;
  const exit = zone.portals.find((p) => p.style === "exit" && !p.requiresClear) ?? zone.portals.find((p) => p.style === "exit");
  if (!exit) return;
  system(characterId, `Gruptan ayrıldığın için ${ZONES[zone.id].name} terk edildi.`);
  entry.game.io.evict(entry.sessionId, exit.to);
}

/** The party's open instance of a zone, if any. */
export function instanceFor(characterId: number, zone: string): string | undefined {
  return partyOf(characterId)?.instances.get(zone);
}

export function registerInstance(characterId: number, zone: string, roomId: string) {
  const party = partyOf(characterId);
  if (party && !party.instances.has(zone)) party.instances.set(zone, roomId);
}

export function forgetInstance(roomId: string) {
  for (const party of parties.values()) {
    for (const [zone, id] of party.instances) if (id === roomId) party.instances.delete(zone);
  }
}

/** Show the party to a member who just came online (or changed zone). */
export function refreshFor(characterId: number) {
  const party = partyOf(characterId);
  if (party) broadcastUpdate(party);
}

// Live health/mana for party frames, and cleanup of parties nobody is in.
setInterval(() => {
  const now = Date.now();
  for (const party of parties.values()) {
    const anyoneOnline = party.members.some((id) => onlineCharacters.get(id));
    if (anyoneOnline) {
      party.emptySince = null;
      broadcastUpdate(party);
    } else {
      party.emptySince ??= now;
      if (now - party.emptySince > EMPTY_PARTY_TTL_MS) disband(party);
    }
  }
  for (const [id, pending] of invites) if (pending.expiresAt < now) invites.delete(id);
}, UPDATE_INTERVAL_MS).unref();

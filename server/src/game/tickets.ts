import { randomBytes } from "node:crypto";
import type { ZoneId } from "../../../shared/src";

// One-time passes for entering a zone through a portal. Issued when a player uses a
// portal in-game, so nobody can open a dungeon room (or skip ahead to another zone)
// without walking to it.

const TICKET_TTL_MS = 30_000;

interface Ticket {
  characterId: number;
  zone: ZoneId;
  /** Where to place the character in the destination zone, if the portal says so. */
  arriveAt?: { x: number; y: number };
  expiresAt: number;
}

const tickets = new Map<string, Ticket>();

export function issueTicket(characterId: number, zone: ZoneId, arriveAt?: { x: number; y: number }): string {
  const ticket = randomBytes(16).toString("hex");
  tickets.set(ticket, { characterId, zone, arriveAt, expiresAt: Date.now() + TICKET_TTL_MS });
  return ticket;
}

/** Valid once, for the character and zone it was issued for. Returns the ticket, or null. */
export function consumeTicket(ticket: string, characterId: number, zone: ZoneId): Ticket | null {
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  for (const [key, value] of tickets) if (value.expiresAt < Date.now()) tickets.delete(key);
  return entry && entry.characterId === characterId && entry.zone === zone && entry.expiresAt >= Date.now() ? entry : null;
}

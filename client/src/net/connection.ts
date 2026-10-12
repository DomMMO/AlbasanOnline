import { Client, type Room } from "colyseus.js";
import { SERVER_PORT, ZONES, type JoinOptions, type ZoneId } from "../../../shared/src";

// VITE_SERVER_URL overrides this. In production the game server also serves the page,
// so we connect to the page's own origin; in dev the server runs on the same host as
// the page on its own port, which also makes LAN/phone testing work.
const WS_PROTOCOL = location.protocol === "https:" ? "wss" : "ws";
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.DEV
    ? `${WS_PROTOCOL}://${location.hostname}:${SERVER_PORT}`
    : `${WS_PROTOCOL}://${location.host}`);

const client = new Client(SERVER_URL);

/**
 * Joins a zone's room. Shared zones are joined; instanced zones get a new room, unless
 * `roomId` names the instance your party is already in.
 */
export async function joinZone(zone: ZoneId, options: JoinOptions, roomId?: string): Promise<Room> {
  if (roomId) return client.joinById(roomId, options);
  return ZONES[zone].instanced ? client.create(zone, options) : client.joinOrCreate(zone, options);
}

import { collides, HOME_ZONE, TILE_SIZE, TOWN_SPOTS, zoneLayout, type ZoneId } from "../../../shared/src";

// Town portals (T): a player opens one wherever they stand; it leads to town, and town gets
// a matching portal back to that exact spot. The pair stays until the player enters some
// other map or logs out. A dungeon instance with a portal into it is kept alive meanwhile.

export interface TownPortalEntry {
  characterId: number;
  owner: string;
  zone: ZoneId;
  /** The room it was opened in (instances are matched by room, shared zones by zone). */
  roomId: string;
  x: number;
  y: number;
  /** Where the way back stands in town (and where the owner arrives there). */
  townSpot: { x: number; y: number };
}

/** A portal as one room shows it. */
export interface PortalPlacement {
  key: string;
  entry: TownPortalEntry;
  /** true = the town end (leads back out); false = the far end (leads to town). */
  back: boolean;
  x: number;
  y: number;
}

const portals = new Map<number, TownPortalEntry>();
const listeners = new Set<() => void>();

/** Rooms call this to hear about portals opening and closing. Returns the unsubscribe function. */
export function onTownPortalsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed() {
  for (const listener of listeners) listener();
}

/** Spread the town ends around the plaza so several players' portals don't overlap. */
function townSpotFor(characterId: number) {
  const map = zoneLayout(HOME_ZONE).map;
  const angle = ((characterId * 137) % 360) * (Math.PI / 180);
  for (const radius of [TILE_SIZE * 3, TILE_SIZE * 2, TILE_SIZE * 4]) {
    const spot = { x: TOWN_SPOTS.spawn.x + Math.cos(angle) * radius, y: TOWN_SPOTS.spawn.y + Math.sin(angle) * radius };
    if (!collides(map, spot.x, spot.y)) return spot;
  }
  return { ...TOWN_SPOTS.spawn };
}

export function openTownPortal(entry: Omit<TownPortalEntry, "townSpot">) {
  portals.set(entry.characterId, { ...entry, townSpot: townSpotFor(entry.characterId) });
  changed();
}

export function closeTownPortal(characterId: number) {
  if (portals.delete(characterId)) changed();
}

export function townPortalOf(characterId: number): TownPortalEntry | undefined {
  return portals.get(characterId);
}

/** Is this room (zone + instance) where the portal was opened? */
export function isPortalRoom(entry: TownPortalEntry, zone: ZoneId, roomId: string, instanced: boolean) {
  return entry.zone === zone && (!instanced || entry.roomId === roomId);
}

/** Every portal end that stands in this room. */
export function portalsIn(zone: ZoneId, roomId: string, instanced: boolean): PortalPlacement[] {
  const placed: PortalPlacement[] = [];
  for (const entry of portals.values()) {
    if (isPortalRoom(entry, zone, roomId, instanced)) placed.push({ key: `${entry.characterId}:out`, entry, back: false, x: entry.x, y: entry.y });
    if (zone === HOME_ZONE) placed.push({ key: `${entry.characterId}:back`, entry, back: true, ...entry.townSpot });
  }
  return placed;
}

/** A dungeon instance must stay open while a portal leads into it. */
export function roomHasPortal(roomId: string): boolean {
  for (const entry of portals.values()) if (entry.roomId === roomId) return true;
  return false;
}

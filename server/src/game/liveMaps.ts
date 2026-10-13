import type { ZoneId } from "../../../shared/src";

// Running rooms that want to hear when the map editor saves (or resets) their zone, so the
// map changes while players are in it instead of on the next room.

type Listener = (zone: ZoneId) => void;
const listeners = new Set<Listener>();

/** Registers a room; returns the unsubscribe for its dispose. */
export function onZoneMapChanged(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function zoneMapChanged(zone: ZoneId) {
  for (const listener of listeners) {
    try {
      listener(zone);
    } catch (error) {
      console.error("[maps] live reload failed", error);
    }
  }
}

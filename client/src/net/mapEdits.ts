import { setZoneEdits, type MapEdits, type ZoneId } from "../../../shared/src";

// Map editor changes (GM "Harita Editörü"): fetched when entering a zone and laid over the
// generated map before the scene is built, exactly as the server does, so walls agree.
// A failed fetch just means the generated map.

export async function loadZoneEdits(zone: ZoneId) {
  try {
    const response = await fetch(`/api/maps/${zone}`);
    if (!response.ok) return;
    const { edits } = (await response.json()) as { edits: MapEdits | null };
    setZoneEdits(zone, edits);
  } catch {
    // Offline or old server: keep the generated map.
  }
}

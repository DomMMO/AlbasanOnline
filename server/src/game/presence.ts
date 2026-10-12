// Tracks which characters are in the world (across all rooms in this process),
// so the same character can't be played twice at once.

interface Entry {
  kick: () => void;
  released: Promise<void>;
}

const online = new Map<number, Entry>();
const RELEASE_TIMEOUT_MS = 5000;

/**
 * Claims a character for a new connection. If it is already online, the old
 * connection is kicked and we wait for it to save before continuing, so the new
 * session loads the latest data. Call the returned function after the final save.
 */
export async function claimCharacter(characterId: number, kick: () => void): Promise<() => void> {
  const existing = online.get(characterId);
  if (existing) {
    existing.kick();
    await Promise.race([existing.released, new Promise((resolve) => setTimeout(resolve, RELEASE_TIMEOUT_MS))]);
  }

  let resolveReleased!: () => void;
  const released = new Promise<void>((resolve) => (resolveReleased = resolve));
  online.set(characterId, { kick, released });

  return () => {
    if (online.get(characterId)?.released === released) online.delete(characterId);
    resolveReleased();
  };
}

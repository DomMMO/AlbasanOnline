import type { Game } from "./Game";

// Which characters are currently in a world, and where. Lets code outside a
// room reach a player: GM tools over HTTP (changing live state instead of the
// database, which the player's next save would overwrite), cross-zone chat.

export interface OnlineEntry {
  characterId: number;
  game: Game;
  sessionId: string;
  name: string;
  /** Id of the room (zone or dungeon instance) the character is in. */
  roomId: string;
}

const online = new Map<number, OnlineEntry>();

export const onlineCharacters = {
  set: (characterId: number, entry: OnlineEntry) => online.set(characterId, entry),
  get: (characterId: number) => online.get(characterId),
  delete: (characterId: number, sessionId: string) => {
    if (online.get(characterId)?.sessionId === sessionId) online.delete(characterId);
  },
  all: () => online.values(),
  /** [characterId, entry] pairs. */
  entries: () => online.entries(),
  findByName: (name: string) => {
    const wanted = name.toLocaleLowerCase("tr-TR");
    for (const entry of online.values()) if (entry.name.toLocaleLowerCase("tr-TR") === wanted) return entry;
    return undefined;
  },
};

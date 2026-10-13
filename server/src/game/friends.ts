import { MAX_FRIENDS, Msg, type ChatEvent, type FriendListEvent, type FriendView } from "../../../shared/src";
import * as db from "../db/friends";
import { onlineCharacters } from "./registry";

// Friends. Lists and requests live in the database, so a request can go to someone who is
// offline; who is online, and where, comes from the registry. Friends hear when you log in
// or out, but not when you merely change zones (you leave one room and join the next).

/** Characters whose friends were told they are online. */
const announced = new Set<number>();
/** Leaving a room for this long without joining another counts as logging out. */
const LOGOUT_GRACE_MS = 4000;

function send(characterId: number, type: string, message: unknown) {
  const entry = onlineCharacters.get(characterId);
  entry?.game.io.send(entry.sessionId, type, message);
}

function system(characterId: number, text: string) {
  send(characterId, Msg.ChatMessage, { channel: "system", text } satisfies ChatEvent);
}

async function nameOf(characterId: number): Promise<string> {
  return onlineCharacters.get(characterId)?.name ?? db.characterName(characterId);
}

function view(row: db.FriendRow): FriendView {
  const entry = onlineCharacters.get(row.characterId);
  const player = entry?.game.state.players.get(entry.sessionId);
  return { characterId: row.characterId, name: row.name, cls: row.cls, level: player?.level ?? row.level, online: !!entry, zone: entry?.game.zone.id };
}

/** Database work started from a player's action; a failure is logged and told to them. */
function run(characterId: number, task: () => Promise<unknown>) {
  task().catch((error) => {
    console.error("[friends]", error);
    system(characterId, "Arkadaş işlemi yapılamadı, sonra tekrar dene.");
  });
}

export async function sendFriendList(characterId: number) {
  if (!onlineCharacters.get(characterId)) return;
  const lists = await db.loadFriendLists(characterId);
  // Online friends first, each group alphabetical (the query already sorted by name).
  const friends = lists.friends.map(view).sort((a, b) => Number(b.online) - Number(a.online));
  send(characterId, Msg.FriendList, { friends, incoming: lists.incoming.map(view), outgoing: lists.outgoing.map(view) } satisfies FriendListEvent);
}

async function accept(fromId: number, toId: number) {
  if ((await db.countFriendships(toId)) >= MAX_FRIENDS) return system(toId, `Arkadaş listen dolu (en fazla ${MAX_FRIENDS}).`);
  if (!(await db.acceptRequest(fromId, toId))) return system(toId, "Bu istek artık geçerli değil.");
  const [fromName, toName] = await Promise.all([nameOf(fromId), nameOf(toId)]);
  system(toId, `${fromName} artık arkadaşın.`);
  system(fromId, `${toName} arkadaşlık isteğini kabul etti.`);
  await Promise.all([sendFriendList(fromId), sendFriendList(toId)]);
}

export function requestFriend(fromId: number, rawName: string) {
  run(fromId, async () => {
    const name = rawName.trim();
    if (!name) return;
    const target = await db.findCharacterByName(name);
    if (!target) return system(fromId, `${name} adında bir karakter yok.`);
    if (target.id === fromId) return system(fromId, "Kendini arkadaş olarak ekleyemezsin.");
    const mine = await db.friendshipStatus(fromId, target.id);
    if (mine === "accepted") return system(fromId, `${target.name} zaten arkadaşın.`);
    if (mine === "pending") return system(fromId, `${target.name} kişisine zaten istek gönderdin.`);
    // They already asked us: asking back is the same as saying yes.
    if ((await db.friendshipStatus(target.id, fromId)) === "pending") return accept(target.id, fromId);
    if ((await db.countFriendships(fromId)) >= MAX_FRIENDS) return system(fromId, `Arkadaş listen dolu (en fazla ${MAX_FRIENDS}).`);
    await db.insertRequest(fromId, target.id);
    system(fromId, `${target.name} kişisine arkadaşlık isteği gönderildi.`);
    system(target.id, `${await nameOf(fromId)} sana arkadaşlık isteği gönderdi (O: Arkadaşlar).`);
    await Promise.all([sendFriendList(fromId), sendFriendList(target.id)]);
  });
}

export function respondFriend(characterId: number, fromId: number, yes: boolean) {
  run(characterId, async () => {
    if (yes) return accept(fromId, characterId);
    // Declining only ever removes a pending request, never a friendship.
    if ((await db.friendshipStatus(fromId, characterId)) !== "pending" || (await db.friendshipStatus(characterId, fromId)) !== null) return;
    await db.deleteFriendship(fromId, characterId);
    await sendFriendList(characterId);
    await sendFriendList(fromId);
  });
}

export function removeFriend(characterId: number, otherId: number) {
  run(characterId, async () => {
    const wasFriend = (await db.friendshipStatus(characterId, otherId)) === "accepted";
    if (!(await db.deleteFriendship(characterId, otherId))) return;
    if (wasFriend) system(characterId, `${await nameOf(otherId)} arkadaş listenden çıkarıldı.`);
    await Promise.all([sendFriendList(characterId), sendFriendList(otherId)]);
  });
}

/** Joined a room: send the list, and refresh friends' lists (their zone column changed). */
export function friendJoined(characterId: number, name: string) {
  const loggedIn = !announced.has(characterId);
  announced.add(characterId);
  run(characterId, async () => {
    await sendFriendList(characterId);
    for (const id of await db.friendIds(characterId)) {
      if (!onlineCharacters.get(id)) continue;
      if (loggedIn) system(id, `${name} çevrimiçi oldu.`);
      await sendFriendList(id);
    }
  });
}

/** Left a room; if they don't show up in another one soon, they logged out. */
export function friendLeft(characterId: number, name: string) {
  setTimeout(() => {
    if (onlineCharacters.get(characterId) || !announced.delete(characterId)) return;
    db.friendIds(characterId)
      .then(async (ids) => {
        for (const id of ids) {
          if (!onlineCharacters.get(id)) continue;
          system(id, `${name} çevrimdışı oldu.`);
          await sendFriendList(id);
        }
      })
      .catch((error) => console.error("[friends]", error));
  }, LOGOUT_GRACE_MS).unref();
}

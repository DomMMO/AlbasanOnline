import { classOf, ZONES, type FriendListEvent, type FriendView } from "../../../shared/src";

// Friends window (O): add someone by name, answer requests, and see who is online and
// where. Whisper and party invite go through the usual chat commands.

export interface FriendsActions {
  request(name: string): void;
  respond(characterId: number, accept: boolean): void;
  remove(characterId: number): void;
  whisper(name: string): void;
  invite(name: string): void;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const windowEl = $("friends-window");
const bodyEl = $("friends-body");
const nameInput = $<HTMLInputElement>("friends-name");

let actions: FriendsActions;
let state: FriendListEvent = { friends: [], incoming: [], outgoing: [] };
let initialised = false;
const listeners = new Set<() => void>();

export function initFriends(friendActions: FriendsActions) {
  actions = friendActions;
  if (initialised) return;
  initialised = true;
  $("friends-close").addEventListener("click", () => toggleFriends(false));
  $("friends-add").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    actions.request(name);
    nameInput.value = "";
    nameInput.blur();
  });
  // Typing a name must not walk the character or fire hotkeys.
  nameInput.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") nameInput.blur();
  });
  windowEl.addEventListener("mousedown", (event) => {
    if ((event.target as HTMLElement).tagName === "BUTTON") event.preventDefault();
  });
}

export function setFriendList(event: FriendListEvent) {
  state = event;
  if (!windowEl.hidden) render();
  for (const listener of listeners) listener();
}

/** Called whenever the list changes (the target frame hides "Arkadaş ekle" for friends). */
export function onFriendsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Already a friend, or a request is pending either way. */
export function isFriendOrPending(name: string): boolean {
  const wanted = name.toLocaleLowerCase("tr-TR");
  return [...state.friends, ...state.incoming, ...state.outgoing].some((f) => f.name.toLocaleLowerCase("tr-TR") === wanted);
}

function button(label: string, title: string, onClick: () => void, className = "") {
  const el = Object.assign(document.createElement("button"), { type: "button", tabIndex: -1, textContent: label, title, className });
  el.addEventListener("click", onClick);
  return el;
}

function row(friend: FriendView, info: string, buttons: HTMLElement[]) {
  const el = document.createElement("div");
  el.className = `friend-row ${friend.online ? "online" : "offline"}`;
  const dot = Object.assign(document.createElement("span"), { className: "friend-dot", title: friend.online ? "Çevrimiçi" : "Çevrimdışı" });
  const text = document.createElement("span");
  text.className = "friend-text";
  const name = Object.assign(document.createElement("b"), { textContent: friend.name });
  name.style.color = classOf(friend.cls).color;
  text.append(name, Object.assign(document.createElement("span"), { className: "friend-info", textContent: info }));
  el.append(dot, text, ...buttons);
  return el;
}

function render() {
  const section = (title: string) => Object.assign(document.createElement("h3"), { className: "friends-section", textContent: title });
  const children: HTMLElement[] = [];

  if (state.incoming.length > 0) {
    children.push(section("Gelen istekler"));
    for (const f of state.incoming) {
      children.push(
        row(f, `Sv ${f.level}`, [
          button("✓", "Kabul et", () => actions.respond(f.characterId, true)),
          button("✕", "Reddet", () => actions.respond(f.characterId, false), "remove"),
        ]),
      );
    }
  }

  const online = state.friends.filter((f) => f.online).length;
  children.push(section(`Arkadaşlar (${online}/${state.friends.length})`));
  if (state.friends.length === 0) {
    children.push(
      Object.assign(document.createElement("p"), {
        className: "muted friends-empty",
        textContent: "Henüz arkadaşın yok. Yukarıya bir karakter adı yaz ya da bir oyuncuyu hedefleyip \"Arkadaş ekle\"ye bas.",
      }),
    );
  }
  for (const f of state.friends) {
    const where = f.online ? (f.zone ? ZONES[f.zone].name : "") : "çevrimdışı";
    const buttons = f.online
      ? [button("✉", "Fısılda", () => actions.whisper(f.name)), button("+", "Gruba davet et", () => actions.invite(f.name))]
      : [];
    buttons.push(
      button(
        "×",
        "Arkadaşlıktan çıkar",
        () => {
          if (confirm(`${f.name} arkadaş listenden çıkarılsın mı?`)) actions.remove(f.characterId);
        },
        "remove",
      ),
    );
    children.push(row(f, `Sv ${f.level}${where ? ` · ${where}` : ""}`, buttons));
  }

  if (state.outgoing.length > 0) {
    children.push(section("Gönderilen istekler"));
    for (const f of state.outgoing) {
      children.push(row({ ...f, online: false }, "yanıt bekleniyor", [button("×", "İsteği geri çek", () => actions.remove(f.characterId), "remove")]));
    }
  }
  bodyEl.replaceChildren(...children);
}

export function toggleFriends(open = windowEl.hidden) {
  windowEl.hidden = !open;
  if (open) render();
  else nameInput.blur();
}

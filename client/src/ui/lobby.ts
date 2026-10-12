import type { Room } from "colyseus.js";
import {
  CLASS_IDS,
  CLASSES,
  classOf,
  loginZone,
  MAX_CHARACTERS_PER_ACCOUNT,
  type ClassId,
  validateCharacterName,
  validatePassword,
  validateUsername,
  type CharacterSummary,
  type ZoneId,
} from "../../../shared/src";
import { api, getToken } from "../net/api";
import { joinZone } from "../net/connection";

// Login -> character select -> join. Resolves with the joined world room and the character id.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const authForm = $<HTMLFormElement>("auth");
const usernameInput = $<HTMLInputElement>("username");
const passwordInput = $<HTMLInputElement>("password");
const registerButton = $<HTMLButtonElement>("register-btn");
const authError = $("auth-error");

const charactersPanel = $("characters");
const accountName = $("account-name");
const characterList = $("character-list");
const createForm = $<HTMLFormElement>("create-character");
const classPicker = $("class-picker");
let chosenClass: ClassId = "warrior";

/** One card per class; the chosen one is highlighted. */
function renderClassPicker() {
  classPicker.replaceChildren(
    ...CLASS_IDS.map((id) => {
      const def = CLASSES[id];
      const card = document.createElement("button");
      card.type = "button";
      card.className = `class-card${id === chosenClass ? " active" : ""}`;
      card.style.setProperty("--class-color", def.color);
      card.innerHTML = `<b></b><span></span>`;
      card.querySelector("b")!.textContent = def.name;
      card.querySelector("span")!.textContent = def.description;
      card.addEventListener("click", () => {
        chosenClass = id;
        renderClassPicker();
      });
      return card;
    }),
  );
}
const characterNameInput = $<HTMLInputElement>("character-name");
const charactersError = $("characters-error");
const logoutButton = $<HTMLButtonElement>("logout");
const gmLink = $("gm-link");

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function setBusy(container: HTMLElement, busy: boolean) {
  container.querySelectorAll("button, input").forEach((el) => ((el as HTMLButtonElement).disabled = busy));
}

type LobbyResult = { room: Room; characterId: number; zone: ZoneId };

/** Resolves the current runLobby() call once a character enters the world. */
let resolveRoom: ((result: LobbyResult) => void) | null = null;
let listenersAttached = false;

function showAuth(error = "") {
  charactersPanel.hidden = true;
  authForm.hidden = false;
  authError.textContent = error;
  (usernameInput.value ? passwordInput : usernameInput).focus();
}

async function showCharacters(username: string) {
  authForm.hidden = true;
  charactersPanel.hidden = false;
  accountName.textContent = `Hesap: ${username}`;
  charactersError.textContent = "";
  gmLink.hidden = true;
  api
    .me()
    .then((me) => (gmLink.hidden = !me.isAdmin))
    .catch(() => {});
  try {
    renderCharacters(await api.listCharacters());
  } catch (error) {
    showAuth(messageOf(error));
  }
}

function renderCharacters(characters: CharacterSummary[]) {
  characterList.replaceChildren(
    ...characters.map((character) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "character";
      button.innerHTML = `<span></span><span class="lvl">Sv ${character.level} ${classOf(character.class).name}</span>`;
      button.firstElementChild!.textContent = character.name;
      button.addEventListener("click", () => enter(character));
      return button;
    }),
  );
  if (characters.length === 0) characterList.innerHTML = `<p class="muted">Henüz karakterin yok. Bir tane oluştur.</p>`;
  createForm.hidden = characters.length >= MAX_CHARACTERS_PER_ACCOUNT;
  classPicker.hidden = createForm.hidden;
  renderClassPicker();
  if (!createForm.hidden) characterNameInput.focus();
}

async function enter(character: CharacterSummary) {
  setBusy(charactersPanel, true);
  charactersError.textContent = "";
  try {
    // Back where the character logged out: the town or the hunting grounds.
    const zone = loginZone(character.zone);
    const room = await joinZone(zone, { token: getToken()!, characterId: character.id });
    charactersPanel.hidden = true;
    resolveRoom?.({ room, characterId: character.id, zone });
    resolveRoom = null;
  } catch (error) {
    charactersError.textContent = messageOf(error) || "Oyuna girilemedi";
  } finally {
    setBusy(charactersPanel, false);
  }
}

async function authenticate(mode: "login" | "register") {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (mode === "register") {
    const invalid = validateUsername(username) ?? validatePassword(password);
    if (invalid) return void (authError.textContent = invalid);
  }
  setBusy(authForm, true);
  authError.textContent = "";
  try {
    const result = mode === "login" ? await api.login(username, password) : await api.register(username, password);
    passwordInput.value = "";
    await showCharacters(result.username);
  } catch (error) {
    authError.textContent = messageOf(error);
  } finally {
    setBusy(authForm, false);
  }
}

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void authenticate("login");
  });
  registerButton.addEventListener("click", () => void authenticate("register"));

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = characterNameInput.value.trim();
    const invalid = validateCharacterName(name);
    if (invalid) return void (charactersError.textContent = invalid);
    setBusy(charactersPanel, true);
    try {
      await api.createCharacter(name, chosenClass);
      characterNameInput.value = "";
      charactersError.textContent = "";
      renderCharacters(await api.listCharacters());
    } catch (error) {
      charactersError.textContent = messageOf(error);
    } finally {
      setBusy(charactersPanel, false);
    }
  });

  logoutButton.addEventListener("click", async () => {
    await api.logout();
    showAuth();
  });
}

/** Shows login / character select. Can be called again after leaving the game (character switch, logout). */
export function runLobby(): Promise<LobbyResult> {
  attachListeners();
  return new Promise((resolve) => {
    resolveRoom = resolve;
    // Remembered session: skip straight to character select.
    if (getToken()) {
      api
        .me()
        .then((me) => showCharacters(me.username))
        .catch(() => showAuth());
    } else {
      showAuth();
    }
  });
}

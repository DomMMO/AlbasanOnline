import type Phaser from "phaser";
import type { Room } from "colyseus.js";
import {
  classOf,
  DEFAULT_LOOK,
  GENDER_NAMES,
  GENDERS,
  HAIR_COLORS,
  HAIR_STYLE_NAMES,
  HAIR_STYLES,
  loginZone,
  MAX_CHARACTERS_PER_ACCOUNT,
  SKIN_COLORS,
  TUNIC_COLORS,
  validateCharacterName,
  validatePassword,
  validateUsername,
  ZONES,
  type CharacterLook,
  type CharacterSummary,
  type Gender,
  type ZoneId,
} from "../../../shared/src";
import { api, getToken } from "../net/api";
import { joinZone } from "../net/connection";
import { lobbyScene, stopLobbyScene, type LobbyScene } from "../scenes/LobbyScene";

// Login -> character select -> join. Resolves with the joined world room and the character id.
// Character select and creation happen in front of the keep (scenes/LobbyScene.ts): the
// characters stand there in full gear; these panels only hold the details and the buttons.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const authForm = $<HTMLFormElement>("auth");
const usernameInput = $<HTMLInputElement>("username");
const passwordInput = $<HTMLInputElement>("password");
const registerButton = $<HTMLButtonElement>("register-btn");
const authError = $("auth-error");

const charactersPanel = $("characters");
const accountName = $("account-name");
const infoBox = $("character-info");
const noCharacters = $("no-characters");
const playButton = $<HTMLButtonElement>("play-btn");
const newButton = $<HTMLButtonElement>("new-character-btn");
const deleteButton = $<HTMLButtonElement>("delete-character-btn");
const deleteConfirm = $("delete-confirm");
const deleteInput = $<HTMLInputElement>("delete-input");
const charactersError = $("characters-error");
const logoutButton = $<HTMLButtonElement>("logout");
const gmLink = $("gm-link");

const createPanel = $<HTMLFormElement>("create-panel");
const characterNameInput = $<HTMLInputElement>("character-name");
const genderPicker = $("gender-picker");
const hairName = $("hair-name");
const createError = $("create-error");

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function setBusy(container: HTMLElement, busy: boolean) {
  container.querySelectorAll("button, input").forEach((el) => ((el as HTMLButtonElement).disabled = busy));
}

type LobbyResult = { room: Room; characterId: number; zone: ZoneId };

/** Resolves the current runLobby() call once a character enters the world. */
let resolveRoom: ((result: LobbyResult) => void) | null = null;
let listenersAttached = false;
let game: Phaser.Game;
let scene: LobbyScene;
let username = "";
let characters: CharacterSummary[] = [];
let selectedId: number | null = null;

// The character being made.
let look: CharacterLook = { ...DEFAULT_LOOK };
let tunic = TUNIC_COLORS[0];

function formatPlayTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} dakika`;
  const hours = Math.floor(minutes / 60);
  return `${hours} saat ${minutes % 60} dakika`;
}

// ---- Login -------------------------------------------------------------------------

function showAuth(error = "") {
  charactersPanel.hidden = true;
  createPanel.hidden = true;
  authForm.hidden = false;
  authError.textContent = error;
  scene?.showEmpty();
  (usernameInput.value ? passwordInput : usernameInput).focus();
}

async function authenticate(mode: "login" | "register") {
  const name = usernameInput.value.trim();
  const password = passwordInput.value;
  if (mode === "register") {
    const invalid = validateUsername(name) ?? validatePassword(password);
    if (invalid) return void (authError.textContent = invalid);
  }
  setBusy(authForm, true);
  authError.textContent = "";
  try {
    const result = mode === "login" ? await api.login(name, password) : await api.register(name, password);
    passwordInput.value = "";
    await showCharacters(result.username);
  } catch (error) {
    authError.textContent = messageOf(error);
  } finally {
    setBusy(authForm, false);
  }
}

// ---- Character select ----------------------------------------------------------------

async function showCharacters(name: string, select?: number) {
  username = name;
  authForm.hidden = true;
  createPanel.hidden = true;
  charactersPanel.hidden = false;
  accountName.textContent = `Hesap: ${name}`;
  charactersError.textContent = "";
  deleteConfirm.hidden = true;
  gmLink.hidden = true;
  api
    .me()
    .then((me) => (gmLink.hidden = !me.isAdmin))
    .catch(() => {});
  try {
    characters = await api.listCharacters();
  } catch (error) {
    return showAuth(messageOf(error));
  }
  // New characters a new player makes go straight to the creation screen.
  if (characters.length === 0) return showCreate();
  const keep = select ?? selectedId;
  selectedId = characters.some((c) => c.id === keep) ? keep! : characters[0].id;
  scene.showCharacters(characters, selectedId);
  renderSelection();
}

function select(id: number) {
  if (!characters.some((c) => c.id === id)) return;
  selectedId = id;
  deleteConfirm.hidden = true;
  charactersError.textContent = "";
  scene.select(id);
  renderSelection();
}

function renderSelection() {
  const character = characters.find((c) => c.id === selectedId);
  infoBox.hidden = !character;
  noCharacters.hidden = characters.length > 0;
  playButton.disabled = !character;
  deleteButton.disabled = !character;
  newButton.hidden = characters.length >= MAX_CHARACTERS_PER_ACCOUNT;
  if (!character) return;
  $("info-name").textContent = character.name;
  $("info-class").textContent = classOf(character.class).name;
  $("info-level").textContent = String(character.level);
  $("info-zone").textContent = ZONES[loginZone(character.zone)].name;
  $("info-time").textContent = formatPlayTime(character.playSeconds);
}

async function enter() {
  const character = characters.find((c) => c.id === selectedId);
  if (!character) return;
  setBusy(charactersPanel, true);
  charactersError.textContent = "";
  try {
    // Back where the character logged out: the town, the hunting grounds or the harbour.
    const zone = loginZone(character.zone);
    const room = await joinZone(zone, { token: getToken()!, characterId: character.id });
    charactersPanel.hidden = true;
    stopLobbyScene(game);
    resolveRoom?.({ room, characterId: character.id, zone });
    resolveRoom = null;
  } catch (error) {
    charactersError.textContent = messageOf(error) || "Oyuna girilemedi";
  } finally {
    setBusy(charactersPanel, false);
  }
}

async function confirmDelete() {
  const character = characters.find((c) => c.id === selectedId);
  if (!character) return;
  setBusy(charactersPanel, true);
  try {
    await api.deleteCharacter(character.id, deleteInput.value.trim());
    selectedId = null;
    await showCharacters(username);
  } catch (error) {
    charactersError.textContent = messageOf(error);
  } finally {
    setBusy(charactersPanel, false);
  }
}

// ---- Character creation ----------------------------------------------------------------

function showCreate() {
  charactersPanel.hidden = true;
  authForm.hidden = true;
  createPanel.hidden = false;
  createError.textContent = "";
  characterNameInput.value = "";
  renderCreate();
  characterNameInput.focus();
}

function swatches(containerId: string, colors: number[], current: number, choose: (color: number) => void) {
  $(containerId).replaceChildren(
    ...colors.map((color) => {
      const button = document.createElement("button");
      button.type = "button";
      button.tabIndex = -1;
      button.className = color === current ? "active" : "";
      button.style.setProperty("--swatch", `#${color.toString(16).padStart(6, "0")}`);
      button.addEventListener("click", () => {
        choose(color);
        renderCreate();
      });
      return button;
    }),
  );
}

function renderCreate() {
  genderPicker.replaceChildren(
    ...GENDERS.map((gender) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `secondary${gender === look.gender ? " active" : ""}`;
      button.textContent = GENDER_NAMES[gender];
      button.addEventListener("click", () => setGender(gender));
      return button;
    }),
  );
  hairName.textContent = HAIR_STYLE_NAMES[look.hairStyle];
  swatches("hair-colors", HAIR_COLORS, look.hairColor, (color) => (look.hairColor = color));
  swatches("skin-colors", SKIN_COLORS, look.skin, (color) => (look.skin = color));
  swatches("tunic-colors", TUNIC_COLORS, tunic, (color) => (tunic = color));
  // Everyone starts as a novice; the class is chosen in game from a master in the keep.
  scene.showPreview("novice", tunic, look);
}

/** Switching gender also offers that gender's usual hair first (still changeable). */
function setGender(gender: Gender) {
  if (gender === look.gender) return;
  look = { ...look, gender, hairStyle: gender === "female" ? "long" : "short" };
  renderCreate();
}

function stepHair(step: 1 | -1) {
  const index = HAIR_STYLES.indexOf(look.hairStyle);
  look = { ...look, hairStyle: HAIR_STYLES[(index + step + HAIR_STYLES.length) % HAIR_STYLES.length] };
  renderCreate();
}

function randomize() {
  const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
  look = { gender: pick(GENDERS), hairStyle: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS), skin: pick(SKIN_COLORS) };
  tunic = pick(TUNIC_COLORS);
  renderCreate();
}

async function create() {
  const name = characterNameInput.value.trim();
  const invalid = validateCharacterName(name);
  if (invalid) return void (createError.textContent = invalid);
  setBusy(createPanel, true);
  createError.textContent = "";
  try {
    const created = await api.createCharacter(name, look, tunic);
    look = { ...DEFAULT_LOOK };
    await showCharacters(username, created.id);
  } catch (error) {
    createError.textContent = messageOf(error);
  } finally {
    setBusy(createPanel, false);
  }
}

// ---- Wiring ------------------------------------------------------------------------------

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void authenticate("login");
  });
  registerButton.addEventListener("click", () => void authenticate("register"));

  playButton.addEventListener("click", () => void enter());
  newButton.addEventListener("click", () => showCreate());
  deleteButton.addEventListener("click", () => {
    const character = characters.find((c) => c.id === selectedId);
    if (!character) return;
    $("delete-name").textContent = character.name;
    deleteInput.value = "";
    deleteConfirm.hidden = false;
    deleteInput.focus();
  });
  $("delete-no").addEventListener("click", () => (deleteConfirm.hidden = true));
  $("delete-yes").addEventListener("click", () => void confirmDelete());
  deleteInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void confirmDelete();
  });

  createPanel.addEventListener("submit", (event) => {
    event.preventDefault();
    void create();
  });
  $("create-back").addEventListener("click", () => {
    if (characters.length > 0) void showCharacters(username);
    else createError.textContent = "Oynamak için önce bir karakter yarat.";
  });
  $("hair-prev").addEventListener("click", () => stepHair(-1));
  $("hair-next").addEventListener("click", () => stepHair(1));
  $("rotate-left").addEventListener("click", () => scene.rotatePreview(-1));
  $("rotate-right").addEventListener("click", () => scene.rotatePreview(1));
  $("randomize").addEventListener("click", randomize);

  // Enter on character select starts the game.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !charactersPanel.hidden && deleteConfirm.hidden && !playButton.disabled) void enter();
  });

  logoutButton.addEventListener("click", async () => {
    await api.logout();
    showAuth();
  });
}

/** Shows login / character select. Can be called again after leaving the game (character switch, logout). */
export function runLobby(phaserGame: Phaser.Game): Promise<LobbyResult> {
  game = phaserGame;
  scene = lobbyScene(game);
  scene.setCallbacks({ select, create: showCreate });
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

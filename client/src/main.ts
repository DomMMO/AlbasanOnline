import Phaser from "phaser";
import type { Room } from "colyseus.js";
import { CLOSE_LOGGED_IN_ELSEWHERE, ZONES, type TransferEvent, type ZoneId } from "../../shared/src";
import { joinZone } from "./net/connection";
import { WorldScene, type WorldSceneData } from "./scenes/WorldScene";
import { api, getToken } from "./net/api";
import { resetGameUi, showHud } from "./ui/hud";
import { runLobby } from "./ui/lobby";
import { closeMenu, initMenu } from "./ui/menu";
import { initTouchControls } from "./ui/touch";
import { initWindows } from "./ui/windows";
import { installCursorStyles } from "./gfx/cursors";

const disconnected = document.getElementById("disconnected")!;
const disconnectedText = document.getElementById("disconnected-text")!;
const loading = document.getElementById("loading")!;
const loadingText = document.getElementById("loading-text")!;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  pixelArt: true,
  backgroundColor: "#0e0a07",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
});

// Dev builds only: lets automated browser tests read game state. Stripped from production builds.
if (import.meta.env.DEV) Object.assign(window, { __mmoGame: game });

/** True while we deliberately leave one room for another, so that leave isn't shown as a disconnect. */
let transferring = false;
let characterId = 0;
let currentRoom: Room | null = null;

/** In-canvas names are drawn with the title font; it must be loaded before the first scene draws text. */
const fontsReady = document.fonts.load('10px "Cloister Black TR"').catch(() => undefined);

/** Lobby (login / character select), then into the world. Runs again after a character switch or logout. */
async function play() {
  const result = await runLobby();
  await fontsReady;
  characterId = result.characterId;
  showHud();
  enterZone(result.room, result.zone);
}

/** Back to character select (or the login screen). Leaving saves the character on the server. */
async function leaveGame(logout: boolean) {
  closeMenu();
  transferring = true;
  try {
    await currentRoom?.leave();
  } catch {
    // Already disconnected.
  } finally {
    transferring = false;
  }
  currentRoom = null;
  if (game.scene.getScene("world")) game.scene.remove("world");
  resetGameUi();
  if (logout) await api.logout();
  void play();
}

initTouchControls();
initWindows();
installCursorStyles();
initMenu({ switchCharacter: () => void leaveGame(false), logout: () => void leaveGame(true) });

function enterZone(room: Room, zone: ZoneId, arrived = false) {
  currentRoom = room;
  room.onLeave((code) => {
    if (transferring) return;
    disconnectedText.textContent =
      code === CLOSE_LOGGED_IN_ELSEWHERE ? "Bu karaktere başka bir yerden giriş yapıldı." : "Sunucuyla bağlantı koptu.";
    disconnected.hidden = false;
  });
  // A fresh scene per zone: no leftovers from the previous map or room.
  if (game.scene.getScene("world")) game.scene.remove("world");
  game.scene.add("world", WorldScene, true, { room, zone, arrived, onTransfer: (event) => transfer(room, event) } satisfies WorldSceneData);
}

/** Portal used: leave this zone's room and join the destination with the server-issued ticket. */
async function transfer(current: Room, event: TransferEvent) {
  if (transferring) return;
  transferring = true;
  loadingText.textContent = `${ZONES[event.zone].name} yükleniyor…`;
  loading.hidden = false;
  try {
    await current.leave();
    const next = await joinZone(event.zone, { token: getToken()!, characterId, ticket: event.ticket }, event.roomId);
    enterZone(next, event.zone, true);
  } catch (error) {
    console.error(error);
    disconnectedText.textContent = `Geçiş başarısız: ${(error as Error).message}`;
    disconnected.hidden = false;
  } finally {
    transferring = false;
    loading.hidden = true;
  }
}

void play();

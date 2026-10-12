import { api } from "../net/api";
import { getSettings, onSettingsChange, updateSettings, type Settings } from "../settings";

// Game menu (Esc): resume, settings, controls, switch character, log out.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const menu = $("game-menu");
const views = { main: $("menu-main"), settings: $("menu-settings"), controls: $("menu-controls") };
const zoomSelect = $<HTMLSelectElement>("setting-zoom");
const checkboxes = {
  damageNumbers: $<HTMLInputElement>("setting-damage"),
  speechBubbles: $<HTMLInputElement>("setting-bubbles"),
  helpText: $<HTMLInputElement>("setting-help"),
  damageMeter: $<HTMLInputElement>("setting-meter"),
};

export interface MenuActions {
  switchCharacter(): void;
  logout(): void;
}

let actions: MenuActions;
let initialised = false;

function show(view: keyof typeof views) {
  for (const [name, el] of Object.entries(views)) el.hidden = name !== view;
}

function syncSettingsForm(settings: Settings) {
  zoomSelect.value = settings.zoom;
  for (const [key, input] of Object.entries(checkboxes)) input.checked = settings[key as keyof typeof checkboxes];
  // The help line is plain DOM, so it is applied here rather than in the scene.
  document.getElementById("help")!.hidden = !settings.helpText;
}

export function initMenu(menuActions: MenuActions) {
  actions = menuActions;
  if (initialised) return;
  initialised = true;

  $("menu-resume").addEventListener("click", closeMenu);
  $("menu-open-settings").addEventListener("click", () => show("settings"));
  $("menu-open-controls").addEventListener("click", () => show("controls"));
  $("menu-switch").addEventListener("click", () => actions.switchCharacter());
  $("menu-logout").addEventListener("click", () => actions.logout());
  for (const back of menu.querySelectorAll(".menu-back")) back.addEventListener("click", () => show("main"));

  zoomSelect.addEventListener("change", () => updateSettings({ zoom: zoomSelect.value as Settings["zoom"] }));
  for (const [key, input] of Object.entries(checkboxes)) {
    input.addEventListener("change", () => updateSettings({ [key]: input.checked }));
  }
  // Buttons in the menu shouldn't keep keyboard focus (Space/Enter would re-trigger them).
  menu.addEventListener("mousedown", (event) => {
    if ((event.target as HTMLElement).tagName === "BUTTON") event.preventDefault();
  });
  syncSettingsForm(getSettings());
  onSettingsChange(syncSettingsForm);
}

export function openMenu() {
  show("main");
  menu.hidden = false;
  // GM link only for admin accounts.
  api
    .me()
    .then((me) => ($("menu-gm").hidden = !me.isAdmin))
    .catch(() => ($("menu-gm").hidden = true));
}

export function closeMenu() {
  menu.hidden = true;
}

/** Esc inside the menu: from a sub-page back to the main page, from there out of the menu. */
export function menuBack() {
  if (!views.main.hidden) closeMenu();
  else show("main");
}

export function isMenuOpen() {
  return !menu.hidden;
}

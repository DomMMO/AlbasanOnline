import { classOf, type ChatEvent } from "../../../shared/src";

// Chat box. Enter opens the input, Enter sends, Esc closes. Key events typed into
// the input are stopped there, so the game never sees them (no walking while typing).
// The current scene sends messages and tells us about incoming ones.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const chatEl = $("chat");
const log = $("chat-log");
const input = $<HTMLInputElement>("chat-input");
const MAX_LINES = 100;

let send: (text: string) => void = () => {};
let initialised = false;

function setActive(active: boolean) {
  chatEl.classList.toggle("active", active);
  input.hidden = !active;
  if (active) input.focus();
  else input.blur();
}

/** Opens the chat input (on-screen "Sohbet" button). */
export function openChat() {
  setActive(true);
}

export function isChatActive() {
  return !input.hidden;
}

/** Call from each scene; the DOM listeners are only attached once. */
export function initChat(onSend: (text: string) => void) {
  send = onSend;
  if (initialised) return;
  initialised = true;

  window.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && input.hidden && !(document.activeElement instanceof HTMLInputElement)) {
      event.preventDefault();
      setActive(true);
    }
  });
  input.addEventListener("keydown", (event) => {
    event.stopPropagation(); // keep typing away from the game
    if (event.key === "Enter") {
      const text = input.value.trim();
      if (text) send(text);
      input.value = "";
      setActive(false);
    } else if (event.key === "Escape") {
      setActive(false);
    }
  });
  input.addEventListener("blur", () => {
    if (!input.hidden) setActive(false);
  });
}

function line(className: string, ...parts: (string | HTMLElement)[]) {
  const div = document.createElement("div");
  div.className = `chat-line ${className}`;
  div.append(...parts);
  return div;
}

/** Clickable name: starts a whisper to that player. */
function nameTag(name: string, color: string) {
  const span = document.createElement("span");
  span.className = "name";
  span.textContent = name;
  span.style.color = color;
  span.addEventListener("mousedown", (event) => {
    event.preventDefault();
    setActive(true);
    input.value = `/f ${name} `;
  });
  return span;
}

export function addChatMessage(event: ChatEvent) {
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 8;
  let element: HTMLElement;
  if (event.channel === "system") {
    element = line("system", `[Sistem] ${event.text}`);
  } else if (event.channel === "party") {
    element = line("party", "[Grup] ", nameTag(event.from ?? "?", classOf(event.fromClass ?? "warrior").color), `: ${event.text}`);
  } else if (event.channel === "whisper") {
    element = event.to
      ? line("whisper", "[Fısıltı → ", nameTag(event.to, "#f783ac"), `]: ${event.text}`)
      : line("whisper", "[Fısıltı] ", nameTag(event.from ?? "?", "#f783ac"), `: ${event.text}`);
  } else {
    const parts: (string | HTMLElement)[] = [];
    if (event.gm) parts.push(Object.assign(document.createElement("span"), { className: "gm", textContent: "[GM] " }));
    parts.push(nameTag(event.from ?? "?", classOf(event.fromClass ?? "warrior").color), `: ${event.text}`);
    element = line("global", ...parts);
  }
  log.append(element);
  while (log.children.length > MAX_LINES) log.firstElementChild!.remove();
  if (atBottom) log.scrollTop = log.scrollHeight;
}

export function addSystemLine(text: string) {
  addChatMessage({ channel: "system", text });
}

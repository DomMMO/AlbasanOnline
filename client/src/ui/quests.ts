import {
  classOf,
  classQuestItems,
  ITEMS,
  NPCS,
  QUESTS,
  questAvailable,
  questReady,
  questsOfNpc,
  RARITY_COLORS,
  type NpcDef,
  type QuestDef,
  type QuestLogEvent,
  type QuestProgress,
  type QuestRewardItem,
} from "../../../shared/src";
import { iconUrl } from "../gfx/icons";
import { countItem } from "./inventory";
import { hideTooltip, showItemTooltip } from "./tooltip";

// Quests in the UI: the NPC conversation window (offers, progress, turn-in, the story
// lines), the tracker on the right and the quest log (J). Everything is drawn from
// the server's quest log plus the inventory; clicking only sends requests.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const dialogEl = $("npc-dialog");
const dialogName = $("npc-dialog-name");
const dialogBody = $("npc-dialog-body");
const trackerEl = $("quest-tracker");
const logEl = $("quest-log");
const logBody = $("quest-log-body");

export interface QuestActions {
  accept(npcId: string, questId: string): void;
  turnIn(npcId: string, questId: string): void;
  abandon(questId: string): void;
  openShop(npc: NpcDef): void;
  openUpgrade(npc: NpcDef): void;
  /** Ayşe Teyze: ask for today's fortune. */
  readFortune(npcId: string): void;
  playerLevel(): number;
  playerClass(): string;
  /** Quest state changed: NPC markers need redrawing. */
  changed(): void;
}

let actions: QuestActions;
let log = new Map<string, QuestProgress>();
let npc: NpcDef | null = null;
/** Quest whose detail page is open in the dialog. */
let viewing: string | null = null;
/** Turned in, waiting for the server: then the dialog shows the NPC's closing words. */
let completing: string | null = null;
/** The closing words are on screen; leave them until the player clicks "Devam". */
let showingCompletion = false;
/** Today's fortune as told in the open dialog (null = not asked in this conversation). */
let fortune: { text: string; good: boolean } | null = null;
let initialised = false;

export function initQuests(questActions: QuestActions) {
  actions = questActions;
  log = new Map();
  closeNpcDialog();
  toggleQuestLog(false);
  renderTracker();
  if (initialised) return;
  initialised = true;
  $("npc-dialog-close").addEventListener("click", closeNpcDialog);
  $("quest-log-close").addEventListener("click", () => toggleQuestLog(false));
}

export function setQuestLog(event: QuestLogEvent) {
  log = new Map(event.quests.map((q) => [q.id, q]));
  if (completing && log.get(completing)?.status !== "active") {
    const quest = QUESTS[completing];
    completing = null;
    if (npc && quest) showCompletion(quest);
  } else if (!showingCompletion) {
    renderDialog();
  }
  refreshQuests();
}

/** Inventory, level or quest log changed. */
export function refreshQuests() {
  renderTracker();
  if (!logEl.hidden) renderLog();
  if (npc && !completing && !showingCompletion && viewing === null) renderDialog();
  actions?.changed();
}

const ready = (quest: QuestDef, entry: QuestProgress) => questReady(quest, entry, countItem);

/** Marker over an NPC: "!" quest to give, "?" quest to turn in (grey while unfinished). */
export function npcMarker(npcId: string): { text: string; color: string } | null {
  let marker: { text: string; color: string } | null = null;
  for (const quest of questsOfNpc(npcId)) {
    const entry = log.get(quest.id);
    if (quest.turnIn === npcId && entry?.status === "active") {
      if (ready(quest, entry)) return { text: "?", color: "#ffd34d" };
      marker ??= { text: "?", color: "#9a9a9a" };
    }
    if (quest.giver === npcId && questAvailable(quest, actions.playerLevel(), log)) {
      if (!marker || marker.color !== "#ffd34d") marker = { text: "!", color: "#ffd34d" };
    }
  }
  return marker;
}

/** NPCs with quests open the conversation window first; returns false if this one has none. */
export function openNpcDialog(target: NpcDef): boolean {
  if (questsOfNpc(target.id).length === 0 && !target.fortuneTeller) return false;
  npc = target;
  fortune = null;
  viewing = null;
  completing = null;
  showingCompletion = false;
  dialogName.textContent = target.name;
  dialogEl.hidden = false;
  renderDialog();
  return true;
}

/** Ayşe Teyze read the fortune: show it in her dialog. */
export function showFortune(text: string, good: boolean) {
  fortune = { text, good };
  if (npc?.fortuneTeller && !dialogEl.hidden) {
    viewing = null;
    renderDialog();
  }
}

export function dialogNpc(): NpcDef | null {
  return npc;
}

export function closeNpcDialog() {
  npc = null;
  viewing = null;
  completing = null;
  showingCompletion = false;
  dialogEl.hidden = true;
  hideTooltip();
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void, className = ""): HTMLButtonElement {
  const b = el("button", className, label);
  b.type = "button";
  b.tabIndex = -1;
  b.addEventListener("mousedown", (event) => event.preventDefault());
  b.addEventListener("click", onClick);
  return b;
}

/** The NPC's quests in the state they are in for us. */
function questRows(target: NpcDef) {
  const level = actions.playerLevel();
  return questsOfNpc(target.id).flatMap((quest) => {
    const entry = log.get(quest.id);
    if (entry?.status === "active") {
      if (quest.turnIn === target.id) return [{ quest, mark: ready(quest, entry) ? "?" : "…", state: ready(quest, entry) ? "ready" : "active" }];
      if (quest.giver === target.id) return [{ quest, mark: "…", state: "active" }];
      return [];
    }
    if (quest.giver !== target.id) return [];
    if (questAvailable(quest, level, log)) return [{ quest, mark: "!", state: "available" }];
    // Next in the chain but not yet the level for it: show it greyed out as a hint.
    const prerequisiteDone = !quest.requires || log.get(quest.requires)?.status === "done";
    if (!entry && prerequisiteDone && level < quest.minLevel) return [{ quest, mark: "!", state: "locked" }];
    return [];
  });
}

function renderDialog() {
  if (!npc) return;
  if (viewing) return renderQuest(QUESTS[viewing]);
  hideTooltip();
  const target = npc;
  const nodes: HTMLElement[] = [el("p", "npc-greeting", target.greeting)];
  if (fortune) nodes.push(el("p", `npc-fortune ${fortune.good ? "good" : "bad"}`, fortune.text));
  const rows = questRows(target);
  if (rows.length > 0) {
    const list = el("div", "npc-quests");
    for (const { quest, mark, state } of rows) {
      const row = button("", () => {
        if (state === "locked") return;
        viewing = quest.id;
        renderDialog();
      }, `npc-quest ${state}`);
      row.append(el("span", "mark", mark), el("span", "title", quest.title));
      if (state === "locked") row.append(el("span", "lvl", `Sv ${quest.minLevel}`));
      if (quest.repeatable) row.append(el("span", "lvl", "tekrar"));
      list.append(row);
    }
    nodes.push(list);
  }
  const buttons = el("div", "npc-buttons");
  if (target.role === "merchant") buttons.append(button("Alışveriş", () => actions.openShop(target)));
  if (target.role === "blacksmith") buttons.append(button("Eşya Yükselt", () => actions.openUpgrade(target)));
  if (target.fortuneTeller && !fortune) buttons.append(button("Falıma bak", () => actions.readFortune(target.id)));
  buttons.append(button("Hoşça kal", closeNpcDialog, "secondary"));
  nodes.push(buttons);
  dialogBody.replaceChildren(...nodes);
}

function objectiveLines(quest: QuestDef, entry: QuestProgress | undefined): HTMLElement[] {
  if (quest.objectives.length === 0) return [el("div", "objective", `${NPCS[quest.turnIn]?.name} ile konuş`)];
  return quest.objectives.map((objective, i) => {
    const have = objective.type === "kill" ? (entry?.kills[i] ?? 0) : countItem(objective.item);
    const name = objective.type === "kill" ? objective.label : ITEMS[objective.item]?.name ?? objective.item;
    const verb = objective.type === "kill" ? "öldür" : "topla";
    const shown = entry ? `${Math.min(have, objective.count)}/${objective.count}` : `${objective.count}`;
    const line = el("div", `objective${entry && have >= objective.count ? " done" : ""}`, `${name} ${verb}: ${shown}`);
    return line;
  });
}

function rewardItems(quest: QuestDef): QuestRewardItem[] {
  return [...(quest.reward.items ?? []), ...classQuestItems(quest, actions.playerClass())];
}

function rewardBlock(quest: QuestDef): HTMLElement {
  const block = el("div", "quest-rewards");
  block.append(el("div", "label", "Ödül:"));
  const line = [quest.reward.xp ? `${quest.reward.xp} XP` : "", quest.reward.gold ? `${quest.reward.gold} altın` : ""].filter(Boolean).join(" · ");
  if (line) block.append(el("div", "currency", line));
  const items = el("div", "reward-items");
  for (const reward of rewardItems(quest)) {
    const def = ITEMS[reward.item];
    if (!def) continue;
    const item = el("div", "reward-item");
    const img = el("img");
    img.src = iconUrl(def.icon.shape, def.icon.color);
    const name = el("span", "", `${def.name}${(reward.qty ?? 1) > 1 ? ` x${reward.qty}` : ""}`);
    name.style.color = RARITY_COLORS[def.rarity];
    item.append(img, name);
    item.addEventListener("mouseenter", () => showItemTooltip(def, { qty: reward.qty, playerLevel: actions.playerLevel() }, item));
    item.addEventListener("mouseleave", hideTooltip);
    items.append(item);
  }
  if (items.childElementCount > 0) block.append(items);
  return block;
}

function renderQuest(quest: QuestDef | undefined) {
  const target = npc;
  if (!target || !quest) return;
  hideTooltip();
  const entry = log.get(quest.id);
  const active = entry?.status === "active";
  const isReady = active && ready(quest, entry!);
  const turnInHere = quest.turnIn === target.id;
  let text = quest.text;
  if (active && turnInHere && !isReady) text = quest.progressText ?? quest.text;
  if (active && turnInHere && isReady) text = quest.objectives.length === 0 ? quest.completeText : "İşini bitirmişsin. Gel, karşılığını vereyim.";
  if (active && !turnInHere) text = `${quest.progressText ?? quest.text}\n\nİş bitince ${NPCS[quest.turnIn]?.name} ile konuş.`;

  const nodes: HTMLElement[] = [
    el("div", "quest-chain", quest.chain),
    el("h3", "quest-title", quest.title),
    el("p", "quest-text", text),
    el("div", "label", "Görev:"),
    ...objectiveLines(quest, entry),
    rewardBlock(quest),
  ];
  const buttons = el("div", "npc-buttons");
  if (!active && quest.giver === target.id && questAvailable(quest, actions.playerLevel(), log)) {
    buttons.append(button("Kabul Et", () => actions.accept(target.id, quest.id)));
  }
  if (isReady && turnInHere) {
    buttons.append(
      button("Tamamla", () => {
        completing = quest.id;
        actions.turnIn(target.id, quest.id);
      }),
    );
  }
  buttons.append(
    button("Geri", () => {
      viewing = null;
      renderDialog();
    }, "secondary"),
  );
  nodes.push(buttons);
  dialogBody.replaceChildren(...nodes);
}

/** The NPC's closing words after a turn-in: this is where the story is told. */
function showCompletion(quest: QuestDef) {
  viewing = null;
  showingCompletion = true;
  hideTooltip();
  dialogBody.replaceChildren(
    el("div", "quest-chain", `${quest.chain} · Tamamlandı`),
    el("h3", "quest-title", quest.title),
    el("p", "quest-text", quest.completeText),
    el("div", "npc-buttons"),
  );
  dialogBody.lastElementChild!.append(
    button("Devam", () => {
      showingCompletion = false;
      renderDialog();
    }),
  );
}

function renderTracker() {
  const active = [...log.values()].filter((q) => q.status === "active" && QUESTS[q.id]);
  trackerEl.hidden = active.length === 0;
  trackerEl.replaceChildren(
    el("div", "tracker-title", "Görevler (J)"),
    ...active.slice(0, 6).flatMap((entry) => {
      const quest = QUESTS[entry.id];
      const isReady = ready(quest, entry);
      const nodes: HTMLElement[] = [el("div", `tracker-quest${isReady ? " ready" : ""}`, quest.title)];
      if (isReady) nodes.push(el("div", "objective done", `${NPCS[quest.turnIn]?.name} ile konuş`));
      else nodes.push(...objectiveLines(quest, entry));
      return nodes;
    }),
  );
}

function renderLog() {
  const active = [...log.values()].filter((q) => q.status === "active" && QUESTS[q.id]);
  const done = [...log.values()].filter((q) => q.status === "done").length;
  const nodes: HTMLElement[] = [];
  if (active.length === 0) nodes.push(el("p", "muted", "Aktif görevin yok. Başında ! olan NPC'lerle konuş."));
  for (const entry of active) {
    const quest = QUESTS[entry.id];
    const card = el("div", "log-quest");
    card.append(
      el("div", "quest-chain", quest.chain),
      el("div", `tracker-quest${ready(quest, entry) ? " ready" : ""}`, quest.title),
      el("p", "quest-text small", quest.text),
      ...objectiveLines(quest, entry),
      el("div", "objective", `Teslim: ${NPCS[quest.turnIn]?.name}`),
      rewardBlock(quest),
      button("Görevi bırak", () => actions.abandon(quest.id), "secondary small"),
    );
    nodes.push(card);
  }
  nodes.push(el("p", "muted", `Tamamlanan görev: ${done}`));
  logBody.replaceChildren(...nodes);
}

export function toggleQuestLog(open = logEl.hidden) {
  logEl.hidden = !open;
  if (open) renderLog();
  else hideTooltip();
}

export function isQuestLogOpen() {
  return !logEl.hidden;
}

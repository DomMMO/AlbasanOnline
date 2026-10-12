import {
  enhancedStats,
  isUpgradeable,
  ITEMS,
  MAX_ENHANCE,
  PROTECTION_ITEM,
  itemRarity,
  RARITY_COLORS,
  SAFE_UPGRADE_LEVEL,
  scrollForLevel,
  UPGRADE_SUCCESS_CHANCE,
  upgradeGoldCost,
  type NpcDef,
  type UpgradeResultEvent,
} from "../../../shared/src";
import { iconUrl } from "../gfx/icons";
import { countItem, DRAG_TYPE, inventoryState, renderSlot } from "./inventory";
import { hideTooltip } from "./tooltip";

// Blacksmith window. Shows the odds and costs for the selected item; the server
// rolls the dice and the window only displays the outcome.

const $ = (id: string) => document.getElementById(id)!;
const windowEl = $("upgrade-window");
const titleEl = $("upgrade-title");
const slotEl = $("upgrade-slot");
const infoEl = $("upgrade-info");
const protectInput = $("upgrade-protect") as HTMLInputElement;
const protectLabel = $("upgrade-protect-label");
const button = $("upgrade-button") as HTMLButtonElement;
const resultEl = $("upgrade-result");

export interface UpgradeActions {
  upgrade(npcId: string, uid: string, protect: boolean): void;
}

let actions: UpgradeActions;
let openNpc: NpcDef | null = null;
/** Today's good-fortune bonus to every success chance (0 = none). */
let fortuneBonus = 0;

export function setUpgradeFortune(bonus: number) {
  fortuneBonus = bonus;
}
let selectedUid: string | null = null;
let cooldownUntil = 0;

let initialised = false;

export function initUpgrade(upgradeActions: UpgradeActions) {
  actions = upgradeActions;
  closeUpgrade();
  if (initialised) return;
  initialised = true;
  $("upgrade-close").addEventListener("click", closeUpgrade);
  slotEl.addEventListener("dragover", (event) => event.preventDefault());
  slotEl.addEventListener("drop", (event) => {
    event.preventDefault();
    const raw = event.dataTransfer?.getData(DRAG_TYPE);
    const from = raw ? JSON.parse(raw) : null;
    if (from?.area === "inv") selectForUpgrade(from.index);
  });
  slotEl.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    selectedUid = null;
    refreshUpgrade();
  });
  protectInput.addEventListener("change", refreshUpgrade);
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => {
    if (!openNpc || !selectedUid || button.disabled) return;
    // Brief lock so a double-click can't fire two attempts.
    cooldownUntil = performance.now() + 600;
    button.disabled = true;
    setTimeout(refreshUpgrade, 650);
    actions.upgrade(openNpc.id, selectedUid, protectInput.checked);
  });
}

export function openUpgrade(npc: NpcDef) {
  openNpc = npc;
  titleEl.textContent = npc.name;
  resultEl.textContent = "";
  resultEl.className = "";
  windowEl.hidden = false;
  refreshUpgrade();
}

export function closeUpgrade() {
  openNpc = null;
  selectedUid = null;
  windowEl.hidden = true;
  hideTooltip();
}

export function openUpgradeNpc(): NpcDef | null {
  return openNpc;
}

/** Puts an inventory item into the upgrade slot. Returns false if it can't be upgraded. */
export function selectForUpgrade(index: number): boolean {
  const item = inventoryState()?.slots[index];
  const def = item && ITEMS[item.defId];
  if (!item || !def || !isUpgradeable(def)) return false;
  selectedUid = item.uid;
  resultEl.textContent = "";
  resultEl.className = "";
  refreshUpgrade();
  return true;
}

function row(html: string, className = "") {
  const div = document.createElement("div");
  div.className = className;
  div.innerHTML = html;
  return div;
}

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Redraws from the latest inventory snapshot (call after every inventory update). */
export function refreshUpgrade() {
  if (!openNpc) return;
  const state = inventoryState();
  const item = state?.slots.find((slot) => slot?.uid === selectedUid) ?? null;
  if (!item) selectedUid = null; // burned, sold or moved out
  renderSlot(slotEl, item);

  const charms = countItem(PROTECTION_ITEM);
  protectLabel.textContent = `Koruma Tılsımı kullan (${charms})`;

  if (!item || !state) {
    infoEl.replaceChildren(row("Yükseltmek istediğin ekipmanı envanterden sağ tıkla ya da buraya sürükle.", "muted"));
    button.disabled = true;
    protectInput.disabled = true;
    return;
  }

  const def = ITEMS[item.defId];
  if (item.enhance >= MAX_ENHANCE) {
    infoEl.replaceChildren(row(`<b style="color:${RARITY_COLORS[itemRarity(def, item.affixes)]}">${escape(def.name)} +${item.enhance}</b>`), row("Bu item en yüksek seviyede.", "muted"));
    button.disabled = true;
    protectInput.disabled = true;
    return;
  }

  const target = item.enhance + 1;
  const scroll = ITEMS[scrollForLevel(target)];
  const scrolls = countItem(scroll.id);
  const cost = upgradeGoldCost(target);
  const chance = Math.round(Math.min(1, UPGRADE_SUCCESS_CHANCE[target] + fortuneBonus) * 100);
  const risky = target > SAFE_UPGRADE_LEVEL;

  const now = enhancedStats(def, item.enhance);
  const next = enhancedStats(def, target);
  const statLines = (["attack", "defense", "maxHp"] as const)
    .filter((key) => now[key] !== undefined)
    .map((key) => `${{ attack: "Saldırı", defense: "Savunma", maxHp: "Can" }[key]} ${now[key]} → <b class="up">${next[key]}</b>`)
    .join(" · ");

  infoEl.replaceChildren(
    row(`<b style="color:${RARITY_COLORS[itemRarity(def, item.affixes)]}">${escape(def.name)}</b> +${item.enhance} → <b class="up">+${target}</b>`),
    row(statLines, "muted"),
    row(`Başarı şansı: <b>%${chance}</b>${fortuneBonus > 0 ? ` <span class="fortune-bonus">(+%${Math.round(fortuneBonus * 100)} fal)</span>` : ""}`),
    row(
      `<img src="${iconUrl(scroll.icon.shape, scroll.icon.color)}" alt="" /> ${escape(scroll.name)} <b class="${scrolls ? "" : "bad"}">(${scrolls})</b>`,
      "requirement",
    ),
    row(`Ücret: <b class="${state.gold >= cost ? "gold" : "bad"}">${cost} altın</b>`),
    risky
      ? protectInput.checked && charms > 0
        ? row("Başarısız olursa item korunur, seviyesi düşmez.", "safe")
        : row("Başarısız olursa item YANAR!", "danger")
      : row("Güvenli seviye: başarısız olsa da item yanmaz.", "safe"),
  );

  protectInput.disabled = !risky || charms === 0;
  if (protectInput.disabled) protectInput.checked = false;
  button.disabled = scrolls === 0 || state.gold < cost || performance.now() < cooldownUntil;
}

const OUTCOME_TEXT: Record<UpgradeResultEvent["outcome"], [string, string]> = {
  success: ["BAŞARILI!", "success"],
  failed: ["Başarısız", "failed"],
  protected: ["Başarısız, item korundu", "protected"],
  burned: ["İTEM YANDI!", "burned"],
};

export function showUpgradeResult(event: UpgradeResultEvent) {
  const [text, className] = OUTCOME_TEXT[event.outcome];
  resultEl.textContent = event.outcome === "success" ? `${text} +${event.enhance}` : text;
  resultEl.className = "";
  void resultEl.offsetWidth; // restart the animation
  resultEl.className = className;
}

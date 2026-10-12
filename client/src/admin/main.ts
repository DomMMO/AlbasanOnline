import {
  EQUIP_SLOT_NAMES,
  EQUIP_SLOTS,
  glowTier,
  isUpgradeable,
  ITEMS,
  MAX_ENHANCE,
  RARITY_COLORS,
  type EquipSlot,
  type ItemDef,
  type ItemView,
} from "../../../shared/src";
import { iconUrl } from "../gfx/icons";
import { getToken } from "../net/api";
import { hideTooltip, showItemTooltip } from "../ui/tooltip";

// GM panel. Talks to /api/admin/*; the server checks GM rights on every call.

interface CharacterRow {
  id: number;
  name: string;
  account: string;
  level: number;
  gold: number;
  online: boolean;
}

interface CharacterDetail extends CharacterRow {
  xp: number;
  slots: (ItemView | null)[];
  equipment: Partial<Record<EquipSlot, ItemView>>;
  log: { action: string; details: Record<string, unknown>; createdAt: string; admin: string }[];
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!response) throw new Error("Sunucuya bağlanılamadı");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Hata (${response.status})`);
  return data as T;
}

function toast(message: string, error = false) {
  const el = $("admin-toast");
  el.textContent = message;
  el.classList.toggle("error", error);
  el.hidden = false;
  clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(setTimeout(() => (el.hidden = true), 2500));
}

let selected: CharacterDetail | null = null;
let selectedItem: ItemDef | null = null;

// ---- Search ---------------------------------------------------------------------

async function search() {
  const rows = await api<CharacterRow[]>("GET", `/admin/characters?q=${encodeURIComponent($<HTMLInputElement>("search").value.trim())}`);
  const results = $("results");
  results.replaceChildren(
    ...rows.map((row) => {
      const button = document.createElement("button");
      button.className = `result${selected?.id === row.id ? " active" : ""}`;
      button.innerHTML = `<span class="dot ${row.online ? "on" : ""}"></span><b></b><span class="muted"></span><span class="lvl">Sv ${row.level}</span>`;
      button.querySelector("b")!.textContent = row.name;
      button.querySelector(".muted")!.textContent = row.account;
      button.addEventListener("click", () => select(row.id));
      return button;
    }),
  );
  if (rows.length === 0) results.innerHTML = `<p class="muted">Sonuç yok</p>`;
}

let searchTimer = 0;
$("search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => search().catch((e) => toast(e.message, true)), 250);
});

// ---- Character ------------------------------------------------------------------

async function select(id: number) {
  render(await api<CharacterDetail>("GET", `/admin/characters/${id}`));
  search().catch(() => {});
}

function itemCell(item: ItemView | null | undefined, label?: string): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "item-slot";
  if (label) cell.dataset.label = label;
  const def = item && ITEMS[item.defId];
  if (!item || !def) return cell;

  cell.classList.add("filled");
  const tier = glowTier(item.enhance);
  if (tier) cell.classList.add(`glow-${tier}`);
  cell.style.setProperty("--rarity", `var(--rarity-${def.rarity})`);
  cell.innerHTML = `<img src="${iconUrl(def.icon.shape, def.icon.color)}" alt="" />`;
  if (item.qty > 1) cell.insertAdjacentHTML("beforeend", `<span class="qty">${item.qty}</span>`);
  if (item.enhance) cell.insertAdjacentHTML("beforeend", `<span class="plus">+${item.enhance}</span>`);

  const remove = document.createElement("button");
  remove.className = "remove";
  remove.textContent = "×";
  remove.title = "Sil";
  remove.addEventListener("click", async () => {
    if (!selected || !confirm(`${def.name}${item.enhance ? ` +${item.enhance}` : ""} silinsin mi?`)) return;
    await act("remove", { uid: item.uid }, `${def.name} silindi`);
  });
  cell.append(remove);

  cell.addEventListener("mouseenter", () =>
    showItemTooltip(def, { qty: item.qty, enhance: item.enhance, playerLevel: selected?.level ?? 1 }, cell),
  );
  cell.addEventListener("mouseleave", hideTooltip);
  return cell;
}

function render(detail: CharacterDetail) {
  selected = detail;
  $("character-card").hidden = false;
  $("char-name").textContent = detail.name;
  $("char-meta").textContent = `Hesap: ${detail.account} · #${detail.id}`;
  const badge = $("char-online");
  badge.textContent = detail.online ? "Oyunda" : "Çevrimdışı";
  badge.classList.toggle("on", detail.online);
  $("char-stats").innerHTML = `<span>Seviye <b>${detail.level}</b></span><span>XP <b>${detail.xp}</b></span><span>Altın <b class="gold">${detail.gold.toLocaleString("tr-TR")}</b></span>`;
  $<HTMLInputElement>("level-value").placeholder = String(detail.level);

  $("gm-equipment").replaceChildren(...EQUIP_SLOTS.map((slot) => itemCell(detail.equipment[slot], EQUIP_SLOT_NAMES[slot])));
  $("gm-inventory").replaceChildren(...detail.slots.map((item) => itemCell(item)));

  const actionText: Record<string, (d: Record<string, unknown>) => string> = {
    give: (d) => `${ITEMS[String(d.itemId)]?.name ?? d.itemId}${Number(d.enhance) ? ` +${d.enhance}` : ""} x${d.qty} verdi`,
    remove: () => "item sildi",
    gold: (d) => `${Number(d.amount) > 0 ? "+" : ""}${d.amount} altın`,
    level: (d) => `seviye → ${d.level}`,
  };
  $("gm-log").replaceChildren(
    ...detail.log.map((entry) => {
      const li = document.createElement("li");
      const when = new Date(entry.createdAt).toLocaleString("tr-TR");
      li.textContent = `${when} · ${entry.admin}: ${actionText[entry.action]?.(entry.details) ?? entry.action}`;
      return li;
    }),
  );
  if (detail.log.length === 0) $("gm-log").innerHTML = `<li class="muted">Henüz yok</li>`;
}

async function act(action: string, body: object, success: string) {
  if (!selected) return;
  try {
    const response = await api<{ result: unknown; character: CharacterDetail }>("POST", `/admin/characters/${selected.id}/${action}`, body);
    const log = (await api<CharacterDetail>("GET", `/admin/characters/${selected.id}`)).log;
    render({ ...response.character, log });
    const leftover = (response.result as { leftover?: number } | null)?.leftover;
    toast(leftover ? `${success} (${leftover} adet envantere sığmadı)` : success, !!leftover);
  } catch (error) {
    toast((error as Error).message, true);
  }
}

$("gold-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number($<HTMLInputElement>("gold-amount").value);
  act("gold", { amount }, amount > 0 ? `${amount} altın verildi` : `${-amount} altın alındı`);
});

$("level-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const level = Number($<HTMLInputElement>("level-value").value);
  act("level", { level }, `Seviye ${level} yapıldı`);
});

// ---- Item catalogue -------------------------------------------------------------

const CATEGORIES: [string, (def: ItemDef) => boolean][] = [
  ["Silahlar", (d) => d.slot === "weapon"],
  ["Zırhlar", (d) => !!d.slot && d.slot !== "weapon"],
  ["Tüketilebilir", (d) => !!d.heal],
  ["Yükseltme", (d) => d.id.startsWith("upgrade_scroll") || d.id === "protection_charm"],
];

function category(def: ItemDef) {
  return CATEGORIES.find(([, match]) => match(def))?.[0] ?? "Materyal";
}

function renderCatalog() {
  const filter = $<HTMLInputElement>("item-filter").value.trim().toLocaleLowerCase("tr-TR");
  const groups = new Map<string, ItemDef[]>();
  for (const def of Object.values(ITEMS)) {
    if (filter && !def.name.toLocaleLowerCase("tr-TR").includes(filter) && !def.id.includes(filter)) continue;
    const name = category(def);
    groups.set(name, [...(groups.get(name) ?? []), def]);
  }
  const order = [...CATEGORIES.map(([name]) => name), "Materyal"];
  $("item-catalog").replaceChildren(
    ...order
      .filter((name) => groups.has(name))
      .map((name) => {
        const group = document.createElement("div");
        group.className = "catalog-group";
        group.innerHTML = `<h4>${name}</h4>`;
        for (const def of groups.get(name)!) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = `chip${selectedItem?.id === def.id ? " active" : ""}`;
          chip.innerHTML = `<img src="${iconUrl(def.icon.shape, def.icon.color)}" alt="" /><span></span>`;
          const label = chip.querySelector("span")!;
          label.textContent = def.name;
          label.style.color = RARITY_COLORS[def.rarity];
          chip.addEventListener("click", () => pickItem(def));
          chip.addEventListener("mouseenter", () => showItemTooltip(def, { playerLevel: selected?.level ?? 1 }, chip));
          chip.addEventListener("mouseleave", hideTooltip);
          group.append(chip);
        }
        return group;
      }),
  );
}

function pickItem(def: ItemDef) {
  selectedItem = def;
  const label = $("give-selected");
  label.textContent = def.name;
  label.style.color = RARITY_COLORS[def.rarity];
  const enhance = $<HTMLInputElement>("give-enhance");
  enhance.disabled = !isUpgradeable(def);
  enhance.max = String(MAX_ENHANCE);
  if (enhance.disabled) enhance.value = "0";
  $<HTMLButtonElement>("give-button").disabled = false;
  renderCatalog();
}

$("item-filter").addEventListener("input", renderCatalog);
$("give-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedItem) return;
  const qty = Number($<HTMLInputElement>("give-qty").value);
  const enhance = Number($<HTMLInputElement>("give-enhance").value);
  act("give", { itemId: selectedItem.id, qty, enhance }, `${selectedItem.name}${enhance ? ` +${enhance}` : ""} x${qty} verildi`);
});

// ---- Start ----------------------------------------------------------------------

async function start() {
  const error = $("admin-error");
  if (!getToken()) {
    error.innerHTML = `Önce <a href="/">oyuna giriş yap</a>, sonra bu sayfayı yenile.`;
    error.hidden = false;
    return;
  }
  try {
    const me = await api<{ username: string; isAdmin: boolean }>("GET", "/me");
    if (!me.isAdmin) throw new Error(`${me.username} hesabının GM yetkisi yok.`);
    $("admin-user").textContent = `Giriş: ${me.username}`;
    $("admin-main").hidden = false;
    renderCatalog();
    await search();
    // Keep an online character's view fresh while they play.
    setInterval(() => {
      if (selected && !document.hidden) {
        api<CharacterDetail>("GET", `/admin/characters/${selected.id}`)
          .then(render)
          .catch(() => {});
      }
    }, 5000);
  } catch (e) {
    error.textContent = (e as Error).message;
    error.hidden = false;
  }
}

start();

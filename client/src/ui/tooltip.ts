import {
  AFFIXES,
  CLASSES,
  enhancedStats,
  EQUIP_SLOT_NAMES,
  glowTier,
  hasAffixes,
  itemRarity,
  MAX_AFFIXES,
  RARITY_COLORS,
  RARITY_NAMES,
  type Affix,
  type ItemDef,
} from "../../../shared/src";

const tooltip = document.getElementById("tooltip")!;

export interface TooltipContext {
  qty?: number;
  enhance?: number;
  /** The instance's modifiers; absent for catalogue entries (shop, rewards). */
  affixes?: Affix[];
  /** Catalogue entries: how many modifiers it will come with (default: "1-5 random"). */
  affixHint?: string;
  playerLevel: number;
  /** Extra lines at the bottom, e.g. price or "Sağ tık: kuşan". */
  footer?: { text: string; color?: string }[];
}

function line(text: string, className = "", color?: string) {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text;
  if (color) div.style.color = color;
  return div;
}

export function showItemTooltip(def: ItemDef, ctx: TooltipContext, anchor: HTMLElement) {
  const title = `${def.name}${ctx.enhance ? ` +${ctx.enhance}` : ""}${ctx.qty && ctx.qty > 1 ? ` (${ctx.qty})` : ""}`;
  const kind = def.slot
    ? EQUIP_SLOT_NAMES[def.slot]
    : def.heal || def.mana || def.recall
      ? "Tüketilebilir"
      : def.questItem
        ? "Görev eşyası"
        : def.jewel
          ? "Pasif ağaç mücevheri"
          : "Materyal";
  const tier = glowTier(ctx.enhance ?? 0);
  const rarity = itemRarity(def, ctx.affixes);
  const count = ctx.affixes?.length ?? 0;
  const lines = [
    line(title, `tt-title${tier ? ` glow-text-${tier}` : ""}`, RARITY_COLORS[rarity]),
    line(`${RARITY_NAMES[rarity]} · ${kind}`, "tt-muted"),
  ];
  // Equipment value at a glance: how many of the 5 possible modifiers it rolled.
  if (def.slot && count > 0) lines.push(line(`${"★".repeat(count)}${"☆".repeat(MAX_AFFIXES - count)}`, "tt-stars", RARITY_COLORS[rarity]));

  const stats = enhancedStats(def, ctx.enhance ?? 0);
  if (stats.attack) lines.push(line(`+${stats.attack} Saldırı`));
  if (stats.defense) lines.push(line(`+${stats.defense} Savunma`));
  if (stats.maxHp) lines.push(line(`+${stats.maxHp} Can`));
  if (def.attackSpeedMs) lines.push(line(`Saldırı hızı ${(def.attackSpeedMs / 1000).toFixed(1)} sn`));
  if (count > 0) for (const affix of ctx.affixes!) lines.push(line(AFFIXES[affix.id].label(affix.value), "tt-affix"));
  else if (def.jewel) {
    const hint = { major: "Rastgele büyük bir etki (ör. bir skill %20 güçlenir)", greater: "Güçlü, özel bir etki (ör. +1 İskelet, bekleme süresi)", minor: "Rastgele bir özellik (Güç, Çeviklik, Zeka, Dayanıklılık)" }[def.jewel];
    lines.push(line(hint, "tt-affix"));
  }
  else if (hasAffixes(def)) lines.push(line(ctx.affixHint ?? `1-${MAX_AFFIXES} rastgele stat`, "tt-affix"));
  if (def.classes) lines.push(line(`Sınıf: ${def.classes.map((c) => CLASSES[c].name).join(", ")}`, "tt-muted"));
  if (def.description) lines.push(line(def.description, "tt-desc"));
  if (def.level > 1) lines.push(line(`Seviye ${def.level} gerekli`, "", ctx.playerLevel < def.level ? "#ff5a5a" : undefined));
  for (const extra of ctx.footer ?? []) lines.push(line(extra.text, "tt-muted", extra.color));

  tooltip.replaceChildren(...lines);
  tooltip.classList.remove("skill");
  tooltip.hidden = false;

  const rect = anchor.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  let left = rect.left - tipRect.width - 8;
  if (left < 8) left = rect.right + 8;
  const top = Math.min(Math.max(8, rect.top), window.innerHeight - tipRect.height - 8);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

export function hideTooltip() {
  tooltip.hidden = true;
}

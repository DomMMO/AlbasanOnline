class_name Items
extends RefCounted

## Item rules the client shows: shared/src/data/affixes.ts (rarity by modifier count, sell price,
## tooltip lines) and upgrade.ts (stats at +N), ported.

const MAX_AFFIXES := 5
const RARITY_ORDER := ["common", "uncommon", "rare", "epic", "legendary"]
const RARITY_BY_COUNT := ["common", "common", "uncommon", "rare", "epic", "legendary"]
const VALUE_BY_COUNT := [1.0, 1.0, 1.5, 2.5, 4.0, 7.0]


static func def(id: Variant) -> Dictionary:
	return GameData.item(String(id)) if id != null else {}


## upgrade.ts enhancedStats(): each +1 adds 10% of the base (rounded up) plus 1.
static func enhanced_stats(d: Dictionary, enhance: int) -> Dictionary:
	var stats: Dictionary = d.get("stats", {})
	var out := {}
	for key in ["attack", "defense", "maxHp"]:
		var base := float(stats.get(key, 0))
		if base:
			out[key] = int(base + ceil(base * 0.1 * enhance) + enhance)
	return out


static func is_upgradeable(d: Dictionary) -> bool:
	return d.has("slot")


static func has_affixes(d: Dictionary) -> bool:
	return d.has("slot") or d.has("jewel")


## affixes.ts itemRarity()
static func rarity(d: Dictionary, affixes: Variant = null) -> String:
	var list: Array = affixes if affixes is Array else []
	var tier = list[0].get("tier") if not list.is_empty() else null
	if d.has("jewel") and tier != null:
		return RARITY_ORDER[int(tier)]
	if not d.has("slot") or list.is_empty():
		return String(d.get("rarity", "common"))
	return RARITY_BY_COUNT[mini(list.size(), MAX_AFFIXES)]


## Worth asking about before it goes to a merchant: rare or better, or upgraded to +3 or more.
static func is_valuable(d: Dictionary, item: Dictionary) -> bool:
	var r := rarity(d, item.get("affixes"))
	return RARITY_ORDER.find(r) >= RARITY_ORDER.find("rare") or int(item.get("enhance", 0)) >= 3


## affixes.ts itemSellPrice()
static func sell_price(d: Dictionary, affixes: Variant = null) -> int:
	var list: Array = affixes if affixes is Array else []
	var tier = list[0].get("tier") if not list.is_empty() else null
	var base := float(d.get("sellPrice", 0))
	if d.has("jewel") and tier != null:
		return int(round(base * VALUE_BY_COUNT[int(tier) + 1]))
	if not d.has("slot"):
		return int(base)
	return int(round(base * VALUE_BY_COUNT[mini(list.size(), MAX_AFFIXES)]))


static func affix_label(affix: Dictionary) -> String:
	var labels: Dictionary = GameData.get_value("AFFIX_LABELS", {})
	var template := String(labels.get(String(affix.get("id", "")), "{v}"))
	return template.replace("{v}", str(int(affix.get("value", 0))))


static func rarity_color(r: String) -> Color:
	var colors: Dictionary = GameData.get_value("RARITY_COLORS", {})
	return Color(String(colors.get(r, "#ffffff")))


static func slot_name(slot: String) -> String:
	return String(GameData.get_value("EQUIP_SLOT_NAMES", {}).get(slot, slot))


## The lines of an item tooltip (tooltip.ts showItemTooltip): [[text, color or null, style]].
## ctx: {qty, enhance, affixes, affixHint, playerLevel, footer: [{text, color}]}
static func tooltip_lines(d: Dictionary, ctx: Dictionary) -> Array:
	var enhance := int(ctx.get("enhance", 0))
	var qty := int(ctx.get("qty", 0))
	var title := String(d.get("name", "?"))
	if enhance > 0:
		title += " +%d" % enhance
	if qty > 1:
		title += " (%d)" % qty
	var kind := "Materyal"
	if d.has("slot"):
		kind = slot_name(String(d.slot))
	elif d.has("heal") or d.has("mana") or d.has("recall"):
		kind = "Tüketilebilir"
	elif d.get("questItem", false):
		kind = "Görev eşyası"
	elif d.has("jewel"):
		kind = "Pasif ağaç mücevheri"
	var affixes: Array = ctx.get("affixes", []) if ctx.get("affixes") is Array else []
	var r := rarity(d, affixes)
	var color := rarity_color(r)
	var lines: Array = [[title, color, "title"], ["%s · %s" % [GameData.get_value("RARITY_NAMES", {}).get(r, r), kind], null, "muted"]]
	var count := affixes.size()
	if d.has("slot") and count > 0:
		lines.append(["★".repeat(count) + "☆".repeat(MAX_AFFIXES - count), color, ""])
	var stats := enhanced_stats(d, enhance)
	if stats.has("attack"):
		lines.append(["+%d Saldırı" % stats.attack, null, ""])
	if stats.has("defense"):
		lines.append(["+%d Savunma" % stats.defense, null, ""])
	if stats.has("maxHp"):
		lines.append(["+%d Can" % stats.maxHp, null, ""])
	if d.has("attackSpeedMs"):
		lines.append(["Saldırı hızı %.1f sn" % (float(d.attackSpeedMs) / 1000.0), null, ""])
	if count > 0:
		for a in affixes:
			lines.append([affix_label(a), Color("#8ab4ff"), "affix"])
	elif d.has("jewel"):
		var hints := {"major": "Rastgele büyük bir etki (ör. bir skill %20 güçlenir)", "greater": "Güçlü, özel bir etki (ör. +1 İskelet, bekleme süresi)", "minor": "Rastgele bir özellik (Güç, Çeviklik, Zeka, Dayanıklılık)"}
		lines.append([hints.get(String(d.jewel), ""), Color("#8ab4ff"), "affix"])
	elif has_affixes(d):
		lines.append([String(ctx.get("affixHint", "1-%d rastgele stat" % MAX_AFFIXES)), Color("#8ab4ff"), "affix"])
	if d.has("classes"):
		var names: Array = []
		for c in d.classes:
			names.append(String(GameData.class_of(String(c)).get("name", c)))
		lines.append(["Sınıf: %s" % ", ".join(names), null, "muted"])
	if d.has("description"):
		lines.append([String(d.description), Color("#d8cba8"), "desc"])
	if int(d.get("level", 1)) > 1:
		lines.append(["Seviye %d gerekli" % int(d.level), Color("#ff5a5a") if int(ctx.get("playerLevel", 1)) < int(d.level) else null, ""])
	for extra in ctx.get("footer", []):
		lines.append([String(extra.text), Color(String(extra.color)) if extra.get("color") else null, "muted"])
	return lines

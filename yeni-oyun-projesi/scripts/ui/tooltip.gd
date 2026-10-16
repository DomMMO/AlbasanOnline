class_name Tooltip
extends PanelContainer

## The item and skill tooltip (#tooltip): a wooden box of lines next to what is hovered.

const SKILL_RANK_BONUS := 12
const SKILL_MAX_RANK := 5

var _box: VBoxContainer
## slot -> the equipped item there ({defId, enhance, affixes}) or null; set by GameUi.
var equipped_item: Callable
## Holding Shift over a piece of gear shows what is worn in its slot in this second box.
var _compare: Tooltip
var _is_compare := false
var _item_shown := {}  # {d, anchor} of the item tooltip on screen ({} = none)
var _shift_shown := false


func _init(is_compare := false) -> void:
	_is_compare = is_compare
	theme_type_variation = "FramePanel"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false
	z_index = 100
	custom_minimum_size = Vector2(220, 0)
	_box = VBoxContainer.new()
	_box.add_theme_constant_override("separation", 2)
	add_child(_box)


func _ready() -> void:
	if not _is_compare:
		_compare = Tooltip.new(true)
		get_parent().add_child.call_deferred(_compare)


func _process(_delta: float) -> void:
	if _is_compare or _item_shown.is_empty():
		return
	if not visible or not is_instance_valid(_item_shown.anchor):
		_item_shown = {}
		_compare.hide_tip()
		return
	if Input.is_key_pressed(KEY_SHIFT) != _shift_shown:
		_update_compare()


func _clear() -> void:
	for c in _box.get_children():
		c.queue_free()


func _line(text: String, color: Variant = null, style := "") -> void:
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(240, 0)
	var size := 13
	match style:
		"title":
			l.add_theme_font_override("font", Fonts.title())
			size = 19
		"muted":
			l.add_theme_color_override("font_color", UiTheme.MUTED)
			size = 12
		"desc":
			l.add_theme_font_override("font", Fonts.serif())
			size = 12
		"affix":
			size = 13
	l.add_theme_font_size_override("font_size", size)
	if color != null:
		l.add_theme_color_override("font_color", color)
	_box.add_child(l)


func show_item(d: Dictionary, ctx: Dictionary, anchor: Control) -> void:
	_clear()
	custom_minimum_size = Vector2(220, 0)
	for line in Items.tooltip_lines(d, ctx):
		_line(line[0], line[1], line[2])
	var comparable: bool = not _is_compare and not ctx.get("equipped", false) and _worn(d) != null
	if comparable:
		_line("Shift: kuşanılanla kıyasla", UiTheme.MUTED, "muted")
	_item_shown = {"d": d, "anchor": anchor, "playerLevel": ctx.get("playerLevel", 1)} if comparable else {}
	_shift_shown = false
	if _compare:
		_compare.hide_tip()
	await _place(anchor, false)
	if comparable and visible:
		_update_compare()


## The item worn in the slot `d` goes into, or null (not gear, slot empty, no inventory yet).
func _worn(d: Dictionary) -> Variant:
	if not d.has("slot") or not equipped_item.is_valid():
		return null
	return equipped_item.call(String(d.slot))


func _update_compare() -> void:
	_shift_shown = Input.is_key_pressed(KEY_SHIFT)
	var worn: Variant = _worn(_item_shown.d) if _shift_shown else null
	if worn == null:
		_compare.hide_tip()
		return
	_compare._clear()
	_compare._line("Şu an kuşanılan", UiTheme.GOLD_LIGHT, "muted")
	for line in Items.tooltip_lines(Items.def(worn.defId), {"enhance": worn.get("enhance", 0), "affixes": worn.get("affixes"), "playerLevel": _item_shown.playerLevel}):
		_compare._line(line[0], line[1], line[2])
	_compare._place_beside(self, _item_shown.anchor)


## Puts the compare box next to `main`, on the side away from the hovered `anchor`.
func _place_beside(main: Control, anchor: Control) -> void:
	visible = true
	reset_size()
	await get_tree().process_frame
	if not visible or not is_instance_valid(main) or not is_instance_valid(anchor):
		return
	reset_size()
	var viewport := get_viewport_rect().size
	var m := main.get_global_rect()
	var left := m.position.x - size.x - 6
	var right := m.end.x + 6
	var x := left if m.position.x < anchor.get_global_rect().position.x else right
	if x < 8 or x + size.x > viewport.x - 8:
		x = right if x == left else left
	global_position = Vector2(clampf(x, 8, maxf(8, viewport.x - size.x - 8)), clampf(m.position.y, 8, maxf(8, viewport.y - size.y - 8)))


func show_skill(skill: Dictionary, ctx: Dictionary, anchor: Control) -> void:
	_item_shown = {}
	if _compare:
		_compare.hide_tip()
	_clear()
	custom_minimum_size = Vector2(300, 0)
	var head := HBoxContainer.new()
	var icon := TextureRect.new()
	icon.texture = Art.skill_icon(String(skill.id))
	icon.custom_minimum_size = Vector2(40, 40)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	head.add_child(icon)
	var titles := VBoxContainer.new()
	var t := UiTheme.title_label(String(skill.name), 19, Color(String(skill.get("color", "#ffffff"))))
	titles.add_child(t)
	var rank := int(ctx.get("rank", 0))
	var cats: Dictionary = GameData.get_value("SKILL_CATEGORY_NAMES", {})
	titles.add_child(UiTheme.label("%s · %s" % [cats.get(String(skill.get("category", "")), ""), ("Derece %d/%d" % [rank, SKILL_MAX_RANK]) if rank > 0 else "Öğrenilmedi"], 12, UiTheme.MUTED))
	head.add_child(titles)
	_box.add_child(head)
	var resource := String(GameData.class_of(String(ctx.get("playerClass", "novice"))).get("resource", "rage"))
	var resource_name: String = {"rage": "öfke", "mana": "mana", "energy": "enerji"}.get(resource, resource)
	var facts: Array = []
	facts.append(("%d %s" % [int(skill.cost), resource_name]) if int(skill.get("cost", 0)) > 0 else "Bedelsiz")
	facts.append(("%s büyü (yürürsen bozulur)" % _sec(skill.castMs)) if int(skill.get("castMs", 0)) > 0 else "Anında")
	facts.append(("%s bekleme" % _sec(skill.cooldownMs)) if int(skill.get("cooldownMs", 0)) > 0 else "Bekleme yok")
	var range_px := float(skill.get("range", 0))
	match String(skill.get("target", "")):
		"enemy":
			facts.append("Yakın dövüş" if range_px <= GameData.TILE_SIZE * 2 else "Menzil %s" % _tiles(range_px))
		"friendly":
			facts.append("Dost hedef, %s" % _tiles(range_px))
		_:
			facts.append("Hedef gerekmez")
	_line(" · ".join(facts), Color("#e0b04f"))
	_line(String(skill.get("description", "")), Color("#d8cba8"), "desc")
	for text in effect_lines(skill, ctx):
		_line(text, Color("#ecdfc2"))
	if rank > 1:
		_line("Dereceler: etkisi +%s (hesaba katıldı)" % _pct((rank - 1) * SKILL_RANK_BONUS / 100.0), Color("#8ab4ff"))
	if rank < SKILL_MAX_RANK:
		_line("Sonraki derece: +%%%d etki (1 yetenek puanı)" % SKILL_RANK_BONUS, null, "muted")
	if int(ctx.get("playerLevel", 1)) < int(skill.get("level", 1)):
		_line("Seviye %d gerekli" % int(skill.level), Color("#ff5a5a"))
	elif rank == 0:
		_line("Kullanmak için Yetenekler (K) sayfasından puan ver.", Color("#ffb347"))
	if ctx.get("footer"):
		_line(String(ctx.footer), null, "muted")
	_place(anchor, true)


static func _pct(n: float) -> String:
	return "%%%d" % int(round(n * 100))


static func _num(n: float) -> String:
	var s := ("%.2f" % n).rstrip("0").rstrip(".")
	return s.replace(".", ",")


static func _sec(ms: Variant) -> String:
	return "%s sn" % _num(float(ms) / 1000.0)


static func _tiles(px: float) -> String:
	return "%s kare" % _num(px / GameData.TILE_SIZE)


## skillTooltip.ts effectLines(): what the skill does, with numbers when the stats are known.
static func effect_lines(skill: Dictionary, ctx: Dictionary) -> Array:
	var e: Dictionary = skill.get("effect", {})
	var stats = ctx.get("stats")
	var power := 1.0
	var attack = null
	if stats is Dictionary:
		var bonus: Dictionary = stats.get("skillBonus", {})
		power = 1.0 + float(bonus.get(String(skill.id), 0)) + float(bonus.get("*", 0))
		attack = float(stats.get("attack", 0)) * power
	var dmg := func(mult: float, add := 0.0) -> String:
		return (" (≈ %d)" % int(round(attack * mult + add * power))) if attack != null else ""
	var hit := func(mult: float, add := 0.0) -> String:
		return "saldırı gücünün %s'i%s kadar hasar%s" % [_pct(mult), (" + %s" % _num(add)) if add else "", dmg.call(mult, add)]
	var mult := float(e.get("multiplier", 0))
	var bonus_v := float(e.get("bonus", 0))
	var radius := float(e.get("radius", 0))
	match String(e.get("type", "")):
		"strike":
			return ["Hedefe %s vurur." % hit.call(mult, bonus_v)]
		"whirlwind":
			return ["Etrafındaki %s içindeki bütün düşmanlara %s vurur." % [_tiles(radius), hit.call(mult)]]
		"heal":
			return ["Anında en yüksek canının %s'ini yeniler." % _pct(float(e.percent) * power)]
		"nova":
			return ["Etrafındaki %s içindeki bütün düşmanlara %s vurur." % [_tiles(radius), hit.call(mult)], "Vurduklarını %s dondurur: yerlerinden kıpırdayamazlar (saldırabilirler). Boss'lar etkilenmez; oyuncularda süre yarıya iner." % _sec(e.rootMs)]
		"healTarget":
			return ["Seçili dost oyuncuyu (yoksa kendini) saldırı gücünün %s'i + %s kadar iyileştirir%s." % [_pct(mult), _num(bonus_v), dmg.call(mult, bonus_v)]]
		"shield":
			return ["Seçili dost oyuncuya (yoksa kendine) %s boyunca saldırı gücünün %s'i + %s kadar hasarı emen bir kalkan verir%s." % [_sec(e.durationMs), _pct(mult), _num(bonus_v), dmg.call(mult, bonus_v)]]
		"drain":
			return ["Hedefe %s vurur ve verdiği hasarın %s'i kadar seni iyileştirir." % [hit.call(mult, bonus_v), _pct(float(e.healFraction))]]
		"summon":
			var count := int(stats.get("minionCount", 1)) if stats is Dictionary else 1
			var minion_damage := float(stats.get("minionDamage", 0)) if stats is Dictionary else 0.0
			return ["%s kalan %s çağırır. Senin saldırdığın hedefe, yoksa sana saldırana koşar." % [_sec(e.durationMs), ("%d %s" % [count, e.name]) if count > 1 else "bir %s" % e.name], "Her %s'de %s vurur. Yaratıklar iskeletlere saldırmaz; sen ölünce ya da bölge değiştirince dağılırlar." % [_sec(e.swingMs), hit.call(mult * (1.0 + minion_damage))]]
		"guard":
			return ["%s boyunca aldığın bütün hasar %s azalır." % [_sec(e.durationMs), _pct(float(e.reduction))]]
		"stun":
			return ["Hedefe %s vurur ve %s sersemletir: ne yürüyebilir ne saldırabilir." % [hit.call(mult, bonus_v), _sec(e.stunMs)], "Boss'lar sersemlemez; oyunculara (PvP, düello) süre yarıya iner."]
		"blast":
			return ["Hedefin %s çevresindeki bütün düşmanlara %s vurur." % [_tiles(radius), hit.call(mult)]]
		"radiance":
			return ["Etrafındaki %s içindeki bütün düşmanlara %s vurur." % [_tiles(radius), hit.call(mult)], "Aynı alandaki seni ve grup arkadaşlarını saldırı gücünün %s'i kadar iyileştirir%s." % [_pct(float(e.healMultiplier)), dmg.call(float(e.healMultiplier))]]
		"dash":
			var lines: Array = []
			var dist := _tiles(float(e.get("distance", 0)))
			match String(e.get("mode", "")):
				"forward":
					lines.append("Baktığın yöne anında %s ilerlersin; duvarlar seni durdurur." % dist)
				"behindTarget":
					lines.append("En çok %s uzaktaki hedefin arkasında belirirsin." % dist)
				_:
					lines.append("En çok %s uzaktaki hedefin yanına atılırsın." % dist)
			if e.get("landRadius") and mult:
				lines.append("İndiğin yerin %s çevresindeki bütün düşmanlara %s vurursun." % [_tiles(float(e.landRadius)), hit.call(mult)])
			elif mult:
				lines.append("Hedefe %s vurursun." % hit.call(mult))
			if e.get("stunMs"):
				lines.append("Çarptığın hedef %s sersemler (boss'lar hariç)." % _sec(e.stunMs))
			if e.get("healPercent"):
				lines.append("Canının %s'i yenilenir." % _pct(float(e.healPercent) * power))
			if e.get("shieldPercent"):
				lines.append("Canının %s'i kadar hasar emen bir kalkan kazanırsın." % _pct(float(e.shieldPercent) * power))
			return lines
		"buff":
			var parts: Array = []
			if e.get("attackPct"):
				parts.append("verdiğin hasar ve iyileştirme %s artar" % _pct(float(e.attackPct) * power))
			if e.get("speedPct"):
				parts.append("%s daha hızlı saldırırsın" % _pct(float(e.speedPct) * power))
			if e.get("reductionPct"):
				parts.append("aldığın hasar %s azalır" % _pct(float(e.reductionPct)))
			var lines := ["%s boyunca %s." % [_sec(e.durationMs), ", ".join(parts)]]
			if e.get("partyRadius"):
				lines.append("%s içindeki grup arkadaşların da aynı gücü kazanır." % _tiles(float(e.partyRadius)))
			if e.get("hpCostPercent"):
				lines.append("Bedeli: kullanınca canının %s'ini kaybedersin." % _pct(float(e.hpCostPercent)))
			return lines
	return []


func _place(anchor: Control, above_if_low: bool) -> void:
	visible = true
	reset_size()
	await get_tree().process_frame
	if not is_instance_valid(anchor) or not visible:
		return
	reset_size()
	var viewport := get_viewport_rect().size
	var r := anchor.get_global_rect()
	var p: Vector2
	if above_if_low and r.position.y > viewport.y / 2.0:
		p = Vector2(r.position.x + r.size.x / 2.0 - size.x / 2.0, r.position.y - size.y - 8)
	else:
		p = Vector2(r.position.x - size.x - 8, r.position.y)
		if p.x < 8:
			p.x = r.end.x + 8
	p.x = clampf(p.x, 8, maxf(8, viewport.x - size.x - 8))
	p.y = clampf(p.y, 8, maxf(8, viewport.y - size.y - 8))
	global_position = p


func hide_tip() -> void:
	visible = false
	_item_shown = {}
	if _compare:
		_compare.hide_tip()

class_name SkillsWindow
extends GameWindow

## Yetenekler: the class's active skills (drag them to the hotbar)
## and passives with their ranks, and the life skills (Madencilik, Botanik).

var ui: GameUi
var ranks := {}
var points := 0
var life := {}
var _points: Label
var _content: VBoxContainer
var _scroll: ScrollContainer


func _init(owner_ui: GameUi) -> void:
	super._init("skills-window", "Yetenekler", 860)
	ui = owner_ui
	set_default_anchor(Control.PRESET_TOP_LEFT)
	_points = UiTheme.label("", 14, UiTheme.GOLD_LIGHT, true)
	body.add_child(_points)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(840, 120)
	_scroll = scroll
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(scroll)
	_content = VBoxContainer.new()
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.add_theme_constant_override("separation", 6)
	scroll.add_child(_content)
	on_close = func(): ui.tooltip.hide_tip()


func set_ranks(event: Dictionary) -> void:
	ranks = event.get("ranks", {})
	points = int(event.get("points", 0))
	if visible:
		render()


func set_life(event: Dictionary) -> void:
	life = event.get("skills", {})
	if visible:
		render()


func rank(id: String) -> int:
	return int(ranks.get(id, 0))


func toggle_window(force: Variant = null) -> void:
	var want: bool = (not visible) if force == null else bool(force)
	if want:
		render()
		open()
	else:
		close_window()


func _section(text: String) -> void:
	_content.add_child(UiTheme.title_label(text, 20))


func _row(opts: Dictionary) -> Control:
	var level := ui.player_level()
	var locked := level < int(opts.level)
	var panel := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0, 0, 0, 0.25)
	style.border_color = Color(UiTheme.GOLD_DARK, 0.6 if int(opts.rank) > 0 else 0.3)
	style.set_border_width_all(1)
	style.content_margin_left = 6
	style.content_margin_right = 6
	style.content_margin_top = 4
	style.content_margin_bottom = 4
	panel.add_theme_stylebox_override("panel", style)
	panel.custom_minimum_size = Vector2(410, 0)
	panel.modulate.a = 0.55 if locked else 1.0
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	panel.add_child(h)
	if opts.has("skill"):
		var skill: Dictionary = opts.skill
		var badge := SlotButton.new(40)
		badge.empty = false
		badge.icon = Art.skill_icon(String(skill.id))
		badge.tint = Color(String(skill.get("color", "#495057")))
		badge.drag_data = {"type": "skill", "skillId": skill.id}
		badge.tooltip_text = ""
		badge.hovered.connect(func(inside):
			if inside:
				ui.tooltip.show_skill(skill, {"rank": int(opts.rank), "playerLevel": level, "playerClass": ui.player_class(), "stats": ui.stats()}, badge)
			else:
				ui.tooltip.hide_tip())
		h.add_child(badge)
	else:
		var star := UiTheme.label("✦", 22, UiTheme.GOLD)
		star.custom_minimum_size = Vector2(40, 40)
		star.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		star.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		h.add_child(star)
		panel.tooltip_text = "%s\n%s\n%s" % [opts.name, opts.description, opts.detail]
	var text := VBoxContainer.new()
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var title := HBoxContainer.new()
	title.add_child(UiTheme.label(String(opts.name), 14, UiTheme.GOLD_LIGHT, true))
	title.add_child(UiTheme.label(("%s · Sv %d" % [opts.tag, int(opts.level)]) if locked else String(opts.tag), 12, UiTheme.MUTED))
	text.add_child(title)
	var desc := UiTheme.label(String(opts.description), 12, Color("#d8cba8"))
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.custom_minimum_size = Vector2(250, 0)
	text.add_child(desc)
	var detail := UiTheme.label(String(opts.detail), 11, UiTheme.MUTED)
	detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail.custom_minimum_size = Vector2(250, 0)
	text.add_child(detail)
	h.add_child(text)
	var controls := HBoxContainer.new()
	controls.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var minus := UiTheme.button("−", "DarkButton", func(): ui.send("skillRank", {"id": opts.id, "delta": -1}))
	minus.disabled = int(opts.rank) == 0
	controls.add_child(minus)
	controls.add_child(UiTheme.label("%d/%d" % [int(opts.rank), int(opts.max)], 13, UiTheme.TEXT, true))
	var plus := UiTheme.button("+", "", func(): ui.send("skillRank", {"id": opts.id, "delta": 1}))
	plus.disabled = locked or int(opts.rank) >= int(opts.max) or points <= 0
	controls.add_child(plus)
	h.add_child(controls)
	return panel


func _grid(rows: Array) -> GridContainer:
	var g := GridContainer.new()
	g.columns = 2
	g.add_theme_constant_override("h_separation", 8)
	g.add_theme_constant_override("v_separation", 6)
	for r in rows:
		g.add_child(r)
	return g


func _life_rows() -> Array:
	var out: Array = []
	var infos: Dictionary = GameData.get_value("LIFE_SKILLS", {})
	for id in GameData.get_value("LIFE_SKILL_IDS", []):
		var info: Dictionary = infos.get(id, {})
		var progress: Dictionary = life.get(id, {"level": 1, "xp": 0, "next": 1})
		var row := HBoxContainer.new()
		row.custom_minimum_size = Vector2(410, 26)
		row.add_child(UiTheme.label(String(info.get("name", id)), 14, UiTheme.TEXT))
		var lvl := UiTheme.label("Sv %d" % int(progress.level), 13, UiTheme.GOLD_LIGHT, true)
		lvl.custom_minimum_size = Vector2(60, 0)
		row.add_child(lvl)
		var bar := Bar.new("xp", 10)
		bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var next := int(progress.get("next", 0))
		bar.set_value(float(progress.xp) if next > 0 else 1.0, float(next) if next > 0 else 1.0)
		bar.tooltip_text = ("%d / %d" % [int(progress.xp), next]) if next > 0 else "Ustalık"
		bar.mouse_filter = Control.MOUSE_FILTER_PASS
		row.add_child(bar)
		out.append(row)
	return out


func render() -> void:
	for c in _content.get_children():
		c.queue_free()
	var cls := ui.player_class()
	_points.text = "" if cls == "novice" else "Boş puan: %d" % points
	var life_hint := UiTheme.muted("Maden damarlarına ve bitkilere tıklayarak toplanır. Kazma ve orak Zanaatkâr Murat'tan (şehir) alınır.", 12, 800)
	if cls == "novice":
		_section("Yolun")
		_content.add_child(UiTheme.muted("Henüz bir yolun yok. İç Kale'nin büyük salonunda ateşin başında oturan yedi ustadan birini seçince yeteneklerin burada görünür.", 12, 800))
		_section("Meslekler")
		_content.add_child(_grid(_life_rows()))
		_content.add_child(life_hint)
		_fit.call_deferred()
		return
	var cdef := GameData.class_of(cls)
	var res_name: String = {"rage": "öfke", "mana": "mana", "energy": "enerji"}.get(String(cdef.get("resource", "rage")), "")
	var bonus_step := int(GameData.get_value("SKILL_RANK_BONUS", 12))
	var max_rank := int(GameData.get_value("SKILL_MAX_RANK", 5))
	var cats: Dictionary = GameData.get_value("SKILL_CATEGORY_NAMES", {})
	var active: Array = []
	for id in cdef.get("skills", []):
		var skill := GameData.skill(String(id))
		if skill.is_empty():
			continue
		var r := rank(String(id))
		var bonus := (" · +%%%d etki" % (bonus_step * (r - 1))) if r > 1 else ""
		var cost := ("%d %s" % [int(skill.cost), res_name]) if int(skill.get("cost", 0)) > 0 else "bedelsiz"
		var cooldown := (" · %s sn bekleme" % Tooltip._num(float(skill.cooldownMs) / 1000.0)) if int(skill.get("cooldownMs", 0)) > 0 else ""
		active.append(_row({"id": id, "skill": skill, "name": skill.name, "tag": cats.get(String(skill.get("category", "")), ""), "description": skill.get("description", ""), "detail": "%s · %s%s · her derece +%%%d" % ["Öğrenilmedi" if r == 0 else "Derece %d%s" % [r, bonus], cost, cooldown, bonus_step], "rank": r, "max": max_rank, "level": int(skill.get("level", 1))}))
	var passives: Array = []
	for p in GameData.get_value("CLASS_PASSIVES", {}).get(cls, []):
		var r := rank(String(p.id))
		passives.append(_row({"id": p.id, "name": p.name, "tag": "Pasif", "description": p.get("description", ""), "detail": "Puan verilmedi" if r == 0 else "Şu an: derece %d" % r, "rank": r, "max": int(GameData.get_value("PASSIVE_MAX_RANK", 5)), "level": int(p.get("level", 1))}))
	_section("Aktif Yetenekler")
	_content.add_child(_grid(active))
	_section("Pasif Yetenekler")
	_content.add_child(_grid(passives))
	_section("Meslekler")
	_content.add_child(_grid(_life_rows()))
	_content.add_child(life_hint)
	_fit.call_deferred()


func _fit() -> void:
	_scroll.custom_minimum_size.y = minf(420.0, _content.get_combined_minimum_size().y + 4)
	reset_size()

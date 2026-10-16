class_name Hud
extends CanvasLayer

## The in-game HUD: player and target frames, the
## health and resource globes, potion slots, the hotbar with cooldown sweeps, buffs, the XP
## bar, cast and boss bars, messages, clock, network info, minimap, chat, help line and the
## death panel. The world pushes state in; clicks call back out.

signal respawn_clicked
signal hotbar_used(index: int)
signal potion_used(index: int)
signal target_action(action: String)
signal mount_clicked
## An on-screen button (phones): a Keys action name ("inventory", "attack", "chat"...).
signal touch_action(action: String)

const HOTBAR_SLOTS := 10

var root: Control
var chat: Chat
var minimap: Minimap
var windows: Control

var _player_name: Label
var _player_level: Label
var _player_hp: Bar
var _player_res: Bar
var _hp_globe: Globe
var _res_globe: Globe
var _target: PanelContainer
var _target_name: Label
var _target_level: Label
var _target_hp: Bar
var _target_buttons := {}
var _hotbar_box: HBoxContainer
var _slots: Array[SlotButton] = []
var _slot_entries: Array = []
var _cooldowns := {}  # id -> [until_ms, length_ms]
var _gcd_until := 0.0
var _gcd_length := 1.0
var _current_resource := 0
var _current_level := 1
var _resource_type := "rage"
var _count_item: Callable = func(_id): return 0
var _potion_slots: Array[SlotButton] = []
var _potions: Array = ["", ""]
var _xp: Bar
var _cast: Control
var _cast_fill: ColorRect
var _cast_name: Label
var _cast_start := 0.0
var _cast_ms := 1.0
var _cast_running := false
var _boss: PanelContainer
var _boss_name: Label
var _boss_hp: Bar
var _messages: VBoxContainer
var _clock: Label
var _net_online: Label
var _net_pos: Label
var _net_ping: Label
var _death: PanelContainer
var _death_text: Label
var _help: Label
var _buffs: HBoxContainer
var _debuffs: HBoxContainer
var _auras: Array = []
var _mount: SlotButton
var _tooltip_owner: Object
## The on-screen joystick's direction (zero when untouched or on a computer).
var virtual_axis := Vector2i.ZERO
var _top_col: VBoxContainer
var _net_panel: PanelContainer
var _potions_panel: PanelContainer
var _bottom: VBoxContainer
var _dock: VBoxContainer
var _legend: Control
var _touch: Array[Control] = []
var _joystick: TouchControls.Joystick
var _touch_menu: HFlowContainer
var _touch_actions: Control


func _init() -> void:
	layer = 10
	root = Control.new()
	root.name = "HudRoot"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UiTheme.get_theme()
	add_child(root)
	_build_player_frame()
	_build_target_frame()
	_build_top_right()
	_build_globes()
	_build_bottom()
	_build_cast_and_boss()
	_build_messages()
	_build_chat()
	_build_death()
	windows = Control.new()
	windows.name = "Windows"
	windows.set_anchors_preset(Control.PRESET_FULL_RECT)
	windows.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(windows)
	Keys.changed.connect(refresh_key_labels)
	if Settings.touch:
		_build_touch()
	root.resized.connect(apply_layout)
	apply_layout.call_deferred()


func _anchored(c: Control, preset: int, offset: Vector2) -> Control:
	root.add_child(c)
	c.set_anchors_and_offsets_preset(preset, Control.PRESET_MODE_MINSIZE)
	c.position += offset
	return c


# ---- Player and target frames ----

func _frame_title(name_label: Label, level_label: Label) -> HBoxContainer:
	var row := HBoxContainer.new()
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.clip_text = true
	row.add_child(name_label)
	row.add_child(level_label)
	return row


func _build_player_frame() -> void:
	var frame := PanelContainer.new()
	frame.theme_type_variation = "FramePanel"
	frame.custom_minimum_size = Vector2(210, 0)
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 3)
	frame.add_child(box)
	_player_name = UiTheme.title_label("", 19)
	_player_level = UiTheme.label("", 12, UiTheme.GOLD, true)
	box.add_child(_frame_title(_player_name, _player_level))
	_player_hp = Bar.new("hp", 15)
	box.add_child(_player_hp)
	_player_res = Bar.new("rage", 8)
	box.add_child(_player_res)
	root.add_child(frame)
	frame.position = Vector2(8, 8)


func _build_target_frame() -> void:
	_target = PanelContainer.new()
	_target.theme_type_variation = "FramePanel"
	_target.custom_minimum_size = Vector2(210, 0)
	_target.visible = false
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 3)
	_target.add_child(box)
	_target_name = UiTheme.title_label("", 19)
	_target_level = UiTheme.label("", 12, UiTheme.GOLD, true)
	box.add_child(_frame_title(_target_name, _target_level))
	_target_hp = Bar.new("hp", 15)
	box.add_child(_target_hp)
	var actions := HFlowContainer.new()
	actions.add_theme_constant_override("h_separation", 4)
	box.add_child(actions)
	for spec in [["invite", "Gruba davet et", ""], ["trade", "Takas", ""], ["friend", "Arkadaş ekle", "DarkButton"], ["duel", "Düello", "RedButton"]]:
		var b := UiTheme.button(spec[1], spec[2])
		b.add_theme_font_size_override("font_size", 12)
		b.pressed.connect(func(): target_action.emit(spec[0]))
		b.visible = false
		actions.add_child(b)
		_target_buttons[spec[0]] = b
	_anchored(_target, Control.PRESET_CENTER_TOP, Vector2(0, 8))


# ---- Top right: network info, clock, minimap ----

func _build_top_right() -> void:
	var col := VBoxContainer.new()
	_top_col = col
	col.alignment = BoxContainer.ALIGNMENT_BEGIN
	col.add_theme_constant_override("separation", 4)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var net := PanelContainer.new()
	_net_panel = net
	net.theme_type_variation = "FramePanel"
	net.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	net.add_child(row)
	_net_online = UiTheme.label("", 12, UiTheme.MUTED)
	_net_pos = UiTheme.label("", 12, UiTheme.MUTED)
	_net_ping = UiTheme.label("", 12, UiTheme.MUTED)
	row.add_child(_net_online)
	row.add_child(_net_pos)
	row.add_child(_net_ping)
	col.add_child(net)
	_clock = UiTheme.label("", 13, UiTheme.GOLD_LIGHT, true)
	_clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	col.add_child(_clock)
	minimap = Minimap.new()
	minimap.size_flags_horizontal = Control.SIZE_SHRINK_END
	col.add_child(minimap)
	root.add_child(col)
	col.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	col.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	col.offset_right = -8
	col.offset_top = 8


# ---- Globes, potions, mount ----

func _build_globes() -> void:
	_hp_globe = Globe.new("hp", "hp")
	root.add_child(_hp_globe)
	_hp_globe.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_hp_globe.offset_left = 6
	_hp_globe.offset_top = -154
	_hp_globe.offset_right = 156
	_hp_globe.offset_bottom = -4
	_res_globe = Globe.new("resource", "rage")
	root.add_child(_res_globe)
	_res_globe.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_res_globe.offset_left = -156
	_res_globe.offset_top = -154
	_res_globe.offset_right = -6
	_res_globe.offset_bottom = -4
	var potions := PanelContainer.new()
	_potions_panel = potions
	potions.theme_type_variation = "FramePanel"
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 5)
	potions.add_child(row)
	for i in 2:
		var s := SlotButton.new(40)
		s.used.connect(func(): potion_used.emit(i))
		s.right_clicked.connect(func(): set_potion(i, ""))
		s.hovered.connect(func(inside): _potion_hover(i, s, inside))
		s.can_drop = func(data): return data is Dictionary and data.get("type") == "item" and _is_potion(String(data.get("defId", "")))
		s.dropped = func(data): set_potion(i, String(data.defId))
		row.add_child(s)
		_potion_slots.append(s)
	root.add_child(potions)
	potions.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	potions.offset_left = 160
	potions.offset_top = -14 - 54
	potions.offset_bottom = -14
	_mount = SlotButton.new(40)
	_mount.empty = false
	_mount.icon = HorsePainter.icon(HorsePainter.breed_look("village"), 1.5)
	_mount.used.connect(func(): mount_clicked.emit())
	_mount.visible = false
	root.add_child(_mount)
	_mount.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_mount.offset_left = -160 - 46
	_mount.offset_right = -160
	_mount.offset_top = -14 - 46
	_mount.offset_bottom = -14


# ---- Bottom: auras, hotbar, XP bar, help ----

func _build_bottom() -> void:
	var bottom := VBoxContainer.new()
	_bottom = bottom
	bottom.add_theme_constant_override("separation", 6)
	bottom.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(bottom)
	bottom.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.grow_vertical = Control.GROW_DIRECTION_BEGIN
	var dock := VBoxContainer.new()
	_dock = dock
	dock.add_theme_constant_override("separation", 3)
	dock.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	dock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bottom.add_child(dock)
	var auras := HBoxContainer.new()
	auras.custom_minimum_size = Vector2(0, 30)
	auras.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_buffs = HBoxContainer.new()
	_buffs.add_theme_constant_override("separation", 3)
	_buffs.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_debuffs = HBoxContainer.new()
	_debuffs.add_theme_constant_override("separation", 3)
	_debuffs.alignment = BoxContainer.ALIGNMENT_END
	_debuffs.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	auras.add_child(_buffs)
	auras.add_child(_debuffs)
	dock.add_child(auras)
	var bar := PanelContainer.new()
	bar.theme_type_variation = "FramePanel"
	_hotbar_box = HBoxContainer.new()
	_hotbar_box.add_theme_constant_override("separation", 5)
	bar.add_child(_hotbar_box)
	dock.add_child(bar)
	_xp = Bar.new("xp", 10)
	_xp.font_size = 9
	_xp.border = false
	bottom.add_child(_xp)
	_help = UiTheme.label("Tab: hedef · Sol tık: saldır / al / konuş / portal · 1-0: skill (K'dan sürükle) · Q / R: iksir · I: envanter · K: yetenekler · P: pasif ağaç · T: şehir portalı · J: görevler · O: arkadaşlar · H: ata bin (Shift: dörtnala) · M: harita · E: al/konuş/portal · Enter: sohbet · L: PvP sıralaması · /takas İsim: takas · Esc: menü", 11, Color(1, 1, 1, 0.67))
	_help.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_help.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_help.add_theme_color_override("font_shadow_color", Color.BLACK)
	_help.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_help)
	_help.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_help.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_help.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_help.offset_right = -8 - 160
	_help.offset_bottom = -16
	_help.custom_minimum_size = Vector2(360, 0)
	_help.visible = bool(Settings.get_value("helpText"))
	Settings.changed.connect(func(): _help.visible = bool(Settings.get_value("helpText")))


func _build_cast_and_boss() -> void:
	_cast = Control.new()
	_cast.custom_minimum_size = Vector2(220, 18)
	_cast.visible = false
	_cast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bg := Panel.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color("#0a0605")
	style.border_color = UiTheme.GOLD_DARK
	style.set_border_width_all(1)
	bg.add_theme_stylebox_override("panel", style)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_cast.add_child(bg)
	_cast_fill = ColorRect.new()
	_cast_fill.position = Vector2(1, 1)
	_cast_fill.size = Vector2(0, 16)
	_cast.add_child(_cast_fill)
	_cast_name = UiTheme.label("", 11, UiTheme.TEXT, true)
	_cast_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_cast_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_cast_name.set_anchors_preset(Control.PRESET_FULL_RECT)
	_cast_name.add_theme_color_override("font_shadow_color", Color.BLACK)
	_cast.add_child(_cast_name)
	root.add_child(_cast)
	_cast.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_cast.offset_left = -110
	_cast.offset_right = 110
	_cast.offset_top = -132 - 18
	_cast.offset_bottom = -132
	_boss = PanelContainer.new()
	_boss.theme_type_variation = "FramePanel"
	_boss.custom_minimum_size = Vector2(360, 0)
	_boss.visible = false
	var box := VBoxContainer.new()
	_boss.add_child(box)
	_boss_name = UiTheme.title_label("", 24, Color("#ff9a4a"))
	_boss_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_boss_name)
	_boss_hp = Bar.new("hp", 16)
	box.add_child(_boss_hp)
	_anchored(_boss, Control.PRESET_CENTER_TOP, Vector2(0, 92))


func _build_messages() -> void:
	_messages = VBoxContainer.new()
	_messages.alignment = BoxContainer.ALIGNMENT_BEGIN
	_messages.add_theme_constant_override("separation", 4)
	_messages.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_messages)
	_messages.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_messages.anchor_top = 0.22
	_messages.anchor_bottom = 0.22
	_messages.offset_left = -300
	_messages.offset_right = 300


func _build_chat() -> void:
	chat = Chat.new()
	root.add_child(chat)
	chat.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	chat.grow_vertical = Control.GROW_DIRECTION_BEGIN
	chat.offset_left = 8
	chat.offset_bottom = -166


func _build_death() -> void:
	_death = PanelContainer.new()
	_death.theme_type_variation = "WindowPanel"
	_death.custom_minimum_size = Vector2(320, 0)
	_death.visible = false
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	_death.add_child(box)
	var title := UiTheme.title_label("Öldün", 40, Color("#ff6b5a"))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	_death_text = UiTheme.label("Şehir meydanında yeniden doğacaksın.", 14)
	_death_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_death_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(_death_text)
	var b := UiTheme.button("Yeniden doğ", "TitleButton", func(): respawn_clicked.emit())
	box.add_child(b)
	_anchored(_death, Control.PRESET_CENTER, Vector2.ZERO)


# ---- API (hud.ts) ----

func set_death_text(text: String) -> void:
	_death_text.text = text


func set_clock(minute: float) -> void:
	var night := GameData.darkness(minute) >= 1.0 or minute >= 1200 or minute < 360
	_clock.text = "%s %s" % ["☾" if night else "☀", GameData.format_clock(minute)]
	_clock.add_theme_color_override("font_color", Color("#9db4ff") if night else UiTheme.GOLD_LIGHT)
	_clock.tooltip_text = "Gece: yaratıklar %20 daha güçlü ve ödüllü, gece yaratıkları dolaşıyor" if night else "Gündüz"


func set_online_count(count: int) -> void:
	_net_online.text = "Çevrimiçi: %d" % count


func set_world_position(x: float, y: float) -> void:
	_net_pos.text = "X: %d Y: %d" % [int(floor(x / 16.0)), int(floor(y / 16.0))]


func set_ping(ms: float) -> void:
	_net_ping.text = "Ping: %d ms" % int(round(ms))


func slosh_globes() -> void:
	_hp_globe.slosh()


## data: {name, level, hp, maxHp, resource, maxResource, resourceType, shield, xp, xpToNext}
func update_player_frame(d: Dictionary) -> void:
	_player_name.text = String(d.name)
	_player_level.text = "Sv %d" % int(d.level)
	var hp_text := ("%d / %d (+%d)" % [d.hp, d.maxHp, d.shield]) if int(d.shield) > 0 else ("%d / %d" % [d.hp, d.maxHp])
	_player_hp.set_value(d.hp, d.maxHp, hp_text)
	_player_hp.shielded = int(d.shield) > 0
	var res_kind := String(d.resourceType)
	_player_res.set_kind(res_kind)
	_player_res.set_value(d.resource, d.maxResource)
	_hp_globe.set_value(d.hp, d.maxHp, hp_text)
	_hp_globe.shielded = int(d.shield) > 0
	_res_globe.set_kind(res_kind)
	_res_globe.set_value(d.resource, d.maxResource, "%d / %d" % [d.resource, d.maxResource])
	_xp.set_value(d.xp, d.xpToNext, "XP %d / %d" % [d.xp, d.xpToNext])
	_current_resource = int(d.resource)
	_current_level = int(d.level)
	_resource_type = res_kind


func start_cast_bar(name: String, cast_ms: float, color: String) -> void:
	_cast.visible = true
	_cast_name.text = name
	_cast_fill.color = Color(color)
	_cast_start = Time.get_ticks_msec()
	_cast_ms = maxf(1.0, cast_ms)
	_cast_running = true
	(_cast.get_child(0) as Panel).get_theme_stylebox("panel").border_color = UiTheme.GOLD_DARK


func stop_cast_bar(interrupted: bool) -> void:
	if not _cast.visible:
		return
	_cast_running = false
	if interrupted:
		_cast_name.text = "İptal edildi"
		_cast_fill.color = UiTheme.ERROR
		(_cast.get_child(0) as Panel).get_theme_stylebox("panel").border_color = UiTheme.ERROR
	get_tree().create_timer(0.5 if interrupted else 0.15).timeout.connect(func(): _cast.visible = false)


## data: {name, level, hp, maxHp, color: Color, subtitle?, aggro?, invite: bool, duel, trade, friend} or null.
func set_target_frame(d: Variant) -> void:
	_target.visible = d != null
	if d == null:
		return
	_target_name.text = String(d.name)
	_target_name.add_theme_color_override("font_color", d.color)
	_target_level.text = ("%s · Sv %d" % [d.subtitle, d.level]) if d.get("subtitle") else ("Sv %d" % int(d.level))
	var text := "%d / %d" % [d.hp, d.maxHp]
	if d.get("aggro"):
		text += "  → %s" % d.aggro
	_target_hp.set_value(d.hp, d.maxHp, text)
	for key in _target_buttons:
		_target_buttons[key].visible = bool(d.get(key, false))


## entries: [{kind: "skill"|"empty", skill: Dictionary, locked: bool}]
func init_hotbar(entries: Array, count_item: Callable, on_hover: Callable, on_drop: Callable, on_clear: Callable) -> void:
	_count_item = count_item
	for s in _slots:
		s.queue_free()
	_slots.clear()
	_slot_entries = entries
	for i in entries.size():
		var entry: Dictionary = entries[i]
		var s := SlotButton.new(44)
		s.key_label = Keys.label(Keys.HOTBAR[i])
		if entry.kind == "skill":
			var skill: Dictionary = entry.skill
			s.empty = false
			s.icon = Art.skill_icon(String(skill.id))
			s.tint = Color(String(skill.get("color", "#495057")))
			s.locked = bool(entry.get("locked", false))
			s.drag_data = {"type": "skill", "skillId": skill.id, "from": i}
		s.used.connect(func(): hotbar_used.emit(i))
		s.hovered.connect(func(inside): on_hover.call(i if inside else -1, s))
		s.right_clicked.connect(func(): if entry.kind != "empty": on_clear.call(i))
		s.can_drop = func(data): return data is Dictionary and data.get("type") == "skill"
		s.dropped = func(data): on_drop.call(i, data)
		_hotbar_box.add_child(s)
		_slots.append(s)
	apply_layout.call_deferred()


func refresh_key_labels() -> void:
	for i in _slots.size():
		_slots[i].key_label = Keys.label(Keys.HOTBAR[i])
	for i in _potion_slots.size():
		_potion_slots[i].key_label = Keys.label("potion_%d" % (i + 1))


func start_cooldown(id: String, cooldown_ms: float, gcd_ms: float) -> void:
	var now := Time.get_ticks_msec()
	if cooldown_ms > 0:
		_cooldowns[id] = [now + cooldown_ms, cooldown_ms]
	if gcd_ms > 0:
		_gcd_until = now + gcd_ms
		_gcd_length = gcd_ms


## Remaining cooldown for a slot: whole seconds (rounded up), tenths under 3 s, minutes past one.
static func _cooldown_text(left_ms: float) -> String:
	if left_ms <= 0:
		return ""
	var sec := left_ms / 1000.0
	if sec >= 60.0:
		return "%dd" % ceili(sec / 60.0)
	if sec >= 3.0:
		return str(ceili(sec))
	return ("%.1f" % sec).replace(".", ",")


func flash_slot(index: int) -> void:
	if index >= 0 and index < _slots.size():
		_slots[index].press_flash()


func _process(_delta: float) -> void:
	var now := Time.get_ticks_msec()
	for i in _slots.size():
		var entry: Dictionary = _slot_entries[i]
		var s := _slots[i]
		var fraction := 0.0
		var left := 0.0
		if entry.kind == "skill":
			var skill: Dictionary = entry.skill
			var cd: Array = _cooldowns.get(String(skill.id), [0, 1])
			var own: float = cd[0] - now
			var gcd: float = (_gcd_until - now) if skill.get("triggersGcd", false) else 0.0
			if own > 0 and own >= gcd:
				fraction = own / cd[1]
			elif gcd > 0:
				fraction = gcd / _gcd_length
			# Only the skill's own cooldown gets a number; the short global cooldown is just the sweep.
			left = own
			s.dimmed = bool(entry.get("locked", false)) or _current_resource < GameData.skill_cost(skill, _resource_type, _current_level)
		s.sweep = clampf(fraction, 0.0, 1.0)
		s.cooldown_text = _cooldown_text(left)
	for i in _potion_slots.size():
		var def_id: String = _potions[i]
		var s := _potion_slots[i]
		var def := GameData.item(def_id)
		var fraction := 0.0
		var left := 0.0
		if not def.is_empty():
			var cd: Array = _cooldowns.get(String(def.get("cooldownGroup", def_id)), [0, 1])
			if cd[0] > now:
				left = cd[0] - now
				fraction = left / cd[1]
		s.sweep = clampf(fraction, 0.0, 1.0)
		s.cooldown_text = _cooldown_text(left)
	if _cast_running:
		var t := clampf((now - _cast_start) / _cast_ms, 0.0, 1.0)
		_cast_fill.size = Vector2((_cast.size.x - 2) * t, _cast.size.y - 2)


# ---- Potions (ui/potions.ts) ----

func _is_potion(def_id: String) -> bool:
	var def := GameData.item(def_id)
	return not def.is_empty() and (def.has("heal") or def.has("mana"))


var _potion_owner := ""


func init_potions(player_name: String, cls: String) -> void:
	_potion_owner = player_name
	var defaults: Array = GameData.class_of(cls).get("potions", [])
	_potions = [defaults[0] if defaults.size() > 0 else "", defaults[1] if defaults.size() > 1 else ""]
	var cfg := ConfigFile.new()
	if cfg.load("user://potions.cfg") == OK and cfg.has_section_key("potions", player_name):
		var saved: Array = cfg.get_value("potions", player_name)
		for i in 2:
			_potions[i] = String(saved[i]) if i < saved.size() and _is_potion(String(saved[i])) else ""
	render_potions()


func set_potion(index: int, def_id: String) -> void:
	_potions[index] = def_id
	var cfg := ConfigFile.new()
	cfg.load("user://potions.cfg")
	cfg.set_value("potions", _potion_owner, _potions)
	cfg.save("user://potions.cfg")
	render_potions()


func potion_at(index: int) -> String:
	return _potions[index] if index < _potions.size() else ""


func render_potions() -> void:
	for i in _potion_slots.size():
		var s := _potion_slots[i]
		var def_id: String = _potions[i]
		var def := GameData.item(def_id)
		s.key_label = Keys.label("potion_%d" % (i + 1))
		s.empty = def.is_empty()
		s.icon = Art.item_icon(def_id) if not def.is_empty() else null
		var have: int = _count_item.call(def_id) if not def.is_empty() else 0
		s.count_text = str(have) if not def.is_empty() else ""
		s.dimmed = not def.is_empty() and have == 0
		s.tint = Color("#140e08")


func flash_potion(index: int) -> void:
	_potion_slots[index].press_flash()


var potion_hover: Callable


func _potion_hover(index: int, slot: SlotButton, inside: bool) -> void:
	if potion_hover.is_valid():
		potion_hover.call(index if inside else -1, slot)


# ---- Mount button ----

func set_mount_button(visible_now: bool, mounted := false) -> void:
	_mount.visible = visible_now
	_mount.key_label = Keys.label("mount")
	_mount.tint = Color("#3a2a18") if mounted else Color("#1f150c")


func set_mount_icon(look: Dictionary) -> void:
	_mount.icon = HorsePainter.icon(look, 1.5)


# ---- Messages ----

func show_message(text: String, kind := "error", color: Variant = null) -> void:
	var l := UiTheme.label(text, 18 if kind == "level" else 16, UiTheme.ERROR if kind == "error" else (UiTheme.GOLD_LIGHT if kind == "level" else UiTheme.TEXT), true)
	if kind == "level":
		l.add_theme_font_override("font", Fonts.title())
		l.add_theme_font_size_override("font_size", 28)
	if color != null:
		l.add_theme_color_override("font_color", Color(color) if color is String else color)
	l.add_theme_color_override("font_shadow_color", Color.BLACK)
	l.add_theme_constant_override("shadow_offset_x", 1)
	l.add_theme_constant_override("shadow_offset_y", 2)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_messages.add_child(l)
	while _messages.get_child_count() > 5:
		_messages.get_child(0).free()
	var life := 3.0 if kind == "level" else 1.6
	var t := l.create_tween()
	t.tween_interval(life * 0.7)
	t.tween_property(l, "modulate:a", 0.0, life * 0.3)
	t.tween_callback(l.queue_free)


func set_death_panel(on: bool) -> void:
	_death.visible = on


## data: {name, hp, maxHp, enraged} or null.
func set_boss_bar(d: Variant) -> void:
	_boss.visible = d != null
	if d == null:
		return
	_boss_name.text = ("%s · ÖFKELİ" % d.name) if d.enraged else String(d.name)
	_boss_hp.set_value(d.hp, d.maxHp, "%d / %d" % [d.hp, d.maxHp])


# ---- Auras (ui/auras.ts) ----

## auras: [{id, icon, kind: "buff"|"debuff", remainingMs: float|null}]
func set_auras(list: Array) -> void:
	for c in _buffs.get_children() + _debuffs.get_children():
		c.queue_free()
	_auras.clear()
	var now := Time.get_ticks_msec()
	for a in list:
		var s := SlotButton.new(28)
		s.empty = false
		s.icon = Art.skill_icon(String(a.icon))
		s.tint = Color("#1f150c")
		s.mouse_filter = Control.MOUSE_FILTER_PASS
		var skill := GameData.skill(String(a.icon))
		s.tooltip_text = String(skill.get("name", a.id))
		(_buffs if a.kind == "buff" else _debuffs).add_child(s)
		var remaining = a.get("remainingMs")
		_auras.append({"slot": s, "until": (now + float(remaining)) if remaining != null else -1.0, "total": float(remaining) if remaining != null else 0.0})


func clear_auras() -> void:
	set_auras([])


func reset() -> void:
	set_target_frame(null)
	set_boss_bar(null)
	set_death_panel(false)
	_cast.visible = false
	clear_auras()
	GameWindow.close_all()


# ---- Phones and tablets (ui/touch.ts + the body.touch rules of style.css) ----

func _build_touch() -> void:
	_joystick = TouchControls.Joystick.new()
	_joystick.axis_changed.connect(func(axis): virtual_axis = axis)
	root.add_child(_joystick)
	_touch.append(_joystick)
	# Hedef, E and a big Saldır at the bottom right.
	_touch_actions = Control.new()
	_touch_actions.custom_minimum_size = Vector2(108, 110)
	_touch_actions.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for spec in [["Hedef", "target_next", Rect2(0, 0, 50, 50), true], ["E", "interact", Rect2(58, 0, 50, 50), true], ["Saldır", "attack", Rect2(0, 58, 108, 52), false]]:
		var b := TouchControls.TouchButton.new(spec[0], spec[3])
		b.big = not spec[3]
		b.position = spec[2].position
		b.size = spec[2].size
		b.pressed.connect(func(): touch_action.emit(spec[1]))
		_touch_actions.add_child(b)
	root.add_child(_touch_actions)
	_touch.append(_touch_actions)
	# The windows and the rest across the top.
	_touch_menu = HFlowContainer.new()
	_touch_menu.add_theme_constant_override("h_separation", 4)
	_touch_menu.add_theme_constant_override("v_separation", 4)
	_touch_menu.alignment = FlowContainer.ALIGNMENT_CENTER
	_touch_menu.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for spec in [["Çanta", "inventory"], ["Görev", "quest_log"], ["Pasif", "passive_tree"], ["Portal", "town_portal"], ["At", "mount"], ["Yetenek", "skills"], ["Sohbet", "chat"], ["Menü", "clear_target"]]:
		var b := TouchControls.TouchButton.new(spec[0], false, true)
		b.custom_minimum_size = Vector2(Fonts.serif(true).get_string_size(spec[0], HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x + 16, 26)
		b.pressed.connect(func(): touch_action.emit(spec[1]))
		_touch_menu.add_child(b)
	root.add_child(_touch_menu)
	_touch.append(_touch_menu)
	_legend = minimap.get_child(0).get_child(minimap.get_child(0).get_child_count() - 1)


func _place(c: Control, pos: Vector2, size_hint := Vector2.ZERO) -> void:
	c.set_anchors_preset(Control.PRESET_TOP_LEFT)
	c.position = pos
	if size_hint != Vector2.ZERO:
		c.size = size_hint


## Phones: everything to the edges (frame, potions, chat and joystick on the left; clock,
## minimap, damage meter and the action buttons on the right; the menu across the top; a
## smaller hotbar). The globes go: the frame already shows health and resource.
func apply_layout() -> void:
	if not Settings.touch:
		return
	var vp := root.size
	_hp_globe.visible = false
	_res_globe.visible = false
	_net_panel.visible = false
	_help.visible = false
	if _legend:
		_legend.visible = false
	_place(_potions_panel, Vector2(8, 80))
	_potions_panel.reset_size()
	_place(_mount, Vector2(116, 80), Vector2(50, 50))
	chat.set_anchors_preset(Control.PRESET_TOP_LEFT)
	chat.position = Vector2(8, 140)
	chat.custom_minimum_size.x = minf(300.0, vp.x * 0.38)
	chat.log_label.custom_minimum_size = Vector2(minf(300.0, vp.x * 0.38), 64)
	_joystick.position = Vector2(16, vp.y - 16 - 112)
	_joystick.size = Vector2(112, 112)
	_touch_actions.position = Vector2(vp.x - 16 - 108, vp.y - 16 - 110)
	_touch_actions.size = Vector2(108, 110)
	_touch_menu.position = Vector2(226, 8)
	_touch_menu.size = Vector2(maxf(120.0, vp.x - 226 - 132), 0)
	_top_col.scale = Vector2(0.75, 0.75)
	_top_col.pivot_offset = Vector2(_top_col.size.x, 0)
	# A smaller hotbar: the dock keeps its place in the bottom column and shrinks round its bottom middle.
	_dock.pivot_offset = Vector2(_dock.size.x / 2.0, _dock.size.y)
	_dock.scale = Vector2(0.78, 0.78)
	_cast.offset_top = -132 - 18
	_cast.offset_bottom = -132

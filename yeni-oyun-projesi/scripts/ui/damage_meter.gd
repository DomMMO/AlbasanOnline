class_name DamageMeter
extends PanelContainer

## The damage / healing meter (Details!-style): your group's
## damage done, healing done or damage taken per fight, past fights and the overall total.

const MODES := {"damage": ["Damage Done", "DPS"], "heal": ["Healing Done", "HPS"], "taken": ["Damage Taken", "DTPS"]}
const FIGHT_GAP_MS := 6000.0
const MAX_HISTORY := 8

var ui: GameUi
var mode := "damage"
var view: Variant = "current"
var current: Variant = null
var history: Array = []
var overall := {}
var _title: Label
var _segment: Label
var _rows: VBoxContainer
var _dirty := true
var _timer := 0.0
var _dragging := false
var _drag_offset := Vector2.ZERO


static func _new_segment(now: float) -> Dictionary:
	return {"start": now, "end": now, "active": 0.0, "actors": {}, "targets": {}}


func _init(owner_ui: GameUi) -> void:
	ui = owner_ui
	overall = _new_segment(0)
	theme_type_variation = "FramePanel"
	custom_minimum_size = Vector2(250, 0)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 2)
	add_child(box)
	var bar := HBoxContainer.new()
	bar.mouse_filter = Control.MOUSE_FILTER_STOP
	bar.gui_input.connect(_on_title_input)
	_title = UiTheme.title_label("Damage Done", 18)
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(_title)
	var mode_btn := MenuButton.new()
	mode_btn.flat = false
	mode_btn.theme_type_variation = "DarkButton"
	mode_btn.text = "☰"
	mode_btn.tooltip_text = "Mode: Damage Done, Healing Done, Damage Taken"
	for key in MODES:
		mode_btn.get_popup().add_item(MODES[key][0])
	mode_btn.get_popup().index_pressed.connect(func(i):
		mode = MODES.keys()[i]
		_dirty = true
		_render())
	bar.add_child(mode_btn)
	var seg_btn := MenuButton.new()
	seg_btn.flat = false
	seg_btn.theme_type_variation = "DarkButton"
	seg_btn.text = "⌛"
	seg_btn.tooltip_text = "Segment: Current Segment, past fights, Overall"
	seg_btn.about_to_popup.connect(func():
		var p := seg_btn.get_popup()
		p.clear()
		p.add_item("Current Segment")
		for i in history.size():
			p.add_item("%s (%s)" % [_segment_name(history[i]), _clock(history[i].active)])
		p.add_item("Overall"))
	seg_btn.get_popup().index_pressed.connect(func(i):
		if i == 0:
			view = "current"
		elif i <= history.size():
			view = i - 1
		else:
			view = "overall"
		_dirty = true
		_render())
	bar.add_child(seg_btn)
	var reset := Button.new()
	reset.text = "⟲"
	reset.focus_mode = Control.FOCUS_NONE
	reset.theme_type_variation = "DarkButton"
	reset.tooltip_text = "Reset"
	reset.pressed.connect(reset_all)
	bar.add_child(reset)
	box.add_child(bar)
	_segment = UiTheme.label("Current Segment", 12, UiTheme.MUTED)
	_segment.add_theme_font_override("font", UiTheme._italic())
	box.add_child(_segment)
	_rows = VBoxContainer.new()
	_rows.add_theme_constant_override("separation", 1)
	box.add_child(_rows)
	Settings.changed.connect(func(): visible = bool(Settings.get_value("damageMeter")))
	visible = bool(Settings.get_value("damageMeter"))


func _ready() -> void:
	var cfg := ConfigFile.new()
	if not Settings.touch and cfg.load("user://windows.cfg") == OK and cfg.has_section_key("pos", "damage-meter"):
		position = cfg.get_value("pos", "damage-meter")
	else:
		_default_position.call_deferred()


func _default_position() -> void:
	var vp := get_viewport_rect().size
	reset_size()
	if Settings.touch:
		# Phones: smaller, under the menu bar and left of the minimap (body.touch #damage-meter),
		# clear of the action buttons.
		scale = Vector2(0.75, 0.75)
		position = Vector2(vp.x - 128 - size.x * scale.x, 44)
		return
	position = Vector2(vp.x - size.x - 8, vp.y - 166 - size.y)


func _on_title_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.double_click:
			var cfg := ConfigFile.new()
			cfg.load("user://windows.cfg")
			if cfg.has_section_key("pos", "damage-meter"):
				cfg.erase_section_key("pos", "damage-meter")
				cfg.save("user://windows.cfg")
			_default_position()
		elif event.pressed:
			_dragging = true
			_drag_offset = get_global_mouse_position() - global_position
		else:
			_dragging = false
			var cfg := ConfigFile.new()
			cfg.load("user://windows.cfg")
			cfg.set_value("pos", "damage-meter", position)
			cfg.save("user://windows.cfg")
	elif event is InputEventMouseMotion and _dragging:
		var vp := get_viewport_rect().size
		var p := get_global_mouse_position() - _drag_offset
		position = Vector2(clampf(p.x, 0, vp.x - size.x), clampf(p.y, 0, vp.y - 40))


func reset_all() -> void:
	current = null
	history = []
	overall = _new_segment(0)
	view = "current"
	_dirty = true
	_render()


func _actor_in(segment: Dictionary, who: Dictionary) -> Dictionary:
	if not segment.actors.has(who.name):
		segment.actors[who.name] = {"name": who.name, "cls": who.cls, "damage": 0.0, "heal": 0.0, "taken": 0.0}
	return segment.actors[who.name]


func _lookup(w: World, session_id: String) -> Variant:
	if session_id != w.room.session_id and not w.party.sessions.has(session_id):
		return null
	var p := w.player_state(session_id)
	return {"name": String(World.f(p, "name", "")), "cls": String(World.f(p, "cls", ""))} if p else null


func record(e: Dictionary, w: World) -> void:
	var amount := float(e.get("amount", 0))
	if amount <= 0:
		return
	var source = _lookup(w, String(e.sourceId))
	var target = _lookup(w, String(e.targetId)) if e.targetKind == "player" else null
	var heal: bool = e.get("heal", false)
	var dealt = source if source and not heal else null
	var healed = source if source and heal else null
	var hurt = target if target and not heal else null
	if not dealt and not healed and not hurt:
		return
	var now := Time.get_ticks_msec() * 1.0
	if current == null or now - float(current.end) > FIGHT_GAP_MS:
		if current != null:
			history.push_front(current)
			history = history.slice(0, MAX_HISTORY)
		if view is int:
			view = mini(view + 1, history.size() - 1)
		current = _new_segment(now)
	else:
		overall.active += now - float(current.end)
	current.end = now
	current.active = current.end - current.start
	var enemy := ""
	if dealt:
		if e.targetKind == "mob":
			var mob = w.mobs.get(String(e.targetId))
			enemy = String(GameData.mob(String(World.f(mob.state, "kind", ""))).get("name", "")) if mob else ""
		else:
			enemy = String(World.f(w.player_state(String(e.targetId)), "name", ""))
	for segment in [current, overall]:
		if dealt:
			_actor_in(segment, dealt).damage += amount
			if not enemy.is_empty():
				segment.targets[enemy] = float(segment.targets.get(enemy, 0)) + amount
		if healed:
			_actor_in(segment, healed).heal += amount
		if hurt:
			_actor_in(segment, hurt).taken += amount
	_dirty = true


func _segment_name(segment: Dictionary) -> String:
	var best := ""
	var top := -1.0
	for name in segment.targets:
		if float(segment.targets[name]) > top:
			top = segment.targets[name]
			best = name
	return best if not best.is_empty() else "Combat"


static func _clock(ms: float) -> String:
	var s := int(ms / 1000.0)
	return "%d:%02d" % [s / 60, s % 60]


static func _short(n: float) -> String:
	if n >= 1000000:
		return "%.2fM" % (n / 1000000.0)
	if n >= 10000:
		return "%.1fk" % (n / 1000.0)
	return str(int(round(n)))


func _shown() -> Variant:
	if view is String and view == "overall":
		return overall if not overall.actors.is_empty() else null
	if view is String and view == "current":
		return current
	return history[view] if view < history.size() else null


func _process(delta: float) -> void:
	if not visible:
		return
	_timer -= delta
	if _timer <= 0 and (_dirty or (view is String and view == "current")):
		_timer = 0.5
		_render()


func _render() -> void:
	_dirty = false
	_title.text = MODES[mode][0]
	var segment = _shown()
	if segment == null:
		_segment.text = "Overall" if (view is String and view == "overall") else "Current Segment"
	elif view is String and view == "overall":
		_segment.text = "Overall · %s" % _clock(segment.active)
	else:
		_segment.text = "%s%s · %s" % ["Current Segment: " if (view is String and view == "current") else "", _segment_name(segment), _clock(segment.active)]
	for c in _rows.get_children():
		c.queue_free()
	var seconds := maxf(1.0, (float(segment.active) if segment else 0.0) / 1000.0)
	var actors: Array = []
	if segment:
		for a in segment.actors.values():
			if float(a[mode]) > 0:
				actors.append(a)
	actors.sort_custom(func(a, b): return a[mode] > b[mode])
	if actors.is_empty():
		var empty := UiTheme.label("No combat data", 12, UiTheme.MUTED)
		empty.add_theme_font_override("font", UiTheme._italic())
		_rows.add_child(empty)
		reset_size.call_deferred()
		return
	var top := float(actors[0][mode])
	var total := 0.0
	for a in actors:
		total += float(a[mode])
	for i in actors.size():
		var a: Dictionary = actors[i]
		var amount := float(a[mode])
		var row := Control.new()
		row.custom_minimum_size = Vector2(230, 18)
		var fill := ColorRect.new()
		fill.color = Color(Color(String(GameData.class_of(String(a.cls)).get("color", "#888888"))), 0.55)
		fill.size = Vector2(230 * amount / top, 18)
		fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(fill)
		var name := UiTheme.label("%d. %s" % [i + 1, a.name], 12, UiTheme.TEXT, true)
		name.position = Vector2(4, 0)
		row.add_child(name)
		var value := UiTheme.label("%s · %s %s · %d%%" % [_short(amount), _short(amount / seconds), MODES[mode][1], int(round(amount / total * 100))], 11)
		value.size = Vector2(226, 18)
		value.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		row.add_child(value)
		var lines: Array = [a.name]
		for m in MODES:
			lines.append("%s: %s (%s %s)" % [MODES[m][0], _short(a[m]), _short(a[m] / seconds), MODES[m][1]])
		row.tooltip_text = "\n".join(lines)
		_rows.add_child(row)
	reset_size.call_deferred()

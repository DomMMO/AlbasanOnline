class_name GameWindow
extends PanelContainer

## An in-game window (client/src/ui/windows.ts): title bar to drag it by, a round close button,
## the content below. Windows open in a stack: Esc closes the newest, clicking one brings it to
## the front, and dragged positions are remembered (user://windows.cfg).

signal closed

const POSITIONS := "user://windows.cfg"
static var _stack: Array[GameWindow] = []

var window_id := ""
var body: VBoxContainer
var title_label: Label
## Called instead of just hiding when the window is closed (Esc or ×).
var on_close: Callable
var _dragging := false
var _drag_offset := Vector2.ZERO
var _anchor_preset := Control.PRESET_CENTER


func _init(id: String, title: String, min_width := 320.0) -> void:
	window_id = id
	name = id
	theme_type_variation = "WindowPanel"
	custom_minimum_size = Vector2(min_width, 0)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 6)
	add_child(root)
	var bar := HBoxContainer.new()
	bar.mouse_filter = Control.MOUSE_FILTER_STOP
	bar.gui_input.connect(_on_title_input)
	bar.mouse_default_cursor_shape = Control.CURSOR_MOVE
	root.add_child(bar)
	title_label = UiTheme.title_label(title, 22)
	title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_label.clip_text = true
	title_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(title_label)
	var close := Button.new()
	close.text = "×"
	close.focus_mode = Control.FOCUS_NONE
	close.custom_minimum_size = Vector2(24, 24)
	close.add_theme_stylebox_override("normal", _round(Color("#5a3a1a"), Color("#2a1a0c")))
	close.add_theme_stylebox_override("hover", _round(Color("#8a2a1a"), Color("#3a0f08")))
	close.add_theme_stylebox_override("pressed", _round(Color("#8a2a1a"), Color("#3a0f08")))
	close.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	close.add_theme_color_override("font_color", UiTheme.GOLD_LIGHT)
	close.add_theme_color_override("font_hover_color", Color.WHITE)
	close.add_theme_font_size_override("font_size", 16)
	close.pressed.connect(close_window)
	bar.add_child(close)
	# Gold rule under the title.
	var rule := ColorRect.new()
	rule.custom_minimum_size = Vector2(0, 1)
	rule.color = Color(UiTheme.GOLD, 0.8)
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(rule)
	body = VBoxContainer.new()
	body.add_theme_constant_override("separation", 6)
	root.add_child(body)
	# Content got smaller (a shorter page, fewer rows): shrink to fit instead of keeping the gap.
	minimum_size_changed.connect(func(): if visible: _refit.call_deferred())


static func _round(top: Color, bottom: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = top.lerp(bottom, 0.5)
	s.border_color = UiTheme.GOLD
	s.set_border_width_all(1)
	s.set_corner_radius_all(12)
	return s


## Where the window sits before the player moves it.
func set_default_anchor(preset: int) -> void:
	_anchor_preset = preset


func is_open() -> bool:
	return visible


func open() -> void:
	if not visible:
		visible = true
		_stack.erase(self)
		_stack.append(self)
		_restore_position.call_deferred()
	bring_to_front()


func toggle(force: Variant = null) -> void:
	var want: bool = (not visible) if force == null else bool(force)
	if want:
		open()
	else:
		close_window()


func close_window() -> void:
	if not visible:
		return
	if on_close.is_valid():
		on_close.call()
	hide_window()


## Hides without running on_close (the owner already cleaned up).
func hide_window() -> void:
	visible = false
	_stack.erase(self)
	closed.emit()


func _refit() -> void:
	reset_size()
	if Settings.touch:
		_fit_screen()
		var viewport := get_viewport_rect().size
		var shown := size * scale
		position.y = clampf(position.y, 6, maxf(6, viewport.y - shown.y - 6))
		position.x = clampf(position.x, 0, maxf(0, viewport.x - shown.x))


func bring_to_front() -> void:
	var parent := get_parent()
	if parent:
		parent.move_child(self, -1)


## Esc: closes the newest open window; false when none is open.
static func close_top() -> bool:
	while not _stack.is_empty():
		var w: GameWindow = _stack.pop_back()
		if is_instance_valid(w) and w.visible:
			w.close_window()
			return true
	return false


static func any_open() -> bool:
	for w in _stack:
		if is_instance_valid(w) and w.visible:
			return true
	return false


static func close_all() -> void:
	for w in _stack.duplicate():
		if is_instance_valid(w):
			w.hide_window()
	_stack.clear()


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		bring_to_front()


func _on_title_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_dragging = true
			_drag_offset = get_global_mouse_position() - global_position
			bring_to_front()
		else:
			_dragging = false
			_save_position()
		accept_event()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.double_click:
		_forget_position()
	elif event is InputEventMouseMotion and _dragging:
		var viewport := get_viewport_rect().size
		var p := get_global_mouse_position() - _drag_offset
		p.x = clampf(p.x, 0, maxf(0, viewport.x - size.x))
		p.y = clampf(p.y, 0, maxf(0, viewport.y - 40))
		position = p
		accept_event()


func _restore_position() -> void:
	reset_size()
	var cfg := ConfigFile.new()
	_fit_screen()
	if cfg.load(POSITIONS) == OK and cfg.has_section_key("pos", window_id) and not Settings.touch:
		var p: Vector2 = cfg.get_value("pos", window_id)
		var viewport := get_viewport_rect().size
		position = Vector2(clampf(p.x, 0, maxf(0, viewport.x - size.x)), clampf(p.y, 0, maxf(0, viewport.y - 40)))
		return
	_place_default()


## Phones: a window bigger than the screen is drawn smaller (it still works the same).
func _fit_screen() -> void:
	var viewport := get_viewport_rect().size
	var k := minf(1.0, minf((viewport.y - 12) / maxf(1.0, size.y), (viewport.x - 12) / maxf(1.0, size.x)))
	scale = Vector2(k, k)


func _place_default() -> void:
	_fit_screen()
	var viewport := get_viewport_rect().size
	match _anchor_preset:
		Control.PRESET_CENTER_RIGHT:
			position = Vector2(viewport.x - size.x - 16, (viewport.y - size.y) / 2.0)
		Control.PRESET_TOP_RIGHT:
			position = Vector2(viewport.x - size.x - 16, 60)
		Control.PRESET_TOP_LEFT:
			position = Vector2(160, 52)
		Control.PRESET_CENTER_LEFT:
			position = Vector2(16, (viewport.y - size.y) / 2.0)
		_:
			position = (viewport - size) / 2.0
	var shown := size * scale
	position.y = clampf(position.y, 6, maxf(6, viewport.y - shown.y - 6))
	position.x = clampf(position.x, 0, maxf(0, viewport.x - shown.x))


func _save_position() -> void:
	var cfg := ConfigFile.new()
	cfg.load(POSITIONS)
	cfg.set_value("pos", window_id, position)
	cfg.save(POSITIONS)


func _forget_position() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(POSITIONS) == OK and cfg.has_section_key("pos", window_id):
		cfg.erase_section_key("pos", window_id)
		cfg.save(POSITIONS)
	_place_default()

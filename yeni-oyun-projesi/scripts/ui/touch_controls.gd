class_name TouchControls
extends RefCounted

## On-screen controls for phones and tablets (client/src/ui/touch.ts): a joystick for walking
## and buttons for what otherwise needs a keyboard. They feed the same actions as the keys.
## Every control follows its own finger (multi-touch), so you can walk and tap at once.


## A round joystick: the knob follows the finger; the direction becomes a -1/0/1 axis pair.
class Joystick extends Control:
	signal axis_changed(axis: Vector2i)

	const DEAD_ZONE := 0.3
	const AXIS_THRESHOLD := 0.38
	var _finger := -2  # -1 = the mouse (testing on a computer)
	var _knob := Vector2.ZERO

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_STOP
		custom_minimum_size = Vector2(112, 112)

	func _input(event: InputEvent) -> void:
		if not is_visible_in_tree():
			return
		if event is InputEventScreenTouch:
			if event.pressed and _finger == -2 and _inside(event.position):
				_finger = event.index
				_move(event.position)
				get_viewport().set_input_as_handled()
			elif not event.pressed and event.index == _finger:
				_release()
		elif event is InputEventScreenDrag and event.index == _finger:
			_move(event.position)
			get_viewport().set_input_as_handled()

	func _gui_input(event: InputEvent) -> void:
		# Mouse, for trying it out on a computer (emulated mice from touches are ignored).
		if event.device == InputEvent.DEVICE_ID_EMULATION:
			accept_event()
			return
		if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				_finger = -1
				_move(event.global_position)
			elif _finger == -1:
				_release()
			accept_event()
		elif event is InputEventMouseMotion and _finger == -1:
			_move(event.global_position)
			accept_event()

	func _inside(p: Vector2) -> bool:
		var r := get_global_rect()
		return p.distance_to(r.get_center()) <= r.size.x / 2.0 * 1.15

	func _release() -> void:
		_finger = -2
		_knob = Vector2.ZERO
		axis_changed.emit(Vector2i.ZERO)
		queue_redraw()

	func _move(p: Vector2) -> void:
		var r := get_global_rect()
		var radius := r.size.x / 2.0
		var v := (p - r.get_center()) / radius
		var length := v.length()
		if length > 1.0:
			v /= length
		_knob = v
		queue_redraw()
		if length < DEAD_ZONE:
			axis_changed.emit(Vector2i.ZERO)
			return
		var n := v / maxf(length, 1e-6)
		var axis := func(c: float) -> int: return 1 if c > AXIS_THRESHOLD else (-1 if c < -AXIS_THRESHOLD else 0)
		axis_changed.emit(Vector2i(axis.call(n.x), axis.call(n.y)))

	func _draw() -> void:
		var c := size / 2.0
		var r := size.x / 2.0
		draw_circle(c, r, Color(0.06, 0.04, 0.02, 0.45))
		draw_arc(c, r - 1, 0, TAU, 48, Color(UiTheme.GOLD, 0.7), 2.0)
		var k := c + _knob * r * 0.6
		draw_circle(k, r * 0.41, Color(UiTheme.GOLD, 0.85))
		draw_arc(k, r * 0.41, 0, TAU, 32, Color("#2a1a08"), 1.5)


## A gold (or dark) button that answers every finger, not just the first.
class TouchButton extends Control:
	signal pressed

	var text := ""
	var round := false
	var big := false
	var dark := false
	var _down_until := 0

	func _init(label: String, is_round := false, is_dark := false) -> void:
		text = label
		round = is_round
		dark = is_dark
		mouse_filter = Control.MOUSE_FILTER_STOP

	func _input(event: InputEvent) -> void:
		if not is_visible_in_tree():
			return
		if event is InputEventScreenTouch and event.pressed and get_global_rect().has_point(event.position):
			_fire()
			get_viewport().set_input_as_handled()

	func _gui_input(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
			if event.device != InputEvent.DEVICE_ID_EMULATION:
				_fire()
			accept_event()

	func _fire() -> void:
		_down_until = Time.get_ticks_msec() + 120
		queue_redraw()
		get_tree().create_timer(0.13).timeout.connect(queue_redraw)
		pressed.emit()

	func _draw() -> void:
		var r := Rect2(Vector2.ZERO, size)
		var down := Time.get_ticks_msec() < _down_until
		var top := Color("#3a2a18") if dark else Color("#f2d58c")
		var bottom := Color("#1f150c") if dark else Color("#8a6a28")
		if down:
			top = top.darkened(0.2)
			bottom = bottom.darkened(0.2)
		if round:
			var c := size / 2.0
			var rad := minf(size.x, size.y) / 2.0
			draw_circle(c, rad, bottom)
			draw_circle(c - Vector2(0, rad * 0.15), rad * 0.85, top.lerp(bottom, 0.3))
			draw_arc(c, rad - 1, 0, TAU, 40, Color("#2a1a08") if not dark else UiTheme.GOLD_DARK, 2.0)
		else:
			var pill := StyleBoxFlat.new()
			pill.set_corner_radius_all(int(minf(size.y / 2.0, 26)) if big else 4)
			pill.bg_color = top.lerp(bottom, 0.5)
			pill.border_color = Color("#2a1a08") if not dark else UiTheme.GOLD_DARK
			pill.set_border_width_all(1)
			draw_style_box(pill, r)
		var font := Fonts.title() if big or round else Fonts.serif(true)
		var fs := 18 if round else (16 if big else 12)
		var color := UiTheme.GOLD_LIGHT if dark else Color("#2a1a08")
		var ts := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
		draw_string(font, Vector2((size.x - ts.x) / 2.0, (size.y + font.get_ascent(fs) - font.get_descent(fs)) / 2.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, color)

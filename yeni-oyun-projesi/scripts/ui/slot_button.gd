class_name SlotButton
extends Control

## A hotbar / potion slot (.slot): skill-coloured tile with its icon, the key in the corner, the
## cooldown sweep from the bottom, a count for items, greyed when it can't be used.

signal used
signal hovered(inside: bool)
signal right_clicked

var icon: Texture2D
var key_label := ""
var count_text := ""
var tint := Color("#1f150c")
var empty := true
var dimmed := false
var locked := false
## 0..1 of the slot covered by the cooldown sweep.
var sweep := 0.0
## Seconds left on the slot's own cooldown, drawn in the middle ("" = none).
var cooldown_text := ""
var _pressed_until := 0
## Drag & drop: what this slot hands out when dragged (null = nothing) and what it accepts.
var drag_data: Variant = null
var can_drop: Callable
var dropped: Callable


func _init(slot_size := 44.0) -> void:
	custom_minimum_size = Vector2(slot_size, slot_size)
	mouse_filter = Control.MOUSE_FILTER_STOP
	mouse_entered.connect(func(): hovered.emit(true))
	mouse_exited.connect(func(): hovered.emit(false))


func press_flash() -> void:
	_pressed_until = Time.get_ticks_msec() + 150
	queue_redraw()


func _process(_delta: float) -> void:
	queue_redraw()


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			press_flash()
			used.emit()
			accept_event()
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			right_clicked.emit()
			accept_event()


func _get_drag_data(_at_position: Vector2) -> Variant:
	if drag_data == null:
		return null
	var preview := TextureRect.new()
	preview.texture = icon
	preview.custom_minimum_size = size
	preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	preview.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	preview.modulate.a = 0.8
	set_drag_preview(preview)
	hovered.emit(false)
	return drag_data


func _can_drop_data(_at_position: Vector2, data: Variant) -> bool:
	return can_drop.is_valid() and can_drop.call(data)


func _drop_data(_at_position: Vector2, data: Variant) -> void:
	if dropped.is_valid():
		dropped.call(data)


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size)
	var scale := 0.88 if Time.get_ticks_msec() < _pressed_until else 1.0
	if scale != 1.0:
		draw_set_transform(size / 2.0 * (1.0 - scale), 0, Vector2(scale, scale))
	draw_rect(r, Color("#0c0805") if empty else tint)
	if icon and not empty:
		var tex_filter := CanvasItem.TEXTURE_FILTER_LINEAR if icon.get_width() >= 32 else CanvasItem.TEXTURE_FILTER_NEAREST
		texture_filter = tex_filter
		var inset := 2.0
		draw_texture_rect(icon, r.grow(-inset), false, Color(0.45, 0.45, 0.45) if (dimmed or locked) else Color.WHITE)
	if sweep > 0.0:
		draw_rect(Rect2(0, r.size.y * (1.0 - sweep), r.size.x, r.size.y * sweep), Color(0, 0, 0, 0.72))
	draw_rect(r, Color.BLACK, false, 1.0)
	draw_rect(r.grow(-1), Color(UiTheme.GOLD_DARK), false, 1.0)
	var font := Fonts.serif(true)
	if not key_label.is_empty():
		draw_string(font, Vector2(4, 12), key_label, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color.BLACK)
		draw_string(font, Vector2(3, 11), key_label, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, UiTheme.GOLD_LIGHT)
	if not cooldown_text.is_empty():
		var font_size := 16 if r.size.y >= 40 else 13
		var text_size := font.get_string_size(cooldown_text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size)
		var at := Vector2((r.size.x - text_size.x) / 2.0, (r.size.y + font.get_ascent(font_size) - font.get_descent(font_size)) / 2.0)
		draw_string_outline(font, at, cooldown_text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, 4, Color.BLACK)
		draw_string(font, at, cooldown_text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, Color.WHITE)
	if not count_text.is_empty():
		var w := font.get_string_size(count_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
		draw_string(font, Vector2(r.size.x - w - 2, r.size.y - 2), count_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.BLACK)
		draw_string(font, Vector2(r.size.x - w - 3, r.size.y - 3), count_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.WHITE)

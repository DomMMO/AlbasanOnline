class_name Bar
extends Control

## A health / resource / XP bar (.bar in style.css): dark trough, gradient fill with a light top
## edge, centred text. The fill eases to its new width (CSS transition 120 ms).

const FILLS := {
	"hp": ["#e8564a", "#a8241a", "#7a150e"],
	"rage": ["#ffa24a", "#d9681c", "#8a3a0c"],
	"mana": ["#6aa8ff", "#2f6fd9", "#163c8a"],
	"energy": ["#ffe066", "#e0a800", "#7a5c00"],
	"xp": ["#c49bff", "#8e5bd9", "#5a2f9a"],
}

var kind := "hp"
var text := ""
var font_size := 11
var shielded := false
var _target := 1.0
var _shown := 1.0
var border := true


func _init(bar_kind := "hp", height := 15.0) -> void:
	kind = bar_kind
	custom_minimum_size = Vector2(0, height)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func set_value(value: float, max_value: float, label := "") -> void:
	_target = clampf(value / max_value, 0.0, 1.0) if max_value > 0 else 0.0
	text = label
	queue_redraw()


func set_kind(value: String) -> void:
	if value != kind:
		kind = value
		queue_redraw()


func _process(delta: float) -> void:
	if not is_equal_approx(_shown, _target):
		_shown = move_toward(_shown, _target, delta / 0.12)
		queue_redraw()


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size)
	draw_rect(r, Color("#0a0605"))
	draw_rect(Rect2(0, r.size.y * 0.5, r.size.x, r.size.y * 0.5), Color("#1e1410"))
	var w := r.size.x * _shown
	if w > 0:
		var stops: Array = FILLS.get(kind, FILLS.hp)
		var top := Color(stops[0])
		var mid := Color(stops[1])
		var bottom := Color(stops[2])
		var h := r.size.y
		draw_polygon(PackedVector2Array([Vector2(0, 0), Vector2(w, 0), Vector2(w, h * 0.6), Vector2(0, h * 0.6)]), PackedColorArray([top, top, mid, mid]))
		draw_polygon(PackedVector2Array([Vector2(0, h * 0.6), Vector2(w, h * 0.6), Vector2(w, h), Vector2(0, h)]), PackedColorArray([mid, mid, bottom, bottom]))
		draw_rect(Rect2(0, 0, w, 1), Color(1, 1, 1, 0.33))
		draw_rect(Rect2(0, h - 2, w, 2), Color(0, 0, 0, 0.33))
	if border:
		draw_rect(r, Color.BLACK, false, 1.0)
		draw_rect(r.grow(1), Color(UiTheme.GOLD, 0.27), false, 1.0)
	if shielded:
		draw_rect(r.grow(1), Color("#74c0fc"), false, 1.0)
	if not text.is_empty():
		var font := Fonts.serif(true)
		var ts := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size)
		var pos := Vector2((r.size.x - ts.x) / 2.0, (r.size.y + font.get_ascent(font_size) - font.get_descent(font_size)) / 2.0)
		draw_string(font, pos + Vector2(1, 1), text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, Color.BLACK)
		draw_string(font, pos, text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, UiTheme.TEXT)

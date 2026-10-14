class_name Globe
extends Control

## The health / resource globes (#hp-globe, #resource-globe): liquid that eases to its level with
## two rolling waves on top, glass with a reflection, and the ornate frame from
## ui/globeFrame.ts (baked to art/ui/globe_*_back/front.png) with the numbers on its plinth.

const LIQUIDS := {
	"hp": ["#ff6b6b", "#7a0f0f", "#ff8787"],
	"mana": ["#4dabf7", "#0b2f6b", "#74c0fc"],
	"rage": ["#ff922b", "#6b2a05", "#ffa94d"],
	"energy": ["#ffe066", "#7a5c00", "#fff3bf"],
}

var kind := "hp"
var text := ""
var low := false
var shielded := false
var _back: Texture2D
var _front: Texture2D
var _target := 1.0
var _level := 1.0
var _slosh_until := 0.0


func _init(frame: String, liquid: String) -> void:
	kind = liquid
	_back = Art.tex("res://art/ui/globe_%s_back.png" % frame)
	_front = Art.tex("res://art/ui/globe_%s_front.png" % frame)
	custom_minimum_size = Vector2(150, 150)
	size = Vector2(150, 150)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func set_value(value: float, max_value: float, label: String) -> void:
	_target = clampf(value / max_value, 0.0, 1.0) if max_value > 0 else 0.0
	text = label
	low = kind == "hp" and _target < 0.35


func set_kind(value: String) -> void:
	kind = value


## A heavy blow while low on health: the liquid sloshes.
func slosh() -> void:
	if _target < 0.35:
		_slosh_until = Time.get_ticks_msec() + 900.0


func _process(delta: float) -> void:
	# CSS: height 0.6s cubic-bezier ease.
	_level = lerpf(_level, _target, minf(1.0, delta * 6.0))
	queue_redraw()


func _draw() -> void:
	var s := size.x
	if _back:
		draw_texture_rect(_back, Rect2(Vector2.ZERO, size), false)
	var center := Vector2(s / 2.0, s / 2.0)
	var radius := s * 0.4
	# Glass background.
	draw_circle(center, radius, Color("#140d07"))
	var colors: Array = LIQUIDS.get(kind, LIQUIDS.hp)
	var top := Color(colors[0])
	var bottom := Color(colors[1])
	var wave := Color(colors[2])
	var t := Time.get_ticks_msec() / 1000.0
	var slosh := 0.0
	if Time.get_ticks_msec() < _slosh_until:
		slosh = sin(t * 18.0) * 6.0 * (_slosh_until - Time.get_ticks_msec()) / 900.0
	var surface := center.y + radius - _level * radius * 2.0
	if _level > 0.001:
		# The liquid: rows of the circle below the surface, coloured top to bottom.
		var rows := 48
		for i in rows:
			var y0 := center.y - radius + radius * 2.0 * i / rows
			var y1 := center.y - radius + radius * 2.0 * (i + 1) / rows
			if y1 <= surface:
				continue
			y0 = maxf(y0, surface)
			var dy := (y0 + y1) / 2.0 - center.y
			var half := sqrt(maxf(0.0, radius * radius - dy * dy))
			var k := clampf((y0 - surface) / maxf(1.0, center.y + radius - surface), 0.0, 1.0)
			draw_rect(Rect2(center.x - half, y0, half * 2.0, y1 - y0 + 0.5), top.lerp(bottom, k))
		# Two wave strips rolling at different speeds.
		for layer in 2:
			var period := 28.0 if layer == 0 else 36.0
			var speed := (period * 2.0) / (3.2 if layer == 0 else 5.0) * (1.0 if layer == 0 else -1.0)
			var alpha := 1.0 if layer == 0 else 0.55
			var offset := fmod(t * speed, period)
			var x := center.x - radius - period + offset
			while x < center.x + radius + period:
				for dx in range(-int(period / 2.0), int(period / 2.0)):
					var px := x + dx
					var dyc := surface - center.y
					var limit := sqrt(maxf(0.0, radius * radius - dyc * dyc))
					if px < center.x - limit or px > center.x + limit:
						continue
					var hump := sqrt(maxf(0.0, 1.0 - pow(dx / (period / 2.0), 2.0))) * 4.0
					draw_rect(Rect2(px, surface - hump + slosh * (1.0 if layer == 0 else -0.6) + (2.0 if layer == 1 else 0.0), 1, hump + 1), Color(wave, alpha))
				x += period
	# Glass: a soft rim and the reflection.
	draw_arc(center, radius - 2, 0, TAU, 64, Color("#1a0f0a", 0.5), 6.0)
	_draw_ellipse(center + Vector2(-radius * 0.32, -radius * 0.52), Vector2(radius * 0.68, radius * 0.44), Color(1, 1, 1, 0.22))
	if low:
		draw_arc(center, radius - 1, 0, TAU, 64, Color(1, 0.2, 0.2, 0.35 + 0.25 * sin(t * 6.0)), 3.0)
	if shielded:
		draw_arc(center, radius + 1, 0, TAU, 64, Color("#74c0fc"), 2.0)
	if _front:
		draw_texture_rect(_front, Rect2(Vector2.ZERO, size), false)
	if not text.is_empty():
		var font := Fonts.serif(true)
		var fs := 11
		var ts := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
		var pos := Vector2((s - ts.x) / 2.0, s * 0.925 + font.get_ascent(fs) / 2.0 - 1)
		draw_string(font, pos + Vector2(1, 1), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.BLACK)
		draw_string(font, pos, text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, UiTheme.GOLD_LIGHT)


func _draw_ellipse(c: Vector2, r: Vector2, color: Color) -> void:
	var pts := PackedVector2Array()
	for i in 24:
		var a := TAU * i / 24.0
		pts.append(c + Vector2(cos(a) * r.x / 2.0, sin(a) * r.y / 2.0))
	var cols := PackedColorArray()
	cols.resize(pts.size())
	cols.fill(color)
	draw_polygon(pts, cols)

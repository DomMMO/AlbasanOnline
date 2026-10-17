class_name Globe
extends Control

## A health / resource / cast globe: liquid in a glass sphere in a gold frame, the numbers across
## its middle.
##
## Pixel art: the sphere is drawn small (one texel per screen `pixel`) into its own viewport and
## shown scaled up without smoothing, nothing anti-aliased, so it sits with the game's sprites.
##
## The liquid is one flat colour: the kind's lightest when full, darker as it drains, its darkest at
## the critical level. It behaves like water: its level hangs on a spring (it overshoots a little and
## settles), every change stirs the surface, the surface is a sum of travelling waves with a darker
## back wave behind it and a light line along its top.
## The glass (after the user's reference): pale blue, diagonal light streaks, a round highlight at the
## top left. The frame: the UI's gold ring, studs at the four sides and a gem on top.
## A health globe cracks when the health gets critical (the reference's crack: down from the top to
## the lower left, forked at both ends; more at each stage), each stage hitting with a white slash and
## flying shards first. Gone again once healed.

const LIQUIDS := {
	# Lightest (full), darkest (critical), the gem on the frame.
	# Health starts at the enemy nameplates' red (entity_view.gd, _paint_plate).
	"hp": ["#9e1f1f", "#4a080b", "#e03131"],
	"mana": ["#4dabf7", "#0b2f6b", "#1c7ed6"],
	"rage": ["#ff922b", "#6b2a05", "#e8590c"],
	"energy": ["#ffe066", "#7a5c00", "#f59f00"],
	# A target's cast: yellow (an interrupt stops it), grey (only a stun does), red (cut off).
	"cast": ["#ffd43b", "#ffd43b", "#f59f00"],
	"cast_grey": ["#ced4da", "#ced4da", "#868e96"],
	"cast_cut": ["#ff6b6b", "#ff6b6b", "#e03131"],
}
## Spring on the level: stiffness and damping (slightly under-damped, so it overshoots a touch).
const STIFFNESS := 60.0
const DAMPING := 11.0
## The frame's outer edge as a share of the control's side; texels of frame inside it.
const OUTER := 0.465
const FRAME := 3
## Health shares where the glass cracks, cracks further, and is all but shattered.
const CRACK_AT := [0.35, 0.2, 0.1]
## Where the colour is darkest.
const DARKEST_AT := 0.1
## A crack stage arriving: the white slash, then the shards flying, then the crack as it stays.
const SLASH_MS := 110.0
const SHARDS_MS := 380.0
const SHAKE_MS := 300.0
const CRACK_DARK := Color("#686e93")
const CRACK_DEEP := Color("#45444f")
const CRACK_LIGHT := Color("#e6f1ff")

var kind := "hp"
var text := ""
var low := false
var shielded := false
## Dimmed (an empty cast globe while the target is not casting).
var idle := false
## Screen pixels per texel (set by the HUD so every globe has the same pixel size).
var pixel := 3:
	set(value):
		pixel = maxi(1, value)
		_resize_canvas()
var _target := 1.0
var _level := 1.0
var _speed := 0.0
## How stirred the surface is (grows with every change, calms down by itself).
var _stir := 0.0
var _slosh_until := 0.0
var _crack_stage := 0
var _crack_since := -100000.0
var _shake_until := 0.0
## Shards of the last hit: start (unit coordinates), direction, speed.
var _shards: Array = []
var _canvas: SubViewport
var _painter: Node2D
## The still parts, built texel by texel for the canvas size: behind the liquid (the pale glass), in
## front of it (highlights and the frame), and the frame's ring alone (tinted for low health / shield).
var _glass_back: ImageTexture
var _glass_front: ImageTexture
var _glass_rim: ImageTexture

## The cracks, after the reference (unit coordinates, radius 1, y down), by the stage they show from.
const CRACKS := [
	# 1: the main fracture down from the top, forked where it enters, a short branch to the right.
	[0, [Vector2(0.08, -1.0), Vector2(0.05, -0.78), Vector2(-0.02, -0.55), Vector2(-0.08, -0.3), Vector2(-0.14, -0.08)]],
	[0, [Vector2(-0.12, -0.99), Vector2(-0.03, -0.8), Vector2(0.03, -0.66)]],
	[0, [Vector2(0.05, -0.72), Vector2(0.28, -0.62), Vector2(0.52, -0.62)]],
	# 2: on down to the lower left, splitting into strands at the bottom.
	[1, [Vector2(-0.14, -0.08), Vector2(-0.22, 0.2), Vector2(-0.32, 0.45), Vector2(-0.42, 0.7), Vector2(-0.55, 0.84)]],
	[1, [Vector2(-0.32, 0.45), Vector2(-0.3, 0.7), Vector2(-0.24, 0.96)]],
	[1, [Vector2(-0.42, 0.7), Vector2(-0.62, 0.72), Vector2(-0.74, 0.66)]],
	[1, [Vector2(-0.22, 0.2), Vector2(-0.05, 0.5), Vector2(0.02, 0.98)]],
	# 3: a second fracture in from the right, branching through the middle.
	[2, [Vector2(0.98, 0.12), Vector2(0.7, 0.1), Vector2(0.45, 0.18), Vector2(0.2, 0.12), Vector2(-0.14, -0.08)]],
	[2, [Vector2(0.45, 0.18), Vector2(0.52, 0.45), Vector2(0.62, 0.76)]],
	[2, [Vector2(0.7, 0.1), Vector2(0.78, -0.2), Vector2(0.86, -0.46)]],
	[2, [Vector2(0.2, 0.12), Vector2(0.18, 0.4), Vector2(0.28, 0.62)]],
]


## `_frame` is kept for the callers; every globe has the same frame.
func _init(_frame: String, liquid: String, side := 150.0) -> void:
	kind = liquid
	custom_minimum_size = Vector2(side, side)
	size = Vector2(side, side)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_canvas = SubViewport.new()
	_canvas.transparent_bg = true
	_canvas.disable_3d = true
	_canvas.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_painter = Node2D.new()
	_painter.draw.connect(func(): _paint(_painter))
	_canvas.add_child(_painter)
	add_child(_canvas)
	resized.connect(_resize_canvas)
	_resize_canvas()


func _resize_canvas() -> void:
	if _canvas:
		var side := maxi(16, int(ceil(size.x / pixel)))
		if _canvas.size != Vector2i(side, side) or _glass_back == null:
			_canvas.size = Vector2i(side, side)
			_build_glass(side)


func set_value(value: float, max_value: float, label: String) -> void:
	var target := clampf(value / max_value, 0.0, 1.0) if max_value > 0 else 0.0
	# The bigger the change, the more the surface stirs.
	_stir = minf(1.0, _stir + absf(target - _target) * 4.0)
	_target = target
	text = label
	low = kind == "hp" and _target < CRACK_AT[0]
	var stage := 0
	if kind == "hp":
		for limit in CRACK_AT:
			if _target < limit and _target > 0.0:
				stage += 1
	if stage > _crack_stage:
		_hit(stage)
	_crack_stage = stage


## Straight to a level, no spring (a cast globe starting over).
func set_level_now(value: float) -> void:
	_target = clampf(value, 0.0, 1.0)
	_level = _target
	_speed = 0.0


func set_kind(value: String) -> void:
	kind = value
	if _canvas:
		_build_glass(_canvas.size.x)


## A heavy blow while low on health: the liquid sloshes.
func slosh() -> void:
	_stir = 1.0
	if _target < CRACK_AT[0]:
		_slosh_until = Time.get_ticks_msec() + 900.0


## A new crack stage: slash, shards off the new cracks' ends, a jolt.
func _hit(stage: int) -> void:
	var now := Time.get_ticks_msec()
	_crack_since = now
	_shake_until = now + SHAKE_MS
	_shards.clear()
	for crack in CRACKS:
		if crack[0] != stage - 1:
			continue
		var pts: Array = crack[1]
		for end in [pts[0], pts[pts.size() - 1]]:
			var p: Vector2 = end
			if p.length() < 0.85:
				continue
			for k in 3:
				var dir := (p.normalized() + Vector2(randf_range(-0.5, 0.5), randf_range(-0.5, 0.5))).normalized()
				_shards.append({"from": p, "dir": dir, "speed": randf_range(0.5, 1.0), "len": randi_range(1, 3)})


func _process(delta: float) -> void:
	delta = minf(delta, 0.05)
	var accel := STIFFNESS * (_target - _level) - DAMPING * _speed
	_speed += accel * delta
	_level = clampf(_level + _speed * delta, 0.0, 1.0)
	# The surface calms down; a moving level keeps it a little stirred.
	_stir = maxf(0.0, _stir - delta * 0.55) + minf(0.3, absf(_speed) * 0.6) * delta
	_painter.queue_redraw()
	queue_redraw()


func _draw() -> void:
	var side := float(_canvas.size.x * pixel)
	var at := ((size - Vector2(side, side)) / 2.0).round()
	var now := Time.get_ticks_msec()
	if now < _shake_until:
		at += Vector2(randi_range(-1, 1), randi_range(-1, 1)) * pixel
	draw_texture_rect(_canvas.get_texture(), Rect2(at, Vector2(side, side)), false)
	# Shards fly out past the frame (drawn on the screen, in texel-sized squares).
	var since := now - _crack_since
	if since < SHARDS_MS and since > SLASH_MS * 0.5:
		var geo := _geometry(_canvas.size.x)
		var glass: float = geo[1]
		var center: Vector2 = at + geo[0] * pixel
		var k := (since - SLASH_MS * 0.5) / (SHARDS_MS - SLASH_MS * 0.5)
		for sh in _shards:
			var p: Vector2 = center + (sh.from * glass + sh.dir * (glass * 0.15 + glass * 0.9 * k * sh.speed)) * pixel
			for i in int(sh.len):
				var q: Vector2 = (p - sh.dir * i * pixel).snapped(Vector2(pixel, pixel))
				draw_rect(Rect2(q, Vector2(pixel, pixel)), Color(1, 1, 1, 1.0 - k * 0.6))
	if not text.is_empty():
		var font := Fonts.names()
		var fs := 16 if size.x >= 160 else (13 if size.x >= 120 else 11)
		var ts := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
		var pos := Vector2((size.x - ts.x) / 2.0, size.y / 2.0 + font.get_ascent(fs) / 2.0 - 2.0).round()
		draw_string_outline(font, pos, text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 4, Color(0, 0, 0, 0.9))
		draw_string(font, pos, text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 0.97, 0.9))


## Texel geometry for a canvas side: the centre, the glass's radius (inside the frame), the liquid's.
func _geometry(side: float) -> Array:
	var outer := floorf(side * OUTER)
	var glass := outer - FRAME
	return [Vector2(side / 2.0, side / 2.0), glass, glass]


## The still parts, texel by texel.
func _build_glass(side: int) -> void:
	var geo := _geometry(side)
	var center: Vector2 = geo[0]
	var glass: float = geo[1]
	var outer := glass + FRAME
	var back := Image.create(side, side, false, Image.FORMAT_RGBA8)
	var front := Image.create(side, side, false, Image.FORMAT_RGBA8)
	var rim := Image.create(side, side, false, Image.FORMAT_RGBA8)
	var streaks := [
		[Vector2(-0.78, 0.2), Vector2(-0.12, -0.5), 1.0],
		[Vector2(-0.62, 0.42), Vector2(0.1, -0.36), 0.7],
		[Vector2(0.38, -0.66), Vector2(0.58, -0.84), 0.8],
	]
	for y in side:
		for x in side:
			var p := Vector2(x + 0.5, y + 0.5)
			var d := p.distance_to(center)
			var u := (p - center) / glass
			if d < glass:
				# The pale glass behind the liquid.
				back.set_pixel(x, y, Color(0.8, 0.86, 0.99, 0.3))
				var c := Color(0, 0, 0, 0)
				for st in streaks:
					if _segment_distance(u, st[0], st[1]) * glass < 1.0:
						c = Color(1, 1, 1, 0.42 * st[2])
				# Small bright edges at the bottom left and right, as in the reference.
				if d >= glass - 1.5 and u.y > 0.55 and absf(u.x) > 0.35 and absf(u.x) < 0.75:
					c = Color(1, 1, 1, 0.35)
				front.set_pixel(x, y, c)
			elif d < outer:
				# The frame: dark gold outside, gold, light gold on the upper left, a dark line inside.
				var ring := d - glass
				var lit := (p - center).normalized().dot(Vector2(-0.7, -0.7))
				var c: Color
				if ring < 1.0:
					c = UiTheme.WOOD_DARK
				elif ring < FRAME - 1:
					c = UiTheme.GOLD_LIGHT if lit > 0.45 else (UiTheme.GOLD_DARK if lit < -0.45 else UiTheme.GOLD)
				else:
					c = UiTheme.GOLD_DARK if lit < 0.3 else UiTheme.GOLD
				front.set_pixel(x, y, c)
				rim.set_pixel(x, y, Color.WHITE)
	# The round highlight at the top left.
	var hl := center + Vector2(-0.5, -0.52) * glass
	var hr := maxf(1.5, glass * 0.11)
	for y in range(int(hl.y - hr - 1), int(hl.y + hr + 2)):
		for x in range(int(hl.x - hr - 1), int(hl.x + hr + 2)):
			if Vector2(x + 0.5, y + 0.5).distance_to(hl) < hr and x >= 0 and y >= 0 and x < side and y < side:
				front.set_pixel(x, y, Color(1, 1, 1, 0.5))
	# Studs on the four sides, a gem on top.
	var gem := Color(LIQUIDS.get(kind, LIQUIDS.hp)[2])
	for a in [0.0, PI / 2.0, PI, PI * 1.5]:
		var c := (center + Vector2(cos(a), sin(a)) * (glass + FRAME / 2.0)).floor()
		var top := is_equal_approx(a, PI * 1.5)
		var r := 2 if top else 1
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if absf(dx) + absf(dy) > r + (1 if top else 0):
					continue
				var col: Color = gem if top else UiTheme.GOLD
				if dx + dy <= -r:
					col = gem.lightened(0.5) if top else UiTheme.GOLD_LIGHT
				elif dx + dy >= r:
					col = gem.darkened(0.4) if top else UiTheme.GOLD_DARK
				var px := int(c.x) + dx
				var py := int(c.y) + dy
				if px >= 0 and py >= 0 and px < side and py < side:
					front.set_pixel(px, py, col)
		if top:
			front.set_pixel(int(c.x) - 1, int(c.y) - 1, Color.WHITE)
	_glass_back = ImageTexture.create_from_image(back)
	_glass_front = ImageTexture.create_from_image(front)
	_glass_rim = ImageTexture.create_from_image(rim)


func _segment_distance(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var t := clampf((p - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
	return p.distance_to(a + ab * t)


## The liquid's flat colour: the lightest when full, the darkest at the critical level.
func _liquid_color() -> Color:
	var colors: Array = LIQUIDS.get(kind, LIQUIDS.hp)
	var k := clampf((_level - DARKEST_AT) / (1.0 - DARKEST_AT), 0.0, 1.0)
	var c := Color(colors[1]).lerp(Color(colors[0]), k)
	return c.darkened(0.55) if idle else c


## The sphere, drawn small on the canvas.
func _paint(ci: CanvasItem) -> void:
	var s := float(_canvas.size.x)
	var geo := _geometry(s)
	var center: Vector2 = geo[0]
	var glass: float = geo[1]
	var radius: float = geo[2]
	var liquid := _liquid_color()
	var t := Time.get_ticks_msec() / 1000.0
	ci.draw_texture(_glass_back, Vector2.ZERO)
	var slosh := 0.0
	if Time.get_ticks_msec() < _slosh_until:
		slosh = sin(t * 14.0) * (_slosh_until - Time.get_ticks_msec()) / 900.0
	var surface := center.y + radius - _level * radius * 2.0
	# Wave height in texels: always a gentle swell, much more when stirred.
	var amp := radius * (0.03 + 0.11 * _stir)
	if _level > 0.002:
		_draw_liquid(ci, center, radius, func(x: float) -> float:
			return surface + _wave(x / radius, t + 1.7, amp * 0.9, -slosh) - amp * 0.4, liquid.darkened(0.3), Color(0, 0, 0, 0))
		_draw_liquid(ci, center, radius, func(x: float) -> float:
			return surface + _wave(x / radius, t, amp, slosh), liquid, liquid.lightened(0.35))
	ci.draw_texture(_glass_front, Vector2.ZERO)
	if _crack_stage > 0:
		_draw_cracks(ci, center, glass)
	if low:
		ci.draw_texture(_glass_rim, Vector2.ZERO, Color(1, 0.3, 0.25, 0.25 + 0.3 * sin(t * 6.0)))
	if shielded:
		ci.draw_texture(_glass_rim, Vector2.ZERO, Color(0.45, 0.75, 0.99, 0.55))


## The surface's height offset at u (-1..1 across the globe): travelling waves of different lengths
## and speeds, plus a tilt while sloshing.
func _wave(u: float, t: float, amp: float, slosh: float) -> float:
	var y := sin(u * 5.0 + t * 2.1) * 0.5 + sin(u * 9.0 - t * 3.3) * 0.3 + sin(u * 14.0 + t * 4.7) * 0.2
	return y * amp + slosh * u * _canvas.size.x * 0.06


## The liquid under `surface(x)` (x from the centre), clipped to the circle: one flat column per texel,
## a `line` texel on top of each (none when transparent).
func _draw_liquid(ci: CanvasItem, center: Vector2, radius: float, surface: Callable, color: Color, line: Color) -> void:
	var x0 := int(floor(center.x - radius))
	var x1 := int(ceil(center.x + radius))
	for px in range(x0, x1):
		var x := px + 0.5 - center.x
		var h := sqrt(maxf(0.0, radius * radius - x * x))
		if h <= 0.0:
			continue
		var y_top := roundf(clampf(surface.call(x), center.y - h, center.y + h))
		var y_bot := roundf(center.y + h)
		if y_top >= y_bot:
			continue
		ci.draw_rect(Rect2(px, y_top, 1, y_bot - y_top), color)
		if line.a > 0.0:
			ci.draw_rect(Rect2(px, y_top, 1, 1), line)


## The cracks up to the current stage. The newest stage first shows as a white slash along its lines,
## then as the crack. A crack: a dark line, light texels beside it, deep chips where lines meet.
func _draw_cracks(ci: CanvasItem, center: Vector2, glass: float) -> void:
	var since := Time.get_ticks_msec() - _crack_since
	for crack in CRACKS:
		var stage: int = crack[0]
		if stage >= _crack_stage:
			continue
		var pts: Array = crack[1]
		var slash := stage == _crack_stage - 1 and since < SLASH_MS
		for i in pts.size() - 1:
			var a: Vector2 = (center + pts[i] * glass).floor()
			var b: Vector2 = (center + pts[i + 1] * glass).floor()
			if slash:
				_pixel_line(ci, a, b, Color.WHITE)
				_pixel_line(ci, a + Vector2(1, 0), b + Vector2(1, 0), Color.WHITE)
				continue
			_pixel_line(ci, a + Vector2(1, 0), b + Vector2(1, 0), CRACK_LIGHT)
			_pixel_line(ci, a, b, CRACK_DARK)
		if not slash:
			var start: Vector2 = (center + pts[0] * glass).floor()
			ci.draw_rect(Rect2(start - Vector2(1, 0), Vector2(2, 2)), CRACK_DEEP)


## A one-texel line, texel by texel (no smoothing).
func _pixel_line(ci: CanvasItem, a: Vector2, b: Vector2, color: Color) -> void:
	var n := int(maxf(absf(b.x - a.x), absf(b.y - a.y)))
	for i in n + 1:
		var p := a.lerp(b, float(i) / maxf(1.0, n)).floor()
		ci.draw_rect(Rect2(p, Vector2.ONE), color)

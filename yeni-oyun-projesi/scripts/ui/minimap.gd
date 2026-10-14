class_name Minimap
extends PanelContainer

## The minimap: 21 tiles round you, dots for you, your party, other
## players, NPCs, portals, pings, and a pulsing arrow where a guard told you to go. M hides it.

const VIEW_RADIUS := 10
const SIZE := 128
const HIDDEN_FILE := "user://settings.cfg"
## Colours that read better from far away than the tiles' own (map.ts Tile ids).
const MINIMAP_COLORS := {4: "#2b5422", 17: "#8ec8ee", 12: "#5a4636", 11: "#4d483f", 10: "#d9a441", 26: "#2a221c"}
const DOT_STYLE := {
	"portal": ["#c084fc", 2.5, 0],
	"npc": ["#74c0fc", 2.0, 1],
	"player": ["#ffffff", 2.0, 2],
	"enemy": ["#ff5a5a", 2.5, 3],
	"party": ["#4cd964", 3.0, 4],
	"self": ["#ffe14d", 3.0, 5],
	"ping": ["#ff922b", 4.5, 6],
	"guide": ["#ffd43b", 4.0, 7],
}
const POINTED := {"guide": true, "party": true, "ping": true}

var zone_label: Label
var _canvas: Control
var _ground: ImageTexture
var _map_size := Vector2i.ZERO
var _dots: Array = []


func _init() -> void:
	theme_type_variation = "FramePanel"
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 3)
	add_child(box)
	zone_label = UiTheme.label("", 12, UiTheme.GOLD_LIGHT, true)
	zone_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(zone_label)
	_canvas = Control.new()
	_canvas.custom_minimum_size = Vector2(SIZE, SIZE)
	_canvas.clip_contents = true
	_canvas.draw.connect(_draw_map)
	_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(_canvas)
	var legend := HBoxContainer.new()
	legend.alignment = BoxContainer.ALIGNMENT_CENTER
	for pair in [["Sen", "#ffe14d"], ["Grup", "#4cd964"], ["Oyuncu", "#ffffff"]]:
		var l := UiTheme.label("● %s" % pair[0], 10, UiTheme.TEXT)
		l.add_theme_color_override("font_color", Color(pair[1]))
		legend.add_child(l)
	box.add_child(legend)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var cfg := ConfigFile.new()
	if cfg.load(HIDDEN_FILE) == OK:
		visible = not cfg.get_value("ui", "minimap_hidden", false)


## Paints the zone's ground; call when entering a zone.
func set_zone(map: ZoneMap, zone_name: String) -> void:
	zone_label.text = zone_name
	var colors: Array = GameData.get_value("TILE_BASE_COLORS", [])
	var image := Image.create_empty(map.width, map.height, false, Image.FORMAT_RGB8)
	for y in map.height:
		for x in map.width:
			var t := map.tiles[y * map.width + x]
			var hex: String = MINIMAP_COLORS.get(t, colors[t] if t < colors.size() else "#000000")
			image.set_pixel(x, y, Color(hex))
	_ground = ImageTexture.create_from_image(image)
	_map_size = Vector2i(map.width, map.height)


func toggle() -> void:
	visible = not visible
	var cfg := ConfigFile.new()
	cfg.load(HIDDEN_FILE)
	cfg.set_value("ui", "minimap_hidden", not visible)
	cfg.save(HIDDEN_FILE)


## dots: [{x, y, kind}] in world pixels.
func draw_dots(dots: Array) -> void:
	_dots = dots
	_canvas.queue_redraw()


func _draw_map() -> void:
	var ci := _canvas
	ci.draw_rect(Rect2(0, 0, SIZE, SIZE), Color("#0b0805"))
	var me = null
	for d in _dots:
		if d.kind == "self":
			me = d
	if me == null or _ground == null:
		return
	var ts := float(GameData.TILE_SIZE)
	var span := VIEW_RADIUS * 2 + 1
	var per_tile := float(SIZE) / span
	var left: float = me.x / ts - span / 2.0
	var top: float = me.y / ts - span / 2.0
	var sx := maxf(0.0, left)
	var sy := maxf(0.0, top)
	var ex := minf(_map_size.x, left + span)
	var ey := minf(_map_size.y, top + span)
	ci.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	if ex > sx and ey > sy:
		ci.draw_texture_rect_region(_ground, Rect2((sx - left) * per_tile, (sy - top) * per_tile, (ex - sx) * per_tile, (ey - sy) * per_tile), Rect2(sx, sy, ex - sx, ey - sy))
	var pulse := 0.65 + 0.35 * sin(Time.get_ticks_msec() / 180.0)
	var centre := SIZE / 2.0
	var sorted := _dots.duplicate()
	sorted.sort_custom(func(a, b): return DOT_STYLE[a.kind][2] < DOT_STYLE[b.kind][2])
	for dot in sorted:
		var style: Array = DOT_STYLE[dot.kind]
		var color := Color(style[0])
		var v := Vector2((dot.x / ts - left) * per_tile, (dot.y / ts - top) * per_tile)
		var inside := v.x >= 2 and v.y >= 2 and v.x <= SIZE - 2 and v.y <= SIZE - 2
		if not inside:
			if not POINTED.has(dot.kind):
				continue
			var angle := atan2(v.y - centre, v.x - centre)
			var reach := centre - 8
			var k := reach / maxf(absf(cos(angle)), absf(sin(angle)))
			var c := Color(color, pulse if dot.kind == "guide" else 0.9)
			_triangle(Vector2(centre + cos(angle) * k, centre + sin(angle) * k), angle, 7.0 if dot.kind == "guide" else 5.0, c)
			continue
		if dot.kind == "guide":
			_triangle(v + Vector2(0, -10), PI / 2.0, 6.0, Color(color, pulse))
		ci.draw_circle(v, style[1] + 1.0, Color.BLACK)
		ci.draw_circle(v, style[1], color)


func _triangle(at: Vector2, angle: float, s: float, color: Color) -> void:
	var pts := PackedVector2Array([Vector2(s, 0), Vector2(-s * 0.7, -s * 0.75), Vector2(-s * 0.7, s * 0.75)])
	var rotated := PackedVector2Array()
	for p in pts:
		rotated.append(at + p.rotated(angle))
	_canvas.draw_colored_polygon(rotated, color)
	var outline := rotated.duplicate()
	outline.append(rotated[0])
	_canvas.draw_polyline(outline, Color.BLACK, 1.5)

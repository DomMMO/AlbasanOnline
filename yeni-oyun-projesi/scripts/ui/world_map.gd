class_name WorldMap
extends GameWindow

## The big map (M, or click the minimap): the whole zone with the minimap's dots, scaled to
## fit the screen.

const SCREEN_SHARE := 0.75

var _canvas: Control
var _ground: Texture2D
var _map_size := Vector2i.ZERO
var _dots: Array = []


func _init() -> void:
	super._init("world-map", "Harita", 200)
	_canvas = Control.new()
	_canvas.clip_contents = true
	_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_canvas.draw.connect(_draw_map)
	body.add_child(_canvas)
	var legend := HBoxContainer.new()
	legend.alignment = BoxContainer.ALIGNMENT_CENTER
	legend.add_theme_constant_override("separation", 12)
	for pair in [["Sen", "self"], ["Grup", "party"], ["Oyuncu", "player"], ["Düşman", "enemy"], ["NPC", "npc"], ["Portal", "portal"]]:
		var l := UiTheme.label("● %s" % pair[0], 12, UiTheme.TEXT)
		l.add_theme_color_override("font_color", Color(Minimap.DOT_STYLE[pair[1]][0]))
		legend.add_child(l)
	body.add_child(legend)


## Call when entering a zone (the minimap's ground image).
func set_zone(ground: Texture2D, map_size: Vector2i, zone_name: String) -> void:
	_ground = ground
	_map_size = map_size
	title_label.text = zone_name
	if visible:
		_fit()


func open() -> void:
	_fit()
	super.open()


## dots: [{x, y, kind}] in world pixels, as for the minimap.
func draw_dots(dots: Array) -> void:
	_dots = dots
	_canvas.queue_redraw()


## Map pixels per tile: as big as fits in SCREEN_SHARE of the screen.
func _scale() -> float:
	if _map_size.x == 0 or _map_size.y == 0:
		return 1.0
	var room := get_viewport_rect().size * SCREEN_SHARE - Vector2(0, 60)
	return maxf(1.0, minf(room.x / _map_size.x, room.y / _map_size.y))


func _fit() -> void:
	_canvas.custom_minimum_size = Vector2(_map_size) * _scale()
	reset_size()


func _draw_map() -> void:
	var area := Rect2(Vector2.ZERO, _canvas.size)
	_canvas.draw_rect(area, Color("#0b0805"))
	if _ground == null:
		return
	var per_tile := _scale()
	_canvas.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_canvas.draw_texture_rect(_ground, Rect2(Vector2.ZERO, Vector2(_map_size) * per_tile), false)
	var ts := float(GameData.TILE_SIZE)
	var sorted := _dots.duplicate()
	sorted.sort_custom(func(a, b): return Minimap.DOT_STYLE[a.kind][2] < Minimap.DOT_STYLE[b.kind][2])
	var pulse := 0.65 + 0.35 * sin(Time.get_ticks_msec() / 180.0)
	for dot in sorted:
		var style: Array = Minimap.DOT_STYLE[dot.kind]
		var v := Vector2(dot.x / ts, dot.y / ts) * per_tile
		var color := Color(style[0], pulse) if dot.kind == "guide" else Color(style[0])
		var r: float = style[1] + 1.0
		_canvas.draw_circle(v, r + 1.0, Color.BLACK)
		_canvas.draw_circle(v, r, color)
	_canvas.draw_rect(area, Color(UiTheme.GOLD_DARK, 0.8), false, 1.0)
